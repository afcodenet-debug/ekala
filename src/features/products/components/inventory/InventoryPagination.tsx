import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EnterpriseTokens } from '../../../../lib/design-system';
import { useI18n } from '../../../../lib/i18n';

const { colors, radius } = EnterpriseTokens;

interface InventoryPaginationProps {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export const InventoryPagination: React.FC<InventoryPaginationProps> = React.memo(({
  page,
  pageCount,
  pageSize,
  total,
  hasPrev,
  hasNext,
  onPageChange,
  onPageSizeChange,
}) => {
  const { t } = useI18n();

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', padding: '18px 0' }}>
      <div style={{ color: colors.text3, fontSize: '13px' }}>
        Showing {Math.min((page - 1) * pageSize + 1, total)} - {Math.min(page * pageSize, total)} of {total}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={!hasPrev}
          style={{
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            background: colors.surface,
            color: hasPrev ? colors.text1 : colors.text3,
            width: 42,
            height: 42,
            display: 'grid',
            placeItems: 'center',
            cursor: hasPrev ? 'pointer' : 'not-allowed',
          }}
        >
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: '13px', color: colors.text2 }}>{page} / {pageCount}</span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          disabled={!hasNext}
          style={{
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            background: colors.surface,
            color: hasNext ? colors.text1 : colors.text3,
            width: 42,
            height: 42,
            display: 'grid',
            placeItems: 'center',
            cursor: hasNext ? 'pointer' : 'not-allowed',
          }}
        >
          <ChevronRight size={16} />
        </button>
        <select
          value={pageSize}
          onChange={event => onPageSizeChange(Number(event.target.value))}
          style={{
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            background: colors.surface,
            color: colors.text1,
            padding: '10px 12px',
            fontSize: '13px',
          }}
        >
          {[10, 20, 50].map(size => (
            <option key={size} value={size}>{size} / page</option>
          ))}
        </select>
      </div>
    </div>
  );
});
