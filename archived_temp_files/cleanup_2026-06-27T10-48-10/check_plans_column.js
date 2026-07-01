const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'database.db');
const db = new Database(dbPath);

console.log('=== Checking plans table columns ===\n');

// Get table info
const schema = db.prepare("PRAGMA table_info(plans)").all();
console.log('Columns in plans table:');
schema.forEach(col => {
  console.log(`  ${col.name} (${col.type})`);
});

// Check if all required columns exist
const requiredColumns = [
  'id', 'code', 'name', 'description', 'price_cents', 'currency', 'period',
  'duration_days', 'max_users', 'max_branches', 'max_products', 
  'max_orders_per_month', 'features', 'is_active', 'is_public', 
  'trial_days', 'sort_order', 'created_at', 'updated_at'
];

console.log('\nRequired columns check:');
requiredColumns.forEach(col => {
  const exists = schema.some(c => c.name === col);
  console.log(`  ${exists ? '✓' : '✗'} ${col}`);
});

// Try to select all columns
console.log('\nTrying SELECT * FROM plans LIMIT 1...');
try {
  const plan = db.prepare('SELECT * FROM plans LIMIT 1').get();
  console.log('✓ SUCCESS');
  console.log('Plan:', plan);
} catch (e) {
  console.log('✗ FAILED:', e.message);
}

db.close();