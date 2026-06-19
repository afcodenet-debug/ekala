/**
 * Nettoie et réinjecte la queue orders/order_items
 * avec le mapping strict order-sync.service.ts.
 */
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/database.db');
const DRY_RUN = process.argv.includes('--dry-run');

const db = new Database(DB_PATH);

function newId() {
  return `q_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;
}

function isOrderFailedPending() {
  return `
    SELECT id, entity, operation, record_id, payload, retry_count, tenant_id
    FROM sync_outbox
    WHERE entity IN ('order','order_item')
      AND status IN ('failed','pending')
  `;
}

const rows = db.prepare(isOrderFailedPending()).all();
let cleaned = 0;
let skipped = 0;

for (const item of rows) {
  const payload = JSON.parse(item.payload);

  if (item.entity === 'order') {
    const orderPayload = {
      id: payload.id,
      table_id: payload.table_id ?? null,
      waiter_id: payload.waiter_id ?? null,
      status: payload.status,
      total: payload.total,
      items: payload.items,
      customer_id: payload.customer_id ?? null,
      tenant_id: payload.tenant_id,
    };
    if (payload.created_at) orderPayload.created_at = payload.created_at;
    if (payload.updated_at) orderPayload.updated_at = payload.updated_at;
    if (payload.version) orderPayload.version = payload.version;
    if (payload.remote_id) orderPayload.remote_id = payload.remote_id;

    if (!DRY_RUN) {
      db.prepare(`DELETE FROM sync_outbox WHERE id = ?`).run(item.id);
      db.prepare(`INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version, status, retry_count, tenant_id, created_at, updated_at)
        VALUES (?, 'order', ?, ?, ?, ?, 'pending', 0, ?, datetime('now'), datetime('now'))`)
        .run(newId(), item.operation, String(payload.id), JSON.stringify(orderPayload), payload.version || 1, orderPayload.tenant_id);
    }
    cleaned++;
    continue;
  }

  if (item.entity === 'order_item') {
    const quantity = Number(payload.quantity);
    const unitPrice = Number(payload.unit_price ?? payload.price);
    const itemPayload = {
      id: payload.id,
      order_id: payload.order_id,
      product_id: payload.productId ?? payload.product_id,
      quantity,
      unit_price: unitPrice,
      total_price: unitPrice * quantity,
      notes: payload.notes ?? null,
      tenant_id: payload.tenant_id,
      version: payload.version || 1,
    };

    if (!DRY_RUN) {
      db.prepare(`DELETE FROM sync_outbox WHERE id = ?`).run(item.id);
      db.prepare(`INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version, status, retry_count, tenant_id, created_at, updated_at)
        VALUES (?, 'order_item', ?, ?, ?, ?, 'pending', 0, ?, datetime('now'), datetime('now'))`)
        .run(newId(), item.operation, String(payload.id), JSON.stringify(itemPayload), payload.version || 1, itemPayload.tenant_id);
    }
    cleaned++;
  }
}

// Nettoyage: supprimer les doublons pending après réinjection
if (!DRY_RUN) {
  const dupes = db.prepare(`
    DELETE FROM sync_outbox
    WHERE id NOT IN (
      SELECT MIN(id) FROM sync_outbox
      WHERE entity IN ('order','order_item') AND status='pending'
      GROUP BY entity, record_id, payload
    )
    AND entity IN ('order','order_item') AND status='pending'
  `).run();
  console.log(`Duplicates removed: ${dupes.changes}`);
}

console.log(`Total processed: ${rows.length}`);
console.log(`Reinjected: ${cleaned}`);
if (DRY_RUN) console.log('Dry-run mode: no changes applied');
console.log('Done');
