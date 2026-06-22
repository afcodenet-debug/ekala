-- =============================================================================
-- MIGRATION 039 — Bootstrap Super Admin
-- =============================================================================
-- Date: 2026-06-22
-- Description: Crée le compte super admin initial
-- Idempotent: ne crée que si inexistant
-- Variables d'environnement:
--   PLATFORM_ADMIN_EMAIL (default: admin@ekala.africa)
--   PLATFORM_ADMIN_PASSWORD (default: généré aléatoirement si non défini)
-- =============================================================================

-- Étape 1: Vérifier si le super admin existe déjà
-- Note: Cette migration doit être exécutée via un script Node.js qui lit les variables d'env
-- Le SQL ci-dessous est la logique à exécuter

-- Vérifier si un super admin existe
SELECT COUNT(*) as admin_count FROM users WHERE role = 'super_admin' AND is_platform_user = 1;

-- Si admin_count = 0, créer le super admin
-- Le mot de passe doit être hashé côté application (bcrypt)
-- Cette insertion est faite via le script de bootstrap

-- Créer la table de configuration si elle n'existe pas
CREATE TABLE IF NOT EXISTS platform_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_key TEXT UNIQUE NOT NULL,
  config_value TEXT,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Insérer la configuration par défaut
INSERT OR IGNORE INTO platform_config (config_key, config_value, description) VALUES
('platform.name', 'Ekala Platform', 'Nom de la plateforme'),
('platform.support_email', 'support@ekala.africa', 'Email de support'),
('platform.admin_email', 'admin@ekala.africa', 'Email du super admin'),
('platform.bootstrap_complete', 'false', 'Indique si le bootstrap est terminé'),
('platform.version', '1.0.0', 'Version de la plateforme'),
('platform.maintenance_mode', 'false', 'Mode maintenance'),
('voucher.verification_hours', '24', 'Heures pour valider un voucher'),
('voucher.expiration_hours', '48', 'Heures avant expiration d''un voucher'),
('subscription.default_trial_days', '7', 'Jours d''essai par défaut'),
('subscription.grace_period_days', '7', 'Jours de grâce après expiration');

-- Log
INSERT OR IGNORE INTO billing_audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata, created_at)
VALUES (NULL, NULL, 'migration_039_applied', 'system', 0, '{"migration": "039_bootstrap_super_admin"}', datetime('now'));