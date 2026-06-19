import React, { useState } from 'react';
import { api } from '../../lib/api-client';
import { useAuthStore } from '../../stores/useAuthStore';
import { useI18n } from '../../lib/i18n';
import type { UserRole } from '../../lib/permissions';

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface User {
  id: number;
  full_name: string;
  username: string;
  phone: string;
  email?: string | null;
  role: UserRole;
  is_active: number;
  created_at: string;
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@300;400;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; }

  .up-root {
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
    --gold-glow:   rgba(212,175,55,0.18);
    font-family: 'DM Sans', sans-serif;
    color: var(--text-1);
    background: var(--bg);
    min-height: 100vh;
  }

  /* ── Inner ── */
  .up-inner {
    max-width: 1100px;
    margin: 0 auto;
    padding: 36px 24px 60px;
  }
  @media (max-width: 768px) { .up-inner { padding: 24px 16px 48px; } }
  @media (max-width: 480px) { .up-inner { padding: 16px 12px 40px; } }

  /* ── Page header ── */
  .up-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 28px;
    flex-wrap: wrap;
    gap: 16px;
  }
  @media (max-width: 560px) {
    .up-header { flex-direction: column; align-items: stretch; margin-bottom: 20px; }
    .up-header-cta { width: 100%; justify-content: center; }
  }

  /* ── KPI grid ── */
  .up-kpi-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 20px;
  }
  @media (max-width: 560px) { .up-kpi-grid { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 360px) { .up-kpi-grid { grid-template-columns: 1fr; } }
  @media (max-width: 560px) {
    .up-kpi-grid .kpi-last { grid-column: 1 / -1; }
  }

  /* ── KPI card ── */
  .up-kpi {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 16px 18px;
    position: relative;
    overflow: hidden;
    transition: border-color 180ms ease, transform 160ms ease, box-shadow 160ms ease;
  }
  .up-kpi:hover { border-color: var(--border-hi); transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,0,0,0.3); }
  @media (max-width: 480px) { .up-kpi { padding: 13px 15px; border-radius: 14px; } .up-kpi:hover { transform: none; } }

  /* ── Table container ── */
  .up-table-wrap {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    overflow: hidden;
  }
  @media (max-width: 640px) { .up-table-wrap { border-radius: 14px; } }

  /* ── Desktop table row ── */
  .up-row {
    display: flex;
    align-items: center;
    padding: 0 20px;
    height: 68px;
    border-bottom: 1px solid var(--border);
    transition: background 120ms ease;
  }
  .up-row:last-child { border-bottom: none; }
  .up-row:hover { background: rgba(255,255,255,0.013); }
  .up-row:hover .up-row-actions { opacity: 1; transform: translateX(0); }
  @media (max-width: 480px) { .up-row { display: none; } }

  /* ── Header row ── */
  .up-row-hd {
    height: 40px;
    background: rgba(255,255,255,0.018);
    border-bottom: 1px solid var(--border);
    cursor: default;
  }
  .up-row-hd:hover { background: rgba(255,255,255,0.018); }
  @media (max-width: 480px) { .up-row-hd { display: none; } }

  /* ── Mobile user cards (< 480px) ── */
  .up-card-list { display: none; }
  @media (max-width: 480px) { .up-card-list { display: flex; flex-direction: column; gap: 1px; } }

  .up-card-item {
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 10px;
    transition: background 120ms ease;
  }
  .up-card-item:last-child { border-bottom: none; }
  .up-card-item:hover { background: rgba(255,255,255,0.013); }

  .up-card-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  /* ── Tablet: hide less important columns ── */
  @media (max-width: 768px) { .col-email { display: none; } }

  /* ── Actions fade + slide ── */
  .up-row-actions {
    opacity: 0;
    transform: translateX(4px);
    transition: opacity 150ms ease, transform 150ms ease;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* ── Avatar ── */
  .up-avatar {
    width: 38px; height: 38px;
    border-radius: 11px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    border: 1px solid;
    transition: all 160ms ease;
  }
  .up-avatar-sm {
    width: 34px; height: 34px;
    border-radius: 10px;
  }

  /* ── Icon button ── */
  .icon-btn {
    width: 30px; height: 30px;
    border-radius: 8px;
    border: 1px solid transparent;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: all 130ms ease;
    flex-shrink: 0;
  }
  .icon-btn:hover { filter: brightness(1.2); }
  .icon-btn:active { transform: scale(0.9); }

  /* ── Status pill ── */
  .status-btn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 4px 11px; border-radius: 20px; border: 1px solid;
    font-size: 10px; font-weight: 700; cursor: pointer;
    transition: all 130ms ease; font-family: 'DM Sans', sans-serif;
    white-space: nowrap; text-transform: uppercase; letter-spacing: 0.05em;
  }
  .status-btn:active { transform: scale(0.95); }

  /* ── Role badge ── */
  .role-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 4px 10px; border-radius: 20px;
    font-size: 10px; font-weight: 700; letter-spacing: 0.04em;
    text-transform: uppercase; white-space: nowrap;
  }

  /* ── Field ── */
  .up-field {
    width: 100%; padding: 11px 13px;
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 10px; color: var(--text-1);
    font-size: 13px; font-family: 'DM Sans', sans-serif;
    outline: none; transition: border-color 140ms ease, box-shadow 140ms ease;
    color-scheme: dark;
  }
  .up-field::placeholder { color: var(--text-3); }
  .up-field:focus { border-color: var(--gold); box-shadow: 0 0 0 3px var(--gold-glow); }
  .up-field option { background: #16161f; }

  /* ── Field label ── */
  .up-lbl {
    display: block; font-size: 9.5px; font-weight: 700;
    color: rgba(212,175,55,0.55); text-transform: uppercase;
    letter-spacing: 0.14em; margin-bottom: 7px;
  }

  /* ── Form grid ── */
  .form-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 480px) { .form-2col { grid-template-columns: 1fr; } }

  /* ── Modal ── */
  .up-modal {
    position: fixed; inset: 0; z-index: 60;
    background: rgba(0,0,0,0.88);
    backdrop-filter: blur(12px);
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
  }
  @media (max-width: 540px) {
    .up-modal { padding: 0; align-items: flex-end; }
    .modal-card { border-radius: 24px 24px 0 0 !important; max-height: 94vh; overflow-y: auto; }
  }

  /* ── Modal card ── */
  @keyframes modal-in { from{opacity:0;transform:translateY(20px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes modal-in-mobile { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
  .modal-card { animation: modal-in 220ms cubic-bezier(.22,1,.36,1) forwards; }
  @media (max-width: 540px) { .modal-card { animation: modal-in-mobile 250ms cubic-bezier(.22,1,.36,1) forwards; } }

  /* ── Skeleton ── */
  @keyframes sk { 0%,100%{opacity:.15} 50%{opacity:.35} }
  .sk { animation: sk 1.6s ease infinite; background: var(--border); border-radius: 4px; }

  /* ── Toast ── */
  @keyframes t-in { from{opacity:0;transform:translateY(-8px) scale(.96)} to{opacity:1;transform:translateY(0) scale(1)} }
  .t-item { animation: t-in 200ms ease forwards; }

  /* ── Fade up ── */
  @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  .fade-up { animation: fadeUp 260ms ease both; }

  /* ── Spinner ── */
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner { width: 13px; height: 13px; border: 2px solid rgba(0,0,0,0.15); border-top-color: #000; border-radius: 50%; display: inline-block; animation: spin 0.6s linear infinite; }

  /* ── Mono ── */
  .mono { font-family: 'JetBrains Mono', monospace; }

  /* ── Scrollbar ── */
  .up-root ::-webkit-scrollbar { width: 3px; }
  .up-root ::-webkit-scrollbar-track { background: transparent; }
  .up-root ::-webkit-scrollbar-thumb { background: var(--border-hi); border-radius: 2px; }
`;

/* ─── Role theme ─────────────────────────────────────────────────────────── */
const ROLE_THEME: Record<string, { color: string; dim: string; border: string; label: string; glyph: string }> = {
  owner:   { color: 'var(--gold)',    dim: 'var(--gold-dim)',    border: 'rgba(212,175,55,0.2)', label: 'Owner',    glyph: '👑' },
  admin:   { color: 'var(--red)',    dim: 'var(--red-dim)',    border: 'rgba(239,68,68,0.2)',  label: 'Admin',    glyph: '🛡️' },
  manager: { color: 'var(--amber)',  dim: 'var(--amber-dim)',  border: 'rgba(245,158,11,0.2)', label: 'Manager',  glyph: '⚙️' },
  cashier: { color: 'var(--green)',  dim: 'var(--green-dim)',  border: 'rgba(16,185,129,0.2)', label: 'Caissier', glyph: '💳' },
  waiter:  { color: 'var(--blue)',   dim: 'var(--blue-dim)',   border: 'rgba(59,130,246,0.2)', label: 'Serveur',  glyph: '🍽️' },
};
const roleDesc: Record<string, string> = {
  owner:   'Propriétaire principal avec tous les droits',
  admin:   'Accès complet au système',
  manager: 'Gestion opérationnelle',
  cashier: 'Opérations de caisse et paiements',
  waiter:  'Prise de commande uniquement',
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

/* ─── Sub-components ─────────────────────────────────────────────────────── */
const TH: React.FC<{ label: string; flex?: number; align?: 'left'|'right'|'center' }> = ({ label, flex=1, align='left' }) => (
  <div style={{ flex, display:'flex', alignItems:'center', padding:'0 8px', justifyContent: align==='right'?'flex-end':align==='center'?'center':'flex-start' }}>
    <span style={{ fontSize:9, fontWeight:800, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.12em' }}>{label}</span>
  </div>
);

const FL: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="up-lbl">{label}</label>
    {children}
  </div>
);

/* ─── SVG Icons ───────────────────────────────────────────────────────────── */
const IC = {
  userPlus: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
  edit:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>,
  trash:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a1 1 0 011-1h2a1 1 0 011 1v2"/></svg>,
  shield:   <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l8 4v6c0 5-4 9.3-8 10C8 21.3 4 17 4 12V6l8-4z"/></svg>,
  check:    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>,
  x:        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  phone:    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.77 9.78 19.79 19.79 0 01.7 1.15 2 2 0 012.68 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.09a16 16 0 006 6l1.06-1.06a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.3v2.62z"/></svg>,
  lock:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  close:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  save:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  mail:     <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>,
  users:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  active:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
};

/* ════════════════════════════════════════════════════════════════════════════ */
const UsersPage = () => {
  const { user }  = useAuthStore();
  const { t }     = useI18n();
  const [users,   setUsers]   = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState<{ type:'success'|'error'; msg:string } | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [formData,    setFormData]    = useState({
    full_name: '', username: '', phone: '', email: '' as string,
    pin_code: '', role: 'waiter' as UserRole,
  });

  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  React.useEffect(() => {
    const id = 'up-styles-v2';
    if (!document.getElementById(id)) {
      const s = document.createElement('style'); s.id = id; s.textContent = STYLES;
      document.head.appendChild(s);
    }
  }, []);

  const showToast = (type: 'success'|'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.users.getAll(user?.role) as any;
      if (Array.isArray(data)) { setUsers(data as User[]); return; }
      if (data && Array.isArray(data.users)) { setUsers(data.users as User[]); return; }
    } catch (err: any) {
      showToast('error', err?.message || t('common.error'));
    } finally { setLoading(false); }
  };

  React.useEffect(() => { fetchUsers(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const emailValue = formData.email?.trim() || null;
      if (!editingUser) {
        if (!emailValue) { showToast('error', 'L\'email est obligatoire'); setSubmitting(false); return; }
        if (!emailValue.includes('@')) { showToast('error', 'Veuillez entrer un email valide'); setSubmitting(false); return; }
      }
      const payload: any = { ...formData, pin_code: formData.pin_code?.trim() ? formData.pin_code.trim() : null };
      if (emailValue) payload.email = emailValue;
      else if (!editingUser) payload.email = null;
      else delete payload.email;

      if (editingUser) {
        await api.users.update(editingUser.id!, payload, user?.role);
        showToast('success', 'Utilisateur mis à jour');
      } else {
        await api.users.create(payload, user?.role);
        showToast('success', 'Utilisateur créé avec succès');
      }
      setIsModalOpen(false);
      setEditingUser(null);
      setFormData({ full_name:'', username:'', phone:'', email:'', pin_code:'', role:'waiter' });
      fetchUsers();
    } catch (err: any) {
      showToast('error', err.message || t('common.error'));
    } finally { setSubmitting(false); }
  };

  const toggleStatus = async (u: User) => {
    try {
      await api.users.update(u.id, { is_active: u.is_active ? 0 : 1 }, user?.role);
      showToast('success', u.is_active ? 'Compte désactivé' : 'Compte activé');
      fetchUsers();
    } catch { showToast('error', 'Impossible de changer le statut'); }
  };

  const requestDeleteUser = (id: number) => {
    setDeleteTargetId(id);
  };

  const confirmDeleteUser = async () => {
    if (!deleteTargetId) return;
    setDeleteSubmitting(true);
    try {
      await api.users.delete(deleteTargetId, user?.role);
      showToast('success', 'Utilisateur supprimé');
      setDeleteTargetId(null);
      fetchUsers();
    } catch {
      showToast('error', t('users.failedDeleteUser'));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const openCreate = () => {
    setEditingUser(null);
    setFormData({ full_name:'', username:'', phone:'', email:'', pin_code:'', role:'waiter' as UserRole });
    setIsModalOpen(true);
  };
  const openEdit = (u: User) => {
    setEditingUser(u);
    setFormData({ full_name:u.full_name, username:u.username, phone:u.phone||'', email:u.email??'', pin_code:(u as any).pin_code??'', role:u.role as UserRole });
    setIsModalOpen(true);
  };

  const activeCount = users.filter(u => u.is_active).length;
  const adminCount = users.filter(u => u.role === 'admin').length;
  const ownerCount = users.filter(u => u.role === 'owner').length;

  /* ════════════════════════════════════════════════════════════════════ */
  return (
    <div className="up-root">

      {/* ── Toast ── */}
      {toast && (
        <div className="t-item" style={{
          position:'fixed', top:16, right:16, zIndex:9999,
          padding:'11px 18px', borderRadius:12, fontSize:13, fontWeight:500,
          boxShadow:'0 12px 32px rgba(0,0,0,0.5)',
          background: toast.type==='success' ? 'rgba(6,78,59,0.95)' : 'rgba(69,10,10,0.95)',
          border:`1px solid ${toast.type==='success' ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
          color: toast.type==='success' ? '#6ee7b7' : '#fca5a5',
          display:'flex', alignItems:'center', gap:10,
          backdropFilter:'blur(8px)', maxWidth:'calc(100vw - 32px)',
        }}>
          {toast.type==='success'
            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
          }
          {toast.msg}
        </div>
      )}

      <div className="up-inner">

        {/* ── Page header ── */}
        <div className="up-header">
          <div>
            <p style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.12em', margin:'0 0 6px' }}>
              Administration
            </p>
            <h1 style={{ fontSize:'clamp(20px,5vw,26px)', fontWeight:300, color:'var(--text-1)', margin:'0 0 6px', letterSpacing:'-0.01em' }}>
              {t('users.management') || 'Gestion du personnel'}
            </h1>
            <p style={{ fontSize:13, color:'var(--text-2)', margin:0 }}>
              {t('users.systemAccess') || 'Accès et permissions système'}
            </p>
          </div>

          <button
            className="up-header-cta"
            onClick={openCreate}
            style={{
              display:'flex', alignItems:'center', gap:8, padding:'11px 22px',
              background:'var(--gold)', color:'#09090f', border:'1px solid transparent',
              borderRadius:12, fontSize:13.5, fontWeight:700, cursor:'pointer',
              fontFamily:"'DM Sans',sans-serif",
              boxShadow:'0 4px 20px rgba(212,175,55,0.25)',
              transition:'all 180ms ease',
            }}
          >
            {IC.userPlus}
            {t('users.addUser') || 'Ajouter un utilisateur'}
          </button>
        </div>

        {/* ── KPI strip ── */}
        <div className="up-kpi-grid">
{[
             { label:'Membres total',   value:users.length,  color:'var(--blue)',  dim:'var(--blue-dim)',  border:'rgba(59,130,246,0.2)',  icon:IC.users,  cls:'' },
             { label:'Comptes actifs',  value:activeCount,   color:'var(--green)', dim:'var(--green-dim)', border:'rgba(16,185,129,0.2)',  icon:IC.active, cls:'' },
             { label:'Propriétaires/Admins', value:ownerCount + adminCount, color:'var(--gold)', dim:'var(--gold-dim)', border:'rgba(212,175,55,0.2)', icon:IC.shield, cls:'kpi-last' },
           ].map((s, i) => (
            <div key={i} className={`up-kpi fade-up ${s.cls}`} style={{ animationDelay:`${i*60}ms` }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, ${s.color}50, transparent)`, borderRadius:'16px 16px 0 0' }}/>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
                <span style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em', lineHeight:1.4, paddingRight:8 }}>
                  {s.label}
                </span>
                <div style={{ width:30, height:30, borderRadius:9, background:s.dim, border:`1px solid ${s.border}`, display:'flex', alignItems:'center', justifyContent:'center', color:s.color, flexShrink:0 }}>
                  {s.icon}
                </div>
              </div>
              <p className="mono" style={{ fontSize:'clamp(22px,4vw,28px)', fontWeight:300, color:'var(--text-1)', margin:0, lineHeight:1 }}>
                {loading ? <span className="sk" style={{ width:40, height:26, display:'inline-block', borderRadius:5 }}/> : s.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Table ── */}
        <div className="up-table-wrap">

          {/* Desktop header */}
          <div className="up-row up-row-hd">
            <TH label="Membre"  flex={2.2} />
            <TH label="Email"   flex={1.8} />
            <TH label="Rôle"    flex={1}   align="center" />
            <TH label="Statut"  flex={1}   align="center" />
            <TH label=""        flex={0.7} />
          </div>

          {/* Desktop rows (hidden < 480px) */}
          {loading ? (
            [1,2,3,4,5].map(i => (
              <div key={i} className="up-row" style={{ opacity:0.25 }}>
                <div style={{ flex:2.2, padding:'0 8px', display:'flex', alignItems:'center', gap:10 }}>
                  <div className="sk" style={{ width:38, height:38, borderRadius:11, flexShrink:0 }}/>
                  <div><div className="sk" style={{ width:120, height:12, marginBottom:6 }}/><div className="sk" style={{ width:80, height:10 }}/></div>
                </div>
                <div style={{ flex:1.8, padding:'0 8px' }}><div className="sk" style={{ width:130, height:11 }}/></div>
                <div style={{ flex:1, padding:'0 8px', display:'flex', justifyContent:'center' }}><div className="sk" style={{ width:72, height:22, borderRadius:20 }}/></div>
                <div style={{ flex:1, padding:'0 8px', display:'flex', justifyContent:'center' }}><div className="sk" style={{ width:70, height:22, borderRadius:20 }}/></div>
                <div style={{ flex:0.7 }}/>
              </div>
            ))
          ) : !users.length ? (
            <div style={{ padding:'60px 24px', textAlign:'center' }}>
              <svg style={{ margin:'0 auto 14px', display:'block', opacity:0.2 }} width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-1)" strokeWidth="1.2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              </svg>
              <p style={{ fontSize:13, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', margin:0 }}>Aucun utilisateur</p>
              <p style={{ fontSize:12, color:'var(--text-3)', margin:'6px 0 0', opacity:0.6 }}>Commencez par créer un compte</p>
            </div>
          ) : (
            users.map((u, idx) => {
              const rt = ROLE_THEME[u.role] || ROLE_THEME.waiter;
              const initials = getInitials(u.full_name || u.username || String(u.id));
              return (
                <div key={u.id} className="up-row fade-up" style={{ animationDelay:`${Math.min(idx,8)*40}ms` }}>

                  {/* Member info */}
                  <div style={{ flex:2.2, padding:'0 8px', display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                    <div className="up-avatar" style={{ background:rt.dim, color:rt.color, borderColor:`${rt.color}28` }}>
                      {initials}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <p style={{ fontSize:13.5, fontWeight:600, color:'var(--text-1)', margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {u.full_name}
                      </p>
                      <p style={{ fontSize:11, color:'var(--text-3)', margin:0, display:'flex', alignItems:'center', gap:4 }}>
                        {IC.phone} {u.phone || '—'}
                      </p>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="col-email" style={{ flex:1.8, padding:'0 8px', minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ color:'var(--text-3)', flexShrink:0 }}>{IC.mail}</span>
                      <span style={{ fontSize:12, color:'var(--text-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {u.email || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Role */}
                  <div style={{ flex:1, padding:'0 8px', display:'flex', justifyContent:'center' }}>
                    <span className="role-badge" style={{ background:rt.dim, color:rt.color, border:`1px solid ${rt.border}` }}>
                      {IC.shield} {rt.label}
                    </span>
                  </div>

                  {/* Status */}
                  <div style={{ flex:1, padding:'0 8px', display:'flex', justifyContent:'center' }}>
                    <button className="status-btn" onClick={() => toggleStatus(u)} style={{
                      background: u.is_active ? 'var(--green-dim)' : 'var(--red-dim)',
                      borderColor: u.is_active ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)',
                      color: u.is_active ? 'var(--green)' : 'var(--red)',
                    }}>
                      {u.is_active ? IC.check : IC.x}
                      {u.is_active ? (t('users.active') || 'Actif') : (t('users.inactive') || 'Inactif')}
                    </button>
                  </div>

                  {/* Actions */}
                  <div style={{ flex:0.7, padding:'0 8px', display:'flex', justifyContent:'flex-end' }} className="up-row-actions">
                    <button className="icon-btn" title="Modifier" onClick={() => openEdit(u)}
                      style={{ background:'var(--blue-dim)', color:'var(--blue)', borderColor:'rgba(59,130,246,0.18)' }}>
                      {IC.edit}
                    </button>
                    <button className="icon-btn" title="Supprimer" onClick={() => requestDeleteUser(u.id)}
                      style={{ background:'var(--red-dim)', color:'var(--red)', borderColor:'rgba(239,68,68,0.18)' }}>
                      {IC.trash}
                    </button>
                  </div>

                </div>
              );
            })
          )}

          {/* ── Mobile card list (< 480px) ── */}
          <div className="up-card-list">
            {loading ? (
              [1,2,3].map(i => (
                <div key={i} className="up-card-item" style={{ opacity:0.25 }}>
                  <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                    <div className="sk" style={{ width:34, height:34, borderRadius:10, flexShrink:0 }}/>
                    <div style={{ flex:1 }}>
                      <div className="sk" style={{ width:'60%', height:12, marginBottom:7 }}/>
                      <div className="sk" style={{ width:'40%', height:10 }}/>
                    </div>
                  </div>
                </div>
              ))
            ) : users.map((u, idx) => {
              const rt = ROLE_THEME[u.role] || ROLE_THEME.waiter;
              const initials = getInitials(u.full_name || u.username || String(u.id));
              return (
                <div key={u.id} className="up-card-item fade-up" style={{ animationDelay:`${Math.min(idx,6)*50}ms` }}>
                  {/* Top row: avatar + name + actions */}
                  <div className="up-card-row">
                    <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                      <div className={`up-avatar up-avatar-sm`} style={{ background:rt.dim, color:rt.color, borderColor:`${rt.color}28` }}>
                        {initials}
                      </div>
                      <div style={{ minWidth:0 }}>
                        <p style={{ fontSize:13.5, fontWeight:600, color:'var(--text-1)', margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {u.full_name}
                        </p>
                        <p style={{ fontSize:11, color:'var(--text-3)', margin:0 }}>
                          {u.phone || u.email || '—'}
                        </p>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                      <button className="icon-btn" title="Modifier" onClick={() => openEdit(u)}
                        style={{ background:'var(--blue-dim)', color:'var(--blue)', borderColor:'rgba(59,130,246,0.18)' }}>
                        {IC.edit}
                      </button>
                      <button className="icon-btn" title="Supprimer" onClick={() => requestDeleteUser(u.id)}
                        style={{ background:'var(--red-dim)', color:'var(--red)', borderColor:'rgba(239,68,68,0.18)' }}>
                        {IC.trash}
                      </button>
                    </div>
                  </div>

                  {/* Bottom row: role + status */}
                  <div className="up-card-row">
                    <span className="role-badge" style={{ background:rt.dim, color:rt.color, border:`1px solid ${rt.border}` }}>
                      {rt.glyph} {rt.label}
                    </span>
                    <button className="status-btn" onClick={() => toggleStatus(u)} style={{
                      background: u.is_active ? 'var(--green-dim)' : 'var(--red-dim)',
                      borderColor: u.is_active ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)',
                      color: u.is_active ? 'var(--green)' : 'var(--red)',
                    }}>
                      {u.is_active ? IC.check : IC.x}
                      {u.is_active ? 'Actif' : 'Inactif'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer count */}
        {!loading && users.length > 0 && (
          <p style={{ marginTop:10, fontSize:11.5, color:'var(--text-3)', textAlign:'right' }}>
            <span className="mono">{users.length}</span> membre{users.length!==1?'s':''} ·{' '}
            <span style={{ color:'var(--green)' }}>
              <span className="mono">{activeCount}</span> actif{activeCount!==1?'s':''}
            </span>
          </p>
        )}
      </div>

      {/* ════════ MODAL (Créer/Modifier) ════════ */}
      {deleteTargetId !== null && (
        <div
          className="up-modal"
          style={{ zIndex: 70 }}
          onClick={e => e.target === e.currentTarget && !deleteSubmitting && setDeleteTargetId(null)}
        >
          <div
            className="modal-card"
            style={{
              background:'var(--surface)', borderRadius:20, width:'100%', maxWidth:480,
              border:'1px solid var(--border)', boxShadow:'0 40px 80px rgba(0,0,0,0.6)',
              overflow:'hidden', position:'relative',
            }}
          >
            <div style={{ height:2, background:'linear-gradient(90deg, transparent, rgba(239,68,68,0.9) 40%, transparent)' }}/>
            <div style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'18px 24px', borderBottom:'1px solid var(--border)',
              background:'linear-gradient(to right, rgba(239,68,68,0.05), transparent)'
            }}>
              <div>
                <h2 style={{ fontSize:15, fontWeight:800, color:'var(--text-1)', margin:0 }}>
                  Confirmer la suppression
                </h2>
                <p style={{ fontSize:11.5, color:'var(--text-3)', margin:'3px 0 0' }}>
                  {t('users.deleteConfirm') || 'Êtes-vous sûr de vouloir supprimer cet utilisateur ?'}
                </p>
              </div>

              <button
                onClick={() => !deleteSubmitting && setDeleteTargetId(null)}
                style={{
                  width:32, height:32, borderRadius:9, background:'var(--card)',
                  border:'1px solid var(--border)', color:'var(--text-2)',
                  cursor:'pointer', display:'flex', alignItems:'center',
                  justifyContent:'center', transition:'all 130ms ease', flexShrink:0
                }}
                aria-label="Close"
              >
                {IC.close}
              </button>
            </div>

            <div style={{ padding:'18px 24px 22px', display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{
                padding:'12px 14px',
                border:'1px solid rgba(239,68,68,0.25)',
                background:'rgba(239,68,68,0.06)',
                borderRadius:14,
                display:'flex', alignItems:'flex-start', gap:12,
              }}>
                <div style={{
                  width:32, height:32, borderRadius:12,
                  background:'rgba(239,68,68,0.15)',
                  border:'1px solid rgba(239,68,68,0.25)',
                  color:'var(--red)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  flexShrink:0
                }}>
                  {IC.trash}
                </div>
                <div>
                  <p style={{ margin:0, fontSize:13.5, fontWeight:800, color:'var(--text-1)' }}>
                    Action irréversible
                  </p>
                  <p style={{ margin:'4px 0 0', fontSize:12, color:'var(--text-3)', lineHeight:1.5 }}>
                    L’utilisateur sera supprimé de la liste. Cette action nécessite une confirmation.
                  </p>
                </div>
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <button
                  type="button"
                  onClick={() => !deleteSubmitting && setDeleteTargetId(null)}
                  style={{
                    flex:1,
                    padding:'10px 16px',
                    background:'var(--card)',
                    border:'1px solid var(--border)',
                    color:'var(--text-2)',
                    borderRadius:10,
                    fontSize:13,
                    cursor:'pointer',
                    fontFamily:"'DM Sans',sans-serif",
                    fontWeight:700,
                  }}
                  disabled={deleteSubmitting}
                >
                  Annuler
                </button>

                <button
                  type="button"
                  onClick={confirmDeleteUser}
                  disabled={deleteSubmitting}
                  style={{
                    flex:1,
                    display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                    padding:'10px 0',
                    background: deleteSubmitting ? 'var(--border)' : 'rgba(239,68,68,0.95)',
                    color: deleteSubmitting ? 'var(--text-3)' : '#fff',
                    border:'none', borderRadius:10, fontSize:13.5,
                    fontWeight:800,
                    cursor: deleteSubmitting ? 'not-allowed' : 'pointer',
                    fontFamily:"'DM Sans',sans-serif",
                    boxShadow: deleteSubmitting ? 'none' : '0 10px 28px rgba(239,68,68,0.22)',
                    transition:'all 150ms ease',
                  }}
                >
                  {deleteSubmitting ? (
                    <>
                      <span className="spinner" style={{ borderTopColor:'#fff' }} />
                      Suppression…
                    </>
                  ) : (
                    <>
                      {IC.trash}
                      Supprimer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="up-modal" onClick={e => e.target===e.currentTarget && !submitting && setIsModalOpen(false)}>
          <div className="modal-card" style={{
            background:'var(--surface)', borderRadius:20, width:'100%', maxWidth:480,
            border:'1px solid var(--border)', boxShadow:'0 40px 80px rgba(0,0,0,0.6)',
            overflow:'hidden', position:'relative',
          }}>
            {/* Gold accent line */}
            <div style={{ height:2, background:'linear-gradient(90deg, transparent, var(--gold) 40%, transparent)' }}/>

            {/* Modal header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 24px', borderBottom:'1px solid var(--border)', background:'linear-gradient(to right, rgba(212,175,55,0.03), transparent)' }}>
              <div>
                <h2 style={{ fontSize:15, fontWeight:700, color:'var(--text-1)', margin:0 }}>
                  {editingUser ? 'Modifier l\'utilisateur' : 'Nouveau membre'}
                </h2>
                <p style={{ fontSize:11.5, color:'var(--text-3)', margin:'3px 0 0' }}>
                  {editingUser ? `Modification de ${editingUser.full_name}` : 'Ajouter un membre au personnel'}
                </p>
              </div>
              <button
                onClick={() => !submitting && setIsModalOpen(false)}
                style={{ width:32, height:32, borderRadius:9, background:'var(--card)', border:'1px solid var(--border)', color:'var(--text-2)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 130ms ease', flexShrink:0 }}
              >
                {IC.close}
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ padding:'22px 24px', display:'flex', flexDirection:'column', gap:16 }}>

              <FL label="Nom complet">
                <input className="up-field" required type="text" placeholder="Jean Dupont"
                  value={formData.full_name}
                  onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))}/>
              </FL>

              <div className="form-2col">
                <FL label="Nom d'utilisateur">
                  <input className="up-field" required type="text" placeholder="jdupont"
                    value={formData.username}
                    onChange={e => setFormData(p => ({ ...p, username: e.target.value }))}/>
                </FL>
                <FL label="Rôle">
<select className="up-field" value={formData.role}
                     onChange={e => setFormData(p => ({ ...p, role: e.target.value as UserRole }))}>
                     <option value="waiter">Serveur</option>
                     <option value="cashier">Caissier</option>
                     <option value="manager">Manager</option>
                     <option value="admin">Admin</option>
                     <option value="owner">Owner</option>
                   </select>
                </FL>
              </div>

              <div className="form-2col">
                <FL label={`Code PIN${editingUser ? ' — laisser vide' : ' *'}`}>
                  <div style={{ position:'relative' }}>
                    <input className="up-field" type="password" maxLength={4}
                      required={!editingUser}
                      value={formData.pin_code} placeholder="••••"
                      style={{ textAlign:'center', letterSpacing:'0.5em', paddingLeft:40 }}
                      onChange={e => setFormData(p => ({ ...p, pin_code: e.target.value }))}/>
                    <div style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)', pointerEvents:'none' }}>
                      {IC.lock}
                    </div>
                  </div>
                </FL>
                <FL label="Téléphone">
                  <input className="up-field" type="tel" placeholder="+260 97 123 4567"
                    value={formData.phone}
                    onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}/>
                </FL>
              </div>

              <FL label="Email *">
                <input className="up-field" type="email" placeholder="user@example.com"
                  value={formData.email} required
                  onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}/>
                {!formData.email?.trim() && (
                  <p style={{ fontSize:11, color:'var(--red)', margin:'5px 0 0' }}>L'email est obligatoire</p>
                )}
                {formData.email?.trim() && !formData.email.includes('@') && (
                  <p style={{ fontSize:11, color:'var(--red)', margin:'5px 0 0' }}>Format d'email invalide</p>
                )}
              </FL>

              {/* Role preview */}
              {(() => {
                const rt = ROLE_THEME[formData.role] || ROLE_THEME.waiter;
                return (
                  <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:rt.dim, border:`1px solid ${rt.border}`, borderRadius:10 }}>
                    <span style={{ fontSize:18 }}>{rt.glyph}</span>
                    <div>
                      <p style={{ fontSize:12.5, color:rt.color, margin:0, fontWeight:700 }}>{rt.label}</p>
                      <p style={{ fontSize:11, color:rt.color, margin:'2px 0 0', opacity:0.7 }}>{roleDesc[formData.role]}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Actions */}
              <div style={{ display:'flex', gap:8, paddingTop:4 }}>
                <button type="button" onClick={() => !submitting && setIsModalOpen(false)}
                  style={{ padding:'10px 20px', background:'var(--card)', border:'1px solid var(--border)', color:'var(--text-2)', borderRadius:10, fontSize:13, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", fontWeight:600 }}>
                  Annuler
                </button>
                <button type="submit" disabled={submitting} style={{
                  flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  padding:'10px 0',
                  background: submitting ? 'var(--border)' : 'var(--gold)',
                  color: submitting ? 'var(--text-3)' : '#09090f',
                  border:'none', borderRadius:10, fontSize:13.5, fontWeight:700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily:"'DM Sans',sans-serif",
                  boxShadow: submitting ? 'none' : '0 4px 16px rgba(212,175,55,0.2)',
                  transition:'all 150ms ease',
                }}>
                  {submitting
                    ? <><span className="spinner" style={{ borderTopColor:'var(--text-3)' }}/> Enregistrement…</>
                    : <>{IC.save} {editingUser ? 'Sauvegarder' : 'Créer le compte'}</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;