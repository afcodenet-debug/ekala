# 🏛️ Great Olive — Replication Engine v2.1

**Document :** Architecture du Replication Engine distribué — Complément à Architecture V2  
**Auteur :** Principal Distributed Systems Architect  
**Version :** 2.1  
**Date :** 27/06/2026  
**Périmètre :** Réplication bi-directionnelle offline-first, versioning, résolution de conflits  
**Contexte :** Ce document remplace et étend le chapitre "Synchronisation" de l'Architecture V2.  

---

## TABLE DES MATIÈRES

1. [VISION DU REPLICATION ENGINE](#1-vision-du-replication-engine)
2. [ARCHITECTURE GLOBALE DU REPLICATION ENGINE](#2-architecture-globale-du-replication-engine)
3. [VERSIONING DES ENTITÉS](#3-versioning-des-entités)
4. [FLUX BIDIRECTIONNEL DE RÉPLICATION](#4-flux-bidirectionnel-de-réplication)
5. [POLITIQUE DE RÉSOLUTION DE CONFLITS PAR DOMAINE](#5-politique-de-résolution-de-conflits-par-domaine)
6. [IDEMPOTENCE DES OPÉRATIONS DE RÉPLICATION](#6-idempotence-des-opérations-de-réplication)
7. [DÉTECTION DES BOUCLES DE RÉPLICATION](#7-détection-des-boucles-de-réplication)
8. [REPLAY DES ÉVÉNEMENTS ET REPRISE APRÈS PANNE](#8-replay-des-événements-et-reprise-après-panne)
9. [DEAD LETTER QUEUE POUR SYNCHRONISATIONS IMPOSSIBLES](#9-dead-letter-queue-pour-synchronisations-impossibles)
10. [OBSERVABILITÉ DE LA RÉPLICATION](#10-observabilité-de-la-réplication)
11. [DIAGRAMME DE SÉQUENCE — ACTIVATION COMPLÈTE](#11-diagramme-de-séquence--activation-complète)
12. [ADR SPÉCIFIQUES À LA RÉPLICATION](#12-adr-spécifiques-à-la-réplication)

---

## 1. VISION DU REPLICATION ENGINE

### 1.1 Énoncé

> Le Replication Engine est un système distribué, offline-first, qui garantit la convergence éventuelle (eventual consistency) entre les bases SQLite locales (Source of Truth) et la base Supabase globale (Read Model Projection), avec des garanties d'atomicité, d'idempotence, de résilience aux pannes, et de détection automatique des conflits.

### 1.2 Principes Fondamentaux

1. **SQLite est autoritaire pour les écritures.** Le Replication Engine ne fait que propager les mutations de SQLite vers Supabase. Il n'écrit jamais directement dans SQLite depuis le code applicatif lors du push.
2. **Supabase peut être autoritaire pour les imports externes** (webhooks Stripe, imports CSV). Le Pull Replicator rapatrie ces données vers SQLite avec résolution de conflits.
3. **Toute entité répliquée a un versionnement déterministe.** `entity_version` et `origin_node` garantissent l'ordre causal des mutations.
4. **La réplication est asynchrone et non-bloquante.** Le POS ne doit jamais attendre la réplication pour fonctionner.
5. **La Dead Letter Queue est un mécanisme de dernier recours.** Les conflits sont résolus automatiquement dans 99% des cas.

### 1.3 Topologie

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        TOPOLOGIE DE RÉPLICATION                             │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐                ┌──────────────────┐                   │
│  │  Node A (POS #1) │                │  Node B (POS #2) │                   │
│  │  SQLite (SOT)    │                │  SQLite (SOT)    │                   │
│  │  origin_node: A  │                │  origin_node: B  │                   │
│  └───────┬──────────┘                └───────┬──────────┘                   │
│          │                                   │                              │
│          │ PUSH (outbox)                     │ PUSH (outbox)                 │
│          ▼                                   ▼                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      SUPABASE (Global Projection)                     │  │
│  │  • Tables miroir avec entity_version, origin_node, logical_clock     │  │
│  │  • RLS par tenant_id                                                  │  │
│  │  • Realtime subscriptions pour notifications                          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│          │                                   ▲                              │
│          │ PULL (cron)                       │ REALTIME (events)            │
│          ▼                                   │                              │
│  ┌──────────────────┐                ┌──────────────────┐                   │
│  │  Node C (Admin)  │                │  Webhook (Ext)   │                   │
│  │  SQLite (SOT)    │                │  Stripe / CSV     │                   │
│  │  origin_node: C  │                │  → Supabase       │                   │
│  └──────────────────┘                └──────────────────┘                   │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. ARCHITECTURE GLOBALE DU REPLICATION ENGINE

### 2.1 Composants

```
┌────────────────────────────────────────────────────────────────────────────┐
│                      REPLICATION ENGINE — COMPOSANTS                         │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    CORE COMPONENTS                                     │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │                                                                        │   │
│  │  PushReplicator ────── Lit l'outbox → Transforme payload → Pousse     │   │
│  │                         vers Supabase avec idempotence                  │   │
│  │                                                                        │   │
│  │  PullReplicator ────── Lit Supabase (cursor) → Résout conflits →      │   │
│  │                         Upsert dans SQLite                              │   │
│  │                                                                        │   │
│  │  RealtimeSubscriber ── Écoute Supabase Realtime → Applique dans       │   │
│  │                         SQLite (pour les mises à jour depuis admin)     │   │
│  │                                                                        │   │
│  │  ConflictResolver ──── Reçoit (local, remote) → Applique stratégie    │   │
│  │                         → Log ou archive le conflit                     │   │
│  │                                                                        │   │
│  │  DeadLetterQueue ───── Archive les messages après 5 retries            │   │
│  │                         → Permet retry manuel ou automatique           │   │
│  │                                                                        │   │
│  │  ReplicationObserver ── Métriques, logs, alertes sur l'état de la      │   │
│  │                         réplication                                     │   │
│  │                                                                        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    DATA STRUCTURES                                     │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │                                                                        │   │
│  │  OutboxMessage ──── File d'attente des mutations à pousser             │   │
│  │  ReplicationCursor ── Curseur persistant pour le pull incrémental     │   │
│  │  ConflictRecord ──── Enregistrement d'un conflit détecté              │   │
│  │  DeadLetterRecord ─── Enregistrement d'un échec définitif             │   │
│  │  ReplicationEvent ─── Événement pour l'observabilité                  │   │
│  │                                                                        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Cycle de Vie d'un Message Outbox

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    CYCLE DE VIE D'UN MESSAGE OUTBOX                         │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [1] INSERT dans sync_outbox (dans la même transaction SQLite)              │
│       status: 'pending'                                                     │
│       retry_count: 0                                                        │
│                                                                              │
│  [2] PushReplicator lit (ORDER BY created_at ASC LIMIT batch_size)         │
│       status: 'processing'                                                  │
│                                                                              │
│  [3] Appel API Supabase avec idempotency_key = outbox.id                   │
│       SUCCESS → DELETE from sync_outbox                                    │
│       FAILURE → retry_count++                                               │
│                 if retry_count >= 5 → archive in sync_dlq (status: 'failed')│
│                 else → status: 'pending' (pour retry au prochain cycle)     │
│                                                                              │
│  [4] DeadLetterQueue (sync_dlq):                                           │
│       Permet retry manuel (→ retour dans sync_outbox)                       │
│       Permet purge automatique après N jours                                │
│       Alerte si des messages sont présents depuis > 1h                      │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Unit of Work — Transaction Pattern pour le Push

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    PUSH TRANSACTION PATTERN                                   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  BEGIN TRANSACTION                                                          │
│     1. UPDATE subscriptions SET status = 'active' WHERE id = ?             │
│     2. UPDATE tenants SET status = 'active' WHERE id = ?                   │
│     3. INSERT INTO sync_outbox (id, entity, operation, record_id,          │
│           payload, entity_version, origin_node, created_at)                │
│        VALUES (?, 'subscription', 'update', '42',                          │
│          '{"status":"active",...}', 3, 'node_A', datetime('now'))          │
│     4. INSERT INTO sync_outbox (id, entity, operation, record_id,          │
│           payload, entity_version, origin_node, created_at)                │
│        VALUES (?, 'tenant', 'update', '7',                                 │
│          '{"status":"active",...}', 2, 'node_A', datetime('now'))          │
│  COMMIT                                                                     │
│                                                                              │
│  → Si COMMIT réussit : les messages outbox sont persistés                  │
│  → Si ROLLBACK (crash) : les messages outbox sont annulés aussi             │
│  → Le PushReplicator traite les messages après COMMIT                       │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. VERSIONING DES ENTITÉS

### 3.1 Colonnes de Versioning

Chaque table répliquée DOIT avoir ces colonnes :

```sql
-- Ajouté à chaque table répliquée
entity_version   INTEGER NOT NULL DEFAULT 1,     -- Monotone croissant par entité
origin_node      TEXT NOT NULL DEFAULT 'unknown', -- Identifiant unique du nœud d'origine
logical_clock    INTEGER NOT NULL DEFAULT 0,      -- Horloge logique globale (Lamport)
replicated_at    TEXT,                            -- Dernière réplication réussie
replication_status TEXT DEFAULT 'pending'          -- 'pending' | 'synced' | 'conflict'
```

### 3.2 Règles de Versioning

| Règle | Description |
|-------|-------------|
| `entity_version` | Incrémenté à chaque mutation. Utilisé pour le conflict detection. Si `local_version >= remote_version`, le local gagne. |
| `origin_node` | UUID unique attribué à chaque instance (généré au démarrage, persisté dans `settings`). Permet de tracker la source d'une mutation et d'éviter les boucles. |
| `logical_clock` | Horloge de Lamport : incrémentée à chaque mutation locale. Transmise avec le payload. En cas de conflit, la valeur la plus haute gagne. |
| `replicated_at` | Timestamp de la dernière confirmation de réplication. Null si jamais répliqué. |

### 3.3 Horloge Logique (Lamport Clock)

```typescript
// Implémentation conceptuelle
class LamportClock {
  private counter: number = 0;
  private nodeId: string;

  constructor(nodeId: string, initialCounter: number = 0) {
    this.nodeId = nodeId;
    this.counter = initialCounter;
  }

  // Appelé avant chaque mutation locale
  tick(): number {
    this.counter++;
    this.persistCounter(); // Sauvegarde dans settings
    return this.counter;
  }

  // Appelé quand on reçoit une valeur distante
  observe(remoteCounter: number): void {
    this.counter = Math.max(this.counter, remoteCounter) + 1;
    this.persistCounter();
  }

  // Format pour transmission
  toEvent(): { nodeId: string; counter: number } {
    return { nodeId: this.nodeId, counter: this.counter };
  }
}
```

### 3.4 Stratégie de Résolution par Version

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    MATRICE DE RÉSOLUTION PAR VERSION                         │
├──────────────┬──────────────┬──────────────────────────────────────────────┤
│  LOCAL VER   │  REMOTE VER  │  RÉSULTAT                                     │
├──────────────┼──────────────┼──────────────────────────────────────────────┤
│      3       │      3       │  Identique → Skip (déjà synchronisé)         │
│      4       │      3       │  Local plus récent → Local gagne             │
│      3       │      4       │  Remote plus récent → Appliquer conflit      │
│              │              │  (selon stratégie domaine)                    │
│      0       │      2       │  Nouveau local → Remote gagne (pull)         │
│      2       │      0       │  Nouveau remote → Local gagne (push)         │
│      5       │      5       │  Même version mais données différentes →     │
│              │              │  Conflit manuel (exceptionnel)               │
└──────────────┴──────────────┴──────────────────────────────────────────────┘
```

---

## 4. FLUX BIDIRECTIONNEL DE RÉPLICATION

### 4.1 Push (SQLite → Supabase)

#### Schéma

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    PUSH REPLICATION FLOW                                     │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [1] Transaction SQLite complétée (mutations + outbox)                      │
│                                                                              │
│  [2] PushReplicator.runOnce():                                               │
│      ├── Lire batch de sync_outbox (LIMIT 100, ORDER BY created_at ASC)    │
│      ├── Pour chaque message:                                               │
│      │   ├── Vérifier idempotence (outbox.id déjà traité côté Supabase ?)  │
│      │   ├── Transformer payload (ajouter entity_version, origin_node,     │
│      │   │     logical_clock à partir de la ligne SQLite)                  │
│      │   ├── Appeler Supabase upsert avec la clé (id, tenant_id)          │
│      │   │   └── Header: Idempotency-Key: outbox.id                       │
│      │   ├── SUCCESS → DELETE from sync_outbox                            │
│      │   └── FAILURE → Retry ou DLQ                                       │
│      └── Log metrics (pushed, errors, duration)                           │
│                                                                              │
│  [3] Mettre à jour replication_status = 'synced' sur l'entité source       │
│      (optionnel, pour traçabilité)                                          │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

#### Conventions d'API Supabase

| Opération | Méthode Supabase | Payload |
|-----------|------------------|---------|
| `insert` | `.insert([{...}])` avec `onConflict: 'id'` et `ignoreDuplicates: false` | Payload complet + `entity_version: 1, origin_node, logical_clock` |
| `update` | `.update({...}).eq('id', recordId)` avec header `Prefer: resolution=merge-duplicates` | Champs modifiés + `entity_version: incremented, origin_node, logical_clock` |
| `delete` | `.delete().eq('id', recordId)` | — |

### 4.2 Pull (Supabase → SQLite)

#### Schéma

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    PULL REPLICATION FLOW                                     │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [1] PullReplicator.runOnce():                                               │
│      ├── Lire le dernier curseur (SyncPersistedCursor) pour chaque entité  │
│      │   (ex: `last_pull_subscription`, `last_pull_tenant`)               │
│      ├── Pour chaque entité définie dans le registre:                       │
│      │   ├── SELECT FROM Supabase WHERE updated_at > cursor               │
│      │   │   ORDER BY updated_at ASC LIMIT batch_size                      │
│      │   ├── Pour chaque ligne distante:                                   │
│      │   │   ├── Lire la ligne locale correspondante (par remote_id)      │
│      │   │   ├── ConflictResolver.detect(local, remote):                   │
│      │   │   │   ├── Si remote.entity_version > local.entity_version:     │
│      │   │   │   │   → Appliquer remote (upsert local)                    │
│      │   │   │   ├── Si remote.entity_version < local.entity_version:     │
│      │   │   │   │   → Ignorer (local plus récent, sera pushé)            │
│      │   │   │   ├── Si remote.entity_version == local.entity_version:    │
│      │   │   │   │   → Comparer les timestamps ou logical_clock           │
│      │   │   │   │   → Appliquer la stratégie du domaine                  │
│      │   │   │   └── Si conflit non résoluble:                           │
│      │   │   │       → Enregistrer dans sync_conflicts                   │
│      │   │   │       → Appliquer 'remote_wins' par défaut                 │
│      │   │   ├── Upsert local:                                            │
│      │   │   │   ├── BEGIN TRANSACTION                                    │
│      │   │   │   ├── UPDATE/INSERT dans la table locale                  │
│      │   │   │   ├── Mettre à jour remote_id                             │
│      │   │   │   ├── Mettre à jour entity_version = remote.entity_version│
│      │   │   │   ├── Mettre à jour replicated_at                        │
│      │   │   │   └── COMMIT                                               │
│      │   └── Mettre à jour le curseur (SyncPersistedCursor.set)          │
│      └── Log metrics (pulled, conflicts, errors, duration)               │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Realtime Subscriptions (Supabase → SQLite)

Pour les mises à jour qui doivent être visibles immédiatement (ex: activation d'abonnement depuis l'admin) :

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    REALTIME REPLICATION FLOW                                 │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [1] RealtimeSubscriber s'abonne aux changements Supabase                   │
│      channel: 'replication:*'                                               │
│      filter: `tenant_id=eq.{currentTenantId}`                               │
│                                                                              │
│  [2] Quand une mise à jour est détectée :                                   │
│      ├── Vérifier origin_node ≠ local_node (éviter boucle)                │
│      ├── Lire remote_id local correspondant                               │
│      ├── ConflictResolver.detect(local, remote)                             │
│      ├── Si remote gagne : Upsert local avec les nouvelles données          │
│      ├── Mettre à jour entity_version, logical_clock, replicated_at        │
│      └── Émettre un événement local (EventBus) pour notifier le frontend   │
│                                                                              │
│  [3] Si l'entité est le statut d'abonnement :                               │
│      ├── Invalider le cache subscription                                    │
│      └── Notifier le frontend via SSE/WebSocket                             │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. POLITIQUE DE RÉSOLUTION DE CONFLITS PAR DOMAINE

### 5.1 Stratégies Disponibles

```typescript
type ConflictStrategy =
  | 'version_wins'          // La version la plus haute gagne
  | 'timestamp_wins'        // Le timestamp le plus récent gagne
  | 'local_wins'            // SQLite écrase toujours Supabase (push authority)
  | 'remote_wins'           // Supabase écrase toujours SQLite (pull authority)
  | 'field_merge'           // Fusion champ par champ (basé sur le plus récent)
  | 'manual'                // Conflit → notification admin → résolution manuelle
  | 'lamport_wins'          // L'horloge logique la plus haute gagne
  | 'last_write_wins'       // Le dernier écrit gagne (basé sur updated_at)
```

### 5.2 Matrice par Domaine

#### SUBSCRIPTION Context

| Entité | Opération | Push (SQLite→Supabase) | Pull (Supabase→SQLite) | Realtime |
|--------|-----------|------------------------|------------------------|----------|
| `subscription_payment_requests` | insert/update | `last_write_wins` | `remote_wins` (admin) | `remote_wins` |
| `subscriptions` | update (status) | `last_write_wins` | `remote_wins` | `remote_wins` |
| `subscriptions` | update (period_end) | `version_wins` | `version_wins` | `version_wins` |
| `plans` | insert/update | `last_write_wins` | `remote_wins` | `remote_wins` |

**Justification :** Les abonnements sont principalement modifiés par l'admin (Supabase). SQLite est la SOT pour les demandes de voucher. Le push propage les nouvelles demandes, le pull rapatrie les décisions admin.

#### TENANT Context

| Entité | Opération | Push | Pull | Realtime |
|--------|-----------|------|------|----------|
| `tenants` | update (status) | `last_write_wins` | `remote_wins` | `remote_wins` |
| `tenants` | update (settings) | `version_wins` | `version_wins` | `version_wins` |
| `tenants` | insert | `last_write_wins` | `remote_wins` | — |

**Justification :** Le statut est modifié par l'admin (activation, suspension). Les settings peuvent être modifiés des deux côtés.

#### ORDER Context

| Entité | Opération | Push | Pull | Realtime |
|--------|-----------|------|------|----------|
| `orders` | insert | `last_write_wins` | `sqlite_wins` | `local_wins` |
| `orders` | update (status) | `version_wins` | `version_wins` | `version_wins` |
| `order_items` | insert/update | `version_wins` | `version_wins` | `version_wins` |

**Justification :** Les commandes sont créées localement (POS). La réservation de stock est locale. La modification de statut (paid, cancelled) doit être versionnée.

#### PRODUCT Context

| Entité | Opération | Push | Pull | Realtime |
|--------|-----------|------|------|----------|
| `products` | insert/update | `timestamp_wins` | `timestamp_wins` | `timestamp_wins` |
| `categories` | insert/update | `timestamp_wins` | `timestamp_wins` | `timestamp_wins` |

**Justification :** Les produits peuvent être modifiés localement (tenant admin) ou depuis Supabase (import). Le timestamp le plus récent gagne pour éviter les pertes.

### 5.3 Règles de Résolution Prioritaire

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    PRIORITÉ DE RÉSOLUTION                                    │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ORDRE DE RÉSOLUTION :                                                       │
│                                                                              │
│  1. CHECK entity_version                                                    │
│     → Si local_version > remote_version : LOCAL WINS                        │
│     → Si remote_version > local_version : appliquer stratégie domaine       │
│     → Si equal : aller à l'étape 2                                          │
│                                                                              │
│  2. CHECK origin_node                                                       │
│     → Si local.origin_node == remote.origin_node :                          │
│       → Le même nœud a modifié les deux → version la plus récente gagne     │
│                                                                              │
│  3. CHECK logical_clock (Lamport)                                           │
│     → Si local_clock > remote_clock : LOCAL WINS                            │
│     → Si remote_clock > local_clock : REMOTE WINS                           │
│     → Si equal : aller à l'étape 4                                          │
│                                                                              │
│  4. APPLIER STRATÉGIE DOMAINE                                                │
│     → Voir matrice §5.2                                                     │
│                                                                              │
│  5. SI CONFLIT NON RÉSOLUBLE :                                              │
│     → Logguer dans sync_conflicts                                            │
│     → Appliquer 'remote_wins' par défaut (Supabase autoritaire admin)       │
│     → Déclencher alerte d'observabilité                                     │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. IDEMPOTENCE DES OPÉRATIONS DE RÉPLICATION

### 6.1 Principe

Chaque message outbox a un `id` (UUID v4). Ce même ID est utilisé comme `Idempotency-Key` dans les appels API Supabase.

```typescript
interface IdempotencyConfig {
  headerName: 'Idempotency-Key';
  keySource: 'outbox.id';        // UUID
  ttl: 604800;                    // 7 jours (une semaine)
  scope: 'global';               // Partagé entre toutes les routes
  storage: 'supabase_table';     // Table dédiée `replication_idempotency`
}
```

### 6.2 Gestion côté Supabase

```sql
-- Table de suivi d'idempotence pour la réplication
CREATE TABLE IF NOT EXISTS replication_idempotency (
  idempotency_key TEXT PRIMARY KEY,
  response_status INTEGER NOT NULL,
  response_body TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- Nettoyage automatique (cron)
CREATE INDEX IF NOT EXISTS idx_idempotency_expires 
ON replication_idempotency(expires_at);
```

### 6.3 Logique côté PushReplicator

```typescript
// Logique conceptuelle
class PushReplicator {
  async pushMessage(outboxMessage: OutboxMessage): Promise<PushResult> {
    const idempotencyKey = outboxMessage.id;

    // 1. Vérifier si déjà traité
    const alreadyProcessed = await this.supabase
      .from('replication_idempotency')
      .select('response_status')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (alreadyProcessed) {
      // Déjà traité → supprimer l'outbox
      await this.deleteOutboxMessage(outboxMessage.id);
      return { status: 'already_processed' };
    }

    // 2. Appel Supabase avec Idempotency-Key
    const response = await this.supabase
      .from(outboxMessage.entity)
      .upsert(outboxMessage.payload, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      })
      .header('Idempotency-Key', idempotencyKey);

    if (response.status === 200 || response.status === 201) {
      // 3. Enregistrer la clé d'idempotence
      await this.supabase
        .from('replication_idempotency')
        .insert({
          idempotency_key: idempotencyKey,
          response_status: response.status,
          response_body: JSON.stringify(response.data),
        });

      // 4. Supprimer l'outbox
      await this.deleteOutboxMessage(outboxMessage.id);
      return { status: 'pushed' };
    }

    // 5. Échec → retry ou DLQ
    return this.handleFailure(outboxMessage, response);
  }
}
```

### 6.4 Garanties

| Garantie | Détail |
|----------|--------|
| **At-least-once** | Chaque message outbox est traité au moins une fois. En cas de crash après le push mais avant la suppression de l'outbox, le message sera retraité. L'idempotence côté Supabase garantit qu'il n'est pas dupliqué. |
| **At-most-once** | L'idempotency key garantit que chaque message est appliqué au plus une fois côté Supabase. |
| **Exactly-once** | Combinaison des deux : au moins une fois (outbox) + idempotence (Supabase) = exactly once. |

---

## 7. DÉTECTION DES BOUCLES DE RÉPLICATION

### 7.1 Mécanisme

Une boucle de réplication se produit quand :
```
Node A push → Supabase → Realtime notification → Node B pull → Node B push → Supabase → Realtime → Node A pull → Node A push → ∞
```

### 7.2 Prévention par `origin_node`

Chaque nœud a un `origin_node` unique, persisté dans `settings` :

```sql
-- settings table
INSERT OR IGNORE INTO settings (key, value) VALUES ('replication.node_id', 'uuid_generated_at_first_startup');
```

**Règle :** Pendant le push, `origin_node` est celui du nœud local. Pendant le pull et le realtime, si `remote.origin_node == local.origin_node`, le message est ignoré (le local est déjà à jour).

### 7.3 Prévention par `logical_clock`

```typescript
// Dans le ConflictResolver
function detectLoop(localClock: number, remoteClock: number, localOrigin: string, remoteOrigin: string): boolean {
  // Si le même nœud a émis les deux mutations
  if (localOrigin === remoteOrigin) {
    // La plus haute horloge gagne — aucune boucle possible
    return false;
  }

  // Si l'horloge locale est plus haute que l'horloge distante
  // ET que le nœud distant a déjà vu cette version
  // → Potentielle boucle
  if (localClock > remoteClock) {
    // Vérifier si ce message a déjà été répliqué
    const alreadyReplicated = this.db.prepare(`
      SELECT 1 FROM replication_tracker 
      WHERE outbox_id = ? AND status = 'synced'
    `).get(remoteOutboxId);
    
    if (alreadyReplicated) {
      console.warn(`[Replication] Loop detected for outbox ${remoteOutboxId}, skipping`);
      return true;
    }
  }

  return false;
}
```

### 7.4 Table de Traçage (Replication Tracker)

```sql
CREATE TABLE IF NOT EXISTS replication_tracker (
  outbox_id TEXT PRIMARY KEY,         -- ID du message outbox
  entity TEXT NOT NULL,                -- Table concernée
  record_id TEXT NOT NULL,             -- ID de l'enregistrement
  origin_node TEXT NOT NULL,           -- Nœud d'origine
  logical_clock INTEGER NOT NULL,      -- Horloge au moment du push
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'synced' | 'skipped'
  pushed_at TEXT,                      -- Date du push
  pulled_at TEXT,                      -- Date du pull (si applicable)
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_replication_tracker_entity 
ON replication_tracker(entity, record_id);
```

---

## 8. REPLAY DES ÉVÉNEMENTS ET REPRISE APRÈS PANNE

### 8.1 Scénarios de Panne

| Scénario | Comportement | Récupération |
|----------|-------------|--------------|
| Crash SQLite avant COMMIT | Transaction rollback. Aucune donnée perdue. | Aucune action nécessaire |
| Crash SQLite après COMMIT, avant push | Outbox persistée. Données pas encore dans Supabase. | PushReplicator reprend au prochain cycle |
| Échec API Supabase (500, timeout) | Outbox reste en `pending`. Retry au prochain cycle. | Exponential backoff (1s → 30s) max 5 retries |
| Échec API Supabase (400, validation) | Message en DLQ. Ne sera pas retry automatiquement. | Alerte admin + retry manuel possible |
| Crash pendant le pull | Curseur non mis à jour. Prochain pull reprend du dernier curseur connu. | Aucune donnée perdue (idempotence) |
| Perte de connexion réseau | Outbox s'accumule. Push/Pull échouent. | Reprise automatique à la reconnexion |

### 8.2 Recovery Pipeline

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    RECOVERY PIPELINE                                         │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Au démarrage du ReplicationEngine :                                        │
│                                                                              │
│  [1] Vérifier l'intégrité de l'outbox                                       │
│      → Compter les messages 'processing' (laissés par un crash)            │
│      → Les remettre à 'pending' pour retraitement                           │
│                                                                              │
│  [2] RecoverInProgressItems() (existe déjà dans sync-orchestrator-v2.ts)    │
│      UPDATE sync_outbox SET status = 'pending' WHERE status = 'processing'  │
│                                                                              │
│  [3] Vérifier l'état de la DLQ                                              │
│      → Si des messages sont présents depuis > 1h : alerte                  │
│      → Si des messages sont présents depuis > 24h : notification admin     │
│                                                                              │
│  [4] Vérifier les curseurs de pull                                          │
│      → Si le curseur est trop vieux (> 1h) : forcer un pull complet        │
│      → Sinon : pull incrémental normal                                      │
│                                                                              │
│  [5] Lancer le cycle de réplication                                         │
│      → PushReplicator.runOnce()                                             │
│      → PullReplicator.runOnce()                                             │
│      → Vérifier les métriques et alerter si nécessaire                      │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Replay Manuel

L'interface admin (Platform Dashboard) doit permettre :

```typescript
interface ReplicationAdminAPI {
  // Retry un message DLQ
  retryDLQItem(dlqId: string): Promise<boolean>;

  // Retry tous les messages DLQ d'une entité
  retryAllByEntity(entity: string): Promise<number>;

  // Forcer un pull complet d'une entité
  forceFullPull(entity: string): Promise<PullResult>;

  // Forcer un push complet d'une entité
  forceFullPush(entity: string): Promise<PushResult>;

  // Rejouer tous les événements depuis le début (disaster recovery)
  replayAllEvents(): Promise<ReplayResult>;

  // Voir l'état actuel de la réplication
  getReplicationStatus(): ReplicationStatus;
}
```

### 8.4 Garanties de Reprise

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    GARANTIES DE REPRISE                                      │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  RPO (Recovery Point Objective) : Zéro perte de données                    │
│  → L'outbox est dans la même transaction SQLite                            │
│  → En cas de crash, seules les mutations non encore pushées sont perdues   │
│  → Mais elles sont dans l'outbox qui est persistée dans SQLite             │
│  → Donc RPO = 0 (aucune perte)                                             │
│                                                                              │
│  RTO (Recovery Time Objective) : < 30 secondes                              │
│  → Au démarrage, le recovery pipeline s'exécute en < 5s                    │
│  → Le premier cycle de push reprend les messages en 'processing'           │
│  → RTO = time to detect failure + recovery time < 30s                      │
│                                                                              │
│  MTBF (Mean Time Between Failures) : Non applicable (synchro asynchrone)   │
│  → La réplication asynchrone ne bloque pas le POS                          │
│  → Une panne du Replication Engine n'affecte pas le POS                    │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. DEAD LETTER QUEUE POUR SYNCHRONISATIONS IMPOSSIBLES

### 9.1 Architecture de la DLQ

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    DEAD LETTER QUEUE ARCHITECTURE                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Table : sync_dlq (existe déjà ✅ — à enrichir)                            │
│                                                                              │
│  Champs supplémentaires à ajouter :                                         │
│  ├── entity_version: number   — Version au moment de l'échec               │
│  ├── error_category: string   — 'network' | 'validation' | 'conflict'      │
│  │   | 'auth' | 'timeout' | 'unknown'                                      │
│  ├── last_error_detail: text  — Stack trace ou message d'erreur complet    │
│  └── retry_history: text      — JSON array des tentatives (timestamps)      │
│                                                                              │
│  Politique de rétention :                                                    │
│  ├── Erreur réseau (network, timeout) : retry automatique ×5               │
│  │   → Après 5 échecs : DLQ, alerte si > 1h                                │
│  ├── Erreur de validation (validation) : DLQ immédiat                      │
│  │   → Ne sera pas retry automatiquement                                    │
│  │   → Alerte immédiate à l'admin                                           │
│  ├── Erreur de conflit (conflict) : DLQ après résolution automatique       │
│  │   → Si le conflit n'est pas résoluble automatiquement                    │
│  │   → Alerte à l'admin avec les deux versions (local, remote)             │
│  ├── Erreur d'authentification (auth) : DLQ immédiat                       │
│  │   → Vérifier les credentials Supabase                                   │
│  │   → Alerte critique (toute la réplication peut être bloquée)            │
│  └── Erreur inconnue (unknown) : DLQ + alerte admin                        │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Catégories d'Erreurs et Actions

| Catégorie | Code HTTP | Action automatique | Alerte | Action admin |
|-----------|-----------|-------------------|--------|--------------|
| `network` | 0 (timeout) | Retry ×5 avec backoff | Si > 1h | Vérifier connexion |
| `timeout` | 504 | Retry ×5 avec backoff | Si > 1h | Vérifier latence Supabase |
| `validation` | 400, 422 | DLQ immédiat | Immédiate | Vérifier payload outbox |
| `auth` | 401, 403 | DLQ immédiat | Critique | Vérifier clés API Supabase |
| `conflict` | 409 | DLQ après résolution auto | Si manuel | Résoudre manuellement |
| `not_found` | 404 | DLQ immédiat | Moyenne | Vérifier table Supabase |
| `rate_limit` | 429 | Retry ×3 avec backoff long | Si persiste | Vérifier quotas Supabase |
| `server_error` | 500 | Retry ×5 | Si > 1h | Vérifier logs Supabase |
| `unknown` | autre | DLQ immédiat | Immédiate | Analyser logs |

### 9.3 Interface d'Administration DLQ

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    INTERFACE DLQ — PLATFORM DASHBOARD                        │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [DLQ Dashboard]                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Total: 12 | Network: 5 | Validation: 3 | Conflict: 2 | Auth: 1 | ?: 1 │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────┬──────────┬────────┬──────────┬──────────┬──────────┬──────────┐   │
│  │ Date │ Entity   │ Op     │ RecordID │ Error    │ Retry    │ Actions  │   │
│  ├──────┼──────────┼────────┼──────────┼──────────┼──────────┼──────────┤   │
│  │ 10:30│subscript │ update │ 42       │ network  │ 5/5      │ [Retry]  │   │
│  │ 10:15│order     │ insert │ 107      │ conflict │ 3/5      │ [Resolve]│   │
│  │ 09:50│product   │ update │ 89       │ validat  │ 1/1      │ [View]   │   │
│  └──────┴──────────┴────────┴──────────┴──────────┴──────────┴──────────┘   │
│                                                                              │
│  [Retry All] [Purge > 30 days] [Export CSV]                                 │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. OBSERVABILITÉ DE LA RÉPLICATION

### 10.1 Métriques Prometheus

```prometheus
# ── Push Replication ──
greatolive_push_total{entity="subscription", status="success"} 42
greatolive_push_total{entity="subscription", status="failure"} 2
greatolive_push_duration_ms{entity="subscription"} 234
greatolive_push_batch_size{entity="subscription"} 10
greatolive_outbox_depth{entity="subscription"} 0
greatolive_outbox_age_seconds{entity="subscription"} 0

# ── Pull Replication ──
greatolive_pull_total{entity="subscription", status="success"} 150
greatolive_pull_total{entity="subscription", status="conflict"} 1
greatolive_pull_duration_ms{entity="subscription"} 450
greatolive_pull_batch_size{entity="subscription"} 50
greatolive_cursor_lag_seconds{entity="subscription"} 12

# ── Dead Letter Queue ──
greatolive_dlq_depth{category="network"} 5
greatolive_dlq_depth{category="validation"} 3
greatolive_dlq_depth{category="conflict"} 2
greatolive_dlq_age_seconds{category="network"} 3600

# ── Conflicts ──
greatolive_conflict_total{entity="subscription", resolution="auto"} 1
greatolive_conflict_total{entity="subscription", resolution="manual"} 0
greatolive_conflict_resolution_duration_ms 120

# ── Loops ──
greatolive_loop_detected_total{entity="subscription"} 0

# ── Realtime ──
greatolive_realtime_events_received_total{entity="subscription"} 25
greatolive_realtime_events_processed_total{entity="subscription"} 25
greatolive_realtime_lag_ms{entity="subscription"} 200

# ── Health ──
greatolive_replication_healthy{node_id="node_A"} 1
greatolive_replication_last_success_timestamp{node_id="node_A"} 1700000000
```

### 10.2 Logs Structurés

```typescript
// Standard pour tous les logs de réplication
interface ReplicationLogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  correlationId: string;
  context: 'PushReplicator' | 'PullReplicator' | 'RealtimeSubscriber' | 'ConflictResolver' | 'DeadLetterQueue';
  
  // Identifiants
  nodeId: string;
  entity: string;
  operation: 'insert' | 'update' | 'delete';
  recordId: string;
  tenantId?: number;
  outboxId?: string;
  
  // Métriques
  duration: number;
  entityVersion: number;
  logicalClock: number;
  originNode: string;
  
  // Résultat
  status: 'success' | 'failure' | 'conflict' | 'skipped' | 'archived' | 'retry';
  conflictStrategy?: string;
  errorCategory?: string;
  errorMessage?: string;
  retryCount?: number;
}
```

### 10.3 Alertes

| Alerte | Seuil | Canal | Priorité |
|--------|-------|-------|----------|
| DLQ non vide depuis > 1h | `dlq_depth > 0` ET `max_age > 3600s` | Email + Slack | P2 |
| DLQ auth error | `error_category == 'auth'` | Email + Slack + SMS | P0 |
| Réplication bloquée depuis > 5min | `last_success_timestamp < now - 300s` | Email + Slack | P1 |
| Conflit non résolu depuis > 24h | `conflict.age > 86400s` | Email | P3 |
| Outbox depth > 1000 | `outbox_depth > 1000` | Email + Slack | P2 |
| Boucle de réplication détectée | `loop_detected > 0` | Email + Slack (critique) | P0 |
| Taux d'échec push > 10% | `push_failure_rate > 0.1` | Email | P2 |

### 10.4 Dashboard Grafana Suggestion

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    GRAFANA DASHBOARD — RÉPLICATION                           │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Row 1: Health                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│  │ Replication   │ │ Outbox Depth  │ │ DLQ Depth    │ │ Last Success  │      │
│  │ Status: ✅    │ │ 0             │ │ 12           │ │ 30s ago       │      │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘      │
│                                                                              │
│  Row 2: Push Metrics                                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │  Push Rate (ops/sec) — Time Series                                      ││
│  │  ████████████████░░░░░░░░░░░░░░░░░░░░░░░                              ││
│  └────────────────────────────────────────────────────────────────────────┘│
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │  Push Duration (ms) — Heatmap                                           ││
│  │  ████░░░░░░████░░░░░░████░░░░░░████░░░░                              ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  Row 3: DLQ Detail                                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │  Table: sync_dlq (entity, error, age, retry_count)                      ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 11. DIAGRAMME DE SÉQUENCE — ACTIVATION COMPLÈTE

```
┌────────────────────────────────────────────────────────────────────────────┐
│  DIAGRAMME DE SÉQUENCE — ACTIVATION D'ABONNEMENT AVEC RÉPLICATION V2.1      │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Admin          Route            DomainService   SQLite        Outbox       │
│   │               │                  │             │             │          │
│   │ POST /verify  │                  │             │             │          │
│   │──────────────►│                  │             │             │          │
│   │               │  verifyVoucher() │             │             │          │
│   │               │─────────────────►│             │             │          │
│   │               │                  │──BEGIN─────►│             │          │
│   │               │                  │ UPDATE req  │             │          │
│   │               │                  │────────────►│             │          │
│   │               │                  │ UPDATE sub  │             │          │
│   │               │                  │────────────►│             │          │
│   │               │                  │ UPDATE tnt  │             │          │
│   │               │                  │────────────►│             │          │
│   │               │                  │ INSERT msg  │────────────►│          │
│   │               │                  │────────────►│             │          │
│   │               │                  │──COMMIT────►│             │          │
│   │               │                  │             │             │          │
│   │               │                  │ invalidate  │             │          │
│   │               │                  │ cache(tnt)  │             │          │
│   │               │                  │ emit event  │             │          │
│   │               │                  │             │             │          │
│   │               │◄─────────────────│             │             │          │
│   │◄──────────────│                  │             │             │          │
│   │               │                  │             │             │          │
│   │  [ASYNC]      │                  │             │             │          │
│   │               │                  │             │             │          │
│   │               │                  │             │  PushReplicator        │
│   │               │                  │             │       │               │
│   │               │                  │             │  read outbox          │
│   │               │                  │             │◄──────│               │
│   │               │                  │             │       │               │
│   │               │                  │             │  POST Supabase        │
│   │               │                  │             │   (Idempotency-Key)   │
│   │               │                  │             │──────────────────────►│
│   │               │                  │             │       │  Supabase      │
│   │               │                  │             │  update success       │
│   │               │                  │             │◄──────────────────────│
│   │               │                  │             │       │               │
│   │               │                  │             │  delete outbox        │
│   │               │                  │             │── ─ ─►│               │
│   │               │                  │             │       │               │
│   │               │                  │             │  PullReplicator        │
│   │               │                  │             │  (other nodes)        │
│   │               │                  │             │       │               │
│   │               │                  │             │  SELECT Supabase      │
│   │               │                  │             │       │               │
│   │               │                  │             │  ConflictResolver     │
│   │               │                  │             │  (detect → resolve)   │
│   │               │                  │             │       │               │
│   │               │                  │             │  UPSERT SQLite        │
│   │               │                  │             │       │               │
│   │               │                  │             │  invalidate cache     │
│   │               │                  │             │       │               │
│   │               │                  │             │  notify frontend      │
│   │               │                  │             │       │               │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 12. ADR SPÉCIFIQUES À LA RÉPLICATION

### ADR-101 : Origin Node comme clé de boucle

| Attribut | Valeur |
|----------|--------|
| **Contexte** | La réplication bidirectionnelle peut créer des boucles infinis si un nœud réplique des données qu'il a lui-même générées |
| **Décision** | Chaque nœud a un `origin_node` unique, persisté dans `settings`. Pendant la réplication, si `local.origin_node === remote.origin_node`, le message est ignoré. |
| **Alternatives** | TTL sur les messages (imprécis), vector clock (trop complexe pour notre topologie), flag "already replicated" (nécessite une passe d'écriture supplémentaire) |
| **Date** | 2026-06-27 |

### ADR-102 : Horloge de Lamport pour l'ordre causal

| Attribut | Valeur |
|----------|--------|
| **Contexte** | Les timestamps ne sont pas fiables pour déterminer l'ordre des mutations (horloges système désynchronisées, fuseaux horaires) |
| **Décision** | Utiliser une horloge logique de Lamport (`logical_clock`) en plus des timestamps. Chaque mutation incrémente l'horloge locale. La valeur est transmise dans le payload de réplication. |
| **Conséquences** | Ordre causal garanti même si les horloges système diffèrent. Complexité ajoutée : chaque mutation doit incrémenter l'horloge. |
| **Date** | 2026-06-27 |

### ADR-103 : Version d'entité pour le conflict detection

| Attribut | Valeur |
|----------|--------|
| **Contexte** | Deux nœuds peuvent modifier la même entité simultanément. Besoin de détecter les conflits. |
| **Décision** | Chaque entité a un `entity_version` (INTEGER, monotone croissant). La version est vérifiée avant toute réplication : la version la plus haute gagne, sauf si la stratégie du domaine dit autrement. |
| **Conséquences** | Détection fiable des conflits. Overhead : chaque UPDATE doit incrémenter `entity_version` et vérifier la version actuelle. |
| **Date** | 2026-06-27 |

### ADR-104 : Idempotence par clé outbox

| Attribut | Valeur |
|----------|--------|
| **Contexte** | La réplication at-least-once peut causer des doublons si le push réussit mais que la confirmation est perdue |
| **Décision** | Chaque message outbox a un ID UUID qui sert d'`Idempotency-Key` dans la requête Supabase. Une table `replication_idempotency` stocke les clés traitées avec TTL 7 jours. |
| **Conséquences** | Exactly-once delivery garanti. Overhead : une table supplémentaire + une requête de vérification par message. |
| **Date** | 2026-06-27 |

### ADR-105 : Pull par curseur, pas par timestamp

| Attribut | Valeur |
|----------|--------|
| **Contexte** | Le pull incrémental utilisait `updated_at > last_pull_timestamp`, fragile car les timestamps peuvent être modifiés manuellement ou avoir une précision insuffisante. |
| **Décision** | Utiliser un curseur basé sur un compteur monotone (ID auto-incrémenté ou version globale). Chaque table Supabase a une colonne `replication_seq` qui est incrémentée à chaque modification. |
| **Conséquences** | Pull fiable même si les timestamps sont modifiés. Nécessite une colonne supplémentaire et un trigger de mise à jour sur chaque table Supabase. |
| **Date** | 2026-06-27 |

### ADR-106 : DLQ avec catégorisation d'erreur

| Attribut | Valeur |
|----------|--------|
| **Contexte** | Toutes les erreurs de réplication étaient traitées de la même façon (retry ×5 puis DLQ). Les erreurs de validation ne devraient pas être retryées. |
| **Décision** | Ajouter `error_category` à la DLQ. Les erreurs `network` et `timeout` sont retryées automatiquement. Les erreurs `validation` et `auth` sont mises en DLQ immédiatement avec alerte. |
| **Conséquences** | Meilleure gestion des erreurs. Moins de retry inutiles. Alertes plus précises. |
| **Date** | 2026-06-27 |

### ADR-107 : Pull authority pour les domaines admin

| Attribut | Valeur |
|----------|--------|
| **Contexte** | Les modifs admin (activation de voucher, suspension) sont faites depuis Supabase (Render cloud). SQLite local peut avoir un état obsolète. |
| **Décision** | Pour les domaines `subscription`, `tenant`, `plan`, la stratégie de conflit par défaut est `remote_wins` : les données Supabase écrasent SQLite lors du pull et du realtime. |
| **Conséquences** | Les décisions admin sont toujours prioritaires. SQLite est mis à jour rapidement. Le push ne fait que propager les demandes de voucher (pending → payment_sent). |
| **Date** | 2026-06-27 |

### ADR-108 : Realtime comme accélération, pas comme source de vérité

| Attribut | Valeur |
|----------|--------|
| **Contexte** | Supabase Realtime notifie instantanément les changements. Mais les messages peuvent être perdus (déconnexion, crash). |
| **Décision** | Le RealtimeSubscriber est un complément au PullReplicator, pas un remplacement. Toutes les données sont également rapatriées via le pull. Le Realtime sert à accélérer la propagation (secondes vs minutes). |
| **Conséquences** | La convergence est garantie même si Realtime perd des messages. Le Realtime améliore l'expérience utilisateur (mise à jour rapide du statut). |
| **Date** | 2026-06-27 |

---

## ANNEXE A — TABLEAU DE CORRESPONDANCE AVEC LE CODE EXISTANT

| Concept V2.1 | Code existant | Statut |
|-------------|---------------|--------|
| PushReplicator | `GenericSyncService.push()` (generic-sync.service.ts) | ✅ Existe, à enrichir |
| PullReplicator | `GenericSyncService.pull()` (generic-sync.service.ts) | ✅ Existe, à enrichir |
| RealtimeSubscriber | `SupabaseRealtimeSyncService` | ✅ Existe |
| ConflictResolver | `ConflictResolver` (conflict-resolver.ts) | ✅ Existe, stratégies à enrichir |
| DeadLetterQueue | `DeadLetterQueue` (dead-letter-queue.ts) | ✅ Existe, catégorisation à ajouter |
| SyncPersistedCursor | `SyncPersistedCursor` | ✅ Existe |
| OutboxMessage | `sync_outbox` table | ✅ Existe, champs à enrichir |
| `entity_version` | `version` dans certaines tables | ⚠️ À généraliser |
| `origin_node` | — | ❌ À ajouter |
| `logical_clock` | — | ❌ À ajouter |
| `replication_tracker` | — | ❌ À créer |
| `replication_idempotency` | — | ❌ À créer (Supabase) |
| `error_category` | — | ❌ À ajouter à sync_dlq |
| Observabilité réplication | — | ❌ À implémenter |

## ANNEXE B — GLOSSAIRE DE LA RÉPLICATION

| Terme | Définition |
|-------|------------|
| **Conflict Resolution** | Processus de détermination de la valeur correcte quand deux nœuds modifient la même entité |
| **Curseur** | Marqueur persistant qui indique jusqu'où le pull a été effectué |
| **Dead Letter Queue** | File d'attente des messages de réplication qui ont échoué définitivement |
| **Eventual Consistency** | Garantie que tous les nœuds convergeront vers la même valeur à terme, en l'absence de nouvelles écritures |
| **Horloge de Lamport** | Compteur logique qui établit un ordre causal entre les événements dans un système distribué |
| **Idempotence** | Propriété qui garantit qu'une opération peut être appliquée plusieurs fois sans effet de bord |
| **Origin Node** | Identifiant unique du nœud qui a généré une mutation |
| **Outbox** | Table SQLite qui stocke les mutations en attente de réplication |
| **Pull** | Direction de réplication Supabase → SQLite |
| **Push** | Direction de réplication SQLite → Supabase |
| **Realtime** | Abonnement aux changements Supabase via WebSocket pour propagation accélérée |
| **Replication Engine** | Ensemble des composants qui gèrent la réplication bidirectionnelle |
| **Replication Tracker** | Table qui trace l'historique des réplications pour détecter les boucles |
| **RPO** | Recovery Point Objective — perte de données maximale acceptable |
| **RTO** | Recovery Time Objective — temps de récupération maximal acceptable |
| **Source of Truth** | Système qui fait autorité. SQLite pour les écritures, Supabase pour l'admin |
| **Transactional Outbox** | Pattern qui écrit la mutation et le message outbox dans la même transaction |

---

*Document complémentaire à Architecture V2. Généré le 27/06/2026. Révision attendue : 27/06/2027 ou après implémentation complète.*