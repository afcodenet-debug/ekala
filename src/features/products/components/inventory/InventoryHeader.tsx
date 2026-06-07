import React from 'react';
import { Download, Plus, LayoutGrid, List } from 'lucide-react';
import { EnterpriseTokens } from '../../../../lib/design-system';
import { useI18n } from '../../../../lib/i18n';
import { useBreakpoint } from '../../../../lib/hooks/useBreakpoint';
import { responsive, spacing, touchTargets } from '../../../../lib/design-system/responsive';

const { colors, radius } = EnterpriseTokens;

interface InventoryHeaderProps {
  viewMode: 'table' | 'grid';
  onViewModeChange: (value: 'table' | 'grid') => void;
  onExport: () => void;
  onCreate: () => void;
  activeFiltersCount: number;
  onClearFilters: () => void;
  canCreate: boolean;
}

// Mobile header with collapsed title
const MobileHeader: React.FC<Omit<InventoryHeaderProps, 'viewMode' | 'onViewModeChange'>> = ({
  onExport,
  onCreate,
  activeFiltersCount,
  onClearFilters,
  canCreate,
}) => {
  const { t } = useI18n();
  
  return (
    <header
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.sm,
        marginBottom: spacing.md,
      }}
    >
      {/* Title row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: spacing.sm,
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: '11px',
              fontWeight: 700,
              color: colors.accent.gold,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {t('products.management')}
          </p>
          <h1
            style={{
              margin: '6px 0 0',
              fontSize: '26px',
              fontWeight: 900,
              color: colors.text1,
              letterSpacing: '-0.025em',
              lineHeight: 1.1,
            }}
          >
            {t('products.management')}
          </h1>
        </div>

        {/* Action buttons */}
        <div
          style={{
            display: 'flex',
            gap: spacing.xs,
            alignItems: 'center',
            width: '100%',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onExport}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              color: colors.text2,
              padding: '10px 14px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '12.5px',
              flex: '1 1 0',
              minHeight: touchTargets.min,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.accent.blue + '10';
              e.currentTarget.style.borderColor = colors.accent.blue + '40';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colors.surface;
              e.currentTarget.style.borderColor = colors.border;
            }}
          >
            <Download size={14} />
            <span style={{ fontSize: '12px' }}>{t('sales.export')}</span>
          </button>

          {canCreate && (
            <button
              type="button"
              onClick={onCreate}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                borderRadius: radius.md,
                border: 'none',
                background: colors.accent.blue,
                color: '#fff',
                padding: '10px 16px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '13px',
                flex: '1 1 0',
                minHeight: touchTargets.min,
                boxShadow: `0 4px 20px ${colors.accent.blue}45`,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 6px 28px ${colors.accent.blue}55`;
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = `0 4px 20px ${colors.accent.blue}45`;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <Plus size={15} />
              {t('products.create')}
            </button>
          )}
        </div>
      </div>

      {/* View mode toggle + clear filters */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: spacing.sm,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {/* View mode toggle - hidden on mobile, will be in main content */}
        <div style={{ display: 'none' }} />

        {/* Clear filters button */}
        {activeFiltersCount > 0 && (
          <button
            type="button"
            onClick={onClearFilters}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              border: `1px solid ${colors.accent.amber}80`,
              background: `${colors.accent.amber}10`,
              color: colors.accent.amber,
              padding: '8px 12px',
              borderRadius: radius.md,
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '12px',
              minHeight: touchTargets.min,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${colors.accent.amber}15`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `${colors.accent.amber}10`;
            }}
          >
            {t('common.clear')} ({activeFiltersCount})
          </button>
        )}
      </div>
    </header>
  );
};

// Tablet header
const TabletHeader: React.FC<InventoryHeaderProps> = ({
  viewMode,
  onViewModeChange,
  onExport,
  onCreate,
  activeFiltersCount,
  onClearFilters,
  canCreate,
}) => {
  const { t } = useI18n();

  return (
    <header
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.md,
        marginBottom: spacing['2xl'],
      }}
    >
      {/* Title + primary actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: spacing.md,
          alignItems: 'flex-start',
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: '11px',
              fontWeight: 700,
              color: colors.accent.gold,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {t('products.management')}
          </p>
          <h1
            style={{
              margin: '6px 0 0',
              fontSize: '30px',
              fontWeight: 900,
              color: colors.text1,
              letterSpacing: '-0.025em',
              lineHeight: 1.1,
            }}
          >
            {t('products.management')}
          </h1>
          <p
            style={{
              margin: '10px 0 0',
              color: colors.text3,
              maxWidth: '680px',
              lineHeight: 1.7,
              fontSize: '13.5px',
            }}
          >
            {t('products.auditNot')}
          </p>
        </div>

        {/* Primary action buttons */}
        <div
          style={{
            display: 'flex',
            gap: spacing.sm,
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={onExport}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              color: colors.text2,
              padding: '12px 18px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '14px',
              whiteSpace: 'nowrap',
              minHeight: touchTargets.min,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.accent.blue + '10';
              e.currentTarget.style.borderColor = colors.accent.blue + '40';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colors.surface;
              e.currentTarget.style.borderColor = colors.border;
            }}
          >
            <Download size={16} />
            {t('sales.export')}
          </button>

          {canCreate && (
            <button
              type="button"
              onClick={onCreate}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                borderRadius: radius.md,
                border: 'none',
                background: colors.accent.blue,
                color: '#fff',
                padding: '12px 22px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '14px',
                whiteSpace: 'nowrap',
                minHeight: touchTargets.min,
                boxShadow: `0 4px 20px ${colors.accent.blue}45`,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 6px 28px ${colors.accent.blue}55`;
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = `0 4px 20px ${colors.accent.blue}45`;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <Plus size={18} />
              {t('products.create')}
            </button>
          )}
        </div>
      </div>

      {/* View mode toggles + clear filters */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: spacing.sm,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {/* View mode toggles */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.lg,
            padding: '4px',
          }}
        >
          {([
            { mode: 'table' as const, Icon: List, label: t('common.table') },
            { mode: 'grid' as const, Icon: LayoutGrid, label: t('common.grid') },
          ] as const).map(({ mode, Icon, label }) => {
            const isActive = viewMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onViewModeChange(mode)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: radius.md,
                  padding: '10px 14px',
                  border: 'none',
                  background: isActive ? colors.accent.blue : 'transparent',
                  color: isActive ? '#fff' : colors.text3,
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '14px',
                  transition: 'all 0.15s ease',
                  justifyContent: 'center',
                  boxShadow: isActive ? `0 2px 8px ${colors.accent.blue}40` : 'none',
                  minHeight: touchTargets.min,
                }}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Clear filters */}
        <button
          type="button"
          onClick={onClearFilters}
          style={{
            border: `1px solid ${activeFiltersCount > 0 ? colors.accent.amber + '80' : colors.border}`,
            background: activeFiltersCount > 0 ? `${colors.accent.amber}10` : colors.surface,
            color: activeFiltersCount > 0 ? colors.accent.amber : colors.text3,
            padding: '10px 16px',
            borderRadius: radius.md,
            cursor: activeFiltersCount === 0 ? 'not-allowed' : 'pointer',
            fontWeight: 700,
            fontSize: '13px',
            opacity: activeFiltersCount === 0 ? 0.55 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            minHeight: touchTargets.min,
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
          disabled={activeFiltersCount === 0}
        >
          {activeFiltersCount > 0
            ? `${t('common.clear')} (${activeFiltersCount})`
            : t('common.clear')}
        </button>
      </div>
    </header>
  );
};

// Desktop header
const DesktopHeader: React.FC<InventoryHeaderProps> = ({
  viewMode,
  onViewModeChange,
  onExport,
  onCreate,
  activeFiltersCount,
  onClearFilters,
  canCreate,
}) => {
  const { t } = useI18n();

  return (
    <header
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: spacing['2xl'],
        marginBottom: spacing['3xl'],
      }}
    >
      {/* Title + primary actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: spacing['2xl'],
          alignItems: 'flex-start',
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: '11px',
              fontWeight: 700,
              color: colors.accent.gold,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {t('products.management')}
          </p>
          <h1
            style={{
              margin: '6px 0 0',
              fontSize: '34px',
              fontWeight: 900,
              color: colors.text1,
              letterSpacing: '-0.025em',
              lineHeight: 1.1,
            }}
          >
            {t('products.management')}
          </h1>
          <p
            style={{
              margin: '10px 0 0',
              color: colors.text3,
              maxWidth: '680px',
              lineHeight: 1.7,
              fontSize: '14px',
            }}
          >
            {t('products.auditNot')}
          </p>
        </div>

        {/* Primary action buttons */}
        <div
          style={{
            display: 'flex',
            gap: spacing.md,
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={onExport}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              color: colors.text2,
              padding: '12px 18px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '14px',
              whiteSpace: 'nowrap',
              minHeight: touchTargets.min,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.accent.blue + '10';
              e.currentTarget.style.borderColor = colors.accent.blue + '40';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colors.surface;
              e.currentTarget.style.borderColor = colors.border;
            }}
          >
            <Download size={16} />
            {t('sales.export')}
          </button>

          {canCreate && (
            <button
              type="button"
              onClick={onCreate}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                borderRadius: radius.md,
                border: 'none',
                background: colors.accent.blue,
                color: '#fff',
                padding: '12px 22px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '14px',
                whiteSpace: 'nowrap',
                minHeight: touchTargets.min,
                boxShadow: `0 4px 20px ${colors.accent.blue}45`,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 6px 28px ${colors.accent.blue}55`;
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = `0 4px 20px ${colors.accent.blue}45`;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <Plus size={18} />
              {t('products.create')}
            </button>
          )}
        </div>
      </div>

      {/* View mode toggles + clear filters */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: spacing.md,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {/* View mode toggles */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.lg,
            padding: '4px',
          }}
        >
          {([
            { mode: 'table' as const, Icon: List, label: t('common.table') },
            { mode: 'grid' as const, Icon: LayoutGrid, label: t('common.grid') },
          ] as const).map(({ mode, Icon, label }) => {
            const isActive = viewMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onViewModeChange(mode)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: radius.md,
                  padding: '10px 14px',
                  border: 'none',
                  background: isActive ? colors.accent.blue : 'transparent',
                  color: isActive ? '#fff' : colors.text3,
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '14px',
                  transition: 'all 0.15s ease',
                  justifyContent: 'center',
                  boxShadow: isActive ? `0 2px 8px ${colors.accent.blue}40` : 'none',
                  minHeight: touchTargets.min,
                }}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Clear filters */}
        <button
          type="button"
          onClick={onClearFilters}
          style={{
            border: `1px solid ${activeFiltersCount > 0 ? colors.accent.amber + '80' : colors.border}`,
            background: activeFiltersCount > 0 ? `${colors.accent.amber}10` : colors.surface,
            color: activeFiltersCount > 0 ? colors.accent.amber : colors.text3,
            padding: '10px 16px',
            borderRadius: radius.md,
            cursor: activeFiltersCount === 0 ? 'not-allowed' : 'pointer',
            fontWeight: 700,
            fontSize: '13px',
            opacity: activeFiltersCount === 0 ? 0.55 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            minHeight: touchTargets.min,
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
          disabled={activeFiltersCount === 0}
        >
          {activeFiltersCount > 0
            ? `${t('common.clear')} (${activeFiltersCount})`
            : t('common.clear')}
        </button>
      </div>
    </header>
  );
};

// Main component with responsive behavior
export const InventoryHeader: React.FC<InventoryHeaderProps> = React.memo((props) => {
  const bp = useBreakpoint();
  const { isMobile, isTablet } = bp;
  const {
    viewMode,
    onViewModeChange,
    onExport,
    onCreate,
    activeFiltersCount,
    onClearFilters,
    canCreate,
  } = props;

  if (isMobile) {
    return (
      <MobileHeader
        onExport={onExport}
        onCreate={onCreate}
        activeFiltersCount={activeFiltersCount}
        onClearFilters={onClearFilters}
        canCreate={canCreate}
      />
    );
  }

  if (isTablet) {
    return (
      <TabletHeader
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        onExport={onExport}
        onCreate={onCreate}
        activeFiltersCount={activeFiltersCount}
        onClearFilters={onClearFilters}
        canCreate={canCreate}
      />
    );
  }

  return (
    <DesktopHeader
      viewMode={viewMode}
      onViewModeChange={onViewModeChange}
      onExport={onExport}
      onCreate={onCreate}
      activeFiltersCount={activeFiltersCount}
      onClearFilters={onClearFilters}
      canCreate={canCreate}
    />
  );
});

export default InventoryHeader;
