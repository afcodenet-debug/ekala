// =============================================================================
// Phase 3 — Subscription Expiration Cron
// =============================================================================
// Toutes les heures :
//  1. Marque les abonnements `active` dont `current_period_end` est passé comme `expired`
//  2. Marque les abonnements `trial` dont `trial_ends_at` est passé comme `expired`
//  3. Suspend les tenants dont l'abonnement actif a expiré
//  4. Envoie une notification email (TODO Phase 4)
// =============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../config/env';

const CRON_INTERVAL_MS = 60 * 60 * 1000; // 1 heure

let _timer: NodeJS.Timeout | null = null;
let _supabase: SupabaseClient | null = null;

function db(): SupabaseClient | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  if (!_supabase) {
    _supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
    });
  }
  return _supabase;
}

export interface ExpirationResult {
  subscriptions_expired: number;
  trials_expired: number;
  tenants_suspended: number;
  errors: string[];
  duration_ms: number;
  started_at: string;
  finished_at: string;
}

async function runExpirationCheck(): Promise<ExpirationResult> {
  const start = Date.now();
  const result: ExpirationResult = {
    subscriptions_expired: 0,
    trials_expired: 0,
    tenants_suspended: 0,
    errors: [],
    duration_ms: 0,
    started_at: new Date(start).toISOString(),
    finished_at: '',
  };

  const supabase = db();
  if (!supabase) {
    result.errors.push('Supabase not configured — cron skipped');
    result.finished_at = new Date().toISOString();
    return result;
  }

  const now = new Date().toISOString();

  // 1. Abonnements actifs expirés
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .update({ status: 'expired' })
      .eq('status', 'active')
      .lt('current_period_end', now)
      .select('id, tenant_id');
    if (error) {
      result.errors.push(`subscriptions.active→expired: ${error.message}`);
    } else {
      result.subscriptions_expired = (data || []).length;
    }
  } catch (e: any) {
    result.errors.push(`subscriptions.active: ${e.message}`);
  }

  // 2. Trials expirés
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .update({ status: 'expired' })
      .eq('status', 'trial')
      .lt('trial_ends_at', now)
      .select('id, tenant_id');
    if (error) {
      result.errors.push(`subscriptions.trial→expired: ${error.message}`);
    } else {
      result.trials_expired = (data || []).length;
    }
  } catch (e: any) {
    result.errors.push(`subscriptions.trial: ${e.message}`);
  }

  // 3. Suspend les tenants dont l'abonnement est expiré (et qui n'ont pas d'autre sub active)
  try {
    const { data: expiredTenants, error: e1 } = await supabase
      .from('subscriptions')
      .select('tenant_id')
      .eq('status', 'expired');
    if (e1) {
      result.errors.push(`tenants.select expired: ${e1.message}`);
    } else if (expiredTenants && expiredTenants.length > 0) {
      // Trouve les tenants qui n'ont AUCUN abonnement actif
      const tenantIds = Array.from(new Set(expiredTenants.map((r: any) => r.tenant_id)));
      for (const tid of tenantIds) {
        const { data: activeSubs } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('tenant_id', tid)
          .in('status', ['active', 'trial'])
          .limit(1);
        if (!activeSubs || activeSubs.length === 0) {
          // Pas d'abonnement actif → suspend le tenant
          const { error: e2 } = await supabase
            .from('tenants')
            .update({ status: 'suspended' })
            .eq('id', tid)
            .neq('status', 'cancelled');
          if (!e2) result.tenants_suspended++;
          else result.errors.push(`tenant.suspend ${tid}: ${e2.message}`);
        }
      }
    }
  } catch (e: any) {
    result.errors.push(`tenants.suspend: ${e.message}`);
  }

  const end = Date.now();
  result.duration_ms = end - start;
  result.finished_at = new Date(end).toISOString();
  return result;
}

export function startSubscriptionExpirationCron(): void {
  if (_timer) {
    console.log('[SubscriptionCron] Already running');
    return;
  }
  const enabled = (process.env.SAAS_CRON_ENABLED || 'true') !== 'false';
  if (!enabled) {
    console.log('[SubscriptionCron] Disabled by env var SAAS_CRON_ENABLED=false');
    return;
  }
  console.log(`[SubscriptionCron] Starting (every ${CRON_INTERVAL_MS / 1000}s)`);
  // Exécute immédiatement puis toutes les heures
  runExpirationCheck()
    .then(r => console.log('[SubscriptionCron] Initial check:', JSON.stringify(r)))
    .catch(err => console.error('[SubscriptionCron] Initial check error:', err));
  _timer = setInterval(() => {
    runExpirationCheck()
      .then(r => console.log('[SubscriptionCron] Tick:', JSON.stringify(r)))
      .catch(err => console.error('[SubscriptionCron] Tick error:', err));
  }, CRON_INTERVAL_MS);
}

export function stopSubscriptionExpirationCron(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    console.log('[SubscriptionCron] Stopped');
  }
}

// Expose pour tests manuels
export { runExpirationCheck };