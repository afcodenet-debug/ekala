// =============================================================================
// Phase 3 — Payment Provider Types
// =============================================================================
// Abstraction for multiple payment providers (Mobile Money, Stripe, Paystack).
// Each provider implements the same interface so the SaaS layer can stay
// provider-agnostic.
// =============================================================================

import type { PaymentMethod } from '../types/saas.types';

export type PaymentProviderMode = 'mock' | 'live';

export interface CheckoutInput {
  tenant_id: number;
  subscription_id: number;
  plan_id: number;
  amount_cents: number;
  currency: string;
  payment_method: PaymentMethod;
  payment_provider?: string;     // 'mtn_zm' | 'airtel_zm' | 'stripe' | 'paystack' etc.
  customer_email: string;
  customer_phone?: string;
  customer_name?: string;
  description: string;
  metadata?: Record<string, any>;
  // URLs de retour (frontend)
  success_url?: string;
  cancel_url?: string;
}

export interface CheckoutResult {
  payment_id: string;           // ID local du paiement
  provider_reference: string;   // ID chez le provider
  status: 'pending' | 'processing' | 'completed' | 'failed';
  redirect_url?: string;        // URL où rediriger l'utilisateur (Stripe Checkout, etc.)
  ussd_code?: string;           // Code USSD pour Mobile Money (optionnel)
  instructions?: string;        // Instructions affichées à l'utilisateur
  expires_at?: string;          // Date d'expiration de la session de paiement
}

export interface PaymentStatusResult {
  payment_id: string;
  provider_reference: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  paid_at?: string;
  amount_cents: number;
  currency: string;
  raw?: any;                    // Réponse brute du provider
}

export interface WebhookEvent {
  event_type: 'payment.succeeded' | 'payment.failed' | 'payment.refunded' | 'payment.cancelled';
  provider_reference: string;
  amount_cents?: number;
  currency?: string;
  status?: string;
  paid_at?: string;
  raw: any;
}

// =============================================================================
// Interface PaymentProvider (à implémenter par chaque provider)
// =============================================================================

export interface PaymentProvider {
  readonly name: string;
  readonly mode: PaymentProviderMode;

  /** Initie une session de paiement. Retourne une URL de redirection ou des instructions. */
  checkout(input: CheckoutInput): Promise<CheckoutResult>;

  /** Vérifie le statut d'un paiement chez le provider. */
  getStatus(providerReference: string): Promise<PaymentStatusResult>;

  /** Confirme un paiement (utile en mode mock pour simuler un webhook). */
  confirm?(providerReference: string): Promise<PaymentStatusResult>;

  /** Traite un webhook entrant du provider. */
  handleWebhook?(headers: Record<string, string>, body: any): Promise<WebhookEvent | null>;
}