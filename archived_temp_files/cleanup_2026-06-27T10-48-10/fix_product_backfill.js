/**
 * Fix complet pour le backfill des produits
 * 1. Vérifie les produits sans remote_id
 * 2. Les ajoute dans sync_outbox avec payload complet
 * 3. Déclenche le sync
 */
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.resolve(__dirname, '..', 'data', 'database.db');

function main() {
  console.log('=== FIX PRODUCT BACKFILL ===\n');
  
  const db = new Database(DB_PATH);
  
  // 1. Trouver tous les produits sans remote_id
  const products = db.prepare(`
    SELECT p.* FROM products p
    WHERE p.remote_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM sync_outbox o 
        WHERE o.entity = 'product' 
          AND o.record_id = CAST(p.id AS TEXT)
      )
  `).all();
  
  console.log(`Produits à backfiller: ${products.length}\n`);
  
  if (products.length === 0) {
    console.log('✓ Aucun produit à backfiller');
    return;
  }
  
  // 2. Ajouter chaque produit dans l'outbox
  const insertOutbox = db.prepare(`
    INSERT INTO sync_outbox (id, entity, operation, record_id, payload, tenant_id, status, created_at, updated_at)
    VALUES (?, ?, 'insert', ?, ?, ?, 'pending', datetime('now'), datetime('now'))
  `);
  
  let added = 0;
  
  for (const product of products) {
    const payload = {
      id: product.id,
      name: product.name,
      description: product.description,
      selling_price: product.selling_price,
      buying_price: product.buying_price,
      stock_quantity: product.stock_quantity,
      is_available: product.is_available,
      category_id: product.category_id,
      barcode: product.barcode,
      sku: product.sku,
      unit: product.unit,
      image_url: product.image_url,
      status: product.status,
      tenant_id: product.tenant_id,
      created_at: product.created_at,
      updated_at: product.updated_at,
      created_by: product.created_by,
      updated_by: product.updated_by
    };
    
    const outboxId = crypto.randomUUID();
    const recordId = String(product.id);
    const tenantId = product.tenant_id || 16; // Fallback à 16 si NULL
    
    insertOutbox.run(outboxId, 'product', recordId, JSON.stringify(payload), tenantId);
    
    console.log(`✓ Ajouté dans outbox: ${product.name} (id=${product.id}, tenant=${tenantId})`);
    added++;
  }
  
  console.log(`\nTotal ajouté: ${added} produits dans l'outbox\n`);
  
  // 3. Vérifier l'état final
  const finalOutbox = db.prepare(`
    SELECT COUNT(*) as count FROM sync_outbox WHERE entity='product' AND status='pending'
  `).get();
  
  console.log(`Produits en attente dans l'outbox: ${finalOutbox.count}`);
  
  if (finalOutbox.count > 0) {
    console.log('\n✓ Les produits seront synchronisés vers Supabase dans les 30 prochaines secondes');
    console.log('  (par le scheduler automatique)');
  }
  
  db.close();
}

main();