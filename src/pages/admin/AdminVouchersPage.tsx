import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, Search,
  Filter, RefreshCw, Eye, ChevronDown, User, Mail,
  CreditCard, Calendar, Hash, DollarSign, ArrowLeft,
  Loader2, X,
} from 'lucide-react';
import { api } from '../../lib/api-client';

const API_BASE = (window as any).VITE_API_BASE_URL || 'https://ekala-api.onrender.com/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterStatus = 'pending' | 'payment_sent' | 'verified' | 'expired' | 'rejected' | 'all';

interface VoucherRequest {
  id: number;
  tenant_id: number;
  plan_id: number;
  voucher_code: string;
  customer_email: string;
  status: 'pending' | 'payment_sent' | 'verified' | 'expired' | 'rejected';
  requested_at: string;
  verification_deadline: string;
  expires_at: string;
  verified_by?: number;
  verified_at?: string;
  rejection_reason?: string;
  amount_cents?: number;
  currency?: string;
  tenant_name?: string;
  plan_name?: string;
  plan_code?: string;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = `
  @keyframes admin-fade-up {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes admin-spin {
    to { transform: rotate(360deg); }
  }

  .admin-shell {
    min-height: 100vh;
    background: #0a0a10;
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
    color: #e8e8f2;
  }
  .admin-page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 48px 24px 100px;
    animation: admin-fade-up 400ms cubic-bezier(0.16,1,0.3,1) both;
  }

  /* Header */
  .admin-header { margin-bottom: 40px; }
  .admin-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px 5px 10px;
    border-radius: 999px;
    background: rgba(59,130,246,0.1);
    border: 1px solid rgba(59,130,246,0.25);
    font-size: 10.5px;
    font-weight: 700;
    color: #3b82f6;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 16px;
  }
  .admin-title {
    margin: 0 0 8px;
    font-size: 32px;
    font-weight: 800;
    color: #e8e8f2;
    letter-spacing: -0.03em;
    line-height: 1.1;
  }
  .admin-subtitle {
    margin: 0;
    font-size: 14px;
    color: #6a6a80;
    font-weight: 400;
    line-height: 1.6;
  }

  /* Back button */
  .admin-back {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border: none;
    color: #6a6a80;
    cursor: pointer;
    font-size: 13.5px;
    font-weight: 600;
    padding: 6px 8px;
    margin: -6px 0 24px -8px;
    border-radius: 7px;
    transition: background 140ms, color 140ms;
  }
  .admin-back:hover { background: rgba(255,255,255,0.05); color: #a0a0b8; }

  /* Filters */
  .admin-filters {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }
  .admin-filter-btn {
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.03);
    color: #a0a0b8;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 140ms;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .admin-filter-btn:hover {
    background: rgba(255,255,255,0.06);
    border-color: rgba(255,255,255,0.2);
  }
  .admin-filter-btn-active {
    background: rgba(59,130,246,0.15);
    border-color: rgba(59,130,246,0.4);
    color: #3b82f6;
  }
  .admin-filter-count {
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(255,255,255,0.1);
    font-size: 11px;
    font-weight: 700;
  }
  .admin-filter-btn-active .admin-filter-count {
    background: rgba(59,130,246,0.3);
  }

  /* Card */
  .admin-card {
    background: #0f0f18;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px;
    margin-bottom: 16px;
    overflow: hidden;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.5), 0 12px 32px rgba(0,0,0,0.3);
    animation: admin-fade-up 350ms cubic-bezier(0.16,1,0.3,1) both;
    transition: all 180ms;
  }
  .admin-card:hover {
    border-color: rgba(255,255,255,0.12);
    box-shadow: 0 0 0 1px rgba(0,0,0,0.5), 0 16px 40px rgba(0,0,0,0.4);
  }
  .admin-card-inner {
    padding: 20px 24px;
  }
  .admin-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }
  .admin-card-title {
    font-size: 16px;
    font-weight: 700;
    color: #e8e8f2;
    margin-bottom: 4px;
  }
  .admin-card-subtitle {
    font-size: 12px;
    color: #6a6a80;
  }

  /* Status badge */
  .admin-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .admin-status-pending {
    background: rgba(245,158,11,0.15);
    color: #f59e0b;
    border: 1px solid rgba(245,158,11,0.3);
  }
  .admin-status-verified {
    background: rgba(34,197,94,0.15);
    color: #22c55e;
    border: 1px solid rgba(34,197,94,0.3);
  }
  .admin-status-expired {
    background: rgba(239,68,68,0.15);
    color: #ef4444;
    border: 1px solid rgba(239,68,68,0.3);
  }
  .admin-status-rejected {
    background: rgba(239,68,68,0.15);
    color: #ef4444;
    border: 1px solid rgba(239,68,68,0.3);
  }

  /* Info grid */
  .admin-info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }
  .admin-info-item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    color: #a0a0b8;
  }
  .admin-info-icon {
    color: #6a6a80;
    flex-shrink: 0;
  }
  .admin-info-label {
    font-size: 11px;
    color: #6a6a80;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .admin-info-value {
    font-size: 13px;
    color: #e8e8f2;
    font-weight: 600;
  }

  /* Actions */
  .admin-actions {
    display: flex;
    gap: 8px;
    padding-top: 16px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }
  .admin-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all 140ms;
  }
  .admin-btn-verify {
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    color: #fff;
    box-shadow: 0 4px 12px rgba(34,197,94,0.3);
  }
  .admin-btn-verify:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }
  .admin-btn-reject {
    background: rgba(239,68,68,0.15);
    border: 1px solid rgba(239,68,68,0.3);
    color: #ef4444;
  }
  .admin-btn-reject:hover {
    background: rgba(239,68,68,0.25);
  }
  .admin-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
  }

  /* Modal */
  .admin-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 24px;
    animation: admin-fade-up 200ms ease both;
  }
  .admin-modal {
    background: #0f0f18;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 18px;
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 24px 64px rgba(0,0,0,0.5);
  }
  .admin-modal-header {
    padding: 24px 24px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .admin-modal-title {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: #e8e8f2;
  }
  .admin-modal-body {
    padding: 24px;
  }
  .admin-modal-footer {
    padding: 16px 24px 24px;
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  /* Spinner */
  .admin-spinner {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2.5px solid rgba(255,255,255,0.1);
    border-top-color: #f59e0b;
    animation: admin-spin 0.8s linear infinite;
  }

  /* Empty state */
  .admin-empty {
    text-align: center;
    padding: 60px 24px;
    color: #6a6a80;
  }
  .admin-empty-icon {
    margin-bottom: 16px;
    opacity: 0.5;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .admin-page { padding: 32px 16px 80px; }
    .admin-title { font-size: 26px; }
    .admin-info-grid { grid-template-columns: 1fr; }
    .admin-actions { flex-direction: column; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

// ─── Helper: Inject styles ─────────────────────────────────────────────────────

if (typeof document !== 'undefined' && !document.getElementById('admin-voucher-styles')) {
  const style = document.createElement('style');
  style.id = 'admin-voucher-styles';
  style.textContent = styles;
  document.head.appendChild(style);
}

// ─── Main Component ───────────────────────────────────────────────────────────

const AdminVouchersPage = () => {
  const navigate = useNavigate();
  const { t } = useI18n();

  const [vouchers, setVouchers] = useState<VoucherRequest[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherRequest | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [counts, setCounts] = useState<Record<FilterStatus, number>>({
    pending: 0,
    payment_sent: 0,
    verified: 0,
    expired: 0,
    rejected: 0,
    all: 0,
  });

  // ─── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    loadVouchers();
  }, [filter]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const loadVouchers = async () => {
    setLoading(true);
    try {
      const endpoint = filter === 'all' ? '/admin/vouchers' : `/admin/vouchers/${filter}`;
      const data = await api.get<any>(endpoint);
      const voucherList = data.vouchers || data || [];
      setVouchers(Array.isArray(voucherList) ? voucherList : []);
      
      // Update counts
      const allData = await api.get<any>('/admin/vouchers');
      const allVouchers = allData.vouchers || allData || [];
      const countsMap = {
        pending: 0,
        payment_sent: 0,
        verified: 0,
        expired: 0,
        rejected: 0,
        all: 0,
      };
      (Array.isArray(allVouchers) ? allVouchers : []).forEach((v: VoucherRequest) => {
        if (countsMap[v.status] !== undefined) {
          countsMap[v.status]++;
        }
        countsMap.all++;
      });
      setCounts(countsMap);
    } catch (e: any) {
      console.error('Failed to load vouchers:', e);
      setVouchers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!selectedVoucher) return;
    setActionLoading(true);
    try {
      await api.post('/admin/subscriptions/verify', { requestId: selectedVoucher.id });
      await loadVouchers();
      setShowVerifyModal(false);
      setSelectedVoucher(null);
    } catch (e: any) {
      alert(e.message || 'Erreur lors de la validation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedVoucher || !rejectionReason.trim()) return;
    setActionLoading(true);
    try {
      await api.post('/admin/subscriptions/reject', {
        requestId: selectedVoucher.id,
        reason: rejectionReason,
      });
      await loadVouchers();
      setShowRejectModal(false);
      setSelectedVoucher(null);
      setRejectionReason('');
    } catch (e: any) {
      alert(e.message || 'Erreur lors du rejet');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatAmount = (cents?: number, currency?: string) => {
    if (!cents) return 'N/A';
    return `${currency || 'ZMW'} ${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={14} />;
      case 'payment_sent': return <CreditCard size={14} />;
      case 'verified': return <CheckCircle2 size={14} />;
      case 'expired': return <AlertTriangle size={14} />;
      case 'rejected': return <XCircle size={14} />;
      default: return <Clock size={14} />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'En attente';
      case 'payment_sent': return 'Paiement envoyé';
      case 'verified': return 'Vérifié';
      case 'expired': return 'Expiré';
      case 'rejected': return 'Rejeté';
      default: return status;
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="admin-shell">
      <div className="admin-page">
        <button onClick={() => navigate('/dashboard')} className="admin-back">
          <ArrowLeft size={16} />
          Retour
        </button>

        <div className="admin-header">
          <div className="admin-eyebrow">
            <CreditCard size={12} />
            Administration
          </div>
          <h1 className="admin-title">Validation des paiements</h1>
          <p className="admin-subtitle">
            Gérez les demandes de paiement par voucher
          </p>
        </div>

        {/* Filters */}
        <div className="admin-filters">
          {(['pending', 'payment_sent', 'verified', 'expired', 'rejected', 'all'] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`admin-filter-btn ${filter === f ? 'admin-filter-btn-active' : ''}`}
            >
              {f === 'pending' && <Clock size={14} />}
              {f === 'payment_sent' && <CreditCard size={14} />}
              {f === 'verified' && <CheckCircle2 size={14} />}
              {f === 'expired' && <AlertTriangle size={14} />}
              {f === 'rejected' && <XCircle size={14} />}
              {f === 'all' && <Filter size={14} />}
              {f === 'all' ? 'Tous' : getStatusLabel(f)}
              <span className="admin-filter-count">{counts[f] || 0}</span>
            </button>
          ))}
          <button onClick={loadVouchers} className="admin-filter-btn" style={{ marginLeft: 'auto' }}>
            <RefreshCw size={14} />
            Actualiser
          </button>
        </div>

        {/* Vouchers list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div className="admin-spinner" style={{ width: 40, height: 40, margin: '0 auto 16px' }} />
            <p style={{ color: '#6a6a80' }}>Chargement des demandes...</p>
          </div>
        ) : vouchers.length === 0 ? (
          <div className="admin-empty">
            <div className="admin-empty-icon">
              <Search size={48} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#e8e8f2', marginBottom: 8 }}>
              Aucune demande trouvée
            </h3>
            <p style={{ fontSize: 14, color: '#6a6a80' }}>
              {filter === 'all' ? 'Aucune demande de paiement pour le moment.' : `Aucune demande avec le statut "${getStatusLabel(filter)}".`}
            </p>
          </div>
        ) : (
          <div>
            {vouchers.map((voucher, i) => (
              <div
                key={voucher.id}
                className="admin-card"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="admin-card-inner">
                  <div className="admin-card-header">
                    <div>
                      <div className="admin-card-title">
                        {voucher.tenant_name || `Tenant #${voucher.tenant_id}`}
                      </div>
                      <div className="admin-card-subtitle">
                        {voucher.plan_name || `Plan #${voucher.plan_id}`}
                      </div>
                    </div>
                    <span className={`admin-status admin-status-${voucher.status}`}>
                      {getStatusIcon(voucher.status)}
                      {getStatusLabel(voucher.status)}
                    </span>
                  </div>

                  <div className="admin-info-grid">
                    <div className="admin-info-item">
                      <Mail size={14} className="admin-info-icon" />
                      <div>
                        <div className="admin-info-label">Email</div>
                        <div className="admin-info-value">{voucher.customer_email}</div>
                      </div>
                    </div>
                    <div className="admin-info-item">
                      <Hash size={14} className="admin-info-icon" />
                      <div>
                        <div className="admin-info-label">Voucher</div>
                        <div className="admin-info-value" style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                          {voucher.voucher_code}
                        </div>
                      </div>
                    </div>
                    <div className="admin-info-item">
                      <DollarSign size={14} className="admin-info-icon" />
                      <div>
                        <div className="admin-info-label">Montant</div>
                        <div className="admin-info-value">
                          {formatAmount(voucher.amount_cents, voucher.currency)}
                        </div>
                      </div>
                    </div>
                    <div className="admin-info-item">
                      <Calendar size={14} className="admin-info-icon" />
                      <div>
                        <div className="admin-info-label">Créé le</div>
                        <div className="admin-info-value">{formatDate(voucher.requested_at)}</div>
                      </div>
                    </div>
                  </div>

                  {(voucher.status === 'pending' || voucher.status === 'payment_sent') && (
                    <div className="admin-actions">
                      <button
                        onClick={() => {
                          setSelectedVoucher(voucher);
                          setShowVerifyModal(true);
                        }}
                        className="admin-btn admin-btn-verify"
                      >
                        <CheckCircle2 size={16} />
                        Valider
                      </button>
                      <button
                        onClick={() => {
                          setSelectedVoucher(voucher);
                          setShowRejectModal(true);
                        }}
                        className="admin-btn admin-btn-reject"
                      >
                        <XCircle size={16} />
                        Rejeter
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Verify Modal */}
        {showVerifyModal && selectedVoucher && (
          <div className="admin-modal-overlay" onClick={() => setShowVerifyModal(false)}>
            <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h2 className="admin-modal-title">Confirmer la validation</h2>
              </div>
              <div className="admin-modal-body">
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, color: '#6a6a80', marginBottom: 4 }}>Tenant</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#e8e8f2' }}>
                    {selectedVoucher.tenant_name || `Tenant #${selectedVoucher.tenant_id}`}
                  </div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, color: '#6a6a80', marginBottom: 4 }}>Plan</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#e8e8f2' }}>
                    {selectedVoucher.plan_name || `Plan #${selectedVoucher.plan_id}`}
                  </div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, color: '#6a6a80', marginBottom: 4 }}>Voucher</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#f59e0b', fontFamily: 'monospace' }}>
                    {selectedVoucher.voucher_code}
                  </div>
                </div>
                <div style={{ padding: '14px 16px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12 }}>
                  <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Cette action va:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#a0a0b8', lineHeight: 1.8 }}>
                    <li>Créer l'abonnement</li>
                    <li>Activer le tenant</li>
                    <li>Envoyer un email de confirmation</li>
                    <li>Synchroniser SQLite ↔ Supabase</li>
                  </ul>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button
                  onClick={() => setShowVerifyModal(false)}
                  className="admin-btn"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e8e8f2' }}
                  disabled={actionLoading}
                >
                  Annuler
                </button>
                <button
                  onClick={handleVerify}
                  className="admin-btn admin-btn-verify"
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <>
                      <div className="admin-spinner" />
                      Validation...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      Confirmer la validation
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {showRejectModal && selectedVoucher && (
          <div className="admin-modal-overlay" onClick={() => setShowRejectModal(false)}>
            <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h2 className="admin-modal-title">Rejeter la demande</h2>
              </div>
              <div className="admin-modal-body">
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, color: '#6a6a80', marginBottom: 4 }}>Tenant</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#e8e8f2' }}>
                    {selectedVoucher.tenant_name || `Tenant #${selectedVoucher.tenant_id}`}
                  </div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, color: '#6a6a80', marginBottom: 4 }}>Voucher</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#f59e0b', fontFamily: 'monospace' }}>
                    {selectedVoucher.voucher_code}
                  </div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, color: '#6a6a80', marginBottom: 8 }}>Raison du rejet</div>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Expliquez la raison du rejet..."
                    style={{
                      width: '100%',
                      minHeight: 100,
                      padding: '12px 14px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10,
                      color: '#e8e8f2',
                      fontSize: 14,
                      fontFamily: 'inherit',
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>
              <div className="admin-modal-footer">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectionReason('');
                  }}
                  className="admin-btn"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e8e8f2' }}
                  disabled={actionLoading}
                >
                  Annuler
                </button>
                <button
                  onClick={handleReject}
                  className="admin-btn admin-btn-reject"
                  disabled={actionLoading || !rejectionReason.trim()}
                >
                  {actionLoading ? (
                    <>
                      <div className="admin-spinner" />
                      Rejet...
                    </>
                  ) : (
                    <>
                      <XCircle size={16} />
                      Confirmer le rejet
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminVouchersPage;