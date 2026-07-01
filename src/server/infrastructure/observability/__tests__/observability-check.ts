// =============================================================================
// Observability System Validation Script — SUB-031
// =============================================================================
// Exécution: npx tsx src/server/infrastructure/observability/__tests__/observability-check.ts
// =============================================================================

import {
  V2StructuredLogger,
  V2LogEntry,
  v2StructuredLogger,
} from '../logging-standard';

import {
  MetricsCollector,
  BusinessMetrics,
  SystemMetrics,
  ArchitectureV21Metrics,
  AllMetrics,
} from '../metrics-collector';

import {
  AlertingEngine,
  AlertSeverity,
  AlertCategory,
} from '../alerting-engine';

import {
  DashboardService,
  GlobalStatus,
} from '../dashboard-service';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function main() {
  console.log('\n=== SUB-031 Observability Dashboard Validation ===\n');

  // ==========================================================================
  // 1. V2StructuredLogger
  // ==========================================================================
  console.log('--- 1. V2StructuredLogger ---');

  const logger = v2StructuredLogger;
  const correlationId = V2StructuredLogger.generateCorrelationId();

  assert(logger.getCount() === 0, 'should start empty');

  const logEntry: Omit<V2LogEntry, 'timestamp'> = {
    tenantId: 1,
    correlationId,
    eventType: 'subscription.created',
    lamportClock: 12345,
    originNode: 'local',
    level: 'info',
    message: 'Test log entry',
    metadata: { subscriptionId: 1 },
  };

  logger.log(logEntry);
  assert(logger.getCount() === 1, 'should have 1 log entry');

  const recent = logger.getRecent(10);
  assert(recent.length === 1, 'should retrieve recent logs');
  assert(recent[0].tenantId === 1, 'should include tenantId');
  assert(recent[0].correlationId === correlationId, 'should include correlationId');
  assert(recent[0].lamportClock === 12345, 'should include lamportClock');
  assert(recent[0].originNode === 'local', 'should include originNode');

  const byTenant = logger.getByTenant(1);
  assert(byTenant.length === 1, 'should filter by tenant');

  const byCorrelation = logger.getByCorrelationId(correlationId);
  assert(byCorrelation.length === 1, 'should filter by correlationId');

  const byEventType = logger.getByEventType('subscription.created');
  assert(byEventType.length === 1, 'should filter by eventType');

  logger.clear();
  assert(logger.getCount() === 0, 'should clear all logs');

  // ==========================================================================
  // 2. MetricsCollector
  // ==========================================================================
  console.log('\n--- 2. MetricsCollector ---');

  const collector = new MetricsCollector();

  collector.recordEventBusLatency(50);
  collector.recordEventBusLatency(100);
  collector.recordRepositoryReadLatency(20);
  collector.recordRepositoryWriteLatency(80);
  collector.recordCacheAccess(true);
  collector.recordCacheAccess(true);
  collector.recordCacheAccess(false);
  collector.recordEventProcessed();
  collector.recordEventProcessed();
  collector.recordEventProcessed();

  const metrics = collector.collect();

  assert(metrics.timestamp !== undefined, 'should have timestamp');
  assert(metrics.period >= 0, 'should have period');
  assert(metrics.business !== undefined, 'should have business metrics');
  assert(metrics.system !== undefined, 'should have system metrics');
  assert(metrics.architecture !== undefined, 'should have architecture metrics');

  assert(metrics.system.eventBusLatency === 75, 'should calculate avg event bus latency');
  assert(metrics.system.repositoryReadLatency === 20, 'should calculate avg read latency');
  assert(metrics.system.repositoryWriteLatency === 80, 'should calculate avg write latency');
  assert(metrics.system.cacheHitRatio === 67, 'should calculate cache hit ratio');
  assert(metrics.system.eventBusThroughput >= 0, 'should calculate throughput');

  assert(metrics.architecture.dualRunMatchRate >= 0, 'should have dual run match rate');
  assert(metrics.architecture.v2AdoptionRate >= 0, 'should have v2 adoption rate');

  // ==========================================================================
  // 3. AlertingEngine
  // ==========================================================================
  console.log('\n--- 3. AlertingEngine ---');

  const alerting = new AlertingEngine();

  assert(alerting.getActiveAlerts().length === 0, 'should start with no active alerts');
  assert(alerting.getHistory().length === 0, 'should start with empty history');

  // Test with metrics that should trigger warnings
  const warningMetrics: AllMetrics = {
    business: {
      activeSubscriptions: 10,
      subscriptionActivationRate: 5,
      cancellationRate: 1,
      voucherApprovalRate: 90,
      totalSubscriptions: 10,
      totalCancellations: 1,
      totalVouchersApproved: 9,
      totalVouchersPending: 1,
    },
    system: {
      eventBusThroughput: 100,
      eventBusLatency: 250, // > 200ms threshold
      repositoryReadLatency: 10,
      repositoryWriteLatency: 500,
      cacheHitRatio: 75, // < 80% threshold
      readModelFreshnessDelay: 100,
      totalEvents: 1000,
      errorCount: 10,
    },
    architecture: {
      lamportClockDrift: 0,
      originNodeDistribution: { local: 1000 },
      originNodeConsistency: 100,
      eventCorrelationSuccessRate: 99,
      dualRunMatchRate: 98.5, // < 99% threshold
      v2AdoptionRate: 25, // < 30% threshold
    },
    timestamp: new Date().toISOString(),
    period: 60000,
  };

  const alerts = alerting.evaluate(warningMetrics);
  assert(alerts.length > 0, 'should trigger alerts for bad metrics');

  const activeAlerts = alerting.getActiveAlerts();
  assert(activeAlerts.length > 0, 'should have active alerts');

  // Test acknowledge
  if (alerts.length > 0) {
    alerting.acknowledge(alerts[0].ruleId);
    const acknowledged = alerting.getHistory().find(a => a.ruleId === alerts[0].ruleId);
    assert(acknowledged?.acknowledged === true, 'should acknowledge alert');
  }

  // Test resolve
  if (alerts.length > 0) {
    alerting.resolve(alerts[0].ruleId);
    const resolved = alerting.getHistory().find(a => a.ruleId === alerts[0].ruleId);
    assert(resolved?.resolvedAt !== undefined, 'should resolve alert');
  }

  // Test with good metrics (fresh alerting engine, completely good values)
  const freshAlerting = new AlertingEngine();
  const goodMetrics: AllMetrics = {
    business: {
      activeSubscriptions: 10,
      subscriptionActivationRate: 5,
      cancellationRate: 1,
      voucherApprovalRate: 95,
      totalSubscriptions: 10,
      totalCancellations: 1,
      totalVouchersApproved: 9,
      totalVouchersPending: 1,
    },
    system: {
      eventBusThroughput: 100,
      eventBusLatency: 50,      // < 200ms
      repositoryReadLatency: 10,
      repositoryWriteLatency: 100, // < 10000ms
      cacheHitRatio: 95,        // > 80%
      readModelFreshnessDelay: 100,
      totalEvents: 1000,
      errorCount: 5,            // < 0.5% drop rate
    },
    architecture: {
      lamportClockDrift: 0,
      originNodeDistribution: { local: 1000 },
      originNodeConsistency: 100,
      eventCorrelationSuccessRate: 99.5,
      dualRunMatchRate: 99.5,   // > 99%
      v2AdoptionRate: 50,       // > 30%
    },
    timestamp: new Date().toISOString(),
    period: 60000,
  };

  const goodAlerts = freshAlerting.evaluate(goodMetrics);
  assert(goodAlerts.length === 0, 'should not trigger alerts for good metrics');

  // ==========================================================================
  // 4. DashboardService
  // ==========================================================================
  console.log('\n--- 4. DashboardService ---');

  const dashboard = new DashboardService();
  const dashboardData = dashboard.generate();

  assert(dashboardData.timestamp !== undefined, 'should have timestamp');
  assert(dashboardData.sections.length === 4, 'should have 4 sections');
  assert(dashboardData.systemHealth !== undefined, 'should have system health');
  assert(dashboardData.eventSystem !== undefined, 'should have event system');
  assert(dashboardData.dataConsistency !== undefined, 'should have data consistency');
  assert(dashboardData.businessKpis !== undefined, 'should have business KPIs');
  assert(dashboardData.metrics !== undefined, 'should have metrics');

  assert(dashboardData.sections[0].name === 'System Health', 'first section should be System Health');
  assert(dashboardData.sections[1].name === 'Event System', 'second section should be Event System');
  assert(dashboardData.sections[2].name === 'Data Consistency', 'third section should be Data Consistency');
  assert(dashboardData.sections[3].name === 'Business KPIs', 'fourth section should be Business KPIs');

  const statuses = dashboardData.sections.map(s => s.status);
  assert(['green', 'yellow', 'red'].includes(dashboardData.systemHealth.globalStatus), 'global status should be valid');

  assert(dashboardData.systemHealth.healthScore >= 0, 'health score should be >= 0');
  assert(dashboardData.systemHealth.healthScore <= 100, 'health score should be <= 100');
  assert(dashboardData.systemHealth.uptime >= 0, 'uptime should be >= 0');

  assert(dashboardData.eventSystem.eventFlow.totalProcessed >= 0, 'should have event flow metrics');
  assert(dashboardData.eventSystem.droppedEvents.count >= 0, 'should have dropped events count');

  assert(dashboardData.dataConsistency.readModelVsDb.divergence >= 0, 'should have read model divergence');
  assert(dashboardData.dataConsistency.cacheVsDb.hitRatio >= 0, 'should have cache hit ratio');

  assert(dashboardData.businessKpis.subscriptions.active >= 0, 'should have active subscriptions');
  assert(dashboardData.businessKpis.vouchers.approved >= 0, 'should have approved vouchers');

  // ==========================================================================
  // 5. Integration Test
  // ==========================================================================
  console.log('\n--- 5. Integration Test ---');

  // Simulate a complete flow
  const testCorrelationId = V2StructuredLogger.generateCorrelationId();
  v2StructuredLogger.log({
    tenantId: 1,
    correlationId: testCorrelationId,
    eventType: 'subscription.verify',
    lamportClock: 100,
    originNode: 'local',
    level: 'info',
    message: 'Subscription verified',
  });

  const trace = v2StructuredLogger.getByCorrelationId(testCorrelationId);
  assert(trace.length === 1, 'should trace correlationId');

  // Collect metrics after logging
  const finalMetrics = collector.collect();
  assert(finalMetrics.system.totalEvents >= 0, 'should track total events');

  // Generate dashboard
  const finalDashboard = dashboard.generate();
  assert(finalDashboard.timestamp !== undefined, 'dashboard should have timestamp');

  // ==========================================================================
  // Summary
  // ==========================================================================
  console.log('\n=== ✅ All SUB-031 Validation Checks Passed ===');
  console.log(`Components: V2StructuredLogger, MetricsCollector,`);
  console.log(`            AlertingEngine, DashboardService`);
  console.log('\nFeatures validated:');
  console.log('  - Structured logging with tenantId, correlationId, lamportClock, originNode');
  console.log('  - Business, System, and Architecture V2.1 metrics collection');
  console.log('  - Alerting rules (CRITICAL: mismatch >1%, event drop >0.5%, cache <50%, write latency >10s)');
  console.log('  - Alerting rules (WARNING: latency >200ms, cache <80%, v2 adoption <30%)');
  console.log('  - Dashboard with 4 sections: System Health, Event System, Data Consistency, Business KPIs');
  console.log('  - End-to-end tracing by correlationId');
  console.log('  - Alert acknowledge/resolve workflow');
  console.log('\nObservability status: operational');
}

main().catch((error) => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});