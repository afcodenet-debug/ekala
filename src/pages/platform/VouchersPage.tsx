import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Eye, ChevronLeft, ChevronRight, CreditCard, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api-client';

interface Voucher {
  id: number;
  voucher_code: string;
  customer_email: string;
  status: string;
  requested_at: string;
  verification_deadline: string;
  expires_at: string;
  verified_at: string | null;
  amount_cents: number | null;
  currency: string;
  tenant_name: string;
  tenant_id: number;
  plan_name: string;
  plan_code: string;
}

const styles = `
  .vouchers-header {
    margin-bottom: 24px;
  }
  .vouchers-title {
    font-size: 24px;
    font-weight: 800;
    color: #e8e8f2;
    letter-spacing: -0.02em;
  }
  .vouchers-subtitle {
    font-size: 13px;
    color: #6a6a80;
    margin-top: 4px;
  }
  .vouchers-filters {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }
  .vouchers-table-container {
    background: #0f0f18;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    overflow: hidden;
  }
  .vouchers-table {
    width: 100%;
    border-collapse: collapse;
  }
  .vouchers-table th {
    padding: 12px 16px;
    text-align: left;
    font-size: 11px;
    font-weight: 700;
    color: #6a6a80;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    background: rgba(255,255,255,0.02);
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .vouchers-table td {
    padding: 14px 16px;
    font-size: 13px;
    color: #e8e8f2;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .vouchers-table tr:hover td {
    background: rgba(255,255,255,0.02);
  }
  .voucher-code {
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 12px;
    font-weight: 600;
    color: #3b82f6;
    background: rgba(59,130,246,0.1);
    padding: 4px 8px;
    border-radius: 4px;
  }
  .action-btn {
    padding: 6px 12px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03);
    border-radius: 6px;
    color: #a0a0b8;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: all 140ms;
  }
  .action-btn:hover {
    background: rgba(255,255,255,0.06);
    color: #e8e8f2;
  }
  .action-btn.approve:hover {
    background: rgba(34,197,94,0.1);
    border-color: rgba(34,197,94,0.3);
    color: #22c55e;
  }
  .action-btn.reject:hover {
    background: rgba(239,68,68,0.1);
    border-color: rgba(239,68,68,0.3);
    color: #ef4444;
  }
  .pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }
  .pagination-info {
    font-size: 12px;
    color: #6a6a80;
  }
  .pagination-buttons {
    display: flex;
    gap: 8px;
  }
  .pagination-btn {
    padding: 6px 12px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px;
    color: #a0a0b8;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 140ms;
  }
  .pagination-btn:hover:not(:disabled) {
    background: rgba(255,255,255,0.06);
    color: #e8e8f2;
  }
  .pagination-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .loading-spinner {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 3px solid rgba(255,255,255,0.1);
    border-top-color: #3b82f6;
    animation: spin 0.8s linear infinite;
    margin: 60px auto;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .empty-state {
    text-align: center;
    padding: 60px 24px;
    color: #6a6a80;
  }

  /* Toast Styles */
  .toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 400px;
  }
  .toast {
    background: linear-gradient(145deg, #1a1a24, #16161e);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    padding: 18px;
    box-shadow: 
      0 0 0 1px rgba(0,0,0,0.3),
      0 12px 32px rgba(0,0,0,0.5),
      0 4px 12px rgba(0,0,0,0.3);
    animation: toast-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    align-items: flex-start;
    gap: 14px;
    position: relative;
    overflow: hidden;
  }
  .toast::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
  }
  @keyframes toast-slide-in {
    from {
      opacity: 0;
      transform: translateX(100px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  .toast.success {
    border-left: 3px solid #22c55e;
  }
  .toast.error {
    border-left: 3px solid #ef4444;
  }
  .toast.info {
    border-left: 3px solid #3b82f6;
  }
  .toast-icon {
    flex-shrink: 0;
    margin-top: 2px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .toast-content {
    flex: 1;
    min-width: 0;
  }
  .toast-title {
    font-size: 14px;
    font-weight: 800;
    color: #e8e8f2;
    margin-bottom: 4px;
    letter-spacing: -0.01em;
  }
  .toast-message {
    font-size: 13px;
    color: #a0a0b8;
    line-height: 1.5;
  }
  .toast-close {
    flex-shrink: 0;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    color: #6a6a80;
    cursor: pointer;
    padding: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 200ms;
  }
  .toast-close:hover {
    background: rgba(255,255,255,0.1);
    color: #e8e8f2;
    border-color: rgba(255,255,255,0.15);
    transform: scale(1.05);
  }

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fade-in 0.2s ease-out;
  }
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .modal-content {
    background: linear-gradient(145deg, #1a1a24, #16161e);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 20px;
    padding: 28px;
    max-width: 520px;
    width: 92%;
    box-shadow: 
      0 0 0 1px rgba(0,0,0,0.4),
      0 24px 80px rgba(0,0,0,0.6),
      0 8px 24px rgba(0,0,0,0.4),
      inset 0 1px 0 rgba(255,255,255,0.05);
    animation: modal-slide-in 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    position: relative;
    overflow: hidden;
  }
  .modal-content::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
  }
  .modal-content-large {
    max-width: 580px;
  }
  @keyframes modal-slide-in {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  .modal-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
    padding-bottom: 20px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .modal-icon {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .success-icon {
    background: linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05));
    color: #22c55e;
    box-shadow: 0 0 24px rgba(34,197,94,0.2);
  }
  .error-icon {
    background: linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05));
    color: #ef4444;
    box-shadow: 0 0 24px rgba(239,68,68,0.2);
  }
  .modal-title-group {
    flex: 1;
  }
  .modal-title {
    font-size: 20px;
    font-weight: 800;
    color: #e8e8f2;
    letter-spacing: -0.02em;
    margin-bottom: 4px;
  }
  .modal-subtitle {
    font-size: 13px;
    color: #7b7b95;
    font-weight: 500;
  }
  .modal-message {
    font-size: 14px;
    color: #a0a0b8;
    margin-bottom: 24px;
    line-height: 1.6;
  }
  .voucher-details {
    background: rgba(0,0,0,0.2);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 20px;
  }
  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .detail-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
  .detail-label {
    font-size: 12px;
    font-weight: 600;
    color: #6a6a80;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .detail-value {
    font-size: 14px;
    font-weight: 600;
    color: #e8e8f2;
    text-align: right;
  }
  .voucher-code-display {
    font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
    font-size: 13px;
    color: #3b82f6;
    background: rgba(59,130,246,0.1);
    padding: 4px 10px;
    border-radius: 6px;
    letter-spacing: 0.04em;
  }
  .detail-value.amount {
    color: #22c55e;
    font-size: 15px;
    font-weight: 700;
  }
  .reason-input-wrapper {
    margin-top: 16px;
  }
  .reason-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #6a6a80;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 8px;
  }
  .modal-input {
    width: 100%;
    padding: 14px;
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    color: #e8e8f2;
    font-size: 14px;
    margin-bottom: 0;
    outline: none;
    transition: all 200ms;
  }
  .modal-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
  }
  .modal-textarea {
    resize: vertical;
    min-height: 80px;
    font-family: inherit;
    line-height: 1.5;
  }
  .modal-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }
  .modal-btn {
    padding: 12px 24px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    border: none;
    transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
    display: inline-flex;
    align-items: center;
    gap: 8px;
    letter-spacing: 0.01em;
  }
  .modal-btn:active {
    transform: scale(0.97);
  }
  .modal-btn-cancel {
    background: rgba(255,255,255,0.04);
    color: #a0a0b8;
    border: 1px solid rgba(255,255,255,0.1);
  }
  .modal-btn-cancel:hover {
    background: rgba(255,255,255,0.08);
    color: #e8e8f2;
    border-color: rgba(255,255,255,0.15);
    transform: translateY(-1px);
  }
  .modal-btn-confirm {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: #fff;
    box-shadow: 0 4px 16px rgba(34,197,94,0.3);
  }
  .modal-btn-confirm:hover {
    background: linear-gradient(135deg, #16a34a, #15803d);
    box-shadow: 0 6px 20px rgba(34,197,94,0.4);
    transform: translateY(-2px);
  }
  .modal-btn-reject {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: #fff;
    box-shadow: 0 4px 16px rgba(239,68,68,0.3);
  }
  .modal-btn-reject:hover:not(:disabled) {
    background: linear-gradient(135deg, #dc2626, #b91c1c);
    box-shadow: 0 6px 20px rgba(239,68,68,0.4);
    transform: translateY(-2px);
  }
  .modal-btn-reject:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const VouchersPage = () => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [toasts, setToasts] = useState<Array<{ id: string; type: 'success' | 'error' | 'info'; title: string; message: string }>>([]);
  const [confirmModal, setConfirmModal] = useState<{ show: boolean; voucher: Voucher | null }>({ show: false, voucher: null });
  const [rejectModal, setRejectModal] = useState<{ show: boolean; voucher: Voucher | null; reason: string }>({ show: false, voucher: null, reason: '' });

  useEffect(() => {
    loadVouchers();
  }, [page, statusFilter]);

  const loadVouchers = async () => {
    setLoading(true);
    try {
      const data = await api.platform.getVouchers({ page, limit: 50, status: statusFilter || undefined });
      if (data.success && Array.isArray(data.vouchers)) {
        setVouchers(data.vouchers);
        setTotalPages(data.pagination?.pages || 0);
        setTotal(data.pagination?.total || 0);
      }
    } catch (error: any) {
      console.error('Failed to load vouchers:', error);
      setVouchers([]);
    } finally {
      setLoading(false);
    }
  };

  const addToast = (type: 'success' | 'error' | 'info', title: string, message: string) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const handleApprove = (voucher: Voucher) => {
    setConfirmModal({ show: true, voucher });
  };

  const confirmApprove = async () => {
    const voucher = confirmModal.voucher;
    if (!voucher) return;

    setConfirmModal({ show: false, voucher: null });

    try {
      const data = await api.platform.approveVoucher(voucher.id) as any;
      if (data?.success) {
        const amountInfo = voucher.amount_cents ? formatCurrency(voucher.amount_cents) : voucher.plan_name;
        addToast('success', 'Voucher approuvé', 
          `Le voucher ${voucher.voucher_code} a été activé pour ${voucher.tenant_name} • ${amountInfo}`);
        loadVouchers();
      } else {
        addToast('error', 'Erreur', data?.message || 'Erreur lors de l\'approbation');
        loadVouchers();
      }
    } catch (error: any) {
      console.error('Failed to approve voucher:', error);
      addToast('error', 'Erreur', error.message || 'Erreur lors de l\'approbation');
      loadVouchers();
    }
  };

  const handleReject = (voucher: Voucher) => {
    setRejectModal({ show: true, voucher, reason: '' });
  };

  const confirmReject = async () => {
    const voucher = rejectModal.voucher;
    const reason = rejectModal.reason.trim();

    if (!voucher || !reason) {
      addToast('error', 'Erreur', 'Veuillez fournir une raison de rejet');
      return;
    }

    setRejectModal({ show: false, voucher: null, reason: '' });

    try {
      const data = await api.platform.rejectVoucher(voucher.id, reason) as any;
      if (data?.success) {
        const amountInfo = voucher.amount_cents ? formatCurrency(voucher.amount_cents) : voucher.plan_name;
        addToast('success', 'Voucher rejeté', 
          `Le voucher ${voucher.voucher_code} a été rejeté • ${amountInfo}`);
        loadVouchers();
      } else {
        addToast('error', 'Erreur', data?.message || 'Erreur lors du rejet');
        loadVouchers();
      }
    } catch (error: any) {
      console.error('Failed to reject voucher:', error);
      addToast('error', 'Erreur', error.message || 'Erreur lors du rejet');
      loadVouchers();
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'pending': return 'pending';
      case 'payment_sent': return 'payment_sent';
      case 'verified': return 'verified';
      case 'rejected': return 'rejected';
      case 'expired': return 'expired';
      default: return '';
    }
  };

  const getToastIcon = (type: 'success' | 'error' | 'info') => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={20} color="#22c55e" />;
      case 'error':
        return <AlertCircle size={20} color="#ef4444" />;
      case 'info':
        return <AlertCircle size={20} color="#3b82f6" />;
    }
  };

  const formatCurrency = (cents: number | null) => {
    if (!cents) return '-';
    return `${(cents / 100).toFixed(2)} ZMW`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <div className="loading-spinner" />;
  }

  return (
    <div>
      <style>{styles}</style>

      <div className="vouchers-header">
        <h1 className="vouchers-title">Validation des Vouchers</h1>
        <p className="vouchers-subtitle">{total} demandes au total</p>
      </div>

      {/* Filters */}
      <div className="vouchers-filters">
        <select
          style={{
            padding: '10px 14px',
            background: '#0f0f18',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            color: '#e8e8f2',
            fontSize: 13,
            minWidth: 180,
            cursor: 'pointer',
          }}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="payment_sent">Paiement déclaré</option>
          <option value="verified">Vérifié</option>
          <option value="rejected">Rejeté</option>
          <option value="expired">Expiré</option>
        </select>
      </div>

      {/* Table */}
      <div className="vouchers-table-container">
        <table className="vouchers-table">
          <thead>
            <tr>
              <th>Code Voucher</th>
              <th>Tenant</th>
              <th>Plan</th>
              <th>Montant</th>
              <th>Statut</th>
              <th>Date demande</th>
              <th>Expiration</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vouchers.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <CreditCard size={48} style={{ opacity: 0.5, marginBottom: 16 }} />
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: '#e8e8f2', marginBottom: 8 }}>
                      Aucun voucher trouvé
                    </h3>
                    <p style={{ fontSize: 13 }}>
                      {statusFilter ? 'Essayez de modifier le filtre' : 'Aucune demande de voucher'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              vouchers.map((voucher) => (
                <tr key={voucher.id}>
                  <td>
                    <span className="voucher-code">{voucher.voucher_code}</span>
                  </td>
                  <td>{voucher.tenant_name}</td>
                  <td>{voucher.plan_name}</td>
                  <td>{formatCurrency(voucher.amount_cents)}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(voucher.status)}`}>
                      {voucher.status}
                    </span>
                  </td>
                  <td>{new Date(voucher.requested_at).toLocaleDateString('fr-FR')}</td>
                  <td>{new Date(voucher.expires_at).toLocaleDateString('fr-FR')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(voucher.status === 'pending' || voucher.status === 'payment_sent') && (
                        <>
                          <button
                            className="action-btn approve"
                            onClick={() => handleApprove(voucher)}
                          >
                            <CheckCircle size={14} />
                            Approuver
                          </button>
                          <button
                            className="action-btn reject"
                            onClick={() => handleReject(voucher)}
                          >
                            <XCircle size={14} />
                            Rejeter
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <div className="pagination-info">
              Page {page} sur {totalPages} • {total} vouchers
            </div>
            <div className="pagination-buttons">
              <button
                className="pagination-btn"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                className="pagination-btn"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toast Container */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map(toast => (
            <div key={toast.id} className={`toast ${toast.type}`}>
              <div className="toast-icon">
                {getToastIcon(toast.type)}
              </div>
              <div className="toast-content">
                <div className="toast-title">{toast.title}</div>
                <div className="toast-message">{toast.message}</div>
              </div>
              <button
                className="toast-close"
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal.show && confirmModal.voucher && (
        <div className="modal-overlay" onClick={() => setConfirmModal({ show: false, voucher: null })}>
          <div className="modal-content modal-content-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon success-icon">
                <CheckCircle2 size={28} />
              </div>
              <div className="modal-title-group">
                <div className="modal-title">Confirmer l'approbation</div>
                <div className="modal-subtitle">Cette action activera l'abonnement du tenant</div>
              </div>
            </div>

            <div className="modal-message">
              <div className="voucher-details">
                <div className="detail-row">
                  <span className="detail-label">Code Voucher</span>
                  <span className="detail-value voucher-code-display">{confirmModal.voucher.voucher_code}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Tenant</span>
                  <span className="detail-value">{confirmModal.voucher.tenant_name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Plan</span>
                  <span className="detail-value">{confirmModal.voucher.plan_name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Montant</span>
                  <span className="detail-value amount">{formatCurrency(confirmModal.voucher.amount_cents)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Date d'expiration</span>
                  <span className="detail-value">{formatDate(confirmModal.voucher.expires_at)}</span>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="modal-btn modal-btn-cancel"
                onClick={() => setConfirmModal({ show: false, voucher: null })}
              >
                Annuler
              </button>
              <button
                className="modal-btn modal-btn-confirm"
                onClick={confirmApprove}
              >
                <CheckCircle2 size={16} />
                Confirmer l'approbation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal.show && rejectModal.voucher && (
        <div className="modal-overlay" onClick={() => setRejectModal({ show: false, voucher: null, reason: '' })}>
          <div className="modal-content modal-content-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon error-icon">
                <XCircle size={28} />
              </div>
              <div className="modal-title-group">
                <div className="modal-title">Rejeter le voucher</div>
                <div className="modal-subtitle">Veuillez fournir une raison pour le rejet</div>
              </div>
            </div>

            <div className="modal-message">
              <div className="voucher-details">
                <div className="detail-row">
                  <span className="detail-label">Code Voucher</span>
                  <span className="detail-value voucher-code-display">{rejectModal.voucher.voucher_code}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Tenant</span>
                  <span className="detail-value">{rejectModal.voucher.tenant_name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Plan</span>
                  <span className="detail-value">{rejectModal.voucher.plan_name}</span>
                </div>
              </div>

              <div className="reason-input-wrapper">
                <label className="reason-label">Raison du rejet *</label>
                <textarea
                  className="modal-input modal-textarea"
                  placeholder="Expliquez pourquoi ce voucher est rejeté..."
                  value={rejectModal.reason}
                  onChange={(e) => setRejectModal(prev => ({ ...prev, reason: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      confirmReject();
                    } else if (e.key === 'Escape') {
                      setRejectModal({ show: false, voucher: null, reason: '' });
                    }
                  }}
                  autoFocus
                  rows={3}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="modal-btn modal-btn-cancel"
                onClick={() => setRejectModal({ show: false, voucher: null, reason: '' })}
              >
                Annuler
              </button>
              <button
                className="modal-btn modal-btn-reject"
                onClick={confirmReject}
                disabled={!rejectModal.reason.trim()}
              >
                <XCircle size={16} />
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VouchersPage;