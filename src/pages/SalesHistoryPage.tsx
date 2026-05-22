import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Search, Download, History, Eye, Printer, X,
  TrendingUp, CreditCard, DollarSign, Clock
} from 'lucide-react';
import { api } from '../lib/api-client';
import { printReceipt, ReceiptData } from '../utils/receiptPrinter';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useI18n } from '../lib/i18n';
import { formatPrice } from '../lib/i18n/currency';

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const STYLES = `
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

  .kpi-card {
    background: var(--card); border: 1px solid var(--border); border-radius: 16px;
    padding: 18px 20px; position: relative; overflow: hidden;
    transition: all 180ms ease;
  }
  .kpi-card:hover { border-color: var(--border-hi); transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,0,0,0.3); }

  .mono { font-family: 'JetBrains Mono', monospace; }

  .filter-input {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 10px 14px 10px 38px;
    color: var(--text-1); font-size: 13px; transition: all 150ms ease;
    width: 100%; outline: none;
  }
  .filter-input:focus { border-color: var(--blue); background: var(--card); }

  .sales-table {
    width: 100%; border-collapse: separate; border-spacing: 0;
  }
  .sales-table th {
    padding: 14px 20px; font-size: 10px; font-weight: 800; text-transform: uppercase;
    letter-spacing: 0.1em; color: var(--text-3); border-bottom: 1px solid var(--border);
    background: var(--surface); text-align: left;
  }
  .sales-table td {
    padding: 16px 20px; border-bottom: 1px solid var(--border);
    transition: all 150ms ease;
  }
  .sales-table tr:hover td { background: rgba(255,255,255,0.02); }

  .status-tag {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 10px; border-radius: 20px; font-size: 9px; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.08em;
  }

  .btn-icon {
    width: 34px; height: 34px; border-radius: 10px; background: var(--surface);
    border: 1px solid var(--border); color: var(--text-3); display: flex;
    align-items: center; justify-content: center; transition: all 150ms ease;
    cursor: pointer;
  }
  .btn-icon:hover { border-color: var(--text-2); color: var(--text-1); transform: translateY(-1px); }

  .custom-scroll::-webkit-scrollbar { width: 4px; }
  .custom-scroll::-webkit-scrollbar-track { background: transparent; }
  .custom-scroll::-webkit-scrollbar-thumb { background: var(--border-hi); border-radius: 10px; }
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, startDate, endDate, selectedPaymentMethods]);

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

  if (loading) return (
    <div className="sales-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div className="sales-root">
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '36px 24px 60px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32, gap: 20, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>{t('sales.financialArchives')}</p>
            <h1 style={{ fontSize: 28, fontWeight: 300, color: 'var(--text-1)', margin: '0 0 4px', letterSpacing: '-0.01em' }}>{t('sales.history')}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
               <div style={{ fontSize: 10, color: 'var(--gold)', background: 'var(--gold-dim)', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(212,175,55,0.2)', fontWeight: 700 }}>{t('sales.auditLog')}</div>
               <span style={{ fontSize: 12, color: 'var(--text-3)' }}>•</span>
               <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{filteredSales.length} {t('sales.transactionsRecorded')}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button 
              onClick={handleExportCSV}
              style={{ padding: '10px 18px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Download size={14} /> {t('sales.exportCsv')}
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 32 }}>
          {[
            { label: t('sales.totalRevenue'), value: formatPrice(stats.total, currency, lang), color: 'var(--gold)', icon: <TrendingUp size={14}/> },
            { label: t('sales.averageBasket'), value: formatPrice(stats.avg, currency, lang), color: 'var(--purple)', icon: <DollarSign size={14}/> },
            { label: t('sales.cash'), value: formatPrice(stats.cash, currency, lang), color: 'var(--green)', icon: <CreditCard size={14}/> },
            { label: t('sales.card'), value: formatPrice(stats.card, currency, lang), color: 'var(--amber)', icon: <CreditCard size={14}/> },
          ].map((k, i) => (
            <div key={i} className="kpi-card">
               <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ color: k.color }}>{k.icon}</div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</span>
               </div>
               <div className="mono" style={{ fontSize: 20, fontWeight: 300, color: 'var(--text-1)' }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Filters & Table Container */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24, overflow: 'hidden' }}>
          
          {/* Controls Bar */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 300 }}>
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

            <div style={{ display: 'flex', gap: 10 }}>
               <label htmlFor="start-date" style={{ display: 'none' }}>Start Date</label>
               <input 
                 id="start-date"
                 type="date" 
                 className="filter-input" 
                 style={{ width: 160, paddingLeft: 14 }} 
                 value={startDate}
                 onChange={(e) => setStartDate(e.target.value)}
                 title="Filter by start date"
               />
               <label htmlFor="end-date" style={{ display: 'none' }}>End Date</label>
               <input 
                 id="end-date"
                 type="date" 
                 className="filter-input" 
                 style={{ width: 160, paddingLeft: 14 }} 
                 value={endDate}
                 onChange={(e) => setEndDate(e.target.value)}
                 title="Filter by end date"
               />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {paymentMethods.map(m => (
                <button
                  key={m}
                  onClick={() => togglePaymentMethod(m)}
                  style={{ 
                    padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
                    background: selectedPaymentMethods.includes(m) ? 'var(--gold)' : 'var(--card)',
                    color: selectedPaymentMethods.includes(m) ? 'var(--bg)' : 'var(--text-3)',
                    border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 150ms ease'
                  }}
                >
                  {m}
                </button>
              ))}
            </div>

            {(searchTerm || startDate || endDate || selectedPaymentMethods.length > 0) && (
              <button onClick={clearFilters} style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{t('common.clear')}</button>
            )}
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table className="sales-table">
              <thead>
                <tr>
                  <th>{t('sales.invoiceNumber')}</th>
              <th>{t('sales.dateTime')}</th>
              <th>{t('sales.staff')}</th>
                  <th>{t('sales.paymentMethod')}</th>
                  <th style={{ textAlign: 'right' }}>{t('common.total')}</th>
                  <th style={{ textAlign: 'center' }}>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="custom-scroll">
                {paginatedSales.map((sale) => {
                  const isHighlighted = highlightSaleId === sale.id;
                  return (
                    <tr 
                      key={sale.id}
                      style={isHighlighted ? { 
                        background: 'rgba(59, 130, 246, 0.08)',
                        borderLeft: '4px solid var(--blue)'
                      } : {}}
                    >
                    <td className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{sale.invoice_number}</td>
                    <td>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{new Date(sale.created_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'pt' ? 'pt-PT' : 'en-US')}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={10}/> {new Date(sale.created_at).toLocaleTimeString(lang === 'fr' ? 'fr-FR' : lang === 'pt' ? 'pt-PT' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue)', fontSize: 11, fontWeight: 800 }}>
                          {sale.user_name?.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{sale.user_name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="status-tag" style={{ background: 'var(--gold-dim)', color: 'var(--gold)', border: '1px solid rgba(212,175,55,0.2)' }}>{sale.payment_method}</span>
                    </td>
                    <td className="mono" style={{ textAlign: 'right', fontSize: 16, fontWeight: 600, color: 'var(--text-1)' }}>{formatPrice(sale.total_amount, currency, lang)}</td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                        <button className="btn-icon" onClick={() => handleViewReceipt(sale)} title={t('sales.viewDetails')}><Eye size={14} /></button>
                        <button className="btn-icon" onClick={() => handlePrintReceipt(sale)} title={t('sales.print')}><Printer size={14} /></button>
                      </div>
                    </td>
                   </tr>
                  );
                })}
               </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)' }}>
               <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                 {t('common.page')} <span style={{ color: 'var(--text-1)', fontWeight: 700 }}>{currentPage}</span> {t('common.of')} <span style={{ color: 'var(--text-1)', fontWeight: 700 }}>{totalPages}</span>
               </div>
               <div style={{ display: 'flex', gap: 8 }}>
                 <button 
                   onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                   disabled={currentPage === 1}
                   style={{ 
                     padding: '6px 14px', borderRadius: 10, fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
                     background: 'var(--surface)', color: currentPage === 1 ? 'var(--text-3)' : 'var(--text-1)',
                     border: '1px solid var(--border)', cursor: currentPage === 1 ? 'default' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1
                   }}
                 >
                   {t('common.previous')}
                 </button>
                 <button 
                   onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                   disabled={currentPage === totalPages}
                   style={{ 
                     padding: '6px 14px', borderRadius: 10, fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
                     background: 'var(--surface)', color: currentPage === totalPages ? 'var(--text-3)' : 'var(--text-1)',
                     border: '1px solid var(--border)', cursor: currentPage === totalPages ? 'default' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1
                   }}
                 >
                   {t('common.next')}
                 </button>
               </div>
            </div>
          )}

          {filteredSales.length === 0 && (
            <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-3)' }}>
              <History size={48} strokeWidth={1} style={{ marginBottom: 16, opacity: 0.3 }} />
              <p style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('sales.noTransactions')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Receipt Modal */}
      {showReceiptModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 24, width: '100%', maxWidth: 500, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 300, color: 'var(--text-1)', margin: 0 }}>{t('sales.invoiceDetails')}</h2>
                <p className="mono" style={{ fontSize: 12, color: 'var(--text-3)', margin: '4px 0 0' }}>{selectedSale?.invoice_number}</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handlePrintReceipt()} style={{ padding: '8px 16px', borderRadius: 10, background: 'var(--gold)', border: 'none', color: 'var(--bg)', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><Printer size={14}/> {t('sales.print')}</button>
                <button onClick={() => setShowReceiptModal(false)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-3)', padding: 8, cursor: 'pointer' }}><X size={18}/></button>
              </div>
            </div>

            <div className="custom-scroll" style={{ padding: 24, maxHeight: '70vh', overflowY: 'auto' }}>
              {receiptLoading ? (
                <div style={{ padding: '40px 0', textAlign: 'center' }}>
                  <div style={{ width: 30, height: 30, border: '2px solid var(--border)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.6s linear infinite', margin: '0 auto' }} />
                </div>
              ) : receiptData ? (
                <div style={{ color: 'var(--text-2)', fontSize: 13 }}>
                   <div style={{ textAlign: 'center', marginBottom: 24 }}>
                     <h3 style={{ color: 'var(--gold)', fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>{receiptData.business.name}</h3>
                     <p style={{ margin: 0 }}>{receiptData.business.address}</p>
                     <p style={{ margin: 0 }}>{receiptData.business.phone}</p>
                   </div>

                   <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 16, marginBottom: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div><span style={{ color: 'var(--text-3)', fontSize: 10, fontWeight: 800 }}>{t('sales.date')}</span><p style={{ margin: 0, fontWeight: 600 }}>{new Date(receiptData.invoice.date).toLocaleString(lang === 'fr' ? 'fr-FR' : lang === 'pt' ? 'pt-PT' : 'en-US')}</p></div>
                      <div><span style={{ color: 'var(--text-3)', fontSize: 10, fontWeight: 800 }}>{t('sales.table')}</span><p style={{ margin: 0, fontWeight: 600 }}>{receiptData.invoice.table}</p></div>
                      <div><span style={{ color: 'var(--text-3)', fontSize: 10, fontWeight: 800 }}>{t('sales.waiter')}</span><p style={{ margin: 0, fontWeight: 600 }}>{receiptData.invoice.waiter || t('sales.staff')}</p></div>
                      <div><span style={{ color: 'var(--text-3)', fontSize: 10, fontWeight: 800 }}>{t('sales.payment')}</span><p style={{ margin: 0, fontWeight: 600, textTransform: 'uppercase' }}>{receiptData.payment.method}</p></div>
                   </div>

                   <div style={{ marginBottom: 24 }}>
                      <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-3)', borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 12, textTransform: 'uppercase' }}>{t('pos.items')}</p>
                      {receiptData.items.map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                           <div style={{ display: 'flex', gap: 12 }}>
                              <span className="mono" style={{ color: 'var(--gold)' }}>{item.quantity}x</span>
                              <span style={{ fontWeight: 500 }}>{item.name}</span>
                           </div>
                            <span className="mono" style={{ fontWeight: 600 }}>{formatPrice(item.totalPrice, currency, lang)}</span>
                        </div>
                      ))}
                   </div>

                   <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>{t('pos.subtotal')}</span><span className="mono">{formatPrice(receiptData.totals.subtotal, currency, lang)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>{t('pos.tax')} (8%)</span><span className="mono">{formatPrice(receiptData.totals.tax, currency, lang)}</span></div>
                      {receiptData.totals.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: 'var(--red)' }}><span>{t('pos.discount')}</span><span className="mono">-{formatPrice(receiptData.totals.discount, currency, lang)}</span></div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border)' }}>
                        <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>{t('common.total')}</span>
                        <span className="mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>{formatPrice(receiptData.totals.total, currency, lang)}</span>
                      </div>
                   </div>

                   <div style={{ textAlign: 'center', marginTop: 32, padding: 20, borderTop: '1px solid var(--border)', color: 'var(--text-3)', fontStyle: 'italic', fontSize: 12 }}>
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
