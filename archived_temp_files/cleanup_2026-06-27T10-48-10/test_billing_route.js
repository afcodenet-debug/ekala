const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'database.db');
const db = new Database(dbPath);

console.log('=== Testing billing.routes.ts query ===\n');

try {
  console.log('Executing exact query from billing.routes.ts line 9-16...');
  
  const plans = db.prepare(`
    SELECT id, code, name, description, price_cents, currency, period, duration_days,
           max_users, max_branches, max_products, max_orders_per_month, features,
           is_active, is_public, trial_days, sort_order
    FROM plans
    WHERE is_active = 1 AND is_public = 1
    ORDER BY sort_order ASC, id ASC
  `).all();

  console.log(`✓ SUCCESS: Found ${plans.length} plans`);
  console.log('\nPlans:');
  plans.forEach(p => {
    console.log(`  - ${p.id}: ${p.name} (${p.code}) - ${p.price_cents} ${p.currency}/${p.period}`);
  });

} catch (error) {
  console.log(`✗ FAILED: ${error.message}`);
  console.log('\nFull error:');
  console.log(error);
  
  // Try simpler query
  console.log('\n\nTrying simpler query...');
  try {
    const simple = db.prepare('SELECT * FROM plans LIMIT 1').get();
    console.log('Simple query works:', simple);
  } catch (e) {
    console.log('Simple query also fails:', e.message);
  }
}

db.close();