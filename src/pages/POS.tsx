import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FloorTablesSidebar } from '../features/pos/components/FloorTablesSidebar';
import { ProductsGrid } from '../features/pos/components/ProductsGrid';
import { OrderSummary } from '../features/pos/components/OrderSummary';
import { usePOSStore } from '../stores/usePOSStore';
import { useTableStore } from '../stores/useTableStore';
import { useProductStore } from '../features/products/hooks/useProductStore';
import { StatusToast } from '../components/StatusToast';

type POSCheckoutResult = {
  success: boolean;
  receipt?: any;
  error?: string;
  partial?: boolean;
  blockedItems?: Array<{ name: string; quantity: number }>;
};
import { useI18n } from '../lib/i18n';
import { useSettingsStore } from '../stores/useSettingsStore';
import { printReceipt } from '../utils/receiptPrinter';
import { EnterpriseTokens } from '../lib/design-system';

const { colors, typography } = EnterpriseTokens;

/* ─── Responsive styles injected once ───────────────────────────────────── */
const POS_STYLES = `
  .pos-root {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100vh;
    overflow: hidden;
    font-family: ${typography.sans};
  }

  .pos-floor-bar { flex-shrink: 0; width: 100%; }

  .pos-workspace {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: row;
    overflow: hidden;
  }

  .pos-products {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  /* Desktop panel — fixed right column */
  .pos-order-panel {
    flex-shrink: 0;
    width: 360px;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }

  @media (max-width: 1024px) { .pos-order-panel { width: 320px; } }
  @media (max-width: 900px)  { .pos-order-panel { width: 290px; } }

  /* ── Mobile: products fill all space, bottom sheet is fixed ─── */
  @media (max-width: 768px) {
    .pos-root      { height: 100dvh; }
    .pos-workspace { flex-direction: column; overflow: hidden; }
    /* Products take ALL remaining height — bottom sheet overlays */
    .pos-products  { flex: 1 1 0; min-height: 0; overflow: hidden; }
    /* Panel is removed from normal flow on mobile — OrderSummary
       manages its own fixed bottom sheet positioning */
    .pos-order-panel {
      width: 0;
      height: 0;
      overflow: visible;
      flex-shrink: 0;
      position: static;
    }
  }

  @supports (height: 100dvh) { .pos-root { height: 100dvh; } }
`;

const POS: React.FC = () => {
  const { t, lang } = useI18n();
  const { currency } = useSettingsStore();
  const {
    selectedTableId, saveOrder, checkout, cart,
    error: posError, setError, selectTable, loadOrderForTable, clearCart,
  } = usePOSStore();

  const navigate = useNavigate();
  const { error: tableError } = useTableStore();
  const [partialWarning, setPartialWarning] = React.useState<string | null>(null);
  const [partialBlocks,  setPartialBlocks]  = React.useState<Array<{ name: string; quantity: number }>>([]);

  useEffect(() => {
    const id = 'pos-responsive-styles';
    if (!document.getElementById(id)) {
      const s = document.createElement('style'); s.id = id; s.textContent = POS_STYLES;
      document.head.appendChild(s);
    }
  }, []);

  const [searchParams] = useSearchParams();
  useEffect(() => {
    const tableIdParam = searchParams.get('tableId');
    const orderIdParam = searchParams.get('orderId');
    
    const tableId = tableIdParam ? Number(tableIdParam) : null;
    const orderId = orderIdParam ? Number(orderIdParam) : null;

    // Valider les paramètres
    const validTableId = tableId && !Number.isNaN(tableId) && tableId > 0;
    const validOrderId = orderId && !Number.isNaN(orderId) && orderId > 0;

    // 1. Sélectionner la table (toujours en premier)
    if (validTableId && selectedTableId !== tableId) {
      selectTable(tableId);
    }

    // 2. Charger la commande si orderId présent (peut avoir tableId ou non)
    if (validOrderId) {
      loadOrderForTable(validTableId ? tableId : null, orderId).catch(() => {});
    }
  }, [searchParams, selectTable, selectedTableId, loadOrderForTable]);

  const handleSaveOrder  = async () => { await saveOrder(); };

  const handleCheckout = async (paymentMethod: string) => {
    setPartialWarning(null); setPartialBlocks([]);
    const result = await checkout(paymentMethod) as POSCheckoutResult;
    if (result.success) {
      if (result.partial && Array.isArray(result.blockedItems) && result.blockedItems.length > 0) {
        setPartialBlocks(result.blockedItems.map((item: any) => ({ name: item.name, quantity: Number(item.quantity || 0) })));
        setPartialWarning(result.blockedItems.length === 1
          ? t('pos.partialCheckoutSubtitleSingle', { product: result.blockedItems[0].name })
          : t('pos.partialCheckoutSubtitleMultiple', { count: result.blockedItems.length }));
      }
      if (result.receipt) {
        const printResult = await printReceipt(result.receipt, currency, lang);
        if (!printResult.success) console.warn(t('pos.printFailed'), printResult.error);
      }
      const hadCashoutLink = searchParams.get('tableId') && searchParams.get('orderId');
      if (hadCashoutLink) { clearCart(); navigate('/orders'); }
    } else {
      setError(result.error || t('pos.invalidPayment'));
    }
  };

  const { products } = useProductStore();
  const clearErrors  = () => { setError(null); setPartialWarning(null); setPartialBlocks([]); useTableStore.setState({ error: null }); };

  const renderErrorToast = () => {
    const raw = String(posError || tableError || '').trim();
    if (!raw) return null;
    const normalize = (v: string) => {
      const trimmed = v.trim(); if (!trimmed) return '';
      try { const p = JSON.parse(trimmed); if (p?.error) return String(p.error); if (p?.message) return String(p.message); } catch {}
      const m = trimmed.match(/\{.*\}/s);
      if (m) { try { const p = JSON.parse(m[0]); if (p?.error) return String(p.error); if (p?.message) return String(p.message); } catch {} }
      return trimmed;
    };
    const message        = normalize(raw);
    const isStockIssue   = /insufficient stock/i.test(message);
    const itemMatch      = message.match(/Insufficient stock for\s+(.+)/i);
    const subject        = itemMatch?.[1]?.trim() ?? null;
    const trimmedSubject = subject?.toLowerCase() ?? '';
    const matchedItem    = cart.find(i => trimmedSubject && (i.name.toLowerCase().includes(trimmedSubject) || trimmedSubject.includes(i.name.toLowerCase())));
    const details        = cart.map(i => { const p = products.find(pr => pr.id === i.productId); return { label: i.name, value: `${i.quantity} dans le panier`, badge: p?.stock_quantity != null ? `${p.stock_quantity} restantes` : undefined, highlight: matchedItem?.productId === i.productId }; });
    return <StatusToast title={isStockIssue ? t('pos.stockIssueTitle') : t('pos.paymentErrorTitle')} subtitle={isStockIssue ? (subject ? t('pos.stockIssueSubtitleSingle', { product: subject }) : t('pos.stockIssueSubtitleMultiple')) : t('pos.paymentErrorSubtitle')} message={message} variant={isStockIssue ? 'warning' : 'error'} meta={t('pos.actionRequired')} details={details} footer={isStockIssue ? t('pos.stockIssueFooter') : t('pos.paymentErrorFooter')} onClose={clearErrors} />;
  };

  const renderPartialToast = () => {
    if (!partialWarning || partialBlocks.length === 0) return null;
    const details = partialBlocks.map(i => ({ label: i.name, value: `${i.quantity} remaining`, highlight: true }));
    const actionButton = <button type="button" onClick={clearErrors} style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: colors.text1, padding: '10px 14px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>{t('pos.partialCheckoutAction')}</button>;
    return <StatusToast title={t('pos.partialCheckoutTitle')} subtitle={partialWarning} message={t('pos.partialCheckoutMessage')} variant="warning" meta={t('pos.partialCheckoutMeta')} details={details} footer={t('pos.partialCheckoutFooter')} actions={actionButton} onClose={clearErrors} />;
  };

  return (
    <div className="pos-root animate-fade" style={{ background: colors.bg }}>
      <div className="pos-floor-bar">
        <FloorTablesSidebar onTableSelect={() => {}} selectedTableId={selectedTableId} layout="horizontal" />
      </div>
      <div className="pos-workspace">
        <div className="pos-products">
          <ProductsGrid onProductClick={() => {}} />
        </div>
        {/* On desktop: normal column. On mobile: zero-size anchor, sheet positions itself fixed */}
        <div className="pos-order-panel">
          <OrderSummary onCheckout={handleCheckout} onSaveOrder={handleSaveOrder} />
        </div>
      </div>
      {renderPartialToast()}
      {renderErrorToast()}
    </div>
  );
};

export default POS;