import { Request, Response, NextFunction } from 'express';
import * as essaysService from '../services/essays.service';
import * as pdfService from '../services/pdf.service';
import fs from 'fs';
import { pool } from '../config/database';
import { env } from '../config/env';
import path from 'path';
import fsPromises from 'fs/promises';

export async function listEssays(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await essaysService.listEssays(parseInt(req.params.roundId), req.query);
    res.json(result);
  } catch (err) { next(err); }
}

export async function getEssay(req: Request, res: Response, next: NextFunction) {
  try {
    const essay = await essaysService.getEssay(parseInt(req.params.id));
    res.json(essay);
  } catch (err) { next(err); }
}

export async function getEssayPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const essay = await essaysService.getEssay(parseInt(req.params.id));
    const filePath = pdfService.getEssayPdfPath(essay.pdf_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'PDFファイルが見つかりません' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${essay.receipt_number}.pdf"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) { next(err); }
}

export async function updateEssayStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const essay = await essaysService.updateEssayStatus(parseInt(req.params.id), req.body.status);
    res.json(essay);
  } catch (err) { next(err); }
}

export async function promoteToSecondPhase(req: Request, res: Response, next: NextFunction) {
  try {
    const topCount = req.body.topCount || 300;
    const result = await essaysService.promoteToSecondPhase(parseInt(req.params.roundId), topCount);
    res.json(result);
  } catch (err) { next(err); }
}

export async function getDefectiveEssays(req: Request, res: Response, next: NextFunction) {
  try {
    const roundId = req.query.round_id ? parseInt(req.query.round_id as string) : undefined;
    const essays = await essaysService.getDefectiveEssays(roundId);
    res.json(essays);
  } catch (err) { next(err); }
}

export async function resolveDefectiveEssay(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await essaysService.resolveDefectiveEssay(
      parseInt(req.params.id),
      req.body.action
    );
    res.json(result);
  } catch (err) { next(err); }
}

export async function bulkUpdateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const roundId = parseInt(req.params.roundId);
    const { identifiers, status } = req.body;
    if (!Array.isArray(identifiers) || identifiers.length === 0) {
      return res.status(400).json({ error: '識別子が必要です' });
    }
    if (!status) {
      return res.status(400).json({ error: '状態が必要です' });
    }
    const result = await essaysService.bulkUpdateStatus(roundId, identifiers, status);
    res.json(result);
  } catch (err) { next(err); }
}

export async function exportEssaysCsv(req: Request, res: Response, next: NextFunction) {
  try {
    const roundId = parseInt(req.params.roundId);
    const csv = await essaysService.exportEssaysCsv(roundId, req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="essays_round${roundId}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
}

export async function replaceEssayPdf(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDFファイルが必要です' });
    }
    const essayId = parseInt(req.params.id);
    const action = req.body.action as 'reassign_original' | 'reset_unassigned';
    if (!['reassign_original', 'reset_unassigned'].includes(action)) {
      return res.status(400).json({ error: 'actionは reassign_original または reset_unassigned を指定してください' });
    }

    // Store the replacement PDF in split/{roundId}/ directory
    const { rows } = await pool.query('SELECT round_id FROM essays WHERE id = $1', [essayId]);
    if (rows.length === 0) return res.status(404).json({ error: '作文が見つかりません' });

    const roundId = rows[0].round_id;
    const destDir = path.join(env.UPLOAD_DIR, 'split', String(roundId));
    await fsPromises.mkdir(destDir, { recursive: true });

    // Copy uploaded file to split directory
    const destFilename = `replaced_${essayId}_${Date.now()}.pdf`;
    const destPath = path.join(destDir, destFilename);
    await fsPromises.copyFile(req.file.path, destPath);

    const newPdfPath = `split/${roundId}/${destFilename}`;
    const result = await essaysService.replaceEssayPdf(essayId, newPdfPath, action, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
}
