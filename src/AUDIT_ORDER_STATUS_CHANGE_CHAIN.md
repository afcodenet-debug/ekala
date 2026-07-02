# Audit : Chaîne complète des modifications de statut d'une commande

**Date** : 2026-07-02  
**Objet** : Cartographie exhaustive de tous les chemins capables de modifier `orders.status`

---

## A. MODIFICATIONS INTENTIONNELLES (Utilisateur / Système)

### A.1 Composant React → OrdersPage.tsx

| Ligne | Statut | Origine | Chaîne |
|-------|--------|---------|--------|
| 478 | `confirmed` | `OrdersPage.tsx` → `updateOrderStatus(order.id, 'confirmed')` → `useOrderStore.updateOrderStatus()` (store) → `api.orders.updateStatus()` (api-client) → `PATCH /orders/:id/status` → `server/routes/orders.ts:179-189` → `OrderService.updateStatus()` |
| 494 | `rejected` | Même chaîne, statut = `'rejected'` |
| 503 | `preparing` | Même chaîne, statut = `'preparing'` |
| 504 | `ready` | Même chaîne, statut = `'ready'` |
| 505 | `served` | Même chaîne, statut = `'served'` |
| 509 | `ready` | Même chaîne, statut = `'ready'` |
| 513 | `served` | Même chaîne, statut = `'served'` |
| 856 | `served` | Même chaîne (détails modale) |

**Fichiers clés** :
- `src/pages/OrdersPage.tsx` — points d'entrée UI
- `src/stores/useOrderStore.ts:201-220` — appel store → api
- `src/lib/api-client.ts:397-398` — `updateStatus(id, status, role)` → `PATCH /orders/:id/status`
- `src/server/routes/orders.ts:179-189` — route Express
- `src/server/services/order.service.ts:686-775` — implémentation métier

### A.2 Route de vente (checkout) → sales.ts

| Ligne | Statut | Chaîne |
|-------|--------|--------|
| 311 | `paid` | `POST /sales` → `server/routes/sales.ts:309-313` → `supabase.from('orders').update({ status: 'paid' })` |
| 721 | `paid` | `POST /sales` → `server/routes/sales.ts:721` → `db.prepare("UPDATE orders SET status = 'paid'")` |

**Note** : La route sales modifie le statut DIRECTEMENT en base, sans passer par OrderService.

---

## B. MODIFICATIONS AUTOMATIQUES / SYSTÈME

### B.1 Services de synchronisation (Reverse → SQLite)

#### B.1.1 Pull Sync Worker (Polling Supabase → SQLite)

| Fichier | Ligne | Type | Détail |
|---------|-------|------|--------|
| `src/server/services/supabase-pull-sync.service.ts` | 194 | **Blind overwrite** | `db.prepare("UPDATE orders SET status=?...").run(o.status, ...)` — écrase le statut local sans vérification |

**Déclencheur** : `startSupabasePullWorker()` → intervalle configurable (par défaut 8s) → `pullOrders()` pour chaque tenant.

**Origine** : `server.ts` → `startSupabasePullWorker()` au démarrage.

#### B.1.2 Realtime Sync Worker (Realtime Supabase → SQLite)

| Fichier | Ligne | Type | Détail |
|---------|-------|------|--------|
| `src/server/services/supabase-realtime-sync.service.ts` | 236-239 | **Blind overwrite** | Boucle `for (const column of columns) fields[column] = row[column]` — copie `status` depuis Supabase |

**Déclencheur** : `startSupabaseRealtimePull()` → souscrit aux events `postgres_changes` pour la table `orders`.

**Origine** : `server.ts` → `startSupabaseRealtimePull()` au démarrage.

### B.2 Sync bidirectionnel (Outbox → Supabase)

#### B.2.1 Generic Sync Service (sync/core)

| Fichier | Ligne | Type | Détail |
|---------|-------|------|--------|
| `src/sync/core/generic-sync.service.ts` | 554 | Status mapping | `if (mapped) safeUpdate.status = mapped` — traduction local→remote |
| `src/sync/core/generic-sync.service.ts` | 739 | Annulation | `.update({ status: 'cancelled' })` — annulation remote des order items |
| `src/sync/core/generic-sync.service.ts` | 1014 | Status mapping | `if (mapped) fields.status = mapped` — traduction remote→local |

#### B.2.2 Product Sync Service

| Fichier | Ligne | Type | Détail |
|---------|-------|------|--------|
| `src/sync/product-sync.service.ts` | 575-576 | Mapping statut table | `active` → `occupied`, `out_of_service` → `available` |
| `src/sync/product-sync.service.ts` | 720 | Annulation | `.update({ status: 'cancelled' })` |
| `src/sync/product-sync.service.ts` | 726 | Removed | `.update({ status: 'removed' })` |

---

## C. MODIFICATIONS INDIRECTES / TRANSITIVES

### C.1 Route PATCH /tables (Side effect sur commandes)

| Fichier | Ligne | Détail |
|---------|-------|--------|
| `src/server/routes/tables.ts` | 171 | `TableService.updateStatus(id, 'out_of_service')` — ne modifie pas les commandes directement |

### C.2 Route POST /orders (Création avec statut initial)

| Fichier | Ligne | Détail |
|---------|-------|--------|
| `src/server/services/order.service.ts` | 545 | `INSERT INTO orders (..., status, ...)` — statut initial `pending` défini à la création |

### C.3 Route PATCH /orders/:id (autres champs)

| Fichier | Ligne | Détail |
|---------|-------|--------|
| `src/server/routes/orders.ts` | 160-175 | Met à jour items/total — ne modifie PAS le statut |

---

## D. DIAGRAMME DE FLUX COMPLET

```
┌─────────────────────────────┐
│  OrdersPage.tsx (UI)        │
│  (confirmed/rejected/       │
│   preparing/ready/served)   │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  useOrderStore.ts           │
│  updateOrderStatus(id, st)  │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  api-client.ts              │
│  PATCH /orders/:id/status   │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐      ┌──────────────────────────┐
│  routes/orders.ts           │──────▶ OrderService.updateStatus│
│  router.patch('/:id/status')│      │ (cloud → Supabase)        │
└─────────────────────────────┘      │ (local → SQLite + outbox) │
                                     └──────────┬───────────────┘
                                                │
                    ┌───────────────────────────┴───────────────────────────┐
                    ▼                                                       ▼
       ┌────────────────────────┐                    ┌─────────────────────────────┐
       │  Supabase (cloud)      │                    │  SQLite (local)             │
       │  orders.status mis à   │                    │  orders.status mis à jour   │
       │  jour                  │                    └─────────────┬───────────────┘
       └───────────┬────────────┘                                  │
                   │                                               │
                   │  ⚠ REVERSE SYNC                               │
                   ▼                                               │
       ┌─────────────────────────────┐                             │
       │  Pull Sync Worker (8s)      │◀────────────────────────────┘
       │  supabase-pull-sync.service │  ⚠ ÉCRASE LE STATUT LOCAL
       │  ligne 194: UPDATE orders   │  si statut remote diffèrent
       │  SET status = remoteStatus  │
       └─────────────────────────────┘
                   ▲
                   │
       ┌─────────────────────────────┐
       │  Realtime Sync Worker       │
       │  supabase-realtime-sync.svc │
       │  ligne 236-239: champs[]    │
       │  = row[column] (incl.status)│
       └─────────────────────────────┘

  ═══════════════════════════════════════════════════
  AUTRE ENTRÉE (checkout)
  ═══════════════════════════════════════════════════

┌─────────────────────────────┐
│  routes/sales.ts            │
│  POST /sales                │
│  (checkout complet)         │
└─────────────┬───────────────┘
              │
              ├── ligne 311: supabase.from('orders').update({ status: 'paid' })
              │
              └── ligne 721: db.prepare("UPDATE orders SET status = 'paid'")
```

---

## E. IMPACT DES MODIFICATIONS RÉCENTES (FIX)

**Fichiers modifiés pour protéger le statut local :**

| Fichier | Changement |
|---------|-----------|
| `supabase-pull-sync.service.ts` | Si le statut local existe et n'est pas `'pending'`, on conserve le statut local au lieu d'écraser avec le remote |
| `supabase-realtime-sync.service.ts` | Idem : si le statut local est déjà `confirmed`/`preparing`/`ready`/`served`/`paid`, on ne le remplace pas |

**Comportement après fix :**
- Nouvelles commandes QR arrivent avec `status='pending'` du cloud → insérées normalement
- Une fois qu'un serveur change localement le statut (`pending` → `confirmed` / `preparing` / ...), les cycles de sync ne le réinitialisent plus
- Le checkout (routes/sales.ts) continue de passer `paid` correctement

---

## F. RÉSUMÉ DES CHEMINS

| # | Origine | Statut | Via | Sauvegarde |
|---|---------|--------|-----|-----------|
| 1 | OrdersPage.tsx (6 boutons utilisateur) | various | updateOrderStatus → api → route → OrderService | ✅ Fixé |
| 2 | POST /sales (checkout) | `paid` | Supabase direct / SQLite direct | ✅ Correct |
| 3 | Pull Sync Worker (intervalle 8s) | remote status | supabase-pull-sync.service.ts | ✅ Fixé (protégé) |
| 4 | Realtime Sync Worker (event) | remote status | supabase-realtime-sync.service.ts | ✅ Fixé (protégé) |
| 5 | Generic Sync Service (outbox) | status mappé | generic-sync.service.ts | ✅ Correct (c'est l'outbox qui pousse les changements locaux) |
| 6 | Product Sync Service | status table | product-sync.service.ts | ❌ Non concerné (table status ≠ order status) |
| 7 | Création commande (POST /orders) | `pending` | order.service.ts:545 | ✅ Correct |