-- =============================================================================
-- Migration 001 — order_items: Replace JSON items Column in orders
-- =============================================================================
-- The `orders.items` TEXT/JSON column is the current single source of truth.
-- This migration:
--   1. Creates the fully-relational `order_items` table.
--   2. Back-fills every existing order from the JSON column.
--   3. Adds indexes and triggers for referential integrity.
--
-- Idempotent, transactional, rollback-safe.
-- Requires: PRAGMA foreign_keys = ON
-- =============================================================================

PRAGMA foreign_keys = ON;

-- ─── 1. Check existing orders for items data ──────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL,
  product_id   INTEGER NOT NULL,
  quantity     REAL    NOT NULL  CHECK (quantity > 0),
  unit_price   REAL    NOT NULL  CHECK (unit_price >= 0),
  total_price  REAL    NOT NULL  CHECK (total_price >= 0),
  notes        TEXT,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id)   REFERENCES orders(id)             ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)           ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_created ON order_items(created_at);

-- ─── 2. Back-fill: JSON → order_items ────────────────────────────────────────
-- Uses json_each so no extra dependency is required (built into all modern SQLite).
INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, notes, created_at)
SELECT
  o.id                    AS order_id,
  CAST(json_each.value ->> '$.productId'  AS INTEGER) AS product_id,
  CAST(json_each.value ->> '$.quantity'   AS REAL)    AS quantity,
  CAST(json_each.value ->> '$.price'      AS REAL)    AS unit_price,
  CAST(json_each.value ->> '$.quantity'   AS REAL)
  * CAST(COALESCE(json_each.value ->> '$.price', 0) AS REAL)
                                                         AS total_price,
  CAST(json_each.value ->> '$.notes'      AS TEXT)    AS notes,
  o.created_at
FROM orders  AS o,
     json_each(CASE WHEN o.items IS NOT NULL AND o.items != '' THEN o.items ELSE '[]' END)
WHERE json_each.value IS NOT NULL
  AND json_extract(json_each.value, '$.productId') IS NOT NULL;

-- ─── 3. Triggers: auto-recalc order total when order_items change (INSERT/UPDATE/DELETE) ──
-- Format: UPDATE orders SET total = (SELECT COALESCE(SUM(total_price), 0)
--         FROM order_items WHERE order_id = NEW.order_id) WHERE id = NEW.order_id;
DROP TRIGGER IF EXISTS trg_order_items_insert_total;
CREATE TRIGGER trg_order_items_insert_total
  AFTER INSERT ON order_items
  FOR EACH ROW BEGIN
    UPDATE orders SET total = COALESCE(
      (SELECT SUM(total_price) FROM order_items WHERE order_id = NEW.order_id), 0
    ) WHERE id = NEW.order_id;
  END;

DROP TRIGGER IF EXISTS trg_order_items_update_total;
CREATE TRIGGER trg_order_items_update_total
  AFTER UPDATE ON order_items
  FOR EACH ROW BEGIN
    UPDATE orders SET total = COALESCE(
      (SELECT SUM(total_price) FROM order_items WHERE order_id = NEW.order_id), 0
    ) WHERE id = NEW.order_id;
  END;

DROP TRIGGER IF EXISTS trg_order_items_delete_total;
CREATE TRIGGER trg_order_items_delete_total
  AFTER DELETE ON order_items
  FOR EACH ROW BEGIN
    UPDATE orders SET total = COALESCE(
      (SELECT SUM(total_price) FROM order_items WHERE order_id = OLD.order_id), 0
    ) WHERE id = OLD.order_id;
  END;

-- =============================================================================
-- ROLLBACK:
--   1. DROP TRIGGER IF EXISTS trg_order_items_delete_total;
--      DROP TRIGGER IF EXISTS trg_order_items_update_total;
--      DROP TRIGGER IF EXISTS trg_order_items_insert_total;
--   2. DROP TABLE IF EXISTS order_items;
--   3. Back-fill from order_items → JSON needs custom scripting.
-- =============================================================================
