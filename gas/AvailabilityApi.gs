/**
 * AvailabilityApi.gs - 担当可能数API
 */

// ===== availability.getMy - 自分の担当可能数取得 =====
function handleAvailabilityGetMy(params, user) {
  var entries = findRows(SHEETS.AVAILABILITY, { user_id: user.id });
  return entries.map(function(e) {
    return {
      date: String(e.date).substring(0, 10), // YYYY-MM-DD形式を保証
      capacity: Number(e.capacity) || 0,
    };
  }).sort(function(a, b) { return a.date > b.date ? 1 : -1; });
}

// ===== availability.upsert - 担当可能数登録・更新 =====
function handleAvailabilityUpsert(params, user) {
  var entries = params.entries;
  if (!entries || !Array.isArray(entries)) throw { code: 400, message: 'entriesが必要です' };

  var today = nowDate();

  entries.forEach(function(entry) {
    // 未来の日付のみ編集可能
    if (entry.date <= today) return;

    if (entry.capacity <= 0) {
      // 0以下は削除
      deleteRows(SHEETS.AVAILABILITY, { user_id: user.id, date: entry.date });
    } else {
      // upsert
      var existing = findRow(SHEETS.AVAILABILITY, { user_id: user.id, date: entry.date });
      if (existing) {
        updateRowById(SHEETS.AVAILABILITY, existing.id, {
          capacity: entry.capacity,
          updated_at: now(),
        });
      } else {
        appendRow(SHEETS.AVAILABILITY, {
          id: nextId(SHEETS.AVAILABILITY),
          user_id: user.id,
          date: entry.date,
          capacity: entry.capacity,
          updated_at: now(),
        });
      }
    }
  });

  return { message: '保存しました' };
}

// ===== availability.summary - 評価者キャパシティサマリー =====
function handleAvailabilitySummary(params, user) {
  var roundId = params.roundId;
  if (!roundId) throw { code: 400, message: 'roundIdが必要です' };

  var users = getAllRows(SHEETS.USERS);
  var evaluators = users.filter(function(u) {
    return (u.role === ROLES.EVALUATOR || u.role === ROLES.LEADER) && u.is_active;
  });

  var allAvailability = getAllRows(SHEETS.AVAILABILITY);
  var allAssignments = findRows(SHEETS.ASSIGNMENTS, { round_id: roundId });
  var completedAssignments = allAssignments.filter(function(a) { return a.status === ASSIGNMENT_STATUS.COMPLETED; });

  return evaluators.map(function(u) {
    var totalCapacity = 0;
    allAvailability.forEach(function(av) {
      if (String(av.user_id) === String(u.id)) totalCapacity += Number(av.capacity) || 0;
    });

    var assignedCount = allAssignments.filter(function(a) { return String(a.user_id) === String(u.id); }).length;
    var completedCount = completedAssignments.filter(function(a) { return String(a.user_id) === String(u.id); }).length;

    return {
      id: u.id,
      login_id: u.login_id,
      display_name: u.display_name,
      role: u.role,
      total_capacity: totalCapacity,
      assigned_count: assignedCount,
      completed_count: completedCount,
    };
  }).sort(function(a, b) { return (a.display_name || '') > (b.display_name || '') ? 1 : -1; });
}
