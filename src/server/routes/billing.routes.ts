// =============================================================================
// Billing Routes — Voucher-First Workflow (Clean API)
// =============================================================================
// GET  /api/billing/status                            → statut d'abonnement
// POST /api/billing/request-voucher                   → demande de code voucher
// POST /api/billing/payment-sent                      → déclarer paiement envoyé
// GET  /api/vouchers/status/:code                     → statut public d'un voucher
// POST /api/vouchers/request                          → alias public request-voucher
// =============================================================================

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import { getSubscriptionStatus } from '../middleware/subscription-guard';
import { requireJwtAuth } from '../middleware/jwt-auth';
import { db } from '../db/database';
import { queueSyncChange } from '../../sync/sync-helper';
import { sendEmailDirect, loadRawSettings } from '../services/notification.service';
import { buildVoucherGeneratedEmail, buildVoucherExpiredEmail } from '../services/email-templates';

function getSupabase(): SupabaseClient | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
  });
}

function generateVoucherCode(tenantId: number): string {
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `EKA-${tenantId}-${rand}`;
}

const router = Router();

// GET /api/v1/subscription/status/:tenantId — Legacy route (compatibilité frontend)
// Cette route est publique (skip requireJwtAuth dans server.ts)
// Le middleware de contexte injecte req.tenant_id via verifyJwt si un token est présent
router.get('/v1/subscription/status/:tenantId', async (req: any, res: any) => {
  try {
    const tenantId = Number(req.params.tenantId);
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId requis' });
    }

    const supabase = getSupabase();
    const localDb = db;

    let tenant: any = null;
    let subscription: any = null;
    let plan: any = null;

    if (supabase) {
      const [{ data: tData }, { data: sData }] = await Promise.all([
        supabase.from('tenants').select('status, name, is_provisioned').eq('id', tenantId).maybeSingle(),
        supabase
          .from('subscriptions')
          .select('status, current_period_end, trial_ends_at, plan_id, started_at, last_voucher_code')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      tenant = tData;
      subscription = sData;

      if (subscription?.plan_id) {
        const { data: planData } = await supabase
          .from('plans')
          .select('code, name, price_cents, currency, period')
          .eq('id', subscription.plan_id)
          .maybeSingle();
        plan = planData;
      }
    } else if (localDb) {
      tenant = localDb.prepare('SELECT status, name, is_provisioned FROM tenants WHERE id = ?').get(tenantId) as any;
      subscription = localDb.prepare(`
        SELECT status, current_period_end, trial_ends_at, plan_id, started_at, last_voucher_code 
        FROM subscriptions 
        WHERE tenant_id = ? 
        ORDER BY created_at DESC LIMIT 1
      `).get(tenantId) as any;
      if (subscription?.plan_id) {
        plan = localDb.prepare('SELECT code, name, price_cents, currency, period FROM plans WHERE id = ?').get(subscription.plan_id) as any;
      }
    }

    const tenantStatus = tenant?.status || 'unknown';
    const subState = await getSubscriptionStatus(tenantId);

    let expiresAt: string | null = null;
    if (subscription) {
      expiresAt = subscription.current_period_end || subscription.trial_ends_at || null;
    }

    const blockedStates = ['pending', 'expired', 'suspended', 'cancelled', 'no_plan', 'past_due'];
    const effectiveState = tenantStatus === 'pending' ? 'pending' : subState.state;
    const canActivateVoucher = blockedStates.includes(effectiveState);

    res.json({
      tenant_status: tenantStatus,
      subscription_status: subState.state,
      plan_code: subState.planName || plan?.code,
      plan_name: plan?.name || subState.planName,
      plan_id: subscription?.plan_id || null,
      price_cents: plan?.price_cents || 0,
      currency: plan?.currency || 'ZMW',
      period: plan?.period || 'monthly',
      expires_at: expiresAt,
      grace_days_remaining: subState.isGracePeriod ? subState.graceDaysRemaining : 0,
      is_grace_period: subState.isGracePeriod,
      can_activate_voucher: canActivateVoucher,
      subscription_id: subState.subscriptionId,
      started_at: subscription?.started_at || null,
      last_voucher_code: subscription?.last_voucher_code || null,
    });
  } catch (e: any) {
    console.error('[Billing] legacy status error:', e);
    res.status(500).json({ error: 'BILLING_STATUS_FAILED', message: e.message });
  }
});

// POST /api/admin/clear-subscription-cache — Vide le cache des abonnements
router.post('/admin/clear-subscription-cache', requireJwtAuth, async (req: any, res: any) => {
  try {
    const tenantId = Number(req.user?.tenant_id);
    if (!tenantId) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentification requise.' });
    }

    // Importer la fonction pour vider le cache
    const { invalidateSubscriptionCache } = require('../middleware/subscription-guard');
    invalidateSubscriptionCache(tenantId);

    res.json({ success: true, message: 'Cache d\'abonnement vidé avec succès.' });
  } catch (e: any) {
    console.error('[Billing] clear cache error:', e);
    res.status(500).json({ error: 'CACHE_CLEAR_FAILED', message: e.message });
  }
});

// GET /api/billing/status — statut d'abonnement du tenant connecté
router.get('/status', requireJwtAuth, async (req: any, res: any) => {
  try {
    const tenantId = Number(req.user?.tenant_id);
    if (!tenantId) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentification requise.' });
    }

    const supabase = getSupabase();
    const localDb = db;

    let tenant: any = null;
    let subscription: any = null;
    let plan: any = null;

    if (supabase) {
      const [{ data: tData }, { data: sData }] = await Promise.all([
        supabase.from('tenants').select('status, name, is_provisioned').eq('id', tenantId).maybeSingle(),
        supabase
          .from('subscriptions')
          .select('status, current_period_end, trial_ends_at, plan_id, started_at, last_voucher_code')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      tenant = tData;
      subscription = sData;

      if (subscription?.plan_id) {
        const { data: planData } = await supabase
          .from('plans')
          .select('code, name, price_cents, currency, period')
          .eq('id', subscription.plan_id)
          .maybeSingle();
        plan = planData;
      }
    } else if (localDb) {
      tenant = localDb.prepare('SELECT status, name, is_provisioned FROM tenants WHERE id = ?').get(tenantId) as any;
      subscription = localDb.prepare(`
        SELECT status, current_period_end, trial_ends_at, plan_id, started_at, last_voucher_code 
        FROM subscriptions 
        WHERE tenant_id = ? 
        ORDER BY created_at DESC LIMIT 1
      `).get(tenantId) as any;
      if (subscription?.plan_id) {
        plan = localDb.prepare('SELECT code, name, price_cents, currency, period FROM plans WHERE id = ?').get(subscription.plan_id) as any;
      }
    }

    const tenantStatus = tenant?.status || 'unknown';
    const subState = await getSubscriptionStatus(tenantId);

    let expiresAt: string | null = null;
    if (subscription) {
      expiresAt = subscription.current_period_end || subscription.trial_ends_at || null;
    }

    const blockedStates = ['pending', 'expired', 'suspended', 'cancelled', 'no_plan', 'past_due'];
    const effectiveState = tenantStatus === 'pending' ? 'pending' : subState.state;
    const canActivateVoucher = blockedStates.includes(effectiveState);

    res.json({
      tenant_status: tenantStatus,
      subscription_status: subState.state,
      plan_code: subState.planName || plan?.code,
      plan_name: plan?.name || subState.planName,
      plan_id: subscription?.plan_id || null,
      price_cents: plan?.price_cents || 0,
      currency: plan?.currency || 'ZMW',
      period: plan?.period || 'monthly',
      expires_at: expiresAt,
      grace_days_remaining: subState.isGracePeriod ? subState.graceDaysRemaining : 0,
      is_grace_period: subState.isGracePeriod,
      can_activate_voucher: canActivateVoucher,
      subscription_id: subState.subscriptionId,
      started_at: subscription?.started_at || null,
      last_voucher_code: subscription?.last_voucher_code || null,
    });
  } catch (e: any) {
    console.error('[Billing] status error:', e);
    res.status(500).json({ error: 'BILLING_STATUS_FAILED', message: e.message });
  }
});

// POST /api/billing/request-voucher — Authenticated user requests a voucher
router.post('/request-voucher', requireJwtAuth, async (req: any, res: any) => {
  try {
    const tenantId = Number(req.user?.tenant_id);
    if (!tenantId) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentification requise.' });

    const planId = Number(req.body?.planId);
    if (!planId) return res.status(400).json({ error: 'planId requis' });

    const supabase = getSupabase();
    const localDb = db;

    let plan: any = null;
    if (supabase) {
      const { data, error } = await supabase.from('plans').select('*').eq('id', planId).eq('is_active', true).maybeSingle();
      if (error || !data) return res.status(404).json({ error: 'Plan introuvable' });
      plan = data;
    } else if (localDb) {
      plan = localDb.prepare('SELECT * FROM plans WHERE id = ? AND is_active = 1').get(planId) as any;
    }
    if (!plan) return res.status(404).json({ error: 'Plan introuvable' });

    const amountCents = Number(plan.price_cents);
    const currency = String(plan.currency || 'ZMW');
    const now = new Date();
    const verificationDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const nowISO = now.toISOString();

let voucherCode = '';
    let localId: number | null = null;
    let insertedInto = '';

    // Helper to insert into voucher_requests (clean table)
    const insertIntoVoucherRequests = (db: any, code: string) => {
      const result = db.prepare(`
        INSERT INTO voucher_requests
          (tenant_id, plan_id, voucher_code, customer_email, status, requested_at, verification_deadline, expires_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
      `).run(
        tenantId, planId, code,
        req.user?.email || '',
        nowISO,
        verificationDeadline.toISOString(),
        expiresAt.toISOString(),
        nowISO, nowISO,
      );
      return Number(result.lastInsertRowid);
    };

    // Helper to insert into subscription_payment_requests (legacy table)
    const insertIntoLegacy = (db: any, code: string) => {
      return db.prepare(`
        INSERT INTO subscription_payment_requests
          (tenant_id, plan_id, voucher_code, requested_by, amount_cents, currency, requested_at, verification_deadline, expires_at, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `).run(
        tenantId, planId, code, req.user?.sub || 0,
        amountCents, currency, nowISO, verificationDeadline.toISOString(), expiresAt.toISOString(), nowISO, nowISO,
      );
    };

    if (localDb) {
      let attempts = 0;
      let created = false;
      while (attempts < 8 && !created) {
        voucherCode = generateVoucherCode(tenantId);
        try {
          // Essayer d'abord la table clean
          try {
            localId = insertIntoVoucherRequests(localDb, voucherCode);
            insertedInto = 'voucher_requests';
          } catch (e: any) {
            // Si la table clean n'existe pas, essayer la table legacy
            if (e?.message?.includes('no such table')) {
              const _legacyResult = insertIntoLegacy(localDb, voucherCode);
              localId = Number(_legacyResult.lastInsertRowid);
              insertedInto = 'subscription_payment_requests';
            } else {
              throw e;
            }
          }
          created = true;
        } catch (e: any) {
          attempts++;
          const msg = String(e?.message || '');
          if (msg.includes('UNIQUE constraint') || msg.includes('UNIQUE constraint failed')) continue;
          console.error('[Billing] Insert request-voucher error:', e);
          return res.status(500).json({
            error: 'Erreur lors de la création de la demande.',
            detail: process.env.NODE_ENV === 'development' ? e?.message : undefined,
          });
        }
      }
      if (!created) return res.status(409).json({ error: 'Impossible de générer un code unique. Veuillez réessayer.' });

      let row: any = null;
      if (insertedInto === 'voucher_requests') {
        row = localDb.prepare('SELECT * FROM voucher_requests WHERE id = ?').get(localId) as any;
      } else {
        row = localDb.prepare('SELECT * FROM subscription_payment_requests WHERE id = ?').get(localId) as any;
      }
      queueSyncChange(insertedInto === 'voucher_requests' ? 'voucher_request' : 'subscription_payment_request', 'insert', { ...row, tenant_id: tenantId });
    } else if (supabase) {
      let attempts = 0;
      let inserted: any = null;
      let insertedTable = '';
      while (attempts < 8 && !inserted) {
        voucherCode = generateVoucherCode(tenantId);
        const payload: any = {
          tenant_id: tenantId, plan_id: planId, voucher_code: voucherCode,
          customer_email: req.user?.email || '',
          amount_cents: amountCents, currency,
          requested_at: nowISO,
          verification_deadline: verificationDeadline.toISOString(),
          expires_at: expiresAt.toISOString(),
          status: 'pending',
        };
        const table = 'voucher_requests';
        const { data, error } = await supabase.from(table).insert([payload]).select().single();
        if (!error && data) {
          inserted = data;
          insertedTable = table;
          break;
        }
        if (error?.message?.includes('duplicate key') || error?.code === '23505') { attempts++; continue; }
        // Si erreur de table inconnue, fallback vers table legacy
        if (error?.message?.includes('does not exist') || error?.message?.includes('no such table')) {
          const legacyTable = 'subscription_payment_requests';
          const legacyPayload: any = {
            ...payload,
            requested_by: req.user?.sub || null,
          };
          const legacyRes = await supabase.from(legacyTable).insert([legacyPayload]).select().single();
          if (!legacyRes.error && legacyRes.data) {
            inserted = legacyRes.data;
            insertedTable = legacyTable;
            break;
          }
        }
        return res.status(500).json({ error: error?.message || 'Erreur création demande' });
      }
      if (!inserted) return res.status(409).json({ error: 'Impossible de générer un code unique. Veuillez réessayer.' });
      insertedInto = insertedTable;
    } else {
      return res.status(503).json({ error: 'SUPABASE_NOT_CONFIGURED' });
    }

    // Envoyer email (best-effort)
    try {
      const settingsRaw = loadRawSettings();
      const tenantEmail = req.user?.email || null;
      if (tenantEmail) {
        void sendEmailDirect(
          `[Great Olive] Code de paiement généré — ${plan.name}`,
          buildVoucherGeneratedEmail(voucherCode, plan, amountCents, currency, verificationDeadline, expiresAt),
          settingsRaw, tenantEmail,
        );
      }
    } catch (mailErr) {
      console.error('[Billing] Email send error (request-voucher):', mailErr);
    }

    res.json({
      success: true,
      voucherCode,
      amount: { cents: amountCents, currency },
      plan: { id: plan.id, code: plan.code, name: plan.name, period: plan.period, duration_days: plan.duration_days },
    });
  } catch (e: any) {
    console.error('[Billing] request-voucher error:', e);
    res.status(500).json({ error: e?.message || 'Erreur serveur' });
  }
});

// POST /api/vouchers/request — Public alias (no auth required, Supabase only)
router.post('/vouchers/request', async (req: Request, res: Response) => {
  try {
    const { plan_id, email, tenant_id } = req.body || {};
    if (!plan_id || !email) return res.status(400).json({ error: 'plan_id et email sont requis' });
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'SUPABASE_NOT_CONFIGURED' });

    const { data: plan, error: planError } = await supabase.from('plans').select('*').eq('id', plan_id).eq('is_active', true).maybeSingle();
    if (planError || !plan) return res.status(404).json({ error: 'Plan introuvable' });

    const voucherCode = generateVoucherCode(Number(tenant_id || 0));
    const now = new Date();
    const verificationDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const { data: inserted, error: vErr } = await supabase
      .from('subscription_payment_requests')
      .insert([{
        tenant_id: Number(tenant_id) || null,
        plan_id: plan.id,
        voucher_code: voucherCode,
        requested_by: null,
        amount_cents: Number(plan.price_cents),
        currency: plan.currency || 'ZMW',
        requested_at: now.toISOString(),
        verification_deadline: verificationDeadline.toISOString(),
        expires_at: expiresAt.toISOString(),
        status: 'pending',
      }])
      .select().single();

    if (vErr || !inserted) return res.status(500).json({ error: vErr?.message || 'Erreur création demande' });

    void sendEmailDirect(
      `[Great Olive] Code de paiement généré — ${plan.name}`,
      buildVoucherGeneratedEmail(voucherCode, plan, Number(plan.price_cents), plan.currency || 'ZMW', verificationDeadline, expiresAt),
      loadRawSettings(), email,
    );

    res.json({ success: true, voucherCode, amount: { cents: Number(plan.price_cents), currency: plan.currency || 'ZMW' }, plan: { id: plan.id, code: plan.code, name: plan.name } });
  } catch (e: any) {
    console.error('[Billing] public request-voucher error:', e);
    res.status(500).json({ error: e?.message || 'Erreur serveur' });
  }
});

// POST /api/billing/payment-sent
router.post('/payment-sent', requireJwtAuth, async (req: any, res: any) => {
  try {
    const tenantId = Number(req.user?.tenant_id);
    if (!tenantId) return res.status(401).json({ error: 'UNAUTHORIZED' });
    const voucherCode = String(req.body?.voucherCode || '').trim().toUpperCase();
    if (!voucherCode) return res.status(400).json({ error: 'voucherCode requis' });

    const supabase = getSupabase();
    const localDb = db;
    let row: any = null;
    
    // Chercher dans les deux tables (voucher_requests et subscription_payment_requests)
    if (localDb) {
      // Essayer d'abord la table clean
      try {
        row = localDb.prepare('SELECT * FROM voucher_requests WHERE voucher_code = ? AND tenant_id = ?').get(voucherCode, tenantId) as any;
      } catch (e: any) {
        // Si la table n'existe pas, essayer la table legacy
        if (e?.message?.includes('no such table')) {
          row = localDb.prepare('SELECT * FROM subscription_payment_requests WHERE voucher_code = ? AND tenant_id = ?').get(voucherCode, tenantId) as any;
        }
      }
      if (!row) return res.status(404).json({ error: 'Demande introuvable pour ce tenant.' });
    } else if (supabase) {
      // Essayer d'abord voucher_requests
      let { data, error } = await supabase.from('voucher_requests').select('*').eq('voucher_code', voucherCode).eq('tenant_id', tenantId).maybeSingle();
      if (!data && !error) {
        // Fallback vers subscription_payment_requests
        const legacyRes = await supabase.from('subscription_payment_requests').select('*').eq('voucher_code', voucherCode).eq('tenant_id', tenantId).maybeSingle();
        data = legacyRes.data;
        error = legacyRes.error;
      }
      if (error || !data) return res.status(404).json({ error: 'Demande introuvable pour ce tenant.' });
      row = data;
    } else {
      return res.status(503).json({ error: 'SUPABASE_NOT_CONFIGURED' });
    }

    if (!['pending'].includes(row.status)) {
      return res.status(400).json({ error: `Statut invalide: ${row.status}. Seuls les codes en attente peuvent être marqués comme payés.` });
    }

    const now = new Date();
    const nowISO = now.toISOString();
    if (row.expires_at && new Date(row.expires_at) < now) {
      if (localDb) {
        localDb.prepare(`UPDATE subscription_payment_requests SET status = 'expired', updated_at = ? WHERE id = ?`).run(nowISO, row.id);
        queueSyncChange('subscription_payment_request', 'update', { id: row.id, status: 'expired', updated_at: nowISO, tenant_id: tenantId });
      } else if (supabase) {
        await supabase.from('subscription_payment_requests').update({ status: 'expired', updated_at: nowISO }).eq('id', row.id);
      }
      return res.status(400).json({ error: 'CODE_EXPIRED', message: 'Le délai d\'utilisation du code a expiré.' });
    }

    const updates: any = { status: 'payment_sent', updated_at: nowISO };
    const tableName = row.table_name || 'voucher_requests'; // Déterminer la table source
    
    if (localDb) {
      const tableToUpdate = tableName === 'subscription_payment_requests' ? 'subscription_payment_requests' : 'voucher_requests';
      localDb.prepare(`UPDATE ${tableToUpdate} SET status = 'payment_sent', updated_at = ? WHERE id = ?`).run(nowISO, row.id);
      queueSyncChange(tableToUpdate === 'voucher_requests' ? 'voucher_request' : 'subscription_payment_request', 'update', { ...row, status: 'payment_sent', updated_at: nowISO });
    } else if (supabase) {
      await supabase.from(tableName).update(updates).eq('id', row.id);
    }

    res.json({ success: true, status: 'payment_sent', voucherCode: row.voucher_code });
  } catch (e: any) {
    console.error('[Billing] payment-sent error:', e);
    res.status(500).json({ error: e?.message || 'Erreur serveur' });
  }
});

// GET /api/billing/plans — Liste des plans disponibles
router.get('/plans', requireJwtAuth, async (req: any, res: any) => {
  try {
    const supabase = getSupabase();
    const localDb = db;

    if (supabase) {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .eq('is_public', true)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('[Billing] plans error (supabase):', error);
        return res.status(500).json({ error: error.message });
      }

      return res.json({ plans: data || [] });
    }

    if (localDb) {
      const plans = localDb.prepare(`
        SELECT * FROM plans
        WHERE is_active = 1 AND is_public = 1
        ORDER BY sort_order ASC
      `).all() as any[];

      return res.json({ plans });
    }

    return res.status(503).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  } catch (e: any) {
    console.error('[Billing] plans error:', e);
    res.status(500).json({ error: e?.message || 'Erreur serveur' });
  }
});

// POST /api/billing/redeem-voucher — Activer un voucher code
router.post('/redeem-voucher', requireJwtAuth, async (req: any, res: any) => {
  try {
    const tenantId = Number(req.user?.tenant_id);
    if (!tenantId) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentification requise.' });
    }

    const code = String(req.body?.code || '').trim().toUpperCase();
    if (!code) {
      return res.status(400).json({ error: 'Code voucher requis' });
    }

    const supabase = getSupabase();
    const localDb = db;

    // Chercher le voucher dans les deux tables possibles
    let voucher: any = null;
    let voucherTable = '';

    if (localDb) {
      // Essayer d'abord voucher_requests
      try {
        voucher = localDb.prepare(`
          SELECT * FROM voucher_requests
          WHERE voucher_code = ? AND tenant_id = ?
          ORDER BY created_at DESC LIMIT 1
        `).get(code, tenantId) as any;
        voucherTable = 'voucher_requests';
      } catch (e: any) {
        // Fallback vers subscription_payment_requests
        if (e?.message?.includes('no such table')) {
          try {
            voucher = localDb.prepare(`
              SELECT * FROM subscription_payment_requests
              WHERE voucher_code = ? AND tenant_id = ?
              ORDER BY created_at DESC LIMIT 1
            `).get(code, tenantId) as any;
            voucherTable = 'subscription_payment_requests';
          } catch (e2: any) {
            if (!e2?.message?.includes('no such table')) {
              console.error('[Billing] redeem-voucher query error:', e2);
            }
          }
        }
      }
    } else if (supabase) {
      // Essayer d'abord voucher_requests
      const { data: v1, error: e1 } = await supabase
        .from('voucher_requests')
        .select('*, plans(*)')
        .eq('voucher_code', code)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (v1 && !e1) {
        voucher = v1;
        voucherTable = 'voucher_requests';
      } else {
        // Fallback vers subscription_payment_requests
        const { data: v2, error: e2 } = await supabase
          .from('subscription_payment_requests')
          .select('*, plans(*)')
          .eq('voucher_code', code)
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (v2 && !e2) {
          voucher = v2;
          voucherTable = 'subscription_payment_requests';
        }
      }
    }

    if (!voucher) {
      return res.status(404).json({ error: 'Code introuvable ou non associé à votre compte.' });
    }

    // Vérifier le statut du voucher
    const now = new Date();
    const expiresAt = voucher.expires_at ? new Date(voucher.expires_at) : null;

    if (expiresAt && expiresAt < now) {
      // Marquer comme expiré
      if (localDb) {
        localDb.prepare(`UPDATE ${voucherTable} SET status = 'expired', updated_at = ? WHERE id = ?`).run(now.toISOString(), voucher.id);
      } else if (supabase) {
        await supabase.from(voucherTable).update({ status: 'expired', updated_at: now.toISOString() }).eq('id', voucher.id);
      }
      return res.status(400).json({ error: 'CODE_EXPIRED', message: 'Ce code a expiré.' });
    }

    if (voucher.status !== 'pending' && voucher.status !== 'payment_sent') {
      return res.status(400).json({
        error: 'INVALID_STATUS',
        message: `Statut invalide: ${voucher.status}. Seuls les codes en attente peuvent être activés.`
      });
    }

    // Récupérer le plan
    let plan: any = null;
    if (voucher.plans) {
      plan = voucher.plans;
    } else if (localDb) {
      plan = localDb.prepare('SELECT * FROM plans WHERE id = ?').get(voucher.plan_id) as any;
    } else if (supabase) {
      const { data: p } = await supabase.from('plans').select('*').eq('id', voucher.plan_id).maybeSingle();
      plan = p;
    }

    if (!plan) {
      return res.status(404).json({ error: 'Plan introuvable pour ce voucher.' });
    }

    // Mettre à jour le voucher: status = activated
    const nowISO = now.toISOString();
    if (localDb) {
      localDb.prepare(`
        UPDATE ${voucherTable}
        SET status = 'activated', updated_at = ?, verified_at = ?
        WHERE id = ?
      `).run(nowISO, nowISO, voucher.id);
    } else if (supabase) {
      await supabase.from(voucherTable).update({
        status: 'activated',
        updated_at: nowISO,
        verified_at: nowISO,
      }).eq('id', voucher.id);
    }

    // Créer/mettre à jour l'abonnement
    const durationDays = Number(plan.duration_days || 30);
    const startDate = now;
    const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    if (localDb) {
      // Vérifier si un abonnement existe déjà
      const existing = localDb.prepare(`
        SELECT * FROM subscriptions WHERE tenant_id = ?
      `).get(tenantId) as any;

      if (existing) {
        // Étendre l'abonnement existant
        const currentEnd = existing.end_date ? new Date(existing.end_date) : new Date();
        const newEnd = new Date(Math.max(currentEnd.getTime(), startDate.getTime()) + durationDays * 24 * 60 * 60 * 1000);
        localDb.prepare(`
          UPDATE subscriptions
          SET plan_id = ?, status = 'active', current_period_start = ?, current_period_end = ?, updated_at = ?
          WHERE tenant_id = ?
        `).run(plan.id, startDate.toISOString(), newEnd.toISOString(), nowISO, tenantId);
      } else {
        // Créer un nouvel abonnement
        localDb.prepare(`
          INSERT INTO subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end, started_at, created_at, updated_at)
          VALUES (?, ?, 'active', ?, ?, ?, ?, ?)
        `).run(tenantId, plan.id, startDate.toISOString(), endDate.toISOString(), nowISO, nowISO, nowISO);
      }
    } else if (supabase) {
      // Vérifier si un abonnement existe
      const { data: existing } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (existing) {
        const currentEnd = existing.current_period_end ? new Date(existing.current_period_end) : new Date();
        const newEnd = new Date(Math.max(currentEnd.getTime(), startDate.getTime()) + durationDays * 24 * 60 * 60 * 1000);
        await supabase.from('subscriptions').update({
          plan_id: plan.id,
          status: 'active',
          current_period_start: startDate.toISOString(),
          current_period_end: newEnd.toISOString(),
          updated_at: nowISO,
        }).eq('tenant_id', tenantId);
      } else {
        await supabase.from('subscriptions').insert({
          tenant_id: tenantId,
          plan_id: plan.id,
          status: 'active',
          current_period_start: startDate.toISOString(),
          current_period_end: endDate.toISOString(),
          started_at: nowISO,
          created_at: nowISO,
          updated_at: nowISO,
        });
      }
    }

    // Mettre à jour le tenant: status = active, is_provisioned = 1
    if (localDb) {
      localDb.prepare(`
        UPDATE tenants SET status = 'active', is_provisioned = 1, updated_at = ? WHERE id = ?
      `).run(nowISO, tenantId);
    } else if (supabase) {
      await supabase.from('tenants').update({
        status: 'active',
        is_provisioned: true,
        updated_at: nowISO,
      }).eq('id', tenantId);
    }

    res.json({
      success: true,
      message: 'Abonnement activé avec succès !',
      subscription: {
        plan_code: plan.code,
        plan_name: plan.name,
        status: 'active',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        duration_days: durationDays,
      },
    });
  } catch (e: any) {
    console.error('[Billing] redeem-voucher error:', e);
    res.status(500).json({ error: e?.message || 'Erreur serveur' });
  }
});

// GET /api/billing/voucher-requests — Liste des demandes de voucher du tenant
router.get('/voucher-requests', requireJwtAuth, async (req: any, res: any) => {
  try {
    const tenantId = Number(req.user?.tenant_id);
    if (!tenantId) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentification requise.' });
    }

    const supabase = getSupabase();
    const localDb = db;

    let voucherRequests: any[] = [];
    if (localDb) {
      try {
        voucherRequests = localDb.prepare(`
          SELECT vr.*, p.code as plan_code, p.name as plan_name, p.period, p.duration_days
          FROM voucher_requests vr
          LEFT JOIN plans p ON vr.plan_id = p.id
          WHERE vr.tenant_id = ?
          ORDER BY vr.created_at DESC
          LIMIT 50
        `).all(tenantId) as any[];
      } catch (e: any) {
        if (!e?.message?.includes('no such table')) {
          console.error('[Billing] voucher-requests query error:', e);
        }
        voucherRequests = [];
      }
    } else if (supabase) {
      const { data } = await supabase
        .from('voucher_requests')
        .select('*, plans(code, name, period, duration_days)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50);
      voucherRequests = data || [];
    }

    res.json({
      voucherRequests: voucherRequests.map(vr => ({
        id: vr.id,
        voucher_code: vr.voucher_code,
        status: vr.status,
        plan_id: vr.plan_id,
        plan_code: vr.plan_code,
        plan_name: vr.plan_name,
        period: vr.period,
        duration_days: vr.duration_days,
        requested_at: vr.requested_at,
        expires_at: vr.expires_at,
        verified_at: vr.verified_at,
      }))
    });
  } catch (e: any) {
    console.error('[Billing] voucher-requests error:', e);
    res.status(500).json({ error: e?.message || 'Erreur serveur' });
  }
});

// GET /api/billing/payment-history — Historique des paiements (placeholder)
router.get('/payment-history', requireJwtAuth, async (req: any, res: any) => {
  try {
    const tenantId = Number(req.user?.tenant_id);
    if (!tenantId) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentification requise.' });
    }

    // Pour l'instant, retourner un tableau vide car l'historique de paiement
    // n'est pas encore implémenté dans le système de voucher
    // Ce endpoint peut être étendu plus tard pour intégrer un système de paiement
    res.json({
      paymentHistory: []
    });
  } catch (e: any) {
    console.error('[Billing] payment-history error:', e);
    res.status(500).json({ error: e?.message || 'Erreur serveur' });
  }
});

// GET /api/vouchers/status/:code — Public voucher status lookup
router.get('/vouchers/status/:code', async (req: Request, res: Response) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'Code requis' });
    const supabase = getSupabase();
    const localDb = db;
    let row: any = null;
    if (localDb) {
      row = localDb.prepare('SELECT * FROM subscription_payment_requests WHERE voucher_code = ?').get(code) as any;
    } else if (supabase) {
      const { data, error } = await supabase.from('subscription_payment_requests').select('*, plans(*)').eq('voucher_code', code).maybeSingle();
      if (!error && data) row = data;
    }
    if (!row) return res.status(404).json({ error: 'Code introuvable', valid: false });
    const now = new Date();
    const expired = row.expires_at ? new Date(row.expires_at) < now : false;
    res.json({
      valid: ['pending', 'payment_sent'].includes(row.status) && !expired,
      status: expired && ['pending', 'payment_sent'].includes(row.status) ? 'expired' : row.status,
      expires_at: row.expires_at,
      plan_name: row.plans?.name || row.plan_id,
    });
  } catch (e: any) {
    console.error('[Billing] voucher status error:', e);
    res.status(500).json({ error: e?.message || 'Erreur serveur' });
  }
});

export default router;
