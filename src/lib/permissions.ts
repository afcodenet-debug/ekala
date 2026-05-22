// lib/permissions.ts
export type UserRole = 'admin' | 'manager' | 'cashier' | 'waiter';

export const ALL_ROLES: UserRole[] = ['admin', 'manager', 'cashier', 'waiter'];

export const PERMISSIONS = {
  // Dashboard
  VIEW_DASHBOARD: ['admin', 'manager', 'cashier', 'waiter'],
 
  // Tables
  VIEW_ALL_TABLES: ['admin', 'manager', 'cashier'],
  VIEW_ASSIGNED_TABLES: ['waiter'],
  ASSIGN_TABLES: ['admin', 'manager'],
 
  // Orders
  CREATE_ORDERS: ['admin', 'manager', 'cashier', 'waiter'],
  VIEW_ALL_ORDERS: ['admin', 'manager', 'cashier'],
  VIEW_OWN_ORDERS: ['waiter'],
  UPDATE_ORDER_STATUS: ['admin', 'manager', 'cashier', 'waiter'],
 
  // Sales/POS - cashier specific
  PROCESS_PAYMENTS: ['admin', 'manager', 'cashier', 'waiter'],
  VIEW_ALL_SALES: ['admin', 'manager', 'cashier'],
  CLOSE_REGISTER: ['admin', 'manager', 'cashier'],
 
  // Products/Inventory
  MANAGE_PRODUCTS: ['admin', 'manager'],
  VIEW_PRODUCTS: ['admin', 'manager', 'cashier', 'waiter'],
  MANAGE_INVENTORY: ['admin', 'manager'],
 
  // Users
  MANAGE_USERS: ['admin'],
 
  // Reports
  VIEW_REPORTS: ['admin', 'manager', 'cashier'],
 
  // Expenses
  MANAGE_EXPENSES: ['admin', 'manager', 'cashier'],
 
  // Settings
  MANAGE_SETTINGS: ['admin']
};

export const hasPermission = (userRole: UserRole, permission: keyof typeof PERMISSIONS): boolean => {
  return PERMISSIONS[permission]?.includes(userRole) || false;
};

export const hasAnyPermission = (
  userRole: UserRole,
  permissions: Array<keyof typeof PERMISSIONS>
): boolean => {
  return permissions.some(permission => hasPermission(userRole, permission));
};

// Helper to check if user can access a specific resource
export const canAccessResource = (userRole: UserRole, resourceType: string, resourceOwner?: number, currentUserId?: number): boolean => {
  if (userRole === 'admin') return true;
 
  switch (resourceType) {
    case 'order':
      return userRole === 'manager' || userRole === 'cashier' || (userRole === 'waiter' && resourceOwner === currentUserId);
    case 'table':
      return userRole === 'manager' || userRole === 'cashier' || (userRole === 'waiter' && resourceOwner === currentUserId);
    default:
      return false;
  }
};