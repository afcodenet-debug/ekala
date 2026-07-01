import React, { useState } from 'react';
import { X, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface VoucherActionModalProps {
  isOpen: boolean;
  type: 'approve' | 'reject';
  voucherCode: string;
  tenantName: string;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const VoucherActionModal: React.FC<VoucherActionModalProps> = ({
  isOpen,
  type,
  voucherCode,
  tenantName,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const isApprove = type === 'approve';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isApprove) {
      onConfirm();
    } else {
      if (!reason.trim()) return;
      onConfirm(reason);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onCancel();
    }
  };

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 20,
      }}
      onClick={handleBackdropClick}
    >
      <div
        style={{
          background: '#14141f',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 16, padding: 32,
          maxWidth: 480, width: '100%',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
          animation: 'modalSlideIn 0.2s ease-out',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40, height: 40, borderRadius: 10,
                background: isApprove ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${isApprove ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {isApprove ? <CheckCircle size={20} color="#22c55e" /> : <XCircle size={20} color="#ef4444" />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#e8e8f2' }}>
                {isApprove ? 'Approuver le voucher' : 'Rejeter le voucher'}
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#6a6a80' }}>Action irreversible</p>
            </div>
          </div>
          <button onClick={onCancel} disabled={isLoading} style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: 8, cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={16} color="#a0a0b8" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10, padding: 16, marginBottom: 24,
          }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <div>
                <span style={{ fontSize: 11, color: '#6a6a80', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Code Voucher</span>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#3b82f6', margin: '4px 0 0 0', fontFamily: 'monospace' }}>{voucherCode}</p>
              </div>
              <div>
                <span style={{ fontSize: 11, color: '#6a6a80', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tenant</span>
                <p style={{ fontSize: 14, color: '#e8e8f2', margin: '4px 0 0 0' }}>{tenantName}</p>
              </div>
            </div>
          </div>

          {!isApprove && (
            <div style={{ marginBottom: 24 }}>
              <label htmlFor="reject-reason" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#e8e8f2', marginBottom: 8 }}>
                Raison du rejet <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                id="reject-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Veuillez expliquer la raison du rejet..."
                disabled={isLoading}
                rows={4}
                style={{
                  width: '100%', padding: '12px 14px', background: '#0f0f18',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                  color: '#e8e8f2', fontSize: 13, fontFamily: 'inherit',
                  resize: 'vertical', minHeight: 100, outline: 'none',
                  transition: 'border-color 140ms',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'rgba(59,130,246,0.5)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
              {!reason.trim() && (
                <p style={{ fontSize: 11, color: '#ef4444', margin: '6px 0 0 0' }}>La raison du rejet est requise</p>
              )}
            </div>
          )}

          {isApprove && (
            <div style={{
              background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 8, padding: 12, marginBottom: 24,
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <AlertTriangle size={16} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 12, color: '#a0a0b8', margin: 0, lineHeight: 1.5 }}>
                Cela activera l'abonnement du tenant <strong style={{ color: '#e8e8f2' }}>{tenantName}</strong> et lui donnera acces a la plateforme.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onCancel} disabled={isLoading} style={{
              padding: '10px 20px', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
              color: '#a0a0b8', fontSize: 13, fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.5 : 1, transition: 'all 140ms',
            }}>
              Annuler
            </button>
            <button type="submit" disabled={isLoading || (!isApprove && !reason.trim())} style={{
              padding: '10px 20px',
              background: isApprove ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: isLoading || (!isApprove && !reason.trim()) ? 'not-allowed' : 'pointer',
              opacity: isLoading || (!isApprove && !reason.trim()) ? 0.5 : 1,
              display: 'flex', alignItems: 'center', gap: 8, transition: 'all 140ms',
              boxShadow: isApprove ? '0 4px 12px rgba(34,197,94,0.3)' : '0 4px 12px rgba(239,68,68,0.3)',
            }}>
              {isLoading ? (
                <>
                  <div style={{
                    width: 14, height: 14,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff', borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  {isApprove ? 'Approbation...' : 'Rejet...'}
                </>
              ) : (
                <>
                  {isApprove ? <CheckCircle size={16} /> : <XCircle size={16} />}
                  {isApprove ? 'Approuver' : 'Rejeter'}
                </>
              )}
            </button>
          </div>
        </form>

        <style>{`
          @keyframes modalSlideIn {
            from { opacity: 0; transform: translateY(-20px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default VoucherActionModal;
