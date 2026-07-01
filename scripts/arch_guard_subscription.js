#!/usr/bin/env node
// =============================================================================
// ARCHITECTURE GUARD — Subscription Legacy Enforcement (SUB-029)
// =============================================================================
// Scanne tout le codebase pour détecter toute réintroduction du legacy
// subscription system. Bloque le CI si détecté.
// =============================================================================

const fs = require('fs');
const path = require('path');

// ── Configuration ─────────────────────────────────────────────────────────────

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');

// Extensions à scanner
const SCAN_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// Répertoires à ignorer
const EXCLUDE_DIRS = [
  'node_modules',
  'dist',
  'dist-electron',
  '.git',
  'backend',
  'frontend',
  'docs',
  'scripts',
];

// ── Patterns interdits (REGEX) ────────────────────────────────────────────────

const FORBIDDEN_PATTERNS = [
  {
    pattern: /activateTenantSub\s*\(/,
    name: 'activateTenantSub',
    severity: 'CRITICAL',
    message: 'Fonction legacy activateTenantSub interdite. Utiliser SubscriptionApplicationService.activateSubscription()',
  },
  {
    pattern: /subscription_payment_requests\s*\.\s*update\s*\(/,
    name: 'direct_subscription_payment_mutation',
    severity: 'HIGH',
    message: 'Mutation directe de subscription_payment_requests interdite. Utiliser SubscriptionApplicationService',
  },
  // db.prepare lecture seule est autorisée (lecture de données)
  // Seules les mutations directes subscription dans le FLUX ADMIN sont interdites
  // Supporte les parenthèses () et backticks ` pour les templates SQL
  {
    pattern: /db\s*\.\s*prepare\s*\(\s*(?:'|"|`)[^'"`]*subscriptions\s+SET\s+/i,
    name: 'direct_sqlite_subscription_mutation',
    severity: 'HIGH',
    message: 'Mutation SQLite directe sur subscription interdite. Utiliser le repository V2.1',
  },
  {
    pattern: /withOutboxTransaction\s*\([^)]*subscription/i,
    name: 'legacy_sync_subscription',
    severity: 'HIGH',
    message: 'Sync legacy withOutboxTransaction sur subscription interdite. Utiliser le sync system V2.1',
  },
  {
    pattern: /if\s*\(useV2\b/i,
    name: 'legacy_fallback_if_v2',
    severity: 'CRITICAL',
    message: 'Fallback conditionnel "if useV2" interdit après SUB-028. V2.1 est l\'unique flux',
  },
  {
    pattern: /USE_V2_SUBSCRIPTION_FLOW/i,
    name: 'USE_V2_SUBSCRIPTION_FLOW_flag',
    severity: 'CRITICAL',
    message: 'Feature flag USE_V2_SUBSCRIPTION_FLOW interdit après SUB-028. V2.1 est permanent',
  },
  {
    pattern: /V2_CUTOVER_PERCENTAGE/i,
    name: 'V2_CUTOVER_PERCENTAGE_flag',
    severity: 'CRITICAL',
    message: 'Feature flag V2_CUTOVER_PERCENTAGE interdit après SUB-028. Cutover terminé',
  },
  {
    pattern: /ENABLE_DUAL_RUN_VALIDATION/i,
    name: 'ENABLE_DUAL_RUN_VALIDATION_flag',
    severity: 'CRITICAL',
    message: 'Feature flag ENABLE_DUAL_RUN_VALIDATION interdit après SUB-028. Dual-run terminé',
  },
  // Vérifie la présence de 'legacy_reject_logic' SEULEMENT dans du code actif,
  // pas dans les définitions de types (type unions)
  {
    pattern: /['"]legacy_reject_logic['"]/i,
    name: 'legacy_reject_logic',
    severity: 'HIGH',
    message: 'Legacy reject logic interdite. Utiliser SubscriptionApplicationService.suspendSubscription()',
  },
  // queueSyncChange sur subscription est interdit dans les nouveaux flux
  // MAIS autorisé dans les fichiers legacy frozen (SUB-026)
  {
    pattern: /queueSyncChange\s*\(\s*(?:'|"|`)[^'"`]*subscription(?:s|_payment_request)?['"`]\s*,/i,
    name: 'legacy_sync_subscription_change',
    severity: 'HIGH',
    message: 'queueSyncChange sur subscription interdit. Utiliser le sync system V2.1',
  },
];

// ── Exemptions connues (fichiers autorisés à contenir du legacy) ──────────────

const EXEMPTED_FILES = [
  // Fichiers contenant encore du legacy mais frozen par SUB-026
  'src/server/routes/admin.subscriptions.ts',
  'src/server/middleware/subscription-guard.ts',
  // Fichiers de configuration
  'src/server/config/env.ts',
  // Fichiers de scripts et tests
  'scripts/',
  'frontend/',
  // Définitions de types d'architecture - pas du code legacy actif
  'src/server/infrastructure/architecture-enforcer.ts',
  // Dual-run validator legacy (conservé pour monitoring, pas pour flux)
  'src/server/infrastructure/validation/dual-run-validator.ts',
  // Services hors-scope (seront migrés dans un SUB dédié)
  'src/server/routes/billing.routes.ts',
  'src/server/routes/platform.routes.ts',
  'src/server/saas/cron/expiration.cron.ts',
  'src/server/services/voucher.service.ts',
];

function isExempted(filePath) {
  const relativePath = path.relative(ROOT_DIR, filePath);
  return EXEMPTED_FILES.some(exempt => relativePath.startsWith(exempt));
}

// ── Scan ──────────────────────────────────────────────────────────────────────

function scanDirectory(dirPath, results = []) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(entry.name)) {
        scanDirectory(fullPath, results);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (SCAN_EXTENSIONS.includes(ext)) {
        scanFile(fullPath, results);
      }
    }
  }

  return results;
}

function scanFile(filePath, results) {
  if (isExempted(filePath)) {
    return;
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return;
  }

  const relativePath = path.relative(ROOT_DIR, filePath);
  const lines = content.split('\n');

  for (const forbidden of FORBIDDEN_PATTERNS) {
    let match;
    // Reset lastIndex for global regex
    forbidden.pattern.lastIndex = 0;
    while ((match = forbidden.pattern.exec(content)) !== null) {
      // Calculer le numéro de ligne
      const charPos = match.index;
      const lineNum = content.substring(0, charPos).split('\n').length;
      const lineContent = lines[lineNum - 1]?.trim() || '';

      results.push({
        file: relativePath,
        line: lineNum,
        column: charPos,
        pattern: forbidden.name,
        severity: forbidden.severity,
        message: forbidden.message,
        code: lineContent.substring(0, 120),
      });

      // Éviter la boucle infinie
      if (!forbidden.pattern.global) break;
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('');
console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║       🏛  SUB-029 : Architecture Guard - Subscription          ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log('');

console.log(`📁 Scanning: ${SRC_DIR}`);
console.log('');

const results = scanDirectory(SRC_DIR, []);

if (results.length === 0) {
  console.log('✅  Aucun pattern legacy subscription détecté.');
  console.log('');
  console.log('🎉 Architecture V2.1 propre et sûre.');
  console.log('');
  process.exit(0);
} else {
  console.log(`❌  ${results.length} violation(s) détectée(s) !`);
  console.log('');

  // Grouper par sévérité
  const critical = results.filter(r => r.severity === 'CRITICAL');
  const high = results.filter(r => r.severity === 'HIGH');
  const medium = results.filter(r => r.severity === 'MEDIUM');

  if (critical.length > 0) {
    console.log('🔴  CRITICAL :');
    critical.forEach(r => {
      console.log(`   📄 ${r.file}:${r.line}:${r.column}`);
      console.log(`   ⚠️  ${r.message}`);
      console.log(`   💻 ${r.code}`);
      console.log('');
    });
  }

  if (high.length > 0) {
    console.log('🟠  HIGH :');
    high.forEach(r => {
      console.log(`   📄 ${r.file}:${r.line}:${r.column}`);
      console.log(`   ⚠️  ${r.message}`);
      console.log(`   💻 ${r.code}`);
      console.log('');
    });
  }

  if (medium.length > 0) {
    console.log('🟡  MEDIUM :');
    medium.forEach(r => {
      console.log(`   📄 ${r.file}:${r.line}:${r.column}`);
      console.log(`   ⚠️  ${r.message}`);
      console.log(`   💻 ${r.code}`);
      console.log('');
    });
  }

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('🚨  CI BLOCKED : Legacy subscription code détecté.');
  console.log('👉  Utiliser SubscriptionApplicationService (V2.1) obligatoirement.');
  console.log('👉  Consulter docs/SUB_020_LEGACY_DEPENDENCIES_REPORT.md');
  console.log('');
  process.exit(1);
}