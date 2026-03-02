import { pool } from '../config/database';

export async function getNotifications(userId: number, unreadOnly: boolean = false) {
  let query = 'SELECT * FROM notifications WHERE user_id = $1';
  if (unreadOnly) query += ' AND is_read = false';
  query += ' ORDER BY created_at DESC LIMIT 50';

  const { rows } = await pool.query(query, [userId]);
  return rows;
}

export async function markAsRead(notificationId: number, userId: number) {
  await pool.query(
    'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
    [notificationId, userId]
  );
}

export async function markAllAsRead(userId: number) {
  await pool.query(
    'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
    [userId]
  );
}

export async function getUnreadCount(userId: number): Promise<number> {
  const { rows } = await pool.query(
    'SELECT COUNT(*) as cnt FROM notifications WHERE user_id = $1 AND is_read = false',
    [userId]
  );
  return parseInt(rows[0].cnt);
}
