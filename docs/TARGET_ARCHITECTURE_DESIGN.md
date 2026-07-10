# ARCHITECTURE CIBLE — Ekala POS
## Conception finale pour les 3 modes (Cloud / Electron / Hybride)

---

## RÉSUMÉ EXÉCUTIF

Cette architecture permet à **une seule base de code métier** de fonctionner dans 3 environnements distincts sans aucune condition (`if (cloud)`, `if (electron)`, etc.). Le frontend ne sait jamais où sont stockées les données. Le backend choisit automatiquement la bonne source de données via une couche d'abstraction.

**Principe fondamental** : Le code métier ne dépend que d'interfaces. L'infrastructure est injectée au runtime.

---

## 1. ARCHITECTUE CIBLE COMPLÈTE

### 1.1 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER                                         │
│  - React Components                                          │
│  - Zustand Stores                                            │
│  - Hooks                                                     │
│  - Appels API via ApiClient                                   │
└─────────────────────────────────────────────────────────────┘
       ↓
       │ HTTP / IPC
       ↓
┌─────────────────────────────────────────────────────────────┐
│  APPLICATION LAYER                                           │
│  - Use Cases                                                 │
│  - DTOs                                                       │
│  - Validators                                                 │
│  - Orchestration                                              │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│  DOMAIN LAYER                                                │
│  - Entities                                                   │
│  - Value Objects                                              │
│  - Domain Services                                            │
│  - Repository Interfaces                                      │
│  - Domain Events                                              │
│  - Business Rules                                             │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│  EXECUTION CONTEXT LAYER (NOUVEAU)                           │
│  - ExecutionContext                                           │
│  - RepositoryFactory                                          │
│  - Mode Detection                                             │
│  - Dependency Injection Container                             │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│  INFRASTRUCTURE LAYER                                        │
│  - SQLite Repositories                                       │
│  - Supabase Repositories                                     │
│  - Hybrid Repositories                                       │
│  - Identity Resolver                                         │
│  - Synchronization Service                                   │
│  - Event Bus                                                  │
│  - Outbox Pattern                                             │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│  EXTERNAL SYSTEMS                                             │
│  - SQLite (local)                                             │
│  - Supabase (remote)                                          │
│  - File System (Electron)                                     │
└─────────────────────────────────────────────────────────────┘
```

---

### 1.2 Flux d'une opération métier

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND                                                     │
│ - Appelle TableService.assignWaiter(tableId, waiterId)       │
│ - Ne sait pas si Cloud, Electron ou Hybride                  │
└─────────────────────────────────────────────────────────────┘
       ↓
       │ POST /api/tables/:id/assign-waiter
       │ { tableId: 42, waiterId: 15 }
       ↓
┌─────────────────────────────────────────────────────────────┐
│ API ROUTE                                                    │
│ - Récupère le tenantId depuis le JWT                         │
│ - Appelle AssignWaiterUseCase                                │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│ USE CASE: AssignWaiterUseCase                                │
│ - Valide les inputs                                          │
│ - Appelle TableService.assignWaiter()                        │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│ DOMAIN SERVICE: TableService                                 │
│ - Logique métier uniquement                                  │
│ - NE CONNAÎT PAS SQLite NI Supabase                          │
│ - Appelle ITableRepository.assignWaiter()                    │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│ EXECUTION CONTEXT                                            │
│ - Détermine le mode (Cloud / Local / Hybrid)                 │
│ - Via RepositoryFactory, obtient le bon repository           │
│ - Injecte le repository dans le service                      │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│ REPOSITORY INTERFACE: ITableRepository                       │
│ - Définit le contrat                                         │
│ - assignWaiter(tableId: TableId, waiterId: WaiterId)        │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│ IMPLÉMENTATION (choisie par RepositoryFactory)               │
│                                                              │
│ Mode Cloud → SupabaseTableRepository                        │
│ Mode Local → SqliteTableRepository                          │
│ Mode Hybrid → HybridTableRepository                         │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│ SQLite (pour Local et Hybrid)                                │
│ - UPDATE restaurant_tables                                   │
│ - SET assigned_waiter_id = 15  (INTEGER)                     │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│ OUTBOX (pour Local et Hybrid)                                │
│ - INSERT INTO outbox_events                                  │
│ - { event: 'WaiterAssigned', payload: {...} }                │
└─────────────────────────────────────────────────────────────┘
       ↓
       │ (asynchrone, quand connexion disponible)
       ↓
┌─────────────────────────────────────────────────────────────┐
│ SYNCHRONIZATION SERVICE                                      │
│ - Lit les événements en attente                              │
│ - IdentityResolver.resolve(15) → canonical_id (UUID)         │
│ - Envoie vers Supabase                                       │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│ SUPABASE (pour Cloud et Hybrid)                              │
│ - UPDATE restaurant_tables                                   │
│ - SET assigned_waiter_id = 'uuid-...' (UUID)                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. COMPOSANTS CLÉS

### 2.1 ExecutionContext

**Responsabilité** : Déterminer le mode d'exécution et fournir les bonnes implémentations.

```typescript
// src/server/infrastructure/execution-context.ts

export enum ExecutionMode {
  CLOUD = 'cloud',      // Supabase uniquement
  LOCAL = 'local',      // SQLite uniquement
  HYBRID = 'hybrid'     // SQLite + Supabase
}

export class ExecutionContext {
  private static instance: ExecutionContext;
  private mode: ExecutionMode;
  private container: Container;
  
  private constructor() {
    this.detectMode();
    this.configureContainer();
  }
  
  static getInstance(): ExecutionContext {
    if (!ExecutionContext.instance) {
      ExecutionContext.instance = new ExecutionContext();
    }
    return ExecutionContext.instance;
  }
  
  private detectMode(): void {
    // Logique de détection du mode
    // - Si env.SUPABASE_URL && !env.ELECTRON → CLOUD
    // - Si env.ELECTRON && !env.SUPABASE_URL → LOCAL
    // - Si env.ELECTRON && env.SUPABASE_URL → HYBRID
  }
  
  private configureContainer(): void {
    // Configuration du conteneur DI selon le mode
    switch (this.mode) {
      case ExecutionMode.CLOUD:
        this.container.bind<ITableRepository>(ITableRepository)
          .to(SupabaseTableRepository);
        break;
      case ExecutionMode.LOCAL:
        this.container.bind<ITableRepository>(ITableRepository)
          .to(SqliteTableRepository);
        break;
      case ExecutionMode.HYBRID:
        this.container.bind<ITableRepository>(ITableRepository)
          .to(HybridTableRepository);
        break;
    }
  }
  
  getRepository<T>(interfaceToken: Token<T>): T {
    return this.container.get<T>(interfaceToken);
  }
  
  getMode(): ExecutionMode {
    return this.mode;
  }
}
```

---

### 2.2 RepositoryFactory

**Responsabilité** : Créer les repositories selon le mode d'exécution.

```typescript
// src/server/infrastructure/repositories/repository-factory.ts

export interface IRepositoryFactory {
  createTableRepository(): ITableRepository;
  createOrderRepository(): IOrderRepository;
  createUserRepository(): IUserRepository;
  createProductRepository(): IProductRepository;
  createCategoryRepository(): ICategoryRepository;
  // ... autres repositories
}

export class RepositoryFactory implements IRepositoryFactory {
  constructor(private executionContext: ExecutionContext) {}
  
  createTableRepository(): ITableRepository {
    switch (this.executionContext.getMode()) {
      case ExecutionMode.CLOUD:
        return new SupabaseTableRepository();
      case ExecutionMode.LOCAL:
        return new SqliteTableRepository();
      case ExecutionMode.HYBRID:
        return new HybridTableRepository(
          new SqliteTableRepository(),
          new SupabaseTableRepository(),
          new SynchronizationService()
        );
    }
  }
  
  // ... autres méthodes
}
```

---

### 2.3 Repository Pattern

**Interface (Domain)**

```typescript
// src/server/domain/tables/repositories/ITableRepository.ts

export interface ITableRepository {
  create(table: Table): Promise<Table>;
  update(id: TableId, table: Partial<Table>): Promise<Table>;
  delete(id: TableId): Promise<void>;
  findById(id: TableId): Promise<Table | null>;
  findAll(): Promise<Table[]>;
  assignWaiter(tableId: TableId, waiterId: WaiterId): Promise<void>;
  openTable(tableId: TableId, waiterId: WaiterId): Promise<void>;
  closeTable(tableId: TableId): Promise<void>;
}
```

**Implémentation SQLite (Infrastructure)**

```typescript
// src/server/infrastructure/repositories/sqlite/SqliteTableRepository.ts

export class SqliteTableRepository implements ITableRepository {
  constructor(private db: Database) {}
  
  async create(table: Table): Promise<Table> {
    const result = this.db.prepare(`
      INSERT INTO restaurant_tables (table_number, capacity, status, tenant_id)
      VALUES (?, ?, ?, ?)
    `).run(table.tableNumber, table.capacity, table.status, table.tenantId);
    
    return Table.create({
      id: TableId.from(result.lastInsertRowid),
      tableNumber: table.tableNumber,
      capacity: table.capacity,
      status: table.status,
      tenantId: table.tenantId
    });
  }
  
  async assignWaiter(tableId: TableId, waiterId: WaiterId): Promise<void> {
    // ✅ Écrit INTEGER dans SQLite
    this.db.prepare(`
      UPDATE restaurant_tables
      SET assigned_waiter_id = ?
      WHERE id = ? AND tenant_id = ?
    `).run(waiterId.value, tableId.value, tableId.tenantId);
  }
  
  // ... autres méthodes
}
```

**Implémentation Supabase (Infrastructure)**

```typescript
// src/server/infrastructure/repositories/supabase/SupabaseTableRepository.ts

export class SupabaseTableRepository implements ITableRepository {
  constructor(private supabase: SupabaseClient) {}
  
  async create(table: Table): Promise<Table> {
    const { data, error } = await this.supabase
      .from('restaurant_tables')
      .insert([{
        table_number: table.tableNumber,
        capacity: table.capacity,
        status: table.status,
        tenant_id: table.tenantId
      ])
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    
    return Table.create({
      id: TableId.from(data.id),
      tableNumber: data.table_number,
      capacity: data.capacity,
      status: data.status,
      tenantId: data.tenant_id
    });
  }
  
  async assignWaiter(tableId: TableId, waiterId: WaiterId): Promise<void> {
    // ✅ Écrit UUID dans Supabase
    const canonicalId = await this.identityResolver.resolve(waiterId);
    
    const { error } = await this.supabase
      .from('restaurant_tables')
      .update({ assigned_waiter_id: canonicalId })
      .eq('id', tableId.value)
      .eq('tenant_id', tableId.tenantId);
    
    if (error) throw new Error(error.message);
  }
  
  // ... autres méthodes
}
```

**Implémentation Hybride (Infrastructure)**

```typescript
// src/server/infrastructure/repositories/hybrid/HybridTableRepository.ts

export class HybridTableRepository implements ITableRepository {
  constructor(
    private sqliteRepo: ITableRepository,
    private supabaseRepo: ITableRepository,
    private syncService: ISynchronizationService
  ) {}
  
  async create(table: Table): Promise<Table> {
    // 1. Écrire dans SQLite (source de vérité)
    const result = await this.sqliteRepo.create(table);
    
    // 2. Ajouter à la file de synchronisation
    await this.syncService.enqueue({
      type: 'TableCreated',
      payload: result,
      timestamp: new Date()
    });
    
    return result;
  }
  
  async assignWaiter(tableId: TableId, waiterId: WaiterId): Promise<void> {
    // 1. Écrire dans SQLite (INTEGER)
    await this.sqliteRepo.assignWaiter(tableId, waiterId);
    
    // 2. Ajouter à la file de synchronisation
    await this.syncService.enqueue({
      type: 'WaiterAssigned',
      payload: { tableId, waiterId },
      timestamp: new Date()
    });
  }
  
  // ... autres méthodes
}
```

---

### 2.4 Domain Service (sans dépendance infrastructure)

```typescript
// src/server/domain/tables/services/TableService.ts

export class TableService {
  constructor(
    private tableRepository: ITableRepository,  // ✅ Dépend d'une interface
    private identityResolver: IIdentityResolver // ✅ Dépend d'une interface
  ) {}
  
  async assignWaiter(tableId: TableId, waiterId: WaiterId): Result<Table> {
    // 1. Validation métier
    const table = await this.tableRepository.findById(tableId);
    if (!table) {
      return Result.failure('Table not found');
    }
    
    // 2. Logique métier
    if (table.status === TableStatus.OCCUPIED) {
      return Result.failure('Cannot assign waiter to occupied table');
    }
    
    // 3. Résolution d'identité (si nécessaire)
    // Note: En mode Local, cette résolution est ignorée
    // En mode Cloud/Hybrid, elle est utilisée pour Supabase
    const resolvedWaiterId = await this.identityResolver.resolve(waiterId);
    
    // 4. Appel au repository (abstraction)
    await this.tableRepository.assignWaiter(tableId, waiterId);
    
    // 5. Publication d'événement métier
    await this.domainEventBus.publish(
      new WaiterAssignedEvent(tableId, waiterId)
    );
    
    return Result.success(table);
  }
}
```

**Point crucial** : `TableService` ne sait pas si c'est SQLite ou Supabase. Il ne sait pas si c'est Cloud, Local ou Hybride. Il utilise uniquement des interfaces.

---

### 2.5 SynchronizationService (unique)

```typescript
// src/server/infrastructure/synchronization/synchronization.service.ts

export interface ISynchronizationService {
  enqueue(event: DomainEvent): Promise<void>;
  processOutbox(): Promise<void>;
  start(): void;
  stop(): void;
}

export class SynchronizationService implements ISynchronizationService {
  private isProcessing = false;
  
  constructor(
    private outboxRepository: IOutboxRepository,
    private identityResolver: IIdentityResolver,
    private supabaseRepository: ISupabaseRepository,
    private eventBus: IEventBus
  ) {}
  
  async enqueue(event: DomainEvent): Promise<void> {
    // 1. Sauvegarder dans l'outbox (SQLite)
    await this.outboxRepository.save({
      eventType: event.type,
      payload: event.payload,
      timestamp: event.timestamp,
      status: OutboxStatus.PENDING
    });
    
    // 2. Tenter de synchroniser immédiatement si online
    if (this.isOnline()) {
      await this.processOutbox();
    }
  }
  
  async processOutbox(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    
    try {
      // 1. Récupérer les événements en attente
      const events = await this.outboxRepository.findPending();
      
      for (const event of events) {
        try {
          // 2. Résoudre les identités (INTEGER → UUID)
          const resolvedPayload = await this.resolveIdentities(event.payload);
          
          // 3. Envoyer vers Supabase
          await this.sendToSupabase(event.eventType, resolvedPayload);
          
          // 4. Marquer comme synchronisé
          await this.outboxRepository.markAsSynced(event.id);
          
        } catch (error) {
          // 5. Gérer les retries
          await this.outboxRepository.incrementRetry(event.id);
          console.error(`Failed to sync event ${event.id}:`, error);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
  
  private async resolveIdentities(payload: any): Promise<any> {
    // Résoudre tous les INTEGER vers UUID
    if (payload.waiterId) {
      payload.waiterId = await this.identityResolver.resolve(payload.waiterId);
    }
    // ... autres résolutions
    return payload;
  }
}
```

---

## 3. INTERFACES DOMAIN

### 3.1 Repositories

```typescript
// src/server/domain/tables/repositories/ITableRepository.ts
export interface ITableRepository {
  create(table: Table): Promise<Table>;
  update(id: TableId, table: Partial<Table>): Promise<Table>;
  delete(id: TableId): Promise<void>;
  findById(id: TableId): Promise<Table | null>;
  findAll(): Promise<Table[]>;
  assignWaiter(tableId: TableId, waiterId: WaiterId): Promise<void>;
  openTable(tableId: TableId, waiterId: WaiterId): Promise<void>;
  closeTable(tableId: TableId): Promise<void>;
}

// src/server/domain/orders/repositories/IOrderRepository.ts
export interface IOrderRepository {
  create(order: Order): Promise<Order>;
  update(id: OrderId, order: Partial<Order>): Promise<Order>;
  delete(id: OrderId): Promise<void>;
  findById(id: OrderId): Promise<Order | null>;
  findByTableId(tableId: TableId): Promise<Order[]>;
  findPendingByTableId(tableId: TableId): Promise<Order | null>;
}

// src/server/domain/users/repositories/IUserRepository.ts
export interface IUserRepository {
  create(user: User): Promise<User>;
  update(id: UserId, user: Partial<User>): Promise<User>;
  delete(id: UserId): Promise<void>;
  findById(id: UserId): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(): Promise<User[]>;
}

// ... autres repositories
```

### 3.2 Services

```typescript
// src/server/domain/tables/services/ITableService.ts
export interface ITableService {
  createTable(dto: CreateTableDto): Promise<Table>;
  updateTable(id: TableId, dto: UpdateTableDto): Promise<Table>;
  deleteTable(id: TableId): Promise<void>;
  assignWaiter(tableId: TableId, waiterId: WaiterId): Promise<Table>;
  openTable(tableId: TableId, waiterId: WaiterId): Promise<Table>;
  closeTable(tableId: TableId): Promise<Table>;
}

// src/server/domain/orders/services/IOrderService.ts
export interface IOrderService {
  createOrder(dto: CreateOrderDto): Promise<Order>;
  updateOrder(id: OrderId, dto: UpdateOrderDto): Promise<Order>;
  deleteOrder(id: OrderId): Promise<void>;
  addItem(orderId: OrderId, item: OrderItem): Promise<Order>;
  removeItem(orderId: OrderId, itemId: OrderItemId): Promise<Order>;
  submitOrder(orderId: OrderId): Promise<Order>;
  payOrder(orderId: OrderId, payment: Payment): Promise<Order>;
}

// ... autres services
```

### 3.3 Identity Resolver

```typescript
// src/server/domain/identity/repositories/IIdentityResolver.ts
export interface IIdentityResolver {
  resolve(sliteId: number): Promise<string>;  // Retourne canonical_id (UUID)
  resolveBatch(sliteIds: number[]): Promise<Map<number, string>>;
}

// src/server/domain/identity/value-objects/CanonicalId.ts
export class CanonicalId {
  constructor(public readonly value: string) {
    if (!this.isValid(value)) {
      throw new Error('Invalid canonical ID');
    }
  }
  
  private isValid(value: string): boolean {
    // Validation UUID
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }
  
  static from(value: string): CanonicalId {
    return new CanonicalId(value);
  }
}
```

---

## 4. VALUE OBJECTS

```typescript
// src/server/domain/tables/value-objects/TableId.ts
export class TableId {
  constructor(public readonly value: number, public readonly tenantId: number) {}
  
  static from(value: number, tenantId: number): TableId {
    return new TableId(value, tenantId);
  }
}

// src/server/domain/users/value-objects/WaiterId.ts
export class WaiterId {
  constructor(public readonly value: number, public readonly tenantId: number) {}
  
  static from(value: number, tenantId: number): WaiterId {
    return new WaiterId(value, tenantId);
  }
}

// src/server/domain/orders/value-objects/OrderId.ts
export class OrderId {
  constructor(public readonly value: number, public readonly tenantId: number) {}
  
  static from(value: number, tenantId: number): OrderId {
    return new OrderId(value, tenantId);
  }
}

// src/server/domain/users/value-objects/UserId.ts
export class UserId {
  constructor(public readonly value: number, public readonly tenantId: number) {}
  
  static from(value: number, tenantId: number): UserId {
    return new UserId(value, tenantId);
  }
}
```

---

## 5. DOMAIN EVENTS

```typescript
// src/server/domain/events/DomainEvent.ts
export interface DomainEvent {
  type: string;
  payload: any;
  timestamp: Date;
  tenantId: number;
}

// src/server/domain/tables/events/TableEvents.ts
export class TableCreatedEvent implements DomainEvent {
  type = 'TableCreated';
  constructor(public payload: Table, public timestamp: Date, public tenantId: number) {}
}

export class TableUpdatedEvent implements DomainEvent {
  type = 'TableUpdated';
  constructor(public payload: Table, public timestamp: Date, public tenantId: number) {}
}

export class WaiterAssignedEvent implements DomainEvent {
  type = 'WaiterAssigned';
  constructor(
    public payload: { tableId: TableId; waiterId: WaiterId },
    public timestamp: Date,
    public tenantId: number
  ) {}
}

export class TableOpenedEvent implements DomainEvent {
  type = 'TableOpened';
  constructor(
    public payload: { tableId: TableId; waiterId: WaiterId },
    public timestamp: Date,
    public tenantId: number
  ) {}
}

export class TableClosedEvent implements DomainEvent {
  type = 'TableClosed';
  constructor(public payload: { tableId: TableId }, public timestamp: Date, public tenantId: number) {}
}

// ... autres événements
```

---

## 6. USE CASES

```typescript
// src/server/application/tables/use-cases/AssignWaiterUseCase.ts

export class AssignWaiterUseCase {
  constructor(
    private tableService: ITableService,
    private eventBus: IEventBus
  ) {}
  
  async execute(dto: AssignWaiterDto): Promise<Table> {
    // 1. Validation
    if (!dto.tableId || !dto.waiterId) {
      throw new Error('Missing required fields');
    }
    
    // 2. Exécution
    const result = await this.tableService.assignWaiter(
      TableId.from(dto.tableId, dto.tenantId),
      WaiterId.from(dto.waiterId, dto.tenantId)
    );
    
    if (result.isFailure) {
      throw new Error(result.error);
    }
    
    // 3. Retour
    return result.value;
  }
}

// src/server/application/tables/use-cases/CreateTableUseCase.ts
export class CreateTableUseCase {
  constructor(
    private tableService: ITableService,
    private eventBus: IEventBus
  ) {}
  
  async execute(dto: CreateTableDto): Promise<Table> {
    // Validation + Exécution
    return this.tableService.createTable(dto);
  }
}

// ... autres use cases
```

---

## 7. CONTAINER DI (Dependency Injection)

```typescript
// src/server/infrastructure/di/container.ts

export class Container {
  private bindings: Map<string, any> = new Map();
  
  bind<T>(token: Token<T>, implementation: new (...args: any[]) => T): void {
    this.bindings.set(token.toString(), implementation);
  }
  
  get<T>(token: Token<T>): T {
    const implementation = this.bindings.get(token.toString());
    if (!implementation) {
      throw new Error(`No binding found for ${token.toString()}`);
    }
    
    // Injection des dépendances
    const dependencies = this.resolveDependencies(implementation);
    return new implementation(...dependencies);
  }
  
  private resolveDependencies(implementation: any): any[] {
    // Reflection pour injecter les dépendances automatiquement
    // ...
  }
}

// Configuration
const container = new Container();

// Repositories
container.bind<ITableRepository>(ITableRepository)
  .to(SqliteTableRepository);  // Changé automatiquement selon le mode

container.bind<IOrderRepository>(IOrderRepository)
  .to(SqliteOrderRepository);

container.bind<IUserRepository>(IUserRepository)
  .to(SqliteUserRepository);

// Services
container.bind<ITableService>(ITableService)
  .to(TableService);

container.bind<IOrderService>(IOrderService)
  .to(OrderService);

// Use Cases
container.bind<AssignWaiterUseCase>(AssignWaiterUseCase)
  .to(AssignWaiterUseCase);

container.bind<CreateTableUseCase>(CreateTableUseCase)
  .to(CreateTableUseCase);
```

---

## 8. API ROUTES (inchangées)

```typescript
// src/server/routes/tables.ts

import { Container } from '../infrastructure/di/container';
import { AssignWaiterUseCase } from '../application/tables/use-cases/AssignWaiterUseCase';

const container = Container.getInstance();

router.post('/:id/assign-waiter', async (req: any, res: any) => {
  try {
    const useCase = container.get(AssignWaiterUseCase);
    const result = await useCase.execute({
      tableId: req.params.id,
      waiterId: req.body.waiterId,
      tenantId: req.tenantId
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ... autres routes
```

**Point crucial** : Les routes ne changent pas. Elles utilisent le conteneur DI pour obtenir les use cases.

---

## 9. FRONTEND (inchangé)

```typescript
// src/stores/useTableStore.ts

export const useTableStore = create<TableState>((set, get) => ({
  tables: [],
  loading: false,
  error: null,
  
  assignWaiter: async (tableId: number, waiterId: number) => {
    try {
      // ✅ Appel API simple, ne sait pas où sont les données
      await api.tables.assignWaiter(tableId, waiterId);
      await get().fetchTables(true);
    } catch (err: any) {
      console.error('Failed to assign waiter', err);
      set({ error: err.message });
    }
  }
}));
```

**Point crucial** : Le frontend ne change pas. Il appelle `api.tables.assignWaiter()` sans savoir si c'est SQLite ou Supabase.

---

## 10. PIPELINE UNIQUE DE SYNCHRONISATION

### 10.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ SYNCHRONIZATION SERVICE (UNIQUE)                             │
│                                                              │
│ Responsabilités :                                           │
│ 1. Écouter les Domain Events                                 │
│ 2. Stocker dans Outbox (SQLite)                              │
│ 3. Traiter la file d'attente                                 │
│ 4. Résoudre les identités (INTEGER → UUID)                   │
│ 5. Envoyer vers Supabase                                     │
│ 6. Gérer les retries                                         │
│ 7. Gérer les conflits                                        │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 Flux de synchronisation

```
Domain Event publié
  ↓
OutboxRepository.save(event)  // SQLite
  ↓
SynchronizationService.processOutbox()
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

## 11. MODE DÉTECTION

### 11.1 Logique de détection

```typescript
// src/server/infrastructure/execution-context.ts

private detectMode(): void {
  const hasSupabase = !!process.env.SUPABASE_URL;
  const isElectron = process.env.ELECTRON === 'true';
  
  if (hasSupabase && !isElectron) {
    this.mode = ExecutionMode.CLOUD;
  } else if (!hasSupabase && isElectron) {
    this.mode = ExecutionMode.LOCAL;
  } else if (hasSupabase && isElectron) {
    this.mode = ExecutionMode.HYBRID;
  } else {
    throw new Error('Cannot determine execution mode');
  }
}
```

### 11.2 Configuration par mode

| Mode | SQLite | Supabase | Repository | Synchronisation |
|---|---|---|---|---|
| **CLOUD** | ❌ | ✅ | SupabaseRepository | ❌ Non nécessaire |
| **LOCAL** | ✅ | ❌ | SqliteRepository | ❌ Non nécessaire |
| **HYBRID** | ✅ | ✅ | HybridRepository | ✅ Outbox → SyncService |

---

## 12. AVANTAGES DE CETTE ARCHITECTURE

### 12.1 Pour le Frontend

- ✅ Ne sait pas où sont stockées les données
- ✅ Pas de `if (cloud)` / `if (electron)`
- ✅ Code métier identique dans les 3 modes
- ✅ Pas d'accès à SQLite
- ✅ Pas de résolution d'identité

### 12.2 Pour le Backend

- ✅ Code métier indépendant de l'infrastructure
- ✅ Tests faciles (mock des repositories)
- ✅ Synchronisation centralisée
- ✅ Extensible (ajout de nouvelles bases facile)
- ✅ Maintenable (responsabilités séparées)

### 12.3 Pour l'entreprise

- ✅ Architecture professionnelle et maintenable
- ✅ Évolutive (ajout de fonctionnalités facile)
- ✅ Testable (tests unitaires et intégration)
- ✅ Déployable (rollback facile)
- ✅ Documentée (architecture claire)

---

## 13. FICHIERS À CRÉER

### 13.1 Domain Layer (~15 fichiers)

```
src/server/domain/
├── tables/
│   ├── entities/
│   │   └── Table.ts
│   ├── value-objects/
│   │   ├── TableId.ts
│   │   ├── TableNumber.ts
│   │   └── TableStatus.ts
│   ├── repositories/
│   │   └── ITableRepository.ts
│   ├── services/
│   │   └── ITableService.ts
│   └── events/
│       ├── TableCreatedEvent.ts
│       ├── TableUpdatedEvent.ts
│       ├── WaiterAssignedEvent.ts
│       └── TableOpenedEvent.ts
├── orders/
│   ├── entities/
│   │   └── Order.ts
│   ├── value-objects/
│   │   ├── OrderId.ts
│   │   └── OrderStatus.ts
│   ├── repositories/
│   │   └── IOrderRepository.ts
│   ├── services/
│   │   └── IOrderService.ts
│   └── events/
│       ├── OrderCreatedEvent.ts
│       ├── OrderUpdatedEvent.ts
│       └── OrderPaidEvent.ts
├── users/
│   ├── entities/
│   │   └── User.ts
│   ├── value-objects/
│   │   ├── UserId.ts
│   │   ├── Username.ts
│   │   └── Email.ts
│   ├── repositories/
│   │   └── IUserRepository.ts
│   ├── services/
│   │   └── IUserService.ts
│   └── events/
│       ├── UserCreatedEvent.ts
│       └── UserUpdatedEvent.ts
├── products/
│   ├── entities/
│   │   └── Product.ts
│   ├── value-objects/
│   │   ├── ProductId.ts
│   │   └── Price.ts
│   ├── repositories/
│   │   └── IProductRepository.ts
│   ├── services/
│   │   └── IProductService.ts
│   └── events/
│       ├── ProductCreatedEvent.ts
│       └── ProductUpdatedEvent.ts
├── categories/
│   ├── entities/
│   │   └── Category.ts
│   ├── value-objects/
│   │   └── CategoryId.ts
│   ├── repositories/
│   │   └── ICategoryRepository.ts
│   └── events/
│       ├── CategoryCreatedEvent.ts
│       └── CategoryUpdatedEvent.ts
├── identity/
│   ├── value-objects/
│   │   └── CanonicalId.ts
│   ├── repositories/
│   │   └── IIdentityResolver.ts
│   └── services/
│       └── IdentityResolver.ts
└── events/
    ├── DomainEvent.ts
    └── EventBus.ts
```

### 13.2 Application Layer (~20 fichiers)

```
src/server/application/
├── tables/
│   ├── use-cases/
│   │   ├── CreateTableUseCase.ts
│   │   ├── UpdateTableUseCase.ts
│   │   ├── DeleteTableUseCase.ts
│   │   ├── AssignWaiterUseCase.ts
│   │   ├── OpenTableUseCase.ts
│   │   └── CloseTableUseCase.ts
│   ├── dtos/
│   │   ├── CreateTableDto.ts
│   │   ├── UpdateTableDto.ts
│   │   └── AssignWaiterDto.ts
│   └── validators/
│       ├── CreateTableValidator.ts
│       └── AssignWaiterValidator.ts
├── orders/
│   ├── use-cases/
│   │   ├── CreateOrderUseCase.ts
│   │   ├── UpdateOrderUseCase.ts
│   │   ├── AddItemUseCase.ts
│   │   ├── RemoveItemUseCase.ts
│   │   ├── SubmitOrderUseCase.ts
│   │   └── PayOrderUseCase.ts
│   ├── dtos/
│   │   ├── CreateOrderDto.ts
│   │   └── AddItemDto.ts
│   └── validators/
│       └── CreateOrderValidator.ts
└── users/
    ├── use-cases/
    │   ├── CreateUserUseCase.ts
    │   ├── UpdateUserUseCase.ts
    │   └── DeleteUserUseCase.ts
    ├── dtos/
    │   ├── CreateUserDto.ts
    │   └── UpdateUserDto.ts
    └── validators/
        └── CreateUserValidator.ts
```

### 13.3 Infrastructure Layer (~30 fichiers)

```
src/server/infrastructure/
├── execution-context.ts
├── repository-factory.ts
├── di/
│   └── container.ts
├── repositories/
│   ├── sqlite/
│   │   ├── SqliteTableRepository.ts
│   │   ├── SqliteOrderRepository.ts
│   │   ├── SqliteUserRepository.ts
│   │   ├── SqliteProductRepository.ts
│   │   └── SqliteCategoryRepository.ts
│   ├── supabase/
│   │   ├── SupabaseTableRepository.ts
│   │   ├── SupabaseOrderRepository.ts
│   │   ├── SupabaseUserRepository.ts
│   │   ├── SupabaseProductRepository.ts
│   │   └── SupabaseCategoryRepository.ts
│   └── hybrid/
│       ├── HybridTableRepository.ts
│       ├── HybridOrderRepository.ts
│       ├── HybridUserRepository.ts
│       ├── HybridProductRepository.ts
│       └── HybridCategoryRepository.ts
├── synchronization/
│   ├── synchronization.service.ts
│   ├── outbox.repository.ts
│   ├── identity-mapper.service.ts
│   └── conflict-resolver.service.ts
├── identity/
│   └── identity-resolver.service.ts
└── events/
    └── event-bus.service.ts
```

---

## 14. PLAN D'IMPLÉMENTATION

### Phase 1 — Domain Layer (Semaine 1)

**Objectif** : Créer les entités, value objects, interfaces et événements métier.

1. **Créer les Value Objects** (1 jour)
   - TableId, WaiterId, OrderId, UserId, etc.
   
2. **Créer les Entities** (1 jour)
   - Table, Order, User, Product, Category, etc.
   
3. **Créer les Repository Interfaces** (1 jour)
   - ITableRepository, IOrderRepository, IUserRepository, etc.
   
4. **Créer les Service Interfaces** (1 jour)
   - ITableService, IOrderService, IUserService, etc.
   
5. **Créer les Domain Events** (1 jour)
   - TableCreatedEvent, WaiterAssignedEvent, etc.

**Livrable** : Domain Layer complet et testable

---

### Phase 2 — Infrastructure Layer (Semaine 2)

**Objectif** : Créer les implémentations SQLite et Supabase.

1. **Créer ExecutionContext** (1 jour)
   - Détection du mode
   - Configuration du conteneur DI
   
2. **Créer RepositoryFactory** (1 jour)
   - Factory pour créer les repositories
   
3. **Créer les Repositories SQLite** (2 jours)
   - SqliteTableRepository, SqliteOrderRepository, etc.
   
4. **Créer les Repositories Supabase** (2 jours)
   - SupabaseTableRepository, SupabaseOrderRepository, etc.

**Livrable** : Infrastructure Layer fonctionnelle

---

### Phase 3 — Application Layer (Semaine 3)

**Objectif** : Créer les Use Cases et valider le flux complet.

1. **Créer les Use Cases** (3 jours)
   - CreateTableUseCase, AssignWaiterUseCase, etc.
   
2. **Créer les DTOs et Validators** (2 jours)
   - Validation des entrées

**Livrable** : Application Layer fonctionnelle

---

### Phase 4 — Synchronization (Semaine 4)

**Objectif** : Implémenter la synchronisation pour le mode Hybride.

1. **Créer le Outbox Pattern** (1 jour)
   - OutboxRepository
   - Stockage des événements
   
2. **Créer SynchronizationService** (2 jours)
   - Traitement de la file d'attente
   - Résolution d'identité
   - Envoi vers Supabase
   - Gestion des retries
   
3. **Créer HybridTableRepository** (1 jour)
   - Écriture SQLite + Outbox
   
4. **Intégrer la synchronisation** (1 jour)
   - Connecter EventBus → Outbox → SyncService

**Livrable** : Synchronisation fonctionnelle

---

### Phase 5 — Migration Services Existants (Semaine 5)

**Objectif** : Migrer les services existants vers la nouvelle architecture.

1. **Refactorer TableService** (1 jour)
   - Extraire logique métier
   - Utiliser ITableRepository
   
2. **Refactorer OrderService** (1 jour)
   - Extraire logique métier
   - Utiliser IOrderRepository
   
3. **Refactorer UserService** (1 jour)
   - Extraire logique métier
   - Utiliser IUserRepository
   
4. **Refactorer ProductService** (1 jour)
   - Extraire logique métier
   - Utiliser IProductRepository
   
5. **Refactorer CategoryService** (1 jour)
   - Extraire logique métier
   - Utiliser ICategoryRepository

**Livrable** : Services métier migrés

---

### Phase 6 — Frontend (Semaine 6)

**Objectif** : Corriger le frontend pour qu'il utilise les nouvelles APIs.

1. **Corriger useTableStore.ts** (1 jour)
   - Supprimer accès SQLite
   - Utiliser les nouvelles APIs
   
2. **Corriger useOrderStore.ts** (1 jour)
   - Vérifier pas d'accès SQLite
   
3. **Corriger useAuthStore.ts** (1 jour)
   - Vérifier pas d'accès SQLite

**Livrable** : Frontend fonctionnel

---

### Phase 7 — Tests et Validation (Semaine 7)

**Objectif** : Valider que les 3 modes fonctionnent correctement.

1. **Tests unitaires** (2 jours)
   - Tester chaque repository
   - Tester chaque use case
   - Tester chaque service
   
2. **Tests d'intégration** (2 jours)
   - Tester CRUD complet
   - Tester synchronisation
   - Tester les 3 modes
   
3. **Tests E2E** (1 jour)
   - Tester scénarios complets
   - Tester la synchronisation

**Livrable** : Tests complets, prêt pour production

---

## 15. RISQUES ET MITIGATION

### 15.1 Risques identifiés

| Risque | Impact | Probabilité | Mitigation |
|---|---|---|---|
| Perte de données lors de la migration | Élevé | Faible | Backup complet + tests |
| Régression fonctionnelle | Élevé | Moyenne | Tests complets + déploiement progressif |
| Performance dégradée | Moyen | Faible | Tests de performance |
| Conflits de synchronisation | Élevé | Moyenne | Implémenter LWW ou CRDT |
| Rollback impossible | Élevé | Faible | Plan de rollback détaillé |

### 15.2 Stratégie de mitigation

1. **Backup complet** avant toute modification
2. **Tests automatisés** pour chaque modification
3. **Déploiement progressif** (feature flags)
4. **Monitoring** en production
5. **Plan de rollback** prêt à être exécuté

---

## 16. VALIDATION DES INVARIANTS

### 16.1 Checklist de validation

| Invariant | Vérification | Status |
|---|---|---|
| **I1** : SQLite reste la source de vérité en mode Local/Hybride | ✅ Repository SQLite utilisé par défaut | ✅ |
| **I2** : Supabase n'est qu'une base de synchronisation | ✅ Pas d'accès direct depuis services métier | ✅ |
| **I3** : Toutes les relations SQLite restent en INTEGER | ✅ Aucune modification de schéma | ✅ |
| **I4** : Les UUID n'existent que dans Supabase | ✅ SQLite ne contient que des INTEGER | ✅ |
| **I5** : Le frontend ignore les UUID | ✅ Frontend envoie uniquement INTEGER | ✅ |
| **I6** : Un seul pipeline de synchronisation | ✅ SynchronizationService unique | ✅ |
| **I7** : Pas de `if (electron)` dans les services | ✅ Injection de dépendances | ✅ |
| **I8** : Pas de `if (online)` dans les services | ✅ Outbox pattern | ✅ |
| **I9** : La résolution d'identité est backend uniquement | ✅ Frontend ne résout rien | ✅ |
| **I10** : Les services métier ne connaissent pas SQLite/Supabase | ✅ Dépendent d'interfaces | ✅ |

---

## 17. CONCLUSION

### 17.1 Architecture cible — Solution

**Principe** : Séparation des responsabilités, injection de dépendances, Repository Pattern, ExecutionContext.

**Bénéfices** :
- ✅ Code métier unique pour les 3 modes
- ✅ Frontend ne sait pas où sont les données
- ✅ Tests faciles (mock des repositories)
- ✅ Synchronisation centralisée
- ✅ Extensible (ajout de nouvelles bases facile)
- ✅ Maintenable (responsabilités séparées)
- ✅ Professionnelle (architecture enterprise)

**Fichiers à créer** : ~65 fichiers  
**Fichiers à modifier** : ~15 fichiers  
**Durée estimée** : 7 semaines  
**Risque** : Moyen (avec tests et rollback)

---

## 18. PROCHAINES ÉTAPES

1. **Valider cette architecture** avec l'équipe
2. **Implémenter Phase 1** — Domain Layer
3. **Implémenter Phase 2** — Infrastructure Layer
4. **Implémenter Phase 3** — Application Layer
5. **Implémenter Phase 4** — Synchronization
6. **Implémenter Phase 5** — Migration Services
7. **Implémenter Phase 6** — Frontend
8. **Implémenter Phase 7** — Tests
9. **Déployer en production** avec rollback plan

---

**Document généré le** : 2026-06-07  
**Auteur** : Software Architect Principal  
**Status** : Prêt pour validation avant implémentation  
**Fichier** : `docs/TARGET_ARCHITECTURE_DESIGN.md`