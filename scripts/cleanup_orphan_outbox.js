/**
 * Nettoie les sync_outbox orphelins :
 * - Supprime les entrées dont la ligne locale n'existe plus
 * - Compare avec categories/restaurant_tables qui fonctionnent
 * 
 * Usage: node scripts/cleanup_orphan_outbox.js
 */
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '..', 'data', 'database.db');

function main() {
  console.log('=== NETTOYAGE SYNC_OUTBOX ORPHELINS ===\n');
  
  const db = new Database(DB_PATH);
  
  // 1. Analyser toutes les entités
  const entities = ['product', 'category', 'restaurant_table', 'order', 'sale'];
  
  console.log('État des tables locales vs outbox:\n');
  
  for (const entity of entities) {
    const def = {
      product: { table: 'products', idField: 'id' },
      category: { table: 'categories', idField: 'id' },
      restaurant_table: { table: 'restaurant_tables', idField: 'id' },
      order: { table: 'orders', idField: 'id' },
      sale: { table: 'sales', idField: 'id' }
    }[entity];
    
    if (!def) continue;
    
    // Compter les lignes locales
    const localCount = db.prepare(`SELECT COUNT(*) as count FROM ${def.table}`).get().count;
    
    // Compter les entrées dans l'outbox
    const outboxCount = db.prepare(`
      SELECT COUNT(*) as count FROM sync_outbox 
      WHERE entity = ? AND status IN ('pending', 'in_progress', 'done')
    `).get(entity).count;
    
    // Trouver les orphelins (record_id n'existe pas dans la table locale)
    const orphans = db.prepare(`
      SELECT o.id, o.record_id, o.operation, o.status, o.tenant_id
      FROM sync_outbox o
      WHERE o.entity = ?
        AND o.status IN ('pending', 'in_progress', 'done')
        AND NOT EXISTS (
          SELECT 1 FROM ${def.table} t WHERE t.${def.idField} = CAST(o.record_id AS INTEGER)
        )
    `).all(entity);
    
    console.log(`${entity.toUpperCase()}:`);
    console.log(`  Lignes locales: ${localCount}`);
    console.log(`  Entrées outbox: ${outboxCount}`);
    console.log(`  Orphelins: ${orphans.length}`);
    
    if (orphans.length > 0 && entity === 'product') {
      console.log(`  ⚠️  PRODUITS ORPHELINS DÉTECTÉS:`);
      orphans.forEach(o => {
        console.log(`    - ID: ${o.id}, record_id: ${o.record_id}, op: ${o.operation}, status: ${o.status}`);
      });
    }
    
    console.log('');
  }
  
  // 2. Supprimer les orphelins
  console.log('=== NETTOYAGE ===\n');
  
  let totalDeleted = 0;
  
  for (const entity of entities) {
    const def = {
      product: { table: 'products', idField: 'id' },
      category: { table: 'categories', idField: 'id' },
      restaurant_table: { table: 'restaurant_tables', idField: 'id' },
      order: { table: 'orders', idField: 'id' },
      sale: { table: 'sales', idField: 'id' }
    }[entity];
    
    if (!def) continue;
    
    const result = db.prepare(`
      DELETE FROM sync_outbox
      WHERE entity = ?
        AND status IN ('pending', 'in_progress', 'done')
        AND NOT EXISTS (
          SELECT 1 FROM ${def.table} t WHERE t.${def.idField} = CAST(record_id AS INTEGER)
        )
    `).run(entity);
    
    if (result.changes > 0) {
      console.log(`✓ ${entity}: ${result.changes} entrées orphelines supprimées`);
      totalDeleted += result.changes;
    }
  }
  
  console.log(`\nTotal nettoyé: ${totalDeleted} entrées\n`);
  
  // 3. État final
  console.log('=== ÉTAT FINAL ===\n');
  
  const finalState = db.prepare(`
    SELECT entity, status, COUNT(*) as count
    FROM sync_outbox
    WHERE tenant_id = 16
    GROUP BY entity, status
    ORDER BY entity, status
  `).all();
  
  console.table(finalState);
  
  db.close();
  
  console.log('\n=== RECOMMANDATIONS ===');
  console.log('1. Les produits ont été supprimés de la table products (remote_id NULL)');
  console.log('2. Les entrées orphelines dans sync_outbox ont été nettoyées');
  console.log('3. Ajoutez un nouveau produit dans l\'interface pour tester la sync');
  console.log('4. Vérifiez que le nouveau produit apparaît dans sync_outbox avec status=pending');
  console.log('5. Attendez 30s pour que le scheduler le pousse vers Supabase');
}

main();