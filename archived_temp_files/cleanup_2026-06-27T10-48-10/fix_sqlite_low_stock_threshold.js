/**
 * Fix SQLite database - Add missing low_stock_threshold column to products table
 * Run this script if you get: "Could not find the 'low_stock_threshold' column of 'products'"
 */

const Database = require('better-sqlite3');
const path = require('path');

// Path to SQLite database (from .env comment: data/database.db)
const DB_PATH = path.resolve(process.cwd(), 'data', 'database.db');

console.log('🔧 Fixing SQLite database: Adding low_stock_threshold column...');
console.log('Database path:', DB_PATH);

try {
  const db = new Database(DB_PATH);
  
  // Check if column already exists
  const tableInfo = db.pragma('table_info(products)');
  const hasColumn = tableInfo.some(col => col.name === 'low_stock_threshold');
  
  if (hasColumn) {
    console.log('✅ Column low_stock_threshold already exists');
    db.close();
    process.exit(0);
  }
  
  console.log('📝 Adding low_stock_threshold column...');
  
  // Add the column with default value
  db.exec('ALTER TABLE products ADD COLUMN low_stock_threshold INTEGER DEFAULT 5');
  
  // Update existing products to have default value
  const result = db.exec('UPDATE products SET low_stock_threshold = 5 WHERE low_stock_threshold IS NULL');
  
  console.log('✅ Column added successfully');
  console.log('✅ Updated', result[0]?.changes || 0, 'products with default value');
  
  // Verify
  const verify = db.pragma('table_info(products)');
  const column = verify.find(col => col.name === 'low_stock_threshold');
  console.log('✅ Verification:', column ? 'Column exists' : 'ERROR: Column not found');
  
  db.close();
  console.log('✅ Database fix complete!');
  console.log('');
  console.log('You can now restart your app and try creating a product again.');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}