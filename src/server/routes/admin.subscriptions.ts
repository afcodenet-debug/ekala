// =============================================================================
// Admin Subscriptions Routes — /api/admin/subscriptions et /api/admin/vouchers
// =============================================================================
// Phase 6, 7, 8 — Listing, vérification et rejet des demandes de paiement.
// =============================================================================

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import { requireRole } from '../middleware/auth';
import { db } from '../db/database';
import { getSubscriptionStatus } from '../middleware/subscription-guard';
import { withOutboxTransaction } from '../../sync/with-outbox-transaction';
import { queueSyncChange } from '../../sync/sync-helper';
import { sendEmailDirect, loadRawSettings } from '../services/notification.service';
import { buildPaymentVerifiedEmailHTML, buildPaymentRejectedEmailHTML } from '../services/email-templates';

function getSupabase(): SupabaseClient | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
  });
}

const router = Router();
const subRouter = Router();

// Toutes les routes admin nécessitent un rôle owner/admin
router.use(requireRole(['owner', 'admin']));
subRouter.use(requireRole(['owner', 'admin']));

// ── Helpers communs ────────────────────────────────────────────────────────────

async function getRequestRow(id: number): Promise<any | null> {
  const supabase = getSupabase();
  const localDb = db;
  if (localDb) {
    return localDb.prepare('SELECT * FROM subscription_payment_requests WHERE id = ?').get(id) as any || null;
  }
  if (supabase) {
    const { data, error } = await supabase.from('subscription_payment_requests').select('*').eq('id', id).maybeSingle();
    if (error || !data) return null;
    return data;
  }
  return null;
}

async function activateTenantSub(tenantId: number, planId: number, _adminUserId: number | null, nowISO: string): Promise<void> {
  const supabase = getSupabase();
  const localDb = db;
  if (localDb) {
    withOutboxTransaction(localDb, String(tenantId), () => {
      const sub = localDb.prepare(`SELECT id, status FROM subscriptions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1`).get(tenantId) as any;
      if (sub && ['active', 'trial', 'past_due', 'pending'].includes(sub.status)) {
        const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        localDb.prepare(`UPDATE subscriptions SET status = 'active', current_period_start = ?, current_period_end = ?, updated_at = ? WHERE id = ?`).run(nowISO, periodEnd, nowISO, sub.id);
        queueSyncChange('subscription', 'update', { id: sub.id, status: 'active', current_period_start: nowISO, current_period_end: periodEnd, tenant_id: tenantId });
      } else if (!sub) {
        const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const subResult = localDb.prepare(`INSERT INTO subscriptions (tenant_id, plan_id, status, started_at, current_period_start, current_period_end, auto_renew, created_at, updated_at) VALUES (?, ?, 'active', ?, ?, ?, 1, ?, ?)`).run(tenantId, planId, nowISO, nowISO, periodEnd, nowISO, nowISO);
        queueSyncChange('subscription', 'insert', { id: Number(subResult.lastInsertRowid), status: 'active', tenant_id: tenantId });
      }
      localDb.prepare(`UPDATE tenants SET status = 'active', is_provisioned = 1, provisioned_at = ?, updated_at = ? WHERE id = ?`).run(nowISO, nowISO, tenantId);
      queueSyncChange('tenant', 'update', { id: tenantId, status: 'active', is_provisioned: 1, provisioned_at: nowISO });
    });
  } else if (supabase) {
    const { data: existingSub } = await supabase.from('subscriptions').select('id').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const periodStart = nowISO;
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    if (existingSub) {
      await supabase.from('subscriptions').update({ status: 'active', current_period_start: periodStart, current_period_end: periodEnd, updated_at: nowISO }).eq('id', existingSub.id);
    } else {
      await supabase.from('subscriptions').insert([{ tenant_id: tenantId, plan_id: planId, status: 'active', started_at: nowISO, current_period_start: periodStart, current_period_end: periodEnd, auto_renew: true, created_at: nowISO, updated_at: nowISO }]);
    }
    await supabase.from('tenants').update({ status: 'active', is_provisioned: true, provisioned_at: nowISO, updated_at: nowISO }).eq('id', tenantId);
  }
  getSubscriptionStatus(tenantId);
}

async function sendApprovalEmail(requestRow: any, verifiedAt: string): Promise<void> {
  try {
    const settingsRaw = loadRawSettings();
    let recipient = '';
    if (db) {
      const user = db.prepare('SELECT email FROM users WHERE id = ?').get(requestRow.requested_by || 0) as any;
      recipient = user?.email || '';
    } else {
      const supabase = getSupabase();
      if (supabase) {
        const { data: user } = await supabase.from('users').select('email').eq('id', requestRow.requested_by).maybeSingle();
        recipient = user?.email || '';
      }
    }
    if (recipient) {
      void sendEmailDirect(
        `[Great Olive] Paiement validé`,
        buildPaymentVerifiedEmailHTML(requestRow.voucher_code, verifiedAt),
        settingsRaw, recipient,
      );
    }
  } catch (mailErr) {
    console.error('[AdminSubscriptions] Email send error (verify):', mailErr);
  }
}

async function sendRejectionEmail(requestRow: any, reason: string, rejectedAt: string): Promise<void> {
  try {
    const settingsRaw = loadRawSettings();
    let recipient = '';
    if (db) {
      const user = db.prepare('SELECT email FROM users WHERE id = ?').get(requestRow.requested_by || 0) as any;
      recipient = user?.email || '';
    } else {
      const supabase = getSupabase();
      if (supabase) {
        const { data: user } = await supabase.from('users').select('email').eq('id', requestRow.requested_by).maybeSingle();
        recipient = user?.email || '';
      }
    }
    if (recipient) {
      void sendEmailDirect(
        `[Great Olive] Paiement rejeté`,
        buildPaymentRejectedEmailHTML(requestRow.voucher_code, reason, rejectedAt),
        settingsRaw, recipient,
      );
    }
  } catch (mailErr) {
    console.error('[AdminSubscriptions] Email send error (reject):', mailErr);
  }
}

// ── /api/admin/subscriptions/pending — Legacy (returns all by default) ─────────
router.get('/pending', async (req: any, res: any) => {
  try {
    const statusFilter = String(req.query.status || 'pending');
    const supabase = getSupabase();
    const localDb = db;
    let rows: any[] = [];
    if (localDb) {
      const sql = `SELECT * FROM subscription_payment_requests WHERE status = ? ORDER BY created_at DESC LIMIT 200`;
      rows = localDb.prepare(sql).all(statusFilter) as any[];
    } else if (supabase) {
      const { data, error } = await supabase.from('subscription_payment_requests').select('*, tenant:tenants(name), plans(name)').eq('status', statusFilter).order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      rows = data || [];
    }
    res.json({ requests: rows });
  } catch (e: any) {
    console.error('[AdminSubscriptions] GET /pending error:', e);
    res.status(500).json({ error: 'Erreur lors du chargement des demandes.' });
  }
});

// ── POST /api/admin/subscriptions/verify — Legacy verify ──────────────────────
router.post('/verify', async (req: Request, res: Response) => {
  const id = Number(req.body?.requestId);
  if (!id) return res.status(400).json({ error: 'requestId requis' });
  try {
    const requestRow = await getRequestRow(id);
    if (!requestRow) return res.status(404).json({ error: 'Demande introuvable.' });
    if (!['pending', 'payment_sent'].includes(requestRow.status)) {
      return res.status(400).json({ error: `Statut invalide: ${requestRow.status}. Vérification impossible.` });
    }
    const adminUserId = (req as any).user?.sub || (req as any).user?.id || null;
    const now = new Date();
    const nowISO = now.toISOString();
    const supabase = getSupabase();
    const localDb = db;
    if (localDb) {
      const localTx = () => {
        localDb.prepare(`UPDATE subscription_payment_requests SET status = 'verified', verified_by = ?, verified_at = ?, updated_at = ? WHERE id = ?`).run(adminUserId, nowISO, nowISO, id);
        const reqRow = localDb.prepare('SELECT * FROM subscription_payment_requests WHERE id = ?').get(id) as any;
        queueSyncChange('subscription_payment_request', 'update', { ...reqRow, status: 'verified', verified_by: adminUserId, verified_at: nowISO });
      };
      withOutboxTransaction(localDb, String(requestRow.tenant_id), localTx);
    } else if (supabase) {
      await supabase.from('subscription_payment_requests').update({ status: 'verified', verified_by: adminUserId, verified_at: nowISO, updated_at: nowISO }).eq('id', id);
    }
    await activateTenantSub(requestRow.tenant_id, requestRow.plan_id, adminUserId, nowISO);
    await sendApprovalEmail(requestRow, nowISO);
    res.json({ ok: true, message: 'Demande vérifiée. Abonnement activé.', requestId: id });
  } catch (e: any) {
    console.error('[AdminSubscriptions] verify error:', e);
    res.status(500).json({ error: e?.message || 'Erreur serveur' });
  }
});

// ── POST /api/admin/subscriptions/reject — Legacy reject ──────────────────────
router.post('/reject', async (req: Request, res: Response) => {
  const id = Number(req.body?.requestId);
  const reason = String(req.body?.reason || '');
  if (!id) return res.status(400).json({ error: 'requestId requis' });
  try {
    const requestRow = await getRequestRow(id);
    if (!requestRow) return res.status(404).json({ error: 'Demande introuvable.' });
    if (!['pending', 'payment_sent'].includes(requestRow.status)) {
      return res.status(400).json({ error: `Statut invalide: ${requestRow.status}. Rejet impossible.` });
    }
    const now = new Date();
    const nowISO = now.toISOString();
    const supabase = getSupabase();
    const localDb = db;
    if (localDb) {
      withOutboxTransaction(localDb, String(requestRow.tenant_id), () => {
        localDb.prepare(`UPDATE subscription_payment_requests SET status = 'rejected', rejection_reason = ?, updated_at = ? WHERE id = ?`).run(reason || null, nowISO, id);
        const reqRow = localDb.prepare('SELECT * FROM subscription_payment_requests WHERE id = ?').get(id) as any;
        queueSyncChange('subscription_payment_request', 'update', { ...reqRow, status: 'rejected', rejection_reason: reason || null, updated_at: nowISO });
      });
    } else if (supabase) {
      await supabase.from('subscription_payment_requests').update({ status: 'rejected', rejection_reason: reason || null, updated_at: nowISO }).eq('id', id);
    }
    const subStatus = db?.prepare(`SELECT status FROM subscriptions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1`).get(requestRow.tenant_id) as any;
    if (!subStatus || ['active', 'trial', 'pending'].includes(subStatus?.status)) {
      db?.prepare(`UPDATE subscriptions SET status = 'suspended', updated_at = ? WHERE tenant_id = ?`).run(nowISO, requestRow.tenant_id);
    }
    db?.prepare(`UPDATE tenants SET status = 'suspended', updated_at = ? WHERE id = ?`).run(nowISO, requestRow.tenant_id);
    if (supabase) {
      const { data: sub } = await supabase.from('subscriptions').select('id, status').eq('tenant_id', requestRow.tenant_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (sub && ['active', 'trial', 'pending'].includes(sub.status)) {
        await supabase.from('subscriptions').update({ status: 'suspended', updated_at: nowISO }).eq('id', sub.id);
      }
      await supabase.from('tenants').update({ status: 'suspended', updated_at: nowISO }).eq('id', requestRow.tenant_id);
    }
    await sendRejectionEmail(requestRow, reason || 'Raison non précisée', nowISO);
    res.json({ ok: true, message: 'Demande rejetée.', requestId: id });
  } catch (e: any) {
    console.error('[AdminSubscriptions] reject error:', e);
    res.status(500).json({ error: e?.message || 'Erreur serveur' });
  }
});

// ── /api/admin/vouchers — Clean API (GET / GET /pending / GET /verified / GET /expired) ──
subRouter.get('/', async (_req: any, res: any) => {
  try {
    const supabase = getSupabase();
    const localDb = db;
    let rows: any[] = [];
    if (localDb) {
      rows = localDb.prepare(`SELECT * FROM subscription_payment_requests ORDER BY created_at DESC LIMIT 200`).all() as any[];
    } else if (supabase) {
      const { data, error } = await supabase.from('subscription_payment_requests').select('*, tenant:tenants(name), plans(name)').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      rows = data || [];
    }
    res.json({ requests: rows });
  } catch (e: any) {
    console.error('[AdminVouchers] GET / error:', e);
    res.status(500).json({ error: 'Erreur lors du chargement des demandes.' });
  }
});

subRouter.get('/pending', async (_req: any, res: any) => {
  try {
    const supabase = getSupabase();
    const localDb = db;
    let rows: any[] = [];
    if (localDb) {
      rows = localDb.prepare(`SELECT * FROM subscription_payment_requests WHERE status = 'pending' ORDER BY created_at DESC LIMIT 200`).all() as any[];
    } else if (supabase) {
      const { data, error } = await supabase.from('subscription_payment_requests').select('*, tenant:tenants(name), plans(name)').eq('status', 'pending').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      rows = data || [];
    }
    res.json({ requests: rows });
  } catch (e: any) {
    console.error('[AdminVouchers] GET pending error:', e);
    res.status(500).json({ error: 'Erreur lors du chargement des demandes en attente.' });
  }
});

subRouter.get('/verified', async (_req: any, res: any) => {
  try {
    const supabase = getSupabase();
    const localDb = db;
    let rows: any[] = [];
    if (localDb) {
      rows = localDb.prepare(`SELECT * FROM subscription_payment_requests WHERE status = 'verified' ORDER BY created_at DESC LIMIT 200`).all() as any[];
    } else if (supabase) {
      const { data, error } = await supabase.from('subscription_payment_requests').select('*, tenant:tenants(name), plans(name)').eq('status', 'verified').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      rows = data || [];
    }
    res.json({ requests: rows });
  } catch (e: any) {
    console.error('[AdminVouchers] GET verified error:', e);
    res.status(500).json({ error: 'Erreur lors du chargement des demandes vérifiées.' });
  }
});

subRouter.get('/expired', async (_req: any, res: any) => {
  try {
    const supabase = getSupabase();
    const localDb = db;
    let rows: any[] = [];
    if (localDb) {
      rows = localDb.prepare(`SELECT * FROM subscription_payment_requests WHERE status = 'expired' ORDER BY created_at DESC LIMIT 200`).all() as any[];
    } else if (supabase) {
      const { data, error } = await supabase.from('subscription_payment_requests').select('*, tenant:tenants(name), plans(name)').eq('status', 'expired').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      rows = data || [];
    }
    res.json({ requests: rows });
  } catch (e: any) {
    console.error('[AdminVouchers] GET expired error:', e);
    res.status(500).json({ error: 'Erreur lors du chargement des demandes expirées.' });
  }
});

subRouter.get('/rejected', async (_req: any, res: any) => {
  try {
    const supabase = getSupabase();
    const localDb = db;
    let rows: any[] = [];
    if (localDb) {
      rows = localDb.prepare(`SELECT * FROM subscription_payment_requests WHERE status = 'rejected' ORDER BY created_at DESC LIMIT 200`).all() as any[];
    } else if (supabase) {
      const { data, error } = await supabase.from('subscription_payment_requests').select('*, tenant:tenants(name), plans(name)').eq('status', 'rejected').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      rows = data || [];
    }
    res.json({ requests: rows });
  } catch (e: any) {
    console.error('[AdminVouchers] GET rejected error:', e);
    res.status(500).json({ error: 'Erreur lors du chargement des demandes rejetées.' });
  }
});

// POST /api/admin/vouchers/verify
subRouter.post('/verify', async (req: Request, res: Response) => {
  const id = Number(req.body?.requestId);
  if (!id) return res.status(400).json({ error: 'requestId requis' });
  try {
    const requestRow = await getRequestRow(id);
    if (!requestRow) return res.status(404).json({ error: 'Demande introuvable.' });
    if (!['pending', 'payment_sent'].includes(requestRow.status)) {
      return res.status(400).json({ error: `Statut invalide: ${requestRow.status}. Vérification impossible.` });
    }
    const adminUserId = (req as any).user?.sub || (req as any).user?.id || null;
    const now = new Date();
    const nowISO = now.toISOString();
    if (db) {
      const localTx = () => {
        db.prepare(`UPDATE subscription_payment_requests SET status = 'verified', verified_by = ?, verified_at = ?, updated_at = ? WHERE id = ?`).run(adminUserId, nowISO, nowISO, id);
        const reqRow = db.prepare('SELECT * FROM subscription_payment_requests WHERE id = ?').get(id) as any;
        queueSyncChange('subscription_payment_request', 'update', { ...reqRow, status: 'verified', verified_by: adminUserId, verified_at: nowISO });
      };
      withOutboxTransaction(db, String(requestRow.tenant_id), localTx);
    } else {
      const supabase = getSupabase();
      if (supabase) {
        await supabase.from('subscription_payment_requests').update({ status: 'verified', verified_by: adminUserId, verified_at: nowISO, updated_at: nowISO }).eq('id', id);
      }
    }
    await activateTenantSub(requestRow.tenant_id, requestRow.plan_id, adminUserId, nowISO);
    await sendApprovalEmail(requestRow, nowISO);
    res.json({ ok: true, message: 'Demande vérifiée. Abonnement activé.', requestId: id });
  } catch (e: any) {
    console.error('[AdminVouchers] verify error:', e);
    res.status(500).json({ error: e?.message || 'Erreur serveur' });
  }
});

// POST /api/admin/vouchers/reject
subRouter.post('/reject', async (req: Request, res: Response) => {
  const id = Number(req.body?.requestId);
  const reason = String(req.body?.reason || '');
  if (!id) return res.status(400).json({ error: 'requestId requis' });
  try {
    const requestRow = await getRequestRow(id);
    if (!requestRow) return res.status(404).json({ error: 'Demande introuvable.' });
    if (!['pending', 'payment_sent'].includes(requestRow.status)) {
      return res.status(400).json({ error: `Statut invalide: ${requestRow.status}. Rejet impossible.` });
    }
    const now = new Date();
    const nowISO = now.toISOString();
    if (db) {
      withOutboxTransaction(db, String(requestRow.tenant_id), () => {
        db.prepare(`UPDATE subscription_payment_requests SET status = 'rejected', rejection_reason = ?, updated_at = ? WHERE id = ?`).run(reason || null, nowISO, id);
        const reqRow = db.prepare('SELECT * FROM subscription_payment_requests WHERE id = ?').get(id) as any;
        queueSyncChange('subscription_payment_request', 'update', { ...reqRow, status: 'rejected', rejection_reason: reason || null, updated_at: nowISO });
      });
    } else {
      const supabase = getSupabase();
      if (supabase) {
        await supabase.from('subscription_payment_requests').update({ status: 'rejected', rejection_reason: reason || null, updated_at: nowISO }).eq('id', id);
      }
    }
    const subStatus = db?.prepare(`SELECT status FROM subscriptions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1`).get(requestRow.tenant_id) as any;
    if (!subStatus || ['active', 'trial', 'pending'].includes(subStatus?.status)) {
      db?.prepare(`UPDATE subscriptions SET status = 'suspended', updated_at = ? WHERE tenant_id = ?`).run(nowISO, requestRow.tenant_id);
    }
    db?.prepare(`UPDATE tenants SET status = 'suspended', updated_at = ? WHERE id = ?`).run(nowISO, requestRow.tenant_id);
    if (getSupabase()) {
      const supabase = getSupabase()!;
      const { data: sub } = await supabase.from('subscriptions').select('id, status').eq('tenant_id', requestRow.tenant_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (sub && ['active', 'trial', 'pending'].includes(sub.status)) {
        await supabase.from('subscriptions').update({ status: 'suspended', updated_at: nowISO }).eq('id', sub.id);
      }
      await supabase.from('tenants').update({ status: 'suspended', updated_at: nowISO }).eq('id', requestRow.tenant_id);
    }
    await sendRejectionEmail(requestRow, reason || 'Raison non précisée', nowISO);
    res.json({ ok: true, message: 'Demande rejetée.', requestId: id });
  } catch (e: any) {
    console.error('[AdminVouchers] reject error:', e);
    res.status(500).json({ error: e?.message || 'Erreur serveur' });
  }
});


export { router as adminSubscriptionsRouter, subRouter as adminVouchersRouter };
