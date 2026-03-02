/**
 * Auth.gs - 認証・認可
 * GASデプロイ設定: 実行者=「自分」（デプロイ者）
 * フロントエンドから送られる Google ID Token を検証してユーザーを特定
 */

/**
 * リクエストからユーザーを認証・認可
 * @param {GoogleAppsScript.Events.DoPost} e
 * @returns {{ user: Object, email: string }}
 */
function authenticate(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    throw { code: 401, message: 'リクエストボディが不正です' };
  }

  var idToken = body._idToken;
  if (!idToken) {
    throw { code: 401, message: '認証トークンが必要です。再ログインしてください。' };
  }

  // トークンのキャッシュキー生成（SHA-256ハッシュの先頭20文字）
  var tokenHash = Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken)
  ).substring(0, 20);
  var cacheKey = 'auth_' + tokenHash;

  // キャッシュから検証結果を取得
  var email = cacheGet(cacheKey);

  if (!email) {
    // Google tokeninfo エンドポイントでIDトークンを検証
    var tokenInfo;
    try {
      var response = UrlFetchApp.fetch(
        'https://oauth2.googleapis.com/tokeninfo?id_token=' + idToken,
        { muteHttpExceptions: true }
      );
      tokenInfo = JSON.parse(response.getContentText());
    } catch (err) {
      throw { code: 401, message: 'トークン検証に失敗しました' };
    }

    if (tokenInfo.error || tokenInfo.error_description) {
      throw { code: 401, message: 'トークンが無効または期限切れです。再ログインしてください。' };
    }

    // クライアントIDの検証（なりすまし防止）
    if (tokenInfo.aud !== CONFIG.GOOGLE_CLIENT_ID) {
      throw { code: 401, message: '不正なクライアントIDです' };
    }

    email = tokenInfo.email;
    if (!email) {
      throw { code: 401, message: 'メールアドレスが取得できません' };
    }

    // 検証結果を5分間キャッシュ（IDトークンの有効期限は1時間）
    cachePut(cacheKey, email, 300);
  }

  // users シートの allowlist と照合
  var user = findUserByEmail(email);
  if (!user) {
    throw { code: 403, message: 'アクセス権限がありません。管理者に連絡してください。（' + email + '）' };
  }

  if (!user.is_active || user.is_active === 'false' || user.is_active === false) {
    throw { code: 403, message: 'アカウントが無効化されています。' };
  }

  return { user: user, email: email };
}

/**
 * メールアドレスからユーザーを検索（キャッシュ付き）
 */
function findUserByEmail(email) {
  var cacheKey = 'user_email_' + email;
  var cached = cacheGet(cacheKey);
  if (cached) return cached;

  var user = findRow(SHEETS.USERS, { email: email });
  if (user) {
    cachePut(cacheKey, user, 300); // 5分キャッシュ
  }
  return user;
}

/**
 * ユーザーIDからユーザーを検索（キャッシュ付き）
 */
function findUserById(userId) {
  var cacheKey = 'user_id_' + userId;
  var cached = cacheGet(cacheKey);
  if (cached) return cached;

  var user = findRow(SHEETS.USERS, { id: userId });
  if (user) {
    cachePut(cacheKey, user, 300);
  }
  return user;
}

/**
 * ロールベースアクセス制御
 */
function requireRole(user, roles) {
  if (!Array.isArray(roles)) roles = [roles];
  if (roles.indexOf(user.role) === -1) {
    throw { code: 403, message: 'この操作にはアクセス権限がありません。必要なロール: ' + roles.join(', ') };
  }
}

/**
 * auth.me - 現在のユーザー情報を返す
 */
function handleAuthMe(params, user) {
  return {
    id: user.id,
    login_id: user.login_id,
    display_name: user.display_name,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
  };
}

/**
 * イベントログ記録
 */
function logEvent(userId, userName, action, details) {
  try {
    appendRow(SHEETS.EVENTS_LOG, {
      id: nextId(SHEETS.EVENTS_LOG),
      user_id: userId,
      user_name: userName,
      action: action,
      details: typeof details === 'string' ? details : JSON.stringify(details),
      created_at: now(),
    });
  } catch (e) {
    // ログ記録の失敗でメイン処理を止めない
    Logger.log('Event log error: ' + e.message);
  }
}
