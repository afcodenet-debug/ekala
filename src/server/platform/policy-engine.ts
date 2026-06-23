// =============================================================================
// Policy Engine - Couche d'autorisation PURE (IAM-grade)
// =============================================================================
// Architecture RBAC Production-Hardened - IAM Grade
// =============================================================================
// 
// ⚠️  RÈGLES STRICTES:
// - AUCUNE dépendance DB
// - AUCUN accès cache
// - AUCUN I/O
// - Pure function: INPUT → OUTPUT
// - Déterministe: même input = même output
// =============================================================================

export interface UserContext {
  sub: number;
  type: 'platform' | 'tenant';
  role_id: number | null;
  role_name: string | null;
  role?: string;  // Métier role (pour tenant users)
  permissions: string[];  // Pré-chargé depuis cache
  scope: 'global' | 'tenant' | 'hybrid';
  tenant_id: number | null;
  is_platform_user: boolean;
  version: number;
}

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
  code?: string;
  latency_ms: number;
}

export interface DecisionTrace {
  user_id: number;
  permission: string;
  decision: 'ALLOW' | 'DENY';
  reason: string;
  source: 'cache' | 'jwt';
  latency_ms: number;
  timestamp: number;
}

/**
 * Policy Engine - Pure function pour l'autorisation
 * 
 * ⚠️  INTERDICTIONS STRICTES:
 * - PAS de db.*
 * - PAS de redis.*
 * - PAS de fetch/axios
 * - PAS de file system
 * - PAS de console.log (sauf erreur critique)
 * 
 * ✅ UNIQUEMENT:
 * - Logique pure en mémoire
 * - Vérification permissions dans user.permissions[]
 * - Vérification rôles
 */
export class PolicyEngine {
  /**
   * Vérification d'autorisation - PURE FUNCTION
   * @param user - Contexte utilisateur (déjà chargé depuis cache)
   * @param permission - Permission à vérifier
   * @returns Résultat d'autorisation avec trace
   */
  authorize(user: UserContext, permission: string): AuthorizationResult & { trace: DecisionTrace } {
    const startTime = Date.now();
    
    // 1. Super admin bypass (déterministe)
    if (user.role_name === 'super_admin') {
      const latency = Date.now() - startTime;
      return {
        allowed: true,
        latency_ms: latency,
        trace: {
          user_id: user.sub,
          permission,
          decision: 'ALLOW',
          reason: 'super_admin_bypass',
          source: 'jwt',
          latency_ms: latency,
          timestamp: Date.now()
        }
      };
    }

    // 2. Vérifier la permission dans le snapshot
    const hasPermission = user.permissions.includes(permission);
    const latency = Date.now() - startTime;

    if (!hasPermission) {
      return {
        allowed: false,
        reason: `Missing permission: ${permission}`,
        code: 'FORBIDDEN',
        latency_ms: latency,
        trace: {
          user_id: user.sub,
          permission,
          decision: 'DENY',
          reason: 'permission_missing',
          source: 'cache',
          latency_ms: latency,
          timestamp: Date.now()
        }
      };
    }

    return {
      allowed: true,
      latency_ms: latency,
      trace: {
        user_id: user.sub,
        permission,
        decision: 'ALLOW',
        reason: 'permission_granted',
        source: 'cache',
        latency_ms: latency,
        timestamp: Date.now()
      }
    };
  }

  /**
   * Vérifier une permission - PURE FUNCTION
   */
  can(user: UserContext, permission: string): boolean {
    // Super admin: toutes les permissions
    if (user.role_name === 'super_admin') {
      return true;
    }

    // Vérifier dans les permissions (pré-chargées)
    return user.permissions.includes(permission);
  }

  /**
   * Vérifier un rôle - PURE FUNCTION
   */
  hasRole(user: UserContext, role: string): boolean {
    // Platform role
    if (user.role_name === role) {
      return true;
    }

    // Tenant role
    if (user.role === role) {
      return true;
    }

    return false;
  }

  /**
   * Vérifier plusieurs permissions (ANY) - PURE FUNCTION
   */
  hasAnyPermission(user: UserContext, permissions: string[]): boolean {
    if (user.role_name === 'super_admin') {
      return true;
    }

    return permissions.some(p => user.permissions.includes(p));
  }

  /**
   * Vérifier toutes les permissions (ALL) - PURE FUNCTION
   */
  hasAllPermissions(user: UserContext, permissions: string[]): boolean {
    if (user.role_name === 'super_admin') {
      return true;
    }

    return permissions.every(p => user.permissions.includes(p));
  }

  /**
   * Vérifier le scope d'accès - PURE FUNCTION
   */
  hasScope(user: UserContext, requiredScope: 'global' | 'tenant' | 'hybrid'): boolean {
    const scopeHierarchy = {
      'global': ['global', 'tenant', 'hybrid'],
      'hybrid': ['hybrid', 'tenant'],
      'tenant': ['tenant']
    };

    return scopeHierarchy[user.scope]?.includes(requiredScope) ?? false;
  }
}

// Export singleton instance
export const policyEngine = new PolicyEngine();
