const Database = require('better-sqlite3');
const db = new Database('data/database.db');

console.log('=== ANALYSE TENANTS ===\n');

// 1. Tous les tenants
console.log('1. Table tenants:');
const tenants = db.prepare('SELECT * FROM tenants ORDER BY id').all();
console.log(JSON.stringify(tenants, null, 2));
console.log();

// 2. Users par tenant
console.log('2. Table users (avec tenant_id):');
const users = db.prepare('SELECT id, username, full_name, role, tenant_id FROM users ORDER BY tenant_id, id').all();
console.log(JSON.stringify(users, null, 2));
console.log();

// 3. Tenant_users
console.log('3. Table tenant_users:');
const tenantUsers = db.prepare('SELECT * FROM tenant_users ORDER BY tenant_id, user_id').all();
console.log(JSON.stringify(tenantUsers, null, 2));
console.log();

// 4. Produits par tenant
console.log('4. Produits par tenant_id:');
const productsByTenant = db.prepare('SELECT tenant_id, COUNT(*) as count, GROUP_CONCAT(name) as names FROM products GROUP BY tenant_id').all();
console.log(JSON.stringify(productsByTenant, null, 2));
console.log();

// 5. Categories par tenant
console.log('5. Categories par tenant_id:');
const catsByTenant = db.prepare('SELECT tenant_id, COUNT(*) as count, GROUP_CONCAT(name) as names FROM categories GROUP BY tenant_id').all();
console.log(JSON.stringify(catsByTenant, null, 2));
console.log();

// 6. Tables par tenant
console.log('6. Tables par tenant_id:');
const tablesByTenant = db.prepare('SELECT tenant_id, COUNT(*) as count, GROUP_CONCAT(table_number) as names FROM restaurant_tables GROUP BY tenant_id').all();
console.log(JSON.stringify(tablesByTenant, null, 2));
console.log();

// 7. Vérifier les produits avec remote_id par tenant
console.log('7. Produits synchronisés (remote_id IS NOT NULL) par tenant:');
const syncedByTenant = db.prepare('SELECT tenant_id, COUNT(*) as count FROM products WHERE remote_id IS NOT NULL GROUP BY tenant_id').all();
console.log(JSON.stringify(syncedByTenant, null, 2));
console.log();

// 8. Vérifier les produits NON synchronisés par tenant
console.log('8. Produits NON synchronisés (remote_id IS NULL) par tenant:');
const notSyncedByTenant = db.prepare('SELECT tenant_id, COUNT(*) as count FROM products WHERE remote_id IS NULL GROUP BY tenant_id').all();
console.log(JSON.stringify(notSyncedByTenant, null, 2));
console.log();

db.close();