import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { env } from '../config/env';
import { JWT_EXPIRY } from '../config/constants';
import { AppError } from '../middleware/errorHandler';

export async function login(loginId: string, password: string) {
  const { rows } = await pool.query(
    'SELECT id, login_id, password_hash, display_name, role, is_active, must_change_password FROM users WHERE login_id = $1',
    [loginId]
  );

  if (rows.length === 0) {
    throw new AppError('IDまたはパスワードが正しくありません', 401);
  }

  const user = rows[0];
  if (!user.is_active) {
    throw new AppError('このアカウントは無効化されています', 403);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new AppError('IDまたはパスワードが正しくありません', 401);
  }

  const accessToken = jwt.sign(
    { userId: user.id, role: user.role, loginId: user.login_id },
    env.JWT_SECRET,
    { expiresIn: JWT_EXPIRY.ACCESS }
  );

  const refreshToken = jwt.sign(
    { userId: user.id, role: user.role, loginId: user.login_id },
    env.JWT_REFRESH_SECRET,
    { expiresIn: JWT_EXPIRY.REFRESH }
  );

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      loginId: user.login_id,
      displayName: user.display_name,
      role: user.role,
      mustChangePassword: user.must_change_password ?? false,
    },
  };
}

export async function refreshAccessToken(refreshToken: string) {
  try {
    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as any;
    const accessToken = jwt.sign(
      { userId: payload.userId, role: payload.role, loginId: payload.loginId },
      env.JWT_SECRET,
      { expiresIn: JWT_EXPIRY.ACCESS }
    );
    return { accessToken };
  } catch {
    throw new AppError('リフレッシュトークンが無効です', 401);
  }
}

export async function getMe(userId: number) {
  const { rows } = await pool.query(
    'SELECT id, login_id, display_name, role, is_active, must_change_password FROM users WHERE id = $1',
    [userId]
  );
  if (rows.length === 0) {
    throw new AppError('ユーザーが見つかりません', 404);
  }
  const user = rows[0];
  return {
    id: user.id,
    loginId: user.login_id,
    displayName: user.display_name,
    role: user.role,
    mustChangePassword: user.must_change_password ?? false,
  };
}

export async function changePassword(userId: number, currentPassword: string, newPassword: string) {
  const { rows } = await pool.query(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId]
  );
  if (rows.length === 0) {
    throw new AppError('ユーザーが見つかりません', 404);
  }

  const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!valid) {
    throw new AppError('現在のパスワードが正しくありません', 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await pool.query(
    'UPDATE users SET password_hash = $1, must_change_password = FALSE, updated_at = NOW() WHERE id = $2',
    [passwordHash, userId]
  );
}
