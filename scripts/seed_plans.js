const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'backend', 'database.sqlite');
const db = new Database(dbPath);

console.log('🌱 Création de la table plans et insertion des données...\n');

try {
  // Créer la table plans
  db.exec(`
    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price_monthly INTEGER NOT NULL,
      price_yearly INTEGER DEFAULT 0,
      max_users INTEGER DEFAULT 1,
      max_branches INTEGER DEFAULT 1,
      max_storage_gb INTEGER DEFAULT 5,
      features TEXT DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      period TEXT DEFAULT 'monthly',
      currency TEXT DEFAULT 'ZMW',
      duration_days INTEGER DEFAULT 30,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ Table "plans" créée avec succès\n');

  // Insérer des plans de test
  const plans = [
    {
      code: 'STARTER',
      name: 'Starter',
      description: 'Plan de base pour les petites entreprises',
      price_monthly: 25000, // 250 ZMW
      price_yearly: 250000, // 2500 ZMW (2 mois gratuits)
      max_users: 3,
      max_branches: 1,
      max_storage_gb: 5,
      features: JSON.stringify(['Utilisateurs illimités', '1 succursale', '5GB stockage', 'Support email']),
      is_active: 1,
      sort_order: 1
    },
    {
      code: 'BUSINESS',
      name: 'Business',
      description: 'Plan pour les entreprises en croissance',
      price_monthly: 50000, // 500 ZMW
      price_yearly: 500000, // 5000 ZMW
      max_users: 10,
      max_branches: 3,
      max_storage_gb: 20,
      features: JSON.stringify(['Utilisateurs illimités', '3 succursales', '20GB stockage', 'Support prioritaire', 'Rapports avancés']),
      is_active: 1,
      sort_order: 2
    },
    {
      code: 'ENTERPRISE',
      name: 'Enterprise',
      description: 'Plan complet pour les grandes entreprises',
      price_monthly: 100000, // 1000 ZMW
      price_yearly: 1000000, // 10000 ZMW
      max_users: 50,
      max_branches: 10,
      max_storage_gb: 100,
      features: JSON.stringify(['Utilisateurs illimités', '10 succursales', '100GB stockage', 'Support 24/7', 'Rapports personnalisés', 'API access', 'SSO']),
      is_active: 1,
      sort_order: 3
    },
    {
      code: 'TRIAL',
      name: 'Essai gratuit',
      description: 'Essai gratuit de 14 jours',
      price_monthly: 0,
      price_yearly: 0,
      max_users: 2,
      max_branches: 1,
      max_storage_gb: 1,
      features: JSON.stringify(['2 utilisateurs', '1 succursale', '1GB stockage', 'Support email']),
      is_active: 1,
      sort_order: 0
    }
  ];

  const insert = db.prepare(`
    INSERT INTO plans (code, name, description, price_monthly, price_yearly, max_users, max_branches, max_storage_gb, features, is_active, sort_order, period, currency, duration_days)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    plans.forEach(plan => {
      try {
        insert.run(
          plan.code,
          plan.name,
          plan.description,
          plan.price_monthly,
          plan.price_yearly,
          plan.max_users,
          plan.max_branches,
          plan.max_storage_gb,
          plan.features,
          plan.is_active,
          plan.sort_order,
          plan.period,
          plan.currency,
          plan.duration_days
        );
        console.log(`  ✅ Plan "${plan.name}" (${plan.code}) inséré avec succès`);
      } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          console.log(`  ⏭️  Plan "${plan.name}" (${plan.code}) existe déjà, ignoré`);
        } else {
          throw err;
        }
      }
    });
  });

  transaction();
  console.log('\n✅ Plans de test insérés avec succès!\n');

  // Vérifier les plans insérés
  const count = db.prepare('SELECT COUNT(*) as count FROM plans').get();
  console.log(`📊 Nombre total de plans dans la base: ${count.count}\n`);

  const allPlans = db.prepare('SELECT id, code, name, price_monthly, is_active FROM plans ORDER BY sort_order ASC').all();
  console.log('📋 Plans disponibles:');
  allPlans.forEach(plan => {
    console.log(`  - [${plan.code}] ${plan.name}: ${plan.price_monthly} cents/mois (actif: ${plan.is_active})`);
  });

  console.log('\n🎉 Vous pouvez maintenant rafraîchir la page http://localhost:5173/settings/subscription');
  console.log('   Les plans devraient apparaître dans le sélecteur.\n');

} catch (error) {
  console.error('❌ Erreur:', error.message);
  process.exit(1);
} finally {
  db.close();
}