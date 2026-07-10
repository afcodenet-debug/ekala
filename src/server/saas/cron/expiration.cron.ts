// =============================================================================
// CRON JOB — Expiration automatique
// =============================================================================
// Exécution: Toutes les 5 minutes
// Actions:
//   1. Expirer les vouchers dont verification_deadline est dépassée
//   2. Expirer les abonnements dont current_period_end est dépassé
//   3. Suspendre les tenants dont l'abonnement est expiré
// =============================================================================

import { db } from '../../db/database';
import { sendEmailDirect, loadRawSettings } from '../../services/notification.service';
import { buildVoucherExpiredEmail } from '../../services/email-templates';

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

const CRON_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

if (!db) {
  console.warn('[ExpirationCron] Local DB unavailable — cron disabled (Supabase-only mode).');
}

function hasTable(tableName: string): boolean {
  if (!db) return false;
  try {
    const row = db.prepare(`
      SELECT 1
      FROM sqlite_master
      WHERE type = 'table' AND name = ?
      LIMIT 1
    `).get(tableName) as any;
    return !!row;
  } catch {
    return false;
  }
}

/**
 * Expire les vouchers dont la deadline est dépassée
 */
async function expireVouchers(): Promise<number> {
  if (!db) return 0;
  try {
    const now = new Date().toISOString();
    
    // Trouver les vouchers à expirer
    const expiredVouchers = db.prepare(`
      SELECT *
      FROM voucher_requests
      WHERE status = 'pending'
        AND verification_deadline < ?
    `).all(now) as Array<any>;
    
    if (expiredVouchers.length === 0) return 0;
    
    // Marquer comme expirés (par lot)
    const ids = expiredVouchers.map((v: any) => v.id);
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`
      UPDATE voucher_requests
      SET status = 'expired',
          updated_at = ?
      WHERE id IN (${placeholders})
    `).run(now, ...ids);

    // Envoyer emails (best-effort) — ne bloque pas si des mails échouent
    for (const voucher of expiredVouchers) {
      try {
        const settingsRaw = loadRawSettings();
        const tenant = db.prepare(`SELECT * FROM tenants WHERE id = ?`).get(voucher.tenant_id) as any;
        const plan = db.prepare(`SELECT * FROM plans WHERE id = ?`).get(voucher.plan_id) as any;
        
        if (tenant && plan && voucher.customer_email) {
          void sendEmailDirect(
            `[${tenant.name}] Voucher expiré — ${plan.name}`,
            buildVoucherExpiredEmail(voucher.voucher_code, plan, new Date(), tenant.name),
            settingsRaw,
            voucher.customer_email
          );
        }
      } catch (mailErr) {
        console.error('[ExpirationCron] Email send error:', mailErr);
      }
    }
    
    console.log(`[ExpirationCron] ${expiredVouchers.length} vouchers expirés`);
    return expiredVouchers.length;
  } catch (error) {
    console.error('[ExpirationCron] Error expiring vouchers:', error);
    return 0;
  }
}

/**
 * Expire les abonnements dont la période est terminée
 */
async function expireSubscriptions(): Promise<number> {
  if (!db) return 0;
  try {
    const now = new Date().toISOString();

    // Guard: éviter le crash si les tables n’existent pas
    if (!hasTable('subscriptions')) return 0;

    // Trouver les abonnements actifs dont la période est terminée
    const expiredSubscriptions = db.prepare(`
      SELECT *
      FROM subscriptions
      WHERE status = 'active'
        AND current_period_end < ?
    `).all(now) as Array<any>;

    if (expiredSubscriptions.length === 0) return 0;

    // Marquer comme expirés (par lot)
    const subIds = expiredSubscriptions.map((s: any) => s.id);
    const placeholders = subIds.map(() => '?').join(',');
    db.prepare(`
      UPDATE subscriptions
      SET status = 'expired',
          updated_at = ?
      WHERE id IN (${placeholders})
    `).run(now, ...subIds);

    // Suspendre les tenants + désactiver tenant_users (si tables dispo)
    const tenantIds = Array.from(new Set(expiredSubscriptions.map((s: any) => s.tenant_id)));
    const tenantPlaceholders = tenantIds.map(() => '?').join(',');

    if (hasTable('tenants')) {
      db.prepare(`
        UPDATE tenants
        SET status = 'suspended',
            updated_at = ?
        WHERE id IN (${tenantPlaceholders})
      `).run(now, ...tenantIds);
    }

    if (hasTable('tenant_users')) {
      db.prepare(`
        UPDATE tenant_users
        SET is_active = 0,
            updated_at = ?
        WHERE tenant_id IN (${tenantPlaceholders})
      `).run(now, ...tenantIds);
    }

    console.log(`[ExpirationCron] ${expiredSubscriptions.length} abonnements expirés`);
    return expiredSubscriptions.length;
  } catch (error) {
    console.error('[ExpirationCron] Error expiring subscriptions:', error);
    return 0;
  }
}

/**
 * Nettoie les vieux logs d'audit (> 90 jours)
 */
async function cleanupOldLogs(): Promise<number> {
  if (!db) return 0;
  try {
    // Guard: éviter le crash si la table n’existe pas
    if (!hasTable('billing_audit_logs')) return 0;

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const info = db.prepare(`
      DELETE FROM billing_audit_logs
      WHERE created_at < ?
    `).run(ninetyDaysAgo) as any;

    const result = typeof info?.changes === 'number' ? info.changes : 0;
    if (result > 0) {
      console.log(`[ExpirationCron] ${result} vieux logs nettoyés`);
    }

    return result;
  } catch (error) {
    console.error('[ExpirationCron] Error cleaning logs:', error);
    return 0;
  }
}

/**
 * Exécute toutes les tâches d'expiration
 */
export async function runExpirationCron(): Promise<void> {
  if (isRunning) {
    console.log('[ExpirationCron] Already running, skipping...');
    return;
  }
  
  isRunning = true;
  console.log('[ExpirationCron] Starting expiration cron job...');
  
  try {
    const [expiredVouchers, expiredSubscriptions, cleanedLogs] = await Promise.all([
      expireVouchers(),
      expireSubscriptions(),
      cleanupOldLogs(),
    ]);
    
    console.log(`[ExpirationCron] Completed: ${expiredVouchers} vouchers, ${expiredSubscriptions} subscriptions, ${cleanedLogs} logs cleaned`);
  } catch (error) {
    console.error('[ExpirationCron] Fatal error:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Démarre le cron job
 */
export function startExpirationCron(): void {
  if (intervalId) {
    console.log('[ExpirationCron] Already started');
    return;
  }
  
  console.log(`[ExpirationCron] Starting cron (interval: ${CRON_INTERVAL_MS / 1000}s)`);
  
  // Exécuter immédiatement au démarrage
  runExpirationCron();
  
  // Puis toutes les 5 minutes
  intervalId = setInterval(() => {
    runExpirationCron();
  }, CRON_INTERVAL_MS);
}

/**
 * Arrête le cron job
 */
export function stopExpirationCron(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[ExpirationCron] Stopped');
  }
}