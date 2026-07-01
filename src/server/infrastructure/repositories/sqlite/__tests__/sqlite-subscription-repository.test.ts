/**
 * Tests d'intégration pour SUB-008 (SqliteSubscriptionRepository)
 * Exécution : npx ts-node src/server/infrastructure/repositories/sqlite/__tests__/sqlite-subscription-repository.test.ts
 */

import { SqliteSubscriptionRepository } from '../SqliteSubscriptionRepository';
import { SubscriptionStatus } from '../../../../domain/subscription/value-objects/SubscriptionStatus';
import { VoucherStatus } from '../../../../domain/subscription/value-objects/VoucherStatus';

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

  summary() {
    console.log('\n' + '='.repeat(60));
    console.log('TEST RESULTS - SUB-008 (SqliteSubscriptionRepository)');
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

// Run tests
async function runTests() {
  const runner = new TestRunner();
  const repo = new SqliteSubscriptionRepository();

  // ==================== Subscription CRUD Tests ====================
  
  runner.test('SUB-008: createSubscription() creates and returns subscription', async () => {
    const subscription = await repo.createSubscription({
      tenantId: 1,
      planId: 1,
      status: SubscriptionStatus.pending(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'test-node',
    });

    runner.assertTrue(subscription.id > 0);
    runner.assertEqual(subscription.tenantId, 1);
    runner.assertEqual(subscription.planId, 1);
    runner.assertTrue(subscription.status.toString() === 'pending');
    runner.assertEqual(subscription.entityVersion, 1);
  });

  runner.test('SUB-008: findSubscriptionById() returns subscription', async () => {
    const created = await repo.createSubscription({
      tenantId: 2,
      planId: 2,
      status: SubscriptionStatus.active(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'test-node',
    });

    const found = await repo.findSubscriptionById(created.id);
    
    runner.assertTrue(found !== null);
    if (found) {
      runner.assertEqual(found.id, created.id);
      runner.assertEqual(found.tenantId, 2);
      runner.assertTrue(found.status.toString() === 'active');
    }
  });

  runner.test('SUB-008: findSubscriptionById() returns null for non-existent', async () => {
    const found = await repo.findSubscriptionById(99999);
    runner.assertTrue(found === null);
  });

  runner.test('SUB-008: findActiveSubscriptionByTenantId() returns active subscription', async () => {
    const created = await repo.createSubscription({
      tenantId: 3,
      planId: 1,
      status: SubscriptionStatus.active(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'test-node',
    });

    const found = await repo.findActiveSubscriptionByTenantId(3);
    
    runner.assertTrue(found !== null);
    if (found) {
      runner.assertEqual(found.id, created.id);
      runner.assertTrue(found.status.toString() === 'active');
    }
  });

  runner.test('SUB-008: findAllSubscriptionsByTenantId() returns all subscriptions', async () => {
    await repo.createSubscription({
      tenantId: 4,
      planId: 1,
      status: SubscriptionStatus.active(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'test-node',
    });

    await repo.createSubscription({
      tenantId: 4,
      planId: 2,
      status: SubscriptionStatus.expired(),
      startsAt: '2026-01-01',
      endsAt: '2026-02-01',
      originNode: 'test-node',
    });

    const all = await repo.findAllSubscriptionsByTenantId(4);
    runner.assertEqual(all.length, 2);
  });

  runner.test('SUB-008: updateSubscription() updates and returns subscription', async () => {
    const created = await repo.createSubscription({
      tenantId: 5,
      planId: 1,
      status: SubscriptionStatus.active(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'test-node',
    });

    const updated = await repo.updateSubscription(
      created.id,
      { status: SubscriptionStatus.suspended() },
      created.entityVersion
    );

    runner.assertTrue(updated.status.toString() === 'suspended');
    runner.assertEqual(updated.entityVersion, 2);
  });

  runner.test('SUB-008: updateSubscription() throws on concurrent update', async () => {
    const created = await repo.createSubscription({
      tenantId: 6,
      planId: 1,
      status: SubscriptionStatus.active(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'test-node',
    });

    try {
      await repo.updateSubscription(
        created.id,
        { status: SubscriptionStatus.suspended() },
        999 // Wrong version
      );
      runner.assertTrue(false, 'Should have thrown');
    } catch (error: any) {
      runner.assertTrue(error.message.includes('Concurrent update'));
    }
  });

  runner.test('SUB-008: deleteSubscription() deletes subscription', async () => {
    const created = await repo.createSubscription({
      tenantId: 7,
      planId: 1,
      status: SubscriptionStatus.active(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'test-node',
    });

    await repo.deleteSubscription(created.id);
    
    const found = await repo.findSubscriptionById(created.id);
    runner.assertTrue(found === null);
  });

  runner.test('SUB-008: countActiveSubscriptions() returns correct count', async () => {
    const count = await repo.countActiveSubscriptions();
    runner.assertTrue(typeof count === 'number');
    runner.assertTrue(count >= 0);
  });

  // ==================== Voucher CRUD Tests ====================
  
  runner.test('SUB-008: createVoucher() creates and returns voucher', async () => {
    const voucher = await repo.createVoucher({
      tenantId: 1,
      planId: 1,
      amount: 100,
      paymentReference: 'REF-001',
      expiresAt: '2026-07-27',
    });

    runner.assertTrue(voucher.id > 0);
    runner.assertEqual(voucher.tenantId, 1);
    runner.assertEqual(voucher.amount, 100);
    runner.assertTrue(voucher.status.toString() === 'pending');
  });

  runner.test('SUB-008: findVoucherById() returns voucher', async () => {
    const created = await repo.createVoucher({
      tenantId: 2,
      planId: 1,
      amount: 200,
      paymentReference: 'REF-002',
      expiresAt: '2026-07-27',
    });

    const found = await repo.findVoucherById(created.id);
    
    runner.assertTrue(found !== null);
    if (found) {
      runner.assertEqual(found.id, created.id);
      runner.assertEqual(found.amount, 200);
    }
  });

  runner.test('SUB-008: findVoucherByPaymentReference() returns voucher', async () => {
    const created = await repo.createVoucher({
      tenantId: 3,
      planId: 1,
      amount: 300,
      paymentReference: 'REF-003',
      expiresAt: '2026-07-27',
    });

    const found = await repo.findVoucherByPaymentReference('REF-003');
    
    runner.assertTrue(found !== null);
    if (found) {
      runner.assertEqual(found.id, created.id);
    }
  });

  runner.test('SUB-008: findAllVouchersByTenantId() returns all vouchers', async () => {
    await repo.createVoucher({
      tenantId: 4,
      planId: 1,
      amount: 100,
      paymentReference: 'REF-004',
      expiresAt: '2026-07-27',
    });

    const all = await repo.findAllVouchersByTenantId(4);
    runner.assertTrue(all.length >= 1);
  });

  runner.test('SUB-008: findPendingVouchers() returns pending vouchers', async () => {
    const pending = await repo.findPendingVouchers();
    runner.assertTrue(Array.isArray(pending));
  });

  runner.test('SUB-008: updateVoucher() updates voucher', async () => {
    const created = await repo.createVoucher({
      tenantId: 5,
      planId: 1,
      amount: 500,
      paymentReference: 'REF-005',
      expiresAt: '2026-07-27',
    });

    const updated = await repo.updateVoucher(created.id, {
      status: VoucherStatus.verified(),
      verifiedBy: 1,
      verifiedAt: new Date().toISOString(),
    });

    runner.assertTrue(updated.status.toString() === 'verified');
    runner.assertTrue(updated.verifiedBy === 1);
  });

  runner.test('SUB-008: countVouchersByStatus() returns correct count', async () => {
    const count = await repo.countVouchersByStatus(VoucherStatus.pending());
    runner.assertTrue(typeof count === 'number');
    runner.assertTrue(count >= 0);
  });

  // ==================== Plan Tests ====================
  
  runner.test('SUB-008: findAllActivePlans() returns plans', async () => {
    const plans = await repo.findAllActivePlans();
    runner.assertTrue(Array.isArray(plans));
  });

  runner.test('SUB-008: findAllPlans() returns all plans', async () => {
    const plans = await repo.findAllPlans();
    runner.assertTrue(Array.isArray(plans));
  });

  // ==================== Query Methods Tests ====================
  
  runner.test('SUB-008: findSubscriptionSummaries() returns summaries', async () => {
    const summaries = await repo.findSubscriptionSummaries(0, 10);
    runner.assertTrue(Array.isArray(summaries));
  });

  runner.test('SUB-008: findVoucherSummaries() returns summaries', async () => {
    const summaries = await repo.findVoucherSummaries(0, 10);
    runner.assertTrue(Array.isArray(summaries));
  });

  runner.test('SUB-008: getSubscriptionStats() returns stats', async () => {
    const stats = await repo.getSubscriptionStats();
    runner.assertTrue(typeof stats.totalActive === 'number');
    runner.assertTrue(typeof stats.totalRevenue === 'number');
  });

  runner.test('SUB-008: getVoucherStats() returns stats', async () => {
    const stats = await repo.getVoucherStats();
    runner.assertTrue(typeof stats.totalPending === 'number');
    runner.assertTrue(typeof stats.totalRevenue === 'number');
  });

  // ==================== Transaction Tests ====================
  
  runner.test('SUB-008: transaction() executes function in transaction', async () => {
    const result = await repo.transaction(async () => {
      const sub = await repo.createSubscription({
        tenantId: 999,
        planId: 1,
        status: SubscriptionStatus.pending(),
        startsAt: '2026-06-27',
        endsAt: '2026-07-27',
        originNode: 'test-node',
      });
      return sub.id;
    });

    runner.assertTrue(result > 0);
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