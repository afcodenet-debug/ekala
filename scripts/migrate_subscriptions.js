#!/usr/bin/env node

/**
 * Migration Script: Fusionner tenant_subscriptions dans subscriptions
 * Date: 29 Juin 2026
 * 
 * Ce script:
 * 1. Sauvegarde tenant_subscriptions
 * 2. Migre les données vers subscriptions
 * 3. Supprime la table en doublon
 * 4. Ajoute les index nécessaires
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.resolve(process.cwd(), 'data', 'database.db');

console.log('🔄 Migration: Fusion des tables subscriptions...\n');

try {
  const db = new Database(DB_PATH);
  console.log('✅ Connexion à la base de données établie');

  // Étape 1: Vérifier si tenant_subscriptions existe
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tenant_subscriptions'").all();
  
  if (tables.length === 0) {
    console.log('ℹ️  Table tenant_subscriptions n\'existe pas, migration non nécessaire');
    process.exit(0);
  }

  console.log('📊 Table tenant_subscriptions trouvée');

  // Étape 2: Créer une sauvegarde
  console.log('\n💾 Création de la sauvegarde...');
  db.exec('CREATE TABLE IF NOT EXISTS tenant_subscriptions_backup AS SELECT * FROM tenant_subscriptions');
  const backupCount = db.prepare('SELECT COUNT(*) as count FROM tenant_subscriptions_backup').get().count;
  console.log(`   ✅ ${backupCount} enregistrements sauvegardés`);

  // Étape 3: Vérifier si la colonne voucher_code existe
  console.log('\n🔍 Vérification de la structure de la table subscriptions...');
  const columns = db.prepare("PRAGMA table_info(subscriptions)").all();
  const hasVoucherCode = columns.some(col => col.name === 'voucher_code');
  
  if (!hasVoucherCode) {
    console.log('   ➕ Ajout de la colonne voucher_code...');
    db.exec('ALTER TABLE subscriptions ADD COLUMN voucher_code TEXT');
    console.log('   ✅ Colonne voucher_code ajoutée');
  } else {
    console.log('   ✓ Colonne voucher_code existe déjà');
  }

  // Étape 4: Migrer les données
  console.log('\n📦 Migration des données...');
  
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO subscriptions (
      tenant_id, 
      plan_id, 
      status, 
      current_period_start, 
      current_period_end,
      trial_started_at,
      trial_ends_at,
      created_at,
      updated_at
    )
    SELECT 
      ts.tenant_id,
      ts.plan_id,
      ts.status,
      ts.current_period_start,
      ts.current_period_end,
      ts.trial_start,
      ts.trial_end,
      ts.created_at,
      ts.updated_at
    FROM tenant_subscriptions ts
    WHERE NOT EXISTS (
      SELECT 1 FROM subscriptions s 
      WHERE s.tenant_id = ts.tenant_id 
      AND s.plan_id = ts.plan_id
    )
  `);

  const result = insertStmt.run();
  console.log(`   ✅ ${result.changes} nouvelles subscriptions migrées`);

  // Étape 5: Mettre à jour last_voucher_code
  console.log('\n🔗 Mise à jour des codes voucher...');
  const updateStmt = db.prepare(`
    UPDATE subscriptions
    SET last_voucher_code = (
      SELECT ts.voucher_code 
      FROM tenant_subscriptions ts 
      WHERE ts.tenant_id = subscriptions.tenant_id
      LIMIT 1
    )
    WHERE EXISTS (
      SELECT 1 FROM tenant_subscriptions ts 
      WHERE ts.tenant_id = subscriptions.tenant_id
    )
  `);
  const updateResult = updateStmt.run();
  console.log(`   ✅ ${updateResult.changes} subscriptions mises à jour`);

  // Étape 6: Supprimer la table en doublon
  console.log('\n🗑️  Suppression de la table en doublon...');
  db.exec('DROP TABLE IF EXISTS tenant_subscriptions');
  console.log('   ✅ Table tenant_subscriptions supprimée');

  // Étape 7: Créer les index
  console.log('\n📇 Création des index...');
  db.exec('CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_plan ON subscriptions(tenant_id, plan_id)');
  console.log('   ✅ Index idx_subscriptions_tenant_plan créé');

  // Étape 8: Vérification finale
  console.log('\n✅ Vérification finale...');
  const totalSubs = db.prepare('SELECT COUNT(*) as count FROM subscriptions').get().count;
  console.log(`   📊 Total subscriptions: ${totalSubs}`);
  
  const sampleSubs = db.prepare('SELECT tenant_id, plan_id, status FROM subscriptions LIMIT 5').all();
  console.log('   📋 Aperçu des subscriptions:');
  sampleSubs.forEach(sub => {
    console.log(`      - Tenant ${sub.tenant_id}: Plan ${sub.plan_id} (${sub.status})`);
  });

  // Étape 9: Vérifier que tenant_subscriptions n'existe plus
  const checkTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tenant_subscriptions'").all();
  if (checkTable.length === 0) {
    console.log('\n✅ Migration terminée avec succès !');
    console.log('   - Table tenant_subscriptions fusionnée dans subscriptions');
    console.log('   - Données migrées et sauvegardées');
    console.log('   - Index créés pour les performances');
  } else {
    console.log('\n⚠️  Attention: La table tenant_subscriptions existe toujours');
  }

  db.close();

} catch (error) {
  console.error('\n❌ Erreur lors de la migration:', error.message);
  console.error(error.stack);
  process.exit(1);
}