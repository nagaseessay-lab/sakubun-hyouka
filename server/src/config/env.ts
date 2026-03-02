import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const env = {
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://app:devpassword@localhost:5432/essay_eval',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
  PORT: parseInt(process.env.PORT || '3001', 10),
  UPLOAD_DIR: path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../storage')),
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
