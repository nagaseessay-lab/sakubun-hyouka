/**
 * Code.gs - メインルーター (doGet / doPost)
 * 全APIリクエストをactionフィールドでルーティング
 */

/**
 * GETリクエスト - ヘルスチェック / リダイレクト用
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    message: 'Essay Evaluation API (GAS)',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * POSTリクエスト - メインAPIハンドラー
 * リクエストボディ: { "action": "domain.method", ...params }
 */
function doPost(e) {
  try {
    // CORS プリフライト対応は GAS Web App では不要
    // （GAS は自動でCORSヘッダーを付与）

    var body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonResponse(400, { error: 'リクエストボディのJSONが不正です' });
    }

    var action = body.action;
    if (!action) {
      return jsonResponse(400, { error: 'action フィールドが必要です' });
    }

    // 認証
    var auth;
    try {
      auth = authenticate(e);
    } catch (authErr) {
      return jsonResponse(authErr.code || 401, { error: authErr.message });
    }

    var user = auth.user;

    // セキュリティ: 認証トークンをハンドラーに渡さない
    delete body._idToken;

    // ルーティング
    var result;
    try {
      result = routeAction(action, body, user);
    } catch (routeErr) {
      var code = routeErr.code || 500;
      var message = routeErr.message || '内部エラー';
      Logger.log('Action error [' + action + ']: ' + message);
      return jsonResponse(code, { error: message });
    }

    return jsonResponse(200, result);

  } catch (err) {
    Logger.log('Unexpected error: ' + err.message + '\n' + err.stack);
    return jsonResponse(500, { error: 'サーバー内部エラーが発生しました' });
  }
}

/**
 * アクションルーティング
 */
function routeAction(action, params, user) {
  switch (action) {
    // ===== Auth =====
    case 'auth.me':
      return handleAuthMe(params, user);

    // ===== Users =====
    case 'users.list':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleUsersList(params, user);
    case 'users.create':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleUsersCreate(params, user);
    case 'users.bulkCreate':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleUsersBulkCreate(params, user);
    case 'users.update':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleUsersUpdate(params, user);
    case 'users.resetPassword':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleUsersResetPassword(params, user);
    case 'users.delete':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleUsersDelete(params, user);

    // ===== Rounds =====
    case 'rounds.list':
      return handleRoundsList(params, user);
    case 'rounds.get':
      return handleRoundsGet(params, user);
    case 'rounds.create':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleRoundsCreate(params, user);
    case 'rounds.update':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleRoundsUpdate(params, user);
    case 'rounds.delete':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleRoundsDelete(params, user);
    case 'rounds.transition':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleRoundsTransition(params, user);
    case 'rounds.progress':
      return handleRoundsProgress(params, user);

    // ===== Essays =====
    case 'essays.list':
      return handleEssaysList(params, user);
    case 'essays.get':
      return handleEssaysGet(params, user);
    case 'essays.getPdfUrl':
      return handleEssaysGetPdfUrl(params, user);
    case 'essays.updateStatus':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleEssaysUpdateStatus(params, user);
    case 'essays.bulkUpdateStatus':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleEssaysBulkUpdateStatus(params, user);
    case 'essays.getDefective':
      return handleEssaysGetDefective(params, user);
    case 'essays.resolveDefective':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleEssaysResolveDefective(params, user);
    case 'essays.exportCsv':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleEssaysExportCsv(params, user);
    case 'essays.getFirstPhaseRanked':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleEssaysGetFirstPhaseRanked(params, user);
    case 'essays.confirmPromotion':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleEssaysConfirmPromotion(params, user);
    case 'essays.upload':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleEssaysUpload(params, user);

    // ===== Assignments =====
    case 'assignments.listForRound':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleAssignmentsListForRound(params, user);
    case 'assignments.listMy':
      return handleAssignmentsListMy(params, user);
    case 'assignments.preview':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleAssignmentsPreview(params, user);
    case 'assignments.generateMapping':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleAssignmentsGenerateMapping(params, user);
    case 'assignments.confirm':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleAssignmentsConfirm(params, user);
    case 'assignments.confirmMapping':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleAssignmentsConfirmMapping(params, user);
    case 'assignments.manual':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleAssignmentsManual(params, user);
    case 'assignments.reassign':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleAssignmentsReassign(params, user);
    case 'assignments.remove':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleAssignmentsRemove(params, user);
    case 'assignments.reopen':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleAssignmentsReopen(params, user);
    case 'assignments.bulkReassign':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleAssignmentsBulkReassign(params, user);

    // ===== Scores =====
    case 'scores.get':
      return handleScoresGet(params, user);
    case 'scores.save':
      return handleScoresSave(params, user);
    case 'scores.submit':
      return handleScoresSubmit(params, user);
    case 'scores.next':
      return handleScoresNext(params, user);

    // ===== Rubrics =====
    case 'rubrics.list':
      return handleRubricsList(params, user);
    case 'rubrics.get':
      return handleRubricsGet(params, user);
    case 'rubrics.create':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleRubricsCreate(params, user);
    case 'rubrics.update':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleRubricsUpdate(params, user);
    case 'rubrics.clone':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleRubricsClone(params, user);
    case 'rubrics.delete':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleRubricsDelete(params, user);
    case 'rubrics.getForRound':
      return handleRubricsGetForRound(params, user);
    case 'rubrics.assignToRound':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleRubricsAssignToRound(params, user);

    // ===== Availability =====
    case 'availability.getMy':
      return handleAvailabilityGetMy(params, user);
    case 'availability.upsert':
      return handleAvailabilityUpsert(params, user);
    case 'availability.summary':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleAvailabilitySummary(params, user);

    // ===== Notifications =====
    case 'notifications.list':
      return handleNotificationsList(params, user);
    case 'notifications.markRead':
      return handleNotificationsMarkRead(params, user);
    case 'notifications.markAllRead':
      return handleNotificationsMarkAllRead(params, user);

    // ===== Training =====
    case 'training.list':
      return handleTrainingList(params, user);
    case 'training.create':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleTrainingCreate(params, user);
    case 'training.delete':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleTrainingDelete(params, user);
    case 'training.get':
      return handleTrainingGet(params, user);
    case 'training.togglePublish':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleTrainingTogglePublish(params, user);
    case 'training.addItem':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleTrainingAddItem(params, user);
    case 'training.updateItem':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleTrainingUpdateItem(params, user);
    case 'training.deleteItem':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleTrainingDeleteItem(params, user);
    case 'training.myList':
      return handleTrainingMyList(params, user);
    case 'training.startAttempt':
      return handleTrainingStartAttempt(params, user);
    case 'training.submitResponse':
      return handleTrainingSubmitResponse(params, user);
    case 'training.completeAttempt':
      return handleTrainingCompleteAttempt(params, user);
    case 'training.getAssignments':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleTrainingGetAssignments(params, user);
    case 'training.assignUsers':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleTrainingAssignUsers(params, user);
    case 'training.removeAssignment':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleTrainingRemoveAssignment(params, user);
    case 'training.getCompletions':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleTrainingGetCompletions(params, user);
    case 'training.exportCompletions':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleTrainingExportCompletions(params, user);
    case 'training.getItemPdfUrl':
      return handleTrainingGetItemPdfUrl(params, user);

    // ===== Essays (additional) =====
    case 'essays.replacePdf':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleEssaysReplacePdf(params, user);

    // ===== Export =====
    case 'export.csv':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleExportCsv(params, user);
    case 'export.roundData':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleExportCsv(params, user);
    case 'export.progress':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleExportProgress(params, user);
    case 'export.evaluatorStats':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleExportProgress(params, user);

    // ===== Admin =====
    case 'admin.setupQueues':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleAdminSetupQueues(params, user);
    case 'admin.cleanExpiredLocks':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleAdminCleanExpiredLocks(params, user);
    case 'admin.rebuildStatusView':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleAdminRebuildStatusView(params, user);
    case 'admin.setupSheets':
      requireRole(user, [ROLES.LEADER, ROLES.ADMIN]);
      return handleAdminSetupSheets(params, user);

    default:
      throw { code: 404, message: '不明なアクション: ' + action };
  }
}

/**
 * JSONレスポンス生成
 */
function jsonResponse(statusCode, data) {
  var output = {
    success: statusCode >= 200 && statusCode < 300,
    status: statusCode,
    data: statusCode >= 200 && statusCode < 300 ? data : undefined,
    error: statusCode >= 400 ? (data.error || data.message || 'エラー') : undefined,
  };
  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}
