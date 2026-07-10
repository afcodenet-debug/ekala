import { Router } from 'express';
import { requireAdminOrManager } from '../middleware/auth';
import { db } from '../db/database';
import { env } from '../config/env';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Sensitive keys that must NEVER be sent to the frontend
const SENSITIVE_KEYS = ['smtp_pass', 'smtp_user'];

/**
 * GET /api/settings
 * Returns sanitized settings for frontend (excludes sensitive fields like smtp_pass)
 */
router.get('/', async (req, res) => {
  const tenantId = (req as any).tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }
  try {
    // Cloud mode: read from Supabase
    if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_PRODUCTS) {
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: 'Supabase not configured' });
      }
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      const { data, error } = await supabase.from('settings').select('key, value').eq('tenant_id', tenantId);
      if (error) return res.status(500).json({ error: error.message });
      
      const settings: Record<string, any> = {};
      for (const row of data || []) {
        let value: any = row.value;
        if (['email_notifications_enabled', 'smtp_secure', 'notify_', 'auto_print', 'show_logo'].some(k => row.key.startsWith(k))) {
          value = value === 'true' || value === '1';
        }
        if (['smtp_port', 'tax_rate', 'service_charge'].includes(row.key)) {
          value = Number(value);
        }
        settings[row.key] = value;
      }
      SENSITIVE_KEYS.forEach(k => delete settings[k]);
      return res.json(settings);
    }

    // Local mode: read from SQLite
    if (!db) {
      return res.status(500).json({ error: 'SQLite not available' });
    }

    const columns = db
      .prepare(`PRAGMA table_info(settings)`)
      .all() as Array<{ name: string }>;

    console.log('[Settings] GET /api/settings PRAGMA settings columns:', columns);

    const columnNames = columns.map(c => c.name);

    // Support both schemas:
    // 1) current: setting_key / setting_value
    // 2) older: key / value
    const hasNewColumns = columnNames.includes('setting_key') && columnNames.includes('setting_value');
    const hasOldColumns = columnNames.includes('key') && columnNames.includes('value');

    if (!hasNewColumns && !hasOldColumns) {
      return res.status(500).json({
        error: 'Settings table schema not recognized',
        columns: columnNames
      });
    }

    const rows = hasNewColumns
      ? (db.prepare('SELECT setting_key, setting_value FROM settings WHERE tenant_id = ?').all(tenantId) as Array<{ setting_key: string; setting_value: string }>)
      : (db.prepare('SELECT key, value FROM settings WHERE tenant_id = ?').all(tenantId) as Array<{ key: string; value: string }>);

    const settings: Record<string, any> = {};

    for (const row of rows as any[]) {
      const key = hasNewColumns ? (row.setting_key as string) : (row.key as string);
      let value: any = hasNewColumns ? (row.setting_value as string) : (row.value as string);

      if (key === 'role_notification_config' && value) {
        try {
          if (typeof value === 'string') value = JSON.parse(value);
        } catch {
          console.warn('[Settings] Invalid JSON in role_notification_config');
          value = {};
        }
      }

      if (['email_notifications_enabled', 'smtp_secure', 'notify_', 'auto_print', 'show_logo'].some(k => key.startsWith(k))) {
        value = value === 'true' || value === '1';
      }

      if (['smtp_port', 'tax_rate', 'service_charge'].includes(key)) {
        value = Number(value);
      }

      settings[key] = value;
    }

    SENSITIVE_KEYS.forEach(k => delete settings[k]);

    res.json(settings);
  } catch (error: any) {
    console.error('[Settings] GET error:', error?.message || error, {
      stack: error?.stack,
    });
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * PATCH /api/settings
 * Updates settings from frontend data
 * Expects partial settings object with camelCase keys
 */
router.patch('/', requireAdminOrManager, async (req: any, res) => {
  const updates = req.body;
  const tenantId = req.tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }

  try {
    // Per-tenant settings: the table uses a composite primary key (key, tenant_id),
    // so each tenant owns its own independent copy of every key. We upsert scoped
    // to (key, tenant_id) to avoid clobbering another tenant's row and to preserve
    // the `remote_id`/sync metadata on the existing row.
    const stmt = db.prepare(
      `INSERT INTO settings (key, value, tenant_id) VALUES (?, ?, ?)
       ON CONFLICT(key, tenant_id) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
    );

    // Avoid long-lived sqlite write transactions; improves resilience under DB lock.
    const entries = Object.entries(updates || {});
    console.log('[Settings] PATCH payload keys:', entries.map(([k]) => k));

    // Map frontend camelCase/snake_case/legacy keys -> DB keys (old schema: settings(key,value))
    const keyMap: Record<string, string> = {
      // Locale / currency
      appLanguage: 'app_language',
      app_language: 'app_language',
      appCurrency: 'app_currency',
      app_currency: 'app_currency',
      currencySymbol: 'currency_symbol',
      currency_symbol: 'currency_symbol',

      // Business
      businessName: 'business_name',
      business_name: 'business_name',
      address: 'address',
      phone: 'phone',
      email: 'email',
      operatingCountry: 'operating_country',
      operating_country: 'operating_country',
      taxRate: 'tax_rate',
      tax_rate: 'tax_rate',
      taxPercentage: 'tax_percentage',
      tax_percentage: 'tax_percentage',
      serviceCharge: 'service_charge',
      service_charge: 'service_charge',
      receiptFooter: 'receipt_footer',
      receipt_footer: 'receipt_footer',
      autoPrint: 'auto_print',
      auto_print: 'auto_print',
      showLogo: 'show_logo',
      show_logo: 'show_logo',
      offlineMode: 'offline_mode',
      offline_mode: 'offline_mode',

      // Email transport / notifications
      notificationEmail: 'email_forward_to',
      emailForwardTo: 'email_forward_to',
      email_forward_to: 'email_forward_to',
      emailNotificationsEnabled: 'email_notifications_enabled',
      email_notifications_enabled: 'email_notifications_enabled',
      emailProvider: 'email_provider',
      email_provider: 'email_provider',
      additionalForwardEmail: 'additional_forward_email',
      additional_forward_email: 'additional_forward_email',
      smtpHost: 'smtp_host',
      smtp_host: 'smtp_host',
      smtpPort: 'smtp_port',
      smtp_port: 'smtp_port',
      smtpSecure: 'smtp_secure',
      smtp_secure: 'smtp_secure',
      smtpUser: 'smtp_user',
      smtp_user: 'smtp_user',
      smtpPass: 'smtp_pass',
      smtp_pass: 'smtp_pass',

      notifyAdmin: 'notify_admin',
      notify_admin: 'notify_admin',
      notifyManager: 'notify_manager',
      notify_manager: 'notify_manager',
      notifyServer: 'notify_server',
      notify_server: 'notify_server',
      notifyStockAdjustment: 'notify_stock_adjustment',
      notify_stock_adjustment: 'notify_stock_adjustment',
      notifyInventoryUpdate: 'notify_inventory_update',
      notify_inventory_update: 'notify_inventory_update',
      notifyLowStock: 'notify_low_stock',
      notify_low_stock: 'notify_low_stock',
      notifyOutOfStock: 'notify_out_of_stock',
      notify_out_of_stock: 'notify_out_of_stock',
      notifyNewProduct: 'notify_new_product',
      notify_new_product: 'notify_new_product',
      notifyProductDeleted: 'notify_product_deleted',
      notify_product_deleted: 'notify_product_deleted',
      notifySales: 'notify_sales',
      notify_sales: 'notify_sales',

      // Role config
      roleNotificationConfig: 'role_notification_config',
      role_notification_config: 'role_notification_config',
      roleConfigs: 'role_notification_config',

      // Rates
      exchangeRates: 'exchange_rates',
      exchange_rates: 'exchange_rates',
    };

    const ALLOWED_DB_KEYS = new Set<string>([
      // Locale / currency
      'app_language',
      'app_currency',
      'currency_symbol',

      // Business
      'business_name',
      'address',
      'phone',
      'email',
      'operating_country',
      'tax_rate',
      'tax_percentage',
      'service_charge',
      'receipt_footer',
      'auto_print',
      'show_logo',
      'offline_mode',

      // Email transport
      'email_provider',
      'smtp_host',
      'smtp_port',
      'smtp_secure',
      'smtp_user',
      'smtp_pass',

      // Email notifications
      'email_forward_to',
      'additional_forward_email',
      'email_notifications_enabled',

      // Notification toggles
      'notify_admin',
      'notify_manager',
      'notify_server',
      'notify_stock_adjustment',
      'notify_inventory_update',
      'notify_low_stock',
      'notify_out_of_stock',
      'notify_new_product',
      'notify_product_deleted',
      'notify_sales',

      // Role-based config
      'role_notification_config',

      // Exchange rates
      'exchange_rates',
    ]);

    for (const [incomingKey, incomingValue] of entries) {
      // 1) Normalize key to DB key
      const mappedKey =
        keyMap[incomingKey] ||
        (incomingKey === 'roleNotificationConfig' || incomingKey === 'role_notification_config'
          ? 'role_notification_config'
          : incomingKey);

      if (!ALLOWED_DB_KEYS.has(mappedKey)) {
        continue;
      }

      // 2) Normalize value to DB string
      let dbValue: any = incomingValue;

      if (mappedKey === 'role_notification_config') {
        dbValue =
          typeof incomingValue === 'object' ? JSON.stringify(incomingValue) : incomingValue;
      }
      if (mappedKey === 'exchange_rates') {
        dbValue =
          typeof incomingValue === 'object' ? JSON.stringify(incomingValue) : incomingValue;
      }

      // Locale: normalize and validate against supported languages.
      if (mappedKey === 'app_language') {
        const lang = String(incomingValue || '').toLowerCase().slice(0, 2);
        dbValue = ['en', 'fr', 'pt'].includes(lang) ? lang : 'en';
      }
      // Currency codes are uppercase (ISO 4217).
      if (mappedKey === 'app_currency' || mappedKey === 'currency_symbol') {
        dbValue = String(incomingValue || '').toUpperCase();
      }

      if (typeof dbValue === 'boolean') dbValue = dbValue ? '1' : '0';
      if (typeof dbValue === 'number') dbValue = String(dbValue);

      if (mappedKey == null || dbValue === undefined) {
        continue;
      }

      const storeKey = mappedKey;

      stmt.run(storeKey, dbValue, tenantId);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Settings] PATCH error:', error?.message || error, {
      stack: error?.stack,
      payload: updates
    });

    res.status(500).json({
      error: 'Failed to update settings',
      message: error?.message || String(error),
    });
  }
});

export default router;
