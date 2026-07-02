import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Search, Download, History, Eye, Printer, X,
  TrendingUp, CreditCard, DollarSign, Clock, Filter, ChevronDown, ChevronUp
} from 'lucide-react';
import { api } from '../../lib/api-client';
import { printReceipt, ReceiptData } from '../../utils/receiptPrinter';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useI18n } from '../../lib/i18n';
import { formatPrice } from '../../lib/i18n/currency';

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@300;400;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; }

  .sales-root {
    --bg:          #09090f;
    --surface:     #111118;
    --card:        #16161f;
    --card-hi:     #1c1c27;
    --border:      #1e1e2e;
    --border-hi:   #28283a;
    --text-1:      #eeeef5;
    --text-2:      #88889a;
    --text-3:      #44445a;
    --amber:       #f59e0b;
    --amber-dim:   rgba(245,158,11,0.08);
    --blue:        #3b82f6;
    --blue-dim:    rgba(59,130,246,0.08);
    --green:       #10b981;
    --green-dim:   rgba(16,185,129,0.08);
    --red:         #ef4444;
    --red-dim:     rgba(239,68,68,0.08);
    --purple:      #a78bfa;
    --purple-dim:  rgba(167,139,250,0.08);
    --gold:        #d4af37;
    --gold-dim:    rgba(212,175,55,0.08);
    font-family: 'DM Sans', sans-serif;
    color: var(--text-1);
    background: var(--bg);
    min-height: 100vh;
  }

  /* ── KPI Cards ── */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    margin-bottom: 28px;
  }
  @media (max-width: 900px) {
    .kpi-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  }
  @media (max-width: 480px) {
    .kpi-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 20px; }
  }

  .kpi-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 16px 18px;
    position: relative;
    overflow: hidden;
    transition: all 180ms ease;
  }
  .kpi-card:hover {
    border-color: var(--border-hi);
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(0,0,0,0.3);
  }
  @media (max-width: 480px) {
    .kpi-card { padding: 12px 14px; border-radius: 14px; }
    .kpi-card:hover { transform: none; }
    .kpi-value { font-size: 16px !important; }
    .kpi-label { font-size: 9px !important; }
  }

  /* ── Header ── */
  .page-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 28px;
    gap: 16px;
    flex-wrap: wrap;
  }
  @media (max-width: 640px) {
    .page-header { flex-direction: column; align-items: flex-start; margin-bottom: 20px; }
    .page-header-actions { width: 100%; }
    .page-header-actions button { width: 100%; justify-content: center; }
  }

  /* ── Controls Bar ── */
  .controls-bar {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    background: rgba(255,255,255,0.01);
  }
  @media (max-width: 768px) {
    .controls-bar { padding: 12px 16px; flex-direction: column; align-items: stretch; gap: 10px; }
  }

  .search-wrapper {
    position: relative;
    flex: 1;
    min-width: 220px;
  }
  @media (max-width: 768px) {
    .search-wrapper { min-width: unset; width: 100%; }
  }

  .date-row {
    display: flex;
    gap: 10px;
  }
  @media (max-width: 480px) {
    .date-row { flex-direction: column; gap: 8px; }
    .date-row .filter-input { width: 100% !important; }
  }

  .payment-filter-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }

  /* ── Filter Toggle (mobile) ── */
  .filter-toggle-btn {
    display: none;
    width: 100%;
    padding: 10px 16px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    color: var(--text-2);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-family: 'DM Sans', sans-serif;
    transition: all 150ms ease;
  }
  .filter-toggle-btn:hover { border-color: var(--border-hi); color: var(--text-1); }
  @media (max-width: 768px) { .filter-toggle-btn { display: flex; } }

  .filters-collapsible {
    display: contents;
  }
  @media (max-width: 768px) {
    .filters-collapsible { display: flex; flex-direction: column; gap: 10px; width: 100%; }
    .filters-collapsible.hidden { display: none; }
  }

  /* ── Table ── */
  .sales-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
  }
  .sales-table th {
    padding: 12px 16px;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-3);
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    text-align: left;
    white-space: nowrap;
  }
  .sales-table td {
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    transition: all 150ms ease;
    vertical-align: middle;
  }
  .sales-table tr:hover td { background: rgba(255,255,255,0.02); }

  /* Hide less-important columns on small screens */
  @media (max-width: 768px) {
    .col-staff { display: none; }
  }
  @media (max-width: 560px) {
    .col-datetime { display: none; }
  }

  /* ── Mobile card view (below 480px, replaces table rows) ── */
  .sale-cards-list { display: none; }
  @media (max-width: 480px) {
    .table-wrapper { display: none; }
    .sale-cards-list { display: flex; flex-direction: column; gap: 1px; }
  }

  .sale-card-item {
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: background 150ms ease;
  }
  .sale-card-item:hover { background: rgba(255,255,255,0.02); }
  .sale-card-item.highlighted { background: rgba(59,130,246,0.08); border-left: 3px solid var(--blue); }

  .sale-card-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  /* ── Misc ── */
  .mono { font-family: 'JetBrains Mono', monospace; }

  .filter-input {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 10px 14px 10px 38px;
    color: var(--text-1);
    font-size: 13px;
    transition: all 150ms ease;
    width: 100%;
    outline: none;
    font-family: 'DM Sans', sans-serif;
  }
  .filter-input:focus { border-color: var(--blue); background: var(--card); }

  .date-input {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 10px 14px;
    color: var(--text-1);
    font-size: 13px;
    transition: all 150ms ease;
    outline: none;
    font-family: 'DM Sans', sans-serif;
    width: 160px;
  }
  .date-input:focus { border-color: var(--blue); background: var(--card); }
  @media (max-width: 480px) { .date-input { width: 100%; } }

  .status-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    white-space: nowrap;
  }

  .btn-icon {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text-3);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 150ms ease;
    cursor: pointer;
    flex-shrink: 0;
  }
  .btn-icon:hover { border-color: var(--text-2); color: var(--text-1); transform: translateY(-1px); }
  @media (max-width: 480px) {
    .btn-icon { width: 36px; height: 36px; }
    .btn-icon:hover { transform: none; }
  }

  /* ── Pagination ── */
  .pagination-bar {
    padding: 16px 24px;
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(255,255,255,0.01);
    gap: 12px;
  }
  @media (max-width: 480px) {
    .pagination-bar { flex-direction: column; gap: 10px; padding: 14px 16px; }
    .pagination-btns { width: 100%; display: flex; gap: 8px; }
    .pagination-btns button { flex: 1; justify-content: center; }
  }

  .page-btn {
    padding: 7px 16px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    background: var(--surface);
    border: 1px solid var(--border);
    cursor: pointer;
    transition: all 150ms ease;
    font-family: 'DM Sans', sans-serif;
    letter-spacing: 0.05em;
  }
  .page-btn:not(:disabled):hover { background: var(--card-hi); border-color: var(--border-hi); }
  .page-btn:disabled { opacity: 0.4; cursor: default; }

  /* ── Table Container ── */
  .table-container {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 24px;
    overflow: hidden;
  }
  @media (max-width: 640px) { .table-container { border-radius: 18px; } }

  .custom-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
  .custom-scroll::-webkit-scrollbar-track { background: transparent; }
  .custom-scroll::-webkit-scrollbar-thumb { background: var(--border-hi); border-radius: 10px; }

  /* ── Inner page padding ── */
  .page-inner {
    max-width: 1400px;
    margin: 0 auto;
    padding: 36px 24px 60px;
  }
  @media (max-width: 768px) { .page-inner { padding: 24px 16px 48px; } }
  @media (max-width: 480px) { .page-inner { padding: 18px 12px 40px; } }

  /* ── Receipt Modal ── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.85);
    backdrop-filter: blur(8px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .modal-box {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 24px;
    width: 100%;
    max-width: 500px;
    overflow: hidden;
    box-shadow: 0 24px 64px rgba(0,0,0,0.5);
    max-height: 95vh;
    display: flex;
    flex-direction: column;
  }
  @media (max-width: 540px) {
    .modal-backdrop { padding: 0; align-items: flex-end; }
    .modal-box { border-radius: 24px 24px 0 0; max-height: 92vh; max-width: 100%; }
  }
  .modal-header {
    padding: 18px 22px;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }
  .modal-body {
    padding: 20px 22px;
    overflow-y: auto;
    flex: 1;
  }
  @media (max-width: 480px) {
    .modal-header { padding: 16px 18px; }
    .modal-body { padding: 16px 18px; }
  }

  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  .fade-up { animation: fadeUp 300ms ease both; }
`;

interface Sale {
  id: number;
  invoice_number: string;
  user_name: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
}

const SalesHistoryPage = () => {
  const { t, lang } = useI18n();
  const { currency } = useSettingsStore();

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const location = useLocation();
  const highlightSaleId = location.state?.highlightSaleId;
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const id = 'sales-styles';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id;
      s.textContent = STYLES;
      document.head.appendChild(s);
    }
  }, []);

  useEffect(() => {
    api.sales.getAll()
      .then((data: any) => setSales(Array.isArray(data) ? data : []))
      .catch((err: any) => { console.error('Failed to fetch sales:', err); setError(err.message); })
      .finally(() => setLoading(false));
  }, []);

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const matchesSearch = !searchTerm ||
        s.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.user_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const saleDate = new Date(s.created_at);
      const matchesDateRange = (!startDate || saleDate >= new Date(startDate)) &&
                              (!endDate || saleDate <= new Date(endDate + 'T23:59:59'));
      const matchesPaymentMethod = selectedPaymentMethods.length === 0 ||
                                  selectedPaymentMethods.includes(s.payment_method.toLowerCase());
      return matchesSearch && matchesDateRange && matchesPaymentMethod;
    });
  }, [sales, searchTerm, startDate, endDate, selectedPaymentMethods]);

  const stats = useMemo(() => {
    const total = filteredSales.reduce((acc, s) => acc + s.total_amount, 0);
    const count = filteredSales.length;
    const avg = count > 0 ? total / count : 0;
    const cash = filteredSales.filter(s => s.payment_method.toLowerCase() === 'cash').reduce((acc, s) => acc + s.total_amount, 0);
    const card = filteredSales.filter(s => s.payment_method.toLowerCase() === 'card').reduce((acc, s) => acc + s.total_amount, 0);
    return { total, count, avg, cash, card };
  }, [filteredSales]);

  const paymentMethods = useMemo(() => [...new Set(sales.map(s => s.payment_method.toLowerCase()))], [sales]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, startDate, endDate, selectedPaymentMethods]);

  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSales.slice(start, start + itemsPerPage);
  }, [filteredSales, currentPage]);

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);

  const handleViewReceipt = async (sale: Sale) => {
    setSelectedSale(sale);
    setReceiptData(null);
    setReceiptLoading(true);
    setShowReceiptModal(true);
    try {
      const receipt = await api.sales.getReceipt(sale.id);
      setReceiptData(receipt as ReceiptData);
    } catch (err) {
      console.error('Failed to load receipt:', err);
      setShowReceiptModal(false);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handlePrintReceipt = async (sale?: Sale) => {
    let data: ReceiptData | null = null;
    try {
      if (sale) data = await api.sales.getReceipt(sale.id) as ReceiptData;
      else data = receiptData;
      if (data) await printReceipt(data, currency, lang);
    } catch (err) {
      console.error('Print error:', err);
    }
  };

  const handleExportCSV = () => {
    if (filteredSales.length === 0) return;
    const csvHeaders = ['Invoice', 'Date', 'Staff', 'Method', 'Total'];
    const csvData = filteredSales.map(s => [s.invoice_number, new Date(s.created_at).toLocaleString(), s.user_name || 'N/A', s.payment_method, s.total_amount.toFixed(2)]);
    const content = [csvHeaders, ...csvData].map(row => row.map(f => `"${f}"`).join(',')).join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const togglePaymentMethod = (method: string) => {
    setSelectedPaymentMethods(prev => prev.includes(method) ? prev.filter(m => m !== method) : [...prev, method]);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setSelectedPaymentMethods([]);
  };

  const hasFilters = searchTerm || startDate || endDate || selectedPaymentMethods.length > 0;
  const locale = lang === 'fr' ? 'fr-FR' : lang === 'pt' ? 'pt-PT' : 'en-US';

  if (loading) return (
    <div className="sales-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <div className="sales-root">
      <div className="page-inner">

        {/* ── Header ── */}
        <div className="page-header">
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6, margin: '0 0 6px' }}>
              {t('sales.financialArchives')}
            </p>
            <h1 style={{ fontSize: 'clamp(22px, 5vw, 28px)', fontWeight: 300, color: 'var(--text-1)', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
              {t('sales.history')}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 10, color: 'var(--gold)', background: 'var(--gold-dim)', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(212,175,55,0.2)', fontWeight: 700 }}>
                {t('sales.auditLog')}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>•</span>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{filteredSales.length} {t('sales.transactionsRecorded')}</span>
            </div>
          </div>

          <div className="page-header-actions">
            <button
              onClick={handleExportCSV}
              style={{ padding: '10px 18px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'DM Sans, sans-serif', transition: 'all 150ms ease' }}
            >
              <Download size={14} /> {t('sales.exportCsv')}
            </button>
          </div>
        </div>

        {/* ── KPI Strip ── */}
        <div className="kpi-grid">
          {[
            { label: t('sales.totalRevenue'), value: formatPrice(stats.total, currency, lang), color: 'var(--gold)', icon: <TrendingUp size={14}/> },
            { label: t('sales.averageBasket'), value: formatPrice(stats.avg, currency, lang), color: 'var(--purple)', icon: <DollarSign size={14}/> },
            { label: t('sales.cash'), value: formatPrice(stats.cash, currency, lang), color: 'var(--green)', icon: <CreditCard size={14}/> },
            { label: t('sales.card'), value: formatPrice(stats.card, currency, lang), color: 'var(--amber)', icon: <CreditCard size={14}/> },
          ].map((k, i) => (
            <div key={i} className="kpi-card fade-up" style={{ animationDelay: `${i * 60}ms` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ color: k.color }}>{k.icon}</div>
                <span className="kpi-label" style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</span>
              </div>
              <div className="mono kpi-value" style={{ fontSize: 'clamp(14px, 3vw, 20px)', fontWeight: 300, color: 'var(--text-1)' }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* ── Table Container ── */}
        <div className="table-container">

          {/* Controls Bar */}
          <div className="controls-bar">

            {/* Search — always visible */}
            <div className="search-wrapper">
              <label htmlFor="search-input" style={{ display: 'none' }}>Search</label>
              <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
              <input
                id="search-input"
                className="filter-input"
                placeholder={t('sales.searchPlaceholder')}
                title="Search by invoice number or staff name"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Toggle button (mobile only) */}
            <button className="filter-toggle-btn" onClick={() => setFiltersOpen(v => !v)}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Filter size={14} />
                {hasFilters ? `Filtres actifs (${(startDate ? 1 : 0) + (endDate ? 1 : 0) + selectedPaymentMethods.length})` : 'Filtres'}
              </span>
              {filtersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {/* Collapsible filters */}
            <div className={`filters-collapsible${filtersOpen ? '' : ' hidden'}`}>
              <div className="date-row">
                <label htmlFor="start-date" style={{ display: 'none' }}>Start Date</label>
                <input
                  id="start-date"
                  type="date"
                  className="date-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  title="Filter by start date"
                />
                <label htmlFor="end-date" style={{ display: 'none' }}>End Date</label>
                <input
                  id="end-date"
                  type="date"
                  className="date-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  title="Filter by end date"
                />
              </div>

              <div className="payment-filter-row">
                {paymentMethods.map(m => (
                  <button
                    key={m}
                    onClick={() => togglePaymentMethod(m)}
                    style={{
                      padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
                      background: selectedPaymentMethods.includes(m) ? 'var(--gold)' : 'var(--card)',
                      color: selectedPaymentMethods.includes(m) ? 'var(--bg)' : 'var(--text-3)',
                      border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 150ms ease',
                      fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.06em',
                    }}
                  >
                    {m}
                  </button>
                ))}

                {hasFilters && (
                  <button onClick={clearFilters} style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', padding: '4px 8px' }}>
                    {t('common.clear')}
                  </button>
                )}
              </div>
            </div>

            {/* Clear filters — visible on desktop when filters are inline */}
            {hasFilters && (
              <button
                onClick={clearFilters}
                style={{ display: 'none', background: 'none', border: 'none', color: 'var(--red)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                className="clear-btn-desktop"
              >
                {t('common.clear')}
              </button>
            )}
          </div>

          {/* ── Table (tablet + desktop) ── */}
          <div className="table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="sales-table">
              <thead>
                <tr>
                  <th>{t('sales.invoiceNumber')}</th>
                  <th className="col-datetime">{t('sales.dateTime')}</th>
                  <th className="col-staff">{t('sales.staff')}</th>
                  <th>{t('sales.paymentMethod')}</th>
                  <th style={{ textAlign: 'right' }}>{t('common.total')}</th>
                  <th style={{ textAlign: 'center' }}>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSales.map((sale) => {
                  const isHighlighted = highlightSaleId === sale.id;
                  return (
                    <tr key={sale.id} style={isHighlighted ? { background: 'rgba(59,130,246,0.08)', borderLeft: '4px solid var(--blue)' } : {}}>
                      <td className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{sale.invoice_number}</td>
                      <td className="col-datetime">
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{new Date(sale.created_at).toLocaleDateString(locale)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={10}/> {new Date(sale.created_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="col-staff">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue)', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                            {sale.user_name?.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{sale.user_name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="status-tag" style={{ background: 'var(--gold-dim)', color: 'var(--gold)', border: '1px solid rgba(212,175,55,0.2)' }}>{sale.payment_method}</span>
                      </td>
                      <td className="mono" style={{ textAlign: 'right', fontSize: 16, fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap' }}>{formatPrice(sale.total_amount, currency, lang)}</td>
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                          <button className="btn-icon" onClick={() => handleViewReceipt(sale)} title={t('sales.viewDetails')}><Eye size={14}/></button>
                          <button className="btn-icon" onClick={() => handlePrintReceipt(sale)} title={t('sales.print')}><Printer size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Mobile card list (< 480px) ── */}
          <div className="sale-cards-list">
            {paginatedSales.map((sale) => {
              const isHighlighted = highlightSaleId === sale.id;
              return (
                <div key={sale.id} className={`sale-card-item${isHighlighted ? ' highlighted' : ''}`}>
                  <div className="sale-card-row">
                    <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{sale.invoice_number}</span>
                    <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>{formatPrice(sale.total_amount, currency, lang)}</span>
                  </div>
                  <div className="sale-card-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue)', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                        {sale.user_name?.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{sale.user_name}</span>
                    </div>
                    <span className="status-tag" style={{ background: 'var(--gold-dim)', color: 'var(--gold)', border: '1px solid rgba(212,175,55,0.2)' }}>{sale.payment_method}</span>
                  </div>
                  <div className="sale-card-row">
                    <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={10}/>
                      {new Date(sale.created_at).toLocaleDateString(locale)} · {new Date(sale.created_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-icon" onClick={() => handleViewReceipt(sale)} title={t('sales.viewDetails')}><Eye size={13}/></button>
                      <button className="btn-icon" onClick={() => handlePrintReceipt(sale)} title={t('sales.print')}><Printer size={13}/></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="pagination-bar">
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                {t('common.page')} <span style={{ color: 'var(--text-1)', fontWeight: 700 }}>{currentPage}</span> {t('common.of')} <span style={{ color: 'var(--text-1)', fontWeight: 700 }}>{totalPages}</span>
              </div>
              <div className="pagination-btns" style={{ display: 'flex', gap: 8 }}>
                <button
                  className="page-btn"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{ color: currentPage === 1 ? 'var(--text-3)' : 'var(--text-1)' }}
                >
                  {t('common.previous')}
                </button>
                <button
                  className="page-btn"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{ color: currentPage === totalPages ? 'var(--text-3)' : 'var(--text-1)' }}
                >
                  {t('common.next')}
                </button>
              </div>
            </div>
          )}

          {/* ── Empty State ── */}
          {filteredSales.length === 0 && (
            <div style={{ padding: '64px 0', textAlign: 'center', color: 'var(--text-3)' }}>
              <History size={44} strokeWidth={1} style={{ marginBottom: 16, opacity: 0.3 }} />
              <p style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>{t('sales.noTransactions')}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Receipt Modal ── */}
      {showReceiptModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowReceiptModal(false); }}>
          <div className="modal-box">
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 300, color: 'var(--text-1)', margin: 0 }}>{t('sales.invoiceDetails')}</h2>
                <p className="mono" style={{ fontSize: 12, color: 'var(--text-3)', margin: '4px 0 0' }}>{selectedSale?.invoice_number}</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handlePrintReceipt()}
                  style={{ padding: '8px 14px', borderRadius: 10, background: 'var(--gold)', border: 'none', color: 'var(--bg)', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'DM Sans, sans-serif' }}
                >
                  <Printer size={13}/> {t('sales.print')}
                </button>
                <button
                  onClick={() => setShowReceiptModal(false)}
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-3)', padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={18}/>
                </button>
              </div>
            </div>

            <div className="modal-body custom-scroll">
              {receiptLoading ? (
                <div style={{ padding: '40px 0', textAlign: 'center' }}>
                  <div style={{ width: 30, height: 30, border: '2px solid var(--border)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.6s linear infinite', margin: '0 auto' }} />
                </div>
              ) : receiptData ? (
                <div style={{ color: 'var(--text-2)', fontSize: 13 }}>
                  <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <h3 style={{ color: 'var(--gold)', fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{receiptData.business.name}</h3>
                    <p style={{ margin: 0 }}>{receiptData.business.address}</p>
                    <p style={{ margin: 0 }}>{receiptData.business.phone}</p>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 14, marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div><span style={{ color: 'var(--text-3)', fontSize: 10, fontWeight: 800 }}>{t('sales.date')}</span><p style={{ margin: '4px 0 0', fontWeight: 600 }}>{new Date(receiptData.invoice.date).toLocaleString(locale)}</p></div>
                    <div><span style={{ color: 'var(--text-3)', fontSize: 10, fontWeight: 800 }}>{t('sales.table')}</span><p style={{ margin: '4px 0 0', fontWeight: 600 }}>{receiptData.invoice.table}</p></div>
                    <div><span style={{ color: 'var(--text-3)', fontSize: 10, fontWeight: 800 }}>{t('sales.waiter')}</span><p style={{ margin: '4px 0 0', fontWeight: 600 }}>{receiptData.invoice.waiter || t('sales.staff')}</p></div>
                    <div><span style={{ color: 'var(--text-3)', fontSize: 10, fontWeight: 800 }}>{t('sales.payment')}</span><p style={{ margin: '4px 0 0', fontWeight: 600, textTransform: 'uppercase' }}>{receiptData.payment.method}</p></div>
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-3)', borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 12, textTransform: 'uppercase' }}>{t('pos.items')}</p>
                    {receiptData.items.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8 }}>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <span className="mono" style={{ color: 'var(--gold)', flexShrink: 0 }}>{item.quantity}x</span>
                          <span style={{ fontWeight: 500 }}>{item.name}</span>
                        </div>
                        <span className="mono" style={{ fontWeight: 600, flexShrink: 0 }}>{formatPrice(item.totalPrice, currency, lang)}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>{t('pos.subtotal')}</span><span className="mono">{formatPrice(receiptData.totals.subtotal, currency, lang)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>{t('pos.tax')} (8%)</span><span className="mono">{formatPrice(receiptData.totals.tax, currency, lang)}</span></div>
                    {receiptData.totals.discount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: 'var(--red)' }}>
                        <span>{t('pos.discount')}</span>
                        <span className="mono">-{formatPrice(receiptData.totals.discount, currency, lang)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border)' }}>
                      <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-1)' }}>{t('common.total')}</span>
                      <span className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)' }}>{formatPrice(receiptData.totals.total, currency, lang)}</span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', marginTop: 28, padding: '18px 0 4px', borderTop: '1px solid var(--border)', color: 'var(--text-3)', fontStyle: 'italic', fontSize: 12 }}>
                    {receiptData.footer}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesHistoryPage;