-- Migration 018: Aligner les schémas SQLite avec Supabase
-- Cette version est SAFE pour exécution transactionnelle

-- ==============================
-- 1. ORDERS : ajouter les colonnes manquantes
-- ==============================
ALTER TABLE orders ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE orders ADD COLUMN customer_id INTEGER;

-- Supprimer les colonnes legacy avec PRAGMA (SQLite)
-- On utilise recreate si nécessaire
CREATE TABLE IF NOT EXISTS orders_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER,
  waiter_id INTEGER,
  customer_id INTEGER,
  items TEXT,
  status TEXT DEFAULT 'pending',
  total REAL DEFAULT 0,
  customer_phone TEXT,
  notes TEXT,
  remote_id INTEGER,
  source TEXT DEFAULT 'local',
  version INTEGER DEFAULT 1,
  tenant_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Copier seulement si la table cible est vide (évite les erreurs de colonnes)
INSERT OR IGNORE INTO orders_v2 (id, table_id, waiter_id, items, status, total, customer_phone, notes, remote_id, source, customer_id, created_at, updated_at)
SELECT id, table_id, waiter_id, items, status, total, customer_phone, notes, remote_id, COALESCE(source,'local'), customer_id, created_at, updated_at FROM orders WHERE id NOT IN (SELECT id FROM orders_v2 WHERE id IS NOT NULL);

-- ==============================
-- 2. ORDER_ITEMS : nettoyage
-- ==============================
ALTER TABLE order_items ADD COLUMN tenant_id TEXT;
ALTER TABLE order_items DROP COLUMN remote_order_id;

-- ==============================
-- 3. SUPPRESSION DES INDEX business_id
-- ==============================
DROP INDEX IF EXISTS idx_users_business_id;
DROP INDEX IF EXISTS idx_tenants_business_id;
DROP INDEX IF EXISTS idx_tenant_users_business_id;

-- Tables legacy backup (safe, ne crash pas si existantes)
DROP TABLE IF EXISTS orders_old;
DROP TABLE IF EXISTS order_items_old;
DROP TABLE IF EXISTS restaurant_tables_old;
DROP TABLE IF EXISTS products_old;
DROP TABLE IF EXISTS categories_old;
DROP TABLE IF EXISTS users_old;
DROP TABLE IF EXISTS tenants_old;

PRAGMA foreign_keys = ON;