-- Migration: Create platform_admins table
-- Date: 2026-06-23
-- Reason: RBAC cache service needs platform_admins table

CREATE TABLE IF NOT EXISTS platform_admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  permissions TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_platform_admins_user_id ON platform_admins(user_id);
CREATE INDEX idx_platform_admins_email ON platform_admins(email);
CREATE INDEX idx_platform_admins_role ON platform_admins(role);

-- Insert default super admin if not exists
INSERT OR IGNORE INTO platform_admins (user_id, email, full_name, role, permissions, is_active)
VALUES (1, 'admin@ekala.africa', 'Super Admin', 'owner', '["all"]', 1);
