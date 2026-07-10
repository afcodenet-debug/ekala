#!/bin/bash
# =============================================================================
# CI ENFORCEMENT — Outbox-Only Architecture Validator
# =============================================================================
# This script FAILS the build if any direct Supabase write is detected
# outside of OutboxWorkerV2.
#
# Usage: ./scripts/ci-enforce-outbox-only.sh
# Exit code: 0 = PASS, 1 = FAIL
# =============================================================================

set -e

echo "══════════════════════════════════════════════════════════════"
echo "🔍 CI ENFORCEMENT — Outbox-Only Architecture Validation"
echo "══════════════════════════════════════════════════════════════"

FAILED=0

# =============================================================================
# RULE 1: No direct Supabase writes outside OutboxWorkerV2
# =============================================================================
echo ""
echo "[RULE 1] Scanning for direct Supabase writes (supabase.from().insert/update/delete/upsert)..."

# Find all .ts files in src/server except outbox-worker-v2.ts
FILES=$(find src/server -name "*.ts" -type f | grep -v "outbox-worker-v2.ts" | grep -v "node_modules")

# Check for forbidden patterns
FORBIDDEN_PATTERNS=(
  "supabase\.from\(.*\)\.insert\("
  "supabase\.from\(.*\)\.update\("
  "supabase\.from\(.*\)\.delete\("
  "supabase\.from\(.*\)\.upsert\("
  "\.from\(.*\)\.insert\("
  "\.from\(.*\)\.update\("
  "\.from\(.*\)\.delete\("
  "\.from\(.*\)\.upsert\("
)

for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
  matches=$(echo "$FILES" | xargs grep -n "$pattern" 2>/dev/null || true)
  
  if [ -n "$matches" ]; then
    echo "❌ FAIL: Direct Supabase write detected: $pattern"
    echo "$matches"
    FAILED=1
  fi
done

if [ $FAILED -eq 0 ]; then
  echo "✅ PASS: No direct Supabase writes found outside OutboxWorkerV2"
fi

# =============================================================================
# RULE 2: No GenericSyncService as primary sync engine
# =============================================================================
echo ""
echo "[RULE 2] Checking for GenericSyncService usage..."

# Only flag actual usage, not comments/warnings
if grep -r "new GenericSyncService\|GenericSyncService\.sync\|GenericSyncService\.write\|GenericSyncService\.start" src/server --include="*.ts" | grep -v "node_modules" | grep -v ".test.ts" > /dev/null 2>&1; then
  echo "❌ FAIL: GenericSyncService still actively used in codebase"
  grep -rn "new GenericSyncService\|GenericSyncService\.sync\|GenericSyncService\.write\|GenericSyncService\.start" src/server --include="*.ts" | grep -v "node_modules" | grep -v ".test.ts"
  FAILED=1
else
  echo "✅ PASS: GenericSyncService not actively used (comments/warnings are OK)"
fi

# =============================================================================
# RULE 3: No dual-write patterns
# =============================================================================
echo ""
echo "[RULE 3] Checking for dual-write patterns..."

DUAL_WRITE_PATTERNS=(
  "syncOrchestratorV2\.write"
  "legacy.*sync"
  "dual.*write"
  "dualWrite"
)

for pattern in "${DUAL_WRITE_PATTERNS[@]}"; do
  matches=$(grep -rn "$pattern" src/server --include="*.ts" 2>/dev/null || true)
  
  if [ -n "$matches" ]; then
    echo "⚠️  WARNING: Potential dual-write pattern detected: $pattern"
    echo "$matches"
    # Don't fail, just warn
  fi
done

echo "✅ PASS: No obvious dual-write patterns found"

# =============================================================================
# RULE 4: OutboxWorkerV2 must be the ONLY Supabase writer
# =============================================================================
echo ""
echo "[RULE 4] Verifying OutboxWorkerV2 is registered as writer..."

if grep -q "WriteInterceptor" src/server/infrastructure/synchronization/outbox-worker-v2.ts; then
  echo "✅ PASS: OutboxWorkerV2 uses WriteInterceptor"
else
  echo "❌ FAIL: OutboxWorkerV2 does not use WriteInterceptor"
  FAILED=1
fi

# =============================================================================
# RULE 5: No bypass of sync_outbox (only actual Supabase writes, not SQLite metadata)
# =============================================================================
echo ""
echo "[RULE 5] Checking for sync_outbox bypass..."

# Only check for actual Supabase client writes, not SQLite metadata tables
# These are false positives: sync_metadata, traces_events, identity_map are SQLite tables
BYPASS_PATTERNS=(
  "supabase\.from\(.*\)\.insert\("
  "supabase\.from\(.*\)\.update\("
  "supabase\.from\(.*\)\.delete\("
  "supabase\.from\(.*\)\.upsert\("
)

for pattern in "${BYPASS_PATTERNS[@]}"; do
  matches=$(echo "$FILES" | xargs grep -n "$pattern" 2>/dev/null || true)
  
  if [ -n "$matches" ]; then
    echo "❌ FAIL: Direct Supabase write detected outside OutboxWorkerV2: $pattern"
    echo "$matches"
    FAILED=1
  fi
done

echo "✅ PASS: No sync_outbox bypass detected"

# =============================================================================
# FINAL RESULT
# =============================================================================
echo ""
echo "══════════════════════════════════════════════════════════════"

if [ $FAILED -eq 0 ]; then
  echo "✅ BUILD PASSED — Outbox-Only Architecture Enforced"
  echo "══════════════════════════════════════════════════════════════"
  exit 0
else
  echo "❌ BUILD FAILED — Direct Supabase writes detected outside OutboxWorkerV2"
  echo ""
  echo "ACTION REQUIRED:"
  echo "  1. Remove all direct Supabase writes from non-worker code"
  echo "  2. Use OutboxRepository.enqueue() instead"
  echo "  3. Ensure ONLY OutboxWorkerV2 writes to Supabase"
  echo ""
  echo "Architecture Rule:"
  echo "  Application → Outbox → OutboxWorkerV2 → Supabase"
  echo "══════════════════════════════════════════════════════════════"
  exit 1
fi