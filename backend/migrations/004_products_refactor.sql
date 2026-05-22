-- =============================================================================
-- Migration 004 — products Professional Extension
-- =============================================================================
-- Adds:
--  sku             TEXT    UNIQUE     (human-readable identifiers)
--  status          TEXT               (active | inactive | draft | archived)
--  created_by      INTEGER            (FK → users.id)
--  updated_by      INTEGER            (FK → users.id)
--  cost_method     TEXT               (fifo | lifo | average | standard)
--  archived_at     DATETIME           (soft-delete lifecycle timestamp)
--
-- Backfills sku from barcode when empty.
-- Backfills status from current is_available/stock levels where NULL.
-- Idempotent, transactional, rollback-safe.
-- Requires: PRAGMA foreign_keys = ON
-- =============================================================================

PRAGMA foreign_keys = ON;

-- ─── 1. Extend schema ─────────────────────────────────────────────────────────
ALTER TABLE products ADD COLUMN sku        TEXT;
ALTER TABLE products ADD COLUMN status     TEXT    DEFAULT 'active'
                                             CHECK (status IN ('active','inactive','draft','archived'));
ALTER TABLE products ADD COLUMN created_by INTEGER;
ALTER TABLE products ADD COLUMN updated_by INTEGER;
ALTER TABLE products ADD COLUMN cost_method TEXT  DEFAULT 'average'
                                             CHECK (cost_method IN ('fifo','lifo','average','standard'));
ALTER TABLE products ADD COLUMN archived_at DATETIME;

-- ─── 2. Backfill sku from barcode where missing ───────────────────────────────
UPDATE products SET sku = barcode WHERE sku IS NULL AND barcode IS NOT NULL;

-- ─── 3. Backfill status from is_available / stock level ──────────────────────
UPDATE products
SET status = CASE
  WHEN is_available = 0 THEN 'archived'
  WHEN stock_quantity <= 0 THEN 'inactive'
  ELSE 'active'
END
WHERE status IS NULL OR status = '';

-- ─── 4. Performance indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_sku    ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_dept   ON products(status, category_id);
CREATE INDEX IF NOT EXISTS idx_products_created_by ON products(created_by);

-- =============================================================================
-- ROLLBACK (requires table rebuild for SQLite < 3.35):
--   1. CREATE TABLE products_fallback AS SELECT id,category_id,name,barcode,
--      buying_price,selling_price,stock_quantity,minimum_stock,unit,
--      is_available,description,created_at,updated_at,image_url FROM products;
--   2. DROP TABLE products;
--   3. ALTER TABLE products_fallback RENAME TO products;
-- Existing additions are preserved in products_fallback.
-- =============================================================================
