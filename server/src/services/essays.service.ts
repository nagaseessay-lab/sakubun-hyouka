import { pool } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { parsePagination, paginatedResponse } from '../utils/pagination';

export async function listEssays(roundId: number, query: any) {
  const { page, limit, offset } = parsePagination(query);
  const status = query.status as string | undefined;
  const search = query.search as string | undefined;
  const sortBy = query.sort_by as string | undefined;
  const sortOrder = query.sort_order as string | undefined;
  const scoreMin = query.score_min != null && query.score_min !== '' ? parseFloat(query.score_min as string) : undefined;
  const scoreMax = query.score_max != null && query.score_max !== '' ? parseFloat(query.score_max as string) : undefined;
  const scorePhase = query.score_phase as string | undefined; // 'first' or 'second'

  let where = 'WHERE e.round_id = $1';
  const params: any[] = [roundId];
  let paramIdx = 2;

  if (status) {
    where += ` AND e.status = $${paramIdx++}`;
    params.push(status);
  }

  if (search) {
    const terms = search.split(',').map((t: string) => t.trim()).filter((t: string) => t);
    if (terms.length === 1) {
      where += ` AND (e.receipt_number ILIKE $${paramIdx} OR e.student_number ILIKE $${paramIdx})`;
      params.push(`%${terms[0]}%`);
      paramIdx++;
    } else if (terms.length > 1) {
      const conditions: string[] = [];
      for (const term of terms) {
        conditions.push(`(e.receipt_number ILIKE $${paramIdx} OR e.student_number ILIKE $${paramIdx})`);
        params.push(`%${term}%`);
        paramIdx++;
      }
      where += ` AND (${conditions.join(' OR ')})`;
    }
  }

  // Score range filtering (applied as HAVING-style filter via subquery or WHERE on joined data)
  let scoreFilterClause = '';
  if (scoreMin != null || scoreMax != null) {
    if (scorePhase === 'second') {
      // Filter by second phase average (second_phase_avg on essays table or computed)
      if (scoreMin != null) {
        scoreFilterClause += ` AND e.second_phase_avg >= $${paramIdx++}`;
        params.push(scoreMin);
      }
      if (scoreMax != null) {
        scoreFilterClause += ` AND e.second_phase_avg <= $${paramIdx++}`;
        params.push(scoreMax);
      }
    } else {
      // Default: filter by first phase score
      if (scoreMin != null) {
        scoreFilterClause += ` AND e.first_phase_score >= $${paramIdx++}`;
        params.push(scoreMin);
      }
      if (scoreMax != null) {
        scoreFilterClause += ` AND e.first_phase_score <= $${paramIdx++}`;
        params.push(scoreMax);
      }
    }
    where += scoreFilterClause;
  }

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM essays e ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  // Sort column whitelist to prevent SQL injection
  const sortColumnMap: Record<string, string> = {
    receipt_number: 'e.receipt_number',
    first_score: 'e.first_phase_score',
    second_avg: 'e.second_phase_avg',
  };

  const resolvedSortCol = sortColumnMap[sortBy || ''] || 'e.receipt_number';
  const resolvedSortDir = sortOrder === 'desc' ? 'DESC' : (sortOrder === 'asc' ? 'ASC' : (sortBy === 'first_score' || sortBy === 'second_avg' ? 'DESC' : 'ASC'));
  const nullsClause = (sortBy === 'first_score' || sortBy === 'second_avg') ? ' NULLS LAST' : '';
  const orderClause = `ORDER BY ${resolvedSortCol} ${resolvedSortDir}${nullsClause}`;

  const { rows } = await pool.query(
    `SELECT e.*,
            up.original_filename,
            agg_first.user_id as first_evaluator_id,
            agg_first.login_id as first_evaluator_login_id,
            agg_first.display_name as first_evaluator_name,
            agg_first.asg_status as first_assignment_status,
            agg_first.score as first_score_value,
            agg_first.is_draft as first_is_draft,
            agg_second.evaluators as second_evaluators,
            agg_second.all_completed as second_all_completed,
            agg_second.any_draft as second_any_draft
     FROM essays e
     LEFT JOIN uploaded_pdfs up ON up.id = e.original_pdf_id
     LEFT JOIN LATERAL (
       SELECT a.user_id, u.login_id, u.display_name, a.status as asg_status,
              s.score, s.is_draft
       FROM assignments a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN scores s ON s.assignment_id = a.id
       WHERE a.essay_id = e.id AND a.phase = 'first'
       LIMIT 1
     ) agg_first ON true
     LEFT JOIN LATERAL (
       SELECT
         json_agg(json_build_object(
           'user_id', u.id,
           'display_name', u.display_name,
           'login_id', u.login_id,
           'status', a.status,
           'total_score', s.total_score,
           'is_draft', s.is_draft
         ) ORDER BY a.id) as evaluators,
         bool_and(a.status = 'completed') as all_completed,
         bool_or(s.is_draft) as any_draft
       FROM assignments a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN scores s ON s.assignment_id = a.id
       WHERE a.essay_id = e.id AND a.phase = 'second'
     ) agg_second ON true
     ${where}
     ${orderClause}
     LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
    [...params, limit, offset]
  );

  return paginatedResponse(rows, total, page, limit);
}

export async function getEssay(id: number) {
  const { rows } = await pool.query(
    `SELECT e.* FROM essays e WHERE e.id = $1`,
    [id]
  );
  if (rows.length === 0) throw new AppError('作文が見つかりません', 404);
  return rows[0];
}

export async function updateEssayStatus(id: number, newStatus: string) {
  const validStatuses = ['unassigned', 'assigned_first', 'first_complete', 'assigned_second', 'second_complete', 'leader_hold'];
  if (!validStatuses.includes(newStatus)) {
    throw new AppError(`無効な状態です: ${newStatus}`, 400);
  }
  const { rows } = await pool.query(
    'UPDATE essays SET status = $1 WHERE id = $2 RETURNING *',
    [newStatus, id]
  );
  if (rows.length === 0) throw new AppError('作文が見つかりません', 404);
  return rows[0];
}

export async function getDefectiveEssays(roundId?: number) {
  let where = 'WHERE (e.is_defective = true OR e.status = \'leader_hold\')';
  const params: any[] = [];
  let idx = 1;

  if (roundId) {
    where += ` AND e.round_id = $${idx++}`;
    params.push(roundId);
  }

  const { rows } = await pool.query(
    `SELECT e.*, er.name as round_name,
            u.display_name as evaluator_name, u.login_id as evaluator_login_id,
            s.summary, s.comment, s.score as evaluator_score
     FROM essays e
     JOIN evaluation_rounds er ON er.id = e.round_id
     LEFT JOIN assignments a ON a.essay_id = e.id AND a.phase = 'first'
     LEFT JOIN users u ON u.id = a.user_id
     LEFT JOIN scores s ON s.assignment_id = a.id
     ${where}
     ORDER BY e.created_at DESC`,
    params
  );
  return rows;
}

export async function resolveDefectiveEssay(essayId: number, action: 'reassign' | 'dismiss') {
  if (action === 'dismiss') {
    // Remove the defective flag and set back to unassigned
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Delete existing assignments and scores
      await client.query(
        `DELETE FROM scores WHERE essay_id = $1`,
        [essayId]
      );
      await client.query(
        `DELETE FROM assignments WHERE essay_id = $1`,
        [essayId]
      );
      await client.query(
        `UPDATE essays SET is_defective = false, defective_reason = NULL, status = 'unassigned', first_phase_score = NULL WHERE id = $1`,
        [essayId]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return { message: '不備を解除し、未割当に戻しました' };
  } else {
    // Mark as needing reassignment
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM scores WHERE essay_id = $1`,
        [essayId]
      );
      await client.query(
        `DELETE FROM assignments WHERE essay_id = $1`,
        [essayId]
      );
      await client.query(
        `UPDATE essays SET status = 'unassigned', first_phase_score = NULL WHERE id = $1`,
        [essayId]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return { message: '再割り当て可能にしました' };
  }
}

export async function promoteToSecondPhase(roundId: number, topCount: number) {
  // Get top essays by first phase score
  const { rows: topEssays } = await pool.query(
    `SELECT id FROM essays
     WHERE round_id = $1 AND first_phase_score IS NOT NULL AND status = 'first_complete'
     ORDER BY first_phase_score DESC
     LIMIT $2`,
    [roundId, topCount]
  );

  if (topEssays.length === 0) {
    throw new AppError('昇格対象の作文がありません', 400);
  }

  const ids = topEssays.map((e) => e.id);
  await pool.query(
    `UPDATE essays SET status = 'assigned_second'
     WHERE id = ANY($1::int[])`,
    [ids]
  );

  return { promoted: ids.length };
}

export async function bulkUpdateStatus(roundId: number, identifiers: string[], newStatus: string) {
  const validStatuses = ['unassigned', 'assigned_first', 'first_complete', 'assigned_second', 'second_complete', 'leader_hold'];
  if (!validStatuses.includes(newStatus)) {
    throw new AppError(`無効な状態です: ${newStatus}`, 400);
  }
  const results: { success: string[]; failed: Array<{ id: string; error: string }> } = { success: [], failed: [] };

  for (const id of identifiers) {
    const trimmed = id.trim();
    if (!trimmed) continue;
    try {
      const { rows } = await pool.query(
        `SELECT id FROM essays WHERE round_id = $1 AND (receipt_number = $2 OR student_number = $2)`,
        [roundId, trimmed]
      );
      if (rows.length === 0) {
        results.failed.push({ id: trimmed, error: '見つかりません' });
        continue;
      }
      await pool.query('UPDATE essays SET status = $1 WHERE id = $2', [newStatus, rows[0].id]);
      results.success.push(trimmed);
    } catch (err: any) {
      results.failed.push({ id: trimmed, error: err.message || 'エラー' });
    }
  }
  return results;
}

export async function exportEssaysCsv(roundId: number, query: any) {
  const status = query.status as string | undefined;
  const search = query.search as string | undefined;
  const sortBy = query.sort_by as string | undefined;
  const sortOrder = query.sort_order as string | undefined;
  const scoreMin = query.score_min != null && query.score_min !== '' ? parseFloat(query.score_min as string) : undefined;
  const scoreMax = query.score_max != null && query.score_max !== '' ? parseFloat(query.score_max as string) : undefined;
  const scorePhase = query.score_phase as string | undefined;

  let where = 'WHERE e.round_id = $1';
  const params: any[] = [roundId];
  let paramIdx = 2;

  if (status) {
    where += ` AND e.status = $${paramIdx++}`;
    params.push(status);
  }

  if (search) {
    const terms = search.split(',').map((t: string) => t.trim()).filter((t: string) => t);
    if (terms.length === 1) {
      where += ` AND (e.receipt_number ILIKE $${paramIdx} OR e.student_number ILIKE $${paramIdx})`;
      params.push(`%${terms[0]}%`);
      paramIdx++;
    } else if (terms.length > 1) {
      const conditions: string[] = [];
      for (const term of terms) {
        conditions.push(`(e.receipt_number ILIKE $${paramIdx} OR e.student_number ILIKE $${paramIdx})`);
        params.push(`%${term}%`);
        paramIdx++;
      }
      where += ` AND (${conditions.join(' OR ')})`;
    }
  }

  if (scoreMin != null || scoreMax != null) {
    if (scorePhase === 'second') {
      if (scoreMin != null) { where += ` AND e.second_phase_avg >= $${paramIdx++}`; params.push(scoreMin); }
      if (scoreMax != null) { where += ` AND e.second_phase_avg <= $${paramIdx++}`; params.push(scoreMax); }
    } else {
      if (scoreMin != null) { where += ` AND e.first_phase_score >= $${paramIdx++}`; params.push(scoreMin); }
      if (scoreMax != null) { where += ` AND e.first_phase_score <= $${paramIdx++}`; params.push(scoreMax); }
    }
  }

  const sortColumnMap: Record<string, string> = {
    receipt_number: 'e.receipt_number',
    first_score: 'e.first_phase_score',
    second_avg: 'e.second_phase_avg',
  };
  const resolvedSortCol = sortColumnMap[sortBy || ''] || 'e.receipt_number';
  const resolvedSortDir = sortOrder === 'desc' ? 'DESC' : (sortOrder === 'asc' ? 'ASC' : (sortBy === 'first_score' || sortBy === 'second_avg' ? 'DESC' : 'ASC'));
  const nullsClause = (sortBy === 'first_score' || sortBy === 'second_avg') ? ' NULLS LAST' : '';
  const orderClause = `ORDER BY ${resolvedSortCol} ${resolvedSortDir}${nullsClause}`;

  const { rows } = await pool.query(
    `SELECT e.*,
            agg_first.login_id as first_evaluator_login_id,
            agg_first.display_name as first_evaluator_name,
            agg_first.score as first_score_value,
            agg_second.evaluators as second_evaluators
     FROM essays e
     LEFT JOIN LATERAL (
       SELECT u.login_id, u.display_name, s.score
       FROM assignments a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN scores s ON s.assignment_id = a.id
       WHERE a.essay_id = e.id AND a.phase = 'first'
       LIMIT 1
     ) agg_first ON true
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
         'display_name', u.display_name,
         'login_id', u.login_id,
         'total_score', s.total_score
       ) ORDER BY a.id) as evaluators
       FROM assignments a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN scores s ON s.assignment_id = a.id
       WHERE a.essay_id = e.id AND a.phase = 'second'
     ) agg_second ON true
     ${where}
     ${orderClause}`,
    params
  );

  const statusMap: Record<string, string> = {
    unassigned: '未割当', assigned_first: '1周目割当済', first_complete: '1周目完了',
    assigned_second: '2周目割当済', second_complete: '2周目完了', leader_hold: 'リーダー保留',
  };

  // Build CSV
  const headers = ['受付番号', '生徒番号', '状態', '不備', '1周目担当者', '1周目ID', '1周目スコア', '2周目平均'];
  // Find max second evaluators
  let maxSecond = 0;
  for (const row of rows) {
    const evs = row.second_evaluators || [];
    if (evs.length > maxSecond) maxSecond = evs.length;
  }
  for (let i = 1; i <= maxSecond; i++) {
    headers.push(`2周目担当者${i}`, `2周目ID${i}`, `2周目スコア${i}`);
  }

  const csvRows = [headers.join(',')];
  for (const row of rows) {
    const cells: string[] = [
      csvEscape(row.receipt_number || ''),
      csvEscape(row.student_number || ''),
      csvEscape(statusMap[row.status] || row.status),
      row.is_defective ? csvEscape(row.defective_reason || 'あり') : '',
      csvEscape(row.first_evaluator_name || ''),
      csvEscape(row.first_evaluator_login_id || ''),
      row.first_score_value != null ? String(row.first_score_value) : (row.first_phase_score != null ? String(row.first_phase_score) : ''),
      row.second_phase_avg != null ? String(row.second_phase_avg) : '',
    ];
    const evs = row.second_evaluators || [];
    for (let i = 0; i < maxSecond; i++) {
      const ev = evs[i];
      cells.push(csvEscape(ev?.display_name || ''), csvEscape(ev?.login_id || ''), ev?.total_score != null ? String(ev.total_score) : '');
    }
    csvRows.push(cells.join(','));
  }

  // BOM + UTF-8
  return '\uFEFF' + csvRows.join('\n');
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

export async function replaceEssayPdf(
  essayId: number,
  newPdfPath: string,
  action: 'reassign_original' | 'reset_unassigned',
  replacedBy: number
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current essay
    const { rows: essayRows } = await client.query(
      'SELECT * FROM essays WHERE id = $1', [essayId]);
    if (essayRows.length === 0) throw new AppError('作文が見つかりません', 404);
    const essay = essayRows[0];

    // Get the original first-phase evaluator before deletion
    const { rows: origAssignment } = await client.query(
      `SELECT user_id FROM assignments WHERE essay_id = $1 AND phase = 'first' LIMIT 1`,
      [essayId]);
    const originalEvaluatorId = origAssignment[0]?.user_id;

    // Delete existing scores and assignments
    await client.query('DELETE FROM scores WHERE essay_id = $1', [essayId]);
    await client.query('DELETE FROM assignments WHERE essay_id = $1', [essayId]);

    // Update essay with new PDF path
    await client.query(
      `UPDATE essays SET pdf_path = $1, original_pdf_path = COALESCE(original_pdf_path, pdf_path),
       status = 'unassigned', first_phase_score = NULL, second_phase_avg = NULL,
       is_defective = false, defective_reason = NULL,
       replaced_at = NOW(), replaced_by = $3
       WHERE id = $2`,
      [newPdfPath, essayId, replacedBy]);

    // If action is reassign_original and we have the evaluator
    if (action === 'reassign_original' && originalEvaluatorId) {
      await client.query(
        `INSERT INTO assignments (round_id, essay_id, user_id, phase, is_auto, assigned_by)
         VALUES ($1, $2, $3, 'first', false, $4)`,
        [essay.round_id, essayId, originalEvaluatorId, replacedBy]);
      await client.query(
        `UPDATE essays SET status = 'assigned_first' WHERE id = $1`, [essayId]);
    }

    await client.query('COMMIT');
    return { success: true, essayId, action };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
}
