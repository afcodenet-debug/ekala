import React, { useState, useEffect } from 'react';
import { X, Edit, Users, CheckCircle2 } from 'lucide-react';
import { useTableStore, Table } from '../../../stores/useTableStore';
import { useI18n } from '../../../lib/i18n';

interface EditTableModalProps {
  table: Table | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (table: Table) => void;
}

export const EditTableModal: React.FC<EditTableModalProps> = ({
  table,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { updateTable } = useTableStore();
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    table_number: '',
    capacity: '',
    status: ''
  });

  useEffect(() => {
    if (table && isOpen) {
      setFormData({
        table_number: table.table_number.toString(),
        capacity: table.capacity.toString(),
        status: table.status
      });
      setError(null);
      setSuccess(false);
    }
  }, [table, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!table) return;

    setIsLoading(true);
    setError(null);

    try {
      const updates = {
        table_number: formData.table_number,
        capacity: Number(formData.capacity),
        status: formData.status as any
      };

      await updateTable(table.id, updates);
      const updatedTable = { ...table, ...updates };

      setSuccess(true);
      setTimeout(() => {
        onSuccess(updatedTable);
      }, 800);
    } catch (err: any) {
      setError(err.message || t('tables.failedUpdateTable'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  if (!isOpen || !table) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 24, width: '100%', maxWidth: 450, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', fontFamily: "'DM Sans', sans-serif" }}>
        
        {/* Header */}
        <div style={{ padding: '24px 30px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--amber-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber)' }}>
              <Edit size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>{t('tables.editTable')} {table.table_number}</h2>
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0' }}>{t('tables.editTableSubtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-3)', padding: 8, cursor: 'pointer' }}><X size={18}/></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px 30px' }}>
          {error && (
            <div style={{ background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', padding: '12px 16px', borderRadius: 12, fontSize: 13, marginBottom: 20 }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ background: 'var(--green-dim)', border: '1px solid var(--green)', color: 'var(--green)', padding: '12px 16px', borderRadius: 12, fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={16} /> {t('tables.updateSuccess')}
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{t('tables.tableNumberLabel')}</label>
            <input
              className="mono"
              type="text"
              required
              value={formData.table_number}
              onChange={(e) => handleInputChange('table_number', e.target.value)}
              style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', color: 'var(--text-1)', fontSize: '18px', fontWeight: 600, outline: 'none' }}
              placeholder={t('tables.tableNumberPlaceholder')}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{t('tables.capacityLabel')}</label>
            <div style={{ position: 'relative' }}>
              <Users size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
              <select
                value={formData.capacity}
                onChange={(e) => handleInputChange('capacity', e.target.value)}
                style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px 12px 40px', color: 'var(--text-1)', fontSize: 14, fontWeight: 500, outline: 'none', appearance: 'none' }}
              >
                {[2,4,6,8,10,12].map(n => <option key={n} value={n}>{n} {t('tables.places')}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 28 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{t('tables.statusLabel')}</label>
            <select
              value={formData.status}
              onChange={(e) => handleInputChange('status', e.target.value)}
              style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', color: 'var(--text-1)', fontSize: 14, fontWeight: 500, outline: 'none' }}
            >
              <option value="available">{t('tables.status.available')}</option>
              <option value="active">{t('tables.status.active')}</option>
              <option value="reserved">{t('tables.status.reserved')}</option>
              <option value="cleaning">{t('tables.status.cleaning')}</option>
              <option value="out_of_service">{t('tables.status.outOfService')}</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '12px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              {t('tables.cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              style={{ padding: '12px', borderRadius: 12, border: 'none', background: 'var(--amber)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 12px rgba(245,158,11,0.3)' }}
            >
              {isLoading ? (
                <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
              ) : (
                <>{t('tables.updateTable')}</>
              )}
            </button>
          </div>
        </form>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};