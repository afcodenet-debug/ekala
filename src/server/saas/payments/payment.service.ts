// =============================================================================
// Phase 3 — Payment Service (Factory)
// =============================================================================
// Picks the right PaymentProvider based on payment_method + payment_provider.
// Lazy-loads providers so missing API keys don't break the boot.
// =============================================================================

import type { PaymentMethod } from '../types/saas.types';
import type { PaymentProvider, CheckoutInput, CheckoutResult, PaymentStatusResult, WebhookEvent } from './payment.types';
import { MockPaymentProvider } from './mock.provider';
import { StripePaymentProvider } from './stripe.provider';
import { MobileMoneyPaymentProvider } from './mobile-money.provider';

export class PaymentService {
  private static _mock: MockPaymentProvider | null = null;
  private static _stripe: StripePaymentProvider | null = null;
  private static _mobileMoney: MobileMoneyPaymentProvider | null = null;

  /** Sélectionne le provider approprié en fonction de la méthode + provider. */
  static pick(method: PaymentMethod, providerCode?: string): PaymentProvider {
    // Mobile Money
    if (method === 'mobile_money' || (providerCode && /^(mtn_zm|airtel_zm|zamtel_zm)$/.test(providerCode))) {
      if (!this._mobileMoney) {
        const cfg: any = {};
        if (process.env.MTN_MOMO_API_KEY && process.env.MTN_MOMO_SUBSCRIPTION_KEY) {
          cfg.mtn_zm = { api_key: process.env.MTN_MOMO_API_KEY, subscription_key: process.env.MTN_MOMO_SUBSCRIPTION_KEY, environment: 'sandbox' };
        }
        if (process.env.AIRTEL_MOMO_CLIENT_ID && process.env.AIRTEL_MOMO_CLIENT_SECRET) {
          cfg.airtel_zm = { client_id: process.env.AIRTEL_MOMO_CLIENT_ID, client_secret: process.env.AIRTEL_MOMO_CLIENT_SECRET, environment: 'sandbox' };
        }
        this._mobileMoney = new MobileMoneyPaymentProvider(cfg);
      }
      return this._mobileMoney;
    }

    // Card via Stripe ou Paystack
    if (method === 'card' || method === 'stripe' || providerCode === 'stripe') {
      if (!this._stripe) {
        const secret = process.env.STRIPE_SECRET_KEY || '';
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        this._stripe = new StripePaymentProvider({ secret_key: secret, webhook_secret: webhookSecret });
      }
      return this._stripe;
    }

    if (method === 'paystack' || providerCode === 'paystack') {
      // Pour l'instant, fallback sur Stripe (à spécialiser plus tard)
      if (!this._stripe) {
        this._stripe = new StripePaymentProvider({ secret_key: process.env.STRIPE_SECRET_KEY || '' });
      }
      return this._stripe;
    }

    // Méthodes non-paiement (cash, bank_transfer, other) : mock par défaut
    if (!this._mock) this._mock = new MockPaymentProvider();
    return this._mock;
  }

  static async checkout(method: PaymentMethod, providerCode: string | undefined, input: CheckoutInput): Promise<CheckoutResult> {
    return this.pick(method, providerCode).checkout(input);
  }

  static async getStatus(method: PaymentMethod, providerCode: string | undefined, providerReference: string): Promise<PaymentStatusResult> {
    return this.pick(method, providerCode).getStatus(providerReference);
  }

  static async confirm(method: PaymentMethod, providerCode: string | undefined, providerReference: string): Promise<PaymentStatusResult> {
    const p = this.pick(method, providerCode);
    if (!p.confirm) {
      throw new SaaSPaymentError('Ce provider ne supporte pas la confirmation manuelle', 400, 'CONFIRM_NOT_SUPPORTED');
    }
    return p.confirm(providerReference);
  }

  static async handleWebhook(provider: 'stripe' | 'paystack' | 'mobile_money', headers: Record<string, string>, body: any): Promise<WebhookEvent | null> {
    let p: PaymentProvider;
    if (provider === 'stripe') {
      p = this.pick('card', 'stripe');
    } else if (provider === 'mobile_money') {
      p = this.pick('mobile_money', 'mtn_zm');
    } else {
      p = this.pick('paystack', 'paystack');
    }
    if (!p.handleWebhook) return null;
    return p.handleWebhook(headers, body);
  }

  static status() {
    return {
      mode: (process.env.PAYMENT_MODE || 'mock') as 'mock' | 'live',
      providers: {
        mock: !!this._mock || true,
        stripe: { configured: !!process.env.STRIPE_SECRET_KEY, mode: process.env.STRIPE_SECRET_KEY ? 'live' : 'mock' },
        mobile_money: {
          mtn_zm: { configured: !!process.env.MTN_MOMO_API_KEY },
          airtel_zm: { configured: !!process.env.AIRTEL_MOMO_CLIENT_ID },
          zamtel_zm: { configured: !!process.env.ZAMTEL_MOMO_API_KEY },
        },
      },
    };
  }
}

export class SaaSPaymentError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode = 400, code = 'PAYMENT_ERROR') {
    super(message);
    this.name = 'SaaSPaymentError';
    this.statusCode = statusCode;
    this.code = code;
  }
}