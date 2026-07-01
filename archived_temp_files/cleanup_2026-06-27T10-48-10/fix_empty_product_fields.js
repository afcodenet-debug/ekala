/**
 * Fix products with empty fields in SQLite database
 * This script fills in missing values for: sku, minimum_stock, price, cost_price, low_stock_threshold
 * 
 * SQLite is the source of truth - this script only touches data/database.db
 */

const Database = require('better-sqlite3');
const path = require('path');

// Path to SQLite database (source of truth)
const DB_PATH = path.resolve(process.cwd(), 'data', 'database.db');

console.log('🔧 Fixing empty product fields in SQLite database...');
console.log('Database path:', DB_PATH);

try {
  const db = new Database(DB_PATH);
  
  // Check if products table exists
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").all();
  if (tables.length === 0) {
    console.log('⚠️  Products table does not exist. Skipping.');
    db.close();
    process.exit(0);
  }
  
  // Check current schema
  const tableInfo = db.pragma('table_info(products)');
  const columns = tableInfo.map(col => col.name);
  console.log('📋 Products table columns:', columns.join(', '));
  
  // Check if low_stock_threshold column exists
  if (!columns.includes('low_stock_threshold')) {
    console.log('📝 Adding low_stock_threshold column...');
    db.exec('ALTER TABLE products ADD COLUMN low_stock_threshold INTEGER DEFAULT 5');
    console.log('✅ Column added');
  }
  
  // Find products with empty/null fields
  const emptyProducts = db.prepare(`
    SELECT id, name, sku, price, cost_price, minimum_stock, low_stock_threshold
    FROM products
    WHERE sku IS NULL OR sku = ''
       OR price IS NULL OR price = 0
       OR cost_price IS NULL OR cost_price = 0
       OR minimum_stock IS NULL OR minimum_stock = 0
       OR low_stock_threshold IS NULL OR low_stock_threshold = 0
  `).all();
  
  console.log(`\n📊 Found ${emptyProducts.length} products with empty/missing fields`);
  
  if (emptyProducts.length === 0) {
    console.log('✅ All products have valid field values!');
    db.close();
    process.exit(0);
  }
  
  // Fix each product
  const updateStmt = db.prepare(`
    UPDATE products
    SET 
      sku = COALESCE(NULLIF(sku, ''), ?),
      price = COALESCE(NULLIF(price, 0), ?),
      cost_price = COALESCE(NULLIF(cost_price, 0), ?),
      minimum_stock = COALESCE(NULLIF(minimum_stock, 0), ?),
      low_stock_threshold = COALESCE(NULLIF(low_stock_threshold, 0), ?)
    WHERE id = ?
  `);
  
  let fixedCount = 0;
  
  emptyProducts.forEach((product, index) => {
    // Generate SKU if missing
    let sku = product.sku;
    if (!sku || sku === '') {
      const namePart = product.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 4);
      const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      sku = `${namePart}${randomPart}`.substring(0, 8);
    }
    
    // Use defaults for missing values
    const price = product.price || 0;
    const costPrice = product.cost_price || 0;
    const minimumStock = product.minimum_stock || 5;
    const lowStockThreshold = product.low_stock_threshold || 5;
    
    const result = updateStmt.run(sku, price, costPrice, minimumStock, lowStockThreshold, product.id);
    
    if (result.changes > 0) {
      fixedCount++;
      console.log(`  ✓ Fixed: ${product.name} (ID: ${product.id})`);
      console.log(`    - SKU: ${sku}`);
      console.log(`    - Price: ${price}, Cost: ${costPrice}`);
      console.log(`    - Min Stock: ${minimumStock}, Low Stock Threshold: ${lowStockThreshold}`);
    }
  });
  
  console.log(`\n✅ Fixed ${fixedCount} products successfully!`);
  
  // Verify the fixes
  const remaining = db.prepare(`
    SELECT COUNT(*) as count
    FROM products
    WHERE sku IS NULL OR sku = ''
       OR price IS NULL OR price = 0
       OR cost_price IS NULL OR cost_price = 0
       OR minimum_stock IS NULL OR minimum_stock = 0
       OR low_stock_threshold IS NULL OR low_stock_threshold = 0
  `).get().count;
  
  if (remaining > 0) {
    console.log(`⚠️  Warning: ${remaining} products still have empty fields`);
  } else {
    console.log('✅ Verification: All products now have valid field values!');
  }
  
  db.close();
  console.log('\n✅ Database fix complete!');
  console.log('You can now restart your app and verify the products.');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}