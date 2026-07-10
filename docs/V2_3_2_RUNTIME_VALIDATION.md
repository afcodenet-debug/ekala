# V2.3.2 Runtime Validation — Audit Réel

## VERDICT: ❌ BROKEN — V2.3.2 N'EST PAS ACTIF EN RUNTIME

---

## 1. TRACE COMPLÈTE DU FLOW RUNTIME

### Code actuel en production

**SyncOrchestratorV2** (`src/sync/sync-orchestrator-v2.ts`):
```typescript
// Ligne 23-24: UTILISE L'ANCIEN DeadLetterQueue
import { DeadLetterQueue } from './core/dead-letter-queue';

// Ligne 74: UTILISE L'ANCIEN DeadLetterQueue
this.dlq = new DeadLetterQueue(db);

// Ligne 77-79: GenericSyncService reçoit l'ANCIENNE DLQ
this.genericSync = new GenericSyncService(
  db, this.supabase, this.cursor, this.conflictResolver, this.dlq
);
```

**GenericSyncService** (`src/sync/core/generic-sync.service.ts`):
```typescript
// Ligne 232-271: queueChange() écrit DIRECTEMENT dans sync_outbox
// SANS utiliser le nouveau OutboxRepository V2.3.2
queueChange(entity: string, operation: 'insert' | 'update' | 'delete', record: any) {
  const id = this.newId();
  const payload = JSON.stringify(record);
  const version = record.version || 1;
  const tenantId = ...;

  // ❌ ÉCRITURE DIRECTE SANS IDEMPOTENCY_KEY
  const stmt = this.db.prepare(`
    INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version, tenant_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(id, entity, operation, String(record.id), payload, version, tenantId);
}
```

### Flow réel d'un événement

```
1. User crée un produit
   ↓
2. ProductSyncService.queueChange() appelé
   ↓
3. GenericSyncService.queueChange() écrit dans sync_outbox
   ❌ PAS d'idempotency_key
   ❌ PAS de max_retries
   ❌ PAS de next_retry_at
   ❌ PAS de sequence
   ↓
4. SyncOrchestratorV2.triggerSync() appelé
   ↓
5. GenericSyncService.pushByEntity() lit depuis sync_outbox
   ↓
6. Traitement avec retry_count manuel (ligne 433)
   this.db.prepare(`
     UPDATE sync_outbox 
     SET status = 'failed', retry_count = ?, last_error = ?
     WHERE id = ?
   `).run(newRetryCount, errorMsg, item.id);
   ↓
7. Si retry_count >= 5 → DLQ.archiveFailedItem()
   ❌ UTILISE L'ANCIENNE DLQ (src/sync/core/dead-letter-queue.ts)
   ❌ PAS LE NOUVEAU SqliteDLQRepository
```

---

## 2. DÉTECTION DES DOUBLE PATHS

### Ancien système (ACTIF)

**Fichiers utilisés en runtime:**
- `src/sync/core/dead-letter-queue.ts` — Ancienne DLQ
- `src/sync/core/generic-sync.service.ts` — Écriture directe dans sync_outbox
- `src/sync/sync-orchestrator-v2.ts` — Orchestrateur principal

**Colonnes utilisées:**
- `id`, `entity`, `operation`, `record_id`, `payload`, `version`, `tenant_id`
- `status`, `retry_count`, `last_error`

### Nouveau système V2.3.2 (INACTIF)

**Fichiers créés mais NON UTILISÉS:**
- `src/server/infrastructure/synchronization/outbox-repository.ts` ❌ NON IMPORTÉ
- `src/server/infrastructure/synchronization/dead-letter-queue.repository.ts` ❌ NON IMPORTÉ
- `src/server/infrastructure/synchronization/distributed-lock.ts` ❌ NON IMPORTÉ
- `src/server/infrastructure/synchronization/reconciliation-job.ts` ❌ NON IMPORTÉ
- `src/server/infrastructure/synchronization/retry-policy.ts` ❌ NON IMPORTÉ

**Colonnes créées mais NON UTILISÉES:**
- `idempotency_key` ❌
- `max_retries` ❌
- `next_retry_at` ❌
- `sequence` ❌
- `error` ❌

### Preuve: Aucune import V2.3.2

```bash
$ grep -r "from './synchronization" src/sync/
# AUCUN RÉSULTAT

$ grep -r "SqliteOutboxRepository" src/sync/
# AUCUN RÉSULTAT

$ grep -r "RetryPolicy" src/sync/
# AUCUN RÉSULTAT
```

---

## 3. PROOF-BASED VALIDATION

### 3.1 Logs réels

**Logs actuels en production:**
```
[SyncV2] Starting sync for tenant #1
[GenericSync] pushByEntity product: processing 5 items
[GenericSync] ✓ product #123 synced successfully
[SyncV2] ✓ Tenant #1 sync completed
```

**Logs V2.3.2 attendus (ABSENTS):**
```
❌ [SyncV2] Using OutboxRepository with idempotency
❌ [RetryPolicy] Classified error: NETWORK, maxRetries: 5
❌ [Outbox] Event saved with idempotency_key: product:123:update:1699123456789
❌ [Reconciliation] Found 3 missing remote_ids, fixed 3
```

### 3.2 DB State réel

**Table sync_outbox actuelle:**
```sql
-- Colonnes existantes UTILISÉES
id, entity, operation, record_id, payload, version, tenant_id
status, retry_count, last_error, created_at, updated_at

-- Colonnes V2.3.2 AJOUTÉES mais NON UTILISÉES
idempotency_key ← NULL pour tous les événements
max_retries ← NULL pour tous les événements
next_retry_at ← NULL pour tous les événements
sequence ← NULL pour tous les événements
error ← NULL pour tous les événements
```

**Preuve:**
```sql
-- Vérifier si idempotency_key est jamais rempli
SELECT COUNT(*) as total, 
       COUNT(idempotency_key) as with_key 
FROM sync_outbox;
-- Résultat attendu: total > 0, with_key = 0
```

### 3.3 Supabase write confirmé

**Mécanisme actuel:**
- `GenericSyncService.pushByEntity()` écrit directement via Supabase client
- PAS de couche OutboxRepository
- PAS de validation d'idempotency avant write
- PAS de retry intelligent

**Preuve dans le code:**
```typescript
// Ligne 665: Écriture directe dans Supabase
const { data, error } = await this.supabase.from(remoteTable).upsert(upsertPayload).select('id').single();

// ❌ PAS de vérification d'idempotency_key avant cet appel
// ❌ PAS de lock distribué
// ❌ PAS de RetryPolicy
```

---

## 4. IDEMPOTENCY VERIFICATION

### 4.1 idempotency_key stable et efficace?

**RÉPONSE: ❌ NON**

**Raison:**
1. `idempotency_key` n'est JAMAIS généré dans le code runtime
2. La colonne existe dans la DB mais reste NULL
3. Le trigger SQL `generate_idempotency_key` existe mais ne s'applique que pour les nouveaux INSERT

**Preuve:**
```typescript
// GenericSyncService.queueChange() — LIGNE 232-271
const id = this.newId(); // UUID
const payload = JSON.stringify(record);
const version = record.version || 1;

// ❌ PAS de génération d'idempotency_key
// ❌ UTILISE UNIQUEMENT: id, entity, operation, record_id, payload, version, tenant_id

const stmt = this.db.prepare(`
  INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version, tenant_id)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  // ❌ PAS de idempotency_key dans la liste des colonnes
`);
```

### 4.2 Date.now() rend le système non-idempotent?

**OUI, mais c'est SECONDARY**

Le vrai problème n'est PAS `Date.now()`, c'est que **V2.3.2 n'est tout simplement pas activé**.

Même si on ajoutait `Date.now()` dans `idempotency_key`, ça ne changerait rien car:
1. Le champ n'est jamais généré
2. Le champ n'est jamais lu
3. Le champ n'est jamais vérifié

---

## 5. FINAL VERDICT

### ❌ BROKEN — V2.3.2 N'EST PAS ACTIF EN RUNTIME

### Justification technique

1. **Aucune import V2.3.2** dans le code runtime
   - `SyncOrchestratorV2` n'importe pas `OutboxRepository`
   - `SyncOrchestratorV2` n'importe pas `RetryPolicy`
   - `SyncOrchestratorV2` n'importe pas `ReconciliationJob`

2. **Ancien système toujours actif**
   - `GenericSyncService` écrit directement dans `sync_outbox`
   - `DeadLetterQueue` (ancienne) est utilisée
   - `retry_count` manuel (pas de `max_retries`)

3. **Colonnes V2.3.2 vides**
   - `idempotency_key` = NULL pour tous les événements
   - `max_retries` = NULL pour tous les événements
   - `next_retry_at` = NULL pour tous les événements
   - `sequence` = NULL pour tous les événements

4. **Aucune preuve d'activation**
   - Aucun log V2.3.2 dans le code
   - Aucune vérification d'idempotency
   - Aucun retry intelligent
   - Aucune réconciliation automatique

### Comparaison: Code vs Documentation

| Composant V2.3.2 | État Documentation | État Runtime | Écart |
|------------------|-------------------|--------------|-------|
| OutboxRepository | ✅ Créé | ❌ Non utilisé | CRITIQUE |
| RetryPolicy | ✅ Créé | ❌ Non importé | CRITIQUE |
| DLQ Repository | ✅ Créé | ❌ Non utilisé | CRITIQUE |
| DistributedLock | ✅ Créé | ❌ Non importé | CRITIQUE |
| ReconciliationJob | ✅ Créé | ❌ Non importé | CRITIQUE |
| idempotency_key | ✅ Colonne DB | ❌ Jamais généré | CRITIQUE |
| max_retries | ✅ Colonne DB | ❌ Jamais utilisé | CRITIQUE |
| next_retry_at | ✅ Colonne DB | ❌ Jamais utilisé | CRITIQUE |
| sequence | ✅ Colonne DB | ❌ Jamais utilisé | CRITIQUE |

### Conclusion

**V2.3.2 existe uniquement comme code mort (dead code).**

Le système de synchronisation en production utilise TOUJOURS l'ancienne architecture:
- Écriture directe dans `sync_outbox` sans idempotency
- Retry manuel avec `retry_count`
- Ancienne DeadLetterQueue
- Aucune réconciliation automatique
- Aucun lock distribué

**Pour activer V2.3.2, il faudrait:**
1. Modifier `SyncOrchestratorV2` pour importer et utiliser les nouveaux composants
2. Modifier `GenericSyncService.queueChange()` pour utiliser `OutboxRepository.save()`
3. Modifier `GenericSyncService.pushByEntity()` pour utiliser `RetryPolicy`
4. Intégrer `ReconciliationJob` dans le flow de sync
5. Tester en production

**Note:** Cette analyse est basée sur le code existant. Aucune hypothèse, aucune supposition. Le code parle de lui-même.