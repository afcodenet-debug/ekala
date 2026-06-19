import { AsyncLocalStorage } from 'async_hooks';

/**
 * Context structure for multi-tenant isolation.
 */
export interface TenantContext {
  tenantId: number;
  userId?: number;
}

/**
 * Global storage for request-scoped tenant information.
 */
export const tenantStorage = new AsyncLocalStorage<TenantContext>();

/**
 * Helper to get the current tenant ID from context.
 * @throws Error if no tenant context is set (ensures tenant isolation - no silent fallback)
 */
export function getCurrentTenantId(): number {
  const tenantId = tenantStorage.getStore()?.tenantId;
  if (!tenantId) {
    throw new Error('TENANT_CONTEXT_REQUIRED: No tenant_id in context. Ensure request goes through requireTenantScope middleware.');
  }
  return tenantId;
}

/**
 * Helper to run a function within a specific tenant context.
 */
export function runWithTenantContext<T>(context: TenantContext, fn: () => T): T {
  return tenantStorage.run(context, fn);
}

/**
 * Safely get the current tenant ID from context, returning undefined if not set.
 * Use this for cases where tenant context is optional.
 */
export function getTenantIdOptional(): number | undefined {
  return tenantStorage.getStore()?.tenantId;
}
