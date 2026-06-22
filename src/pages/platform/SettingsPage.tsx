import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Save } from 'lucide-react';

const API_BASE = (window as any).VITE_API_BASE_URL || 'https://ekala-api.onrender.com/api';

interface PlatformSettings {
  [key: string]: string;
}

const styles = `
  .settings-header {
    margin-bottom: 24px;
  }
  .settings-title {
    font-size: 24px;
    font-weight: 800;
    color: #e8e8f2;
    letter-spacing: -0.02em;
  }
  .settings-subtitle {
    font-size: 13px;
    color: #6a6a80;
    margin-top: 4px;
  }
  .settings-container {
    background: #0f0f18;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 24px;
    max-width: 600px;
  }
  .settings-group {
    margin-bottom: 24px;
  }
  .settings-group:last-child {
    margin-bottom: 0;
  }
  .settings-group-title {
    font-size: 14px;
    font-weight: 700;
    color: #e8e8f2;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .settings-field {
    margin-bottom: 16px;
  }
  .settings-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #a0a0b8;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .settings-input {
    width: 100%;
    padding: 10px 14px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    color: #e8e8f2;
    font-size: 13px;
    outline: none;
    transition: all 140ms;
  }
  .settings-input:focus {
    border-color: rgba(59,130,246,0.3);
    background: rgba(255,255,255,0.05);
  }
  .settings-input::placeholder {
    color: #6a6a80;
  }
  .settings-select {
    width: 100%;
    padding: 10px 14px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    color: #e8e8f2;
    font-size: 13px;
    outline: none;
    cursor: pointer;
    transition: all 140ms;
  }
  .settings-select:focus {
    border-color: rgba(59,130,246,0.3);
    background: rgba(255,255,255,0.05);
  }
  .settings-save-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 140ms;
    margin-top: 16px;
  }
  .settings-save-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59,130,246,0.3);
  }
  .settings-save-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
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
  .success-message {
    padding: 12px 16px;
    background: rgba(34,197,94,0.15);
    border: 1px solid rgba(34,197,94,0.3);
    border-radius: 8px;
    color: #22c55e;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 16px;
  }
`;

const SettingsPage = () => {
  const [settings, setSettings] = useState<PlatformSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/platform/settings`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('platform_token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key: string, value: string) => {
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(`${API_BASE}/platform/settings/${key}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('platform_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value }),
      });
      const data = await response.json();
      if (data.success) {
        setSettings({ ...settings, [key]: value });
        setMessage('Paramètre sauvegardé avec succès');
        setTimeout(() => setMessage(''), 3000);
      } else {
        alert(data.message || 'Erreur');
      }
    } catch (error) {
      console.error('Failed to save setting:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading-spinner" />;
  }

  return (
    <div>
      <style>{styles}</style>

      <div className="settings-header">
        <h1 className="settings-title">Paramètres de la Plateforme</h1>
        <p className="settings-subtitle">Configuration globale d'Ekala</p>
      </div>

      {message && <div className="success-message">{message}</div>}

      <div className="settings-container">
        {/* General Settings */}
        <div className="settings-group">
          <div className="settings-group-title">Général</div>
          
          <div className="settings-field">
            <label className="settings-label">Nom de la plateforme</label>
            <input
              type="text"
              className="settings-input"
              value={settings.platform_name || ''}
              onChange={(e) => setSettings({ ...settings, platform_name: e.target.value })}
              onBlur={(e) => handleSave('platform_name', e.target.value)}
              placeholder="Ekala POS"
            />
          </div>

          <div className="settings-field">
            <label className="settings-label">Email de support</label>
            <input
              type="email"
              className="settings-input"
              value={settings.support_email || ''}
              onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
              onBlur={(e) => handleSave('support_email', e.target.value)}
              placeholder="support@ekala.com"
            />
          </div>
        </div>

        {/* Voucher Settings */}
        <div className="settings-group">
          <div className="settings-group-title">Vouchers</div>
          
          <div className="settings-field">
            <label className="settings-label">Heures pour valider un voucher</label>
            <input
              type="number"
              className="settings-input"
              value={settings.voucher_verification_hours || '24'}
              onChange={(e) => setSettings({ ...settings, voucher_verification_hours: e.target.value })}
              onBlur={(e) => handleSave('voucher_verification_hours', e.target.value)}
              min="1"
              max="168"
            />
          </div>

          <div className="settings-field">
            <label className="settings-label">Heures avant expiration voucher</label>
            <input
              type="number"
              className="settings-input"
              value={settings.voucher_expiration_hours || '48'}
              onChange={(e) => setSettings({ ...settings, voucher_expiration_hours: e.target.value })}
              onBlur={(e) => handleSave('voucher_expiration_hours', e.target.value)}
              min="1"
              max="720"
            />
          </div>
        </div>

        {/* Trial Settings */}
        <div className="settings-group">
          <div className="settings-group-title">Essais</div>
          
          <div className="settings-field">
            <label className="settings-label">Jours d'essai par défaut</label>
            <input
              type="number"
              className="settings-input"
              value={settings.default_trial_days || '7'}
              onChange={(e) => setSettings({ ...settings, default_trial_days: e.target.value })}
              onBlur={(e) => handleSave('default_trial_days', e.target.value)}
              min="1"
              max="30"
            />
          </div>
        </div>

        {/* System Settings */}
        <div className="settings-group">
          <div className="settings-group-title">Système</div>
          
          <div className="settings-field">
            <label className="settings-label">Nombre maximum de tenants</label>
            <input
              type="number"
              className="settings-input"
              value={settings.max_tenants || '10000'}
              onChange={(e) => setSettings({ ...settings, max_tenants: e.target.value })}
              onBlur={(e) => handleSave('max_tenants', e.target.value)}
              min="1"
            />
          </div>

          <div className="settings-field">
            <label className="settings-label">Mode maintenance</label>
            <select
              className="settings-select"
              value={settings.maintenance_mode || '0'}
              onChange={(e) => handleSave('maintenance_mode', e.target.value)}
            >
              <option value="0">Désactivé</option>
              <option value="1">Activé</option>
            </select>
          </div>
        </div>

        <button
          className="settings-save-btn"
          onClick={() => {
            // Save all modified settings
            Object.entries(settings).forEach(([key, value]) => {
              handleSave(key, value);
            });
          }}
          disabled={saving}
        >
          <Save size={16} />
          {saving ? 'Sauvegarde...' : 'Sauvegarder tout'}
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;