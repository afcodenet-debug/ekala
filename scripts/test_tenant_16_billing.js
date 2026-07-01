// Script de test pour le tenant 16 - Vérification du billing
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'backend', 'database.sqlite');
const db = new Database(dbPath);

console.log('=== TEST TENANT 16 - BILLING STATUS ===\n');

// 1. Vérifier le tenant
console.log('1. INFORMATIONS DU TENANT 16:');
const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(16);
if (tenant) {
  console.log('   - Nom:', tenant.name);
  console.log('   - Statut:', tenant.status);
  console.log('   - is_provisioned:', tenant.is_provisioned);
  console.log('   - created_at:', tenant.created_at);
  console.log('   - updated_at:', tenant.updated_at);
} else {
  console.log('   ❌ Tenant 16 introuvable!');
}

// 2. Vérifier l'abonnement
console.log('\n2. ABONNEMENT DU TENANT 16:');
const subscription = db.prepare(`
  SELECT s.*, p.code as plan_code, p.name as plan_name, p.price_cents, p.currency, p.period, p.duration_days
  FROM subscriptions s
  LEFT JOIN plans p ON s.plan_id = p.id
  WHERE s.tenant_id = ?
  ORDER BY s.created_at DESC
  LIMIT 1
`).get(16);

if (subscription) {
  console.log('   ✅ Abonnement trouvé:');
  console.log('   - Plan:', subscription.plan_name || subscription.plan_code);
  console.log('   - Statut:', subscription.status);
  console.log('   - Prix:', subscription.price_cents / 100, subscription.currency);
  console.log('   - Période:', subscription.period);
  console.log('   - Date de début:', subscription.current_period_start || subscription.started_at);
  console.log('   - Date de fin:', subscription.current_period_end);
  console.log('   - Durée (jours):', subscription.duration_days);
  
  // Calculer les jours restants
  if (subscription.current_period_end) {
    const now = new Date();
    const endDate = new Date(subscription.current_period_end);
    const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    console.log('   - Jours restants:', daysLeft);
    
    if (daysLeft > 0) {
      console.log('   ✅ Abonnement ACTIF - encore', daysLeft, 'jours');
    } else {
      console.log('   ❌ Abonnement EXPIRÉ depuis', Math.abs(daysLeft), 'jours');
    }
  }
} else {
  console.log('   ❌ Aucun abonnement trouvé pour le tenant 16');
}

// 3. Vérifier les vouchers
console.log('\n3. VOUCHERS DU TENANT 16:');
const vouchers = db.prepare(`
  SELECT vr.*, p.code as plan_code, p.name as plan_name
  FROM voucher_requests vr
  LEFT JOIN plans p ON vr.plan_id = p.id
  WHERE vr.tenant_id = ?
  ORDER BY vr.created_at DESC
  LIMIT 10
`).all(16);

if (vouchers.length > 0) {
  console.log(`   ✅ ${vouchers.length} voucher(s) trouvé(s):`);
  vouchers.forEach((v, i) => {
    console.log(`   \n   Voucher ${i + 1}:`);
    console.log('   - Code:', v.voucher_code);
    console.log('   - Statut:', v.status);
    console.log('   - Plan:', v.plan_name || v.plan_code);
    console.log('   - Demandé le:', v.requested_at);
    console.log('   - Expire le:', v.expires_at);
    console.log('   - Vérifié le:', v.verified_at || 'N/A');
    
    // Vérifier si le voucher est encore valide
    if (v.expires_at) {
      const now = new Date();
      const expiresAt = new Date(v.expires_at);
      if (expiresAt > now) {
        console.log('   - ✅ Voucher encore valide');
      } else {
        console.log('   - ❌ Voucher expiré');
      }
    }
  });
} else {
  console.log('   ❌ Aucun voucher trouvé pour le tenant 16');
}

// 4. Vérifier les demandes de paiement (legacy)
console.log('\n4. DEMANDES DE PAIEMENT (LEGACY) DU TENANT 16:');
const paymentRequests = db.prepare(`
  SELECT spr.*, p.code as plan_code, p.name as plan_name
  FROM subscription_payment_requests spr
  LEFT JOIN plans p ON spr.plan_id = p.id
  WHERE spr.tenant_id = ?
  ORDER BY spr.created_at DESC
  LIMIT 10
`).all(16);

if (paymentRequests.length > 0) {
  console.log(`   ✅ ${paymentRequests.length} demande(s) de paiement trouvée(s):`);
  paymentRequests.forEach((pr, i) => {
    console.log(`   \n   Demande ${i + 1}:`);
    console.log('   - Code:', pr.voucher_code);
    console.log('   - Statut:', pr.status);
    console.log('   - Plan:', pr.plan_name || pr.plan_code);
    console.log('   - Montant:', pr.amount_cents / 100, pr.currency);
    console.log('   - Demandé le:', pr.requested_at);
    console.log('   - Expire le:', pr.expires_at);
  });
} else {
  console.log('   ℹ️  Aucune demande de paiement legacy trouvée');
}

// 5. Résumé et diagnostic
console.log('\n=== DIAGNOSTIC ===');
if (!subscription) {
  console.log('❌ PROBLÈME: Aucun abonnement actif');
  console.log('   → Le tenant 16 doit activer un voucher pour créer un abonnement');
} else if (subscription.status === 'active') {
  console.log('✅ Abonnement ACTIF');
  if (subscription.current_period_end) {
    const daysLeft = Math.ceil((new Date(subscription.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft > 0) {
      console.log('   → Accès autorisé pour encore', daysLeft, 'jours');
    } else {
      console.log('   ❌ PROBLÈME: Abonnement expiré mais statut toujours "active"');
    }
  }
} else if (subscription.status === 'trial') {
  console.log('⚠️  En période d\'essai');
  if (subscription.trial_ends_at) {
    const daysLeft = Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft > 0) {
      console.log('   → Période d\'essai encore valide pour', daysLeft, 'jours');
    } else {
      console.log('   ❌ PROBLÈME: Période d\'essai expirée');
    }
  }
} else {
  console.log('❌ Statut d\'abonnement:', subscription.status);
}

// 6. Vérifier les plans disponibles
console.log('\n6. PLANS DISPONIBLES:');
const plans = db.prepare('SELECT * FROM plans WHERE is_active = 1 AND is_public = 1 ORDER BY sort_order').all();
if (plans.length > 0) {
  console.log(`   ✅ ${plans.length} plan(s) disponible(s):`);
  plans.forEach(p => {
    console.log(`   - ${p.name}: ${p.price_cents / 100} ${p.currency} / ${p.period}`);
  });
} else {
  console.log('   ❌ Aucun plan disponible');
}

db.close();

console.log('\n=== FIN DU TEST ===');
console.log('\nPour tester l\'API, utilisez:');
console.log('curl -H "Authorization: Bearer VOTRE_TOKEN" http://localhost:3000/api/billing/status');