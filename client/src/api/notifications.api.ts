import { gasPost } from './client';

export async function getNotifications(unread?: boolean) {
  return gasPost('notifications.list', unread !== undefined ? { unread } : {});
}

export async function markAsRead(id: number) {
  return gasPost('notifications.markRead', { notificationId: id });
}

export async function markAllAsRead() {
  return gasPost('notifications.markAllRead');
}
