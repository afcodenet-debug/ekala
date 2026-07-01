const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'database.db');

console.log('=== QUICK DIAGNOSTIC ===\n');

try {
  const db = new Database(dbPath, { readonly: true });
  
  // 1. Check table exists
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='plans'").all();
  console.log('1. Table "plans" exists:', tables.length > 0);
  
  if (tables.length > 0) {
    // 2. Get all columns
    const schema = db.prepare("PRAGMA table_info(plans)").all();
    const columns = schema.map(c => c.name);
    console.log('\n2. Columns:', columns.join(', '));
    
    // 3. Check required columns
    const required = ['id', 'code', 'name', 'description', 'price_cents', 'currency', 'period', 'duration_days', 'max_users', 'max_branches', 'max_products', 'max_orders_per_month', 'features', 'is_active', 'is_public', 'trial_days', 'sort_order'];
    const missing = required.filter(col => !columns.includes(col));
    console.log('\n3. Missing columns:', missing.length > 0 ? missing.join(', ') : 'None');
    
    // 4. Try the exact query from billing.routes.ts
    console.log('\n4. Testing query...');
    try {
      const plans = db.prepare(`
        SELECT id, code, name, description, price_cents, currency, period, duration_days,
               max_users, max_branches, max_products, max_orders_per_month, features,
               is_active, is_public, trial_days, sort_order
        FROM plans
        WHERE is_active = 1 AND is_public = 1
        ORDER BY sort_order ASC, id ASC
      `).all();
      console.log(`   ✓ Query successful: ${plans.length} plans found`);
    } catch (e) {
      console.log(`   ✗ Query failed: ${e.message}`);
    }
  }
  
  db.close();
} catch (e) {
  console.log('ERROR:', e.message);
}