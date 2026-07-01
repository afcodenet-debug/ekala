# 🏛️ Great Olive — Migration Playbook

**Document :** Méthode officielle de migration vers Architecture V2.1  
**Auteur :** Principal Software Architect  
**Version :** 1.0  
**Date :** 27/06/2026  
**Périmètre :** Procédure de migration reproductible pour tous les Bounded Contexts  
**Statut :** MÉTHODE OFFICIELLE — À APPLIQUER POUR CHAQUE DOMAINE  

---

## TABLE DES MATIÈRES

1. [VISION DU PLAYBOOK](#1-vision-du-playbook)
2. [PRINCIPES FONDAMENTAUX](#2-principes-fondamentaux)
3. [PLAYBOOK GÉNÉRIQUE — 8 ÉTAPES](#3-playbook-générique--8-étapes)
4. [APPLICATION — DOMAINE SUBSCRIPTION](#4-application--domaine-subscription)
5. [CHECKLIST DE VALIDATION](#5-checklist-de-validation)
6. [TEMPLATES DE DOCUMENTATION](#6-templates-de-documentation)

---

## 1. VISION DU PLAYBOOK

### 1.1 Énoncé

> Le Migration Playbook est la **méthode unique et reproductible** pour migrer un Bounded Context de l'architecture actuelle vers l'Architecture V2.1. Il garantit que chaque migration est:
> - **Sûre** : pas de régression, rollback possible à tout moment
> - **Complète** : tous les composants de l'architecture cible sont implémentés
> - **Testable** : critères de validation mesurables
> - **Indépendante** : chaque contexte peut être migré séparément

### 1.2 Philosophie

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    PHILOSOPHIE DU MIGRATION PLAYBOOK                         │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PRINCIPE #1 : Un Bounded Context à la fois                                │
│  → Ne pas migrer plusieurs contextes en parallèle                           │
│  → Maîtriser les risques avant de passer au suivant                        │
│                                                                              │
│  PRINCIPE #2 : Feature Flags systématiques                                  │
│  → Toute modification est derrière un flag                                 │
│  → Rollback en 1 clic (pas de rollback de code)                            │
│  → Déploiement progressif (canary, blue-green)                              │
│                                                                              │
│  PRINCIPE #3 : Tests d'abord, code ensuite                                  │
│  → Écrire les tests E2E AVANT de migrer                                    │
│  → Les tests définissent le comportement attendu                            │
│  → Les tests passent AVANT et APRÈS migration                               │
│                                                                              │
│  PRINCIPE #4 : Backward compatibility permanente                             │
│  → L'ancien code reste fonctionnel pendant la migration                     │
│  → Double écriture (old + new) pendant la transition                        │
│  → Suppression de l'ancien code seulement après validation complète         │
│                                                                              │
│  PRINCIPE #5 : Documentation live                                             │
│  → Mettre à jour les docs APRÈS chaque étape                               │
│  → Les ADR sont créés AVANT l'implémentation                               │
│  → La Gap Analysis est validée AVANT de commencer                          │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. PRINCIPES FONDAMENTAUX

### 2.1 Feature Flags Obligatoires

Toute modification doit être contrôlée par un feature flag:

```typescript
// src/lib/feature-flags.ts
export const FeatureFlags = {
  // Subscription Context
  USE_SUBSCRIPTION_SERVICES: process.env.USE_SUBSCRIPTION_SERVICES === 'true', // false par défaut
  USE_SUBSCRIPTION_CACHE_INVALIDATION: process.env.USE_SUBSCRIPTION_CACHE_INVALIDATION === 'true', // false
  USE_SUBSCRIPTION_VERSIONING: process.env.USE_SUBSCRIPTION_VERSIONING === 'true', // false
  
  // Tenant Context
  USE_TENANT_SERVICES: process.env.USE_TENANT_SERVICES === 'true', // false
  
  // Order Context
  USE_ORDER_SERVICES: process.env.USE_ORDER_SERVICES === 'true', // false
  USE_STOCK_RESERVATION: process.env.USE_STOCK_RESERVATION === 'true', // false
  
  // Replication Engine
  USE_V2_REPLICATION: process.env.USE_V2_REPLICATION === 'true', // false
  USE_REPLICATION_IDEMPOTENCE: process.env.USE_REPLICATION_IDEMPOTENCE === 'true', // false
  
  // Auth
  USE_JWT_WITHOUT_STATUS: process.env.USE_JWT_WITHOUT_STATUS === 'true', // false
  
  // Global
  ENABLE_STRUCTURED_LOGGING: process.env.ENABLE_STRUCTURED_LOGGING === 'true', // false
  ENABLE_METRICS: process.env.ENABLE_METRICS === 'true', // false
} as const;
```

**Règle d'or :** Si un feature flag n'existe pas, la feature ne peut pas être déployée.

### 2.2 Stratégie de Déploiement

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    STRATÉGIE DE DÉPLOIEMENT PAR ÉTAPE                       │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ÉTAPE 1 : Feature flag = false (défaut)                                    │
│  → Code déployé en production mais désactivé                                │
│  → Aucun impact utilisateur                                                 │
│                                                                              │
│  ÉTAPE 2 : Feature flag = true sur 1 instance (canary)                      │
│  → Tester sur 1 instance (ex: staging)                                      │
│  → Monitoring intensif                                                      │
│                                                                              │
│  ÉTAPE 3 : Feature flag = true sur 10% des instances                        │
│  → Canary deployment (1 instance sur 10)                                    │
│  → Vérifier métriques, logs, alertes                                        │
│                                                                              │
│  ÉTAPE 4 : Feature flag = true sur 50%                                      │
│  → Rollout progressif                                                        │
│  → Comparer comportement old vs new                                         │
│                                                                              │
│  ÉTAPE 5 : Feature flag = true sur 100%                                     │
│  → Déploiement complet                                                       │
│  → Monitoring pendant 48h                                                    │
│                                                                              │
│  ÉTAPE 6 : Suppression du feature flag (nettoyage)                          │
│  → Seulement après 2 semaines sans incident                                 │
│  → Supprimer le code ancien (dead code elimination)                         │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Critères de Validation

Chaque étape doit passer ces critères avant de passer à la suivante:

| Critère | Description | Mesure |
|---------|-------------|--------|
| **Tests E2E passent** | Tous les tests E2E du contexte passent | 100% |
| **Tests unitaires passent** | Tous les tests unitaires passent | 100% |
| **Aucune regression** | Les fonctionnalités existantes fonctionnent | 0 bug critique |
| **Performance** | Les temps de réponse sont acceptables | P95 < 500ms |
| **Logs propres** | Pas d'erreur dans les logs | 0 erreur/h |
| **Métriques OK** | Les métriques sont dans les normes | Voir sprint |
| **Rollback testé** | Le rollback fonctionne en < 5min | Testé et validé |
| **Documentation à jour** | Les docs sont mises à jour | 100% |

---

## 3. PLAYBOOK GÉNÉRIQUE — 8 ÉTAPES

### ÉTAPE 0 : Préparation

**Objectif :** Préparer le terrain avant toute modification

#### 0.1 Prérequis

- [ ] Architecture V2.1 validée et figée
- [ ] Gap Analysis du contexte complétée
- [ ] Équipe formée à l'architecture cible
- [ ] Environnements de test disponibles (dev, staging)
- [ ] Monitoring et alertes opérationnels
- [ ] Feature flags infrastructure en place

#### 0.2 Modifications Attendues

- Aucune modification de code
- Création de la branche Git `migration/{context-name}`
- Mise à jour de la documentation

#### 0.3 Critères de Validation

- [ ] Gap Analysis signée par le tech lead
- [ ] Plan de migration validé par l'équipe
- [ ] Tests E2E existants identifiés et documentés
- [ ] Baseline de performance établie (métriques actuelles)

#### 0.4 Definition of Done

- [ ] Gap Analysis complétée
- [ ] Plan de migration approuvé
- [ ] Branche Git créée
- [ ] Tests baseline exécutés et documentés

#### 0.5 Stratégie de Rollback

- Aucun rollback nécessaire (pas de modification)
- Si problème : abandonner la branche, revenir à `main`

#### 0.6 Tests Obligatoires

- [ ] Tests E2E existants : tous passent (baseline)
- [ ] Tests de performance : baseline établie
- [ ] Tests de charge : baseline établie

#### 0.7 Risques Connus

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Sous-estimation de l'effort | Moyenne | Élevé | Buffer de 20% sur les estimations |
| Tests existants incomplets | Faible | Moyen | Compléter les tests avant migration |
| Équipe non formée | Faible | Élevé | Formation obligatoire avant Sprint 0 |

#### 0.8 Checklist Finale

- [ ] Gap Analysis validée
- [ ] Plan de migration approuvé
- [ ] Équipe alignée
- [ ] Environnements prêts
- [ ] Monitoring opérationnel
- [ ] Feature flags prêts

---

### ÉTAPE 1 : Stabilisation (P0 Only)

**Objectif :** Corriger les bugs critiques sans changer l'architecture

#### 1.1 Prérequis

- [ ] Étape 0 complétée
- [ ] Bugs P0 identifiés et documentés
- [ ] Tests de reproduction existent

#### 1.2 Modifications Attendues

- Corrections minimales pour débloquer les utilisateurs
- Exemples:
  - Ajouter `invalidateSubscriptionCache()` après mutations
  - Unifier connexions SQLite
  - Corriger les appels async manquants

#### 1.3 Critères de Validation

- [ ] Bug principal corrigé (ex: "SUBSCRIPTION_REQUIRED après activation")
- [ ] Tests de reproduction passent
- [ ] Aucune nouvelle régression
- [ ] Performance stable

#### 1.4 Definition of Done

- [ ] Bug P0 corrigé et déployé
- [ ] Test de non-régression passe
- [ ] Monitoring confirme la résolution
- [ ] Documentation du bug mise à jour

#### 1.5 Stratégie de Rollback

- Feature flag `ENABLE_STABILIZATION` (défaut: false)
- Rollback : désactiver le flag en 1 minute
- Pas de rollback de code nécessaire

#### 1.6 Tests Obligatoires

- [ ] Test de reproduction du bug : passe
- [ ] Test E2E du workflow principal : passe
- [ ] Test de régression : 0 bug critique
- [ ] Test de performance : P95 < 500ms

#### 1.7 Risques Connus

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Correction incomplète | Moyenne | Élevé | Tests E2E complets |
| Regression | Faible | Élevé | Feature flag + rollback immédiat |
| Performance dégradée | Faible | Moyen | Monitoring intensif |

#### 1.8 Checklist Finale

- [ ] Bug P0 corrigé
- [ ] Tests passent
- [ ] Feature flag fonctionnelle
- [ ] Rollback testé
- [ ] Monitoring OK
- [ ] Documentation à jour

---

### ÉTAPE 2 : Versioning des Entités

**Objectif :** Ajouter `entity_version`, `origin_node`, `logical_clock` à toutes les tables répliquées

#### 2.1 Prérequis

- [ ] Étape 1 complétée
- [ ] Migration SQL préparée et testée
- [ ] Script de rollback SQL prêt
- [ ] Backup de la base de données effectué

#### 2.2 Modifications Attendues

**A. Migration de schéma (SQLite + Supabase)**

```sql
-- Ajout à chaque table répliquée
ALTER TABLE subscriptions ADD COLUMN entity_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE subscriptions ADD COLUMN origin_node TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE subscriptions ADD COLUMN logical_clock INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN replicated_at TEXT;
ALTER TABLE subscriptions ADD COLUMN replication_status TEXT DEFAULT 'pending';

-- Même chose pour: tenants, orders, order_items, products, categories, etc.
```

**B. Services de versioning**

- Créer `LamportClock` service
- Créer `OriginNode` service
- Modifier `withOutboxTransaction` pour inclure le versioning

**C. Backfill**

- Script de migration pour initialiser `entity_version = 1` et `origin_node = 'legacy'` pour toutes les entités existantes

#### 2.3 Critères de Validation

- [ ] Toutes les tables répliquées ont les nouvelles colonnes
- [ ] Backfill complété sans erreur
- [ ] `LamportClock` fonctionne (test unitaire)
- [ ] `OriginNode` génère un UUID persistant
- [ ] Aucune régression sur les fonctionnalités existantes
- [ ] Performance stable

#### 2.4 Definition of Done

- [ ] Migration SQL appliquée (SQLite + Supabase)
- [ ] Backfill complété
- [ ] Services `LamportClock` et `OriginNode` créés et testés
- [ ] `withOutboxTransaction` inclut le versioning
- [ ] Tests E2E passent
- [ ] Documentation API à jour

#### 2.5 Stratégie de Rollback

**Rollback automatique (feature flag):**
- Feature flag `USE_ENTITY_VERSIONING` (défaut: false)
- Si désactivé : les nouvelles colonnes sont ignorées, l'ancien comportement est conservé

**Rollback manuel (si nécessaire):**
```sql
-- Script de rollback
ALTER TABLE subscriptions DROP COLUMN entity_version;
ALTER TABLE subscriptions DROP COLUMN origin_node;
ALTER TABLE subscriptions DROP COLUMN logical_clock;
ALTER TABLE subscriptions DROP COLUMN replicated_at;
ALTER TABLE subscriptions DROP COLUMN replication_status;
-- Répéter pour chaque table
```

**Durée de rollback:** 10 minutes

#### 2.6 Tests Obligatoires

- [ ] **Tests de migration SQL:**
  - [ ] Migration appliquée sur base de test
  - [ ] Rollback appliqué sur base de test
  - [ ] Re-migration appliquée (idempotence)

- [ ] **Tests de backfill:**
  - [ ] Backfill sur 1000 entités : complété en < 30s
  - [ ] Vérifier qu'aucune entité n'a `entity_version = 0`
  - [ ] Vérifier qu'aucune entité n'a `origin_node = NULL`

- [ ] **Tests unitaires:**
  - [ ] `LamportClock.tick()` incrémente le compteur
  - [ ] `LamportClock.observe()` met à jour le compteur
  - [ ] `OriginNode` génère un UUID valide
  - [ ] `OriginNode` persiste dans `settings`

- [ ] **Tests d'intégration:**
  - [ ] Mutation SQLite → outbox contient `entity_version`, `origin_node`, `logical_clock`
  - [ ] Push vers Supabase inclut les champs de versioning
  - [ ] Pull depuis Supabase → SQLite préserve les champs

- [ ] **Tests E2E:**
  - [ ] Workflow d'activation complet : passe
  - [ ] Workflow de création de tenant : passe
  - [ ] Workflow de commande POS : passe

- [ ] **Tests de performance:**
  - [ ] Temps de mutation : < 100ms (avant: < 50ms)
  - [ ] Temps de push : < 200ms (avant: < 150ms)
  - [ ] Temps de pull : < 300ms (avant: < 250ms)

#### 2.7 Risques Connus

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Migration SQL échoue | Faible | Critique | Backup + test sur environnement de test d'abord |
| Backfill lent sur grosse DB | Moyenne | Élevé | Backfill par batch de 1000, monitoring |
| Colonnes manquantes dans Supabase | Moyenne | Élevé | Vérifier schéma Supabase avant migration |
| Performance dégradée | Moyenne | Moyen | Index sur `entity_version`, `origin_node` |
| Incompatibilité avec ancien code | Faible | Élevé | Feature flag + double chemin |

#### 2.8 Checklist Finale

- [ ] Migration SQL testée et validée
- [ ] Backup effectué
- [ ] Backfill complété
- [ ] Services créés et testés
- [ ] Feature flag fonctionnelle
- [ ] Tests E2E passent
- [ ] Performance OK
- [ ] Rollback testé
- [ ] Documentation API à jour
- [ ] Équipe informée

---

### ÉTAPE 3 : Domain Services Extraction

**Objectif :** Extraire la logique métier des routes vers des services dédiés

#### 3.1 Prérequis

- [ ] Étape 2 complétée
- [ ] Interfaces Repository définies
- [ ] Tests unitaires infrastructure en place (Jest)
- [ ] Équipe formée au DDD (Domain-Driven Design)

#### 3.2 Modifications Attendues

**A. Création des Aggregates (DDD)**

```
src/domain/subscription/
├── aggregates/
│   ├── VoucherRequest.ts
│   ├── Subscription.ts
│   └── Plan.ts
├── value-objects/
│   ├── VoucherStatus.ts
│   ├── SubscriptionStatus.ts
│   └── PlanId.ts
└── events/
    ├── VoucherRequestSubmitted.ts
    ├── VoucherVerified.ts
    ├── SubscriptionActivated.ts
    └── ...
```

**B. Création des Domain Services**

- `SubscriptionActivationService` (avec invariants)
- `VoucherValidationService`
- `PlanValidationService`

**C. Création des Application Services**

- `VoucherApplicationService`
- `SubscriptionApplicationService`

**D. Création des Repositories (interfaces + implémentations)**

- `IVoucherRequestRepository` (interface)
- `SqliteVoucherRequestRepository` (implémentation)
- `SupabaseVoucherRequestRepository` (implémentation)

**E. Refactor des routes en thin controllers**

- `admin.subscriptions.ts` → thin controller
- `platform.routes.ts` (subscriptions) → thin controller

#### 3.3 Critères de Validation

- [ ] Aggregates créés avec invariants
- [ ] Domain Services créés et testés unitairement
- [ ] Application Services créés et testés unitairement
- [ ] Repositories créés (interfaces + 2 implémentations)
- [ ] Routes refactorisées en thin controllers
- [ ] Ancien code toujours fonctionnel (feature flag)
- [ ] Tests E2E passent (ancien + nouveau chemin)

#### 3.4 Definition of Done

- [ ] Aggregates créés et documentés
- [ ] Domain Services couverts à 80% par tests unitaires
- [ ] Application Services couverts à 80% par tests unitaires
- [ ] Repositories fonctionnels (SQLite + Supabase)
- [ ] Routes refactorisées (feature flag pour basculer old/new)
- [ ] Tests E2E passent avec ancien ET nouveau chemin
- [ ] Performance stable ou améliorée
- [ ] Documentation API à jour

#### 3.5 Stratégie de Rollback

**Feature flags:**
- `USE_SUBSCRIPTION_SERVICES` (défaut: false)
- Si false : routes utilisent l'ancienne logique
- Si true : routes utilisent les nouveaux services

**Rollback:**
- Désactiver `USE_SUBSCRIPTION_SERVICES` → retour immédiat à l'ancien comportement
- Aucune modification de schéma à rollbacker

**Double écriture (optionnel):**
- Pendant la transition, écrire dans old + new
- Permet de comparer les résultats
- Supprimer l'ancien chemin seulement après validation complète

#### 3.6 Tests Obligatoires

- [ ] **Tests unitaires Aggregates:**
  - [ ] `VoucherRequest` : création, validation des invariants
  - [ ] `Subscription` : création, transitions d'état valides
  - [ ] `Plan` : création, validation

- [ ] **Tests unitaires Domain Services:**
  - [ ] `SubscriptionActivationService.activate()` : cas succès
  - [ ] `SubscriptionActivationService.activate()` : cas échec (tenant inexistant)
  - [ ] `VoucherValidationService.validate()` : cas succès
  - [ ] `VoucherValidationService.validate()` : cas échec (voucher expiré)

- [ ] **Tests unitaires Application Services:**
  - [ ] `VoucherApplicationService.requestVoucher()` : cas succès
  - [ ] `VoucherApplicationService.verifyVoucher()` : cas succès
  - [ ] `SubscriptionApplicationService.activateSubscription()` : cas succès

- [ ] **Tests d'intégration Repositories:**
  - [ ] `SqliteVoucherRequestRepository.findById()` : retourne l'entité
  - [ ] `SqliteVoucherRequestRepository.save()` : persiste l'entité
  - [ ] `SupabaseVoucherRequestRepository.findById()` : retourne l'entité
  - [ ] `SupabaseVoucherRequestRepository.save()` : persiste l'entité

- [ ] **Tests E2E (ancien chemin):**
  - [ ] Workflow activation voucher : passe
  - [ ] Workflow rejection voucher : passe
  - [ ] Workflow création subscription : passe

- [ ] **Tests E2E (nouveau chemin avec feature flag):**
  - [ ] Workflow activation voucher : passe
  - [ ] Workflow rejection voucher : passe
  - [ ] Workflow création subscription : passe

- [ ] **Tests de comparaison (double chemin):**
  - [ ] Même entrée → même sortie (ancien vs nouveau)
  - [ ] Vérifier que les deux chemins produisent les mêmes résultats

- [ ] **Tests de performance:**
  - [ ] Temps de réponse : < 500ms (avant et après)
  - [ ] Throughput : > 100 req/s (avant et après)

#### 3.7 Risques Connus

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Invariants incorrects | Moyenne | Critique | Tests unitaires exhaustifs + review pair |
| Performance dégradée | Faible | Élevé | Benchmark avant/après |
| Double chemin source de confusion | Moyenne | Moyen | Feature flag + monitoring |
| Réutilisation difficile | Faible | Moyen | Documentation des services |

#### 3.8 Checklist Finale

- [ ] Aggregates créés avec invariants
- [ ] Domain Services testés unitairement (80% coverage)
- [ ] Application Services testés unitairement (80% coverage)
- [ ] Repositories fonctionnels (SQLite + Supabase)
- [ ] Routes refactorisées en thin controllers
- [ ] Feature flag fonctionnelle
- [ ] Tests E2E passent (ancien + nouveau)
- [ ] Performance OK
- [ ] Rollback testé
- [ ] Documentation API à jour
- [ ] Équipe formée au DDD

---

### ÉTAPE 4 : Cache Invalidation & EventBus

**Objectif :** Connecter les mutations aux caches via des Domain Events

#### 4.1 Prérequis

- [ ] Étape 3 complétée
- [ ] EventBus existant et fonctionnel
- [ ] Cache existant (SubscriptionStatusCache)
- [ ] Tests d'intégration EventBus en place

#### 4.2 Modifications Attendues

**A. Définition des Domain Events**

```typescript
// src/domain/subscription/events/
export interface VoucherRequestSubmitted {
  type: 'VoucherRequestSubmitted';
  payload: {
    voucherId: number;
    tenantId: number;
    planId: number;
    requestedBy: number;
  };
  metadata: {
    timestamp: string;
    originNode: string;
    logicalClock: number;
    correlationId: string;
  };
}

export interface SubscriptionActivated {
  type: 'SubscriptionActivated';
  payload: {
    subscriptionId: number;
    tenantId: number;
    planId: number;
    activatedAt: string;
  };
  metadata: { ... };
}
```

**B. Émission des Events dans les Services**

```typescript
// Dans SubscriptionActivationService
async activate(tenantId, planId, adminUserId): Promise<Subscription> {
  // ... logique métier ...
  
  // Émettre l'événement
  await this.eventBus.emit(new SubscriptionActivated({
    subscriptionId: subscription.id,
    tenantId,
    planId,
    activatedAt: new Date().toISOString()
  }, {
    originNode: await this.originNode.get(),
    logicalClock: this.lamportClock.tick(),
    correlationId: this.correlationId
  }));
}
```

**C. Handlers EventBus**

```typescript
// src/infrastructure/event-handlers/
export class CacheInvalidationHandler {
  @OnEvent('SubscriptionActivated')
  async onSubscriptionActivated(event: SubscriptionActivated) {
    await this.cache.invalidate(event.payload.tenantId);
  }
  
  @OnEvent('TenantSuspended')
  async onTenantSuspended(event: TenantSuspended) {
    await this.cache.invalidate(event.payload.tenantId);
  }
}
```

**D. EventHandlerRegistry**

```typescript
// Configuration centralisée des handlers
export class EventHandlerRegistry {
  constructor(private eventBus: EventBus) {}
  
  registerAll() {
    // Cache invalidation
    this.eventBus.on('SubscriptionActivated', cacheHandler.onSubscriptionActivated);
    this.eventBus.on('TenantSuspended', cacheHandler.onTenantSuspended);
    
    // Audit
    this.eventBus.on('SubscriptionActivated', auditHandler.onSubscriptionActivated);
    
    // Sync
    this.eventBus.on('SubscriptionActivated', syncHandler.onSubscriptionActivated);
    
    // Email
    this.eventBus.on('SubscriptionActivated', emailHandler.onSubscriptionActivated);
  }
}
```

#### 4.3 Critères de Validation

- [ ] 8+ Domain Events définis pour SUBSCRIPTION
- [ ] Events émis dans tous les services (SubscriptionActivationService, VoucherApplicationService, etc.)
- [ ] Handlers enregistrés dans EventHandlerRegistry
- [ ] Cache invalidé dans les 100ms suivant une mutation
- [ ] UI se met à jour en < 2s après mutation admin
- [ ] Aucune regression

#### 4.4 Definition of Done

- [ ] 8+ Domain Events définis et typés
- [ ] Events émis dans 100% des mutations
- [ ] Handlers enregistrés (cache, audit, sync, email)
- [ ] Cache invalidation fonctionne (testé)
- [ ] Tests E2E passent
- [ ] Performance OK
- [ ] Documentation EventBus à jour

#### 4.5 Stratégie de Rollback

- Feature flag `ENABLE_EVENT_HANDLERS` (défaut: false)
- Si false : les events sont émis mais aucun handler ne s'exécute
- Si true : handlers actifs
- Rollback : désactiver le flag → handlers ne s'exécutent plus

#### 4.6 Tests Obligatoires

- [ ] **Tests unitaires Events:**
  - [ ] `VoucherRequestSubmitted` : création, sérialisation
  - [ ] `SubscriptionActivated` : création, sérialisation

- [ ] **Tests unitaires Handlers:**
  - [ ] `CacheInvalidationHandler.onSubscriptionActivated()` : invalide le cache
  - [ ] `AuditHandler.onSubscriptionActivated()` : log l'événement

- [ ] **Tests d'intégration EventBus:**
  - [ ] Émettre `SubscriptionActivated` → handler appelé
  - [ ] Émettre `TenantSuspended` → cache invalidé
  - [ ] Tester l'ordre des handlers (pas de race condition)

- [ ] **Tests E2E:**
  - [ ] Admin valide voucher → Event émis → Cache invalidé → UI mise à jour
  - [ ] Admin suspend tenant → Event émis → Cache invalidé → UI mise à jour

- [ ] **Tests de performance:**
  - [ ] Latence EventBus : < 10ms
  - [ ] Cache invalidation : < 100ms
  - [ ] UI update : < 2s

#### 4.7 Risques Connus

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| EventBus saturé | Faible | Élevé | Queue avec backpressure |
| Handlers en erreur bloquent les autres | Moyenne | Élevé | Try/catch dans chaque handler |
| Race condition (cache invalidation) | Moyenne | Moyen | Tests de concurrence |
| Events perdus | Faible | Élevé | Outbox pour events critiques |

#### 4.8 Checklist Finale

- [ ] 8+ Events définis
- [ ] Events émis dans 100% des mutations
- [ ] Handlers enregistrés et fonctionnels
- [ ] Cache invalidation testée
- [ ] Feature flag fonctionnelle
- [ ] Tests E2E passent
- [ ] Performance OK
- [ ] Rollback testé
- [ ] Documentation EventBus à jour

---

### ÉTAPE 5 : Replication Engine Enrichment

**Objectif :** Enrichir le Replication Engine avec idempotence, versioning, conflict resolver avancé

#### 5.1 Prérequis

- [ ] Étape 4 complétée
- [ ] `GenericSyncService` existe et fonctionne
- [ ] `ConflictResolver` existe
- [ ] `DeadLetterQueue` existe
- [ ] Tests d'intégration sync en place

#### 5.2 Modifications Attendues

**A. PushReplicator (extraction de GenericSyncService)**

- Ajouter idempotence (`Idempotency-Key: outbox.id`)
- Ajouter versioning dans le payload
- Ajouter `origin_node` et `logical_clock`

**B. PullReplicator (extraction de GenericSyncService)**

- Utiliser `entity_version` pour détecter les conflits
- Appliquer la matrice de résolution par domaine
- Mettre à jour `replicated_at`

**C. ConflictResolver (enrichissement)**

- Implémenter 8 stratégies de résolution
- Appliquer la matrice par domaine (SUBSCRIPTION, TENANT, ORDER, PRODUCT)
- Logger les conflits dans `sync_conflicts`

**D. DeadLetterQueue (enrichissement)**

- Ajouter `error_category` (network, validation, conflict, auth, timeout)
- Ajouter `retry_history` (JSON array)
- Interface admin DLQ

**E. ReplicationIdempotency (nouveau)**

- Table Supabase `replication_idempotency`
- Vérification avant chaque push
- TTL 7 jours

#### 5.3 Critères de Validation

- [ ] PushReplicator : exactly-once delivery garanti
- [ ] PullReplicator : convergence en < 5min
- [ ] ConflictResolver : 99% des conflits résolus automatiquement
- [ ] DLQ : catégorisation d'erreurs fonctionnelle
- [ ] Idempotence : pas de doublon dans Supabase
- [ ] Aucune regression sync

#### 5.4 Definition of Done

- [ ] PushReplicator créé et testé
- [ ] PullReplicator créé et testé
- [ ] ConflictResolver enrichi (8 stratégies)
- [ ] DLQ enrichie (error_category, retry_history)
- [ ] ReplicationIdempotency implémenté
- [ ] Tests d'intégration passent (push → Supabase → pull → SQLite)
- [ ] Tests de conflits passent (scénarios réels)
- [ ] Performance OK
- [ ] Documentation Replication Engine à jour

#### 5.5 Stratégie de Rollback

- Feature flag `USE_V2_REPLICATION` (défaut: false)
- Si false : utiliser l'ancien `SyncOrchestratorV2`
- Si true : utiliser le nouveau Replication Engine
- Rollback : désactiver le flag → retour à SyncOrchestratorV2

#### 5.6 Tests Obligatoires

- [ ] **Tests unitaires PushReplicator:**
  - [ ] Push message → Supabase reçoit le message
  - [ ] Push même message 2 fois → Supabase ne reçoit qu'une fois (idempotence)
  - [ ] Push avec erreur réseau → retry automatique

- [ ] **Tests unitaires PullReplicator:**
  - [ ] Pull depuis Supabase → SQLite mis à jour
  - [ ] Pull avec conflit → ConflictResolver appelé
  - [ ] Pull incrémental (curseur) → seulement les nouveaux messages

- [ ] **Tests unitaires ConflictResolver:**
  - [ ] Conflit version (local > remote) → local gagne
  - [ ] Conflit version (remote > local) → remote gagne
  - [ ] Conflit timestamp → timestamp le plus récent gagne
  - [ ] Conflit manuel → logué dans sync_conflicts

- [ ] **Tests d'intégration (multi-nœuds):**
  - [ ] Node A push → Supabase → Node B pull → convergence
  - [ ] Node A et Node B modifient même entité → conflit détecté et résolu
  - [ ] Node A push → Supabase → Realtime → Node A pull → pas de boucle

- [ ] **Tests E2E:**
  - [ ] Workflow activation voucher complet : passe
  - [ ] Workflow avec 2 POS + 1 admin : passe
  - [ ] Simulation de conflits : résolus automatiquement

- [ ] **Tests de performance:**
  - [ ] Push throughput : > 100 msg/s
  - [ ] Pull latency : < 5min pour convergence
  - [ ] Conflict resolution : < 100ms

#### 5.7 Risques Connus

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Boucle de réplication | Faible | Critique | Tests multi-nœuds + origin_node check |
| Conflits non résolus | Moyenne | Élevé | Stratégie par domaine + DLQ |
| Idempotence cassée | Faible | Élevé | Tests de retry intensifs |
| Performance dégradée | Moyenne | Moyen | Benchmark avant/après |
| Perte de messages Realtime | Moyenne | Moyen | Fallback sur pull |

#### 5.8 Checklist Finale

- [ ] PushReplicator créé et testé
- [ ] PullReplicator créé et testé
- [ ] ConflictResolver enrichi
- [ ] DLQ enrichie
- [ ] ReplicationIdempotency implémenté
- [ ] Feature flag fonctionnelle
- [ ] Tests d'intégration passent
- [ ] Tests de conflits passent
- [ ] Performance OK
- [ ] Rollback testé
- [ ] Documentation Replication Engine à jour

---

### ÉTAPE 6 : Observabilité

**Objectif :** Ajouter structured logging, métriques, alertes

#### 6.1 Prérequis

- [ ] Étape 5 complétée
- [ ] Infrastructure de logging en place (pino)
- [ ] Infrastructure de métriques en place (Prometheus)
- [ ] Infrastructure d'alerting en place (AlertManager)

#### 6.2 Modifications Attendues

**A. Structured Logging**

- Logger global (pino)
- Correlation ID sur toutes les requêtes
- Logs structurés pour chaque couche

**B. Métriques Prometheus**

- 20 métriques (voir Architecture V2.1)
- Export sur `/metrics`
- Dashboard Grafana

**C. Alertes**

- 7 alertes (P0-P3)
- Canaux : Email, Slack, SMS

#### 6.3 Critères de Validation

- [ ] Structured logging fonctionne
- [ ] 20 métriques exportées
- [ ] Dashboard Grafana opérationnel
- [ ] 7 alertes configurées et testées
- [ ] Aucune regression

#### 6.4 Definition of Done

- [ ] Logger global déployé
- [ ] Correlation ID sur toutes les requêtes
- [ ] 20 métriques exportées
- [ ] Dashboard Grafana créé
- [ ] 7 alertes configurées
- [ ] Tests de charge passent
- [ ] Documentation ops à jour

#### 6.5 Stratégie de Rollback

- Feature flags:
  - `ENABLE_STRUCTURED_LOGGING` (défaut: false)
  - `ENABLE_METRICS` (défaut: false)
- Rollback : désactiver les flags

#### 6.6 Tests Obligatoires

- [ ] Tests de logging: logs structurés présents
- [ ] Tests de métriques: métriques exportées
- [ ] Tests d'alertes: alertes déclenchées
- [ ] Tests de performance: overhead < 5%

#### 6.7 Risques Connus

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Overhead logging | Faible | Moyen | Sampling, log level dynamique |
| Alertes spam | Moyenne | Moyen | Seuils ajustables, cooldown |
| Métriques manquantes | Moyenne | Moyen | Review régulière |

#### 6.8 Checklist Finale

- [ ] Structured logging déployé
- [ ] Métriques exportées
- [ ] Dashboard Grafana opérationnel
- [ ] Alertes configurées
- [ ] Feature flags fonctionnelles
- [ ] Tests passent
- [ ] Performance OK
- [ ] Rollback testé
- [ ] Documentation ops à jour

---

### ÉTAPE 7 : Nettoyage et Suppression du Code Ancien

**Objectif :** Supprimer le code legacy après validation complète

#### 7.1 Prérequis

- [ ] Étape 6 complétée
- [ ] Nouveau code en production depuis 2 semaines
- [ ] Aucun incident lié au nouveau code
- [ ] Monitoring confirme la stabilité

#### 7.2 Modifications Attendues

- Suppression des anciennes routes (si double chemin)
- Suppression des feature flags devenues inutiles
- Suppression du code mort (dead code elimination)
- Nettoyage des imports

#### 7.3 Critères de Validation

- [ ] Ancien code supprimé
- [ ] Feature flags supprimées
- [ ] Codebase plus propre
- [ ] Aucune regression

#### 7.4 Definition of Done

- [ ] Ancien code supprimé
- [ ] Feature flags supprimées
- [ ] Tests passent
- [ ] Documentation à jour
- [ ] Code review effectuée

#### 7.5 Stratégie de Rollback

- **Pas de rollback possible** (code supprimé)
- **Mitigation:** Garder le code ancien dans un tag Git `legacy/{context-name}`
- En cas de problème : revert vers le tag

#### 7.6 Tests Obligatoires

- [ ] Tests E2E : tous passent
- [ ] Tests de régression : 0 bug
- [ ] Tests de performance : stable

#### 7.7 Risques Connus

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Code supprimé trop tôt | Faible | Critique | Attendre 2 semaines de stabilité |
| Regression | Faible | Élevé | Tests exhaustifs avant suppression |
| Perte de connaissance | Moyenne | Moyen | Documentation avant suppression |

#### 7.8 Checklist Finale

- [ ] 2 semaines de stabilité confirmées
- [ ] Ancien code supprimé
- [ ] Feature flags supprimées
- [ ] Tests passent
- [ ] Code review effectuée
- [ ] Documentation à jour
- [ ] Tag Git `legacy` créé

---

## 4. APPLICATION — DOMAINE SUBSCRIPTION

### 4.1 État Actuel (Gap Analysis)

| Composant | État | Conformité |
|-----------|------|------------|
| Tables | ✅ Existent | 70% |
| Logique métier | ⚠️ Dans routes | 40% |
| Cache invalidation | ❌ Jamais appelé | 0% |
| Versioning | ❌ Absent | 0% |
| Domain Events | ⚠️ Partiel | 20% |
| Services dédiés | ❌ Absents | 0% |
| Repositories | ⚠️ Accès directs | 30% |

### 4.2 Plan de Migration Détaillé

#### S0 — Stabilization (1 semaine)

**Objectif:** Corriger le bug "SUBSCRIPTION_REQUIRED après activation"

| Étape | Tâche | Durée | Risque |
|-------|-------|-------|--------|
| 0.1 | Ajouter `invalidateSubscriptionCache()` dans `activateTenantSub` | 2h | P0 |
| 0.2 | Ajouter `invalidateSubscriptionCache()` dans `verifyVoucher` | 2h | P0 |
| 0.3 | Ajouter `invalidateSubscriptionCache()` dans `rejectVoucher` | 2h | P0 |
| 0.4 | Unifier connexion SQLite dans `subscription-guard.ts` | 4h | P0 |
| 0.5 | Tests E2E : activation → tenant voit "active" en < 5s | 4h | P0 |

**Definition of Done:**
- [ ] Bug corrigé
- [ ] Tests E2E passent
- [ ] Feature flag `ENABLE_CACHE_INVALIDATION` fonctionnelle
- [ ] Rollback testé

#### S1 — Cache & JWT (2 semaines)

**Objectif:** Retirer le business state du JWT

| Étape | Tâche | Durée | Risque |
|-------|-------|-------|--------|
| 1.1 | Créer `SubscriptionStatusReadModel` | 1j | P1 |
| 1.2 | Modifier `GET /auth/me` pour lire depuis DB | 1j | P1 |
| 1.3 | Retirer `status` du JWT (feature flag) | 2j | P1 |
| 1.4 | Modifier `SubscriptionStatus.tsx` | 1j | P1 |
| 1.5 | Tests E2E complets | 2j | P1 |

**Definition of Done:**
- [ ] JWT ne contient plus `status`
- [ ] `GET /auth/me` retourne statut à jour
- [ ] Frontend se met à jour automatiquement
- [ ] Tests E2E passent

#### S2 — Outbox Enrichment (2 semaines)

**Objectif:** Ajouter versioning

| Étape | Tâche | Durée | Risque |
|-------|-------|-------|--------|
| 2.1 | Migration SQL : ajouter colonnes versioning | 1j | P0 |
| 2.2 | Backfill des entités existantes | 1j | P1 |
| 2.3 | Créer `LamportClock` service | 0.5j | P2 |
| 2.4 | Créer `OriginNode` service | 0.5j | P2 |
| 2.5 | Modifier `withOutboxTransaction` | 1j | P1 |
| 2.6 | Tests E2E | 2j | P1 |

**Definition of Done:**
- [ ] Toutes les tables ont les colonnes de versioning
- [ ] Backfill complété
- [ ] Services créés et testés
- [ ] Tests E2E passent

#### S3 — Domain Services (3 semaines)

**Objectif:** Extraire la logique métier

| Étape | Tâche | Durée | Risque |
|-------|-------|-------|--------|
| 3.1 | Créer Aggregates (VoucherRequest, Subscription, Plan) | 2j | P1 |
| 3.2 | Créer `SubscriptionActivationService` | 2j | P1 |
| 3.3 | Créer `VoucherValidationService` | 1j | P1 |
| 3.4 | Créer interfaces Repository | 1j | P2 |
| 3.5 | Implémenter Repositories (SQLite + Supabase) | 2j | P2 |
| 3.6 | Refactorer routes en thin controllers | 3j | P1 |
| 3.7 | Tests unitaires (80% coverage) | 3j | P2 |
| 3.8 | Tests E2E (ancien + nouveau chemin) | 2j | P1 |

**Definition of Done:**
- [ ] Aggregates créés avec invariants
- [ ] Services créés et testés
- [ ] Repositories fonctionnels
- [ ] Routes refactorisées
- [ ] Tests E2E passent (ancien + nouveau)

#### S4 — Replication Engine (3 semaines)

**Objectif:** Enrichir la synchronisation

| Étape | Tâche | Durée | Risque |
|-------|-------|-------|--------|
| 4.1 | Créer `PushReplicator` avec idempotence | 2j | P1 |
| 4.2 | Créer `PullReplicator` avec conflict resolver | 2j | P1 |
| 4.3 | Enrichir `ConflictResolver` (8 stratégies) | 2j | P1 |
| 4.4 | Ajouter `error_category` à DLQ | 0.5j | P2 |
| 4.5 | Créer `ReplicationIdempotency` table | 1j | P1 |
| 4.6 | Tests d'intégration multi-nœuds | 3j | P1 |
| 4.7 | Tests E2E | 2j | P1 |

**Definition of Done:**
- [ ] PushReplicator : exactly-once
- [ ] PullReplicator : convergence < 5min
- [ ] ConflictResolver : 99% auto
- [ ] DLQ catégorisée
- [ ] Tests passent

#### S5 — EventBus (2 semaines)

**Objectif:** Connecter les events

| Étape | Tâche | Durée | Risque |
|-------|-------|-------|--------|
| 5.1 | Définir 8+ Domain Events | 1j | P2 |
| 5.2 | Émettre events dans services | 1j | P1 |
| 5.3 | Créer handlers (cache, audit, sync, email) | 2j | P1 |
| 5.4 | Créer `EventHandlerRegistry` | 0.5j | P2 |
| 5.5 | Tests E2E | 2j | P1 |

**Definition of Done:**
- [ ] 8+ Events définis
- [ ] Events émis dans 100% des mutations
- [ ] Handlers fonctionnels
- [ ] Cache invalidé en < 100ms
- [ ] Tests E2E passent

#### S6 — Observabilité (3 semaines)

**Objectif:** Métriques, logs, alertes

| Étape | Tâche | Durée | Risque |
|-------|-------|-------|--------|
| 6.1 | Structured logging (pino) | 1j | P1 |
| 6.2 | Correlation ID | 0.5j | P2 |
| 6.3 | 20 métriques Prometheus | 2j | P1 |
| 6.4 | Dashboard Grafana | 1j | P2 |
| 6.5 | 7 alertes | 1j | P1 |
| 6.6 | Load testing | 2j | P1 |
| 6.7 | Documentation ops | 1j | P2 |

**Definition of Done:**
- [ ] Structured logging déployé
- [ ] 20 métriques exportées
- [ ] Dashboard opérationnel
- [ ] 7 alertes configurées
- [ ] Load test : 1000 activations/s
- [ ] Documentation à jour

#### S7 — Nettoyage (1 semaine)

**Objectif:** Supprimer le code ancien

| Étape | Tâche | Durée | Risque |
|-------|-------|-------|--------|
| 7.1 | Supprimer anciennes routes | 1j | P2 |
| 7.2 | Supprimer feature flags devenues inutiles | 0.5j | P2 |
| 7.3 | Supprimer code mort | 1j | P2 |
| 7.4 | Tests de régression | 1j | P2 |

**Definition of Done:**
- [ ] Ancien code supprimé
- [ ] Feature flags supprimées
- [ ] Tests passent
- [ ] Code review effectuée
- [ ] Tag Git `legacy/subscription` créé

---

## 5. CHECKLIST DE VALIDATION

### Par Étape

- [ ] **Étape 0:** Gap Analysis validée, plan approuvé
- [ ] **Étape 1:** Bug P0 corrigé, tests passent
- [ ] **Étape 2:** Versioning implémenté, backfill complété
- [ ] **Étape 3:** Services créés, routes refactorisées
- [ ] **Étape 4:** Replication Engine enrichi
- [ ] **Étape 5:** EventBus connecté
- [ ] **Étape 6:** Observabilité complète
- [ ] **Étape 7:** Code ancien supprimé

### Globale

- [ ] Tous les tests E2E passent
- [ ] Tous les tests unitaires passent (coverage > 80%)
- [ ] Performance stable ou améliorée
- [ ] Aucune regression fonctionnelle
- [ ] Feature flags documentées
- [ ] Rollback testé et fonctionnel
- [ ] Documentation à jour
- [ ] Équipe formée
- [ ] Monitoring opérationnel
- [ ] Alertes configurées

---

## 6. TEMPLATES DE DOCUMENTATION

### Template d'ADR (Architecture Decision Record)

```markdown
# ADR-{NUMERO} : {TITRE}

**Date:** {DATE}
**Statut:** Accepté
**Contexte:** {CONTEXTE}
**Décision:** {DÉCISION}
**Conséquences:** {CONSÉQUENCES}
**Alternatives:** {ALTERNATIVES}
```

### Template de Test Plan

```markdown
# Test Plan — {COMPOSANT}

## Tests Unitaires
- [ ] Test 1
- [ ] Test 2

## Tests d'Intégration
- [ ] Test 1
- [ ] Test 2

## Tests E2E
- [ ] Test 1
- [ ] Test 2

## Tests de Performance
- [ ] Test 1
- [ ] Test 2

## Résultats
- [ ] Tous les tests passent
- [ ] Coverage > 80%
```

### Template de Rollback Plan

```markdown
# Rollback Plan — {SPRINT}

## Feature Flag
- Flag: {NOM}
- Valeur par défaut: {VALEUR}
- Rollback: désactiver le flag

## Procédure
1. Détecter le problème
2. Désactiver le flag
3. Vérifier le fonctionnement
4. Investiguer en test

## Durée estimée: {DURÉE}
```

---

*Migration Playbook v1.0 — Méthode officielle de migration vers Architecture V2.1*

*À utiliser pour tous les Bounded Contexts (Subscription, Tenant, Order, Product, Inventory, etc.)*