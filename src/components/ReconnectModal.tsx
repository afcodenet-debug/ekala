import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, RefreshCw, Shield } from 'lucide-react';

/**
 * ReconnectModal - Affiche un modal élégant quand la session expire
 * 
 * Architecture:
 * - Écoute l'événement 'auth:show-reconnect-modal' émis par AuthStore
 * - Affiche un modal avec glassmorphism design
 * - Permet à l'utilisateur de se reconnecter sans perdre son contexte
 */

export const ReconnectModal = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Écouter l'événement d'expiration de token
    const handleTokenExpired = () => {
      setIsVisible(true);
      // Déclencher l'animation après un court délai pour permettre le render
      setTimeout(() => setIsAnimating(true), 10);
    };

    window.addEventListener('auth:show-reconnect-modal', handleTokenExpired);

    return () => {
      window.removeEventListener('auth:show-reconnect-modal', handleTokenExpired);
    };
  }, []);

  const handleReconnect = () => {
    // Animation de sortie
    setIsAnimating(false);
    
    // Attendre la fin de l'animation avant de rediriger
    setTimeout(() => {
      setIsVisible(false);
      navigate('/login');
    }, 300);
  };

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        opacity: isAnimating ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
    >
      {/* Backdrop avec blur */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
        }}
      />

      {/* Modal avec glassmorphism */}
      <div
        style={{
          position: 'relative',
          maxWidth: 420,
          width: '100%',
          background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(30, 30, 45, 0.95) 100%)',
          border: '1px solid rgba(212, 175, 55, 0.3)',
          borderRadius: 24,
          padding: '40px 32px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(212, 175, 55, 0.1)',
          transform: isAnimating ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(20px)',
          transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Icône animée avec anneau doré */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #D4AF37 0%, #f0d68c 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 0 0 12px rgba(212, 175, 55, 0.15), 0 0 30px rgba(212, 175, 55, 0.3)',
            animation: 'pulse-gold 2s ease-in-out infinite',
          }}
        >
          <Lock size={36} color="#0a0a0f" strokeWidth={2.5} />
        </div>

        {/* Titre */}
        <h2
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 32,
            fontWeight: 700,
            color: '#f0d68c',
            textAlign: 'center',
            marginBottom: 12,
            letterSpacing: '0.02em',
          }}
        >
          Session expirée
        </h2>

        {/* Message */}
        <p
          style={{
            fontSize: 14,
            color: '#a8997e',
            textAlign: 'center',
            lineHeight: 1.6,
            marginBottom: 8,
          }}
        >
          Votre session a expiré pour des raisons de sécurité.
        </p>

        <p
          style={{
            fontSize: 13,
            color: '#5c5240',
            textAlign: 'center',
            lineHeight: 1.5,
            marginBottom: 32,
          }}
        >
          Veuillez vous reconnecter pour continuer.
        </p>

        {/* Bouton de reconnexion */}
        <button
          onClick={handleReconnect}
          style={{
            width: '100%',
            padding: '14px 24px',
            background: 'linear-gradient(135deg, #D4AF37 0%, #c8a84b 100%)',
            color: '#0a0a0f',
            border: 'none',
            borderRadius: 14,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            fontFamily: "'Inter', sans-serif",
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            boxShadow: '0 4px 16px rgba(212, 175, 55, 0.3)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(212, 175, 55, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(212, 175, 55, 0.3)';
          }}
        >
          <RefreshCw size={18} />
          Se reconnecter
        </button>

        {/* Note de sécurité */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginTop: 20,
            padding: '10px 14px',
            background: 'rgba(212, 175, 55, 0.08)',
            border: '1px solid rgba(212, 175, 55, 0.15)',
            borderRadius: 10,
          }}
        >
          <Shield size={14} color="#D4AF37" />
          <span style={{ fontSize: 11, color: '#a8997e', letterSpacing: '0.03em' }}>
            Vos données locales sont préservées
          </span>
        </div>

        {/* Animation CSS */}
        <style>
          {`
            @keyframes pulse-gold {
              0%, 100% {
                box-shadow: 0 0 0 12px rgba(212, 175, 55, 0.15), 0 0 30px rgba(212, 175, 55, 0.3);
              }
              50% {
                box-shadow: 0 0 0 20px rgba(212, 175, 55, 0.05), 0 0 40px rgba(212, 175, 55, 0.4);
              }
            }
          `}
        </style>
      </div>
    </div>
  );
};

export default ReconnectModal;