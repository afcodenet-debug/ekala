"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canAccessResource = exports.hasAnyPermission = exports.hasPermission = exports.PERMISSIONS = exports.ALL_ROLES = void 0;
exports.ALL_ROLES = ['admin', 'manager', 'cashier', 'waiter'];
exports.PERMISSIONS = {
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
const hasPermission = (userRole, permission) => {
    var _a;
    return ((_a = exports.PERMISSIONS[permission]) === null || _a === void 0 ? void 0 : _a.includes(userRole)) || false;
};
exports.hasPermission = hasPermission;
const hasAnyPermission = (userRole, permissions) => {
    return permissions.some(permission => (0, exports.hasPermission)(userRole, permission));
};
exports.hasAnyPermission = hasAnyPermission;
// Helper to check if user can access a specific resource
const canAccessResource = (userRole, resourceType, resourceOwner, currentUserId) => {
    if (userRole === 'admin')
        return true;
    switch (resourceType) {
        case 'order':
            return userRole === 'manager' || userRole === 'cashier' || (userRole === 'waiter' && resourceOwner === currentUserId);
        case 'table':
            return userRole === 'manager' || userRole === 'cashier' || (userRole === 'waiter' && resourceOwner === currentUserId);
        default:
            return false;
    }
};
exports.canAccessResource = canAccessResource;
