#!/usr/bin/env node

/**
 * Script de cleanup Phase 6 - Nettoie les fichiers temporaires de debug
 * Architecture V2.1 - Professional Cleanup
 * 
 * Usage: node scripts/cleanup_temp_files.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  // Dossiers à nettoyer
  tempPatterns: {
    scripts: [
      'diagnose_*.js',
      'test_*.js',
      'fix_*.js',
      'cleanup_*.js',
      'quick_*.js',
      'reproduce_*.js',
      'verify_*.js',
      'full_*.js',
      'run_*.js',
      'analyze_*.js',
      'audit_*.js',
      'complete_*.js',
      'final_*.js',
      'check_*.js',
      'refresh_*.js',
      'force_*.js',
      'manual_*.js',
      'recover_*.js',
      'reinject_*.js',
      'backfill_*.js',
      'create_*.js',
      'seed_*.js',
      'execute_*.js',
      'migrate_*.js',
      'init_*.js',
    ],
    root: [
      'diagnose_*.js',
      'test_*.js',
      'fix_*.sql',
      'FIX_*.sql',
      'SUPABASE_*.sql',
      'AUDIT_*.md',
      'test_*.json',
    ],
    docs: [
      'AUDIT_*.md',
      'DIAGNOSTIC_*.md',
      'REPORT_*.md',
      'SUMMARY_*.md',
      'FIX_*.md',
    ]
  },

  // Fichiers essentiels à conserver
  keepFiles: {
    scripts: [
      'seed_billing_tables.js',
      'seed_plans.js',
      'create_plans_table.js',
      'verify_plans_table.js',
      'init_plans.js',
      'check_tables.js',
      'execute_tenant_migration.js',
    ],
    root: [
      'schema_all.sql',
      'db_schema.sql',
    ]
  },

  // Extensions à supprimer
  tempExtensions: ['.log', '.tmp', '.bak'],

  // Dossiers à ignorer
  ignoreDirs: ['node_modules', '.git', 'dist', 'build', 'coverage']
};

// Utilitaires
class Logger {
  constructor() {
    this.colors = {
      reset: '\x1b[0m',
      green: '\x1b[32m',
      red: '\x1b[31m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      cyan: '\x1b[36m',
    };
  }

  info(msg) {
    console.log(`${this.colors.blue}[INFO]\x1b[0m ${msg}`);
  }

  success(msg) {
    console.log(`${this.colors.green}[SUCCESS]\x1b[0m ${msg}`);
  }

  warning(msg) {
    console.log(`${this.colors.yellow}[WARNING]\x1b[0m ${msg}`);
  }

  error(msg) {
    console.log(`${this.colors.red}[ERROR]\x1b[0m ${msg}`);
  }

  header(msg) {
    console.log(`\n${this.colors.cyan}${'='.repeat(60)}\x1b[0m`);
    console.log(`${this.colors.cyan}${msg}\x1b[0m`);
    console.log(`${this.colors.cyan}${'='.repeat(60)}\x1b[0m\n`);
  }
}

const logger = new Logger();

// Fonctions de cleanup
function shouldDeleteFile(filePath, patterns, keepFiles) {
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath);

  // Vérifier si c'est un fichier à conserver
  if (keepFiles.includes(fileName)) {
    return false;
  }

  // Vérifier les patterns
  for (const pattern of patterns) {
    if (matchPattern(fileName, pattern)) {
      return true;
    }
  }

  // Vérifier les extensions temporaires
  if (CONFIG.tempExtensions.includes(ext)) {
    return true;
  }

  return false;
}

function matchPattern(str, pattern) {
  // Convertir le pattern glob en regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(str);
}

function getFilesToDelete(dir, patterns, keepFiles) {
  const filesToDelete = [];

  if (!fs.existsSync(dir)) {
    return filesToDelete;
  }

  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Ignorer certains dossiers
      if (CONFIG.ignoreDirs.includes(item)) {
        continue;
      }
      // Récursion dans les sous-dossiers
      filesToDelete.push(...getFilesToDelete(fullPath, patterns, keepFiles));
    } else {
      if (shouldDeleteFile(fullPath, patterns, keepFiles)) {
        filesToDelete.push(fullPath);
      }
    }
  }

  return filesToDelete;
}

function deleteFiles(files, dryRun = true) {
  let deleted = 0;
  let failed = 0;

  for (const file of files) {
    try {
      if (dryRun) {
        logger.warning(`[DRY RUN] Would delete: ${file}`);
      } else {
        fs.unlinkSync(file);
        logger.success(`Deleted: ${file}`);
      }
      deleted++;
    } catch (error) {
      logger.error(`Failed to delete ${file}: ${error.message}`);
      failed++;
    }
  }

  return { deleted, failed };
}

function createArchiveDir() {
  const archiveDir = path.join(__dirname, '..', 'archived_temp_files');
  
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
    logger.info(`Created archive directory: ${archiveDir}`);
  }

  return archiveDir;
}

function archiveFiles(files) {
  const archiveDir = createArchiveDir();
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const batchDir = path.join(archiveDir, `cleanup_${timestamp}`);

  if (!fs.existsSync(batchDir)) {
    fs.mkdirSync(batchDir, { recursive: true });
  }

  let archived = 0;

  for (const file of files) {
    try {
      const fileName = path.basename(file);
      const destPath = path.join(batchDir, fileName);
      fs.copyFileSync(file, destPath);
      archived++;
    } catch (error) {
      logger.error(`Failed to archive ${file}: ${error.message}`);
    }
  }

  logger.success(`Archived ${archived} files to: ${batchDir}`);
  return batchDir;
}

// Fonction principale
async function main() {
  logger.header('Phase 6: Cleanup - Temporary Files Management');

  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  const archive = !args.includes('--no-archive');

  if (dryRun) {
    logger.warning('DRY RUN MODE - No files will be deleted');
    logger.info('Use --execute flag to actually delete files\n');
  }

  // 1. Analyser les scripts temporaires
  logger.info('Analyzing scripts directory...');
  const scriptsDir = path.join(__dirname);
  const scriptsToDelete = getFilesToDelete(
    scriptsDir,
    CONFIG.tempPatterns.scripts,
    CONFIG.keepFiles.scripts
  );

  // 2. Analyser les fichiers temporaires à la racine
  logger.info('Analyzing root directory...');
  const rootDir = path.join(__dirname, '..');
  const rootFilesToDelete = getFilesToDelete(
    rootDir,
    CONFIG.tempPatterns.root,
    CONFIG.keepFiles.root
  );

  // Filtrer pour ne garder que les fichiers à la racine (pas dans les sous-dossiers)
  const rootTempFiles = rootFilesToDelete.filter(file => {
    const relativePath = path.relative(rootDir, file);
    return !relativePath.includes(path.sep);
  });

  // 3. Analyser les docs temporaires
  logger.info('Analyzing docs directory...');
  const docsDir = path.join(rootDir, 'docs');
  const docsToDelete = getFilesToDelete(
    docsDir,
    CONFIG.tempPatterns.docs,
    []
  );

  // Résumé
  const totalFiles = scriptsToDelete.length + rootTempFiles.length + docsToDelete.length;
  
  logger.header('Cleanup Summary');
  console.log(`Scripts to delete:  ${scriptsToDelete.length}`);
  console.log(`Root files to delete: ${rootTempFiles.length}`);
  console.log(`Docs to delete:     ${docsToDelete.length}`);
  console.log(`Total:              ${totalFiles}\n`);

  if (totalFiles === 0) {
    logger.success('No temporary files found to clean up!');
    return;
  }

  // Archiver avant suppression
  if (!dryRun && archive) {
    logger.info('Archiving files before deletion...');
    const allFiles = [...scriptsToDelete, ...rootTempFiles, ...docsToDelete];
    archiveFiles(allFiles);
  }

  // Supprimer les fichiers
  if (!dryRun) {
    logger.info('Deleting files...');
    
    const scriptsResult = deleteFiles(scriptsToDelete, false);
    const rootResult = deleteFiles(rootTempFiles, false);
    const docsResult = deleteFiles(docsToDelete, false);

    const totalDeleted = scriptsResult.deleted + rootResult.deleted + docsResult.deleted;
    const totalFailed = scriptsResult.failed + rootResult.failed + docsResult.failed;

    logger.header('Cleanup Complete');
    logger.success(`Deleted: ${totalDeleted} files`);
    
    if (totalFailed > 0) {
      logger.error(`Failed: ${totalFailed} files`);
    }

    // Créer un rapport
    createCleanupReport({
      scripts: scriptsToDelete,
      root: rootTempFiles,
      docs: docsToDelete,
      deleted: totalDeleted,
      failed: totalFailed,
      timestamp: new Date().toISOString(),
    });
  } else {
    // Mode dry-run : afficher les fichiers qui seraient supprimés
    logger.header('Files that would be deleted (DRY RUN)');
    
    if (scriptsToDelete.length > 0) {
      console.log('\n📁 Scripts:');
      scriptsToDelete.slice(0, 10).forEach(f => console.log(`  - ${path.basename(f)}`));
      if (scriptsToDelete.length > 10) {
        console.log(`  ... and ${scriptsToDelete.length - 10} more`);
      }
    }

    if (rootTempFiles.length > 0) {
      console.log('\n📄 Root files:');
      rootTempFiles.forEach(f => console.log(`  - ${path.basename(f)}`));
    }

    if (docsToDelete.length > 0) {
      console.log('\n📚 Docs:');
      docsToDelete.slice(0, 10).forEach(f => console.log(`  - ${path.basename(f)}`));
      if (docsToDelete.length > 10) {
        console.log(`  ... and ${docsToDelete.length - 10} more`);
      }
    }

    console.log('\n');
  }
}

function createCleanupReport(data) {
  const reportDir = path.join(__dirname, '..', 'cleanup_reports');
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const reportFile = path.join(reportDir, `cleanup_${timestamp}.json`);

  const report = {
    ...data,
    config: CONFIG,
  };

  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  logger.info(`Cleanup report saved: ${reportFile}`);
}

// Exécution
main().catch(error => {
  logger.error(`Cleanup failed: ${error.message}`);
  process.exit(1);
});