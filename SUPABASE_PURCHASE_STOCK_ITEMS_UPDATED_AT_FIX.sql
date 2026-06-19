-- =============================================================================
-- SUPABASE_PURCHASE_STOCK_ITEMS_UPDATED_AT_FIX.sql
-- Adds missing updated_at columns required by the sync engine:
--   - purchase_order_items.updated_at
--   - stock_adjustment_items.updated_at
--
-- Also ensures created_at exists (used as fallback by the sync engine).
-- Idempotent: safe to re-run.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- purchase_order_items
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='purchase_order_items'
      AND column_name='updated_at'
  ) THEN
    ALTER TABLE purchase_order_items ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='purchase_order_items'
      AND column_name='created_at'
  ) THEN
    ALTER TABLE purchase_order_items ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END
$$;

-- Tenant scoping column is not strictly required for this specific error,
-- but many parts of the sync expect tenant_id to exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='purchase_order_items'
      AND column_name='tenant_id'
  ) THEN
    ALTER TABLE purchase_order_items ADD COLUMN tenant_id INTEGER;
  END IF;
END
$$;

-- Backfill tenant_id if it's NULL (best-effort default)
UPDATE purchase_order_items
SET tenant_id = COALESCE(tenant_id, 1)
WHERE tenant_id IS NULL;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_tenant_id_updated_at
  ON purchase_order_items(tenant_id, updated_at)
  WHERE updated_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_updated_at
  ON purchase_order_items(updated_at)
  WHERE updated_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- stock_adjustment_items
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='stock_adjustment_items'
      AND column_name='updated_at'
  ) THEN
    ALTER TABLE stock_adjustment_items ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='stock_adjustment_items'
      AND column_name='created_at'
  ) THEN
    ALTER TABLE stock_adjustment_items ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='stock_adjustment_items'
      AND column_name='tenant_id'
  ) THEN
    ALTER TABLE stock_adjustment_items ADD COLUMN tenant_id INTEGER;
  END IF;
END
$$;

UPDATE stock_adjustment_items
SET tenant_id = COALESCE(tenant_id, 5)
WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_stock_adjustment_items_tenant_id_updated_at
  ON stock_adjustment_items(tenant_id, updated_at)
  WHERE updated_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_adjustment_items_updated_at
  ON stock_adjustment_items(updated_at)
  WHERE updated_at IS NOT NULL;

COMMIT;
