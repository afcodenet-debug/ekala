import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
// setSubscriptionBlocked was removed from api-client - subscription gating is now handled by SubscriptionGate component
import { api } from '../lib/api-client';
import { setSubscriptionReady } from '../services/bootstrap.service';

export type SubscriptionState = 'loading' | 'active' | 'trial' | 'grace' | 'suspended' | 'cancelled' | 'expired' | 'no_plan' | 'pending' | 'blocked' | 'unknown';

export interface SubscriptionInfo {
  state: SubscriptionState;
  planName: string | null;
  daysUntilRenewal: number | null;
  graceDaysRemaining: number | null;
  isExpired: boolean;
  isGracePeriod: boolean;
}

interface SubscriptionContextValue {
  info: SubscriptionInfo | null;
  state: SubscriptionState;
  isLoading: boolean;
  isBlocked: boolean;
  isReady: boolean;
  block: () => void;
  unblock: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  info: null,
  state: 'loading',
  isLoading: true,
  isBlocked: false,
  isReady: false,
  block: () => {},
  unblock: () => {},
});

export const useSubscription = () => useContext(SubscriptionContext);

// ACTIVE states: never block
const ACTIVE_STATES: SubscriptionState[] = ['active', 'trial'];

export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [state, setState] = useState<SubscriptionState>('loading');
  const [isBlocked, setIsBlocked] = useState(false);
  const [backendStatus, setBackendStatus] = useState<string | null>(null);

  // Fetch subscription status from backend API (source of truth)
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setInfo(null);
      setState('loading');
      setIsBlocked(false);
      setBackendStatus(null);
      setSubscriptionReady(false);
      console.log('[SubscriptionContext] No user - reset to loading');
      return;
    }

    let cancelled = false;

    const fetchSubscription = async () => {
      try {
        console.log('[SubscriptionContext] Fetching /api/billing/status...');
        const response = await api.get<any>('/billing/status');
        
        if (cancelled) return;

        console.log('[Subscription API RAW]', JSON.stringify(response));

        // API /api/billing/status returns: { subscription_status, plan_code, plan_id, expires_at, ... }
        // NOT { subscription: { status } }
        const rawStatus = response?.subscription_status || null;

        console.log('[Subscription API] Mapped status:', rawStatus);

        setBackendStatus(rawStatus);

        // Build a subscription-like object from the flat API response
        const subFromResponse = {
          status: rawStatus,
          plan_name: response?.plan_code || null,
          current_period_end: response?.expires_at || null,
          plan_id: response?.plan_id || null,
        };

        if (!rawStatus) {
          const userAny = user as any;
          const fallbackStatus = userAny.status || 'trial';
          resolveState(fallbackStatus, userAny);
          return;
        }

        resolveState(rawStatus, subFromResponse);

      } catch (error: any) {
        if (cancelled) return;
        console.warn('[SubscriptionContext] Failed to fetch billing status:', error.message);
        
        const userAny = user as any;
        const fallbackStatus = userAny.status || 'trial';
        console.log('[SubscriptionContext] Falling back to user.status:', fallbackStatus);
        resolveState(fallbackStatus, userAny);
      }
    };

    const resolveState = (rawStatus: string, source: any) => {
      let subState: SubscriptionState;
      
      if (rawStatus === 'active') {
        subState = 'active';
      } else if (rawStatus === 'trialing' || rawStatus === 'trial') {
        subState = 'trial';
      } else if (rawStatus === 'grace') {
        subState = 'grace';
      } else if (rawStatus === 'suspended') {
        subState = 'suspended';
      } else if (rawStatus === 'cancelled') {
        subState = 'cancelled';
      } else if (rawStatus === 'expired') {
        subState = 'expired';
      } else if (rawStatus === 'pending') {
        subState = 'pending';
      } else if (rawStatus === 'no_plan') {
        subState = 'no_plan';
      } else {
        subState = 'trial';
      }

      const blocked = !ACTIVE_STATES.includes(subState);

      const now = Date.now();
      const expiresAt = source?.current_period_end || source?.expires_at 
        ? new Date(source?.current_period_end || source?.expires_at).getTime() 
        : null;
      const isExpired = expiresAt ? expiresAt < now : false;

      const subscriptionInfo: SubscriptionInfo = {
        state: subState,
        planName: source?.plan_name || source?.planName || null,
        daysUntilRenewal: expiresAt ? Math.ceil((expiresAt - now) / 86_400_000) : null,
        graceDaysRemaining: null,
        isExpired,
        isGracePeriod: subState === 'grace',
      };

      console.log('[FINAL STATE CHECK]', {
        backendStatus: rawStatus,
        frontendStatus: subState,
        blocked,
        rawResponse: source
      });

      if (!cancelled) {
        setInfo(subscriptionInfo);
        setState(subState);
        setIsBlocked(blocked);
        // Subscription gating is handled by SubscriptionGate component in App.tsx
        // NOTIFY BootstrapService that subscription is resolved
        setSubscriptionReady(true);
      }
    };

    fetchSubscription();

    return () => { cancelled = true; };
  }, [isAuthenticated, user]);

  const block = useCallback(() => {
    setIsBlocked(true);
  }, []);
  
  const unblock = useCallback(() => {
    setIsBlocked(false);
  }, []);

  const isLoading = state === 'loading' || state === 'unknown';
  const isReady = !isLoading && !isBlocked;

  console.log('[BillingState]', {
    subscriptionStatus: state,
    subscriptionBlocked: isBlocked,
    loading: isLoading,
    ready: isReady,
    backendStatus
  });

  return (
    <SubscriptionContext.Provider value={{ info, state, isLoading, isBlocked, isReady, block, unblock }}>
      {children}
    </SubscriptionContext.Provider>
  );
};