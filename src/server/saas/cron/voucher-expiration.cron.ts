// =============================================================================
// Voucher Request Expiration Cron — Runs every 5 minutes
// =============================================================================
// Expires vouchers where verification_deadline is past:
//  - subscription_payment_requests (legacy)
//  - voucher_requests (clean canonical)
// Suspends tenants/subscriptions when vouchers expire.
// =============================================================================

import { billingExpirationService } from '../../services/billing-expiration.service';

let _timer: NodeJS.Timeout | null = null;

async function runExpiration(): Promise<{ expired: number; errors: string[]; notificationsSent: number }> {
  try {
    const result = await billingExpirationService.expireAllVouchers();
    return {
      expired: result.expired,
      errors: result.errors,
      notificationsSent: result.notificationsSent,
    };
  } catch (e: any) {
    console.error('[VoucherExpirationCron] Error:', e);
    return { expired: 0, errors: [e.message], notificationsSent: 0 };
  }
}

export function startVoucherExpirationCron(): void {
  if (_timer) return;
  const enabled = (process.env.VOUCHER_EXPIRATION_CRON_ENABLED ?? 'true') !== 'false';
  if (!enabled) return;

  const run = async () => {
    try {
      const result = await runExpiration();
      if (result.expired > 0 || result.errors.length > 0) {
        console.log(`[VoucherExpirationCron]`, {
          expired: result.expired,
          notificationsSent: result.notificationsSent,
          errors: result.errors,
        });
      }
    } catch (e: any) {
      console.error('[VoucherExpirationCron] tick error:', e.message);
    }
  };

  // Exécuter immédiatement au démarrage
  run();
  
  // Puis toutes les 5 minutes
  _timer = setInterval(run, 5 * 60 * 1000);
  console.log('[VoucherExpirationCron] Started (every 5 minutes)');
}

export function stopVoucherExpirationCron(): void {
  if (_timer) { clearInterval(_timer); _timer = null; console.log('[VoucherExpirationCron] Stopped'); }
}
