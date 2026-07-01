
const Database = require('better-sqlite3');
const crypto = require('crypto');
const db = new Database('data/database.db');

const tenantId = 6;
const tenantName = 'Great Olive';

function genSku(productName) {
  const rand4Str = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const tPart = tenantName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const pPart = (productName || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const base = (tPart + pPart);
  const prefix = (base || 'XXXX').substring(0, 4).padEnd(4, 'X');
  return (prefix + rand4Str).substring(0, 8);
}

// 1. Fix missing SKUs and 0 prices in SQLite
const products = db.prepare('SELECT * FROM products WHERE tenant_id = 6').all();
console.log(`Checking ${products.length} products...`);

db.transaction(() => {
  for (const p of products) {
    let changed = false;
    let newSku = p.sku;
    let newPrice = p.price;
    let newCostPrice = p.cost_price;

    if (!p.sku || p.sku === '0.0' || p.sku === '0') {
      newSku = genSku(p.name);
      changed = true;
    }

    if (!p.price || p.price === 0) {
      newPrice = p.selling_price || 0;
      changed = true;
    }

    if (!p.cost_price || p.cost_price === 0) {
      newCostPrice = p.buying_price || 0;
      changed = true;
    }

    // Special case for the duplicate remote_id 81 found earlier
    // If multiple products have the same remote_id, we should probably clear them to re-sync
    // But let's first fix the prices and SKUs.

    if (changed) {
      db.prepare('UPDATE products SET sku = ?, price = ?, cost_price = ?, sync_status = \'pending\' WHERE id = ?')
        .run(newSku, newPrice, newCostPrice, p.id);
      
      // Queue for sync
      const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(p.id);
      const payload = {
        ...updated,
        price: newPrice,
        cost_price: newCostPrice,
        sku: newSku
      };

      db.prepare(`
        INSERT INTO sync_outbox (id, entity, operation, record_id, payload, tenant_id, status)
        VALUES (?, 'product', 'insert', ?, ?, ?, 'pending')
      `).run(
        crypto.randomUUID(),
        String(p.id),
        JSON.stringify(payload),
        tenantId
      );
      
      console.log(`Fixed product #${p.id}: ${p.name}`);
    }
  }
})();

console.log('Fix completed.');
db.close();
