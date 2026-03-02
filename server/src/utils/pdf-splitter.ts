import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env';

export interface SplitResult {
  receiptNumber: string;
  pdfPath: string;
  pageStart: number;
  pageEnd: number;
}

export function formatReceiptNumber(roundId: number, seq: number): string {
  const r = String(roundId).padStart(3, '0');
  const s = String(seq).padStart(5, '0');
  return `R${r}-${s}`;
}

export async function splitPdf(
  inputPath: string,
  pagesPerEssay: number,
  roundId: number,
  startSeq: number
): Promise<SplitResult[]> {
  const pdfBytes = await fs.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();

  if (totalPages % pagesPerEssay !== 0) {
    throw new Error(
      `PDFは${totalPages}ページですが、${pagesPerEssay}枚綴りで割り切れません`
    );
  }

  const essayCount = totalPages / pagesPerEssay;
  const outputDir = path.join(env.UPLOAD_DIR, 'split', String(roundId));
  await fs.mkdir(outputDir, { recursive: true });

  const results: SplitResult[] = [];

  for (let i = 0; i < essayCount; i++) {
    const newPdf = await PDFDocument.create();
    const pageStart = i * pagesPerEssay;
    const pageIndices = Array.from({ length: pagesPerEssay }, (_, j) => pageStart + j);
    const pages = await newPdf.copyPages(pdfDoc, pageIndices);
    pages.forEach((page) => newPdf.addPage(page));

    const receiptNumber = formatReceiptNumber(roundId, startSeq + i);
    const filename = `${receiptNumber}.pdf`;
    const outputPath = path.join(outputDir, filename);
    const savedBytes = await newPdf.save();
    await fs.writeFile(outputPath, savedBytes);

    results.push({
      receiptNumber,
      pdfPath: `split/${roundId}/${filename}`,
      pageStart: pageStart + 1,
      pageEnd: pageStart + pagesPerEssay,
    });
  }

  return results;
}

export async function getPdfPageCount(inputPath: string): Promise<number> {
  const pdfBytes = await fs.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  return pdfDoc.getPageCount();
}
