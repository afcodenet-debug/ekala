// =============================================================================
// Phase 3 — Mock Payment Provider
// =============================================================================
// Simulates a real payment provider for development/testing.
// In mock mode, payments are immediately confirmed after a short delay.
// The user can also call /confirm to manually trigger confirmation.
// =============================================================================

import { randomUUID } from 'crypto';
import type {
  PaymentProvider, CheckoutInput, CheckoutResult,
  PaymentStatusResult, WebhookEvent,
} from './payment.types';

// Store en mémoire des paiements mock (process-local)
const _mockPayments = new Map<string, { input: CheckoutInput; status: string; created_at: number; paid_at?: number }>();

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  readonly mode = 'mock' as const;

  async checkout(input: CheckoutInput): Promise<CheckoutResult> {
    const providerRef = `mock_${randomUUID()}`;
    _mockPayments.set(providerRef, {
      input,
      status: 'pending',
      created_at: Date.now(),
    });
    console.log(`[MockPayment] Created pending payment ${providerRef} for ${input.amount_cents} ${input.currency}`);
    return {
      payment_id: providerRef,
      provider_reference: providerRef,
      status: 'pending',
      instructions: 'Mode MOCK : appelez POST /api/payments/' + providerRef + '/confirm pour simuler un paiement réussi.',
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  }

  async getStatus(providerReference: string): Promise<PaymentStatusResult> {
    const p = _mockPayments.get(providerReference);
    if (!p) {
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
      status: p.status as any,
      amount_cents: p.input.amount_cents,
      currency: p.input.currency,
      paid_at: p.paid_at ? new Date(p.paid_at).toISOString() : undefined,
      raw: { mock: true, input: p.input },
    };
  }

  /** Confirme manuellement le paiement (utilisé pour simuler un webhook). */
  async confirm(providerReference: string): Promise<PaymentStatusResult> {
    const p = _mockPayments.get(providerReference);
    if (!p) throw new Error(`Mock payment not found: ${providerReference}`);
    if (p.status === 'completed') {
      return this.getStatus(providerReference);
    }
    p.status = 'completed';
    p.paid_at = Date.now();
    console.log(`[MockPayment] Confirmed payment ${providerReference}`);
    return this.getStatus(providerReference);
  }

  async handleWebhook(_headers: Record<string, string>, body: any): Promise<WebhookEvent | null> {
    if (body?.event && body?.provider_reference) {
      return {
        event_type: body.event,
        provider_reference: body.provider_reference,
        paid_at: body.paid_at,
        raw: body,
      };
    }
    return null;
  }

  /** Helper pour les tests : liste tous les paiements mock. */
  static _list() {
    return Array.from(_mockPayments.entries());
  }
}