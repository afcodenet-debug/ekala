import React from 'react';
import { Download, Plus, LayoutGrid, List } from 'lucide-react';
import { EnterpriseTokens } from '../../../../lib/design-system';
import { useI18n } from '../../../../lib/i18n';

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

export const InventoryHeader: React.FC<InventoryHeaderProps> = React.memo(({
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
    <header style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: colors.accent.gold }}>{t('products.management')}</p>
          <h1 style={{ margin: '8px 0 0', fontSize: '34px', fontWeight: 900, color: colors.text1 }}>{t('products.management')}</h1>
          <p style={{ margin: '10px 0 0', color: colors.text3, maxWidth: '680px', lineHeight: 1.7 }}>
            {t('products.auditNot')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={onExport}
            style={{
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              color: colors.text2,
              borderRadius: radius.md,
              padding: '12px 18px',
              display: 'inline-flex',
              gap: '10px',
              alignItems: 'center',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            <Download size={16} /> {t('sales.export')}
          </button>

          {canCreate && (
            <button
              type="button"
              onClick={onCreate}
              style={{
                border: 'none',
                borderRadius: radius.md,
                background: colors.accent.blue,
                color: '#fff',
                padding: '12px 22px',
                display: 'inline-flex',
                gap: '10px',
                alignItems: 'center',
                cursor: 'pointer',
                fontWeight: 800,
                boxShadow: '0 18px 40px rgba(15, 23, 42, 0.12)',
              }}
            >
              <Plus size={18} /> {t('products.create')}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onViewModeChange('table')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: radius.md,
              padding: '10px 14px',
              border: viewMode === 'table' ? `1px solid ${colors.accent.blue}` : `1px solid ${colors.border}`,
              background: viewMode === 'table' ? colors.accent.blue : colors.surface,
              color: viewMode === 'table' ? colors.bg : colors.text2,
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            <List size={16} /> {t('common.table')}
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange('grid')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: radius.md,
              padding: '10px 14px',
              border: viewMode === 'grid' ? `1px solid ${colors.accent.blue}` : `1px solid ${colors.border}`,
              background: viewMode === 'grid' ? colors.accent.blue : colors.surface,
              color: viewMode === 'grid' ? colors.bg : colors.text2,
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            <LayoutGrid size={16} /> {t('common.grid')}
          </button>
        </div>

        <button
          type="button"
          onClick={onClearFilters}
          style={{
            border: `1px solid ${colors.border}`,
            background: colors.surface,
            color: colors.text2,
            padding: '12px 18px',
            borderRadius: radius.md,
            cursor: 'pointer',
            fontWeight: 700,
            opacity: activeFiltersCount === 0 ? 0.7 : 1,
          }}
        >
          {activeFiltersCount > 0 ? `${t('common.clear')} (${activeFiltersCount})` : t('common.clear')}
        </button>
      </div>
    </header>
  );
});
