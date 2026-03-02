/**
 * NotificationApi.gs - 通知API
 */

// ===== notifications.list =====
function handleNotificationsList(params, user) {
  var notifications = findRows(SHEETS.NOTIFICATIONS, { user_id: user.id });

  if (params.unread) {
    notifications = notifications.filter(function(n) { return !n.is_read; });
  }

  // 最新50件
  notifications.sort(function(a, b) {
    return (b.created_at || '') > (a.created_at || '') ? 1 : -1;
  });
  notifications = notifications.slice(0, 50);

  return notifications.map(function(n) {
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      is_read: n.is_read === true || n.is_read === 'true',
      created_at: n.created_at,
    };
  });
}

// ===== notifications.markRead =====
function handleNotificationsMarkRead(params, user) {
  var notificationId = params.notificationId || params.id;
  if (!notificationId) throw { code: 400, message: 'notificationIdが必要です' };

  var notification = findRow(SHEETS.NOTIFICATIONS, { id: notificationId });
  if (!notification) throw { code: 404, message: '通知が見つかりません' };
  if (String(notification.user_id) !== String(user.id)) {
    throw { code: 403, message: 'この通知へのアクセス権限がありません' };
  }

  updateRowById(SHEETS.NOTIFICATIONS, notificationId, { is_read: true });
  return { message: '既読にしました' };
}

// ===== notifications.markAllRead =====
function handleNotificationsMarkAllRead(params, user) {
  var notifications = findRows(SHEETS.NOTIFICATIONS, { user_id: user.id });
  var unread = notifications.filter(function(n) { return !n.is_read || n.is_read === 'false'; });

  unread.forEach(function(n) {
    updateRowById(SHEETS.NOTIFICATIONS, n.id, { is_read: true });
  });

  return { message: unread.length + '件を既読にしました', count: unread.length };
}
