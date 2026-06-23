import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Ban, CheckCircle, Eye, ChevronLeft, ChevronRight, Building2,
  MoreVertical, Users, FileText, Trash2, Edit, Mail
} from 'lucide-react';
import { api } from '../../lib/api-client';

interface Tenant {
  id: number;
  name: string;
  slug: string | null;
  owner_email: string;
  country: string;
  city: string | null;
  status: string;
  plan_code: string | null;
  is_provisioned: boolean;
  created_at: string;
  updated_at: string;
  subscription_status: string | null;
  subscription_ends_at: string | null;
  users_count: number;
  sync_status?: string;
}

const styles = `
  .tenants-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 16px;
  }
  .tenants-title {
    font-size: 24px;
    font-weight: 800;
    color: #e8e8f2;
    letter-spacing: -0.02em;
  }
  .tenants-subtitle {
    font-size: 13px;
    color: #6a6a80;
    margin-top: 4px;
  }
  .tenants-filters {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }
  .tenants-search {
    flex: 1;
    min-width: 240px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: #0f0f18;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
  }
  .tenants-search-icon {
    width: 18px;
    height: 18px;
    color: #6a6a80;
    flex-shrink: 0;
  }
  .tenants-search-input {
    background: transparent;
    border: none;
    outline: none;
    color: #e8e8f2;
    font-size: 13px;
    width: 100%;
  }
  .tenants-search-input::placeholder {
    color: #6a6a80;
  }
  .tenants-filter-select {
    padding: 10px 14px;
    background: #0f0f18;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    color: #e8e8f2;
    font-size: 13px;
    min-width: 140px;
    cursor: pointer;
  }
  .tenants-table-container {
    background: #0f0f18;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    overflow: hidden;
  }
  .tenants-table {
    width: 100%;
    border-collapse: collapse;
  }
  .tenants-table th {
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
  .tenants-table td {
    padding: 14px 16px;
    font-size: 13px;
    color: #e8e8f2;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .tenants-table tr:hover td {
    background: rgba(255,255,255,0.02);
  }
  .tenant-name-cell {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .tenant-avatar {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    color: #fff;
  }
  .tenant-name {
    font-weight: 600;
    color: #e8e8f2;
  }
  .tenant-slug {
    font-size: 11px;
    color: #6a6a80;
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
  .status-badge.cancelled {
    background: rgba(107,114,128,0.15);
    color: #9ca3af;
  }
  .action-btn {
    width: 32px;
    height: 32px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03);
    border-radius: 6px;
    color: #a0a0b8;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 140ms;
  }
  .action-btn:hover {
    background: rgba(255,255,255,0.06);
    color: #e8e8f2;
  }
  .action-btn.danger:hover {
    background: rgba(239,68,68,0.1);
    border-color: rgba(239,68,68,0.3);
    color: #ef4444;
  }
  .action-btn.success:hover {
    background: rgba(34,197,94,0.1);
    border-color: rgba(34,197,94,0.3);
    color: #22c55e;
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
  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 14px;
    background: transparent;
    border: none;
    color: #a0a0b8;
    font-size: 13px;
    cursor: pointer;
    transition: all 140ms;
    text-align: left;
  }
  .dropdown-item:hover {
    background: rgba(255,255,255,0.06);
    color: #e8e8f2;
  }
  .dropdown-item.success:hover {
    background: rgba(34,197,94,0.1);
    color: #22c55e;
  }
  .dropdown-item.warning:hover {
    background: rgba(245,158,11,0.1);
    color: #f59e0b;
  }
  .dropdown-item.danger:hover {
    background: rgba(239,68,68,0.1);
    color: #ef4444;
  }
  .sync-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
  }
  .sync-badge.syncing {
    background: rgba(59,130,246,0.15);
    color: #3b82f6;
  }
  .sync-badge.error {
    background: rgba(239,68,68,0.15);
    color: #ef4444;
  }
  .sync-badge.success {
    background: rgba(34,197,94,0.15);
    color: #22c55e;
  }
  .sync-badge.idle {
    background: rgba(107,114,128,0.15);
    color: #9ca3af;
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

const TenantsPage = () => {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  useEffect(() => {
    loadTenants();
  }, [page, statusFilter]);

  const loadTenants = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 50,
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      };

      const data = await api.platform.getTenants(params);
      if (data.success && Array.isArray(data.tenants)) {
        setTenants(data.tenants);
        setTotalPages(data.pagination?.pages || 0);
        setTotal(data.pagination?.total || 0);
      }
    } catch (error: any) {
      console.error('Failed to load tenants:', error);
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadTenants();
  };

  const toggleMenu = (tenantId: number) => {
    setOpenMenuId(openMenuId === tenantId ? null : tenantId);
  };

  const handleEdit = (tenantId: number) => {
    navigate(`/platform/tenants/${tenantId}/edit`);
  };

  const handleViewUsers = (tenantId: number) => {
    navigate(`/platform/tenants/${tenantId}?tab=users`);
  };

  const handleViewLogs = (tenantId: number) => {
    navigate(`/platform/audit-logs?tenant_id=${tenantId}`);
  };

  const handleSendEmail = (tenantId: number) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (tenant?.owner_email) {
      window.open(`mailto:${tenant.owner_email}`, '_blank');
    }
  };

  const handleSuspend = async (tenantId: number) => {
    const reason = prompt('Raison de la suspension:');
    if (!reason) return;

    try {
      const data = await api.platform.suspendTenant(tenantId, reason) as any;
      if (data?.success) {
        loadTenants();
      } else {
        alert(data?.message || 'Erreur');
      }
    } catch (error: any) {
      console.error('Failed to suspend tenant:', error);
      alert(error.message || 'Erreur lors de la suspension');
    }
  };

  const handleActivate = async (tenantId: number) => {
    if (!confirm('Réactiver ce tenant ?')) return;

    try {
      const data = await api.platform.activateTenant(tenantId) as any;
      if (data?.success) {
        loadTenants();
      } else {
        alert(data?.message || 'Erreur');
      }
    } catch (error: any) {
      console.error('Failed to activate tenant:', error);
      alert(error.message || 'Erreur lors de la réactivation');
    }
  };

  const handleDelete = async (tenantId: number) => {
    if (!confirm('ATTENTION: Cette action est irréversible.\n\nÊtes-vous absolument certain ?')) {
      return;
    }

    try {
      // TODO: Implémenter deleteTenant dans l'API backend
      alert('Fonctionnalité de suppression à implémenter dans le backend');
      setOpenMenuId(null);
    } catch (error: any) {
      console.error('Failed to delete tenant:', error);
      alert(error.message || 'Erreur lors de la suppression');
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'active': return 'active';
      case 'suspended': return 'suspended';
      case 'trial': return 'trial';
      case 'cancelled': return 'cancelled';
      default: return '';
    }
  };

  if (loading) {
    return <div className="loading-spinner" />;
  }

  return (
    <div>
      <style>{styles}</style>

      <div className="tenants-header">
        <div>
          <h1 className="tenants-title">Gestion des Tenants</h1>
          <p className="tenants-subtitle">{total} tenants au total</p>
        </div>
      </div>

      {/* Filters */}
      <form className="tenants-filters" onSubmit={handleSearch}>
        <div className="tenants-search">
          <Search size={18} className="tenants-search-icon" />
          <input
            type="text"
            placeholder="Rechercher par nom, email ou slug..."
            className="tenants-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="tenants-filter-select"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tous les statuts</option>
          <option value="active">Actif</option>
          <option value="suspended">Suspendu</option>
          <option value="trial">Essai</option>
          <option value="cancelled">Annulé</option>
        </select>
      </form>

      {/* Table */}
      <div className="tenants-table-container">
        <table className="tenants-table">
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Pays</th>
              <th>Statut</th>
              <th>Plan</th>
              <th>Abonnement</th>
              <th>Utilisateurs</th>
              <th>Créé le</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <Building2 size={48} style={{ opacity: 0.5, marginBottom: 16 }} />
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: '#e8e8f2', marginBottom: 8 }}>
                      Aucun tenant trouvé
                    </h3>
                    <p style={{ fontSize: 13 }}>
                      {search || statusFilter ? 'Essayez de modifier vos filtres' : 'Aucun tenant enregistré'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              tenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td>
                    <div className="tenant-name-cell">
                      <div className="tenant-avatar">
                        {tenant.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="tenant-name">{tenant.name}</div>
                        <div className="tenant-slug">{tenant.slug || tenant.owner_email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{tenant.country}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(tenant.status)}`}>
                      {tenant.status}
                    </span>
                  </td>
                  <td>{tenant.plan_code || '-'}</td>
                  <td>{tenant.subscription_status || '-'}</td>
                  <td>{tenant.users_count}</td>
                  <td>{new Date(tenant.created_at).toLocaleDateString('fr-FR')}</td>
                  <td>
                    <span className={`sync-badge ${tenant.sync_status || 'idle'}`}>
                      {tenant.sync_status === 'syncing' ? '⏳ Sync...' : 
                       tenant.sync_status === 'error' ? '❌ Erreur' : 
                       tenant.sync_status === 'success' ? '✓ Sync' : '—'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button
                        className="action-btn"
                        onClick={() => navigate(`/platform/tenants/${tenant.id}`)}
                        title="Voir détails"
                      >
                        <Eye size={14} />
                      </button>
                      <div style={{ position: 'relative' }}>
                        <button
                          className="action-btn"
                          onClick={() => toggleMenu(tenant.id)}
                          title="Plus d'actions"
                        >
                          <MoreVertical size={14} />
                        </button>
                        {openMenuId === tenant.id && (
                          <>
                            <div
                              style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 999
                              }}
                              onClick={() => setOpenMenuId(null)}
                            />
                            <div style={{
                              position: 'absolute',
                              right: 0,
                              top: '100%',
                              marginTop: 4,
                              background: '#1a1a2e',
                              border: '1px solid #2d2d44',
                              borderRadius: 8,
                              minWidth: 200,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                              zIndex: 1000
                            }}>
                              <button
                                className="dropdown-item"
                                onClick={() => { handleEdit(tenant.id); setOpenMenuId(null); }}
                              >
                                <Edit size={14} />
                                <span>Éditer</span>
                              </button>
                              <button
                                className="dropdown-item"
                                onClick={() => { handleViewUsers(tenant.id); setOpenMenuId(null); }}
                              >
                                <Users size={14} />
                                <span>Utilisateurs</span>
                              </button>
                              <button
                                className="dropdown-item"
                                onClick={() => { handleViewLogs(tenant.id); setOpenMenuId(null); }}
                              >
                                <FileText size={14} />
                                <span>Logs d'audit</span>
                              </button>
                              <button
                                className="dropdown-item"
                                onClick={() => { handleSendEmail(tenant.id); setOpenMenuId(null); }}
                              >
                                <Mail size={14} />
                                <span>Envoyer un email</span>
                              </button>
                              <div style={{ height: 1, background: '#2d2d44', margin: '4px 0' }} />
                              {tenant.status === 'suspended' ? (
                                <button
                                  className="dropdown-item success"
                                  onClick={() => { handleActivate(tenant.id); setOpenMenuId(null); }}
                                >
                                  <CheckCircle size={14} />
                                  <span>Réactiver</span>
                                </button>
                              ) : (
                                <button
                                  className="dropdown-item warning"
                                  onClick={() => { handleSuspend(tenant.id); setOpenMenuId(null); }}
                                >
                                  <Ban size={14} />
                                  <span>Suspendre</span>
                                </button>
                              )}
                              <div style={{ height: 1, background: '#2d2d44', margin: '4px 0' }} />
                              <button
                                className="dropdown-item danger"
                                onClick={() => { handleDelete(tenant.id); setOpenMenuId(null); }}
                              >
                                <Trash2 size={14} />
                                <span>Supprimer</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
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
              Page {page} sur {totalPages} • {total} tenants
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

export default TenantsPage;