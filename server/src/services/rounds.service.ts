import { pool } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { RoundStatus } from '../models/types';

// Forward + reverse transitions. Reverse transitions allow "irregular" rollback.
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['uploading'],
  uploading: ['first_phase', 'second_phase', 'draft'],
  first_phase: ['first_complete', 'uploading'],
  first_complete: ['second_phase', 'archived', 'first_phase'],
  second_phase: ['second_complete', 'first_complete'],
  second_complete: ['archived', 'second_phase'],
  archived: ['second_complete'],
};

// Forward-only transitions for display
const FORWARD_TRANSITIONS: Record<string, string[]> = {
  draft: ['uploading'],
  uploading: ['first_phase', 'second_phase'],
  first_phase: ['first_complete'],
  first_complete: ['second_phase', 'archived'],
  second_phase: ['second_complete'],
  second_complete: ['archived'],
};

// Reverse-only transitions for display
const REVERSE_TRANSITIONS: Record<string, string[]> = {
  uploading: ['draft'],
  first_phase: ['uploading'],
  first_complete: ['first_phase'],
  second_phase: ['first_complete'],
  second_complete: ['second_phase'],
  archived: ['second_complete'],
};

export async function listRounds(userRole: string) {
  let query = `SELECT er.*, u.display_name as created_by_name,
               (SELECT COUNT(*) FROM essays WHERE round_id = er.id) as essay_count
               FROM evaluation_rounds er
               LEFT JOIN users u ON u.id = er.created_by`;

  if (userRole === 'evaluator') {
    query += ` WHERE er.status NOT IN ('draft', 'archived')`;
  }
  query += ' ORDER BY er.created_at DESC';

  const { rows } = await pool.query(query);
  return rows;
}

export async function getRound(id: number) {
  const { rows } = await pool.query(
    `SELECT er.*, u.display_name as created_by_name,
       (SELECT COUNT(*) FROM essays WHERE round_id = er.id) as essay_count,
       (SELECT COUNT(*) FROM essays WHERE round_id = er.id AND status != 'unassigned') as assigned_count,
       (SELECT COUNT(*) FROM essays WHERE round_id = er.id AND status IN ('first_complete', 'second_complete')) as completed_count
     FROM evaluation_rounds er
     LEFT JOIN users u ON u.id = er.created_by
     WHERE er.id = $1`,
    [id]
  );
  if (rows.length === 0) {
    throw new AppError('評価回が見つかりません', 404);
  }
  return rows[0];
}

export async function createRound(data: {
  name: string;
  phaseType: string;
  pagesPerEssay: number;
  secondEvaluatorCount: number;
  firstPhaseTopCount: number;
  createdBy: number;
  isDemo?: boolean;
}) {
  const { rows } = await pool.query(
    `INSERT INTO evaluation_rounds (name, phase_type, pages_per_essay, second_evaluator_count, first_phase_top_count, created_by, is_demo)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [data.name, data.phaseType, data.pagesPerEssay, data.secondEvaluatorCount, data.firstPhaseTopCount, data.createdBy, data.isDemo || false]
  );
  return rows[0];
}

export async function updateRound(id: number, data: {
  name?: string;
  phaseType?: string;
  pagesPerEssay?: number;
  secondEvaluatorCount?: number;
  firstPhaseTopCount?: number;
  isDemo?: boolean;
}) {
  // Only allow editing in draft status
  const { rows: checkRows } = await pool.query('SELECT status FROM evaluation_rounds WHERE id = $1', [id]);
  if (checkRows.length === 0) throw new AppError('評価回が見つかりません', 404);
  if (checkRows[0].status !== 'draft') {
    throw new AppError('下書き状態の評価回のみ編集できます', 400);
  }

  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name); }
  if (data.phaseType !== undefined) { sets.push(`phase_type = $${idx++}`); params.push(data.phaseType); }
  if (data.pagesPerEssay !== undefined) { sets.push(`pages_per_essay = $${idx++}`); params.push(data.pagesPerEssay); }
  if (data.secondEvaluatorCount !== undefined) { sets.push(`second_evaluator_count = $${idx++}`); params.push(data.secondEvaluatorCount); }
  if (data.firstPhaseTopCount !== undefined) { sets.push(`first_phase_top_count = $${idx++}`); params.push(data.firstPhaseTopCount); }
  if (data.isDemo !== undefined) { sets.push(`is_demo = $${idx++}`); params.push(data.isDemo); }

  if (sets.length === 0) throw new AppError('更新する項目がありません', 400);

  sets.push('updated_at = NOW()');
  params.push(id);

  const { rows } = await pool.query(
    `UPDATE evaluation_rounds SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  if (rows.length === 0) throw new AppError('評価回が見つかりません', 404);
  return rows[0];
}

export async function deleteRound(id: number) {
  const { rows } = await pool.query(
    'SELECT id, status, is_demo FROM evaluation_rounds WHERE id = $1',
    [id]
  );
  if (rows.length === 0) throw new AppError('評価回が見つかりません', 404);

  const round = rows[0];

  // Non-demo rounds can only be deleted if they have no essays
  if (!round.is_demo) {
    const { rows: essayRows } = await pool.query(
      'SELECT COUNT(*) as cnt FROM essays WHERE round_id = $1',
      [id]
    );
    if (parseInt(essayRows[0].cnt) > 0) {
      throw new AppError('作文データがある評価回は削除できません。デモ評価回のみデータがあっても削除できます。', 400);
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Delete all related data in correct order (child → parent)
    // Scores reference assignments, essays, users, round
    await client.query('DELETE FROM scores WHERE round_id = $1', [id]);
    // Assignments reference round, essays, users
    await client.query('DELETE FROM assignments WHERE round_id = $1', [id]);
    // Training (cascades to items/attempts/responses via ON DELETE CASCADE)
    await client.query('DELETE FROM demo_trainings WHERE round_id = $1', [id]);
    // Essays reference round, uploaded_pdfs
    await client.query('DELETE FROM essays WHERE round_id = $1', [id]);
    // Uploaded PDFs reference round
    await client.query('DELETE FROM uploaded_pdfs WHERE round_id = $1', [id]);
    // Other references
    await client.query('DELETE FROM availability WHERE round_id = $1', [id]);
    await client.query('DELETE FROM round_rubrics WHERE round_id = $1', [id]);
    await client.query('DELETE FROM notifications WHERE round_id = $1', [id]);
    // Finally delete the round itself
    await client.query('DELETE FROM evaluation_rounds WHERE id = $1', [id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function transitionStatus(id: number, newStatus: RoundStatus) {
  const { rows } = await pool.query('SELECT status, phase_type FROM evaluation_rounds WHERE id = $1', [id]);
  if (rows.length === 0) throw new AppError('評価回が見つかりません', 404);

  const current = rows[0].status;
  const phaseType = rows[0].phase_type;
  const allowed = VALID_TRANSITIONS[current] || [];

  if (!allowed.includes(newStatus)) {
    throw new AppError(`状態を ${current} から ${newStatus} に変更できません`, 400);
  }

  // Skip phases based on phase_type
  if (phaseType === 'first_only' && newStatus === 'second_phase') {
    throw new AppError('この評価回は1周目のみです', 400);
  }
  if (phaseType === 'second_only' && newStatus === 'first_phase') {
    throw new AppError('この評価回は2周目のみです', 400);
  }

  const { rows: updated } = await pool.query(
    'UPDATE evaluation_rounds SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [newStatus, id]
  );
  return updated[0];
}

export async function getProgress(roundId: number) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE status = 'unassigned') as unassigned,
       COUNT(*) FILTER (WHERE status = 'assigned_first') as assigned_first,
       COUNT(*) FILTER (WHERE status = 'first_complete') as first_complete,
       COUNT(*) FILTER (WHERE status = 'assigned_second') as assigned_second,
       COUNT(*) FILTER (WHERE status = 'second_complete') as second_complete,
       COUNT(*) FILTER (WHERE status = 'leader_hold') as leader_hold
     FROM essays WHERE round_id = $1`,
    [roundId]
  );

  const evaluatorProgress = await pool.query(
    `SELECT u.id, u.login_id, u.display_name,
       COUNT(a.id) FILTER (WHERE a.phase = 'first') as first_assigned,
       COUNT(a.id) FILTER (WHERE a.phase = 'first' AND a.status = 'completed') as first_completed,
       COUNT(a.id) FILTER (WHERE a.phase = 'second') as second_assigned,
       COUNT(a.id) FILTER (WHERE a.phase = 'second' AND a.status = 'completed') as second_completed
     FROM users u
     LEFT JOIN assignments a ON a.user_id = u.id AND a.round_id = $1
     WHERE u.role IN ('evaluator', 'leader') AND u.is_active = true
     GROUP BY u.id, u.login_id, u.display_name
     ORDER BY u.display_name`,
    [roundId]
  );

  return {
    overview: rows[0],
    evaluators: evaluatorProgress.rows,
  };
}

export async function getRankings(roundId: number) {
  const { rows } = await pool.query(
    `SELECT e.id, e.receipt_number, e.student_number, e.first_phase_score, e.second_phase_avg,
            RANK() OVER (ORDER BY COALESCE(e.second_phase_avg, e.first_phase_score) DESC NULLS LAST) as rank
     FROM essays e
     WHERE e.round_id = $1 AND e.first_phase_score IS NOT NULL
     ORDER BY rank
     LIMIT 500`,
    [roundId]
  );
  return rows;
}

export { FORWARD_TRANSITIONS, REVERSE_TRANSITIONS };
