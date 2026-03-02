CREATE TABLE scores (
    id              SERIAL PRIMARY KEY,
    assignment_id   INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    essay_id        INTEGER NOT NULL REFERENCES essays(id),
    user_id         INTEGER NOT NULL REFERENCES users(id),
    round_id        INTEGER NOT NULL REFERENCES evaluation_rounds(id),
    phase           VARCHAR(10) NOT NULL CHECK (phase IN ('first', 'second')),
    score           INTEGER,
    criteria_scores JSONB,
    total_score     NUMERIC(5,2),
    student_number  VARCHAR(50),
    summary         TEXT,
    is_draft        BOOLEAN DEFAULT TRUE,
    submitted_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scores_essay_phase ON scores(essay_id, phase);
CREATE INDEX idx_scores_user ON scores(user_id, round_id);
CREATE UNIQUE INDEX idx_scores_assignment ON scores(assignment_id);
