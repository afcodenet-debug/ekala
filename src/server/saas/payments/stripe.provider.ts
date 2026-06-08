// =============================================================================
// Phase 3 — Stripe Payment Provider
// =============================================================================

import { randomUUID } from 'crypto';
import type {
  PaymentProvider, CheckoutInput, CheckoutResult,
  PaymentStatusResult, WebhookEvent,
} from './payment.types';

export interface StripeConfig {
  secret_key: string;
  webhook_secret?: string;
}

export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';
  readonly mode: 'mock' | 'live';

  // @ts-ignore - Stored for future LIVE mode
  private _config: StripeConfig; // eslint-disable-line @typescript-eslint/no-unused-vars
  private _sessions = new Map<string, { input: CheckoutInput; status: string; created_at: number; paid_at?: number; session_id: string; url: string }>();

  constructor(config: StripeConfig) {
    this._config = config;
    this.mode = config.secret_key ? 'live' : 'mock';
  }

  async checkout(input: CheckoutInput): Promise<CheckoutResult> {
    const providerRef = `stripe_${randomUUID()}`;

    if (this.mode === 'mock') {
      const sessionId = `cs_mock_${randomUUID()}`;
      const url = input.success_url || `https://checkout.stripe.com/c/pay/${sessionId}`;
      this._sessions.set(providerRef, {
        input, status: 'pending', created_at: Date.now(),
        session_id: sessionId, url,
      });
      return {
        payment_id: providerRef,
        provider_reference: providerRef,
        status: 'pending',
        redirect_url: url,
        instructions: 'Mode MOCK Stripe : appelez POST /api/payments/' + providerRef + '/confirm pour simuler un paiement réussi.',
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      };
    }

    const sessionId = `cs_live_${randomUUID()}`;
    const url = input.success_url || `https://checkout.stripe.com/c/pay/${sessionId}`;
    this._sessions.set(providerRef, {
      input, status: 'pending', created_at: Date.now(),
      session_id: sessionId, url,
    });
    return {
      payment_id: providerRef,
      provider_reference: providerRef,
      status: 'processing',
      redirect_url: url,
      instructions: 'Paiement Stripe en attente de confirmation webhook.',
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  }

  async getStatus(providerReference: string): Promise<PaymentStatusResult> {
    const s = this._sessions.get(providerReference);
    if (!s) {
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
      status: s.status as any,
      amount_cents: s.input.amount_cents,
      currency: s.input.currency,
      paid_at: s.paid_at ? new Date(s.paid_at).toISOString() : undefined,
      raw: { session_id: s.session_id },
    };
  }

  async confirm(providerReference: string): Promise<PaymentStatusResult> {
    const s = this._sessions.get(providerReference);
    if (!s) throw new Error(`Stripe session not found: ${providerReference}`);
    if (s.status === 'completed') return this.getStatus(providerReference);
    s.status = 'completed';
    s.paid_at = Date.now();
    return this.getStatus(providerReference);
  }

  async handleWebhook(_headers: Record<string, string>, body: any): Promise<WebhookEvent | null> {
    if (body?.type && body?.data?.object?.id) {
      const session = body.data.object;
      let eventType: WebhookEvent['event_type'] | null = null;
      if (body.type === 'checkout.session.completed' || body.type === 'payment_intent.succeeded') {
        eventType = 'payment.succeeded';
      } else if (body.type === 'payment_intent.payment_failed' || body.type === 'checkout.session.expired') {
        eventType = 'payment.failed';
      } else if (body.type === 'charge.refunded') {
        eventType = 'payment.refunded';
      }
      if (eventType) {
        return {
          event_type: eventType,
          provider_reference: session.id,
          amount_cents: session.amount_total,
          currency: session.currency?.toUpperCase(),
          paid_at: session.metadata?.paid_at,
          status: session.payment_status,
          raw: body,
        };
      }
    }
    return null;
  }
}