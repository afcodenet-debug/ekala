import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Users, CreditCard, Settings, Mail, Phone, MapPin, Calendar, User } from 'lucide-react';
import { api } from '../../lib/api-client';

interface Tenant {
  id: number;
  name: string;
  slug: string | null;
  owner_email: string;
  owner_phone?: string;
  country: string;
  city: string | null;
  address?: string;
  status: string;
  is_provisioned: boolean;
  created_at: string;
  updated_at: string;
  subscription_status?: string;
  subscription_ends_at?: string;
  plan_code?: string;
  plan_name?: string;
  users_count: number;
}

interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
  status: string;
  tenant_role: string;
  is_active: boolean;
}

const styles = `
  .tenant-details {
    max-width: 1200px;
    margin: 0 auto;
  }
  .tenant-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 32px;
  }
  .back-btn {
    width: 40px;
    height: 40px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03);
    border-radius: 8px;
    color: #a0a0b8;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 140ms;
  }
  .back-btn:hover {
    background: rgba(255,255,255,0.06);
    color: #e8e8f2;
  }
  .tenant-avatar-large {
    width: 64px;
    height: 64px;
    border-radius: 12px;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 700;
    color: #fff;
  }
  .tenant-info h1 {
    font-size: 28px;
    font-weight: 800;
    color: #e8e8f2;
    margin: 0 0 4px 0;
  }
  .tenant-info p {
    font-size: 13px;
    color: #6a6a80;
    margin: 0;
  }
  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
    margin-bottom: 32px;
  }
  .info-card {
    background: #0f0f18;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 20px;
  }
  .info-card h3 {
    font-size: 14px;
    font-weight: 600;
    color: #e8e8f2;
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .info-row:last-child {
    border-bottom: none;
  }
  .info-label {
    font-size: 13px;
    color: #6a6a80;
  }
  .info-value {
    font-size: 13px;
    color: #e8e8f2;
    font-weight: 500;
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
  .users-table {
    width: 100%;
    border-collapse: collapse;
  }
  .users-table th {
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
  .users-table td {
    padding: 12px 16px;
    font-size: 13px;
    color: #e8e8f2;
    border-bottom: 1px solid rgba(255,255,255,0.04);
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
`;

const TenantDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadTenantDetails(parseInt(id));
    }
  }, [id]);

  const loadTenantDetails = async (tenantId: number) => {
    setLoading(true);
    try {
      const data: any = await api.platform.getTenant(tenantId);
      if (data.success) {
        setTenant(data.tenant);
        setUsers(data.users || []);
      }
    } catch (error: any) {
      console.error('Failed to load tenant details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'active': return 'active';
      case 'suspended': return 'suspended';
      case 'trial': return 'trial';
      default: return '';
    }
  };

  if (loading) {
    return <div className="loading-spinner" />;
  }

  if (!tenant) {
    return (
      <div className="tenant-details">
        <div className="empty-state">
          <h2>Tenant introuvable</h2>
          <button className="back-btn" onClick={() => navigate('/platform/tenants')}>
            <ArrowLeft size={20} />
          </button>
        </div>
      </div>
    );
  }

  // Si on est sur l'onglet users, afficher uniquement la liste des utilisateurs
  if (activeTab === 'users') {
    return (
      <div className="tenant-details">
        <style>{styles}</style>

        <div className="tenant-header">
          <button className="back-btn" onClick={() => navigate(`/platform/tenants/${id}`)}>
            <ArrowLeft size={20} />
          </button>
          <div className="tenant-avatar-large">
            {tenant.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="tenant-info">
            <h1>Utilisateurs - {tenant.name}</h1>
            <p>{tenant.slug || tenant.owner_email}</p>
          </div>
        </div>

        <div className="info-card">
          <h3>
            <Users size={16} />
            Utilisateurs du tenant ({users.length})
          </h3>
          {users.length === 0 ? (
            <p style={{ color: '#6a6a80', fontSize: 13 }}>Aucun utilisateur</p>
          ) : (
            <table className="users-table">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Rôle</th>
                  <th>Rôle Tenant</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600 }}>{user.full_name}</div>
                        <div style={{ fontSize: 11, color: '#6a6a80' }}>{user.email}</div>
                      </div>
                    </td>
                    <td>{user.role}</td>
                    <td>{user.tenant_role}</td>
                    <td>
                      <span className={`status-badge ${user.status === 'active' ? 'active' : 'suspended'}`}>
                        {user.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // Vue par défaut: overview avec toutes les informations
  return (
    <div className="tenant-details">
      <style>{styles}</style>

      <div className="tenant-header">
        <button className="back-btn" onClick={() => navigate('/platform/tenants')}>
          <ArrowLeft size={20} />
        </button>
        <div className="tenant-avatar-large">
          {tenant.name.substring(0, 2).toUpperCase()}
        </div>
        <div className="tenant-info">
          <h1>{tenant.name}</h1>
          <p>{tenant.slug || tenant.owner_email}</p>
        </div>
      </div>

      <div className="info-grid">
        {/* Informations générales */}
        <div className="info-card">
          <h3>
            <Settings size={16} />
            Informations générales
          </h3>
          <div className="info-row">
            <span className="info-label">Statut</span>
            <span className={`status-badge ${getStatusClass(tenant.status)}`}>
              {tenant.status}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Pays</span>
            <span className="info-value">{tenant.country}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Ville</span>
            <span className="info-value">{tenant.city || '-'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Créé le</span>
            <span className="info-value">
              {new Date(tenant.created_at).toLocaleDateString('fr-FR')}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Modifié le</span>
            <span className="info-value">
              {new Date(tenant.updated_at).toLocaleDateString('fr-FR')}
            </span>
          </div>
        </div>

        {/* Contact */}
        <div className="info-card">
          <h3>
            <Mail size={16} />
            Contact
          </h3>
          <div className="info-row">
            <span className="info-label">Email</span>
            <span className="info-value">{tenant.owner_email}</span>
          </div>
          {tenant.owner_phone && (
            <div className="info-row">
              <span className="info-label">Téléphone</span>
              <span className="info-value">{tenant.owner_phone}</span>
            </div>
          )}
          {tenant.address && (
            <div className="info-row">
              <span className="info-label">Adresse</span>
              <span className="info-value">{tenant.address}</span>
            </div>
          )}
        </div>

        {/* Abonnement */}
        <div className="info-card">
          <h3>
            <CreditCard size={16} />
            Abonnement
          </h3>
          <div className="info-row">
            <span className="info-label">Plan</span>
            <span className="info-value">{tenant.plan_code || '-'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Statut</span>
            <span className="info-value">{tenant.subscription_status || '-'}</span>
          </div>
          {tenant.subscription_ends_at && (
            <div className="info-row">
              <span className="info-label">Expire le</span>
              <span className="info-value">
                {new Date(tenant.subscription_ends_at).toLocaleDateString('fr-FR')}
              </span>
            </div>
          )}
        </div>

        {/* Statistiques */}
        <div className="info-card">
          <h3>
            <Users size={16} />
            Statistiques
          </h3>
          <div className="info-row">
            <span className="info-label">Utilisateurs</span>
            <span className="info-value">{tenant.users_count}</span>
          </div>
          <div className="info-row">
            <span className="info-label">ID Tenant</span>
            <span className="info-value">#{tenant.id}</span>
          </div>
        </div>
      </div>

      {/* Utilisateurs du tenant */}
      <div className="info-card">
        <h3>
          <Users size={16} />
          Utilisateurs du tenant
        </h3>
        {users.length === 0 ? (
          <p style={{ color: '#6a6a80', fontSize: 13 }}>Aucun utilisateur</p>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Rôle</th>
                <th>Rôle Tenant</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div>
                      <div style={{ fontWeight: 600 }}>{user.full_name}</div>
                      <div style={{ fontSize: 11, color: '#6a6a80' }}>{user.email}</div>
                    </div>
                  </td>
                  <td>{user.role}</td>
                  <td>{user.tenant_role}</td>
                  <td>
                    <span className={`status-badge ${user.status === 'active' ? 'active' : 'suspended'}`}>
                      {user.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default TenantDetailsPage;