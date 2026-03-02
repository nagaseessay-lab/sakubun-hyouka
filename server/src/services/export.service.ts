import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env';
import { pool } from '../config/database';
import { buildExportWorkbook } from '../utils/excel-builder';

export async function generateExport(roundId: number): Promise<string> {
  // Get round name for filename
  const { rows } = await pool.query('SELECT name FROM evaluation_rounds WHERE id = $1', [roundId]);
  const roundName = rows[0]?.name || `round-${roundId}`;

  const buffer = await buildExportWorkbook(roundId);

  // Format: 評価回名_YYYYMMDD_HHmmss.xlsx
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  // Sanitize round name for filename (remove characters not safe for filenames)
  const safeName = roundName.replace(/[/\\?%*:|"<>]/g, '_');
  const filename = `${safeName}_${dateStr}.xlsx`;

  const exportDir = path.join(env.UPLOAD_DIR, 'exports');
  await fs.mkdir(exportDir, { recursive: true });
  await fs.writeFile(path.join(exportDir, filename), buffer);
  return filename;
}

export function getExportPath(filename: string): string {
  return path.join(env.UPLOAD_DIR, 'exports', filename);
}

/**
 * Get evaluator stats (completion counts) by phase and date range
 */
export async function getEvaluatorStats(dateFrom?: string, dateTo?: string, roundId?: number) {
  let where = `WHERE a.status = 'completed'`;
  const params: any[] = [];
  let idx = 1;

  if (dateFrom) {
    where += ` AND a.completed_at >= $${idx++}::date`;
    params.push(dateFrom);
  }
  if (dateTo) {
    where += ` AND a.completed_at < ($${idx++}::date + interval '1 day')`;
    params.push(dateTo);
  }
  if (roundId) {
    where += ` AND a.round_id = $${idx++}`;
    params.push(roundId);
  }

  const { rows } = await pool.query(
    `SELECT u.id, u.login_id, u.display_name, u.role,
            er.id as round_id, er.name as round_name,
            a.phase,
            COUNT(*) as completed_count,
            MIN(a.completed_at) as first_completed_at,
            MAX(a.completed_at) as last_completed_at
     FROM assignments a
     JOIN users u ON u.id = a.user_id
     JOIN evaluation_rounds er ON er.id = a.round_id
     ${where}
     GROUP BY u.id, u.login_id, u.display_name, u.role, er.id, er.name, a.phase
     ORDER BY u.display_name, er.name, a.phase`,
    params
  );
  return rows;
}

/**
 * Generate Excel with evaluator stats
 */
export async function generateEvaluatorStatsExport(dateFrom?: string, dateTo?: string, roundId?: number): Promise<string> {
  const ExcelJS = await import('exceljs');
  const stats = await getEvaluatorStats(dateFrom, dateTo, roundId);

  const workbook = new ExcelJS.default.Workbook();
  const sheet = workbook.addWorksheet('評価者別実績');

  sheet.columns = [
    { header: 'ログインID', key: 'login_id', width: 15 },
    { header: '氏名', key: 'display_name', width: 20 },
    { header: '役割', key: 'role', width: 10 },
    { header: '評価回', key: 'round_name', width: 30 },
    { header: 'フェーズ', key: 'phase', width: 10 },
    { header: '完了件数', key: 'completed_count', width: 12 },
    { header: '最初の完了', key: 'first_completed_at', width: 20 },
    { header: '最後の完了', key: 'last_completed_at', width: 20 },
  ];

  // Style header
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };

  for (const row of stats) {
    sheet.addRow({
      login_id: row.login_id,
      display_name: row.display_name,
      role: row.role === 'leader' ? 'リーダー' : '評価者',
      round_name: row.round_name,
      phase: row.phase === 'first' ? '1周目' : '2周目',
      completed_count: parseInt(row.completed_count),
      first_completed_at: row.first_completed_at ? new Date(row.first_completed_at).toLocaleString('ja-JP') : '',
      last_completed_at: row.last_completed_at ? new Date(row.last_completed_at).toLocaleString('ja-JP') : '',
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const periodStr = dateFrom && dateTo ? `${dateFrom}_${dateTo}` : '全期間';
  const filename = `評価者別実績_${periodStr}_${dateStr}.xlsx`;

  const exportDir = path.join(env.UPLOAD_DIR, 'exports');
  await fs.mkdir(exportDir, { recursive: true });
  await fs.writeFile(path.join(exportDir, filename), Buffer.from(buffer as ArrayBuffer));
  return filename;
}
