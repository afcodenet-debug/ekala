import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Users, CreditCard, Settings, Mail, Phone, MapPin, Calendar, User, Plus, X, Loader2, Sparkles, Edit2, Trash2 } from 'lucide-react';
import { api, requestPlatform } from '../../lib/api-client';

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
  phone?: string;
  username?: string;
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
  const [showAddUser, setShowAddUser] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [addUserSuccess, setAddUserSuccess] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    email: '',
    full_name: '',
    phone: '',
    username: '',
    password: 'changeme123',
    pin_code: '0000',
    role: 'waiter',
    tenant_role: 'user',
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    email: '',
    full_name: '',
    phone: '',
    username: '',
    role: 'waiter',
    tenant_role: 'user',
    is_active: true,
  });
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<number | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

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
      } else {
        console.error('Failed to load tenant details: API returned error', data);
      }
    } catch (error: any) {
      console.error('Failed to load tenant details:', error);
      // Keep tenant null, show error state
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

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setAddUserError(null);
    setAddUserSuccess(null);
    setAddingUser(true);
    try {
      const data = await api.platform.createTenantUser(parseInt(id), {
        email: userForm.email,
        full_name: userForm.full_name,
        phone: userForm.phone || undefined,
        username: userForm.username || undefined,
        password: userForm.password,
        pin_code: userForm.pin_code,
        role: userForm.role,
        tenant_role: userForm.tenant_role,
      });
      if (data.success) {
        setAddUserSuccess('Utilisateur créé avec succès !');
        setUserForm({ email: '', full_name: '', phone: '', username: '', password: 'changeme123', pin_code: '0000', role: 'waiter', tenant_role: 'user' });
        setShowAddUser(false);
        loadTenantDetails(parseInt(id));
        setTimeout(() => setAddUserSuccess(null), 3000);
      }
    } catch (error: any) {
      setAddUserError(error.message || 'Erreur lors de la création');
    } finally {
      setAddingUser(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditUserForm({
      email: user.email,
      full_name: user.full_name,
      phone: user.phone || '',
      username: user.username || '',
      role: user.role,
      tenant_role: user.tenant_role,
      is_active: user.status === 'active',
    });
    setEditError(null);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !editingUser) return;
    setEditing(true);
    setEditError(null);
    try {
      await requestPlatform(`/platform/tenants/${id}/users/${editingUser.id}`, {
        method: 'PUT',
        body: {
          email: editUserForm.email,
          full_name: editUserForm.full_name,
          phone: editUserForm.phone || undefined,
          username: editUserForm.username || undefined,
          role: editUserForm.role,
          tenant_role: editUserForm.tenant_role,
          is_active: editUserForm.is_active,
        },
      });
      setEditingUser(null);
      loadTenantDetails(parseInt(id));
    } catch (error: any) {
      setEditError(error.message || 'Erreur lors de la modification');
    } finally {
      setEditing(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!id) return;
    setConfirmDeleteUserId(userId);
  };

  const confirmDelete = async () => {
    if (!id || !confirmDeleteUserId) return;
    setDeletingUserId(confirmDeleteUserId);
    setConfirmDeleteUserId(null);
    try {
      await requestPlatform(`/platform/tenants/${id}/users/${confirmDeleteUserId}`, {
        method: 'DELETE',
      });
      showToast('success', 'Utilisateur supprimé avec succès');
      loadTenantDetails(parseInt(id));
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de la suppression');
    } finally {
      setDeletingUserId(null);
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={16} />
              Utilisateurs du tenant ({users.length})
            </h3>
            <button
              onClick={() => {
                setShowAddUser(true);
              }}
              type="button"
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
                transition: 'all 140ms',
                pointerEvents: 'auto',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(59,130,246,0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.3)';
              }}
            >
              <Plus size={16} />
              Ajouter un utilisateur
            </button>
          </div>
      {users.length === 0 ? (
        <p style={{ color: '#6a6a80', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
          Aucun utilisateur dans ce tenant
        </p>
      ) : (
        <table className="users-table">
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Rôle</th>
              <th>Rôle Tenant</th>
              <th>Statut</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
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
                <td>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => handleEditUser(user)}
                      style={{
                        padding: '6px 12px',
                        background: 'rgba(59,130,246,0.1)',
                        border: '1px solid rgba(59,130,246,0.3)',
                        borderRadius: 6,
                        color: '#3b82f6',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Edit2 size={12} />
                      Modifier
                    </button>
                    <button
                      onClick={() => setConfirmDeleteUserId(user.id)}
                      disabled={deletingUserId === user.id}
                      style={{
                        padding: '6px 12px',
                        background: deletingUserId === user.id ? 'rgba(239,68,68,0.05)' : 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 6,
                        color: '#ef4444',
                        cursor: deletingUserId === user.id ? 'not-allowed' : 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        opacity: deletingUserId === user.id ? 0.5 : 1,
                      }}
                    >
                      <Trash2 size={12} />
                      {deletingUserId === user.id ? 'Suppression...' : 'Supprimer'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      
      {/* Debug info */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ marginTop: 20, padding: 10, background: 'rgba(59,130,246,0.1)', borderRadius: 8, fontSize: 11, color: '#3b82f6' }}>
          Debug: Tenant ID = {id} | Tenant loaded: {tenant ? '✅' : '❌'} | Users count: {users.length} | Loading: {loading ? 'Yes' : 'No'}
        </div>
      )}
        </div>

        {/* Modal - Rendu ici pour l'onglet users */}
        {showAddUser && tenant && (
          <div
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={() => {
              console.log('🔴 Modal backdrop clicked');
              setShowAddUser(false);
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16, padding: 32, width: '90%', maxWidth: 480,
                maxHeight: '90vh', overflowY: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#e8e8f2' }}>Ajouter un utilisateur</h2>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6a6a80' }}>Nouvel utilisateur pour {tenant?.name}</p>
                </div>
                <button
                  onClick={() => setShowAddUser(false)}
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#a0a0b8', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {addUserError && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '12px 16px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                  {addUserError}
                </div>
              )}

              <form onSubmit={handleAddUser}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#a0a0b8', display: 'block', marginBottom: 6 }}>
                      Email <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={userForm.email}
                      onChange={(e) => setUserForm(f => ({ ...f, email: e.target.value }))}
                      style={{
                        width: '100%', padding: '10px 14px',
                        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8, color: '#e8e8f2', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                      }}
                      placeholder="user@example.com"
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#a0a0b8', display: 'block', marginBottom: 6 }}>
                      Nom complet <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={userForm.full_name}
                      onChange={(e) => setUserForm(f => ({ ...f, full_name: e.target.value }))}
                      style={{
                        width: '100%', padding: '10px 14px',
                        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8, color: '#e8e8f2', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                      }}
                      placeholder="Jean Dupont"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#a0a0b8', display: 'block', marginBottom: 6 }}>Téléphone</label>
                    <input
                      type="text"
                      value={userForm.phone}
                      onChange={(e) => setUserForm(f => ({ ...f, phone: e.target.value }))}
                      style={{
                        width: '100%', padding: '10px 14px',
                        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8, color: '#e8e8f2', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                      }}
                      placeholder="+33..."
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#a0a0b8', display: 'block', marginBottom: 6 }}>Username</label>
                    <input
                      type="text"
                      value={userForm.username}
                      onChange={(e) => setUserForm(f => ({ ...f, username: e.target.value }))}
                      style={{
                        width: '100%', padding: '10px 14px',
                        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8, color: '#e8e8f2', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                      }}
                      placeholder="jdupont"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#a0a0b8', display: 'block', marginBottom: 6 }}>Rôle</label>
                    <select
                      value={userForm.role}
                      onChange={(e) => setUserForm(f => ({ ...f, role: e.target.value }))}
                      style={{
                        width: '100%', padding: '10px 14px',
                        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8, color: '#e8e8f2', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                      }}
                    >
                      <option value="waiter">Waiter</option>
                      <option value="cashier">Cashier</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                      <option value="owner">Owner</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#a0a0b8', display: 'block', marginBottom: 6 }}>Rôle Tenant</label>
                    <select
                      value={userForm.tenant_role}
                      onChange={(e) => setUserForm(f => ({ ...f, tenant_role: e.target.value }))}
                      style={{
                        width: '100%', padding: '10px 14px',
                        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8, color: '#e8e8f2', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                      }}
                    >
                      <option value="user">User</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#a0a0b8', display: 'block', marginBottom: 6 }}>
                      Mot de passe
                    </label>
                    <input
                      type="text"
                      value={userForm.password}
                      onChange={(e) => setUserForm(f => ({ ...f, password: e.target.value }))}
                      style={{
                        width: '100%', padding: '10px 14px',
                        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8, color: '#e8e8f2', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                    <span style={{ fontSize: 11, color: '#6a6a80', marginTop: 4, display: 'block' }}>Défaut: changeme123</span>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#a0a0b8', display: 'block', marginBottom: 6 }}>
                      Code PIN <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={4}
                      value={userForm.pin_code}
                      onChange={(e) => setUserForm(f => ({ ...f, pin_code: e.target.value }))}
                      style={{
                        width: '100%', padding: '10px 14px',
                        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8, color: '#e8e8f2', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                      }}
                      placeholder="0000"
                    />
                    <span style={{ fontSize: 11, color: '#6a6a80', marginTop: 4, display: 'block' }}>Code PIN à 4 chiffres</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddUser(false)}
                    disabled={addingUser}
                    style={{
                      padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)', color: '#a0a0b8',
                    }}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={addingUser}
                    style={{
                      padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                      border: 'none', color: '#fff',
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
                      opacity: addingUser ? 0.5 : 1,
                    }}
                  >
                    {addingUser ? (
                      <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Création...</>
                    ) : (
                      <><Sparkles size={16} /> Créer l'utilisateur</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* Modal de confirmation de suppression */}
        {confirmDeleteUserId && (
          <div
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1001,
            }}
            onClick={() => setConfirmDeleteUserId(null)}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16, padding: 32, width: '90%', maxWidth: 400,
                textAlign: 'center',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'rgba(239,68,68,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                }}>
                  <Trash2 size={24} color="#ef4444" />
                </div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#e8e8f2' }}>
                  Confirmer la suppression
                </h2>
                <p style={{ margin: '8px 0 0', fontSize: 13, color: '#6a6a80', lineHeight: 1.5 }}>
                  Êtes-vous sûr de vouloir supprimer cet utilisateur du tenant ?<br />
                  Cette action est irréversible.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button
                  onClick={() => setConfirmDeleteUserId(null)}
                  style={{
                    padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)', color: '#a0a0b8',
                  }}
                >
                  Annuler
                </button>
                <button
                  onClick={confirmDelete}
                  style={{
                    padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    border: 'none', color: '#fff',
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    boxShadow: '0 4px 12px rgba(239,68,68,0.3)',
                  }}
                >
                  <Trash2 size={14} />
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Premium Toast Notification - WOW Design */}
        {toast && (
          <div
            style={{
              position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
              maxWidth: 420, width: '100%',
              animation: 'toast-slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            {/* Glass morphism card */}
            <div style={{
              position: 'relative',
              background: toast.type === 'success'
                ? 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(5,150,105,0.08))'
                : 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(220,38,38,0.08))',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: toast.type === 'success'
                ? '1px solid rgba(16,185,129,0.25)'
                : '1px solid rgba(239,68,68,0.25)',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: toast.type === 'success'
                ? '0 12px 40px rgba(16,185,129,0.2), 0 0 0 1px rgba(0,0,0,0.4)'
                : '0 12px 40px rgba(239,68,68,0.2), 0 0 0 1px rgba(0,0,0,0.4)',
            }}>
              {/* Animated glow bar */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                background: toast.type === 'success'
                  ? 'linear-gradient(90deg, transparent, #10b981, transparent)'
                  : 'linear-gradient(90deg, transparent, #ef4444, transparent)',
                animation: 'toast-glow 2s ease-in-out infinite',
              }} />

              {/* Content */}
              <div style={{ padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                {/* Icon container with glow */}
                <div style={{
                  position: 'relative',
                  flexShrink: 0,
                  width: 40, height: 40,
                  borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: toast.type === 'success'
                    ? 'rgba(16,185,129,0.15)'
                    : 'rgba(239,68,68,0.15)',
                  border: toast.type === 'success'
                    ? '1px solid rgba(16,185,129,0.3)'
                    : '1px solid rgba(239,68,68,0.3)',
                }}>
                  {/* Glow effect */}
                  <div style={{
                    position: 'absolute', inset: -4, borderRadius: 16,
                    background: toast.type === 'success'
                      ? 'radial-gradient(circle, rgba(16,185,129,0.2), transparent 70%)'
                      : 'radial-gradient(circle, rgba(239,68,68,0.2), transparent 70%)',
                    animation: 'toast-pulse 2s ease-in-out infinite',
                  }} />
                  
                  {toast.type === 'success' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative', zIndex: 1 }}>
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative', zIndex: 1 }}>
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  )}
                </div>

                {/* Text content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 700,
                    color: toast.type === 'success' ? '#10b981' : '#ef4444',
                    marginBottom: 4,
                    letterSpacing: '-0.01em',
                  }}>
                    {toast.type === 'success' ? '✓ Succès' : '⚠ Erreur'}
                  </div>
                  <div style={{
                    fontSize: 13, fontWeight: 500,
                    color: '#c0c0d0',
                    lineHeight: 1.5,
                  }}>
                    {toast.message}
                  </div>
                  {/* Subtle meta line */}
                  <div style={{
                    marginTop: 8, fontSize: 10, fontWeight: 600,
                    color: toast.type === 'success' ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span style={{
                      width: 4, height: 4, borderRadius: '50%',
                      background: toast.type === 'success' ? '#10b981' : '#ef4444',
                    }} />
                    {toast.type === 'success' ? 'Action confirmée' : 'Action échouée'}
                    <span style={{ opacity: 0.4 }}>·</span>
                    <span>Fermeture auto</span>
                  </div>
                </div>

                {/* Close button */}
                <button
                  onClick={() => setToast(null)}
                  style={{
                    flexShrink: 0,
                    width: 24, height: 24, borderRadius: 6,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: '#5a5a72',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 150ms',
                    marginTop: 2,
                  }}
                  onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#9090aa'; }}
                  onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#5a5a72'; }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast animations */}
        <style>{`
          @keyframes toast-slide-up {
            from { opacity: 0; transform: translateY(20px) scale(0.95); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes toast-glow {
            0%, 100% { opacity: 0.3; }
            50%       { opacity: 1; }
          }
          @keyframes toast-pulse {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50%       { opacity: 0.8; transform: scale(1.15); }
          }
        `}</style>

        {/* Modal d'édition d'utilisateur */}
        {editingUser && (
          <div
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={() => setEditingUser(null)}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16, padding: 32, width: '90%', maxWidth: 480,
                maxHeight: '90vh', overflowY: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#e8e8f2' }}>Modifier l'utilisateur</h2>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6a6a80' }}>{editingUser.full_name}</p>
                </div>
                <button
                  onClick={() => setEditingUser(null)}
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#a0a0b8', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {editError && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '12px 16px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                  {editError}
                </div>
              )}

              <form onSubmit={handleUpdateUser}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#a0a0b8', display: 'block', marginBottom: 6 }}>
                      Email <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={editUserForm.email}
                      onChange={(e) => setEditUserForm(f => ({ ...f, email: e.target.value }))}
                      style={{
                        width: '100%', padding: '10px 14px',
                        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8, color: '#e8e8f2', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#a0a0b8', display: 'block', marginBottom: 6 }}>
                      Nom complet <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editUserForm.full_name}
                      onChange={(e) => setEditUserForm(f => ({ ...f, full_name: e.target.value }))}
                      style={{
                        width: '100%', padding: '10px 14px',
                        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8, color: '#e8e8f2', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#a0a0b8', display: 'block', marginBottom: 6 }}>Téléphone</label>
                    <input
                      type="text"
                      value={editUserForm.phone}
                      onChange={(e) => setEditUserForm(f => ({ ...f, phone: e.target.value }))}
                      style={{
                        width: '100%', padding: '10px 14px',
                        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8, color: '#e8e8f2', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#a0a0b8', display: 'block', marginBottom: 6 }}>Username</label>
                    <input
                      type="text"
                      value={editUserForm.username}
                      onChange={(e) => setEditUserForm(f => ({ ...f, username: e.target.value }))}
                      style={{
                        width: '100%', padding: '10px 14px',
                        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8, color: '#e8e8f2', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#a0a0b8', display: 'block', marginBottom: 6 }}>Rôle</label>
                    <select
                      value={editUserForm.role}
                      onChange={(e) => setEditUserForm(f => ({ ...f, role: e.target.value }))}
                      style={{
                        width: '100%', padding: '10px 14px',
                        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8, color: '#e8e8f2', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                      }}
                    >
                      <option value="waiter">Waiter</option>
                      <option value="cashier">Cashier</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                      <option value="owner">Owner</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#a0a0b8', display: 'block', marginBottom: 6 }}>Rôle Tenant</label>
                    <select
                      value={editUserForm.tenant_role}
                      onChange={(e) => setEditUserForm(f => ({ ...f, tenant_role: e.target.value }))}
                      style={{
                        width: '100%', padding: '10px 14px',
                        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8, color: '#e8e8f2', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                      }}
                    >
                      <option value="user">User</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#a0a0b8', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={editUserForm.is_active}
                        onChange={(e) => setEditUserForm(f => ({ ...f, is_active: e.target.checked }))}
                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                      />
                      Utilisateur actif
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    disabled={editing}
                    style={{
                      padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)', color: '#a0a0b8',
                    }}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={editing}
                    style={{
                      padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                      border: 'none', color: '#fff',
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
                      opacity: editing ? 0.5 : 1,
                    }}
                  >
                    {editing ? (
                      <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Modification...</>
                    ) : (
                      <><Sparkles size={16} /> Enregistrer</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
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
