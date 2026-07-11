# RAPPORT DE DIAGNOSTIC DU SYSTÈME DE SYNCHRONISATION EKALA

**Date :** 11 Juillet 2026  
**Analyste :** Audit Architecture  
**Version du code :** Architecture V2.3.2 (transition en cours)  
**Périmètre :** Moteur de synchronisation bidirectionnelle SQLite ↔ Supabase

---

## 1. VUE D'ENSEMBLE ARCHITECTURALE

### 1.1 Stack Technologique

| Composant | Technologie | Rôle |
|-----------|------------|------|
| Base locale | SQLite (better-sqlite3) | Source de vérité locale, offline-first |
| Base cloud | Supabase (PostgreSQL) | Source de vérité cloud, multi-tenant |
| Moteur sync | TypeScript, Node.js | Orchestration bidirectionnelle |
| Runtime | Electron (desktop) / Render (cloud) | Modes de déploiement |

### 1.2 Évolution Architecturale (3 générations coexistantes)

```
V1 (Legacy) ─── ProductSyncService, OrderSyncService, SaleSyncService
    ↓
V2 (Actuelle) ── GenericSyncService + SyncOrchestratorV2 + EntityRegistry
    ↓
V2.3.2 (Cible) ── OutboxWorkerV2 + WriteInterceptor + RetryPolicy + ReconciliationJob
```

**Problème fondamental :** Les 3 générations coexistent dans le codebase, créant une dette technique et des chemins d'exécution redondants.

---

## 2. ANALYSE DÉTAILLÉE DES COMPOSANTS

### 2.1 Registre d'Entités (`entity-registry.ts`)

**Ce qui est bien :**
- 25+ entités définies avec métadonnées complètes (FK, mappings, champs autorisés)
- Ordre de synchronisation explicite (syncOrder) pour respecter les dépendances
- Support des types : boolean, JSON, version, status mapping

**Problèmes identifiés :**
- ⚠️ **Duplication de définition** : Les champs `allowedFields` sont définis manuellement, créant un risque de désynchronisation avec le schéma réel
- ⚠️ **Pas de validation de schéma** : Aucune vérification que les champs déclarés existent réellement dans les tables
- ⚠️ **Maintenance lourde** : Chaque nouvelle table nécessite une modification manuelle du registre

### 2.2 GenericSyncService (1753 lignes)

**Ce qui est bien :**
- Logique générique de push/pull pour toutes les entités
- Résolution de conflits LWW (Last Writer Wins)
- Gestion des foreign keys bidirectionnelle
- Self-healing cursor (reset automatique en cas d'erreur)
- Backfill automatique des orphelins

**Problèmes critiques :**

| # | Problème | Impact | Gravité |
|---|----------|--------|---------|
| 1 | **Dual-write path** : Écrit à la fois dans sync_outbox (legacy) ET dans OutboxRepository (V2.3.2) | Double écriture, risque de duplication | 🔴 Critique |
| 2 | **Try/catch silencieux** : De nombreuses erreurs sont ignorées (`catch { /* ignore */ })` | Perte de données silencieuse | 🔴 Critique |
| 3 | **Pas de pagination** : `LIMIT 50` sans offset ni pagination | Perte d'items si >50 en attente | 🟠 Élevé |
| 4 | **Logging excessif** : `console.log` partout, pas de structuration | Bruit, pas d'observabilité réelle | 🟡 Moyen |
| 5 | **Requêtes N+1** : Pour chaque item, une requête Supabase individuelle | Performance dégradée | 🟠 Élevé |
| 6 | **Pas de transaction globale** : Chaque item est traité individuellement | Incohérence possible | 🟠 Élevé |

### 2.3 SyncOrchestratorV2 (609 lignes)

**Ce qui est bien :**
- Découverte multi-tenant automatique
- Gestion de la connectivité (online/offline)
- Scheduler avec jitter
- Post-sync health check

**Problèmes :**

| # | Problème | Impact | Gravité |
|---|----------|--------|---------|
| 1 | **Scheduler 30s fixe** : Pas de backoff adaptatif | Consommation réseau inutile en offline | 🟡 Moyen |
| 2 | **Phase 1 legacy skip** : Les services legacy sont initialisés mais pas utilisés | Code mort, confusion | 🟡 Moyen |
| 3 | **Pas de monitoring** : Aucune métrique exposée sur l'état de la sync | Aveugle en production | 🟠 Élevé |
| 4 | **Découverte tenant fragile** : Requête sans filtre, peut retourner des milliers de lignes | Performance, timeout | 🟠 Élevé |

### 2.4 OutboxWorkerV2 (Architecture Cible)

**Ce qui est bien :**
- Architecture event-driven propre
- WriteInterceptor comme garde d'écriture
- DistributedLock anti-double traitement
- RetryPolicy avec exponential backoff + jitter

**Problèmes :**

| # | Problème | Impact | Gravité |
|---|----------|--------|---------|
| 1 | **NON DÉMARRÉ EN PRODUCTION** : Le worker n'est pas activé | L'architecture cible n'est pas utilisée | 🔴 Critique |
| 2 | **WriteInterceptor désactivé** : Le garde d'écriture n'est pas actif | N'importe quel code peut écrire directement dans Supabase | 🔴 Critique |
| 3 | **TableMap incomplète** : Seulement 10 entités sur 25+ sont mappées | Les autres entités ne passent pas par le worker | 🟠 Élevé |
| 4 | **preparePayloadForSupabase trop agressif** : Supprime `id`, `created_at`, `updated_at` | Perte d'information critique | 🟠 Élevé |

### 2.5 ProductSyncService (Legacy, 1089 lignes)

**Problèmes :**
- ⚠️ **Code mort** : Remplacé par GenericSyncService mais toujours présent
- ⚠️ **Duplication de logique** : `handleUpsert`, `handleDelete`, `pullByEntityFromSupabase` existent aussi dans GenericSyncService
- ⚠️ **Mappings spécifiques** : Des mappings produit/prix/catégorie qui devraient être dans le registre

### 2.6 SupabasePullSyncService (Worker dédié QR)

**Problèmes :**
- ⚠️ **Troisième chemin de pull** : S'ajoute au pull de GenericSyncService et ProductSyncService
- ⚠️ **Pas de cursor partagé** : Utilise `sync_metadata` au lieu de `sync_state`
- ⚠️ **Lookback fixe** : 60 minutes, pas de gestion des trous

### 2.7 ReconciliationJob

**Ce qui est bien :**
- Détection des remote_ids manquants
- Correction des orphelins (tenant_users)
- Vérification de la DLQ

**Problèmes :**
- ⚠️ **Non intégré au cycle de sync** : Devrait être appelé après chaque cycle
- ⚠️ **getMonitoredEntities()** : Liste codée en dur, pas synchronisée avec le registre

---

## 3. PROBLÈMES TRANSVERSAUX

### 3.1 Problèmes de Sécurité

| # | Problème | Détail | Gravité |
|---|----------|--------|---------|
| 1 | **Pas de validation des payloads** | Les données sont poussées telles quelles vers Supabase | 🔴 Critique |
| 2 | **Clé service role exposée** | `SUPABASE_SERVICE_ROLE_KEY` utilisée côté client | 🔴 Critique |
| 3 | **Pas de rate limiting** | Aucune protection contre les appels abusifs | 🟠 Élevé |
| 4 | **Pas d'audit des écritures** | Aucune traçabilité de qui écrit quoi | 🟠 Élevé |

### 3.2 Problèmes de Performance

| # | Problème | Détail | Gravité |
|---|----------|--------|---------|
| 1 | **Requêtes N+1** | Chaque item d'outbox = 1 requête Supabase | 🔴 Critique |
| 2 | **Pas de batch processing** | Les items sont traités un par un | 🟠 Élevé |
| 3 | **Pas de cache** | Les remote_ids sont relus à chaque cycle | 🟡 Moyen |
| 4 | **Index manquants** | Certaines requêtes n'ont pas d'index optimisé | 🟡 Moyen |

### 3.3 Problèmes de Fiabilité

| # | Problème | Détail | Gravité |
|---|----------|--------|---------|
| 1 | **Pas de mécanisme de retry global** | Si un cycle échoue, tout est perdu | 🔴 Critique |
| 2 | **Pas de garantie d'ordre** | Les items peuvent être traités dans le désordre | 🟠 Élevé |
| 3 | **Pas de transaction distribué** | Aucune garantie d'atomicité cross-système | 🟠 Élevé |
| 4 | **Pas de dead letter queue monitoring** | Les items en DLQ ne sont pas alertés | 🟡 Moyen |

### 3.4 Problèmes de Maintenabilité

| # | Problème | Détail | Gravité |
|---|----------|--------|---------|
| 1 | **3 générations de sync** | Legacy + V2 + V2.3.2 coexistent | 🔴 Critique |
| 2 | **Code dupliqué** | `handleUpsert` dans 3 fichiers différents | 🔴 Critique |
| 3 | **Console.log partout** | Pas de logger structuré, pas de niveaux | 🟡 Moyen |
| 4 | **Pas de tests d'intégration** | Aucun test de bout en bout de la sync | 🔴 Critique |
| 5 | **Documentation dispersée** | 50+ fichiers docs, difficile à naviguer | 🟡 Moyen |

---

## 4. DIAGNOSTIC PAR COUCHE

### 4.1 Couche de Queue (Outbox)

```
État Actuel :
┌─────────────────────────────────────────────────────┐
│  sync_outbox (Legacy)  ←── Écritures locales        │
│  + sync_outbox (V2.3.2) ←── Dual-write activé       │
│  + sync_dlq (Legacy)    ←── Échecs                   │
│  + dead_letter_queue (V2.3.2) ←── Échecs V2          │
└─────────────────────────────────────────────────────┘
```

**Problème :** 4 tables pour la même fonctionnalité.

### 4.2 Couche de Traitement

```
État Actuel :
┌─────────────────────────────────────────────────────┐
│  SyncOrchestratorV2.triggerSync()  ←── Point d'entrée│
│    ├── GenericSyncService.pushByEntity()  (Legacy)   │
│    ├── GenericSyncService.pullByEntity()  (Legacy)   │
│    ├── OutboxWorkerV2 (NON DÉMARRÉ)                  │
│    └── ReconciliationJob (NON INTÉGRÉ)               │
└─────────────────────────────────────────────────────┘
```

**Problème :** Le chemin legacy est actif, le chemin V2.3.2 est inactif.

### 4.3 Couche de Résolution de Conflits

```
État Actuel :
┌─────────────────────────────────────────────────────┐
│  ConflictResolver.resolveLWW()  ←── Version + Timestamp│
│  ConflictResolver.resolveFieldMerge()  ←── Par champ  │
│  sync_conflicts table  ←── Journalisation             │
└─────────────────────────────────────────────────────┘
```

**Problème :** La résolution LWW est trop simpliste. Pas de merge intelligent, pas de résolution manuelle.

---

## 5. PROPOSITIONS D'AMÉLIORATION

### 5.1 Actions Immédiates (Sprint 1-2)

| # | Action | Justification | Effort |
|---|--------|---------------|--------|
| 1 | **Activer OutboxWorkerV2** | Remplacer le push legacy par le worker event-driven | 3 jours |
| 2 | **Activer WriteInterceptor** | Bloquer les écritures directes vers Supabase | 1 jour |
| 3 | **Supprimer ProductSyncService** | Éliminer le code mort (V1 legacy) | 2 jours |
| 4 | **Unifier les DLQ** | Une seule dead letter queue pour tous les échecs | 2 jours |
| 5 | **Ajouter des métriques** | Prometheus ou équivalent pour le monitoring | 3 jours |

### 5.2 Actions Court Terme (Sprint 3-4)

| # | Action | Justification | Effort |
|---|--------|---------------|--------|
| 1 | **Batch processing** | Grouper les écritures Supabase par batch de 100 | 3 jours |
| 2 | **Transaction globale** | Garantir l'atomicité des cycles de sync | 4 jours |
| 3 | **Validation des payloads** | Valider les données avant push vers Supabase | 2 jours |
| 4 | **Cache des remote_ids** | Éviter les requêtes N+1 pour la résolution FK | 3 jours |
| 5 | **Tests d'intégration** | Scénarios de bout en bout (local → cloud → local) | 5 jours |

### 5.3 Actions Moyen Terme (Sprint 5-8)

| # | Action | Justification | Effort |
|---|--------|---------------|--------|
| 1 | **Architecture Outbox-Only** | Supprimer complètement le legacy path | 5 jours |
| 2 | **Event Sourcing** | Remplacer l'outbox par un event store | 10 jours |
| 3 | **CQRS** | Séparer les lectures des écritures | 8 jours |
| 4 | **Monitoring temps réel** | Dashboard de l'état de la sync | 5 jours |
| 5 | **Auto-scaling du worker** | Worker qui s'adapte à la charge | 5 jours |

### 5.4 Actions Long Terme (Sprint 9+)

| # | Action | Justification | Effort |
|---|--------|---------------|--------|
| 1 | **Migration vers Kafka/RabbitMQ** | File de messages professionnelle | 15 jours |
| 2 | **Saga Pattern** | Transactions distribuées pour les opérations complexes | 10 jours |
| 3 | **Machine Learning pour conflits** | Résolution intelligente des conflits | 20 jours |
| 4 | **Multi-région** | Support de plusieurs régions Supabase | 15 jours |

---

## 6. ARCHITECTURE CIBLE RECOMMANDÉE

```
┌─────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                            │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────────┐  │
│  │ Write Ops   │  │ Read Ops     │  │ Admin/Manual Sync         │  │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬────────────────┘  │
│         │                │                      │                   │
├─────────┼────────────────┼──────────────────────┼───────────────────┤
│         ▼                ▼                      ▼                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    OUTBOX (Source de Vérité)                 │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │  sync_outbox (UNIQUE)                                │   │   │
│  │  │  - idempotency_key (UNIQUE)                          │   │   │
│  │  │  - entity, operation, payload                        │   │   │
│  │  │  - status (pending/in_progress/sent/failed)          │   │   │
│  │  │  - retry_count, max_retries, next_retry_at           │   │   │
│  │  │  - created_at, processed_at                          │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              OutboxWorkerV2 (SEUL ÉCRIVAIN)                  │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│  │  │ Poll Events  │  │ RetryPolicy  │  │ DistributedLock  │   │   │
│  │  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘   │   │
│  │         │                │                    │              │   │
│  │         ▼                ▼                    ▼              │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │              WriteInterceptor (GARDE)                 │   │   │
│  │  │  - Vérifie que seul OutboxWorkerV2 écrit             │   │   │
│  │  │  - Log les tentatives bloquées                       │   │   │
│  │  └──────────────────────┬───────────────────────────────┘   │   │
│  └─────────────────────────┼───────────────────────────────────┘   │
│                            │                                        │
├────────────────────────────┼────────────────────────────────────────┤
│                            ▼                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    SUPABASE (Cloud)                          │   │
│  │  - PostgreSQL avec Row Level Security                       │   │
│  │  - Realtime subscriptions pour les notifications            │   │
│  │  - Foreign keys et contraintes d'intégrité                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              ReconciliationJob (POST-SYNC)                   │   │
│  │  - Vérifie l'intégrité après chaque cycle                   │   │
│  │  - Corrige les remote_ids manquants                         │   │
│  │  - Alerte sur les anomalies                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Monitoring & Observability                      │   │
│  │  - Métriques : pending_count, dlq_count, sync_duration      │   │
│  │  - Alertes : DLQ > 0, sync_failure, high_latency            │   │
│  │  - Dashboard : état en temps réel de la sync                │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. RISQUES ET RECOMMANDATIONS

### 7.1 Risques Critiques (Action Immédiate Requise)

| Risque | Probabilité | Impact | Action Recommandée |
|--------|-------------|--------|-------------------|
| Perte de données due au dual-write | Élevée | Critique | Désactiver le legacy path |
| Écriture directe dans Supabase | Élevée | Critique | Activer WriteInterceptor |
| Items perdus dans l'outbox (>50) | Moyenne | Élevé | Implémenter la pagination |
| Corruption due aux try/catch silencieux | Élevée | Critique | Logger et monitorer toutes les erreurs |

### 7.2 Recommandations Prioritaires

1. **🔴 STOP THE BLEEDING** : Activer OutboxWorkerV2 et WriteInterceptor immédiatement
2. **🔴 UNIFY** : Supprimer ProductSyncService, unifier les DLQ
3. **🟠 TEST** : Ajouter des tests d'intégration de bout en bout
4. **🟠 MONITOR** : Exposer des métriques Prometheus
5. **🟡 SIMPLIFY** : Réduire de 3 à 1 le nombre de chemins de sync

### 7.3 Métriques Clés à Surveiller

```typescript
interface SyncMetrics {
  // Volume
  pending_outbox_count: number;      // Items en attente
  dlq_count: number;                  // Items en échec
  sync_cycle_duration_ms: number;     // Durée du cycle
  
  // Performance
  push_latency_ms: number;           // Temps de push moyen
  pull_latency_ms: number;           // Temps de pull moyen
  batch_size: number;                // Taille du batch
  
  // Fiabilité
  success_rate: number;              // Taux de succès
  retry_rate: number;                // Taux de retry
  conflict_rate: number;             // Taux de conflits
  
  // Santé
  last_sync_at: string;              // Dernière sync réussie
  is_online: boolean;                // Connectivité Supabase
  worker_active: boolean;            // Worker V2.3.2 actif
}
```

---

## 8. CONCLUSION

Le système de synchronisation d'Ekala est **architecturalement solide dans sa conception V2.3.2** mais souffre de **problèmes d'exécution majeurs** :

### Points Forts
- ✅ Architecture générique extensible (25+ entités)
- ✅ Résolution de conflits professionnelle
- ✅ Gestion de la connectivité online/offline
- ✅ Registre d'entités centralisé
- ✅ Dead letter queue pour les échecs

### Points Faibles
- ❌ **3 générations de code qui coexistent** (Legacy + V2 + V2.3.2)
- ❌ **Architecture cible non activée** (OutboxWorkerV2, WriteInterceptor)
- ❌ **Pas de tests d'intégration** (aucune garantie de fonctionnement)
- ❌ **Pas de monitoring** (aveugle en production)
- ❌ **Dual-write path** (risque de duplication/corruption)

### Verdict Final

Le système est **en transition vers une architecture Stripe-grade** mais la migration est **incomplète et risquée**. La priorité absolue est d'activer les composants V2.3.2 et de désactiver les chemins legacy. Sans cela, le système reste vulnérable à des pertes de données silencieuses et à des incohérences.

**Note de risque : 7.5/10** — Une action immédiate est requise pour stabiliser le système avant d'ajouter de nouvelles fonctionnalités.