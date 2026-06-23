#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'ekala.db');

try {
  const db = new Database(DB_PATH);
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  TABLES DANS LA BASE DE DONNÉES');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    ORDER BY name
  `).all();
  
  console.log(`✅ ${tables.length} tables trouvées:\n`);
  
  tables.forEach((t, i) => {
    console.log(`   ${i + 1}. ${t.name}`);
  });
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  RECHERCHE DE TABLES SAAS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const saasTables = ['tenants', 'subscriptions', 'payments', 'subscription_payment_requests', 'plans'];
  
  saasTables.forEach(tableName => {
    const exists = tables.find(t => t.name === tableName);
    if (exists) {
      const count = db.prepare(`SELECT COUNT(*) as cnt FROM ${tableName}`).get().cnt;
      console.log(`✅ ${tableName}: ${count} lignes`);
    } else {
      console.log(`❌ ${tableName}: N'EXISTE PAS`);
    }
  });
  
  db.close();
  
} catch (err) {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
}

</parameter>
</parameter>
</parameter>
</write_to_file>

</final_file_content>

IMPORTANT: For any future changes to this file, use this reference for the most up-to-date version of the file, which reflects any auto-formatting or user-applied changes. Base your SEARCH/REPLACE operations on this final version to ensure accuracy.

 <environment_details>
# Visual Studio Code Visible Files
scripts/check_tables.js

# Visual Studio Code Open Tabs
src/server/routes/expenses.ts
src/server/routes/suppliers.ts
src/server/routes/customers.ts
src/server/routes/inventory.ts
.env.example
src/sync/sync-orchestrator-v2.ts
docs/BIDIRECTIONAL_SYNC_COMPLETE.md
src/features/tables/components/AssignWaiterModal.tsx
src/stores/useTableStore.ts
src/sync/core/entity-registry.ts
FIX_CATEGORIES_UNIQUE_CONSTRAINT.sql
fix_category_duplicate.sql
src/server/routes/menu.ts
src/pages/PublicMenuPage.tsx
frontend/src/services/api.ts
src/lib/app-config.ts
src/pages/auth/LoginPage.tsx
src/server/saas/repositories/supabase/saas-supabase.repository.ts
src/server/services/supabase-pull-sync.service.ts
src/sync/startup-migration.ts
src/sync/index.ts
FIX_SUPABASE_TENANT_ID_COLUMNS.sql
src/pages/staff/StaffPage.tsx
src/pages/users/UsersPage.tsx
src/pages/CategoriesPage.tsx
src/pages/TablesPage.tsx
src/components/ConfirmDialog.tsx
src/server/routes/categories.ts
src/server/services/supabase-realtime-sync.service.ts
SUPABASE_PRODUCTS_SYNC_FIX.sql
src/sync/core/dead-letter-queue.ts
test_product_sync.js
src/server/routes/products.ts
src/features/products/ProductsPage.tsx
src/pages/sales/SalesHistoryPage.tsx
AUDIT_VOUCHER_SYSTEM.md
backend/migrations/034_subscription_payment_requests.sql
src/pages/staff/StaffPage.tsx
src/pages/users/UsersPage.tsx
src/pages/CategoriesPage.tsx
src/pages/TablesPage.tsx
src/components/ConfirmDialog.tsx
src/server/routes/categories.ts
src/server/services/supabase-realtime-sync.service.ts
SUPABASE_PRODUCTS_SYNC_FIX.sql
src/sync/core/dead-letter-queue.ts
test_product_sync.js
src/server/routes/products.ts
src/features/products/ProductsPage.tsx
src/pages/sales/SalesHistoryPage.tsx
AUDIT_VOUCHER_SYSTEM.md
backend/migrations/034_subscription_payment_requests.sql
src/pages/Dashboard.tsx
src/pages/saas/SignupPage.tsx
src/components/NotificationCenter.tsx
src/stores/useNotificationStore.ts
src/components/GlobalNotificationToast.tsx
src/components/SubscriptionGate.tsx
src/server/routes/billing.routes.ts
src/server/services/billing-expiration.service.ts
src/server/saas/cron/expiration.cron.ts
docs/BILLING_EXPIRATION_SYSTEM.md
docs/ADMIN_VOUCHER_VALIDATION_ARCHITECTURE.md
src/pages/admin/AdminVouchersPage.tsx
docs/ACTION_PLAN.md
src/i18n/locales/fr.json
src/i18n/locales/en.json
docs/BILLING_SYNC_AUDIT.md
backend/migrations/035_voucher_first_tables.sql
src/server/services/email-templates.ts
docs/VOUCHER_SYSTEM_COMPLETE.md
src/pages/saas/BillingPage.tsx
src/pages/saas/BillingPageV2.tsx
docs/TENANT_16_BILLING_ANALYSIS.md
scripts/diagnose_tenant_16.js
scripts/run_diagnose_tenant_16.sh
scripts/README_DIAGNOSTIC_TENANT_16.md
docs/SUMMARY_TENANT_16_FIXES.md
scripts/check_tables.js
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDITIONAL_AUDIT.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTIONAL_AUDIT.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECITURE_AUDIT.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_AUDIT.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/PLATFORM_ROLES_CORRECTION_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE_DECISION.md
scripts/PLATFORM_USERS_ARCHITECTURE_AUDIT.md
scripts/PLATFORM_ROLES_CORRECTION_PLAN.md
scripts/ROLES_STORAGE