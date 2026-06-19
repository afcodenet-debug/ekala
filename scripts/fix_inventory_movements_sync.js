/**
 * Script de correction pour les mouvements d'inventaire échoués
 * 
 * Ce script :
 * 1. Réinitialise les mouvements inventory_movement échoués dans sync_outbox
 * 2. Vérifie les données locales et Supabase
 * 3. Force une re-synchronisation
 * 
 * Usage: node scripts/fix_inventory_movements_sync.js
 */

const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Configuration
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/database.db');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pwxlnshtotpagsyqegiz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY est requis');
  process.exit(1);
}

console.log('=== Script de Correction des Mouvements d\'Inventaire ===\n');

// Initialisation
const db = new Database(DB_PATH);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

try {
  // 1. Analyser les mouvements échoués
  console.log('1. Analyse des mouvements échoués...');
  const failedMovements = db.prepare(`
    SELECT o.id, o.entity, o.record_id, o.status, o.last_error, o.retry_count
    FROM sync_outbox o
    WHERE o.entity = 'inventory_movement' 
      AND o.status IN ('pending', 'failed', 'in_progress')
    ORDER BY o.created_at DESC
  `).all();
  
  console.log(`   Trouvé ${failedMovements.length} mouvements dans la file`);
  failedMovements.forEach(m => {
    console.log(`   - ID: ${m.id}, Record: ${m.record_id}, Status: ${m.status}, Erreur: ${m.last_error || 'none'}`);
  });
  
  // 2. Vérifier les mouvements dans la base locale
  console.log('\n2. Vérification des mouvements locaux...');
  const localMovements = db.prepare(`
    SELECT id, product_id, tenant_id, remote_id, reference_id, reference_type
    FROM inventory_movements
    WHERE remote_id IS NULL
    ORDER BY id
  `).all();
  
  console.log(`   Trouvé ${localMovements.length} mouvements locaux sans remote_id`);
  localMovements.forEach(m => {
    console.log(`   - ID: ${m.id}, Product: ${m.product_id}, Tenant: ${m.tenant_id}, Ref: ${m.reference_id} (${m.reference_type})`);
  });
  
  // 3. Vérifier le schéma Supabase
  console.log('\n3. Vérification du schéma Supabase...');
  const { data: schemaData, error: schemaError } = await supabase
    .rpc('get_table_schema', { table_name: 'inventory_movements' })
    .catch(async () => {
      // Fallback: essayer une requête directe
      const { data, error } = await supabase
        .from('inventory_movements')
        .select('*')
        .limit(1);
      return { data, error };
    });
  
  // 4. Corriger les entrées échouées
  console.log('\n4. Réinitialisation des mouvements échoués...');
  const resetResult = db.prepare(`
    UPDATE sync_outbox 
    SET status = 'pending', retry_count = 0, last_error = NULL
    WHERE entity = 'inventory_movement' 
      AND status IN ('failed', 'in_progress')
  `).run();
  
  console.log(`   Réinitialisé ${resetResult.changes} mouvements`);
  
  // 5. Vérifier les produits locaux ont des remote_id
  console.log('\n5. Vérification des produits référencés...');
  const productsWithoutRemoteId = db.prepare(`
    SELECT DISTINCT im.product_id
    FROM inventory_movements im
    WHERE im.remote_id IS NULL 
      AND im.product_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM products p WHERE p.id = im.product_id AND p.remote_id IS NOT NULL)
  `).all();
  
  if (productsWithoutRemoteId.length > 0) {
    console.log(`   ⚠️  Attention: ${productsWithoutRemoteId.length} produits sans remote_id`);
    console.log('   Ces mouvements ne peuvent pas être synchronisés tant que les produits ne le sont pas');
    productsWithoutRemoteId.forEach(p => {
      console.log(`   - Product ID: ${p.product_id}`);
    });
  } else {
    console.log('   ✅ Tous les produits ont des remote_id');
  }
  
  // 6. Forcer la queue des mouvements manquants
  console.log('\n6. Queue des mouvements manquants...');
  let queued = 0;
  for (const movement of localMovements) {
    // Vérifier si déjà dans la file
    const inOutbox = db.prepare(`
      SELECT 1 FROM sync_outbox 
      WHERE entity = 'inventory_movement' 
        AND record_id = ? 
        AND status IN ('pending', 'in_progress')
    `).get(String(movement.id));
    
    if (!inOutbox) {
      const fullMovement = db.prepare(`SELECT * FROM inventory_movements WHERE id = ?`).get(movement.id);
      
      // Vérifier que le produit a un remote_id
      const product = db.prepare(`SELECT remote_id FROM products WHERE id = ?`).get(fullMovement.product_id);
      
      if (product && product.remote_id) {
        // Mettre à jour le mouvement avec le remote_id du produit
        // ( optionnel, pour la résolution FK)
        const updateStmt = db.prepare(`
          UPDATE inventory_movements 
          SET remote_id = ? 
          WHERE id = ?
        `);
        // Ne pas faire ça - le remote_id doit venir de Supabase après synchronisation
        
        // Queue le mouvement
        const id = require('crypto').randomUUID();
        db.prepare(`
          INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version, tenant_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          'inventory_movement',
          'insert',
          String(fullMovement.id),
          JSON.stringify(fullMovement),
          fullMovement.version || 1,
          fullMovement.tenant_id
        );
        queued++;
        console.log(`   ✅ Queue mouvement ${fullMovement.id} (tenant: ${fullMovement.tenant_id})`);
      } else {
        console.log(`   ⚠️  Mouvement ${fullMovement.id} non queue - produit ${fullMovement.product_id} sans remote_id`);
      }
    }
  }
  
  console.log(`\n7. Statistiques finales:`);
  console.log(`   - Mouvements réinitialisés: ${resetResult.changes}`);
  console.log(`   - Mouvements queue: ${queued}`);
  console.log(`   - Mouvements locaux sans remote_id: ${localMovements.length}`);
  
  console.log('\n=== Actions recommandées ===');
  console.log('1. Appliquer la migration Supabase: backend/migrations/supabase/003_fix_inventory_movements_reference_id_type.sql');
  console.log('2. Redémarrer l\'application pour relancer la synchronisation');
  console.log('3. Vérifier les logs pour confirmer la synchronisation');
  console.log('\n✅ Script terminé');
  
} catch (error) {
  console.error('\n❌ Erreur:', error);
  process.exit(1);
} finally {
  db.close();
  process.exit(0);
}
