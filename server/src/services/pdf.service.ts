import path from 'path';
import fs from 'fs/promises';
import { pool } from '../config/database';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { decodeFilename } from '../middleware/upload';
import { splitPdf, getPdfPageCount } from '../utils/pdf-splitter';

export async function checkDuplicateFilename(roundId: number, filename: string) {
  const { rows } = await pool.query(
    'SELECT id FROM uploaded_pdfs WHERE round_id = $1 AND original_filename = $2',
    [roundId, filename]
  );
  return rows.length > 0;
}

export async function uploadAndSplit(
  file: Express.Multer.File,
  roundId: number,
  uploadedBy: number
) {
  // Get round info
  const { rows: roundRows } = await pool.query(
    'SELECT pages_per_essay, status FROM evaluation_rounds WHERE id = $1',
    [roundId]
  );
  if (roundRows.length === 0) throw new AppError('評価回が見つかりません', 404);

  // Allow upload in various phases (for additional PDFs during evaluation)
  const allowedStatuses = ['uploading', 'first_phase', 'first_complete', 'second_phase'];
  if (!allowedStatuses.includes(roundRows[0].status)) {
    throw new AppError('この評価回の状態ではPDFをアップロードできません', 400);
  }

  // Decode filename (multer encodes as latin1 by default)
  const decodedFilename = decodeFilename(file.originalname);

  // Check for duplicate filename
  const isDuplicate = await checkDuplicateFilename(roundId, decodedFilename);
  if (isDuplicate) {
    throw new AppError(`同じファイル名「${decodedFilename}」は既にアップロード済みです`, 409);
  }

  const pagesPerEssay = roundRows[0].pages_per_essay;
  const totalPages = await getPdfPageCount(file.path);

  if (totalPages % pagesPerEssay !== 0) {
    throw new AppError(
      `PDFは${totalPages}ページですが、${pagesPerEssay}枚綴りで割り切れません`,
      400
    );
  }

  const essayCount = totalPages / pagesPerEssay;

  // Create uploaded_pdfs record
  const { rows: uploadRows } = await pool.query(
    `INSERT INTO uploaded_pdfs (round_id, original_filename, storage_path, total_pages, essay_count, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [roundId, decodedFilename, file.path, totalPages, essayCount, uploadedBy]
  );
  const uploadedPdfId = uploadRows[0].id;

  // Get next sequence number
  const { rows: seqRows } = await pool.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number FROM 6) AS INTEGER)), 0) as max_seq
     FROM essays WHERE round_id = $1`,
    [roundId]
  );
  const startSeq = seqRows[0].max_seq + 1;

  // Split PDF
  const results = await splitPdf(file.path, pagesPerEssay, roundId, startSeq);

  // Insert essays in batch
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const result of results) {
      await client.query(
        `INSERT INTO essays (round_id, receipt_number, pdf_path, original_pdf_id, page_start, page_end)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [roundId, result.receiptNumber, result.pdfPath, uploadedPdfId, result.pageStart, result.pageEnd]
      );
    }

    // Update total count
    await client.query(
      `UPDATE evaluation_rounds SET total_essay_count = (
         SELECT COUNT(*) FROM essays WHERE round_id = $1
       ), updated_at = NOW() WHERE id = $1`,
      [roundId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return {
    uploadedPdfId,
    essayCount,
    totalPages,
    originalFilename: decodedFilename,
    receipts: results.map((r) => r.receiptNumber),
  };
}

export async function listUploadedPdfs(roundId: number) {
  const { rows } = await pool.query(
    `SELECT up.*, u.display_name as uploaded_by_name,
       (SELECT COUNT(*) FROM essays e WHERE e.original_pdf_id = up.id) as current_essay_count,
       (SELECT COUNT(*) FROM assignments a
        JOIN essays e2 ON e2.id = a.essay_id
        WHERE e2.original_pdf_id = up.id) as assignment_count
     FROM uploaded_pdfs up
     LEFT JOIN users u ON u.id = up.uploaded_by
     WHERE up.round_id = $1
     ORDER BY up.created_at DESC`,
    [roundId]
  );
  return rows;
}

export async function deleteUploadedPdf(uploadedPdfId: number) {
  // Check if any essays from this PDF have been assigned
  const { rows: checkRows } = await pool.query(
    `SELECT COUNT(*) as cnt FROM assignments a
     JOIN essays e ON e.id = a.essay_id
     WHERE e.original_pdf_id = $1`,
    [uploadedPdfId]
  );
  if (parseInt(checkRows[0].cnt) > 0) {
    throw new AppError('振り分け済みの作文を含むPDFは取り消せません', 400);
  }

  // Get the PDF info before deleting
  const { rows: pdfRows } = await pool.query(
    'SELECT round_id, storage_path FROM uploaded_pdfs WHERE id = $1',
    [uploadedPdfId]
  );
  if (pdfRows.length === 0) throw new AppError('PDFが見つかりません', 404);
  const roundId = pdfRows[0].round_id;

  // Get split PDF paths before deleting essays
  const { rows: essayRows } = await pool.query(
    'SELECT pdf_path FROM essays WHERE original_pdf_id = $1',
    [uploadedPdfId]
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete in correct order: scores → assignments → essays → uploaded_pdfs
    await client.query(
      `DELETE FROM scores WHERE essay_id IN (SELECT id FROM essays WHERE original_pdf_id = $1)`,
      [uploadedPdfId]
    );
    await client.query(
      `DELETE FROM assignments WHERE essay_id IN (SELECT id FROM essays WHERE original_pdf_id = $1)`,
      [uploadedPdfId]
    );
    await client.query('DELETE FROM essays WHERE original_pdf_id = $1', [uploadedPdfId]);
    await client.query('DELETE FROM uploaded_pdfs WHERE id = $1', [uploadedPdfId]);

    // Update total count
    await client.query(
      `UPDATE evaluation_rounds SET total_essay_count = (
         SELECT COUNT(*) FROM essays WHERE round_id = $1
       ), updated_at = NOW() WHERE id = $1`,
      [roundId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Clean up split PDF files (best effort)
  for (const essay of essayRows) {
    try {
      await fs.unlink(path.join(env.UPLOAD_DIR, essay.pdf_path));
    } catch { /* ignore cleanup errors */ }
  }

  // Clean up original file (best effort)
  try {
    await fs.unlink(pdfRows[0].storage_path);
  } catch { /* ignore */ }
}

export function getEssayPdfPath(pdfPath: string): string {
  return path.join(env.UPLOAD_DIR, pdfPath);
}
