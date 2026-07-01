# 🏛️ Great Olive — Implementation Backlog

**Document :** Backlog d'implémentation vers Architecture V2.1  
**Auteur :** Lead Developer  
**Version :** 1.0  
**Date :** 27/06/2026  
**Périmètre :** Migration incrémentale du code existant vers V2.1  
**Statut :** BACKLOG OFFICIEL — À IMPLÉMENTER STORY PAR STORY  

---

## TABLE DES MATIÈRES

1. [STRUCTURE DU BACKLOG](#1-structure-du-backlog)
2. [EPIC 1 : SUBSCRIPTION CONTEXT](#2-epic-1--subscription-context)
3. [EPIC 2 : TENANT CONTEXT](#3-epic-2--tenant-context)
4. [EPIC 3 : ORDER CONTEXT](#4-epic-3--order-context)
5. [EPIC 4 : REPLICATION ENGINE](#5-epic-4--replication-engine)
6. [EPIC 5 : OBSERVABILITY](#6-epic-5--observability)

---

## 1. STRUCTURE DU BACKLOG

### 1.1 Organisation

```
Epic (domaine métier)
  └── Story (fonctionnalité utilisateur)
       └── Tasks (tâches techniques)
```

### 1.2 Priorisation

| Priorité | Description |
|----------|-------------|
| **P0** | Bloque les utilisateurs — à implémenter en premier |
| **P1** | Important — améliore significativement l'expérience |
| **P2** | Amélioration — optimise la maintenabilité |
| **P3** | Nice-to-have — peut être reporté |

### 1.3 Estimation

| Taille | Durée | Description |
|--------|-------|-------------|
| **XS** | 1-2h | Modification simple, 1-2 fichiers |
| **S** | 0.5-1j | Modification ciblée, 2-3 fichiers |
| **M** | 1-2j | Modification moyenne, 3-5 fichiers |
| **L** | 2-3j | Modification importante, 5-10 fichiers |
| **XL** | 3-5j | Refactor majeur, 10+ fichiers |

---

## 2. EPIC 1 : SUBSCRIPTION CONTEXT

**Objectif :** Migrer le domaine Subscription vers l'Architecture V2.1  
**Priorité :** P0 (bloque les utilisateurs aujourd'hui)  
**Effort total estimé :** 23 jours  

---

### Story SUB-001 : Cache Invalidation — Activation

**ID :** SUB-001  
**Titre :** Ajouter `invalidateSubscriptionCache()` après activation d'abonnement  
**Priorité :** P0  
**Estimation :** S (0.5 jour)  

**Pourquoi cette Story existe :**
- Bug critique : après activation d'un voucher, le tenant voit "SUBSCRIPTION_REQUIRED" pendant 5 minutes (TTL du cache)
- Le cache n'est jamais invalidé après les mutations
- Bloque les nouveaux clients

**Dépendances :** Aucune

**Fichiers concernés :**
- `src/server/routes/admin.subscriptions.ts` (ligne ~220)
- `src/server/middleware/subscription-guard.ts` (déjà existe)

**Feature Flag :** `ENABLE_CACHE_INVALIDATION` (défaut: false)

**Modifications attendues :**
1. Importer `invalidateSubscriptionCache` dans `admin.subscriptions.ts`
2. Appeler `invalidateSubscriptionCache(tenantId)` après `UPDATE tenants SET status = 'active'`
3. Appeler `invalidateSubscriptionCache(tenantId)` après `UPDATE subscriptions SET status = 'active'`

**Tests à écrire :**
- [ ] Test manuel : admin valide voucher → tenant se reconnecte → voit "active" immédiatement
- [ ] Test E2E : workflow activation complet

**Critères de validation (DoD) :**
- [ ] Bug "SUBSCRIPTION_REQUIRED après activation" corrigé
- [ ] Tenant voit "active" en < 5s après activation
- [ ] Aucune regression sur les fonctionnalités existantes
- [ ] Feature flag fonctionnelle
- [ ] Rollback testé (désactiver flag → comportement ancien)

**Risques connus :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Cache invalidation échoue silencieusement | Faible | Élevé | Log + monitoring |
| Performance dégradée | Faible | Moyen | Mesurer latence avant/après |

---

### Story SUB-002 : Cache Invalidation — Voucher Verify/Reject

**ID :** SUB-002  
**Titre :** Ajouter `invalidateSubscriptionCache()` après verify/reject voucher  
**Priorité :** P0  
**Estimation :** S (0.5 jour)  

**Pourquoi cette Story existe :**
- Cohérence : toute mutation sur subscription/tenant doit invalider le cache
- SUB-001 ne couvre que l'activation, il faut aussi couvrir verify et reject

**Dépendances :** SUB-001

**Fichiers concernés :**
- `src/server/routes/admin.subscriptions.ts` (ligne ~150 pour verify, ~255 pour reject)

**Feature Flag :** `ENABLE_CACHE_INVALIDATION` (défaut: false)

**Modifications attendues :**
1. Appeler `invalidateSubscriptionCache(tenantId)` dans `verifyVoucher` après mise à jour
2. Appeler `invalidateSubscriptionCache(tenantId)` dans `rejectVoucher` après mise à jour

**Tests à écrire :**
- [ ] Test manuel : admin verify voucher → cache invalidé
- [ ] Test manuel : admin reject voucher → cache invalidé

**Critères de validation (DoD) :**
- [ ] Cache invalidé après verify
- [ ] Cache invalidé après reject
- [ ] Tests passent
- [ ] Feature flag fonctionnelle

**Risques connus :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Oubli d'un endpoint | Moyenne | Élevé | Review de code + tests |

---

### Story SUB-003 : Unifier Connexions SQLite

**ID :** SUB-003  
**Titre :** Utiliser le singleton `db` dans `subscription-guard.ts`  
**Priorité :** P0  
**Estimation :** S (0.5 jour)  

**Pourquoi cette Story existe :**
- `subscription-guard.ts` ouvre sa propre connexion SQLite
- Crée une race condition : le middleware peut lire des données obsolètes
- Violation du principe "SQLite est la Source of Truth" (connexion unique)

**Dépendances :** Aucune

**Fichiers concernés :**
- `src/server/middleware/subscription-guard.ts` (ligne ~104-107)

**Feature Flag :** Aucune (correction technique)

**Modifications attendues :**
1. Importer `db` depuis `../db/database` au lieu de créer une nouvelle connexion
2. Supprimer la création de connexion locale
3. Utiliser `db` pour toutes les requêtes

**Tests à écrire :**
- [ ] Test manuel : activation voucher → middleware lit le bon statut
- [ ] Test de charge : 100 requêtes simultanées → pas de race condition

**Critères de validation (DoD) :**
- [ ] `subscription-guard.ts` utilise le singleton `db`
- [ ] Aucune race condition détectée
- [ ] Tests passent
- [ ] Performance stable

**Risques connus :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Connexion fermée | Faible | Élevé | Vérifier que `db` est initialisé avant le middleware |

---

### Story SUB-004 : Idempotence — POST /verify

**ID :** SUB-004  
**Titre :** Ajouter idempotence sur la route POST /verify  
**Priorité :** P0  
**Estimation :** M (1 jour)  

**Pourquoi cette Story existe :**
- Double-clic ou retry réseau peut causer des activations en double
- Pas de garantie d'idempotence sur les mutations critiques

**Dépendances :** Aucune

**Fichiers concernés :**
- `src/server/routes/admin.subscriptions.ts` (route POST /verify)
- Nouveau fichier : `src/server/middleware/idempotency.middleware.ts`

**Feature Flag :** `ENABLE_IDEMPOTENCE` (défaut: false)

**Modifications attendues :**
1. Créer `IdempotencyMiddleware` qui lit le header `Idempotency-Key`
2. Vérifier si la clé a déjà été traitée (table `idempotency_keys`)
3. Si oui : retourner la réponse précédente
4. Si non : laisser passer la requête, enregistrer la clé après succès

**Tests à écrire :**
- [ ] Test : POST /verify avec même `Idempotency-Key` 2 fois → 2ème retourne même réponse
- [ ] Test : POST /verify sans `Idempotency-Key` → fonctionne quand même
- [ ] Test : POST /verify avec clé expirée → traité comme nouveau

**Critères de validation (DoD) :**
- [ ] Middleware créé et fonctionnel
- [ ] Table `idempotency_keys` créée
- [ ] Tests passent
- [ ] Feature flag fonctionnelle
- [ ] Rollback testé

**Risques connus :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Clé idempotence mal gérée | Moyenne | Élevé | Tests exhaustifs |
| Performance (lecture table) | Faible | Moyen | Index sur `idempotency_key` |

---

### Story SUB-005 : Idempotence — POST /reject

**ID :** SUB-005  
**Titre :** Ajouter idempotence sur la route POST /reject  
**Priorité :** P0  
**Estimation :** S (0.5 jour)  

**Pourquoi cette Story existe :**
- Cohérence avec SUB-004
- Même problème de double-clic sur reject

**Dépendances :** SUB-004

**Fichiers concernés :**
- `src/server/routes/admin.subscriptions.ts` (route POST /reject)

**Feature Flag :** `ENABLE_IDEMPOTENCE` (défaut: false)

**Modifications attendues :**
1. Appliquer `IdempotencyMiddleware` sur la route POST /reject

**Tests à écrire :**
- [ ] Test : POST /reject avec même clé 2 fois → 2ème retourne même réponse

**Critères de validation (DoD) :**
- [ ] Middleware appliqué sur /reject
- [ ] Tests passent
- [ ] Feature flag fonctionnelle

**Risques connus :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Oubli d'appliquer le middleware | Faible | Élevé | Review de code |

---

### Story SUB-006 : SubscriptionStatusReadModel

**ID :** SUB-006  
**Titre :** Créer le Read Model pour le statut d'abonnement  
**Priorité :** P1  
**Estimation :** M (1 jour)  

**Pourquoi cette Story existe :**
- Préparer le terrain pour retirer le business state du JWT
- Centraliser la logique de lecture du statut d'abonnement
- Optimiser les lectures (cache + DB)

**Dépendances :** SUB-001, SUB-002, SUB-003

**Fichiers concernés :**
- Nouveau fichier : `src/server/domain/subscription/read-models/SubscriptionStatusReadModel.ts`

**Feature Flag :** Aucune (nouveau composant, pas d'impact)

**Modifications attendues :**
1. Créer l'interface `SubscriptionStatusReadModel`
2. Créer le service qui lit depuis le cache (ou DB si cache miss)
3. Exposer une méthode `get(tenantId: number): Promise<SubscriptionStatusReadModel | null>`

**Interface cible :**
```typescript
interface SubscriptionStatusReadModel {
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
}
```

**Tests à écrire :**
- [ ] Test unitaire : `get()` retourne le bon statut pour un tenant actif
- [ ] Test unitaire : `get()` retourne `null` pour un tenant sans abonnement
- [ ] Test d'intégration : cache hit → retourne depuis cache
- [ ] Test d'intégration : cache miss → lit depuis DB, peuple le cache

**Critères de validation (DoD) :**
- [ ] Read Model créé et fonctionnel
- [ ] Tests unitaires passent (coverage > 80%)
- [ ] Tests d'intégration passent
- [ ] Documentation API à jour

**Risques connus :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Logique de lecture incorrecte | Moyenne | Élevé | Tests exhaustifs |
| Performance dégradée | Faible | Moyen | Benchmark |

---

### Story SUB-007 : GET /auth/me lit depuis ReadModel

**ID :** SUB-007  
**Titre :** Modifier `GET /auth/me` pour retourner le statut depuis SubscriptionStatusReadModel  
**Priorité :** P1  
**Estimation :** M (1 jour)  

**Pourquoi cette Story existe :**
- Le JWT ne doit plus contenir de business state (ADR-003)
- `GET /auth/me` doit être la source de vérité pour le statut utilisateur
- Permet de retirer `status` du JWT progressivement

**Dépendances :** SUB-006

**Fichiers concernés :**
- `src/server/routes/auth.routes.ts` (route GET /auth/me)
- `src/server/services/auth.service.ts` (logique de lecture)

**Feature Flag :** `USE_READMODEL_FOR_STATUS` (défaut: false)

**Modifications attendues :**
1. Importer `SubscriptionStatusReadModel` dans `auth.service.ts`
2. Dans `GET /auth/me`, après avoir lu l'utilisateur :
   - Si `USE_READMODEL_FOR_STATUS = true` : lire le statut depuis `SubscriptionStatusReadModel`
   - Si `USE_READMODEL_FOR_STATUS = false` : garder l'ancien comportement (lire depuis JWT)
3. Retourner le statut dans la réponse

**Tests à écrire :**
- [ ] Test E2E : GET /auth/me retourne le statut à jour
- [ ] Test : feature flag false → ancien comportement
- [ ] Test : feature flag true → nouveau comportement

**Critères de validation (DoD) :**
- [ ] Route modifiée
- [ ] Tests passent (ancien + nouveau chemin)
- [ ] Feature flag fonctionnelle
- [ ] Rollback testé

**Risques connus :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Regression sur GET /auth/me | Faible | Élevé | Tests E2E complets |
| Performance dégradée | Faible | Moyen | Mesurer latence |

---

### Story SUB-008 : Retirer status du JWT

**ID :** SUB-008  
**Titre :** Retirer `status` et `expires_at` du payload JWT  
**Priorité :** P1  
**Estimation :** L (2 jours)  

**Pourquoi cette Story existe :**
- ADR-003 : JWT ne doit contenir que l'identité, pas de business state
- Le statut devient obsolète après activation (problème principal)
- Double lecture (JWT + DB) pendant la transition

**Dépendances :** SUB-007

**Fichiers concernés :**
- `src/server/services/jwt-auth.ts` (génération du JWT)
- `src/server/middleware/auth.middleware.ts` (lecture du JWT)
- `src/stores/useAuthStore.ts` (frontend)

**Feature Flag :** `USE_JWT_WITHOUT_STATUS` (défaut: false)

**Modifications attendues :**
1. Modifier `jwt-auth.ts` :
   - Si `USE_JWT_WITHOUT_STATUS = false` : inclure `status` et `expires_at` (ancien comportement)
   - Si `USE_JWT_WITHOUT_STATUS = true` : ne inclure que `sub`, `tenant_id`, `role`
2. Modifier `auth.middleware.ts` :
   - Si `USE_JWT_WITHOUT_STATUS = true` : appeler `GET /auth/me` pour récupérer le statut
   - Si `USE_JWT_WITHOUT_STATUS = false` : lire depuis JWT (ancien comportement)
3. Modifier `useAuthStore.ts` :
   - Gérer les deux cas (avec/sans status dans JWT)

**Tests à écrire :**
- [ ] Test : JWT avec `USE_JWT_WITHOUT_STATUS = false` contient `status`
- [ ] Test : JWT avec `USE_JWT_WITHOUT_STATUS = true` ne contient pas `status`
- [ ] Test E2E : login → GET /auth/me → statut correct
- [ ] Test : double lecture (JWT + DB) fonctionne

**Critères de validation (DoD) :**
- [ ] JWT sans status quand flag = true
- [ ] JWT avec status quand flag = false
- [ ] Tests passent (ancien + nouveau chemin)
- [ ] Feature flag fonctionnelle
- [ ] Rollback testé

**Risques connus :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| JWT incompatible avec anciens tokens | Moyenne | Élevé | Double lecture pendant transition |
| Performance dégradée (appel /auth/me) | Faible | Moyen | Cache du résultat |

---

### Story SUB-009 : Frontend — useSubscriptionStatus Hook

**ID :** SUB-009  
**Titre :** Créer le hook `useSubscriptionStatus` pour le frontend  
**Priorité :** P1  
**Estimation :** M (1 jour)  

**Pourquoi cette Story existe :**
- Le frontend doit se mettre à jour automatiquement après activation
- Polling de `GET /auth/me` toutes les 30s
- Remplacer la dérive depuis `user.status` (obsolète)

**Dépendances :** SUB-007, SUB-008

**Fichiers concernés :**
- Nouveau fichier : `frontend/src/hooks/useSubscriptionStatus.ts`
- `frontend/src/components/SubscriptionStatus.tsx`

**Feature Flag :** `USE_NEW_SUBSCRIPTION_HOOK` (défaut: false)

**Modifications attendues :**
1. Créer `useSubscriptionStatus` hook :
   - Appelle `GET /auth/me` au mount
   - Poll toutes les 30s
   - Retourne `{ status, planName, isLoading, error }`
2. Modifier `SubscriptionStatus.tsx` :
   - Si flag = true : utiliser le nouveau hook
   - Si flag = false : garder l'ancien comportement

**Tests à écrire :**
- [ ] Test : hook retourne le statut correct
- [ ] Test : polling fonctionne (refresh toutes les 30s)
- [ ] Test : erreur réseau gérée correctement

**Critères de validation (DoD) :**
- [ ] Hook créé et fonctionnel
- [ ] Composant modifié
- [ ] Tests passent
- [ ] Feature flag fonctionnelle
- [ ] UI se met à jour en < 2s après activation

**Risques connus :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Polling trop agressif | Faible | Moyen | 30s est acceptable |
| Memory leak | Moyenne | Élevé | Cleanup dans useEffect |

---

### Story SUB-010 : Domain Events — Subscription

**ID :** SUB-010  
**Titre :** Définir et émettre les Domain Events pour Subscription  
**Priorité :** P2  
**Estimation :** M (1 jour)  

**Pourquoi cette Story existe :**
- Architecture V2.1 : toute mutation émet un Domain Event
- Permet de découpler les effets secondaires (cache, audit, sync, email)
- Prépare l'EventBus pour les autres domaines

**Dépendances :** SUB-001, SUB-002

**Fichiers concernés :**
- Nouveau dossier : `src/server/domain/subscription/events/`
- `src/server/routes/admin.subscriptions.ts`

**Feature Flag :** `ENABLE_SUBSCRIPTION_EVENTS` (défaut: false)

**Modifications attendues :**
1. Créer les events :
   - `VoucherRequestSubmitted`
   - `VoucherVerified`
   - `VoucherRejected`
   - `SubscriptionActivated`
   - `SubscriptionSuspended`
   - `SubscriptionCancelled`
   - `SubscriptionExpired`
   - `SubscriptionRenewed`
2. Émettre les events dans les routes après chaque mutation
3. Les events sont émis mais aucun handler ne s'exécute (flag = false)

**Tests à écrire :**
- [ ] Test : émission de `VoucherVerified` après verify
- [ ] Test : émission de `SubscriptionActivated` après activation
- [ ] Test : event contient les bonnes métadonnées (origin_node, logical_clock, correlationId)

**Critères de validation (DoD) :**
- [ ] 8 events créés et typés
- [ ] Events émis dans 100% des mutations
- [ ] Tests passent
- [ ] Feature flag fonctionnelle

**Risques connus :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Event mal formé | Moyenne | Élevé | Validation stricte |
| Performance (émission sync) | Faible | Moyen | EventBus asynchrone |

---

### Story SUB-011 : Entity Versioning — Subscriptions

**ID :** SUB-011  
**Titre :** Ajouter `entity_version`, `origin_node`, `logical_clock` à la table `subscriptions`  
**Priorité :** P1  
**Estimation :** M (1 jour)  

**Pourquoi cette Story existe :**
- Architecture V2.1 : versioning des entités pour la réplication
- Détection de conflits, ordre causal, idempotence

**Dépendances :** Aucune

**Fichiers concernés :**
- Migration SQL : `backend/migrations/045_subscription_versioning.sql`
- `src/server/db/database.ts` (backfill)

**Feature Flag :** `USE_SUBSCRIPTION_VERSIONING` (défaut: false)

**Modifications attendues :**
1. Créer la migration SQL :
   ```sql
   ALTER TABLE subscriptions ADD COLUMN entity_version INTEGER NOT NULL DEFAULT 1;
   ALTER TABLE subscriptions ADD COLUMN origin_node TEXT NOT NULL DEFAULT 'legacy';
   ALTER TABLE subscriptions ADD COLUMN logical_clock INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE subscriptions ADD COLUMN replicated_at TEXT;
   ALTER TABLE subscriptions ADD COLUMN replication_status TEXT DEFAULT 'pending';
   ```
2. Créer le script de backfill
3. Créer le script de rollback

**Tests à écrire :**
- [ ] Test : migration appliquée avec succès
- [ ] Test : rollback appliqué avec succès
- [ ] Test : backfill complété sans erreur

**Critères de validation (DoD) :**
- [ ] Migration SQL créée et testée
- [ ] Backfill complété
- [ ] Rollback testé
- [ ] Feature flag fonctionnelle

**Risques connus :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Migration échoue | Faible | Critique | Backup + test sur dev d'abord |
| Backfill lent | Moyenne | Élevé | Batch de 1000 |

---

### Story SUB-012 : Entity Versioning — subscription_payment_requests

**ID :** SUB-012  
**Titre :** Ajouter versioning à la table `subscription_payment_requests`  
**Priorité :** P1  
**Estimation :** S (0.5 jour)  

**Pourquoi cette Story existe :**
- Cohérence : toutes les tables répliquées doivent avoir le versioning
- Même migration que SUB-011 pour une autre table

**Dépendances :** SUB-011

**Fichiers concernés :**
- Migration SQL : `backend/migrations/046_voucher_request_versioning.sql`

**Feature Flag :** `USE_VOUCHER_REQUEST_VERSIONING` (défaut: false)

**Modifications attendues :**
1. Créer la migration SQL (même schéma que SUB-011)
2. Backfill + rollback

**Tests à écrire :**
- [ ] Test : migration appliquée
- [ ] Test : backfill complété

**Critères de validation (DoD) :**
- [ ] Migration créée et testée
- [ ] Backfill complété
- [ ] Rollback testé

**Risques connus :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
|identique à SUB-011 | Faible | Critique | Réutiliser les scripts |

---

### Story SUB-013 : LamportClock Service

**ID :** SUB-013  
**Titre :** Créer le service LamportClock pour l'horloge logique  
**Priorité :** P2  
**Estimation :** S (0.5 jour)  

**Pourquoi cette Story existe :**
- Architecture V2.1 : horloge de Lamport pour l'ordre causal
- Nécessaire pour la réplication distribuée

**Dépendances :** Aucune

**Fichiers concernés :**
- Nouveau fichier : `src/server/infrastructure/lamport-clock.service.ts`

**Feature Flag :** Aucune (service utilitaire)

**Modifications attendues :**
1. Créer `LamportClock` :
   - `tick(): number` — incrémente et retourne le compteur
   - `observe(remoteCounter: number): void` — met à jour le compteur
   - `get(): number` — retourne le compteur courant
   - Persistance dans `settings` (clé `lamport_clock`)
2. Tests unitaires

**Tests à écrire :**
- [ ] Test : `tick()` incrémente le compteur
- [ ] Test : `observe(5)` quand compteur = 3 → compteur = 6
- [ ] Test : persistance dans `settings`

**Critères de validation (DoD) :**
- [ ] Service créé et fonctionnel
- [ ] Tests unitaires passent (coverage > 80%)
- [ ] Documentation API à jour

**Risques connus :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Compteur pas persistant | Faible | Élevé | Tests de persistance |

---

### Story SUB-014 : OriginNode Service

**ID :** SUB-014  
**Titre :** Créer le service OriginNode pour l'identifiant de nœud  
**Priorité :** P2  
**Estimation :** S (0.5 jour)  

**Pourquoi cette Story existe :**
- Architecture V2.1 : chaque nœud a un `origin_node` unique
- Prévention des boucles de réplication

**Dépendances :** Aucune

**Fichiers concernés :**
- Nouveau fichier : `src/server/infrastructure/origin-node.service.ts`

**Feature Flag :** Aucune (service utilitaire)

**Modifications attendues :**
1. Créer `OriginNode` :
   - `get(): string` — retourne l'UUID du nœud
   - Génère l'UUID au premier appel si absent
   - Persiste dans `settings` (clé `origin_node`)
2. Tests unitaires

**Tests à écrire :**
- [ ] Test : `get()` retourne un UUID valide
- [ ] Test : `get()` est persistant (2 appels → même UUID)
- [ ] Test : génération automatique si absent

**Critères de validation (DoD) :**
- [ ] Service créé et fonctionnel
- [ ] Tests unitaires passent (coverage > 80%)
- [ ] Documentation API à jour

**Risques connus :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| UUID pas unique | Faible | Élevé | Utiliser `crypto.randomUUID()` |

---

### Story SUB-015 : withOutboxTransaction — Intégrer Versioning

**ID :** SUB-015  
**Titre :** Modifier `withOutboxTransaction` pour inclure entity_version, origin_node, logical_clock  
**Priorité :** P1  
**Estimation :** M (1 jour)  

**Pourquoi cette Story existe :**
- Architecture V2.1 : l'outbox doit contenir les métadonnées de versioning
- Nécessaire pour la réplication et la résolution de conflits

**Dépendances :** SUB-011, SUB-012, SUB-013, SUB-014

**Fichiers concernés :**
- `src/server/db/database.ts` (fonction `withOutboxTransaction`)

**Feature Flag :** `USE_OUTBOX_VERSIONING` (défaut: false)

**Modifications attendues :**
1. Modifier `withOutboxTransaction` :
   - Si `USE_OUTBOX_VERSIONING = true` :
     - Récupérer `entity_version` de l'entité (ou incrémenter)
     - Récupérer `origin_node` depuis `OriginNode`
     - Récupérer `logical_clock` depuis `LamportClock`
     - Ajouter ces champs dans le message outbox
   - Si `USE_OUTBOX_VERSIONING = false` : ancien comportement
2. Tests d'intégration

**Tests à écrire :**
- [ ] Test : outbox contient `entity_version` quand flag = true
- [ ] Test : outbox contient `origin_node` quand flag = true
- [ ] Test : outbox contient `logical_clock` quand flag = true
- [ ] Test : outbox ne contient pas ces champs quand flag = false

**Critères de validation (DoD) :**
- [ ] Fonction modifiée
- [ ] Tests passent (ancien + nouveau chemin)
- [ ] Feature flag fonctionnelle
- [ ] Rollback testé

**Risques connus :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Performance dégradée | Faible | Moyen | Mesurer latence avant/après |
| Colonnes manquantes | Moyenne | Élevé | Vérifier schéma avant |

---

## 3. EPIC 2 : TENANT CONTEXT

**Objectif :** Migrer le domaine Tenant vers l'Architecture V2.1  
**Priorité :** P1  
**Effort total estimé :** 12 jours  

---

### Story TNT-001 : TenantStatusReadModel

**ID :** TNT-001  
**Titre :** Créer le Read Model pour le statut de tenant  
**Priorité :** P1  
**Estimation :** M (1 jour)  

**Pourquoi cette Story existe :**
- Centraliser la lecture du statut de tenant
- Préparer l'invalidation de cache

**Dépendances :** Aucune

**Fichiers concernés :**
- Nouveau fichier : `src/server/domain/tenant/read-models/TenantStatusReadModel.ts`

**Feature Flag :** Aucune

**Modifications attendues :**
1. Créer l'interface `TenantStatusReadModel`
2. Créer le service de lecture

**Tests à écrire :**
- [ ] Tests unitaires
- [ ] Tests d'intégration

**Critères de validation (DoD) :**
- [ ] Read Model créé et fonctionnel
- [ ] Tests passent

**Risques connus :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Logique incorrecte | Moyenne | Élevé | Tests exhaustifs |

---

### Story TNT-002 : Cache Invalidation — Tenant Mutations

**ID :** TNT-002  
**Titre :** Invalider le cache après mutations sur `tenants`  
**Priorité :** P1  
**Estimation :** S (0.5 jour)  

**Pourquoi cette Story existe :**
- Cohérence avec SUB-001
- Toute mutation sur `tenants` doit invalider le cache

**Dépendances :** TNT-001

**Fichiers concernés :**
- `src/server/routes/platform.routes.ts`

**Feature Flag :** `ENABLE_TENANT_CACHE_INVALIDATION` (défaut: false)

**Modifications attendues :**
1. Appeler `invalidateSubscriptionCache(tenantId)` après chaque mutation sur `tenants`

**Tests à écrire :**
- [ ] Test : mutation tenant → cache invalidé

**Critères de validation (DoD) :**
- [ ] Cache invalidé après mutations
- [ ] Tests passent

**Risques connus :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Oubli d'un endpoint | Moyenne | Élevé | Review + tests |

---

## 4. EPIC 3 : ORDER CONTEXT

**Objectif :** Migrer le domaine Order vers l'Architecture V2.1  
**Priorité :** P2  
**Effort total estimé :** 18 jours  

---

### Story ORD-001 : OrderStatusReadModel

**ID :** ORD-001  
**Titre :** Créer le Read Model pour le statut de commande  
**Priorité :** P2  
**Estimation :** M (1 jour)  

**Pourquoi cette Story existe :**
- Optimiser les lectures de commandes
- Préparer le frontend pour les mises à jour temps réel

**Dépendances :** Aucune

**Fichiers concernés :**
- Nouveau fichier : `src/server/domain/order/read-models/OrderStatusReadModel.ts`

**Feature Flag :** Aucune

**Modifications attendues :**
1. Créer l'interface `OrderStatusReadModel`
2. Créer le service de lecture

**Tests à écrire :**
- [ ] Tests unitaires
- [ ] Tests d'intégration

**Critères de validation (DoD) :**
- [ ] Read Model créé et fonctionnel
- [ ] Tests passent

**Risques connus :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Logique incorrecte | Moyenne | Élevé | Tests exhaustifs |

---

## 5. EPIC 4 : REPLICATION ENGINE

**Objectif :** Enrichir le Replication Engine avec V2.1  
**Priorité :** P1  
**Effort total estimé :** 15 jours  

---

### Story REP-001 : PushReplicator avec Idempotence

**ID :** REP-001  
**Titre :** Créer PushReplicator avec idempotence (Idempotency-Key)  
**Priorité :** P1  
**Estimation :** L (2 jours)  

**Pourquoi cette Story existe :**
- Architecture V2.1 : exactly-once delivery
- Éviter les doublons dans Supabase

**Dépendances :** Aucune

**Fichiers concernés :**
- Nouveau fichier : `src/sync/push-replicator.ts`
- `src/sync/core/generic-sync.service.ts` (extraction)

**Feature Flag :** `USE_PUSH_REPLICATOR_V2` (défaut: false)

**Modifications attendues :**
1. Extraire la logique de push de `GenericSyncService` vers `PushReplicator`
2. Ajouter `Idempotency-Key: outbox.id` dans les headers
3. Vérifier la table `replication_idempotency` avant chaque push
4. Tests d'intégration

**Tests à écrire :**
- [ ] Test : push message → Supabase reçoit
- [ ] Test : push même message 2 fois → Supabase ne reçoit qu'une fois
- [ ] Test : erreur réseau → retry automatique

**Critères de validation (DoD) :**
- [ ] PushReplicator créé et testé
- [ ] Idempotence fonctionne
- [ ] Tests passent
- [ ] Feature flag fonctionnelle

**Risques connus :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Idempotence cassée | Faible | Élevé | Tests de retry intensifs |
| Performance dégradée | Moyenne | Moyen | Benchmark |

---

### Story REP-002 : PullReplicator avec ConflictResolver

**ID :** REP-002  
**Titre :** Créer PullReplicator avec résolution de conflits  
**Priorité :** P1  
**Estimation :** L (2 jours)  

**Pourquoi cette Story existe :**
- Architecture V2.1 : pull avec résolution automatique de conflits
- Convergence garantie entre SQLite et Supabase

**Dépendances :** REP-001

**Fichiers concernés :**
- Nouveau fichier : `src/sync/pull-replicator.ts`
- `src/sync/core/conflict-resolver.ts` (enrichissement)

**Feature Flag :** `USE_PULL_REPLICATOR_V2` (défaut: false)

**Modifications attendues :**
1. Extraire la logique de pull de `GenericSyncService` vers `PullReplicator`
2. Intégrer `ConflictResolver` avec 8 stratégies
3. Appliquer la matrice par domaine
4. Tests d'intégration

**Tests à écrire :**
- [ ] Test : pull → SQLite mis à jour
- [ ] Test : conflit version → résolu automatiquement
- [ ] Test : pull incrémental (curseur)

**Critères de validation (DoD) :**
- [ ] PullReplicator créé et testé
- [ ] ConflictResolver enrichi
- [ ] Tests passent
- [ ] Feature flag fonctionnelle

**Risques connus :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Conflits non résolus | Moyenne | Élevé | Tests avec scénarios réels |
| Boucle de réplication | Faible | Critique | Tests multi-nœuds |

---

## 6. EPIC 5 : OBSERVABILITY

**Objectif :** Ajouter structured logging, métriques, alertes  
**Priorité :** P2  
**Effort total estimé :** 10 jours  

---

### Story OBS-001 : Structured Logging (pino)

**ID :** OBS-001  
**Titre :** Ajouter structured logging avec pino  
**Priorité :** P2  
**Estimation :** M (1 jour)  

**Pourquoi cette Story existe :**
- Architecture V2.1 : logs structurés pour l'observabilité
- Faciliter le debugging en production

**Dépendances :** Aucune

**Fichiers concernés :**
- Nouveau fichier : `src/server/infrastructure/logger.ts`
- `src/server/server.ts` (initialisation)

**Feature Flag :** `ENABLE_STRUCTURED_LOGGING` (défaut: false)

**Modifications attendues :**
1. Créer le logger pino
2. Remplacer `console.log` par `logger.info`
3. Remplacer `console.error` par `logger.error`
4. Tests

**Tests à écrire :**
- [ ] Test : logs sont structurés (JSON)
- [ ] Test : logs contiennent correlationId

**Critères de validation (DoD) :**
- [ ] Logger créé et fonctionnel
- [ ] Tests passent
- [ ] Feature flag fonctionnelle

**Risques connus :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Performance logging | Faible | Moyen | Sampling |

---

### Story OBS-002 : Métriques Prometheus

**ID :** OBS-002  
**Titre :** Exporter 20 métriques Prometheus  
**Priorité :** P2  
**Estimation :** L (2 jours)  

**Pourquoi cette Story existe :**
- Architecture V2.1 : observabilité complète
- Monitoring de la réplication, cache, business

**Dépendances :** OBS-001

**Fichiers concernés :**
- Nouveau fichier : `src/server/infrastructure/metrics.ts`
- `src/server/server.ts` (endpoint /metrics)

**Feature Flag :** `ENABLE_METRICS` (défaut: false)

**Modifications attendues :**
1. Créer les 20 métriques (voir Architecture V2.1)
2. Exporter sur `/metrics`
3. Tests

**Tests à écrire :**
- [ ] Test : endpoint /metrics retourne les métriques
- [ ] Test : métriques sont mises à jour

**Critères de validation (DoD) :**
- [ ] 20 métriques exportées
- [ ] Tests passent
- [ ] Feature flag fonctionnelle

**Risques connus :**
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Overhead métriques | Faible | Moyen | Sampling |

---

## ANNEXE A — PRIORISATION GLOBALE

### Phase 1 : Stabilization (P0)

1. **SUB-001** : Cache invalidation — Activation (S)
2. **SUB-002** : Cache invalidation — Verify/Reject (S)
3. **SUB-003** : Unifier connexions SQLite (S)
4. **SUB-004** : Idempotence — POST /verify (M)
5. **SUB-005** : Idempotence — POST /reject (S)

**Effort total :** 3 jours  
**Impact :** Critique — débloque les utilisateurs

### Phase 2 : Foundations (P1)

6. **SUB-006** : SubscriptionStatusReadModel (M)
7. **SUB-007** : GET /auth/me lit depuis ReadModel (M)
8. **SUB-008** : Retirer status du JWT (L)
9. **SUB-009** : Frontend useSubscriptionStatus (M)
10. **SUB-011** : Entity Versioning — Subscriptions (M)
11. **SUB-012** : Entity Versioning — VoucherRequests (S)
12. **SUB-015** : withOutboxTransaction versioning (M)

**Effort total :** 9 jours  
**Impact :** Élevé — foundations solides

### Phase 3 : Domain Services (P1-P2)

13. **SUB-010** : Domain Events (M)
14. **SUB-013** : LamportClock (S)
15. **SUB-014** : OriginNode (S)
16. **TNT-001** : TenantStatusReadModel (M)
17. **TNT-002** : Cache invalidation — Tenant (S)
18. **ORD-001** : OrderStatusReadModel (M)

**Effort total :** 7 jours  
**Impact :** Moyen — améliore la maintenabilité

### Phase 4 : Replication Engine (P1)

19. **REP-001** : PushReplicator avec idempotence (L)
20. **REP-002** : PullReplicator avec conflict resolver (L)

**Effort total :** 4 jours  
**Impact :** Élevé — fiabilité de la sync

### Phase 5 : Observability (P2)

21. **OBS-001** : Structured logging (M)
22. **OBS-002** : Métriques Prometheus (L)

**Effort total :** 3 jours  
**Impact :** Moyen — observabilité

---

## ANNEXE B — WORKFLOW D'IMPLÉMENTATION

```
1. Choisir la Story à implémenter (par ordre de priorité)
2. Lire le code existant concerné
3. Implémenter uniquement cette Story
4. Écrire les tests
5. Vérifier qu'aucune fonctionnalité existante n'est cassée
6. Fournir un rapport de code court :
   - Fichiers modifiés
   - Tests exécutés
   - Risques restants
7. Attendre la validation avant de passer à la Story suivante
```

**Règle d'or :** Une Story à la fois. Validation avant de continuer.

---

*Implementation Backlog v1.0 — À implémenter story par story*

*Première Story à implémenter : SUB-001*