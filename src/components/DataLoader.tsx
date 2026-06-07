import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
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
export const DataLoader = () => {
  const { user, isAuthenticated } = useAuthStore();
  const hasLoaded = useRef(false);

  useEffect(() => {
    // Only load data if authenticated and not already loaded in this session
    if (isAuthenticated && user && !hasLoaded.current) {
      console.log('[DataLoader] Initializing global data...');
      
      // 1. Set User Context in all stores that require it
      useTableStore.getState().setUserContext(user.id, user.role);
      useOrderStore.getState().setUserContext(user.id, user.role);

      // 2. Trigger parallel data fetching
      const loadInitialData = async () => {
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
        } catch (error) {
          console.error('[DataLoader] Error preloading global data:', error);
        }
      };

      loadInitialData();
    }

    // 3. Setup background polling for orders (Critical for QR Menu synchronicity)
    let orderPolling: NodeJS.Timeout | null = null;
    if (isAuthenticated && user) {
      orderPolling = setInterval(() => {
        // We only poll orders as they are the most volatile data (QR orders, status updates)
        useOrderStore.getState().fetchActiveOrders();
        useOrderStore.getState().fetchAllOrders();
        
        // Also poll tables occasionally to see status changes (occupied/free)
        useTableStore.getState().fetchTables();
      }, 10000); // Poll every 10 seconds
    }

    return () => {
      if (orderPolling) clearInterval(orderPolling);
    };
  }, [isAuthenticated, user]);

  return null; // This component doesn't render anything
};
