/**
 * Script de synchronisation complète des tables restaurant_tables
 * 1. Nettoie les tables orphelines dans SQLite
 * 2. Force la synchronisation de toutes les tables vers Supabase
 * 3. Met à jour les remote_id dans SQLite
 * 
 * Usage: SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/full-tables-sync.js
 */

const path = require('path');
const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');

// Configuration - doit être fournie via variables d'environnement
const dbPath = path.resolve(__dirname, '../data/database.db');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERREUR: Variables d\'environnement manquantes!');
  console.error('   Exportez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Exemple: SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... node scripts/full-tables-sync.js');
  process.exit(1);
}

console.log('=== Synchronisation Complète des Tables ===\n');

// 1. Préparer la base SQLite
console.log('1. Préparation SQLite...');
const db = new Database(dbPath);

// Vérifier et créer les colonnes nécessaires
const tableCols = db.prepare("PRAGMA table_info(restaurant_tables)").all().map(c => c.name);
if (!tableCols.includes('tenant_id')) {
  db.exec(`ALTER TABLE restaurant_tables ADD COLUMN tenant_id INTEGER`);
}
if (!tableCols.includes('remote_id')) {
  db.exec(`ALTER TABLE restaurant_tables ADD COLUMN remote_id INTEGER`);
}

// Nettoyer : supprimer les tables sans tenant_id ou avec des noms invalides
console.log('2. Nettoyage des tables orphelines...');
const allTables = db.prepare(`SELECT * FROM restaurant_tables`).all();
console.log(`   Trouvé ${allTables.length} tables dans SQLite`);

for (const table of allTables) {
  // Marquer les tables orphelines (sans tenant_id ou noms suspects)
  if (!table.tenant_id || 
      !table.table_number || 
      table.table_number.trim() === '' ||
      table.table_number.startsWith('T-') ||
      table.table_number.includes(' ')) {
    console.log(`   ⚠️  Table orpheline détectée: id=${table.id}, table_number="${table.table_number}", tenant_id=${table.tenant_id}`);
  }
}

// 3. Préparer les données pour Supabase
console.log('3. Préparation des données pour synchronisation...');
const validTables = db.prepare(`SELECT * FROM restaurant_tables WHERE tenant_id IS NOT NULL AND table_number IS NOT NULL AND table_number != ''`).all();
console.log(`   ${validTables.length} tables valides à synchroniser`);

// Diviser en batches de 50 pour éviter les timeouts
const batchSize = 50;
for (let i = 0; i < validTables.length; i += batchSize) {
  const batch = validTables.slice(i, i + batchSize);
  
  // Envoyer à Supabase
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });
    
    console.log(`\n4. Synchronisation batch ${i/batchSize + 1} (${batch.length} tables)...`);
    
    // Pour chaque table, utiliser id local comme id Supabase si remote_id est null
    const rowsToSync = batch.map(t => {
      const row = { ...t };
      if (!row.remote_id) {
        // Premère sync : utiliser id local comme id Supabase
        // Supabase va créer un nouvel enregistrement avec cet id
        delete row.remote_id; // Ne pas envoyer remote_id à Supabase
        return row;
      } else {
        // Sync existante : utiliser remote_id comme id
        row.id = row.remote_id;
        delete row.remote_id;
        return row;
      }
    });
    
    // Upsert dans Supabase
    const { data: upserted, error } = await supabase
      .from('restaurant_tables')
      .upsert(rowsToSync, { onConflict: 'id' })
      .select();
    
    if (error) {
      console.error(`   ❌ Erreur Supabase:`, error.message);
      continue;
    }
    
    console.log(`   ✅ ${upserted.length} tables synchronisées vers Supabase`);
    
    // Mettre à jour les remote_id dans SQLite
    for (const supabaseRow of upserted) {
      const localTable = batch.find(t => 
        t.remote_id === supabaseRow.id || (!t.remote_id && t.id === supabaseRow.id)
      );
      
      if (localTable && localTable.id) {
        db.prepare(`UPDATE restaurant_tables SET remote_id = ? WHERE id = ?`)
          .run(supabaseRow.id, localTable.id);
        console.log(`   ✓ SQLite.id=${localTable.id} → Supabase.id=${supabaseRow.id}`);
      }
    }
    
  } catch (error) {
    console.error(`   ❌ Erreur batch ${i/batchSize + 1}:`, error.message);
  }
}

// 4. Vérification finale
console.log('\n5. Vérification finale...');
const finalCount = db.prepare(`SELECT COUNT(*) as cnt FROM restaurant_tables WHERE remote_id IS NOT NULL`).get().cnt;
console.log(`   ✅ ${finalCount} tables dans SQLite ont maintenant un remote_id`);

// 5. Vérifier dans Supabase
try {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { count: supabaseCount, error } = await supabase
    .from('restaurant_tables')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error('   ❌ Impossible de vérifier Supabase:', error.message);
  } else {
    console.log(`   ✅ Supabase contient ${supabaseCount} tables`);
    
    if (supabaseCount !== finalCount) {
      console.warn('   ⚠️  Désynchronisation détectée!');
      console.warn(`      SQLite: ${finalCount} tables avec remote_id`);
      console.warn(`      Supabase: ${supabaseCount} tables`);
    } else {
      console.log('   ✅ Synchronisation parfaite!');
    }
  }
} catch (error) {
  console.error('   ❌ Erreur vérification Supabase:', error.message);
}

console.log('\n=== Synchronisation terminée ===');
db.close();
