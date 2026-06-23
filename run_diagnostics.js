const Database = require('better-sqlite3');
const db = new Database('data/database.db');

console.log('=== DIAGNOSTIC SQL RESULTS ===\n');

// 1. Nombre total de produits
console.log('1. Nombre total de produits:');
const total = db.prepare('SELECT COUNT(*) AS total_products FROM products').get();
console.log(JSON.stringify(total, null, 2));
console.log();

// 2. Liste complète des produits
console.log('2. Liste complète des produits:');
const products = db.prepare('SELECT id, name, tenant_id, remote_id, deleted_at FROM products ORDER BY id').all();
console.log(JSON.stringify(products, null, 2));
console.log();

// 3. Contenu réel de sync_outbox pour les produits
console.log('3. Contenu de sync_outbox pour products:');
const outbox = db.prepare("SELECT id, entity, operation, record_id, tenant_id, status, created_at FROM sync_outbox WHERE entity='product' ORDER BY created_at").all();
console.log(JSON.stringify(outbox, null, 2));
console.log();

// 4. Répartition des statuts
console.log('4. Répartition des statuts:');
const statusCounts = db.prepare("SELECT status, COUNT(*) as count FROM sync_outbox WHERE entity='product' GROUP BY status").all();
console.log(JSON.stringify(statusCounts, null, 2));
console.log();

// 5. Répartition des tenant_id
console.log('5. Répartition des tenant_id:');
const tenantCounts = db.prepare("SELECT tenant_id, COUNT(*) as count FROM sync_outbox WHERE entity='product' GROUP BY tenant_id").all();
console.log(JSON.stringify(tenantCounts, null, 2));
console.log();

// 6. Nombre de lignes tenant_id NULL
console.log('6. Nombre de lignes avec tenant_id NULL:');
const nullTenant = db.prepare("SELECT COUNT(*) AS null_tenant_count FROM sync_outbox WHERE entity='product' AND tenant_id IS NULL").get();
console.log(JSON.stringify(nullTenant, null, 2));
console.log();

// 7. Vérifier si les 8 produits annoncés existent réellement
console.log('7. Produits pending dans sync_outbox:');
const pending = db.prepare("SELECT COUNT(*) AS pending_products FROM sync_outbox WHERE entity='product' AND status='pending'").get();
console.log(JSON.stringify(pending, null, 2));
console.log();

// 8. Afficher les 20 dernières lignes de sync_outbox toutes entités
console.log('8. 20 dernières lignes de sync_outbox:');
const recent = db.prepare('SELECT entity, operation, record_id, tenant_id, status, created_at FROM sync_outbox ORDER BY created_at DESC LIMIT 20').all();
console.log(JSON.stringify(recent, null, 2));
console.log();

// 9. Vérifier les produits déjà synchronisés
console.log('9. Produits avec remote_id (déjà synchronisés):');
const synced = db.prepare('SELECT id, name, remote_id FROM products WHERE remote_id IS NOT NULL').all();
console.log(JSON.stringify(synced, null, 2));
console.log();

// 10. Vérifier les produits SANS remote_id
console.log('10. Produits SANS remote_id (à synchroniser):');
const notSynced = db.prepare('SELECT id, name, tenant_id, remote_id FROM products WHERE remote_id IS NULL').all();
console.log(JSON.stringify(notSynced, null, 2));
console.log();

db.close();