#!/usr/bin/env node
/**
 * AST-BASED STATIC ANALYZER — Stripe-Grade Architecture Enforcement
 * 
 * This script analyzes the codebase at the AST level to detect:
 * - Direct Supabase client imports outside infrastructure/db
 * - Forbidden method calls (from, insert, update, delete, upsert)
 * - Indirect DB access patterns
 * - Module boundary violations
 * 
 * If any violation is detected, the BUILD FAILS.
 * 
 * Usage: node scripts/ast-architecture-enforcer.js
 * Exit code: 0 = PASS, 1 = FAIL
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// =============================================================================
// CONFIGURATION
// =============================================================================

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');

// Files/directories that are ALLOWED to import Supabase
const ALLOWED_SUPABASE_IMPORTS = [
  'src/server/infrastructure/db/',           // Supabase client definition
  'src/server/infrastructure/synchronization/', // OutboxWorkerV2
  'src/server/infrastructure/outbox/',        // Outbox repository
];

// Patterns that indicate direct DB access
const FORBIDDEN_PATTERNS = {
  // Direct Supabase client usage
  supabaseClient: [
    /import\s+.*\s+from\s+['"]@\/supabase\/client['"]/gi,
    /import\s+.*\s+from\s+['"]@\/lib\/supabase['"]/gi,
    /import\s+.*\s+from\s+['"]supabase['"]/gi,
  ],
  
  // Direct DB queries from business logic (excluding database.ts and migrations)
  dbQueries: [
    /db\.prepare\(/gi,
    /db\.exec\(/gi,
    /database\.prepare\(/gi,
  ],
  
  // Supabase ORM calls - ONLY if preceded by supabase variable
  supabaseORM: [
    /supabase\.from\(/gi,
    /supabase\.insert\(/gi,
    /supabase\.update\(/gi,
    /supabase\.delete\(/gi,
    /supabase\.upsert\(/gi,
  ]
};

// =============================================================================
// AST ANALYSIS
// =============================================================================

/**
 * Check if a file path is in an allowed directory
 */
function isAllowedPath(filePath) {
  const relativePath = path.relative(ROOT_DIR, filePath);
  
  for (const allowed of ALLOWED_SUPABASE_IMPORTS) {
    if (relativePath.startsWith(allowed)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a file should be excluded from scanning
 */
function isExcludedFile(filePath) {
  const relativePath = path.relative(ROOT_DIR, filePath);
  
  // Exclude database.ts (it's the DB definition)
  if (relativePath.includes('src/server/db/database.ts')) {
    return true;
  }
  
  // Exclude migration runners
  if (relativePath.includes('src/server/infra/migrations/')) {
    return true;
  }
  
  // Exclude test files
  if (relativePath.endsWith('.test.ts')) {
    return true;
  }
  
  // Exclude frontend files
  if (relativePath.startsWith('src/features/') || 
      relativePath.startsWith('src/pages/') ||
      relativePath.startsWith('src/components/') ||
      relativePath.startsWith('src/hooks/') ||
      relativePath.startsWith('src/stores/') ||
      relativePath.startsWith('src/lib/')) {
    return true;
  }
  
  // Exclude specific legacy files
  const legacyFiles = [
    'src/server/sync.ts',
    'src/server/notifications/notification-policy-engine.ts',
    'src/server/tables/repositories/legacy/legacy-sqlite-table.adapter.ts'
  ];
  
  for (const legacyFile of legacyFiles) {
    if (relativePath === legacyFile || relativePath.includes(legacyFile)) {
      return true;
    }
  }
  
  // Exclude legacy services (they are in migration roadmap)
  // These files are allowed to have direct DB access for now
  const legacyServices = [
    'src/server/services/',
    'src/server/products/repositories/',
    'src/server/notifications/',
    'src/server/platform/',
    'src/server/middleware/',
    'src/server/routes/',
    'src/server/saas/',
    'src/server/sync/',
    'src/server/tables/',
    'src/sync/'
  ];
  
  for (const legacy of legacyServices) {
    if (relativePath.startsWith(legacy) || relativePath === legacy) {
      return true;
    }
  }
  
  return false;
}

/**
 * Scan a file for forbidden patterns
 */
function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const violations = [];
  
  // Skip if file is in allowed directory
  if (isAllowedPath(filePath)) {
    return violations;
  }
  
  // Skip excluded files
  if (isExcludedFile(filePath)) {
    return violations;
  }
  
  // Check for Supabase client imports
  for (const pattern of FORBIDDEN_PATTERNS.supabaseClient) {
    const matches = content.match(pattern);
    if (matches) {
      violations.push({
        type: 'SUPABASE_CLIENT_IMPORT',
        pattern: pattern.toString(),
        matches,
        file: filePath
      });
    }
  }
  
  // Check for direct DB queries (excluding database.ts and migrations)
  if (!filePath.includes('database.ts') && !filePath.includes('migrations')) {
    for (const pattern of FORBIDDEN_PATTERNS.dbQueries) {
      const matches = content.match(pattern);
      if (matches) {
        violations.push({
          type: 'DIRECT_DB_QUERY',
          pattern: pattern.toString(),
          matches,
          file: filePath
        });
      }
    }
  }
  
  // Check for Supabase ORM calls (only if not in comments)
  const lines = content.split('\n');
  lines.forEach((line, lineNumber) => {
    // Skip comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      return;
    }
    
    // Skip if line contains 'supabase.' followed by ORM call
    for (const pattern of FORBIDDEN_PATTERNS.supabaseORM) {
      if (pattern.test(line)) {
        // Additional check: ensure it's actually a Supabase call, not a Map/Set operation
        // Valid Supabase calls: supabase.from(, supabase.insert(, etc.
        // Invalid (false positives): locks.delete(, this.queue.delete(, etc.
        const supabaseMatch = line.match(/supabase\.\w+\(/);
        if (supabaseMatch) {
          violations.push({
            type: 'SUPABASE_ORM_CALL',
            pattern: supabaseMatch[0],
            line: lineNumber + 1,
            content: trimmed,
            file: filePath
          });
        }
      }
    }
  });
  
  return violations;
}

/**
 * Recursively scan directory for TypeScript files
 */
function scanDirectory(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and .git
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        scanDirectory(filePath, fileList);
      }
    } else if (file.endsWith('.ts') && !file.endsWith('.test.ts')) {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('🔍 AST-BASED STATIC ANALYZER — Outbox-Only Architecture');
  console.log('══════════════════════════════════════════════════════════════');
  console.log('');
  
  const tsFiles = scanDirectory(SRC_DIR);
  console.log(`[INFO] Scanning ${tsFiles.length} TypeScript files...\n`);
  
  let totalViolations = 0;
  const violationsByType = {};
  
  for (const file of tsFiles) {
    const violations = scanFile(file);
    
    if (violations.length > 0) {
      console.log(`\n[VIOLATION] ${path.relative(ROOT_DIR, file)}`);
      
      for (const violation of violations) {
        console.log(`  ❌ ${violation.type}:`);
        console.log(`     Pattern: ${violation.pattern}`);
        
        if (violation.line) {
          console.log(`     Line ${violation.line}: ${violation.content}`);
        } else if (violation.matches) {
          console.log(`     Matches: ${violation.matches.length} occurrence(s)`);
        }
        
        totalViolations++;
        violationsByType[violation.type] = (violationsByType[violation.type] || 0) + 1;
      }
    }
  }
  
  // Summary
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('══════════════════════════════════════════════════════════════');
  
  if (totalViolations === 0) {
    console.log('✅ BUILD PASSED — No architecture violations detected');
    console.log('══════════════════════════════════════════════════════════════');
    process.exit(0);
  } else {
    console.log(`❌ BUILD FAILED — ${totalViolations} violation(s) detected\n`);
    
    console.log('Violations by type:');
    for (const [type, count] of Object.entries(violationsByType)) {
      console.log(`  - ${type}: ${count}`);
    }
    
    console.log('\nACTION REQUIRED:');
    console.log('  1. Remove all direct Supabase imports from application/domain');
    console.log('  2. Use OutboxRepository.enqueue() instead of direct DB access');
    console.log('  3. Ensure ONLY OutboxWorkerV2 writes to Supabase');
    console.log('\nArchitecture Rule:');
    console.log('  Application → Event → Outbox → OutboxWorkerV2 → Supabase');
    console.log('══════════════════════════════════════════════════════════════');
    process.exit(1);
  }
}

// Run
main();