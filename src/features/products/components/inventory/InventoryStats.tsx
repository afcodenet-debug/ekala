import React from 'react';
import { BarChart3, TrendingUp, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react';
import { EnterpriseTokens } from '../../../../lib/design-system';
import { useI18n } from '../../../../lib/i18n';
import { InventoryStats as InventoryStatsType } from '../../hooks/useInventoryStats';
import { useSettingsStore } from '../../../../stores/useSettingsStore';
import { formatPrice } from '../../../../lib/i18n/currency';

const { colors, radius } = EnterpriseTokens;

interface InventoryStatsProps {
  stats: InventoryStatsType;
}

export const InventoryStats: React.FC<InventoryStatsProps> = React.memo(({ stats }) => {
  const { currency, language: lang } = useSettingsStore();
  const { t } = useI18n();

  const cards = [
    {
      title: t('products.totalInvValue'),
      value: formatPrice(stats.totalInventoryValue, currency, lang),
      subtitle: t('products.totalInvValueSub'),
      color: colors.accent.blue,
      icon: BarChart3,
    },
    {
      title: t('products.potentialProfit'),
      value: formatPrice(stats.estimatedProfit, currency, lang),
      subtitle: t('products.potentialProfitSub'),
      color: colors.accent.green,
      icon: TrendingUp,
    },
    {
      title: t('products.lowStockAlerts'),
      value: stats.lowStockAlerts,
      subtitle: t('products.lowStockAlertsSub'),
      color: colors.accent.amber,
      icon: AlertTriangle,
    },
    {
      title: t('products.outOfStock'),
      value: stats.outOfStockCount,
      subtitle: t('products.outOfStockSub'),
      color: colors.accent.red,
      icon: XCircle,
    },
    {
      title: t('products.activeSKUs'),
      value: stats.activeSKUs,
      subtitle: 'Active product profiles',
      color: colors.accent.gold,
      icon: ShieldCheck,
    },
  ];

  return (
    <section style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '32px' }}>
      {cards.map((card) => (
        <div key={card.title} style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: radius.xl, padding: '24px', position: 'relative', overflow: 'hidden', minHeight: '136px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
            <div>
              <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, letterSpacing: '0.12em', color: colors.text3, textTransform: 'uppercase' }}>{card.title}</p>
              <p style={{ margin: '14px 0 0', fontSize: '28px', fontWeight: 900, color: colors.text1 }}>{card.value}</p>
            </div>
            <div style={{ width: '42px', height: '42px', borderRadius: radius.lg, background: `${card.color}12`, display: 'grid', placeItems: 'center' }}>
              <card.icon size={20} color={card.color} />
            </div>
          </div>
          <p style={{ margin: '18px 0 0', fontSize: '12px', color: colors.text3, lineHeight: 1.6 }}>{card.subtitle}</p>
        </div>
      ))}
    </section>
  );
});
