import React from 'react';
import { Search, Filter, SlidersHorizontal } from 'lucide-react';
import { EnterpriseTokens } from '../../../../lib/design-system';
import { useI18n } from '../../../../lib/i18n';
import { Category } from '../../types';
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
  { value: 'profitable', label: 'Profitable items' },
  { value: 'high_margin', label: 'High margin > 25%' },
];

export const InventoryFilters: React.FC<InventoryFiltersProps> = React.memo(({
  categories,
  filters,
  activeFiltersCount,
  onSearchChange,
  onFilterChange,
  onClearFilters,
}) => {
  const { t } = useI18n();

  return (
    <section style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: radius.xl, padding: '24px', display: 'grid', gap: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: colors.text1, marginBottom: '6px' }}>{t('products.management')}</div>
          <div style={{ fontSize: '12px', color: colors.text3 }}>{t('products.searchPlaceholder')}</div>
        </div>
        <button
          type="button"
          onClick={onClearFilters}
          disabled={activeFiltersCount === 0}
          style={{
            border: '1px solid ' + colors.border,
            borderRadius: radius.md,
            background: colors.surface,
            color: colors.text2,
            padding: '10px 14px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: activeFiltersCount === 0 ? 'not-allowed' : 'pointer',
            opacity: activeFiltersCount === 0 ? 0.55 : 1,
          }}
        >
          <Filter size={14} />
          &nbsp; {t('common.clear')} {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
        </button>
      </div>

      <label style={{ position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: colors.text3 }} />
        <input
          type="search"
          value={filters.search}
          onChange={event => onSearchChange(event.target.value)}
          placeholder={t('products.searchPlaceholder')}
          style={{
            width: '100%',
            padding: '14px 16px 14px 44px',
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            background: colors.surface,
            color: colors.text1,
            fontSize: '14px',
            outline: 'none',
          }}
        />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px' }}>
        <label style={{ display: 'grid', gap: '8px', fontSize: '12px', color: colors.text3 }}>
          <span style={{ fontWeight: 700, color: colors.text1 }}>{t('products.category')}</span>
          <select
            value={filters.categoryId ?? ''}
            onChange={event => onFilterChange('categoryId', event.target.value ? Number(event.target.value) : null)}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              color: colors.text1,
              fontSize: '14px',
            }}
          >
            <option value="">{t('common.all')}</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: '8px', fontSize: '12px', color: colors.text3 }}>
          <span style={{ fontWeight: 700, color: colors.text1 }}>{t('common.status')}</span>
          <select
            value={filters.status}
            onChange={event => onFilterChange('status', event.target.value as InventoryStatusFilter)}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              color: colors.text1,
              fontSize: '14px',
            }}
          >
            {STATUS_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: '8px', fontSize: '12px', color: colors.text3 }}>
          <span style={{ fontWeight: 700, color: colors.text1 }}>Margin</span>
          <select
            value={filters.margin}
            onChange={event => onFilterChange('margin', event.target.value as InventoryMarginFilter)}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              color: colors.text1,
              fontSize: '14px',
            }}
          >
            {MARGIN_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', color: colors.text3, fontSize: '12px' }}>
        <SlidersHorizontal size={14} />
        <span>{`${filters.search ? 'Search' : 'Browse'} • ${activeFiltersCount} active filters`}</span>
      </div>
    </section>
  );
});
