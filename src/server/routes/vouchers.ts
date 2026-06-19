// =============================================================================
// Voucher Routes — /api/vouchers
// =============================================================================
// Validate a voucher code and upgrade a tenant's subscription.
// =============================================================================

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

// ─── Validate a voucher ───────────────────────────────────────────────────────
router.post('/validate', requireJwtAuth, async (req: any, res: any) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ valid: false, error: 'Code voucher requis' });
    }

    const normalizedCode = code.trim().toUpperCase();
    const supabase = getSupabase();

    if (supabase) {
      const { data: voucher, error } = await supabase
        .from('vouchers')
        .select('*, plans(id, name, code, duration_days, price_cents)')
        .eq('code', normalizedCode)
        .maybeSingle();

      if (error || !voucher) return res.status(404).json({ valid: false, error: 'Code voucher introuvable' });
      if (!voucher.is_active) return res.status(400).json({ valid: false, error: 'Voucher désactivé' });
      if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) return res.status(400).json({ valid: false, error: 'Voucher expiré' });
      if (voucher.used_count >= voucher.max_uses) return res.status(400).json({ valid: false, error: 'Voucher déjà utilisé' });

      const plan = Array.isArray(voucher.plans) ? voucher.plans[0] : voucher.plans;
      return res.json({
        valid: true,
        voucher: {
          id: voucher.id,
          code: voucher.code,
          plan_name: plan?.name,
          plan_code: plan?.code,
          plan_id: plan?.id,
          amount_cents: voucher.amount_cents,
          currency: voucher.currency,
          duration_days: plan?.duration_days || 30,
        }
      });
    }

    // Local fallback
    const voucher = db.prepare(`
      SELECT v.*, p.name as plan_name, p.code as plan_code, p.duration_days, p.price_cents as plan_price_cents
      FROM vouchers v
      JOIN plans p ON v.plan_id = p.id
      WHERE v.code = ?
    `).get(normalizedCode) as any;

    if (!voucher) return res.status(404).json({ valid: false, error: 'Code voucher introuvable' });
    if (!voucher.is_active) return res.status(400).json({ valid: false, error: 'Ce voucher est désactivé' });
    if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) return res.status(400).json({ valid: false, error: 'Ce voucher a expiré' });
    if (voucher.used_count >= voucher.max_uses) return res.status(400).json({ valid: false, error: 'Ce voucher a déjà été utilisé' });

    res.json({
      valid: true,
      voucher: {
        id: voucher.id,
        code: voucher.code,
        plan_name: voucher.plan_name,
        plan_code: voucher.plan_code,
        plan_id: voucher.plan_id,
        amount_cents: voucher.amount_cents,
        currency: voucher.currency,
        duration_days: voucher.duration_days,
      }
    });
  } catch (err: any) {
    console.error('[Vouchers] Validate error:', err);
    res.status(500).json({ valid: false, error: 'Erreur lors de la validation' });
  }
});

// ─── Redeem a voucher ─────────────────────────────────────────────────────────
router.post('/redeem', requireJwtAuth, async (req: any, res: any) => {
  try {
    const { code } = req.body;
    const tenantId = req.user?.tenant_id;
    const supabase = getSupabase();

    if (!tenantId) return res.status(401).json({ error: 'Tenant non identifié' });
    const normalizedCode = code.trim().toUpperCase();

    if (supabase) {
      // 1. Find voucher
      const { data: voucher, error: vErr } = await supabase
        .from('vouchers')
        .select('*, plans(id, name, code, duration_days)')
        .eq('code', normalizedCode)
        .maybeSingle();

      if (vErr || !voucher) return res.status(404).json({ error: 'Voucher introuvable' });
      if (!voucher.is_active || voucher.used_count >= voucher.max_uses) return res.status(400).json({ error: 'Voucher invalide ou utilisé' });

      const plan = Array.isArray(voucher.plans) ? voucher.plans[0] : voucher.plans;
      const now = new Date();
      const expiry = new Date(now.getTime() + (plan.duration_days || 30) * 86400000);

      // 2. Update Subscription
      const { data: existingSub } = await supabase.from('subscriptions').select('id').eq('tenant_id', tenantId).maybeSingle();
      if (existingSub) {
        await supabase.from('subscriptions').update({
          plan_id: plan.id,
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: expiry.toISOString(),
          payment_method: 'voucher',
          payment_reference: normalizedCode,
          updated_at: now.toISOString(),
        }).eq('id', existingSub.id);
      } else {
        await supabase.from('subscriptions').insert([{
          tenant_id: tenantId, plan_id: plan.id, status: 'active',
          started_at: now.toISOString(), current_period_start: now.toISOString(), current_period_end: expiry.toISOString(),
          payment_method: 'voucher', payment_reference: normalizedCode
        }]);
      }

      // 3. Update Tenant Status
      await supabase.from('tenants').update({ status: 'active', updated_at: now.toISOString() }).eq('id', tenantId);

      // 4. Update Voucher usage
      await supabase.from('vouchers').update({ used_count: voucher.used_count + 1 }).eq('id', voucher.id);

      // 5. Audit & Payment record
      await supabase.from('payments').insert([{
        tenant_id: tenantId, plan_id: plan.id, amount_cents: voucher.amount_cents,
        currency: voucher.currency, status: 'completed', payment_method: 'voucher',
        notes: `Redeemed voucher ${normalizedCode}`, paid_at: now.toISOString()
      }]);

      return res.json({ success: true, message: 'Abonnement activé avec succès !' });
    }

    // ── Local Fallback (SQLite) ──
    const voucher = db.prepare(`
      SELECT v.*, p.name as plan_name, p.duration_days FROM vouchers v JOIN plans p ON v.plan_id = p.id WHERE v.code = ?
    `).get(normalizedCode) as any;

    if (!voucher) return res.status(404).json({ error: 'Voucher introuvable' });

    db.transaction(() => {
      const now = new Date().toISOString();
      const expiry = new Date(Date.now() + (voucher.duration_days || 30) * 86400000).toISOString();

      // Update Sub
      const existing = db.prepare('SELECT id FROM subscriptions WHERE tenant_id = ?').get(tenantId) as any;
      if (existing) {
        db.prepare(`UPDATE subscriptions SET plan_id=?, status='active', current_period_end=?, payment_method='voucher', payment_reference=?, updated_at=? WHERE id=?`)
          .run(voucher.plan_id, expiry, normalizedCode, now, existing.id);
      } else {
        db.prepare(`INSERT INTO subscriptions (tenant_id, plan_id, status, started_at, current_period_start, current_period_end, payment_method, payment_reference) VALUES (?,?,?,?,?,?,?,?)`)
          .run(tenantId, voucher.plan_id, 'active', now, now, expiry, 'voucher', normalizedCode);
      }

      // Update Tenant & Voucher
      db.prepare('UPDATE tenants SET status=\'active\', updated_at=? WHERE id=?').run(now, tenantId);
      db.prepare('UPDATE vouchers SET used_count = used_count + 1 WHERE id=?').run(voucher.id);
      db.prepare('INSERT INTO payments (tenant_id, plan_id, amount_cents, currency, status, payment_method, notes, paid_at) VALUES (?,?,?,?,\'completed\',\'voucher\',?,?)')
        .run(tenantId, voucher.plan_id, voucher.amount_cents, voucher.currency, `Redeemed voucher ${normalizedCode}`, now);
    })();

    res.json({ success: true, message: 'Abonnement activé avec succès !' });
  } catch (err: any) {
    console.error('[Vouchers] Redeem error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'activation' });
  }
});

export default router;