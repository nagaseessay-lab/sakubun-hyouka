/**
 * RoundApi.gs - 評価回管理API
 */

// ===== rounds.list =====
function handleRoundsList(params, user) {
  var rounds = getAllRows(SHEETS.ROUNDS);

  // 評価者は draft/archived を除外
  if (user.role === ROLES.EVALUATOR) {
    rounds = rounds.filter(function(r) {
      return r.status !== 'draft' && r.status !== 'archived';
    });
  }

  // 各ラウンドにエッセイ数・割当数を付加
  var allEssays = getAllRows(SHEETS.ESSAYS);
  var allAssignments = getAllRows(SHEETS.ASSIGNMENTS);

  return rounds.map(function(r) {
    var roundEssays = allEssays.filter(function(e) { return String(e.round_id) === String(r.id); });
    var roundAssignments = allAssignments.filter(function(a) { return String(a.round_id) === String(r.id); });
    var completed = roundAssignments.filter(function(a) { return a.status === ASSIGNMENT_STATUS.COMPLETED; });

    var creator = r.created_by ? findUserById(r.created_by) : null;

    return {
      id: r.id,
      name: r.name,
      description: r.description,
      phase_type: r.phase || 'both',
      status: r.status,
      year: r.year,
      month: r.month,
      second_evaluator_count: r.second_evaluator_count || 1,
      first_phase_top_count: r.first_phase_top_count || 300,
      total_essay_count: roundEssays.length,
      is_demo: r.is_demo || false,
      created_by: r.created_by,
      created_by_name: creator ? creator.display_name : '',
      created_at: r.created_at,
      essay_count: roundEssays.length,
      assigned_count: roundAssignments.length,
      completed_count: completed.length,
    };
  });
}

// ===== rounds.get =====
function handleRoundsGet(params, user) {
  var roundId = params.roundId || params.id;
  if (!roundId) throw { code: 400, message: 'roundIdが必要です' };

  var r = findRow(SHEETS.ROUNDS, { id: roundId });
  if (!r) throw { code: 404, message: '評価回が見つかりません' };

  var roundEssays = findRows(SHEETS.ESSAYS, { round_id: roundId });
  var roundAssignments = findRows(SHEETS.ASSIGNMENTS, { round_id: roundId });
  var completed = roundAssignments.filter(function(a) { return a.status === ASSIGNMENT_STATUS.COMPLETED; });
  var creator = r.created_by ? findUserById(r.created_by) : null;

  return {
    id: r.id,
    name: r.name,
    description: r.description,
    phase_type: r.phase || 'both',
    status: r.status,
    year: r.year,
    month: r.month,
    second_evaluator_count: r.second_evaluator_count || 1,
    first_phase_top_count: r.first_phase_top_count || 300,
    total_essay_count: roundEssays.length,
    is_demo: r.is_demo || false,
    created_by: r.created_by,
    created_by_name: creator ? creator.display_name : '',
    created_at: r.created_at,
    essay_count: roundEssays.length,
    assigned_count: roundAssignments.length,
    completed_count: completed.length,
  };
}

// ===== rounds.create =====
function handleRoundsCreate(params, user) {
  var name = params.name;
  if (!name) throw { code: 400, message: '名前が必要です' };

  var newId = nextId(SHEETS.ROUNDS);
  var newRound = {
    id: newId,
    name: name,
    description: params.description || '',
    phase: params.phase_type || 'both',
    status: 'draft',
    year: params.year || new Date().getFullYear(),
    month: params.month || new Date().getMonth() + 1,
    second_evaluator_count: params.second_evaluator_count || 1,
    first_phase_top_count: params.first_phase_top_count || 300,
    total_essay_count: 0,
    is_demo: params.is_demo || false,
    pages_per_essay: params.pages_per_essay || 1,
    created_by: user.id,
    created_at: now(),
    updated_at: now(),
  };

  appendRow(SHEETS.ROUNDS, newRound);
  logEvent(user.id, user.display_name, 'rounds.create', { roundId: newId });
  return newRound;
}

// ===== rounds.update =====
function handleRoundsUpdate(params, user) {
  var roundId = params.roundId || params.id;
  if (!roundId) throw { code: 400, message: 'roundIdが必要です' };

  var round = findRow(SHEETS.ROUNDS, { id: roundId });
  if (!round) throw { code: 404, message: '評価回が見つかりません' };

  var updates = { updated_at: now() };
  if (params.name !== undefined) updates.name = params.name;
  if (params.description !== undefined) updates.description = params.description;
  if (params.phase_type !== undefined) updates.phase = params.phase_type;
  if (params.second_evaluator_count !== undefined) updates.second_evaluator_count = params.second_evaluator_count;
  if (params.first_phase_top_count !== undefined) updates.first_phase_top_count = params.first_phase_top_count;
  if (params.pages_per_essay !== undefined) updates.pages_per_essay = params.pages_per_essay;

  var result = updateRowById(SHEETS.ROUNDS, roundId, updates);
  logEvent(user.id, user.display_name, 'rounds.update', { roundId: roundId });
  return result;
}

// ===== rounds.delete =====
function handleRoundsDelete(params, user) {
  var roundId = params.roundId || params.id;
  if (!roundId) throw { code: 400, message: 'roundIdが必要です' };

  var round = findRow(SHEETS.ROUNDS, { id: roundId });
  if (!round) throw { code: 404, message: '評価回が見つかりません' };

  // エッセイがあれば削除不可（デモ以外）
  var essays = findRows(SHEETS.ESSAYS, { round_id: roundId });
  if (essays.length > 0 && !round.is_demo) {
    throw { code: 400, message: 'この評価回にはエッセイが存在するため削除できません' };
  }

  // 関連データ削除
  deleteRows(SHEETS.REVIEWS_LOG, { round_id: roundId });
  deleteRows(SHEETS.ASSIGNMENTS, { round_id: roundId });
  essays.forEach(function(e) { deleteRowById(SHEETS.ESSAYS, e.id); });
  deleteRows(SHEETS.QUEUE_PHASE1, { round_id: roundId });
  deleteRows(SHEETS.QUEUE_PHASE2, { round_id: roundId });
  deleteRows(SHEETS.ROUND_RUBRICS, { round_id: roundId });

  deleteRowById(SHEETS.ROUNDS, roundId);

  logEvent(user.id, user.display_name, 'rounds.delete', { roundId: roundId });
  return { message: '評価回を削除しました' };
}

// ===== rounds.transition - ステータス遷移 =====
function handleRoundsTransition(params, user) {
  var roundId = params.roundId || params.id;
  var newStatus = params.status;
  if (!roundId || !newStatus) throw { code: 400, message: 'roundIdとstatusが必要です' };

  var round = findRow(SHEETS.ROUNDS, { id: roundId });
  if (!round) throw { code: 404, message: '評価回が見つかりません' };

  // ステータス遷移の検証
  var validTransitions = {
    'draft': ['uploading'],
    'uploading': ['draft', 'first_phase'],
    'first_phase': ['uploading', 'first_complete', 'second_phase'],
    'first_complete': ['first_phase', 'second_phase', 'archived'],
    'second_phase': ['first_complete', 'second_complete'],
    'second_complete': ['second_phase', 'archived'],
    'archived': ['second_complete', 'first_complete'],
  };

  var allowed = validTransitions[round.status] || [];
  if (allowed.indexOf(newStatus) === -1) {
    throw { code: 400, message: round.status + 'から' + newStatus + 'への遷移は許可されていません' };
  }

  updateRowById(SHEETS.ROUNDS, roundId, { status: newStatus, updated_at: now() });

  logEvent(user.id, user.display_name, 'rounds.transition', { roundId: roundId, from: round.status, to: newStatus });
  return { message: 'ステータスを' + newStatus + 'に変更しました' };
}

// ===== rounds.progress - 進捗状況 =====
function handleRoundsProgress(params, user) {
  var roundId = params.roundId || params.id;
  if (!roundId) throw { code: 400, message: 'roundIdが必要です' };

  var essays = findRows(SHEETS.ESSAYS, { round_id: roundId });
  var assignments = findRows(SHEETS.ASSIGNMENTS, { round_id: roundId });

  // 概要
  var total = essays.length;
  var unassigned = essays.filter(function(e) { return e.status === 'pending' || e.status === 'unassigned'; }).length;
  var assignedFirst = essays.filter(function(e) { return e.status === 'assigned_first'; }).length;
  var firstComplete = essays.filter(function(e) { return e.status === 'first_complete' || e.status === 'scored'; }).length;
  var assignedSecond = essays.filter(function(e) { return e.status === 'assigned_second'; }).length;
  var secondComplete = essays.filter(function(e) { return e.status === 'second_complete' || e.status === 'completed'; }).length;
  var leaderHold = essays.filter(function(e) { return e.status === 'leader_hold' || e.status === 'defective'; }).length;

  // 評価者別
  var evaluatorMap = {};
  assignments.forEach(function(a) {
    if (!evaluatorMap[a.user_id]) {
      var u = findUserById(a.user_id);
      evaluatorMap[a.user_id] = {
        id: a.user_id,
        login_id: u ? u.login_id : '',
        display_name: u ? u.display_name : '',
        first_assigned: 0,
        first_completed: 0,
        second_assigned: 0,
        second_completed: 0,
      };
    }
    var ev = evaluatorMap[a.user_id];
    if (a.phase === 'first') {
      ev.first_assigned++;
      if (a.status === ASSIGNMENT_STATUS.COMPLETED) ev.first_completed++;
    } else {
      ev.second_assigned++;
      if (a.status === ASSIGNMENT_STATUS.COMPLETED) ev.second_completed++;
    }
  });

  var evaluators = Object.keys(evaluatorMap).map(function(k) { return evaluatorMap[k]; });
  evaluators.sort(function(a, b) { return (a.display_name || '') > (b.display_name || '') ? 1 : -1; });

  return {
    overview: {
      total: total,
      unassigned: unassigned,
      assigned_first: assignedFirst,
      first_complete: firstComplete,
      assigned_second: assignedSecond,
      second_complete: secondComplete,
      leader_hold: leaderHold,
    },
    evaluators: evaluators,
  };
}
