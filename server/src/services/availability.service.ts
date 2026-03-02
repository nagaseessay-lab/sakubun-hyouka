import { pool } from '../config/database';

export async function getMyAvailability(userId: number) {
  const { rows } = await pool.query(
    `SELECT date::text, capacity FROM availability WHERE user_id = $1 ORDER BY date`,
    [userId]
  );
  return rows;
}

export async function upsertAvailability(userId: number, entries: { date: string; capacity: number }[]) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const entry of entries) {
      // Only allow editing future dates
      if (entry.capacity <= 0) {
        await client.query(
          `DELETE FROM availability WHERE user_id = $1 AND date = $2 AND date > CURRENT_DATE`,
          [userId, entry.date]
        );
      } else {
        await client.query(
          `INSERT INTO availability (user_id, date, capacity, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (user_id, date)
           DO UPDATE SET capacity = $3, updated_at = NOW()
           WHERE availability.date > CURRENT_DATE`,
          [userId, entry.date, entry.capacity]
        );
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getRoundAvailability(roundId: number) {
  const { rows } = await pool.query(
    `SELECT u.id, u.display_name, av.date::text, av.capacity,
            COALESCE(assigned.cnt, 0) as assigned_count
     FROM users u
     LEFT JOIN availability av ON av.user_id = u.id
     LEFT JOIN (
       SELECT user_id, COUNT(*) as cnt
       FROM assignments WHERE round_id = $1
       GROUP BY user_id
     ) assigned ON assigned.user_id = u.id
     WHERE u.role IN ('evaluator', 'leader') AND u.is_active = true
     ORDER BY u.display_name, av.date`,
    [roundId]
  );
  return rows;
}

export async function getAvailabilitySummary(roundId: number) {
  const { rows } = await pool.query(
    `SELECT u.id, u.login_id, u.display_name, u.role,
            COALESCE(av.total_capacity, 0)::int as total_capacity,
            COALESCE(assigned.cnt, 0)::int as assigned_count,
            COALESCE(completed.cnt, 0)::int as completed_count
     FROM users u
     LEFT JOIN (
       SELECT user_id, SUM(capacity) as total_capacity
       FROM availability
       GROUP BY user_id
     ) av ON av.user_id = u.id
     LEFT JOIN (
       SELECT user_id, COUNT(*) as cnt
       FROM assignments WHERE round_id = $1
       GROUP BY user_id
     ) assigned ON assigned.user_id = u.id
     LEFT JOIN (
       SELECT user_id, COUNT(*) as cnt
       FROM assignments WHERE round_id = $1 AND status = 'completed'
       GROUP BY user_id
     ) completed ON completed.user_id = u.id
     WHERE u.role IN ('evaluator', 'leader') AND u.is_active = true
     ORDER BY u.display_name`,
    [roundId]
  );
  return rows;
}
