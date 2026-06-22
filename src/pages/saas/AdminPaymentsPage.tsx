// =============================================================================
// AdminPaymentsPage — Backoffice paiements abonnements (Phase 6)
// =============================================================================
// Liste filtrée des demandes de paiement par voucher pour les administrateurs.
// =============================================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, Search, Filter, AlertTriangle, Clock, CheckCircle2,
  XCircle, RefreshCw, Copy, ArrowLeft,
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useI18n } from '../../lib/i18n';

const API_BASE = (window as any).VITE_API_BASE_URL || 'https://ekala-api.onrender.com/api';

const T = {
  bg: '#09090f',
  surface1: '#0f0f16',
  surface2: '#14141e',
  border: 'rgba(255,255,255,0.06)',
  borderEm: 'rgba(255,255,255,0.11)',
  text1: '#f0f0f8',
  text2: '#9898b0',
  text3: '#5a5a72',
  gold: '#c9a84c',
  red: '#e05c5c',
  redSoft: 'rgba(224,92,92,0.08)',
  redBorder: 'rgba(224,92,92,0.22)',
  green: '#2ec4a3',
  greenSoft: 'rgba(46,196,163,0.09)',
  greenBorder: 'rgba(46,196,163,0.22)',
  amber: '#e8a83a',
  amberSoft: 'rgba(232,168,58,0.09)',
  amberBorder: 'rgba(232,168,58,0.22)',
} as const;

type Row = {
  id: number;
  voucher_code: string;
  tenant_id: number;
  tenant?: { name?: string };
  plan_id: number;
  plan?: { name?: string };
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  verification_deadline: string;
  verified_at?: string;
  rejection_reason?: string;
};

type Filter = 'all' | 'pending' | 'payment_sent' | 'verified' | 'rejected' | 'expired';

const AdminPaymentsPage = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('pending');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);
      const url = `${API_BASE}/admin/subscriptions/pending${params.toString() ? '?' + params.toString() : ''}`;
      const resp = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('ekala-auth') ? JSON.parse(localStorage.getItem('ekala-auth')!).state.token : ''}`,
          ...(user?.role ? { 'X-User-Role': user.role } : {}),
        },
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error || 'Erreur serveur');
      }
      const data = await resp.json();
      setRows(data.requests || []);
    } catch (e: any) {
      setError(e.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const filtered = rows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.voucher_code.toLowerCase().includes(q) ||
      r.tenant?.name?.toLowerCase().includes(q) ||
      r.plan?.name?.toLowerCase().includes(q)
    );
  });

  const statusIcon = (s: string) => {
    switch (s) {
      case 'pending': return <Clock size={14} style={{ color: T.amber }} />;
      case 'payment_sent': return <AlertTriangle size={14} style={{ color: T.amber }} />;
      case 'verified': return <CheckCircle2 size={14} style={{ color: T.green }} />;
      case 'rejected': return <XCircle size={14} style={{ color: T.red }} />;
      case 'expired': return <XCircle size={14} style={{ color: T.text3 }} />;
      default: return <Clock size={14} style={{ color: T.text3 }} />;
    }
  };

  const copyCode = (code: string) => {
    void navigator.clipboard.writeText(code);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg,
      color: T.text1,
      fontFamily: 'Inter, -apple-system, sans-serif',
      padding: '32px 24px',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header style={{ marginBottom: 28 }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'transparent',
              border: 'none',
              color: T.text2,
              cursor: 'pointer',
              fontSize: 14,
              padding: 0,
              marginBottom: 16,
            }}
          >
            <ArrowLeft size={16} />
            {t('common.back')}
          </button>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4, letterSpacing: '-0.02em' }}>
            Paiements abonnements
          </h1>
          <p style={{ color: T.text3, fontSize: 13, margin: 0 }}>
            Gestion des demandes de paiement par voucher.
          </p>
        </header>

        <div style={{
          background: T.surface2,
          border: `0.5px solid ${T.borderEm}`,
          borderRadius: 16,
          padding: 18,
          marginBottom: 18,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(255,255,255,0.04)',
            border: `0.5px solid ${T.border}`,
            borderRadius: 12,
            padding: '8px 14px',
            flex: 1,
            minWidth: 200,
          }}>
            <Search size={14} style={{ color: T.text3 }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un code, tenant ou plan..."
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: T.text1,
                fontSize: 13,
                width: '100%',
              }}
            />
          </div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(255,255,255,0.04)',
            border: `0.5px solid ${T.border}`,
            borderRadius: 12,
            padding: '8px 14px',
          }}>
            <Filter size={14} style={{ color: T.text3 }} />
            <select
              value={filter}
              onChange={e => setFilter(e.target.value as Filter)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: T.text1,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <option value="pending">En attente</option>
              <option value="payment_sent">Paiement reçu</option>
              <option value="verified">Vérifié</option>
              <option value="rejected">Rejeté</option>
              <option value="expired">Expiré</option>
              <option value="all">Tous</option>
            </select>
          </div>
          <button
            onClick={load}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255,255,255,0.06)',
              border: `0.5px solid ${T.borderEm}`,
              color: T.text1,
              padding: '8px 14px',
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <RefreshCw size={13} />
            Actualiser
          </button>
        </div>

        {error && (
          <div style={{
            background: T.redSoft,
            border: `1px solid ${T.redBorder}`,
            borderRadius: 12,
            padding: 14,
            marginBottom: 18,
            color: '#fca5a5',
            fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <Loader2 size={22} className="animate-spin" style={{ color: T.gold }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 16px',
            background: T.surface2,
            border: `0.5px solid ${T.border}`,
            borderRadius: 14,
            color: T.text3,
          }}>
            Aucune demande trouvée.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(r => (
              <div key={r.id} style={{
                background: T.surface2,
                border: `0.5px solid ${T.border}`,
                borderRadius: 14,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                justifyContent: 'space-between',
                flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: '1 1 auto', minWidth: 220 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: 'rgba(255,255,255,0.04)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `0.5px solid ${T.border}`,
                  }}>
                    {statusIcon(r.status)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: T.text1 }}>
                      {r.voucher_code}
                    </div>
                    <div style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>
                      {r.tenant?.name || `Tenant #${r.tenant_id}`} · {r.plan?.name || `Plan #${r.plan_id}`}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right', marginRight: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: T.text1 }}>
                    {r.currency} {(r.amount_cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>
                    {new Date(r.created_at).toLocaleString('fr-FR')}
                  </div>
                </div>

                <div style={{
                  padding: '4px 12px',
                  borderRadius: 100,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'capitalize',
                  background: r.status === 'verified' ? T.greenSoft : r.status === 'rejected' ? T.redSoft : r.status === 'payment_sent' ? T.amberSoft : 'rgba(255,255,255,0.04)',
                  color: r.status === 'verified' ? T.green : r.status === 'rejected' ? T.red : r.status === 'payment_sent' ? T.amber : T.text2,
                  border: `0.5px solid ${r.status === 'verified' ? T.greenBorder : r.status === 'rejected' ? T.redBorder : r.status === 'payment_sent' ? T.amberBorder : T.border}`,
                }}>
                  {r.status}
                </div>

                <button
                  onClick={() => copyCode(r.voucher_code)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: T.text3,
                    cursor: 'pointer',
                    padding: 6,
                  }}
                  title="Copier le code"
                >
                  <Copy size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPaymentsPage;
