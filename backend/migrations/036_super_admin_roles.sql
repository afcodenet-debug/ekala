-- ============================================================================
-- Migration 036: Super Admin Platform — Rôles et Permissions
-- ============================================================================
-- Ajoute le rôle super_admin et les tables de gestion plateforme
-- Rollback-safe: toutes les modifications sont réversibles
-- ============================================================================

-- ============================================================================
-- 1. AJOUTER COLONNE is_super_admin DANS users
-- ============================================================================

ALTER TABLE users ADD COLUMN is_super_admin INTEGER NOT NULL DEFAULT 0;

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_users_is_super_admin 
  ON users(is_super_admin) WHERE is_super_admin = 1;

-- ============================================================================
-- 2. CRÉER TABLE platform_admins
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_admins (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    permissions TEXT DEFAULT '["*"]', -- JSON array: ["*"] = tous les droits
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by INTEGER REFERENCES users(id),
    notes TEXT
);

-- Index
CREATE INDEX IF NOT EXISTS idx_platform_admins_created_by 
  ON platform_admins(created_by);

-- ============================================================================
-- 3. ÉTENDRE tenant_users POUR SUPPORTER super_admin (tenant_id NULL)
-- ============================================================================

-- SQLite ne supporte pas ALTER TABLE DROP CONSTRAINT
-- Donc on crée une nouvelle table avec tenant_id nullable

CREATE TABLE IF NOT EXISTS tenant_users_v2 (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id           INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role                TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','admin','manager','cashier','waiter','staff','super_admin')),
    is_default          INTEGER NOT NULL DEFAULT 0,
    is_active           INTEGER NOT NULL DEFAULT 1,
    invited_at          TEXT,
    joined_at           TEXT,
    remote_id           INTEGER,
    business_id         TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, user_id)
);

-- Migrer les données existantes
INSERT INTO tenant_users_v2 
  (id, tenant_id, user_id, role, is_default, is_active, invited_at, joined_at, remote_id, business_id, created_at, updated_at)
SELECT 
  id, tenant_id, user_id, role, is_default, is_active, invited_at, joined_at, remote_id, business_id, created_at, updated_at
FROM tenant_users;

-- Supprimer l'ancienne table
DROP TABLE IF EXISTS tenant_users;

-- Renommer la nouvelle table
ALTER TABLE tenant_users_v2 RENAME TO tenant_users;

-- Recréer les index
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON tenant_users(user_id);

-- ============================================================================
-- 4. AJOUTER COLONNES AUDIT DANS tenants
-- ============================================================================

ALTER TABLE tenants ADD COLUMN suspended_at TEXT;
ALTER TABLE tenants ADD COLUMN suspension_reason TEXT;
ALTER TABLE tenants ADD COLUMN suspended_by INTEGER REFERENCES users(id);
ALTER TABLE tenants ADD COLUMN last_reactivated_at TEXT;
ALTER TABLE tenants ADD COLUMN last_reactivated_by INTEGER REFERENCES users(id);

-- Index pour requêtes temporelles
CREATE INDEX IF NOT EXISTS idx_tenants_suspended_at 
  ON tenants(suspended_at) WHERE suspended_at IS NOT NULL;

-- ============================================================================
-- 5. CRÉER TABLE billing_audit_logs
-- ============================================================================

CREATE TABLE IF NOT EXISTS billing_audit_logs (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id           INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
    user_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action              TEXT NOT NULL, -- voucher_approved, voucher_rejected, tenant_suspended, tenant_activated, subscription_activated, subscription_expired
    entity_type         TEXT NOT NULL, -- voucher, subscription, tenant, payment
    entity_id           INTEGER NOT NULL,
    metadata            TEXT DEFAULT '{}', -- JSON avec détails
    ip_address          TEXT,
    user_agent          TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_billing_audit_logs_tenant 
  ON billing_audit_logs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_billing_audit_logs_action 
  ON billing_audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_billing_audit_logs_created 
  ON billing_audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_billing_audit_logs_entity 
  ON billing_audit_logs(entity_type, entity_id);

-- ============================================================================
-- 6. ÉTENDRE voucher_requests AVEC COLONNES MANQUANTES
-- ============================================================================

ALTER TABLE voucher_requests ADD COLUMN rejection_reason TEXT;
ALTER TABLE voucher_requests ADD COLUMN notes TEXT;
ALTER TABLE voucher_requests ADD COLUMN amount_cents INTEGER;
ALTER TABLE voucher_requests ADD COLUMN currency TEXT DEFAULT 'ZMW';

-- Index pour requêtes par statut
CREATE INDEX IF NOT EXISTS idx_voucher_requests_status_created 
  ON voucher_requests(status, created_at);

-- ============================================================================
-- 7. ÉTENDRE voucher_audit_logs AVEC METADATA
-- ============================================================================

-- SQLite ne permet pas d'ajouter une colonne avec DEFAULT sur une table existante
-- On utilise une approche en 2 étapes

ALTER TABLE voucher_audit_logs ADD COLUMN metadata TEXT DEFAULT '{}';
ALTER TABLE voucher_audit_logs ADD COLUMN ip_address TEXT;
ALTER TABLE voucher_audit_logs ADD COLUMN user_agent TEXT;

-- ============================================================================
-- 8. CRÉER TABLE platform_settings (configuration globale)
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_settings (
    key                 TEXT PRIMARY KEY,
    value               TEXT NOT NULL,
    description         TEXT,
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_by INTEGER REFERENCES users(id)
);

-- Seed settings par défaut
INSERT OR IGNORE INTO platform_settings (key, value, description) VALUES
  ('platform_name', 'Ekala POS', 'Nom de la plateforme'),
  ('support_email', 'support@ekala.com', 'Email de support'),
  ('max_tenants', '10000', 'Nombre maximum de tenants'),
  ('default_trial_days', '7', 'Jours d''essai par défaut'),
  ('voucher_verification_hours', '24', 'Heures pour valider un voucher'),
  ('voucher_expiration_hours', '48', 'Heures avant expiration voucher'),
  ('maintenance_mode', '0', 'Mode maintenance (0=off, 1=on)');

-- ============================================================================
-- 9. TRIGGERS POUR AUDIT AUTOMATIQUE
-- ============================================================================

-- Trigger: Log quand un tenant est suspendu
CREATE TRIGGER IF NOT EXISTS audit_tenant_suspended 
AFTER UPDATE OF status ON tenants
WHEN NEW.status = 'suspended' AND OLD.status != 'suspended'
BEGIN
  INSERT INTO tenant_audit_log (tenant_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
  VALUES (
    NEW.id,
    NULL, -- actor_user_id sera mis à jour par le middleware
    'tenant_suspended',
    'tenant',
    NEW.id,
    json_object('reason', COALESCE(NEW.suspension_reason, 'N/A'), 'suspended_at', NEW.suspended_at),
    datetime('now')
  );
END;

-- Trigger: Log quand un tenant est réactivé
CREATE TRIGGER IF NOT EXISTS audit_tenant_activated 
AFTER UPDATE OF status ON tenants
WHEN NEW.status = 'active' AND OLD.status = 'suspended'
BEGIN
  INSERT INTO tenant_audit_log (tenant_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
  VALUES (
    NEW.id,
    NULL,
    'tenant_activated',
    'tenant',
    NEW.id,
    json_object('reactivated_at', COALESCE(NEW.last_reactivated_at, datetime('now'))),
    datetime('now')
  );
END;

-- Trigger: Log quand un voucher est vérifié
CREATE TRIGGER IF NOT EXISTS audit_voucher_verified 
AFTER UPDATE OF status ON voucher_requests
WHEN NEW.status = 'verified' AND OLD.status != 'verified'
BEGIN
  INSERT INTO voucher_audit_logs (voucher_request_id, action, actor_id, notes, created_at)
  VALUES (
    NEW.id,
    'verified',
    NEW.verified_by,
    'Voucher validé par admin',
    datetime('now')
  );
  
  INSERT INTO billing_audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata, created_at)
  VALUES (
    NEW.tenant_id,
    NEW.verified_by,
    'voucher_approved',
    'voucher',
    NEW.id,
    json_object('voucher_code', NEW.voucher_code, 'plan_id', NEW.plan_id),
    datetime('now')
  );
END;

-- Trigger: Log quand un voucher est rejeté
CREATE TRIGGER IF NOT EXISTS audit_voucher_rejected 
AFTER UPDATE OF status ON voucher_requests
WHEN NEW.status = 'rejected' AND OLD.status != 'rejected'
BEGIN
  INSERT INTO voucher_audit_logs (voucher_request_id, action, actor_id, notes, created_at)
  VALUES (
    NEW.id,
    'rejected',
    NEW.verified_by,
    COALESCE(NEW.rejection_reason, 'Aucune raison fournie'),
    datetime('now')
  );
  
  INSERT INTO billing_audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata, created_at)
  VALUES (
    NEW.tenant_id,
    NEW.verified_by,
    'voucher_rejected',
    'voucher',
    NEW.id,
    json_object('voucher_code', NEW.voucher_code, 'reason', COALESCE(NEW.rejection_reason, 'N/A')),
    datetime('now')
  );
END;

-- ============================================================================
-- 10. ROLLBACK SCRIPT (à exécuter manuellement si nécessaire)
-- ============================================================================

-- Pour rollback, exécuter dans l'ordre inverse:
-- 1. DROP TRIGGER IF EXISTS audit_voucher_rejected;
-- 2. DROP TRIGGER IF EXISTS audit_voucher_verified;
-- 3. DROP TRIGGER IF EXISTS audit_tenant_activated;
-- 4. DROP TRIGGER IF EXISTS audit_tenant_suspended;
-- 5. DROP TABLE IF EXISTS platform_settings;
-- 6. ALTER TABLE voucher_audit_logs DROP COLUMN user_agent;
-- 7. ALTER TABLE voucher_audit_logs DROP COLUMN ip_address;
-- 8. ALTER TABLE voucher_audit_logs DROP COLUMN metadata;
-- 9. ALTER TABLE voucher_requests DROP COLUMN currency;
-- 10. ALTER TABLE voucher_requests DROP COLUMN amount_cents;
-- 11. ALTER TABLE voucher_requests DROP COLUMN notes;
-- 12. ALTER TABLE voucher_requests DROP COLUMN rejection_reason;
-- 13. DROP TABLE IF EXISTS billing_audit_logs;
-- 14. ALTER TABLE tenants DROP COLUMN last_reactivated_by;
-- 15. ALTER TABLE tenants DROP COLUMN last_reactivated_at;
-- 16. ALTER TABLE tenants DROP COLUMN suspended_by;
-- 17. ALTER TABLE tenants DROP COLUMN suspension_reason;
-- 18. ALTER TABLE tenants DROP COLUMN suspended_at;
-- 19. DROP TABLE IF EXISTS platform_admins;
-- 20. ALTER TABLE users DROP COLUMN is_super_admin;

-- ============================================================================
-- FIN MIGRATION 036
-- ============================================================================