import React, { useMemo, useState } from 'react';
import { Eye, Edit2, RefreshCw, Copy, Archive, MoreVertical, Trash2 } from 'lucide-react';
import { EnterpriseTokens } from '../../../../lib/design-system';
import { useI18n } from '../../../../lib/i18n';
import { Product } from '../../types';
import { formatPrice } from '../../../../lib/i18n/currency';
import { useSettingsStore } from '../../../../stores/useSettingsStore';

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

const DirectionIcon = ({ field, sortField, sortDirection }: { field: string; sortField: string; sortDirection: 'asc' | 'desc' }) => {
  const active = field === sortField;
  return (
    <span style={{ opacity: active ? 1 : 0.35, fontSize: 12 }}>
      {active ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
    </span>
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
  const { t } = useI18n();
  const [openActionId, setOpenActionId] = useState<number | null>(null);

  const allSelected = products.length > 0 && products.every(product => selectedIds.includes(product.id));

  const rows = useMemo(() => products, [products]);

  return (
    <div style={{ overflowX: 'auto' }} className="inventory-table-shell">
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 940 }}>
        <thead>
          <tr>
            <th style={{ position: 'sticky', top: 0, background: colors.card, zIndex: 2, padding: '16px 18px', borderBottom: `1px solid ${colors.border}` }}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={event => onSelectAll(event.target.checked)}
                aria-label="Select all products"
              />
            </th>
            <th onClick={() => onSort('name')} className="inventory-header-cell">{t('products.productName')} <DirectionIcon field="name" sortField={sortField} sortDirection={sortDirection} /></th>
            <th className="inventory-header-cell">{t('products.category')}</th>
            <th onClick={() => onSort('stock_quantity')} className="inventory-header-cell" style={{ textAlign: 'center' }}>{t('products.stock')} <DirectionIcon field="stock_quantity" sortField={sortField} sortDirection={sortDirection} /></th>
            <th onClick={() => onSort('selling_price')} className="inventory-header-cell" style={{ textAlign: 'right' }}>{t('products.sellPrice')} <DirectionIcon field="selling_price" sortField={sortField} sortDirection={sortDirection} /></th>
            <th className="inventory-header-cell" style={{ textAlign: 'right' }}>{t('products.grossMargin')}</th>
            <th className="inventory-header-cell" style={{ textAlign: 'center' }}>{t('common.status')}</th>
            {isAdmin && <th className="inventory-header-cell" style={{ textAlign: 'center' }}>{t('common.actions')}</th>}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <tr key={index} className="inventory-row-skeleton">
                <td colSpan={isAdmin ? 8 : 7}><div className="inventory-skeleton-row" /></td>
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={isAdmin ? 8 : 7} style={{ padding: '48px 24px', textAlign: 'center', color: colors.text3 }}>
                {t('products.noProducts')}
              </td>
            </tr>
          ) : rows.map(product => {
            const isSelected = selectedIds.includes(product.id);
            const isOos = product.stock_quantity <= 0;
            const isLow = product.stock_quantity > 0 && product.stock_quantity <= product.minimum_stock;
            const margin = product.selling_price - product.buying_price;

            const isHighlighted = highlightProductId === product.id;

            return (
              <tr 
                key={product.id} 
                className="inventory-row"
                style={isHighlighted ? { 
                  background: 'rgba(59, 130, 246, 0.08)',
                  borderLeft: '4px solid var(--blue)'
                } : {}}
              >
                <td style={{ padding: '16px 18px' }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={event => onSelectRow(product.id, event.target.checked)}
                    aria-label={`Select ${product.name}`}
                  />
                </td>
                <td style={{ padding: '16px 18px' }}>
                  <button type="button" onClick={() => onViewDetails(product)} style={{ display: 'flex', alignItems: 'center', gap: '14px', border: 'none', background: 'transparent', padding: 0, width: '100%', textAlign: 'left', cursor: 'pointer' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, background: colors.surface, border: `1px solid ${colors.border}`, overflow: 'hidden', position: 'relative', display: 'grid', placeItems: 'center' }}>
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <span style={{ color: colors.text3, fontWeight: 700 }}>{product.name.charAt(0)}</span>
                      )}
                    </div>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: colors.text1 }}>{product.name}</span>
                      <span style={{ fontSize: '12px', color: colors.text3 }}>{product.barcode || 'NO-SKU'}</span>
                    </div>
                  </button>
                </td>
                <td style={{ padding: '16px 18px' }}>
                  <span className="inventory-badge">{product.category_name}</span>
                </td>
                <td style={{ padding: '16px 18px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 800, color: isOos ? colors.accent.red : isLow ? colors.accent.amber : colors.text1 }}>{product.stock_quantity}</div>
                  <div style={{ fontSize: '11px', color: colors.text3 }}>{product.unit}</div>
                </td>
                <td style={{ padding: '16px 18px', textAlign: 'right' }}>{formatPrice(product.selling_price, currency, lang)}</td>
                <td style={{ padding: '16px 18px', textAlign: 'right', color: colors.accent.green }}>{formatPrice(margin, currency, lang)}</td>
                <td style={{ padding: '16px 18px', textAlign: 'center' }}>
                  <span className={`inventory-status ${isOos ? 'danger' : isLow ? 'warning' : 'success'}`}>
                    {isOos ? t('products.outOfStock') : isLow ? t('products.lowStockAlerts') : t('products.inStockStatus')}
                  </span>
                </td>
                {isAdmin && (
                  <td style={{ padding: '16px 18px', textAlign: 'center', position: 'relative' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <button type="button" onClick={() => setOpenActionId(openActionId === product.id ? null : product.id)} aria-label="Open row actions" style={{ width: 38, height: 38, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text2, cursor: 'pointer' }}>
                        <MoreVertical size={16} />
                      </button>
                      {openActionId === product.id && (
                        <div className="inventory-row-menu" role="menu">
                          <button type="button" role="menuitem" onClick={() => { setOpenActionId(null); onViewDetails(product); }}><Eye size={14} /> {t('products.stockHistory')}</button>
                          <button type="button" role="menuitem" onClick={() => { setOpenActionId(null); onAdjust(product); }}><RefreshCw size={14} /> {t('products.adjustStock')}</button>
                          <button type="button" role="menuitem" onClick={() => { setOpenActionId(null); onEdit(product); }}><Edit2 size={14} /> {t('common.edit')}</button>
                          <button type="button" role="menuitem" onClick={() => { setOpenActionId(null); onDuplicate(product); }}><Copy size={14} /> Duplicate</button>
                          <button type="button" role="menuitem" onClick={() => { setOpenActionId(null); onArchive(product); }}><Archive size={14} /> Archive</button>
                          <button type="button" role="menuitem" onClick={() => { setOpenActionId(null); onDelete(product.id); }}><Trash2 size={14} /> {t('common.delete')}</button>
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
          padding: 16px 18px;
          font-size: 11px;
          font-weight: 800;
          color: ${colors.text3};
          text-transform: uppercase;
          letter-spacing: 0.08em;
          border-bottom: 1px solid ${colors.border};
          cursor: pointer;
          user-select: none;
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

        .inventory-status.success { background: ${colors.accent.greenDim}; color: ${colors.accent.green}; }
        .inventory-status.warning { background: ${colors.accent.amberDim}; color: ${colors.accent.amber}; }
        .inventory-status.danger { background: ${colors.accent.redDim}; color: ${colors.accent.red}; }

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
        }

        .inventory-row-menu button:hover {
          background: ${colors.surface};
          color: ${colors.text1};
        }

        .inventory-row-skeleton td {
          padding: 16px 18px;
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
      `}</style>
    </div>
  );
});
