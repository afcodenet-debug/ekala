import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
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
}

const styles = `
  .tenant-edit {
    max-width: 800px;
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
  .form-card {
    background: #0f0f18;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 20px;
  }
  .form-card h3 {
    font-size: 16px;
    font-weight: 600;
    color: #e8e8f2;
    margin: 0 0 20px 0;
  }
  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .form-group.full-width {
    grid-column: 1 / -1;
  }
  .form-label {
    font-size: 12px;
    font-weight: 600;
    color: #a0a0b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .form-input {
    padding: 10px 14px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    color: #e8e8f2;
    font-size: 14px;
    transition: all 140ms;
  }
  .form-input:focus {
    outline: none;
    border-color: #3b82f6;
    background: rgba(59,130,246,0.05);
  }
  .form-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .form-select {
    padding: 10px 14px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    color: #e8e8f2;
    font-size: 14px;
    cursor: pointer;
  }
  .form-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 24px;
  }
  .btn {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 140ms;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .btn-primary {
    background: #3b82f6;
    border: 1px solid #3b82f6;
    color: #fff;
  }
  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }
  .btn-secondary {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    color: #a0a0b8;
  }
  .btn-secondary:hover:not(:disabled) {
    background: rgba(255,255,255,0.06);
    color: #e8e8f2;
  }
  .btn:disabled {
    opacity: 0.5;
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
  .alert {
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 20px;
  }
  .alert-success {
    background: rgba(34,197,94,0.1);
    border: 1px solid rgba(34,197,94,0.3);
    color: #22c55e;
  }
  .alert-error {
    background: rgba(239,68,68,0.1);
    border: 1px solid rgba(239,68,68,0.3);
    color: #ef4444;
  }
`;

const TenantEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState<Tenant>({
    id: 0,
    name: '',
    slug: '',
    owner_email: '',
    owner_phone: '',
    country: '',
    city: '',
    address: '',
    status: 'active',
  });

  useEffect(() => {
    if (id) {
      loadTenant(parseInt(id));
    }
  }, [id]);

  const loadTenant = async (tenantId: number) => {
    setLoading(true);
    try {
      const data: any = await api.platform.getTenant(tenantId);
      if (data.success) {
        setFormData({
          id: data.tenant.id,
          name: data.tenant.name,
          slug: data.tenant.slug || '',
          owner_email: data.tenant.owner_email,
          owner_phone: data.tenant.owner_phone || '',
          country: data.tenant.country,
          city: data.tenant.city || '',
          address: data.tenant.address || '',
          status: data.tenant.status,
        });
      }
    } catch (error: any) {
      console.error('Failed to load tenant:', error);
      setMessage({ type: 'error', text: 'Erreur lors du chargement du tenant' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      // TODO: Implémenter updateTenant dans l'API backend
      alert('Fonctionnalité de modification à implémenter dans le backend');
      setMessage({ type: 'success', text: 'Modifications sauvegardées (simulation)' });
      setTimeout(() => navigate(`/platform/tenants/${id}`), 1500);
    } catch (error: any) {
      console.error('Failed to update tenant:', error);
      setMessage({ type: 'error', text: error.message || 'Erreur lors de la sauvegarde' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof Tenant, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return <div className="loading-spinner" />;
  }

  return (
    <div className="tenant-edit">
      <style>{styles}</style>

      <div className="tenant-header">
        <button className="back-btn" onClick={() => navigate(`/platform/tenants/${id}`)}>
          <ArrowLeft size={20} />
        </button>
        <div className="tenant-info">
          <h1>Modifier le tenant</h1>
          <p>{formData.name}</p>
        </div>
      </div>

      {message && (
        <div className={`alert ${message.type}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Informations générales */}
        <div className="form-card">
          <h3>Informations générales</h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Nom *</label>
              <input
                type="text"
                className="form-input"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Slug</label>
              <input
                type="text"
                className="form-input"
                value={formData.slug || ''}
                onChange={(e) => handleChange('slug', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Pays *</label>
              <input
                type="text"
                className="form-input"
                value={formData.country}
                onChange={(e) => handleChange('country', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Ville</label>
              <input
                type="text"
                className="form-input"
                value={formData.city || ''}
                onChange={(e) => handleChange('city', e.target.value)}
              />
            </div>
            <div className="form-group full-width">
              <label className="form-label">Adresse</label>
              <input
                type="text"
                className="form-input"
                value={formData.address || ''}
                onChange={(e) => handleChange('address', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Statut</label>
              <select
                className="form-select"
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
              >
                <option value="active">Actif</option>
                <option value="suspended">Suspendu</option>
                <option value="trial">Essai</option>
                <option value="cancelled">Annulé</option>
              </select>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="form-card">
          <h3>Contact</h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Email propriétaire *</label>
              <input
                type="email"
                className="form-input"
                value={formData.owner_email}
                onChange={(e) => handleChange('owner_email', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Téléphone</label>
              <input
                type="tel"
                className="form-input"
                value={formData.owner_phone || ''}
                onChange={(e) => handleChange('owner_phone', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(`/platform/tenants/${id}`)}
            disabled={saving}
          >
            Annuler
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 size={16} className="spin" />
                Sauvegarde...
              </>
            ) : (
              <>
                <Save size={16} />
                Sauvegarder
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TenantEditPage;