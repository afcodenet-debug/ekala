// =============================================================================
// Kill Switch Service - Révocation instantanée
// Architecture RBAC Production-Hardened - IAM Grade
// =============================================================================
//
// ⚠️  RÈGLES:
// - Ce service fait des DB calls (ADMINISTRATION ONLY)
// - Interdit en runtime request path
// - Utilisé UNIQUEMENT par les admins pour révoquer des users/tenants
// =============================================================================

import { db } from '../db/database';

export class KillSwitchService {
  /**
   * Tuer un user (révocation instantanée)
   * @param userId - ID de l'user à révoquer
   * @param reason - Raison de la révocation
   * @param performedBy - ID de l'admin qui effectue l'action
   */
  async killUser(userId: number, reason: string, performedBy: number): Promise<void> {
    try {
      const now = new Date().toISOString();

      // 1. Marquer comme revoked dans DB
      await db.prepare(`
        UPDATE users
        SET status = 'revoked',
            revoked_at = ?,
            revoked_by = ?
        WHERE id = ?
      `).run(now, performedBy, userId);

      // 2. Invalider les caches (si Redis est utilisé)
      // await redis.del(`rbac:user:${userId}:status`);
      // await redis.del(`rbac:user:${userId}:permissions`);

      // 3. Logger dans audit log
      await this.logAudit('user_killed', 'user', userId, reason, performedBy, {
        action: 'kill_user',
        new_status: 'revoked'
      });

      console.log(`[KillSwitch] User ${userId} killed. Reason: ${reason}`);
    } catch (error) {
      console.error('[KillSwitch] Error killing user:', error);
      throw new Error('Failed to kill user');
    }
  }

  /**
   * Tuer un rôle (tous les users avec ce rôle)
   * @param roleId - ID du rôle à tuer
   * @param reason - Raison de la révocation
   * @param performedBy - ID de l'admin qui effectue l'action
   */
  async killRole(roleId: number, reason: string, performedBy: number): Promise<void> {
    try {
      // 1. Récupérer tous les users avec ce rôle
      const users = await db.prepare(`
        SELECT user_id FROM platform_admins WHERE role_name = (
          SELECT role_name FROM platform_roles WHERE id = ?
        )
      `).all(roleId) as any[];

      // 2. Révoquer tous les users
      const now = new Date().toISOString();
      for (const user of users) {
        await db.prepare(`
          UPDATE users
          SET status = 'revoked',
              revoked_at = ?,
              revoked_by = ?
          WHERE id = ?
        `).run(now, performedBy, user.user_id);

        // 3. Invalider les caches
        // await redis.del(`rbac:user:${user.user_id}:status`);
        // await redis.del(`rbac:user:${user.user_id}:permissions`);
      }

      // 4. Audit log
      await this.logAudit('role_killed', 'role', roleId, reason, performedBy, {
        action: 'kill_role',
        affected_users: users.length
      });

      console.log(`[KillSwitch] Role ${roleId} killed. Affected users: ${users.length}. Reason: ${reason}`);
    } catch (error) {
      console.error('[KillSwitch] Error killing role:', error);
      throw new Error('Failed to kill role');
    }
  }

  /**
   * Tuer un tenant (tous les users du tenant)
   * @param tenantId - ID du tenant à tuer
   * @param reason - Raison de la révocation
   * @param performedBy - ID de l'admin qui effectue l'action
   */
  async killTenant(tenantId: number, reason: string, performedBy: number): Promise<void> {
    try {
      const now = new Date().toISOString();

      // 1. Marquer tenant comme disabled
      await db.prepare(`
        UPDATE tenants
        SET status = 'disabled',
            disabled_at = ?,
            disabled_by = ?
        WHERE id = ?
      `).run(now, performedBy, tenantId);

      // 2. Révoquer tous les users du tenant
      const users = await db.prepare(`
        SELECT id FROM users WHERE tenant_id = ?
      `).all(tenantId) as any[];

      for (const user of users) {
        await db.prepare(`
          UPDATE users
          SET status = 'revoked',
              revoked_at = ?,
              revoked_by = ?
          WHERE id = ?
        `).run(now, performedBy, user.id);

        // 3. Invalider les caches
        // await redis.del(`rbac:user:${user.id}:status`);
        // await redis.del(`rbac:user:${user.id}:permissions`);
      }

      // 4. Audit log
      await this.logAudit('tenant_killed', 'tenant', tenantId, reason, performedBy, {
        action: 'kill_tenant',
        affected_users: users.length
      });

      console.log(`[KillSwitch] Tenant ${tenantId} killed. Affected users: ${users.length}. Reason: ${reason}`);
    } catch (error) {
      console.error('[KillSwitch] Error killing tenant:', error);
      throw new Error('Failed to kill tenant');
    }
  }

  /**
   * Réactiver un user/role/tenant
   * @param target - Type de cible ('user' | 'role' | 'tenant')
   * @param id - ID de la cible
   */
  async revive(target: 'user' | 'role' | 'tenant', id: number): Promise<void> {
    try {
      if (target === 'user') {
        const now = new Date().toISOString();
        await db.prepare(`
          UPDATE users
          SET status = 'active',
              revoked_at = NULL,
              revoked_by = NULL,
              locked_until = NULL
          WHERE id = ?
        `).run(id);

        // await redis.del(`rbac:kill:user:${id}`);
        // await redis.del(`rbac:user:${id}:status`);
        
        await this.logAudit('user_revived', 'user', id, 'User revived', 0);
        console.log(`[KillSwitch] User ${id} revived`);
      }

      if (target === 'role') {
        // Pour un rôle, on ne peut pas "réactiver" directement
        // Il faut réactiver chaque user individuellement
        const users = await db.prepare(`
          SELECT user_id FROM platform_admins WHERE role_name = (
            SELECT role_name FROM platform_roles WHERE id = ?
          )
        `).all(id) as any[];

        const now = new Date().toISOString();
        for (const user of users) {
          await db.prepare(`
            UPDATE users
            SET status = 'active',
                revoked_at = NULL,
                revoked_by = NULL
            WHERE id = ?
          `).run(user.user_id);

          // await redis.del(`rbac:user:${user.user_id}:permissions`);
        }

        await this.logAudit('role_revived', 'role', id, 'Role revived', 0, {
          affected_users: users.length
        });
        console.log(`[KillSwitch] Role ${id} revived. Affected users: ${users.length}`);
      }

      if (target === 'tenant') {
        const now = new Date().toISOString();
        await db.prepare(`
          UPDATE tenants
          SET status = 'active',
              disabled_at = NULL,
              disabled_by = NULL
          WHERE id = ?
        `).run(id);

        // await redis.del(`rbac:kill:tenant:${id}`);
        
        await this.logAudit('tenant_revived', 'tenant', id, 'Tenant revived', 0);
        console.log(`[KillSwitch] Tenant ${id} revived`);
      }
    } catch (error) {
      console.error('[KillSwitch] Error reviving target:', error);
      throw new Error('Failed to revive target');
    }
  }

  /**
   * Vérifier si un user est tué
   * @param userId - ID de l'user
   * @returns true si l'user est tué, false sinon
   */
  async isUserKilled(userId: number): Promise<boolean> {
    try {
      // Vérifier dans Redis d'abord (si disponible)
      // const killed = await redis.get(`rbac:kill:user:${userId}`);
      // if (killed) return true;

      // Fallback DB
      const user = await db.prepare(`
        SELECT status FROM users WHERE id = ?
      `).get(userId) as any;

      return user?.status === 'revoked';
    } catch (error) {
      console.error('[KillSwitch] Error checking if user is killed:', error);
      return false;
    }
  }

  /**
   * Vérifier si un rôle est tué
   * @param roleId - ID du rôle
   * @returns true si le rôle est tué, false sinon
   */
  async isRoleKilled(roleId: number): Promise<boolean> {
    try {
      // Vérifier dans Redis d'abord (si disponible)
      // const killed = await redis.get(`rbac:kill:role:${roleId}`);
      // if (killed) return true;

      // Fallback: vérifier si le rôle existe toujours
      const role = await db.prepare(`
        SELECT id FROM platform_roles WHERE id = ?
      `).get(roleId) as any;

      return !role;  // Si le rôle n'existe plus, il est tué
    } catch (error) {
      console.error('[KillSwitch] Error checking if role is killed:', error);
      return false;
    }
  }

  /**
   * Vérifier si un tenant est tué
   * @param tenantId - ID du tenant
   * @returns true si le tenant est tué, false sinon
   */
  async isTenantKilled(tenantId: number): Promise<boolean> {
    try {
      // Vérifier dans Redis d'abord (si disponible)
      // const killed = await redis.get(`rbac:kill:tenant:${tenantId}`);
      // if (killed) return true;

      // Fallback DB
      const tenant = await db.prepare(`
        SELECT status FROM tenants WHERE id = ?
      `).get(tenantId) as any;

      return tenant?.status === 'disabled';
    } catch (error) {
      console.error('[KillSwitch] Error checking if tenant is killed:', error);
      return false;
    }
  }

  /**
   * Obtenir le statut d'un kill switch
   * @param target - Type de cible ('user' | 'role' | 'tenant')
   * @param id - ID de la cible
   * @returns true si actif, false sinon
   */
  async getKillSwitchStatus(target: 'user' | 'role' | 'tenant', id: number): Promise<boolean> {
    switch (target) {
      case 'user':
        return this.isUserKilled(id);
      case 'role':
        return this.isRoleKilled(id);
      case 'tenant':
        return this.isTenantKilled(id);
      default:
        return false;
    }
  }

  /**
   * Logger dans l'audit log
   */
  private async logAudit(
    action: string,
    targetType: 'user' | 'role' | 'tenant',
    targetId: number,
    reason?: string,
    performedBy?: number,
    metadata?: any
  ): Promise<void> {
    try {
      await db.prepare(`
        INSERT INTO rbac_audit_log (action, target_type, target_id, reason, performed_by, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        action,
        targetType,
        targetId,
        reason || null,
        performedBy || null,
        metadata ? JSON.stringify(metadata) : null
      );
    } catch (error) {
      console.error('[KillSwitch] Error logging audit:', error);
      // Ne pas throw l'erreur pour ne pas bloquer l'opération principale
    }
  }
}

// Export singleton instance
export const killSwitch = new KillSwitchService();