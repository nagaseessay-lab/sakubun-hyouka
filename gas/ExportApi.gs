/**
 * ExportApi.gs - エクスポートAPI
 * GAS版: Google SheetsのSpreadsheetをそのまま使えるので、
 * CSV/JSON形式でデータを返す
 */

// ===== export.csv - ラウンドデータCSV出力 =====
function handleExportCsv(params, user) {
  var roundId = params.roundId;
  if (!roundId) throw { code: 400, message: 'roundIdが必要です' };

  var round = findRow(SHEETS.ROUNDS, { id: roundId });
  if (!round) throw { code: 404, message: '評価回が見つかりません' };

  // ===== Sheet 1: 1次採点結果 =====
  var assignments = findRows(SHEETS.ASSIGNMENTS, { round_id: roundId });
  var essays = findRows(SHEETS.ESSAYS, { round_id: roundId });
  var reviews = findRows(SHEETS.REVIEWS_LOG, { round_id: roundId });

  var firstHeaders = ['受付番号', '生徒番号', '採点者ID', '採点者名', 'スコア', '所見', '採点日時'];
  var firstRows = [firstHeaders.join(',')];

  var firstAssigns = assignments.filter(function(a) { return a.phase === 'first' && a.status === ASSIGNMENT_STATUS.COMPLETED; });
  firstAssigns.forEach(function(a) {
    var essay = essays.find(function(e) { return String(e.id) === String(a.essay_id); });
    var u = findUserById(a.user_id);
    var revs = reviews.filter(function(r) { return String(r.assignment_id) === String(a.id); });
    revs.sort(function(x, y) { return (y.submitted_at || '') > (x.submitted_at || '') ? 1 : -1; });
    var latest = revs[0];

    var row = [
      essay ? essay.receipt_number : '',
      essay ? essay.student_number : '',
      u ? u.login_id : '',
      u ? u.display_name : '',
      latest ? latest.score : '',
      latest ? (latest.comment || '') : '',
      latest ? latest.submitted_at : '',
    ];
    firstRows.push(row.map(function(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','));
  });

  // ===== Sheet 2: 2次採点結果 =====
  var secondHeaders = ['受付番号', '生徒番号', '採点者ID', '採点者名', '観点スコア', '合計', '採点日時'];
  var secondRows = [secondHeaders.join(',')];

  var secondAssigns = assignments.filter(function(a) { return a.phase === 'second' && a.status === ASSIGNMENT_STATUS.COMPLETED; });
  secondAssigns.forEach(function(a) {
    var essay = essays.find(function(e) { return String(e.id) === String(a.essay_id); });
    var u = findUserById(a.user_id);
    var revs = reviews.filter(function(r) { return String(r.assignment_id) === String(a.id); });
    revs.sort(function(x, y) { return (y.submitted_at || '') > (x.submitted_at || '') ? 1 : -1; });
    var latest = revs[0];

    var criteriaStr = '';
    if (latest && latest.criteria_scores) {
      var cs = typeof latest.criteria_scores === 'string' ? JSON.parse(latest.criteria_scores) : latest.criteria_scores;
      criteriaStr = cs.map(function(c) { return c.criterion + ':' + c.score; }).join('; ');
    }

    var row = [
      essay ? essay.receipt_number : '',
      essay ? essay.student_number : '',
      u ? u.login_id : '',
      u ? u.display_name : '',
      criteriaStr,
      latest ? latest.score : '',
      latest ? latest.submitted_at : '',
    ];
    secondRows.push(row.map(function(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','));
  });

  // ===== Sheet 3: ランキング =====
  var rankHeaders = ['順位', '受付番号', '生徒番号', '1次スコア', '2次平均', '最終スコア'];
  var rankRows = [rankHeaders.join(',')];

  var scored = essays.filter(function(e) { return e.first_phase_score !== '' && e.first_phase_score !== null; });
  scored.sort(function(a, b) {
    var sa = Number(a.final_score || a.second_phase_score || a.first_phase_score) || 0;
    var sb = Number(b.final_score || b.second_phase_score || b.first_phase_score) || 0;
    return sb - sa;
  });
  scored.forEach(function(e, idx) {
    var row = [idx + 1, e.receipt_number, e.student_number, e.first_phase_score, e.second_phase_score || '', e.final_score || ''];
    rankRows.push(row.map(function(v) { return '"' + String(v) + '"'; }).join(','));
  });

  // ===== Sheet 4: 採点者集計 =====
  var evalHeaders = ['ログインID', '採点者名', '1次担当数', '1次完了数', '2次担当数', '2次完了数'];
  var evalRows = [evalHeaders.join(',')];

  var users = getAllRows(SHEETS.USERS);
  var evaluators = users.filter(function(u) { return (u.role === ROLES.EVALUATOR || u.role === ROLES.LEADER) && u.is_active; });

  evaluators.forEach(function(u) {
    var ua = assignments.filter(function(a) { return String(a.user_id) === String(u.id); });
    var row = [
      u.login_id,
      u.display_name,
      ua.filter(function(a) { return a.phase === 'first'; }).length,
      ua.filter(function(a) { return a.phase === 'first' && a.status === ASSIGNMENT_STATUS.COMPLETED; }).length,
      ua.filter(function(a) { return a.phase === 'second'; }).length,
      ua.filter(function(a) { return a.phase === 'second' && a.status === ASSIGNMENT_STATUS.COMPLETED; }).length,
    ];
    evalRows.push(row.map(function(v) { return '"' + String(v) + '"'; }).join(','));
  });

  logEvent(user.id, user.display_name, 'export.csv', { roundId: roundId });

  return {
    sheets: {
      first_phase: '\ufeff' + firstRows.join('\n'),
      second_phase: '\ufeff' + secondRows.join('\n'),
      rankings: '\ufeff' + rankRows.join('\n'),
      evaluator_summary: '\ufeff' + evalRows.join('\n'),
    },
    roundName: round.name,
  };
}

// ===== export.progress - 評価者統計 =====
function handleExportProgress(params, user) {
  var dateFrom = params.dateFrom;
  var dateTo = params.dateTo;
  var roundId = params.roundId;

  var assignments = roundId
    ? findRows(SHEETS.ASSIGNMENTS, { round_id: roundId })
    : getAllRows(SHEETS.ASSIGNMENTS);

  assignments = assignments.filter(function(a) { return a.status === ASSIGNMENT_STATUS.COMPLETED; });

  if (dateFrom) {
    assignments = assignments.filter(function(a) { return a.completed_at >= dateFrom; });
  }
  if (dateTo) {
    assignments = assignments.filter(function(a) { return a.completed_at <= dateTo + 'T23:59:59'; });
  }

  // ユーザー別集計
  var stats = {};
  assignments.forEach(function(a) {
    var key = a.user_id + '_' + a.round_id + '_' + a.phase;
    if (!stats[key]) {
      var u = findUserById(a.user_id);
      var r = findRow(SHEETS.ROUNDS, { id: a.round_id });
      stats[key] = {
        user_id: a.user_id,
        login_id: u ? u.login_id : '',
        display_name: u ? u.display_name : '',
        round_id: a.round_id,
        round_name: r ? r.name : '',
        phase: a.phase,
        count: 0,
      };
    }
    stats[key].count++;
  });

  return Object.keys(stats).map(function(k) { return stats[k]; });
}
