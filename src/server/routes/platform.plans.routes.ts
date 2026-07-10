// =============================================================================
// Platform Plan Management — /api/platform/plans
// =============================================================================
// Full CRUD for subscription plans, restricted to the platform admin portal.
// Plans are the building blocks of the subscription system: each tenant
// subscribes to a (plan, billing period) combination. The platform admin can
// create / read / update / delete plans here; the matching UI lives in
// src/pages/platform/PlansPage.tsx.
//
// Design notes:
//   - `period` is constrained to weekly | monthly | annual | trial | lifetime.
//   - `code` is unique (used by the SaaS signup / voucher flows).
//   - A plan that is still referenced by a subscription cannot be hard-deleted;
//     the route returns 409 in that case to avoid breaking referential integrity.
// =============================================================================

import { Router, Request, Response } from 'express';
import { requirePlatformAuth } from '../platform/platform-auth.middleware';
import db from '../db/database';

const router = Router();

router.use(requirePlatformAuth);

const PERIODS = ['weekly', 'monthly', 'annual', 'trial', 'lifetime'] as const;
type Period = (typeof PERIODS)[number];

/** Map a billing period to its default duration in days. */
function defaultDurationDays(period: string): number {
  switch (period) {
    case 'weekly': return 7;
    case 'annual': return 365;
    case 'trial': return 7;
    case 'lifetime': return 365;
    case 'monthly':
    default: return 30;
  }
}

/** Coerce to a finite integer, falling back to `fallback`. */
function toInt(value: any, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/** Coerce a boolean-ish value to SQLite 0/1. */
function toFlag(value: any): number {
  return value === false || value === 0 || value === '0' ? 0 : 1;
}

function normalizePeriod(value: any, fallback: string): Period {
  return PERIODS.includes(value) ? (value as Period) : (fallback as Period);
}

// ── List all plans (active + inactive) ────────────────────────────────────────
router.get('/plans', requirePlatformAuth, (_req: Request, res: Response) => {
  try {
    const plans = db
      .prepare(`SELECT * FROM plans ORDER BY sort_order ASC, name ASC`)
      .all() as any[];
    res.json({ success: true, plans });
  } catch (e: any) {
    console.error('[Platform/Plans] GET error:', e);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: e?.message || 'Erreur serveur' });
  }
});

// ── Get a single plan ─────────────────────────────────────────────────────────
router.get('/plans/:id', requirePlatformAuth, (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as any;
    if (!plan) return res.status(404).json({ error: 'PLAN_NOT_FOUND', message: 'Plan introuvable' });
    res.json({ success: true, plan });
  } catch (e: any) {
    console.error('[Platform/Plans] GET :id error:', e);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: e?.message || 'Erreur serveur' });
  }
});

// ── Create a plan ─────────────────────────────────────────────────────────────
router.post('/plans', requirePlatformAuth, (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const code = String(body.code || '').trim().toUpperCase();
    const name = String(body.name || '').trim();

    if (!code || !name) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Le code et le nom sont requis.',
      });
    }
    if (!/^[A-Z0-9_]+$/.test(code)) {
      return res.status(400).json({
        error: 'INVALID_CODE',
        message: 'Le code ne doit contenir que des lettres, chiffres et underscores (A-Z, 0-9, _).',
      });
    }

    const existing = db.prepare('SELECT id FROM plans WHERE LOWER(code) = LOWER(?)').get(code) as any;
    if (existing) {
      return res.status(409).json({ error: 'CODE_EXISTS', message: 'Ce code de plan existe déjà.' });
    }

    const period = normalizePeriod(body.period, 'monthly');
    const duration_days = body.duration_days !== undefined ? toInt(body.duration_days) : defaultDurationDays(period);
    const price_cents = Math.max(0, toInt(body.price_cents));
    const now = new Date().toISOString();

    const info = db
      .prepare(
        `INSERT INTO plans (
          code, name, description, price_cents, currency, period, duration_days,
          max_users, max_branches, max_products, max_orders_per_month, features,
          is_active, is_public, trial_days, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        code,
        name,
        body.description || '',
        price_cents,
        body.currency || 'ZMW',
        period,
        duration_days,
        toInt(body.max_users, 5),
        toInt(body.max_branches, 1),
        toInt(body.max_products, 500),
        toInt(body.max_orders_per_month, 3000),
        body.features || '{}',
        toFlag(body.is_active ?? 1),
        toFlag(body.is_public ?? 1),
        toInt(body.trial_days),
        toInt(body.sort_order),
        now,
        now
      );

    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(info.lastInsertRowid) as any;
    res.status(201).json({ success: true, plan });
  } catch (e: any) {
    console.error('[Platform/Plans] POST error:', e);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: e?.message || 'Erreur serveur' });
  }
});

// ── Update a plan ─────────────────────────────────────────────────────────────
router.put('/plans/:id', requirePlatformAuth, (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as any;
    if (!plan) return res.status(404).json({ error: 'PLAN_NOT_FOUND', message: 'Plan introuvable' });

    const body = req.body || {};

    // Preserve the existing casing when the code is unchanged for this plan.
    // Only normalize/validate when the (case-insensitive) code actually changes,
    // so editing a plan without touching its code never trips a false "already
    // exists" conflict against a case-variant duplicate (e.g. trial_7d vs TRIAL_7D).
    const rawCode = body.code !== undefined ? String(body.code).trim() : plan.code;
    const newCodeNorm = (rawCode || '').toUpperCase();
    const currentCodeNorm = (plan.code || '').toUpperCase();

    let newCode = plan.code;
    if (newCodeNorm !== currentCodeNorm) {
      if (!/^[A-Z0-9_]+$/.test(rawCode)) {
        return res.status(400).json({
          error: 'INVALID_CODE',
          message: 'Le code ne doit contenir que des lettres, chiffres et underscores (A-Z, 0-9, _).',
        });
      }
      const dup = db.prepare('SELECT id FROM plans WHERE LOWER(code) = LOWER(?) AND id != ?').get(rawCode, id) as any;
      if (dup) {
        return res.status(409).json({ error: 'CODE_EXISTS', message: 'Ce code de plan existe déjà.' });
      }
      newCode = newCodeNorm;
    }

    const period = body.period !== undefined ? normalizePeriod(body.period, plan.period) : plan.period;
    const duration_days =
      body.duration_days !== undefined ? toInt(body.duration_days) : plan.duration_days;
    const price_cents =
      body.price_cents !== undefined ? Math.max(0, toInt(body.price_cents)) : plan.price_cents;
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE plans SET
        code = ?, name = ?, description = ?, price_cents = ?, currency = ?, period = ?, duration_days = ?,
        max_users = ?, max_branches = ?, max_products = ?, max_orders_per_month = ?, features = ?,
        is_active = ?, is_public = ?, trial_days = ?, sort_order = ?, updated_at = ?, version = version + 1
      WHERE id = ?`
    ).run(
      newCode,
      body.name !== undefined ? String(body.name) : plan.name,
      body.description !== undefined ? body.description : plan.description,
      price_cents,
      body.currency !== undefined ? body.currency : plan.currency,
      period,
      duration_days,
      body.max_users !== undefined ? toInt(body.max_users) : plan.max_users,
      body.max_branches !== undefined ? toInt(body.max_branches) : plan.max_branches,
      body.max_products !== undefined ? toInt(body.max_products) : plan.max_products,
      body.max_orders_per_month !== undefined ? toInt(body.max_orders_per_month) : plan.max_orders_per_month,
      body.features !== undefined ? body.features : plan.features,
      body.is_active !== undefined ? toFlag(body.is_active) : plan.is_active,
      body.is_public !== undefined ? toFlag(body.is_public) : plan.is_public,
      body.trial_days !== undefined ? toInt(body.trial_days) : plan.trial_days,
      body.sort_order !== undefined ? toInt(body.sort_order) : plan.sort_order,
      now,
      id
    );

    const updated = db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as any;
    res.json({ success: true, plan: updated });
  } catch (e: any) {
    console.error('[Platform/Plans] PUT error:', e);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: e?.message || 'Erreur serveur' });
  }
});

// ── Delete a plan (refuses if still referenced by a subscription) ──────────────
router.delete('/plans/:id', requirePlatformAuth, (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as any;
    if (!plan) return res.status(404).json({ error: 'PLAN_NOT_FOUND', message: 'Plan introuvable' });

    const referenced = db
      .prepare('SELECT id FROM subscriptions WHERE plan_id = ? LIMIT 1')
      .get(id) as any;
    if (referenced) {
      return res.status(409).json({
        error: 'PLAN_IN_USE',
        message: 'Ce plan est encore utilisé par une ou plusieurs souscriptions et ne peut pas être supprimé.',
      });
    }

    db.prepare('DELETE FROM plans WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (e: any) {
    console.error('[Platform/Plans] DELETE error:', e);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: e?.message || 'Erreur serveur' });
  }
});

export default router;
