import React from 'react';
import { History, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { EnterpriseTokens } from '../../../../lib/design-system';
import { useI18n } from '../../../../lib/i18n';
import { InventoryMovement } from '../../types';

const { colors, radius } = EnterpriseTokens;

interface InventoryActivityPreviewProps {
  movements: InventoryMovement[];
  loading: boolean;
}

export const InventoryActivityPreview: React.FC<InventoryActivityPreviewProps> = React.memo(({ movements, loading }) => {
  const { t } = useI18n();

  return (
    <section style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: radius.xl, padding: '24px', display: 'grid', gap: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <History size={18} color={colors.accent.blue} />
        <div>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: colors.text1 }}>{t('products.stockHistory')}</p>
          <p style={{ margin: 0, fontSize: '12px', color: colors.text3 }}>Recent inventory movements and stock activity.</p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: '12px' }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} style={{ height: 62, borderRadius: radius.md, background: colors.surface }} />
          ))}
        </div>
      ) : movements.length === 0 ? (
        <p style={{ margin: 0, color: colors.text3 }}>{t('products.noProducts')}</p>
      ) : (
        <div style={{ display: 'grid', gap: '10px' }}>
          {movements.slice(0, 6).map(movement => {
            const isInbound = (movement.quantity_changed ?? 0) >= 0;
            return (
              <div key={movement.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '12px', alignItems: 'center', padding: '12px 14px', borderRadius: radius.md, background: colors.surface }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', background: isInbound ? `${colors.accent.green}12` : `${colors.accent.red}12`, color: isInbound ? colors.accent.green : colors.accent.red }}>
                  {isInbound ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                </div>
                <div style={{ display: 'grid', gap: 4 }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: colors.text1 }}>{movement.product_name || 'Product'}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: colors.text3 }}>{movement.reason || movement.type}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: isInbound ? colors.accent.green : colors.accent.red }}>{isInbound ? '+' : '-'}{Math.abs(movement.quantity_changed ?? 0)}</p>
                  <p style={{ margin: 0, fontSize: '11px', color: colors.text3 }}>{new Date(movement.created_at ?? '').toLocaleDateString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
});
