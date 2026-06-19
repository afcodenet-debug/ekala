// lib/permissions.ts
export type UserRole = 'owner' | 'admin' | 'manager' | 'cashier' | 'waiter';

export const ALL_ROLES: UserRole[] = ['owner', 'admin', 'manager', 'cashier', 'waiter'];

export const PERMISSIONS = {
  // Dashboard
  VIEW_DASHBOARD: ['owner', 'admin', 'manager', 'cashier', 'waiter'],
 
  // Tables
  VIEW_ALL_TABLES: ['owner', 'admin', 'manager', 'cashier'],
  VIEW_ASSIGNED_TABLES: ['waiter'],
  ASSIGN_TABLES: ['owner', 'admin', 'manager'],
 
  // Orders
  CREATE_ORDERS: ['owner', 'admin', 'manager', 'cashier', 'waiter'],
  VIEW_ALL_ORDERS: ['owner', 'admin', 'manager', 'cashier'],
  VIEW_OWN_ORDERS: ['waiter'],
  UPDATE_ORDER_STATUS: ['owner', 'admin', 'manager', 'cashier', 'waiter'],
 
  // Sales/POS - cashier specific
  PROCESS_PAYMENTS: ['owner', 'admin', 'manager', 'cashier', 'waiter'],
  VIEW_ALL_SALES: ['owner', 'admin', 'manager', 'cashier'],
  CLOSE_REGISTER: ['owner', 'admin', 'manager', 'cashier'],
 
  // Products/Inventory
  MANAGE_PRODUCTS: ['owner', 'admin', 'manager'],
  VIEW_PRODUCTS: ['owner', 'admin', 'manager', 'cashier', 'waiter'],
  MANAGE_INVENTORY: ['owner', 'admin', 'manager'],
 
  // Users
  MANAGE_USERS: ['owner', 'admin'],
 
  // Reports
  VIEW_REPORTS: ['owner', 'admin', 'manager', 'cashier'],
 
  // Expenses
  MANAGE_EXPENSES: ['owner', 'admin', 'manager', 'cashier'],
 
  // Settings
  MANAGE_SETTINGS: ['owner', 'admin']
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
  if (userRole === 'admin' || userRole === 'owner') return true;
 
  switch (resourceType) {
    case 'order':
      return userRole === 'manager' || userRole === 'cashier' || (userRole === 'waiter' && resourceOwner === currentUserId);
    case 'table':
      return userRole === 'manager' || userRole === 'cashier' || (userRole === 'waiter' && resourceOwner === currentUserId);
    default:
      return false;
  }
};