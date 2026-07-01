/**
 * Force re-queue tous les products de sync_outbox en status='pending'
 * pour qu'ils soient re-poussés vers Supabase.
 * 
 * Usage: node scripts/force_requeue_products.js
 */
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.resolve(__dirname, '..', 'data', 'database.db');

function main() {
  console.log('=== FORCE RE-QUEUE PRODUCTS ===');
  console.log('Database:', DB_PATH);
  
  const db = new Database(DB_PATH);
  
  // 1. Vérifier l'état actuel
  const before = db.prepare(`
    SELECT status, tenant_id, COUNT(*) as count
    FROM sync_outbox
    WHERE entity = 'product'
    GROUP BY status, tenant_id
  `).all();
  
  console.log('État avant:');
  console.table(before);
  
  // 2. Forcer le re-queue de tous les products en pending
  // Même ceux déjà 'done' pour les forcer à être re-poussés
  const result = db.prepare(`
    UPDATE sync_outbox 
    SET status = 'pending', 
        retry_count = 0, 
        last_error = NULL,
        updated_at = datetime('now')
    WHERE entity = 'product'
      AND (status = 'done' OR status = 'failed')
  `).run();
  
  console.log(`\nRe-queued: ${result.changes} products`);
  
  // 3. Vérifier l'état après
  const after = db.prepare(`
    SELECT status, tenant_id, COUNT(*) as count
    FROM sync_outbox
    WHERE entity = 'product'
    GROUP BY status, tenant_id
  `).all();
  
  console.log('État après:');
  console.table(after);
  
  // 4. Afficher les détails
  const details = db.prepare(`
    SELECT id, record_id, tenant_id, operation, status, retry_count
    FROM sync_outbox
    WHERE entity = 'product'
    ORDER BY record_id ASC
  `).all();
  
  console.log('\nDétails des produits:');
  console.table(details);
  
  db.close();
  console.log('\n=== TERMINÉ ===');
  console.log('Redémarre le serveur pour que le sync engine pousse les produits vers Supabase.');
}

main();