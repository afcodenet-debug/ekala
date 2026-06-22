/// <reference path="./nodemailer.d.ts" />
/**
 * Email Notification Service — Great Olive POS/ERP
 *
 * Triggers
 * ───────
 *  • Stock adjustment  (product quantity manually changed)
 *  • Sale / checkout    (inventory drawn down by a sale)
 *  • Low-stock alert    (stock ≤ minimum threshold)
 *  • Out-of-stock alert (stock = 0)
 *  • New product        (product created)
 *  • Product deleted    (product soft-deleted)
 *
 * Transport: nodemailer + Gmail (production) + Ethereal (fallback test)
 *
 * Default configuration sends real emails to afcodenet@gmail.com
 * using Gmail SMTP + App Password.
 */

import nodemailer from 'nodemailer';
import { db } from '../db/database';
import { NOTIFICATION_TYPES } from '../../constants/notificationTypes';
import { getCurrentTenantId } from '../db/tenant-context';

/* ══════════════════════════════════════════════════════════════════════════
 * Settings — loaded from the server settings store (SQLite-backed).
 * Each key has a sensible default so the service works even before the
 * admin configures anything in the Settings page.
 * ══════════════════════════════════════════════════════════════════════════ */

interface EmailSettings {
  // ── Enable / disable ──
  emailNotificationsEnabled: boolean;

  // ── Transport ──
  emailProvider:    'gmail' | 'ethereal' | 'smtp2go' | 'custom';
  smtpHost:         string;
  smtpPort:         number;
  smtpSecure:       boolean;
  smtpUser:         string;
  smtpPass:         string;

  // ── Forwarding (real address) ──
  // When set and supported by the provider, every email is silently
  // BCC'd to this address so the admin gets a live copy.
  emailForwardTo:   string;

  // ── Subscriptions ──
  notifyStockAdjustment: boolean;
  notifyInventoryUpdate: boolean;
  notifyLowStock:        boolean;
  notifyOutOfStock:      boolean;
  notifyNewProduct:      boolean;
  notifyProductDeleted:  boolean;
  notifySales:           boolean;
}

/** Returns defaults — called when a key is absent from settings. */
export function getDefaultEmailSettings(): EmailSettings {
  return {
    emailNotificationsEnabled: true,
    emailProvider: 'gmail',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: process.env.SMTP_USER || 'afcodenet@gmail.com',
    smtpPass: process.env.SMTP_PASS || 'mqiu vnjq ejmj cncs',
    emailForwardTo: process.env.SMTP_FORWARD_TO || '', // legacy forward only, never auto-recipient
    notifyStockAdjustment: true,
    notifyInventoryUpdate: true,
    notifyLowStock: true,
    notifyOutOfStock: true,
    notifyNewProduct: true,
    notifyProductDeleted: true,
    notifySales: true,
  };
}

/* ── Coercion helpers ────────────────────────────────────────────── */

function asStr(v: any, def: string): string {
  return v == null ? def : String(v);
}
function asNum(v: any, def: number): number {
  const n = Number(v);
  return Number.isNaN(n) ? def : n;
}
function asBool(v: any, def: boolean): boolean {
  if (v === null || v === undefined) return def;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1';
  return !!v;
}

/** Minimal read-access interface so the service doesn't import Zustand client-side. */
export interface SettingsReader {
  [key: string]: string | number | boolean | null | undefined;
}

export function readEmailSettings(raw: SettingsReader): EmailSettings {
  const def = getDefaultEmailSettings();
  return {
    emailNotificationsEnabled:    asBool(raw.email_notifications_enabled,   def.emailNotificationsEnabled),
    emailProvider:                (raw.email_provider  as EmailSettings['emailProvider']) || def.emailProvider,
    smtpHost:                     asStr(raw.smtp_host,                      def.smtpHost),
    smtpPort:                     asNum(raw.smtp_port,                      def.smtpPort),
    smtpSecure:                   asBool(raw.smtp_secure,                   def.smtpSecure),
    smtpUser:                     asStr(raw.smtp_user,                      def.smtpUser),
    smtpPass:                     asStr(raw.smtp_pass,                      def.smtpPass),
    emailForwardTo:               asStr(raw.email_forward_to,               ''),
    notifyStockAdjustment:        asBool(raw.notify_stock_adjustment,       def.notifyStockAdjustment),
    notifyInventoryUpdate:        asBool(raw.notify_inventory_update,       def.notifyInventoryUpdate),
    notifyLowStock:               asBool(raw.notify_low_stock,              def.notifyLowStock),
    notifyOutOfStock:             asBool(raw.notify_out_of_stock,           def.notifyOutOfStock),
    notifyNewProduct:             asBool(raw.notify_new_product,            def.notifyNewProduct),
    notifyProductDeleted:         asBool(raw.notify_product_deleted,        def.notifyProductDeleted),
    notifySales:                  asBool(raw.notify_sales,                  def.notifySales),
  };
}

/** Robust mapper: incoming event type → settings boolean property (used for legacy top-level flags and diagnostics) */
function mapNotificationTypeToSettingKey(type: string): keyof EmailSettings | null {
  const m: Record<string, keyof EmailSettings> = {
    stockAdj: 'notifyStockAdjustment',
    stockAdjustment: 'notifyStockAdjustment',
    'stock-adjustment': 'notifyStockAdjustment',
    inventory: 'notifyInventoryUpdate',
    inventoryUpdate: 'notifyInventoryUpdate',
    lowStock: 'notifyLowStock',
    lowstock: 'notifyLowStock',
    'low-stock': 'notifyLowStock',
    outOfStock: 'notifyOutOfStock',
    outofstock: 'notifyOutOfStock',
    'out-of-stock': 'notifyOutOfStock',
    newProduct: 'notifyNewProduct',
    newproduct: 'notifyNewProduct',
    'new-product': 'notifyNewProduct',
    productDeleted: 'notifyProductDeleted',
    productdeleted: 'notifyProductDeleted',
    'product-deleted': 'notifyProductDeleted',
    sales: 'notifySales',
    orderConfirm: 'notifySales',
    orderconfirm: 'notifySales',
    'order-confirm': 'notifySales',
    receipt: 'notifySales',
  };
  return m[type] || null;
}

/* ══════════════════════════════════════════════════════════════════════════
 * Ethereal-account cache
 * ══════════════════════════════════════════════════════════════════════════ */



/* ══════════════════════════════════════════════════════════════════════════
 * Core sender
 * ══════════════════════════════════════════════════════════════════════════ */

let _transporter: any = null;
let _transporterKey = '';

/**
 * Build the nodemailer transporter from `settings`.
 * For Ethereal: creates a throwaway test account on first call and caches creds.
 * For custom SMTP: uses supplied host/port/user/pass.
 */
async function getTransporter(settings: EmailSettings): Promise<any> {
  const key = `${settings.smtpHost}:${settings.smtpPort}:${settings.smtpUser}`;

  // Recreate transporter if config changed
  if (_transporter && key !== _transporterKey) {
    _transporter.close?.();
    _transporter = null;
  }

  if (_transporter) return _transporter;

  _transporterKey = key;

  // Gmail (production)
  if (settings.emailProvider === 'gmail' || settings.smtpHost === 'smtp.gmail.com') {
    if (!settings.smtpUser || !settings.smtpPass) {
      console.warn('[Notification] Gmail SMTP config incomplete, falling back to Ethereal test account');
    } else {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        pool: true,
        maxConnections: 5,
        auth: {
          user: settings.smtpUser,
          pass: settings.smtpPass,
        },
      });
      _transporter = transporter;
      console.log('[Notification] Gmail SMTP transporter ready');
      return transporter;
    }
  }

  // Ethereal fallback
  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
  _transporter = transporter;
  console.log(`[Notification] Ethereal test account ready: ${testAccount.web}`);
  return transporter;
}

/* ══════════════════════════════════════════════════════════════════════════
 * Design system — Premium dark restaurant aesthetic
 * Palette: Charcoal #1a1a1f · Gold #c9a84c · Warm white #f7f4ef
 * ══════════════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════════════
 * Design system — Premium dark restaurant aesthetic
 * Palette: Charcoal #1a1a1f · Gold #c9a84c · Warm white #f7f4ef
 * ══════════════════════════════════════════════════════════════════════════ */

const EMAIL_BASE_STYLE = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Helvetica Neue',Arial,sans-serif;
    background:#f0ede8;padding:32px 16px}
  .wrap{max-width:480px;margin:0 auto}

  /* ── Structural shells ── */
  .head{background:#1a1a1f;border-radius:16px 16px 0 0;
    padding:22px 28px;display:flex;
    justify-content:space-between;align-items:center}
  .head-title{font-size:18px;font-weight:700;
    color:#c9a84c;letter-spacing:.04em}
  .head-sub{font-size:10px;color:#6a6a80;
    letter-spacing:.14em;margin-top:3px;font-weight:500}
  .body{background:#fff;padding:28px;
    border-left:1px solid #e8e2d9;border-right:1px solid #e8e2d9}
  .foot{background:#f7f4ef;border-radius:0 0 16px 16px;
    padding:14px 28px;border:1px solid #e8e2d9;border-top:none;
    display:flex;justify-content:space-between;align-items:center}
  .foot-text{font-size:10px;color:#bbb;letter-spacing:.08em}

  /* ── Badges ── */
  .badge{font-size:9px;font-weight:700;letter-spacing:.12em;
    padding:5px 12px;border-radius:999px}
  .badge-gold{background:#c9a84c;color:#1a1a1f}
  .badge-red{background:#ef4444;color:#fff}
  .badge-outline-gold{background:#c9a84c20;color:#c9a84c;
    border:1px solid #c9a84c60}

  /* ── Page title ── */
  .page-title{font-size:22px;font-weight:700;
    color:#111;letter-spacing:-.02em;margin-bottom:6px}
  .page-meta{font-size:12px;color:#888;margin-bottom:24px}

  /* ── Divider ── */
  .sep{height:1px;
    background:linear-gradient(to right,#e8e2d9,#c9a84c40,#e8e2d9);
    margin-bottom:20px}

  /* ── Line items (sale) ── */
  .line-item{display:flex;justify-content:space-between;
    padding:9px 0;border-bottom:1px solid #f4f0eb}
  .line-name{font-size:13px;font-weight:600;color:#222}
  .line-detail{font-size:11px;color:#aaa;margin-top:2px}
  .line-amount{font-size:13px;font-weight:700;color:#222}

  /* ── Subtotal rows ── */
  .sub-row{display:flex;justify-content:space-between;
    font-size:12px;color:#888;padding:3px 0}

  /* ── Total block ── */
  .total-block{background:#1a1a1f;border-radius:10px;
    padding:14px 16px;margin-top:14px;
    display:flex;justify-content:space-between;align-items:center}
  .total-label{font-size:10px;color:#6a6a80;
    letter-spacing:.1em;margin-bottom:2px}
  .total-label2{font-size:10px;color:#6a6a80;letter-spacing:.05em}
  .total-value{font-size:26px;font-weight:700;
    color:#c9a84c;letter-spacing:-.02em}

  /* ── Staff cards ── */
  .staff-row{display:flex;gap:10px;margin-top:18px}
  .staff-card{flex:1;background:#faf9f7;border-radius:8px;
    padding:12px;border:1px solid #ede8e0}
  .staff-lbl{font-size:10px;color:#aaa;
    letter-spacing:.1em;margin-bottom:4px}
  .staff-val{font-size:13px;font-weight:600;color:#333}

  /* ── Alert boxes ── */
  .alert-box{border-radius:10px;padding:16px;margin-bottom:14px}
  .alert-red{background:#fef2f2;border:1px solid #fecaca}
  .alert-amber{background:#fffbeb;border:1px solid #fde68a}
  .alert-title{font-size:10px;font-weight:700;
    letter-spacing:.12em;margin-bottom:12px}
  .alert-title-red{color:#ef4444}
  .alert-title-amber{color:#d97706}

  /* ── Alert rows ── */
  .alert-row{display:flex;justify-content:space-between;
    align-items:center;padding:8px 0}
  .alert-row+.alert-row{border-top:1px solid rgba(0,0,0,.06)}
  .alert-product{font-size:13px;font-weight:600;color:#222}
  .alert-threshold{font-size:11px;margin-top:2px}
  .alert-threshold-red{color:#f87171}
  .alert-threshold-amber{color:#d97706}
  .pill-red{background:#ef4444;color:#fff;
    font-size:11px;font-weight:700;
    padding:4px 10px;border-radius:999px}
  .pill-amber{background:#fef3c7;border:1px solid #fde68a;
    color:#92400e;font-size:11px;font-weight:700;
    padding:4px 10px;border-radius:999px}

  /* ── Note box ── */
  .note-box{margin-top:20px;background:#1a1a1f;border-radius:10px;
    padding:14px 16px;font-size:12px;color:#c9a84c;line-height:1.6}

  /* ── KPI grid (report) ── */
  .kpi-grid{display:grid;grid-template-columns:1fr 1fr;
    gap:10px;margin-bottom:24px}
  .kpi-card{background:#f7f4ef;border-radius:10px;
    padding:14px 16px;border:1px solid #ede8e0}
  .kpi-card-dark{background:#1a1a1f;border-radius:10px;
    padding:14px 16px;grid-column:span 2}
  .kpi-lbl{font-size:10px;color:#aaa;
    letter-spacing:.1em;margin-bottom:6px}
  .kpi-lbl-dark{font-size:10px;color:#6a6a80;
    letter-spacing:.1em;margin-bottom:6px}
  .kpi-val{font-size:28px;font-weight:700;color:#111}
  .kpi-val-gold{font-size:28px;font-weight:700;color:#c9a84c}

  /* ── Alert pill row (report) ── */
  .alert-summary{display:flex;gap:10px;margin-bottom:24px}
  .alert-count-box{flex:1;border-radius:10px;padding:12px;text-align:center}
  .alert-count-box-red{background:#fef2f2;border:1px solid #fecaca}
  .alert-count-box-amber{background:#fffbeb;border:1px solid #fde68a}
  .alert-count-num{font-size:22px;font-weight:700}
  .alert-count-num-red{color:#ef4444}
  .alert-count-num-amber{color:#d97706}
  .alert-count-lbl{font-size:10px;letter-spacing:.08em;margin-top:2px}
  .alert-count-lbl-red{color:#ef4444}
  .alert-count-lbl-amber{color:#d97706}

  /* ── Report table ── */
  .report-section-title{font-size:11px;font-weight:700;
    color:#555;letter-spacing:.1em;margin-bottom:12px}
  .table-head{display:grid;
    grid-template-columns:1fr 80px 70px 90px;
    font-size:10px;color:#aaa;letter-spacing:.08em;
    padding:0 0 8px;border-bottom:2px solid #111}
  .table-row{display:grid;
    grid-template-columns:1fr 80px 70px 90px;
    font-size:12px;padding:10px 0;
    border-bottom:1px solid #f4f0eb;align-items:center}
  .table-row:last-child{border-bottom:none}
  .table-product{font-weight:600;color:#222}
  .table-stock-red{text-align:right;font-weight:700;color:#ef4444}
  .table-stock-amber{text-align:right;font-weight:700;color:#d97706}
  .table-min{text-align:right;color:#888}
  .table-status{text-align:right}
  .status-out{background:#fef2f2;color:#ef4444;
    font-size:9px;font-weight:700;
    padding:3px 8px;border-radius:999px}
  .status-low{background:#fffbeb;color:#d97706;
    font-size:9px;font-weight:700;padding:3px 8px;
    border-radius:999px;border:1px solid #fde68a}

  /* ── Report footer note ── */
  .report-note{margin-top:20px;font-size:11px;color:#aaa;
    line-height:1.7;border-top:1px solid #f0ebe3;padding-top:16px}
`;


/* ══════════════════════════════════════════════════════════════════════════
 * PRODUCTION-GRADE MONETARY UTILITIES
 * ══════════════════════════════════════════════════════════════════════════ */

/** Centralized safe numeric parser — never returns NaN */
function safeMoney(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  if (typeof value === 'string') {
    const raw = value;
    let s = raw.trim();

    // normalize: remove currency symbols and any non-numeric except . and -
    s = s.replace(/[^0-9.,-]/g, '');
    // remove thousand separators
    s = s.replace(/,/g, '');

    const parts = s.split('.');
    if (parts.length > 2) s = parts[0] + '.' + parts.slice(1).join('');

    const n = parseFloat(s);
    if (Number.isFinite(n)) return n;

    // Debug once (prevents terminal spam) when malformed money is detected
    // You can enable by setting DEBUG_EMAIL_NUMERIC=1
    const debug = asBool(process.env.DEBUG_EMAIL_NUMERIC, false);
    if (debug) {
      (safeMoney as any)._cnt = (safeMoney as any)._cnt ?? 0;
      if ((safeMoney as any)._cnt < 20) {
        (safeMoney as any)._cnt++;
        console.log(`[Notification][safeMoney] malformed money → 0`, { raw, cleaned: s });
      }
    }

    return 0;
  }

  return 0;
}

/** Bulletproof currency formatter */
function formatMoney(value: unknown, currency: string): string {
  const num = safeMoney(value);
  const safeCurrency = currency && currency.length === 3 ? currency.toUpperCase() : 'USD';

  try {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: safeCurrency,
      minimumFractionDigits: 2,
    }).format(num);

    // Extra safety against any NaN leakage
    if (formatted.includes('NaN')) return `${safeCurrency} 0.00`;
    return formatted;
  } catch {
    return `${safeCurrency} ${num.toFixed(2)}`;
  }
}

/**
 * formatMoneyHtml:
 * - never throws
 * - never renders NaN
 * - normalizes any accidental "ZMWNaN" => "ZMW 0.00"
 */
function formatMoneyHtml(value: unknown, currency: string): string {
  const safeCur = (currency && currency.length === 3) ? currency.toUpperCase() : 'USD';
  const num = safeMoney(value);

  // Debug log for stock movement NaN investigation
  if (process.env.DEBUG_EMAIL === 'true') {
    console.log('[EMAIL DEBUG] formatMoneyHtml called with:', { value, currency, safeCur, num });
  }

  let out = formatMoney(num, safeCur);

  if (out.toLowerCase().includes('nan') || out.includes('NaN')) {
    console.warn('[EMAIL] NaN detected in formatMoneyHtml, forcing fallback');
    return `${safeCur} 0.00`;
  }

  out = out.replace(/^([A-Z]{3})([-\s]?\d)/, (_m, code, rest) => `${code} ${rest}`);
  return out;
}

/** Robust numeric parser — production grade for monetary data from any source (SQLite strings, formatted currency, nulls, etc.) */
function parseNumericValue(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    let s = v.trim();
    // Remove currency symbols and non-numeric except . and -
    s = s.replace(/[^0-9.,-]/g, '');
    // Remove thousand separators (commas) but keep decimal point
    s = s.replace(/,/g, '');
    // Prevent multiple decimal points (keep only first)
    const parts = s.split('.');
    if (parts.length > 2) s = parts[0] + '.' + parts.slice(1).join('');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/* ══════════════════════════════════════════════════════════════════════════
 * REUSABLE EMAIL COMPONENT BUILDERS (table-based for compatibility)
 * ══════════════════════════════════════════════════════════════════════════ */

function buildHeader(businessName: string, eventType: string): string {
  return `
  <div style="background:#1a1a1f;border-radius:16px 16px 0 0;padding:22px 28px;display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="font-size:18px;font-weight:700;color:#c9a84c;letter-spacing:.04em">${businessName}</div>
      <div style="font-size:10px;color:#6a6a80;letter-spacing:.14em;margin-top:3px;font-weight:500">RESTAURANT · BAR</div>
    </div>
    <div style="background:#c9a84c;color:#1a1a1f;font-size:9px;font-weight:700;letter-spacing:.12em;padding:5px 12px;border-radius:999px">${eventType}</div>
  </div>`;
}

function buildFooter(businessName: string): string {
  return `
  <div style="background:#f7f4ef;border-radius:0 0 16px 16px;padding:14px 28px;border:1px solid #e8e2d9;border-top:none;display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:10px;color:#bbb;letter-spacing:.08em">${businessName} · NDOLA</div>
    <div style="font-size:10px;color:#bbb; margin-left: 90px">Automated notification</div>
  </div>`;
}

function buildLineItems(changes: any[] = [], currency: string): string {
  return (changes ?? []).map((c: any) => {
    const qty = safeMoney(c.qty);
    const unitPrice = safeMoney(c.unitPrice);
    const rawLineTotal = c.lineTotal != null ? c.lineTotal : qty * unitPrice;
    const lineTotal = Number.isFinite(safeMoney(rawLineTotal))
      ? safeMoney(rawLineTotal)
      : Number.isFinite(qty * unitPrice)
        ? qty * unitPrice
        : 0;

    return `
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid #f4f0eb;font-size:13px;font-weight:600;color:#222">${c.name}</td>
        <td style="padding:9px 0;border-bottom:1px solid #f4f0eb;font-size:11px;color:#aaa;text-align:right">${qty} × ${formatMoneyHtml(unitPrice, currency)}</td>
        <td style="padding:9px 0;border-bottom:1px solid #f4f0eb;font-size:13px;font-weight:700;color:#222;text-align:right;min-width:90px">${formatMoneyHtml(lineTotal, currency)}</td>
      </tr>`;
  }).join('');
}

function buildTotalSection(
  subtotal: number | undefined,
  tax: { percent: number; amount: number } | undefined,
  totals: { label: string; value: number } | undefined,
  paymentMethod: string | undefined,
  currency: string,
): string {
  let html = `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-collapse:collapse">`;

  if (subtotal !== undefined) {
    html += `
      <tr>
        <td style="font-size:12px;color:#888;padding:5px 0;border-bottom:1px solid #f4f0eb">Subtotal</td>
        <td align="right" style="font-size:12px;color:#888;padding:5px 0;border-bottom:1px solid #f4f0eb;min-width:110px;font-variant-numeric:tabular-nums">${formatMoneyHtml(subtotal, currency)}</td>
      </tr>`;
  }
  if (tax) {
    html += `
      <tr>
        <td style="font-size:12px;color:#888;padding:5px 0">VAT ${tax.percent}%</td>
        <td align="right" style="font-size:12px;color:#888;padding:5px 0;min-width:110px;font-variant-numeric:tabular-nums">${formatMoneyHtml(tax.amount, currency)}</td>
      </tr>`;
  }
  html += `</table>`;

  if (totals) {
    html += `
      <div style="background:#1a1a1f;border-radius:10px;padding:14px 16px;margin-top:14px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:10px;color:#6a6a80;letter-spacing:.1em;margin-bottom:2px">TOTAL PAID</div>
          <div style="font-size:10px;color:#6a6a80;letter-spacing:.05em">${paymentMethod || 'CASH'}</div>
        </div>
        <div style="font-size:26px;font-weight:700;color:#c9a84c;letter-spacing:-.02em">${formatMoneyHtml(totals.value, currency)}</div>
      </div>`;
  }
  return html;
}

function buildStaffSection(note?: string): string {
  const waiterMatch = note?.match(/Waiter:\s*([^\|,\n]+)/i);
  const cashierMatch = note?.match(/Cashier:\s*([^\|,\n]+)/i);
  if (!waiterMatch && !cashierMatch) return '';

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px">
      <tr>
        <td width="50%" style="padding-right:10px">
          <div style="background:#faf9f7;border-radius:8px;padding:12px;border:1px solid #ede8e0">
            <div style="font-size:10px;color:#aaa;letter-spacing:.1em;margin-bottom:4px">WAITER</div>
            <div style="font-size:13px;font-weight:600;color:#333">${waiterMatch?.[1]?.trim() || '—'}</div>
          </div>
        </td>
        <td width="50%" style="padding-left:10px">
          <div style="background:#faf9f7;border-radius:8px;padding:12px;border:1px solid #ede8e0">
            <div style="font-size:10px;color:#aaa;letter-spacing:.1em;margin-bottom:4px">CASHIER</div>
            <div style="font-size:13px;font-weight:600;color:#333">${cashierMatch?.[1]?.trim() || '—'}</div>
          </div>
        </td>
      </tr>
    </table>`;
}

function buildEmailHTML(opts: EmailBody): string {
  const { subject, eventType, product, businessName, changes, totals, subtotal, tax, paymentMethod, note, currency } = opts;

  console.log('currency: ', currency)
  const actualCurrency = currency || 'USD';

  const now = new Date();
  const day = now.getDate();
  const month = now.toLocaleString('en-US', { month: 'short' });
  const year = now.getFullYear();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const time = `${day} ${month} ${year} • ${timeStr}`;

  const invoiceNum = product ? String(product).replace(/\D/g, '').slice(-6) : '';
  const displayInvoice = invoiceNum ? `Invoice #${invoiceNum}` : subject;

  const lineItemsHTML = buildLineItems(changes, actualCurrency);
  const totalSectionHTML = buildTotalSection(subtotal, tax, totals, paymentMethod, actualCurrency);
  const staffHTML = buildStaffSection(note);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>${subject}</title></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f0ede8;padding:32px 16px;margin:0">
<div style="max-width:480px;margin:0 auto">

  ${buildHeader(businessName || 'GREAT OLIVE', eventType)}

  <div style="background:#fff;padding:28px;border-left:1px solid #e8e2d9;border-right:1px solid #e8e2d9">

    <!-- Invoice meta -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
      <tr>
        <td>
          <div style="font-size:18px;font-weight:700;color:#111;letter-spacing:-.02em">${displayInvoice}</div>
          <div style="font-size:10px;color:#888;margin-top:4px">${time}</div>
        </td>
        <td align="right" style="padding-left:20px">
          <div style="font-size:10px;color:#888;letter-spacing:.08em;margin-bottom:3px">TABLE</div>
          <div style="font-size:17px;font-weight:700;color:#111">${product || '—'}</div>
        </td>
      </tr>
    </table>

    <div style="height:1px;background:linear-gradient(to right,#e8e2d9,#c9a84c40,#e8e2d9);margin-bottom:20px"></div>

    <!-- Line items -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px">
      ${lineItemsHTML}
    </table>

    ${totalSectionHTML}
    ${staffHTML}

  </div>

  ${buildFooter(businessName || 'GREAT OLIVE')}

</div>
</body>
</html>`;
}

interface InventorySummaryItem {
  name: string;
  stock_quantity: number;
  minimum_stock: number;
  unit: string;
  status: 'OUT OF STOCK' | 'LOW STOCK';
}

interface InventorySummary {
  generatedAt: string;
  totalProducts: number;
  totalInventoryValue: string;
  totalQuantity: number;
  lowStockCount: number;
  outOfStockCount: number;
  topRiskItems: InventorySummaryItem[];
  currency: string;
}

function buildInventorySummaryHTML(summary: InventorySummary, businessName: string): string {
  const time = new Date().toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const rowsHtml = summary.topRiskItems.length
    ? summary.topRiskItems.map((item, idx) => {
      const isOut = item.status === 'OUT OF STOCK';
      const borderStyle = idx < summary.topRiskItems.length - 1 ? 'border-bottom:1px solid #f4f0eb' : '';

      const stockQty = safeMoney(item.stock_quantity);
      const minStock = safeMoney(item.minimum_stock);
      const unit = asStr(item.unit, '');

      return `<div style="display:grid;grid-template-columns:1fr 80px 70px 90px;font-size:12px;padding:10px 0;${borderStyle};align-items:center">
        <span style="font-weight:600;color:#222">${String(item.name ?? '—')}</span>
        <span style="text-align:right;font-weight:700;color:${isOut ? '#ef4444' : '#d97706'}">${stockQty} ${unit}</span>
        <span style="text-align:right;color:#888">${minStock}</span>
        <span style="text-align:right">
          <span style="font-size:9px;font-weight:700;padding:3px 8px;border-radius:999px;${isOut ? 'background:#fef2f2;color:#ef4444' : 'background:#fffbeb;color:#d97706;border:1px solid #fde68a'}">
            ${isOut ? 'OUT' : 'LOW'}
          </span>
        </span>
      </div>`;
    }).join('')
    : `<div style="color:#22c55e;font-weight:700;font-size:13px;padding:16px 0">
         All inventory levels are within safe thresholds.
       </div>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>Inventory Summary</title></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f0ede8;padding:32px 16px;margin:0">
<div style="max-width:480px;margin:0 auto">

  <div style="background:#1a1a1f;border-radius:16px 16px 0 0;padding:22px 28px;display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="font-size:18px;font-weight:700;color:#c9a84c;letter-spacing:.04em">${businessName.toUpperCase()}</div>
      <div style="font-size:10px;color:#6a6a80;letter-spacing:.14em;margin-top:3px;font-weight:500">INVENTORY REPORT</div>
    </div>
    <div style="background:#c9a84c20;color:#c9a84c;font-size:9px;font-weight:700;letter-spacing:.12em;padding:5px 12px;border-radius:999px;border:1px solid #c9a84c60">06:30 DAILY</div>
  </div>

  <div style="background:#fff;padding:28px;border-left:1px solid #e8e2d9;border-right:1px solid #e8e2d9">

    <div style="font-size:22px;font-weight:700;color:#111;margin-bottom:4px">Inventory Summary</div>
    <div style="font-size:12px;color:#888;margin-bottom:24px">${time} WAT · Auto-generated</div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px">
      <div style="background:#f7f4ef;border-radius:10px;padding:14px 16px;border:1px solid #ede8e0">
        <div style="font-size:10px;color:#aaa;letter-spacing:.1em;margin-bottom:6px">PRODUCTS</div>
        <div style="font-size:28px;font-weight:700;color:#111">${summary.totalProducts}</div>
      </div>
      <div style="background:#f7f4ef;border-radius:10px;padding:14px 16px;border:1px solid #ede8e0">
        <div style="font-size:10px;color:#aaa;letter-spacing:.1em;margin-bottom:6px">TOTAL UNITS</div>
        <div style="font-size:28px;font-weight:700;color:#111">${summary.totalQuantity.toLocaleString()}</div>
      </div>
      <div style="background:#1a1a1f;border-radius:10px;padding:14px 16px;grid-column:span 2">
        <div style="font-size:10px;color:#6a6a80;letter-spacing:.1em;margin-bottom:6px">INVENTORY VALUE</div>
        <div style="font-size:28px;font-weight:700;color:#c9a84c">${summary.totalInventoryValue}</div>
      </div>
    </div>

    <div style="display:flex;gap:10px;margin-bottom:24px">
      <div style="flex:1;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:22px;font-weight:700;color:#ef4444">${summary.outOfStockCount}</div>
        <div style="font-size:10px;color:#ef4444;letter-spacing:.08em;margin-top:2px">OUT OF STOCK</div>
      </div>
      <div style="flex:1;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:22px;font-weight:700;color:#d97706">${summary.lowStockCount}</div>
        <div style="font-size:10px;color:#d97706;letter-spacing:.08em;margin-top:2px">LOW STOCK</div>
      </div>
    </div>

    <div style="font-size:11px;font-weight:700;color:#555;letter-spacing:.1em;margin-bottom:12px">TOP CRITICAL ITEMS</div>

    <div style="display:grid;grid-template-columns:1fr 80px 70px 90px;font-size:10px;color:#aaa;letter-spacing:.08em;padding:0 0 8px;border-bottom:2px solid #111">
      <span>ITEM</span>
      <span style="text-align:right">STOCK</span>
      <span style="text-align:right">MIN</span>
      <span style="text-align:right">STATUS</span>
    </div>

    ${rowsHtml}

    <div style="margin-top:20px;font-size:11px;color:#aaa;line-height:1.7;border-top:1px solid #f0ebe3;padding-top:16px">
      This report is generated automatically 3× daily at 06:30, 09:30 and 13:30 to support purchasing and operations decisions.
    </div>

  </div>

  <div style="background:#f7f4ef;border-radius:0 0 16px 16px;padding:14px 28px;border:1px solid #e8e2d9;border-top:none;display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:10px;color:#bbb;letter-spacing:.08em">${businessName.toUpperCase()} · NDOLA</div>
    <div style="font-size:10px;color:#bbb">Automated notification</div>
  </div>

</div>
</body>
</html>`;
}

function buildStockAlertHTML(products: LowStockProduct[], businessName: string): string {
  const time = new Date().toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const outItems = products.filter(p => p.is_out_of_stock);
  const lowItems = products.filter(p => !p.is_out_of_stock);
  const totalItems = products.length;

  const outSection = outItems.length ? `
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px;margin-bottom:14px">
      <div style="font-size:10px;font-weight:700;color:#ef4444;letter-spacing:.12em;margin-bottom:12px">OUT OF STOCK</div>
      ${outItems.map((p, idx) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;${idx < outItems.length - 1 ? 'border-bottom:1px solid #fee2e2' : ''}">
          <div>
            <div style="font-size:13px;font-weight:600;color:#222">${p.name}</div>
            <div style="font-size:11px;color:#f87171;margin-top:2px">Min. stock: ${p.minimum_stock}</div>
          </div>
          <div style="background:#ef4444;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px">0</div>
        </div>
      `).join('')}
    </div>
  ` : '';

  const lowSection = lowItems.length ? `
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px">
      <div style="font-size:10px;font-weight:700;color:#d97706;letter-spacing:.12em;margin-bottom:12px">LOW STOCK</div>
      ${lowItems.map((p, idx) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;${idx < lowItems.length - 1 ? 'border-bottom:1px solid #fef3c7' : ''}">
          <div>
            <div style="font-size:13px;font-weight:600;color:#222">${p.name}</div>
            <div style="font-size:11px;color:#d97706;margin-top:2px">Min. ${p.minimum_stock} · ${p.stock_quantity} remaining</div>
          </div>
          <div style="background:#fef3c7;border:1px solid #fde68a;color:#92400e;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px">${p.stock_quantity}</div>
        </div>
      `).join('')}
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>Stock Alert</title></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f0ede8;padding:32px 16px;margin:0">
<div style="max-width:480px;margin:0 auto">

  <div style="background:#1a1a1f;border-radius:16px 16px 0 0;padding:22px 28px;display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="font-size:18px;font-weight:700;color:#c9a84c;letter-spacing:.04em">${businessName.toUpperCase()}</div>
      <div style="font-size:10px;color:#6a6a80;letter-spacing:.14em;margin-top:3px;font-weight:500">STOCK ALERT</div>
    </div>
    <div style="background:#ef4444;color:#fff;font-size:9px;font-weight:700;letter-spacing:.12em;padding:5px 12px;border-radius:999px">ACTION REQUIRED</div>
  </div>

  <div style="background:#fff;padding:28px;border-left:1px solid #e8e2d9;border-right:1px solid #e8e2d9">

    <div style="font-size:22px;font-weight:700;color:#111;margin-bottom:6px">Stock Alert</div>
    <div style="font-size:12px;color:#888;margin-bottom:24px">${time} · ${totalItems} item${totalItems > 1 ? 's' : ''} need attention</div>

    ${outSection}
    ${lowSection}

    <div style="margin-top:20px;background:#1a1a1f;border-radius:10px;padding:14px 16px;font-size:12px;color:#c9a84c;line-height:1.6">
      ⚡ Reorder immediately to avoid service disruption. Contact your supplier or update stock via the Great Olive dashboard.
    </div>

  </div>

  <div style="background:#f7f4ef;border-radius:0 0 16px 16px;padding:14px 28px;border:1px solid #e8e2d9;border-top:none;display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:10px;color:#bbb;letter-spacing:.08em">${businessName.toUpperCase()} · LUSAKA</div>
    <div style="font-size:10px;color:#bbb">Automated notification</div>
  </div>

</div>
</body>
</html>`;
}

/* ══════════════════════════════════════════════════════════════════════════
 * Public notify() entry-points
 * ══════════════════════════════════════════════════════════════════════════ */

export interface EmailBody {
  subject:        string;
  eventType:      string;
  product?:       string;
  businessName?:  string;
  changes?:       ChangeLine[];
  totals?:        { label: string; value: number };
  subtotal?:      number;
  tax?:           { percent: number; amount: number };
  paymentMethod?: string;
  note?:          string;
  currency?:      string;
}

interface ChangeLine {
  name:      string;
  qty:       number;
  unitPrice: string;
  lineTotal: string;
}

/** Core async sender with role-based multi-recipient support */
async function sendEmail(
  subject: string,
  body: string,
  settings: EmailSettings,
  recipients?: string[],
): Promise<boolean> {
  const toList = recipients && recipients.length > 0 
    ? recipients 
    : [];
  if (toList.length === 0) {
    console.warn('[Notification] No configured recipients; skipping send');
    return false;
  }

  const primaryTo = toList[0];
  const bccList = toList.slice(1);

  const fromName = 'Great Olive Notifications';
  const fromAddr = settings.smtpUser || 'afcodenet@gmail.com'; // SMTP sender ONLY

  try {
    const transporter = await getTransporter(settings);

    const mailOpts: any = {
      from: `"${fromName}" <${fromAddr}>`,
      to: primaryTo,
      subject,
      html: body,
    };

    if (bccList.length > 0) {
      mailOpts.bcc = bccList;
    }

    const info: any = await transporter.sendMail(mailOpts);
    console.log(`[Notification] ✓ "${subject}" → ${toList.join(', ')}  msg-id=${info.messageId}`);
    
    if (settings.emailProvider === 'ethereal' || transporter.options?.host?.includes('ethereal.email')) {
      console.log(`[Notification]   Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }
    return true;
  } catch (err: any) {
    console.error('[Notification] ✗ send error:', err.message);
    return false;
  }
}

export async function sendEmailDirect(
  subject: string,
  body: string,
  settingsRaw: SettingsReader = {},
  to: string,
  bcc?: string,
): Promise<boolean> {
  const settings = readEmailSettings(settingsRaw);
  if (!settings.emailNotificationsEnabled) return false;

  const fromName = 'Great Olive Notifications';
  const fromAddr = settings.smtpUser || 'afcodenet@gmail.com';

  try {
    const transporter = await getTransporter(settings);
    const mailOpts: any = {
      from: `"${fromName}" <${fromAddr}>`,
      to,
      subject,
      html: body,
    };
    if (bcc) mailOpts.bcc = bcc;
    const info: any = await transporter.sendMail(mailOpts);
    console.log(`[Notification] ✓ "${subject}" → ${to}  msg-id=${info.messageId}`);
    return true;
  } catch (err: any) {
    console.error(`[Notification] ✗ send error to ${to}:`, err.message);
    return false;
  }
}

/* ── Low-stock / out-of-stock helpers ─────────────────────────────── */

export interface LowStockProduct {
  name:          string;
  stock_quantity: number;
  minimum_stock:  number;
  is_out_of_stock: boolean;
}

export async function notifyLowStockAlert(
  products: LowStockProduct[],
  settingsRaw: SettingsReader,
): Promise<void> {
  const s = readEmailSettings(settingsRaw);
  if (!s.emailNotificationsEnabled) return;

  const outOfStock = products.filter(p => p.is_out_of_stock);
  const lowStock   = products.filter(p => !p.is_out_of_stock);

  const outOfStockHTML = outOfStock.length ? `
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px;margin-bottom:14px">
      <div style="font-size:10px;font-weight:700;color:#ef4444;letter-spacing:.12em;margin-bottom:12px">OUT OF STOCK</div>
      ${outOfStock.map(p => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #fee2e2">
          <div>
            <div style="font-size:13px;font-weight:600;color:#222">${p.name}</div>
            <div style="font-size:11px;color:#f87171;margin-top:2px">Min. stock: ${p.minimum_stock}</div>
          </div>
          <div style="background:#ef4444;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px">0</div>
        </div>
      `).join('')}
    </div>` : '';

  const lowStockHTML = lowStock.length ? `
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px">
      <div style="font-size:10px;font-weight:700;color:#d97706;letter-spacing:.12em;margin-bottom:12px">LOW STOCK</div>
      ${lowStock.map(p => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #fef3c7">
          <div>
            <div style="font-size:13px;font-weight:600;color:#222">${p.name}</div>
            <div style="font-size:11px;color:#d97706;margin-top:2px">Min. ${p.minimum_stock} · ${p.stock_quantity} remaining</div>
          </div>
          <div style="background:#fef3c7;border:1px solid #fde68a;color:#92400e;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px">${p.stock_quantity}</div>
        </div>
      `).join('')}
    </div>` : '';

  const emailHTML = `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f0ede8;padding:32px 16px">
    <div style="max-width:480px;margin:0 auto">

      <!-- Header -->
      <div style="background:#1a1a1f;border-radius:16px 16px 0 0;padding:22px 28px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:18px;font-weight:700;color:#c9a84c;letter-spacing:.04em">GREAT OLIVE</div>
          <div style="font-size:10px;color:#6a6a80;letter-spacing:.14em;margin-top:3px;font-weight:500">STOCK ALERT</div>
        </div>
        <div style="background:#ef4444;color:#fff;font-size:9px;font-weight:700;letter-spacing:.12em;padding:5px 12px;border-radius:999px">ACTION REQUIRED</div>
      </div>

      <!-- Body -->
      <div style="background:#fff;padding:28px;border-left:1px solid #e8e2d9;border-right:1px solid #e8e2d9">

        <div style="font-size:22px;font-weight:700;color:#111;margin-bottom:6px">Stock Alert</div>
        <div style="font-size:12px;color:#888;margin-bottom:24px">${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} • ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })} · ${products.length} item${products.length > 1 ? 's' : ''} need attention</div>

        ${outOfStockHTML}
        ${lowStockHTML}

        <div style="margin-top:20px;background:#1a1a1f;border-radius:10px;padding:14px 16px;font-size:12px;color:#c9a84c;line-height:1.6">
          ⚡ Reorder immediately to avoid service disruption. Contact your supplier or update stock via the Great Olive dashboard.
        </div>

      </div>

      <!-- Footer -->
      <div style="background:#f7f4ef;border-radius:0 0 16px 16px;padding:14px 28px;border:1px solid #e8e2d9;border-top:none;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:10px;color:#bbb;letter-spacing:.08em">GREAT OLIVE · LUSAKA</div>
        <div style="font-size:10px;color:#bbb">Automated notification</div>
      </div>

    </div>
  </div>`;

  await broadcastNotification(
    NOTIFICATION_TYPES.LOW_STOCK,
    `[Great Olive] Stock Alert — ${products.length} item${products.length > 1 ? 's' : ''} need attention`,
    emailHTML,
    settingsRaw,
  );
}

/* ── New Product Notification ──────────────────────────────────────── */
export async function notifyNewProduct(
  productName: string,
  productData: Record<string, any>,
  settingsRaw: SettingsReader = {},
): Promise<void> {
  console.log('[Notification] notifyNewProduct called for:', productName);

  const actualCurrency = asStr(settingsRaw.app_currency, 'USD');

  const html = `
    <div style="font-family: Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #f8f5f0; padding: 32px 24px;">
      <div style="background: #1a1a1f; color: #c9a84c; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
        <h2 style="margin:0; font-size: 20px;">Nouveau Produit Ajouté</h2>
      </div>
      <div style="background: white; padding: 24px; border: 1px solid #e8e2d9;">
        <p><strong>Produit :</strong> ${productName}</p>
        <p><strong>Prix d'achat :</strong> ${productData.buying_price || 0} ${actualCurrency}</p>
        <p><strong>Prix de vente :</strong> ${productData.selling_price} ${actualCurrency}</p>
        <p><strong>Stock initial :</strong> ${productData.stock_quantity || 0} ${productData.unit || 'pcs'}</p>
      </div>
      <div style="background: #f7f4ef; padding: 14px 24px; border-radius: 0 0 12px 12px; font-size: 12px; color: #666;">
        Great Olive • Notification automatique
      </div>
    </div>
  `;

  await broadcastNotification(
    NOTIFICATION_TYPES.NEW_PRODUCT,
    `[Great Olive] Nouveau Produit — ${productName}`,
    html,
    settingsRaw
  );
}

/* ── Stock adjustment helper ──────────────────────────────────────── */

export async function notifyStockAdjustment(
  productName:   string,
  productId:     number,
  qtyBefore:     number,
  qtyChanged:    number,
  qtyAfter:      number,
  reason:        string,
  performedBy:   string | undefined,
  currency:      string | undefined,
  settingsRaw:   SettingsReader,
): Promise<void> {
  const actualCurrency = currency || asStr(settingsRaw.app_currency, 'USD');

  await broadcastNotification(
    NOTIFICATION_TYPES.STOCK_ADJUSTMENT,
    `[Great Olive] Stock Adjusted — ${productName}`,
    buildEmailHTML({
      subject:    `Stock Adjusted — ${productName}`,
      eventType:  'STOCK ADJUSTMENT',
      product:    productName,
      businessName: 'Great Olive',
      changes:    [],
      totals: {
        label: 'STOCK CHANGE',
        value: qtyAfter,
      },
      note: `Previous: ${qtyBefore}\nChange: ${qtyChanged >= 0 ? '+' : ''}${qtyChanged}\nCurrent: ${qtyAfter}\nReason: ${reason}${performedBy ? `\nPerformed by: ${performedBy}` : ''}`,
      currency: actualCurrency,
    }),
    settingsRaw,
  );
}

export async function loadRawSettingsAsync(): Promise<SettingsReader> {
  const tenantId = getCurrentTenantId();
  if (!db) {
    try {
      const { getSupabaseClient } = require('../database/supabase.client');
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from('settings').select('key, value').eq('tenant_id', tenantId);
      if (error) throw error;
      return (data || []).reduce((acc: any, row: any) => {
        acc[row.key] = row.value;
        return acc;
      }, {} as SettingsReader);
    } catch (e) {
      console.warn('[Notification] Failed to load settings from Supabase, using defaults', e);
      return {};
    }
  }
  const rows = db.prepare('SELECT key, value FROM settings WHERE tenant_id = ?').all(tenantId) as Array<{ key: string; value: string }>;
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {} as SettingsReader);
}

export function loadRawSettings(): SettingsReader {
  const tenantId = getCurrentTenantId();
  if (!db) {
    return {}; // Synchronous version returns empty in cloud mode; callers should use loadRawSettingsAsync if possible
  }
  const rows = db.prepare('SELECT key, value FROM settings WHERE tenant_id = ?').all(tenantId) as Array<{ key: string; value: string }>;
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {} as SettingsReader);
}

/** Professional role-based recipient resolver */
function normalizeEmail(email: string): string | null {
  const e = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!e || !e.includes('@')) return null;
  return e;
}

/**
 * Resolver DB-driven:
 * - role_notification_config decides which roles are eligible for a given notificationType
 * - the actual email recipients come from `users` table (email + role) — not from emails embedded in settings JSON
 */
function normalizeNotificationTypeKey(type: string): string[] {
  const t = String(type || '').trim();
  if (!t) return [];
  const lower = t.toLowerCase();

  // Common variants:
  // - camelCase (orderConfirm)
  // - snake_case (order_confirm)
  // - kebab-case (order-confirm)
  // Also allow the original casing.
  const toSnake = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/-/g, '_');
  const toKebab = (s: string) => s.replace(/_/g, '-');

  const camel = t;
  const snake = toSnake(lower);
  const kebab = toKebab(snake);

  return Array.from(new Set([camel, lower, snake, kebab]));
}

function isNotificationEnabled(roleCfg: any, notificationType: string): boolean {
  if (!roleCfg?.notifications) return false;
  const keysToTry = normalizeNotificationTypeKey(notificationType);

  for (const k of keysToTry) {
    if (roleCfg.notifications[k] === true) return true;
  }
  return false;
}

function getRecipientsForNotification(
  settingsRaw: SettingsReader,
  notificationType: string
): string[] {

  const recipients = new Set<string>();

  try {

    const raw = settingsRaw.role_notification_config;

    if (!raw) {
      console.warn('[Notification] role_notification_config missing');
      return [];
    }

    const config =
      typeof raw === 'string'
        ? JSON.parse(raw)
        : raw;

    // ===== Roles autorisés (normalisation en minuscules pour correspondre à la table users) =====
    const allowedRoles: string[] = [];

    Object.entries(config).forEach(([role, roleCfg]: any) => {

      const enabled =
        roleCfg?.notifications?.[notificationType] === true;

      if (enabled) {
        allowedRoles.push(role.toLowerCase());   // ← normalisation importante
      }

    });

    if (!allowedRoles.length) {
      console.warn(
        `[Notification] No roles have ${notificationType} enabled in role_notification_config`
      );
      return [];
    }

    // ===== Charger emails depuis users =====

    const placeholders =
      allowedRoles.map(() => '?').join(',');

    const tenantId = getCurrentTenantId();

    const users = db.prepare(`
      SELECT email, role
      FROM users
      WHERE LOWER(role) IN (${placeholders})
        AND email IS NOT NULL
        AND TRIM(email) != ''
        AND is_active = 1
        AND tenant_id = ?
    `).all(...allowedRoles, tenantId) as Array<{
      email: string;
      role: string;
    }>;

    for (const user of users) {

      const normalized =
        normalizeEmail(user.email);

      if (normalized) {
        recipients.add(normalized);
      }

    }

    if (allowedRoles.length > 0 && recipients.size === 0) {
      console.warn(
        `[Notification] Roles ${allowedRoles.join(', ')} have ${notificationType} enabled, but no active users with valid email were found in 'users' table`
      );
    }

    console.log('==============================');
    console.log('[Notification] TYPE:', notificationType);
    console.log('[Notification] ROLES (normalized):', allowedRoles);
    console.log('[Notification] USERS FOUND:', users.length);
    console.log('[Notification] RECIPIENTS:', [...recipients]);
    console.log('==============================');

    return [...recipients];

  } catch (err) {

    console.error(
      '[Notification] getRecipientsForNotification failed',
      err
    );

    return [];
  }
}


/**
 * Modèle de diffusion (Broadcast Pattern)
 * Diffuse une notification uniquement aux destinataires dont le type
 * est activé dans role_notification_config (lu depuis la table settings en BD).
 */
export async function broadcastNotification(
  notificationType: string,
  subject: string,
  htmlBody: string,
  settingsRaw: SettingsReader,
): Promise<void> {
  // Ensure we don't accidentally use default email settings when caller passes an empty object.
  const effectiveSettingsRaw =
    settingsRaw && Object.keys(settingsRaw).length > 0 ? settingsRaw : loadRawSettings();

  const s = readEmailSettings(effectiveSettingsRaw);
  if (!s.emailNotificationsEnabled) {
    console.log('[Notification] emailNotificationsEnabled=false; skipping all');
    return;
  }

  console.log('================================');
  console.log('[Notification] TYPE:', notificationType);
  const recipients = getRecipientsForNotification(effectiveSettingsRaw, notificationType);
  console.log('[Notification] RECIPIENTS:', recipients);
  console.log('[Notification] SETTINGS:', effectiveSettingsRaw.role_notification_config);
  console.log('================================');

  if (!recipients.length) {
    console.warn(
      `[Notification] No recipients for type "${notificationType}"`
    );
    return;
  }

  await sendEmail(subject, htmlBody, s, recipients);
}

function msUntilNextRun(hour: number, minute: number): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

async function notifyInventorySummary(settingsRaw: SettingsReader): Promise<void> {
  const s = readEmailSettings(settingsRaw);
  if (!s.emailNotificationsEnabled) return;

  const currency = asStr(settingsRaw.app_currency, 'USD');
  const businessName = asStr(settingsRaw.app_name, 'Great Olive');

  const tenantId = getCurrentTenantId();

  const rows = db.prepare(`
    SELECT id, name, stock_quantity, minimum_stock, unit, buying_price
    FROM products
    WHERE is_available = 1 AND tenant_id = ?
  `).all(tenantId) as Array<{
    name: string;
    stock_quantity: number;
    minimum_stock: number;
    unit: string;
    buying_price: number;
  }>;

  const totalProducts = rows.length;
  const totalQuantity = rows.reduce((sum, item) => sum + Number(item.stock_quantity || 0), 0);
  const totalInventoryValue = rows.reduce((sum, item) => sum + (Number(item.stock_quantity || 0) * Number(item.buying_price || 0)), 0);

  const lowStockItems = rows.filter(item => item.stock_quantity <= item.minimum_stock && item.stock_quantity > 0);
  const outOfStockItems = rows.filter(item => item.stock_quantity === 0);
  const topRiskItems: InventorySummaryItem[] = [...outOfStockItems, ...lowStockItems]
    .sort((a, b) => a.stock_quantity - b.stock_quantity)
    .slice(0, 8)
    .map(item => ({
      name: item.name,
      stock_quantity: item.stock_quantity,
      minimum_stock: item.minimum_stock,
      unit: item.unit || '',
      status: item.stock_quantity === 0 ? 'OUT OF STOCK' : 'LOW STOCK',
    }));

  const generatedAt = new Date().toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });

  const formattedTotalInventoryValue = formatMoneyHtml(totalInventoryValue, currency);

  await sendEmail(
    `[Great Olive] Inventory Summary — ${generatedAt}`,
    buildInventorySummaryHTML({
      generatedAt,
      totalProducts,
      totalInventoryValue: formattedTotalInventoryValue,
      totalQuantity,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      topRiskItems,
      currency,
    }, businessName),
    s,
  );
}

export async function notifyInventoryUpdate(
  eventName: string,
  items: Array<{ name: string; qty: number; unitPrice: number; total?: number | string }>,
  note: string,
  currency = 'USD',
  settingsRaw: SettingsReader = {},
): Promise<void> {
  const actualCurrency = String(currency || asStr(settingsRaw.app_currency, 'USD')).trim().toUpperCase().slice(0, 3) || 'USD';
  const lineItems = items.map(item => {
    const qty = safeMoney(item.qty);
    const unitPrice = safeMoney(item.unitPrice);
    const rawTotal = item.total != null ? item.total : qty * unitPrice;
    const total = Number.isFinite(safeMoney(rawTotal)) ? safeMoney(rawTotal) : qty * unitPrice;
    return { name: item.name, qty, unitPrice, lineTotal: total };
  });

  const subtotal = lineItems.reduce((sum, item) => sum + Number(item.lineTotal), 0);
  const noteSection = note ? `<p style="font-size:13px;color:#555;line-height:1.6;margin:16px 0 0">${note.replace(/\n/g, '<br/>')}</p>` : '';

  const emailHTML = `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f0ede8;padding:32px 16px">
    <div style="max-width:480px;margin:0 auto">
      ${buildHeader('GREAT OLIVE', 'INVENTORY UPDATE')}
      <div style="background:#fff;padding:28px;border-left:1px solid #e8e2d9;border-right:1px solid #e8e2d9">
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
          <tr>
            <td>
              <div style="font-size:22px;font-weight:700;color:#111;letter-spacing:-.02em">${eventName}</div>
              <div style="font-size:12px;color:#888;margin-top:6px">${new Date().toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</div>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px">
          ${lineItems.map(item => `
            <tr>
              <td style="padding:9px 0;border-bottom:1px solid #f4f0eb;font-size:13px;font-weight:600;color:#222">${item.name}</td>
              <td style="padding:9px 0;border-bottom:1px solid #f4f0eb;font-size:11px;color:#aaa;text-align:right">${item.qty} × ${formatMoneyHtml(item.unitPrice, actualCurrency)}</td>
              <td style="padding:9px 0;border-bottom:1px solid #f4f0eb;font-size:13px;font-weight:700;color:#222;text-align:right;min-width:90px">${formatMoneyHtml(item.lineTotal, actualCurrency)}</td>
            </tr>`).join('')}
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-collapse:collapse">
          <tr>
            <td style="font-size:12px;color:#888;padding:5px 0;border-bottom:1px solid #f4f0eb">Subtotal</td>
            <td align="right" style="font-size:12px;color:#888;padding:5px 0;border-bottom:1px solid #f4f0eb;min-width:110px;font-variant-numeric:tabular-nums">${formatMoneyHtml(subtotal, actualCurrency)}</td>
          </tr>
        </table>

        ${noteSection}
      </div>
      ${buildFooter('GREAT OLIVE')}
    </div>
  </div>`;

  await broadcastNotification(
    NOTIFICATION_TYPES.INVENTORY,
    `[Great Olive] Inventory Update — ${eventName}`,
    emailHTML,
    settingsRaw,
  );
}

function scheduleDailyInventorySummary(hour: number, minute: number) {
  const scheduleLabel = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  const delay = msUntilNextRun(hour, minute);
  console.log(`[Notification] Inventory summary scheduled for ${scheduleLabel} (in ${Math.round(delay / 60000)} min)`);

  setTimeout(async () => {
    try {
      await notifyInventorySummary(loadRawSettings());
    } catch (err: any) {
      console.error('[Notification] scheduled inventory summary failed:', err?.message || err);
    } finally {
      scheduleDailyInventorySummary(hour, minute);
    }
  }, delay);
}

export function scheduleInventorySummaryEmails(): void {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
  console.log(`[Notification] Starting inventory summary scheduler (${timezone})`);
  scheduleDailyInventorySummary(6, 30);
  scheduleDailyInventorySummary(9, 30);
  scheduleDailyInventorySummary(13, 30);
}

/* ── Sale / checkout helper ───────────────────────────────────────── */

export async function notifySale(
  invoiceNumber: string,
  items: Array<{ name: string; qty: number; unitPrice: number; total?: number | string }>,
  grandTotal: number,
  paymentMethod: string,
  tableLabel: string,
  waiterName?: string,
  cashierName?: string,
  currency = 'USD',
  settingsRaw: SettingsReader = {},
): Promise<void> {
  const invoiceDigits = String(invoiceNumber || '').replace(/\D/g, '');
  const invoiceDisplay = invoiceDigits ? invoiceDigits.slice(-6) : String(invoiceNumber).slice(0, 6);

  const actualCurrency = String(currency || asStr(settingsRaw.app_currency, 'USD')).trim().toUpperCase().slice(0, 3) || 'USD';
  const now = new Date();
  const day = now.getDate();
  const month = now.toLocaleString('en-US', { month: 'short' });
  const year = now.getFullYear();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const formattedDateTime = `${day} ${month} ${year} • ${timeStr}`;

  const lineData = items.map(item => {
    const qty = safeMoney(item.qty);
    const unitPrice = safeMoney(item.unitPrice);
    const rawTotal = item.total != null ? item.total : qty * unitPrice;
    const total = Number.isFinite(safeMoney(rawTotal))
      ? safeMoney(rawTotal)
      : Number.isFinite(qty * unitPrice)
        ? qty * unitPrice
        : 0;
    return { name: item.name, qty, unitPrice, total };
  });

  const subtotalCalc = lineData.reduce((sum, i) => {
    const t = safeMoney(i.total);
    return sum + (Number.isFinite(t) ? t : 0);
  }, 0);

  const safeGrand = Number.isFinite(safeMoney(grandTotal)) ? safeMoney(grandTotal) : subtotalCalc;
  const rawTax = safeGrand - subtotalCalc;
  const taxAmount = Number.isFinite(rawTax) ? rawTax : 0;
  const paymentLabel = String(paymentMethod || 'CASH').toUpperCase();

  const lineRows = lineData.map(item => `
    <tr>
      <td style="padding:9px 0;border-bottom:1px solid #f4f0eb;font-size:13px;font-weight:600;color:#222">${item.name}</td>
      <td style="padding:9px 0;border-bottom:1px solid #f4f0eb;font-size:11px;color:#aaa;text-align:right">${item.qty} × ${formatMoneyHtml(item.unitPrice, actualCurrency)}</td>
      <td style="padding:9px 0;border-bottom:1px solid #f4f0eb;font-size:13px;font-weight:700;color:#222;text-align:right;min-width:90px">${formatMoneyHtml(item.total, actualCurrency)}</td>
    </tr>`).join('');

  const emailHTML = `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f0ede8;padding:32px 16px">
    <div style="max-width:480px;margin:0 auto">

      ${buildHeader('GREAT OLIVE', 'SALE')}

      <div style="background:#fff;padding:28px;border-left:1px solid #e8e2d9;border-right:1px solid #e8e2d9">

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
          <tr>
            <td>
              <div style="font-size:22px;font-weight:700;color:#111;letter-spacing:-.02em">Invoice #${invoiceDisplay}</div>
              <div style="font-size:12px;color:#888;margin-top:6px">${formattedDateTime}</div>
            </td>
            <td align="right" style="padding-left:20px">
              <div style="font-size:9px;color:#888;letter-spacing:.1em;margin-bottom:4px">TABLE</div>
              <div style="font-size:18px;font-weight:700;color:#111;letter-spacing:-.01em">${tableLabel}</div>
            </td>
          </tr>
        </table>

        <div style="height:1px;background:linear-gradient(to right,#e8e2d9,#c9a84c40,#e8e2d9);margin-bottom:20px"></div>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px">
          ${lineRows}
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-collapse:collapse">
          <tr>
            <td style="font-size:12px;color:#888;padding:5px 0;border-bottom:1px solid #f4f0eb">Subtotal</td>
            <td align="right" style="font-size:12px;color:#888;padding:5px 0;border-bottom:1px solid #f4f0eb;min-width:110px;font-variant-numeric:tabular-nums">${formatMoneyHtml(subtotalCalc, actualCurrency)}</td>
          </tr>
          <tr>
            <td style="font-size:12px;color:#888;padding:5px 0">VAT / Tax</td>
            <td align="right" style="font-size:12px;color:#888;padding:5px 0;min-width:110px;font-variant-numeric:tabular-nums">${formatMoneyHtml(taxAmount, actualCurrency)}</td>
          </tr>
        </table>

        <div style="background:#1a1a1f;border-radius:10px;padding:14px 16px;margin-top:14px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:10px;color:#6a6a80;letter-spacing:.1em;margin-bottom:2px">TOTAL PAID</div>
            <div style="font-size:10px;color:#6a6a80;letter-spacing:.05em">${paymentLabel}</div>
          </div>
          <div style="font-size:26px;font-weight:700;color:#c9a84c;letter-spacing:-.02em; margin-left: 90px">${formatMoneyHtml(safeGrand, actualCurrency)}</div>
        </div>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px">
          <tr>
            <td width="50%" style="padding-right:10px">
              <div style="background:#faf9f7;border-radius:8px;padding:12px;border:1px solid #ede8e0">
                <div style="font-size:10px;color:#aaa;letter-spacing:.1em;margin-bottom:4px">WAITER</div>
                <div style="font-size:13px;font-weight:600;color:#333">${waiterName || '—'}</div>
              </div>
            </td>
            <td width="50%" style="padding-left:10px">
              <div style="background:#faf9f7;border-radius:8px;padding:12px;border:1px solid #ede8e0">
                <div style="font-size:10px;color:#aaa;letter-spacing:.1em;margin-bottom:4px">CASHIER</div>
                <div style="font-size:13px;font-weight:600;color:#333">${cashierName || '—'}</div>
              </div>
            </td>
          </tr>
        </table>

      </div>

      ${buildFooter('GREAT OLIVE')}

    </div>
  </div>`;

  await broadcastNotification(
    NOTIFICATION_TYPES.SALES,
    `[Great Olive] Sale ${invoiceNumber} — ${formatMoneyHtml(safeGrand, actualCurrency)}`,
    emailHTML,
    settingsRaw,
  );
}

export async function notifyOrderCheckout(
  orderId: number,
  items: Array<{ name: string; qty: number; unitPrice: number; total?: number | string }>,
  grandTotal: number,
  paymentMethod: string,
  tableLabel: string,
  waiterName?: string,
  cashierName?: string,
  currency = 'USD',
  settingsRaw: SettingsReader = {},
): Promise<void> {
  const orderDisplay = String(orderId).slice(-6);
  const actualCurrency = String(currency || asStr(settingsRaw.app_currency, 'USD')).trim().toUpperCase().slice(0, 3) || 'USD';
  const now = new Date();
  const day = now.getDate();
  const month = now.toLocaleString('en-US', { month: 'short' });
  const year = now.getFullYear();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const formattedDateTime = `${day} ${month} ${year} • ${timeStr}`;

  const lineData = items.map(item => {
    const qty = safeMoney(item.qty);
    const unitPrice = safeMoney(item.unitPrice);
    const rawTotal = item.total != null ? item.total : qty * unitPrice;
    const total = Number.isFinite(safeMoney(rawTotal))
      ? safeMoney(rawTotal)
      : Number.isFinite(qty * unitPrice)
        ? qty * unitPrice
        : 0;
    return { name: item.name, qty, unitPrice, total };
  });

  const subtotalCalc = lineData.reduce((sum, i) => {
    const t = safeMoney(i.total);
    return sum + (Number.isFinite(t) ? t : 0);
  }, 0);

  const safeGrand = Number.isFinite(safeMoney(grandTotal)) ? safeMoney(grandTotal) : subtotalCalc;
  const rawTax = safeGrand - subtotalCalc;
  const taxAmount = Number.isFinite(rawTax) ? rawTax : 0;
  const paymentLabel = String(paymentMethod || 'CASH').toUpperCase();

  const lineRows = lineData.map(item => `
    <tr>
      <td style="padding:9px 0;border-bottom:1px solid #f4f0eb;font-size:13px;font-weight:600;color:#222">${item.name}</td>
      <td style="padding:9px 0;border-bottom:1px solid #f4f0eb;font-size:11px;color:#aaa;text-align:right">${item.qty} × ${formatMoneyHtml(item.unitPrice, actualCurrency)}</td>
      <td style="padding:9px 0;border-bottom:1px solid #f4f0eb;font-size:13px;font-weight:700;color:#222;text-align:right;min-width:90px">${formatMoneyHtml(item.total, actualCurrency)}</td>
    </tr>`).join('');

  const emailHTML = `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f0ede8;padding:32px 16px">
    <div style="max-width:480px;margin:0 auto">

      ${buildHeader('GREAT OLIVE', 'ORDER CHECKOUT')}

      <div style="background:#fff;padding:28px;border-left:1px solid #e8e2d9;border-right:1px solid #e8e2d9">

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
          <tr>
            <td>
              <div style="font-size:22px;font-weight:700;color:#111;letter-spacing:-.02em">Order #${orderDisplay}</div>
              <div style="font-size:12px;color:#888;margin-top:6px">${formattedDateTime}</div>
            </td>
            <td align="right" style="padding-left:20px">
              <div style="font-size:9px;color:#888;letter-spacing:.1em;margin-bottom:4px">TABLE</div>
              <div style="font-size:18px;font-weight:700;color:#111;letter-spacing:-.01em">${tableLabel}</div>
            </td>
          </tr>
        </table>

        <div style="height:1px;background:linear-gradient(to right,#e8e2d9,#c9a84c40,#e8e2d9);margin-bottom:20px"></div>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px">
          ${lineRows}
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-collapse:collapse">
          <tr>
            <td style="font-size:12px;color:#888;padding:5px 0;border-bottom:1px solid #f4f0eb">Subtotal</td>
            <td align="right" style="font-size:12px;color:#888;padding:5px 0;border-bottom:1px solid #f4f0eb;min-width:110px;font-variant-numeric:tabular-nums">${formatMoneyHtml(subtotalCalc, actualCurrency)}</td>
          </tr>
          <tr>
            <td style="font-size:12px;color:#888;padding:5px 0">VAT / Tax</td>
            <td align="right" style="font-size:12px;color:#888;padding:5px 0;min-width:110px;font-variant-numeric:tabular-nums">${formatMoneyHtml(taxAmount, actualCurrency)}</td>
          </tr>
        </table>

        <div style="background:#1a1a1f;border-radius:10px;padding:14px 16px;margin-top:14px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:10px;color:#6a6a80;letter-spacing:.1em;margin-bottom:2px">TOTAL PAID</div>
            <div style="font-size:10px;color:#6a6a80;letter-spacing:.05em">${paymentLabel}</div>
          </div>
          <div style="font-size:26px;font-weight:700;color:#c9a84c;letter-spacing:-.02em; margin-left: 90px">${formatMoneyHtml(safeGrand, actualCurrency)}</div>
        </div>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px">
          <tr>
            <td width="50%" style="padding-right:10px">
              <div style="background:#faf9f7;border-radius:8px;padding:12px;border:1px solid #ede8e0">
                <div style="font-size:10px;color:#aaa;letter-spacing:.1em;margin-bottom:4px">WAITER</div>
                <div style="font-size:13px;font-weight:600;color:#333">${waiterName || '—'}</div>
              </div>
            </td>
            <td width="50%" style="padding-left:10px">
              <div style="background:#faf9f7;border-radius:8px;padding:12px;border:1px solid #ede8e0">
                <div style="font-size:10px;color:#aaa;letter-spacing:.1em;margin-bottom:4px">CASHIER</div>
                <div style="font-size:13px;font-weight:600;color:#333">${cashierName || '—'}</div>
              </div>
            </td>
          </tr>
        </table>

      </div>

      ${buildFooter('GREAT OLIVE')}

    </div>
  </div>`;

  await broadcastNotification(
    NOTIFICATION_TYPES.ORDER_CONFIRM,
    `[Great Olive] Order Checkout #${orderDisplay} — ${formatMoneyHtml(safeGrand, actualCurrency)}`,
    emailHTML,
    settingsRaw,
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Stock movement notifications (per inventory_movements row)
 * ────────────────────────────────────────────────────────────────────────── */

export interface StockMovementEmailRow {
  id: number;
  product_id: number;
  product_name: string;
  movement_type: string | null;
  quantity_before: number | null;
  quantity_changed: number | null;
  quantity_after: number | null;
  unit_cost: number | null;
  total_value: number | null;
  reason: string | null;
  created_by: number | null;
  created_at: string | null;
  movement_code: string | null;
  reference_type: string | null;
  inventory_session_id: number | null;
}

/**
 * Sends an email for a single inventory movement.
 * This is used by the polling scheduler (see scheduleStockMovementEmails()).
 */
export async function notifyStockMovement(
  movement: StockMovementEmailRow,
  settingsRaw: SettingsReader = {},
): Promise<void> {
  const currency = asStr(settingsRaw.app_currency, 'USD');
  const actualCurrency = String(currency || 'USD').trim().toUpperCase().slice(0, 3) || 'USD';

  const createdAt = movement.created_at ? new Date(movement.created_at) : new Date();
  const formattedDateTime = createdAt.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const movementCode = movement.movement_code ? String(movement.movement_code) : `MOV-${movement.id}`;
  const eventType = String(movement.movement_type || movement.reference_type || 'STOCK MOVEMENT').toUpperCase();
  const reason = movement.reason ? String(movement.reason) : '—';

  const qtyBefore = safeMoney(movement.quantity_before);
  const qtyChanged = safeMoney(movement.quantity_changed);
  const qtyAfter = safeMoney(movement.quantity_after);

  const directionBadge = qtyChanged >= 0
    ? `<span style="background:#dcfce7;border:1px solid #bbf7d0;color:#166534;font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px">INCREASE</span>`
    : `<span style="background:#fee2e2;border:1px solid #fecaca;color:#991b1b;font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px">DECREASE</span>`;

  const unitCost = movement.unit_cost ?? 0;
  const totalValue = movement.total_value ?? (Math.abs(qtyChanged) * (safeMoney(unitCost) || 0));

  const emailHTML = `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f0ede8;padding:32px 16px">
    <div style="max-width:480px;margin:0 auto">

      ${buildHeader('GREAT OLIVE', 'STOCK MOVEMENT')}

      <div style="background:#fff;padding:28px;border-left:1px solid #e8e2d9;border-right:1px solid #e8e2d9">

        <div style="font-size:22px;font-weight:700;color:#111;letter-spacing:-.02em;margin-bottom:4px">
          ${eventType}
        </div>
        <div style="font-size:12px;color:#888;margin-top:6px;margin-bottom:18px">
          ${formattedDateTime} · <span style="font-weight:700;color:#111">${movementCode}</span>
        </div>

        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:18px">
          <div style="flex:1">
            <div style="font-size:10px;color:#6a6a80;letter-spacing:.1em;margin-bottom:6px">PRODUCT</div>
            <div style="font-size:16px;font-weight:700;color:#111">${movement.product_name || `#${movement.product_id}`}</div>
          </div>
          <div>${directionBadge}</div>
        </div>

        <div style="background:#f7f4ef;border:1px solid #ede8e0;border-radius:10px;padding:16px;margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;margin-bottom:10px">
            <div>
              <div style="font-size:10px;color:#aaa;letter-spacing:.1em;margin-bottom:4px">BEFORE</div>
              <div style="font-size:18px;font-weight:800;color:#111">${qtyBefore}</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:10px;color:#aaa;letter-spacing:.1em;margin-bottom:4px">CHANGE</div>
              <div style="font-size:18px;font-weight:800;color:#111">${qtyChanged >= 0 ? '+' : ''}${qtyChanged}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:10px;color:#aaa;letter-spacing:.1em;margin-bottom:4px">AFTER</div>
              <div style="font-size:18px;font-weight:800;color:#111">${qtyAfter}</div>
            </div>
          </div>

          <div style="height:1px;background:linear-gradient(to right,#e8e2d9,#c9a84c40,#e8e2d9);margin:10px 0"></div>

          <div style="font-size:12px;color:#888;line-height:1.6">
            <div><span style="font-weight:700;color:#111">Reason:</span> ${reason}</div>
            <div><span style="font-weight:700;color:#111">Unit cost:</span> ${formatMoneyHtml(unitCost, actualCurrency)}</div>
            <div><span style="font-weight:700;color:#111">Total value:</span> ${formatMoneyHtml(totalValue, actualCurrency)}</div>
          </div>
        </div>

        <div style="font-size:12px;color:#555;line-height:1.6">
          Reference:
          <span style="font-weight:700;color:#111">${movement.reference_type || '—'}</span>
          ${movement.inventory_session_id ? ` · Session #${movement.inventory_session_id}` : ''}
        </div>

      </div>

      ${buildFooter('GREAT OLIVE')}

    </div>
  </div>`;

   await broadcastNotification(
    NOTIFICATION_TYPES.STOCK_ADJUSTMENT,
    `[Great Olive] Stock Movement — ${movement.product_name} (${movementCode})`,
    emailHTML,
    settingsRaw,
  );
}

function getSettingsValueAsNumber(raw: SettingsReader, key: string, def: number): number {
  const v = raw[key];
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : def;
}

function persistSettingsValue(key: string, value: string | number | boolean): void {
  // Persist into settings as text
  const v = String(value);
  const tenantId = getCurrentTenantId();
  const existing = db.prepare('SELECT key FROM settings WHERE key = ? AND tenant_id = ?').get(key, tenantId) as any;
  if (existing) {
    db.prepare('UPDATE settings SET value = ? WHERE key = ? AND tenant_id = ?').run(v, key, tenantId);
  } else {
    db.prepare('INSERT INTO settings (key, value, tenant_id) VALUES (?, ?, ?)').run(key, v, tenantId);
  }
}

export function scheduleStockMovementEmails(): void {
  const intervalMs = Math.max(10_000, Number(process.env.STOCK_MOVEMENT_EMAIL_POLL_MS || 30_000));

  console.log(`[Notification] Stock movement email scheduler started (poll ${intervalMs}ms)`);

  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const settingsRaw = loadRawSettings();
      const s = readEmailSettings(settingsRaw);

      if (!s.emailNotificationsEnabled) {
        return;
      }

      const lastNotified = getSettingsValueAsNumber(settingsRaw, 'last_stock_movement_email_id', 0);

      const tenantId = getCurrentTenantId();

      // Load next confirmed movements
      // Note: inventory_movements already contains quantity_before/changed/after in your schema.
      const rows = db.prepare(`
        SELECT
          m.id,
          m.product_id,
          p.name AS product_name,
          m.movement_type,
          m.quantity_before,
          m.quantity_changed,
          m.quantity_after,
          m.unit_cost,
          m.total_value,
          m.reason,
          m.created_by,
          m.created_at,
          m.movement_code,
          m.reference_type,
          m.inventory_session_id
        FROM inventory_movements m
        LEFT JOIN products p ON p.id = m.product_id
        WHERE m.status = 'confirmed'
          AND m.id > ?
          AND m.tenant_id = ?
        ORDER BY m.id ASC
        LIMIT 50
      `).all(lastNotified, tenantId) as StockMovementEmailRow[];

      if (!rows.length) return;

      let maxId = lastNotified;

      for (const mv of rows) {
        try {
          await notifyStockMovement(mv, settingsRaw);
          if (mv.id > maxId) maxId = mv.id;
        } catch (err: any) {
          console.error('[Notification] Stock movement email failed for id=', mv.id, err?.message || err);
          // Keep going; do not block the queue.
        }
      }

      if (maxId > lastNotified) {
        persistSettingsValue('last_stock_movement_email_id', maxId);
      }
    } catch (err: any) {
      console.error('[Notification] Stock movement scheduler tick error:', err?.message || err);
    } finally {
      running = false;
    }
  };

  // Kick immediately + then interval
  tick();
  setInterval(() => { void tick(); }, intervalMs);
}


// Ok! Très bien.. mais les emails doivent venir des utilisateurs déjà enregistrés dans la BD table users, et les emails doivent être filtrés selon leurs rôles.. pas de saisie manuelle d'email dans l'onglet  Notifications du composant SettingsPage.tsx. 