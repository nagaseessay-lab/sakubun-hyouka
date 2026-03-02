/**
 * AuthContext - Google Sign-In + GAS Web App 認証
 */
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { User } from '../types';
import { gasPost, setAccessToken, getAccessToken } from '../api/client';
import { GAS_CONFIG } from '../config/gas';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: (callback?: (notification: any) => void) => void;
          renderButton: (element: HTMLElement, config: any) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => void;
  logout: () => void;
  clearMustChangePassword: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Google Sign-In コールバック
  const handleCredentialResponse = useCallback(async (response: any) => {
    try {
      const credential = response.credential;
      setAccessToken(credential);

      const userData = await gasPost<any>('auth.me');
      setUser({
        id: userData.id,
        loginId: userData.login_id || userData.loginId || '',
        displayName: userData.display_name || userData.displayName || '',
        role: userData.role,
        email: userData.email || '',
      });
    } catch (err: any) {
      console.error('Login failed:', err);
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // Google Identity Services スクリプトを読み込み
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!window.google?.accounts?.id) {
        setLoading(false);
        return;
      }

      window.google.accounts.id.initialize({
        client_id: GAS_CONFIG.GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: true,
      });

      // 既存トークンで復元
      const existingToken = getAccessToken();
      if (existingToken) {
        gasPost<any>('auth.me')
          .then((userData) => {
            setUser({
              id: userData.id,
              loginId: userData.login_id || userData.loginId || '',
              displayName: userData.display_name || userData.displayName || '',
              role: userData.role,
              email: userData.email || '',
            });
          })
          .catch(() => { setAccessToken(null); })
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    };
    script.onerror = () => { setLoading(false); };
    document.head.appendChild(script);

    return () => {
      try { document.head.removeChild(script); } catch {}
    };
  }, [handleCredentialResponse]);

  function login() {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    }
  }

  function logout() {
    setAccessToken(null);
    setUser(null);
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  }

  function clearMustChangePassword() {
    if (user) {
      setUser({ ...user, mustChangePassword: false });
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, clearMustChangePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
