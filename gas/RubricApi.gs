/**
 * RubricApi.gs - ルーブリック管理API
 */

// ===== rubrics.list =====
function handleRubricsList(params, user) {
  var rubrics = getAllRows(SHEETS.RUBRICS);

  if (params.phase) {
    // round_rubrics テーブルから phase フィルタ
    // ただし rubric 自体には phase 情報がないので criteria で判定
  }

  return rubrics.map(function(r) {
    var creator = r.created_by ? findUserById(r.created_by) : null;
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      criteria: r.criteria ? (typeof r.criteria === 'string' ? JSON.parse(r.criteria) : r.criteria) : [],
      created_by_name: creator ? creator.display_name : '',
      created_at: r.created_at,
    };
  });
}

// ===== rubrics.get =====
function handleRubricsGet(params, user) {
  var rubricId = params.rubricId || params.id;
  if (!rubricId) throw { code: 400, message: 'rubricIdが必要です' };

  var r = findRow(SHEETS.RUBRICS, { id: rubricId });
  if (!r) throw { code: 404, message: 'ルーブリックが見つかりません' };

  var creator = r.created_by ? findUserById(r.created_by) : null;
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    criteria: r.criteria ? (typeof r.criteria === 'string' ? JSON.parse(r.criteria) : r.criteria) : [],
    created_by_name: creator ? creator.display_name : '',
    created_at: r.created_at,
  };
}

// ===== rubrics.create =====
function handleRubricsCreate(params, user) {
  var name = params.name;
  var criteria = params.criteria;

  if (!name || !criteria) throw { code: 400, message: 'nameとcriteriaが必要です' };

  var newId = nextId(SHEETS.RUBRICS);
  var newRubric = {
    id: newId,
    name: name,
    description: params.description || '',
    criteria: typeof criteria === 'string' ? criteria : JSON.stringify(criteria),
    created_at: now(),
    updated_at: now(),
  };

  appendRow(SHEETS.RUBRICS, newRubric);
  logEvent(user.id, user.display_name, 'rubrics.create', { rubricId: newId });
  return {
    id: newId,
    name: name,
    description: params.description || '',
    criteria: typeof criteria === 'string' ? JSON.parse(criteria) : criteria,
    created_at: newRubric.created_at,
  };
}

// ===== rubrics.update =====
function handleRubricsUpdate(params, user) {
  var rubricId = params.rubricId || params.id;
  if (!rubricId) throw { code: 400, message: 'rubricIdが必要です' };

  var rubric = findRow(SHEETS.RUBRICS, { id: rubricId });
  if (!rubric) throw { code: 404, message: 'ルーブリックが見つかりません' };

  var updates = { updated_at: now() };
  if (params.name !== undefined) updates.name = params.name;
  if (params.description !== undefined) updates.description = params.description;
  if (params.criteria !== undefined) {
    updates.criteria = typeof params.criteria === 'string' ? params.criteria : JSON.stringify(params.criteria);
  }

  updateRowById(SHEETS.RUBRICS, rubricId, updates);
  logEvent(user.id, user.display_name, 'rubrics.update', { rubricId: rubricId });

  var updated = findRow(SHEETS.RUBRICS, { id: rubricId });
  return {
    id: updated.id,
    name: updated.name,
    description: updated.description,
    criteria: updated.criteria ? (typeof updated.criteria === 'string' ? JSON.parse(updated.criteria) : updated.criteria) : [],
  };
}

// ===== rubrics.clone =====
function handleRubricsClone(params, user) {
  var rubricId = params.rubricId || params.id;
  if (!rubricId) throw { code: 400, message: 'rubricIdが必要です' };

  var original = findRow(SHEETS.RUBRICS, { id: rubricId });
  if (!original) throw { code: 404, message: 'ルーブリックが見つかりません' };

  var newId = nextId(SHEETS.RUBRICS);
  var cloned = {
    id: newId,
    name: original.name + ' (コピー)',
    description: original.description,
    criteria: original.criteria,
    created_at: now(),
    updated_at: now(),
  };

  appendRow(SHEETS.RUBRICS, cloned);
  logEvent(user.id, user.display_name, 'rubrics.clone', { originalId: rubricId, newId: newId });
  return {
    id: newId,
    name: cloned.name,
    description: cloned.description,
    criteria: cloned.criteria ? (typeof cloned.criteria === 'string' ? JSON.parse(cloned.criteria) : cloned.criteria) : [],
  };
}

// ===== rubrics.delete =====
function handleRubricsDelete(params, user) {
  var rubricId = params.rubricId || params.id;
  if (!rubricId) throw { code: 400, message: 'rubricIdが必要です' };

  var rubric = findRow(SHEETS.RUBRICS, { id: rubricId });
  if (!rubric) throw { code: 404, message: 'ルーブリックが見つかりません' };

  // round_rubrics 削除
  deleteRows(SHEETS.ROUND_RUBRICS, { rubric_id: rubricId });

  // ルーブリック削除
  deleteRowById(SHEETS.RUBRICS, rubricId);

  logEvent(user.id, user.display_name, 'rubrics.delete', { rubricId: rubricId });
  return { message: 'ルーブリックを削除しました' };
}

// ===== rubrics.getForRound - ラウンドに紐づくルーブリック取得 =====
function handleRubricsGetForRound(params, user) {
  var roundId = params.roundId;
  var phase = params.phase;
  if (!roundId || !phase) throw { code: 400, message: 'roundIdとphaseが必要です' };

  var roundRubric = findRow(SHEETS.ROUND_RUBRICS, { round_id: roundId, phase: phase });
  if (!roundRubric) return null;

  var rubric = findRow(SHEETS.RUBRICS, { id: roundRubric.rubric_id });
  if (!rubric) return null;

  return {
    id: rubric.id,
    name: rubric.name,
    description: rubric.description,
    criteria: rubric.criteria ? (typeof rubric.criteria === 'string' ? JSON.parse(rubric.criteria) : rubric.criteria) : [],
  };
}

// ===== rubrics.assignToRound - ラウンドにルーブリック紐付け =====
function handleRubricsAssignToRound(params, user) {
  var roundId = params.roundId;
  var rubricId = params.rubricId;
  var phase = params.phase;

  if (!roundId || !rubricId || !phase) {
    throw { code: 400, message: 'roundId, rubricId, phaseが必要です' };
  }

  // 既存の紐付けを削除
  deleteRows(SHEETS.ROUND_RUBRICS, { round_id: roundId, phase: phase });

  // 新規紐付け
  appendRow(SHEETS.ROUND_RUBRICS, {
    id: nextId(SHEETS.ROUND_RUBRICS),
    round_id: roundId,
    rubric_id: rubricId,
    phase: phase,
    created_at: now(),
  });

  logEvent(user.id, user.display_name, 'rubrics.assignToRound', { roundId: roundId, rubricId: rubricId, phase: phase });
  return { message: 'ルーブリックを紐付けました' };
}
