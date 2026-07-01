const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'database.db');

console.log('=== FULL DIAGNOSTIC ===\n');

try {
  const db = new Database(dbPath, { readonly: true });
  
  // 1. Check database
  console.log('1. Database connection: OK');
  
  // 2. Check table exists
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='plans'").all();
  console.log('2. Table "plans" exists:', tables.length > 0);
  
  if (tables.length === 0) {
    console.log('\n❌ PROBLEM: Table does not exist!');
    console.log('   Solution: Run: node scripts/init_plans.js');
    db.close();
    process.exit(1);
  }
  
  // 3. Get schema
  const schema = db.prepare("PRAGMA table_info(plans)").all();
  const columns = schema.map(c => c.name);
  console.log('3. Columns:', columns.join(', '));
  
  // 4. Check required columns
  const required = ['id', 'code', 'name', 'description', 'price_cents', 'currency', 'period', 'duration_days', 'max_users', 'max_branches', 'max_products', 'max_orders_per_month', 'features', 'is_active', 'is_public', 'trial_days', 'sort_order'];
  const missing = required.filter(col => !columns.includes(col));
  
  if (missing.length > 0) {
    console.log('\n❌ PROBLEM: Missing columns:', missing.join(', '));
    db.close();
    process.exit(1);
  }
  console.log('4. All required columns: OK');
  
  // 5. Count records
  const count = db.prepare('SELECT COUNT(*) as count FROM plans').get().count;
  console.log('5. Records count:', count);
  
  if (count === 0) {
    console.log('\n⚠️  WARNING: No plans in database');
    console.log('   Solution: Run: node scripts/init_plans.js');
  }
  
  // 6. Test the exact query from billing.routes.ts
  console.log('\n6. Testing route query...');
  try {
    const plans = db.prepare(`
      SELECT id, code, name, description, price_cents, currency, period, duration_days,
             max_users, max_branches, max_products, max_orders_per_month, features,
             is_active, is_public, trial_days, sort_order
      FROM plans
      WHERE is_active = 1 AND is_public = 1
      ORDER BY sort_order ASC, id ASC
    `).all();
    
    console.log(`   ✓ Query successful: ${plans.length} plans`);
    
    if (plans.length > 0) {
      console.log('\n   Plans:');
      plans.forEach(p => {
        console.log(`   - ${p.name} (${p.code}): ${p.price_cents} ${p.currency}/${p.period}`);
      });
    }
    
    // 7. Test JSON serialization
    console.log('\n7. Testing JSON serialization...');
    try {
      const json = JSON.stringify({ success: true, plans });
      console.log('   ✓ JSON OK');
    } catch (e) {
      console.log('   ❌ JSON FAILED:', e.message);
      console.log('   This might be due to circular references or special characters');
    }
    
  } catch (e) {
    console.log('   ❌ Query FAILED:', e.message);
    console.log('\n   Full error:');
    console.log(e);
    db.close();
    process.exit(1);
  }
  
  db.close();
  
  console.log('\n✅ ALL CHECKS PASSED');
  console.log('\nIf you still get 500 error, the problem is:');
  console.log('1. Server not running');
  console.log('2. Route not mounted in server.ts');
  console.log('3. Supabase error preventing server startup');
  
} catch (e) {
  console.log('❌ ERROR:', e.message);
  process.exit(1);
}