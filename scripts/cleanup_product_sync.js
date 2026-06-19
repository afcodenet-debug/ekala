
const Database = require('better-sqlite3');
const crypto = require('crypto');
const db = new Database('data/database.db');

console.log('Cleaning up sync outbox for products...');

db.transaction(() => {
  // 1. Delete all non-done product sync items to start fresh
  const del = db.prepare("DELETE FROM sync_outbox WHERE entity = 'product' AND status != 'done'").run();
  console.log(`Deleted ${del.changes} non-done product sync items.`);

  // 2. Find ALL products without remote_id (regardless of outbox status)
  const orphans = db.prepare(`
    SELECT * FROM products 
    WHERE remote_id IS NULL 
    AND (deleted_at IS NULL)
  `).all();

  console.log(`Found ${orphans.length} products to re-queue.`);

  for (const p of orphans) {
    const payload = {
      ...p,
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
    console.log(`Queued product #${p.id}: ${p.name}`);
  }
})();

console.log('Cleanup and re-queue completed.');
db.close();
