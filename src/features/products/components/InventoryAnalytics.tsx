import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, AlertTriangle, BarChart3,
  RefreshCw, Package, DollarSign, XCircle, Box
} from 'lucide-react';
import { api } from '../../../lib/api-client';
import { EnterpriseTokens } from '../../../lib/design-system';
import { useI18n } from '../../../lib/i18n';
import { useSettingsStore } from '../../../stores/useSettingsStore';
import { formatPrice } from '../../../lib/i18n/currency';

const { colors, radius } = EnterpriseTokens;

// ── Types ────────────────────────────────────────────────────────────
interface LowStockItem {
  product_id: number;
  product_name: string;
  category_name: string;
  stock: number;
  minimum_stock: number;
  urgency: 'critical' | 'warning';
}

interface TopSeller {
  product_id: number;
  product_name: string;
  category_name: string;
  units_sold: number;
  revenue: number;
  estimated_cost: number;
}

interface FastMoving {
  product_id: number;
  product_name: string;
  category_name: string;
  units_sold_30d: number;
  turnover_days: number;
}

interface DeadStock {
  product_id: number;
  product_name: string;
  stock_quantity: number;
  minimum_stock: number;
  units_sold_90d: number;
  dead_stock_value: number;
  category_name: string;
}

interface WasteItem {
  reason: string;
  occurrences: number;
  total_qty: number;
  total_cost: number;
}

interface AnalyticsData {
  valuation: {
    total_inventory_value:   number;
    potential_gross_profit:  number;
    actual_gross_profit:     number;
    active_skus:             number;
  };
  top_selling_products:   TopSeller[];
  low_stock_alerts:       LowStockItem[];
  dead_stock:             DeadStock[];
  fast_moving_items:      FastMoving[];
  waste_analytics:        WasteItem[];
  stock_turnover_summary: FastMoving[];
}

// ── KPI Card ─────────────────────────────────────────────────────────
interface KPICardProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ElementType;
  accent: string;
  delay?: number;
}

const KPICard: React.FC<KPICardProps> = ({ label, value, sub, icon: Icon, accent, delay = 0 }) => (
  <div
    className="animate-fade"
    style={{
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: radius.xl,
      padding: '28px 24px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 0.2s ease, border-color 0.2s ease',
      animationDelay: `${delay}ms`,
    }}
  >
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div style={{ color: accent, marginBottom: '18px' }}>
        <Icon size={24} strokeWidth={2} />
      </div>
      <div style={{
        fontSize: '32px', fontWeight: 800, marginBottom: '4px',
        letterSpacing: '-0.03em', color: colors.text1, fontFeatureSettings: 'tnum'
      }}
      className="mono"
      >
        {value}
      </div>
      <div style={{
        fontSize: '11px', fontWeight: 800, color: colors.text3,
        textTransform: 'uppercase', letterSpacing: '0.09em'
      }}
      >
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: '11px', color: colors.text3, marginTop: '4px', opacity: 0.75 }}>
          {sub}
        </div>
      )}
    </div>
    <div style={{
      position: 'absolute', top: '-25%', right: '-8%',
      width: '140px', height: '140px',
      background: `radial-gradient(circle, ${accent}12 0%, transparent 65%)`,
      filter: 'blur(18px)'
    }} />
  </div>
);

// ── Loading Skeleton ─────────────────────────────────────────────────
const KPISkeleton: React.FC = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '40px' }}>
    {[1, 2, 3, 4].map(i => (
      <div key={i} style={{
        background: colors.card, border: `1px solid ${colors.border}`,
        borderRadius: radius.xl, padding: '28px 24px', height: 130
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, background: colors.surface,
          marginBottom: 20, animation: 'pulse 1.2s infinite',
        }} />
        <div style={{
          width: '60%', height: 24, borderRadius: 6, background: colors.surface,
          marginBottom: 10, animation: 'pulse 1.2s infinite', animationDelay: `${i * 80}ms`,
        }} />
        <div style={{
          width: '40%', height: 12, borderRadius: 4, background: colors.surface,
          animation: 'pulse 1.2s infinite', animationDelay: `${i * 80 + 40}ms`,
        }} />
      </div>
    ))}
  </div>
);

// ── Empty State ──────────────────────────────────────────────────────
const EmptyState: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div style={{
    background: colors.card, border: `1px solid ${colors.border}`,
    borderRadius: radius.xl, padding: '60px 24px', textAlign: 'center'
  }}>
    <Box size={48} color={colors.text3} strokeWidth={1.5} style={{ marginBottom: 16 }} />
    <div style={{ fontSize: 18, fontWeight: 700, color: colors.text1, marginBottom: 8 }}>{title}</div>
    <div style={{ fontSize: 14, color: colors.text3 }}>{subtitle}</div>
  </div>
);

// ══════════════════════════════════════════════════════════════════════
//  COMPONENT
// ══════════════════════════════════════════════════════════════════════
export const InventoryAnalyticsPage: React.FC = () => {
  const { t } = useI18n();
  const { currency, language: lang } = useSettingsStore();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['inventory-analytics'],
    queryFn: () => api.inventory.getAnalytics() as Promise<AnalyticsData>,
    staleTime: 60_000,   // 1 min
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <KPISkeleton />;
  if (error || !data) return (
    <EmptyState title={t('analytics.unavailable')} subtitle={t('analytics.unavailableSub')} />
  );

  const { valuation, top_selling_products, low_stock_alerts, dead_stock, fast_moving_items, waste_analytics } = data;

  const fmt = (v: number) => formatPrice(v, currency, lang);
  const wastedTotal = waste_analytics.reduce((s, w) => s + w.total_cost, 0);

  return (
    <div style={{ paddingBottom: '80px' }} className="animate-fade">

      {/* ── Page Header ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '32px', flexWrap: 'wrap', gap: '16px'
      }}>
        <div>
          <h2 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>
            {t('analytics.inventoryAnalytics')}
          </h2>
          <p style={{ fontSize: 14, color: colors.text3, marginTop: 6 }}>
            {t('analytics.realTimeInsights')}
          </p>
        </div>
        <button onClick={() => refetch()} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 20px', borderRadius: radius.md,
          background: colors.surface, border: `1px solid ${colors.border}`,
          color: colors.text2, fontWeight: 700, cursor: 'pointer', fontSize: 13
        }}>
          <RefreshCw size={16} /> {t('analytics.refresh')}
        </button>
      </div>

      {/* ── KPI Grid ─────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '20px',
        marginBottom: '40px',
      }}
        role="region"
        aria-label={t('analytics.kpiRegion')}
      >
        <KPICard
          label={t('analytics.inventoryValue')}
          value={fmt(valuation.total_inventory_value)}
          sub={`${valuation.active_skus} ${t('analytics.activeSkus')}`}
          icon={Package}
          accent={colors.accent.blue}
          delay={0}
        />
        <KPICard
          label={t('analytics.potentialProfit')}
          value={fmt(valuation.potential_gross_profit)}
          sub={t('analytics.potentialProfitSub')}
          icon={TrendingUp}
          accent={colors.accent.green}
          delay={60}
        />
        <KPICard
          label={t('analytics.realisedProfit')}
          value={fmt(valuation.actual_gross_profit)}
          sub={t('analytics.realisedProfitSub')}
          icon={DollarSign}
          accent={colors.accent.gold}
          delay={120}
        />
        <KPICard
          label={t('analytics.lowStockAlerts')}
          value={low_stock_alerts.length}
          sub={t('analytics.lowStockAlertsSub')}
          icon={AlertTriangle}
          accent={colors.accent.red}
          delay={180}
        />
      </div>

      {/* ── Two-column layout ─────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
        gap: '24px',
        marginBottom: 32,
      }}>

        {/* ── Top Selling ─────────────────────────────────────────── */}
        <section style={{
          background: colors.card, border: `1px solid ${colors.border}`,
          borderRadius: radius.xl, padding: '24px', overflow: 'hidden'
        }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16, fontWeight: 800, marginBottom: 20 }}>
            <BarChart3 size={18} color={colors.accent.blue} />
            {t('analytics.topSellers')}
          </h3>

          {top_selling_products.length === 0 ? (
            <EmptyState title={t('analytics.noData')} subtitle={t('analytics.noSalesYet')} />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['#', t('analytics.product'), t('analytics.category'), t('analytics.units'), t('analytics.revenue')].map((h, i) => (
                      <th key={i}
                        style={{
                          textAlign: i > 1 ? 'right' : 'left',
                          padding: '8px 12px',
                          fontSize: 11, fontWeight: 800, color: colors.text3,
                          textTransform: 'uppercase', letterSpacing: '0.08em',
                          borderBottom: `1px solid ${colors.border}`,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {top_selling_products.map((p, i) => (
                    <tr key={p.product_id} style={{
                      borderBottom: `1px solid ${colors.border}30`,
                      transition: 'background 0.15s'
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = colors.surface)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px', fontWeight: 700, color: colors.text3, width: 40 }}>{i + 1}</td>
                      <td style={{ padding: '12px', fontSize: 14, fontWeight: 600, color: colors.text1 }}>{p.product_name}</td>
                      <td style={{ padding: '12px', fontSize: 13, color: colors.text3 }}>{p.category_name}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontSize: 14, fontWeight: 700, fontFeatureSettings: 'tnum', color: colors.text1 }}>{p.units_sold}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontSize: 14, fontWeight: 700, fontFeatureSettings: 'tnum', color: colors.accent.green }}>
                        {fmt(p.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Low Stock Alerts ────────────────────────────────────── */}
        <section style={{
          background: colors.card, border: `1px solid ${colors.border}`,
          borderRadius: radius.xl, padding: '24px', overflow: 'hidden'
        }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16, fontWeight: 800, marginBottom: 20 }}>
            <AlertTriangle size={18} color={colors.accent.red} />
            {t('analytics.lowStock')}
          </h3>

          {low_stock_alerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: colors.text3, fontSize: 13 }}>
              ✅ {t('analytics.allStockHealthy')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {low_stock_alerts.map((item) => (
                <div key={item.product_id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', background: colors.surface,
                  borderRadius: radius.md, border:
                    `1px solid ${item.urgency === 'critical' ? colors.accent.red : colors.accent.amber}40`,
                }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: colors.text1 }}>{item.product_name}</div>
                    <div style={{ fontSize: 11, color: colors.text3 }}>{item.category_name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: 18, fontWeight: 800,
                      color: item.urgency === 'critical' ? colors.accent.red : colors.accent.amber,
                      fontFeatureSettings: 'tnum'
                    }}>
                      {item.stock}
                    </div>
                    <div style={{ fontSize: 10, color: colors.text3 }}>
                      / min: {item.minimum_stock}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Waste Analytics ─────────────────────────────────────── */}
        <section style={{
          background: colors.card, border: `1px solid ${colors.border}`,
          borderRadius: radius.xl, padding: '24px', overflow: 'hidden'
        }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16, fontWeight: 800, marginBottom: 20 }}>
            <XCircle size={18} color={colors.accent.red} />
            {t('analytics.waste')}
          </h3>

          {waste_analytics.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: colors.text3, fontSize: 13 }}>
              ✅ {t('analytics.noWasteRecorded')}
            </div>
          ) : (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'rgba(239,68,68,0.06)', border: `1px solid ${colors.accent.red}30`,
                borderRadius: radius.md, padding: '12px 16px', marginBottom: 20,
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: colors.text2 }}>
                  {t('analytics.totalLoss')}
                </span>
                <span style={{ fontSize: 20, fontWeight: 900, color: colors.accent.red, fontFeatureSettings: 'tnum' }}>
                  {fmt(wastedTotal)}
                </span>
              </div>

              {waste_analytics.map((w) => (
                <div key={w.reason} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom: `1px solid ${colors.border}30`,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: colors.text1, textTransform: 'capitalize' }}>
                      {t(`products.reason.${w.reason}`) || w.reason}
                    </div>
                    <div style={{ fontSize: 11, color: colors.text3 }}>
                      {t('analytics.occurrences', { count: w.occurrences })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: colors.accent.red }}>
                      {fmt(w.total_cost)}
                    </div>
                    <div style={{ fontSize: 11, color: colors.text3 }}>
                      qty: {w.total_qty}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </section>

        {/* ── Fast-Moving Items ──────────────────────────────────── */}
        <section style={{
          background: colors.card, border: `1px solid ${colors.border}`,
          borderRadius: radius.xl, padding: '24px', overflow: 'hidden'
        }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16, fontWeight: 800, marginBottom: 20 }}>
            <TrendingUp size={18} color={colors.accent.green} />
            {t('analytics.fastMoving')}
          </h3>

          {fast_moving_items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: colors.text3, fontSize: 13 }}>
              {t('analytics.insufficientData')}
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {[t('analytics.product'), t('analytics.unitsSold'), t('analytics.turnoverDays')].map((h, i) => (
                        <th key={i} style={{
                          textAlign: i > 0 ? 'right' : 'left',
                          padding: '8px 12px',
                          fontSize: 11, fontWeight: 800, color: colors.text3,
                          textTransform: 'uppercase', letterSpacing: '0.08em',
                          borderBottom: `1px solid ${colors.border}`,
                          whiteSpace: 'nowrap'
                        }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fast_moving_items.map((p) => (
                      <tr key={p.product_id} style={{
                        borderBottom: `1px solid ${colors.border}30`,
                      }}
                        onMouseEnter={e => (e.currentTarget.style.background = colors.surface)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '10px 12px', fontSize: 14, fontWeight: 600, color: colors.text1 }}>
                          {p.product_name}
                          <div style={{ fontSize: 11, color: colors.text3 }}>{p.category_name}</div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 14, fontWeight: 700, fontFeatureSettings: 'tnum', color: colors.text1 }}>
                          {p.units_sold_30d}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          {p.turnover_days ? (
                            <span style={{
                              fontWeight: 800, color: colors.accent.green,
                              fontSize: 14, background: `${colors.accent.green}20`,
                              padding: '4px 10px', borderRadius: 6
                            }}
                            >
                              {p.turnover_days}d
                            </span>
                          ) : (
                            <span style={{ fontSize: 13, color: colors.text3 }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* ── Dead Stock ─────────────────────────────────────────── */}
        <section style={{
          background: colors.card, border: `1px solid ${colors.border}`,
          borderRadius: radius.xl, padding: '24px', overflow: 'hidden'
        }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16, fontWeight: 800, marginBottom: 20 }}>
            <XCircle size={18} color={colors.accent.amber} />
            {t('analytics.deadStock')}
          </h3>

          {dead_stock.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: colors.text3, fontSize: 13 }}>
              ✅ {t('analytics.noDeadStock')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dead_stock.map((item) => (
                <div key={item.product_id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', background: colors.surface,
                  borderRadius: radius.md, border: `1px solid ${colors.border}`,
                }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: colors.text1 }}>{item.product_name}</div>
                    <div style={{ fontSize: 11, color: colors.text3 }}>
                      stock: {item.stock_quantity} · min: {item.minimum_stock}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: colors.accent.amber }}>
                      {fmt(item.dead_stock_value)}
                    </div>
                    <div style={{ fontSize: 11, color: colors.text3 }}>{t('analytics.valueTiedUp')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

    </div>
  );
};

export default InventoryAnalyticsPage;
