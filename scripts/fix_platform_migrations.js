/**
 * Script de réparation des migrations Platform
 *
 * Objectif:
 *   1. Vérifier l'état des tables platform_roles, platform_permissions, platform_role_permissions
 *   2. Si absentes, retirer 037_add_platform_roles.sql de _migrations
 *   3. Lancer la migration proprement
 *
 * Utilisation:
 *   node scripts/fix_platform_migrations.js
 *
 * Sûreté:
 *   - Idempotent (peut être exécuté plusieurs fois)
 *   - Ne supprime AUCUNE donnée utilisateur
 *   - Ne modifie QUE _migrations et les tables Platform
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'database.db');
const MIGRATIONS_DIR = path.resolve(process.cwd(), 'backend', 'migrations');

console.log('═══════════════════════════════════════════════════════════════');
console.log('  FIX PLATFORM MIGRATIONS');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`DB: ${DB_PATH}`);

if (!fs.existsSync(DB_PATH)) {
  console.error('❌ Database not found at', DB_PATH);
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ── Étape 1: Vérifier l'état des tables Platform ──────────────────────────

function tableExists(name) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name);
  return !!row;
}

console.log('\n📊 ÉTAT DES TABLES PLATFORM:');
console.log('──────────────────────────────');

const tables = {
  platform_roles: tableExists('platform_roles'),
  platform_permissions: tableExists('platform_permissions'),
  platform_role_permissions: tableExists('platform_role_permissions'),
  platform_audit_logs: tableExists('platform_audit_logs'),
};

for (const [name, exists] of Object.entries(tables)) {
  console.log(`  ${exists ? '✅' : '❌'} ${name}`);
}

const allPlatformTablesPresent = Object.values(tables).every(v => v);
const neededTablesMissing = !tables.platform_roles || !tables.platform_permissions || !tables.platform_role_permissions;

// ── Étape 2: Vérifier si la migration 037 est dans _migrations ────────────

const migration037 = db.prepare(
  "SELECT filename FROM _migrations WHERE filename = '037_add_platform_roles.sql'"
).get();

const migration040 = db.prepare(
  "SELECT filename FROM _migrations WHERE filename = '040_create_platform_audit_logs.sql'"
).get();

console.log('\n📋 ÉTAT DES MIGRATIONS:');
console.log('────────────────────────');
console.log(`  037_add_platform_roles.sql   → ${migration037 ? '✅ enregistrée' : '❌ absente'}`);
console.log(`  040_create_platform_audit_logs.sql → ${migration040 ? '✅ enregistrée' : '❌ absente'}`);

// ── Étape 3: Réparer si nécessaire ────────────────────────────────────────

if (allPlatformTablesPresent) {
  console.log('\n✅ Toutes les tables Platform existent déjà. Aucune réparation nécessaire.');
} else {
  console.log('\n🛠️ RÉPARATION NÉCESSAIRE:');

  // Compter les plateform users existants (pour vérification)
  const platformUserCount = db.prepare(
    "SELECT COUNT(*) as count FROM users WHERE is_platform_user = 1"
  ).get().count;
  console.log(`  Utilisateurs platform existants: ${platformUserCount}`);

  // Retirer 037 de _migrations si elle est marquée mais tables absentes
  if (migration037 && neededTablesMissing) {
    console.log('  → Suppression de 037_add_platform_roles.sql de _migrations...');
    db.prepare("DELETE FROM _migrations WHERE filename = '037_add_platform_roles.sql'").run();
    console.log('  ✅ 037 retirée de _migrations. Sera réexécutée au prochain démarrage.');
  }

  // Retirer aussi 040 si elle est marquée mais table platform_audit_logs absente
  if (migration040 && !tables.platform_audit_logs) {
    console.log('  → Suppression de 040_create_platform_audit_logs.sql de _migrations...');
    db.prepare("DELETE FROM _migrations WHERE filename = '040_create_platform_audit_logs.sql'").run();
    console.log('  ✅ 040 retirée de _migrations. Sera réexécutée au prochain démarrage.');
  }

  // Exécuter immédiatement la migration 037
  console.log('\n🚀 EXÉCUTION IMMÉDIATE DE LA MIGRATION 037...');
  const sql037 = fs.readFileSync(path.join(MIGRATIONS_DIR, '037_add_platform_roles.sql'), 'utf8');

  try {
    db.transaction(() => {
      db.exec(sql037);
      db.prepare("INSERT OR REPLACE INTO _migrations (filename) VALUES ('037_add_platform_roles.sql')").run();
    })();
    console.log('  ✅ Migration 037 exécutée avec succès !');
  } catch (err) {
    console.error('  ❌ Échec de la migration 037:', err.message);
    process.exit(1);
  }

  // Exécuter immédiatement la migration 040 si nécessaire
  if (!tables.platform_audit_logs) {
    console.log('\n🚀 EXÉCUTION IMMÉDIATE DE LA MIGRATION 040...');
    const sql040 = fs.readFileSync(path.join(MIGRATIONS_DIR, '040_create_platform_audit_logs.sql'), 'utf8');

    try {
      db.transaction(() => {
        db.exec(sql040);
        db.prepare("INSERT OR REPLACE INTO _migrations (filename) VALUES ('040_create_platform_audit_logs.sql')").run();
      })();
      console.log('  ✅ Migration 040 exécutée avec succès !');
    } catch (err) {
      console.error('  ❌ Échec de la migration 040:', err.message);
      process.exit(1);
    }
  }
}

// ── Étape 4: Vérifications finales ────────────────────────────────────────

console.log('\n🔍 VÉRIFICATIONS FINALES:');
console.log('──────────────────────────');

const checks = [
  { name: 'platform_roles', sql: "SELECT COUNT(*) as count FROM platform_roles" },
  { name: 'platform_permissions', sql: "SELECT COUNT(*) as count FROM platform_permissions" },
  { name: 'platform_role_permissions', sql: "SELECT COUNT(*) as count FROM platform_role_permissions" },
];

for (const check of checks) {
  if (tableExists(check.name)) {
    const { count } = db.prepare(check.sql).get();
    console.log(`  ✅ ${check.name}: ${count} enregistrement(s)`);
  } else {
    console.log(`  ❌ ${check.name}: TABLE MANQUANTE`);
  }
}

// Migration status
const migrations = db.prepare("SELECT filename, applied_at FROM _migrations ORDER BY filename").all();
console.log('\n📋 MIGRATIONS ENREGISTRÉES:');
for (const m of migrations) {
  console.log(`  ${m.filename} → ${m.applied_at}`);
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  RÉPARATION TERMINÉE');
console.log('═══════════════════════════════════════════════════════════════');

db.close();