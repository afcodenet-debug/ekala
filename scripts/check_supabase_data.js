// Script pour vérifier les données dans Supabase
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.log('❌ Supabase non configuré dans les variables d\'environnement');
  console.log('   SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.log('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  db: { schema: 'public' },
});

console.log('=== VÉRIFICATION SUPABASE - TENANT 16 ===\n');

async function checkSupabase() {
  try {
    // 1. Vérifier le tenant
    console.log('1. TENANT DANS SUPABASE:');
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', 16)
      .maybeSingle();

    if (tenantError) {
      console.log('   ❌ Erreur:', tenantError.message);
    } else if (tenant) {
      console.log('   ✅ Tenant trouvé:');
      console.log('   - ID:', tenant.id);
      console.log('   - Nom:', tenant.name);
      console.log('   - Slug:', tenant.slug);
      console.log('   - Status:', tenant.status);
    } else {
      console.log('   ❌ Tenant 16 non trouvé dans Supabase');
    }

    // 2. Vérifier l'utilisateur
    console.log('\n2. UTILISATEUR DANS SUPABASE:');
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('tenant_id', 16)
      .eq('role', 'owner');

    if (userError) {
      console.log('   ❌ Erreur:', userError.message);
    } else if (users && users.length > 0) {
      const user = users[0];
      console.log('   ✅ Utilisateur trouvé:');
      console.log('   - ID:', user.id);
      console.log('   - Nom:', user.full_name);
      console.log('   - Email:', user.email);
      console.log('   - Role:', user.role);
      console.log('   - Tenant ID:', user.tenant_id);
    } else {
      console.log('   ❌ Aucun utilisateur trouvé pour tenant 16');
    }

    // 3. Vérifier l'abonnement
    console.log('\n3. ABONNEMENT DANS SUPABASE:');
    const { data: subs, error: subError } = await supabase
      .from('subscriptions')
      .select('*, plans!inner(name, code)')
      .eq('tenant_id', 16)
      .in('status', ['active', 'trial', 'past_due'])
      .order('created_at', { ascending: false });

    if (subError) {
      console.log('   ❌ Erreur:', subError.message);
    } else if (subs && subs.length > 0) {
      const sub = subs[0];
      const plan = sub.plans;
      console.log('   ✅ Abonnement trouvé:');
      console.log('   - ID:', sub.id);
      console.log('   - Status:', sub.status);
      console.log('   - Plan:', plan?.name || plan?.code);
      console.log('   - Expire:', sub.current_period_end);
    } else {
      console.log('   ❌ Aucun abonnement actif trouvé pour tenant 16');
    }

    // 4. Tester la fonction getTenantSubscription
    console.log('\n4. TEST DE getTenantSubscription():');
    const { data: subTest, error: subTestError } = await supabase
      .from('subscriptions')
      .select('status, plan_id, current_period_end, plans!inner(name, code)')
      .eq('tenant_id', 16)
      .in('status', ['active', 'trial', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subTestError) {
      console.log('   ❌ Erreur:', subTestError.message);
    } else if (subTest) {
      const plans = subTest.plans;
      const plan = Array.isArray(plans) ? plans[0] : plans;
      console.log('   ✅ Résultat:');
      console.log('   - Status:', subTest.status);
      console.log('   - Plan name:', plan?.name || plan?.code);
      console.log('   - Expires:', subTest.current_period_end);
    } else {
      console.log('   ❌ Aucun résultat');
    }

  } catch (error) {
    console.error('❌ Erreur générale:', error.message);
  } finally {
    await supabase.postgrest.close();
  }
}

checkSupabase();