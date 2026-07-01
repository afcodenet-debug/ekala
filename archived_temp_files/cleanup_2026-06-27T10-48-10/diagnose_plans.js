const Database = require('better-sqlite3');
const path = require('path');

// Chemin vers la base de données
const dbPath = path.join(__dirname, 'backend', 'database.sqlite');
const db = new Database(dbPath);

console.log('🔍 Diagnostic de la table plans\n');
console.log('Base de données:', dbPath);
console.log('');

try {
  // Vérifier si la table existe
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  const plansTableExists = tables.some(t => t.name === 'plans');
  
  console.log('📋 Tables existantes:');
  tables.forEach(t => console.log('  -', t.name));
  console.log('');
  
  console.log('✅ Table "plans" existe:', plansTableExists);
  console.log('');

  if (plansTableExists) {
    // Compter le nombre de plans
    const count = db.prepare('SELECT COUNT(*) as count FROM plans').get();
    console.log('📊 Nombre de plans:', count.count);
    console.log('');

    if (count.count > 0) {
      // Récupérer tous les plans
      const plans = db.prepare('SELECT * FROM plans ORDER BY sort_order ASC, id ASC').all();
      console.log('📝 Plans disponibles:');
      plans.forEach((plan, i) => {
        console.log(`\n  Plan #${i + 1}:`);
        console.log('    ID:', plan.id);
        console.log('    Code:', plan.code);
        console.log('    Nom:', plan.name);
        console.log('    Prix:', plan.price_cents, 'cents');
        console.log('    Devise:', plan.currency);
        console.log('    Période:', plan.period);
        console.log('    Actif:', plan.is_active);
        console.log('    Sort order:', plan.sort_order);
      });
      console.log('');
      
      // Test de la requête API
      console.log('🧪 Test de la requête API (simulation):');
      const apiResult = db.prepare('SELECT * FROM plans ORDER BY sort_order ASC, id ASC').all();
      console.log('  Résultat:', JSON.stringify({ success: true, plans: apiResult }, null, 2));
    } else {
      console.log('⚠️  La table plans est vide!');
      console.log('\n💡 Pour insérer des plans de test, exécutez:');
      console.log('   node scripts/seed_plans.js');
    }
  } else {
    console.log('❌ La table "plans" n\'existe pas!');
    console.log('\n💡 Pour créer la table, exécutez les migrations:');
    console.log('   npm run migrate');
  }
} catch (error) {
  console.error('❌ Erreur:', error.message);
} finally {
  db.close();
}