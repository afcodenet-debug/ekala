// =============================================================================
// Super Admin Middleware
// Architecture RBAC Production-Hardened - IAM Grade
// =============================================================================
// Vérifie que l'utilisateur est un super admin de la plateforme
// Bloque tout accès aux routes tenant pour les super admins
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { policyEngine } from '../platform/policy-engine';
import { securityLayer } from '../platform/security-layer';

// Types
interface SuperAdminUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_super_admin: boolean;
  tenant_id?: number | null;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: any;
      superAdmin?: SuperAdminUser;
      isSuperAdmin?: boolean;
    }
  }
}

// =============================================================================
// requireSuperAdmin — Middleware principal
// =============================================================================

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  try {
    // 1. Vérifier JWT (déjà fait par le middleware auth)
    const user = req.user as any;
    
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentification requise' });
      return;
    }

    // 2. Security Layer: Vérifier le statut et les kill switches (SYNCHRONE)
    const securityCheck = securityLayer.check({
      user_id: user.sub || user.id,
      type: 'platform',
      role_id: user.role_id,
      role_name: user.role_name || user.role,
      tenant_id: null,
      is_platform_user: true,
      version: user.version || 1
    });

    if (!securityCheck.allowed) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: securityCheck.reason || 'Accès refusé — vérification de sécurité échouée',
        code: securityCheck.code
      });
      return;
    }

    // 3. Policy Engine: Vérifier le rôle super_admin (PURE FUNCTION - SYNCHRONE)
    const hasRole = policyEngine.hasRole(user, 'super_admin');
    
    if (!hasRole) {
      res.status(403).json({ 
        error: 'FORBIDDEN', 
        message: 'Accès refusé — droits Super Admin requis' 
      });
      return;
    }

    // 4. Vérifier que l'utilisateur n'appartient pas à un tenant
    // (super_admin ne doit pas avoir de tenant_id)
    if (user.tenant_id) {
      res.status(403).json({ 
        error: 'FORBIDDEN', 
        message: 'Un Super Admin ne peut pas appartenir à un tenant' 
      });
      return;
    }

    // 5. Attacher les informations à la requête
    req.superAdmin = {
      id: user.sub || user.id,
      email: user.email,
      full_name: user.full_name || '',
      role: user.role_name || user.role,
      is_super_admin: true,
      tenant_id: user.tenant_id || null,
    };

    req.isSuperAdmin = true;

    next();
  } catch (error) {
    console.error('[SuperAdminMiddleware] Error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors de la vérification Super Admin' });
  }
}

// =============================================================================
// requireSuperAdminOrOwner — Super Admin OU Owner (pour cas hybrides)
// Architecture RBAC Production-Hardened
// =============================================================================

export function requireSuperAdminOrOwner(req: Request, res: Response, next: NextFunction): void {
  try {
    const user = req.user as any;

    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentification requise' });
      return;
    }

    // Security Layer: Vérifier le statut (SYNCHRONE)
    const securityCheck = securityLayer.check({
      user_id: user.sub || user.id,
      type: user.type || 'platform',
      role_id: user.role_id,
      role_name: user.role_name || user.role,
      tenant_id: user.tenant_id,
      is_platform_user: user.is_platform_user,
      version: user.version || 1
    });

    if (!securityCheck.allowed) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: securityCheck.reason || 'Accès refusé — vérification de sécurité échouée',
        code: securityCheck.code
      });
      return;
    }

    // Super Admin (via Policy Engine - PURE FUNCTION)
    const isSuperAdmin = policyEngine.hasRole(user, 'super_admin');
    
    if (isSuperAdmin) {
      req.superAdmin = {
        id: user.sub || user.id,
        email: user.email,
        full_name: user.full_name || '',
        role: user.role_name || user.role,
        is_super_admin: true,
        tenant_id: user.tenant_id || null,
      };
      req.isSuperAdmin = true;
      next();
      return;
    }

    // Owner (tenant-specific)
    if (user.role === 'owner' || user.role_name === 'owner') {
      req.isSuperAdmin = false;
      next();
      return;
    }

    res.status(403).json({ 
      error: 'FORBIDDEN', 
      message: 'Accès refusé — Super Admin ou Owner requis' 
    });
  } catch (error) {
    console.error('[SuperAdminOrOwnerMiddleware] Error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors de la vérification des permissions' });
  }
}

// =============================================================================
// requirePlatformAccess — Vérifie accès plateforme (Super Admin ou Owner)
// Architecture RBAC Production-Hardened
// =============================================================================

export function requirePlatformAccess(req: Request, res: Response, next: NextFunction): void {
  try {
    const user = req.user as any;

    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentification requise' });
      return;
    }

    // Security Layer: Vérifier le statut (SYNCHRONE)
    const securityCheck = securityLayer.check({
      user_id: user.sub || user.id,
      type: user.type || 'platform',
      role_id: user.role_id,
      role_name: user.role_name || user.role,
      tenant_id: user.tenant_id,
      is_platform_user: user.is_platform_user,
      version: user.version || 1
    });

    if (!securityCheck.allowed) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: securityCheck.reason || 'Accès refusé — vérification de sécurité échouée',
        code: securityCheck.code
      });
      return;
    }

    // Super Admin (via Policy Engine - PURE FUNCTION)
    const isSuperAdmin = policyEngine.hasRole(user, 'super_admin');
    
    if (isSuperAdmin) {
      req.superAdmin = {
        id: user.sub || user.id,
        email: user.email,
        full_name: user.full_name || '',
        role: user.role_name || user.role,
        is_super_admin: true,
        tenant_id: user.tenant_id || null,
      };
      req.isSuperAdmin = true;
      next();
      return;
    }

    // Owner, admin, manager (tenant-specific)
    if (['owner', 'admin', 'manager'].includes(user.role)) {
      req.isSuperAdmin = false;
      next();
      return;
    }

    res.status(403).json({ 
      error: 'FORBIDDEN', 
      message: 'Accès refusé — permissions insuffisantes' 
    });
  } catch (error) {
    console.error('[PlatformAccessMiddleware] Error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors de la vérification des permissions' });
  }
}

// =============================================================================
// Helper: Vérifier si un utilisateur est super admin
// =============================================================================

export function isSuperAdmin(user: any): boolean {
  try {
    // Policy Engine - PURE FUNCTION (synchrone)
    return policyEngine.hasRole(user, 'super_admin');
  } catch (error) {
    console.error('[isSuperAdmin] Error:', error);
    return false;
  }
}

// =============================================================================
// Helper: Obtenir les permissions d'un super admin
// =============================================================================

export function getSuperAdminPermissions(): string[] {
  try {
    // Super admin a toutes les permissions
    return ['*'];
  } catch (error) {
    console.error('[getSuperAdminPermissions] Error:', error);
    return ['*'];
  }
}

// =============================================================================
// Helper: Vérifier une permission spécifique
// =============================================================================

export function hasPermission(user: any, permission: string): boolean {
  try {
    // Policy Engine - PURE FUNCTION (synchrone)
    const result = policyEngine.authorize(user, permission);
    return result.allowed;
  } catch (error) {
    console.error('[hasPermission] Error:', error);
    return false;
  }
}

// =============================================================================
// requirePermission — Middleware pour vérifier une permission spécifique
// Architecture: Security Layer → Policy Engine → Allow/Deny
// =============================================================================

export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user as any;

      if (!user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentification requise' });
        return;
      }

      // Policy Engine - PURE FUNCTION (synchrone)
      const result = policyEngine.authorize(user, permission);
      
      if (!result.allowed) {
        res.status(403).json({ 
          error: 'FORBIDDEN', 
          message: result.reason || `Permission requise: ${permission}`,
          code: result.code
        });
        return;
      }

      next();
    } catch (error) {
      console.error('[requirePermission] Error:', error);
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors de la vérification des permissions' });
    }
  };
}
