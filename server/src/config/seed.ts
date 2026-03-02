import bcrypt from 'bcryptjs';
import { pool } from './database';

async function seed() {
  const client = await pool.connect();
  try {
    // Create admin user
    const hash = await bcrypt.hash('admin123', 12);
    await client.query(
      `INSERT INTO users (login_id, password_hash, display_name, role)
       VALUES ('000001', $1, '管理者', 'leader')
       ON CONFLICT (login_id) DO NOTHING`,
      [hash]
    );
    console.log('Seed complete. Admin: login_id=000001, password=admin123');

    // Create sample evaluator
    const evalHash = await bcrypt.hash('eval123', 12);
    await client.query(
      `INSERT INTO users (login_id, password_hash, display_name, role)
       VALUES ('000002', $1, '評価者テスト', 'evaluator')
       ON CONFLICT (login_id) DO NOTHING`,
      [evalHash]
    );
    console.log('Sample evaluator: login_id=000002, password=eval123');
  } catch (err) {
    console.error('Seed failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
