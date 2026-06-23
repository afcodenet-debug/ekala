// =============================================================================
// Platform Auth Middleware — Validation JWT et Accès Plateforme
// Architecture RBAC Production-Hardened
// =============================================================================
// Middleware totalement séparé du tenant auth
// Vérifie que:
//   1. Le token JWT est valide
//   2. L'utilisateur est un platform user (type = 'platform')
//   3. Security Layer: user status + kill switches
//   4. Policy Engine: permissions (si requis)
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { verifyPlatformJwt, PlatformJwtPayload } from './platform-auth.service';
import { securityLayer } from './security-layer';
import { policyEngine } from './policy-engine';
import { rbacCache } from './rbac-cache.service';
import { decisionTrace } from './decision-trace.service';
import { db } from '../db/database';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PlatformAuthenticatedRequest extends Request {
  platformUser?: PlatformJwtPayload;
  user?: any;  // User context avec permissions
}

// ── Middleware: requirePlatformAuth ─────────────────────────────────────────────

/**
 * Middleware qui valide le JWT plateforme et vérifie la sécurité
 * Architecture: JWT → Security Layer → Policy Engine → Allow/Deny
 */
export const requirePlatformAuth = async (
  req: PlatformAuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'PLATFORM_UNAUTHORIZED',
        message: 'Token d\'authentification plateforme requis.',
      });
    }

    const token = authHeader.slice(7);
    const payload = verifyPlatformJwt(token);

    if (!payload) {
      return res.status(401).json({
        error: 'PLATFORM_TOKEN_INVALID',
        message: 'Token invalide ou expiré. Veuillez vous reconnecter.',
      });
    }

    // Vérifier que c'est bien un utilisateur plateforme
    if (payload.type !== 'platform') {
      return res.status(403).json({
        error: 'PLATFORM_ACCESS_DENIED',
        message: 'Accès réservé au personnel de la plateforme.',
      });
    }

    // Vérifier que l'utilisateur existe toujours et est actif
    if (!db) {
      return res.status(503).json({
        error: 'PLATFORM_DB_UNAVAILABLE',
        message: 'Base de données indisponible.',
      });
    }

    const user = db.prepare(
      `SELECT id, email, role, status FROM users WHERE id = ? AND is_platform_user = 1 AND is_active = 1 LIMIT 1`
    ).get(payload.sub) as any;

    if (!user) {
      return res.status(403).json({
        error: 'PLATFORM_USER_INACTIVE',
        message: 'Ce compte a été désactivé. Contactez un administrateur.',
      });
    }

    // Security Layer: Vérifier le statut et les kill switches (PURE FUNCTION - synchrone)
    const securityCheck = securityLayer.check({
      user_id: user.id,
      type: 'platform',
      role_id: payload.role_id,
      role_name: user.role,
      tenant_id: null,
      is_platform_user: true,
      version: payload.version,
      user_status: user.status
    });

    if (!securityCheck.allowed) {
      return res.status(403).json({
        error: 'PLATFORM_SECURITY_CHECK_FAILED',
        message: securityCheck.reason,
        code: securityCheck.code,
      });
    }

    // Charger les permissions (avec cache)
    const permissions = await rbacCache.getUserPermissions(user.id);

    // Injecter le payload et le contexte utilisateur dans la requête
    req.platformUser = payload;
    (req as any).user = {
      ...payload,
      email: user.email,
      role: user.role,
      permissions: permissions?.permissions || [],
      is_super_admin: user.role === 'super_admin'
    };

    next();
  } catch (error) {
    console.error('[PlatformAuth] Middleware error:', error);
    return res.status(500).json({
      error: 'PLATFORM_AUTH_ERROR',
      message: 'Erreur lors de la vérification d\'authentification.',
    });
  }
};

// ── Middleware: requirePlatformRole ─────────────────────────────────────────────

/**
 * Middleware qui vérifie que l'utilisateur a un rôle spécifique
 * Usage: requirePlatformRole('super_admin')
 * Usage: requirePlatformRole(['super_admin', 'finance_admin'])
 */
export const requirePlatformRole = (allowedRoles: string | string[]) => {
  return async (req: PlatformAuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({
          error: 'PLATFORM_UNAUTHORIZED',
          message: 'Authentification requise.',
        });
      }

      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

      // Utiliser Policy Engine pour vérifier le rôle (vérifier chaque rôle autorisé)
      const hasRole = await policyEngine.hasRole(user, roles[0]);

      if (!hasRole) {
        return res.status(403).json({
          error: 'PLATFORM_FORBIDDEN',
          message: `Accès réservé aux rôles: ${roles.join(', ')}`,
          your_role: user.role_name || user.role,
        });
      }

      next();
    } catch (error) {
      console.error('[PlatformAuth] Role middleware error:', error);
      return res.status(500).json({
        error: 'PLATFORM_AUTH_ERROR',
        message: 'Erreur lors de la vérification des permissions.',
      });
    }
  };
};

// ── Middleware: requirePlatformPermission ───────────────────────────────────────

/**
 * Middleware qui vérifie une permission spécifique
 * Usage: requirePlatformPermission('tenants:read')
 * Architecture: Security Layer → Policy Engine → Allow/Deny
 */
export const requirePlatformPermission = (permission: string) => {
  return async (req: PlatformAuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({
          error: 'PLATFORM_UNAUTHORIZED',
          message: 'Authentification requise.',
        });
      }

      // Utiliser Policy Engine pour vérifier la permission (PURE FUNCTION)
      const result = policyEngine.authorize(user, permission);

      // Logger la décision (Decision Trace)
      if (result.trace) {
        // Fire and forget - ne pas bloquer la requête
        decisionTrace.log(result.trace).catch(err => {
          console.error('[Middleware] Error logging decision trace:', err);
        });
      }

      if (!result.allowed) {
        return res.status(403).json({
          error: 'PLATFORM_FORBIDDEN',
          message: result.reason || `Permission requise: ${permission}`,
          code: result.code,
          your_permissions: user.permissions,
        });
      }

      next();
    } catch (error) {
      console.error('[PlatformAuth] Permission middleware error:', error);
      return res.status(500).json({
        error: 'PLATFORM_AUTH_ERROR',
        message: 'Erreur lors de la vérification des permissions.',
      });
    }
  };
};

// ── Middleware: prevent Tenant Users ────────────────────────────────────────────

/**
 * Middleware de sécurité qui bloque les utilisateurs tenant
 * S'utilise pour les routes /api/platform/*
 */
export const preventTenantAccess = async (
  req: PlatformAuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      
      // Tenter de vérifier avec le JWT tenant
      const { verifyJwt } = require('../middleware/jwt-auth');
      const tenantPayload = verifyJwt(token);

      // Si c'est un token tenant valide, bloquer
      if (tenantPayload && !(req as any).platformUser) {
        return res.status(403).json({
          error: 'PLATFORM_ACCESS_DENIED',
          message: 'Ce portail est réservé au personnel de la plateforme. Utilisez votre compte plateforme.',
        });
      }
    }

    next();
  } catch (error) {
    // Ignorer les erreurs — le middleware principal gère
    next();
  }
};