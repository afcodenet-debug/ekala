# Ekala Billing V3.0 — Blueprint d'Exécution

**Version:** 3.0  
**Statut:** Blueprint de référence unique  
**Date:** 30/06/2026  
**Inspirations:** Stripe, Square, Toast POS, Shopify, Oracle NetSuite, SAP FI  
**Prédécesseur:** V2.5 (aspirationnel) + Architecture Review (critique)  
**Principe:** Rien n'est construit avant d'être nécessaire.

---

## 1. Philosophy

### 1.1 Ce Document Remplace Tout Ce Qui Précède

Les documents V2.4 et V2.5 sont des explorations. Ce blueprint est la **décision d'architecture finale**.

**Règles :**
1. **On ne construit pas pour un futur hypothétique.** On construit pour les 500 prochains tenants.
2. **On ne copie pas Stripe.** Stripe traite 100M+ requêtes/jour. Ekala traite < 10K. Les solutions sont différentes.
3. **On élimine toute complexité qui n'a pas de bénéfice immédiat.** La complexité se paie en bugs, en tickets support, en turnover développeur.
4. **On garde ce qui marche.** SQLite pour le POS. PostgreSQL pour le billing. Stripe webhook = source de vérité.
5. **On ajoute uniquement ce qui est exigé par la loi (OHADA) ou par la production (crash recovery).**

### 1.2 Ce Qui Est GARDÉ des Versions Précédentes

| Décision | Source | Raison |
|----------|--------|--------|
| SQLite pour POS (offline-first) | V2.3 | ✅ Validé par la production |
| PostgreSQL pour billing centralisé | V2.4 | ✅ Validé par l'audit |
| Stripe webhook = source de vérité paiements | V2.4 | ✅ Standard industriel |
| Idempotence obligatoire | V2.4 | ✅ P0, empêche les doublons |
| Saga avec reprise après crash | V2.4 | ✅ P0, nécessaire en production |
| Outbox + DLQ | V2.4 | ✅ P1, atomicité garantie |
| Double-entry ledger (append-only) | V2.4 | ✅ Conformité OHADA |
| Subscription aggregate (DDD) | V2.1 | ✅ Déjà implémenté, bien conçu |

### 1.3 Ce Qui EST SUPPRIMÉ

| Décision | Source | Raison |
|----------|--------|--------|
| **SHA-256 ledger chaining** | V2.4 | Aucune sécurité réelle. PostgreSQL WAL + réplicas suffisent. |
| **Event Sourcing** | V2.4 | Complexité inutile. Un ledger transactionnel standard fait le travail. |
| **CQRS** | V2.4, V2.5 | Pas nécessaire à cette échelle. Une seule base PostgreSQL avec read replicas si besoin. |
| **Multi-region** | V2.5 | Trop tôt, trop cher. 1 région suffit pour < 1000 tenants. |
| **Fraud Engine complet (8 règles)** | V2.5 | Remplacé par 2 règles simples + Stripe Radar. |
| **Feature Flags avec Redis** | V2.5 | Remplacé par des variables d'environnement. |
| **Circuit Breaker par provider** | V2.5 | Ajouté plus tard quand 2e provider sera intégré. |
| **Provider Factory (10 adapters)** | V2.5 | Stripe + Cash + Voucher suffisent pour la V1. MTN/Orange viendront après. |

### 1.4 Ce Qui EST AJOUTÉ (Manquait dans Toutes les Versions)

| Élément | Priorité | Raison |
|---------|----------|--------|
| **Payment Intent Lifecycle complet** | P0 | States: created → pending → processing → succeeded → failed → expired → cancelled → refunded → disputed |
| **Reconciliation automatique** | P1 | Comparaison quotidienne Stripe ↔ Ledger |
| **Accounting Period Lock (OHADA)** | P1 | Une fois un mois clôturé, plus aucune modification possible |
| **Soft Delete interdit** | P0 | Sur invoices, ledger, payments. Seulement des reversal entries. |
| **Currency Snapshot** | P1 | Le taux de change du jour de la transaction est gelé dans la facture |
| **Retry Policy standardisée** | P0 | 3 retries → DLQ → Notification Admin |
| **Audit Trail complet** | P1 | Qui, Quand, IP, Ancienne valeur, Nouvelle valeur, Pourquoi |
| **PCI DSS scope explicite** | P0 | Défini dans ce document |

---

## 2. Architecture Cible — Ekala Billing V3.0

### 2.1 Diagramme Simplifié

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                EKALA BILLING V3.0                                             │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│  ┌─────────────────────────────────────┐    ┌──────────────────────────────────────────────┐ │
│  │         POS OFFLINE (SQLite)         │    │         BILLING CLOUD (PostgreSQL)           │ │
│  │─────────────────────────────────────│    │──────────────────────────────────────────────│ │
│  │  • Ventes / Commandes               │    │  • Abonnements (Subscriptions)                │ │
│  │  • Stock / Inventaire               │    │  • Paiements (Payment Intents)                │ │
│  │  • Tables / Serveurs                │    │  • Factures (Invoices)                        │ │
│  │  • Cache abonnement (5min TTL)      │    │  • Ledger comptable (double-entry)            │ │
│  │  • Plan pricing (cache read-only)   │    │  • Stripe Webhooks                            │ │
│  │                                     │    │  • OHADA Fiscal Periods                       │ │
│  │  Sync Engine:                       │    │  • Audit Trail                                │ │
│  │  • Ventes → PostgreSQL (async)     │    │  • Reconciliation                             │ │
│  │  • Abonnements ← PostgreSQL (cache) │    │  • Rapports / Dashboard                       │ │
│  └─────────────────────────────────────┘    └──────────────────────────────────────────────┘ │
│                          │                               │                                   │
│                          └───────────────┬───────────────┘                                   │
│                                          │                                                    │
│                                          ▼                                                    │
│                           ┌─────────────────────────────┐                                    │
│                           │         Stripe               │                                    │
│                           │  • Payment Intents           │                                    │
│                           │  • Subscriptions             │                                    │
│                           │  • Webhooks → PostgreSQL     │                                    │
│                           └─────────────────────────────┘                                    │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Payment Intent Lifecycle — V3.0

```
     ┌──────────┐
     │  created  │  Le PaymentInProgress est créé dans PostgreSQL
     └────┬─────┘
          │
          ▼
     ┌──────────┐
     │  pending  │  En attente de confirmation utilisateur (Mobile Money)
     └────┬─────┘
          │
     ┌────┴────┐
     │         │
     ▼         ▼
┌──────────┐ ┌──────────┐
│processing│ │  failed   │  Échec immédiat (carte refusée, solde insuffisant)
└────┬─────┘ └──────────┘
     │                      ⚠ failed → pas de retry automatique (côté Stripe)
     │                        Stripe gère ses propres retries via invoice.payment_failed
     ▼
┌──────────┐
│succeeded │  Confirmé par webhook Stripe (payment_intent.succeeded)
└────┬─────┘
     │
     ├──────────────────┬──────────────────┐
     ▼                  ▼                  ▼
┌──────────┐     ┌──────────┐     ┌──────────┐
│ refunded  │     │ disputed  │     │ expired   │  24h sans confirmation
└──────────┘     └──────────┘     └──────────┘
```

### 2.3 Reconciliation Automatique

```
Tous les jours à 03:00 UTC :

1. Stripe Balance Transaction → Lire les transactions du jour
2. PostgreSQL PaymentInProgress → Lire les paiements du jour
3. Comparer :
   ┌──────────────────────────────┬──────────────────────┬──────────────────────┐
   │ Stripe                       │ PostgreSQL            │ Résultat             │
   ├──────────────────────────────┼──────────────────────┼──────────────────────┤
   │ Montant X présent            │ Montant X présent    │ ✅ OK                │
   │ Montant X présent            │ Montant X absent     │ ❌ Webhook manqué    │
   │ Montant X absent             │ Montant X présent    │ ❌ Doublon ou test   │
   │ Montant X = 100              │ Montant X = 99       │ ❌ Écart comptable   │
   └──────────────────────────────┴──────────────────────┴──────────────────────┘
4. Rapport envoyé au Super Admin
```

### 2.4 Accounting Period Lock (OHADA)

```
MOIS DE JANVIER 2026
┌──────────────────────────────────────────────────────────────────────────────┐
│  1. Créer des factures        │   ✅ Ouvert jusqu'au 05/02                   │
│  2. Enregistrer des paiements │   ✅ Ouvert jusqu'au 05/02                   │
│  3. Modifier le ledger        │   ✅ Ouvert jusqu'au 05/02                   │
├──────────────────────────────────────────────────────────────────────────────┤
│  Après le 05/02/2026 à 23:59                                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│  4. Créer des factures        │   ❌ BLOQUÉ. Créer en février.              │
│  5. Enregistrer des paiements │   ❌ BLOQUÉ. Utiliser une écriture de        │
│                               │       correction dans la période courante.  │
│  6. Modifier le ledger        │   ❌ BLOQUÉ. Seulement des reversal entries. │
└──────────────────────────────────────────────────────────────────────────────┘

Implémentation :
- Table `fiscal_periods` : year, month, locked_at, locked_by
- Cron le 5 de chaque mois : verrouiller le mois précédent
- Toute écriture vérifie : `is_period_open(year, month)` → throw if locked
```

### 2.5 Audit Trail

```sql
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INT NOT NULL,
  actor_type VARCHAR(20) NOT NULL,  -- 'user', 'system', 'webhook_stripe', 'cron'
  actor_id VARCHAR(50),               -- user_id, 'stripe', 'expiration_cron'
  action VARCHAR(50) NOT NULL,        -- 'payment.created', 'subscription.cancelled'
  entity_type VARCHAR(50) NOT NULL,   -- 'subscription', 'payment', 'invoice'
  entity_id INT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  ip_address INET,
  user_agent TEXT,
  reason TEXT,                        -- Pourquoi cette action a été faite
  idempotency_key UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index obligatoires
CREATE INDEX idx_audit_tenant_entity ON audit_log(tenant_id, entity_type, entity_id, created_at);
CREATE INDEX idx_audit_action ON audit_log(action, created_at);
CREATE INDEX idx_audit_idempotency ON audit_log(idempotency_key) WHERE idempotency_key IS NOT NULL;
```

---

## 3. Roadmap d'Implémentation

### 3.1 Phase 1 — Sécuriser les Paiements (Semaines 1-3)

| Tâche | Effort | Dépendances |
|-------|--------|-------------|
| 1.1 Payment Intent Lifecycle | 5 jours | Aucune |
| 1.2 Idempotence key enforcement | 2 jours | Aucune |
| 1.3 Stripe webhook handler (signature verification) | 3 jours | 1.2 |
| 1.4 PaymentInProgress avec expiration + webhook race handling | 5 jours | 1.1, 1.3 |
| 1.5 Saga state machine complète (pending, paused, retrying, compensating, cancelled) | 5 jours | Aucune |
| 1.6 PCI DSS scope check | 2 jours | Aucune |

**Livrable Phase 1 :** Aucun paiement ne peut être perdu, dupliqué, ou non-conforme.

### 3.2 Phase 2 — Fiabiliser le Cœur Métier (Semaines 4-7)

| Tâche | Effort | Dépendances |
|-------|--------|-------------|
| 2.1 Crash recovery saga scanner (vérifie état externe avant compensation) | 5 jours | 1.5 |
| 2.2 Outbox pattern + DLQ avec saga pause mechanism | 5 jours | Aucune |
| 2.3 Double-entry ledger (sans SHA-256, avec trial balance) | 5 jours | Aucune |
| 2.4 Accounting period lock (OHADA) | 3 jours | 2.3 |
| 2.5 Currency snapshot (taux gelé dans la facture) | 2 jours | 2.3 |
| 2.6 Audit trail complet | 3 jours | Aucune |
| 2.7 Soft delete interdit (reversal entries) | 2 jours | 2.3 |

**Livrable Phase 2 :** Conformité OHADA. Aucune perte de données après crash.

### 3.3 Phase 3 — Exploitation et Observabilité (Semaines 8-10)

| Tâche | Effort | Dépendances |
|-------|--------|-------------|
| 3.1 Reconciliation automatique (cron quotidien) | 3 jours | 1.3, 2.3 |
| 3.2 PostgreSQL connection pooling (PgBouncer) | 1 jour | Aucune |
| 3.3 Tableaux de bord billing (Read Model simple) | 5 jours | 2.3 |
| 3.4 Notifications (email, in-app) via Outbox | 3 jours | 2.2 |
| 3.5 Métriques + alerting | 3 jours | Aucune |
| 3.6 Retry policy standardisée (3 retries → DLQ) | 2 jours | 2.2 |

**Livrable Phase 3 :** Exploitable par une équipe ops. Visibilité complète.

### 3.4 Phase 4 — Scale (Selon Croissance)

| Tâche | Déclencheur | Effort Estimé |
|-------|-------------|---------------|
| Provider adapter pour MTN Mobile Money | > 10 demandes clients | 3 semaines |
| Provider adapter pour Orange Money | > 10 demandes clients | 3 semaines |
| Circuit breaker par provider | > 3 providers actifs | 2 semaines |
| Feature flags (env vars → système dédié) | > 10 flags | 1 semaine |
| Read replicas PostgreSQL | Latence > 500ms sur les requêtes billing | 2 jours |
| Multi-region | > 500 tenants dans un pays secondaire | 3 mois |

---

## 4. Règles de Conception (Hard Rules)

Ces règles ne peuvent être enfreintes sans approbation explicite de l'architecte.

### 4.1 Règles de Données

1. **Toute écriture financière est append-only.** Aucun UPDATE ou DELETE sur `ledger_entries`, `invoices`, `payments`.
2. **Les corrections sont des reversal entries.** Exemple : facture erronée → créer un avoir (credit note), pas modifier la facture.
3. **Un mois clôturé est immutable.** Aucune écriture ne peut être ajoutée à une période verrouillée.
4. **Tout paiement a un PaymentIntent.** Pas de paiement "orphelin" sans suivi.
5. **Toute action est tracée.** Qui, Quand, IP, Avant, Après, Pourquoi. Sauf pour les données personnelles (RGPD).

### 4.2 Règles de Paiement

1. **Le frontend ne confirme jamais un paiement.** Seul le webhook Stripe peut marquer un paiement comme `succeeded`.
2. **Tout appel à Stripe a une clé d'idempotence.** Stripe gère l'idempotence côté API. PostgreSQL est une vérification secondaire.
3. **Un PaymentIntent expire après 24h.** Un cron vérifie toutes les heures et interroge Stripe avant de marquer comme expired.
4. **Pas de retry automatique sur échec de carte.** Stripe gère ses retries via `invoice.payment_failed`. Nous nous contentons de mettre à jour le statut.
5. **Les webhooks Stripe sont vérifiés par signature.** Pas d'IP whitelist seule.

### 4.3 Règles de Sécurité

1. **PCI DSS scope = SAQ A (Stripe Elements).** Aucune donnée de carte stockée dans PostgreSQL. Aucun PAN, CVV, piste magnétique.
2. **Les tokens d'accès JWT expirent après 24h.** Refresh token roté à chaque utilisation.
3. **Rate limiting par endpoint :** 100 req/min pour les endpoints billing, 20 req/min pour les endpoints de paiement.
4. **Les webhooks non-Stripe (MTN, Orange) utilisent IP whitelist + secret partagé.**

### 4.4 Règles de Résilience

1. **Toute saga a 6 états :** pending, in_progress, paused, retrying, compensating, completed, failed, cancelled.
2. **Le saga scanner vérifie l'état EXTERNE avant de compenser.** Ne jamais compenser une saga sans vérifier Stripe.
3. **3 retries avant DLQ.** Backoff exponentiel : 1s, 5s, 30s.
4. **Une saga en DLQ est en état paused.** Le saga scanner ne la touche pas tant qu'elle n'est pas sortie de la DLQ.
5. **Le cron recovery tourne toutes les 30s.** Timeout configurable par saga (MTN = 10min, Stripe = 2min).

---

## 5. Modèle de Données V3.0

### 5.1 Tables PostgreSQL (Billing)

```sql
-- =========================================================================
-- CŒUR BILLING
-- =========================================================================

-- Abonnements
CREATE TABLE subscriptions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES tenants(id),
  plan_id INT NOT NULL REFERENCES plans(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, trial, active, past_due, suspended, cancelled, expired
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  auto_renew BOOLEAN DEFAULT TRUE,
  stripe_subscription_id VARCHAR(50),              -- Si Stripe gère le renouvellement
  entity_version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment In Progress (remplace le mécanisme fragile de V2.3)
CREATE TABLE payment_intents (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INT NOT NULL,
  subscription_id INT REFERENCES subscriptions(id),
  idempotency_key UUID UNIQUE NOT NULL,
  stripe_payment_intent_id VARCHAR(50),            -- NULL si pas Stripe
  amount_cents BIGINT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'ZMW',
  status VARCHAR(20) NOT NULL DEFAULT 'created',  -- created, pending, processing, succeeded, failed, expired, cancelled, refunded, disputed
  provider VARCHAR(30) NOT NULL DEFAULT 'stripe',  -- stripe, cash, voucher
  provider_payment_id VARCHAR(50),                 -- ID chez le provider
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,                 -- NOW() + INTERVAL '24 hours'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Factures
CREATE TABLE invoices (
  id BIGSERIAL PRIMARY KEY,
  invoice_number VARCHAR(20) UNIQUE NOT NULL,     -- INV-2026-0001
  tenant_id INT NOT NULL,
  subscription_id INT REFERENCES subscriptions(id),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',    -- draft, issued, paid, cancelled, refunded
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  
  -- Montants
  subtotal_cents BIGINT NOT NULL,
  tax_cents BIGINT DEFAULT 0,
  tax_rate_id INT REFERENCES tax_rates(id),       -- Taux gelé au moment de l'émission
  discount_cents BIGINT DEFAULT 0,
  total_cents BIGINT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'ZMW',
  
  -- Taux de change (gelé)
  exchange_rate_to_zmw DECIMAL(10, 6),             -- NULL si devise = ZMW
  
  -- Métadonnées
  fiscal_period_year INT NOT NULL,
  fiscal_period_month INT NOT NULL,
  stripe_invoice_id VARCHAR(50),                   -- NULL si pas Stripe
  pdf_url TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lignes de facture
CREATE TABLE invoice_lines (
  id BIGSERIAL PRIMARY KEY,
  invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price_cents BIGINT NOT NULL,
  total_cents BIGINT NOT NULL,
  tax_cents BIGINT DEFAULT 0,
  type VARCHAR(30) NOT NULL DEFAULT 'subscription', -- subscription, addon, discount, tax
  metadata JSONB DEFAULT '{}'
);

-- =========================================================================
-- COMPTABILITÉ
-- =========================================================================

-- Ledger comptable (double-entry, append-only)
CREATE TABLE ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INT NOT NULL,
  entry_type VARCHAR(6) NOT NULL CHECK (entry_type IN ('debit', 'credit')),
  account_code VARCHAR(20) NOT NULL,             -- Plan comptable OHADA (411, 701, 445, etc.)
  amount_cents BIGINT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'ZMW',
  description TEXT NOT NULL,
  
  -- Références traçables
  reference_type VARCHAR(30) NOT NULL,           -- 'payment', 'invoice', 'refund', 'voucher'
  reference_id INT NOT NULL,
  
  -- Fiscalité
  tax_rate_id INT REFERENCES tax_rates(id),
  
  -- Période comptable
  fiscal_period_year INT NOT NULL,
  fiscal_period_month INT NOT NULL,
  
  -- Idempotence
  idempotency_key UUID UNIQUE NOT NULL,
  
  -- Traçabilité
  audit_log_id BIGINT REFERENCES audit_log(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index obligatoire pour la trial balance
CREATE INDEX idx_ledger_trial_balance ON ledger_entries(fiscal_period_year, fiscal_period_month, entry_type);

-- Périodes fiscales (OHADA)
CREATE TABLE fiscal_periods (
  id SERIAL PRIMARY KEY,
  year INT NOT NULL,
  month INT NOT NULL,
  is_locked BOOLEAN DEFAULT FALSE,
  locked_at TIMESTAMPTZ,
  locked_by INT REFERENCES users(id),
  closed_at TIMESTAMPTZ,                          -- Date de clôture annuelle (pour OHADA)
  UNIQUE(year, month)
);

-- Taux d'imposition (versionnés)
CREATE TABLE tax_rates (
  id SERIAL PRIMARY KEY,
  country_code CHAR(2) NOT NULL,
  tax_type VARCHAR(20) NOT NULL,                 -- TVA, VAT, ICMS
  rate_bps INT NOT NULL,                          -- 1800 = 18%
  valid_from DATE NOT NULL,
  valid_until DATE,                               -- NULL si actif
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- AUDIT
-- =========================================================================

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INT NOT NULL,
  actor_type VARCHAR(20) NOT NULL,               -- user, system, webhook, cron
  actor_id VARCHAR(50),                           -- user_id, 'stripe', 'cron_expiration'
  action VARCHAR(50) NOT NULL,                    -- payment.created, invoice.issued
  entity_type VARCHAR(50) NOT NULL,               -- subscription, payment, invoice
  entity_id INT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  ip_address INET,
  user_agent TEXT,
  reason TEXT,
  idempotency_key UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- SAGA
-- =========================================================================

CREATE TABLE saga_state (
  id UUID PRIMARY KEY,
  saga_type VARCHAR(50) NOT NULL,                -- subscription_creation, plan_upgrade
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, in_progress, paused, retrying, compensating, completed, failed, cancelled
  steps JSONB NOT NULL DEFAULT '[]',             -- Tableau des étapes avec leur statut
  idempotency_key UUID UNIQUE NOT NULL,
  tenant_id INT NOT NULL,
  timeout_seconds INT NOT NULL DEFAULT 300,       -- 5min par défaut
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- OUTBOX + DLQ
-- =========================================================================

CREATE TABLE outbox (
  id BIGSERIAL PRIMARY KEY,
  aggregate_type VARCHAR(50) NOT NULL,
  aggregate_id INT NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  idempotency_key UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, sent, failed
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  saga_id UUID REFERENCES saga_state(id),        -- Lier à la saga si applicable
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE TABLE dead_letter_queue (
  id BIGSERIAL PRIMARY KEY,
  original_outbox_id BIGINT REFERENCES outbox(id),
  aggregate_type VARCHAR(50) NOT NULL,
  aggregate_id INT NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  saga_id UUID REFERENCES saga_state(id),
  status VARCHAR(20) NOT NULL DEFAULT 'dead',    -- dead, recovering, resolved, ignored
  resolution_note TEXT,
  failed_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
```

### 5.2 Migration depuis V2.3

```sql
-- Étape 1 : Migrer les abonnements existants
INSERT INTO subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
SELECT s.id, s.tenant_id, s.plan_id, s.status, s.current_period_start, s.current_period_end, s.created_at, s.updated_at
FROM backend_old.subscriptions s;

-- Étape 2 : Créer les périodes fiscales pour les mois existants
INSERT INTO fiscal_periods (year, month, is_locked, locked_at)
VALUES (2026, 6, FALSE, NULL);  -- Juin 2026 ouvert (mois courant)

-- Étape 3 : Marquer les paiements existants comme legacy
INSERT INTO payment_intents (tenant_id, idempotency_key, amount_cents, currency, status, provider, metadata, expires_at)
SELECT 
  s.tenant_id,
  gen_random_uuid(),
  0,   -- Montant inconnu
  'ZMW',
  'succeeded',
  'legacy',
  jsonb_build_object('note', 'Migrated from V2.3 subscription #' || s.id),
  NOW() + INTERVAL '365 days'
FROM backend_old.subscriptions s
WHERE s.status = 'active';
```

---

## 6. Spécifications Détaillées par Composant

### 6.1 PaymentIntent Service

```
POST /api/v3/payments/intent
Authorization: Bearer <jwt>
Idempotency-Key: <uuid>

Request:
{
  "tenant_id": 16,
  "amount_cents": 336000,
  "currency": "ZMW",
  "description": "Abonnement Pro Mensuel",
  "provider": "stripe",              // optionnel, défaut = stripe
  "metadata": {
    "subscription_id": 1,
    "customer_email": "admin@makutano.com"
  }
}

Response 201:
{
  "payment_intent_id": 42,
  "status": "created",
  "client_secret": "pi_xxx_secret_yyy",  // Stripe
  "provider": "stripe",
  "expires_at": "2026-07-01T09:00:00Z"
}

Flow:
1. Vérifier idempotence (Idempotency-Key header + PostgreSQL)
2. Vérifier que le tenant existe et n'est pas suspendu
3. Vérifier que le montant > 0
4. Appeler Stripe PaymentIntent.create()
5. Créer payment_intents row (status = 'created')
6. Créer audit_log entry
7. Retourner payment_intent_id + client_secret
```

### 6.2 Stripe Webhook Handler

```
POST /api/v3/webhooks/stripe
Stripe-Signature: <signature>
Content-Type: application/json

Flow:
1. Vérifier la signature Stripe (stripe.webhooks.constructEvent)
2. Extraire l'événement (type + id)
3. Vérifier idempotence (stripe_event_id déjà traité ?)
4. Si déjà traité → 200 OK (pas de reprocessing)
5. Si nouveau :
   a. BEGIN TRANSACTION
   b. Mettre à jour payment_intents.status
   c. Si succeeded : déclencher saga subscription.activate
   d. Écrire dans audit_log
   e. Écrire notification dans outbox
   f. COMMIT
6. Retourner 200 OK

Événements traités :
- payment_intent.succeeded → payment_intent.status = 'succeeded'
- payment_intent.payment_failed → payment_intent.status = 'failed'
- invoice.payment_succeeded → subscription.status = 'active' (renouvellement auto)
- invoice.payment_failed → subscription.status = 'past_due'
- customer.subscription.updated → sync subscription data
- customer.subscription.deleted → subscription.status = 'cancelled'
- charge.dispute.created → payment_intent.status = 'disputed'
- charge.refunded → payment_intent.status = 'refunded'
```

### 6.3 Saga Orchestrator

```
Saga: subscription_creation

Steps:
1. validate_plan
   - Vérifier que le plan existe et est actif
   - Vérifier que le tenant n'a pas déjà un abonnement actif
   → Succès: continuer
   → Échec: fail saga (pas de compensation nécessaire)

2. create_payment_intent
   - Créer PaymentIntent via Stripe
   - Persister dans payment_intents
   → Succès: continuer
   → Échec: fail saga (pas de compensation, rien n'a été créé)

3. wait_for_webhook
   - Paused: attendre le webhook Stripe
   - Timeout: 10 minutes pour MTN, 2 minutes pour Stripe
   → Webhook succeeded: continuer
   → Webhook failed: compenser (annuler la souscription si partiellement créée)
   → Timeout: vérifier Stripe, si succeeded → continuer, si failed → compenser

4. activate_subscription
   - subscription.status = 'active'
   - Créer la facture
   → Succès: saga complétée
   → Échec: compenser (rembourser le paiement)

5. notify_tenant
   - Envoyer email + in-app notification
   → Succès ou échec: ne pas compenser (non bloquant)

Compensation paths:
- Si create_payment_intent échoue: rien à faire
- Si wait_for_webhook timeout: annuler le PaymentIntent Stripe
- Si activate_subscription échoue: refund Stripe + annuler PaymentIntent
```

### 6.4 Reconciliation Cron

```
Tous les jours à 03:00 UTC :

1. Lire les transactions Stripe du jour (Stripe API)
2. Lire les payment_intents du jour (PostgreSQL)
3. Pour chaque transaction Stripe :
   a. Chercher le payment_intent correspondant
   b. Si trouvé et status = 'succeeded' → OK
   c. Si trouvé et status ≠ 'succeeded' → ALERT (incohérence)
   d. Si non trouvé → ALERT (paiement orphelin)
4. Pour chaque payment_intent avec status = 'succeeded' :
   a. Chercher la transaction Stripe correspondante
   b. Si non trouvée → ALERT (écriture fantôme)
5. Générer le rapport
6. Envoyer le rapport au Super Admin
7. Si des ALERTs sont présentes → notification urgente
```

### 6.5 Accounting Period Lock Cron

```
Le 5 de chaque mois à 00:00 UTC :

1. Vérifier que le mois précédent n'est pas déjà verrouillé
2. Exécuter la trial balance :
   SELECT fiscal_period_year, fiscal_period_month,
          SUM(CASE WHEN entry_type = 'debit' THEN amount_cents ELSE 0 END) as total_debits,
          SUM(CASE WHEN entry_type = 'credit' THEN amount_cents ELSE 0 END) as total_credits
   FROM ledger_entries
   WHERE fiscal_period_year = <année_précédente>
     AND fiscal_period_month = <mois_précédent>;
   
3. Si total_debits ≠ total_credits → ALERT URGENT (ne pas verrouiller)
4. Si total_debits = total_credits → verrouiller le mois
5. Audit log entry
```

---

## 7. Tests et Validation

### 7.1 Tests Obligatoires avant Mise en Production

| Test | Description | Critère de succès |
|------|-------------|-------------------|
| T1 | Paiement Stripe complet | PaymentIntent created → webhook succeeded → subscription active |
| T2 | Paiement échoué | PaymentIntent created → webhook failed → subscription unchanged |
| T3 | Idempotence | Même requête 2x → 1 seul PaymentIntent créé |
| T4 | Webhook replay | Même webhook 2x → 1 seule mise à jour |
| T5 | Saga crash recovery | Saga in_progress → kill server → restart → saga reprend |
| T6 | Saga double compensation | Saga compensée → Stripe vérifié avant refund |
| T7 | DLQ pause saga | Message en DLQ → saga paused → saga scanner ne touche pas |
| T8 | Period lock | Mois verrouillé → écriture refusée |
| T9 | Trial balance | Écriture débit sans crédit → ALERT |
| T10 | PCI DSS | Aucune donnée de carte dans PostgreSQL |
| T11 | Reconcilation | Simulation désynchronisation Stripe/PG → ALERT |
| T12 | Offline POS | SQLite fonctionne sans PostgreSQL (sauf billing) |

### 7.2 Scénarios de Test de Résilience

1. **Stripe webhook pendant panne PostgreSQL**
   - Stripe envoie webhook → PG inaccessible → Stripe retry
   - 3 retries sur 1h → PG revient → webhook traité
   - Résultat : paiement traité dans l'heure, pas de perte

2. **Crash serveur pendant saga activate**
   - Saga status = in_progress (step 3/5)
   - Serveur crash → redémarrage → saga scanner
   - Scanner trouve saga in_progress > timeout
   - Vérifie stripe : paiement succeeded
   - Continue la saga (ne compense pas)
   - Résultat : saga complétée, aucune perte

3. **Double activation de subscription**
   - Webhook succeeded arrive 2x (Stripe retry)
   - Idempotence : 2e requête détectée comme déjà traitée
   - Résultat : 200 OK, pas de side-effect

4. **Paiement MTN confirmé après expiration PaymentInProgress**
   - PaymentInProgress expire (24h) → status = 'expired'
   - MTN envoie webhook 2h après
   - Webhook handler vérifie : PaymentIntent existe mais status = 'expired'
   - Vérifie Stripe : paiement succeeded
   - Réanime le PaymentInProgress + active subscription
   - Résultat : paiement traité, subscription active

---

## 8. Glossaire V3.0

| Terme | Définition |
|-------|------------|
| **PaymentIntent** | Entité qui suit le cycle de vie complet d'un paiement (created → succeeded/failed/expired/refunded/disputed) |
| **Reconciliation** | Processus quotidien de comparaison Stripe ↔ PostgreSQL pour détecter les écarts |
| **Trial Balance** | Vérification que SUM(debits) = SUM(credits) dans le ledger à tout moment |
| **Accounting Period Lock** | Mécanisme OHADA qui empêche toute modification d'un mois clôturé |
| **Reversal Entry** | Écriture comptable compensatoire (pas de modification, pas de suppression) |
| **Currency Snapshot** | Taux de change gelé dans la facture au moment de l'émission |
| **Saga Scanner** | Cron qui détecte les sagas inactives et les reprend ou les compense |
| **DLQ Pause** | Mécanisme qui met une saga en pause quand un message part en DLQ |
| **PCI DSS SAQ A** | Niveau de conformité PCI le plus bas (aucune donnée de carte stockée) |

---

## 9. Matrice de Maturité V3.0

| Critère | Score V3.0 | V2.3 (actuel) | Δ |
|---------|------------|---------------|---|
| Paiements sécurisés | 90/100 | 30/100 | +60 |
| Conformité OHADA | 85/100 | 30/100 | +55 |
| Résilience crash | 80/100 | 10/100 | +70 |
| Idempotence | 95/100 | 0/100 | +95 |
| DDD | 75/100 | 70/100 | +5 |
| Audit Trail | 90/100 | 20/100 | +70 |
| Offline-First | 85/100 | 80/100 | +5 |
| Scalabilité (< 1000 tenants) | 85/100 | 60/100 | +25 |
| Simplicité | 80/100 | 40/100 | +40 |
| **Global** | **85/100** | **38/100** | **+47** |

---

**Fin du Blueprint V3.0 — Référence unique pour le développement**