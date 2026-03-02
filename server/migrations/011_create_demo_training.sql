-- Demo evaluation training system
-- Leaders can create training sessions with correct answers
-- Evaluators must pass before being assigned real essays

CREATE TABLE demo_trainings (
    id              SERIAL PRIMARY KEY,
    round_id        INTEGER NOT NULL REFERENCES evaluation_rounds(id),
    phase           VARCHAR(10) NOT NULL CHECK (phase IN ('first', 'second')),
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    pass_threshold  NUMERIC(5,2) NOT NULL DEFAULT 80.00,  -- Pass percentage
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Each training has multiple sample essays with correct answers
CREATE TABLE demo_training_items (
    id              SERIAL PRIMARY KEY,
    training_id     INTEGER NOT NULL REFERENCES demo_trainings(id) ON DELETE CASCADE,
    essay_id        INTEGER REFERENCES essays(id),  -- Can link to a real essay (for PDF)
    pdf_path        VARCHAR(500),                   -- Or standalone PDF
    display_order   INTEGER NOT NULL DEFAULT 0,
    correct_score   INTEGER,                        -- Correct answer for first phase (0-4)
    correct_criteria_scores JSONB,                  -- Correct answers for second phase criteria [{criterion, score}]
    tolerance       INTEGER DEFAULT 0,              -- Allowed deviation from correct answer
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Track evaluator training attempts
CREATE TABLE demo_training_attempts (
    id              SERIAL PRIMARY KEY,
    training_id     INTEGER NOT NULL REFERENCES demo_trainings(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'in_progress'
                    CHECK (status IN ('in_progress', 'passed', 'failed')),
    score_percentage NUMERIC(5,2),
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

-- Individual item responses within an attempt
CREATE TABLE demo_training_responses (
    id              SERIAL PRIMARY KEY,
    attempt_id      INTEGER NOT NULL REFERENCES demo_training_attempts(id) ON DELETE CASCADE,
    item_id         INTEGER NOT NULL REFERENCES demo_training_items(id) ON DELETE CASCADE,
    given_score     INTEGER,
    given_criteria_scores JSONB,
    is_correct      BOOLEAN,
    responded_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_demo_trainings_round ON demo_trainings(round_id, phase);
CREATE INDEX idx_demo_attempts_user ON demo_training_attempts(user_id, training_id);
CREATE INDEX idx_demo_responses_attempt ON demo_training_responses(attempt_id);
