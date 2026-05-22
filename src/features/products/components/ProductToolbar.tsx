import React from 'react';
import { 
  Search, Download, Plus, LayoutGrid, List, X 
} from 'lucide-react';
import { EnterpriseTokens } from '../../../lib/design-system';
import { useI18n } from '../../../lib/i18n';

const { colors, radius } = EnterpriseTokens;

interface ProductToolbarProps {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  viewMode: 'table' | 'grid';
  onViewModeChange: (v: 'table' | 'grid') => void;
  onExport: () => void;
  onCreate: () => void;
  isAdmin: boolean;
  activeFiltersCount: number;
  onClearFilters: () => void;
}

export const ProductToolbar: React.FC<ProductToolbarProps> = React.memo(({
  searchTerm, onSearchChange, viewMode, onViewModeChange, onExport, onCreate, isAdmin, activeFiltersCount, onClearFilters
}) => {
  const { t } = useI18n();

  return (
    <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.xl, padding: '20px', marginBottom: '24px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
      
      {/* Search Portal */}
      <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
        <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: colors.text3 }} />
        <input 
          type="text" 
          placeholder={t('products.searchPlaceholder')} 
          value={searchTerm} 
          onChange={e => onSearchChange(e.target.value)}
          style={{ width: '100%', background: colors.card, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: '14px 16px 14px 48px', color: colors.text1, fontSize: '14px', outline: 'none', transition: 'all 0.2s' }} 
        />
      </div>

      {/* View Toggle */}
      <div style={{ display: 'flex', background: colors.card, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: '4px' }}>
        <button onClick={() => onViewModeChange('table')} style={{ padding: '8px', borderRadius: radius.sm, background: viewMode === 'table' ? colors.accent.goldDim : 'transparent', border: 'none', color: viewMode === 'table' ? colors.accent.gold : colors.text3, cursor: 'pointer' }}><List size={18}/></button>
        <button onClick={() => onViewModeChange('grid')} style={{ padding: '8px', borderRadius: radius.sm, background: viewMode === 'grid' ? colors.accent.goldDim : 'transparent', border: 'none', color: viewMode === 'grid' ? colors.accent.gold : colors.text3, cursor: 'pointer' }}><LayoutGrid size={18}/></button>
      </div>

      <div style={{ width: '1px', height: '32px', background: colors.border }} />

      {/* Global Actions */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        {activeFiltersCount > 0 && (
          <button onClick={onClearFilters} style={{ background: 'none', border: 'none', color: colors.accent.red, fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <X size={14}/> {t('common.clear')} ({activeFiltersCount})
          </button>
        )}
        
        <button onClick={onExport} style={{ padding: '12px 20px', borderRadius: radius.md, background: colors.card, border: `1px solid ${colors.border}`, color: colors.text2, display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}>
          <Download size={16} /> {t('sales.export')}
        </button>

        {isAdmin && (
          <button 
            onClick={onCreate} 
            style={{ 
              padding: '12px 24px', 
              borderRadius: radius.md, 
              background: colors.accent.blue, 
              border: 'none', 
              color: '#fff', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              fontWeight: 800, 
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
              textTransform: 'uppercase'
            }}
          >
            <Plus size={18} /> {t('products.create')}
          </button>
        )}
      </div>
    </div>
  );
});
