import React from 'react';
import { Package, Plus } from 'lucide-react';
import { EnterpriseTokens } from '../../../../lib/design-system';
import { useI18n } from '../../../../lib/i18n';

const { colors, radius } = EnterpriseTokens;

interface EmptyInventoryStateProps {
  onCreate: () => void;
}

export const EmptyInventoryState: React.FC<EmptyInventoryStateProps> = React.memo(({ onCreate }) => {
  const { t } = useI18n();

  return (
    <div style={{ display: 'grid', gap: '24px', textAlign: 'center', padding: '72px 24px', background: colors.card, border: `1px solid ${colors.border}`, borderRadius: radius.xl, color: colors.text2 }}>
      <div style={{ display: 'grid', placeItems: 'center', gap: '14px' }}>
        <div style={{ width: 70, height: 70, borderRadius: 28, background: colors.surface, display: 'grid', placeItems: 'center', margin: '0 auto' }}>
          <Package size={28} color={colors.accent.gold} />
        </div>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: colors.text1 }}>{t('products.noProducts')}</h2>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.8, color: colors.text3 }}>Create a product profile to centralize stock, margin and audit visibility across your inventory.</p>
      </div>
      <button
        type="button"
        onClick={onCreate}
        style={{
          alignSelf: 'center',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px',
          padding: '14px 24px',
          borderRadius: radius.md,
          border: 'none',
          background: colors.accent.blue,
          color: colors.bg,
          fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        <Plus size={18} /> {t('products.create')}
      </button>
    </div>
  );
});
