-- ============================================================================
-- Migration 022: Ensure inventory_movements has all required columns for sync
-- ============================================================================
-- Cette migration garantit que la table inventory_movements a toutes les colonnes
-- nécessaires pour la synchronisation avec Supabase.
-- ============================================================================

-- 1. Ajouter tenant_id si absent
ALTER TABLE inventory_movements ADD COLUMN tenant_id INTEGER DEFAULT 5;

-- 2. Ajouter movement_code si absent
ALTER TABLE inventory_movements ADD COLUMN movement_code TEXT;

-- 3. Ajouter inventory_session_id si absent
ALTER TABLE inventory_movements ADD COLUMN inventory_session_id INTEGER;

-- 4. Ajouter approved_by si absent
ALTER TABLE inventory_movements ADD COLUMN approved_by INTEGER;

-- 5. Ajouter remote_id si absent (pour le mapping local -> Supabase)
ALTER TABLE inventory_movements ADD COLUMN remote_id INTEGER;

-- 6. S'assurer que tenant_id est rempli pour les enregistrements existants
UPDATE inventory_movements SET tenant_id = 5 WHERE tenant_id IS NULL;

-- 7. Créer un index sur tenant_id pour les performances de sync
CREATE INDEX IF NOT EXISTS idx_inventory_movements_tenant_id ON inventory_movements(tenant_id);

-- 8. Créer un index sur remote_id pour le mapping
CREATE INDEX IF NOT EXISTS idx_inventory_movements_remote_id ON inventory_movements(remote_id) WHERE remote_id IS NOT NULL;
