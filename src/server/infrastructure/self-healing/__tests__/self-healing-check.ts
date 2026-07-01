// =============================================================================
// Self-Healing System Validation Script
// =============================================================================
// Exécution: npx ts-node src/server/infrastructure/self-healing/__tests__/self-healing-check.ts
// =============================================================================

import {
  SubscriptionAnomalyDetector,
  CacheFailureTracker,
  RepositoryFailureTracker,
  AnomalyType,
  AnomalySeverity,
} from '../anomaly-detector';

import {
  RecoveryEngine,
  RecoveryLevel,
} from '../recovery-actions';

import {
  SelfHealingOrchestrator,
} from '../self-healing-orchestrator';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function main() {
  console.log('\n=== SUB-030 Self-Healing System Validation ===\n');

  // ==========================================================================
  // 1. CacheFailureTracker
  // ==========================================================================
  console.log('--- 1. CacheFailureTracker ---');

  const cacheTracker = new CacheFailureTracker(60000);
  assert(cacheTracker.getRecentFailureCount() === 0, 'should start empty');

  cacheTracker.recordFailure('invalidate', 'timeout');
  assert(cacheTracker.getRecentFailureCount() === 1, 'should count single failure');

  cacheTracker.recordFailure('refresh', 'not found');
  assert(cacheTracker.getRecentFailureCount() === 2, 'should count multiple failures');

  cacheTracker.recordFailure('invalidate', 'timeout', 1);
  assert(cacheTracker.getFailuresByTenant(1).length === 1, 'should filter by tenant');

  cacheTracker.clear();
  assert(cacheTracker.getRecentFailureCount() === 0, 'should clear all failures');

  // ==========================================================================
  // 2. RepositoryFailureTracker
  // ==========================================================================
  console.log('\n--- 2. RepositoryFailureTracker ---');

  const repoTracker = new RepositoryFailureTracker(60000);
  assert(repoTracker.getRecentFailureCount() === 0, 'should start empty');

  repoTracker.recordFailure('write', 'constraint violation');
  repoTracker.recordFailure('write', 'deadlock');
  assert(repoTracker.getRecentFailureCount() === 2, 'should count failures');

  repoTracker.clear();
  assert(repoTracker.getRecentFailureCount() === 0, 'should clear');

  // ==========================================================================
  // 3. SubscriptionAnomalyDetector
  // ==========================================================================
  console.log('\n--- 3. SubscriptionAnomalyDetector ---');

  const detector = new SubscriptionAnomalyDetector({
    mismatchRateThreshold: 10,
    eventDropRateThreshold: 5,
    cacheInvalidationThreshold: 1,
    repositoryWriteThreshold: 1,
    latencyThresholdMs: 100,
    windowSizeMs: 60000,
    minSampleSize: 1,
  });

  // Healthy state
  let result = detector.detect();
  assert(result.isHealthy === true, 'should detect no anomalies when healthy');
  assert(result.healthScore >= 90, 'should have high health score when healthy');
  assert(result.anomalies.length === 0, 'should have no anomalies when healthy');

  // Cache failures
  detector.recordCacheFailure('invalidate', 'timeout');
  result = detector.detect();
  const cacheAnomalies = result.anomalies.filter(a => a.type === AnomalyType.CACHE_INVALIDATION_FAILURE);
  assert(cacheAnomalies.length >= 1, 'should detect cache invalidation failures');

  // Repository failures
  detector.recordRepositoryFailure('write', 'disk full');
  result = detector.detect();
  const repoAnomalies = result.anomalies.filter(a => a.type === AnomalyType.REPOSITORY_WRITE_FAILURE);
  assert(repoAnomalies.length >= 1, 'should detect repository write failures');

  // Anomaly IDs
  if (result.anomalies.length > 0) {
    assert(result.anomalies[0].id.startsWith('anomaly-'), 'should generate anomaly IDs');
  }

  // Callback
  let callbackCalled = false;
  const callback = () => { callbackCalled = true; };
  detector.setAnomalyCallback(callback as any);

  const testDetector = new SubscriptionAnomalyDetector({
    cacheInvalidationThreshold: 1,
    windowSizeMs: 60000,
    minSampleSize: 1,
  });
  testDetector.setAnomalyCallback(callback as any);
  testDetector.recordCacheFailure('test', 'error');
  testDetector.detect();
  assert(callbackCalled, 'should fire anomaly callback');

  // Graceful degradation
  const badDetector = new SubscriptionAnomalyDetector();
  try {
    badDetector.detect();
    assert(true, 'should degrade gracefully without crashing');
  } catch (e) {
    assert(false, `should NOT throw: ${e}`);
  }

  // ==========================================================================
  // 4. RecoveryEngine
  // ==========================================================================
  console.log('\n--- 4. RecoveryEngine ---');

  const recovery = new RecoveryEngine();

  assert(recovery.getLogCount() === 0, 'should start with empty logs');
  assert(recovery.getRecoveryStats().total === 0, 'should have zero stats');

  const anomalyLow = {
    id: 'test-anomaly-1',
    type: AnomalyType.MISMATCH_RATE as AnomalyType,
    severity: AnomalySeverity.LOW as AnomalySeverity,
    detectedAt: new Date(),
    value: 15,
    threshold: 10,
    message: 'Test mismatch anomaly',
  };

  const log = await recovery.recover(anomalyLow as any);
  assert(log.anomalyId === 'test-anomaly-1', 'should track anomaly ID');
  assert(log.actions.length > 0, 'should execute recovery actions');
  assert(log.resolved === true, 'should resolve non-critical anomalies');

  const anomalyCritical = {
    id: 'test-anomaly-3',
    type: AnomalyType.REPOSITORY_WRITE_FAILURE as AnomalyType,
    severity: AnomalySeverity.CRITICAL as AnomalySeverity,
    detectedAt: new Date(),
    value: 15,
    threshold: 5,
    message: 'Critical write failure',
  };

  await recovery.recover(anomalyCritical as any);
  assert(recovery.getReadOnlyGuard().isEnabled() === true, 'should activate read-only guard on critical');

  recovery.getReadOnlyGuard().disable();
  assert(recovery.getReadOnlyGuard().isEnabled() === false, 'should disable read-only guard');

  assert(recovery.getLogCount() === 2, 'should have 2 recovery logs');
  assert(recovery.getRecoveryStats().total === 2, 'should have 2 stats entries');

  // ==========================================================================
  // 5. SelfHealingOrchestrator
  // ==========================================================================
  console.log('\n--- 5. SelfHealingOrchestrator ---');

  const orchestrator = new SelfHealingOrchestrator({
    detectionIntervalMs: 100,
    autoRecover: true,
    alertOnCritical: false,
  });

  let status = orchestrator.getStatus();
  assert(status.isRunning === false, 'should be stopped initially');

  orchestrator.start();
  status = orchestrator.getStatus();
  assert(status.isRunning === true, 'should start');

  orchestrator.stop();
  status = orchestrator.getStatus();
  assert(status.isRunning === false, 'should stop');

  const detectionResult = orchestrator.runDetection();
  assert(detectionResult.healthScore >= 0, 'health score should be >= 0');
  assert(detectionResult.healthScore <= 100, 'health score should be <= 100');

  orchestrator.reintegrateTenant(1);
  status = orchestrator.getStatus();
  assert(!status.isolatedTenants.includes(1), 'should reintegrate tenant');

  orchestrator.disableReadOnly();
  status = orchestrator.getStatus();
  assert(status.readOnlyEnabled === false, 'should disable read-only');

  // ==========================================================================
  // Summary
  // ==========================================================================
  console.log('\n=== ✅ All SUB-030 Validation Checks Passed ===');
  console.log(`Tests: CacheFailureTracker, RepositoryFailureTracker,`);
  console.log(`       SubscriptionAnomalyDetector, RecoveryEngine,`);
  console.log(`       SelfHealingOrchestrator`);
  console.log('\nSystem status: operational');
}

main().catch((error) => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});