/**
 * EssayApi.gs - 作文管理API
 */

// ===== essays.list - 作文一覧（ページネーション・フィルタ・ソート対応） =====
function handleEssaysList(params, user) {
  var roundId = params.roundId;
  if (!roundId) throw { code: 400, message: 'roundIdが必要です' };

  var page = params.page || 1;
  var limit = Math.min(params.limit || 50, 200);
  var status = params.status;
  var search = params.search;
  var sortBy = params.sort_by || 'receipt_number';
  var sortOrder = params.sort_order || 'asc';
  var scoreMin = params.score_min;
  var scoreMax = params.score_max;
  var scorePhase = params.score_phase || 'first';

  var allEssays = findRows(SHEETS.ESSAYS, { round_id: roundId });

  // フィルタ
  if (status) {
    allEssays = allEssays.filter(function(e) { return e.status === status; });
  }
  if (search) {
    var s = String(search).toLowerCase();
    allEssays = allEssays.filter(function(e) {
      return (e.receipt_number && String(e.receipt_number).toLowerCase().indexOf(s) >= 0) ||
             (e.student_number && String(e.student_number).toLowerCase().indexOf(s) >= 0);
    });
  }
  if (scoreMin !== undefined || scoreMax !== undefined) {
    allEssays = allEssays.filter(function(e) {
      var score = scorePhase === 'second' ? e.second_phase_score : e.first_phase_score;
      if (!score && score !== 0) return false;
      score = Number(score);
      if (scoreMin !== undefined && score < Number(scoreMin)) return false;
      if (scoreMax !== undefined && score > Number(scoreMax)) return false;
      return true;
    });
  }

  // ソート
  var desc = sortOrder === 'desc';
  allEssays.sort(function(a, b) {
    var va, vb;
    if (sortBy === 'first_score' || sortBy === 'first_phase_score') {
      va = Number(a.first_phase_score) || 0;
      vb = Number(b.first_phase_score) || 0;
    } else if (sortBy === 'second_avg' || sortBy === 'second_phase_score') {
      va = Number(a.second_phase_score) || 0;
      vb = Number(b.second_phase_score) || 0;
    } else {
      va = a.receipt_number || '';
      vb = b.receipt_number || '';
    }
    if (va < vb) return desc ? 1 : -1;
    if (va > vb) return desc ? -1 : 1;
    return 0;
  });

  var total = allEssays.length;
  var start = (page - 1) * limit;
  var items = allEssays.slice(start, start + limit);

  // 割当情報を付加
  var assignments = findRows(SHEETS.ASSIGNMENTS, { round_id: roundId });
  items = items.map(function(essay) {
    var firstAssign = null, secondAssigns = [];
    assignments.forEach(function(a) {
      if (String(a.essay_id) === String(essay.id)) {
        if (a.phase === 'first') firstAssign = a;
        if (a.phase === 'second') secondAssigns.push(a);
      }
    });
    var firstUser = firstAssign ? findUserById(firstAssign.user_id) : null;

    return {
      id: essay.id,
      round_id: essay.round_id,
      receipt_number: essay.receipt_number,
      student_number: essay.student_number,
      status: essay.status,
      pdf_file_id: essay.pdf_file_id,
      original_filename: essay.original_filename,
      first_phase_score: essay.first_phase_score,
      second_phase_score: essay.second_phase_score,
      final_score: essay.final_score,
      defect_reason: essay.defect_reason,
      defect_comment: essay.defect_comment,
      first_evaluator_name: firstUser ? firstUser.display_name : null,
      second_evaluator_names: secondAssigns.map(function(sa) {
        var u = findUserById(sa.user_id);
        return u ? u.display_name : '';
      }),
    };
  });

  return { data: items, total: total, page: page, limit: limit, totalPages: Math.ceil(total / limit) };
}

// ===== essays.get - 単一作文取得 =====
function handleEssaysGet(params, user) {
  var essayId = params.essayId || params.id;
  if (!essayId) throw { code: 400, message: 'essayIdが必要です' };

  var essay = findRow(SHEETS.ESSAYS, { id: essayId });
  if (!essay) throw { code: 404, message: '作文が見つかりません' };

  var assignments = findRows(SHEETS.ASSIGNMENTS, { essay_id: essayId });
  var firstAssign = assignments.find(function(a) { return a.phase === 'first'; });
  var firstUser = firstAssign ? findUserById(firstAssign.user_id) : null;

  return {
    id: essay.id,
    round_id: essay.round_id,
    receipt_number: essay.receipt_number,
    student_number: essay.student_number,
    status: essay.status,
    pdf_file_id: essay.pdf_file_id,
    original_filename: essay.original_filename,
    first_phase_score: essay.first_phase_score,
    second_phase_score: essay.second_phase_score,
    final_score: essay.final_score,
    defect_reason: essay.defect_reason,
    first_evaluator_name: firstUser ? firstUser.display_name : null,
  };
}

// ===== essays.getPdfUrl - Google Drive PDF URL =====
function handleEssaysGetPdfUrl(params, user) {
  var essayId = params.essayId;
  if (!essayId) throw { code: 400, message: 'essayIdが必要です' };

  var essay = findRow(SHEETS.ESSAYS, { id: essayId });
  if (!essay) throw { code: 404, message: '作文が見つかりません' };

  // Google Drive のプレビューURL
  var fileId = essay.pdf_file_id;
  if (!fileId) throw { code: 404, message: 'PDFファイルが見つかりません' };

  return {
    url: 'https://drive.google.com/file/d/' + fileId + '/preview',
    viewUrl: 'https://drive.google.com/file/d/' + fileId + '/view',
    downloadUrl: 'https://drive.google.com/uc?id=' + fileId + '&export=download',
    fileId: fileId,
  };
}

// ===== essays.updateStatus =====
function handleEssaysUpdateStatus(params, user) {
  var essayId = params.essayId;
  var newStatus = params.status;
  if (!essayId || !newStatus) throw { code: 400, message: 'essayIdとstatusが必要です' };

  var result = updateRowById(SHEETS.ESSAYS, essayId, { status: newStatus, updated_at: now() });
  if (!result) throw { code: 404, message: '作文が見つかりません' };

  updateStatusView(essayId);
  logEvent(user.id, user.display_name, 'essays.updateStatus', { essayId: essayId, status: newStatus });
  return result;
}

// ===== essays.bulkUpdateStatus =====
function handleEssaysBulkUpdateStatus(params, user) {
  var roundId = params.roundId;
  var identifiers = params.identifiers || [];
  var newStatus = params.status;

  if (!roundId || !newStatus || identifiers.length === 0) {
    throw { code: 400, message: 'roundId, identifiers, statusが必要です' };
  }

  var essays = findRows(SHEETS.ESSAYS, { round_id: roundId });
  var success = [];
  var failed = [];

  identifiers.forEach(function(ident) {
    var essay = essays.find(function(e) {
      return e.receipt_number === ident || e.student_number === ident;
    });
    if (essay) {
      updateRowById(SHEETS.ESSAYS, essay.id, { status: newStatus, updated_at: now() });
      updateStatusView(essay.id);
      success.push(ident);
    } else {
      failed.push({ identifier: ident, error: '見つかりません' });
    }
  });

  logEvent(user.id, user.display_name, 'essays.bulkUpdateStatus', { roundId: roundId, count: success.length });
  return { success: success, failed: failed };
}

// ===== essays.getDefective - 不備作文一覧 =====
function handleEssaysGetDefective(params, user) {
  var roundId = params.roundId;
  var allEssays = roundId ? findRows(SHEETS.ESSAYS, { round_id: roundId }) : getAllRows(SHEETS.ESSAYS);

  var defective = allEssays.filter(function(e) {
    return e.status === ESSAY_STATUS.DEFECTIVE || e.status === 'leader_hold';
  });

  // 割当情報を付加
  return defective.map(function(essay) {
    var assignments = findRows(SHEETS.ASSIGNMENTS, { essay_id: essay.id });
    var evaluatorNames = assignments.map(function(a) {
      var u = findUserById(a.user_id);
      return u ? u.display_name : '';
    });

    var round = findRow(SHEETS.ROUNDS, { id: essay.round_id });

    return {
      id: essay.id,
      round_id: essay.round_id,
      round_name: round ? round.name : '',
      receipt_number: essay.receipt_number,
      student_number: essay.student_number,
      status: essay.status,
      defect_reason: essay.defect_reason,
      defect_comment: essay.defect_comment,
      pdf_file_id: essay.pdf_file_id,
      evaluator_names: evaluatorNames,
    };
  });
}

// ===== essays.resolveDefective - 不備解決 =====
function handleEssaysResolveDefective(params, user) {
  var essayId = params.essayId;
  var action = params.action; // 'dismiss' or 'reassign'
  if (!essayId || !action) throw { code: 400, message: 'essayIdとactionが必要です' };

  var essay = findRow(SHEETS.ESSAYS, { id: essayId });
  if (!essay) throw { code: 404, message: '作文が見つかりません' };

  // 関連する割当と評価を削除
  deleteRows(SHEETS.REVIEWS_LOG, { essay_id: essayId });
  deleteRows(SHEETS.ASSIGNMENTS, { essay_id: essayId });

  // エッセイをリセット
  updateRowById(SHEETS.ESSAYS, essayId, {
    status: 'pending',
    defect_reason: '',
    defect_comment: '',
    first_phase_score: '',
    second_phase_score: '',
    final_score: '',
    updated_at: now(),
  });

  updateStatusView(essayId);
  logEvent(user.id, user.display_name, 'essays.resolveDefective', { essayId: essayId, action: action });
  return { message: '不備を解決しました' };
}

// ===== essays.exportCsv - CSV出力 =====
function handleEssaysExportCsv(params, user) {
  var roundId = params.roundId;
  if (!roundId) throw { code: 400, message: 'roundIdが必要です' };

  var essays = findRows(SHEETS.ESSAYS, { round_id: roundId });
  var assignments = findRows(SHEETS.ASSIGNMENTS, { round_id: roundId });

  essays.sort(function(a, b) {
    return (a.receipt_number || '') > (b.receipt_number || '') ? 1 : -1;
  });

  var headers = ['受付番号', '生徒番号', 'ステータス', '不備', '1次採点者', '1次スコア', '2次平均', '最終スコア'];
  var rows = [headers.join(',')];

  essays.forEach(function(essay) {
    var firstAssign = assignments.find(function(a) {
      return String(a.essay_id) === String(essay.id) && a.phase === 'first';
    });
    var firstUser = firstAssign ? findUserById(firstAssign.user_id) : null;

    var row = [
      essay.receipt_number || '',
      essay.student_number || '',
      essay.status || '',
      essay.defect_reason || '',
      firstUser ? firstUser.display_name : '',
      essay.first_phase_score !== '' ? essay.first_phase_score : '',
      essay.second_phase_score !== '' ? essay.second_phase_score : '',
      essay.final_score !== '' ? essay.final_score : '',
    ];
    rows.push(row.map(function(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','));
  });

  var csvContent = '\ufeff' + rows.join('\n'); // BOM + UTF-8

  logEvent(user.id, user.display_name, 'essays.exportCsv', { roundId: roundId, count: essays.length });
  return { csv: csvContent, filename: 'essays_round' + roundId + '.csv' };
}

// ===== essays.getFirstPhaseRanked - 1周目ランキング =====
function handleEssaysGetFirstPhaseRanked(params, user) {
  var roundId = params.roundId;
  if (!roundId) throw { code: 400, message: 'roundIdが必要です' };

  var essays = findRows(SHEETS.ESSAYS, { round_id: roundId });
  var scored = essays.filter(function(e) { return e.first_phase_score !== '' && e.first_phase_score !== null; });

  scored.sort(function(a, b) {
    return Number(b.first_phase_score) - Number(a.first_phase_score);
  });

  return scored.map(function(e, idx) {
    return {
      rank: idx + 1,
      id: e.id,
      receipt_number: e.receipt_number,
      student_number: e.student_number,
      first_phase_score: e.first_phase_score,
      status: e.status,
    };
  });
}

// ===== essays.confirmPromotion - 2周目昇格確定 =====
function handleEssaysConfirmPromotion(params, user) {
  var roundId = params.roundId;
  var topCount = params.topCount;
  var essayIds = params.essayIds; // 手動調整後のリスト（オプション）

  if (!roundId) throw { code: 400, message: 'roundIdが必要です' };

  var essays = findRows(SHEETS.ESSAYS, { round_id: roundId });
  var targetEssays;

  if (essayIds && essayIds.length > 0) {
    // 手動指定
    targetEssays = essays.filter(function(e) { return essayIds.indexOf(e.id) >= 0; });
  } else {
    // top N
    var scored = essays.filter(function(e) { return e.first_phase_score !== '' && e.first_phase_score !== null; });
    scored.sort(function(a, b) { return Number(b.first_phase_score) - Number(a.first_phase_score); });
    targetEssays = scored.slice(0, topCount || 300);
  }

  // 2周目キューに追加
  var queueEntries = targetEssays.map(function(e) {
    return {
      essay_id: e.id,
      round_id: roundId,
      first_phase_score: e.first_phase_score,
      added_at: now(),
    };
  });
  appendRows(SHEETS.QUEUE_PHASE2, queueEntries);

  // エッセイステータス更新
  targetEssays.forEach(function(e) {
    updateRowById(SHEETS.ESSAYS, e.id, { status: 'assigned_second', updated_at: now() });
  });

  logEvent(user.id, user.display_name, 'essays.confirmPromotion', { roundId: roundId, count: targetEssays.length });
  return { message: targetEssays.length + '件を2周目に昇格しました', count: targetEssays.length };
}

// ===== essays.upload - PDFアップロード（base64） =====
function handleEssaysUpload(params, user) {
  var roundId = params.roundId;
  var pagesPerEssay = params.pagesPerEssay || 1;

  // 2つの形式をサポート:
  // 1) files配列: [{name, base64, mimeType}]
  // 2) 単一ファイル: {fileName, base64Data, mimeType}
  var files = params.files;
  if (!files && params.base64Data) {
    files = [{ name: params.fileName, base64: params.base64Data, mimeType: params.mimeType }];
  }

  if (!roundId || !files || files.length === 0) {
    throw { code: 400, message: 'roundIdとfilesが必要です' };
  }

  var round = findRow(SHEETS.ROUNDS, { id: roundId });
  if (!round) throw { code: 404, message: '評価回が見つかりません' };

  var results = [];
  var errors = [];
  var folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);

  // 既存エッセイ数を取得してシーケンス番号を決定
  var existingEssays = findRows(SHEETS.ESSAYS, { round_id: roundId });
  var seq = existingEssays.length;

  for (var i = 0; i < files.length; i++) {
    try {
      var file = files[i];
      var blob = Utilities.newBlob(Utilities.base64Decode(file.base64), file.mimeType || 'application/pdf', file.name);
      var driveFile = folder.createFile(blob);
      var fileId = driveFile.getId();

      // PDFページ数の取得はGASでは困難なため、pagesPerEssay分のエッセイを1つ作成
      seq++;
      var receiptNumber = 'R' + String(roundId).padStart(4, '0') + '-' + String(seq).padStart(5, '0');

      var essayId = nextId(SHEETS.ESSAYS);
      appendRow(SHEETS.ESSAYS, {
        id: essayId,
        round_id: roundId,
        receipt_number: receiptNumber,
        student_number: '',
        pdf_file_id: fileId,
        original_filename: file.name,
        status: 'pending',
        defect_reason: '',
        defect_comment: '',
        first_phase_score: '',
        second_phase_score: '',
        final_score: '',
        created_at: now(),
        updated_at: now(),
      });

      // 1周目キューに追加
      appendRow(SHEETS.QUEUE_PHASE1, {
        essay_id: essayId,
        round_id: roundId,
        added_at: now(),
      });

      results.push({ filename: file.name, essayId: essayId, receiptNumber: receiptNumber });
    } catch (err) {
      errors.push({ filename: files[i].name, error: err.message });
    }
  }

  // ラウンドのエッセイ数更新
  updateRowById(SHEETS.ROUNDS, roundId, {
    total_essay_count: existingEssays.length + results.length,
    updated_at: now(),
  });

  logEvent(user.id, user.display_name, 'essays.upload', { roundId: roundId, count: results.length });
  return { results: results, errors: errors };
}

// ===== essays.replacePdf - PDF差し替え =====
function handleEssaysReplacePdf(params, user) {
  var essayId = params.essayId;
  if (!essayId) throw { code: 400, message: 'essayIdが必要です' };
  if (!params.base64Data) throw { code: 400, message: 'PDFデータが必要です' };

  var essay = findRow(SHEETS.ESSAYS, { id: essayId });
  if (!essay) throw { code: 404, message: '作文が見つかりません' };

  // 新しいPDFをDriveにアップロード
  var folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  var blob = Utilities.newBlob(
    Utilities.base64Decode(params.base64Data),
    params.mimeType || 'application/pdf',
    params.fileName || 'replaced.pdf'
  );
  var driveFile = folder.createFile(blob);
  var newFileId = driveFile.getId();

  // エッセイのPDFファイルIDを更新
  var updates = {
    pdf_file_id: newFileId,
    original_filename: params.fileName || essay.original_filename,
    updated_at: now(),
  };

  // アクションに基づくステータス更新
  var action = params.action || 'reset_unassigned';
  if (action === 'reset_unassigned') {
    updates.status = 'pending';
    updates.defect_reason = '';
    updates.defect_comment = '';
    // キューに戻す
    appendRow(SHEETS.QUEUE_PHASE1, {
      essay_id: essayId,
      round_id: essay.round_id,
      added_at: now(),
    });
  } else if (action === 'reassign_original') {
    // 元の評価者に再割当
    var oldAssignment = findRow(SHEETS.ASSIGNMENTS, { essay_id: essayId, phase: 'first' });
    if (oldAssignment) {
      appendRow(SHEETS.ASSIGNMENTS, {
        id: nextId(SHEETS.ASSIGNMENTS),
        round_id: essay.round_id,
        essay_id: essayId,
        user_id: oldAssignment.user_id,
        phase: 'first',
        status: 'pending',
        deadline: oldAssignment.deadline || '',
        created_at: now(),
      });
      updates.status = 'assigned_first';
    } else {
      updates.status = 'pending';
      appendRow(SHEETS.QUEUE_PHASE1, {
        essay_id: essayId,
        round_id: essay.round_id,
        added_at: now(),
      });
    }
    updates.defect_reason = '';
    updates.defect_comment = '';
  }

  updateRowById(SHEETS.ESSAYS, essayId, updates);
  logEvent(user.id, user.display_name, 'essays.replacePdf', { essayId: essayId, action: action });
  return { message: 'PDFを差し替えました', newFileId: newFileId };
}
