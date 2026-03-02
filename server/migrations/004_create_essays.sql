CREATE TABLE uploaded_pdfs (
    id                  SERIAL PRIMARY KEY,
    round_id            INTEGER NOT NULL REFERENCES evaluation_rounds(id),
    original_filename   VARCHAR(500) NOT NULL,
    storage_path        VARCHAR(500) NOT NULL,
    total_pages         INTEGER NOT NULL,
    essay_count         INTEGER NOT NULL,
    uploaded_by         INTEGER REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE essays (
    id                  SERIAL PRIMARY KEY,
    round_id            INTEGER NOT NULL REFERENCES evaluation_rounds(id) ON DELETE CASCADE,
    receipt_number      VARCHAR(20) NOT NULL,
    pdf_path            VARCHAR(500) NOT NULL,
    original_pdf_id     INTEGER REFERENCES uploaded_pdfs(id),
    page_start          INTEGER NOT NULL,
    page_end            INTEGER NOT NULL,
    student_number      VARCHAR(50),
    status              VARCHAR(20) NOT NULL DEFAULT 'unassigned'
                        CHECK (status IN ('unassigned', 'assigned_first', 'first_complete',
                                          'assigned_second', 'second_complete')),
    first_phase_score   INTEGER,
    second_phase_avg    NUMERIC(5,2),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_essays_round_id ON essays(round_id);
CREATE INDEX idx_essays_status ON essays(status);
CREATE INDEX idx_essays_round_status ON essays(round_id, status);
CREATE INDEX idx_essays_receipt ON essays(receipt_number);
CREATE INDEX idx_essays_first_score ON essays(round_id, first_phase_score DESC NULLS LAST);
