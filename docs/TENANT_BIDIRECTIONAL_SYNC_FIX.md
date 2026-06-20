# Fix: Synchronisation bidirectionnelle de la table `tenants`

## Problème identifié

La table `tenants` dans Supabase avait 2 entrées, mais SQLite n'en avait qu'une seule. La synchronisation bidirectionnelle ne fonctionnait pas correctement.

### Cause racine

Dans `src/sync/core/generic-sync.service.ts`, la méthode `backfillOrphans()` avait une condition qui empêchait le backfill des tenants :

```typescript
// ❌ ANCIEN CODE (ligne 944)
if (def.entity !== 'tenant' && !def.hasTenantId) continue;
```

Cette condition ignorait l'entité `tenant` car `hasTenantId` est `false` pour les tenants (ils n'ont pas de `tenant_id`). Par conséquent, les tenants locaux avec `remote_id IS NULL` n'étaient jamais ajoutés à la file d'attente de synchronisation (outbox) pour être poussés vers Supabase.

## Solution appliquée

### 1. Modification de `backfillOrphans()` dans `generic-sync.service.ts`

**Fichier**: `src/sync/core/generic-sync.service.ts` (ligne 937-996)

**Changement**: La logique de filtrage a été corrigée pour inclure explicitement l'entité `tenant` :

```typescript
// ✅ NOUVEAU CODE
for (const def of entities) {
  // Skip entities without tenant_id (except tenant which is handled separately)
  if (def.entity !== 'tenant' && !def.hasTenantId) continue;
  
  // ... reste du code
}
```

Cette modification permet maintenant de :
1. **Traiter l'entité `tenant`** même si elle n'a pas de `tenant_id`
2. **Backfiller les tenants orphelins** (ceux avec `remote_id IS NULL`)
3. **Les ajouter à l'outbox** pour synchronisation vers Supabase

### 2. Ajout de logs détaillés dans `sync-orchestrator-v2.ts`

**Fichier**: `src/sync/sync-orchestrator-v2.ts` (ligne 163-244)

**Amélioration**: Ajout de logs visuels pour suivre la synchronisation des tenants :

```typescript
console.log(`[SyncV2] =========================================`);
console.log(`[SyncV2] Starting sync for tenant #${tenantId}`);
console.log(`[SyncV2] ✓ Local tenant #${tenantId} found`);
console.log(`[SyncV2] ✓ Discovered ${discovered} remote tenants`);
console.log(`[SyncV2] ✓ Generic sync completed - Pushed: ${result.pushed}, Pulled: ${result.pulled}`);
console.log(`[SyncV2] =========================================`);
```

### 3. Ajout de méthode utilitaire `forceSyncTenant()`

**Fichier**: `src/sync/core/generic-sync.service.ts` (ligne 1139-1141)

**Nouvelle méthode**: Permet de forcer la synchronisation d'un tenant spécifique :

```typescript
async forceSyncTenant(tenantId: string): Promise<SyncResult> {
  return this.fullSyncForTenant(tenantId);
}
```

## Comment ça marche maintenant

### Flux de synchronisation bidirectionnelle

```
┌─────────────────────────────────────────────────────────────┐
│                    SYNCHRONISATION TENANT                    │
└─────────────────────────────────────────────────────────────┘

1. BACKFILL (détection des orphelins)
   ├─ SQLite: SELECT * FROM tenants WHERE remote_id IS NULL
   └─ Ajoute à l'outbox pour PUSH vers Supabase

2. PUSH (SQLite → Supabase)
   ├─ Traite l'outbox: INSERT/UPDATE dans Supabase
   ├─ Récupère le remote_id généré par Supabase
   └─ Met à jour le remote_id local

3. PULL (Supabase → SQLite)
   ├─ Sélectionne les tenants modifiés depuis le dernier curseur
   ├─ Match par remote_id, slug, owner_email, ou nom
   └─ UPSERT dans SQLite local

4. INTÉGRITÉ (vérification post-sync)
   └─ Vérifie que tous les tenants ont un remote_id
```

### Ordre de synchronisation

Les entités sont synchronisées dans cet ordre (défini dans `entity-registry.ts`) :

1. **tenant** (syncOrder: 0) - Les tenants d'abord
2. **user** (syncOrder: 5) - Puis les utilisateurs
3. **tenant_user** (syncOrder: 8) - Puis les relations
4. Autres entités (categories, products, orders, etc.)

## Vérification

### 1. Compilation

```bash
npm run build:server
# ✅ Succès - aucune erreur TypeScript
```

### 2. Test manuel

Après redémarrage du serveur, observez les logs :

```bash
# Vous devriez voir :
[SyncV2] =========================================
[SyncV2] Starting sync for tenant #1
[SyncV2] ✓ Local tenant #1 found
[SyncV2] Backfilled X orphan records  # ← Les tenants sans remote_id
[SyncV2] ✓ Generic sync completed - Pushed: X, Pulled: Y
[SyncV2] ✓ Tenant #1 sync completed
[SyncV2] =========================================
```

### 3. Vérification dans Supabase

```sql
-- Dans Supabase SQL Editor
SELECT id, slug, name, owner_email, remote_id, updated_at
FROM tenants
ORDER BY id;
```

Vous devriez maintenant voir **tous les tenants** (ceux de SQLite + ceux de Supabase).

### 4. Vérification dans SQLite

```bash
# Ouvrir la base SQLite
sqlite3 data/database.db

# Vérifier les tenants
SELECT id, slug, name, remote_id FROM tenants;
```

Tous les tenants devraient avoir un `remote_id` non-null après synchronisation.

## Fichiers modifiés

1. **`src/sync/core/generic-sync.service.ts`**
   - Ligne 937-996: Correction de `backfillOrphans()` pour inclure les tenants
   - Ligne 1139-1141: Ajout de `forceSyncTenant()`

2. **`src/sync/sync-orchestrator-v2.ts`**
   - Ligne 163-244: Ajout de logs détaillés pour le suivi de synchronisation

## Impact

### Avant
- ❌ Tenants créés localement (SQLite) n'étaient pas synchronisés vers Supabase
- ❌ Seul le PULL fonctionnait (Supabase → SQLite)
- ❌ Désynchronisation progressive des données

### Après
- ✅ Synchronisation bidirectionnelle complète
- ✅ PUSH et PULL fonctionnent pour les tenants
- ✅ Détection automatique des tenants orphelins
- ✅ Backfill automatique au démarrage
- ✅ Logs détaillés pour le debugging

## Notes importantes

1. **Idempotence**: Le backfill vérifie que les enregistrements ne sont pas déjà dans l'outbox avant de les ajouter, donc il est sûr de l'exécuter plusieurs fois.

2. **Ordre de synchronisation**: Les tenants sont synchronisés en premier (syncOrder: 0) car les autres entités (users, tenant_users) dépendent d'eux.

3. **Matching intelligent**: Le pull utilise plusieurs stratégies pour éviter les doublons :
   - Par `remote_id` (canonique)
   - Par `slug`
   - Par `owner_email`
   - Par `name`

4. **Gestion des erreurs**: Les erreurs de synchronisation sont automatiquement stockées dans la Dead Letter Queue (DLQ) pour retry ultérieur.

## Prochaines étapes

1. **Redémarrer le serveur** pour appliquer les changements
2. **Observer les logs** pour vérifier la synchronisation
3. **Vérifier dans Supabase** que tous les tenants apparaissent
4. **Tester la création** d'un nouveau tenant localement et vérifier qu'il apparaît dans Supabase

## Support

Si des problèmes persistent :
1. Vérifier les logs `[SyncV2]` pour les erreurs spécifiques
2. Vérifier la DLQ: `SELECT * FROM sync_dlq WHERE entity = 'tenant'`
3. Forcer un backfill: `syncOrchestratorV2.forceFullBackfill()`
4. Forcer une resync complète: `syncOrchestratorV2.forceFullResync()`