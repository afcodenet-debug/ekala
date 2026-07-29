// src/server/services/supabase-pull-sync.service.ts (copy for PR artifact)

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { db } from '../db/database';
import { dataSource } from '../infrastructure/data-source-manager';

let pullInterval: NodeJS.Timeout | null = null;
let isPulling = false;
let hasDoneBootstrap = false;
let consecutiveEmptyCycles = 0;

interface PullStatus { /* trimmed for artifact */ }

function getPullConfig(): any {
  const explicit = process.env.ENABLE_SUPABASE_PULL;
  const dbAvailable = !!db;
  let enabled = explicit === 'true' || explicit === '1';
  if (dataSource.isCloud()) enabled = false;
  if (!dbAvailable) enabled = false;
  return {
    enabled,
    intervalMs: parseInt(process.env.SUPABASE_PULL_INTERVAL_MS || '5000', 10),
    lookbackMinutes: parseInt(process.env.SUPABASE_PULL_LOOKBACK_MIN || '60', 10),
  };
}

function getSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('[PullSync] Credentials missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

function ensureRemoteSyncSchema() {
  if (!db) return;
  try {
    const orderCols = db.prepare("PRAGMA table_info(orders)").all() as any[];
    const orderNames = orderCols.map(c => c.name);
    if (!orderNames.includes('remote_id')) db.exec(`ALTER TABLE orders ADD COLUMN remote_id INTEGER`);
    if (!orderNames.includes('source')) db.exec(`ALTER TABLE orders ADD COLUMN source TEXT DEFAULT 'local'`);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_remote_id ON orders(remote_id) WHERE remote_id IS NOT NULL`);
  } catch {}
}

export async function runSupabasePullOnce(): Promise<void> { /* trimmed */ }

async function pullOrders(supabase: SupabaseClient, since: string, tenantId: number): Promise<number> {
  let count = 0;
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('tenant_id', tenantId)
      .or(`updated_at.gte.${since},created_at.gte.${since}`)
      .order('updated_at', { ascending: true });

    if (error) {
      console.warn(`[PullSync] Failed to pull orders for tenant #${tenantId}:`, error.message);
      return 0;
    }
    if (!orders || orders.length === 0) return 0;

    for (const o of orders as any[]) {
        try {
          const degraded = db.prepare('SELECT 1 FROM sync_degraded_mode WHERE entity = ? AND record_id = ?').get('order', String(o.id));
          if (degraded) {
            console.log(`[PullSync] Skipping degraded order #${o.id}`);
            continue;
          }
        } catch {}
      try {
        const existing = db.prepare('SELECT id FROM orders WHERE remote_id = ?').get(o.id) as any;
        // mapping and insertion/upsert logic (unchanged)
      } catch (orderErr: any) {
        console.warn(`[PullSync] ⚠️ Skipping order #${o.id}: ${orderErr.message}`);
        try {
          db.prepare(`INSERT INTO sync_degraded_mode (entity, record_id, reason, last_error, created_at) VALUES (?,?,?,?,?)`).run('order', String(o.id), 'skip_conflict', orderErr.message, new Date().toISOString());
          console.log(`[PullSync] Marked order #${o.id} as degraded`);
        } catch (e) { /* best-effort */ }
      }
    }
  } catch (e: any) {
    console.warn(`[PullSync] orders error for tenant #${tenantId}:`, e.message);
  }
  return count;
}
