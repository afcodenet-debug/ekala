-- =============================================================================
-- SUPABASE_PRODUCTS_SYNC_FIX.sql
-- Script pour aligner la table 'products' de Supabase avec SQLite
-- À exécuter dans le SQL Editor de Supabase
-- =============================================================================

-- 1. Ajout des colonnes manquantes pour la synchronisation et le cycle de vie
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- 2. Ajout de colonnes de compatibilité (facultatif mais recommandé si le code les utilise)
ALTER TABLE products ADD COLUMN IF NOT EXISTS price NUMERIC(12,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,4);

-- 3. S'assurer que tenant_id existe (déjà fait par un autre script, mais sécurité)
ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE products SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 4. Index pour la performance de synchronisation
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at);
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at) WHERE deleted_at IS NOT NULL;

-- 5. Mise à jour du statut pour les produits déjà archivés/supprimés
UPDATE products SET status = 'archived' WHERE deleted_at IS NOT NULL OR is_available = FALSE;
