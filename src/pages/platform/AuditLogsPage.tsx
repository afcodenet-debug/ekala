import React, { useEffect, useState } from 'react';
import { FileText, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { api } from '../../lib/api-client';

interface AuditLog {
  id: number;
  tenant_id: number | null;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: number;
  metadata: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user_email: string | null;
  user_name: string | null;
  tenant_name: string | null;
}

const styles = `
  .audit-header {
    margin-bottom: 24px;
  }
  .audit-title {
    font-size: 24px;
    font-weight: 800;
    color: #e8e8f2;
    letter-spacing: -0.02em;
  }
  .audit-subtitle {
    font-size: 13px;
    color: #6a6a80;
    margin-top: 4px;
  }
  .audit-filters {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }
  .audit-table-container {
    background: #0f0f18;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    overflow: hidden;
  }
  .audit-table {
    width: 100%;
    border-collapse: collapse;
  }
  .audit-table th {
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
  .audit-table td {
    padding: 14px 16px;
    font-size: 13px;
    color: #e8e8f2;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .audit-table tr:hover td {
    background: rgba(255,255,255,0.02);
  }
  .action-badge {
    display: inline-flex;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
  }
  .action-badge.approve {
    background: rgba(34,197,94,0.15);
    color: #22c55e;
  }
  .action-badge.reject {
    background: rgba(239,68,68,0.15);
    color: #ef4444;
  }
  .action-badge.suspend {
    background: rgba(239,68,68,0.15);
    color: #ef4444;
  }
  .action-badge.activate {
    background: rgba(34,197,94,0.15);
    color: #22c55e;
  }
  .action-badge.default {
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

const AuditLogsPage = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    loadLogs();
  }, [page, actionFilter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.platform.getAuditLogs({ page, limit: 50, action: actionFilter || undefined });
      if (data.success) {
        setLogs(data.logs);
        setTotalPages(data.pagination.pages);
        setTotal(data.pagination.total);
      }
    } catch (error: any) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionClass = (action: string) => {
    if (action.includes('approve') || action.includes('activate')) return 'approve';
    if (action.includes('reject') || action.includes('suspend')) return 'reject';
    if (action.includes('suspend')) return 'suspend';
    if (action.includes('activate')) return 'activate';
    return 'default';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return <div className="loading-spinner" />;
  }

  return (
    <div>
      <style>{styles}</style>

      <div className="audit-header">
        <h1 className="audit-title">Logs d'Audit</h1>
        <p className="audit-subtitle">{total} événements au total</p>
      </div>

      {/* Filters */}
      <div className="audit-filters">
        <select
          style={{
            padding: '10px 14px',
            background: '#0f0f18',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            color: '#e8e8f2',
            fontSize: 13,
            minWidth: 200,
            cursor: 'pointer',
          }}
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Toutes les actions</option>
          <option value="voucher_approved">Voucher approuvé</option>
          <option value="voucher_rejected">Voucher rejeté</option>
          <option value="tenant_suspended">Tenant suspendu</option>
          <option value="tenant_activated">Tenant activé</option>
        </select>
      </div>

      {/* Table */}
      <div className="audit-table-container">
        <table className="audit-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Action</th>
              <th>Utilisateur</th>
              <th>Tenant</th>
              <th>Entité</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state">
                    <FileText size={48} style={{ opacity: 0.5, marginBottom: 16 }} />
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: '#e8e8f2', marginBottom: 8 }}>
                      Aucun log trouvé
                    </h3>
                    <p style={{ fontSize: 13 }}>
                      {actionFilter ? 'Essayez de modifier le filtre' : 'Aucun événement enregistré'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDate(log.created_at)}</td>
                  <td>
                    <span className={`action-badge ${getActionClass(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td>{log.user_name || log.user_email || '-'}</td>
                  <td>{log.tenant_name || '-'}</td>
                  <td>
                    {log.entity_type}:{log.entity_id}
                  </td>
                  <td>{log.ip_address || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <div className="pagination-info">
              Page {page} sur {totalPages} • {total} logs
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

export default AuditLogsPage;