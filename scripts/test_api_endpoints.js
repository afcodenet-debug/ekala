// Script pour tester les endpoints API et voir ce qu'ils retournent
const Database = require('better-sqlite3');
const path = require('path');
const http = require('http');

const dbPath = path.join(__dirname, '..', 'backend', 'database.sqlite');
const db = new Database(dbPath);

console.log('=== TEST API ENDPOINTS - TENANT 16 ===\n');

// 1. Vérifier ce que contient la table users pour le tenant 16
console.log('1. UTILISATEURS DU TENANT 16:');
const users = db.prepare(`
  SELECT id, email, full_name, role, tenant_id, status, plan_name, expires_at
  FROM users
  WHERE tenant_id = ?
`).all(16);

if (users.length > 0) {
  users.forEach((u, i) => {
    console.log(`\n   Utilisateur ${i + 1}:`);
    console.log('   - ID:', u.id);
    console.log('   - Email:', u.email);
    console.log('   - Nom:', u.full_name);
    console.log('   - Rôle:', u.role);
    console.log('   - Tenant ID:', u.tenant_id);
    console.log('   - Status:', u.status);
    console.log('   - Plan Name:', u.plan_name);
    console.log('   - Expires At:', u.expires_at);
  });
} else {
  console.log('   ❌ Aucun utilisateur trouvé pour le tenant 16');
}

// 2. Vérifier ce que l'endpoint /api/auth/me devrait retourner
console.log('\n\n2. DONNÉES QUE /api/auth/me DEVRAIT RETOURNER:');
const user = users[0];
if (user) {
  console.log('   L\'endpoint /api/auth/me doit retourner:');
  console.log('   - id:', user.id);
  console.log('   - email:', user.email);
  console.log('   - full_name:', user.full_name);
  console.log('   - role:', user.role);
  console.log('   - tenant_id:', user.tenant_id);
  console.log('   - status:', user.status, '(ACTUEL)');
  console.log('   - plan_name:', user.plan_name, '(ACTUEL)');
  console.log('   - expires_at:', user.expires_at, '(ACTUEL)');
}

// 3. Vérifier l'abonnement
console.log('\n\n3. ABONNEMENT DU TENANT 16:');
const subscription = db.prepare(`
  SELECT s.*, p.code as plan_code, p.name as plan_name
  FROM subscriptions s
  LEFT JOIN plans p ON s.plan_id = p.id
  WHERE s.tenant_id = ?
  ORDER BY s.created_at DESC
  LIMIT 1
`).get(16);

if (subscription) {
  console.log('   ✅ Abonnement trouvé:');
  console.log('   - Plan:', subscription.plan_name);
  console.log('   - Code:', subscription.plan_code);
  console.log('   - Statut:', subscription.status);
  console.log('   - Date fin:', subscription.current_period_end);
} else {
  console.log('   ❌ Aucun abonnement');
}

// 4. Vérifier le tenant
console.log('\n\n4. INFORMATIONS DU TENANT:');
const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(16);
if (tenant) {
  console.log('   - Nom:', tenant.name);
  console.log('   - Statut:', tenant.status);
  console.log('   - is_provisioned:', tenant.is_provisioned);
}

// 5. Diagnostic
console.log('\n\n=== DIAGNOSTIC ===');
console.log('\nLe problème est probablement dans un de ces endroits:');
console.log('1. L\'endpoint /api/auth/me ne met pas à jour les champs status, plan_name, expires_at');
console.log('2. Le frontend utilise les données en cache (localStorage)');
console.log('3. Le frontend ne rafraîchit pas le profil après activation de voucher');

console.log('\n\nSOLUTION:');
console.log('Vérifier que l\'endpoint /api/auth/me retourne bien les données à jour');
console.log('Et que le frontend appelle refreshProfile() après activation');

db.close();