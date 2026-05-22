import React from 'react';
import { AlertTriangle, TrendingUp, BarChart3, XCircle } from 'lucide-react';
import { EnterpriseTokens } from '../../../lib/design-system';
import { ProductStats } from '../types';
import { useSettingsStore } from '../../../stores/useSettingsStore';
import { useI18n } from '../../../lib/i18n';
import { formatPrice } from '../../../lib/i18n/currency';

const { colors, radius } = EnterpriseTokens;

interface ProductStatsGridProps {
  stats: ProductStats;
}

/**
 * High-density KPI cards with micro-visualizations.
 */
export const ProductStatsGrid: React.FC<ProductStatsGridProps> = React.memo(({ stats }) => {
  const { currency } = useSettingsStore();
  const { lang, t } = useI18n();

  const kpis = [
    { 
      label: t('products.totalInvValue'), 
      value: formatPrice(stats.total_inventory_value, currency, lang), 
      sub: t('products.totalInvValueSub'), 
      color: colors.accent.blue, 
      icon: BarChart3,
      permission: 'inventory.view_value' as const
    },
    { 
      label: t('products.potentialProfit'), 
      value: formatPrice(stats.potential_gross_profit, currency, lang), 
      sub: t('products.potentialProfitSub'), 
      color: colors.accent.green, 
      icon: TrendingUp,
      permission: 'inventory.view_value' as const
    },
    { 
      label: t('products.lowStockAlerts'), 
      value: stats.low_stock_alerts, 
      sub: t('products.lowStockAlertsSub'), 
      color: colors.accent.amber, 
      icon: AlertTriangle 
    },
    { 
      label: t('products.outOfStock'), 
      value: stats.out_of_stock_count, 
      sub: t('products.outOfStockSub'), 
      color: colors.accent.red, 
      icon: XCircle 
    },
  ];

  return (
    <div 
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '40px' }}
      role="region" 
      aria-label="Inventory statistics"
    >
      {kpis.map((s, i) => (
        <div 
          key={i} 
          style={{ 
            background: colors.card, 
            border: `1px solid ${colors.border}`, 
            borderRadius: radius.xl, 
            padding: '24px', 
            position: 'relative', 
            overflow: 'hidden',
            transition: 'transform 0.2s ease, border-color 0.2s ease',
          }}
          className="kpi-card"
        >
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ color: s.color, marginBottom: '16px' }}>
              <s.icon size={22} strokeWidth={2.5} />
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, marginBottom: '4px', letterSpacing: '-0.03em' }} className="mono">
              {s.value}
            </div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: colors.text3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {s.label}
            </div>
            <div style={{ fontSize: '10px', color: colors.text3, marginTop: '2px', opacity: 0.8 }}>
              {s.sub}
            </div>
          </div>
          {/* Background Ambient Glow */}
          <div style={{ 
            position: 'absolute', top: '-20%', right: '-10%', 
            width: '120px', height: '120px', 
            background: `radial-gradient(circle, ${s.color}15 0%, transparent 70%)`, 
            filter: 'blur(20px)' 
          }} />
        </div>
      ))}
    </div>
  );
});
