import { useAuthStore } from '../../../stores/useAuthStore';
import { ProductPermission } from '../types';

/**
 * Enterprise RBAC Hook
 * Standardizes permission checks across the feature.
 */
export const useProductPermissions = () => {
  const { user } = useAuthStore();

  const can = (permission: ProductPermission): boolean => {
    if (!user) return false;
    
    // Global bypass for admin
    if (user.role === 'admin') return true;

    const rolePermissions: Record<string, ProductPermission[]> = {
      manager: [
        'product.view',
        'product.create',
        'product.edit',
        'inventory.adjust',
        'inventory.view_value',
        'inventory.export'
      ],
      waiter: [
        'product.view'
      ]
    };

    return rolePermissions[user.role]?.includes(permission) ?? false;
  };

  return { can, role: user?.role };
};
