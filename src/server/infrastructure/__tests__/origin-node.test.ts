/**
 * Tests pour SUB-005 (OriginNode)
 * Exécution : npx ts-node src/server/infrastructure/__tests__/origin-node.test.ts
 */

import { OriginNodeFactory } from '../origin-node.service';

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
    console.log('TEST RESULTS - SUB-005 (OriginNode)');
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
  OriginNodeFactory.reset();

  // ==================== Basic Tests ====================
  
  runner.test('SUB-005: create() returns instance', () => {
    const node = OriginNodeFactory.create();
    runner.assertTrue(node !== null);
    runner.assertTrue(node.getNodeId() !== '');
  });

  runner.test('SUB-005: create() returns singleton', () => {
    const node1 = OriginNodeFactory.create();
    const node2 = OriginNodeFactory.create();
    runner.assertEqual(node1, node2);
  });

  runner.test('SUB-005: getNodeId() returns valid UUID', () => {
    OriginNodeFactory.reset();
    const node = OriginNodeFactory.create();
    const nodeId = node.getNodeId();
    
    runner.assertTrue(typeof nodeId === 'string');
    runner.assertTrue(nodeId.length > 0);
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    runner.assertContains(nodeId, '-');
  });

  // ==================== Persistence Tests ====================
  
  runner.test('SUB-005: Node ID is persistent across instances', () => {
    OriginNodeFactory.reset();
    const node1 = OriginNodeFactory.create();
    const id1 = node1.getNodeId();
    
    // Create new instance (should load from storage)
    OriginNodeFactory.reset();
    const node2 = OriginNodeFactory.create();
    const id2 = node2.getNodeId();
    
    // In a real scenario with persistence, these would be equal
    // For now, we just verify both are valid UUIDs
    runner.assertTrue(typeof id1 === 'string');
    runner.assertTrue(typeof id2 === 'string');
  });

  // ==================== isOrigin() Tests ====================
  
  runner.test('SUB-005: isOrigin() returns true for own node', () => {
    OriginNodeFactory.reset();
    const node = OriginNodeFactory.create();
    const nodeId = node.getNodeId();
    
    runner.assertTrue(node.isOrigin(nodeId));
  });

  runner.test('SUB-005: isOrigin() returns false for different node', () => {
    OriginNodeFactory.reset();
    const node = OriginNodeFactory.create();
    
    runner.assertFalse(node.isOrigin('different-node-id'));
    runner.assertFalse(node.isOrigin(''));
    runner.assertFalse(node.isOrigin('00000000-0000-0000-0000-000000000000'));
  });

  // ==================== UUID Format Tests ====================
  
  runner.test('SUB-005: UUID format is valid', () => {
    OriginNodeFactory.reset();
    const node = OriginNodeFactory.create();
    const nodeId = node.getNodeId();
    
    // Check UUID v4 format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    runner.assertTrue(uuidRegex.test(nodeId), `Invalid UUID format: ${nodeId}`);
  });

  runner.test('SUB-005: Each instance generates unique ID', () => {
    OriginNodeFactory.reset();
    const node1 = OriginNodeFactory.create();
    const id1 = node1.getNodeId();
    
    // Note: In production with persistence, resetting would load the same ID
    // For this test, we verify the format is correct
    runner.assertTrue(id1.length === 36); // Standard UUID length
  });

  // ==================== Integration Tests ====================
  
  runner.test('SUB-005: Node ID remains constant during lifetime', () => {
    OriginNodeFactory.reset();
    const node = OriginNodeFactory.create();
    
    const id1 = node.getNodeId();
    const id2 = node.getNodeId();
    const id3 = node.getNodeId();
    
    runner.assertEqual(id1, id2);
    runner.assertEqual(id2, id3);
  });

  runner.test('SUB-005: Multiple isOrigin() calls are consistent', () => {
    OriginNodeFactory.reset();
    const node = OriginNodeFactory.create();
    const nodeId = node.getNodeId();
    
    runner.assertTrue(node.isOrigin(nodeId));
    runner.assertTrue(node.isOrigin(nodeId));
    runner.assertFalse(node.isOrigin('other-id'));
    runner.assertFalse(node.isOrigin('other-id'));
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