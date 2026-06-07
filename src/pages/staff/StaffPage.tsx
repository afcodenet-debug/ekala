import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { api } from '../../lib/api-client';
import { useI18n } from '../../lib/i18n';
import { Table as TableIcon, Check, X, ShieldOff, Users, Layers } from 'lucide-react';

interface Waiter {
  id: number;
  full_name: string;
  username: string;
  phone: string;
  role: string;
  is_active: number;
}

interface Table {
  id: number;
  table_number: string;
  status: string;
  assigned_waiter_id: number | null;
}

/* ─── Design tokens (aligned with the rest of the app) ──────────────────── */
const T = {
  bg:         '#09090f',
  surface:    '#111118',
  card:       '#16161f',
  cardHi:     '#1c1c27',
  border:     '#1e1e2e',
  borderHi:   '#28283a',
  text1:      '#eeeef5',
  text2:      '#88889a',
  text3:      '#44445a',
  green:      '#10b981',
  greenDim:   'rgba(16,185,129,0.08)',
  red:        '#ef4444',
  redDim:     'rgba(239,68,68,0.08)',
  gold:       '#d4af37',
  goldDim:    'rgba(212,175,55,0.08)',
  blue:       '#3b82f6',
  blueDim:    'rgba(59,130,246,0.08)',
  purple:     '#a78bfa',
  purpleDim:  'rgba(167,139,250,0.08)',
};

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const STYLES = `
  .sp-root {
    background: ${T.bg};
    color: ${T.text1};
    font-family: 'DM Sans', sans-serif;
    min-height: 100vh;
  }
  .sp-root * { box-sizing: border-box; }

  /* ── inner wrapper ── */
  .sp-inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 36px 24px 60px;
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  /* ── header ── */
  .sp-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .sp-header-meta p {
    font-size: 11px; font-weight: 600;
    color: ${T.text3}; text-transform: uppercase;
    letter-spacing: 0.12em; margin-bottom: 6px;
  }
  .sp-header-meta h1 {
    font-size: 28px; font-weight: 300;
    color: ${T.text1}; margin: 0 0 4px;
    letter-spacing: -0.01em;
  }
  .sp-header-meta span {
    font-size: 12px; color: ${T.text2};
  }
  .sp-header-badges {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .sp-badge {
    display: flex; align-items: center; gap: 7px;
    padding: 8px 14px;
    background: ${T.card};
    border: 1px solid ${T.border};
    border-radius: 10px;
    font-size: 12px; font-weight: 700;
    color: ${T.text2};
    white-space: nowrap;
  }
  .sp-badge svg { flex-shrink: 0; }

  /* ── waiter card ── */
  .sp-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
  .sp-card {
    background: ${T.surface};
    border: 1px solid ${T.border};
    border-radius: 18px;
    overflow: hidden;
    transition: border-color 180ms ease, box-shadow 180ms ease;
    display: flex;
    flex-direction: column;
  }
  .sp-card:hover {
    border-color: ${T.borderHi};
    box-shadow: 0 8px 32px rgba(0,0,0,0.25);
  }

  /* card top accent line */
  .sp-card-accent {
    height: 2px;
    background: linear-gradient(90deg, ${T.gold}44, transparent);
    flex-shrink: 0;
  }

  /* card header */
  .sp-card-hd {
    padding: 18px 18px 14px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    border-bottom: 1px solid ${T.border};
    background: rgba(255,255,255,0.01);
  }
  .sp-avatar-wrap { display: flex; align-items: center; gap: 12px; }
  .sp-avatar {
    width: 46px; height: 46px; border-radius: 13px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 800;
    flex-shrink: 0;
    font-family: 'JetBrains Mono', monospace;
  }
  .sp-avatar-active {
    background: ${T.greenDim};
    color: ${T.green};
    border: 1px solid rgba(16,185,129,0.25);
    box-shadow: 0 0 16px rgba(16,185,129,0.08);
  }
  .sp-avatar-inactive {
    background: ${T.redDim};
    color: ${T.red};
    border: 1px solid rgba(239,68,68,0.25);
  }
  .sp-name { font-size: 15px; font-weight: 700; color: ${T.text1}; margin: 0 0 2px; line-height: 1.2; }
  .sp-phone { font-size: 11px; font-weight: 600; color: ${T.text3}; text-transform: uppercase; letter-spacing: 0.06em; margin: 0; }
  .sp-username { font-size: 10px; color: ${T.text3}; margin: 2px 0 0; }
  .sp-toggle-btn {
    width: 32px; height: 32px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: all 150ms ease;
    flex-shrink: 0; border: 1px solid transparent;
  }
  .sp-toggle-active  { background: ${T.greenDim}; color: ${T.green}; border-color: rgba(16,185,129,0.2); }
  .sp-toggle-active:hover  { background: rgba(16,185,129,0.16); }
  .sp-toggle-inactive { background: ${T.redDim};   color: ${T.red};   border-color: rgba(239,68,68,0.2);   }
  .sp-toggle-inactive:hover { background: rgba(239,68,68,0.16); }

  /* assigned tables section */
  .sp-section { padding: 14px 18px; flex: 1; display: flex; flex-direction: column; gap: 10px; }
  .sp-section-label {
    display: flex; align-items: center; justify-content: space-between;
    font-size: 10px; font-weight: 800; color: ${T.text3};
    text-transform: uppercase; letter-spacing: 0.1em;
  }
  .sp-section-count {
    padding: 2px 8px; border-radius: 10px;
    background: ${T.goldDim}; color: ${T.gold};
    font-size: 11px; font-weight: 800;
    border: 1px solid rgba(212,175,55,0.2);
    font-family: 'JetBrains Mono', monospace;
  }
  .sp-table-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px;
    background: ${T.card};
    border: 1px solid ${T.border};
    border-radius: 10px;
    transition: border-color 140ms ease;
    min-height: 40px;
  }
  .sp-table-row:hover { border-color: ${T.borderHi}; }
  .sp-table-row-inner { display: flex; align-items: center; gap: 8px; }
  .sp-table-name { font-size: 13px; font-weight: 600; color: ${T.text1}; }
  .sp-unassign-btn {
    width: 24px; height: 24px; border-radius: 6px;
    background: ${T.redDim}; color: ${T.red};
    border: 1px solid rgba(239,68,68,0.2);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: all 140ms ease;
  }
  .sp-unassign-btn:hover { background: rgba(239,68,68,0.15); }
  .sp-empty-tables {
    font-size: 12px; color: ${T.text3}; font-style: italic;
    padding: 6px 0;
  }

  /* assign new table */
  .sp-assign-section {
    padding: 12px 18px 16px;
    border-top: 1px solid ${T.border};
    background: rgba(0,0,0,0.15);
    flex-shrink: 0;
  }
  .sp-assign-label {
    font-size: 10px; font-weight: 800;
    color: ${T.gold}; text-transform: uppercase;
    letter-spacing: 0.1em; margin-bottom: 10px;
    display: flex; align-items: center; gap: 6px;
  }
  .sp-assign-chips {
    display: flex; flex-wrap: wrap; gap: 7px;
  }
  .sp-chip {
    padding: 5px 11px;
    background: ${T.card};
    border: 1px solid ${T.border};
    border-radius: 8px;
    font-size: 11px; font-weight: 700;
    color: ${T.text2};
    cursor: pointer;
    transition: all 160ms ease;
    min-height: 30px;
    display: flex; align-items: center; justify-content: center;
    font-family: 'JetBrains Mono', monospace;
  }
  .sp-chip:hover {
    background: ${T.goldDim};
    border-color: rgba(212,175,55,0.4);
    color: ${T.gold};
  }
  .sp-chip-empty { font-size: 11px; color: ${T.text3}; font-style: italic; }

  /* status indicator dot */
  .sp-status-dot {
    width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
  }

  /* access denied + loading */
  .sp-denied {
    margin: 60px auto;
    max-width: 480px;
    background: ${T.redDim};
    border: 1px solid rgba(239,68,68,0.25);
    border-radius: 18px;
    padding: 40px 32px;
    text-align: center;
  }
  .sp-loading {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    min-height: 40vh; gap: 16px;
    color: ${T.text3};
    font-size: 13px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.1em;
  }
  .sp-spinner {
    width: 36px; height: 36px;
    border: 3px solid ${T.border};
    border-top-color: ${T.blue};
    border-radius: 50%;
    animation: sp-spin 0.7s linear infinite;
  }

  /* empty state */
  .sp-empty-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: 80px 20px;
    color: ${T.text3};
  }

  /* ═══════════════════════════════════════════════════════════
     RESPONSIVE — mobile-first
  ═══════════════════════════════════════════════════════════ */

  /* ── Tablets landscape (≤ 1024 px) ── */
  @media (max-width: 1024px) {
    .sp-grid    { grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .sp-inner   { padding: 28px 20px 52px; gap: 24px; }
  }

  /* ── Tablets portrait (≤ 768 px) ── */
  @media (max-width: 768px) {
    .sp-inner   { padding: 22px 16px 44px; gap: 20px; }
    .sp-header  { gap: 12px; }
    .sp-header-meta h1 { font-size: 22px; }
    .sp-grid    { grid-template-columns: 1fr; gap: 14px; }
    .sp-header-badges { gap: 8px; }
    .sp-badge   { padding: 7px 12px; font-size: 11.5px; }
  }

  /* ── Large phones (≤ 640 px) ── */
  @media (max-width: 640px) {
    .sp-inner   { padding: 18px 14px 40px; }
    .sp-header  { flex-direction: column; align-items: stretch; }
    .sp-header-badges { justify-content: flex-start; }
    .sp-header-meta h1 { font-size: 20px; }
    .sp-card    { border-radius: 16px; }
    .sp-avatar  { width: 42px; height: 42px; font-size: 16px; border-radius: 11px; }
    .sp-name    { font-size: 14px; }
  }

  /* ── Standard phones (≤ 480 px) ── */
  @media (max-width: 480px) {
    .sp-inner   { padding: 14px 12px 36px; gap: 16px; }
    .sp-header-meta h1 { font-size: 18px; }
    .sp-badge   { padding: 6px 10px; font-size: 11px; }

    .sp-card-hd { padding: 14px 14px 12px; }
    .sp-avatar  { width: 38px; height: 38px; font-size: 15px; border-radius: 10px; }
    .sp-name    { font-size: 13.5px; }
    .sp-section { padding: 12px 14px; gap: 8px; }
    .sp-assign-section { padding: 10px 14px 14px; }

    .sp-table-row { padding: 7px 10px; border-radius: 8px; }
    .sp-table-name { font-size: 12.5px; }
    .sp-chip    { padding: 5px 9px; font-size: 10.5px; }
  }

  /* ── Very small phones (≤ 360 px) ── */
  @media (max-width: 360px) {
    .sp-inner   { padding: 12px 10px 28px; }
    .sp-header-meta h1 { font-size: 17px; }
    .sp-card-hd { padding: 12px 12px 10px; }
    .sp-section { padding: 10px 12px; }
    .sp-assign-section { padding: 8px 12px 12px; }
    .sp-avatar  { width: 36px; height: 36px; border-radius: 9px; }
  }

  /* ── Touch targets ── */
  @media (pointer: coarse) {
    .sp-toggle-btn  { width: 38px; height: 38px; border-radius: 10px; }
    .sp-unassign-btn { width: 30px; height: 30px; border-radius: 7px; }
    .sp-chip        { min-height: 36px; padding: 6px 12px; }
    .sp-table-row   { min-height: 48px; }
  }

  @keyframes sp-spin { to { transform: rotate(360deg); } }
  @keyframes sp-fade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  .sp-fade { animation: sp-fade 260ms ease both; }
`;

const StaffPage = () => {
  const { user: currentUser } = useAuthStore();
  const { t } = useI18n();
  const [waiters,   setWaiters]   = useState<Waiter[]>([]);
  const [allTables, setAllTables] = useState<Table[]>([]);
  const [loading,   setLoading]   = useState(true);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  /* Inject styles once */
  useEffect(() => {
    const id = 'sp-styles';
    if (!document.getElementById(id)) {
      const s = document.createElement('style'); s.id = id; s.textContent = STYLES;
      document.head.appendChild(s);
    }
  }, []);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [usersRes, tables] = await Promise.all([
        api.users.getAll(currentUser?.role),
        api.tables.getAll(undefined, currentUser?.role)
      ]);
      const usersArray  = Array.isArray(usersRes) ? usersRes : (usersRes as any)?.users || [];
      const waitersList = usersArray.filter((u: any) => u.role === 'waiter');
      setWaiters(waitersList);
      setAllTables(tables as Table[]);
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  const getWaiterTables    = (waiterId: number) => allTables.filter(t => t.assigned_waiter_id === waiterId);
  const getAvailableTables = ()                  => allTables.filter(t => t.assigned_waiter_id === null && t.status === 'available');

  const assignTable = async (tableId: number, waiterId: number) => {
    try {
      await api.tables.update(tableId, { assigned_waiter_id: waiterId }, currentUser?.role);
      setAllTables(prev => prev.map(t => t.id === tableId ? { ...t, assigned_waiter_id: waiterId } : t));
    } catch { alert('Failed to assign table'); }
  };

  const unassignTable = async (tableId: number) => {
    try {
      await api.tables.update(tableId, { assigned_waiter_id: null }, currentUser?.role);
      setAllTables(prev => prev.map(t => t.id === tableId ? { ...t, assigned_waiter_id: null } : t));
    } catch { alert('Failed to unassign table'); }
  };

  const toggleWaiterStatus = async (waiter: Waiter) => {
    try {
      await api.users.update(waiter.id, { is_active: waiter.is_active ? 0 : 1 }, currentUser?.role);
      setWaiters(prev => prev.map(w => w.id === waiter.id ? { ...w, is_active: w.is_active ? 0 : 1 } : w));
    } catch { alert('Failed to update status'); }
  };

  /* ── Access denied ── */
  if (!isAdmin) return (
    <div className="sp-root">
      <div style={{ padding: '24px' }}>
        <div className="sp-denied">
          <ShieldOff size={36} color={T.red} style={{ marginBottom: 16, opacity: 0.8 }} />
          <h2 style={{ fontSize: 18, fontWeight: 800, color: T.red, margin: '0 0 8px' }}>Accès refusé</h2>
          <p style={{ fontSize: 13, color: T.text3, margin: 0 }}>
            Seuls les administrateurs peuvent gérer les affectations du personnel.
          </p>
        </div>
      </div>
    </div>
  );

  /* ── Loading ── */
  if (loading) return (
    <div className="sp-root">
      <div className="sp-loading">
        <div className="sp-spinner" />
        <span>Chargement du personnel…</span>
      </div>
    </div>
  );

  const availableTables = getAvailableTables();

  return (
    <div className="sp-root">
      <div className="sp-inner">

        {/* ── Header ── */}
        <header className="sp-header sp-fade">
          <div className="sp-header-meta">
            <p>{t('staff.management')}</p>
            <h1>{t('staff.management')}</h1>
            <span>{t('staff.assignTables')}</span>
          </div>

          <div className="sp-header-badges">
            <div className="sp-badge">
              <Users size={13} color={T.blue} />
              <span style={{ color: T.text1 }}>{waiters.length}</span>
              <span>serveurs</span>
            </div>
            <div className="sp-badge">
              <TableIcon size={13} color={T.gold} />
              <span style={{ color: T.text1 }}>{allTables.length}</span>
              <span>tables</span>
            </div>
            <div className="sp-badge" style={{ gap: 6 }}>
              <div className="sp-status-dot" style={{ background: T.green, boxShadow: `0 0 6px ${T.green}` }} />
              <span style={{ color: T.green, fontSize: 11, fontWeight: 800 }}>Live</span>
            </div>
          </div>
        </header>

        {/* ── Waiter cards grid ── */}
        <div className="sp-grid">
          {waiters.length === 0 && (
            <div className="sp-empty-state">
              <Users size={48} strokeWidth={1} style={{ marginBottom: 16, opacity: 0.2 }} />
              <p style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Aucun serveur trouvé
              </p>
              <p style={{ fontSize: 12, marginTop: 4, color: T.text3 }}>
                Ajoutez des membres du personnel depuis la gestion des utilisateurs.
              </p>
            </div>
          )}

          {waiters.map((waiter, idx) => {
            const assignedTables = getWaiterTables(waiter.id);
            const isActive       = Boolean(waiter.is_active);

            return (
              <div
                key={waiter.id}
                className="sp-card sp-fade"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                {/* Top accent line — gold when active, red when inactive */}
                <div className="sp-card-accent" style={{
                  background: isActive
                    ? `linear-gradient(90deg, ${T.gold}55, transparent)`
                    : `linear-gradient(90deg, ${T.red}44, transparent)`
                }} />

                {/* Card header */}
                <div className="sp-card-hd">
                  <div className="sp-avatar-wrap">
                    <div className={`sp-avatar ${isActive ? 'sp-avatar-active' : 'sp-avatar-inactive'}`}>
                      {waiter.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p className="sp-name" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {waiter.full_name}
                      </p>
                      {waiter.phone && <p className="sp-phone">{waiter.phone}</p>}
                      {waiter.username && <p className="sp-username">@{waiter.username}</p>}
                    </div>
                  </div>

                  <button
                    className={`sp-toggle-btn ${isActive ? 'sp-toggle-active' : 'sp-toggle-inactive'}`}
                    onClick={() => toggleWaiterStatus(waiter)}
                    title={isActive ? 'Actif — cliquer pour désactiver' : 'Inactif — cliquer pour activer'}
                    aria-label={isActive ? 'Désactiver' : 'Activer'}
                  >
                    {isActive ? <Check size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
                  </button>
                </div>

                {/* Assigned tables */}
                <div className="sp-section">
                  <div className="sp-section-label">
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <Layers size={11} color={T.text3} />
                      Tables assignées
                    </div>
                    <span className="sp-section-count">{assignedTables.length}</span>
                  </div>

                  {assignedTables.length === 0 ? (
                    <p className="sp-empty-tables">Aucune table assignée</p>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {assignedTables.map(table => (
                        <div key={table.id} className="sp-table-row">
                          <div className="sp-table-row-inner">
                            <TableIcon size={13} color={T.text3} />
                            <span className="sp-table-name">Table {table.table_number}</span>
                            {/* status chip */}
                            <span style={{
                              fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 5,
                              background: table.status === 'active' ? T.redDim : T.greenDim,
                              color:      table.status === 'active' ? T.red    : T.green,
                              border:     `1px solid ${table.status === 'active' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
                              textTransform: 'uppercase', letterSpacing: '0.05em',
                            }}>
                              {table.status}
                            </span>
                          </div>
                          <button
                            className="sp-unassign-btn"
                            onClick={() => unassignTable(table.id)}
                            title="Désassigner"
                            aria-label="Désassigner la table"
                          >
                            <X size={12} strokeWidth={2.5} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Assign new table */}
                {isAdmin && (
                  <div className="sp-assign-section">
                    <p className="sp-assign-label">
                      <TableIcon size={10} />
                      Assigner une table
                    </p>
                    <div className="sp-assign-chips">
                      {availableTables
                        .filter(t => t.status === 'available')
                        .slice(0, 5)
                        .map(table => (
                          <button
                            key={table.id}
                            className="sp-chip"
                            onClick={() => assignTable(table.id, waiter.id)}
                            title={`Assigner la table ${table.table_number}`}
                          >
                            T{table.table_number}
                          </button>
                        ))}
                      {availableTables.filter(t => t.status === 'available').length === 0 && (
                        <span className="sp-chip-empty">Aucune table disponible</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};

export default StaffPage;