// =============================================================================
// VoucherService — Voucher-First Billing (Phase 4)
// =============================================================================
// Responsabilités:
//  - createVoucherRequest(tenantId, planId, customerEmail, requestedBy)
//  - verifyVoucher(requestId, adminUserId)
//  - rejectVoucher(requestId, reason, adminUserId)
//  - expireOldRequests()
// =============================================================================

import { db } from '../db/database';
import { SqliteOutboxRepository } from '../infrastructure/synchronization/outbox-repository';
import { OutboxEventType } from '../infrastructure/synchronization/outbox-event-types';
import { OutboxStatus } from '../infrastructure/synchronization/outbox-repository';

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

  // Outbox-Only: Enqueue event instead of direct Supabase write
  const outbox = new SqliteOutboxRepository(db);
  const idempotencyKey = `voucher_create_${tenantId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  try {
    await outbox.enqueue({
      eventType: OutboxEventType.VOUCHER_CREATED,
      entity: 'voucher_requests',
      recordId: tenantId,
      payload: JSON.stringify({
        tenant_id: tenantId,
        plan_id: planId,
        voucher_code: code,
        customer_email: customerEmail,
        requested_by: requestedBy || null,
        status: 'pending',
        requested_at: nowISO,
        verification_deadline: verificationDeadline.toISOString(),
        expires_at: expiresAt.toISOString(),
      }),
      idempotencyKey,
      status: OutboxStatus.PENDING,
      retryCount: 0,
      maxRetries: 3,
      nextRetryAt: new Date(Date.now() + 1000),
      error: null,
      createdAt: new Date(),
      processedAt: null,
    });
    
    // Return optimistic ID (will be replaced by actual ID when worker processes)
    return { code, id: 0 };
  } catch (e: any) {
    console.error('[VoucherService] outbox enqueue error:', e);
    return null;
  }
}

export async function verifyVoucher(requestId: number, _adminUserId: number): Promise<boolean> {
  const localDb = db;
  const now = new Date();
  const nowISO = now.toISOString();

  let row: any = null;
  if (localDb) {
    row = localDb.prepare('SELECT * FROM voucher_requests WHERE id = ?').get(requestId) as any;
  } else {
    // Outbox-Only: Read from Supabase directly (reads are allowed)
    const { createClient } = require('@supabase/supabase-js');
    const { env } = require('../config/env');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
    });
    const { data } = await supabase.from('voucher_requests').select('*').eq('id', requestId).maybeSingle();
    row = data || null;
  }
  if (!row) return false;
  if (!['pending', 'payment_sent'].includes(row.status)) return false;

  // Outbox-Only: Enqueue verification event
  const outbox = new SqliteOutboxRepository(db);
  const idempotencyKey = `voucher_verify_${requestId}_${Date.now()}`;
  
  try {
    await outbox.enqueue({
      eventType: OutboxEventType.VOUCHER_VERIFIED,
      entity: 'voucher_requests',
      recordId: requestId,
      payload: JSON.stringify({
        status: 'verified',
        verified_at: nowISO,
        updated_at: nowISO,
        tenant_id: row.tenant_id,
        plan_id: row.plan_id,
      }),
      idempotencyKey,
      status: OutboxStatus.PENDING,
      retryCount: 0,
      maxRetries: 3,
      nextRetryAt: new Date(Date.now() + 1000),
      error: null,
      createdAt: new Date(),
      processedAt: null,
    });
    return true;
  } catch (e: any) {
    console.error('[VoucherService] outbox enqueue error:', e);
    return false;
  }
}

export async function rejectVoucher(requestId: number, reason: string = '', _adminUserId: number = 0): Promise<boolean> {
  const localDb = db;
  const now = new Date();
  const nowISO = now.toISOString();

  let tenantId = 0;
  let row: any = null;
  
  if (localDb) {
    row = localDb.prepare('SELECT * FROM voucher_requests WHERE id = ?').get(requestId) as any;
    if (!row) return false;
    tenantId = row.tenant_id;
    localDb.prepare(`UPDATE voucher_requests SET status = 'rejected', rejection_reason = ?, updated_at = ? WHERE id = ?`).run(reason || null, nowISO, requestId);
    const subStatus = localDb.prepare(`SELECT status FROM subscriptions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1`).get(tenantId) as any;
    if (!subStatus || ['active', 'trial', 'pending'].includes(subStatus?.status)) {
      localDb.prepare(`UPDATE subscriptions SET status = 'suspended', updated_at = ? WHERE tenant_id = ?`).run(nowISO, tenantId);
    }
    localDb.prepare(`UPDATE tenants SET status = 'suspended', updated_at = ? WHERE id = ?`).run(nowISO, tenantId);
  } else {
    // Outbox-Only: Read from Supabase for tenant_id
    const { createClient } = require('@supabase/supabase-js');
    const { env } = require('../config/env');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
    });
    const { data } = await supabase.from('voucher_requests').select('tenant_id').eq('id', requestId).maybeSingle();
    if (!data) return false;
    tenantId = data.tenant_id;
    
    // Outbox-Only: Enqueue rejection event
    const outbox = new SqliteOutboxRepository(db);
    const idempotencyKey = `voucher_reject_${requestId}_${Date.now()}`;
    
    try {
      await outbox.enqueue({
        eventType: OutboxEventType.VOUCHER_REJECTED,
        entity: 'voucher_requests',
        recordId: requestId,
        payload: JSON.stringify({
          status: 'rejected',
          rejection_reason: reason || null,
          updated_at: nowISO,
          tenant_id: tenantId,
        }),
        idempotencyKey,
        status: OutboxStatus.PENDING,
        retryCount: 0,
        maxRetries: 3,
        nextRetryAt: new Date(Date.now() + 1000),
        error: null,
        createdAt: new Date(),
        processedAt: null,
      });
    } catch (e: any) {
      console.error('[VoucherService] outbox enqueue error:', e);
      return false;
    }
  }
  return true;
}

export async function expireOldRequests(): Promise<{ expired: number; errors: string[] }> {
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
        localDb.prepare(`UPDATE tenants SET status = 'suspended', updated_at = ? WHERE id = ?`).run(now, row.id);
      } catch (e: any) {
        errors.push(`request ${row.id}: ${e.message}`);
      }
    }
  } else {
    // Outbox-Only: Read expired requests from Supabase
    const { createClient } = require('@supabase/supabase-js');
    const { env } = require('../config/env');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
    });
    
    const { data: expiredRequests } = await supabase.from('voucher_requests').select('*').in('status', ['pending', 'payment_sent']).lt('verification_deadline', now);
    expiredCount = (expiredRequests || []).length;
    
    // Outbox-Only: Enqueue expiration events
    const outbox = new SqliteOutboxRepository(db);
    for (const row of expiredRequests || []) {
      try {
        const idempotencyKey = `voucher_expire_${row.id}_${Date.now()}`;
        await outbox.enqueue({
          eventType: OutboxEventType.VOUCHER_EXPIRED,
          entity: 'voucher_requests',
          recordId: row.id,
          payload: JSON.stringify({
            status: 'expired',
            updated_at: now,
            tenant_id: row.tenant_id,
          }),
          idempotencyKey,
          status: OutboxStatus.PENDING,
          retryCount: 0,
          maxRetries: 3,
          nextRetryAt: new Date(Date.now() + 1000),
          error: null,
          createdAt: new Date(),
          processedAt: null,
        });
      } catch (e: any) {
        errors.push(`request ${row.id}: ${e.message}`);
      }
    }
  }
  return { expired: expiredCount, errors };
}