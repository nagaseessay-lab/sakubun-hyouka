import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!user) return <Navigate to="/login" replace />;
  // Google Sign-In版ではパスワード変更は不要
  if (role && user.role !== role) return <Navigate to="/" replace />;

  return <>{children}</>;
}
