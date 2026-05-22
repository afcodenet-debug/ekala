-- =============================================================================
-- Migration 007 — Add 'cashier' role to users.role CHECK constraint
-- =============================================================================
-- The original schema only allowed ('admin', 'manager', 'waiter').
-- We recreate the table with the expanded CHECK to support the new 'cashier' role.
-- =============================================================================

PRAGMA foreign_keys = OFF;

-- 1. Add the missing updated_at column if it does not exist yet (idempotent).
--    This makes the subsequent SELECT safe on all existing databases.
ALTER TABLE users ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- 2. Create the new table with the corrected CHECK constraint for the 'cashier' role.
CREATE TABLE IF NOT EXISTS users_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name   TEXT    NOT NULL,
  username    TEXT,
  phone       TEXT    UNIQUE,
  pin_code    TEXT    NOT NULL,
  role        TEXT    NOT NULL DEFAULT 'waiter'
              CHECK (role IN ('admin', 'manager', 'cashier', 'waiter')),
  email       TEXT,
  is_active   INTEGER DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Copy every existing row. Now safe because we just added updated_at above.
INSERT INTO users_new (
  id, full_name, username, phone, pin_code, role, email, is_active, created_at, updated_at
)
SELECT
  id,
  full_name,
  COALESCE(username, full_name),
  phone,
  pin_code,
  role,
  email,
  is_active,
  created_at,
  COALESCE(updated_at, created_at)
FROM users;

-- 4. Replace the old table with the new one.
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- 5. Recreate the partial unique index on email (non-NULL only).
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
  ON users(email)
  WHERE email IS NOT NULL;

PRAGMA foreign_keys = ON;

-- =============================================================================
-- ROLLBACK (manual):
--   If you ever need to go back, restore a backup of data/database.db taken
--   before running this migration. There is no automatic rollback for this one.
-- =============================================================================
