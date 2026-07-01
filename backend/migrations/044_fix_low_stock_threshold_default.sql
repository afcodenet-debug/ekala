-- Fix low_stock_threshold default value from 5 to 0
-- This ensures new products have 0 as default instead of 5

-- Update the default value for low_stock_threshold column
ALTER TABLE products 
  ALTER COLUMN low_stock_threshold SET DEFAULT 0;

-- Verify the change
SELECT column_name, column_default 
FROM information_schema.columns 
WHERE table_name = 'products' 
  AND column_name = 'low_stock_threshold';