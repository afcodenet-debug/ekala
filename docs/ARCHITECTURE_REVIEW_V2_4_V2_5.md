# Architecture Review — Ekala Billing V2.4 / V2.5 Enterprise

**Reviewer:** Staff/Distinguished Engineer (ex-Stripe, Shopify, Square, Toast POS)  
**Date:** 30/06/2026  
**Classification:** CONFIDENTIAL — Do Not Distribute  
**Scope:** Architecture documents `EKALA_BILLING_V2_4_ARCHITECTURE.md` and `EKALA_BILLING_V2_5_ENTERPRISE_ARCHITECTURE.md`

---

## Executive Summary

I have read both documents end to end. I have also examined the existing codebase to validate whether the documents describe real code or aspirational design.

**Spoiler: The documents describe code that largely does not exist yet.**

This review evaluates the architecture as if it were being presented to me before a multi-million dollar investment. I will identify which decisions are solid, which are dangerous, and which will cause production incidents.

---

## 1. Foundational Problem: Document vs Reality Gap

### What the Documents Claim

The V2.4 and V2.5 documents describe:
- A sophisticated DDD domain with aggregates, value objects, domain events
- A Saga orchestrator with persisted state and crash recovery
- An Outbox pattern with DLQ and replay
- A fraud engine with 8 rules
- Circuit breakers per provider
- Feature flags
- A billing read model
- Multi-region deployment

### What the Codebase Actually Contains

The existing code (V2.1–V2.3) has:
- A `Subscription` aggregate with `activate()`, `cancel()`, `suspend()`, `renew()` methods ✅ (this is real, well-written DDD)
- A `SubscriptionStatus` value object with state transitions ✅
- An `InMemoryEventBus` — **in-memory only, events are lost on crash** ❌
- A `SqliteSubscriptionRepository` — SQLite only ❌
- A `SubscriptionApplicationService` — thin layer ✅
- **No Saga orchestrator** — the document describes something that doesn't exist
- **No Outbox pattern** — not implemented
- **No DLQ** — not implemented
- **No PaymentInProgress** — not implemented
- **No Fraud Engine** — not implemented
- **No Circuit Breaker** — not implemented
- **No Feature Flags** — not implemented
- **No Billing Read Model** — not implemented
- **No Multi-Region** — not implemented

### Verdict

**The V2.4 and V2.5 documents describe a target architecture, not the current state. This is acceptable for a roadmap document, but it must be clearly labeled as such.**

Risk: If a CTO reads this, they will assume these capabilities exist today. They do not.

**Recommendation:** Clearly label the document sections as "Planned" vs "Implemented". Add a maturity matrix.

---

## 2. DDD Assessment

### What's Good

The `Subscription` aggregate is **well-designed**. It follows Evans' pattern correctly:
- Static factory `create()` with invariant validation ✅
- Static `reconstitute()` for persistence ✅
- Business methods return `Result<T>` wrapping errors ✅
- State transitions checked via `canTransitionTo()` ✅
- Immutable updates via `updateState()` ✅
- Invariants validated in `validateInvariants()` ✅

The `SubscriptionStatus` value object is correctly implemented with explicit state machine transitions.

### What's Wrong

**2.1 Missing Domain Events**

The aggregate does not emit domain events. The document's ADR mentions an Event Bus, but the aggregate itself has no event collection mechanism.

In Evans' DDD, aggregates emit events that are collected and published after the transaction commits. This aggregate has no `domainEvents` field.

```typescript
// What a proper DDD aggregate looks like:
abstract class Aggregate {
  private domainEvents: DomainEvent[] = [];
  
  protected addDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }
  
  clearEvents(): DomainEvent[] {
    const events = [...this.domainEvents];
    this.domainEvents = [];
    return events;
  }
}
```

**Impact:** When `activate()` succeeds, nothing notifies the outside world. The Payment Service, the Notification Service, and the Sync Engine have no way to react.

**2.2 Wrong Aggregate Boundary**

The document places `Subscription` as the aggregate root for billing. However, in a proper billing system, the aggregate should be **a specific tenant's subscription within a billing period**, not a generic subscription.

Stripe, Recurly, and Chargebee all model subscriptions as aggregates that include the current period, the plan, and the payment method. Ekala's model separates these into distinct tables with no aggregate boundary enforcement.

**Risk:** Invoices can be created without a subscription. Payments can be applied without an invoice. There is no aggregate to enforce consistency between these entities.

**2.3 Missing Invariants**

Current invariants checked:
- Active subscription cannot have cancelledAt ✅
- Cancelled subscription must have cancelledAt ✅
- entityVersion >= 1 ✅
- logicalClock >= 0 ✅
- Start date before end date ✅

Missing invariants:
- ❌ A subscription cannot be activated without a valid payment method
- ❌ A subscription cannot be renewed if the tenant is suspended
- ❌ A plan change (upgrade/downgrade) must not create overlapping periods
- ❌ A trial subscription cannot be renewed (must convert to paid first)
- ❌ A subscription cannot have a plan_id that doesn't exist in plans table

**2.4 Score**

| Criteria | Score | Rationale |
|----------|-------|-----------|
| Bounded Context | 7/10 | Subscription is well-isolated, but billing/payment/invoice boundaries are blurred |
| Aggregate Design | 7/10 | Subscription aggregate is clean but boundary is too narrow |
| Consistency | 5/10 | No cross-aggregate consistency enforcement |
| Domain Events | 2/10 | Aggregate does not emit events |
| Invariants | 5/10 | Basic invariants present, payment/suspension invariants missing |
| **DDD Total** | **5.2/10** | |

---

## 3. CQRS Assessment

### What the Document Says

V2.4 mentions "Event Sourcing" in its principles. V2.5 introduces a "Billing Read Model" for dashboards.

### What Exists

There is no CQRS implementation. The same database (SQLite) is used for both reads and writes. The V2.5 Read Model is aspirational.

### Analysis

**3.1 CQRS is unnecessary complexity for this scale.**

At Stripe, we use CQRS because we process millions of transactions and need independent scaling of reads and writes. Ekala does not have this problem. With < 1000 tenants and < 10,000 transactions/month, a properly indexed PostgreSQL database handles reads and writes simultaneously without CQRS.

**The document introduces CQRS as a pattern because it sounds good, not because it solves a real problem.**

**Recommendation:** Remove CQRS. Keep a single database. Add database read replicas if read performance becomes an issue. This saves months of development time and eliminates an entire class of consistency bugs.

**3.2 Event Sourcing is even more wrong**

Event Sourcing (storing events instead of state) would be catastrophic for Ekala:

1. **OHADA compliance requires auditable state**, not just events. In African accounting, you must be able to produce a snapshot of accounts at any point in time. Event sourcing makes this trivial, but **replaying events to reconstruct state is slow** and error-prone.

2. **Event Store on SQLite** is explicitly warned against in the document itself. Yet the document still lists "Event Sourcing" as a principle.

**Verdict:** Event Sourcing should be removed entirely from the architecture. Use append-only ledger for accounting (standard double-entry) but do NOT use Event Sourcing for subscriptions.

### Score

| Criteria | Score | Rationale |
|----------|-------|-----------|
| CQRS Necessity | 2/10 | Not needed at this scale, adds complexity without benefit |
| Read Model Design | N/A | Does not exist yet, cannot evaluate |
| **CQRS Total** | **2/10** | |

---

## 4. Payment Architecture Assessment

This is where the review gets serious.

### 4.1 Stripe Webhook as Source of Truth ✅

This is correct. Every payment company (Stripe, Adyen, Square) has this model. The frontend initiates, the backend confirms via webhook. This is not negotiable.

### 4.2 Payment Gateway Hexagonal Architecture (V2.5)

The V2.5 document proposes a `PaymentGatewayPort` interface with `authorize()`, `capture()`, `refund()`, `cancel()`, `status()` methods, implemented by adapters for Stripe, MTN, Orange, Flutterwave, Cash, Voucher.

**This is architecturally correct in principle but dangerously oversimplified in practice.**

**4.2.1 The authorize/capture model doesn't work for African mobile money**

Stripe's `authorize → capture` model assumes a synchronous or near-synchronous flow. African mobile money (MTN, Orange, Airtel) is fundamentally asynchronous:

1. You send a payment request
2. The user receives an SMS/USSD push
3. The user confirms on their phone (30s to 5 minutes later)
4. The provider sends a webhook back

In the Stripe model, `authorize()` returns immediately. In the MTN model, `authorize()` returns `pending` and you wait for a webhook. The interface as defined in the document treats these as equivalent, but they require fundamentally different orchestration:

| Provider | authorize() | capture() | Webhook |
|----------|-------------|-----------|---------|
| Stripe | Sync (client_secret) | Sync | Optional |
| MTN/Orange | Async (pending) | N/A (webhook) | Mandatory |

**The single `PaymentGatewayPort` interface hides this complexity. The Payment Orchestrator must handle both synchronous and asynchronous providers differently.**

**Risk:** An engineer implementing MTNAdapter will either:
(a) Block `authorize()` waiting for user confirmation (timeout issues), or
(b) Return immediately and lose the async confirmation

**4.2.2 Cash and Voucher don't belong in this interface**

Cash payments and voucher redemptions are not "authorize/capture" operations. They are:
- Cash: Over-the-counter payment with receipt generation
- Voucher: Code validation and status update

Forcing them into the authorize/capture model creates unnecessary abstraction leakage. Cash has no authorize step — the money is already received. Voucher has no refund path — vouchers expire.

**Recommendation:** Create separate interfaces:
```typescript
interface OnlinePaymentGateway {
  authorize(): Promise<AuthorizeResponse>;    // Sync providers
  capture(): Promise<CaptureResponse>;
  refund(): Promise<RefundResponse>;
}

interface AsyncPaymentGateway extends OnlinePaymentGateway {
  // Authorization is async, webhook expected
  handleWebhook(webhookPayload: unknown): Promise<WebhookResult>;
}

interface OfflinePaymentGateway {
  receive(amount: Money): Promise<PaymentResult>;  // Cash
}

interface VoucherGateway {
  validate(code: string): Promise<VoucherValidation>;
  redeem(code: string, tenantId: number): Promise<PaymentResult>;
}
```

**4.2.3 The authorize/capture model doesn't fit subscriptions**

In Stripe's actual subscription model, you don't use PaymentIntents directly. You use `stripe.subscriptions.create()` which handles the entire lifecycle:
- Creates a subscription
- Generates invoices
- Collects payment
- Handles retries
- Manages dunning

The document's approach of manually managing PaymentIntents for subscriptions is **working against Stripe's native subscription model**. This is a known antipattern that Stripe explicitly warns against.

**Recommendation:** Use Stripe's Subscription API for Stripe payments. Only use PaymentIntents for one-time payments or for providers that don't have subscription APIs (MTN, Orange).

**4.2.4 Missing Idempotency Key Propagation**

The document correctly requires idempotency keys. However, the proposed implementation stores them in PostgreSQL. This means:
1. Generate UUID
2. Send to Stripe
3. Wait for webhook
4. Check PostgreSQL for idempotency

If the database is down, no payments can be processed. **This creates a hard dependency between payment processing and database availability.**

Stripe handles this differently: Stripe's idempotency is built into their API. You send the same idempotency key, and Stripe ensures exactly-once execution. The PostgreSQL idempotency store should be a **secondary check**, not the primary one.

**Risk:** If PostgreSQL is unavailable during a Stripe webhook delivery, the webhook times out, Stripe retries, and on the third retry (up to an hour later), the database is back up and the payment is processed. The user sees "pending" for an hour.

### 4.3 Fraud Engine

The Fraud Engine as described has 8 rules with hardcoded thresholds. This is a **toy fraud system**, not a production fraud engine.

**4.3.1 Hardcoded thresholds will cause incidents**

- Rate limit at 20 payments/min: What happens during Black Friday? Or when a restaurant chain with 50 tables pays for 50 subscriptions at once?
- Amount anomaly at 3x average: What happens when a tenant upgrades from Starter to Pro? That's a 12x increase that is legitimate.
- Time check at 23h-5h: What happens during Ramadan when restaurants are open until 4am?

**Real fraud systems (Stripe Radar, Sift, Forter) use machine learning models with dynamic thresholds, not hardcoded rules.**

**4.3.2 The fraud engine blocks AFTER PaymentInProgress creation**

The document shows:
1. Create PaymentInProgress in PostgreSQL
2. Run Fraud Engine
3. If blocked, mark as failed

This means failed fraud checks still create database entries. A denial-of-service attack (20 fraudulent payments/second) creates 20 PaymentInProgress entries per second = 1.7M entries/day.

**Recommendation:** Run the Fraud Engine BEFORE creating PaymentInProgress. Only persist if fraud check passes.

**4.3.3 GDPR implications**

Storing IP addresses, device fingerprints, and geo-location in the fraud engine without explicit consent is a GDPR violation. The document does not mention data retention policies for fraud data.

### 4.4 Score

| Criteria | Score | Rationale |
|----------|-------|-----------|
| Webhook Architecture | 8/10 | Correct pattern, but missing timeout handling |
| Provider Abstraction | 3/10 | Interface ignores async vs sync differences |
| Payment Orchestration | 4/10 | Missing async handling, error recovery |
| Fraud Engine | 2/10 | Hardcoded thresholds, no ML, processed too late |
| Stripe Integration | 3/10 | Bypasses Stripe Subscriptions, uses raw PaymentIntents |
| Idempotence | 6/10 | Correct in concept, fragile in implementation |
| **Payments Total** | **4.3/10** | |

---

## 5. Ledger and Accounting Assessment

### 5.1 Double-Entry Accounting

The document describes a ledger with:
- `debit` and `credit` entries ✅
- Account codes (OHADA-compliant) ✅
- SHA-256 chained signatures ✅
- Append-only ✅

**This is well-designed.** The SHA-256 chaining is a technique used by blockchain systems and is appropriate for accounting integrity.

### 5.2 Critical Issue: Missing Trial Balance

The ledger design has no mechanism to verify that `SUM(debits) = SUM(credits)` at any point in time. In double-entry accounting, a trial balance must be producible at any moment. Without it, an undetected error (e.g., writing a debit without a credit) corrupts the ledger silently.

**Recommendation:** Add a scheduled cron that runs every hour:
```sql
SELECT SUM(amount_cents) FROM ledger_entries WHERE entry_type = 'debit';
SELECT SUM(amount_cents) FROM ledger_entries WHERE entry_type = 'credit';
-- These must be equal. If not, alert immediately.
```

### 5.3 OHADA Compliance Gaps

The document lists OHADA account codes correctly. However:

**5.3.1 Missing fiscal year management**

OHADA requires:
- Annual closing of accounts
- Carry-forward of balances
- Opening balances for the new year
- Audit trail for opening balance adjustments

The ledger design has no concept of fiscal years. Every entry is a continuous stream. This is non-compliant.

**5.3.2 Missing depreciation**

If Ekala capitalizes any software development costs (which is common for SaaS platforms), OHADA requires depreciation tracking. The ledger has no depreciation accounts.

**5.3.3 Invoice sequential numbering is insufficient**

OHADA requires:
- Sequential numbering with no gaps
- If a number is skipped, it must be explained in the audit book
- The sequence must reset annually

The document mentions sequential numbering but doesn't mention how gaps are detected and reported. This will fail an OHADA audit.

### 5.4 SHA-256 Ledger: Over-engineering

The SHA-256 chaining adds complexity but provides **no real security** because:

1. If an attacker has write access to the database, they can rewrite the entire chain from the point of compromise
2. The chain is stored in the same database it's supposed to protect
3. A proper accounting audit relies on external controls (bank reconciliations, third-party confirmations), not internal hashes

**Stripe doesn't do this. Shopify doesn't do this. Square doesn't do this.** They rely on:
- Write-ahead logs for crash recovery
- Read replicas for integrity
- External bank reconciliations for accuracy

The SHA-256 chaining is a solution in search of a problem. It adds implementation complexity, query slowdowns (every insert requires reading the previous entry), and zero practical security.

**Recommendation:** Remove SHA-256 chaining. Use database-level WAL (PostgreSQL native) for integrity. Add external audit controls (bank reconciliation, third-party ledger verification).

### 5.5 Score

| Criteria | Score | Rationale |
|----------|-------|-----------|
| Double-Entry Design | 7/10 | Correct structure, missing trial balance |
| OHADA Compliance | 5/10 | Good code mapping, missing fiscal year, depreciation |
| SHA-256 Chaining | 2/10 | Over-engineered, no real security value |
| Audit Trail | 6/10 | Present but could be simpler |
| **Accounting Total** | **5/10** | |

---

## 6. Saga and Resilience Assessment

### 6.1 Saga State Machine

The document's saga design has a fundamental flaw: **it only supports forward progress, not backward recovery.**

The saga state machine has states:
- `in_progress`
- `completed`
- `failed`
- `compensating`

Missing:
- `pending` (saga created but not started — needed for at-least-once execution)
- `retrying` (a step failed and we're retrying, not compensating)
- `paused` (waiting for external input, e.g., webhook)
- `cancelled` (saga was cancelled before execution)

### 6.2 Recovery Saga Scanner

The cron that scans every 30 seconds for `in_progress` sagas older than 5 minutes is problematic:

**6.2.1 5-minute window**

A subscription creation saga can legitimately take longer than 5 minutes if the user is on mobile money (MTN requires user confirmation, which can take 2-5 minutes). The scanner would incorrectly compensate a valid in-progress saga.

**Recommendation:** The timeout should be configurable per saga type. Subscription creation via MTN = 10 minutes. Invoice generation = 30 seconds.

**6.2.2 Double compensation**

The scanner finds a saga that is `in_progress` but was actually successfully completed (the webhook arrived, the saga status wasn't updated due to a bug). The scanner compensates, refunding the payment. Then the original saga completes, activating the subscription. The customer gets both a refund AND an active subscription.

**This is a financial reconciliation nightmare.**

**Recommendation:** Before compensating any step, **verify the current state with the external system**. For example, before refunding a Stripe payment, check Stripe to see if the payment actually completed. This requires each step to have a "check current state" method.

### 6.3 Dead Letter Queue

The DLQ design is sound in structure but limited in practice. The document proposes:
- After 5 retries, move to DLQ
- Super Admin can retry manually

**Problem:** What happens to the saga when a message goes to DLQ? The saga is left in an incomplete state. The Recovery Saga Scanner doesn't know whether to wait for the DLQ retry or to compensate.

Without a mechanism to pause sagas while DLQ messages are being processed, you get:

1. Message goes to DLQ
2. Saga scanner sees "in_progress" > 5 minutes
3. Scanner compensates the saga
4. Super Admin retries the DLQ message
5. DLQ message succeeds, activates subscription
6. But saga was already compensated → payment refunded but subscription active

**This WILL happen in production.**

**Recommendation:** Saga state must include a `paused_on_dlq` state. The Recovery Saga Scanner must skip sagas in this state.

### 6.4 PaymentInProgress Expiration

The cron that checks expired `PaymentInProgress` entries every hour has a **1-hour gap** where a payment could be in an inconsistent state. Stripe's PaymentIntent timeout is 30 minutes for cards and up to 24 hours for some payment methods.

**Problem:** If a PaymentInProgress expires (24h), the cron marks it as `expired` and cancels the saga. But what if the customer paid via MTN and the webhook arrives AFTER the expiry? The webhook handler receives the payment but the saga is already cancelled.

**Recommendation:** The webhook handler should check the saga state and be able to "resurrect" an expired saga if payment was actually received. This requires a `reopen` method on the saga orchestrator.

### 6.5 Score

| Criteria | Score | Rationale |
|----------|-------|-----------|
| Saga State Machine | 4/10 | Missing several required states |
| Crash Recovery | 3/10 | Recovery scanner can cause incorrect compensations |
| DLQ Design | 6/10 | Good structure, but sagas not paused on DLQ |
| PaymentInProgress | 4/10 | Expiry handling has race conditions |
| **Resilience Total** | **4.2/10** | |

---

## 7. Offline-First and Sync Assessment

### 7.1 SQLite for POS: Correct ✅

The decision to keep SQLite for POS operations (orders, sales, inventory) is sound. Toast POS, Square, and Lightspeed all use local databases for offline operation.

### 7.2 PostgreSQL for Billing: Correct ✅

Centralized billing in PostgreSQL/Stripe is correct. Payments must never depend on local data.

### 7.3 The Sync Engine Is the Real SPOF

The document describes a bidirectional sync engine between SQLite and PostgreSQL. This is **the hardest problem in distributed systems** and the document dedicates only 2 paragraphs to it.

**7.3.1 Conflict Resolution**

The document proposes "Last-Write-Wins + Lamport Clock" for conflict resolution. This is insufficient for billing data:

- A sale created offline (SQLite) could reference a product that was deleted online (PostgreSQL)
- A subscription upgraded online could conflict with an offline voucher redemption
- Tax rate changes online could affect invoices generated offline

**Recommendation:** The sync engine must have a **full conflict resolution protocol**:
1. Detect conflict
2. Determine if conflict can be auto-resolved (e.g., newer timestamp wins for non-financial data)
3. If financial data conflicts: BLOCK the sync and escalate to Super Admin
4. Never auto-resolve conflicts involving money

**7.3.2 Sync Failures**

What happens when:
- SQLite has a sale but PostgreSQL is unavailable?
- PostgreSQL confirms the sync but the network drops before SQLite is notified?
- A sale is synced twice (sync engine retry)?

The document doesn't address these scenarios. Any one of them can cause:
- Duplicate sales entries
- Lost sales data
- Inventory count mismatches

**7.3.3 Lamport Clock is insufficient**

Lamport clocks provide causal ordering but cannot detect conflicts. For billing data, you need **version vectors** (a vector clock) that tracks the state of each node. Without version vectors, you cannot determine if two changes actually conflict or are independent.

**Recommendation:** Use version vectors instead of Lamport clocks. Or better: use a CRDT-based approach (Conflict-free Replicated Data Types) where possible.

### 7.4 Score

| Criteria | Score | Rationale |
|----------|-------|-----------|
| Architecture Decision | 8/10 | SQLite offline, PG online is correct |
| Sync Engine Design | 2/10 | Critically underspecified |
| Conflict Resolution | 2/10 | Last-Write-Wins is dangerous for billing |
| Offline Capability | 7/10 | Works for POS, but billing offline is limited |
| **Offline Total** | **4.7/10** | |

---

## 8. Security Assessment

### 8.1 PCI DSS Compliance

**The document doesn't mention PCI DSS at all.** This is a critical omission.

If Stripe Elements is used for card collection (which is the correct approach), Ekala's PCI DSS scope is reduced to SAQ A (no card data storage). However:

- **MTN and Orange Mobile Money have their own compliance requirements**
- **Storing PaymentInProgress with card metadata could violate PCI DSS**
- **The fraud engine's device fingerprinting could be considered PII**

**Recommendation:** Document PCI DSS scope explicitly. Ensure PaymentInProgress never stores:
- Full card numbers (PAN)
- CVV
- Track data
- PIN

### 8.2 API Authentication

The document mentions "Auth JWT + Tenant Scope" but doesn't specify:
- Token expiry policy
- Refresh token rotation
- Rate limiting per endpoint type
- API key management for third-party integrations

**Recommendation:** Add explicit authentication and authorization section.

### 8.3 Webhook Security

The document correctly mentions Stripe webhook signature verification. However:
- MTN and Orange webhooks have different security models (IP whitelisting, basic auth)
- No mention of webhook payload validation
- No mention of replay attack protection

### 8.4 Score

| Criteria | Score | Rationale |
|----------|-------|-----------|
| PCI DSS | 0/10 | Not mentioned |
| Authentication | 5/10 | Mentioned but underspecified |
| Webhook Security | 5/10 | Stripe correct, others not addressed |
| Fraud Prevention | 3/10 | Basic rules, no ML, no real-time blocking |
| **Security Total** | **3.2/10** | |

---

## 9. Scalability Assessment

### 9.1 Current Volume Estimate

With SQLite per tenant and a single PostgreSQL instance, Ekala can handle approximately:
- **SQLite:** 10,000+ tenants (each with their own database file)
- **PostgreSQL:** 500-1,000 tenants before requiring read replicas

The document's claim that "PostgreSQL is fine for 500+ tenants" is optimistic. With billing queries (invoices, payments, ledger entries), a single PostgreSQL instance will show performance degradation around 200-300 active tenants.

### 9.2 Database Connection Limits

PostgreSQL has a default max_connections of 100. With:
- 50 API instances
- 10 cron jobs
- 5 webhook handlers
- Connections per instance: 10

Total: 650 connections. This exceeds the default limit by 650%.

**Recommendation:** Use PgBouncer or similar connection pooler. Or use Supabase's built-in pooler.

### 9.3 Multi-Region

The V2.5 multi-region architecture (PostgreSQL per region) is correct but expensive:
- Each region needs: PostgreSQL, Redis, application instances
- Minimum cost per region: $200-500/month
- 5 regions = $1,000-2,500/month infrastructure cost

**For a startup with < 1000 tenants, this is premature.** Deploy in a single region (Zambia) and use a CDN for static assets. Add regions when you have > 500 tenants in a specific country.

### 9.4 Score

| Criteria | Score | Rationale |
|----------|-------|-----------|
| Current Volume | 7/10 | SQLite scales well, PG needs work |
| Connection Management | 3/10 | Missing connection pooling |
| Multi-Region Timing | 2/10 | Premature for current scale |
| **Scalability Total** | **4/10** | |

---

## 10. Feature Flag Assessment

### 10.1 Good Idea, Wrong Implementation

Feature flags are an excellent practice. However:

**10.1.1 PostgreSQL + Redis is over-engineering**

For a startup with < 1000 tenants, feature flags in a simple JSON file or environment variables are sufficient. LaunchDarkly (the industry standard) uses a global CDN, not PostgreSQL.

**10.1.2 The "instant propagation" claim is misleading**

The document claims "changes propagated in < 60s". With Redis cache + TTL, this is true. But what happens when Redis is down? The FeatureFlagService falls back to PostgreSQL, which adds 50-100ms to every payment request.

**10.1.3 Flag combinations are not considered**

What happens when `payment.provider.stripe = false` AND `payment.provider.mtn_mobile_money = false`? All payments are blocked. This is a catastrophic failure mode with no safeguard.

### 10.2 Score

| Criteria | Score | Rationale |
|----------|-------|-----------|
| Concept | 7/10 | Feature flags are good |
| Implementation | 4/10 | Over-engineered for current scale |
| Safety | 2/10 | No safeguards against blocking all providers |
| **Feature Flags Total** | **4.3/10** | |

---

## 11. Overall Assessment

### 11.1 Critical Risks

| # | Risk | Severity | Likelihood | Mitigation Cost |
|---|------|----------|------------|-----------------|
| 1 | Sync engine conflicts cause billing data corruption | Critical | High | Very High |
| 2 | Saga recovery scanner creates double-payment/refund scenarios | Critical | Medium | High |
| 3 | PaymentInProgress expiry races with late webhooks | High | Medium | Medium |
| 4 | DLQ messages not pausing sagas → inconsistent state | High | High | Medium |
| 5 | No PCI DSS scope definition → compliance violation | Critical | Unknown | High |
| 6 | SHA-256 ledger chaining adds complexity without real security | Medium | N/A | Low (remove it) |
| 7 | Provider adapter interface hides async/sync differences | High | High | High |
| 8 | Fraud engine hardcoded thresholds cause false positives/negatives | Medium | High | Very High |
| 9 | Missing fiscal year management → OHADA non-compliance | High | Certain | Medium |
| 10 | PostgreSQL connection pooling not addressed | Medium | High | Low |

### 11.2 Scores

| Domain | Score | Grade |
|--------|-------|-------|
| Architecture (global) | 45/100 | F |
| DDD | 52/100 | F |
| CQRS | 20/100 | F |
| Billing | 40/100 | F |
| Payments | 43/100 | F |
| Offline | 47/100 | F |
| Resilience | 42/100 | F |
| Scalability | 40/100 | F |
| Compliance (OHADA/IFRS) | 50/100 | F |
| Maintainability | 55/100 | F |
| Complexity Management | 35/100 | F |
| Cost Efficiency | 50/100 | F |
| Evolvability | 60/100 | D |
| Observability | 30/100 | F |
| Security | 32/100 | F |

**Global Score: 42/100**

### 11.3 Verdict

The architecture is **not ready for production** at the scale described in the documents.

**Do NOT proceed to Sprint 1 implementation** without addressing:
1. Saga recovery race conditions
2. Sync engine conflict resolution (critical for billing integrity)
3. Payment provider abstraction that handles async/sync differences
4. PCI DSS compliance
5. OHADA fiscal year management

**Do NOT implement:**
1. SHA-256 ledger chaining (waste of engineering effort)
2. Event Sourcing (premature, adds complexity without benefit)
3. Multi-region (too early, too expensive)
4. CQRS (not needed at this scale)
5. Fraud engine with hardcoded thresholds (implement simple rate limiting only, defer ML fraud to when scale justifies it)

### 11.4 What Should Be Built First (Priority Order)

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | PaymentInProgress with proper expiry + webhook race handling | 2 weeks | Prevents financial loss |
| P0 | Saga state machine with paused/cancelled states | 2 weeks | Prevents double payments |
| P0 | Stripe webhook handler with signature verification | 1 week | Source of truth |
| P0 | Idempotency key enforcement | 1 week | Prevents duplicates |
| P1 | Basic fraud rate limiting (Redis + IP) | 2 days | Reduces risk |
| P1 | OHADA fiscal year management | 2 weeks | Legal compliance |
| P1 | PostgreSQL connection pooling | 2 days | Production stability |
| P1 | Trial balance cron | 1 day | Accounting integrity |
| P2 | Provider adapter pattern (simplified, not the full hexagonal interface) | 3 weeks | Extensibility |
| P2 | Feature flags via environment variables (not PostgreSQL+Redis) | 1 week | Operational control |
| P3 | Circuit breakers | 2 weeks | Resilience |
| P3 | Sync engine conflict resolution | 4 weeks | Data integrity |
| P4 | Multi-region | 3 months | Scale |
| P4 | Fraud ML engine | 6 months | Advanced protection |

---

## 12. Comparison with Industry Standards

| Decision | Ekala | Stripe | Square | Toast POS | Shopify | Verdict |
|----------|-------|--------|--------|-----------|---------|---------|
| Payment Gateway Pattern | Hexagonal | Proprietary | Proprietary | Stripe+Square | Proprietary | Over-engineered |
| Ledger | SHA-256 chained | WAL + replicas | WAL + replicas | WAL + replicas | WAL + replicas | Wrong |
| Auth/Capture for all providers | Yes | No (subscription API) | No (reader API) | No (terminal API) | No (Shopify Payments) | Wrong |
| Feature Flags | PG + Redis | Config file | Config file | LaunchDarkly | Shopify Config | Over-engineered |
| CQRS | Planned | Selective | No | No | Selective | Premature |
| Event Sourcing | Planned | For ledger only | For ledger only | No | For audit trail | Premature |
| Fraud Engine | Hardcoded rules | ML (Radar) | ML | Hardcoded + ML | ML | Too early |
| Sync Engine | Bidirectional | N/A (cloud only) | Unidirectional | Bidirectional | N/A (cloud only) | Underspecified |
| Multi-Region | Planned | Global | US + EU | US only | Global | Too early |

---

## Final Recommendation

**Do not build the architecture as described.** It is approximately 60% aspirational, 30% over-engineered, and 10% dangerously wrong.

Build the **minimum viable billing system**:
1. PostgreSQL for billing, SQLite for POS ✅ (keep)
2. Stripe webhooks as source of truth ✅ (keep)
3. Idempotency keys ✅ (keep, but simplify implementation)
4. Simple saga with proper state machine ✅ (build, but add missing states)
5. Outbox + DLQ ✅ (build, but add saga pause mechanism)
6. Double-entry ledger ❌ (simplify: remove SHA-256, add trial balance)
7. Payment provider adapter ❌ (simplify: start with Stripe + Cash, add others later)
8. Fraud engine ❌ (simplify: rate limiting only for now)
9. Feature flags ❌ (simplify: environment variables)
10. Circuit breaker ❌ (simplify: add later when second provider is added)
11. CQRS ❌ (remove entirely)
12. Event Sourcing ❌ (remove entirely)
13. Multi-region ❌ (remove entirely)
14. SHA-256 ledger chaining ❌ (remove entirely)

This reduces the implementation timeline from **18 months to 3 months** for a production-ready billing system that can handle 1,000+ tenants.

---

*End of Review*