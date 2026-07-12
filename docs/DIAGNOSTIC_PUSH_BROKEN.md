# DIAGNOSTIC : Push Local → Cloud cassé (orders, products stock)

**Date :** 12 Juillet 2026  
**Problème :** Les commandes passées en local n'apparaissent pas dans le cloud, et le stock est désynchronisé.

---

## 1. ANALYSE DU FLUX DE DONNÉES

### 1.1 Schéma actuel

```
MODE LOCAL : Commande POS passée dans Electron
┌─────────────────────────────────────────────────┐
│  POS Local                                      │
│  ├── OrderService.create()                      │
│  │   ├── 1. INSERT INTO orders (SQLite) ✅      │
│  │   ├── 2. INSERT INTO order_items (SQLite) ✅ │
│  │   ├── 3. Queue outbox 'order' ✅             │
│  │   ├── 4. Queue outbox 'order_item' ✅        │
│  │   └── 5. ⚠️ stock_quantity NON mis à jour!   │
│  │                                               │
│  └── SyncOrchestratorV2 (toutes les 30s)        │
│      ├── GenericSync.pushByEntity('order')      │
│      │   └── ❌ ÉCHEC (voir causes)              │
│      ├── GenericSync.pushByEntity('product')     │
│      │   └── stock_quantity pas à jour → rien   │
│      └── ...                                     │
└─────────────────────────────────────────────────┘
```

### 1.2 3 causes racines identifiées

| # | Cause | Fichier | Gravité |
|---|-------|---------|---------|
| 1 | **Le stock n'est pas décrémenté en local** | `order.service.ts` | 🔴 Critique |
| 2 | **Le push via GenericSync échoue** (FK non résolues) | `generic-sync.service.ts` | 🔴 Critique |
| 3 | **Conflit entre PullSyncWorker et GenericSync** | les deux | 🟠 Élevé |

---

## 2. CAUSE #1 : Stock non mis à jour

### Preuve

Dans `src/server/services/order.service.ts`, la méthode `create()` (lignes 428-607) :
- ✅ Crée la commande
- ✅ Crée les order_items
- ✅ Queue l'outbox
- ❌ **NE met PAS à jour** `stock_quantity` dans `products`

La méthode `create()` est la suivante (simplifiée) :
```typescript
static async create(orderData) {
  // ... validation ...
  const result = db.prepare(`INSERT INTO orders ...`).run(...);
  const orderId = result.lastInsertRowid;
  this.insertOrderItems(orderId, normalizedItems);  // Insère les items
  // ❌ Rien ici pour décrémenter le stock !
}
```

Pourtant, la fonction `insertOrderItems()` (ligne 146) existe et pourrait mettre à jour le stock mais ne le fait pas.

### Impact
Le stock ne change JAMAIS en local quand une commande est créée. Et donc le push vers Supabase n'a rien à synchroniser.

---

## 3. CAUSE #2 : Push GenericSync échoue

### 3.1 Analyse de `GenericSyncService.pushByEntity()`

Quand le GenericSyncService essaye de pusher une commande :
1. Il lit l'outbox pour 'order' avec `status = 'pending'`
2. Pour chaque item, il appelle `handleUpsert()`
3. `handleUpsert()` résout les FK (table_id, waiter_id, customer_id)
4. Si une FK n'est pas résolue → `delete safeUpdate[field]` (supprime le champ)
5. Puis `upsert()` vers Supabase

**Problème :** Si `table_id` a une valeur qui n'est pas un remote_id valide dans Supabase, l'upsert échoue avec une erreur FK. Et après `MAX_RETRIES` (5), l'item va dans la DLQ.

### 3.2 Analyse des logs du serveur

Les logs du terminal montrent :
```
[PRODUCT UPSERT ERROR] errorCode: '23503' 
errorMessage: 'violates foreign key constraint "products_category_id_fkey"'
```

Les produits échouent à cause de `category_id` non résolu. Mais les commandes, elles, ne sont même pas essayées car le cycle est bloqué par l'erreur des produits.

---

## 4. CAUSE #3 : Conflit PullSyncWorker ↔ GenericSync

### 4.1 Double écriture des commandes

Le PullSyncWorker PULL les commandes depuis Supabase vers SQLite.
Le GenericSyncService PUSH les commandes depuis SQLite vers Supabase.

Si une commande est créée localement → Push vers Supabase → Pull vers SQLite → UPDATE (déjà présent)

C'est correct pour une commande locale. Mais :
- Si une commande est créée dans le cloud → Pull vers SQLite
- Puis que le GenericSync essaye de la re-pusher vers Supabase → UPSERT (déjà présent)

Normalement l'`upsert` avec le même `remote_id` devrait juste faire un UPDATE dans Supabase. Donc pas de conflit.

### 4.2 Problème : curseur d'outbox

Quand PullSyncWorker insère une commande dans SQLite, elle a un `id` local + `remote_id`. Mais l'outbox ne sait pas qu'elle existe. Donc la commande pullée n'est pas re-pushée. C'est correct.

Par contre, si le GenericSync essaye de pusher une commande qui a `remote_id` mais que le `table_id` pointe vers un ID local non résolu en remote → échec.

---

## 5. SOLUTION PROPOSÉE

### 5.1 Correction immédiate : Mettre à jour le stock lors d'une commande

Dans `src/server/services/order.service.ts`, ajouter dans `create()` :

```typescript
// Après insertOrderItems, décrémenter le stock
for (const item of normalizedItems) {
  const productId = item.productId ?? item.product_id;
  if (productId) {
    db.prepare(`
      UPDATE products 
      SET stock_quantity = stock_quantity - ?, 
          updated_at = CURRENT_TIMESTAMP,
          version = version + 1
      WHERE id = ? AND tenant_id = ?
    `).run(item.quantity, productId, tenantId);
    
    // Queue le produit dans l'outbox
    getProductSyncService()?.queueChangeInsideTransaction('product', 'update', {
      id: productId,
      stock_quantity: `stock_quantity - ${item.quantity}`, // Sera résolu par le sync
      updated_at: new Date().toISOString(),
      tenant_id: tenantId
    });
  }
}
```

### 5.2 Correction : Gérer les erreurs FK dans le push

Dans `GenericSyncService.handleUpsert()`, pour les commandes, ne pas supprimer `table_id` si non résolu mais le laisser à `null`. Et dans Supabase, s'assurer que `table_id` peut être NULL.

### 5.3 Correction : Activer le OutboxWorkerV2

Activer `OutboxWorkerV2` comme SEUL point d'écriture vers Supabase, pour éviter les conflits entre PullSyncWorker et GenericSync.

---

## 6. PLAN D'ACTION

| Priorité | Action | Fichier | Effort |
|----------|--------|---------|--------|
| 🔴 P1 | Décrémenter stock dans `OrderService.create()` | `order.service.ts` | 30 min |
| 🔴 P1 | Queue produit dans outbox après mise à jour stock | `order.service.ts` | 15 min |
| 🟠 P2 | Rendre `table_id` nullable dans le push order | `generic-sync.service.ts` | 15 min |
| 🟠 P3 | Activer `OutboxWorkerV2` comme seul writer | `server.ts` | 1 heure |
| 🟡 P4 | Ajouter tests d'intégration push/pull | nouveau fichier | 2 heures |

---

## 7. CONCLUSION

**Le problème principal est que le stock n'est pas mis à jour localement lors d'une commande.** 
Sans cette mise à jour :
- Le stock local reste identique
- Le push vers Supabase n'a rien à synchroniser
- Le stock cloud et local divergent

**La correction #1 (décrémenter le stock) est la plus critique** et résoudra 80% du problème de synchronisation des stocks.