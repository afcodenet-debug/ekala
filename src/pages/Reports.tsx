import { useState, useEffect } from 'react';
import { useReportStore } from '../stores/useReportStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useI18n } from '../lib/i18n';
import { formatPrice } from '../lib/i18n/currency';

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

  .rp-root {
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
  .rp-root * { box-sizing: border-box; }

  /* ── inner wrapper ── */
  .rp-inner {
    max-width: 1140px;
    margin: 0 auto;
    padding: 36px 24px 60px;
  }

  /* ── page header ── */
  .rp-page-hd {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 28px;
    flex-wrap: wrap;
    gap: 16px;
  }
  .rp-page-hd-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  /* ── tabs container ── */
  .rp-tabs-wrap {
    display: flex;
    gap: 4px;
    margin-bottom: 24px;
    padding: 4px;
    background: var(--surface);
    border-radius: 12px;
    border: 1px solid var(--border);
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .rp-tabs-wrap::-webkit-scrollbar { display: none; }

  /* ── tab ── */
  .rp-tab {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 8px 16px; border-radius: 9px; border: 1px solid transparent;
    font-size: 12.5px; font-weight: 500; cursor: pointer; white-space: nowrap;
    transition: all 130ms ease; font-family: 'DM Sans', sans-serif;
    color: var(--text-3); background: none;
    flex-shrink: 0; min-height: 36px;
  }
  .rp-tab:hover { color: var(--text-2); background: rgba(255,255,255,0.03); }
  .rp-tab.active { color: var(--gold); background: var(--gold-dim); border-color: rgba(212,175,55,0.2); }

  /* ── KPI grid ── */
  .rp-kpi-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 20px;
  }

  /* ── report card ── */
  .rp-card {
    background: var(--card); border: 1px solid var(--border); border-radius: 14px;
    padding: 18px 20px; position: relative; overflow: hidden;
    transition: border-color 160ms ease, transform 150ms ease;
  }
  .rp-card:hover { border-color: var(--border-hi); transform: translateY(-1px); }
  .rp-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, rgba(255,255,255,0.06), transparent);
  }

  /* ── sales cards grid ── */
  .rp-sales-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 12px;
  }

  /* ── products two-col ── */
  .rp-products-grid {
    display: grid;
    grid-template-columns: 1.6fr 1fr;
    gap: 16px;
  }

  /* ── section card ── */
  .sec {
    background: var(--surface); border: 1px solid var(--border); border-radius: 14px; overflow: hidden;
  }
  .sec-hd {
    display: flex; align-items: center; gap: 10px;
    padding: 14px 20px; border-bottom: 1px solid var(--border);
    background: rgba(255,255,255,0.012);
    justify-content: space-between;
    flex-wrap: wrap;
  }

  /* ── table row ── */
  .rp-row {
    display: flex; align-items: center; padding: 0 20px; min-height: 58px;
    border-bottom: 1px solid var(--border); transition: background 120ms ease;
  }
  .rp-row:last-child { border-bottom: none; }
  .rp-row:hover { background: rgba(255,255,255,0.012); }
  .rp-row-hd { min-height: 36px; background: rgba(255,255,255,0.018); border-bottom: 1px solid var(--border); cursor: default; }
  .rp-row-hd:hover { background: rgba(255,255,255,0.018); }

  /* ── movements date bar ── */
  .rp-mov-datebar {
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
    flex-wrap: wrap;
    align-items: center;
  }

  /* ── date input ── */
  .rp-date {
    padding: 8px 13px; background: var(--card); border: 1px solid var(--border);
    border-radius: 9px; color: var(--text-1); font-size: 13px;
    font-family: 'DM Sans', sans-serif; outline: none;
    transition: border-color 140ms ease; color-scheme: dark;
    cursor: pointer; min-height: 38px;
  }
  .rp-date:focus { border-color: var(--gold); }

  /* ── export btn ── */
  .export-btn {
    display: flex; align-items: center; gap: 7px; padding: 9px 16px;
    background: var(--gold); color: #09090f; border: none; border-radius: 9px;
    font-size: 13px; font-weight: 700; cursor: pointer;
    font-family: 'DM Sans', sans-serif; transition: box-shadow 150ms ease;
    white-space: nowrap; flex-shrink: 0; min-height: 38px;
  }
  .export-btn:hover { box-shadow: 0 0 18px rgba(212,175,55,0.3); }

  /* ── rank badge ── */
  .rank-badge {
    width: 26px; height: 26px; border-radius: 7px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; font-family: 'JetBrains Mono', monospace;
  }

  /* ── stock progress ── */
  .stock-prog { height: 4px; background: rgba(255,255,255,0.04); border-radius: 2px; margin-top: 5px; overflow: hidden; }
  .stock-fill { height: 100%; border-radius: 2px; transition: width 600ms ease; }

  /* ── mono ── */
  .mono { font-family: 'JetBrains Mono', monospace; }

  /* ── skeleton ── */
  @keyframes sk { 0%,100%{opacity:.2} 50%{opacity:.45} }
  .sk { animation: sk 1.5s ease infinite; background: var(--border); border-radius: 4px; }

  /* ── bar chart ── */
  @keyframes bar-in { from { transform: scaleY(0); } to { transform: scaleY(1); } }

  /* ── hidden columns helper ── */
  .rp-col-hide { display: flex; }

  /* ── scrollbar ── */
  .rp-root ::-webkit-scrollbar { width: 3px; }
  .rp-root ::-webkit-scrollbar-track { background: transparent; }
  .rp-root ::-webkit-scrollbar-thumb { background: var(--border-hi); border-radius: 2px; }

  /* ═══════════════════════════════════════════════════════════════
     RESPONSIVE — mobile-first
  ═══════════════════════════════════════════════════════════════ */

  /* ── Tablets landscape (≤ 1024 px) ─────────────────────────── */
  @media (max-width: 1024px) {
    .rp-inner           { padding: 28px 20px 52px; }
    .rp-products-grid   { grid-template-columns: 1fr; gap: 14px; }
    .rp-kpi-grid        { gap: 10px; }
  }

  /* ── Tablets portrait (≤ 768 px) ───────────────────────────── */
  @media (max-width: 768px) {
    .rp-inner           { padding: 20px 16px 44px; }
    .rp-page-hd         { margin-bottom: 20px; gap: 12px; }
    .rp-page-hd h1      { font-size: 22px !important; }

    .rp-kpi-grid        { grid-template-columns: 1fr 1fr; gap: 9px; margin-bottom: 16px; }
    .rp-kpi-grid .rp-card:last-child { grid-column: span 2; }

    .rp-tabs-wrap       { border-radius: 10px; }
    .rp-tab             { padding: 7px 13px; font-size: 12px; }

    /* hide less-important table columns on tablets */
    .rp-col-min         { display: none !important; }

    .rp-row             { padding: 0 14px; min-height: 52px; }
    .sec-hd             { padding: 12px 16px; gap: 8px; }

    .rp-sales-grid      { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
    .rp-mov-datebar     { gap: 8px; }
  }

  /* ── Large phones (≤ 640 px) ────────────────────────────────── */
  @media (max-width: 640px) {
    .rp-inner           { padding: 16px 14px 40px; }
    .rp-page-hd h1      { font-size: 20px !important; }
    .rp-page-hd-actions { gap: 8px; }
    .rp-date            { font-size: 12px; padding: 7px 10px; }
    .export-btn         { padding: 7px 12px; font-size: 12px; }

    .rp-kpi-grid        { gap: 8px; }
    .rp-card            { padding: 14px 15px; border-radius: 12px; }
    .rp-card .mono      { font-size: 18px !important; }

    .rp-tab             { padding: 6px 11px; font-size: 11.5px; gap: 5px; }
    /* hide tab labels, show only icons on very narrow */
    .rp-tab-label       { display: inline; }

    .rp-row             { padding: 0 12px; min-height: 48px; }
    .rp-row-hd          { min-height: 30px; }

    /* hide "Reason" column in movements */
    .rp-col-reason      { display: none !important; }
    /* hide "Before" stock column */
    .rp-col-before      { display: none !important; }

    .rp-sales-grid      { grid-template-columns: 1fr; }
    .rp-mov-datebar     { flex-direction: column; align-items: stretch; }
    .rp-mov-datebar .rp-date { width: 100%; }
  }

  /* ── Standard phones (≤ 480 px) ────────────────────────────── */
  @media (max-width: 480px) {
    .rp-inner           { padding: 12px 12px 36px; }
    .rp-page-hd h1      { font-size: 18px !important; }
    .rp-page-hd > div:first-child p:first-child { font-size: 10px !important; }

    .rp-kpi-grid        { grid-template-columns: 1fr 1fr; gap: 7px; margin-bottom: 12px; }
    .rp-kpi-grid .rp-card:last-child { grid-column: span 2; }
    .rp-card            { padding: 12px 13px; border-radius: 11px; }
    .rp-card .mono      { font-size: 16px !important; }

    /* tabs: icon only below 480 px */
    .rp-tab-label       { display: none; }
    .rp-tab             { padding: 7px 10px; gap: 0; }

    .sec-hd h3          { font-size: 13px !important; }
    .sec-hd p           { font-size: 10.5px !important; }

    /* hide type & min columns */
    .rp-col-type        { display: none !important; }

    .rp-row             { padding: 0 10px; min-height: 44px; }
    .rank-badge         { width: 22px; height: 22px; font-size: 10px; border-radius: 5px; }

    .rp-bar-chart       { height: 80px !important; }
  }

  /* ── Very small phones (≤ 360 px) ───────────────────────────── */
  @media (max-width: 360px) {
    .rp-inner           { padding: 10px 10px 28px; }
    .rp-kpi-grid        { gap: 6px; }
    .rp-card            { padding: 10px 11px; }
    .rp-card .mono      { font-size: 14px !important; }
    .rp-row             { padding: 0 8px; }
  }

  /* ── Touch targets ─────────────────────────────────────────── */
  @media (pointer: coarse) {
    .rp-tab             { min-height: 40px; }
    .export-btn         { min-height: 44px; }
    .rp-date            { min-height: 44px; }
    .rp-row             { min-height: 52px; }
  }

  @keyframes spin    { to { transform: rotate(360deg); } }
`;

/* ─── Icons ───────────────────────────────────────────────────────────────── */
const IC = {
  cal:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  trend:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 7l-9.5 9.5-5-5L1 18"/><polyline points="16 7 22 7 22 13"/></svg>,
  bar:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18M9 17V9m4 8V5m4 12v-4"/></svg>,
  pkg:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l8 4-8 4-8-4 8-4zM2 6l8 4v10L2 16V6zM22 6l-8 4v10l8-4V6z"/></svg>,
  alert:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v2m0 4h.01M6.938 16.938A9 9 0 1117.062 7.062 9 9 0 016.938 16.938z"/></svg>,
  download: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  dollar:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  star:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const TH: React.FC<{ label: string; flex?: number; align?: 'left'|'right'|'center'; className?: string }> = ({ label, flex=1, align='left', className='' }) => (
  <div className={className} style={{ flex, display:'flex', alignItems:'center', padding:'0 8px', justifyContent: align==='right'?'flex-end':align==='center'?'center':'flex-start' }}>
    <span style={{ fontSize:9.5, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em' }}>{label}</span>
  </div>
);

const SectionHd: React.FC<{ icon: React.ReactNode; color: string; dim: string; title: string; sub?: string; right?: React.ReactNode }> = ({ icon, color, dim, title, sub, right }) => (
  <div className="sec-hd">
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <div style={{ width:30, height:30, borderRadius:8, background:dim, display:'flex', alignItems:'center', justifyContent:'center', color, flexShrink:0 }}>{icon}</div>
      <div>
        <h3 style={{ fontSize:14, fontWeight:600, color:'var(--text-1)', margin:0 }}>{title}</h3>
        {sub && <p style={{ fontSize:11.5, color:'var(--text-3)', margin:0 }}>{sub}</p>}
      </div>
    </div>
    {right && <div style={{ flexShrink:0 }}>{right}</div>}
  </div>
);

const RANK_THEMES = [
  { bg:'rgba(212,175,55,0.15)', color:'var(--gold)' },
  { bg:'rgba(136,136,154,0.12)', color:'var(--text-2)' },
  { bg:'rgba(249,115,22,0.12)', color:'#f97316' },
];

/* ─── Tab config ──────────────────────────────────────────────────────────── */
const TABS = [
  { id:'daily',     labelKey:'reports.tabDaily',     icon: IC.cal,    color:'var(--amber)' },
  { id:'weekly',    labelKey:'reports.tabWeekly',    icon: IC.trend,  color:'var(--blue)'  },
  { id:'monthly',   labelKey:'reports.tabMonthly',   icon: IC.bar,    color:'var(--green)' },
  { id:'products',  labelKey:'reports.tabProducts',  icon: IC.star,   color:'var(--gold)'  },
  { id:'inventory', labelKey:'reports.tabInventory', icon: IC.alert,  color:'var(--red)'   },
  { id:'movements', labelKey:'reports.tabMovements', icon: IC.pkg,    color:'var(--purple)'},
];

/* ════════════════════════════════════════════════════════════════════════════ */
const ReportsPage = () => {
  const { currency } = useSettingsStore();
  const { lang, t }  = useI18n();
  const {
    dailySales, weeklySales, monthlySales,
    topProducts, lowStock, loading,
    fetchDailySales, fetchWeeklySales, fetchMonthlySales,
    fetchTopProducts, fetchLowStock,
    fetchInventoryMovements,
    inventoryMovements
  } = useReportStore();

  const [activeTab,       setActiveTab]       = useState('daily');
  const [selectedDate,    setSelectedDate]    = useState(new Date().toISOString().split('T')[0]);
  const [inventoryStart,  setInventoryStart]  = useState(new Date().toISOString().split('T')[0]);
  const [inventoryEnd,    setInventoryEnd]    = useState(new Date().toISOString().split('T')[0]);

  /* inject styles once */
  useEffect(() => {
    const id = 'rp-styles';
    if (!document.getElementById(id)) {
      const s = document.createElement('style'); s.id = id; s.textContent = STYLES;
      document.head.appendChild(s);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'daily') {
      fetchDailySales(selectedDate);
    } else if (activeTab === 'weekly') {
      const start = new Date(selectedDate);
      start.setDate(start.getDate() - 7);
      fetchWeeklySales(start.toISOString().split('T')[0], selectedDate);
    } else if (activeTab === 'monthly') {
      const d = new Date(selectedDate);
      fetchMonthlySales(String(d.getMonth() + 1), String(d.getFullYear()));
    } else if (activeTab === 'products') {
      fetchTopProducts();
    } else if (activeTab === 'inventory') {
      fetchLowStock();
    } else if (activeTab === 'movements') {
      fetchInventoryMovements({ start: inventoryStart, end: inventoryEnd });
    }
  }, [activeTab, selectedDate, inventoryStart, inventoryEnd]);

  const activeCfg   = TABS.find(t => t.id === activeTab) || TABS[0];
  const currentData = activeTab==='daily' ? dailySales : activeTab==='weekly' ? weeklySales : monthlySales;
  const periodTotal    = currentData.reduce((s: number, r: any) => s + (r.total_amount || 0), 0);
  const periodTxCount  = currentData.reduce((s: number, r: any) => s + (r.transaction_count || 0), 0);
  const maxRevenue     = Math.max(...currentData.map((r: any) => r.total_amount || 0), 1);
  const stockPct = (cur: number, min: number) => Math.min(100, Math.round((cur / Math.max(min, 1)) * 100));

  /* ════════════════════════════════════════════════════════════════════ */
  return (
    <div className="rp-root">
      <div className="rp-inner">

        {/* ── Page header ── */}
        <div className="rp-page-hd">
          <div>
            <p style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:6 }}>
              {t('reports.intelligence')}
            </p>
            <h1 style={{ fontSize:26, fontWeight:300, color:'var(--text-1)', margin:'0 0 4px', letterSpacing:'-0.01em' }}>
              {t('sidebar.reports')}
            </h1>
            <p style={{ fontSize:13.5, color:'var(--text-2)', margin:0 }}>
              {t('reports.subtitle')}
            </p>
          </div>
          <div className="rp-page-hd-actions">
            {!['products','inventory','movements'].includes(activeTab) && (
              <input
                aria-label={t('reports.date')}
                type="date"
                className="rp-date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
            )}
            <button className="export-btn">
              {IC.download} {t('reports.export')}
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="rp-tabs-wrap">
          {TABS.map(tab => (
            <button key={tab.id} className={`rp-tab ${activeTab===tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}>
              {tab.icon}
              <span className="rp-tab-label">{t(tab.labelKey)}</span>
            </button>
          ))}
        </div>

        {/* ── KPI strip (sales tabs only) ── */}
        {['daily','weekly','monthly'].includes(activeTab) && (
          <div className="rp-kpi-grid">
            {[
              { label:t('reports.dailySales'),      value: formatPrice(periodTotal, currency, lang),                                                                      color:'var(--gold)',  dim:'var(--gold-dim)',  icon:IC.dollar },
              { label:t('reports.transactions'),    value: String(periodTxCount),                                                                                         color:'var(--blue)',  dim:'var(--blue-dim)',  icon:IC.cal    },
              { label:t('reports.avgTransaction'),  value: periodTxCount > 0 ? formatPrice(periodTotal/periodTxCount, currency, lang) : '—',                             color:'var(--green)', dim:'var(--green-dim)', icon:IC.trend  },
            ].map((s, i) => (
              <div key={i} className="rp-card">
                <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, ${s.color}55, transparent)`, borderRadius:'14px 14px 0 0' }}/>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, gap:6 }}>
                  <span style={{ fontSize:10, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em', lineHeight:1.3 }}>{s.label}</span>
                  <div style={{ width:28, height:28, borderRadius:8, background:s.dim, display:'flex', alignItems:'center', justifyContent:'center', color:s.color, flexShrink:0 }}>{s.icon}</div>
                </div>
                {loading
                  ? <div className="sk" style={{ height:28, width:100, borderRadius:6 }}/>
                  : <p className="mono" style={{ fontSize:22, fontWeight:300, color:s.color, margin:0, lineHeight:1 }}>{s.value}</p>
                }
              </div>
            ))}
          </div>
        )}

        {/* ── Loading spinner ── */}
        {loading && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200, gap:12 }}>
            <div style={{ width:24, height:24, border:'2px solid var(--border)', borderTopColor:'var(--gold)', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
            <span style={{ fontSize:13, color:'var(--text-3)' }}>{t('reports.loading')}</span>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            SALES TABS
        ══════════════════════════════════════════════════════════════ */}
        {!loading && ['daily','weekly','monthly'].includes(activeTab) && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* Bar chart */}
            {currentData.length > 0 && (
              <div className="sec">
                <SectionHd icon={IC.bar} color="var(--gold)" dim="var(--gold-dim)"
                  title={`${t('reports.dailySales')} — ${activeTab==='daily'?t('reports.tabDaily'):activeTab==='weekly'?t('reports.tabWeekly'):t('reports.tabMonthly')}`}
                  sub={t('reports.salesEntries', { count: currentData.length })}
                />
                <div style={{ padding:'16px 20px 12px' }}>
                  <div className="rp-bar-chart" style={{ display:'flex', alignItems:'flex-end', gap:4, height:120 }}>
                    {currentData.map((r: any, i: number) => {
                      const pct = Math.max((r.total_amount / maxRevenue) * 100, r.total_amount>0?3:0);
                      return (
                        <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', height:'100%', gap:4, cursor:'default' }}
                          title={formatPrice(r.total_amount, currency, lang)}>
                          <div style={{
                            width:'100%', height:`${pct}%`,
                            background: pct>80 ? 'var(--gold)' : 'rgba(212,175,55,0.3)',
                            borderRadius:'3px 3px 0 0',
                            border: pct>80 ? '1px solid rgba(212,175,55,0.5)' : '1px solid transparent',
                            borderBottom:'none',
                            transformOrigin:'bottom',
                            animation:`bar-in 400ms ease ${i*30}ms both`,
                          }}/>
                          <span className="mono" style={{ fontSize:8, color:'var(--text-3)' }}>
                            {r.date?.slice(5) || r.date}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Sales cards grid */}
            <div className="rp-sales-grid">
              {currentData.map((report: any) => (
                <div key={report.date} className="rp-card">
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg, var(--gold)55, transparent)', borderRadius:'14px 14px 0 0' }}/>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14, gap:8 }}>
                    <div style={{ minWidth:0 }}>
                      <p style={{ fontSize:10, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 3px' }}>
                        {activeTab==='weekly' ? t('reports.weekOf') : activeTab==='monthly' ? t('reports.monthlySales') : t('reports.dailySales')}
                      </p>
                      <p style={{ fontSize:13.5, fontWeight:500, color:'var(--text-1)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{report.date}</p>
                    </div>
                    <div style={{ width:28, height:28, borderRadius:8, background:'var(--gold-dim)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--gold)', flexShrink:0 }}>
                      {activeCfg.icon}
                    </div>
                  </div>
                  <p className="mono" style={{ fontSize:20, fontWeight:300, color:'var(--gold)', margin:'0 0 5px', lineHeight:1 }}>
                    {formatPrice(report.total_amount, currency, lang)}
                  </p>
                  <p style={{ fontSize:11.5, color:'var(--text-3)', margin:0 }}>
                    <span className="mono">{report.transaction_count}</span> {t('reports.transactions')}
                  </p>
                  <div style={{ height:2, background:'rgba(255,255,255,0.04)', borderRadius:1, marginTop:12, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${(report.total_amount/maxRevenue)*100}%`, background:'var(--gold)', borderRadius:1, transition:'width 600ms ease' }}/>
                  </div>
                </div>
              ))}
            </div>

            {/* Empty state */}
            {!currentData.length && (
              <div style={{ padding:'52px 24px', textAlign:'center' }}>
                <svg style={{ margin:'0 auto 14px', display:'block' }} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.2">
                  <path d="M3 3v18h18M9 17V9m4 8V5m4 12v-4"/>
                </svg>
                <p style={{ fontSize:13.5, color:'var(--text-2)', marginBottom:4 }}>{t('reports.noData')}</p>
                <p style={{ fontSize:12, color:'var(--text-3)' }}>{t('reports.selectOtherDate')}</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TOP PRODUCTS
        ══════════════════════════════════════════════════════════════ */}
        {!loading && activeTab === 'products' && (
          <div className="rp-products-grid">
            {/* Ranked list */}
            <div className="sec">
              <SectionHd icon={IC.star} color="var(--gold)" dim="var(--gold-dim)"
                title={t('reports.topProductsTitle')}
                sub={t('reports.topProductsSub', { count: topProducts.length })}
                right={<span className="mono" style={{ fontSize:11, color:'var(--text-3)' }}>{t('reports.byRevenue')}</span>}
              />
              {!topProducts.length ? (
                <div style={{ padding:'48px 24px', textAlign:'center' }}>
                  <p style={{ fontSize:13.5, color:'var(--text-2)' }}>{t('reports.noData')}</p>
                </div>
              ) : (
                topProducts.map((p: any, i: number) => {
                  const maxRev = Math.max(...topProducts.map((x: any) => x.revenue || 0), 1);
                  const rk = RANK_THEMES[i] || { bg:'rgba(255,255,255,0.04)', color:'var(--text-3)' };
                  return (
                    <div key={p.product_id} className="rp-row">
                      <div className="rank-badge" style={{ background:rk.bg, color:rk.color }}>
                        {i < 3 ? ['🥇','🥈','🥉'][i] : i+1}
                      </div>
                      <div style={{ flex:1, minWidth:0, padding:'0 12px' }}>
                        <p style={{ fontSize:13, fontWeight:500, color:'var(--text-1)', margin:'0 0 4px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {p.product_name}
                        </p>
                        <div style={{ height:3, background:'rgba(255,255,255,0.04)', borderRadius:2, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${(p.revenue/maxRev)*100}%`, background:'var(--gold)', borderRadius:2, transition:'width 600ms ease' }}/>
                        </div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <p className="mono" style={{ fontSize:13, fontWeight:600, color:'var(--gold)', margin:'0 0 1px' }}>
                          {formatPrice(p.revenue, currency, lang)}
                        </p>
                        <p style={{ fontSize:11, color:'var(--text-3)', margin:0 }}>
                          <span className="mono">{p.quantity_sold}</span> unités
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Revenue share chart */}
            <div className="sec" style={{ alignSelf:'start' }}>
              <SectionHd icon={IC.bar} color="var(--blue)" dim="var(--blue-dim)"
                title={t('reports.revenueShare')}
                sub={t('reports.shareOfCA')}
              />
              <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 }}>
                {topProducts.slice(0,5).map((p: any, i: number) => {
                  const totalRev = topProducts.reduce((s: number, x: any) => s + (x.revenue||0), 0);
                  const pct = totalRev > 0 ? Math.round((p.revenue/totalRev)*100) : 0;
                  const barColors = ['var(--gold)','var(--blue)','var(--green)','var(--purple)','var(--amber)'];
                  const color = barColors[i] || 'var(--text-3)';
                  return (
                    <div key={p.product_id}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                        <span style={{ fontSize:12, color:'var(--text-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'60%' }}>{p.product_name}</span>
                        <span className="mono" style={{ fontSize:11, color:'var(--text-3)' }}>{pct}%</span>
                      </div>
                      <div style={{ height:4, background:'rgba(255,255,255,0.04)', borderRadius:2, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:2, transition:'width 700ms ease' }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            LOW STOCK
        ══════════════════════════════════════════════════════════════ */}
        {!loading && activeTab === 'inventory' && (
          <div className="sec">
            <SectionHd icon={IC.alert} color="var(--red)" dim="var(--red-dim)"
              title={t('reports.lowStockTitle')}
              sub={t('reports.lowStockSub')}
              right={lowStock.length > 0
                ? <span style={{ padding:'3px 10px', borderRadius:20, fontSize:10.5, fontWeight:700, background:'var(--red-dim)', color:'var(--red)', border:'1px solid rgba(239,68,68,0.2)' }}>
                    {t('reports.lowStockItems', { count: lowStock.length })}
                  </span>
                : null
              }
            />
            {/* table header */}
            <div className="rp-row rp-row-hd">
              <TH label={t('reports.productCol')}    flex={2}   />
              <TH label={t('reports.currentStock')}  flex={1}   align="center" />
              <TH label={t('reports.minRequired')}   flex={1}   align="center" className="rp-col-min" />
              <TH label={t('reports.level')}         flex={1.5} />
              <TH label={t('reports.urgency')}       flex={0.8} align="center" />
            </div>

            {!lowStock.length ? (
              <div style={{ padding:'48px 24px', textAlign:'center' }}>
                <div style={{ width:56, height:56, borderRadius:'50%', background:'var(--green-dim)', border:'1px solid rgba(16,185,129,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.8"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>
                <p style={{ fontSize:14, fontWeight:500, color:'var(--text-1)', marginBottom:4 }}>{t('reports.stockOK')}</p>
                <p style={{ fontSize:12.5, color:'var(--text-3)' }}>{t('reports.noProductBelowThreshold')}</p>
              </div>
            ) : lowStock.map((product: any) => {
              const pct     = stockPct(product.stock_quantity, product.minimum_stock);
              const color   = pct < 30 ? 'var(--red)' : pct < 60 ? 'var(--amber)' : 'var(--green)';
              const urgency = pct < 30
                ? { label:t('reports.critical'), bg:'var(--red-dim)',   fg:'var(--red)'   }
                : { label:t('reports.low'),      bg:'var(--amber-dim)', fg:'var(--amber)' };
              return (
                <div key={product.id} className="rp-row">
                  <div style={{ flex:2, padding:'0 8px', minWidth:0 }}>
                    <p style={{ fontSize:13.5, fontWeight:500, color:'var(--text-1)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {product.name}
                    </p>
                  </div>
                  <div style={{ flex:1, padding:'0 8px', display:'flex', justifyContent:'center' }}>
                    <span className="mono" style={{ fontSize:15, fontWeight:300, color }}>{product.stock_quantity}</span>
                  </div>
                  {/* minimum — hidden on mobile via class */}
                  <div className="rp-col-min" style={{ flex:1, padding:'0 8px', display:'flex', justifyContent:'center' }}>
                    <span className="mono" style={{ fontSize:13, color:'var(--text-3)' }}>{product.minimum_stock}</span>
                  </div>
                  <div style={{ flex:1.5, padding:'0 8px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span className="mono" style={{ fontSize:10, color:'var(--text-3)' }}>{pct}%</span>
                    </div>
                    <div className="stock-prog">
                      <div className="stock-fill" style={{ width:`${pct}%`, background:color }}/>
                    </div>
                  </div>
                  <div style={{ flex:0.8, padding:'0 8px', display:'flex', justifyContent:'center' }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:20, fontSize:10.5, fontWeight:700, background:urgency.bg, color:urgency.fg, border:`1px solid ${urgency.fg}25` }}>
                      {urgency.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            INVENTORY MOVEMENTS
        ══════════════════════════════════════════════════════════════ */}
        {!loading && activeTab === 'movements' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div className="rp-mov-datebar">
              <input type="date" className="rp-date" value={inventoryStart} onChange={e => setInventoryStart(e.target.value)} />
              <input type="date" className="rp-date" value={inventoryEnd}   onChange={e => setInventoryEnd(e.target.value)}   />
              <button className="export-btn" onClick={() => fetchInventoryMovements({ start: inventoryStart, end: inventoryEnd })}>
                {t('reports.refreshBtn')}
              </button>
            </div>

            <div className="sec">
              <SectionHd icon={IC.pkg} color="var(--purple)" dim="var(--purple-dim)"
                title={t('reports.movementsTitle')}
                sub={t('reports.movementsSub')}
              />
              {!inventoryMovements.length ? (
                <div style={{ padding:'48px 24px', textAlign:'center' }}>
                  <p style={{ fontSize:13.5, color:'var(--text-2)' }}>{t('reports.noMovementsYet')}</p>
                </div>
              ) : (
                <>
                  <div className="rp-row rp-row-hd">
                    <TH label={t('reports.movDate')}    flex={1.2} />
                    <TH label={t('reports.movProduct')} flex={1.5} />
                    <TH label={t('reports.movType')}    flex={0.8} align="center" className="rp-col-type" />
                    <TH label={t('reports.movQty')}     flex={0.8} align="center" />
                    <TH label={t('reports.movStock')}   flex={1}   align="center" />
                    <TH label={t('reports.movReason')}  flex={1.5} className="rp-col-reason" />
                  </div>
                  {inventoryMovements.map((m: any) => (
                    <div key={m.id} className="rp-row">
                      <div style={{ flex:1.2, padding:'0 8px' }}>
                        <span style={{ fontSize:12, color:'var(--text-2)' }}>{m.created_at?.slice(0,16).replace('T',' ')}</span>
                      </div>
                      <div style={{ flex:1.5, padding:'0 8px', minWidth:0 }}>
                        <p style={{ fontSize:13, fontWeight:500, color:'var(--text-1)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {m.product_name}
                        </p>
                      </div>
                      {/* type — hidden on small phones */}
                      <div className="rp-col-type" style={{ flex:0.8, padding:'0 8px', display:'flex', justifyContent:'center' }}>
                        <span className="mono" style={{ fontSize:11, color: m.movement_type==='sale'?'var(--red)':m.movement_type==='adjustment'?'var(--green)':'var(--blue)' }}>
                          {m.movement_type==='sale' ? t('reports.typeSale') : m.movement_type==='adjustment' ? t('reports.typeAdjustment') : t('reports.typeEntry')}
                        </span>
                      </div>
                      <div style={{ flex:0.8, padding:'0 8px', display:'flex', justifyContent:'center' }}>
                        <span className="mono" style={{ fontSize:12, color: m.quantity_changed<0?'var(--red)':'var(--green)' }}>
                          {m.quantity_changed > 0 ? '+' : ''}{m.quantity_changed}
                        </span>
                      </div>
                      <div style={{ flex:1, padding:'0 8px', display:'flex', justifyContent:'center', gap:8 }}>
                        {/* before — hidden on small phones */}
                        <span className="mono rp-col-before" style={{ fontSize:11, color:'var(--text-3)' }}>{m.quantity_before}</span>
                        <span className="mono" style={{ fontSize:13, color:'var(--text-1)' }}>{m.quantity_after}</span>
                      </div>
                      {/* reason — hidden on mobile */}
                      <div className="rp-col-reason" style={{ flex:1.5, padding:'0 8px', minWidth:0 }}>
                        <span style={{ fontSize:12, color:'var(--text-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>
                          {m.reason}
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ReportsPage;