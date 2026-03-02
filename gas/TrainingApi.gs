/**
 * TrainingApi.gs - デモ研修API
 */

// ===== training.list - リーダー用研修一覧 =====
function handleTrainingList(params, user) {
  var trainings = getAllRows(SHEETS.TRAININGS);
  if (params.roundId) {
    trainings = trainings.filter(function(t) { return String(t.round_id) === String(params.roundId); });
  }

  var allItems = getAllRows(SHEETS.TRAINING_ITEMS);
  var allAttempts = getAllRows(SHEETS.TRAINING_ATTEMPTS);
  var allTAssignments = getAllRows(SHEETS.TRAINING_ASSIGNMENTS);

  return trainings.map(function(t) {
    var items = allItems.filter(function(i) { return String(i.training_id) === String(t.id); });
    var attempts = allAttempts.filter(function(a) { return String(a.training_id) === String(t.id); });
    var passed = attempts.filter(function(a) { return a.status === 'passed'; });
    var uniquePassed = {};
    passed.forEach(function(a) { uniquePassed[a.user_id] = true; });
    var tAssigns = allTAssignments.filter(function(a) { return String(a.training_id) === String(t.id); });

    var round = findRow(SHEETS.ROUNDS, { id: t.round_id });
    var creator = t.created_by ? findUserById(t.created_by) : null;

    return {
      id: t.id,
      round_id: t.round_id,
      round_name: round ? round.name : '',
      phase: t.phase,
      title: t.title,
      description: t.description,
      pass_threshold_count: t.pass_threshold_count,
      rubric_id: t.rubric_id,
      is_published: t.is_published === true || t.is_published === 'true',
      created_by: t.created_by,
      created_by_name: creator ? creator.display_name : '',
      created_at: t.created_at,
      item_count: items.length,
      passed_count: Object.keys(uniquePassed).length,
      assigned_user_count: tAssigns.length,
    };
  }).sort(function(a, b) { return (b.created_at || '') > (a.created_at || '') ? 1 : -1; });
}

// ===== training.create =====
function handleTrainingCreate(params, user) {
  if (!params.roundId || !params.title) throw { code: 400, message: 'roundIdとtitleが必要です' };

  var newId = nextId(SHEETS.TRAININGS);
  var training = {
    id: newId,
    round_id: params.roundId,
    phase: params.phase || 'first',
    title: params.title,
    description: params.description || '',
    pass_threshold_count: params.passThresholdCount || 3,
    rubric_id: params.rubricId || '',
    is_published: false,
    created_by: user.id,
    created_at: now(),
    updated_at: now(),
  };

  appendRow(SHEETS.TRAININGS, training);
  logEvent(user.id, user.display_name, 'training.create', { trainingId: newId });
  return training;
}

// ===== training.delete =====
function handleTrainingDelete(params, user) {
  var trainingId = params.trainingId || params.id;
  if (!trainingId) throw { code: 400, message: 'trainingIdが必要です' };

  // 関連データ削除
  deleteRows(SHEETS.TRAINING_RESPONSES, { attempt_id: '_BULK_' }); // 手動で処理
  var attempts = findRows(SHEETS.TRAINING_ATTEMPTS, { training_id: trainingId });
  attempts.forEach(function(a) { deleteRows(SHEETS.TRAINING_RESPONSES, { attempt_id: a.id }); });
  deleteRows(SHEETS.TRAINING_ATTEMPTS, { training_id: trainingId });
  deleteRows(SHEETS.TRAINING_ITEMS, { training_id: trainingId });
  deleteRows(SHEETS.TRAINING_ASSIGNMENTS, { training_id: trainingId });
  deleteRowById(SHEETS.TRAININGS, trainingId);

  logEvent(user.id, user.display_name, 'training.delete', { trainingId: trainingId });
  return { message: '研修を削除しました' };
}

// ===== training.get - 研修詳細 =====
function handleTrainingGet(params, user) {
  var trainingId = params.trainingId || params.id;
  if (!trainingId) throw { code: 400, message: 'trainingIdが必要です' };

  var training = findRow(SHEETS.TRAININGS, { id: trainingId });
  if (!training) throw { code: 404, message: '研修が見つかりません' };

  var items = findRows(SHEETS.TRAINING_ITEMS, { training_id: trainingId });
  items.sort(function(a, b) { return (Number(a.display_order) || 0) - (Number(b.display_order) || 0); });

  var round = findRow(SHEETS.ROUNDS, { id: training.round_id });
  var rubric = null;
  if (training.rubric_id) {
    var r = findRow(SHEETS.RUBRICS, { id: training.rubric_id });
    if (r) {
      rubric = {
        id: r.id,
        name: r.name,
        criteria: r.criteria ? (typeof r.criteria === 'string' ? JSON.parse(r.criteria) : r.criteria) : [],
      };
    }
  }

  return {
    id: training.id,
    round_id: training.round_id,
    round_name: round ? round.name : '',
    phase: training.phase,
    title: training.title,
    description: training.description,
    pass_threshold_count: training.pass_threshold_count,
    rubric_id: training.rubric_id,
    is_published: training.is_published === true || training.is_published === 'true',
    created_at: training.created_at,
    rubric: rubric,
    items: items.map(function(item) {
      return {
        id: item.id,
        training_id: item.training_id,
        essay_id: item.essay_id,
        pdf_file_id: item.pdf_file_id,
        display_order: item.display_order,
        correct_score: item.correct_score,
        correct_criteria_scores: item.correct_criteria_scores ? (typeof item.correct_criteria_scores === 'string' ? JSON.parse(item.correct_criteria_scores) : item.correct_criteria_scores) : null,
        tolerance: item.tolerance || 0,
      };
    }),
  };
}

// ===== training.togglePublish =====
function handleTrainingTogglePublish(params, user) {
  var trainingId = params.trainingId || params.id;
  var isPublished = params.isPublished;
  if (!trainingId) throw { code: 400, message: 'trainingIdが必要です' };

  updateRowById(SHEETS.TRAININGS, trainingId, { is_published: isPublished, updated_at: now() });
  return { message: isPublished ? '公開しました' : '非公開にしました' };
}

// ===== training.addItem =====
function handleTrainingAddItem(params, user) {
  var trainingId = params.trainingId;
  if (!trainingId) throw { code: 400, message: 'trainingIdが必要です' };

  // Base64 PDFが送られてきた場合、Google Driveにアップロード
  var pdfFileId = params.pdfFileId || '';
  if (params.base64Data && params.fileName) {
    var folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
    var blob = Utilities.newBlob(
      Utilities.base64Decode(params.base64Data),
      params.mimeType || 'application/pdf',
      params.fileName
    );
    var driveFile = folder.createFile(blob);
    pdfFileId = driveFile.getId();
  }

  var newId = nextId(SHEETS.TRAINING_ITEMS);
  var item = {
    id: newId,
    training_id: trainingId,
    essay_id: params.essayId || '',
    pdf_file_id: pdfFileId,
    display_order: params.displayOrder || 0,
    correct_score: params.correctScore !== undefined ? params.correctScore : '',
    correct_criteria_scores: params.correctCriteriaScores ? JSON.stringify(params.correctCriteriaScores) : '',
    tolerance: params.tolerance || 0,
  };

  appendRow(SHEETS.TRAINING_ITEMS, item);
  return item;
}

// ===== training.updateItem =====
function handleTrainingUpdateItem(params, user) {
  var itemId = params.itemId;
  if (!itemId) throw { code: 400, message: 'itemIdが必要です' };

  var updates = {};
  if (params.correctScore !== undefined) updates.correct_score = params.correctScore;
  if (params.correctCriteriaScores !== undefined) {
    updates.correct_criteria_scores = JSON.stringify(params.correctCriteriaScores);
  }
  if (params.tolerance !== undefined) updates.tolerance = params.tolerance;
  if (params.displayOrder !== undefined) updates.display_order = params.displayOrder;

  var result = updateRowById(SHEETS.TRAINING_ITEMS, itemId, updates);
  if (!result) throw { code: 404, message: '研修問題が見つかりません' };
  return result;
}

// ===== training.deleteItem =====
function handleTrainingDeleteItem(params, user) {
  var itemId = params.itemId;
  if (!itemId) throw { code: 400, message: 'itemIdが必要です' };

  var deleted = deleteRowById(SHEETS.TRAINING_ITEMS, itemId);
  if (!deleted) throw { code: 404, message: '研修問題が見つかりません' };
  return { message: '研修問題を削除しました' };
}

// ===== training.myList - 評価者用研修一覧 =====
function handleTrainingMyList(params, user) {
  var trainings = getAllRows(SHEETS.TRAININGS);
  trainings = trainings.filter(function(t) { return t.is_published === true || t.is_published === 'true'; });

  var allItems = getAllRows(SHEETS.TRAINING_ITEMS);
  var allAttempts = getAllRows(SHEETS.TRAINING_ATTEMPTS);
  var allResponses = getAllRows(SHEETS.TRAINING_RESPONSES);
  var allTAssignments = getAllRows(SHEETS.TRAINING_ASSIGNMENTS);

  return trainings.filter(function(t) {
    var tAssigns = allTAssignments.filter(function(a) { return String(a.training_id) === String(t.id); });
    if (tAssigns.length === 0) return true; // 未割当なら全員見れる
    return tAssigns.some(function(a) { return String(a.user_id) === String(user.id); });
  }).map(function(t) {
    var items = allItems.filter(function(i) { return String(i.training_id) === String(t.id); });
    var myAttempts = allAttempts.filter(function(a) {
      return String(a.training_id) === String(t.id) && String(a.user_id) === String(user.id);
    });

    // 最新のattempt
    myAttempts.sort(function(a, b) { return (b.completed_at || 'Z') > (a.completed_at || 'Z') ? 1 : -1; });
    var latest = myAttempts[0];

    var myCorrect = 0, myTotal = 0;
    if (latest) {
      var latestResponses = allResponses.filter(function(r) { return String(r.attempt_id) === String(latest.id); });
      myTotal = latestResponses.length;
      myCorrect = latestResponses.filter(function(r) { return r.is_correct === true || r.is_correct === 'true'; }).length;
    }

    var round = findRow(SHEETS.ROUNDS, { id: t.round_id });

    return {
      id: t.id,
      round_id: t.round_id,
      round_name: round ? round.name : '',
      phase: t.phase,
      title: t.title,
      description: t.description,
      pass_threshold_count: t.pass_threshold_count,
      is_published: true,
      created_at: t.created_at,
      item_count: items.length,
      my_status: latest ? latest.status : null,
      my_score: latest ? latest.score_percentage : null,
      my_attempts: myAttempts.length,
      my_correct: myCorrect,
      my_total: myTotal,
    };
  }).sort(function(a, b) { return (b.created_at || '') > (a.created_at || '') ? 1 : -1; });
}

// ===== training.startAttempt =====
function handleTrainingStartAttempt(params, user) {
  var trainingId = params.trainingId;
  if (!trainingId) throw { code: 400, message: 'trainingIdが必要です' };

  // 合格済みチェック
  var passed = findRows(SHEETS.TRAINING_ATTEMPTS, { training_id: trainingId, user_id: user.id });
  passed = passed.filter(function(a) { return a.status === 'passed'; });
  if (passed.length > 0) {
    throw { code: 400, message: '既に合格済みです。再受講はできません。' };
  }

  // 進行中の試行チェック
  var inProgress = findRows(SHEETS.TRAINING_ATTEMPTS, { training_id: trainingId, user_id: user.id });
  inProgress = inProgress.filter(function(a) { return a.status === 'in_progress'; });
  if (inProgress.length > 0) return inProgress[0];

  var newId = nextId(SHEETS.TRAINING_ATTEMPTS);
  var attempt = {
    id: newId,
    training_id: trainingId,
    user_id: user.id,
    status: 'in_progress',
    score_percentage: '',
    started_at: now(),
    completed_at: '',
  };

  appendRow(SHEETS.TRAINING_ATTEMPTS, attempt);
  return attempt;
}

// ===== training.submitResponse =====
function handleTrainingSubmitResponse(params, user) {
  var attemptId = params.attemptId;
  var itemId = params.itemId;
  if (!attemptId || !itemId) throw { code: 400, message: 'attemptIdとitemIdが必要です' };

  var item = findRow(SHEETS.TRAINING_ITEMS, { id: itemId });
  if (!item) throw { code: 404, message: '研修問題が見つかりません' };

  // 正答判定
  var isCorrect = false;
  var tolerance = Number(item.tolerance) || 0;

  if (item.correct_score !== '' && item.correct_score !== null && params.givenScore !== undefined) {
    isCorrect = Math.abs(Number(params.givenScore) - Number(item.correct_score)) <= tolerance;
  } else if (item.correct_criteria_scores && params.givenCriteriaScores) {
    var correct = typeof item.correct_criteria_scores === 'string' ? JSON.parse(item.correct_criteria_scores) : item.correct_criteria_scores;
    var given = params.givenCriteriaScores;
    isCorrect = correct.every(function(c) {
      var g = given.find(function(g2) { return g2.criterion === c.criterion; });
      return g && Math.abs(Number(g.score) - Number(c.score)) <= tolerance;
    });
  }

  // Upsert response
  var existing = findRow(SHEETS.TRAINING_RESPONSES, { attempt_id: attemptId, item_id: itemId });
  if (existing) {
    updateRowById(SHEETS.TRAINING_RESPONSES, existing.id, {
      given_score: params.givenScore !== undefined ? params.givenScore : '',
      given_criteria_scores: params.givenCriteriaScores ? JSON.stringify(params.givenCriteriaScores) : '',
      is_correct: isCorrect,
      responded_at: now(),
    });
  } else {
    appendRow(SHEETS.TRAINING_RESPONSES, {
      id: nextId(SHEETS.TRAINING_RESPONSES),
      attempt_id: attemptId,
      item_id: itemId,
      given_score: params.givenScore !== undefined ? params.givenScore : '',
      given_criteria_scores: params.givenCriteriaScores ? JSON.stringify(params.givenCriteriaScores) : '',
      is_correct: isCorrect,
      responded_at: now(),
    });
  }

  return { isCorrect: isCorrect };
}

// ===== training.completeAttempt =====
function handleTrainingCompleteAttempt(params, user) {
  var attemptId = params.attemptId;
  if (!attemptId) throw { code: 400, message: 'attemptIdが必要です' };

  var attempt = findRow(SHEETS.TRAINING_ATTEMPTS, { id: attemptId });
  if (!attempt) throw { code: 404, message: '研修試行が見つかりません' };

  var training = findRow(SHEETS.TRAININGS, { id: attempt.training_id });
  var threshold = training ? (Number(training.pass_threshold_count) || 3) : 3;

  var responses = findRows(SHEETS.TRAINING_RESPONSES, { attempt_id: attemptId });
  var total = responses.length;
  var correct = responses.filter(function(r) { return r.is_correct === true || r.is_correct === 'true'; }).length;
  var percentage = total > 0 ? (correct / total) * 100 : 0;
  var passed = correct >= threshold;
  var status = passed ? 'passed' : 'failed';

  updateRowById(SHEETS.TRAINING_ATTEMPTS, attemptId, {
    status: status,
    score_percentage: Math.round(percentage * 100) / 100,
    completed_at: now(),
  });

  return { status: status, scorePercentage: percentage, correct: correct, total: total };
}

// ===== training.getAssignments =====
function handleTrainingGetAssignments(params, user) {
  var trainingId = params.trainingId;
  if (!trainingId) throw { code: 400, message: 'trainingIdが必要です' };

  var assignments = findRows(SHEETS.TRAINING_ASSIGNMENTS, { training_id: trainingId });
  return assignments.map(function(a) {
    var u = findUserById(a.user_id);
    return {
      id: a.id,
      training_id: a.training_id,
      user_id: a.user_id,
      login_id: u ? u.login_id : '',
      display_name: u ? u.display_name : '',
      role: u ? u.role : '',
      assigned_at: a.assigned_at,
    };
  }).sort(function(a, b) { return (b.assigned_at || '') > (a.assigned_at || '') ? 1 : -1; });
}

// ===== training.assignUsers =====
function handleTrainingAssignUsers(params, user) {
  var trainingId = params.trainingId;
  var userIds = params.userIds;

  // CSV データから userIds を解析
  if (!userIds && params.csvData) {
    var lines = String(params.csvData).trim().split('\n');
    var allUsers = getAllRows(SHEETS.USERS);
    userIds = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim().replace(/"/g, '');
      if (!line || line === 'login_id' || line === 'ログインID') continue;
      var u = allUsers.find(function(u) { return u.login_id === line || u.email === line; });
      if (u) userIds.push(u.id);
    }
  }

  if (!trainingId || !userIds || userIds.length === 0) {
    throw { code: 400, message: 'trainingIdとuserIdsが必要です' };
  }

  var created = 0;
  userIds.forEach(function(uid) {
    var existing = findRow(SHEETS.TRAINING_ASSIGNMENTS, { training_id: trainingId, user_id: uid });
    if (!existing) {
      appendRow(SHEETS.TRAINING_ASSIGNMENTS, {
        id: nextId(SHEETS.TRAINING_ASSIGNMENTS),
        training_id: trainingId,
        user_id: uid,
        assigned_by: user.id,
        assigned_at: now(),
      });
      created++;
    }
  });

  return { message: created + '名を割り当てました', count: created };
}

// ===== training.removeAssignment =====
function handleTrainingRemoveAssignment(params, user) {
  var trainingId = params.trainingId;
  var userId = params.userId;
  if (!trainingId || !userId) throw { code: 400, message: 'trainingIdとuserIdが必要です' };

  var deleted = deleteRows(SHEETS.TRAINING_ASSIGNMENTS, { training_id: trainingId, user_id: userId });
  if (deleted === 0) throw { code: 404, message: '割り当てが見つかりません' };
  return { message: '割り当てを解除しました' };
}

// ===== training.getCompletions =====
function handleTrainingGetCompletions(params, user) {
  var attempts = getAllRows(SHEETS.TRAINING_ATTEMPTS);
  if (params.trainingId) {
    attempts = attempts.filter(function(a) { return String(a.training_id) === String(params.trainingId); });
  }

  return attempts.map(function(a) {
    var u = findUserById(a.user_id);
    var t = findRow(SHEETS.TRAININGS, { id: a.training_id });
    var round = t ? findRow(SHEETS.ROUNDS, { id: t.round_id }) : null;
    return {
      id: a.id,
      training_id: a.training_id,
      training_title: t ? t.title : '',
      phase: t ? t.phase : '',
      round_name: round ? round.name : '',
      user_id: a.user_id,
      login_id: u ? u.login_id : '',
      display_name: u ? u.display_name : '',
      status: a.status,
      score_percentage: a.score_percentage,
      completed_at: a.completed_at,
    };
  }).sort(function(a, b) { return (b.completed_at || 'Z') > (a.completed_at || 'Z') ? 1 : -1; });
}

// ===== training.exportCompletions =====
function handleTrainingExportCompletions(params, user) {
  var completions = handleTrainingGetCompletions(params, user);

  // GAS版ではCSVデータとして返す（Excelは複雑なのでCSV）
  var headers = ['ログインID', '評価者名', '研修名', '合否', '得点率', '受講日時'];
  var rows = [headers.join(',')];

  completions.forEach(function(c) {
    var statusLabel = c.status === 'passed' ? '合格' : c.status === 'failed' ? '不合格' : '受講中';
    var row = [
      c.login_id,
      c.display_name,
      c.training_title,
      statusLabel,
      c.score_percentage ? c.score_percentage + '%' : '-',
      c.completed_at || '-',
    ];
    rows.push(row.map(function(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','));
  });

  var csvContent = '\ufeff' + rows.join('\n');
  return { csv: csvContent, filename: 'training_completions.csv' };
}

// ===== training.getItemPdfUrl - 研修アイテムのPDF URL取得 =====
function handleTrainingGetItemPdfUrl(params, user) {
  var itemId = params.itemId;
  if (!itemId) throw { code: 400, message: 'itemIdが必要です' };

  var item = findRow(SHEETS.TRAINING_ITEMS, { id: itemId });
  if (!item) throw { code: 404, message: '研修問題が見つかりません' };

  var fileId = item.pdf_file_id;
  if (!fileId) {
    // essay_id がある場合はそちらのPDFを返す
    if (item.essay_id) {
      var essay = findRow(SHEETS.ESSAYS, { id: item.essay_id });
      if (essay && essay.pdf_file_id) {
        fileId = essay.pdf_file_id;
      }
    }
  }

  if (!fileId) throw { code: 404, message: 'PDFファイルが見つかりません' };

  return {
    previewUrl: 'https://drive.google.com/file/d/' + fileId + '/preview',
    viewUrl: 'https://drive.google.com/file/d/' + fileId + '/view',
    downloadUrl: 'https://drive.google.com/uc?export=download&id=' + fileId,
  };
}
