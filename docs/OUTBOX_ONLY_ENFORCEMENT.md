# Outbox-Only Architecture — Enforcement Guide

## 🚨 CRITICAL: This is a Stripe-Grade Locked Architecture

**NO BYPASS ALLOWED. NO FALLBACK. NO LEGACY.**

---

## 📋 Table of Contents

1. [Architecture Rule](#architecture-rule)
2. [Runtime Enforcement](#runtime-enforcement)
3. [Build-Time Enforcement](#build-time-enforcement)
4. [CI/CD Integration](#cicd-integration)
5. [Verification Checklist](#verification-checklist)
6. [Rollback Procedure](#rollback-procedure)

---

## 🏗️ Architecture Rule

### THE ONLY ALLOWED FLOW

```
Application Layer (SQLite write)
    ↓
OutboxRepository.enqueue() [MANDATORY]
    ↓
sync_outbox table (SOURCE OF TRUTH)
    ↓
OutboxWorkerV2 (async daemon)
    ↓
WriteInterceptor.verifyWritePermission() [RUNTIME GUARD]
    ↓
Supabase (ONLY WRITE PATH)
    ↓
ACK → markAsSent() OR DLQ
```

### ❌ ABSOLUTELY FORBIDDEN

```typescript
// ❌❌❌ NEVER DO THIS ❌❌❌

// 1. Direct Supabase writes
await supabase.from('products').insert(data);
await supabase.from('products').update(data);
await supabase.from('products').upsert(data);

// 2. Bypassing sync_outbox
db.prepare('INSERT INTO products ...'); // If products is a Supabase-backed table

// 3. Legacy sync paths
GenericSyncService.sync();
syncOrchestratorV2.write(); // If this bypasses outbox

// 4. Dual-write
await sqliteWrite(...);
await supabaseWrite(...); // ❌ NO DUAL WRITE

// 5. Fallback to legacy
if (mode === 'legacy') {
  await legacySync();
}
```

### ✅ ONLY ALLOWED PATTERN

```typescript
// ✅✅✅ CORRECT PATTERN ✅✅✅

// 1. Application writes to SQLite
await db.prepare('INSERT INTO products ...').run(...);

// 2. Enqueue event to outbox (MANDATORY)
await outboxRepository.save({
  eventType: 'product:created',
  entity: 'product',
  operation: 'insert',
  payload: JSON.stringify(data),
  idempotencyKey: `product:${tenantId}:${productId}`,
  status: 'pending',
  // ...
});

// 3. OutboxWorkerV2 picks up and pushes to Supabase (async)
// This happens automatically in the background
```

---

## 🔒 Runtime Enforcement

### WriteInterceptor (Global Write Guard)

**Location**: `src/server/infrastructure/synchronization/write-interceptor.ts`

**Purpose**: Blocks ANY Supabase write attempt outside OutboxWorkerV2

**How it works**:
1. OutboxWorkerV2 registers itself as the only writer on `start()`
2. Every Supabase write in `pushToSupabase()` calls `verifyWritePermission()`
3. If caller is not OutboxWorkerV2 → **THROWS ERROR IMMEDIATELY**

**Error thrown**:
```
DIRECT_SUPABASE_WRITE_FORBIDDEN — USE OUTBOX ONLY. 
Worker is not active. All writes must go through sync_outbox → OutboxWorkerV2.
```

**Audit trail**:
- All blocked attempts are logged to `write_interception_log` table
- Console error with full stack trace
- In-memory buffer of last 100 blocked attempts

**Monitoring**:
```typescript
const interceptor = WriteInterceptor.getInstance();
const status = interceptor.getStatus();
console.log(status);
// {
//   isActive: true,
//   workerId: "worker-12345-1698765432100-abc123",
//   blockedCount: 0
// }

const blockedAttempts = interceptor.getBlockedAttempts();
console.log(blockedAttempts);
// [{ timestamp, caller, stackTrace, table, operation }]
```

---

## 🏗️ Build-Time Enforcement

### CI Script: `scripts/ci-enforce-outbox-only.sh`

**Purpose**: FAILS THE BUILD if any direct Supabase write is detected

**Usage**:
```bash
# Local check
./scripts/ci-enforce-outbox-only.sh

# In CI/CD
npm run ci:enforce
```

**Rules enforced**:

1. **RULE 1**: No direct Supabase writes outside OutboxWorkerV2
   - Scans for: `supabase.from().insert(`, `.update(`, `.delete(`, `.upsert(`
   - Excludes: `outbox-worker-v2.ts`

2. **RULE 2**: No GenericSyncService usage
   - Scans for: `GenericSyncService` references
   - Excludes: test files

3. **RULE 3**: No dual-write patterns
   - Scans for: `syncOrchestratorV2.write`, `legacy.*sync`, `dual.*write`
   - WARNING only (doesn't fail)

4. **RULE 4**: OutboxWorkerV2 must use WriteInterceptor
   - Verifies: `WriteInterceptor` import in `outbox-worker-v2.ts`

5. **RULE 5**: No sync_outbox bypass
   - Scans for: `INSERT INTO.*supabase`, `UPDATE.*supabase`, `DELETE FROM.*supabase`

**Exit codes**:
- `0`: PASS — Architecture is clean
- `1`: FAIL — Direct writes detected, BUILD BLOCKED

**Example output**:
```
══════════════════════════════════════════════════════════════
🔍 CI ENFORCEMENT — Outbox-Only Architecture Validation
══════════════════════════════════════════════════════════════

[RULE 1] Scanning for direct Supabase writes...
✅ PASS: No direct Supabase writes found outside OutboxWorkerV2

[RULE 2] Checking for GenericSyncService usage...
✅ PASS: GenericSyncService not found in codebase

[RULE 3] Checking for dual-write patterns...
✅ PASS: No obvious dual-write patterns found

[RULE 4] Verifying OutboxWorkerV2 is registered as writer...
✅ PASS: OutboxWorkerV2 uses WriteInterceptor

[RULE 5] Checking for sync_outbox bypass...
✅ PASS: No sync_outbox bypass detected

══════════════════════════════════════════════════════════════
✅ BUILD PASSED — Outbox-Only Architecture Enforced
══════════════════════════════════════════════════════════════
```

### Package.json Integration

Add to `package.json`:

```json
{
  "scripts": {
    "ci:enforce": "./scripts/ci-enforce-outbox-only.sh",
    "build": "npm run ci:enforce && tsc -p tsconfig.server.json"
  }
}
```

**Result**: Build FAILS if architecture rules are violated

---

## 🚀 CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  enforce-architecture:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Enforce Outbox-Only Architecture
        run: npm run ci:enforce
      
      - name: Build
        run: npm run build
```

### Render CI

```yaml
# render.yaml
services:
  - type: web
    name: ekala-api
    runtime: node
    buildCommand: npm run ci:enforce && npm run build
    startCommand: npm start
```

**Result**: Deployment FAILS on Render if architecture is violated

---

## ✅ Verification Checklist

### Before Deployment

- [ ] `npm run ci:enforce` passes (exit code 0)
- [ ] `npm run build:server` compiles without errors
- [ ] No `supabase.from().insert/update/delete` in codebase (except outbox-worker-v2.ts)
- [ ] No `GenericSyncService` references
- [ ] No dual-write patterns
- [ ] OutboxWorkerV2 uses WriteInterceptor
- [ ] WriteInterceptor is registered on worker start
- [ ] All application writes use `OutboxRepository.enqueue()`

### Runtime Verification

```bash
# 1. Check worker is running
curl https://your-api.com/api/sync/outbox-stats
# Expected: { "isRunning": true, "pending": 0, "dlqCount": 0 }

# 2. Check write interceptor status
curl https://your-api.com/api/sync/write-interceptor-status
# Expected: { "isActive": true, "blockedCount": 0 }

# 3. Check for blocked attempts
curl https://your-api.com/api/sync/blocked-attempts
# Expected: [] (empty array)
```

### Post-Deployment Monitoring

```sql
-- 1. Check outbox health
SELECT 
  status,
  COUNT(*) as count,
  MAX(created_at) as latest
FROM sync_outbox
GROUP BY status;

-- 2. Check for blocked writes
SELECT * FROM write_interception_log 
WHERE blocked_at > datetime('now', '-1 hour')
ORDER BY blocked_at DESC;

-- 3. Check DLQ
SELECT COUNT(*) as dlq_count FROM sync_outbox_dlq;
```

---

## 🔄 Rollback Procedure

### Emergency Rollback (If Architecture Violation Detected)

**Option 1: Disable Worker (Immediate)**
```bash
# Set environment variable
SYNC_ENGINE_MODE=0

# Restart server
npm start
```

**Option 2: Revert to Legacy (Full Rollback)**
```bash
# 1. Revert code
git revert HEAD

# 2. Deploy
git push origin main

# 3. Verify
npm run ci:enforce
```

**Option 3: Hotfix (If violation is in prod)**
```bash
# 1. Identify violation
npm run ci:enforce

# 2. Fix immediately
git add .
git commit -m "fix: remove direct Supabase write"
git push origin main

# 3. Redeploy
```

---

## 📊 Monitoring & Alerts

### Metrics to Track

1. **WriteInterceptor Status**
   - `isActive`: Should always be `true` in production
   - `blockedCount`: Should be `0` (any value > 0 is a CRITICAL alert)

2. **Outbox Health**
   - `pending`: Should be < 100 (high value = worker stuck)
   - `dlqCount`: Should be 0 (any value > 0 = CRITICAL alert)

3. **Build Status**
   - `ci:enforce`: Must pass (RED = deployment blocked)

### Alert Rules

```yaml
# PagerDuty / OpsGenie / Slack alerts
alerts:
  - name: DirectSupabaseWriteAttempt
    condition: write_interceptor.blocked_count > 0
    severity: critical
    message: "DIRECT SUPABASE WRITE DETECTED — ARCHITECTURE VIOLATION"
  
  - name: OutboxWorkerDown
    condition: outbox_worker.isRunning == false
    severity: critical
    message: "OutboxWorkerV2 is not running — sync is blocked"
  
  - name: DLQGrowing
    condition: sync_outbox_dlq.count > 10
    severity: warning
    message: "Dead Letter Queue has > 10 events — investigate failures"
  
  - name: BuildEnforcementFailed
    condition: ci_enforce.exit_code != 0
    severity: critical
    message: "BUILD FAILED — Outbox-Only architecture violation detected"
```

---

## 🎯 Acceptance Criteria

The system is **VALID** only if ALL of these are true:

### Runtime
- ✅ No write Supabase direct hors worker
- ✅ OutboxWorkerV2 est seul writer
- ✅ GenericSyncService n'est plus utilisé comme moteur
- ✅ WriteInterceptor bloque tous les writes illégaux
- ✅ Aucune violation dans `write_interception_log`

### Build-Time
- ✅ `npm run ci:enforce` passe (exit code 0)
- ✅ `npm run build:server` compile sans erreurs
- ✅ Aucun pattern interdit détecté

### Architecture
- ✅ Outbox = unique entry point
- ✅ Worker = unique exit point
- ✅ Zéro bypass
- ✅ Zéro dual-write
- ✅ Zéro fallback legacy

---

## 🚨 CRITICAL REMINDERS

### DO NOT
- ❌ Add new direct Supabase writes
- ❌ Bypass sync_outbox "just this once"
- ❌ Add fallback to legacy "for safety"
- ❌ Disable WriteInterceptor "temporarily"
- ❌ Ignore CI enforcement failures

### DO
- ✅ Always use `OutboxRepository.enqueue()`
- ✅ Let OutboxWorkerV2 handle Supabase writes
- ✅ Fix violations immediately
- ✅ Monitor `write_interception_log` table
- ✅ Keep WriteInterceptor active in production

---

## 📚 Related Documentation

- `docs/V2_3_2_MIGRATION_COMPLETE.md` — Migration guide
- `docs/ARCHITECTURE_V2_3_2_PRODUCTION_GRADE.md` — Architecture details
- `src/server/infrastructure/synchronization/write-interceptor.ts` — Runtime guard
- `scripts/ci-enforce-outbox-only.sh` — Build-time guard

---

## 🎉 Final State

**This architecture is LOCKED.**

- ✅ Runtime enforcement: WriteInterceptor
- ✅ Build-time enforcement: CI script
- ✅ CI/CD integration: GitHub Actions / Render
- ✅ Monitoring: Metrics + alerts
- ✅ Rollback: Documented procedure

**NO BYPASS. NO FALLBACK. NO LEGACY.**

**Outbox = Source of Truth. Worker = Only Writer. Period.**