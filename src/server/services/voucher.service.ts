// =============================================================================
// VoucherService — Voucher-First Billing (Phase 4)
// =============================================================================
// Responsabilités:
//  - createVoucherRequest(tenantId, planId, customerEmail, requestedBy)
//  - verifyVoucher(requestId, adminUserId)
//  - rejectVoucher(requestId, reason, adminUserId)
//  - expireOldRequests()
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { db } from '../db/database';

export function getSupabase(): SupabaseClient | null {
  const { env } = require('../config/env');
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createClient } = require('@supabase/supabase-js');
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
  });
}

export function generateVoucherCode(tenantId: number): string {
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `EKA-${tenantId}-${rand}`;
}

export async function createVoucherRequest(params: {
  tenantId: number;
  planId: number;
  customerEmail: string;
  requestedBy?: number;
}): Promise<{ code: string; id: number } | null> {
  const { tenantId, planId, customerEmail, requestedBy = 0 } = params;
  const now = new Date();
  const verificationDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const nowISO = now.toISOString();

  let code = generateVoucherCode(tenantId);
  const localDb = db;

  if (localDb) {
    let attempts = 0;
    while (attempts < 8) {
      try {
        const result = localDb.prepare(`
          INSERT INTO voucher_requests
            (tenant_id, plan_id, voucher_code, customer_email, requested_by, status, requested_at, verification_deadline, expires_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
        `).run(tenantId, planId, code, customerEmail, requestedBy, nowISO, verificationDeadline.toISOString(), expiresAt.toISOString(), nowISO, nowISO);
        return { code, id: Number(result.lastInsertRowid) };
      } catch (e: any) {
        attempts++;
        if (e?.message?.includes('UNIQUE constraint')) {
          code = generateVoucherCode(tenantId);
          continue;
        }
        console.error('[VoucherService] local create error:', e);
        return null;
      }
    }
    return null;
  }

  const supabase = getSupabase();
  if (!supabase) return null;
  let attempts = 0;
  while (attempts < 8) {
    code = generateVoucherCode(tenantId);
    const insertResult = await supabase.from('voucher_requests').insert([{
      tenant_id: tenantId, plan_id: planId, voucher_code: code,
      customer_email: customerEmail, requested_by: requestedBy || null,
      status: 'pending', requested_at: nowISO,
      verification_deadline: verificationDeadline.toISOString(),
      expires_at: expiresAt.toISOString(),
    }]).select().single();
    const { data, error } = insertResult;
    if (!error && data) return { code, id: data.id };
    if (error?.message?.includes('duplicate key') || error?.code === '23505') { attempts++; continue; }
    console.error('[VoucherService] supabase create error:', error);
    return null;
  }
  return null;
}

export async function verifyVoucher(requestId: number, _adminUserId: number): Promise<boolean> {
  const supabase = getSupabase();
  const localDb = db;
  const now = new Date();
  const nowISO = now.toISOString();

  let row: any = null;
  if (localDb) {
    row = localDb.prepare('SELECT * FROM voucher_requests WHERE id = ?').get(requestId) as any;
  } else if (supabase) {
    const { data } = await supabase.from('voucher_requests').select('*').eq('id', requestId).maybeSingle();
    row = data || null;
  }
  if (!row) return false;
  if (!['pending', 'payment_sent'].includes(row.status)) return false;

  if (localDb) {
    localDb.prepare(`UPDATE voucher_requests SET status = 'verified', verified_at = ?, updated_at = ? WHERE id = ?`).run(nowISO, nowISO, requestId);
  } else if (supabase) {
    await supabase.from('voucher_requests').update({ status: 'verified', updated_at: nowISO }).eq('id', requestId);
  }

  // Activer abonnement + tenant
  if (localDb) {
    const sub = localDb.prepare(`SELECT id, status FROM subscriptions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1`).get(row.tenant_id) as any;
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    if (sub && ['active', 'trial', 'past_due', 'pending'].includes(sub.status)) {
      localDb.prepare(`UPDATE subscriptions SET status = 'active', current_period_start = ?, current_period_end = ?, updated_at = ? WHERE id = ?`).run(nowISO, periodEnd, nowISO, sub.id);
    } else if (!sub) {
      localDb.prepare(`INSERT INTO subscriptions (tenant_id, plan_id, status, started_at, current_period_start, current_period_end, auto_renew, created_at, updated_at) VALUES (?, ?, 'active', ?, ?, ?, 1, ?, ?)`).run(row.tenant_id, row.plan_id, nowISO, nowISO, periodEnd, nowISO, nowISO);
    }
    localDb.prepare(`UPDATE tenants SET status = 'active', is_provisioned = 1, provisioned_at = ?, updated_at = ? WHERE id = ?`).run(nowISO, nowISO, row.tenant_id);
  } else if (supabase) {
    const { data: existingSub } = await supabase.from('subscriptions').select('id').eq('tenant_id', row.tenant_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const periodStart = nowISO;
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    if (existingSub) {
      await supabase.from('subscriptions').update({ status: 'active', current_period_start: periodStart, current_period_end: periodEnd, updated_at: nowISO }).eq('id', existingSub.id);
    } else {
      await supabase.from('subscriptions').insert([{ tenant_id: row.tenant_id, plan_id: row.plan_id, status: 'active', started_at: nowISO, current_period_start: periodStart, current_period_end: periodEnd, auto_renew: true, created_at: nowISO, updated_at: nowISO }]);
    }
    await supabase.from('tenants').update({ status: 'active', is_provisioned: true, provisioned_at: nowISO, updated_at: nowISO }).eq('id', row.tenant_id);
  }
  return true;
}

export async function rejectVoucher(requestId: number, reason: string = '', _adminUserId: number = 0): Promise<boolean> {
  const supabase = getSupabase();
  const localDb = db;
  const now = new Date();
  const nowISO = now.toISOString();

  let tenantId = 0;
  if (localDb) {
    const row = localDb.prepare('SELECT * FROM voucher_requests WHERE id = ?').get(requestId) as any;
    if (!row) return false;
    tenantId = row.tenant_id;
    localDb.prepare(`UPDATE voucher_requests SET status = 'rejected', rejection_reason = ?, updated_at = ? WHERE id = ?`).run(reason || null, nowISO, requestId);
    const subStatus = localDb.prepare(`SELECT status FROM subscriptions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1`).get(tenantId) as any;
    if (!subStatus || ['active', 'trial', 'pending'].includes(subStatus?.status)) {
      localDb.prepare(`UPDATE subscriptions SET status = 'suspended', updated_at = ? WHERE tenant_id = ?`).run(nowISO, tenantId);
    }
    localDb.prepare(`UPDATE tenants SET status = 'suspended', updated_at = ? WHERE id = ?`).run(nowISO, tenantId);
  } else if (supabase) {
    const { data } = await supabase.from('voucher_requests').select('tenant_id').eq('id', requestId).maybeSingle();
    if (!data) return false;
    tenantId = data.tenant_id;
    await supabase.from('voucher_requests').update({ status: 'rejected', rejection_reason: reason || null, updated_at: nowISO }).eq('id', requestId);
    const { data: sub } = await supabase.from('subscriptions').select('id, status').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (sub && ['active', 'trial', 'pending'].includes(sub.status)) {
      await supabase.from('subscriptions').update({ status: 'suspended', updated_at: nowISO }).eq('id', sub.id);
    }
    await supabase.from('tenants').update({ status: 'suspended', updated_at: nowISO }).eq('id', tenantId);
  }
  return true;
}

export async function expireOldRequests(): Promise<{ expired: number; errors: string[] }> {
  const supabase = getSupabase();
  const localDb = db;
  const now = new Date().toISOString();
  const errors: string[] = [];
  let expiredCount = 0;

  if (localDb) {
    const rows = localDb.prepare(`SELECT * FROM voucher_requests WHERE status IN ('pending', 'payment_sent') AND verification_deadline < ?`).all(now) as any[];
    expiredCount = rows.length;
    for (const row of rows) {
      try {
        localDb.prepare(`UPDATE voucher_requests SET status = 'expired', updated_at = ? WHERE id = ?`).run(now, row.id);
        const subStatus = localDb.prepare(`SELECT status FROM subscriptions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1`).get(row.tenant_id) as any;
        if (!subStatus || ['active', 'trial', 'pending'].includes(subStatus?.status)) {
          localDb.prepare(`UPDATE subscriptions SET status = 'suspended', updated_at = ? WHERE tenant_id = ?`).run(now, row.tenant_id);
        }
        localDb.prepare(`UPDATE tenants SET status = 'suspended', updated_at = ? WHERE id = ?`).run(now, row.tenant_id);
      } catch (e: any) {
        errors.push(`request ${row.id}: ${e.message}`);
      }
    }
  } else if (supabase) {
    const { data: expiredRequests } = await supabase.from('voucher_requests').select('*').in('status', ['pending', 'payment_sent']).lt('verification_deadline', now);
    expiredCount = (expiredRequests || []).length;
    for (const row of expiredRequests || []) {
      try {
        await supabase.from('voucher_requests').update({ status: 'expired', updated_at: now }).eq('id', row.id);
        const { data: sub } = await supabase.from('subscriptions').select('id, status').eq('tenant_id', row.tenant_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (sub && ['active', 'trial', 'pending'].includes(sub.status)) {
          await supabase.from('subscriptions').update({ status: 'suspended', updated_at: now }).eq('id', sub.id);
        }
        await supabase.from('tenants').update({ status: 'suspended', updated_at: now }).eq('id', row.tenant_id);
      } catch (e: any) {
        errors.push(`request ${row.id}: ${e.message}`);
      }
    }
  }
  return { expired: expiredCount, errors };
}
