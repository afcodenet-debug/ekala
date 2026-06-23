#!/usr/bin/env node

/**
 * Diagnostic concret du Tenant #16
 * Vérifie les données réelles et détermine le statut d'abonnement
 */

const Database = require('better-sqlite3');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Chemin vers la base de données
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'ekala.db');

console.log('═══════════════════════════════════════════════════════════════');
console.log('  DIAGNOSTIC TENANT #16 — Page /billing');
console.log('═══════════════════════════════════════════════════════════════\n');

let db;
let supabase;
let useSupabase = false;

// Essayer d'ouvrir la base de données locale
try {
  db = new Database(DB_PATH);
  console.log(`✅ Base de données locale: ${DB_PATH}\n`);
} catch (err) {
  console.log(`⚠️  Base de données locale inaccessible: ${err.message}`);
  console.log('   Basculement vers Supabase...\n');
  useSupabase = true;
}

// Initialiser Supabase si nécessaire
if (useSupabase || process.env.USE_SUPABASE === 'true') {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variables d\'environnement Supabase manquantes:');
    console.error('   - SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    console.error('\nDéfinissez ces variables ou utilisez une base de données locale.');
    process.exit(1);
  }
  
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✅ Connexion Supabase établie\n');
}

// ─── Fonction principale async ───────────────────────────────────────────────

async function main() {
  
// ─── 1. Vérifier le tenant ───────────────────────────────────────────────────

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1. INFORMATIONS DU TENANT #16');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let tenant;

  if (useSupabase) {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', 16)
      .single();
    
    if (error || !data) {
      console.log('❌ Tenant #16 INTROUVABLE dans Supabase\n');
      tenant = null;
    } else {
      tenant = data;
    }
  } else {
    // Vérifier que la table existe
    try {
      const tableExists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='tenants'
      `).get();
      
      if (!tableExists) {
        console.log('⚠️  Table "tenants" n\'existe pas dans la base locale');
        console.log('   Basculement vers Supabase...\n');
        useSupabase = true;
      } else {
        tenant = db.prepare(`
          SELECT id, name, status, created_at, updated_at
          FROM tenants
          WHERE id = 16
        `).get();
      }
    } catch (err) {
      console.log('⚠️  Erreur lors de la vérification de la table:', err.message);
      console.log('   Basculement vers Supabase...\n');
      useSupabase = true;
    }
  }

  if (!tenant) {
    console.log('❌ Tenant #16 INTROUVABLE\n');
    console.log('Note: Vérifiez que la base de données contient les données du tenant #16.\n');
  } else {
    console.log('✅ Tenant trouvé:');
    console.log(`   ID: ${tenant.id}`);
    console.log(`   Nom: ${tenant.name}`);
    console.log(`   Statut: ${tenant.status}`);
    console.log(`   Créé le: ${tenant.created_at}`);
    console.log(`   Modifié le: ${tenant.updated_at}\n`);
  }

// ─── 2. Vérifier les abonnements ─────────────────────────────────────────────

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('2. ABONNEMENTS DU TENANT #16');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let subscriptions;

  if (useSupabase) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('tenant_id', 16)
      .order('current_period_start', { ascending: false });
    
    if (error) {
      console.error('❌ Erreur lors de la récupération des abonnements:', error.message);
      subscriptions = [];
    } else {
      subscriptions = data || [];
    }
  } else {
    subscriptions = db.prepare(`
      SELECT 
        id, 
        tenant_id, 
        plan_id, 
        status, 
        current_period_start,
        current_period_end,
        created_at
      FROM subscriptions
      WHERE tenant_id = 16
      ORDER BY current_period_start DESC
    `).all();
  }

if (subscriptions.length === 0) {
  console.log('❌ Aucun abonnement trouvé pour le tenant #16\n');
  console.log('→ RÉSULTAT: SUSPENDED (pas d\'abonnement)\n');
} else {
  console.log(`✅ ${subscriptions.length} abonnement(s) trouvé(s):\n`);
  
  subscriptions.forEach((sub, index) => {
    console.log(`   Abonnement #${index + 1}:`);
    console.log(`   - ID: ${sub.id}`);
    console.log(`   - Statut: ${sub.status}`);
    console.log(`   - Plan ID: ${sub.plan_id}`);
    console.log(`   - Période: ${sub.current_period_start} → ${sub.current_period_end}`);
    console.log(`   - Créé le: ${sub.created_at}\n`);
    
    // Calculer la période de grâce
    if (sub.current_period_end) {
      const periodEnd = new Date(sub.current_period_end);
      const graceEnd = new Date(periodEnd.getTime() + 7 * 24 * 60 * 60 * 1000);
      const now = new Date();
      
      console.log(`   📅 Période de grâce:`);
      console.log(`      - Fin de période: ${periodEnd.toISOString()}`);
      console.log(`      - Fin de grâce: ${graceEnd.toISOString()}`);
      console.log(`      - Maintenant: ${now.toISOString()}`);
      console.log(`      - Jours restants: ${Math.ceil((graceEnd - now) / 86400000)}`);
      
      if (sub.status === 'past_due') {
        if (now < graceEnd) {
          console.log(`      - ✅ DANS LA PÉRIODE DE GRÂCE (GRACE_PERIOD)\n`);
        } else {
          console.log(`      - ❌ HORS PÉRIODE DE GRÂCE (SUSPENDED)\n`);
        }
      } else if (sub.status === 'active') {
        console.log(`      - ✅ ABONNEMENT ACTIF\n`);
      } else if (sub.status === 'trialing' || sub.status === 'trial') {
        console.log(`      - ✅ PÉRIODE D'ESSAI\n`);
      } else {
        console.log(`      - ❌ STATUT: ${sub.status} → SUSPENDED\n`);
      }
    }
  });
}

// ─── 3. Vérifier les paiements ───────────────────────────────────────────────

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('3. PAIEMENTS DU TENANT #16');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let payments;

  if (useSupabase) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('tenant_id', 16)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('❌ Erreur lors de la récupération des paiements:', error.message);
      payments = [];
    } else {
      payments = data || [];
    }
  } else {
    payments = db.prepare(`
      SELECT 
        id,
        tenant_id,
        amount_cents,
        status,
        payment_method,
        created_at
      FROM payments
      WHERE tenant_id = 16
      ORDER BY created_at DESC
      LIMIT 10
    `).all();
  }

if (payments.length === 0) {
  console.log('❌ Aucun paiement trouvé\n');
} else {
  console.log(`✅ ${payments.length} paiement(s) trouvé(s):\n`);
  payments.forEach((pay, index) => {
    console.log(`   Paiement #${index + 1}:`);
    console.log(`   - ID: ${pay.id}`);
    console.log(`   - Montant: ${(pay.amount_cents / 100).toFixed(2)} €`);
    console.log(`   - Statut: ${pay.status}`);
    console.log(`   - Méthode: ${pay.payment_method || 'N/A'}`);
    console.log(`   - Date: ${pay.created_at}\n`);
  });
}

// ─── 4. Vérifier les demandes de voucher ─────────────────────────────────────

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('4. DEMANDES DE VOUCHER DU TENANT #16');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let vouchers;

  if (useSupabase) {
    const { data, error } = await supabase
      .from('subscription_payment_requests')
      .select('*')
      .eq('tenant_id', 16)
      .order('requested_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error('❌ Erreur lors de la récupération des vouchers:', error.message);
      vouchers = [];
    } else {
      vouchers = data || [];
    }
  } else {
    vouchers = db.prepare(`
      SELECT 
        id,
        tenant_id,
        voucher_code,
        status,
        requested_at,
        expires_at
      FROM subscription_payment_requests
      WHERE tenant_id = 16
      ORDER BY requested_at DESC
      LIMIT 5
    `).all();
  }

if (vouchers.length === 0) {
  console.log('❌ Aucune demande de voucher trouvée\n');
} else {
  console.log(`✅ ${vouchers.length} demande(s) de voucher trouvée(s):\n`);
  vouchers.forEach((v, index) => {
    console.log(`   Voucher #${index + 1}:`);
    console.log(`   - ID: ${v.id}`);
    console.log(`   - Code: ${v.voucher_code}`);
    console.log(`   - Statut: ${v.status}`);
    console.log(`   - Demandé le: ${v.requested_at}`);
    console.log(`   - Expire le: ${v.expires_at}\n`);
  });
}

// ─── 5. Diagnostic final ─────────────────────────────────────────────────────

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('5. DIAGNOSTIC FINAL');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let effectiveStatus = 'SUSPENDED';
  let reason = '';

  if (subscriptions.length === 0) {
    reason = 'Aucun abonnement trouvé';
  } else {
    const latestSub = subscriptions[0];
    
    if (latestSub.status === 'active') {
      effectiveStatus = 'ACTIVE';
      reason = 'Abonnement actif';
    } else if (latestSub.status === 'trialing' || latestSub.status === 'trial') {
      effectiveStatus = 'TRIAL';
      reason = 'Période d\'essai en cours';
    } else if (latestSub.status === 'past_due') {
      if (latestSub.current_period_end) {
        const periodEnd = new Date(latestSub.current_period_end);
        const graceEnd = new Date(periodEnd.getTime() + 7 * 24 * 60 * 60 * 1000);
        const now = new Date();
        
        if (now < graceEnd) {
          effectiveStatus = 'GRACE_PERIOD';
          reason = `Abonnement expiré mais dans la période de grâce (${Math.ceil((graceEnd - now) / 86400000)} jours restants)`;
        } else {
          effectiveStatus = 'SUSPENDED';
          reason = 'Abonnement expiré, période de grâce terminée';
        }
      } else {
        effectiveStatus = 'SUSPENDED';
        reason = 'Abonnement past_due sans date de fin de période';
      }
    } else if (latestSub.status === 'suspended' || latestSub.status === 'cancelled') {
      effectiveStatus = 'SUSPENDED';
      reason = `Abonnement ${latestSub.status}`;
    } else {
      effectiveStatus = 'SUSPENDED';
      reason = `Statut d'abonnement inconnu: ${latestSub.status}`;
    }
  }

  console.log(`Statut effectif: ${effectiveStatus}`);
  console.log(`Raison: ${reason}\n`);

  if (effectiveStatus === 'SUSPENDED') {
    console.log('❌ Le message "Compte suspendu" est CORRECT\n');
    console.log('Actions requises:');
    console.log('  1. Aller sur /billing');
    console.log('  2. Choisir un forfait');
    console.log('  3. Générer un voucher de paiement');
    console.log('  4. Effectuer le paiement');
    console.log('  5. Attendre la validation admin\n');
  } else if (effectiveStatus === 'GRACE_PERIOD') {
    console.log('⚠️  Le compte est en période de grâce');
    console.log('   → Devrait afficher "Période de grâce" (accès lecture seule)\n');
    console.log('Si "Compte suspendu" s\'affiche, vérifier:');
    console.log('  1. La synchronisation des données (Supabase ↔ SQLite)');
    console.log('  2. Le cron d\'expiration');
    console.log('  3. Le middleware subscription-guard.ts\n');
  } else if (effectiveStatus === 'ACTIVE') {
    console.log('✅ Le compte est actif');
    console.log('   → Devrait afficher "Forfait actif"\n');
    console.log('Si "Compte suspendu" s\'affiche, vérifier:');
    console.log('  1. La synchronisation des données');
    console.log('  2. Le middleware subscription-guard.ts\n');
  } else if (effectiveStatus === 'TRIAL') {
    console.log('✅ Le compte est en période d\'essai');
    console.log('   → Devrait afficher "Période d\'essai"\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Fermer les connexions
  if (db) db.close();
  if (supabase) supabase.auth.admin.signOut();
}

// ─── Point d'entrée ──────────────────────────────────────────────────────────

main().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
