// Script pour insérer des notifications de test dans Supabase
// Usage: node scripts/seed_notifications_supabase.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function seedNotifications() {
  console.log('🌱 Insertion de notifications de test...\n');

  // BIGINT user IDs (matches Supabase users.id schema)
  const testUserIds = [
    1,  // admin
    31, // waiter
    16, // tenant user
  ];

  const testNotifications = [
    {
      id: 'notif-001',
      type: 'newQrOrder',
      title: 'Nouvelle commande QR',
      message: 'Une nouvelle commande a été passée depuis le QR code',
      priority: 'high',
      notification_type: 'NEW_QR_ORDER',
      metadata: { table_id: 1, order_id: 123 },
      link: '/orders?highlight=123',
      user_id: testUserIds[1], // waiter
      role: null,
    },
    {
      id: 'notif-002',
      type: 'stockLow',
      title: 'Stock bas',
      message: 'Le stock de "Coca-Cola" est bas (5 unités restantes)',
      priority: 'medium',
      notification_type: 'STOCK_LOW',
      metadata: { product_id: 42, current_stock: 5 },
      link: '/inventory',
      user_id: null,
      role: 'admin',
    },
    {
      id: 'notif-003',
      type: 'orderAssigned',
      title: 'Commande assignée',
      message: 'La commande #123 vous a été assignée',
      priority: 'medium',
      notification_type: 'ORDER_ASSIGNED',
      metadata: { order_id: 123, waiter_id: testUserIds[1] },
      link: '/orders/123',
      user_id: testUserIds[1], // waiter
      role: null,
    },
    {
      id: 'notif-004',
      type: 'paymentReceived',
      title: 'Paiement reçu',
      message: 'Paiement de 15,000 FCFA reçu pour la commande #123',
      priority: 'low',
      notification_type: 'PAYMENT_RECEIVED',
      metadata: { order_id: 123, amount: 15000 },
      link: '/sales',
      user_id: testUserIds[1], // waiter
      role: null,
    },
    {
      id: 'notif-005',
      type: 'systemAlert',
      title: 'Maintenance système',
      message: 'Le système sera en maintenance dans 2 heures',
      priority: 'critical',
      notification_type: 'SYSTEM_ALERT',
      metadata: { maintenance_window: '2h' },
      link: null,
      user_id: null,
      role: 'admin',
    },
  ];

  for (const notif of testNotifications) {
    const { data, error } = await supabase
      .from('notifications')
      .insert(notif)
      .select()
      .single();

    if (error) {
      if (error.message?.includes('Could not find the table')) {
        console.error('❌ La table "notifications" n\'existe pas dans Supabase.');
        console.error('   Exécutez d\'abord le script SQL: backend/migrations/049_notifications_table.sql');
        process.exit(1);
      }
      console.error('❌ Erreur lors de l\'insertion:', error.message);
    } else {
      console.log(`✅ Notification insérée: ${data.id} - ${data.title}`);
    }
  }

  console.log('\n✅ Seed terminé avec succès !');
  console.log(`   ${testNotifications.length} notifications insérées.\n`);
}

seedNotifications().catch((err) => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});