-- Migration 042: Fix products.tenant_id from TEXT to INTEGER
-- This migration corrects an anomaly where tenant_id was TEXT instead of INTEGER
-- caused by migration 030 which incorrectly added tenant_id TEXT after it already
-- existed as INTEGER from migrations 014/015.
--
-- Architecture cible: tenant_id INTEGER (consistent with all other tables)
-- Date: 2026-06-25

PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

-- Step 1: Create new table with correct schema
CREATE TABLE products_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    name TEXT NOT NULL,
    barcode TEXT,
    sku TEXT,
    buying_price REAL DEFAULT 0,
    selling_price REAL NOT NULL,
    stock_quantity REAL DEFAULT 0,
    minimum_stock REAL DEFAULT 0,
    unit TEXT DEFAULT 'pcs',
    is_available INTEGER DEFAULT 1,
    description TEXT,
    image_url TEXT,
    status TEXT DEFAULT 'active'
        CHECK (status IN ('active','inactive','draft','archived')),
    cost_method TEXT DEFAULT 'average'
        CHECK (cost_method IN ('fifo','lifo','average','standard')),
    created_by INTEGER,
    updated_by INTEGER,
    archived_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    sort_order INTEGER DEFAULT 0,
    tenant_id INTEGER,
    is_featured INTEGER DEFAULT 0,
    metadata TEXT,
    version INTEGER DEFAULT 1,
    price REAL DEFAULT 0,
    cost_price REAL DEFAULT 0,
    remote_id INTEGER,
    sync_status TEXT DEFAULT 'synced',
    business_id INTEGER,
    low_stock_threshold INTEGER DEFAULT 5,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Step 2: Copy data with tenant_id conversion (TEXT -> INTEGER)
INSERT INTO products_new (
    id, category_id, name, barcode, sku, buying_price, selling_price,
    stock_quantity, minimum_stock, unit, is_available, description, image_url,
    status, cost_method, created_by, updated_by, archived_at, created_at,
    updated_at, deleted_at, sort_order, tenant_id, is_featured, metadata,
    version, price, cost_price, remote_id, sync_status, business_id, low_stock_threshold
)
SELECT 
    id, category_id, name, barcode, sku, buying_price, selling_price,
    stock_quantity, minimum_stock, unit, is_available, description, image_url,
    status, cost_method, created_by, updated_by, archived_at, created_at,
    updated_at, deleted_at, sort_order, 
    CASE 
        WHEN tenant_id IS NULL THEN NULL
        WHEN typeof(tenant_id) = 'text' THEN CAST(tenant_id AS INTEGER)
        ELSE tenant_id
    END as tenant_id,
    is_featured, metadata, version, price, cost_price, remote_id, sync_status,
    business_id, low_stock_threshold
FROM products;

-- Step 3: Drop old table
DROP TABLE products;

-- Step 4: Rename new table
ALTER TABLE products_new RENAME TO products;

-- Step 5: Recreate triggers
CREATE TRIGGER trg_products_updated_at
  AFTER UPDATE ON products
  FOR EACH ROW BEGIN
    UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
  END;

CREATE TRIGGER trg_prevent_negative_stock
  BEFORE UPDATE OF stock_quantity ON products
  FOR EACH ROW
  WHEN NEW.stock_quantity < 0
BEGIN
  SELECT RAISE(ABORT, 'Stock quantity cannot be negative');
END;

-- Step 6: Recreate indexes
CREATE UNIQUE INDEX idx_products_tenant_name 
ON products(tenant_id, name) 
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX idx_products_tenant_sku 
ON products(tenant_id, sku) 
WHERE sku IS NOT NULL AND sku != '' AND deleted_at IS NULL;

CREATE INDEX idx_products_remote_id ON products(remote_id) WHERE remote_id IS NOT NULL;
CREATE INDEX idx_products_tenant ON products(tenant_id);

COMMIT;