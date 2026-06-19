import React, { useState, useMemo, useEffect } from 'react';
import { Search, Users, Clock, DollarSign, Filter, Layers, CheckCircle2, Zap, User } from 'lucide-react';
import { useTableStore } from '../../../stores/useTableStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import { usePOSStore } from '../../../stores/usePOSStore';
import { useI18n } from '../../../lib/i18n';
import { useSettingsStore } from '../../../stores/useSettingsStore';
import { formatPrice } from '../../../lib/i18n/currency';
import { EnterpriseTokens } from '../../../lib/design-system';

interface FloorTablesSidebarProps {
  onTableSelect: (tableId: number) => void;
  selectedTableId: number | null;
  layout?: 'vertical' | 'horizontal';
}

const { colors, radius, typography } = EnterpriseTokens;

const STATUS_CONFIG: Record<string, {
  labelKey: string; color: string; dim: string; icon: any;
}> = {
  available:      { labelKey: 'tables.status.available',  color: colors.accent.green,  dim: colors.accent.greenDim,  icon: CheckCircle2 },
  active:         { labelKey: 'tables.status.active',     color: colors.accent.red,    dim: colors.accent.redDim,    icon: Zap },
  reserved:       { labelKey: 'tables.status.reserved',   color: colors.accent.amber,  dim: colors.accent.amberDim,  icon: Clock },
  cleaning:       { labelKey: 'tables.status.cleaning',   color: colors.accent.purple, dim: colors.accent.purpleDim, icon: Filter },
  out_of_service: { labelKey: 'tables.outOfService',      color: colors.text3,         dim: 'rgba(255,255,255,0.02)', icon: Layers },
};

const FILTERS = ['all', 'available', 'active', 'reserved', 'cleaning'] as const;

/* ─── Shared CSS injected once ──────────────────────────────────────────── */
const FLOOR_STYLES = `
  /* ── Horizontal bar ─────────────────────────────────────────── */
  .fts-hbar {
    width: 100%;
    background: ${colors.surface};
    border-bottom: 1px solid ${colors.border};
    font-family: ${typography.sans};
  }

  /* Top control row */
  .fts-hbar-ctrl {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 12px 20px;
    border-bottom: 1px solid ${colors.border};
    background: rgba(255,255,255,0.01);
    flex-wrap: wrap;
  }
  .fts-module-label {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .fts-module-icon {
    width: 32px; height: 32px;
    border-radius: 8px;
    background: ${colors.accent.goldDim};
    display: flex; align-items: center; justify-content: center;
    color: ${colors.accent.gold};
    flex-shrink: 0;
  }
  .fts-rapid-stats {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;
  }
  .fts-stat { display: flex; align-items: center; gap: 6px; }
  .fts-divider { width: 1px; height: 24px; background: ${colors.border}; flex-shrink: 0; }

  /* Filter pills */
  .fts-filters {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    flex-wrap: wrap;
  }
  .fts-filter-btn {
    padding: 6px 12px;
    font-size: 10px; font-weight: 800; letter-spacing: 0.05em;
    border-radius: ${radius.md}; cursor: pointer;
    font-family: inherit;
    transition: all 0.2s;
    text-transform: uppercase;
    white-space: nowrap;
    min-height: 32px;
  }

  /* Search input */
  .fts-search-wrap {
    position: relative;
    width: 220px;
    flex-shrink: 0;
  }
  .fts-search-icon {
    position: absolute; left: 12px; top: 50%;
    transform: translateY(-50%); color: ${colors.text3};
  }
  .fts-search-input {
    width: 100%; background: ${colors.card};
    border: 1px solid ${colors.border};
    border-radius: ${radius.md};
    padding: 10px 12px 10px 36px;
    color: ${colors.text1}; font-size: 12px;
    outline: none; font-family: ${typography.sans};
    transition: all 0.2s;
    min-height: 40px;
  }

  /* Table carousel */
  .fts-carousel {
    display: flex;
    align-items: stretch;
    gap: 12px;
    padding: 16px 20px;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .fts-carousel::-webkit-scrollbar { display: none; }

  /* Individual table card */
  .fts-table-card {
    flex-shrink: 0;
    width: 140px;
    padding: 14px;
    border-radius: ${radius.lg};
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    flex-direction: column;
    gap: 8px;
    position: relative;
    overflow: hidden;
    min-height: 44px; /* touch target */
  }

  /* ── Vertical sidebar ───────────────────────────────────────── */
  .fts-vsidebar {
    width: 280px; min-width: 280px;
    background: ${colors.surface};
    border-right: 1px solid ${colors.border};
    display: flex; flex-direction: column;
    height: 100%;
    font-family: ${typography.sans};
  }
  .fts-vsidebar-header {
    padding: 20px;
    border-bottom: 1px solid ${colors.border};
    flex-shrink: 0;
  }
  .fts-vsidebar-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    -webkit-overflow-scrolling: touch;
  }
  .fts-vsidebar-body::-webkit-scrollbar { width: 0; }
  .fts-vsidebar-footer {
    padding: 16px;
    border-top: 1px solid ${colors.border};
    background: rgba(0,0,0,0.1);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    flex-shrink: 0;
  }
  .fts-vcard {
    padding: 16px; border-radius: ${radius.lg};
    margin-bottom: 8px; cursor: pointer;
    transition: all 0.2s; position: relative;
    min-height: 44px;
  }

  /* ═══════════════════════════════════════════════════════════════
     RESPONSIVE
  ═══════════════════════════════════════════════════════════════ */

  /* ── Tablets (≤ 1024 px) ────────────────────────────────────── */
  @media (max-width: 1024px) {
    .fts-hbar-ctrl  { gap: 14px; padding: 10px 16px; }
    .fts-search-wrap { width: 180px; }
    .fts-carousel   { padding: 12px 16px; gap: 10px; }
    .fts-table-card { width: 128px; padding: 12px; }
  }

  /* ── Large phones (≤ 768 px) ────────────────────────────────── */
  @media (max-width: 768px) {
    .fts-hbar-ctrl {
      gap: 10px; padding: 8px 14px;
      /* Wrap into two rows naturally */
    }
    .fts-module-label span { font-size: 11px !important; }
    .fts-rapid-stats { gap: 10px; }
    .fts-divider { display: none; }                /* hide vertical rule */
    .fts-filters { gap: 4px; }
    .fts-filter-btn { padding: 5px 9px; font-size: 8.5px; min-height: 30px; }

    /* Hide search on mobile — carousel is short enough to scan */
    .fts-search-wrap { display: none; }

    .fts-carousel { padding: 10px 14px; gap: 8px; }
    .fts-table-card { width: 116px; padding: 10px; gap: 6px; }
    .fts-table-card .mono { font-size: 16px !important; }
  }

  /* ── Small phones (≤ 480 px) ────────────────────────────────── */
  @media (max-width: 480px) {
    .fts-hbar-ctrl { padding: 7px 12px; gap: 8px; }
    .fts-module-icon { width: 28px; height: 28px; border-radius: 7px; }
    .fts-module-label span { font-size: 10px !important; }
    .fts-rapid-stats { gap: 8px; }
    .fts-filter-btn { padding: 4px 7px; font-size: 8px; }

    .fts-carousel { padding: 8px 12px; gap: 7px; }
    .fts-table-card { width: 104px; padding: 9px; }
    .fts-table-card .mono { font-size: 14px !important; }

    /* Vertical sidebar becomes full-width overlay on mobile */
    .fts-vsidebar { width: 100% !important; min-width: unset !important; }
  }

  /* ── Touch — larger tap targets ─────────────────────────────── */
  @media (pointer: coarse) {
    .fts-filter-btn { min-height: 26px; }
    .fts-table-card { min-height: 38px; }
    .fts-vcard      { min-height: 42px; }
  }

  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
`;

const getDuration = (createdAt?: string) => {
  if (!createdAt) return '0m';
  const start = new Date(createdAt).getTime();
  const now = Date.now();
  const diff = Math.floor((now - start) / 60000);
  return `${diff}m`;
};

/* ─── HorizontalBar ─────────────────────────────────────────────────────── */
const HorizontalBar: React.FC<{
  tables: any[]; selectedTableId: number | null; onTableClick: (id: number) => void;
  searchTerm: string; setSearchTerm: (v: string) => void;
  statusFilter: string; setStatusFilter: (v: string) => void;
  t: (key: string) => string; lang: any; currency: any;
}> = ({ tables, selectedTableId, onTableClick, searchTerm, setSearchTerm, statusFilter, setStatusFilter, t, lang, currency }) => {

  const activeCount    = tables.filter(t => t.status === 'active').length;
  const availableCount = tables.filter(t => t.status === 'available').length;

  const filteredTables = useMemo(() => tables.filter(t => {
    const matchSearch = t.table_number.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.waiter_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
  }), [tables, searchTerm, statusFilter]);

  return (
    <div className="fts-hbar">
      {/* ── Top Control Bar ── */}
      <div className="fts-hbar-ctrl">
        {/* Module label */}
        <div className="fts-module-label">
          <div className="fts-module-icon"><Layers size={16} /></div>
          <span style={{ fontSize: '14px', fontWeight: 800, color: colors.text1, letterSpacing: '-0.01em' }}>
            {t('pos.floorLive')}
          </span>
        </div>

        {/* Stats */}
        <div className="fts-rapid-stats">
          <div className="fts-stat">
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: colors.accent.red, boxShadow: `0 0 8px ${colors.accent.red}` }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: colors.text1 }}>{activeCount}</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: colors.text3, textTransform: 'uppercase' }}>{t('tables.status.active')}</span>
          </div>
          <div className="fts-stat">
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: colors.accent.green }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: colors.text1 }}>{availableCount}</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: colors.text3, textTransform: 'uppercase' }}>{t('tables.status.available')}</span>
          </div>
        </div>

        <div className="fts-divider" />

        {/* Status filters */}
        <div className="fts-filters">
          {FILTERS.map(status => {
            const isActive = statusFilter === status;
            return (
              <button
                key={status}
                className="fts-filter-btn"
                onClick={() => setStatusFilter(status)}
                style={{
                  border: `1px solid ${isActive ? colors.accent.gold : colors.border}`,
                  background: isActive ? colors.accent.goldDim : colors.card,
                  color: isActive ? colors.accent.gold : colors.text3,
                }}
              >
                {status === 'all' ? t('pos.all') : t(STATUS_CONFIG[status].labelKey)}
              </button>
            );
          })}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Search */}
        <div className="fts-search-wrap">
          <Search size={14} className="fts-search-icon" />
          <input
            type="text"
            placeholder={t('pos.searchTable')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="fts-search-input"
            onFocus={e => (e.target.style.borderColor = colors.accent.blue)}
            onBlur={e  => (e.target.style.borderColor = colors.border)}
          />
        </div>
      </div>

      {/* ── Table Carousel ── */}
      <div className="fts-carousel">
        {filteredTables.map(table => {
          const cfg        = STATUS_CONFIG[table.status] || STATUS_CONFIG.out_of_service;
          const isSelected = selectedTableId === table.id;

          return (
            <div
              key={table.id}
              className="fts-table-card"
              onClick={() => onTableClick(table.id)}
              style={{
                border: `1px solid ${isSelected ? colors.accent.gold : colors.border}`,
                background: isSelected ? colors.accent.goldDim : colors.card,
                boxShadow: isSelected ? `0 8px 24px rgba(212,175,55,0.1)` : 'none',
              }}
              onMouseOver={e => { if (!isSelected) { e.currentTarget.style.borderColor = colors.borderHi; e.currentTarget.style.transform = 'translateY(-2px)'; } }}
              onMouseOut={e  => { if (!isSelected) { e.currentTarget.style.borderColor = colors.border;   e.currentTarget.style.transform = 'translateY(0)';   } }}
            >
              {/* Number + glow */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
                <span className="mono" style={{ fontSize: 24, fontWeight: 700, color: isSelected ? colors.accent.gold : colors.text1, lineHeight: 1 }}>
                  {table.table_number}
                </span>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, boxShadow: `0 0 10px ${cfg.color}` }} />
              </div>

              {/* Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, zIndex: 1 }}>
                <cfg.icon size={10} color={cfg.color} />
                <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.05em', color: cfg.color }}>{t(cfg.labelKey)}</span>
              </div>

              {/* Capacity & waiter */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: colors.text3, fontSize: 10, fontWeight: 700 }}>
                  <Users size={10} /> {table.capacity}
                </div>
                {table.waiter_name && (
                  <span style={{ fontSize: 10, color: colors.text2, fontWeight: 600, maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {table.waiter_name.split(' ')[0]}
                  </span>
                )}
              </div>

              {/* Active order info */}
              {table.status === 'active' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, paddingTop: 8, borderTop: `1px solid ${isSelected ? 'rgba(212,175,55,0.1)' : colors.border}`, zIndex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <DollarSign size={8} color={colors.accent.gold} />
                    <span className="mono" style={{ fontSize: 6, fontWeight: 800, color: colors.accent.gold }}>
                      {formatPrice(table.active_order_total || 0, currency, lang)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Clock size={10} color={colors.text3} />
                    <span className="mono" style={{ fontSize: 10, color: colors.text3 }}>
                      {getDuration(table.active_order_created_at)}
                    </span>
                  </div>
                </div>
              )}

              {/* Background accent */}
              {table.status === 'active' && !isSelected && (
                <div style={{ position: 'absolute', top: -20, right: -20, width: 50, height: 50, background: colors.accent.red, opacity: 0.03, borderRadius: '50%', filter: 'blur(20px)' }} />
              )}
            </div>
          );
        })}

        {filteredTables.length === 0 && (
          <div style={{ padding: '20px', color: colors.text3, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Layers size={18} opacity={0.3} />
            <span>{t('tables.noneFound')}</span>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── VerticalSidebar ───────────────────────────────────────────────────── */
const VerticalSidebar: React.FC<{
  tables: any[]; selectedTableId: number | null; onTableClick: (id: number) => void;
  searchTerm: string; setSearchTerm: (v: string) => void;
  statusFilter: string; setStatusFilter: (v: string) => void;
  t: (key: string) => string; lang: any; currency: any;
}> = ({ tables, selectedTableId, onTableClick, searchTerm, setSearchTerm, statusFilter, setStatusFilter, t, lang, currency }) => {

  const filteredTables = useMemo(() => tables.filter(t => {
    const matchSearch = t.table_number.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.waiter_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
  }), [tables, searchTerm, statusFilter]);

  return (
    <div className="fts-vsidebar">
      <div className="fts-vsidebar-header">
        <h2 style={{ fontSize: 16, fontWeight: 800, color: colors.text1, margin: '0 0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{t('tables.floor')}</span>
          <span style={{ fontSize: 11, color: colors.text3, fontWeight: 700 }}>{tables.length} {t('tables.totalTables')}</span>
        </h2>

        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: colors.text3 }} />
          <input
            type="text" placeholder={t('pos.searchTable')} value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', background: colors.card, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: '10px 12px 10px 36px', color: colors.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', minHeight: 42 }}
          />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {FILTERS.map(status => {
            const isActive = statusFilter === status;
            return (
              <button key={status} onClick={() => setStatusFilter(status)} style={{ padding: '5px 10px', fontSize: 10, fontWeight: 800, borderRadius: radius.sm, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${isActive ? colors.accent.gold : colors.border}`, background: isActive ? colors.accent.goldDim : 'transparent', color: isActive ? colors.accent.gold : colors.text3, textTransform: 'uppercase', minHeight: 32 }}>
                {status === 'all' ? t('pos.all') : t(STATUS_CONFIG[status].labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="fts-vsidebar-body">
        {filteredTables.map(table => {
          const cfg  = STATUS_CONFIG[table.status] || STATUS_CONFIG.out_of_service;
          const isSel = selectedTableId === table.id;
          return (
            <div key={table.id} className="fts-vcard" onClick={() => onTableClick(table.id)} style={{ border: `1px solid ${isSel ? colors.accent.gold : colors.border}`, background: isSel ? colors.accent.goldDim : colors.card }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="mono" style={{ width: 40, height: 40, borderRadius: radius.md, background: isSel ? colors.accent.gold : colors.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: isSel ? colors.bg : colors.text1, flexShrink: 0 }}>
                    {table.table_number}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: colors.text1 }}>{t('pos.tableLabel')} {table.table_number}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Users size={12} color={colors.text3} />
                      <span style={{ fontSize: 11, color: colors.text3, fontWeight: 600 }}>{table.capacity} {t('pos.places')}</span>
                    </div>
                    {table.waiter_name && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <User size={12} color={colors.accent.blue} />
                        <span style={{ fontSize: 11, color: colors.text2, fontWeight: 700 }}>
                          {table.waiter_name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 100, background: cfg.dim, border: `1px solid ${cfg.color}33` }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color }} />
                  <span style={{ fontSize: 9, fontWeight: 900, color: cfg.color }}>{t(cfg.labelKey)}</span>
                </div>
              </div>

              {table.status === 'active' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: `1px solid ${isSel ? 'rgba(212,175,55,0.1)' : colors.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <DollarSign size={8} color={colors.accent.gold} />
                    <span className="mono" style={{ fontSize: 8, fontWeight: 700, color: colors.accent.gold }}>
                      {formatPrice(table.active_order_total || 0, currency, lang)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} color={colors.text3} />
                    <span className="mono" style={{ fontSize: 11, color: colors.text3 }}>
                      {getDuration(table.active_order_created_at).toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="fts-vsidebar-footer">
        <div style={{ background: colors.accent.redDim, border: `1px solid ${colors.accent.red}22`, borderRadius: radius.md, padding: 12, textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: colors.accent.red }}>{tables.filter(t => t.status === 'active').length}</div>
          <div style={{ fontSize: 10, color: colors.text3, fontWeight: 800, textTransform: 'uppercase' }}>{t('tables.occupiedFooter')}</div>
        </div>
        <div style={{ background: colors.accent.greenDim, border: `1px solid ${colors.accent.green}22`, borderRadius: radius.md, padding: 12, textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: colors.accent.green }}>{tables.filter(t => t.status === 'available').length}</div>
          <div style={{ fontSize: 10, color: colors.text3, fontWeight: 800, textTransform: 'uppercase' }}>{t('tables.freeFooter')}</div>
        </div>
      </div>
    </div>
  );
};

/* ─── FloorTablesSidebar (main export) ──────────────────────────────────── */
export const FloorTablesSidebar: React.FC<FloorTablesSidebarProps> = ({
  onTableSelect, selectedTableId, layout = 'vertical',
}) => {
  const { user } = useAuthStore();
  const { tables, isLoading, fetchTables } = useTableStore();
  const { selectTable } = usePOSStore();
  const [searchTerm, setSearchTerm]     = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { t, lang } = useI18n();
  const { currency } = useSettingsStore();

  /* Inject styles once */
  useEffect(() => {
    const id = 'fts-styles';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id;
      s.textContent = FLOOR_STYLES;
      document.head.appendChild(s);
    }
  }, []);

  const handleTableClick = (tableId: number) => {
    selectTable(tableId);
    onTableSelect(tableId);
  };

  useEffect(() => { if (user) fetchTables(); }, [user, fetchTables]);

  if (isLoading) {
    return (
      <div style={{
        width: layout === 'horizontal' ? '100%' : '280px',
        background: colors.surface,
        borderBottom: layout === 'horizontal' ? `1px solid ${colors.border}` : 'none',
        borderRight: layout === 'vertical' ? `1px solid ${colors.border}` : 'none',
        padding: '20px', display: 'flex', gap: '12px',
        flexDirection: layout === 'vertical' ? 'column' : 'row',
        overflowX: layout === 'horizontal' ? 'hidden' : undefined,
      }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{
            width: layout === 'horizontal' ? '140px' : '100%',
            height: layout === 'horizontal' ? '100px' : '72px',
            flexShrink: 0,
            background: colors.card,
            borderRadius: radius.lg,
            border: `1px solid ${colors.border}`,
            animation: 'pulse 1.5s infinite ease-in-out',
          }} />
        ))}
      </div>
    );
  }

  const props = { tables, selectedTableId, onTableClick: handleTableClick, searchTerm, setSearchTerm, statusFilter, setStatusFilter, t, lang, currency };

  return (
    layout === 'horizontal'
      ? <HorizontalBar {...props} />
      : <VerticalSidebar {...props} />
  );
};