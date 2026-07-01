-- Migration: Fusionner tenant_subscriptions dans subscriptions
-- Date: 29 Juin 2026
-- Description: Supprime la table en doublon et migre les données

-- Étape 1: Créer une sauvegarde de sécurité
CREATE TABLE IF NOT EXISTS tenant_subscriptions_backup AS 
SELECT * FROM tenant_subscriptions;

-- Étape 2: Migrer les données de tenant_subscriptions vers subscriptions
INSERT OR IGNORE INTO subscriptions (
    tenant_id, 
    plan_id, 
    status, 
    current_period_start, 
    current_period_end,
    trial_started_at,
    trial_ends_at,
    created_at,
    updated_at
)
SELECT 
    ts.tenant_id,
    ts.plan_id,
    ts.status,
    ts.current_period_start,
    ts.current_period_end,
    ts.trial_start,
    ts.trial_end,
    ts.created_at,
    ts.updated_at
FROM tenant_subscriptions ts
WHERE NOT EXISTS (
    SELECT 1 FROM subscriptions s 
    WHERE s.tenant_id = ts.tenant_id 
    AND s.plan_id = ts.plan_id
);

-- Étape 3: Ajouter la colonne voucher_code à subscriptions si elle n'existe pas
-- SQLite ne supporte pas ADD COLUMN IF NOT EXISTS, on vérifie d'abord
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 
            (ALTER TABLE subscriptions ADD COLUMN voucher_code TEXT)
        ELSE 
            'Column already exists'
    END
FROM pragma_table_info('subscriptions')
WHERE name = 'voucher_code';

-- Étape 4: Mettre à jour last_voucher_code depuis tenant_subscriptions
UPDATE subscriptions
SET last_voucher_code = (
    SELECT ts.voucher_code 
    FROM tenant_subscriptions ts 
    WHERE ts.tenant_id = subscriptions.tenant_id
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 FROM tenant_subscriptions ts 
    WHERE ts.tenant_id = subscriptions.tenant_id
);

-- Étape 5: Supprimer la table en doublon
DROP TABLE IF EXISTS tenant_subscriptions;

-- Étape 6: Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_plan 
ON subscriptions(tenant_id, plan_id);

-- Étape 7: Vérification
SELECT 'Migration terminée' as status;
SELECT COUNT(*) as total_subscriptions FROM subscriptions;
SELECT tenant_id, plan_id, status FROM subscriptions LIMIT 10;