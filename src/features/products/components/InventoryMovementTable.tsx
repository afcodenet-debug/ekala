import React, { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { EnterpriseTokens } from '../../../lib/design-system';
import { useI18n } from '../../../lib/i18n';
import { useBreakpoint } from '../../../lib/hooks/useBreakpoint';
import { spacing, touchTargets } from '../../../lib/design-system/responsive';
import { InventoryMovement } from '../types';

const { colors, radius } = EnterpriseTokens;

interface InventoryMovementTableProps {
  movements: InventoryMovement[];
  emptyMessage?: string;
}

export const InventoryMovementTable: React.FC<InventoryMovementTableProps> = React.memo(({
  movements,
  emptyMessage,
}) => {
  const { t } = useI18n();
  const bp = useBreakpoint();
  const { isMobile, isTablet } = bp;

  // ── Pagination (client-side over the provided movements) ─────────────
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalItems = movements.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageStart = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = Math.min(safePage * pageSize, totalItems);
  const paginated = movements.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Reset to first page whenever the underlying dataset changes
  useEffect(() => {
    setPage(1);
  }, [movements]);

  if (totalItems === 0) {
    return (
      <div
        style={{
          padding: isMobile ? '40px 20px' : '60px 40px',
          textAlign: 'center',
          color: colors.text3,
        }}
      >
        <p style={{ fontSize: isMobile ? '13px' : '14px' }}>
          {emptyMessage || t('products.noMovements')}
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.xs,
      }}
    >
      {/* Table header - hidden on mobile for simplicity */}
      {!isMobile && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: spacing.sm,
            padding: spacing.md,
            borderBottom: `1px solid ${colors.border}`,
            background: colors.surface,
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              color: colors.text3,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {t('products.product')}
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              color: colors.text3,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {t('products.date')}
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              color: colors.text3,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              textAlign: 'center',
            }}
          >
            {t('common.type')}
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              color: colors.text3,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              textAlign: 'center',
            }}
          >
            {t('products.quantity')}
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              color: colors.text3,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              textAlign: 'center',
            }}
          >
            {t('products.oldStock')}
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              color: colors.text3,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              textAlign: 'center',
            }}
          >
            {t('products.newStock')}
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              color: colors.text3,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {t('products.reason')}
          </span>
        </div>
      )}

      {/* Movement rows */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.xs,
        }}
      >
        {paginated.map((movement) => {
          const isInbound = (movement.quantity_changed ?? 0) >= 0;
          const date = new Date(movement.created_at || '');
          const formattedDate = date.toLocaleString();

          return isMobile ? (
            /* Mobile card view */
            <div
              key={movement.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gap: spacing.sm,
                alignItems: 'center',
                padding: spacing.sm,
                borderRadius: radius.md,
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = colors.borderHi;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.border;
              }}
            >
              {/* Status indicator icon */}
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  display: 'grid',
                  placeItems: 'center',
                  background: isInbound
                    ? `${colors.accent.green}12`
                    : `${colors.accent.red}12`,
                  color: isInbound ? colors.accent.green : colors.accent.red,
                  flexShrink: 0,
                }}
              >
                {isInbound ? (
                  <ArrowUp size={16} />
                ) : (
                  <ArrowDown size={16} />
                )}
              </div>

              {/* Product and reason */}
              <div
                style={{
                  display: 'grid',
                  gap: 2,
                  minWidth: 0,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: '12px',
                    fontWeight: 700,
                    color: colors.text1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {movement.product_name || t('products.unknown')}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: '11px',
                    color: colors.text3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {movement.reason || movement.type}
                </p>
              </div>

              {/* Quantity */}
              <div
                style={{
                  textAlign: 'right',
                  flexShrink: 0,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: '13px',
                    fontWeight: 800,
                    color: isInbound ? colors.accent.green : colors.accent.red,
                  }}
                >
                  {isInbound ? '+' : '-'}
                  {Math.abs(movement.quantity_changed ?? 0)}
                </p>
                <p
                  style={{
                    margin: '2px 0 0',
                    fontSize: '10px',
                    color: colors.text3,
                  }}
                >
                  {new Date(movement.created_at || '').toLocaleDateString()}
                </p>
              </div>
            </div>
          ) : (
            /* Desktop/Tablet table view */
            <div
              key={movement.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: spacing.sm,
                alignItems: 'center',
                padding: spacing.sm,
                borderRadius: radius.md,
                minHeight: touchTargets.min,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.surface;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {/* Product name */}
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: colors.text1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {movement.product_name || t('products.unknown')}
              </span>

              {/* Date */}
              <span
                style={{
                  fontSize: '12px',
                  color: colors.text3,
                  whiteSpace: 'nowrap',
                }}
              >
                {formattedDate}
              </span>

              {/* Movement type */}
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: isInbound ? colors.accent.green : colors.accent.red,
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {isInbound ? t('products.in') : t('products.out')}
              </span>

              {/* Quantity changed */}
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  color: isInbound ? colors.accent.green : colors.accent.red,
                  textAlign: 'center',
                }}
              >
                {isInbound ? '+' : '-'}
                {Math.abs(movement.quantity_changed ?? 0)}
              </span>

              {/* Previous quantity */}
              <span
                style={{
                  fontSize: '12px',
                  color: colors.text3,
                  textAlign: 'center',
                }}
              >
                {movement.quantity_before ?? '—'}
              </span>

              {/* New quantity */}
              <span
                style={{
                  fontSize: '12px',
                  color: colors.text3,
                  textAlign: 'center',
                }}
              >
                {movement.quantity_after ?? '—'}
              </span>

              {/* Reason */}
              <span
                style={{
                  fontSize: '12px',
                  color: colors.text2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {movement.reason || movement.type}
              </span>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'space-between',
            gap: spacing.sm,
            padding: spacing.md,
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          <span
            style={{
              fontSize: '12px',
              color: colors.text3,
              textAlign: isMobile ? 'center' : 'left',
            }}
          >
            {t('products.showing')} {pageStart}–{pageEnd} {t('products.of')} {totalItems}
          </span>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
              justifyContent: isMobile ? 'space-between' : 'flex-end',
              flexWrap: 'wrap',
            }}
          >
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              aria-label={t('products.rowsPerPage')}
              style={{
                appearance: 'none',
                fontSize: '12px',
                fontWeight: 600,
                color: colors.text2,
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.md,
                padding: '6px 10px',
                minHeight: touchTargets.min,
                cursor: 'pointer',
              }}
            >
              {[10, 25, 50].map((size) => (
                <option key={size} value={size}>
                  {size} / {t('products.page')}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: touchTargets.min,
                height: touchTargets.min,
                padding: '0 12px',
                fontSize: '13px',
                fontWeight: 700,
                color: colors.text2,
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.md,
                cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                opacity: safePage <= 1 ? 0.5 : 1,
              }}
            >
              {t('products.prev')}
            </button>

            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: colors.text1,
                padding: '0 6px',
                whiteSpace: 'nowrap',
              }}
            >
              {safePage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: touchTargets.min,
                height: touchTargets.min,
                padding: '0 12px',
                fontSize: '13px',
                fontWeight: 700,
                color: colors.text2,
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.md,
                cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
                opacity: safePage >= totalPages ? 0.5 : 1,
              }}
            >
              {t('products.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default InventoryMovementTable;
