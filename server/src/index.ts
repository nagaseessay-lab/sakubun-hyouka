import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { env } from './config/env';
import { pool } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';

const app = express();

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow configured origin and common dev variants
    const allowed = [
      env.CORS_ORIGIN,
      env.CORS_ORIGIN.replace('localhost', '127.0.0.1'),
    ];
    if (allowed.includes(origin) || origin.endsWith(':5173')) {
      return callback(null, true);
    }
    // In development, allow all origins
    callback(null, true);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Rate limiting on auth
app.use('/api/v1/auth/login', rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'ログイン試行回数が上限を超えました。しばらく待ってから再試行してください。' },
}));

// Routes
app.use('/api/v1', routes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Error handler
app.use(errorHandler);

// Auto-migrate on startup
async function autoMigrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id          SERIAL PRIMARY KEY,
        filename    VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const migrationsDir = path.join(__dirname, '../migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found, skipping.');
      return;
    }
    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql') && f !== '009_create_migration_table.sql')
      .sort();
    for (const file of files) {
      const { rows } = await client.query('SELECT 1 FROM _migrations WHERE filename = $1', [file]);
      if (rows.length > 0) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      console.log(`[migrate] Running ${file}...`);
      await client.query(sql);
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      console.log(`[migrate] Done: ${file}`);
    }
  } catch (err) {
    console.error('[migrate] Migration failed:', err);
  } finally {
    client.release();
  }
}

autoMigrate().then(() => {
  app.listen(env.PORT, () => {
    console.log(`Server running on http://localhost:${env.PORT}`);
  });
});

export default app;
