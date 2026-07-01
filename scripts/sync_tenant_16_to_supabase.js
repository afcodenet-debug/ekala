// Script pour synchroniser les données du tenant 16 de SQLite vers Supabase
const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'backend', 'database.sqlite');
const db = new Database(dbPath);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.log('❌ Supabase non configuré');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  db: { schema: 'public' },
});

console.log('=== SYNCHRONISATION TENANT 16 VERS SUPABASE ===\n');

async function syncTenant16() {
  try {
    // 1. Récupérer les données depuis SQLite
    console.log('1. RÉCUPÉRATION DES DONNÉES DEPUIS SQLITE:');
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = 16').get();
    const user = db.prepare(`
      SELECT u.*, t.name as tenant_name, t.slug as tenant_slug
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE u.tenant_id = 16 AND u.role = 'owner'
      LIMIT 1
    `).get();
    const subscription = db.prepare(`
      SELECT s.*, p.name as plan_name, p.code as plan_code, p.price_cents, p.currency, p.period
      FROM subscriptions s
      LEFT JOIN plans p ON s.plan_id = p.id
      WHERE s.tenant_id = 16 AND s.status IN ('active', 'trial', 'past_due')
      ORDER BY s.id DESC
      LIMIT 1
    `).get();

    console.log('   - Tenant:', tenant?.name);
    console.log('   - User:', user?.full_name);
    console.log('   - Subscription:', subscription?.status, subscription?.plan_name);

    // 2. Mettre à jour le tenant dans Supabase
    console.log('\n2. MISE À JOUR DU TENANT DANS SUPABASE:');
    const { error: tenantError } = await supabase
      .from('tenants')
      .update({
        name: tenant.name,
        slug: tenant.slug,
        status: 'active', // Forcer le status à active
        updated_at: new Date().toISOString()
      })
      .eq('id', 16);

    if (tenantError) {
      console.log('   ❌ Erreur:', tenantError.message);
    } else {
      console.log('   ✅ Tenant mis à jour avec succès');
    }

    // 3. Mettre à jour l'utilisateur dans Supabase
    console.log('\n3. MISE À JOUR DE L\'UTILISATEUR DANS SUPABASE:');
    const { error: userError } = await supabase
      .from('users')
      .update({
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        username: user.username,
        role: user.role,
        is_active: user.is_active,
        tenant_id: user.tenant_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (userError) {
      console.log('   ❌ Erreur:', userError.message);
    } else {
      console.log('   ✅ Utilisateur mis à jour avec succès');
    }

    // 4. Créer/Mettre à jour l'abonnement dans Supabase
    if (subscription) {
      console.log('\n4. CRÉATION/MAJ DE L\'ABONNEMENT DANS SUPABASE:');
      
      // D'abord, vérifier si un abonnement existe déjà
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('tenant_id', 16)
        .maybeSingle();

      const subData = {
        tenant_id: 16,
        plan_id: subscription.plan_id,
        status: subscription.status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        started_at: subscription.started_at,
        auto_renew: subscription.auto_renew,
        updated_at: new Date().toISOString()
      };

      let subResult;
      if (existingSub) {
        // Mettre à jour l'abonnement existant
        subResult = await supabase
          .from('subscriptions')
          .update(subData)
          .eq('id', existingSub.id);
      } else {
        // Créer un nouvel abonnement
        subResult = await supabase
          .from('subscriptions')
          .insert([{
            ...subData,
            created_at: new Date().toISOString()
          }]);
      }

      if (subResult.error) {
        console.log('   ❌ Erreur:', subResult.error.message);
      } else {
        console.log('   ✅ Abonnement synchronisé avec succès');
        console.log('   - Plan:', subscription.plan_name);
        console.log('   - Status:', subscription.status);
        console.log('   - Expire:', subscription.current_period_end);
      }

      if (subResult.error) {
        console.log('   ❌ Erreur:', subResult.error.message);
      } else {
        console.log('   ✅ Abonnement synchronisé avec succès');
        console.log('   - Plan:', subscription.plan_name);
        console.log('   - Status:', subscription.status);
        console.log('   - Expire:', subscription.current_period_end);
      }
    } else {
      console.log('\n4. ⚠️  AUCUN ABONNEMENT TROUVÉ DANS SQLITE');
    }

    // 5. Vérification finale
    console.log('\n5. VÉRIFICATION FINALE DANS SUPABASE:');
    const { data: finalTenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', 16)
      .maybeSingle();

    const { data: finalSub } = await supabase
      .from('subscriptions')
      .select('*, plans!inner(name, code)')
      .eq('tenant_id', 16)
      .in('status', ['active', 'trial', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log('   - Tenant status:', finalTenant?.status);
    if (finalSub) {
      const plan = finalSub.plans;
      console.log('   - Abonnement:', finalSub.status, '-', plan?.name || plan?.code);
      console.log('   - Expire:', finalSub.current_period_end);
    } else {
      console.log('   - Abonnement: ❌ Aucun');
    }

    console.log('\n✅ SYNCHRONISATION TERMINÉE');
    console.log('\nPROCHAINES ÉTAPES:');
    console.log('1. Vider le localStorage: localStorage.removeItem("ekala-auth")');
    console.log('2. Recharger la page');
    console.log('3. Se reconnecter');
    console.log('4. Les données devraient maintenant s\'afficher correctement');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    db.close();
  }
}

syncTenant16();