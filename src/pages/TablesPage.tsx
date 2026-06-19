import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Grid,
  Layout,
  CheckCircle2,
  Play,
  Clock,
  Settings,
  Ban,
  QrCode,
  Copy,
  Download,
  RefreshCw,
  X
} from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';

import { useAuthStore } from '../stores/useAuthStore';
import { useTableStore, Table } from '../stores/useTableStore';
import { useI18n } from '../lib/i18n';
import { api } from '../lib/api-client';

import {
  FloorTableCard,
  FloorCreateTableModal,
  FloorEditTableModal,
  DeleteTableModal,
  AssignWaiterModal
} from '../features/tables/components/floor-index';

/* ─── Responsive Styles ──────────────────────────────────────────────────── */
const STYLES = `
  .tables-root {
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
  .kpi-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 18px 20px;
    position: relative;
    overflow: hidden;
    transition: all 180ms ease;
  }
  .kpi-card:hover {
    border-color: var(--border-hi);
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(0,0,0,0.3);
  }

  /* ── KPI Grid ── */
  .kpi-strip {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 14px;
    margin-bottom: 40px;
  }

  /* ── Floor Grid ── */
  .floor-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 30px;
  }

  /* ── Page Container ── */
  .floor-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 36px 24px 60px;
  }

  /* ── Header ── */
  .floor-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 32px;
    gap: 20px;
    flex-wrap: wrap;
  }

  /* ── QR Modal ── */
  .qr-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.75);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .qr-modal-box {
    background: var(--card);
    border: 1px solid var(--border-hi);
    border-radius: 24px;
    width: 100%;
    max-width: 420px;
    padding: 32px;
    color: var(--text-1);
    box-shadow: 0 25px 60px rgba(0,0,0,0.6);
  }

  .mono { font-family: 'JetBrains Mono', monospace; }

  .live-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--green);
    box-shadow: 0 0 6px rgba(16,185,129,0.7);
    animation: live-pulse 2s ease-in-out infinite;
  }
  @keyframes live-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }

  .notification {
    position: fixed;
    bottom: 24px;
    right: 24px;
    padding: 16px 24px;
    border-radius: 16px;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 12px 32px rgba(0,0,0,0.4);
    animation: slide-in 0.3s ease;
    max-width: calc(100vw - 48px);
  }
  @keyframes slide-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

  /* ── Add Table FAB (mobile) ── */
  .add-table-fab {
    display: none;
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 100;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--blue);
    border: none;
    color: #fff;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 24px rgba(59,130,246,0.45);
  }

  /* ══════════════════════════════
     TABLET  (≤ 1024px)
  ══════════════════════════════ */
  @media (max-width: 1024px) {
    .floor-container {
      padding: 28px 20px 80px;
    }

    .kpi-strip {
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 32px;
    }

    .floor-grid {
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 20px;
    }

    .floor-header {
      margin-bottom: 24px;
    }
  }

  /* ══════════════════════════════
     LARGE PHONE / SMALL TABLET  (≤ 768px)
  ══════════════════════════════ */
  @media (max-width: 768px) {
    .floor-container {
      padding: 20px 16px 100px;
    }

    .floor-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 20px;
    }

    /* Header title smaller on mobile */
    .floor-header h1 {
      font-size: 22px !important;
    }

    /* Hide the inline "Add table" button — show FAB instead */
    .add-table-btn {
      display: none !important;
    }
    .add-table-fab {
      display: flex;
    }

    .kpi-strip {
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 24px;
    }

    /* Compact KPI cards on mobile */
    .kpi-card {
      padding: 12px 14px;
      border-radius: 12px;
    }
    .kpi-card .kpi-label {
      font-size: 9px !important;
    }
    .kpi-card .kpi-value {
      font-size: 18px !important;
    }

    .floor-grid {
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 14px;
    }

    /* QR modal full-width on mobile */
    .qr-modal-box {
      padding: 24px 20px;
      border-radius: 20px;
      max-height: 92vh;
      overflow-y: auto;
    }

    /* Notification anchored bottom-left on small screens (avoids FAB overlap) */
    .notification {
      bottom: 90px;
      right: 16px;
      left: 16px;
      font-size: 12px;
    }

    /* Live badge text truncation */
    .live-badge-text {
      display: none;
    }
  }

  /* ══════════════════════════════
     PHONE  (≤ 480px)
  ══════════════════════════════ */
  @media (max-width: 480px) {
    .floor-container {
      padding: 16px 12px 100px;
    }

    .kpi-strip {
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-bottom: 20px;
    }

    .kpi-card {
      padding: 10px 12px;
    }
    .kpi-card .kpi-label {
      display: none; /* ultra-compact: icon + value only */
    }
    .kpi-card .kpi-icon-row {
      margin-bottom: 4px !important;
    }
    .kpi-card .kpi-value {
      font-size: 20px !important;
    }

    .floor-grid {
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 10px;
    }

    .floor-header h1 {
      font-size: 20px !important;
    }

    .qr-modal-overlay {
      padding: 12px;
      align-items: flex-end;
    }
    .qr-modal-box {
      border-radius: 20px 20px 16px 16px;
      padding: 20px 16px;
    }
  }

  @keyframes spin { to { transform: rotate(360deg); } }
`;

const FloorPlan = () => {
  const { user } = useAuthStore();
  const { tables, isLoading, fetchTables, setUserContext, updateTableStatus, deleteTable } = useTableStore();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [deletingTableId, setDeletingTableId] = useState<number | null>(null);
  const [assigningTableId, setAssigningTableId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [qrModalTable, setQrModalTable] = useState<Table | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const permissions = useMemo(() => {
    const role = user?.role;
    const isAdmin = role === 'owner' || role === 'admin';
    const isManager = role === 'manager';
    const isWaiter = role === 'waiter';
    const canModify = isAdmin || isManager;
    const canCreate = canModify;
    return { isAdmin, isManager, isWaiter, canModify, canCreate };
  }, [user?.role]);

  const { isAdmin, isManager, isWaiter, canModify, canCreate } = permissions;

  const accessibleTables = useMemo(() => {
    return tables.filter(table => {
      if (isAdmin || isManager) return true;
      if (isWaiter) return table.assigned_waiter_id === user?.id || !table.assigned_waiter_id;
      return false;
    });
  }, [tables, isAdmin, isManager, isWaiter, user?.id]);

  const showSuccess = useCallback((message: string) => {
    setNotification({ type: 'success', message });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  const showError = useCallback((message: string) => {
    setNotification({ type: 'error', message });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  useEffect(() => {
    const id = 'tables-styles';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id;
      s.textContent = STYLES;
      document.head.appendChild(s);
    }
  }, []);

  useEffect(() => {
    if (user?.id && user?.role) {
      setUserContext(user.id, user.role);
      fetchTables().finally(() => setIsInitialLoad(false));
      const interval = setInterval(() => fetchTables(), 10000);
      return () => clearInterval(interval);
    }
  }, [user?.id, user?.role, setUserContext, fetchTables]);

  const PUBLIC_MENU_BASE_URL =
    (typeof import.meta !== 'undefined' &&
      (import.meta as any).env &&
      (import.meta as any).env.VITE_PUBLIC_MENU_BASE_URL) || '';

  const getPublicBaseUrl = () => {
    const explicit = String(PUBLIC_MENU_BASE_URL || '').trim();
    if (explicit) return explicit.replace(/\/$/, '');
    if (typeof window === 'undefined') return '';
    const { hostname, protocol } = window.location;
    const isVercelHost = hostname.includes('vercel.app') || hostname.includes('vercel.');
    if (isVercelHost) return `https://${hostname}`.replace(/\/$/, '');
    return String(protocol + '//' + hostname).replace(/\/$/, '');
  };

  const getQrUrl = (table: Table) => {
    if (!table.qr_token) return '';
    return `${getPublicBaseUrl()}/menu?token=${table.qr_token}`;
  };

  const copyQrLink = async (table: Table) => {
    const url = getQrUrl(table);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      showSuccess('Lien copié dans le presse-papiers');
    } catch {
      prompt('Copiez ce lien manuellement :', url);
    }
  };

  const regenerateQrForTable = async (table: Table) => {
    if (!confirm(`Regénérer le code QR pour la table ${table.table_number} ?\n\nLes anciens liens ne fonctionneront plus.`)) return;
    try {
      const updated: any = await api.tables.regenerateQr(table.id);
      await fetchTables();
      setQrModalTable(prev => (prev && prev.id === table.id ? { ...prev, qr_token: updated.qr_token } : prev));
      showSuccess('Nouveau code QR généré avec succès');
    } catch (e: any) {
      showError(e?.message || 'Échec de la régénération du QR');
    }
  };

  const downloadQrPng = (table: Table) => {
    const canvas = qrCanvasRef.current;
    if (!canvas) { showError('Téléchargement non prêt, veuillez réessayer'); return; }
    const link = document.createElement('a');
    link.download = `table-${table.table_number}-menu-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleTableClick = useCallback(
    async (table: Table) => {
      const canAccess = canModify || (isWaiter && (table.assigned_waiter_id === user?.id || !table.assigned_waiter_id));
      if (!canAccess) { alert(t('tables.noAccess')); return; }
      if (table.status === 'available' || table.status === 'active' || canModify) {
        navigate(`/pos?tableId=${table.id}`);
      } else {
        alert(t('tables.tableUnavailable'));
      }
    },
    [canModify, isWaiter, user?.id, navigate, t]
  );

  const handleEdit = useCallback((table: Table) => setEditingTable(table), []);
  const handleDelete = useCallback((tableId: number) => setDeletingTableId(tableId), []);

  const confirmDelete = useCallback(async () => {
    if (!deletingTableId) return;
    setIsDeleting(true);
    try {
      const success = await deleteTable(deletingTableId);
      if (success) { showSuccess(t('tables.deleteSuccess')); setDeletingTableId(null); }
      else showError(t('tables.deleteFail'));
    } catch { showError(t('tables.genericError')); }
    finally { setIsDeleting(false); }
  }, [deletingTableId, deleteTable, showSuccess, showError, t]);

  const handleAssignWaiter = useCallback((tableId: number) => setAssigningTableId(tableId), []);

  const handleStatusChange = useCallback(
    async (tableId: number, status: string) => {
      try {
        await updateTableStatus(tableId, status as any);
        showSuccess(`Statut mis à jour : ${status}`);
      } catch { showError(t('tables.updateFail')); }
    },
    [updateTableStatus, showSuccess, showError, t]
  );

  if (isInitialLoad && isLoading) {
    return (
      <div className="tables-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px' }} />
          <p style={{ color: 'var(--text-3)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {t('tables.loadingFloorPlan')}
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  const statsList = [
    { label: t('tables.totalTables'),   value: accessibleTables.length,                                              icon: <Layout size={14} />,      color: 'var(--blue)'   },
    { label: t('tables.available'),      value: accessibleTables.filter(x => x.status === 'available').length,       icon: <CheckCircle2 size={14} />, color: 'var(--green)'  },
    { label: t('tables.occupied'),       value: accessibleTables.filter(x => x.status === 'active').length,          icon: <Play size={14} />,         color: 'var(--red)'    },
    { label: t('tables.reserved'),       value: accessibleTables.filter(x => x.status === 'reserved').length,        icon: <Clock size={14} />,        color: 'var(--amber)'  },
    { label: t('tables.cleaning'),       value: accessibleTables.filter(x => x.status === 'cleaning').length,        icon: <Settings size={14} />,     color: 'var(--purple)' },
    { label: t('tables.outOfService'),   value: accessibleTables.filter(x => x.status === 'out_of_service').length,  icon: <Ban size={14} />,          color: 'var(--text-3)' }
  ];

  return (
    <div className="tables-root">
      <div className="floor-container">

        {/* ── Header ── */}
        <div className="floor-header">
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
              {t('tables.floorPlan')}
            </p>
            <h1 style={{ fontSize: 28, fontWeight: 300, color: 'var(--text-1)', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
              {t('tables.title')}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--green)', background: 'var(--green-dim)', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(16,185,129,0.2)' }}>
                <span className="live-dot" />
                <span className="live-badge-text">{t('tables.liveFloor')}</span>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>•</span>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                {isAdmin ? t('tables.adminAccess') : isManager ? t('tables.managerAccess') : t('tables.assignedTables')}
              </span>
            </div>
          </div>

          {/* Inline button — hidden on mobile, replaced by FAB */}
          {canCreate && (
            <button
              className="add-table-btn"
              onClick={() => setShowCreateModal(true)}
              style={{ padding: '10px 20px', borderRadius: 12, background: 'var(--blue)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}
            >
              <Plus size={16} /> {t('tables.addTable')}
            </button>
          )}
        </div>

        {/* ── KPI Strip ── */}
        <div className="kpi-strip">
          {statsList.map((k, i) => (
            <div key={i} className="kpi-card">
              <div className="kpi-icon-row" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ color: k.color }}>{k.icon}</div>
                <span className="kpi-label" style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {k.label}
                </span>
              </div>
              <div className="mono kpi-value" style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-1)' }}>
                {k.value}
              </div>
            </div>
          ))}
        </div>

        {/* ── Floor Grid ── */}
        <div className="floor-grid">
          {accessibleTables.map(table => (
            <div key={table.id} onClick={() => handleTableClick(table)}>
              <FloorTableCard
                table={table}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onAssignWaiter={handleAssignWaiter}
                onStatusChange={handleStatusChange}
                onShowQR={setQrModalTable}
              />
            </div>
          ))}
        </div>

        {/* ── Empty State ── */}
        {accessibleTables.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', color: 'var(--text-3)' }}>
            <Grid size={48} strokeWidth={1} style={{ marginBottom: 20, opacity: 0.3 }} />
            <p style={{ fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('tables.noAvailable')}</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>{t('tables.startAddingTable')}</p>
          </div>
        )}
      </div>

      {/* ── FAB (mobile only) ── */}
      {canCreate && (
        <button
          className="add-table-fab"
          onClick={() => setShowCreateModal(true)}
          aria-label={t('tables.addTable')}
          title={t('tables.addTable')}
        >
          <Plus size={24} />
        </button>
      )}

      {/* ── Modals ── */}
      <FloorCreateTableModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(table) => { setShowCreateModal(false); showSuccess(`${t('tables.table')} ${table.table_number} ${t('tables.createdSuccess')}`); }}
      />
      <FloorEditTableModal
        table={editingTable}
        isOpen={!!editingTable}
        onClose={() => setEditingTable(null)}
        onSuccess={(table) => { setEditingTable(null); showSuccess(`${t('tables.table')} ${table.table_number} ${t('tables.updatedSuccess')}`); }}
      />
      <DeleteTableModal
        table={accessibleTables.find(t => t.id === deletingTableId) || null}
        isOpen={!!deletingTableId}
        onClose={() => setDeletingTableId(null)}
        onConfirm={confirmDelete}
        isLoading={isDeleting}
      />
      <AssignWaiterModal
        tableId={assigningTableId}
        isOpen={!!assigningTableId}
        onClose={() => setAssigningTableId(null)}
        onSuccess={() => { setAssigningTableId(null); showSuccess(t('tables.waiterAssignedSuccess')); }}
      />

      {/* ── QR Modal ── */}
      {qrModalTable && qrModalTable.qr_token && (
        <div className="qr-modal-overlay" onClick={() => setQrModalTable(null)}>
          <div className="qr-modal-box" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, background: 'var(--gold-dim)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <QrCode size={22} color="var(--gold)" />
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Table {qrModalTable.table_number}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '2.5px', textTransform: 'uppercase' }}>MENU • EN LIGNE</div>
                </div>
              </div>
              <button
                aria-label="Fermer"
                onClick={() => setQrModalTable(null)}
                style={{ width: 36, height: 36, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* QR code */}
            <div style={{ background: '#fff', borderRadius: 20, padding: 28, display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <QRCodeSVG value={getQrUrl(qrModalTable)} size={240} level="M" includeMargin fgColor="#0a2f1f" bgColor="#ffffff" />
            </div>

            {/* Hidden high-res canvas for PNG export */}
            <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
              <QRCodeCanvas ref={qrCanvasRef as any} value={getQrUrl(qrModalTable)} size={1024} level="H" includeMargin fgColor="#0a2f1f" bgColor="#ffffff" />
            </div>

            {/* Token */}
            <div style={{ textAlign: 'center', marginBottom: 18, fontSize: 11, color: 'var(--text-3)' }}>
              TOKEN
              <div style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--gold)', fontSize: 13, letterSpacing: '1px', userSelect: 'all', marginTop: 6, wordBreak: 'break-all' }}>
                {qrModalTable.qr_token}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => copyQrLink(qrModalTable)} style={{ padding: '12px 16px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-1)', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Copy size={16} /> COPIER
              </button>
              <button onClick={() => regenerateQrForTable(qrModalTable)} style={{ padding: '12px 16px', borderRadius: 14, background: 'rgba(245,158,11,0.12)', border: '1px solid #f59e0b55', color: '#f59e0b', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <RefreshCw size={16} /> RÉGÉNÉRER
              </button>
              <button onClick={() => downloadQrPng(qrModalTable)} style={{ gridColumn: 'span 2', padding: '12px 16px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-1)', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Download size={16} /> TÉLÉCHARGER PNG
              </button>
              <button onClick={() => window.open(getQrUrl(qrModalTable), '_blank')} style={{ gridColumn: 'span 2', padding: '12px 16px', borderRadius: 14, background: 'var(--gold)', color: '#0a2f1f', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                OUVRIR MENU
              </button>
            </div>

            <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.4 }}>
              Menu disponible via votre connexion (Wi‑Fi/Internet).
            </div>
          </div>
        </div>
      )}

      {/* ── Notifications ── */}
      {notification && (
        <div
          className="notification"
          style={{
            background: notification.type === 'success' ? 'var(--card)' : 'var(--red-dim)',
            border: `1px solid ${notification.type === 'success' ? 'var(--border-hi)' : 'var(--red)'}`,
            color: notification.type === 'success' ? 'var(--text-1)' : 'var(--red)'
          }}
        >
          {notification.type === 'success' ? <CheckCircle2 size={18} color="var(--green)" /> : <Ban size={18} />}
          <span style={{ fontSize: 13, fontWeight: 600 }}>{notification.message}</span>
        </div>
      )}
    </div>
  );
};

export default FloorPlan;