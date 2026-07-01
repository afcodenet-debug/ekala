/**
 * Tests pour SUB-006 (SubscriptionStatusReadModel)
 * Exécution : npx ts-node src/server/domain/subscription/read-models/__tests__/subscription-status-read-model.test.ts
 */

import { SubscriptionStatusReadModelService } from '../SubscriptionStatusReadModel';
import { ISubscriptionRepository } from '../../repositories/ISubscriptionRepository';
import { SubscriptionStatus } from '../../value-objects/SubscriptionStatus';

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
    console.log('TEST RESULTS - SUB-006 (SubscriptionStatusReadModel)');
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

// Mock Repository
class MockSubscriptionRepository implements ISubscriptionRepository {
  private subscriptions: Map<number, any> = new Map();

  async createSubscription(data: any): Promise<any> {
    const id = this.subscriptions.size + 1;
    const subscription = {
      id,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.subscriptions.set(id, subscription);
    return subscription;
  }

  async findSubscriptionById(id: number): Promise<any> {
    return this.subscriptions.get(id) || null;
  }

  async findActiveSubscriptionByTenantId(tenantId: number): Promise<any> {
    for (const sub of this.subscriptions.values()) {
      if (sub.tenantId === tenantId) {
        return sub;
      }
    }
    return null;
  }

  async findAllSubscriptionsByTenantId(tenantId: number): Promise<any[]> {
    const result: any[] = [];
    for (const sub of this.subscriptions.values()) {
      if (sub.tenantId === tenantId) {
        result.push(sub);
      }
    }
    return result;
  }

  async updateSubscription(_id: number, _updates: any, _expectedVersion: number): Promise<any> {
    return {} as any;
  }

  async deleteSubscription(id: number): Promise<void> {
    this.subscriptions.delete(id);
  }

  async countActiveSubscriptions(): Promise<number> {
    return 0;
  }

  async createVoucher(_data: any): Promise<any> {
    throw new Error('Not implemented');
  }

  async findVoucherById(_id: number): Promise<any> {
    throw new Error('Not implemented');
  }

  async findVoucherByPaymentReference(_paymentReference: string): Promise<any> {
    throw new Error('Not implemented');
  }

  async findAllVouchersByTenantId(_tenantId: number): Promise<any[]> {
    throw new Error('Not implemented');
  }

  async findPendingVouchers(): Promise<any[]> {
    throw new Error('Not implemented');
  }

  async updateVoucher(_id: number, _updates: any): Promise<any> {
    throw new Error('Not implemented');
  }

  async countVouchersByStatus(_status: any): Promise<number> {
    throw new Error('Not implemented');
  }

  async findPlanById(_id: number): Promise<any> {
    throw new Error('Not implemented');
  }

  async findAllActivePlans(): Promise<any[]> {
    throw new Error('Not implemented');
  }

  async findAllPlans(): Promise<any[]> {
    throw new Error('Not implemented');
  }

  async findSubscriptionSummaries(_offset: number, _limit: number): Promise<any[]> {
    throw new Error('Not implemented');
  }

  async findVoucherSummaries(_offset: number, _limit: number): Promise<any[]> {
    throw new Error('Not implemented');
  }

  async getSubscriptionStats(): Promise<any> {
    throw new Error('Not implemented');
  }

  async getVoucherStats(): Promise<any> {
    throw new Error('Not implemented');
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}

// Run tests
async function runTests() {
  const runner = new TestRunner();
  const mockRepo = new MockSubscriptionRepository();
  const readModel = new SubscriptionStatusReadModelService(mockRepo);

  // ==================== No Subscription Tests ====================
  
  runner.test('SUB-006: get() returns no_plan for non-existent tenant', async () => {
    const result = await readModel.get(99999);
    
    runner.assertTrue(result !== null);
    if (result) {
      runner.assertEqual(result.state, 'no_plan');
      runner.assertEqual(result.tenantId, 99999);
      runner.assertFalse(result.isExpired);
      runner.assertFalse(result.isGracePeriod);
    }
  });

  // ==================== Active Subscription Tests ====================
  
  runner.test('SUB-006: get() returns active state for active subscription', async () => {
    // Create subscription
    await mockRepo.createSubscription({
      tenantId: 100,
      planId: 1,
      status: SubscriptionStatus.active(),
      entityVersion: 1,
      originNode: 'test-node',
      logicalClock: 1,
      startsAt: '2026-06-27',
      endsAt: '2027-06-27',
    });

    const result = await readModel.get(100);
    
    runner.assertTrue(result !== null);
    if (result) {
      runner.assertEqual(result.state, 'active');
      runner.assertEqual(result.tenantId, 100);
      runner.assertFalse(result.isExpired);
      runner.assertFalse(result.isGracePeriod);
      runner.assertTrue(result.daysUntilRenewal !== null);
      runner.assertTrue(result.daysUntilRenewal! > 0);
    }
  });

  runner.test('SUB-006: get() returns expired state for expired subscription', async () => {
    // Create expired subscription
    await mockRepo.createSubscription({
      tenantId: 101,
      planId: 1,
      status: SubscriptionStatus.expired(),
      entityVersion: 1,
      originNode: 'test-node',
      logicalClock: 1,
      startsAt: '2025-01-01',
      endsAt: '2025-12-31',
    });

    const result = await readModel.get(101);
    
    runner.assertTrue(result !== null);
    if (result) {
      runner.assertEqual(result.state, 'expired');
      runner.assertTrue(result.isExpired);
      runner.assertFalse(result.isGracePeriod);
    }
  });

  runner.test('SUB-006: get() returns grace state for grace subscription', async () => {
    // Create grace subscription
    await mockRepo.createSubscription({
      tenantId: 102,
      planId: 1,
      status: SubscriptionStatus.grace(),
      entityVersion: 1,
      originNode: 'test-node',
      logicalClock: 1,
      startsAt: '2026-01-01',
      endsAt: '2026-06-27',
    });

    const result = await readModel.get(102);
    
    runner.assertTrue(result !== null);
    if (result) {
      runner.assertEqual(result.state, 'grace');
      runner.assertTrue(result.isGracePeriod);
      runner.assertTrue(result.graceDaysRemaining !== null);
    }
  });

  // ==================== Cache Tests ====================
  
  runner.test('SUB-006: get() caches results', async () => {
    // Create subscription
    await mockRepo.createSubscription({
      tenantId: 103,
      planId: 1,
      status: SubscriptionStatus.active(),
      entityVersion: 1,
      originNode: 'test-node',
      logicalClock: 1,
      startsAt: '2026-06-27',
      endsAt: '2027-06-27',
    });

    // First call
    const result1 = await readModel.get(103);
    
    // Second call (should use cache)
    const result2 = await readModel.get(103);
    
    runner.assertTrue(result1 !== null);
    runner.assertTrue(result2 !== null);
    if (result1 && result2) {
      runner.assertEqual(result1.tenantId, result2.tenantId);
      runner.assertEqual(result1.state, result2.state);
      // CachedAt should be the same
      runner.assertEqual(result1.cachedAt, result2.cachedAt);
    }
  });

  runner.test('SUB-006: invalidateCache() clears cache for tenant', async () => {
    // Create subscription
    await mockRepo.createSubscription({
      tenantId: 104,
      planId: 1,
      status: SubscriptionStatus.active(),
      entityVersion: 1,
      originNode: 'test-node',
      logicalClock: 1,
      startsAt: '2026-06-27',
      endsAt: '2027-06-27',
    });

    // First call
    const result1 = await readModel.get(104);
    runner.assertTrue(result1 !== null);
    
    // Invalidate cache
    readModel.invalidateCache(104);
    
    // Second call (should fetch from repository)
    const result2 = await readModel.get(104);
    runner.assertTrue(result2 !== null);
    
    if (result1 && result2) {
      // cachedAt should be different
      runner.assertFalse(result1.cachedAt === result2.cachedAt);
    }
  });

  runner.test('SUB-006: invalidateAllCache() clears all cache', async () => {
    // Create subscriptions
    await mockRepo.createSubscription({
      tenantId: 105,
      planId: 1,
      status: SubscriptionStatus.active(),
      entityVersion: 1,
      originNode: 'test-node',
      logicalClock: 1,
      startsAt: '2026-06-27',
      endsAt: '2027-06-27',
    });

    await mockRepo.createSubscription({
      tenantId: 106,
      planId: 1,
      status: SubscriptionStatus.active(),
      entityVersion: 1,
      originNode: 'test-node',
      logicalClock: 1,
      startsAt: '2026-06-27',
      endsAt: '2027-06-27',
    });

    // First calls
    const result1 = await readModel.get(105);
    const result2 = await readModel.get(106);
    runner.assertTrue(result1 !== null);
    runner.assertTrue(result2 !== null);
    
    // Invalidate all cache
    readModel.invalidateAllCache();
    
    // Second calls (should fetch from repository)
    const result3 = await readModel.get(105);
    const result4 = await readModel.get(106);
    runner.assertTrue(result3 !== null);
    runner.assertTrue(result4 !== null);
  });

  // ==================== Metadata Tests ====================
  
  runner.test('SUB-006: get() includes V2.1 metadata', async () => {
    // Create subscription
    await mockRepo.createSubscription({
      tenantId: 107,
      planId: 1,
      status: SubscriptionStatus.active(),
      entityVersion: 5,
      originNode: 'node-123',
      logicalClock: 42,
      startsAt: '2026-06-27',
      endsAt: '2027-06-27',
    });

    const result = await readModel.get(107);
    
    runner.assertTrue(result !== null);
    if (result) {
      runner.assertEqual(result.entityVersion, 5);
      runner.assertEqual(result.originNode, 'node-123');
      runner.assertEqual(result.logicalClock, 42);
      runner.assertTrue(result.cachedAt > 0);
    }
  });

  // ==================== Status Mapping Tests ====================
  
  runner.test('SUB-006: Maps all subscription statuses correctly', async () => {
    const statuses = [
      { status: SubscriptionStatus.active(), expected: 'active' },
      { status: SubscriptionStatus.trial(), expected: 'trial' },
      { status: SubscriptionStatus.grace(), expected: 'grace' },
      { status: SubscriptionStatus.suspended(), expected: 'suspended' },
      { status: SubscriptionStatus.cancelled(), expected: 'cancelled' },
      { status: SubscriptionStatus.expired(), expected: 'expired' },
      { status: SubscriptionStatus.pending(), expected: 'pending' },
    ];

    for (let i = 0; i < statuses.length; i++) {
      const { status, expected } = statuses[i];
      const tenantId = 200 + i;
      
      await mockRepo.createSubscription({
        tenantId,
        planId: 1,
        status,
        entityVersion: 1,
        originNode: 'test-node',
        logicalClock: 1,
        startsAt: '2026-06-27',
        endsAt: '2027-06-27',
      });

      const result = await readModel.get(tenantId);
      runner.assertTrue(result !== null, `Failed for status ${expected}`);
      if (result) {
        runner.assertEqual(result.state, expected, `Failed for status ${expected}`);
      }
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