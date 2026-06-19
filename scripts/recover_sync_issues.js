
const Database = require('better-sqlite3');
const crypto = require('crypto');
const db = new Database('data/database.db');

console.log('Starting sync recovery...');

// 1. Reset failed outbox items for products so they can be retried with the new logic
const resetResult = db.prepare(`
  UPDATE sync_outbox 
  SET status = 'pending', retry_count = 0, last_error = NULL 
  WHERE entity = 'product' AND status = 'failed'
`).run();
console.log(`Reset ${resetResult.changes} failed product sync items.`);

// 2. Fix products with 0 price/cost_price or missing SKU in SQLite
const products = db.prepare(`
  SELECT * FROM products 
  WHERE (price = 0 OR cost_price = 0 OR sku IS NULL OR sku = '' OR sku = '0.0')
  AND (deleted_at IS NULL)
`).all();

console.log(`Found ${products.length} products with potential data issues in SQLite.`);

db.transaction(() => {
  for (const p of products) {
    let changed = false;
    let newPrice = p.price;
    let newCostPrice = p.cost_price;
    let newSku = p.sku;

    if (p.price === 0 && p.selling_price > 0) {
      newPrice = p.selling_price;
      changed = true;
    }
    if (p.cost_price === 0 && p.buying_price > 0) {
      newCostPrice = p.buying_price;
      changed = true;
    }
    
    if (!p.sku || p.sku === '0.0' || p.sku === '0') {
      // Simple SKU generation if missing
      const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      newSku = (p.name.substring(0, 4).toUpperCase() + rand).padEnd(8, 'X').substring(0, 8);
      changed = true;
    }

    if (changed) {
      db.prepare('UPDATE products SET price = ?, cost_price = ?, sku = ?, sync_status = \'pending\' WHERE id = ?')
        .run(newPrice, newCostPrice, newSku, p.id);
      
      // Also update any pending outbox payload
      const pendingItems = db.prepare("SELECT id, payload FROM sync_outbox WHERE entity = 'product' AND record_id = ? AND status = 'pending'").all(String(p.id));
      for (const item of pendingItems) {
        const payload = JSON.parse(item.payload);
        payload.price = newPrice;
        payload.cost_price = newCostPrice;
        payload.sku = newSku;
        payload.selling_price = newPrice;
        payload.buying_price = newCostPrice;
        
        db.prepare('UPDATE sync_outbox SET payload = ? WHERE id = ?').run(JSON.stringify(payload), item.id);
      }
      
      console.log(`Fixed product #${p.id}: ${p.name} (Price: ${newPrice}, SKU: ${newSku})`);
    }
  }
})();

// 3. Queue any unsynced products that are not in the outbox
const orphans = db.prepare(`
  SELECT * FROM products 
  WHERE remote_id IS NULL 
  AND id NOT IN (SELECT record_id FROM sync_outbox WHERE entity = 'product')
  AND (deleted_at IS NULL)
`).all();

console.log(`Found ${orphans.length} orphan products not in sync_outbox.`);

db.transaction(() => {
  for (const p of orphans) {
    const payload = {
      ...p,
      // Ensure prices are correctly named for both legacy and new sync
      selling_price: p.selling_price || p.price,
      buying_price: p.buying_price || p.cost_price,
      price: p.price || p.selling_price,
      cost_price: p.cost_price || p.buying_price,
    };

    db.prepare(`
      INSERT INTO sync_outbox (id, entity, operation, record_id, payload, tenant_id, status)
      VALUES (?, 'product', 'insert', ?, ?, ?, 'pending')
    `).run(
      crypto.randomUUID(),
      String(p.id),
      JSON.stringify(payload),
      p.tenant_id || 1
    );
    console.log(`Queued orphan product #${p.id}: ${p.name}`);
  }
})();

console.log('Recovery completed.');
db.close();
