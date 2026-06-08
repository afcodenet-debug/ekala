// =============================================================================
// Phase 3 — Mobile Money Payment Provider
// =============================================================================
// Supports MTN MoMo, Airtel Money, Zamtel Kwacha (Zambia).
// In MOCK mode, behaves like the mock provider (USSD instructions returned).
// In LIVE mode, requires provider-specific API credentials.
// =============================================================================

import { randomUUID } from 'crypto';
import type {
  PaymentProvider, CheckoutInput, CheckoutResult,
  PaymentStatusResult, WebhookEvent,
} from './payment.types';

export type MobileMoneyOperator = 'mtn_zm' | 'airtel_zm' | 'zamtel_zm';

export interface MobileMoneyConfig {
  mtn_zm?: { api_key: string; subscription_key: string; environment?: 'sandbox' | 'production' };
  airtel_zm?: { client_id: string; client_secret: string; environment?: 'sandbox' | 'production' };
  zamtel_zm?: { api_key: string; environment?: 'sandbox' | 'production' };
}

const USSD_CODES: Record<MobileMoneyOperator, string> = {
  mtn_zm: '*165#',
  airtel_zm: '*115#',
  zamtel_zm: '*567#',
};

const OPERATOR_LABELS: Record<MobileMoneyOperator, string> = {
  mtn_zm: 'MTN MoMo Zambia',
  airtel_zm: 'Airtel Money Zambia',
  zamtel_zm: 'Zamtel Kwacha',
};

export class MobileMoneyPaymentProvider implements PaymentProvider {
  readonly name = 'mobile_money';
  readonly mode: 'mock' | 'live';

  // @ts-ignore - Stored for future LIVE mode
  private _config: MobileMoneyConfig; // eslint-disable-line @typescript-eslint/no-unused-vars
  private _transactions = new Map<string, { input: CheckoutInput; operator: MobileMoneyOperator; status: string; created_at: number; paid_at?: number; reference: string }>();

  constructor(config: MobileMoneyConfig = {}) {
    this._config = config;
    this.mode = (config.mtn_zm || config.airtel_zm || config.zamtel_zm) ? 'live' : 'mock';
  }

  async checkout(input: CheckoutInput): Promise<CheckoutResult> {
    const operator = (input.payment_provider as MobileMoneyOperator) || 'mtn_zm';
    const providerRef = `mm_${operator}_${randomUUID()}`;
    const reference = randomUUID();

    this._transactions.set(providerRef, {
      input, operator, status: 'pending', created_at: Date.now(), reference,
    });

    const ussd = USSD_CODES[operator];
    const opLabel = OPERATOR_LABELS[operator];
    const amount = (input.amount_cents / 100).toFixed(2);
    const currency = input.currency;

    return {
      payment_id: providerRef,
      provider_reference: providerRef,
      status: 'pending',
      ussd_code: ussd,
      instructions: `Paiement ${opLabel} : Composez ${ussd} et confirmez le paiement de ${currency} ${amount}. Référence: ${reference}.`,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }

  async getStatus(providerReference: string): Promise<PaymentStatusResult> {
    const t = this._transactions.get(providerReference);
    if (!t) {
      return {
        payment_id: providerReference,
        provider_reference: providerReference,
        status: 'failed',
        amount_cents: 0,
        currency: 'ZMW',
        raw: { error: 'NOT_FOUND' },
      };
    }
    return {
      payment_id: providerReference,
      provider_reference: providerReference,
      status: t.status as any,
      amount_cents: t.input.amount_cents,
      currency: t.input.currency,
      paid_at: t.paid_at ? new Date(t.paid_at).toISOString() : undefined,
      raw: { operator: t.operator, reference: t.reference },
    };
  }

  async confirm(providerReference: string): Promise<PaymentStatusResult> {
    const t = this._transactions.get(providerReference);
    if (!t) throw new Error(`Mobile Money transaction not found: ${providerReference}`);
    if (t.status === 'completed') return this.getStatus(providerReference);
    t.status = 'completed';
    t.paid_at = Date.now();
    return this.getStatus(providerReference);
  }

  async handleWebhook(_headers: Record<string, string>, body: any): Promise<WebhookEvent | null> {
    if (body?.referenceId && body?.status) {
      const eventType = body.status === 'SUCCESSFUL' || body.status === 'TS'
        ? 'payment.succeeded' : 'payment.failed';
      return {
        event_type: eventType,
        provider_reference: body.referenceId,
        amount_cents: body.amount,
        currency: body.currency,
        paid_at: body.paid_at,
        status: body.status,
        raw: body,
      };
    }
    return null;
  }
}