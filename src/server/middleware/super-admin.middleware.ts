// =============================================================================
// Super Admin Middleware
// =============================================================================
// Vérifie que l'utilisateur est un super admin de la plateforme
// Bloque tout accès aux routes tenant pour les super admins
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { db } from '../db/database';

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

    // 2. Vérifier is_super_admin flag
    if (!user.is_super_admin) {
      res.status(403).json({ 
        error: 'FORBIDDEN', 
        message: 'Accès refusé — droits Super Admin requis' 
      });
      return;
    }

    // 3. Vérifier que l'utilisateur n'appartient pas à un tenant
    // (super_admin ne doit pas avoir de tenant_id)
    if (user.tenant_id) {
      res.status(403).json({ 
        error: 'FORBIDDEN', 
        message: 'Un Super Admin ne peut pas appartenir à un tenant' 
      });
      return;
    }

    // 4. Vérifier que le rôle est bien super_admin
    if (user.role !== 'super_admin') {
      res.status(403).json({ 
        error: 'FORBIDDEN', 
        message: 'Rôle invalide — Super Admin requis' 
      });
      return;
    }

    // 5. Attacher les informations à la requête
    req.superAdmin = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
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
// =============================================================================

export function requireSuperAdminOrOwner(req: Request, res: Response, next: NextFunction): void {
  try {
    const user = req.user as any;

    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentification requise' });
      return;
    }

    // Super Admin
    if (user.is_super_admin && user.role === 'super_admin') {
      req.superAdmin = {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        is_super_admin: true,
        tenant_id: user.tenant_id || null,
      };
      req.isSuperAdmin = true;
      next();
      return;
    }

    // Owner (tenant-specific)
    if (user.role === 'owner') {
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
// =============================================================================

export function requirePlatformAccess(req: Request, res: Response, next: NextFunction): void {
  try {
    const user = req.user as any;

    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentification requise' });
      return;
    }

    // Super Admin
    if (user.is_super_admin && user.role === 'super_admin') {
      req.superAdmin = {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
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

export async function isSuperAdmin(userId: number): Promise<boolean> {
  try {
    const result = await db('users')
      .where('id', userId)
      .where('is_super_admin', 1)
      .where('role', 'super_admin')
      .first();

    return !!result;
  } catch (error) {
    console.error('[isSuperAdmin] Error:', error);
    return false;
  }
}

// =============================================================================
// Helper: Obtenir les permissions d'un super admin
// =============================================================================

export async function getSuperAdminPermissions(userId: number): Promise<string[]> {
  try {
    const result = await db('platform_admins')
      .where('user_id', userId)
      .first();

    if (!result) {
      return ['*']; // Par défaut, tous les droits
    }

    try {
      return JSON.parse(result.permissions);
    } catch {
      return ['*'];
    }
  } catch (error) {
    console.error('[getSuperAdminPermissions] Error:', error);
    return ['*'];
  }
}

// =============================================================================
// Helper: Vérifier une permission spécifique
// =============================================================================

export async function hasPermission(userId: number, permission: string): Promise<boolean> {
  try {
    const permissions = await getSuperAdminPermissions(userId);
    
    // Wildcard = tous les droits
    if (permissions.includes('*')) {
      return true;
    }

    // Vérifier permission spécifique
    return permissions.includes(permission);
  } catch (error) {
    console.error('[hasPermission] Error:', error);
    return false;
  }
}

// =============================================================================
// requirePermission — Middleware pour vérifier une permission spécifique
// =============================================================================

export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user as any;

      if (!user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentification requise' });
        return;
      }

      // Super Admin a tous les droits
      if (user.is_super_admin && user.role === 'super_admin') {
        next();
        return;
      }

      // Vérifier permission spécifique
      const hasPerm = await hasPermission(user.id, permission);
      
      if (!hasPerm) {
        res.status(403).json({ 
          error: 'FORBIDDEN', 
          message: `Permission requise: ${permission}` 
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