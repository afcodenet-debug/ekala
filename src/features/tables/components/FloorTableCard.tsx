import React from 'react';
import { User, Settings, Trash2, Edit, Play, Ban, CheckCircle, Clock, UserPlus, QrCode } from 'lucide-react';
import { useAuthStore } from '../../../stores/useAuthStore';
import { Table } from '../../../stores/useTableStore';
import { useI18n } from '../../../lib/i18n';

interface TableCardProps {
  table: Table;
  onEdit: (table: Table) => void;
  onDelete: (tableId: number) => void;
  onAssignWaiter: (tableId: number) => void;
  onStatusChange: (tableId: number, status: string) => void;
  onShowQR?: (table: Table) => void;
}

export const FloorTableCard: React.FC<TableCardProps> = ({
  table,
  onEdit,
  onDelete,
  onAssignWaiter,
  onStatusChange,
  onShowQR
}) => {
  const { user } = useAuthStore();
  const { t } = useI18n();
  
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isWaiter = user?.role === 'waiter';

  const canModify = isAdmin || isManager;
  const canAccess = canModify || (isWaiter && (table.assigned_waiter_id === user?.id || !table.assigned_waiter_id));

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'available':
        return { color: 'var(--green)', dim: 'var(--green-dim)', label: t('tables.status.available'), icon: CheckCircle };
      case 'active':
        return { color: 'var(--red)', dim: 'var(--red-dim)', label: t('tables.status.active'), icon: Play };
      case 'reserved':
        return { color: 'var(--amber)', dim: 'var(--amber-dim)', label: t('tables.status.reserved'), icon: Clock };
      case 'cleaning':
        return { color: 'var(--purple)', dim: 'var(--purple-dim)', label: t('tables.status.cleaning'), icon: Settings };
      case 'out_of_service':
        return { color: 'var(--text-3)', dim: 'rgba(255,255,255,0.04)', label: t('tables.status.outOfService'), icon: Ban };
      default:
        return { color: 'var(--text-3)', dim: 'var(--surface)', label: status, icon: Settings };
    }
  };

  const statusConfig = getStatusConfig(table.status);

  const handleStatusChange = async (newStatus: string) => {
    if (!canModify) return;
    onStatusChange(table.id, newStatus);
  };

  return (
    <div
      style={{
        position: 'relative',
        cursor: canAccess ? 'pointer' : 'not-allowed',
        opacity: canAccess ? 1 : 0.6,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      className="group"
    >
      {/* Table Main Body */}
      <div 
        style={{
          aspectRatio: '1',
          borderRadius: '36px',
          border: `1px solid ${table.status === 'active' ? 'var(--gold-dim)' : 'var(--border)'}`,
          background: table.status === 'active' ? 'var(--card-hi)' : 'var(--card)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          boxShadow: table.status === 'active' ? '0 12px 32px rgba(212,175,55,0.08)' : 'none',
          position: 'relative',
          overflow: 'hidden',
          padding: '20px'
        }}
        onMouseOver={(e) => { 
          if (canAccess) {
            e.currentTarget.style.borderColor = 'var(--border-hi)';
            e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)';
            e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.4)';
          }
        }}
        onMouseOut={(e) => {
          if (canAccess) {
            e.currentTarget.style.borderColor = table.status === 'active' ? 'var(--gold-dim)' : 'var(--border)';
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = table.status === 'active' ? '0 12px 32px rgba(212,175,55,0.08)' : 'none';
          }
        }}
      >
        {/* Glow effect for active tables */}
        {table.status === 'active' && (
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 0%, var(--gold-dim) 0%, transparent 70%)', opacity: 0.5 }} />
        )}

        {/* Top Label (Capacity) */}
        <div style={{ position: 'absolute', top: '24px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-3)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <User size={10} strokeWidth={3} /> {table.capacity} {t('tables.places')}
        </div>

        {/* Permanent small QR trigger for admins/managers (always visible) */}
        {canModify && onShowQR && (
          <button
            onClick={(e) => { e.stopPropagation(); onShowQR(table); }}
            style={{ position: 'absolute', top: '22px', right: '22px', width: 28, height: 28, borderRadius: 8, background: 'var(--gold-dim)', border: '1px solid var(--gold)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 5, transition: 'all 0.2s ease' }}
            title="Afficher le QR Code du menu"
            onMouseOver={e => { e.currentTarget.style.background = 'var(--gold)'; e.currentTarget.style.color = '#0a2f1f'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'var(--gold-dim)'; e.currentTarget.style.color = 'var(--gold)'; }}
          >
            <QrCode size={15} />
          </button>
        )}

        {/* Table Number */}
        <span 
          className="mono" 
          style={{ 
            fontSize: '28px', 
            fontWeight: 700, 
            letterSpacing: '-0.06em',
            color: table.status === 'active' ? 'var(--gold)' : 'var(--text-1)',
            lineHeight: 1,
            marginBottom: '4px',
            zIndex: 1
          }}
        >
          {table.table_number}
        </span>

        {/* Status Badge */}
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '4px 12px', borderRadius: '20px',
          background: statusConfig.dim, border: `1px solid ${statusConfig.color}33`,
          color: statusConfig.color, fontSize: '9px', fontWeight: 900,
          textTransform: 'uppercase', letterSpacing: '0.1em',
          zIndex: 1
        }}>
          {statusConfig.label}
        </div>

        {/* Waiter / Footer Info */}
        <div style={{ 
          position: 'absolute', bottom: '24px', 
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px'
        }}>
          {table.waiter_name ? (
            <div style={{ 
              fontSize: '10px', color: 'var(--text-2)', 
              fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px',
              padding: '2px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px'
            }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--blue)', boxShadow: '0 0 4px var(--blue)' }} />
              {table.waiter_name.toUpperCase()}
            </div>
          ) : (
            <div style={{ fontSize: '9px', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>{t('tables.unassigned')}</div>
          )}
        </div>
      </div>

      {/* Admin Action Dock (Top Right) */}
      {canModify && (
        <div 
          className="opacity-0 group-hover:opacity-100"
          style={{ 
            position: 'absolute', top: '10px', right: '10px', 
            display: 'flex', flexDirection: 'column', gap: '6px', 
            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            transform: 'translateX(10px)',
            zIndex: 10
          }}
          onMouseOver={(e) => { e.currentTarget.style.transform = 'translateX(0)'; }}
        >
          {[
            ...(onShowQR ? [{ icon: <QrCode size={14} />, color: 'var(--gold)', action: () => onShowQR(table), title: 'QR Menu' }] : []),
            { icon: <Edit size={14} />, color: 'var(--blue)', action: () => onEdit(table), title: t('tables.edit') },
            { icon: <UserPlus size={14} />, color: 'var(--green)', action: () => onAssignWaiter(table.id), title: t('tables.assign') },
            { icon: <Trash2 size={14} />, color: 'var(--red)', action: () => onDelete(table.id), title: t('tables.delete') },
          ].map((btn, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); btn.action(); }}
              style={{ 
                width: 36, height: 36, borderRadius: '12px', 
                background: 'var(--card-hi)', border: '1px solid var(--border-hi)', 
                color: btn.color, display: 'flex', alignItems: 'center', 
                justifyContent: 'center', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.transform = 'scale(1.1)'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'var(--card-hi)'; e.currentTarget.style.transform = 'scale(1)'; }}
              title={btn.title}
            >
              {btn.icon}
            </button>
          ))}
        </div>
      )}

      {/* Status Switcher Dock (Bottom) */}
      {canModify && (
        <div 
          className="opacity-0 group-hover:opacity-100"
          style={{ 
            position: 'absolute', bottom: '-18px', left: '50%', transform: 'translateX(-50%) translateY(10px)',
            background: 'var(--card-hi)', border: '1px solid var(--border-hi)', 
            borderRadius: '16px', padding: '6px', display: 'flex', gap: '6px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)', transition: 'all 0.3s ease',
            zIndex: 10
          }}
        >
          {['available', 'reserved', 'cleaning', 'out_of_service'].map(st => {
            if (st === table.status) return null;
            const cfg = getStatusConfig(st);
            return (
              <button
                key={st}
                onClick={(e) => { e.stopPropagation(); handleStatusChange(st); }}
                style={{ 
                  width: 32, height: 32, borderRadius: '10px', 
                  background: 'var(--surface)', border: '1px solid transparent', 
                  color: cfg.color, display: 'flex', alignItems: 'center', 
                  justifyContent: 'center', cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = cfg.color; e.currentTarget.style.background = 'var(--card)'; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'var(--surface)'; }}
                title={cfg.label}
              >
                <cfg.icon size={15} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
