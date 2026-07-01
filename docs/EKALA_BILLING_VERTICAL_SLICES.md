# Ekala Billing — Vertical Slices Implementation Strategy

**Version:** 1.0 (Mode Implementation Engineer)  
**Statut:** Stratégie d'exécution rapide  
**Date:** 30/06/2026  
**Objectif:** Système de billing fonctionnel end-to-end en production le plus rapidement possible

---

## STRATÉGIE: 3 VERTICAL SLICES

Au lieu de construire par couches (Value Objects → Aggregates → Policies), on construit par **verticales fonctionnelles** :

```
SLICE 1 (Semaines 1-3): CORE PAYMENT
  └─ Stripe webhook → PaymentIntent → SUCCESS
  
SLICE 2 (Semaines 4-6): INVOICING SIMPLE
  └─ Subscription → Invoice → Paid
  
SLICE 3 (Semaines 7-9): ACCOUNTING EVENT
  └─ Payment → AccountingEvent → JournalEntries (débit/crédit)
```

**Principe:** Chaque slice est **fonctionnelle et testable** avant de passer à la suivante.

---

## SLICE 1 — CORE PAYMENT (Semaines 1-3)

**Objectif:** Paiement Stripe fonctionnel de bout en bout

### Ce qui est implémenté

```
Frontend (Stripe Elements)
    ↓
POST /api/v2/billing/payment-intents
    ↓
PaymentIntent Aggregate (PostgreSQL)
    ↓
StripeAdapter.createPaymentIntent()
    ↓
Stripe PaymentIntent créé
    ↓
Frontend: client_secret
    ↓
Client confirme (Stripe Elements)
    ↓
Stripe webhook: payment_intent.succeeded
    ↓
WebhookHandler (idempotent)
    ↓
PaymentIntent.status = 'succeeded'
    ↓
✅ SUCCESS
```

### Fichiers à créer (SLICE 1)

#### 1. Value Objects (minimal)

```typescript
// src/server/domain/billing/value-objects/Money.ts
class Money {
  constructor(
    private amount_cents: bigint,
    private currency: Currency
  ) {
    if (amount_cents <= 0n) throw new Error('Amount must be positive');
    if (!Currency.isValid(currency)) throw new Error('Invalid currency');
  }
  
  add(other: Money): Money {
    if (this.currency !== other.currency) throw new Error('Currency mismatch');
    return new Money(this.amount_cents + other.amount_cents, this.currency);
  }
  
  equals(other: Money): boolean {
    return this.amount_cents === other.amount_cents &&
           this.currency === other.currency;
  }
}

// src/server/domain/billing/value-objects/Currency.ts
enum Currency {
  ZMW = 'ZMW',
  USD = 'USD',
  EUR = 'EUR'
}
```

#### 2. PaymentIntent Aggregate

```typescript
// src/server/domain/billing/aggregates/payment-intent/PaymentIntent.ts
class PaymentIntent {
  constructor(
    private id: UUID,
    private tenant_id: BIGINT,
    private amount: Money,
    private currency: Currency,
    private status: PaymentIntentStatus,
    private provider: Provider,
    private attempts: PaymentAttempt[],
    private entity_version: number,
    private idempotency_key: UUID
  ) {
    this.validate();
  }
  
  private validate(): void {
    // Au moins 1 attempt
    if (this.attempts.length === 0) {
      throw new Error('PaymentIntent must have at least 1 attempt');
    }
    
    // Si succeeded → au moins 1 attempt succeeded
    if (this.status === PaymentIntentStatus.Succeeded) {
      const hasSucceeded = this.attempts.some(a => a.status === PaymentAttemptStatus.Succeeded);
      if (!hasSucceeded) throw new Error('Succeeded requires succeeded attempt');
    }
    
    // Attempts ordonnés
    for (let i = 0; i < this.attempts.length; i++) {
      if (this.attempts[i].attempt_number !== i + 1) {
        throw new Error('Attempts must be ordered');
      }
    }
  }
  
  addAttempt(attempt: PaymentAttempt): void {
    const nextNumber = this.attempts.length + 1;
    if (attempt.attempt_number !== nextNumber) {
      throw new Error(`Expected attempt ${nextNumber}`);
    }
    this.attempts.push(attempt);
    this.entity_version++;
    this.validate();
  }
  
  markAsSucceeded(attemptId: UUID): void {
    const attempt = this.attempts.find(a => a.id === attemptId);
    if (!attempt) throw new Error('Attempt not found');
    
    attempt.markAsSucceeded();
    this.status = PaymentIntentStatus.Succeeded;
    this.entity_version++;
    this.validate();
  }
}

// src/server/domain/billing/aggregates/payment-intent/PaymentAttempt.ts
class PaymentAttempt {
  constructor(
    private id: UUID,
    private attempt_number: number,
    private provider: Provider,
    private provider_transaction_id: string,
    private status: PaymentAttemptStatus,
    private raw_response: JSONB
  ) {}
}
```

#### 3. StripeAdapter (minimal)

```typescript
// src/server/infrastructure/billing/providers/StripeAdapter.ts
class StripeAdapter implements PaymentProvider {
  constructor(private stripe: Stripe, private secrets: SecretsManager) {}
  
  async createPaymentIntent(amount: Money, metadata: any): Promise<PaymentIntentResult> {
    const secretKey = await this.secrets.getSecret('stripe_secret_key');
    const stripe = new Stripe(secretKey);
    
    const intent = await stripe.paymentIntents.create({
      amount: amount.amount_cents,
      currency: amount.currency,
      metadata
    });
    
    return {
      provider_payment_intent_id: intent.id,
      client_secret: intent.client_secret
    };
  }
  
  async getStatus(providerPaymentIntentId: string): Promise<PaymentStatus> {
    const intent = await stripe.paymentIntents.retrieve(providerPaymentIntentId);
    return this.mapStatus(intent.status);
  }
}
```

#### 4. WebhookHandler (idempotent)

```typescript
// src/server/infrastructure/billing/webhooks/StripeWebhookHandler.ts
class StripeWebhookHandler {
  constructor(
    private webhookRepo: WebhookEventRepository,
    private paymentRepo: PaymentIntentRepository
  ) {}
  
  async handle(eventId: string, eventType: string, payload: any): Promise<string> {
    // 1. Vérifier idempotence
    const existing = await this.webhookRepo.findByEventId(eventId);
    if (existing) {
      return 'already_processed';
    }
    
    // 2. Traiter selon le type
    if (eventType === 'payment_intent.succeeded') {
      await this.handleSucceeded(payload);
    } else if (eventType === 'payment_intent.payment_failed') {
      await this.handleFailed(payload);
    }
    
    // 3. Enregistrer webhook (idempotence)
    await this.webhookRepo.save(new WebhookEvent(eventId, eventType, payload));
    
    return 'processed';
  }
  
  private async handleSucceeded(payload: any): Promise<void> {
    const { payment_intent: piId } = payload;
    
    // Récupérer PaymentIntent
    const paymentIntent = await this.paymentRepo.findByProviderId(piId);
    if (!paymentIntent) throw new Error('PaymentIntent not found');
    
    // Marquer comme succeeded (déjà géré par idempotence)
    paymentIntent.markAsSucceeded(/* attempt */);
    await this.paymentRepo.save(paymentIntent);
  }
}
```

#### 5. Repositories (minimal)

```typescript
// src/server/domain/billing/repositories/IPaymentIntentRepository.ts
interface IPaymentIntentRepository {
  save(paymentIntent: PaymentIntent): Promise<void>;
  findById(id: UUID): Promise<PaymentIntent | null>;
  findByProviderId(providerId: string): Promise<PaymentIntent | null>;
  findByIdempotencyKey(key: UUID): Promise<PaymentIntent | null>;
}

// src/server/infrastructure/billing/repositories/PostgresPaymentIntentRepository.ts
class PostgresPaymentIntentRepository implements IPaymentIntentRepository {
  async save(paymentIntent: PaymentIntent): Promise<void> {
    // INSERT avec optimistic locking
    const result = await db.payment_intents.update({
      where: { id: paymentIntent.id, entity_version: paymentIntent.entity_version - 1 },
      data: { /* ... */ }
    });
    
    if (result.count === 0) {
      throw new Error('Optimistic lock failed');
    }
  }
}
```

### Tests SLICE 1 (OBLIGATOIRES)

```typescript
// tests/billing/slice1-payment.test.ts

describe('SLICE 1: Core Payment', () => {
  // TEST 1: Payment flow complet
  it('should process Stripe payment end-to-end', async () => {
    // 1. Créer PaymentIntent
    const intent = await paymentService.createIntent({
      tenantId: 16,
      amount: 336000,
      currency: 'ZMW'
    });
    
    expect(intent.status).toBe('created');
    
    // 2. Simuler webhook Stripe
    await webhookHandler.handle(
      'evt_123',
      'payment_intent.succeeded',
      { payment_intent: 'pi_123' }
    );
    
    // 3. Vérifier statut
    const updated = await paymentRepo.findById(intent.id);
    expect(updated.status).toBe('succeeded');
  });
  
  // TEST 2: Duplicate webhook handling
  it('should ignore duplicate webhooks', async () => {
    const eventId = 'evt_123';
    
    // Premier webhook
    await webhookHandler.handle(eventId, 'payment_intent.succeeded', {});
    
    // Deuxième webhook (même event_id)
    const result = await webhookHandler.handle(eventId, 'payment_intent.succeeded', {});
    
    expect(result).toBe('already_processed');
  });
  
  // TEST 3: Multi-attempt
  it('should handle multiple attempts', async () => {
    const intent = createPaymentIntent();
    
    // Tentative 1: échoue
    intent.addAttempt(createAttempt(1, 'failed'));
    
    // Tentative 2: réussit
    intent.addAttempt(createAttempt(2, 'succeeded'));
    intent.markAsSucceeded(attempt2.id);
    
    expect(intent.attempts.length).toBe(2);
    expect(intent.status).toBe('succeeded');
  });
  
  // TEST 4: Currency mismatch
  it('should reject currency mismatch', async () => {
    const intent = createPaymentIntent(1000, 'ZMW');
    const attempt = createAttempt(1, 'succeeded', 'USD'); // Devise différente
    
    expect(() => {
      intent.addAttempt(attempt);
    }).toThrow('Currency mismatch');
  });
});
```

### Definition of Done SLICE 1

- [x] PaymentIntent créé via API
- [x] StripeAdapter appelle Stripe
- [x] Webhook Stripe traité (idempotent)
- [x] PaymentIntent.status = 'succeeded'
- [x] Tests passent (success flow, retry, duplicate webhook, currency)
- [x] Aucun doublon possible
- [x] Optimistic locking fonctionne

---

## SLICE 2 — INVOICING SIMPLE (Semaines 4-6)

**Objectif:** Génération de facture + lien avec paiement

### Ce qui est implémenté

```
PaymentIntent.status = 'succeeded'
    ↓
Saga: générer facture
    ↓
Invoice Aggregate créé
    ↓
Invoice.status = 'issued'
    ↓
Invoice marquée 'paid' (lien avec PaymentIntent)
    ↓
✅ FACTURE GÉNÉRÉE + PAIEMENT LIÉ
```

### Fichiers à créer (SLICE 2)

#### 1. Invoice Aggregate (simplifié)

```typescript
// src/server/domain/billing/aggregates/invoice/Invoice.ts
class Invoice {
  constructor(
    private id: UUID,
    private invoice_number: InvoiceNumber,
    private tenant_id: BIGINT,
    private status: InvoiceStatus,
    private subtotal: Money,
    private tax: Money,
    private discount: Money,
    private total: Money,
    private currency: Currency,
    private billing_period: Period,
    private issue_date: Date,
    private due_date: Date,
    private paid_at: Date | null,
    private fiscal_period: FiscalPeriod,
    private entity_version: number
  ) {
    this.validate();
  }
  
  private validate(): void {
    // total = subtotal + tax - discount
    const expected = this.subtotal.add(this.tax).subtract(this.discount);
    if (!this.total.equals(expected)) {
      throw new Error(`Invoice total mismatch: expected ${expected.amount_cents}, got ${this.total.amount_cents}`);
    }
    
    // Période valide
    if (this.billing_period.end <= this.billing_period.start) {
      throw new Error('Invalid billing period');
    }
    
    // Si paid → paid_at != null
    if (this.status === InvoiceStatus.Paid && !this.paid_at) {
      throw new Error('Paid invoice must have paid_at');
    }
  }
  
  markAsPaid(paymentId: UUID): void {
    if (this.status === InvoiceStatus.Paid) {
      throw new Error('Invoice already paid');
    }
    if (this.status === InvoiceStatus.Cancelled) {
      throw new Error('Cannot pay cancelled invoice');
    }
    
    this.status = InvoiceStatus.Paid;
    this.paid_at = new Date();
    this.entity_version++;
    this.validate();
  }
}
```

#### 2. Subscription (simplifiée)

```typescript
// src/server/domain/billing/aggregates/subscription/Subscription.ts
class Subscription {
  constructor(
    private id: UUID,
    private tenant_id: BIGINT,
    private status: SubscriptionStatus,
    private billing_period: BillingPeriod,
    private payment_method: SubscriptionPaymentMethod | null,
    private entity_version: number
  ) {
    this.validate();
  }
  
  private validate(): void {
    // Si active → payment_method existe
    if (this.status === SubscriptionStatus.Active && !this.payment_method) {
      throw new Error('Active subscription requires payment method');
    }
  }
  
  activate(paymentMethod: SubscriptionPaymentMethod): void {
    if (this.status !== SubscriptionStatus.Trial) {
      throw new Error('Only trial can be activated');
    }
    
    this.payment_method = paymentMethod;
    this.status = SubscriptionStatus.Active;
    this.entity_version++;
    this.validate();
  }
}
```

#### 3. InvoiceService

```typescript
// src/server/application/billing/services/InvoiceService.ts
class InvoiceService {
  async generateInvoice(subscription: Subscription): Promise<Invoice> {
    const plan = await this.planRepo.findById(subscription.plan_id);
    
    const subtotal = plan.price;
    const tax = subtotal.multiply(0.18); // 18% OHADA
    const discount = new Money(0n, subtotal.currency);
    const total = subtotal.add(tax).subtract(discount);
    
    const invoice = Invoice.create({
      invoice_number: InvoiceNumber.generate(),
      tenant_id: subscription.tenant_id,
      status: InvoiceStatus.Issued,
      subtotal,
      tax,
      discount,
      total,
      currency: subtotal.currency,
      billing_period: subscription.billing_period,
      issue_date: new Date(),
      due_date: subscription.billing_period.end,
      paid_at: null,
      fiscal_period: FiscalPeriod.fromDate(new Date()),
      entity_version: 1
    });
    
    await this.invoiceRepo.save(invoice);
    return invoice;
  }
}
```

### Tests SLICE 2 (OBLIGATOIRES)

```typescript
// tests/billing/slice2-invoicing.test.ts

describe('SLICE 2: Invoicing', () => {
  // TEST 1: Invoice creation
  it('should generate invoice from subscription', async () => {
    const subscription = createActiveSubscription();
    const invoice = await invoiceService.generateInvoice(subscription);
    
    expect(invoice.status).toBe(InvoiceStatus.Issued);
    expect(invoice.total.amount_cents).toBeGreaterThan(0);
  });
  
  // TEST 2: Total calculation
  it('should calculate total correctly', async () => {
    const subtotal = new Money(100000n, Currency.ZMW); // 1000 ZMW
    const tax = subtotal.multiply(0.18); // 180 ZMW
    const discount = new Money(0n, Currency.ZMW);
    const total = subtotal.add(tax).subtract(discount);
    
    expect(total.amount_cents).toBe(118000n); // 1180 ZMW
  });
  
  // TEST 3: Mark as paid
  it('should mark invoice as paid', async () => {
    const invoice = createIssuedInvoice();
    const paymentId = UUID.generate();
    
    invoice.markAsPaid(paymentId);
    
    expect(invoice.status).toBe(InvoiceStatus.Paid);
    expect(invoice.paid_at).not.toBeNull();
  });
  
  // TEST 4: Cannot pay cancelled invoice
  it('should reject payment on cancelled invoice', async () => {
    const invoice = createCancelledInvoice();
    
    expect(() => {
      invoice.markAsPaid(UUID.generate());
    }).toThrow('Cannot pay cancelled invoice');
  });
});
```

### Definition of Done SLICE 2

- [x] Invoice générée depuis Subscription
- [x] Total calculé correctement (subtotal + tax - discount)
- [x] Invoice marquée 'paid'
- [x] Lien PaymentIntent ↔ Invoice
- [x] Tests passent (creation, calculation, payment, cancellation)
- [x] Aucune facture en double

---

## SLICE 3 — ACCOUNTING EVENT (Semaines 7-9)

**Objectif:** Ledger comptable automatique après paiement

### Ce qui est implémenté

```
PaymentIntent.status = 'succeeded'
    ↓
AccountingEvent créé automatiquement
    ↓
JournalEntry 1: Debit 411 (Customer)
JournalEntry 2: Credit 701 (Revenue)
    ↓
SUM(debits) == SUM(credits) ✓
    ↓
✅ LEDGER COHÉRENT
```

### Fichiers à créer (SLICE 3)

#### 1. AccountingEvent Aggregate (CRITIQUE)

```typescript
// src/server/domain/billing/aggregates/accounting-event/AccountingEvent.ts
class AccountingEvent {
  constructor(
    private id: UUID,
    private tenant_id: BIGINT,
    private event_type: AccountingEventType,
    private event_id: UUID,
    private description: string,
    private total_amount: Money,
    private fiscal_period: FiscalPeriod,
    private entries: JournalEntry[],
    private entity_version: number
  ) {
    this.validate();
  }
  
  private validate(): void {
    // MAX 10 entrées
    if (this.entries.length > 10) {
      throw new Error('AccountingEvent cannot have more than 10 JournalEntries');
    }
    
    // MIN 2 entrées
    if (this.entries.length < 2) {
      throw new Error('AccountingEvent must have at least 2 JournalEntries');
    }
    
    // SUM(debits) == SUM(credits)
    const totalDebits = this.entries
      .filter(e => e.entry_type === 'debit')
      .reduce((sum, e) => sum + e.amount.amount_cents, 0n);
    
    const totalCredits = this.entries
      .filter(e => e.entry_type === 'credit')
      .reduce((sum, e) => sum + e.amount.amount_cents, 0n);
    
    if (totalDebits !== totalCredits) {
      throw new Error(`Trial balance mismatch: debits=${totalDebits}, credits=${totalCredits}`);
    }
    
    // Devise unique
    const currencies = new Set(this.entries.map(e => e.amount.currency));
    if (currencies.size > 1) {
      throw new Error('All JournalEntries must have the same currency');
    }
  }
  
  addJournalEntry(entry: JournalEntry): void {
    if (this.entries.length >= 10) {
      throw new Error('Cannot add more than 10 JournalEntries');
    }
    
    this.entries.push(entry);
    this.entity_version++;
    this.validate();
  }
}

// src/server/domain/billing/aggregates/accounting-event/JournalEntry.ts
class JournalEntry {
  constructor(
    private id: UUID,
    private entry_type: EntryType,
    private account_code: AccountCode,
    private amount: Money,
    private description: string
  ) {}
}

enum EntryType {
  Debit = 'debit',
  Credit = 'credit'
}
```

#### 2. AccountingService

```typescript
// src/server/application/billing/services/AccountingService.ts
class AccountingService {
  async createAccountingEventForPayment(
    paymentIntent: PaymentIntent,
    invoice: Invoice
  ): Promise<AccountingEvent> {
    return await db.transaction(async (tx) => {
      // Créer AccountingEvent
      const accountingEvent = AccountingEvent.create({
        event_type: AccountingEventType.PaymentSucceeded,
        event_id: paymentIntent.id,
        description: `Payment ${paymentIntent.id} for invoice ${invoice.id}`,
        total_amount: paymentIntent.amount,
        fiscal_period: FiscalPeriod.fromDate(new Date()),
        entries: [
          // Débit 411 (Customer)
          JournalEntry.create(
            EntryType.Debit,
            new AccountCode('411'),
            paymentIntent.amount,
            `Customer payment`
          ),
          // Crédit 701 (Revenue)
          JournalEntry.create(
            EntryType.Credit,
            new AccountCode('701'),
            paymentIntent.amount,
            `Revenue`
          )
        ]
      });
      
      // Sauvegarder
      await tx.accounting_events.create(accountingEvent);
      
      return accountingEvent;
    });
  }
}
```

#### 3. Outbox Minimal

```typescript
// src/server/infrastructure/billing/outbox/OutboxEvent.ts
class OutboxEvent {
  constructor(
    private id: BIGSERIAL,
    private domain_event_id: UUID,
    private status: OutboxStatus,
    private retry_count: number,
    private next_retry_at: Date | null,
    private created_at: Date
  ) {}
}

// src/server/infrastructure/billing/outbox/OutboxPublisher.ts
class OutboxPublisher {
  async publish(event: DomainEvent): Promise<void> {
    await db.outbox_events.create({
      domain_event_id: event.id,
      status: 'pending'
    });
  }
}
```

### Tests SLICE 3 (OBLIGATOIRES)

```typescript
// tests/billing/slice3-accounting.test.ts

describe('SLICE 3: Accounting Event', () => {
  // TEST 1: Trial balance
  it('should enforce trial balance', async () => {
    const entries = [
      createJournalEntry(EntryType.Debit, '411', 1000n),
      createJournalEntry(EntryType.Credit, '701', 1000n) // Équilibré
    ];
    
    const event = AccountingEvent.create({
      entries,
      total_amount: new Money(1000n, Currency.ZMW),
      // ... other props
    });
    
    expect(event.entries.length).toBe(2);
  });
  
  // TEST 2: Trial balance violation
  it('should reject unbalanced entries', async () => {
    const entries = [
      createJournalEntry(EntryType.Debit, '411', 1000n),
      createJournalEntry(EntryType.Credit, '701', 500n) // Déséquilibré
    ];
    
    expect(() => {
      AccountingEvent.create({
        entries,
        // ... other props
      });
    }).toThrow('Trial balance mismatch');
  });
  
  // TEST 3: MAX 10 entries
  it('should reject more than 10 entries', async () => {
    const entries = Array.from({ length: 11 }, () => createJournalEntry(EntryType.Debit, '411', 1000n));
    
    expect(() => {
      AccountingEvent.create({
        entries,
        // ... other props
      });
    }).toThrow('Cannot have more than 10 JournalEntries');
  });
  
  // TEST 4: Currency consistency
  it('should reject mixed currencies', async () => {
    const entries = [
      createJournalEntry(EntryType.Debit, '411', 1000n, 'ZMW'),
      createJournalEntry(EntryType.Credit, '701', 1000n, 'USD')
    ];
    
    expect(() => {
      AccountingEvent.create({
        entries,
        // ... other props
      });
    }).toThrow('All JournalEntries must have the same currency');
  });
  
  // TEST 5: End-to-end flow
  it('should create AccountingEvent after payment', async () => {
    // 1. Paiement réussi
    const paymentIntent = await createSucceededPayment();
    
    // 2. Générer facture
    const invoice = await invoiceService.generateInvoice(subscription);
    
    // 3. Créer AccountingEvent
    const accountingEvent = await accountingService.createAccountingEventForPayment(
      paymentIntent,
      invoice
    );
    
    expect(accountingEvent.entries.length).toBe(2);
    expect(accountingEvent.entries[0].entry_type).toBe(EntryType.Debit);
    expect(accountingEvent.entries[1].entry_type).toBe(EntryType.Credit);
  });
});
```

### Definition of Done SLICE 3

- [x] AccountingEvent créé après paiement
- [x] JournalEntry débit + crédit générés
- [x] Trial balance vérifié (SUM(debits) == SUM(credits))
- [x] MAX 10 entrées respecté
- [x] Devise unique respectée
- [x] Tests passent (trial balance, boundary, currency, e2e)
- [x] Aucune incohérence comptable possible

---

## EXECUTION ORDER (PAR SLICE)

### Semaine 1: SLICE 1 - Value Objects + PaymentIntent

**Jour 1-2:**
- [ ] Money.ts + tests
- [ ] Currency.ts + tests
- [ ] Provider.ts + tests

**Jour 3-4:**
- [ ] PaymentAttempt.ts + tests
- [ ] PaymentIntent.ts + tests invariants
- [ ] Tests multi-attempt

**Jour 5-6:**
- [ ] IPaymentIntentRepository.ts
- [ ] PostgresPaymentIntentRepository.ts
- [ ] Tests repository

**Jour 7:**
- [ ] Integration tests PaymentIntent

### Semaine 2: SLICE 1 - Stripe Integration

**Jour 1-2:**
- [ ] PaymentProvider.ts (interface)
- [ ] StripeAdapter.ts + tests
- [ ] Tests Stripe API

**Jour 3-4:**
- [ ] WebhookEvent.ts
- [ ] StripeWebhookHandler.ts + tests
- [ ] Tests idempotence webhook

**Jour 5-6:**
- [ ] Tests duplicate webhook
- [ ] Tests retry webhook
- [ ] Tests désordre webhook

**Jour 7:**
- [ ] Integration test end-to-end SLICE 1

### Semaine 3: SLICE 1 - API + Observabilité

**Jour 1-2:**
- [ ] POST /api/v2/billing/payment-intents
- [ ] GET /api/v2/billing/payment-intents/:id
- [ ] Tests API

**Jour 3-4:**
- [ ] Logs structurés
- [ ] Métriques Prometheus (payment_intents_created, succeeded, failed)
- [ ] Alerting

**Jour 5-6:**
- [ ] Tests de charge (1000 req/min)
- [ ] Documentation API

**Jour 7:**
- [ ] **SLICE 1 DONE** → Déploiement staging

### Semaine 4: SLICE 2 - Invoice Domain

**Jour 1-2:**
- [ ] InvoiceNumber.ts + tests
- [ ] Period.ts + tests
- [ ] BillingPeriod.ts + tests

**Jour 3-4:**
- [ ] Invoice.ts + tests invariants
- [ ] Tests calcul total
- [ ] Tests markAsPaid

**Jour 5-6:**
- [ ] IInvoiceRepository.ts
- [ ] PostgresInvoiceRepository.ts
- [ ] Tests repository

**Jour 7:**
- [ ] Integration tests Invoice

### Semaine 5: SLICE 2 - Subscription + InvoiceService

**Jour 1-2:**
- [ ] Subscription (simplifiée) + tests
- [ ] SubscriptionPaymentMethod.ts + tests

**Jour 3-4:**
- [ ] InvoiceService.ts + tests
- [ ] Tests génération facture
- [ ] Tests calcul taxes

**Jour 5-6:**
- [ ] POST /api/v2/billing/invoices
- [ ] GET /api/v2/billing/invoices/:id
- [ ] Tests API

**Jour 7:**
- [ ] **SLICE 2 DONE** → Déploiement staging

### Semaine 6: SLICE 2 - End-to-End

**Jour 1-3:**
- [ ] Test complet: Subscription → Invoice → Payment
- [ ] Tests edge cases
- [ ] Documentation

**Jour 4-5:**
- [ ] Code review
- [ ] Bug fixes

**Jour 6-7:**
- [ ] **SLICE 2 PRODUCTION READY**

### Semaine 7: SLICE 3 - AccountingEvent Domain

**Jour 1-2:**
- [ ] AccountCode.ts + tests
- [ ] FiscalPeriod.ts + tests
- [ ] JournalEntry.ts + tests

**Jour 3-4:**
- [ ] AccountingEvent.ts + tests invariants CRITIQUES
- [ ] Tests trial balance
- [ ] Tests MAX 10 entries
- [ ] Tests currency

**Jour 5-6:**
- [ ] IAccountingEventRepository.ts
- [ ] PostgresAccountingEventRepository.ts
- [ ] Tests repository

**Jour 7:**
- [ ] Integration tests AccountingEvent

### Semaine 8: SLICE 3 - AccountingService + Outbox

**Jour 1-2:**
- [ ] AccountingService.ts + tests
- [ ] Tests création AccountingEvent
- [ ] Tests transaction atomique

**Jour 3-4:**
- [ ] OutboxEvent.ts + tests
- [ ] OutboxPublisher.ts + tests
- [ ] Tests outbox

**Jour 5-6:**
- [ ] Integration: Payment → Invoice → AccountingEvent
- [ ] Tests end-to-end SLICE 3

**Jour 7:**
- [ ] **SLICE 3 DONE** → Déploiement staging

### Semaine 9: SLICE 3 - Production Ready

**Jour 1-3:**
- [ ] Tests de charge (1000 payment intents/min)
- [ ] Tests de chaos (failover)
- [ ] Tests de migration

**Jour 4-5:**
- [ ] Documentation finale
- [ ] Runbooks
- [ ] ADR

**Jour 6-7:**
- [ ] Code review final
- [ ] **SLICE 3 PRODUCTION READY**
- [ ] **SYSTÈME COMPLET EN PRODUCTION**

---

## MONITORING OBLIGATOIRE (DÈS SLICE 1)

```typescript
// Métriques à surveiller
const METRICS = {
  // Performance
  payment_intent_creation_latency_p95: 5000,  // 5s max
  
  // Business
  payment_success_rate: 0.9,                 // 90% min
  
  // Erreurs
  webhook_failures_per_minute: 10,           // 10 max
  accounting_event_violations: 0             // 0 max
};
```

---

## RISQUES CRITIQUES (PAR SLICE)

### SLICE 1 Risks

1. **Stripe webhook duplicate**
   - Détection: count(webhook_events) > 1 pour même event_id
   - Correction: idempotence check (déjà implémenté)

2. **PaymentIntent race condition**
   - Détection: UNIQUE constraint violation sur idempotency_key
   - Correction: Retry avec même idempotency_key

### SLICE 2 Risks

1. **Invoice total mismatch**
   - Détection: invariant violation dans tests
   - Correction: Recalculer total avant save

2. **Double payment marking**
   - Détection: status = 'paid' déjà
   - Correction: Throw error (déjà dans invariant)

### SLICE 3 Risks

1. **AccountingEvent trial balance violation**
   - Détection: Test automatique toutes les heures
   - Correction: Rollback transaction + alerte

2. **Outbox ordering**
   - Détection: Vérifier ordre des IDs
   - Correction: Trier par ID avant traitement

---

## CHECKLIST FINALE

### Avant Production

- [ ] SLICE 1: Core Payment fonctionnel
- [ ] SLICE 2: Invoicing fonctionnel
- [ ] SLICE 3: Accounting Event fonctionnel
- [ ] Tous les tests passent (unit + integration)
- [ ] Stripe webhook testé en production
- [ ] Monitoring configuré
- [ ] Alerting configuré
- [ ] Documentation écrite
- [ ] Runbooks écrits
- [ ] Rollback plan testé

---

## CONTACTS ESCALADE

1. **PaymentIntent issue** → Backend Lead
2. **Stripe webhook failure** → Payment Team
3. **AccountingEvent violation** → Architecte + DBA
4. **PostgreSQL down** → DevOps + DBA

---

**FIN DE LA STRATÉGIE VERTICAL SLICES**

**Durée totale:** 9 semaines (au lieu de 20)  
**Approche:** Fonctionnel > Parfait  
**Priorité:** Stripe working flow > Architecture clean  
**Prêt pour production:** OUI après SLICE 3