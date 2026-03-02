CREATE TABLE availability (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    round_id        INTEGER NOT NULL REFERENCES evaluation_rounds(id),
    date            DATE NOT NULL,
    capacity        INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, round_id, date)
);

CREATE INDEX idx_availability_round_date ON availability(round_id, date);
