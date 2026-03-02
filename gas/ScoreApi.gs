/**
 * ScoreApi.gs - 評価API（next/review/score/ロック）
 * コア機能: 作文取得→評価→保存 のフロー
 */

// ===== scores.next - 次の作文を取得（ロック付き） =====
function handleScoresNext(params, user) {
  var roundId = params.roundId;
  var phase = params.phase || 'first';

  if (!roundId) throw { code: 400, message: 'roundIdが必要です' };

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_WAIT_MS);
  } catch (e) {
    throw { code: 503, message: 'サーバーが混雑しています。しばらく待ってから再試行してください。' };
  }

  try {
    var queueSheet = phase === 'second' ? SHEETS.QUEUE_PHASE2 : SHEETS.QUEUE_PHASE1;
    var queueItem = popQueueHead(queueSheet);

    if (!queueItem) {
      return { assignment: null, message: '現在割り当て可能な作文がありません' };
    }

    var essayId = queueItem.essay_id;

    // エッセイ情報を取得
    var essay = findRow(SHEETS.ESSAYS, { id: essayId });
    if (!essay) {
      return { assignment: null, message: '作文が見つかりません' };
    }

    // ロック作成
    var lockToken = generateUUID();
    var expiresAt = addMinutes(new Date(), CONFIG.LOCK_DURATION_MIN);
    appendRow(SHEETS.LOCKS, {
      id: nextId(SHEETS.LOCKS),
      essay_id: essayId,
      lock_token: lockToken,
      locked_by: user.id,
      locked_by_name: user.display_name,
      expires_at: expiresAt,
      created_at: now(),
    });

    // 割当レコード作成
    var assignmentId = nextId(SHEETS.ASSIGNMENTS);
    appendRow(SHEETS.ASSIGNMENTS, {
      id: assignmentId,
      round_id: roundId,
      essay_id: essayId,
      user_id: user.id,
      phase: phase,
      status: ASSIGNMENT_STATUS.IN_PROGRESS,
      assigned_at: now(),
      completed_at: '',
    });

    // エッセイステータス更新
    updateRowById(SHEETS.ESSAYS, essayId, {
      status: ESSAY_STATUS.ASSIGNED,
      updated_at: now(),
    });

    logEvent(user.id, user.display_name, 'scores.next', { essayId: essayId, assignmentId: assignmentId, phase: phase });

    return {
      assignment: {
        id: assignmentId,
        essay_id: essayId,
        round_id: roundId,
        phase: phase,
        status: ASSIGNMENT_STATUS.IN_PROGRESS,
        receipt_number: essay.receipt_number,
        student_number: essay.student_number,
        pdf_file_id: essay.pdf_file_id,
        lock_token: lockToken,
      },
    };
  } finally {
    lock.releaseLock();
  }
}

// ===== scores.get - 割当の採点情報を取得 =====
function handleScoresGet(params, user) {
  var assignmentId = params.assignmentId;
  if (!assignmentId) throw { code: 400, message: 'assignmentIdが必要です' };

  var assignment = findRow(SHEETS.ASSIGNMENTS, { id: assignmentId });
  if (!assignment) throw { code: 404, message: '割当が見つかりません' };

  // 自分の割当か、リーダーのみ他人のも見れる
  if (String(assignment.user_id) !== String(user.id) && user.role !== ROLES.LEADER) {
    throw { code: 403, message: 'アクセス権限がありません' };
  }

  // reviews_log から最新のレビューを取得
  var reviews = findRows(SHEETS.REVIEWS_LOG, { assignment_id: assignmentId });
  if (reviews.length === 0) {
    return null;
  }

  // 最新のものを返す
  reviews.sort(function(a, b) {
    return (b.submitted_at || '') > (a.submitted_at || '') ? 1 : -1;
  });
  var latest = reviews[0];

  var essay = findRow(SHEETS.ESSAYS, { id: assignment.essay_id });

  return {
    id: latest.id,
    assignment_id: assignmentId,
    phase: assignment.phase,
    score: latest.score,
    criteria_scores: latest.criteria_scores ? (typeof latest.criteria_scores === 'string' ? JSON.parse(latest.criteria_scores) : latest.criteria_scores) : null,
    total_score: latest.score,
    student_number: essay ? essay.student_number : '',
    summary: latest.comment || '',
    comment: latest.comment || '',
    is_draft: assignment.status !== ASSIGNMENT_STATUS.COMPLETED,
  };
}

// ===== scores.save - 採点を一時保存（ドラフト） =====
function handleScoresSave(params, user) {
  var assignmentId = params.assignmentId;
  if (!assignmentId) throw { code: 400, message: 'assignmentIdが必要です' };

  var assignment = findRow(SHEETS.ASSIGNMENTS, { id: assignmentId });
  if (!assignment) throw { code: 404, message: '割当が見つかりません' };
  if (String(assignment.user_id) !== String(user.id)) {
    throw { code: 403, message: 'この割当の採点権限がありません' };
  }

  var requestId = params.requestId || generateUUID();

  // 冪等性チェック
  var existing = findRow(SHEETS.REVIEWS_LOG, { request_id: requestId });
  if (existing) {
    return { id: existing.id, message: '保存済み（重複リクエスト）' };
  }

  var reviewId = nextId(SHEETS.REVIEWS_LOG);
  var reviewData = {
    id: reviewId,
    request_id: requestId,
    assignment_id: assignmentId,
    round_id: assignment.round_id,
    essay_id: assignment.essay_id,
    user_id: user.id,
    phase: assignment.phase,
    score: params.score !== undefined ? params.score : '',
    criteria_scores: params.criteriaScores ? JSON.stringify(params.criteriaScores) : '',
    comment: params.comment || params.summary || '',
    submitted_at: now(),
  };

  appendRow(SHEETS.REVIEWS_LOG, reviewData);

  // 割当ステータスを更新（in_progress）
  updateRowById(SHEETS.ASSIGNMENTS, assignmentId, {
    status: ASSIGNMENT_STATUS.IN_PROGRESS,
  });

  // エッセイの生徒番号を更新
  if (params.studentNumber) {
    updateRowById(SHEETS.ESSAYS, assignment.essay_id, {
      student_number: params.studentNumber,
      updated_at: now(),
    });
  }

  // 不備報告の場合
  if (params.isDefective) {
    updateRowById(SHEETS.ESSAYS, assignment.essay_id, {
      status: ESSAY_STATUS.DEFECTIVE,
      defect_reason: params.defectiveReason || '',
      defect_comment: params.comment || '',
      updated_at: now(),
    });
  }

  logEvent(user.id, user.display_name, 'scores.save', { assignmentId: assignmentId, requestId: requestId });

  return { id: reviewId, message: '一時保存しました' };
}

// ===== scores.submit - 採点を確定送信 =====
function handleScoresSubmit(params, user) {
  var assignmentId = params.assignmentId;
  if (!assignmentId) throw { code: 400, message: 'assignmentIdが必要です' };

  var assignment = findRow(SHEETS.ASSIGNMENTS, { id: assignmentId });
  if (!assignment) throw { code: 404, message: '割当が見つかりません' };
  if (String(assignment.user_id) !== String(user.id)) {
    throw { code: 403, message: 'この割当の採点権限がありません' };
  }
  if (assignment.status === ASSIGNMENT_STATUS.COMPLETED) {
    throw { code: 400, message: 'この割当は既に完了しています' };
  }

  // 割当を完了に更新
  updateRowById(SHEETS.ASSIGNMENTS, assignmentId, {
    status: ASSIGNMENT_STATUS.COMPLETED,
    completed_at: now(),
  });

  // ロック解放
  deleteRows(SHEETS.LOCKS, { essay_id: assignment.essay_id });

  // 最新のレビューからスコアを取得
  var reviews = findRows(SHEETS.REVIEWS_LOG, { assignment_id: assignmentId });
  var latestScore = null;
  var latestCriteria = null;
  if (reviews.length > 0) {
    reviews.sort(function(a, b) { return (b.submitted_at || '') > (a.submitted_at || '') ? 1 : -1; });
    latestScore = reviews[0].score;
    latestCriteria = reviews[0].criteria_scores;
  }

  // エッセイスコアを更新
  var essayUpdate = { updated_at: now() };
  if (assignment.phase === 'first') {
    essayUpdate.first_phase_score = latestScore;
    essayUpdate.status = ESSAY_STATUS.SCORED;
  } else if (assignment.phase === 'second') {
    essayUpdate.second_phase_score = latestScore;
    // 2周目全完了かチェック
    var round = findRow(SHEETS.ROUNDS, { id: assignment.round_id });
    var secondAssignments = findRows(SHEETS.ASSIGNMENTS, { essay_id: assignment.essay_id, phase: 'second' });
    var allCompleted = secondAssignments.every(function(a) {
      return String(a.id) === String(assignmentId) || a.status === ASSIGNMENT_STATUS.COMPLETED;
    });
    if (allCompleted) {
      // 平均スコア計算
      var totalScore = 0;
      var count = 0;
      secondAssignments.forEach(function(a) {
        var revs = findRows(SHEETS.REVIEWS_LOG, { assignment_id: a.id });
        if (revs.length > 0) {
          revs.sort(function(x, y) { return (y.submitted_at || '') > (x.submitted_at || '') ? 1 : -1; });
          if (revs[0].score) { totalScore += Number(revs[0].score); count++; }
        }
      });
      if (count > 0) {
        essayUpdate.final_score = Math.round((totalScore / count) * 100) / 100;
      }
      essayUpdate.status = ESSAY_STATUS.COMPLETED;
    }
  }
  updateRowById(SHEETS.ESSAYS, assignment.essay_id, essayUpdate);

  // status_view 更新
  updateStatusView(assignment.essay_id);

  // 通知作成（リーダー向け）
  var essay = findRow(SHEETS.ESSAYS, { id: assignment.essay_id });
  if (essay) {
    var leaders = findRows(SHEETS.USERS, { role: ROLES.LEADER });
    leaders.forEach(function(leader) {
      if (leader.is_active) {
        appendRow(SHEETS.NOTIFICATIONS, {
          id: nextId(SHEETS.NOTIFICATIONS),
          user_id: leader.id,
          type: 'score_submitted',
          title: '採点完了',
          message: user.display_name + 'が受付番号' + essay.receipt_number + 'の採点を完了しました',
          is_read: false,
          created_at: now(),
        });
      }
    });
  }

  logEvent(user.id, user.display_name, 'scores.submit', { assignmentId: assignmentId, essayId: assignment.essay_id });

  return { message: '採点を送信しました' };
}

// ===== status_view 更新ヘルパー =====
function updateStatusView(essayId) {
  var essay = findRow(SHEETS.ESSAYS, { id: essayId });
  if (!essay) return;

  var firstAssignment = findRow(SHEETS.ASSIGNMENTS, { essay_id: essayId, phase: 'first' });
  var secondAssignment = findRow(SHEETS.ASSIGNMENTS, { essay_id: essayId, phase: 'second' });

  var firstUser = firstAssignment ? findUserById(firstAssignment.user_id) : null;
  var secondUser = secondAssignment ? findUserById(secondAssignment.user_id) : null;

  var viewData = {
    essay_id: essayId,
    round_id: essay.round_id,
    receipt_number: essay.receipt_number,
    status: essay.status,
    first_phase_score: essay.first_phase_score || '',
    first_phase_user: firstUser ? firstUser.display_name : '',
    first_phase_completed: firstAssignment ? firstAssignment.completed_at : '',
    second_phase_score: essay.second_phase_score || '',
    second_phase_user: secondUser ? secondUser.display_name : '',
    second_phase_completed: secondAssignment ? secondAssignment.completed_at : '',
    final_score: essay.final_score || '',
    updated_at: now(),
  };

  upsertRow(SHEETS.STATUS_VIEW, ['essay_id'], viewData);
}
