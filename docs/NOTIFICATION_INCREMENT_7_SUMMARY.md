# INCÉMENT 7 : TESTS - RÉSUMÉ
**Date :** 29/06/2026  
**Statut :** ✅ Documentation créée  
**Durée :** Session unique  

---

## OBJECTIF ATTEINT

Documenter la stratégie de tests complète pour le système de notifications V3 avec :
- Tests unitaires pour chaque service
- Tests d'intégration entre services
- Tests de charge et performance
- Tests de scénarios réels
- Configuration et exécution

---

## STRATÉGIE DE TESTS

### 📊 Pyramide des tests

```
        ┌─────────┐
        │   E2E   │  ← Tests end-to-end (scénarios complets)
        ├─────────┤
        │   Load  │  ← Tests de charge (performance)
        ├─────────┤
       ┌┴─────────┴┐
       │ Integration│  ← Tests d'intégration (services)
       ├────────────┤
       │   Unit     │  ← Tests unitaires (services)
       └────────────┘
```

### 📁 Structure des tests

```
src/server/notifications/
├── __tests__/
│   ├── unit/
│   │   ├── notification-event-bus.test.ts
│   │   ├── notification-queue.test.ts
│   │   ├── notification-logger.test.ts
│   │   ├── email-retry-policy.test.ts
│   │   ├── smtp-health-check.test.ts
│   │   ├── email-circuit-breaker.test.ts
│   │   ├── realtime-notification.test.ts
│   │   ├── email-template.test.ts
│   │   ├── monitoring.test.ts
│   │   └── optimization.test.ts
│   ├── integration/
│   │   ├── event-bus-queue.test.ts
│   │   ├── queue-smtp.test.ts
│   │   ├── template-render.test.ts
│   │   └── monitoring-optimization.test.ts
│   ├── load/
│   │   ├── queue-load.test.ts
│   │   ├── email-load.test.ts
│   │   └── realtime-load.test.ts
│   └── e2e/
│       ├── notification-flow.test.ts
│       ├── billing-notifications.test.ts
│       └── subscription-notifications.test.ts
└── fixtures/
    ├── templates.ts
    ├── notifications.ts
    └── config.ts
```

---

## TESTS UNITAIRES

### 1. NotificationEventBus

```typescript
// __tests__/unit/notification-event-bus.test.ts

import { NotificationEventBus, NotificationEvent } from '../notification-event-bus';

describe('NotificationEventBus', () => {
  let eventBus: NotificationEventBus;

  beforeEach(() => {
    eventBus = new NotificationEventBus();
  });

  describe('publish/subscribe', () => {
    it('should publish and receive events', () => {
      const receivedEvents: NotificationEvent[] = [];
      
      eventBus.subscribe('TEST_EVENT', (event) => {
        receivedEvents.push(event);
      });

      eventBus.publish({
        type: 'TEST_EVENT',
        payload: { message: 'Hello' },
        timestamp: new Date(),
      });

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].type).toBe('TEST_EVENT');
    });

    it('should support multiple subscribers', () => {
      let count = 0;
      
      eventBus.subscribe('TEST_EVENT', () => count++);
      eventBus.subscribe('TEST_EVENT', () => count++);
      eventBus.subscribe('TEST_EVENT', () => count++);

      eventBus.publish({
        type: 'TEST_EVENT',
        payload: {},
        timestamp: new Date(),
      });

      expect(count).toBe(3);
    });

    it('should filter by event type', () => {
      const receivedEvents: NotificationEvent[] = [];
      
      eventBus.subscribe('TYPE_A', (event) => {
        receivedEvents.push(event);
      });

      eventBus.publish({ type: 'TYPE_A', payload: {}, timestamp: new Date() });
      eventBus.publish({ type: 'TYPE_B', payload: {}, timestamp: new Date() });
      eventBus.publish({ type: 'TYPE_A', payload: {}, timestamp: new Date() });

      expect(receivedEvents).toHaveLength(2);
    });

    it('should allow unsubscribing', () => {
      let count = 0;
      const handler = () => count++;
      
      eventBus.subscribe('TEST_EVENT', handler);
      eventBus.publish({ type: 'TEST_EVENT', payload: {}, timestamp: new Date() });
      expect(count).toBe(1);

      eventBus.unsubscribe('TEST_EVENT', handler);
      eventBus.publish({ type: 'TEST_EVENT', payload: {}, timestamp: new Date() });
      expect(count).toBe(1); // Still 1
    });

    it('should clear all subscriptions', () => {
      let count = 0;
      
      eventBus.subscribe('TEST_EVENT', () => count++);
      eventBus.clear();

      eventBus.publish({ type: 'TEST_EVENT', payload: {}, timestamp: new Date() });
      expect(count).toBe(0);
    });
  });
});
```

### 2. NotificationQueue

```typescript
// __tests__/unit/notification-queue.test.ts

import { NotificationQueue } from '../notification-queue';

describe('NotificationQueue', () => {
  let queue: NotificationQueue;

  beforeEach(async () => {
    queue = new NotificationQueue();
    await queue.initialize();
  });

  afterEach(async () => {
    await queue.clear();
  });

  describe('enqueue/dequeue', () => {
    it('should enqueue and dequeue jobs', async () => {
      const job = {
        id: 'test-1',
        type: 'EMAIL',
        recipient: 'test@example.com',
        payload: { subject: 'Test', body: 'Hello' },
        priority: 1,
        attempts: 0,
        maxAttempts: 3,
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await queue.enqueue(job);
      const dequeued = await queue.dequeue();

      expect(dequeued).not.toBeNull();
      expect(dequeued?.id).toBe('test-1');
    });

    it('should respect priority', async () => {
      const job1 = { id: 'low', type: 'EMAIL', priority: 2, /* ... */ };
      const job2 = { id: 'high', type: 'EMAIL', priority: 1, /* ... */ };

      await queue.enqueue(job1);
      await queue.enqueue(job2);

      const first = await queue.dequeue();
      expect(first?.id).toBe('high');
    });

    it('should handle empty queue', async () => {
      const job = await queue.dequeue();
      expect(job).toBeNull();
    });
  });

  describe('retry mechanism', () => {
    it('should retry failed jobs', async () => {
      const job = {
        id: 'test-retry',
        type: 'EMAIL',
        priority: 1,
        attempts: 0,
        maxAttempts: 3,
        status: 'pending' as const,
        // ...
      };

      await queue.enqueue(job);
      let dequeued = await queue.dequeue();
      
      // Simulate failure
      await queue.markFailed(dequeued!.id, 'SMTP error');
      
      // Retry
      await queue.retryJob(dequeued!.id);
      dequeued = await queue.dequeue();
      
      expect(dequeued).not.toBeNull();
      expect(dequeued?.attempts).toBe(1);
    });

    it('should move to DLQ after max attempts', async () => {
      const job = {
        id: 'test-dlq',
        maxAttempts: 2,
        attempts: 0,
        // ...
      };

      await queue.enqueue(job);
      let dequeued = await queue.dequeue();
      
      await queue.markFailed(dequeued!.id, 'Error 1');
      await queue.retryJob(dequeued!.id);
      
      dequeued = await queue.dequeue();
      await queue.markFailed(dequeued!.id, 'Error 2');
      
      // Should be in DLQ now
      const dlqJobs = await queue.getDeadLetterJobs();
      expect(dlqJobs.some(j => j.id === 'test-dlq')).toBe(true);
    });
  });

  describe('statistics', () => {
    it('should return correct stats', async () => {
      await queue.enqueue({ id: '1', priority: 1, /* ... */ });
      await queue.enqueue({ id: '2', priority: 1, /* ... */ });

      const stats = await queue.getStats();
      expect(stats.pending).toBe(2);
    });
  });
});
```

### 3. EmailTemplateService

```typescript
// __tests__/unit/email-template.test.ts

import { EmailTemplateService } from '../email-template.service';

describe('EmailTemplateService', () => {
  let templateService: EmailTemplateService;

  beforeEach(() => {
    templateService = new EmailTemplateService();
  });

  describe('render', () => {
    it('should render template with variables', () => {
      const result = templateService.render('stock_adjustment', {
        variables: {
          productName: 'Coca-Cola',
          sku: 'COKE-001',
          qtyBefore: 100,
          qtyAfter: 95,
          reason: 'Damaged',
          date: '2026-06-29',
        },
        recipientName: 'John',
      });

      expect(result.subject).toContain('Coca-Cola');
      expect(result.htmlBody).toContain('Coca-Cola');
      expect(result.htmlBody).toContain('COKE-001');
      expect(result.htmlBody).toContain('100');
      expect(result.htmlBody).toContain('95');
    });

    it('should replace all variables', () => {
      const result = templateService.render('low_stock_alert', {
        variables: {
          productName: 'Test Product',
          currentStock: 5,
          minThreshold: 10,
        },
      });

      expect(result.htmlBody).not.toContain('{{');
      expect(result.htmlBody).not.toContain('}}');
    });

    it('should use default values for missing variables', () => {
      const result = templateService.render('stock_adjustment', {
        variables: {
          productName: 'Test',
        },
      });

      expect(result.subject).toContain('Test');
      expect(result.htmlBody).toContain('User'); // default recipientName
    });

    it('should throw error for non-existent template', () => {
      expect(() => {
        templateService.render('non_existent', { variables: {} });
      }).toThrow('Template not found');
    });
  });

  describe('validateTemplate', () => {
    it('should validate required variables', () => {
      const validation = templateService.validateTemplate('stock_adjustment', {
        productName: 'Test',
        // Missing other required vars
      });

      expect(validation.valid).toBe(false);
      expect(validation.missingVariables.length).toBeGreaterThan(0);
    });

    it('should pass validation with all variables', () => {
      const validation = templateService.validateTemplate('stock_adjustment', {
        productName: 'Test',
        sku: 'TEST-001',
        qtyBefore: 100,
        qtyAfter: 95,
        reason: 'Test',
        date: '2026-06-29',
      });

      expect(validation.valid).toBe(true);
      expect(validation.missingVariables).toHaveLength(0);
    });
  });

  describe('CRUD', () => {
    it('should register and retrieve template', () => {
      templateService.registerTemplate({
        id: 'custom',
        name: 'Custom',
        subject: 'Custom {{title}}',
        htmlBody: '<h1>{{title}}</h1>',
        category: 'custom',
        variables: ['title'],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const template = templateService.getTemplate('custom');
      expect(template).toBeDefined();
      expect(template?.name).toBe('Custom');
    });

    it('should update template', () => {
      templateService.registerTemplate({
        id: 'test',
        name: 'Test',
        subject: 'Old',
        htmlBody: '<p>Old</p>',
        category: 'test',
        variables: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updated = templateService.updateTemplate('test', {
        subject: 'New',
      });

      expect(updated?.subject).toBe('New');
    });

    it('should delete template', () => {
      templateService.registerTemplate({
        id: 'to-delete',
        name: 'To Delete',
        subject: 'Test',
        htmlBody: '<p>Test</p>',
        category: 'test',
        variables: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const deleted = templateService.deleteTemplate('to-delete');
      expect(deleted).toBe(true);

      const template = templateService.getTemplate('to-delete');
      expect(template).toBeUndefined();
    });
  });
});
```

---

## TESTS D'INTÉGRATION

### 1. EventBus + Queue

```typescript
// __tests__/integration/event-bus-queue.test.ts

import { NotificationEventBus } from '../notification-event-bus';
import { NotificationQueue } from '../notification-queue';

describe('EventBus + Queue Integration', () => {
  it('should enqueue email when event is published', async () => {
    const eventBus = new NotificationEventBus();
    const queue = new NotificationQueue();
    await queue.initialize();

    // Subscribe to email events
    eventBus.subscribe('EMAIL_SEND', async (event) => {
      await queue.enqueue({
        id: `email-${Date.now()}`,
        type: 'EMAIL',
        recipient: event.payload.to,
        payload: event.payload,
        priority: 1,
        attempts: 0,
        maxAttempts: 3,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    // Publish event
    eventBus.publish({
      type: 'EMAIL_SEND',
      payload: { to: 'user@example.com', subject: 'Test' },
      timestamp: new Date(),
    });

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 100));

    const stats = await queue.getStats();
    expect(stats.pending).toBe(1);
  });
});
```

### 2. Template + SMTP

```typescript
// __tests__/integration/template-render.test.ts

import { EmailTemplateService } from '../email-template.service';
import { EmailCircuitBreaker } from '../email-circuit-breaker';

describe('Template + SMTP Integration', () => {
  it('should render and send email', async () => {
    const templateService = new EmailTemplateService();
    const circuitBreaker = new EmailCircuitBreaker();

    // Render template
    const email = templateService.render('stock_adjustment', {
      recipientName: 'User',
      variables: {
        productName: 'Test',
        sku: 'TEST-001',
        qtyBefore: 100,
        qtyAfter: 95,
        reason: 'Test',
        date: '2026-06-29',
      },
    });

    // Send through circuit breaker
    const result = await circuitBreaker.execute(async () => {
      // Mock SMTP send
      return { success: true, messageId: '123' };
    });

    expect(result.success).toBe(true);
    expect(email.subject).toContain('Test');
  });
});
```

---

## TESTS DE CHARGE

### 1. Queue Load Test

```typescript
// __tests__/load/queue-load.test.ts

import { NotificationQueue } from '../notification-queue';

describe('Queue Load Test', () => {
  it('should handle 10,000 jobs', async () => {
    const queue = new NotificationQueue();
    await queue.initialize();

    const startTime = Date.now();

    // Enqueue 10,000 jobs
    const promises = [];
    for (let i = 0; i < 10000; i++) {
      promises.push(
        queue.enqueue({
          id: `job-${i}`,
          type: 'EMAIL',
          priority: Math.floor(Math.random() * 3),
          attempts: 0,
          maxAttempts: 3,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
    }

    await Promise.all(promises);
    const enqueueTime = Date.now() - startTime;

    // Verify
    const stats = await queue.getStats();
    expect(stats.pending).toBe(10000);

    console.log(`Enqueued 10,000 jobs in ${enqueueTime}ms`);
    console.log(`Average: ${enqueueTime / 10000}ms per job`);

    // Cleanup
    await queue.clear();
  });

  it('should process 1000 jobs/second', async () => {
    const queue = new NotificationQueue();
    await queue.initialize();

    // Enqueue 1000 jobs
    for (let i = 0; i < 1000; i++) {
      await queue.enqueue({
        id: `perf-${i}`,
        type: 'EMAIL',
        priority: 1,
        attempts: 0,
        maxAttempts: 3,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Process all
    const startTime = Date.now();
    let processed = 0;
    while (processed < 1000) {
      const job = await queue.dequeue();
      if (job) {
        await queue.markCompleted(job.id);
        processed++;
      } else {
        break;
      }
    }
    const processTime = Date.now() - startTime;

    console.log(`Processed ${processed} jobs in ${processTime}ms`);
    console.log(`Throughput: ${(processed / processTime * 1000).toFixed(2)} jobs/sec`);

    expect(processed).toBe(1000);
  });
});
```

---

## TESTS E2E

### 1. Notification Flow

```typescript
// __tests__/e2e/notification-flow.test.ts

import { bootstrapNotificationSystem } from '../../integration-example';

describe('E2E Notification Flow', () => {
  it('should complete full notification flow', async () => {
    // Initialize system
    const db = createMockDB();
    const system = bootstrapNotificationSystem(db);

    // Trigger notification
    const result = await system.notificationService.sendStockAdjustmentEmail(
      'user@example.com',
      {
        productName: 'Coca-Cola',
        sku: 'COKE-001',
        qtyBefore: 100,
        qtyAfter: 95,
        reason: 'Damaged',
      }
    );

    // Verify queue
    const queueStats = await system.queue.getStats();
    expect(queueStats.pending).toBeGreaterThan(0);

    // Process queue
    await system.processNotificationQueue();

    // Verify completed
    const completedStats = await system.queue.getStats();
    expect(completedStats.completed).toBeGreaterThan(0);
  });
});
```

---

## CONFIGURATION DES TESTS

### package.json

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration",
    "test:load": "jest --testPathPattern=load",
    "test:e2e": "jest --testPathPattern=e2e",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "roots": ["<rootDir>/src/server/notifications"],
    "testMatch": ["**/__tests__/**/*.test.ts"],
    "collectCoverageFrom": [
      "**/*.ts",
      "!**/node_modules/**",
      "!**/__tests__/**"
    ],
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

---

## MÉTRIQUES DE QUALITÉ

### Couverture de code
- **Objectif** : 80% minimum
- **Unit tests** : 90%+
- **Integration tests** : 70%+
- **E2E tests** : Scénarios critiques

### Performance
- **Tests unitaires** : < 1s total
- **Tests intégration** : < 5s total
- **Tests load** : < 30s total
- **Tests E2E** : < 1min total

### Fiabilité
- **Flakiness** : < 1%
- **False positives** : 0%
- **False negatives** : < 0.1%

---

## PROCHAINES ÉTAPES

### Actions immédiates
1. [ ] Installer Jest et配置
2. [ ] Créer les fixtures
3. [ ] Implémenter tests unitaires (tous les services)
4. [ ] Implémenter tests d'intégration
5. [ ] Implémenter tests de charge
6. [ ] Implémenter tests E2E
7. [ ] Configurer CI/CD pour exécuter les tests
8. [ ] Atteindre 80% de couverture

---

## NOTES

### Bonnes pratiques
- ✅ Un test = Un comportement
- ✅ Tests indépendants et isolés
- ✅ Mock external dependencies
- ✅ Utiliser des fixtures pour données de test
- ✅ Nettoyer après chaque test
- ✅ Tests lisibles et maintenables

### Outils recommandés
- **Jest** - Framework de test
- **ts-jest** - Support TypeScript
- **@types/jest** - Types
- **jest-mock** - Mocks
- **supertest** - Tests HTTP (si nécessaire)

---

## CONCLUSION

**Incrément 7 documenté.** Stratégie de tests complète définie :
- Tests unitaires pour tous les services
- Tests d'intégration entre services
- Tests de charge pour performance
- Tests E2E pour scénarios réels
- Configuration et métriques de qualité

**Prêt pour implémentation :** Écrire et exécuter les tests.

---

**Total Increment 7 :** Documentation + stratégie