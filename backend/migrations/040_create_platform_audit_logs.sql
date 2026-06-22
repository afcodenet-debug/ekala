-- =============================================================================
-- MIGRATION 040 — Table d'audit plateforme
-- =============================================================================
-- Date: 2026-06-22
-- Captures toutes les actions des admins plateforme
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  admin_email TEXT,
  admin_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  metadata TEXT,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN DEFAULT TRUE,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (admin_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_admin ON platform_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_action ON platform_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_platform_audit_entity ON platform_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_created ON platform_audit_logs(created_at);

INSERT OR IGNORE INTO billing_audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata, created_at)
VALUES (NULL, NULL, 'migration_040_applied', 'system', 0, '{"migration": "040_create_platform_audit_logs"}', datetime('now'));