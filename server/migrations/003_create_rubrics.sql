CREATE TABLE rubrics (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    phase           VARCHAR(10) NOT NULL CHECK (phase IN ('first', 'second')),
    criteria        JSONB NOT NULL,
    is_template     BOOLEAN DEFAULT FALSE,
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE round_rubrics (
    id              SERIAL PRIMARY KEY,
    round_id        INTEGER NOT NULL REFERENCES evaluation_rounds(id) ON DELETE CASCADE,
    rubric_id       INTEGER NOT NULL REFERENCES rubrics(id),
    phase           VARCHAR(10) NOT NULL CHECK (phase IN ('first', 'second')),
    UNIQUE(round_id, phase)
);
