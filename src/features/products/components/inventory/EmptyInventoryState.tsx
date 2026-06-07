import React from 'react';
import { Package, Plus } from 'lucide-react';
import { EnterpriseTokens } from '../../../../lib/design-system';
import { useI18n } from '../../../../lib/i18n';
import { useBreakpoint } from '../../../../lib/hooks/useBreakpoint';
import { spacing, touchTargets } from '../../../../lib/design-system/responsive';

const { colors, radius } = EnterpriseTokens;

interface EmptyInventoryStateProps {
  onCreate: () => void;
}

export const EmptyInventoryState: React.FC<EmptyInventoryStateProps> = React.memo(({ onCreate }) => {
  const { t } = useI18n();
  const bp = useBreakpoint();
  const { isMobile, isTablet } = bp;

  return (
    <div
      style={{
        display: 'grid',
        gap: isMobile ? spacing.md : spacing.lg,
        textAlign: 'center',
        padding: isMobile ? '48px 20px' : isTablet ? '60px 24px' : '72px 24px',
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.xl,
        color: colors.text2,
      }}
    >
      {/* Illustration */}
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          gap: spacing.sm,
        }}
      >
        <div
          style={{
            width: isMobile ? 64 : isTablet ? 70 : 70,
            height: isMobile ? 64 : isTablet ? 70 : 70,
            borderRadius: isMobile ? 24 : 28,
            background: colors.surface,
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto',
            border: `1px solid ${colors.border}`,
          }}
        >
          <Package
            size={isMobile ? 24 : isTablet ? 28 : 28}
            color={colors.accent.gold}
          />
        </div>

        <h2
          style={{
            margin: 0,
            fontSize: isMobile ? '20px' : isTablet ? '22px' : '24px',
            fontWeight: 800,
            color: colors.text1,
          }}
        >
          {t('products.noProducts')}
        </h2>

        <p
          style={{
            margin: '8px 0 0',
            fontSize: isMobile ? '12px' : isTablet ? '13px' : '14px',
            lineHeight: 1.6,
            color: colors.text3,
            maxWidth: '480px',
          }}
        >
          {t('products.emptyStateDescription') ||
            'Create a product profile to centralize stock, margin and audit visibility across your inventory.'}
        </p>
      </div>

      {/* Create button */}
      <button
        type="button"
        onClick={onCreate}
        style={{
          alignSelf: 'center',
          display: 'inline-flex',
          alignItems: 'center',
          gap: spacing.xs,
          padding: isMobile ? '12px 20px' : isTablet ? '14px 24px' : '14px 24px',
          borderRadius: radius.md,
          border: 'none',
          background: colors.accent.blue,
          color: colors.bg,
          fontWeight: 800,
          cursor: 'pointer',
          fontSize: isMobile ? '13px' : isTablet ? '14px' : '14px',
          minHeight: touchTargets.min,
          boxShadow: `0 4px 16px ${colors.accent.blue}45`,
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = `0 6px 24px ${colors.accent.blue}55`;
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = `0 4px 16px ${colors.accent.blue}45`;
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <Plus size={isMobile ? 16 : 18} />
        {t('products.create')}
      </button>
    </div>
  );
});

export default EmptyInventoryState;
