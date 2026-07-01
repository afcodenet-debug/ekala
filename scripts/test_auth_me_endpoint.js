// Script pour tester l'endpoint /api/auth/me et diagnostiquer le problème
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'backend', 'database.sqlite');
const db = new Database(dbPath);

console.log('=== TEST ENDPOINT /api/auth/me - TENANT 16 ===\n');

// 1. Vérifier les données brutes dans la base de données
console.log('1. DONNÉES DANS LA BASE DE DONNÉES:');
const user = db.prepare(`
  SELECT u.id, u.full_name, u.email, u.role, u.tenant_id,
         t.name as tenant_name, t.slug as tenant_slug, t.status as tenant_status,
         s.status as sub_status, s.current_period_end, p.name as plan_name
  FROM users u 
  LEFT JOIN tenants t ON u.tenant_id = t.id
  LEFT JOIN subscriptions s ON s.tenant_id = t.id AND s.status IN ('active', 'trial', 'past_due', 'expired')
  LEFT JOIN plans p ON s.plan_id = p.id
  WHERE u.tenant_id = 16 AND u.role = 'owner'
  ORDER BY s.id DESC
  LIMIT 1
`).get();

if (user) {
  console.log('   ✅ Utilisateur trouvé:');
  console.log('   - ID:', user.id);
  console.log('   - Nom:', user.full_name);
  console.log('   - Tenant:', user.tenant_name);
  console.log('   - Tenant Status:', user.tenant_status);
  console.log('   - Subscription Status:', user.sub_status);
  console.log('   - Plan:', user.plan_name);
  console.log('   - Expire:', user.current_period_end);
} else {
  console.log('   ❌ Aucun utilisateur trouvé pour tenant 16');
}

// 2. Vérifier toutes les tables
console.log('\n2. VÉRIFICATION DES TABLES:');

const tables = ['tenants', 'subscriptions', 'plans', 'users'];
tables.forEach(table => {
  try {
    const count = db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get().cnt;
    console.log(`   - ${table}: ${count} enregistrement(s)`);
  } catch (e) {
    console.log(`   - ${table}: ERREUR - ${e.message}`);
  }
});

// 3. Vérifier les abonnements actifs pour tenant 16
console.log('\n3. ABONNEMENTS POUR TENANT 16:');
const subs = db.prepare(`
  SELECT s.*, p.name as plan_name, p.code as plan_code
  FROM subscriptions s
  LEFT JOIN plans p ON s.plan_id = p.id
  WHERE s.tenant_id = 16
  ORDER BY s.id DESC
`).all();

if (subs.length > 0) {
  subs.forEach(sub => {
    console.log(`   - ID: ${sub.id}, Status: ${sub.status}, Plan: ${sub.plan_name || sub.plan_code}, Expire: ${sub.current_period_end}`);
  });
} else {
  console.log('   ❌ Aucun abonnement trouvé pour tenant 16');
}

// 4. Vérifier le tenant
console.log('\n4. INFORMATIONS DU TENANT 16:');
const tenant = db.prepare('SELECT * FROM tenants WHERE id = 16').get();
if (tenant) {
  console.log('   ✅ Tenant trouvé:');
  console.log('   - ID:', tenant.id);
  console.log('   - Nom:', tenant.name);
  console.log('   - Slug:', tenant.slug);
  console.log('   - Status:', tenant.status);
} else {
  console.log('   ❌ Tenant 16 non trouvé');
}

// 5. Diagnostic
console.log('\n5. DIAGNOSTIC:');
if (user && user.tenant_name && user.sub_status && user.plan_name) {
  console.log('   ✅ Les données sont correctes en base de données');
  console.log('   ❌ Le problème est dans l\'endpoint /api/auth/me');
  console.log('   → Vérifier la fonction getTenantSubscription() dans auth.service.ts');
} else if (user && !user.sub_status) {
  console.log('   ⚠️  Utilisateur trouvé mais PAS d\'abonnement actif');
  console.log('   → L\'abonnement n\'est pas correctement lié au tenant');
} else {
  console.log('   ❌ Problème avec les données de base');
}

db.close();

console.log('\n6. SOLUTION:');
console.log('   Si les données sont correctes en base mais pas dans /api/auth/me:');
console.log('   - Vérifier que Supabase est configuré et connecté');
console.log('   - Vérifier les permissions Supabase (RLS policies)');
console.log('   - Vérifier la jointure dans getTenantSubscription()');
console.log('   - Tester l\'endpoint directement: http://localhost:5173/api/auth/me');