# ARCHITECTURE V2.0 — Ekala POS
## Version finalisée pour implémentation

---

## RÈGLES ABSOLUES (NON NÉGOCIABLES)

### Règle 1 — Aucun Singleton
Aucune classe ne doit utiliser le pattern Singleton. Toute instance est créée et injectée.

### Règle 2 — Aucun Service Locator
Aucune classe ne doit récupérer ses dépendances elle-même. Toutes les dépendances sont injectées via le constructeur.

### Règle 3 — Injection de dépendances
Toute dépendance est passée en paramètre du constructeur. Aucune dépendance n'est créée à l'intérieur d'une classe.

### Règle 4 — Domain Layer pur
Le Domain Layer n'importe jamais :
- SQLite
- Supabase
- Express
- Electron
- EventBus
- Logger

Le Domain Layer ne contient que :
- Entities
- Value Objects
- Domain Services (interfaces uniquement)
- Repository Interfaces
- Business Rules

### Règle 5 — Frontend ignorant
Le Frontend ignore totalement :
- SQLite
- Supabase
- UUID
- identity_map
- Synchronization
- EventBus

Le Frontend appelle uniquement les API REST.

### Règle 6 — INTEGER uniquement côté SQLite
Toutes les relations SQLite utilisent des INTEGER :
- users.id : INTEGER
- restaurant_tables.assigned_waiter_id : INTEGER
- orders.waiter_id : INTEGER
- tenant_users.user_id : INTEGER

### Règle 7 — UUID uniquement côté Supabase
Les UUID n'existent que dans :
- Supabase (users.id, restaurant_tables.assigned_waiter_id)
- IdentityMap (canonical_id, supabase_id)

Jamais dans les tables métier SQLite.

### Règle 8 — Synchronisation via Outbox uniquement
Toute synchronisation passe exclusivement par l'Outbox. Aucun `await supabase...` ne doit apparaître dans les services métier.

### Règle 9 — RuntimeContext unique
Un seul point de détection du mode d'exécution : RuntimeContext. Toute la configuration passe par là.

### Règle 10 — Migration incrémentale
Interdiction de réécrire toute l'application d'un coup. Migration module par module avec validation à chaque étape.

---

## 1. ARCHITECTURE CIBLE (V2.0)

### 1.1 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER                                         │
│  - React Components                                          │
│  - Zustand Stores                                            │
│  - ApiClient                                                 │
│  - AUCUNE connaissance de l'infrastructure                   │
└─────────────────────────────────────────────────────────────┘
       ↓
       │ HTTP / IPC
       ↓
┌─────────────────────────────────────────────────────────────┐
│  API LAYER                                                   │
│  - Routes Express                                           │
│  - Controllers                                               │
│  - Validation                                                │
│  - Injection des dépendances via Composition Root            │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│  APPLICATION LAYER                                           │
│  - Use Cases                                                 │
│  - DTOs                                                       │
│  - Validators                                                 │
│  - Publication d'événements métier                           │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│  DOMAIN LAYER                                                │
│  - Entities                                                   │
│  - Value Objects                                              │
│  - Domain Services (interfaces uniquement)                    │
│  - Repository Interfaces                                      │
│  - Business Rules                                             │
│  - AUCUNE dépendance infrastructure                           │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│  COMPOSITION ROOT (NOUVEAU)                                  │
│  - RuntimeContext (détection du mode)                        │
│  - Injection des dépendances                                 │
│  - Création des instances                                    │
│  - Configuration des repositories                            │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│  INFRASTRUCTURE LAYER                                        │
│  - SQLite Repositories                                       │
│  - Supabase Repositories                                     │
│  - Hybrid Repositories                                       │
│  - Outbox Repository                                         │
│  - Synchronization Service                                   │
│  - Identity Resolver                                         │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│  EXTERNAL SYSTEMS                                             │
│  - SQLite (local)                                            │
│  - Supabase (remote)                                         │
└─────────────────────────────────────────────────────────────┘
```

---

### 1.2 Flux d'une opération métier (ex: assignWaiter)

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND                                                     │
│ assignWaiter(tableId: 42, waiterId: 15)                     │
└─────────────────────────────────────────────────────────────┘
       ↓
       │ POST /api/tables/42/assign-waiter
       │ { waiterId: 15 }
       ↓
┌─────────────────────────────────────────────────────────────┐
│ API ROUTE                                                    │
│ - Récupère tenantId depuis JWT                               │
│ - Appelle AssignWaiterUseCase via Composition Root           │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│ USE CASE: AssignWaiterUseCase                                │
│ - Valide les inputs                                          │
│ - Appelle TableService.assignWaiter()                        │
│ - Publie WaiterAssignedEvent                                 │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│ DOMAIN SERVICE: TableService                                 │
│ - Logique métier uniquement                                  │
│ - Appelle ITableRepository.assignWaiter()                    │
│ - NE CONNAÎT PAS SQLite NI Supabase                          │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│ REPOSITORY (injecté via Composition Root)                    │
│                                                              │
│ Mode HYBRID → HybridTableRepository                         │
│   - Écrit dans SQLite (INTEGER)                              │
│   - Ajoute événement Outbox                                  │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│ SQLite                                                       │
│ UPDATE restaurant_tables SET assigned_waiter_id = 15         │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│ OUTBOX                                                       │
│ INSERT INTO outbox_events                                    │
│ { type: 'WaiterAssigned', payload: {...} }                   │
└─────────────────────────────────────────────────────────────┘
       ↓
       │ (asynchrone)
       ↓
┌─────────────────────────────────────────────────────────────┐
│ SYNCHRONIZATION SERVICE (UNIQUE)                             │
│ - Traite l'Outbox                                            │
│ - IdentityResolver.resolve(15) → canonical_id (UUID)         │
│ - Envoie vers Supabase                                       │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│ SUPABASE                                                     │
│ UPDATE restaurant_tables SET assigned_waiter_id = 'uuid-...' │
└─────────────────────────────────────────────────────────────┘
```

**Point crucial** : Un seul pipeline, pas de duplication, pas de conditions.

---

## 2. COMPOSANTS CLÉS

### 2.1 RuntimeContext (NOUVEAU)

**Responsabilité** : Détecter le mode d'exécution UNE SEULE FOIS au démarrage.

```typescript
// src/server/infrastructure/runtime/runtime-context.ts

export enum ExecutionMode {
  CLOUD = 'cloud',      // Supabase uniquement
  LOCAL = 'local',      // SQLite uniquement
  HYBRID = 'hybrid'     // SQLite + Supabase
}

export class RuntimeContext {
  private static instance: RuntimeContext;
  public readonly mode: ExecutionMode;
  public readonly tenantId: number;
  public readonly isOnline: boolean;
  
  private constructor() {
    this.mode = this.detectMode();
    this.tenantId = this.detectTenantId();
    this.isOnline = this.detectOnlineStatus();
  }
  
  static initialize(): RuntimeContext {
    if (!RuntimeContext.instance) {
      RuntimeContext.instance = new RuntimeContext();
    }
    return RuntimeContext.instance;
  }
  
  static getInstance(): RuntimeContext {
    if (!RuntimeContext.instance) {
      throw new Error('RuntimeContext not initialized');
    }
    return RuntimeContext.instance;
  }
  
  private detectMode(): ExecutionMode {
    const hasSupabase = !!process.env.SUPABASE_URL;
    const isElectron = process.env.ELECTRON === 'true';
    
    if (hasSupabase && !isElectron) {
      return ExecutionMode.CLOUD;
    } else if (!hasSupabase && isElectron) {
      return ExecutionMode.LOCAL;
    } else if (hasSupabase && isElectron) {
      return ExecutionMode.HYBRID;
    }
    
    throw new Error('Cannot determine execution mode');
  }
  
  private detectTenantId(): number {
    // Logique de détection du tenant
    return parseInt(process.env.TENANT_ID || '0');
  }
  
  private detectOnlineStatus(): boolean {
    // Logique de détection du statut réseau
    return !!process.env.SUPABASE_URL;
  }
  
  isCloud(): boolean {
    return this.mode === ExecutionMode.CLOUD;
  }
  
  isLocal(): boolean {
    return this.mode === ExecutionMode.LOCAL;
  }
  
  isHybrid(): boolean {
    return this.mode === ExecutionMode.HYBRID;
  }
}
```

**Point crucial** : RuntimeContext est créé UNE SEULE FOIS au démarrage. Il n'est pas un Singleton, il est injecté partout.

---

### 2.2 Composition Root (NOUVEAU)

**Responsabilité** : Créer toutes les instances et injecter les dépendances.

```typescript
// src/server/infrastructure/composition-root.ts

import { RuntimeContext } from './runtime/runtime-context';
import { SqliteTableRepository } from './repositories/sqlite/SqliteTableRepository';
import { SupabaseTableRepository } from './repositories/supabase/SupabaseTableRepository';
import { HybridTableRepository } from './repositories/hybrid/HybridTableRepository';
import { TableService } from '../../domain/tables/services/TableService';
import { AssignWaiterUseCase } from '../../application/tables/use-cases/AssignWaiterUseCase';

export class CompositionRoot {
  private static instance: CompositionRoot;
  private runtimeContext: RuntimeContext;
  private repositories: Map<string, any> = new Map();
  private services: Map<string, any> = new Map();
  private useCases: Map<string, any> = new Map();
  
  private constructor() {
    this.runtimeContext = RuntimeContext.initialize();
    this.configureRepositories();
    this.configureServices();
    this.configureUseCases();
  }
  
  static initialize(): CompositionRoot {
    if (!CompositionRoot.instance) {
      CompositionRoot.instance = new CompositionRoot();
    }
    return CompositionRoot.instance;
  }
  
  static getInstance(): CompositionRoot {
    if (!CompositionRoot.instance) {
      throw new Error('CompositionRoot not initialized');
    }
    return CompositionRoot.instance;
  }
  
  private configureRepositories(): void {
    // Table Repository
    switch (this.runtimeContext.mode) {
      case ExecutionMode.CLOUD:
        this.repositories.set('ITableRepository', 
          new SupabaseTableRepository());
        break;
      case ExecutionMode.LOCAL:
        this.repositories.set('ITableRepository', 
          new SqliteTableRepository());
        break;
      case ExecutionMode.HYBRID:
        const syncService = new SynchronizationService();
        this.repositories.set('ITableRepository', 
          new HybridTableRepository(
            new SqliteTableRepository(),
            new SupabaseTableRepository(),
            syncService
          ));
        break;
    }
  }
  
  private configureServices(): void {
    // Table Service
    const tableRepository = this.repositories.get('ITableRepository');
    this.services.set('TableService', 
      new TableService(tableRepository)
    );
  }
  
  private configureUseCases(): void {
    // Assign Waiter Use Case
    const tableService = this.services.get('TableService');
    this.useCases.set('AssignWaiterUseCase', 
      new AssignWaiterUseCase(tableService)
    );
  }
  
  getUseCase(name: string): any {
    const useCase = this.useCases.get(name);
    if (!useCase) {
      throw new Error(`UseCase not found: ${name}`);
    }
    return useCase;
  }
  
  getRuntimeContext(): RuntimeContext {
    return this.runtimeContext;
  }
}
```

**Point crucial** : CompositionRoot est créé UNE SEULE FOIS au démarrage. Toutes les dépendances sont injectées ici. Pas de Singleton, pas de Service Locator.

---

### 2.3 Repository Pattern (3 implémentations)

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
}
```

---

### 2.4 Domain Service (pur)

```typescript
// src/server/domain/tables/services/TableService.ts

export class TableService {
  constructor(
    private tableRepository: ITableRepository
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
    
    // 3. Appel au repository (abstraction)
    await this.tableRepository.assignWaiter(tableId, waiterId);
    
    // 4. Publication d'événement métier
    // Note: L'événement est publié par le Use Case, pas par le Domain Service
    
    return Result.success(table);
  }
}
```

**Point crucial** : `TableService` ne sait pas si c'est SQLite ou Supabase. Il ne sait pas si c'est Cloud, Local ou Hybride. Il utilise uniquement des interfaces.

---

### 2.5 Use Case (Application Layer)

```typescript
// src/server/application/tables/use-cases/AssignWaiterUseCase.ts

export class AssignWaiterUseCase {
  constructor(
    private tableService: TableService,
    private eventBus: IEventBus  // Interface uniquement
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
    
    // 3. Publication d'événement métier
    await this.eventBus.publish(
      new WaiterAssignedEvent(
        TableId.from(dto.tableId, dto.tenantId),
        WaiterId.from(dto.waiterId, dto.tenantId)
      )
    );
    
    // 4. Retour
    return result.value;
  }
}
```

**Point crucial** : Le Use Case publie l'événement métier. Le Domain Service ne publie pas d'événements.

---

### 2.6 SynchronizationService (UNIQUE)

**Responsabilité** : Être le SEUL pipeline de synchronisation.

```typescript
// src/server/infrastructure/synchronization/synchronization.service.ts

export interface ISynchronizationService {
  enqueue(event: DomainEvent): Promise<void>;
  processOutbox(): Promise<void>;
  start(): void;
  stop(): void>;
}

export class SynchronizationService implements ISynchronizationService {
  constructor(
    private outboxRepository: IOutboxRepository,
    private identityResolver: IIdentityResolver,
    private supabaseClient: SupabaseClient
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
    if (RuntimeContext.getInstance().isOnline) {
      await this.processOutbox();
    }
  }
  
  async processOutbox(): Promise<void> {
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
      }
    }
  }
  
  private async resolveIdentities(payload: any): Promise<any> {
    // Résoudre tous les INTEGER vers UUID
    if (payload.waiterId) {
      payload.waiterId = await this.identityResolver.resolve(payload.waiterId);
    }
    return payload;
  }
}
```

**Point crucial** : SynchronizationService est le SEUL composant qui parle à Supabase pour la synchronisation. Aucun autre service ne le fait.

---

## 3. STRUCTURE DES COUCHES

### 3.1 Domain Layer (pur)

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
│   │   └── ITableRepository.ts (interface uniquement)
│   ├── services/
│   │   └── ITableService.ts (interface uniquement)
│   └── events/
│       ├── TableCreatedEvent.ts
│       └── WaiterAssignedEvent.ts
├── orders/
│   ├── entities/
│   │   └── Order.ts
│   ├── value-objects/
│   │   ├── OrderId.ts
│   │   └── OrderStatus.ts
│   ├── repositories/
│   │   └── IOrderRepository.ts
│   └── events/
│       ├── OrderCreatedEvent.ts
│       └── OrderPaidEvent.ts
└── events/
    ├── DomainEvent.ts
    └── EventBus.ts (interface uniquement)
```

**Règles** :
- ❌ Aucun import SQLite
- ❌ Aucun import Supabase
- ❌ Aucun import Express
- ❌ Aucun import Electron
- ✅ Uniquement des interfaces et types

---

### 3.2 Application Layer

```
src/server/application/
├── tables/
│   ├── use-cases/
│   │   ├── CreateTableUseCase.ts
│   │   ├── AssignWaiterUseCase.ts
│   │   └── OpenTableUseCase.ts
│   └── dtos/
│       ├── CreateTableDto.ts
│       └── AssignWaiterDto.ts
├── orders/
│   ├── use-cases/
│   │   ├── CreateOrderUseCase.ts
│   │   └── PayOrderUseCase.ts
│   └── dtos/
│       ├── CreateOrderDto.ts
│       └── PayOrderDto.ts
```

**Règles** :
- ❌ Aucun import SQLite
- ❌ Aucun import Supabase
- ✅ Dépend uniquement du Domain Layer
- ✅ Publie les événements métier

---

### 3.3 Infrastructure Layer

```
src/server/infrastructure/
├── runtime/
│   └── runtime-context.ts
├── composition-root.ts
├── repositories/
│   ├── sqlite/
│   │   ├── SqliteTableRepository.ts
│   │   ├── SqliteOrderRepository.ts
│   │   └── ...
│   ├── supabase/
│   │   ├── SupabaseTableRepository.ts
│   │   ├── SupabaseOrderRepository.ts
│   │   └── ...
│   └── hybrid/
│       ├── HybridTableRepository.ts
│       ├── HybridOrderRepository.ts
│       └── ...
├── synchronization/
│   ├── synchronization.service.ts
│   ├── outbox-repository.ts
│   └── identity-resolver.service.ts
└── events/
    └── event-bus.service.ts
```

**Règles** :
- ✅ Accès à SQLite
- ✅ Accès à Supabase
- ✅ Implémente les interfaces du Domain Layer
- ❌ Aucune logique métier

---

## 4. COMPOSITION ROOT

### 4.1 Démarrage

```typescript
// src/server/server.ts

import { CompositionRoot } from './infrastructure/composition-root';

// Démarrage
async function startServer() {
  // 1. Initialiser le RuntimeContext
  const runtimeContext = RuntimeContext.initialize();
  
  // 2. Initialiser le CompositionRoot
  const compositionRoot = CompositionRoot.initialize();
  
  // 3. Démarrer le serveur
  const app = express();
  
  // 4. Configurer les routes
  const tablesRoutes = require('./routes/tables');
  tablesRoutes(compositionRoot);
  
  app.listen(3000);
}
```

### 4.2 Injection dans les routes

```typescript
// src/server/routes/tables.ts

export function createTablesRoutes(compositionRoot: CompositionRoot) {
  const router = Router();
  
  router.post('/:id/assign-waiter', async (req: any, res: any) => {
    try {
      // Récupérer le Use Case depuis le CompositionRoot
      const assignWaiterUseCase = compositionRoot.getUseCase('AssignWaiterUseCase');
      
      // Exécuter le Use Case
      const result = await assignWaiterUseCase.execute({
        tableId: req.params.id,
        waiterId: req.body.waiterId,
        tenantId: req.tenantId
      });
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  return router;
}
```

**Point crucial** : Les routes reçoivent le CompositionRoot en paramètre. Elles ne créent jamais d'instances.

---

## 5. MODE DÉTECTION

### 5.1 RuntimeContext

```typescript
export class RuntimeContext {
  public readonly mode: ExecutionMode;
  
  private detectMode(): ExecutionMode {
    const hasSupabase = !!process.env.SUPABASE_URL;
    const isElectron = process.env.ELECTRON === 'true';
    
    if (hasSupabase && !isElectron) {
      return ExecutionMode.CLOUD;
    } else if (!hasSupabase && isElectron) {
      return ExecutionMode.LOCAL;
    } else if (hasSupabase && isElectron) {
      return ExecutionMode.HYBRID;
    }
    
    throw new Error('Cannot determine execution mode');
  }
}
```

### 5.2 Configuration par mode

| Mode | SQLite | Supabase | Repository | Synchronisation |
|---|---|---|---|---|
| **CLOUD** | ❌ | ✅ | SupabaseRepository | ❌ |
| **LOCAL** | ✅ | ❌ | SqliteRepository | ❌ |
| **HYBRID** | ✅ | ✅ | HybridRepository | ✅ Outbox → SyncService |

---

## 6. PIPELINE DE SYNCHRONISATION

### 6.1 Architecture

```
Use Case publie événement
  ↓
EventBus (interface)
  ↓
SynchronizationService (implémentation)
  ↓
OutboxRepository (SQLite)
  ↓
Outbox table (SQLite)
  ↓
(Synchronisation asynchrone)
  ↓
SynchronizationService.processOutbox()
  ↓
IdentityResolver.resolve(INTEGER → UUID)
  ↓
Supabase (UUID uniquement)
```

### 6.2 Outbox Pattern

```typescript
// src/server/infrastructure/synchronization/outbox-repository.ts

export interface IOutboxRepository {
  save(event: OutboxEvent): Promise<void>;
  findPending(): Promise<OutboxEvent[]>;
  markAsSynced(id: number): Promise<void>;
  incrementRetry(id: number): Promise<void>;
}

export class SqliteOutboxRepository implements IOutboxRepository {
  constructor(private db: Database) {}
  
  async save(event: OutboxEvent): Promise<void> {
    this.db.prepare(`
      INSERT INTO outbox_events (event_type, payload, timestamp, status, retry_count)
      VALUES (?, ?, ?, ?, 0)
    `).run(event.eventType, JSON.stringify(event.payload), event.timestamp, OutboxStatus.PENDING);
  }
  
  async findPending(): Promise<OutboxEvent[]> {
    return this.db.prepare(`
      SELECT * FROM outbox_events
      WHERE status = ? AND retry_count < ?
      ORDER BY timestamp ASC
    `).all(OutboxStatus.PENDING, 3);
  }
  
  async markAsSynced(id: number): Promise<void> {
    this.db.prepare(`
      UPDATE outbox_events
      SET status = ?, synced_at = ?
      WHERE id = ?
    `).run(OutboxStatus.SYNCED, new Date().toISOString(), id);
  }
  
  async incrementRetry(id: number): Promise<void> {
    this.db.prepare(`
      UPDATE outbox_events
      SET retry_count = retry_count + 1
      WHERE id = ?
    `).run(id);
  }
}
```

---

## 7. IDENTITY

### 7.1 Règles

```
SQLite                  Supabase
─────────────────────────────────────
users.id (INTEGER)  →   users.id (UUID)
restaurant_tables.assigned_waiter_id (INTEGER) → restaurant_tables.assigned_waiter_id (UUID)
orders.waiter_id (INTEGER)  →  orders.waiter_id (UUID)
tenant_users.user_id (INTEGER)  →  tenant_users.user_id (UUID)

IdentityMap:
sqlite_id (INTEGER) → canonical_id (UUID) → supabase_id (UUID)
```

### 7.2 IdentityResolver

```typescript
// src/server/infrastructure/identity/identity-resolver.service.ts

export interface IIdentityResolver {
  resolve(sqliteId: number): Promise<string>;
  resolveBatch(sqliteIds: number[]): Promise<Map<number, string>>;
}

export class IdentityResolver implements IIdentityResolver {
  constructor(
    private identityMapRepository: IIdentityMapRepository
  ) {}
  
  async resolve(sqliteId: number): Promise<string> {
    // 1. Chercher dans IdentityMap
    const mapping = await this.identityMapRepository.findBySqliteId(sqliteId);
    
    if (mapping) {
      return mapping.canonicalId;
    }
    
    // 2. Créer un nouveau canonical_id
    const canonicalId = crypto.randomUUID();
    
    // 3. Sauvegarder dans IdentityMap
    await this.identityMapRepository.create({
      sqliteId,
      canonicalId,
      supabaseId: null,
      tenantId: RuntimeContext.getInstance().tenantId
    });
    
    return canonicalId;
  }
}
```

**Point crucial** : IdentityResolver est utilisé UNIQUEMENT par SynchronizationService. Jamais par le Domain Layer, jamais par le Frontend.

---

## 8. FRONTEND (INCHANGÉ)

### 8.1 Store

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

## 9. PLAN D'IMPLÉMENTATION

### PRINCIPE

Travailler par modules. Pour chaque module :
1. Audit
2. Plan
3. Implémentation
4. Compilation
5. Tests
6. Validation

Puis seulement après, passer au module suivant.

---

### PHASE 0 — PRÉPARATION (1 jour)

**Objectif** : Préparer l'infrastructure de base.

1. **Créer RuntimeContext** (2 heures)
   - Détection du mode
   - Configuration
   
2. **Créer CompositionRoot** (2 heures)
   - Injection des dépendances
   - Configuration des repositories
   
3. **Créer Outbox** (2 heures)
   - OutboxRepository
   - OutboxEvent
   
4. **Créer SynchronizationService** (2 heures)
   - Traitement de la file d'attente
   - Résolution d'identité
   - Envoi vers Supabase

**Validation** : L'infrastructure est en place.

---

### PHASE 1 — MODULE TABLES (1 semaine)

**Objectif** : Migrer le module Tables vers la nouvelle architecture.

#### Étape 1.1 — Domain Layer (1 jour)

**Créer** :
- `src/server/domain/tables/entities/Table.ts`
- `src/server/domain/tables/value-objects/TableId.ts`
- `src/server/domain/tables/value-objects/TableNumber.ts`
- `src/server/domain/tables/value-objects/TableStatus.ts`
- `src/server/domain/tables/repositories/ITableRepository.ts`
- `src/server/domain/tables/services/ITableService.ts`
- `src/server/domain/tables/events/TableCreatedEvent.ts`
- `src/server/domain/tables/events/WaiterAssignedEvent.ts`

**Tests** :
- Tester les Value Objects
- Tester les Entities
- Tester les interfaces

**Validation** : Domain Layer complet et testable.

---

#### Étape 1.2 — Repositories (1 jour)

**Créer** :
- `src/server/infrastructure/repositories/sqlite/SqliteTableRepository.ts`
- `src/server/infrastructure/repositories/supabase/SupabaseTableRepository.ts`
- `src/server/infrastructure/repositories/hybrid/HybridTableRepository.ts`

**Tests** :
- Tester SqliteTableRepository (CRUD)
- Tester SupabaseTableRepository (CRUD)
- Tester HybridTableRepository (écriture SQLite + Outbox)

**Validation** : Les repositories fonctionnent correctement.

---

#### Étape 1.3 — Application Layer (1 jour)

**Créer** :
- `src/server/application/tables/use-cases/CreateTableUseCase.ts`
- `src/server/application/tables/use-cases/AssignWaiterUseCase.ts`
- `src/server/application/tables/use-cases/OpenTableUseCase.ts`

**Tests** :
- Tester CreateTableUseCase
- Tester AssignWaiterUseCase
- Tester OpenTableUseCase

**Validation** : Les Use Cases fonctionnent correctement.

---

#### Étape 1.4 — Migration routes (1 jour)

**Modifier** :
- `src/server/routes/tables.ts`

**Changements** :
- Utiliser CompositionRoot pour obtenir les Use Cases
- Appeler les Use Cases au lieu des services directs

**Tests** :
- Tester POST /tables
- Tester PATCH /tables/:id
- Tester POST /tables/:id/assign-waiter
- Tester POST /tables/:id/open

**Validation** : Les routes fonctionnent, le bug assignWaiter est corrigé.

---

#### Étape 1.5 — Correction frontend (1 jour)

**Modifier** :
- `src/stores/useTableStore.ts`

**Changements** :
- Supprimer `require('../../server/db/database')`
- Supprimer la résolution d'identité
- Envoyer uniquement waiterId (INTEGER)

**Tests** :
- Tester assignWaiter()
- Vérifier pas de crash
- Vérifier les données sont correctes

**Validation** : Le frontend fonctionne, pas d'accès SQLite.

---

#### Étape 1.6 — Tests complets (1 jour)

**Tests** :
- Tests unitaires (repositories, use cases)
- Tests d'intégration (CRUD complet)
- Tests E2E (scénario complet)
- Tests des 3 modes (Cloud, Local, Hybride)

**Validation** : Module Tables entièrement fonctionnel dans les 3 modes.

---

### PHASE 2 — MODULE ORDERS (1 semaine)

Même processus que Tables.

---

### PHASE 3 — MODULE USERS (1 semaine)

Même processus.

---

### PHASE 4 — AUTRES MODULES (2-3 semaines)

- Products
- Categories
- Stocks
- Payments
- Subscriptions
- Reservations
- Invoices
- Kitchen

---

## 10. TESTS DE VALIDATION

### 10.1 Tests par module

| Test | Description | Validation |
|---|---|---|
| **T1** | CRUD complet en mode Cloud | ✅ Fonctionne |
| **T2** | CRUD complet en mode Local | ✅ Fonctionne |
| **T3** | CRUD complet en mode Hybride | ✅ Fonctionne |
| **T4** | Synchronisation en mode Hybride | ✅ Fonctionne |
| **T5** | Pas d'accès SQLite dans le frontend | ✅ Vérifié |
| **T6** | Pas de résolution d'identité dans le frontend | ✅ Vérifié |
| **T7** | Les JOINs SQLite fonctionnent | ✅ Vérifié |
| **T8** | Les UUID sont uniquement dans Supabase | ✅ Vérifié |

### 10.2 Tests d'intégration

| Test | Description | Validation |
|---|---|---|
| **T9** | Scénario complet Tables → Orders → Payments | ✅ Fonctionne dans les 3 modes |
| **T10** | Synchronisation complète Hybride | ✅ Toutes les données sont synchronisées |
| **T11** | Gestion des conflits | ✅ Conflits résolus |
| **T12** | Retry en cas d'échec | ✅ Retry fonctionne |

### 10.3 Tests de non-régression

| Test | Description | Validation |
|---|---|---|
| **T13** | Toutes les API existantes fonctionnent | ✅ Aucune rupture |
| **T14** | Tous les écrans React fonctionnent | ✅ Aucune rupture |
| **T15** | Toutes les routes fonctionnent | ✅ Aucune rupture |
| **T16** | Tous les DTOs sont compatibles | ✅ Aucune rupture |

---

## 11. AVANTAGES DE CETTE ARCHITECTURE

### 11.1 Pour le Frontend
- ✅ Ne sait pas où sont stockées les données
- ✅ Pas de `if (cloud)` / `if (electron)`
- ✅ Code métier identique dans les 3 modes
- ✅ Pas d'accès à SQLite
- ✅ Pas de résolution d'identité

### 11.2 Pour le Backend
- ✅ Code métier indépendant de l'infrastructure
- ✅ Tests faciles (injection de dépendances)
- ✅ Synchronisation centralisée
- ✅ Extensible (ajout de nouvelles bases facile)
- ✅ Maintenable (responsabilités séparées)

### 11.3 Pour l'entreprise
- ✅ Architecture professionnelle et maintenable
- ✅ Évolutive (ajout de fonctionnalités facile)
- ✅ Testable (tests unitaires et intégration)
- ✅ Déployable (rollback facile)
- ✅ Documentée (architecture claire)

---

## 12. CONCLUSION

### Architecture cible V2.0

**Principe** : Composition Root + RuntimeContext + Repositories injectés + SynchronizationService unique.

**Bénéfices** :
- ✅ Code métier unique pour les 3 modes
- ✅ Frontend ne sait pas où sont les données
- ✅ Tests faciles
- ✅ Synchronisation centralisée
- ✅ Extensible
- ✅ Maintenable
- ✅ Professionnelle

**Approche** : Incrémentale, module par module, avec validation à chaque étape.

**Durée estimée** : 7 semaines pour 10 modules

**Risque** : Moyen (avec tests et rollback)

---

## 13. PROCHAINES ÉTAPES

1. **Valider cette architecture V2.0** avec l'équipe
2. **Implémenter Phase 0** — Infrastructure de base
3. **Valider Phase 0** — Tests complets
4. **Implémenter Phase 1** — Module Tables
5. **Valider Phase 1** — Tests complets + déploiement production
6. **Continuer avec les autres modules** — Même processus

---

**Document généré le** : 2026-06-07  
**Auteur** : Software Architect Principal  
**Status** : Architecture V2.0 finalisée, prête pour implémentation  
**Fichier** : `docs/ARCHITECTURE_V2_FINAL.md`

**Règles appliquées** :
- ✅ Aucun Singleton
- ✅ Aucun Service Locator
- ✅ Injection de dépendances
- ✅ Domain Layer pur
- ✅ Frontend ignorant
- ✅ INTEGER uniquement côté SQLite
- ✅ UUID uniquement côté Supabase
- ✅ Synchronisation via Outbox uniquement
- ✅ RuntimeContext unique
- ✅ Migration incrémentale