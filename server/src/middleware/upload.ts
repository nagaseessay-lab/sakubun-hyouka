import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';
import { UPLOAD } from '../config/constants';

/**
 * Decode filename from latin1 (multer default) to UTF-8.
 * Fixes garbled Japanese filenames in multipart uploads.
 */
export function decodeFilename(filename: string): string {
  try {
    // Already valid UTF-8 with Japanese characters — don't double-decode
    if (/[\u3000-\u9fff\uff00-\uffef]/.test(filename)) return filename;
    const decoded = Buffer.from(filename, 'latin1').toString('utf-8');
    // If decoding produced Japanese characters, it was latin1-encoded UTF-8
    if (/[\u3000-\u9fff\uff00-\uffef]/.test(decoded)) return decoded;
    return filename;
  } catch {
    return filename;
  }
}

const originalsDir = path.join(env.UPLOAD_DIR, 'originals');
fs.mkdirSync(originalsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, originalsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

export const uploadPdf = multer({
  storage,
  limits: { fileSize: UPLOAD.MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    // Accept known PDF MIME types or files with .pdf extension
    const isPdf = UPLOAD.ALLOWED_MIME.includes(file.mimetype) ||
      file.originalname.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      cb(null, true);
    } else {
      cb(new Error('PDFファイルのみアップロード可能です'));
    }
  },
});

export const uploadCsv = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, originalsDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, 'csv-' + uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isCsv = file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.toLowerCase().endsWith('.csv');
    cb(null, isCsv);
  },
});
