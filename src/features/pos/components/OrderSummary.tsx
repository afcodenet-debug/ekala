import React, { useEffect, useRef, useCallback } from 'react';
import {
  Plus, Minus, Trash2, CreditCard, Banknote,
  Smartphone, Receipt, X, Package, ChevronUp, ShoppingBag
} from 'lucide-react';
import { usePOSStore } from '../../../stores/usePOSStore';
import { useProductStore } from '../../products/hooks/useProductStore';
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
  { id: 'cash',         labelKey: 'pos.paymentMethods.cash',        subKey: 'pos.paymentMethods.cashSub',   Icon: Banknote,   color: colors.accent.green  },
  { id: 'card',         labelKey: 'pos.paymentMethods.card',        subKey: 'pos.paymentMethods.cardSub',   Icon: CreditCard, color: colors.accent.blue   },
  { id: 'mobile_money', labelKey: 'pos.paymentMethods.mobileMoney', subKey: 'pos.paymentMethods.mobileSub', Icon: Smartphone, color: colors.accent.purple },
];

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const OS_STYLES = `
  /* ════════════════════════════════════════════════════════════
     DESKTOP  — right-column panel (default)
  ════════════════════════════════════════════════════════════ */
  .os-root {
    width: 100%;
    height: 100%;
    background: ${colors.surface};
    border-left: 1px solid ${colors.border};
    display: flex;
    flex-direction: column;
    font-family: ${typography.sans};
    position: relative;
    overflow: hidden;
  }

  /* header */
  .os-header {
    padding: 20px 18px 14px;
    border-bottom: 1px solid ${colors.border};
    background: rgba(255,255,255,0.01);
    flex-shrink: 0;
  }
  .os-header-row   { display:flex; align-items:center; justify-content:space-between; margin-bottom:4px; }
  .os-header-title { display:flex; align-items:center; gap:8px; }
  .os-clear-btn {
    background: ${colors.accent.redDim};
    border: 1px solid ${colors.accent.red}33;
    border-radius: 6px; color: ${colors.accent.red};
    cursor: pointer; padding: 4px 8px;
    font-size: 10px; font-weight: 800; white-space: nowrap;
  }
  .os-table-row { display:flex; align-items:flex-end; justify-content:space-between; gap:8px; }

  /* body */
  .os-body {
    flex: 1; overflow-y: auto; padding: 10px;
    scrollbar-width: none; -webkit-overflow-scrolling: touch;
  }
  .os-body::-webkit-scrollbar { display:none; }

  /* item row */
  .os-item {
    display:flex; align-items:center; gap:10px;
    padding:10px 12px;
    background:${colors.card}; border-radius:${radius.md};
    border:1px solid ${colors.border}; transition:all 0.15s;
    margin-bottom: 4px;
  }
  .os-item-img   { border-radius:6px; overflow:hidden; background:${colors.bg}; flex-shrink:0; border:1px solid ${colors.border}; }
  .os-item-info  { flex:1; min-width:0; }
  .os-item-name  { font-size:13px; font-weight:700; color:${colors.text1}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:2px; }
  .os-item-unit  { font-size:11px; color:${colors.text3}; }
  .os-qty-ctrl   { display:flex; align-items:center; gap:6px; background:${colors.surface}; border-radius:8px; padding:4px; border:1px solid ${colors.border}; flex-shrink:0; }
  .os-qty-btn    { width:24px; height:24px; border-radius:4px; background:transparent; border:none; color:${colors.text3}; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 140ms; }
  .os-qty-btn:hover { background:rgba(255,255,255,0.07); color:${colors.text1}; }
  .os-item-total { text-align:right; min-width:56px; flex-shrink:0; }
  .os-trash-btn  { background:none; border:none; color:${colors.text3}; cursor:pointer; padding:4px; flex-shrink:0; display:flex; align-items:center; justify-content:center; transition:color 140ms; }
  .os-trash-btn:hover { color:${colors.accent.red}; }

  /* footer */
  .os-footer {
    padding:18px 16px; border-top:1px solid ${colors.border};
    background:rgba(0,0,0,0.2); flex-shrink:0;
  }
  .os-bill-lines  { display:flex; flex-direction:column; gap:8px; margin-bottom:20px; }
  .os-bill-line   { display:flex; justify-content:space-between; font-size:12px; color:${colors.text3}; font-weight:700; }
  .os-bill-total  { display:flex; justify-content:space-between; align-items:center; padding-top:14px; margin-top:8px; border-top:1px dashed ${colors.border}; }
  .os-action-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .os-save-btn    { padding:14px; background:transparent; border-radius:${radius.md}; font-size:12px; font-weight:800; transition:all 0.2s; text-transform:uppercase; cursor:pointer; font-family:inherit; }
  .os-checkout-btn{ padding:14px; border:none; border-radius:${radius.md}; font-size:12px; font-weight:900; transition:all 0.2s; text-transform:uppercase; cursor:pointer; font-family:inherit; }

  /* payment overlay */
  .os-overlay     { position:absolute; inset:0; background:rgba(0,0,0,0.85); display:flex; align-items:flex-end; z-index:100; backdrop-filter:blur(8px); }
  .os-pay-sheet   { width:100%; background:${colors.card}; border-top:1px solid ${colors.border}; border-radius:24px 24px 0 0; padding:28px 20px 24px; box-shadow:0 -20px 40px rgba(0,0,0,0.5); max-height:92vh; overflow-y:auto; -webkit-overflow-scrolling:touch; }
  .os-pay-header  { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
  .os-pay-methods { display:flex; flex-direction:column; gap:8px; margin-bottom:20px; }
  .os-pay-btn     { display:flex; align-items:center; gap:16px; padding:14px 16px; border-radius:${radius.lg}; cursor:pointer; transition:all 0.2s; text-align:left; font-family:inherit; min-height:52px; }
  .os-pay-icon    { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .os-pay-confirm { width:100%; padding:16px; border:none; border-radius:${radius.lg}; font-size:14px; font-weight:900; transition:all 0.2s; letter-spacing:0.05em; cursor:pointer; font-family:inherit; min-height:52px; }

  /* empty / draft states */
  .os-empty  { text-align:center; padding:48px 20px; color:${colors.text3}; }
  .os-draft-banner { background:${colors.accent.goldDim}; border:1px solid ${colors.accent.gold}33; border-radius:${radius.md}; padding:14px 16px; margin-bottom:12px; }

  /* ════════════════════════════════════════════════════════════
     MOBILE  ≤ 768px — Bottom Sheet
     The sheet renders as position:fixed at the bottom of the
     viewport. It has two states driven by data-open attribute:
       collapsed  → only the handle bar is visible (~72 px)
       expanded   → sheet rises to ~88dvh
  ════════════════════════════════════════════════════════════ */
  @media (max-width: 768px) {

    /* ── Wrapper that provides fixed positioning ── */
    .os-mobile-wrap {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      z-index: 200;
      display: flex;
      flex-direction: column;
      /* Animate the height transition */
      transition: height 320ms cubic-bezier(0.4, 0, 0.2, 1);
      border-radius: 20px 20px 0 0;
      overflow: hidden;
      box-shadow: 0 -8px 40px rgba(0,0,0,0.55);
      /* Default: collapsed */
      height: 72px;
    }
    .os-mobile-wrap[data-open="true"] {
      height: 88dvh;
    }

    /* Dim background when open */
    .os-mobile-backdrop {
      display: none;
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.55);
      z-index: 199;
      backdrop-filter: blur(2px);
    }
    .os-mobile-backdrop[data-open="true"] { display: block; }

    /* ── Handle / collapsed pill ── */
    .os-handle {
      flex-shrink: 0;
      height: 72px;
      background: ${colors.card};
      border-top: 1px solid ${colors.border};
      border-radius: 20px 20px 0 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 18px;
      cursor: pointer;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      position: relative;
    }
    .os-handle::before {
      content: '';
      position: absolute;
      top: 10px; left: 50%;
      transform: translateX(-50%);
      width: 36px; height: 4px;
      background: ${colors.border};
      border-radius: 2px;
    }
    .os-handle-left  { display:flex; align-items:center; gap:12px; }
    .os-handle-icon  {
      width:40px; height:40px; border-radius:12px;
      background:${colors.accent.goldDim};
      border:1px solid ${colors.accent.gold}33;
      display:flex; align-items:center; justify-content:center;
      color:${colors.accent.gold}; flex-shrink:0;
    }
    .os-handle-badge {
      position:absolute;
      top:14px; /* above the drag bar */
      right: 60px;
      min-width:20px; height:20px;
      background:${colors.accent.gold};
      color:${colors.bg};
      border-radius:10px;
      font-size:11px; font-weight:900;
      display:flex; align-items:center; justify-content:center;
      padding:0 5px;
      box-shadow: 0 2px 8px ${colors.accent.gold}66;
      line-height:1;
    }
    .os-handle-total {
      display:flex; align-items:baseline; gap:4px;
    }
    .os-handle-chevron {
      width:32px; height:32px; border-radius:8px;
      background:rgba(255,255,255,0.05);
      display:flex; align-items:center; justify-content:center;
      color:${colors.text3};
      transition: transform 320ms cubic-bezier(0.4,0,0.2,1);
      flex-shrink:0;
    }
    .os-mobile-wrap[data-open="true"] .os-handle-chevron { transform: rotate(180deg); }

    /* ── The panel itself, shown below the handle when open ── */
    .os-root {
      flex: 1;
      min-height: 0;
      border-left: none;
      border-top: 1px solid ${colors.border};
      width: 100%;
      border-radius: 0;
      /* Hide when collapsed so it doesn't show behind handle */
      display: flex;
    }

    /* Reduce padding in mobile */
    .os-header      { padding: 12px 14px 10px; }
    .os-footer      { padding: 12px 14px; }
    .os-bill-lines  { gap:6px; margin-bottom:14px; }
    .os-bill-total  { padding-top:10px; margin-top:6px; }
    .os-item        { padding:8px 10px; }
    .os-item-img    { border-radius:5px; }
    .os-save-btn    { padding:11px 8px; font-size:11px; }
    .os-checkout-btn{ padding:11px 8px; font-size:11px; }
    .os-action-grid { gap:8px; }
  }

  /* ── ≤ 480 px tweaks ── */
  @media (max-width: 480px) {
    .os-mobile-wrap[data-open="true"] { height: 92dvh; }
    .os-handle      { height: 68px; padding: 0 14px; }
    .os-handle-icon { width:36px; height:36px; border-radius:10px; }
    .os-footer      { padding:10px 12px 12px; }
    .os-save-btn    { padding:10px 6px; font-size:10.5px; }
    .os-checkout-btn{ padding:10px 6px; font-size:10.5px; }
  }

  /* Touch targets */
  @media (pointer: coarse) {
    .os-qty-btn      { width:28px !important; height:28px !important; }
    .os-trash-btn    { min-width:28px; min-height:28px; }
    .os-pay-btn      { min-height:56px; }
    .os-pay-confirm  { min-height:56px; }
    .os-save-btn     { min-height:48px; }
    .os-checkout-btn { min-height:48px; }
  }

  .custom-scroll::-webkit-scrollbar { width:0; }

  @keyframes os-fade-in { from{opacity:0} to{opacity:1} }
  .os-overlay { animation: os-fade-in 180ms ease; }
`;

/* ─── Helper: detect mobile ──────────────────────────────────────────────── */
const useIsMobile = () => {
  const [mobile, setMobile] = React.useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return mobile;
};

/* ─── Main component ─────────────────────────────────────────────────────── */
export const OrderSummary: React.FC<OrderSummaryProps> = ({ onCheckout, onSaveOrder }) => {
  const { t } = useI18n();
  const lang = useSettingsStore(s => s.language);
  const { currency } = useSettingsStore();
  const { products } = useProductStore();
  const {
    selectedTableId, cart, currentOrder,
    isProcessing, updateQuantity, removeFromCart, clearCart,
  } = usePOSStore();

  const [selectedPaymentMethod, setSelectedPaymentMethod] = React.useState<string>('');
  const [showPayment, setShowPayment]                     = React.useState(false);
  const [sheetOpen, setSheetOpen]                         = React.useState(false);
  const isMobile = useIsMobile();

  /* Inject styles once */
  useEffect(() => {
    const id = 'os-styles';
    if (!document.getElementById(id)) {
      const s = document.createElement('style'); s.id = id; s.textContent = OS_STYLES;
      document.head.appendChild(s);
    }
  }, []);

  /* Auto-open sheet when items are added on mobile */
  const prevCartLen = useRef(cart.length);
  useEffect(() => {
    if (isMobile && cart.length > prevCartLen.current && cart.length === 1) {
      setSheetOpen(true);
    }
    prevCartLen.current = cart.length;
  }, [cart.length, isMobile]);

  /* Close sheet if cart is emptied */
  useEffect(() => {
    if (isMobile && cart.length === 0) setSheetOpen(false);
  }, [cart.length, isMobile]);

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax      = subtotal * 0.08;
  const total    = subtotal + tax;

  const handleQuantityChange = (productId: number, delta: number) => {
    const item = cart.find(i => i.productId === productId);
    if (item) updateQuantity(productId, item.quantity + delta);
  };
  const handleCheckout = () => {
    if (!selectedPaymentMethod) return;
    onCheckout(selectedPaymentMethod);
    setShowPayment(false);
    if (isMobile) setSheetOpen(false);
  };

  const canSaveOrder = selectedTableId && cart.length > 0 && !isProcessing;
  const canCheckout  = currentOrder && cart.length > 0 && !isProcessing;
  const fmtUnit      = (p: number) => formatPrice(p, currency, lang);
  const fmtLine      = (p: number, q: number) => formatPrice(p * q, currency, lang);
  const totalItems   = cart.reduce((s, i) => s + i.quantity, 0);

  const tableTitle = selectedTableId
    ? `${t('pos.tableLabel')} ${selectedTableId}`
    : cart.length > 0 ? (t('pos.draftOrder') || 'Brouillon') : t('pos.awaitingTable');

  const orderSubtitle = currentOrder
    ? `${t('pos.orderLabel')} ${currentOrder.id}`
    : cart.length > 0
      ? selectedTableId ? (t('pos.readyToOpen') || 'Prêt à ouvrir') : (t('pos.selectTableToOpen') || 'Choisir une table')
      : t('pos.newTransaction');

  /* ── Shared mini image ── */
  const ItemImage = ({ item, size = 40 }: { item: any; size?: number }) => {
    const prod = products.find(p => p.id === item.productId);
    return (
      <div className="os-item-img" style={{ width: size, height: size }}>
        {prod?.image_url
          ? <img src={prod.image_url} alt={item.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}><Package size={size * 0.44} color={colors.text3} /></div>
        }
      </div>
    );
  };

  /* ── Cart content (shared between desktop & mobile) ── */
  const CartContent = () => (
    <>
      {/* Header */}
      <div className="os-header">
        <div className="os-header-row">
          <div className="os-header-title">
            <div style={{ width:8, height:8, borderRadius:'50%', background:colors.accent.gold, boxShadow:`0 0 8px ${colors.accent.gold}`, flexShrink:0 }} />
            <span style={{ fontSize:13, fontWeight:800, color:colors.text1, letterSpacing:'0.05em' }}>
              {t('pos.activeOrder')}
            </span>
          </div>
          {cart.length > 0 && (
            <button className="os-clear-btn" onClick={clearCart}>{t('pos.clearCart')}</button>
          )}
        </div>
        <div className="os-table-row">
          <div>
            <h2 className="mono" style={{ fontSize:22, fontWeight:700, color:colors.text1, margin:'4px 0 0' }}>{tableTitle}</h2>
            <div style={{ fontSize:11, color:colors.text3, fontWeight:700, marginTop:2, display:'flex', alignItems:'center', gap:4 }}>
              <Receipt size={10} />{orderSubtitle}
            </div>
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontSize:10, color:colors.text3, fontWeight:800 }}>{t('pos.items')}</div>
            <div className="mono" style={{ fontSize:18, fontWeight:700, color:colors.text2 }}>{cart.length}</div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="os-body custom-scroll">
        {cart.length === 0 ? (
          <div className="os-empty">
            <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(255,255,255,0.02)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
              <Receipt size={26} opacity={0.2} />
            </div>
            <p style={{ fontSize:13, fontWeight:700, color:colors.text2 }}>{t('pos.emptyCart')}</p>
            <p style={{ fontSize:11, maxWidth:180, margin:'8px auto' }}>{t('pos.selectTablePrompt')}</p>
          </div>
        ) : !selectedTableId ? (
          <div style={{ padding:'14px 12px' }}>
            <div className="os-draft-banner">
              <div style={{ fontSize:12, fontWeight:800, color:colors.accent.gold, marginBottom:4 }}>{t('pos.draftReady') || 'Brouillon prêt'}</div>
              <div style={{ fontSize:11, color:colors.text2, lineHeight:1.4 }}>{t('pos.draftSelectTablePrompt') || 'Sélectionnez une table pour ouvrir le ticket.'}</div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {cart.map((item, idx) => (
                <div key={`draft-${item.productId}-${idx}`} className="os-item">
                  <ItemImage item={item} size={36} />
                  <div className="os-item-info">
                    <div className="os-item-name">{item.name}</div>
                    <div className="mono os-item-unit">{fmtUnit(item.price)}</div>
                  </div>
                  <div style={{ fontSize:13, fontWeight:800, color:colors.accent.gold, minWidth:26, textAlign:'right', flexShrink:0 }}>{item.quantity}×</div>
                  <div className="os-item-total"><div className="mono" style={{ fontSize:13, fontWeight:700, color:colors.text1 }}>{fmtLine(item.price, item.quantity)}</div></div>
                  <button className="os-trash-btn" aria-label="Remove" onClick={() => removeFromCart(item.productId)}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:4, padding:'2px 0' }}>
            {cart.map((item, idx) => (
              <div key={`item-${item.productId}-${idx}`} className="os-item">
                <ItemImage item={item} size={40} />
                <div className="os-item-info">
                  <div className="os-item-name">{item.name}</div>
                  <div className="mono os-item-unit">{fmtUnit(item.price)} {t('pos.perUnit')}</div>
                </div>
                <div className="os-qty-ctrl">
                  <button className="os-qty-btn" aria-label="Decrease" onClick={() => handleQuantityChange(item.productId, -1)}><Minus size={12} strokeWidth={3} /></button>
                  <span className="mono" style={{ fontSize:13, fontWeight:800, color:colors.accent.gold, minWidth:18, textAlign:'center' }}>{item.quantity}</span>
                  <button className="os-qty-btn" aria-label="Increase" onClick={() => handleQuantityChange(item.productId, 1)}><Plus size={12} strokeWidth={3} /></button>
                </div>
                <div className="os-item-total"><div className="mono" style={{ fontSize:14, fontWeight:700, color:colors.text1 }}>{fmtLine(item.price, item.quantity)}</div></div>
                <button className="os-trash-btn" aria-label="Remove" onClick={() => removeFromCart(item.productId)}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="os-footer">
        <div className="os-bill-lines">
          <div className="os-bill-line">
            <span>{t('pos.subtotal')}</span>
            <span className="mono" style={{ color:colors.text2 }}>{fmtUnit(subtotal)}</span>
          </div>
          <div className="os-bill-line">
            <span>{t('pos.taxLabel')}</span>
            <span className="mono" style={{ color:colors.text2 }}>{fmtUnit(tax)}</span>
          </div>
          <div className="os-bill-total">
            <span style={{ fontSize:14, fontWeight:800, color:colors.text1, letterSpacing:'0.05em' }}>{t('pos.netTotal')}</span>
            <span className="mono" style={{ fontSize:26, fontWeight:800, color:colors.accent.gold }}>{fmtUnit(total)}</span>
          </div>
        </div>
        <div className="os-action-grid">
          <button className="os-save-btn" onClick={onSaveOrder} disabled={!canSaveOrder}
            style={{ border:`1px solid ${canSaveOrder ? colors.borderHi : colors.border}`, color:canSaveOrder ? colors.text2 : colors.text3, cursor:canSaveOrder ? 'pointer' : 'not-allowed' }}>
            {isProcessing ? t('pos.syncing') : currentOrder ? t('pos.updateTicket') : t('pos.openTicket')}
          </button>
          <button className="os-checkout-btn" onClick={() => setShowPayment(true)} disabled={!canCheckout}
            style={{ background:canCheckout ? colors.accent.gold : colors.card, color:canCheckout ? colors.bg : colors.text3, cursor:canCheckout ? 'pointer' : 'not-allowed', boxShadow:canCheckout ? `0 4px 12px ${colors.accent.gold}33` : 'none' }}>
            {t('pos.checkout')}
          </button>
        </div>
      </div>

      {/* Payment overlay */}
      {showPayment && (
        <div className="os-overlay">
          <div className="os-pay-sheet">
            <div className="os-pay-header">
              <div>
                <h3 style={{ fontSize:18, fontWeight:800, color:colors.text1, margin:0 }}>{t('pos.payment')}</h3>
                <p style={{ fontSize:12, color:colors.accent.gold, fontWeight:700, margin:'2px 0 0' }}>{t('pos.amountDue')} : {fmtUnit(total)}</p>
              </div>
              <button aria-label="Close" onClick={() => setShowPayment(false)} style={{ background:colors.surface, border:`1px solid ${colors.border}`, borderRadius:10, width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', color:colors.text3, cursor:'pointer', flexShrink:0 }}>
                <X size={18} />
              </button>
            </div>
            <div className="os-pay-methods">
              {PAYMENT_METHODS.map(({ id, labelKey, subKey, Icon, color }) => {
                const isSel = selectedPaymentMethod === id;
                return (
                  <button key={id} className="os-pay-btn" onClick={() => setSelectedPaymentMethod(id)}
                    style={{ background:isSel ? `${color}11` : colors.surface, border:`1px solid ${isSel ? color : colors.border}` }}>
                    <div className="os-pay-icon" style={{ background:isSel ? `${color}22` : 'rgba(255,255,255,0.03)', color:isSel ? color : colors.text3 }}>
                      <Icon size={20} strokeWidth={2.5} />
                    </div>
                    <div style={{ flex:1, textAlign:'left' }}>
                      <div style={{ fontSize:13, fontWeight:900, color:isSel ? color : colors.text1, letterSpacing:'0.05em' }}>{t(labelKey)}</div>
                      <div style={{ fontSize:10, color:colors.text3, fontWeight:700, marginTop:2 }}>{t(subKey)}</div>
                    </div>
                    {isSel && <div style={{ width:20, height:20, borderRadius:'50%', background:color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><X size={12} color={colors.bg} strokeWidth={4} style={{ transform:'rotate(45deg)' }} /></div>}
                  </button>
                );
              })}
            </div>
            <button className="os-pay-confirm" onClick={handleCheckout} disabled={!selectedPaymentMethod || isProcessing}
              style={{ background:selectedPaymentMethod ? colors.accent.gold : colors.surface, color:selectedPaymentMethod ? colors.bg : colors.text3, cursor:(selectedPaymentMethod && !isProcessing) ? 'pointer' : 'not-allowed', boxShadow:selectedPaymentMethod ? `0 8px 24px ${colors.accent.gold}44` : 'none' }}>
              {isProcessing ? t('pos.processing') : t('pos.confirmPayment')}
            </button>
          </div>
        </div>
      )}
    </>
  );

  /* ══════════════════════════════════════════════════════════════
     DESKTOP render — classic right column
  ══════════════════════════════════════════════════════════════ */
  if (!isMobile) {
    return (
      <div className="os-root">
        <CartContent />
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     MOBILE render — bottom sheet
  ══════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* Backdrop — closes sheet when tapped */}
      <div
        className="os-mobile-backdrop"
        data-open={sheetOpen ? 'true' : 'false'}
        onClick={() => setSheetOpen(false)}
      />

      {/* Bottom sheet */}
      <div className="os-mobile-wrap" data-open={sheetOpen ? 'true' : 'false'}>

        {/* ── Drag handle / collapsed state ── */}
        <div className="os-handle" onClick={() => setSheetOpen(o => !o)} role="button" aria-label={sheetOpen ? 'Fermer le panier' : 'Ouvrir le panier'}>
          <div className="os-handle-left">
            <div className="os-handle-icon">
              <ShoppingBag size={18} />
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:800, color:colors.text1, lineHeight:1.2 }}>
                {cart.length === 0 ? (t('pos.emptyCart') || 'Panier vide') : tableTitle}
              </div>
              <div style={{ fontSize:11, color:colors.text3, fontWeight:600, marginTop:2 }}>
                {cart.length === 0
                  ? (t('pos.tapToOpen') || 'Appuyez pour ouvrir')
                  : `${totalItems} article${totalItems > 1 ? 's' : ''} · ${fmtUnit(total)}`
                }
              </div>
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {/* Cart count badge */}
            {totalItems > 0 && (
              <div className="os-handle-badge" style={{ position:'static' }}>
                {totalItems}
              </div>
            )}
            <div className="os-handle-chevron">
              <ChevronUp size={16} />
            </div>
          </div>
        </div>

        {/* ── Panel content (only rendered / scrollable when open) ── */}
        <div className="os-root" style={{ opacity: sheetOpen ? 1 : 0, pointerEvents: sheetOpen ? 'auto' : 'none', transition: 'opacity 200ms ease' }}>
          <CartContent />
        </div>
      </div>
    </>
  );
};