-- ============================================================================
-- Migration 032: Add missing columns to inventory_movements for complete sync
-- ============================================================================
-- Cette migration ajoute les colonnes manquantes à inventory_movements qui n'ont
-- pas été ajoutées par la migration 022 car celle-ci a été arrêtée prématurément.
-- ============================================================================

-- 1. Ajouter movement_code si absent
ALTER TABLE inventory_movements ADD COLUMN movement_code TEXT;

-- 2. Ajouter inventory_session_id si absent
ALTER TABLE inventory_movements ADD COLUMN inventory_session_id INTEGER;

-- 3. Ajouter approved_by si absent
ALTER TABLE inventory_movements ADD COLUMN approved_by INTEGER;

-- 4. Créer un index sur tenant_id pour les performances de sync
CREATE INDEX IF NOT EXISTS idx_inventory_movements_tenant_id ON inventory_movements(tenant_id);
