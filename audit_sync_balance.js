#!/usr/bin/env node
/**
 * AUDIT DE LA SYNCHRONISATION BIDIRECTIONNELLE
 * Analyse factuelle sans modification de données
 */

const Database = require('better-sqlite3');
const path = require('path');

// Chemin vers la base de données SQLite
const dataDir = process.env.DATA_DIR 
  ? path.resolve(process.env.DATA_DIR) 
  : path.resolve(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'database.db');

// Ouvrir la base de données en lecture seule
const db = new Database(dbPath, { readonly: true });

console.log('═══════════════════════════════════════════════════════════════════');
console.log('  AUDIT DE SYNCHRONISATION BIDIRECTIONNELLE');
console.log('  (Lecture seule - aucune modification)');
console.log('═══════════════════════════════════════════════════════════════════');
console.log();

// ============================================================================
// 1. PRODUITS SQLITE tenant_id=16
// ============================================================================
console.log('📊 1. PRODUITS SQLite (tenant_id=16)');
console.log('───────────────────────────────────────────────────────────────────');
const productsCount = db.prepare(`
  SELECT COUNT(*) as count FROM products WHERE tenant_id = 16
`).get();
console.log(`  Total: ${productsCount.count} produits`);
console.log();

// ============================================================================
// 2. PRODUITS Supabase tenant_id=16
// ============================================================================
console.log('📊 2. PRODUITS Supabase (tenant_id=16)');
console.log('───────────────────────────────────────────────────────────────────');
console.log('  ⚠️  Non vérifiable depuis SQLite - nécessite une connexion Supabase');
console.log('  Note: L\'utilisateur a indiqué 5 produits dans Supabase');
console.log();

// ============================================================================
// 3. Liste des produits SQLite avec remote_id numérique
// ============================================================================
console.log('📊 3. Produits SQLite avec remote_id NUMÉRIQUE');
console.log('───────────────────────────────────────────────────────────────────');
const numericRemoteProducts = db.prepare(`
  SELECT id, name, remote_id, tenant_id
  FROM products 
  WHERE tenant_id = 16 
    AND remote_id IS NOT NULL 
    AND remote_id NOT LIKE 'migrated_%'
  ORDER BY id
`).all();

if (numericRemoteProducts.length > 0) {
  console.log(`  ${numericRemoteProducts.length} produits trouvés:`);
  numericRemoteProducts.forEach(p => {
    console.log(`    - ID: ${p.id}, Nom: ${p.name}, remote_id: ${p.remote_id}`);
  });
} else {
  console.log('  Aucun produit avec remote_id numérique trouvé');
}
console.log();

// ============================================================================
// 4. Liste des produits SQLite avec remote_id "migrated_*"
// ============================================================================
console.log('📊 4. Produits SQLite avec remote_id "migrated_*"');
console.log('───────────────────────────────────────────────────────────────────');
const migratedProducts = db.prepare(`
  SELECT id, name, remote_id, tenant_id
  FROM products 
  WHERE tenant_id = 16 
    AND remote_id LIKE 'migrated_%'
  ORDER BY id
`).all();

if (migratedProducts.length > 0) {
  console.log(`  ${migratedProducts.length} produits trouvés:`);
  migratedProducts.forEach(p => {
    console.log(`    - ID: ${p.id}, Nom: ${p.name}, remote_id: ${p.remote_id}`);
  });
} else {
  console.log('  Aucun produit avec remote_id migrated_* trouvé');
}
console.log();

// ============================================================================
// 5. Vérification de l'existence dans Supabase (par remote_id numérique)
// ============================================================================
console.log('📊 5. Vérification existence Supabase (remote_id numérique)');
console.log('───────────────────────────────────────────────────────────────────');
console.log('  ⚠️  Non vérifiable depuis SQLite - nécessite une connexion Supabase');
console.log('  Produits à vérifier manuellement dans Supabase:');
numericRemoteProducts.forEach(p => {
  console.log(`    - ID SQLite: ${p.id}, remote_id: ${p.remote_id}, Nom: ${p.name}`);
});
console.log();

// ============================================================================
// 6. Vérification de l'existence dans Supabase (par nom pour migrated_*)
// ============================================================================
console.log('📊 6. Vérification existence Supabase (produits migrated_* par nom)');
console.log('───────────────────────────────────────────────────────────────────');
console.log('  ⚠️  Non vérifiable depuis SQLite - nécessite une connexion Supabase');
console.log('  Produits à vérifier manuellement dans Supabase:');
migratedProducts.forEach(p => {
  console.log(`    - ID SQLite: ${p.id}, Nom: ${p.name}, remote_id: ${p.remote_id}`);
});
console.log();

// ============================================================================
// 7. Nombre de users SQLite tenant_id=16
// ============================================================================
console.log('📊 7. USERS SQLite (tenant_id=16)');
console.log('───────────────────────────────────────────────────────────────────');
const users16Count = db.prepare(`
  SELECT COUNT(*) as count FROM users WHERE tenant_id = 16
`).get();
console.log(`  Total: ${users16Count.count} users`);
console.log();

// ============================================================================
// 8. Nombre de users Supabase tenant_id=16
// ============================================================================
console.log('📊 8. USERS Supabase (tenant_id=16)');
console.log('───────────────────────────────────────────────────────────────────');
console.log('  ⚠️  Non vérifiable depuis SQLite - nécessite une connexion Supabase');
console.log('  Note: L\'utilisateur a indiqué 12 users dans Supabase');
console.log();

// ============================================================================
// 9. Comparaison des usernames SQLite vs Supabase
// ============================================================================
console.log('📊 9. Comparaison usernames SQLite tenant_id=16 vs Supabase');
console.log('───────────────────────────────────────────────────────────────────');
const sqliteUsers16 = db.prepare(`
  SELECT username, email, full_name FROM users WHERE tenant_id = 16 ORDER BY username
`).all();

console.log(`  Users SQLite tenant_id=16 (${sqliteUsers16.length}):`);
sqliteUsers16.forEach(u => {
  console.log(`    - ${u.username} (${u.email})`);
});
console.log();
console.log('  ⚠️  Users Supabase non vérifiables depuis SQLite');
console.log();

// ============================================================================
// 10. Liste des users avec tenant_id=1
// ============================================================================
console.log('📊 10. USERS SQLite avec tenant_id=1 (non migrés)');
console.log('───────────────────────────────────────────────────────────────────');
const users1 = db.prepare(`
  SELECT id, username, email, full_name, role, created_at
  FROM users 
  WHERE tenant_id = 1 
  ORDER BY id
`).all();

if (users1.length > 0) {
  console.log(`  ${users1.length} users trouvés:`);
  users1.forEach(u => {
    console.log(`    - ID: ${u.id}, Username: ${u.username}, Email: ${u.email}, Rôle: ${u.role}`);
  });
} else {
  console.log('  ✅ Aucun user avec tenant_id=1 trouvé');
}
console.log();

// ============================================================================
// 11. Vérifier si ces users existent dans tenant_id=16
// ============================================================================
console.log('📊 11. Vérification existence dans tenant_id=16');
console.log('───────────────────────────────────────────────────────────────────');
if (users1.length > 0) {
  users1.forEach(u => {
    const exists = db.prepare(`
      SELECT COUNT(*) as count FROM users 
      WHERE tenant_id = 16 AND username = ?
    `).get(u.username);
    
    if (exists.count > 0) {
      console.log(`  ⚠️  ${u.username} existe DÉJÀ dans tenant_id=16 (conflit)`);
    } else {
      console.log(`  ℹ️  ${u.username} n'existe PAS dans tenant_id=16 (peut être migré)`);
    }
  });
} else {
  console.log('  ✅ Aucune vérification nécessaire (pas de users tenant_id=1)');
}
console.log();

// ============================================================================
// 12. Vérifier le contenu de sync_outbox
// ============================================================================
console.log('📊 12. CONTENU DE SYNC_OUTBOX');
console.log('───────────────────────────────────────────────────────────────────');

// Vérifier si la table existe
const tableExists = db.prepare(`
  SELECT COUNT(*) as count FROM sqlite_master 
  WHERE type='table' AND name='sync_outbox'
`).get();

if (tableExists.count > 0) {
  const totalOutbox = db.prepare(`
    SELECT COUNT(*) as count FROM sync_outbox
  `).get();
  console.log(`  Total lignes dans sync_outbox: ${totalOutbox.count}`);
  
  // Par entité
  const byEntity = db.prepare(`
    SELECT entity, COUNT(*) as count 
    FROM sync_outbox 
    GROUP BY entity 
    ORDER BY entity
  `).all();
  
  if (byEntity.length > 0) {
    console.log('  Par entité:');
    byEntity.forEach(row => {
      console.log(`    - ${row.entity}: ${row.count}`);
    });
  }
  
  // Par statut
  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as count 
    FROM sync_outbox 
    GROUP BY status 
    ORDER BY status
  `).all();
  
  if (byStatus.length > 0) {
    console.log('  Par statut:');
    byStatus.forEach(row => {
      console.log(`    - ${row.status}: ${row.count}`);
    });
  }
  
  // Par tenant
  const byTenant = db.prepare(`
    SELECT tenant_id, COUNT(*) as count 
    FROM sync_outbox 
    GROUP BY tenant_id 
    ORDER BY tenant_id
  `).all();
  
  if (byTenant.length > 0) {
    console.log('  Par tenant_id:');
    byTenant.forEach(row => {
      console.log(`    - tenant_id=${row.tenant_id}: ${row.count}`);
    });
  }
} else {
  console.log('  ⚠️  Table sync_outbox n\'existe pas');
}
console.log();

// ============================================================================
// 13. Vérifier les lignes pending et failed
// ============================================================================
console.log('📊 13. LIGNES PENDING ET FAILED');
console.log('───────────────────────────────────────────────────────────────────');

if (tableExists.count > 0) {
  const pending = db.prepare(`
    SELECT COUNT(*) as count FROM sync_outbox WHERE status = 'pending'
  `).get();
  console.log(`  Pending: ${pending.count}`);
  
  const failed = db.prepare(`
    SELECT COUNT(*) as count FROM sync_outbox WHERE status = 'failed'
  `).get();
  console.log(`  Failed: ${failed.count}`);
  
  if (failed.count > 0) {
    console.log('  Détail des échecs:');
    const failedDetails = db.prepare(`
      SELECT id, entity, tenant_id, error_message, created_at
      FROM sync_outbox 
      WHERE status = 'failed'
      ORDER BY created_at DESC
      LIMIT 10
    `).all();
    
    failedDetails.forEach(f => {
      console.log(`    - ID: ${f.id}, Entity: ${f.entity}, Tenant: ${f.tenant_id}`);
      console.log(`      Erreur: ${f.error_message || 'N/A'}`);
      console.log(`      Date: ${f.created_at}`);
    });
  }
} else {
  console.log('  ⚠️  Table sync_outbox n\'existe pas');
}
console.log();

// ============================================================================
// 14. Vérifier si des produits ont été ignorés par le moteur de synchronisation
// ============================================================================
console.log('📊 14. PRODUITS POTENTIELLEMENT IGNORÉS PAR LA SYNCHRO');
console.log('───────────────────────────────────────────────────────────────────');

if (tableExists.count > 0) {
  // Produits SQLite sans entrée dans sync_outbox
  const productsWithoutOutbox = db.prepare(`
    SELECT p.id, p.name, p.tenant_id, p.remote_id, p.updated_at
    FROM products p
    LEFT JOIN sync_outbox so ON (
      so.entity = 'product' 
      AND so.record_id = p.id 
      AND so.tenant_id = p.tenant_id
    )
    WHERE p.tenant_id = 16
      AND so.id IS NULL
    ORDER BY p.id
  `).all();
  
  if (productsWithoutOutbox.length > 0) {
    console.log(`  ${productsWithoutOutbox.length} produits SANS entrée dans sync_outbox:`);
    productsWithoutOutbox.forEach(p => {
      console.log(`    - ID: ${p.id}, Nom: ${p.name}, remote_id: ${p.remote_id || 'NULL'}, Updated: ${p.updated_at}`);
    });
  } else {
    console.log('  ✅ Tous les produits ont une entrée dans sync_outbox');
  }
  
  // Produits dans sync_outbox mais pas dans la table products
  const orphanOutbox = db.prepare(`
    SELECT so.id, so.record_id, so.tenant_id, so.status
    FROM sync_outbox so
    LEFT JOIN products p ON (
      p.id = so.record_id 
      AND p.tenant_id = so.tenant_id
    )
    WHERE so.entity = 'product'
      AND p.id IS NULL
    ORDER BY so.created_at DESC
    LIMIT 10
  `).all();
  
  if (orphanOutbox.length > 0) {
    console.log();
    console.log(`  ⚠️  ${orphanOutbox.length} entrées orphelines dans sync_outbox (produit supprimé?):`);
    orphanOutbox.forEach(o => {
      console.log(`    - Outbox ID: ${o.id}, Record ID: ${o.record_id}, Tenant: ${o.tenant_id}, Status: ${o.status}`);
    });
  }
} else {
  console.log('  ⚠️  Table sync_outbox n\'existe pas');
}
console.log();

// ============================================================================
// RÉSUMÉ ET ÉCARTS DÉTECTÉS
// ============================================================================
console.log('═══════════════════════════════════════════════════════════════════');
console.log('  RÉSUMÉ ET ÉCARTS DÉTECTÉS');
console.log('═══════════════════════════════════════════════════════════════════');
console.log();

console.log('PRODUITS:');
console.log(`  SQLite tenant_id=16: ${productsCount.count}`);
console.log(`  Supabase tenant_id=16: 5 (selon utilisateur)`);
console.log(`  Écart: ${productsCount.count - 5} produits en plus dans SQLite`);
console.log();
console.log(`  Produits avec remote_id numérique: ${numericRemoteProducts.length}`);
console.log(`  Produits avec remote_id migrated_*: ${migratedProducts.length}`);
console.log();

console.log('USERS:');
console.log(`  SQLite tenant_id=16: ${users16Count.count}`);
console.log(`  SQLite tenant_id=1: ${users1.length} (non migrés)`);
console.log(`  Supabase tenant_id=16: 12 (selon utilisateur)`);
console.log(`  Écart SQLite vs Supabase: ${Math.abs(users16Count.count - 12)} users`);
console.log();

if (users1.length > 0) {
  console.log('USERS À MIGRER (tenant_id=1 → tenant_id=16):');
  users1.forEach(u => {
    console.log(`  - ${u.username} (${u.email})`);
  });
}
console.log();

console.log('SYNC_OUTBOX:');
if (tableExists.count > 0) {
  const totalOutboxFinal = db.prepare(`SELECT COUNT(*) as count FROM sync_outbox`).get();
  const pendingFinal = db.prepare(`SELECT COUNT(*) as count FROM sync_outbox WHERE status = 'pending'`).get();
  const failedFinal = db.prepare(`SELECT COUNT(*) as count FROM sync_outbox WHERE status = 'failed'`).get();
  
  console.log(`  Total: ${totalOutboxFinal.count}`);
  console.log(`  Pending: ${pendingFinal.count}`);
  console.log(`  Failed: ${failedFinal.count}`);
} else {
  console.log('  Table n\'existe pas');
}
console.log();

console.log('═══════════════════════════════════════════════════════════════════');
console.log('  FIN DE L\'AUDIT');
console.log('═══════════════════════════════════════════════════════════════════');

db.close();