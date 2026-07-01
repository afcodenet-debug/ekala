// =============================================================================
// Billing Debug Routes — Pour diagnostiquer les problèmes de billing
// =============================================================================

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import { requireJwtAuth } from '../middleware/jwt-auth';
import { db } from '../db/database';

function getSupabase(): SupabaseClient | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
  });
}

const router = Router();

// GET /api/billing/debug/tenant-status — Vérifier le statut du tenant
router.get('/debug/tenant-status', requireJwtAuth, async (req: any, res: any) => {
  try {
    const tenantId = Number(req.user?.tenant_id);
    if (!tenantId) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const supabase = getSupabase();
    const localDb = db;

    console.log(`[BillingDebug] Checking tenant ${tenantId}, supabase=${!!supabase}, localDb=${!!localDb}`);

    // 1. Vérifier le tenant
    let tenant: any = null;
    if (localDb) {
      tenant = localDb.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId) as any;
    } else if (supabase) {
      const { data } = await supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle();
      tenant = data;
    }

    // 2. Vérifier l'abonnement
    let subscription: any = null;
    if (localDb) {
      subscription = localDb.prepare(`
        SELECT s.*, p.code as plan_code, p.name as plan_name, p.duration_days
        FROM subscriptions s
        LEFT JOIN plans p ON s.plan_id = p.id
        WHERE s.tenant_id = ?
        ORDER BY s.created_at DESC LIMIT 1
      `).get(tenantId) as any;
    } else if (supabase) {
      const { data } = await supabase
        .from('subscriptions')
        .select('*, plans(code, name, duration_days)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      subscription = data;
    }

    // 3. Vérifier les voucher requests
    let voucherRequests: any[] = [];
    if (localDb) {
      try {
        voucherRequests = localDb.prepare(`
          SELECT * FROM voucher_requests WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 5
        `).all(tenantId) as any[];
      } catch (e: any) {
        if (!e?.message?.includes('no such table')) {
          console.error('[BillingDebug] voucher_requests error:', e);
        }
      }
    } else if (supabase) {
      const { data } = await supabase
        .from('voucher_requests')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(5);
      voucherRequests = data || [];
    }

    // 4. Calculer le statut effectif
    const now = new Date();
    let effectiveStatus = 'unknown';
    let daysRemaining = null;

    if (subscription) {
      const endDate = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
      const startDate = subscription.current_period_start ? new Date(subscription.current_period_start) : null;

      if (endDate && endDate > now) {
        effectiveStatus = 'active';
        daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / 86400000);
      } else if (startDate && startDate > now) {
        effectiveStatus = 'trial';
      } else {
        effectiveStatus = 'expired';
      }
    } else if (tenant?.status === 'pending') {
      effectiveStatus = 'pending';
    } else {
      effectiveStatus = 'no_subscription';
    }

    res.json({
      tenant: tenant ? {
        id: tenant.id,
        status: tenant.status,
        is_provisioned: tenant.is_provisioned,
        name: tenant.name,
      } : null,
      subscription: subscription ? {
        id: subscription.id,
        status: subscription.status,
        plan_code: subscription.plan_code,
        plan_name: subscription.plan_name,
        duration_days: subscription.duration_days,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        started_at: subscription.started_at,
      } : null,
      effectiveStatus,
      daysRemaining,
      voucherRequests: voucherRequests.map(vr => ({
        id: vr.id,
        code: vr.voucher_code,
        status: vr.status,
        plan_id: vr.plan_id,
        requested_at: vr.requested_at,
        expires_at: vr.expires_at,
      })),
      debug: {
        now: now.toISOString(),
        supabaseMode: !!supabase,
        localMode: !!localDb,
      }
    });
  } catch (e: any) {
    console.error('[BillingDebug] error:', e);
    res.status(500).json({ error: e?.message || 'Erreur serveur' });
  }
});

// GET /api/billing/debug/plans — Vérifier les plans disponibles
router.get('/debug/plans', requireJwtAuth, async (req: any, res: any) => {
  try {
    const supabase = getSupabase();
    const localDb = db;

    let plans: any[] = [];
    if (localDb) {
      plans = localDb.prepare(`
        SELECT id, code, name, description, price_cents, currency, period, duration_days,
               max_users, max_branches, max_products, is_active, is_public, sort_order
        FROM plans
        WHERE is_active = 1 AND is_public = 1
        ORDER BY sort_order ASC
      `).all() as any[];
    } else if (supabase) {
      const { data } = await supabase
        .from('plans')
        .select('id, code, name, description, price_cents, currency, period, duration_days, max_users, max_branches, max_products, is_active, is_public, sort_order')
        .eq('is_active', true)
        .eq('is_public', true)
        .order('sort_order', { ascending: true });
      plans = data || [];
    }

    res.json({
      count: plans.length,
      plans: plans.map(p => ({
        id: p.id,
        code: p.code,
        name: p.name,
        price: `${p.currency} ${(p.price_cents / 100).toFixed(2)}`,
        period: p.period,
        duration_days: p.duration_days,
        max_users: p.max_users,
        max_branches: p.max_branches,
      }))
    });
  } catch (e: any) {
    console.error('[BillingDebug] plans error:', e);
    res.status(500).json({ error: e?.message || 'Erreur serveur' });
  }
});

export default router;