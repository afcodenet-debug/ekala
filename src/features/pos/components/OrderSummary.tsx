import React from 'react';
import { Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, Receipt, X, Package } from 'lucide-react';
import { usePOSStore } from '../../../stores/usePOSStore';
import { useProductStore } from '../../products/hooks/useProductStore';
// import { useAuthStore } from '../../../stores/useAuthStore';
import { useI18n } from '../../../lib/i18n';
import { useSettingsStore } from '../../../stores/useSettingsStore';
import { formatPrice } from '../../../lib/i18n/currency';
import { EnterpriseTokens } from '../../../lib/design-system';

interface OrderSummaryProps {
  onCheckout: (paymentMethod: string) => void;
  onSaveOrder: () => void;
}

const { colors, radius, typography } = EnterpriseTokens;

const PAYMENT_METHODS = [
  { id: 'cash',         labelKey: 'pos.paymentMethods.cash',         subKey: 'pos.paymentMethods.cashSub',   Icon: Banknote, color: colors.accent.green },
  { id: 'card',         labelKey: 'pos.paymentMethods.card',         subKey: 'pos.paymentMethods.cardSub',   Icon: CreditCard, color: colors.accent.blue },
  { id: 'mobile_money', labelKey: 'pos.paymentMethods.mobileMoney', subKey: 'pos.paymentMethods.mobileSub', Icon: Smartphone, color: colors.accent.purple },
];

export const OrderSummary: React.FC<OrderSummaryProps> = ({
  onCheckout,
  onSaveOrder,
}) => {
  const { t } = useI18n();
  const lang = useSettingsStore(s => s.language);
  const { currency } = useSettingsStore();
  const { products } = useProductStore();
  const {
    selectedTableId,
    cart,
    currentOrder,
    isProcessing,
    updateQuantity,
    removeFromCart,
    clearCart,
  } = usePOSStore();

  const [selectedPaymentMethod, setSelectedPaymentMethod] = React.useState<string>('');
  const [showPayment, setShowPayment] = React.useState(false);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax      = subtotal * 0.08;
  const discount = 0;
  const total    = subtotal + tax - discount;

  const handleQuantityChange = (productId: number, delta: number) => {
    const item = cart.find(i => i.productId === productId);
    if (item) updateQuantity(productId, item.quantity + delta);
  };

  const handleCheckout = () => {
    if (!selectedPaymentMethod) return;
    onCheckout(selectedPaymentMethod);
    setShowPayment(false);
  };

  const canSaveOrder = selectedTableId && cart.length > 0 && !isProcessing;
  const canCheckout  = currentOrder && cart.length > 0 && !isProcessing;

  const fmtUnit = (price: number) => formatPrice(price, currency, lang);
  const fmtLine = (price: number, qty: number) => formatPrice(price * qty, currency, lang);

  const tableTitle = selectedTableId
    ? `${t('pos.tableLabel')} ${selectedTableId}`
    : cart.length > 0
      ? t('pos.draftOrder') || 'Brouillon'
      : t('pos.awaitingTable');

  const orderSubtitle = currentOrder
    ? `${t('pos.orderLabel')} ${currentOrder.id}`
    : cart.length > 0
      ? (selectedTableId
        ? (t('pos.readyToOpen') || 'Prêt à ouvrir le ticket')
        : (t('pos.selectTableToOpen') || 'Sélectionnez une table pour ouvrir le ticket'))
      : t('pos.newTransaction');

  return (
    <div style={{
      width: '360px',
      minWidth: '360px',
      height: '100%',
      background: colors.surface,
      borderLeft: `1px solid ${colors.border}`,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: typography.sans,
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* ── Header / Receipt Top ── */}
      <div style={{
        padding: '24px 20px',
        borderBottom: `1px solid ${colors.border}`,
        background: 'rgba(255,255,255,0.01)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors.accent.gold, boxShadow: `0 0 8px ${colors.accent.gold}` }} />
               <span style={{ fontSize: '13px', fontWeight: 800, color: colors.text1, letterSpacing: '0.05em' }}>
                 {t('pos.activeOrder')}
               </span>
            </div>
            {cart.length > 0 && (
              <button onClick={clearCart} style={{ background: colors.accent.redDim, border: `1px solid ${colors.accent.red}33`, borderRadius: '6px', color: colors.accent.red, cursor: 'pointer', padding: '4px 8px', fontSize: '10px', fontWeight: 800 }}>
                 {t('pos.clearCart')}
              </button>
            )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <h2 className="mono" style={{ fontSize: '24px', fontWeight: 700, color: colors.text1, margin: '4px 0 0' }}>
              {tableTitle}
            </h2>
            <div style={{ fontSize: '11px', color: colors.text3, fontWeight: 700, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Receipt size={10} />
              {orderSubtitle}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: colors.text3, fontWeight: 800 }}>{t('pos.items')}</div>
            <div className="mono" style={{ fontSize: '18px', fontWeight: 700, color: colors.text2 }}>{cart.length}</div>
          </div>
        </div>
      </div>

      {/* ── Item List (Receipt Body) ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', scrollbarWidth: 'none' }} className="custom-scroll">
        {cart.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: colors.text3 }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
               <Receipt size={28} opacity={0.2} />
            </div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: colors.text2 }}>{t('pos.emptyCart')}</p>
              <p style={{ fontSize: '11px', maxWidth: '180px', margin: '8px auto' }}>{t('pos.selectTablePrompt')}</p>
           </div>
        ) : !selectedTableId ? (
          // Professional "Draft with no table yet" state
          <div style={{ padding: '16px 14px' }}>
            <div style={{ 
              background: colors.accent.goldDim, 
              border: `1px solid ${colors.accent.gold}33`, 
              borderRadius: radius.md, 
              padding: '14px 16px',
              marginBottom: '12px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: colors.accent.gold, marginBottom: '4px' }}>
                {t('pos.draftReady') || 'Brouillon prêt'}
              </div>
              <div style={{ fontSize: '11px', color: colors.text2, lineHeight: 1.4 }}>
                {t('pos.draftSelectTablePrompt') || 'Sélectionnez une table dans le plan de salle pour ouvrir le ticket et envoyer en cuisine.'}
              </div>
            </div>
            {/* Still show the items so user sees what they added */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {cart.map((item, idx) => {
               const prod = products.find(p => p.id === item.productId);
               return (
                   <div key={`draft-${item.productId}-${idx}`} style={{
                     display: 'flex', alignItems: 'center', gap: '10px',
                     padding: '8px 10px', background: colors.card, borderRadius: radius.md, border: `1px solid ${colors.border}`
                   }}>
                     {/* Mini image */}
                     <div style={{ width: 36, height: 36, borderRadius: 6, overflow: 'hidden', background: colors.bg, flexShrink: 0, border: `1px solid ${colors.border}` }}>
                       {prod?.image_url ? (
                         <img src={prod.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                       ) : (
                         <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                           <Package size={16} color={colors.text3} />
                         </div>
                       )}
                     </div>

                     <div style={{ flex: 1, minWidth: 0 }}>
                       <div style={{ fontSize: '13px', fontWeight: 700, color: colors.text1 }}>{item.name}</div>
                       <div className="mono" style={{ fontSize: '11px', color: colors.text3 }}>{fmtUnit(item.price)}</div>
                     </div>
                     <div style={{ fontSize: '13px', fontWeight: 800, color: colors.accent.gold, minWidth: 28, textAlign: 'right' }}>{item.quantity}×</div>
                     <div style={{ fontSize: '13px', fontWeight: 700, color: colors.text1, minWidth: 60, textAlign: 'right' }}>
                       {fmtLine(item.price, item.quantity)}
                     </div>
                     <button
                       aria-label="Remove item"
                       onClick={() => removeFromCart(item.productId)}
                       style={{ background: 'none', border: 'none', color: colors.text3, cursor: 'pointer', padding: '2px' }}
                     >
                       <Trash2 size={13} />
                     </button>
                   </div>
                 );
               })}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
             {cart.map((item, idx) => {
               const prod = products.find(p => p.id === item.productId);
               return (
                 <div
                   key={`item-${item.productId}-${idx}`}
                   style={{
                     display: 'flex',
                     alignItems: 'center',
                     gap: '10px',
                     padding: '10px 12px',
                     background: colors.card,
                     borderRadius: radius.md,
                     border: `1px solid ${colors.border}`,
                     transition: 'all 0.15s',
                   }}
                 >
                   {/* Mini image */}
                   <div style={{ width: 40, height: 40, borderRadius: 6, overflow: 'hidden', background: colors.bg, flexShrink: 0, border: `1px solid ${colors.border}` }}>
                     {prod?.image_url ? (
                       <img src={prod.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                     ) : (
                       <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <Package size={18} color={colors.text3} />
                       </div>
                     )}
                   </div>

                   <div style={{ flex: 1, minWidth: 0 }}>
                     <div style={{ fontSize: '13px', fontWeight: 700, color: colors.text1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '2px' }}>
                       {item.name}
                     </div>
                     <div className="mono" style={{ fontSize: '11px', color: colors.text3 }}>
                       {fmtUnit(item.price)} {t('pos.perUnit')}
                     </div>
                   </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: colors.surface, borderRadius: '8px', padding: '4px', border: `1px solid ${colors.border}` }}>
                  <button
                    aria-label="Decrease quantity"
                    onClick={() => handleQuantityChange(item.productId, -1)}
                    style={{ width: '22px', height: '22px', borderRadius: '4px', background: 'transparent', border: 'none', color: colors.text3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Minus size={12} strokeWidth={3} />
                  </button>
                  <span className="mono" style={{ fontSize: '13px', fontWeight: 800, color: colors.accent.gold, minWidth: '20px', textAlign: 'center' }}>
                    {item.quantity}
                  </span>
                  <button
                    aria-label="Increase quantity"
                    onClick={() => handleQuantityChange(item.productId, 1)}
                    style={{ width: '22px', height: '22px', borderRadius: '4px', background: 'transparent', border: 'none', color: colors.text3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Plus size={12} strokeWidth={3} />
                  </button>
                </div>

                  <div style={{ textAlign: 'right', minWidth: '60px' }}>
                  <div className="mono" style={{ fontSize: '14px', fontWeight: 700, color: colors.text1 }}>
                    {fmtLine(item.price, item.quantity)}
                  </div>
                </div>

                <button
                  aria-label="Remove item"
                  onClick={() => removeFromCart(item.productId)}
                  style={{ background: 'none', border: 'none', color: colors.text3, cursor: 'pointer', padding: '2px' }}
                >
                  <Trash2 size={14} onMouseOver={e => e.currentTarget.style.color = colors.accent.red} onMouseOut={e => e.currentTarget.style.color = colors.text3} />
                </button>
               </div>
             );
               })}
           </div>
        )}
      </div>

      {/* ── Footer / Bill Summary ── */}
      <div style={{
        padding: '24px 20px',
        borderTop: `1px solid ${colors.border}`,
        background: 'rgba(0,0,0,0.2)',
      }}>
         {/* Lines */}
         <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: colors.text3, fontWeight: 700 }}>
              <span>{t('pos.subtotal')}</span>
              <span className="mono" style={{ color: colors.text2 }}>{fmtUnit(subtotal)}</span>
           </div>
           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: colors.text3, fontWeight: 700 }}>
              <span>{t('pos.taxLabel')}</span>
              <span className="mono" style={{ color: colors.text2 }}>{fmtUnit(tax)}</span>
           </div>
          
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            paddingTop: '16px', marginTop: '8px',
            borderTop: `1px dashed ${colors.border}`,
          }}>
            <span style={{ fontSize: '14px', fontWeight: 800, color: colors.text1, letterSpacing: '0.05em' }}>{t('pos.netTotal')}</span>
            <span className="mono" style={{ fontSize: '28px', fontWeight: 800, color: colors.accent.gold }}>
              {fmtUnit(total)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button
            onClick={onSaveOrder}
            disabled={!canSaveOrder}
            style={{
              padding: '14px',
              background: 'transparent',
              border: `1px solid ${canSaveOrder ? colors.borderHi : colors.border}`,
              borderRadius: radius.md,
              fontSize: '12px', fontWeight: 800,
              color: canSaveOrder ? colors.text2 : colors.text3,
              cursor: canSaveOrder ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              textTransform: 'uppercase'
            }}
          >
            {isProcessing ? t('pos.syncing') : currentOrder ? t('pos.updateTicket') : t('pos.openTicket')}
          </button>

          <button
            onClick={() => setShowPayment(true)}
            disabled={!canCheckout}
            style={{
              padding: '14px',
              background: canCheckout ? colors.accent.gold : colors.card,
              border: 'none', borderRadius: radius.md,
              fontSize: '12px', fontWeight: 900,
              color: canCheckout ? colors.bg : colors.text3,
              cursor: canCheckout ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              textTransform: 'uppercase',
              boxShadow: canCheckout ? `0 4px 12px ${colors.accent.gold}33` : 'none'
            }}
          >
            {t('pos.checkout')}
          </button>
        </div>
      </div>

      {/* ── Payment Overlay (Enterprise Style) ── */}
      {showPayment && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'flex-end',
          zIndex: 100,
          backdropFilter: 'blur(8px)',
        }} className="animate-fade">
          <div style={{
            width: '100%',
            background: colors.card,
            borderTop: `1px solid ${colors.borderHi}`,
            borderRadius: '24px 24px 0 0',
            padding: '32px 24px',
            boxShadow: '0 -20px 40px rgba(0,0,0,0.5)'
          }} className="animate-slide">
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                 <h3 style={{ fontSize: '18px', fontWeight: 800, color: colors.text1, margin: 0 }}>{t('pos.payment')}</h3>
                 <p style={{ fontSize: '12px', color: colors.accent.gold, fontWeight: 700, margin: '2px 0 0' }}>
                   {t('pos.amountDue')} : {fmtUnit(total)}
                 </p>
              </div>
              <button
                aria-label="Close payment"
                onClick={() => setShowPayment(false)}
                style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '10px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.text3, cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Payment Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              {PAYMENT_METHODS.map(({ id, labelKey, subKey, Icon, color }) => {
                const isSelected = selectedPaymentMethod === id;
                return (
                  <button
                    key={id}
                    onClick={() => setSelectedPaymentMethod(id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '16px',
                      padding: '16px',
                      background: isSelected ? `${color}11` : colors.surface,
                      border: `1px solid ${isSelected ? color : colors.border}`,
                      borderRadius: radius.lg,
                      cursor: 'pointer', transition: 'all 0.2s',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '12px',
                      background: isSelected ? `${color}22` : 'rgba(255,255,255,0.03)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isSelected ? color : colors.text3
                    }}>
                      <Icon size={20} strokeWidth={2.5} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 900, color: isSelected ? color : colors.text1, letterSpacing: '0.05em' }}>
                        {t(labelKey)}
                      </div>
                      <div style={{ fontSize: '10px', color: colors.text3, fontWeight: 700, marginTop: '2px' }}>{t(subKey)}</div>
                    </div>
                    {isSelected && (
                       <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <X size={12} color={colors.bg} strokeWidth={4} style={{ transform: 'rotate(45deg)' }} />
                       </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Confirm Payment */}
            <button
              onClick={handleCheckout}
              disabled={!selectedPaymentMethod || isProcessing}
              style={{
                width: '100%', padding: '16px',
                background: selectedPaymentMethod ? colors.accent.gold : colors.surface,
                border: 'none', borderRadius: radius.lg,
                fontSize: '14px', fontWeight: 900,
                color: selectedPaymentMethod ? colors.bg : colors.text3,
                cursor: (selectedPaymentMethod && !isProcessing) ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                letterSpacing: '0.05em',
                boxShadow: selectedPaymentMethod ? `0 8px 24px ${colors.accent.gold}44` : 'none'
              }}
            >
              {isProcessing ? t('pos.processing') : t('pos.confirmPayment')}
            </button>
          </div>
        </div>
      )}
      
      <style>{`
        .custom-scroll::-webkit-scrollbar { width: 0px; }
      `}</style>
    </div>
  );
};
