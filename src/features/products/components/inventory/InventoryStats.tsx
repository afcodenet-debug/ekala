import React from 'react';
import { BarChart3, TrendingUp, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react';
import { EnterpriseTokens } from '../../../../lib/design-system';
import { useI18n } from '../../../../lib/i18n';
import { useSettingsStore } from '../../../../stores/useSettingsStore';
import { useBreakpoint } from '../../../../lib/hooks/useBreakpoint';
import { responsive, spacing, touchTargets } from '../../../../lib/design-system/responsive';
import { formatPrice } from '../../../../lib/i18n/currency';
import { InventoryStats as InventoryStatsType } from '../../hooks/useInventoryStats';

const { colors, radius } = EnterpriseTokens;

interface InventoryStatsProps {
  stats: InventoryStatsType;
}

// Stat card component
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  color: string;
  colorDim: string;
  icon: React.ElementType;
  isHero?: boolean;
  isMobile: boolean;
  isTablet: boolean;
  index: number;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  color,
  colorDim,
  icon: Icon,
  isHero = false,
  isMobile,
  isTablet,
  index,
}) => {
  const cardPadding = responsive.padding(isMobile, isTablet, '16px 14px', '18px 16px', '24px');
  const cardMinH = isMobile ? 'auto' : '136px';
  const valueFontSize = responsive.fontSize(isMobile, isTablet, '22px', '24px', '28px');
  const iconSize = isMobile ? 18 : isTablet ? 19 : 20;
  const iconBoxSize = isMobile ? '36px' : isTablet ? '40px' : '42px';
  const subtitleFontSize = responsive.fontSize(isMobile, isTablet, '11px', '11.5px', '12px');
  const titleFontSize = responsive.fontSize(isMobile, isTablet, '10px', '10.5px', '11px');
  const titleLetterSpacing = isMobile ? '0.08em' : '0.12em';
  const valueMarginTop = isMobile ? '10px' : '14px';
  const subtitleMarginTop = isMobile ? '12px' : '18px';

  return (
    <div
      style={{
        gridColumn: isHero ? '1 / -1' : undefined,
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.xl,
        padding: cardPadding,
        position: 'relative',
        overflow: 'hidden',
        minHeight: cardMinH,
        boxShadow: `inset 3px 0 0 ${color}`,
        transition: 'box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `inset 3px 0 0 ${color}, 0 2px 8px ${color}20`;
        e.currentTarget.style.borderColor = color + '40';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = `inset 3px 0 0 ${color}`;
        e.currentTarget.style.borderColor = colors.border;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      onClick={(e) => {
        // Add subtle feedback on click
        const element = e.currentTarget as HTMLDivElement;
        element.style.transform = 'scale(0.98)';
        setTimeout(() => {
          element.style.transform = isHero ? 'translateY(-2px)' : 'translateY(0)';
        }, 150);
      }}
    >
      {/* Background icon watermark */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: isMobile ? '-8px' : '-4px',
          right: isMobile ? '-4px' : '8px',
          opacity: 0.045,
          pointerEvents: 'none',
          transform: `scale(${isMobile ? 2.4 : 3})`,
          transformOrigin: 'bottom right',
          transition: 'opacity 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.06';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.045';
        }}
      >
        <Icon size={32} color={color} />
      </div>

      {/* Header with title + icon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: titleFontSize,
            fontWeight: 800,
            letterSpacing: titleLetterSpacing,
            color: colors.text3,
            textTransform: 'uppercase',
            lineHeight: 1.4,
            flex: 1,
            minWidth: 0,
          }}
        >
          {title}
        </p>

        {/* Icon badge - hidden on non-hero mobile */}
        {(!isMobile || isHero) && (
          <div
            style={{
              flexShrink: 0,
              width: iconBoxSize,
              height: iconBoxSize,
              borderRadius: radius.lg,
              background: colorDim,
              display: 'grid',
              placeItems: 'center',
              border: `1px solid ${color}22`,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colorDim + '80';
              e.currentTarget.style.borderColor = color + '40';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colorDim;
              e.currentTarget.style.borderColor = color + '22';
            }}
          >
            <Icon size={iconSize} color={color} />
          </div>
        )}
      </div>

      {/* Value */}
      <p
        style={{
          margin: `${valueMarginTop} 0 0`,
          fontSize: valueFontSize,
          fontWeight: 900,
          color: colors.text1,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </p>

      {/* Subtitle - hidden on compact non-hero mobile */}
      {!isMobile || isHero ? (
        <p
          style={{
            margin: `${subtitleMarginTop} 0 0`,
            fontSize: subtitleFontSize,
            color: colors.text3,
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
};

// Main component
export const InventoryStats: React.FC<InventoryStatsProps> = React.memo(({ stats }) => {
  const { currency, language: lang } = useSettingsStore();
  const { t } = useI18n();
  const bp = useBreakpoint();
  const { isMobile, isTablet } = bp;

  const cards = [
    {
      title: t('products.totalInvValue'),
      value: formatPrice(stats.totalInventoryValue, currency, lang),
      subtitle: t('products.totalInvValueSub'),
      color: colors.accent.blue,
      colorDim: `${colors.accent.blue}14`,
      icon: BarChart3,
    },
    {
      title: t('products.potentialProfit'),
      value: formatPrice(stats.estimatedProfit, currency, lang),
      subtitle: t('products.potentialProfitSub'),
      color: colors.accent.green,
      colorDim: `${colors.accent.green}14`,
      icon: TrendingUp,
    },
    {
      title: t('products.lowStockAlerts'),
      value: stats.lowStockAlerts,
      subtitle: t('products.lowStockAlertsSub'),
      color: colors.accent.amber,
      colorDim: `${colors.accent.amber}14`,
      icon: AlertTriangle,
    },
    {
      title: t('products.outOfStock'),
      value: stats.outOfStockCount,
      subtitle: t('products.outOfStockSub'),
      color: colors.accent.red,
      colorDim: `${colors.accent.red}14`,
      icon: XCircle,
    },
    {
      title: t('products.activeSKUs'),
      value: stats.activeSKUs,
      subtitle: 'Active product profiles',
      color: colors.accent.gold,
      colorDim: `${colors.accent.gold}14`,
      icon: ShieldCheck,
    },
  ];

  // Layout: Mobile has hero card + 2-col grid, Tablet 3-col, Desktop auto-fit 5-col
  const gridCols = isMobile
    ? 'repeat(2, minmax(0, 1fr))'
    : isTablet
    ? 'repeat(3, minmax(0, 1fr))'
    : 'repeat(auto-fit, minmax(210px, 1fr))';

  const gap = responsive.gap(isMobile, isTablet, '10px', '14px', '20px');
  const marginBottom = responsive.value(isMobile, isTablet, '20px', '32px', '32px');

  return (
    <section
      style={{
        display: 'grid',
        gap,
        gridTemplateColumns: gridCols,
        marginBottom,
      }}
    >
      {cards.map((card, index) => {
        // On mobile: first card (Inventory Value) spans full width as hero
        const isHero = isMobile && index === 0;

        return (
          <StatCard
            key={card.title}
            {...card}
            index={index}
            isHero={isHero}
            isMobile={isMobile}
            isTablet={isTablet}
          />
        );
      })}
    </section>
  );
});

export default InventoryStats;
