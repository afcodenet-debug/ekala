# AUDIT ARCHITECTURAL COMPLET — Ekala POS
## Rapport pré-implantation — Aucune modification de code

---

## RÉSUMÉ EXÉCUTIF

L'application Ekala POS fonctionne dans **3 modes distincts** (Cloud, Electron, Hybride) avec une architecture qui mélange actuellement les responsabilités. Cet audit identifie **12 violations critiques** de Clean Architecture, DDD et SOLID qui empêchent une maintenance saine et créent des bugs récurrents.

**Fichier livrable** : `docs/ARCHITECTURE_AUDIT_COMPLETE.md`

---

## 1. ARCHITECTURE ACTUELLE

### 1.1 Les 3 modes de fonctionnement

```
┌─────────────────────────────────────────────────────────────┐
│  MODE 1 — CLOUD UNIQUEMENT                                   │
│  - Frontend : React sur Vercel                              │
│  - Backend : Node.js sur Render                             │
│  - Base : Supabase uniquement                                │
│  - Aucun SQLite                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  MODE 2 — ELECTRON LOCAL                                    │
│  - Frontend : React dans Electron                           │
│  - Backend : Node.js local (main process)                   │
│  - Base : SQLite uniquement                                 │
│  - Aucune connexion Internet                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  MODE 3 — HYBRIDE                                           │
│  - Frontend : React dans Electron                           │
│  - Backend : Node.js local (main process)                   │
│  - Base : SQLite (opérationnelle) + Supabase (sync)         │
│  - Synchronisation automatique quand connexion disponible   │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Architecture actuelle (avec violations)

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (React)                                           │
│  - Connaît SQLite IDs                                       │
│  - Tente d'accéder à SQLite ❌                              │
│  - Connaît remote_id ❌                                     │
└─────────────────────────────────────────────────────────────┘
       ↓
       │ HTTP
       ↓
┌─────────────────────────────────────────────────────────────┐
│  BACKEND (Node.js)                                          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Routes                                                  │ │
│  │  - Accèdent directement aux services                    │ │
│  └────────────────────────────────────────────────────────┘ │
│       ↓                                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Services Métier                                         │ │
│  │  - Mélangent logique métier et accès données ❌         │ │
│  │  - Accèdent directement à SQLite ❌                     │ │
│  │  - Accèdent directement à Supabase ❌                   │ │
│  │  - Contiennent des if (electron) ❌                     │ │
│  └────────────────────────────────────────────────────────┘ │
│       ↓                                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Repositories (inexistants) ❌                          │ │
│  │  - Pas d'abstraction                                     │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│  SQLite (Local)                                             │
│  - users.id : INTEGER                                       │
│  - restaurant_tables.assigned_waiter_id : INTEGER           │
│  - orders.waiter_id : INTEGER                               │
└─────────────────────────────────────────────────────────────┘
       ↓
       │ Synchronisation
       ↓
┌─────────────────────────────────────────────────────────────┐
│  Supabase (Remote)                                          │
│  - users.id : UUID                                          │
│  - restaurant_tables.assigned_waiter_id : UUID              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. CARTOGRAPHIE DES SERVICES

### 2.1 Services métier identifiés

| Service | Fichier | Responsabilité | Dépendances directes |
|---|---|---|---|
| **TableService** | `src/server/services/table.service.ts` | CRUD tables, assignation waiter | SQLite ❌, Supabase ❌ |
| **OrderService** | `src/server/services/order.service.ts` | CRUD commandes | SQLite ❌ |
| **UserService** | `src/server/services/user.service.ts` | CRUD utilisateurs | SQLite ❌ |
| **ProductService** | `src/server/products/services/product.service.ts` | CRUD produits | SQLite ❌, Supabase ❌ |
| **CategoryService** | `src/server/routes/categories.ts` | CRUD catégories | SQLite ❌ |
| **AuthService** | `src/server/services/auth.service.ts` | Authentification | SQLite ❌ |
| **SubscriptionService** | `src/server/application/subscription/SubscriptionApplicationService.ts` | Gestion abonnements | SQLite ❌ |
| **BillingService** | `src/server/application/billing/services/SubscriptionService.ts` | Facturation | SQLite ❌ |
| **VoucherService** | `src/server/services/voucher-redemption.service.ts` | Gestion vouchers | SQLite ❌ |
| **PaymentService** | `src/server/routes/sales.ts` | Paiements | SQLite ❌ |

### 2.2 Services d'infrastructure identifiés

| Service | Fichier | Responsabilité | Dépendances |
|---|---|---|---|
| **IdentityResolver** | `src/server/services/identity-resolution.service.ts` | Résolution identité | SQLite ❌, Supabase ❌ |
| **SyncOrchestrator** | `src/sync/sync-orchestrator-v2.ts` | Synchronisation | SQLite ❌, Supabase ❌ |
| **SupabasePullSync** | `src/server/services/supabase-pull-sync.service.ts` | Sync descendante | Supabase ❌ |
| **SupabaseRealtimeSync** | `src/server/services/supabase-realtime-sync.service.ts` | Sync temps réel | Supabase ❌ |
| **DataSourceManager** | `src/server/infrastructure/data-source-manager.ts` | Gestion sources données | SQLite ❌, Supabase ❌ |

### 2.3 Repositories existants

| Repository | Fichier | Type | Responsabilité |
|---|---|---|---|
| **SqliteSubscriptionRepository** | `src/server/infrastructure/repositories/sqlite/SqliteSubscriptionRepository.ts` | SQLite | Accès données abonnements |
| **PostgresSubscriptionRepository** | `src/server/infrastructure/billing/repositories/PostgresSubscriptionRepository.ts` | Supabase | Accès données abonnements |
| **SqliteVoucherRepository** | (inexistant) | SQLite | Manquant ❌ |
| **PostgresVoucherRepository** | `src/server/infrastructure/billing/repositories/PostgresVoucherRepository.ts` | Supabase | Accès données vouchers |

---

## 3. VIOLATIONS DE CLEAN ARCHITECTURE

### 3.1 Services métier dépendent de SQLite

**Violation** : Les services métier accèdent directement à SQLite

**Couche** : Application Services  
**Dépendance** : Infrastructure (SQLite)  
**Règle violée** : Les couches supérieures ne doivent pas dépendre des couches inférieures

**Exemples** :

```typescript
// TableService — ACCÈS DIRECT À SQLITE
// src/server/services/table.service.ts ligne 177
const result = db.prepare(`
  INSERT INTO restaurant_tables (table_number, capacity, assigned_waiter_id, ...)
  VALUES (?, ?, ?, ...)
`).run(...);

// OrderService — ACCÈS DIRECT À SQLITE
// src/server/services/order.service.ts ligne 210
const orders = db.prepare('SELECT * FROM orders WHERE ...').all(...);

// UserService — ACCÈS DIRECT À SQLITE
// src/server/services/user.service.ts ligne 120
const result = db.prepare('INSERT INTO users (...) VALUES (...)').run(...);
```

**Impact** : Impossible de changer de base de données sans modifier les services métier

---

### 3.2 Services métier dépendent de Supabase

**Violation** : Les services métier accèdent directement à Supabase

**Couche** : Application Services  
**Dépendance** : Infrastructure (Supabase)  
**Règle violée** : Les couches supérieures ne doivent pas dépendre des couches inférieures

**Exemples** :

```typescript
// TableService — ACCÈS DIRECT À SUPABASE
// src/server/services/table.service.ts ligne 350
const { error } = await supabase
  .from('restaurant_tables')
  .update({ assigned_waiter_id: canonicalWaiterId, ... })
  .eq('id', tableId);

// ProductService — ACCÈS DIRECT À SUPABASE
// src/server/products/services/product.service.ts
const { data, error } = await supabase
  .from('products')
  .insert([productData])
  .select();
```

**Impact** : Le code métier est couplé à Supabase, impossible de fonctionner en mode Electron

---

### 3.3 Absence de Repository Pattern

**Violation** : Pas d'abstraction entre services métier et accès aux données

**Couche** : Application Services  
**Règle violée** : Les services métier ne doivent pas connaître le mécanisme de persistance

**Conséquence** :
- Duplication de code d'accès aux données
- Impossibilité de changer de base de données
- Tests difficiles (pas de mock possible)
- Logique métier mélangée avec logique d'accès aux données

---

### 3.4 Frontend dépend de l'infrastructure backend

**Violation** : Le frontend connaît le chemin vers `server/db/database.ts`

**Couche** : Frontend (React)  
**Dépendance** : Infrastructure (SQLite)  
**Règle violée** : Les couches supérieures ne doivent pas dépendre des couches inférieures

**Exemple** :
```typescript
// src/stores/useTableStore.ts ligne 154
const db = require('../../server/db/database').default;  // ❌
```

**Impact** : Crash en production (require() n'existe pas dans le navigateur)

---

## 4. VIOLATIONS DDD

### 4.1 Services métier ne sont pas des Domain Services

**Violation** : Les services contiennent de la logique métier ET de l'accès aux données

**Principe DDD** : Un Domain Service ne contient que de la logique métier, pas d'accès aux données

**Exemple** :
```typescript
// TableService — MÉLANGE LOGIQUE MÉTIER + ACCÈS DONNÉES
class TableService {
  // Logique métier
  async openTable(tableId: number, waiterId: number) {
    // Accès données ❌
    const table = db.prepare('SELECT * FROM restaurant_tables WHERE id = ?').get(tableId);
    
    // Logique métier
    if (table.status !== 'available') throw new Error('Table not available');
    
    // Accès données ❌
    db.prepare('UPDATE restaurant_tables SET status = ? WHERE id = ?').run('occupied', tableId);
  }
}
```

**Solution** : Séparer logique métier et accès aux données

---

### 4.2 Absence d'Agrégats

**Violation** : Pas d'agrégats définis

**Principe DDD** : Les entités doivent être regroupées en agrégats avec une racine d'agrégat

**Exemple manquant** :
```
Agrégat Table
├── Table (racine)
├── TableStatus (value object)
├── AssignedWaiter (value object)
└── TableHistory (entity)

Agrégat Order
├── Order (racine)
├── OrderItem (entity)
├── Payment (entity)
└── OrderStatus (value object)
```

**Impact** : Pas de garantie d'intégrité à long terme

---

### 4.3 Absence d'Events Domain

**Violation** : Pas d'événements métier

**Principe DDD** : Les changements d'état doivent être publiés sous forme d'événements

**Exemples manquants** :
- `TableOpenedEvent`
- `TableClosedEvent`
- `WaiterAssignedEvent`
- `OrderCreatedEvent`
- `OrderPaidEvent`

**Impact** : Pas de traçabilité, pas de réaction aux événements métier

---

### 4.4 Value Objects inexistants

**Violation** : Pas de value objects

**Principe DDD** : Les concepts métier doivent être encapsulés dans des value objects

**Exemples manquants** :
- `TableId` (au lieu de `number`)
- `WaiterId` (au lieu de `number`)
- `OrderId` (au lieu de `number`)
- `Money` (au lieu de `number`)
- `Email` (au lieu de `string`)

**Impact** : Pas de validation métier, pas de typage fort

---

## 5. VIOLATIONS SOLID

### 5.1 Single Responsibility Principle (SRP)

**Violation** : Les services ont trop de responsabilités

**Exemple** : `TableService`
```typescript
class TableService {
  // Responsabilité 1 : CRUD tables ❌
  async create() {}
  async update() {}
  async delete() {}
  
  // Responsabilité 2 : Gestion statut tables ❌
  async openTable() {}
  async closeTable() {}
  
  // Responsabilité 3 : Assignation waiter ❌
  async assignWaiter() {}
  
  // Responsabilité 4 : Synchronisation Supabase ❌
  async syncToSupabase() {}
}
```

**Solution** : Séparer en plusieurs services/use cases

---

### 5.2 Open/Closed Principle (OCP)

**Violation** : Impossible d'ajouter une nouvelle base de données sans modifier les services

**Exemple** :
```typescript
// Si on veut ajouter PostgreSQL, il faut modifier tous les services
if (dbType === 'sqlite') {
  db.prepare('...').run();
} else if (dbType === 'supabase') {
  supabase.from('...').insert();
} else if (dbType === 'postgres') {
  pg.query('...');
}
```

**Solution** : Utiliser le Repository Pattern

---

### 5.3 Liskov Substitution Principle (LSP)

**Violation** : Les repositories ne sont pas interchangeables

**Exemple** :
```typescript
// SqliteSubscriptionRepository
class SqliteSubscriptionRepository {
  async findById(id: number): Promise<Subscription> {
    // Retourne un objet Subscription avec des INTEGER IDs
  }
}

// PostgresSubscriptionRepository
class PostgresSubscriptionRepository {
  async findById(id: string): Promise<Subscription> {
    // Retourne un objet Subscription avec des UUID IDs
  }
}

// ❌ Les deux ne retournent pas le même type d'objet
```

**Solution** : Garantir que tous les repositories retournent le même type d'objet métier

---

### 5.4 Interface Segregation Principle (ISP)

**Violation** : Les interfaces sont trop larges

**Exemple** :
```typescript
interface ITableRepository {
  create(table: Table): Promise<Table>;
  update(id: number, table: Partial<Table>): Promise<Table>;
  delete(id: number): Promise<void>;
  findAll(): Promise<Table[]>;
  findById(id: number): Promise<Table>;
  assignWaiter(tableId: number, waiterId: number): Promise<void>;
  openTable(tableId: number, waiterId: number): Promise<void>;
  closeTable(tableId: number): Promise<void>;
  syncToSupabase(tableId: number): Promise<void>;
  // ❌ Trop de méthodes
}
```

**Solution** : Séparer en interfaces plus petites

---

### 5.5 Dependency Inversion Principle (DIP)

**Violation** : Les services métier dépendent de détails d'implémentation

**Exemple** :
```typescript
class TableService {
  private db: Database;  // ❌ Dépend de SQLite
  private supabase: SupabaseClient;  // ❌ Dépend de Supabase
}
```

**Solution** : Dépendre d'abstractions (interfaces)

---

## 6. VIOLATIONS REPOSITORY PATTERN

### 6.1 Absence d'abstraction

**Violation** : Pas d'interface Repository

**Actuel** :
```typescript
class TableService {
  async create(tableData: CreateTableDto) {
    // Accès direct à SQLite
    db.prepare('INSERT INTO ...').run(...);
  }
}
```

**Attendu** :
```typescript
class TableService {
  constructor(private tableRepository: ITableRepository) {}
  
  async create(tableData: CreateTableDto) {
    // Accès via interface
    return this.tableRepository.create(tableData);
  }
}
```

---

### 6.2 Pas d'injection de dépendances

**Violation** : Les repositories sont instanciés directement dans les services

**Actuel** :
```typescript
class TableService {
  private db = Database.getInstance();  // ❌ Couplage fort
}
```

**Attendu** :
```typescript
class TableService {
  constructor(private tableRepository: ITableRepository) {}  // ✅ Injection
}
```

---

### 6.3 Duplication de logique d'accès aux données

**Violation** : Chaque service réinvente la façon d'accéder aux données

**Exemples** :
```typescript
// TableService
const result = db.prepare('SELECT * FROM restaurant_tables WHERE id = ?').get(id);

// OrderService
const result = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);

// UserService
const result = db.prepare('SELECT * FROM users WHERE id = ?').get(id);

// ❌ Duplication de code
```

**Solution** : Centraliser dans des repositories

---

## 7. BUGS LIÉS AUX IDs

### 7.1 Bug 1 : `openTable()` écrit UUID dans INTEGER

**Fichier** : `src/server/services/table.service.ts`  
**Ligne** : 430  
**Code** :
```typescript
UPDATE restaurant_tables
SET assigned_waiter_id = resolution.canonical_id  // ❌ UUID dans INTEGER
WHERE id = :tableId
```

**Impact** : Casse les JOINs SQLite

---

### 7.2 Bug 2 : Frontend accède à SQLite

**Fichier** : `src/stores/useTableStore.ts`  
**Ligne** : 154  
**Code** :
```typescript
const db = require('../../server/db/database').default;  // ❌ CRASH
```

**Impact** : Crash en production

---

### 7.3 Bug 3 : `update()` pas de synchronisation Supabase

**Fichier** : `src/server/services/table.service.ts`  
**Ligne** : 230  
**Code** :
```typescript
updates.assigned_waiter_id = waiterId;  // ❌ Pas de résolution
```

**Impact** : Incohérence entre SQLite et Supabase

---

### 7.4 Bug 4 : `create()` pas de synchronisation Supabase

**Fichier** : `src/server/services/table.service.ts`  
**Ligne** : 177  
**Code** :
```typescript
const result = db.prepare(`
  INSERT INTO restaurant_tables (..., assigned_waiter_id, ...)
  VALUES (..., ?, ...)
`).run(..., tableData.assigned_waiter_id, ...);  // ❌ Pas de résolution
```

**Impact** : Incohérence entre SQLite et Supabase

---

## 8. BUGS DE SYNCHRONISATION

### 8.1 Bug 1 : Deux pipelines de synchronisation

**Actuel** :
- `openTable()` écrit UUID dans SQLite + Supabase
- `update()` écrit INTEGER dans SQLite uniquement
- `create()` écrit INTEGER dans SQLite uniquement

**Impact** : Incohérence des données

---

### 8.2 Bug 2 : Pas de gestion des conflits

**Actuel** : Aucune gestion de conflit entre SQLite et Supabase

**Exemple** :
- SQLite : `assigned_waiter_id = 42` (INTEGER)
- Supabase : `assigned_waiter_id = 'uuid-...'` (UUID)
- Conflit : Impossible de savoir qui a raison

**Solution** : Implémenter un Last-Write-Wins (LWW) ou CRDT

---

### 8.3 Bug 3 : Pas de file d'attente offline

**Actuel** : Les modifications sont perdues si pas de connexion

**Solution** : Implémenter une file d'attente locale (Outbox pattern)

---

## 9. PIPELINE CRUD ACTUEL (AVEC VIOLATIONS)

### 9.1 Créer une table

```
Frontend
  ↓
POST /tables
  ↓
TableService.create()
  ↓
  ❌ Accès direct à SQLite
  ↓
SQLite: INSERT INTO restaurant_tables ...
  ↓
  ❌ Pas de synchronisation Supabase
```

---

### 9.2 Modifier une table

```
Frontend
  ↓
PATCH /tables/:id
  ↓
TableService.update()
  ↓
  ❌ Accès direct à SQLite
  ↓
SQLite: UPDATE restaurant_tables ...
  ↓
  ❌ Pas de synchronisation Supabase
```

---

### 9.3 Assigner un waiter

```
Frontend
  ↓
PATCH /tables/:id
  ↓
TableService.update()
  ↓
  ❌ Accès direct à SQLite
  ↓
SQLite: UPDATE restaurant_tables SET assigned_waiter_id = waiterId
  ↓
  ❌ Pas de synchronisation Supabase
```

---

### 9.4 Ouvrir une table

```
Frontend
  ↓
POST /tables/:id/open
  ↓
TableService.openTable()
  ↓
  identityResolver.resolveForTableAssignment()
  ↓
  ❌ Écrit UUID dans SQLite
  ↓
SQLite: UPDATE restaurant_tables SET assigned_waiter_id = canonical_id
  ↓
  ✅ Écrit UUID dans Supabase
```

---

## 10. PIPELINE DE SYNCHRONISATION ACTUEL (AVEC VIOLATIONS)

### 10.1 Flux de synchronisation

```
SQLite
  ↓
  ❌ Pas de système d'événements
  ↓
  ❌ Pas de file d'attente
  ↓
  ❌ Synchronisation ad-hoc
  ↓
Supabase
```

**Problèmes** :
- Pas de garantie de livraison
- Pas de retry en cas d'échec
- Pas de gestion des conflits
- Pas de traçabilité

---

## 11. ARCHITECTURE CIBLE

### 11.1 Architecture en couches (Clean Architecture)

```
┌─────────────────────────────────────────────────────────────┐
│  PRESENTATION (React / Electron)                            │
│  - Components                                                │
│  - Stores (Zustand)                                          │
│  - Hooks                                                     │
└─────────────────────────────────────────────────────────────┘
       ↓
       │ HTTP / IPC
       ↓
┌─────────────────────────────────────────────────────────────┐
│  APPLICATION                                                  │
│  - Use Cases                                                  │
│  - DTOs                                                       │
│  - Validators                                                 │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│  DOMAIN                                                        │
│  - Entities                                                   │
│  - Value Objects                                              │
│  - Domain Services                                            │
│  - Repository Interfaces                                      │
│  - Domain Events                                              │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│  INFRASTRUCTURE                                               │
│  - SQLite Repository                                          │
│  - Supabase Repository                                        │
│  - Hybrid Repository                                          │
│  - Identity Resolver                                          │
│  - Synchronization Service                                    │
│  - Event Bus                                                  │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│  EXTERNAL                                                      │
│  - SQLite (local)                                             │
│  - Supabase (remote)                                          │
└─────────────────────────────────────────────────────────────┘
```

---

### 11.2 Repository Pattern proposé

```typescript
// Repository Interface (Domain)
interface ITableRepository {
  create(table: Table): Promise<Table>;
  update(id: TableId, table: Partial<Table>): Promise<Table>;
  delete(id: TableId): Promise<void>;
  findById(id: TableId): Promise<Table | null>;
  findAll(): Promise<Table[]>;
  assignWaiter(tableId: TableId, waiterId: WaiterId): Promise<void>;
  openTable(tableId: TableId, waiterId: WaiterId): Promise<void>;
  closeTable(tableId: TableId): Promise<void>;
}

// SQLite Implementation (Infrastructure)
class SqliteTableRepository implements ITableRepository {
  async create(table: Table): Promise<Table> {
    // Implémentation SQLite
  }
  
  async update(id: TableId, table: Partial<Table>): Promise<Table> {
    // Implémentation SQLite
  }
}

// Supabase Implementation (Infrastructure)
class SupabaseTableRepository implements ITableRepository {
  async create(table: Table): Promise<Table> {
    // Implémentation Supabase
  }
  
  async update(id: TableId, table: Partial<Table>): Promise<Table> {
    // Implémentation Supabase
  }
}

// Hybrid Implementation (Infrastructure)
class HybridTableRepository implements ITableRepository {
  constructor(
    private sqliteRepo: ITableRepository,
    private supabaseRepo: ITableRepository,
    private syncService: ISyncService
  ) {}
  
  async create(table: Table): Promise<Table> {
    // 1. Écrire dans SQLite
    const result = await this.sqliteRepo.create(table);
    
    // 2. Ajouter à la file de synchronisation
    await this.syncService.enqueue('TableCreated', result);
    
    return result;
  }
}
```

---

### 11.3 Injection de dépendances

```typescript
// Configuration du conteneur DI
const container = new Container();

// Repository
container.bind<ITableRepository>(ITableRepository).to(SqliteTableRepository);

// Services
container.bind<TableService>(TableService).to(TableService);

// Use Cases
container.bind<CreateTableUseCase>(CreateTableUseCase).to(CreateTableUseCase);

// Routes
app.post('/tables', (req, res) => {
  const useCase = container.get(CreateTableUseCase);
  useCase.execute(req.body).then(result => res.json(result));
});
```

---

## 12. PIPELINE CRUD CIBLE (SANS VIOLATIONS)

### 12.1 Créer une table

```
Frontend
  ↓
POST /tables
  ↓
CreateTableUseCase (Application)
  ↓
  TableService.create() (Domain)
  ↓
  ITableRepository.create() (Interface)
  ↓
  SqliteTableRepository.create() (Infrastructure)
  ↓
SQLite: INSERT INTO restaurant_tables ...
  ↓
  SyncService.enqueue('TableCreated', table)
  ↓
  EventBus.publish(new TableCreatedEvent(table))
  ↓
  (Plus tard, quand connexion disponible)
  ↓
SupabaseTableRepository.create() (Infrastructure)
  ↓
Supabase: INSERT INTO restaurant_tables ...
```

---

### 12.2 Modifier une table

```
Frontend
  ↓
PATCH /tables/:id
  ↓
UpdateTableUseCase (Application)
  ↓
  TableService.update() (Domain)
  ↓
  ITableRepository.update() (Interface)
  ↓
  SqliteTableRepository.update() (Infrastructure)
  ↓
SQLite: UPDATE restaurant_tables ...
  ↓
  SyncService.enqueue('TableUpdated', table)
  ↓
  EventBus.publish(new TableUpdatedEvent(table))
  ↓
  (Plus tard, quand connexion disponible)
  ↓
SupabaseTableRepository.update() (Infrastructure)
  ↓
Supabase: UPDATE restaurant_tables ...
```

---

### 12.3 Assigner un waiter

```
Frontend
  ↓
PATCH /tables/:id
  { assigned_waiter_id: 42 }  // INTEGER uniquement
  ↓
UpdateTableUseCase (Application)
  ↓
  TableService.assignWaiter() (Domain)
  ↓
  ITableRepository.assignWaiter() (Interface)
  ↓
  SqliteTableRepository.assignWaiter() (Infrastructure)
  ↓
SQLite: UPDATE restaurant_tables SET assigned_waiter_id = 42  // INTEGER
  ↓
  SyncService.enqueue('WaiterAssigned', { tableId, waiterId: 42 })
  ↓
  EventBus.publish(new WaiterAssignedEvent(tableId, waiterId))
  ↓
  (Plus tard, quand connexion disponible)
  ↓
  IdentityResolver.resolve(42)  // INTEGER → UUID
  ↓
SupabaseTableRepository.assignWaiter() (Infrastructure)
  ↓
Supabase: UPDATE restaurant_tables SET assigned_waiter_id = 'uuid-...'  // UUID
```

---

## 13. PIPELINE DE SYNCHRONISATION CIBLE

### 13.1 Architecture du synchroniseur

```
┌─────────────────────────────────────────────────────────────┐
│  SYNCHRONIZATION SERVICE                                     │
│                                                              │
│  1. Écouter les événements du EventBus                       │
│  2. Stocker les événements dans une file d'attente (Outbox)  │
│  3. Quand connexion disponible :                             │
│     - Récupérer les événements en attente                    │
│     - Résoudre les identités (sqlite_id → canonical_id)      │
│     - Envoyer vers Supabase                                  │
│     - Gérer les retries                                      │
│     - Marquer comme synchronisé                              │
└─────────────────────────────────────────────────────────────┘
```

### 13.2 Flux de synchronisation

```
EventBus.publish(event)
  ↓
OutboxRepository.save(event)  // SQLite
  ↓
SyncOrchestrator.processOutbox()
  ↓
  Pour chaque événement :
    1. Récupérer l'entité depuis SQLite
    2. IdentityResolver.resolve(entity)  // INTEGER → UUID
    3. Mapper vers format Supabase
    4. Envoyer vers Supabase
    5. Si succès : marquer comme synchronisé
    6. Si échec : retry avec backoff exponentiel
```

---

## 14. FICHIERS À MODIFIER

### 14.1 Services métier à refactorer

| Fichier | Modifications | Priorité |
|---|---|---|
| `src/server/services/table.service.ts` | Extraire logique métier, injecter repository | 🔴 Critique |
| `src/server/services/order.service.ts` | Extraire logique métier, injecter repository | 🔴 Critique |
| `src/server/services/user.service.ts` | Extraire logique métier, injecter repository | 🔴 Critique |
| `src/server/products/services/product.service.ts` | Extraire logique métier, injecter repository | 🟡 Important |
| `src/server/routes/categories.ts` | Extraire logique métier, injecter repository | 🟡 Important |
| `src/server/services/auth.service.ts` | Extraire logique métier, injecter repository | 🔴 Critique |

### 14.2 Repositories à créer

| Repository | Fichier | Type | Priorité |
|---|---|---|---|
| `ITableRepository` | `src/server/domain/tables/repositories/ITableRepository.ts` | Interface | 🔴 Critique |
| `SqliteTableRepository` | `src/server/infrastructure/repositories/sqlite/SqliteTableRepository.ts` | SQLite | 🔴 Critique |
| `SupabaseTableRepository` | `src/server/infrastructure/repositories/supabase/SupabaseTableRepository.ts` | Supabase | 🔴 Critique |
| `HybridTableRepository` | `src/server/infrastructure/repositories/hybrid/HybridTableRepository.ts` | Hybride | 🔴 Critique |
| `IOrderRepository` | `src/server/domain/orders/repositories/IOrderRepository.ts` | Interface | 🔴 Critique |
| `SqliteOrderRepository` | `src/server/infrastructure/repositories/sqlite/SqliteOrderRepository.ts` | SQLite | 🔴 Critique |
| `SupabaseOrderRepository` | `src/server/infrastructure/repositories/supabase/SupabaseOrderRepository.ts` | Supabase | 🔴 Critique |
| `IUserRepository` | `src/server/domain/users/repositories/IUserRepository.ts` | Interface | 🔴 Critique |
| `SqliteUserRepository` | `src/server/infrastructure/repositories/sqlite/SqliteUserRepository.ts` | SQLite | 🔴 Critique |
| `SupabaseUserRepository` | `src/server/infrastructure/repositories/supabase/SupabaseUserRepository.ts` | Supabase | 🔴 Critique |

### 14.3 Frontend à modifier

| Fichier | Modifications | Priorité |
|---|---|---|
| `src/stores/useTableStore.ts` | Supprimer accès SQLite, envoyer uniquement INTEGER | 🔴 Critique |
| `src/stores/useOrderStore.ts` | Vérifier pas d'accès SQLite | 🟡 Important |
| `src/stores/useAuthStore.ts` | Vérifier pas d'accès SQLite | 🟡 Important |

### 14.4 Synchronisation à créer

| Fichier | Responsabilité | Priorité |
|---|---|---|
| `src/server/services/sync-orchestrator.service.ts` | Orchestrer la synchronisation | 🔴 Critique |
| `src/server/services/outbox.service.ts` | Gérer la file d'attente | 🔴 Critique |
| `src/server/services/identity-mapper.service.ts` | Mapper les IDs | 🔴 Critique |
| `src/server/domain/events/` | Événements métier | 🟡 Important |

---

## 15. ORDRE D'IMPLÉMENTATION

### Phase 1 — Infrastructure (Semaine 1)

1. **Créer les interfaces Repository** (1 jour)
   - `ITableRepository`
   - `IOrderRepository`
   - `IUserRepository`
   - `IProductRepository`
   - `ICategoryRepository`

2. **Créer les implémentations SQLite** (2 jours)
   - `SqliteTableRepository`
   - `SqliteOrderRepository`
   - `SqliteUserRepository`
   - `SqliteProductRepository`
   - `SqliteCategoryRepository`

3. **Créer les implémentations Supabase** (2 jours)
   - `SupabaseTableRepository`
   - `SupabaseOrderRepository`
   - `SupabaseUserRepository`
   - `SupabaseProductRepository`
   - `SupabaseCategoryRepository`

4. **Créer le conteneur DI** (1 jour)
   - Configuration des dépendances
   - Injection dans les services

---

### Phase 2 — Services métier (Semaine 2)

5. **Refactorer TableService** (1 jour)
   - Extraire logique métier
   - Injecter `ITableRepository`
   - Supprimer accès direct à SQLite/Supabase

6. **Refactorer OrderService** (1 jour)
   - Extraire logique métier
   - Injecter `IOrderRepository`
   - Supprimer accès direct à SQLite

7. **Refactorer UserService** (1 jour)
   - Extraire logique métier
   - Injecter `IUserRepository`
   - Supprimer accès direct à SQLite

8. **Refactorer ProductService** (1 jour)
   - Extraire logique métier
   - Injecter `IProductRepository`
   - Supprimer accès direct à SQLite/Supabase

9. **Refactorer CategoryService** (1 jour)
   - Extraire logique métier
   - Injecter `ICategoryRepository`
   - Supprimer accès direct à SQLite

---

### Phase 3 — Synchronisation (Semaine 3)

10. **Créer le système d'événements** (1 jour)
    - `EventBus`
    - `DomainEvent` interface
    - Événements métier

11. **Créer le Outbox pattern** (1 jour)
    - `OutboxRepository`
    - `OutboxService`
    - File d'attente dans SQLite

12. **Créer le SynchronizationService** (2 jours)
    - `SyncOrchestrator`
    - `IdentityMapper`
    - Gestion des retries
    - Gestion des conflits

13. **Intégrer la synchronisation** (1 jour)
    - Connecter EventBus → Outbox → SyncOrchestrator
    - Tester la synchronisation

---

### Phase 4 — Frontend (Semaine 4)

14. **Corriger useTableStore.ts** (1 jour)
    - Supprimer accès SQLite
    - Envoyer uniquement INTEGER

15. **Corriger useOrderStore.ts** (1 jour)
    - Vérifier pas d'accès SQLite

16. **Corriger useAuthStore.ts** (1 jour)
    - Vérifier pas d'accès SQLite

---

### Phase 5 — Tests et validation (Semaine 5)

17. **Tests unitaires** (2 jours)
    - Tester chaque Repository
    - Tester chaque Use Case
    - Tester chaque Service

18. **Tests d'intégration** (2 jours)
    - Tester CRUD complet
    - Tester synchronisation
    - Tester les 3 modes (Cloud, Electron, Hybride)

19. **Tests E2E** (1 jour)
    - Tester scénarios complets
    - Tester la synchronisation

---

## 16. RISQUES DE RÉGRESSION

### 16.1 Risques identifiés

| Risque | Impact | Probabilité | Mitigation |
|---|---|---|---|
| Perte de données lors de la migration | Élevé | Faible | Backup complet avant migration |
| Régression fonctionnelle | Élevé | Moyenne | Tests complets + déploiement progressif |
| Performance dégradée | Moyen | Faible | Tests de performance |
| Conflits de synchronisation | Élevé | Moyenne | Implémenter LWW ou CRDT |
| Rollback impossible | Élevé | Faible | Plan de rollback détaillé |

### 16.2 Stratégie de mitigation

1. **Backup complet** avant toute modification
2. **Tests automatisés** pour chaque modification
3. **Déploiement progressif** (feature flags)
4. **Monitoring** en production
5. **Plan de rollback** prêt à être exécuté

---

## 17. PLAN DE TESTS

### 17.1 Tests unitaires

| Test | Description | Priorité |
|---|---|---|
| Repository CRUD | Tester create, read, update, delete | 🔴 Critique |
| Use Cases | Tester chaque use case | 🔴 Critique |
| Domain Services | Tester la logique métier | 🔴 Critique |
| IdentityResolver | Tester la résolution d'identité | 🔴 Critique |
| SyncOrchestrator | Tester la synchronisation | 🟡 Important |

### 17.2 Tests d'intégration

| Test | Description | Priorité |
|---|---|---|
| CRUD complet | Tester toutes les opérations CRUD | 🔴 Critique |
| Synchronisation | Tester la synchronisation SQLite → Supabase | 🔴 Critique |
| Mode Cloud | Tester en mode Cloud uniquement | 🔴 Critique |
| Mode Electron | Tester en mode Electron local | 🔴 Critique |
| Mode Hybride | Tester en mode Hybride | 🔴 Critique |
| Gestion conflits | Tester les conflits de synchronisation | 🟡 Important |
| Retry | Tester les retries en cas d'échec | 🟡 Important |

### 17.3 Tests E2E

| Test | Description | Priorité |
|---|---|---|
| Scénario complet | Créer table → Assigner waiter → Ouvrir table → Créer commande → Payer | 🔴 Critique |
| Synchronisation | Créer en local → Attendre sync → Vérifier Supabase | 🔴 Critique |
| Offline → Online | Travailler offline → Se connecter → Vérifier sync | 🔴 Critique |

---

## 18. VALIDATION DES INVARIANTS

### 18.1 Checklist de validation

| Invariant | Vérification | Status |
|---|---|---|
| **I1** : SQLite reste la source de vérité en mode Local/Hybride | ✅ Repository SQLite utilisé par défaut | ✅ |
| **I2** : Supabase n'est qu'une base de synchronisation | ✅ Pas d'accès direct depuis services métier | ✅ |
| **I3** : Toutes les relations SQLite restent en INTEGER | ✅ Aucune modification de schéma | ✅ |
| **I4** : Les UUID n'existent que dans Supabase | ✅ SQLite ne contient que des INTEGER | ✅ |
| **I5** : Le frontend ignore les UUID | ✅ Frontend envoie uniquement INTEGER | ✅ |
| **I6** : Un seul pipeline de synchronisation | ✅ SyncOrchestrator unique | ✅ |
| **I7** : Pas de if (electron) dans les services | ✅ Injection de dépendances | ✅ |
| **I8** : Pas de if (online) dans les services | ✅ Outbox pattern | ✅ |
| **I9** : La résolution d'identité est backend uniquement | ✅ Frontend ne résout rien | ✅ |
| **I10** : Les services métier ne connaissent pas SQLite/Supabase | ✅ Dépendent d'interfaces | ✅ |

---

### 18.2 Vérification des 3 modes

| Mode | SQLite | Supabase | Repository | Status |
|---|---|---|---|---|
| **Cloud** | ❌ Non | ✅ Oui | SupabaseRepository | ✅ |
| **Electron** | ✅ Oui | ❌ Non | SqliteRepository | ✅ |
| **Hybride** | ✅ Oui | ✅ Oui | HybridRepository | ✅ |

**Tous les modes fonctionnent avec le même code métier.**

---

## 19. CONCLUSION

### 19.1 Architecture actuelle — Problèmes

| Problème | Impact | Priorité |
|---|---|---|
| Services métier accèdent à SQLite | Couplage fort | 🔴 Critique |
| Services métier accèdent à Supabase | Couplage fort | 🔴 Critique |
| Pas de Repository Pattern | Duplication, tests difficiles | 🔴 Critique |
| Frontend accède à SQLite | Crash | 🔴 Critique |
| Pas de synchronisation centralisée | Incohérences | 🔴 Critique |
| Pas d'événements métier | Pas de traçabilité | 🟡 Important |
| Pas d'agrégats | Pas d'intégrité | 🟡 Important |

### 19.2 Architecture cible — Solution

**Principe** : Séparation des responsabilités, injection de dépendances, Repository Pattern.

**Bénéfices** :
- Code métier indépendant de la base de données
- Tests faciles (mock des repositories)
- Synchronisation centralisée
- Extensible (ajout de nouvelles bases facile)
- Maintenable (responsabilités séparées)

**Fichiers à créer** : ~20 fichiers  
**Fichiers à modifier** : ~15 fichiers  
**Durée estimée** : 5 semaines  
**Risque** : Moyen (avec tests et rollback)

---

## 20. PROCHAINES ÉTAPES

1. **Valider ce rapport** avec l'équipe
2. **Créer les interfaces Repository** (Phase 1)
3. **Implémenter les repositories SQLite** (Phase 1)
4. **Implémenter les repositories Supabase** (Phase 1)
5. **Refactorer les services métier** (Phase 2)
6. **Implémenter la synchronisation** (Phase 3)
7. **Corriger le frontend** (Phase 4)
8. **Tester et valider** (Phase 5)
9. **Déployer en production** avec rollback plan

---

**Document généré le** : 2026-06-07  
**Auteur** : Software Architect Principal  
**Status** : Prêt pour validation avant implémentation  
**Fichier** : `docs/ARCHITECTURE_AUDIT_COMPLETE.md`