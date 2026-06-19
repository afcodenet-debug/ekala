/**
 * Script de migration pour corriger la table restaurant_tables
 * Ajoute les colonnes manquantes: remote_id et tenant_id
 * Met à jour tenant_id à 1 pour les entrées existantes
 * Crée les index nécessaires
 */

const path = require('path');
const Database = require('better-sqlite3');

// Chemins des bases de données
const dbPaths = [
  path.resolve(__dirname, '../data/pos.db'),
  path.resolve(__dirname, '../dist-electron/mac/dist/data/great_olive.db'),
  path.resolve(__dirname, '../dist-electron/mac/dist/data/database.db'),
  path.resolve(__dirname, '../dist-electron/mac/The Great Olive.app/Contents/Resources/data/great_olive.db'),
  path.resolve(__dirname, '../dist-electron/mac/The Great Olive.app/Contents/Resources/data/database.db'),
];

console.log('=== Migration restaurant_tables ===\n');

dbPaths.forEach(dbPath => {
  try {
    if (!require('fs').existsSync(dbPath)) {
      console.log(`⏭️  Fichier non trouvé: ${dbPath}`);
      return;
    }

    const db = new Database(dbPath);
    console.log(`\n📁 Traitement: ${dbPath}`);

    // Vérifier si la table existe
    const tableCheck = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='restaurant_tables'`).get();
    if (!tableCheck) {
      console.log('   ❌ Table restaurant_tables non trouvée');
      db.close();
      return;
    }

    // Lister les colonnes existantes
    const columns = db.prepare(`PRAGMA table_info(restaurant_tables)`).all().map(c => c.name);
    console.log(`   Colonnes existantes: ${columns.join(', ')}`);

    // Ajouter tenant_id si manque
    if (!columns.includes('tenant_id')) {
      console.log('   ✅ Ajout colonne tenant_id');
      db.exec(`ALTER TABLE restaurant_tables ADD COLUMN tenant_id INTEGER`);
    }

    // Ajouter remote_id si manque
    if (!columns.includes('remote_id')) {
      console.log('   ✅ Ajout colonne remote_id');
      db.exec(`ALTER TABLE restaurant_tables ADD COLUMN remote_id INTEGER`);
    }

    // Mettre à jour tenant_id à 1 pour les entrées existantes où tenant_id IS NULL
    const nullTenantCount = db.prepare(`SELECT COUNT(*) as cnt FROM restaurant_tables WHERE tenant_id IS NULL`).get().cnt;
    if (nullTenantCount > 0) {
      console.log(`   ✅ Mise à jour ${nullTenantCount} lignes avec tenant_id=1`);
      db.exec(`UPDATE restaurant_tables SET tenant_id = 1 WHERE tenant_id IS NULL`);
    }

    // Créer l'index sur remote_id si inexistant
    const indexCheck = db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name='idx_tables_remote_id'`).get();
    if (!indexCheck) {
      console.log('   ✅ Création index idx_tables_remote_id');
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tables_remote_id ON restaurant_tables(remote_id) WHERE remote_id IS NOT NULL`);
    }

    // Créer l'index sur tenant_id si inexistant
    const tenantIndexCheck = db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name='idx_tables_tenant_id'`).get();
    if (!tenantIndexCheck) {
      console.log('   ✅ Création index idx_tables_tenant_id');
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tables_tenant_id ON restaurant_tables(tenant_id)`);
    }

    // Statistiques finales
    const count = db.prepare(`SELECT COUNT(*) as cnt FROM restaurant_tables`).get().cnt;
    const withTenant = db.prepare(`SELECT COUNT(*) as cnt FROM restaurant_tables WHERE tenant_id IS NOT NULL`).get().cnt;
    const withRemoteId = db.prepare(`SELECT COUNT(*) as cnt FROM restaurant_tables WHERE remote_id IS NOT NULL`).get().cnt;
    
    console.log(`   📊 Résultats: ${count} tables au total, ${withTenant} avec tenant_id, ${withRemoteId} avec remote_id`);

    db.close();
    console.log('   ✅ Migration terminée avec succès\n');

  } catch (error) {
    console.error(`   ❌ Erreur sur ${dbPath}:`, error.message);
  }
});

console.log('=== Migration terminée ===');
