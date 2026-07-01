/**
 * Seed Script for Billing System V1.1
 * 
 * Creates default plans and sample vouchers for testing.
 * Usage: node scripts/seed_billing_vouchers.js
 */

const { db } = require('../src/server/db/database');

async function seedPlans() {
  console.log('📦 Seeding plans...');

  const plans = [
    {
      id: 'basic',
      name: 'Basic',
      description: 'Plan Basic - Fonctionnalités essentielles',
      price_monthly: 29,
      price_yearly: 290,
      duration_days: 30,
      features: ['1 utilisateur', '100 produits', 'Support email'],
      max_users: 1,
      max_products: 100,
      max_orders_per_month: 500
    },
    {
      id: 'standard',
      name: 'Standard',
      description: 'Plan Standard - Pour les petites équipes',
      price_monthly: 79,
      price_yearly: 790,
      duration_days: 30,
      features: ['5 utilisateurs', '500 produits', 'Support prioritaire', 'Rapports avancés'],
      max_users: 5,
      max_products: 500,
      max_orders_per_month: 2000
    },
    {
      id: 'premium',
      name: 'Premium',
      description: 'Plan Premium - Pour les entreprises',
      price_monthly: 199,
      price_yearly: 1990,
      duration_days: 30,
      features: ['Utilisateurs illimités', 'Produits illimités', 'Support 24/7', 'API access', 'Custom branding'],
      max_users: -1,
      max_products: -1,
      max_orders_per_month: -1
    }
  ];

  for (const plan of plans) {
    try {
      await db.query(
        `INSERT INTO plans (id, name, description, price_monthly, price_yearly, duration_days, features, max_users, max_products, max_orders_per_month, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           price_monthly = EXCLUDED.price_monthly,
           price_yearly = EXCLUDED.price_yearly,
           duration_days = EXCLUDED.duration_days,
           features = EXCLUDED.features,
           max_users = EXCLUDED.max_users,
           max_products = EXCLUDED.max_products,
           max_orders_per_month = EXCLUDED.max_orders_per_month,
           updated_at = NOW()`,
        [
          plan.id,
          plan.name,
          plan.description,
          plan.price_monthly,
          plan.price_yearly,
          plan.duration_days,
          JSON.stringify(plan.features),
          plan.max_users,
          plan.max_products,
          plan.max_orders_per_month
        ]
      );
      console.log(`  ✅ Plan "${plan.name}" created/updated`);
    } catch (error) {
      console.error(`  ❌ Failed to create plan "${plan.name}":`, error.message);
    }
  }
}

async function seedVouchers() {
  console.log('\n🎫 Seeding vouchers...');

  const vouchers = [
    // Basic plan vouchers
    { code: 'BASIC-2026-001', plan: 'basic', duration_days: 30, expires_days: 90 },
    { code: 'BASIC-2026-002', plan: 'basic', duration_days: 30, expires_days: 90 },
    { code: 'BASIC-2026-003', plan: 'basic', duration_days: 30, expires_days: 90 },
    { code: 'BASIC-2026-004', plan: 'basic', duration_days: 30, expires_days: 90 },
    { code: 'BASIC-2026-005', plan: 'basic', duration_days: 30, expires_days: 90 },
    
    // Standard plan vouchers
    { code: 'STANDARD-2026-001', plan: 'standard', duration_days: 30, expires_days: 90 },
    { code: 'STANDARD-2026-002', plan: 'standard', duration_days: 30, expires_days: 90 },
    { code: 'STANDARD-2026-003', plan: 'standard', duration_days: 30, expires_days: 90 },
    { code: 'STANDARD-2026-004', plan: 'standard', duration_days: 30, expires_days: 90 },
    { code: 'STANDARD-2026-005', plan: 'standard', duration_days: 30, expires_days: 90 },
    
    // Premium plan vouchers
    { code: 'PREMIUM-2026-001', plan: 'premium', duration_days: 30, expires_days: 90 },
    { code: 'PREMIUM-2026-002', plan: 'premium', duration_days: 30, expires_days: 90 },
    { code: 'PREMIUM-2026-003', plan: 'premium', duration_days: 30, expires_days: 90 },
    
    // Trial vouchers (7 days)
    { code: 'TRIAL-7DAYS-001', plan: 'basic', duration_days: 7, expires_days: 30 },
    { code: 'TRIAL-7DAYS-002', plan: 'basic', duration_days: 7, expires_days: 30 },
    { code: 'TRIAL-7DAYS-003', plan: 'standard', duration_days: 7, expires_days: 30 },
    
    // Long-term vouchers (90 days)
    { code: 'LONGTERM-90-001', plan: 'basic', duration_days: 90, expires_days: 180 },
    { code: 'LONGTERM-90-002', plan: 'standard', duration_days: 90, expires_days: 180 },
    { code: 'LONGTERM-90-003', plan: 'premium', duration_days: 90, expires_days: 180 },
    
    // Yearly vouchers (365 days)
    { code: 'YEARLY-001', plan: 'basic', duration_days: 365, expires_days: 730 },
    { code: 'YEARLY-002', plan: 'standard', duration_days: 365, expires_days: 730 },
    { code: 'YEARLY-003', plan: 'premium', duration_days: 365, expires_days: 730 }
  ];

  let created = 0;
  let skipped = 0;

  for (const voucher of vouchers) {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + voucher.expires_days);

      const result = await db.query(
        `INSERT INTO vouchers (code, plan, duration_days, status, expires_at, created_at)
         VALUES ($1, $2, $3, 'ACTIVE', $4, NOW())
         ON CONFLICT (code) DO NOTHING
         RETURNING id`,
        [voucher.code, voucher.plan, voucher.duration_days, expiresAt]
      );

      if (result.rows.length > 0) {
        console.log(`  ✅ Voucher "${voucher.code}" created (${voucher.plan}, ${voucher.duration_days} days)`);
        created++;
      } else {
        console.log(`  ⏭️  Voucher "${voucher.code}" already exists, skipped`);
        skipped++;
      }
    } catch (error) {
      console.error(`  ❌ Failed to create voucher "${voucher.code}":`, error.message);
    }
  }

  console.log(`\n📊 Summary: ${created} created, ${skipped} skipped`);
}

async function seedSampleSubscription() {
  console.log('\n👤 Seeding sample subscription...');

  try {
    const now = new Date();
    const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    await db.query(
      `INSERT INTO subscriptions (tenant_id, plan, status, start_date, end_date, activation_source, activation_reference, activated_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (tenant_id) DO UPDATE SET
         plan = EXCLUDED.plan,
         status = EXCLUDED.status,
         end_date = EXCLUDED.end_date,
         updated_at = NOW()`,
      [
        'sample-tenant-123',
        'premium',
        'ACTIVE',
        now,
        endDate,
        'manual',
        'SAMPLE-SEED',
        now,
        now,
        now
      ]
    );

    console.log('  ✅ Sample subscription created for tenant "sample-tenant-123"');
    console.log('     Plan: premium');
    console.log('     Status: ACTIVE');
    console.log('     Expires:', endDate.toISOString());
  } catch (error) {
    console.error('  ❌ Failed to create sample subscription:', error.message);
  }
}

async function showStats() {
  console.log('\n📊 Database Stats:');

  try {
    const plansCount = await db.query('SELECT COUNT(*) FROM plans');
    const vouchersCount = await db.query('SELECT COUNT(*) FROM vouchers');
    const activeVouchers = await db.query("SELECT COUNT(*) FROM vouchers WHERE status = 'ACTIVE'");
    const usedVouchers = await db.query("SELECT COUNT(*) FROM vouchers WHERE status = 'USED'");
    const subscriptionsCount = await db.query('SELECT COUNT(*) FROM subscriptions');
    const activeSubscriptions = await db.query("SELECT COUNT(*) FROM subscriptions WHERE status = 'ACTIVE'");

    console.log(`  Plans: ${plansCount.rows[0].count}`);
    console.log(`  Vouchers: ${vouchersCount.rows[0].count} (${activeVouchers.rows[0].count} active, ${usedVouchers.rows[0].count} used)`);
    console.log(`  Subscriptions: ${subscriptionsCount.rows[0].count} (${activeSubscriptions.rows[0].count} active)`);
  } catch (error) {
    console.error('  ❌ Failed to get stats:', error.message);
  }
}

async function main() {
  console.log('🌱 Billing System V1.1 - Database Seeding\n');
  console.log('══════════════════════════════════════════════════════════════\n');

  try {
    await seedPlans();
    await seedVouchers();
    await seedSampleSubscription();
    await showStats();

    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('✅ Seeding completed successfully!');
    console.log('══════════════════════════════════════════════════════════════\n');

    console.log('📝 Next steps:');
    console.log('  1. Test voucher activation: POST /api/v1/subscription/activate');
    console.log('  2. Check subscription status: GET /api/v1/subscription/status/:tenantId');
    console.log('  3. View available vouchers in database');
    console.log('\n💡 Example voucher codes for testing:');
    console.log('  - BASIC-2026-001 (Basic plan, 30 days)');
    console.log('  - STANDARD-2026-001 (Standard plan, 30 days)');
    console.log('  - PREMIUM-2026-001 (Premium plan, 30 days)');
    console.log('  - TRIAL-7DAYS-001 (Basic plan, 7 days trial)');
    console.log('  - YEARLY-001 (Basic plan, 365 days)');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  }
}

main();