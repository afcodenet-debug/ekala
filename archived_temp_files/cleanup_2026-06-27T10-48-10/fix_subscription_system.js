/**
 * Réparation du système d'abonnement pour le développement
 * 1. Vérifie les plans disponibles
 * 2. Crée un plan gratuit si nécessaire
 * 3. Assigne un abonnement actif au tenant #16
 * 4. Permet le fonctionnement en mode dev
 */
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '..', 'data', 'database.db');

function main() {
  console.log('=== RÉPARATION SYSTÈME D\'ABONNEMENT ===\n');
  
  const db = new Database(DB_PATH);
  
  // 1. Vérifier les plans disponibles
  console.log('1. PLANS DISPONIBLES:');
  const plans = db.prepare('SELECT * FROM plans').all();
  
  if (plans.length === 0) {
    console.log('  Aucun plan trouvé. Création du plan gratuit...\n');
    
    const insertPlan = db.prepare(`
      INSERT INTO plans (id, code, name, description, price_cents, currency, period,
                        duration_days, max_users, max_products, max_orders_per_month, features, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertPlan.run(
      1,
      'free',
      'Gratuit',
      'Plan gratuit pour développement et tests',
      0,
      'ZMW',
      'monthly',
      30,
      5,
      100,
      100,
      JSON.stringify(['sync_supabase', 'basic_support']),
      1
    );
    
    console.log('  ✓ Plan "Gratuit" créé (id=1)\n');
  } else {
    console.log(`  ${plans.length} plan(s) trouvé(s):`);
    plans.forEach(p => console.log(`    - ${p.name} (code=${p.code}, id=${p.id}, actif=${p.is_active})`));
    console.log('');
  }
  
  // 2. Vérifier l'abonnement du tenant #16
  console.log('2. ABONNEMENT DU TENANT #16 (MAKUTANO):');
  const subscription = db.prepare(`
    SELECT ts.*, p.name as plan_name, p.code as plan_code
    FROM tenant_subscriptions ts
    LEFT JOIN plans p ON p.id = ts.plan_id
    WHERE ts.tenant_id = 16
    ORDER BY ts.created_at DESC
    LIMIT 1
  `).get();
  
  if (!subscription) {
    console.log('  Aucun abonnement trouvé. Création d\'un abonnement actif...\n');
    
    const insertSub = db.prepare(`
      INSERT INTO tenant_subscriptions (
        id, tenant_id, plan_id, status, current_period_start, current_period_end,
        trial_start, trial_end, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setFullYear(periodEnd.getFullYear() + 1); // 1 an
    
    insertSub.run(
      1,
      16,
      1, // Plan gratuit
      'active',
      now.toISOString(),
      periodEnd.toISOString(),
      null,
      null
    );
    
    console.log('  ✓ Abonnement actif créé (plan: Gratuit, 1 an)\n');
  } else {
    console.log(`  Abonnement existant:`);
    console.log(`    - Plan: ${subscription.plan_name || 'N/A'}`);
    console.log(`    - Statut: ${subscription.status}`);
    console.log(`    - Fin de période: ${subscription.current_period_end}\n`);
    
    if (subscription.status !== 'active') {
      console.log('  → Réactivation de l\'abonnement...\n');
      
      const updateSub = db.prepare(`
        UPDATE tenant_subscriptions
        SET status = 'active',
            current_period_start = datetime('now'),
            current_period_end = datetime('now', '+1 year'),
            updated_at = datetime('now')
        WHERE tenant_id = 16
      `);
      
      updateSub.run();
      console.log('  ✓ Abonnement réactivé\n');
    }
  }
  
  // 3. Vérifier tous les tenants
  console.log('3. ÉTAT DE TOUS LES TENANTS:');
  const tenants = db.prepare(`
    SELECT t.id, t.name, ts.status as sub_status, p.name as plan_name, p.code as plan_code
    FROM tenants t
    LEFT JOIN tenant_subscriptions ts ON ts.tenant_id = t.id
    LEFT JOIN plans p ON p.id = ts.plan_id
    ORDER BY t.id
  `).all();
  
  console.table(tenants);
  
  // 4. Test de validation
  console.log('4. TEST DE VALIDATION:');
  const testTenant = db.prepare(`
    SELECT ts.status, p.name as plan_name, p.code as plan_code
    FROM tenant_subscriptions ts
    LEFT JOIN plans p ON p.id = ts.plan_id
    WHERE ts.tenant_id = 16
  `).get();
  
  if (testTenant && testTenant.status === 'active') {
    console.log('  ✅ Tenant #16: ABONNEMENT ACTIF');
    console.log(`     Plan: ${testTenant.plan_name}`);
    console.log('\n  → Les requêtes ne seront plus bloquées par SUBSCRIPTION_REQUIRED');
  } else {
    console.log('  ❌ Problème avec l\'abonnement du tenant #16');
  }
  
  db.close();
  
  console.log('\n=== RECOMMANDATIONS ===');
  console.log('1. Redémarrez le serveur: npm run dev');
  console.log('2. Rechargez l\'interface (http://localhost:5173/pos)');
  console.log('3. Les erreurs SUBSCRIPTION_REQUIRED devraient disparaître');
  console.log('4. Pour ajouter un nouveau plan: utilisez l\'interface /pricing');
}

main();