# Diagnostic — Commandes POS locales non synchronisées vers le Cloud

## Contexte

Une commande passée depuis la page POS **en mode Local** (SQLite) devrait être
poussée vers Supabase via l'outbox (`sync_outbox`) puis récupérée par
l'instance Cloud via le pull. Actuellement, la commande est bien créée en
local, mais **aucun effet n'est visible dans le Cloud**.

---

## Architecture de la sync (Local → Cloud)

### Schéma du flux

```
POS (local)
   ↓ Crée commande (SQLite)
   ↓
order.service.ts (via route /orders/create)
   ├─ withOutboxTransaction()
   │    ├─ INSERT INTO orders (SQLite)
   │    ├─ INSERT INTO order_items (SQLite)
   │    └─ getGenericSyncService()?.queueChangeInsideTransaction('order', 'insert')
   │         → INSERT INTO sync_outbox (SQLite)
   │
   ├─ isSyncEnabled() ? pushByEntity('order', tenantId)
   │    → Lit sync_outbox WHERE entity='order' AND status='pending'
   │    → handleUpsert() → supabase.from('orders').upsert()
   │
   └─ getProductSyncService()?.syncNow()    ← push produits (legacy, separate)
```

### Le scheduler (`SyncOrchestratorV2`)

- Démarre toutes les 30 secondes via `startScheduler(30000)`
- `handleSchedulerTick()` → `triggerSync()` → pour chaque tenant → `fullSyncForTenant()`
- `fullSyncForTenant()` appelle `pushByEntity()` + `pullByEntity()` pour CHAQUE entité

---

## Analyse de la chaîne d'appel (createOrder)

### 1. withOutboxTransaction wrap (ligne 324)

```typescript
return withOutboxTransaction(db, String(tenantId), () => {
```

`withOutboxTransaction` exécute le callback dans une transaction SQLite.
Si quoi que ce chose lance une erreur DANS le callback, TOUTE la transaction
est annulée (ROLLBACK), y compris l'INSERT INTO orders.

### 2. getGenericSyncService()?.queueChangeInsideTransaction (ligne 385)

```typescript
getGenericSyncService()?.queueChangeInsideTransaction('order', 'insert', finalOrder);
```

🔴 **PROBLÈME N°1** : `getGenericSyncService()` lance une `Error` si
`orchestratorV2` est `null` (voir `src/sync/index.ts` lignes 121-126) :

```typescript
export function getGenericSyncService(): any {
    if (!orchestratorV2) {
        throw new Error('SyncOrchestratorV2 not initialized. Call initializeSyncV2 first.');
    }
    return orchestratorV2.getGenericSync();
}
```

Si `initializeSyncV2()` n'a pas été appelée (ou a échoué silencieusement),
`getGenericSyncService()` LANCE UNE ERREUR. Cette erreur est attrapée par
le `catch (error) { throw error; }` à la ligne 407, ce qui ANNULE la
transaction → la commande n'est pas créée non plus.

⚠️ **Mais l'utilisateur dit que la commande est créée en local.** Ceci
suggère QUE soit `orchestratorV2` est initialisé, soit il y a un catch
quelque part qui empêche la propagation de l'erreur.

**Hypothèse** : Le `?` dans `getGenericSyncService()?.queueChangeInsideTransaction`
est un optional chaining. Si `getGenericSyncService()` renvoie `null` ou
`undefined` au lieu de lancer une erreur, alors `queueChangeInsideTransaction`
n'est pas appelée et la transaction réussit sans outbox.

### 3. pushByEntity() immédiat — GARDÉ par isSyncEnabled() (ligne 386-391)

```typescript
if (isSyncEnabled()) {
    const sync = getGenericSyncService();
    sync?.pushByEntity('order', String(tenantId)).catch(...)
}
```

🔴 **PROBLÈME N°2** : `isSyncEnabled()` dépend de `setSyncEnabled()`
qui n'est appelée QUE dans `initializeSyncV2()`.

```typescript
// index.ts ligne 39-41
let syncEnabled = false;
export function setSyncEnabled(enabled: boolean): void {
    syncEnabled = enabled;
}
```

Si `initializeSyncV2()` n'est PAS appelée au démarrage du serveur local,
ou si elle a échoué, `syncEnabled` reste `false` → le push immédiat
est ignoré.

### 4. Résolution FK — items non trouvés

Dans `handleUpsert()`, les clés étrangères (`table_id`, `waiter_id`,
`customer_id`) sont résolues vers les `remote_id` Supabase. Si les
tables/utilisateurs locaux n'ont pas de `remote_id`, les FK sont nullifiées :

```typescript
// generic-sync.service.ts lignes 388-390
console.warn(`[GenericSync] FK ${field}->${targetTable}=${safeUpdate[field]}
  not resolved for ${def.entity} #${recordId}, nullifying`);
delete safeUpdate[field];
```

🔴 **PROBLÈME N°3** : Si aucune table ou utilisateur n'a de `remote_id`,
la commande est upsertée dans Supabase AVEC des FK null. Dans l'interface
Cloud, la commande existe mais n'est liée à aucune table → invisible
dans la vue POS.

### 5. cleanDataForSupabase supprime `customer_phone`

```typescript
// generic-sync.service.ts ligne 461
'orders': ['version', 'customer_phone'],
```

`customer_phone` est explicitement supprimé du payload. Si la colonne
n'existe pas dans Supabase, ceci évite une erreur. Sinon, le champ
est perdu.

---

## Causes racines les plus probables

### Cause A : `SyncOrchestratorV2` non initialisé en mode Local

Le serveur local n'appelle peut-être pas `initializeSyncV2()` pour
démarrer le sync engine. Vérifier dans `src/server/server.ts` :

- `initializeSyncV2()` est-elle appelée ?
- Les variables d'environnement `SUPABASE_URL`, `SUPABASE_ANON_KEY` sont-elles
  définies dans `.env` ?
- Si Supabase n'est pas configuré en local, le sync ne démarre PAS.

**Conséquence** : `getGenericSyncService()` → erreur → transaction annulée
(mais l'utilisateur dit que la commande est créée → contradiction).

### Cause B : `getGenericSyncService()` renvoie `null` au lieu de lancer

Si la méthode `getGenericSyncService()` a été modifiée pour retourner `null`
au lieu de lancer une erreur (par exemple pour permettre le mode local sans
sync), alors :

- L'outbox n'est PAS écrite
- `isSyncEnabled()` retourne `false`
- Le push n'est JAMAIS déclenché

La commande est créée localement mais rien n'est synchronisé.

### Cause C : Scheduler stoppé ou non démarré

Même si l'outbox est écrite (statut: `pending`), le scheduler doit tourner
pour vider l'outbox. Vérifier :

```bash
sqlite3 backend/database.sqlite "
  SELECT entity, operation, status, retry_count, last_error,
         datetime(created_at) as created_at
  FROM sync_outbox
  WHERE entity = 'order'
  ORDER BY created_at DESC
  LIMIT 20;
"
```

Si des entrées existent avec `status = 'pending'`, le scheduler ne les
traite pas (problème d'initialisation, de réseau, ou d'erreur Supabase).

### Cause D : Erreur Supabase silencieuse

Le `.catch()` à la ligne 388 attrape l'erreur mais :

```typescript
.catch((e: Error) => console.warn('[OrderService] Sync push failed:', e.message))
```

- `console.warn` n'apparaît pas dans les logs si le niveau est trop haut
- Le message est tronqué (seul `e.message` est logué, pas le stack)
- L'erreur n'est pas stockée dans `last_error` de l'outbox

Si Supabase renvoie une erreur (validation, contrainte, permission),
elle est perdue.

---

## Recommandations immédiates

### 1. Vérifier l'état de l'outbox

Exécuter dans la base SQLite :

```bash
sqlite3 backend/database.sqlite "
  SELECT entity, operation, status, retry_count,
         substr(last_error,1,100) as error,
         datetime(created_at) as created_at
  FROM sync_outbox
  ORDER BY created_at DESC
  LIMIT 30;
"
```

### 2. Vérifier les remote_ids des tables et utilisateurs

```bash
sqlite3 backend/database.sqlite "
  SELECT 'tables sans remote_id:' as '';
  SELECT id, table_number FROM restaurant_tables WHERE remote_id IS NULL;
  SELECT '' as '';
  SELECT 'users sans remote_id:' as '';
  SELECT id, full_name, username FROM users WHERE remote_id IS NULL;
"
```

### 3. Vérifier l'initialisation du sync dans server.ts

```bash
grep -n "initializeSyncV2\|setSyncEnabled\|SyncOrchestratorV2" src/server/server.ts
```

### 4. Activer les logs détaillés

Ajouter dans l'environnement :

```bash
export DEBUG=sync:*
export LOG_LEVEL=debug
```

---

## Résumé

| Étape du flux | Problème |
|---|---|
| `queueChangeInsideTransaction('order', 'insert')` | ❓ `getGenericSyncService()` peut lancer une erreur |
| `isSyncEnabled()` → push immédiat | ❌ Ignoré si sync pas initialisé |
| `handleUpsert()` → Supabase | ⚠️ FK nullifiées, `customer_phone` ignoré |
| Scheduler `startScheduler(30000)` | ❓ Peut ne pas tourner |
| `pushByEntity` dans scheduler | ❓ Ignoré si hors-ligne ou reachability échoue |

**Cause la plus probable** : Le `SyncOrchestratorV2` n'est pas correctement
initialisé en mode LOCAL (variables Supabase absentes ou non configurées),
donc `getGenericSyncService()` ne peut pas écrire l'outbox, et la commande
reste purement locale.