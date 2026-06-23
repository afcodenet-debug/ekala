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
  created_at TEXT DEFAULT (datetime('now'))
  -- Pas de FK sur admin_id: table d'audit système, admin peut être supprimé
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_admin ON platform_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_action ON platform_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_platform_audit_entity ON platform_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_created ON platform_audit_logs(created_at);

-- Log de migration désactivé volontairement pour éviter la contrainte FK
-- avec admin_id=0 qui n'existe pas dans users
-- Le log sera fait via l'API platform_audit_logs dans platform-auth.routes.ts
