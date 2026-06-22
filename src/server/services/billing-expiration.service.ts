// =============================================================================
// Billing Expiration Service — Gestion automatique de l'expiration des vouchers
// =============================================================================
// Compte à rebours de 2 heures pour chaque voucher généré
// Si non validé → status = expired + compte suspendu
// =============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import { sendEmailDirect, loadRawSettings } from './notification.service';
import { buildVoucherExpiredEmail } from './email-templates';

function getSupabase(): SupabaseClient | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
  });
}

export interface ExpirationResult {
  expired: number;
  errors: string[];
  notificationsSent: number;
}

/**
 * Service d'expiration automatique des vouchers
 * 
 * Fonctionnalités:
 * - Vérifie les vouchers dont verification_deadline est dépassée
 * - Met à jour le status vers 'expired'
 * - Suspend le tenant et l'abonnement
 * - Envoie un email de notification
 * - Log l'événement
 * 
 * Compte à rebours: 2 heures (configurable via VOUCHER_EXPIRATION_HOURS)
 */
export class BillingExpirationService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    this.supabase = getSupabase();
  }

  /**
   * Traite l'expiration des vouchers pour un tenant spécifique
   */
  async expireTenantVouchers(tenantId: number): Promise<ExpirationResult> {
    const result: ExpirationResult = {
      expired: 0,
      errors: [],
      notificationsSent: 0,
    };

    if (!this.supabase) {
      result.errors.push('Supabase non configuré');
      return result;
    }

    try {
      // 1. Récupérer les vouchers expirés pour ce tenant
      const now = new Date().toISOString();
      const { data: expiredVouchers, error: selectError } = await this.supabase
        .from('voucher_requests')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('status', ['pending', 'payment_sent'])
        .lt('verification_deadline', now)
        .limit(100);

      if (selectError) {
        result.errors.push(`Erreur sélection: ${selectError.message}`);
        return result;
      }

      if (!expiredVouchers || expiredVouchers.length === 0) {
        return result; // Aucun voucher à expirer
      }

      // 2. Traiter chaque voucher expiré
      for (const voucher of expiredVouchers) {
        try {
          // Mettre à jour le status vers 'expired'
          const { error: updateError } = await this.supabase
            .from('voucher_requests')
            .update({
              status: 'expired',
              updated_at: now,
            })
            .eq('id', voucher.id);

          if (updateError) {
            result.errors.push(`Voucher #${voucher.id}: ${updateError.message}`);
            continue;
          }

          // 3. Suspendre le tenant
          const { error: tenantError } = await this.supabase
            .from('tenants')
            .update({
              status: 'suspended',
              updated_at: now,
            })
            .eq('id', tenantId)
            .neq('status', 'cancelled');

          if (tenantError) {
            result.errors.push(`Tenant #${tenantId}: ${tenantError.message}`);
          }

          // 4. Suspendre l'abonnement actif
          const { data: activeSubs } = await this.supabase
            .from('subscriptions')
            .select('id')
            .eq('tenant_id', tenantId)
            .in('status', ['active', 'trial', 'past_due', 'pending'])
            .limit(1);

          if (activeSubs && activeSubs.length > 0) {
            const { error: subError } = await this.supabase
              .from('subscriptions')
              .update({
                status: 'suspended',
                updated_at: now,
              })
              .eq('id', activeSubs[0].id);

            if (subError) {
              result.errors.push(`Subscription #${activeSubs[0].id}: ${subError.message}`);
            }
          }

          // 5. Envoyer email de notification (best-effort)
          try {
            if (voucher.customer_email) {
              const { data: plan } = await this.supabase
                .from('plans')
                .select('name')
                .eq('id', voucher.plan_id)
                .maybeSingle();

              if (plan) {
                void sendEmailDirect(
                  `[Great Olive] Demande de paiement expirée — ${plan.name}`,
                  buildVoucherExpiredEmail(voucher.voucher_code, plan, new Date(now)),
                  loadRawSettings(),
                  voucher.customer_email,
                );
                result.notificationsSent++;
              }
            }
          } catch (mailErr) {
            console.error(`[BillingExpiration] Email error for voucher #${voucher.id}:`, mailErr);
            // Ne pas bloquer l'expiration si l'email échoue
          }

          // 6. Logger l'événement
          console.log(`[BillingExpiration] Voucher #${voucher.id} (${voucher.voucher_code}) expiré pour tenant #${tenantId}`);

          result.expired++;
        } catch (err: any) {
          result.errors.push(`Voucher #${voucher.id}: ${err.message}`);
        }
      }
    } catch (err: any) {
      result.errors.push(`Erreur générale: ${err.message}`);
    }

    return result;
  }

  /**
   * Traite l'expiration des vouchers pour tous les tenants
   * Utilisé par le cron job
   */
  async expireAllVouchers(): Promise<ExpirationResult> {
    const result: ExpirationResult = {
      expired: 0,
      errors: [],
      notificationsSent: 0,
    };

    if (!this.supabase) {
      result.errors.push('Supabase non configuré');
      return result;
    }

    try {
      // Récupérer tous les tenants avec des vouchers expirés
      const now = new Date().toISOString();
      const { data: expiredVouchers, error: selectError } = await this.supabase
        .from('voucher_requests')
        .select('tenant_id, id, voucher_code, customer_email, plan_id')
        .in('status', ['pending', 'payment_sent'])
        .lt('verification_deadline', now)
        .limit(500);

      if (selectError) {
        result.errors.push(`Erreur sélection: ${selectError.message}`);
        return result;
      }

      if (!expiredVouchers || expiredVouchers.length === 0) {
        return result;
      }

      // Grouper par tenant_id
      const tenantMap = new Map<number, typeof expiredVouchers>();
      for (const voucher of expiredVouchers) {
        const existing = tenantMap.get(voucher.tenant_id) || [];
        existing.push(voucher);
        tenantMap.set(voucher.tenant_id, existing);
      }

      // Traiter chaque tenant
      for (const [tenantId, vouchers] of tenantMap) {
        const tenantResult = await this.expireTenantVouchers(tenantId);
        result.expired += tenantResult.expired;
        result.errors.push(...tenantResult.errors);
        result.notificationsSent += tenantResult.notificationsSent;
      }
    } catch (err: any) {
      result.errors.push(`Erreur générale: ${err.message}`);
    }

    return result;
  }

  /**
   * Vérifie si un voucher spécifique est expiré
   */
  async isVoucherExpired(voucherCode: string, tenantId: number): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      const { data, error } = await this.supabase
        .from('voucher_requests')
        .select('verification_deadline, status')
        .eq('voucher_code', voucherCode)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error || !data) return false;

      const now = new Date();
      const deadline = new Date(data.verification_deadline);
      
      return (
        ['pending', 'payment_sent'].includes(data.status) &&
        deadline < now
      );
    } catch {
      return false;
    }
  }

  /**
   * Calcule le temps restant avant expiration
   */
  calculateTimeRemaining(verificationDeadline: string): {
    hours: number;
    minutes: number;
    seconds: number;
    expired: boolean;
  } {
    const now = new Date().getTime();
    const deadline = new Date(verificationDeadline).getTime();
    const distance = deadline - now;

    if (distance < 0) {
      return { hours: 0, minutes: 0, seconds: 0, expired: true };
    }

    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    return { hours, minutes, seconds, expired: false };
  }
}

// Export singleton instance
export const billingExpirationService = new BillingExpirationService();