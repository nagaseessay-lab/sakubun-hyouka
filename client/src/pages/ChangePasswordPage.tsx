import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ChangePasswordPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  function goBack() {
    navigate(user?.role === 'leader' ? '/leader' : '/evaluator');
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center',
      background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
    }}>
      <div style={{
        background: 'white', borderRadius: 12, padding: 40, width: 400,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', textAlign: 'center',
      }}>
        <h1 style={{ fontSize: 20, marginBottom: 16 }}>パスワード変更</h1>
        <p style={{ color: '#64748b', marginBottom: 24, fontSize: 14 }}>
          この機能はGoogle Sign-In版では不要です。<br />
          Googleアカウントのパスワードは、Googleアカウント設定から変更してください。
        </p>
        <a
          href="https://myaccount.google.com/security"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          style={{
            display: 'inline-block', padding: '10px 24px', fontSize: 14,
            textDecoration: 'none', borderRadius: 6, marginBottom: 12,
          }}
        >
          Googleアカウント設定を開く
        </a>
        <br />
        <button onClick={goBack}
          style={{
            padding: 10, fontSize: 13, marginTop: 8,
            background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 6,
            cursor: 'pointer', width: '100%',
          }}>
          戻る
        </button>
      </div>
    </div>
  );
}
