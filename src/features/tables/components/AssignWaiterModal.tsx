import React, { useState, useEffect, useRef } from 'react';
import { X, UserPlus, User, CheckCircle2 } from 'lucide-react';
import { useTableStore } from '../../../stores/useTableStore';
import { useI18n } from '../../../lib/i18n';
import { api } from '../../../lib/api-client';

interface AssignWaiterModalProps {
  tableId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AssignWaiterModal: React.FC<AssignWaiterModalProps> = ({
  tableId,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { assignWaiter, tables } = useTableStore();
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWaiterId, setSelectedWaiterId] = useState<string>('');
  const [waiters, setWaiters] = useState<any[]>([]);
  const [loadingWaiters, setLoadingWaiters] = useState(false);
  const hasLoadedRef = useRef(false);

  const table = tables.find(t => t.id === tableId);

  useEffect(() => {
    if (isOpen && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      fetchWaiters();
      setSelectedWaiterId(table?.assigned_waiter_id?.toString() || '');
      setError(null);
    }
    if (!isOpen) {
      hasLoadedRef.current = false;
    }
  }, [isOpen]);

  const fetchWaiters = async () => {
    setLoadingWaiters(true);
    try {
      const response = await api.users.getAll();
      const data = response as any;
      const allUsers = Array.isArray(data) ? data : (data.users || []);
      const waiterUsers = allUsers.filter((u: any) => u.role === 'waiter' && u.is_active !== 0);
      setWaiters(waiterUsers);
    } catch (err) {
      console.error('Failed to fetch waiters:', err);
      setError(t('tables.failedLoadWaiters'));
    } finally {
      setLoadingWaiters(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableId) return;

    setIsLoading(true);
    setError(null);

    try {
      const waiterId = selectedWaiterId ? Number(selectedWaiterId) : null;
      await assignWaiter(tableId, waiterId);
      onSuccess();
    } catch (err: any) {
      setError(err.message || t('tables.failedAssignWaiter'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 24, width: '100%', maxWidth: 450, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', fontFamily: "'DM Sans', sans-serif" }}>
        
        {/* Header */}
        <div style={{ padding: '24px 30px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--green-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)' }}>
              <UserPlus size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>{t('tables.assignWaiterTitle')}</h2>
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0' }}>{t('tables.assignWaiterSubtitle', { tableNumber: table?.table_number ?? '' })}</p>
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

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>{t('tables.selectWaiterLabel')}</label>

            {loadingWaiters ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 12, color: 'var(--text-3)' }}>
                <div style={{ width: 18, height: 18, border: '2px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                <span style={{ fontSize: 13 }}>{t('tables.loadingWaiters')}</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }} className="custom-scroll">
                
                {/* Option: Unassigned */}
                <label style={{ 
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', 
                  background: selectedWaiterId === '' ? 'var(--card-hi)' : 'var(--surface)',
                  border: `1px solid ${selectedWaiterId === '' ? 'var(--gold-dim)' : 'var(--border)'}`,
                  borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s ease'
                }}>
                  <input
                    type="radio"
                    name="waiter"
                    value=""
                    checked={selectedWaiterId === ''}
                    onChange={(e) => setSelectedWaiterId(e.target.value)}
                    style={{ display: 'none' }}
                  />
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
                    <X size={14} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>{t('tables.unassigned')}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>{t('tables.removeCurrentWaiter')}</p>
                  </div>
                  {selectedWaiterId === '' && <CheckCircle2 size={16} color="var(--gold)" />}
                </label>

                {/* Real Waiters */}
                {waiters.map((waiter) => (
                  <label key={waiter.id} style={{ 
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', 
                    background: selectedWaiterId === waiter.id.toString() ? 'var(--card-hi)' : 'var(--surface)',
                    border: `1px solid ${selectedWaiterId === waiter.id.toString() ? 'var(--gold-dim)' : 'var(--border)'}`,
                    borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s ease'
                  }}>
                    <input
                      type="radio"
                      name="waiter"
                      value={waiter.id.toString()}
                      checked={selectedWaiterId === waiter.id.toString()}
                      onChange={(e) => setSelectedWaiterId(e.target.value)}
                      style={{ display: 'none' }}
                    />
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue)' }}>
                      <User size={14} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>{waiter.full_name || waiter.username}</p>
                    </div>
                    {selectedWaiterId === waiter.id.toString() && <CheckCircle2 size={16} color="var(--gold)" />}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '12px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              {t('tables.cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading || loadingWaiters}
              style={{ padding: '12px', borderRadius: 12, border: 'none', background: 'var(--green)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
            >
              {isLoading ? (
                <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
              ) : (
                <>{t('tables.confirm')}</>
              )}
            </button>
          </div>
        </form>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};