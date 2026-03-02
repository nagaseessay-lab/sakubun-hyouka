import bcrypt from 'bcryptjs';
import { pool } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export async function listUsers(role?: string) {
  let query = 'SELECT id, login_id, display_name, role, is_active, must_change_password, created_at FROM users';
  const params: any[] = [];

  if (role) {
    query += ' WHERE role = $1';
    params.push(role);
  }
  query += ' ORDER BY login_id';

  const { rows } = await pool.query(query, params);
  return rows;
}

export async function createUser(data: {
  loginId: string;
  displayName: string;
  role: string;
}) {
  const existing = await pool.query('SELECT 1 FROM users WHERE login_id = $1', [data.loginId]);
  if (existing.rows.length > 0) {
    throw new AppError('このログインIDは既に使用されています', 409);
  }

  // Initial password = loginId
  const passwordHash = await bcrypt.hash(data.loginId, 12);
  const { rows } = await pool.query(
    `INSERT INTO users (login_id, password_hash, display_name, role, must_change_password)
     VALUES ($1, $2, $3, $4, TRUE)
     RETURNING id, login_id, display_name, role, is_active, created_at`,
    [data.loginId, passwordHash, data.displayName, data.role]
  );
  return rows[0];
}

export async function bulkCreateUsers(users: Array<{ loginId: string; displayName: string; role: string }>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created: any[] = [];
    const errors: string[] = [];

    for (const u of users) {
      try {
        const existing = await client.query('SELECT 1 FROM users WHERE login_id = $1', [u.loginId]);
        if (existing.rows.length > 0) {
          errors.push(`${u.loginId}: 既に存在するログインID`);
          continue;
        }
        const passwordHash = await bcrypt.hash(u.loginId, 12);
        const { rows } = await client.query(
          `INSERT INTO users (login_id, password_hash, display_name, role, must_change_password)
           VALUES ($1, $2, $3, $4, TRUE)
           RETURNING id, login_id, display_name, role`,
          [u.loginId, passwordHash, u.displayName, u.role]
        );
        created.push(rows[0]);
      } catch (err: any) {
        errors.push(`${u.loginId}: ${err.message}`);
      }
    }

    await client.query('COMMIT');
    return { created, errors };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateUser(
  id: number,
  data: { displayName?: string; role?: string; isActive?: boolean }
) {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (data.displayName !== undefined) {
    sets.push(`display_name = $${idx++}`);
    params.push(data.displayName);
  }
  if (data.role !== undefined) {
    sets.push(`role = $${idx++}`);
    params.push(data.role);
  }
  if (data.isActive !== undefined) {
    sets.push(`is_active = $${idx++}`);
    params.push(data.isActive);
  }

  if (sets.length === 0) {
    throw new AppError('更新する項目がありません', 400);
  }

  sets.push(`updated_at = NOW()`);
  params.push(id);

  const { rows } = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx}
     RETURNING id, login_id, display_name, role, is_active`,
    params
  );

  if (rows.length === 0) {
    throw new AppError('ユーザーが見つかりません', 404);
  }
  return rows[0];
}

export async function resetPassword(id: number) {
  // Reset password to loginId
  const { rows } = await pool.query('SELECT login_id FROM users WHERE id = $1', [id]);
  if (rows.length === 0) {
    throw new AppError('ユーザーが見つかりません', 404);
  }
  const passwordHash = await bcrypt.hash(rows[0].login_id, 12);
  await pool.query(
    'UPDATE users SET password_hash = $1, must_change_password = TRUE, updated_at = NOW() WHERE id = $2',
    [passwordHash, id]
  );
}

export async function deleteUser(id: number) {
  // Check for submitted (non-draft) scores - protect completed work
  const { rows: scoreCheck } = await pool.query(
    'SELECT COUNT(*) as count FROM scores WHERE user_id = $1 AND is_draft = false',
    [id]
  );
  if (parseInt(scoreCheck[0].count) > 0) {
    throw new AppError('このユーザーには提出済みの採点データがあるため削除できません。無効化してください。', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Delete child records in order
    await client.query('DELETE FROM scores WHERE user_id = $1', [id]);
    await client.query('DELETE FROM assignments WHERE user_id = $1', [id]);
    await client.query('DELETE FROM demo_training_attempts WHERE user_id = $1', [id]);
    await client.query('DELETE FROM availability WHERE user_id = $1', [id]);
    await client.query('DELETE FROM notifications WHERE user_id = $1', [id]);
    // SET NULL on created_by/uploaded_by/assigned_by is handled by FK CASCADE SET NULL
    const { rowCount } = await client.query('DELETE FROM users WHERE id = $1', [id]);
    if (rowCount === 0) throw new AppError('ユーザーが見つかりません', 404);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
