import { Request, Response, NextFunction } from 'express';
import * as pdfService from '../services/pdf.service';

export async function uploadPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'PDFファイルをアップロードしてください' });
    }
    const roundId = parseInt(req.params.roundId);
    const results = [];
    const errors: string[] = [];

    for (const file of files) {
      try {
        const result = await pdfService.uploadAndSplit(file, roundId, req.user!.userId);
        results.push(result);
      } catch (err: any) {
        errors.push(`${file.originalname}: ${err.message}`);
      }
    }

    res.status(201).json({ results, errors });
  } catch (err) { next(err); }
}

export async function listUploads(req: Request, res: Response, next: NextFunction) {
  try {
    const roundId = parseInt(req.params.roundId);
    const uploads = await pdfService.listUploadedPdfs(roundId);
    res.json(uploads);
  } catch (err) { next(err); }
}

export async function deleteUpload(req: Request, res: Response, next: NextFunction) {
  try {
    const uploadId = parseInt(req.params.uploadId);
    await pdfService.deleteUploadedPdf(uploadId);
    res.json({ message: 'PDFを削除しました' });
  } catch (err) { next(err); }
}
