# Architecture Finale Ekala Billing V2.5 Enterprise

**Version:** 2.5  
**Statut:** Approuvée  
**Date:** 30/06/2026  
**Auteur:** Équipe Architecture  
**Prédécesseur:** V2.4  
**Qualification:** Architecture cible pour scale multi-pays africain

---

## Table des Matières

1. [Évolution V2.4 → V2.5](#1-évolution-v24--v25)
2. [Principes Fondateurs V2.5](#2-principes-fondateurs-v25)
3. [Payment Gateway — Architecture Hexagonale](#3-payment-gateway--architecture-hexagonale)
4. [Payment Orchestrator](#4-payment-orchestrator)
5. [Provider Factory & Adapters](#5-provider-factory--adapters)
6. [Fraud Engine](#6-fraud-engine)
7. [Circuit Breaker — Resilience Pattern](#7-circuit-breaker--resilience-pattern)
8. [Feature Flag Platform](#8-feature-flag-platform)
9. [Billing Read Model](#9-billing-read-model)
10. [Architecture Multi-Région](#10-architecture-multi-région)
11. [Diagramme d'Architecture Complet V2.5](#11-diagramme-darchitecture-complet-v25)
12. [Décisions ADR V2.5](#12-décisions-adr-v25)
13. [Glossaire V2.5](#13-glossaire-v25)

---

## 1. Évolution V2.4 → V2.5

### 1.1 Ce qui est Conservé de V2.4

| Composant | Conservation | Raison |
|-----------|-------------|--------|
| Frontières SQLite / PostgreSQL | ✅ Intégral | Séparation validée |
| Saga Orchestrator | ✅ Intégral | Reprise après crash |
| Outbox + DLQ | ✅ Intégral | Atomicité garantie |
| Webhook Handler Stripe | ✅ Intégral | Source de vérité |
| Accounting Ledger | ✅ Intégral | Conformité OHADA/IFRS |
| Tax Service | ✅ Intégral | Versioning fiscal |
| Currency Service | ✅ Intégral | Multi-devises |
| Subscription Service | ✅ Intégral | Cycle de vie abonnement |
| Offline-First Strategy | ✅ Intégral | POS survit au cloud |
| Sync Engine | ✅ Intégral | Bidirectionnel |

### 1.2 Ce qui est Ajouté en V2.5

| Composant | Type | Priorité |
|-----------|------|----------|
| **Payment Gateway** (Hexagonal) | Architecture | P0 |
| **Payment Orchestrator** | Service | P0 |
| **Provider Factory** | Pattern | P0 |
| **Provider Adapters** (Stripe, MTN, Orange, etc.) | Implémentation | P0 |
| **Fraud Engine** | Service | P1 |
| **Circuit Breaker** (par provider) | Resilience | P1 |
| **Feature Flag Platform** | Infrastructure | P1 |
| **Billing Read Model** | Data | P1 |
| **Multi-Region Architecture** | Infrastructure | P2 |

### 1.3 Scoreboard V2.5

| Domaine | V2.4 | V2.5 | Δ |
|---------|------|------|---|
| Architecture métier | 80/100 | 95/100 | +15 |
| Résilience production | 60/100 | 88/100 | +28 |
| Scale multi-pays | 50/100 | 85/100 | +35 |
| Indépendance fournisseurs | 30/100 | 95/100 | +65 |
| Sécurité / Fraud | 40/100 | 80/100 | +40 |
| **Global** | **60/100** | **90/100** | **+30** |

---

## 2. Principes Fondateurs V2.5

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  PRINCIPES FONDATEURS V2.5                                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. + Hexagonal Architecture : Le cœur métier ignore les providers          │
│  2. + Provider Agnostic : Stripe, MTN, Orange = même interface              │
│  3. + Fail-Fast : Circuit Breaker sur chaque provider                       │
│  4. + Fraud First : Tout paiement suspect est bloqué avant la gateway       │
│  5. + Feature Flag : Chaque provider est activable/désactivable sans déploi │
│  6. + Read Model : Les dashboards ne touchent jamais le ledger              │
│  7. + Multi-Region : Les données restent dans le pays d'origine             │
│  8. + Observability : Chaque provider a des métriques de santé             │
│                                                                              │
│  Les 8 principes de V2.4 restent valides.                                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Payment Gateway — Architecture Hexagonale

### 3.1 Principe

Le **Payment Gateway** est le cœur de V2.5. Il suit le pattern **Ports & Adapters (Hexagonal)** :

- Le **domaine métier** (Billing) ne connaît que des **ports** (interfaces)
- Les **adapters** (Stripe, MTN, Orange, etc.) implémentent ces ports
- Le changement de provider ne modifie **jamais** le code métier

```
┌═══════════════════════════════════════════════════════════════════════════════┐
║                  PAYMENT GATEWAY — ARCHITECTURE HEXAGONALE                    ║
╚═══════════════════════════════════════════════════════════════════════════════╝

                          ┌───────────────────────┐
                          │     BILLING DOMAIN      │
                          │  (Subscription Service, │
                          │   Invoice Service, etc.) │
                          └───────────┬───────────┘
                                      │  Appelle via
                                      ▼
                    ┌─────────────────────────────────────┐
                    │         PAYMENT PORT (Interface)      │
                    │                                     │
                    │  authorize(amount, currency, metadata)│
                    │  capture(paymentId)                   │
                    │  refund(paymentId, amount)            │
                    │  cancel(paymentId)                    │
                    │  status(paymentId)                    │
                    └─────────────────────────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
              ▼                       ▼                       ▼
  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
  │  STRIPE ADAPTER      │  │  MTN ADAPTER         │  │  ORANGE ADAPTER      │
  │                      │  │                      │  │                      │
  │  authorize() →       │  │  authorize() →       │  │  authorize() →       │
  │  Stripe API          │  │  MTN Mobile Money    │  │  Orange Money API    │
  │                      │  │                      │  │                      │
  │  capture() →         │  │  capture() →         │  │  capture() →         │
  │  Stripe API          │  │  Confirmation MTN    │  │  Confirmation Orange  │
  │                      │  │                      │  │                      │
  │  refund() →          │  │  refund() →          │  │  refund() →          │
  │  Stripe API          │  │  MTN API             │  │  Orange API          │
  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘

  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
  │  FLUTTERWAVE ADAPTER │  │  CASH ADAPTER        │  │  VOUCHER ADAPTER     │
  │                      │  │                      │  │                      │
  │  authorize() →       │  │  authorize() →       │  │  authorize() →       │
  │  Flutterwave API     │  │  Génère code caisse  │  │  Vérifie code        │
  │                      │  │                      │  │                      │
  │  capture() →         │  │  capture() →         │  │  capture() →         │
  │  Confirm Flutterwave │  │  Marque payé         │  │  Marque utilisé      │
  │                      │  │                      │  │                      │
  │  refund() →          │  │  refund() →          │  │  refund() →          │
  │  Flutterwave API     │  │  Caisse manuelle     │  │  Réactive code       │
  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

### 3.2 Port Interface — PaymentGateway

```typescript
// =====================================================================
// PAYMENT PORT — Le domaine billing ne dépend que de cette interface
// =====================================================================

interface PaymentGatewayPort {
  // Identifiant unique du provider
  readonly providerName: string;

  // Autorise un paiement (crée une réservation)
  authorize(request: AuthorizeRequest): Promise<AuthorizeResponse>;

  // Capture un paiement autorisé
  capture(paymentId: string): Promise<CaptureResponse>;

  // Rembourse un paiement capturé
  refund(paymentId: string, amount?: Money): Promise<RefundResponse>;

  // Annule une autorisation
  cancel(paymentId: string): Promise<void>;

  // Vérifie le statut d'un paiement
  status(paymentId: string): Promise<PaymentStatus>;

  // Vérifie la santé du provider (utilisé par Circuit Breaker)
  health(): Promise<HealthStatus>;
}

interface AuthorizeRequest {
  idempotencyKey: string;         // Protection double soumission
  tenantId: number;
  amount: Money;                  // Montant en centimes
  currency: string;               // ZMW, USD, XAF, etc.
  metadata: {
    description: string;          // 'Abonnement Pro Mensuel'
    subscriptionId?: number;
    invoiceId?: number;
    customerPhone?: string;       // Pour Mobile Money
    customerEmail?: string;
    returnUrl?: string;           // Pour redirect-based providers
    webhookUrl?: string;          // Pour notifications asynchrones
  };
}

interface Money {
  amount: number;      // En centimes
  currency: string;    // ISO 4217
}

interface AuthorizeResponse {
  success: boolean;
  paymentId: string;             // ID interne
  providerPaymentId: string;     // ID chez le provider
  status: PaymentStatus;
  redirectUrl?: string;          // Pour providers redirect-based
  providerMetadata: Record<string, any>;
  authorizedAt: Date;
}

type PaymentStatus = 
  | 'authorized'       // Réservé, pas encore capturé
  | 'captured'         // Payé avec succès
  | 'failed'           // Échoué
  | 'refunded'         // Remboursé
  | 'partially_refunded'
  | 'cancelled'        // Annulé avant capture
  | 'pending'          // En attente (Mobile Money async)
  | 'expired';         // Timeout
```

---

## 4. Payment Orchestrator

### 4.1 Rôle Central

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    PAYMENT ORCHESTRATOR — RESPONSABILITÉS                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Le Payment Orchestrator est le point d'entrée UNIQUE pour tout paiement.     │
│                                                                              │
│  Ses responsabilités :                                                        │
│  1. Recevoir la demande de paiement (depuis Billing, Subscription, etc.)     │
│  2. Valider les données d'entrée                                              │
│  3. Vérifier l'idempotence (éviter les doublons)                             │
│  4. Exécuter le Fraud Engine (bloquer si suspect)                           │
│  5. Sélectionner le provider via la Provider Factory                         │
│  6. Vérifier le Circuit Breaker du provider                                  │
│  7. Appeler le provider (authorize)                                          │
│  8. Enregistrer le PaymentInProgress dans PostgreSQL                         │
│  9. Déclencher la Saga associée                                              │
│  10. Retourner le résultat (success ou redirect)                             │
│                                                                              │
│  Flux :                                                                       │
│                                                                              │
│  Subscription Service                                                         │
│  Invoice Service                                                              │
│  Voucher Service                                                              │
│       │                                                                       │
│       ▼                                                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │              PAYMENT ORCHESTRATOR                                      │   │
│  │                                                                        │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │ Validation   │→│ Idempotence  │→│ Fraud Engine │→│ Provider    │  │   │
│  │  │             │  │ Check       │  │ Check       │  │ Selector    │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └──────┬──────┘  │   │
│  │                                                              │         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │         │   │
│  │  │ Circuit     │→│ Provider    │→│ PaymentInProgress│◄────────┘   │   │
│  │  │ Breaker     │  │ Adapter     │  │ Save           │             │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │   │
│  │                                                                        │   │
│  └──────────────────────────────────────────────────────────────────────┘    │
│       │                                                                       │
│       ▼                                                                       │
│  Saga Orchestrator (si succès)                                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 PaymentRequest — Structure

```typescript
// =====================================================================
// PAYMENT REQUEST — Entrée standardisée pour tout paiement
// =====================================================================

interface PaymentRequest {
  // Obligatoire
  idempotencyKey: string;           // UUID v4, unique
  tenantId: number;
  amount: Money;
  
  // Optionnel — si non spécifié, le Payment Orchestrator choisit
  preferredProvider?: PaymentProviderType;
  
  // Métadonnées
  description: string;
  metadata: PaymentMetadata;
  
  // Source de la demande (pour traçabilité)
  source: {
    type: 'subscription' | 'invoice' | 'voucher' | 'manual';
    id: number;
  };
}

type PaymentProviderType = 
  | 'stripe'
  | 'mtn_mobile_money'
  | 'orange_money'
  | 'airtel_money'
  | 'flutterwave'
  | 'paypal'
  | 'pesapal'
  | 'dpo'
  | 'cash'
  | 'voucher'
  | 'bank_transfer';

interface PaymentMetadata {
  customerPhone?: string;
  customerEmail?: string;
  customerName?: string;
  returnUrl?: string;
  webhookUrl?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  // Étendu pour le Fraud Engine
  fingerprint?: string;
  geoLocation?: GeoLocation;
  previousPaymentCount?: number;
  timeSinceLastPayment?: number;
}
```

### 4.3 Provider Selector — Logique de Routage

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    PROVIDER SELECTOR — RÈGLES DE ROUTAGE                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Règles de sélection du provider (dans l'ordre) :                            │
│                                                                              │
│  1. Si preferredProvider est spécifié → utiliser celui-ci                    │
│     (sauf si Circuit Breaker ouvert)                                         │
│                                                                              │
│  2. Si pas de preferredProvider → utiliser le provider par défaut du tenant  │
│     (configurable dans tenant_settings)                                       │
│                                                                              │
│  3. Si pas de défaut → appliquer les règles pays/montant :                  │
│     • Pays = Zambie → Stripe + MTN (mobile money)                            │
│     • Pays = Cameroun → Orange Money + MTN                                   │
│     • Pays = Côte d'Ivoire → Flutterwave + Orange Money                      │
│     • Montant < 1000 ZMW → Mobile Money préféré                              │
│     • Montant ≥ 1000 ZMW → Stripe ou Flutterwave                             │
│                                                                              │
│  4. Si aucun provider disponible (tous Circuit Breaker ouvert) → FAIL       │
│     Retourner une erreur avec suggestion de réessayer plus tard              │
│                                                                              │
│  5. Le Selector est implémenté comme une Feature Flag (voir §8)              │
│     On peut ajouter/supprimer des providers sans redéploiement              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Provider Factory & Adapters

### 5.1 Provider Factory

```typescript
// =====================================================================
// PROVIDER FACTORY — Crée l'adapter approprié selon le type
// =====================================================================

class PaymentProviderFactory {
  private adapters: Map<PaymentProviderType, PaymentGatewayPort> = new Map();
  private circuitBreakers: Map<PaymentProviderType, CircuitBreaker> = new Map();

  constructor() {
    // Enregistrement des providers (configurable via Feature Flags)
    this.register('stripe', new StripeAdapter(config.stripe));
    this.register('mtn_mobile_money', new MTNAdapter(config.mtn));
    this.register('orange_money', new OrangeAdapter(config.orange));
    this.register('airtel_money', new AirtelAdapter(config.airtel));
    this.register('flutterwave', new FlutterwaveAdapter(config.flutterwave));
    this.register('paypal', new PayPalAdapter(config.paypal));
    this.register('pesapal', new PesaPalAdapter(config.pesapal));
    this.register('dpo', new DPOAdapter(config.dpo));
    this.register('cash', new CashAdapter());
    this.register('voucher', new VoucherAdapter(config.voucher));
    this.register('bank_transfer', new BankTransferAdapter());
  }

  getProvider(type: PaymentProviderType): PaymentGatewayPort {
    const adapter = this.adapters.get(type);
    if (!adapter) throw new Error(`Provider ${type} not registered`);
    
    // Vérifier Feature Flag (voir §8)
    if (!FeatureFlag.isEnabled(`payment.provider.${type}`)) {
      throw new Error(`Provider ${type} is disabled`);
    }
    
    return adapter;
  }

  getAvailableProviders(tenantId: number, amount: Money): PaymentProviderType[] {
    // Retourne la liste des providers disponibles pour un tenant/montant
    return Array.from(this.adapters.keys()).filter(type => {
      const cb = this.circuitBreakers.get(type);
      return cb?.isClosed() !== false 
        && FeatureFlag.isEnabled(`payment.provider.${type}`)
        && ProviderSelector.isAllowed(type, tenantId, amount);
    });
  }

  register(type: PaymentProviderType, adapter: PaymentGatewayPort): void {
    this.adapters.set(type, adapter);
    this.circuitBreakers.set(type, new CircuitBreaker(type, {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 30000,  // 30s avant réouverture
    }));
  }
}
```

### 5.2 Adapter — Stripe (Exemple)

```typescript
// =====================================================================
// STRIPE ADAPTER — Implémente PaymentGatewayPort
// =====================================================================

class StripeAdapter implements PaymentGatewayPort {
  readonly providerName = 'stripe';
  private stripe: Stripe;

  constructor(config: StripeConfig) {
    this.stripe = new Stripe(config.secretKey);
  }

  async authorize(request: AuthorizeRequest): Promise<AuthorizeResponse> {
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: request.amount.amount,
      currency: request.amount.currency.toLowerCase(),
      metadata: {
        tenantId: String(request.tenantId),
        idempotencyKey: request.idempotencyKey,
        subscriptionId: String(request.metadata.subscriptionId || ''),
      },
      // Stripe utilise son propre idempotency key
    }, {
      idempotencyKey: `auth-${request.idempotencyKey}`,
    });

    return {
      success: true,
      paymentId: paymentIntent.id,
      providerPaymentId: paymentIntent.id,
      status: 'authorized',
      redirectUrl: paymentIntent.next_action?.redirect_to_url?.url,
      providerMetadata: { clientSecret: paymentIntent.client_secret },
      authorizedAt: new Date(),
    };
  }

  async capture(paymentId: string): Promise<CaptureResponse> {
    const intent = await this.stripe.paymentIntents.capture(paymentId);
    return {
      success: intent.status === 'succeeded',
      paymentId,
      providerPaymentId: paymentId,
      status: intent.status === 'succeeded' ? 'captured' : 'failed',
      capturedAt: new Date(),
    };
  }

  async refund(paymentId: string, amount?: Money): Promise<RefundResponse> {
    const refund = await this.stripe.refunds.create({
      payment_intent: paymentId,
      amount: amount?.amount,
    });
    return {
      success: refund.status === 'succeeded',
      paymentId,
      refundId: refund.id,
      status: refund.status === 'succeeded' ? 'refunded' : 'failed',
      refundedAt: new Date(),
    };
  }

  async cancel(paymentId: string): Promise<void> {
    await this.stripe.paymentIntents.cancel(paymentId);
  }

  async status(paymentId: string): Promise<PaymentStatus> {
    const intent = await this.stripe.paymentIntents.retrieve(paymentId);
    return this.mapStripeStatus(intent.status);
  }

  async health(): Promise<HealthStatus> {
    try {
      await this.stripe.balance.retrieve({ timeout: 5000 });
      return { healthy: true, latency: 0 };
    } catch (err) {
      return { healthy: false, error: err.message };
    }
  }

  private mapStripeStatus(stripeStatus: string): PaymentStatus {
    const map: Record<string, PaymentStatus> = {
      requires_payment_method: 'pending',
      requires_confirmation: 'pending',
      requires_action: 'pending',
      processing: 'pending',
      requires_capture: 'authorized',
      succeeded: 'captured',
      canceled: 'cancelled',
      failed: 'failed',
    };
    return map[stripeStatus] || 'pending';
  }
}
```

### 5.3 Adapter — MTN Mobile Money (Exemple)

```typescript
// =====================================================================
// MTN ADAPTER — Mobile Money (Afrique)
// =====================================================================

class MTNAdapter implements PaymentGatewayPort {
  readonly providerName = 'mtn_mobile_money';

  async authorize(request: AuthorizeRequest): Promise<AuthorizeResponse> {
    // MTN Mobile Money est asynchrone :
    // 1. On envoie une requête de paiement
    // 2. L'utilisateur reçoit un USSD push
    // 3. L'utilisateur confirme sur son téléphone
    // 4. MTN nous notifie via webhook
    
    const paymentRequest = await this.mtnAPI.requestToPay({
      amount: request.amount.amount.toString(),
      currency: request.amount.currency,
      externalId: request.idempotencyKey,
      payer: {
        partyIdType: 'MSISDN',
        partyId: request.metadata.customerPhone,
      },
      payerMessage: request.metadata.description,
      payeeNote: 'Ekala Subscription',
    });

    return {
      success: true,
      paymentId: paymentRequest.referenceId,
      providerPaymentId: paymentRequest.referenceId,
      status: 'pending',  // Async — le webhook confirmera
      providerMetadata: {
        financialTransactionId: paymentRequest.financialTransactionId,
      },
      authorizedAt: new Date(),
    };
  }

  // Les autres méthodes (capture, refund, cancel, status, health)
  // suivent le même pattern que Stripe mais avec l'API MTN
}
```

### 5.4 Adapter — Cash (Caisse Physique)

```typescript
// =====================================================================
// CASH ADAPTER — Paiement en espèces (offline-capable)
// =====================================================================

class CashAdapter implements PaymentGatewayPort {
  readonly providerName = 'cash';

  async authorize(request: AuthorizeRequest): Promise<AuthorizeResponse> {
    // Le cash est toujours autorisé immédiatement
    // Le paiement est marqué comme 'captured' car l'argent est reçu
    return {
      success: true,
      paymentId: `CASH-${request.idempotencyKey}`,
      providerPaymentId: `CASH-${request.idempotencyKey}`,
      status: 'captured',  // Immédiat
      authorizedAt: new Date(),
    };
  }

  async capture(paymentId: string): Promise<CaptureResponse> {
    // Déjà capturé dans authorize
    return { success: true, paymentId, status: 'captured', capturedAt: new Date() };
  }

  async refund(paymentId: string, amount?: Money): Promise<RefundResponse> {
    // Le cash nécessite une caisse pour rembourser
    return {
      success: true,
      paymentId,
      refundId: `REF-CASH-${paymentId}`,
      status: 'refunded',
      refundedAt: new Date(),
    };
  }

  async status(paymentId: string): Promise<PaymentStatus> {
    return 'captured';
  }

  async health(): Promise<HealthStatus> {
    return { healthy: true, latency: 0 };  // Toujours disponible
  }
}
```

---

## 6. Fraud Engine

### 6.1 Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    FRAUD ENGINE — ARCHITECTURE                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Le Fraud Engine s'exécute APRÈS la validation et AVANT l'appel provider.    │
│                                                                              │
│  Si le score de risque dépasse le seuil → le paiement est bloqué.            │
│                                                                              │
│  Flux :                                                                       │
│                                                                              │
│  PaymentRequest                                                               │
│       │                                                                       │
│       ▼                                                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                     FRAUD ENGINE                                        │   │
│  │                                                                        │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐          │   │
│  │  │ Rate Limiter    │  │ Velocity Check  │  │ IP Reputation  │          │   │
│  │  │ Max 20/min      │  │ Même téléphone  │  │ Pays cohérent  │          │   │
│  │  │ par tenant      │  │ < 5min          │  │ avec tenant    │          │   │
│  │  └────────────────┘  └────────────────┘  └────────────────┘          │   │
│  │                                                                        │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐          │   │
│  │  │ Amount Check    │  │ Device         │  │ History Check  │          │   │
│  │  │ Montant suspect │  │ Fingerprint    │  │ 3 derniers     │          │   │
│  │  │ > 3x moyenne   │  │ Incohérent     │  │ paiements OK   │          │   │
│  │  └────────────────┘  └────────────────┘  └────────────────┘          │   │
│  │                                                                        │   │
│  │  Résultat : { score: 0-100, blocked: bool, reasons: string[] }        │   │
│  └──────────────────────────────────────────────────────────────────────┘    │
│       │                                                                       │
│       ├── [score < 30] → ✅ AUTORISÉ (appel provider)                         │
│       ├── [30 < score < 70] → ⚠️ FLAGGÉ (appel provider + notification)      │
│       └── [score > 70] → ❌ BLOQUÉ (retour erreur, log audit)               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Règles de Détection

| Règle | Description | Seuil | Score |
|-------|-------------|-------|-------|
| **Rate Limiting** | Plus de 20 paiements/min depuis le même tenant | > 20/min | 40 |
| **Velocity** | Même téléphone utilisé pour 2 paiements en < 5 min | < 5 min | 30 |
| **IP Reputation** | IP provenant d'un pays différent du tenant | Mismatch | 50 |
| **Amount Anomaly** | Montant > 3× la moyenne des paiements du tenant | > 3× avg | 35 |
| **Device Fingerprint** | Même device_id pour 2 tenants différents | Cross-tenant | 60 |
| **History Check** | Tenant a eu un chargeback dans les 30 jours | Yes | 80 |
| **Card BIN Check** | Carte émise dans un pays différent du tenant | Mismatch | 40 |
| **Time Check** | Paiement entre 23h et 5h (heure locale) | Night | 15 |

### 6.3 Implémentation

```typescript
// =====================================================================
// FRAUD ENGINE — Interface et implémentation
// =====================================================================

interface FraudCheckResult {
  requestId: string;
  score: number;             // 0 (safe) → 100 (fraud)
  blocked: boolean;          // true si score > threshold
  reasons: FraudReason[];
  executedAt: Date;
}

interface FraudReason {
  rule: string;
  score: number;
  detail: string;
}

class FraudEngine {
  private readonly BLOCK_THRESHOLD = 70;
  private readonly FLAG_THRESHOLD = 30;

  async evaluate(request: PaymentRequest): Promise<FraudCheckResult> {
    const reasons: FraudReason[] = [];

    // Exécuter toutes les règles en parallèle
    const checks = await Promise.all([
      this.checkRateLimiting(request),
      this.checkVelocity(request),
      this.checkIPReputation(request),
      this.checkAmountAnomaly(request),
      this.checkDeviceFingerprint(request),
      this.checkPaymentHistory(request),
      this.checkTimeAnomaly(request),
    ]);

    for (const check of checks) {
      if (check) reasons.push(check);
    }

    const score = reasons.reduce((sum, r) => sum + r.score, 0);
    const blocked = score >= this.BLOCK_THRESHOLD;

    // Logger la décision
    await this.logFraudDecision({
      requestId: request.idempotencyKey,
      score,
      blocked,
      reasons,
      executedAt: new Date(),
    });

    // Si score > FLAG_THRESHOLD, envoyer alerte
    if (score >= this.FLAG_THRESHOLD && !blocked) {
      await this.notifyFlagged(request, reasons);
    }

    return { requestId: request.idempotencyKey, score, blocked, reasons, executedAt: new Date() };
  }

  private async checkRateLimiting(req: PaymentRequest): Promise<FraudReason | null> {
    const count = await this.redis.incr(`fraud:rate:${req.tenantId}:${this.currentMinute()}`);
    await this.redis.expire(`fraud:rate:${req.tenantId}:${this.currentMinute()}`, 60);
    return count > 20 ? { rule: 'rate_limiting', score: 40, detail: `${count} paiements cette minute` } : null;
  }

  private async checkVelocity(req: PaymentRequest): Promise<FraudReason | null> {
    if (!req.metadata.customerPhone) return null;
    const lastPayment = await this.db.getLastPaymentByPhone(req.metadata.customerPhone);
    if (lastPayment && (Date.now() - lastPayment.createdAt.getTime()) < 5 * 60 * 1000) {
      return { rule: 'velocity', score: 30, detail: 'Même téléphone < 5min' };
    }
    return null;
  }

  private async checkIPReputation(req: PaymentRequest): Promise<FraudReason | null> {
    if (!req.metadata.ipAddress) return null;
    const tenant = await this.db.getTenant(req.tenantId);
    const geo = await this.geoIP.lookup(req.metadata.ipAddress);
    if (geo.country !== tenant.country) {
      return { rule: 'ip_reputation', score: 50, detail: `IP ${geo.country} ≠ tenant ${tenant.country}` };
    }
    return null;
  }

  private async checkAmountAnomaly(req: PaymentRequest): Promise<FraudReason | null> {
    const avgAmount = await this.db.getAveragePaymentAmount(req.tenantId, 30); // 30 jours
    if (avgAmount > 0 && req.amount.amount > avgAmount * 3) {
      return { rule: 'amount_anomaly', score: 35, detail: `${req.amount.amount} > 3× moyenne ${avgAmount}` };
    }
    return null;
  }

  private async checkDeviceFingerprint(req: PaymentRequest): Promise<FraudReason | null> {
    if (!req.metadata.fingerprint) return null;
    const otherTenants = await this.db.getTenantsByFingerprint(req.metadata.fingerprint, req.tenantId);
    if (otherTenants.length > 0) {
      return { rule: 'device_fingerprint', score: 60, detail: `Device utilisé par ${otherTenants.length} autres tenants` };
    }
    return null;
  }

  private async checkPaymentHistory(req: PaymentRequest): Promise<FraudReason | null> {
    const recentChargeback = await this.db.getRecentChargeback(req.tenantId, 30);
    if (recentChargeback) {
      return { rule: 'chargeback_history', score: 80, detail: 'Chargeback dans les 30 jours' };
    }
    return null;
  }

  private async checkTimeAnomaly(req: PaymentRequest): Promise<FraudReason | null> {
    const hour = new Date().getHours();
    if (hour >= 23 || hour < 5) {
      return { rule: 'time_anomaly', score: 15, detail: `Paiement à ${hour}h` };
    }
    return null;
  }
}
```

---

## 7. Circuit Breaker — Resilience Pattern

### 7.1 Principe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    CIRCUIT BREAKER — ÉTATS                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                   ┌─────────────────┐                                        │
│       ┌──────────►│     CLOSED       │◄─────────────────┐                    │
│       │          │  (Fonctionne)    │                    │                    │
│       │          └────────┬─────────┘                    │                    │
│       │                   │                              │                    │
│       │        5 échecs   │            Succès            │                    │
│       │         consécutifs│           x2                 │                    │
│       │                   ▼                              │                    │
│       │          ┌─────────────────┐                    │                    │
│       │          │      OPEN       │────────────────────┘                    │
│       │          │  (Bloque tout)  │                                         │
│       │          └────────┬─────────┘                                         │
│       │                   │                                                   │
│       │          Timeout 30s                                                  │
│       │                   ▼                                                   │
│       │          ┌─────────────────┐   Échec → retour OPEN                    │
│       └──────────┤    HALF-OPEN    │────────────────────┐                    │
│                  │  (Test 1 req)   │                    │                    │
│                  └─────────────────┘                    │                    │
│                                                         │                    │
│              Succès → retour CLOSED                     │                    │
│              ───────────────────────────────────────────┘                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Implémentation

```typescript
// =====================================================================
// CIRCUIT BREAKER — Par provider
// =====================================================================

interface CircuitBreakerConfig {
  failureThreshold: number;     // Nombre d'échecs avant ouverture
  successThreshold: number;     // Nombre de succès avant fermeture
  timeout: number;              // Temps en ms avant half-open
  monitorInterval: number;      // Intervalle de monitoring
}

class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: Date | null = null;
  private lastStateChange: Date = new Date();

  constructor(
    private providerName: string,
    private config: CircuitBreakerConfig
  ) {}

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldRetry()) {
        this.state = 'half-open';
      } else {
        throw new CircuitBreakerOpenError(this.providerName);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  isClosed(): boolean {
    return this.state === 'closed';
  }

  getState(): string {
    return this.state;
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo('closed');
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    
    if (this.state === 'closed' && this.failureCount >= this.config.failureThreshold) {
      this.transitionTo('open');
    }
    
    if (this.state === 'half-open') {
      this.transitionTo('open');
    }
  }

  private shouldRetry(): boolean {
    if (!this.lastFailureTime) return true;
    const elapsed = Date.now() - this.lastFailureTime.getTime();
    return elapsed >= this.config.timeout;
  }

  private transitionTo(newState: 'closed' | 'open' | 'half-open'): void {
    console.log(`[CircuitBreaker] ${this.providerName}: ${this.state} → ${newState}`);
    this.state = newState;
    this.lastStateChange = new Date();
    this.successCount = 0;
  }
}

class CircuitBreakerOpenError extends Error {
  constructor(providerName: string) {
    super(`Provider ${providerName} is unavailable (circuit breaker open)`);
    this.name = 'CircuitBreakerOpenError';
  }
}
```

### 7.3 Monitoring des Circuits

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    CIRCUIT BREAKER — TABLEAU DE BORD                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Provider        │ State      │ Failures │ Last Failure     │ Uptime        │
│  ───────────────┼────────────┼──────────┼──────────────────┼───────────────│
│  stripe         │ ✅ Closed  │ 0        │ -                │ 99.9%         │
│  mtn_mobile     │ 🔴 Open    │ 7        │ 12:34:56         │ 85.2%         │
│  orange_money   │ ✅ Closed  │ 1        │ 11:22:33         │ 98.7%         │
│  flutterwave    │ ⚠️ Half-Op │ 5        │ 12:30:00         │ 92.1%         │
│  cash           │ ✅ Closed  │ 0        │ -                │ 100%          │
│  voucher        │ ✅ Closed  │ 0        │ -                │ 100%          │
│                                                                              │
│  Alertes :                                                                    │
│  • MTN Mobile Money OPEN depuis 15min → notification Super Admin            │
│  • Flutterwave HALF-OPEN → tentative de réouverture                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Feature Flag Platform

### 8.1 Structure

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    FEATURE FLAG PLATFORM                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Permet d'activer/désactiver des fonctionnalités SANS redéploiement.        │
│                                                                              │
│  Flags de paiement :                                                         │
│  ┌──────────────────────────────────────────────┬──────────┬───────────┐    │
│  │ Flag                                         │ Default  │ Runtime   │    │
│  ├──────────────────────────────────────────────┼──────────┼───────────┤    │
│  │ payment.provider.stripe                      │ true     │ true      │    │
│  │ payment.provider.mtn_mobile_money            │ true     │ true      │    │
│  │ payment.provider.orange_money                │ true     │ false     │    │
│  │ payment.provider.airtel_money                │ false    │ false     │    │
│  │ payment.provider.flutterwave                 │ true     │ true      │    │
│  │ payment.provider.paypal                      │ false    │ false     │    │
│  │ payment.provider.cash                        │ true     │ true      │    │
│  │ payment.provider.voucher                     │ true     │ true      │    │
│  ├──────────────────────────────────────────────┼──────────┼───────────┤    │
│  │ billing.feature.upgrade                      │ true     │ true      │    │
│  │ billing.feature.downgrade                    │ true     │ true      │    │
│  │ billing.feature.cancel                       │ true     │ true      │    │
│  │ billing.feature.refund                       │ true     │ false     │    │
│  │ billing.feature.voucher_redeem               │ true     │ true      │    │
│  ├──────────────────────────────────────────────┼──────────┼───────────┤    │
│  │ billing.fraud.rate_limiting                  │ true     │ true      │    │
│  │ billing.fraud.velocity_check                 │ true     │ true      │    │
│  │ billing.fraud.ip_reputation                  │ true     │ false     │    │
│  │ billing.fraud.device_fingerprint             │ false    │ false     │    │
│  │ billing.fraud.amount_anomaly                 │ true     │ true      │    │
│  └──────────────────────────────────────────────┴──────────┴───────────┘    │
│                                                                              │
│  Stockage : PostgreSQL (table feature_flags) + cache Redis                  │
│  TTL Cache : 60s (modification prise en compte en < 1min)                   │
│  Interface : Super Admin peut modifier les flags en temps réel              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Implémentation

```typescript
// =====================================================================
// FEATURE FLAG — Service
// =====================================================================

class FeatureFlagService {
  private cache: Map<string, boolean> = new Map();
  private lastRefresh: Date | null = null;
  private readonly CACHE_TTL = 60_000; // 60s

  async isEnabled(flag: string, tenantId?: number): Promise<boolean> {
    await this.refreshCache();
    
    // Vérifier si le flag est global
    if (this.cache.has(flag)) {
      return this.cache.get(flag)!;
    }
    
    // Vérifier si le flag est spécifique au tenant
    if (tenantId) {
      const tenantFlag = await this.db.getTenantFlag(tenantId, flag);
      if (tenantFlag !== null) return tenantFlag;
    }
    
    // Retourner la valeur par défaut
    return this.getDefaultValue(flag);
  }

  async setFlag(flag: string, value: boolean): Promise<void> {
    await this.db.setFlag(flag, value);
    this.cache.set(flag, value);
    // Invalider le cache Redis pour propagation rapide
    await this.redis.publish('feature-flags:changed', JSON.stringify({ flag, value }));
  }

  private async refreshCache(): Promise<void> {
    if (this.lastRefresh && (Date.now() - this.lastRefresh.getTime()) < this.CACHE_TTL) return;
    
    const flags = await this.db.getAllFlags();
    for (const flag of flags) {
      this.cache.set(flag.key, flag.value);
    }
    this.lastRefresh = new Date();
  }

  private getDefaultValue(flag: string): boolean {
    const defaults: Record<string, boolean> = {
      'payment.provider.stripe': true,
      'payment.provider.cash': true,
      'payment.provider.voucher': true,
      'billing.feature.upgrade': true,
      'billing.feature.cancel': true,
    };
    return defaults[flag] ?? false;
  }
}
```

---

## 9. Billing Read Model

### 9.1 Principe

Le **Billing Read Model** est une base de données dédiée aux lectures (dashboards, rapports) qui ne touche jamais le ledger directement.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    BILLING READ MODEL — CQRS LIGHT                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Pourquoi un Read Model séparé ?                                             │
│                                                                              │
│  Sans Read Model :                                                           │
│  • Les dashboard queries sont lentes (JOIN complexes sur le ledger)          │
│  • Les rapports financiers impactent la production                          │
│  • Le scale est limité par le ledger                                         │
│                                                                              │
│  Avec Read Model :                                                           │
│  • Les dashboards lisent depuis des tables optimisées                       │
│  • Les rapports n'impactent pas le billing                                   │
│  • On peut avoir plusieurs read models (par pays, par région)                │
│                                                                              │
│  Flux de synchronisation :                                                    │
│                                                                              │
│  Ledger (append-only)                                                         │
│       │                                                                       │
│       │  Event Bus (après chaque écriture)                                   │
│       ▼                                                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │              READ MODEL PROJECTOR                                        │   │
│  │  Écoute les événements du ledger et met à jour le read model            │   │
│  └──────────────────────────────────────────────────────────────────────┘    │
│       │                                                                       │
│       ▼                                                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  READ MODEL (PostgreSQL ou dédié)                                       │   │
│  │  • billing_summary (par tenant, par mois)                               │   │
│  │  • revenue_by_plan (par plan, par période)                               │   │
│  │  • payment_method_stats (par provider)                                   │   │
│  │  • subscription_metrics (actives, expirées, etc.)                        │   │
│  │  • invoice_summary (émises, payées, en retard)                          │   │
│  └──────────────────────────────────────────────────────────────────────┘    │
│       │                                                                       │
│       ▼                                                                       │
│  Dashboard API (lecture seule)                                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Tables du Read Model

```sql
-- =====================================================================
-- BILLING READ MODEL — Schéma dédié aux lectures
-- =====================================================================

-- Résumé mensuel par tenant
CREATE TABLE billing_summary (
  tenant_id INT NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  
  -- Revenus
  total_revenue_cents BIGINT DEFAULT 0,
  subscription_revenue_cents BIGINT DEFAULT 0,
  voucher_revenue_cents BIGINT DEFAULT 0,
  
  -- Paiements
  payment_count INT DEFAULT 0,
  successful_payments INT DEFAULT 0,
  failed_payments INT DEFAULT 0,
  
  -- Refunds
  refund_count INT DEFAULT 0,
  refund_amount_cents BIGINT DEFAULT 0,
  
  -- Métriques
  avg_payment_amount_cents BIGINT DEFAULT 0,
  max_payment_amount_cents BIGINT DEFAULT 0,
  preferred_payment_method VARCHAR(50),
  
  PRIMARY KEY (tenant_id, year, month)
);

-- Revenus par plan
CREATE TABLE revenue_by_plan (
  tenant_id INT NOT NULL,
  plan_code VARCHAR(50) NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  
  subscriber_count INT DEFAULT 0,
  new_subscribers INT DEFAULT 0,
  cancelled_subscribers INT DEFAULT 0,
  revenue_cents BIGINT DEFAULT 0,
  
  PRIMARY KEY (tenant_id, plan_code, year, month)
);

-- Métriques d'abonnement
CREATE TABLE subscription_metrics (
  tenant_id INT PRIMARY KEY,
  
  current_plan_code VARCHAR(50),
  current_plan_name VARCHAR(100),
  subscription_status VARCHAR(20),
  days_until_renewal INT,
  days_since_creation INT,
  total_paid_cents BIGINT DEFAULT 0,
  payment_method_count INT DEFAULT 0,
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Statistiques par provider de paiement
CREATE TABLE payment_method_stats (
  tenant_id INT NOT NULL,
  provider_name VARCHAR(50) NOT NULL,
  
  total_payments INT DEFAULT 0,
  successful_payments INT DEFAULT 0,
  failed_payments INT DEFAULT 0,
  total_amount_cents BIGINT DEFAULT 0,
  avg_latency_ms INT DEFAULT 0,
  circuit_breaker_state VARCHAR(20) DEFAULT 'closed',
  
  PRIMARY KEY (tenant_id, provider_name)
);
```

---

## 10. Architecture Multi-Région

### 10.1 Principe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE MULTI-RÉGION AFRICAINE                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Principe : Les données restent dans le pays d'origine.                      │
│                                                                              │
│  Régions :                                                                    │
│  • ZAMBIE (Lusaka) — Région principale (ZMW)                                │
│  • AFRIQUE OUEST (Sénégal/Côte d'Ivoire) — XOF, Orange Money                │
│  • AFRIQUE CENTRALE (Cameroun) — XAF, MTN                                   │
│  • AFRIQUE EST (Kenya) — KES, M-Pesa                                        │
│  • EUROPE (Paris/Francfort) — EUR, Stripe backup                            │
│                                                                              │
│  Architecture par région :                                                    │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  RÉGION ZAMBIE (Lusaka)                                                │   │
│  │                                                                        │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐              │   │
│  │  │ PostgreSQL│  │ Redis    │  │ Billing  │  │ Providers │              │   │
│  │  │ (Primary) │  │ (Cache)  │  │ Services │  │ Stripe    │              │   │
│  │  └──────────┘  └──────────┘  └──────────┘  │ MTN ZM   │              │   │
│  │                                             └──────────┘              │   │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                           │                                                    │
│              Réplication async                                                │
│                           │                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  RÉGION AFRIQUE OUEST (Dakar/Abidjan)                                 │   │
│  │                                                                        │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐              │   │
│  │  │ PostgreSQL│  │ Redis    │  │ Billing  │  │ Providers │              │   │
│  │  │ (Replica) │  │ (Cache)  │  │ Services │  │ Orange    │              │   │
│  │  └──────────┘  └──────────┘  └──────────┘  │ Flutter   │              │   │
│  │                                             └──────────┘              │   │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Synchronisation :                                                            │
│  • PostgreSQL : réplication asynchrone (logical replication)                 │
│  • Redis : chaque région a son propre cache                                  │
│  • Billing Services : chaque région a ses propres instances                  │
│  • Feature Flags : synchronisés via l'Event Bus                             │
│  • Read Model : régional (uniquement les données du pays)                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Data Sovereignty

| Pays | Région | Données stockées | Base légale |
|------|--------|-----------------|-------------|
| Zambie | Lusaka | Comptes ZMW, paiements MTN | Zambia Data Protection Act |
| Sénégal | Dakar | Comptes XOF, Orange Money | Senegal Data Protection |
| Côte d'Ivoire | Abidjan | Comptes XOF, Flutterwave | Côte d'Ivoire Data Protection |
| Cameroun | Douala | Comptes XAF, MTN | Cameroon Data Protection |
| Kenya | Nairobi | Comptes KES, M-Pesa | Kenya Data Protection Act |
| Europe | Paris | Comptes EUR (backup) | GDPR |

---

## 11. Diagramme d'Architecture Complet V2.5

```
┌═══════════════════════════════════════════════════════════════════════════════════════════════════════════┐
║                          EKALA BILLING V2.5 ENTERPRISE — ARCHITECTURE COMPLETE                          ║
╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════╝

┌───────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER                                                                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐│
│  │ Tenant Dashboard│  │ Super Admin      │  │ Pricing Page    │  │ POS (Offline)   │  │ Payment Portal  ││
│  │ /billing        │  │ /platform        │  │ /pricing        │  │ (SQLite local)  │  │ /payment/:id    ││
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘│
├───────────┼────────────────────┼────────────────────┼───────────────────┼────────────────────┼──────────────┤
│  API GATEWAY                                                                                                │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐│
│  │  Express / Fastify Router + WAF + Rate Limiting                                                        ││
│  │  ├── Auth JWT + Tenant Scope                                                                          ││
│  │  ├── Subscription Guard (cache SQLite)                                                                ││
│  │  ├── Idempotency Check (Redis + PG)                                                                   ││
│  │  └── Request Validation (Zod)                                                                         ││
│  └────────────────────────────────────────────────────────────────────────────────────────────────────────┘│
├───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  APPLICATION LAYER                                                                                        │
│                                                                                                           │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐│
│  │  BILLING SERVICES (V2.4 conservés)                                                                    ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          ││
│  │  │Subscript.│ │Invoice   │ │Voucher   │ │Tax       │ │Currency  │ │Accounting│ │Reporting │          ││
│  │  │Service   │ │Service   │ │Service   │ │Service   │ │Service   │ │Ledger   │ │Service   │          ││
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘          ││
│  └──────────────────────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                                           │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐│
│  │  NOUVEAU : PAYMENT GATEWAY MODULE (V2.5)                                                              ││
│  │                                                                                                       ││
│  │  ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐││
│  │  │                     PAYMENT ORCHESTRATOR                                                          │││
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                   │││
│  │  │  │ Validator│ │Idempot. │ │ Fraud    │ │ Provider │ │ Circuit  │ │ Payment  │                   │││
│  │  │  │          │ │ Check   │ │ Engine   │ │ Selector │ │ Breaker  │ │ InProg   │                   │││
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘                   │││
│  │  └──────────────────────────────────────────────────────────────────────────────────────────────────┘││
│  │                                                                                                       ││
│  │  ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐││
│  │  │                     PROVIDER ADAPTERS (Ports & Adapters)                                          │││
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │││
│  │  │  │ Stripe   │ │ MTN      │ │ Orange   │ │ Airtel   │ │ Flutter  │ │ Cash     │ │ Voucher  │     │││
│  │  │  │ Adapter  │ │ Adapter  │ │ Adapter  │ │ Adapter  │ │ Adapter  │ │ Adapter  │ │ Adapter  │     │││
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘     │││
│  │  └──────────────────────────────────────────────────────────────────────────────────────────────────┘││
│  └──────────────────────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                                           │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐│
│  │  INFRASTRUCTURE SERVICES (V2.4 + V2.5)                                                                ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          ││
│  │  │Saga      │ │Outbox    │ │DLQ       │ │Webhook   │ │Cron      │ │Sync      │ │Feature   │          ││
│  │  │Orchestr. │ │Processor │ │Processor │ │Handler   │ │Engine    │ │Engine    │ │Flag      │          ││
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘          ││
│  └──────────────────────────────────────────────────────────────────────────────────────────────────────┘│
├───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  DATA LAYER                                                                                               │
│                                                                                                           │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐│
│  │  POSTGRESQL / SUPABASE (Write Model — Source de vérité)                                              ││
│  │  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐      ││
│  │  │ Billing Schema  │ │ Accounting      │ │ Platform        │ │ Audit          │ │ Feature Flags │      ││
│  │  │ subscriptions   │ │ Schema          │ │ Schema          │ │ Schema          │ │ payment.prov. │      ││
│  │  │ payment_in_prog │ │ ledger_entries  │ │ tenants         │ │ audit_log      │ │ billing.feat. │      ││
│  │  │ invoices        │ │ tax_rates       │ │ plans           │ │ saga_state     │ │ fraud.rules   │      ││
│  │  │ vouchers        │ │ exchange_rates  │ │ users           │ │ idempotency    │ └────────────────┘      ││
│  │  │ chargebacks     │ │ fiscal_periods  │ │ sync_metadata   │ │ outbox         │                        ││
│  │  └────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘                          ││
│  └──────────────────────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                                           │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐│
│  │  NOUVEAU : BILLING READ MODEL (Dashboards & Reports)                                                 ││
│  │  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐                 ││
│  │  │ billing_summary   │ │ revenue_by_plan   │ │ subscription_    │ │ payment_method_  │                 ││
│  │  │ (par tenant/mois) │ │ (par plan/période)│ │ metrics (tenant) │ │ stats (providers)│                 ││
│  │  └──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘                 ││
│  └──────────────────────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                                           │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐│
│  │  REDIS (Cache + Rate Limiting + Circuit Breaker State)                                               ││
│  │  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐                 ││
│  │  │ Feature Flag     │ │ Fraud Engine     │ │ Circuit Breaker  │ │ Session Cache    │                 ││
│  │  │ (cache 60s)      │ │ (rate counters)  │ │ (state par prov.)│ │ (JWT, tenant)    │                 ││
│  │  └──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘                 ││
│  └──────────────────────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                                           │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐│
│  │  SQLITE (1 base par tenant — Offline-First POS)                                                       ││
│  │  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐                          ││
│  │  │ POS Schema      │ │ Inventory       │ │ Orders         │ │ Subscription   │                          ││
│  │  │ sales           │ │ products        │ │ orders         │ │ Cache          │                          ││
│  │  │ sale_items      │ │ categories      │ │ order_items    │ │ plans (ro)     │                          ││
│  │  └────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘                          ││
│  └──────────────────────────────────────────────────────────────────────────────────────────────────────┘│
├───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  INTEGRATION LAYER                                                                                        │
│                                                                                                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │  Stripe       │ │  MTN Africa   │ │  Orange       │ │  Flutterwave  │ │  PayPal       │ │  Email        │  │
│  │  • Payments   │ │  • Mobile     │ │  • Mobile     │ │  • Gateway    │ │  • Standard   │ │  • Invoices   │  │
│  │  • Subs       │ │    Money      │ │    Money      │ │  • Webhooks   │ │  • Express    │ │  • Receipts   │  │
│  │  • Webhooks   │ │  • Webhooks   │ │  • Webhooks   │ │               │ │               │ │  • Campaigns  │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 12. Décisions ADR V2.5

### ADR-013 : Payment Gateway Hexagonal

**Contexte :** V2.4 dépendait de Stripe directement. Le besoin d'intégrer MTN, Orange, Flutterwave, Cash, Voucher sans modifier le code métier est critique pour l'expansion africaine.
**Décision :** Adoption du pattern Ports & Adapters (Hexagonal Architecture) pour le Payment Gateway. Le domaine billing ne dépend que de l'interface `PaymentGatewayPort`.
**Conséquence :** Ajouter un nouveau provider = implémenter 5 méthodes. Aucune modification du code métier. Testable unitairement avec des mocks.
**Statut :** Acceptée.

### ADR-014 : Payment Orchestrator Centralisé

**Contexte :** La logique de paiement était répartie entre Subscription Service, Voucher Service, et le frontend.
**Décision :** Création d'un Payment Orchestrator unique qui centralise : validation, idempotence, fraud check, provider selection, circuit breaker, persistance.
**Conséquence :** Toute demande de paiement passe par l'orchestrateur. Plus de duplication de logique. Point unique de monitoring.
**Statut :** Acceptée.

### ADR-015 : Fraud Engine Before Provider

**Contexte :** Aucune vérification anti-fraude en V2.3/V2.4.
**Décision :** Le Fraud Engine s'exécute systématiquement avant l'appel au provider. Score > 70 = blocage. Score > 30 = flag + notification.
**Conséquence :** Réduction des chargebacks. Protection contre les abus. Latence additionnelle < 50ms (Redis + cache).
**Statut :** Acceptée.

### ADR-016 : Circuit Breaker par Provider

**Contexte :** Si Stripe tombe, tous les paiements échouent. Aucun mécanisme de fallback.
**Décision :** Chaque provider a son propre Circuit Breaker. En cas d'ouverture, le Provider Selector choisit un autre provider disponible.
**Conséquence :** Résilience accrue. Disponibilité même si un provider est down. Monitoring des états des circuits.
**Statut :** Acceptée.

### ADR-017 : Feature Flags pour Paiements

**Contexte :** Impossible d'activer/désactiver un provider sans redéploiement.
**Décision :** Tous les providers et fonctionnalités billing sont contrôlés par des Feature Flags stockés dans PostgreSQL + cache Redis (TTL 60s).
**Conséquence :** Activation/désactivation en temps réel via l'interface Super Admin. Changement pris en compte en < 1min.
**Statut :** Acceptée.

### ADR-018 : Billing Read Model Séparé

**Contexte :** Les dashboards billing interrogeaient le ledger directement, causant des lenteurs et des locks.
**Décision :** Création d'un Read Model dédié aux lectures, mis à jour de manière asynchrone via l'Event Bus après chaque écriture dans le ledger.
**Conséquence :** Dashboards rapides (< 200ms). Aucun impact sur le ledger. Scalabilité horizontale possible.
**Statut :** Acceptée.

### ADR-019 : Multi-Région avec Data Sovereignty

**Contexte :** Les lois africaines sur la protection des données exigent que les données restent dans le pays d'origine.
**Décision :** Architecture multi-région avec une instance PostgreSQL par région. Réplication asynchrone pour la consolidation. Les données ne quittent jamais le pays du tenant.
**Conséquence :** Conformité légale. Complexité opérationnelle accrue. Coût infrastructure plus élevé.
**Statut :** Acceptée (P2 — post-V2.5).

---

## 13. Glossaire V2.5

| Terme | Définition |
|-------|------------|
| **Port** | Interface définissant le contrat entre le domaine et l'infrastructure |
| **Adapter** | Implémentation concrète d'un port pour un provider spécifique |
| **Provider Factory** | Fabrique qui instancie et retourne l'adapter approprié |
| **Payment Orchestrator** | Service central qui coordonne tout le flux de paiement |
| **Fraud Engine** | Moteur de détection de fraude basé sur des règles |
| **Circuit Breaker** | Pattern de résilience qui arrête les appels vers un provider défaillant |
| **Feature Flag** | Interrupteur permettant d'activer/désactiver une fonctionnalité sans déploiement |
| **Read Model** | Base de données dédiée aux lectures, optimisée pour les dashboards |
| **Provider Selector** | Logique qui choisit le meilleur provider selon le contexte |
| **Hexagonal Architecture** | Pattern où le cœur métier est isolé des adapters techniques |
| **Data Sovereignty** | Principe selon lequel les données restent dans le pays d'origine |
| **Velocity Check** | Vérification anti-fraude basée sur la fréquence des paiements |
| **BIN Check** | Vérification du Bank Identification Number d'une carte |
| **Mobile Money** | Système de paiement mobile africain (MTN, Orange, Airtel, M-Pesa) |

---

## Annexes

### A. Checklist Migration V2.4 → V2.5

**Phase 1 — Payment Gateway (P0)**
- [ ] Définir l'interface `PaymentGatewayPort`
- [ ] Implémenter `StripeAdapter`
- [ ] Implémenter `CashAdapter`
- [ ] Implémenter `VoucherAdapter`
- [ ] Implémenter `PaymentProviderFactory`
- [ ] Implémenter `ProviderSelector`
- [ ] Remplacer les appels directs Stripe par le Payment Orchestrator

**Phase 2 — Payment Orchestrator (P0)**
- [ ] Implémenter `PaymentOrchestrator`
- [ ] Intégrer l'idempotence check
- [ ] Intégrer le Fraud Engine
- [ ] Intégrer le Circuit Breaker
- [ ] Intégrer la persistence PaymentInProgress
- [ ] Supprimer les anciens endpoints de paiement directs

**Phase 3 — Providers additionnels (P1)**
- [ ] Implémenter `MTNAdapter`
- [ ] Implémenter `OrangeAdapter`
- [ ] Implémenter `FlutterwaveAdapter`
- [ ] Implémenter `AirtelAdapter`
- [ ] Implémenter `PayPalAdapter`

**Phase 4 — Résilience (P1)**
- [ ] Implémenter `CircuitBreaker` par provider
- [ ] Ajouter le monitoring des circuits
- [ ] Implémenter le retry avec backoff exponentiel
- [ ] Tests de résilience (simulation de panne provider)

**Phase 5 — Fraud Engine (P1)**
- [ ] Implémenter les 8 règles de détection
- [ ] Intégrer Redis pour le rate limiting
- [ ] Interface Super Admin pour les alertes
- [ ] Tests de non-régression (vrais paiements acceptés)

**Phase 6 — Feature Flags (P1)**
- [ ] Table PostgreSQL `feature_flags`
- [ ] Cache Redis avec TTL 60s
- [ ] Interface Super Admin
- [ ] Intégration dans le Provider Selector
- [ ] Tests de bascule en production

**Phase 7 — Read Model (P1)**
- [ ] Créer les tables du Read Model
- [ ] Implémenter le Projector (Event Bus → Read Model)
- [ ] Migrer les dashboards vers le Read Model
- [ ] Tests de performance (> 200ms par requête)

**Phase 8 — Multi-Région (P2)**
- [ ] Déployer PostgreSQL par région
- [ ] Configurer la réplication asynchrone
- [ ] Déployer les Billing Services par région
- [ ] Tests de latence inter-région
- [ ] Runbook de reprise après sinistre régional

### B. Métriques Cibles V2.5

| Métrique | V2.4 | V2.5 Cible |
|----------|------|-----------|
| Temps de traitement paiement | < 5s | < 3s |
| Disponibilité providers | 95% | 99.9% |
| Temps bascule provider (panne) | N/A | < 1s |
| Taux fraude non détectée | N/A | < 0.1% |
| Temps ajout nouveau provider | 2 semaines | 2 jours |
| Latence dashboard billing | > 5s | < 200ms |
| Feature flag propagation | N/A (redéploiement) | < 60s |
| Couverture providers | 1 (Stripe) | 8+ |

### C. Dépendances Additionnelles V2.5

| Bibliothèque | Version | Usage |
|-------------|---------|-------|
| ioredis | ^5.x | Cache + Rate Limiting |
| @opentelemetry/sdk-node | ^0.50.x | Tracing distribué |
| pino-loki | ^6.x | Logs → Grafana Loki |

---

**Fin du document — Architecture V2.5 Enterprise Approuvée**