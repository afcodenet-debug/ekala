import React, { useState, useMemo, useEffect } from 'react';
import { Search, Users, Clock, DollarSign, Filter, Layers, CheckCircle2, Zap } from 'lucide-react';
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
  labelKey: string;
  color: string;
  dim: string;
  icon: any;
}> = {
  available:      { labelKey: 'tables.status.available',   color: colors.accent.green,  dim: colors.accent.greenDim,  icon: CheckCircle2 },
  active:         { labelKey: 'tables.status.active',      color: colors.accent.red,    dim: colors.accent.redDim,    icon: Zap },
  reserved:       { labelKey: 'tables.status.reserved',    color: colors.accent.amber,  dim: colors.accent.amberDim,  icon: Clock },
  cleaning:       { labelKey: 'tables.status.cleaning',    color: colors.accent.purple, dim: colors.accent.purpleDim, icon: Filter },
  out_of_service: { labelKey: 'tables.outOfService',       color: colors.text3,         dim: 'rgba(255,255,255,0.02)', icon: Layers },
};

const FILTERS = ['all', 'available', 'active', 'reserved', 'cleaning'] as const;

/* ─── Barre horizontale Enterprise ────────────────────────────────────────── */

const HorizontalBar: React.FC<{
  tables: any[];
  selectedTableId: number | null;
  onTableClick: (id: number) => void;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  t: (key: string) => string;
  lang: any;
  currency: any;
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
    <div style={{
      width: '100%',
      background: colors.surface,
      borderBottom: `1px solid ${colors.border}`,
      fontFamily: typography.sans,
    }}>
      {/* ── Top Control Bar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        padding: '12px 20px',
        borderBottom: `1px solid ${colors.border}`,
        background: 'rgba(255,255,255,0.01)'
      }}>
        {/* Module Label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: colors.accent.goldDim, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.accent.gold }}>
             <Layers size={16} />
          </div>
           <span style={{ fontSize: '14px', fontWeight: 800, color: colors.text1, letterSpacing: '-0.01em' }}>
             {t('pos.floorLive')}
           </span>
        </div>

        {/* Rapid Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: colors.accent.red, boxShadow: `0 0 8px ${colors.accent.red}` }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: colors.text1 }}>{activeCount}</span>
            <span style={{ fontSize: '10px', fontWeight: 800, color: colors.text3, textTransform: 'uppercase' }}>{t('tables.status.active')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: colors.accent.green }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: colors.text1 }}>{availableCount}</span>
            <span style={{ fontSize: '10px', fontWeight: 800, color: colors.text3, textTransform: 'uppercase' }}>{t('tables.status.available')}</span>
          </div>
        </div>

        <div style={{ width: '1px', height: '24px', background: colors.border }} />

        {/* Status Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {FILTERS.map(status => {
            const isAll = status === 'all';
            const isActive = statusFilter === status;
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                style={{
                  padding: '6px 12px',
                  fontSize: '10px', fontWeight: 800, letterSpacing: '0.05em',
                  borderRadius: radius.md, cursor: 'pointer', fontFamily: 'inherit',
                  border: `1px solid ${isActive ? colors.accent.gold : colors.border}`,
                  background: isActive ? colors.accent.goldDim : colors.card,
                  color: isActive ? colors.accent.gold : colors.text3,
                  transition: 'all 0.2s',
                  textTransform: 'uppercase'
                }}
              >
                {isAll ? t('pos.all') : t(STATUS_CONFIG[status].labelKey)}
              </button>
            );
          })}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Search Portal */}
        <div style={{ position: 'relative', width: '220px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: colors.text3 }} />
          <input
            type="text"
            placeholder={t('pos.searchTable')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%', background: colors.card, border: `1px solid ${colors.border}`,
              borderRadius: radius.md, padding: '10px 12px 10px 36px',
              color: colors.text1, fontSize: '12px', outline: 'none', fontFamily: typography.sans,
              transition: 'all 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = colors.accent.blue}
            onBlur={(e) => e.target.style.borderColor = colors.border}
          />
        </div>
      </div>

      {/* ── Table Carousel ── */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: '12px',
          padding: '16px 20px',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
        }}
        className="custom-scroll"
      >
        {filteredTables.map(table => {
          const cfg = STATUS_CONFIG[table.status] || STATUS_CONFIG.out_of_service;
          const isSelected = selectedTableId === table.id;

          return (
            <div
              key={table.id}
              onClick={() => onTableClick(table.id)}
              style={{
                flexShrink: 0,
                width: '140px',
                padding: '14px',
                borderRadius: radius.lg,
                cursor: 'pointer',
                border: `1px solid ${isSelected ? colors.accent.gold : colors.border}`,
                background: isSelected ? colors.accent.goldDim : colors.card,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                boxShadow: isSelected ? `0 8px 24px rgba(212,175,55,0.1)` : 'none',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseOver={(e) => { if (!isSelected) { e.currentTarget.style.borderColor = colors.borderHi; e.currentTarget.style.transform = 'translateY(-2px)'; } }}
              onMouseOut={(e) => { if (!isSelected) { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.transform = 'translateY(0)'; } }}
            >
              {/* Table Number + Status Glow */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
                <span className="mono" style={{ fontSize: '24px', fontWeight: 700, color: isSelected ? colors.accent.gold : colors.text1, lineHeight: 1 }}>
                  {table.table_number}
                </span>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cfg.color, boxShadow: `0 0 10px ${cfg.color}` }} />
              </div>

              {/* Status Indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', zIndex: 1 }}>
                  <cfg.icon size={10} color={cfg.color} />
                  <span style={{ fontSize: '9px', fontWeight: 900, letterSpacing: '0.05em', color: cfg.color }}>{t(cfg.labelKey)}</span>
              </div>

              {/* Capacity & Waiter */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', zIndex: 1 }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: colors.text3, fontSize: '10px', fontWeight: 700 }}>
                    <Users size={10} /> {table.capacity}
                 </div>
                 {table.waiter_name && (
                   <span style={{ fontSize: '10px', color: colors.text2, fontWeight: 600, maxWidth: '70px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                     {table.waiter_name.split(' ')[0]}
                   </span>
                 )}
              </div>

              {/* Order Info for Active Tables */}
              {table.status === 'active' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', paddingTop: '8px', borderTop: `1px solid ${isSelected ? 'rgba(212,175,55,0.1)' : colors.border}`, zIndex: 1 }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                       <DollarSign size={10} color={colors.accent.gold} />
                       <span className="mono" style={{ fontSize: '11px', fontWeight: 800, color: colors.accent.gold }}>{formatPrice(45.8, currency, lang)}</span>
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Clock size={10} color={colors.text3} />
                      <span className="mono" style={{ fontSize: '10px', color: colors.text3 }}>23m</span>
                   </div>
                </div>
              )}
              
              {/* Background Accent for Active Tables */}
              {table.status === 'active' && !isSelected && (
                <div style={{ position: 'absolute', top: -20, right: -20, width: '50px', height: '50px', background: colors.accent.red, opacity: 0.03, borderRadius: '50%', filter: 'blur(20px)' }} />
              )}
            </div>
          );
        })}

        {filteredTables.length === 0 && (
          <div style={{ padding: '20px', color: colors.text3, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers size={18} opacity={0.3} />
            <span>{t('tables.noneFound')}</span>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Vertical Sidebar Redesign ───────────────────────────────────────────── */

const VerticalSidebar: React.FC<{
  tables: any[];
  selectedTableId: number | null;
  onTableClick: (id: number) => void;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  t: (key: string) => string;
  lang: any;
  currency: any;
}> = ({ tables, selectedTableId, onTableClick, searchTerm, setSearchTerm, statusFilter, setStatusFilter, t, lang, currency }) => {
  const filteredTables = useMemo(() => tables.filter(t => {
    const matchSearch = t.table_number.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.waiter_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
  }), [tables, searchTerm, statusFilter]);

  return (
    <div style={{
      width: '280px', minWidth: '280px',
      background: colors.surface,
      borderRight: `1px solid ${colors.border}`,
      display: 'flex', flexDirection: 'column',
      height: '100%',
      fontFamily: typography.sans,
    }}>
      <div style={{ padding: '20px', borderBottom: `1px solid ${colors.border}` }}>
        <h2 style={{ fontSize: '16px', fontWeight: 800, color: colors.text1, margin: '0 0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{t('tables.floor')}</span>
          <span style={{ fontSize: '11px', color: colors.text3, fontWeight: 700 }}>{tables.length} {t('tables.totalTables')}</span>
        </h2>
        
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: colors.text3 }} />
          <input
            type="text" placeholder={t('pos.searchTable')} value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%', background: colors.card,
              border: `1px solid ${colors.border}`, borderRadius: radius.md,
              padding: '10px 12px 10px 36px', color: colors.text1,
              fontSize: '13px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {FILTERS.map(status => {
            const isAll = status === 'all';
            const isActive = statusFilter === status;
            return (
              <button key={status} onClick={() => setStatusFilter(status)} style={{
                padding: '5px 10px', fontSize: '10px', fontWeight: 800,
                borderRadius: radius.sm, cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${isActive ? colors.accent.gold : colors.border}`,
                background: isActive ? colors.accent.goldDim : 'transparent',
                color: isActive ? colors.accent.gold : colors.text3,
                textTransform: 'uppercase'
              }}>
                {isAll ? t('pos.all') : t(STATUS_CONFIG[status].labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }} className="custom-scroll">
        {filteredTables.map(table => {
          const cfg = STATUS_CONFIG[table.status] || STATUS_CONFIG.out_of_service;
          const isSel = selectedTableId === table.id;
          return (
            <div key={table.id} onClick={() => onTableClick(table.id)} style={{
              padding: '16px', borderRadius: radius.lg, marginBottom: '8px', cursor: 'pointer',
              border: `1px solid ${isSel ? colors.accent.gold : colors.border}`,
              background: isSel ? colors.accent.goldDim : colors.card,
              transition: 'all 0.2s', position: 'relative',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="mono" style={{
                    width: '40px', height: '40px', borderRadius: radius.md,
                    background: isSel ? colors.accent.gold : colors.surface,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px', fontWeight: 700, color: isSel ? colors.bg : colors.text1,
                  }}>{table.table_number}</div>
                  <div>
                     <div style={{ fontSize: '14px', fontWeight: 700, color: colors.text1 }}>{t('pos.tableLabel')} {table.table_number}</div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                       <Users size={12} color={colors.text3} />
                       <span style={{ fontSize: '11px', color: colors.text3, fontWeight: 600 }}>{table.capacity} {t('pos.places')}</span>
                     </div>
                  </div>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '4px 10px', borderRadius: '100px',
                  background: cfg.dim, border: `1px solid ${cfg.color}33`,
                }}>
                   <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: cfg.color }} />
                   <span style={{ fontSize: '9px', fontWeight: 900, color: cfg.color }}>{t(cfg.labelKey)}</span>
                </div>
              </div>
              
              {table.status === 'active' && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  paddingTop: '12px', borderTop: `1px solid ${isSel ? 'rgba(212,175,55,0.1)' : colors.border}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                     <DollarSign size={12} color={colors.accent.gold} />
                     <span className="mono" style={{ fontSize: '13px', fontWeight: 700, color: colors.accent.gold }}>{formatPrice(45.8, currency, lang)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} color={colors.text3} />
                    <span className="mono" style={{ fontSize: '11px', color: colors.text3 }}>23 MIN</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{
        padding: '16px', borderTop: `1px solid ${colors.border}`,
        background: 'rgba(0,0,0,0.1)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px',
      }}>
        <div style={{ background: colors.accent.redDim, border: `1px solid ${colors.accent.red}22`, borderRadius: radius.md, padding: '12px', textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: '20px', fontWeight: 800, color: colors.accent.red }}>{tables.filter(t => t.status === 'active').length}</div>
           <div style={{ fontSize: '10px', color: colors.text3, fontWeight: 800, textTransform: 'uppercase' }}>{t('tables.occupiedFooter')}</div>
        </div>
        <div style={{ background: colors.accent.greenDim, border: `1px solid ${colors.accent.green}22`, borderRadius: radius.md, padding: '12px', textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: '20px', fontWeight: 800, color: colors.accent.green }}>{tables.filter(t => t.status === 'available').length}</div>
           <div style={{ fontSize: '10px', color: colors.text3, fontWeight: 800, textTransform: 'uppercase' }}>{t('tables.freeFooter')}</div>
        </div>
      </div>
    </div>
  );
};

/* ─── Composant principal ─────────────────────────────────────────────────── */

export const FloorTablesSidebar: React.FC<FloorTablesSidebarProps> = ({
  onTableSelect,
  selectedTableId,
  layout = 'vertical',
}) => {
  const { user } = useAuthStore();
  const { tables, isLoading, fetchTables } = useTableStore();
  const { selectTable } = usePOSStore();
  const [searchTerm, setSearchTerm]     = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { t, lang } = useI18n();
  const { currency } = useSettingsStore();

  const handleTableClick = (tableId: number) => {
    selectTable(tableId);
    onTableSelect(tableId);
  };

  useEffect(() => {
    if (user) fetchTables();
  }, [user, fetchTables]);

  if (isLoading) {
    return (
      <div style={{
        width: layout === 'horizontal' ? '100%' : '280px',
        background: colors.surface,
        borderBottom: layout === 'horizontal' ? `1px solid ${colors.border}` : 'none',
        borderRight: layout === 'vertical' ? `1px solid ${colors.border}` : 'none',
        padding: '20px', display: 'flex', gap: '12px', flexDirection: layout === 'vertical' ? 'column' : 'row'
      }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{
            width: layout === 'horizontal' ? '140px' : '100%',
            height: layout === 'horizontal' ? '100px' : '72px',
            flexShrink: 0,
            background: colors.card,
            borderRadius: radius.lg,
            border: `1px solid ${colors.border}`,
            animation: 'pulse 1.5s infinite ease-in-out'
          }} />
        ))}
      </div>
    );
  }

  const props = { tables, selectedTableId, onTableClick: handleTableClick, searchTerm, setSearchTerm, statusFilter, setStatusFilter, t, lang, currency };

  return (
    <>
      <style>{`
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
      `}</style>
      {layout === 'horizontal' ? <HorizontalBar {...props} /> : <VerticalSidebar {...props} />}
    </>
  );
};
