import fs from 'fs/promises';
import path from 'path';
import { pool } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { env } from '../config/env';

// ---- Leader management ----

export async function listTrainings(roundId?: number) {
  let query = `SELECT dt.*, er.name as round_name, u.display_name as created_by_name,
               (SELECT COUNT(*) FROM demo_training_items WHERE training_id = dt.id) as item_count,
               (SELECT COUNT(DISTINCT user_id) FROM demo_training_attempts WHERE training_id = dt.id AND status = 'passed') as passed_count,
               (SELECT COUNT(*) FROM demo_training_assignments WHERE training_id = dt.id) as assigned_user_count
               FROM demo_trainings dt
               JOIN evaluation_rounds er ON er.id = dt.round_id
               LEFT JOIN users u ON u.id = dt.created_by`;
  const params: any[] = [];
  if (roundId) {
    query += ' WHERE dt.round_id = $1';
    params.push(roundId);
  }
  query += ' ORDER BY dt.created_at DESC';
  const { rows } = await pool.query(query, params);
  return rows;
}

export async function getTraining(id: number) {
  const { rows } = await pool.query(
    `SELECT dt.*, er.name as round_name,
            r.id as rubric_id_val, r.name as rubric_name, r.criteria as rubric_criteria
     FROM demo_trainings dt
     JOIN evaluation_rounds er ON er.id = dt.round_id
     LEFT JOIN rubrics r ON r.id = dt.rubric_id
     WHERE dt.id = $1`,
    [id]
  );
  if (rows.length === 0) throw new AppError('研修が見つかりません', 404);

  const { rows: items } = await pool.query(
    `SELECT * FROM demo_training_items WHERE training_id = $1 ORDER BY display_order`,
    [id]
  );

  const training = rows[0];
  const rubric = training.rubric_id ? {
    id: training.rubric_id_val,
    name: training.rubric_name,
    criteria: training.rubric_criteria,
  } : null;

  return { ...training, rubric, items };
}

export async function createTraining(data: {
  roundId: number; phase: string; title: string; description?: string;
  passThresholdCount: number; createdBy: number; rubricId?: number;
}) {
  const { rows } = await pool.query(
    `INSERT INTO demo_trainings (round_id, phase, title, description, pass_threshold_count, created_by, rubric_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [data.roundId, data.phase, data.title, data.description || null, data.passThresholdCount, data.createdBy, data.rubricId || null]
  );
  return rows[0];
}

export async function deleteTraining(id: number) {
  const { rows } = await pool.query('SELECT id FROM demo_trainings WHERE id = $1', [id]);
  if (rows.length === 0) throw new AppError('研修が見つかりません', 404);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Delete responses first (references attempts and items)
    await client.query(
      `DELETE FROM demo_training_responses WHERE attempt_id IN (SELECT id FROM demo_training_attempts WHERE training_id = $1)`,
      [id]
    );
    // Delete attempts
    await client.query('DELETE FROM demo_training_attempts WHERE training_id = $1', [id]);
    // Delete items
    await client.query('DELETE FROM demo_training_items WHERE training_id = $1', [id]);
    // Delete training
    await client.query('DELETE FROM demo_trainings WHERE id = $1', [id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function addTrainingItem(trainingId: number, data: {
  essayId?: number; pdfPath?: string; displayOrder: number;
  correctScore?: number; correctCriteriaScores?: any; tolerance?: number;
}) {
  const { rows } = await pool.query(
    `INSERT INTO demo_training_items (training_id, essay_id, pdf_path, display_order, correct_score, correct_criteria_scores, tolerance)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [trainingId, data.essayId || null, data.pdfPath || null, data.displayOrder,
     data.correctScore ?? null, data.correctCriteriaScores ? JSON.stringify(data.correctCriteriaScores) : null,
     data.tolerance ?? 0]
  );
  return rows[0];
}

export async function updateTrainingItem(itemId: number, data: {
  correctScore?: number; correctCriteriaScores?: any; tolerance?: number;
}) {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (data.correctScore !== undefined) { sets.push(`correct_score = $${idx++}`); params.push(data.correctScore); }
  if (data.correctCriteriaScores !== undefined) {
    sets.push(`correct_criteria_scores = $${idx++}`);
    params.push(JSON.stringify(data.correctCriteriaScores));
  }
  if (data.tolerance !== undefined) { sets.push(`tolerance = $${idx++}`); params.push(data.tolerance); }

  if (sets.length === 0) throw new AppError('更新項目がありません', 400);
  params.push(itemId);

  const { rows } = await pool.query(
    `UPDATE demo_training_items SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  if (rows.length === 0) throw new AppError('研修問題が見つかりません', 404);
  return rows[0];
}

export async function deleteTrainingItem(itemId: number) {
  const { rowCount } = await pool.query('DELETE FROM demo_training_items WHERE id = $1', [itemId]);
  if (rowCount === 0) throw new AppError('研修問題が見つかりません', 404);
}

export async function getTrainingItemById(itemId: number) {
  return pool.query('SELECT * FROM demo_training_items WHERE id = $1', [itemId]);
}

// ---- Evaluator training ----

export async function getMyTrainings(userId: number) {
  const { rows } = await pool.query(
    `SELECT dt.*, er.name as round_name,
            (SELECT COUNT(*) FROM demo_training_items WHERE training_id = dt.id) as item_count,
            (SELECT status FROM demo_training_attempts WHERE training_id = dt.id AND user_id = $1 ORDER BY completed_at DESC NULLS FIRST LIMIT 1) as my_status,
            (SELECT score_percentage FROM demo_training_attempts WHERE training_id = dt.id AND user_id = $1 ORDER BY completed_at DESC NULLS FIRST LIMIT 1) as my_score,
            (SELECT COUNT(*) FROM demo_training_attempts WHERE training_id = dt.id AND user_id = $1) as my_attempts,
            (SELECT COUNT(*) FILTER (WHERE r2.is_correct) FROM demo_training_responses r2 JOIN demo_training_attempts a2 ON a2.id = r2.attempt_id WHERE a2.training_id = dt.id AND a2.user_id = $1 AND a2.id = (SELECT id FROM demo_training_attempts WHERE training_id = dt.id AND user_id = $1 ORDER BY completed_at DESC NULLS FIRST LIMIT 1)) as my_correct,
            (SELECT COUNT(*) FROM demo_training_responses r3 JOIN demo_training_attempts a3 ON a3.id = r3.attempt_id WHERE a3.training_id = dt.id AND a3.user_id = $1 AND a3.id = (SELECT id FROM demo_training_attempts WHERE training_id = dt.id AND user_id = $1 ORDER BY completed_at DESC NULLS FIRST LIMIT 1)) as my_total
     FROM demo_trainings dt
     JOIN evaluation_rounds er ON er.id = dt.round_id
     WHERE dt.is_published = true
       AND (
         NOT EXISTS (SELECT 1 FROM demo_training_assignments dta2 WHERE dta2.training_id = dt.id)
         OR EXISTS (SELECT 1 FROM demo_training_assignments dta3 WHERE dta3.training_id = dt.id AND dta3.user_id = $1)
       )
     ORDER BY dt.created_at DESC`,
    [userId]
  );
  return rows;
}

export async function startAttempt(trainingId: number, userId: number) {
  // Check if user has already passed this training
  const { rows: passedRows } = await pool.query(
    `SELECT id FROM demo_training_attempts WHERE training_id = $1 AND user_id = $2 AND status = 'passed'`,
    [trainingId, userId]
  );
  if (passedRows.length > 0) {
    throw new AppError('既に合格済みです。再受講はできません。', 400);
  }

  // Check if there's an in-progress attempt
  const { rows: existing } = await pool.query(
    `SELECT id FROM demo_training_attempts WHERE training_id = $1 AND user_id = $2 AND status = 'in_progress'`,
    [trainingId, userId]
  );
  if (existing.length > 0) return existing[0];

  const { rows } = await pool.query(
    `INSERT INTO demo_training_attempts (training_id, user_id) VALUES ($1, $2) RETURNING *`,
    [trainingId, userId]
  );
  return rows[0];
}

export async function submitResponse(attemptId: number, itemId: number, data: {
  givenScore?: number; givenCriteriaScores?: any;
}) {
  // Get item's correct answer
  const { rows: itemRows } = await pool.query(
    `SELECT * FROM demo_training_items WHERE id = $1`,
    [itemId]
  );
  if (itemRows.length === 0) throw new AppError('研修問題が見つかりません', 404);
  const item = itemRows[0];

  // Determine correctness
  let isCorrect = false;
  const tolerance = item.tolerance || 0;

  if (item.correct_score !== null && data.givenScore !== undefined) {
    // First phase: simple score comparison
    isCorrect = Math.abs(data.givenScore - item.correct_score) <= tolerance;
  } else if (item.correct_criteria_scores && data.givenCriteriaScores) {
    // Second phase: check each criterion
    const correct = item.correct_criteria_scores as Array<{ criterion: string; score: number }>;
    const given = data.givenCriteriaScores as Array<{ criterion: string; score: number }>;
    isCorrect = correct.every((c) => {
      const g = given.find((g2) => g2.criterion === c.criterion);
      return g && Math.abs(g.score - c.score) <= tolerance;
    });
  }

  // Upsert response
  const { rows } = await pool.query(
    `INSERT INTO demo_training_responses (attempt_id, item_id, given_score, given_criteria_scores, is_correct)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (attempt_id, item_id) DO UPDATE SET
       given_score = EXCLUDED.given_score,
       given_criteria_scores = EXCLUDED.given_criteria_scores,
       is_correct = EXCLUDED.is_correct,
       responded_at = NOW()
     RETURNING *`,
    [attemptId, itemId, data.givenScore ?? null,
     data.givenCriteriaScores ? JSON.stringify(data.givenCriteriaScores) : null,
     isCorrect]
  );

  return { isCorrect, response: rows[0] };
}

export async function completeAttempt(attemptId: number) {
  // Calculate score
  const { rows: attempt } = await pool.query(
    `SELECT * FROM demo_training_attempts WHERE id = $1`,
    [attemptId]
  );
  if (attempt.length === 0) throw new AppError('研修試行が見つかりません', 404);

  const { rows: training } = await pool.query(
    `SELECT pass_threshold_count FROM demo_trainings WHERE id = $1`,
    [attempt[0].training_id]
  );

  const { rows: responses } = await pool.query(
    `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_correct) as correct
     FROM demo_training_responses WHERE attempt_id = $1`,
    [attemptId]
  );

  const total = parseInt(responses[0].total);
  const correct = parseInt(responses[0].correct);
  const percentage = total > 0 ? (correct / total) * 100 : 0;
  const passed = correct >= (training[0]?.pass_threshold_count || 3);
  const status = passed ? 'passed' : 'failed';

  await pool.query(
    `UPDATE demo_training_attempts SET status = $1, score_percentage = $2, completed_at = NOW()
     WHERE id = $3`,
    [status, percentage, attemptId]
  );

  return { status, scorePercentage: percentage, correct, total };
}

// ---- Publish / Assignment management ----

export async function togglePublish(trainingId: number, isPublished: boolean) {
  const { rows } = await pool.query(
    `UPDATE demo_trainings SET is_published = $2 WHERE id = $1 RETURNING *`,
    [trainingId, isPublished]
  );
  if (rows.length === 0) throw new AppError('研修が見つかりません', 404);
  return rows[0];
}

export async function assignTrainingToUsers(trainingId: number, userIds: number[], assignedBy: number) {
  if (userIds.length === 0) return [];
  const values = userIds.map((_, i) => `($1, $${i + 2}, $${userIds.length + 2})`).join(', ');
  const params = [trainingId, ...userIds, assignedBy];
  const { rows } = await pool.query(
    `INSERT INTO demo_training_assignments (training_id, user_id, assigned_by)
     VALUES ${values}
     ON CONFLICT (training_id, user_id) DO NOTHING
     RETURNING *`,
    params
  );
  return rows;
}

export async function getTrainingAssignments(trainingId: number) {
  const { rows } = await pool.query(
    `SELECT dta.*, u.login_id, u.display_name, u.role
     FROM demo_training_assignments dta
     JOIN users u ON u.id = dta.user_id
     WHERE dta.training_id = $1
     ORDER BY dta.assigned_at DESC`,
    [trainingId]
  );
  return rows;
}

export async function removeTrainingAssignment(trainingId: number, userId: number) {
  const { rowCount } = await pool.query(
    `DELETE FROM demo_training_assignments WHERE training_id = $1 AND user_id = $2`,
    [trainingId, userId]
  );
  if (rowCount === 0) throw new AppError('割り当てが見つかりません', 404);
}

export async function assignTrainingByLoginIds(
  trainingId: number,
  loginIds: string[],
  assignedBy: number
): Promise<{ assigned: number; errors: string[] }> {
  const errors: string[] = [];
  const userIds: number[] = [];

  for (const loginId of loginIds) {
    const trimmed = loginId.trim();
    if (!trimmed) continue;
    const { rows } = await pool.query(
      'SELECT id FROM users WHERE login_id = $1 AND is_active = true',
      [trimmed]
    );
    if (rows.length === 0) {
      errors.push(`${trimmed}: ユーザーが見つかりません`);
    } else {
      userIds.push(rows[0].id);
    }
  }

  if (userIds.length > 0) {
    await assignTrainingToUsers(trainingId, userIds, assignedBy);
  }
  return { assigned: userIds.length, errors };
}

// ---- Export training completion data ----

export async function getTrainingCompletions(trainingId?: number) {
  let where = '';
  const params: any[] = [];
  if (trainingId) {
    where = 'WHERE dta.training_id = $1';
    params.push(trainingId);
  }

  const { rows } = await pool.query(
    `SELECT dta.*, u.display_name, u.login_id, dt.title as training_title, dt.phase,
            er.name as round_name
     FROM demo_training_attempts dta
     JOIN users u ON u.id = dta.user_id
     JOIN demo_trainings dt ON dt.id = dta.training_id
     JOIN evaluation_rounds er ON er.id = dt.round_id
     ${where}
     ORDER BY dta.completed_at DESC NULLS LAST`,
    params
  );
  return rows;
}

export async function generateCompletionExport(trainingId?: number): Promise<string> {
  const ExcelJS = await import('exceljs');

  // Get latest attempt per user per training using DISTINCT ON
  const params: any[] = [];
  let where = '';
  if (trainingId) {
    where = 'WHERE dta.training_id = $1';
    params.push(trainingId);
  }

  const { rows } = await pool.query(
    `SELECT DISTINCT ON (dta.user_id, dta.training_id)
       u.login_id, u.display_name, dt.title as training_title,
       dta.status, dta.score_percentage, dta.completed_at
     FROM demo_training_attempts dta
     JOIN users u ON u.id = dta.user_id
     JOIN demo_trainings dt ON dt.id = dta.training_id
     ${where}
     ORDER BY dta.user_id, dta.training_id, dta.completed_at DESC NULLS LAST`,
    params
  );

  const workbook = new ExcelJS.default.Workbook();
  const sheet = workbook.addWorksheet('研修修了者一覧');
  sheet.columns = [
    { header: 'ログインID', key: 'login_id', width: 15 },
    { header: '評価者名', key: 'display_name', width: 20 },
    { header: '研修名', key: 'training_title', width: 30 },
    { header: '合否', key: 'status_label', width: 10 },
    { header: '得点率', key: 'score_percentage', width: 12 },
    { header: '受講日時', key: 'completed_at', width: 20 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };

  for (const row of rows) {
    sheet.addRow({
      login_id: row.login_id,
      display_name: row.display_name,
      training_title: row.training_title,
      status_label: row.status === 'passed' ? '合格' : row.status === 'failed' ? '不合格' : '受講中',
      score_percentage: row.score_percentage ? `${row.score_percentage}%` : '-',
      completed_at: row.completed_at ? new Date(row.completed_at).toLocaleString('ja-JP') : '-',
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '').slice(0, 15);
  const filename = `研修修了者一覧_${dateStr}.xlsx`;

  const exportDir = path.join(env.UPLOAD_DIR, 'exports');
  await fs.mkdir(exportDir, { recursive: true });
  await fs.writeFile(path.join(exportDir, filename), Buffer.from(buffer as ArrayBuffer));
  return filename;
}
