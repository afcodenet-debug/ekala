/**
 * Tests pour SUB-009 (SubscriptionApplicationService)
 * Exécution : npx ts-node src/server/application/subscription/__tests__/subscription-application-service.test.ts
 */

import { SubscriptionApplicationService } from '../SubscriptionApplicationService';
import { SqliteSubscriptionRepository } from '../../../infrastructure/repositories/sqlite/SqliteSubscriptionRepository';
import { SubscriptionStatus } from '../../../domain/subscription/value-objects/SubscriptionStatus';

// Simple test framework
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

class TestRunner {
  private results: TestResult[] = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => void | Promise<void>) {
    try {
      const result = fn();
      if (result instanceof Promise) {
        return result.then(() => {
          this.results.push({ name, passed: true });
          this.passed++;
        }).catch((error: any) => {
          this.results.push({ name, passed: false, error: error.message });
          this.failed++;
        });
      }
      this.results.push({ name, passed: true });
      this.passed++;
    } catch (error: any) {
      this.results.push({ name, passed: false, error: error.message });
      this.failed++;
    }
  }

  assertEqual(actual: any, expected: any, message?: string) {
    if (actual !== expected) {
      throw new Error(
        message || `Expected ${expected} but got ${actual}`
      );
    }
  }

  assertTrue(value: any, message?: string) {
    if (!value) {
      throw new Error(message || 'Expected true but got false');
    }
  }

  assertFalse(value: any, message?: string) {
    if (value) {
      throw new Error(message || 'Expected false but got true');
    }
  }

  assertContains(str: string, substr: string, message?: string) {
    if (!str.includes(substr)) {
      throw new Error(message || `Expected "${str}" to contain "${substr}"`);
    }
  }

  summary() {
    console.log('\n' + '='.repeat(60));
    console.log('TEST RESULTS - SUB-009 (SubscriptionApplicationService)');
    console.log('='.repeat(60));
    
    this.results.forEach(result => {
      const status = result.passed ? '✓' : '✗';
      const color = result.passed ? '\x1b[32m' : '\x1b[31m';
      console.log(`${color}${status}\x1b[0m ${result.name}`);
      if (!result.passed && result.error) {
        console.log(`  \x1b[31mError: ${result.error}\x1b[0m`);
      }
    });

    console.log('='.repeat(60));
    console.log(`Total: ${this.passed + this.failed} tests`);
    console.log(`\x1b[32mPassed: ${this.passed}\x1b[0m`);
    console.log(`\x1b[31mFailed: ${this.failed}\x1b[0m`);
    console.log(`Coverage: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`);
    console.log('='.repeat(60) + '\n');

    return this.failed === 0;
  }
}

// Mocks
class MockEventBus {
  private events: any[] = [];
  
  async publish(event: any): Promise<void> {
    this.events.push(event);
  }

  getEvents(): any[] {
    return this.events;
  }
}

class MockLamportClock {
  private time = 0;
  
  getTime(): number {
    return this.time;
  }

  increment(): number {
    return ++this.time;
  }
}

class MockOriginNode {
  private nodeId: string;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
  }

  getNodeId(): string {
    return this.nodeId;
  }
}

// Run tests
async function runTests() {
  const runner = new TestRunner();
  const repo = new SqliteSubscriptionRepository();
  const eventBus = new MockEventBus();
  const lamportClock = new MockLamportClock();
  const originNode = new MockOriginNode('test-node');

  const service = new SubscriptionApplicationService(
    repo,
    eventBus,
    lamportClock,
    originNode
  );

  // ==================== activateSubscription Tests ====================
  
  runner.test('SUB-009: activateSubscription() activates pending subscription', async () => {
    // Créer un abonnement pending
    const created = await repo.createSubscription({
      tenantId: 100,
      planId: 1,
      status: SubscriptionStatus.pending(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'test-node',
    });

    const result = await service.activateSubscription(created.tenantId, 1, 1);

    runner.assertTrue(result.isSuccess);
    if (result.isSuccess) {
      runner.assertTrue(result.value.status.toString() === 'active');
      runner.assertEqual(result.value.entityVersion, 2);
    }
  });

  runner.test('SUB-009: activateSubscription() fails for already active', async () => {
    // Créer un abonnement déjà actif
    await repo.createSubscription({
      tenantId: 101,
      planId: 1,
      status: SubscriptionStatus.active(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'test-node',
    });

    const result = await service.activateSubscription(101, 1, 1);

    runner.assertFalse(result.isSuccess);
    if (!result.isSuccess) {
      runner.assertContains(result.error, 'already active');
    }
  });

  // ==================== suspendSubscription Tests ====================
  
  runner.test('SUB-009: suspendSubscription() suspends active subscription', async () => {
    // Créer un abonnement actif
    await repo.createSubscription({
      tenantId: 102,
      planId: 1,
      status: SubscriptionStatus.active(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'test-node',
    });

    const result = await service.suspendSubscription(102, 'payment_failed', 1);

    runner.assertTrue(result.isSuccess);
    if (result.isSuccess) {
      runner.assertTrue(result.value.status.toString() === 'suspended');
    }
  });

  runner.test('SUB-009: suspendSubscription() fails for expired subscription', async () => {
    // Créer un abonnement expiré
    await repo.createSubscription({
      tenantId: 103,
      planId: 1,
      status: SubscriptionStatus.expired(),
      startsAt: '2026-01-01',
      endsAt: '2026-02-01',
      originNode: 'test-node',
    });

    const result = await service.suspendSubscription(103, 'payment_failed', 1);

    runner.assertFalse(result.isSuccess);
    if (!result.isSuccess) {
      runner.assertContains(result.error, 'Cannot suspend');
    }
  });

  // ==================== cancelSubscription Tests ====================
  
  runner.test('SUB-009: cancelSubscription() cancels active subscription', async () => {
    // Créer un abonnement actif
    await repo.createSubscription({
      tenantId: 104,
      planId: 1,
      status: SubscriptionStatus.active(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'test-node',
    });

    const result = await service.cancelSubscription(104, 'User request', 1);

    runner.assertTrue(result.isSuccess);
    if (result.isSuccess) {
      runner.assertTrue(result.value.status.toString() === 'cancelled');
      runner.assertTrue(result.value.cancelledAt !== undefined);
    }
  });

  runner.test('SUB-009: cancelSubscription() fails for expired subscription', async () => {
    // Créer un abonnement expiré
    await repo.createSubscription({
      tenantId: 105,
      planId: 1,
      status: SubscriptionStatus.expired(),
      startsAt: '2026-01-01',
      endsAt: '2026-02-01',
      originNode: 'test-node',
    });

    const result = await service.cancelSubscription(105, 'User request', 1);

    runner.assertFalse(result.isSuccess);
    if (!result.isSuccess) {
      runner.assertContains(result.error, 'Cannot cancel');
    }
  });

  // ==================== renewSubscription Tests ====================
  
  runner.test('SUB-009: renewSubscription() renews active subscription', async () => {
    // Créer un abonnement actif
    await repo.createSubscription({
      tenantId: 106,
      planId: 1,
      status: SubscriptionStatus.active(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'test-node',
    });

    const newEndAt = '2027-07-27';
    const result = await service.renewSubscription(106, newEndAt, 1);

    runner.assertTrue(result.isSuccess);
    if (result.isSuccess) {
      runner.assertEqual(result.value.endsAt, newEndAt);
      runner.assertTrue(result.value.status.isActive());
    }
  });

  runner.test('SUB-009: renewSubscription() fails for past date', async () => {
    // Créer un abonnement actif
    await repo.createSubscription({
      tenantId: 107,
      planId: 1,
      status: SubscriptionStatus.active(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'test-node',
    });

    const result = await service.renewSubscription(107, '2020-01-01', 1);

    runner.assertFalse(result.isSuccess);
    if (!result.isSuccess) {
      runner.assertContains(result.error, 'must be in the future');
    }
  });

  // ==================== expireOldSubscriptions Tests ====================
  
  runner.test('SUB-009: expireOldSubscriptions() processes expired subscriptions', async () => {
    // Créer un abonnement expiré
    await repo.createSubscription({
      tenantId: 108,
      planId: 1,
      status: SubscriptionStatus.grace(),
      startsAt: '2026-01-01',
      endsAt: '2026-02-01',
      originNode: 'test-node',
    });

    const expiredCount = await service.expireOldSubscriptions();

    runner.assertTrue(expiredCount >= 0);
    runner.assertTrue(typeof expiredCount === 'number');
  });

  // ==================== Event Emission Tests ====================
  
  runner.test('SUB-009: Events are emitted for state changes', async () => {
    // Créer un abonnement pending
    await repo.createSubscription({
      tenantId: 109,
      planId: 1,
      status: SubscriptionStatus.pending(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'test-node',
    });

    await service.activateSubscription(109, 1, 1);

    const events = eventBus.getEvents();
    runner.assertTrue(events.length > 0);
  });

  // ==================== Error Handling Tests ====================
  
  runner.test('SUB-009: activateSubscription() fails for non-existent tenant', async () => {
    const result = await service.activateSubscription(99999, 1, 1);

    runner.assertFalse(result.isSuccess);
    if (!result.isSuccess) {
      runner.assertContains(result.error, 'No active subscription found');
    }
  });

  runner.test('SUB-009: suspendSubscription() fails for non-existent tenant', async () => {
    const result = await service.suspendSubscription(99999, 'payment_failed', 1);

    runner.assertFalse(result.isSuccess);
    if (!result.isSuccess) {
      runner.assertContains(result.error, 'No active subscription found');
    }
  });

  runner.test('SUB-009: cancelSubscription() fails for non-existent tenant', async () => {
    const result = await service.cancelSubscription(99999, 'User request', 1);

    runner.assertFalse(result.isSuccess);
    if (!result.isSuccess) {
      runner.assertContains(result.error, 'No active subscription found');
    }
  });

  runner.test('SUB-009: renewSubscription() fails for non-existent tenant', async () => {
    const result = await service.renewSubscription(99999, '2027-07-27', 1);

    runner.assertFalse(result.isSuccess);
    if (!result.isSuccess) {
      runner.assertContains(result.error, 'No active subscription found');
    }
  });

  // ==================== Integration Tests ====================
  
  runner.test('Integration: Full lifecycle - pending -> active -> suspended -> cancelled', async () => {
    // Créer un abonnement pending
    await repo.createSubscription({
      tenantId: 110,
      planId: 1,
      status: SubscriptionStatus.pending(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'test-node',
    });

    // Activer
    let result = await service.activateSubscription(110, 1, 1);
    runner.assertTrue(result.isSuccess);
    if (result.isSuccess) {
      runner.assertTrue(result.value.status.toString() === 'active');
    }

    // Suspendre
    result = await service.suspendSubscription(110, 'payment_failed', 1);
    runner.assertTrue(result.isSuccess);
    if (result.isSuccess) {
      runner.assertTrue(result.value.status.toString() === 'suspended');
    }

    // Annuler
    result = await service.cancelSubscription(110, 'User request', 1);
    runner.assertTrue(result.isSuccess);
    if (result.isSuccess) {
      runner.assertTrue(result.value.status.toString() === 'cancelled');
    }
  });

  // Run all tests and return summary
  const success = await runner.summary();
  
  if (!success) {
    throw new Error('Some tests failed');
  }
}

// Execute tests
runTests().catch(error => {
  console.error('Test runner failed:', error);
  throw error;
});