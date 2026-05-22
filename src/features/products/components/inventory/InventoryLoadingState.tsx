import React from 'react';
import { EnterpriseTokens } from '../../../../lib/design-system';

const { colors, radius } = EnterpriseTokens;

export const InventoryLoadingState: React.FC = () => {
  return (
    <div style={{ display: 'grid', gap: '22px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} style={{ minHeight: '120px', borderRadius: radius.xl, background: colors.card, border: `1px solid ${colors.border}`, padding: '22px' }}>
            <div style={{ width: '60%', height: 20, borderRadius: 999, background: colors.surface, marginBottom: 14 }} />
            <div style={{ width: '100%', height: 16, borderRadius: 999, background: colors.surface, marginBottom: 10 }} />
            <div style={{ width: '80%', height: 16, borderRadius: 999, background: colors.surface }} />
          </div>
        ))}
      </div>

      <div style={{ borderRadius: radius.xl, background: colors.card, border: `1px solid ${colors.border}`, padding: '20px' }}>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 160px', gap: '14px', padding: '16px 0', borderBottom: index < 4 ? `1px solid ${colors.border}` : 'none' }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: colors.surface }} />
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ width: '70%', height: 14, borderRadius: 999, background: colors.surface }} />
              <div style={{ width: '40%', height: 12, borderRadius: 999, background: colors.surface }} />
            </div>
            <div style={{ width: '100%', height: 14, borderRadius: 999, background: colors.surface, justifySelf: 'end' }} />
          </div>
        ))}
      </div>
    </div>
  );
};
