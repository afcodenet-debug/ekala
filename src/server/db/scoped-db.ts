import { getCurrentTenantId } from './tenant-context';

/**
 * List of tables that MUST be isolated by tenant_id.
 */
const MULTI_TENANT_TABLES = [
  'products',
  'categories',
  'orders',
  'order_items',
  'sales',
  'sale_items',
  'restaurant_tables',
  'users',
  'expenses',
  'customers',
  'inventory_movements',
  'suppliers',
  'purchase_orders',
  'stock_adjustments'
];

/**
 * Heuristic to detect if a query targets a multi-tenant table.
 */
function isMultiTenantQuery(sql: string): boolean {
  const normalizedSql = sql.toLowerCase();
  return MULTI_TENANT_TABLES.some(table => 
    normalizedSql.includes(` ${table}`) || 
    normalizedSql.includes(`"${table}"`) || 
    normalizedSql.includes(`'${table}'`)
  );
}

/**
 * Injects 'tenant_id = ?' into an SQL query if needed.
 */
function injectTenantFilter(sql: string, tenantId: number): { sql: string; injected: boolean } {
  if (!isMultiTenantQuery(sql)) return { sql, injected: false };
  if (sql.toLowerCase().includes('tenant_id')) return { sql, injected: false };

  const normalizedSql = sql.toUpperCase();
  
  // SELECT queries
  if (normalizedSql.startsWith('SELECT')) {
    const whereIdx = normalizedSql.indexOf('WHERE');
    const orderByIdx = normalizedSql.indexOf('ORDER BY');
    const limitIdx = normalizedSql.indexOf('LIMIT');
    const groupByIdx = normalizedSql.indexOf('GROUP BY');
    
    let insertAt = sql.length;
    if (orderByIdx >= 0) insertAt = Math.min(insertAt, orderByIdx);
    if (limitIdx >= 0) insertAt = Math.min(insertAt, limitIdx);
    if (groupByIdx >= 0) insertAt = Math.min(insertAt, groupByIdx);

    if (whereIdx >= 0) {
      // Already has WHERE, add AND
      const prefix = sql.slice(0, whereIdx + 5);
      const suffix = sql.slice(whereIdx + 5);
      return { sql: `${prefix} tenant_id = ${tenantId} AND ${suffix}`, injected: true };
    } else {
      // No WHERE, insert it
      const prefix = sql.slice(0, insertAt);
      const suffix = sql.slice(insertAt);
      return { sql: `${prefix} WHERE tenant_id = ${tenantId} ${suffix}`, injected: true };
    }
  }

  // UPDATE / DELETE queries
  if (normalizedSql.startsWith('UPDATE') || normalizedSql.startsWith('DELETE')) {
    const whereIdx = normalizedSql.indexOf('WHERE');
    if (whereIdx >= 0) {
      const prefix = sql.slice(0, whereIdx + 5);
      const suffix = sql.slice(whereIdx + 5);
      return { sql: `${prefix} tenant_id = ${tenantId} AND ${suffix}`, injected: true };
    } else {
      return { sql: `${sql} WHERE tenant_id = ${tenantId}`, injected: true };
    }
  }

  // INSERT queries
  if (normalizedSql.startsWith('INSERT')) {
    if (sql.toLowerCase().includes('tenant_id')) return { sql, injected: false };

    // Find the positions of the columns list and values list
    const openParenIdx = sql.indexOf('(');
    const closeParenIdx = sql.indexOf(')');
    const valuesIdx = normalizedSql.indexOf('VALUES');

    if (openParenIdx >= 0 && closeParenIdx > openParenIdx && valuesIdx > closeParenIdx) {
      const colsPart = sql.slice(openParenIdx + 1, closeParenIdx);
      const valuesPartStart = sql.indexOf('(', valuesIdx);
      const valuesPartEnd = sql.lastIndexOf(')');

      if (valuesPartStart >= 0 && valuesPartEnd > valuesPartStart) {
        const valuesPart = sql.slice(valuesPartStart + 1, valuesPartEnd);
        
        const newSql = `${sql.slice(0, openParenIdx + 1)}tenant_id, ${colsPart})${sql.slice(closeParenIdx + 1, valuesPartStart + 1)}${tenantId}, ${valuesPart})${sql.slice(valuesPartEnd + 1)}`;
        return { sql: newSql, injected: true };
      }
    }
  }

  return { sql, injected: false };
}

/**
 * Scoped Database Wrapper
 * Intercepts calls to better-sqlite3 to enforce tenant isolation.
 */
export function createScopedDb(db: any) {
  if (!db) return null;

  return new Proxy(db, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);
      
      if (prop === 'prepare' && typeof original === 'function') {
        return function(sql: string) {
          const tenantId = getCurrentTenantId();
          
          if (tenantId) {
            const { sql: scopedSql, injected } = injectTenantFilter(sql, tenantId);
            if (injected) {
              // console.log(`[ScopedDB] Auto-injected tenant filter: ${scopedSql}`);
              return original.call(target, scopedSql);
            }
          }
          
          return original.apply(target, arguments);
        };
      }
      
      if (typeof original === 'function') {
        return original.bind(target);
      }
      
      return original;
    }
  });
}
