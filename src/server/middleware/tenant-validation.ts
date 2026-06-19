// =============================================================================
// Middleware de Validation Tenant/User
// =============================================================================
// Vérifie l'intégrité des relations entre tenants et utilisateurs
// pour garantir que toutes les opérations sont effectuées dans un contexte valide.
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

// Cache local pour éviter les requêtes répétées
const tenantCache = new Map<number, { id: number; name: string; status: string }>();
const userCache = new Map<number, { id: number; email: string; tenant_id: number; is_active: boolean }>();
const tenantUserCache = new Map<string, { id: number; tenant_id: number; user_id: number; role: string; is_active: boolean }>();

function getCacheKey(tenantId: number, userId: number): string {
  return `${tenantId}:${userId}`;
}

function getSupabase() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    db: { schema: 'public' },
  });
}

/**
 * Vérifie que le tenant existe et est valide
 */
async function validateTenantExists(req: Request, res: Response, next: NextFunction) {
  const tenantId = req.params.tenantId || req.body.tenantId || req.query.tenantId;
  
  if (!tenantId) {
    return res.status(400).json({
      error: 'TENANT_REQUIRED',
      message: 'tenantId is required'
    });
  }
  
  const numericTenantId = Number(tenantId);
  if (isNaN(numericTenantId)) {
    return res.status(400).json({
      error: 'INVALID_TENANT_ID',
      message: 'tenantId must be a valid number'
    });
  }
  
  // Vérifier le cache d'abord
  if (tenantCache.has(numericTenantId)) {
    const tenant = tenantCache.get(numericTenantId)!;
    if (tenant.status === 'cancelled' || tenant.status === 'suspended') {
      return res.status(403).json({
        error: 'TENANT_INACTIVE',
        message: `Tenant is ${tenant.status}`
      });
    }
    return next();
  }
  
  // Requête Supabase
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({
      error: 'SUPABASE_NOT_CONFIGURED',
      message: 'Supabase is not configured'
    });
  }
  
  try {
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id, name, status')
      .eq('id', numericTenantId)
      .maybeSingle();
    
    if (error) {
      console.error('[TenantValidation] Error checking tenant:', error.message);
      return res.status(500).json({
        error: 'TENANT_VALIDATION_FAILED',
        message: 'Failed to validate tenant'
      });
    }
    
    if (!tenant) {
      return res.status(404).json({
        error: 'TENANT_NOT_FOUND',
        message: `Tenant ${tenantId} not found`
      });
    }
    
    // Vérifier le statut
    if (tenant.status === 'cancelled' || tenant.status === 'suspended') {
      return res.status(403).json({
        error: 'TENANT_INACTIVE',
        message: `Tenant is ${tenant.status}`
      });
    }
    
    // Mettre en cache
    tenantCache.set(numericTenantId, {
      id: tenant.id,
      name: tenant.name,
      status: tenant.status
    });
    
    // Ajouter au request pour les middlewares suivants
    (req as any).tenant = tenant;
    
    next();
  } catch (err: any) {
    console.error('[TenantValidation] Error:', err.message);
    return res.status(500).json({
      error: 'TENANT_VALIDATION_ERROR',
      message: err.message
    });
  }
}

/**
 * Vérifie que l'utilisateur existe et est valide
 */
async function validateUserExists(req: Request, res: Response, next: NextFunction) {
  const userId = req.params.userId || req.body.userId || req.query.userId;
  
  if (!userId) {
    return res.status(400).json({
      error: 'USER_REQUIRED',
      message: 'userId is required'
    });
  }
  
  const numericUserId = Number(userId);
  if (isNaN(numericUserId)) {
    return res.status(400).json({
      error: 'INVALID_USER_ID',
      message: 'userId must be a valid number'
    });
  }
  
  // Vérifier le cache d'abord
  if (userCache.has(numericUserId)) {
    const user = userCache.get(numericUserId)!;
    if (!user.is_active) {
      return res.status(403).json({
        error: 'USER_INACTIVE',
        message: 'User is inactive'
      });
    }
    return next();
  }
  
  // Requête Supabase
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({
      error: 'SUPABASE_NOT_CONFIGURED',
      message: 'Supabase is not configured'
    });
  }
  
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, tenant_id, is_active')
      .eq('id', numericUserId)
      .maybeSingle();
    
    if (error) {
      console.error('[UserValidation] Error checking user:', error.message);
      return res.status(500).json({
        error: 'USER_VALIDATION_FAILED',
        message: 'Failed to validate user'
      });
    }
    
    if (!user) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: `User ${userId} not found`
      });
    }
    
    // Vérifier le statut
    if (!user.is_active) {
      return res.status(403).json({
        error: 'USER_INACTIVE',
        message: 'User is inactive'
      });
    }
    
    // Mettre en cache
    userCache.set(numericUserId, {
      id: user.id,
      email: user.email,
      tenant_id: user.tenant_id,
      is_active: user.is_active
    });
    
    // Ajouter au request pour les middlewares suivants
    (req as any).user = user;
    
    next();
  } catch (err: any) {
    console.error('[UserValidation] Error:', err.message);
    return res.status(500).json({
      error: 'USER_VALIDATION_ERROR',
      message: err.message
    });
  }
}

/**
 * Vérifie que la relation tenant_user existe et est valide
 */
async function validateTenantUserRelationship(req: Request, res: Response, next: NextFunction) {
  const tenantId = req.params.tenantId || req.body.tenantId || req.query.tenantId || (req as any).tenant?.id;
  const userId = req.params.userId || req.body.userId || req.query.userId || (req as any).user?.id;
  
  if (!tenantId || !userId) {
    return res.status(400).json({
      error: 'TENANT_AND_USER_REQUIRED',
      message: 'Both tenantId and userId are required'
    });
  }
  
  const numericTenantId = Number(tenantId);
  const numericUserId = Number(userId);
  
  if (isNaN(numericTenantId) || isNaN(numericUserId)) {
    return res.status(400).json({
      error: 'INVALID_IDS',
      message: 'tenantId and userId must be valid numbers'
    });
  }
  
  const cacheKey = getCacheKey(numericTenantId, numericUserId);
  
  // Vérifier le cache d'abord
  if (tenantUserCache.has(cacheKey)) {
    const tu = tenantUserCache.get(cacheKey)!;
    if (!tu.is_active) {
      return res.status(403).json({
        error: 'TENANT_USER_INACTIVE',
        message: 'Tenant-User relationship is inactive'
      });
    }
    return next();
  }
  
  // Requête Supabase
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({
      error: 'SUPABASE_NOT_CONFIGURED',
      message: 'Supabase is not configured'
    });
  }
  
  try {
    const { data: tenantUser, error } = await supabase
      .from('tenant_users')
      .select('id, tenant_id, user_id, role, is_active')
      .eq('tenant_id', numericTenantId)
      .eq('user_id', numericUserId)
      .maybeSingle();
    
    if (error) {
      console.error('[TenantUserValidation] Error checking tenant_user:', error.message);
      return res.status(500).json({
        error: 'TENANT_USER_VALIDATION_FAILED',
        message: 'Failed to validate tenant-user relationship'
      });
    }
    
    if (!tenantUser) {
      return res.status(404).json({
        error: 'TENANT_USER_NOT_FOUND',
        message: `Relationship between tenant ${tenantId} and user ${userId} not found`
      });
    }
    
    // Vérifier le statut
    if (!tenantUser.is_active) {
      return res.status(403).json({
        error: 'TENANT_USER_INACTIVE',
        message: 'Tenant-User relationship is inactive'
      });
    }
    
    // Mettre en cache
    tenantUserCache.set(cacheKey, {
      id: tenantUser.id,
      tenant_id: tenantUser.tenant_id,
      user_id: tenantUser.user_id,
      role: tenantUser.role,
      is_active: tenantUser.is_active
    });
    
    // Ajouter au request pour les middlewares suivants
    (req as any).tenantUser = {
      id: tenantUser.id,
      tenant_id: tenantUser.tenant_id,
      user_id: tenantUser.user_id,
      role: tenantUser.role,
      is_active: tenantUser.is_active
    };
    
    next();
  } catch (err: any) {
    console.error('[TenantUserValidation] Error:', err.message);
    return res.status(500).json({
      error: 'TENANT_USER_VALIDATION_ERROR',
      message: err.message
    });
  }
}

/**
 * Middleware combiné qui vérifie:
 * 1. Le tenant existe et est actif
 * 2. L'utilisateur existe et est actif
 * 3. La relation tenant_user existe et est active
 * 4. (Optionnel) Vérifie les permissions basées sur le rôle
 */
async function validateTenantUserContext(
  req: Request, 
  res: Response, 
  next: NextFunction,
  requiredRoles?: string[]
) {
  const tenantId = req.params.tenantId || req.body.tenantId || req.query.tenantId;
  const userId = req.params.userId || req.body.userId || req.query.userId || (req as any).user?.sub;
  
  if (!tenantId || !userId) {
    return res.status(400).json({
      error: 'TENANT_AND_USER_REQUIRED',
      message: 'Both tenantId and userId are required'
    });
  }
  
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({
        error: 'SUPABASE_NOT_CONFIGURED',
        message: 'Supabase is not configured'
      });
    }
    
    const numericTenantId = Number(tenantId);
    const numericUserId = Number(userId);
    
    // 1. Vérifier le tenant
    const { data: tenant, error: tErr } = await supabase
      .from('tenants')
      .select('id, name, status')
      .eq('id', numericTenantId)
      .maybeSingle();
    
    if (tErr || !tenant) {
      return res.status(404).json({
        error: 'TENANT_NOT_FOUND',
        message: `Tenant ${tenantId} not found`
      });
    }
    
    if (tenant.status === 'cancelled' || tenant.status === 'suspended') {
      return res.status(403).json({
        error: 'TENANT_INACTIVE',
        message: `Tenant is ${tenant.status}`
      });
    }
    
    // 2. Vérifier l'utilisateur
    const { data: user, error: uErr } = await supabase
      .from('users')
      .select('id, email, tenant_id, is_active')
      .eq('id', numericUserId)
      .maybeSingle();
    
    if (uErr || !user) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: `User ${userId} not found`
      });
    }
    
    if (!user.is_active) {
      return res.status(403).json({
        error: 'USER_INACTIVE',
        message: 'User is inactive'
      });
    }
    
    // 3. Vérifier la relation tenant_user
    const { data: tenantUser, error: tuErr } = await supabase
      .from('tenant_users')
      .select('id, tenant_id, user_id, role, is_active')
      .eq('tenant_id', numericTenantId)
      .eq('user_id', numericUserId)
      .maybeSingle();
    
    if (tuErr || !tenantUser) {
      return res.status(404).json({
        error: 'TENANT_USER_NOT_FOUND',
        message: `Relationship between tenant ${tenantId} and user ${userId} not found`
      });
    }
    
    if (!tenantUser.is_active) {
      return res.status(403).json({
        error: 'TENANT_USER_INACTIVE',
        message: 'Tenant-User relationship is inactive'
      });
    }
    
    // 4. Vérifier les permissions si requis
    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(tenantUser.role)) {
        return res.status(403).json({
          error: 'INSUFFICIENT_PERMISSIONS',
          message: `User requires one of these roles: ${requiredRoles.join(', ')}. Current role: ${tenantUser.role}`
        });
      }
    }
    
    // Mettre en cache
    tenantCache.set(numericTenantId, {
      id: tenant.id,
      name: tenant.name,
      status: tenant.status
    });
    
    userCache.set(numericUserId, {
      id: user.id,
      email: user.email,
      tenant_id: user.tenant_id,
      is_active: true
    });
    
    tenantUserCache.set(getCacheKey(numericTenantId, numericUserId), {
      id: tenantUser.id,
      tenant_id: tenantUser.tenant_id,
      user_id: tenantUser.user_id,
      role: tenantUser.role,
      is_active: tenantUser.is_active
    });
    
    // Attacher au request
    (req as any).tenant = tenant;
    (req as any).user = user;
    (req as any).tenantUser = tenantUser;
    
    next();
  } catch (err: any) {
    console.error('[TenantUserContext] Error:', err.message);
    return res.status(500).json({
      error: 'CONTEXT_VALIDATION_ERROR',
      message: err.message
    });
  }
}

/**
 * Middleware pour vérifier que l'utilisateur peut accéder à un tenant spécifique
 */
async function validateTenantAccess(req: Request, res: Response, next: NextFunction) {
  const tenantId = req.params.tenantId || req.body.tenantId || req.query.tenantId;
  const userId = (req as any).user?.sub || (req as any).user?.id;
  
  if (!tenantId || !userId) {
    return res.status(400).json({
      error: 'TENANT_AND_USER_REQUIRED',
      message: 'Both tenantId and userId are required'
    });
  }
  
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({
        error: 'SUPABASE_NOT_CONFIGURED',
        message: 'Supabase is not configured'
      });
    }
    
    const numericTenantId = Number(tenantId);
    const numericUserId = Number(userId);
    
    // Vérifier que l'utilisateur a accès à ce tenant
    const { data: tenantUser, error } = await supabase
      .from('tenant_users')
      .select('id, tenant_id, user_id, role, is_active')
      .eq('tenant_id', numericTenantId)
      .eq('user_id', numericUserId)
      .maybeSingle();
    
    if (error || !tenantUser) {
      return res.status(403).json({
        error: 'ACCESS_DENIED',
        message: 'User does not have access to this tenant'
      });
    }
    
    if (!tenantUser.is_active) {
      return res.status(403).json({
        error: 'ACCESS_DENIED',
        message: 'User access to this tenant is inactive'
      });
    }
    
    // Attacher au request
    (req as any).tenantUser = tenantUser;
    (req as any).tenantAccess = {
      tenantId: numericTenantId,
      userId: numericUserId,
      role: tenantUser.role,
      isActive: tenantUser.is_active
    };
    
    next();
  } catch (err: any) {
    console.error('[TenantAccess] Error:', err.message);
    return res.status(500).json({
      error: 'ACCESS_VALIDATION_ERROR',
      message: err.message
    });
  }
}

/**
 * Middleware pour vérifier que le tenant a un abonnement actif
 */
async function validateActiveSubscription(req: Request, res: Response, next: NextFunction) {
  const tenantId = req.params.tenantId || req.body.tenantId || req.query.tenantId || (req as any).tenant?.id;
  
  if (!tenantId) {
    return res.status(400).json({
      error: 'TENANT_REQUIRED',
      message: 'tenantId is required'
    });
  }
  
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({
        error: 'SUPABASE_NOT_CONFIGURED',
        message: 'Supabase is not configured'
      });
    }
    
    const numericTenantId = Number(tenantId);
    
    // Vérifier les abonnements actifs
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('id, tenant_id, status, current_period_end')
      .eq('tenant_id', numericTenantId)
      .in('status', ['active', 'trial'])
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('[SubscriptionValidation] Error checking subscription:', error.message);
      return res.status(500).json({
        error: 'SUBSCRIPTION_VALIDATION_FAILED',
        message: 'Failed to validate subscription'
      });
    }
    
    if (!subscriptions || subscriptions.length === 0) {
      return res.status(402).json({
        error: 'NO_ACTIVE_SUBSCRIPTION',
        message: 'Tenant has no active subscription'
      });
    }
    
    const activeSub = subscriptions[0];
    
    // Vérifier si la période est expirée
    if (activeSub.current_period_end) {
      const periodEnd = new Date(activeSub.current_period_end);
      const now = new Date();
      
      if (periodEnd < now) {
        return res.status(402).json({
          error: 'SUBSCRIPTION_EXPIRED',
          message: 'Tenant subscription has expired'
        });
      }
    }
    
    // Attacher au request
    (req as any).subscription = activeSub;
    
    next();
  } catch (err: any) {
    console.error('[SubscriptionValidation] Error:', err.message);
    return res.status(500).json({
      error: 'SUBSCRIPTION_VALIDATION_ERROR',
      message: err.message
    });
  }
}

/**
 * Nettoie le cache pour un tenant/utilisateur
 */
function clearTenantUserCache(tenantId: number, userId: number) {
  const cacheKey = getCacheKey(tenantId, userId);
  tenantUserCache.delete(cacheKey);
  userCache.delete(userId);
  // Ne pas supprimer le tenant du cache car il peut être utilisé par d'autres users
}

// Exports

export {
  validateTenantExists,
  validateUserExists,
  validateTenantUserRelationship,
  validateTenantUserContext,
  validateTenantAccess,
  validateActiveSubscription,
  clearTenantUserCache,
  tenantCache,
  userCache,
  tenantUserCache
};

export default {
  validateTenantExists,
  validateUserExists,
  validateTenantUserRelationship,
  validateTenantUserContext,
  validateTenantAccess,
  validateActiveSubscription,
  clearTenantUserCache
};
