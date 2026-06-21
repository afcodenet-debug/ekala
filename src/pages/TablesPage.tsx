import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Grid, Layout, CheckCircle2, Play, Clock,
  Settings, Ban, QrCode, Copy, Download, RefreshCw, X, ExternalLink
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

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const STYLES = `
  .tables-root {
    --bg:          #09090f;
    --surface:     #0d0d16;
    --card:        #0f0f18;
    --card-hi:     #14141e;
    --border:      rgba(255,255,255,0.06);
    --border-hi:   rgba(255,255,255,0.10);
    --text-1:      #e8e8f2;
    --text-2:      #6b6b85;
    --text-3:      #34344a;
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
    --gold:        #f59e0b;
    --gold-dim:    rgba(245,158,11,0.09);
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'DM Sans', 'Segoe UI', sans-serif;
    color: var(--text-1);
    background: var(--bg);
    min-height: 100vh;
  }

  /* ── Page Container ── */
  .floor-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 40px 32px 80px;
  }

  /* ── Header ── */
  .floor-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 36px;
    gap: 20px;
    flex-wrap: wrap;
  }
  .floor-eyebrow {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    margin-bottom: 8px;
  }
  .floor-title {
    font-size: 28px;
    font-weight: 800;
    color: var(--text-1);
    margin: 0 0 10px;
    letter-spacing: -0.03em;
    line-height: 1.1;
  }
  .floor-live-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 700;
    color: var(--green);
    background: var(--green-dim);
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid rgba(16,185,129,0.2);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .floor-role-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-2);
    padding: 3px 0;
  }

  /* ── Add button ── */
  .add-table-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 11px 20px;
    border-radius: 11px;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    border: none;
    color: #fff;
    font-size: 13.5px;
    font-weight: 700;
    letter-spacing: -0.01em;
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 8px 24px rgba(59,130,246,0.28), 0 2px 6px rgba(59,130,246,0.16);
    transition: filter 150ms, transform 150ms, box-shadow 150ms;
    flex-shrink: 0;
  }
  .add-table-btn:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
    box-shadow: 0 12px 28px rgba(59,130,246,0.36);
  }
  .add-table-btn:active { transform: translateY(0); filter: brightness(0.97); }

  /* ── KPI Strip ── */
  .kpi-strip {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 12px;
    margin-bottom: 36px;
  }
  .kpi-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 16px 18px;
    position: relative;
    overflow: hidden;
    transition: border-color 180ms, transform 180ms, box-shadow 180ms;
    cursor: default;
  }
  .kpi-card:hover {
    border-color: var(--border-hi);
    transform: translateY(-2px);
    box-shadow: 0 16px 40px rgba(0,0,0,0.3);
  }
  /* Subtle glow strip at top per card */
  .kpi-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    opacity: 0;
    transition: opacity 200ms;
    border-radius: 14px 14px 0 0;
  }
  .kpi-card:hover::before { opacity: 1; }
  .kpi-icon-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }
  .kpi-icon-wrap {
    width: 28px; height: 28px;
    border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .kpi-label {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    line-height: 1.3;
  }
  .kpi-value {
    font-size: 26px;
    font-weight: 300;
    color: var(--text-1);
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  }

  /* ── Floor Grid ── */
  .floor-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(185px, 1fr));
    gap: 16px;
  }

  /* ── Empty State ── */
  .floor-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 100px 24px;
    text-align: center;
  }
  .floor-empty-icon {
    width: 64px; height: 64px;
    border-radius: 18px;
    background: rgba(255,255,255,0.02);
    border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    color: var(--text-3);
    margin-bottom: 20px;
  }
  .floor-empty-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 6px;
  }
  .floor-empty-sub {
    font-size: 12.5px;
    color: var(--text-3);
    opacity: 0.6;
  }

  /* ── FAB (mobile only) ── */
  .add-table-fab {
    display: none;
    position: fixed;
    bottom: 24px; right: 24px;
    z-index: 100;
    width: 54px; height: 54px;
    border-radius: 50%;
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    border: none;
    color: #fff;
    cursor: pointer;
    align-items: center; justify-content: center;
    box-shadow: 0 8px 24px rgba(59,130,246,0.45);
    transition: transform 150ms;
  }
  .add-table-fab:hover { transform: scale(1.06); }

  /* ── Inline notification toast ── */
  .fp-toast {
    position: fixed;
    bottom: 28px; right: 28px;
    padding: 14px 20px;
    border-radius: 12px;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 16px 40px rgba(0,0,0,0.45);
    animation: fp-toast-in 280ms cubic-bezier(0.16,1,0.3,1) both;
    max-width: calc(100vw - 56px);
    backdrop-filter: blur(8px);
  }
  @keyframes fp-toast-in {
    from { opacity: 0; transform: translateX(20px) scale(0.96); }
    to   { opacity: 1; transform: translateX(0) scale(1); }
  }

  /* ── Live dot ── */
  .live-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--green);
    box-shadow: 0 0 6px rgba(16,185,129,0.8);
    animation: live-pulse 2.2s ease-in-out infinite;
    flex-shrink: 0;
  }
  @keyframes live-pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }

  /* ── QR Modal overlay ── */
  .qr-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.72);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    z-index: 1000;
    display: flex;
    align-items: center; justify-content: center;
    padding: 20px;
    animation: fp-backdrop-in 180ms ease both;
  }
  @keyframes fp-backdrop-in { from{opacity:0} to{opacity:1} }

  .qr-box {
    background: #0d0d16;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    width: 100%; max-width: 400px;
    overflow: hidden;
    box-shadow:
      0 0 0 1px rgba(0,0,0,0.6),
      0 32px 64px rgba(0,0,0,0.65);
    animation: qr-scale-in 260ms cubic-bezier(0.16,1,0.3,1) both;
  }
  @keyframes qr-scale-in {
    from { opacity:0; transform: scale(0.95) translateY(10px); }
    to   { opacity:1; transform: scale(1)    translateY(0); }
  }

  /* QR strip */
  .qr-strip {
    height: 3px;
    background: linear-gradient(90deg, transparent, #f59e0b 40%, #f59e0b66 100%);
  }
  .qr-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 22px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .qr-header-icon {
    width: 40px; height: 40px;
    border-radius: 11px;
    background: var(--gold-dim);
    border: 1px solid rgba(245,158,11,0.2);
    display: flex; align-items: center; justify-content: center;
    color: var(--gold);
    flex-shrink: 0;
  }
  .qr-header-title {
    font-size: 17px;
    font-weight: 750;
    color: var(--text-1);
    letter-spacing: -0.02em;
  }
  .qr-header-sub {
    font-size: 10px;
    color: var(--text-3);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-weight: 600;
    margin-top: 2px;
  }
  .qr-close-btn {
    width: 32px; height: 32px;
    border-radius: 8px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    color: var(--text-3);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: background 140ms, color 140ms;
    flex-shrink: 0;
  }
  .qr-close-btn:hover { background: rgba(255,255,255,0.09); color: var(--text-2); }

  /* QR code area */
  .qr-canvas-wrap {
    padding: 22px 22px 16px;
  }
  .qr-canvas-inner {
    background: #fff;
    border-radius: 16px;
    padding: 22px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  /* Token */
  .qr-token-wrap {
    padding: 10px 22px 18px;
    text-align: center;
  }
  .qr-token-label {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-3);
    margin-bottom: 6px;
  }
  .qr-token-value {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 11.5px;
    color: var(--gold);
    letter-spacing: 0.04em;
    word-break: break-all;
    line-height: 1.6;
    user-select: all;
  }

  /* Action buttons */
  .qr-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 0 22px 22px;
  }
  .qr-btn {
    padding: 11px 14px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.03em;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    gap: 7px;
    transition: filter 140ms, transform 140ms;
    font-family: inherit;
    text-transform: uppercase;
  }
  .qr-btn:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
  .qr-btn:active { transform: translateY(0); }
  .qr-btn-ghost {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    color: var(--text-1);
  }
  .qr-btn-ghost:hover { background: rgba(255,255,255,0.08); }
  .qr-btn-amber {
    background: rgba(245,158,11,0.1);
    border: 1px solid rgba(245,158,11,0.25);
    color: #f59e0b;
  }
  .qr-btn-full {
    grid-column: span 2;
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    border: none;
    color: #0d0d14;
    box-shadow: 0 6px 20px rgba(245,158,11,0.28);
    font-weight: 800;
    font-size: 13px;
  }
  .qr-btn-full-outline {
    grid-column: span 2;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    color: var(--text-2);
  }

  .qr-footer {
    padding: 0 22px 18px;
    font-size: 11px;
    color: var(--text-3);
    text-align: center;
    line-height: 1.6;
  }

  /* ── Loader ── */
  .fp-loader {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    min-height: 100vh;
    gap: 16px;
  }
  .fp-spinner {
    width: 36px; height: 36px;
    border-radius: 50%;
    border: 2.5px solid rgba(255,255,255,0.06);
    border-top-color: var(--blue);
    animation: fp-spin 0.8s linear infinite;
  }
  @keyframes fp-spin { to { transform: rotate(360deg); } }
  .fp-loader-text {
    font-size: 10.5px;
    font-weight: 700;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  /* ══ TABLET (≤ 1024px) ══ */
  @media (max-width: 1024px) {
    .floor-container { padding: 28px 20px 80px; }
    .kpi-strip { grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 28px; }
    .floor-grid { grid-template-columns: repeat(auto-fill, minmax(165px, 1fr)); gap: 14px; }
    .floor-header { margin-bottom: 24px; }
  }

  /* ══ MOBILE (≤ 768px) ══ */
  @media (max-width: 768px) {
    .floor-container { padding: 20px 16px 100px; }
    .floor-header { flex-direction: column; align-items: flex-start; gap: 14px; margin-bottom: 20px; }
    .floor-title { font-size: 22px !important; }
    .add-table-btn { display: none !important; }
    .add-table-fab { display: flex; }
    .kpi-strip { grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 20px; }
    .kpi-card { padding: 12px 12px; border-radius: 11px; }
    .kpi-label { font-size: 9px !important; }
    .kpi-value { font-size: 20px !important; }
    .floor-grid { grid-template-columns: repeat(auto-fill, minmax(145px, 1fr)); gap: 12px; }
    .qr-box { max-height: 92vh; overflow-y: auto; }
    .fp-toast { bottom: 90px; right: 16px; left: 16px; font-size: 12px; }
    .live-badge-text { display: none; }
  }

  /* ══ PHONE (≤ 480px) ══ */
  @media (max-width: 480px) {
    .floor-container { padding: 16px 12px 100px; }
    .kpi-strip { grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 16px; }
    .kpi-label { display: none; }
    .kpi-value { font-size: 22px !important; }
    .floor-grid { grid-template-columns: repeat(auto-fill, minmax(135px, 1fr)); gap: 10px; }
    .floor-title { font-size: 20px !important; }
    .qr-overlay { padding: 12px; align-items: flex-end; }
    .qr-box { border-radius: 20px 20px 14px 14px; }
  }
`;

/* ─── Component ──────────────────────────────────────────────────────────── */
const FloorPlan = () => {
  const { user } = useAuthStore();
  const { tables, isLoading, fetchTables, setUserContext, updateTableStatus, deleteTable } = useTableStore();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [showCreateModal, setShowCreateModal]     = useState(false);
  const [editingTable, setEditingTable]           = useState<Table | null>(null);
  const [deletingTableId, setDeletingTableId]     = useState<number | null>(null);
  const [assigningTableId, setAssigningTableId]   = useState<number | null>(null);
  const [isDeleting, setIsDeleting]               = useState(false);
  const [isInitialLoad, setIsInitialLoad]         = useState(true);
  const [notification, setNotification]           = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [qrModalTable, setQrModalTable]           = useState<Table | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const permissions = useMemo(() => {
    const role    = user?.role;
    const isAdmin   = role === 'owner' || role === 'admin';
    const isManager = role === 'manager';
    const isWaiter  = role === 'waiter';
    const canModify = isAdmin || isManager;
    return { isAdmin, isManager, isWaiter, canModify, canCreate: canModify };
  }, [user?.role]);

  const { isAdmin, isManager, isWaiter, canModify, canCreate } = permissions;

  const accessibleTables = useMemo(() => tables.filter(table => {
    if (isAdmin || isManager) return true;
    if (isWaiter) return table.assigned_waiter_id === user?.id || !table.assigned_waiter_id;
    return false;
  }), [tables, isAdmin, isManager, isWaiter, user?.id]);

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
      s.id = id; s.textContent = STYLES;
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
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_PUBLIC_MENU_BASE_URL) || '';

  const getPublicBaseUrl = () => {
    const explicit = String(PUBLIC_MENU_BASE_URL || '').trim();
    if (explicit) return explicit.replace(/\/$/, '');
    if (typeof window === 'undefined') return '';
    const { hostname, protocol } = window.location;
    const isVercel = hostname.includes('vercel.app') || hostname.includes('vercel.');
    return isVercel
      ? `https://${hostname}`.replace(/\/$/, '')
      : `${protocol}//${hostname}`.replace(/\/$/, '');
  };

  const getQrUrl   = (table: Table) => table.qr_token ? `${getPublicBaseUrl()}/menu?token=${table.qr_token}` : '';

  const copyQrLink = async (table: Table) => {
    const url = getQrUrl(table);
    if (!url) return;
    try { await navigator.clipboard.writeText(url); showSuccess('Lien copié dans le presse-papiers'); }
    catch  { prompt('Copiez ce lien manuellement :', url); }
  };

  const regenerateQrForTable = async (table: Table) => {
    if (!confirm(`Regénérer le code QR pour la table ${table.table_number} ?\n\nLes anciens liens ne fonctionneront plus.`)) return;
    try {
      const updated: any = await api.tables.regenerateQr(table.id);
      await fetchTables();
      setQrModalTable(prev => prev?.id === table.id ? { ...prev, qr_token: updated.qr_token } : prev);
      showSuccess('Nouveau code QR généré avec succès');
    } catch (e: any) { showError(e?.message || 'Échec de la régénération du QR'); }
  };

  const downloadQrPng = (table: Table) => {
    const canvas = qrCanvasRef.current;
    if (!canvas) { showError('Téléchargement non prêt, réessayez'); return; }
    const link = document.createElement('a');
    link.download = `table-${table.table_number}-menu-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleTableClick = useCallback(async (table: Table) => {
    const canAccess = canModify || (isWaiter && (table.assigned_waiter_id === user?.id || !table.assigned_waiter_id));
    if (!canAccess) { alert(t('tables.noAccess')); return; }
    if (table.status === 'available' || table.status === 'active' || canModify) navigate(`/pos?tableId=${table.id}`);
    else alert(t('tables.tableUnavailable'));
  }, [canModify, isWaiter, user?.id, navigate, t]);

  const handleEdit         = useCallback((table: Table)  => setEditingTable(table),    []);
  const handleDelete       = useCallback((tableId: number) => setDeletingTableId(tableId), []);
  const handleAssignWaiter = useCallback((tableId: number) => setAssigningTableId(tableId), []);

  const confirmDelete = useCallback(async () => {
    if (!deletingTableId) return;
    setIsDeleting(true);
    try {
      const ok = await deleteTable(deletingTableId);
      if (ok) { showSuccess(t('tables.deleteSuccess')); setDeletingTableId(null); }
      else showError(t('tables.deleteFail'));
    } catch { showError(t('tables.genericError')); }
    finally { setIsDeleting(false); }
  }, [deletingTableId, deleteTable, showSuccess, showError, t]);

  const handleStatusChange = useCallback(async (tableId: number, status: string) => {
    try { await updateTableStatus(tableId, status as any); showSuccess(`Statut mis à jour : ${status}`); }
    catch { showError(t('tables.updateFail')); }
  }, [updateTableStatus, showSuccess, showError, t]);

  /* ── Loader ── */
  if (isInitialLoad && isLoading) {
    return (
      <div className="tables-root fp-loader">
        <div className="fp-spinner" />
        <p className="fp-loader-text">{t('tables.loadingFloorPlan')}</p>
      </div>
    );
  }

  /* ── KPI data ── */
  const statsList = [
    { label: t('tables.totalTables'),  value: accessibleTables.length,                                             icon: <Layout size={13} />,       color: '#3b82f6', bg: 'rgba(59,130,246,0.1)'   },
    { label: t('tables.available'),     value: accessibleTables.filter(x => x.status === 'available').length,      icon: <CheckCircle2 size={13} />,  color: '#10b981', bg: 'rgba(16,185,129,0.1)'   },
    { label: t('tables.occupied'),      value: accessibleTables.filter(x => x.status === 'active').length,         icon: <Play size={13} />,           color: '#ef4444', bg: 'rgba(239,68,68,0.1)'    },
    { label: t('tables.reserved'),      value: accessibleTables.filter(x => x.status === 'reserved').length,       icon: <Clock size={13} />,          color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
    { label: t('tables.cleaning'),      value: accessibleTables.filter(x => x.status === 'cleaning').length,       icon: <Settings size={13} />,       color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
    { label: t('tables.outOfService'),  value: accessibleTables.filter(x => x.status === 'out_of_service').length, icon: <Ban size={13} />,            color: '#34344a', bg: 'rgba(255,255,255,0.05)' },
  ];

  /* ── Render ── */
  return (
    <div className="tables-root">
      <div className="floor-container">

        {/* ── Header ── */}
        <div className="floor-header">
          <div>
            <p className="floor-eyebrow">{t('tables.floorPlan')}</p>
            <h1 className="floor-title">{t('tables.title')}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div className="floor-live-badge">
                <span className="live-dot" />
                <span className="live-badge-text">{t('tables.liveFloor')}</span>
              </div>
              <span style={{ color: 'var(--text-3)', fontSize: 12 }}>·</span>
              <span className="floor-role-badge">
                {isAdmin ? t('tables.adminAccess') : isManager ? t('tables.managerAccess') : t('tables.assignedTables')}
              </span>
            </div>
          </div>

          {canCreate && (
            <button className="add-table-btn" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} strokeWidth={2.5} />
              {t('tables.addTable')}
            </button>
          )}
        </div>

        {/* ── KPI Strip ── */}
        <div className="kpi-strip">
          {statsList.map((k, i) => (
            <div key={i} className="kpi-card" style={{ ['--kpi-color' as any]: k.color }}>
              <div className="kpi-icon-row">
                <div className="kpi-icon-wrap" style={{ background: k.bg, color: k.color }}>
                  {k.icon}
                </div>
                <span className="kpi-label">{k.label}</span>
              </div>
              <div className="kpi-value">{k.value}</div>
            </div>
          ))}
        </div>

        {/* ── Floor Grid ── */}
        {accessibleTables.length === 0 ? (
          <div className="floor-empty">
            <div className="floor-empty-icon">
              <Grid size={28} strokeWidth={1.2} />
            </div>
            <p className="floor-empty-title">{t('tables.noAvailable')}</p>
            <p className="floor-empty-sub">{t('tables.startAddingTable')}</p>
          </div>
        ) : (
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
        )}
      </div>

      {/* ── FAB mobile ── */}
      {canCreate && (
        <button className="add-table-fab" onClick={() => setShowCreateModal(true)} aria-label={t('tables.addTable')}>
          <Plus size={22} />
        </button>
      )}

      {/* ── Modals ── */}
      <FloorCreateTableModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={table => { setShowCreateModal(false); showSuccess(`${t('tables.table')} ${table.table_number} ${t('tables.createdSuccess')}`); }}
      />
      <FloorEditTableModal
        table={editingTable}
        isOpen={!!editingTable}
        onClose={() => setEditingTable(null)}
        onSuccess={table => { setEditingTable(null); showSuccess(`${t('tables.table')} ${table.table_number} ${t('tables.updatedSuccess')}`); }}
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
      {qrModalTable?.qr_token && (
        <div className="qr-overlay" onClick={() => setQrModalTable(null)}>
          <div className="qr-box" onClick={e => e.stopPropagation()}>

            {/* Top accent strip */}
            <div className="qr-strip" />

            {/* Header */}
            <div className="qr-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="qr-header-icon"><QrCode size={19} /></div>
                <div>
                  <div className="qr-header-title">Table {qrModalTable.table_number}</div>
                  <div className="qr-header-sub">Menu · En ligne</div>
                </div>
              </div>
              <button className="qr-close-btn" onClick={() => setQrModalTable(null)} aria-label="Fermer">
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>

            {/* QR code */}
            <div className="qr-canvas-wrap">
              <div className="qr-canvas-inner">
                <QRCodeSVG
                  value={getQrUrl(qrModalTable)}
                  size={220} level="M"
                  includeMargin={false}
                  fgColor="#0a2010"
                  bgColor="#ffffff"
                />
              </div>
            </div>

            {/* Hidden hi-res canvas for export */}
            <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}>
              <QRCodeCanvas ref={qrCanvasRef as any} value={getQrUrl(qrModalTable)} size={1024} level="H" includeMargin fgColor="#0a2010" bgColor="#ffffff" />
            </div>

            {/* Token */}
            <div className="qr-token-wrap">
              <div className="qr-token-label">Token</div>
              <div className="qr-token-value">{qrModalTable.qr_token}</div>
            </div>

            {/* Actions */}
            <div className="qr-actions">
              <button className="qr-btn qr-btn-ghost" onClick={() => copyQrLink(qrModalTable)}>
                <Copy size={14} /> Copier
              </button>
              <button className="qr-btn qr-btn-amber" onClick={() => regenerateQrForTable(qrModalTable)}>
                <RefreshCw size={14} /> Régénérer
              </button>
              <button className="qr-btn qr-btn-full-outline" onClick={() => downloadQrPng(qrModalTable)}>
                <Download size={14} /> Télécharger PNG
              </button>
              <button className="qr-btn qr-btn-full" onClick={() => window.open(getQrUrl(qrModalTable), '_blank')}>
                <ExternalLink size={14} /> Ouvrir le menu
              </button>
            </div>

            <div className="qr-footer">
              Menu accessible via Wi‑Fi ou Internet depuis l'appareil du client.
            </div>
          </div>
        </div>
      )}

      {/* ── Toast notification ── */}
      {notification && (
        <div
          className="fp-toast"
          style={{
            background: notification.type === 'success'
              ? 'rgba(15,15,24,0.92)'
              : 'rgba(239,68,68,0.12)',
            border: `1px solid ${notification.type === 'success' ? 'rgba(255,255,255,0.1)' : 'rgba(239,68,68,0.3)'}`,
            color: notification.type === 'success' ? 'var(--text-1)' : '#ef4444',
          }}
        >
          {notification.type === 'success'
            ? <CheckCircle2 size={16} color="#10b981" strokeWidth={2.2} />
            : <Ban size={16} strokeWidth={2.2} />
          }
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default FloorPlan;