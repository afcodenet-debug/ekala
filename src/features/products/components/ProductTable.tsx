import React from 'react';
import { 
  Package, RefreshCw, Edit2, Trash2, ArrowUpDown, 
  CheckCircle, AlertCircle, XCircle 
} from 'lucide-react';
import { EnterpriseTokens } from '../../../lib/design-system';
import { Product } from '../types';
import { useSettingsStore } from '../../../stores/useSettingsStore';
import { useI18n } from '../../../lib/i18n';
import { formatPrice } from '../../../lib/i18n/currency';

const { colors } = EnterpriseTokens;

interface ProductTableProps {
  products: Product[];
  onEdit: (p: Product) => void;
  onDelete: (id: number) => void;
  onAdjust: (p: Product) => void;
  onSort: (field: any) => void;
  isAdmin: boolean;
}

function ProductAvatar({ imageUrl, name }: { imageUrl?: string | null; name: string }) {
  const src = imageUrl ?? undefined;
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover', background: colors.surface }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: colors.surface, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Package size={20} color={colors.text3} />
    </div>
  );
}

/**
 * High-density Enterprise Table.
 * Optimized for rapid data scanning and accessibility.
 */
export const ProductTable: React.FC<ProductTableProps> = React.memo(({
  products, onEdit, onDelete, onAdjust, onSort, isAdmin
}) => {
  const { currency } = useSettingsStore();
  const { lang, t } = useI18n();
  return (
    <div style={{ overflowX: 'auto' }} className="custom-scroll">
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr style={{ background: colors.surface }}>
            <th className="th-ent" onClick={() => onSort('name')}>{t('products.productName')} <ArrowUpDown size={12}/></th>
            <th className="th-ent">{t('products.category')}</th>
            <th className="th-ent" style={{ textAlign: 'center' }} onClick={() => onSort('stock_quantity')}>{t('products.stock')} <ArrowUpDown size={12}/></th>
            <th className="th-ent" style={{ textAlign: 'right' }}>{t('products.sellPrice')}</th>
            <th className="th-ent" style={{ textAlign: 'right' }}>{t('products.grossMargin')}</th>
            <th className="th-ent" style={{ textAlign: 'center' }}>{t('common.status')}</th>
            {isAdmin && <th className="th-ent" style={{ textAlign: 'center' }}>{t('common.actions')}</th>}
          </tr>
        </thead>
        <tbody>
          {products.map(p => {
            const isOos = p.stock_quantity <= 0;
            const isLow = p.stock_quantity <= p.minimum_stock && p.stock_quantity > 0;
            const margin = p.selling_price - p.buying_price;
            
            return (
              <tr key={p.id} className="row-ent">
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <ProductAvatar imageUrl={p.image_url} name={p.name} />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: colors.text1 }}>{p.name}</div>
                      <div className="mono" style={{ fontSize: '10px', color: colors.text3 }}>{p.barcode || 'NO-SKU'}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span className="cat-badge">{p.category_name}</span>
                </td>
                <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: isOos ? colors.accent.red : isLow ? colors.accent.amber : colors.text1 }} className="mono">{p.stock_quantity}</div>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: colors.text3 }}>{p.unit.toUpperCase()}</div>
                </td>
                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                   <div style={{ fontSize: '15px', fontWeight: 800, color: colors.accent.gold }} className="mono">{formatPrice(p.selling_price, currency, lang)}</div>
                </td>
                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                   <div style={{ fontSize: '14px', fontWeight: 700, color: colors.accent.green }} className="mono">+{formatPrice(margin, currency, lang)}</div>
                   <div style={{ fontSize: '9px', fontWeight: 700, color: colors.text3 }}>{t('products.unitProfit')}</div>
                </td>
                <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                  {isOos ? (
                    <div className="status-pill red"><XCircle size={12}/> {t('products.outStockStatus')}</div>
                  ) : isLow ? (
                    <div className="status-pill amber"><AlertCircle size={12}/> {t('products.lowStockStatus')}</div>
                  ) : (
                    <div className="status-pill green"><CheckCircle size={12}/> {t('products.inStockStatus')}</div>
                  )}
                </td>
                {isAdmin && (
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                      <button onClick={() => onAdjust(p)} className="btn-table" title={t('products.adjustStock')}><RefreshCw size={14}/></button>
                      <button onClick={() => onEdit(p)} className="btn-table blue" title={t('common.edit')}><Edit2 size={14}/></button>
                      <button onClick={() => onDelete(p.id)} className="btn-table red" title={t('common.delete')}><Trash2 size={14}/></button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <style>{`
        .th-ent { padding: 16px 24px; font-size: 10px; font-weight: 800; color: ${colors.text3}; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid ${colors.border}; cursor: pointer; }
        .th-ent:hover { color: ${colors.text1}; }
        .row-ent { border-bottom: 1px solid ${colors.border}; transition: background 0.2s; }
        .row-ent:hover { background: rgba(255,255,255,0.015); }
        .cat-badge { padding: 4px 10px; borderRadius: 6px; background: rgba(255,255,255,0.03); fontSize: 11px; fontWeight: 600; color: ${colors.text2}; text-transform: uppercase; }
        .status-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 100px; font-size: 10px; fontWeight: 900; }
        .status-pill.red { background: ${colors.accent.redDim}; color: ${colors.accent.red}; }
        .status-pill.amber { background: ${colors.accent.amberDim}; color: ${colors.accent.amber}; }
        .status-pill.green { background: ${colors.accent.greenDim}; color: ${colors.accent.green}; }
        .btn-table { width: 34px; height: 34px; border-radius: 8px; background: ${colors.surface}; border: 1px solid ${colors.border}; color: ${colors.text3}; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .btn-table:hover { border-color: ${colors.text1}; color: ${colors.text1}; transform: translateY(-1px); }
        .btn-table.blue:hover { border-color: ${colors.accent.blue}; color: ${colors.accent.blue}; }
        .btn-table.red:hover { border-color: ${colors.accent.red}; color: ${colors.accent.red}; }
      `}</style>
    </div>
  );
});
