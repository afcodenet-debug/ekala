-- =============================================================================
-- Migration 025: Add unique constraint for tenant-scoped table_number
-- =============================================================================
-- Problème : table_number n'a pas de contrainte d'unicité composite
-- Solution : Ajouter une contrainte UNIQUE sur (tenant_id, table_number)
-- NOTE : Cette migration peut échouer si la contrainte existe déjà (sera catchée)

-- Vérifier si des doublons existent avant de créer la contrainte
DROP TABLE IF EXISTS _duplicate_check;
CREATE TEMP TABLE _duplicate_check AS
SELECT tenant_id, table_number, COUNT(*) as cnt
FROM restaurant_tables
GROUP BY tenant_id, table_number
HAVING COUNT(*) > 1;

-- Si des doublons existent, les signaler (mais continuer)
SELECT COUNT(*) as duplicates FROM _duplicate_check;

-- Créer l'index UNIQUE composite (ou ignorer si existe déjà)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tables_tenant_number_unique 
ON restaurant_tables(tenant_id, table_number);

DROP TABLE _duplicate_check;