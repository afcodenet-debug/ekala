/**
 * Billing API Service V1.1
 * 
 * Frontend service for subscription and voucher operations.
 * Provides type-safe API calls to the billing backend.
 */

export interface ActivateSubscriptionRequest {
  code: string;
  tenant_id: string;
  idempotency_key: string;
}

export interface ActivateSubscriptionResponse {
  status: 'SUCCESS' | 'FAILED';
  subscription?: {
    tenant_id: string;
    plan: string;
    status: string;
    end_date: string;
    activation_source: string;
  };
  error?: string;
}

export interface SubscriptionStatusResponse {
  active: boolean;
  plan?: string;
  expires_at?: string;
  state?: string;
  planName?: string;
  daysUntilRenewal?: number;
}

export interface RateLimitResponse {
  remaining: number;
  reset_after: number;
}

export class BillingError extends Error {
  code: string;
  details?: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'BillingError';
  }
}

/**
 * Billing API Service
 * Handles all subscription and voucher operations
 */
export class BillingAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  /**
   * Activate subscription with voucher code
   * @param request - Activation request with code, tenant_id, and idempotency_key
   * @returns Activation result with subscription details
   * @throws BillingError if activation fails
   */
  async activateSubscription(request: ActivateSubscriptionRequest): Promise<ActivateSubscriptionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/subscription/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new BillingError(
          errorData.error || 'SUBSCRIPTION_ERROR',
          errorData.message || 'Failed to activate subscription',
          errorData
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof BillingError) {
        throw error;
      }
      throw new BillingError('NETWORK_ERROR', 'Network error occurred', error);
    }
  }

  /**
   * Get subscription status for a tenant
   * @param tenantId - Tenant ID to check
   * @returns Subscription status with plan and expiration info
   * @throws BillingError if request fails
   */
  async getSubscriptionStatus(tenantId: string): Promise<SubscriptionStatusResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/subscription/status/${encodeURIComponent(tenantId)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new BillingError(
          errorData.error || 'SUBSCRIPTION_ERROR',
          errorData.message || 'Failed to get subscription status',
          errorData
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof BillingError) {
        throw error;
      }
      throw new BillingError('NETWORK_ERROR', 'Network error occurred', error);
    }
  }

  /**
   * Get rate limit information for a tenant
   * @param tenantId - Tenant ID to check
   * @returns Rate limit info with remaining attempts and reset time
   * @throws BillingError if request fails
   */
  async getRateLimit(tenantId: string): Promise<RateLimitResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/subscription/rate-limit/${encodeURIComponent(tenantId)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new BillingError(
          errorData.error || 'SUBSCRIPTION_ERROR',
          errorData.message || 'Failed to get rate limit info',
          errorData
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof BillingError) {
        throw error;
      }
      throw new BillingError('NETWORK_ERROR', 'Network error occurred', error);
    }
  }

  /**
   * Check if a tenant has an active subscription
   * @param tenantId - Tenant ID to check
   * @returns true if subscription is active, false otherwise
   */
  async isSubscriptionActive(tenantId: string): Promise<boolean> {
    try {
      const status = await this.getSubscriptionStatus(tenantId);
      return status.active === true;
    } catch (error) {
      console.error('Failed to check subscription status:', error);
      return false;
    }
  }

  /**
   * Get subscription plan details
   * @param tenantId - Tenant ID to check
   * @returns Plan name or undefined if no subscription
   */
  async getSubscriptionPlan(tenantId: string): Promise<string | undefined> {
    try {
      const status = await this.getSubscriptionStatus(tenantId);
      return status.plan;
    } catch (error) {
      console.error('Failed to get subscription plan:', error);
      return undefined;
    }
  }

  /**
   * Get days until subscription renewal
   * @param tenantId - Tenant ID to check
   * @returns Days until renewal or undefined
   */
  async getDaysUntilRenewal(tenantId: string): Promise<number | undefined> {
    try {
      const status = await this.getSubscriptionStatus(tenantId);
      return status.daysUntilRenewal;
    } catch (error) {
      console.error('Failed to get days until renewal:', error);
      return undefined;
    }
  }
}

/**
 * Singleton instance of BillingAPI
 */
export const billingAPI = new BillingAPI();

/**
 * React Hook for billing operations
 * Provides easy access to billing API in React components
 */
export function useBilling() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<BillingError | null>(null);

  const activateSubscription = async (request: ActivateSubscriptionRequest) => {
    setLoading(true);
    setError(null);
    try {
      const result = await billingAPI.activateSubscription(request);
      return result;
    } catch (err) {
      const billingError = err instanceof BillingError ? err : new BillingError('UNKNOWN', 'Unknown error');
      setError(billingError);
      throw billingError;
    } finally {
      setLoading(false);
    }
  };

  const getStatus = async (tenantId: string) => {
    setLoading(true);
    setError(null);
    try {
      return await billingAPI.getSubscriptionStatus(tenantId);
    } catch (err) {
      const billingError = err instanceof BillingError ? err : new BillingError('UNKNOWN', 'Unknown error');
      setError(billingError);
      throw billingError;
    } finally {
      setLoading(false);
    }
  };

  const checkRateLimit = async (tenantId: string) => {
    setLoading(true);
    setError(null);
    try {
      return await billingAPI.getRateLimit(tenantId);
    } catch (err) {
      const billingError = err instanceof BillingError ? err : new BillingError('UNKNOWN', 'Unknown error');
      setError(billingError);
      throw billingError;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    activateSubscription,
    getStatus,
    checkRateLimit,
    isSubscriptionActive: (tenantId: string) => billingAPI.isSubscriptionActive(tenantId),
    getSubscriptionPlan: (tenantId: string) => billingAPI.getSubscriptionPlan(tenantId),
    getDaysUntilRenewal: (tenantId: string) => billingAPI.getDaysUntilRenewal(tenantId),
  };
}

// Import React for the hook
import React from 'react';