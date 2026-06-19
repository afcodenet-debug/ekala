// =============================================================================
// JWT Authentication Middleware — Multi-Tenant SaaS
// =============================================================================
// Professional JWT-based auth that:
// - Validates Bearer tokens on every protected route
// - Extracts tenant_id for data isolation
// - Provides typed req.user with tenant context
// - Supports both JWT (production) and local mode (dev/SQLite)
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';

// ── JWT Secret (symmetric HMAC-SHA256) ──────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'ekala-dev-fallback-secret-change-in-production-2026';
const JWT_EXPIRY_HOURS = 24; // 24h session

// ── Types ──────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: number;          // user ID
  tenant_id: number;    // tenant ID (critical for multi-tenant isolation)
  role: string;         // user role within the tenant
  email?: string;
  full_name?: string;
  iat: number;          // issued at (epoch seconds)
  exp: number;          // expires at (epoch seconds)
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// ── JWT Utilities (HMAC-SHA256 — zero dependency) ──────────────────────────────

function base64url(data: Buffer | string): string {
  return (Buffer.isBuffer(data) ? data : Buffer.from(data))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64urlDecode(str: string): Buffer {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return Buffer.from(b64, 'base64');
}

export function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(JSON.stringify({ ...payload, iat: now, exp: now + JWT_EXPIRY_HOURS * 3600 }));
  const signatureInput = `${header}.${body}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(signatureInput).digest();
  return `${signatureInput}.${base64url(signature)}`;
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('[JWT] Token format incorrect');
      return null;
    }

    const [header, body, sig] = parts;
    const signatureInput = `${header}.${body}`;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(signatureInput).digest();
    const actualSig = base64urlDecode(sig);

    if (actualSig.length !== expectedSig.length || !crypto.timingSafeEqual(expectedSig, actualSig)) {
      console.warn('[JWT] Signature invalide (Secret mismatch?)');
      return null;
    }

    const payload: JwtPayload = JSON.parse(base64urlDecode(body).toString('utf-8'));
    
    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.warn('[JWT] Token expiré:', { exp: payload.exp, now });
      return null;
    }

    return payload;
  } catch (err: any) {
    console.error('[JWT] Erreur fatale:', err.message);
    return null;
  }
}

// ── Middleware: requireAuth ─────────────────────────────────────────────────────
// Extracts and validates JWT from Authorization: Bearer <token>
// Sets req.user with full JwtPayload including tenant_id

export const requireJwtAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Token d\'authentification requis. Veuillez vous connecter.',
    });
  }

  const token = authHeader.slice(7);
  const payload = verifyJwt(token);

  if (!payload) {
    return res.status(401).json({
      error: 'TOKEN_INVALID',
      message: 'Token expiré ou invalide. Veuillez vous reconnecter.',
    });
  }

  // Inject the authenticated user (with tenant_id) into the request
  req.user = payload;
  next();
};

// ── Middleware: requirePermission ───────────────────────────────────────────────
// Checks that the authenticated user (from JWT) has the required role/permission

export const requirePermission = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentification requise.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `Accès réservé aux rôles: ${allowedRoles.join(', ')}`,
        provided: req.user.role,
      });
    }

    next();
  };
};

// ── Convenience role guards ────────────────────────────────────────────────────

export const requireAdmin = requirePermission(['admin', 'super_admin']);
export const requireAdminOrManager = requirePermission(['admin', 'manager', 'super_admin']);
export const requireCashierOrAbove = requirePermission(['admin', 'manager', 'cashier', 'super_admin']);

// ── Helper: get tenant_id from request ─────────────────────────────────────────
// Useful in route handlers to scope database queries

export function getTenantId(req: AuthenticatedRequest): number {
  if (!req.user?.tenant_id) {
    throw new Error('No tenant context — authentication required');
  }
  return req.user.tenant_id;
}

export function getUserId(req: AuthenticatedRequest): number {
  if (!req.user?.sub) {
    throw new Error('No user context — authentication required');
  }
  return req.user.sub;
}

export function getUserRole(req: AuthenticatedRequest): string {
  return req.user?.role || 'unknown';
}