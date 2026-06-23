-- =============================================================================
-- MIGRATION 041: Architecture RBAC Production-Hardened
-- =============================================================================
-- Date: 2026-06-23
-- Description: Ajoute les colonnes de sécurité et les fonctionnalités RBAC avancées
-- =============================================================================

-- =============================================================================
-- ÉTAPE 1: Ajouter les colonnes de statut à users
-- =============================================================================

-- Ajouter status pour les users (active/suspended/revoked/locked)
-- Note: SQLite ne supporte pas CHECK dans ALTER TABLE, nous utilisons un trigger
ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';

-- Ajouter les colonnes de révocation
ALTER TABLE users ADD COLUMN revoked_at TEXT;
ALTER TABLE users ADD COLUMN revoked_by INTEGER REFERENCES users(id);
ALTER TABLE users ADD COLUMN locked_until TEXT;

-- Créer un index sur status pour les requêtes de sécurité
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Créer un trigger pour valider les valeurs de status (SQLite ne supporte pas CHECK dans ALTER TABLE)
CREATE TRIGGER IF NOT EXISTS validate_user_status BEFORE INSERT ON users
FOR EACH ROW
WHEN NEW.status NOT IN ('active', 'suspended', 'revoked', 'locked')
BEGIN
  SELECT RAISE(ABORT, 'Invalid user status. Must be: active, suspended, revoked, or locked');
END;

-- =============================================================================
-- ÉTAPE 2: Ajouter les colonnes de statut à tenants
-- =============================================================================

-- Ajouter status pour les tenants (active/disabled/suspended)
-- Note: SQLite ne supporte pas CHECK dans ALTER TABLE, nous utilisons un trigger
ALTER TABLE tenants ADD COLUMN status TEXT DEFAULT 'active';

-- Ajouter les colonnes de traçabilité
ALTER TABLE tenants ADD COLUMN disabled_at TEXT;
ALTER TABLE tenants ADD COLUMN disabled_by INTEGER REFERENCES users(id);

-- Créer un index sur status pour les requêtes de sécurité
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- Créer un trigger pour valider les valeurs de status
CREATE TRIGGER IF NOT EXISTS validate_tenant_status BEFORE INSERT ON tenants
FOR EACH ROW
WHEN NEW.status NOT IN ('active', 'disabled', 'suspended')
BEGIN
  SELECT RAISE(ABORT, 'Invalid tenant status. Must be: active, disabled, or suspended');
END;

-- =============================================================================
-- ÉTAPE 3: Créer la table de audit pour les révocations
-- =============================================================================

CREATE TABLE IF NOT EXISTS rbac_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,  -- 'user_killed', 'role_killed', 'tenant_killed', 'user_revived', etc.
  target_type TEXT NOT NULL,  -- 'user', 'role', 'tenant'
  target_id INTEGER NOT NULL,
  reason TEXT,
  performed_by INTEGER REFERENCES users(id),
  metadata TEXT,  -- JSON avec détails supplémentaires
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Créer des index pour les requêtes d'audit
CREATE INDEX IF NOT EXISTS idx_rbac_audit_action ON rbac_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_target ON rbac_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_created_at ON rbac_audit_log(created_at);

-- =============================================================================
-- ÉTAPE 4: Mettre à jour les users existants avec status = 'active'
-- =============================================================================

UPDATE users SET status = 'active' WHERE status IS NULL;

-- =============================================================================
-- ÉTAPE 5: Mettre à jour les tenants existants avec status = 'active'
-- =============================================================================

UPDATE tenants SET status = 'active' WHERE status IS NULL;

-- =============================================================================
-- ÉTAPE 6: Log de migration
-- =============================================================================

-- Log de migration (utiliser INSERT simple car billing_audit_logs peut ne pas exister)
INSERT OR IGNORE INTO billing_audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata, created_at)
VALUES (NULL, NULL, 'migration_041_applied', 'system', 0, '{"migration": "041_hardened_rbac", "features": ["user_status", "tenant_status", "kill_switch", "rbac_audit"]}', datetime('now'));

-- =============================================================================
-- FIN MIGRATION 041
-- =============================================================================