# DIAGNOSTIC : Problème de synchronisation du stock (Bidirectionnel cassé)

**Date :** 11 Juillet 2026  
**Problème :** Le stock diminue dans Supabase après une commande cloud, mais pas dans SQLite locale

---

## 1. ANALYSE DE LA RUPTURE

### 1.1 Schéma du flux actuel

```
MODE CLOUD : Commande POS passée dans le cloud
┌─────────────────────────────────────────────┐
│  POS Cloud                                   │
│  ├── 1. OrderService.create() → Supabase     │
│  ├── 2. Supabase.orders.insert()             │
│  └── 3. Stock décrémenté dans Supabase       │
│       (via trigger ou logique métier cloud)  │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│  PullSyncWorker                               │
│  ├── pullOrders()         ✅ OK              │
│  ├── pullOrderItems()     ✅ OK              │
│  ├── pullRestaurantTables() ✅ OK             │
│  ├── pullInventoryMovements() ✅ OK           │
│  └── pullProducts()       ❌ MANQUANT !!!    │
│       (stock_quantity jamais synchronisé)    │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│  SQLite locale                                │
│  ├── orders        ✅ synchronisées           │
│  └── products      ❌ stock NON mis à jour   │
│       (stock_quantity reste à l'ancienne     │
│        valeur, avant la commande cloud)      │
└─────────────────────────────────────────────┘
```

### 1.2 Causes racines identifiées

| # | Cause | Fichier | Gravité |
|---|-------|---------|---------|
| 1 | **`pullProducts()` manquant** dans le PullSyncWorker | `supabase-pull-sync.service.ts` | 🔴 Critique |
| 2 | **`pullCategories()` manquant** — les catégories créées dans le cloud ne sont pas synchronisées | `supabase-pull-sync.service.ts` | 🟠 Élevé |
| 3 | **Curseur unique pour toutes les entités** — le curseur `last_supabase_pull` est basé sur `MAX(orders.updated_at)`, ce qui ne couvre pas les produits modifiés sans commande associée | `supabase-pull-sync.service.ts` ligne 142 | 🟠 Élevé |
| 4 | **Pas de pull des `customers`** — les clients créés dans le cloud ne sont pas visibles localement | `supabase-pull-sync.service.ts` | 🟡 Moyen |

### 1.3 Impact métier

| Scénario | Comportement actuel | Comportement attendu |
|----------|--------------------|---------------------|
| Commande cloud → stock diminue | Stock local inchangé | Stock local doit diminuer |
| Nouveau produit créé dans le cloud | Invisible dans le POS local | Doit apparaître |
| Catégorie créée dans le cloud | Invisible dans le POS local | Doit apparaître |
| Produit désactivé (is_available=false) dans le cloud | Toujours visible dans le POS local | Doit disparaître |

---

## 2. SOLUTION PROPOSÉE

### 2.1 Ajouter `pullProducts()` dans le PullSyncWorker

Nouvelle fonction à ajouter dans `supabase-pull-sync.service.ts` :

```typescript
async function pullProducts(supabase, since, tenantId) {
  // 1. Pull les produits modifiés depuis Supabase
  // 2. Résout category_id (FK) par remote_id
  // 3. UPDATE si remote_id existe, INSERT sinon
  // 4. Met à jour : stock_quantity, selling_price, is_available, name, etc.
}
```

### 2.2 Ajouter `pullCategories()` dans le PullSyncWorker

```typescript
async function pullCategories(supabase, since, tenantId) {
  // 1. Pull les catégories depuis Supabase
  // 2. UPDATE si remote_id existe, INSERT sinon
}
```

### 2.3 Ordre de synchronisation mis à jour

```
1. pullCategories()       ← NOUVEAU (exécuté en premier pour résoudre les FK)
2. pullProducts()         ← NOUVEAU (stock, prix, disponibilité)
3. pullRestaurantTables() ← existant
4. pullInventoryMovements() ← existant
5. pullOrders()           ← existant
6. pullOrderItems()       ← existant
```

### 2.4 Curseur dédié pour les produits

Le curseur actuel basé sur `MAX(orders.updated_at)` ne fonctionne pas pour les produits.  
Solution : utiliser un curseur spécifique `last_supabase_pull_products` basé sur `MAX(products.updated_at)`.

---

## 3. FICHIERS À MODIFIER

| Fichier | Modification |
|---------|-------------|
| `src/server/services/supabase-pull-sync.service.ts` | Ajouter `pullProducts()` et `pullCategories()`, mettre à jour l'ordre d'exécution |

---

## 4. CALENDRIER

| Action | Effort |
|--------|--------|
| Ajouter `pullCategories()` | 15 min |
| Ajouter `pullProducts()` | 30 min |
| Mettre à jour l'ordre d'exécution | 5 min |
| Tester | 15 min |
| **Total** | **~1 heure** |