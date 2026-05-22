/**
 * useI18n — React Context + `t()` translation hook
 *
 * Features
 * ────────
 *  `t(key)`  — strict key lookup with fallback chain {fr} → {en} → raw key
 *  lang      — current language ('en' | 'fr' | 'pt')
 *  setLang   — change language (no persistence: settings store handles that)
 *  rtl       — false for all three supported languages (LTR only)
 */

import { createContext, useContext, useState, useCallback, useMemo, ReactNode, useRef, useEffect } from 'react';
import { Language } from './types';
import { translations, TranslationNamespace } from './translations';

/* ─── Context ──────────────────────────────────────────────────────── */

interface I18nContextValue {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  rtl: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/* ─── Key resolver utilities ───────────────────────────────────────── */

function hasLang(obj: unknown, lang: string): obj is Record<string, unknown> {
  return !!obj && typeof obj === 'object' && lang in (obj as Record<string, unknown>);
}

/**
 * Resolve `key` (dotted path like `orders.status.confirmed`) inside a
 * namespace record.
 *
 * Fallback chain: current lang → 'en' → raw key
 */
function resolveInNamespace(namespace: Record<string, unknown>, lang: Language, key: string): string {
  const parts = key.split('.');
  let node: unknown = namespace;

  for (const part of parts) {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      // Key not found in this namespace
      return key; // raw key as ultimate fallback
    }
  }

  // If we landed on an object with language keys, pick the right lang
  if (node && typeof node === 'object') {
    if (hasLang(node, lang)) return String(node[lang]);
    if (hasLang(node, 'en')) return String((node as Record<string, string>)['en']);
  }

  return typeof node === 'string' ? node : key;
}

/* ─── Hook ─────────────────────────────────────────────────────────── */

export interface UseI18n {
  lang: Language;
  setLang: (l: Language) => void;
  /** Translate `key` with optional `{param}` string interpolation. Falls back to raw key. */
  t: (key: string, params?: Record<string, string | number>) => string;
  rtl: boolean;
}

export function useI18n(): UseI18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be called inside <I18nProvider>');
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [, forceUpdate] = useState(0);

  // Re-render on lang change — React context already handles this,
  // but some components read ctx.lang directly outside render.
  const langRef = useRef(ctx.lang);
  if (langRef.current !== ctx.lang) langRef.current = ctx.lang;

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      // Fast path: key might be namespace-qualified
      const dot = key.indexOf('.');
      let result: string;

      if (dot > 0) {
        const nsKey = key.slice(0, dot) as TranslationNamespace;
        const rest  = key.slice(dot + 1);

        if (nsKey in translations) {
          result = resolveInNamespace((translations as Record<string, unknown>)[nsKey] as Record<string, unknown>, ctx.lang, rest);
        } else {
          result = key;
        }
      } else {
        // Key not namespaced — search all namespaces
        result = key;
        for (const ns of Object.values(translations) as Record<string, unknown>[]) {
          const found = resolveInNamespace(ns as Record<string, unknown>, ctx.lang, key);
          if (found !== key) { result = found; break; }
        }
      }

      // Interpolate {param} placeholders
      if (params && result !== key) {
        result = result.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
      }

      return result;
    },
    [ctx.lang],
  );

  return { ...ctx, t };
}

/* ─── Provider ─────────────────────────────────────────────────────── */

export interface I18nProviderProps {
  lang?: Language;
  onLangChange?: (lang: Language) => void;
  children: ReactNode;
}

export function I18nProvider({ lang: externalLang, onLangChange, children }: I18nProviderProps) {
  const [internalLang, setInternalLang] = useState<Language>('en');
  const lang = externalLang ?? internalLang;

  const setLang = useCallback(
    (l: Language) => {
      setInternalLang(l);
      onLangChange?.(l);
    },
    [onLangChange],
  );

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const dot = key.indexOf('.');
      let result: string;

      if (dot > 0) {
        const nsKey = key.slice(0, dot) as TranslationNamespace;
        const rest  = key.slice(dot + 1);

        if (nsKey in translations) {
          result = resolveInNamespace((translations as Record<string, unknown>)[nsKey] as Record<string, unknown>, lang, rest);
        } else {
          result = key;
        }
      } else {
        result = key;
        for (const ns of Object.values(translations) as Record<string, unknown>[]) {
          const found = resolveInNamespace(ns as Record<string, unknown>, lang, key);
          if (found !== key) { result = found; break; }
        }
      }

      if (params && result !== key) {
        result = result.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
      }

      return result;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t, rtl: false }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
