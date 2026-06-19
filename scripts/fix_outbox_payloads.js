
const Database = require('better-sqlite3');
const db = new Database('data/database.db');

const items = db.prepare('SELECT * FROM sync_outbox WHERE entity = \'product\' AND status = \'pending\'').all();
console.log(`Checking ${items.length} pending product outbox items...`);

db.transaction(() => {
  for (const item of items) {
    let payload = JSON.parse(item.payload);
    let changed = false;

    if (!payload.price || payload.price === 0) {
      payload.price = payload.selling_price || 0;
      changed = true;
    }

    if (!payload.cost_price || payload.cost_price === 0) {
      payload.cost_price = payload.buying_price || 0;
      changed = true;
    }
    
    if (!payload.sku || payload.sku === '0.0' || payload.sku === '0') {
        // Try to get from local product
        const p = db.prepare('SELECT sku FROM products WHERE id = ?').get(item.record_id);
        if (p && p.sku && p.sku !== '0.0' && p.sku !== '0') {
            payload.sku = p.sku;
            changed = true;
        }
    }

    if (changed) {
      db.prepare('UPDATE sync_outbox SET payload = ? WHERE id = ?').run(JSON.stringify(payload), item.id);
      console.log(`Fixed outbox item #${item.id} for product #${item.record_id}`);
    }
  }
})();

console.log('Outbox fix completed.');
db.close();
