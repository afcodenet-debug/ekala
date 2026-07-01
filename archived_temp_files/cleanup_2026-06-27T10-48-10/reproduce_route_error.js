const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'database.db');
const db = new Database(dbPath);

console.log('=== Reproducing exact route logic ===\n');

try {
  console.log('Step 1: Executing query from billing.routes.ts lines 9-16...');
  
  const query = `
    SELECT id, code, name, description, price_cents, currency, period, duration_days,
           max_users, max_branches, max_products, max_orders_per_month, features,
           is_active, is_public, trial_days, sort_order
    FROM plans
    WHERE is_active = 1 AND is_public = 1
    ORDER BY sort_order ASC, id ASC
  `;
  
  console.log('Query:', query.replace(/\s+/g, ' ').trim());
  console.log('\nExecuting...');
  
  const plans = db.prepare(query).all();
  
  console.log(`✓ SUCCESS: Got ${plans.length} plans`);
  console.log('\nFirst plan:', plans[0] || 'None');
  
  // Try to JSON serialize like the route does
  console.log('\nStep 2: JSON serialization...');
  try {
    const json = JSON.stringify({ success: true, plans });
    console.log('✓ JSON serialization OK');
  } catch (e) {
    console.log('✗ JSON serialization FAILED:', e.message);
  }
  
} catch (error) {
  console.log(`✗ FAILED at step 1`);
  console.log('Error message:', error.message);
  console.log('\nFull error:');
  console.log(error);
  
  // Try to get more info
  console.log('\n\nDebugging:');
  console.log('1. Checking if table exists...');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='plans'").all();
  console.log('   Table exists:', tables.length > 0);
  
  if (tables.length > 0) {
    console.log('\n2. Checking columns...');
    const schema = db.prepare("PRAGMA table_info(plans)").all();
    console.log('   Columns:', schema.map(c => c.name).join(', '));
    
    console.log('\n3. Trying SELECT *...');
    try {
      const all = db.prepare('SELECT * FROM plans').all();
      console.log(`   ✓ SELECT * works: ${all.length} rows`);
    } catch (e) {
      console.log('   ✗ SELECT * failed:', e.message);
    }
  }
}

db.close();