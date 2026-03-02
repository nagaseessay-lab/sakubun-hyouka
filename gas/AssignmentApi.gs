/**
 * AssignmentApi.gs - 割当管理API（自動/手動/プレビュー）
 */

// ===== assignments.listMy - 自分の割当一覧 =====
function handleAssignmentsListMy(params, user) {
  var filters = { user_id: user.id };
  if (params.round_id) filters.round_id = params.round_id;
  if (params.phase) filters.phase = params.phase;

  var assignments = findRows(SHEETS.ASSIGNMENTS, filters);
  if (params.status) {
    assignments = assignments.filter(function(a) { return a.status === params.status; });
  }

  // エッセイ・ラウンド情報付加
  return assignments.map(function(a) {
    var essay = findRow(SHEETS.ESSAYS, { id: a.essay_id });
    var round = findRow(SHEETS.ROUNDS, { id: a.round_id });

    // 既存スコア
    var reviews = findRows(SHEETS.REVIEWS_LOG, { assignment_id: a.id });
    var latestReview = null;
    if (reviews.length > 0) {
      reviews.sort(function(x, y) { return (y.submitted_at || '') > (x.submitted_at || '') ? 1 : -1; });
      latestReview = reviews[0];
    }

    // 2周目の場合: 1周目の情報
    var firstPhaseSummary = '';
    var firstStudentNumber = '';
    var essayFirstScore = '';
    if (a.phase === 'second' && essay) {
      essayFirstScore = essay.first_phase_score;
      var firstAssign = findRow(SHEETS.ASSIGNMENTS, { essay_id: a.essay_id, phase: 'first' });
      if (firstAssign) {
        var firstReviews = findRows(SHEETS.REVIEWS_LOG, { assignment_id: firstAssign.id });
        if (firstReviews.length > 0) {
          firstReviews.sort(function(x, y) { return (y.submitted_at || '') > (x.submitted_at || '') ? 1 : -1; });
          firstPhaseSummary = firstReviews[0].comment || '';
          firstStudentNumber = essay ? essay.student_number : '';
        }
      }
    }

    return {
      id: a.id,
      round_id: a.round_id,
      essay_id: a.essay_id,
      user_id: a.user_id,
      phase: a.phase,
      status: a.status,
      assigned_at: a.assigned_at,
      completed_at: a.completed_at,
      receipt_number: essay ? essay.receipt_number : '',
      pdf_file_id: essay ? essay.pdf_file_id : '',
      round_name: round ? round.name : '',
      score_id: latestReview ? latestReview.id : null,
      is_draft: a.status !== ASSIGNMENT_STATUS.COMPLETED,
      first_score: latestReview ? latestReview.score : null,
      essay_student_number: essay ? essay.student_number : '',
      is_defective: essay ? (essay.status === ESSAY_STATUS.DEFECTIVE) : false,
      defective_reason: essay ? essay.defect_reason : '',
      essay_first_score: essayFirstScore,
      first_phase_summary: firstPhaseSummary,
      first_student_number: firstStudentNumber,
      existing_summary: latestReview ? latestReview.comment : '',
      existing_comment: latestReview ? latestReview.comment : '',
    };
  });
}

// ===== assignments.listForRound - ラウンドの全割当 =====
function handleAssignmentsListForRound(params, user) {
  var roundId = params.roundId;
  var phase = params.phase;
  if (!roundId) throw { code: 400, message: 'roundIdが必要です' };

  var filters = { round_id: roundId };
  if (phase) filters.phase = phase;

  var assignments = findRows(SHEETS.ASSIGNMENTS, filters);

  return assignments.map(function(a) {
    var essay = findRow(SHEETS.ESSAYS, { id: a.essay_id });
    var assignedUser = findUserById(a.user_id);
    return {
      id: a.id,
      round_id: a.round_id,
      essay_id: a.essay_id,
      user_id: a.user_id,
      phase: a.phase,
      status: a.status,
      assigned_at: a.assigned_at,
      completed_at: a.completed_at,
      receipt_number: essay ? essay.receipt_number : '',
      evaluator_name: assignedUser ? assignedUser.display_name : '',
      evaluator_login_id: assignedUser ? assignedUser.login_id : '',
    };
  });
}

// ===== 評価者のキャパシティ計算 =====
function getEvaluatorsWithCapacity(roundId) {
  var users = getAllRows(SHEETS.USERS);
  var evaluators = users.filter(function(u) {
    return (u.role === ROLES.EVALUATOR || u.role === ROLES.LEADER) && u.is_active;
  });

  var allAvailability = getAllRows(SHEETS.AVAILABILITY);
  var allAssignments = getAllRows(SHEETS.ASSIGNMENTS);

  return evaluators.map(function(u) {
    var totalCapacity = 0;
    allAvailability.forEach(function(av) {
      if (String(av.user_id) === String(u.id)) totalCapacity += Number(av.capacity) || 0;
    });

    var assignedCount = 0;
    allAssignments.forEach(function(a) {
      if (String(a.user_id) === String(u.id) && a.status !== ASSIGNMENT_STATUS.CANCELLED) assignedCount++;
    });

    return {
      id: u.id,
      login_id: u.login_id,
      display_name: u.display_name,
      role: u.role,
      total_capacity: totalCapacity,
      assigned_count: assignedCount,
      remaining_capacity: Math.max(0, totalCapacity - assignedCount),
    };
  }).filter(function(u) { return u.remaining_capacity > 0; });
}

// ===== assignments.preview - 自動振り分けプレビュー =====
function handleAssignmentsPreview(params, user) {
  var roundId = params.roundId;
  var phase = params.phase || 'first';
  if (!roundId) throw { code: 400, message: 'roundIdが必要です' };

  var evaluators = getEvaluatorsWithCapacity(roundId);

  if (phase === 'first') {
    var unassigned = findRows(SHEETS.ESSAYS, { round_id: roundId });
    unassigned = unassigned.filter(function(e) { return e.status === 'pending' || e.status === 'unassigned'; });
    var totalEssays = unassigned.length;
    var totalCapacity = evaluators.reduce(function(s, e) { return s + e.remaining_capacity; }, 0);

    var distribution = evaluators.map(function(ev) {
      var count = totalCapacity > 0 ? Math.floor(totalEssays * ev.remaining_capacity / totalCapacity) : 0;
      return { userId: ev.id, loginId: ev.login_id, displayName: ev.display_name, count: count, capacity: ev.remaining_capacity };
    });

    // 端数分配
    var assigned = distribution.reduce(function(s, d) { return s + d.count; }, 0);
    var remaining = totalEssays - assigned;
    for (var i = 0; i < remaining && i < distribution.length; i++) {
      distribution[i].count++;
    }

    return { phase: phase, totalEssays: totalEssays, totalCapacity: totalCapacity, distribution: distribution };
  } else {
    // 2周目プレビュー
    var round = findRow(SHEETS.ROUNDS, { id: roundId });
    var secondCount = (round && round.second_evaluator_count) ? Number(round.second_evaluator_count) : 1;
    var topCount = (round && round.first_phase_top_count) ? Number(round.first_phase_top_count) : 300;

    var essays = findRows(SHEETS.ESSAYS, { round_id: roundId });
    var scored = essays.filter(function(e) { return e.first_phase_score !== '' && e.first_phase_score !== null; });
    scored.sort(function(a, b) { return Number(b.first_phase_score) - Number(a.first_phase_score); });
    var topEssays = scored.slice(0, topCount);

    var totalSlots = topEssays.length * secondCount;
    var totalCapacity2 = evaluators.reduce(function(s, e) { return s + e.remaining_capacity; }, 0);

    var distribution2 = evaluators.map(function(ev) {
      var count = totalCapacity2 > 0 ? Math.floor(totalSlots * ev.remaining_capacity / totalCapacity2) : 0;
      return { userId: ev.id, loginId: ev.login_id, displayName: ev.display_name, count: count, capacity: ev.remaining_capacity };
    });

    var assigned2 = distribution2.reduce(function(s, d) { return s + d.count; }, 0);
    var remaining2 = totalSlots - assigned2;
    for (var j = 0; j < remaining2 && j < distribution2.length; j++) {
      distribution2[j].count++;
    }

    return { phase: phase, totalEssays: topEssays.length, secondEvaluatorCount: secondCount, totalSlots: totalSlots, totalCapacity: totalCapacity2, distribution: distribution2 };
  }
}

// ===== assignments.generateMapping - マッピング生成 =====
function handleAssignmentsGenerateMapping(params, user) {
  var roundId = params.roundId;
  var phase = params.phase || 'first';
  var distributionList = params.assignments; // [{userId, count}]
  if (!roundId || !distributionList) throw { code: 400, message: 'roundIdとassignmentsが必要です' };

  var essays;
  if (phase === 'first') {
    essays = findRows(SHEETS.ESSAYS, { round_id: roundId });
    essays = essays.filter(function(e) { return e.status === 'pending' || e.status === 'unassigned'; });
  } else {
    essays = findRows(SHEETS.ESSAYS, { round_id: roundId });
    essays = essays.filter(function(e) { return e.first_phase_score !== '' && e.first_phase_score !== null; });
    essays.sort(function(a, b) { return Number(b.first_phase_score) - Number(a.first_phase_score); });
    var round = findRow(SHEETS.ROUNDS, { id: roundId });
    var topCount = (round && round.first_phase_top_count) ? Number(round.first_phase_top_count) : 300;
    essays = essays.slice(0, topCount);
  }

  var mapping = [];
  var essayIdx = 0;

  distributionList.forEach(function(dist) {
    for (var i = 0; i < dist.count && essayIdx < essays.length; i++) {
      mapping.push({ essayId: essays[essayIdx].id, userId: dist.userId, receiptNumber: essays[essayIdx].receipt_number });
      essayIdx++;
    }
  });

  return { mapping: mapping, totalMapped: mapping.length };
}

// ===== assignments.confirmMapping - マッピング確定 =====
function handleAssignmentsConfirmMapping(params, user) {
  var roundId = params.roundId;
  var mapping = params.mapping; // [{essayId, userId}]
  var deadline = params.deadline;
  var phase = params.phase || 'first';

  if (!roundId || !mapping || mapping.length === 0) {
    throw { code: 400, message: 'roundIdとmappingが必要です' };
  }

  var created = 0;
  mapping.forEach(function(m) {
    var assignmentId = nextId(SHEETS.ASSIGNMENTS);
    appendRow(SHEETS.ASSIGNMENTS, {
      id: assignmentId,
      round_id: roundId,
      essay_id: m.essayId,
      user_id: m.userId,
      phase: phase,
      status: ASSIGNMENT_STATUS.ASSIGNED,
      assigned_at: now(),
      completed_at: '',
    });

    var newStatus = phase === 'first' ? 'assigned_first' : 'assigned_second';
    updateRowById(SHEETS.ESSAYS, m.essayId, { status: newStatus, updated_at: now() });
    created++;
  });

  // 通知作成
  var userIds = {};
  mapping.forEach(function(m) { userIds[m.userId] = true; });
  Object.keys(userIds).forEach(function(uid) {
    var count = mapping.filter(function(m) { return String(m.userId) === uid; }).length;
    appendRow(SHEETS.NOTIFICATIONS, {
      id: nextId(SHEETS.NOTIFICATIONS),
      user_id: Number(uid),
      type: 'assignment',
      title: '新しい割当',
      message: count + '件の作文が割り当てられました',
      is_read: false,
      created_at: now(),
    });
  });

  logEvent(user.id, user.display_name, 'assignments.confirmMapping', { roundId: roundId, phase: phase, count: created });
  return { message: created + '件の割当を作成しました', count: created };
}

// ===== assignments.confirm - 配分確定 =====
function handleAssignmentsConfirm(params, user) {
  var roundId = params.roundId;
  var phase = params.phase || 'first';
  var distributionList = params.assignments;
  var deadline = params.deadline;

  // まずマッピング生成してから確定
  var mappingResult = handleAssignmentsGenerateMapping({ roundId: roundId, phase: phase, assignments: distributionList }, user);
  return handleAssignmentsConfirmMapping({ roundId: roundId, mapping: mappingResult.mapping, deadline: deadline, phase: phase }, user);
}

// ===== assignments.manual - 手動割当 =====
function handleAssignmentsManual(params, user) {
  var roundId = params.roundId;
  var essayId = params.essayId;
  var receiptNumber = params.receiptNumber;
  var userId = params.userId;
  var phase = params.phase || 'first';
  var force = params.force || false;

  if (!roundId || !userId) throw { code: 400, message: 'roundIdとuserIdが必要です' };

  // エッセイ特定
  var essay;
  if (essayId) {
    essay = findRow(SHEETS.ESSAYS, { id: essayId });
  } else if (receiptNumber) {
    essay = findRow(SHEETS.ESSAYS, { receipt_number: receiptNumber, round_id: roundId });
  }
  if (!essay) throw { code: 404, message: '作文が見つかりません' };

  // 既存割当チェック
  var existing = findRows(SHEETS.ASSIGNMENTS, { essay_id: essay.id, phase: phase });
  if (phase === 'first' && existing.length > 0 && !force) {
    throw { code: 400, message: 'この作文は既に1周目の割当があります。force=trueで上書きできます。' };
  }

  if (force && existing.length > 0) {
    existing.forEach(function(a) {
      deleteRows(SHEETS.REVIEWS_LOG, { assignment_id: a.id });
      deleteRowById(SHEETS.ASSIGNMENTS, a.id);
    });
  }

  var assignmentId = nextId(SHEETS.ASSIGNMENTS);
  appendRow(SHEETS.ASSIGNMENTS, {
    id: assignmentId,
    round_id: roundId,
    essay_id: essay.id,
    user_id: userId,
    phase: phase,
    status: ASSIGNMENT_STATUS.ASSIGNED,
    assigned_at: now(),
    completed_at: '',
  });

  var newStatus = phase === 'first' ? 'assigned_first' : 'assigned_second';
  updateRowById(SHEETS.ESSAYS, essay.id, { status: newStatus, updated_at: now() });

  logEvent(user.id, user.display_name, 'assignments.manual', { essayId: essay.id, userId: userId, phase: phase });
  return { id: assignmentId, message: '手動割当を作成しました' };
}

// ===== assignments.reassign - 再割当 =====
function handleAssignmentsReassign(params, user) {
  var assignmentId = params.assignmentId || params.id;
  var newUserId = params.userId;
  var force = params.force || false;

  if (!assignmentId || !newUserId) throw { code: 400, message: 'assignmentIdとuserIdが必要です' };

  var assignment = findRow(SHEETS.ASSIGNMENTS, { id: assignmentId });
  if (!assignment) throw { code: 404, message: '割当が見つかりません' };

  if (assignment.status === ASSIGNMENT_STATUS.COMPLETED && !force) {
    throw { code: 400, message: '完了済みの割当は再割当できません。force=trueで強制再割当できます。' };
  }

  if (force) {
    deleteRows(SHEETS.REVIEWS_LOG, { assignment_id: assignmentId });
  }

  updateRowById(SHEETS.ASSIGNMENTS, assignmentId, {
    user_id: newUserId,
    status: ASSIGNMENT_STATUS.ASSIGNED,
    completed_at: '',
  });

  logEvent(user.id, user.display_name, 'assignments.reassign', { assignmentId: assignmentId, newUserId: newUserId });
  return { message: '再割当しました' };
}

// ===== assignments.remove - 割当削除 =====
function handleAssignmentsRemove(params, user) {
  var assignmentId = params.assignmentId || params.id;
  if (!assignmentId) throw { code: 400, message: 'assignmentIdが必要です' };

  var assignment = findRow(SHEETS.ASSIGNMENTS, { id: assignmentId });
  if (!assignment) throw { code: 404, message: '割当が見つかりません' };

  if (assignment.status === ASSIGNMENT_STATUS.COMPLETED) {
    throw { code: 400, message: '完了済みの割当は削除できません' };
  }

  deleteRows(SHEETS.REVIEWS_LOG, { assignment_id: assignmentId });
  deleteRowById(SHEETS.ASSIGNMENTS, assignmentId);
  deleteRows(SHEETS.LOCKS, { essay_id: assignment.essay_id });

  // エッセイステータスリセット
  var remainingAssigns = findRows(SHEETS.ASSIGNMENTS, { essay_id: assignment.essay_id });
  if (remainingAssigns.length === 0) {
    updateRowById(SHEETS.ESSAYS, assignment.essay_id, { status: 'pending', updated_at: now() });
  }

  logEvent(user.id, user.display_name, 'assignments.remove', { assignmentId: assignmentId });
  return { message: '割当を削除しました' };
}

// ===== assignments.reopen - 割当再開 =====
function handleAssignmentsReopen(params, user) {
  var assignmentId = params.assignmentId || params.id;
  if (!assignmentId) throw { code: 400, message: 'assignmentIdが必要です' };

  var assignment = findRow(SHEETS.ASSIGNMENTS, { id: assignmentId });
  if (!assignment) throw { code: 404, message: '割当が見つかりません' };

  // スコアを削除
  deleteRows(SHEETS.REVIEWS_LOG, { assignment_id: assignmentId });

  // 割当をリセット
  updateRowById(SHEETS.ASSIGNMENTS, assignmentId, {
    status: ASSIGNMENT_STATUS.ASSIGNED,
    completed_at: '',
  });

  // エッセイの不備フラグをクリア
  var essayUpdate = { updated_at: now() };
  var essay = findRow(SHEETS.ESSAYS, { id: assignment.essay_id });
  if (essay && essay.status === ESSAY_STATUS.DEFECTIVE) {
    essayUpdate.status = assignment.phase === 'first' ? 'assigned_first' : 'assigned_second';
    essayUpdate.defect_reason = '';
    essayUpdate.defect_comment = '';
  }
  if (assignment.phase === 'first') {
    essayUpdate.first_phase_score = '';
  } else {
    essayUpdate.second_phase_score = '';
    essayUpdate.final_score = '';
  }
  updateRowById(SHEETS.ESSAYS, assignment.essay_id, essayUpdate);

  logEvent(user.id, user.display_name, 'assignments.reopen', { assignmentId: assignmentId });
  return { message: '割当を再開しました' };
}

// ===== assignments.bulkReassign - 一括再割当 =====
function handleAssignmentsBulkReassign(params, user) {
  var roundId = params.roundId;
  var identifiers = params.identifiers; // 受付番号/生徒番号の配列
  var userId = params.userId;
  var phase = params.phase || 'first';
  var force = params.force || false;

  if (!roundId || !identifiers || !userId) {
    throw { code: 400, message: 'roundId, identifiers, userIdが必要です' };
  }

  var essays = findRows(SHEETS.ESSAYS, { round_id: roundId });
  var total = 0, succeeded = 0;
  var failed = [];

  identifiers.forEach(function(ident) {
    total++;
    var essay = essays.find(function(e) {
      return e.receipt_number === ident || e.student_number === ident;
    });
    if (!essay) {
      failed.push({ identifier: ident, error: '作文が見つかりません' });
      return;
    }

    try {
      handleAssignmentsManual({
        roundId: roundId,
        essayId: essay.id,
        userId: userId,
        phase: phase,
        force: force,
      }, user);
      succeeded++;
    } catch (err) {
      failed.push({ identifier: ident, error: err.message });
    }
  });

  return { total: total, succeeded: succeeded, failed: failed };
}
