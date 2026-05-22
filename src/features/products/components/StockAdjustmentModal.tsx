import React from 'react';
import { X, Plus, Minus, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { EnterpriseTokens } from '../../../lib/design-system';
import { Product } from '../types';
import { useI18n } from '../../../lib/i18n';

const { colors, radius, shadows } = EnterpriseTokens;

// Predefined professional reasons (localized keys)
const PREDEFINED_REASONS = [
  'products.reasonPresets.received',
  'products.reasonPresets.breakage',
  'products.reasonPresets.loss',
  'products.reasonPresets.inventoryCount',
  'products.reasonPresets.adminCorrection',
  'products.reasonPresets.return',
  'products.reasonPresets.waste',
] as const;

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onConfirm: (qty: number, type: 'addition' | 'subtraction', reason: string) => Promise<void>;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen, onClose, product, onConfirm
}) => {
  const { t } = useI18n();
  const [qty, setQty] = React.useState(1);
  const [type, setType] = React.useState<'addition' | 'subtraction'>('addition');
  const [reason, setReason] = React.useState('');
  const [selectedReasonKey, setSelectedReasonKey] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  if (!isOpen || !product) return null;

  const currentStock = product.stock_quantity ?? 0;
  const projectedStock = type === 'addition' 
    ? currentStock + qty 
    : Math.max(0, currentStock - qty);

  const isLowStockAfter = projectedStock <= (product.minimum_stock ?? 0);
  const isValid = qty > 0 && reason.trim().length >= 3;

  const handleReasonSelect = (key: string) => {
    setSelectedReasonKey(key);
    setReason(t(key));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    
    setShowConfirm(true);
  };

  const executeAdjustment = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(qty, type, reason.trim());
      resetForm();
      onClose();
    } catch (err) {
      console.error('Adjustment failed', err);
    } finally {
      setIsSubmitting(false);
      setShowConfirm(false);
    }
  };

  const resetForm = () => {
    setQty(1);
    setType('addition');
    setReason('');
    setSelectedReasonKey('');
    setShowConfirm(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <>
      {/* Main Modal */}
      <div 
        style={{ 
          position: 'fixed', inset: 0, 
          background: 'rgba(0,0,0,0.85)', 
          backdropFilter: 'blur(12px)', 
          zIndex: 2100, 
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          padding: '20px' 
        }} 
        onClick={handleClose}
      >
        <div 
          style={{ 
            background: colors.card, 
            border: `1px solid ${colors.borderHi}`, 
            borderRadius: radius.xl, 
            width: '100%', 
            maxWidth: '520px', 
            padding: '32px', 
            boxShadow: shadows.hard 
          }} 
          onClick={e => e.stopPropagation()} 
          className="animate-slide"
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <div style={{ 
                  width: 32, height: 32, 
                  background: type === 'addition' ? colors.accent.green : colors.accent.red, 
                  borderRadius: radius.sm, 
                  display: 'flex', alignItems: 'center', justifyContent: 'center' 
                }}>
                  {type === 'addition' ? <TrendingUp size={18} color="#fff" /> : <TrendingDown size={18} color="#fff" />}
                </div>
                <h3 style={{ fontSize: '21px', fontWeight: 800, margin: 0 }}>{t('products.stockMovement')}</h3>
              </div>
              <p style={{ fontSize: '15px', color: colors.accent.gold, fontWeight: 700 }}>{product.name}</p>
            </div>
            <button 
              onClick={handleClose} 
              style={{ background: colors.surface, border: 'none', color: colors.text3, padding: '6px', cursor: 'pointer', borderRadius: radius.sm }}
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Type Selector */}
            <div style={{ display: 'flex', background: colors.surface, padding: '4px', borderRadius: radius.lg, border: `1px solid ${colors.border}`, marginBottom: '28px' }}>
              <button 
                type="button" 
                onClick={() => setType('addition')} 
                style={{ 
                  flex: 1, padding: '14px', borderRadius: radius.md, border: 'none', 
                  fontSize: '13px', fontWeight: 800, cursor: 'pointer',
                  background: type === 'addition' ? colors.accent.green : 'transparent', 
                  color: type === 'addition' ? '#fff' : colors.text3,
                  transition: 'all 0.15s ease'
                }}
              >
                + {t('products.in')} (Purchase / Receipt)
              </button>
              <button 
                type="button" 
                onClick={() => setType('subtraction')} 
                style={{ 
                  flex: 1, padding: '14px', borderRadius: radius.md, border: 'none', 
                  fontSize: '13px', fontWeight: 800, cursor: 'pointer',
                  background: type === 'subtraction' ? colors.accent.red : 'transparent', 
                  color: type === 'subtraction' ? '#fff' : colors.text3,
                  transition: 'all 0.15s ease'
                }}
              >
                - {t('products.out')} (Waste / Sale / Loss)
              </button>
            </div>

            {/* Quantity + Preview */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 800, color: colors.text3, textTransform: 'uppercase' }}>
                  {t('products.quantity')}
                </label>
                <div style={{ fontSize: '12px', color: colors.text3 }}>
                  Current: <span style={{ fontWeight: 700, color: colors.text1 }}>{currentStock}</span> → 
                  <span style={{ fontWeight: 800, color: isLowStockAfter ? colors.accent.red : colors.accent.green, marginLeft: 6 }}>
                    {projectedStock}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', background: colors.surface, borderRadius: radius.lg, padding: '20px' }}>
                <button 
                  type="button" 
                  onClick={() => setQty(Math.max(1, qty - 1))} 
                  style={{ width: 48, height: 48, borderRadius: '999px', background: colors.card, border: `1px solid ${colors.border}`, color: colors.text1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Minus size={22} />
                </button>
                
                <input 
                  type="number" 
                  required 
                  min="1" 
                  style={{ 
                    width: '120px', background: 'transparent', border: 'none', 
                    fontSize: '42px', fontWeight: 800, color: colors.text1, textAlign: 'center', outline: 'none' 
                  }} 
                  className="mono" 
                  value={qty} 
                  onChange={e => setQty(Math.max(1, Number(e.target.value) || 1))} 
                />
                
                <button 
                  type="button" 
                  onClick={() => setQty(qty + 1)} 
                  style={{ width: 48, height: 48, borderRadius: '999px', background: colors.card, border: `1px solid ${colors.border}`, color: colors.text1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Plus size={22} />
                </button>
              </div>

              {isLowStockAfter && (
                <div style={{ 
                  marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, 
                  padding: '8px 14px', background: 'rgba(239,68,68,0.1)', borderRadius: radius.md,
                  border: `1px solid ${colors.accent.red}30`
                }}>
                  <AlertTriangle size={16} color={colors.accent.red} />
                  <span style={{ fontSize: '13px', color: colors.accent.red, fontWeight: 600 }}>
                    {t('products.willBeLowStock')}
                  </span>
                </div>
              )}
            </div>

            {/* Reason */}
            <div style={{ marginBottom: '28px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: colors.text3, marginBottom: '10px', textTransform: 'uppercase' }}>
                {t('products.reason')}
              </label>

              {/* Predefined reasons chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                {PREDEFINED_REASONS.map(key => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleReasonSelect(key)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '999px',
                      border: `1px solid ${selectedReasonKey === key ? colors.accent.gold : colors.border}`,
                      background: selectedReasonKey === key ? colors.accent.gold + '15' : colors.surface,
                      color: selectedReasonKey === key ? colors.accent.gold : colors.text2,
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {t(key)}
                  </button>
                ))}
              </div>

              <textarea 
                required 
                placeholder={t('products.reasonPlaceholder')} 
                style={{ 
                  width: '100%', background: colors.surface, border: `1px solid ${colors.border}`, 
                  borderRadius: radius.md, padding: '14px 16px', color: colors.text1, 
                  fontSize: '14px', outline: 'none', minHeight: '92px', resize: 'vertical' 
                }}
                value={reason}
                onChange={e => { setReason(e.target.value); setSelectedReasonKey(''); }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button 
                type="button" 
                onClick={handleClose} 
                style={{ 
                  padding: '15px', borderRadius: radius.md, background: 'transparent', 
                  border: `1px solid ${colors.border}`, color: colors.text2, fontWeight: 700 
                }}
              >
                {t('common.cancel')}
              </button>
              <button 
                type="submit" 
                disabled={!isValid || isSubmitting} 
                style={{ 
                  padding: '15px', borderRadius: radius.md, background: colors.accent.gold, 
                  border: 'none', color: colors.bg, fontWeight: 900, 
                  cursor: (!isValid || isSubmitting) ? 'not-allowed' : 'pointer', 
                  opacity: (!isValid || isSubmitting) ? 0.5 : 1 
                }}
              >
                {isSubmitting ? t('products.processing') : t('products.validateMovement')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: colors.card, borderRadius: radius.xl, padding: '32px', maxWidth: '420px', width: '90%', border: `1px solid ${colors.borderHi}` }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 800 }}>{t('products.confirmAdjustment')}</h4>
            <p style={{ color: colors.text2, marginBottom: '24px', lineHeight: 1.5 }}>
              {t('products.confirmText', { 
                action: type === 'addition' ? t('products.add') : t('products.remove'),
                qty, 
                name: product.name,
                before: currentStock,
                after: projectedStock
              })}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: '14px', borderRadius: radius.md, background: colors.surface, border: `1px solid ${colors.border}`, color: colors.text1, fontWeight: 700 }}>
                {t('common.cancel')}
              </button>
              <button onClick={executeAdjustment} disabled={isSubmitting} style={{ flex: 1, padding: '14px', borderRadius: radius.md, background: colors.accent.gold, border: 'none', color: colors.bg, fontWeight: 800 }}>
                {isSubmitting ? '...' : t('products.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
