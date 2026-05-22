import { translations } from '../lib/i18n/translations';
import type { Language } from '../lib/i18n/types';
import { useSettingsStore } from '../stores/useSettingsStore';

function hasLang(obj: unknown, lang: string): obj is Record<string, unknown> {
  return !!obj && typeof obj === 'object' && lang in (obj as Record<string, unknown>);
}

function resolveReceiptKey(lang: Language, key: string): string {
  const ns = (translations as any).pos?.receipt;
  if (!ns) return key;
  const parts = key.split('.');
  let node: any = ns;
  for (const p of parts) {
    if (node && typeof node === 'object' && p in node) node = node[p];
    else return key;
  }
  if (node && typeof node === 'object') {
    if (hasLang(node, lang)) return String(node[lang]);
    if (hasLang(node, 'en')) return String(node['en']);
  }
  return typeof node === 'string' ? node : key;
}

export interface ReceiptData {
  business: {
    name: string;
    address?: string;
    phone?: string;
  };
  invoice: {
    number: string;
    date: string;
    table: string;
    waiter?: string;
    cashier?: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  totals: {
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
  };
  payment: {
    method: string;
    amount: number;
  };
  footer: string;
  currency?: string;
  lang?: string;
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║         PREMIUM ENTERPRISE ESC/POS THERMAL PRINTING ENGINE v2              ║
 * ║         Epson POS · 58mm / 80mm · Luxury Restaurant & Bar Edition          ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ═══════════════════════════════════════════════════════════════════════════════
// ESC/POS COMMAND CONSTANTS - EPSON COMPATIBLE
// ═══════════════════════════════════════════════════════════════════════════════

const ESC = '\x1B';
const GS  = '\x1D';

const INIT            = ESC + '@';
const UTF8            = ESC + 't' + '\x00';
const ALIGN_LEFT      = ESC + 'a' + '\x00';
const ALIGN_CENTER    = ESC + 'a' + '\x01';
const ALIGN_RIGHT     = ESC + 'a' + '\x02';
const FONT_A          = ESC + '!' + '\x00';
const BOLD_ON         = ESC + 'E' + '\x01';
const BOLD_OFF        = ESC + 'E' + '\x00';
const DOUBLE_WIDTH    = ESC + '!' + '\x20';
const DOUBLE_HEIGHT   = ESC + '!' + '\x10';
const DOUBLE_SIZE     = ESC + '!' + '\x30';
const UNDERLINE_ON    = ESC + '-' + '\x01';
const UNDERLINE_OFF   = ESC + '-' + '\x00';
const SCALE_1X        = GS  + '!' + '\x00';
const LINE_SPACING_30 = ESC + '3' + '\x1E';
const DENSITY_HIGH    = GS  + '(' + 'D' + '\x02' + '\x00' + '\x05' + '\x05';
const FEED_LINES      = (n: number) => ESC + 'd' + String.fromCharCode(n);
const CUT_FULL        = GS  + 'V' + '\x00';
const CUT_FULL_FEED   = GS  + 'V' + 'B' + '\x00';
const CUT_PARTIAL_FEED= GS  + 'V' + 'B' + '\x01';

// ═══════════════════════════════════════════════════════════════════════════════
// PRINTER CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

interface PrinterConfig {
  width: number;
  charWidth: number;
  supportsCut: boolean;
  density: 'normal' | 'high';
}

const DEFAULT_CONFIG: PrinterConfig = {
  width: 48,
  charWidth: 48,
  supportsCut: true,
  density: 'high',
};

// ═══════════════════════════════════════════════════════════════════════════════
// ESC/POS BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

class ESCPOSBuilder {
  private chunks: Uint8Array[] = [];
  
  private encoder = new TextEncoder();

private push(str: string) {
  this.chunks.push(this.encoder.encode(str));
}

  init(): this {
    this.push(INIT);
    this.push(UTF8);
    this.push(LINE_SPACING_30);
    if (DEFAULT_CONFIG.density === 'high') this.push(DENSITY_HIGH);
    return this;
  }

  align(mode: 'left' | 'center' | 'right'): this {
    this.push(mode === 'center' ? ALIGN_CENTER : mode === 'right' ? ALIGN_RIGHT : ALIGN_LEFT);
    return this;
  }

  font(mode: 'normal' | 'bold' | 'double' | 'double-size' | 'underline'): this {
    switch (mode) {
      case 'bold':        this.push(BOLD_ON); break;
      case 'double':      this.push(DOUBLE_WIDTH + DOUBLE_HEIGHT); break;
      case 'double-size': this.push(DOUBLE_SIZE); break;
      case 'underline':   this.push(UNDERLINE_ON); break;
      default:
        this.push(FONT_A + BOLD_OFF + SCALE_1X + UNDERLINE_OFF);
    }
    return this;
  }

  text(str: string, wrap = false): this {
    if (wrap) {
      const lines = this.wrap(str, DEFAULT_CONFIG.width);
      lines.forEach(l => this.push(l + '\n'));
    } else {
      this.push(str + '\n');
    }
    return this;
  }

  line(char = '─', count?: number): this {
    const w = count || DEFAULT_CONFIG.width;
    this.push(char.repeat(w) + '\n');
    return this;
  }

  feed(lines = 1): this {
    this.push(FEED_LINES(lines));
    return this;
  }

  cut(full = true, feedFirst = true): this {
    if (feedFirst) this.feed(5);
    this.push(full ? CUT_FULL_FEED : CUT_PARTIAL_FEED);
    this.push(CUT_FULL);
    return this;
  }

  columns(cols: Array<{ text: string; width: number; align?: 'left' | 'center' | 'right' }>): this {
    let line = '';
    cols.forEach((col) => {
      const txt = (col.text || '').substring(0, col.width);
      const pad = col.align === 'right' ? txt.padStart(col.width) : col.align === 'center' ? txt.padEnd(col.width).padStart(col.width) : txt.padEnd(col.width);
      line += pad;
    });
    this.push(line.substring(0, DEFAULT_CONFIG.width) + '\n');
    return this;
  }

  private wrap(text: string, max: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).length <= max) {
        cur += (cur ? ' ' : '') + w;
      } else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  }

  build(): Uint8Array {
    const total = this.chunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of this.chunks) { out.set(c, off); off += c.length; }
    return out;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ★  PREMIUM RECEIPT RENDERER  ★  LUXURY RESTAURANT & BAR EDITION
// ═══════════════════════════════════════════════════════════════════════════════

function renderPremiumReceipt(data: ReceiptData, cfg: PrinterConfig = DEFAULT_CONFIG): Uint8Array {
  const b   = new ESCPOSBuilder();
  const w   = cfg.width;
  const currency  = data.currency || '€';
  const lang = (data.lang || 'fr') as Language;
  const tr = (k: string) => resolveReceiptKey(lang, k);

  // Column widths
  const priceW  = 9;
  const qtyW    = 4;
  const totalW  = 11;
  const nameW   = w - qtyW - priceW - totalW - 3;

  // ── HEADER ─────────────────────────────────────────────────────────────────
  b.init()
   .feed(1)
   .align('center');

  // Decorative top border
  b.line('▄', w);
  b.feed(1);

  // Business name — double-size, bold, centered
  b.font('double-size')
   .font('bold')
   .text(data.business.name.toUpperCase())
   .font('normal');

  b.feed(1);

  if (data.business.address) {
    b.align('center').text(data.business.address);
  }
  if (data.business.phone) {
    b.align('center').text(`✆ ${data.business.phone}`);
  }

  b.feed(1)
   .line('▀', w)
   .feed(1);

  // ── INVOICE META ───────────────────────────────────────────────────────────
  const invoiceDate = new Date(data.invoice.date);
  const dateStr = invoiceDate.toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const timeStr = invoiceDate.toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit',
  });

  b.align('left')
   .font('bold')
   .text(`  ${tr('invoice')} ${data.invoice.number}`)
   .font('normal')
   .text(`  ${tr('date')}   : ${dateStr}`)
   .text(`  ${tr('time')}  : ${timeStr}`)
   .text(`  ${tr('table')}  : ${data.invoice.table}`);

  if (data.invoice.waiter) {
    b.text(`  ${tr('waiter')}: ${data.invoice.waiter}`);
  }
  if (data.invoice.cashier) {
    b.text(`  ${tr('cashier')} : ${data.invoice.cashier}`);
  }
  if (data.invoice.cashier) {
    b.text(`  Caisse : ${data.invoice.cashier}`);
  }

  b.feed(1)
   .line('─', w)
   .feed(1);

  // ── ITEMS HEADER ───────────────────────────────────────────────────────────
  b.font('bold')
   .columns([
     { text: tr('itemTotal'),   width: nameW,  align: 'left'  },
     { text: tr('qty'),         width: qtyW,   align: 'center' },
     { text: tr('unitPrice'),   width: priceW, align: 'right' },
     { text: tr('itemTotal'),   width: totalW, align: 'right' },
   ])
   .font('normal')
   .line('┄', w);

  // ── ITEMS ──────────────────────────────────────────────────────────────────
  for (const item of data.items) {
    // Access private wrap via type cast
    const nameLines = (b as any).wrap(item.name, nameW) as string[];

    nameLines.forEach((line: string, idx: number) => {
      if (idx === 0) {
        b.columns([
          { text: line,                          width: nameW,  align: 'left'  },
          { text: item.quantity.toString(),      width: qtyW,   align: 'right' },
          { text: item.unitPrice.toFixed(2),     width: priceW, align: 'right' },
          { text: item.totalPrice.toFixed(2),    width: totalW, align: 'right' },
        ]);
      } else {
        b.columns([{ text: `  ${line}`, width: nameW }]);
      }
    });
  }

  b.feed(1)
   .line('┄', w)
   .feed(1);

  // ── TOTALS ─────────────────────────────────────────────────────────────────
  const labelW = nameW + qtyW + 2;
  const valueW = priceW + totalW;

  b.columns([
    { text: `  ${tr('subtotal')}`, width: labelW, align: 'left'  },
    { text: `${currency} ${data.totals.subtotal.toFixed(2)}`, width: valueW, align: 'right' },
  ]);

  if (data.totals.tax > 0) {
    b.columns([
      { text: `  ${tr('tax')}`, width: labelW, align: 'left'  },
      { text: `${currency} ${data.totals.tax.toFixed(2)}`, width: valueW, align: 'right' },
    ]);
  }

  if (data.totals.discount > 0) {
    b.columns([
      { text: `  ${tr('discount')}`, width: labelW, align: 'left'  },
      { text: `- ${currency} ${data.totals.discount.toFixed(2)}`, width: valueW, align: 'right' },
    ]);
  }

  b.feed(1)
   .line('═', w);

  // TOTAL — bold, prominent
  b.font('bold')
   .columns([
     { text: `  ${tr('grandTotal')}`, width: labelW, align: 'left'  },
     { text: `${currency} ${data.totals.total.toFixed(2)}`, width: valueW, align: 'right' },
   ])
   .font('normal')
   .line('═', w);

  // ── PAYMENT ────────────────────────────────────────────────────────────────
  b.feed(1)
   .align('left')
   .text(`  ${tr('paidMethod')} : ${data.payment.method.toUpperCase()}`)
   .text(`  ${tr('amountPaid')} : ${currency} ${data.payment.amount.toFixed(2)}`);

  if (data.payment.amount > data.totals.total) {
    const changeVal = data.payment.amount - data.totals.total;
    b.font('bold')
     .text(`  ${tr('change')} : ${currency} ${changeVal.toFixed(2)}`)
     .font('normal');
  }

  b.feed(1)
   .line('─', w);

  // ── FOOTER ─────────────────────────────────────────────────────────────────
  b.feed(1)
   .align('center')
   .text(data.footer, true);

  b.feed(1)
   .font('double-size')
   .align('center')
   .text(tr('thankYou'))
   .font('normal');

  b.feed(1)
   .align('center')
   .text('★  ★  ★')
   .line('▀', w)
   .feed(1);

  // ── AUTO-CUT ───────────────────────────────────────────────────────────────
  b.feed(3).cut(true);

  return b.build();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API — UNCHANGED LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

export async function printElectronReceiptESC(
  receipt: ReceiptData,
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const api = (window as any)?.electronAPI;
    if (!api?.printRaw) {
      return resolve({ success: false, error: 'ESC/POS not available' });
    }
    const data = renderPremiumReceipt(receipt);
    api.printRaw(data)
      .then(() => resolve({ success: true }))
      .catch((e: any) => resolve({ success: false, error: e.message }));
  });
}

export async function printWebUSBReceipt(
  _receipt: ReceiptData,
): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'WebUSB fallback disabled in premium mode' };
}

export async function printReceipt(
  receipt: ReceiptData,
  currency?: string,
  lang?: string,
): Promise<{ success: boolean; error?: string }> {
  const settings = useSettingsStore.getState();
  const currentLang = (lang || settings.language || 'en') as string;
  const currentCurrency = currency || settings.currencySymbol || settings.currency || '€';
  console.log('[ReceiptPrinter] Starting receipt printing...', { lang: currentLang, currency: currentCurrency });
  const enriched = { ...receipt, currency: currentCurrency, lang: currentLang };

  const escResult = await printElectronReceiptESC(enriched);
  if (escResult.success) {
    console.log('[ReceiptPrinter] ✓ ESC/POS (printRaw) successful');
    return escResult;
  }

  console.log('[ReceiptPrinter] Trying WebUSB...');
  const usbResult = await printWebUSBReceipt(enriched);
  if (usbResult.success) {
    console.log('[ReceiptPrinter] ✓ WebUSB successful');
    return usbResult;
  }

  console.log('[ReceiptPrinter] Trying legacy Electron printReceipt...');
  const electronResult = await printElectronReceipt(enriched);
  if (electronResult.success) return electronResult;

  console.log('[ReceiptPrinter] Falling back to HTML printing...');
  return await printWebHTMLReceipt(enriched);
}

export async function printElectronReceipt(
  receipt: ReceiptData,
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const electronWindow = (window as any)?.electronAPI;
    if (electronWindow?.printReceipt) {
      electronWindow.printReceipt(receipt)
        .then(() => resolve({ success: true }))
        .catch((error: any) => resolve({ success: false, error: error.message }));
    } else {
      resolve({ success: false, error: 'Electron printReceipt API not available' });
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ★  PREMIUM HTML FALLBACK  ★  Luxury Restaurant & Bar Edition
// ═══════════════════════════════════════════════════════════════════════════════

async function printWebHTMLReceipt(
  receipt: ReceiptData,
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    try {
      const html = generateSimpleHTMLReceipt(receipt);
      const printWindow = window.open('', '_blank', 'width=420,height=700');
      if (!printWindow) {
        resolve({ success: false, error: 'Popup blocked' });
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          setTimeout(() => { printWindow.close(); resolve({ success: true }); }, 500);
        }, 500);
      };
    } catch (error: any) {
      resolve({ success: false, error: error.message });
    }
  });
}

function generateSimpleHTMLReceipt(receipt: ReceiptData): string {
  const currency = receipt.currency || '€';
  const lang = (receipt.lang || 'fr') as Language;
  const tr = (k: string) => resolveReceiptKey(lang, k);
  const change   = receipt.payment.amount > receipt.totals.total
    ? (receipt.payment.amount - receipt.totals.total).toFixed(2)
    : null;

  const invoiceDate = new Date(receipt.invoice.date);
  const dateStr = invoiceDate.toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const timeStr = invoiceDate.toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit',
  });

  const itemsHTML = receipt.items.map(item => `
    <tr class="item-row">
      <td class="item-name">${item.name}</td>
      <td class="item-qty">${item.quantity}</td>
      <td class="item-price">${item.unitPrice.toFixed(2)}</td>
      <td class="item-total">${item.totalPrice.toFixed(2)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ticket — ${receipt.business.name}</title>
  <style>
    /* ── Reset & Base ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --paper:   #faf8f4;
      --ink:     #1a1812;
      --ink-mid: #4a4540;
      --ink-lt:  #8a857e;
      --accent:  #c9a84c;
      --rule:    #d4cfc8;
      --rule-hv: #b0aa9e;
      --width:   90mm;
      --pad:     6mm;
      --mono:    'IBM Plex Mono', 'Courier New', monospace;
      --serif:   'Playfair Display', Georgia, serif;
    }

   @page {
      size: 90mm auto;
      margin: 0;
    }

    html,
    body {
      width: 100%;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      color: #000 !important;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      overflow: hidden;
    }


    body {
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }


    /* RECEIPT */

    .receipt {
      width: 100%;
      max-width: 90mm;
      box-sizing: border-box;

      /* 10% gauche et droite */
      padding-top: 8px;
      padding-bottom: 14px;
      padding-left: 10%;
      padding-right: 10%;

      margin: 0 auto;

      background: #fff !important;
      color: #000 !important;
    }

    /* HEADER */

    .header {
      text-align: center;
      padding-bottom: 10px;
    }

    .business-name {
      font-size: 22px;
      font-weight: 700;
      color: #000 !important;
      letter-spacing: 1px;
      text-transform: uppercase;
      line-height: 1.1;
    }

    .business-sub,
    .business-contact {
      color: #000 !important;
      font-size: 12px;
      font-weight: 700;
      margin-top: 4px;
    }

    /* BLACK BARS */

    .accent-bar,
    .bottom-bar {
      height: 3px;
      background: #000000 !important;
      margin: 8px 0;
    }

    /* DIVIDERS */

    .rule,
    .rule-heavy,
    .rule-double,
    .rule-dashed {
      border: none;
      border-top: 1px solid #000000 !important;
      margin: 10px 0;
    }

    /* META */

    .ticket-badge {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .ticket-label {
      font-size: 11px;
      color: #000 !important;
      font-weight: 900;
    }

    .ticket-number {
      font-size: 18px;
      font-weight: 700;
      color: #000 !important;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .meta-key {
      font-size: 10px;
      color: #000 !important;
      font-weight: 700;
      text-transform: uppercase;
    }

    .meta-val {
      font-size: 11px;
      color: #000 !important;
      font-weight: 600;
    }

    /* TABLE */

    .col-header {
      display: grid;
      grid-template-columns: 1fr 30px 55px 55px;
      gap: 4px;
      font-size: 11px;
      font-weight: 700;
      color: #000 !important;
      margin-bottom: 6px;
    }

    .col-header span {
      text-align: right;
    }

    .col-header span:first-child {
      text-align: left;
    }

    table.items {
      width: 100%;
      border-collapse: collapse;
    }

    .item-row td {
      padding: 8px 0;
      border-bottom: 1px dashed #000000;
    }

    .item-name {
      font-size: 12px;
      font-weight: 700;
      color: #000 !important;
    }

    .item-qty,
    .item-price {
      font-size: 11px;
      font-weight: 700;
      text-align: right;
      color: #000 !important;
    }

    .item-total {
      font-size: 11px;
      font-weight: 700;
      text-align: right;
      color: #000 !important;
    }

    /* TOTALS */

    .total-line,
    .total-grand {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 7px 0;
    }

    .tl-label,
    .tl-value {
      font-size: 12px;
      font-weight: 700;
      color: #000 !important;
    }

    /* TOTAL BOX */

    .total-grand {
      border: 2px solid #000000 !important;
      background: transparent !important;
      padding: 14px 12px;
      margin-top: 12px;
    }

    .total-grand .tg-label,
    .total-grand .tg-value {
      color: #000000 !important;
      font-size: 14px;
      font-weight: 600;
      background: transparent !important;
    }

    /* PAYMENT BOX */

    .payment-block {
      border: 2px solid #000000 !important;
      background: transparent !important;
      padding: 12px;
      margin-top: 14px;
    }

    .payment-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px 0;
    }

    .pr-label {
      color: #000000 !important;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .pr-value {
      color: #000000 !important;
      font-size: 12px;
      font-weight: 700;
    }

    /* FOOTER */

    .footer {
      text-align: center;
      margin-top: 16px;
    }

    .footer-msg {
      font-size: 12px;
      color: #000 !important;
      font-weight: 700;
    }

    .footer-thanks {
      font-size: 14px;
      font-weight: 700;
      color: #000 !important;
      margin-top: 8px;
    }

    .footer-stars {
      color: #000 !important;
      font-size: 12px;
      margin-top: 6px;
    }

    /* PRINT QUALITY */

    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      image-rendering: crisp-edges;
      text-rendering: geometricPrecision;
    }

    /* PRINT */

    @media print {

      html,
      body {
        width: 90mm !important;
        margin: 0 auto !important;
        padding: 0 !important;
        background: #fff !important;
      }

      .receipt {
        width: 100% !important;
        margin: 0 auto !important;
        padding: 8px 10px 14px 10px !important;
      }
    }
  </style>
</head>
<body>
<div class="receipt">

  <!-- Top accent bar -->
  <div class="accent-bar"></div>

  <!-- Header -->
  <div class="header">
    <div class="business-name">${receipt.business.name}</div>
    ${receipt.business.address ? `<div class="business-sub">${receipt.business.address}</div>` : ''}
    ${receipt.business.phone   ? `<div class="business-contact">✆ ${receipt.business.phone}</div>` : ''}
  </div>

  <hr class="rule-heavy">

  <!-- Invoice Meta -->
  <div class="meta-block">
    <div class="ticket-badge">
      <span class="ticket-label">${tr('invoice')}</span>
      <span class="ticket-number">#${receipt.invoice.number.padStart(6, '0')}</span>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <span class="meta-key">${tr('date')}</span>
        <span class="meta-val">${dateStr}</span>
      </div>
      <div class="meta-item">
        <span class="meta-key">${tr('time')}</span>
        <span class="meta-val">${timeStr}</span>
      </div>
      <div class="meta-item">
        <span class="meta-key">${tr('table')}</span>
        <span class="meta-val">${receipt.invoice.table}</span>
      </div>
      ${receipt.invoice.waiter ? `
      <div class="meta-item">
         <span class="meta-key">${tr('waiter')}</span>
        <span class="meta-val">${receipt.invoice.waiter}</span>
      </div>` : ''}
      ${receipt.invoice.cashier ? `
      <div class="meta-item">
        <span class="meta-key">${tr('cashier')}</span>
        <span class="meta-val">${receipt.invoice.cashier}</span>
      </div>` : ''}
    </div>
  </div>

  <hr class="rule">

  <!-- Items -->
  <div class="items-section">
    <div class="col-header">
      <span>${tr('itemTotal')}</span>
      <span>${tr('qty')}</span>
      <span>${tr('unitPrice')}</span>
      <span>${tr('itemTotal')}</span>
    </div>
    <hr class="rule-dashed">
    <table class="items">
      <tbody>${itemsHTML}</tbody>
    </table>
  </div>

  <hr class="rule">

  <!-- Totals -->
  <div class="totals">
    <div class="total-line">
      <span class="tl-label">${tr('subtotal')}</span>
      <span class="tl-value">${currency} ${receipt.totals.subtotal.toFixed(2)}</span>
    </div>
    ${receipt.totals.tax > 0 ? `
    <div class="total-line">
      <span class="tl-label">${tr('tax')}</span>
      <span class="tl-value">${currency} ${receipt.totals.tax.toFixed(2)}</span>
    </div>` : ''}
    ${receipt.totals.discount > 0 ? `
    <div class="total-line">
      <span class="tl-label">${tr('discount')}</span>
      <span class="tl-value">− ${currency} ${receipt.totals.discount.toFixed(2)}</span>
    </div>` : ''}
  </div>

  <hr class="rule-double">

  <div class="total-grand">
    <span class="tg-label">${tr('grandTotal')}</span>
    <span class="tg-value">${currency} ${receipt.totals.total.toFixed(2)}</span>
  </div>

  <!-- Payment block -->
  <div class="payment-block">
    <div class="payment-row">
      <span class="pr-label">${tr('paidMethod')}</span>
      <span class="pr-value">${receipt.payment.method.toUpperCase()}</span>
    </div>
    <div class="payment-row">
      <span class="pr-label">${tr('amountPaid')}</span>
      <span class="pr-value">${currency} ${receipt.payment.amount.toFixed(2)}</span>
    </div>
    ${change ? `
    <div class="payment-row change-row">
      <span class="pr-label">${tr('change')}</span>
      <span class="pr-value">${currency} ${change}</span>
    </div>` : ''}
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-msg">${receipt.footer}</div>
    <div class="footer-thanks">${tr('thankYou')}</div>
    <div class="footer-stars">★ ★ ★</div>
  </div>

  <!-- Bottom accent bar -->
  <div class="bottom-bar"></div>

</div>
</body>
</html>`;
}