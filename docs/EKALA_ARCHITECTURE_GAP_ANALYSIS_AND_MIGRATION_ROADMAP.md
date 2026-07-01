# 🏛️ Great Olive — Architecture Gap Analysis & Migration Roadmap

**Document :** Analyse comparative Architecture Actuelle → Cible V2.1 + Feuille de route  
**Auteur :** Principal Software Architect  
**Version :** 1.0  
**Date :** 27/06/2026  
**Périmètre :** Migration complète vers Architecture V2.1  
**Statut :** ROADMAP OFFICIELLE DE DÉVELOPPEMENT  

---

## TABLE DES MATIÈRES

1. [MÉTHODOLOGIE D'ANALYSE](#1-méthodologie-danalyse)
2. [GAP ANALYSIS — BOUNDED CONTEXTS](#2-gap-analysis--bounded-contexts)
3. [GAP ANALYSIS — COUCHE SYNCHRONISATION](#3-gap-analysis--couche-synchronisation)
4. [GAP ANALYSIS — COUCHE AUTH & CACHE](#4-gap-analysis--couche-auth--cache)
5. [GAP ANALYSIS — COUCHE PRÉSENTATION](#5-gap-analysis--couche-présentation)
6. [MATRICE DE RISQUES GLOBALE](#6-matrice-de-risques-globale)
7. [FEUILLE DE ROUTE DE MIGRATION — SPINTS](#7-feuille-de-route-de-migration--sprints)
8. [CRITÈRES DE SUCCÈS PAR SPRINT](#8-critères-de-succès-par-sprint)
9. [PLAN DE ROLLBACK](#9-plan-de-rollback)

---

## 1. MÉTHODOLOGIE D'ANALYSE

### 1.1 Grille d'Évaluation

| Critère | Description |
|---------|-------------|
| **Existence** | Oui / Partiellement / Non |
| **Conformité** | 0-100% (pourcentage de l'architecture cible implémenté) |
| **Réutilisable** | Code existant qui peut être conservé tel quel |
| **À refactoriser** | Code existant qui doit être modifié pour respecter l'architecture |
| **À supprimer** | Code existant qui devient inutile ou est remplacé |
| **À créer** | Nouveau code à implémenter |
| **Impact** | Faible / Moyen / Élevé / Critique |
| **Risque** | P0 (critique) → P3 (faible) |
| **Effort** | S (1-2j) / M (3-5j) / L (1-2sem) / XL (3-4sem) |

### 1.2 Légende

- 🟢 **Oui** — Composant existant et conforme
- 🟡 **Partiellement** — Composant existant mais incomplet ou non conforme
- 🔴 **Non** — Composant absent

---

## 2. GAP ANALYSIS — BOUNDED CONTEXTS

### 2.1 SUBSCRIPTION Context

| Composant Cible | Existence | Conformité | Réutilisable | À refactoriser | À supprimer | À créer | Impact | Risque | Effort |
|-----------------|-----------|------------|--------------|----------------|-------------|---------|--------|--------|--------|
| `VoucherRequest` Aggregate | 🟡 Partiel | 40% | Table `subscription_payment_requests` | Ajouter `entity_version`, `origin_node`, `logical_clock` | — | `VoucherRequest` class (DDD) | Élevé | P1 | M |
| `Subscription` Aggregate | 🟡 Partiel | 50% | Table `subscriptions` | Ajouter versioning, extraire logique métier | `activateTenantSub` inline | `Subscription` class + invariants | Élevé | P1 | L |
| `Plan` Aggregate | 🟢 Oui | 70% | Table `plans` | Ajouter versioning | — | `Plan` class | Faible | P3 | S |
| `VoucherApplicationService` | 🔴 Non | 0% | — | — | Logique dans routes | Service complet | Élevé | P1 | L |
| `SubscriptionActivationService` | 🔴 Non | 0% | — | — | Logique dans `activateTenantSub` | Service avec invariants | Critique | P0 | L |
| `SubscriptionRepository` | 🟡 Partiel | 30% | Accès SQLite directs | Créer interface Repository | Duplication SQLite/Supabase | Interface + 2 implémentations | Élevé | P1 | M |
| Domain Events (8 events) | 🟡 Partiel | 20% | EventBus existant | Connecter aux mutations | — | Événements manquants | Moyen | P2 | M |
| Cache invalidation | 🔴 Non | 0% | `invalidateSubscriptionCache` existe mais jamais appelé | — | — | Contrat d'invalidation complet | Critique | P0 | S |

**Résumé SUBSCRIPTION :**
- **Points forts :** Tables existent, EventBus existe, logique métier fonctionne
- **Points faibles :** Pas de séparation DDD, pas d'invalidation de cache, pas de versioning, logique dans les routes
- **Priorité :** P0 (bloque les utilisateurs aujourd'hui)

### 2.2 TENANT Context

| Composant Cible | Existence | Conformité | Réutilisable | À refactoriser | À supprimer | À créer | Impact | Risque | Effort |
|-----------------|-----------|------------|--------------|----------------|-------------|---------|--------|--------|--------|
| `Tenant` Aggregate | 🟢 Oui | 60% | Table `tenants` | Ajouter `entity_version`, `origin_node` | — | `Tenant` class + invariants | Moyen | P2 | M |
| `TenantApplicationService` | 🔴 Non | 0% | — | — | Logique dans `platform.routes.ts` | Service complet | Élevé | P1 | L |
| `TenantRepository` | 🟡 Partiel | 40% | Accès SQLite directs | Créer interface | Duplication | Interface + 2 implémentations | Moyen | P2 | M |
| Provisioning pipeline | 🟡 Partiel | 30% | `createTenant` dans routes | Extraire en service | — | Pipeline complet avec events | Moyen | P2 | L |

**Résumé TENANT :**
- **Points forts :** Table existe, CRUD fonctionne
- **Points faibles :** Pas de service dédié, pas de versioning, pas d'events
- **Priorité :** P1 (bloque l'activation)

### 2.3 ORDER Context

| Composant Cible | Existence | Conformité | Réutilisable | À refactoriser | À supprimer | À créer | Impact | Risque | Effort |
|-----------------|-----------|------------|--------------|----------------|-------------|---------|--------|--------|--------|
| `Order` Aggregate | 🟡 Partiel | 50% | Tables `orders`, `order_items` | Ajouter `entity_version`, invariants | — | `Order` class + validation | Élevé | P1 | L |
| `OrderItem` | 🟡 Partiel | 50% | Table `order_items` | Ajouter versioning | — | `OrderItem` class | Moyen | P2 | M |
| `OrderApplicationService` | 🔴 Non | 0% | — | — | Logique dispersée | Service complet | Élevé | P1 | XL |
| `StockReservationService` | 🔴 Non | 0% | — | — | Logique dans Order | Domain Service | Élevé | P1 | M |
| `OrderRepository` | 🟡 Partiel | 30% | Accès directs | Créer interface | Duplication | Interface + 2 implémentations | Moyen | P2 | M |

**Résumé ORDER :**
- **Points forts :** Tables existent, POS fonctionne
- **Points faibles :** Pas de DDD, pas de réservation de stock, pas de service
- **Priorité :** P1 (cœur métier POS)

### 2.4 PRODUCT Context

| Composant Cible | Existence | Conformité | Réutilisable | À refactoriser | À supprimer | À créer | Impact | Risque | Effort |
|-----------------|-----------|------------|--------------|----------------|-------------|---------|--------|--------|--------|
| `Product` Aggregate | 🟢 Oui | 60% | Tables `products`, `categories` | Ajouter versioning | — | `Product` class | Moyen | P2 | M |
| `Category` | 🟢 Oui | 60% | Table `categories` | Ajouter versioning | — | `Category` class | Faible | P3 | S |
| `ProductRepository` | 🟡 Partiel | 40% | Accès directs | Créer interface | — | Interface + 2 implémentations | Moyen | P2 | M |

**Résumé PRODUCT :**
- **Points forts :** Tables existent, sync fonctionne
- **Points faibles :** Pas de DDD, pas de menu public optimisé
- **Priorité :** P2 (amélioration)

### 2.5 INVENTORY Context

| Composant Cible | Existence | Conformité | Réutilisable | À refactoriser | À supprimer | À créer | Impact | Risque | Effort |
|-----------------|-----------|------------|--------------|----------------|-------------|---------|--------|--------|--------|
| `InventoryMovement` | 🟢 Oui | 70% | Table `inventory_movements` | Ajouter versioning | — | `InventoryMovement` class | Moyen | P2 | M |
| `StockReservationService` | 🔴 Non | 0% | — | — | — | Domain Service | Élevé | P1 | M |

**Résumé INVENTORY :**
- **Points forts :** Table existe, mouvements trackés
- **Points faibles :** Pas de réservation atomique
- **Priorité :** P1 (bloque les commandes)

### 2.6 USER & AUTH Context

| Composant Cible | Existence | Conformité | Réutilisable | À refactoriser | À supprimer | À créer | Impact | Risque | Effort |
|-----------------|-----------|------------|--------------|----------------|-------------|---------|--------|--------|--------|
| `User` Aggregate | 🟢 Oui | 70% | Table `users` | Retirer `status` du JWT | `status` dans JWT | `User` class | Critique | P0 | L |
| `UserRepository` | 🟡 Partiel | 40% | Accès directs | Créer interface | — | Interface + 2 implémentations | Moyen | P2 | M |
| JWT sans business state | 🔴 Non | 0% | — | — | `user.status` dans JWT | JWT avec `sub`, `tenant_id`, `role` seulement | Critique | P0 | L |
| `GET /auth/me` lit depuis DB | 🔴 Non | 0% | — | — | Lit depuis JWT | Endpoint lit depuis cache/DB | Critique | P0 | M |

**Résumé USER/AUTH :**
- **Points forts :** Auth fonctionne, JWT existe
- **Points faibles :** JWT contient business state (obsolète après activation)
- **Priorité :** P0 (bloque l'activation)

### 2.7 IAM / RBAC Context

| Composant Cible | Existence | Conformité | Réutilisable | À refactoriser | À supprimer | À créer | Impact | Risque | Effort |
|-----------------|-----------|------------|--------------|----------------|-------------|---------|--------|--------|--------|
| `Role`, `Permission` | 🟢 Oui | 80% | Tables existent, RBAC fonctionne | Ajouter versioning | — | Aggregates IAM | Faible | P3 | M |
| `RBACCache` | 🟡 Partiel | 60% | `rbac-cache.service.ts` | Connecter à EventBus | — | Invalidation par événement | Moyen | P2 | S |

**Résumé IAM :**
- **Points forts :** RBAC mature, cache existe
- **Points faibles :** Cache non invalidé par événements
- **Priorité :** P2 (amélioration)

### 2.8 PLATFORM Context

| Composant Cible | Existence | Conformité | Réutilisable | À refactoriser | À supprimer | À créer | Impact | Risque | Effort |
|-----------------|-----------|------------|--------------|----------------|-------------|---------|--------|--------|--------|
| `PlatformAuditLog` | 🟢 Oui | 70% | `platform_audit_logs` | Enrichir avec correlationId | — | Aggregate complet | Moyen | P2 | M |
| Admin dashboards | 🟡 Partiel | 50% | Pages existent | Refactoriser en thin controllers | Logique dans routes | Services dédiés | Moyen | P2 | L |

**Résumé PLATFORM :**
- **Points forts :** Audit logs existent
- **Points faibles :** Pas de structured logging
- **Priorité :** P2 (amélioration)

---

## 3. GAP ANALYSIS — COUCHE SYNCHRONISATION

### 3.1 Replication Engine (V2.1)

| Composant Cible | Existence | Conformité | Réutilisable | À refactoriser | À supprimer | À créer | Impact | Risque | Effort |
|-----------------|-----------|------------|--------------|----------------|-------------|---------|--------|--------|--------|
| **PushReplicator** | 🟡 Partiel | 60% | `GenericSyncService.push()` | Enrichir avec idempotence, versioning | — | `PushReplicator` dédié | Critique | P1 | L |
| **PullReplicator** | 🟡 Partiel | 60% | `GenericSyncService.pull()` | Enrichir avec curseur, conflict resolver | — | `PullReplicator` dédié | Critique | P1 | L |
| **RealtimeSubscriber** | 🟢 Oui | 70% | `SupabaseRealtimeSyncService` | Ajouter origin_node check | — | Intégration avec cache invalidation | Élevé | P1 | M |
| **ConflictResolver** | 🟡 Partiel | 50% | `ConflictResolver` existe | Enrichir stratégies (8 stratégies cible) | — | Matrice par domaine | Élevé | P1 | M |
| **DeadLetterQueue** | 🟡 Partiel | 40% | `DeadLetterQueue` existe | Ajouter `error_category`, `retry_history` | — | Interface admin DLQ | Élevé | P1 | M |
| **SyncPersistedCursor** | 🟢 Oui | 80% | Existe, fonctionne | Remplacer par `replication_seq` (ADR-105) | — | Migration cursor | Moyen | P2 | M |
| **OutboxMessage** | 🟡 Partiel | 50% | Table `sync_outbox` existe | Ajouter `entity_version`, `origin_node`, `logical_clock` | — | Migration schéma | Critique | P0 | M |
| **ReplicationTracker** | 🔴 Non | 0% | — | — | — | Table + service | Moyen | P2 | S |
| **ReplicationIdempotency** | 🔴 Non | 0% | — | — | — | Table Supabase + logique | Élevé | P1 | M |
| **LamportClock** | 🔴 Non | 0% | — | — | — | Service + persistence | Moyen | P2 | S |
| **OriginNode** | 🔴 Non | 0% | — | — | — | Génération + persistence dans settings | Moyen | P2 | S |
| **Observabilité réplication** | 🔴 Non | 0% | — | — | — | 20 métriques + logs + alertes | Élevé | P1 | L |

**Résumé SYNCHRONISATION :**
- **Points forts :** Base solide (outbox, DLQ, conflict resolver, cursor)
- **Points faibles :** Pas de versioning, pas d'idempotence, pas d'observabilité
- **Priorité :** P0 (outbox) → P1 (replicators, idempotence) → P2 (observabilité)

### 3.2 Gap Analysis par Couche

| Couche | Composant | Existence | Conformité | Actions prioritaires |
|--------|-----------|-----------|------------|---------------------|
| **Transaction** | `withOutboxTransaction` | 🟢 Oui | 80% | Ajouter versioning dans outbox |
| **Outbox** | `sync_outbox` table | 🟢 Oui | 60% | Ajouter colonnes V2.1 |
| **DLQ** | `sync_dlq` table | 🟢 Oui | 40% | Ajouter `error_category` |
| **Cursor** | `SyncPersistedCursor` | 🟢 Oui | 70% | Migrer vers `replication_seq` |
| **Conflict** | `ConflictResolver` | 🟢 Oui | 50% | Enrichir stratégies |
| **Orchestrator** | `SyncOrchestratorV2` | 🟢 Oui | 60% | Refactoriser en 3 replicators séparés |

---

## 4. GAP ANALYSIS — COUCHE AUTH & CACHE

### 4.1 JWT & Authentification

| Composant Cible | Existence | Conformité | Réutilisable | À refactoriser | À supprimer | À créer | Impact | Risque | Effort |
|-----------------|-----------|------------|--------------|----------------|-------------|---------|--------|--------|--------|
| JWT sans business state | 🔴 Non | 0% | — | — | `user.status`, `user.expires_at` dans JWT | JWT minimal (`sub`, `tenant_id`, `role`) | Critique | P0 | L |
| `GET /auth/me` lit DB | 🔴 Non | 0% | — | — | Lit depuis JWT | Endpoint lit depuis cache subscription | Critique | P0 | M |
| Cache invalidation | 🔴 Non | 0% | `invalidateSubscriptionCache` existe | — | — | Contrat + EventBus connection | Critique | P0 | S |
| `SubscriptionStatusCache` | 🟡 Partiel | 30% | Cache in-memory | Remplacer par Redis (futur) | — | Invalidation par événement | Élevé | P1 | M |

**Résumé AUTH & CACHE :**
- **Points forts :** JWT fonctionne, cache existe
- **Points faibles :** JWT contient state obsolète, cache jamais invalidé
- **Priorité :** P0 (bloque l'activation)

---

## 5. GAP ANALYSIS — COUCHE PRÉSENTATION

### 5.1 Routes Express

| Composant Cible | Existence | Conformité | Réutilisable | À refactoriser | À supprimer | À créer | Impact | Risque | Effort |
|-----------------|-----------|------------|--------------|----------------|-------------|---------|--------|--------|--------|
| Thin controllers | 🔴 Non | 0% | — | — | Logique métier dans routes | Routes passe-plat | Élevé | P1 | XL |
| `IdempotencyMiddleware` | 🔴 Non | 0% | — | — | — | Middleware global | Élevé | P0 | M |
| `requireActiveSubscription` | 🟡 Partiel | 60% | Middleware existe | Utiliser shared `db`, invalider cache | — | Connexion DB partagée | Critique | P0 | S |

### 5.2 Frontend

| Composant Cible | Existence | Conformité | Réutilisable | À refactoriser | À supprimer | À créer | Impact | Risque | Effort |
|-----------------|-----------|------------|--------------|----------------|-------------|---------|--------|--------|--------|
| `SubscriptionStatus.tsx` | 🟡 Partiel | 40% | Composant existe | Lire depuis `/auth/me` au lieu de JWT | Dérive depuis `user.status` | Hook `useSubscriptionStatus` | Élevé | P1 | M |
| `useAuthStore` | 🟡 Partiel | 50% | Store existe | Retirer `status` du type User | `status` dans le store | Refresh automatique | Élevé | P1 | M |
| Toast notifications | 🟢 Oui | 90% | `useToast` existe | — | `alert()` dans AdminVouchersPage | — | Faible | P3 | S |

---

## 6. MATRICE DE RISQUES GLOBALE

### 6.1 Risques par Composant

| Composant | Risque | Impact | Mitigation |
|-----------|--------|--------|------------|
| **Outbox versioning** | P0 | Critique | Migration schéma avec backward compatibilité |
| **JWT sans status** | P0 | Critique | Feature flag + rollout progressif |
| **Cache invalidation** | P0 | Critique | Tests intensifs avant déploiement |
| **Idempotence** | P0 | Critique | Table dédiée + tests de retry |
| **Thin controllers** | P1 | Élevé | Refactor incrémental, sprint par sprint |
| **ConflictResolver** | P1 | Élevé | Tests avec scénarios de conflits réels |
| **PullReplicator** | P1 | Élevé | Backup avant migration cursor |
| **RealtimeSubscriber** | P1 | Élevé | Fallback sur pull si realtime échoue |
| **LamportClock** | P2 | Moyen | Tests de convergence multi-nœuds |
| **OriginNode** | P2 | Moyen | Génération UUID au premier démarrage |

### 6.2 Risques par Sprint

| Sprint | Risque principal | Mitigation |
|--------|------------------|------------|
| S0 | Regression sur l'activation | Tests E2E complets, rollback plan |
| S1 | Cache invalidation incomplète | Monitoring intensif, alertes |
| S2 | JWT incompatible avec anciens tokens | Double lecture (JWT + DB) pendant transition |
| S3 | Outbox schema migration | Script de migration + backup |
| S4 | ConflictResolver non testé | Scénarios de test automatisés |
| S5 | Regression sync | Comparaison avant/après, delta check |
| S6 | Performance (cache Redis) | Load testing, rollback vers in-memory |
| S7 | Observabilité incomplète | Logs structurés + alertes manuelles |

---

## 7. FEUILLE DE ROUTE DE MIGRATION — SPRINTS

### Philosophie

- **Sprint 0** : Stabilisation (P0 seulement)
- **Sprints 1-3** : Foundations (cache, JWT, outbox)
- **Sprints 4-6** : Domain Services (extraction de la logique métier)
- **Sprints 7-9** : Replication Engine (enrichissement)
- **Sprints 10-12** : Observabilité & Scale

### Sprint 0 — "Stabilization" (Semaine 1)

**Objectif :** Corriger les P0 sans changer l'architecture

| # | Tâche | Composant | Existant | Conformité | Réutilisable | À refactoriser | À supprimer | À créer | Impact | Risque | Effort |
|---|-------|-----------|----------|------------|--------------|----------------|-------------|---------|--------|--------|--------|
| 0.1 | Ajouter `invalidateSubscriptionCache()` après chaque mutation | Cache | Partiel | 30% → 80% | `invalidateSubscriptionCache` existe | Appeler dans toutes les routes | — | Contrat d'invalidation | Critique | P0 | S |
| 0.2 | Unifier connexions SQLite (middleware utilise singleton `db`) | Middleware | Partiel | 60% → 100% | `db` singleton | `subscription-guard.ts` | Connexion locale | Utiliser `db` partagé | Critique | P0 | S |
| 0.3 | Remplacer `getSubscriptionStatus()` non awaité par `invalidateSubscriptionCache()` | Route | Partiel | 40% → 80% | `activateTenantSub` | Ligne 78 de `admin.subscriptions.ts` | — | — | Critique | P0 | S |
| 0.4 | Ajouter idempotence sur routes POST verify/reject | Middleware | Non | 0% → 60% | — | — | — | `IdempotencyMiddleware` + table | Élevé | P0 | M |

**Livrable :** Bug "SUBSCRIPTION_REQUIRED après activation" corrigé. Cache invalidé. Idempotence ajoutée.

**Tests :** Test manuel activation voucher → tenant voit "active" immédiatement.

**Rollback :** Feature flag `ENABLE_CACHE_INVALIDATION` (défaut: false).

---

### Sprint 1 — "Cache & JWT Foundations" (Semaines 2-3)

**Objectif :** Retirer le business state du JWT, établir le cache comme source de vérité pour les lectures

| # | Tâche | Composant | Existant | Conformité | Actions | Impact | Risque | Effort |
|---|-------|-----------|----------|------------|---------|--------|--------|--------|
| 1.1 | Créer `SubscriptionStatusReadModel` | Read Model | Non | 0% → 100% | Nouveau fichier | Élevé | P1 | M |
| 1.2 | Modifier `GET /auth/me` pour lire status depuis cache/DB | Auth | Partiel | 50% → 90% | Modifier `auth.service.ts` | Critique | P1 | M |
| 1.3 | Retirer `status` et `expires_at` du JWT (feature flag) | JWT | Partiel | 30% → 80% | Modifier `jwt-auth.ts` | Critique | P1 | L |
| 1.4 | Modifier `SubscriptionStatus.tsx` pour utiliser `/auth/me` | Frontend | Partiel | 40% → 80% | Modifier composant | Élevé | P1 | M |
| 1.5 | Ajouter `useSubscriptionStatus` hook (polling 30s) | Frontend | Non | 0% → 100% | Nouveau hook | Moyen | P2 | M |
| 1.6 | Tests d'intégration : activation → JWT refresh → UI update | E2E | Non | 0% → 100% | Nouveaux tests | Critique | P1 | L |

**Livrable :** JWT ne contient plus de business state. Le statut est toujours frais.

**Tests :** Test E2E complet : admin valide voucher → tenant se reconnecte → voit "active".

**Rollback :** Feature flag `USE_JWT_STATUS` (défaut: true pour backward compat).

---

### Sprint 2 — "Outbox Enrichment" (Semaines 4-5)

**Objectif :** Ajouter le versioning dans l'outbox et les tables répliquées

| # | Tâche | Composant | Existant | Conformité | Actions | Impact | Risque | Effort |
|---|-------|-----------|----------|------------|---------|--------|--------|--------|
| 2.1 | Migration schéma : ajouter `entity_version`, `origin_node`, `logical_clock` à `sync_outbox` | Outbox | Partiel | 50% → 100% | Migration SQL | Critique | P0 | M |
| 2.2 | Migration schéma : ajouter colonnes versioning à toutes les tables répliquées | Tables | Partiel | 40% → 80% | Migration SQL + defaults | Élevé | P1 | L |
| 2.3 | Créer `LamportClock` service | Versioning | Non | 0% → 100% | Nouveau service | Moyen | P2 | S |
| 2.4 | Créer `OriginNode` service (génération + persistence) | Versioning | Non | 0% → 100% | Nouveau service | Moyen | P2 | S |
| 2.5 | Modifier `withOutboxTransaction` pour inclure versioning | Transaction | Partiel | 70% → 100% | Modifier fonction | Élevé | P1 | M |
| 2.6 | Backfill des entités existantes (entity_version = 1, origin_node = 'legacy') | Migration | Non | 0% → 100% | Script de migration | Élevé | P1 | M |

**Livrable :** Toutes les entités ont un versionnage déterministe.

**Tests :** Vérifier que toutes les tables ont les nouvelles colonnes. Test de backfill.

**Rollback :** Script de rollback SQL (supprimer colonnes).

---

### Sprint 3 — "Domain Services Extraction" (Semaines 6-8)

**Objectif :** Extraire la logique métier des routes vers des services

| # | Tâche | Composant | Existant | Conformité | Actions | Impact | Risque | Effort |
|---|-------|-----------|----------|------------|---------|--------|--------|--------|
| 3.1 | Créer `SubscriptionActivationService` (avec invariants) | Service | Non | 0% → 100% | Nouveau service | Critique | P1 | L |
| 3.2 | Créer `VoucherValidationService` | Service | Non | 0% → 100% | Nouveau service | Élevé | P1 | M |
| 3.3 | Créer `TenantApplicationService` | Service | Non | 0% → 100% | Nouveau service | Élevé | P1 | L |
| 3.4 | Créer interfaces Repository (ports) pour SUBSCRIPTION, TENANT | Repository | Non | 0% → 100% | Nouvelles interfaces | Moyen | P2 | M |
| 3.5 | Implémenter `SqliteSubscriptionRepository`, `SqliteTenantRepository` | Repository | Partiel | 30% → 80% | Refactoriser accès DB | Moyen | P2 | M |
| 3.6 | Refactoriser `admin.subscriptions.ts` en thin controller | Route | Partiel | 40% → 90% | Modifier routes | Élevé | P1 | L |
| 3.7 | Refactoriser `platform.routes.ts` (tenants CRUD) | Route | Partiel | 40% → 90% | Modifier routes | Élevé | P1 | L |
| 3.8 | Tests unitaires des services (Jest) | Tests | Non | 0% → 100% | Nouveaux tests | Moyen | P2 | L |

**Livrable :** Routes sont des thin controllers. Logique métier dans des services testables.

**Tests :** Tests unitaires de `SubscriptionActivationService` (activation, rejection, invariants).

**Rollback :** Garder les anciennes routes en parallèle (feature flag).

---

### Sprint 4 — "Replication Engine v2.1" (Semaines 9-11)

**Objectif :** Implémenter le Replication Engine complet (Push, Pull, Realtime, Conflicts, DLQ)

| # | Tâche | Composant | Existant | Conformité | Actions | Impact | Risque | Effort |
|---|-------|-----------|----------|------------|---------|--------|--------|--------|
| 4.1 | Créer `PushReplicator` (avec idempotence) | Push | Partiel | 60% → 100% | Extraire de `GenericSyncService` | Critique | P1 | L |
| 4.2 | Créer `PullReplicator` (avec curseur, conflict resolver) | Pull | Partiel | 60% → 100% | Extraire de `GenericSyncService` | Critique | P1 | L |
| 4.3 | Enrichir `ConflictResolver` avec 8 stratégies | Conflict | Partiel | 50% → 100% | Ajouter stratégies | Élevé | P1 | M |
| 4.4 | Ajouter `error_category` à `sync_dlq` | DLQ | Partiel | 40% → 80% | Migration table | Moyen | P2 | S |
| 4.5 | Créer `ReplicationTracker` table + service | Tracker | Non | 0% → 100% | Nouveau | Moyen | P2 | S |
| 4.6 | Créer `ReplicationIdempotency` table (Supabase) | Idempotence | Non | 0% → 100% | Nouvelle table | Élevé | P1 | M |
| 4.7 | Intégrer `RealtimeSubscriber` avec cache invalidation | Realtime | Partiel | 70% → 100% | Modifier service | Élevé | P1 | M |
| 4.8 | Tests d'intégration : push → Supabase → pull → SQLite | E2E | Non | 0% → 100% | Nouveaux tests | Critique | P1 | L |

**Livrable :** Replication Engine V2.1 complet et testé.

**Tests :** Test multi-nœuds (2 POS + 1 admin) avec conflits simulés.

**Rollback :** Feature flag `USE_V2_REPLICATION` (défaut: false, utiliser ancien `SyncOrchestratorV2`).

---

### Sprint 5 — "Event-Driven Architecture" (Semaines 12-13)

**Objectif :** Connecter l'EventBus aux mutations et aux caches

| # | Tâche | Composant | Existant | Conformité | Actions | Impact | Risque | Effort |
|---|-------|-----------|----------|------------|---------|--------|--------|--------|
| 5.1 | Définir tous les Domain Events (30+ events) | Events | Partiel | 20% → 100% | Créer types + interfaces | Moyen | P2 | M |
| 5.2 | Connecter EventBus aux mutations subscription | Events | Partiel | 20% → 80% | Modifier services | Élevé | P1 | M |
| 5.3 | Connecter EventBus aux mutations tenant | Events | Partiel | 20% → 80% | Modifier services | Moyen | P2 | M |
| 5.4 | Connecter EventBus aux mutations order | Events | Partiel | 20% → 80% | Modifier services | Élevé | P1 | M |
| 5.5 | Créer `EventHandlerRegistry` (configuration centralisée) | Events | Non | 0% → 100% | Nouveau fichier | Moyen | P2 | S |
| 5.6 | Tests : mutation → event → cache invalidation → UI update | E2E | Non | 0% → 100% | Nouveaux tests | Élevé | P1 | L |

**Livrable :** EventBus connecté. Toute mutation propage ses effets.

**Tests :** Test E2E : activation voucher → event → cache invalidé → UI mise à jour.

**Rollback :** Désactiver handlers (feature flag `ENABLE_EVENT_HANDLERS`).

---

### Sprint 6 — "Observabilité & Production Readiness" (Semaines 14-16)

**Objectif :** Rendre la plateforme observable et prête pour la production

| # | Tâche | Composant | Existant | Conformité | Actions | Impact | Risque | Effort |
|---|-------|-----------|----------|------------|---------|--------|--------|--------|
| 6.1 | Ajouter structured logging (pino) | Logging | Non | 0% → 100% | Nouveau logger | Élevé | P1 | M |
| 6.2 | Ajouter correlation ID à toutes les requêtes | Logging | Non | 0% → 100% | Middleware | Moyen | P2 | S |
| 6.3 | Exporter métriques Prometheus (20 métriques) | Metrics | Non | 0% → 100% | Nouveau module | Élevé | P1 | L |
| 6.4 | Créer dashboard Grafana (replication, cache, business) | Dashboard | Non | 0% → 100% | Nouveau dashboard | Moyen | P2 | M |
| 6.5 | Ajouter alertes (7 alertes P0-P3) | Alerting | Non | 0% → 100% | Configuration AlertManager | Élevé | P1 | M |
| 6.6 | Load testing (k6) sur workflow d'activation | Performance | Non | 0% → 100% | Nouveaux tests | Élevé | P1 | L |
| 6.7 | Documentation ops (runbooks, DRP) | Docs | Non | 0% → 100% | Nouveaux documents | Moyen | P2 | M |

**Livrable :** Plateforme observable. Métriques visibles. Documentation à jour.

**Tests :** Load test : 1000 activations concurrentes. Vérifier métriques.

**Rollback :** Désactiver métriques (feature flag `ENABLE_METRICS`).

---

### Sprint 7 — "Scale & Optimisation" (Mois 5-6)

**Objectif :** Préparer l'infrastructure pour 1000+ tenants

| # | Tâche | Composant | Existant | Conformité | Actions | Impact | Risque | Effort |
|---|-------|-----------|----------|------------|---------|--------|--------|--------|
| 7.1 | Remplacer cache in-memory par Redis | Cache | Partiel | 30% → 100% | Modifier `SubscriptionStatusCache` | Élevé | P1 | L |
| 7.2 | Horizontal scaling : sessions partagées (Redis) | Infra | Non | 0% → 100% | Nouvelle infra | Élevé | P1 | XL |
| 7.3 | Migration vers Supabase comme SOT pour Render cloud | SOT | Partiel | 50% → 100% | Modifier `database.ts` | Critique | P1 | XL |
| 7.4 | Optimisation SQLite (VACUUM, checkpoint, backup) | DB | Partiel | 60% → 90% | Scripts d'optimisation | Moyen | P2 | M |
| 7.5 | Backup automatique + DRP | Infra | Non | 0% → 100% | Nouveaux scripts | Élevé | P1 | L |

**Livrable :** Plateforme scale horizontalement. Redis utilisé. Runbooks existent.

**Tests :** Load test : 10,000 tenants, 1000 req/s.

**Rollback :** Rollback vers SQLite (feature flag `USE_SUPABASE_SOT`).

---

## 8. CRITÈRES DE SUCCÈS PAR SPRINT

### Sprint 0

- [ ] Activation voucher → tenant voit "active" en < 5s (au lieu de 5min)
- [ ] Aucune regression sur les fonctionnalités existantes
- [ ] Idempotence vérifiée (double POST → même réponse)

### Sprint 1

- [ ] JWT ne contient plus `status` ni `expires_at`
- [ ] `GET /auth/me` retourne le statut à jour depuis la DB
- [ ] Frontend se met à jour automatiquement après activation (sans refresh)

### Sprint 2

- [ ] Toutes les tables répliquées ont `entity_version`, `origin_node`, `logical_clock`
- [ ] Backfill complété sans erreur
- [ ] LamportClock fonctionne (test multi-nœuds)

### Sprint 3

- [ ] 100% des routes sont des thin controllers
- [ ] Tests unitaires couvrent 80% des services
- [ ] Aucune logique métier dans les routes

### Sprint 4

- [ ] PushReplicator : exactly-once delivery garanti
- [ ] PullReplicator : convergence en < 5min
- [ ] ConflictResolver : 99% des conflits résolus automatiquement
- [ ] DLQ : catégorisation d'erreurs fonctionnelle

### Sprint 5

- [ ] Toute mutation émet au moins 1 Domain Event
- [ ] Cache invalidé dans les 100ms suivant une mutation
- [ ] UI se met à jour en < 2s après mutation admin

### Sprint 6

- [ ] 20 métriques Prometheus exportées
- [ ] Dashboard Grafana opérationnel
- [ ] 7 alertes configurées et testées
- [ ] Load test : 1000 activations/sans erreur

### Sprint 7

- [ ] Cache Redis : hit ratio > 95%
- [ ] Horizontal scaling : 3 instances sans état partagé
- [ ] RPO = 0, RTO < 30s (testé par chaos engineering)

---

## 9. PLAN DE ROLLBACK

### 9.1 Feature Flags

| Flag | Description | Défaut | Rollback |
|------|-------------|--------|----------|
| `ENABLE_CACHE_INVALIDATION` | Invalidation de cache après mutation | false | Désactiver → cache TTL 5min |
| `USE_JWT_STATUS` | Utiliser `status` dans JWT | true | Désactiver → lecture depuis DB |
| `ENABLE_EVENT_HANDLERS` | EventBus connecté | false | Désactiver → handlers ne s'exécutent pas |
| `USE_V2_REPLICATION` | Replication Engine V2.1 | false | Désactiver → utiliser SyncOrchestratorV2 |
| `ENABLE_METRICS` | Export métriques Prometheus | false | Désactiver → pas de métriques |
| `USE_SUPABASE_SOT` | Supabase comme SOT (Render) | false | Désactiver → SQLite |

### 9.2 Procédure de Rollback

```
1. Détecter le problème (alerte, monitoring)
2. Évaluer l'impact (P0 → rollback immédiat, P1 → rollback sous 1h)
3. Désactiver le feature flag correspondant
4. Vérifier que le système fonctionne en mode dégradé
5. Investiguer le problème en environnement de test
6. Corriger et re-déployer
```

### 9.3 Rollback par Sprint

| Sprint | Rollback | Durée |
|--------|----------|-------|
| S0 | Désactiver `ENABLE_CACHE_INVALIDATION` | 1 minute |
| S1 | Désactiver `USE_JWT_STATUS` | 2 minutes |
| S2 | Restaurer schéma DB (script de rollback) | 10 minutes |
| S3 | Désactiver services, revenir aux routes | 5 minutes |
| S4 | Désactiver `USE_V2_REPLICATION` | 2 minutes |
| S5 | Désactiver `ENABLE_EVENT_HANDLERS` | 1 minute |
| S6 | Désactiver `ENABLE_METRICS` | 1 minute |
| S7 | Désactiver `USE_SUPABASE_SOT` | 5 minutes |

---

## ANNEXE A — ESTIMATION GLOBALE

| Sprint | Durée | Effort total (jours-homme) | Ressources |
|--------|-------|---------------------------|------------|
| S0 | 1 semaine | 7 jh | 1 dev senior |
| S1 | 2 semaines | 20 jh | 2 devs (1 senior, 1 mid) |
| S2 | 2 semaines | 25 jh | 2 devs (1 senior, 1 mid) |
| S3 | 3 semaines | 40 jh | 2 devs seniors |
| S4 | 3 semaines | 45 jh | 2 devs seniors |
| S5 | 2 semaines | 25 jh | 2 devs (1 senior, 1 mid) |
| S6 | 3 semaines | 35 jh | 2 devs (1 senior, 1 mid) + 1 DevOps |
| S7 | 4 semaines | 50 jh | 2 devs seniors + 1 DevOps |
| **TOTAL** | **20 semaines (5 mois)** | **247 jh** | **Équipe de 3-4 personnes** |

---

## ANNEXE B — DÉPENDANCES ENTRE SPRINTS

```
S0 (Stabilization)
  └── S1 (Cache & JWT) — dépend de S0 pour cache invalidation
        └── S2 (Outbox) — dépend de S1 pour JWT sans status
              └── S3 (Domain Services) — dépend de S2 pour versioning
                    └── S4 (Replication Engine) — dépend de S3 pour services
                          └── S5 (Events) — dépend de S4 pour replicators
                                └── S6 (Observability) — dépend de S5 pour events
                                      └── S7 (Scale) — dépend de S6 pour monitoring
```

**Principe :** Chaque sprint peut être livré indépendamment. Les sprints peuvent être exécutés en parallèle si les équipes sont séparées.

---

## ANNEXE C — CHECKLIST DE VALIDATION PAR SPRINT

### Avant de commencer un sprint

- [ ] Les tests du sprint précédent passent tous
- [ ] Le code est déployé en production (ou staging)
- [ ] Les feature flags sont documentées
- [ ] Le rollback est testé

### À la fin d'un sprint

- [ ] Tous les critères de succès sont atteints
- [ ] Les tests E2E passent
- [ ] La documentation est à jour
- [ ] Le sprint est démontré aux stakeholders
- [ ] Le rollback est validé

---

*Document de référence pour la migration vers Architecture V2.1. À mettre à jour après chaque sprint.*