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

// ─── Design tokens premium ────────────────────────────────────────────────────
const dt = {
  // Spacing scale (4px base)
  space: {
    xs:  '4px',
    sm:  '8px',
    md:  '16px',
    lg:  '24px',
    xl:  '32px',
    xxl: '48px',
  },
  // Fluid typography
  text: {
    xs:   'clamp(10px, 1.5vw, 11px)',
    sm:   'clamp(11px, 1.8vw, 13px)',
    base: 'clamp(13px, 2vw, 14px)',
    md:   'clamp(15px, 2.2vw, 17px)',
    lg:   'clamp(18px, 2.8vw, 22px)',
    xl:   'clamp(22px, 3.5vw, 28px)',
    xxl:  'clamp(28px, 4.5vw, 38px)',
  },
  // Transitions
  ease: {
    snap:    'all 0.12s cubic-bezier(0.4,0,0.2,1)',
    smooth:  'all 0.22s cubic-bezier(0.4,0,0.2,1)',
    spring:  'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
    reveal:  'all 0.45s cubic-bezier(0.22,1,0.36,1)',
  },
  // Elevation
  shadow: {
    sm:  '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    md:  '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
    lg:  '0 12px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.04)',
    xl:  '0 24px 64px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
    glow: (c: string) => `0 0 0 3px ${c}25, 0 4px 16px ${c}20`,
  },
};

// ─── useBreakpoint hook léger ─────────────────────────────────────────────────
function useBreakpoint() {
  const [w, setW] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1200);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener('resize', fn, { passive: true });
    return () => window.removeEventListener('resize', fn);
  }, []);
  return { isMobile: w < 640, isTablet: w >= 640 && w < 1024, isDesktop: w >= 1024, width: w };
}

// ─── CSS global ───────────────────────────────────────────────────────────────
const GlobalStyles = ({ colors }: { colors: any }) => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    .pp-root {
      font-family: 'DM Sans', system-ui, sans-serif;
      font-feature-settings: 'ss01','ss02','cv01';
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* ── Scrollbars ── */
    .pp-scroll-hide { scrollbar-width: none; -ms-overflow-style: none; }
    .pp-scroll-hide::-webkit-scrollbar { display: none; }
    .pp-scroll-x { overflow-x: auto; -webkit-overflow-scrolling: touch; }

    /* ── Animations ── */
    @keyframes pp-fade-up {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes pp-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes pp-scale-in {
      from { opacity: 0; transform: scale(0.95) translateY(8px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes pp-toast-in {
      from { opacity: 0; transform: translateY(16px) scale(0.94); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes pp-shimmer {
      0%   { background-position: -600px 0; }
      100% { background-position:  600px 0; }
    }
    @keyframes pp-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    @keyframes pp-dot-bounce {
      0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
      40% { transform: scale(1.2); opacity: 1; }
    }

    .pp-anim-fade-up   { animation: pp-fade-up  0.45s cubic-bezier(0.22,1,0.36,1) both; }
    .pp-anim-scale-in  { animation: pp-scale-in 0.35s cubic-bezier(0.22,1,0.36,1) both; }
    .pp-anim-fade-in   { animation: pp-fade-in  0.3s ease both; }

    /* Stagger children */
    .pp-stagger > * { animation: pp-fade-up 0.4s cubic-bezier(0.22,1,0.36,1) both; }
    .pp-stagger > *:nth-child(1) { animation-delay: 0ms; }
    .pp-stagger > *:nth-child(2) { animation-delay: 50ms; }
    .pp-stagger > *:nth-child(3) { animation-delay: 100ms; }
    .pp-stagger > *:nth-child(4) { animation-delay: 150ms; }
    .pp-stagger > *:nth-child(5) { animation-delay: 200ms; }

    /* ── Interactive states ── */
    .pp-btn {
      cursor: pointer;
      border: none;
      font-family: inherit;
      font-weight: 600;
      letter-spacing: -0.01em;
      transition: all 0.15s cubic-bezier(0.4,0,0.2,1);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      white-space: nowrap;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    .pp-btn:active { transform: scale(0.97); }
    .pp-btn:focus-visible {
      outline: 2px solid ${colors.accent?.blue ?? '#3b82f6'};
      outline-offset: 2px;
    }

    .pp-btn-primary {
      background: ${colors.accent?.blue ?? '#3b82f6'};
      color: #fff;
    }
    .pp-btn-primary:hover { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 4px 16px ${(colors.accent?.blue ?? '#3b82f6')}40; }

    .pp-btn-ghost {
      background: transparent;
      color: ${colors.text2 ?? '#6b7280'};
      border: 1px solid ${colors.border ?? '#e5e7eb'};
    }
    .pp-btn-ghost:hover { background: ${colors.surface ?? '#f9fafb'}; color: ${colors.text1 ?? '#111'}; }

    .pp-btn-danger {
      background: ${colors.accent?.red ?? '#ef4444'};
      color: #fff;
    }
    .pp-btn-danger:hover { filter: brightness(1.08); transform: translateY(-1px); }

    /* ── Card ── */
    .pp-card {
      background: ${colors.card ?? '#fff'};
      border: 1px solid ${colors.border ?? '#e5e7eb'};
      border-radius: 16px;
      transition: box-shadow 0.2s ease, border-color 0.2s ease;
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
      animation: pp-shimmer 1.6s infinite;
      border-radius: 8px;
    }

    /* ── Tab indicator ── */
    .pp-tab { position: relative; overflow: visible; }
    .pp-tab::after {
      content: '';
      position: absolute;
      bottom: -2px; left: 50%;
      width: 0; height: 3px;
      border-radius: 3px 3px 0 0;
      background: ${colors.accent?.gold ?? '#f59e0b'};
      transition: width 0.25s cubic-bezier(0.4,0,0.2,1), left 0.25s cubic-bezier(0.4,0,0.2,1);
      transform: translateX(-50%);
    }
    .pp-tab.active::after { width: calc(100% - 24px); }

    /* ── Mobile nav ── */
    .pp-mobile-nav {
      display: none;
      position: fixed;
      bottom: 0; left: 0; right: 0;
      z-index: 1000;
    }
    @media (max-width: 639px) {
      .pp-mobile-nav { display: flex; }
      .pp-desktop-tabs { display: none !important; }
      .pp-root main { padding-bottom: 80px !important; }
    }

    /* ── Desktop layout ── */
    @media (min-width: 1024px) {
      .pp-layout { display: grid; grid-template-columns: 220px 1fr; gap: 28px; align-items: start; }
      .pp-sidebar { display: flex !important; }
      .pp-desktop-tabs { display: none !important; }
    }
    @media (min-width: 640px) and (max-width: 1023px) {
      .pp-sidebar { display: none !important; }
    }
    @media (max-width: 1023px) {
      .pp-sidebar { display: none !important; }
    }

    /* ── Grid card view ── */
    .pp-product-grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
    }

    /* ── Table responsive ── */
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
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%) scale(0.9);
      background: ${colors.text1 ?? '#111'}ee;
      color: ${colors.bg ?? '#fff'};
      font-size: 11px;
      font-weight: 500;
      padding: 5px 10px;
      border-radius: 6px;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: all 0.15s ease;
      z-index: 999;
    }
    [data-tooltip]:hover::before {
      opacity: 1;
      transform: translateX(-50%) scale(1);
    }
  `}</style>
);

// ─── Badge de statut de stock ────────────────────────────────────────────────
const StockBadge = ({ qty, min, colors }: { qty: number; min: number; colors: any }) => {
  const isOut  = qty <= 0;
  const isLow  = !isOut && qty <= min;
  const isOk   = !isOut && !isLow;
  const cfg = isOut
    ? { label: 'Rupture', bg: colors.accent?.redDim,   color: colors.accent?.red,   dot: colors.accent?.red }
    : isLow
    ? { label: 'Bas',     bg: colors.accent?.amberDim, color: colors.accent?.amber, dot: colors.accent?.amber }
    : { label: 'Stock OK',bg: colors.accent?.greenDim, color: colors.accent?.green, dot: colors.accent?.green };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '4px 10px', borderRadius: 999,
      background: cfg.bg, color: cfg.color,
      fontSize: dt.text.xs, fontWeight: 700, letterSpacing: '0.03em',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
};

// ─── Carte produit (mode grille) ──────────────────────────────────────────────
const ProductCard = ({
  product, isHighlighted, onAdjust, onViewDetails, t, colors,
}: { product: Product; isHighlighted: boolean; onAdjust: (p: Product) => void; onViewDetails: (p: Product) => void; t: (k: string) => string; colors: any }) => {
  const margin = product.selling_price > 0
    ? ((product.selling_price - product.buying_price) / product.selling_price * 100).toFixed(1)
    : '0.0';

  return (
    <article
      className="pp-card pp-anim-scale-in"
      style={{
        padding: '20px',
        display: 'flex', flexDirection: 'column', gap: '16px',
        border: isHighlighted
          ? `2px solid ${colors.accent?.blue}`
          : `1px solid ${colors.border}`,
        boxShadow: isHighlighted ? dt.shadow.glow(colors.accent?.blue) : undefined,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: dt.text.xs, color: colors.text3, fontWeight: 500, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {product.category_name}
          </p>
          <h3 style={{ fontSize: dt.text.md, fontWeight: 700, color: colors.text1, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {product.name}
          </h3>
          {product.barcode && (
            <p style={{ fontSize: dt.text.xs, color: colors.text3, fontFamily: "'DM Mono', monospace", marginTop: '4px' }}>
              {product.barcode}
            </p>
          )}
        </div>
        <StockBadge qty={product.stock_quantity} min={product.minimum_stock} colors={colors} />
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
        {[
          { label: 'Achat', val: `$${product.buying_price.toFixed(2)}` },
          { label: 'Vente', val: `$${product.selling_price.toFixed(2)}` },
          { label: 'Marge',  val: `${margin}%`,
            color: parseFloat(margin) > 30
              ? colors.accent?.green
              : parseFloat(margin) > 15
              ? colors.accent?.amber
              : colors.accent?.red
          },
        ].map(m => (
          <div key={m.label} style={{
            background: colors.surface,
            borderRadius: '10px',
            padding: '10px 8px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: dt.text.xs, color: colors.text3, fontWeight: 500, marginBottom: '4px' }}>{m.label}</p>
            <p style={{ fontSize: dt.text.sm, fontWeight: 700, color: m.color ?? colors.text1, fontFamily: "'DM Mono', monospace" }}>{m.val}</p>
          </div>
        ))}
      </div>

      {/* Stock bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: dt.text.xs, color: colors.text3, fontWeight: 500 }}>Stock actuel</span>
          <span style={{ fontSize: dt.text.xs, fontWeight: 700, color: colors.text1, fontFamily: "'DM Mono', monospace" }}>
            {product.stock_quantity} {product.unit}
          </span>
        </div>
        <div style={{ height: '4px', borderRadius: '2px', background: colors.border, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            borderRadius: '2px',
            width: `${Math.min(100, product.stock_quantity <= 0 ? 0 : (product.stock_quantity / Math.max(product.stock_quantity, product.minimum_stock * 2)) * 100)}%`,
            background: product.stock_quantity <= 0
              ? colors.accent?.red
              : product.stock_quantity <= product.minimum_stock
              ? colors.accent?.amber
              : colors.accent?.green,
            transition: dt.ease.smooth,
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

// ─── Toast premium ────────────────────────────────────────────────────────────
const Toast = ({
  type, msg, onDismiss, isMobile, colors,
}: { type: 'success' | 'error'; msg: string; onDismiss: () => void; isMobile: boolean; colors: any }) => {
  const isSuccess = type === 'success';
  const accent = isSuccess ? colors.accent?.green : colors.accent?.red;
  const dim    = isSuccess ? colors.accent?.greenDim : colors.accent?.redDim;

  return (
    <div
      role="status" aria-live="polite"
      style={{
        position: 'fixed',
        bottom: isMobile ? '76px' : '24px',
        right: isMobile ? '12px' : '24px',
        left: isMobile ? '12px' : 'auto',
        zIndex: 9999,
        maxWidth: isMobile ? 'none' : '380px',
        background: dim,
        border: `1px solid ${accent}40`,
        borderRadius: '14px',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: dt.shadow.xl,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        animation: 'pp-toast-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
      }}
    >
      <span style={{
        width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
        background: accent, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '13px', fontWeight: 800,
        boxShadow: `0 0 0 5px ${accent}20`,
      }}>
        {isSuccess ? '✓' : '✕'}
      </span>
      <span style={{ flex: 1, fontSize: dt.text.sm, fontWeight: 600, color: accent, lineHeight: 1.5 }}>{msg}</span>
      <button
        type="button" onClick={onDismiss}
        style={{
          width: '28px', height: '28px', borderRadius: '50%',
          border: 'none', background: `${accent}15`,
          color: accent, cursor: 'pointer', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', transition: dt.ease.snap,
        }}
        aria-label="Fermer"
      >✕</button>
    </div>
  );
};

// ─── Sidebar desktop ──────────────────────────────────────────────────────────
const Sidebar = ({
  activeTab, tabs, onTabChange, t, colors,
}: { activeTab: string; tabs: any[]; onTabChange: (id: string) => void; t: (k: string) => string; colors: any }) => (
  <aside
    className="pp-sidebar"
    style={{
      position: 'sticky', top: '24px',
      alignSelf: 'flex-start',
      display: 'none', // overridden by CSS
      flexDirection: 'column',
      gap: '4px',
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: '20px',
      padding: '20px 14px',
      boxShadow: dt.shadow.sm,
    }}
  >
    <p style={{
      fontSize: dt.text.xs, fontWeight: 700, color: colors.text3,
      textTransform: 'uppercase', letterSpacing: '0.1em',
      padding: '0 8px', marginBottom: '10px',
    }}>
      Navigation
    </p>
    {tabs.map(tab => {
      const active = activeTab === tab.id;
      return (
        <button
          key={tab.id}
          type="button"
          className="pp-btn"
          onClick={() => onTabChange(tab.id)}
          style={{
            width: '100%',
            justifyContent: 'flex-start',
            gap: '10px',
            padding: '11px 12px',
            borderRadius: '12px',
            fontSize: dt.text.sm,
            fontWeight: active ? 700 : 500,
            color: active ? colors.accent?.blue : colors.text2,
            background: active ? `${colors.accent?.blue}10` : 'transparent',
            border: `1px solid ${active ? colors.accent?.blue + '25' : 'transparent'}`,
            transition: dt.ease.smooth,
          }}
          onMouseEnter={e => { if (!active) { e.currentTarget.style.background = `${colors.accent?.blue}06`; e.currentTarget.style.color = colors.text1; } }}
          onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = colors.text2; } }}
        >
          <span style={{ fontSize: '16px', lineHeight: 1 }}>{tab.icon}</span>
          <span>{tab.label}</span>
          {active && (
            <span style={{
              marginLeft: 'auto',
              width: '6px', height: '6px', borderRadius: '50%',
              background: colors.accent?.blue,
            }} />
          )}
        </button>
      );
    })}
  </aside>
);

// ─── Navigation tabs horizontaux ─────────────────────────────────────────────
const HorizontalTabs = ({
  activeTab, tabs, onTabChange, colors,
}: { activeTab: string; tabs: any[]; onTabChange: (id: string) => void; colors: any }) => (
  <div
    className="pp-desktop-tabs pp-scroll-x pp-scroll-hide"
    role="tablist"
    style={{
      display: 'flex',
      borderBottom: `2px solid ${colors.border}`,
      marginBottom: '24px',
      gap: 0,
    }}
  >
    {tabs.map(tab => {
      const active = activeTab === tab.id;
      return (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active}
          className={`pp-btn pp-tab${active ? ' active' : ''}`}
          onClick={() => onTabChange(tab.id)}
          style={{
            padding: '14px 22px',
            borderRadius: '12px 12px 0 0',
            fontSize: dt.text.sm,
            fontWeight: active ? 700 : 500,
            color: active ? colors.text1 : colors.text3,
            background: active ? colors.card : 'transparent',
            border: 'none',
            borderBottom: `3px solid ${active ? colors.accent?.gold : 'transparent'}`,
            gap: '7px',
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            transition: dt.ease.smooth,
          }}
          onMouseEnter={e => { if (!active) e.currentTarget.style.color = colors.text2; }}
          onMouseLeave={e => { if (!active) e.currentTarget.style.color = colors.text3; }}
        >
          <span style={{ fontSize: '15px' }}>{tab.icon}</span>
          {tab.label}
        </button>
      );
    })}
  </div>
);

// ─── Navigation mobile (bottom bar) ──────────────────────────────────────────
const MobileNav = ({
  activeTab, tabs, onTabChange, hasFilters, onClearFilters, colors,
}: { activeTab: string; tabs: any[]; onTabChange: (id: string) => void; hasFilters: boolean; onClearFilters: () => void; colors: any }) => (
  <>
    <nav
      className="pp-mobile-nav"
      style={{
        background: `${colors.card}f8`,
        borderTop: `1px solid ${colors.border}`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding: '8px 4px calc(8px + env(safe-area-inset-bottom, 0px))',
        gap: '2px',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.07)',
      }}
    >
      {tabs.map(tab => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className="pp-btn"
            onClick={() => onTabChange(tab.id)}
            style={{
              flex: 1,
              flexDirection: 'column',
              gap: '3px',
              padding: '8px 4px',
              borderRadius: '12px',
              fontSize: '9.5px',
              fontWeight: active ? 700 : 500,
              color: active ? colors.accent?.blue : colors.text3,
              background: active ? `${colors.accent?.blue}10` : 'transparent',
              border: 'none',
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            <span style={{ fontSize: '20px', lineHeight: 1 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
    {hasFilters && (
      <button
        type="button" className="pp-btn pp-btn-danger"
        onClick={onClearFilters}
        style={{
          position: 'fixed',
          bottom: 'calc(68px + env(safe-area-inset-bottom, 0px))',
          right: '14px',
          zIndex: 1001,
          width: '44px', height: '44px',
          borderRadius: '50%',
          boxShadow: `0 4px 16px ${colors.accent?.red}40`,
          fontSize: '16px',
        }}
        aria-label="Effacer les filtres"
      >✕</button>
    )}
  </>
);

// ─── Bulk action bar ──────────────────────────────────────────────────────────
const BulkBar = ({
  count, onAdjust, onArchive, onDelete, onClear, t, isMobile, colors,
}: { count: number; onAdjust: () => void; onArchive: () => void; onDelete: () => void; onClear: () => void; t: (k: string, o?: any) => string; isMobile: boolean; colors: any }) => (
  <div
    className="pp-anim-fade-up"
    style={{
      background: `${colors.accent?.blue}08`,
      border: `1px solid ${colors.accent?.blue}25`,
      borderRadius: '14px',
      padding: isMobile ? '12px' : '14px 20px',
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'flex-start' : 'center',
      justifyContent: 'space-between',
      gap: isMobile ? '10px' : '16px',
      backdropFilter: 'blur(8px)',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{
        width: '28px', height: '28px', borderRadius: '50%',
        background: colors.accent?.blue, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: dt.text.sm, fontWeight: 800, flexShrink: 0,
      }}>{count}</span>
      <span style={{ fontSize: dt.text.sm, fontWeight: 600, color: colors.text1 }}>
        {t('products.selected')}
      </span>
    </div>
    <div style={{
      display: 'flex', gap: '6px', flexWrap: 'wrap',
      width: isMobile ? '100%' : 'auto',
    }}>
      {([
        { label: t('products.bulkAdjust'),  bg: colors.accent?.amber, fn: onAdjust },
        { label: t('products.bulkArchive'), bg: colors.accent?.gold,  fn: onArchive },
        { label: t('products.bulkDelete'),  bg: colors.accent?.red,   fn: onDelete },
      ] as const).map(({ label, bg, fn }) => (
        <button
          key={label} type="button" className="pp-btn"
          onClick={fn}
          style={{
            padding: '9px 14px', borderRadius: '10px',
            background: bg, border: 'none', color: '#fff',
            fontSize: dt.text.xs, fontWeight: 700,
            flex: isMobile ? '1 1 calc(33% - 4px)' : '0 0 auto',
            boxShadow: `0 2px 8px ${bg}40`,
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
          padding: '9px 14px', borderRadius: '10px',
          fontSize: dt.text.xs,
          flex: isMobile ? '1 1 100%' : '0 0 auto',
        }}
      >
        {t('common.clear')}
      </button>
    </div>
  </div>
);

// ─── Skeleton de chargement ───────────────────────────────────────────────────
const SkeletonRows = ({ count = 5, colors }: { count?: number; colors: any }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px 0' }}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="pp-skeleton" style={{ height: '56px', animationDelay: `${i * 80}ms` }} />
    ))}
  </div>
);

// ─── Section card ─────────────────────────────────────────────────────────────
const Card = ({
  children, style, noPad, isMobile,
}: { children: React.ReactNode; style?: React.CSSProperties; noPad?: boolean; isMobile?: boolean }) => (
  <section
    className="pp-card"
    style={{
      padding: noPad ? 0 : isMobile ? '16px' : '28px',
      width: '100%', minWidth: 0,
      ...style,
    }}
  >
    {children}
  </section>
);

// ─── Séparateur avec label ────────────────────────────────────────────────────
const Divider = ({ label, colors }: { label?: string; colors: any }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '12px',
    margin: '4px 0',
  }}>
    <div style={{ flex: 1, height: '1px', background: colors.border }} />
    {label && <span style={{ fontSize: dt.text.xs, color: colors.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', flexShrink: 0 }}>{label}</span>}
    <div style={{ flex: 1, height: '1px', background: colors.border }} />
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
  const { isMobile, isTablet, isDesktop } = useBreakpoint();

  const {
    products, categories,
    fetchProducts, fetchCategories,
    deleteProduct, adjustStock, createProduct, updateProduct,
  } = useProductStore();

  type InventoryTab = 'overview' | 'analytics' | 'movements' | 'categories';
  const [activeTab, setActiveTab]           = useState<InventoryTab>('overview');
  const [viewMode, setViewMode]             = useState<'table' | 'grid'>('table');
  const [showModal, setShowModal]           = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds]       = useState<number[]>([]);
  const [sortField, setSortField]           = useState<'name' | 'stock_quantity' | 'selling_price'>('name');
  const [sortDirection, setSortDirection]   = useState<'asc' | 'desc'>('asc');
  const [toast, setToast]                   = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [bulkArchiveConfirm, setBulkArchiveConfirm] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm]   = useState(false);
  const [deleteConfirmId, setDeleteConfirmId]       = useState<number | null>(null);

  const { movements, loading: movementsLoading }          = useInventoryMovements(6);
  const { movements: fullMovements, loading: fullMovementsLoading } = useInventoryMovements(500);
  const filteredProductsResult = useInventoryFilters(products, categories);
  const stats = useInventoryStats(products);

  const sortedProducts = useMemo(() => {
    const copy = [...filteredProductsResult.filteredProducts];
    const dir  = sortDirection === 'asc' ? 1 : -1;
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

  const handleSelectRow = useCallback((id: number, selected: boolean) =>
    setSelectedIds(p => selected ? [...p, id] : p.filter(i => i !== id)), []);

  const handleSelectAll = useCallback((selected: boolean) =>
    setSelectedIds(selected ? pagination.pageItems.map(p => p.id) : []), [pagination.pageItems]);

  const handleEdit        = useCallback((p: Product) => { setEditingProduct(p); setShowModal(true); }, []);
  const handleAdjust      = useCallback((p: Product) => { setSelectedProduct(p); setShowStockModal(true); }, []);
  const handleViewDetails = useCallback((p: Product) => { window.location.href = `/products/${p.id}`; }, []);

  const handleBulkAdjust = useCallback(() => {
    if (!selectedIds.length) return;
    const p = products.find(p => p.id === selectedIds[0]);
    if (p) { setSelectedProduct(p); setShowStockModal(true); }
  }, [selectedIds, products]);

  const handleBulkArchive = useCallback(async () => {
    if (!selectedIds.length) return;
    setBulkArchiveConfirm(true);
  }, [selectedIds]);

  const confirmBulkArchive = useCallback(async () => {
    if (!selectedIds.length) return;
    setBulkArchiveConfirm(false);
    const role = useAuthStore.getState().user?.role;
    let ok = 0;
    for (const id of selectedIds) if (await updateProduct(id, { is_available: false }, role)) ok++;
    setToast({ type: ok === selectedIds.length ? 'success' : 'error', msg: t('products.bulkArchiveResult', { success: ok, total: selectedIds.length }) });
    setSelectedIds([]); fetchProducts();
  }, [selectedIds, updateProduct, fetchProducts, t]);

  const handleBulkDelete = useCallback(async () => {
    if (!selectedIds.length) return;
    setBulkDeleteConfirm(true);
  }, [selectedIds]);

  const confirmBulkDelete = useCallback(async () => {
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

  const requestDelete = useCallback((id: number) => {
    setDeleteConfirmId(id);
  }, []);

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

  const handleDelete = useCallback(async (id: number) => {
    requestDelete(id);
  }, [requestDelete]);

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
        if (res.error === 'PRODUCT_SKU_DUPLICATE') msg = t('products.skuDuplicate');
        setToast({ type: 'error', msg });
        return;
      }
      setToast({ type: 'success', msg: editingProduct ? t('products.savedSuccess', { name: data.name }) : t('products.createdSuccess', { name: data.name }) });
    } catch (err: any) {
      console.error('[ProductsPage] save error:', err);
      setToast({ type: 'error', msg: err.message || t('common.error') });
    } finally {
      setEditingProduct(null); setShowModal(false); fetchProducts(); fetchCategories();
    }
  }, [editingProduct, fetchProducts, fetchCategories, createProduct, updateProduct, t]);

  // Tabs
  const tabs: Array<{ id: InventoryTab; label: string; icon: string }> = [
    { id: 'overview',    label: t('products.tabOverview'),    icon: '📦' },
    { id: 'analytics',  label: t('products.tabAnalytics'),   icon: '📊' },
    { id: 'movements',  label: t('products.tabMovements'),   icon: '📋' },
    { id: 'categories', label: t('products.tabCategories'),  icon: '🏷️' },
  ];

  // ── Contenu des onglets ────────────────────────────────────────────────────
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
                  <div className="pp-product-grid">
                    {pagination.pageItems.map(p => (
                      <ProductCard
                        key={p.id}
                        product={p}
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
            {/* Header */}
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'flex-start' : 'center',
              gap: '10px',
              marginBottom: isMobile ? '16px' : '24px',
            }}>
              <div>
                <h2 style={{ fontSize: dt.text.lg, fontWeight: 800, color: colors.text1, letterSpacing: '-0.02em', margin: 0 }}>
                  {t('products.fullMovementHistory')}
                </h2>
                <p style={{ fontSize: dt.text.sm, color: colors.text3, marginTop: '4px' }}>
                  Historique complet des mouvements de stock
                </p>
              </div>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '7px',
                padding: '6px 14px', borderRadius: 999,
                background: colors.surface, border: `1px solid ${colors.border}`,
                fontSize: dt.text.xs, fontWeight: 600, color: colors.text2,
                flexShrink: 0,
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: colors.accent?.green }} />
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

  // ── Rendu principal ────────────────────────────────────────────────────────
  const mainPad = isMobile ? '12px 10px' : isTablet ? '20px 18px' : '36px 32px';

  return (
    <div className="pp-root">
      <GlobalStyles colors={colors} />

      <main
        style={{
          background: colors.bg,
          minHeight: '100vh',
          padding: mainPad,
        }}
      >
        <div
          style={{
            maxWidth: 1600,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? '12px' : '20px',
          }}
        >
          {/* Layout : sidebar (desktop) + contenu principal */}
          <div className="pp-layout" style={{ display: 'block', width: '100%', minWidth: 0 }}>

            {/* Sidebar desktop */}
            <Sidebar activeTab={activeTab} tabs={tabs} onTabChange={setActiveTab} t={t} colors={colors} />

            {/* Zone contenu */}
            <div style={{ minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '20px' }}>

              {/* En-tête page */}
              <InventoryHeader
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onExport={handleExport}
                onCreate={() => { setEditingProduct(null); setShowModal(true); }}
                activeFiltersCount={filteredProductsResult.activeFiltersCount}
                onClearFilters={filteredProductsResult.clearFilters}
                canCreate={can('product.create')}
              />

              {/* Tabs horizontaux (tablette + desktop sans sidebar) */}
              <HorizontalTabs activeTab={activeTab} tabs={tabs} onTabChange={setActiveTab} colors={colors} />

              {/* Contenu onglet */}
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
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <Toast
          type={toast.type} msg={toast.msg}
          isMobile={isMobile} colors={colors}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Navigation mobile */}
      <MobileNav
        activeTab={activeTab} tabs={tabs} onTabChange={setActiveTab}
        hasFilters={filteredProductsResult.activeFiltersCount > 0}
        onClearFilters={filteredProductsResult.clearFilters}
        colors={colors}
      />

      {/* Modales */}
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

      {/* Premium delete confirmation dialogs */}
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
        title={t('products.bulkArchiveConfirmTitle') || 'Confirmer l\'archivage'}
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