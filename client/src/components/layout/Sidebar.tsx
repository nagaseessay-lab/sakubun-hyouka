import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getNotifications } from '../../api/notifications.api';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const isLeader = user?.role === 'leader';
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchCount = () => {
      getNotifications(true)
        .then((data: any) => setUnreadCount(Array.isArray(data) ? data.length : data.unreadCount || 0))
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <aside style={{
      width: 240, height: '100vh', background: '#1e293b', color: 'white',
      display: 'flex', flexDirection: 'column', position: 'fixed', left: 0, top: 0,
    }}>
      <div style={{ padding: '20px 16px', borderBottom: '1px solid #334155' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>作文評価システム</h2>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
          {user?.displayName} ({user?.loginId})
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
          {isLeader ? 'リーダー' : '評価者'}
        </div>
      </div>

      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {isLeader ? (
          <>
            <SidebarLink to="/leader" label="ダッシュボード" />
            <SidebarLink to="/leader/rounds" label="評価回管理" />
            <SidebarLink to="/leader/upload" label="PDFアップロード" />
            <SidebarLink to="/leader/rubrics" label="ルーブリック" />
            <SidebarLink to="/leader/essays" label="受付答案一覧" />
            <SidebarLink to="/leader/assignments" label="振り分け管理" />
            <SidebarLink to="/leader/defective" label="不備答案管理" />
            <SidebarLink to="/leader/availability" label="担当可能数一覧" />
            <SidebarLink to="/leader/progress" label="進捗・グラフ" />
            <SidebarLink to="/leader/export" label="Excel出力" />
            <SidebarLink to="/leader/users" label="ユーザー管理" />
            <SidebarLink to="/leader/training" label="デモ評価研修" />
            <SidebarLink to="/leader/guide" label="使い方ガイド" />
            <div style={{ borderTop: '1px solid #334155', margin: '8px 0', paddingTop: 4 }}>
              <div style={{ padding: '6px 20px', fontSize: 11, color: '#64748b', fontWeight: 600 }}>評価者メニュー</div>
            </div>
            <SidebarLink to="/leader/my-assignments" label="マイ担当一覧" />
            <SidebarLink to="/leader/my-availability" label="担当可能数登録" />
            <SidebarLink to="/leader/my-notifications" label="通知" badge={unreadCount} />
            <SidebarLink to="/leader/my-training" label="デモ評価研修" />
          </>
        ) : (
          <>
            <SidebarLink to="/evaluator" label="マイ担当一覧" />
            <SidebarLink to="/evaluator/availability" label="担当可能数登録" />
            <SidebarLink to="/evaluator/notifications" label="通知" badge={unreadCount} />
            <SidebarLink to="/evaluator/training" label="デモ評価研修" />
            <SidebarLink to="/evaluator/guide" label="使い方ガイド" />
          </>
        )}
      </nav>

      <div style={{ padding: '16px', borderTop: '1px solid #334155' }}>
        <button onClick={logout} style={{
          width: '100%', background: '#334155', color: '#94a3b8',
          padding: '8px', borderRadius: 6, fontSize: 13, marginTop: 8,
        }}>
          ログアウト
        </button>
      </div>
    </aside>
  );
}

function SidebarLink({ to, label, badge }: { to: string; label: string; badge?: number }) {
  return (
    <NavLink
      to={to}
      end={to === '/leader' || to === '/evaluator'}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', fontSize: 14, color: isActive ? 'white' : '#94a3b8',
        background: isActive ? '#334155' : 'transparent', textDecoration: 'none',
        borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
      })}
    >
      <span>{label}</span>
      {badge != null && badge > 0 && (
        <span style={{
          background: '#ef4444', color: 'white', borderRadius: '50%',
          minWidth: 20, height: 20, display: 'inline-flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 10, fontWeight: 700, padding: '0 4px',
        }}>{badge > 99 ? '99+' : badge}</span>
      )}
    </NavLink>
  );
}
