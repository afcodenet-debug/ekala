const Database = require('better-sqlite3');
const db = new Database('data/database.db');

console.log('=== ANALYSE CRITIQUE TENANT_ID=1 ===\n');

// 1. Tous les tenants
console.log('1. Table tenants:');
const tenants = db.prepare('SELECT * FROM tenants ORDER BY id').all();
console.log(JSON.stringify(tenants, null, 2));
console.log();

// 2. Users avec email et tenant_id
console.log('2. Users (id, email, tenant_id, role):');
const users = db.prepare('SELECT id, email, tenant_id, role FROM users ORDER BY tenant_id, id').all();
console.log(JSON.stringify(users, null, 2));
console.log();

// 3. Compter les produits par tenant
console.log('3. Produits par tenant:');
const p1 = db.prepare('SELECT COUNT(*) AS products_tenant1 FROM products WHERE tenant_id=1').get();
const p6 = db.prepare('SELECT COUNT(*) AS products_tenant6 FROM products WHERE tenant_id=6').get();
const p16 = db.prepare('SELECT COUNT(*) AS products_tenant16 FROM products WHERE tenant_id=16').get();
console.log('tenant_id=1:', JSON.stringify(p1));
console.log('tenant_id=6:', JSON.stringify(p6));
console.log('tenant_id=16:', JSON.stringify(p16));
console.log();

// 4. Vérifier les catégories par tenant
console.log('4. Categories par tenant:');
const c1 = db.prepare('SELECT COUNT(*) AS cats_tenant1 FROM categories WHERE tenant_id=1').get();
const c6 = db.prepare('SELECT COUNT(*) AS cats_tenant6 FROM categories WHERE tenant_id=6').get();
const c16 = db.prepare('SELECT COUNT(*) AS cats_tenant16 FROM categories WHERE tenant_id=16').get();
console.log('tenant_id=1:', JSON.stringify(c1));
console.log('tenant_id=6:', JSON.stringify(c6));
console.log('tenant_id=16:', JSON.stringify(c16));
console.log();

// 5. Vérifier les tables par tenant
console.log('5. Tables par tenant:');
const t1 = db.prepare('SELECT COUNT(*) AS tables_tenant1 FROM restaurant_tables WHERE tenant_id=1').get();
const t6 = db.prepare('SELECT COUNT(*) AS tables_tenant6 FROM restaurant_tables WHERE tenant_id=6').get();
const t16 = db.prepare('SELECT COUNT(*) AS tables_tenant16 FROM restaurant_tables WHERE tenant_id=16').get();
console.log('tenant_id=1:', JSON.stringify(t1));
console.log('tenant_id=6:', JSON.stringify(t6));
console.log('tenant_id=16:', JSON.stringify(t16));
console.log();

// 6. Vérifier les orders par tenant
console.log('6. Orders par tenant:');
const o1 = db.prepare('SELECT COUNT(*) AS orders_tenant1 FROM orders WHERE tenant_id=1').get();
const o6 = db.prepare('SELECT COUNT(*) AS orders_tenant6 FROM orders WHERE tenant_id=6').get();
const o16 = db.prepare('SELECT COUNT(*) AS orders_tenant16 FROM orders WHERE tenant_id=16').get();
console.log('tenant_id=1:', JSON.stringify(o1));
console.log('tenant_id=6:', JSON.stringify(o6));
console.log('tenant_id=16:', JSON.stringify(o16));
console.log();

// 7. Vérifier les sales par tenant
console.log('7. Sales par tenant:');
const s1 = db.prepare('SELECT COUNT(*) AS sales_tenant1 FROM sales WHERE tenant_id=1').get();
const s6 = db.prepare('SELECT COUNT(*) AS sales_tenant6 FROM sales WHERE tenant_id=6').get();
const s16 = db.prepare('SELECT COUNT(*) AS sales_tenant16 FROM sales WHERE tenant_id=16').get();
console.log('tenant_id=1:', JSON.stringify(s1));
console.log('tenant_id=6:', JSON.stringify(s6));
console.log('tenant_id=16:', JSON.stringify(s16));
console.log();

// 8. Vérifier les inventory_movements par tenant
console.log('8. Inventory movements par tenant:');
const im1 = db.prepare('SELECT COUNT(*) AS im_tenant1 FROM inventory_movements WHERE tenant_id=1').get();
const im6 = db.prepare('SELECT COUNT(*) AS im_tenant6 FROM inventory_movements WHERE tenant_id=6').get();
const im16 = db.prepare('SELECT COUNT(*) AS im_tenant16 FROM inventory_movements WHERE tenant_id=16').get();
console.log('tenant_id=1:', JSON.stringify(im1));
console.log('tenant_id=6:', JSON.stringify(im6));
console.log('tenant_id=16:', JSON.stringify(im16));
console.log();

// 9. Vérifier si des données tenant_id=1 sont déjà synchronisées
console.log('9. Données tenant_id=1 déjà synchronisées (remote_id IS NOT NULL):');
const syncedProducts = db.prepare('SELECT COUNT(*) AS count FROM products WHERE tenant_id=1 AND remote_id IS NOT NULL').get();
const syncedCats = db.prepare('SELECT COUNT(*) AS count FROM categories WHERE tenant_id=1 AND remote_id IS NOT NULL').get();
const syncedTables = db.prepare('SELECT COUNT(*) AS count FROM restaurant_tables WHERE tenant_id=1 AND remote_id IS NOT NULL').get();
console.log('Products:', JSON.stringify(syncedProducts));
console.log('Categories:', JSON.stringify(syncedCats));
console.log('Tables:', JSON.stringify(syncedTables));
console.log();

// 10. Vérifier le tenant actif dans l'environnement
console.log('10. Vérifier SYNC_TENANT_ID dans .env:');
const fs = require('fs');
const envContent = fs.readFileSync('.env', 'utf8');
const syncTenantMatch = envContent.match(/SYNC_TENANT_ID=(\d+)/);
console.log('SYNC_TENANT_ID:', syncTenantMatch ? syncTenantMatch[1] : 'NOT FOUND');
console.log();

db.close();