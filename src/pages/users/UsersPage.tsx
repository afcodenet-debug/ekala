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
  .up-root {
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
    --indigo:      #6366f1;
    --indigo-dim:  rgba(99,102,241,0.08);
    --gold:        #d4af37;
    --gold-dim:    rgba(212,175,55,0.08);
    font-family: 'DM Sans', sans-serif;
    color: var(--text-1);
    background: var(--bg);
    min-height: 100vh;
  }
  .up-root * { box-sizing: border-box; }

  /* ── table row ── */
  .up-row {
    display: flex; align-items: center;
    padding: 0 20px; height: 64px;
    border-bottom: 1px solid var(--border);
    transition: background 120ms ease;
  }
  .up-row:last-child { border-bottom: none; }
  .up-row:hover { background: rgba(255,255,255,0.013); }
  .up-row:hover .up-row-actions { opacity: 1; }

  .up-row-hd {
    height: 38px; background: rgba(255,255,255,0.018);
    border-bottom: 1px solid var(--border); cursor: default;
  }
  .up-row-hd:hover { background: rgba(255,255,255,0.018); }

  /* ── actions fade ── */
  .up-row-actions {
    opacity: 0; transition: opacity 140ms ease;
    display: flex; align-items: center; gap: 6px;
  }

  /* ── avatar ── */
  .up-avatar {
    width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    border: 1px solid;
    transition: all 160ms ease;
  }

  /* ── icon btn ── */
  .icon-btn {
    width: 28px; height: 28px; border-radius: 7px; border: none;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: all 120ms ease;
  }
  .icon-btn:active { transform: scale(0.92); }

  /* ── status toggle ── */
  .status-btn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 4px 10px; border-radius: 20px; border: 1px solid;
    font-size: 10.5px; font-weight: 600; cursor: pointer;
    transition: all 130ms ease; font-family: 'DM Sans', sans-serif;
    white-space: nowrap;
  }
  .status-btn:active { transform: scale(0.95); }

  /* ── field ── */
  .up-field {
    width: 100%; padding: 10px 13px;
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 9px; color: var(--text-1);
    font-size: 13px; font-family: 'DM Sans', sans-serif;
    outline: none; transition: border-color 140ms ease; color-scheme: dark;
  }
  .up-field::placeholder { color: var(--text-3); }
  .up-field:focus { border-color: var(--gold); }
  .up-field option { background: #16161f; }

  /* ── field label ── */
  .up-lbl {
    display: block; font-size: 10px; font-weight: 700;
    color: rgba(212,175,55,0.6); text-transform: uppercase;
    letter-spacing: 0.14em; margin-bottom: 6px;
  }

  /* ── modal ── */
  .up-modal {
    position: fixed; inset: 0; z-index: 60;
    background: rgba(0,0,0,0.85); backdrop-filter: blur(12px);
    display: flex; align-items: center; justify-content: center; padding: 16px;
  }

  /* ── mono ── */
  .mono { font-family: 'JetBrains Mono', monospace; }

  /* ── skeleton ── */
  @keyframes sk { 0%,100%{opacity:.2} 50%{opacity:.45} }
  .sk { animation: sk 1.5s ease infinite; background: var(--border); border-radius: 4px; }

  /* ── toast ── */
  @keyframes t-in { from{opacity:0;transform:translateX(10px)} to{opacity:1;transform:translateX(0)} }
  .t-item { animation: t-in 180ms ease forwards; }

  /* ── spinner ── */
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── modal slide in ── */
  @keyframes modal-in { from{opacity:0;transform:translateY(16px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
  .modal-card { animation: modal-in 200ms cubic-bezier(.22,1,.36,1) forwards; }

  /* ── scrollbar ── */
  .up-root ::-webkit-scrollbar { width: 3px; }
  .up-root ::-webkit-scrollbar-track { background: transparent; }
  .up-root ::-webkit-scrollbar-thumb { background: var(--border-hi); border-radius: 2px; }
`;

/* ─── Role theme ─────────────────────────────────────────────────────────── */
const ROLE_THEME: Record<string, { color: string; dim: string; label: string }> = {
  admin:   { color: 'var(--red)',    dim: 'var(--red-dim)',    label: 'Admin'    },
  manager: { color: 'var(--amber)',  dim: 'var(--amber-dim)',  label: 'Manager'  },
  cashier: { color: 'var(--green)',  dim: 'var(--green-dim)',  label: 'Caissier' },
  waiter:  { color: 'var(--blue)',   dim: 'var(--blue-dim)',   label: 'Serveur'  },
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

/* header cell */
const TH: React.FC<{ label: string; flex?: number; align?: 'left'|'right'|'center' }> = ({ label, flex=1, align='left' }) => (
  <div style={{ flex, display:'flex', alignItems:'center', padding:'0 8px', justifyContent: align==='right'?'flex-end':align==='center'?'center':'flex-start' }}>
    <span style={{ fontSize:9.5, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em' }}>{label}</span>
  </div>
);

/* field label wrapper */
const FL: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="up-lbl">{label}</label>
    {children}
  </div>
);

/* ── Icons (no lucide dependency) ─────────────────────────────────────────── */
const IC = {
  userPlus: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
  edit:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>,
  trash:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a1 1 0 011-1h2a1 1 0 011 1v2"/></svg>,
  shield:   <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l8 4v6c0 5-4 9.3-8 10C8 21.3 4 17 4 12V6l8-4z"/></svg>,
  check:    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>,
  x:        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  user:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  phone:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.77 9.78 19.79 19.79 0 01.7 1.15 2 2 0 012.68 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.09a16 16 0 006 6l1.06-1.06a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.3v2.62z"/></svg>,
  lock:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  close:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  save:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
};

/* ════════════════════════════════════════════════════════════════════════════ */
const UsersPage = () => {
  const { user }  = useAuthStore();
  const { t }     = useI18n();
  const [users,   setUsers]    = useState<User[]>([]);
  const [loading, setLoading]  = useState(true);
  const [toast,   setToast]    = useState<{ type:'success'|'error'; msg:string } | null>(null);

  console.log('UsersPage render');
  console.log('UsersPage mounted (render-time)', { currentUser: user });

  /* modal state */
  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [editingUser,  setEditingUser]  = useState<Partial<User> | null>(null);
  const [submitting,   setSubmitting]   = useState(false);
  const [formData,     setFormData]     = useState({
    full_name: '', username: '', phone: '', email: '' as string,
    pin_code: '', role: 'waiter' as UserRole,
  });

  /* inject styles once */
  React.useEffect(() => {
    const id = 'up-styles';
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
    console.log('fetchUsers called', { currentUserRole: user?.role });

    setLoading(true);
    try {
      console.log('fetchUsers -> calling api.users.getAll');
      const data = await api.users.getAll(user?.role) as any;
      console.log('API response (api.users.getAll):', data);

      // Backend may return either:
      // - { users: [...] }
      // - [...] (legacy)
      if (Array.isArray(data)) {
        setUsers(data as User[]);
        console.log('Users state set from array:', { count: (data as User[]).length });
        return;
      }
      if (data && Array.isArray(data.users)) {
        setUsers(data.users as User[]);
        console.log('Users state set from data.users:', { count: data.users.length });
        return;
      }

      console.warn('fetchUsers: unexpected API response shape', { data });
    } catch (err: any) {
      console.error('fetchUsers failed:', {
        message: err?.message,
        status: err?.status,
        body: err?.body
      });
      showToast('error', err?.message || t('common.error'));
    } finally {
      setLoading(false);
      console.log('fetchUsers finished');
    }
  };

  React.useEffect(() => { fetchUsers(); }, []);

  /* ── submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const emailValue = formData.email?.trim() || null;

      // Email required only on create
      if (!editingUser) {
        if (!emailValue) {
          showToast('error', 'L\'email est obligatoire');
          setSubmitting(false);
          return;
        }
        if (!emailValue.includes('@')) {
          showToast('error', 'Veuillez entrer un email valide');
          setSubmitting(false);
          return;
        }
      }

      const payload: any = {
        ...formData,
        pin_code: formData.pin_code?.trim() ? formData.pin_code.trim() : null,
      };
      // Only include email in payload for updates if user explicitly provided a value (avoid overwriting with null)
      if (emailValue) {
        payload.email = emailValue;
      } else if (!editingUser) {
        payload.email = null;
      } else {
        delete payload.email;
      }

      console.log('UsersPage submit payload', {
        editingUserId: editingUser?.id,
        payload
      });

      if (editingUser) {
        console.log('UsersPage -> api.users.update');
        const resp = await api.users.update(editingUser.id!, payload, user?.role);
        console.log('UsersPage api.users.update response', resp);
        showToast('success', 'Utilisateur mis à jour');
      } else {
        console.log('UsersPage -> api.users.create');
        const resp = await api.users.create(payload, user?.role);
        console.log('UsersPage api.users.create response', resp);
        showToast('success', 'Utilisateur créé');
      }
      setIsModalOpen(false);
      setEditingUser(null);
      setFormData({ full_name:'', username:'', phone:'', email:'', pin_code:'', role:'waiter' });
      fetchUsers();
    } catch (err: any) {
      showToast('error', err.message || t('common.error'));
    } finally { setSubmitting(false); }
  };

  /* ── toggle active ── */
  const toggleStatus = async (u: User) => {
    try {
      await api.users.update(u.id, { is_active: u.is_active ? 0 : 1 }, user?.role);
      showToast('success', u.is_active ? 'Compte désactivé' : 'Compte activé');
      fetchUsers();
    } catch { showToast('error', 'Impossible de changer le statut'); }
  };

  /* ── delete ── */
  const deleteUser = async (id: number) => {
    if (!window.confirm(t('users.deleteConfirm'))) return;
    try {
      await api.users.delete(id, user?.role);
      showToast('success', 'Utilisateur supprimé');
      fetchUsers();
    } catch { showToast('error', t('users.failedDeleteUser')); }
  };

  /* ── open modal ── */
  const openCreate = () => {
    setEditingUser(null);
    setFormData({ full_name:'', username:'', phone:'', email:'', pin_code:'', role:'waiter' as UserRole });
    setIsModalOpen(true);
  };
  const openEdit = (u: User) => {
    setEditingUser(u);
    setFormData({
      full_name: u.full_name,
      username: u.username,
      phone: u.phone || '',
      email: u.email ?? '',
      pin_code: (u as any).pin_code ?? '',
      role: u.role as UserRole,
    });
    setIsModalOpen(true);
  };

  /* ── derived ── */
  const activeCount   = users.filter(u => u.is_active).length;
  const adminCount    = users.filter(u => u.role === 'admin').length;

  /* ════════════════════════════════════════════════════════════════════ */
  return (
    <div className="up-root">

      {/* ── Toast ── */}
      {toast && (
        <div className="t-item" style={{
          position:'fixed', top:16, right:16, zIndex:9999,
          padding:'10px 16px', borderRadius:10, fontSize:13, fontWeight:500,
          boxShadow:'0 8px 24px rgba(0,0,0,0.4)',
          background: toast.type==='success' ? '#064e3b' : '#450a0a',
          border: `1px solid ${toast.type==='success' ? 'var(--green)' : 'var(--red)'}`,
          color:   toast.type==='success' ? '#6ee7b7' : '#fca5a5',
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
              Administration
            </p>
            <h1 style={{ fontSize:26, fontWeight:300, color:'var(--text-1)', margin:'0 0 4px', letterSpacing:'-0.01em' }}>
              {t('users.management') || 'Gestion du personnel'}
            </h1>
            <p style={{ fontSize:13.5, color:'var(--text-2)', margin:0 }}>
              {t('users.systemAccess') || 'Accès et permissions système'}
            </p>
          </div>

          <button onClick={openCreate} style={{
            display:'flex', alignItems:'center', gap:8, padding:'10px 20px',
            background:'var(--gold)', color:'#09090f', border:'none',
            borderRadius:10, fontSize:13.5, fontWeight:700, cursor:'pointer',
            fontFamily:"'DM Sans',sans-serif", transition:'box-shadow 150ms ease',
            boxShadow:'0 0 0 rgba(212,175,55,0)',
          }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.boxShadow='0 0 20px rgba(212,175,55,0.3)'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.boxShadow='0 0 0 rgba(212,175,55,0)'}>
            {IC.userPlus}
            {t('users.addUser') || 'Ajouter un utilisateur'}
          </button>
        </div>

        {/* ── KPI strip ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
          {[
            { label:'Membres total',   value:users.length,   color:'var(--blue)',   dim:'var(--blue-dim)',
              icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg> },
            { label:'Comptes actifs',  value:activeCount,    color:'var(--green)',  dim:'var(--green-dim)',
              icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
            { label:'Administrateurs', value:adminCount,     color:'var(--red)',    dim:'var(--red-dim)',
              icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l8 4v6c0 5-4 9.3-8 10C8 21.3 4 17 4 12V6l8-4z"/></svg> },
          ].map((s, i) => (
            <div key={i} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'16px 18px', position:'relative', overflow:'hidden', transition:'border-color 180ms ease' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:`linear-gradient(90deg, ${s.color}28, transparent)` }}/>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <span style={{ fontSize:10, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em' }}>{s.label}</span>
                <div style={{ width:26, height:26, borderRadius:7, background:s.dim, display:'flex', alignItems:'center', justifyContent:'center', color:s.color }}>{s.icon}</div>
              </div>
              <p className="mono" style={{ fontSize:26, fontWeight:300, color:'var(--text-1)', margin:0, lineHeight:1 }}>
                {loading ? <span className="sk" style={{ width:40, height:26, display:'inline-block', borderRadius:5 }}/> : s.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Table ── */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>

           {/* header */}
           <div className="up-row up-row-hd">
             <TH label="Membre"    flex={2}   />
             <TH label="Email"     flex={1.8} />
             <TH label="Rôle"      flex={1}   align="center" />
             <TH label="Statut"    flex={1}   align="center" />
             <TH label=""          flex={0.8} />
           </div>

          {/* body */}
          {loading ? (
            [1,2,3,4].map(i => (
              <div key={i} className="up-row" style={{ opacity:0.3 }}>
                <div style={{ flex:2, padding:'0 8px', display:'flex', alignItems:'center', gap:10 }}>
                  <div className="sk" style={{ width:36, height:36, borderRadius:10 }}/>
                  <div><div className="sk" style={{ width:110, height:12, marginBottom:5 }}/><div className="sk" style={{ width:80, height:10 }}/></div>
                </div>
                <div style={{ flex:1.2, padding:'0 8px' }}><div className="sk" style={{ width:80, height:22, borderRadius:6 }}/></div>
                <div style={{ flex:1, padding:'0 8px', display:'flex', justifyContent:'center' }}><div className="sk" style={{ width:70, height:22, borderRadius:20 }}/></div>
                <div style={{ flex:1, padding:'0 8px', display:'flex', justifyContent:'center' }}><div className="sk" style={{ width:70, height:22, borderRadius:20 }}/></div>
                <div style={{ flex:0.8 }}/>
              </div>
            ))
          ) : !users.length ? (
            <div style={{ padding:'52px 24px', textAlign:'center' }}>
              <svg style={{ margin:'0 auto 14px', display:'block' }} width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              </svg>
              <p style={{ fontSize:13.5, color:'var(--text-2)' }}>Aucun utilisateur trouvé</p>
            </div>
          ) : (
            users.map(u => {
              const rt = ROLE_THEME[u.role] || ROLE_THEME.waiter;
              const initials = getInitials(u.full_name || u.username || String(u.id));
              return (
                <div key={u.id} className="up-row">

                  {/* member */}
                  <div style={{ flex:2, padding:'0 8px', display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                    <div className="up-avatar" style={{ background:rt.dim, color:rt.color, borderColor:`${rt.color}25` }}>
                      {initials}
                    </div>
                      <div style={{ minWidth:0 }}>
                        <p style={{ fontSize:13.5, fontWeight:600, color:'var(--text-1)', margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {u.full_name}
                        </p>
                        {u.email ? (
                          <p style={{ fontSize:12.5, color:'var(--text-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {u.email}
                          </p>
                        ) : (
                          <p style={{ fontSize:11, color:'var(--text-3)', fontStyle:'italic' }}>—</p>
                        )}
                        <p style={{ fontSize:11, color:'var(--text-3)', margin:0, display:'flex', alignItems:'center', gap:4 }}>
                          {IC.phone} {u.phone}
                        </p>
                      </div>
                  </div>

                  {/* username */}
                  {/* <div style={{ flex:1.2, padding:'0 8px' }}>
                    <span className="mono" style={{ fontSize:12, padding:'3px 9px', borderRadius:6, background:'var(--card)', border:'1px solid var(--border)', color:'var(--gold)' }}>
                      @{u.username || u.id}
                    </span>
                  </div> */}

                  {/* email */}
                    <div style={{ flex:1.8, padding:'0 8px' }}>
                      <span
                        style={{
                          fontSize: 12,
                          color: 'var(--text-2)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'block'
                        }}
                      >
                        {u.email || '—'}
                      </span>
                    </div>

                  {/* role */}
                  <div style={{ flex:1, padding:'0 8px', display:'flex', justifyContent:'center' }}>
                    <span style={{
                      display:'inline-flex', alignItems:'center', gap:5,
                      padding:'4px 10px', borderRadius:20,
                      fontSize:10.5, fontWeight:700, letterSpacing:'0.04em',
                      background:rt.dim, color:rt.color,
                      border:`1px solid ${rt.color}25`,
                    }}>
                      {IC.shield}
                      {rt.label}
                    </span>
                  </div>

                  {/* status */}
                  <div style={{ flex:1, padding:'0 8px', display:'flex', justifyContent:'center' }}>
                    <button className="status-btn" onClick={() => toggleStatus(u)}
                      style={{
                        background: u.is_active ? 'var(--green-dim)' : 'var(--red-dim)',
                        borderColor: u.is_active ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                        color:       u.is_active ? 'var(--green)'          : 'var(--red)',
                      }}>
                      {u.is_active ? IC.check : IC.x}
                      {u.is_active ? (t('users.active') || 'Actif') : (t('users.inactive') || 'Inactif')}
                    </button>
                  </div>

                  {/* actions */}
                  <div style={{ flex:0.8, padding:'0 8px' }} className="up-row-actions">
                    <button className="icon-btn" title="Modifier" onClick={() => openEdit(u)}
                      style={{ background:'var(--blue-dim)', color:'var(--blue)' }}>
                      {IC.edit}
                    </button>
                    <button className="icon-btn" title="Supprimer" onClick={() => deleteUser(u.id)}
                      style={{ background:'var(--red-dim)', color:'var(--red)' }}>
                      {IC.trash}
                    </button>
                  </div>

                </div>
              );
            })
          )}
        </div>

        {/* count */}
        {!loading && users.length > 0 && (
          <p style={{ marginTop:10, fontSize:11.5, color:'var(--text-3)', textAlign:'right' }}>
            <span className="mono">{users.length}</span> membre{users.length!==1?'s':''} ·{' '}
            <span style={{ color:'var(--green)' }}><span className="mono">{activeCount}</span> actif{activeCount!==1?'s':''}</span>
          </p>
        )}
      </div>

      {/* ════════ MODAL ════════ */}
      {isModalOpen && (
        <div className="up-modal" onClick={e => e.target===e.currentTarget && !submitting && setIsModalOpen(false)}>
          <div className="modal-card" style={{
            background:'var(--surface)', borderRadius:20, width:'100%', maxWidth:480,
            border:'1px solid var(--border)', boxShadow:'0 40px 80px rgba(0,0,0,0.6)',
            overflow:'hidden', position:'relative',
          }}>
            {/* gold top line */}
            <div style={{ height:2, background:'linear-gradient(90deg, transparent, var(--gold), transparent)' }}/>

            {/* modal header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 24px', borderBottom:'1px solid var(--border)' }}>
              <div>
                <h2 style={{ fontSize:15, fontWeight:600, color:'var(--text-1)', margin:0 }}>
                  {editingUser ? 'Modifier l\'utilisateur' : 'Nouveau membre'}
                </h2>
                <p style={{ fontSize:11.5, color:'var(--text-3)', margin:'2px 0 0' }}>
                  {editingUser ? `Modification de ${editingUser.full_name}` : 'Ajouter un membre au personnel'}
                </p>
              </div>
              <button onClick={() => !submitting && setIsModalOpen(false)}
                style={{ width:30, height:30, borderRadius:8, background:'var(--card)', border:'1px solid var(--border)', color:'var(--text-2)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {IC.close}
              </button>
            </div>

            {/* form */}
            <form onSubmit={handleSubmit} style={{ padding:'22px 24px', display:'flex', flexDirection:'column', gap:16 }}>

              <FL label="Nom complet">
                <input className="up-field" required type="text" placeholder="Jean Dupont"
                  value={formData.full_name}
                  onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))} />
              </FL>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <FL label="Nom d'utilisateur">
                  <input
                    className="up-field"
                    required
                    type="text"
                    placeholder="jdupont"
                    aria-label="username"
                    value={formData.username}
                    onChange={e => setFormData(p => ({ ...p, username: e.target.value }))}
                  />
                </FL>
                <FL label="Rôle">
                  <select
                    className="up-field"
                    aria-label="role"
                    value={formData.role}
                    onChange={e => setFormData(p => ({ ...p, role: e.target.value as UserRole }))}
                    title="Rôle"
                  >
                    <option value="waiter">Serveur</option>
                    <option value="manager">Manager</option>
                    <option value="cashier">Cashier</option>
                    <option value="admin">Admin</option>
                  </select>
                </FL>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <FL label={`Code PIN (4 chiffres)${editingUser ? ' — laisser vide' : ''}`}>
                  <div style={{ position:'relative' }}>
                    <input
                      className="up-field"
                      type="password"
                      maxLength={4}
                      required={!editingUser}
                      aria-label="pin_code"
                      value={formData.pin_code}
                      placeholder="••••"
                      style={{ textAlign:'center', letterSpacing:'0.5em', paddingLeft:38 }}
                      onChange={e => setFormData(p => ({ ...p, pin_code: e.target.value }))}
                    />
                    <div style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)', pointerEvents:'none' }}>
                      {IC.lock}
                    </div>
                  </div>
                </FL>
                <FL label="Téléphone">
                  <input
                    className="up-field"
                    type="tel"
                    placeholder="+260 97 123 4567"
                    aria-label="phone"
                    value={formData.phone}
                    onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                  />
                </FL>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <FL label="Email *">
                  <input
                    className="up-field"
                    type="email"
                    placeholder="user@example.com"
                    aria-label="email"
                    value={formData.email}
                    onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                    required
                  />
                  {!formData.email?.trim() && (
                    <div style={{ fontSize:11, color:'#e11d48', marginTop:4 }}>
                      L'email est obligatoire
                    </div>
                  )}
                  {formData.email?.trim() && !formData.email.includes('@') && (
                    <div style={{ fontSize:11, color:'#e11d48', marginTop:4 }}>
                      Format d'email invalide
                    </div>
                  )}
                </FL>
                <div />
              </div>

              {/* role preview chip */}
              {(() => {
                const rt = ROLE_THEME[formData.role] || ROLE_THEME.waiter;
                return (
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:`${rt.color}08`, border:`1px solid ${rt.color}20`, borderRadius:9 }}>
                    <div style={{ color:rt.color }}>{IC.shield}</div>
                    <p style={{ fontSize:12, color:rt.color, margin:0 }}>
                      Rôle sélectionné : <strong>{rt.label}</strong>
                       {formData.role === 'admin' && ' — accès complet au système'}
                       {formData.role === 'manager' && ' — gestion opérationnelle'}
                       {formData.role === 'cashier' && ' — opérations de caisse et paiements'}
                       {formData.role === 'waiter' && ' — prise de commande uniquement'}
                    </p>
                  </div>
                );
              })()}

              {/* actions */}
              <div style={{ display:'flex', gap:8, paddingTop:4 }}>
                <button type="button" onClick={() => !submitting && setIsModalOpen(false)}
                  style={{ padding:'10px 18px', background:'var(--card)', border:'1px solid var(--border)', color:'var(--text-2)', borderRadius:9, fontSize:13, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                  Annuler
                </button>
                <button type="submit" disabled={submitting} style={{
                  flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  padding:'10px 0',
                  background: submitting ? 'var(--border)' : 'var(--gold)',
                  color: submitting ? 'var(--text-3)' : '#09090f',
                  border:'none', borderRadius:9, fontSize:13.5, fontWeight:700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily:"'DM Sans',sans-serif", transition:'all 140ms ease',
                }}>
                  {submitting
                    ? <><span style={{ width:13, height:13, border:'2px solid rgba(0,0,0,0.2)', borderTopColor:'#000', borderRadius:'50%', display:'inline-block', animation:'spin 0.6s linear infinite' }}/>Enregistrement…</>
                    : <>{IC.save}{editingUser ? 'Sauvegarder les modifications' : 'Créer le compte'}</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

export default UsersPage;