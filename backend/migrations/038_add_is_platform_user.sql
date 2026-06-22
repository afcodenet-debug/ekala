-- =============================================================================
-- MIGRATION 038 — Ajout colonne is_platform_user
-- =============================================================================
-- Date: 2026-06-22
-- Description: Permet de distinguer les utilisateurs plateforme des tenants
-- =============================================================================

-- Étape 1: Ajouter la colonne is_platform_user
ALTER TABLE users ADD COLUMN is_platform_user BOOLEAN DEFAULT FALSE;

-- Étape 2: Créer les index
CREATE INDEX IF NOT EXISTS idx_users_is_platform_user ON users(is_platform_user);
CREATE INDEX IF NOT EXISTS idx_users_platform_lookup ON users(is_platform_user, tenant_id, status);

-- Étape 3: Triggers de validation
CREATE TRIGGER IF NOT EXISTS validate_platform_user_tenant_insert
BEFORE INSERT ON users
FOR EACH ROW
WHEN NEW.is_platform_user = 1 AND NEW.tenant_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Platform users cannot have a tenant_id');
END;

CREATE TRIGGER IF NOT EXISTS validate_platform_user_tenant_update
BEFORE UPDATE ON users
FOR EACH ROW
WHEN NEW.is_platform_user = 1 AND NEW.tenant_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Platform users cannot have a tenant_id');
END;

-- Étape 4: Marquer les users existants comme tenant users
UPDATE users SET is_platform_user = 0 WHERE tenant_id IS NOT NULL;

-- Étape 5: Log
INSERT OR IGNORE INTO billing_audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata, created_at)
VALUES (NULL, NULL, 'migration_038_applied', 'system', 0, '{"migration": "038_add_is_platform_user"}', datetime('now'));