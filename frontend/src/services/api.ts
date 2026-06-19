const API_BASE = '/api';

export interface RequestConfig extends RequestInit {
  params?: Record<string, string | number>;
}

export async function apiRequest<T>(
  endpoint: string,
  config: RequestConfig = {}
): Promise<T> {
  const url = new URL(`${API_BASE}${endpoint}`);
  
  if (config.params) {
    Object.entries(config.params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
  }

  const response = await fetch(url.toString(), {
    ...config,
    headers: {
      'Content-Type': 'application/json',
      ...config.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Auth
export const authApi = {
  login: (pin_code: string, identity?: string, tenant_slug?: string) => 
    apiRequest('/auth/login/pin', {
      method: 'POST',
      body: JSON.stringify({ pin_code, identity, tenant_slug })
    }),
  status: () => apiRequest('/auth/status')
};

// Tables
export const tablesApi = {
  getAll: (params?: { waiter_id?: number; role?: string }) =>
    apiRequest('/tables', { params }),
  open: (tableId: number, waiterId: number) =>
    apiRequest(`/tables/${tableId}/open`, {
      method: 'POST',
      body: JSON.stringify({ waiter_id: waiterId })
    })
};

// Orders
export const ordersApi = {
  getAll: () => apiRequest('/orders/active'),
  getById: (id: number) => apiRequest(`/orders/${id}`),
  create: (order: any) => 
    apiRequest('/orders', {
      method: 'POST',
      body: JSON.stringify(order)
    }),
  updateItems: (id: number, items: any[]) =>
    apiRequest(`/orders/${id}/items`, {
      method: 'PATCH',
      body: JSON.stringify({ items })
    }),
  updateStatus: (id: number, status: string) =>
    apiRequest(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    })
};

// Products
export const productsApi = {
  getAll: () => apiRequest('/products')
};

// Sales
export const salesApi = {
  getAll: (params?: { startDate?: string; endDate?: string }) =>
    apiRequest('/sales', { params }),
  checkout: (data: any) =>
    apiRequest('/sales/checkout', {
      method: 'POST',
      body: JSON.stringify(data)
    })
};

// Expenses
export const expensesApi = {
  getAll: () => apiRequest('/expenses'),
  create: (expense: any) =>
    apiRequest('/expenses', {
      method: 'POST',
      body: JSON.stringify(expense)
    }),
  delete: (id: number) =>
    apiRequest(`/expenses/${id}`, { method: 'DELETE' })
};

// Users
export const usersApi = {
  getAll: () => apiRequest('/users')
};

// Inventory
export const inventoryApi = {
  adjust: (productId: number, quantity: number, type: string) =>
    apiRequest('/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, quantity, type })
    })
};

// Reports
export const reportsApi = {
  dailySales: (date: string) => apiRequest('/reports/daily-sales', { params: { date } }),
  weeklySales: (start: string, end: string) => 
    apiRequest('/reports/weekly-sales', { params: { start, end } }),
  monthlySales: (month: string, year: string) =>
    apiRequest('/reports/monthly-sales', { params: { month, year } }),
  topProducts: (limit?: number) =>
    apiRequest('/reports/top-products', { params: limit !== undefined ? { limit } : undefined }),
  lowStock: () => apiRequest('/reports/low-stock')
};