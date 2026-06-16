# Fix de Synchronisation des Produits - Résumé Technique

## Problème Identifié

Les suppressions de produits côté UI semblaient réussir (message "supprimé avec succès") mais les données restaient présentes dans les deux bases de données (SQLite et Supabase).

## Root Cause Analysis

1. **SQLite est la source de vérité** : Les suppressions sont d'abord appliquées localement (soft delete) puis queued pour synchronisation vers Supabase.

2. **Problème dans GenericSyncService** :
   - Après avoir poussé une suppression vers Supabase, le code marquait immédiatement le record local comme supprimé
   - **Mais il n'y avait PAS de vérification que Supabase avait bien reçu et appliqué la suppression**
   - Si la suppression Supabase échouait, le record local était déjà marqué comme supprimé
   - Lors du prochain pull, le produit supprimé localement pouvait être réimporté depuis Supabase (s'il n'était pas supprimé)

3. **Problème dans ProductSyncService** :
   - Si un produit n'avait pas de `remote_id`, la suppression était complètement skipée
   - Pas de tentative de trouver le produit dans Supabase par clé naturelle (nom + tenant_id)

4. **Problème de récupération** :
   - Pas de mécanisme pour détecter et synchroniser les produits soft-deletés localement qui n'ont pas été queued dans l'outbox

5. **Problème de détection des soft-deletes** :
   - Lors du pull, les produits soft-deletés dans Supabase n'étaient pas toujours détectés et appliqués localement

## Solutions Implémentées

### 1. GenericSyncService - pushByEntity (fichier: `src/sync/core/generic-sync.service.ts`)

**Corrections :**
- Avant de marquer une suppression comme terminée, **vérification explicite** que Supabase a bien appliqué le soft-delete
- Si la vérification échoue, l'item reste dans l'outbox avec status `pending` pour retry
- Recherche du `remote_id` par clé naturelle (nom + tenant) si non présent dans le payload

**Code clé :**
```typescript
// Vérifier que la suppression a bien été appliquée dans Supabase avant de marquer localement
if (def.entity === 'product' && (resolvedRemoteId || remoteId)) {
  const { data: remoteCheck, error: verifyError } = await this.supabase
    .from(def.remoteTable)
    .select('is_available, deleted_at')
    .eq('id', targetIdStr)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  
  if (!remoteCheck || (remoteCheck.is_available !== false && !remoteCheck.deleted_at)) {
    console.error(`[GenericSync] Product deletion NOT verified in Supabase - will retry`);
    this.db.prepare(`UPDATE sync_outbox SET status = 'pending' WHERE id = ?`).run(item.id);
    continue; // Ne pas marquer comme done
  }
}
```

### 2. GenericSyncService - handleDelete

**Corrections :**
- Accepte maintenant un paramètre `remoteId` optionnel pour éviter de refaire la recherche
- Recherche améliorée du remote_id par clé naturelle pour les produits
- Gère le cas où le produit n'a jamais été synchronisé (pas de remote_id)

**Code clé :**
```typescript
private async handleDelete(
  def: SyncEntityDefinition,
  _item: any,
  payload: any,
  recordId: number,
  remoteId?: number | string | null  // Nouveau paramètre
) {
  // Recherche du remote_id avec fallback par clé naturelle
  let targetId = remoteId || payload.remote_id;
  if (!targetId) {
    const localRemoteId = this.getRemoteId(def.localTable, recordId);
    if (localRemoteId) {
      targetId = localRemoteId;
    }
  }
  
  // Pour les produits: recherche par clé naturelle
  if (!targetId && def.entity === 'product' && payload.name && payload.tenant_id) {
    const existing = await this.findExistingRemoteRecord(def, payload, String(payload.tenant_id));
    if (existing?.id) {
      targetId = existing.id;
    }
  }
}
```

### 3. GenericSyncService - pullByEntity

**Corrections :**
- Détection explicite des soft-deletes depuis Supabase
- Application forcée des soft-deletes même si le timestamp n'est pas plus récent

**Code clé :**
```typescript
// DÉTECTER LES SOFT DELETES - Toujours appliquer si le remote est supprimé
const isRemoteSoftDeleted = def.entity === 'product' && 
  (remote.is_available === false || remote.deleted_at !== null || remote.status === 'archived');

// Vérifier si le remote est plus récent OU si c'est un soft delete
const shouldApply = !local || !localTs || 
  (remoteTs && new Date(remoteTs) > new Date(localTs)) ||
  isRemoteSoftDeleted;
```

### 4. GenericSyncService - buildPullFields

**Corrections :**
- Ajout explicite des champs `deleted_at`, `is_available`, et `status` pour les produits

**Code clé :**
```typescript
// S'assurer que deleted_at et is_available sont inclus pour les soft deletes
if (def.entity === 'product') {
  if (remote.deleted_at !== undefined) {
    fields.deleted_at = remote.deleted_at;
  }
  if (remote.is_available !== undefined) {
    fields.is_available = remote.is_available ? 1 : 0;
  }
  if (remote.status !== undefined && fields.status === undefined) {
    fields.status = remote.status;
  }
}
```

### 5. Nouvelle Méthode - syncOrphanDeletes

**Nouvelle fonctionnalité :**
- Détecte les produits soft-deletés localement mais pas queued dans l'outbox
- Queue automatiquement ces suppressions pour synchronisation

**Code clé :**
```typescript
syncOrphanDeletes(tenantId: string): number {
  // Trouver les produits locaux soft-deletés mais pas dans l'outbox
  const softDeletedProducts = this.db.prepare(`
    SELECT p.* 
    FROM ${def.localTable} p
    WHERE p.tenant_id = ?
    AND (p.deleted_at IS NOT NULL OR p.is_available = 0)
    AND p.id NOT IN (
      SELECT o.record_id 
      FROM sync_outbox o 
      WHERE o.entity = 'product' 
      AND o.operation = 'delete' 
      AND o.status IN ('pending', 'in_progress')
      AND o.tenant_id = ?
    )
  `).all(tenantId, tenantId);
  
  // Queue les suppressions manquantes
  for (const product of softDeletedProducts) {
    if (product.remote_id) {
      this.queueChange('product', 'delete', {
        id: product.id,
        remote_id: product.remote_id,
        tenant_id: product.tenant_id,
        is_available: 0,
        deleted_at: product.deleted_at || new Date().toISOString(),
      });
    }
  }
}
```

### 6. Intégration dans SyncOrchestratorV2

**Corrections :**
- Appel de `syncOrphanDeletes` avant le sync complet pour récupérer les suppressions manquantes

**Code clé :**
```typescript
// Phase 2b: Sync des suppressions orphelines pour les produits
try {
  const orphanDeletes = this.genericSync.syncOrphanDeletes(tenantId);
  if (orphanDeletes > 0) console.log(`[SyncV2] Queued ${orphanDeletes} orphan deletes for products`);
} catch (orphanErr: any) {
  console.warn('[SyncV2] Orphan delete sync partial failure:', orphanErr?.message);
}
```

### 7. ProductSyncService - handleDelete

**Corrections :**
- Recherche du produit dans Supabase par clé naturelle (nom + tenant) si remote_id manquant
- Retourne un booléen pour indiquer si la suppression a été effectuée

**Code clé :**
```typescript
// Si on n'a pas de remote_id, essayer de trouver par clé naturelle
if (!payload.remote_id && !localRemoteId && payload.name && tenantId) {
  const { data: existingProduct } = await this.supabase
    .from(table)
    .select('id')
    .eq('name', payload.name)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (existingProduct?.id) {
    targetId = existingProduct.id;
  }
}
```

## Flux de Synchronisation Corrigé

### Scénario 1: Suppression coté UI (SQLite source de vérité)

```
1. Utilisateur supprime un produit via UI
   ↓
2. LegacySQLiteProductAdapter.softDelete():
   - UPDATE products SET deleted_at = ?, is_available = 0, status = 'archived'
   - INSERT INTO sync_outbox (entity='product', operation='delete', ...)
   ↓
3. SyncOrchestratorV2.triggerSync():
   - Appel syncOrphanDeletes() → pas d'orphelins (déjà dans outbox)
   - fullSyncForTenant() → pushByEntity('product')
   ↓
4. GenericSyncService.pushByEntity():
   - Récupère l'item delete depuis outbox
   - Appelle handleDelete() avec remoteId
   - handleDelete() effectue UPDATE dans Supabase (is_available=false, deleted_at=...)
   ↓
5. Vérification explicite:
   - SELECT is_available, deleted_at FROM supabase WHERE id = ?
   - Si is_available === false ET deleted_at !== null → OK
   - Sinon → continue (laisse item dans outbox pour retry)
   ↓
6. Marque item comme 'done' dans outbox
   ↓
7. Marque produit local comme soft-deleted (si pas déjà fait)
```

### Scénario 2: Suppression coté Supabase (pull)

```
1. Un produit est soft-deleted dans Supabase (is_available=false, deleted_at=...)
   ↓
2. SyncOrchestratorV2.triggerSync():
   - fullSyncForTenant() → pullByEntity('product')
   ↓
3. GenericSyncService.pullByEntity():
   - Détecte que isRemoteSoftDeleted === true
   - shouldApply = true (même si timestamp pas plus récent)
   ↓
4. buildPullFields():
   - Inclut deleted_at, is_available=0, status='archived'
   ↓
5. applyPullRow():
   - UPDATE products SET deleted_at = ?, is_available = 0, status = 'archived'
   - WHERE id = ? (trouvé par remote_id ou clé naturelle)
```

### Scénario 3: Récupération des orphelins

```
1. Produit soft-deleted localement mais pas dans outbox (bug antérieur)
   ↓
2. SyncOrchestratorV2.triggerSync():
   - Appel syncOrphanDeletes()
   ↓
3. GenericSyncService.syncOrphanDeletes():
   - Trouve produits avec deleted_at IS NOT NULL OR is_available = 0
   - NOT IN sync_outbox (delete pending)
   - Queue les suppressions manquantes
   ↓
4. Prochaine synchronisation:
   - Traite les suppressions queued normalement
```

## Testing Recommandé

### Test 1: Suppression coté UI
1. Créer un produit dans l'UI
2. Attendre que la sync push le vers Supabase (vérifier dans la table Supabase)
3. Supprimer le produit via UI
4. Vérifier que :
   - Le produit disparaît de l'UI (is_available=0)
   - Dans SQLite: deleted_at IS NOT NULL, is_available=0
   - Dans Supabase: is_available=false, deleted_at IS NOT NULL
   - Dans sync_outbox: l'item delete est marqué comme 'done'

### Test 2: Suppression directe dans Supabase
1. Supprimer un produit directement dans Supabase (UPDATE products SET is_available=false, deleted_at=NOW())
2. Lancer la sync
3. Vérifier que :
   - Le produit est marqué comme supprimé dans SQLite
   - Dans sync_outbox: pas de conflit

### Test 3: Suppression sans remote_id
1. Créer un produit localement (pas encore sync vers Supabase)
2. Supprimer le produit via UI
3. Vérifier que :
   - Le produit est marqué comme supprimé dans SQLite
   - Aucun item delete dans sync_outbox pour ce produit (car pas de remote_id)
   - Pas de tentative de suppression dans Supabase (log: "has no remote_id - skipping remote delete")

### Test 4: Récupération des orphelins
1. Simuler un produit soft-deleted dans SQLite mais pas dans outbox (via SQL directe)
2. Lancer la sync
3. Vérifier que :
   - L'item delete est ajouté à sync_outbox
   - Le produit est supprimé dans Supabase lors de la prochaine sync

### Test 5: Vérification de la bidirectionnalité
1. Supprimer un produit coté UI
2. Avant que la sync ne termine, supprimer le même produit directement dans Supabase
3. Lancer la sync
4. Vérifier que :
   - Le produit reste supprimé dans les deux BD
   - Pas de conflit détecté

## Logs pour le Débogage

Les logs suivants ont été ajoutés/améliorés :

```
[GenericSync] Verification failed for product #X delete: <erreur>
[GenericSync] Product #X deletion NOT verified in Supabase - will retry
[GenericSync] Delete verification failed for product #X: <erreur>
[GenericSync] Found X soft-deleted products not in outbox for tenant #Y
[GenericSync] Queued orphan delete for product #X (remote=Y)
[GenericSync] Product #X has no remote_id, skipping orphan delete sync
[Sync] Found remote product by name for #X: remote_id=Y
[Sync] Skipping delete for product #X (shouldProceed=false)
```

## Fichiers Modifiés

1. `src/sync/core/generic-sync.service.ts` - Corrections principales
2. `src/sync/sync-orchestrator-v2.ts` - Intégration syncOrphanDeletes
3. `src/sync/product-sync.service.ts` - Amélioration handleDelete

## Backward Compatibility

Toutes les modifications sont backward compatible :
- Les méthodes existantes conservent leurs signatures (sauf handleDelete qui a un paramètre optionnel ajouté)
- Les comportements par défaut sont préservés
- Les corrections s'appliquent uniquement aux produits (entity === 'product')

## Performance Impact

- Ajout d'une requête de vérification par suppression de produit (1 SELECT supplémentaire)
- La méthode syncOrphanDeletes s'exécute une fois par tenant par sync (requête simple sur SQLite)
- Impact minimal sur les performances globales

## Sécurité

- Toutes les requêtes Supabase incluent le filtre `tenant_id` pour éviter les suppressions cross-tenant
- Les soft-deletes utilisent `is_available=false` et `deleted_at` (pas de suppression physique)
- Les vérifications sont effectues AVANT de marquer les items comme terminés

---

**Date:** 2026-06-16  
**Auteur:** Mistral Vibe (assisté)  
**Statut:** Implémentation complète ✅
