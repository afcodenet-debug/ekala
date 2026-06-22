import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, CreditCard, FileText, TrendingUp, TrendingDown,
  Activity, DollarSign, Calendar, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { api } from '../../lib/api-client';

const API_BASE = (window as any).VITE_API_BASE_URL || 'https://ekala-api.onrender.com/api';

interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  trialTenants: number;
  totalRevenue: number;
  mrr: number;
  arr: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  pendingVouchers: number;
  verifiedVouchers: number;
  rejectedVouchers: number;
  expiredVouchers: number;
}

const styles = `
  .dashboard-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
    margin-bottom: 32px;
  }
  .stat-card {
    background: #0f0f18;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 20px;
    transition: all 180ms;
  }
  .stat-card:hover {
    border-color: rgba(255,255,255,0.12);
    transform: translateY(-2px);
  }
  .stat-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  .stat-card-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .stat-card-icon.blue {
    background: rgba(59,130,246,0.15);
    color: #3b82f6;
  }
  .stat-card-icon.green {
    background: rgba(34,197,94,0.15);
    color: #22c55e;
  }
  .stat-card-icon.red {
    background: rgba(239,68,68,0.15);
    color: #ef4444;
  }
  .stat-card-icon.purple {
    background: rgba(139,92,246,0.15);
    color: #8b5cf6;
  }
  .stat-card-icon.amber {
    background: rgba(245,158,11,0.15);
    color: #f59e0b;
  }
  .stat-card-value {
    font-size: 28px;
    font-weight: 800;
    color: #e8e8f2;
    margin-bottom: 4px;
    letter-spacing: -0.02em;
  }
  .stat-card-label {
    font-size: 12px;
    color: #6a6a80;
    font-weight: 500;
  }
  .stat-card-trend {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    margin-top: 8px;
  }
  .stat-card-trend.up {
    color: #22c55e;
  }
  .stat-card-trend.down {
    color: #ef4444;
  }
  .dashboard-section {
    background: #0f0f18;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 24px;
  }
  .dashboard-section-title {
    font-size: 16px;
    font-weight: 700;
    color: #e8e8f2;
    margin-bottom: 16px;
  }
  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 24px;
  }
  .revenue-card {
    background: linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.1));
    border: 1px solid rgba(59,130,246,0.2);
    border-radius: 12px;
    padding: 24px;
  }
  .revenue-label {
    font-size: 12px;
    color: #6a6a80;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
    margin-bottom: 8px;
  }
  .revenue-value {
    font-size: 36px;
    font-weight: 800;
    color: #e8e8f2;
    margin-bottom: 4px;
  }
  .revenue-currency {
    font-size: 18px;
    color: #6a6a80;
    font-weight: 600;
  }
  .revenue-sub {
    font-size: 12px;
    color: #6a6a80;
    margin-top: 8px;
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

const PlatformDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/platform/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('platform_token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return `${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 } as any)} ZMW`;
  };

  if (loading) {
    return <div className="loading-spinner" />;
  }

  if (!stats) {
    return (
      <div className="empty-state">
        <Activity size={48} style={{ opacity: 0.5, marginBottom: 16 }} />
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#e8e8f2', marginBottom: 8 }}>
          Impossible de charger les statistiques
        </h3>
        <p style={{ fontSize: 14 }}>Vérifiez votre connexion au serveur</p>
      </div>
    );
  }

  return (
    <div>
      <style>{styles}</style>

      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#e8e8f2', marginBottom: 8 }}>
        Dashboard Plateforme
      </h1>
      <p style={{ fontSize: 14, color: '#6a6a80', marginBottom: 32 }}>
        Vue d'ensemble de la plateforme Ekala
      </p>

      {/* Stats Grid */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">
              <Users size={20} />
            </div>
          </div>
          <div className="stat-card-value">{stats.totalTenants}</div>
          <div className="stat-card-label">Total Tenants</div>
          <div className="stat-card-trend up">
            <ArrowUpRight size={14} />
            {stats.activeTenants} actifs
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">
              <Activity size={20} />
            </div>
          </div>
          <div className="stat-card-value">{stats.activeSubscriptions}</div>
          <div className="stat-card-label">Abonnements Actifs</div>
          <div className="stat-card-trend up">
            <ArrowUpRight size={14} />
            {stats.trialTenants} en essai
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon red">
              <CreditCard size={20} />
            </div>
          </div>
          <div className="stat-card-value">{stats.pendingVouchers}</div>
          <div className="stat-card-label">Vouchers en Attente</div>
          <div className="stat-card-trend down">
            <ArrowDownRight size={14} />
            {stats.rejectedVouchers} rejetés
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon purple">
              <DollarSign size={20} />
            </div>
          </div>
          <div className="stat-card-value">{formatCurrency(stats.mrr)}</div>
          <div className="stat-card-label">MRR (Mensuel)</div>
          <div className="stat-card-trend up">
            <ArrowUpRight size={14} />
            ARR: {formatCurrency(stats.arr)}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon amber">
              <FileText size={20} />
            </div>
          </div>
          <div className="stat-card-value">{stats.verifiedVouchers}</div>
          <div className="stat-card-label">Vouchers Vérifiés</div>
          <div className="stat-card-trend up">
            <ArrowUpRight size={14} />
            {((stats.verifiedVouchers / (stats.verifiedVouchers + stats.rejectedVouchers || 1)) * 100).toFixed(1)}% taux
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon red">
              <TrendingDown size={20} />
            </div>
          </div>
          <div className="stat-card-value">{stats.suspendedTenants}</div>
          <div className="stat-card-label">Tenants Suspendus</div>
          <div className="stat-card-trend down">
            <ArrowDownRight size={14} />
            {stats.expiredSubscriptions} abonnements expirés
          </div>
        </div>
      </div>

      {/* Revenue Section */}
      <div className="dashboard-section">
        <h2 className="dashboard-section-title">Revenus</h2>
        <div className="dashboard-grid">
          <div className="revenue-card">
            <div className="revenue-label">Monthly Recurring Revenue</div>
            <div className="revenue-value">
              <span className="revenue-currency">ZMW </span>
              {(stats.mrr / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 } as any)}
            </div>
            <div className="revenue-sub">
              Basé sur {stats.activeSubscriptions} abonnements actifs
            </div>
          </div>

          <div className="revenue-card">
            <div className="revenue-label">Annual Recurring Revenue</div>
            <div className="revenue-value">
              <span className="revenue-currency">ZMW </span>
              {(stats.arr / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 } as any)}
            </div>
            <div className="revenue-sub">
              Projection annuelle
            </div>
          </div>

          <div className="revenue-card">
            <div className="revenue-label">Revenu par Tenant</div>
            <div className="revenue-value">
              <span className="revenue-currency">ZMW </span>
              {stats.activeTenants > 0 ? (stats.mrr / stats.activeTenants / 100).toFixed(2) : '0.00'}
            </div>
            <div className="revenue-sub">
              Moyenne mensuelle
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="dashboard-section">
        <h2 className="dashboard-section-title">Actions Rapides</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/platform/tenants')}
            style={{
              padding: '10px 16px',
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: 8,
              color: '#3b82f6',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Users size={16} />
            Gérer les Tenants
          </button>

          <button
            onClick={() => navigate('/platform/vouchers')}
            style={{
              padding: '10px 16px',
              background: 'rgba(34,197,94,0.15)',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 8,
              color: '#22c55e',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CreditCard size={16} />
            Valider les Vouchers
          </button>

          <button
            onClick={() => navigate('/platform/audit-logs')}
            style={{
              padding: '10px 16px',
              background: 'rgba(139,92,246,0.15)',
              border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: 8,
              color: '#8b5cf6',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <FileText size={16} />
            Voir les Logs
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlatformDashboard;