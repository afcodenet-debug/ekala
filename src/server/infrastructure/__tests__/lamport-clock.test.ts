/**
 * Tests pour SUB-004 (LamportClock)
 * Exécution : npx ts-node src/server/infrastructure/__tests__/lamport-clock.test.ts
 */

import { LamportClockFactory } from '../lamport-clock.service';

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
    console.log('TEST RESULTS - SUB-004 (LamportClock)');
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

  // Reset factory before tests
  LamportClockFactory.reset();

  // ==================== Basic Tests ====================
  
  runner.test('SUB-004: create() returns instance', () => {
    const clock = LamportClockFactory.create();
    runner.assertTrue(clock !== null);
    runner.assertTrue(clock.getTime() >= 0);
  });

  runner.test('SUB-004: create() returns singleton', () => {
    const clock1 = LamportClockFactory.create();
    const clock2 = LamportClockFactory.create();
    runner.assertEqual(clock1, clock2);
  });

  runner.test('SUB-004: getTime() returns initial time', () => {
    LamportClockFactory.reset();
    const clock = LamportClockFactory.create();
    const time = clock.getTime();
    runner.assertTrue(typeof time === 'number');
    runner.assertTrue(time >= 0);
  });

  // ==================== increment() Tests ====================
  
  runner.test('SUB-004: increment() increases time by 1', () => {
    LamportClockFactory.reset();
    const clock = LamportClockFactory.create();
    const initial = clock.getTime();
    const newTime = clock.increment();
    runner.assertEqual(newTime, initial + 1);
    runner.assertEqual(clock.getTime(), initial + 1);
  });

  runner.test('SUB-004: increment() returns incremented value', () => {
    LamportClockFactory.reset();
    const clock = LamportClockFactory.create();
    const result1 = clock.increment();
    const result2 = clock.increment();
    runner.assertEqual(result1, 1);
    runner.assertEqual(result2, 2);
  });

  runner.test('SUB-004: increment() can be called multiple times', () => {
    LamportClockFactory.reset();
    const clock = LamportClockFactory.create();
    clock.increment();
    clock.increment();
    clock.increment();
    runner.assertEqual(clock.getTime(), 3);
  });

  // ==================== observe() Tests ====================
  
  runner.test('SUB-004: observe() with lower time does not decrease', () => {
    LamportClockFactory.reset();
    const clock = LamportClockFactory.create();
    clock.increment(); // time = 1
    clock.observe(0); // should stay at 2 (max(1, 0) + 1)
    runner.assertEqual(clock.getTime(), 2);
  });

  runner.test('SUB-004: observe() with higher time updates correctly', () => {
    LamportClockFactory.reset();
    const clock = LamportClockFactory.create();
    clock.increment(); // time = 1
    clock.observe(5); // should become 6 (max(1, 5) + 1)
    runner.assertEqual(clock.getTime(), 6);
  });

  runner.test('SUB-004: observe() with equal time increments by 1', () => {
    LamportClockFactory.reset();
    const clock = LamportClockFactory.create();
    clock.increment(); // time = 1
    clock.observe(1); // should become 2 (max(1, 1) + 1)
    runner.assertEqual(clock.getTime(), 2);
  });

  // ==================== reset() Tests ====================
  
  runner.test('SUB-004: reset() sets time to 0', () => {
    LamportClockFactory.reset();
    const clock = LamportClockFactory.create();
    clock.increment();
    clock.increment();
    clock.increment();
    runner.assertEqual(clock.getTime(), 3);
    
    clock.reset();
    runner.assertEqual(clock.getTime(), 0);
  });

  // ==================== Integration Tests ====================
  
  runner.test('SUB-004: Lamport clock guarantees causal ordering', () => {
    LamportClockFactory.reset();
    const clock1 = LamportClockFactory.create();
    const clock2 = LamportClockFactory.create(); // Same instance (singleton)

    // Event 1 on clock1
    const time1 = clock1.increment(); // 1
    
    // Event 2 on clock1
    const time2 = clock1.increment(); // 2
    
    // Event 3 on clock2 (same as clock1) observes time2
    clock2.observe(time2); // max(2, 2) + 1 = 3
    const time3 = clock2.increment(); // 4
    
    // Verify ordering: time1 < time2 < time3
    runner.assertTrue(time1 < time2);
    runner.assertTrue(time2 < time3);
  });

  runner.test('SUB-004: Multiple observers synchronize correctly', () => {
    LamportClockFactory.reset();
    const clock = LamportClockFactory.create();

    // Simulate receiving events from remote nodes
    clock.increment(); // Local event: 1
    clock.observe(10); // Remote event with time 10: max(1, 10) + 1 = 11
    clock.increment(); // Local event: 12
    clock.observe(5); // Older remote event: max(12, 5) + 1 = 13

    runner.assertEqual(clock.getTime(), 13);
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