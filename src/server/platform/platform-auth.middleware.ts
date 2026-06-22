// =============================================================================
// Platform Auth Middleware — Validation JWT et Accès Plateforme
// =============================================================================
// Middleware totalement séparé du tenant auth
// Vérifie que:
//   1. Le token JWT est valide
//   2. L'utilisateur est un platform user (is_platform_user = true)
//   3. Le compte est actif
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { verifyPlatformJwt, PlatformJwtPayload } from './platform-auth.service';
import { db } from '../db/database';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PlatformAuthenticatedRequest extends Request {
  platformUser?: PlatformJwtPayload;
}

// ── Middleware: requirePlatformAuth ─────────────────────────────────────────────

/**
 * Middleware qui valide le JWT plateforme
 * Rejette:
 *   - Tokens invalides
 *   - Utilisateurs tenant (owner, admin, etc.)
 *   - Comptes suspendus
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
    if (!payload.is_platform_user) {
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
      `SELECT id, email FROM users WHERE id = ? AND is_platform_user = 1 AND is_active = 1 LIMIT 1`
    ).get(payload.sub) as any;

    if (!user) {
      return res.status(403).json({
        error: 'PLATFORM_USER_INACTIVE',
        message: 'Ce compte a été désactivé. Contactez un administrateur.',
      });
    }

    // Injecter le payload dans la requête
    req.platformUser = payload;
    (req as any).user = { ...payload, is_super_admin: true };
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
      const payload = req.platformUser;

      if (!payload) {
        return res.status(401).json({
          error: 'PLATFORM_UNAUTHORIZED',
          message: 'Authentification requise.',
        });
      }

      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

      if (!roles.includes(payload.role)) {
        return res.status(403).json({
          error: 'PLATFORM_FORBIDDEN',
          message: `Accès réservé aux rôles: ${roles.join(', ')}`,
          your_role: payload.role,
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
 */
export const requirePlatformPermission = (permission: string) => {
  return async (req: PlatformAuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const payload = req.platformUser;

      if (!payload) {
        return res.status(401).json({
          error: 'PLATFORM_UNAUTHORIZED',
          message: 'Authentification requise.',
        });
      }

      // Super admin a toutes les permissions
      if (payload.role === 'super_admin') {
        return next();
      }

      // Charger les permissions du rôle
      const { platformAuthService } = require('./platform-auth.service');
      const permissions = await platformAuthService.getPermissions(payload.role);

      if (!permissions.includes(permission) && !permissions.includes('*')) {
        return res.status(403).json({
          error: 'PLATFORM_FORBIDDEN',
          message: `Permission requise: ${permission}`,
          your_permissions: permissions,
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