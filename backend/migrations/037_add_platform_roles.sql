-- =============================================================================
-- MIGRATION 037 — Ajout des rôles Platform (Super Admin)
-- =============================================================================
-- Date: 2026-06-22
-- Description: Ajoute les nouveaux rôles pour l'équipe interne Ekala
-- Rôles: super_admin, support_admin, finance_admin, ops_admin
-- =============================================================================

-- Étape 1: Sauvegarder les rôles existants (pour rollback si nécessaire)
-- Les rôles actuels: owner, admin, manager, cashier, waiter

-- Étape 2: Créer la table de mapping des rôles platform
CREATE TABLE IF NOT EXISTS platform_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  permissions TEXT, -- JSON array of permissions
  is_system_role BOOLEAN DEFAULT FALSE, -- TRUE = ne peut pas être supprimé
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Étape 3: Insérer les rôles platform
INSERT OR IGNORE INTO platform_roles (role_name, display_name, description, permissions, is_system_role) VALUES
(
  'super_admin',
  'Super Admin',
  'Accès complet à toutes les fonctionnalités de la plateforme',
  '["*"]',
  TRUE
),
(
  'support_admin',
  'Support Admin',
  'Gestion du support client, consultation tenants et logs',
  '["tenants:read", "tenants:view", "audit:read", "sync:read", "vouchers:read"]',
  TRUE
),
(
  'finance_admin',
  'Finance Admin',
  'Gestion financière: abonnements, vouchers, revenus',
  '["subscriptions:read", "subscriptions:write", "vouchers:read", "vouchers:write", "finance:read", "billing:read"]',
  TRUE
),
(
  'ops_admin',
  'Ops Admin',
  'Opérations: suspension, réactivation, monitoring',
  '["tenants:write", "tenants:suspend", "tenants:activate", "sync:write", "monitoring:read"]',
  TRUE
);

-- Étape 4: Créer la table de permissions granulaires
CREATE TABLE IF NOT EXISTS platform_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  permission_key TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Étape 5: Insérer les permissions disponibles
INSERT OR IGNORE INTO platform_permissions (permission_key, description, category) VALUES
-- Tenants
('tenants:read', 'Voir la liste des tenants', 'Tenants'),
('tenants:view', 'Voir les détails d''un tenant', 'Tenants'),
('tenants:write', 'Modifier un tenant', 'Tenants'),
('tenants:suspend', 'Suspendre un tenant', 'Tenants'),
('tenants:activate', 'Réactiver un tenant', 'Tenants'),
('tenants:delete', 'Supprimer un tenant', 'Tenants'),

-- Subscriptions
('subscriptions:read', 'Voir les abonnements', 'Subscriptions'),
('subscriptions:write', 'Modifier les abonnements', 'Subscriptions'),
('subscriptions:cancel', 'Annuler un abonnement', 'Subscriptions'),

-- Vouchers
('vouchers:read', 'Voir les vouchers', 'Vouchers'),
('vouchers:write', 'Approuver/Rejeter des vouchers', 'Vouchers'),
('vouchers:approve', 'Approuver un voucher', 'Vouchers'),
('vouchers:reject', 'Rejeter un voucher', 'Vouchers'),

-- Finance
('finance:read', 'Voir les finances', 'Finance'),
('finance:write', 'Modifier les finances', 'Finance'),
('billing:read', 'Voir la facturation', 'Finance'),
('billing:write', 'Modifier la facturation', 'Finance'),

-- Sync
('sync:read', 'Voir le statut de synchronisation', 'Sync'),
('sync:write', 'Déclencher/contrôler la synchronisation', 'Sync'),

-- Monitoring
('monitoring:read', 'Voir les métriques et logs', 'Monitoring'),
('monitoring:write', 'Modifier les paramètres de monitoring', 'Monitoring'),

-- Audit
('audit:read', 'Voir les logs d''audit', 'Audit'),
('audit:export', 'Exporter les logs d''audit', 'Audit'),

-- Settings
('settings:read', 'Voir les paramètres', 'Settings'),
('settings:write', 'Modifier les paramètres', 'Settings'),

-- Users (platform)
('users:read', 'Voir les utilisateurs plateforme', 'Users'),
('users:write', 'Modifier les utilisateurs plateforme', 'Users'),
('users:create', 'Créer un utilisateur plateforme', 'Users'),
('users:delete', 'Supprimer un utilisateur plateforme', 'Users');

-- Étape 6: Créer la table de liaison rôle-permission
CREATE TABLE IF NOT EXISTS platform_role_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (role_id) REFERENCES platform_roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES platform_permissions(id) ON DELETE CASCADE,
  UNIQUE(role_id, permission_id)
);

-- Étape 7: Assigner les permissions aux rôles
-- Super Admin: toutes les permissions
INSERT OR IGNORE INTO platform_role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM platform_roles WHERE role_name = 'super_admin'),
  id
FROM platform_permissions;

-- Support Admin: lecture seulement
INSERT OR IGNORE INTO platform_role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM platform_roles WHERE role_name = 'support_admin'),
  id
FROM platform_permissions
WHERE permission_key IN (
  'tenants:read', 'tenants:view',
  'audit:read',
  'sync:read',
  'vouchers:read',
  'monitoring:read'
);

-- Finance Admin: finances + vouchers
INSERT OR IGNORE INTO platform_role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM platform_roles WHERE role_name = 'finance_admin'),
  id
FROM platform_permissions
WHERE permission_key IN (
  'subscriptions:read', 'subscriptions:write',
  'vouchers:read', 'vouchers:write', 'vouchers:approve', 'vouchers:reject',
  'finance:read', 'finance:write',
  'billing:read', 'billing:write',
  'audit:read'
);

-- Ops Admin: opérations + monitoring
INSERT OR IGNORE INTO platform_role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM platform_roles WHERE role_name = 'ops_admin'),
  id
FROM platform_permissions
WHERE permission_key IN (
  'tenants:read', 'tenants:view', 'tenants:suspend', 'tenants:activate',
  'sync:read', 'sync:write',
  'monitoring:read', 'monitoring:write',
  'audit:read'
);

-- Étape 8: Créer des index pour les performances
CREATE INDEX IF NOT EXISTS idx_platform_roles_role_name ON platform_roles(role_name);
CREATE INDEX IF NOT EXISTS idx_platform_permissions_key ON platform_permissions(permission_key);
CREATE INDEX IF NOT EXISTS idx_platform_permissions_category ON platform_permissions(category);
CREATE INDEX IF NOT EXISTS idx_platform_role_permissions_role ON platform_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_platform_role_permissions_permission ON platform_role_permissions(permission_id);

-- =============================================================================
-- FIN MIGRATION 037
-- =============================================================================