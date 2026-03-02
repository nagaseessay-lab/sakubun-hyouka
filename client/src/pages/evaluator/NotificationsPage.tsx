import { useState, useEffect } from 'react';
import { getNotifications, markAsRead, markAllAsRead } from '../../api/notifications.api';
import type { Notification } from '../../types';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    const data = await getNotifications();
    setNotifications(data.notifications);
    setUnreadCount(data.unreadCount);
  }

  async function handleMarkRead(id: number) {
    await markAsRead(id);
    loadNotifications();
  }

  async function handleMarkAllRead() {
    await markAllAsRead();
    loadNotifications();
  }

  return (
    <div>
      <div className="page-header">
        <h1>通知 {unreadCount > 0 && <span className="badge badge-red">{unreadCount}</span>}</h1>
        {unreadCount > 0 && (
          <button className="btn-secondary" onClick={handleMarkAllRead}>すべて既読にする</button>
        )}
      </div>

      <div className="card">
        {notifications.length === 0 ? (
          <p style={{ color: '#64748b' }}>通知はありません</p>
        ) : (
          notifications.map((n) => (
            <div key={n.id} style={{
              padding: '12px 16px', borderBottom: '1px solid #e2e8f0',
              background: n.is_read ? 'transparent' : '#eff6ff',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontWeight: n.is_read ? 400 : 600 }}>{n.title}</div>
                <div style={{ fontSize: 13, color: '#64748b' }}>{n.message}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  {new Date(n.created_at).toLocaleString('ja-JP')}
                </div>
              </div>
              {!n.is_read && (
                <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={() => handleMarkRead(n.id)}>
                  既読
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
