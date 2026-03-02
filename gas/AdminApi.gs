/**
 * AdminApi.gs - 管理操作API
 * 初期セットアップ、メンテナンス用
 */

// ===== admin.setupSheets - シート初期作成 =====
function handleAdminSetupSheets(params, user) {
  var ss = getSS();
  var created = [];

  Object.keys(HEADERS).forEach(function(sheetName) {
    var existing = ss.getSheetByName(sheetName);
    if (!existing) {
      var sheet = ss.insertSheet(sheetName);
      sheet.getRange(1, 1, 1, HEADERS[sheetName].length).setValues([HEADERS[sheetName]]);
      sheet.getRange(1, 1, 1, HEADERS[sheetName].length).setFontWeight('bold');
      sheet.setFrozenRows(1);
      created.push(sheetName);
    }
  });

  return { message: created.length + '個のシートを作成しました', created: created };
}

// ===== admin.setupQueues - キュー初期化 =====
function handleAdminSetupQueues(params, user) {
  var roundId = params.roundId;
  if (!roundId) throw { code: 400, message: 'roundIdが必要です' };

  var essays = findRows(SHEETS.ESSAYS, { round_id: roundId });
  var pendingEssays = essays.filter(function(e) {
    return e.status === 'pending' || e.status === 'unassigned';
  });

  // 既存キューをクリア
  deleteRows(SHEETS.QUEUE_PHASE1, { round_id: roundId });

  // 未割当エッセイをキューに追加
  var entries = pendingEssays.map(function(e) {
    return {
      essay_id: e.id,
      round_id: roundId,
      added_at: now(),
    };
  });

  if (entries.length > 0) {
    appendRows(SHEETS.QUEUE_PHASE1, entries);
  }

  logEvent(user.id, user.display_name, 'admin.setupQueues', { roundId: roundId, count: entries.length });
  return { message: entries.length + '件をキューに追加しました', count: entries.length };
}

// ===== admin.cleanExpiredLocks - 期限切れロック清掃 =====
function handleAdminCleanExpiredLocks(params, user) {
  var locks = getAllRows(SHEETS.LOCKS);
  var now_ = new Date().toISOString();
  var expired = locks.filter(function(l) { return l.expires_at && l.expires_at < now_; });

  expired.forEach(function(l) {
    deleteRowById(SHEETS.LOCKS, l.id);

    // キューに戻す
    var essay = findRow(SHEETS.ESSAYS, { id: l.essay_id });
    if (essay && (essay.status === ESSAY_STATUS.ASSIGNED || essay.status === 'assigned_first')) {
      // 割当を削除してキューに戻す
      var assignments = findRows(SHEETS.ASSIGNMENTS, { essay_id: l.essay_id });
      var nonCompleted = assignments.filter(function(a) { return a.status !== ASSIGNMENT_STATUS.COMPLETED; });
      nonCompleted.forEach(function(a) {
        deleteRows(SHEETS.REVIEWS_LOG, { assignment_id: a.id });
        deleteRowById(SHEETS.ASSIGNMENTS, a.id);
      });

      updateRowById(SHEETS.ESSAYS, l.essay_id, { status: 'pending', updated_at: now() });
      appendRow(SHEETS.QUEUE_PHASE1, {
        essay_id: l.essay_id,
        round_id: essay.round_id,
        added_at: now(),
      });
    }
  });

  logEvent(user.id, user.display_name, 'admin.cleanExpiredLocks', { cleaned: expired.length });
  return { message: expired.length + '件のロックを解除しました', count: expired.length };
}

// ===== admin.rebuildStatusView - ステータスビュー再構築 =====
function handleAdminRebuildStatusView(params, user) {
  // status_view を全クリアして再構築
  var statusSheet = getSheet(SHEETS.STATUS_VIEW);
  var lastRow = statusSheet.getLastRow();
  if (lastRow > 1) {
    statusSheet.deleteRows(2, lastRow - 1);
  }

  var essays = getAllRows(SHEETS.ESSAYS);
  var assignments = getAllRows(SHEETS.ASSIGNMENTS);

  var viewData = essays.map(function(essay) {
    var firstAssign = assignments.find(function(a) {
      return String(a.essay_id) === String(essay.id) && a.phase === 'first';
    });
    var secondAssign = assignments.find(function(a) {
      return String(a.essay_id) === String(essay.id) && a.phase === 'second';
    });
    var firstUser = firstAssign ? findUserById(firstAssign.user_id) : null;
    var secondUser = secondAssign ? findUserById(secondAssign.user_id) : null;

    return {
      essay_id: essay.id,
      round_id: essay.round_id,
      receipt_number: essay.receipt_number,
      status: essay.status,
      first_phase_score: essay.first_phase_score || '',
      first_phase_user: firstUser ? firstUser.display_name : '',
      first_phase_completed: firstAssign ? firstAssign.completed_at : '',
      second_phase_score: essay.second_phase_score || '',
      second_phase_user: secondUser ? secondUser.display_name : '',
      second_phase_completed: secondAssign ? secondAssign.completed_at : '',
      final_score: essay.final_score || '',
      updated_at: now(),
    };
  });

  if (viewData.length > 0) {
    appendRows(SHEETS.STATUS_VIEW, viewData);
  }

  logEvent(user.id, user.display_name, 'admin.rebuildStatusView', { count: viewData.length });
  return { message: viewData.length + '件のステータスビューを再構築しました', count: viewData.length };
}

// ===== 定期実行用関数（トリガーで設定） =====
function scheduledCleanExpiredLocks() {
  try {
    var adminUser = { id: 0, display_name: 'System', role: ROLES.ADMIN };
    handleAdminCleanExpiredLocks({}, adminUser);
  } catch (e) {
    Logger.log('Scheduled lock cleanup error: ' + e.message);
  }
}
