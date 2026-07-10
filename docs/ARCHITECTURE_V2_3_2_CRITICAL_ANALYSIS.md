# ANALYSE CRITIQUE DE PRODUCTION — Architecture V2.3.1
## Ekala POS — Système Outbox + Sync Dumb Pipe

---

## AVERTISSEMENT

Ce document est une **analyse critique** de l'architecture V2.3.1 pour identifier les risques de production réelle.

**Ce n'est PAS une nouvelle architecture.** C'est un audit de sécurité et de robustesse.

**Objectif** : Identifier les VRAIS problèmes qui casseront le système en production, pas les problèmes théoriques.

---

## 1. RISQUES RÉELS DE PRODUCTION

### 1.1 Perte d'événements (CRITIQUE)

| Risque | Probabilité | Impact | Scenario |
|---|---|---|---|
| **Crash serveur entre SQLite write et Outbox INSERT** | Élevée | CRITIQUE | Perte définitive de l'event |
| **Transaction SQLite rollback après Outbox INSERT** | Moyenne | CRITIQUE | Event orphelin dans Outbox |
| **Power loss pendant écriture Outbox** | Faible | CRITIQUE | Corruption Outbox |

**Analyse détaillée** :

```
❌ SCÉNARIO CATASTROPHIQUE :
1. UseCase démarre transaction
2. Repository écrit dans SQLite (UPDATE restaurant_tables)
3. CRASH serveur (power loss, OOM, kill -9)
4. Redémarrage
5. SQLite: données présentes
6. Outbox: VIDE
7. RÉSULTAT: Données locales sans synchronisation

IMPACT: Perte silencieuse de synchronisation
DÉTECTION: Difficile (pas d'erreur visible)
RÉCUPÉRATION: Manuelle uniquement
```

**Verdict** : **RISQUE CRITIQUE** — L'atomicité SQLite + Outbox n'est pas garantie en cas de crash.

---

### 1.2 Duplication d'événements (ÉLEVÉ)

| Risque | Probabilité | Impact | Scenario |
|---|---|---|---|
| **Retry sans idempotence** | Élevée | MOYEN | Doublons dans Supabase |
| **Double worker execution** | Moyenne | MOYEN | Même event traité 2x |
| **Network timeout + retry** | Élevée | MOYEN | Event envoyé 2x |

**Analyse détaillée** :

```
❌ SCÉNARIO :
1. SyncService envoie event vers Supabase
2. Supabase reçoit et traite (UPDATE restaurant_tables)
3. Network timeout avant réponse
4. SyncService retry (incrementRetry +1)
5. Supabase reçoit UPDATE 2x
6. RÉSULTAT: Pas de problème si UPDATE idempotent
7. MAIS: Si INSERT, risque de doublon

IMPACT: Incohérence données
DÉTECTION: Difficile
RÉCUPÉRATION: Complexe
```

**Verdict** : **RISQUE ÉLEVÉ** — Pas de garantie d'idempotence.

---

### 1.3 Incohérence SQLite ↔ Supabase (CRITIQUE)

| Risque | Probabilité | Impact | Scenario |
|---|---|---|---|
| **Sync partielle** | Élevée | CRITIQUE | SQLite OK, Supabase KO |
| **Conflict résolution absente** | Moyenne | CRITIQUE | Données divergentes |
| **Event ordre cassé** | Moyenne | ÉLEVÉ | État incohérent |

**Analyse détaillée** :

```
❌ SCÉNARIO CONFLIT :
1. Device A: assignWaiter(tableId=42, waiterId=15)
2. Device B: assignWaiter(tableId=42, waiterId=20)
3. SQLite Device A: waiter_id = 15
4. SQLite Device B: waiter_id = 20
5. Sync A → Supabase: waiter_id = 'uuid-15'
6. Sync B → Supabase: waiter_id = 'uuid-20'
7. RÉSULTAT: Dernier gagne (last-write-wins)

PROBLÈME: Pas de résolution de conflit
IMPACT: Perte de données
DÉTECTION: Difficile
```

**Verdict** : **RISQUE CRITIQUE** — Pas de stratégie de résolution de conflits.

---

### 1.4 Crash du SyncService (MOYEN)

| Risque | Probabilité | Impact | Scenario |
|---|---|---|---|
| **OOM pendant traitement** | Moyenne | MOYEN | Events perdus |
| **Exception non gérée** | Moyenne | MOYEN | Worker arrêté |
| **Supabase API change** | Faible | ÉLEVÉ | Sync cassé |

**Analyse détaillée** :

```
❌ SCÉNARIO :
1. SyncService traite 1000 events
2. Event #501 cause exception (format invalide)
3. Exception non catchée
4. Worker arrêté
5. Events #502-1000: bloqués
6. RÉSULTAT: Sync bloquée

IMPACT: Synchronisation arrêtée
DÉTECTION: Alerting requis
RÉCUPÉRATION: Redémarrage manuel
```

**Verdict** : **RISQUE MOYEN** — Nécessite un supervisor et alerting.

---

### 1.5 Retry infini (ÉLEVÉ)

| Risque | Probabilité | Impact | Scenario |
|---|---|---|--|
| **Event empoisonné** | ÉLEVÉ | MOYEN | Retry infini |
| **Supabase down prolongé** | MOYEN | MOYEN | Queue grandit |
| **Pas de backoff** | ÉLEVÉ | MOYEN | Surcharge Supabase |

**Analyse détaillée** :

```
❌ SCÉNARIO :
1. Event avec données invalides (waiterId = -1)
2. SyncService essaye d'envoyer
3. Supabase rejette (400 Bad Request)
4. incrementRetry: retry_count = 1
5. Retry dans 1 minute
6. ÉCHEC à nouveau
7. RÉSULTAT: Retry infini (max 3 fois dans V2.3.1)

PROBLÈME: Après 3 retries, event marqué FAILED
IMPACT: Perte d'event
DÉTECTION: Monitoring requis
```

**Verdict** : **RISQUE ÉLEVÉ** — Nécessite Dead Letter Queue.

---

### 1.6 Ordre des events cassé (MOYEN)

| Risque | Probabilité | Impact | Scenario |
|---|---|---|---|--|
| **Multi-devices** | ÉLEVÉ | MOYEN | Ordre non garanti |
| **Parallel sync** | MOYEN | MOYEN | Events traités dans désordre |
| **Network latency** | ÉLEVÉ | FAIBLE | Délai variable |

**Analyse détaillée** :

```
❌ SCÉNARIO :
1. Device A: createOrder() → event #1
2. Device A: addItem() → event #2
3. Device B: createOrder() → event #3
4. Sync A envoie event #2 avant event #1 (network latency)
5. Supabase reçoit addItem avant createOrder
6. RÉSULTAT: Erreur FK violation

IMPACT: Sync cassée
DÉTECTION: Erreur visible
RÉCUPÉRATION: Retry (mais ordre toujours cassé)
```

**Verdict** : **RISQUE MOYEN** — Nécessite ordering strategy.

---

### 1.7 Corruption de l'Outbox (FAIBLE)

| Risque | Probabilité | Impact | Scenario |
|---|---|---|---|--|
| **SQLite corruption** | FAIBLE | CRITIQUE | Perte totale |
| **Disk full** | FAIBLE | CRITIQUE | Écriture impossible |
| **Schema mismatch** | MOYEN | ÉLEVÉ | Erreur INSERT |

**Analyse détaillée** :

```
❌ SCÉNARIO :
1. Disk plein à 99%
2. Nouvel event dans Outbox
3. INSERT échoue (no space left)
4. Exception dans Repository
5. Transaction rollback
6. RÉSULTAT: Données métier perdues

IMPACT: Perte de données
DÉTECTION: Erreur immédiate
RÉCUPÉRATION: Difficile
```

**Verdict** : **RISQUE FAIBLE** — Monitoring disque requis.

---

### 1.8 Conflits de données multi-devices (CRITIQUE)

| Risque | Probabilité | Impact | Scenario |
|---|---|---|---|--|
| **Update concurrent** | ÉLEVÉ | CRITIQUE | Perte de données |
| **Delete + Update** | MOYEN | CRITIQUE | Incohérence |
| **FK violation** | MOYEN | ÉLEVÉ | Sync cassée |

**Analyse détaillée** :

```
❌ SCÉNARIO CONFLIT MULTI-DEVICES :
1. Device A: updateTable(42, status="occupied")
2. Device B: updateTable(42, status="available")
3. SQLite A: status = "occupied"
4. SQLite B: status = "available"
5. Sync A → Supabase: status = "occupied"
6. Sync B → Supabase: status = "available"
7. RÉSULTAT: Dernier gagne (last-write-wins)

PROBLÈME: Pas de détection de conflit
IMPACT: Perte de données métier
DÉTECTION: Difficile
RÉCUPÉRATION: Manuelle
```

**Verdict** : **RISQUE CRITIQUE** — Nécessite conflict resolution strategy.

---

## 2. SCÉNARIOS DE FAIL (CRASH SIMULATION)

### 2.1 SyncService crash en plein traitement

```
INITIAL STATE:
- Outbox: 100 events (PENDING)
- Supabase: sync à jour

CRASH:
- SyncService traite event #50
- Exception: Supabase API timeout
- Worker arrêté (pas de supervisor)
- Events #51-100: bloqués

APRÈS CRASH:
- Outbox: 49 events SENT, 1 event FAILED, 50 events PENDING
- Supabase: sync à jour jusqu'à event #49
- SQLite: toutes les données présentes

RÉCUPÉRATION:
- Redémarrage manuel du worker
- Retry events #50-100
- RÉSULTAT: Sync complète

VERDICT: ✅ Récupère (mais nécessite intervention manuelle)
```

---

### 2.2 Perte réseau Supabase

```
INITIAL STATE:
- Outbox: 100 events (PENDING)
- Supabase: sync à jour

CRASH:
- Network partition (Supabase inaccessible)
- SyncService essaye de traiter events
- Timeout après 30s
- Worker continue (gracefully)

APRÈS CRASH:
- Outbox: 100 events PENDING (retry_count = 0)
- Supabase: sync à jour
- SQLite: toutes les données présentes

RÉCUPÉRATION:
- Network revient
- Worker retry automatique
- RÉSULTAT: Sync complète

VERDICT: ✅ Récupère automatiquement
```

---

### 2.3 Redémarrage serveur

```
INITIAL STATE:
- Outbox: 100 events (PENDING)
- Supabase: sync à jour jusqu'à event #50

CRASH:
- Power loss
- Serveur arrêté brutalement
- SQLite: transaction en cours

APRÈS CRASH:
- SQLite: WAL replay automatique
- Si transaction commitée: données présentes + Outbox
- Si transaction rollback: données perdues + Outbox vide
- RÉSULTAT: ATOMICITÉ NON GARANTIE

SCÉNARIO CATASTROPHIQUE:
1. Transaction SQLite commitée
2. Outbox INSERT échoue (disk full)
3. CRASH
4. SQLite: données présentes
5. Outbox: VIDE
6. RÉSULTAT: Perte silencieuse de synchronisation

VERDICT: ❌ ATOMICITÉ NON GARANTIE — RISQUE CRITIQUE
```

---

### 2.4 Double exécution du worker

```
INITIAL STATE:
- Outbox: 100 events (PENDING)
- Supabase: sync à jour

CRASH:
- Worker 1 traite event #1
- Worker 2 démarre en même temps
- Worker 1 envoie event #1 vers Supabase
- Worker 2 envoie event #1 vers Supabase
- Doublon

APRÈS CRASH:
- Supabase: event #1 traité 2x
- Si UPDATE idempotent: pas de problème
- Si INSERT: doublon

VERDICT: ⚠️ DÉPEND DE L'IDEMPOTENCE SUPABASE
```

---

### 2.5 Transaction SQLite partiellement écrite

```
INITIAL STATE:
- Outbox: 0 events
- Supabase: sync à jour

CRASH:
1. Transaction démarre
2. UPDATE restaurant_tables SET status = "occupied"
3. INSERT INTO outbox_events
4. CRASH (avant COMMIT)

APRÈS CRASH:
- SQLite: WAL replay
- Si COMMIT: données + Outbox présentes
- Si ROLLBACK: données perdues + Outbox vide
- RÉSULTAT: ATOMICITÉ GARANTIE PAR SQLITE

VERDICT: ✅ SQLite garantit l'atomicité
```

---

## 3. ANALYSE DE ROBUSTESSE DE L'OUTBOX

### 3.1 Idempotence réelle des events

| Aspect | Status | Risque |
|---|---|---|
| **Event ID** | ❌ Absent | Pas de déduplication |
| **Idempotency Key** | ❌ Absente | Doublons possibles |
| **Supabase idempotence** | ⚠️ Dépend | INSERT = doublon garanti |

**Analyse** :

```typescript
// ❌ V2.3.1 ACTUEL
await this.supabaseAdapter.send(event.eventType, adaptedPayload);

// Supabase reçoit:
POST /rest/v1/restaurant_tables
{
  "id": "uuid-123",
  "name": "Table 42"
}

// Si retry: INSERT 2x → ERREUR ou DOUBLON
```

**Problème** : Pas de garantie d'idempotence.

---

### 3.2 Sécurité du retry mechanism

| Aspect | Status | Risque |
|---|---|---|
| **Retry count** | ✅ Présent | Max 3 retries |
| **Backoff** | ❌ Absent | Retry immédiat |
| **Dead Letter Queue** | ❌ Absente | Event empoisonné bloquant |
| **Retry limit** | ✅ Présent | Après 3: FAILED |

**Analyse** :

```typescript
// ❌ V2.3.1 ACTUEL
async incrementRetry(id: number): Promise<void> {
  this.db.prepare(`
    UPDATE outbox_events
    SET retry_count = retry_count + 1
    WHERE id = ?
  `).run(id);
}

// PROBLÈME: Pas de backoff, pas de DLQ
```

**Problème** : Retry immédiat peut surcharger Supabase.

---

### 3.3 Atomicité transaction SQLite + Outbox

| Aspect | Status | Risque |
|---|---|---|
| **Même transaction** | ✅ Oui | Atomicité garantie |
| **WAL mode** | ⚠️ Inconnu | Crash = corruption possible |
| **Journal mode** | ⚠️ Inconnu | Perte possible |

**Analyse** :

```sqlite
-- ✅ V2.3.1: Même transaction
BEGIN TRANSACTION;
  UPDATE restaurant_tables SET assigned_waiter_id = 15;
  INSERT INTO outbox_events (...);
COMMIT;

-- SQLite garantit l'atomicité SAUF crash power loss
-- Dans ce cas: WAL replay ou rollback
```

**Problème** : Power loss pendant écriture = corruption possible.

---

### 3.4 Garantie "at least once / exactly once"

| Garantie | Status | Commentaire |
|---|---|---|
| **At least once** | ✅ Oui | Retry jusqu'à SENT ou FAILED |
| **Exactly once** | ❌ Non | Pas d'idempotence |
| **At most once** | ❌ Non | Retry garanti |

**Analyse** :

```
V2.3.1 garantit: AT LEAST ONCE
- Event peut être envoyé plusieurs fois
- Pas de garantie d'idempotence
- Risque de doublons

Pour EXACTLY ONCE, il faut:
- Idempotency Key unique par event
- Supabase doit supporter idempotence
- Stocker status de chaque event (PENDING → SENT → FAILED)
```

---

### 3.5 Risque de doublons côté Supabase

| Opération | Risque | Impact |
|---|---|---|
| **INSERT** | ÉLEVÉ | Doublon garanti si retry |
| **UPDATE** | FAIBLE | Idempotent (last-write-wins) |
| **DELETE** | MOYEN | FK violation si retry |

**Analyse** :

```typescript
// ❌ INSERT sans idempotency key
await supabase
  .from('restaurant_tables')
  .insert({ id: 'uuid-123', name: 'Table 42' });

// Si retry: ERREUR (unique constraint) ou DOUBLON

// ✅ UPDATE idempotent
await supabase
  .from('restaurant_tables')
  .update({ name: 'Table 42' })
  .eq('id', 'uuid-123');

// Si retry: OK (last-write-wins)
```

---

## 4. PROBLÈMES DANS L'ACL (CRITIQUE)

### 4.1 IdentityMapper — Risque de désynchronisation

| Problème | Probabilité | Impact | Scenario |
|---|---|---|---|--|
| **Mapping partiel** | ÉLEVÉ | CRITIQUE | waiterId mappé, tableId pas |
| **Race condition** | MOYEN | ÉLEVÉ | Deux mappings créés |
| **Memory leak** | MOYEN | MOYEN | IdentityMap grandit |

**Analyse détaillée** :

```
❌ SCÉNARIO MAPPING PARTIEL :
1. Event: { tableId: 42, waiterId: 15 }
2. applyACL() appelé
3. if (result.waiterId) → sqliteToCanonical(15) → 'uuid-waiter-15'
4. if (result.tableId) → ❌ PAS DE MAPPING POUR tableId
5. RÉSULTAT: waiterId mappé, tableId pas

PROBLÈME: Mapping partiel
IMPACT: Supabase reçoit waiterId UUID mais tableId INTEGER
```

**Code problématique** :

```typescript
// ❌ V2.3.1: Mapping hardcoded
private async applyACL(payload: any): Promise<any> {
  const result = { ...payload };
  
  // Identity mapping (générique, pas de if métier)
  if (result.waiterId) {  // ❌ HARDCODÉ
    result.waiterId = await this.identityMapper.sqliteToCanonical(result.waiterId);
  }
  
  return this.supabaseAdapter.adaptToSupabase(result);
}
```

**Verdict** : **RISQUE CRITIQUE** — Mapping hardcoded, pas générique.

---

### 4.2 SchemaMapper — Risque de corruption silencieuse

| Problème | Probabilité | Impact | Scenario |
|---|---|---|---|--|
| **Champ manquant** | ÉLEVÉ | ÉLEVÉ | data: { id: 1 } → id: undefined |
| **Type mismatch** | MOYEN | ÉLEVÉ | string → number |
| **Null handling** | MOYEN | MOYEN | null → undefined |

**Analyse détaillée** :

```typescript
// ❌ V2.3.1: Risque de corruption
adaptToSupabase(data: any): any {
  return {
    ...data,
    created_at: data.timestamp 
      ? new Date(data.timestamp).toISOString() 
      : new Date().toISOString(),  // ❌ Date actuelle si timestamp manquant
    id: undefined  // ❌ Supprime toujours id
  };
}
```

**Problèmes** :
1. Si `data.timestamp` manquant → date actuelle (faux)
2. Si `data.id` existe → supprimé (pourrait être nécessaire)
3. Pas de validation de types

**Verdict** : **RISQUE ÉLEVÉ** — Corruption silencieuse possible.

---

### 4.3 Mapping sqliteId → canonicalId → supabaseId

| Problème | Probabilité | Impact | Scenario |
|---|---|---|---|--|
| **Mapping orphelin** | ÉLEVÉ | MOYEN | sqliteId mappé mais jamais utilisé |
| **Race condition** | MOYEN | ÉLEVÉ | Deux canonicalId pour même sqliteId |
| **Memory leak** | MOYEN | MOYEN | IdentityMap grandit indéfiniment |

**Analyse détaillée** :

```
❌ SCÉNARIO RACE CONDITION :
1. Device A: sqliteToCanonical(15)
2. Device B: sqliteToCanonical(15)
3. Device A: findBySqliteId(15) → null
4. Device B: findBySqliteId(15) → null
5. Device A: create(sqliteId: 15, canonicalId: 'uuid-A')
6. Device B: create(sqliteId: 15, canonicalId: 'uuid-B')
7. RÉSULTAT: DEUX canonicalId pour même sqliteId

PROBLÈME: Pas de verrou
IMPACT: Incohérence
```

**Verdict** : **RISQUE MOYEN** — Nécessite verrou ou unique constraint.

---

### 4.4 Cas où mapping partiel existe

| Scenario | Probabilité | Impact | Résultat |
|---|---|---|---|--|
| **waiterId mappé, tableId pas** | ÉLEVÉ | CRITIQUE | Supabase reçoit UUID + INTEGER |
| **canonicalId existe, supabaseId pas** | MOYEN | ÉLEVÉ | Création nouveau supabaseId |
| **Mapping orphelin** | MOYEN | MOYEN | Entrée inutile dans IdentityMap |

**Analyse** :

```
❌ SCÉNARIO MAPPING PARTIEL :
1. Event #1: assignWaiter(tableId=42, waiterId=15)
2. IdentityMapper: waiterId 15 → 'uuid-waiter-15'
3. Event #2: assignWaiter(tableId=42, waiterId=20)
4. IdentityMapper: waiterId 20 → 'uuid-waiter-20'
5. Event #3: updateTable(tableId=42, status="occupied")
6. applyACL(): PAS DE MAPPING POUR tableId
7. RÉSULTAT: Supabase reçoit { tableId: 42, waiterId: 'uuid-waiter-20', status: "occupied" }

PROBLÈME: tableId est INTEGER (42) au lieu de UUID
IMPACT: FK violation dans Supabase
```

**Verdict** : **RISQUE CRITIQUE** — Mapping partiel casse la sync.

---

## 5. AMÉLIORATIONS V2.3.2

### 5.1 Idempotency Keys

**Problème résolu** : Doublons d'events

**Solution** :

```typescript
// OutboxEvent avec idempotency key
export interface OutboxEvent {
  id: number;
  eventType: string;
  payload: string;
  status: OutboxStatus;
  idempotencyKey: string;  // ✅ NOUVEAU
  retryCount: number;
  createdAt: Date;
  processedAt: Date | null;
}

// Génération dans HybridRepository
async assignWaiter(tableId: TableId, waiterId: WaiterId): Promise<void> {
  const idempotencyKey = `assignWaiter-${tableId.value}-${Date.now()}`;
  
  await this.outboxRepository.save({
    eventType: 'WaiterAssigned',
    payload: JSON.stringify({...}),
    idempotencyKey,  // ✅
    status: OutboxStatus.PENDING,
    retryCount: 0,
    createdAt: new Date()
  });
}

// Supabase reçoit idempotency key
await supabase
  .from('restaurant_tables')
  .update({...})
  .eq('id', 'uuid-123')
  .eq('idempotency_key', idempotencyKey);  // ✅ Évite doublon
```

**Bénéfice** : Garantit idempotence côté Supabase.

---

### 5.2 Event Versioning

**Problème résolu** : Schema evolution

**Solution** :

```typescript
// OutboxEvent avec version
export interface OutboxEvent {
  id: number;
  eventType: string;
  version: string;  // ✅ NOUVEAU
  payload: string;
  status: OutboxStatus;
  retryCount: number;
  createdAt: Date;
}

// Exemple
await this.outboxRepository.save({
  eventType: 'WaiterAssigned',
  version: '1.0.0',  // ✅
  payload: JSON.stringify({...}),
  ...
});

// SyncService gère les versions
async processOutbox(): Promise<void> {
  for (const event of events) {
    const adapter = this.getAdapter(event.eventType, event.version);
    await adapter.send(event);
  }
}
```

**Bénéfice** : Évolution du schema sans casser la sync.

---

### 5.3 Dead Letter Queue (DLQ)

**Problème résolu** : Event empoisonné bloquant

**Solution** :

```typescript
// Nouvelle table: outbox_dlq
export interface IOutboxDLQRepository {
  save(event: OutboxEvent, error: string): Promise<void>;
  findStuck(maxRetries: number): Promise<OutboxEvent[]>;
  delete(id: number): Promise<void>;
}

// SynchronizationService avec DLQ
async processOutbox(): Promise<void> {
  const events = await this.outboxRepository.findPending();
  
  for (const event of events) {
    try {
      await this.processEvent(event);
      await this.outboxRepository.markAsSent(event.id);
      
    } catch (error) {
      if (event.retryCount >= 3) {
        // ✅ DLQ au lieu de FAILED
        await this.outboxDLQRepository.save(event, error.message);
        await this.outboxRepository.delete(event.id);
      } else {
        await this.outboxRepository.incrementRetry(event.id);
      }
    }
  }
}
```

**Bénéfice** : Events empoisonnés isolés, pas de blocage.

---

### 5.4 Retry Backoff Intelligent

**Problème résolu** : Retry immédiat surcharge Supabase

**Solution** :

```typescript
export class RetryPolicy {
  getDelay(retryCount: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    return Math.min(1000 * Math.pow(2, retryCount), 16000);
  }
  
  getMaxRetries(errorType: ErrorType): number {
    switch (errorType) {
      case ErrorType.NETWORK: return 5;
      case ErrorType.VALIDATION: return 0;  // Pas de retry
      case ErrorType.RATE_LIMIT: return 3;
      default: return 3;
    }
  }
}

// Utilisation
async incrementRetry(id: number): Promise<void> {
  const event = await this.outboxRepository.findById(id);
  const delay = this.retryPolicy.getDelay(event.retryCount);
  
  await this.outboxRepository.scheduleRetry(id, delay);
}
```

**Bénéfice** : Moins de charge, meilleure résilience.

---

### 5.5 Reconciliation Job

**Problème résolu** : Incohérence SQLite ↔ Supabase

**Solution** :

```typescript
export class ReconciliationJob {
  constructor(
    private outboxRepository: IOutboxRepository,
    private supabaseAdapter: SupabaseAdapter
  ) {}
  
  async reconcile(): Promise<ReconciliationReport> {
    const report = {
      sqliteOnly: [],
      supabaseOnly: [],
      conflicts: []
    };
    
    // 1. Comparer les données
    const sqliteData = await this.getSqliteData();
    const supabaseData = await this.getSupabaseData();
    
    // 2. Détecter les différences
    for (const sqliteItem of sqliteData) {
      const supabaseItem = supabaseData.find(s => s.id === sqliteItem.id);
      
      if (!supabaseItem) {
        report.sqliteOnly.push(sqliteItem);
      } else if (sqliteItem.updatedAt > supabaseItem.updatedAt) {
        report.conflicts.push({ sqlite: sqliteItem, supabase: supabaseItem });
      }
    }
    
    // 3. Résoudre les conflits (last-write-wins)
    for (const conflict of report.conflicts) {
      await this.supabaseAdapter.update(conflict.sqlite);
    }
    
    return report;
  }
}
```

**Bénéfice** : Détection et résolution automatique des incohérences.

---

### 5.6 Ordering Strategy

**Problème résolu** : Ordre des events cassé

**Solution** :

```typescript
// Option 1: Séquence globale
export interface OutboxEvent {
  id: number;
  sequence: number;  // ✅ NOUVEAU
  eventType: string;
  payload: string;
  status: OutboxStatus;
}

// Génération séquence
async function getNextSequence(): Promise<number> {
  const result = await db.prepare(`
    SELECT MAX(sequence) as max FROM outbox_events
  `).first();
  return (result.max || 0) + 1;
}

// SyncService traite dans l'ordre
async processOutbox(): Promise<void> {
  const events = await this.outboxRepository.findPendingOrdered();
  for (const event of events) {
    await this.processEvent(event);
  }
}
```

**Alternative** : Partition par entité

```typescript
// Traiter les events par table, puis par ordre
async processOutbox(): Promise<void> {
  const tables = ['restaurant_tables', 'orders', 'users'];
  
  for (const table of tables) {
    const events = await this.outboxRepository.findByTableOrdered(table);
    for (const event of events) {
      await this.processEvent(event);
    }
  }
}
```

**Bénéfice** : Garantit l'ordre des events.

---

### 5.7 Protection contre Double Worker Execution

**Problème résolu** : Deux workers traitent le même event

**Solution** :

```typescript
// Option 1: Verrou distribué (Redis)
export class DistributedLock {
  constructor(private redis: Redis) {}
  
  async acquire(key: string, ttl: number): Promise<boolean> {
    const result = await this.redis.set(key, '1', 'NX', 'EX', ttl);
    return result === 'OK';
  }
  
  async release(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

// Utilisation
async processOutbox(): Promise<void> {
  const lock = await this.distributedLock.acquire('sync-worker', 60);
  
  if (!lock) {
    throw new Error('Another worker is running');
  }
  
  try {
    // Traitement
  } finally {
    await this.distributedLock.release('sync-worker');
  }
}
```

**Alternative** : Database lock

```sqlite
BEGIN TRANSACTION;
  SELECT * FROM sync_lock WHERE id = 1 FOR UPDATE;
  -- Si lock actif (> 5min), considérer comme mort
  UPDATE sync_lock SET locked_at = datetime('now'), worker_id = ?;
COMMIT;
```

**Bénéfice** : Un seul worker à la fois.

---

## 6. PRIORISATION DES AMÉLIORATIONS

### 6.1 Matrice de priorité

| Amélioration | Impact | Effort | Priorité |
|---|---|---|---|
| **Idempotency Keys** | CRITIQUE | MOYEN | P0 |
| **Reconciliation Job** | CRITIQUE | ÉLEVÉ | P1 |
| **Dead Letter Queue** | ÉLEVÉ | MOYEN | P1 |
| **Retry Backoff** | MOYEN | FAIBLE | P2 |
| **Event Versioning** | MOYEN | ÉLEVÉ | P2 |
| **Ordering Strategy** | MOYEN | MOYEN | P3 |
| **Double Worker Protection** | FAIBLE | MOYEN | P3 |

---

### 6.2 Plan d'implémentation V2.3.2

**Phase 1 — Survie (P0-P1)** :
1. Idempotency Keys
2. Dead Letter Queue
3. Retry Backoff

**Phase 2 — Robustesse (P1-P2)** :
4. Reconciliation Job
5. Event Versioning

**Phase 3 — Optimisation (P3)** :
6. Ordering Strategy
7. Double Worker Protection

---

## 7. CONCLUSION

### 7.1 Verdict critique

| Aspect | V2.3.1 | V2.3.2 (avec améliorations) |
|---|---|---|
| **Perte d'events** | ❌ CRITIQUE | ✅ Garanti |
| **Duplication** | ❌ ÉLEVÉ | ✅ Garanti |
| **Incohérence** | ❌ CRITIQUE | ✅ Détecté + résolu |
| **Crash recovery** | ⚠️ MOYEN | ✅ Automatique |
| **Idempotence** | ❌ Absente | ✅ Garantie |
| **Conflict resolution** | ❌ Absente | ✅ Automatique |

---

### 7.2 Recommandation

**V2.3.1** :
- ✅ Architecture conceptuellement saine
- ❌ PAS PRÊTE pour production réelle
- ❌ Risques critiques non mitigés

**V2.3.2** :
- ✅ Ajouter Idempotency Keys (P0)
- ✅ Ajouter DLQ (P1)
- ✅ Ajouter Reconciliation Job (P1)
- ✅ Ajouter Retry Backoff (P2)
- ✅ Prête pour production

---

### 7.3 Actions immédiates

1. **NE PAS déployer V2.3.1 en production sans améliorations**
2. **Implémenter V2.3.2 Phase 1 avant tout déploiement**
3. **Ajouter monitoring et alerting**
4. **Tester crash scenarios en staging**
5. **Préparer runbook de récupération**

---

**Document généré le** : 2026-06-07  
**Auteur** : Software Architect Principal  
**Status** : Analyse critique finalisée  
**Fichier** : `docs/ARCHITECTURE_V2_3_2_CRITICAL_ANALYSIS.md`

**Verdict final** : V2.3.1 nécessite V2.3.2 pour production.