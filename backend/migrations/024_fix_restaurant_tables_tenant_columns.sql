-- =============================================================================
-- Migration 024: Fix restaurant_tables - rename business_id to tenant_id (INTEGER=5)
-- =============================================================================
-- Problème : La table restaurant_tables a business_id au lieu de tenant_id,
--            et tenant_id est TEXT au lieu d'INTEGER.
-- Solution : Supprimer business_id, convertir tenant_id en INTEGER, et mettre 5 comme valeur.
-- NOTE: Cette migration est idempotent - le runner catchera les erreurs "no such column/table"
--       et marquera la migration comme appliquée si elle a déjà été faite manuellement.

-- 1. Vérifier si business_id existe (colonne legacy à migré)
--    Si elle n'existe pas, l'erreur sera catchée par le runner et on saute
SELECT business_id FROM restaurant_tables LIMIT 1;

-- 2. Sauvegarder les données existantes
CREATE TEMP TABLE restaurant_tables_backup AS SELECT * FROM restaurant_tables;

-- 3. Supprimer la table originale
DROP TABLE restaurant_tables;

-- 4. Recréer la table avec le bon schéma
CREATE TABLE restaurant_tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_number TEXT NOT NULL,
  capacity INTEGER DEFAULT 4,
  status TEXT DEFAULT 'available',
  assigned_waiter_id INTEGER,
  qr_token TEXT,
  tenant_id INTEGER DEFAULT 5,
  remote_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Copier les données en convertissant business_id -> tenant_id
INSERT INTO restaurant_tables (id, table_number, capacity, status, assigned_waiter_id, qr_token, tenant_id, remote_id, created_at, updated_at)
SELECT 
  id, 
  table_number, 
  capacity, 
  status, 
  assigned_waiter_id, 
  qr_token, 
  COALESCE(CAST(business_id AS INTEGER), 5) AS tenant_id,
  remote_id, 
  created_at, 
  updated_at 
FROM restaurant_tables_backup;

-- 6. Recréer l'index
CREATE INDEX IF NOT EXISTS idx_tables_remote_id ON restaurant_tables(remote_id) WHERE remote_id IS NOT NULL;

-- 7. Nettoyer
DROP TABLE restaurant_tables_backup;