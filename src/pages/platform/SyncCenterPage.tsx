import React, { useEffect, useState } from 'react';
import {
  RefreshCw, CheckCircle, XCircle, AlertTriangle,
  Clock, Activity, ChevronLeft, ChevronRight
} from 'lucide-react';
import { api } from '../../lib/api-client';

interface SyncJob {
  id: number;
  table_name: string;
  operation: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  processed_at: string | null;
  tenant_id: number | null;
}

const styles = `
  .sync-header {
    margin-bottom: 24px;
  }
  .sync-title {
    font-size: 24px;
    font-weight: 800;
    color: #e8e8f2;
    letter-spacing: -0.02em;
  }
  .sync-subtitle {
    font-size: 13px;
    color: #6a6a80;
    margin-top: 4px;
  }
  .sync-actions {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
  }
  .sync-btn {
    padding: 10px 16px;
    background: rgba(59,130,246,0.15);
    border: 1px solid rgba(59,130,246,0.3);
    border-radius: 8px;
    color: #3b82f6;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: all 140ms;
  }
  .sync-btn:hover {
    background: rgba(59,130,246,0.25);
    transform: translateY(-1px);
  }
  .sync-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
  .sync-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  .sync-stat-card {
    background: #0f0f18;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 16px;
  }
  .sync-stat-value {
    font-size: 24px;
    font-weight: 800;
    color: #e8e8f2;
    margin-bottom: 4px;
  }
  .sync-stat-label {
    font-size: 12px;
    color: #6a6a80;
    font-weight: 500;
  }
  .sync-table-container {
    background: #0f0f18;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    overflow: hidden;
  }
  .sync-table {
    width: 100%;
    border-collapse: collapse;
  }
  .sync-table th {
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
  .sync-table td {
    padding: 14px 16px;
    font-size: 13px;
    color: #e8e8f2;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .sync-table tr:hover td {
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
  .status-badge.pending {
    background: rgba(245,158,11,0.15);
    color: #f59e0b;
  }
  .status-badge.processing {
    background: rgba(59,130,246,0.15);
    color: #3b82f6;
  }
  .status-badge.completed {
    background: rgba(34,197,94,0.15);
    color: #22c55e;
  }
  .status-badge.failed {
    background: rgba(239,68,68,0.15);
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

const SyncCenterPage = () => {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  });

  useEffect(() => {
    loadJobs();
    loadStats();
  }, [page]);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await api.platform.getSyncJobs({ page, limit: 50 });
      if (data.success) {
        setJobs(data.jobs);
        setTotalPages(data.pagination.pages);
        setTotal(data.pagination.total);
      }
    } catch (error: any) {
      console.error('Failed to load sync jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await api.platform.getSyncStats();
      if (data.success) {
        setStats(data.stats.by_status);
      }
    } catch (error: any) {
      console.error('Failed to load sync stats:', error);
    }
  };

  const handleTriggerSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch(`${API_BASE}/platform/sync/trigger`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('platform_token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        alert('Synchronisation déclenchée avec succès');
        loadJobs();
        loadStats();
      } else {
        alert(data.message || 'Erreur');
      }
    } catch (error: any) {
      console.error('Failed to trigger sync:', error);
      alert(error.message || 'Erreur lors du déclenchement');
    } finally {
      setSyncing(false);
    }
  };

  const handleRetryFailed = async () => {
    if (!confirm('Réessayer tous les jobs échoués ?')) return;

    try {
      const data = await api.platform.retryFailedSync(5);
      if (data.success) {
        alert(`${data.retried} jobs remis en attente`);
        loadJobs();
        loadStats();
      } else {
        alert((data as any).message || 'Erreur');
      }
    } catch (error: any) {
      console.error('Failed to retry failed jobs:', error);
      alert(error.message || 'Erreur lors de la réinitialisation');
    }
  };

  const handleCleanup = async () => {
    if (!confirm('Supprimer les jobs complétés de plus de 7 jours ?')) return;

    try {
      const response = await fetch(`${API_BASE}/platform/sync/cleanup`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('platform_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ daysOld: 7 }),
      });
      const data = await response.json();
      if (data.success) {
        alert(`${data.deleted} jobs nettoyés`);
        loadJobs();
        loadStats();
      } else {
        alert(data.message || 'Erreur');
      }
    } catch (error: any) {
      console.error('Failed to cleanup jobs:', error);
      alert(error.message || 'Erreur lors du nettoyage');
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'pending': return 'pending';
      case 'processing': return 'processing';
      case 'completed': return 'completed';
      case 'failed': return 'failed';
      default: return '';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={14} />;
      case 'processing': return <Activity size={14} />;
      case 'completed': return <CheckCircle size={14} />;
      case 'failed': return <XCircle size={14} />;
      default: return null;
    }
  };

  if (loading) {
    return <div className="loading-spinner" />;
  }

  return (
    <div>
      <style>{styles}</style>

      <div className="sync-header">
        <h1 className="sync-title">Centre de Synchronisation</h1>
        <p className="sync-subtitle">Monitoring et contrôle de la synchronisation SQLite ↔ Supabase</p>
      </div>

      {/* Stats */}
      <div className="sync-stats">
        <div className="sync-stat-card">
          <div className="sync-stat-value">{stats.pending}</div>
          <div className="sync-stat-label">En attente</div>
        </div>
        <div className="sync-stat-card">
          <div className="sync-stat-value">{stats.processing}</div>
          <div className="sync-stat-label">En cours</div>
        </div>
        <div className="sync-stat-card">
          <div className="sync-stat-value">{stats.completed}</div>
          <div className="sync-stat-label">Complétés</div>
        </div>
        <div className="sync-stat-card">
          <div className="sync-stat-value" style={{ color: '#ef4444' }}>{stats.failed}</div>
          <div className="sync-stat-label">Échoués</div>
        </div>
      </div>

      {/* Actions */}
      <div className="sync-actions">
        <button
          className="sync-btn"
          onClick={handleTriggerSync}
          disabled={syncing}
        >
          <RefreshCw size={16} className={syncing ? 'spin' : ''} />
          {syncing ? 'Synchronisation...' : 'Déclencher sync'}
        </button>
        <button
          className="sync-btn"
          onClick={handleRetryFailed}
          style={{ background: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.3)', color: '#f59e0b' }}
        >
          <Activity size={16} />
          Réessayer échecs
        </button>
        <button
          className="sync-btn"
          onClick={handleCleanup}
          style={{ background: 'rgba(107,114,128,0.15)', borderColor: 'rgba(107,114,128,0.3)', color: '#9ca3af' }}
        >
          Nettoyer vieux jobs
        </button>
      </div>

      {/* Table */}
      <div className="sync-table-container">
        <table className="sync-table">
          <thead>
            <tr>
              <th>Table</th>
              <th>Opération</th>
              <th>Statut</th>
              <th>Tentatives</th>
              <th>Erreur</th>
              <th>Date création</th>
              <th>Date traitement</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <Activity size={48} style={{ opacity: 0.5, marginBottom: 16 }} />
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: '#e8e8f2', marginBottom: 8 }}>
                      Aucun job de synchronisation
                    </h3>
                    <p style={{ fontSize: 13 }}>
                      La synchronisation est à jour
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <code style={{ fontSize: 12, color: '#3b82f6' }}>{job.table_name}</code>
                  </td>
                  <td>{job.operation}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(job.status)}`}>
                      {getStatusIcon(job.status)}
                      {job.status}
                    </span>
                  </td>
                  <td>{job.attempts}</td>
                  <td>
                    {job.last_error ? (
                      <code style={{ fontSize: 11, color: '#ef4444' }}>
                        {job.last_error.substring(0, 50)}...
                      </code>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{new Date(job.created_at).toLocaleString('fr-FR')}</td>
                  <td>{job.processed_at ? new Date(job.processed_at).toLocaleString('fr-FR') : '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <div className="pagination-info">
              Page {page} sur {totalPages} • {total} jobs
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

export default SyncCenterPage;