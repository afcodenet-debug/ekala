import React from 'react';
import { Search, Filter, SlidersHorizontal } from 'lucide-react';
import { EnterpriseTokens } from '../../../../lib/design-system';
import { useI18n } from '../../../../lib/i18n';
import { Category } from '../../types';
import { useBreakpoint } from '../../../../lib/hooks/useBreakpoint';
import { spacing, touchTargets } from '../../../../lib/design-system/responsive';
import { InventoryFiltersState, InventoryMarginFilter, InventoryStatusFilter } from '../../hooks/useInventoryFilters';

const { colors, radius } = EnterpriseTokens;

interface InventoryFiltersProps {
  categories: Category[];
  filters: InventoryFiltersState;
  activeFiltersCount: number;
  onSearchChange: (value: string) => void;
  onFilterChange: <K extends keyof InventoryFiltersState>(field: K, value: InventoryFiltersState[K]) => void;
  onClearFilters: () => void;
}

const STATUS_OPTIONS: Array<{ value: InventoryStatusFilter; labelKey: string }> = [
  { value: 'all', labelKey: 'common.all' },
  { value: 'in_stock', labelKey: 'products.inStockStatus' },
  { value: 'low_stock', labelKey: 'products.lowStockAlerts' },
  { value: 'out_of_stock', labelKey: 'products.outOfStock' },
  { value: 'inactive', labelKey: 'common.inactive' },
];

const MARGIN_OPTIONS: Array<{ value: InventoryMarginFilter; label: string }> = [
  { value: 'all', label: 'All margins' },
  { value: 'profitable', label: 'Profitable' },
  { value: 'high_margin', label: 'High margin > 25%' },
];

// Select style factory
const makeSelectStyle = (isMobile: boolean): React.CSSProperties => ({
  width: '100%',
  padding: isMobile ? '10px 12px' : '12px 14px',
  borderRadius: radius.md,
  border: `1px solid ${colors.border}`,
  background: colors.surface,
  color: colors.text1,
  fontSize: isMobile ? '13px' : '14px',
  appearance: 'none' as const,
  WebkitAppearance: 'none' as const,
  cursor: 'pointer',
  outline: 'none',
  minHeight: touchTargets.min,
  transition: 'border-color 0.15s, background 0.15s',
});

export const InventoryFilters: React.FC<InventoryFiltersProps> = React.memo(({
  categories,
  filters,
  activeFiltersCount,
  onSearchChange,
  onFilterChange,
  onClearFilters,
}) => {
  const { t } = useI18n();
  const bp = useBreakpoint();
  const { isMobile, isTablet } = bp;

  const cardPadding = isMobile ? '16px 14px' : isTablet ? '18px 16px' : '24px';
  const sectionGap = isMobile ? spacing.sm : spacing.md;
  const labelFontSize = isMobile ? '11.5px' : '12px';
  const labelWeight = 700;

  // Grid: 1 col on mobile, 3 col on tablet/desktop
  const dropdownGrid = isMobile
    ? 'repeat(1, minmax(0, 1fr))'
    : isTablet
    ? 'repeat(3, minmax(0, 1fr))'
    : 'repeat(auto-fit, minmax(140px, 1fr))';

  const selectStyle = makeSelectStyle(isMobile);

  return (
    <section
      style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.xl,
        padding: cardPadding,
        display: 'grid',
        gap: sectionGap,
      }}
    >
      {/* Row 1: section title + clear button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: spacing.sm,
          alignItems: isMobile ? 'flex-start' : 'center',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            minWidth: 0,
            maxWidth: '100%',
          }}
        >
          <div
            style={{
              fontSize: isMobile ? '13px' : '14px',
              fontWeight: 800,
              color: colors.text1,
              marginBottom: '4px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {t('products.filters')}
          </div>
          {!isMobile && (
            <div
              style={{
                fontSize: '12px',
                color: colors.text3,
              }}
            >
              {t('products.searchPlaceholder')}
            </div>
          )}
        </div>

        {/* Clear filters button -stacked on mobile */}
        <div
          style={{
            flexShrink: 0,
            width: isMobile ? '100%' : 'auto',
            marginTop: isMobile ? spacing.sm : 0,
            order: isMobile ? 3 : 2,
          }}
        >
          <button
            type="button"
            onClick={onClearFilters}
            disabled={activeFiltersCount === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
              border: `1px solid ${
                activeFiltersCount > 0
                  ? colors.accent.amber + '80'
                  : colors.border
              }`,
              borderRadius: radius.md,
              background:
                activeFiltersCount > 0
                  ? `${colors.accent.amber}10`
                  : colors.surface,
              color:
                activeFiltersCount > 0
                  ? colors.accent.amber
                  : colors.text3,
              padding: isMobile
                ? '10px 14px'
                : activeFiltersCount > 0
                ? '10px 16px'
                : '8px 14px',
              fontSize: isMobile ? '12px' : activeFiltersCount > 0 ? '12.5px' : '12px',
              fontWeight: 700,
              cursor: activeFiltersCount === 0 ? 'not-allowed' : 'pointer',
              opacity: activeFiltersCount === 0 ? 0.55 : 1,
              minHeight: touchTargets.min,
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
              width: isMobile ? '100%' : 'auto',
            }}
            onMouseEnter={(e) => {
              if (activeFiltersCount > 0) {
                e.currentTarget.style.background = `${colors.accent.amber}12`;
                e.currentTarget.style.borderColor = `${colors.accent.amber}90`;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                activeFiltersCount > 0 ? `${colors.accent.amber}10` : colors.surface;
              e.currentTarget.style.borderColor =
                activeFiltersCount > 0
                  ? `${colors.accent.amber}80`
                  : colors.border;
            }}
          >
            <Filter
              size={isMobile ? 14 : activeFiltersCount > 0 ? 14 : 13}
              style={{
                opacity: activeFiltersCount > 0 ? 1 : 0.7,
              }}
            />
            {t('common.clear')}
            {activeFiltersCount > 0 && (
              <span
                style={{
                  background: colors.accent.amber,
                  color: '#fff',
                  borderRadius: 999,
                  padding: '1px 7px',
                  fontSize: '11px',
                  fontWeight: 800,
                  lineHeight: '18px',
                }}
              >
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Search input */}
      <label
        style={{
          position: 'relative',
          display: 'block',
          order: isMobile ? 2 : 1,
        }}
      >
        <Search
          size={isMobile ? 14 : 16}
          style={{
            position: 'absolute',
            left: isMobile ? '12px' : '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: colors.text3,
            pointerEvents: 'none',
          }}
        />
        <input
          type="search"
          value={filters.search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('products.searchPlaceholder')}
          style={{
            width: '100%',
            padding: isMobile
              ? '12px 14px 12px 36px'
              : '14px 16px 14px 44px',
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            background: colors.surface,
            color: colors.text1,
            fontSize: isMobile ? '14px' : '14px',
            outline: 'none',
            boxSizing: 'border-box',
            minHeight: touchTargets.min,
            transition: 'border-color 0.15s ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = colors.accent.blue;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = colors.border;
          }}
        />
      </label>

      {/* Dropdown filters */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: dropdownGrid,
          gap: isMobile ? spacing.sm : spacing.md,
          order: 4,
        }}
      >
        {/* Show archived toggle */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 0',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={filters.showArchived}
            onChange={(e) => onFilterChange('showArchived', e.target.checked)}
            style={{
              width: '18px',
              height: '18px',
              cursor: 'pointer',
              accentColor: colors.accent.blue,
            }}
          />
          <span
            style={{
              fontSize: isMobile ? '13px' : '14px',
              fontWeight: 600,
              color: colors.text1,
            }}
          >
            {t('products.showArchived')}
          </span>
        </label>

        {/* Category filter */}
        <label
          style={{
            display: 'grid',
            gap: '4px',
          }}
        >
          <span
            style={{
              fontSize: labelFontSize,
              fontWeight: labelWeight,
              color: colors.text1,
            }}
          >
            {t('products.category')}
          </span>
          <div style={{ position: 'relative' }}>
            <select
              value={filters.categoryId ?? ''}
              onChange={(e) =>
                onFilterChange(
                  'categoryId',
                  e.target.value ? Number(e.target.value) : null
                )
              }
              style={selectStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = colors.accent.blue;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = colors.border;
              }}
            >
              <option value="">{t('common.all')}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <span
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: colors.text3,
                pointerEvents: 'none',
                fontSize: isMobile ? '12px' : '14px',
              }}
            >
              ▾
            </span>
          </div>
        </label>

        {/* Status filter */}
        <label
          style={{
            display: 'grid',
            gap: '4px',
          }}
        >
          <span
            style={{
              fontSize: labelFontSize,
              fontWeight: labelWeight,
              color: colors.text1,
            }}
          >
            {t('common.status')}
          </span>
          <div style={{ position: 'relative' }}>
            <select
              value={filters.status}
              onChange={(e) =>
                onFilterChange('status', e.target.value as InventoryStatusFilter)
              }
              style={selectStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = colors.accent.blue;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = colors.border;
              }}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
            <span
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: colors.text3,
                pointerEvents: 'none',
                fontSize: isMobile ? '12px' : '14px',
              }}
            >
              ▾
            </span>
          </div>
        </label>

        {/* Margin filter */}
        <label
          style={{
            display: 'grid',
            gap: '4px',
          }}
        >
          <span
            style={{
              fontSize: labelFontSize,
              fontWeight: labelWeight,
              color: colors.text1,
            }}
          >
            {t('products.margin')}
          </span>
          <div style={{ position: 'relative' }}>
            <select
              value={filters.margin}
              onChange={(e) =>
                onFilterChange('margin', e.target.value as InventoryMarginFilter)
              }
              style={selectStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = colors.accent.blue;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = colors.border;
              }}
            >
              {MARGIN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(`products.margin_${opt.value}`) || opt.label}
                </option>
              ))}
            </select>
            <span
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: colors.text3,
                pointerEvents: 'none',
                fontSize: isMobile ? '12px' : '14px',
              }}
            >
              ▾
            </span>
          </div>
        </label>
      </div>

      {/* Status bar with filter summary */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.xs,
          flexWrap: 'wrap',
          color: colors.text3,
          fontSize: isMobile ? '11.5px' : '12px',
          paddingTop: '2px',
          borderTop: `1px solid ${colors.border}`,
          order: 5,
        }}
      >
        <SlidersHorizontal
          size={isMobile ? 12 : 14}
          style={{
            flexShrink: 0,
          }}
        />
        <span>
          {filters.search ? t('products.search') : t('products.browse')}
        </span>
        {activeFiltersCount > 0 && (
          <span>
            &middot;
            <span
              style={{
                color: colors.accent.amber,
                fontWeight: 700,
              }}
            >
              {activeFiltersCount} {t('products.activeFilters')}
            </span>
          </span>
        )}
        {activeFiltersCount === 0 && (
          <span>&middot; {t('products.noActiveFilters')}</span>
        )}
      </div>
    </section>
  );
});

export default InventoryFilters;
