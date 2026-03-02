/**
 * GAS Web App API クライアント
 * 全リクエストを単一の doPost エンドポイントに POST
 */

import { GAS_CONFIG } from '../config/gas';

// ===== ID Token 管理 =====
let idToken: string | null = null;

export function setAccessToken(token: string | null) {
  idToken = token;
  if (token) {
    localStorage.setItem('gas_id_token', token);
  } else {
    localStorage.removeItem('gas_id_token');
  }
}

export function getAccessToken(): string | null {
  if (!idToken) {
    idToken = localStorage.getItem('gas_id_token');
  }
  return idToken;
}

// ===== GAS API リクエスト =====
export async function gasPost<T = any>(action: string, params: Record<string, any> = {}): Promise<T> {
  const url = GAS_CONFIG.WEB_APP_URL;
  if (!url) throw new Error('GAS Web App URL が設定されていません。環境変数 VITE_GAS_URL を確認してください。');

  const token = getAccessToken();
  const body = { action, ...params, _idToken: token };

  let lastError: any = null;

  for (let attempt = 0; attempt < GAS_CONFIG.MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain', // GAS doPost では text/plain が安全
        },
        body: JSON.stringify(body),
        redirect: 'follow',
      });

      const text = await response.text();
      let result: any;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error('GAS からの応答が不正です: ' + text.substring(0, 200));
      }

      if (result.success) {
        return result.data as T;
      } else {
        const error: any = new Error(result.error || 'API エラー');
        error.status = result.status;
        error.response = { data: { error: result.error }, status: result.status };

        if (result.status >= 400 && result.status < 500) {
          throw error;
        }
        lastError = error;
      }
    } catch (err: any) {
      if (err.status && err.status >= 400 && err.status < 500) {
        throw err;
      }
      lastError = err;
    }

    // 指数バックオフ待機
    if (attempt < GAS_CONFIG.MAX_RETRIES - 1) {
      const delay = GAS_CONFIG.RETRY_BASE_DELAY * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('APIリクエストに失敗しました');
}

// デフォルトエクスポート（後方互換用 - 使用しないでください）
export default { gasPost };
