-- Supabase/PostgreSQL Migration
-- Add low_stock_threshold column to products table
-- This fixes the error: "Could not find the 'low_stock_threshold' column of 'products' in the schema cache"

-- Add the column with a default value of 5
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 5;

-- Update existing products to have a default value if they don't have one
UPDATE products SET low_stock_threshold = 5 WHERE low_stock_threshold IS NULL;

-- Add a comment to document the column
COMMENT ON COLUMN products.low_stock_threshold IS 'Minimum stock level before product is considered low stock. Alerts are triggered when stock_quantity <= low_stock_threshold.';

-- Create an index for faster low-stock queries
CREATE INDEX IF NOT EXISTS idx_products_low_stock 
ON products(tenant_id, stock_quantity, low_stock_threshold) 
WHERE is_available = true;