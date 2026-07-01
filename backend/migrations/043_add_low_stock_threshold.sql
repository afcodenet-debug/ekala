-- Add low_stock_threshold column to products table
-- This fixes the error: "Could not find the 'low_stock_threshold' column of 'products' in the schema cache"

-- Add the column with a default value of 5
ALTER TABLE products ADD COLUMN low_stock_threshold INTEGER DEFAULT 5;

-- Update existing products to have a default value if they don't have one
UPDATE products SET low_stock_threshold = 5 WHERE low_stock_threshold IS NULL;
