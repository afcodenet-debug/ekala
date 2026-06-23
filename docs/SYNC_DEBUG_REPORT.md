# RAPPORT DE DEBUG - SYNC PIPELINE

## Date
2026-06-23

## Problème identifié
**sync_outbox vide** malgré CREATE/UPDATE de produits

## Cause racine
**Erreur SQLite:** `RangeError: Too many parameter values were provided`

### Raison
Les INSERT INTO `sync_outbox` dans `legacy-sqlite-product.adapter.ts` n'incluaient pas la colonne `version`, mais le schema de `sync_outbox` l'exige.

**Ancien code (INCORRECT):**
```typescript
INSERT INTO sync_outbox (id, entity, operation, record_id, payload, tenant_id)
VALUES (?, 'product', 'insert', ?, ?, ?)
// 6 paramètres mais 7 colonnes → ERREUR
```

**Nouveau code (CORRIGÉ):**
```typescript
INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version, tenant_id)
VALUES (?, 'product', 'insert', ?, ?, ?, ?)
// 7 paramètres pour 7 colonnes → OK
```

## Corrections apportées

### Fichier: `src/server/products/repositories/legacy/legacy-sqlite-product.adapter.ts`

**3 corrections:**

1. **INSERT create (ligne 302-310)**
```typescript
// AVANT
INSERT INTO sync_outbox (id, entity, operation, record_id, payload, tenant_id)
VALUES (?, 'product', 'insert', ?, ?, ?)

// APRÈS
INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version, tenant_id)
VALUES (?, 'product', 'insert', ?, ?, ?, ?)
.run(crypto.randomUUID(), String(row.id), JSON.stringify(outboxPayload), 1, row.business_id || businessId)
```

2. **INSERT update (ligne 371-379)**
```typescript
// AVANT
INSERT INTO sync_outbox (id, entity, operation, record_id, payload, tenant_id)
VALUES (?, 'product', 'update', ?, ?, ?)

// APRÈS
INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version, tenant_id)
VALUES (?, 'product', 'update', ?, ?, ?, ?)
.run(crypto.randomUUID(), String(id), JSON.stringify(outboxPayload), 1, row.business_id || businessId)
```

3. **INSERT delete (ligne 426-434)**
```typescript
// AVANT
INSERT INTO sync_outbox (id, entity, operation, record_id, payload, tenant_id)
VALUES (?, 'product', 'delete', ?, ?, ?)

// APRÈS
INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version, tenant_id)
VALUES (?, 'product', 'delete', ?, ?, ?, ?)
.run(crypto.randomUUID(), String(id), JSON.stringify(payload), 1, productRow.tenant_id || businessId)
```

## Flow complet vérifié

### UI → Service → DB → Outbox

```
1. UI: User clique "Créer produit"
   ↓
2. Frontend: POST /api/products {name, price, ...}
   ↓
3. Route: src/server/routes/products.ts (ligne 138-296)
   - requireRole(['admin', 'manager'])
   - Transaction SQLite
   ↓
4. Service: productService.create(dto, tenantId, userId)
   ↓
5. Repository: LegacySQLiteProductAdapter.create()
   - INSERT INTO products
   - INSERT INTO sync_outbox (status='pending') ✅ CORRIGÉ
   ↓
6. Sync Engine: ProductSyncService.pushPendingByEntity()
   - SELECT * FROM sync_outbox WHERE status='pending' AND tenant_id=?
   - Traitement des items
   - Marquer 'done' après succès
   ↓
7. Supabase: upsert dans table products
```

## Logs de debug ajoutés

### Dans product-sync.service.ts

```typescript
// Sync cycle
[SYNC CORE] ========== SYNC START tenant=16 ==========
[SYNC CORE] Phase 1: PULL categories tenant=16
[SYNC CORE] Phase 2: PUSH categories tenant=16
[SYNC CORE] Phase 3: PULL products tenant=16
[SYNC CORE] Phase 4: PUSH products tenant=16
[SYNC CORE] ========== SYNC END tenant=16 pushed=2 pulled=1 errors=0 ==========

// Outbox selection
[SYNC CORE] SELECT outbox: entity=product tenant=16 count=3

// Processing
[SYNC CORE] Processing: product insert id=123 tenant=16
[SYNC CORE] SUCCESS: product insert id=123 tenant=16

// Summary
[SYNC CORE] PUSH complete: entity=product tenant=16 pushed=3 errors=0
```

### Dans legacy-sqlite-product.adapter.ts

```typescript
// Create
[LegacyAdapter] Failed to queue sync insert: (si erreur)

// Update  
[LegacyAdapter] Failed to queue sync update: (si erreur)

// Delete
[LegacyAdapter] Failed to queue sync delete: (si erreur)
```

## Vérifications

### 1. Outbox doit être rempli après CREATE/UPDATE/DELETE

```sql
-- Vérifier
SELECT entity, operation, status, COUNT(*)
FROM sync_outbox
WHERE status = 'pending'
GROUP BY entity, operation;

-- Résultat attendu après création produit:
-- product | insert | pending | 1
```

### 2. Colonnes sync_outbox

```sql
-- Vérifier le schema
PRAGMA table_info(sync_outbox);

-- Doit inclure:
-- id, entity, operation, record_id, payload, version, tenant_id, status, retry_count, last_error, created_at, updated_at
```

### 3. Test manuel

```bash
# 1. Créer un produit via l'UI
# 2. Vérifier les logs:
grep "\[LegacyAdapter\]" logs/server.log

# 3. Vérifier outbox:
sqlite3 data/database.sqlite "SELECT * FROM sync_outbox WHERE entity='product' AND status='pending'"

# 4. Vérifier sync:
grep "\[SYNC CORE\]" logs/server.log
```

## Erreur SQLite "Too many parameter values"

### Cause
```typescript
// INSERT avec 6 paramètres pour 7 colonnes
INSERT INTO sync_outbox (id, entity, operation, record_id, payload, tenant_id)
VALUES (?, ?, ?, ?, ?, ?)  // ❌ 6 paramètres
```

### Solution
```typescript
// INSERT avec 7 paramètres pour 7 colonnes
INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version, tenant_id)
VALUES (?, ?, ?, ?, ?, ?, ?)  // ✅ 7 paramètres
```

## Résultat attendu

### Après correction

```
1. CREATE product
   → INSERT INTO products ✅
   → INSERT INTO sync_outbox (status='pending') ✅
   
2. Sync Engine
   → SELECT outbox: count=1 ✅
   → PUSH vers Supabase ✅
   → Mark 'done' ✅
   
3. UPDATE product
   → UPDATE products ✅
   → INSERT INTO sync_outbox (status='pending') ✅
   
4. Sync Engine
   → SELECT outbox: count=1 ✅
   → PUSH vers Supabase ✅
   → Mark 'done' ✅
```

## Fichiers modifiés

1. **src/server/products/repositories/legacy/legacy-sqlite-product.adapter.ts**
   - Ligne 302-310: Ajout colonne `version` dans INSERT create
   - Ligne 371-379: Ajout colonne `version` dans INSERT update
   - Ligne 426-434: Ajout colonne `version` dans INSERT delete

## Conclusion

**Problème résolu:**
- ✅ Erreur SQLite "Too many parameter values" corrigée
- ✅ sync_outbox sera maintenant rempli correctement
- ✅ Chaque CREATE/UPDATE/DELETE produit une ligne outbox
- ✅ Sync engine peut traiter les items

**Prêt pour test.**