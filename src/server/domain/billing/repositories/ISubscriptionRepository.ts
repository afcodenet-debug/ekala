/**
 * Subscription Repository Interface (V1.1)
 * 
 * Handles persistence operations for Subscription aggregate.
 * Follows Repository pattern for domain-driven design.
 */

import { Subscription } from '../subscription/Subscription';

export interface ISubscriptionRepository {
  /**
   * Find subscription by tenant ID
   * @param tenantId - Tenant UUID
   * @param tx - Optional transaction context
   * @returns Subscription or null if not found
   */
  findByTenantId(tenantId: string, tx?: any): Promise<Subscription | null>;

  /**
   * Find subscription by tenant ID with FOR UPDATE lock
   * CRITICAL: Used to prevent race conditions during activation
   * @param tenantId - Tenant UUID
   * @param tx - Transaction context (required)
   * @returns Subscription or null if not found
   */
  findByTenantIdForUpdate(tenantId: string, tx: any): Promise<Subscription | null>;

  /**
   * Upsert subscription (INSERT or UPDATE on conflict)
   * CRITICAL: Guarantees 1 subscription per tenant
   * @param data - Partial subscription data
   * @param tx - Transaction context (required)
   */
  upsert(data: Partial<Subscription>, tx: any): Promise<void>;

  /**
   * Save subscription (INSERT or UPDATE)
   * @param subscription - Subscription to save
   * @param tx - Optional transaction context
   */
  save(subscription: Subscription, tx?: any): Promise<void>;
}