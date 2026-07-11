-- =============================================================================
-- FIX: order_items.updated_at (enable generic pull to detect item updates)
-- =============================================================================
-- Symptom: order sync diverged from products/users. The generic sync engine
-- pulls every entity with an `updated_at` cursor. `order_items` had NO
-- `updated_at` column (only `created_at`), so its pull used `created_at`, which
-- never changes when a QR-order item is edited — meaning modified items were
-- never re-synced from Supabase → SQLite.
--
-- Fix: add `updated_at` (with the same set_timestamp trigger used by `orders`)
-- so order_item behaves like every other synced entity. Backfills existing rows
-- with NOW().
-- =============================================================================

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Drop a pre-existing trigger with the same name if it exists, then recreate.
DROP TRIGGER IF EXISTS trg_order_items_updated_at ON public.order_items;

CREATE TRIGGER trg_order_items_updated_at
  BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- Index to keep the incremental pull (WHERE updated_at > cursor) fast.
CREATE INDEX IF NOT EXISTS idx_order_items_updated_at
  ON public.order_items (updated_at);
