-- 担当可能数: 評価回非依存の日付ベースに変更
CREATE TABLE IF NOT EXISTS availability_v2 (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date       DATE NOT NULL,
    capacity   INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_availability_v2_date ON availability_v2(date);
CREATE INDEX IF NOT EXISTS idx_availability_v2_user ON availability_v2(user_id);

-- 既存データ移行（user_id, dateの組み合わせで最大capacityを取る）
INSERT INTO availability_v2 (user_id, date, capacity, created_at, updated_at)
SELECT user_id, date, MAX(capacity), MIN(created_at), MAX(updated_at)
FROM availability
GROUP BY user_id, date
ON CONFLICT (user_id, date) DO NOTHING;

-- 旧テーブル退避（安全のため即削除しない）
ALTER TABLE availability RENAME TO availability_old;
ALTER TABLE availability_v2 RENAME TO availability;
