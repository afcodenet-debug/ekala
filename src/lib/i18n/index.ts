/**
 * i18n — Barrel export
 *
 * Import everything from this single file:
 *
 *   import { useI18n, useCurrency, formatPrice, Language, Currency } from '../lib/i18n';
 */

export { useI18n, I18nProvider } from './useI18n';
export { useCurrency, formatPrice } from './currency';
export { translations } from './translations';
export type { Language, Currency, TranslationKey, UseCurrencyReturn, I18nProviderProps } from './types';
