import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useExpenseStore } from '../stores/useExpenseStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useI18n } from '../lib/i18n';
import { formatPrice } from '../lib/i18n/currency';

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&family=JetBrains+Mono:wght@300;400;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; }

  .exp-root {
    --bg:          #09090f;
    --surface:     #111118;
    --card:        #16161f;
    --card-hi:     #1c1c27;
    --border:      #1e1e2e;
    --border-hi:   #2a2a3c;
    --text-1:      #eeeef5;
    --text-2:      #88889a;
    --text-3:      #44445a;
    --amber:       #f59e0b;
    --amber-dim:   rgba(245,158,11,0.09);
    --blue:        #3b82f6;
    --blue-dim:    rgba(59,130,246,0.09);
    --green:       #10b981;
    --green-dim:   rgba(16,185,129,0.09);
    --red:         #ef4444;
    --red-dim:     rgba(239,68,68,0.09);
    --purple:      #a78bfa;
    --purple-dim:  rgba(167,139,250,0.09);
    --gold:        #d4af37;
    --gold-dim:    rgba(212,175,55,0.09);
    --gold-glow:   rgba(212,175,55,0.15);
    font-family: 'DM Sans', sans-serif;
    color: var(--text-1);
    background: var(--bg);
    min-height: 100vh;
  }

  /* ── Page inner ── */
  .exp-inner {
    max-width: 1100px;
    margin: 0 auto;
    padding: 36px 24px 60px;
  }
  @media (max-width: 768px) { .exp-inner { padding: 24px 16px 48px; } }
  @media (max-width: 480px) { .exp-inner { padding: 16px 12px 40px; } }

  /* ── Page header ── */
  .exp-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 28px;
    flex-wrap: wrap;
    gap: 16px;
  }
  @media (max-width: 560px) {
    .exp-header { flex-direction: column; align-items: stretch; margin-bottom: 20px; }
    .exp-header-cta { width: 100%; justify-content: center; }
  }

  /* ── KPI Grid ── */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 20px;
  }
  @media (max-width: 640px) { .kpi-grid { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 380px) { .kpi-grid { grid-template-columns: 1fr; } }

  /* ── stat card ── */
  .stat-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 18px 20px;
    position: relative;
    overflow: hidden;
    transition: border-color 180ms ease, transform 160ms ease, box-shadow 160ms ease;
  }
  .stat-card:hover {
    border-color: var(--border-hi);
    transform: translateY(-2px);
    box-shadow: 0 14px 36px rgba(0,0,0,0.3);
  }
  .stat-card::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at top left, var(--card-accent, transparent) 0%, transparent 60%);
    pointer-events: none;
  }
  @media (max-width: 640px) {
    .stat-card { padding: 14px 16px; border-radius: 14px; }
    .stat-card:hover { transform: none; }
  }
  /* Make last KPI span full width on 2-col mobile */
  @media (max-width: 640px) {
    .kpi-grid .stat-card:last-child { grid-column: 1 / -1; }
  }

  /* ── Layout columns ── */
  .exp-columns {
    display: grid;
    grid-template-columns: 1.6fr 1fr;
    gap: 16px;
    align-items: start;
  }
  @media (max-width: 860px) {
    .exp-columns { grid-template-columns: 1fr; }
  }

  /* ── Section card ── */
  .sec-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    overflow: hidden;
  }
  .sec-card-hd {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    background: rgba(255,255,255,0.013);
  }
  @media (max-width: 480px) {
    .sec-card { border-radius: 14px; }
    .sec-card-hd { padding: 13px 16px; }
  }

  /* ── Expense row ── */
  .exp-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 13px 20px;
    border-bottom: 1px solid var(--border);
    transition: background 120ms ease;
    position: relative;
  }
  .exp-row:last-child { border-bottom: none; }
  .exp-row:hover { background: rgba(255,255,255,0.013); }
  .exp-row:hover .exp-row-del { opacity: 1; transform: scale(1); }

  .exp-row-del {
    opacity: 0;
    transform: scale(0.85);
    transition: opacity 140ms ease, transform 140ms ease, background 120ms ease;
    width: 30px; height: 30px;
    border-radius: 8px;
    border: 1px solid rgba(239,68,68,0.2);
    flex-shrink: 0;
    background: var(--red-dim);
    color: var(--red);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .exp-row-del:hover { background: rgba(239,68,68,0.2); border-color: rgba(239,68,68,0.4); }
  @media (max-width: 480px) {
    .exp-row { padding: 12px 14px; gap: 10px; }
    .exp-row-del { opacity: 1; transform: scale(1); }
  }

  /* ── Category badge ── */
  .cat-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 9px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 700;
    white-space: nowrap;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  /* ── Form panel ── */
  .form-panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    overflow: hidden;
    margin-bottom: 20px;
    animation: slide-down 220ms cubic-bezier(.22,1,.36,1) both;
  }
  @keyframes slide-down {
    from { opacity: 0; transform: translateY(-12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @media (max-width: 480px) { .form-panel { border-radius: 14px; } }

  /* ── Form grid ── */
  .form-grid {
    display: grid;
    grid-template-columns: 2fr 1fr 1.2fr;
    gap: 12px;
  }
  @media (max-width: 640px) {
    .form-grid { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 420px) {
    .form-grid { grid-template-columns: 1fr; }
  }

  /* ── Field ── */
  .exp-field {
    width: 100%;
    padding: 11px 13px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    color: var(--text-1);
    font-size: 13px;
    font-family: 'DM Sans', sans-serif;
    outline: none;
    transition: border-color 140ms ease, box-shadow 140ms ease;
    color-scheme: dark;
  }
  .exp-field::placeholder { color: var(--text-3); }
  .exp-field:focus {
    border-color: var(--gold);
    box-shadow: 0 0 0 3px var(--gold-glow);
  }
  .exp-field option { background: #16161f; }

  /* ── Form actions ── */
  .form-actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }
  @media (max-width: 480px) {
    .form-actions { flex-direction: column-reverse; }
    .form-actions button { width: 100%; justify-content: center; }
  }

  /* ── Mono ── */
  .mono { font-family: 'JetBrains Mono', monospace; }

  /* ── Skeleton ── */
  @keyframes sk { 0%,100%{opacity:.15} 50%{opacity:.35} }
  .sk { animation: sk 1.6s ease infinite; background: var(--border); border-radius: 4px; }

  /* ── Toast ── */
  @keyframes t-in  { from{opacity:0;transform:translateY(-8px) scale(.96)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes t-out { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(-8px)} }
  .t-item { animation: t-in 200ms ease forwards; }

  /* ── Progress bar ── */
  .prog-bar {
    height: 5px;
    background: rgba(255,255,255,0.04);
    border-radius: 4px;
    overflow: hidden;
  }
  .prog-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 800ms cubic-bezier(.22,1,.36,1);
  }

  /* ── Icon box ── */
  .icon-box {
    width: 32px; height: 32px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  /* ── Scrollbar ── */
  .exp-root ::-webkit-scrollbar { width: 3px; }
  .exp-root ::-webkit-scrollbar-track { background: transparent; }
  .exp-root ::-webkit-scrollbar-thumb { background: var(--border-hi); border-radius: 2px; }

  /* ── Fade-up animation ── */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .fade-up { animation: fadeUp 280ms ease both; }

  /* ── Spinner ── */
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner {
    width: 12px; height: 12px;
    border: 2px solid rgba(0,0,0,0.15);
    border-top-color: #000;
    border-radius: 50%;
    display: inline-block;
    animation: spin 0.6s linear infinite;
  }

  /* ── Divider ── */
  .section-lbl {
    font-size: 9.5px; font-weight: 700; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--text-3);
    display: flex; align-items: center; gap: 10px; margin-bottom: 14px;
  }
  .section-lbl::after { content: ''; flex: 1; height: 1px; background: var(--border); }

  /* ── Expense description truncate ── */
  .exp-desc {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-1);
    margin: 0 0 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 260px;
  }
  @media (max-width: 480px) { .exp-desc { max-width: 160px; font-size: 12px; } }

  /* ── Amount highlight ── */
  .exp-amount {
    font-size: 14px;
    font-weight: 700;
    color: var(--red);
    flex-shrink: 0;
    margin-right: 6px;
    letter-spacing: -0.01em;
  }
  @media (max-width: 380px) { .exp-amount { font-size: 12px; } }
`;

/* ─── Category config ─────────────────────────────────────────────────────── */
const CAT_CFG: Record<string, { color: string; dim: string; border: string; label: string; glyph: string }> = {
  supplies:    { color: 'var(--blue)',   dim: 'var(--blue-dim)',   border: 'rgba(59,130,246,0.2)',  label: 'Fournitures',  glyph: '📦' },
  utilities:   { color: 'var(--amber)',  dim: 'var(--amber-dim)',  border: 'rgba(245,158,11,0.2)', label: 'Utilités',     glyph: '⚡' },
  rent:        { color: 'var(--purple)', dim: 'var(--purple-dim)', border: 'rgba(167,139,250,0.2)',label: 'Loyer',        glyph: '🏠' },
  salaries:    { color: 'var(--green)',  dim: 'var(--green-dim)',  border: 'rgba(16,185,129,0.2)', label: 'Salaires',     glyph: '👥' },
  maintenance: { color: 'var(--gold)',   dim: 'var(--gold-dim)',   border: 'rgba(212,175,55,0.2)', label: 'Maintenance',  glyph: '🔧' },
  marketing:   { color: 'var(--red)',    dim: 'var(--red-dim)',    border: 'rgba(239,68,68,0.2)',  label: 'Marketing',    glyph: '📢' },
  other:       { color: 'var(--text-2)', dim: 'rgba(136,136,154,0.08)', border: 'rgba(136,136,154,0.18)', label: 'Autre', glyph: '•' },
};
const catCfg = (k: string) => CAT_CFG[k] || CAT_CFG.other;

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const fmtDate = (s: string, lang: string) =>
  new Date(s).toLocaleDateString(
    lang === 'fr' ? 'fr-FR' : lang === 'pt' ? 'pt-PT' : 'en-US',
    { day: '2-digit', month: 'short', year: 'numeric' }
  );

/* ─── Sub-components ──────────────────────────────────────────────────────── */
const FL: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label style={{
      display: 'block', fontSize: 9.5, fontWeight: 700, color: 'rgba(212,175,55,0.55)',
      textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 7,
    }}>
      {label}
    </label>
    {children}
  </div>
);

/* ─── SVG Icons ───────────────────────────────────────────────────────────── */
const IC = {
  plus:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 4v16m8-8H4"/></svg>,
  dollar:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  cal:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  tag:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  trash:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a1 1 0 011-1h2a1 1 0 011 1v2"/></svg>,
  close:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  save:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  list:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  grid:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  check:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  warn:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>,
};

/* ════════════════════════════════════════════════════════════════════════════ */
const ExpensesPage = () => {
  const { user }     = useAuthStore();
  const { expenses, loading, fetchExpenses, createExpense, deleteExpense } = useExpenseStore();
  const { currency } = useSettingsStore();
  const { lang, t }  = useI18n();

  const [showForm,   setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast,      setToast]      = useState<{ type: 'success'|'error'; msg: string } | null>(null);
  const [formData,   setFormData]   = useState({ description: '', amount: '', category: '' });

  /* inject styles */
  useEffect(() => {
    const id = 'exp-styles-v2';
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
      showToast('success', 'Dépense enregistrée avec succès');
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
  const totalExpenses    = expenses.reduce((s, e) => s + e.amount, 0);
  const thisMonth        = expenses.filter(e => new Date(e.created_at).getMonth() === new Date().getMonth()).reduce((s, e) => s + e.amount, 0);
  const categoriesCount  = new Set(expenses.map(e => e.category)).size;
  const catTotals        = expenses.reduce<Record<string, number>>((acc, e) => { acc[e.category] = (acc[e.category]||0) + e.amount; return acc; }, {});
  const topCat           = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const catList          = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  const locale = lang === 'fr' ? 'fr-FR' : lang === 'pt' ? 'pt-PT' : 'en-US';

  /* ════════════════════════════════════════════════════════════════════ */
  return (
    <div className="exp-root">

      {/* ── Toast ── */}
      {toast && (
        <div className="t-item" style={{
          position: 'fixed', top: 16, right: 16, zIndex: 9999,
          padding: '11px 18px', borderRadius: 12, fontSize: 13, fontWeight: 500,
          boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          background: toast.type === 'success' ? 'rgba(6,78,59,0.95)' : 'rgba(69,10,10,0.95)',
          border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
          color:  toast.type === 'success' ? '#6ee7b7' : '#fca5a5',
          display: 'flex', alignItems: 'center', gap: 10,
          backdropFilter: 'blur(8px)',
          maxWidth: 'calc(100vw - 32px)',
        }}>
          <span style={{ flexShrink: 0 }}>
            {toast.type === 'success' ? IC.check : IC.warn}
          </span>
          {toast.msg}
        </div>
      )}

      <div className="exp-inner">

        {/* ── Page header ── */}
        <div className="exp-header">
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 6px' }}>
              Finance
            </p>
            <h1 style={{ fontSize: 'clamp(20px, 5vw, 26px)', fontWeight: 300, color: 'var(--text-1)', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
              {t('expenses.management') || 'Gestion des Dépenses'}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
              {t('expenses.trackDesc') || 'Suivi et contrôle des dépenses opérationnelles'}
            </p>
          </div>

          <button
            className="exp-header-cta"
            onClick={() => setShowForm(p => !p)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '11px 22px',
              background: showForm ? 'var(--card)' : 'var(--gold)',
              color: showForm ? 'var(--text-2)' : '#09090f',
              border: showForm ? '1px solid var(--border)' : '1px solid transparent',
              borderRadius: 12, fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              transition: 'all 180ms ease',
              boxShadow: showForm ? 'none' : '0 4px 20px rgba(212,175,55,0.25)',
            }}
          >
            {showForm ? IC.close : IC.plus}
            {showForm ? 'Fermer' : (t('expenses.addExpense') || 'Nouvelle dépense')}
          </button>
        </div>

        {/* ── Inline form ── */}
        {showForm && (
          <div className="form-panel">
            {/* form header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '15px 20px',
              borderBottom: '1px solid var(--border)',
              background: 'linear-gradient(to right, rgba(212,175,55,0.04), transparent)',
            }}>
              <div className="icon-box" style={{ background: 'var(--gold-dim)', color: 'var(--gold)', border: '1px solid rgba(212,175,55,0.2)' }}>
                {IC.plus}
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
                  {t('expenses.newExpense') || 'Nouvelle dépense'}
                </h3>
                <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '2px 0 0' }}>
                  Remplissez les informations ci-dessous
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-grid">
                <FL label={t('expenses.description') || 'Description'}>
                  <input
                    className="exp-field" type="text" required
                    placeholder="Ex: Achat de fournitures de cuisine"
                    value={formData.description}
                    onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  />
                </FL>
                <FL label={t('expenses.amount') || 'Montant'}>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="exp-field" type="number" step="0.01" min="0.01" required
                      placeholder="0.00" style={{ paddingRight: 42 }}
                      value={formData.amount}
                      onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))}
                    />
                    <span style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-3)', pointerEvents: 'none', fontWeight: 700 }}>
                      {currency || 'ZK'}
                    </span>
                  </div>
                </FL>
                <FL label={t('expenses.selectCategory') || 'Catégorie'}>
                  <select
                    className="exp-field" required
                    value={formData.category}
                    onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}
                  >
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

              {/* Category preview pill */}
              {formData.category && (() => {
                const cc = catCfg(formData.category);
                return (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px',
                    background: cc.dim,
                    border: `1px solid ${cc.border}`,
                    borderRadius: 10,
                    flexWrap: 'wrap',
                    gap: 10,
                  }}>
                    <span style={{ fontSize: 16 }}>{cc.glyph}</span>
                    <p style={{ fontSize: 12.5, color: cc.color, margin: 0, fontWeight: 600 }}>
                      Catégorie : <strong>{cc.label}</strong>
                    </p>
                    {formData.amount && (
                      <span className="mono" style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: cc.color }}>
                        {parseFloat(formData.amount).toFixed(2)} {currency}
                      </span>
                    )}
                  </div>
                );
              })()}

              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  style={{
                    padding: '10px 20px', background: 'var(--card)',
                    border: '1px solid var(--border)', color: 'var(--text-2)',
                    borderRadius: 10, fontSize: 13, cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
                    transition: 'all 150ms ease',
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '10px 0',
                    background: submitting ? 'var(--border)' : 'var(--gold)',
                    color: submitting ? 'var(--text-3)' : '#09090f',
                    border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    fontFamily: "'DM Sans', sans-serif",
                    boxShadow: submitting ? 'none' : '0 4px 16px rgba(212,175,55,0.2)',
                    transition: 'all 150ms ease',
                  }}
                >
                  {submitting
                    ? <><span className="spinner" style={{ borderTopColor: 'var(--text-3)' }}/> Enregistrement…</>
                    : <>{IC.save} {t('expenses.save') || 'Enregistrer la dépense'}</>
                  }
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── KPI strip ── */}
        <div className="kpi-grid">
          {[
            {
              label: t('expenses.totalExpenses') || 'Total dépenses',
              value: formatPrice(totalExpenses, currency, lang),
              color: 'var(--red)', dim: 'var(--red-dim)',
              accent: 'rgba(239,68,68,0.06)',
              icon: IC.dollar,
              sub: 'toutes périodes',
            },
            {
              label: t('expenses.thisMonth') || 'Ce mois',
              value: formatPrice(thisMonth, currency, lang),
              color: 'var(--gold)', dim: 'var(--gold-dim)',
              accent: 'rgba(212,175,55,0.06)',
              icon: IC.cal,
              sub: new Date().toLocaleDateString(locale, { month: 'long', year: 'numeric' }),
            },
            {
              label: t('expenses.categories') || 'Catégories',
              value: String(categoriesCount),
              color: 'var(--green)', dim: 'var(--green-dim)',
              accent: 'rgba(16,185,129,0.06)',
              icon: IC.grid,
              sub: topCat ? `Top : ${catCfg(topCat).label}` : 'Aucune catégorie',
            },
          ].map((s, i) => (
            <div key={i} className="stat-card fade-up" style={{ '--card-accent': s.accent, animationDelay: `${i * 70}ms` } as React.CSSProperties}>
              {/* top gradient line */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${s.color}44, transparent)`, borderRadius: '16px 16px 0 0' }}/>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', lineHeight: 1.4, paddingRight: 8 }}>
                  {s.label}
                </span>
                <div className="icon-box" style={{ background: s.dim, color: s.color, border: `1px solid ${s.color}22`, width: 30, height: 30, borderRadius: 8 }}>
                  {s.icon}
                </div>
              </div>
              <p className="mono" style={{ fontSize: 'clamp(16px, 3.5vw, 22px)', fontWeight: 300, color: s.color, margin: '0 0 5px', lineHeight: 1 }}>
                {s.value}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Two-column layout ── */}
        <div className="exp-columns">

          {/* ── Expense history ── */}
          <div className="sec-card">
            <div className="sec-card-hd">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="icon-box" style={{ background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  {IC.list}
                </div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
                    {t('expenses.expenseHistory') || 'Historique des dépenses'}
                  </h3>
                  {!loading && expenses.length > 0 && (
                    <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '2px 0 0' }}>
                      <span className="mono">{expenses.length}</span> entrée{expenses.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div style={{ maxHeight: 440, overflowY: 'auto' }}>
              {loading ? (
                [1,2,3,4,5].map(i => (
                  <div key={i} className="exp-row" style={{ opacity: 0.25 }}>
                    <div className="sk" style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0 }}/>
                    <div style={{ flex: 1 }}>
                      <div className="sk" style={{ width: '55%', height: 11, marginBottom: 7 }}/>
                      <div className="sk" style={{ width: '38%', height: 9 }}/>
                    </div>
                    <div className="sk" style={{ width: 68, height: 13, borderRadius: 4 }}/>
                  </div>
                ))
              ) : !expenses.length ? (
                <div style={{ padding: '56px 24px', textAlign: 'center' }}>
                  <svg style={{ margin: '0 auto 14px', display: 'block', opacity: 0.25 }} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="1.2">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                  </svg>
                  <p style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                    {t('expenses.noExpenses') || 'Aucune dépense'}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '6px 0 0', opacity: 0.6 }}>
                    Commencez par ajouter une dépense
                  </p>
                </div>
              ) : (
                expenses.map((expense, idx) => {
                  const cc = catCfg(expense.category);
                  return (
                    <div key={expense.id} className="exp-row fade-up" style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}>
                      {/* Category icon */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: cc.dim, border: `1px solid ${cc.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, fontSize: 15,
                      }}>
                        {cc.glyph}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="exp-desc">{expense.description}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span className="cat-badge" style={{ background: cc.dim, color: cc.color, border: `1px solid ${cc.border}` }}>
                            {cc.label}
                          </span>
                          <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>
                            {expense.user_name || 'Système'} · {fmtDate(expense.created_at, lang)}
                          </span>
                        </div>
                      </div>

                      {/* Amount */}
                      <span className="mono exp-amount">
                        -{formatPrice(expense.amount, currency, lang)}
                      </span>

                      {/* Delete (admin) */}
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

          {/* ── Category breakdown ── */}
          <div className="sec-card" style={{ alignSelf: 'start' }}>
            <div className="sec-card-hd">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="icon-box" style={{ background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.15)' }}>
                  {IC.tag}
                </div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
                    Par catégorie
                  </h3>
                  {catList.length > 0 && (
                    <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '2px 0 0' }}>
                      {catList.length} catégorie{catList.length !== 1 ? 's' : ''} actives
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {!catList.length ? (
                <p style={{ fontSize: 12.5, color: 'var(--text-3)', textAlign: 'center', padding: '28px 0', margin: 0 }}>
                  Aucune donnée disponible
                </p>
              ) : catList.map(([cat, total], i) => {
                const cc  = catCfg(cat);
                const pct = totalExpenses > 0 ? Math.round((total / totalExpenses) * 100) : 0;
                return (
                  <div key={cat} className="fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ fontSize: 14 }}>{cc.glyph}</span>
                        <span className="cat-badge" style={{ background: cc.dim, color: cc.color, border: `1px solid ${cc.border}` }}>
                          {cc.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-1)' }}>
                          {formatPrice(total, currency, lang)}
                        </span>
                        <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', minWidth: 28, textAlign: 'right' }}>
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <div className="prog-bar">
                      <div
                        className="prog-fill"
                        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${cc.color}bb, ${cc.color})` }}
                      />
                    </div>
                  </div>
                );
              })}

              {/* Total recap */}
              {catList.length > 0 && (
                <div style={{ marginTop: 4, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total</span>
                  <span className="mono" style={{ fontSize: 17, fontWeight: 600, color: 'var(--red)' }}>
                    {formatPrice(totalExpenses, currency, lang)}
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ExpensesPage;