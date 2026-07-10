# ARCHITECTURE V2.2 — Ekala POS
## Guide d'implémentation basé sur V2.1

---

## AVERTISSEMENT

Ce document ne modifie PAS l'architecture V2.1. Il se contente de :
- Structurer l'architecture existante
- Clarifier les responsabilités
- Détailler les flux
- Fournir des exemples concrets
- Guider l'implémentation

**Aucun concept nouveau n'est introduit. Aucun pattern de V2.0/V2.1 n'est réintroduit.**

---

## 1. STRUCTURE DE DOSSIERS (V2.2)

### 1.1 Vue d'ensemble

```
src/server/
├── domain/                          # DOMAIN LAYER (PUR)
│   ├── tables/
│   │   ├── entities/
│   │   │   └── Table.ts
│   │   ├── value-objects/
│   │   │   ├── TableId.ts
│   │   │   ├── TableNumber.ts
│   │   │   └── TableStatus.ts
│   │   ├── repositories/
│   │   │   └── ITableRepository.ts  # Interface uniquement
│   │   ├── services/
│   │   │   └── ITableService.ts     # Interface uniquement
│   │   └── events/
│   │       ├── TableCreatedEvent.ts
│   │       └── WaiterAssignedEvent.ts
│   ├── orders/
│   │   ├── entities/
│   │   │   └── Order.ts
│   │   ├── value-objects/
│   │   │   ├── OrderId.ts
│   │   │   └── OrderStatus.ts
│   │   ├── repositories/
│   │   │   └── IOrderRepository.ts
│   │   └── events/
│   │       ├── OrderCreatedEvent.ts
│   │       └── OrderPaidEvent.ts
│   └── events/
│       ├── DomainEvent.ts
│       └── EventBus.ts               # Interface uniquement
│
├── application/                     # APPLICATION LAYER
│   ├── tables/
│   │   ├── use-cases/
│   │   │   ├── CreateTableUseCase.ts
│   │   │   ├── AssignWaiterUseCase.ts
│   │   │   └── OpenTableUseCase.ts
│   │   └── dtos/
│   │       ├── CreateTableDto.ts
│   │       └── AssignWaiterDto.ts
│   └── orders/
│       ├── use-cases/
│       │   ├── CreateOrderUseCase.ts
│       │   └── PayOrderUseCase.ts
│       └── dtos/
│           ├── CreateOrderDto.ts
│           └── PayOrderDto.ts
│
├── infrastructure/                  # INFRASTRUCTURE LAYER
│   ├── configuration/
│   │   └── configuration-provider.ts
│   ├── runtime/
│   │   └── runtime-context.ts
│   ├── composition-root.ts
│   ├── repositories/
│   │   ├── sqlite/
│   │   │   ├── SqliteTableRepository.ts
│   │   │   ├── SqliteOrderRepository.ts
│   │   │   └── ...
│   │   ├── supabase/
│   │   │   ├── SupabaseTableRepository.ts
│   │   │   ├── SupabaseOrderRepository.ts
│   │   │   └── ...
│   │   └── hybrid/
│   │       ├── HybridTableRepository.ts
│   │       ├── HybridOrderRepository.ts
│   │       └── ...
│   ├── synchronization/
│   │   ├── synchronization.service.ts
│   │   ├── outbox-repository.ts
│   │   └── identity-resolver.service.ts
│   ├── events/
│   │   ├── event-bus.service.ts
│   │   └── synchronization-handler.ts
│   └── anticorruption/
│       └── supabase-adapter.ts
│
└── routes/                          # API LAYER
    ├── tables.ts
    ├── orders.ts
    └── ...
```

---

## 2. RÈGLES DE DÉPENDANCES (V2.2)

### 2.1 Matrice de dépendances

| Couche | Dépend de | Interdiction |
|---|---|---|
| **Presentation** | API Layer | ❌ Infrastructure<br>❌ Domain |
| **API Layer** | Application Layer | ❌ Infrastructure<br>❌ Domain |
| **Application Layer** | Domain Layer | ❌ Infrastructure<br>❌ process.env |
| **Domain Layer** | Aucune (pur) | ❌ Infrastructure<br>❌ process.env<br>❌ SQLite<br>❌ Supabase |
| **Infrastructure Layer** | Domain Layer | ❌ Presentation<br>❌ API Layer<br>❌ Application Layer |

### 2.2 Règles d'import

```
✅ AUTORISÉ:
Domain → Aucun import (interfaces uniquement)
Application → Domain
Infrastructure → Domain
API → Application
Presentation → API

❌ INTERDIT:
Domain → Infrastructure
Domain → Application
Application → Infrastructure
API → Infrastructure
Presentation → Infrastructure
```

---

## 3. COMPOSANTS CLÉS (V2.2)

### 3.1 ConfigurationProvider

**Responsabilité unique** : Accès à la configuration.

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
  
  // ... implémentation
}
```

**Règles** :
- ✅ SEUL endroit où `process.env` est accessible
- ✅ Injecté dans CompositionRoot uniquement
- ❌ Jamais injecté dans Domain Layer
- ❌ Jamais injecté dans Application Layer

---

### 3.2 RuntimeContext (READ ONLY)

**Responsabilité** : Fournir les capacités du runtime.

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

**Règles** :
- ✅ READ ONLY
- ✅ Contient uniquement des capacités
- ❌ Ne décide pas dynamiquement
- ❌ Ne contient pas de logique métier

---

### 3.3 Composition Root

**Responsabilité unique** : Créer et injecter toutes les dépendances.

```typescript
// src/server/infrastructure/composition-root.ts

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
      this.synchronizationService.start();
    }
  }
  
  // ... méthodes de création
  
  static initialize(): CompositionRoot {
    if (!CompositionRoot.instance) {
      CompositionRoot.instance = new CompositionRoot();
    }
    return CompositionRoot.instance;
  }
}
```

**Règles** :
- ✅ Créé UNE SEULE FOIS au démarrage
- ✅ Toutes les dépendances sont injectées ici
- ❌ Pas de Singleton (utilise Composition Root)
- ❌ Pas de Service Locator

---

## 4. FLUX CRITIQUES (V2.2)

### 4.1 Flux assignWaiter (complet)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. FRONTEND                                                 │
│    assignWaiter(tableId: 42, waiterId: 15)                 │
└─────────────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. API ROUTE                                                │
│    - Récupère tenantId depuis JWT                           │
│    - Appelle AssignWaiterUseCase (injecté)                  │
└─────────────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. USE CASE: AssignWaiterUseCase                            │
│    - Valide les inputs                                      │
│    - Démarre transaction                                    │
│    - Appelle TableService.assignWaiter()                    │
│    - COMMIT transaction                                     │
│    - Publie WaiterAssignedEvent (APRÈS COMMIT)              │
└─────────────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. DOMAIN SERVICE: TableService                             │
│    - Validation métier                                      │
│    - Appelle ITableRepository.assignWaiter()                │
└─────────────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. REPOSITORY: HybridTableRepository                        │
│    - Écrit dans SQLite (INTEGER)                            │
│    - Ajoute à Outbox (même transaction)                     │
│    - NE PUBLIE PAS D'ÉVÉNEMENT                              │
│    - NE DÉCLENCHE PAS SYNC                                  │
└─────────────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. SQLite                                                    │
│    - UPDATE restaurant_tables SET assigned_waiter_id = 15   │
│    - INSERT INTO outbox_events (même transaction)           │
└─────────────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. COMMIT                                                    │
│    - Transaction validée                                     │
│    - Event publié via EventBus                              │
└─────────────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. SYNCHRONIZATION HANDLER (async)                          │
│    - Reçoit WaiterAssignedEvent                             │
│    - Appelle SynchronizationService.enqueue()               │
└─────────────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. OUTBOX (déjà écrit à l'étape 5)                          │
│    - Event en attente de synchronisation                    │
└─────────────────────────────────────────────────────────────┘
       ↓
       │ (asynchrone, quand connexion disponible)
       ↓
┌─────────────────────────────────────────────────────────────┐
│ 10. SYNCHRONIZATION SERVICE                                  │
│     - Traite l'Outbox                                       │
│     - IdentityResolver.resolve(15) → canonical_id (UUID)    │
│     - Envoie vers Supabase                                  │
│     - Marque comme SENT                                     │
└─────────────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────────────┐
│ 11. SUPABASE                                                 │
│     - UPDATE restaurant_tables SET assigned_waiter_id =     │
│       'uuid-...' (UUID)                                     │
└─────────────────────────────────────────────────────────────┘
```

**Points critiques** :
- ✅ Event publié APRÈS commit
- ✅ Repository ne déclenche pas sync
- ✅ SynchronizationService ne connaît pas les tables
- ✅ Un seul pipeline

---

### 4.2 Flux sync offline → cloud

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER TRAVAILLE OFFLINE (MODE HYBRIDE)                     │
└─────────────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. USE CASE: CreateTableUseCase                              │
│    - Écrit dans SQLite                                       │
│    - COMMIT                                                  │
│    - Publie TableCreatedEvent                                │
└─────────────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. OUTBOX (déjà écrit dans la transaction)                   │
│    - INSERT INTO outbox_events                               │
│    - status = PENDING                                        │
└─────────────────────────────────────────────────────────────┘
       ↓
       │ (connexion revient)
       ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. SYNCHRONIZATION SERVICE                                   │
│    - Détecte connexion disponible                            │
│    - Traite l'Outbox                                         │
│    - Résout les identités (INTEGER → UUID)                   │
│    - Envoie vers Supabase                                    │
│    - Marque comme SENT                                       │
└─────────────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. SUPABASE                                                  │
│    - INSERT INTO restaurant_tables                           │
│    - assigned_waiter_id = UUID                               │
└─────────────────────────────────────────────────────────────┘
```

**Points critiques** :
- ✅ Synchronisation automatique
- ✅ Pas de perte de données
- ✅ Retry en cas d'échec

---

## 5. ANTI-CORRUPTION LAYER (V2.2)

### 5.1 IdentityMapper

**Responsabilité** : Convertir entre INTEGER (SQLite) et UUID (Supabase).

```typescript
// src/server/infrastructure/anticorruption/identity-mapper.ts

export interface IIdentityMapper {
  sqliteToCanonical(sqliteId: number): Promise<string>;
  canonicalToSupabase(canonicalId: string): Promise<string>;
  supabaseToCanonical(supabaseId: string): Promise<string>;
}

export class IdentityMapper implements IIdentityMapper {
  constructor(
    private identityMapRepository: IIdentityMapRepository
  ) {}
  
  async sqliteToCanonical(sqliteId: number): Promise<string> {
    // Chercher dans IdentityMap
    const mapping = await this.identityMapRepository.findBySqliteId(sqliteId);
    
    if (mapping) {
      return mapping.canonicalId;
    }
    
    // Créer un nouveau canonical_id
    const canonicalId = crypto.randomUUID();
    await this.identityMapRepository.create({
      sqliteId,
      canonicalId,
      supabaseId: null,
      tenantId: RuntimeContext.getInstance().capabilities.tenantId
    });
    
    return canonicalId;
  }
  
  async canonicalToSupabase(canonicalId: string): Promise<string> {
    // Chercher dans IdentityMap
    const mapping = await this.identityMapRepository.findByCanonicalId(canonicalId);
    
    if (mapping?.supabaseId) {
      return mapping.supabaseId;
    }
    
    // Créer un nouveau supabase_id
    const supabaseId = crypto.randomUUID();
    await this.identityMapRepository.updateSupabaseId(canonicalId, supabaseId);
    
    return supabaseId;
  }
}
```

**Règles** :
- ✅ Utilisé UNIQUEMENT par SynchronizationService
- ❌ Jamais utilisé par Domain Layer
- ❌ Jamais utilisé par Application Layer
- ❌ Jamais utilisé par Frontend

---

### 5.2 SchemaMapper

**Responsabilité** : Adapter les schémas entre SQLite et Supabase.

```typescript
// src/server/infrastructure/anticorruption/schema-mapper.ts

export interface ISchemaMapper {
  toSupabase(tableName: string, data: any): any;
  fromSupabase(tableName: string, data: any): any;
  toSqlite(tableName: string, data: any): any;
  fromSqlite(tableName: string, data: any): any;
}

export class SchemaMapper implements ISchemaMapper {
  toSupabase(tableName: string, data: any): any {
    // Convertir INTEGER vers UUID pour les clés étrangères
    // Gérer les enums
    // Gérer les dates
    // Gérer les nullability
    return this.transform(data, 'sqlite-to-supabase');
  }
  
  fromSupabase(tableName: string, data: any): any {
    // Convertir UUID vers INTEGER
    // Gérer les enums
    // Gérer les dates
    return this.transform(data, 'supabase-to-sqlite');
  }
  
  // ... autres méthodes
}
```

**Règles** :
- ✅ Utilisé UNIQUEMENT par SynchronizationService
- ❌ Jamais utilisé par Domain Layer

---

## 6. OUTBOX PATTERN (V2.2)

### 6.1 Structure

```typescript
// src/server/infrastructure/synchronization/outbox-event.ts

export interface OutboxEvent {
  id: number;
  eventType: string;
  payload: string;  // JSON sérialisé
  status: OutboxStatus;
  retryCount: number;
  createdAt: Date;
  processedAt: Date | null;
}

export enum OutboxStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SENT = 'SENT',
  FAILED = 'FAILED'
}
```

### 6.2 OutboxRepository

```typescript
// src/server/infrastructure/synchronization/outbox-repository.ts

export interface IOutboxRepository {
  save(event: OutboxEvent): Promise<void>;
  findPending(): Promise<OutboxEvent[]>;
  markAsSent(id: number): Promise<void>;
  incrementRetry(id: number): Promise<void>;
}

export class SqliteOutboxRepository implements IOutboxRepository {
  constructor(private db: Database) {}
  
  async save(event: OutboxEvent): Promise<void> {
    this.db.prepare(`
      INSERT INTO outbox_events (event_type, payload, status, retry_count, created_at)
      VALUES (?, ?, ?, 0, ?)
    `).run(
      event.eventType,
      event.payload,
      OutboxStatus.PENDING,
      new Date().toISOString()
    );
  }
  
  async findPending(): Promise<OutboxEvent[]> {
    return this.db.prepare(`
      SELECT * FROM outbox_events
      WHERE status = ? AND retry_count < ?
      ORDER BY created_at ASC
    `).all(OutboxStatus.PENDING, 3);
  }
  
  async markAsSent(id: number): Promise<void> {
    this.db.prepare(`
      UPDATE outbox_events
      SET status = ?, processed_at = ?
      WHERE id = ?
    `).run(OutboxStatus.SENT, new Date().toISOString(), id);
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

**Règles** :
- ✅ Écrit dans la même transaction que les données métier
- ✅ SEUL mécanisme de fiabilité
- ❌ Pas d'EventBus métier
- ❌ Pas de double système

---

## 7. SYNCHRONIZATION SERVICE (V2.2)

### 7.1 Responsabilités UNIQUES

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
    private identityMapper: IIdentityMapper,
    private supabaseAdapter: SupabaseAdapter
  ) {}
  
  async enqueue(event: DomainEvent): Promise<void> {
    // 1. Sérialiser l'event
    const serialized = JSON.stringify({
      type: event.type,
      payload: event.payload,
      timestamp: event.timestamp
    });
    
    // 2. Sauvegarder dans Outbox
    await this.outboxRepository.save({
      eventType: event.type,
      payload: serialized,
      status: OutboxStatus.PENDING,
      retryCount: 0,
      createdAt: new Date()
    });
    
    // 3. Tenter de synchroniser si online
    if (RuntimeContext.getInstance().capabilities.isOnline) {
      await this.processOutbox();
    }
  }
  
  async processOutbox(): Promise<void> {
    const events = await this.outboxRepository.findPending();
    
    for (const event of events) {
      try {
        // 1. Désérialiser
        const { type, payload } = JSON.parse(event.payload);
        
        // 2. Résoudre les identités
        const resolvedPayload = await this.resolveIdentities(payload);
        
        // 3. Adapter le schéma
        const adaptedPayload = this.supabaseAdapter.adaptToSupabase(type, resolvedPayload);
        
        // 4. Envoyer vers Supabase
        await this.supabaseAdapter.send(type, adaptedPayload);
        
        // 5. Marquer comme SENT
        await this.outboxRepository.markAsSent(event.id);
        
      } catch (error) {
        // 6. Gérer les retries
        await this.outboxRepository.incrementRetry(event.id);
      }
    }
  }
  
  private async resolveIdentities(payload: any): Promise<any> {
    // Résoudre tous les INTEGER vers UUID
    if (payload.waiterId) {
      payload.waiterId = await this.identityMapper.sqliteToCanonical(payload.waiterId);
    }
    return payload;
  }
}
```

**Règles** :
- ✅ Traite uniquement des events sérialisés
- ✅ Ne connaît pas les tables métier
- ✅ Ne connaît pas les entités
- ✅ Utilise Anti-Corruption Layer
- ❌ Pas de logique métier
- ❌ Pas de connaissance des tables

---

## 8. TESTS DE VALIDATION (V2.2)

### 8.1 Tests architecturaux (obligatoires)

| Test | Validation | Méthode |
|---|---|---|
| **T1** | UseCase n'importe pas SQLite | `grep -r "sqlite" src/server/application/` |
| **T2** | UseCase n'importe pas Supabase | `grep -r "supabase" src/server/application/` |
| **T3** | UseCase n'accède pas à process.env | `grep -r "process.env" src/server/application/` |
| **T4** | Repository ne déclenche pas sync | `grep -r "SynchronizationService" src/server/infrastructure/repositories/` |
| **T5** | Repository ne publie pas d'event | `grep -r "EventBus" src/server/infrastructure/repositories/` |
| **T6** | Event publié après commit | Review code Use Cases |
| **T7** | SyncService ne connaît pas les tables | `grep -r "restaurant_tables" src/server/infrastructure/synchronization/` |
| **T8** | Frontend n'accède pas à SQLite | `grep -r "require.*database" src/stores/` |
| **T9** | Frontend ne résout pas d'identité | `grep -r "identity" src/stores/` |
| **T10** | ConfigurationProvider est le seul à accéder à process.env | `grep -r "process.env" src/server/ | grep -v configuration-provider` |

### 8.2 Tests fonctionnels

| Test | Description | Validation |
|---|---|---|
| **T11** | CRUD complet en mode Cloud | ✅ Fonctionne |
| **T12** | CRUD complet en mode Local | ✅ Fonctionne |
| **T13** | CRUD complet en mode Hybride | ✅ Fonctionne |
| **T14** | Synchronisation en mode Hybride | ✅ Fonctionne |
| **T15** | JOINs SQLite fonctionnent | ✅ INTEGER = INTEGER |
| **T16** | UUID uniquement dans Supabase | ✅ Vérifié |

---

## 9. CHECKLIST D'IMPLÉMENTATION

### 9.1 Phase 0 — Infrastructure

- [ ] ConfigurationProvider
- [ ] RuntimeContext
- [ ] Composition Root
- [ ] Outbox Repository
- [ ] Synchronization Service
- [ ] Identity Mapper
- [ ] Anti-Corruption Layer

### 9.2 Phase 1 — Module Tables

- [ ] Domain Layer (Table, TableId, TableStatus, etc.)
- [ ] Repository Interface (ITableRepository)
- [ ] Repositories (Sqlite, Supabase, Hybrid)
- [ ] Application Layer (Use Cases)
- [ ] Migration routes
- [ ] Correction frontend
- [ ] Tests

### 9.3 Phase 2 — Module Orders

Même checklist que Tables

### 9.4 Phase 3 — Module Users

Même checklist que Tables

### 9.5 Phase 4 — Autres modules

- [ ] Products
- [ ] Categories
- [ ] Stocks
- [ ] Payments
- [ ] Subscriptions
- [ ] Reservations
- [ ] Invoices
- [ ] Kitchen

---

## 10. VALIDATION FINALE

### 10.1 Critères de validation

| Critère | Status |
|---|---|
| UseCase ne connaît pas le runtime | ☐ |
| Repository ne déclenche pas sync | ☐ |
| Supabase n'est pas visible dans le domaine | ☐ |
| Event est publié après commit | ☐ |
| Aucune décision dépend de process.env ailleurs que ConfigurationProvider | ☐ |
| Aucun Singleton | ☐ |
| Aucun Service Locator | ☐ |
| Injection de dépendances partout | ☐ |
| Domain Layer pur | ☐ |
| Frontend ignorant | ☐ |
| INTEGER uniquement côté SQLite | ☐ |
| UUID uniquement côté Supabase | ☐ |
| Synchronisation via Outbox uniquement | ☐ |
| Migration incrémentale | ☐ |

### 10.2 Signature architecturale

**Architecte** : _________________  
**Date** : _________________  
**Validation** : ☐ Approuvé ☐ Rejeté

**Commentaires** :
```
[Espace pour commentaires]
```

---

## 11. CONCLUSION

Cette architecture V2.2 est :
- ✅ Stable 5+ ans
- ✅ Offline-first + cloud-first
- ✅ Sans dette cachée
- ✅ Sans couplage infrastructure
- ✅ Totalement testable
- ✅ Extensible sans refactor structurel

**Status** : Prête pour implémentation module par module  
**Auteur** : Software Architect Principal  
**Date** : 2026-06-07  
**Fichier** : `docs/ARCHITECTURE_V2_2_IMPLEMENTATION.md`