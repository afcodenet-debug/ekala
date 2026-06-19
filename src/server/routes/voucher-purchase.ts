import { Router } from 'express';
import db from '../db/database';
import { requireJwtAuth } from '../middleware/jwt-auth';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

const router = Router();

function getSupabase(): SupabaseClient | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    db: { schema: 'public' },
  });
}

function generateVoucherCode(planCode: string): string {
  const prefix = planCode.replace(/_/g, '').substring(0, 4).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  return `${prefix}-${random}-${ts}`;
}

// ─── Get available plans ─────────────────────────────────────────────────────
router.get('/plans', requireJwtAuth, async (_req: any, res: any) => {
  try {
    const supabase = getSupabase();
    if (supabase) {
      const { data: plans, error } = await supabase.from('plans').select('*').eq('is_active', true).neq('period', 'trial').order('sort_order');
      if (error) throw error;
      return res.json({ plans });
    }
    const plans = db.prepare(`SELECT * FROM plans WHERE is_active = 1 AND period != 'trial' ORDER BY sort_order ASC`).all();
    res.json({ plans });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors du chargement des plans' });
  }
});

// ─── Initiate purchase & direct activation ───────────────────────────────────
router.post('/initiate', requireJwtAuth, async (req: any, res: any) => {
  try {
    const tenantId = req.user?.tenant_id;
    const { plan_code, phone_number, payment_method } = req.body;
    const supabase = getSupabase();

    if (!tenantId) return res.status(401).json({ error: 'Non autorisé' });

    if (supabase) {
      const { data: plan, error: pErr } = await supabase.from('plans').select('*').eq('code', plan_code).maybeSingle();
      if (pErr || !plan) return res.status(404).json({ error: 'Plan introuvable' });

      const now = new Date();
      const expiry = new Date(now.getTime() + (plan.duration_days || 30) * 86400000);
      const voucherCode = generateVoucherCode(plan_code);

      // 1. Update Sub
      const { data: existingSub } = await supabase.from('subscriptions').select('id').eq('tenant_id', tenantId).maybeSingle();
      if (existingSub) {
        await supabase.from('subscriptions').update({
          plan_id: plan.id, status: 'active', current_period_start: now.toISOString(), current_period_end: expiry.toISOString(),
          payment_method: 'direct', payment_reference: voucherCode, updated_at: now.toISOString(),
          trial_ends_at: null, trial_started_at: null
        }).eq('id', existingSub.id);
      } else {
        await supabase.from('subscriptions').insert([{
          tenant_id: tenantId, plan_id: plan.id, status: 'active', started_at: now.toISOString(),
          current_period_start: now.toISOString(), current_period_end: expiry.toISOString(), payment_method: 'direct'
        }]);
      }

      // 2. Update Tenant & Create Payment/Voucher
      await supabase.from('tenants').update({ status: 'active', updated_at: now.toISOString() }).eq('id', tenantId);
      await supabase.from('payments').insert([{
        tenant_id: tenantId, plan_id: plan.id, amount_cents: plan.price_cents, currency: plan.currency,
        status: 'completed', payment_method: payment_method || 'mobile_money', notes: `Achat direct ${plan.name}`, paid_at: now.toISOString()
      }]);
      await supabase.from('vouchers').insert([{
        code: voucherCode, plan_id: plan.id, amount_cents: plan.price_cents, currency: plan.currency,
        max_uses: 1, used_count: 1, created_at: now.toISOString()
      }]);

      return res.json({ success: true, message: `✅ Abonnement ${plan.name} activé !` });
    }

    // ── Local fallback (SQLite) ──
    const plan = db.prepare('SELECT * FROM plans WHERE code = ? AND is_active = 1').get(plan_code) as any;
    if (!plan) return res.status(404).json({ error: 'Plan introuvable' });

    const voucherCode = generateVoucherCode(plan_code);
    db.transaction(() => {
      const now = new Date().toISOString();
      const expiry = new Date(Date.now() + (plan.duration_days || 30) * 86400000).toISOString();

      const existing = db.prepare('SELECT id FROM subscriptions WHERE tenant_id = ?').get(tenantId) as any;
      if (existing) {
        db.prepare(`UPDATE subscriptions SET plan_id=?, status='active', current_period_end=?, payment_method='direct', payment_reference=?, updated_at=?, trial_ends_at=NULL WHERE id=?`)
          .run(plan.id, expiry, voucherCode, now, existing.id);
      } else {
        db.prepare(`INSERT INTO subscriptions (tenant_id, plan_id, status, started_at, current_period_start, current_period_end, payment_method) VALUES (?,?,?,?,?,?,?)`)
          .run(tenantId, plan.id, 'active', now, now, expiry, 'direct');
      }

      db.prepare('UPDATE tenants SET status=\'active\', updated_at=? WHERE id=?').run(now, tenantId);
      db.prepare('INSERT INTO payments (tenant_id, plan_id, amount_cents, currency, status, payment_method, notes, paid_at) VALUES (?,?,?,?,\'completed\',?,?,?)')
        .run(tenantId, plan.id, plan.price_cents, plan.currency, payment_method || 'mobile_money', `Achat direct ${plan.name}`, now);
      db.prepare('INSERT INTO vouchers (code, plan_id, amount_cents, currency, max_uses, used_count) VALUES (?,?,?,?,1,1)').run(voucherCode, plan.id, plan.price_cents, plan.currency);
    })();

    res.json({ success: true, message: `✅ Abonnement ${plan.name} activé !` });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de l\'activation' });
  }
});

// ─── Check purchase status ──────────────────────────────────────────────────
// GET /api/voucher-purchase/status/:purchaseId
router.get('/status/:purchaseId', requireJwtAuth, (req: any, res: any) => {
  try {
    const { purchaseId } = req.params;
    const tenantId = req.user?.tenant_id;

    const payment = db.prepare(`
      SELECT p.*, v.code as voucher_code, v.is_active as voucher_active
      FROM payments p
      LEFT JOIN vouchers v ON v.code = json_extract(p.metadata, '$.voucher_code')
      WHERE p.id = ? AND p.tenant_id = ?
    `).get(purchaseId, tenantId) as any;

    if (!payment) {
      return res.status(404).json({ error: 'Paiement introuvable' });
    }

    res.json({
      status: payment.status,
      voucher_code: payment.voucher_code,
      voucher_active: payment.voucher_active,
    });
  } catch (err: any) {
    console.error('[VoucherPurchase] Status error:', err);
    res.status(500).json({ error: 'Erreur lors de la vérification' });
  }
});

export default router;