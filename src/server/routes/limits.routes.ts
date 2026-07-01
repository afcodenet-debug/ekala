/**
 * Limits API Routes
 * Endpoints pour consulter et gérer les limites d'utilisation
 */

import { Router } from 'express';
import { limitsEnforcer } from '../services/limits-enforcer.service';
import { requireJwtAuth } from '../middleware/jwt-auth';
import { requireTenantScope } from '../middleware/tenant-scope';

const router = Router();

// Tous les endpoints nécessitent une authentification JWT
router.use(requireJwtAuth);
router.use(requireTenantScope);

/**
 * GET /api/limits/status
 * Récupère le statut complet des limites pour le tenant connecté
 */
router.get('/status', async (req: any, res) => {
  try {
    const tenantId = req.tenant_id;
    
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'TENANT_REQUIRED',
        message: 'Contexte tenant requis'
      });
    }

    const summary = await limitsEnforcer.getLimitsSummary(tenantId);

    return res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    console.error('[Limits] Error getting status:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message,
    });
  }
});

/**
 * GET /api/limits/check/:action
 * Vérifie si une action spécifique est autorisée
 * Actions: create_user, create_table, create_product, create_order
 */
router.get('/check/:action', async (req: any, res) => {
  try {
    const tenantId = req.tenant_id;
    const { action } = req.params;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'TENANT_REQUIRED',
        message: 'Contexte tenant requis'
      });
    }

    const validActions = ['create_user', 'create_table', 'create_product', 'create_order'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ACTION',
        message: `Action invalide. Doit être une de: ${validActions.join(', ')}`
      });
    }

    const result = await limitsEnforcer.checkAction(tenantId, action as any);

    return res.json({
      success: true,
      data: {
        action,
        allowed: result.allowed,
        reason: result.reason,
      },
    });
  } catch (error: any) {
    console.error('[Limits] Error checking action:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message,
    });
  }
});

/**
 * POST /api/limits/invalidate-cache
 * Invalide le cache des limites (utile après modifications)
 */
router.post('/invalidate-cache', async (req: any, res) => {
  try {
    const tenantId = req.tenant_id;
    
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'TENANT_REQUIRED',
        message: 'Contexte tenant requis'
      });
    }

    limitsEnforcer.invalidateCache(tenantId);

    return res.json({
      success: true,
      message: 'Cache des limites invalidé',
    });
  } catch (error: any) {
    console.error('[Limits] Error invalidating cache:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message,
    });
  }
});

export default router;