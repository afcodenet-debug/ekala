import React from 'react';
import { History, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { EnterpriseTokens } from '../../../lib/design-system';
import { InventoryMovement } from '../types';
import { useSettingsStore } from '../../../stores/useSettingsStore';
import { formatPrice } from '../../../lib/i18n/currency';

const { colors, radius } = EnterpriseTokens;

interface InventoryMovementTableProps {
  movements: InventoryMovement[];
  emptyMessage?: string;
}

const movementMeta: Record<string, { bg: string; color: string; label: string; arrow: 'up' | 'down' | 'neutral' }> = {
  purchase:     { bg: 'rgba(34,197,94,0.10)', color: colors.accent.green, label: 'Purchase',   arrow: 'up' },
  sale:         { bg: 'rgba(59,130,246,0.10)', color: '#3b82f6',           label: 'Sale',       arrow: 'down' },
  adjustment:   { bg: 'rgba(212,175,55,0.10)', color: colors.accent.gold,  label: 'Adjustment', arrow: 'neutral' },
  transfer:     { bg: 'rgba(139,92,246,0.10)', color: '#8b5cf6',           label: 'Transfer',   arrow: 'neutral' },
  waste:        { bg: 'rgba(239,68,68,0.10)',  color: colors.accent.red,   label: 'Waste',      arrow: 'down' },
  damaged:      { bg: 'rgba(239,68,68,0.10)',  color: colors.accent.red,   label: 'Damaged',    arrow: 'down' },
  return:       { bg: 'rgba(34,197,94,0.10)',  color: colors.accent.green, label: 'Return',     arrow: 'up' },
  inventory_count:{ bg:'rgba(139,92,246,0.10)', color: '#8b5cf6',           label: 'Count',      arrow: 'neutral' },
  in:           { bg: 'rgba(34,197,94,0.10)',  color: colors.accent.green, label: 'IN',         arrow: 'up' },
  out:          { bg: 'rgba(239,68,68,0.10)',  color: colors.accent.red,   label: 'OUT',        arrow: 'down' },
};

const ArrowIcon: React.FC<{ arrow: 'up' | 'down' | 'neutral' }> = ({ arrow }) => {
  if (arrow === 'neutral') return <RefreshCw size={12} />;
  if (arrow === 'up') return <TrendingUp size={12} />;
  return <TrendingDown size={12} />;
};

export const InventoryMovementTable: React.FC<InventoryMovementTableProps> = ({
  movements,
  emptyMessage = 'No movements recorded',
}) => {
  const { currency, language: lang } = useSettingsStore();

  if (!movements.length) {
    return (
      <div style={{
        padding: 48, textAlign: 'center',
        background: colors.card, border: `1px solid ${colors.border}`,
        borderRadius: radius.xl, color: colors.text3, fontSize: 14,
      }}>
        <History size={36} strokeWidth={1.5} style={{ marginBottom: 12, opacity: 0.4 }} />
        <div>{emptyMessage}</div>
      </div>
    );
  }

  const fmt = (v?: number | null) => v != null ? formatPrice(v, currency, lang) : '—';
  const isAdd = (m: InventoryMovement) => (m.quantity_changed ?? 0) >= 0;

  return (
    <div style={{
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: radius.xl,
      overflow: 'hidden',
    }}
    role="table"
    aria-label="Inventory movements"
    >
      {/* Header */}
      <div style={{
        padding: '14px 20px',
        borderBottom: `1px solid ${colors.border}`,
        display: 'grid',
        gridTemplateColumns: '165px 110px 110px 100px 110px 1fr 150px',
        fontSize: 10, fontWeight: 800, color: colors.text3,
        textTransform: 'uppercase', letterSpacing: '0.09em',
        alignItems: 'center',
        background: 'rgba(0,0,0,0.15)',
      }}
      >
        <span>Date / Time</span>
        <span>Type</span>
        <span style={{ textAlign: 'right' }}>Before</span>
        <span style={{ textAlign: 'right' }}>Change</span>
        <span style={{ textAlign: 'right' }}>After</span>
        <span>Reason</span>
        <span style={{ textAlign: 'right' }}>Value</span>
      </div>

      {/* Rows */}
      {movements.map(m => {
        const meta = movementMeta[m.type] ?? { bg: colors.surface, color: colors.text3, label: m.type, arrow: 'neutral' as const };

        return (
          <div
            key={m.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '165px 110px 110px 100px 110px 1fr 150px',
              padding: '13px 20px',
              borderBottom: `1px solid ${colors.border}15`,
              fontSize: 13,
              alignItems: 'center',
              transition: 'background 0.15s ease',
              cursor: 'default',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = colors.surface)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {/* Date */}
            <span style={{ color: colors.text3, fontSize: 12, whiteSpace: 'nowrap' }}>
              {new Date(m.created_at ?? '').toLocaleDateString()} {new Date(m.created_at ?? '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>

            {/* Type badge */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              textTransform: 'uppercase',
              background: meta.bg, color: meta.color, width: 'fit-content',
            }}
            >
              <ArrowIcon arrow={meta.arrow} />
              {meta.label}
            </span>

            {/* Before */}
            <span
              style={{
                textAlign: 'right',
                fontFeatureSettings: 'tnum',
                fontWeight: 600,
                color: colors.text3,
                fontSize: 13,
              }}
            >
              {m.quantity_before ?? '—'}
            </span>

            {/* Change */}
            <span
              style={{
                textAlign: 'right',
                fontFeatureSettings: 'tnum',
                fontWeight: 800,
                color: isAdd(m) ? colors.accent.green : colors.accent.red,
                fontSize: 13,
              }}
            >
              {isAdd(m) ? '+' : ''}{(m.quantity_changed ?? 0).toLocaleString()}
            </span>

            {/* After */}
            <span
              style={{
                textAlign: 'right',
                fontFeatureSettings: 'tnum',
                fontWeight: 600,
                color: colors.text1,
                fontSize: 13,
              }}
            >
              {m.quantity_after ?? '—'}
            </span>

            {/* Reason */}
            <span
              style={{
                color: colors.text2,
                fontSize: 13,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                paddingRight: 12,
              }}
              title={m.reason ?? undefined}
            >
              {m.reason || '—'}
            </span>

            {/* Total value */}
            <span
              style={{
                textAlign: 'right',
                fontFeatureSettings: 'tnum',
                fontWeight: 700,
                color: meta.color,
                fontSize: 13,
              }}
            >
              {fmt(m.total_value)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default InventoryMovementTable;
