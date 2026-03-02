import { Request, Response, NextFunction } from 'express';
import * as exportService from '../services/export.service';
import fs from 'fs';

export async function generateExport(req: Request, res: Response, next: NextFunction) {
  try {
    const roundId = parseInt(req.params.roundId);
    const filename = await exportService.generateExport(roundId);
    res.json({ filename, downloadUrl: `/api/v1/exports/${filename}` });
  } catch (err) { next(err); }
}

export async function downloadExport(req: Request, res: Response, next: NextFunction) {
  try {
    const filePath = exportService.getExportPath(req.params.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'ファイルが見つかりません' });
    }
    const encodedFilename = encodeURIComponent(req.params.filename);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',
      `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) { next(err); }
}

export async function getEvaluatorStats(req: Request, res: Response, next: NextFunction) {
  try {
    const { dateFrom, dateTo, roundId } = req.query;
    const stats = await exportService.getEvaluatorStats(
      dateFrom as string | undefined,
      dateTo as string | undefined,
      roundId ? parseInt(roundId as string) : undefined,
    );
    res.json(stats);
  } catch (err) { next(err); }
}

export async function exportEvaluatorStats(req: Request, res: Response, next: NextFunction) {
  try {
    const { dateFrom, dateTo, roundId } = req.body;
    const filename = await exportService.generateEvaluatorStatsExport(
      dateFrom, dateTo, roundId ? parseInt(roundId) : undefined,
    );
    res.json({ filename, downloadUrl: `/api/v1/exports/${filename}` });
  } catch (err) { next(err); }
}
