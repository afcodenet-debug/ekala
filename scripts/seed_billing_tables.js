const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'backend', 'database.sqlite');
const db = new Database(dbPath);

console.log('🌱 Création des tables billing...\n');

try {
  // Create subscriptions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      plan_id INTEGER,
      status TEXT DEFAULT 'trial',
      current_period_start TEXT,
      current_period_end TEXT,
      trial_ends_at TEXT,
      started_at TEXT DEFAULT CURRENT_TIMESTAMP,
      ended_at TEXT,
      last_voucher_code TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Table "subscriptions" créée');

  // Create voucher_requests table
  db.exec(`
    CREATE TABLE IF NOT EXISTS voucher_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      plan_id INTEGER NOT NULL,
      voucher_code TEXT UNIQUE NOT NULL,
      customer_email TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      requested_at TEXT DEFAULT CURRENT_TIMESTAMP,
      verification_deadline TEXT,
      expires_at TEXT,
      verified_at TEXT,
      verified_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Table "voucher_requests" créée');

  // Create payment_history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      date TEXT DEFAULT CURRENT_TIMESTAMP,
      amount_cents INTEGER NOT NULL,
      currency TEXT DEFAULT 'ZMW',
      method TEXT DEFAULT 'voucher',
      status TEXT DEFAULT 'completed',
      invoice_number TEXT UNIQUE,
      voucher_code TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Table "payment_history" créée');

  // Create indexes
  db.exec('CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_voucher_requests_tenant ON voucher_requests(tenant_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_voucher_requests_code ON voucher_requests(voucher_code)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_payment_history_tenant ON payment_history(tenant_id)');
  console.log('✅ Indexes créés');

  console.log('\n🎉 Toutes les tables billing sont prêtes!\n');

} catch (error) {
  console.error('❌ Erreur:', error.message);
  process.exit(1);
} finally {
  db.close();
}