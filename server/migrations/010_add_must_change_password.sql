ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT TRUE;

-- Existing users don't need to change (they already have custom passwords)
UPDATE users SET must_change_password = FALSE;
