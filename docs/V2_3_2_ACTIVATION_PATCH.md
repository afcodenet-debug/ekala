# V2.3.2 Activation Patch — Migration Progressive

## Stratégie: Dual-Write avec Feature Flags

Cette approche permet d'activer V2.3.2 sans casser la production, avec rollback instantané.

---

## PHASE 1: Feature Flag System (DÉJÀ CRÉÉ)

✅ `src/server/infrastructure/synchronization/sync-engine-mode.ts`

**Utilisation:**
```typescript
import { SyncEngineModeManager, SyncEngineMode } from './synchronization';

const modeManager = SyncEngineModeManager.getInstance();

// Vérifier le mode
if (modeManager.isDualWriteMode()) {
  // Écrire dans les deux systèmes
}

// Rollback instantané
modeManager.rollbackToLegacy();
```

**Variable d'environnement:**
```bash
# .env
SYNC_ENGINE_MODE=1  # DUAL_WRITE (par défaut)
# SYNC_ENGINE_MODE=0  # LEGACY (rollback)
# SYNC_ENGINE_MODE=2  # V2_3_2 (full activation)
```

---

## PHASE 2: Patch GenericSyncService (DUAL WRITE)

### Fichier: `src/sync/core/generic-sync.service.ts`

#### Modification 1: Ajouter les imports V2.3.2

```typescript
// Ligne 12-14: AJOUTER ces imports
import { SyncEngineModeManager } from '../../server/infrastructure/synchronization/sync-engine-mode';
import { SqliteOutboxRepositoryFactory } from '../../server/infrastructure/synchronization/outbox-repository';
import { RetryPolicy, ErrorType } from '../../server/infrastructure/synchronization/retry-policy';
```

#### Modification 2: Ajouter les dépendances V2.3.2 dans le constructeur

```typescript
// Ligne 22-41: MODIFIER le constructeur
export class GenericSyncService {
  private db: Database.Database;
  private supabase: SupabaseClient;
  private cursor: SyncPersistedCursor;
  private conflictResolver: ConflictResolver;
  private dlq: DeadLetterQueue;

  // V2.3.2 components (optionnels)
  private outboxRepo?: any;
  private retryPolicy?: RetryPolicy;
  private modeManager: SyncEngineModeManager;

  constructor(
    db: Database.Database,
    supabase: SupabaseClient,
    cursor: SyncPersistedCursor,
    conflictResolver: ConflictResolver,
    dlq: DeadLetterQueue
  ) {
    this.db = db;
    this.supabase = supabase;
    this.cursor = cursor;
    this.conflictResolver = conflictResolver;
    this.dlq = dlq;

    // V2.3.2: Initialize feature flag manager
    this.modeManager = SyncEngineModeManager.getInstance();
    this.modeManager.logMode();

    // V2.3.2: Initialize components if enabled
    if (this.modeManager.isIdempotencyEnabled() || this.modeManager.isRetryPolicyEnabled()) {
      try {
        this.outboxRepo = SqliteOutboxRepositoryFactory.create();
        this.retryPolicy = new RetryPolicy();
        console.log('[GenericSyncV2] ✓ OutboxRepository and RetryPolicy initialized');
      } catch (err) {
        console.warn('[GenericSyncV2] Failed to initialize V2.3.2 components:', err);
      }
    }
  }
```

#### Modification 3: Modifier queueChange() pour dual-write

```typescript
// Ligne 232-271: REMPLACER queueChange()
queueChange(entity: string, operation: 'insert' | 'update' | 'delete', record: any) {
  const requestId = getRequestId();
  logTrace('ENTER GenericSyncService.queueChange', { entity, operation, recordId: record.id });
  const def = getEntityDef(entity);
  if (!def) {
    logTrace('EXIT GenericSyncService.queueChange', { reason: 'no entity def' });
    return;
  }

  const id = this.newId();
  const payload = JSON.stringify(record);
  const version = record.version || 1;

  const tenantId = def.entity === 'tenant'
    ? this.normalizeTenantId(record.id)
    : this.normalizeTenantId(record.tenant_id);

  // ============================================
  // V2.3.2: DUAL WRITE - Legacy + OutboxRepository
  // ============================================
  
  // 1. LEGACY WRITE (toujours actif)
  try {
    const stmt = this.db.prepare(`
      INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(id, entity, operation, String(record.id), payload, version, tenantId);
    logTrace('EXIT GenericSyncService.queueChange (legacy)', { result });
  } catch (err: any) {
    console.error(JSON.stringify({
      requestId,
      file: 'generic-sync.service.ts',
      function: 'queueChange',
      errorType: err?.constructor?.name,
      errorCode: err?.code,
      errorMessage: err?.message,
      errorStack: err?.stack,
      entity,
      operation,
      recordId: record.id
    }));
    throw err;
  }

  // 2. V2.3.2 WRITE (si activé)
  if (this.modeManager.isIdempotencyEnabled() && this.outboxRepo) {
    try {
      const idempotencyKey = `${entity}:${record.id}:${operation}:${Date.now()}`;
      
      await this.outboxRepo.save({
        eventType: operation,
        entity,
        recordId: record.id,
        payload,
        idempotencyKey,
        status: 'pending', // OutboxStatus.PENDING
        retryCount: 0,
        maxRetries: 3,
        nextRetryAt: new Date(Date.now() + 1000),
        error: null,
        createdAt: new Date(),
        processedAt: null
      });

      console.log('[OutboxV2] Event saved with idempotency_key:', idempotencyKey);
      logTrace('EXIT GenericSyncService.queueChange (V2.3.2)', { idempotencyKey });
    } catch (err: any) {
      console.warn('[OutboxV2] Failed to save event (non-critical):', err?.message);
      // NE PAS throw - le legacy write a réussi
    }
  }
}
```

#### Modification 4: Modifier pushByEntity() pour utiliser RetryPolicy

```typescript
// Ligne 377-451: MODIFIER pushByEntity()
async pushByEntity(entity: string, tenantId: string): Promise<number> {
  const requestId = getRequestId();
  logTrace('ENTER GenericSyncService.pushByEntity', { entity, tenantId });
  const def = getEntityDef(entity);
  if (!def) {
    logTrace('EXIT GenericSyncService.pushByEntity', { reason: 'no entity def' });
    return 0;
  }

  const tenantIdNum = parseInt(tenantId, 10);
  
  // DIAGNOSTIC: Count all products in outbox before filtering
  if (entity === 'product') {
    logTrace('ENTER db.prepare SELECT DIAG outbox stats');
    const totalInOutbox = this.db.prepare(`
      SELECT COUNT(*) AS total FROM sync_outbox WHERE entity='product'
    `).get() as any;
    const pendingInOutbox = this.db.prepare(`
      SELECT COUNT(*) AS pending FROM sync_outbox WHERE entity='product' AND status='pending'
    `).get() as any;
    const pendingForTenant = this.db.prepare(`
      SELECT COUNT(*) AS pending_for_tenant FROM sync_outbox 
      WHERE entity='product' AND status='pending' AND CAST(tenant_id AS INTEGER)=?
    `).get(tenantIdNum) as any;
    logTrace('EXIT db.prepare SELECT DIAG outbox stats', { 
      total: totalInOutbox?.total, 
      pending: pendingInOutbox?.pending,
      pendingForTenant: pendingForTenant?.pending_for_tenant 
    });
    
    // Show tenant_id distribution
    logTrace('ENTER db.prepare SELECT DIAG tenant distribution');
    const byTenant = this.db.prepare(`
      SELECT tenant_id, status, COUNT(*) as count 
      FROM sync_outbox 
      WHERE entity='product' 
      GROUP BY tenant_id, status
    `).all() as any[];
    logTrace('EXIT db.prepare SELECT DIAG tenant distribution', { byTenant });
  }
  
  logTrace('ENTER db.prepare SELECT outbox items');
  
  // V2.3.2: Use OutboxRepository if enabled
  let items: any[] = [];
  if (this.modeManager.isIdempotencyEnabled() && this.outboxRepo) {
    // V2.3.2: Get pending events from OutboxRepository
    const pendingEvents = await this.outboxRepo.findPendingOrdered();
    items = pendingEvents
      .filter(e => e.entity === entity && (e.tenantId === tenantIdNum || e.tenantId === null))
      .slice(0, 50);
    console.log('[OutboxV2] Using OutboxRepository, found', items.length, 'pending events');
  } else {
    // Legacy: Get from sync_outbox directly
    items = this.db.prepare(`
      SELECT * FROM sync_outbox
      WHERE entity = ? AND status = 'pending' AND (tenant_id IS NULL OR CAST(tenant_id AS INTEGER) = ?)
      ORDER BY created_at ASC
      LIMIT 50
    `).all(entity, tenantIdNum) as any[];
  }
  
  logTrace('EXIT db.prepare SELECT outbox items', { count: items.length });
  
  // Log detail pour diagnostic
  if (items.length === 0) {
    logTrace('ENTER db.prepare SELECT DIAG status distribution');
    const byStatus = this.db.prepare(`
      SELECT status, tenant_id, COUNT(*) as count
      FROM sync_outbox
      WHERE entity = ?
      GROUP BY status, tenant_id
    `).all(entity) as any[];
    logTrace('EXIT db.prepare SELECT DIAG status distribution', { byStatus });
  }

  let successCount = 0;

  logTrace(`[GenericSync] pushByEntity ${def.entity}: processing ${items.length} items`);

  for (const item of items) {
    logTrace('ENTER db.prepare UPDATE outbox in_progress');
    this.db.prepare(`UPDATE sync_outbox SET status = 'in_progress' WHERE id = ?`).run(item.id);
    logTrace('EXIT db.prepare UPDATE outbox in_progress');

    try {
      const payload = JSON.parse(item.payload);
      const recordId = Number(item.record_id);
      if (isNaN(recordId)) {
        console.error(`[GenericSync] Invalid record_id for ${def.entity}: ${item.record_id}`);
        logTrace('ENTER db.prepare UPDATE outbox failed (invalid record_id)');
        this.db.prepare(`UPDATE sync_outbox SET status = 'failed', last_error = 'invalid record_id' WHERE id = ?`).run(item.id);
        logTrace('EXIT db.prepare UPDATE outbox failed (invalid record_id)');
        continue;
      }

      logTrace(`[GenericSync] Processing ${def.entity} #${recordId} (op=${item.operation})`);

      if (item.operation === 'insert' || item.operation === 'update') {
        await this.handleUpsert(def, item, payload, recordId, tenantId);
      } else if (item.operation === 'delete') {
        const remoteId = payload.remote_id || this.getRemoteId(def.localTable, recordId);

        let resolvedRemoteId = remoteId;
        if (!resolvedRemoteId && def.entity === 'product' && payload.name && tenantId) {
          const existing = await this.findExistingRemoteRecord(def, payload, tenantId);
          if (existing?.id) resolvedRemoteId = existing.id;
        }

        await this.handleDelete(def, item, payload, recordId, resolvedRemoteId || remoteId);
      }

      logTrace('ENTER db.prepare UPDATE outbox done');
      this.db.prepare(`UPDATE sync_outbox SET status = 'done' WHERE id = ?`).run(item.id);
      logTrace('EXIT db.prepare UPDATE outbox done');
      successCount++;
      logTrace(`[GenericSync] ✓ ${def.entity} #${recordId} synced successfully`);
    } catch (err: any) {
      const errorMsg = err?.message ?? String(err);
      
      // V2.3.2: Use RetryPolicy if enabled
      let newRetryCount = (item.retry_count || 0) + 1;
      let shouldMoveToDLQ = false;

      if (this.modeManager.isRetryPolicyEnabled() && this.retryPolicy) {
        const errorType = this.retryPolicy.classifyError(err);
        const maxRetries = this.retryPolicy.getMaxRetries(errorType);
        const nextRetry = this.retryPolicy.calculateRetryDelay(newRetryCount);

        console.log(`[RetryPolicy] Classified error: ${errorType}, maxRetries: ${maxRetries}, nextRetry: ${nextRetry}ms`);

        if (newRetryCount >= maxRetries) {
          shouldMoveToDLQ = true;
        }
      } else {
        // Legacy: hardcoded 5 retries
        shouldMoveToDLQ = newRetryCount >= 5;
      }
      
      // Special handling for duplicate key errors - mark as done since data already exists
      if (errorMsg.includes('duplicate key') || errorMsg.includes('unique constraint')) {
        console.log(`[GenericSync] ✓ ${def.entity} #${item.record_id} synced (duplicate detected in catch)`);
        logTrace('ENTER db.prepare UPDATE outbox done (duplicate)');
        this.db.prepare(`UPDATE sync_outbox SET status = 'done' WHERE id = ?`).run(item.id);
        logTrace('EXIT db.prepare UPDATE outbox done (duplicate)');
        successCount++;
        continue;
      }
      
      console.error(`[GenericSync] ✗ ${def.entity} #${item.record_id} failed:`, errorMsg);
      
      logTrace('ENTER db.prepare UPDATE outbox failed');
      this.db.prepare(`
        UPDATE sync_outbox 
        SET status = 'failed', retry_count = ?, last_error = ?
        WHERE id = ?
      `).run(newRetryCount, errorMsg, item.id);
      logTrace('EXIT db.prepare UPDATE outbox failed');

      // V2.3.2: Move to DLQ if max retries reached
      if (shouldMoveToDLQ) {
        if (this.modeManager.isDLQEnabled() && this.outboxRepo) {
          try {
            // V2.3.2 DLQ
            const { SqliteDLQRepositoryFactory } = require('../../server/infrastructure/synchronization/dead-letter-queue.repository');
            const dlqRepo = SqliteDLQRepositoryFactory.create();
            await dlqRepo.add(
              item.eventType || item.operation,
              '1',
              item.payload,
              item.idempotencyKey || item.id,
              errorMsg
            );
            console.log('[DLQ] Event moved to DLQ:', item.id);
          } catch (dlqErr) {
            console.warn('[DLQ] Failed to move to V2.3.2 DLQ, using legacy DLQ');
            this.dlq.archiveFailedItem(item.id, errorMsg, newRetryCount);
          }
        } else {
          // Legacy DLQ
          this.dlq.archiveFailedItem(item.id, errorMsg, newRetryCount);
        }
      }
    }
  }

  logTrace(`[GenericSync] pushByEntity ${def.entity}: completed ${successCount}/${items.length}`);
  console.log(`[GenericSync] pushByEntity ${def.entity}: completed ${successCount}/${items.length}`);
  return successCount;
}
```

---

## PHASE 3: Patch SyncOrchestratorV2

### Fichier: `src/sync/sync-orchestrator-v2.ts`

#### Modification 1: Ajouter l'import V2.3.2

```typescript
// Ligne 30: AJOUTER
import { SyncEngineModeManager } from './infrastructure/synchronization/sync-engine-mode';
```

#### Modification 2: Initialiser le mode manager

```typescript
// Ligne 46-52: AJOUTER après les autres propriétés
private modeManager: SyncEngineModeManager;

// Ligne 97: AJOUTER dans le constructeur
this.modeManager = SyncEngineModeManager.getInstance();
```

#### Modification 3: Ajouter reconciliation après sync

```typescript
// Ligne 316-319: AJOUTER après ensureIntegrity
// V2.3.2: Post-sync reconciliation
if (this.modeManager.isReconciliationEnabled()) {
  try {
    const { ReconciliationJobFactory } = require('./infrastructure/synchronization/reconciliation-job');
    const reconciliationJob = ReconciliationJobFactory.create(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || ''
    );
    
    const result = await reconciliationJob.run(Number(tenantId));
    
    if (result.inconsistencies.length > 0) {
      console.warn(`[Reconciliation] Found issues for tenant ${tenantId}:`, result);
    } else {
      console.log(`[Reconciliation] ✓ Tenant ${tenantId} is clean`);
    }
  } catch (err) {
    console.warn('[Reconciliation] Failed:', err);
  }
}
```

---

## PHASE 4: Ordre de déploiement

### Étape 1: Appliquer la migration SQL
```bash
sqlite3 backend/database.sqlite < backend/migrations/055_outbox_v2_3_2.sql
```

### Étape 2: Déployer le code en mode DUAL_WRITE (défaut)
```bash
# .env
SYNC_ENGINE_MODE=1  # DUAL_WRITE
```

### Étape 3: Monitorer les logs
```bash
# Vérifier que les deux systèmes fonctionnent
grep "OutboxV2" logs/sync.log
grep "RetryPolicy" logs/sync.log
grep "Reconciliation" logs/sync.log
```

### Étape 4: Valider l'idempotency
```sql
-- Vérifier que idempotency_key est rempli
SELECT COUNT(*) as total, 
       COUNT(idempotency_key) as with_key,
       COUNT(max_retries) as with_max_retries
FROM sync_outbox;
-- Attendu: with_key > 0, with_max_retries > 0
```

### Étape 5: Activer V2_3_2 complet (après validation)
```bash
# .env
SYNC_ENGINE_MODE=2  # V2_3_2
```

### Étape 6: Rollback si nécessaire
```bash
# .env
SYNC_ENGINE_MODE=0  # LEGACY
# OU
SYNC_ENGINE_MODE=1  # DUAL_WRITE
```

---

## PHASE 5: Validation post-deploy

### Checklist de validation

- [ ] `SYNC_ENGINE_MODE=1` est la valeur par défaut
- [ ] Logs montrent `[OutboxV2] Event saved with idempotency_key`
- [ ] Logs montrent `[RetryPolicy] Classified error`
- [ ] Logs montrent `[Reconciliation] Found issues` ou `✓ Tenant X is clean`
- [ ] Colonnes `idempotency_key`, `max_retries`, `next_retry_at` sont remplies
- [ ] Aucune erreur de duplication d'événements
- [ ] DLQ legacy et V2.3.2 fonctionnent en parallèle
- [ ] Rollback testé: `SYNC_ENGINE_MODE=0` fonctionne

### Commandes de vérification

```bash
# 1. Vérifier le mode actuel
grep "SyncEngineMode" logs/sync.log

# 2. Vérifier les events V2.3.2
grep "OutboxV2" logs/sync.log | wc -l

# 3. Vérifier la DB
sqlite3 backend/database.sqlite "SELECT COUNT(idempotency_key) FROM sync_outbox WHERE idempotency_key IS NOT NULL"

# 4. Tester le rollback
echo "SYNC_ENGINE_MODE=0" >> .env
# Redémarrer et vérifier que les logs V2.3.2 disparaissent
```

---

## ROLLBACK STRATEGY

### Rollback instantané (0 downtime)

**Option 1: Variable d'environnement**
```bash
# Changer la variable et redémarrer
SYNC_ENGINE_MODE=0  # Retour à LEGACY immédiat
```

**Option 2: Code (si urgence)**
```typescript
// Dans le code, appeler:
modeManager.rollbackToLegacy();
```

### Aucun changement destructif

- Les anciennes colonnes restent intactes
- Les anciennes tables restent intactes
- Les événements legacy continuent d'être traités
- Rollback = changer une variable d'environnement

---

## MONITORING

### Métriques à surveiller

1. **Dual-write ratio**
   - Legacy writes: `SELECT COUNT(*) FROM sync_outbox WHERE created_at > NOW() - INTERVAL '1 hour'`
   - V2.3.2 writes: `SELECT COUNT(*) FROM sync_outbox WHERE idempotency_key IS NOT NULL AND created_at > NOW() - INTERVAL '1 hour'`

2. **RetryPolicy usage**
   - Logs: `grep "RetryPolicy" logs/sync.log`
   - Erreurs classifiées: NETWORK, VALIDATION, RATE_LIMIT, SUPABASE_ERROR

3. **Reconciliation effectiveness**
   - Issues found: `grep "Reconciliation.*Found issues" logs/sync.log`
   - Auto-fixes: `grep "Reconciliation.*fixed" logs/sync.log`

4. **DLQ health**
   - Legacy DLQ: `SELECT COUNT(*) FROM sync_dlq`
   - V2.3.2 DLQ: `SELECT COUNT(*) FROM sync_outbox_dlq`

### Alertes

```typescript
// Alerte si DLQ > 10
if (dlqCount > 10) {
  console.error('[ALERT] DLQ critical:', dlqCount);
  // TODO: Send to monitoring service
}

// Alerte si reconciliation trouve > 0 incohérences
if (result.inconsistencies.length > 0) {
  console.warn('[ALERT] Reconciliation issues:', result.inconsistencies);
}
```

---

## PROCHAINES ÉTAPES

1. **Appliquer ce patch** sur GenericSyncService
2. **Tester en staging** avec SYNC_ENGINE_MODE=1
3. **Monitorer 24h** les logs et la DB
4. **Valider l'idempotency** (colonnes remplies)
5. **Activer V2_3_2** (SYNC_ENGINE_MODE=2) si tout est OK
6. **Planifier la suppression du legacy** dans 2 semaines

---

## NOTES IMPORTANTES

- ✅ Aucune interruption de service
- ✅ Rollback instantané via variable d'environnement
- ✅ Dual-write garantit la compatibilité
- ✅ Aucune modification de schéma destructive
- ✅ Logs structurés pour debugging
- ✅ Monitoring intégré

**C'est une migration Stripe-style: progressive, sécurisée, réversible.**