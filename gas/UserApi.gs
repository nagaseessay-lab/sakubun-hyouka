/**
 * UserApi.gs - ユーザー管理API
 * GAS版では password_hash は不要（Google Sign-Inで認証するため）
 */

// ===== users.list =====
function handleUsersList(params, user) {
  var users = getAllRows(SHEETS.USERS);
  if (params.role) {
    users = users.filter(function(u) { return u.role === params.role; });
  }
  users.sort(function(a, b) {
    return (a.login_id || '') > (b.login_id || '') ? 1 : -1;
  });
  return users.map(function(u) {
    return {
      id: u.id,
      login_id: u.login_id,
      display_name: u.display_name,
      email: u.email,
      role: u.role,
      is_active: u.is_active,
      created_at: u.created_at,
    };
  });
}

// ===== users.create =====
function handleUsersCreate(params, user) {
  var loginId = params.loginId;
  var displayName = params.displayName;
  var email = params.email;
  var role = params.role || ROLES.EVALUATOR;

  if (!loginId || !displayName || !email) {
    throw { code: 400, message: 'loginId, displayName, emailが必要です' };
  }

  // 重複チェック
  var existing = findRow(SHEETS.USERS, { login_id: loginId });
  if (existing) throw { code: 400, message: 'このログインIDは既に使用されています' };

  var emailExisting = findRow(SHEETS.USERS, { email: email });
  if (emailExisting) throw { code: 400, message: 'このメールアドレスは既に使用されています' };

  var newId = nextId(SHEETS.USERS);
  var newUser = {
    id: newId,
    login_id: loginId,
    display_name: displayName,
    email: email,
    role: role,
    is_active: true,
    created_at: now(),
    updated_at: now(),
  };

  appendRow(SHEETS.USERS, newUser);
  cacheRemove('user_email_' + email);

  logEvent(user.id, user.display_name, 'users.create', { newUserId: newId, loginId: loginId });
  return newUser;
}

// ===== users.bulkCreate =====
function handleUsersBulkCreate(params, user) {
  var users = params.users;
  if (!users || users.length === 0) throw { code: 400, message: 'usersが必要です' };

  var created = [];
  var errors = [];

  users.forEach(function(u) {
    try {
      var result = handleUsersCreate({
        loginId: u.loginId,
        displayName: u.displayName,
        email: u.email,
        role: u.role || ROLES.EVALUATOR,
      }, user);
      created.push(result);
    } catch (err) {
      errors.push({ loginId: u.loginId, error: err.message });
    }
  });

  return { created: created, errors: errors };
}

// ===== users.update =====
function handleUsersUpdate(params, user) {
  var userId = params.userId || params.id;
  if (!userId) throw { code: 400, message: 'userIdが必要です' };

  var targetUser = findRow(SHEETS.USERS, { id: userId });
  if (!targetUser) throw { code: 404, message: 'ユーザーが見つかりません' };

  var updates = { updated_at: now() };
  if (params.displayName !== undefined) updates.display_name = params.displayName;
  if (params.role !== undefined) updates.role = params.role;
  if (params.isActive !== undefined) updates.is_active = params.isActive;
  if (params.email !== undefined) updates.email = params.email;

  var result = updateRowById(SHEETS.USERS, userId, updates);

  // キャッシュクリア
  cacheRemove('user_id_' + userId);
  if (targetUser.email) cacheRemove('user_email_' + targetUser.email);

  logEvent(user.id, user.display_name, 'users.update', { targetUserId: userId });
  return result;
}

// ===== users.resetPassword =====
function handleUsersResetPassword(params, user) {
  // GAS版ではGoogle Sign-Inを使うためパスワードリセットは不要
  // ただし互換性のためエンドポイントは維持
  return { message: 'Google Sign-Inを使用しているため、パスワードリセットは不要です。ユーザーにGoogleアカウントの設定を確認するよう案内してください。' };
}

// ===== users.delete =====
function handleUsersDelete(params, user) {
  var userId = params.userId || params.id;
  if (!userId) throw { code: 400, message: 'userIdが必要です' };

  var targetUser = findRow(SHEETS.USERS, { id: userId });
  if (!targetUser) throw { code: 404, message: 'ユーザーが見つかりません' };

  // 完了済みの割当があるか確認
  var completedAssignments = findRows(SHEETS.ASSIGNMENTS, { user_id: userId });
  completedAssignments = completedAssignments.filter(function(a) {
    return a.status === ASSIGNMENT_STATUS.COMPLETED;
  });
  if (completedAssignments.length > 0) {
    throw { code: 400, message: 'このユーザーには完了済みの割当があるため削除できません。無効化をお勧めします。' };
  }

  // 関連データ削除
  deleteRows(SHEETS.ASSIGNMENTS, { user_id: userId });
  deleteRows(SHEETS.REVIEWS_LOG, { user_id: userId });
  deleteRows(SHEETS.AVAILABILITY, { user_id: userId });
  deleteRows(SHEETS.NOTIFICATIONS, { user_id: userId });
  deleteRows(SHEETS.TRAINING_ATTEMPTS, { user_id: userId });
  deleteRows(SHEETS.TRAINING_ASSIGNMENTS, { user_id: userId });

  // ユーザー削除
  deleteRowById(SHEETS.USERS, userId);

  // キャッシュクリア
  cacheRemove('user_id_' + userId);
  if (targetUser.email) cacheRemove('user_email_' + targetUser.email);

  logEvent(user.id, user.display_name, 'users.delete', { deletedUserId: userId, loginId: targetUser.login_id });
  return { message: 'ユーザーを削除しました' };
}
