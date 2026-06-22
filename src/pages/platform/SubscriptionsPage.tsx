import React, { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, Activity, DollarSign,
  Calendar, ChevronLeft, ChevronRight, Filter
} from 'lucide-react';
import { api } from '../../lib/api-client';

interface Subscription {
  id: number;
  tenant_id: number;
  tenant_name: string;
  plan_code: string;
  plan_name: string;
  status: string;
  started_at: string;
  current_period_start: string;
  current_period_end: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  auto_renew: boolean;
  created_at: string;
}

const styles = `
  .subscriptions-header {
    margin-bottom: 24px;
  }
  .subscriptions-title {
    font-size: 24px;
    font-weight: 800;
    color: #e8e8f2;
    letter-spacing: -0.02em;
  }
  .subscriptions-subtitle {
    font-size: 13px;
    color: #6a6a80;
    margin-top: 4px;
  }
  .subscriptions-filters {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }
  .subscriptions-table-container {
    background: #0f0f18;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    overflow: hidden;
  }
  .subscriptions-table {
    width: 100%;
    border-collapse: collapse;
  }
  .subscriptions-table th {
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
  .subscriptions-table td {
    padding: 14px 16px;
    font-size: 13px;
    color: #e8e8f2;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .subscriptions-table tr:hover td {
    background: rgba(255,255,255,0.02);
  }
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
  }
  .status-badge.active {
    background: rgba(34,197,94,0.15);
    color: #22c55e;
  }
  .status-badge.suspended {
    background: rgba(239,68,68,0.15);
    color: #ef4444;
  }
  .status-badge.trial {
    background: rgba(245,158,11,0.15);
    color: #f59e0b;
  }
  .status-badge.expired {
    background: rgba(239,68,68,0.15);
    color: #ef4444;
  }
  .status-badge.pending {
    background: rgba(59,130,246,0.15);
    color: #3b82f6;
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

const SubscriptionsPage = () => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadSubscriptions();
  }, [page, statusFilter]);

  const loadSubscriptions = async () => {
    setLoading(true);
    try {
      const data = await api.platform.getSubscriptions({ page, limit: 50, status: statusFilter || undefined });
      if (data.success && Array.isArray(data.subscriptions)) {
        setSubscriptions(data.subscriptions);
        setTotalPages(data.pagination?.pages || 0);
        setTotal(data.pagination?.total || 0);
      }
    } catch (error: any) {
      console.error('Failed to load subscriptions:', error);
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'active': return 'active';
      case 'suspended': return 'suspended';
      case 'trial': return 'trial';
      case 'expired': return 'expired';
      case 'pending': return 'pending';
      default: return '';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  if (loading) {
    return <div className="loading-spinner" />;
  }

  return (
    <div>
      <style>{styles}</style>

      <div className="subscriptions-header">
        <h1 className="subscriptions-title">Gestion des Abonnements</h1>
        <p className="subscriptions-subtitle">{total} abonnements au total</p>
      </div>

      {/* Filters */}
      <div className="subscriptions-filters">
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
          <option value="active">Actif</option>
          <option value="trial">Essai</option>
          <option value="pending">En attente</option>
          <option value="suspended">Suspendu</option>
          <option value="expired">Expiré</option>
          <option value="cancelled">Annulé</option>
        </select>
      </div>

      {/* Table */}
      <div className="subscriptions-table-container">
        <table className="subscriptions-table">
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Plan</th>
              <th>Statut</th>
              <th>Date début</th>
              <th>Période actuelle</th>
              <th>Fin période</th>
              <th>Auto-renew</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <Activity size={48} style={{ opacity: 0.5, marginBottom: 16 }} />
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: '#e8e8f2', marginBottom: 8 }}>
                      Aucun abonnement trouvé
                    </h3>
                    <p style={{ fontSize: 13 }}>
                      {statusFilter ? 'Essayez de modifier le filtre' : 'Aucun abonnement enregistré'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              subscriptions.map((sub) => (
                <tr key={sub.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{sub.tenant_name}</div>
                  </td>
                  <td>{sub.plan_name}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(sub.status)}`}>
                      {sub.status}
                    </span>
                  </td>
                  <td>{formatDate(sub.started_at)}</td>
                  <td>{formatDate(sub.current_period_start)}</td>
                  <td>{formatDate(sub.current_period_end)}</td>
                  <td>
                    {sub.auto_renew ? (
                      <span style={{ color: '#22c55e' }}>✓ Oui</span>
                    ) : (
                      <span style={{ color: '#6a6a80' }}>✗ Non</span>
                    )}
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
              Page {page} sur {totalPages} • {total} abonnements
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

export default SubscriptionsPage;