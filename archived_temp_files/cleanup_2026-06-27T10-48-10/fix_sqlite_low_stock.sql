-- Fix low_stock_threshold default in SQLite
-- Update all existing products to have low_stock_threshold = 0

UPDATE products 
SET low_stock_threshold = 0
WHERE low_stock_threshold = 5;

-- Verify
SELECT name, low_stock_threshold 
FROM products 
ORDER BY created_at DESC;