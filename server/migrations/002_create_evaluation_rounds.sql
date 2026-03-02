CREATE TABLE evaluation_rounds (
    id                      SERIAL PRIMARY KEY,
    name                    VARCHAR(200) NOT NULL,
    phase_type              VARCHAR(20) NOT NULL CHECK (phase_type IN ('first_only', 'second_only', 'both')),
    pages_per_essay         INTEGER NOT NULL DEFAULT 1,
    status                  VARCHAR(20) NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'uploading', 'first_phase', 'first_complete', 'second_phase', 'second_complete', 'archived')),
    second_evaluator_count  INTEGER DEFAULT 1,
    first_phase_top_count   INTEGER DEFAULT 300,
    total_essay_count       INTEGER DEFAULT 0,
    created_by              INTEGER REFERENCES users(id),
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);
