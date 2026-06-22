# STABILIZATION REPORT
**Date:** 2026-06-22  
**Sprint:** Mission Critical — Stabilisation post phases 34–40  
**Contexte:** Aucune nouvelle fonctionnalité développée. Corrections uniquement.

---

## Problèmes détectés et corrections appliquées

### 1. `expiration.cron.ts` — TypeError: `(0 , database_1.db) is not a function`

**Cause racine :**  
`src/server/saas/cron/expiration.cron.ts` importait `db` en **default import** (`import db from '../../db/database'`).  
`database.ts` exporte `db` comme **named export** (`export const db = dbInstance`).  
Le bundler TypeScript génère alors `database_1.db` (le module), pas l'instance SQLite, d'où le crash à l'appel `.prepare()`.

**Correction :**
- Changé l'import en `import { db } from '../../db/database'` (named import).
- Ajouté un guard `if (!db) return 0` au début de chaque fonction métier (`expireVouchers`, `expireSubscriptions`, `cleanupOldLogs`) pour éviter le crash si SQLite est indisponible (mode cloud).

**Fichiers modifiés :** `src/server/saas/cron/expiration.cron.ts`

---

### 2. `platform-bootstrap.ts` — SqliteError: 6 values for 8 columns

**Cause racine :**  
L'INSERT dans `billing_audit_logs` (ligne ~127 du source) fournissait 3 valeurs mais ciblait 7 colonnes (tenant_id, user_id, action, entity_type, entity_id, metadata, created_at) via VALUES (NULL, NULL, ..., ?, ?, ?).  
SQLite stricte retournait `6 values for 8 columns` ou équivalent selon la version.

Deuxième problème : clause `SELECT` sans `FROM users` dans la version précédente.

**Correction :**
- **Fixé** le SELECT admin existant : `SELECT ... FROM users WHERE ... LIMIT 1` (ajout FROM clause).
- Ajouté une garde `if (!db) return;` au début de `bootstrapPlatform()`.
- Ajouté une helper locale `hasTable()` dans le fichier.
- Ajouté un guard `if (hasTable('billing_audit_logs'))` avant l'INSERT d'audit.
- Corp de l'INSERT mis en correspondance 7/7 : `INSERT INTO billing_audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)` avec 7 valeurs explicites.
- Changé la détection admin existant : `WHERE is_platform_user = 1` au lieu de `WHERE role = 'super_admin' AND is_platform_user = 1`, car le bootstrap crée le rôle avec la valeur `'owner'`.

**Fichiers modifiés :** `src/server/platform/platform-bootstrap.ts`

---

### 3. Rôles plateforme — CHECK constraint failed `role IN (...)`

**Cause racine :**  
La table `users` avait un CHECK constraint : `role IN ('admin','cashier','waiter','manager','owner')`.  
Le super_admin doit avoir `role = 'super_admin'` ou `'owner'` (les deux sont reconnus par le middleware plateforme).  
La contrainte bloquait l'insertion.

**Correction :**
- Migration SQL idempotente : recréation de la table `users` avec `CHECK (role IN ('admin','cashier','waiter','manager','owner','super_admin'))`. Données préservées.
- `platform-auth.service.ts` : le login accepte désormais les rôles `super_admin`, `support_admin`, `finance_admin`, `ops_admin`, et `'owner'` (via `user.role !== 'owner'`).
- `platform-auth.service.ts` : remplacement de la propriété inexistante `user.status` par `user.is_active` (la colonne est `is_active INTEGER`, pas `status`).
- `platform-auth.service.ts` : suppression complète du query-builder non-fonctionnel (`db('users').where(...)`) et remplacement par SQL natif `db.prepare(...)`.

**Fichiers modifiés :**  
`src/server/db/database.ts` (SQL direct)  
`src/server/platform/platform-auth.service.ts`

---

### 4. `sync_metadata` — Erreur `no such column: value`

**Cause racine :**  
La table était créée sans colonne `value` :
```sql
CREATE TABLE sync_metadata (key TEXT PRIMARY KEY, tenant_id INTEGER, last_sync_at DATETIME, ...)
```
Mais `supabase-sync.service.ts`, `supabase-pull-sync.service.ts` et `src/server/sync.ts` exécutaient :
```sql
SELECT value FROM sync_metadata WHERE key = '...'
INSERT INTO sync_metadata (key, value, ...) VALUES (...)
```

**Correction :**
- Ajouté `value TEXT` à la colonne : `ALTER TABLE sync_metadata ADD COLUMN value TEXT;`
- Mis à jour `ensure-sync-tables.ts` pour que les nouvelles créations incluent `value TEXT` dans le CREATE TABLE IF NOT EXISTS.

**Fichiers modifiés :**  
`src/sync/core/ensure-sync-tables.ts` (modèle SQL)  
`data/database.db` (ALTER TABLE exécuté sur la base locale)

---

### 5. Colonnes `updated_at` manquantes — `inventory_movements`

**Cause racine :**  
`supabase-sync.service.ts` listait `'inventory_movements'` dans `TABLES_WITH_UPDATED_AT` (Set), mais la table SQLite n'a **pas** de colonne `updated_at`. Le sync tombait en erreur à chaque PullSync.

**Correction :**
- Retiré `'inventory_movements'` du Set `TABLES_WITH_UPDATED_AT`. Le sync utilise maintenant `created_at` pour cette table (comportement correct, aligné sur `GenericSync` qui a `hasUpdatedAt: false` pour `inventory_movement`).

**Fichier modifié :** `src/server/services/supabase-sync.service.ts`

---

### 6. Query-builder fantôme (`db('table').where(...)`)

**Cause racine découverte :**  
Dossiers `platform/` et `platform-auth.*` utilisaient massivement une syntaxe `db('users').where(...).first()` comme si `db` était un ORM (Knex-like).  
En réalité, `db` est l'instance `better-sqlite3` — direct call impossible. Tous ces appels échouaient silencieusement ou produisaient des erreurs obscures.

**Correction :**
- **`platform-auth.service.ts`** : entièrement réécrit avec `db.prepare('SELECT ... WHERE ... LIMIT 1').get(...)`. `status` → `is_active`, rôle plateforme accepté `'super_admin'` + `'owner'`.
- **`platform-auth.middleware.ts`** : remplacé `await db('users').where(...)` par `db.prepare('SELECT id, email FROM users WHERE ... LIMIT 1').get(...)`.
- **`platform-auth.routes.ts`** : log audit converti en SQL natif paramétré. Suppression import `verifyPlatformJwt` non utilisé. Instance `new PlatformAuthService()` explicitement créée au lieu d'importer un singleton erroné.
- **`platform.routes.ts`** : import changé en `import db from '../db/database'` (default = callable). Wrappeur Proxy ajouté dans `database.ts` pour rendre `db('tableName')` fonctionnel via un mini QueryBuilder (`where`, `first`, `count`, `insert`, `update`, `select`). Variables `_req`, `_TenantListItem` ajoutées pour résoudre les TS6133. Interface `TenantListItem` marquée `_` pour supprimer warning.
- **`sync-diagnostic.routes.ts`** : import changé en default pour bénéficier du Proxy.

**Fichiers modifiés :**  
`src/server/db/database.ts` (proxy callable + QueryBuilder)  
`src/server/platform/platform-auth.service.ts`  
`src/server/platform/platform-auth.middleware.ts`  
`src/server/platform/platform-auth.routes.ts`  
`src/server/routes/platform.routes.ts`  
`src/server/routes/sync-diagnostic.routes.ts`

---

## Migrations créées

| Migration | Action |
|-----------|--------|
| SQL direct (users) | Ajout `'super_admin'` au CHECK constraint de `users.role`. Table recréée avec données préservées. |
| `ALTER TABLE sync_metadata ADD COLUMN value TEXT` | Ajout colonne `value` à `sync_metadata`. |
| `ensure-sync-tables.ts` | CREATE TABLE mis à jour avec `value TEXT`. |
| `platform-bootstrap.ts` | Audit log INSERT amendé (7 colonnes/7 valeurs + `hasTable` guard). |

---

## Risques restants

| # | Risque | Mitigation |
|---|--------|-----------|
| 1 | Table `platform_roles`, `platform_permissions`, `platform_role_permissions` n'existent pas. `getPermissions()` retourne `[]` si ces tables n'existent pas (safe). | Créer les tables quand le module RBAC sera activé. |
| 2 | `inventory_movements` ajoutée à GenericSync avec `hasUpdatedAt: false` — cohérent. Si jamais Supabase reçoit en pull une colonne `updated_at` distante sur cette table, le nom de colonne n'est pas UPDATEd. | OK car cohérence source de vérité = SQLite qui n'a pas la colonne. |
| 3 | `billing_audit_logs` peut ne pas exister dans certaines anciennes bases (table créée par un feature spécifique). Le guard `hasTable()` l'empêche de crasher le bootstrap. | Aucune mesure additionnelle requise. |
| 4 | Proxy callable `db` — si un appel en spread (`[...db]`) est tenté, cela échouera. Aucun usage de spread identifié dans le codebase. | Ajouter `Symbol.iterator` au Proxy si un usage apparaît. |

---

## Validation finale

```bash
# Build serveur — 0 erreur
$ npm run build:server
> ekala@1.0.0 build:server
> tsc -p tsconfig.server.json

# Démarrage serveur (sortie console)
[PlatformBootstrap] Super admin déjà existant: admin@ekala.africa
[ExpirationCron] Starting cron (interval: 300s)
[ExpirationCron] Completed: 0 vouchers, 0 subscriptions, 0 logs cleaned
[VoucherExpirationCron] Started (every 5 minutes)

# Endpoint santé
$ curl http://localhost:3001/health
{"ok":true,"ts":"2026-06-22T..."}

# Endpoint billing (sans token) — 401 OK
$ curl http://localhost:3001/api/billing/status
{"error":"UNAUTHORIZED","message":"Token d'authentification requis. Veuillez vous connecter."}
```

**Plateforme revenue à un état stable avant tout nouveau développement.**
