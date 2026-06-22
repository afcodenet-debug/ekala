import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Eye, ChevronLeft, ChevronRight, CreditCard } from 'lucide-react';

const API_BASE = (window as any).VITE_API_BASE_URL || 'https://ekala-api.onrender.com/api';

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
`;

const VouchersPage = () => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadVouchers();
  }, [page, statusFilter]);

  const loadVouchers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...(statusFilter && { status: statusFilter }),
      });

      const response = await fetch(`${API_BASE}/platform/vouchers?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setVouchers(data.vouchers);
        setTotalPages(data.pagination.pages);
        setTotal(data.pagination.total);
      }
    } catch (error) {
      console.error('Failed to load vouchers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (voucherId: number) => {
    if (!confirm('Approuver ce voucher ? Cela activera l\'abonnement du tenant.')) return;

    try {
      const response = await fetch(`${API_BASE}/platform/vouchers/${voucherId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        loadVouchers();
      } else {
        alert(data.message || 'Erreur');
      }
    } catch (error) {
      console.error('Failed to approve voucher:', error);
      alert('Erreur lors de l\'approbation');
    }
  };

  const handleReject = async (voucherId: number) => {
    const reason = prompt('Raison du rejet:');
    if (!reason) return;

    try {
      const response = await fetch(`${API_BASE}/platform/vouchers/${voucherId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });
      const data = await response.json();
      if (data.success) {
        loadVouchers();
      } else {
        alert(data.message || 'Erreur');
      }
    } catch (error) {
      console.error('Failed to reject voucher:', error);
      alert('Erreur lors du rejet');
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

  const formatCurrency = (cents: number | null) => {
    if (!cents) return '-';
    return `${(cents / 100).toFixed(2)} ZMW`;
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
                            onClick={() => handleApprove(voucher.id)}
                          >
                            <CheckCircle size={14} />
                            Approuver
                          </button>
                          <button
                            className="action-btn reject"
                            onClick={() => handleReject(voucher.id)}
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
    </div>
  );
};

export default VouchersPage;