import type { User } from '../stores/useAuthStore';
import type { Employee } from '../shared/employeesStore';
import type { RestaurantTable } from '../shared/tablesStore';
import type { Order } from '../shared/ordersStore';
import { resolveRuntimeMode, type RuntimeMode } from '../shared/runtime-mode';

/**
 * Détecte le mode d'exécution actuel (local vs cloud) une seule fois au démarrage.
 * Utilisé pour :
 * 1. Déterminer l'URL de base de l'API
 * 2. Envoyer l'en-tête X-Runtime-Mode à chaque requête
 */
const CURRENT_RUNTIME_MODE: RuntimeMode = (() => {
  try {
    const currentOrigin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
    if (currentOrigin) return resolveRuntimeMode(currentOrigin);
  } catch {}
  try {
    // @ts-ignore
    const viteEnv = (typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined);
    if (viteEnv?.DEV === true || viteEnv?.MODE === 'development') return 'local';
  } catch {}
  return 'cloud';
})();

/**
 * Base URL compatible Node/CommonJS (tsc server) et Vite.
 */
const API_BASE: string = (() => {
  const normalizeBaseUrl = (raw: string) => {
    const base = String(raw).replace(/\/$/, '');
    if (base.endsWith('.onrender.com') || base.includes('reat-olive-api.onrender.com')) {
      return `${base}/api`;
    }
    if (base.includes('/api')) return base;
    return `${base}/api`;
  };

  try {
    // @ts-ignore
    const viteEnv = (typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined);
    const explicit = viteEnv?.VITE_API_BASE_URL;
    if (explicit) return normalizeBaseUrl(String(explicit));
  } catch {}

  // Mode local → proxy Vite (pas de CORS)
  if (CURRENT_RUNTIME_MODE === 'local') {
    return '/api';
  }

  // Mode cloud → URL explicite depuis l'environnement
  try {
    // @ts-ignore
    const viteEnv = (typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined);
    if (viteEnv?.VITE_API_BASE_URL) return normalizeBaseUrl(String(viteEnv.VITE_API_BASE_URL));
  } catch {}

  const p = typeof process !== 'undefined' ? process : ({} as any);
  const fromProcess = p.env?.API_BASE_URL || p.env?.VITE_API_BASE_URL;
  if (fromProcess) return normalizeBaseUrl(String(fromProcess));

  if (p.env?.NODE_ENV === 'development') return '/api';

  // Fallback production — doit être configuré via VITE_API_BASE_URL
  return '/api';
})();

// ── JWT Token Management ──────────────────────────────────────────────────────

const AUTH_STORAGE_KEY = 'ekala-auth';
const PLATFORM_AUTH_STORAGE_KEY = 'platform_token';

// ── Platform JWT Token Management ───────────────────────────────────────────────
function getPlatformToken(): string | null {
  try {
    return localStorage.getItem(PLATFORM_AUTH_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setPlatformToken(token: string): void {
  try {
    localStorage.setItem(PLATFORM_AUTH_STORAGE_KEY, token);
  } catch {}
}

export function clearPlatformToken(): void {
  try {
    localStorage.removeItem(PLATFORM_AUTH_STORAGE_KEY);
  } catch {}
}

// ── Platform Request helper with auto-Bearer token ────────────────────────────────
export async function requestPlatform<T>(
  endpoint: string,
  options: any = {}
): Promise<T> {
  const token = getPlatformToken();
  const url = `${API_BASE}${endpoint}`;

  const authHeaders: Record<string, string> = {};
  if (token && !options.headers?.Authorization) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }

  // Serialize plain object bodies as JSON
  let resolvedBody: BodyInit | null | undefined;
  if (
    options.body &&
    typeof options.body === 'object' &&
    !(options.body instanceof FormData) &&
    !(options.body instanceof URLSearchParams)
  ) {
    resolvedBody = JSON.stringify(options.body) as unknown as BodyInit;
  } else {
    resolvedBody = options.body as unknown as BodyInit | null | undefined;
  }

  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      'X-Runtime-Mode': CURRENT_RUNTIME_MODE,
      ...authHeaders,
      ...options.headers,
    },
    ...options,
    body: resolvedBody,
  };

  const response = await fetch(url, config);

  if (response.status === 401) {
    clearPlatformToken();
    const errorText = await response.text().catch(() => '');
    let errorJson: any;
    try { errorJson = JSON.parse(errorText); } catch { errorJson = {}; }
    const apiError = new Error(errorJson?.message || 'Session expirée. Veuillez vous reconnecter.');
    (apiError as any).status = 401;
    throw apiError;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => 'No response body');
    let parsedError: any;
    try { parsedError = JSON.parse(text); } catch { parsedError = null; }
    const errorMessage = parsedError?.error || parsedError?.message || text || `HTTP ${response.status}`;
    const apiError = new Error(errorMessage);
    (apiError as any).status = response.status;
    (apiError as any).body = parsedError ?? text;
    throw apiError;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json') || contentType.includes('+json')) {
    return response.json();
  }

  const text = await response.text().catch(() => '');
  try {
    return JSON.parse(text);
  } catch {
    const apiError = new Error(`Réponse non-JSON. HTTP ${response.status}`);
    (apiError as any).status = response.status;
    (apiError as any).body = text;
    throw apiError;
  }
}

interface AuthPersistedState {
  state: {
    token: string | null;
    user: User | null;
    isAuthenticated: boolean;
  };
}

function getToken(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed: AuthPersistedState = JSON.parse(raw);
    return parsed?.state?.token || null;
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    parsed.state = parsed.state || {};
    parsed.state.token = token;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
  } catch {}
}

export function clearAuthToken(): void {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    parsed.state = parsed.state || {};
    parsed.state.token = null;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
  } catch {}
}

// ── Request helper with auto-Bearer token ─────────────────────────────────────

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
    resolvedBody = JSON.stringify(options.body) as unknown as BodyInit;
  } else {
    resolvedBody = options.body as unknown as BodyInit | null | undefined;
  }

  // Auto-attach JWT Bearer token if available
  const token = getToken();
  const authHeaders: Record<string, string> = {};
  if (token && !options.headers?.Authorization) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      'X-Runtime-Mode': CURRENT_RUNTIME_MODE,
      ...authHeaders,
      ...(options.role && { 'X-User-Role': options.role }),
      ...options.headers
    },
    ...options,
    body: resolvedBody
  };

  try {
    const response = await fetch(url, config);

    // If 401, clear auth state so user gets redirected to login
    if (response.status === 401) {
      const errorText = await response.text().catch(() => '');
      let errorJson: any;
      try { errorJson = JSON.parse(errorText); } catch { errorJson = {}; }

      // Don't clear auth on login endpoints (they're expected to 401 on bad creds)
      // Match both /auth/login/pin and /auth/login/email
      if (!endpoint.match(/^\/auth\/login(\/|$)/)) {
        clearAuthToken();
        
        // Debounce: prevent multiple rapid 401s from spamming the event
        const eventName = 'auth:token-expired';
        const now = Date.now();
        const lastEmission = (window as any).__lastTokenExpiredEmission || 0;
        
        // Only emit if we haven't emitted in the last 2 seconds
        if (now - lastEmission > 2000) {
          (window as any).__lastTokenExpiredEmission = now;
          window.dispatchEvent(new CustomEvent(eventName));
        }
      }

      const apiError = new Error(errorJson?.message || 'Session expirée. Veuillez vous reconnecter.');
      (apiError as any).status = 401;
      (apiError as any).body = errorJson;
      throw apiError;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => 'No response body');
      let parsedError: any;
      try { parsedError = JSON.parse(text); } catch { parsedError = null; }

      let errorMessage = parsedError?.error || parsedError?.message || text || `HTTP ${response.status}`;
      
      if (typeof errorMessage === 'string' && errorMessage.includes('duplicate key value violates unique constraint')) {
        errorMessage = `Cette entrée existe déjà dans la base de données. Veuillez actualiser la page et réessayer.`;
      }

      const apiError = new Error(errorMessage);
      (apiError as any).status = response.status;
      (apiError as any).body = parsedError ?? text;
      throw apiError;
    }

    // Safe JSON parsing: some platforms (misroutes, 404 HTML, etc.) may return non-JSON bodies
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json') || contentType.includes('+json')) {
      return response.json();
    }

    // Fallback: try to parse anyway, but if it fails return a clearer error
    const text = await response.text().catch(() => '');
    try {
      return JSON.parse(text);
    } catch {
      const snippet = text ? text.slice(0, 400) : '';
      const apiError = new Error(
        `Réponse non-JSON (content-type="${contentType}"). ` +
        `HTTP ${response.status}. Body: ${snippet || '<empty>'}`
      );
      (apiError as any).status = response.status;
      (apiError as any).body = text;
      (apiError as any).contentType = contentType;
      throw apiError;
    }
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw error;
    }
    throw error;
  }
}

export const api = {
  // Auth — new JWT-based endpoints
  auth: {
    loginEmail: (email: string, password: string) =>
      request<{ token: string; user: User }>('/auth/login/email', { method: 'POST', body: { email, password } }),
    loginPin: (pin_code: string, identity?: string, tenant_slug?: string) =>
      request<{ token: string; user: User }>('/auth/login/pin', { method: 'POST', body: { pin_code, identity, tenant_slug } }),
    refresh: (token: string) =>
      request<{ token: string }>('/auth/refresh', { method: 'POST', body: { token } }),
    me: () => request<User>('/auth/me'),
    status: () => request('/auth/status'),
    getTenant: (slug: string) => request(`/auth/tenants/${slug}`),
    // Legacy PIN login (backward compatibility)
    login: (pin_code: string, identity?: string) =>
      request<User>('/auth/login', { method: 'POST', body: { pin_code, identity } }),
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
    lowStock: () => request('/reports/low-stock'),
    paymentMethods: (params?: { start?: string; end?: string }) => 
      request('/reports/payment-methods', { params }),
    categoriesPerformance: (params?: { start?: string; end?: string }) =>
      request('/reports/categories-performance', { params }),
    inventoryMovements: (params?: { start?: string; end?: string; product_id?: number; limit?: number }) =>
      request('/reports/inventory-movements', { params }),
    summary: (params?: { start?: string; end?: string }) =>
      request('/reports/summary', { params })
  },

  // Dashboard
  dashboard: {
    summary: () => request('/dashboard/summary')
  },

  // Generic methods
  get: <T>(url: string, options?: any) => request<T>(url, { method: 'GET', ...options }),
  post: <T>(url: string, data: any, options?: any) => request<T>(url, { method: 'POST', body: data, ...options }),
  patch: <T>(url: string, data: any, options?: any) => request<T>(url, { method: 'PATCH', body: data, ...options }),
  delete: <T>(url: string, options?: any) => request<T>(url, { method: 'DELETE', ...options }),

  // Billing — Voucher-First
  billing: {
    requestVoucher: (planId: number) => api.post<any>('/billing/request-voucher', { planId }),
    paymentSent: (voucherCode: string) => api.post<any>('/billing/payment-sent', { voucherCode }),
    getVoucherStatus: (code: string) => api.get<any>(`/vouchers/status/${encodeURIComponent(code)}`),
  },

// SaaS — subscription & billing
   saas: {
     changePlan: (tenantId: number, planCode: string, paymentMethod?: string, paymentReference?: string) =>
       api.patch(`/tenants/${tenantId}/subscription`, { plan_code: planCode, payment_method: paymentMethod, payment_reference: paymentReference }),
     cancelSubscription: (tenantId: number) =>
       api.post(`/tenants/${tenantId}/cancel-subscription`, {}),
     getTenant: (tenantId: number) =>
       api.get(`/tenants/${tenantId}`),
     getPlans: () =>
       api.get('/plans'),
   },

   // Platform — admin portal (uses platform_token)
   platform: {
     // Auth
     login: (email: string, password: string) =>
       requestPlatform<{ success: boolean; token: string; user: any }>('/platform/auth/login', { method: 'POST', body: { email, password } }),
     me: () => requestPlatform<{ success: boolean; user: any; permissions: string[] }>('/platform/auth/me'),
     logout: () => requestPlatform<{ success: boolean }>('/platform/auth/logout', { method: 'POST' }),
     refresh: (token: string) => requestPlatform<{ success: boolean; token: string }>('/platform/auth/refresh', { method: 'POST', body: { token } }),
     // Tenants
     createTenant: (data: { name: string; slug?: string; owner_email: string; owner_name?: string; phone?: string; country?: string; city?: string; plan_id?: number }) =>
       requestPlatform<{ success: boolean; tenant: any }>('/platform/tenants', { method: 'POST', body: data }),
     createTenantUser: (tenantId: number, data: { email: string; full_name: string; phone?: string; username?: string; password: string; pin_code?: string; role?: string; tenant_role?: string }) =>
       requestPlatform<{ success: boolean; message: string; userId?: number }>('/platform/tenants/' + tenantId + '/users', { method: 'POST', body: data }),
     getTenants: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
       requestPlatform<{ success: boolean; tenants: any[]; pagination: any }>('/platform/tenants', { params }),
     getTenant: (id: number) =>
       requestPlatform<{ success: boolean; tenant: any }>('/platform/tenants/' + id),
     suspendTenant: (id: number, reason: string) =>
       requestPlatform('/platform/tenants/' + id + '/suspend', { method: 'POST', body: { reason } }),
     activateTenant: (id: number) =>
       requestPlatform('/platform/tenants/' + id + '/activate', { method: 'POST' }),
     // Vouchers
     getVouchers: (params?: { page?: number; limit?: number; status?: string }) =>
       requestPlatform<{ success: boolean; vouchers: any[]; pagination: any }>('/platform/vouchers', { params }),
     approveVoucher: (id: number) =>
       requestPlatform('/platform/vouchers/' + id + '/approve', { method: 'POST' }),
     rejectVoucher: (id: number, reason: string) =>
       requestPlatform('/platform/vouchers/' + id + '/reject', { method: 'POST', body: { reason } }),
     // Subscriptions
     getSubscriptions: (params?: { page?: number; limit?: number; status?: string }) =>
       requestPlatform<{ success: boolean; subscriptions: any[]; pagination: any }>('/platform/subscriptions', { params }),
// Stats
      getStats: () =>
        requestPlatform<{ success: boolean; stats: any }>('/platform/stats'),
      // Settings
      getSettings: () =>
        requestPlatform<{ success: boolean; settings: Record<string, string> }>('/platform/settings'),
      updateSetting: (key: string, value: string) =>
        requestPlatform<{ success: boolean }>('/platform/settings/' + key, { method: 'PUT', body: { value } }),
      // Audit Logs
      getAuditLogs: (params?: { page?: number; limit?: number; action?: string; tenant_id?: string }) =>
        requestPlatform<{ success: boolean; logs: any[]; pagination: any }>('/platform/audit-logs', { params }),
      // Sync
      getSyncJobs: (params?: { page?: number; limit?: number }) =>
        requestPlatform<{ success: boolean; jobs: any[]; pagination: any }>('/platform/sync/jobs', { params }),
      getSyncStats: () =>
        requestPlatform<{ success: boolean; stats: any }>('/platform/sync/stats'),
      retryFailedSync: (maxAttempts?: number) =>
        requestPlatform<{ success: boolean; retried: number }>('/platform/sync/retry-failed', { method: 'POST', body: { maxAttempts } }),
   }
 };