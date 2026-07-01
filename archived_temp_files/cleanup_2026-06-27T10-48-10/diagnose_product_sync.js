/**
 * Diagnostic temps réel de la synchronisation des produits
 * Vérifie chaque étape : produit → outbox → Supabase
 */
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '..', 'data', 'database.db');

function main() {
  console.log('=== DIAGNOSTIC SYNCHRO PRODUITS ===\n');
  
  const db = new Database(DB_PATH);
  
  // 1. État de la table products
  console.log('1. TABLE PRODUCTS (SQLite):');
  const products = db.prepare('SELECT id, name, tenant_id, remote_id, updated_at FROM products').all();
  console.table(products);
  
  // 2. État de sync_outbox
  console.log('\n2. SYNC_OUTBOX:');
  const outbox = db.prepare(`
    SELECT o.id, o.entity, o.record_id, o.operation, o.status, o.retry_count, o.last_error, o.created_at,
           p.name as product_name
    FROM sync_outbox o
    LEFT JOIN products p ON p.id = CAST(o.record_id AS INTEGER)
    WHERE o.entity = 'product'
    ORDER BY o.created_at DESC
  `).all();
  
  if (outbox.length > 0) {
    console.table(outbox);
  } else {
    console.log('  (aucune entrée)');
  }
  
  // 3. Vérifier le backfill
  console.log('\n3. VÉRIFICATION BACKFILL:');
  const productsWithoutRemoteId = db.prepare(`
    SELECT p.id, p.name, p.tenant_id
    FROM products p
    WHERE p.remote_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM sync_outbox o 
        WHERE o.entity = 'product' 
          AND o.record_id = CAST(p.id AS TEXT)
          AND o.status IN ('pending', 'in_progress', 'done')
      )
  `).all();
  
  if (productsWithoutRemoteId.length > 0) {
    console.log(`  ⚠️  ${productsWithoutRemoteId.length} produit(s) sans remote_id ET sans entrée dans l'outbox:`);
    console.table(productsWithoutRemoteId);
    console.log('\n  → Ces produits doivent être ajoutés dans l\'outbox par le backfill');
  } else {
    console.log('  ✓ Tous les produits sans remote_id sont dans l\'outbox');
  }
  
  // 4. Comparer avec categories
  console.log('\n4. COMPARAISON AVEC CATEGORIES (qui fonctionnent):');
  const categories = db.prepare('SELECT id, name, tenant_id, remote_id FROM categories WHERE tenant_id=16').all();
  console.log(`  Categories: ${categories.length} lignes`);
  const catOutbox = db.prepare("SELECT COUNT(*) as count FROM sync_outbox WHERE entity='category'").get().count;
  console.log(`  Catégories dans outbox: ${catOutbox}`);
  
  // 5. Recommandations
  console.log('\n=== RECOMMANDATIONS ===');
  
  if (products.length === 1 && outbox.length === 0) {
    console.log('PROBLÈME IDENTIFIÉ:');
    console.log('  - 1 produit existe dans SQLite (id=9)');
    console.log('  - 0 entrée dans sync_outbox');
    console.log('  - Le backfill au démarrage ne fonctionne pas correctement');
    console.log('\nSOLUTION:');
    console.log('  Le produit doit être ajouté manuellement dans sync_outbox:');
    console.log('  INSERT INTO sync_outbox (id, entity, operation, record_id, payload, tenant_id, status)');
    console.log("  VALUES ('" + require('crypto').randomUUID() + "', 'product', 'insert', '9', '{}', 16, 'pending');");
  }
  
  db.close();
}

main();