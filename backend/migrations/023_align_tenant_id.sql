-- =============================================================================
-- Migration 023: Aligner les IDs tenants (legacy tenant_id=5 → id=1)
-- =============================================================================
-- Problème : La colonne tenant_id sur la table tenants est une incohérence
--            legacy. Les users ont tenant_id=5 mais le vrai tenant a id=1.
-- Solution : Supprimer la colonne tenant_id sur tenants, corriger users.tenant_id,
--            et créer une vraie FK pour l'isolation multi-tenant.
-- =============================================================================

-- 1. Supprimer la colonne tenant_id mal alignée sur la table tenants (SQLite uniquement)
--    (Sur Supabase, on ne peut pas drop une colonne facilement, on l'ignore)
--    NOTE: SQLite ne supporte pas DROP COLUMN avant version 3.35.0
--    On va plutôt la renommer pour clarifier
ALTER TABLE tenants RENAME COLUMN tenant_id TO _legacy_tenant_reference;

-- 2. Corriger les users : tenant_id=5 → tenant_id=1 (vrai ID du tenant MAKUNANO)
UPDATE users SET tenant_id = 1 WHERE tenant_id = 5 OR tenant_id IS NULL;

-- 3. Appliquer la correction à toutes les tables enfants
UPDATE products SET tenant_id = 1 WHERE tenant_id = 5 OR tenant_id IS NULL;
UPDATE categories SET tenant_id = 1 WHERE tenant_id = 5 OR tenant_id IS NULL;
UPDATE restaurant_tables SET tenant_id = 1 WHERE tenant_id = 5 OR tenant_id IS NULL;
UPDATE orders SET tenant_id = 1 WHERE tenant_id = 5 OR tenant_id IS NULL;
UPDATE sales SET tenant_id = 1 WHERE tenant_id = 5 OR tenant_id IS NULL;
UPDATE sale_items SET tenant_id = 1 WHERE tenant_id = 5 OR tenant_id IS NULL;
UPDATE expenses SET tenant_id = 1 WHERE tenant_id = 5 OR tenant_id IS NULL;

-- 4. Forcer les prochains inserts à utiliser tenant_id=1 par défaut
--    (PLUS de tenant_id=5 en dur dans le code)