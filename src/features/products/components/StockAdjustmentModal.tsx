import React from 'react';
import { X, Plus, Minus, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { EnterpriseTokens } from '../../../lib/design-system';
import { Product } from '../types';
import { useI18n } from '../../../lib/i18n';
import { useBreakpoint } from '../../../lib/hooks/useBreakpoint';
import { spacing, touchTargets, safeArea } from '../../../lib/design-system/responsive';

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
  const bp = useBreakpoint();
  const { isMobile, isTablet } = bp;

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

  // Responsive values
  const maxWidth = isMobile ? '100%' : isTablet ? '520px' : '520px';
  const padding = isMobile ? '20px 16px' : isTablet ? '24px 20px' : '32px';
  const titleFontSize = isMobile ? '18px' : isTablet ? '20px' : '21px';
  const subtitleFontSize = isMobile ? '14px' : '15px';
  const buttonFontSize = isMobile ? '12px' : '13px';

  return (
    <>
      {/* Main Modal */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: isMobile ? 'rgba(0,0,0,0.95)' : 'rgba(0,0,0,0.85)',
          backdropFilter: isMobile ? 'blur(20px)' : 'blur(12px)',
          zIndex: 2100,
          display: 'flex',
          alignItems: isMobile ? 'flex-end' : 'center',
          justifyContent: 'center',
          padding: isMobile ? 0 : spacing.md,
          paddingBottom: isMobile ? safeArea.bottom : spacing.md,
        }}
        onClick={handleClose}
      >
        <div
          style={{
            background: colors.card,
            border: isMobile ? 'none' : `1px solid ${colors.borderHi}`,
            borderRadius: isMobile
              ? `${radius.xl} ${radius.xl} 0 0`
              : radius.xl,
            width: isMobile ? '100%' : maxWidth,
            maxWidth,
            padding,
            boxShadow: isMobile ? 'none' : shadows.hard,
            marginTop: isMobile ? 'auto' : '0',
          }}
          onClick={e => e.stopPropagation()}
          className="animate-slide"
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: spacing.md,
              paddingBottom: spacing.md,
              borderBottom: isMobile ? 'none' : `1px solid ${colors.border}`,
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.xs,
                  marginBottom: spacing.xs,
                }}
              >
                <div
                  style={{
                    width: isMobile ? 28 : 32,
                    height: isMobile ? 28 : 32,
                    background: type === 'addition' ? colors.accent.green : colors.accent.red,
                    borderRadius: radius.sm,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {type === 'addition' ? (
                    <TrendingUp size={isMobile ? 16 : 18} color="#fff" />
                  ) : (
                    <TrendingDown size={isMobile ? 16 : 18} color="#fff" />
                  )}
                </div>
                <h3
                  style={{
                    fontSize: titleFontSize,
                    fontWeight: 800,
                    margin: 0,
                    color: colors.text1,
                  }}
                >
                  {t('products.stockMovement')}
                </h3>
              </div>
              <p
                style={{
                  fontSize: subtitleFontSize,
                  color: colors.accent.gold,
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                {product.name}
              </p>
            </div>

            {/* Close button */}
            <button
              onClick={handleClose}
              aria-label={t('common.close')}
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: '10px',
                width: isMobile ? '36px' : '40px',
                height: isMobile ? '36px' : '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.text3,
                cursor: 'pointer',
                minHeight: touchTargets.min,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.accent.red + '10';
                e.currentTarget.style.borderColor = colors.accent.red + '40';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = colors.surface;
                e.currentTarget.style.borderColor = colors.border;
              }}
            >
              <X size={isMobile ? 16 : 18} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Type Selector */}
            <div
              style={{
                display: 'flex',
                background: colors.surface,
                padding: '4px',
                borderRadius: radius.lg,
                border: `1px solid ${colors.border}`,
                marginBottom: spacing.md,
                minHeight: touchTargets.min,
              }}
            >
              <button
                type="button"
                onClick={() => setType('addition')}
                style={{
                  flex: 1,
                  padding: isMobile ? '12px' : '14px',
                  borderRadius: radius.md,
                  border: 'none',
                  fontSize: isMobile ? '11px' : buttonFontSize,
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: type === 'addition' ? colors.accent.green : 'transparent',
                  color: type === 'addition' ? '#fff' : colors.text3,
                  transition: 'all 0.15s ease',
                  minHeight: touchTargets.min,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.xs,
                }}
              >
                <span>+</span>
                <span>{t('products.in')}</span>
                {!isMobile && (
                  <span
                    style={{
                      fontSize: '10px',
                      opacity: 0.8,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    (Purchase / Receipt)
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setType('subtraction')}
                style={{
                  flex: 1,
                  padding: isMobile ? '12px' : '14px',
                  borderRadius: radius.md,
                  border: 'none',
                  fontSize: isMobile ? '11px' : buttonFontSize,
                  fontWeight: 800,
                  cursor: 'pointer',
                  background:
                    type === 'subtraction' ? colors.accent.red : 'transparent',
                  color: type === 'subtraction' ? '#fff' : colors.text3,
                  transition: 'all 0.15s ease',
                  minHeight: touchTargets.min,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.xs,
                }}
              >
                <span>-</span>
                <span>{t('products.out')}</span>
                {!isMobile && (
                  <span
                    style={{
                      fontSize: '10px',
                      opacity: 0.8,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    (Waste / Sale / Loss)
                  </span>
                )}
              </button>
            </div>

            {/* Quantity + Preview */}
            <div style={{ marginBottom: spacing.md }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing.sm,
                }}
              >
                <label
                  style={{
                    fontSize: isMobile ? '11px' : '12px',
                    fontWeight: 800,
                    color: colors.text3,
                    textTransform: 'uppercase',
                  }}
                >
                  {t('products.quantity')}
                </label>
                <div
                  style={{
                    fontSize: isMobile ? '11px' : '12px',
                    color: colors.text3,
                    textAlign: 'right',
                  }}
                >
                  Current: 
                  <span
                    style={{
                      fontWeight: 700,
                      color: colors.text1,
                    }}
                  >
                    {currentStock}
                  </span>
                  →
                  <span
                    style={{
                      fontWeight: 800,
                      color: isLowStockAfter
                        ? colors.accent.red
                        : colors.accent.green,
                      marginLeft: spacing.xs,
                    }}
                  >
                    {projectedStock}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: isMobile ? spacing.sm : spacing.md,
                  background: colors.surface,
                  borderRadius: radius.lg,
                  padding: isMobile ? spacing.sm : spacing.md,
                }}
              >
                <button
                  type="button"
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  style={{
                    width: isMobile ? 44 : 48,
                    height: isMobile ? 44 : 48,
                    borderRadius: '999px',
                    background: colors.card,
                    border: `1px solid ${colors.border}`,
                    color: colors.text1,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: touchTargets.min,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.border;
                    e.currentTarget.style.borderColor = colors.borderHi;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = colors.card;
                    e.currentTarget.style.borderColor = colors.border;
                  }}
                >
                  <Minus size={isMobile ? 18 : 20} />
                </button>

                <input
                  type="number"
                  required
                  min="1"
                  style={{
                    width: isMobile ? '100px' : '120px',
                    background: 'transparent',
                    border: 'none',
                    fontSize: isMobile ? '28px' : '36px',
                    fontWeight: 800,
                    color: colors.text1,
                    textAlign: 'center',
                    outline: 'none',
                    fontFamily: 'JetBrains Mono, monospace',
                    minHeight: touchTargets.min,
                  }}
                  className="mono"
                  value={qty}
                  onChange={e => setQty(Math.max(1, Number(e.target.value) || 1))}
                />

                <button
                  type="button"
                  onClick={() => setQty(qty + 1)}
                  style={{
                    width: isMobile ? 44 : 48,
                    height: isMobile ? 44 : 48,
                    borderRadius: '999px',
                    background: colors.card,
                    border: `1px solid ${colors.border}`,
                    color: colors.text1,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: touchTargets.min,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.border;
                    e.currentTarget.style.borderColor = colors.borderHi;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = colors.card;
                    e.currentTarget.style.borderColor = colors.border;
                  }}
                >
                  <Plus size={isMobile ? 18 : 20} />
                </button>
              </div>

              {isLowStockAfter && (
                <div
                  style={{
                    marginTop: spacing.xs,
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs,
                    padding: isMobile ? '8px 12px' : '8px 14px',
                    background: 'rgba(239,68,68,0.1)',
                    borderRadius: radius.md,
                    border: `1px solid ${colors.accent.red}30`,
                  }}
                >
                  <AlertTriangle size={isMobile ? 14 : 16} color={colors.accent.red} />
                  <span
                    style={{
                      fontSize: isMobile ? '12px' : '13px',
                      color: colors.accent.red,
                      fontWeight: 600,
                    }}
                  >
                    {t('products.willBeLowStock')}
                  </span>
                </div>
              )}
            </div>

            {/* Reason */}
            <div style={{ marginBottom: spacing.md }}>
              <label
                style={{
                  display: 'block',
                  fontSize: isMobile ? '11px' : '12px',
                  fontWeight: 800,
                  color: colors.text3,
                  marginBottom: spacing.xs,
                  textTransform: 'uppercase',
                }}
              >
                {t('products.reason')}
              </label>

              {/* Predefined reasons chips */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: spacing.xs,
                  marginBottom: spacing.sm,
                }}
              >
                {PREDEFINED_REASONS.map(key => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleReasonSelect(key)}
                    style={{
                      padding: isMobile ? '6px 12px' : '6px 14px',
                      borderRadius: '999px',
                      border: `1px solid ${
                        selectedReasonKey === key ? colors.accent.gold : colors.border
                      }`,
                      background:
                        selectedReasonKey === key
                          ? colors.accent.gold + '15'
                          : colors.surface,
                      color:
                        selectedReasonKey === key
                          ? colors.accent.gold
                          : colors.text2,
                      fontSize: isMobile ? '10px' : '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      minHeight: touchTargets.min,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedReasonKey !== key) {
                        e.currentTarget.style.background = colors.accent.gold + '08';
                        e.currentTarget.style.borderColor = colors.accent.gold + '40';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedReasonKey !== key) {
                        e.currentTarget.style.background = colors.surface;
                        e.currentTarget.style.borderColor = colors.border;
                      }
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
                  width: '100%',
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.md,
                  padding: isMobile ? '12px 14px' : '14px 16px',
                  color: colors.text1,
                  fontSize: isMobile ? '13px' : '14px',
                  outline: 'none',
                  minHeight: isMobile ? '80px' : '92px',
                  resize: 'vertical',
                  minHeight: touchTargets.min,
                  transition: 'border-color 0.15s',
                }}
                value={reason}
                onChange={e => {
                  setReason(e.target.value);
                  setSelectedReasonKey('');
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = colors.accent.blue;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                }}
              />
            </div>

            {/* Actions */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: spacing.sm,
              }}
            >
              <button
                type="button"
                onClick={handleClose}
                style={{
                  padding: isMobile ? '14px' : '15px',
                  borderRadius: radius.md,
                  background: 'transparent',
                  border: `1px solid ${colors.border}`,
                  color: colors.text2,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: isMobile ? '13px' : buttonFontSize,
                  minHeight: touchTargets.min,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.surface;
                  e.currentTarget.style.borderColor = colors.borderHi;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = colors.border;
                }}
              >
                {t('common.cancel')}
              </button>

              <button
                type="submit"
                disabled={!isValid || isSubmitting}
                style={{
                  padding: isMobile ? '14px' : '15px',
                  borderRadius: radius.md,
                  background: colors.accent.gold,
                  border: 'none',
                  color: colors.bg,
                  fontWeight: 900,
                  cursor: (!isValid || isSubmitting) ? 'not-allowed' : 'pointer',
                  fontSize: isMobile ? '13px' : buttonFontSize,
                  opacity: (!isValid || isSubmitting) ? 0.5 : 1,
                  minHeight: touchTargets.min,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (isValid && !isSubmitting) {
                    e.currentTarget.style.filter = 'brightness(1.1)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (isValid && !isSubmitting) {
                    e.currentTarget.style.filter = 'brightness(1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                {isSubmitting
                  ? t('products.processing')
                  : t('products.validateMovement')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: isMobile ? 'rgba(0,0,0,0.98)' : 'rgba(0,0,0,0.9)',
            zIndex: 2200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.md,
          }}
        >
          <div
            style={{
              background: colors.card,
              borderRadius: isMobile ? radius.xl : radius.xl,
              padding: isMobile ? spacing.md : '32px',
              maxWidth: isMobile ? '95vw' : '420px',
              width: '90%',
              border: isMobile ? 'none' : `1px solid ${colors.borderHi}`,
            }}
          >
            <h4
              style={{
                margin: '0 0 12px',
                fontSize: isMobile ? '17px' : '18px',
                fontWeight: 800,
              }}
            >
              {t('products.confirmAdjustment')}
            </h4>
            <p
              style={{
                color: colors.text2,
                marginBottom: spacing.md,
                lineHeight: 1.5,
                fontSize: isMobile ? '13px' : '14px',
              }}
            >
              {t('products.confirmText', {
                action:
                  type === 'addition'
                    ? t('products.add')
                    : t('products.remove'),
                qty,
                name: product.name,
                before: currentStock,
                after: projectedStock,
              })}
            </p>
            <div
              style={{
                display: 'flex',
                gap: spacing.sm,
              }}
            >
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  padding: isMobile ? '12px' : '14px',
                  borderRadius: radius.md,
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  color: colors.text1,
                  fontWeight: 700,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  minHeight: touchTargets.min,
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={executeAdjustment}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  padding: isMobile ? '12px' : '14px',
                  borderRadius: radius.md,
                  background: colors.accent.gold,
                  border: 'none',
                  color: colors.bg,
                  fontWeight: 800,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  minHeight: touchTargets.min,
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? '...' : t('products.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styles */}
      <style>{`
        .mono { font-family: 'JetBrains Mono', monospace; }
        
        /* Mobile bottom sheet animation */
        @-webkit-keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide {
          animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        
        /* Confirmation dialog animation */
        @-webkit-keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        div[style*="background: rgba(0,0,0,0.9"] > div {
          animation: fadeIn 0.2s ease-out;
        }
        
        /* Touch feedback */
        @media (pointer: coarse) {
          button:active:not(:disabled) {
            transform: scale(0.98) !important;
          }
        }
      `}</style>
    </>
  );
};

export default StockAdjustmentModal;
