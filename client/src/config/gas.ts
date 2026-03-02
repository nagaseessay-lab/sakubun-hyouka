/**
 * GAS Web App 設定
 * 環境変数から読み込み（Viteの VITE_ プレフィックス付き）
 */

export const GAS_CONFIG = {
  // GAS Web App URL（デプロイ時に取得）
  WEB_APP_URL: import.meta.env.VITE_GAS_URL || '',
  // Google OAuth Client ID
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  // リトライ設定
  MAX_RETRIES: 3,
  RETRY_BASE_DELAY: 1000, // 1秒
};
