/**
 * Supabase Query Helper — Generic utility for reading/writing to Supabase
 *
 * Usage:
 *   import { supabaseQuery } from '../infrastructure/supabase-query';
 *   const { data } = await supabaseQuery('categories').select('*').eq('tenant_id', tenantId);
 *
 * Architecture:
 *   - Local (SQLite) remains the source of truth
 *   - This helper is ONLY called when dataSource.resolveFromRequest(req) === 'cloud'
 *   - It provides a simple interface matching the Supabase JS client
 *   - All calls include tenant_id filtering by default for multi-tenant isolation
 */

import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

let _supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient(): ReturnType<typeof createClient> {
  if (!_supabaseClient) {
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('[SupabaseQuery] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured');
    }
    _supabaseClient = createClient(url, key, { auth: { persistSession: false } });
  }
  return _supabaseClient;
}

/**
 * Returns a Supabase query builder for the given table.
 * Automatically filters by tenant_id when provided.
 */
export function supabaseQuery(tableName: string) {
  const client = getSupabaseClient();

  return {
    /**
     * Select rows from the table
     */
    select: (columns?: string) => (client.from(tableName) as any).select(columns),

    /**
     * Insert a row (or rows) into the table
     */
    insert: (values: any, options?: { returning?: string }) =>
      (client.from(tableName) as any).insert(values, options),

    /**
     * Update rows in the table
     */
    update: (values: any) => (client.from(tableName) as any).update(values),

    /**
     * Delete rows from the table
     */
    delete: () => (client.from(tableName) as any).delete(),

    /**
     * Upsert (insert or update) rows
     */
    upsert: (values: any, options?: { onConflict?: string; ignoreDuplicates?: boolean }) =>
      (client.from(tableName) as any).upsert(values, options),

    /**
     * Get a reference to the raw Supabase client (for advanced operations)
     */
    raw: () => client,
  };
}

/**
 * Resolves the Supabase table name from an entity name.
 * Mirrors the mapping in data-source-manager.ts
 */
export function getSupabaseTableName(entity: string): string {
  const tableMap: Record<string, string> = {
    product: 'products',
    category: 'categories',
    customer: 'customers',
    supplier: 'suppliers',
    table: 'tables',
    expense: 'expenses',
    sale: 'sales',
    inventory_movement: 'inventory_movements',
    user: 'users',
    order: 'orders',
    order_item: 'order_items',
    tenant: 'tenants',
    plan: 'plans',
    voucher: 'vouchers',
    subscription: 'subscriptions',
  };
  return tableMap[entity] || entity;
}

/**
 * Checks if Supabase credentials are available (useful for guards)
 */
export function isSupabaseConfigured(): boolean {
  return !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}