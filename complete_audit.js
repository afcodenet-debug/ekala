const Database = require('better-sqlite3');
const db = new Database('data/database.db');
const fs = require('fs');

console.log('=== AUDIT COMPLET TENANT FANTÔME #1 ===\n');

// 1. Tous les tenants
console.log('1. Table tenants:');
const tenants = db.prepare('SELECT id,name,remote_id,status FROM tenants ORDER BY id').all();
console.log(JSON.stringify(tenants, null, 2));
console.log();

// 2. Users tenant_id=1
console.log('2. Users avec tenant_id=1:');
const users_t1 = db.prepare('SELECT COUNT(*) AS users_t1 FROM users WHERE tenant_id=1').get();
console.log(JSON.stringify(users_t1, null, 2));
console.log();

// 3. Users tenant_id=6
console.log('3. Users avec tenant_id=6:');
const users_t6 = db.prepare('SELECT COUNT(*) AS users_t6 FROM users WHERE tenant_id=6').get();
console.log(JSON.stringify(users_t6, null, 2));
console.log();

// 4. Détail users tenant_id=1
console.log('4. Détail users tenant_id=1:');
const usersDetail = db.prepare('SELECT id,email,tenant_id,remote_id FROM users WHERE tenant_id=1 ORDER BY id').all();
console.log(JSON.stringify(usersDetail, null, 2));
console.log();

// 5. Categories par tenant
console.log('5. Categories par tenant:');
const cats_t1 = db.prepare('SELECT COUNT(*) AS categories_t1 FROM categories WHERE tenant_id=1').get();
const cats_t6 = db.prepare('SELECT COUNT(*) AS categories_t6 FROM categories WHERE tenant_id=6').get();
console.log('tenant_id=1:', JSON.stringify(cats_t1));
console.log('tenant_id=6:', JSON.stringify(cats_t6));
console.log();

// 6. Tables par tenant
console.log('6. Tables par tenant:');
const tables_t1 = db.prepare('SELECT COUNT(*) AS tables_t1 FROM restaurant_tables WHERE tenant_id=1').get();
const tables_t6 = db.prepare('SELECT COUNT(*) AS tables_t6 FROM restaurant_tables WHERE tenant_id=6').get();
console.log('tenant_id=1:', JSON.stringify(tables_t1));
console.log('tenant_id=6:', JSON.stringify(tables_t6));
console.log();

// 7. Orders par tenant
console.log('7. Orders par tenant:');
const orders_t1 = db.prepare('SELECT COUNT(*) AS orders_t1 FROM orders WHERE tenant_id=1').get();
const orders_t6 = db.prepare('SELECT COUNT(*) AS orders_t6 FROM orders WHERE tenant_id=6').get();
console.log('tenant_id=1:', JSON.stringify(orders_t1));
console.log('tenant_id=6:', JSON.stringify(orders_t6));
console.log();

// 8. Sales par tenant
console.log('8. Sales par tenant:');
const sales_t1 = db.prepare('SELECT COUNT(*) AS sales_t1 FROM sales WHERE tenant_id=1').get();
const sales_t6 = db.prepare('SELECT COUNT(*) AS sales_t6 FROM sales WHERE tenant_id=6').get();
console.log('tenant_id=1:', JSON.stringify(sales_t1));
console.log('tenant_id=6:', JSON.stringify(sales_t6));
console.log();

// 9. Inventory movements par tenant
console.log('9. Inventory movements par tenant:');
const inv_t1 = db.prepare('SELECT COUNT(*) AS inventory_t1 FROM inventory_movements WHERE tenant_id=1').get();
const inv_t6 = db.prepare('SELECT COUNT(*) AS inventory_t6 FROM inventory_movements WHERE tenant_id=6').get();
console.log('tenant_id=1:', JSON.stringify(inv_t1));
console.log('tenant_id=6:', JSON.stringify(inv_t6));
console.log();

// 10. Vérifier les migrations SaaS
console.log('10. Migrations SaaS (backend/migrations/):');
const migrationFiles = fs.readdirSync('backend/migrations').filter(f => f.includes('saas') || f.includes('tenant') || f.includes('multitenant'));
console.log(JSON.stringify(migrationFiles, null, 2));
console.log();

// 11. Chercher les références à tenant_id=1 dans le code
console.log('11. Références à "tenant_id = 1" dans le code:');
const tsFiles = fs.readdirSync('src').filter(f => f.endsWith('.ts')) || [];
const allTsFiles = [];
function findTsFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = `${dir}/${file}`;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) findTsFiles(fullPath);
    else if (file.endsWith('.ts')) allTsFiles.push(fullPath);
  }
}
findTsFiles('src');

let tenantId1Refs = [];
for (const file of allTsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('tenant_id = 1') || lines[i].includes('tenant_id==1') || lines[i].includes("tenant_id='1'") || lines[i].includes('tenant_id="1"')) {
      tenantId1Refs.push({ file, line: i + 1, content: lines[i].trim() });
    }
  }
}
console.log(JSON.stringify(tenantId1Refs, null, 2));
console.log();

// 12. Chercher les références à tid === 1
console.log('12. Références à "tid === 1" dans le code:');
let tidRefs = [];
for (const file of allTsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('tid === 1') || lines[i].includes('tid === \'1\'')) {
      tidRefs.push({ file, line: i + 1, content: lines[i].trim() });
    }
  }
}
console.log(JSON.stringify(tidRefs, null, 2));
console.log();

// 13. Chercher les références à "tenant 1"
console.log('13. Références à "tenant 1" dans le code:');
let tenant1Refs = [];
for (const file of allTsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes('tenant 1') || lines[i].includes('tenant_id=1')) {
      tenant1Refs.push({ file, line: i + 1, content: lines[i].trim() });
    }
  }
}
console.log(JSON.stringify(tenant1Refs, null, 2));
console.log();

db.close();