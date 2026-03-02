import { pool } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export async function listRubrics(phase?: string, template?: boolean) {
  let where = 'WHERE 1=1';
  const params: any[] = [];
  let idx = 1;

  if (phase) { where += ` AND phase = $${idx++}`; params.push(phase); }
  if (template !== undefined) { where += ` AND is_template = $${idx++}`; params.push(template); }

  const { rows } = await pool.query(
    `SELECT r.*, u.display_name as created_by_name
     FROM rubrics r LEFT JOIN users u ON u.id = r.created_by
     ${where} ORDER BY r.created_at DESC`,
    params
  );
  return rows;
}

export async function getRubric(id: number) {
  const { rows } = await pool.query('SELECT * FROM rubrics WHERE id = $1', [id]);
  if (rows.length === 0) throw new AppError('ルーブリックが見つかりません', 404);
  return rows[0];
}

export async function createRubric(data: {
  name: string;
  phase: string;
  criteria: any;
  isTemplate: boolean;
  createdBy: number;
}) {
  const { rows } = await pool.query(
    `INSERT INTO rubrics (name, phase, criteria, is_template, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [data.name, data.phase, JSON.stringify(data.criteria), data.isTemplate, data.createdBy]
  );
  return rows[0];
}

export async function updateRubric(id: number, data: { name?: string; criteria?: any }) {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (data.name) { sets.push(`name = $${idx++}`); params.push(data.name); }
  if (data.criteria) { sets.push(`criteria = $${idx++}`); params.push(JSON.stringify(data.criteria)); }

  if (sets.length === 0) throw new AppError('更新する項目がありません', 400);
  params.push(id);

  const { rows } = await pool.query(
    `UPDATE rubrics SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  if (rows.length === 0) throw new AppError('ルーブリックが見つかりません', 404);
  return rows[0];
}

export async function cloneRubric(id: number, createdBy: number) {
  const source = await getRubric(id);
  const { rows } = await pool.query(
    `INSERT INTO rubrics (name, phase, criteria, is_template, created_by)
     VALUES ($1, $2, $3, true, $4) RETURNING *`,
    [`${source.name}（コピー）`, source.phase, JSON.stringify(source.criteria), createdBy]
  );
  return rows[0];
}

export async function deleteRubric(id: number) {
  // Check if the rubric exists first
  const { rows: rubricCheck } = await pool.query('SELECT id FROM rubrics WHERE id = $1', [id]);
  if (rubricCheck.length === 0) throw new AppError('ルーブリックが見つかりません', 404);

  // Check if any scores exist that used this rubric (via rounds that use it)
  const { rows: scoreCheck } = await pool.query(
    `SELECT COUNT(*) as cnt FROM scores s
     JOIN round_rubrics rr ON rr.round_id = s.round_id AND rr.phase = s.phase
     WHERE rr.rubric_id = $1 AND s.is_draft = false`,
    [id]
  );
  if (parseInt(scoreCheck[0].cnt) > 0) {
    throw new AppError('提出済みの評価に使用されているルーブリックは削除できません', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Delete draft scores that reference rounds using this rubric
    await client.query(
      `DELETE FROM scores s
       USING round_rubrics rr
       WHERE rr.round_id = s.round_id AND rr.phase = s.phase
         AND rr.rubric_id = $1 AND s.is_draft = true`,
      [id]
    );
    // Remove round assignments first
    await client.query('DELETE FROM round_rubrics WHERE rubric_id = $1', [id]);
    // Delete the rubric
    await client.query('DELETE FROM rubrics WHERE id = $1', [id]);
    await client.query('COMMIT');
  } catch (err: any) {
    await client.query('ROLLBACK');
    // Provide a more helpful error message for constraint violations
    if (err.code === '23503') {
      throw new AppError('他のデータが参照しているため削除できません。関連するデータを先に削除してください。', 400);
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function assignRubricToRound(roundId: number, rubricId: number, phase: string) {
  const { rows } = await pool.query(
    `INSERT INTO round_rubrics (round_id, rubric_id, phase)
     VALUES ($1, $2, $3)
     ON CONFLICT (round_id, phase) DO UPDATE SET rubric_id = EXCLUDED.rubric_id
     RETURNING *`,
    [roundId, rubricId, phase]
  );
  return rows[0];
}

export async function getRoundRubric(roundId: number, phase: string) {
  const { rows } = await pool.query(
    `SELECT r.* FROM rubrics r
     JOIN round_rubrics rr ON rr.rubric_id = r.id
     WHERE rr.round_id = $1 AND rr.phase = $2`,
    [roundId, phase]
  );
  return rows[0] || null;
}
