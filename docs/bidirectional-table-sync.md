# Synchronisation bidirectionnelle des tables (SQLite ↔ Supabase)

## Problème identifié

L'utilisateur a signalé que :

1. **Création de T9 depuis l'app locale (SQLite)** → la table n'apparaît **PAS** sur Vercel (Supabase)
2. **Création de T9 depuis Vercel (Supabase)** → la table apparaît bien sur l'app locale (SQLite)

C'est-à-dire que le **PULL** (Supabase → SQLite) fonctionnait, mais le **PUSH** (SQLite → Supabase) ne fonctionnait pas.

## Causes racines

### 1. Colonnes manquantes dans la table Supabase

La migration initiale `supabase_migration.sql` créait la table `restaurant_tables` SANS les colonnes `remote_id` et `business_id`.

```sql
-- Colonne MANQUANTE dans la migration originale
ALTER TABLE restaurant_tables
  ADD COLUMN IF NOT EXISTS remote_id   BIGINT;
ALTER TABLE restaurant_tables
  ADD COLUMN IF NOT EXISTS business_id TEXT;
```

Sans ces colonnes, **toute écriture** par le service backend (qui inclut `business_id` dans le payload) **échoue silencieusement** avec une erreur du type :
```
Could not find the 'business_id' column of 'restaurant_tables' in the schema cache
```

Et comme cette erreur n'était pas loggée de manière visible dans la console utilisateur, l'utilisateur voyait simplement que la table n'apparaissait pas dans Vercel.

### 2. Double-écriture incohérente dans `TableService.create()`

Dans le mode local (SQLite + Supabase configuré), `TableService.create()` faisait :

1. INSERT direct dans Supabase (première branche `if (env.SUPABASE_URL && ...)`)
2. INSERT dans SQLite local (sans outbox)
3. Aucun mécanisme de retry → si Supabase échoue (à cause de la colonne manquante), la table n'est jamais créée

C'était une **double-écriture fragile** : si l'écriture Supabase échouait, la cohérence était perdue.

### 3. PULL fragile dans `SyncOrchestrator.syncPullTables()`

Le PULL des tables ne gérait pas correctement le cas où une table locale existait déjà avec un `table_number` similaire mais sans `remote_id`. La logique de matching était limitée à `remote_id OR id`, ce qui causait des conflits et des écrasements incorrects.

## Solutions appliquées

### ✅ Solution 1 : Migration Supabase pour ajouter les colonnes manquantes

Deux fichiers SQL sont fournis :

- **`backend/migrations/011_add_remote_id_to_tables.sql`** : migration versionnée à appliquer via le runner de migrations
- **`SUPABASE_RUNTIME_MIGRATION.sql`** : script à exécuter **immédiatement** dans le Supabase SQL Editor (idempotent, portable)

**Action requise** : Exécutez le contenu de `SUPABASE_RUNTIME_MIGRATION.sql` dans le SQL Editor de votre projet Supabase pour ajouter les colonnes `remote_id` et `business_id` à la table `restaurant_tables`.

### ✅ Solution 2 : Refactor de `TableService` avec outbox pattern

Le `TableService` a été réécrit pour utiliser un modèle cohérent :

- **Mode cloud pur** (`RENDER_CLOUD_MODE=true` ou `db=null`) : INSERT direct dans Supabase
- **Mode local** (`db` actif) : INSERT dans SQLite + queue dans l'outbox → le `SyncOrchestrator` pousse vers Supabase avec retry automatique

Cela garantit que **toute écriture locale finit par arriver dans Supabase**, même en cas d'erreur réseau temporaire.

### ✅ Solution 3 : PULL plus robuste dans `SyncOrchestrator`

Le `syncPullTables()` utilise maintenant **trois stratégies de matching** pour identifier une table locale correspondante à une table Supabase :

1. **Par `remote_id`** (le chemin canonique)
2. **Par `id` local** (couvre le cas où l'ID local = ID Supabase)
3. **Par `table_number`** (couvre le cas où la même table existe en local sans remote_id)

La logique d'upsert est transactionnelle et respecte le timestamp `updated_at` (last-write-wins).

## Mapping des statuts

Le statut `status` est différent entre local et Supabase (contrainte CHECK) :

| Local SQLite      | Supabase (CHECK) | Mapping |
|-------------------|------------------|---------|
| `available`       | `available`      | Direct  |
| `active`          | `occupied`       | Local → Remote : `active` devient `occupied` |
| `out_of_service`  | `available`      | Local → Remote : `out_of_service` devient `available` |
| `reserved`        | `reserved`       | Direct  |
| `cleaning`        | `cleaning`       | Direct  |

Le mapping est centralisé dans `TableService` (helpers `localToRemoteStatus` / `remoteToLocalStatus`).

## Plan d'action

1. **Immédiat** : Exécuter `SUPABASE_RUNTIME_MIGRATION.sql` dans le SQL Editor de Supabase
2. **Déjà fait** : Le code TypeScript compile sans erreur (`npm run build:server` ✓)
3. **À tester** :
   - Démarrer l'app locale
   - Créer T9 depuis l'app locale
   - Vérifier dans la console qu'il n'y a pas d'erreur Supabase
   - Vérifier sur Vercel (ou l'API Render) que T9 apparaît
4. **Idempotence** : La migration est idempotente (peut être ré-exécutée sans risque)

## Fichiers modifiés

- `src/server/services/table.service.ts` : refactor complet (outbox pattern en local, Supabase direct en cloud)
- `src/sync/sync-orchestrator.ts` : `syncPullTables` renforcé (3 stratégies de matching)
- `src/server/routes/tables.ts` : status mapping cohérent, suppression de la double-écriture
- `backend/migrations/011_add_remote_id_to_tables.sql` : nouvelle migration versionnée
- `SUPABASE_RUNTIME_MIGRATION.sql` : script à exécuter dans Supabase

## Logs à surveiller

Après avoir appliqué la migration Supabase et redémarré l'app, vous devriez voir dans les logs du backend local :

```
[Sync] Pushing new table "T9" to Supabase...
[Sync] Table "T9" pushed to Supabase (remote_id=XX)
[SyncOrchestrator] Sync completed - Pushed: X, Pulled: Y
```

Et dans Supabase (Table Editor), la table T9 devrait apparaître avec un `remote_id` non-null.
