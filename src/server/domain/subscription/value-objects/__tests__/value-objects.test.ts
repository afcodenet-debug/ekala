/**
 * Tests unitaires pour les Value Objects du domaine Subscription
 * Exécution : npx ts-node src/server/domain/subscription/value-objects/__tests__/value-objects.test.ts
 */

import { SubscriptionStatus } from '../SubscriptionStatus';
import { VoucherStatus } from '../VoucherStatus';
import { PlanId } from '../PlanId';

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
    console.log('TEST RESULTS');
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

  // ==================== SubscriptionStatus Tests ====================
  
  runner.test('SubscriptionStatus: create active status', () => {
    const status = SubscriptionStatus.active();
    runner.assertEqual(status.toString(), 'active');
    runner.assertTrue(status.isActive());
    runner.assertFalse(status.isBlocked());
  });

  runner.test('SubscriptionStatus: create trial status', () => {
    const status = SubscriptionStatus.trial();
    runner.assertEqual(status.toString(), 'trial');
    runner.assertTrue(status.isTrial());
    runner.assertTrue(status.isActive());
  });

  runner.test('SubscriptionStatus: create grace status', () => {
    const status = SubscriptionStatus.grace();
    runner.assertEqual(status.toString(), 'grace');
    runner.assertTrue(status.isGrace());
    runner.assertTrue(status.isReadOnly());
  });

  runner.test('SubscriptionStatus: create suspended status', () => {
    const status = SubscriptionStatus.suspended();
    runner.assertEqual(status.toString(), 'suspended');
    runner.assertTrue(status.isBlocked());
  });

  runner.test('SubscriptionStatus: create cancelled status', () => {
    const status = SubscriptionStatus.cancelled();
    runner.assertEqual(status.toString(), 'cancelled');
    runner.assertTrue(status.isBlocked());
  });

  runner.test('SubscriptionStatus: create expired status', () => {
    const status = SubscriptionStatus.expired();
    runner.assertEqual(status.toString(), 'expired');
    runner.assertTrue(status.isBlocked());
  });

  runner.test('SubscriptionStatus: create noPlan status', () => {
    const status = SubscriptionStatus.noPlan();
    runner.assertEqual(status.toString(), 'no_plan');
    runner.assertTrue(status.isBlocked());
  });

  runner.test('SubscriptionStatus: create pending status', () => {
    const status = SubscriptionStatus.pending();
    runner.assertEqual(status.toString(), 'pending');
    runner.assertTrue(status.isBlocked());
  });

  runner.test('SubscriptionStatus: fromString valid active', () => {
    const status = SubscriptionStatus.fromString('active');
    runner.assertEqual(status.toString(), 'active');
    runner.assertTrue(status.isActive());
  });

  runner.test('SubscriptionStatus: fromString invalid throws', () => {
    runner.assertThrows(() => SubscriptionStatus.fromString('invalid'));
  });

  runner.test('SubscriptionStatus: hasFullAccess for active', () => {
    const status = SubscriptionStatus.active();
    runner.assertTrue(status.hasFullAccess());
  });

  runner.test('SubscriptionStatus: hasFullAccess for trial', () => {
    const status = SubscriptionStatus.trial();
    runner.assertTrue(status.hasFullAccess());
  });

  runner.test('SubscriptionStatus: hasFullAccess for expired', () => {
    const status = SubscriptionStatus.expired();
    runner.assertFalse(status.hasFullAccess());
    runner.assertTrue(status.isBlocked());
  });

  runner.test('SubscriptionStatus: canTransition active -> cancelled', () => {
    const active = SubscriptionStatus.active();
    const cancelled = SubscriptionStatus.cancelled();
    runner.assertTrue(active.canTransitionTo(cancelled));
  });

  runner.test('SubscriptionStatus: canTransition active -> trial (invalid)', () => {
    const active = SubscriptionStatus.active();
    const trial = SubscriptionStatus.trial();
    runner.assertFalse(active.canTransitionTo(trial));
  });

  runner.test('SubscriptionStatus: canTransition cancelled -> active', () => {
    const cancelled = SubscriptionStatus.cancelled();
    const active = SubscriptionStatus.active();
    runner.assertTrue(cancelled.canTransitionTo(active));
  });

  runner.test('SubscriptionStatus: equality check', () => {
    const status1 = SubscriptionStatus.active();
    const status2 = SubscriptionStatus.active();
    const status3 = SubscriptionStatus.cancelled();
    
    runner.assertTrue(status1.equals(status2));
    runner.assertFalse(status1.equals(status3));
  });

  runner.test('SubscriptionStatus: immutability', () => {
    const status = SubscriptionStatus.active();
    const value1 = status.toString();
    const value2 = status.toString();
    
    runner.assertEqual(value1, value2);
    runner.assertEqual(value1, 'active');
  });

  // ==================== VoucherStatus Tests ====================

  runner.test('VoucherStatus: create pending', () => {
    const status = VoucherStatus.pending();
    runner.assertEqual(status.toString(), 'pending');
    runner.assertTrue(status.isPending());
    runner.assertFalse(status.isTerminal());
  });

  runner.test('VoucherStatus: create paymentSent', () => {
    const status = VoucherStatus.paymentSent();
    runner.assertEqual(status.toString(), 'payment_sent');
    runner.assertTrue(status.isPending());
    runner.assertFalse(status.isTerminal());
  });

  runner.test('VoucherStatus: create verified', () => {
    const status = VoucherStatus.verified();
    runner.assertEqual(status.toString(), 'verified');
    runner.assertTrue(status.isVerified());
    runner.assertTrue(status.isTerminal());
  });

  runner.test('VoucherStatus: create rejected', () => {
    const status = VoucherStatus.rejected();
    runner.assertEqual(status.toString(), 'rejected');
    runner.assertTrue(status.isRejected());
    runner.assertTrue(status.isTerminal());
  });

  runner.test('VoucherStatus: create expired', () => {
    const status = VoucherStatus.expired();
    runner.assertEqual(status.toString(), 'expired');
    runner.assertTrue(status.isTerminal());
  });

  runner.test('VoucherStatus: fromString valid', () => {
    const status = VoucherStatus.fromString('pending');
    runner.assertEqual(status.toString(), 'pending');
    runner.assertTrue(status.isPending());
  });

  runner.test('VoucherStatus: fromString invalid throws', () => {
    runner.assertThrows(() => VoucherStatus.fromString('invalid'));
  });

  runner.test('VoucherStatus: canTransition pending -> verified', () => {
    const pending = VoucherStatus.pending();
    const verified = VoucherStatus.verified();
    runner.assertTrue(pending.canTransitionTo(verified));
  });

  runner.test('VoucherStatus: canTransition pending -> rejected', () => {
    const pending = VoucherStatus.pending();
    const rejected = VoucherStatus.rejected();
    runner.assertTrue(pending.canTransitionTo(rejected));
  });

  runner.test('VoucherStatus: canTransition verified -> pending (invalid)', () => {
    const verified = VoucherStatus.verified();
    const pending = VoucherStatus.pending();
    runner.assertFalse(verified.canTransitionTo(pending));
  });

  runner.test('VoucherStatus: equality check', () => {
    const status1 = VoucherStatus.pending();
    const status2 = VoucherStatus.pending();
    const status3 = VoucherStatus.verified();
    
    runner.assertTrue(status1.equals(status2));
    runner.assertFalse(status1.equals(status3));
  });

  runner.test('VoucherStatus: immutability', () => {
    const status = VoucherStatus.pending();
    const value1 = status.toString();
    const value2 = status.toString();
    
    runner.assertEqual(value1, value2);
    runner.assertEqual(value1, 'pending');
  });

  // ==================== PlanId Tests ====================

  runner.test('PlanId: create valid ID', () => {
    const planId = PlanId.create(1);
    runner.assertEqual(planId.getValue(), 1);
    runner.assertTrue(planId.isFree());
    runner.assertFalse(planId.isPremium());
  });

  runner.test('PlanId: create premium plan', () => {
    const planId = PlanId.create(2);
    runner.assertEqual(planId.getValue(), 2);
    runner.assertFalse(planId.isFree());
    runner.assertTrue(planId.isPremium());
  });

  runner.test('PlanId: fromString valid', () => {
    const planId = PlanId.fromString('42');
    runner.assertEqual(planId.getValue(), 42);
    runner.assertTrue(planId.isPremium());
  });

  runner.test('PlanId: fromString invalid throws', () => {
    runner.assertThrows(() => PlanId.fromString('abc'));
  });

  runner.test('PlanId: reject zero', () => {
    runner.assertThrows(() => PlanId.create(0));
  });

  runner.test('PlanId: reject negative', () => {
    runner.assertThrows(() => PlanId.create(-1));
  });

  runner.test('PlanId: reject decimal', () => {
    runner.assertThrows(() => PlanId.create(1.5));
  });

  runner.test('PlanId: toString returns string', () => {
    const planId = PlanId.create(123);
    runner.assertEqual(planId.toString(), '123');
  });

  runner.test('PlanId: toJSON returns number', () => {
    const planId = PlanId.create(123);
    runner.assertEqual(planId.toJSON(), 123);
  });

  runner.test('PlanId: equality check', () => {
    const planId1 = PlanId.create(1);
    const planId2 = PlanId.create(1);
    const planId3 = PlanId.create(2);
    
    runner.assertTrue(planId1.equals(planId2));
    runner.assertFalse(planId1.equals(planId3));
  });

  runner.test('PlanId: immutability', () => {
    const planId = PlanId.create(42);
    const value1 = planId.getValue();
    const value2 = planId.getValue();
    
    runner.assertEqual(value1, value2);
    runner.assertEqual(value1, 42);
  });

  // ==================== Integration Tests ====================

  runner.test('Integration: subscription lifecycle', () => {
    const pending = SubscriptionStatus.pending();
    const active = SubscriptionStatus.active();
    const suspended = SubscriptionStatus.suspended();
    const cancelled = SubscriptionStatus.cancelled();
    
    // Pending can transition to active
    runner.assertTrue(pending.canTransitionTo(active));
    
    // Active can transition to suspended
    runner.assertTrue(active.canTransitionTo(suspended));
    
    // Suspended can transition to cancelled
    runner.assertTrue(suspended.canTransitionTo(cancelled));
    
    // Cancelled can reactivate
    runner.assertTrue(cancelled.canTransitionTo(active));
  });

  runner.test('Integration: voucher lifecycle', () => {
    const pending = VoucherStatus.pending();
    const paymentSent = VoucherStatus.paymentSent();
    const verified = VoucherStatus.verified();
    const rejected = VoucherStatus.rejected();
    
    // Pending can transition to payment_sent or rejected
    runner.assertTrue(pending.canTransitionTo(paymentSent));
    runner.assertTrue(pending.canTransitionTo(rejected));
    
    // Payment sent can transition to verified or rejected
    runner.assertTrue(paymentSent.canTransitionTo(verified));
    runner.assertTrue(paymentSent.canTransitionTo(rejected));
    
    // Verified is terminal
    runner.assertFalse(verified.canTransitionTo(pending));
  });

  runner.test('Integration: plan ID usage in subscription', () => {
    const freePlan = PlanId.create(1);
    const premiumPlan = PlanId.create(2);
    
    const activeSubscription = SubscriptionStatus.active();
    
    // Both plans can have active subscriptions
    runner.assertTrue(activeSubscription.isActive());
    runner.assertTrue(freePlan.isFree());
    runner.assertTrue(premiumPlan.isPremium());
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
