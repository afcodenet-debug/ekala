import { create } from 'zustand';
import { api } from '../lib/api-client';
import { withOutboxTransaction } from '../sync/with-outbox-transaction';
import { useAuthStore } from './useAuthStore';
import { networkErrorHandler } from '../lib/network-error-handler';
// Note: real outbox queuing for offline happens in Electron main process via IPC.
// Renderer calls here are best-effort / will be wired when local DB writes move to main.

export interface OrderItem {
  product_id: number;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: number;
  table_id: number;
  waiter_id: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled' | 'rejected';
  items: OrderItem[];
  total: number;
  created_at: string;
  table_number?: string;
  waiter_name?: string;
  waiter_role?: string;
  payment_status?: 'unpaid' | 'paid' | 'refunded';
  payment_method?: string;
  items_count?: number;
  duration_minutes?: number;
  customer_id?: number | null;
  customer_phone?: string;
  customer_name?: string;
  // QR / remote orders (pulled from Supabase via the light pull worker)
  remote_id?: number;
  source?: 'local' | 'qr' | string;
}

interface OrderStore {
  activeOrders: Order[];
  allOrders: Order[];
  stats: {
    active_orders: number;
    preparing_orders: number;
    ready_orders: number;
    served_orders: number;
    paid_orders: number;
    revenue_today: number;
  };
  filters: {
    status?: string;
    payment_status?: string;
    table_id?: number;
    search?: string;
  };
  userId?: number;
  role?: string;
  pendingQrCount: number;
  _tokenExpired: boolean;
  setUserContext: (userId: number, role: string) => void;
  setFilters: (filters: Partial<OrderStore['filters']>) => void;
  fetchActiveOrders: (silent?: boolean) => Promise<void>;
  fetchAllOrders: (silent?: boolean) => Promise<void>;
  createOrder: (order: Omit<Order, 'id' | 'created_at'>) => Promise<Order | null>;
  updateOrderItems: (id: number, items: OrderItem[]) => Promise<void>;
  updateOrderStatus: (id: number, status: Order['status']) => Promise<void>;
  deleteOrder: (id: number) => Promise<void>;
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  activeOrders: [],
  allOrders: [],
  stats: {
    active_orders: 0,
    preparing_orders: 0,
    ready_orders: 0,
    served_orders: 0,
    paid_orders: 0,
    revenue_today: 0
  },
  filters: {},
  userId: undefined,
  role: undefined,
  pendingQrCount: 0,
  _tokenExpired: false,

  setUserContext: (userId, role) => set({ userId, role }),

  setFilters: (newFilters) => set((state) => ({
    filters: { ...state.filters, ...newFilters }
  })),

  fetchActiveOrders: async (silent = false) => {
    const { userId, role, _tokenExpired } = get();
    
    // Guard: don't fetch if not authenticated or token expired
    if (!useAuthStore.getState().isAuthenticated || _tokenExpired) {
      return;
    }
    
    try {
      const params: Record<string, string | number> = {};
      if (userId && role) {
        params.waiter_id = userId;
        params.role = role;
      }
      if (!silent) console.log('[OrderStore] Fetching active orders...');
      
      // Use network error handler with retry
      const orders = await networkErrorHandler.executeWithRetry(
        () => api.orders.getAll(params),
        'fetch_active_orders',
        'Fetch active orders'
      );
      
      set({ activeOrders: Array.isArray(orders) ? orders : [] });
    } catch (err) {
      // Silently fail if not authenticated (token expired)
      if ((err as any)?.status === 401) {
        return;
      }
      console.error('Failed to fetch active orders', err);
      set({ activeOrders: [] });
    }
  },

  fetchAllOrders: async (silent = false) => {
    const { userId, role, filters, _tokenExpired } = get();
    
    // Guard: don't fetch if token expired
    if (_tokenExpired) {
      return;
    }
    
    try {
      const params: Record<string, string | number> = {};
      if (userId && role) {
        params.waiter_id = userId;
        params.role = role;
      }
      if (filters.status) params.status = filters.status;
      if (filters.payment_status) params.payment_status = filters.payment_status;
      if (filters.table_id) params.table_id = filters.table_id;
      if (filters.search) params.search = filters.search;

      if (!silent) console.log('[OrderStore] Fetching orders with params:', params);
      
      // Use network error handler with retry
      const response: any = await networkErrorHandler.executeWithRetry(
        () => api.orders.getAllOrders(params),
        'fetch_all_orders',
        'Fetch all orders'
      );

      if (response && typeof response === 'object' && Array.isArray(response.orders)) {
        if (!silent) console.log('[OrderStore] Received orders:', response.orders.length);

        const orders = response.orders as Order[];
        // Centralised pending QR detection (used by Sidebar badge + global toast)
        const pendingQr = orders.filter(o => o.status === 'pending');
        const pendingQrCount = pendingQr.length;

        set({
          allOrders: orders,
          stats: (response.stats as OrderStore['stats']) || get().stats,
          pendingQrCount
        });
      } else {
        console.warn('[OrderStore] Invalid response format:', response);
        set({ allOrders: [], pendingQrCount: 0 });
      }
    } catch (err) {
      console.error('Failed to fetch all orders:', err);
      set({ allOrders: [] });
    }
  },

  createOrder: async (orderData) => {
    try {
      const newOrder: any = await api.orders.create(orderData);
      if (newOrder) {
        set({ activeOrders: [...get().activeOrders, newOrder as Order] });

        // === TRANSACTIONAL OUTBOX QUEUE (enforced for future offline-first) ===
        // When running in Electron main with local SQLite, the real DB write + queue
        // would happen inside this transaction. Renderer currently only calls the API.
        try {
          withOutboxTransaction(null, 'default-business', () => {
            // In full offline mode we would also do the local INSERT here
            // and then: orderSyncService.queueChangeInsideTransaction('order', 'insert', newOrder);
            console.log('[OrderStore] Order created via API — outbox queue will be handled by main-process sync engine');
          });
        } catch (syncErr) {
          console.warn('[OrderStore] Outbox transaction wrapper failed (non-blocking)', syncErr);
        }

        return newOrder as Order;
      }
      return null;
    } catch (err) {
      console.error('Failed to create order', err);
      return null;
    }
  },

  updateOrderItems: async (id, items) => {
    try {
      await api.orders.updateItems(id, items);
      get().fetchActiveOrders();
    } catch (err) {
      console.error('Failed to update items', err);
    }
  },

  updateOrderStatus: async (id, status) => {
    try {
      const { role } = get();
      await api.orders.updateStatus(id, status, role);

      // Enforce transaction layer for future offline sync (no-op in current renderer context)
      try {
        withOutboxTransaction(null, 'default-business', () => {
          // When local writes are done in main: 
          //   orderSyncService.queueChangeInsideTransaction('order', 'update', { id, status, ... });
          console.log(`[OrderStore] Status update for order ${id} — will be queued by sync engine`);
        });
      } catch (syncErr) {
        console.warn('[OrderStore] Transaction wrapper for order status failed (non-blocking)', syncErr);
      }

      get().fetchActiveOrders();
    } catch (err) {
      console.error('Failed to update status', err);
    }
  },

  deleteOrder: async (id) => {
    try {
      const { role, _tokenExpired } = get();
      if (_tokenExpired) throw new Error('Token expired');
      
      await api.orders.delete(id, role);
      // remove locally and refetch for consistency
      set({
        allOrders: get().allOrders.filter(o => o.id !== id),
        activeOrders: get().activeOrders.filter(o => o.id !== id)
      });
      // background refresh stats etc.
      get().fetchAllOrders();
    } catch (err) {
      console.error('Failed to delete order', err);
      throw err;
    }
  }
}));

// Listen for global token expiration event
if (typeof window !== 'undefined') {
  window.addEventListener('auth:token-expired', () => {
    console.warn('[OrderStore] Token expired - stopping all polling');
    useOrderStore.setState({ _tokenExpired: true });
  });
}

// Auto-feed the global notification store when new QR orders arrive
// Robust ID-based tracking to avoid duplicate notifications during polling/sync
import { useNotificationStore } from './useNotificationStore';

// Use sessionStorage to persist notified IDs across page refreshes
const NOTIFIED_ORDERS_KEY = 'ekala_notified_order_ids';

function loadNotifiedOrderIds(): Set<number> {
  try {
    const saved = sessionStorage.getItem(NOTIFIED_ORDERS_KEY);
    return saved ? new Set(JSON.parse(saved) as number[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveNotifiedOrderIds(ids: Set<number>) {
  try {
    sessionStorage.setItem(NOTIFIED_ORDERS_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Silent fail if sessionStorage is unavailable
  }
}

const notifiedOrderIds = loadNotifiedOrderIds();

// Also track recently notified orders to prevent rapid re-notification
// during polling (orders that were just notified in the last 30 seconds)
const recentlyNotified = new Map<number, number>();

function shouldNotify(orderId: number): boolean {
  // Check if we've notified about this order in the current session
  if (notifiedOrderIds.has(orderId)) {
    return false;
  }
  
  // Check if we've notified about this order recently (within last 30 seconds)
  const lastNotified = recentlyNotified.get(orderId);
  if (lastNotified && Date.now() - lastNotified < 30000) {
    return false;
  }
  
  return true;
}

function markAsNotified(orderId: number) {
  notifiedOrderIds.add(orderId);
  recentlyNotified.set(orderId, Date.now());
  saveNotifiedOrderIds(notifiedOrderIds);
  
  // Cleanup recent notifications older than 30 seconds
  const now = Date.now();
  for (const [id, timestamp] of recentlyNotified.entries()) {
    if (now - timestamp > 30000) {
      recentlyNotified.delete(id);
    }
  }
}

useOrderStore.subscribe((state) => {
  const pendingOrders = state.allOrders.filter(o => o.status === 'pending');
  
  // Find truly new pending orders that we haven't notified about yet
  const newPendingOrders = pendingOrders.filter(o => shouldNotify(o.id));
  
  if (newPendingOrders.length > 0) {
    newPendingOrders.forEach(order => {
      // Mark as notified immediately to prevent re-triggering
      markAsNotified(order.id);
      
      const isQr = order.source === 'qr';
      
      useNotificationStore.getState().addNotification({
        type: isQr ? 'newQrOrder' : 'orderAssigned',
        title: isQr ? 'Nouvelle commande QR' : 'Nouvelle commande POS',
        message: isQr 
          ? `Table ${order.table_number || order.table_id} : Nouvelle commande client en attente`
          : `Table ${order.table_number || order.table_id} : Commande créée par le personnel`,
        priority: 'high',
        severity: 'info',
        category: 'orders',
        tenant_id: 'default',
        user_id: 'all',
        status: 'unread',
        read: false,
        dismissed: false,
        actionable: true,
        toast: true,
        badge: true,
        banner: false,
        center: true,
        metadata: { 
          orderId: order.id,
          tableId: order.table_id,
          tableNumber: order.table_number,
          source: order.source
        },
      });
      
      console.log('[OrderStore] Notification sent for order:', order.id, 'Table:', order.table_number || order.table_id, 'Source:', order.source);
    });
  }

  // Cleanup: remove IDs from the set if they are no longer in 'pending' status
  // so that if they were to somehow become pending again (rare), they could re-notify
  const allOrderIds = new Set(state.allOrders.map(o => o.id));
  notifiedOrderIds.forEach(id => {
    if (!allOrderIds.has(id)) {
      notifiedOrderIds.delete(id);
    }
  });
  saveNotifiedOrderIds(notifiedOrderIds);
});
