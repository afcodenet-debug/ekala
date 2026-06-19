-- =============================================================================
-- FIX_SUPABASE_TENANT_ID_COLUMNS.sql
-- Script SQL à exécuter dans l'éditeur SQL de Supabase (Dashboard > SQL Editor)
-- Ajoute la colonne tenant_id à toutes les tables qui en ont besoin
-- =============================================================================
-- Ne contient QUE les tables qui existent réellement dans votre Supabase
-- (vérifié le 15/06/2026)

-- 1. Tenants (pas besoin de tenant_id - c'est la table racine)
-- tenant_users n'a PAS besoin de tenant_id (hasTenantId: false dans registry)

-- 2. Users
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE users SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 3. Categories
ALTER TABLE IF EXISTS categories ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE categories SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 4. Products
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE products SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 5. Restaurant Tables
ALTER TABLE IF EXISTS restaurant_tables ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE restaurant_tables SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 6. Customers
ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE customers SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 7. Orders
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE orders SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 8. Order Items
ALTER TABLE IF EXISTS order_items ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE order_items SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 9. Sales
ALTER TABLE IF EXISTS sales ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE sales SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 10. Sale Items
ALTER TABLE IF EXISTS sale_items ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE sale_items SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 11. Expenses
ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE expenses SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 12. Inventory Movements
ALTER TABLE IF EXISTS inventory_movements ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE inventory_movements SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 13. Inventory Sessions
ALTER TABLE IF EXISTS inventory_sessions ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE inventory_sessions SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 14. Suppliers
ALTER TABLE IF EXISTS suppliers ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE suppliers SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 15. Purchase Orders
ALTER TABLE IF EXISTS purchase_orders ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE purchase_orders SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 16. Purchase Order Items
ALTER TABLE IF EXISTS purchase_order_items ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE purchase_order_items SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 17. Stock Adjustments
ALTER TABLE IF EXISTS stock_adjustments ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE stock_adjustments SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 18. Stock Adjustment Items
ALTER TABLE IF EXISTS stock_adjustment_items ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE stock_adjustment_items SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 19. Menu Categories
ALTER TABLE IF EXISTS menu_categories ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE menu_categories SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 20. Menu Items
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE menu_items SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 21. Settings
ALTER TABLE IF EXISTS settings ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE settings SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 22. Vouchers
ALTER TABLE IF EXISTS vouchers ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
UPDATE vouchers SET tenant_id = 1 WHERE tenant_id IS NULL;

-- =============================================================================
-- VÉRIFICATION : tables qui ont ENCORE besoin de tenant_id
-- =============================================================================
SELECT table_name, 'MISSING tenant_id' AS status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name NOT IN (
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'tenant_id'
  )
ORDER BY table_name;