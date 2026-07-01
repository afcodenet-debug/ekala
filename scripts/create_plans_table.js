const Database = require('better-sqlite3');
const db = new Database('data/database.db');

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

console.log('Table plans créée avec succès');

// Insert default plans if not exists
const insert = db.prepare(`
  INSERT OR IGNORE INTO plans (code, name, description, price_cents, period, duration_days, max_users, max_branches, max_products, max_orders_per_month, features, is_active, is_public, trial_days, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
`);

const plans = [
  ['trial', 'Essai Gratuit', 'Période d\'essai gratuite', 0, 'monthly', 14, 1, 1, 50, 100, '[]', 14, 0],
  ['starter_weekly', 'Starter Hebdo', 'Plan starter hebdomadaire', 4900, 'weekly', 7, 2, 1, 100, 500, '[]', 0, 1],
  ['starter_monthly', 'Starter Mensuel', 'Plan starter mensuel', 14900, 'monthly', 30, 3, 1, 200, 1000, '[]', 0, 2],
  ['pro_monthly', 'Pro Mensuel', 'Plan professionnel mensuel', 34900, 'monthly', 30, 10, 3, 1000, 5000, '[]', 0, 3],
  ['starter_yearly', 'Starter Annuel', 'Plan starter annuel', 149000, 'yearly', 365, 3, 1, 200, 1000, '[]', 0, 4],
  ['pro_yearly', 'Pro Annuel', 'Plan professionnel annuel', 349000, 'yearly', 365, 10, 3, 1000, 5000, '[]', 0, 5]
];

const tx = db.transaction(() => {
  for (const plan of plans) {
    insert.run(...plan);
  }
});

tx();
console.log('Plans par défaut insérés');

db.close();