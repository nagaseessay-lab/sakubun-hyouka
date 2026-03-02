-- デモ研修: 公開/非公開、個別割り当て、ルーブリック選択
ALTER TABLE demo_trainings ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
ALTER TABLE demo_trainings ADD COLUMN IF NOT EXISTS rubric_id INTEGER REFERENCES rubrics(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS demo_training_assignments (
    id          SERIAL PRIMARY KEY,
    training_id INTEGER NOT NULL REFERENCES demo_trainings(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(training_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_demo_training_assignments_user ON demo_training_assignments(user_id);

-- 不備答案PDF差し替え追跡
ALTER TABLE essays ADD COLUMN IF NOT EXISTS replaced_at TIMESTAMPTZ;
ALTER TABLE essays ADD COLUMN IF NOT EXISTS replaced_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE essays ADD COLUMN IF NOT EXISTS original_pdf_path VARCHAR(500);

-- 30,000件対応パフォーマンスインデックス
CREATE INDEX IF NOT EXISTS idx_assignments_essay_phase ON assignments(essay_id, phase, status);
CREATE INDEX IF NOT EXISTS idx_essays_second_avg ON essays(round_id, second_phase_avg DESC NULLS LAST);
