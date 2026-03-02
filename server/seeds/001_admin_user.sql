-- Default leader account
-- login_id: 000001, password: admin123
-- password_hash is bcrypt hash of 'admin123'
INSERT INTO users (login_id, password_hash, display_name, role)
VALUES ('000001', '$2b$12$LJ3m4ys3Lf.QzYCJn9HRCOQqGJB8p1YFqwb6v8K6v9Xz5q5s5q5s5', '管理者', 'leader')
ON CONFLICT (login_id) DO NOTHING;
