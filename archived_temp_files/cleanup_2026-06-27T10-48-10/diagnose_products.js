/**
 * Diagnostic script to check products in SQLite database
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'database.db');

console.log('🔍 Diagnosing products in SQLite...\n');

try {
  const db = new Database(DB_PATH);
  
  // 1. Count total products
  const totalCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  console.log(`📊 Total products in DB: ${totalCount}`);
  
  // 2. Get all products with their tenant_id
  const products = db.prepare(`
    SELECT id, name, tenant_id, business_id, low_stock_threshold, created_at
    FROM products
    ORDER BY created_at DESC
  `).all();
  
  console.log('\n📋 All products:');
  products.forEach((p, i) => {
    console.log(`\n${i + 1}. ${p.name}`);
    console.log(`   ID: ${p.id}`);
    console.log(`   tenant_id: ${p.tenant_id || 'NULL'}`);
    console.log(`   business_id: ${p.business_id || 'NULL'}`);
    console.log(`   low_stock_threshold: ${p.low_stock_threshold}`);
    console.log(`   created_at: ${p.created_at}`);
  });
  
  // 3. Check distinct tenant_ids
  const tenantIds = db.prepare(`
    SELECT DISTINCT tenant_id, COUNT(*) as count
    FROM products
    WHERE tenant_id IS NOT NULL
    GROUP BY tenant_id
  `).all();
  
  console.log('\n👥 Products by tenant_id:');
  tenantIds.forEach(t => {
    console.log(`   tenant_id: ${t.tenant_id} → ${t.count} products`);
  });
  
  // 4. Check for NULL tenant_ids
  const nullTenants = db.prepare(`
    SELECT COUNT(*) as count FROM products WHERE tenant_id IS NULL
  `).get().count;
  
  console.log(`\n⚠️  Products with NULL tenant_id: ${nullTenants}`);
  
  // 5. Check the current user's tenant_id (if we can find it)
  const currentTenant = db.prepare(`
    SELECT DISTINCT tenant_id FROM products ORDER BY created_at DESC LIMIT 1
  `).get();
  
  console.log(`\n🔑 Most recent product tenant_id: ${currentTenant?.tenant_id || 'N/A'}`);
  
  // 6. Test the query that the repository uses
  console.log('\n🧪 Testing repository query (findAll with businessId):');
  const testBusinessId = currentTenant?.tenant_id || '1';
  
  const repoResults = db.prepare(`
    SELECT * FROM products
    WHERE (business_id = ? OR tenant_id = ? OR business_id IS NULL OR tenant_id IS NULL)
    ORDER BY created_at DESC
  `).all(testBusinessId, testBusinessId);
  
  console.log(`   Found ${repoResults.length} products with businessId="${testBusinessId}"`);
  
  db.close();
  
  console.log('\n✅ Diagnostic complete');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
}