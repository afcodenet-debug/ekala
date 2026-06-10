-- ============================================================================
-- SUPABASE RUNTIME MIGRATION
-- ============================================================================
-- Run this in the Supabase SQL Editor if your project was created with the
-- original supabase_migration.sql and the sync engine reports errors like
--   "Could not find the 'business_id' column of 'restaurant_tables'"
--   "Could not find the 'remote_id' column of 'restaurant_tables'"
--   or upserts silently failing for newly created tables.
--
-- This file is safe to re-run (idempotent). Uses DO blocks instead of
-- "IF NOT EXISTS" on ALTER TABLE (portable across PostgreSQL versions).
-- ============================================================================

BEGIN;

-- 1) Add remote_id + business_id + tenant_id to restaurant_tables if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'restaurant_tables'
      AND column_name = 'remote_id'
  ) THEN
    ALTER TABLE restaurant_tables ADD COLUMN remote_id BIGINT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'restaurant_tables'
      AND column_name = 'business_id'
  ) THEN
    ALTER TABLE restaurant_tables ADD COLUMN business_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'restaurant_tables'
      AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE restaurant_tables ADD COLUMN tenant_id TEXT;
  END IF;
END
$$;

-- Set tenant_id = '5' for existing rows where tenant_id is NULL
UPDATE restaurant_tables SET tenant_id = '5' WHERE tenant_id IS NULL;

-- 2) Add remote_id + updated_at + tenant_id to categories if missing (for sync engine)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'categories'
      AND column_name = 'remote_id'
  ) THEN
    ALTER TABLE categories ADD COLUMN remote_id BIGINT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'categories'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE categories ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'categories'
      AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE categories ADD COLUMN tenant_id TEXT;
  END IF;
END
$$;

-- Set tenant_id = '5' for existing rows where tenant_id is NULL
UPDATE categories SET tenant_id = '5' WHERE tenant_id IS NULL;

-- 3) Helpful indexes (CREATE INDEX IF NOT EXISTS is supported by PostgreSQL 9.5+)
CREATE INDEX IF NOT EXISTS idx_tables_remote_id
  ON restaurant_tables(remote_id)
  WHERE remote_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tables_business_id
  ON restaurant_tables(business_id)
  WHERE business_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_categories_remote_id
  ON categories(remote_id)
  WHERE remote_id IS NOT NULL;

-- 4) Defensive: ensure orders.remote_id + tenant_id exists (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'remote_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN remote_id BIGINT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN tenant_id TEXT;
  END IF;
END
$$;

-- Set tenant_id = '5' for existing rows where tenant_id is NULL
UPDATE orders SET tenant_id = '5' WHERE tenant_id IS NULL;

-- 5) Add tenant_id to products if missing (for sync engine)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE products ADD COLUMN tenant_id TEXT;
  END IF;
END
$$;

-- Set tenant_id = '5' for existing rows where tenant_id is NULL
UPDATE products SET tenant_id = '5' WHERE tenant_id IS NULL;

-- 6) Add tenant_id to users, tenants, tenant_users if missing (for sync engine)
-- Note: users table in Supabase uses Supabase Auth, so we only add tenant_id
-- The business_id column is only for tenants and tenant_users tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE users ADD COLUMN tenant_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE tenants ADD COLUMN tenant_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenant_users'
      AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE tenant_users ADD COLUMN tenant_id TEXT;
  END IF;
END
$$;

-- Set tenant_id = '5' for existing rows where tenant_id is NULL
UPDATE users SET tenant_id = '5' WHERE tenant_id IS NULL AND id IN (SELECT id FROM users LIMIT 100);
UPDATE tenants SET tenant_id = '5' WHERE tenant_id IS NULL;
UPDATE tenant_users SET tenant_id = '5' WHERE tenant_id IS NULL;

-- 7) The Supabase CHECK for status is:
--    CHECK (status IN ('available','occupied','cleaning','reserved'))
--    The local app uses 'active' (mapped to 'occupied') and 'out_of_service'
--    (mapped to 'available'). No CHECK change is required.

-- 5) Allow service_role to bypass RLS for sync operations.
--    The service_role key (used by the backend) automatically bypasses RLS.
--    If you have RLS enabled and use the anon key, you would need a policy.
--    Since the sync engine uses service_role, no policy change is required.

COMMIT;

-- Verification (run separately if you want to confirm)
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'restaurant_tables'
-- ORDER BY ordinal_position;
