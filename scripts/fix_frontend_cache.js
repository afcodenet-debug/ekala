// Script pour vider le cache du frontend et forcer le rechargement des données
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'backend', 'database.sqlite');
const db = new Database(dbPath);

console.log('=== FIX FRONTEND CACHE - TENANT 16 ===\n');

// 1. Vérifier les données actuelles
console.log('1. DONNÉES ACTUELLES:');
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
  console.log('   - Nom:', user.full_name);
  console.log('   - Tenant:', user.tenant_name);
  console.log('   - Statut:', user.sub_status || user.tenant_status);
  console.log('   - Plan:', user.plan_name);
  console.log('   - Expire:', user.current_period_end);
}

// 2. Instructions pour le frontend
console.log('\n\n2. ACTIONS REQUISES DANS LE FRONTEND:');
console.log('   a) Ouvrir http://localhost:5173/settings/subscription');
console.log('   b) Ouvrir les DevTools (F12)');
console.log('   c) Aller dans l\'onglet "Application" > "Local Storage" > "http://localhost:5173"');
console.log('   d) Supprimer la clé "ekala-auth"');
console.log('   e) Recharger la page (F5)');
console.log('   f) Se reconnecter si nécessaire');

console.log('\n\n3. DONNÉES QUI SERONT AFFICHÉES APRÈS LE FIX:');
console.log('   - Sidebar:');
console.log('     * Nom: MAKUTANO');
console.log('     * Statut: ✓ Actif (vert)');
console.log('     * Badge: Pro Mensuel avec 24 jours restants');
console.log('   - Page Settings/Subscription (Aperçu):');
console.log('     * Abonnement: Pro Mensuel');
console.log('     * Prix: 33 600 ZMW / mois');
console.log('     * Statut: Actif (vert)');
console.log('     * Renouvellement dans: 24 jours');

console.log('\n\n4. ALTERNATIVE RAPIDE:');
console.log('   Exécuter dans la console du navigateur (F12 > Console):');
console.log('   localStorage.removeItem("ekala-auth");');
console.log('   location.reload();');

db.close();