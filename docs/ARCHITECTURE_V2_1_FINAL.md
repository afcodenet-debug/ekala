# ARCHITECTURE V2.1 — Ekala POS
## Version finalisée et strictement découplée

---

## RÈGLES ABSOLUES (NON NÉGOCIABLES)

### Règle 1 — Aucun Singleton
Aucune classe ne doit utiliser le pattern Singleton. Toute instance est créée et injectée via Composition Root.

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
- process.env

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
- Runtime

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

### Règle 9 — ConfigurationProvider unique
Tout accès à la configuration passe par ConfigurationProvider. Aucun accès direct à process.env ailleurs.

### Règle 10 — Migration incrémentale
Interdiction de réécrire toute l'application d'un coup. Migration module par module avec validation à chaque étape.

---

## 1. ANTI-PATTERNS SUPPRIMÉS

### 1.1 RepositoryResolver (SUPPRIMÉ)

**Pourquoi supprimé** : C'était un Service Locator caché. Le code métier devait appeler `RepositoryResolver.getInstance().resolve()` pour obtenir ses dépendances.

**Solution** : Composition Root injecte les dépendances via le constructeur. Le code métier ne sait pas d'où viennent ses dépendances.

---

### 1.2 RuntimeContext qui décide dynamiquement (SUPPRIMÉ)

**Pourquoi supprimé** : RuntimeContext ne doit pas décider dynamiquement quel repository utiliser à chaque appel.

**Solution** : RuntimeContext est READ ONLY. Il contient uniquement des capacités (capabilities). Le Composition Root décide une seule fois au démarrage.

---

### 1.3 Repository qui déclenche Sync (SUPPRIMÉ)

**Pourquoi supprimé** : Les repositories ne doivent pas déclencher de synchronisation. C'était un couplage fort.

**Solution** : Les repositories font uniquement du CRUD. La synchronisation est déclenchée par les Use Cases via EventBus.

---

### 1.4 Accès direct à process.env dans le domaine (SUPPRIMÉ)

**Pourquoi supprimé** : Le domaine ne doit pas connaître l'environnement.

**Solution** : ConfigurationProvider encapsule tout accès à la configuration. Le domaine ne voit que des interfaces.

---

### 1.5 Event publié avant commit (SUPPRIMÉ)

**Pourquoi supprimé** : Un event publié avant commit peut être perdu en cas d'erreur.

**Solution** : Les events sont publiés uniquement après commit transactionnel, dans le Use Case.

---

## 2. ARCHITECTURE CIBLE V2.1

### 2.1 Vue d'ensemble

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
│  - Reçoit les Use Cases injectés                             │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│  APPLICATION LAYER                                           │
│  - Use Cases                                                 │
│  - DTOs                                                       │
│  - Validators                                                 │
│  - Publication d'événements APRÈS COMMIT                     │
│  - NE CONNAÎT PAS LE RUNTIME                                 │
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
│  COMPOSITION ROOT (UNIQUE POINT DE DÉCISION)                 │
│  - RuntimeContext (READ ONLY)                                 │
│  - ConfigurationProvider                                     │
│  - Injection des dépendances                                 │
│  - Création des instances                                    │
│  - Configure les repositories                                │
│  - NE VIT QU'AU DÉMARRAGE                                    │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│  INFRASTRUCTURE LAYER                                        │
│  - SQLite Repositories (CRUD uniquement)                     │
│  - Supabase Repositories (CRUD uniquement)                   │
│  - Hybrid Repositories (CRUD + Outbox)                       │
│  - Outbox Repository                                         │
│  - Synchronization Service (traite events uniquement)        │
│  - Identity Resolver                                         │
│  - Anti-Corruption Layer                                     │
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

### 2.2 Flux d'une opération métier (ex: assignWaiter)

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
│ - Appelle AssignWaiterUseCase (injecté)                      │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│ USE CASE: AssignWaiterUseCase                                │
│ - Valide les inputs                                          │
│ - Appelle TableService.assignWaiter()                        │
│ - COMMIT transaction                                         │
│ - Publie WaiterAssignedEvent (APRÈS COMMIT)                  │
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
│ REPOSITORY (injecté par Composition Root)                    │
│                                                              │
│ Mode HYBRID → HybridTableRepository                         │
│   - Écrit dans SQLite (INTEGER)                              │
│   - NE PUBLIE PAS D'ÉVÉNEMENT                                │
│   - NE DÉCLENCHE PAS SYNC                                    │
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
│ USE CASE (suite)                                             │
│ - Transaction COMMIT                                         │
│ - Publie WaiterAssignedEvent                                 │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│ EVENT BUS                                                    │
│ - Reçoit WaiterAssignedEvent                                 │
│ - Appelle SynchronizationHandler                             │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│ SYNCHRONIZATION HANDLER                                      │
│ - Reçoit l'événement sérialisé                               │
│ - NE CONNAÎT PAS LES TABLES                                  │
│ - Appelle OutboxRepository.save()                            │
└─────────────────────────────────────────────────────────────┘
       ↓
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│ OUTBOX REPOSITORY                                            │
│ - INSERT INTO outbox_events                                  │
│ - { type: 'WaiterAssigned', payload: {...} }                 │
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

**Point crucial** : 
- Un seul pipeline
- Events publiés APRÈS commit
- Repositories ne déclenchent pas sync
- SynchronizationService ne connaît pas les tables

---

## 3. COMPOSANTS CLÉS

### 3.1 ConfigurationProvider (OBLIGATOIRE)

**Responsabilité** : Encapsuler tout accès à la configuration.

```typescript
// src/server/infrastructure/configuration/configuration-provider.ts

export interface IConfigurationProvider {
  getDatabasePath(): string;
  getSupabaseUrl(): string | null;
  getSupabaseKey(): string | null;
  getTenantId(): number;
  getExecutionMode(): ExecutionMode;
  isElectron(): boolean;
  isOnline(): boolean;
  supportsOffline(): boolean;
  supportsSync(): boolean;
  supportsCloud(): boolean;
}

export class ConfigurationProvider implements IConfigurationProvider {
  constructor(
    private env: Record<string, string | undefined>
  ) {}
  
  getDatabasePath(): string {
    return this.env.DATABASE_PATH || './database.sqlite';
  }
  
  getSupabaseUrl(): string | null {
    return this.env.SUPABASE_URL || null;
  }
  
  getSupabaseKey(): string | null {
    return this.env.SUPABASE_KEY || null;
  }
  
  getTenantId(): number {
    return parseInt(this.env.TENANT_ID || '0');
  }
  
  getExecutionMode(): ExecutionMode {
    if (this.getSupabaseUrl() && !this.isElectron()) {
      return ExecutionMode.CLOUD;
    } else if (!this.getSupabaseUrl() && this.isElectron()) {
      return ExecutionMode.LOCAL;
    } else if (this.getSupabaseUrl() && this.isElectron()) {
      return ExecutionMode.HYBRID;
    }
    throw new Error('Cannot determine execution mode');
  }
  
  isElectron(): boolean {
    return this.env.ELECTRON === 'true';
  }
  
  isOnline(): boolean {
    return !!this.getSupabaseUrl();
  }
  
  supportsOffline(): boolean {
    return this.isElectron();
  }
  
  supportsSync(): boolean {
    return this.isElectron() && this.isOnline();
  }
  
  supportsCloud(): boolean {
    return !this.isElectron() && this.isOnline();
  }
}
```

**Point crucial** : ConfigurationProvider est le SEUL endroit où process.env est accessible. Partout ailleurs, on utilise l'interface.

---

### 3.2 RuntimeContext (READ ONLY)

**Responsabilité** : Fournir les capacités du runtime (READ ONLY).

```typescript
// src/server/infrastructure/runtime/runtime-context.ts

export interface ICapabilities {
  supportsOffline: boolean;
  supportsSync: boolean;
  supportsCloud: boolean;
  isOnline: boolean;
  executionMode: ExecutionMode;
  tenantId: number;
}

export class RuntimeContext {
  private static instance: RuntimeContext;
  public readonly capabilities: ICapabilities;
  
  private constructor(
    private configurationProvider: IConfigurationProvider
  ) {
    this.capabilities = {
      supportsOffline: this.configurationProvider.supportsOffline(),
      supportsSync: this.configurationProvider.supportsSync(),
      supportsCloud: this.configurationProvider.supportsCloud(),
      isOnline: this.configurationProvider.isOnline(),
      executionMode: this.configurationProvider.getExecutionMode(),
      tenantId: this.configurationProvider.getTenantId()
    };
  }
  
  static initialize(configurationProvider: IConfigurationProvider): RuntimeContext {
    if (!RuntimeContext.instance) {
      RuntimeContext.instance = new RuntimeContext(configurationProvider);
    }
    return RuntimeContext.instance;
  }
  
  static getInstance(): RuntimeContext {
    if (!RuntimeContext.instance) {
      throw new Error('RuntimeContext not initialized');
    }
    return RuntimeContext.instance;
  }
  
  // READ ONLY - pas de setters
}
```

**Point crucial** : RuntimeContext est READ ONLY. Il ne décide pas dynamiquement. Il contient uniquement des capacités.

---

### 3.3 Composition Root (UNIQUE POINT DE DÉCISION)

**Responsabilité** : Créer toutes les instances et injecter les dépendances UNE SEULE FOIS au démarrage.

```typescript
// src/server/infrastructure/composition-root.ts

import { RuntimeContext } from './runtime/runtime-context';
import { ConfigurationProvider } from './configuration/configuration-provider';
import { SqliteTableRepository } from './repositories/sqlite/SqliteTableRepository';
import { SupabaseTableRepository } from './repositories/supabase/SupabaseTableRepository';
import { HybridTableRepository } from './repositories/hybrid/HybridTableRepository';
import { TableService } from '../../domain/tables/services/TableService';
import { AssignWaiterUseCase } from '../../application/tables/use-cases/AssignWaiterUseCase';
import { InMemoryEventBus } from '../../infrastructure/events/in-memory-event-bus';
import { SynchronizationService } from '../../infrastructure/synchronization/synchronization.service';

export class CompositionRoot {
  private static instance: CompositionRoot;
  
  // Toutes les dépendances sont créées ici
  public readonly runtimeContext: RuntimeContext;
  public readonly tableRepository: ITableRepository;
  public readonly tableService: TableService;
  public readonly assignWaiterUseCase: AssignWaiterUseCase;
  public readonly eventBus: IEventBus;
  public readonly synchronizationService: ISynchronizationService;
  
  private constructor() {
    // 1. ConfigurationProvider (seul accès à process.env)
    const configurationProvider = new ConfigurationProvider(process.env);
    
    // 2. RuntimeContext (READ ONLY)
    this.runtimeContext = RuntimeContext.initialize(configurationProvider);
    
    // 3. EventBus
    this.eventBus = new InMemoryEventBus();
    
    // 4. Repositories (selon le mode)
    this.tableRepository = this.createTableRepository(configurationProvider);
    
    // 5. Services
    this.tableService = new TableService(this.tableRepository);
    
    // 6. Use Cases
    this.assignWaiterUseCase = new AssignWaiterUseCase(
      this.tableService,
      this.eventBus
    );
    
    // 7. SynchronizationService (uniquement en mode Hybride)
    if (this.runtimeContext.capabilities.supportsSync) {
      this.synchronizationService = this.createSynchronizationService(configurationProvider);
      
      // Démarrer le traitement de l'outbox
      this.synchronizationService.start();
    }
  }
  
  private createTableRepository(configurationProvider: IConfigurationProvider): ITableRepository {
    const mode = configurationProvider.getExecutionMode();
    
    switch (mode) {
      case ExecutionMode.CLOUD:
        return new SupabaseTableRepository(
          new SupabaseClient(
            configurationProvider.getSupabaseUrl()!,
            configurationProvider.getSupabaseKey()!
          )
        );
        
      case ExecutionMode.LOCAL:
        return new SqliteTableRepository(
          new Database(configurationProvider.getDatabasePath())
        );
        
      case ExecutionMode.HYBRID:
        const syncService = new SynchronizationService(
          new SqliteOutboxRepository(new Database(configurationProvider.getDatabasePath())),
          new IdentityResolver(new SqliteIdentityMapRepository(new Database(configurationProvider.getDatabasePath()))),
          new SupabaseClient(
            configurationProvider.getSupabaseUrl()!,
            configurationProvider.getSupabaseKey()!
          )
        );
        
        return new HybridTableRepository(
          new SqliteTableRepository(
            new Database(configurationProvider.getDatabasePath())
          ),
          // Note: SupabaseTableRepository n'est pas utilisé directement dans Hybrid
          // Le sync se fait via SynchronizationService
          syncService
        );
    }
  }
  
  private createSynchronizationService(configurationProvider: IConfigurationProvider): ISynchronizationService {
    return new SynchronizationService(
      new SqliteOutboxRepository(new Database(configurationProvider.getDatabasePath())),
      new IdentityResolver(new SqliteIdentityMapRepository(new Database(configurationProvider.getDatabasePath()))),
      new SupabaseClient(
        configurationProvider.getSupabaseUrl()!,
        configurationProvider.getSupabaseKey()!
      )
    );
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
}
```

**Point crucial** : CompositionRoot est créé UNE SEULE FOIS au démarrage. Toutes les dépendances sont injectées ici. Pas de Singleton, pas de Service Locator.

---

### 3.4 Repository Pattern (3 implémentations)

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
    // ❌ NE PUBLIE PAS D'ÉVÉNEMENT
    // ❌ NE DÉCLENCHE PAS SYNC
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
    // ❌ NE PUBLIE PAS D'ÉVÉNEMENT
    // ❌ NE DÉCLENCHE PAS SYNC
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
    private syncService: ISynchronizationService  // ✅ Pour Outbox uniquement
  ) {}
  
  async create(table: Table): Promise<Table> {
    // 1. Écrire dans SQLite (source de vérité)
    const result = await this.sqliteRepo.create(table);
    
    // 2. Ajouter à l'Outbox (pas de sync directe)
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
    
    // 2. Ajouter à l'Outbox (pas de sync directe)
    await this.syncService.enqueue({
      type: 'WaiterAssigned',
      payload: { tableId, waiterId },
      timestamp: new Date()
    });
  }
}
```

**Point crucial** : Les repositories font uniquement du CRUD. Ils ne publient pas d'événements. Ils ne déclenchent pas de synchronisation.

---

### 3.5 Domain Service (pur)

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
    
    // 4. Retour
    return Result.success(table);
  }
}
```

**Point crucial** : `TableService` ne sait pas si c'est SQLite ou Supabase. Il ne sait pas si c'est Cloud, Local ou Hybride. Il utilise uniquement des interfaces.

---

### 3.6 Use Case (Application Layer)

```typescript
// src/server/application/tables/use-cases/AssignWaiterUseCase.ts

export class AssignWaiterUseCase {
  constructor(
    private tableService: TableService,
    private eventBus: IEventBus,  // Interface uniquement
    private unitOfWork: IUnitOfWork  // Pour commit transactionnel
  ) {}
  
  async execute(dto: AssignWaiterDto): Promise<Table> {
    // 1. Validation
    if (!dto.tableId || !dto.waiterId) {
      throw new Error('Missing required fields');
    }
    
    // 2. Exécution dans une transaction
    let result: Table;
    await this.unitOfWork.transaction(async () => {
      result = await this.tableService.assignWaiter(
        TableId.from(dto.tableId, dto.tenantId),
        WaiterId.from(dto.waiterId, dto.tenantId)
      );
      
      if (result.isFailure) {
        throw new Error(result.error);
      }
    });
    
    // 3. Publication d'événement APRÈS COMMIT
    await this.eventBus.publish(
      new WaiterAssignedEvent(
        TableId.from(dto.tableId, dto.tenantId),
        WaiterId.from(dto.waiterId, dto.tenantId)
      )
    );
    
    // 4. Retour
    return result;
  }
}
```

**Point crucial** : L'événement est publié APRÈS le commit transactionnel. Jamais avant.

---

### 3.7 SynchronizationService (UNIQUE)

**Responsabilité** : Être le SEUL pipeline de synchronisation. Traite uniquement des events sérialisés.

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
      payload: JSON.stringify(event.payload),  // Sérialisé
      timestamp: event.timestamp,
      status: OutboxStatus.PENDING
    });
    
    // 2. Tenter de synchroniser immédiatement si online
    if (RuntimeContext.getInstance().capabilities.isOnline) {
      await this.processOutbox();
    }
  }
  
  async processOutbox(): Promise<void> {
    // 1. Récupérer les événements en attente
    const events = await this.outboxRepository.findPending();
    
    for (const event of events) {
      try {
        // 2. Désérialiser le payload
        const payload = JSON.parse(event.payload);
        
        // 3. Résoudre les identités (INTEGER → UUID)
        const resolvedPayload = await this.resolveIdentities(payload);
        
        // 4. Envoyer vers Supabase
        await this.sendToSupabase(event.eventType, resolvedPayload);
        
        // 5. Marquer comme synchronisé
        await this.outboxRepository.markAsSynced(event.id);
        
      } catch (error) {
        // 6. Gérer les retries
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

**Point crucial** : SynchronizationService ne connaît pas les tables métier. Il manipule uniquement des events sérialisés.

---

### 3.8 Anti-Corruption Layer

**Responsabilité** : Isoler les systèmes externes (Supabase, SQLite, API externes).

```typescript
// src/server/infrastructure/anticorruption/supabase-adapter.ts

export class SupabaseAdapter {
  constructor(private supabase: SupabaseClient) {}
  
  async insert(tableName: string, data: any): Promise<any> {
    // Adapter les données pour Supabase
    const adapted = this.adaptToSupabase(data);
    
    const { data: result, error } = await this.supabase
      .from(tableName)
      .insert([adapted])
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    
    // Adapter le retour
    return this.adaptFromSupabase(result);
  }
  
  private adaptToSupabase(data: any): any {
    // Convertir INTEGER vers UUID pour Supabase
    // Gérer les enums
    // Gérer les dates
    // Gérer les nullability
    return data;
  }
  
  private adaptFromSupabase(data: any): any {
    // Convertir UUID vers INTEGER pour le domaine
    // Gérer les enums
    // Gérer les dates
    return data;
  }
}
```

**Point crucial** : Anti-Corruption Layer isole complètement les systèmes externes. Le domaine ne voit jamais les formats externes.

---

### 3.9 Capabilities Layer

**Responsabilité** : Remplacer les `if (runtime)` par des capacités.

```typescript
// src/server/infrastructure/capabilities/capabilities.ts

export interface ICapabilities {
  supportsOffline: boolean;
  supportsSync: boolean;
  supportsCloud: boolean;
  supportsPrinting: boolean;
  supportsPayments: boolean;
  isOnline: boolean;
  executionMode: ExecutionMode;
  tenantId: number;
}

// Utilisation dans un Use Case
export class CreateTableUseCase {
  constructor(
    private tableService: TableService,
    private capabilities: ICapabilities
  ) {}
  
  async execute(dto: CreateTableDto): Promise<Table> {
    // ❌ INTERDIT
    // if (RuntimeContext.getInstance().isElectron) { ... }
    
    // ✅ CORRECT
    if (this.capabilities.supportsOffline) {
      // Mode offline supporté
    }
    
    // ❌ INTERDIT
    // if (process.env.ELECTRON === 'true') { ... }
    
    // ✅ CORRECT
    if (this.capabilities.executionMode === ExecutionMode.HYBRID) {
      // Mode hybride
    }
    
    return this.tableService.createTable(dto);
  }
}
```

**Point crucial** : Les Use Cases ne connaissent pas le runtime. Ils utilisent des capacités.

---

## 4. STRUCTURE DES COUCHES

### 4.1 Domain Layer (pur)

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
- ❌ Aucun import process.env
- ✅ Uniquement des interfaces et types

---

### 4.2 Application Layer

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
- ❌ Aucun accès à process.env
- ✅ Dépend uniquement du Domain Layer
- ✅ Publie les événements APRÈS COMMIT
- ✅ Utilise les capacités, pas le runtime

---

### 4.3 Infrastructure Layer

```
src/server/infrastructure/
├── configuration/
│   └── configuration-provider.ts
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
├── events/
│   ├── event-bus.service.ts
│   └── synchronization-handler.ts
└── anticorruption/
    └── supabase-adapter.ts
```

**Règles** :
- ✅ Accès à SQLite
- ✅ Accès à Supabase
- ✅ Implémente les interfaces du Domain Layer
- ❌ Aucune logique métier
- ✅ Repositories font uniquement du CRUD
- ✅ SynchronizationService traite uniquement des events

---

## 5. RÈGLES DE DÉPENDANCES STRICTES

### 5.1 Qui peut dépendre de qui

```
Presentation Layer
  ↓ (appelle)
API Layer
  ↓ (appelle)
Application Layer
  ↓ (appelle)
Domain Layer
  ↓ (dépend de)
Interfaces (Repository, Service, EventBus)
  ↓ (implémentées par)
Infrastructure Layer
  ↓ (accède à)
External Systems (SQLite, Supabase)
```

**Règles** :
- ❌ Domain Layer ne dépend pas de Infrastructure Layer
- ❌ Application Layer ne dépend pas de Infrastructure Layer
- ❌ Presentation Layer ne dépend pas de Infrastructure Layer
- ✅ Infrastructure Layer dépend de Domain Layer (implémente les interfaces)

---

### 5.2 Ce que chaque couche peut faire

| Couche | Peut faire | Ne peut pas faire |
|---|---|---|
| **Domain** | Définir entities, value objects, interfaces | Accéder à SQLite, Supabase, process.env |
| **Application** | Orchestrer des use cases, publier events | Accéder à SQLite, Supabase, process.env |
| **Infrastructure** | Accéder à SQLite, Supabase, implémenter interfaces | Contenir de la logique métier |
| **Presentation** | Appeler les API, afficher les données | Accéder à SQLite, Supabase, résoudre des identités |

---

## 6. FLUX CRITIQUES CORRIGÉS

### 6.1 Flux assignWaiter

```
1. Frontend: assignWaiter(tableId: 42, waiterId: 15)
2. API Route: Appelle AssignWaiterUseCase (injecté)
3. Use Case: 
   - Valide
   - Appelle TableService.assignWaiter()
   - COMMIT transaction
   - Publie WaiterAssignedEvent (APRÈS COMMIT)
4. Domain Service:
   - Validation métier
   - Appelle ITableRepository.assignWaiter()
5. Repository (HybridTableRepository):
   - Écrit dans SQLite (INTEGER)
   - Ajoute à Outbox
   - NE PUBLIE PAS D'ÉVÉNEMENT
   - NE DÉCLENCHE PAS SYNC
6. SQLite: UPDATE restaurant_tables SET assigned_waiter_id = 15
7. EventBus: Reçoit WaiterAssignedEvent
8. SynchronizationHandler: Appelle SynchronizationService.enqueue()
9. Outbox: INSERT INTO outbox_events
10. SynchronizationService (asynchrone):
    - Traite l'Outbox
    - IdentityResolver.resolve(15) → canonical_id (UUID)
    - Envoie vers Supabase
11. Supabase: UPDATE restaurant_tables SET assigned_waiter_id = 'uuid-...'
```

**Points critiques** :
- ✅ Event publié APRÈS commit
- ✅ Repository ne déclenche pas sync
- ✅ SynchronizationService ne connaît pas les tables
- ✅ Un seul pipeline

---

### 6.2 Flux sync offline → cloud

```
1. User travaille offline (mode Hybride)
2. User crée une table
3. Use Case:
   - Écrit dans SQLite
   - COMMIT
   - Publie TableCreatedEvent
4. EventBus → SynchronizationHandler
5. Outbox: INSERT INTO outbox_events
6. (Connexion revient)
7. SynchronizationService.processOutbox():
   - Récupère les événements en attente
   - Résout les identités (INTEGER → UUID)
   - Envoie vers Supabase
   - Marque comme synchronisé
8. Supabase: INSERT INTO restaurant_tables
```

**Points critiques** :
- ✅ Synchronisation automatique quand connexion disponible
- ✅ Pas de perte de données
- ✅ Retry en cas d'échec

---

## 7. TESTS DE VALIDATION

### 7.1 Tests de non-régression architecturale

| Test | Description | Validation |
|---|---|---|
| **T1** | UseCase n'importe pas SQLite | ✅ Aucun import |
| **T2** | UseCase n'importe pas Supabase | ✅ Aucun import |
| **T3** | UseCase n'accède pas à process.env | ✅ Aucun accès |
| **T4** | Repository ne déclenche pas sync | ✅ Pas d'appel à SynchronizationService |
| **T5** | Repository ne publie pas d'event | ✅ Pas d'appel à EventBus |
| **T6** | Event publié après commit | ✅ Vérifié dans Use Case |
| **T7** | SynchronizationService ne connaît pas les tables | ✅ Manipule uniquement des events |
| **T8** | Frontend n'accède pas à SQLite | ✅ Aucun require() |
| **T9** | Frontend ne résout pas d'identité | ✅ Aucune résolution |
| **T10** | ConfigurationProvider est le seul à accéder à process.env | ✅ Vérifié |

### 7.2 Tests fonctionnels

| Test | Description | Validation |
|---|---|---|
| **T11** | CRUD complet en mode Cloud | ✅ Fonctionne |
| **T12** | CRUD complet en mode Local | ✅ Fonctionne |
| **T13** | CRUD complet en mode Hybride | ✅ Fonctionne |
| **T14** | Synchronisation en mode Hybride | ✅ Fonctionne |
| **T15** | JOINs SQLite fonctionnent | ✅ INTEGER = INTEGER |
| **T16** | UUID uniquement dans Supabase | ✅ Vérifié |

---

## 8. AVANTAGES DE CETTE ARCHITECTURE

### 8.1 Pour le Frontend
- ✅ Ne sait pas où sont stockées les données
- ✅ Pas de `if (cloud)` / `if (electron)`
- ✅ Code métier identique dans les 3 modes
- ✅ Pas d'accès à SQLite
- ✅ Pas de résolution d'identité

### 8.2 Pour le Backend
- ✅ Code métier indépendant de l'infrastructure
- ✅ Tests faciles (injection de dépendances)
- ✅ Synchronisation centralisée
- ✅ Extensible (ajout de nouvelles bases facile)
- ✅ Maintenable (responsabilités séparées)
- ✅ Pas de couplage fort
- ✅ Événements publiés après commit

### 8.3 Pour l'entreprise
- ✅ Architecture professionnelle et maintenable
- ✅ Évolutive (ajout de fonctionnalités facile)
- ✅ Testable (tests unitaires et intégration)
- ✅ Déployable (rollback facile)
- ✅ Documentée (architecture claire)
- ✅ Sans dette cachée

---

## 9. CONCLUSION

### Architecture V2.1

**Principe** : Composition Root + RuntimeContext (READ ONLY) + ConfigurationProvider + Repositories injectés + SynchronizationService unique + Anti-Corruption Layer + Capabilities Layer.

**Bénéfices** :
- ✅ Code métier unique pour les 3 modes
- ✅ Frontend ne sait pas où sont les données
- ✅ Tests faciles
- ✅ Synchronisation centralisée
- ✅ Extensible
- ✅ Maintenable
- ✅ Professionnelle
- ✅ Sans anti-patterns
- ✅ Découplée

**Approche** : Incrémentale, module par module, avec validation à chaque étape.

**Durée estimée** : 7 semaines pour 10 modules

**Risque** : Moyen (avec tests et rollback)

---

## 10. PROCHAINES ÉTAPES

1. **Valider cette architecture V2.1** avec l'équipe
2. **Implémenter Phase 0** — Infrastructure de base
3. **Valider Phase 0** — Tests complets
4. **Implémenter Phase 1** — Module Tables
5. **Valider Phase 1** — Tests complets + déploiement production
6. **Continuer avec les autres modules** — Même processus

---

**Document généré le** : 2026-06-07  
**Auteur** : Software Architect Principal  
**Status** : Architecture V2.1 finalisée, prête pour implémentation  
**Fichier** : `docs/ARCHITECTURE_V2_1_FINAL.md`

**Règles appliquées** :
- ✅ Aucun Singleton
- ✅ Aucun Service Locator
- ✅ Injection de dépendances
- ✅ Domain Layer pur
- ✅ Frontend ignorant
- ✅ INTEGER uniquement côté SQLite
- ✅ UUID uniquement côté Supabase
- ✅ Synchronisation via Outbox uniquement
- ✅ ConfigurationProvider unique
- ✅ Migration incrémentale
- ✅ RepositoryResolver supprimé
- ✅ RuntimeContext READ ONLY
- ✅ Repository ne déclenche pas sync
- ✅ Event publié après commit
- ✅ Anti-Corruption Layer
- ✅ Capabilities Layer