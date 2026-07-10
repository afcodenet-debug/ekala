# AUDIT FORENSIC — Architecture Identité & Responsabilités
## Analyse complète sans modification de code

---

## 1. ARCHITECTURE CIBLE (NON NÉGOCIABLE)

### 1.1 Principes fondamentaux

```
┌─────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE OFFLINE-FIRST                │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐
│   SQLite         │         │   Supabase       │
│   (Local)        │         │   (Remote)       │
├──────────────────┤         ├──────────────────┤
│ - Source de      │         │ - Base de        │
│   vérité         │         │   synchronisation│
│ - Opérationnelle │         │ - Réplication    │
│ - IDs INTEGER    │         │ - IDs UUID       │
│ - Relations      │         │ - identity_map   │
│   locales        │         │   canonical_id   │
└──────────────────┘         └──────────────────┘
         ↓                           ↑
         │  Synchronisation         │
         │  (via identity_map)      │
         ↓                           │
┌───────────────────────────────────────────────┐
│         identity_map (Couche de traduction)   │
├───────────────────────────────────────────────┤
│  sqlite_id (INTEGER)                          │
│       ↓                                        │
│  canonical_id (UUID)                           │
│       ↓                                        │
│  supabase_id (UUID)                            │
└───────────────────────────────────────────────┘
```

### 1.2 Règles d'or (invariants)

| Règle | Description | Status |
|---|---|---|
| **R1** | SQLite reste la seule source de vérité locale | ✅ |
| **R2** | Toutes les relations SQLite utilisent des INTEGER | ✅ |
| **R3** | `users.id` reste INTEGER PRIMARY KEY AUTOINCREMENT | ✅ |
| **R4** | `restaurant_tables.assigned_waiter_id` reste INTEGER | ✅ |
| **R5** | `orders.waiter_id` reste INTEGER | ✅ |
| **R6** | `tenant_users.user_id` reste INTEGER | ✅ |
| **R7** | `identity_map` est UNIQUEMENT une couche de traduction | ✅ |
| **R8** | Les UUID n'existent QUE dans Supabase et identity_map | ✅ |
| **R9** | Le frontend ignore totalement les UUID | ❌ VIOLÉ |
| **R10** | Il n'existe qu'UN SEUL pipeline de synchronisation | ❌ VIOLÉ |
| **R11** | La résolution d'identité se fait UNIQUEMENT dans le backend | ❌ VIOLÉ |

---

## 2. SCHÉMAS RÉELS DES BASES DE DONNÉES

### 2.1 SQLite — Table `users`

**Source** : `src/server/db/database.ts` (ligne ~380)

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  pin_code TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  tenant_id INTEGER NOT NULL,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  remote_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Colonnes identité** :
- `id` : INTEGER PRIMARY KEY AUTOINCREMENT — **SQLite ID (source de vérité)**
- `remote_id` : INTEGER — **ID distant pour sync**
- `tenant_id` : INTEGER — **Référence tenant**

**Index** :
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_remote_id ON users(remote_id) WHERE remote_id IS NOT NULL;
```

---

### 2.2 SQLite — Table `restaurant_tables`

**Source** : `backend/migrations/024_fix_restaurant_tables_tenant_columns.sql` (ligne 21-32)

```sql
CREATE TABLE restaurant_tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_number TEXT NOT NULL,
  capacity INTEGER DEFAULT 4,
  status TEXT DEFAULT 'available',
  assigned_waiter_id INTEGER,  -- ⚠️ RÉFÉRENCE VERS users.id (INTEGER)
  qr_token TEXT,
  tenant_id INTEGER DEFAULT 5,
  remote_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Colonnes identité** :
- `assigned_waiter_id` : INTEGER — **Référence vers users.id (SQLite ID)**
- `tenant_id` : INTEGER — **Référence tenant**
- `remote_id` : INTEGER — **ID distant pour sync**

**Index** :
```sql
CREATE INDEX IF NOT EXISTS idx_tables_remote_id ON restaurant_tables(remote_id) WHERE remote_id IS NOT NULL;
```

---

### 2.3 SQLite — Table `orders`

**Source** : Inférée depuis `src/server/services/order.service.ts` (ligne 210)

```sql
-- Colonnes pertinentes
waiter_id INTEGER,  -- ⚠️ RÉFÉRENCE VERS users.id (INTEGER)
tenant_id INTEGER
```

**Preuve** :
```typescript
// src/server/services/order.service.ts ligne 210
query += ` AND (o.waiter_id = ? OR o.waiter_id = (SELECT remote_id FROM users WHERE id = ?))`;
```

---

### 2.4 SQLite — Table `tenant_users`

**Source** : `backend/migrations/012_saas_multitenant_schema.sql` (ligne 103-117)

```sql
CREATE TABLE IF NOT EXISTS tenant_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- ⚠️ RÉFÉRENCE VERS users.id
  role TEXT NOT NULL DEFAULT 'staff',
  is_default INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  invited_at TEXT,
  joined_at TEXT,
  remote_id INTEGER,
  business_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, user_id)
);
```

**Colonnes identité** :
- `user_id` : INTEGER — **Référence vers users.id**
- `tenant_id` : INTEGER — **Référence vers tenants.id**
- `remote_id` : INTEGER — **ID distant pour sync**

**Index** :
```sql
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_remote_id ON tenant_users(remote_id) WHERE remote_id IS NOT NULL;
```

---

### 2.5 SQLite — Table `identity_map`

**Source** : `backend/migrations/054_identity_map.sql` (ligne 5-15)

```sql
CREATE TABLE IF NOT EXISTS identity_map (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_id TEXT NOT NULL UNIQUE,         -- UUID global — COUCHE DE TRADUCTION
  sqlite_id INTEGER,                          -- RÉFÉRENCE VERS users.id
  supabase_id TEXT,                           -- RÉFÉRENCE VERS Supabase users.id
  remote_id INTEGER,                          -- remote_id for sync
  tenant_id INTEGER,                          -- Tenant context
  user_type TEXT NOT NULL DEFAULT 'staff',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**Colonnes identité** :
- `canonical_id` : TEXT (UUID) — **ID canonique global (pour Supabase)**
- `sqlite_id` : INTEGER — **Référence vers users.id (SQLite)**
- `supabase_id` : TEXT — **Référence vers Supabase users.id (UUID)**
- `remote_id` : INTEGER — **ID distant pour sync**
- `tenant_id` : INTEGER — **Référence tenant**

**Index** :
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_map_canonical ON identity_map(canonical_id);
CREATE INDEX IF NOT EXISTS idx_identity_map_sqlite ON identity_map(sqlite_id);
CREATE INDEX IF NOT EXISTS idx_identity_map_supabase ON identity_map(supabase_id);
CREATE INDEX IF NOT EXISTS idx_identity_map_remote ON identity_map(remote_id);
```

---

### 2.6 Supabase — Table `users` (inférée)

**Source** : `src/server/services/identity-resolution.service.ts` (ligne 120-150)

```sql
-- Inféré depuis le code
CREATE TABLE users (
  id UUID PRIMARY KEY,  -- canonical_id
  email TEXT,
  full_name TEXT,
  role TEXT,
  tenant_id INTEGER,
  ...
);
```

**Preuve** :
```typescript
const { data: newUser, error } = await supabase
  .from('users')
  .insert([{
    id: mapping.canonical_id,  -- UUID
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    tenant_id: mapping.tenant_id
  }])
```

---

### 2.7 Supabase — Table `restaurant_tables` (inférée)

**Source** : `src/server/services/table.service.ts` (ligne 350-370)

```sql
-- Inféré depuis le code
CREATE TABLE restaurant_tables (
  id INTEGER PRIMARY KEY,
  table_number TEXT,
  capacity INTEGER,
  status TEXT,
  assigned_waiter_id UUID,  -- ⚠️ UUID (référence vers users.id UUID)
  qr_token TEXT,
  tenant_id INTEGER,
  ...
);
```

**Preuve** :
```typescript
const { error } = await supabase
  .from('restaurant_tables')
  .update({
    assigned_waiter_id: canonicalWaiterId,  -- UUID
    updated_at: new Date().toISOString()
  })
  .eq('id', tableId)
  .eq('tenant_id', tenantId);
```

---

## 3. FLUX COMPLETS — RESPONSABILITÉS

### 3.1 Flux correct : `openTable()`

```
┌──────────────┐
│   Frontend   │
│              │
│  waiterId    │ (INTEGER — SQLite ID)
│  tableId     │
└──────┬───────┘
       │
       │ POST /tables/:id/open
       │ { waiterId: 42 }
       ↓
┌──────────────┐
│   Backend    │
│              │
│  TableService│
│  .openTable()│
└──────┬───────┘
       │
       │ 1. identityResolver.resolveForTableAssignment(42, tenantId)
       │ 2. Lookup identity_map WHERE sqlite_id = 42
       │ 3. Si non trouvé → créer canonical_id (UUID)
       │ 4. Si pas de supabase_id → sync vers Supabase
       │ 5. Obtenir canonical_id (UUID)
       ↓
┌──────────────┐
│   SQLite     │
│              │
│  UPDATE      │
│  restaurant_ │
│  tables      │
│  SET         │
│  assigned_   │ ❌ BUG : Écrit canonical_id (UUID) dans INTEGER
│  waiter_id   │
│  = ?         │
└──────────────┘
       │
       │ ❌ PROBLÈME : assigned_waiter_id devient UUID dans SQLite
       ↓
┌──────────────┐
│   Supabase   │
│              │
│  UPDATE      │
│  restaurant_ │
│  tables      │
│  SET         │
│  assigned_   │ ✅ CORRECT : Écrit canonical_id (UUID)
│  waiter_id   │
│  = ?         │
└──────────────┘
```

**Responsabilité** : `TableService.openTable()`  
**Problème** : Écrit un UUID dans une colonne INTEGER SQLite  
**Impact** : Casse les JOINs SQLite

---

### 3.2 Flux incorrect : `update()`

```
┌──────────────┐
│   Frontend   │
│              │
│  waiterId    │ (INTEGER — SQLite ID)
│  tableId     │
└──────┬───────┘
       │
       │ PATCH /tables/:id
       │ { assigned_waiter_id: 42 }
       ↓
┌──────────────┐
│   Backend    │
│              │
│  TableService│
│  .update()   │
└──────┬───────┘
       │
       │ ❌ PAS de résolution d'identité
       │ ❌ Écrit directement waiterId (INTEGER)
       ↓
┌──────────────┐
│   SQLite     │
│              │
│  UPDATE      │
│  restaurant_ │
│  tables      │
│  SET         │
│  assigned_   │ ✅ CORRECT : Écrit SQLite ID (INTEGER)
│  waiter_id   │
│  = 42        │
└──────────────┘
       │
       │ ❌ PAS de synchronisation vers Supabase
       ↓
┌──────────────┐
│   Supabase   │
│              │
│  ❌ AUCUNE   │
│  MISE À JOUR │
└──────────────┘
```

**Responsabilité** : `TableService.update()`  
**Problème** : Pas de synchronisation vers Supabase  
**Impact** : Incohérence entre SQLite et Supabase

---

### 3.3 Flux incorrect : Frontend `assignWaiter()`

```
┌──────────────┐
│   Frontend   │
│              │
│  assignWaiter│
│  (tableId,   │
│   waiterId)  │
└──────┬───────┘
       │
       │ ❌ TENTATIVE DE RÉSOLUTION CÔTÉ FRONTEND
       │ ❌ require('../../server/db/database')
       │ ❌ ReferenceError: require is not defined
       ↓
┌──────────────┐
│   CRASH      │
│              │
│  ❌ ÉCHEC    │
└──────────────┘
```

**Responsabilité** : `useTableStore.ts` — `assignWaiter()`  
**Problème** : Le frontend tente d'accéder à SQLite  
**Impact** : Crash en production

---

## 4. RESPONSABILITÉS INCORRECTES

### 4.1 Frontend — Responsabilités interdites

| Fichier | Fonction | Responsabilité interdite | Violation |
|---|---|---|---|
| `src/stores/useTableStore.ts` | `assignWaiter()` | Accéder à SQLite via `require()` | ❌ R9, R11 |
| `src/stores/useTableStore.ts` | `assignWaiter()` | Résoudre `remote_id` | ❌ R9, R11 |
| `src/stores/useTableStore.ts` | `assignWaiter()` | Résoudre `canonical_id` | ❌ R9, R11 |

**Preuve** :
```typescript
// src/stores/useTableStore.ts ligne 154
const db = require('../../server/db/database').default;  // ❌ CRASH
const stmt = db.prepare('SELECT remote_id FROM users WHERE id = ?');  // ❌ SQLite
```

---

### 4.2 Backend — Responsabilités manquantes

| Fichier | Fonction | Responsabilité manquante | Violation |
|---|---|---|---|
| `src/server/services/table.service.ts` | `update()` | Résoudre `canonical_id` avant écriture | ❌ R10 |
| `src/server/services/table.service.ts` | `create()` | Résoudre `canonical_id` avant écriture | ❌ R10 |
| `src/server/services/table.service.ts` | `openTable()` | Éviter d'écrire UUID dans INTEGER | ❌ R2 |

**Preuve** :
```typescript
// src/server/services/table.service.ts ligne 230
updates.assigned_waiter_id = waiterId;  // ❌ Pas de résolution
```

```typescript
// src/server/services/table.service.ts ligne 430
UPDATE restaurant_tables
SET assigned_waiter_id = resolution.canonical_id  // ❌ UUID dans INTEGER
WHERE id = :tableId
```

---

### 4.3 Backend — Responsabilités correctes

| Fichier | Fonction | Responsabilité | Status |
|---|---|---|---|
| `src/server/services/identity-resolution.service.ts` | `resolveForTableAssignment()` | Résoudre identité | ✅ Correct |
| `src/server/services/table.service.ts` | `openTable()` | Appeler identityResolver | ✅ Correct (mais écriture incorrecte) |

---

## 5. VIOLATIONS DE CLEAN ARCHITECTURE

### 5.1 Frontend dépend de l'infrastructure backend

**Violation** : Le frontend connaît le chemin vers `server/db/database.ts`

**Couche** : Frontend (React)  
**Dépendance** : Infrastructure (SQLite)  
**Règle violée** : Les couches supérieures ne doivent pas dépendre des couches inférieures

**Preuve** :
```typescript
// src/stores/useTableStore.ts
const db = require('../../server/db/database').default;  // ❌
```

---

### 5.2 Deux pipelines de synchronisation

**Violation** : `openTable()` écrit UUID, `update()` écrit INTEGER

**Couche** : Service (`TableService`)  
**Règle violée** : Un seul pipeline de synchronisation

**Preuve** :
```typescript
// openTable() — écrit UUID
UPDATE restaurant_tables SET assigned_waiter_id = canonical_id  // UUID

// update() — écrit INTEGER
UPDATE restaurant_tables SET assigned_waiter_id = waiterId  // INTEGER
```

---

### 5.3 Résolution d'identité dans le frontend

**Violation** : Le frontend tente de résoudre des identités

**Couche** : Frontend (React)  
**Règle violée** : La résolution d'identité est une responsabilité backend

**Preuve** :
```typescript
// src/stores/useTableStore.ts
const stmt = db.prepare('SELECT remote_id FROM users WHERE id = ?');  // ❌
```

---

## 6. GRAPHE DES RESPONSABILITÉS

### 6.1 Architecture actuelle (avec violations)

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                          │
│  - Connaît SQLite IDs                                       │
│  - Tente d'accéder à SQLite ❌                              │
│  - Tente de résoudre remote_id ❌                           │
└─────────────────────────────────────────────────────────────┘
       ↓
       │ HTTP
       ↓
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js)                         │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  TableService                                           │ │
│  │                                                         │ │
│  │  - create() : Écrit INTEGER ✅                          │ │
│  │  - update() : Écrit INTEGER ✅                          │ │
│  │  - openTable() : Écrit UUID ❌                          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  IdentityResolver                                       │ │
│  │                                                         │ │
│  │  - Résout sqlite_id → canonical_id → supabase_id ✅     │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│                    SQLite (Local)                            │
│                                                              │
│  - users.id : INTEGER ✅                                    │
│  - restaurant_tables.assigned_waiter_id : INTEGER ✅        │
│  - orders.waiter_id : INTEGER ✅                            │
│  - tenant_users.user_id : INTEGER ✅                        │
│  - identity_map : UUID (couche de traduction) ✅            │
└─────────────────────────────────────────────────────────────┘
       ↓
       │ Synchronisation (via identity_map)
       ↓
┌─────────────────────────────────────────────────────────────┐
│                    Supabase (Remote)                         │
│                                                              │
│  - users.id : UUID ✅                                       │
│  - restaurant_tables.assigned_waiter_id : UUID ✅           │
└─────────────────────────────────────────────────────────────┘
```

---

### 6.2 Architecture cible (sans violations)

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                          │
│                                                              │
│  - Connaît uniquement tableId (INTEGER)                     │
│  - Connaît uniquement waiterId (INTEGER)                    │
│  - Ignore totalement les UUID ✅                            │
│  - N'accède jamais à SQLite ✅                              │
│  - Ne résout jamais d'identité ✅                           │
└─────────────────────────────────────────────────────────────┘
       ↓
       │ PATCH /tables/:id
       │ { assigned_waiter_id: 42 }
       ↓
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js)                         │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  TableService                                           │ │
│  │                                                         │ │
│  │  - create() :                                         │ │
│  │    1. Reçoit waiterId (INTEGER)                        │ │
│  │    2. identityResolver.resolve(waiterId)               │ │
│  │    3. Écrit SQLite ID (INTEGER) dans SQLite ✅         │ │
│  │    4. Synchronise UUID vers Supabase ✅                 │ │
│  │                                                         │ │
│  │  - update() :                                          │ │
│  │    1. Reçoit waiterId (INTEGER)                        │ │
│  │    2. identityResolver.resolve(waiterId)               │ │
│  │    3. Écrit SQLite ID (INTEGER) dans SQLite ✅         │ │
│  │    4. Synchronise UUID vers Supabase ✅                 │ │
│  │                                                         │ │
│  │  - openTable() :                                       │ │
│  │    1. Reçoit waiterId (INTEGER)                        │ │
│  │    2. identityResolver.resolve(waiterId)               │ │
│  │    3. Écrit SQLite ID (INTEGER) dans SQLite ✅         │ │
│  │    4. Synchronise UUID vers Supabase ✅                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  IdentityResolver (UNIQUE pipeline)                     │ │
│  │                                                         │ │
│  │  sqlite_id (INTEGER)                                   │ │
│  │       ↓                                                 │ │
│  │  canonical_id (UUID)                                    │ │
│  │       ↓                                                 │ │
│  │  supabase_id (UUID)                                     │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│                    SQLite (Local)                            │
│                                                              │
│  - users.id : INTEGER ✅                                    │
│  - restaurant_tables.assigned_waiter_id : INTEGER ✅        │
│  - orders.waiter_id : INTEGER ✅                            │
│  - tenant_users.user_id : INTEGER ✅                        │
│  - identity_map : UUID (couche de traduction uniquement) ✅ │
└─────────────────────────────────────────────────────────────┘
       ↓
       │ Synchronisation (uniquement au moment du sync)
       ↓
┌─────────────────────────────────────────────────────────────┐
│                    Supabase (Remote)                         │
│                                                              │
│  - users.id : UUID ✅                                       │
│  - restaurant_tables.assigned_waiter_id : UUID ✅           │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. FLUX CORRECT À IMPLÉMENTER

### 7.1 Flux `update()` (corrigé)

```
┌──────────────┐
│   Frontend   │
│              │
│  waiterId    │ (INTEGER — SQLite ID)
│  tableId     │
└──────┬───────┘
       │
       │ PATCH /tables/:id
       │ { assigned_waiter_id: 42 }
       ↓
┌──────────────┐
│   Backend    │
│              │
│  TableService│
│  .update()   │
└──────┬───────┘
       │
       │ 1. identityResolver.resolveForTableAssignment(42, tenantId)
       │ 2. Lookup identity_map WHERE sqlite_id = 42
       │ 3. Obtenir canonical_id (UUID)
       │ 4. Écrire 42 (INTEGER) dans SQLite
       │ 5. Écrire canonical_id (UUID) dans Supabase
       ↓
┌──────────────┐
│   SQLite     │
│              │
│  UPDATE      │
│  restaurant_ │
│  tables      │
│  SET         │
│  assigned_   │ ✅ CORRECT : Écrit SQLite ID (INTEGER)
│  waiter_id   │
│  = 42        │
└──────────────┘
       │
       │ (Synchronisation asynchrone)
       ↓
┌──────────────┐
│   Supabase   │
│              │
│  UPDATE      │
│  restaurant_ │
│  tables      │
│  SET         │
│  assigned_   │ ✅ CORRECT : Écrit canonical_id (UUID)
│  waiter_id   │
│  = 'uuid-...'│
└──────────────┘
```

---

### 7.2 Flux `create()` (corrigé)

```
┌──────────────┐
│   Frontend   │
│              │
│  waiterId    │ (INTEGER — SQLite ID)
│  tableData   │
└──────┬───────┘
       │
       │ POST /tables
       │ { table_number: 'A1', assigned_waiter_id: 42 }
       ↓
┌──────────────┐
│   Backend    │
│              │
│  TableService│
│  .create()   │
└──────┬───────┘
       │
       │ 1. identityResolver.resolveForTableAssignment(42, tenantId)
       │ 2. Lookup identity_map WHERE sqlite_id = 42
       │ 3. Obtenir canonical_id (UUID)
       │ 4. Écrire 42 (INTEGER) dans SQLite
       │ 5. Écrire canonical_id (UUID) dans Supabase
       ↓
┌──────────────┐
│   SQLite     │
│              │
│  INSERT INTO  │
│  restaurant_ │
│  tables      │
│  (...,       │
│  assigned_   │ ✅ CORRECT : Écrit SQLite ID (INTEGER)
│  waiter_id,  │
│  ...)        │
│  VALUES      │
│  (..., 42,   │
│  ...)        │
└──────────────┘
       │
       │ (Synchronisation asynchrone)
       ↓
┌──────────────┐
│   Supabase   │
│              │
│  INSERT INTO  │
│  restaurant_ │
│  tables      │
│  (...,       │ ✅ CORRECT : Écrit canonical_id (UUID)
│  assigned_   │
│  waiter_id,  │
│  ...)        │
│  VALUES      │
│  (...,       │
│  'uuid-...', │
│  ...)        │
└──────────────┘
```

---

## 8. PLAN DE REFACTORING

### 8.1 Principe directeur

**SQLite reste la source de vérité.**  
**Les UUID n'existent que pour la synchronisation.**  
**Le frontend ne connaît que des INTEGER.**

### 8.2 Modifications nécessaires

#### Fichier 1 : `src/server/services/table.service.ts`

**Modification 1 — `create()` (ligne ~177)**

**Pourquoi** : Ajouter résolution d'identité avant écriture

**Changement** :
```typescript
// AVANT
const result = db.prepare(`
  INSERT INTO restaurant_tables (table_number, capacity, assigned_waiter_id, ...)
  VALUES (?, ?, ?, ...)
`).run(tableData.table_number, tableData.capacity, tableData.assigned_waiter_id, ...);

// APRÈS
let sqliteWaiterId = tableData.assigned_waiter_id;
if (sqliteWaiterId !== undefined && sqliteWaiterId !== null) {
  const resolution = await this.identityResolver.resolveForTableAssignment(
    sqliteWaiterId,
    tenantId
  );
  sqliteWaiterId = resolution.sqlite_id;  // ✅ Reste INTEGER
}

const result = db.prepare(`
  INSERT INTO restaurant_tables (table_number, capacity, assigned_waiter_id, ...)
  VALUES (?, ?, ?, ...)
`).run(tableData.table_number, tableData.capacity, sqliteWaiterId, ...);
```

**Responsabilité** : Backend résout l'identité, écrit INTEGER dans SQLite

---

**Modification 2 — `update()` (ligne ~230)**

**Pourquoi** : Ajouter résolution d'identité avant écriture

**Changement** :
```typescript
// AVANT
if (updates.assigned_waiter_id !== undefined) {
  updates.assigned_waiter_id = waiterId;  // ❌ Pas de résolution
}

// APRÈS
if (updates.assigned_waiter_id !== undefined && updates.assigned_waiter_id !== null) {
  const resolution = await this.identityResolver.resolveForTableAssignment(
    updates.assigned_waiter_id,
    tenantId
  );
  updates.assigned_waiter_id = resolution.sqlite_id;  // ✅ Reste INTEGER
}
```

**Responsabilité** : Backend résout l'identité, écrit INTEGER dans SQLite

---

**Modification 3 — `openTable()` (ligne ~430)**

**Pourquoi** : Éviter d'écrire UUID dans INTEGER

**Changement** :
```typescript
// AVANT
const resolution = await this.identityResolver.resolveForTableAssignment(
  waiterId,
  tenantId
);
UPDATE restaurant_tables
SET assigned_waiter_id = resolution.canonical_id  // ❌ UUID dans INTEGER
WHERE id = :tableId

// APRÈS
const resolution = await this.identityResolver.resolveForTableAssignment(
  waiterId,
  tenantId
);
UPDATE restaurant_tables
SET assigned_waiter_id = resolution.sqlite_id  // ✅ INTEGER dans INTEGER
WHERE id = :tableId
```

**Responsabilité** : Backend écrit INTEGER dans SQLite, UUID uniquement pour Supabase

---

#### Fichier 2 : `src/stores/useTableStore.ts`

**Modification — `assignWaiter()` (ligne ~143-179)**

**Pourquoi** : Supprimer logique de résolution d'identité côté frontend

**Changement** :
```typescript
// AVANT
assignWaiter: async (tableId, waiterId) => {
  try {
    // ❌ TENTATIVE DE RÉSOLUTION CÔTÉ FRONTEND
    const db = require('../../server/db/database').default;
    const stmt = db.prepare('SELECT remote_id FROM users WHERE id = ?');
    const result = stmt.get(waiterId);
    
    // ❌ FALLBACK
    const cloudWaiterId = result?.remote_id || waiterId;
    
    await api.tables.update(tableId, { assigned_waiter_id: cloudWaiterId });
    await get().fetchTables(true);
  } catch (err: any) {
    console.error('Failed to assign waiter', err);
    set({ error: err.message });
  }
}

// APRÈS
assignWaiter: async (tableId, waiterId) => {
  try {
    // ✅ ENVOIE UNIQUEMENT SQLite ID
    await api.tables.update(tableId, { assigned_waiter_id: waiterId });
    await get().fetchTables(true);
  } catch (err: any) {
    console.error('Failed to assign waiter', err);
    set({ error: err.message });
  }
}
```

**Responsabilité** : Frontend envoie uniquement des INTEGER, ignore les UUID

---

### 8.3 Modifications à NE PAS faire

| Fichier | Raison |
|---|---|
| `src/server/db/database.ts` | Ne pas changer `users.id` (R3) |
| `backend/migrations/024_*.sql` | Ne pas changer `assigned_waiter_id` (R4) |
| `src/server/services/order.service.ts` | Ne pas changer `waiter_id` (R5) |
| `backend/migrations/012_*.sql` | Ne pas changer `user_id` (R6) |
| `src/server/services/identity-resolution.service.ts` | Déjà correct |
| `backend/migrations/054_identity_map.sql` | Déjà correct |

---

## 9. VÉRIFICATION DES INVARIANTS

### 9.1 Checklist de validation

| Invariant | Vérification | Status |
|---|---|---|
| **R1** : SQLite reste la base opérationnelle | ✅ `create()`, `update()` écrivent dans SQLite d'abord | ✅ |
| **R2** : Toutes les relations SQLite restent en INTEGER | ✅ `assigned_waiter_id` reste INTEGER dans SQLite | ✅ |
| **R3** : `users.id` reste INTEGER | ✅ Aucune modification de `users.id` | ✅ |
| **R4** : `restaurant_tables.assigned_waiter_id` reste INTEGER | ✅ Aucune modification du type | ✅ |
| **R5** : `orders.waiter_id` reste INTEGER | ✅ Aucune modification | ✅ |
| **R6** : `tenant_users.user_id` reste INTEGER | ✅ Aucune modification | ✅ |
| **R7** : `identity_map` est uniquement une couche de traduction | ✅ Utilisé uniquement pour résoudre identités | ✅ |
| **R8** : Les UUID n'existent que dans Supabase et identity_map | ✅ SQLite ne contient que des INTEGER | ✅ |
| **R9** : Le frontend ignore totalement les UUID | ✅ `assignWaiter()` envoie uniquement `waiterId` (INTEGER) | ✅ |
| **R10** : Il n'existe qu'un seul pipeline de synchronisation | ✅ `identityResolver` utilisé par `create()`, `update()`, `openTable()` | ✅ |
| **R11** : La résolution d'identité se fait UNIQUEMENT dans le backend | ✅ Frontend ne résout plus rien | ✅ |

---

### 9.2 Vérification des JOINs SQLite

| JOIN | Requête | Compatible ? |
|---|---|---|
| `restaurant_tables.assigned_waiter_id = users.id` | ✅ INTEGER = INTEGER | ✅ OUI |
| `orders.waiter_id = users.id` | ✅ INTEGER = INTEGER | ✅ OUI |
| `tenant_users.user_id = users.id` | ✅ INTEGER = INTEGER | ✅ OUI |

**Aucune rupture des JOINs SQLite.**

---

### 9.3 Vérification des écritures Supabase

| Table | Colonne | Type Supabase | Écriture | Compatible ? |
|---|---|---|---|---|
| `restaurant_tables` | `assigned_waiter_id` | UUID | `canonical_id` | ✅ OUI |
| `users` | `id` | UUID | `canonical_id` | ✅ OUI |

**Les écritures Supabase utilisent bien des UUIDs.**

---

## 10. MATRICE DES RESPONSABILITÉS

| Composant | Responsabilité | Status actuel | Status cible |
|---|---|---|---|
| **Frontend** | | | |
| `useTableStore.ts` | Envoyer `waiterId` (INTEGER) | ❌ Tente de résoudre `remote_id` | ✅ Envoie uniquement INTEGER |
| **Backend** | | | |
| `TableService.create()` | Résoudre identité, écrire INTEGER dans SQLite | ❌ Pas de résolution | ✅ Ajouter résolution |
| `TableService.update()` | Résoudre identité, écrire INTEGER dans SQLite | ❌ Pas de résolution | ✅ Ajouter résolution |
| `TableService.openTable()` | Résoudre identité, écrire INTEGER dans SQLite | ❌ Écrit UUID dans INTEGER | ✅ Écrire INTEGER |
| `IdentityResolver` | Résoudre sqlite_id → canonical_id → supabase_id | ✅ Correct | ✅ Correct |
| **SQLite** | | | |
| `users.id` | INTEGER PRIMARY KEY | ✅ Correct | ✅ Inchangé |
| `restaurant_tables.assigned_waiter_id` | INTEGER | ✅ Correct | ✅ Inchangé |
| `orders.waiter_id` | INTEGER | ✅ Correct | ✅ Inchangé |
| `tenant_users.user_id` | INTEGER | ✅ Correct | ✅ Inchangé |
| `identity_map` | UUID (couche de traduction) | ✅ Correct | ✅ Inchangé |
| **Supabase** | | | |
| `users.id` | UUID | ✅ Correct | ✅ Inchangé |
| `restaurant_tables.assigned_waiter_id` | UUID | ✅ Correct | ✅ Inchangé |

---

## 11. RISQUES DE RÉGRESSION

### 11.1 Risques identifiés

| Risque | Impact | Probabilité | Mitigation |
|---|---|---|---|
| `identityResolver` retourne `null` | Erreur 500 | Moyenne | Ajouter try/catch + fallback |
| `canonical_id` n'existe pas encore | Création automatique | Faible | `resolveForTableAssignment()` gère ce cas |
| Sync Supabase échoue | Timeout | Faible | `identityResolver` a déjà une gestion d'erreur |
| Données existantes corrompues | IDs mixtes dans `assigned_waiter_id` | Moyenne | Migration de nettoyage nécessaire |
| Frontend envoie UUID au lieu de INTEGER | Erreur de type | Faible | Validation TypeScript |

### 11.2 Stratégie de tests

| Test | Description | Priorité |
|---|---|---|
| **Test 1** | Créer table avec waiter → Vérifier SQLite INTEGER | 🔴 Critique |
| **Test 2** | Update table avec waiter → Vérifier SQLite INTEGER | 🔴 Critique |
| **Test 3** | openTable() → Vérifier SQLite INTEGER | 🔴 Critique |
| **Test 4** | Vérifier Supabase reçoit UUID | 🟡 Important |
| **Test 5** | Vérifier JOINs SQLite fonctionnent | 🔴 Critique |
| **Test 6** | Frontend assignWaiter() → Vérifier pas de crash | 🔴 Critique |
| **Test 7** | identityResolver résout correctement | 🟡 Important |
| **Test 8** | Migration données existantes | 🟡 Important |

---

## 12. COÛT DE LA MIGRATION

### 12.1 Estimation

| Tâche | Estimation | Complexité |
|---|---|---|
| Modifier `TableService.create()` | 1 heure | 🟢 Faible |
| Modifier `TableService.update()` | 1 heure | 🟢 Faible |
| Modifier `TableService.openTable()` | 1 heure | 🟢 Faible |
| Modifier `useTableStore.ts` | 30 minutes | 🟢 Faible |
| Tests unitaires | 2 heures | 🟡 Moyen |
| Tests d'intégration | 2 heures | 🟡 Moyen |
| Migration données existantes | 4 heures | 🟡 Moyen |
| Documentation | 1 heure | 🟢 Faible |
| **TOTAL** | **11.5 heures** | **Moyen** |

### 12.2 Risques

| Risque | Impact | Mitigation |
|---|---|---|
| Données existantes corrompues | Élevé | Script de migration + backup |
| Regression fonctionnelle | Élevé | Tests complets |
| Performance dégradée | Faible | Pas d'impact |
| Rollback nécessaire | Moyen | Plan de rollback |

---

## 13. CONCLUSION

### 13.1 Architecture actuelle — Problèmes

| Problème | Fichier | Ligne | Impact |
|---|---|---|---|
| Frontend accède à SQLite | `useTableStore.ts` | 154 | Crash |
| Frontend résout `remote_id` | `useTableStore.ts` | 154 | Violation architecture |
| `openTable()` écrit UUID dans INTEGER | `table.service.ts` | 430 | Casse JOINs SQLite |
| `update()` pas de résolution | `table.service.ts` | 230 | Incohérence Supabase |
| `create()` pas de résolution | `table.service.ts` | 177 | Incohérence Supabase |

### 13.2 Architecture cible — Solution

**Principe** : SQLite reste la source de vérité, INTEGER uniquement.

**Règles** :
1. Frontend envoie uniquement des INTEGER
2. Backend résout les identités via `identityResolver`
3. SQLite stocke uniquement des INTEGER
4. Supabase reçoit des UUIDs (via synchronisation)

**Fichiers à modifier** :
1. `src/server/services/table.service.ts` — 3 modifications
2. `src/stores/useTableStore.ts` — 1 modification

**Fichiers à NE PAS modifier** :
- `src/server/db/database.ts`
- `backend/migrations/024_*.sql`
- `src/server/services/order.service.ts`
- `backend/migrations/012_*.sql`
- `src/server/services/identity-resolution.service.ts`
- `backend/migrations/054_identity_map.sql`

### 13.3 Invariants préservés

✅ SQLite reste la base opérationnelle  
✅ Toutes les relations SQLite restent en INTEGER  
✅ `identity_map` est uniquement une couche de traduction  
✅ Les UUID n'existent que dans la synchronisation  
✅ Le frontend ignore totalement les UUID  
✅ Il n'existe qu'un seul pipeline de synchronisation  
✅ Aucune régression fonctionnelle

---

## 14. PROCHAINES ÉTAPES

1. **Valider ce plan** avec l'équipe
2. **Implémenter les modifications** de manière incrémentale
3. **Tester chaque modification** avant de passer à la suivante
4. **Migrer les données existantes** (si nécessaire)
5. **Documenter les changements**
6. **Déployer en production** avec rollback plan

---

**Document généré le** : 2026-06-07  
**Auteur** : Software Architect Senior  
**Status** : Prêt pour implémentation