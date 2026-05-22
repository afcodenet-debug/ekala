/**
 * Currency Formatter + useCurrency hook
 *
 * Supported currencies
 * ──────────────
 *  ZMW  Kwacha (Zambia)   — 2 dp
 *  CDF  Franc Congolais   — 2 dp
 *  USD  US Dollar         — 2 dp
 *  EUR  Euro              — 2 dp
 *
 * Decimal digits are Intl-native (no hardcoded rounding) so future currencies
 * with 0 dp (JPY) or 3 dp (BHD) can be added with zero code changes.
 *
 * Locale -> Intl mapping
 * ─────────────────────
 *  English → en-US  (USD sensible default, no意外的 locale drift)
 *  Français → fr-FR (EUR familiar; CDF/ZMW still use ISO code)
 *  Português → pt-PT
 */

import { useMemo } from 'react';
import { Language, Currency } from './types';

/* ── Locale mapping ─────────────────────────────────────────────────── */

const LOCALES: Record<Language, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  pt: 'pt-PT',
};

/* ── Currency → ISO-4217 code ───────────────────────────────────────── */

const CODES: Record<Currency, string> = {
  ZMW: 'ZMW',
  CDF: 'CDF',
  USD: 'USD',
  EUR: 'EUR',
};

/* ── Currencies that show no sub-unit ───────────────────────────────── */

const ZERO_DP: Set<Currency> = new Set();

/**
 * Format `amount` according to the currently selected currency and language.
 *
 * @param amount  Numeric value (already in the currency's base unit)
 * @param currency  Currency code — defaults to 'USD'
 * @param lang  Display language — defaults to 'en'
 * @returns Localised formatted string (e.g. "K 1,234.50", "€ 10,00", "$ 50.00")
 */
export function formatPrice(
  amount: number,
  currency: Currency = 'USD',
  lang: Language = 'en',
): string {
  const code    = CODES[currency];
  const locale  = LOCALES[lang];
  const digits  = ZERO_DP.has(currency) ? 0 : 2;

  // Intl handles thousands separators, decimal point and currency placement
  // automatically for every locale — no manual concatenation anywhere.
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

/* ── React hook ─────────────────────────────────────────────────────── */

export interface UseCurrencyReturn {
  /** Currently selected currency (persisted to localStorage). */
  currency: Currency;
  /** Set a new currency — updates localStorage immediately. */
  setCurrency: (c: Currency) => void;
  /** Format an amount with the currently selected currency + language. */
  format: (amount: number, lang?: Language) => string;
}

export function useCurrency(currency: Currency, setCurrency: (c: Currency) => void): UseCurrencyReturn {
  return useMemo<UseCurrencyReturn>(
    () => ({
      currency,
      setCurrency,
      format: (amount: number, lang: Language = 'en') => formatPrice(amount, currency, lang),
    }),
    [currency, setCurrency],
  );
}
