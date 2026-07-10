/**
 * CANONICAL IDENTITY MIDDLEWARE — Enforces canonical_id usage across the system
 * 
 * Règles strictes :
 * 1. Aucune requête ne doit contenir sqlite_id ou supabase_id
 * 2. Tous les IDs utilisateur doivent être des canonical_id (UUID)
 * 3. Toute violation est loggée et rejetée avec 400
 */

import { Request, Response, NextFunction } from 'express';
import { identityResolver } from '../services/identity-resolution.service';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CanonicalIdentityRequest extends Request {
  canonicalUserId?: string;
  identityMapping?: {
    canonical_id: string;
    sqlite_id: number | null;
    supabase_id: string | null;
  };
}

// ── Middleware ─────────────────────────────────────────────────────────────────

/**
 * Middleware qui rejette toute requête contenant des IDs non-canoniques.
 * À appliquer sur toutes les routes métier.
 */
export function requireCanonicalIdentity(req: CanonicalIdentityRequest, res: Response, next: NextFunction): void {
  const body = req.body || {};
  const query = req.query || {};
  
  // Champs interdits dans les requêtes
  const forbiddenFields = [
    'sqlite_id',
    'supabase_id',
    'remote_id',
    'local_id',
    'database_id'
  ];

  // Vérifier le body
  const violations: string[] = [];
  for (const field of forbiddenFields) {
    if (body[field] !== undefined) {
      violations.push(`Body contains forbidden field: ${field}`);
    }
  }

  // Vérifier les query params
  for (const field of forbiddenFields) {
    if (query[field] !== undefined) {
      violations.push(`Query contains forbidden field: ${field}`);
    }
  }

  if (violations.length > 0) {
    console.error('[CanonicalIdentityMiddleware] Violation detected:', {
      path: req.path,
      method: req.method,
      violations,
      body: JSON.stringify(body),
      query: JSON.stringify(query)
    });

    res.status(400).json({
      error: 'CANONICAL_ID_REQUIRED',
      message: 'Cette API utilise uniquement des canonical_id (UUID). Les IDs SQLite ou Supabase sont interdits.',
      violations,
      hint: 'Utilisez identityResolver.resolve() pour convertir les IDs vers canonical_id'
    });
    return;
  }

  next();
}

/**
 * Middleware qui résout automatiquement un waiter_id vers canonical_id.
 * Pour les routes d'assignation de table.
 */
export async function resolveWaiterCanonicalId(req: CanonicalIdentityRequest, res: Response, next: NextFunction): Promise<void> {
  const waiterId = req.body?.waiter_id || req.body?.assigned_waiter_id;
  
  if (!waiterId) {
    next();
    return;
  }

  const tenantId = req.body?.tenant_id || req.query?.tenant_id;
  
  if (!tenantId) {
    console.error('[ResolveWaiterCanonicalId] Missing tenant_id for waiter resolution');
    res.status(400).json({
      error: 'TENANT_ID_REQUIRED',
      message: 'tenant_id est requis pour résoudre un waiter_id vers canonical_id'
    });
    return;
  }

  try {
    // Résoudre vers canonical_id + supabase_id (ASYNC)
    const resolution = await identityResolver.resolveForTableAssignment(
      Number(waiterId),
      Number(tenantId)
    );

    if (!resolution) {
      console.error('[ResolveWaiterCanonicalId] Failed to resolve waiter:', { waiterId, tenantId });
      res.status(404).json({
        error: 'WAITER_NOT_FOUND',
        message: `Waiter ${waiterId} introuvable dans les systèmes SQLite/Supabase`
      });
      return;
    }

    // Attacher le canonical_id à la requête
    req.canonicalUserId = resolution.canonical_id;
    req.identityMapping = {
      canonical_id: resolution.canonical_id,
      sqlite_id: null, // Sera rempli par le service si nécessaire
      supabase_id: resolution.supabase_id
    };

    // Remplacer le waiter_id dans le body par canonical_id
    if (req.body.waiter_id) {
      req.body.waiter_id = resolution.canonical_id;
    }
    if (req.body.assigned_waiter_id) {
      req.body.assigned_waiter_canonical_id = resolution.canonical_id;
      req.body.assigned_waiter_supabase_id = resolution.supabase_id;
    }

    next();
  } catch (err: any) {
    console.error('[ResolveWaiterCanonicalId] Error:', err.message);
    res.status(500).json({
      error: 'IDENTITY_RESOLUTION_FAILED',
      message: 'Échec de la résolution de l\'identité du waiter'
    });
  }
}

/**
 * Middleware qui valide qu'un canonical_id est présent et valide.
 */
export function validateCanonicalId(req: CanonicalIdentityRequest, res: Response, next: NextFunction): void {
  const canonicalId = req.body?.canonical_id || req.params?.canonical_id || req.canonicalUserId;

  if (!canonicalId) {
    res.status(400).json({
      error: 'CANONICAL_ID_MISSING',
      message: 'canonical_id est requis pour cette opération'
    });
    return;
  }

  // Vérifier que c'est bien un UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(String(canonicalId))) {
    res.status(400).json({
      error: 'INVALID_CANONICAL_ID',
      message: 'canonical_id doit être un UUID valide',
      provided: canonicalId
    });
    return;
  }

  next();
}