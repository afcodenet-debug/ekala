import React from 'react';
import { History, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { EnterpriseTokens } from '../../../../lib/design-system';
import { useI18n } from '../../../../lib/i18n';
import { useBreakpoint } from '../../../../lib/hooks/useBreakpoint';
import { spacing, touchTargets } from '../../../../lib/design-system/responsive';
import { InventoryMovement } from '../../types';

const { colors, radius } = EnterpriseTokens;

interface InventoryActivityPreviewProps {
  movements: InventoryMovement[];
  loading: boolean;
}

export const InventoryActivityPreview: React.FC<InventoryActivityPreviewProps> = React.memo(({ movements, loading }) => {
  const { t } = useI18n();
  const bp = useBreakpoint();
  const { isMobile, isTablet } = bp;

  const containerPadding = isMobile ? '16px 12px' : isTablet ? '18px 16px' : '24px';
  const containerGap = isMobile ? spacing.md : isTablet ? spacing.lg : spacing.xl;

  return (
    <section
      style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.xl,
        padding: containerPadding,
        display: 'grid',
        gap: containerGap,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        <History
          size={isMobile ? 16 : isTablet ? 18 : 18}
          color={colors.accent.blue}
        />
        <div>
          <p
            style={{
              margin: 0,
              fontSize: isMobile ? '12px' : isTablet ? '13px' : '13px',
              fontWeight: 800,
              color: colors.text1,
            }}
          >
            {t('products.stockHistory')}
          </p>
          <p
            style={{
              margin: '2px 0 0',
              fontSize: isMobile ? '11px' : '12px',
              color: colors.text3,
            }}
          >
            {t('products.recentMovements')}
          </p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div
          style={{
            display: 'grid',
            gap: spacing.sm,
          }}
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              style={{
                height: isMobile ? 56 : 60,
                borderRadius: radius.md,
                background: colors.surface,
                animation: 'shimmer 1.5s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      ) : movements.length === 0 ? (
        <p
          style={{
            margin: 0,
            color: colors.text3,
            fontSize: isMobile ? '12px' : '13px',
            textAlign: 'center',
            padding: spacing.md,
          }}
        >
          {t('products.noMovements')}
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: isMobile ? spacing.xs : spacing.sm,
          }}
        >
          {movements.slice(0, 6).map(movement => {
            const isInbound = (movement.quantity_changed ?? 0) >= 0;
            const absQty = Math.abs(movement.quantity_changed ?? 0);
            const date = new Date(movement.created_at ?? '');
            const formattedDate = date.toLocaleDateString(undefined, {
              year: isMobile ? '2-digit' : 'numeric',
              month: isMobile ? 'short' : 'short',
              day: 'numeric',
            });

            return (
              <div
                key={movement.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  gap: spacing.sm,
                  alignItems: 'center',
                  padding: isMobile ? '10px 12px' : '12px 14px',
                  borderRadius: radius.md,
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = colors.borderHi;
                  e.currentTarget.style.transform = 'translateX(2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                  e.currentTarget.style.transform = 'translateX(0)';
                }}
              >
                {/* Icon indicator */}
                <div
                  style={{
                    width: isMobile ? 34 : 38,
                    height: isMobile ? 34 : 38,
                    borderRadius: isMobile ? 10 : 12,
                    display: 'grid',
                    placeItems: 'center',
                    background: isInbound
                      ? `${colors.accent.green}12`
                      : `${colors.accent.red}12`,
                    color: isInbound ? colors.accent.green : colors.accent.red,
                    flexShrink: 0,
                  }}
                >
                  {isInbound ? (
                    <ArrowUpRight size={isMobile ? 14 : 16} />
                  ) : (
                    <ArrowDownRight size={isMobile ? 14 : 16} />
                  )}
                </div>

                {/* Product info */}
                <div
                  style={{
                    display: 'grid',
                    gap: 2,
                    minWidth: 0,
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: isMobile ? '12px' : '13px',
                      fontWeight: 700,
                      color: colors.text1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {movement.product_name || t('products.product')}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: isMobile ? '11px' : '12px',
                      color: colors.text3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {movement.reason || movement.type}
                  </p>
                </div>

                {/* Quantity and date */}
                <div
                  style={{
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: isMobile ? '12px' : '13px',
                      fontWeight: 800,
                      color: isInbound ? colors.accent.green : colors.accent.red,
                    }}
                  >
                    {isInbound ? '+' : '-'}
                    {absQty}
                  </p>
                  <p
                    style={{
                      margin: '2px 0 0',
                      fontSize: isMobile ? '10px' : '11px',
                      color: colors.text3,
                    }}
                  >
                    {formattedDate}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Skeleton animation */}
      <style>{`
        @keyframes shimmer {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </section>
  );
});

export default InventoryActivityPreview;
