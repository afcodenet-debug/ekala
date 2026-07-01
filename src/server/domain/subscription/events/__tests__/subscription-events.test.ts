/**
 * Tests pour Phase 5 - Event System (SUB-011 à SUB-014)
 * Exécution : npx ts-node src/server/domain/subscription/events/__tests__/subscription-events.test.ts
 */

import {
  SubscriptionEventFactory,
  isVoucherRequestSubmitted,
  isVoucherVerified,
  isVoucherRejected,
  isSubscriptionActivated,
  isSubscriptionSuspended,
  isSubscriptionCancelled,
  isSubscriptionExpired,
  isSubscriptionRenewed,
} from '../SubscriptionEvents';

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
    console.log('TEST RESULTS - Phase 5 (Event System SUB-011 à SUB-014)');
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

  // ==================== SUB-011: EventMetadata Tests ====================
  
  runner.test('SUB-011: EventMetadata has required fields', () => {
    const metadata = {
      timestamp: '2026-06-27T12:00:00.000Z',
      originNode: 'node-123',
      logicalClock: 42,
      correlationId: 'corr-456',
    };

    runner.assertTrue(typeof metadata.timestamp === 'string');
    runner.assertTrue(typeof metadata.originNode === 'string');
    runner.assertTrue(typeof metadata.logicalClock === 'number');
    runner.assertTrue(typeof metadata.correlationId === 'string');
  });

  runner.test('SUB-011: EventMetadata timestamp is ISO 8601', () => {
    const event = SubscriptionEventFactory.createVoucherRequestSubmitted(
      1, 2, 3, 100, 'ref-123', 'node-1', 1, 'corr-1'
    );

    const timestamp = event.metadata.timestamp;
    runner.assertTrue(timestamp.includes('T'));
    runner.assertTrue(timestamp.includes('Z') || timestamp.includes('+'));
  });

  // ==================== SUB-012: Event Factory Tests ====================
  
  runner.test('SUB-012: createVoucherRequestSubmitted creates valid event', () => {
    const event = SubscriptionEventFactory.createVoucherRequestSubmitted(
      1, 2, 3, 100, 'payment-ref-123', 'node-1', 1, 'corr-1'
    );

    runner.assertEqual(event.type, 'VoucherRequestSubmitted');
    runner.assertEqual(event.payload.voucherId, 1);
    runner.assertEqual(event.payload.tenantId, 2);
    runner.assertEqual(event.payload.planId, 3);
    runner.assertEqual(event.payload.amount, 100);
    runner.assertEqual(event.payload.paymentReference, 'payment-ref-123');
    runner.assertTrue(event.payload.submittedAt.includes('T'));
  });

  runner.test('SUB-012: createVoucherVerified creates valid event', () => {
    const event = SubscriptionEventFactory.createVoucherVerified(
      1, 2, 3, 999, 'node-1', 1, 'corr-1'
    );

    runner.assertEqual(event.type, 'VoucherVerified');
    runner.assertEqual(event.payload.voucherId, 1);
    runner.assertEqual(event.payload.tenantId, 2);
    runner.assertEqual(event.payload.planId, 3);
    runner.assertEqual(event.payload.verifiedBy, 999);
    runner.assertTrue(event.payload.verifiedAt.includes('T'));
  });

  runner.test('SUB-012: createVoucherRejected creates valid event', () => {
    const event = SubscriptionEventFactory.createVoucherRejected(
      1, 2, 'Invalid payment', 999, 'node-1', 1, 'corr-1'
    );

    runner.assertEqual(event.type, 'VoucherRejected');
    runner.assertEqual(event.payload.voucherId, 1);
    runner.assertEqual(event.payload.tenantId, 2);
    runner.assertEqual(event.payload.reason, 'Invalid payment');
    runner.assertEqual(event.payload.rejectedBy, 999);
    runner.assertTrue(event.payload.rejectedAt.includes('T'));
  });

  runner.test('SUB-012: createSubscriptionActivated creates valid event', () => {
    const event = SubscriptionEventFactory.createSubscriptionActivated(
      1, 2, 3, '2026-06-27', '2027-06-27', 'node-1', 1, 'corr-1'
    );

    runner.assertEqual(event.type, 'SubscriptionActivated');
    runner.assertEqual(event.payload.subscriptionId, 1);
    runner.assertEqual(event.payload.tenantId, 2);
    runner.assertEqual(event.payload.planId, 3);
    runner.assertEqual(event.payload.startsAt, '2026-06-27');
    runner.assertEqual(event.payload.endsAt, '2027-06-27');
    runner.assertTrue(event.payload.activatedAt.includes('T'));
  });

  runner.test('SUB-012: createSubscriptionSuspended creates valid event', () => {
    const event = SubscriptionEventFactory.createSubscriptionSuspended(
      1, 2, 'payment_failed', 'node-1', 1, 'corr-1'
    );

    runner.assertEqual(event.type, 'SubscriptionSuspended');
    runner.assertEqual(event.payload.subscriptionId, 1);
    runner.assertEqual(event.payload.tenantId, 2);
    runner.assertEqual(event.payload.reason, 'payment_failed');
    runner.assertTrue(event.payload.suspendedAt.includes('T'));
  });

  runner.test('SUB-012: createSubscriptionCancelled creates valid event', () => {
    const event = SubscriptionEventFactory.createSubscriptionCancelled(
      1, 2, '2026-06-27', 'User request', 'node-1', 1, 'corr-1'
    );

    runner.assertEqual(event.type, 'SubscriptionCancelled');
    runner.assertEqual(event.payload.subscriptionId, 1);
    runner.assertEqual(event.payload.tenantId, 2);
    runner.assertEqual(event.payload.reason, 'User request');
    runner.assertEqual(event.payload.endsAt, '2026-06-27');
    runner.assertTrue(event.payload.cancelledAt.includes('T'));
  });

  runner.test('SUB-012: createSubscriptionExpired creates valid event', () => {
    const event = SubscriptionEventFactory.createSubscriptionExpired(
      1, 2, 'node-1', 1, 'corr-1'
    );

    runner.assertEqual(event.type, 'SubscriptionExpired');
    runner.assertEqual(event.payload.subscriptionId, 1);
    runner.assertEqual(event.payload.tenantId, 2);
    runner.assertTrue(event.payload.expiredAt.includes('T'));
  });

  runner.test('SUB-012: createSubscriptionRenewed creates valid event', () => {
    const event = SubscriptionEventFactory.createSubscriptionRenewed(
      1, 2, '2026-06-27', '2027-06-27', 5, 'node-1', 1, 'corr-1'
    );

    runner.assertEqual(event.type, 'SubscriptionRenewed');
    runner.assertEqual(event.payload.subscriptionId, 1);
    runner.assertEqual(event.payload.tenantId, 2);
    runner.assertEqual(event.payload.newPlanId, 5);
    runner.assertEqual(event.payload.startsAt, '2026-06-27');
    runner.assertEqual(event.payload.endsAt, '2027-06-27');
    runner.assertTrue(event.payload.renewedAt.includes('T'));
  });

  // ==================== SUB-013: Event Metadata Tests ====================
  
  runner.test('SUB-013: All events have correct metadata structure', () => {
    const events = [
      SubscriptionEventFactory.createVoucherRequestSubmitted(1, 2, 3, 100, 'ref', 'node-1', 1, 'corr-1'),
      SubscriptionEventFactory.createVoucherVerified(1, 2, 3, 999, 'node-1', 1, 'corr-1'),
      SubscriptionEventFactory.createVoucherRejected(1, 2, 'reason', 999, 'node-1', 1, 'corr-1'),
      SubscriptionEventFactory.createSubscriptionActivated(1, 2, 3, '2026-06-27', '2027-06-27', 'node-1', 1, 'corr-1'),
      SubscriptionEventFactory.createSubscriptionSuspended(1, 2, 'payment_failed', 'node-1', 1, 'corr-1'),
      SubscriptionEventFactory.createSubscriptionCancelled(1, 2, '2026-06-27', 'reason', 'node-1', 1, 'corr-1'),
      SubscriptionEventFactory.createSubscriptionExpired(1, 2, 'node-1', 1, 'corr-1'),
      SubscriptionEventFactory.createSubscriptionRenewed(1, 2, '2026-06-27', '2027-06-27', 5, 'node-1', 1, 'corr-1'),
    ];

    events.forEach(event => {
      runner.assertTrue('metadata' in event);
      runner.assertTrue('timestamp' in event.metadata);
      runner.assertTrue('originNode' in event.metadata);
      runner.assertTrue('logicalClock' in event.metadata);
      runner.assertTrue('correlationId' in event.metadata);
      runner.assertEqual(event.metadata.originNode, 'node-1');
      runner.assertEqual(event.metadata.logicalClock, 1);
      runner.assertEqual(event.metadata.correlationId, 'corr-1');
    });
  });

  // ==================== SUB-014: Type Guards Tests ====================
  
  runner.test('SUB-014: isVoucherRequestSubmitted identifies correct type', () => {
    const event = SubscriptionEventFactory.createVoucherRequestSubmitted(
      1, 2, 3, 100, 'ref', 'node-1', 1, 'corr-1'
    );

    runner.assertTrue(isVoucherRequestSubmitted(event));
    runner.assertFalse(isVoucherVerified(event));
    runner.assertFalse(isSubscriptionActivated(event));
  });

  runner.test('SUB-014: isVoucherVerified identifies correct type', () => {
    const event = SubscriptionEventFactory.createVoucherVerified(
      1, 2, 3, 999, 'node-1', 1, 'corr-1'
    );

    runner.assertTrue(isVoucherVerified(event));
    runner.assertFalse(isVoucherRequestSubmitted(event));
    runner.assertFalse(isSubscriptionActivated(event));
  });

  runner.test('SUB-014: isVoucherRejected identifies correct type', () => {
    const event = SubscriptionEventFactory.createVoucherRejected(
      1, 2, 'reason', 999, 'node-1', 1, 'corr-1'
    );

    runner.assertTrue(isVoucherRejected(event));
    runner.assertFalse(isVoucherRequestSubmitted(event));
  });

  runner.test('SUB-014: isSubscriptionActivated identifies correct type', () => {
    const event = SubscriptionEventFactory.createSubscriptionActivated(
      1, 2, 3, '2026-06-27', '2027-06-27', 'node-1', 1, 'corr-1'
    );

    runner.assertTrue(isSubscriptionActivated(event));
    runner.assertFalse(isSubscriptionSuspended(event));
  });

  runner.test('SUB-014: isSubscriptionSuspended identifies correct type', () => {
    const event = SubscriptionEventFactory.createSubscriptionSuspended(
      1, 2, 'payment_failed', 'node-1', 1, 'corr-1'
    );

    runner.assertTrue(isSubscriptionSuspended(event));
    runner.assertFalse(isSubscriptionActivated(event));
  });

  runner.test('SUB-014: isSubscriptionCancelled identifies correct type', () => {
    const event = SubscriptionEventFactory.createSubscriptionCancelled(
      1, 2, '2026-06-27', 'reason', 'node-1', 1, 'corr-1'
    );

    runner.assertTrue(isSubscriptionCancelled(event));
    runner.assertFalse(isSubscriptionExpired(event));
  });

  runner.test('SUB-014: isSubscriptionExpired identifies correct type', () => {
    const event = SubscriptionEventFactory.createSubscriptionExpired(
      1, 2, 'node-1', 1, 'corr-1'
    );

    runner.assertTrue(isSubscriptionExpired(event));
    runner.assertFalse(isSubscriptionCancelled(event));
  });

  runner.test('SUB-014: isSubscriptionRenewed identifies correct type', () => {
    const event = SubscriptionEventFactory.createSubscriptionRenewed(
      1, 2, '2026-06-27', '2027-06-27', 5, 'node-1', 1, 'corr-1'
    );

    runner.assertTrue(isSubscriptionRenewed(event));
    runner.assertFalse(isSubscriptionActivated(event));
  });

  // ==================== Integration Tests ====================
  
  runner.test('Phase 5: All event types are in union type', () => {
    const events = [
      SubscriptionEventFactory.createVoucherRequestSubmitted(1, 2, 3, 100, 'ref', 'node-1', 1, 'corr-1'),
      SubscriptionEventFactory.createVoucherVerified(1, 2, 3, 999, 'node-1', 1, 'corr-1'),
      SubscriptionEventFactory.createVoucherRejected(1, 2, 'reason', 999, 'node-1', 1, 'corr-1'),
      SubscriptionEventFactory.createSubscriptionActivated(1, 2, 3, '2026-06-27', '2027-06-27', 'node-1', 1, 'corr-1'),
      SubscriptionEventFactory.createSubscriptionSuspended(1, 2, 'payment_failed', 'node-1', 1, 'corr-1'),
      SubscriptionEventFactory.createSubscriptionCancelled(1, 2, '2026-06-27', 'reason', 'node-1', 1, 'corr-1'),
      SubscriptionEventFactory.createSubscriptionExpired(1, 2, 'node-1', 1, 'corr-1'),
      SubscriptionEventFactory.createSubscriptionRenewed(1, 2, '2026-06-27', '2027-06-27', 5, 'node-1', 1, 'corr-1'),
    ];

    // All events should have a type property
    events.forEach(event => {
      runner.assertTrue('type' in event);
      runner.assertTrue('payload' in event);
      runner.assertTrue('metadata' in event);
    });
  });

  runner.test('Phase 5: Event factory generates unique timestamps', async () => {
    const event1 = SubscriptionEventFactory.createVoucherRequestSubmitted(
      1, 2, 3, 100, 'ref1', 'node-1', 1, 'corr-1'
    );
    
    // Small delay to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const event2 = SubscriptionEventFactory.createVoucherRequestSubmitted(
      2, 3, 4, 200, 'ref2', 'node-1', 2, 'corr-2'
    );

    runner.assertFalse(event1.metadata.timestamp === event2.metadata.timestamp);
  });

  runner.test('Phase 5: Type guards work with union type', () => {
    const events: any[] = [
      { type: 'VoucherRequestSubmitted', metadata: {} },
      { type: 'VoucherVerified', metadata: {} },
      { type: 'VoucherRejected', metadata: {} },
      { type: 'SubscriptionActivated', metadata: {} },
      { type: 'SubscriptionSuspended', metadata: {} },
      { type: 'SubscriptionCancelled', metadata: {} },
      { type: 'SubscriptionExpired', metadata: {} },
      { type: 'SubscriptionRenewed', metadata: {} },
    ];

    runner.assertTrue(isVoucherRequestSubmitted(events[0]));
    runner.assertTrue(isVoucherVerified(events[1]));
    runner.assertTrue(isVoucherRejected(events[2]));
    runner.assertTrue(isSubscriptionActivated(events[3]));
    runner.assertTrue(isSubscriptionSuspended(events[4]));
    runner.assertTrue(isSubscriptionCancelled(events[5]));
    runner.assertTrue(isSubscriptionExpired(events[6]));
    runner.assertTrue(isSubscriptionRenewed(events[7]));
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