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
  try {
    // Cloud mode: read from Supabase
    if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_PRODUCTS) {
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: 'Supabase not configured' });
      }
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      const { data, error } = await supabase.from('settings').select('key, value');
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
      ? (db.prepare('SELECT setting_key, setting_value FROM settings').all() as Array<{ setting_key: string; setting_value: string }>)
      : (db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>);

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
router.patch('/', requireAdminOrManager, async (req, res) => {
  const updates = req.body;

  try {
    // Always use the real schema present in database.db: settings(key, value, updated_at)
    const stmt = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ($key, $value)`);

    // Avoid long-lived sqlite write transactions; improves resilience under DB lock.
    const entries = Object.entries(updates || {});
    console.log('[Settings] PATCH payload keys:', entries.map(([k]) => k));

    // Map frontend camelCase/snake_case/legacy keys -> DB keys (old schema: settings(key,value))
    const keyMap: Record<string, string> = {
      // Business
      businessName: 'business_name',
      address: 'address',
      phone: 'phone',
      email: 'email',
      operatingCountry: 'operating_country',
      taxRate: 'tax_rate',
      serviceCharge: 'service_charge',
      receiptFooter: 'receipt_footer',
      autoPrint: 'auto_print',
      showLogo: 'show_logo',

      // Email notifications
      notificationEmail: 'email_forward_to',
      emailForwardTo: 'email_forward_to',
      emailNotificationsEnabled: 'email_notifications_enabled',
      additionalForwardEmail: 'additional_forward_email',

      notifyAdmin: 'notify_admin',
      notifyManager: 'notify_manager',
      notifyServer: 'notify_server',

      // Role config
      roleNotificationConfig: 'role_notification_config',
      role_notification_config: 'role_notification_config',
      roleConfigs: 'role_notification_config',

      // Rates
      exchangeRates: 'exchange_rates',
      exchange_rates: 'exchange_rates',

      // Some legacy keys may come already in snake_case
      business_name: 'business_name',
      operating_country: 'operating_country',
      tax_rate: 'tax_rate',
      service_charge: 'service_charge',
      receipt_footer: 'receipt_footer',
      auto_print: 'auto_print',
      show_logo: 'show_logo',
      email_forward_to: 'email_forward_to',
      email_notifications_enabled: 'email_notifications_enabled',
    };

    const ALLOWED_DB_KEYS = new Set<string>([
      'business_name',
      'address',
      'phone',
      'email',
      'operating_country',
      'tax_rate',
      'service_charge',
      'receipt_footer',
      'auto_print',
      'show_logo',

      // Email notifications
      'email_forward_to',
      'additional_forward_email',
      'email_notifications_enabled',

      'notify_admin',
      'notify_manager',
      'notify_server',

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

      if (typeof dbValue === 'boolean') dbValue = dbValue ? '1' : '0';
      if (typeof dbValue === 'number') dbValue = String(dbValue);

      if (mappedKey == null || dbValue === undefined) {
        continue;
      }

      const storeKey = mappedKey;

      stmt.run({ key: storeKey, value: dbValue });
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
