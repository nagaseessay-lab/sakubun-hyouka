CREATE TABLE assignments (
    id              SERIAL PRIMARY KEY,
    round_id        INTEGER NOT NULL REFERENCES evaluation_rounds(id),
    essay_id        INTEGER NOT NULL REFERENCES essays(id),
    user_id         INTEGER NOT NULL REFERENCES users(id),
    phase           VARCHAR(10) NOT NULL CHECK (phase IN ('first', 'second')),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'in_progress', 'completed')),
    assigned_at     TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    assigned_by     INTEGER REFERENCES users(id),
    is_auto         BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_assignments_user_phase ON assignments(user_id, phase, status);
CREATE INDEX idx_assignments_round ON assignments(round_id, phase);
CREATE INDEX idx_assignments_essay ON assignments(essay_id, phase);
CREATE UNIQUE INDEX idx_assignments_unique_first ON assignments(essay_id, phase) WHERE phase = 'first';
CREATE INDEX idx_assignments_user_pending ON assignments(user_id, status) WHERE status IN ('pending', 'in_progress');
