/**
 * Script de réconciliation pour les mouvements d'inventaire
 * 
 * Ce script:
 * 1. Identifie et corrige les mouvements avec reference_id non-entier (ex: "3.0")
 * 2. Réinitialise les mouvements échoués dans sync_outbox
 * 3. Queue les mouvements manquants pour synchronisation
 * 4. Produit un rapport détaillé
 * 
 * Usage: node scripts/fix_inventory_movements_sync.js
 * 
 * IMPORTANT: Ne modifie pas le schéma Supabase - reference_id reste BIGINT
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

console.log('=== Script de Réconciliation des Mouvements d\'Inventaire ===\n');
console.log('Objectif: Corriger la synchronisation sans modifier le schéma Supabase\n');

// Initialisation
const db = new Database(DB_PATH);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Rapport
const report = {
  movementsRepares: 0,
  movementsRequeue: 0,
  movementsSynchronises: 0,
  movementsRestantEnErreur: 0,
  details: {
    referenceIdCorriges: [],
    mouvementsEchoues: [],
    produitsSansRemoteId: []
  }
};

try {
  // ========================================================================
  // ÉTAPE 1: Corriger les reference_id problématiques dans SQLite
  // ========================================================================
  console.log('1. Correction des reference_id non-entiers dans SQLite...');
  
  // Trouver les mouvements avec reference_id contenant un point décimal
  const movementsACorriger = db.prepare(`
    SELECT id, reference_id, reference_type, tenant_id
    FROM inventory_movements
    WHERE reference_id IS NOT NULL
      AND CAST(reference_id AS TEXT) LIKE '%.%'
      AND CAST(reference_id AS TEXT) != ''
    ORDER BY id
  `).all();
  
  console.log(`   Trouvé ${movementsACorriger.length} mouvements avec reference_id décimal`);
  
  for (const mouvement of movementsACorriger) {
    const oldValue = mouvement.reference_id;
    const parsed = Number(oldValue);
    
    if (!Number.isNaN(parsed)) {
      const newValue = Math.trunc(parsed);
      db.prepare(`
        UPDATE inventory_movements 
        SET reference_id = ? 
        WHERE id = ?
      `).run(newValue, mouvement.id);
      
      report.movementsRepares++;
      report.details.referenceIdCorriges.push({
        id: mouvement.id,
        oldReferenceId: oldValue,
        newReferenceId: newValue,
        referenceType: mouvement.reference_type,
        tenantId: mouvement.tenant_id
      });
      
      console.log(`   ✅ Corrigé mouvement ${mouvement.id}: reference_id "${oldValue}" -> ${newValue} (type: ${mouvement.reference_type})`);
    } else {
      console.log(`   ⚠️  Mouvement ${mouvement.id}: reference_id "${oldValue}" non convertible`);
    }
  }
  
  // ========================================================================
  // ÉTAPE 2: Analyser les mouvements échoués dans sync_outbox
  // ========================================================================
  console.log('\n2. Analyse des mouvements échoués dans sync_outbox...');
  
  const failedMovements = db.prepare(`
    SELECT o.id, o.entity, o.record_id, o.status, o.last_error, o.retry_count, o.payload
    FROM sync_outbox o
    WHERE o.entity = 'inventory_movement' 
      AND o.status IN ('failed', 'in_progress')
    ORDER BY o.created_at DESC
  `).all();
  
  console.log(`   Trouvé ${failedMovements.length} mouvements échoués ou en cours`);
  
  for (const m of failedMovements) {
    report.details.mouvementsEchoues.push({
      id: m.id,
      recordId: m.record_id,
      status: m.status,
      error: m.last_error,
      retryCount: m.retry_count
    });
    console.log(`   - Outbox ID: ${m.id}, Record: ${m.record_id}, Status: ${m.status}, Erreur: ${m.last_error || 'none'}, Retries: ${m.retry_count}`);
    
    // Vérifier si le payload contient un reference_id problématique
    try {
      const payload = JSON.parse(m.payload);
      if (payload.reference_id !== undefined && payload.reference_id !== null) {
        const refIdStr = String(payload.reference_id);
        if (refIdStr.includes('.')) {
          console.log(`     ⚠️  Payload contient reference_id décimal: "${refIdStr}"`);
        }
      }
    } catch (e) {
      console.log(`     ⚠️  Impossible de parser le payload`);
    }
  }
  
  // ========================================================================
  // ÉTAPE 3: Réinitialiser les mouvements échoués
  // ========================================================================
  console.log('\n3. Réinitialisation des mouvements échoués...');
  
  const resetResult = db.prepare(`
    UPDATE sync_outbox 
    SET status = 'pending', retry_count = 0, last_error = NULL
    WHERE entity = 'inventory_movement' 
      AND status IN ('failed', 'in_progress')
  `).run();
  
  report.movementsRequeue = resetResult.changes;
  console.log(`   Réinitialisé ${resetResult.changes} mouvements vers 'pending'`);
  
  // ========================================================================
  // ÉTAPE 4: Vérifier les mouvements locaux sans remote_id
  // ========================================================================
  console.log('\n4. Vérification des mouvements locaux non synchronisés...');
  
  const localMovements = db.prepare(`
    SELECT id, product_id, tenant_id, remote_id, reference_id, reference_type
    FROM inventory_movements
    WHERE remote_id IS NULL
    ORDER BY id
  `).all();
  
  console.log(`   Trouvé ${localMovements.length} mouvements locaux sans remote_id`);
  
  // ========================================================================
  // ÉTAPE 5: Vérifier les produits référencés ont des remote_id
  // ========================================================================
  console.log('\n5. Vérification des produits référencés...');
  
  const productsWithoutRemoteId = db.prepare(`
    SELECT DISTINCT im.product_id, im.id as movement_id
    FROM inventory_movements im
    WHERE im.remote_id IS NULL 
      AND im.product_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM products p WHERE p.id = im.product_id AND p.remote_id IS NOT NULL)
  `).all();
  
  if (productsWithoutRemoteId.length > 0) {
    console.log(`   ⚠️  Attention: ${productsWithoutRemoteId.length} produits sans remote_id`);
    for (const p of productsWithoutRemoteId) {
      report.details.produitsSansRemoteId.push(p.product_id);
      console.log(`   - Product ID: ${p.product_id} (mouvement: ${p.movement_id})`);
    }
  } else {
    console.log('   ✅ Tous les produits ont des remote_id');
  }
  
  // ========================================================================
  // ÉTAPE 6: Queue les mouvements manquants (sans remote_id et produit sync)
  // ========================================================================
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
        // Normaliser reference_id avant de queuer
        if (fullMovement.reference_id !== null && fullMovement.reference_id !== undefined) {
          const parsed = Number(fullMovement.reference_id);
          if (!Number.isNaN(parsed)) {
            fullMovement.reference_id = Math.trunc(parsed);
          }
        }
        
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
        report.movementsRequeue++;
        console.log(`   ✅ Queue mouvement ${fullMovement.id} (tenant: ${fullMovement.tenant_id}, ref: ${fullMovement.reference_id})`);
      } else {
        console.log(`   ⚠️  Mouvement ${fullMovement.id} non queue - produit ${fullMovement.product_id} sans remote_id`);
        report.mouvementsRestantEnErreur++;
      }
    }
  }
  
  // ========================================================================
  // ÉTAPE 7: Vérifier les mouvements déjà synchronisés dans Supabase
  // ========================================================================
  console.log('\n7. Vérification des mouvements synchronisés dans Supabase...');
  
  try {
    const { data: remoteMovements, error: remoteError } = await supabase
      .from('inventory_movements')
      .select('id, reference_id, reference_type, tenant_id')
      .limit(100);
    
    if (remoteError) {
      console.log(`   ⚠️  Impossible de récupérer les mouvements Supabase: ${remoteError.message}`);
    } else {
      console.log(`   Trouvé ${remoteMovements?.length || 0} mouvements dans Supabase`);
      
      // Vérifier si des mouvements Supabase ont des reference_id problématiques
      const problematicRemote = (remoteMovements || []).filter(m => 
        m.reference_id !== null && 
        String(m.reference_id).includes('.')
      );
      
      if (problematicRemote.length > 0) {
        console.log(`   ⚠️  ${problematicRemote.length} mouvements Supabase avec reference_id décimal`);
        for (const m of problematicRemote) {
          console.log(`   - Remote ID: ${m.id}, reference_id: ${m.reference_id}`);
        }
      }
    }
  } catch (error) {
    console.log(`   ⚠️  Erreur lors de la vérification Supabase: ${error.message}`);
  }
  
  // ========================================================================
  // ÉTAPE 8: Statistiques finales
  // ========================================================================
  console.log('\n' + '='.repeat(70));
  console.log('RAPPORT FINAL');
  console.log('='.repeat(70));
  
  report.movementsSynchronises = localMovements.length - report.mouvementsRestantEnErreur;
  
  console.log(`\n📊 Résumé:`);
  console.log(`   • Mouvements réparés (reference_id normalisé): ${report.movementsRepares}`);
  console.log(`   • Mouvements re-queued: ${report.movementsRequeue}`);
  console.log(`   • Mouvements synchronisés: ${report.movementsSynchronises}`);
  console.log(`   • Mouvements restant en erreur: ${report.mouvementsRestantEnErreur}`);
  
  if (report.details.referenceIdCorriges.length > 0) {
    console.log(`\n🔧 Références corrigées:`);
    report.details.referenceIdCorriges.forEach(item => {
      console.log(`   - Mouvement ${item.id}: "${item.oldReferenceId}" -> ${item.newReferenceId} (${item.referenceType})`);
    });
  }
  
  if (report.details.mouvementsEchoues.length > 0) {
    console.log(`\n❌ Mouvements échoués (avant réinitialisation):`);
    report.details.mouvementsEchoues.forEach(item => {
      console.log(`   - Outbox ${item.id}: Record ${item.recordId}, Erreur: ${item.error || 'inconnu'}`);
    });
  }
  
  if (report.details.produitsSansRemoteId.length > 0) {
    console.log(`\n⚠️  Produits sans remote_id (blocage potentiel):`);
    console.log(`   ${report.details.produitsSansRemoteId.join(', ')}`);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ Script terminé avec succès');
  console.log('='.repeat(70));
  console.log('\n📝 Actions recommandées:');
  console.log('   1. Redémarrer l\'application pour relancer la synchronisation');
  console.log('   2. Vérifier les logs pour confirmer la synchronisation des mouvements');
  console.log('   3. Si des produits n\'ont pas de remote_id, les synchroniser d\'abord');
  console.log('\n⚠️  IMPORTANT: Le schéma Supabase reference_id reste BIGINT (non modifié)');
  
} catch (error) {
  console.error('\n❌ Erreur:', error);
  process.exit(1);
} finally {
  db.close();
  
  // Sauvegarder le rapport dans un fichier
  try {
    const reportPath = path.join(__dirname, `../fix_inventory_movements_report_${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Rapport sauvegardé dans: ${reportPath}`);
  } catch (e) {
    console.log('\n⚠️  Impossible de sauvegarder le rapport');
  }
  
  process.exit(0);
}
