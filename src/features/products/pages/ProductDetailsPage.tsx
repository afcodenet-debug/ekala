import React, { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Package, DollarSign, History,
  ShoppingCart, TrendingUp, Hash, Barcode, Tag, Calendar,
  Info
} from 'lucide-react';
import { api } from '../../../lib/api-client';
import { EnterpriseTokens } from '../../../lib/design-system';
import { useI18n } from '../../../lib/i18n';
import { useSettingsStore } from '../../../stores/useSettingsStore';
import { formatPrice } from '../../../lib/i18n/currency';
import { Product, InventoryMovement } from '../types';

const { colors, radius } = EnterpriseTokens;

// ── Tab key ─────────────────────────────────────────────────────────
type TabKey = 'overview' | 'stock-history' | 'sales-history' | 'analytics';

interface Tab {
  key: TabKey;
  labelKey: string;
  icon: React.ElementType;
}

const TABS: Tab[] = [
  { key: 'overview',        labelKey: 'products.detailsOverview', icon: Info },
  { key: 'stock-history',   labelKey: 'products.stockHistory',   icon: History },
  { key: 'sales-history',   labelKey: 'products.salesHistory',   icon: ShoppingCart },
  { key: 'analytics',       labelKey: 'products.productAnalytics',icon: TrendingUp },
];

// ── helpers ─────────────────────────────────────────────────────────
const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString() : '—';

const timeAgo = (iso: string) => {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const secs = Math.floor((now - then) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

const movementBadge = (type: string) => {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    purchase:     { bg: 'rgba(34,197,94,0.12)',  color: colors.accent.green, label: 'Purchase' },
    sale:         { bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6',           label: 'Sale' },
    adjustment:   { bg: 'rgba(212,175,55,0.12)',  color: colors.accent.gold,  label: 'Adjustment' },
    transfer:     { bg: 'rgba(139,92,246,0.12)',  color: '#8b5cf6',           label: 'Transfer' },
    waste:        { bg: 'rgba(239,68,68,0.12)',   color: colors.accent.red,   label: 'Waste' },
    damaged:      { bg: 'rgba(239,68,68,0.12)',   color: colors.accent.red,   label: 'Damaged' },
    return:       { bg: 'rgba(34,197,94,0.12)',   color: colors.accent.green, label: 'Return' },
    inventory_count:{ bg:'rgba(139,92,246,0.12)', color: '#8b5cf6',           label: 'Count' },
    in:           { bg: 'rgba(34,197,94,0.12)',   color: colors.accent.green, label: 'IN' },
    out:          { bg: 'rgba(239,68,68,0.12)',   color: colors.accent.red,   label: 'OUT' },
  };
  return map[type] ?? { bg: colors.surface, color: colors.text3, label: type };
};

// ══════════════════════════════════════════════════════════════════════
//  COMPONENT
// ══════════════════════════════════════════════════════════════════════
export const ProductDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { currency, language: lang } = useSettingsStore();

  const productId = parseInt(id ?? '', 10);

  // ── Queries ───────────────────────────────────────────────────────────
  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: [`product-detail-${productId}`],
    queryFn: () => api.products.getById(productId) as Promise<Product>,
    enabled: !!productId,
  });

  const { data: history } = useQuery({
    queryKey: [`product-history-${productId}`],
    queryFn: () => api.inventory.getProductHistory(productId) as Promise<{ product: Product; saleItems: any[]; movements: InventoryMovement[] }>,
    enabled: !!productId,
    staleTime: 30_000,
  });

  const [activeTab, setActiveTab] = React.useState<TabKey>('overview');

  // ── Derived stats ────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!product) return null;
    const margin = product.selling_price - product.buying_price;
    const marginPct = product.selling_price > 0
      ? ((margin / product.selling_price) * 100).toFixed(1) + '%'
      : '—';
    const totalQtySold = (history?.saleItems ?? []).reduce((s, si) => s + si.quantity, 0);
    const totalRevenue = (history?.saleItems ?? []).reduce((s, si) => s + si.total_price, 0);
    const totalCost = totalQtySold * product.buying_price;
    const grossProfit = totalRevenue - totalCost;
    return { margin, marginPct, totalQtySold, totalRevenue, totalCost, grossProfit };
  }, [product, history]);

  if (productLoading || !productId || isNaN(productId)) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: colors.text3 }}>
        {t('loading') || 'Loading…'}
      </div>
    );
  }

  if (!product && !productLoading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <p style={{ color: colors.text3, marginBottom: 24 }}>{t('products.noProducts')}</p>
        <button onClick={() => navigate('/products')} className="btn-primary">
          ← {t('sidebar.stock')}
        </button>
      </div>
    );
  }

  const fmt = (v: number) => formatPrice(v, currency, lang);
  const p = product!;

  // ── Tab content ──────────────────────────────────────────────────────
  const tabContent = (): React.ReactNode => {
    switch (activeTab) {
      case 'overview':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {/* Stock Info Card */}
            <InfoCard title={t('products.stock')} accent={colors.accent.blue}>
              <div style={{ fontSize: 38, fontWeight: 800, color: colors.text1 }} className="mono">{p.stock_quantity}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: colors.text3 }}>Min: <b>{p.minimum_stock}</b> · {p.unit}</div>
            </InfoCard>

            {/* Margin Card */}
            <InfoCard title={t('products.grossMargin')} accent={colors.accent.green}>
              <div style={{ fontSize: 38, fontWeight: 800, color: colors.text1 }} className="mono">{
                p.selling_price > 0
                  ? ((p.selling_price - p.buying_price) / p.selling_price * 100).toFixed(1) + '%'
                  : '—'
              }</div>
              <div style={{ marginTop: 4, fontSize: 12, color: colors.text3 }}>{fmt(p.selling_price - p.buying_price)} {t('products.unitProfit')?.toLowerCase()}</div>
            </InfoCard>

            {/* Valuation Card */}
            <InfoCard title="Inventory Value" accent={colors.accent.gold}>
              <div style={{ fontSize: 28, fontWeight: 800, color: colors.text1 }} className="mono">{fmt(p.buying_price * p.stock_quantity)}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: colors.text3 }}>cost of stock on hand</div>
            </InfoCard>

            {/* Pricing Card */}
            <InfoCard title="Pricing" accent={colors.accent.blue}>
              <div style={{ fontSize: 13, color: colors.text1, lineHeight: 2.2 }}>
                <div>Buy: <b style={{ color: colors.accent.red }}>{fmt(p.buying_price)}</b></div>
                <div>Sell: <b style={{ color: colors.accent.green }}>{fmt(p.selling_price)}</b></div>
                <div>Margin: <b>{fmt(p.selling_price - p.buying_price)}</b></div>
              </div>
            </InfoCard>

            {/* Info Grid */}
            <section style={{
              background: colors.card, border: `1px solid ${colors.border}`,
              borderRadius: radius.xl, padding: '24px',
              gridColumn: '1 / -1',
            }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: colors.text1, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Info size={16} color={colors.text3} />
                {t('products.description')}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
                <Field label={t('products.productName')} value={p.name} />
                <Field label={t('products.barcode') || 'Barcode'} value={p.barcode || '—'} />
                <Field label={t('products.category')} value={p.category_name} />
                <Field label={t('products.unit')} value={p.unit} />
                <Field label={t('common.status')} value={p.is_available ? t('products.inStockStatus') : t('products.outStockStatus')} />
                <Field label="ID" value={`#${p.id}`} mono />
                <Field label="Created" value={formatDate(p.created_at)} />
                <Field label="Updated" value={formatDate(p.updated_at)} />
              </div>
              {p.description && (
                <div style={{ marginTop: 20, padding: '14px 18px', background: colors.surface, borderRadius: radius.md }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: colors.text3, marginBottom: 6, textTransform: 'uppercase' }}>{t('products.description')}</div>
                  <div style={{ fontSize: 14, color: colors.text2, lineHeight: 1.6 }}>{p.description}</div>
                </div>
              )}
            </section>
          </div>
        );

      case 'stock-history':
        const movements = history?.movements ?? [];
        return (
          <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: radius.xl, overflow: 'hidden' }}>
            <div style={{
              padding: '16px 24px', borderBottom: `1px solid ${colors.border}`,
              fontSize: 14, fontWeight: 700, color: colors.text1, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span>{t('products.stockHistory')}</span>
              <span style={{ fontSize: 12, color: colors.text3 }}>{movements.length} moves</span>
            </div>
            {movements.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: colors.text3, fontSize: 14 }}>No movements recorded</div>
            ) : (
              <div>
                {movements.map((m: InventoryMovement) => {
                  const badge = movementBadge(m.type);
                  const isAdd = (m.quantity_changed ?? 0) >= 0;
                  return (
                    <div key={m.id} style={{
                      display: 'grid', gridTemplateColumns: '180px 100px 100px 80px 1fr 160px',
                      padding: '14px 24px', borderBottom: `1px solid ${colors.border}20`,
                      fontSize: 13, alignItems: 'center', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = colors.surface)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <History size={13} color={colors.text3} />
                        {timeAgo(m.created_at ?? new Date().toISOString())}
                      </span>
                      <span style={{
                        padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                        background: badge.bg, color: badge.color, width: 'fit-content',
                      }}>
                        {badge.label}
                      </span>
                      <span style={{
                        fontFeatureSettings: 'tnum', fontWeight: 700,
                        color: isAdd ? colors.accent.green : colors.accent.red,
                      }}>
                        {isAdd ? '+' : ''}{m.quantity_changed}
                      </span>
                      <span style={{ fontFeatureSettings: 'tnum', color: colors.text3 }}>
                        {m.quantity_before ?? '—'} → {m.quantity_after ?? '—'}
                      </span>
                      <span style={{ color: colors.text3 }}>{m.reason || '—'}</span>
                      <span style={{ color: colors.text3, fontSize: 12, textAlign: 'right' }}>{formatDate(m.created_at)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'sales-history':
        const sales = history?.saleItems ?? [];
        return (
          <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: radius.xl, overflow: 'hidden' }}>
            <div style={{
              padding: '16px 24px', borderBottom: `1px solid ${colors.border}`,
              fontSize: 14, fontWeight: 700, color: colors.text1, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span>{t('products.salesHistory')}</span>
              <span style={{ fontSize: 12, color: colors.text3 }}>{sales.length} sales</span>
            </div>
            {sales.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: colors.text3, fontSize: 14 }}>No sales recorded</div>
            ) : (
              <div>
                {sales.map((s: any) => (
                  <div key={s.id} style={{
                    display: 'grid', gridTemplateColumns: '160px 120px 100px 120px 120px 1fr',
                    padding: '14px 24px', borderBottom: `1px solid ${colors.border}20`,
                    fontSize: 13, alignItems: 'center',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = colors.surface)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontFeatureSettings: 'tnum', color: colors.text3 }}>{formatDate(s.created_at)}</span>
                    <span style={{
                      background: `${colors.accent.blue}18`, color: colors.accent.blue,
                      padding: '3px 10px', borderRadius: 6, fontWeight: 700, fontSize: 12, width: 'fit-content',
                    }}>
                      {s.invoice_number}
                    </span>
                    <span style={{ fontFeatureSettings: 'tnum', fontWeight: 700, color: colors.text1 }}>{s.quantity}</span>
                    <span style={{ color: colors.text3 }}>{fmt(s.unit_price)}</span>
                    <span style={{ fontWeight: 800, color: colors.accent.green, fontFeatureSettings: 'tnum' }}>{fmt(s.total_price)}</span>
                    <span style={{ color: colors.text3, fontSize: 12 }}>{s.payment_method?.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'analytics':
        if (!stats) return <div style={{ padding: 48, textAlign: 'center', color: colors.text3 }}>—</div>;
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            <StatCard label={t('products.totalInvValue')} value={fmt(stats.totalRevenue)} sub={t('products.salesHistory')} accent={colors.accent.blue} />
            <StatCard label={t('analytics.potentialProfit')} value={fmt(stats.grossProfit)} sub={t('analytics.potentialProfitSub')} accent={colors.accent.green} />
            <StatCard label={`${t('products.unitProfit')} / Qty`} value={fmt((p.selling_price - p.buying_price) * stats.totalQtySold)} sub={`x${stats.totalQtySold} sold`} accent={colors.accent.gold} />
            <StatCard label={t('products.stock')} value={`${p.stock_quantity} ${p.unit}`} sub={`min ${p.minimum_stock}`} accent={p.stock_quantity <= p.minimum_stock ? colors.accent.red : colors.accent.green} />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ minHeight: '100vh', padding: '32px' }} className="animate-fade">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <button onClick={() => navigate(-1)} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'none', border: 'none', color: colors.text3,
          cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 18,
        }}>
          <ArrowLeft size={16} /> {t('common.back') || 'Back'}
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {p.image_url ? (
              <img src={p.image_url} alt={p.name}
                style={{ width: 80, height: 80, borderRadius: radius.lg, objectFit: 'cover', border: `1px solid ${colors.border}` }}
              />
            ) : (
              <div style={{
                width: 80, height: 80, borderRadius: radius.lg,
                background: `${colors.accent.blue}18`, border: `1px solid ${colors.accent.blue}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Package size={32} color={colors.accent.blue} />
              </div>
            )}
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: colors.text1 }}>{p.name}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap', color: colors.text3, fontSize: 13 }}>
                {p.barcode && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Barcode size={13} /> {p.barcode}</span>}
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Tag size={13} /> {p.category_name}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Hash size={13} /> #{p.id}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={13} /> {formatDate(p.created_at)}</span>
              </div>
            </div>
          </div>

          <Link to={`/products`} style={{
            padding: '10px 22px', background: colors.accent.gold, color: colors.bg,
            borderRadius: radius.md, fontSize: 13, fontWeight: 800, textDecoration: 'none',
          }}>
            ← Back to Inventory
          </Link>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: `1px solid ${colors.border}`, paddingBottom: 0 }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', background: 'transparent', border: 'none',
              borderBottom: active ? `3px solid ${colors.accent.gold}` : '3px solid transparent',
              color: active ? colors.accent.gold : colors.text3,
              fontWeight: active ? 700 : 500, fontSize: 13, cursor: 'pointer',
              transition: 'all 0.2s',
            }}>
              <Icon size={15} strokeWidth={active ? 2.5 : 2} />
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────── */}
      {tabContent()}
    </div>
  );
};

// ── Small helper components ─────────────────────────────────────────

const InfoCard: React.FC<{ title: string; accent: string; children: React.ReactNode }> = ({ title, accent, children }) => (
  <section style={{
    background: colors.card, border: `1px solid ${colors.border}`,
    borderRadius: radius.xl, padding: '24px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div style={{ width: 32, height: 32, borderRadius: radius.sm, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Package size={16} color={accent} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 800, color: colors.text3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</div>
    </div>
    {children}
  </section>
);

const StatCard: React.FC<{ label: string; value: React.ReactNode; sub?: string; accent: string }> = ({ label, value, sub, accent }) => (
  <div style={{
    background: colors.card, border: `1px solid ${colors.border}`,
    borderRadius: radius.xl, padding: '24px', position: 'relative', overflow: 'hidden',
  }}>
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div style={{ color: accent, marginBottom: 12 }}><DollarSign size={22} strokeWidth={2} /></div>
      <div style={{ fontSize: 30, fontWeight: 800, color: colors.text1, fontFeatureSettings: 'tnum' }} className="mono">{value}</div>
      <div style={{ fontSize: 11, fontWeight: 800, color: colors.text3, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: colors.text3, marginTop: 2, opacity: 0.7 }}>{sub}</div>}
    </div>
    <div style={{
      position: 'absolute', top: '-25%', right: '-8%',
      width: '120px', height: '120px',
      background: `radial-gradient(circle, ${accent}12 0%, transparent 65%)`,
      filter: 'blur(16px)',
    }} />
  </div>
);

const Field: React.FC<{ label: string; value: React.ReactNode; mono?: boolean }> = ({ label, value, mono }) => (
  <div>
    <div style={{ fontSize: 10, fontWeight: 800, color: colors.text3, textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.07em' }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 600, color: colors.text1, ...(mono && { fontFamily: "'JetBrains Mono', monospace" }) }}>{value}</div>
  </div>
);

export default ProductDetailsPage;
