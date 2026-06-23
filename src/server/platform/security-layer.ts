// =============================================================================
// Security Layer - Vérifications de sécurité avant autorisation
// Architecture RBAC Production-Hardened - IAM Grade
// =============================================================================
//
// ⚠️  RÈGLES STRICTES:
// - Vérifications PURES (pas de DB, pas de I/O)
// - Les données (status, etc.) sont passées en paramètre
// - DB calls sont faits UNIQUEMENT par RBAC Cache Service
// =============================================================================

export interface SecurityContext {
  user_id: number;
  type: 'platform' | 'tenant';
  role_id: number | null;
  role_name: string | null;
  tenant_id: number | null;
  is_platform_user: boolean;
  version: number;
  user_status?: 'active' | 'suspended' | 'revoked' | 'locked';
  tenant_status?: 'active' | 'disabled' | 'suspended';
  locked_until?: string | null;
}

export interface SecurityCheckResult {
  allowed: boolean;
  reason?: string;
  code?: string;
}

export class SecurityLayer {
  /**
   * Vérification complète de sécurité - PURE FUNCTION
   * @param user - Contexte utilisateur avec status pré-chargés
   * @returns { allowed: boolean, reason?: string, code?: string }
   */
  check(user: SecurityContext): SecurityCheckResult {
    // 1. User status check (PURE - données passées en paramètre)
    const userStatus = this.checkUserStatus(user);
    if (!userStatus.allowed) {
      return userStatus;
    }

    // 2. Tenant status check (PURE - données passées en paramètre)
    if (user.type === 'tenant' && user.tenant_id) {
      const tenantStatus = this.checkTenantStatus(user);
      if (!tenantStatus.allowed) {
        return tenantStatus;
      }
    }

    // 3. Kill switches (PURE - vérification basée sur status)
    const killSwitch = this.checkKillSwitches(user);
    if (!killSwitch.allowed) {
      return killSwitch;
    }

    // 4. Version check (optionnel)
    const versionCheck = this.checkVersion(user);
    if (!versionCheck.allowed) {
      return versionCheck;
    }

    return { allowed: true };
  }

  /**
   * Vérifier le statut de l'user - PURE FUNCTION
   */
  private checkUserStatus(user: SecurityContext): SecurityCheckResult {
    // Si le status n'est pas fourni, on considère comme actif (fallback)
    const status = user.user_status || 'active';

    // Vérifier si l'user est verrouillé
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return {
        allowed: false,
        reason: 'User account is locked',
        code: 'USER_LOCKED'
      };
    }

    // Vérifier le statut
    if (status !== 'active') {
      const statusMessages: Record<string, string> = {
        'suspended': 'User account is suspended',
        'revoked': 'User account has been revoked',
        'locked': 'User account is locked'
      };

      return {
        allowed: false,
        reason: statusMessages[status] || `User status: ${status}`,
        code: `USER_${status.toUpperCase()}`
      };
    }

    return { allowed: true };
  }

  /**
   * Vérifier le statut du tenant - PURE FUNCTION
   */
  private checkTenantStatus(user: SecurityContext): SecurityCheckResult {
    // Si le status n'est pas fourni, on considère comme actif (fallback)
    const status = user.tenant_status || 'active';

    if (status !== 'active') {
      const statusMessages: Record<string, string> = {
        'disabled': 'Tenant account is disabled',
        'suspended': 'Tenant account is suspended'
      };

      return {
        allowed: false,
        reason: statusMessages[status] || `Tenant status: ${status}`,
        code: `TENANT_${status.toUpperCase()}`
      };
    }

    return { allowed: true };
  }

  /**
   * Vérifier les kill switches - PURE FUNCTION
   */
  private checkKillSwitches(user: SecurityContext): SecurityCheckResult {
    // User kill check (via status)
    const userStatus = user.user_status || 'active';
    
    if (userStatus === 'revoked') {
      return {
        allowed: false,
        reason: 'User has been killed (revoked)',
        code: 'USER_KILLED'
      };
    }

    // Tenant kill check (pour tenant users)
    if (user.type === 'tenant' && user.tenant_id) {
      const tenantStatus = user.tenant_status || 'active';
      
      if (tenantStatus === 'disabled') {
        return {
          allowed: false,
          reason: 'Tenant has been killed (disabled)',
          code: 'TENANT_KILLED'
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Vérifier la version du JWT (optionnel) - PURE FUNCTION
   */
  private checkVersion(user: SecurityContext): SecurityCheckResult {
    // Pour l'instant, pas de vérification de version
    // Cette fonctionnalité peut être ajoutée plus tard si nécessaire
    
    return { allowed: true };
  }
}

// Export singleton instance
export const securityLayer = new SecurityLayer();