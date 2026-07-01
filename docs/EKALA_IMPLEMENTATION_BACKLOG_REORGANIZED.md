# 🏛️ Great Olive — Implementation Backlog Reorganized

**Document :** Backlog réorganisé pour le domaine Subscription  
**Auteur :** Lead Developer  
**Version :** 2.0  
**Date :** 27/06/2026  
**Périmètre :** Migration incrémentale vers Architecture V2.1  
**Statut :** BACKLOG RÉORGANISÉ — PRÊT POUR VALIDATION  

---

## PRINCIPE D'ORGANISATION

Les Stories sont organisées par **couches architecturales**, pas par fonctionnalités :

```
COUCHE 1 : Abstractions (nouvelles briques)
  └── Aggregates, Value Objects, Domain Events (interfaces)
  
COUCHE 2 : Infrastructure (services techniques)
  └── Repositories, Cache, EventBus, Versioning
  
COUCHE 3 : Application Services (logique métier)
  └── Use cases, orchestration
  
COUCHE 4 : Intégration (routes → services)
  └── Feature flags, double chemin
  
COUCHE 5 : Event-Driven (découplage)
  └── Domain Events, Handlers
  
COUCHE 6 : Nettoyage (suppression ancien code)
  └── Dead code elimination
```

**Règle d'or :** Aucune Story ne crée de dette technique. Chaque Story est autonome et testable.

---

## EPIC 1 : SUBSCRIPTION CONTEXT (REORGANISÉ)

**Objectif :** Migrer le domaine Subscription vers l'Architecture V2.1  
**Priorité :** P0  
**Effort total :** 22 jours  

---

### COUCHE 1 : ABSTRACTIONS

#### Story SUB-001 : Value Objects — SubscriptionStatus, VoucherStatus, PlanId

**ID :** SUB-001  
**Titre :** Créer les Value Objects du domaine Subscription  
**Priorité :** P0  
**Estimation :** S (0.5 jour)  

**Pourquoi :**
- Architecture V2.1 : DDD avec Value Objects pour les concepts métier
- Typage fort, validation, immutabilité
- Base pour tous les Aggregates

**Dépendances :** Aucune

**Fichiers concernés :**
- `src/server/domain/subscription/value-objects/SubscriptionStatus.ts` (nouveau)
- `src/server/domain/subscription/value-objects/VoucherStatus.ts` (nouveau)
- `src/server/domain/subscription/value-objects/PlanId.ts` (nouveau)

**Feature Flag :** Aucune (abstraction pure)

**Modifications attendues :**
1. Créer `SubscriptionStatus` : enum + validation des transitions
2. Créer `VoucherStatus` : enum + validation
3. Créer `PlanId` : wrapper autour de `number` avec validation

**Interface cible :**
```typescript
// SubscriptionStatus.ts
export class SubscriptionStatus {
  private constructor(private readonly value: string) {}
  
  static active(): SubscriptionStatus { return new SubscriptionStatus('active'); }
  static trial(): SubscriptionStatus { return new SubscriptionStatus('trial'); }
  static grace(): SubscriptionStatus { return new SubscriptionStatus('grace'); }
  static suspended(): SubscriptionStatus { return new SubscriptionStatus('suspended'); }
  // ...
  
  canTransitionTo(newStatus: SubscriptionStatus): boolean {
    // Logique de validation des transitions
  }
  
  toString(): string { return this.value; }
}
```

**Tests à écrire :**
- [ ] Test : `SubscriptionStatus.active()` crée une instance valide
- [ ] Test : `canTransitionTo()` valide les transitions autorisées
- [ ] Test : `canTransitionTo()` rejette les transitions invalides
- [ ] Test : `PlanId.create(0)` lève une erreur (ID invalide)

**Critères de validation (DoD) :**
- [ ] 3 Value Objects créés et fonctionnels
- [ ] Tests unitaires passent (coverage > 90%)
- [ ] Documentation API à jour
- [ ] Aucune dette technique introduite

**Risques :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Value Objects trop restrictifs | Faible | Moyen | Tests exhaustifs des transitions |

---

#### Story SUB-002 : Domain Events — Interfaces

**ID :** SUB-002  
**Titre :** Définir les interfaces de Domain Events (sans implémentation)  
**Priorité :** P0  
**Estimation :** S (0.5 jour)  

**Pourquoi :**
- Architecture V2.1 : Events pour découpler les effets secondaires
- Définir le contrat AVANT l'implémentation
- Permet aux autres Stories de dépendre d'interfaces stables

**Dépendances :** SUB-001

**Fichiers concernés :**
- `src/server/domain/subscription/events/SubscriptionEvents.ts` (nouveau)

**Feature Flag :** Aucune (interfaces pures)

**Modifications attendues :**
1. Créer les interfaces TypeScript pour 8 events :
   - `VoucherRequestSubmitted`
   - `VoucherVerified`
   - `VoucherRejected`
   - `SubscriptionActivated`
   - `SubscriptionSuspended`
   - `SubscriptionCancelled`
   - `SubscriptionExpired`
   - `SubscriptionRenewed`

**Interface cible :**
```typescript
export interface SubscriptionActivated {
  type: 'SubscriptionActivated';
  payload: {
    subscriptionId: number;
    tenantId: number;
    planId: number;
    activatedAt: string;
  };
  metadata: {
    timestamp: string;
    originNode: string;
    logicalClock: number;
    correlationId: string;
  };
}
```

**Tests à écrire :**
- [ ] Test : interfaces sont exportables et typées

**Critères de validation (DoD) :**
- [ ] 8 interfaces créées
- [ ] TypeScript compile sans erreur
- [ ] Documentation des events à jour

**Risques :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Interface incomplète | Faible | Élevé | Review par l'équipe |

---

#### Story SUB-003 : Repository Interface — ISubscriptionRepository

**ID :** SUB-003  
**Titre :** Créer l'interface Repository pour Subscription  
**Priorité :** P0  
**Estimation :** S (0.5 jour)  

**Pourquoi :**
- Architecture V2.1 : Repository pattern pour abstraction de la persistance
- Permet de switcher SQLite ↔ Supabase sans changer la logique métier
- Interface définie AVANT les implémentations

**Dépendances :** SUB-001

**Fichiers concernés :**
- `src/server/domain/subscription/repositories/ISubscriptionRepository.ts` (nouveau)

**Feature Flag :** Aucune (interface pure)

**Modifications attendues :**
1. Créer l'interface avec méthodes CRUD + queries métier

**Interface cible :**
```typescript
export interface ISubscriptionRepository {
  // CRUD
  findById(id: number): Promise<Subscription | null>;
  findByTenantId(tenantId: number): Promise<Subscription | null>;
  save(subscription: Subscription): Promise<void>;
  
  // Queries métier
  findActiveByTenantId(tenantId: number): Promise<Subscription | null>;
  findPendingActivation(tenantId: number): Promise<Subscription | null>;
}
```

**Tests à écrire :**
- [ ] Test : interface est exportable et typée

**Critères de validation (DoD) :**
- [ ] Interface créée
- [ ] TypeScript compile sans erreur
- [ ] Documentation à jour

**Risques :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Interface incomplète | Faible | Élevé | Review par l'équipe |

---

### COUCHE 2 : INFRASTRUCTURE

#### Story SUB-004 : LamportClock Service

**ID :** SUB-004  
**Titre :** Créer le service LamportClock pour l'horloge logique  
**Priorité :** P1  
**Estimation :** S (0.5 jour)  

**Pourquoi :**
- Architecture V2.1 : horloge de Lamport pour l'ordre causal
- Nécessaire pour la réplication distribuée
- Service utilitaire indépendant

**Dépendances :** Aucune

**Fichiers concernés :**
- `src/server/infrastructure/lamport-clock.service.ts` (nouveau)

**Feature Flag :** Aucune (service utilitaire)

**Modifications attendues :**
1. Créer `LamportClock` avec persistance dans `settings`

**Tests à écrire :**
- [ ] Test : `tick()` incrémente le compteur
- [ ] Test : `observe(5)` met à jour le compteur
- [ ] Test : persistance dans `settings`

**Critères de validation (DoD) :**
- [ ] Service créé et fonctionnel
- [ ] Tests passent (coverage > 80%)
- [ ] Documentation API à jour

**Risques :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Compteur pas persistant | Faible | Élevé | Tests de persistance |

---

#### Story SUB-005 : OriginNode Service

**ID :** SUB-005  
**Titre :** Créer le service OriginNode pour l'identifiant de nœud  
**Priorité :** P1  
**Estimation :** S (0.5 jour)  

**Pourquoi :**
- Architecture V2.1 : chaque nœud a un `origin_node` unique
- Prévention des boucles de réplication

**Dépendances :** Aucune

**Fichiers concernés :**
- `src/server/infrastructure/origin-node.service.ts` (nouveau)

**Feature Flag :** Aucune (service utilitaire)

**Modifications attendues :**
1. Créer `OriginNode` avec génération UUID + persistance

**Tests à écrire :**
- [ ] Test : `get()` retourne un UUID valide
- [ ] Test : `get()` est persistant

**Critères de validation (DoD) :**
- [ ] Service créé et fonctionnel
- [ ] Tests passent (coverage > 80%)
- [ ] Documentation API à jour

**Risques :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| UUID pas unique | Faible | Élevé | Utiliser `crypto.randomUUID()` |

---

#### Story SUB-006 : SubscriptionStatusReadModel

**ID :** SUB-006  
**Titre :** Créer le Read Model pour le statut d'abonnement  
**Priorité :** P1  
**Estimation :** M (1 jour)  

**Pourquoi :**
- Architecture V2.1 : CQRS — séparation lecture/écriture
- Centraliser la logique de lecture du statut
- Optimiser les lectures (cache + DB)

**Dépendances :** SUB-001, SUB-004, SUB-005

**Fichiers concernés :**
- `src/server/domain/subscription/read-models/SubscriptionStatusReadModel.ts` (nouveau)

**Feature Flag :** Aucune (nouveau composant)

**Modifications attendues :**
1. Créer l'interface `SubscriptionStatusReadModel`
2. Créer le service qui lit depuis le cache (ou DB si cache miss)
3. Utiliser `LamportClock` et `OriginNode` pour les métadonnées

**Interface cible :**
```typescript
export interface SubscriptionStatusReadModel {
  tenantId: number;
  state: 'active' | 'trial' | 'grace' | 'suspended' | 'cancelled' | 'expired' | 'no_plan' | 'pending';
  planName: string | null;
  planId: number | null;
  daysUntilRenewal: number | null;
  isExpired: boolean;
  isGracePeriod: boolean;
  graceDaysRemaining: number | null;
  subscriptionId: number | null;
  cachedAt: number;
  // Métadonnées V2.1
  entityVersion: number;
  originNode: string;
  logicalClock: number;
}
```

**Tests à écrire :**
- [ ] Test : `get()` retourne le bon statut pour un tenant actif
- [ ] Test : `get()` retourne `null` pour un tenant sans abonnement
- [ ] Test : cache hit → retourne depuis cache
- [ ] Test : cache miss → lit depuis DB, peuple le cache

**Critères de validation (DoD) :**
- [ ] Read Model créé et fonctionnel
- [ ] Tests passent (coverage > 80%)
- [ ] Documentation API à jour

**Risques :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Logique de lecture incorrecte | Moyenne | Élevé | Tests exhaustifs |

---

### COUCHE 3 : APPLICATION SERVICES

#### Story SUB-007 : SubscriptionAggregate

**ID :** SUB-007  
**Titre :** Créer l'Aggregate Subscription avec invariants  
**Priorité :** P0  
**Estimation :** M (1 jour)  

**Pourquoi :**
- Architecture V2.1 : DDD — Aggregate pour encapsuler la logique métier
- Invariants : un tenant ne peut avoir qu'un seul abonnement actif
- Base pour les Application Services

**Dépendances :** SUB-001, SUB-003

**Fichiers concernés :**
- `src/server/domain/subscription/aggregates/Subscription.ts` (nouveau)

**Feature Flag :** Aucune (domaine pur)

**Modifications attendues :**
1. Créer l'Aggregate `Subscription` avec invariants
2. Méthodes métier : `activate()`, `suspend()`, `cancel()`, `renew()`
3. Validation des transitions d'état

**Interface cible :**
```typescript
export class Subscription {
  constructor(
    private id: number,
    private tenantId: number,
    private planId: number,
    private status: SubscriptionStatus,
    private entityVersion: number,
    private originNode: string,
    private logicalClock: number,
    // ...
  ) {}
  
  activate(): Result<Subscription> {
    if (!this.status.canTransitionTo(SubscriptionStatus.active())) {
      return Result.fail('Cannot activate from current state');
    }
    this.status = SubscriptionStatus.active();
    this.entityVersion++;
    this.logicalClock++;
    return Result.ok(this);
  }
  
  // Invariant : vérifié dans le constructeur
  private validateInvariants(): void {
    if (this.status === SubscriptionStatus.active()) {
      // Vérifier qu'il n'y a pas d'autre abonnement actif pour ce tenant
    }
  }
}
```

**Tests à écrire :**
- [ ] Test : `activate()` depuis `pending` → succès
- [ ] Test : `activate()` depuis `active` → échec (invariant)
- [ ] Test : `suspend()` depuis `active` → succès
- [ ] Test : invariants vérifiés

**Critères de validation (DoD) :**
- [ ] Aggregate créé avec invariants
- [ ] Tests unitaires passent (coverage > 80%)
- [ ] Documentation domaine à jour

**Risques :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Invariants incorrects | Moyenne | Critique | Tests exhaustifs + review pair |

---

#### Story SUB-008 : SubscriptionRepositoryImpl — SQLite

**ID :** SUB-008  
**Titre :** Implémenter ISubscriptionRepository pour SQLite  
**Priorité :** P1  
**Estimation :** M (1 jour)  

**Pourquoi :**
- Architecture V2.1 : Repository pattern — implémentation SQLite
- Abstrait l'accès aux données
- Permet de tester sans DB réelle

**Dépendances :** SUB-003, SUB-007

**Fichiers concernés :**
- `src/server/infrastructure/repositories/sqlite/SqliteSubscriptionRepository.ts` (nouveau)

**Feature Flag :** Aucune (infrastructure)

**Modifications attendues :**
1. Implémenter `ISubscriptionRepository` pour SQLite
2. Utiliser le `db` singleton
3. Mapper les lignes SQLite → Aggregate `Subscription`

**Tests à écrire :**
- [ ] Test : `findById()` retourne l'aggregate
- [ ] Test : `save()` persiste l'aggregate
- [ ] Test : `findActiveByTenantId()` retourne le bon abonnement

**Critères de validation (DoD) :**
- [ ] Repository créé et fonctionnel
- [ ] Tests passent (coverage > 80%)
- [ ] Documentation API à jour

**Risques :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Mapping incorrect | Moyenne | Élevé | Tests d'intégration |

---

#### Story SUB-009 : SubscriptionApplicationService

**ID :** SUB-009  
**Titre :** Créer le Application Service pour les use cases Subscription  
**Priorité :** P0  
**Estimation :** L (2 jours)  

**Pourquoi :**
- Architecture V2.1 : Application Service orchestre les use cases
- Contient la logique métier de haut niveau
- Utilise les Aggregates et Repositories

**Dépendances :** SUB-007, SUB-008

**Fichiers concernés :**
- `src/server/application/subscription/SubscriptionApplicationService.ts` (nouveau)

**Feature Flag :** Aucune (nouveau composant)

**Modifications attendues :**
1. Créer le service avec méthodes :
   - `activateSubscription(tenantId, planId, adminUserId): Promise<Result>`
   - `suspendSubscription(tenantId, reason): Promise<Result>`
   - `cancelSubscription(tenantId): Promise<Result>`
2. Utiliser `ISubscriptionRepository`
3. Émettre des logs structurés

**Interface cible :**
```typescript
export class SubscriptionApplicationService {
  constructor(
    private subscriptionRepo: ISubscriptionRepository,
    private eventBus: EventBus,
    private lamportClock: LamportClock,
    private originNode: OriginNode,
  ) {}
  
  async activateSubscription(
    tenantId: number, 
    planId: number, 
    adminUserId: number | null
  ): Promise<Result<Subscription>> {
    // 1. Charger l'abonnement
    const subscription = await this.subscriptionRepo.findActiveByTenantId(tenantId);
    
    // 2. Appliquer la logique métier
    const result = subscription.activate();
    if (result.isFailure) return Result.fail(result.error);
    
    // 3. Persister
    await this.subscriptionRepo.save(result.value);
    
    // 4. Émettre l'event (pour l'instant, juste log)
    console.log('[Event] SubscriptionActivated', {
      subscriptionId: result.value.id,
      tenantId,
      planId,
    });
    
    return Result.ok(result.value);
  }
}
```

**Tests à écrire :**
- [ ] Test : `activateSubscription()` active l'abonnement
- [ ] Test : `activateSubscription()` échoue si déjà actif
- [ ] Test : `suspendSubscription()` suspend l'abonnement
- [ ] Test : `cancelSubscription()` annule l'abonnement

**Critères de validation (DoD) :**
- [ ] Service créé et fonctionnel
- [ ] Tests unitaires passent (coverage > 80%)
- [ ] Documentation API à jour
- [ ] Aucune dette technique

**Risques :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Logique métier incorrecte | Moyenne | Critique | Tests exhaustifs + review pair |

---

### COUCHE 4 : INTÉGRATION

#### Story SUB-010 : Feature Flag — Double chemin routes

**ID :** SUB-010  
**Titre :** Ajouter feature flag pour basculer entre ancien/nouveau chemin  
**Priorité :** P1  
**Estimation :** M (1 jour)  

**Pourquoi :**
- Architecture V2.1 : déploiement progressif avec feature flags
- Permettre de basculer entre ancien et nouveau code
- Rollback immédiat en cas de problème

**Dépendances :** SUB-009

**Fichiers concernés :**
- `src/server/routes/admin.subscriptions.ts` (modification)
- `src/lib/feature-flags.ts` (création)

**Feature Flag :** `USE_SUBSCRIPTION_APPLICATION_SERVICE` (défaut: false)

**Modifications attendues :**
1. Créer `feature-flags.ts` avec tous les flags nécessaires
2. Modifier `admin.subscriptions.ts` :
   - Si flag = false : ancien comportement (inchangé)
   - Si flag = true : nouveau comportement (utilise `SubscriptionApplicationService`)
3. Les deux chemins coexistent, aucun n'est supprimé

**Code cible :**
```typescript
// admin.subscriptions.ts
import { FeatureFlags } from '../../lib/feature-flags';

router.post('/verify', async (req: Request, res: Response) => {
  // ... validation ...
  
  if (FeatureFlags.USE_SUBSCRIPTION_APPLICATION_SERVICE) {
    // Nouveau chemin
    const result = await subscriptionAppService.activateSubscription(
      requestRow.tenant_id,
      requestRow.plan_id,
      adminUserId
    );
    if (result.isFailure) {
      return res.status(500).json({ error: result.error });
    }
  } else {
    // Ancien chemin (inchangé)
    await activateTenantSub(requestRow.tenant_id, requestRow.plan_id, adminUserId, nowISO);
  }
  
  res.json({ ok: true, message: 'Demande vérifiée.' });
});
```

**Tests à écrire :**
- [ ] Test : flag = false → ancien comportement
- [ ] Test : flag = true → nouveau comportement
- [ ] Test : les deux chemins produisent le même résultat

**Critères de validation (DoD) :**
- [ ] Feature flag créée et fonctionnelle
- [ ] Double chemin fonctionne
- [ ] Tests passent (ancien + nouveau)
- [ ] Rollback testé (désactiver flag)

**Risques :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Double chemin source de confusion | Moyenne | Moyen | Feature flag + monitoring |
| Regression ancien chemin | Faible | Élevé | Tests E2E complets |

---

### COUCHE 5 : EVENT-DRIVEN

#### Story SUB-011 : EventBus Infrastructure

**ID :** SUB-011  
**Titre :** Créer l'infrastructure EventBus (si absente)  
**Priorité :** P1  
**Estimation :** M (1 jour)  

**Pourquoi :**
- Architecture V2.1 : EventBus pour découpler les effets secondaires
- Nécessaire pour les Domain Events
- Infrastructure partagée par tous les domaines

**Dépendances :** Aucune

**Fichiers concernés :**
- `src/server/infrastructure/event-bus.service.ts` (création ou enrichment)

**Feature Flag :** Aucune (infrastructure)

**Modifications attendues :**
1. Vérifier si EventBus existe déjà
2. Si non, créer un EventBus simple (in-memory pour commencer)
3. Interface : `emit(event)`, `on(eventType, handler)`, `off(eventType, handler)`

**Interface cible :**
```typescript
export interface EventBus {
  emit<T>(event: DomainEvent<T>): Promise<void>;
  on<T>(eventType: string, handler: (event: DomainEvent<T>) => Promise<void>): void;
  off<T>(eventType: string, handler: (event: DomainEvent<T>) => Promise<void>): void;
}

export interface DomainEvent<T> {
  type: string;
  payload: T;
  metadata: {
    timestamp: string;
    originNode: string;
    logicalClock: number;
    correlationId: string;
  };
}
```

**Tests à écrire :**
- [ ] Test : `emit()` → `on()` reçoit l'event
- [ ] Test : `off()` supprime le handler
- [ ] Test : multiple handlers pour même event

**Critères de validation (DoD) :**
- [ ] EventBus créé et fonctionnel
- [ ] Tests passent (coverage > 80%)
- [ ] Documentation API à jour

**Risques :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| EventBus pas scalable | Faible | Moyen | Commencer in-memory, prévoir migration Redis |

---

#### Story SUB-012 : Domain Events — Émission

**ID :** SUB-012  
**Titre :** Émettre les Domain Events depuis SubscriptionApplicationService  
**Priorité :** P2  
**Estimation :** M (1 jour)  

**Pourquoi :**
- Architecture V2.1 : toute mutation émet un Domain Event
- Découpler les effets secondaires (cache, audit, sync, email)
- Les events sont émis mais les handlers ne s'exécutent pas encore (flag = false)

**Dépendances :** SUB-002, SUB-009, SUB-011

**Fichiers concernés :**
- `src/server/application/subscription/SubscriptionApplicationService.ts` (modification)

**Feature Flag :** `ENABLE_SUBSCRIPTION_EVENTS` (défaut: false)

**Modifications attendues :**
1. Importer `EventBus` et les interfaces d'events
2. Après chaque mutation, émettre l'event correspondant
3. Si flag = false : les events sont émis mais aucun handler ne s'exécute

**Code cible :**
```typescript
async activateSubscription(tenantId, planId, adminUserId): Promise<Result> {
  // ... logique métier ...
  
  const result = await this.subscriptionRepo.save(subscription);
  
  // Émettre l'event (seulement si flag activé)
  if (FeatureFlags.ENABLE_SUBSCRIPTION_EVENTS) {
    await this.eventBus.emit({
      type: 'SubscriptionActivated',
      payload: {
        subscriptionId: subscription.id,
        tenantId,
        planId,
        activatedAt: new Date().toISOString(),
      },
      metadata: {
        timestamp: new Date().toISOString(),
        originNode: await this.originNode.get(),
        logicalClock: this.lamportClock.tick(),
        correlationId: this.correlationId,
      },
    });
  }
  
  return Result.ok(subscription);
}
```

**Tests à écrire :**
- [ ] Test : `activateSubscription()` émet `SubscriptionActivated`
- [ ] Test : event contient les bonnes métadonnées
- [ ] Test : flag = false → event émis mais pas de handler

**Critères de validation (DoD) :**
- [ ] Events émis dans 100% des mutations
- [ ] Tests passent
- [ ] Feature flag fonctionnelle

**Risques :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Event mal formé | Moyenne | Élevé | Validation stricte |
| Performance (émission sync) | Faible | Moyen | EventBus asynchrone |

---

#### Story SUB-013 : Event Handlers — Cache Invalidation

**ID :** SUB-013  
**Titre :** Créer le handler d'invalidation de cache  
**Priorité :** P1  
**Estimation :** S (0.5 jour)  

**Pourquoi :**
- Architecture V2.1 : Event Handlers pour les effets secondaires
- Invalider le cache quand un abonnement est modifié
- Découpler la logique de cache de la logique métier

**Dépendances :** SUB-006, SUB-012

**Fichiers concernés :**
- `src/server/infrastructure/event-handlers/CacheInvalidationHandler.ts` (nouveau)

**Feature Flag :** `ENABLE_CACHE_INVALIDATION_HANDLERS` (défaut: false)

**Modifications attendues :**
1. Créer `CacheInvalidationHandler` qui écoute les events Subscription
2. Appelle `invalidateSubscriptionCache()` quand nécessaire
3. Enregistrer le handler dans `EventHandlerRegistry`

**Code cible :**
```typescript
export class CacheInvalidationHandler {
  constructor(private subscriptionCache: SubscriptionStatusCache) {}
  
  @OnEvent('SubscriptionActivated')
  async onSubscriptionActivated(event: SubscriptionActivated): Promise<void> {
    this.subscriptionCache.invalidate(event.payload.tenantId);
  }
  
  @OnEvent('SubscriptionSuspended')
  async onSubscriptionSuspended(event: SubscriptionSuspended): Promise<void> {
    this.subscriptionCache.invalidate(event.payload.tenantId);
  }
  
  // ... autres handlers
}
```

**Tests à écrire :**
- [ ] Test : `onSubscriptionActivated()` invalide le cache
- [ ] Test : `onSubscriptionSuspended()` invalide le cache

**Critères de validation (DoD) :**
- [ ] Handler créé et fonctionnel
- [ ] Tests passent (coverage > 80%)
- [ ] Feature flag fonctionnelle

**Risques :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Handler en erreur bloque les autres | Moyenne | Élevé | Try/catch dans chaque handler |
| Race condition | Moyenne | Moyen | Tests de concurrence |

---

#### Story SUB-014 : EventHandlerRegistry

**ID :** SUB-014  
**Titre :** Créer le registre centralisé des Event Handlers  
**Priorité :** P2  
**Estimation :** S (0.5 jour)  

**Pourquoi :**
- Architecture V2.1 : configuration centralisée des handlers
- Faciliter l'ajout de nouveaux handlers
- Éviter la dispersion des enregistrements

**Dépendances :** SUB-013

**Fichiers concernés :**
- `src/server/infrastructure/event-handlers/EventHandlerRegistry.ts` (nouveau)

**Feature Flag :** Aucune (infrastructure)

**Modifications attendues :**
1. Créer `EventHandlerRegistry` qui enregistre tous les handlers
2. Appelé au démarrage de l'application

**Code cible :**
```typescript
export class EventHandlerRegistry {
  constructor(private eventBus: EventBus) {}
  
  registerAll(): void {
    // Cache invalidation
    const cacheHandler = new CacheInvalidationHandler(this.subscriptionCache);
    this.eventBus.on('SubscriptionActivated', cacheHandler.onSubscriptionActivated);
    this.eventBus.on('SubscriptionSuspended', cacheHandler.onSubscriptionSuspended);
    
    // Audit
    const auditHandler = new AuditHandler();
    this.eventBus.on('SubscriptionActivated', auditHandler.onSubscriptionActivated);
    
    // Sync
    const syncHandler = new SyncHandler();
    this.eventBus.on('SubscriptionActivated', syncHandler.onSubscriptionActivated);
    
    // Email
    const emailHandler = new EmailHandler();
    this.eventBus.on('SubscriptionActivated', emailHandler.onSubscriptionActivated);
  }
}
```

**Tests à écrire :**
- [ ] Test : `registerAll()` enregistre tous les handlers

**Critères de validation (DoD) :**
- [ ] Registry créé et fonctionnel
- [ ] Tests passent
- [ ] Documentation à jour

**Risques :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Oubli d'enregistrer un handler | Faible | Élevé | Tests qui vérifient tous les handlers |

---

### COUCHE 6 : NETTOYAGE

#### Story SUB-015 : Suppression ancien code — activateTenantSub

**ID :** SUB-015  
**Titre :** Supprimer `activateTenantSub` et migrer vers SubscriptionApplicationService  
**Priorité :** P2  
**Estimation :** M (1 jour)  

**Pourquoi :**
- Architecture V2.1 : supprimer le code legacy après validation
- Éviter la duplication
- Nettoyer la codebase

**Dépendances :** SUB-010 (feature flag validée depuis 2 semaines)

**Fichiers concernés :**
- `src/server/routes/admin.subscriptions.ts` (suppression de `activateTenantSub`)
- `src/server/routes/admin.subscriptions.ts` (suppression ancien chemin)

**Feature Flag :** `USE_SUBSCRIPTION_APPLICATION_SERVICE` doit être = true depuis 2 semaines

**Modifications attendues :**
1. Supprimer la fonction `activateTenantSub()`
2. Supprimer le chemin ancien (flag = false)
3. Garder seulement le nouveau chemin
4. Supprimer la feature flag

**Critères de validation (DoD) :**
- [ ] Ancien code supprimé
- [ ] Feature flag supprimée
- [ ] Tests E2E passent
- [ ] Code review effectuée
- [ ] Tag Git `legacy/subscription` créé

**Risques :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Code supprimé trop tôt | Faible | Critique | Attendre 2 semaines de stabilité |
| Regression | Faible | Élevé | Tests exhaustifs |

---

## ORDRE D'IMPLÉMENTATION RECOMMANDÉ

### Phase 1 : Fondations (P0)
1. **SUB-001** : Value Objects (S)
2. **SUB-002** : Domain Events interfaces (S)
3. **SUB-003** : Repository interface (S)
4. **SUB-007** : SubscriptionAggregate (M)
5. **SUB-008** : SqliteSubscriptionRepository (M)
6. **SUB-009** : SubscriptionApplicationService (L)

**Effort :** 5 jours  
**Impact :** Crée toutes les abstractions métier

### Phase 2 : Intégration (P1)
7. **SUB-010** : Feature flag double chemin (M)
8. **SUB-004** : LamportClock (S)
9. **SUB-005** : OriginNode (S)
10. **SUB-006** : SubscriptionStatusReadModel (M)

**Effort :** 3.5 jours  
**Impact :** Intègre les nouvelles abstractions sans casser l'existant

### Phase 3 : Event-Driven (P1-P2)
11. **SUB-011** : EventBus infrastructure (M)
12. **SUB-012** : Domain Events émission (M)
13. **SUB-013** : Cache invalidation handler (S)
14. **SUB-014** : EventHandlerRegistry (S)

**Effort :** 3.5 jours  
**Impact :** Découple les effets secondaires

### Phase 4 : Nettoyage (P2)
15. **SUB-015** : Suppression ancien code (M)

**Effort :** 1 jour  
**Impact :** Nettoie la codebase

---

## AVANTAGES DE CETTE RÉORGANISATION

✅ **Pas de dette technique** : Chaque Story est propre et conforme V2.1  
✅ **Dépendances claires** : Chaque Story sait ce dont elle dépend  
✅ **Testable indépendamment** : Chaque Story peut être testée seule  
✅ **Rollback simple** : Feature flags sur chaque intégration  
✅ **Progressive** : On peut s'arrêter après chaque phase  
✅ **Architecture-first** : Les abstractions sont créées AVANT l'implémentation  

---

## COMPARAISON AVEC ANCIEN BACKLOG

| Ancien | Nouveau | Raison du changement |
|--------|---------|---------------------|
| SUB-001 : Cache invalidation dans route | SUB-013 : Event Handler | Cache invalidation doit être découplée (Event-Driven) |
| SUB-003 : Unifier connexions SQLite | Supprimé | Technique, pas métier |
| SUB-004 : Idempotence middleware | Reporté (autre Epic) | Pas spécifique à Subscription |
| SUB-006 : ReadModel | SUB-006 (conservé) | Conservé, déplacé dans Infrastructure |
| SUB-007 : GET /auth/me | Reporté (Auth Epic) | Pas spécifique à Subscription |
| SUB-008 : Retirer status JWT | Reporté (Auth Epic) | Pas spécifique à Subscription |
| SUB-009 : useSubscriptionStatus | Reporté (Frontend Epic) | Pas spécifique à Subscription |
| SUB-010 : Domain Events | SUB-002 + SUB-012 | Séparé en interfaces (SUB-002) et émission (SUB-012) |
| SUB-011 : Entity Versioning | SUB-004 + SUB-005 | LamportClock + OriginNode |
| SUB-013 : LamportClock | SUB-004 | Conservé, réordonné |
| SUB-014 : OriginNode | SUB-005 | Conservé, réordonné |
| SUB-015 : withOutboxTransaction | Reporté (Replication Epic) | Pas spécifique à Subscription |

---

*Backlog réorganisé v2.0 — Prêt pour validation*

*Une fois validé, implémentation story par story dans l'ordre indiqué*