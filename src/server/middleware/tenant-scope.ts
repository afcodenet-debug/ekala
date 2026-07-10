// =============================================================================
// Middleware d'Isolation Multi-Tenant
// =============================================================================
// Ce middleware s'assure que TOUTES les requêtes vers les données
// sont filtrées par le tenant_id de l'utilisateur connecté.
//
// Usage dans une route :
//   import { requireTenantScope } from '../middleware/tenant-scope';
//   router.get('/', requireTenantScope, (req, res) => {
//     const tenantId = req.tenant_id; // scope garanti
//     const data = db.prepare('SELECT * FROM products WHERE tenant_id = ?').all(tenantId);
//   });
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { getTenantId } from './jwt-auth';
import { tenantStorage } from '../db/tenant-context';
import { getCurrentTrace } from '../services/trace-manager.service';

// Augmentation du type Request pour inclure tenant_id
declare global {
  namespace Express {
    interface Request {
      tenant_id?: number;
      user_id?: number;
    }
  }
}

/**
 * Middleware qui :
 * 1. Extrait le tenant_id du JWT (via getTenantId)
 * 2. L'injecte dans req.tenant_id pour utilisation dans les routes
 * 3. Vérifie que l'utilisateur est authentifié
 * 4. ENVELOPPE l'exécution de la requête dans un contexte AsyncLocalStorage
 *
 * À utiliser sur toutes les routes qui accèdent à des données multi-tenant.
 */
export function requireTenantScope(req: Request, _res: Response, next: NextFunction) {
  const requestId = (req as any).requestId || 'unknown';
  const trace = getCurrentTrace();
  
  try {
    const user = (req as any).user;
    
    // FORENSIC TRACE — TENANT step
    trace.enter('TENANT', {
      requestId,
      userId: user?.sub,
      userRole: user?.role,
      isPlatform: user?.type === 'platform' || user?.is_platform_user,
      path: req.path,
      method: req.method
    });
    
    // Les admins plateforme n'ont pas de tenant_id (ils gèrent tous les tenants)
    // Leur accès est contrôlé par requirePlatformAuth / requirePlatformPermission
    if (user?.type === 'platform' || user?.is_platform_user) {
      // Platform admin: pas de scope tenant nécessaire
      // Leur accès est déjà validé par le middleware platform
      trace.exit('TENANT', { reason: 'platform_admin' });
      return next();
    }
    
    // Utilisateur tenant: extraire et vérifier le tenant_id
    const tenantId = getTenantId(req as any);
    const userId = user?.sub;
    
    req.tenant_id = tenantId;
    req.user_id = userId;
    
    trace.exit('TENANT', { tenantId, userId });
    
    // On utilise AsyncLocalStorage pour rendre le tenant_id disponible partout 
    // sans avoir à le passer manuellement à chaque fonction.
    tenantStorage.run({ tenantId, userId }, () => {
      next();
    });
  } catch (e: any) {
    trace.error('TENANT', e, { requestId });
    return _res.status(401).json({
      error: 'AUTH_REQUIRED',
      message: 'Authentification requise pour accéder à cette ressource.',
    });
  }
}

/**
 * Helper pour construire une requête SQL avec filtre tenant.
 * Garantit que le filtre tenant_id est TOUJOURS appliqué.
 */
export function buildTenantQuery(
  baseQuery: string, 
  prefix: string = ''
): { query: string; paramKey: string } {
  const tableAlias = prefix ? `${prefix}.` : '';
  const whereClause = `WHERE ${tableAlias}tenant_id = @tenant_id`;
  
  // Si la requête a déjà un WHERE, ajouter AND
  if (baseQuery.toUpperCase().includes('WHERE')) {
    return {
      query: `${baseQuery} AND ${tableAlias}tenant_id = @tenant_id`,
      paramKey: 'tenant_id',
    };
  }
  
  // Sinon, insérer le WHERE avant ORDER BY / LIMIT / GROUP BY
  const orderByIdx = baseQuery.toUpperCase().indexOf('ORDER BY');
  const limitIdx = baseQuery.toUpperCase().indexOf('LIMIT');
  const groupByIdx = baseQuery.toUpperCase().indexOf('GROUP BY');
  
  let insertAt = baseQuery.length;
  if (orderByIdx >= 0) insertAt = Math.min(insertAt, orderByIdx);
  if (limitIdx >= 0) insertAt = Math.min(insertAt, limitIdx);
  if (groupByIdx >= 0) insertAt = Math.min(insertAt, groupByIdx);
  
  return {
    query: `${baseQuery.slice(0, insertAt)} WHERE ${tableAlias}tenant_id = @tenant_id ${baseQuery.slice(insertAt)}`.trim(),
    paramKey: 'tenant_id',
  };
}

export default requireTenantScope;