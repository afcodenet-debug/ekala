// =============================================================================
// RBAC Cache Service - Gestion du cache Redis pour les permissions
// =============================================================================
// Architecture RBAC Production-Hardened
// =============================================================================

import { db } from '../db/database';

export interface CachedPermissions {
  role_id: number;
  role_name: string;
  permissions: string[];
  scope: 'global' | 'tenant' | 'hybrid';
  cached_at: number;
}

export interface CachedUserStatus {
  status: 'active' | 'suspended' | 'revoked' | 'locked';
  locked_until: string | null;
  cached_at: number;
}

export class RBACCacheService {
  /**
   * Obtenir les permissions d'un user depuis le cache
   * @param userId - ID de l'user
   * @returns Permissions en cache ou null
   */
  async getUserPermissions(userId: number): Promise<CachedPermissions | null> {
    try {
      // Note: Dans une implémentation avec Redis, nous ferions:
      // const cached = await redis.get(`rbac:user:${userId}:permissions`);
      // if (cached) return JSON.parse(cached);
      
      // Fallback DB (pour l'instant sans Redis)
      const result = await db.prepare(`
        SELECT pa.role, pr.id as role_id
        FROM platform_admins pa
        JOIN platform_roles pr ON pr.role_name = pa.role
        WHERE pa.user_id = ?
      `).get(userId) as any;

      if (!result) {
        return null;
      }

      // Charger les permissions depuis DB
      const permissions = await this.loadPermissionsFromDB(result.role_id);
      
      return {
        role_id: result.role_id,
        role_name: result.role_name,
        permissions,
        scope: 'global',
        cached_at: Date.now()
      };
    } catch (error) {
      console.error('[RBACCache] Error getting user permissions:', error);
      return null;
    }
  }

  /**
   * Stocker les permissions d'un user dans le cache
   * @param userId - ID de l'user
   * @param data - Données à cacher
   * @param ttl - Time to live en secondes (défaut: 300s = 5min)
   */
  async setUserPermissions(userId: number, data: CachedPermissions, ttl: number = 300): Promise<void> {
    try {
      // Note: Dans une implémentation avec Redis:
      // await redis.setex(`rbac:user:${userId}:permissions`, ttl, JSON.stringify(data));
      
      // Pour l'instant, pas de cache (fallback DB à chaque fois)
      console.log(`[RBACCache] Would cache permissions for user ${userId} (TTL: ${ttl}s)`);
    } catch (error) {
      console.error('[RBACCache] Error setting user permissions:', error);
    }
  }

  /**
   * Invalider le cache des permissions d'un user
   * @param userId - ID de l'user
   */
  async invalidateUserPermissions(userId: number): Promise<void> {
    try {
      // Note: Dans une implémentation avec Redis:
      // await redis.del(`rbac:user:${userId}:permissions`);
      
      console.log(`[RBACCache] Invalidated permissions cache for user ${userId}`);
    } catch (error) {
      console.error('[RBACCache] Error invalidating user permissions:', error);
    }
  }

  /**
   * Obtenir les permissions d'un rôle depuis le cache
   * @param roleId - ID du rôle
   * @returns Permissions en cache ou null
   */
  async getRolePermissions(roleId: number): Promise<string[] | null> {
    try {
      // Note: Dans une implémentation avec Redis:
      // const cached = await redis.get(`rbac:role:${roleId}:permissions`);
      // if (cached) return JSON.parse(cached).permissions;
      
      // Fallback DB
      return await this.loadPermissionsFromDB(roleId);
    } catch (error) {
      console.error('[RBACCache] Error getting role permissions:', error);
      return null;
    }
  }

  /**
   * Stocker les permissions d'un rôle dans le cache
   * @param roleId - ID du rôle
   * @param permissions - Liste des permissions
   * @param ttl - Time to live en secondes (défaut: 900s = 15min)
   */
  async setRolePermissions(roleId: number, permissions: string[], ttl: number = 900): Promise<void> {
    try {
      // Note: Dans une implémentation avec Redis:
      // await redis.setex(`rbac:role:${roleId}:permissions`, ttl, JSON.stringify({
      //   permissions,
      //   cached_at: Date.now()
      // }));
      
      console.log(`[RBACCache] Would cache permissions for role ${roleId} (TTL: ${ttl}s)`);
    } catch (error) {
      console.error('[RBACCache] Error setting role permissions:', error);
    }
  }

  /**
   * Invalider le cache des permissions d'un rôle
   * @param roleId - ID du rôle
   */
  async invalidateRolePermissions(roleId: number): Promise<void> {
    try {
      // Note: Dans une implémentation avec Redis:
      // await redis.del(`rbac:role:${roleId}:permissions`);
      
      console.log(`[RBACCache] Invalidated permissions cache for role ${roleId}`);
    } catch (error) {
      console.error('[RBACCache] Error invalidating role permissions:', error);
    }
  }

  /**
   * Obtenir le statut d'un user depuis le cache
   * @param userId - ID de l'user
   * @returns Statut en cache ou null
   */
  async getUserStatus(userId: number): Promise<CachedUserStatus | null> {
    try {
      // Note: Dans une implémentation avec Redis:
      // const cached = await redis.get(`rbac:user:${userId}:status`);
      // if (cached) return JSON.parse(cached);
      
      // Fallback DB
      const user = await db.prepare(`
        SELECT status, locked_until FROM users WHERE id = ?
      `).get(userId) as any;

      if (!user) {
        return null;
      }

      return {
        status: user.status,
        locked_until: user.locked_until,
        cached_at: Date.now()
      };
    } catch (error) {
      console.error('[RBACCache] Error getting user status:', error);
      return null;
    }
  }

  /**
   * Stocker le statut d'un user dans le cache
   * @param userId - ID de l'user
   * @param status - Données de statut
   * @param ttl - Time to live en secondes (défaut: 60s = 1min)
   */
  async setUserStatus(userId: number, status: CachedUserStatus, ttl: number = 60): Promise<void> {
    try {
      // Note: Dans une implémentation avec Redis:
      // await redis.setex(`rbac:user:${userId}:status`, ttl, JSON.stringify(status));
      
      console.log(`[RBACCache] Would cache status for user ${userId} (TTL: ${ttl}s)`);
    } catch (error) {
      console.error('[RBACCache] Error setting user status:', error);
    }
  }

  /**
   * Invalider le cache du statut d'un user
   * @param userId - ID de l'user
   */
  async invalidateUserStatus(userId: number): Promise<void> {
    try {
      // Note: Dans une implémentation avec Redis:
      // await redis.del(`rbac:user:${userId}:status`);
      
      console.log(`[RBACCache] Invalidated status cache for user ${userId}`);
    } catch (error) {
      console.error('[RBACCache] Error invalidating user status:', error);
    }
  }

  /**
   * Invalider tous les caches de permissions (pour tous les users)
   * Utilisé quand les permissions d'un rôle changent
   */
  async invalidateAllPermissions(): Promise<void> {
    try {
      // Note: Dans une implémentation avec Redis:
      // await redis.del('rbac:user:*:permissions');
      // await redis.del('rbac:role:*:permissions');
      
      console.log(`[RBACCache] Invalidated all permissions cache`);
    } catch (error) {
      console.error('[RBACCache] Error invalidating all permissions:', error);
    }
  }

  /**
   * Charger les permissions depuis la DB
   * @param roleId - ID du rôle
   * @returns Liste des permissions
   */
  private async loadPermissionsFromDB(roleId: number): Promise<string[]> {
    try {
      const result = await db.prepare(`
        SELECT p.permission_key
        FROM platform_role_permissions prp
        JOIN platform_permissions p ON prp.permission_id = p.id
        WHERE prp.role_id = ?
      `).all(roleId);

      return result.map((r: any) => r.permission_key);
    } catch (error) {
      console.error('[RBACCache] Error loading permissions from DB:', error);
      return [];
    }
  }

  /**
   * Obtenir les statistiques du cache
   * @returns Statistiques (pour monitoring)
   */
  async getCacheStats(): Promise<{
    userPermissionsCache: number;
    rolePermissionsCache: number;
    userStatusCache: number;
  }> {
    // Note: Dans une implémentation avec Redis, nous compterions les clés
    // Pour l'instant, retourner des statistiques fictives
    
    return {
      userPermissionsCache: 0,
      rolePermissionsCache: 0,
      userStatusCache: 0
    };
  }

  /**
   * Nettoyer tout le cache RBAC
   * Utilisé en cas de problème ou pour maintenance
   */
  async clearAllCache(): Promise<void> {
    try {
      // Note: Dans une implémentation avec Redis:
      // await redis.del('rbac:*');
      
      console.log(`[RBACCache] Cleared all RBAC cache`);
    } catch (error) {
      console.error('[RBACCache] Error clearing cache:', error);
    }
  }
}

// Export singleton instance
export const rbacCache = new RBACCacheService();