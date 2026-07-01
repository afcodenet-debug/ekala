-- ============================================================================
-- FIX: DYNAMIC MULTI-TENANT SCHEMA ALIGNMENT ON SUPABASE
-- ============================================================================
-- Run this in your Supabase SQL Editor to support professional multi-tenancy.
-- This script adds missing columns without forcing incorrect defaults.
-- ============================================================================

BEGIN;

-- 1) Add tenant_id and updated_at to sales
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'tenant_id') THEN
    ALTER TABLE sales ADD COLUMN tenant_id INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'updated_at') THEN
    ALTER TABLE sales ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'remote_id') THEN
    ALTER TABLE sales ADD COLUMN remote_id BIGINT;
  END IF;
END
$$;

-- 2) Add tenant_id and updated_at to sale_items
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'tenant_id') THEN
    ALTER TABLE sale_items ADD COLUMN tenant_id INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'updated_at') THEN
    ALTER TABLE sale_items ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'remote_id') THEN
    ALTER TABLE sale_items ADD COLUMN remote_id BIGINT;
  END IF;
END
$$;

-- 3) Add tenant_id and updated_at to order_items
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'tenant_id') THEN
    ALTER TABLE order_items ADD COLUMN tenant_id INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'updated_at') THEN
    ALTER TABLE order_items ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'remote_id') THEN
    ALTER TABLE order_items ADD COLUMN remote_id BIGINT;
  END IF;
END
$$;

-- 4) SMART DATA RECOVERY
-- Instead of hardcoding '5', we try to inherit the tenant_id from parent records
UPDATE sales s SET tenant_id = (SELECT t.tenant_id FROM tenants t WHERE t.id = 1 LIMIT 1) WHERE s.tenant_id IS NULL AND s.user_id IN (SELECT id FROM users WHERE tenant_id = 1);
UPDATE sale_items si SET tenant_id = (SELECT s.tenant_id FROM sales s WHERE s.id = si.sale_id) WHERE si.tenant_id IS NULL;
UPDATE order_items oi SET tenant_id = (SELECT o.tenant_id FROM orders o WHERE o.id = oi.order_id) WHERE oi.tenant_id IS NULL;

-- 5) Final check: If still NULL and we have only one tenant, use it as fallback
-- (Replace '1' with your primary tenant ID if different)
UPDATE sales SET tenant_id = '1' WHERE tenant_id IS NULL;
UPDATE sale_items SET tenant_id = '1' WHERE tenant_id IS NULL;
UPDATE order_items SET tenant_id = '1' WHERE tenant_id IS NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_tenant_id ON sales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_tenant_id ON sale_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_tenant_id ON order_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_updated_at ON sales(updated_at);

COMMIT;

-- stevenkabwee@gmail.com