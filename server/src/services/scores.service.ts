import { pool } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { SCORE_RANGES } from '../config/constants';

export async function getScore(assignmentId: number, userId: number) {
  const { rows } = await pool.query(
    `SELECT s.*, a.phase, a.essay_id, a.round_id
     FROM scores s
     JOIN assignments a ON a.id = s.assignment_id
     WHERE s.assignment_id = $1 AND (s.user_id = $2 OR EXISTS (SELECT 1 FROM users WHERE id = $2 AND role = 'leader'))`,
    [assignmentId, userId]
  );
  return rows[0] || null;
}

export async function saveScore(assignmentId: number, userId: number, data: {
  score?: number;
  criteriaScores?: Array<{ criterion: string; score: number }>;
  studentNumber?: string;
  summary?: string;
  comment?: string;
  isDefective?: boolean;
  defectiveReason?: string;
}) {
  // Verify assignment belongs to user
  const { rows: asgRows } = await pool.query(
    'SELECT * FROM assignments WHERE id = $1 AND user_id = $2',
    [assignmentId, userId]
  );
  if (asgRows.length === 0) throw new AppError('この割り当ては見つかりません', 404);

  const assignment = asgRows[0];
  if (assignment.status === 'completed') {
    throw new AppError('既に提出済みです', 400);
  }

  // Calculate total for 2nd phase
  let totalScore: number | null = null;
  if (data.criteriaScores && data.criteriaScores.length > 0) {
    totalScore = data.criteriaScores.reduce((sum, cs) => sum + cs.score, 0);
  }

  // Upsert score
  const { rows } = await pool.query(
    `INSERT INTO scores (assignment_id, essay_id, user_id, round_id, phase, score, criteria_scores, total_score, student_number, summary, comment, is_draft)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
     ON CONFLICT (assignment_id) DO UPDATE SET
       score = EXCLUDED.score,
       criteria_scores = EXCLUDED.criteria_scores,
       total_score = EXCLUDED.total_score,
       student_number = EXCLUDED.student_number,
       summary = EXCLUDED.summary,
       comment = EXCLUDED.comment,
       updated_at = NOW()
     RETURNING *`,
    [
      assignmentId, assignment.essay_id, userId, assignment.round_id, assignment.phase,
      data.score ?? null,
      data.criteriaScores ? JSON.stringify(data.criteriaScores) : null,
      totalScore,
      data.studentNumber ?? null,
      data.summary ?? null,
      data.comment ?? null,
    ]
  );

  // Handle defective essay flag
  if (data.isDefective !== undefined) {
    await pool.query(
      `UPDATE essays SET is_defective = $1, defective_reason = $2 WHERE id = $3`,
      [data.isDefective, data.defectiveReason || null, assignment.essay_id]
    );
  }

  // Update assignment status to in_progress
  if (assignment.status === 'pending') {
    await pool.query(
      "UPDATE assignments SET status = 'in_progress' WHERE id = $1",
      [assignmentId]
    );
  }

  return rows[0];
}

export async function submitScore(assignmentId: number, userId: number) {
  const { rows: asgRows } = await pool.query(
    'SELECT * FROM assignments WHERE id = $1 AND user_id = $2',
    [assignmentId, userId]
  );
  if (asgRows.length === 0) throw new AppError('この割り当ては見つかりません', 404);
  const assignment = asgRows[0];

  // Get score
  const { rows: scoreRows } = await pool.query(
    'SELECT * FROM scores WHERE assignment_id = $1',
    [assignmentId]
  );
  if (scoreRows.length === 0) throw new AppError('採点データがありません', 400);
  const score = scoreRows[0];

  // Check if essay is marked as defective -> leader hold
  const { rows: essayRows } = await pool.query('SELECT is_defective FROM essays WHERE id = $1', [assignment.essay_id]);
  if (essayRows[0]?.is_defective) {
    // Mark as leader_hold instead of completing
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE scores SET is_draft = false, submitted_at = NOW(), updated_at = NOW() WHERE id = $1`, [score.id]);
      await client.query(`UPDATE assignments SET status = 'completed', completed_at = NOW() WHERE id = $1`, [assignmentId]);
      await client.query(`UPDATE essays SET status = 'leader_hold' WHERE id = $1`, [assignment.essay_id]);
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
    return { message: '不備答案としてリーダー保留にしました' };
  }

  // Validation
  if (!score.student_number) {
    throw new AppError('生徒番号を入力してください', 400);
  }
  if (!score.summary || score.summary.trim() === '') {
    throw new AppError('作文概要を入力してください', 400);
  }

  if (assignment.phase === 'first') {
    await validateFirstPhaseScore(score, assignment);
  } else {
    await validateSecondPhaseScore(score, assignment);
  }

  // Submit
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE scores SET is_draft = false, submitted_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [score.id]
    );

    await client.query(
      `UPDATE assignments SET status = 'completed', completed_at = NOW()
       WHERE id = $1`,
      [assignmentId]
    );

    // Update denormalized scores on essay
    if (assignment.phase === 'first') {
      await client.query(
        `UPDATE essays SET first_phase_score = $1, student_number = $2, status = 'first_complete'
         WHERE id = $3`,
        [score.score, score.student_number, assignment.essay_id]
      );
    } else {
      // Calculate average of all submitted 2nd phase scores for this essay
      const { rows: avgRows } = await client.query(
        `SELECT AVG(total_score) as avg_score
         FROM scores WHERE essay_id = $1 AND phase = 'second' AND is_draft = false`,
        [assignment.essay_id]
      );
      const avg = avgRows[0]?.avg_score;

      // Check if all 2nd phase assignments are complete
      const { rows: pendingRows } = await client.query(
        `SELECT COUNT(*) as cnt FROM assignments
         WHERE essay_id = $1 AND phase = 'second' AND status != 'completed'`,
        [assignment.essay_id]
      );

      if (parseInt(pendingRows[0].cnt) === 0) {
        await client.query(
          `UPDATE essays SET second_phase_avg = $1, student_number = COALESCE(student_number, $2), status = 'second_complete'
           WHERE id = $3`,
          [avg, score.student_number, assignment.essay_id]
        );
      } else {
        await client.query(
          `UPDATE essays SET second_phase_avg = $1, student_number = COALESCE(student_number, $2)
           WHERE id = $3`,
          [avg, score.student_number, assignment.essay_id]
        );
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { message: '提出しました' };
}

async function validateFirstPhaseScore(score: any, assignment: any) {
  if (score.score === null || score.score === undefined) {
    throw new AppError('スコアを入力してください', 400);
  }

  if (score.score < SCORE_RANGES.FIRST_PHASE_MIN || score.score > SCORE_RANGES.FIRST_PHASE_MAX) {
    throw new AppError(`スコアは${SCORE_RANGES.FIRST_PHASE_MIN}〜${SCORE_RANGES.FIRST_PHASE_MAX}の範囲です`, 400);
  }

  // Level 4 limit: max 1 per 50 essays for this evaluator in this round
  if (score.score === 4) {
    const { rows } = await pool.query(
      `SELECT COUNT(*) as cnt FROM scores
       WHERE user_id = $1 AND round_id = $2 AND phase = 'first' AND score = 4 AND is_draft = false`,
      [assignment.user_id, assignment.round_id]
    );
    const { rows: totalRows } = await pool.query(
      `SELECT COUNT(*) as cnt FROM assignments
       WHERE user_id = $1 AND round_id = $2 AND phase = 'first'`,
      [assignment.user_id, assignment.round_id]
    );

    const score4Count = parseInt(rows[0].cnt);
    const totalAssigned = parseInt(totalRows[0].cnt);
    const maxAllowed = Math.floor(totalAssigned / SCORE_RANGES.LEVEL4_BATCH_SIZE) * SCORE_RANGES.LEVEL4_PER_BATCH;

    if (score4Count >= Math.max(1, maxAllowed)) {
      throw new AppError(`レベル4は${SCORE_RANGES.LEVEL4_BATCH_SIZE}枚につき${SCORE_RANGES.LEVEL4_PER_BATCH}枚までです`, 400);
    }
  }
}

async function validateSecondPhaseScore(score: any, assignment: any) {
  if (!score.criteria_scores || score.criteria_scores.length === 0) {
    throw new AppError('全ての観点を評価してください', 400);
  }

  // Validate each criterion score
  for (const cs of score.criteria_scores) {
    if (cs.score < SCORE_RANGES.SECOND_PHASE_MIN || cs.score > SCORE_RANGES.SECOND_PHASE_MAX) {
      throw new AppError(
        `各観点のスコアは${SCORE_RANGES.SECOND_PHASE_MIN}〜${SCORE_RANGES.SECOND_PHASE_MAX}の範囲です`,
        400
      );
    }
  }

  // Verify all criteria from rubric are scored
  const { rows: rubricRows } = await pool.query(
    `SELECT r.criteria FROM rubrics r
     JOIN round_rubrics rr ON rr.rubric_id = r.id
     WHERE rr.round_id = $1 AND rr.phase = 'second'`,
    [assignment.round_id]
  );

  if (rubricRows.length > 0) {
    const requiredCriteria: any[] = rubricRows[0].criteria;
    const scoredNames = score.criteria_scores.map((cs: any) => cs.criterion);
    const missing = requiredCriteria.filter((c: any) => !scoredNames.includes(c.name));
    if (missing.length > 0) {
      throw new AppError(`未評価の観点があります: ${missing.map((m: any) => m.name).join(', ')}`, 400);
    }
  }
}
