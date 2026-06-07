import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EnterpriseTokens } from '../../../../lib/design-system';
import { useI18n } from '../../../../lib/i18n';
import { useBreakpoint } from '../../../../lib/hooks/useBreakpoint';
import { spacing, touchTargets } from '../../../../lib/design-system/responsive';

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

export const InventoryPagination: React.FC<InventoryPaginationProps> = React.memo((props) => {
  const { t } = useI18n();
  const {
    page,
    pageCount,
    pageSize,
    total,
    hasPrev,
    hasNext,
    onPageChange,
    onPageSizeChange,
  } = props;
  const bp = useBreakpoint();
  const { isMobile, isTablet } = bp;

  const getRowText = () => {
    const start = Math.min((page - 1) * pageSize + 1, total);
    const end = Math.min(page * pageSize, total);
    return `${t('common.showing')} ${start} - ${end} ${t('common.of')} ${total}`;
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: isMobile ? 'center' : 'space-between',
        alignItems: isMobile ? 'center' : 'center',
        gap: isMobile ? spacing.sm : spacing.md,
        padding: isMobile ? spacing.md : spacing.lg,
      }}
    >
      {/* Row count info */}
      <div
        style={{
          color: colors.text3,
          fontSize: isMobile ? '12px' : '13px',
          textAlign: isMobile ? 'center' : 'left',
          order: isMobile ? 2 : 1,
        }}
      >
        {getRowText()}
      </div>

      {/* Navigation and page size selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.xs,
          flexWrap: 'wrap',
          justifyContent: isMobile ? 'center' : 'flex-end',
          order: isMobile ? 1 : 2,
        }}
      >
        {/* Previous button */}
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={!hasPrev}
          style={{
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            background: colors.surface,
            color: hasPrev ? colors.text1 : colors.text3,
            width: isMobile ? 40 : 42,
            height: isMobile ? 40 : 42,
            display: 'grid',
            placeItems: 'center',
            cursor: hasPrev ? 'pointer' : 'not-allowed',
            minHeight: touchTargets.min,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            if (hasPrev) {
              e.currentTarget.style.background = `${colors.accent.blue}10`;
              e.currentTarget.style.borderColor = `${colors.accent.blue}40`;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = colors.surface;
            e.currentTarget.style.borderColor = colors.border;
          }}
        >
          <ChevronLeft size={isMobile ? 16 : 16} />
        </button>

        {/* Page info */}
        <span
          style={{
            fontSize: isMobile ? '12px' : '13px',
            color: colors.text2,
            fontWeight: 700,
            minWidth: isMobile ? '80px' : 'auto',
            textAlign: 'center',
          }}
        >
          {page} / {pageCount}
        </span>

        {/* Next button */}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          disabled={!hasNext}
          style={{
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            background: colors.surface,
            color: hasNext ? colors.text1 : colors.text3,
            width: isMobile ? 40 : 42,
            height: isMobile ? 40 : 42,
            display: 'grid',
            placeItems: 'center',
            cursor: hasNext ? 'pointer' : 'not-allowed',
            minHeight: touchTargets.min,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            if (hasNext) {
              e.currentTarget.style.background = `${colors.accent.blue}10`;
              e.currentTarget.style.borderColor = `${colors.accent.blue}40`;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = colors.surface;
            e.currentTarget.style.borderColor = colors.border;
          }}
        >
          <ChevronRight size={isMobile ? 16 : 16} />
        </button>

        {/* Page size selector */}
        {!isMobile && (
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            style={{
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              color: colors.text1,
              padding: '10px 12px',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer',
              minHeight: touchTargets.min,
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = colors.accent.blue;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = colors.border;
            }}
          >
            {[10, 20, 50].map(size => (
              <option key={size} value={size}>
                {size} / {t('common.page')}
              </option>
            ))}
          </select>
        )}

        {isMobile && (
          <div
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              marginTop: spacing.sm,
            }}
          >
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              style={{
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                color: colors.text1,
                padding: '10px 12px',
                fontSize: '13px',
                outline: 'none',
                cursor: 'pointer',
                width: '140px',
                minHeight: touchTargets.min,
              }}
            >
              {[10, 20, 50].map(size => (
                <option key={size} value={size}>
                  {size} / {t('common.page')}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
});

export default InventoryPagination;
