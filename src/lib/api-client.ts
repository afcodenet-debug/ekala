import type { User } from '../stores/useAuthStore';
import type { Employee } from '../shared/employeesStore';
import type { RestaurantTable } from '../shared/tablesStore';
import type { Order } from '../shared/ordersStore';

/**
 * Base URL compatible Node/CommonJS (tsc server) et Vite.
 * Évite `import.meta` pour ne plus avoir TS1343.
 */
const API_BASE: string = (() => {
  // Vite / browser (Vercel production build) — never reference `import.meta` token
  // so that tsc -p tsconfig.server.json (CommonJS) does not reject the file.
  if (typeof window !== 'undefined') {
    // @ts-ignore - only evaluated in the Vite ESM bundle
    const v = (globalThis as any)?.import?.meta?.env?.VITE_API_BASE_URL;
    if (v) return String(v).replace(/\/$/, '');
  }

  // Node / server build / local dev
  const p = typeof process !== 'undefined' ? process : ({} as any);
  const apiBaseUrl = p?.env?.API_BASE_URL || p?.env?.VITE_API_BASE_URL;
  if (apiBaseUrl) return String(apiBaseUrl).replace(/\/$/, '');

  if (p?.env?.NODE_ENV === 'development') return '/api';

  // Production fallback (Vercel SPA → Render backend with Supabase)
  return 'https://reat-olive-api.onrender.com';
})();

export async function request<T>(
  endpoint: string,
  options: any = {}
): Promise<T> {
  let url = `${API_BASE}${endpoint}`;

  // Handle query parameters
  if (options.params) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const paramString = searchParams.toString();
    if (paramString) {
      url += `?${paramString}`;
    }
  }

  // Serialize plain object bodies as JSON
  let resolvedBody: BodyInit | null | undefined;
  if (
    options.body &&
    typeof options.body === 'object' &&
    !(options.body instanceof FormData) &&
    !(options.body instanceof URLSearchParams)
  ) {
    // Force typage: JSON.stringify retourne une string (compatible BodyInit)
    resolvedBody = JSON.stringify(options.body) as unknown as BodyInit;
  } else {
    resolvedBody = options.body as unknown as BodyInit | null | undefined;
  }

  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...(options.role && { 'X-User-Role': options.role }),
      ...options.headers
    },
    ...options,
    body: resolvedBody
  };

  try {
    console.log(`[API] Fetching: ${url}`);
    const response = await fetch(url, config);

    if (!response.ok) {
      const text = await response.text().catch(() => 'No response body');
      console.error(`API Error ${response.status} on ${endpoint}:`, text);

      let parsedError: any;
      try {
        parsedError = JSON.parse(text);
      } catch {
        parsedError = null;
      }

      const errorMessage = parsedError?.error || parsedError?.message || text || `HTTP ${response.status}`;
      const apiError = new Error(errorMessage);
      (apiError as any).status = response.status;
      (apiError as any).body = parsedError ?? text;
      throw apiError;
    }

    return response.json();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log(`[API] Request aborted for ${endpoint}`);
      throw error;
    }
    console.error(`API request failed for ${endpoint}:`, error.message);
    throw error;
  }
}

export const api = {
  // Auth
  auth: {
    login: (pin_code: string, identity?: string) =>
      request<User>('/auth/login', { method: 'POST', body: { pin_code, identity } }),
    status: () => request('/auth/status')
  },

  // Tables
  tables: {
    getAll: (params?: Record<string, string | number>, role?: string) =>
      request<RestaurantTable[]>('/tables', { params, role }),
    create: (data: any, role?: string) =>
      request<RestaurantTable>('/tables', { method: 'POST', body: data, role }),
    update: (id: number, data: any, role?: string) =>
      request(`/tables/${id}`, { method: 'PATCH', body: data, role }),
    delete: (id: number, role?: string) =>
      request(`/tables/${id}`, { method: 'DELETE', role }),
    open: (tableId: number, waiterId: number) =>
      request(`/tables/${tableId}/open`, { method: 'POST', body: { waiter_id: waiterId } }),
    reserve: (tableId: number) =>
      request(`/tables/${tableId}/reserve`, { method: 'POST' }),
    markCleaning: (tableId: number) =>
      request(`/tables/${tableId}/cleaning`, { method: 'POST' }),
    setAvailable: (tableId: number) =>
      request(`/tables/${tableId}/available`, { method: 'POST' }),
    setOutOfService: (tableId: number) =>
      request(`/tables/${tableId}/out-of-service`, { method: 'POST' }),
    getByWaiter: (waiterId: number) =>
      request(`/tables/waiter/${waiterId}`),
    regenerateQr: (tableId: number, role?: string) =>
      request(`/tables/${tableId}/regenerate-qr`, { method: 'POST', role })
  },

  // Orders
  orders: {
    getAll: (params?: Record<string, string | number>) =>
      request<Order[]>('/orders/active', { params }),
    getAllOrders: (params?: Record<string, string | number>) =>
      request<Order[]>('/orders', { params }),
    getById: (id: number) => request<Order>(`/orders/${id}`),
    create: (order: any, role?: string) =>
      request<Order | null>('/orders', { method: 'POST', body: order, role }),
    updateItems: (id: number, items: any[], role?: string) =>
      request(`/orders/${id}/items`, { method: 'PATCH', body: { items }, role }),
    updateStatus: (id: number, status: string, role?: string) =>
      request(`/orders/${id}/status`, { method: 'PATCH', body: { status }, role }),
    delete: (id: number, role?: string) =>
      request(`/orders/${id}`, { method: 'DELETE', role })
  },

  // Categories
  categories: {
    getAll: (role?: string) => request('/categories', { role }),
    create: (data: { name: string; description?: string }, role?: string) =>
      request('/categories', { method: 'POST', body: data, role }),
    update: (id: number, data: { name?: string; description?: string | null }, role?: string) =>
      request(`/categories/${id}`, { method: 'PATCH', body: data, role }),
    delete: (id: number, role?: string) =>
      request(`/categories/${id}`, { method: 'DELETE', role })
  },

  // Products
  products: {
    getAll: (role?: string) => request('/products', { role }),
    getById: (id: number, role?: string) => request(`/products/${id}`, { role }),
    create: (product: any, role?: string) => request('/products', { method: 'POST', body: product, role }),
    update: (id: number, product: any, role?: string) => request(`/products/${id}`, { method: 'PATCH', body: product, role }),
    delete: (id: number, role?: string) => request(`/products/${id}`, { method: 'DELETE', role }),
    getLowStock: (role?: string) => request('/products/low-stock', { role }),
    adjustStock: (id: number, adjustment: any, role?: string) =>
      request(`/products/${id}/adjust-stock`, { method: 'POST', body: adjustment, role }),
    uploadImage: (id: number, file: File, role?: string) => {
      const form = new FormData();
      form.append('image', file, file.name);
      return request<{ success: boolean; image_url: string }>(
        `/products/${id}/upload-image`,
        {
          method: 'POST',
          body: form as unknown as Record<string, string>,
          role,
          headers: {}
        }
      );
    },
    getMovements: (productId?: number, params?: Record<string, string | number>) =>
      request(productId ? `/inventory/movements?product_id=${productId}` : '/inventory/movements', { params })
  },
  // Inventory
  inventory: {
    adjust: (productId: number, quantity: number, type: string) =>
      request('/inventory/adjust', { method: 'POST', body: { product_id: productId, quantity, type } }),
    getMovements: (params?: Record<string, string | number>) =>
      request('/inventory/movements', { params }),
    getAnalytics: () => request('/products/analytics'),
    getProductHistory: (productId: number) => request(`/products/${productId}/history`),
  },
  // Expenses
  expenses: {
    getAll: () => request('/expenses'),
    create: (expense: any) => request('/expenses', { method: 'POST', body: expense }),
    delete: (id: number) => request(`/expenses/${id}`, { method: 'DELETE' })
  },

  // Users
  users: {
    getAll: (role?: string) => request<Employee[]>('/users', { role }),
    create: (user: any, role?: string) => request<Employee>('/users', { method: 'POST', body: user, role }),
    update: (id: number, user: any, role?: string) => request<Employee>(`/users/${id}`, { method: 'PATCH', body: user, role }),
    delete: (id: number, role?: string) => request(`/users/${id}`, { method: 'DELETE', role })
  },

  // Suppliers
  suppliers: {
    getAll: (params?: Record<string, string | number>) => request('/suppliers', { params }),
    getById: (id: number) => request(`/suppliers/${id}`),
    create: (data: any, role?: string) => request('/suppliers', { method: 'POST', body: data, role }),
    update: (id: number, data: any, role?: string) => request(`/suppliers/${id}`, { method: 'PATCH', body: data, role }),
    delete: (id: number, role?: string) => request(`/suppliers/${id}`, { method: 'DELETE', role }),
  },

  // Purchase Orders
  purchaseOrders: {
    getAll: (params?: Record<string, string | number>) => request('/purchase-orders', { params }),
    getById: (id: number) => request(`/purchase-orders/${id}`),
    create: (data: any, role?: string) => request('/purchase-orders', { method: 'POST', body: data, role }),
    update: (id: number, data: any, role?: string) => request(`/purchase-orders/${id}`, { method: 'PATCH', body: data, role }),
  },

  // Stock Adjustments
  stockAdjustments: {
    getAll: (params?: Record<string, string | number>) => request('/stock-adjustments', { params }),
    getById: (id: number) => request(`/stock-adjustments/${id}`),
    create: (data: any, role?: string) => request('/stock-adjustments', { method: 'POST', body: data, role }),
    approve: (id: number, data: any, role?: string) => request(`/stock-adjustments/${id}/approve`, { method: 'POST', body: data, role }),
    reject: (id: number, data: any, role?: string) => request(`/stock-adjustments/${id}/reject`, { method: 'POST', body: data, role }),
    cancel: (id: number, role?: string) => request(`/stock-adjustments/${id}/cancel`, { method: 'POST', role }),
    getItems: (id: number) => request(`/stock-adjustments/${id}/items`),
    addItem: (id: number, item: any, role?: string) => request(`/stock-adjustments/${id}/items`, { method: 'POST', body: item, role }),
  },

  // Sales
  sales: {
    getAll: (params?: Record<string, string | number>) => request('/sales', { params }),
    getById: (id: number) => request(`/sales/${id}`),
    getReceipt: (id: number) => request(`/sales/receipt/${id}`),
    checkout: (data: any, role?: string) =>
      request('/sales/checkout', { method: 'POST', body: data, role }),
  },

  // Reports
  reports: {
    dailySales: (date: string) => request('/reports/daily-sales', { params: { date } }),
    weeklySales: (start: string, end: string) => 
      request('/reports/weekly-sales', { params: { start, end } }),
    monthlySales: (month: string, year: string) =>
      request('/reports/monthly-sales', { params: { month, year } }),
    topProducts: (limit?: number) => request('/reports/top-products', { params: { limit } }),
    lowStock: () => request('/reports/low-stock')
  },

  // Dashboard - professional unified endpoint
  dashboard: {
    summary: () => request('/dashboard/summary')
  },

  // Generic methods
  get: <T>(url: string, options?: any) => request<T>(url, { method: 'GET', ...options }),
  post: <T>(url: string, data: any, options?: any) => request<T>(url, { method: 'POST', body: data, ...options }),
  patch: <T>(url: string, data: any, options?: any) => request<T>(url, { method: 'PATCH', body: data, ...options }),
  delete: <T>(url: string, options?: any) => request<T>(url, { method: 'DELETE', ...options })
};