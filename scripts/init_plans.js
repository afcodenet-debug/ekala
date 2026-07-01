const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'database.db');
const db = new Database(dbPath);

console.log('Creating plans table...');

db.exec(`
  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'ZMW',
    period TEXT DEFAULT 'monthly',
    duration_days INTEGER DEFAULT 30,
    max_users INTEGER DEFAULT 1,
    max_branches INTEGER DEFAULT 1,
    max_products INTEGER DEFAULT 100,
    max_orders_per_month INTEGER DEFAULT 1000,
    features TEXT DEFAULT '[]',
    is_active INTEGER DEFAULT 1,
    is_public INTEGER DEFAULT 1,
    trial_days INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

console.log('✓ Table plans created');

// Insert default plans
const insert = db.prepare(`
  INSERT OR IGNORE INTO plans 
    (code, name, description, price_cents, currency, period, duration_days, 
     max_users, max_branches, max_products, max_orders_per_month, 
     features, is_active, is_public, trial_days, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
`);

const plans = [
  ['trial', 'Essai Gratuit', 'Période d\'essai gratuite', 0, 'ZMW', 'monthly', 14, 1, 1, 50, 100, '[]', 14, 0],
  ['starter_weekly', 'Starter Hebdo', 'Plan starter hebdomadaire', 4900, 'ZMW', 'weekly', 7, 2, 1, 100, 500, '[]', 0, 1],
  ['starter_monthly', 'Starter Mensuel', 'Plan starter mensuel', 14900, 'ZMW', 'monthly', 30, 3, 1, 200, 1000, '[]', 0, 2],
  ['pro_monthly', 'Pro Mensuel', 'Plan professionnel mensuel', 34900, 'ZMW', 'monthly', 30, 10, 3, 1000, 5000, '[]', 0, 3],
  ['starter_yearly', 'Starter Annuel', 'Plan starter annuel', 149000, 'ZMW', 'yearly', 365, 3, 1, 200, 1000, '[]', 0, 4],
  ['pro_yearly', 'Pro Annuel', 'Plan professionnel annuel', 349000, 'ZMW', 'yearly', 365, 10, 3, 1000, 5000, '[]', 0, 5]
];

const tx = db.transaction(() => {
  for (const plan of plans) {
    insert.run(...plan);
    console.log(`  ✓ Inserted plan: ${plan[1]}`);
  }
});

tx();
console.log('✓ All plans inserted');

// Verify
const count = db.prepare('SELECT COUNT(*) as count FROM plans').get().count;
console.log(`\nTotal plans in database: ${count}`);

const allPlans = db.prepare('SELECT id, code, name, price_cents, period FROM plans ORDER BY sort_order').all();
console.log('\nPlans:');
allPlans.forEach(p => {
  console.log(`  ${p.id}. ${p.name} (${p.code}) - ${p.price_cents} ${p.currency}/${p.period}`);
});

db.close();
console.log('\n✓ Done!');