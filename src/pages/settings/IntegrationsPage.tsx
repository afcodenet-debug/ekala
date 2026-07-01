import React from 'react';
import { Puzzle, ExternalLink, CheckCircle2, ChevronRight, Globe, MessageSquare, Printer, Smartphone } from 'lucide-react';

const INTEGRATIONS = [
  {
    name: 'PrintNode',
    description: 'Imprimantes réseau connectées',
    icon: Printer,
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.1)',
    status: 'connected',
    statusLabel: 'Connecté',
  },
  {
    name: 'WhatsApp Business',
    description: 'Notifications et communication client',
    icon: MessageSquare,
    color: '#25D366',
    bg: 'rgba(37,211,102,0.1)',
    status: 'available',
    statusLabel: 'Disponible',
  },
  {
    name: 'API Publique',
    description: 'Intégration tierce via API REST',
    icon: Globe,
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.1)',
    status: 'available',
    statusLabel: 'Disponible',
  },
  {
    name: 'Application Mobile',
    description: 'Application iOS et Android',
    icon: Smartphone,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.1)',
    status: 'coming_soon',
    statusLabel: 'Bientôt',
  },
];

const IntegrationsPage: React.FC = () => {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "DM Sans", sans-serif', color: '#eeeef5' }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 18,
        overflow: 'hidden',
      }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, rgba(167,139,250,0.4), rgba(167,139,250,0.05))' }} />
        <div style={{ padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Puzzle size={18} color="#a78bfa" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#eeeef5' }}>
                Intégrations
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                Connectez vos outils et services
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {INTEGRATIONS.map((integration, i) => {
              const Icon = integration.icon;
              const isConnected = integration.status === 'connected';
              const isComingSoon = integration.status === 'coming_soon';

              return (
                <div
                  key={integration.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 16px',
                    background: isConnected ? 'rgba(255,255,255,0.02)' : 'transparent',
                    border: isConnected ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
                    borderRadius: 12,
                    cursor: isComingSoon ? 'default' : 'pointer',
                    opacity: isComingSoon ? 0.6 : 1,
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={e => {
                    if (!isComingSoon) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    }
                  }}
                  onMouseOut={e => {
                    if (!isComingSoon) {
                      e.currentTarget.style.background = isConnected ? 'rgba(255,255,255,0.02)' : 'transparent';
                    }
                  }}
                >
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: integration.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={20} color={integration.color} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isComingSoon ? 'rgba(255,255,255,0.5)' : '#eeeef5', marginBottom: 2 }}>
                      {integration.name}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {integration.description}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      background: isConnected 
                        ? 'rgba(16,185,129,0.1)' 
                        : isComingSoon 
                          ? 'rgba(245,158,11,0.1)' 
                          : 'rgba(255,255,255,0.04)',
                      border: isConnected 
                        ? '1px solid rgba(16,185,129,0.2)' 
                        : isComingSoon 
                          ? '1px solid rgba(245,158,11,0.2)' 
                          : '1px solid rgba(255,255,255,0.06)',
                      color: isConnected 
                        ? '#10b981' 
                        : isComingSoon 
                          ? '#f59e0b' 
                          : 'rgba(255,255,255,0.4)',
                    }}>
                      {isConnected && <CheckCircle2 size={10} />}
                      {integration.statusLabel}
                    </span>
                    {!isComingSoon && <ChevronRight size={14} color="rgba(255,255,255,0.2)" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsPage;
