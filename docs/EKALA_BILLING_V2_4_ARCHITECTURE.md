# Architecture Finale Ekala Billing V2.4

**Version:** 2.4  
**Statut:** Approvée  
**Date:** 30/06/2026  
**Auteur:** Équipe Architecture  
**Référence:** Succède à V2.3 (billing mixte SQLite/Supabase)

---

## Table des Matières

1. [Contexte et Objectifs](#1-contexte-et-objectifs)
2. [Principes Architecturaux](#2-principes-architecturaux)
3. [Vue d'Ensemble — Diagramme C4 Niveau 1](#3-vue-densemble--diagramme-c4-niveau-1)
4. [Frontières SQLite / PostgreSQL](#4-frontières-sqlite--postgresql)
5. [Composants du Système de Billing](#5-composants-du-système-de-billing)
6. [Stratégie Offline-First](#6-stratégie-offline-first)
7. [Sagas et Transactions Distribuées](#7-sagas-et-transactions-distribuées)
8. [Outbox Pattern et Dead Letter Queue](#8-outbox-pattern-et-dead-letter-queue)
9. [Webhooks Stripe et Idempotence](#9-webhooks-stripe-et-idempotence)
10. [Politiques de Reprise Après Crash](#10-politiques-de-reprise-après-crash)
11. [Conformité Comptable OHADA/IFRS](#11-conformité-comptable-ohadaifrs)
12. [Gestion des Devises](#12-gestion-des-devises)
13. [Diagrammes de Séquence](#13-diagrammes-de-séquence)
14. [Diagramme d'Architecture Détaillé](#14-diagramme-darchitecture-détaillé)
15. [Décisions ADR](#15-décisions-adr)
16. [Glossaire](#16-glossaire)

---

## 1. Contexte et Objectifs

### 1.1 Problèmes Identifiés dans V2.3

| Problème | Impact | Priorité |
|----------|--------|----------|
| Saga sans reprise après crash | Perte de transactions si le serveur tombe | P0 |
| Pas de clé d'idempotence | Doublons de paiement possibles | P0 |
| Stripe webhook non source de vérité | Désynchronisation paiements/abonnements | P0 |
| Pas de politique d'arrondi | Écarts comptables mineurs mais cumulatifs | P1 |
| Pas d'historisation des taux fiscaux | Non-conformité OHADA/IFRS | P1 |
| DLQ sans mécanisme de rejeu | Dead letters non récupérées | P1 |
| Absence de monitoring des crons | Pannes silencieuses | P1 |
| Pas de PaymentInProgress | Risque de double soumission | P1 |

### 1.2 Objectifs de V2.4

1. **Séparation claire** SQLite (offline POS) / PostgreSQL (billing centralisé)
2. **Résilience** — Sagas avec reprise, idempotence obligatoire, DLQ avec rejeu
3. **Conformité** — OHADA/IFRS, historisation fiscale, piste d'audit complète
4. **Offline-First** — Le POS ne dépend jamais du cloud pour fonctionner
5. **Interopérabilité** — Stripe webhook = source de vérité des paiements

---

## 2. Principes Architecturaux

### 2.1 Theorems et Contraintes

```
┌──────────────────────────────────────────────────────────────────────────┐
│  PRINCIPES FONDATEURS                                                     │
├──────────────────────────────────────────────────────────────────────────┤
│  1. Offline-First : le POS local ne dépend jamais du cloud               │
│  2. Billing Centralisé : PostgreSQL = source de vérité financière        │
│  3. Idempotence Obligatoire : toute opération financière a une clé       │
│  4. Saga Compensatoire : toute transaction longue peut être annulée      │
│  5. Audit Trail : toute modification financière est horodatée et signée │
│  6. Event Sourcing : le ledger est immuable, append-only                 │
│  7. Fail-Open : le POS survit à une panne cloud                         │
│  8. Anti-Corruption Layer : SQLite ne parle pas directement à Stripe    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Contraintes Techniques

| Contrainte | Valeur | Raison |
|------------|--------|--------|
| Stripe Webhook Timeout | ≤ 5s | Idempotence + retry Stripe |
| Sync latency cible | < 30s | Acceptable pour POS |
| Crons billing | Fenêtre de 2h (03:00-05:00 UTC) | Évitement contention |
| SQLite par tenant | 1 base = 1 restaurant | Isolation naturelle |
| PostgreSQL | 1 instance mutualisée | Centralisation billing |

---

## 3. Vue d'Ensemble — Diagramme C4 Niveau 1

```
┌═══════════════════════════════════════════════════════════════════════════════┐
║                        EKALA PLATFORM — SYSTEM CONTEXT                        ║
╚═══════════════════════════════════════════════════════════════════════════════╝

                          ┌───────────────────────┐
                          │   Stripe / Paystack    │
                          │   (Payment Gateway)    │
                          └───────────┬───────────┘
                                      │ Webhooks
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           EKALA BILLING SYSTEM                                │
│                                                                              │
│  ┌──────────────────────────┐    ┌─────────────────────────────────────────┐ │
│  │   PLATFORM CLOUD          │    │   TENANT OFFLINE                        │ │
│  │   (PostgreSQL/Supabase)   │◄──►│   (SQLite par restaurant)               │ │
│  │                          │    │                                         │ │
│  │  • Subscription Service  │    │  • POS (ventes hors ligne)              │ │
│  │  • Payment Service       │    │  • Inventory (stock local)              │ │
│  │  • Invoice Service       │    │  • Orders (commandes)                   │ │
│  │  • Accounting Ledger     │    │  • Sync Engine (bidirectionnel)          │ │
│  │  • Webhook Handler       │    │  • Local Event Store                    │ │
│  │  • Saga Orchestrator     │    │                                         │ │
│  │  • DLQ Processor         │    └─────────────────────────────────────────┘ │
│  │  • Cron Engine           │                                              │
│  └──────────────────────────┘                                               │
└──────────────────────────────────────────────────────────────────────────────┘
              │                        │
              ▼                        ▼
     ┌──────────────────┐   ┌──────────────────────┐
     │   Super Admin     │   │   Tenant Dashboard   │
     │   (Platform)      │   │   (Settings/Billing) │
     └──────────────────┘   └──────────────────────┘
```

---

## 4. Frontières SQLite / PostgreSQL

### 4.1 Carte des Responsabilités

| Domaine | SQLite (Offline) | PostgreSQL (Cloud) | Mécanisme de Sync |
|---------|-----------------|-------------------|-------------------|
| **Plans & Pricing** | Cache read-only | Source de vérité | Pull au démarrage |
| **Abonnements** | Cache (subscriptions table) | Source de vérité | Sync engine |
| **Paiements** | — | Stripe Webhook → PostgreSQL | Stripe → Webhook |
| **Factures** | — | Générées dans PostgreSQL | Consultées via API |
| **Ledger Comptable** | — | Append-only dans PostgreSQL | — |
| **Ventes POS** | Source locale | Aggrégée pour billing | Sync engine |
| **Vouchers** | Cache | Source de vérité | Sync engine |
| **Taux de change** | Cache | Source de vérité | Pull périodique |
| **Taux fiscaux** | Cache avec version | Source de vérité historisée | Pull au démarrage |

### 4.2 Règles de Routage

```
Toute requête API suit ces règles :

1. EST-CE UNE OPÉRATION FINANCIÈRE ? (paiement, facture, refund)
   → POSTGRESQL UNIQUEMENT
   → Jamais SQLite

2. EST-CE UNE OPÉRATION POS ? (vente, commande, stock)
   → SQLITE LOCAL D'ABORD
   → Puis sync vers PostgreSQL en async

3. EST-CE UNE LECTURE DE STATUT D'ABONNEMENT ?
   → SQLite d'abord (cache local)
   → Fallback PostgreSQL si cache vide/expiré

4. EST-CE UN WEBHOOK STRIPE ?
   → POSTGRESQL UNIQUEMENT
   → Idempotence obligatoire
```

### 4.3 Diagramme de Flux des Données

```
                    ┌──────────────────────────┐
                    │     Stripe Webhook        │
                    │   (payment_intent.*)      │
                    └────────────┬─────────────┘
                                 │ HTTP POST
                                 ▼
                    ┌──────────────────────────┐
                    │   Webhook Handler         │
                    │   (idempotency check)     │
                    └────────────┬─────────────┘
                                 │ Écriture
                                 ▼
                    ┌──────────────────────────┐
                    │  PostgreSQL               │
                    │  • payment_transactions   │
                    │  • subscriptions (status) │
                    │  • invoice_ledger         │
                    └────────────┬─────────────┘
                                 │ Sync Engine
                                 ▼
                    ┌──────────────────────────┐
                    │  SQLite (tenant)          │
                    │  • subscriptions (cache)  │
                    │  • tenant_subscriptions   │
                    └──────────────────────────┘
```

---

## 5. Composants du Système de Billing

### 5.1 Catalogue des Composants

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      BILLING SYSTEM — COMPOSANTS                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                  │
│  │ Subscription    │  │ Payment         │  │ Invoice         │                 │
│  │ Service         │  │ Service         │  │ Service         │                 │
│  ├────────────────┤  ├────────────────┤  ├────────────────┤                  │
│  │ Responsabilité: │  │ Responsabilité: │  │ Responsabilité: │                 │
│  │ Gérer le cycle  │  │ Traiter les     │  │ Générer les     │                 │
│  │ de vie des      │  │ paiements via   │  │ factures PDF,   │                 │
│  │ abonnements     │  │ Stripe/Paystack │  │ séquentielles   │                 │
│  │ (création,      │  │ avec idempotence│  │ conformes       │                 │
│  │ upgrade,        │  │ et reprise      │  │ OHADA/IFRS      │                 │
│  │ downgrade,      │  │ après crash     │  │                 │                 │
│  │ cancel, expiry) │  │                 │  │                 │                 │
│  └────────┬───────┘  └────────┬────────┘  └────────┬────────┘                 │
│           │                  │                     │                          │
│           ▼                  ▼                     ▼                          │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                     SAGA ORCHESTRATOR                                  │   │
│  │  Coordonne les transactions longues (creation subscription +          │   │
│  │  paiement + activation) avec reprise après crash                      │   │
│  └──────────────────────────────────────────────────────────────────────┘    │
│           │
│           ▼
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                     OUTBOX + DLQ                                      │   │
│  │  Queue de messages transactionnelle + Dead Letter Queue avec rejeu    │   │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                  │
│  │ Voucher         │  │ Tax Service    │  │ Currency        │                 │
│  │ Service         │  │                │  │ Service         │                 │
│  ├────────────────┤  ├────────────────┤  ├────────────────┤                  │
│  │ Responsabilité: │  │ Responsabilité: │  │ Responsabilité: │                 │
│  │ Gérer les codes │  │ Calculer la     │  │ Gérer les taux  │                 │
│  │ voucher,        │  │ TVA/taxes avec  │  │ de change,      │                 │
│  │ redemption,     │  │ versioning      │  │ conversion      │                 │
│  │ expiration      │  │ historique      │  │ multi-devises   │                 │
│  └────────────────┘  └────────────────┘  └────────────────┘                  │
│                                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                  │
│  │ Accounting      │  │ Reporting      │  │ Notification   │                 │
│  │ Ledger          │  │ Service        │  │ Service        │                 │
│  ├────────────────┤  ├────────────────┤  ├────────────────┤                  │
│  │ Responsabilité: │  │ Responsabilité: │  │ Responsabilité: │                 │
│  │ Tenir le journal│  │ Générer les     │  │ Envoyer les     │                 │
│  │ comptable       │  │ rapports        │  │ notifications   │                 │
│  │ (append-only,   │  │ financiers      │  │ (email, in-app) │                 │
│  │ immutable)      │  │                 │  │                 │                 │
│  └────────────────┘  └────────────────┘  └────────────────┘                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Subscription Service

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    SUBSCRIPTION SERVICE — CYCLE DE VIE                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  États : [trial] → [active] → [past_due] → [suspended] → [cancelled]        │
│              │            │            │            │                         │
│              ▼            ▼            ▼            ▼                         │
│          expired     grace(7j)     grace(7j)    archived(90j)                │
│                                                                              │
│  Transitions :                                                                │
│  • trial → expired : J+7 (cron daily)                                        │
│  • active → past_due : paiement échoué (webhook Stripe)                      │
│  • past_due → suspended : J+7 sans paiement (cron)                           │
│  • active → active : renouvellement automatique (Stripe)                      │
│  • active → cancelled : demande utilisateur (Soft cancel)                    │
│                                                                              │
│  API Endpoints :                                                              │
│  POST   /api/v2/subscriptions          → Créer (via saga)                     │
│  GET    /api/v2/subscriptions/:id      → Lire                                │
│  PATCH  /api/v2/subscriptions/:id      → Modifier plan (upgrade/downgrade)   │
│  DELETE /api/v2/subscriptions/:id      → Cancel (soft)                       │
│  POST   /api/v2/subscriptions/:id/reactivate → Réactiver après suspension    │
│                                                                              │
│  Règles Métier :                                                              │
│  • Upgrade → immédiat, prorata temporis                                       │
│  • Downgrade → à la prochaine date de renouvellement                          │
│  • Cancel → fin de période, pas de remboursement sauf légal                  │
│  • Trial unique par tenant (vérifié côté PostgreSQL)                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Payment Service

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       PAYMENT SERVICE — ARCHITECTURE                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Flux :                                                                      │
│  1. Client initie le paiement (frontend)                                     │
│  2. Backend génère une clé d'idempotence (UUID v4)                          │
│  3. Backend crée PaymentInProgress dans PostgreSQL                           │
│  4. Backend appelle Stripe Payment Intent                                    │
│  5. Stripe envoie webhook (payment_intent.succeeded)                         │
│  6. Webhook Handler vérifie l'idempotence                                   │
│  7. PaymentInProgress → completed / failed                                  │
│  8. Saga Subscription activée si succès                                      │
│  9. Notification envoyée au tenant                                           │
│                                                                              │
│  Structure PaymentInProgress :                                                │
│  {                                                                           │
│    id: UUID,                                                                 │
│    tenant_id: number,                                                        │
│    idempotency_key: string,         // Unique, empêche le doublon            │
│    status: 'pending' | 'completed' | 'failed' | 'expired',                   │
│    amount_cents: number,                                                     │
│    currency: string,                                                         │
│    stripe_payment_intent_id: string,                                         │
│    subscription_id: number,                                                  │
│    created_at: timestamp,                                                    │
│    expires_at: timestamp,         // 24h après création                      │
│    metadata: JSON                                                            │
│  }                                                                           │
│                                                                              │
│  Politique d'Expiration :                                                    │
│  • PaymentInProgress expire après 24h                                        │
│  • Cron daily nettoie les pending_expired                                    │
│  • Stripe gère ses propres timeouts (30min pour PaymentIntent)               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.4 Invoice Service

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      INVOICE SERVICE — SPÉCIFICATIONS                         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Format : INV-{YYYY}-{NNNN} (séquentiel, reset annuel)                      │
│                                                                              │
│  Types de Factures :                                                         │
│  • Abonnement : Générée automatiquement au renouvellement                    │
│  • Avoir : En cas de remboursement partiel                                   │
│  • Refund : En cas d'annulation dans les 30 jours                            │
│  • Usage : Dépassement d'API, stockage supplémentaire                       │
│                                                                              │
│  Contenu Obligatoire (OHADA) :                                               │
│  • Numéro séquentiel unique                                                  │
│  • Date d'émission                                                           │
│  • Date d'échéance                                                           │
│  • Identification fiscale du vendeur (NIF/RCCM)                              │
│  • Identification fiscale du client                                          │
│  • Description détaillée des services                                        │
│  • Montant HT / TVA / TTC                                                    │
│  • Taux de TVA appliqué (avec version)                                      │
│  • Conditions de paiement                                                    │
│  • Cachet digital (signature SHA-256 de la facture)                         │
│                                                                              │
│  Stockage :                                                                  │
│  • Metadata dans PostgreSQL (table invoices)                                 │
│  • PDF généré et stocké dans Supabase Storage                                │
│  • Rétention légale : 7 ans                                                  │
│  • Archivage automatique après 90 jours en cold storage                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.5 Accounting Ledger

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    ACCOUNTING LEDGER — ARCHITECTURE                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Principe : APPEND-ONLY, IMMUABLE, HORODATÉ                                  │
│                                                                              │
│  Structure d'une entrée de ledger :                                          │
│  {                                                                           │
│    id: BIGSERIAL,                    // Auto-incrément                       │
│    tenant_id: INT,                                                           │
│    entry_type: 'debit' | 'credit',                                           │
│    account_code: VARCHAR(20),        // Plan comptable OHADA                 │
│    amount_cents: BIGINT,             // En centimes                          │
│    currency: CHAR(3),                                                       │
│    description: TEXT,                                                        │
│    reference_type: 'subscription' | 'payment' | 'refund' | 'voucher',        │
│    reference_id: INT,                                                        │
│    fiscal_tax_rate_id: INT,          // FK vers tax_rates historisées        │
│    idempotency_key: UUID,            // UNIQUE, empêche doublon              │
│    parent_entry_id: INT,             // Pour les écritures miroir            │
│    created_at: TIMESTAMPTZ,          // Horodatage immutable                 │
│    signature: VARCHAR(64)            // SHA256(concat(prev_signature, data)) │
│  }                                                                           │
│                                                                              │
│  Règles :                                                                     │
│  • Toute écriture est double (debit + credit)                                │
│  • Une entrée ne peut jamais être modifiée ou supprimée                      │
│  • Les corrections se font par écriture compensatoire                        │
│  • La signature SHA-256 chaînée garantit l'intégrité                         │
│  • L'idempotency_key garantit l'unicité                                      │
│                                                                              │
│  Exemple d'écriture double :                                                  │
│  Entrée 1 : debit  account=411 (Client)     amount=64,900                   │
│  Entrée 2 : credit account=701 (Ventes)     amount=54,661                   │
│  Entrée 3 : credit account=445 (TVA)        amount=10,239                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.6 Voucher Service

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      VOUCHER SERVICE — SPÉCIFICATIONS                         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Format : EKA-{TENANT_ID}-{CODE_6_CHARS}                                    │
│  Exemple : EKA-16-ABC1D2                                                    │
│                                                                              │
│  Cycle de vie : [pending] → [verified] → [activated] → [expired]              │
│                                                        → [cancelled]          │
│                                                                              │
│  Validation :                                                                 │
│  • Le code doit exister dans PostgreSQL (source de vérité)                   │
│  • Le code ne doit pas être expiré                                           │
│  • Le code ne doit pas déjà être activé                                      │
│  • Le tenant doit correspondre (ou être vide)                                │
│                                                                              │
│  Redemption :                                                                 │
│  1. Tenant saisit le code dans SubscriptionPremiumPage                       │
│  2. API POST /api/v2/vouchers/redeem avec idempotency_key                    │
│  3. Voucher Service vérifie le code dans PostgreSQL                          │
│  4. Si valide : met à jour la subscription + statut voucher                  │
│  5. Génère une entrée dans le ledger comptable                               │
│  6. Invalide le cache subscription du tenant                                 │
│  7. Notifie le tenant (in-app + email)                                      │
│                                                                              │
│  Génération :                                                                 │
│  • Super Admin uniquement (via interface platform)                           │
│  • Possibilité de générer en batch                                           │
│  • Chaque voucher a une date d'expiration                                    │
│  • Les vouchers peuvent être liés à un plan spécifique                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.7 Tax Service

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      TAX SERVICE — SPÉCIFICATIONS                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Table tax_rates :                                                           │
│  {                                                                           │
│    id: SERIAL PRIMARY KEY,                                                   │
│    country_code: CHAR(2),            // TG, SN, CI, ZM, etc.                │
│    tax_type: VARCHAR(20),            // TVA, VAT, ICMS, etc.                │
│    rate_bps: INTEGER,                // Taux en basis points (1800 = 18%)    │
│    valid_from: DATE,                 // Date d'effet                         │
│    valid_until: DATE,                // NULL si actif                        │
│    metadata: JSONB,                  // Informations légales                 │
│    created_at: TIMESTAMPTZ                                                    │
│  }                                                                           │
│                                                                              │
│  Règles :                                                                     │
│  • Les taux sont versionnés (valid_from / valid_until)                       │
│  • Une facture référence le tax_rate_id en vigueur à sa date d'émission      │
│  • Les modifications de taux n'affectent pas les factures déjà émises        │
│  • Le POS envoie le montant TTC, le calcul de la TVA est fait côté cloud     │
│                                                                              │
│  Politique d'Arrondi :                                                        │
│  • Méthode : HALF_UP (arrondi standard)                                      │
│  • Précision : 2 décimales                                                   │
│  • Règle : Le total des lignes arrondies = le total arrondi                  │
│  • Conformité : OHADA article 12 (arrondi à l'avantage du client)           │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.8 Currency Service

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                   CURRENCY SERVICE — SPÉCIFICATIONS                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Tables :                                                                     │
│  • currencies : ZMW, USD, EUR, XAF, XOF (liste des devises supportées)       │
│  • exchange_rates : taux historisés (base_currency → target_currency)         │
│                                                                              │
│  Règles :                                                                     │
│  • La devise fonctionnelle d'Ekala est ZMW (centimes)                        │
│  • Tous les prix sont stockés en centimes de la devise locale                │
│  • Les taux de change sont mis à jour quotidiennement (cron)                 │
│  • Les taux sont historisés (une facture garde le taux du jour)              │
│  • La conversion se fait au moment de la facturation                         │
│                                                                              │
│  API :                                                                        │
│  GET /api/v2/currencies                      → Liste des devises             │
│  GET /api/v2/currencies/:code/rates          → Taux historisés               │
│  POST /api/v2/currencies/convert             → Convertir montant             │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.9 Notification Service

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                   NOTIFICATION SERVICE — SPÉCIFICATIONS                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Événements Déclencheurs :                                                    │
│  • payment.succeeded       → Email + In-app                                  │
│  • payment.failed          → Email + In-app                                  │
│  • subscription.expiring   → Email (J-7, J-3, J-1)                          │
│  • subscription.expired    → Email + In-app                                  │
│  • subscription.grace      → Email (daily pendant grace)                     │
│  • invoice.available       → Email avec PDF                                  │
│  • invoice.past_due        → Email (J+3, J+7)                                │
│  • voucher.redeemed        → In-app                                          │
│  • account.suspended       → Email + In-app                                  │
│                                                                              │
│  Canaux :                                                                     │
│  • Email (SendGrid/Mailgun) — canal principal pour billing                   │
│  • In-app (NotificationCenter) — notifications temps réel                    │
│  • SMS (Afrique) — uniquement pour paiement échoué                          │
│                                                                              │
│  Templates :                                                                  │
│  • Tous les templates sont dans PostgreSQL (table email_templates)           │
│  • Support multilingue (FR, EN, PT)                                          │
│  • Variables dynamiques (tenant_name, amount, date, etc.)                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Stratégie Offline-First

### 6.1 Principe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    STRATÉGIE OFFLINE-FIRST — PRINCIPE                         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Le POS doit fonctionner PARFAITEMENT sans connexion internet.               │
│                                                                              │
│  Ce qui est disponible OFFLINE :                                              │
│  ✅ Créer des ventes (POS)                                                    │
│  ✅ Gérer les stocks                                                          │
│  ✅ Gérer les commandes                                                       │
│  ✅ Gérer les tables                                                          │
│  ✅ Gérer les utilisateurs locaux                                             │
│  ✅ Consulter le statut d'abonnement (cache)                                 │
│  ✅ Voir les plans tarifaires (cache)                                        │
│                                                                              │
│  Ce qui nécessite le CLOUD :                                                  │
│  ❌ Payer un abonnement                                                       │
│  ❌ Générer une facture                                                       │
│  ❌ Consulter l'historique des paiements                                      │
│  ❌ Activer un voucher                                                        │
│  ❌ Modifier son abonnement                                                   │
│  ❌ Consulter les rapports financiers                                         │
│                                                                              │
│  Comportement du Subscription Guard en mode offline :                        │
│  • Si SQLite a un cache actif → utiliser le cache (5min TTL)                │
│  • Si SQLite a un cache expiré → utiliser le cache (dérogation offline)     │
│  • Si SQLite n'a pas de cache → BLOCKER l'accès (sauf billing routes)       │
│  • Si PostgreSQL est injoignable → utiliser le cache SQLite                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Sync Engine — Flux Bidirectionnel

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    SYNC ENGINE — FLUX BIDIRECTIONNEL                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                          ┌──────────────────┐                                │
│                          │   Sync Engine     │                                │
│                          └────────┬─────────┘                                │
│                                   │                                          │
│            ┌──────────────────────┼──────────────────────┐                    │
│            │                      │                      │                    │
│            ▼                      ▼                      ▼                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐               │
│  │ SQLite → PG      │  │ PG → SQLite     │  │ Conflict         │              │
│  │ (POS → Cloud)   │  │ (Cloud → POS)    │  │ Resolution       │              │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤               │
│  │ Ventes          │  │ Plans           │  │ Last-Write-Wins  │              │
│  │ Stocks          │  │ Subscriptions   │  │ + Lamport Clock  │              │
│  │ Commandes       │  │ Vouchers        │  │ + Manual DLQ     │              │
│  │ Mouvements      │  │ Taux            │  │                  │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘               │
│                                                                              │
│  Stratégie de résolution de conflits :                                       │
│  • Lamport Clock : chaque tenant a une horloge logique                       │
│  • Last-Write-Wins : en cas de conflit, le dernier timestamp gagne           │
│  • Conflict DLQ : les conflits non résolus sont loggés pour revue manuelle   │
│  • Periodic Pull : le POS pull les données cloud toutes les 5 minutes        │
│  • Push immédiat : les données POS sont poussées immédiatement en online     │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Sagas et Transactions Distribuées

### 7.1 Saga : Création d'Abonnement + Paiement

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    SAGA: CREATE SUBSCRIPTION + PAYMENT                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    │
│  │  Step 1  │    │  Step 2  │    │  Step 3  │    │  Step 4  │    │  Step 5  │  │
│  │ Validate │───►│ Create   │───►│ Create   │───►│ Confirm  │───►│ Activate │  │
│  │ Plan     │    │ Payment  │    │ Invoice  │    │ Stripe   │    │ Sub      │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘    │
│       │              │              │              │              │         │
│       ▼              ▼              ▼              ▼              ▼         │
│  ╔══════════╗  ╔══════════╗  ╔══════════╗  ╔══════════╗  ╔══════════╗     │
│  ║ Comp 1   ║  ║ Comp 2   ║  ║ Comp 3   ║  ║ Comp 4   ║  ║ Comp 5   ║     │
│  ║ Rollback  ║  ║ Cancel   ║  ║ Void     ║  ║ Refund   ║  ║ Disable  ║     │
│  ║ Plan      ║  ║ Payment  ║  ║ Invoice  ║  ║ Stripe   ║  ║ Sub      ║     │
│  ╚══════════╝  ╚══════════╝  ╚══════════╝  ╚══════════╝  ╚══════════╝     │
│                                                                              │
│  SAGA Orchestrator :                                                          │
│  • Table saga_state dans PostgreSQL                                           │
│  • Chaque étape est loggée avec son statut                                    │
│  • Si une étape échoue, la saga exécute les compensations en ordre inverse    │
│  • Le saga_state est persisté (survit à un crash)                            │
│  • Un cron recovery.scan_sagas() reprend les sagas incomplètes               │
│  • Timeout global : 30 minutes                                                │
│                                                                              │
│  Saga State Machine :                                                         │
│  {                                                                            │
│    id: UUID,                                                                  │
│    saga_type: 'subscription_creation',                                        │
│    status: 'in_progress' | 'completed' | 'failed' | 'compensating',           │
│    steps: [                                                                   │
│      { name: 'validate_plan',         status: 'done', compensation: '-' },    │
│      { name: 'create_payment',        status: 'done', compensation: 'cancel' },│
│      { name: 'create_invoice',        status: 'done', compensation: 'void' }, │
│      { name: 'confirm_stripe',        status: 'pending' },                    │
│    ],                                                                         │
│    idempotency_key: UUID,                                                     │
│    tenant_id: INT,                                                            │
│    created_at: TIMESTAMPTZ,                                                   │
│    updated_at: TIMESTAMPTZ                                                    │
│  }                                                                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Saga : Upgrade de Plan

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    SAGA: UPGRADE SUBSCRIPTION                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Étapes :                                                                    │
│  1. Vérifier que le nouveau plan est disponible (validate)                   │
│  2. Calculer le prorata (remaining_days / total_days × price_diff)          │
│  3. Créer un PaymentInProgress pour le montant du prorata                    │
│  4. Invoice d'ajustement (credit note for old plan + invoice for new plan)  │
│  5. Mettre à jour la subscription dans PostgreSQL                            │
│  6. Invalider le cache SQLite du tenant                                      │
│  7. Notifier le tenant                                                       │
│                                                                              │
│  Compensation :                                                               │
│  • Si échec paiement → annuler l'upgrade, garder l'ancien plan              │
│  • Si échec facture → annuler l'upgrade, rembourser si déjà payé            │
│  • Si échec notification → ne RIEN faire (pas bloquant)                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Saga : Résiliation

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    SAGA: CANCEL SUBSCRIPTION                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Soft Cancel :                                                                │
│  1. subscription.status = 'cancelled' (mais service continue jusqu'à fin)    │
│  2. auto_renew = false                                                       │
│  3. Stripe : cancel_at_period_end = true                                     │
│  4. Notification envoyée                                                     │
│                                                                              │
│  Hard Cancel (remboursement) :                                                │
│  1. subscription.status = 'cancelled' (immédiat)                             │
│  2. Calcul du remboursement prorata (jours restants - frais)                 │
│  3. Stripe : refund (via webhook)                                            │
│  4. Invoice de remboursement (avoir)                                         │
│  5. Entrée dans le ledger comptable                                          │
│  6. Notification + email                                                     │
│                                                                              │
│  Règles :                                                                     │
│  • Soft cancel par défaut (pas de remboursement)                             │
│  • Hard cancel uniquement dans les 30 jours (légal)                          │
│  • Après 30 jours : pas de remboursement sauf SLA breach                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Outbox Pattern et Dead Letter Queue

### 8.1 Transactional Outbox

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    TRANSACTIONAL OUTBOX — PATTERN                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Principe :                                                                   │
│  Lors d'une opération qui nécessite :                                        │
│  • Une écriture en base de données                                           │
│  • ET un événement (email, webhook, notification)                            │
│                                                                              │
│  On utilise l'OUTBOX PATTERN pour garantir l'atomicité :                     │
│                                                                              │
│  1. Écrire les données DANS LA MÊME TRANSACTION que l'outbox message        │
│  2. Un processeur asynchrone lit l'outbox et publie les messages             │
│  3. Si l'envoi échoue, le message reste dans l'outbox (retry possible)       │
│                                                                              │
│  Structure outbox :                                                           │
│  {                                                                           │
│    id: BIGSERIAL PRIMARY KEY,                                                │
│    aggregate_type: VARCHAR(50),     // 'subscription', 'payment'             │
│    aggregate_id: INT,               // ID de l'entité concernée              │
│    event_type: VARCHAR(50),         // 'created', 'updated', 'deleted'      │
│    payload: JSONB,                  // Données de l'événement                 │
│    idempotency_key: UUID,           // Empêche la double publication          │
│    status: 'pending' | 'sent' | 'failed',                                    │
│    retry_count: INT DEFAULT 0,                                               │
│    max_retries: INT DEFAULT 5,                                               │
│    next_retry_at: TIMESTAMPTZ,                                               │
│    created_at: TIMESTAMPTZ,                                                  │
│    sent_at: TIMESTAMPTZ                                                      │
│  }                                                                           │
│                                                                              │
│  Garanties :                                                                  │
│  • At-most-once delivery (au plus une fois)                                  │
│  • Exactly-once processing (traitement une seule fois) via idempotence       │
│  • Au moins 3 tentatives avant DLQ                                           │
│  • Backoff exponentiel : 1s, 5s, 30s, 5min, 30min                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Dead Letter Queue

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    DEAD LETTER QUEUE — SPÉCIFICATIONS                         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Structure DLQ :                                                              │
│  {                                                                           │
│    id: BIGSERIAL PRIMARY KEY,                                                │
│    original_outbox_id: BIGINT,      // Référence au message original         │
│    aggregate_type: VARCHAR(50),                                              │
│    aggregate_id: INT,                                                        │
│    event_type: VARCHAR(50),                                                  │
│    payload: JSONB,                                                           │
│    error_message: TEXT,              // Dernière erreur rencontrée            │
│    error_stack: TEXT,                // Stack trace complète                 │
│    failed_at: TIMESTAMPTZ,                                                    │
│    retry_count: INT,                                                         │
│    status: 'dead' | 'recovering' | 'resolved' | 'ignored',                   │
│    resolution_note: TEXT,            // Note de l'opérateur                  │
│    resolved_at: TIMESTAMPTZ                                                   │
│  }                                                                           │
│                                                                              │
│  Mécanisme de Rejeu :                                                         │
│  1. Super Admin déclenche un rejeu (via interface platform)                  │
│  2. DLQ status → 'recovering'                                                │
│  3. Message republié dans l'outbox avec nouvel ID                           │
│  4. Traitement normal avec idempotence                                       │
│  5. Succès → DLQ status → 'resolved'                                         │
│  6. Échec → DLQ status → 'dead' (incrémente retry_count)                     │
│                                                                              │
│  Monitoring :                                                                 │
│  • Alert si DLQ > 10 messages non résolus                                    │
│  • Alert si un message reste 'dead' > 24h                                    │
│  • Rapport quotidien des DLQ (cron)                                          │
│  • Interface Super Admin pour visualiser et rejouer                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Webhooks Stripe et Idempotence

### 9.1 Architecture Webhook Stripe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    WEBHOOK STRIPE — ARCHITECTURE                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Endpoint : POST /api/v2/webhooks/stripe                                     │
│                                                                              │
│  Flux :                                                                       │
│  1. Stripe envoie un événement HTTP POST                                     │
│  2. Vérification de la signature Stripe (stripe-signature header)            │
│  3. Vérification de l'idempotence (Idempotency-Key)                         │
│  4. Si déjà traité → retour 200 (pas de reprocessing)                       │
│  5. Si nouveau → traitement dans une transaction PostgreSQL                  │
│  6. Écriture dans l'outbox pour les notifications                            │
│  7. Retour 200 à Stripe                                                      │
│                                                                              │
│  Événements traités :                                                         │
│  • payment_intent.succeeded → Activer subscription                           │
│  • payment_intent.payment_failed → Marquer échec                             │
│  • invoice.payment_succeeded → Confirmer renouvellement                      │
│  • invoice.payment_failed → Subscription → past_due                          │
│  • customer.subscription.updated → Sync statut                               │
│  • customer.subscription.deleted → Cancel                                    │
│  • charge.dispute.created → Démarrer processus chargeback                    │
│  • charge.refunded → Créer avoir dans le ledger                              │
│                                                                              │
│  Idempotence :                                                                │
│  • Stripe envoie un header Idempotency-Key unique                            │
│  • Nous stockons {stripe_event_id, idempotency_key, status}                  │
│  • Avant tout traitement, on vérifie si cet événement a déjà été traité      │
│  • Si oui → 200 OK sans side-effect                                          │
│  • Si non → traitement atomique                                              │
│                                                                              │
│  Sécurité :                                                                   │
│  • Vérification de la signature Stripe (stripe-signature header)             │
│  • IP whitelist : 3.18.12.63, 3.130.192.231, ... (CIDR Stripe)             │
│  • Timeout du handler : ≤ 5 secondes                                         │
│  • Si timeout → Stripe retry (jusqu'à 3 fois)                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Gestion des Chargebacks

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    CHARGEBACK MANAGEMENT                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Quand Stripe envoie charge.dispute.created :                                │
│                                                                              │
│  1. Enregistrer le chargeback dans PostgreSQL (table chargebacks)            │
│  2. Suspendre l'abonnement concerné (status = 'disputed')                   │
│  3. Envoyer une notification au Super Admin                                  │
│  4. Geler les fonds dans le ledger comptable                                 │
│                                                                              │
│  Résolution :                                                                 │
│  • Super Admin reçoit la notification et les détails du chargeback           │
│  • Il peut :                                                                  │
│    - Accepter le chargeback (remboursement forcé, close dispute)             │
│    - Contester le chargeback (fournir des preuves à Stripe)                  │
│  • Si contesté, Stripe envoie charge.dispute.closed avec le résultat         │
│  • Si perdu : écriture de perte dans le ledger                               │
│  • Si gagné : réactivation de l'abonnement, restitution des fonds            │
│                                                                              │
│  Table chargebacks :                                                          │
│  {                                                                           │
│    id: SERIAL PRIMARY KEY,                                                   │
│    stripe_dispute_id: VARCHAR(50) UNIQUE,                                    │
│    stripe_charge_id: VARCHAR(50),                                            │
│    tenant_id: INT,                                                           │
│    subscription_id: INT,                                                     │
│    amount_cents: BIGINT,                                                     │
│    currency: CHAR(3),                                                        │
│    reason: VARCHAR(50),              // 'fraudulent', 'duplicate', etc.      │
│    status: 'open' | 'under_review' | 'won' | 'lost',                         │
│    evidence_due_by: TIMESTAMPTZ,                                             │
│    created_at: TIMESTAMPTZ,                                                  │
│    resolved_at: TIMESTAMPTZ                                                  │
│  }                                                                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Politiques de Reprise Après Crash

### 10.1 Scénarios de Crash

| Scénario | Détection | Reprise | RPO | RTO |
|----------|-----------|---------|-----|-----|
| Crash serveur pendant saga | Cron recovery scanne les sagas incomplètes | Reprendre ou compenser la saga | 0 (WAL) | 30s |
| Crash pendant webhook Stripe | Stripe retry + idempotence | Stripe renvoie l'événement | 0 | 5min |
| Crash pendant sync engine | DLQ + retry automatique | Rejouer depuis la DLQ | 0 (outbox) | 1min |
| Crash pendant paiement | PaymentInProgress expire | Cron nettoie les expired | 24h max | 1h |
| Crash base PostgreSQL | Monitoring + backup WAL | Restore PITR | 5min | 30min |
| Crash serveur Stripe (rare) | Stripe gère | Attendre reprise Stripe | N/A | N/A |

### 10.2 Recovery Saga Scanner

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    RECOVERY SAGA SCANNER — CRON                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Exécution : Toutes les 30 secondes                                           │
│                                                                              │
│  Logique :                                                                    │
│  1. SELECT * FROM saga_state WHERE status = 'in_progress'                     │
│     AND updated_at < NOW() - INTERVAL '5 minutes'                            │
│  2. Pour chaque saga trouvée :                                                │
│     a. Charger l'état actuel de la saga                                      │
│     b. Déterminer la dernière étape complétée                                │
│     c. Exécuter la compensation pour les étapes complétées                   │
│     d. Marquer la saga comme 'failed' ou retenter l'étape échouée            │
│  3. Logguer l'action dans saga_recovery_log                                   │
│                                                                              │
│  Règles :                                                                     │
│  • Maximum 3 tentatives par saga (après, marquée 'failed' irrécupérable)     │
│  • Les sagas 'failed' nécessitent une intervention manuelle du Super Admin   │
│  • Notification au Super Admin si une saga est marquée 'failed'              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 10.3 PaymentInProgress Expiration

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    PAYMENTINPROGRESS — EXPIRATION POLICY                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Cron : Toutes les heures                                                     │
│                                                                              │
│  1. SELECT * FROM payment_in_progress                                        │
│     WHERE status = 'pending'                                                 │
│     AND expires_at < NOW()                                                   │
│  2. Pour chaque payment trouvé :                                              │
│     a. Vérifier auprès de Stripe si le PaymentIntent a été complété          │
│        (cas où le webhook n'est pas arrivé)                                  │
│     b. Si Stripe dit 'completed' → forcer la complétion                      │
│     c. Si Stripe dit 'failed' → marquer comme 'failed'                       │
│     d. Si Stripe dit 'unknown' → marquer comme 'expired'                     │
│  3. Si expired → annuler la saga associée                                    │
│                                                                              │
│  Garantie :                                                                    │
│  • Aucun paiement n'est perdu (on vérifie Stripe)                            │
│  • Aucun paiement n'est dupliqué (idempotence)                               │
│  • Timeout max de résolution : 24h + 1h (cron)                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Conformité Comptable OHADA/IFRS

### 11.1 Plan Comptable (Extrait)

| Code | Compte | Type | OHADA |
|------|--------|------|-------|
| 411 | Clients | Actif | ✅ |
| 512 | Banque | Actif | ✅ |
| 701 | Ventes de produits | Produit | ✅ |
| 706 | Prestations de services | Produit | ✅ |
| 44571 | TVA collectée | Passif | ✅ |
| 44566 | TVA déductible | Actif | ✅ |
| 4191 | Clients - avances et acomptes | Passif | ✅ |
| 471 | Comptes d'attente | Passif | ✅ |
| 672 | Pertes sur créances irrécouvrables | Charge | ✅ |

### 11.2 Règles de Conformité

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    RÈGLES DE CONFORMITÉ OHADA/IFRS                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. PARTIE DOUBLE OBLIGATOIRE                                                 │
│     Toute transaction financière génère DEUX entrées dans le ledger          │
│     (un débit + un crédit).                                                  │
│     Vérification automatique : SUM(debits) = SUM(credits)                    │
│                                                                              │
│  2. IMMUTABILITÉ DU LEDGER                                                    │
│     Aucune écriture ne peut être modifiée ou supprimée.                      │
│     Les corrections se font par écriture compensatoire.                      │
│     Signature SHA-256 chaînée pour détecter toute altération.                │
│                                                                              │
│  3. SÉQUENTIALITÉ DES FACTURES                                                │
│     Les numéros de facture sont séquentiels et sans trou.                   │
│     Reset annuel au 1er janvier.                                             │
│     Tout trou doit être justifié (facture annulée = void avec mention).      │
│                                                                              │
│  4. HISTORISATION FISCALE                                                     │
│     Les taux de TVA sont versionnés.                                         │
│     Une facture référence le taux en vigueur à sa date d'émission.           │
│     Les changements de taux n'affectent pas les factures existantes.        │
│                                                                              │
│  5. PISTE D'AUDIT                                                             │
│     Toute opération financière est loggée avec :                             │
│     • Qui (user_id)                                                          │
│     • Quoi (action, type)                                                    │
│     • Quand (timestamp)                                                      │
│     • Pourquoi (raison, metadata)                                            │
│     • Effet avant/après (diff)                                               │
│                                                                              │
│  6. RÉTENTION LÉGALE                                                          │
│     Factures : 7 ans (OHADA)                                                 │
│     Ledger comptable : 10 ans (IFRS)                                         │
│     Données personnelles : durée de l'abonnement + 3 ans (RGPD)             │
│                                                                              │
│  7. ARRONDI                                                                   │
│     Méthode : HALF_UP                                                        │
│     Précision : 2 décimales                                                  │
│     Règle : Le total des lignes = le total arrondi                           │
│     OHADA article 12 : arrondi à l'avantage du client                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 11.3 Piste d'Audit

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    PISTE D'AUDIT — STRUCTURE                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Table audit_log :                                                            │
│  {                                                                           │
│    id: BIGSERIAL PRIMARY KEY,                                                │
│    tenant_id: INT,                                                           │
│    user_id: INT,                     // NULL si système                      │
│    action: VARCHAR(50),              // 'payment.created', 'sub.updated'     │
│    entity_type: VARCHAR(50),         // 'subscription', 'payment'            │
│    entity_id: INT,                                                           │
│    before_state: JSONB,              // État avant modification              │
│    after_state: JSONB,               // État après modification               │
│    metadata: JSONB,                  // Contexte (IP, user-agent, etc.)      │
│    idempotency_key: UUID,                                                    │
│    created_at: TIMESTAMPTZ                                                   │
│  }                                                                           │
│                                                                              │
│  Index : (tenant_id, entity_type, entity_id, created_at)                     │
│  Index : (action, created_at)                                                │
│  Index : (idempotency_key) UNIQUE                                            │
│                                                                              │
│  Rétention : 7 ans avant archivage                                           │
│  Archivage : Export JSON + compression + cold storage (S3 Glacier)          │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 12. Gestion des Devises

### 12.1 Devises Supportées

| Devise | Code | Décimales | Pays cibles |
|--------|------|-----------|-------------|
| Zambian Kwacha | ZMW | 2 | Zambie |
| US Dollar | USD | 2 | International |
| Euro | EUR | 2 | Europe |
| CFA Franc (XAF) | XAF | 0 | Cameroun, Gabon, etc. |
| CFA Franc (XOF) | XOF | 0 | Sénégal, Côte d'Ivoire, etc. |
| Kenyan Shilling | KES | 2 | Kenya |

### 12.2 Règles de Conversion

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    RÈGLES DE CONVERSION DE DEVISES                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Tous les prix internes sont en centimes de la devise locale             │
│     (price_cents = 336000 → 3,360.00 ZMW)                                   │
│                                                                              │
│  2. Les taux de change sont récupérés quotidiennement                        │
│     Source : API fixer.io ou équivalent                                      │
│     Stockage : table exchange_rates avec versionning                         │
│                                                                              │
│  3. Une facture est TOUJOURS dans la devise du plan                          │
│     Si le client change de devise :                                          │
│     a. Nouveau plan dans la nouvelle devise                                  │
│     b. Remboursement prorata dans l'ancienne devise                          │
│     c. Facture d'ajustement dans les deux devises                            │
│                                                                              │
│  4. Stripe gère la conversion automatique                                    │
│     Nous envoyons le montant dans la devise du plan                          │
│     Stripe convertit si nécessaire et nous renvoie le montant converti       │
│                                                                              │
│  5. Le ledger comptable enregistre en devise locale + équivalent ZMW         │
│     Pour les rapports consolidés (multi-pays), tout est converti en ZMW      │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 13. Diagrammes de Séquence

### 13.1 Paiement d'Abonnement

```
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │     │  Backend  │     │   Saga    │     │  Stripe   │     │   DB     │
│  (Web)   │     │  API      │     │ Orchestr. │     │           │     │  (PG)    │
└────┬─────┘     └────┬──────┘     └────┬──────┘     └────┬──────┘     └────┬──────┘
     │                │                  │                  │                │
     │ POST /subscribe│                  │                  │                │
     │ idempotency_key│                  │                  │                │
     │────────────────►│                  │                  │                │
     │                │  Begin Saga      │                  │                │
     │                │─────────────────►│                  │                │
     │                │                  │  Step 1: Validate│                │
     │                │                  │──────────────────────────────────►│
     │                │                  │◄──────────────────────────────────│
     │                │                  │  Step 2: Create PaymentIntent     │
     │                │                  │──────────────────►│                │
     │                │                  │◄─────────────────│                │
     │                │  client_secret   │                  │                │
     │◄───────────────│                  │                  │                │
     │                │                  │  Step 3: Save Pending             │
     │                │                  │──────────────────────────────────►│
     │                │                  │◄──────────────────────────────────│
     │                │                  │                  │                │
     │  Confirm card  │                  │                  │                │
     │────────────────►│                  │                  │                │
     │                │  Stripe confirm  │                  │                │
     │                │────────────────────────────────────►│                │
     │                │                  │                  │                │
     │                │                  │                  │ Webhook        │
     │                │                  │◄─────────────────│ payment_intent │
     │                │                  │                  │ .succeeded     │
     │                │                  │  Step 4: Confirm │                │
     │                │                  │──────────────────────────────────►│
     │                │                  │  Step 5: Activate                  │
     │                │                  │──────────────────────────────────►│
     │                │                  │  Step 6: Invoice                   │
     │                │                  │──────────────────────────────────►│
     │                │                  │                  │                │
     │  200 OK        │                  │                  │                │
     │◄───────────────│                  │                  │                │
     │                │                  │                  │                │
```

### 13.2 Webhook Stripe avec Idempotence

```
┌─────────┐     ┌──────────────┐     ┌──────────┐     ┌──────────┐
│  Stripe  │     │  Webhook     │     │   Saga    │     │   DB     │
│          │     │  Handler     │     │ Orchestr. │     │  (PG)    │
└────┬─────┘     └──────┬───────┘     └────┬──────┘     └────┬──────┘
     │                  │                  │                  │
     │ POST /webhook    │                  │                  │
     │ stripe-signature │                  │                  │
     │ Idempotency-Key  │                  │                  │
     │─────────────────►│                  │                  │
     │                  │  Verify signature                   │
     │                  │────────────────────────────────────►│
     │                  │◄────────────────────────────────────│
     │                  │  Check idempotence                  │
     │                  │────────────────────────────────────►│
     │                  │◄────────────────────────────────────│
     │                  │  [Si déjà traité]                   │
     │                  │  ────────────────►  200 OK          │
     │◄─────────────────│                                      │
     │                  │  [Si nouveau]                        │
     │                  │  BEGIN TRANSACTION                   │
     │                  │────────────────────────────────────►│
     │                  │  Process event                       │
     │                  │────────────────────────────────────►│
     │                  │  Write to outbox                     │
     │                  │────────────────────────────────────►│
     │                  │  COMMIT                              │
     │                  │────────────────────────────────────►│
     │ 200 OK           │                                      │
     │◄─────────────────│                                      │
     │                  │                                      │
```

### 13.3 Création d'Abonnement (Saga Complète)

```
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │     │  Backend  │     │   Saga    │     │  Stripe   │     │   PG     │     │  Outbox  │
│          │     │  API      │     │ Orchestr. │     │           │     │          │     │          │
└────┬─────┘     └────┬──────┘     └────┬──────┘     └────┬──────┘     └────┬──────┘     └────┬──────┘
     │                │                  │                  │                │                │
     │ Choisir plan   │                  │                  │                │                │
     │────────────────►│                  │                  │                │                │
     │                │  Saga: Start     │                  │                │                │
     │                │─────────────────►│                  │                │                │
     │                │                  │  T1: Valider     │                │                │
     │                │                  │  plan + tenant   │────────────────►│                │
     │                │                  │◄─────────────────│                │                │
     │                │                  │  T2: Créer       │                │                │
     │                │                  │  PaymentIntent   │───────────────►│                │
     │                │                  │◄─────────────────│                │                │
     │  client_secret │                  │                  │                │                │
     │◄───────────────│                  │                  │                │                │
     │                │                  │                  │                │                │
     │ Confirmer      │                  │                  │                │                │
     │ paiement       │                  │                  │                │                │
     │────────────────►                  │                  │                │                │
     │                │  API Stripe      │                  │                │                │
     │                │────────────────────────────────────►│                │                │
     │                │                  │                  │                │                │
     │                │  [Webhook reçu]  │                  │                │                │
     │                │◄────────────────────────────────────│                │                │
     │                │                  │  T3: Confirmer   │                │                │
     │                │                  │  paiement        │────────────────►│                │
     │                │                  │  T4: Créer       │                │                │
     │                │                  │  subscription    │────────────────►│                │
     │                │                  │  T5: Générer     │                │                │
     │                │                  │  facture         │────────────────►│                │
     │                │                  │  T6: Notification│─────────────────────────────────►│
     │  200 OK        │                  │                  │                │                │
     │◄───────────────│                  │                  │                │                │
```

### 13.4 Expiration et Grace Period

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Tenant   │     │   Cron    │     │   DB     │     │   Email   │     │  Stripe   │
│  (POS)    │     │  Engine   │     │  (PG)    │     │  Service  │     │           │
└────┬──────┘     └────┬──────┘     └────┬──────┘     └────┬──────┘     └────┬──────┘
     │                 │                  │                  │                │
     │                 │ [Daily 03:00]    │                  │                │
     │                 │ Scan expiring    │                  │                │
     │                 │─────────────────►│                  │                │
     │                 │◄─────────────────│                  │                │
     │                 │                  │                  │                │
     │                 │ [J-7] Send email │                  │                │
     │                 │────────────────────────────────────►│                │
     │                 │ [J-3] Send email │                  │                │
     │                 │────────────────────────────────────►│                │
     │                 │ [J-1] Send email │                  │                │
     │                 │────────────────────────────────────►│                │
     │                 │                  │                  │                │
     │                 │ [J+0] Expired    │                  │                │
     │                 │ Set status='grace'                  │                │
     │                 │─────────────────►│                  │                │
     │                 │ Send notification│                  │                │
     │                 │────────────────────────────────────►│                │
     │                 │                  │                  │                │
     │                 │ [J+7] Grace end  │                  │                │
     │                 │ Set status='expired'                │                │
     │                 │─────────────────►│                  │                │
     │                 │ Cancel Stripe sub                  │                │
     │                 │───────────────────────────────────────────────────►│
     │                 │ Send final email │                  │                │
     │                 │────────────────────────────────────►│                │
     │                 │                  │                  │                │
     │  App login      │                  │                  │                │
     │────────────────►│                  │                  │                │
     │◄──403 EXPIRED──│                  │                  │                │
     │                 │                  │                  │                │
```

---

## 14. Diagramme d'Architecture Détaillé

```
┌═══════════════════════════════════════════════════════════════════════════════════════════════┐
║                        EKALA BILLING V2.4 — ARCHITECTURE DETAIL                               ║
╚═══════════════════════════════════════════════════════════════════════════════════════════════╝

┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER                                                                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │  Tenant Dashboard│  │  Super Admin    │  │  Pricing Page   │  │  POS (Offline)  │          │
│  │  /billing        │  │  Platform       │  │  /pricing       │  │  (local)        │          │
│  └────────┬─────────┘  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘          │
│           │                     │                     │                   │                   │
├───────────┼─────────────────────┼─────────────────────┼───────────────────┼───────────────────┤
│  API GATEWAY                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────┐│
│  │  Express / Fastify Router                                                                 ││
│  │  ├── Subscription Guard (idempotence + cache)                                            ││
│  │  ├── Rate Limiting (100req/min per tenant)                                               ││
│  │  ├── Auth JWT + Tenant Scope                                                             ││
│  │  └── Request Validation (Zod)                                                            ││
│  └──────────────────────────────────────────────────────────────────────────────────────────┘│
│           │                     │                     │                   │                   │
├───────────┼─────────────────────┼─────────────────────┼───────────────────┼───────────────────┤
│  APPLICATION LAYER                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  ┌─────────────────┐ │
│  │  BILLING SERVICES                                                   │  │  CORE SERVICES   │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐      │  │  ┌──────────────┐│ │
│  │  │ Subscription│ │ Payment    │ │ Invoice    │ │ Voucher    │      │  │  │ Tenant       ││ │
│  │  │ Service    │ │ Service    │ │ Service    │ │ Service    │      │  │  │ Service      ││ │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘      │  │  └──────────────┘│ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐      │  │  ┌──────────────┐│ │
│  │  │ Tax        │ │ Currency   │ │ Accounting │ │ Reporting  │      │  │  │ Auth         ││ │
│  │  │ Service    │ │ Service    │ │ Ledger     │ │ Service    │      │  │  │ Service      ││ │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘      │  │  └──────────────┘│ │
│  └────────────────────────────────────────────────────────────────────┘  │  ┌──────────────┐│ │
│                                                                         │  │ Notification ││ │
│  ┌────────────────────────────────────────────────────────────────────┐  │  │ Service     ││ │
│  │  INFRASTRUCTURE SERVICES                                            │  │  └──────────────┘│ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐      │  └─────────────────┘ │
│  │  │ Saga       │ │ Outbox     │ │ DLQ        │ │ Webhook    │      │                     │
│  │  │ Orchestrator│ │ Processor  │ │ Processor  │ │ Handler   │      │                     │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘      │                     │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐      │                     │
│  │  │ Cron       │ │ Sync       │ │ Cache      │ │ Health     │      │                     │
│  │  │ Engine     │ │ Engine     │ │ Manager    │ │ Check      │      │                     │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘      │                     │
│  └────────────────────────────────────────────────────────────────────┘                      │
│                                                                                             │
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│  DATA LAYER                                                                                   │
│                                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  POSTGRESQL / SUPABASE                                                                  │   │
│  │  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐           │   │
│  │  │ Billing Schema  │ │ Accounting      │ │ Platform        │ │ Audit          │          │   │
│  │  │ subscriptions   │ │ Schema          │ │ Schema          │ │ Schema         │          │   │
│  │  │ payment_in_prog │ │ ledger_entries  │ │ tenants         │ │ audit_log      │          │   │
│  │  │ invoices        │ │ tax_rates       │ │ plans           │ │ saga_state     │          │   │
│  │  │ vouchers        │ │ exchange_rates  │ │ users           │ │ idempotency    │          │   │
│  │  │ chargebacks     │ │ fiscal_periods  │ │ sync_metadata   │ │ outbox         │          │   │
│  │  └────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘           │   │
│  └────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  SQLITE (1 base par tenant)                                                              │   │
│  │  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐           │   │
│  │  │ POS Schema      │ │ Inventory       │ │ Orders         │ │ Subscription   │          │   │
│  │  │ sales           │ │ Schema          │ │ Schema         │ │ Cache          │          │   │
│  │  │ sale_items      │ │ products        │ │ orders         │ │ tenant_subscri │          │   │
│  │  │ payments        │ │ categories      │ │ order_items    │ │ plans (ro)     │          │   │
│  │  │                 │ │ inventory_movts  │ │                │ │                │          │   │
│  │  └────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘           │   │
│  └────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                               │
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│  INTEGRATION LAYER                                                                            │
│                                                                                               │
│  ┌──────────────────────────┐    ┌──────────────────────────┐    ┌──────────────────────────┐│
│  │  Stripe                    │    │  Email (SendGrid)         │    │  SMS (Africa)            ││
│  │  • Payment Intents        │    │  • Notifications billing  │    │  • Alert paiement échoué ││
│  │  • Subscriptions          │    │  • Factures PDF           │    │  • Confirmation code     ││
│  │  • Webhooks               │    │  • Campagnes              │    │                          ││
│  │  • Disputes               │    │                          │    │                          ││
│  └──────────────────────────┘    └──────────────────────────┘    └──────────────────────────┘│
│  ┌──────────────────────────┐    ┌──────────────────────────┐                                │
│  │  Paystack (Africa)        │    │  Supabase Storage         │                                │
│  │  • Mobile Money           │    │  • Factures PDF           │                                │
│  │  • Orange Money / M-Pesa  │    │  • Reçus                  │                                │
│  │  • Webhooks               │    │  • Rapports               │                                │
│  └──────────────────────────┘    └──────────────────────────┘                                │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 15. Décisions ADR

### ADR-001 : PostgreSQL pour le Billing, SQLite pour le POS

**Contexte :** V2.3 utilisait SQLite comme source unique pour tout, y compris les abonnements et paiements.
**Décision :** PostgreSQL/Supabase devient la source de vérité pour tout ce qui est financier (abonnements, paiements, factures, ledger). SQLite reste la source locale pour le POS (ventes, stocks, commandes).
**Conséquence :** Le sync engine est modifié pour que le flux billing soit PostgreSQL → SQLite (unidirectionnel, cache).
**Statut :** Acceptée.

### ADR-002 : Idempotence Obligatoire sur Toutes les Opérations Financières

**Contexte :** Pas de clé d'idempotence en V2.3, risque de doublons.
**Décision :** Toute opération financière (paiement, refund, activation voucher) nécessite une clé d'idempotence (UUID v4 généré côté backend ou fourni par Stripe).
**Conséquence :** Table `idempotency` dans PostgreSQL avec clé unique. Vérification systématique avant traitement.
**Statut :** Acceptée.

### ADR-003 : Stripe Webhook = Source de Vérité des Paiements

**Contexte :** Le frontend appelait Stripe directement et informait le backend du résultat.
**Décision :** Seul le webhook Stripe peut modifier le statut d'un paiement. Le frontend initie le PaymentIntent mais le résultat vient exclusivement du webhook.
**Conséquence :** Plus de faille de sécurité. Le backend ne fait jamais confiance au frontend pour les confirmations de paiement.
**Statut :** Acceptée.

### ADR-004 : Saga avec Reprise Après Crash

**Contexte :** Pas de mécanisme de reprise des sagas en V2.3.
**Décision :** Toute saga est persistée dans `saga_state` PostgreSQL. Un cron recovery scanne toutes les 30s les sagas incomplètes et les reprend ou les compense.
**Conséquence :** Une saga peut survivre à un crash serveur. Garantie de consistance finale.
**Statut :** Acceptée.

### ADR-005 : Outbox Pattern pour les Notifications

**Contexte :** Les envois d'email et notifications étaient faits inline dans les handlers, créant des points de défaillance.
**Décision :** Toute notification est écrite dans l'outbox dans la même transaction que l'opération métier. Un processeur asynchrone lit l'outbox et envoie les notifications.
**Conséquence :** Atomicité garantie entre l'opération métier et la notification. Possibilité de retry sans perte.
**Statut :** Acceptée.

### ADR-006 : Ledger Comptable Append-Only

**Contexte :** Pas de ledger formel en V2.3.
**Décision :** Toute transaction financière est enregistrée dans un ledger append-only avec signature SHA-256 chaînée. Aucune modification ou suppression possible.
**Conséquence :** Conformité OHADA/IFRS garantie. Piste d'audit complète. Détection des altérations.
**Statut :** Acceptée.

### ADR-007 : Tax Rate Versioning

**Contexte :** Les taux fiscaux n'étaient pas historisés.
**Décision :** Table `tax_rates` avec `valid_from` et `valid_until`. Les factures référencent le taux en vigueur à leur date d'émission.
**Conséquence :** Les changements de TVA n'affectent pas les factures existantes. Conformité fiscale.
**Statut :** Acceptée.

### ADR-008 : Politique d'Arrondi HALF_UP

**Contexte :** Pas de politique d'arrondi définie.
**Décision :** Méthode HALF_UP (arrondi standard), 2 décimales, précision au centime. Conforme OHADA article 12.
**Conséquence :** Écarts comptables éliminés. Cohérence entre le frontend et le backend.
**Statut :** Acceptée.

### ADR-009 : DLQ avec Mécanisme de Rejeu

**Contexte :** Les messages en échec étaient perdus silencieusement.
**Décision :** Après 5 tentatives, un message est déplacé vers la DLQ. Le Super Admin peut rejouer manuellement les messages.
**Conséquence :** Aucun message perdu. Visibilité complète sur les échecs.
**Statut :** Acceptée.

### ADR-010 : PaymentInProgress avec Expiration

**Contexte :** Pas de suivi des paiements en cours.
**Décision :** Table `payment_in_progress` avec statut, clé d'idempotence, et date d'expiration (24h). Un cron nettoie les expired.
**Conséquence :** Visibilité sur les paiements en cours. Détection des paiements abandonnés. Possibilité de reprise.
**Statut :** Acceptée.

### ADR-011 : Fail-Open pour le POS

**Contexte :** Le POS doit fonctionner sans internet.
**Décision :** Le subscription guard utilise le cache SQLite en priorité. Si le cache est expiré et que PostgreSQL est injoignable, le cache est utilisé quand même.
**Conséquence :** Le POS peut fonctionner jusqu'à 5 minutes sans connexion (TTL du cache). Après 5 minutes, le comportement est dégradé mais pas bloquant.
**Statut :** Acceptée.

### ADR-012 : Chaînage SHA-256 du Ledger

**Contexte :** Nécessité de garantir l'intégrité du ledger comptable.
**Décision :** Chaque entrée du ledger contient un hash SHA-256 de (hash_précédent + données). En cas de modification, la chaîne est cassée.
**Conséquence :** Détection immédiate de toute altération du ledger. Conformité IFRS.
**Statut :** Acceptée.

---

## 16. Glossaire

| Terme | Définition |
|-------|------------|
| **Saga** | Transaction distribuée composée de plusieurs étapes avec compensations |
| **Outbox** | Pattern garantissant la livraison atomique de messages via la base de données |
| **DLQ** | Dead Letter Queue — file d'attente des messages en échec |
| **Idempotence** | Propriété garantissant qu'une opération peut être répétée sans effet de bord |
| **PaymentInProgress** | Entité temporaire représentant un paiement en cours de traitement |
| **Ledger** | Journal comptable append-only, source de vérité financière |
| **OHADA** | Organisation pour l'Harmonisation en Afrique du Droit des Affaires |
| **IFRS** | International Financial Reporting Standards |
| **RPO** | Recovery Point Objective — perte de données maximale acceptable |
| **RTO** | Recovery Time Objective — temps de reprise maximal acceptable |
| **PITR** | Point-In-Time Recovery — restauration à un instant précis |
| **HALF_UP** | Méthode d'arrondi standard (0.5 → 1, 0.4 → 0) |
| **TTC** | Toutes Taxes Comprises |
| **HT** | Hors Taxes |
| **Anti-Corruption Layer** | Couche qui empêche un système de contaminer un autre |
| **Sync Engine** | Moteur de synchronisation bidirectionnelle SQLite ↔ PostgreSQL |
| **Offline-First** | Stratégie où l'application fonctionne d'abord en local, puis sync |
| **Event Sourcing** | Pattern où l'état est dérivé d'un flux d'événements immuables |
| **Chargeback** | Contestation d'un paiement par le client auprès de sa banque |
| **Webhook** | Callback HTTP envoyé par un service externe (Stripe, Paystack) |
| **Tenant** | Client isolé (restaurant, établissement) dans une architecture multi-tenant |

---

## Annexes

### A. Checklist de Migration V2.3 → V2.4

- [ ] Créer les nouvelles tables PostgreSQL (subscriptions_v2, payment_in_progress, invoices, ledger, outbox, dlq, idempotency, saga_state, audit_log)
- [ ] Migrer les abonnements existants de SQLite → PostgreSQL
- [ ] Mettre en place le Webhook Handler avec vérification de signature Stripe
- [ ] Implémenter l'Idempotence Service
- [ ] Implémenter le Saga Orchestrator avec reprise après crash
- [ ] Implémenter l'Outbox Processor
- [ ] Implémenter la DLQ avec interface de rejeu
- [ ] Implémenter le Accounting Ledger avec chaînage SHA-256
- [ ] Implémenter le Tax Service avec versioning
- [ ] Implémenter le Currency Service
- [ ] Modifier le Sync Engine pour le flux unidirectionnel billing
- [ ] Modifier le Subscription Guard pour le cache SQLite
- [ ] Ajouter le monitoring des crons et de la DLQ
- [ ] Tester la reprise après crash (simulation)
- [ ] Tester l'idempotence (double soumission)
- [ ] Tester les webhooks Stripe (simulation)
- [ ] Documentation + runbook

### B. Dépendances Techniques

| Bibliothèque | Version | Usage |
|-------------|---------|-------|
| better-sqlite3 | ^11.x | SQLite local |
| @supabase/supabase-js | ^2.x | Client Supabase |
| stripe | ^16.x | Client Stripe |
| node-cron | ^3.x | Cron engine |
| uuid | ^9.x | Génération clés idempotence |
| zod | ^3.x | Validation |
| pino | ^8.x | Logging structuré |
| amqplib | ^0.10.x | Message queue (optionnel) |

### C. Métriques Cibles

| Métrique | Cible | Mesure |
|----------|-------|--------|
| Temps de traitement paiement | < 5s | APM |
| Latence sync engine | < 30s | Logs |
| RPO crash serveur | 0 (WAL) | Test |
| RTO crash serveur | < 30s | Test |
| Taux succès paiement | > 95% | Stripe dashboard |
| Taux échec webhook | < 0.1% | Monitoring |
| DLQ non résolues | < 10 | Alert |
| Couverture tests | > 90% | Jest |
| Temps génération facture | < 30s | Benchmark |

---

**Fin du document — Architecture V2.4 Approuvée**