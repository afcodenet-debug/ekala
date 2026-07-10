# Architecture V2.3.2 — Implémentation Production-Grade

## Résumé des améliorations

V2.3.2 ajoute les couches critiques manquantes identifiées dans l'analyse de production pour rendre le système de synchronisation résilient et prêt pour Render.

## Composants ajoutés

### 1. Migration SQL (055_outbox_v2_3_2.sql)

**Nouvelles tables:**
- `sync_outbox_dlq` — Dead Letter Queue pour les échecs définitifs
- `sync_locks` — Locks distribués pour multi-worker

**Nouvelles colonnes dans sync_outbox:**
- `version` — Versioning des événements (pour migration future)
- `idempotency_key` — Clé d'idempotence (UNIQUE)
- `max_retries` — Nombre max de retries (défaut: 3)
- `next_retry_at` — Timestamp du prochain retry
- `sequence` — Ordre global des événements
- `error` — Dernière erreur rencontrée

**Triggers:**
- `generate_idempotency_key` — Auto-génération pour backward compat
- `generate_sequence` — Auto-génération de séquence

### 2. RetryPolicy (retry-policy.ts)

**Responsabilités:**
- Classifier les erreurs (NETWORK, VALIDATION, RATE_LIMIT, SUPABASE_ERROR, UNKNOWN)
- Calculer le délai de retry avec exponential backoff (1s → 2s → 4s → 8s → 16s max)
- Déterminer le nombre max de retries selon le type d'erreur

**Utilisation:**
```typescript
const policy = new RetryPolicy();
const errorType = policy.classifyError(error);
const maxRetries = policy.getMaxRetries(errorType);
const delay = policy.getDelay(retryCount);
const nextRetry = policy.calculateRetryDelay(retryCount);
```

### 3. OutboxRepository (outbox-repository.ts)

**Responsabilités:**
- Stocker les événements avec idempotency garantie
- Maintenir l'ordre global des événements (sequence)
- Gérer le cycle de vie: PENDING → PROCESSING → SENT | FAILED → DLQ

**Garanties:**
- Zéro perte d'événements (transaction atomique)
- Idempotence (unicité idempotency_key)
- Ordering (sequence globale auto-incrémentée)
- Retry avec backoff (next_retry_at)

**Interface:**
```typescript
interface IOutboxRepository {
  save(event): Promise<void>;
  findPendingOrdered(): Promise<OutboxEvent[]>;
  markAsProcessing(id): Promise<void>;
  markAsSent(id): Promise<void>;
  incrementRetry(id, error): Promise<void>;
  moveToDLQ(id, error): Promise<void>;
  findByIdempotencyKey(key): Promise<OutboxEvent | null>;
  getNextSequence(): Promise<number>;
  acquireLock(key, ttl): Promise<boolean>;
  releaseLock(key): Promise<void>;
}
```

### 4. DeadLetterQueue Repository (dead-letter-queue.repository.ts)

**Responsabilités:**
- Stocker les événements qui ont échoué après max_retries
- Permettre le replay manuel ou automatique
- Tracker les erreurs pour debugging

**Interface:**
```typescript
interface IDLQRepository {
  add(eventType, version, payload, idempotencyKey, error): Promise<void>;
  findAll(): Promise<DeadLetterEvent[]>;
  findByIdempotencyKey(key): Promise<DeadLetterEvent | null>;
  markAsProcessed(id): Promise<void>;
  delete(id): Promise<void>;
  getCount(): Promise<number>;
  clear(): Promise<void>;
}
```

### 5. DistributedLock (distributed-lock.ts)

**Responsabilités:**
- Prévenir les race conditions en environnement multi-worker
- TTL automatique pour éviter les deadlocks
- Support pour Redis (production) et SQLite (dév)

**Interface:**
```typescript
class DistributedLock {
  async acquire(key, options): Promise<boolean>;
  async release(key): Promise<void>;
  async renew(key, ttl): Promise<boolean>;
  async isLocked(key): Promise<boolean>;
  async cleanupExpired(): Promise<number>;
  async withLock<T>(key, fn, options): Promise<T>;
}
```

### 6. ReconciliationJob (reconciliation-job.ts)

**Responsabilités:**
- Détecter les incohérences entre local et remote
- Corriger les remote_ids manquants
- Valider l'intégrité après sync
- Générer des alertes si anomalies
- Tenter un retry automatique pour les erreurs réseau en DLQ

**Vérifications:**
1. **Missing Remote IDs** — Re-queue automatique des enregistrements sans remote_id
2. **Orphan Records** — Corriger les users sans tenant_users
3. **Sequence Consistency** — Détecter les queues d'événements anormales (>1000)
4. **DLQ Health** — Retry automatique des erreurs réseau/Supabase

**Interface:**
```typescript
interface ReconciliationJob {
  run(tenantId: number): Promise<ReconciliationResult>;
  runGlobal(): Promise<Map<number, ReconciliationResult>>;
}

interface ReconciliationResult {
  checkedEntities: number;
  fixedRecords: number;
  missingRemoteIds: number;
  orphanRecords: number;
  inconsistencies: string[];
  duration: number;
}
```

## Intégration dans SyncOrchestratorV2

### Modifications requises

**1. Ajouter les dépendances dans le constructeur:**

```typescript
import { 
  SqliteOutboxRepositoryFactory,
  SqliteDLQRepositoryFactory,
  ReconciliationJobFactory,
  RetryPolicy 
} from './synchronization';

constructor(db, supabaseUrl, supabaseAnonKey, ...) {
  // ... existing code ...
  
  // V2.3.2 components
  this.outboxRepo = SqliteOutboxRepositoryFactory.create();
  this.dlqRepo = SqliteDLQRepositoryFactory.create();
  this.retryPolicy = new RetryPolicy();
  this.reconciliationJob = ReconciliationJobFactory.create(
    supabaseUrl,
    supabaseAnonKey
  );
}
```

**2. Modifier queueChange pour utiliser l'idempotency:**

```typescript
async queueChange(
  entity: string,
  operation: 'insert' | 'update' | 'delete',
  record: any
): Promise<void> {
  const idempotencyKey = `${entity}:${record.id}:${operation}:${Date.now()}`;
  
  await this.outboxRepo.save({
    eventType: operation,
    entity,
    recordId: record.id,
    payload: JSON.stringify(record),
    idempotencyKey,
    status: OutboxStatus.PENDING,
    retryCount: 0,
    maxRetries: 3,
    nextRetryAt: new Date(Date.now() + 1000),
    error: null,
    createdAt: new Date(),
    processedAt: null
  });
}
```

**3. Ajouter la réconciliation après sync:**

```typescript
private async syncTenant(tenantId: string): Promise<void> {
  // ... existing sync logic ...
  
  // V2.3.2: Post-sync reconciliation
  const reconciliationResult = await this.reconciliationJob.run(Number(tenantId));
  
  if (reconciliationResult.inconsistencies.length > 0) {
    console.warn(`[SyncV2] Reconciliation found issues:`, reconciliationResult);
  }
}
```

**4. Modifier le traitement DLQ:**

```typescript
private async processOutboxWithRetry(): Promise<void> {
  const pendingEvents = await this.outboxRepo.findPendingOrdered();
  
  for (const event of pendingEvents) {
    try {
      await this.outboxRepo.markAsProcessing(event.id);
      
      // Process event...
      await this.processEvent(event);
      
      await this.outboxRepo.markAsSent(event.id);
    } catch (err) {
      const errorType = this.retryPolicy.classifyError(err as Error);
      await this.outboxRepo.incrementRetry(event.id, (err as Error).message);
    }
  }
}
```

## Ordre de migration

**Étape 1: Appliquer la migration SQL**
```bash
sqlite3 backend/database.sqlite < backend/migrations/055_outbox_v2_3_2.sql
```

**Étape 2: Déployer le code**
- Les nouveaux services sont créés mais pas encore utilisés
- Aucun changement de comportement dans un premier temps

**Étape 3: Activer progressivement**
- Mettre à jour `SyncOrchestratorV2` pour utiliser les nouveaux repositories
- Tester en production avec un seul tenant
- Monitorer les logs DLQ

**Étape 4: Rollback plan**
- Si problème, désactiver les appels aux nouveaux services
- L'ancien système reste fonctionnel

## Monitoring et alerting

### Métriques à surveiller

1. **DLQ Count** — Nombre d'événements en Dead Letter Queue
   - Alerte si > 10 événements
   - Action: Investigation manuelle

2. **Outbox Queue Size** — Nombre d'événements pending
   - Alerte si > 1000 événements
   - Action: Vérifier la connectivité Supabase

3. **Retry Rate** — Pourcentage d'événements en retry
   - Alerte si > 20% des événements
   - Action: Vérifier les erreurs réseau

4. **Reconciliation Issues** — Nombre d'incohérences détectées
   - Alerte si > 0 incohérences non corrigées
   - Action: Investigation manuelle

### Logs à vérifier

```typescript
// Format des logs V2.3.2
console.log('[SyncV2] Reconciliation found issues:', {
  tenantId,
  missingRemoteIds: result.missingRemoteIds,
  orphanRecords: result.orphanRecords,
  inconsistencies: result.inconsistencies,
  fixedRecords: result.fixedRecords,
  duration: `${result.duration}ms`
});
```

## Tests de validation

### Test 1: Idempotency
```typescript
// Créer le même événement 2 fois
await outboxRepo.save({ idempotencyKey: 'test:1', ... });
await outboxRepo.save({ idempotencyKey: 'test:1', ... });

// Vérifier qu'un seul événement existe
const count = await outboxRepo.findByIdempotencyKey('test:1');
expect(count).toBeDefined();
```

### Test 2: Retry avec backoff
```typescript
// Simuler un échec
await outboxRepo.save({ ... });
await outboxRepo.markAsProcessing(1);
await outboxRepo.incrementRetry(1, 'Network error');

// Vérifier le backoff
const event = await outboxRepo.findByIdempotencyKey('...');
expect(event?.retryCount).toBe(1);
expect(event?.nextRetryAt).toBeGreaterThan(new Date());
```

### Test 3: DLQ
```typescript
// Épuiser les retries
for (let i = 0; i < 3; i++) {
  await outboxRepo.incrementRetry(1, 'Error');
}

// Vérifier que l'événement est en DLQ
const dlqCount = await dlqRepo.getCount();
expect(dlqCount).toBe(1);
```

### Test 4: Reconciliation
```typescript
// Créer un enregistrement sans remote_id
db.prepare('INSERT INTO products (tenant_id, name) VALUES (?, ?)').run(1, 'Test');

// Exécuter la réconciliation
const result = await reconciliationJob.run(1);

// Vérifier que le problème est détecté et corrigé
expect(result.missingRemoteIds).toBeGreaterThan(0);
expect(result.fixedRecords).toBeGreaterThan(0);
```

## Performance

### Impact estimé

- **CPU:** +5-10% (due to reconciliation checks)
- **Mémoire:** +10-20MB (new repositories in memory)
- **Disque:** +2-5MB (new tables and indexes)
- **Réseau:** Aucun impact supplémentaire

### Optimisations

1. **Reconciliation async** — Exécuter la réconciliation en arrière-plan
2. **DLQ cleanup** — Nettoyer automatiquement les événements traités > 7 jours
3. **Lock cleanup** — Nettoyer les locks expirés toutes les heures

## Rollback

### Procédure de rollback

1. **Arrêter l'application**
2. **Restaurer la migration:**
   ```sql
   DROP TABLE IF EXISTS sync_outbox_dlq;
   DROP TABLE IF EXISTS sync_locks;
   -- Note: Les colonnes ajoutées à sync_outbox peuvent rester
   ```
3. **Redéployer l'ancienne version du code**
4. **Redémarrer l'application**

### Compatibilité

- Les anciens événements sans `idempotency_key` sont supportés (trigger auto-génère)
- Les anciens événements sans `sequence` sont supportés (trigger auto-génère)
- Le système fonctionne en mode dégradé si les nouvelles tables n'existent pas

## Prochaines étapes

1. **Tests en environnement de staging**
2. **Déploiement progressif (canary)**
3. **Monitoring intensif pendant 48h**
4. **Documentation des runbooks d'incident**
5. **Formation de l'équipe on-call**

## Références

- Architecture V2.3.2: `docs/ARCHITECTURE_V2_3_2_PRODUCTION_GRADE.md`
- Critical Analysis: `docs/ARCHITECTURE_V2_3_2_CRITICAL_ANALYSIS.md`
- Migration SQL: `backend/migrations/055_outbox_v2_3_2.sql`
- SyncOrchestratorV2: `src/sync/sync-orchestrator-v2.ts`