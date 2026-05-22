/**
 * i18n & Currency — Core Types
 * Single source of truth for supported languages and currencies.
 */

/** Human language — determines which translation catalog is loaded and which date/time locale is used. */
export type Language = 'en' | 'fr' | 'pt';

/** Fiat currency — determines which symbol and decimal rules formatPrice uses. */
export type Currency = 'ZMW' | 'CDF' | 'USD' | 'EUR';

/**
 * Which translation key was actually resolved.
 * Used by useI18n so strict TS callers can narrow with a type guard.
 */
export type TranslationKey = string;
