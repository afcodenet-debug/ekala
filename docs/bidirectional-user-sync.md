# Synchronisation bidirectionnelle des utilisateurs (SQLite ↔ Supabase)

## Problème

Comme pour `restaurant_tables` (cf. `docs/bidirectional-table-sync.md`), la table
`users` doit être synchronisée dans les deux sens :

- **Création / édition / suppression d'un utilisateur depuis l'app locale** (POS)
  doit se répliquer sur Supabase.
- **Création / édition / suppression d'un utilisateur depuis Vercel / Supabase**
  doit se répliquer sur l'app locale (pull).

Avant ce changement, `src/server/routes/users.ts` faisait un INSERT/UPDATE/DELETE
local direct **sans outbox** : la table locale était modifiée mais Supabase
n'était jamais notifié. Conséquence : les nouveaux utilisateurs (ou les
modifications) créés depuis l'app POS n'apparaissaient pas dans Supabase.

## Architecture

Le pattern suit exactement celui de `TableService` :

```
UserService.create() / update() / delete()
    │
    ├─ Mode cloud (RENDER_CLOUD_MODE ou db=null)
    │     └─ Écriture directe dans Supabase
    │
    └─ Mode local (SQLite actif)
          └─ withOutboxTransaction(() => {
               INSERT / UPDATE / DELETE dans SQLite
               + queueUserChange('insert' | 'update' | 'delete', { ...user, business_id })
             })
                │
                └─ UserTenantSyncService.pushPendingByEntity('user', businessId)
                      └─ SyncOrchestrator déclenche pushToSupabase()
                            → écrit dans Supabase + récupère remote_id
                            → UPDATE users SET remote_id = ? WHERE id = ?
```

Côté pull :

```
SyncOrchestrator.triggerSync()
  → UserTenantSyncService.syncNow(businessId)
      → pushPendingByEntity('user')      (SQLite → Supabase)
      → pullFromSupabase('user')         (Supabase → SQLite, last-write-wins)
```

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `src/sync/index.ts` | Ajout de `initializeUserTenantSync` + `getUserTenantSyncService` |
| `src/sync/production-sync-setup.ts` | Instancie `UserTenantSyncService` et le passe à `SyncOrchestrator` |
| `src/server/services/user.service.ts` (nouveau) | Service unifié outbox/Supabase pour `users` |
| `src/server/routes/users.ts` | Refactor : délègue tout à `UserService` |

## Pré-requis côté schéma

Pour que la synchronisation fonctionne, la table `users` doit disposer des
colonnes suivantes des deux côtés :

- `remote_id` (BIGINT) — l'id Supabase de l'utilisateur
- `tenant_id` (TEXT) — généralement `'5'`
- `business_id` (TEXT) — pour le filtrage côté pull
- `updated_at` (DATETIME / TIMESTAMPTZ) — last-write-wins
- `email` (TEXT, nullable, UNIQUE WHERE NOT NULL) — pour les utilisateurs avec email
- `password_hash` (TEXT) — pour le futur support email/password
- `has_setup_pin` (INTEGER) — flag PIN setup

**SQLite** : `src/server/db/database.ts` (lignes 393-418) garantit toutes ces
colonnes (CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN try/catch).

**Supabase** : `SUPABASE_RUNTIME_MIGRATION.sql` (lignes 142-177) ajoute
`tenant_id` et `business_id` à `users`, `tenants`, `tenant_users`. Pour les
colonnes `password_hash` et `has_setup_pin` côté Supabase, ajouter la migration
suivante si nécessaire :

```sql
-- backend/migrations/018_add_password_to_users_supabase.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_setup_pin BOOLEAN DEFAULT FALSE;
```

## Mapping des rôles

Le mapping des rôles entre local et Supabase est **transparent** car les
deux côtés utilisent les mêmes valeurs : `'admin' | 'manager' | 'cashier' | 'waiter' | 'owner'`.
La contrainte CHECK Supabase `role IN ('admin','cashier','waiter','manager','owner')`
est respectée.

## Mapping des statuts (is_active)

`is_active` est un BOOLEAN côté Supabase (0/1 en SQLite). Aucune conversion
n'est nécessaire : `UserTenantSyncService` pousse directement la valeur.

## Test du flux bidirectionnel

1. **Local → Supabase (push)** :
   - Démarrer l'app POS locale.
   - Créer un utilisateur "TestUser" depuis l'écran Utilisateurs.
   - Vérifier dans `data/database.db` que `users.remote_id` est rempli après
     le cycle de sync (~30s).
   - Vérifier dans Supabase (Table Editor > users) que "TestUser" apparaît.

2. **Supabase → Local (pull)** :
   - Depuis le Supabase Dashboard, créer un utilisateur "RemoteUser" avec
     `tenant_id = '5'`, `business_id = '5'`.
   - Attendre le prochain cycle de sync (≤30s) ou déclencher un trigger manuel
     (focus de la fenêtre).
   - Vérifier dans `data/database.db` que "RemoteUser" apparaît avec un
     `remote_id` non-null.

3. **Conflit / last-write-wins** :
   - Modifier le même utilisateur des deux côtés avec des `updated_at` différents.
   - Le plus récent gagne. Implémenté dans `UserTenantSyncService.pullFromSupabase`
     via la comparaison `remoteUpdatedAt > localUpdatedAt`.

## Logs à surveiller

```
[Sync] user insert queued for 42
[Sync] User insert upsert failed: <erreur>          ← en cas d'erreur réseau temporaire
[Sync] Push failed for user 42: <erreur>            ← retry automatique
[SyncOrchestrator] Sync completed - Pushed: X, Pulled: Y
```

## Rollback

En cas de problème, revenir au code précédent en restaurant :

```bash
git checkout HEAD -- src/server/routes/users.ts
# Note : la suppression de src/server/services/user.service.ts ne casse rien
# tant que routes/users.ts n'importe pas le service.
```
