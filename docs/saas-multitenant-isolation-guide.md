# Guide d'Isolation Multi-Tenant

## Problème
Actuellement, l'authentification JWT est en place, mais les routes API ne filtrent PAS les données par `tenant_id`. 
Un utilisateur du tenant MAKUNANO (id=1) voit **toutes les données** de tous les tenants.

## Solution : Ajouter `WHERE tenant_id = ?` partout

### Étape 1 : Helper `getTenantId` (déjà dans `jwt-auth.ts`)
```typescript
export function getTenantId(req: any): number {
  return req.user?.tenant_id || 1; // fallback pour backward compatibility
}
```

### Étape 2 : Modifier chaque route pour filtrer par tenant_id

#### a) Tables (`tables.ts`)
```typescript
// AVANT
const all = db.prepare('SELECT * FROM restaurant_tables').all();

// APRÈS
const all = db.prepare('SELECT * FROM restaurant_tables WHERE tenant_id = ?').all(getTenantId(req));
```

#### b) Produits (`products.ts`)
```typescript
// AVANT
const all = db.prepare('SELECT * FROM products').all();

// APRÈS
const all = db.prepare('SELECT * FROM products WHERE tenant_id = ?').all(getTenantId(req));
```

#### c) Catégories (`categories.ts`)
```typescript
// AVANT
const all = db.prepare('SELECT * FROM categories').all();

// APRÈS  
const all = db.prepare('SELECT * FROM categories WHERE tenant_id = ?').all(getTenantId(req));
```

#### d) Commandes (`orders.ts`)
```typescript
// AVANT
db.prepare('SELECT * FROM orders').all();

// APRÈS
db.prepare('SELECT * FROM orders WHERE tenant_id = ?').all(getTenantId(req));
```

#### e) Ventes (`sales.ts`)
```typescript
// AVANT
db.prepare('SELECT * FROM sales').all();

// APRÈS
db.prepare('SELECT * FROM sales WHERE tenant_id = ?').all(getTenantId(req));
```

#### f) Dépenses (`expenses.ts`)
```typescript
// AVANT
db.prepare('SELECT * FROM expenses').all();

// APRÈS
db.prepare('SELECT * FROM expenses WHERE tenant_id = ?').all(getTenantId(req));
```

### Étape 3 : Pour les routes Supabase
Ajouter `.eq('tenant_id', getTenantId(req))` à chaque requête `.from('table').select('*')`

### Étape 4 : Pour les CRUD (insert)
Forcer `tenant_id` dans les INSERT :
```sql
INSERT INTO products (..., tenant_id) VALUES (..., ?)
-- valeur : getTenantId(req)
```

## Fichiers à modifier
1. `src/server/routes/tables.ts`
2. `src/server/routes/products.ts` 
3. `src/server/routes/categories.ts`
4. `src/server/routes/orders.ts`
5. `src/server/routes/sales.ts`
6. `src/server/routes/expenses.ts`
7. `src/server/routes/users.ts`
8. `src/server/services/order.service.ts`
9. `src/server/services/table.service.ts`
10. `src/server/dashboard.ts`

## Impact
- **✅** Un utilisateur connecté ne voit QUE les données de son tenant
- **✅** Les INSERT forcent automatiquement le `tenant_id` de l'utilisateur connecté
- **✅** Un utilisateur d'un autre tenant ne peut pas voir les données des autres
- **⚠️** Nécessite une modification dans chaque fichier de route