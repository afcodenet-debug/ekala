/**
 * Limits Guard Middleware
 * Vérifie les limites d'utilisation avant chaque action critique
 * 
 * Utilisation:
 * - Bloque les actions qui dépassent les limites du plan
 * - Ajoute des warnings dans les headers de réponse
 * - Log les violations pour audit
 */

import { Request, Response, NextFunction } from 'express';
import { limitsEnforcer, LimitCheckResult } from '../services/limits-enforcer.service';

export interface LimitsGuardOptions {
  checkAction?: 'create_user' | 'create_table' | 'create_product' | 'create_order';
  requireAllowed?: boolean; // Si true, bloque la requête si limites dépassées
  addWarnings?: boolean; // Si true, ajoute les warnings dans les headers
}

/**
 * Middleware qui vérifie les limites d'utilisation
 */
export function limitsGuard(options: LimitsGuardOptions = {}) {
  const {
    checkAction,
    requireAllowed = true,
    addWarnings = true,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = (req as any).tenant_id;

    if (!tenantId) {
      return next();
    }

    try {
      // Vérifier les limites générales
      const limitCheck = await limitsEnforcer.checkLimits(tenantId);

      // Ajouter les informations dans la requête pour utilisation ultérieure
      (req as any).limits = limitCheck;

      // Si une action spécifique est demandée
      if (checkAction) {
        const actionCheck = await limitsEnforcer.checkAction(tenantId, checkAction);
        
        if (!actionCheck.allowed && requireAllowed) {
          console.log(`[LimitsGuard] Action bloquée:`, {
            tenantId,
            action: checkAction,
            reason: actionCheck.reason,
            path: req.path,
            method: req.method,
          });

          return res.status(403).json({
            error: 'LIMIT_EXCEEDED',
            message: actionCheck.reason,
            action: checkAction,
            limits: {
              usage: limitCheck.usage,
              limits: limitCheck.limit,
            },
          });
        }
      }

      // Si les limites sont globalement dépassées
      if (!limitCheck.allowed && requireAllowed) {
        console.log(`[LimitsGuard] Accès bloqué - limites dépassées:`, {
          tenantId,
          violations: limitCheck.violations,
          path: req.path,
          method: req.method,
        });

        return res.status(403).json({
          error: 'LIMITS_EXCEEDED',
          message: 'Votre abonnement a atteint ses limites',
          violations: limitCheck.violations,
          limits: {
            usage: limitCheck.usage,
            limits: limitCheck.limit,
          },
          upgradeUrl: '/pricing',
        });
      }

      // Ajouter les warnings dans les headers
      if (addWarnings && (limitCheck.warnings.length > 0 || limitCheck.violations.length > 0)) {
        res.setHeader('X-Limits-Warnings', JSON.stringify(limitCheck.warnings));
        res.setHeader('X-Limits-Violations', JSON.stringify(limitCheck.violations));
        res.setHeader('X-Limits-Usage', JSON.stringify({
          users: `${limitCheck.usage.users}/${limitCheck.limit.max_users || '∞'}`,
          tables: `${limitCheck.usage.tables}/${limitCheck.limit.max_tables || '∞'}`,
          products: `${limitCheck.usage.products}/${limitCheck.limit.max_products || '∞'}`,
          orders: `${limitCheck.usage.orders_this_month}/${limitCheck.limit.max_orders_per_month || '∞'}`,
        }));
      }

      next();
    } catch (error) {
      console.error(`[LimitsGuard] Error for tenant ${tenantId}:`, error);
      // Fail-open: allow request on error
      next();
    }
  };
}

/**
 * Middleware qui vérifie seulement les limites sans bloquer
 * Utile pour les endpoints en lecture seule
 */
export function limitsCheckOnly() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = (req as any).tenant_id;

    if (!tenantId) {
      return next();
    }

    try {
      const limitCheck = await limitsEnforcer.checkLimits(tenantId);
      (req as any).limits = limitCheck;
      next();
    } catch (error) {
      console.error(`[LimitsGuard] Error for tenant ${tenantId}:`, error);
      next();
    }
  };
}

/**
 * Helper pour invalider le cache des limites
 * À appeler après chaque modification (création user, table, produit, etc.)
 */
export function invalidateLimitsCache(tenantId: number) {
  limitsEnforcer.invalidateCache(tenantId);
}