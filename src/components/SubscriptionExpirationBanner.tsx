import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';

const API_BASE = (window as any).VITE_API_BASE_URL || 'https://ekala-api.onrender.com/api';

interface SubInfo {
  status: string;
  endDate: string;
  daysLeft: number;
  planName: string;
  isTrial: boolean;
}

const SubscriptionExpirationBanner = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const tenantId = (user as any)?.tenant_id;
  const [info, setInfo] = useState<SubInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    fetch(API_BASE + '/tenants/' + tenantId)
      .then(r => r.json())
      .then((data: any) => {
        const t = data?.tenant ?? data;
        const sub = t?.subscriptions?.[0];
        if (!sub) return;
        const end = sub.trial_ends_at || sub.current_period_end;
        if (!end) return;
        const diff = new Date(end).getTime() - Date.now();
        const days = Math.max(0, Math.ceil(diff / 86_400_000));
        if (days <= 7) {
          setInfo({
            status: sub.status,
            endDate: end,
            daysLeft: days,
            planName: sub.plan?.name || '',
            isTrial: !!sub.trial_ends_at,
          });
        }
      })
      .catch(() => {});
  }, [tenantId]);

  if (!info || dismissed) return null;

  const isExpired = info.daysLeft === 0;

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      maxWidth: 600,
      width: 'calc(100% - 40px)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 18px',
        borderRadius: 14,
        background: isExpired ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
        border: isExpired ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(245,158,11,0.3)',
        backdropFilter: 'blur(12px)',
        color: '#eeeef5',
        fontSize: 14,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      }}>
        <AlertTriangle size={20} color={isExpired ? '#ef4444' : '#f59e0b'} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          {isExpired ? (
            <>
              <strong style={{ color: '#ef4444', fontSize: 15 }}>Abonnement expire</strong>
              <div style={{ color: '#fca5a5', fontSize: 13, marginTop: 2 }}>
                Votre abonnement "{info.planName}" est arrive a expiration. Renouvelez-le pour continuer a utiliser EKALA.
              </div>
            </>
          ) : (
            <>
              <strong style={{ color: '#f59e0b', fontSize: 15 }}>
                {info.isTrial ? 'Essai gratuit' : 'Abonnement'} se termine dans {info.daysLeft} jour{info.daysLeft > 1 ? 's' : ''}
              </strong>
              <div style={{ color: '#d4d4d4', fontSize: 13, marginTop: 2 }}>
                Votre {info.isTrial ? "periode d'essai" : 'abonnement'} "{info.planName}" expire le {new Date(info.endDate).toLocaleDateString('fr-FR')}.
              </div>
            </>
          )}
          <button
            onClick={() => navigate('/billing')}
            style={{
              marginTop: 8,
              background: isExpired ? '#ef4444' : '#f59e0b',
              border: 'none', color: '#fff', padding: '6px 14px', borderRadius: 8,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {isExpired ? 'Renouveler' : 'Gerer mon abonnement'}
          </button>
        </div>
        <button
          onClick={() => setDismissed(true)}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', flexShrink: 0, padding: 4 }}
          aria-label="Fermer"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default SubscriptionExpirationBanner;