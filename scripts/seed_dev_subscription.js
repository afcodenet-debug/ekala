/**
 * Seed Script - Subscription DEV pour Tenant 16
 * 
 * Crée une subscription ACTIVE pour le tenant 16 en mode développement.
 * Cela permet de tester l'application sans erreur SUBSCRIPTION_REQUIRED.
 * 
 * Usage: node scripts/seed_dev_subscription.js
 */

const { Pool } = require('pg');

// Configuration PostgreSQL
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'ekala_db',
  port: 5432,
});

async function seedDevSubscription() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Seeding dev subscription for tenant 16...');
    console.log('');
    
    // Vérifier si le tenant 16 existe
    const tenantCheck = await client.query('SELECT id FROM tenants WHERE id = 16');
    if (tenantCheck.rows.length === 0) {
      console.log('⚠️  Tenant 16 not found. Creating tenant...');
      
      // Créer le tenant 16 si n'existe pas
      await client.query(`
        INSERT INTO tenants (id, name, slug, is_active, created_at, updated_at)
        VALUES (
          16,
          'Tenant DEV',
          'tenant-dev',
          true,
          NOW(),
          NOW()
        )
        ON CONFLICT (id) DO NOTHING;
      `);
      
      console.log('✅ Tenant 16 created');
    } else {
      console.log('✅ Tenant 16 exists');
    }
    
    // Vérifier si le plan 'basic' existe
    const planCheck = await client.query('SELECT id FROM plans WHERE id = \'basic\'');
    if (planCheck.rows.length === 0) {
      console.log('⚠️  Plan "basic" not found. Creating plan...');
      
      await client.query(`
        INSERT INTO plans (id, name, description, price_monthly, price_yearly, duration_days, features, max_users, max_products, max_orders_per_month)
        VALUES (
          'basic',
          'Basic',
          'Plan Basic - Fonctionnalités essentielles',
          29,
          290,
          30,
          '["1 utilisateur", "100 produits", "Support email"]'::jsonb,
          1,
          100,
          500
        )
        ON CONFLICT (id) DO NOTHING;
      `);
      
      console.log('✅ Plan "basic" created');
    } else {
      console.log('✅ Plan "basic" exists');
    }
    
    // Supprimer l'ancienne subscription du tenant 16 (si existe)
    const deleteResult = await client.query('DELETE FROM subscriptions WHERE tenant_id = 16');
    if (deleteResult.rowCount > 0) {
      console.log(`🗑️  Deleted ${deleteResult.rowCount} old subscription(s) for tenant 16`);
    }
    
    // Créer une subscription ACTIVE pour le tenant 16
    console.log('📦 Creating ACTIVE subscription for tenant 16...');
    
    const subscriptionResult = await client.query(`
      INSERT INTO subscriptions (
        tenant_id,
        plan_id,
        status,
        starts_at,
        expires_at,
        grace_period_ends_at,
        activation_source,
        activation_reference,
        activated_at,
        created_at,
        updated_at
      )
      VALUES (
        16,
        'basic',
        'ACTIVE',
        NOW() - INTERVAL '1 day',
        NOW() + INTERVAL '30 days',
        NULL,
        'dev_seed',
        'DEV-SEED-001',
        NOW() - INTERVAL '1 day',
        NOW(),
        NOW()
      )
      RETURNING *
    `);
    
    const subscription = subscriptionResult.rows[0];
    
    console.log('');
    console.log('✅ Subscription created successfully!');
    console.log('');
    console.log('📋 Subscription Details:');
    console.log(`   - ID: ${subscription.id}`);
    console.log(`   - Tenant ID: ${subscription.tenant_id}`);
    console.log(`   - Plan: ${subscription.plan_id}`);
    console.log(`   - Status: ${subscription.status}`);
    console.log(`   - Starts At: ${subscription.starts_at}`);
    console.log(`   - Expires At: ${subscription.expires_at}`);
    console.log(`   - Activated At: ${subscription.activated_at}`);
    console.log('');
    
    // Vérifier la subscription
    const verifyResult = await client.query(`
      SELECT 
        s.*,
        p.name as plan_name,
        p.price_monthly
      FROM subscriptions s
      JOIN plans p ON s.plan_id = p.id
      WHERE s.tenant_id = 16
    `);
    
    if (verifyResult.rows.length > 0) {
      const sub = verifyResult.rows[0];
      console.log('✅ Verification successful!');
      console.log('');
      console.log('📊 Subscription Status:');
      console.log(`   - Plan: ${sub.plan_name}`);
      console.log(`   - Price: ${sub.price_monthly}€/month`);
      console.log(`   - Status: ${sub.status}`);
      console.log(`   - Active: ${sub.status === 'ACTIVE' ? 'YES ✅' : 'NO ❌'}`);
      console.log('');
    } else {
      console.error('❌ Verification failed: subscription not found');
      process.exit(1);
    }
    
    console.log('🎉 Dev subscription seeded successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('   1. Start backend: npm run dev');
    console.log('   2. Start frontend: npm run dev:frontend');
    console.log('   3. Open http://localhost:5173');
    console.log('   4. Login as tenant 16');
    console.log('   5. Verify: No SUBSCRIPTION_REQUIRED error');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error seeding dev subscription:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Exécuter le script
seedDevSubscription();