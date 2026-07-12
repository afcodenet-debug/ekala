/**
 * Script de récupération des commandes locales non synchronisées vers Supabase
 * 
 * Usage:
 *   node scripts/fix_missing_orders_sync.js [tenant_id]
 * 
 * Description:
 *   Ce script récupère toutes les commandes locales (source='local', remote_id IS NULL)
 *   et les pousse vers Supabase pour corriger les problèmes de synchronisation.
 *   
 *   Utile quand:
 *   - Des commandes créées en mode local n'apparaissent pas dans Supabase
 *   - Le pull sync ne peut pas récupérer les commandes car elles n'existent pas dans Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const db = require('../src/server/db/database').default;

// Configuration Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Erreur: SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env');
  console.log('   Ajoutez ces variables dans votre fichier .env:');
  console.log('   SUPABASE_URL=https://votre-projet.supabase.co');
  console.log('   SUPABASE_SERVICE_ROLE_KEY=votre-clé-service-role');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

async function fixMissingOrders(tenantId) {
  console.log('🔍 Recherche des commandes locales non synchronisées...\n');

  try {
    // Récupérer les commandes locales sans remote_id
    let query = `
      SELECT o.*, t.table_number
      FROM orders o
      LEFT JOIN restaurant_tables t ON o.table_id = t.id
      WHERE o.remote_id IS NULL
        AND o.source = 'local'
    `;
    
    const params = [];
    if (tenantId) {
      query += ' AND o.tenant_id = ?';
      params.push(tenantId);
    }

    const localOrders = db.prepare(query).all.apply(db.prepare, params);
    console.log(`📊 Trouvé ${localOrders.length} commande(s) locale(s) à synchroniser\n`);

    if (localOrders.length === 0) {
      console.log('✅ Aucune commande à synchroniser. Tout est à jour!');
      return;
    }

    // Afficher les commandes trouvées
    console.log('📋 Commandes à synchroniser:');
    localOrders.forEach((order: any) => {
      console.log(`   - Order #${order.id} | Table ${order.table_number || 'N/A'} | ${order.status} | ${order.total}€ | ${order.created_at}`);
    });
    console.log('');

    // Demander confirmation
    if (process.env.YES !== 'true') {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise((resolve) => {
        rl.question('⚠️  Voulez-vous synchroniser ces commandes vers Supabase? (oui/non): ', resolve);
      });
      rl.close();

      if (answer.toLowerCase() !== 'oui') {
        console.log('❌ Synchronisation annulée.');
        return;
      }
      console.log('');
    }

    // Synchroniser chaque commande
    let successCount = 0;
    let errorCount = 0;

    for (const order of localOrders) {
      try {
        console.log(`🔄 Synchronisation commande #${order.id}...`);

        // Parser les items
        let items = [];
        try {
          items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
        } catch (e) {
          console.warn(`   ⚠️  Items invalides pour commande #${order.id}, utilisation d'un tableau vide`);
          items = [];
        }

        // Préparer les données pour Supabase
        const supabaseOrder = {
          table_id: order.table_id,
          waiter_id: order.waiter_id,
          customer_id: order.customer_id,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          status: order.status,
          total: order.total,
          items: items,
          source: order.source || 'LP',
          tenant_id: order.tenant_id,
          created_at: order.created_at,
          updated_at: order.updated_at || new Date().toISOString(),
          version: 1
        };

        // Insérer dans Supabase
        const { data, error } = await supabase
          .from('orders')
          .insert(supabaseOrder)
          .select('id')
          .single();

        if (error) {
          console.error(`   ❌ Erreur insertion commande #${order.id}:`, error.message);
          errorCount++;
          continue;
        }

        const remoteId = data.id;
        console.log(`   ✅ Insérée dans Supabase avec ID ${remoteId}`);

        // Mettre à jour la commande locale avec le remote_id
        db.prepare('UPDATE orders SET remote_id = ?, updated_at = ? WHERE id = ?')
          .run(remoteId, new Date().toISOString(), order.id);

        // Insérer les order_items dans Supabase
        if (items.length > 0) {
          const orderItems = items.map((item) => ({
            order_id: remoteId,
            product_id: item.product_id || item.productId,
            quantity: item.quantity,
            unit_price: item.price || item.unit_price,
            total_price: (item.price || item.unit_price || 0) * (item.quantity || 0),
            notes: item.notes || null,
            tenant_id: order.tenant_id,
            created_at: order.created_at
          }));

          const { error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItems);

          if (itemsError) {
            console.warn(`   ⚠️  Erreur insertion items pour commande #${order.id}:`, itemsError.message);
          } else {
            console.log(`   ✅ ${items.length} item(s) inséré(s)`);
          }
        }

        successCount++;
        console.log(`   ✅ Commande #${order.id} synchronisée avec succès\n`);

      } catch (err) {
        console.error(`   ❌ Erreur synchronisation commande #${order.id}:`, err.message);
        errorCount++;
      }
    }

    // Résumé
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 RÉSUMÉ DE LA SYNCHRONISATION');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`   Total commandes: ${localOrders.length}`);
    console.log(`   ✅ Succès: ${successCount}`);
    console.log(`   ❌ Erreurs: ${errorCount}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (successCount > 0) {
      console.log('🎉 Les commandes sont maintenant disponibles dans Supabase!');
      console.log('   Le pull sync va les récupérer automatiquement dans quelques secondes.');
      console.log('   Vous pouvez rafraîchir http://localhost:5173/orders et http://localhost:5173/sales\n');
    }

  } catch (err: any) {
    console.error('❌ Erreur fatale:', err.message);
    process.exit(1);
  }
}

// Exécution
const tenantId = process.argv[2] ? parseInt(process.argv[2]) : undefined;
fixMissingOrders(tenantId).catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});