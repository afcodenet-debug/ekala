import { useEffect, useState } from 'react';

interface SessionExpiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SessionExpiredModal = ({ isOpen, onClose }: SessionExpiredModalProps) => {
  const [countdown, setCountdown] = useState(30);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setCountdown(30);
    setIsRedirecting(false);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleRedirect();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  const handleRedirect = () => {
    setIsRedirecting(true);
    // Clear all auth data
    try {
      localStorage.removeItem('ekala-auth');
      localStorage.removeItem('platform_token');
      localStorage.removeItem('qr_pending_order_*');
      localStorage.removeItem('qr_local_order_*');
      localStorage.removeItem('qr_customer_*');
    } catch {}
    
    // Redirect to login
    setTimeout(() => {
      window.location.href = '/login';
    }, 500);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      animation: 'fadeIn 0.3s ease-out',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        border: '1px solid rgba(200, 168, 75, 0.3)',
        borderRadius: 20,
        padding: '40px 32px',
        maxWidth: 420,
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(200, 168, 75, 0.1)',
        animation: 'slideUp 0.4s ease-out',
      }}>
        {/* Icon */}
        <div style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #c8a84b 0%, #e4c66a 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          boxShadow: '0 8px 24px rgba(200, 168, 75, 0.3)',
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        {/* Title */}
        <h2 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 32,
          fontWeight: 700,
          color: '#ece5d5',
          marginBottom: 12,
          letterSpacing: '0.02em',
        }}>
          Session expirée
        </h2>

        {/* Message */}
        <p style={{
          fontSize: 15,
          color: '#a8997e',
          lineHeight: 1.6,
          marginBottom: 24,
        }}>
          Votre session a expiré pour des raisons de sécurité.
          <br />
          Veuillez vous reconnecter pour continuer.
        </p>

        {/* Countdown */}
        <div style={{
          background: 'rgba(200, 168, 75, 0.1)',
          border: '1px solid rgba(200, 168, 75, 0.2)',
          borderRadius: 12,
          padding: '16px 24px',
          marginBottom: 24,
        }}>
          <div style={{
            fontSize: 12,
            color: '#c8a84b',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 8,
            fontWeight: 600,
          }}>
            Redirection automatique dans
          </div>
          <div style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 36,
            fontWeight: 700,
            color: '#e4c66a',
            letterSpacing: '0.05em',
          }}>
            {countdown}s
          </div>
        </div>

        {/* Button */}
        <button
          onClick={handleRedirect}
          disabled={isRedirecting}
          style={{
            width: '100%',
            padding: '14px 24px',
            background: isRedirecting 
              ? 'rgba(200, 168, 75, 0.3)' 
              : 'linear-gradient(135deg, #c8a84b 0%, #e4c66a 100%)',
            color: '#060f0a',
            border: 'none',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: isRedirecting ? 'wait' : 'pointer',
            fontFamily: "'Inter', sans-serif",
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 16px rgba(200, 168, 75, 0.3)',
          }}
        >
          {isRedirecting ? 'Redirection...' : 'Se reconnecter maintenant'}
        </button>

        {/* Security note */}
        <p style={{
          fontSize: 11,
          color: '#5c5240',
          marginTop: 16,
          letterSpacing: '0.04em',
        }}>
          🔒 Cette mesure protège vos données
        </p>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to { 
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
};