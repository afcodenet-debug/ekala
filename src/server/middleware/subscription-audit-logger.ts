// =============================================================================
// Subscription Audit Logger
// =============================================================================
// Logs all subscription-related access control events for monitoring,
// compliance, and security analysis.
//
// Events logged:
//   - ACCESS_GRANTED    (active/trial)
//   - ACCESS_READ_ONLY  (grace period — read allowed)
//   - ACCESS_DENIED     (write blocked in grace)
//   - ACCESS_BLOCKED    (suspended/cancelled/expired/no_plan)
//   - CACHE_HIT / CACHE_MISS
// =============================================================================

import { SubscriptionGuardResult, SubscriptionState } from './subscription-guard';

// ── Types ──────────────────────────────────────────────────────────────────────

export type AuditEventType =
  | 'ACCESS_GRANTED'
  | 'ACCESS_READ_ONLY'
  | 'ACCESS_DENIED_WRITE'
  | 'ACCESS_BLOCKED'
  | 'SUBSCRIPTION_CHECK_FAILED'
  | 'CACHE_HIT'
  | 'CACHE_MISS';

export interface AuditLogEntry {
  timestamp: string;
  event: AuditEventType;
  tenantId: number;
  userId?: number;
  subscriptionState: SubscriptionState;
  method: string;
  path: string;
  ip: string | undefined;
  planName: string | null;
  graceDaysRemaining: number | null;
  userAgent?: string;
}

// ── In-memory ring buffer (last 500 entries) ───────────────────────────────────

const MAX_ENTRIES = 500;
const auditBuffer: AuditLogEntry[] = [];

// ── Log entry ──────────────────────────────────────────────────────────────────

export function logSubscriptionEvent(params: {
  event: AuditEventType;
  tenantId: number;
  userId?: number;
  subscription: SubscriptionGuardResult;
  method: string;
  path: string;
  ip: string | undefined;
  userAgent?: string;
}): void {
  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    event: params.event,
    tenantId: params.tenantId,
    userId: params.userId,
    subscriptionState: params.subscription.state,
    method: params.method,
    path: params.path,
    ip: params.ip,
    planName: params.subscription.planName,
    graceDaysRemaining: params.subscription.graceDaysRemaining,
    userAgent: params.userAgent,
  };

  // Ring buffer
  if (auditBuffer.length >= MAX_ENTRIES) auditBuffer.shift();
  auditBuffer.push(entry);

  // Console output with structured format
  const level =(params.event === 'ACCESS_BLOCKED' || params.event === 'ACCESS_DENIED_WRITE')
    ? 'WARN'
    : params.event === 'SUBSCRIPTION_CHECK_FAILED'
      ? 'ERROR'
      : 'INFO';

  console[level === 'WARN' ? 'warn' : level === 'ERROR' ? 'error' : 'log'](
    `[SubAudit] ${entry.event} | tenant=${entry.tenantId} user=${entry.userId ?? '?'} ` +
    `state=${entry.subscriptionState} ${entry.method} ${entry.path} ip=${entry.ip ?? '?'}`
  );
}

// ── Retrieve recent entries (for admin endpoint) ───────────────────────────────

export function getRecentAuditEntries(limit: number = 50): AuditLogEntry[] {
  return auditBuffer.slice(-limit);
}

// ── Get stats ──────────────────────────────────────────────────────────────────

export function getAuditStats(): {
  total: number;
  byEvent: Record<string, number>;
  recentBlocks: number;
} {
  const byEvent: Record<string, number> = {};
  let recentBlocks = 0;
  const oneHourAgo = Date.now() - 3_600_000;

  for (const e of auditBuffer) {
    byEvent[e.event] = (byEvent[e.event] || 0) + 1;
    if (
      (e.event === 'ACCESS_BLOCKED' || e.event === 'ACCESS_DENIED_WRITE') &&
      new Date(e.timestamp).getTime() > oneHourAgo
    ) {
      recentBlocks++;
    }
  }

  return { total: auditBuffer.length, byEvent, recentBlocks };
}

// ── Clear buffer (admin use) ───────────────────────────────────────────────────

export function clearAuditBuffer(): void {
  auditBuffer.length = 0;
}