const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'database.db');
const db = new Database(dbPath);

console.log('=== VERIFY AND FIX PLANS TABLE ===\n');

// 1. Check if table exists
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='plans'").all();
console.log('1. Table exists:', tables.length > 0);

if (tables.length > 0) {
  // 2. Get current columns
  const schema = db.prepare("PRAGMA table_info(plans)").all();
  const currentColumns = schema.map(c => c.name);
  console.log('2. Current columns:', currentColumns.join(', '));
  
  // 3. Check what's missing
  const requiredColumns = [
    'id', 'code', 'name', 'description', 'price_cents', 'currency', 'period',
    'duration_days', 'max_users', 'max_branches', 'max_products', 
    'max_orders_per_month', 'features', 'is_active', 'is_public', 
    'trial_days', 'sort_order', 'created_at', 'updated_at'
  ];
  
  const missingColumns = requiredColumns.filter(col => !currentColumns.includes(col));
  
  if (missingColumns.length > 0) {
    console.log('\n3. Missing columns:', missingColumns.join(', '));
    console.log('\n4. Adding missing columns...');
    
    // Add missing columns
    const alterQueries = {
      'created_at': 'ALTER TABLE plans ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP',
      'updated_at': 'ALTER TABLE plans ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP',
      'features': 'ALTER TABLE plans ADD COLUMN features TEXT DEFAULT \'[]\'',
      'trial_days': 'ALTER TABLE plans ADD COLUMN trial_days INTEGER DEFAULT 0',
      'sort_order': 'ALTER TABLE plans ADD COLUMN sort_order INTEGER DEFAULT 0',
      'is_public': 'ALTER TABLE plans ADD COLUMN is_public INTEGER DEFAULT 1',
      'is_active': 'ALTER TABLE plans ADD COLUMN is_active INTEGER DEFAULT 1',
      'max_orders_per_month': 'ALTER TABLE plans ADD COLUMN max_orders_per_month INTEGER DEFAULT 1000',
      'max_products': 'ALTER TABLE plans ADD COLUMN max_products INTEGER DEFAULT 100',
      'max_branches': 'ALTER TABLE plans ADD COLUMN max_branches INTEGER DEFAULT 1',
      'max_users': 'ALTER TABLE plans ADD COLUMN max_users INTEGER DEFAULT 1',
      'duration_days': 'ALTER TABLE plans ADD COLUMN duration_days INTEGER DEFAULT 30',
      'period': 'ALTER TABLE plans ADD COLUMN period TEXT DEFAULT \'monthly\'',
      'currency': 'ALTER TABLE plans ADD COLUMN currency TEXT DEFAULT \'ZMW\'',
      'price_cents': 'ALTER TABLE plans ADD COLUMN price_cents INTEGER DEFAULT 0',
      'description': 'ALTER TABLE plans ADD COLUMN description TEXT',
      'name': 'ALTER TABLE plans ADD COLUMN name TEXT NOT NULL',
      'code': 'ALTER TABLE plans ADD COLUMN code TEXT UNIQUE NOT NULL'
    };
    
    for (const col of missingColumns) {
      if (alterQueries[col]) {
        try {
          db.exec(alterQueries[col]);
          console.log(`   ✓ Added column: ${col}`);
        } catch (e) {
          console.log(`   ✗ Failed to add ${col}: ${e.message}`);
        }
      }
    }
  } else {
    console.log('3. All required columns present: OK');
  }
  
  // 4. Check if there's data
  const count = db.prepare('SELECT COUNT(*) as count FROM plans').get().count;
  console.log('4. Records count:', count);
  
  if (count === 0) {
    console.log('\n5. Inserting default plans...');
    const insert = db.prepare(`
      INSERT INTO plans (code, name, description, price_cents, currency, period, duration_days, 
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
        console.log(`   ✓ Inserted: ${plan[1]}`);
      }
    });
    
    tx();
    console.log('\n✓ Plans inserted successfully');
  }
  
  // 5. Final verification
  console.log('\n5. Final verification...');
  const finalPlans = db.prepare('SELECT id, code, name, price_cents FROM plans').all();
  console.log(`   Total plans: ${finalPlans.length}`);
  finalPlans.forEach(p => {
    console.log(`   - ${p.id}: ${p.name} (${p.code})`);
  });
  
} else {
  console.log('\n❌ Table does not exist. Creating it...');
  db.exec(`
    CREATE TABLE plans (
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
  console.log('✓ Table created');
  
  // Insert plans
  const insert = db.prepare(`
    INSERT INTO plans (code, name, description, price_cents, currency, period, duration_days, 
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
    }
  });
  
  tx();
  console.log('✓ Plans inserted');
}

db.close();

console.log('\n✅ DONE');
console.log('\nNow restart your server:');
console.log('1. Stop current server (Ctrl+C)');
console.log('2. Run: npx tsx src/server/server.ts');