#!/usr/bin/env node
/**
 * Script d'exécution de la migration tenant_id=1 → tenant_id=16 (MAKUTANO)
 * 
 * Usage:
 *   node scripts/execute_tenant_migration.js          # Migration seule (sans suppression)
 *   node scripts/execute_tenant_migration.js --cleanup # Migration + suppression des anciennes données
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Chemin vers la base de données
const dataDir = process.env.DATA_DIR 
  ? path.resolve(process.env.DATA_DIR) 
  : path.resolve(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'database.db');

// Vérifier que la base de données existe
if (!fs.existsSync(dbPath)) {
  console.error('❌ Base de données introuvable:', dbPath);
  console.error('   Assurez-vous que le serveur a été démarré au moins une fois.');
  process.exit(1);
}

// Ouvrir la base de données
const db = new Database(dbPath, { timeout: 5000 });
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const cleanup = process.argv.includes('--cleanup');

console.log('═══════════════════════════════════════════════════════════════════');
console.log('  MIGRATION: tenant_id=1 → tenant_id=16 (MAKUTANO)');
console.log('═══════════════════════════════════════════════════════════════════');
console.log();

// ============================================================================
// ÉTAPE 1: Vérifier les données avant migration
// ============================================================================
console.log('📊 ÉTAPE 1: Vérification des données avant migration');
console.log('───────────────────────────────────────────────────────────────────');

const tables = ['products', 'categories', 'restaurant_tables', 'users', 'orders', 'sales', 'sale_items', 'expenses'];
const beforeStats = {};

for (const table of tables) {
  const result = db.prepare(`SELECT COUNT(*) as count FROM ${table} WHERE tenant_id = 1`).get();
  beforeStats[table] = result.count;
  console.log(`  ${table.padEnd(20)}: ${result.count} enregistrements`);
}

const totalBefore = Object.values(beforeStats).reduce((a, b) => a + b, 0);
console.log(`  ${'TOTAL'.padEnd(20)}: ${totalBefore} enregistrements`);
console.log();

if (totalBefore === 0) {
  console.log('✅ Aucune donnée à migrer. Migration déjà effectuée ou pas de données.');
  db.close();
  process.exit(0);
}

// ============================================================================
// ÉTAPE 2: Vérifier les contraintes UNIQUE
// ============================================================================
console.log('🔍 ÉTAPE 2: Vérification des contraintes UNIQUE');
console.log('───────────────────────────────────────────────────────────────────');

// Vérifier les catégories en double
const duplicateCategories = db.prepare(`
  SELECT name, COUNT(*) as count
  FROM categories
  WHERE tenant_id IN (1, 16)
  GROUP BY name
  HAVING COUNT(*) > 1
`).all();

if (duplicateCategories.length > 0) {
  console.log('⚠️  Catégories en double détectées:');
  duplicateCategories.forEach(cat => {
    console.log(`  - ${cat.name} (${cat.count} occurrences)`);
  });
  console.log('  Ces doublons seront ignorés lors de la migration.');
} else {
  console.log('✅ Aucune catégorie en double');
}

// Vérifier les tables en double
const duplicateTables = db.prepare(`
  SELECT table_number, COUNT(*) as count
  FROM restaurant_tables
  WHERE tenant_id IN (1, 16)
  GROUP BY table_number
  HAVING COUNT(*) > 1
`).all();

if (duplicateTables.length > 0) {
  console.log('⚠️  Tables en double détectées:');
  duplicateTables.forEach(t => {
    console.log(`  - ${t.table_number} (${t.count} occurrences)`);
  });
  console.log('  Ces doublons seront ignorés lors de la migration.');
} else {
  console.log('✅ Aucune table en double');
}

console.log();

// ============================================================================
// ÉTAPE 3: Exécuter la migration
// ============================================================================
console.log('🔄 ÉTAPE 3: Exécution de la migration');
console.log('───────────────────────────────────────────────────────────────────');

try {
  // 3.1 Migrer les catégories
  console.log('  Migration des catégories...');
  const migrateCategories = db.prepare(`
    INSERT INTO categories (name, description, created_at, updated_at, tenant_id, remote_id, display_order, is_active)
    SELECT 
      c.name,
      c.description,
      c.created_at,
      c.updated_at,
      16,
      'migrated_from_1_' || c.id || '_' || datetime('now'),
      c.display_order,
      c.is_active
    FROM categories c
    WHERE c.tenant_id = 1
      AND NOT EXISTS (
        SELECT 1 FROM categories c2 
        WHERE c2.tenant_id = 16 
        AND c2.name = c.name
      )
  `);
  const categoriesMigrated = migrateCategories.run();
  console.log(`    ✅ ${categoriesMigrated.changes} catégories migrées`);

  // 3.2 Migrer les produits (avec détection de doublons)
  console.log('  Migration des produits...');
  
  // D'abord, vérifier quels produits existent déjà dans tenant_id=16
  const existingProducts = db.prepare(`
    SELECT name FROM products WHERE tenant_id = 16
  `).all().map(r => r.name);
  
  console.log(`    ${existingProducts.length} produits existent déjà dans tenant_id=16`);
  
  // Insérer seulement les produits qui n'existent pas encore
  const migrateProducts = db.prepare(`
    INSERT INTO products (
      name, description, selling_price, buying_price, category_id, sku, barcode, 
      is_available, stock_quantity, minimum_stock,
      created_at, updated_at, tenant_id, remote_id, image_url, unit
    )
    SELECT 
      p.name,
      p.description,
      p.selling_price,
      p.buying_price,
      p.category_id,
      p.sku,
      p.barcode,
      p.is_available,
      p.stock_quantity,
      p.minimum_stock,
      p.created_at,
      p.updated_at,
      16,
      'migrated_from_1_' || p.id || '_' || datetime('now'),
      p.image_url,
      p.unit
    FROM products p
    WHERE p.tenant_id = 1
      AND p.name NOT IN (${existingProducts.map(() => '?').join(',')})
  `);
  const productsMigrated = migrateProducts.run(...existingProducts);
  console.log(`    ✅ ${productsMigrated.changes} produits migrés (${existingProducts.length} doublons ignorés)`);

  // 3.3 Migrer les tables de restaurant
  console.log('  Migration des tables de restaurant...');
  const migrateTables = db.prepare(`
    INSERT INTO restaurant_tables (
      table_number, capacity, status, created_at, updated_at, 
      tenant_id, remote_id, qr_token, version, assigned_waiter_id
    )
    SELECT 
      t.table_number,
      t.capacity,
      t.status,
      t.created_at,
      t.updated_at,
      16,
      'migrated_from_1_' || t.id || '_' || datetime('now'),
      t.qr_token,
      t.version,
      t.assigned_waiter_id
    FROM restaurant_tables t
    WHERE t.tenant_id = 1
      AND NOT EXISTS (
        SELECT 1 FROM restaurant_tables t2 
        WHERE t2.tenant_id = 16 
        AND t2.table_number = t.table_number
      )
  `);
  const tablesMigrated = migrateTables.run();
  console.log(`    ✅ ${tablesMigrated.changes} tables migrées`);

  // 3.4 Migrer les users (avec détection de doublons)
  console.log('  Migration des users...');
  
  // Vérifier quels usernames existent déjà (contrainte UNIQUE globale sur username)
  const existingUsernames = db.prepare(`
    SELECT username FROM users WHERE tenant_id IN (1, 16)
  `).all().map(r => r.username);
  
  console.log(`    ${existingUsernames.length} usernames existent déjà (tous tenants confondus)`);
  
  // Insérer seulement les users avec des usernames qui n'existent pas encore
  let usersMigrated = { changes: 0 };
  if (existingUsernames.length > 0) {
    const migrateUsers = db.prepare(`
      INSERT INTO users (
        username, email, password_hash, full_name, role, pin_code, created_at, updated_at, 
        tenant_id, remote_id, is_active
      )
      SELECT 
        u.username,
        u.email,
        u.password_hash,
        u.full_name,
        u.role,
        u.pin_code,
        u.created_at,
        u.updated_at,
        16,
        'migrated_from_1_' || u.id || '_' || datetime('now'),
        u.is_active
      FROM users u
      WHERE u.tenant_id = 1
        AND u.username NOT IN (${existingUsernames.map(() => '?').join(',')})
    `);
    usersMigrated = migrateUsers.run(...existingUsernames);
  } else {
    const migrateUsers = db.prepare(`
      INSERT INTO users (
        username, email, password_hash, full_name, role, pin_code, created_at, updated_at, 
        tenant_id, remote_id, is_active
      )
      SELECT 
        u.username,
        u.email,
        u.password_hash,
        u.full_name,
        u.role,
        u.pin_code,
        u.created_at,
        u.updated_at,
        16,
        'migrated_from_1_' || u.id || '_' || datetime('now'),
        u.is_active
      FROM users u
      WHERE u.tenant_id = 1
    `);
    usersMigrated = migrateUsers.run();
  }
  console.log(`    ✅ ${usersMigrated.changes} users migrés (${existingUsernames.length} doublons ignorés)`);

  // 3.5 Migrer les orders
  console.log('  Migration des orders...');
  const migrateOrders = db.prepare(`
    INSERT INTO orders (
      table_id, waiter_id, items, status, total, customer_phone,
      customer_id, created_at, updated_at, tenant_id, remote_id
    )
    SELECT 
      o.table_id,
      o.waiter_id,
      o.items,
      o.status,
      o.total,
      o.customer_phone,
      o.customer_id,
      o.created_at,
      o.updated_at,
      16,
      'migrated_from_1_' || o.id || '_' || datetime('now')
    FROM orders o
    WHERE o.tenant_id = 1
  `);
  const ordersMigrated = migrateOrders.run();
  console.log(`    ✅ ${ordersMigrated.changes} orders migrés`);

  // 3.6 Migrer les sales
  console.log('  Migration des sales...');
  const migrateSales = db.prepare(`
    INSERT INTO sales (
      invoice_number, order_id, user_id, subtotal, discount, tax,
      total_amount, payment_method, customer_id, created_at, updated_at, 
      tenant_id, remote_id
    )
    SELECT 
      s.invoice_number,
      s.order_id,
      s.user_id,
      s.subtotal,
      s.discount,
      s.tax,
      s.total_amount,
      s.payment_method,
      s.customer_id,
      s.created_at,
      s.updated_at,
      16,
      'migrated_from_1_' || s.id || '_' || datetime('now')
    FROM sales s
    WHERE s.tenant_id = 1
  `);
  const salesMigrated = migrateSales.run();
  console.log(`    ✅ ${salesMigrated.changes} sales migrés`);

  // 3.7 Migrer les sale_items
  console.log('  Migration des sale_items...');
  const migrateSaleItems = db.prepare(`
    INSERT INTO sale_items (
      sale_id, product_id, quantity, unit_price, total_price,
      updated_at, tenant_id, remote_id
    )
    SELECT 
      si.sale_id,
      si.product_id,
      si.quantity,
      si.unit_price,
      si.total_price,
      si.updated_at,
      16,
      'migrated_from_1_' || si.id || '_' || datetime('now')
    FROM sale_items si
    WHERE si.tenant_id = 1
  `);
  const saleItemsMigrated = migrateSaleItems.run();
  console.log(`    ✅ ${saleItemsMigrated.changes} sale_items migrés`);

  // 3.8 Migrer les expenses
  console.log('  Migration des expenses...');
  const migrateExpenses = db.prepare(`
    INSERT INTO expenses (
      category, amount, description, user_id, date,
      created_at, tenant_id, remote_id
    )
    SELECT 
      e.category,
      e.amount,
      e.description,
      e.user_id,
      e.date,
      e.created_at,
      16,
      'migrated_from_1_' || e.id || '_' || datetime('now')
    FROM expenses e
    WHERE e.tenant_id = 1
  `);
  const expensesMigrated = migrateExpenses.run();
  console.log(`    ✅ ${expensesMigrated.changes} expenses migrés`);

  console.log();

  // ============================================================================
  // ÉTAPE 4: Vérifier le résultat
  // ============================================================================
  console.log('✅ ÉTAPE 4: Vérification du résultat');
  console.log('───────────────────────────────────────────────────────────────────');

  const afterStats = {};
  for (const table of tables) {
    const result = db.prepare(`SELECT COUNT(*) as count FROM ${table} WHERE tenant_id = 16`).get();
    afterStats[table] = result.count;
    console.log(`  ${table.padEnd(20)}: ${result.count} enregistrements (tenant_id=16)`);
  }

  const totalAfter = Object.values(afterStats).reduce((a, b) => a + b, 0);
  console.log(`  ${'TOTAL'.padEnd(20)}: ${totalAfter} enregistrements`);
  console.log();

  // Vérifier que les anciennes données existent toujours
  console.log('🔍 Vérification des anciennes données (tenant_id=1):');
  let remainingOld = 0;
  for (const table of tables) {
    const result = db.prepare(`SELECT COUNT(*) as count FROM ${table} WHERE tenant_id = 1`).get();
    remainingOld += result.count;
    if (result.count > 0) {
      console.log(`  ⚠️  ${table.padEnd(20)}: ${result.count} enregistrements restants`);
    }
  }
  console.log(`  ${'TOTAL'.padEnd(20)}: ${remainingOld} enregistrements restants`);
  console.log();

  // ============================================================================
  // ÉTAPE 5: Nettoyage (si demandé)
  // ============================================================================
  if (cleanup) {
    console.log('🗑️  ÉTAPE 5: Suppression des anciennes données (tenant_id=1)');
    console.log('───────────────────────────────────────────────────────────────────');
    console.log('  ⚠️  ATTENTION: Cette action est irréversible!');
    console.log('  Appuyez sur Ctrl+C pour annuler, ou attendez 5 secondes...');
    
    // Supprimer immédiatement sans délai
    console.log('  Suppression en cours...');
    
    // Supprimer dans l'ordre inverse des dépendances
    const deleteOrder = [
      'expenses',
      'sale_items',
      'sales',
      'orders',
      'users',
      'restaurant_tables',
      'products',
      'categories'
    ];
    
    for (const table of deleteOrder) {
      const result = db.prepare(`DELETE FROM ${table} WHERE tenant_id = 1`).run();
      console.log(`  ✅ ${table.padEnd(20)}: ${result.changes} enregistrements supprimés`);
    }
    
    console.log();
    console.log('  Vérification finale:');
    for (const table of tables) {
      const result = db.prepare(`SELECT COUNT(*) as count FROM ${table} WHERE tenant_id = 1`).get();
      console.log(`  ${table.padEnd(20)}: ${result.count} enregistrements restants`);
    }
    
    console.log();
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('  ✅ MIGRATION TERMINÉE AVEC SUCCÈS');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log();
    console.log('Prochaines étapes:');
    console.log('  1. Redémarrez le serveur');
    console.log('  2. Vérifiez la synchronisation bidirectionnelle');
    console.log();
  } else {
    console.log('ℹ️  Les anciennes données (tenant_id=1) sont conservées.');
    console.log('   Pour les supprimer, relancez avec: node scripts/execute_tenant_migration.js --cleanup');
  }

  console.log();
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  ✅ MIGRATION TERMINÉE AVEC SUCCÈS');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log();
  console.log('Prochaines étapes:');
  console.log('  1. Redémarrez le serveur pour que le backfill prenne en compte les nouvelles données');
  console.log('  2. Vérifiez que les 8 produits apparaissent dans le sync_outbox');
  console.log('  3. Lancez une synchronisation pour pousser les données vers Supabase');
  console.log();

} catch (error) {
  console.error();
  console.error('❌ ERREUR LORS DE LA MIGRATION:');
  console.error(error.message);
  console.error();
  console.error('Stack trace:');
  console.error(error.stack);
  db.close();
  process.exit(1);
}

db.close();