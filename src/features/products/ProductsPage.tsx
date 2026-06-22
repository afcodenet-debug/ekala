import { useState, useEffect, useMemo, useCallback } from 'react';
import { useProductStore } from './hooks/useProductStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useProductPermissions } from './hooks/useProductPermissions';
import { useI18n } from '../../lib/i18n';
import { EnterpriseTokens } from '../../lib/design-system';
import { ProductModal } from './components/ProductModal';
import { StockAdjustmentModal } from './components/StockAdjustmentModal';
import { InventoryHeader } from './components/inventory/InventoryHeader';
import { InventoryStats } from './components/inventory/InventoryStats';
import { InventoryFilters } from './components/inventory/InventoryFilters';
import { InventoryTable } from './components/inventory/InventoryTable';
import { InventoryPagination } from './components/inventory/InventoryPagination';
import { EmptyInventoryState } from './components/inventory/EmptyInventoryState';
import { InventoryActivityPreview } from './components/inventory/InventoryActivityPreview';
import { InventoryAnalyticsPage as InventoryAnalytics } from './components/InventoryAnalytics';
import { CategoryManager } from './components/CategoryManager';
import { InventoryMovementTable } from './components/InventoryMovementTable';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useInventoryFilters } from './hooks/useInventoryFilters';
import { useInventoryStats } from './hooks/useInventoryStats';
import { useInventoryPagination } from './hooks/useInventoryPagination';
import { useInventoryMovements } from './hooks/useInventoryMovements';
import { Product } from './types';
import { useLocation } from 'react-router-dom';

const { colors } = EnterpriseTokens;

// ─── Design tokens ────────────────────────────────────────────────────────────
const dt = {
  text: {
    xs:   'clamp(10px, 1.5vw, 11px)',
    sm:   'clamp(11px, 1.8vw, 13px)',
    base: 'clamp(13px, 2vw, 14px)',
    md:   'clamp(15px, 2.2vw, 17px)',
    lg:   'clamp(18px, 2.8vw, 22px)',
    xl:   'clamp(22px, 3.5vw, 28px)',
  },
  ease: {
    snap:   'all 0.12s cubic-bezier(0.4,0,0.2,1)',
    smooth: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
    spring: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
    reveal: 'all 0.45s cubic-bezier(0.22,1,0.36,1)',
  },
  shadow: {
    sm:  '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    md:  '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
    lg:  '0 12px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.04)',
    xl:  '0 24px 64px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
    glow: (c: string) => `0 0 0 3px ${c}25, 0 4px 16px ${c}20`,
  },
};

// ─── useBreakpoint ────────────────────────────────────────────────────────────
function useBreakpoint() {
  const [w, setW] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1200);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener('resize', fn, { passive: true });
    return () => window.removeEventListener('resize', fn);
  }, []);
  return { isMobile: w < 640, isTablet: w >= 640 && w < 1024, isDesktop: w >= 1024, width: w };
}

// ─── Global styles ────────────────────────────────────────────────────────────
const GlobalStyles = ({ colors }: { colors: any }) => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    .pp-root {
      font-family: 'DM Sans', system-ui, sans-serif;
      font-feature-settings: 'ss01','ss02','cv01';
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .pp-scroll-hide { scrollbar-width: none; -ms-overflow-style: none; }
    .pp-scroll-hide::-webkit-scrollbar { display: none; }
    .pp-scroll-x { overflow-x: auto; -webkit-overflow-scrolling: touch; }

    /* Ambient background glow */
    .pp-bg-texture {
      position: fixed; inset: 0; pointer-events: none; z-index: 0;
      background-image:
        radial-gradient(ellipse 70% 45% at 10% 0%,  ${colors.accent?.blue ?? '#3b82f6'}08 0%, transparent 65%),
        radial-gradient(ellipse 55% 40% at 95% 10%, ${colors.accent?.gold ?? '#f59e0b'}07 0%, transparent 65%),
        radial-gradient(ellipse 40% 30% at 50% 100%,${colors.accent?.blue ?? '#3b82f6'}04 0%, transparent 70%);
    }

    /* ── Animations ── */
    @keyframes pp-fade-up {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes pp-fade-in  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes pp-scale-in {
      from { opacity: 0; transform: scale(0.96) translateY(6px); }
      to   { opacity: 1; transform: scale(1)    translateY(0); }
    }
    @keyframes pp-toast-in {
      from { opacity: 0; transform: translateY(18px) scale(0.93); }
      to   { opacity: 1; transform: translateY(0)    scale(1); }
    }
    @keyframes pp-shimmer {
      0%   { background-position: -600px 0; }
      100% { background-position:  600px 0; }
    }
    @keyframes pp-pulse  { 0%,100%{opacity:1} 50%{opacity:0.35} }
    @keyframes pp-float  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
    @keyframes pp-ring-spin { to { transform: rotate(360deg); } }
    @keyframes pp-glow-pulse {
      0%,100% { box-shadow: 0 0 0 0 currentColor; }
      50%     { box-shadow: 0 0 0 4px transparent; }
    }

    .pp-anim-fade-up   { animation: pp-fade-up  0.42s cubic-bezier(0.22,1,0.36,1) both; }
    .pp-anim-scale-in  { animation: pp-scale-in 0.32s cubic-bezier(0.22,1,0.36,1) both; }
    .pp-anim-fade-in   { animation: pp-fade-in  0.28s ease both; }

    /* Stagger */
    .pp-stagger > * { animation: pp-fade-up 0.38s cubic-bezier(0.22,1,0.36,1) both; }
    .pp-stagger > *:nth-child(1) { animation-delay:   0ms; }
    .pp-stagger > *:nth-child(2) { animation-delay:  45ms; }
    .pp-stagger > *:nth-child(3) { animation-delay:  90ms; }
    .pp-stagger > *:nth-child(4) { animation-delay: 135ms; }
    .pp-stagger > *:nth-child(5) { animation-delay: 180ms; }

    .pp-grid-stagger > * { animation: pp-scale-in 0.32s cubic-bezier(0.22,1,0.36,1) both; }
    .pp-grid-stagger > *:nth-child(1) { animation-delay:  0ms; }
    .pp-grid-stagger > *:nth-child(2) { animation-delay: 28ms; }
    .pp-grid-stagger > *:nth-child(3) { animation-delay: 56ms; }
    .pp-grid-stagger > *:nth-child(4) { animation-delay: 84ms; }
    .pp-grid-stagger > *:nth-child(5) { animation-delay:112ms; }
    .pp-grid-stagger > *:nth-child(6) { animation-delay:140ms; }
    .pp-grid-stagger > *:nth-child(n+7){ animation-delay:160ms; }

    /* ── Button base ── */
    .pp-btn {
      cursor: pointer; border: none; font-family: inherit;
      font-weight: 600; letter-spacing: -0.01em;
      transition: ${dt.ease.smooth};
      display: inline-flex; align-items: center; justify-content: center;
      gap: 6px; white-space: nowrap; user-select: none;
      -webkit-tap-highlight-color: transparent; position: relative;
    }
    .pp-btn:active   { transform: scale(0.97); }
    .pp-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .pp-btn:focus-visible {
      outline: 2px solid ${colors.accent?.blue ?? '#3b82f6'};
      outline-offset: 2px;
    }

    .pp-btn-primary {
      background: linear-gradient(135deg, ${colors.accent?.blue ?? '#3b82f6'}, color-mix(in srgb, ${colors.accent?.blue ?? '#3b82f6'} 78%, #fff));
      color: #fff;
      box-shadow: 0 2px 8px ${colors.accent?.blue ?? '#3b82f6'}35;
    }
    .pp-btn-primary:hover:not(:disabled) {
      filter: brightness(1.07);
      transform: translateY(-1px);
      box-shadow: 0 8px 20px ${colors.accent?.blue ?? '#3b82f6'}45;
    }

    .pp-btn-ghost {
      background: transparent;
      color: ${colors.text2 ?? '#6b7280'};
      border: 1px solid ${colors.border ?? '#e5e7eb'};
    }
    .pp-btn-ghost:hover:not(:disabled) {
      background: ${colors.surface ?? '#f9fafb'};
      color: ${colors.text1 ?? '#111'};
      border-color: ${colors.text3 ?? '#9ca3af'}50;
    }

    .pp-btn-danger {
      background: linear-gradient(135deg, ${colors.accent?.red ?? '#ef4444'}, color-mix(in srgb, ${colors.accent?.red ?? '#ef4444'} 78%, #fff));
      color: #fff;
      box-shadow: 0 2px 8px ${colors.accent?.red ?? '#ef4444'}30;
    }
    .pp-btn-danger:hover:not(:disabled) {
      filter: brightness(1.07); transform: translateY(-1px);
    }

    /* ── Card ── */
    .pp-card {
      background: ${colors.card ?? '#fff'};
      border: 1px solid ${colors.border ?? '#e5e7eb'};
      border-radius: 18px;
      transition: box-shadow 0.22s ease, border-color 0.22s ease, transform 0.22s ease;
      position: relative;
    }
    .pp-card:hover { box-shadow: ${dt.shadow.md}; }

    /* ── Skeleton ── */
    .pp-skeleton {
      background: linear-gradient(90deg,
        ${colors.surface ?? '#f3f4f6'} 0%,
        ${colors.card ?? '#fff'} 40%,
        ${colors.surface ?? '#f3f4f6'} 80%
      );
      background-size: 600px 100%;
      animation: pp-shimmer 1.5s infinite;
      border-radius: 8px;
    }

    /* ── Pill nav (tablet + desktop) ── */
    .pp-pillnav { display: inline-flex !important; }
    @media (max-width: 639px) { .pp-pillnav { display: none !important; } }

    /* ── Mobile bottom nav ── */
    .pp-mobile-nav {
      display: none;
      position: fixed !important;
      bottom: 0 !important; left: 0 !important; right: 0 !important;
      z-index: 2147483000 !important;
      pointer-events: none;
    }
    .pp-mobile-nav > div { pointer-events: auto; }
    @media (max-width: 639px) {
      .pp-mobile-nav { display: block !important; }
      .pp-root main  { padding-bottom: 100px !important; }
    }

    /* ── Product grid ── */
    .pp-product-grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
    }
    @media (max-width: 639px) {
      .pp-product-grid { grid-template-columns: 1fr; gap: 12px; }
    }
    @media (max-width: 639px) {
      .pp-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    }

    /* ── Focus ring ── */
    *:focus-visible {
      outline: 2px solid ${colors.accent?.blue ?? '#3b82f6'};
      outline-offset: 2px;
      border-radius: 4px;
    }

    /* ── Tooltip ── */
    [data-tooltip] { position: relative; }
    [data-tooltip]::before {
      content: attr(data-tooltip);
      position: absolute;
      bottom: calc(100% + 8px); left: 50%;
      transform: translateX(-50%) scale(0.9);
      background: ${colors.text1 ?? '#111'}f0;
      color: ${colors.bg ?? '#fff'};
      font-size: 11px; font-weight: 500;
      padding: 5px 10px; border-radius: 7px;
      white-space: nowrap; pointer-events: none;
      opacity: 0; transition: all 0.15s ease; z-index: 999;
    }
    [data-tooltip]:hover::before { opacity: 1; transform: translateX(-50%) scale(1); }

    /* ── Scrollbar (desktop) ── */
    @media (min-width: 1024px) {
      .pp-scroll-visible::-webkit-scrollbar { height: 4px; width: 4px; }
      .pp-scroll-visible::-webkit-scrollbar-track { background: transparent; }
      .pp-scroll-visible::-webkit-scrollbar-thumb {
        background: ${colors.border ?? '#e5e7eb'};
        border-radius: 999px;
      }
      .pp-scroll-visible::-webkit-scrollbar-thumb:hover { background: ${colors.text3 ?? '#9ca3af'}; }
    }

    @media (pointer: coarse) { .pp-btn { min-height: 40px; } }

    /* ── Product card accent strip ── */
    .pp-product-card-strip {
      position: absolute; top: 0; left: 0; right: 0; height: 2px;
      border-radius: 18px 18px 0 0;
      opacity: 0; transition: opacity 220ms ease;
    }
    .pp-card:hover .pp-product-card-strip { opacity: 1; }

    /* ── Pill nav indicator ── */
    .pp-pill-indicator {
      transition: left 0.30s cubic-bezier(0.34,1.56,0.64,1);
    }
  `}</style>
);

// ─── StockBadge ───────────────────────────────────────────────────────────────
const StockBadge = ({ qty, min, colors }: { qty: number; min: number; colors: any }) => {
  const isOut = qty <= 0;
  const isLow = !isOut && qty <= min;

  const cfg = isOut
    ? { label: 'Rupture',  color: colors.accent?.red,   bg: `${colors.accent?.red}14`,   border: `${colors.accent?.red}28`   }
    : isLow
    ? { label: 'Stock bas', color: colors.accent?.amber, bg: `${colors.accent?.amber}12`, border: `${colors.accent?.amber}28` }
    : { label: 'En stock',  color: colors.accent?.green, bg: `${colors.accent?.green}11`, border: `${colors.accent?.green}28` };

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 9px', borderRadius: 999,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      color: cfg.color,
      fontSize: dt.text.xs, fontWeight: 700, letterSpacing: '0.03em',
      flexShrink: 0,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%',
        background: cfg.color, flexShrink: 0,
        boxShadow: `0 0 0 2px ${cfg.color}20`,
        animation: isOut ? 'pp-pulse 1.5s ease-in-out infinite' : 'none',
      }} />
      {cfg.label}
    </span>
  );
};

// ─── ProductCard ──────────────────────────────────────────────────────────────
const ProductCard = ({
  product, isHighlighted, onAdjust, onViewDetails, t, colors,
}: {
  product: Product; isHighlighted: boolean;
  onAdjust: (p: Product) => void; onViewDetails: (p: Product) => void;
  t: (k: string) => string; colors: any;
}) => {
  const margin = product.selling_price > 0
    ? ((product.selling_price - product.buying_price) / product.selling_price * 100).toFixed(1)
    : '0.0';
  const marginNum = parseFloat(margin);
  const marginColor = marginNum > 30
    ? colors.accent?.green
    : marginNum > 15
    ? colors.accent?.amber
    : colors.accent?.red;

  const stockPct = Math.min(100, product.stock_quantity <= 0
    ? 0
    : (product.stock_quantity / Math.max(product.stock_quantity, product.minimum_stock * 2)) * 100);

  const stockColor = product.stock_quantity <= 0
    ? colors.accent?.red
    : product.stock_quantity <= product.minimum_stock
    ? colors.accent?.amber
    : colors.accent?.green;

  return (
    <article
      className="pp-card pp-anim-scale-in"
      style={{
        padding: '20px',
        display: 'flex', flexDirection: 'column', gap: '14px',
        border: isHighlighted
          ? `2px solid ${colors.accent?.blue}`
          : `1px solid ${colors.border}`,
        boxShadow: isHighlighted ? dt.shadow.glow(colors.accent?.blue) : undefined,
        overflow: 'hidden',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = dt.shadow.lg; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = isHighlighted ? dt.shadow.glow(colors.accent?.blue) : ''; }}
    >
      {/* Accent strip */}
      <div
        className="pp-product-card-strip"
        style={{ background: `linear-gradient(90deg, transparent, ${stockColor}80, transparent)` }}
      />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{
            fontSize: dt.text.xs, color: colors.text3, fontWeight: 700,
            marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.07em',
          }}>
            {product.category_name}
          </p>
          <h3 style={{
            fontSize: dt.text.md, fontWeight: 720, color: colors.text1,
            lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', letterSpacing: '-0.01em',
          }}>
            {product.name}
          </h3>
          {product.barcode && (
            <p style={{
              fontSize: dt.text.xs, color: colors.text3,
              fontFamily: "'DM Mono', monospace", marginTop: '4px',
              letterSpacing: '0.03em',
            }}>
              {product.barcode}
            </p>
          )}
        </div>
        <StockBadge qty={product.stock_quantity} min={product.minimum_stock} colors={colors} />
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: `${colors.border}80` }} />

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
        {[
          { label: 'Achat', val: `$${product.buying_price.toFixed(2)}`,  color: colors.text1  },
          { label: 'Vente', val: `$${product.selling_price.toFixed(2)}`, color: colors.text1  },
          { label: 'Marge', val: `${margin}%`,                           color: marginColor    },
        ].map(m => (
          <div key={m.label} style={{
            background: colors.surface,
            borderRadius: '10px',
            padding: '10px 6px',
            textAlign: 'center',
            border: `1px solid ${colors.border}50`,
          }}>
            <p style={{ fontSize: dt.text.xs, color: colors.text3, fontWeight: 600, marginBottom: '5px' }}>
              {m.label}
            </p>
            <p style={{
              fontSize: dt.text.sm, fontWeight: 720, color: m.color,
              fontFamily: "'DM Mono', monospace", letterSpacing: '-0.01em',
            }}>
              {m.val}
            </p>
          </div>
        ))}
      </div>

      {/* Stock bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
          <span style={{ fontSize: dt.text.xs, color: colors.text3, fontWeight: 600 }}>Stock actuel</span>
          <span style={{
            fontSize: dt.text.xs, fontWeight: 720, color: colors.text1,
            fontFamily: "'DM Mono', monospace",
          }}>
            {product.stock_quantity} <span style={{ color: colors.text3, fontWeight: 500 }}>{product.unit}</span>
          </span>
        </div>
        {/* Track */}
        <div style={{ height: '4px', borderRadius: '4px', background: `${colors.border}80`, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '4px',
            width: `${stockPct}%`,
            background: `linear-gradient(90deg, ${stockColor}, ${stockColor}cc)`,
            transition: dt.ease.smooth,
            boxShadow: `0 0 6px ${stockColor}50`,
          }} />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
        <button
          type="button" className="pp-btn pp-btn-ghost"
          onClick={() => onAdjust(product)}
          style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', fontSize: dt.text.sm }}
        >
          ↕ {t('products.adjustStock')}
        </button>
        <button
          type="button" className="pp-btn pp-btn-primary"
          onClick={() => onViewDetails(product)}
          style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', fontSize: dt.text.sm }}
        >
          Détails →
        </button>
      </div>
    </article>
  );
};

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({
  type, msg, onDismiss, isMobile, colors,
}: { type: 'success' | 'error'; msg: string; onDismiss: () => void; isMobile: boolean; colors: any }) => {
  const isSuccess = type === 'success';
  const accent = isSuccess ? colors.accent?.green : colors.accent?.red;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: isMobile ? '80px' : '24px',
        right: isMobile ? '12px' : '24px',
        left: isMobile ? '12px' : 'auto',
        zIndex: 9999,
        maxWidth: isMobile ? 'none' : '380px',
        background: isSuccess ? 'rgba(10,10,20,0.92)' : `${accent}10`,
        border: `1px solid ${accent}${isSuccess ? '18' : '32'}`,
        borderRadius: '14px',
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: '12px',
        boxShadow: `0 20px 48px rgba(0,0,0,0.45), 0 4px 12px rgba(0,0,0,0.25), 0 0 0 1px ${accent}10`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        animation: 'pp-toast-in 0.32s cubic-bezier(0.34,1.56,0.64,1) both',
      }}
    >
      {/* Icon circle */}
      <div style={{
        width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
        background: `${accent}18`,
        border: `1px solid ${accent}30`,
        color: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '14px', fontWeight: 800,
        boxShadow: `0 0 0 4px ${accent}0c`,
      }}>
        {isSuccess ? '✓' : '✕'}
      </div>

      <span style={{
        flex: 1, fontSize: dt.text.sm, fontWeight: 600,
        color: isSuccess ? colors.text1 : accent,
        lineHeight: 1.5,
      }}>
        {msg}
      </span>

      <button
        type="button"
        onClick={onDismiss}
        style={{
          width: '26px', height: '26px', borderRadius: '7px',
          border: `1px solid ${colors.border}`,
          background: 'rgba(255,255,255,0.04)',
          color: colors.text3,
          cursor: 'pointer', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', transition: dt.ease.snap,
        }}
        aria-label="Fermer"
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = colors.text2; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = colors.text3; }}
      >
        ✕
      </button>
    </div>
  );
};

// ─── PillNav ──────────────────────────────────────────────────────────────────
const PillNav = ({
  activeTab, tabs, onTabChange, colors, isMobile,
}: { activeTab: string; tabs: any[]; onTabChange: (id: string) => void; colors: any; isMobile?: boolean }) => {
  const activeIndex = tabs.findIndex(tab => tab.id === activeTab);

  return (
    <div
      className="pp-pillnav pp-scroll-x pp-scroll-hide"
      role="tablist"
      aria-label="Inventory sections"
      style={{
        position: 'relative',
        display: 'inline-flex',
        gap: '2px',
        padding: '5px',
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: '16px',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.08)',
        marginBottom: isMobile ? '14px' : '22px',
        maxWidth: '100%',
        width: isMobile ? '100%' : 'auto',
      }}
    >
      {/* Sliding indicator */}
      <div
        aria-hidden="true"
        className="pp-pill-indicator"
        style={{
          position: 'absolute',
          top: '5px', bottom: '5px',
          left: `calc(5px + ${activeIndex} * (100% - 10px) / ${tabs.length})`,
          width: `calc((100% - 10px) / ${tabs.length})`,
          background: colors.card,
          borderRadius: '12px',
          boxShadow: `0 1px 4px rgba(0,0,0,0.12), 0 0 0 1px ${colors.border}`,
          pointerEvents: 'none',
        }}
      />

      {tabs.map(tab => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onTabChange(tab.id)}
            className="pp-btn"
            style={{
              position: 'relative', zIndex: 1,
              flex: '1 1 0',
              padding: isMobile ? '9px 8px' : '10px 20px',
              borderRadius: '12px',
              fontSize: isMobile ? dt.text.xs : dt.text.sm,
              fontWeight: active ? 700 : 500,
              color: active ? colors.text1 : colors.text3,
              background: 'transparent',
              gap: isMobile ? '4px' : '7px',
              whiteSpace: 'nowrap',
              letterSpacing: active ? '-0.01em' : '0',
              transition: 'color 0.2s ease, font-weight 0.2s ease',
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.color = colors.text2; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.color = colors.text3; }}
          >
            <span style={{
              fontSize: isMobile ? '14px' : '15px', lineHeight: 1,
              filter: active ? 'none' : 'grayscale(0.5) opacity(0.65)',
              transition: 'filter 0.2s ease',
            }}>
              {tab.icon}
            </span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

// ─── MobileNav ────────────────────────────────────────────────────────────────
const MobileNav = ({
  activeTab, tabs, onTabChange, hasFilters, onClearFilters, colors,
}: { activeTab: string; tabs: any[]; onTabChange: (id: string) => void; hasFilters: boolean; onClearFilters: () => void; colors: any }) => (
  <>
    <nav
      className="pp-mobile-nav"
      style={{ padding: '0 14px calc(12px + env(safe-area-inset-bottom, 0px))' }}
    >
      <div style={{
        display: 'flex', gap: '2px', padding: '6px',
        background: `${colors.card}f2`,
        border: `1px solid ${colors.border}`,
        borderRadius: '20px',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        boxShadow: '0 16px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(255,255,255,0.04)',
      }}>
        {tabs.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className="pp-btn"
              onClick={() => onTabChange(tab.id)}
              style={{
                flex: 1, flexDirection: 'column', gap: '3px',
                padding: '8px 4px', borderRadius: '14px',
                fontSize: '9.5px', fontWeight: active ? 700 : 500,
                color: active ? colors.accent?.blue : colors.text3,
                background: active ? `${colors.accent?.blue}10` : 'transparent',
                border: 'none',
                letterSpacing: '0.02em',
                transition: 'color 0.18s ease, background 0.18s ease',
              }}
            >
              <span style={{
                fontSize: '18px', lineHeight: 1,
                filter: active ? 'none' : 'grayscale(0.45) opacity(0.6)',
                animation: active ? 'pp-float 1.8s ease-in-out infinite' : 'none',
                transition: 'filter 0.18s ease',
              }}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>

    {hasFilters && (
      <button
        type="button" className="pp-btn pp-btn-danger"
        onClick={onClearFilters}
        style={{
          position: 'fixed',
          bottom: 'calc(82px + env(safe-area-inset-bottom, 0px))',
          right: '16px',
          zIndex: 1001,
          width: '42px', height: '42px',
          borderRadius: '50%',
          boxShadow: `0 6px 18px ${colors.accent?.red}45`,
          fontSize: '15px',
        }}
        aria-label="Effacer les filtres"
      >
        ✕
      </button>
    )}
  </>
);

// ─── BulkBar ──────────────────────────────────────────────────────────────────
const BulkBar = ({
  count, onAdjust, onArchive, onDelete, onClear, t, isMobile, colors,
}: {
  count: number; onAdjust: () => void; onArchive: () => void;
  onDelete: () => void; onClear: () => void;
  t: (k: string, o?: any) => string; isMobile: boolean; colors: any;
}) => (
  <div
    className="pp-anim-fade-up"
    style={{
      background: `${colors.accent?.blue}07`,
      border: `1px solid ${colors.accent?.blue}20`,
      borderRadius: '14px',
      padding: isMobile ? '12px 14px' : '14px 20px',
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'flex-start' : 'center',
      justifyContent: 'space-between',
      gap: isMobile ? '10px' : '14px',
      backdropFilter: 'blur(8px)',
    }}
  >
    {/* Count badge */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{
        width: '28px', height: '28px', borderRadius: '50%',
        background: colors.accent?.blue,
        color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: dt.text.sm, fontWeight: 800, flexShrink: 0,
        boxShadow: `0 0 0 4px ${colors.accent?.blue}18`,
      }}>
        {count}
      </span>
      <span style={{ fontSize: dt.text.sm, fontWeight: 600, color: colors.text1 }}>
        {t('products.selected')}
      </span>
    </div>

    {/* Actions */}
    <div style={{
      display: 'flex', gap: '6px', flexWrap: 'wrap',
      width: isMobile ? '100%' : 'auto',
    }}>
      {([
        { label: t('products.bulkAdjust'),  color: colors.accent?.amber, fn: onAdjust  },
        { label: t('products.bulkArchive'), color: colors.accent?.gold,  fn: onArchive },
        { label: t('products.bulkDelete'),  color: colors.accent?.red,   fn: onDelete  },
      ] as const).map(({ label, color, fn }) => (
        <button
          key={label} type="button" className="pp-btn"
          onClick={fn}
          style={{
            padding: '9px 14px', borderRadius: '10px',
            background: color, border: 'none', color: '#fff',
            fontSize: dt.text.xs, fontWeight: 700,
            flex: isMobile ? '1 1 calc(33% - 4px)' : '0 0 auto',
            boxShadow: `0 3px 10px ${color}35`,
            letterSpacing: '0.02em',
          }}
          onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.filter = ''; e.currentTarget.style.transform = ''; }}
        >
          {label}
        </button>
      ))}
      <button
        type="button" className="pp-btn pp-btn-ghost"
        onClick={onClear}
        style={{
          padding: '9px 14px', borderRadius: '10px', fontSize: dt.text.xs,
          flex: isMobile ? '1 1 100%' : '0 0 auto',
        }}
      >
        {t('common.clear')}
      </button>
    </div>
  </div>
);

// ─── SkeletonRows ─────────────────────────────────────────────────────────────
const SkeletonRows = ({ count = 5 }: { count?: number; colors: any }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px 0' }}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="pp-skeleton" style={{ height: '54px', animationDelay: `${i * 70}ms` }} />
    ))}
  </div>
);

// ─── Card ─────────────────────────────────────────────────────────────────────
const Card = ({
  children, style, noPad, isMobile,
}: { children: React.ReactNode; style?: React.CSSProperties; noPad?: boolean; isMobile?: boolean }) => (
  <section
    className="pp-card"
    style={{ padding: noPad ? 0 : isMobile ? '16px' : '28px', width: '100%', minWidth: 0, ...style }}
  >
    {children}
  </section>
);

// ─── Divider ──────────────────────────────────────────────────────────────────
const Divider = ({ label, colors }: { label?: string; colors: any }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
    <div style={{ flex: 1, height: '1px', background: `${colors.border}80` }} />
    {label && (
      <span style={{
        fontSize: dt.text.xs, color: colors.text3, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.1em', flexShrink: 0,
      }}>
        {label}
      </span>
    )}
    <div style={{ flex: 1, height: '1px', background: `${colors.border}80` }} />
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// ─── ProductsPage ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const ProductsPage = () => {
  const { t } = useI18n();
  const location = useLocation();
  const highlightProductId = location.state?.highlightProductId;
  const { can } = useProductPermissions();
  const { isMobile, isTablet } = useBreakpoint();

  const {
    products, categories,
    fetchProducts, fetchCategories,
    deleteProduct, adjustStock, createProduct, updateProduct,
  } = useProductStore();

  type InventoryTab = 'overview' | 'analytics' | 'movements' | 'categories';
  const [activeTab, setActiveTab]               = useState<InventoryTab>('overview');
  const [viewMode, setViewMode]                 = useState<'table' | 'grid'>('table');
  const [showModal, setShowModal]               = useState(false);
  const [showStockModal, setShowStockModal]     = useState(false);
  const [editingProduct, setEditingProduct]     = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct]   = useState<Product | null>(null);
  const [selectedIds, setSelectedIds]           = useState<number[]>([]);
  const [sortField, setSortField]               = useState<'name' | 'stock_quantity' | 'selling_price'>('name');
  const [sortDirection, setSortDirection]       = useState<'asc' | 'desc'>('asc');
  const [toast, setToast]                       = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [bulkArchiveConfirm, setBulkArchiveConfirm] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm]   = useState(false);
  const [deleteConfirmId, setDeleteConfirmId]       = useState<number | null>(null);

  const { movements, loading: movementsLoading }                      = useInventoryMovements(6);
  const { movements: fullMovements, loading: fullMovementsLoading }   = useInventoryMovements(500);
  const filteredProductsResult = useInventoryFilters(products, categories);
  const stats = useInventoryStats(products);

  const sortedProducts = useMemo(() => {
    const copy = [...filteredProductsResult.filteredProducts];
    const dir = sortDirection === 'asc' ? 1 : -1;
    return copy.sort((a, b) =>
      sortField === 'name'
        ? dir * a.name.localeCompare(b.name)
        : dir * ((a[sortField] ?? 0) - (b[sortField] ?? 0))
    );
  }, [filteredProductsResult.filteredProducts, sortField, sortDirection]);

  const pagination = useInventoryPagination(sortedProducts, isMobile ? 10 : 20);

  useEffect(() => { fetchProducts(); fetchCategories(); }, [fetchProducts, fetchCategories]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(id);
  }, [toast]);

  // ── Handlers (logique inchangée) ───────────────────────────────────────────
  const handleSort = useCallback((field: string) => {
    if (sortField === field) { setSortDirection(p => p === 'asc' ? 'desc' : 'asc'); return; }
    setSortField(field as typeof sortField); setSortDirection('asc');
  }, [sortField]);

  const handleSelectRow    = useCallback((id: number, selected: boolean) =>
    setSelectedIds(p => selected ? [...p, id] : p.filter(i => i !== id)), []);

  const handleSelectAll    = useCallback((selected: boolean) =>
    setSelectedIds(selected ? pagination.pageItems.map(p => p.id) : []), [pagination.pageItems]);

  const handleEdit         = useCallback((p: Product) => { setEditingProduct(p); setShowModal(true); }, []);
  const handleAdjust       = useCallback((p: Product) => { setSelectedProduct(p); setShowStockModal(true); }, []);
  const handleViewDetails  = useCallback((p: Product) => { window.location.href = `/products/${p.id}`; }, []);
  const handleBulkAdjust   = useCallback(() => {
    if (!selectedIds.length) return;
    const p = products.find(p => p.id === selectedIds[0]);
    if (p) { setSelectedProduct(p); setShowStockModal(true); }
  }, [selectedIds, products]);

  const handleBulkArchive  = useCallback(async () => { if (selectedIds.length) setBulkArchiveConfirm(true); }, [selectedIds]);

  const confirmBulkArchive = useCallback(async () => {
    if (!selectedIds.length) return;
    setBulkArchiveConfirm(false);
    const role = useAuthStore.getState().user?.role;
    let ok = 0;
    for (const id of selectedIds) if (await updateProduct(id, { is_available: false }, role)) ok++;
    setToast({ type: ok === selectedIds.length ? 'success' : 'error', msg: t('products.bulkArchiveResult', { success: ok, total: selectedIds.length }) });
    setSelectedIds([]); fetchProducts();
  }, [selectedIds, updateProduct, fetchProducts, t]);

  const handleBulkDelete   = useCallback(async () => { if (selectedIds.length) setBulkDeleteConfirm(true); }, [selectedIds]);

  const confirmBulkDelete  = useCallback(async () => {
    if (!selectedIds.length) return;
    setBulkDeleteConfirm(false);
    let ok = 0;
    for (const id of selectedIds) if (await deleteProduct(id)) ok++;
    setToast({ type: ok === selectedIds.length ? 'success' : 'error', msg: t('products.bulkDeleteResult', { success: ok, total: selectedIds.length }) });
    setSelectedIds([]); fetchProducts();
  }, [selectedIds, deleteProduct, fetchProducts, t]);

  const handleDuplicate = useCallback(async (product: Product) => {
    const role = useAuthStore.getState().user?.role;
    const dup: Partial<Product> = {
      name: `${product.name} Copy`, barcode: null,
      category_id: product.category_id, buying_price: product.buying_price,
      selling_price: product.selling_price, stock_quantity: 0,
      minimum_stock: product.minimum_stock, unit: product.unit,
      is_available: true, description: product.description,
    };
    const res = await createProduct(dup, role);
    setToast(res.success
      ? { type: 'success', msg: t('products.createdSuccess', { name: dup.name ?? 'Copy' }) }
      : { type: 'error',   msg: t('products.failedToCreate') });
    if (res.success) fetchProducts();
  }, [createProduct, fetchProducts, t]);

  const handleArchive = useCallback(async (product: Product) => {
    const role = useAuthStore.getState().user?.role;
    const res = await updateProduct(product.id, { is_available: false }, role);
    setToast(res.success
      ? { type: 'success', msg: t('products.deletedSuccess') }
      : { type: 'error',   msg: t('products.failedToSave') });
    if (res.success) fetchProducts();
  }, [fetchProducts, t, updateProduct]);

  const requestDelete = useCallback((id: number) => setDeleteConfirmId(id), []);

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    const ok = await deleteProduct(id);
    setToast(ok
      ? { type: 'success', msg: t('products.deletedSuccess') }
      : { type: 'error',   msg: t('products.failedToDelete') });
    fetchCategories(); fetchProducts();
  }, [deleteConfirmId, deleteProduct, fetchCategories, fetchProducts, t]);

  const handleDelete = useCallback(async (id: number) => requestDelete(id), [requestDelete]);

  const handleStockConfirm = async (qty: number, type: 'addition' | 'subtraction', reason: string) => {
    if (!selectedProduct) return;
    const role = useAuthStore.getState().user?.role;
    const ok = await adjustStock(selectedProduct.id, { quantity: type === 'addition' ? qty : -qty, type, reason }, role);
    setToast(ok
      ? { type: 'success', msg: t('products.savedSuccess', { name: selectedProduct.name }) }
      : { type: 'error',   msg: t('products.failedToSave') });
    if (ok) fetchProducts();
    setShowStockModal(false); setSelectedProduct(null);
  };

  const handleExport = useCallback(() => {
    if (!sortedProducts.length) return;
    const headers = ['SKU / Barcode', t('products.productName'), t('products.category'),
      t('products.buyPrice'), t('products.sellPrice'), 'Margin %', t('products.stock'), t('products.unit'), 'Status'];
    const rows = sortedProducts.map(p => {
      const margin = p.selling_price > 0
        ? ((p.selling_price - p.buying_price) / p.selling_price * 100).toFixed(1) : '0.0';
      const status = p.stock_quantity <= 0 ? 'Out of stock' : p.stock_quantity <= p.minimum_stock ? 'Low stock' : 'In stock';
      return [p.barcode || 'N/A', p.name, p.category_name, p.buying_price.toFixed(2),
        p.selling_price.toFixed(2), `${margin}%`, p.stock_quantity, p.unit, status];
    });
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
    Object.assign(document.createElement('a'), { href: url, download: `inventory_export_${new Date().toISOString().slice(0, 10)}.csv` }).click();
    setToast({ type: 'success', msg: t('products.exportSuccess') });
  }, [sortedProducts, t]);

  const handleProductSaved = useCallback(async (data: any) => {
    const role = useAuthStore.getState().user?.role;
    try {
      const res = editingProduct
        ? await updateProduct(editingProduct.id, data, role)
        : await createProduct(data, role);
      if (!res.success) {
        let msg = editingProduct ? t('products.failedToSave') : t('products.failedToCreate');
        if (res.error === 'PRODUCT_NAME_DUPLICATE') msg = t('products.nameDuplicate');
        if (res.error === 'PRODUCT_SKU_DUPLICATE')  msg = t('products.skuDuplicate');
        setToast({ type: 'error', msg }); return;
      }
      setToast({ type: 'success', msg: editingProduct
        ? t('products.savedSuccess',   { name: data.name })
        : t('products.createdSuccess', { name: data.name }) });
    } catch (err: any) {
      console.error('[ProductsPage] save error:', err);
      setToast({ type: 'error', msg: err.message || t('common.error') });
    } finally {
      setEditingProduct(null); setShowModal(false); fetchProducts(); fetchCategories();
    }
  }, [editingProduct, fetchProducts, fetchCategories, createProduct, updateProduct, t]);

  const tabs: Array<{ id: InventoryTab; label: string; icon: string }> = [
    { id: 'overview',    label: t('products.tabOverview'),   icon: '📦' },
    { id: 'analytics',  label: t('products.tabAnalytics'),  icon: '📊' },
    { id: 'movements',  label: t('products.tabMovements'),  icon: '📋' },
    { id: 'categories', label: t('products.tabCategories'), icon: '🏷️' },
  ];

  // ── Tab content ────────────────────────────────────────────────────────────
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="pp-stagger" style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px' }}>
            <InventoryStats stats={stats} />

            <InventoryFilters
              categories={categories}
              filters={filteredProductsResult.filters}
              activeFiltersCount={filteredProductsResult.activeFiltersCount}
              onSearchChange={v => filteredProductsResult.updateFilter('search', v)}
              onFilterChange={filteredProductsResult.updateFilter}
              onClearFilters={filteredProductsResult.clearFilters}
            />

            {selectedIds.length > 0 && (
              <BulkBar
                count={selectedIds.length}
                onAdjust={handleBulkAdjust}
                onArchive={() => setBulkArchiveConfirm(true)}
                onDelete={() => setBulkDeleteConfirm(true)}
                onClear={() => setSelectedIds([])}
                t={t} isMobile={isMobile} colors={colors}
              />
            )}

            {products.length === 0 ? (
              <EmptyInventoryState onCreate={() => { setEditingProduct(null); setShowModal(true); }} />
            ) : (
              <Card isMobile={isMobile}>
                {viewMode === 'grid' ? (
                  <div className="pp-product-grid pp-grid-stagger">
                    {pagination.pageItems.map(p => (
                      <ProductCard
                        key={p.id} product={p}
                        isHighlighted={highlightProductId === p.id}
                        onAdjust={handleAdjust}
                        onViewDetails={handleViewDetails}
                        t={t} colors={colors}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="pp-table-wrap pp-scroll-x pp-scroll-hide">
                    <InventoryTable
                      products={pagination.pageItems}
                      loading={products.length === 0}
                      selectedIds={selectedIds}
                      onSelectRow={handleSelectRow}
                      onSelectAll={handleSelectAll}
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      onEdit={handleEdit}
                      onAdjust={handleAdjust}
                      onViewDetails={handleViewDetails}
                      onDuplicate={handleDuplicate}
                      onArchive={handleArchive}
                      onDelete={handleDelete}
                      isAdmin={can('product.edit')}
                      highlightProductId={highlightProductId}
                    />
                  </div>
                )}
                <div style={{ marginTop: isMobile ? '12px' : '20px' }}>
                  <Divider colors={colors} />
                  <div style={{ marginTop: isMobile ? '12px' : '16px' }}>
                    <InventoryPagination
                      page={pagination.page}
                      pageCount={pagination.pageCount}
                      pageSize={pagination.pageSize}
                      total={pagination.total}
                      hasPrev={pagination.hasPrev}
                      hasNext={pagination.hasNext}
                      onPageChange={pagination.setPage}
                      onPageSizeChange={pagination.setPageSize}
                    />
                  </div>
                </div>
              </Card>
            )}

            <InventoryActivityPreview movements={movements} loading={movementsLoading} />
          </div>
        );

      case 'analytics':
        return (
          <Card noPad isMobile={isMobile} style={{ overflow: 'hidden' }}>
            <InventoryAnalytics />
          </Card>
        );

      case 'movements':
        return (
          <Card isMobile={isMobile}>
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'flex-start' : 'center',
              gap: '10px',
              marginBottom: isMobile ? '16px' : '24px',
            }}>
              <div>
                <h2 style={{
                  fontSize: dt.text.lg, fontWeight: 800, color: colors.text1,
                  letterSpacing: '-0.02em', margin: 0,
                }}>
                  {t('products.fullMovementHistory')}
                </h2>
                <p style={{ fontSize: dt.text.sm, color: colors.text3, marginTop: '5px' }}>
                  Historique complet des mouvements de stock
                </p>
              </div>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '7px',
                padding: '5px 14px', borderRadius: 999,
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                fontSize: dt.text.xs, fontWeight: 700, color: colors.text2,
                flexShrink: 0,
              }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: colors.accent?.green,
                  boxShadow: `0 0 0 2px ${colors.accent?.green}20`,
                }} />
                {fullMovements.length} {t('products.records')}
              </span>
            </div>

            {fullMovementsLoading ? (
              <SkeletonRows count={6} colors={colors} />
            ) : (
              <div className="pp-scroll-x pp-scroll-hide">
                <InventoryMovementTable movements={fullMovements} emptyMessage={t('products.noMovements')} />
              </div>
            )}
          </Card>
        );

      case 'categories':
        return (
          <Card noPad isMobile={isMobile} style={{ overflow: 'hidden' }}>
            <CategoryManager categories={categories} onChanged={fetchCategories} />
          </Card>
        );

      default:
        return null;
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const mainPad = isMobile ? '12px 10px' : isTablet ? '20px 18px' : '36px 32px';

  return (
    <div className="pp-root">
      <GlobalStyles colors={colors} />
      <div className="pp-bg-texture" />

      <main style={{
        background: colors.bg, minHeight: '100vh',
        padding: mainPad, position: 'relative', zIndex: 1,
      }}>
        <div style={{
          maxWidth: 1600, margin: '0 auto',
          display: 'flex', flexDirection: 'column',
          gap: isMobile ? '12px' : '20px',
        }}>
          <div style={{
            minWidth: 0, width: '100%',
            display: 'flex', flexDirection: 'column',
            gap: isMobile ? '12px' : '20px',
          }}>
            <InventoryHeader
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onExport={handleExport}
              onCreate={() => { setEditingProduct(null); setShowModal(true); }}
              activeFiltersCount={filteredProductsResult.activeFiltersCount}
              onClearFilters={filteredProductsResult.clearFilters}
              canCreate={can('product.create')}
            />

            <PillNav activeTab={activeTab} tabs={tabs} onTabChange={setActiveTab} colors={colors} />

            <div
              id={`tabpanel-${activeTab}`}
              role="tabpanel"
              className="pp-anim-fade-up"
              key={activeTab}
            >
              {renderTabContent()}
            </div>
          </div>
        </div>
      </main>

      {toast && (
        <Toast
          type={toast.type} msg={toast.msg}
          isMobile={isMobile} colors={colors}
          onDismiss={() => setToast(null)}
        />
      )}

      <MobileNav
        activeTab={activeTab} tabs={tabs} onTabChange={setActiveTab}
        hasFilters={filteredProductsResult.activeFiltersCount > 0}
        onClearFilters={filteredProductsResult.clearFilters}
        colors={colors}
      />

      <ProductModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleProductSaved}
        product={editingProduct}
        categories={categories}
      />
      <StockAdjustmentModal
        isOpen={showStockModal}
        onClose={() => { setShowStockModal(false); setSelectedProduct(null); }}
        product={selectedProduct}
        onConfirm={handleStockConfirm}
      />

      <ConfirmDialog
        open={!!deleteConfirmId}
        title={t('products.deleteConfirm') || 'Confirmer la suppression'}
        message={t('products.deleteConfirmMsg') || 'Cette action est irréversible. Êtes-vous sûr de vouloir supprimer ce produit ?'}
        confirmLabel={t('products.delete') || 'Supprimer'}
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmId(null)}
      />
      <ConfirmDialog
        open={bulkArchiveConfirm}
        title={t('products.bulkArchiveConfirmTitle') || "Confirmer l'archivage"}
        message={t('products.bulkArchiveConfirm', { count: selectedIds.length })}
        confirmLabel={t('products.bulkArchive') || 'Archiver'}
        danger={false}
        onConfirm={confirmBulkArchive}
        onCancel={() => setBulkArchiveConfirm(false)}
      />
      <ConfirmDialog
        open={bulkDeleteConfirm}
        title={t('products.bulkDeleteConfirmTitle') || 'Confirmer la suppression'}
        message={t('products.bulkDeleteConfirm', { count: selectedIds.length })}
        confirmLabel={t('products.bulkDelete') || 'Supprimer'}
        danger
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteConfirm(false)}
      />
    </div>
  );
};

export default ProductsPage;