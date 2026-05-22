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

export const ProductsGrid: React.FC<ProductsGridProps> = ({ onProductClick }) => {
  const { t, lang } = useI18n();
  const { currency } = useSettingsStore();
  const { products, loading: isLoading, fetchProducts } = useProductStore();
  const { addToCart } = usePOSStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [pressedId, setPressedId] = useState<number | null>(null);

  const fmtPrice = (p: number) => formatPrice(p, currency, lang);

  // ── Bootstrap ─────────────────────────────────────────────────────
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);   // run once on mount — zustand functions are stable

  // ── Categories: derived from products, zero stale-state risk ───────
  const categories = useMemo(() => {
    return [...new Set(products.map(p => p.category_name).filter(Boolean))]
      .sort() as string[];
  }, [products]);

  // ── Filtered products ─────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return products.filter(p => {
      const nameMatch    = !q || p.name.toLowerCase().includes(q);
      const barcodeMatch = !q || (p.barcode ?? '').toLowerCase().includes(q) || p.id.toString().includes(q);
      const matchesSearch = nameMatch || barcodeMatch;
      const matchesCategory = selectedCategory === 'all' || p.category_name === selectedCategory;
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

  // ── Loading skeleton ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ flex: 1, background: colors.bg, padding: '24px' }}>
        <div style={{ height: '44px', background: colors.card, borderRadius: radius.md, marginBottom: '24px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' }}>
          {[...Array(12)].map((_, i) => (
            <div key={i} style={{ height: '180px', background: colors.card, borderRadius: radius.lg, border: `1px solid ${colors.border}`, opacity: 0.5 }} className="animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div style={{ flex: '1 1 0%', minHeight: 0, background: colors.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100vh',overflowY: 'auto', paddingBottom: '200px' }} className="custom-scroll">

      {/* Control Header */}
      <div style={{ padding: '20px 24px', background: colors.surface, borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: colors.accent.blueDim, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.accent.blue }}>
              <Search size={16} />
            </div>
            <span style={{ fontSize: '15px', fontWeight: 800, color: colors.text1 }}>{t('pos.menuTitle')}</span>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 800, color: colors.text3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {t('pos.availableItems', { count: filteredProducts.length })}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'stretch' }}>

          {/* Category chips — data-driven, never hardcoded */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none', padding: '2px', whiteSpace: 'nowrap' }} className="custom-scroll">
              <button
                onClick={() => setSelectedCategory('all')}
                style={{
                  padding: '10px 18px', fontSize: '12px', fontWeight: 800,
                  borderRadius: radius.md, cursor: 'pointer', whiteSpace: 'nowrap',
                  background: selectedCategory === 'all' ? colors.accent.gold : colors.card,
                  color: selectedCategory === 'all' ? colors.bg : colors.text2,
                  border: `1px solid ${selectedCategory === 'all' ? colors.accent.gold : colors.border}`,
                  transition: 'all 0.2s',
                }}
              >
                {t('pos.allCategory')}
              </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '10px 18px', fontSize: '12px', fontWeight: 800,
                  borderRadius: radius.md, cursor: 'pointer', whiteSpace: 'nowrap',
                  background: selectedCategory === cat ? colors.accent.gold : colors.card,
                  color: selectedCategory === cat ? colors.bg : colors.text2,
                  border: `1px solid ${selectedCategory === cat ? colors.accent.gold : colors.border}`,
                  transition: 'all 0.2s',
                }}
              >
                {cat.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: colors.text3 }} />
            <input
              type="text"
              placeholder={t('pos.searchPlaceholder')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%', background: colors.card, border: `1px solid ${colors.border}`,
                borderRadius: radius.md, padding: '12px 14px 12px 42px',
                color: colors.text1, fontSize: '14px', outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = colors.accent.blue}
              onBlur={e => e.target.style.borderColor = colors.border}
            />
          </div> 
          
        </div>
      </div>

      {/* Products Grid — Scroll vertical professionnel et fiable */}
      <div 
        style={{ 
          display: 'flex',
          flexDirection: 'column',

          flex: '1 1 0%',
          minHeight: 0,

          height: '100%',

          overflowY: 'auto',
          overflowX: 'hidden',

          padding: '24px',

          scrollbarWidth: 'thin',
          WebkitOverflowScrolling: 'touch',

          overscrollBehavior: 'contain',
        }}
        className="custom-scroll"
      >
        {filteredProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: colors.text3 }}>
            <Package size={64} strokeWidth={1} style={{ marginBottom: '24px', opacity: 0.2 }} />
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: colors.text2, marginBottom: '8px' }}>{t('pos.noProductsFound')}</h3>
            <p style={{ fontSize: '13px' }}>{t('pos.adjustFilters')}</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '16px' }} className="custom-scroll">
            {filteredProducts.map(product => {
              const isOos     = product.stock_quantity <= 0;
              const isLow     = product.stock_quantity > 0 && product.stock_quantity <= 5;
              const isPressed = pressedId === product.id;

              return (
                <div
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  style={{
                    background: colors.card,
                    borderRadius: radius.lg,
                    border: `1px solid ${isOos ? colors.border : isLow ? colors.accent.amber + '44' : colors.border}`,
                    cursor: isOos ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflow: 'hidden',
                    transform:  isPressed ? 'scale(0.95)' : 'scale(1)',
                    display:    'flex',
                    flexDirection: 'column',
                    position:   'relative',
                    boxShadow:  isPressed ? shadows.glow : 'none',
                    opacity:    isOos ? 0.4 : 1,
                  }}
                  onMouseOver={e => {
                    if (isOos) return;
                    e.currentTarget.style.borderColor = colors.borderHi;
                    e.currentTarget.style.transform     = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow    = shadows.hard;
                  }}
                  onMouseOut={e => {
                    if (isOos) return;
                    e.currentTarget.style.borderColor = isLow ? colors.accent.amber + '44' : colors.border;
                    e.currentTarget.style.transform   = 'translateY(0)';
                    e.currentTarget.style.boxShadow   = 'none';
                  }}
                >
                  {/* Visual Area — fixed size so every card is exactly the same height */}
                  <div style={{
                    width:     '100%',
                    height:    '128px',                 /* fixed pixel height — no more unequal cards */
                    boxSizing: 'border-box',
                    position:  'relative',
                    overflow:  'hidden',
                    borderBottom: `1px solid ${colors.border}`,
                  }}>
                    {product.image_url ? (
                      <img
                        src={product.image_url} alt={product.name}
                        /* image always fills.asset visual area — any source aspect ratio is cropped */
                        style={{
                          position:  'absolute', inset: 0,  /* ← pins image to all 4 edges */
                          width:     '100%', height: '100%',
                          objectFit: 'cover',               /* ← crop to fill without stretching */
                          objectPosition: 'center center',
                        }}
                      />
                    ) : (
                      /* Centered placeholder when no image */
                      <div style={{
                        width: '100%', height: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(255,255,255,0.015)',
                      }}>
                        <Package size={32} color={colors.text3} strokeWidth={1.5} />
                      </div>
                    )}

                    {/* Floating badge */}
                    <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                      {isOos ? (
                        <div style={{ background: colors.accent.red, color: colors.bg, padding: '3px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 900 }}>{t('pos.stockBadgeOut')}</div>
                      ) : isLow ? (
                        <div style={{ background: colors.accent.amber, color: colors.bg, padding: '3px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 900 }}>{t('pos.stockBadgeLow')}</div>
                      ) : null}
                    </div>
                  </div>

                  {/* Product Info */}
                  <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '9px', fontWeight: 800, color: colors.accent.blue, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                      {product.category_name}
                    </span>
                    <h4 style={{
                      fontSize: '13px', fontWeight: 700, color: colors.text1,
                      margin: '0 0 10px', lineHeight: 1.3, height: '34px',
                      overflow: 'hidden', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>
                      {product.name}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: isOos ? colors.accent.red : isLow ? colors.accent.amber : colors.text2 }}>
                        {t('pos.stockQuantity', { count: product.stock_quantity })}
                      </span>
                      {product.stock_quantity > 0 && product.stock_quantity <= 5 ? (
                        <span style={{ fontSize: '10px', fontWeight: 800, color: colors.accent.amber, background: 'rgba(251,191,36,0.12)', borderRadius: radius.md, padding: '2px 8px' }}>
                          {t('pos.stockBadgeLow')}
                        </span>
                      ) : null}
                    </div>
                    <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="mono" style={{ fontSize: '18px', fontWeight: 700, color: colors.accent.gold }}>
                        {fmtPrice(product.selling_price)}
                      </span>
                      <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.text3 }}>
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

      <style>{`
        .animate-pulse { animation: pulse 1.5s infinite ease-in-out; }
      `}</style>
    </div>
  );
};
