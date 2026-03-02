import { pool } from '../config/database';
import { AppError } from '../middleware/errorHandler';

interface EvaluatorCapacity {
  userId: number;
  displayName: string;
  loginId: string;
  totalCapacity: number;
  currentAssigned: number;
  remainingCapacity: number;
}

export async function getMyAssignments(userId: number, query: any) {
  let where = 'WHERE a.user_id = $1';
  const params: any[] = [userId];
  let idx = 2;

  if (query.round_id) {
    where += ` AND a.round_id = $${idx++}`;
    params.push(parseInt(query.round_id));
  }
  if (query.phase) {
    where += ` AND a.phase = $${idx++}`;
    params.push(query.phase);
  }
  if (query.status) {
    where += ` AND a.status = $${idx++}`;
    params.push(query.status);
  }

  const { rows } = await pool.query(
    `SELECT a.*, e.receipt_number, e.pdf_path, e.student_number as essay_student_number,
            e.is_defective, e.defective_reason,
            e.first_phase_score as essay_first_score,
            er.name as round_name,
            s.id as score_id, s.is_draft, s.score as first_score, s.total_score as second_total,
            s.summary as existing_summary, s.comment as existing_comment,
            -- For 2nd phase: get 1st phase summary
            first_s.summary as first_phase_summary, first_s.student_number as first_student_number
     FROM assignments a
     JOIN essays e ON e.id = a.essay_id
     JOIN evaluation_rounds er ON er.id = a.round_id
     LEFT JOIN scores s ON s.assignment_id = a.id
     LEFT JOIN assignments first_a ON first_a.essay_id = e.id AND first_a.phase = 'first'
     LEFT JOIN scores first_s ON first_s.assignment_id = first_a.id AND first_s.is_draft = false
     ${where}
     ORDER BY a.assigned_at DESC`,
    params
  );
  return rows;
}

export async function getRoundAssignments(roundId: number, phase?: string) {
  let where = 'WHERE a.round_id = $1';
  const params: any[] = [roundId];

  if (phase) {
    where += ' AND a.phase = $2';
    params.push(phase);
  }

  const { rows } = await pool.query(
    `SELECT a.*, e.receipt_number, u.login_id as evaluator_login_id, u.display_name as evaluator_name
     FROM assignments a
     JOIN essays e ON e.id = a.essay_id
     JOIN users u ON u.id = a.user_id
     ${where}
     ORDER BY e.receipt_number`,
    params
  );
  return rows;
}

export async function autoAssignFirstPhase(roundId: number) {
  const evaluators = await getEvaluatorsWithCapacity(roundId);
  if (evaluators.length === 0) {
    throw new AppError('担当可能な評価者がいません', 400);
  }

  const { rows: essays } = await pool.query(
    `SELECT id FROM essays WHERE round_id = $1 AND status = 'unassigned' ORDER BY receipt_number`,
    [roundId]
  );

  if (essays.length === 0) {
    throw new AppError('割り当て対象の作文がありません', 400);
  }

  const totalCapacity = evaluators.reduce((sum, e) => sum + e.remainingCapacity, 0);
  const assignableCount = Math.min(totalCapacity, essays.length);

  // Sort evaluators by remaining capacity descending
  evaluators.sort((a, b) => b.remainingCapacity - a.remainingCapacity);

  const assignments: Array<{ essayId: number; userId: number }> = [];
  let essayIdx = 0;

  // Proportional distribution
  for (const evaluator of evaluators) {
    if (essayIdx >= assignableCount) break;

    const proportion = evaluator.remainingCapacity / totalCapacity;
    let batchSize = Math.round(assignableCount * proportion);
    batchSize = Math.min(batchSize, evaluator.remainingCapacity, assignableCount - essayIdx);
    batchSize = Math.max(batchSize, 0);

    for (let i = 0; i < batchSize && essayIdx < assignableCount; i++) {
      assignments.push({ essayId: essays[essayIdx].id, userId: evaluator.userId });
      essayIdx++;
    }
  }

  // Distribute remaining essays round-robin
  let evalIdx = 0;
  while (essayIdx < assignableCount) {
    const evaluator = evaluators[evalIdx % evaluators.length];
    if (evaluator.remainingCapacity > 0) {
      assignments.push({ essayId: essays[essayIdx].id, userId: evaluator.userId });
      evaluator.remainingCapacity--;
      essayIdx++;
    }
    evalIdx++;
    if (evalIdx > evaluators.length * 2) break; // Safety
  }

  // Bulk insert
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const asg of assignments) {
      await client.query(
        `INSERT INTO assignments (round_id, essay_id, user_id, phase, is_auto)
         VALUES ($1, $2, $3, 'first', true)
         ON CONFLICT DO NOTHING`,
        [roundId, asg.essayId, asg.userId]
      );
      await client.query(
        `UPDATE essays SET status = 'assigned_first' WHERE id = $1 AND status = 'unassigned'`,
        [asg.essayId]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Send notifications
  const userIds = [...new Set(assignments.map((a) => a.userId))];
  for (const uid of userIds) {
    const count = assignments.filter((a) => a.userId === uid).length;
    await pool.query(
      `INSERT INTO notifications (user_id, round_id, type, title, message)
       VALUES ($1, $2, 'assignment', '新しい作文が割り当てられました', $3)`,
      [uid, roundId, `1周目評価: ${count}件の作文が割り当てられました`]
    );
  }

  return { assigned: assignments.length, unassigned: essays.length - assignments.length };
}

export async function autoAssignSecondPhase(roundId: number, deadline?: string) {
  const { rows: roundRows } = await pool.query(
    'SELECT second_evaluator_count, first_phase_top_count FROM evaluation_rounds WHERE id = $1',
    [roundId]
  );
  if (roundRows.length === 0) throw new AppError('評価回が見つかりません', 404);

  const evaluatorsNeeded = roundRows[0].second_evaluator_count;
  const topCount = roundRows[0].first_phase_top_count;

  // Get top essays
  const { rows: topEssays } = await pool.query(
    `SELECT e.id, a.user_id as first_evaluator_id
     FROM essays e
     LEFT JOIN assignments a ON a.essay_id = e.id AND a.phase = 'first'
     WHERE e.round_id = $1 AND e.first_phase_score IS NOT NULL
     ORDER BY e.first_phase_score DESC
     LIMIT $2`,
    [roundId, topCount]
  );

  const evaluators = await getEvaluatorsWithCapacity(roundId);
  if (evaluators.length === 0) {
    throw new AppError('担当可能な評価者がいません', 400);
  }

  const assignments: Array<{ essayId: number; userId: number }> = [];

  for (const essay of topEssays) {
    // Filter: exclude first phase evaluator, pick by remaining capacity
    const eligible = evaluators
      .filter((e) => e.userId !== essay.first_evaluator_id && e.remainingCapacity > 0)
      .sort((a, b) => b.remainingCapacity - a.remainingCapacity);

    for (let i = 0; i < evaluatorsNeeded && i < eligible.length; i++) {
      assignments.push({ essayId: essay.id, userId: eligible[i].userId });
      eligible[i].remainingCapacity--;
    }
  }

  // Bulk insert
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const asg of assignments) {
      await client.query(
        `INSERT INTO assignments (round_id, essay_id, user_id, phase, is_auto, deadline)
         VALUES ($1, $2, $3, 'second', true, $4)`,
        [roundId, asg.essayId, asg.userId, deadline || null]
      );
    }

    // Update essay statuses
    const essayIds = [...new Set(assignments.map((a) => a.essayId))];
    if (essayIds.length > 0) {
      await client.query(
        `UPDATE essays SET status = 'assigned_second' WHERE id = ANY($1::int[])`,
        [essayIds]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Send notifications
  const userIds = [...new Set(assignments.map((a) => a.userId))];
  for (const uid of userIds) {
    const count = assignments.filter((a) => a.userId === uid).length;
    await pool.query(
      `INSERT INTO notifications (user_id, round_id, type, title, message)
       VALUES ($1, $2, 'assignment', '2周目の作文が割り当てられました', $3)`,
      [uid, roundId, `2周目評価: ${count}件の作文が割り当てられました`]
    );
  }

  return { assigned: assignments.length };
}

export async function manualAssign(data: {
  roundId: number;
  essayId?: number;
  receiptNumber?: string;
  userId: number;
  phase: string;
  assignedBy: number;
  deadline?: string;
  force?: boolean;
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Resolve essayId from receiptNumber if needed
    let essayId = data.essayId;
    if (!essayId && data.receiptNumber) {
      const { rows: essayRows } = await client.query(
        `SELECT id FROM essays WHERE receipt_number = $1 AND round_id = $2`,
        [data.receiptNumber, data.roundId]
      );
      if (essayRows.length === 0) {
        await client.query('ROLLBACK');
        throw new AppError(`受付番号「${data.receiptNumber}」の作文が見つかりません`, 404);
      }
      essayId = essayRows[0].id;
    }
    if (!essayId) {
      await client.query('ROLLBACK');
      throw new AppError('作文ID または受付番号を指定してください', 400);
    }

    // Check if already assigned for this phase
    const { rows: existing } = await client.query(
      `SELECT id, status, user_id FROM assignments WHERE essay_id = $1 AND phase = $2`,
      [essayId, data.phase]
    );

    if (data.phase === 'first' && existing.length > 0) {
      // First phase: unique assignment, update existing
      if (existing[0].status === 'completed' && !data.force) {
        await client.query('ROLLBACK');
        throw new AppError('既に完了済みの割り当ては変更できません', 400);
      }
      if (existing[0].status === 'completed' && data.force) {
        // Force: delete scores and clear essay first_phase_score
        await client.query('DELETE FROM scores WHERE assignment_id = $1', [existing[0].id]);
        await client.query(
          `UPDATE essays SET first_phase_score = NULL WHERE id = $1`,
          [essayId]
        );
      }
      const { rows } = await client.query(
        `UPDATE assignments SET user_id = $1, assigned_by = $2, is_auto = false, assigned_at = NOW(),
                status = 'pending', completed_at = NULL, deadline = $4
         WHERE id = $3 RETURNING *`,
        [data.userId, data.assignedBy, existing[0].id, data.deadline || null]
      );
      await client.query('COMMIT');
      return rows[0];
    }

    if (data.phase === 'second') {
      // Second phase: check if this user is already assigned to this essay
      const alreadyAssigned = existing.find(e => e.user_id === data.userId);
      if (alreadyAssigned) {
        if (alreadyAssigned.status === 'completed') {
          await client.query('ROLLBACK');
          throw new AppError('この評価者は既にこの作文の2周目評価を完了しています', 400);
        }
        // Update existing pending/in_progress assignment
        const { rows } = await client.query(
          `UPDATE assignments SET assigned_by = $1, is_auto = false, assigned_at = NOW()
           WHERE id = $2 RETURNING *`,
          [data.assignedBy, alreadyAssigned.id]
        );
        await client.query('COMMIT');
        return rows[0];
      }

      // Check 2nd phase evaluator count limit
      const { rows: roundRows } = await client.query(
        'SELECT second_evaluator_count FROM evaluation_rounds WHERE id = $1',
        [data.roundId]
      );
      const maxEvaluators = roundRows[0]?.second_evaluator_count || 1;
      if (existing.length >= maxEvaluators && !data.force) {
        await client.query('ROLLBACK');
        throw new AppError(`2周目の評価者は最大${maxEvaluators}名までです`, 400);
      }
    }

    // Insert new assignment
    const { rows } = await client.query(
      `INSERT INTO assignments (round_id, essay_id, user_id, phase, is_auto, assigned_by, deadline)
       VALUES ($1, $2, $3, $4, false, $5, $6) RETURNING *`,
      [data.roundId, essayId, data.userId, data.phase, data.assignedBy, data.deadline || null]
    );

    // Update essay status
    const newStatus = data.phase === 'first' ? 'assigned_first' : 'assigned_second';
    await client.query(
      `UPDATE essays SET status = $1 WHERE id = $2 AND status NOT IN ('second_complete')`,
      [newStatus, essayId]
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function reassign(assignmentId: number, newUserId: number, force: boolean = false) {
  if (!force) {
    const { rows } = await pool.query(
      `UPDATE assignments SET user_id = $1, is_auto = false, assigned_at = NOW()
       WHERE id = $2 AND status != 'completed' RETURNING *`,
      [newUserId, assignmentId]
    );
    if (rows.length === 0) throw new AppError('割り当てが見つかりません、または既に完了しています', 404);
    return rows[0];
  }

  // Force reassign: use transaction to handle completed assignments
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get assignment details
    const { rows: asgRows } = await client.query(
      'SELECT * FROM assignments WHERE id = $1',
      [assignmentId]
    );
    if (asgRows.length === 0) {
      await client.query('ROLLBACK');
      throw new AppError('割り当てが見つかりません', 404);
    }
    const assignment = asgRows[0];

    // Delete associated scores
    await client.query('DELETE FROM scores WHERE assignment_id = $1', [assignmentId]);

    // Clear essay scores based on phase
    if (assignment.phase === 'first') {
      await client.query(
        `UPDATE essays SET first_phase_score = NULL WHERE id = $1`,
        [assignment.essay_id]
      );
    } else {
      // Recalculate second_phase_avg from remaining completed assignments
      const { rows: avgRows } = await client.query(
        `SELECT AVG(s.total_score) as avg_score
         FROM assignments a
         JOIN scores s ON s.assignment_id = a.id AND s.is_draft = false
         WHERE a.essay_id = $1 AND a.phase = 'second' AND a.id != $2`,
        [assignment.essay_id, assignmentId]
      );
      const newAvg = avgRows[0]?.avg_score || null;
      await client.query(
        `UPDATE essays SET second_phase_avg = $1 WHERE id = $2`,
        [newAvg, assignment.essay_id]
      );
    }

    // Reset assignment with new user
    const { rows } = await client.query(
      `UPDATE assignments SET user_id = $1, status = 'pending', completed_at = NULL, is_auto = false, assigned_at = NOW()
       WHERE id = $2 RETURNING *`,
      [newUserId, assignmentId]
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function removeAssignment(assignmentId: number) {
  const { rows } = await pool.query(
    'DELETE FROM assignments WHERE id = $1 AND status != \'completed\' RETURNING essay_id, phase',
    [assignmentId]
  );
  if (rows.length === 0) throw new AppError('割り当てが見つかりません', 404);

  // Reset essay status
  const newStatus = rows[0].phase === 'first' ? 'unassigned' : 'first_complete';
  await pool.query('UPDATE essays SET status = $1 WHERE id = $2', [newStatus, rows[0].essay_id]);
}

export async function reopenAssignment(assignmentId: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get assignment info
    const { rows: asgRows } = await client.query(
      'SELECT * FROM assignments WHERE id = $1',
      [assignmentId]
    );
    if (asgRows.length === 0) throw new AppError('割り当てが見つかりません', 404);

    const assignment = asgRows[0];

    // Reset assignment status to pending
    await client.query(
      `UPDATE assignments SET status = 'pending', completed_at = NULL WHERE id = $1`,
      [assignmentId]
    );

    // Delete associated scores
    await client.query(
      'DELETE FROM scores WHERE assignment_id = $1',
      [assignmentId]
    );

    // Reset essay status, clear scores, and clear defective flag
    if (assignment.phase === 'first') {
      await client.query(
        `UPDATE essays SET status = 'assigned_first', first_phase_score = NULL, is_defective = false, defective_reason = NULL WHERE id = $1`,
        [assignment.essay_id]
      );
    } else {
      await client.query(
        `UPDATE essays SET status = 'assigned_second', second_phase_avg = NULL, is_defective = false, defective_reason = NULL WHERE id = $1`,
        [assignment.essay_id]
      );
    }

    await client.query('COMMIT');
    return { message: '再評価可能にしました' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function previewAutoAssign(roundId: number, phase: string) {
  if (phase === 'second') {
    return previewAutoAssignSecondPhase(roundId);
  }

  const evaluators = await getEvaluatorsWithCapacity(roundId);
  if (evaluators.length === 0) {
    throw new AppError('担当可能な評価者がいません', 400);
  }

  const { rows: essays } = await pool.query(
    `SELECT id FROM essays WHERE round_id = $1 AND status = 'unassigned' ORDER BY receipt_number`,
    [roundId]
  );

  if (essays.length === 0) {
    throw new AppError('割り当て対象の作文がありません', 400);
  }

  const totalCapacity = evaluators.reduce((sum, e) => sum + e.remainingCapacity, 0);
  const assignableCount = Math.min(totalCapacity, essays.length);

  // Sort evaluators by remaining capacity descending
  evaluators.sort((a, b) => b.remainingCapacity - a.remainingCapacity);

  // Proportional distribution (same algorithm as autoAssignFirstPhase, but counts only)
  const proposedCounts = new Map<number, number>();
  evaluators.forEach(e => proposedCounts.set(e.userId, 0));

  let remaining = assignableCount;

  for (const evaluator of evaluators) {
    if (remaining <= 0) break;
    const proportion = evaluator.remainingCapacity / totalCapacity;
    let batch = Math.round(assignableCount * proportion);
    batch = Math.min(batch, evaluator.remainingCapacity, remaining);
    batch = Math.max(batch, 0);
    proposedCounts.set(evaluator.userId, batch);
    remaining -= batch;
  }

  // Round-robin for remainder
  let evalIdx = 0;
  const evalsCopy = evaluators.map(e => ({ ...e, tempRemaining: e.remainingCapacity - (proposedCounts.get(e.userId) || 0) }));
  while (remaining > 0) {
    const ec = evalsCopy[evalIdx % evalsCopy.length];
    if (ec.tempRemaining > 0) {
      proposedCounts.set(ec.userId, (proposedCounts.get(ec.userId) || 0) + 1);
      ec.tempRemaining--;
      remaining--;
    }
    evalIdx++;
    if (evalIdx > evalsCopy.length * 2) break;
  }

  return {
    evaluators: evaluators.map(e => ({
      userId: e.userId,
      displayName: e.displayName,
      loginId: e.loginId,
      proposedCount: proposedCounts.get(e.userId) || 0,
      remainingCapacity: e.remainingCapacity,
      totalCapacity: e.totalCapacity,
      currentAssigned: e.currentAssigned,
    })),
    totalEssays: essays.length,
    assignableCount,
    unassignedCount: essays.length - assignableCount,
  };
}

async function previewAutoAssignSecondPhase(roundId: number) {
  const { rows: roundRows } = await pool.query(
    'SELECT second_evaluator_count, first_phase_top_count FROM evaluation_rounds WHERE id = $1',
    [roundId]
  );
  if (roundRows.length === 0) throw new AppError('評価回が見つかりません', 404);

  const evaluatorsNeeded = roundRows[0].second_evaluator_count;
  const topCount = roundRows[0].first_phase_top_count;

  // Get top essays
  const { rows: topEssays } = await pool.query(
    `SELECT e.id, a.user_id as first_evaluator_id
     FROM essays e
     LEFT JOIN assignments a ON a.essay_id = e.id AND a.phase = 'first'
     WHERE e.round_id = $1 AND e.first_phase_score IS NOT NULL
     ORDER BY e.first_phase_score DESC
     LIMIT $2`,
    [roundId, topCount]
  );

  if (topEssays.length === 0) {
    throw new AppError('2周目対象の作文がありません（1周目の評価が完了した作文が必要です）', 400);
  }

  const evaluators = await getEvaluatorsWithCapacity(roundId);
  if (evaluators.length === 0) {
    throw new AppError('担当可能な評価者がいません', 400);
  }

  // Simulate assignment (same logic as autoAssignSecondPhase but without DB writes)
  const proposedCounts = new Map<number, number>();
  evaluators.forEach(e => proposedCounts.set(e.userId, 0));
  const tempCapacity = new Map(evaluators.map(e => [e.userId, e.remainingCapacity]));

  let totalAssigned = 0;
  for (const essay of topEssays) {
    const eligible = evaluators
      .filter(e => e.userId !== essay.first_evaluator_id && (tempCapacity.get(e.userId) || 0) > 0)
      .sort((a, b) => (tempCapacity.get(b.userId) || 0) - (tempCapacity.get(a.userId) || 0));

    for (let i = 0; i < evaluatorsNeeded && i < eligible.length; i++) {
      proposedCounts.set(eligible[i].userId, (proposedCounts.get(eligible[i].userId) || 0) + 1);
      tempCapacity.set(eligible[i].userId, (tempCapacity.get(eligible[i].userId) || 0) - 1);
      totalAssigned++;
    }
  }

  return {
    evaluators: evaluators.map(e => ({
      userId: e.userId,
      displayName: e.displayName,
      loginId: e.loginId,
      proposedCount: proposedCounts.get(e.userId) || 0,
      remainingCapacity: e.remainingCapacity,
      totalCapacity: e.totalCapacity,
      currentAssigned: e.currentAssigned,
    })),
    totalEssays: topEssays.length,
    assignableCount: totalAssigned,
    unassignedCount: 0,
    secondPhaseInfo: {
      evaluatorsNeeded,
      topCount,
      topEssayCount: topEssays.length,
    },
  };
}

export async function confirmAutoAssign(
  roundId: number,
  phase: string,
  distributionList: Array<{ userId: number; count: number }>,
  deadline?: string
) {
  if (phase === 'second') {
    // Fall through to existing second phase logic
    return autoAssignSecondPhase(roundId, deadline);
  }

  const evaluators = await getEvaluatorsWithCapacity(roundId);
  const capacityMap = new Map(evaluators.map(e => [e.userId, e.remainingCapacity]));

  const { rows: essays } = await pool.query(
    `SELECT id FROM essays WHERE round_id = $1 AND status = 'unassigned' ORDER BY receipt_number`,
    [roundId]
  );

  if (essays.length === 0) {
    throw new AppError('割り当て対象の作文がありません', 400);
  }

  const totalRequested = distributionList.reduce((sum, d) => sum + d.count, 0);
  if (totalRequested > essays.length) {
    throw new AppError(`割り当て合計(${totalRequested})が未割当作文数(${essays.length})を超えています`, 400);
  }

  // Validate each evaluator's capacity
  for (const d of distributionList) {
    const cap = capacityMap.get(d.userId);
    if (cap === undefined) {
      throw new AppError(`評価者(ID:${d.userId})は割り当て対象外です`, 400);
    }
    if (d.count > cap) {
      throw new AppError(`評価者(ID:${d.userId})の残余容量(${cap})を超えています`, 400);
    }
  }

  // Build assignments
  const assignments: Array<{ essayId: number; userId: number }> = [];
  let essayIdx = 0;

  for (const d of distributionList) {
    for (let i = 0; i < d.count && essayIdx < essays.length; i++) {
      assignments.push({ essayId: essays[essayIdx].id, userId: d.userId });
      essayIdx++;
    }
  }

  // Bulk insert in transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const asg of assignments) {
      await client.query(
        `INSERT INTO assignments (round_id, essay_id, user_id, phase, is_auto, deadline)
         VALUES ($1, $2, $3, 'first', true, $4)
         ON CONFLICT DO NOTHING`,
        [roundId, asg.essayId, asg.userId, deadline || null]
      );
      await client.query(
        `UPDATE essays SET status = 'assigned_first' WHERE id = $1 AND status = 'unassigned'`,
        [asg.essayId]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Send notifications
  const userIds = [...new Set(assignments.map((a) => a.userId))];
  for (const uid of userIds) {
    const count = assignments.filter((a) => a.userId === uid).length;
    await pool.query(
      `INSERT INTO notifications (user_id, round_id, type, title, message)
       VALUES ($1, $2, 'assignment', '新しい作文が割り当てられました', $3)`,
      [uid, roundId, `1周目評価: ${count}件の作文が割り当てられました`]
    );
  }

  return { assigned: assignments.length, unassigned: essays.length - assignments.length };
}

export async function generateMapping(
  roundId: number,
  phase: string,
  distributionList: Array<{ userId: number; count: number }>
) {
  if (phase === 'second') {
    return generateMappingSecondPhase(roundId, distributionList);
  }

  const evaluators = await getEvaluatorsWithCapacity(roundId);
  const evalMap = new Map(evaluators.map(e => [e.userId, e]));

  const { rows: essays } = await pool.query(
    `SELECT id, receipt_number, student_number FROM essays WHERE round_id = $1 AND status = 'unassigned' ORDER BY receipt_number`,
    [roundId]
  );

  if (essays.length === 0) {
    throw new AppError('割り当て対象の作文がありません', 400);
  }

  const mapping: Array<{ essayId: number; receiptNumber: string; studentNumber: string; userId: number; displayName: string; loginId: string }> = [];
  let essayIdx = 0;

  for (const d of distributionList) {
    const ev = evalMap.get(d.userId);
    if (!ev) continue;
    for (let i = 0; i < d.count && essayIdx < essays.length; i++) {
      mapping.push({
        essayId: essays[essayIdx].id,
        receiptNumber: essays[essayIdx].receipt_number,
        studentNumber: essays[essayIdx].student_number || '',
        userId: d.userId,
        displayName: ev.displayName,
        loginId: ev.loginId,
      });
      essayIdx++;
    }
  }

  return { mapping, totalEssays: essays.length };
}

async function generateMappingSecondPhase(
  roundId: number,
  distributionList: Array<{ userId: number; count: number }>
) {
  const { rows: roundRows } = await pool.query(
    'SELECT second_evaluator_count, first_phase_top_count FROM evaluation_rounds WHERE id = $1',
    [roundId]
  );
  if (roundRows.length === 0) throw new AppError('評価回が見つかりません', 404);

  const evaluatorsNeeded = roundRows[0].second_evaluator_count;
  const topCount = roundRows[0].first_phase_top_count;

  const evaluators = await getEvaluatorsWithCapacity(roundId);
  const evalMap = new Map(evaluators.map(e => [e.userId, e]));

  const { rows: topEssays } = await pool.query(
    `SELECT e.id, e.receipt_number, e.student_number, a.user_id as first_evaluator_id
     FROM essays e
     LEFT JOIN assignments a ON a.essay_id = e.id AND a.phase = 'first'
     WHERE e.round_id = $1 AND e.first_phase_score IS NOT NULL
     ORDER BY e.first_phase_score DESC
     LIMIT $2`,
    [roundId, topCount]
  );

  if (topEssays.length === 0) {
    throw new AppError('2周目対象の作文がありません', 400);
  }

  // Build distribution map from proposed counts
  const tempCapacity = new Map<number, number>();
  for (const d of distributionList) {
    tempCapacity.set(d.userId, d.count);
  }

  const mapping: Array<{ essayId: number; receiptNumber: string; studentNumber: string; userId: number; displayName: string; loginId: string }> = [];

  for (const essay of topEssays) {
    const eligible = evaluators
      .filter(e => e.userId !== essay.first_evaluator_id && (tempCapacity.get(e.userId) || 0) > 0)
      .sort((a, b) => (tempCapacity.get(b.userId) || 0) - (tempCapacity.get(a.userId) || 0));

    for (let i = 0; i < evaluatorsNeeded && i < eligible.length; i++) {
      const ev = evalMap.get(eligible[i].userId)!;
      mapping.push({
        essayId: essay.id,
        receiptNumber: essay.receipt_number,
        studentNumber: essay.student_number || '',
        userId: eligible[i].userId,
        displayName: ev.displayName,
        loginId: ev.loginId,
      });
      tempCapacity.set(eligible[i].userId, (tempCapacity.get(eligible[i].userId) || 0) - 1);
    }
  }

  return { mapping, totalEssays: topEssays.length };
}

export async function confirmAutoAssignWithMapping(
  roundId: number,
  mapping: Array<{ essayId: number; userId: number }>,
  deadline?: string
) {
  if (mapping.length === 0) {
    throw new AppError('マッピングが空です', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const m of mapping) {
      await client.query(
        `INSERT INTO assignments (round_id, essay_id, user_id, phase, is_auto, deadline)
         VALUES ($1, $2, $3, 'first', true, $4)
         ON CONFLICT DO NOTHING`,
        [roundId, m.essayId, m.userId, deadline || null]
      );
      await client.query(
        `UPDATE essays SET status = 'assigned_first' WHERE id = $1 AND status = 'unassigned'`,
        [m.essayId]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Send notifications
  const userIds = [...new Set(mapping.map((a) => a.userId))];
  for (const uid of userIds) {
    const count = mapping.filter((a) => a.userId === uid).length;
    await pool.query(
      `INSERT INTO notifications (user_id, round_id, type, title, message)
       VALUES ($1, $2, 'assignment', '新しい作文が割り当てられました', $3)`,
      [uid, roundId, `1周目評価: ${count}件の作文が割り当てられました`]
    );
  }

  return { assigned: mapping.length };
}

export async function bulkReassign(data: {
  roundId: number;
  identifiers: string[];
  userId: number;
  phase: string;
  assignedBy: number;
  deadline?: string;
  force?: boolean;
}) {
  const results: { total: number; succeeded: number; failed: Array<{ identifier: string; error: string }> } = {
    total: data.identifiers.length,
    succeeded: 0,
    failed: [],
  };

  for (const identifier of data.identifiers) {
    const trimmed = identifier.trim();
    if (!trimmed) continue;

    try {
      // First try to find by receipt_number
      const { rows: byReceipt } = await pool.query(
        `SELECT id FROM essays WHERE receipt_number = $1 AND round_id = $2`,
        [trimmed, data.roundId]
      );

      let essayId: number | null = null;
      if (byReceipt.length > 0) {
        essayId = byReceipt[0].id;
      } else {
        // Fallback: search by student_number
        const { rows: byStudent } = await pool.query(
          `SELECT id FROM essays WHERE student_number = $1 AND round_id = $2`,
          [trimmed, data.roundId]
        );
        if (byStudent.length > 0) {
          essayId = byStudent[0].id;
        }
      }

      if (!essayId) {
        results.failed.push({ identifier: trimmed, error: '作文が見つかりません' });
        continue;
      }

      await manualAssign({
        roundId: data.roundId,
        essayId,
        userId: data.userId,
        phase: data.phase,
        assignedBy: data.assignedBy,
        deadline: data.deadline,
        force: data.force,
      });
      results.succeeded++;
    } catch (err: any) {
      results.failed.push({ identifier: trimmed, error: err.message || '不明なエラー' });
    }
  }

  return results;
}

async function getEvaluatorsWithCapacity(_roundId: number): Promise<EvaluatorCapacity[]> {
  // Global availability: sum all capacity (no round filter) and count ALL assignments across ALL rounds
  const { rows } = await pool.query(
    `SELECT u.id as user_id, u.display_name, u.login_id,
            COALESCE(av.total_capacity, 0) as total_capacity,
            COALESCE(assigned.cnt, 0) as current_assigned
     FROM users u
     LEFT JOIN (
       SELECT user_id, SUM(capacity) as total_capacity
       FROM availability
       GROUP BY user_id
     ) av ON av.user_id = u.id
     LEFT JOIN (
       SELECT user_id, COUNT(*) as cnt
       FROM assignments
       GROUP BY user_id
     ) assigned ON assigned.user_id = u.id
     WHERE u.role IN ('evaluator', 'leader') AND u.is_active = true
       AND COALESCE(av.total_capacity, 0) > COALESCE(assigned.cnt, 0)`
  );

  return rows.map((r) => ({
    userId: r.user_id,
    displayName: r.display_name,
    loginId: r.login_id,
    totalCapacity: parseInt(r.total_capacity),
    currentAssigned: parseInt(r.current_assigned),
    remainingCapacity: parseInt(r.total_capacity) - parseInt(r.current_assigned),
  }));
}
