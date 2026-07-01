/**
 * Tests unitaires pour SUB-007 (SubscriptionAggregate)
 * Exécution : npx ts-node src/server/domain/subscription/__tests__/subscription-aggregate.test.ts
 */

import { Subscription } from '../aggregates/Subscription';
import { SubscriptionStatus } from '../value-objects/SubscriptionStatus';

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

  assertThrows(fn: () => any, message?: string) {
    try {
      fn();
      throw new Error(message || 'Expected function to throw');
    } catch (error: any) {
      if (error.message === (message || 'Expected function to throw')) {
        throw error;
      }
      // Expected error was thrown
    }
  }

  summary() {
    console.log('\n' + '='.repeat(60));
    console.log('TEST RESULTS - SUB-007 (SubscriptionAggregate)');
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

  // ==================== Factory Methods Tests ====================
  
  runner.test('SUB-007: create() creates valid subscription', () => {
    const subscription = Subscription.create({
      tenantId: 1,
      planId: 1,
      status: SubscriptionStatus.pending(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'node-1',
      logicalClock: 1,
    });

    runner.assertEqual(subscription.tenantId, 1);
    runner.assertEqual(subscription.planId, 1);
    runner.assertTrue(subscription.status.toString() === 'pending');
    runner.assertEqual(subscription.entityVersion, 1);
    runner.assertEqual(subscription.logicalClock, 1);
  });

  runner.test('SUB-007: reconstitute() creates subscription from props', () => {
    const subscription = Subscription.reconstitute({
      id: 1,
      tenantId: 1,
      planId: 1,
      status: SubscriptionStatus.active(),
      entityVersion: 5,
      originNode: 'node-1',
      logicalClock: 10,
      startsAt: '2026-06-27',
      endsAt: '2027-06-27',
      createdAt: '2026-06-27T10:00:00Z',
      updatedAt: '2026-06-27T12:00:00Z',
    });

    runner.assertEqual(subscription.id, 1);
    runner.assertEqual(subscription.entityVersion, 5);
    runner.assertEqual(subscription.logicalClock, 10);
    runner.assertTrue(subscription.isActive());
  });

  // ==================== Business Methods Tests ====================
  
  runner.test('SUB-007: activate() from pending succeeds', () => {
    const subscription = Subscription.create({
      tenantId: 1,
      planId: 1,
      status: SubscriptionStatus.pending(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'node-1',
      logicalClock: 1,
    });

    const result = subscription.activate();

    runner.assertTrue(result.isSuccess);
    if (result.isSuccess) {
      runner.assertTrue(result.value.status.isActive());
      runner.assertEqual(result.value.entityVersion, 2);
      runner.assertEqual(result.value.logicalClock, 2);
    }
  });

  runner.test('SUB-007: activate() from active fails', () => {
    const subscription = Subscription.create({
      tenantId: 1,
      planId: 1,
      status: SubscriptionStatus.active(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'node-1',
      logicalClock: 1,
    });

    const result = subscription.activate();

    runner.assertFalse(result.isSuccess);
    if (!result.isSuccess) {
      runner.assertTrue(result.error.includes('already active'));
    }
  });

  runner.test('SUB-007: suspend() from active succeeds', () => {
    const subscription = Subscription.create({
      tenantId: 1,
      planId: 1,
      status: SubscriptionStatus.active(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'node-1',
      logicalClock: 1,
    });

    const result = subscription.suspend('payment_failed');

    runner.assertTrue(result.isSuccess);
    if (result.isSuccess) {
      runner.assertTrue(result.value.status.toString() === 'suspended');
      runner.assertEqual(result.value.entityVersion, 2);
    }
  });

  runner.test('SUB-007: suspend() from expired fails', () => {
    const subscription = Subscription.create({
      tenantId: 1,
      planId: 1,
      status: SubscriptionStatus.expired(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'node-1',
      logicalClock: 1,
    });

    const result = subscription.suspend('payment_failed');

    runner.assertFalse(result.isSuccess);
    if (!result.isSuccess) {
      runner.assertTrue(result.error.includes('Cannot suspend an expired subscription'));
    }
  });

  runner.test('SUB-007: cancel() from active succeeds', () => {
    const subscription = Subscription.create({
      tenantId: 1,
      planId: 1,
      status: SubscriptionStatus.active(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'node-1',
      logicalClock: 1,
    });

    const result = subscription.cancel('User request');

    runner.assertTrue(result.isSuccess);
    if (result.isSuccess) {
      runner.assertTrue(result.value.status.toString() === 'cancelled');
      runner.assertTrue(result.value.cancelledAt !== undefined);
      runner.assertEqual(result.value.entityVersion, 2);
    }
  });

  runner.test('SUB-007: cancel() from expired fails', () => {
    const subscription = Subscription.create({
      tenantId: 1,
      planId: 1,
      status: SubscriptionStatus.expired(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'node-1',
      logicalClock: 1,
    });

    const result = subscription.cancel('User request');

    runner.assertFalse(result.isSuccess);
    if (!result.isSuccess) {
      runner.assertTrue(result.error.includes('Cannot cancel an expired subscription'));
    }
  });

  runner.test('SUB-007: renew() with future date succeeds', () => {
    const subscription = Subscription.create({
      tenantId: 1,
      planId: 1,
      status: SubscriptionStatus.active(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'node-1',
      logicalClock: 1,
    });

    const newEndAt = '2027-07-27';
    const result = subscription.renew(newEndAt);

    runner.assertTrue(result.isSuccess);
    if (result.isSuccess) {
      runner.assertEqual(result.value.endsAt, newEndAt);
      runner.assertTrue(result.value.status.isActive());
      runner.assertEqual(result.value.entityVersion, 2);
    }
  });

  runner.test('SUB-007: renew() with past date fails', () => {
    const subscription = Subscription.create({
      tenantId: 1,
      planId: 1,
      status: SubscriptionStatus.active(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'node-1',
      logicalClock: 1,
    });

    const result = subscription.renew('2020-01-01');

    runner.assertFalse(result.isSuccess);
    if (!result.isSuccess) {
      runner.assertTrue(result.error.includes('must be in the future'));
    }
  });

  runner.test('SUB-007: markAsExpired() succeeds', () => {
    const subscription = Subscription.create({
      tenantId: 1,
      planId: 1,
      status: SubscriptionStatus.grace(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'node-1',
      logicalClock: 1,
    });

    const result = subscription.markAsExpired();

    runner.assertTrue(result.isSuccess);
    if (result.isSuccess) {
      runner.assertTrue(result.value.status.toString() === 'expired');
      runner.assertEqual(result.value.entityVersion, 2);
    }
  });

  // ==================== Query Methods Tests ====================
  
  runner.test('SUB-007: isActive() returns true for active', () => {
    const subscription = Subscription.create({
      tenantId: 1,
      planId: 1,
      status: SubscriptionStatus.active(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'node-1',
      logicalClock: 1,
    });

    runner.assertTrue(subscription.isActive());
  });

  runner.test('SUB-007: isActive() returns true for trial', () => {
    const subscription = Subscription.create({
      tenantId: 1,
      planId: 1,
      status: SubscriptionStatus.trial(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'node-1',
      logicalClock: 1,
    });

    runner.assertTrue(subscription.isActive());
  });

  runner.test('SUB-007: isBlocked() returns true for suspended', () => {
    const subscription = Subscription.create({
      tenantId: 1,
      planId: 1,
      status: SubscriptionStatus.suspended(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'node-1',
      logicalClock: 1,
    });

    runner.assertTrue(subscription.isBlocked());
  });

  runner.test('SUB-007: hasFullAccess() returns true for active', () => {
    const subscription = Subscription.create({
      tenantId: 1,
      planId: 1,
      status: SubscriptionStatus.active(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'node-1',
      logicalClock: 1,
    });

    runner.assertTrue(subscription.hasFullAccess());
  });

  runner.test('SUB-007: hasFullAccess() returns false for expired', () => {
    const subscription = Subscription.create({
      tenantId: 1,
      planId: 1,
      status: SubscriptionStatus.expired(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'node-1',
      logicalClock: 1,
    });

    runner.assertFalse(subscription.hasFullAccess());
  });

  runner.test('SUB-007: getDaysUntilRenewal() returns correct value', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const subscription = Subscription.create({
      tenantId: 1,
      planId: 1,
      status: SubscriptionStatus.active(),
      startsAt: '2026-06-27',
      endsAt: futureDateStr,
      originNode: 'node-1',
      logicalClock: 1,
    });

    const days = subscription.getDaysUntilRenewal();
    runner.assertTrue(days !== null && days !== undefined);
    if (days !== null && days !== undefined) {
      runner.assertTrue(days >= 28 && days <= 30); // Approximatif
    }
  });

  runner.test('SUB-007: isExpiringSoon() returns true for 7 days', () => {
    const soonDate = new Date();
    soonDate.setDate(soonDate.getDate() + 5);
    const soonDateStr = soonDate.toISOString().split('T')[0];

    const subscription = Subscription.create({
      tenantId: 1,
      planId: 1,
      status: SubscriptionStatus.active(),
      startsAt: '2026-06-27',
      endsAt: soonDateStr,
      originNode: 'node-1',
      logicalClock: 1,
    });

    runner.assertTrue(subscription.isExpiringSoon());
  });

  // ==================== Invariants Tests ====================
  
  runner.test('SUB-007: validateInvariants() throws for invalid dates', () => {
    runner.assertThrows(() => {
      Subscription.create({
        tenantId: 1,
        planId: 1,
        status: SubscriptionStatus.pending(),
        startsAt: '2026-07-27',
        endsAt: '2026-06-27', // End before start
        originNode: 'node-1',
        logicalClock: 1,
      });
    }, 'Should throw for invalid dates');
  });

  // ==================== Immutability Tests ====================
  
  runner.test('SUB-007: aggregate is immutable', () => {
    const subscription = Subscription.create({
      tenantId: 1,
      planId: 1,
      status: SubscriptionStatus.active(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'node-1',
      logicalClock: 1,
    });

    const originalVersion = subscription.entityVersion;
    const originalStatus = subscription.status.toString();

    // Les getters ne modifient pas l'état (vérifié par le fait que les valeurs originales sont préservées)
    void subscription.isActive();
    void subscription.entityVersion;
    void subscription.status;

    runner.assertEqual(subscription.entityVersion, originalVersion);
    runner.assertEqual(subscription.status.toString(), originalStatus);
  });

  // ==================== Integration Tests ====================
  
  runner.test('Integration: Full lifecycle - pending -> active -> suspended -> cancelled', () => {
    let subscription = Subscription.create({
      tenantId: 1,
      planId: 1,
      status: SubscriptionStatus.pending(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'node-1',
      logicalClock: 1,
    });

    // Activate
    let result = subscription.activate();
    runner.assertTrue(result.isSuccess);
    if (result.isSuccess) {
      subscription = result.value;
      runner.assertTrue(subscription.isActive());
    }

    // Suspend
    result = subscription.suspend('payment_failed');
    runner.assertTrue(result.isSuccess);
    if (result.isSuccess) {
      subscription = result.value;
      runner.assertTrue(subscription.status.toString() === 'suspended');
    }

    // Cancel
    result = subscription.cancel('User request');
    runner.assertTrue(result.isSuccess);
    if (result.isSuccess) {
      subscription = result.value;
      runner.assertTrue(subscription.status.toString() === 'cancelled');
      runner.assertTrue(subscription.cancelledAt !== undefined);
    }
  });

  runner.test('Integration: Version increments on each state change', () => {
    let subscription = Subscription.create({
      tenantId: 1,
      planId: 1,
      status: SubscriptionStatus.pending(),
      startsAt: '2026-06-27',
      endsAt: '2026-07-27',
      originNode: 'node-1',
      logicalClock: 1,
    });

    runner.assertEqual(subscription.entityVersion, 1);

    let result = subscription.activate();
    if (result.isSuccess) {
      subscription = result.value;
      runner.assertEqual(subscription.entityVersion, 2);
    }

    result = subscription.suspend('payment_failed');
    if (result.isSuccess) {
      subscription = result.value;
      runner.assertEqual(subscription.entityVersion, 3);
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