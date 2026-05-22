import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useExpenseStore } from '../stores/useExpenseStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useI18n } from '../lib/i18n';
import { formatPrice } from '../lib/i18n/currency';

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const STYLES = `
  .exp-root {
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
  .exp-root * { box-sizing: border-box; }

  /* ── expense row ── */
  .exp-row {
    display: flex; align-items: center; gap: 14px;
    padding: 14px 20px; border-bottom: 1px solid var(--border);
    transition: background 120ms ease;
  }
  .exp-row:last-child { border-bottom: none; }
  .exp-row:hover { background: rgba(255,255,255,0.012); }
  .exp-row:hover .exp-row-del { opacity: 1; }

  .exp-row-del {
    opacity: 0; transition: opacity 140ms ease;
    width: 28px; height: 28px; border-radius: 7px; border: none; flex-shrink: 0;
    background: var(--red-dim); color: var(--red); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 120ms ease, opacity 140ms ease;
  }
  .exp-row-del:hover { background: rgba(239,68,68,0.18); }

  /* ── category badge ── */
  .cat-badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 9px; border-radius: 20px; font-size: 10.5px; font-weight: 600;
    white-space: nowrap; letter-spacing: 0.03em;
  }

  /* ── field ── */
  .exp-field {
    width: 100%; padding: 10px 13px;
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 9px; color: var(--text-1);
    font-size: 13px; font-family: 'DM Sans', sans-serif;
    outline: none; transition: border-color 140ms ease; color-scheme: dark;
  }
  .exp-field::placeholder { color: var(--text-3); }
  .exp-field:focus { border-color: var(--gold); }
  .exp-field option { background: #16161f; }

  /* ── stat card ── */
  .stat-card {
    background: var(--card); border: 1px solid var(--border); border-radius: 14px;
    padding: 18px 20px; position: relative; overflow: hidden;
    transition: border-color 180ms ease, transform 150ms ease;
  }
  .stat-card:hover { border-color: var(--border-hi); transform: translateY(-1px); }
  .stat-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, rgba(255,255,255,0.06), transparent);
  }

  /* ── form panel ── */
  .form-panel {
    background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
    overflow: hidden; animation: slide-down 200ms cubic-bezier(.22,1,.36,1) both;
  }
  @keyframes slide-down { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }

  /* ── section card ── */
  .sec-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 14px; overflow: hidden;
  }
  .sec-card-hd {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 20px; border-bottom: 1px solid var(--border);
    background: rgba(255,255,255,0.012);
  }

  /* ── section label ── */
  .section-lbl {
    font-size: 9.5px; font-weight: 600; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--text-3);
    display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
  }
  .section-lbl::after { content: ''; flex: 1; height: 1px; background: var(--border); }

  /* ── mono ── */
  .mono { font-family: 'JetBrains Mono', monospace; }

  /* ── skeleton ── */
  @keyframes sk { 0%,100%{opacity:.2} 50%{opacity:.45} }
  .sk { animation: sk 1.5s ease infinite; background: var(--border); border-radius: 4px; }

  /* ── spinner ── */
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── toast ── */
  @keyframes t-in { from{opacity:0;transform:translateX(10px)} to{opacity:1;transform:translateX(0)} }
  .t-item { animation: t-in 180ms ease forwards; }

  /* ── scrollbar ── */
  .exp-root ::-webkit-scrollbar { width: 3px; }
  .exp-root ::-webkit-scrollbar-track { background: transparent; }
  .exp-root ::-webkit-scrollbar-thumb { background: var(--border-hi); border-radius: 2px; }
`;

/* ─── Category config ─────────────────────────────────────────────────────── */
const CAT_CFG: Record<string, { color: string; dim: string; label: string }> = {
  supplies:    { color: 'var(--blue)',   dim: 'var(--blue-dim)',   label: 'Fournitures'   },
  utilities:   { color: 'var(--amber)',  dim: 'var(--amber-dim)',  label: 'Utilités'      },
  rent:        { color: 'var(--purple)', dim: 'var(--purple-dim)', label: 'Loyer'         },
  salaries:    { color: 'var(--green)',  dim: 'var(--green-dim)',  label: 'Salaires'      },
  maintenance: { color: 'var(--gold)',   dim: 'var(--gold-dim)',   label: 'Maintenance'   },
  marketing:   { color: 'var(--red)',    dim: 'var(--red-dim)',    label: 'Marketing'     },
  other:       { color: 'var(--text-2)', dim: 'rgba(136,136,154,0.08)', label: 'Autre'   },
};
const catCfg = (k: string) => CAT_CFG[k] || CAT_CFG.other;

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const fmtDate = (s: string, lang: string) =>
  new Date(s).toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'pt' ? 'pt-PT' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' });

const FL: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'rgba(212,175,55,0.6)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>
      {label}
    </label>
    {children}
  </div>
);

/* ─── Icons ───────────────────────────────────────────────────────────────── */
const IC = {
  plus:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 4v16m8-8H4"/></svg>,
  dollar:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  cal:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  tag:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  trash:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a1 1 0 011-1h2a1 1 0 011 1v2"/></svg>,
  close:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  save:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  list:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
};

/* ════════════════════════════════════════════════════════════════════════════ */
const ExpensesPage = () => {
  const { user }     = useAuthStore();
  const { expenses, loading, fetchExpenses, createExpense, deleteExpense } = useExpenseStore();
  const { currency } = useSettingsStore();
  const { lang, t }  = useI18n();

  const [showForm,  setShowForm]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast,     setToast]     = useState<{ type: 'success'|'error'; msg: string } | null>(null);
  const [formData,  setFormData]  = useState({ description: '', amount: '', category: '' });

  /* inject styles */
  useEffect(() => {
    const id = 'exp-styles';
    if (!document.getElementById(id)) {
      const s = document.createElement('style'); s.id = id; s.textContent = STYLES;
      document.head.appendChild(s);
    }
  }, []);

  useEffect(() => { fetchExpenses(); }, []);

  const showToast = (type: 'success'|'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  /* ── submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const success = await createExpense({
      description: formData.description,
      amount: parseFloat(formData.amount),
      category: formData.category,
      user_id: user.id,
    });
    if (success) {
      setFormData({ description: '', amount: '', category: '' });
      setShowForm(false);
      showToast('success', 'Dépense enregistrée');
    } else {
      showToast('error', 'Échec de l\'enregistrement');
    }
    setSubmitting(false);
  };

  /* ── delete ── */
  const handleDelete = async (id: number) => {
    if (!window.confirm(t('expenses.deleteConfirm'))) return;
    await deleteExpense(id);
    showToast('success', 'Dépense supprimée');
  };

  /* ── derived ── */
  const totalExpenses  = expenses.reduce((s, e) => s + e.amount, 0);
  const thisMonth      = expenses.filter(e => new Date(e.created_at).getMonth() === new Date().getMonth()).reduce((s, e) => s + e.amount, 0);
  const categoriesCount = new Set(expenses.map(e => e.category)).size;

  /* ── top category ── */
  const catTotals = expenses.reduce<Record<string, number>>((acc, e) => { acc[e.category] = (acc[e.category]||0) + e.amount; return acc; }, {});
  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  /* ── category breakdown (top 4 for bar chart) ── */
  const catList = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 4);

  /* ════════════════════════════════════════════════════════════════════ */
  return (
    <div className="exp-root">

      {/* ── Toast ── */}
      {toast && (
        <div className="t-item" style={{
          position:'fixed', top:16, right:16, zIndex:9999,
          padding:'10px 16px', borderRadius:10, fontSize:13, fontWeight:500,
          boxShadow:'0 8px 24px rgba(0,0,0,0.4)',
          background: toast.type==='success' ? '#064e3b' : '#450a0a',
          border:`1px solid ${toast.type==='success' ? 'var(--green)' : 'var(--red)'}`,
          color:  toast.type==='success' ? '#6ee7b7' : '#fca5a5',
          display:'flex', alignItems:'center', gap:10,
        }}>
          {toast.type==='success'
            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 9v2m0 4h.01"/></svg>
          }
          {toast.msg}
        </div>
      )}

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'36px 24px 60px' }}>

        {/* ── Page header ── */}
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:28, flexWrap:'wrap', gap:16 }}>
          <div>
            <p style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:6 }}>
              Finance
            </p>
            <h1 style={{ fontSize:26, fontWeight:300, color:'var(--text-1)', margin:'0 0 4px', letterSpacing:'-0.01em' }}>
              {t('expenses.management') || 'Gestion des Dépenses'}
            </h1>
            <p style={{ fontSize:13.5, color:'var(--text-2)', margin:0 }}>
              {t('expenses.trackDesc') || 'Suivi et contrôle des dépenses opérationnelles'}
            </p>
          </div>

          <button onClick={() => setShowForm(p => !p)} style={{
            display:'flex', alignItems:'center', gap:8, padding:'10px 20px',
            background: showForm ? 'var(--card)' : 'var(--gold)',
            color: showForm ? 'var(--text-2)' : '#09090f',
            border: showForm ? '1px solid var(--border)' : 'none',
            borderRadius:10, fontSize:13.5, fontWeight:700, cursor:'pointer',
            fontFamily:"'DM Sans',sans-serif", transition:'all 150ms ease',
          }}>
            {showForm ? IC.close : IC.plus}
            {showForm ? 'Fermer' : (t('expenses.addExpense') || 'Nouvelle dépense')}
          </button>
        </div>

        {/* ── Inline form (slide-down) ── */}
        {showForm && (
          <div className="form-panel" style={{ marginBottom:16 }}>
            {/* form header */}
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 20px', borderBottom:'1px solid var(--border)', background:'rgba(255,255,255,0.012)' }}>
              <div style={{ width:30, height:30, borderRadius:8, background:'var(--gold-dim)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--gold)' }}>
                {IC.plus}
              </div>
              <div>
                <h3 style={{ fontSize:14, fontWeight:600, color:'var(--text-1)', margin:0 }}>
                  {t('expenses.newExpense') || 'Nouvelle dépense'}
                </h3>
                <p style={{ fontSize:11.5, color:'var(--text-3)', margin:0 }}>Remplissez les informations de la dépense</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ padding:'20px', display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1.2fr', gap:12 }}>
                <FL label={t('expenses.description') || 'Description'}>
                  <input className="exp-field" type="text" required
                    placeholder="Ex: Achat de fournitures de cuisine"
                    value={formData.description}
                    onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} />
                </FL>
                <FL label={t('expenses.amount') || 'Montant'}>
                  <div style={{ position:'relative' }}>
                    <input className="exp-field" type="number" step="0.01" min="0.01" required
                      placeholder="0.00" style={{ paddingRight:36 }}
                      value={formData.amount}
                      onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))} />
                    <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', fontSize:11, color:'var(--text-3)', pointerEvents:'none' }}>
                      {currency || 'ZK'}
                    </span>
                  </div>
                </FL>
                <FL label={t('expenses.selectCategory') || 'Catégorie'}>
                  <select className="exp-field" required
                    value={formData.category}
                    onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}>
                    <option value="">Sélectionner…</option>
                    <option value="supplies">{t('expenses.supplies') || 'Fournitures'}</option>
                    <option value="utilities">{t('expenses.utilities') || 'Utilités'}</option>
                    <option value="rent">{t('expenses.rent') || 'Loyer'}</option>
                    <option value="salaries">{t('expenses.salaries') || 'Salaires'}</option>
                    <option value="maintenance">{t('expenses.maintenance') || 'Maintenance'}</option>
                    <option value="marketing">{t('expenses.marketing') || 'Marketing'}</option>
                    <option value="other">{t('expenses.other') || 'Autre'}</option>
                  </select>
                </FL>
              </div>

              {/* category preview */}
              {formData.category && (() => {
                const cc = catCfg(formData.category);
                return (
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 13px', background:`${cc.color}08`, border:`1px solid ${cc.color}20`, borderRadius:9 }}>
                    <div style={{ color:cc.color }}>{IC.tag}</div>
                    <p style={{ fontSize:12, color:cc.color, margin:0 }}>Catégorie : <strong>{cc.label}</strong></p>
                    {formData.amount && <span className="mono" style={{ marginLeft:'auto', fontSize:13, fontWeight:600, color:cc.color }}>{parseFloat(formData.amount).toFixed(2)} {currency}</span>}
                  </div>
                );
              })()}

              <div style={{ display:'flex', gap:8 }}>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ padding:'9px 18px', background:'var(--card)', border:'1px solid var(--border)', color:'var(--text-2)', borderRadius:9, fontSize:13, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={submitting} style={{
                  flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'9px 0',
                  background: submitting ? 'var(--border)' : 'var(--gold)',
                  color: submitting ? 'var(--text-3)' : '#09090f',
                  border:'none', borderRadius:9, fontSize:13.5, fontWeight:700,
                  cursor: submitting ? 'not-allowed' : 'pointer', fontFamily:"'DM Sans',sans-serif",
                }}>
                  {submitting
                    ? <><span style={{ width:12, height:12, border:'2px solid rgba(0,0,0,0.2)', borderTopColor:'#000', borderRadius:'50%', display:'inline-block', animation:'spin 0.6s linear infinite' }}/>Enregistrement…</>
                    : <>{IC.save}{t('expenses.save') || 'Enregistrer la dépense'}</>
                  }
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── KPI strip ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
          {[
            { label: t('expenses.totalExpenses') || 'Total dépenses', value: formatPrice(totalExpenses, currency, lang), color:'var(--red)',   dim:'var(--red-dim)',   icon:IC.dollar, sub:'toutes périodes' },
            { label: t('expenses.thisMonth')     || 'Ce mois',        value: formatPrice(thisMonth, currency, lang),    color:'var(--gold)',  dim:'var(--gold-dim)',  icon:IC.cal,    sub: new Date().toLocaleDateString(lang==='fr'?'fr-FR':'en-US',{month:'long',year:'numeric'}) },
            { label: t('expenses.categories')   || 'Catégories',      value: String(categoriesCount),                   color:'var(--green)', dim:'var(--green-dim)', icon:IC.tag,    sub: topCat ? `Top : ${catCfg(topCat).label}` : 'Aucune catégorie' },
          ].map((s, i) => (
            <div key={i} className="stat-card">
              <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:`linear-gradient(90deg, ${s.color}28, transparent)` }}/>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <span style={{ fontSize:10, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em' }}>{s.label}</span>
                <div style={{ width:28, height:28, borderRadius:8, background:s.dim, display:'flex', alignItems:'center', justifyContent:'center', color:s.color }}>{s.icon}</div>
              </div>
              <p className="mono" style={{ fontSize:22, fontWeight:300, color:s.color, margin:'0 0 4px', lineHeight:1 }}>{s.value}</p>
              <p style={{ fontSize:11, color:'var(--text-3)', margin:0 }}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Two columns: history + breakdown ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr', gap:16 }}>

          {/* Expense history */}
          <div className="sec-card">
            <div className="sec-card-hd">
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:30, height:30, borderRadius:8, background:'var(--red-dim)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--red)' }}>
                  {IC.list}
                </div>
                <div>
                  <h3 style={{ fontSize:14, fontWeight:600, color:'var(--text-1)', margin:0 }}>
                    {t('expenses.expenseHistory') || 'Historique des dépenses'}
                  </h3>
                  {!loading && expenses.length > 0 && (
                    <p style={{ fontSize:11.5, color:'var(--text-3)', margin:0 }}>
                      <span className="mono">{expenses.length}</span> entrée{expenses.length!==1?'s':''}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div style={{ maxHeight:420, overflowY:'auto' }}>
              {loading ? (
                [1,2,3,4].map(i => (
                  <div key={i} className="exp-row" style={{ opacity:0.3 }}>
                    <div className="sk" style={{ width:36, height:36, borderRadius:9, flexShrink:0 }}/>
                    <div style={{ flex:1 }}>
                      <div className="sk" style={{ width:'60%', height:12, marginBottom:6 }}/>
                      <div className="sk" style={{ width:'40%', height:10 }}/>
                    </div>
                    <div className="sk" style={{ width:70, height:14, borderRadius:4 }}/>
                  </div>
                ))
              ) : !expenses.length ? (
                <div style={{ padding:'48px 24px', textAlign:'center' }}>
                  <svg style={{ margin:'0 auto 14px', display:'block' }} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.2">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                  </svg>
                  <p style={{ fontSize:13.5, color:'var(--text-2)' }}>{t('expenses.noExpenses') || 'Aucune dépense'}</p>
                </div>
              ) : (
                expenses.map(expense => {
                  const cc = catCfg(expense.category);
                  return (
                    <div key={expense.id} className="exp-row">
                      {/* icon */}
                      <div style={{ width:36, height:36, borderRadius:9, background:cc.dim, border:`1px solid ${cc.color}22`, display:'flex', alignItems:'center', justifyContent:'center', color:cc.color, flexShrink:0 }}>
                        {IC.tag}
                      </div>

                      {/* info */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:13, fontWeight:500, color:'var(--text-1)', margin:'0 0 3px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {expense.description}
                        </p>
                        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                          <span className="cat-badge" style={{ background:cc.dim, color:cc.color }}>
                            {cc.label}
                          </span>
                          <span style={{ fontSize:10.5, color:'var(--text-3)' }}>
                            {expense.user_name || 'Système'} · {fmtDate(expense.created_at, lang)}
                          </span>
                        </div>
                      </div>

                      {/* amount */}
                      <span className="mono" style={{ fontSize:14, fontWeight:600, color:'var(--red)', flexShrink:0, marginRight:8 }}>
                        {formatPrice(expense.amount, currency, lang)}
                      </span>

                      {/* delete (admin only, fades on hover) */}
                      {user?.role === 'admin' && (
                        <button className="exp-row-del" onClick={() => handleDelete(expense.id)} title={t('common.delete')}>
                          {IC.trash}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Category breakdown */}
          <div className="sec-card" style={{ alignSelf:'start' }}>
            <div className="sec-card-hd">
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:30, height:30, borderRadius:8, background:'var(--amber-dim)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--amber)' }}>
                  {IC.tag}
                </div>
                <h3 style={{ fontSize:14, fontWeight:600, color:'var(--text-1)', margin:0 }}>
                  Par catégorie
                </h3>
              </div>
            </div>
            <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:14 }}>
              {!catList.length ? (
                <p style={{ fontSize:12.5, color:'var(--text-3)', textAlign:'center', padding:'24px 0' }}>
                  Aucune donnée
                </p>
              ) : catList.map(([cat, total]) => {
                const cc  = catCfg(cat);
                const pct = totalExpenses > 0 ? Math.round((total / totalExpenses) * 100) : 0;
                return (
                  <div key={cat}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                      <span className="cat-badge" style={{ background:cc.dim, color:cc.color }}>{cc.label}</span>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <span className="mono" style={{ fontSize:12.5, fontWeight:600, color:'var(--text-1)' }}>
                          {formatPrice(total, currency, lang)}
                        </span>
                        <span className="mono" style={{ fontSize:10, color:'var(--text-3)' }}>{pct}%</span>
                      </div>
                    </div>
                    <div style={{ height:4, background:'rgba(255,255,255,0.04)', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:cc.color, borderRadius:3, transition:'width 700ms ease' }}/>
                    </div>
                  </div>
                );
              })}

              {/* total recap */}
              {catList.length > 0 && (
                <>
                  <div style={{ height:1, background:'var(--border)', margin:'4px 0' }}/>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:12.5, fontWeight:600, color:'var(--text-2)' }}>Total</span>
                    <span className="mono" style={{ fontSize:16, fontWeight:500, color:'var(--red)' }}>
                      {formatPrice(totalExpenses, currency, lang)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

export default ExpensesPage;