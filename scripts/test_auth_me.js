// Script pour tester ce que retourne l'endpoint /api/auth/me
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'backend', 'database.sqlite');
const db = new Database(dbPath);

console.log('=== TEST /api/auth/me - TENANT 16 ===\n');

// 1. Trouver un utilisateur du tenant 16
console.log('1. UTILISATEUR:');
const user = db.prepare(`
  SELECT u.id, u.full_name, u.email, u.role, u.tenant_id
  FROM users u
  WHERE u.tenant_id = 16 AND u.is_active = 1
  LIMIT 1
`).get();

if (!user) {
  console.log('   ❌ Aucun utilisateur trouvé');
  process.exit(1);
}

console.log('   - ID:', user.id);
console.log('   - Nom:', user.full_name);
console.log('   - Email:', user.email);
console.log('   - Rôle:', user.role);
console.log('   - Tenant ID:', user.tenant_id);

// 2. Tester la requête exacte de l'endpoint /api/auth/me (local fallback)
console.log('\n2. TEST DE LA REQUÊTE /api/auth/me (local fallback):');
const result = db.prepare(`
  SELECT u.id, u.full_name, u.email, u.phone, u.username, u.role, u.is_active, u.tenant_id,
         t.name as tenant_name, t.slug as tenant_slug, t.status as tenant_status,
         s.status as sub_status, s.current_period_end, p.name as plan_name
  FROM users u 
  LEFT JOIN tenants t ON u.tenant_id = t.id
  LEFT JOIN subscriptions s ON s.tenant_id = t.id AND s.status IN ('active', 'trial', 'past_due', 'expired')
  LEFT JOIN plans p ON s.plan_id = p.id
  WHERE u.id = ? AND u.tenant_id = ?
  ORDER BY s.id DESC
  LIMIT 1
`).get(user.id, user.tenant_id);

if (!result) {
  console.log('   ❌ Aucun résultat');
} else {
  console.log('   ✅ Résultat:');
  console.log('   - ID:', result.id);
  console.log('   - Nom:', result.full_name);
  console.log('   - Email:', result.email);
  console.log('   - Rôle:', result.role);
  console.log('   - Tenant ID:', result.tenant_id);
  console.log('   - Tenant Name:', result.tenant_name);
  console.log('   - Tenant Slug:', result.tenant_slug);
  console.log('   - Tenant Status:', result.tenant_status);
  console.log('   - Sub Status:', result.sub_status);
  console.log('   - Plan Name:', result.plan_name);
  console.log('   - Current Period End:', result.current_period_end);
}

// 3. Vérifier les abonnements du tenant
console.log('\n3. ABONNEMENTS DU TENANT 16:');
const subs = db.prepare(`
  SELECT s.*, p.name as plan_name, p.code as plan_code
  FROM subscriptions s
  LEFT JOIN plans p ON s.plan_id = p.id
  WHERE s.tenant_id = 16
  ORDER BY s.id DESC
`).all();

if (subs.length > 0) {
  console.log(`   ✅ ${subs.length} abonnement(s) trouvé(s):`);
  subs.forEach((s, i) => {
    console.log(`\n   Abonnement ${i + 1}:`);
    console.log('   - ID:', s.id);
    console.log('   - Statut:', s.status);
    console.log('   - Plan:', s.plan_name || s.plan_code);
    console.log('   - Date fin:', s.current_period_end);
  });
} else {
  console.log('   ❌ Aucun abonnement trouvé');
}

// 4. Diagnostic
console.log('\n\n=== DIAGNOSTIC ===');
if (result && result.sub_status) {
  console.log('✅ La requête retourne bien un abonnement');
  console.log('   Statut:', result.sub_status);
  console.log('   Plan:', result.plan_name);
} else if (result && !result.sub_status) {
  console.log('❌ PROBLÈME: La requête ne trouve pas d\'abonnement');
  console.log('   Cause possible:');
  console.log('   - L\'abonnement existe mais avec un statut non autorisé');
  console.log('   - Le tenant_id ne correspond pas');
  console.log('   - La jointure ne fonctionne pas');
} else {
  console.log('❌ Aucun résultat');
}

db.close();