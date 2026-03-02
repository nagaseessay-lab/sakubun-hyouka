import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { GAS_CONFIG } from '../config/gas';

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Google ボタンをレンダリング
  useEffect(() => {
    const interval = setInterval(() => {
      if (window.google?.accounts?.id && googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          width: 300,
          text: 'signin_with',
          locale: 'ja',
        });
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // ログイン後のリダイレクト
  if (user) {
    navigate(user.role === 'leader' ? '/leader' : '/evaluator', { replace: true });
    return null;
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
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>作文評価システム</h1>
        <p style={{ color: '#64748b', marginBottom: 32, fontSize: 13 }}>
          Googleアカウントでログインしてください
        </p>

        {/* Google Sign-In ボタン */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div ref={googleBtnRef}></div>
        </div>

        {/* フォールバック */}
        <button
          onClick={login}
          style={{
            background: '#4285f4', color: 'white', border: 'none', borderRadius: 8,
            padding: '12px 24px', fontSize: 14, cursor: 'pointer', width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#fff" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#fff" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#fff" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#fff" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Googleでログイン
        </button>

        {!GAS_CONFIG.GOOGLE_CLIENT_ID && (
          <p style={{ color: '#dc2626', fontSize: 12, marginTop: 16 }}>
            設定エラー: 環境変数 VITE_GOOGLE_CLIENT_ID が未設定です
          </p>
        )}
      </div>
    </div>
  );
}
