// =============================================================================
// Voucher Routes — /api/vouchers (Supabase-only)
// =============================================================================
// validate + activate. Supabase obligatoire.
// =============================================================================

import { Router } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

const router = Router();

function getSupabase(): SupabaseClient | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
  });
}

// ─── Validate a voucher ───────────────────────────────────────────────────────
router.post('/validate', async (req: any, res: any) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ valid: false, error: 'Code voucher requis' });
    }

    const normalizedCode = code.trim().toUpperCase();
    const supabase = getSupabase();

    if (!supabase) {
      return res.status(503).json({ valid: false, error: 'SUPABASE_NOT_CONFIGURED' });
    }

    const { data: voucher, error } = await supabase
      .from('vouchers')
      .select('*, plans(id, name, code, duration_days, price_cents)')
      .eq('code', normalizedCode)
      .maybeSingle();

    if (error || !voucher) return res.status(404).json({ valid: false, error: 'Code voucher introuvable' });
    if (voucher.status !== 'UNUSED') return res.status(400).json({ valid: false, error: 'Voucher déjà utilisé' });
    if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) return res.status(400).json({ valid: false, error: 'Voucher expiré' });

    const plan = Array.isArray(voucher.plans) ? voucher.plans[0] : voucher.plans;
    return res.json({
      valid: true,
      voucher: {
        id: voucher.id,
        code: voucher.code,
        plan_name: plan?.name,
        plan_code: plan?.code,
        plan_id: plan?.id,
        amount_cents: voucher.duration_days,
        currency: voucher.currency || 'ZMW',
        duration_days: plan?.duration_days || voucher.duration_days || 30,
      }
    });
  } catch (err: any) {
    console.error('[Vouchers] Validate error:', err);
    res.status(500).json({ valid: false, error: 'Erreur lors de la validation' });
  }
});

// ─── Activate a voucher ───────────────────────────────────────────────────────
router.post('/activate', async (req: any, res: any) => {
  try {
    const { code } = req.body || {};
    const tenantId = Number(req.user?.tenant_id || req.body?.tenantId);
    if (!tenantId) return res.status(401).json({ error: 'Tenant non identifié' });
    if (!code) return res.status(400).json({ error: 'Code voucher requis' });

    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'SUPABASE_NOT_CONFIGURED' });

    const normalizedCode = code.trim().toUpperCase();

    // 1. Récupérer le voucher
    const { data: voucher, error: vErr } = await supabase
      .from('vouchers')
      .select('*')
      .eq('code', normalizedCode)
      .maybeSingle();

    if (vErr || !voucher) return res.status(404).json({ error: 'VOUCHER_NOT_FOUND' });
    if (voucher.status !== 'UNUSED') return res.status(400).json({ error: 'VOUCHER_ALREADY_USED' });
    if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
      return res.status(400).json({ error: 'VOUCHER_EXPIRED' });
    }

    // 2. Trouver ou créer la subscription
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const now = new Date();
    const durationDays = voucher.duration_days || 30;
    const periodEnd = new Date(now.getTime() + durationDays * 86400000);

    let finalPeriodEnd: string;
    if (existingSub) {
      const currentEnd = existingSub.current_period_end ? new Date(existingSub.current_period_end) : null;
      if (currentEnd && currentEnd > now) {
        finalPeriodEnd = new Date(currentEnd.getTime() + durationDays * 86400000).toISOString();
      } else {
        finalPeriodEnd = periodEnd.toISOString();
      }

      const { error: sErr } = await supabase.from('subscriptions').update({
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: finalPeriodEnd,
        payment_method: 'voucher',
        payment_reference: normalizedCode,
        plan_code: voucher.plan_code,
        last_voucher_code: normalizedCode,
        updated_at: now.toISOString(),
      }).eq('id', existingSub.id);

      if (sErr) throw new Error(`Subscription update failed: ${sErr.message}`);
    } else {
      finalPeriodEnd = periodEnd.toISOString();
      const { error: sErr } = await supabase.from('subscriptions').insert({
        tenant_id: tenantId,
        plan_code: voucher.plan_code,
        status: 'active',
        started_at: now.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: finalPeriodEnd,
        payment_method: 'voucher',
        payment_reference: normalizedCode,
        last_voucher_code: normalizedCode,
        auto_renew: true,
      });

      if (sErr) throw new Error(`Subscription create failed: ${sErr.message}`);
    }

    // 3. Marquer le voucher comme utilisé (optimistic lock)
    const { error: uErr } = await supabase
      .from('vouchers')
      .update({
        status: 'USED',
        tenant_id: tenantId,
        activated_by: req.user?.sub || null,
        activated_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', voucher.id)
      .eq('status', 'UNUSED');

    if (uErr) throw new Error(`Voucher update failed: ${uErr.message}`);

    // 4. Activer le tenant
    await supabase.from('tenants')
      .update({ status: 'active', is_provisioned: true, provisioned_at: now.toISOString(), updated_at: now.toISOString() })
      .eq('id', tenantId);

    // 5. Audit log (best-effort)
    try {
      await supabase.from('tenant_audit_log').insert([{
        tenant_id: tenantId,
        actor_user_id: req.user?.sub || null,
        action: 'voucher.activated',
        entity_type: 'voucher',
        entity_id: voucher.id,
        metadata: { code: voucher.code, plan_code: voucher.plan_code, duration_days: durationDays, subscription_period_end: finalPeriodEnd },
      }]);
    } catch { /* best effort */ }

    res.json({
      ok: true,
      message: 'Abonnement activé avec succès',
      voucher_code: voucher.code,
      plan_code: voucher.plan_code,
      expires_at: finalPeriodEnd,
    });
  } catch (e: any) {
    console.error('[Voucher] activate error:', e);
    res.status(500).json({ error: 'VOUCHER_ACTIVATE_FAILED', message: e.message });
  }
});

export default router;
