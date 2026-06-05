import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Package, ChevronRight } from 'lucide-react';
import { usePOSStore } from '../../../stores/usePOSStore';
import { useProductStore } from '../../products/hooks/useProductStore';
import type { Product } from '../../products/types';
import { useI18n } from '../../../lib/i18n';
import { useSettingsStore } from '../../../stores/useSettingsStore';
import { formatPrice } from '../../../lib/i18n/currency';
import { EnterpriseTokens } from '../../../lib/design-system';

interface ProductsGridProps {
  onProductClick: (product: Product) => void;
}

const { colors, radius, shadows } = EnterpriseTokens;

/* ─── Responsive styles ──────────────────────────────────────────────────── */
const GRID_STYLES = `
  /* ── Root container ─────────────────────────────────────────── */
  .pg-root {
    flex: 1 1 0%;
    min-height: 0;
    background: ${colors.bg};
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100%;
    overflow-y: auto;
    padding-bottom: 200px;
  }
  .pg-root::-webkit-scrollbar { width: 3px; }
  .pg-root::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

  /* ── Control header ─────────────────────────────────────────── */
  .pg-header {
    padding: 20px 24px;
    background: ${colors.surface};
    border-bottom: 1px solid ${colors.border};
    flex-shrink: 0;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .pg-header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    gap: 10px;
  }
  .pg-header-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .pg-title-icon {
    width: 32px; height: 32px;
    border-radius: 8px;
    background: ${colors.accent.blueDim};
    display: flex; align-items: center; justify-content: center;
    color: ${colors.accent.blue};
    flex-shrink: 0;
  }
  .pg-count-label {
    font-size: 11px; font-weight: 800;
    color: ${colors.text3};
    text-transform: uppercase;
    letter-spacing: 0.1em;
    white-space: nowrap;
  }

  /* Category chips strip */
  .pg-cats {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    scrollbar-width: none;
    padding: 2px 0;
    white-space: nowrap;
    -webkit-overflow-scrolling: touch;
    margin-bottom: 12px;
  }
  .pg-cats::-webkit-scrollbar { display: none; }
  .pg-cat-btn {
    padding: 10px 18px;
    font-size: 12px; font-weight: 800;
    border-radius: ${radius.md};
    cursor: pointer; white-space: nowrap;
    transition: all 0.2s;
    font-family: inherit;
    flex-shrink: 0;
    min-height: 40px;
  }

  /* Search bar */
  .pg-search-wrap { position: relative; }
  .pg-search-icon {
    position: absolute; left: 14px; top: 50%;
    transform: translateY(-50%);
    color: ${colors.text3};
    pointer-events: none;
  }
  .pg-search-input {
    width: 100%;
    background: ${colors.card};
    border: 1px solid ${colors.border};
    border-radius: ${radius.md};
    padding: 12px 14px 12px 42px;
    color: ${colors.text1};
    font-size: 14px; outline: none;
    transition: border-color 0.2s;
    min-height: 46px;
    box-sizing: border-box;
  }

  /* ── Scrollable body ────────────────────────────────────────── */
  .pg-body {
    flex: 1 1 0%;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 24px;
    scrollbar-width: thin;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }
  .pg-body::-webkit-scrollbar { width: 3px; }
  .pg-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

  /* ── Product grid ───────────────────────────────────────────── */
  .pg-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 16px;
  }

  /* ── Product card ───────────────────────────────────────────── */
  .pg-card {
    background: ${colors.card};
    border-radius: ${radius.lg};
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
    /* Touch tap */
    -webkit-tap-highlight-color: transparent;
  }
  .pg-card-img {
    width: 100%;
    height: 128px;
    box-sizing: border-box;
    position: relative;
    overflow: hidden;
    border-bottom: 1px solid ${colors.border};
  }
  .pg-card-info { padding: 14px; flex: 1; display: flex; flex-direction: column; }

  /* ── Empty / loading states ─────────────────────────────────── */
  .pg-empty {
    text-align: center;
    padding: 80px 20px;
    color: ${colors.text3};
  }
  .pg-skel-wrap {
    flex: 1;
    background: ${colors.bg};
    padding: 24px;
  }
  .pg-skel-bar {
    height: 44px;
    background: ${colors.card};
    border-radius: ${radius.md};
    margin-bottom: 24px;
  }

  /* ═══════════════════════════════════════════════════════════════
     RESPONSIVE — mobile-first
  ═══════════════════════════════════════════════════════════════ */

  /* ── Tablets (≤ 1024 px) ────────────────────────────────────── */
  @media (max-width: 1024px) {
    .pg-header      { padding: 16px 20px; }
    .pg-body        { padding: 20px; }
    .pg-grid        { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
    .pg-card-img    { height: 116px; }
  }

  /* ── Large phones / phablets (≤ 768 px) ────────────────────── */
  /* On mobile the panel is stacked below products grid;          */
  /* use a 2-col fixed grid so cards don't become tiny.           */
  @media (max-width: 768px) {
    .pg-header      { padding: 12px 14px; position: static; }
    .pg-header-top  { margin-bottom: 12px; }
    .pg-header-top .pg-count-label { display: none; } /* reclaim space */

    .pg-title-icon  { width: 28px; height: 28px; border-radius: 7px; }
    .pg-title-icon svg { width: 14px !important; height: 14px !important; }
    .pg-header-top span[style] { font-size: 14px !important; }

    .pg-cats        { gap: 6px; margin-bottom: 10px; }
    .pg-cat-btn     { padding: 8px 14px; font-size: 11px; min-height: 36px; }

    .pg-search-input { padding: 10px 12px 10px 38px; font-size: 13px; min-height: 42px; }
    .pg-search-icon svg { width: 14px !important; height: 14px !important; }

    .pg-body        { padding: 14px; }
    /* 2-column grid, fixed width so cards feel intentional */
    .pg-grid        { grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .pg-card-img    { height: 100px; }
    .pg-card-info   { padding: 10px 11px; }

    .pg-empty       { padding: 48px 16px; }
  }

  /* ── Standard phones (≤ 640 px) ────────────────────────────── */
  @media (max-width: 640px) {
    .pg-header      { padding: 10px 12px; }
    .pg-cat-btn     { padding: 7px 12px; font-size: 10.5px; min-height: 34px; }
    .pg-search-input { font-size: 13px; }

    .pg-body        { padding: 12px; }
    .pg-grid        { gap: 9px; }
    .pg-card-img    { height: 92px; }
    .pg-card-info   { padding: 9px 10px; }
  }

  /* ── Small phones (≤ 480 px) ────────────────────────────────── */
  @media (max-width: 480px) {
    .pg-header      { padding: 10px 10px 12px; }
    .pg-cat-btn     { padding: 6px 10px; font-size: 10px; min-height: 32px; }

    .pg-body        { padding: 10px; }
    .pg-grid        { gap: 8px; }
    .pg-card-img    { height: 86px; }
    .pg-card-info   { padding: 8px 9px; }

    /* Slightly smaller product name to fit 2 cols */
    .pg-card-info h4 { font-size: 12px !important; height: auto !important; }
    .pg-card-info .pg-price { font-size: 16px !important; }
    .pg-card-info .pg-chevron { display: none; } /* reclaim width */
  }

  /* ── Very small phones (≤ 360 px) ───────────────────────────── */
  @media (max-width: 360px) {
    .pg-grid        { grid-template-columns: repeat(2, 1fr); gap: 7px; }
    .pg-card-img    { height: 76px; }
    .pg-card-info   { padding: 7px 8px; }
    .pg-cat-btn     { padding: 5px 8px; font-size: 9.5px; }
  }

  /* ── Touch — larger tap targets ─────────────────────────────── */
  @media (pointer: coarse) {
    .pg-cat-btn     { min-height: 40px; }
    .pg-card        { cursor: pointer; }
  }

  .animate-pulse { animation: pg-pulse 1.5s infinite ease-in-out; }
  @keyframes pg-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
`;

export const ProductsGrid: React.FC<ProductsGridProps> = ({ onProductClick }) => {
  const { t, lang } = useI18n();
  const { currency } = useSettingsStore();
  const { products, loading: isLoading, fetchProducts } = useProductStore();
  const { addToCart } = usePOSStore();

  const [searchTerm, setSearchTerm]           = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [pressedId, setPressedId]             = useState<number | null>(null);

  const fmtPrice = (p: number) => formatPrice(p, currency, lang);

  /* Inject styles once */
  useEffect(() => {
    const id = 'pg-styles';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id;
      s.textContent = GRID_STYLES;
      document.head.appendChild(s);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const categories = useMemo(() =>
    [...new Set(products.map(p => p.category_name).filter(Boolean))].sort() as string[],
  [products]);

  const filteredProducts = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return products.filter(p => {
      const nameMatch    = !q || p.name.toLowerCase().includes(q);
      const barcodeMatch = !q || (p.barcode ?? '').toLowerCase().includes(q) || p.id.toString().includes(q);
      const matchesSearch    = nameMatch || barcodeMatch;
      const matchesCategory  = selectedCategory === 'all' || p.category_name === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  const handleProductClick = useCallback((product: Product) => {
    if (product.stock_quantity <= 0) return;
    addToCart({ id: product.id, name: product.name, selling_price: product.selling_price });
    onProductClick(product);
    setPressedId(product.id);
    setTimeout(() => setPressedId(null), 150);
  }, [addToCart, onProductClick]);

  /* ── Loading skeleton ── */
  if (isLoading) {
    return (
      <div className="pg-skel-wrap">
        <div className="pg-skel-bar animate-pulse" />
        <div className="pg-grid">
          {[...Array(12)].map((_, i) => (
            <div key={i} style={{ height: '180px', background: colors.card, borderRadius: radius.lg, border: `1px solid ${colors.border}`, opacity: 0.5 }} className="animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div className="pg-root custom-scroll">

      {/* ── Control Header ── */}
      <div className="pg-header">
        <div className="pg-header-top">
          <div className="pg-header-title">
            <div className="pg-title-icon">
              <Search size={16} />
            </div>
            <span style={{ fontSize: '15px', fontWeight: 800, color: colors.text1 }}>
              {t('pos.menuTitle')}
            </span>
          </div>
          <span className="pg-count-label">
            {t('pos.availableItems', { count: filteredProducts.length })}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Category chips */}
          <div className="pg-cats">
            <button
              className="pg-cat-btn"
              onClick={() => setSelectedCategory('all')}
              style={{
                background: selectedCategory === 'all' ? colors.accent.gold : colors.card,
                color:      selectedCategory === 'all' ? colors.bg : colors.text2,
                border:     `1px solid ${selectedCategory === 'all' ? colors.accent.gold : colors.border}`,
              }}
            >
              {t('pos.allCategory')}
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                className="pg-cat-btn"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  background: selectedCategory === cat ? colors.accent.gold : colors.card,
                  color:      selectedCategory === cat ? colors.bg : colors.text2,
                  border:     `1px solid ${selectedCategory === cat ? colors.accent.gold : colors.border}`,
                }}
              >
                {cat.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="pg-search-wrap">
            <Search size={16} className="pg-search-icon" />
            <input
              type="text"
              placeholder={t('pos.searchPlaceholder')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pg-search-input"
              onFocus={e => (e.target.style.borderColor = colors.accent.blue)}
              onBlur={e  => (e.target.style.borderColor = colors.border)}
            />
          </div>
        </div>
      </div>

      {/* ── Products Body ── */}
      <div className="pg-body">
        {filteredProducts.length === 0 ? (
          <div className="pg-empty">
            <Package size={64} strokeWidth={1} style={{ marginBottom: '24px', opacity: 0.2 }} />
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: colors.text2, marginBottom: '8px' }}>
              {t('pos.noProductsFound')}
            </h3>
            <p style={{ fontSize: '13px' }}>{t('pos.adjustFilters')}</p>
          </div>
        ) : (
          <div className="pg-grid">
            {filteredProducts.map(product => {
              const isOos     = product.stock_quantity <= 0;
              const isLow     = product.stock_quantity > 0 && product.stock_quantity <= 5;
              const isPressed = pressedId === product.id;

              return (
                <div
                  key={product.id}
                  className="pg-card"
                  onClick={() => handleProductClick(product)}
                  style={{
                    border:     `1px solid ${isLow ? colors.accent.amber + '44' : colors.border}`,
                    cursor:     isOos ? 'not-allowed' : 'pointer',
                    transform:  isPressed ? 'scale(0.95)' : 'scale(1)',
                    boxShadow:  isPressed ? shadows.glow : 'none',
                    opacity:    isOos ? 0.4 : 1,
                  }}
                  onMouseOver={e => {
                    if (isOos) return;
                    e.currentTarget.style.borderColor = colors.borderHi;
                    e.currentTarget.style.transform   = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow   = shadows.hard;
                  }}
                  onMouseOut={e => {
                    if (isOos) return;
                    e.currentTarget.style.borderColor = isLow ? colors.accent.amber + '44' : colors.border;
                    e.currentTarget.style.transform   = 'translateY(0)';
                    e.currentTarget.style.boxShadow   = 'none';
                  }}
                >
                  {/* Visual area */}
                  <div className="pg-card-img">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.015)' }}>
                        <Package size={32} color={colors.text3} strokeWidth={1.5} />
                      </div>
                    )}
                    {/* Stock badge */}
                    <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                      {isOos ? (
                        <div style={{ background: colors.accent.red, color: colors.bg, padding: '3px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 900 }}>
                          {t('pos.stockBadgeOut')}
                        </div>
                      ) : isLow ? (
                        <div style={{ background: colors.accent.amber, color: colors.bg, padding: '3px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 900 }}>
                          {t('pos.stockBadgeLow')}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="pg-card-info">
                    <span style={{ fontSize: '9px', fontWeight: 800, color: colors.accent.blue, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                      {product.category_name}
                    </span>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: colors.text1, margin: '0 0 10px', lineHeight: 1.3, height: '34px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {product.name}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: isOos ? colors.accent.red : isLow ? colors.accent.amber : colors.text2 }}>
                        {t('pos.stockQuantity', { count: product.stock_quantity })}
                      </span>
                      {isLow && (
                        <span style={{ fontSize: '10px', fontWeight: 800, color: colors.accent.amber, background: 'rgba(251,191,36,0.12)', borderRadius: radius.md, padding: '2px 8px' }}>
                          {t('pos.stockBadgeLow')}
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="mono pg-price" style={{ fontSize: '18px', fontWeight: 700, color: colors.accent.gold }}>
                        {fmtPrice(product.selling_price)}
                      </span>
                      <div className="pg-chevron" style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.text3 }}>
                        <ChevronRight size={14} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};