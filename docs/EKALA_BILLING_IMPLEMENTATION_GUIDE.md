# Ekala Billing — Implementation Guide (Contract d'Implémentation)

**Version:** 1.0 (basé sur Blueprint V3.4 gelé)  
**Statut:** Contrat d'implémentation strict  
**Date:** 30/06/2026  
**Objectif:** Transformer le blueprint en système implémentable sans ambiguïté

---

## RÈGLES D'OR (NON NÉGOCIABLES)

1. ❌ NE PAS créer de nouvelle version du blueprint
2. ❌ NE PAS changer les choix DDD fondamentaux
3. ❌ NE PAS réintroduire Ledger comme Aggregate
4. ❌ NE PAS modifier AccountingEvent comme Aggregate Root
5. ❌ NE PAS ajouter de nouvelles abstractions
6. ✅ Rendre implémentable, testable, exécutable
7. ✅ Verrouiller les zones critiques avec des tests

---

## 1. IMPLEMENTATION BLUEPRINT (CODE STRUCTURE)

### 1.1 Structure des Dossiers Backend

```
src/server/
├── domain/
│   └── billing/
│       ├── aggregates/
│       │   ├── subscription/
│       │   │   ├── Subscription.ts
│       │   │   ├── SubscriptionPaymentMethod.ts
│       │   │   ├── SubscriptionTrial.ts
│       │   │   └── index.ts
│       │   ├── payment-intent/
│       │   │   ├── PaymentIntent.ts
│       │   │   ├── PaymentAttempt.ts
│       │   │   └── index.ts
│       │   ├── invoice/
│       │   │   ├── Invoice.ts
│       │   │   ├── ExternalInvoiceReference.ts
│       │   │   └── index.ts
│       │   └── accounting-event/
│       │       ├── AccountingEvent.ts
│       │       ├── JournalEntry.ts
│       │       └── index.ts
│       │
│       ├── value-objects/
│       │   ├── Money.ts
│       │   ├── Period.ts
│       │   ├── BillingPeriod.ts
│       │   ├── TrialPeriod.ts
│       │   ├── RenewalSettings.ts
│       │   ├── CancellationSettings.ts
│       │   ├── FiscalPeriod.ts
│       │   ├── InvoiceNumber.ts
│       │   ├── AccountCode.ts
│       │   ├── Currency.ts
│       │   └── Provider.ts
│       │
│       ├── policies/
│       │   ├── RenewalPolicy.ts
│       │   ├── TrialPolicy.ts
│       │   ├── CancellationPolicy.ts
│       │   ├── RefundPolicy.ts
│       │   └── UpgradePolicy.ts
│       │
│       ├── events/
│       │   ├── SubscriptionCreated.ts
│       │   ├── SubscriptionActivated.ts
│       │   ├── SubscriptionCancelled.ts
│       │   ├── PaymentIntentCreated.ts
│       │   ├── PaymentIntentSucceeded.ts
│       │   ├── PaymentIntentFailed.ts
│       │   ├── InvoiceCreated.ts
│       │   ├── InvoiceIssued.ts
│       │   ├── InvoicePaid.ts
│       │   └── AccountingEventCreated.ts
│       │
│       └── repositories/
│           ├── ISubscriptionRepository.ts
│           ├── IPaymentIntentRepository.ts
│           ├── IInvoiceRepository.ts
│           └── IAccountingEventRepository.ts
│
├── application/
│   └── billing/
│       ├── services/
│       │   ├── SubscriptionService.ts
│       │   ├── PaymentService.ts
│       │   ├── InvoiceService.ts
│       │   ├── AccountingService.ts
│       │   └── ReconciliationService.ts
│       │
│       ├── sagas/
│       │   ├── SubscriptionCreationSaga.ts
│       │   ├── PaymentProcessingSaga.ts
│       │   └── InvoiceGenerationSaga.ts
│       │
│       └── event-handlers/
│           ├── SubscriptionEventHandler.ts
│           ├── PaymentEventHandler.ts
│           └── AccountingEventHandler.ts
│
├── infrastructure/
│   └── billing/
│       ├── repositories/
│       │   ├── PostgresSubscriptionRepository.ts
│       │   ├── PostgresPaymentIntentRepository.ts
│       │   ├── PostgresInvoiceRepository.ts
│       │   └── PostgresAccountingEventRepository.ts
│       │
│       ├── providers/
│       │   ├── PaymentProvider.ts (interface)
│       │   ├── StripeAdapter.ts
│       │   ├── CashAdapter.ts
│       │   └── VoucherAdapter.ts
│       │
│       ├── outbox/
│       │   ├── OutboxEvent.ts
│       │   ├── OutboxPublisher.ts
│       │   ├── SqliteOutboxSyncWorker.ts
│       │   └── DeadLetterQueue.ts
│       │
│       ├── webhooks/
│       │   ├── StripeWebhookHandler.ts
│       │   └── WebhookEvent.ts
│       │
│       ├── policies/
│       │   ├── RetryPolicy.ts
│       │   ├── TimeoutPolicy.ts
│       │   └── CircuitBreakerPolicy.ts
│       │
│       └── persistence/
│           ├── database.ts
│           ├── migrations/
│           │   └── 048_billing_v3_4.sql
│           └── enums.ts
│
├── interfaces/
│   └── billing/
│       ├── routes/
│       │   ├── subscription.routes.ts
│       │   ├── payment.routes.ts
│       │   ├── invoice.routes.ts
│       │   └── accounting.routes.ts
│       │
│       └── middleware/
│           ├── billing-auth.middleware.ts
│           └── idempotency.middleware.ts
│
└── tests/
    └── billing/
        ├── unit/
        │   ├── aggregates/
        │   │   ├── Subscription.test.ts
        │   │   ├── PaymentIntent.test.ts
        │   │   ├── Invoice.test.ts
        │   │   └── AccountingEvent.test.ts
        │   ├── value-objects/
        │   │   ├── Money.test.ts
        │   │   └── Period.test.ts
        │   └── policies/
        │       ├── RenewalPolicy.test.ts
        │       └── RefundPolicy.test.ts
        │
        ├── integration/
        │   ├── payment-flow.test.ts
        │   ├── webhook-handling.test.ts
        │   └── accounting-event.test.ts
        │
        └── architecture/
            ├── aggregate-boundaries.test.ts
            ├── idempotency.test.ts
            ├── optimistic-locking.test.ts
            └── outbox-replay.test.ts
```

### 1.2 Mapping Exact des Aggregates V3.4

```
AGGREGATE 1: Subscription
├── Fichier: src/server/domain/billing/aggregates/subscription/Subscription.ts
├── Entités: SubscriptionPaymentMethod, SubscriptionTrial
├── VO: BillingPeriod, TrialPeriod, RenewalSettings, CancellationSettings
├── Repository: ISubscriptionRepository
└── Implémentation: PostgresSubscriptionRepository

AGGREGATE 2: PaymentIntent
├── Fichier: src/server/domain/billing/aggregates/payment-intent/PaymentIntent.ts
├── Entités: PaymentAttempt[]
├── VO: Money, Currency, Provider
├── Repository: IPaymentIntentRepository
└── Implémentation: PostgresPaymentIntentRepository

AGGREGATE 3: Invoice
├── Fichier: src/server/domain/billing/aggregates/invoice/Invoice.ts
├── Entités: ExternalInvoiceReference[]
├── VO: InvoiceNumber, Money, Period
├── Repository: IInvoiceRepository
└── Implémentation: PostgresInvoiceRepository

AGGREGATE 4: AccountingEvent
├── Fichier: src/server/domain/billing/aggregates/accounting-event/AccountingEvent.ts
├── Entités: JournalEntry[] (MAX 10)
├── VO: Money, FiscalPeriod, AccountCode
├── Repository: IAccountingEventRepository
└── Implémentation: PostgresAccountingEventRepository
```

---

## 2. DOMAIN CONTRACTS (STRICT TYPES + RULES)

### 2.1 AccountingEvent Aggregate (CRITIQUE)

**Fichier:** `src/server/domain/billing/aggregates/accounting-event/AccountingEvent.ts`

```typescript
// TYPES
interface AccountingEventProps {
  id: UUID;
  tenant_id: BIGINT;
  event_type: AccountingEventType;
  event_id: UUID;  // Référence au Domain Event
  description: string;
  total_amount: Money;
  fiscal_period: FiscalPeriod;
  entries: JournalEntry[];
  entity_version: number;
}

// INVARIANTS (à vérifier dans le constructeur et chaque méthode)
class AccountingEvent {
  constructor(private props: AccountingEventProps) {
    this.validateInvariants();
  }
  
  // RÈGLES DE VALIDATION (OBLIGATOIRES)
  private validateInvariants(): void {
    // 1. MAX 10 entrées par AccountingEvent
    if (this.props.entries.length > 10) {
      throw new Error('AccountingEvent cannot have more than 10 JournalEntries');
    }
    
    // 2. MIN 2 entrées (débit + crédit)
    if (this.props.entries.length < 2) {
      throw new Error('AccountingEvent must have at least 2 JournalEntries');
    }
    
    // 3. SUM(debits) == SUM(credits)
    const totalDebits = this.props.entries
      .filter(e => e.entry_type === 'debit')
      .reduce((sum, e) => sum + e.amount.amount_cents, 0n);
    
    const totalCredits = this.props.entries
      .filter(e => e.entry_type === 'credit')
      .reduce((sum, e) => sum + e.amount.amount_cents, 0n);
    
    if (totalDebits !== totalCredits) {
      throw new Error(`Trial balance mismatch: debits=${totalDebits}, credits=${totalCredits}`);
    }
    
    // 4. Toutes les entrées ont la même devise
    const currencies = new Set(this.props.entries.map(e => e.amount.currency));
    if (currencies.size > 1) {
      throw new Error('All JournalEntries must have the same currency');
    }
    
    // 5. Période fiscale valide
    if (!FiscalPeriod.isValid(this.props.fiscal_period)) {
      throw new Error('Invalid fiscal period');
    }
  }
  
  // MÉTHODES AUTORISÉES
  addJournalEntry(entry: JournalEntry): void {
    // Vérifier MAX 10
    if (this.props.entries.length >= 10) {
      throw new Error('Cannot add more than 10 JournalEntries');
    }
    
    this.props.entries.push(entry);
    this.props.entity_version += 1;
    this.validateInvariants();  // Re-valider
  }
  
  // CE QUI EST INTERDIT
  // ❌ deleteJournalEntry() - pas de suppression
  // ❌ updateJournalEntry() - pas de modification
  // ❌ addMoreThan10Entries() - limite stricte
  // ❌ createWithMismatchedEntries() - invariant violé
}
```

**RÈGLES STRICTES:**
1. MAX 10 JournalEntry par AccountingEvent
2. MIN 2 JournalEntry (débit + crédit)
3. SUM(debits) == SUM(credits) TOUJOURS
4. Toutes les entrées = même devise
5. Pas de modification après création (seulement reversal)
6. Ledger = projection/read model (pas d'accès direct)

### 2.2 PaymentIntent Aggregate

**Fichier:** `src/server/domain/billing/aggregates/payment-intent/PaymentIntent.ts`

```typescript
// TYPES
interface PaymentIntentProps {
  id: UUID;
  tenant_id: BIGINT;
  amount: Money;
  currency: Currency;
  status: PaymentIntentStatus;
  provider: Provider;
  expires_at: Date;
  paid_at: Date | null;
  refunded_amount: Money;
  attempts: PaymentAttempt[];
  entity_version: number;
  idempotency_key: UUID;
}

// INVARIANTS
class PaymentIntent {
  private validateInvariants(): void {
    // 1. Montant > 0
    if (this.props.amount.amount_cents <= 0n) {
      throw new Error('PaymentIntent amount must be positive');
    }
    
    // 2. Au moins 1 attempt
    if (this.props.attempts.length === 0) {
      throw new Error('PaymentIntent must have at least 1 PaymentAttempt');
    }
    
    // 3. Si succeeded → au moins 1 attempt succeeded
    if (this.props.status === PaymentIntentStatus.Succeeded) {
      const hasSucceeded = this.props.attempts.some(a => a.status === PaymentAttemptStatus.Succeeded);
      if (!hasSucceeded) {
        throw new Error('Succeeded PaymentIntent must have at least 1 succeeded attempt');
      }
    }
    
    // 4. Si refunded → refunded_amount <= amount
    if (this.props.status === PaymentIntentStatus.Refunded) {
      if (this.props.refunded_amount.amount_cents > this.props.amount.amount_cents) {
        throw new Error('Refunded amount cannot exceed original amount');
      }
    }
    
    // 5. Attempts ordonnés par attempt_number
    for (let i = 0; i < this.props.attempts.length; i++) {
      if (this.props.attempts[i].attempt_number !== i + 1) {
        throw new Error('PaymentAttempts must be ordered by attempt_number');
      }
    }
  }
  
  // MÉTHODES AUTORISÉES
  addAttempt(attempt: PaymentAttempt): void {
    const nextAttemptNumber = this.props.attempts.length + 1;
    if (attempt.attempt_number !== nextAttemptNumber) {
      throw new Error(`Expected attempt_number ${nextAttemptNumber}`);
    }
    
    this.props.attempts.push(attempt);
    this.props.entity_version += 1;
    this.validateInvariants();
  }
  
  markAsSucceeded(attemptId: UUID): void {
    const attempt = this.props.attempts.find(a => a.id === attemptId);
    if (!attempt) {
      throw new Error('Attempt not found');
    }
    
    attempt.markAsSucceeded();
    this.props.status = PaymentIntentStatus.Succeeded;
    this.props.paid_at = new Date();
    this.props.entity_version += 1;
    this.validateInvariants();
  }
  
  // CE QUI EST INTERDIT
  // ❌ removeAttempt() - pas de suppression
  // ❌ modifyAttempt() - les attempts sont immuables
  // ❌ createWithoutAttempts() - minimum 1
}
```

### 2.3 Subscription Aggregate

**Fichier:** `src/server/domain/billing/aggregates/subscription/Subscription.ts`

```typescript
// TYPES
interface SubscriptionProps {
  id: UUID;
  tenant_id: BIGINT;
  status: SubscriptionStatus;
  billing_period: BillingPeriod;
  trial_period: TrialPeriod | null;
  renewal_settings: RenewalSettings;
  cancellation: CancellationSettings | null;
  payment_method: SubscriptionPaymentMethod | null;
  entity_version: number;
}

// INVARIANTS
class Subscription {
  private validateInvariants(): void {
    // 1. Période de facturation valide
    if (this.props.billing_period.end <= this.props.billing_period.start) {
      throw new Error('Billing period end must be after start');
    }
    
    // 2. Si trial → trial_period existe et est valide
    if (this.props.status === SubscriptionStatus.Trial) {
      if (!this.props.trial_period) {
        throw new Error('Trial subscription must have a trial period');
      }
      if (!this.props.trial_period.isValid()) {
        throw new Error('Trial period is not valid');
      }
    }
    
    // 3. Si active → payment_method existe
    if (this.props.status === SubscriptionStatus.Active) {
      if (!this.props.payment_method) {
        throw new Error('Active subscription must have a payment method');
      }
    }
    
    // 4. Si cancelled → cancelled_at != null
    if (this.props.status === SubscriptionStatus.Cancelled) {
      if (!this.props.cancellation) {
        throw new Error('Cancelled subscription must have cancellation settings');
      }
    }
  }
  
  // MÉTHODES AUTORISÉES
  activate(paymentMethod: SubscriptionPaymentMethod): void {
    if (this.props.status !== SubscriptionStatus.Trial) {
      throw new Error('Only trial subscriptions can be activated');
    }
    
    this.props.payment_method = paymentMethod;
    this.props.status = SubscriptionStatus.Active;
    this.props.entity_version += 1;
    this.validateInvariants();
  }
  
  cancel(cancellation: CancellationSettings): void {
    if (![SubscriptionStatus.Active, SubscriptionStatus.Trial, SubscriptionStatus.PastDue].includes(this.props.status)) {
      throw new Error('Cannot cancel subscription in current status');
    }
    
    this.props.cancellation = cancellation;
    this.props.status = SubscriptionStatus.Cancelled;
    this.props.entity_version += 1;
    this.validateInvariants();
  }
  
  // CE QUI EST INTERDIT
  // ❌ deletePaymentMethod() - suppression interdite
  // ❌ modifyBillingPeriod() - immutable
  // ❌ activateWithoutPaymentMethod() - invariant violé
}
```

### 2.4 Invoice Aggregate

**Fichier:** `src/server/domain/billing/aggregates/invoice/Invoice.ts`

```typescript
// TYPES
interface InvoiceProps {
  id: UUID;
  invoice_number: InvoiceNumber;
  tenant_id: BIGINT;
  status: InvoiceStatus;
  subtotal: Money;
  tax: Money;
  discount: Money;
  total: Money;
  currency: Currency;
  billing_period: Period;
  issue_date: Date;
  due_date: Date;
  paid_at: Date | null;
  fiscal_period: FiscalPeriod;
  external_references: ExternalInvoiceReference[];
  entity_version: number;
}

// INVARIANTS
class Invoice {
  private validateInvariants(): void {
    // 1. total = subtotal + tax - discount
    const expectedTotal = this.props.subtotal
      .add(this.props.tax)
      .subtract(this.props.discount);
    
    if (!this.props.total.equals(expectedTotal)) {
      throw new Error(`Invoice total mismatch: expected ${expectedTotal.amount_cents}, got ${this.props.total.amount_cents}`);
    }
    
    // 2. Période de facturation valide
    if (this.props.billing_period.end <= this.props.billing_period.start) {
      throw new Error('Billing period end must be after start');
    }
    
    // 3. Si paid → paid_at != null
    if (this.props.status === InvoiceStatus.Paid) {
      if (!this.props.paid_at) {
        throw new Error('Paid invoice must have paid_at date');
      }
    }
    
    // 4. Si issued → issue_date <= due_date
    if (this.props.status === InvoiceStatus.Issued) {
      if (this.props.issue_date > this.props.due_date) {
        throw new Error('Issue date must be before due date');
      }
    }
    
    // 5. Tous les montants >= 0
    if (this.props.subtotal.amount_cents < 0n || 
        this.props.tax.amount_cents < 0n ||
        this.props.discount.amount_cents < 0n) {
      throw new Error('Invoice amounts cannot be negative');
    }
  }
  
  // MÉTHODES AUTORISÉES
  markAsPaid(paymentId: UUID): void {
    if (this.props.status === InvoiceStatus.Paid) {
      throw new Error('Invoice is already paid');
    }
    if (this.props.status === InvoiceStatus.Cancelled) {
      throw new Error('Cannot pay a cancelled invoice');
    }
    
    this.props.status = InvoiceStatus.Paid;
    this.props.paid_at = new Date();
    this.props.entity_version += 1;
    this.validateInvariants();
  }
  
  // CE QUI EST INTERDIT
  // ❌ modifyTotal() - calculé automatiquement
  // ❌ delete() - soft delete interdit
  // ❌ updateAfterPaid() - facture payée = immuable
}
```

---

## 3. TEST SUITE D'INVARIANTS (CRITIQUE)

### 3.1 AccountingEvent Tests

```typescript
// tests/billing/unit/aggregates/AccountingEvent.test.ts

describe('AccountingEvent Aggregate', () => {
  // TEST 1: MAX 10 JournalEntry
  it('should reject more than 10 JournalEntries', () => {
    const entries = Array.from({ length: 11 }, (_, i) => 
      createJournalEntry(i + 1, 1000n)
    );
    
    expect(() => {
      AccountingEvent.create({
        entries,
        // ... other props
      });
    }).toThrow('Cannot have more than 10 JournalEntries');
  });
  
  // TEST 2: MIN 2 JournalEntry
  it('should reject less than 2 JournalEntries', () => {
    const entries = [createJournalEntry(1, 1000n)];
    
    expect(() => {
      AccountingEvent.create({
        entries,
        // ... other props
      });
    }).toThrow('Must have at least 2 JournalEntries');
  });
  
  // TEST 3: SUM(debits) == SUM(credits)
  it('should enforce trial balance', () => {
    const entries = [
      createJournalEntry(1, 'debit', 1000n),   // Débit: 1000
      createJournalEntry(2, 'credit', 500n)     // Crédit: 500  ← INCOHÉRENT
    ];
    
    expect(() => {
      AccountingEvent.create({
        entries,
        // ... other props
      });
    }).toThrow('Trial balance mismatch');
  });
  
  // TEST 4: Devise unique
  it('should reject mixed currencies', () => {
    const entries = [
      createJournalEntry(1, 'debit', 1000n, 'ZMW'),
      createJournalEntry(2, 'credit', 1000n, 'USD')  // Devise différente
    ];
    
    expect(() => {
      AccountingEvent.create({
        entries,
        // ... other props
      });
    }).toThrow('All JournalEntries must have the same currency');
  });
  
  // TEST 5: Atomicité (transaction rollback)
  it('should rollback if one JournalEntry fails', async () => {
    const accountingEvent = createValidAccountingEvent();
    
    // Tenter d'ajouter une 11ème entrée
    expect(() => {
      accountingEvent.addJournalEntry(createJournalEntry(11, 1000n));
    }).toThrow();
    
    // Vérifier que l'event n'a pas été modifié
    expect(accountingEvent.entries.length).toBe(10);
  });
});
```

### 3.2 Money Allocation Tests

```typescript
// tests/billing/unit/value-objects/Money.test.ts

describe('Money Value Object', () => {
  // TEST 1: allocate() répartit correctement
  it('should allocate money correctly', () => {
    const total = new Money(100000n, Currency.ZMW);  // 1000 ZMW
    const [line1, line2, line3] = total.allocate([0.5, 0.3, 0.2]);
    
    expect(line1.amount_cents).toBe(50000n);  // 500 ZMW
    expect(line2.amount_cents).toBe(30000n);  // 300 ZMW
    expect(line3.amount_cents).toBe(20000n);  // 200 ZMW
  });
  
  // TEST 2: allocate() gère les arrondis
  it('should handle rounding correctly', () => {
    const total = new Money(1001n, Currency.ZMW);  // 10.01 ZMW (impossible à diviser équitablement)
    const [line1, line2] = total.allocate([0.5, 0.5]);
    
    // Le reste va au dernier
    expect(line1.amount_cents + line2.amount_cents).toBe(1001n);
  });
  
  // TEST 3: allocate() refuse ratios invalides
  it('should reject invalid ratios', () => {
    const total = new Money(100000n, Currency.ZMW);
    
    expect(() => {
      total.allocate([0.5, 0.6]);  // Somme = 1.1
    }).toThrow('Ratios must sum to 1');
  });
  
  // TEST 4: add() refuse devises différentes
  it('should reject different currencies', () => {
    const zmw = new Money(1000n, Currency.ZMW);
    const usd = new Money(1000n, Currency.USD);
    
    expect(() => {
      zmw.add(usd);
    }).toThrow('Currency mismatch');
  });
  
  // TEST 5: compare() fonctionne
  it('should compare correctly', () => {
    const small = new Money(1000n, Currency.ZMW);
    const large = new Money(2000n, Currency.ZMW);
    
    expect(small.compare(large)).toBe(-1);
    expect(large.compare(small)).toBe(1);
    expect(small.compare(small)).toBe(0);
  });
});
```

### 3.3 PaymentAttempt Retry Tests

```typescript
// tests/billing/unit/aggregates/PaymentIntent.test.ts

describe('PaymentIntent Aggregate', () => {
  // TEST 1: Multi-attempt determinism
  it('should handle multiple attempts correctly', async () => {
    const paymentIntent = createPaymentIntent(1000n, Currency.ZMW);
    
    // Tentative 1: échoue
    const attempt1 = PaymentAttempt.create(1, Provider.Stripe, 'pi_123', PaymentAttemptStatus.Failed);
    paymentIntent.addAttempt(attempt1);
    
    // Tentative 2: réussit
    const attempt2 = PaymentAttempt.create(2, Provider.Stripe, 'pi_456', PaymentAttemptStatus.Succeeded);
    paymentIntent.addAttempt(attempt2);
    
    paymentIntent.markAsSucceeded(attempt2.id);
    
    expect(paymentIntent.status).toBe(PaymentIntentStatus.Succeeded);
    expect(paymentIntent.attempts.length).toBe(2);
  });
  
  // TEST 2: Idempotence (même webhook 2x)
  it('should handle duplicate webhooks', async () => {
    const paymentIntent = createPaymentIntent(1000n, Currency.ZMW);
    const attempt = PaymentAttempt.create(1, Provider.Stripe, 'pi_123', PaymentAttemptStatus.Succeeded);
    paymentIntent.addAttempt(attempt);
    
    // Premier webhook
    paymentIntent.markAsSucceeded(attempt.id);
    
    // Deuxième webhook (même event_id)
    // → Doit être ignoré (idempotence)
    const result = await webhookHandler.handle('payment_intent.succeeded', {
      payment_intent: 'pi_123'
    });
    
    expect(result.status).toBe('already_processed');
  });
  
  // TEST 3: Retry sans duplication
  it('should not create duplicate attempts on retry', async () => {
    const paymentIntent = createPaymentIntent(1000n, Currency.ZMW);
    
    // Créer tentative 1
    const attempt1 = PaymentAttempt.create(1, Provider.Stripe, 'pi_123', PaymentAttemptStatus.Failed);
    paymentIntent.addAttempt(attempt1);
    
    // Retry → tentative 2
    const attempt2 = PaymentAttempt.create(2, Provider.Stripe, 'pi_123', PaymentAttemptStatus.Failed);
    paymentIntent.addAttempt(attempt2);
    
    expect(paymentIntent.attempts.length).toBe(2);
    expect(paymentIntent.attempts[0].attempt_number).toBe(1);
    expect(paymentIntent.attempts[1].attempt_number).toBe(2);
  });
});
```

### 3.4 Outbox Replay Tests

```typescript
// tests/billing/integration/outbox-replay.test.ts

describe('Outbox Replay', () => {
  // TEST 1: Ordering garanti
  it('should process events in order', async () => {
    const events = [
      createOutboxEvent(1, 'SubscriptionCreated'),
      createOutboxEvent(2, 'SubscriptionActivated'),
      createOutboxEvent(3, 'PaymentIntentCreated')
    ];
    
    const processed = await syncWorker.processEvents(events);
    
    expect(processed[0].event_type).toBe('SubscriptionCreated');
    expect(processed[1].event_type).toBe('SubscriptionActivated');
    expect(processed[2].event_type).toBe('PaymentIntentCreated');
  });
  
  // TEST 2: Replay idempotent
  it('should not replay already processed events', async () => {
    const event = createOutboxEvent(1, 'SubscriptionCreated');
    event.status = 'sent';
    
    const result = await syncWorker.processEvent(event);
    
    expect(result).toBe('skipped');
  });
  
  // TEST 3: Recovery après crash
  it('should resume from last processed ID', async () => {
    const events = [
      createOutboxEvent(1, 'Event1'),
      createOutboxEvent(2, 'Event2'),
      createOutboxEvent(3, 'Event3')
    ];
    
    // Simuler crash après event 2
    syncWorker.setLastProcessedId(2);
    
    // Reprendre
    const remaining = await syncWorker.processRemaining();
    
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe(3);
  });
  
  // TEST 4: DLQ handling
  it('should move to DLQ after max retries', async () => {
    const event = createOutboxEvent(1, 'FailingEvent');
    event.retry_count = 3;  // Max retries atteint
    
    await syncWorker.processEvent(event);
    
    const dlqEntry = await dlq.findByOutboxId(event.id);
    expect(dlqEntry).toBeDefined();
    expect(dlqEntry.status).toBe('dead');
  });
});
```

### 3.5 Idempotency Tests (Cross-Systems)

```typescript
// tests/billing/architecture/idempotency.test.ts

describe('Idempotency Cross-Systems', () => {
  // TEST 1: PaymentIntent idempotence
  it('should create only one PaymentIntent for same idempotency key', async () => {
    const key = 'payment_intent:16:create:2026-06-30';
    
    const intent1 = await paymentService.createIntent({ idempotencyKey: key });
    const intent2 = await paymentService.createIntent({ idempotencyKey: key });
    
    expect(intent1.id).toBe(intent2.id);
  });
  
  // TEST 2: Webhook idempotence
  it('should process webhook only once', async () => {
    const webhookId = 'stripe:evt_123';
    
    await webhookHandler.handle(webhookId, {});
    const result = await webhookHandler.handle(webhookId, {});  // Duplicata
    
    expect(result).toBe('already_processed');
  });
  
  // TEST 3: AccountingEvent idempotence
  it('should create only one AccountingEvent per domain event', async () => {
    const domainEventId = 'subscription:uuid-123';
    
    await accountingService.createEvent(domainEventId);
    await accountingService.createEvent(domainEventId);  // Duplicata
    
    const events = await accountingRepo.findByDomainEventId(domainEventId);
    expect(events.length).toBe(1);
  });
  
  // TEST 4: Saga idempotence
  it('should not start same saga twice', async () => {
    const sagaId = 'subscription_creation:uuid-456';
    
    await sagaOrchestrator.start(sagaId);
    const result = await sagaOrchestrator.start(sagaId);  // Duplicata
    
    expect(result).toBe('already_running');
  });
});
```

---

## 4. EXECUTION PLAN (VERTICAL IMPLEMENTATION)

### Semaine 1-2: Domain Core

**Lun 01/07 - Mar 02/07:**
- [ ] `src/server/domain/billing/value-objects/Money.ts` + tests
- [ ] `src/server/domain/billing/value-objects/Currency.ts` + tests
- [ ] `src/server/domain/billing/value-objects/Provider.ts` + tests

**Mer 03/07 - Jeu 04/07:**
- [ ] `src/server/domain/billing/value-objects/Period.ts` + tests
- [ ] `src/server/domain/billing/value-objects/BillingPeriod.ts` + tests
- [ ] `src/server/domain/billing/value-objects/TrialPeriod.ts` + tests

**Ven 05/07 - Sam 06/07:**
- [ ] `src/server/domain/billing/value-objects/RenewalSettings.ts` + tests
- [ ] `src/server/domain/billing/value-objects/CancellationSettings.ts` + tests
- [ ] `src/server/domain/billing/value-objects/FiscalPeriod.ts` + tests

**Lun 08/07 - Mar 09/07:**
- [ ] `src/server/domain/billing/value-objects/InvoiceNumber.ts` + tests
- [ ] `src/server/domain/billing/value-objects/AccountCode.ts` + tests
- [ ] Tests d'intégration des Value Objects

### Semaine 3-4: Aggregates + Policies

**Mer 10/07 - Ven 12/07:**
- [ ] `src/server/domain/billing/aggregates/subscription/Subscription.ts` + tests invariants
- [ ] `src/server/domain/billing/aggregates/subscription/SubscriptionPaymentMethod.ts` + tests
- [ ] `src/server/domain/billing/aggregates/subscription/SubscriptionTrial.ts` + tests

**Lun 15/07 - Mer 17/07:**
- [ ] `src/server/domain/billing/aggregates/payment-intent/PaymentIntent.ts` + tests invariants
- [ ] `src/server/domain/billing/aggregates/payment-intent/PaymentAttempt.ts` + tests
- [ ] Tests multi-attempt scenarios

**Jeu 18/07 - Ven 19/07:**
- [ ] `src/server/domain/billing/aggregates/invoice/Invoice.ts` + tests invariants
- [ ] `src/server/domain/billing/aggregates/invoice/ExternalInvoiceReference.ts` + tests
- [ ] Tests calcul total (subtotal + tax - discount)

**Lun 22/07 - Mar 23/07:**
- [ ] `src/server/domain/billing/aggregates/accounting-event/AccountingEvent.ts` + tests invariants CRITIQUES
- [ ] `src/server/domain/billing/aggregates/accounting-event/JournalEntry.ts` + tests
- [ ] Tests trial balance (SUM(debits) == SUM(credits))

**Mer 24/07 - Jeu 25/07:**
- [ ] `src/server/domain/billing/policies/RenewalPolicy.ts` + tests
- [ ] `src/server/domain/billing/policies/TrialPolicy.ts` + tests
- [ ] `src/server/domain/billing/policies/CancellationPolicy.ts` + tests
- [ ] `src/server/domain/billing/policies/RefundPolicy.ts` + tests
- [ ] `src/server/domain/billing/policies/UpgradePolicy.ts` + tests

### Semaine 5-6: Payment Gateway

**Ven 26/07 - Sam 27/07:**
- [ ] `src/server/infrastructure/billing/providers/PaymentProvider.ts` (interface)
- [ ] `src/server/infrastructure/billing/providers/StripeAdapter.ts` + tests
- [ ] Tests Stripe API calls

**Lun 29/07 - Mar 30/07:**
- [ ] `src/server/infrastructure/billing/providers/CashAdapter.ts` + tests
- [ ] `src/server/infrastructure/billing/providers/VoucherAdapter.ts` + tests
- [ ] Tests provider switching

**Mer 31/07 - Jeu 01/08:**
- [ ] `src/server/domain/billing/repositories/IPaymentIntentRepository.ts`
- [ ] `src/server/infrastructure/billing/repositories/PostgresPaymentIntentRepository.ts`
- [ ] Tests repository

### Semaine 7-8: Webhook Handler

**Ven 02/08 - Sam 03/08:**
- [ ] `src/server/infrastructure/billing/webhooks/WebhookEvent.ts` + tests
- [ ] `src/server/infrastructure/billing/webhooks/StripeWebhookHandler.ts` + tests
- [ ] Tests signature verification

**Lun 05/08 - Mar 06/08:**
- [ ] Tests idempotence webhooks
- [ ] Tests désordre webhooks
- [ ] Tests retry webhooks

### Semaine 9-10: Invoice

**Mer 07/08 - Ven 09/08:**
- [ ] `src/server/domain/billing/repositories/IInvoiceRepository.ts`
- [ ] `src/server/infrastructure/billing/repositories/PostgresInvoiceRepository.ts`
- [ ] Tests repository

**Lun 12/08 - Mar 13/08:**
- [ ] `src/server/application/billing/services/InvoiceService.ts` + tests
- [ ] Tests génération facture
- [ ] Tests calcul taxes

### Semaine 11-12: AccountingEvent + JournalEntry

**Mer 14/08 - Ven 16/08:**
- [ ] `src/server/domain/billing/repositories/IAccountingEventRepository.ts`
- [ ] `src/server/infrastructure/billing/repositories/PostgresAccountingEventRepository.ts`
- [ ] Tests repository

**Lun 19/08 - Mar 20/08:**
- [ ] `src/server/application/billing/services/AccountingService.ts` + tests
- [ ] Tests création AccountingEvent
- [ ] Tests trial balance

### Semaine 13-14: Saga + Outbox

**Mer 21/08 - Ven 23/08:**
- [ ] `src/server/infrastructure/billing/outbox/OutboxEvent.ts` + tests
- [ ] `src/server/infrastructure/billing/outbox/OutboxPublisher.ts` + tests
- [ ] Tests outbox 3 couches

**Lun 26/08 - Mar 27/08:**
- [ ] `src/server/application/billing/sagas/SubscriptionCreationSaga.ts` + tests
- [ ] `src/server/application/billing/sagas/PaymentProcessingSaga.ts` + tests
- [ ] Tests saga states

### Semaine 15-16: Reconciliation + Observabilité

**Mer 28/08 - Ven 30/08:**
- [ ] `src/server/application/billing/services/ReconciliationService.ts` + tests
- [ ] Tests reconciliation automatique
- [ ] Tests reconciliation manuelle

**Lun 02/09 - Mar 03/09:**
- [ ] Observabilité: logs structurés
- [ ] Observabilité: métriques Prometheus
- [ ] Observabilité: alerting

### Semaine 17-18: Migration SQLite → PostgreSQL

**Mer 04/09 - Ven 06/09:**
- [ ] `src/server/infrastructure/billing/outbox/SqliteOutboxSyncWorker.ts` + tests
- [ ] Tests sync worker
- [ ] Tests replay

**Lun 09/09 - Mar 10/09:**
- [ ] Backfill subscriptions
- [ ] Tests migration
- [ ] Rollback plan

### Semaine 19-20: Tests + Hardening

**Mer 11/09 - Ven 13/09:**
- [ ] Tests d'architecture (8 tests obligatoires)
- [ ] Tests de charge
- [ ] Tests chaos

**Lun 16/09 - Mar 17/09:**
- [ ] Documentation finale
- [ ] Code review
- [ ] Déploiement staging

---

## 5. PRODUCTION RISK MAP

### 5.1 Zones à Risque CRITIQUE

#### RISK 1: AccountingEvent Aggregate Boundary Violation

**Ce qui peut casser:**
- Un AccountingEvent contient plus de 10 JournalEntry
- Violation de l'invariant SUM(debits) == SUM(credits)

**Pourquoi:**
- Bug dans la logique de création
- Race condition dans les transactions
- Migration de données incorrecte

**Comment détecter:**
```typescript
// Test automatique (à exécuter toutes les heures)
const violations = await db.accounting_events.findMany({
  where: {
    entries: { $count: { $gt: 10 } }
  }
});

if (violations.length > 0) {
  alert('CRITICAL: AccountingEvent boundary violation');
}
```

**Comment corriger:**
1. Arrêter les écritures
2. Identifier l'AccountingEvent en violation
3. Scinder en plusieurs AccountingEvents (si < 10 entrées chacun)
4. Recalculer les totaux
5. Reprendre les écritures

#### RISK 2: PaymentIntent Multi-Attempt Race Condition

**Ce qui peut casser:**
- Deux webhooks Stripe arrivent en même temps
- Création de 2 PaymentAttempt avec même attempt_number
- Doublon de paiement

**Pourquoi:**
- Stripe retry un webhook
- Optimistic locking échoue
- Pas de vérification avant création

**Comment détecter:**
```sql
SELECT payment_intent_id, attempt_number, COUNT(*)
FROM payment_attempts
GROUP BY payment_intent_id, attempt_number
HAVING COUNT(*) > 1;
```

**Comment corriger:**
1. Identifier les doublons
2. Supprimer les doublons (garder le premier)
3. Ajouter contrainte UNIQUE sur (payment_intent_id, attempt_number)
4. Vérifier idempotence webhook handler

#### RISK 3: Outbox Ordering Violation

**Ce qui peut casser:**
- Événements traités dans le désordre
- Incohérence entre SQLite et PostgreSQL
- Données corrompues

**Pourquoi:**
- SQLite n'a pas de séquence fiable
- ID auto-increment peut avoir des gaps
- Multi-threading dans le sync worker

**Comment détecter:**
```typescript
// Vérifier l'ordre des événements
const events = await sqlite.outbox.findMany({ orderBy: { id: 'asc' } });
for (let i = 1; i < events.length; i++) {
  if (events[i].id < events[i-1].id) {
    alert('CRITICAL: Outbox ordering violation');
  }
}
```

**Comment corriger:**
1. Arrêter le sync worker
2. Trier les événements par ID
3. Rejouer dans l'ordre
4. Ajouter vérification dans le sync worker

#### RISK 4: Domain Event Immutability Violation

**Ce qui peut casser:**
- `processed_at` modifié après création
- Event modifié après traitement
- Audit trail corrompu

**Pourquoi:**
- Développeur ajoute `processed_at` dans le Domain Event
- Update SQL au lieu de INSERT
- Pas de vérification

**Comment détecter:**
```sql
-- Vérifier que processed_at n'existe pas
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'domain_events'
AND column_name = 'processed_at';
```

**Comment corriger:**
1. Supprimer la colonne `processed_at`
2. Utiliser une table séparée `event_processing_tracker`
3. Former l'équipe

#### RISK 5: Money Currency Mismatch

**Ce qui peut casser:**
- Mélange de ZMW et USD dans une facture
- Calcul de total incorrect
- Erreur comptable

**Pourquoi:**
- Bug dans la conversion de devise
- Pas de vérification avant calcul
- Currency snapshot manquant

**Comment détecter:**
```typescript
// Test automatique
const invoices = await db.invoices.findMany();
for (const invoice of invoices) {
  const currencies = new Set([
    invoice.subtotal.currency,
    invoice.tax.currency,
    invoice.discount.currency,
    invoice.total.currency
  ]);
  
  if (currencies.size > 1) {
    alert(`CRITICAL: Currency mismatch in invoice ${invoice.id}`);
  }
}
```

**Comment corriger:**
1. Identifier les factures en erreur
2. Recalculer avec la bonne devise
3. Ajouter contrainte CHECK dans PostgreSQL
4. Vérifier Currency Snapshot

### 5.2 Zones à Risque ÉLEVÉ

#### RISK 6: Optimistic Locking Failures

**Détection:** Logs avec 409 Conflict fréquents
**Correction:** Frontend reload + retry automatique

#### RISK 7: Saga Timeout

**Détection:** Sagas en état `waiting` > 10min
**Correction:** Saga scanner vérifie l'état externe avant compensation

#### RISK 8: DLQ Accumulation

**Détection:** DLQ count > 10
**Correction:** Investigation manuelle + replay ou ignore

#### RISK 9: PostgreSQL Connection Pool Exhaustion

**Détection:** `connection pool exhausted` dans les logs
**Correction:** PgBouncer + augmentation du pool size

#### RISK 10: Stripe Webhook Signature Invalid

**Détection:** `signature verification failed` dans les logs
**Correction:** Vérifier webhook secret + rotation

### 5.3 Monitoring Obligatoire

```typescript
// Métriques à surveiller en production
const CRITICAL_METRICS = {
  // Performance
  payment_intent_creation_latency_p95: 5000,  // 5s max
  webhook_processing_latency_p95: 1000,       // 1s max
  
  // Business
  payment_success_rate: 0.9,                 // 90% min
  reconciliation_discrepancies: 0,           // 0 max
  
  // Technique
  saga_stuck_count: 10,                      // 10 max
  dlq_count: 10,                             // 10 max
  postgresql_connections: 100,               // 100 max
  
  // Erreurs
  webhook_failures_per_minute: 10,           // 10 max
  accounting_event_violations: 0             // 0 max
};
```

---

## 6. CHECKLIST AVANT DÉMARRAGE

### 6.1 Code

- [ ] Tous les Value Objects écrits avec invariants
- [ ] Tous les Aggregates écrits avec invariants
- [ ] Toutes les Policies pures écrites
- [ ] Tous les tests unitaires passent
- [ ] Tous les tests d'intégration passent
- [ ] Tous les tests d'architecture passent

### 6.2 Infrastructure

- [ ] PostgreSQL configuré (types ENUM, indexes)
- [ ] Stripe configuré (webhooks, secrets)
- [ ] Observabilité configurée (logs, métriques, alerting)
- [ ] Secrets Management configuré
- [ ] Backups PostgreSQL configurés
- [ ] PgBouncer configuré

### 6.3 Tests

- [ ] Tests de restauration DB passent
- [ ] Tests de charge passent (1000 req/min)
- [ ] Tests de chaos passent (failover < 5min)
- [ ] Tests de migration passent (replay, ordering)

### 6.4 Documentation

- [ ] ADR finales écrites
- [ ] Plan de migration écrit
- [ ] Disaster Recovery Plan écrit
- [ ] Runbooks écrits
- [ ] API documentation écrite

---

## 7. CONTACTS ESCALADE

**En cas de problème production:**

1. **AccountingEvent violation** → Architecte + DBA
2. **PaymentIntent race condition** → Backend Lead
3. **Outbox ordering** → Infrastructure Lead
4. **Stripe webhook failure** → Payment Team
5. **PostgreSQL down** → DevOps + DBA

---

**FIN DU CONTRAT D'IMPLÉMENTATION**

**Statut:** ✅ Prêt pour implémentation  
**Prochaine étape:** Commencer Semaine 1 (Domain Core)  
**Durée totale:** 20 semaines  
**Risque global:** MOYEN (zones critiques identifiées et testées)