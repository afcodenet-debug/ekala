
const Database = require('better-sqlite3');
const crypto = require('crypto');
const db = new Database('data/database.db');

const tenantId = 6;
const fallbackUserId = 10;
const tenantName = 'Great Olive';

function genSku(productName) {
  const rand4Str = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const tPart = tenantName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const pPart = (productName || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const base = (tPart + pPart);
  const prefix = (base || 'XXXX').substring(0, 4).padEnd(4, 'X');
  return (prefix + rand4Str).substring(0, 8);
}

const products = db.prepare('SELECT * FROM products WHERE sku IS NULL OR created_by IS NULL OR updated_by IS NULL').all();

console.log(`Found ${products.length} products to backfill.`);

const updateStmt = db.prepare(`
  UPDATE products 
  SET sku = ?, created_by = ?, updated_by = ?, updated_at = ?
  WHERE id = ?
`);

const outboxStmt = db.prepare(`
  INSERT INTO sync_outbox (id, entity, operation, record_id, payload, tenant_id, status)
  VALUES (?, 'product', 'update', ?, ?, ?, 'pending')
`);

db.transaction(() => {
  for (const p of products) {
    const newSku = p.sku || genSku(p.name);
    const cb = p.created_by || fallbackUserId;
    const ub = p.updated_by || fallbackUserId;
    const now = new Date().toISOString();

    updateStmt.run(newSku, cb, ub, now, p.id);

    // Fetch updated row to get full payload
    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(p.id);
    
    // Update payload with correct values
    const payload = {
      ...updated,
      sku: newSku,
      created_by: cb,
      updated_by: ub,
      price: updated.price || updated.selling_price || 0,
      cost_price: updated.cost_price || updated.buying_price || 0
    };

    outboxStmt.run(
      crypto.randomUUID(),
      String(p.id),
      JSON.stringify(payload),
      tenantId
    );
  }
})();

console.log('Backfill completed and updates queued.');
db.close();
