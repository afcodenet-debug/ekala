-- =============================================================================
-- Supabase Migration: Add unique constraint on (tenant_id, name) for products
-- =============================================================================
-- Ensures a tenant cannot have two products with the same name (soft-delete aware)
-- =============================================================================

-- First, clean up any existing duplicates (keep the first one, mark others)
-- This is a safety measure before adding the constraint
DELETE FROM products
WHERE id IN (
  SELECT p1.id FROM products p1
  INNER JOIN products p2 ON p1.tenant_id = p2.tenant_id AND p1.name = p2.name AND p1.id > p2.id
  WHERE p1.deleted_at IS NULL AND p2.deleted_at IS NULL
);

-- Add unique partial index (same pattern as SQLite)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_tenant_name
ON products(tenant_id, name)
WHERE deleted_at IS NULL;

-- Also ensure SKU uniqueness per tenant (matching SQLite)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_tenant_sku
ON products(tenant_id, sku)
WHERE sku IS NOT NULL AND sku != '' AND deleted_at IS NULL;
