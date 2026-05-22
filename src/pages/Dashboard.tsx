import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api-client';
import { useI18n } from '../lib/i18n';
import { useSettingsStore } from '../stores/useSettingsStore';
import { formatPrice } from '../lib/i18n/currency';

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const STYLES = `
  .db-root {
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
    --sky:         #38bdf8;
    --sky-dim:     rgba(56,189,248,0.08);
    font-family: 'DM Sans', sans-serif;
    color: var(--text-1);
    background: var(--bg);
    min-height: 100vh;
  }
  .db-root * { box-sizing: border-box; }

  .kpi {
    background: var(--card); border: 1px solid var(--border); border-radius: 16px;
    padding: 20px 22px; position: relative; overflow: hidden;
    transition: border-color 180ms ease, transform 150ms ease, box-shadow 180ms ease;
  }
  .kpi:hover { border-color: var(--border-hi); transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,0,0,0.3); }
  .kpi::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, rgba(255,255,255,0.07), transparent);
  }

  .sec { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }
  .sec-hd {
    display: flex; align-items: center; gap: 10px;
    padding: 14px 20px; border-bottom: 1px solid var(--border);
    background: rgba(255,255,255,0.012);
  }

  .live-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 8px; border-radius: 20px; font-size: 9.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.06em;
    background: var(--green-dim); color: var(--green); border: 1px solid rgba(16,185,129,0.2);
  }
  .live-dot {
    width: 5px; height: 5px; border-radius: 50%; background: var(--green);
    box-shadow: 0 0 6px rgba(16,185,129,0.7);
    animation: live-pulse 2s ease-in-out infinite;
  }
  @keyframes live-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }

  .stat-prog { height: 3px; background: rgba(255,255,255,0.05); border-radius: 2px; margin-top: 8px; overflow: hidden; }
  .stat-prog-fill { height: 100%; border-radius: 2px; transition: width 800ms ease; }

  .act-item {
    display: flex; align-items: center; gap: 12px;
    padding: 11px 20px; border-bottom: 1px solid var(--border);
    transition: background 120ms ease;
  }
  .act-item:last-child { border-bottom: none; }
  .act-item:hover { background: rgba(255,255,255,0.012); }

  .refresh-btn {
    width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--border);
    background: var(--card); color: var(--text-3); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 140ms ease;
  }
  .refresh-btn:hover { border-color: var(--border-hi); color: var(--text-1); }

  @keyframes live-pulse-ring {
    0%   { transform: scale(0.5); opacity: 0.7; }
    70%  { transform: scale(1.9); opacity: 0; }
    100% { transform: scale(2.1); opacity: 0; }
  }

  .mono { font-family: 'JetBrains Mono', monospace; }

  @keyframes sk { 0%,100%{opacity:.18} 50%{opacity:.4} }
  .sk { animation: sk 1.5s ease infinite; background: var(--border); border-radius: 4px; }

  @keyframes spin { to { transform: rotate(360deg); } }
  .spinning svg { animation: spin 0.8s linear infinite; }

  @keyframes bar-in { from { transform: scaleY(0); } to { transform: scaleY(1); } }

  .db-root ::-webkit-scrollbar { width: 3px; }
  .db-root ::-webkit-scrollbar-track { background: transparent; }
  .db-root ::-webkit-scrollbar-thumb { background: var(--border-hi); border-radius: 2px; }
`;

const LOCALES: Record<string, string> = { en: 'en-US', fr: 'fr-FR', pt: 'pt-PT' };

const fmtTime = (lang?: string) => new Date().toLocaleTimeString(LOCALES[lang ?? 'en'] ?? 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const fmtDate = (lang?: string) => new Date().toLocaleDateString(LOCALES[lang ?? 'en'] ?? 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/* ─── Professional relative time (used in activity feed) ─────────────────── */
const getRelativeTime = (dateStr: string, lang: string = 'en'): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) {
    if (lang === 'fr') return "à l'instant";
    if (lang === 'pt') return "agora";
    return "just now";
  }
  if (diffMin < 60) {
    return `${diffMin} min`;
  }
  if (diffHour < 24) {
    return lang === 'fr' ? `${diffHour} h` : `${diffHour}h`;
  }
  // Older than 24h → show short date
  return date.toLocaleDateString(LOCALES[lang] || 'en-US', { month: 'short', day: 'numeric' });
};

const SectionHd: React.FC<{ icon: React.ReactNode; color: string; dim: string; title: string; sub?: string }> = ({ icon, color, dim, title, sub }) => (
  <div className="sec-hd">
    <div style={{ width: 30, height: 30, borderRadius: 8, background: dim, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>{icon}</div>
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>{title}</h3>
      {sub && <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: 0 }}>{sub}</p>}
    </div>
  </div>
);

// Real-time activity icons (used for the professional live feed)
const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  sale:   <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  order:  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  stock:  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v2m0 4h.01M6.938 16.938A9 9 0 1117.062 7.062 9 9 0 016.938 16.938z"/></svg>,
};

const CARD_ICONS: Record<string, React.ReactNode> = {
  'dollar': <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  'table':  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="3" rx="1"/><path d="M5 10v7m14-7v7M3 17h18"/></svg>,
  'warn':   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v2m0 4h.01M6.938 16.938A9 9 0 1117.062 7.062 9 9 0 016.938 16.938z"/></svg>,
  'users':  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
};

const Dashboard = () => {
  const { t } = useI18n();
  const lang = useSettingsStore(s => s.language);
  const { currency } = useSettingsStore();
  const navigate = useNavigate();

  // Professional real dashboard data
  const [data, setData] = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [spinning,   setSpinning]   = useState(false);
  const [clock,      setClock]      = useState(() => fmtTime(lang));
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    const id = 'db-styles';
    if (!document.getElementById(id)) { const s = document.createElement('style'); s.id = id; s.textContent = STYLES; document.head.appendChild(s); }
  }, []);

  useEffect(() => {
    setClock(fmtTime(lang));
    const clockInterval = setInterval(() => setClock(fmtTime(lang)), 1000);
    return () => clearInterval(clockInterval);
  }, [lang]);

  const fetchDashboard = useCallback(async (manual = false) => {
    if (manual) setSpinning(true);
    try {
      const summary = await api.dashboard.summary() as any;
      setData(summary);
      setLastUpdate(new Date());
    } catch (e) {
      console.error('[Dashboard] Failed to load summary:', e);
    } finally {
      setLoading(false);
      setSpinning(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); const iv = setInterval(fetchDashboard, 30_000); return () => clearInterval(iv); }, [fetchDashboard]);

  const handleActivityClick = () => {
    // Prevent crash: this dashboard live feed item is currently informational.
    // You can later extend this to navigate to details by using item payload.
  };

  // peak hour is now computed dynamically from real data in the hourly chart

  return (
    <div className="db-root">
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 24px 60px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:28, flexWrap:'wrap', gap:16 }}>
          <div>
            <p style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:6 }}>{t('dashboard.sectionOverview')}</p>
            <h1 style={{ fontSize:26, fontWeight:300, color:'var(--text-1)', margin:'0 0 4px', letterSpacing:'-0.01em' }}>{t('dashboard.title')}</h1>
            <p style={{ fontSize:11, color:'var(--text-3)', textAlign:'right', margin:0, textTransform:'capitalize' }}>{fmtDate(lang)} </p>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ padding:'9px 16px', background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, display:'flex', alignItems:'center', gap:10 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span className="mono" style={{ fontSize:14, color:'var(--text-1)' }}>{clock}</span>
            </div>
            <div className="live-badge"><span className="live-dot"/>{t('dashboard.live')}</div>
            <button className={`refresh-btn ${spinning?'spinning':''}`} onClick={() => fetchDashboard(true)} title={t('dashboard.refresh')} aria-label={t('dashboard.refresh')}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            </button>
          </div>
        </div>

        {/* Professional KPI strip - driven by real backend data */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
          {[
            { key: 'revenueToday',   label: t('dashboard.revenueToday'),   color: 'var(--green)',  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> },
            { key: 'activeTables',   label: t('dashboard.activeTables'),   color: 'var(--sky)',    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="3" rx="1"/><path d="M5 10v7m14-7v7M3 17h18"/></svg> },
            { key: 'lowStockItems',  label: t('dashboard.lowStock'),       color: 'var(--amber)',  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v2m0 4h.01M6.938 16.938A9 9 0 1117.062 7.062 9 9 0 016.938 16.938z"/></svg>,  alert: true },
            { key: 'staffOnDuty',    label: t('dashboard.teamOnDuty'),     color: 'var(--purple)', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg> }
          ].map((k, i) => {
            const val = data?.kpis?.[k.key] ?? 0;
            const display = k.key === 'revenueToday' ? formatPrice(val, currency, lang) : val;
            const isAlert = k.key === 'lowStockItems' && val > 0;
            const color = isAlert ? 'var(--amber)' : k.color;
            const dim   = isAlert ? 'var(--amber-dim)' : (k.color + '-dim' in ({} as any) ? (k as any).dim : k.color.replace(')', '-dim)'));

            return (
              <div key={i} className="kpi">
                <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, ${color}55, transparent)`, borderRadius:'12px 12px 0 0' }}/>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
                  <div style={{ width:34, height:34, borderRadius:9, background: isAlert ? 'var(--amber-dim)' : 'var(--card-hi)', display:'flex', alignItems:'center', justifyContent:'center', color }}>{k.icon}</div>
                  {isAlert && (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 7px', borderRadius:20, fontSize:9.5, fontWeight:700, background:'var(--amber-dim)', color:'var(--amber)', border:'1px solid rgba(245,158,11,0.2)' }}>
                      <span style={{ width:4, height:4, borderRadius:'50%', background:'var(--amber)', animation:'live-pulse 1.5s ease infinite' }}/> {t('dashboard.alert')}
                    </span>
                  )}
                </div>
                <p style={{ fontSize:10, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 6px' }}>{k.label}</p>
                {loading
                  ? <div className="sk" style={{ height:32, width:80, borderRadius:6 }}/>
                  : <p className="mono" style={{ fontSize:28, fontWeight:300, color:'var(--text-1)', margin:0, lineHeight:1 }}>{display}</p>
                }

                {k.key === 'revenueToday' && !loading && data?.kpis && (
                  (() => {
                    const today = data.kpis.revenueToday || 0;
                    const yest = data.kpis.revenueYesterday || 0;
                    const diff = today - yest;
                    const pct = yest > 0 ? (diff / yest * 100) : 0;
                    const color = diff >= 0 ? 'var(--green)' : 'var(--red)';
                    const sign = diff >= 0 ? '+' : '';
                    return (
                      <div style={{ fontSize: 11, color, marginTop: 2, fontWeight: 600 }}>
                        {sign}{formatPrice(diff, currency, lang)} ({sign}{pct.toFixed(0)}%)
                      </div>
                    );
                  })()
                )}
              </div>
            );
          })}
         </div>

         <p style={{ fontSize:11, color:'var(--text-3)', textAlign:'right', marginBottom:20 }}>
          {t('dashboard.updatedAt', { time: lastUpdate.toLocaleTimeString(LOCALES[lang ?? 'en'] ?? 'en-US') })} · {t('dashboard.autoRefresh')}
        </p>

        {/* Two columns - Professional real-time sections */}
        <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:16, marginBottom:16 }}>

          {/* Real Recent Activity Feed */}
          <div className="sec">
            <SectionHd
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>}
              color="var(--blue)" dim="var(--blue-dim)"
              title={t('dashboard.recentActivity')}
              sub={t('dashboard.liveFeed')}
            />
            <div>
              {!data?.recentActivity?.length ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
                  {t('dashboard.noRecentActivity') || 'No recent activity yet'}
                </div>
              ) : (
                data.recentActivity.slice(0, 6).map((item: any, i: number) => {
                  const icon = ACTIVITY_ICONS[item.type] || ACTIVITY_ICONS.order;
                  const color = item.type === 'sale' ? 'var(--green)' : item.type === 'stock' ? 'var(--amber)' : 'var(--blue)';

                  let label = '';
                  let context = '';

                  if (item.type === 'sale') {
                    label = t('dashboard.actPaid', { amount: formatPrice(item.amount, currency, lang) });
                    context = item.table ? `Table ${item.table} • ${item.method}` : (item.method || '');
                  } else if (item.type === 'order') {
                    label = t('dashboard.actOrderConfirmed', { num: item.id });
                    context = item.table ? `Table ${item.table} • ${item.status || ''}` : (item.status || '').toUpperCase();
                  } else if (item.type === 'stock') {
                     const product = item.product || item.name || item.product_name || '—';
                     const current = item.current ?? item.stock_quantity ?? item.stock ?? '—';
                     const minimum = item.minimum ?? item.minimum_stock ?? '—';

                     label = t('dashboard.actStockAlert', { item: product });
                     context = `${current} / min ${minimum}`;
                   }

                   const relative = getRelativeTime(item.time, lang);
                   const timeColumn = item.type === 'stock' ? (
                     <span style={{
                       display: 'inline-flex',
                       alignItems: 'center',
                       gap: 5,
                       padding: '2px 8px',
                       background: 'var(--amber-dim)',
                       border: `1px solid var(--amber)33`,
                       borderRadius: 999,
                       fontSize: 10,
                       fontWeight: 700,
                       color: 'var(--amber)',
                       letterSpacing: '0.5px',
                       flexShrink: 0
                     }}>
                       {/* Inner dot with glow */}
                       <span style={{
                         width: 6,
                         height: 6,
                         background: 'var(--amber)',
                         borderRadius: '50%',
                         boxShadow: '0 0 8px var(--amber), 0 0 16px var(--amber)',
                         position: 'relative',
                         zIndex: 2
                       }}>
                         {/* Outer neon ring */}
                         <span style={{
                           position: 'absolute',
                           top: -3,
                           left: -3,
                           width: 12,
                           height: 12,
                           border: `1px solid var(--amber)`,
                           borderRadius: '50%',
                           animation: 'live-pulse-ring 1.8s ease-out infinite',
                           opacity: 0.65,
                           zIndex: 1
                         }} />
                       </span>
                       {t('dashboard.live') || 'Live'}
                     </span>
                   ) : (
                     <span className="mono" style={{ fontSize:10.5, color:'var(--text-3)', flexShrink:0 }}>
                       {t('dashboard.timeAgo', { time: relative })}
                     </span>
                   );

                   return (
                     <div 
                       key={i} 
                       className="act-item"
                       onClick={handleActivityClick}
                       style={{ cursor: 'pointer' }}
                       title={
                         item.type === 'sale' ? 'Voir les ventes' :
                         item.type === 'order' ? 'Voir les commandes' :
                         item.type === 'stock' ? 'Voir les produits' : ''
                       }
                     >
                       <div style={{ width:28, height:28, borderRadius:8, background:`${color}14`, border:`1px solid ${color}28`, display:'flex', alignItems:'center', justifyContent:'center', color, flexShrink:0 }}>
                         {icon}
                       </div>
                       <div style={{ flex:1, minWidth:0 }}>
                         <p style={{ fontSize:13, fontWeight:500, color:'var(--text-1)', margin:'0 0 1px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</p>
                         <p style={{ fontSize:11, color:'var(--text-3)', margin:0 }}>{context}</p>
                       </div>
                       {timeColumn}
                     </div>
                   );
                })
              )}
            </div>
          </div>

          {/* Real Hourly Sales Chart (from DB) */}
          <div className="sec">
            <SectionHd
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
              color="var(--green)" dim="var(--green-dim)"
              title={t('dashboard.hourlyActivity')}
              sub={t('dashboard.ordersToday')}
            />
             <div style={{ padding:'16px 16px 12px' }}>
               {/* Total du jour */}
               {data?.hourlySales?.some((h: any) => h.amount > 0) && (
                 <div style={{ marginBottom: 8, fontSize: 12.5, color: 'var(--text-2)' }}>
                    {t('dashboard.todayTotal')} <span style={{ fontWeight: 700, color: 'var(--green)' }}>
                     {formatPrice(data.hourlySales.reduce((sum: number, h: any) => sum + h.amount, 0), currency, lang)}
                   </span>
                 </div>
               )}

               <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:110 }}>
                 {(data?.hourlySales || []).map((h: any, i: number) => {
                   const max = Math.max(...(data?.hourlySales?.map((x: any) => x.amount) || [1]));
                   const heightPct = max > 0 ? Math.max(4, (h.amount / max) * 100) : 4;
                   const isPeak = h.amount === Math.max(...(data?.hourlySales?.map((x: any) => x.amount) || [0]));
                   const tooltip = `${h.hour} → ${formatPrice(h.amount, currency, lang)}`;

                   return (
                     <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', height:'100%', gap:4 }}>
                       <div 
                         style={{
                           width:'100%',
                           height: `${heightPct}%`,
                           background: isPeak ? 'var(--green)' : 'rgba(16,185,129,0.25)',
                           borderRadius:'3px 3px 0 0',
                           borderTop: isPeak ? '1px solid rgba(16,185,129,0.5)' : '1px solid transparent',
                           borderRight: isPeak ? '1px solid rgba(16,185,129,0.5)' : '1px solid transparent',
                           borderLeft: isPeak ? '1px solid rgba(16,185,129,0.5)' : '1px solid transparent',
                           borderBottom: 'none',
                           transformOrigin: 'bottom',
                           animation: `bar-in 400ms ease ${i * 15}ms both`,
                           cursor: 'pointer'
                         }}
                         title={tooltip}
                       />
                       <span className="mono" style={{ fontSize:7.5, color:'var(--text-3)' }}>{h.hour}</span>
                     </div>
                   );
                 })}
               </div>

              {data?.hourlySales?.some((h: any) => h.amount > 0) && (
                <div style={{ marginTop:12, padding:'8px 12px', background:'var(--green-dim)', border:'1px solid rgba(16,185,129,0.15)', borderRadius:8, display:'flex', alignItems:'center', gap:8 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
                  <p style={{ fontSize:11.5, color:'var(--green)', margin:0 }}>
                    {t('dashboard.peakHour')}: <strong>
                      {data.hourlySales.reduce((a: any, b: any) => a.amount > b.amount ? a : b).hour}
                    </strong>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Operations Snapshot - real metrics (professional) */}
        <div className="sec">
          <SectionHd
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>}
            color="var(--purple)" dim="var(--purple-dim)"
            title={t('dashboard.operationsSnapshot')}
          />
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', padding:'16px 20px', gap:12 }}>
            {[
              { 
                label: t('dashboard.openOrders'),   
                value: data?.kpis?.openOrders ?? 0,   
                color: 'var(--blue)',
                sub: t('dashboard.inProgress')
              },
              { 
                label: t('dashboard.lowStockItems'),  
                value: data?.kpis?.lowStockItems ?? 0, 
                color: (data?.kpis?.lowStockItems ?? 0) > 0 ? 'var(--amber)' : 'var(--green)',
                sub: (data?.kpis?.lowStockItems ?? 0) > 0 ? t('dashboard.needsRestocking') : t('dashboard.stockOK')
              },
              { 
                label: t('dashboard.avgOrder'), 
                value: (data?.kpis?.transactionsToday ?? 0) > 0 
                  ? formatPrice((data?.kpis?.revenueToday || 0) / (data.kpis.transactionsToday || 1), currency, lang)
                  : '—', 
                color: 'var(--sky)',
                sub: t('dashboard.perTransaction')
              },
              { 
                label: t('dashboard.vsYesterday'), 
                value: (() => {
                  const today = data?.kpis?.revenueToday || 0;
                  const yest = data?.kpis?.revenueYesterday || 0;
                  const diff = today - yest;
                  const pct = yest > 0 ? ((diff / yest) * 100) : 0;
                  const sign = diff >= 0 ? '+' : '';
                  return `${sign}${formatPrice(diff, currency, lang)} (${sign}${pct.toFixed(0)}%)`;
                })(), 
                color: (() => {
                  const diff = (data?.kpis?.revenueToday || 0) - (data?.kpis?.revenueYesterday || 0);
                  return diff >= 0 ? 'var(--green)' : 'var(--red)';
                })(),
                sub: t('dashboard.change')
              }
            ].map((item, i) => (
              <div key={i} style={{ padding:'14px 16px', background:'var(--card)', border:`1px solid ${item.color}22`, borderRadius:10 }}>
                <div style={{ fontSize:10.5, color:'var(--text-3)', fontWeight:600, marginBottom:2 }}>{item.label}</div>
                <div className="mono" style={{ fontSize:17, fontWeight:700, color: item.color, lineHeight:1.1 }}>{item.value}</div>
                {item.sub && (
                  <div style={{ fontSize:10, color:'var(--text-3)', marginTop:3, opacity:0.85 }}>{item.sub}</div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes bar-in{from{transform:scaleY(0)}to{transform:scaleY(1)}}`}</style>
    </div>
  );
};

export default Dashboard;
