/**
 * SettingsSelector — Language + Currency switcher
 *
 * Rendered as a compact pill floating in the bottom-right of the sidebar,
 * just above the logout button. Keeps settings accessible but unobtrusive.
 *
 * Persisted automatically by useSettingsStore → localStorage.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Languages, DollarSign, ChevronDown } from 'lucide-react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useI18n } from '../lib/i18n';
import { EnterpriseTokens } from '../lib/design-system';
import { Language, Currency } from '../lib/i18n/types';

const { colors, radius } = EnterpriseTokens;

/* ── Metadata ──────────────────────────────────────────────────────── */

const LANGUAGES: { code: Language; labelEn: string; flag: string }[] = [
  { code: 'en', labelEn: 'English', flag: '🇬🇧' },
  { code: 'fr', labelEn: 'Français', flag: '🇫🇷' },
  { code: 'pt', labelEn: 'Português', flag: '🇵🇹' },
];

const CURRENCIES: { code: Currency; label: string }[] = [
  { code: 'ZMW', label: 'Kwacha (ZK)' },
  { code: 'CDF', label: 'Franc Congolais' },
  { code: 'USD', label: 'US Dollar ($)' },
  { code: 'EUR', label: 'Euro (€)' },
];

/* ── Component ─────────────────────────────────────────────────────── */

export const SettingsSelector: React.FC = () => {
  const { t } = useI18n();
  const { language, currency, setLanguage, setCurrency } = useSettingsStore();

  const [openLang, setOpenLang]  = useState(false);
  const [openCurr, setOpenCurr]  = useState(false);
  const langRef  = useRef<HTMLDivElement>(null);
  const currRef  = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setOpenLang(false);
      if (currRef.current && !currRef.current.contains(e.target as Node)) setOpenCurr(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const activeLang  = LANGUAGES.find(l => l.code === language) ?? LANGUAGES[0];
  const activeCurr  = CURRENCIES.find(c => c.code === currency) ?? CURRENCIES[2];

  /* ── Pill button ──────────────────────────────────────────────────── */
  if (!openLang && !openCurr) {
    return (
      <div style={{ padding: '0 16px 16px' }}>
        <button
          onClick={() => { setOpenLang(true); setOpenCurr(false); }}
          style={{
            width: '100%',
            display:    'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding:    '10px 14px',
            background: colors.card,
            border:     `1px solid ${colors.border}`,
            borderRadius: radius.md,
            color:      colors.text2,
            fontSize:   '11px',
            fontWeight: 700,
            cursor:     'pointer',
            letterSpacing: '0.04em',
            transition: 'all 0.2s',
          }}
          onMouseOver={e => { e.currentTarget.style.borderColor = colors.borderHi; e.currentTarget.style.color = colors.text1; }}
          onMouseOut={e  => { e.currentTarget.style.borderColor = colors.border;    e.currentTarget.style.color = colors.text2; }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Languages size={13} style={{ color: colors.text3 }} />
            {activeLang.flag} {activeLang.labelEn}
          </span>
          <ChevronDown size={12} style={{ color: colors.text3 }} />
        </button>
      </div>
    );
  }

  /* ── Expanded card ────────────────────────────────────────────────── */
  return (
    <div style={{ padding: '0 16px 16px' }} ref={langRef}>
      {/* Language list */}
      {openLang && (
        <div style={{
          background: colors.card,
          border:     `1px solid ${colors.borderHi}`,
          borderRadius: radius.md,
          marginBottom: '8px',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '8px 12px',
            fontSize:  '9px',
            fontWeight: 800,
            color:     colors.text3,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            borderBottom: `1px solid ${colors.border}`,
          }}>
            <Languages size={10} style={{ verticalAlign: 'middle', marginRight: 5 }} />
            {t('common.language') || 'Language'}
          </div>
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => { setLanguage(l.code); setOpenLang(false); }}
              style={{
                width:    '100%',
                display:  'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding:  '9px 12px',
                background: l.code === language ? colors.accent.blueDim : 'transparent',
                border:   'none',
                color:    l.code === language ? colors.accent.blue : colors.text2,
                fontSize: '12px',
                fontWeight: l.code === language ? 700 : 500,
                cursor:   'pointer',
                transition: 'background 0.15s',
              }}
              onMouseOver={e => {
                if (l.code !== language) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              }}
              onMouseOut={e => {
                if (l.code !== language) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span>{l.flag} {l.labelEn}</span>
              {l.code === language && <span style={{ fontSize: 10, opacity: 0.7 }}>✓</span>}
            </button>
          ))}
        </div>
      )}

      {/* Currency list */}
      {openCurr && (
        <div style={{
          background: colors.card,
          border:     `1px solid ${colors.borderHi}`,
          borderRadius: radius.md,
          marginBottom: '8px',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '8px 12px',
            fontSize:  '9px',
            fontWeight: 800,
            color:     colors.text3,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            borderBottom: `1px solid ${colors.border}`,
          }}>
            <DollarSign size={10} style={{ verticalAlign: 'middle', marginRight: 5 }} />
            {t('common.currency') || 'Currency'}
          </div>
          {CURRENCIES.map(c => (
            <button
              key={c.code}
              onClick={() => { setCurrency(c.code); setOpenCurr(false); }}
              style={{
                width:    '100%',
                display:  'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding:  '9px 12px',
                background: c.code === currency ? colors.accent.goldDim : 'transparent',
                border:   'none',
                color:    c.code === currency ? colors.accent.gold : colors.text2,
                fontSize: '12px',
                fontWeight: c.code === currency ? 700 : 500,
                cursor:   'pointer',
                transition: 'background 0.15s',
              }}
              onMouseOver={e => {
                if (c.code !== currency) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              }}
              onMouseOut={e => {
                if (c.code !== currency) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span>{c.label}</span>
              {c.code === currency && <span style={{ fontSize: 10, opacity: 0.7 }}>✓</span>}
            </button>
          ))}
        </div>
      )}

      {/* Collapsed toggle buttons when a dropdown is closed */}
      {!openLang && (
        <button
          onClick={() => { setOpenCurr(true); }}
          style={{
            width:    '100%',
            display:  'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding:  '8px 14px',
            marginBottom: '6px',
            background: colors.surface,
            border:     `1px solid ${colors.border}`,
            borderRadius: radius.sm,
            color:      colors.text3,
            fontSize:   '11px',
            fontWeight: 600,
            cursor:     'pointer',
          }}
          onMouseOver={e => { e.currentTarget.style.borderColor = colors.borderHi; }}
          onMouseOut={e  => { e.currentTarget.style.borderColor = colors.border; }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <DollarSign size={12} />
            {activeCurr.label}
          </span>
          <ChevronDown size={11} />
        </button>
      )}
    </div>
  );
};
