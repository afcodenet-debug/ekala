import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '../database/supabase.client';
import { db } from '../db/database';

const REALTIME_TABLES = [
  'tenants',
  'users',
  'tenant_users',
  'restaurant_tables',
  'orders',
  'order_items',
  'sales',
  'sale_items',
  'customers',
  'settings',
  'inventory_movements',
  'inventory_sessions',
  'stock_adjustments',
  'stock_adjustment_items',
  'purchase_orders',
  'purchase_order_items',
  'suppliers',
  'vouchers',
  'voucher_redemptions',
];

const FK_MAP: Record<string, Record<string, string>> = {
  products: { category_id: 'categories' },
  restaurant_tables: { assigned_waiter_id: 'users' },
  orders: { table_id: 'restaurant_tables', waiter_id: 'users', customer_id: 'customers' },
  order_items: { order_id: 'orders', product_id: 'products' },
  sales: { order_id: 'orders', user_id: 'users', customer_id: 'customers' },
  sale_items: { sale_id: 'sales', product_id: 'products' },
  tenant_users: { tenant_id: 'tenants', user_id: 'users' },
  inventory_movements: { product_id: 'products', created_by: 'users' },
  inventory_sessions: { created_by: 'users' },
  stock_adjustments: { session_id: 'inventory_sessions', created_by: 'users', approved_by: 'users' },
  stock_adjustment_items: { adjustment_id: 'stock_adjustments', product_id: 'products' },
  purchase_orders: { supplier_id: 'suppliers', created_by: 'users' },
  purchase_order_items: { purchase_order_id: 'purchase_orders', product_id: 'products' },
  vouchers: { plan_id: 'plans' },
  voucher_redemptions: { voucher_id: 'vouchers', tenant_id: 'tenants', subscription_id: 'subscriptions' },
};

const BOOLEAN_COLUMNS = new Set([
  'is_available',
  'is_active',
  'is_default',
  'email_enabled',
  'inapp_enabled',
  'qr_orders',
  'stock_alerts',
  'daily_reports',
  'inventory_summary',
  'payment_failed',
  'order_assigned',
  'system_errors',
  'success',
]);

const JSON_COLUMNS = new Set(['items', 'metadata', 'features', 'old_values', 'new_values']);

type RealtimeStatus = {
  enabled: boolean;
  subscribed: boolean;
  tables: string[];
  lastEventAt: string | null;
  lastError: string | null;
  eventsApplied: number;
};

let realtimeChannel: RealtimeChannel | null = null;
let realtimeStatus: RealtimeStatus = {
  enabled: false,
  subscribed: false,
  tables: [],
  lastEventAt: null,
  lastError: null,
  eventsApplied: 0,
};

function isEnabled(): boolean {
  return process.env.ENABLE_SUPABASE_REALTIME_PULL !== 'false';
}

function hasCredentials(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function tableExists(table: string): boolean {
  if (!db) return false;
  try {
    return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
  } catch {
    return false;
  }
}

function getLocalColumns(table: string): string[] {
  if (!db) return [];
  try {
    return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name);
  } catch {
    return [];
  }
}

function getDefaultTenantId(): number {
  const configured = Number(process.env.SYNC_TENANT_ID || '');
  if (configured && !Number.isNaN(configured)) return configured;
  if (!db) return 1;
  try {
    const row = db.prepare('SELECT id FROM tenants ORDER BY id LIMIT 1').get() as { id: number } | undefined;
    return row?.id || 1;
  } catch {
    return 1;
  }
}

function sanitize(value: any): any {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function resolveForeignKey(table: string, column: string, value: any): any {
  if (value === null || value === undefined) return null;
  const targetTable = FK_MAP[table]?.[column];
  if (!targetTable) return value;

  try {
    const byRemote = db.prepare(`SELECT id FROM ${targetTable} WHERE remote_id = ?`).get(value) as { id: number } | undefined;
    if (byRemote) return byRemote.id;

    const byId = db.prepare(`SELECT id FROM ${targetTable} WHERE id = ?`).get(value) as { id: number } | undefined;
    return byId ? byId.id : null;
  } catch {
    return null;
  }
}

function findLocalId(table: string, value: any): number | null {
  if (!db || value === null || value === undefined) return null;
  try {
    const byRemote = db.prepare(`SELECT id FROM ${table} WHERE remote_id = ?`).get(value) as { id: number } | undefined;
    if (byRemote) return byRemote.id;

    const byId = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(value) as { id: number } | undefined;
    return byId ? byId.id : null;
  } catch {
    return null;
  }
}

function findLocalRow(table: string, row: Record<string, any>): any {
  if (!db) return null;

  try {
    if (table === 'settings') {
      const tenantId = row.tenant_id ?? getDefaultTenantId();
      return db.prepare('SELECT key FROM settings WHERE key = ? AND tenant_id = ?').get(row.key, tenantId) as { key: string } | undefined;
    }

    if (row.remote_id !== null && row.remote_id !== undefined) {
      const byRemote = db.prepare(`SELECT id, updated_at FROM ${table} WHERE remote_id = ?`).get(row.remote_id) as { id: number; updated_at?: string } | undefined;
      if (byRemote) return byRemote;
    }

    if (row.id !== null && row.id !== undefined) {
      const byId = db.prepare(`SELECT id, updated_at FROM ${table} WHERE id = ?`).get(row.id) as { id: number; updated_at?: string } | undefined;
      if (byId) return byId;
    }

    if (table === 'restaurant_tables' && row.table_number !== undefined && row.tenant_id !== undefined) {
      return db.prepare('SELECT id, updated_at FROM restaurant_tables WHERE table_number = ? AND tenant_id = ?').get(String(row.table_number), row.tenant_id) as { id: number; updated_at?: string } | undefined;
    }

    if ((table === 'products' || table === 'categories') && row.name !== undefined && row.tenant_id !== undefined) {
      return db.prepare(`SELECT id, updated_at FROM ${table} WHERE name = ? AND tenant_id = ?`).get(row.name, row.tenant_id) as { id: number; updated_at?: string } | undefined;
    }

    if (table === 'users' && row.username !== undefined) {
      return db.prepare('SELECT id, updated_at FROM users WHERE username = ?').get(row.username) as { id: number; updated_at?: string } | undefined;
    }

    if (table === 'tenants' && row.slug !== undefined) {
      return db.prepare('SELECT id, updated_at FROM tenants WHERE slug = ?').get(row.slug) as { id: number; updated_at?: string } | undefined;
    }

    if (table === 'tenant_users' && row.tenant_id !== undefined && row.user_id !== undefined) {
      const localTenantId = findLocalId('tenants', row.tenant_id);
      const localUserId = findLocalId('users', row.user_id);
      if (localTenantId && localUserId) {
        return db.prepare('SELECT id, updated_at FROM tenant_users WHERE tenant_id = ? AND user_id = ?').get(localTenantId, localUserId) as { id: number; updated_at?: string } | undefined;
      }
    }
  } catch {
    return null;
  }

  return undefined;
}

function deleteLocalRow(table: string, row: Record<string, any>) {
  if (!db || !tableExists(table)) return;

  const local = findLocalRow(table, row);
  if (!local) return;

  if (table === 'settings') {
    db.prepare('DELETE FROM settings WHERE key = ? AND tenant_id = ?').run(row.key, row.tenant_id ?? getDefaultTenantId());
    return;
  }

  db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(local.id);
}

function buildLocalFields(table: string, row: Record<string, any>, local: any): Record<string, any> {
  const columns = getLocalColumns(table);
  const fields: Record<string, any> = {};
  const remoteId = row.id !== undefined && row.id !== null ? Number(row.id) : null;

  if (!local && remoteId !== null && !Number.isNaN(remoteId) && columns.includes('id')) {
    fields.id = remoteId;
  }

  for (const column of columns) {
    if (column === 'id' || row[column] === undefined) continue;
    fields[column] = row[column];
  }

  if (table === 'settings') {
    fields.key = row.key;
    fields.value = row.value;
    fields.tenant_id = row.tenant_id ?? getDefaultTenantId();
    fields.updated_at = row.updated_at || new Date().toISOString();
  }

  if (table === 'restaurant_tables' && fields.status === 'occupied') {
    fields.status = 'active';
  }

  if (table === 'products') {
    if (fields.cost_price !== undefined && fields.buying_price === undefined) fields.buying_price = fields.cost_price;
    if (fields.price !== undefined && fields.selling_price === undefined) fields.selling_price = fields.price;
    if (fields.low_stock_threshold !== undefined && fields.minimum_stock === undefined) fields.minimum_stock = fields.low_stock_threshold;
  }

  if (table === 'orders' && fields.items !== undefined && typeof fields.items !== 'string') {
    fields.items = JSON.stringify(fields.items);
  }

  const mapped: Record<string, any> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!columns.includes(key)) continue;
    if (key === 'tenant_id' && value === undefined) {
      mapped[key] = getDefaultTenantId();
      continue;
    }
    if (BOOLEAN_COLUMNS.has(key)) {
      mapped[key] = value ? 1 : 0;
      continue;
    }
    mapped[key] = sanitize(value);
  }

  for (const [column, targetTable] of Object.entries(FK_MAP[table] || {})) {
    if (mapped[column] === undefined || mapped[column] === null) continue;
    mapped[column] = resolveForeignKey(table, column, mapped[column]);
    if (mapped[column] === null && !columns.includes('remote_id')) continue;
  }

  return mapped;
}

function upsertLocalRow(table: string, row: Record<string, any>) {
  if (!db || !tableExists(table)) return;

  const local = findLocalRow(table, row);
  const fields = buildLocalFields(table, row, local);
  const keys = Object.keys(fields).filter((key) => fields[key] !== undefined);
  if (keys.length === 0) return;

  if (table === 'settings') {
    const existing = db.prepare('SELECT key FROM settings WHERE key = ? AND tenant_id = ?').get(row.key, fields.tenant_id) as { key: string } | undefined;
    const set = keys.filter((key) => key !== 'key').map((key) => `"${key}" = ?`).join(', ');
    const values = keys.filter((key) => key !== 'key').map((key) => fields[key]);
    if (existing) {
      db.prepare(`UPDATE settings SET ${set} WHERE key = ? AND tenant_id = ?`).run(...values, row.key, fields.tenant_id);
    } else {
      db.prepare(`INSERT INTO settings (${keys.map((key) => `"${key}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).run(...keys.map((key) => fields[key]));
    }
    return;
  }

  const set = keys.map((key) => `"${key}" = ?`).join(', ');
  const values = keys.map((key) => fields[key]);

  if (local) {
    db.prepare(`UPDATE ${table} SET ${set} WHERE id = ?`).run(...values, local.id);
    return;
  }

  const insertKeys = keys.includes('id') ? keys : ['id', ...keys];
  const insertValues = keys.includes('id') ? values : [Number(row.id), ...values];
  try {
    db.prepare(`INSERT INTO ${table} (${insertKeys.map((key) => `"${key}"`).join(', ')}) VALUES (${insertKeys.map(() => '?').join(', ')})`).run(...insertValues);
  } catch (err: any) {
    if (String(err?.code || '').includes('PRIMARY') || String(err?.message || '').includes('PRIMARY KEY')) {
      const existing = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(insertValues[0]) as { id: number } | undefined;
      if (existing) {
        db.prepare(`UPDATE ${table} SET ${set} WHERE id = ?`).run(...values, existing.id);
      }
    } else {
      throw err;
    }
  }
}

function handlePayload(payload: any) {
  const table = payload.table;
  if (!REALTIME_TABLES.includes(table) || !tableExists(table)) return;

  if (payload.eventType === 'DELETE') {
    deleteLocalRow(table, payload.old || {});
    realtimeStatus.eventsApplied++;
    realtimeStatus.lastEventAt = new Date().toISOString();
    return;
  }

  const row = payload.new || {};
  if (!row || typeof row !== 'object') return;
  upsertLocalRow(table, row);
  realtimeStatus.eventsApplied++;
  realtimeStatus.lastEventAt = new Date().toISOString();
}

export function startSupabaseRealtimePull(): void {
  if (!db || !hasCredentials() || !isEnabled() || realtimeChannel) return;

  const supabase = getSupabaseClient();
  const channel = supabase.channel('sqlite-realtime-pull');
  realtimeStatus.enabled = true;
  realtimeStatus.tables = REALTIME_TABLES;

  for (const table of REALTIME_TABLES) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, handlePayload);
  }

  channel.subscribe((status, error) => {
    if (status === 'SUBSCRIBED') {
      realtimeStatus.subscribed = true;
      realtimeStatus.lastError = null;
      console.log('[SupabaseRealtime] Subscribed to Supabase changes for SQLite pull');
      return;
    }
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      realtimeStatus.subscribed = false;
      realtimeStatus.lastError = error?.message || status;
      console.error('[SupabaseRealtime] Subscription failed:', realtimeStatus.lastError);
    }
  });

  realtimeChannel = channel;
}

export function stopSupabaseRealtimePull(): void {
  if (realtimeChannel) {
    realtimeChannel.unsubscribe();
    realtimeChannel = null;
  }
  realtimeStatus.subscribed = false;
  realtimeStatus.enabled = false;
}

export function getSupabaseRealtimeStatus(): RealtimeStatus {
  return { ...realtimeStatus };
}
