import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error('Error:', err.message, err.stack);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Handle multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'ファイルサイズが上限を超えています' });
    }
    return res.status(400).json({ error: `アップロードエラー: ${err.message}` });
  }

  // Handle PostgreSQL constraint violation errors
  if (err.code === '23503') {
    // FK violation - could be INSERT (missing parent) or DELETE (has children)
    const detail = err.detail || '';
    if (detail.includes('is not present in')) {
      return res.status(400).json({ error: '参照先のデータが見つかりません。入力値を確認してください。' });
    }
    return res.status(400).json({ error: '関連するデータがあるため操作できません。先に関連データを確認してください。' });
  }
  if (err.code === '23505') {
    return res.status(409).json({ error: '同じデータが既に存在します。' });
  }
  if (err.code === '23514') {
    return res.status(400).json({ error: '入力値が制約に違反しています。値を確認してください。' });
  }

  // Return actual error message in development
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
}
