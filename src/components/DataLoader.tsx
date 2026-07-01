import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useBillingStatus } from '../hooks/useBillingStatus';
import { useTableStore } from '../stores/useTableStore';
import { useProductStore } from '../features/products/hooks/useProductStore';
import { useOrderStore } from '../stores/useOrderStore';
import { usePOSStore } from '../stores/usePOSStore';
import { useExpenseStore } from '../stores/useExpenseStore';

/**
 * DataLoader component handles the initial fetching of all required data
 * once the user is authenticated. This ensures that data is available 
 * across all pages (POS, Tables, etc.) without needing to visit specific pages first.
 */
// Guard pour éviter les doubles initialisations
let globalInitialized = false;
let globalLoadingPromise: Promise<void> | null = null;

export const DataLoader = () => {
  const { user, isAuthenticated } = useAuthStore();
  const { status: billingStatus, loading: billingLoading } = useBillingStatus(user?.tenant_id?.toString() || null);
  const hasLoaded = useRef(false);

  useEffect(() => {
    // GATING: Ne rien charger si pas authentifié
    if (!isAuthenticated || !user) {
      console.log('[DataLoader] Not authenticated, skipping data load');
      return;
    }

    // GATING: Ne rien charger si subscription pas active
    if (billingLoading) {
      console.log('[DataLoader] Waiting for billing status...');
      return;
    }

    if (billingStatus && !billingStatus.active) {
      console.log('[DataLoader] Subscription not active, skipping data load');
      return;
    }

    // GUARD: Une seule initialisation globale
    if (globalInitialized) {
      console.log('[DataLoader] Already initialized globally, skipping');
      return;
    }

    if (globalLoadingPromise) {
      console.log('[DataLoader] Loading in progress, waiting...');
      return;
    }

    // Only load data if authenticated and not already loaded in this session
    if (!hasLoaded.current) {
      console.log('[DataLoader] Initializing global data...');
      
      // 1. Set User Context in all stores that require it
      useTableStore.getState().setUserContext(user.id, user.role);
      useOrderStore.getState().setUserContext(user.id, user.role);

      // 2. Trigger parallel data fetching
      globalLoadingPromise = (async () => {
        try {
          await Promise.allSettled([
            useTableStore.getState().fetchTables(),
            useProductStore.getState().fetchProducts(),
            useOrderStore.getState().fetchActiveOrders(),
            useOrderStore.getState().fetchAllOrders(),
            usePOSStore.getState().loadProducts(),
            (user.role === 'admin' || user.role === 'manager') 
              ? useExpenseStore.getState().fetchExpenses() 
              : Promise.resolve()
          ]);
          
          console.log('[DataLoader] Global data preloaded successfully');
          hasLoaded.current = true;
          globalInitialized = true;
        } catch (error) {
          console.error('[DataLoader] Error preloading global data:', error);
          globalLoadingPromise = null; // Retry au prochain appel
        }
      })();

      // Note: Pas de await ici, on laisse la promise se résoudre
    }

    // 3. Setup background polling for orders (Critical for QR Menu synchronicity)
    let orderPolling: NodeJS.Timeout | null = null;
    if (isAuthenticated && user) {
      orderPolling = setInterval(() => {
        // Use 'silent' mode (true) to refresh data WITHOUT triggering UI loading flickers
        useOrderStore.getState().fetchActiveOrders(true);
        useOrderStore.getState().fetchAllOrders(true);
        
        // Also poll tables occasionally to see status changes (occupied/free)
        useTableStore.getState().fetchTables(true);
      }, 10000); // Poll every 10 seconds
    }

    return () => {
      if (orderPolling) clearInterval(orderPolling);
    };
  }, [isAuthenticated, user, billingLoading, billingStatus]);

  return null; // This component doesn't render anything
};
