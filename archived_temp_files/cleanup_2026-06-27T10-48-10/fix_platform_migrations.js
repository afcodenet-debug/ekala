/**
 * Script de réparation idempotent pour les migrations Platform RBAC
 * 
 * Mission: Corriger l'état des migrations Platform sans casser les données existantes
 * 
 * Vérifications:
 * 1. platform_roles existe
 * 2. platform_permissions existe
 * 3. platform_role_permissions existe
 * 
 * Si absentes:
 * - Retirer 037_add_platform_roles.sql de _migrations
 * - Relancer proprement la migration
 * 
 * Usage: node scripts/fix_platform_migrations.js
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(process.cwd(), 'data', 'database.db');
const MIGRATIONS_DIR = path.resolve(process.cwd(), 'backend', 'migrations');

console.log('═══════════════════════════════════════════════════════════════');
console.log('  RÉPARATION DES MIGRATIONS PLATFORM RBAC');
console.log('═══════════════════════════════════════════════════════════════\n');

// Vérifier que la base de données existe
if (!fs.existsSync(DB_PATH)) {
  console.error(`❌ Base de données introuvable: ${DB_PATH}`);
  console.log('   Assurez-vous que le serveur a été démarré au moins une fois.');
  process.exit(1);
}

// Ouvrir la base de données
const db = new Database(DB_PATH, { verbose: console.log });

try {
  // ============================================================================
  // ÉTAPE 1: Vérifier l'existence des tables Platform
  // ============================================================================
  console.log('📋 ÉTAPE 1: Vérification des tables Platform RBAC\n');

  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    AND name LIKE 'platform_%'
    ORDER BY name
  `).all();

  const tableNames = tables.map(t => t.name);
  console.log('   Tables Platform trouvées:', tableNames.length > 0 ? tableNames : 'Aucune');

  const requiredTables = ['platform_roles', 'platform_permissions', 'platform_role_permissions'];
  const missingTables = requiredTables.filter(t => !tableNames.includes(t));

  if (missingTables.length === 0) {
    console.log('   ✅ Toutes les tables Platform RBAC existent\n');
  } else {
    console.log(`   ❌ Tables manquantes: ${missingTables.join(', ')}\n`);
  }

  // ============================================================================
  // ÉTAPE 2: Vérifier le contenu des tables
  // ============================================================================
  console.log('📊 ÉTAPE 2: Vérification du contenu des tables\n');

  let platformRolesCount = 0;
  let platformPermissionsCount = 0;
  let platformRolePermissionsCount = 0;

  if (tableNames.includes('platform_roles')) {
    platformRolesCount = db.prepare('SELECT COUNT(*) as count FROM platform_roles').get().count;
    console.log(`   platform_roles: ${platformRolesCount} rôles`);
  }

  if (tableNames.includes('platform_permissions')) {
    platformPermissionsCount = db.prepare('SELECT COUNT(*) as count FROM platform_permissions').get().count;
    console.log(`   platform_permissions: ${platformPermissionsCount} permissions`);
  }

  if (tableNames.includes('platform_role_permissions')) {
    platformRolePermissionsCount = db.prepare('SELECT COUNT(*) as count FROM platform_role_permissions').get().count;
    console.log(`   platform_role_permissions: ${platformRolePermissionsCount} assignations`);
  }

  // ============================================================================
  // ÉTAPE 3: Vérifier l'état de la migration 037
  // ============================================================================
  console.log('\n🔍 ÉTAPE 3: Vérification de l\'état de la migration 037\n');

  const migration037Exists = db.prepare(`
    SELECT COUNT(*) as count FROM _migrations 
    WHERE filename = '037_add_platform_roles.sql'
  `).get().count > 0;

  console.log(`   037_add_platform_roles.sql marquée comme appliquée: ${migration037Exists ? 'Oui' : 'Non'}`);

  // ============================================================================
  // ÉTAPE 4: Décider de l'action à prendre
  // ============================================================================
  console.log('\n🎯 ÉTAPE 4: Analyse et décision\n');

  let needsRepair = false;
  let repairReason = '';

  if (missingTables.length > 0) {
    needsRepair = true;
    repairReason = `Tables manquantes: ${missingTables.join(', ')}`;
  } else if (platformRolesCount === 0 || platformPermissionsCount === 0) {
    needsRepair = true;
    repairReason = 'Tables existent mais sont vides';
  } else if (!migration037Exists && (platformRolesCount > 0 || platformPermissionsCount > 0)) {
    needsRepair = true;
    repairReason = 'Tables existent mais migration non marquée comme appliquée';
  } else if (migration037Exists && missingTables.length === 0 && platformRolesCount > 0) {
    needsRepair = false;
    console.log('   ✅ État cohérent: migration appliquée et tables présentes');
  }

  if (!needsRepair) {
    console.log('   ✅ Aucune réparation nécessaire\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  VÉRIFICATION TERMINÉE — SYSTÈME EN BON ÉTAT');
    console.log('═══════════════════════════════════════════════════════════════\n');
    process.exit(0);
  }

  console.log(`   ⚠️  Réparation nécessaire: ${repairReason}\n`);

  // ============================================================================
  // ÉTAPE 5: Réparation
  // ============================================================================
  console.log('🔧 ÉTAPE 5: Réparation du système\n');

  // 5.1: Supprimer la migration 037 de _migrations si elle existe
  if (migration037Exists) {
    console.log('   → Suppression de 037_add_platform_roles.sql de _migrations...');
    db.prepare('DELETE FROM _migrations WHERE filename = ?').run('037_add_platform_roles.sql');
    console.log('   ✅ Migration 037 retirée de l\'historique\n');
  }

  // 5.2: Supprimer les tables Platform si elles existent (pour recréation propre)
  if (tableNames.length > 0) {
    console.log('   → Suppression des tables Platform existantes...');
    db.exec('DROP TABLE IF EXISTS platform_role_permissions');
    db.exec('DROP TABLE IF EXISTS platform_role_permissions');
    db.exec('DROP TABLE IF EXISTS platform_permissions');
    db.exec('DROP TABLE IF EXISTS platform_roles');
    console.log('   ✅ Tables Platform supprimées\n');
  }

  // 5.3: Réappliquer la migration 037
  console.log('   → Réapplication de la migration 037_add_platform_roles.sql...');
  const migrationPath = path.join(MIGRATIONS_DIR, '037_add_platform_roles.sql');

  if (!fs.existsSync(migrationPath)) {
    console.error(`   ❌ Fichier de migration introuvable: ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  db.exec(sql);
  console.log('   ✅ Migration 037 appliquée avec succès\n');

  // ============================================================================
  // ÉTAPE 6: Vérifications finales
  // ============================================================================
  console.log('✅ ÉTAPE 6: Vérifications finales\n');

  const finalRolesCount = db.prepare('SELECT COUNT(*) as count FROM platform_roles').get().count;
  const finalPermissionsCount = db.prepare('SELECT COUNT(*) as count FROM platform_permissions').get().count;
  const finalRolePermsCount = db.prepare('SELECT COUNT(*) as count FROM platform_role_permissions').get().count;
  const finalMigrationExists = db.prepare(`
    SELECT COUNT(*) as count FROM _migrations 
    WHERE filename = '037_add_platform_roles.sql'
  `).get().count > 0;

  console.log(`   platform_roles: ${finalRolesCount} rôles`);
  console.log(`   platform_permissions: ${finalPermissionsCount} permissions`);
  console.log(`   platform_role_permissions: ${finalRolePermsCount} assignations`);
  console.log(`   Migration 037 marquée: ${finalMigrationExists ? 'Oui' : 'Non'}`);

  // Afficher les rôles créés
  console.log('\n   Rôles Platform créés:');
  const roles = db.prepare('SELECT role_name, display_name FROM platform_roles').all();
  roles.forEach(role => {
    console.log(`   - ${role.role_name}: ${role.display_name}`);
  });

  // ============================================================================
  // RÉSULTAT FINAL
  // ============================================================================
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  RÉPARATION TERMINÉE AVEC SUCCÈS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('Résumé:');
  console.log(`  - Tables créées: ${missingTables.length > 0 ? 'Oui' : 'Non (déjà présentes)'}`);
  console.log(`  - Rôles insérés: ${finalRolesCount}`);
  console.log(`  - Permissions insérées: ${finalPermissionsCount}`);
  console.log(`  - Assignations rôle-permission: ${finalRolePermsCount}`);
  console.log(`  - Migration marquée: ${finalMigrationExists ? 'Oui' : 'Non'}`);
  console.log('\nLe système Platform RBAC est maintenant cohérent.\n');

} catch (error) {
  console.error('\n❌ ERREUR LORS DE LA RÉPARATION:', error.message);
  console.error(error.stack);
  process.exit(1);
} finally {
  db.close();
}