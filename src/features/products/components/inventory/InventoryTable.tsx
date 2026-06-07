import React, { useMemo, useState } from 'react';
import { Eye, Edit2, RefreshCw, Copy, Archive, MoreVertical, Trash2, Package } from 'lucide-react';
import { EnterpriseTokens } from '../../../../lib/design-system';
import { useI18n } from '../../../../lib/i18n';
import { Product } from '../../types';
import { formatPrice } from '../../../../lib/i18n/currency';
import { useSettingsStore } from '../../../../stores/useSettingsStore';
import { useBreakpoint } from '../../../../lib/hooks/useBreakpoint';
import { spacing, touchTargets } from '../../../../lib/design-system/responsive';

const { colors, radius } = EnterpriseTokens;

interface InventoryTableProps {
  products: Product[];
  loading: boolean;
  selectedIds: number[];
  onSelectRow: (id: number, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
  onEdit: (product: Product) => void;
  onAdjust: (product: Product) => void;
  onViewDetails: (product: Product) => void;
  onDuplicate: (product: Product) => void;
  onArchive: (product: Product) => void;
  onDelete: (productId: number) => void;
  isAdmin: boolean;
  highlightProductId?: number;
}

const DirectionIcon = ({ 
  field, 
  sortField, 
  sortDirection 
}: { 
  field: string; 
  sortField: string; 
  sortDirection: 'asc' | 'desc' 
}) => {
  const active = field === sortField;
  return (
    <span style={{ 
      opacity: active ? 1 : 0.35, 
      fontSize: 12,
      marginLeft: spacing.xs
    }}>
      {active ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );
};

// Mobile card view - compact product cards for mobile
const MobileProductCards: React.FC<{
  products: Product[];
  selectedIds: number[];
  onSelectRow: (id: number, selected: boolean) => void;
  onViewDetails: (product: Product) => void;
  onAdjust: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDuplicate: (product: Product) => void;
  onArchive: (product: Product) => void;
  onDelete: (productId: number) => void;
  isAdmin: boolean;
  highlightProductId?: number;
  currency: string;
  lang: string;
  isMobile: boolean;
}> = ({
  products,
  selectedIds,
  onSelectRow,
  onViewDetails,
  onAdjust,
  onEdit,
  onDuplicate,
  onArchive,
  onDelete,
  isAdmin,
  highlightProductId,
  currency,
  lang,
  isMobile,
}) => {
  const { t } = useI18n();

  if (products.length === 0) return null;

  return (
    <div
      style={{
        display: 'grid',
        gap: spacing.sm,
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      }}
    >
      {products.map(product => {
        const isSelected = selectedIds.includes(product.id);
        const isOos = product.stock_quantity <= 0;
        const isLow = product.stock_quantity > 0 && product.stock_quantity <= product.minimum_stock;
        const margin = product.selling_price - product.buying_price;
        const statusLabel = isOos
          ? t('products.outOfStock')
          : isLow
          ? t('products.lowStockAlerts')
          : t('products.inStockStatus');
        const statusColor = isOos ? colors.accent.red : isLow ? colors.accent.amber : colors.accent.green;
        const statusBg = isOos
          ? colors.accent.redDim
          : isLow
          ? colors.accent.amberDim
          : colors.accent.greenDim;
        const isHighlighted = highlightProductId === product.id;

        return (
          <div
            key={product.id}
            style={{
              background: colors.card,
              border: `1px solid ${isHighlighted ? colors.accent.blue : colors.border}`,
              borderRadius: radius.lg,
              padding: spacing.sm,
              display: 'flex',
              flexDirection: 'column',
              gap: spacing.xs,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: isHighlighted
                ? `0 0 0 2px ${colors.accent.blue}30, 0 4px 12px rgba(59,130,246,0.15)`
                : 'none',
            }}
            onClick={() => onViewDetails(product)}
          >
            {/* Header with checkbox, image, and name */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.xs,
              }}
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  e.stopPropagation();
                  onSelectRow(product.id, e.target.checked);
                }}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Select ${product.name}`}
                style={{
                  flexShrink: 0,
                  width: isMobile ? 20 : 18,
                  height: isMobile ? 20 : 18,
                  cursor: 'pointer',
                }}
              />

              {/* Product image/initial */}
              <div
                style={{
                  width: isMobile ? 40 : 44,
                  height: isMobile ? 40 : 44,
                  borderRadius: radius.md,
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  overflow: 'hidden',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <Package
                    size={isMobile ? 16 : 18}
                    color={colors.text3}
                  />
                )}
              </div>

              {/* Product info */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: isMobile ? '13px' : '14px',
                    fontWeight: 700,
                    color: colors.text1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {product.name}
                </p>
                {product.barcode && (
                  <p
                    style={{
                      margin: '2px 0 0',
                      fontSize: isMobile ? '10px' : '11px',
                      color: colors.text3,
                    }}
                  >
                    {product.barcode}
                  </p>
                )}
              </div>

              {/* Stock badge */}
              <span
                style={{
                  flexShrink: 0,
                  padding: isMobile ? '4px 8px' : '6px 10px',
                  borderRadius: 999,
                  background: statusBg,
                  color: statusColor,
                  fontSize: isMobile ? '10px' : '11px',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase',
                }}
              >
                {product.stock_quantity} {product.unit}
              </span>
            </div>

            {/* Prices */}
            <div
              style={{
                display: 'flex',
                gap: spacing.sm,
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: isMobile ? '12px' : '13px',
                  color: colors.text2,
                }}
              >
                Cost: ${product.buying_price.toFixed(2)}
              </span>
              <span
                style={{
                  fontSize: isMobile ? '12px' : '13px',
                  color: colors.text1,
                  fontWeight: 700,
                }}
              >
                Price: ${product.selling_price.toFixed(2)}
              </span>
              <span
                style={{
                  fontSize: isMobile ? '11px' : '12px',
                  color: margin >= 0 ? colors.accent.green : colors.accent.red,
                  fontWeight: 600,
                }}
              >
                Margin: {formatPrice(margin, currency, lang)}
              </span>
            </div>

            {/* Category */}
            <span
              style={{
                display: 'inline-flex',
                alignSelf: 'flex-start',
                alignItems: 'center',
                padding: isMobile ? '4px 8px' : '4px 10px',
                borderRadius: 999,
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                color: colors.text3,
                fontSize: isMobile ? '10px' : '11px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}
            >
              {product.category_name}
            </span>

            {/* Status */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: spacing.xs,
                borderTop: `1px solid ${colors.border}`,
              }}
            >
              <span
                style={{
                  fontSize: isMobile ? '10px' : '11px',
                  color: statusColor,
                  fontWeight: 700,
                }}
              >
                {statusLabel}
              </span>

              {isAdmin && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Simple action menu for mobile
                    const actions = [
                      { label: t('products.stockHistory'), action: () => onViewDetails(product) },
                      { label: t('products.adjustStock'), action: () => onAdjust(product) },
                      { label: t('common.edit'), action: () => onEdit(product) },
                      { label: 'Duplicate', action: () => onDuplicate(product) },
                      { label: t('common.archive'), action: () => onArchive(product) },
                      { label: t('common.delete'), action: () => onDelete(product.id) },
                    ];

                    // Create a simple bottom sheet for actions on mobile
                    const sheet = document.createElement('div');
                    sheet.style.cssText = `
                      position: fixed;
                      bottom: 0;
                      left: 0;
                      right: 0;
                      background: ${colors.card};
                      border-top: 1px solid ${colors.border};
                      border-radius: ${radius.xl} ${radius.xl} 0 0;
                      padding: 16px;
                      z-index: 3000;
                      max-height: 70vh;
                      overflow-y: auto;
                      animation: slideUp 0.3s ease;
                    `;
                    sheet.innerHTML = `
                      <style>
                        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
                        .action-btn { display: block; width: 100%; padding: 12px 16px; border: none; background: ${colors.surface}; border-radius: ${radius.md}; color: ${colors.text1}; font-size: 14px; font-weight: 600; cursor: pointer; text-align: left; margin-bottom: 4px; }
                        .action-btn:last-child { margin-bottom: 0; }
                        .danger { color: ${colors.accent.red}; }
                      </style>
                      ${actions.map(a => `
                        <button class="action-btn ${a.label === 'Delete' || a.label === 'Supprimer' || a.label === 'delete' ? 'danger' : ''}" onclick="this.__action(); document.getElementById('action-sheet-${product.id}').remove()">
                          ${a.label}
                        </button>
                      `).join('')}
                    `;
                    sheet.id = `action-sheet-${product.id}`;
                    actions.forEach((a, i) => {
                      const btn = sheet.querySelectorAll('button')[i];
                      if (btn) btn.__action = a.action;
                    });
                    document.body.appendChild(sheet);
                  }}
                  aria-label="Open row actions"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    border: `1px solid ${colors.border}`,
                    background: colors.surface,
                    color: colors.text2,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <MoreVertical size={14} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Desktop/tablet table view
const DesktopTable: React.FC<{
  products: Product[];
  loading: boolean;
  selectedIds: number[];
  onSelectRow: (id: number, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
  onEdit: (product: Product) => void;
  onAdjust: (product: Product) => void;
  onViewDetails: (product: Product) => void;
  onDuplicate: (product: Product) => void;
  onArchive: (product: Product) => void;
  onDelete: (productId: number) => void;
  isAdmin: boolean;
  highlightProductId?: number;
  currency: string;
  lang: string;
  openActionId: number | null;
  setOpenActionId: (id: number | null) => void;
}> = ({
  products,
  loading,
  selectedIds,
  onSelectRow,
  onSelectAll,
  sortField,
  sortDirection,
  onSort,
  onEdit,
  onAdjust,
  onViewDetails,
  onDuplicate,
  onArchive,
  onDelete,
  isAdmin,
  highlightProductId,
  currency,
  lang,
  openActionId,
  setOpenActionId,
}) => {
  const { t } = useI18n();
  const isSelected = (id: number) => selectedIds.includes(id);

  const padding = spacing.md;

  return (
    <div style={{ overflowX: 'auto' }} className="inventory-table-shell">
      <table
        style={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: 0,
          minWidth: 940,
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                position: 'sticky',
                top: 0,
                background: colors.card,
                zIndex: 2,
                padding,
                borderBottom: `1px solid ${colors.border}`,
              }}
            >
              <input
                type="checkbox"
                checked={products.length > 0 && products.every(product => selectedIds.includes(product.id))}
                onChange={(event) => onSelectAll(event.target.checked)}
                aria-label="Select all products"
              />
            </th>
            <th onClick={() => onSort('name')} className="inventory-header-cell">
              {t('products.productName')}
              <DirectionIcon field="name" sortField={sortField} sortDirection={sortDirection} />
            </th>
            <th className="inventory-header-cell">{t('products.category')}</th>
            <th
              onClick={() => onSort('stock_quantity')}
              className="inventory-header-cell"
              style={{ textAlign: 'center' }}
            >
              {t('products.stock')}
              <DirectionIcon field="stock_quantity" sortField={sortField} sortDirection={sortDirection} />
            </th>
            <th
              onClick={() => onSort('selling_price')}
              className="inventory-header-cell"
              style={{ textAlign: 'right' }}
            >
              {t('products.sellPrice')}
              <DirectionIcon field="selling_price" sortField={sortField} sortDirection={sortDirection} />
            </th>
            <th className="inventory-header-cell" style={{ textAlign: 'right' }}>
              {t('products.grossMargin')}
            </th>
            <th className="inventory-header-cell" style={{ textAlign: 'center' }}>
              {t('common.status')}
            </th>
            {isAdmin && (
              <th
                className="inventory-header-cell"
                style={{ textAlign: 'center' }}
              >
                {t('common.actions')}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 6 }).map((_, index) => (
                <tr key={index} className="inventory-row-skeleton">
                  <td colSpan={isAdmin ? 8 : 7}>
                    <div className="inventory-skeleton-row" />
                  </td>
                </tr>
              ))
            : products.length === 0
            ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 8 : 7}
                    style={{
                      padding: '48px 24px',
                      textAlign: 'center',
                      color: colors.text3,
                    }}
                  >
                    {t('products.noProducts')}
                  </td>
                </tr>
              )
            : products.map(product => {
                const isSelectedRow = isSelected(product.id);
                const isOos = product.stock_quantity <= 0;
                const isLow = product.stock_quantity > 0 && product.stock_quantity <= product.minimum_stock;
                const margin = product.selling_price - product.buying_price;
                const isHighlighted = highlightProductId === product.id;

                return (
                  <tr
                    key={product.id}
                    className="inventory-row"
                    style={{
                      background: isHighlighted
                        ? 'rgba(59, 130, 246, 0.08)'
                        : 'transparent',
                      borderLeft: isHighlighted
                        ? '4px solid var(--blue)'
                        : 'none',
                    }}
                  >
                    <td style={{ padding }}>
                      <input
                        type="checkbox"
                        checked={isSelectedRow}
                        onChange={(event) => onSelectRow(product.id, event.target.checked)}
                        aria-label={`Select ${product.name}`}
                      />
                    </td>
                    <td style={{ padding }}>
                      <button
                        type="button"
                        onClick={() => onViewDetails(product)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.sm,
                          border: 'none',
                          background: 'transparent',
                          padding: 0,
                          width: '100%',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: radius.md,
                            background: colors.surface,
                            border: `1px solid ${colors.border}`,
                            overflow: 'hidden',
                            position: 'relative',
                            display: 'grid',
                            placeItems: 'center',
                          }}
                        >
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                              }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span
                              style={{
                                color: colors.text3,
                                fontWeight: 700,
                              }}
                            >
                              {product.name.charAt(0)}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gap: 4,
                          }}
                        >
                          <span
                            style={{
                              fontSize: '14px',
                              fontWeight: 700,
                              color: colors.text1,
                            }}
                          >
                            {product.name}
                          </span>
                          <span
                            style={{
                              fontSize: '12px',
                              color: colors.text3,
                            }}
                          >
                            {product.barcode || 'NO-SKU'}
                          </span>
                        </div>
                      </button>
                    </td>
                    <td style={{ padding }}>
                      <span className="inventory-badge">{product.category_name}</span>
                    </td>
                    <td
                      style={{
                        padding,
                        textAlign: 'center',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 800,
                          color: isOos
                            ? colors.accent.red
                            : isLow
                            ? colors.accent.amber
                            : colors.text1,
                        }}
                      >
                        {product.stock_quantity}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: colors.text3,
                        }}
                      >
                        {product.unit}
                      </div>
                    </td>
                    <td style={{ padding, textAlign: 'right' }}>
                      {formatPrice(product.selling_price, currency, lang)}
                    </td>
                    <td
                      style={{
                        padding,
                        textAlign: 'right',
                        color: margin >= 0 ? colors.accent.green : colors.accent.red,
                      }}
                    >
                      {formatPrice(margin, currency, lang)}
                    </td>
                    <td
                      style={{
                        padding,
                        textAlign: 'center',
                      }}
                    >
                      <span
                        className={`inventory-status ${
                          isOos ? 'danger' : isLow ? 'warning' : 'success'
                        }`}
                      >
                        {isOos
                          ? t('products.outOfStock')
                          : isLow
                          ? t('products.lowStockAlerts')
                          : t('products.inStockStatus')}
                      </span>
                    </td>
                    {isAdmin && (
                      <td
                        style={{
                          padding,
                          textAlign: 'center',
                          position: 'relative',
                        }}
                      >
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setOpenActionId(openActionId === product.id ? null : product.id)}
                            aria-label="Open row actions"
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 12,
                              border: `1px solid ${colors.border}`,
                              background: colors.surface,
                              color: colors.text2,
                              cursor: 'pointer',
                            }}
                          >
                            <MoreVertical size={16} />
                          </button>
                          {openActionId === product.id && (
                            <div
                              className="inventory-row-menu"
                              role="menu"
                            >
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenActionId(null);
                                  onViewDetails(product);
                                }}
                              >
                                <Eye size={14} /> {t('products.stockHistory')}
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenActionId(null);
                                  onAdjust(product);
                                }}
                              >
                                <RefreshCw size={14} /> {t('products.adjustStock')}
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenActionId(null);
                                  onEdit(product);
                                }}
                              >
                                <Edit2 size={14} /> {t('common.edit')}
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenActionId(null);
                                  onDuplicate(product);
                                }}
                              >
                                <Copy size={14} /> Duplicate
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenActionId(null);
                                  onArchive(product);
                                }}
                              >
                                <Archive size={14} /> Archive
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenActionId(null);
                                  onDelete(product.id);
                                }}
                              >
                                <Trash2 size={14} /> {t('common.delete')}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
        </tbody>
      </table>

      <style>{`
        .inventory-header-cell {
          padding: ${spacing.md} ${spacing.md};
          font-size: 11px;
          font-weight: 800;
          color: ${colors.text3};
          text-transform: uppercase;
          letter-spacing: 0.08em;
          border-bottom: 1px solid ${colors.border};
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
        }

        .inventory-row:hover {
          background: rgba(255,255,255,0.02);
        }

        .inventory-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          color: ${colors.text2};
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          white-space: nowrap;
        }

        .inventory-status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.04em;
        }

        .inventory-status.success { 
          background: ${colors.accent.greenDim}; 
          color: ${colors.accent.green}; 
        }
        .inventory-status.warning { 
          background: ${colors.accent.amberDim}; 
          color: ${colors.accent.amber}; 
        }
        .inventory-status.danger { 
          background: ${colors.accent.redDim}; 
          color: ${colors.accent.red}; 
        }

        .inventory-row-menu {
          position: absolute;
          right: 8px;
          top: 54px;
          width: 220px;
          border-radius: 16px;
          background: ${colors.card};
          border: 1px solid ${colors.border};
          box-shadow: 0 20px 40px rgba(0,0,0,0.08);
          display: grid;
          gap: 6px;
          padding: 10px;
          z-index: 10;
        }

        .inventory-row-menu button {
          width: 100%;
          border: none;
          background: transparent;
          color: ${colors.text2};
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 12px;
          cursor: pointer;
          font-size: 13px;
          text-align: left;
          white-space: nowrap;
        }

        .inventory-row-menu button:hover {
          background: ${colors.surface};
          color: ${colors.text1};
        }

        .inventory-row-skeleton td {
          padding: ${spacing.md} ${spacing.md};
        }

        .inventory-skeleton-row {
          height: 66px;
          background: linear-gradient(90deg, ${colors.surface} 0%, ${colors.card} 50%, ${colors.surface} 100%);
          border-radius: 18px;
          animation: shimmer 1.4s infinite;
        }

        @keyframes shimmer {
          0% { background-position: -320px 0; }
          100% { background-position: 320px 0; }
        }

        /* Mobile-specific table adjustments */
        .mobile .inventory-table-shell {
          font-size: 12px;
        }
      `}</style>
    </div>
  );
};

export const InventoryTable: React.FC<InventoryTableProps> = React.memo(({
  products,
  loading,
  selectedIds,
  onSelectRow,
  onSelectAll,
  sortField,
  sortDirection,
  onSort,
  onEdit,
  onAdjust,
  onViewDetails,
  onDuplicate,
  onArchive,
  onDelete,
  isAdmin,
  highlightProductId,
}) => {
  const { currency, language: lang } = useSettingsStore();
  const bp = useBreakpoint();
  const { isMobile } = bp;
  const [openActionId, setOpenActionId] = useState<number | null>(null);

  // Use mobile card view on small screens, desktop table on larger screens
  if (isMobile) {
    return (
      <MobileProductCards
        products={products}
        selectedIds={selectedIds}
        onSelectRow={onSelectRow}
        onViewDetails={onViewDetails}
        onAdjust={onAdjust}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onArchive={onArchive}
        onDelete={onDelete}
        isAdmin={isAdmin}
        highlightProductId={highlightProductId}
        currency={currency}
        lang={lang}
        isMobile={isMobile}
      />
    );
  }

  return (
    <DesktopTable
      products={products}
      loading={loading}
      selectedIds={selectedIds}
      onSelectRow={onSelectRow}
      onSelectAll={onSelectAll}
      sortField={sortField}
      sortDirection={sortDirection}
      onSort={onSort}
      onEdit={onEdit}
      onAdjust={onAdjust}
      onViewDetails={onViewDetails}
      onDuplicate={onDuplicate}
      onArchive={onArchive}
      onDelete={onDelete}
      isAdmin={isAdmin}
      highlightProductId={highlightProductId}
      currency={currency}
      lang={lang}
      openActionId={openActionId}
      setOpenActionId={setOpenActionId}
    />
  );
});

export default InventoryTable;
