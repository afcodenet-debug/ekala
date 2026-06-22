import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader, Shield } from 'lucide-react';

// Utiliser le proxy Vite (configuré dans vite.config.ts) ou l'URL directe
const API_BASE = (window as any).VITE_API_BASE_URL || '/api';

const styles = `
  .platform-login-bg {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #09090f;
    position: relative;
    overflow: hidden;
  }
  .platform-login-bg::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(ellipse at 30% 20%, rgba(59,130,246,0.08) 0%, transparent 50%),
                radial-gradient(ellipse at 70% 80%, rgba(139,92,246,0.06) 0%, transparent 50%);
    animation: gradientShift 20s ease-in-out infinite alternate;
  }
  @keyframes gradientShift {
    0% { transform: translate(0, 0) rotate(0deg); }
    100% { transform: translate(-2%, -1%) rotate(2deg); }
  }
  .platform-login-card {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 420px;
    padding: 48px 32px 36px;
    background: #0f0f18;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px;
    box-shadow: 0 24px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.02);
  }
  .platform-login-logo {
    text-align: center;
    margin-bottom: 32px;
  }
  .platform-login-logo-icon {
    width: 56px;
    height: 56px;
    margin: 0 auto 16px;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 24px rgba(59,130,246,0.2);
  }
  .platform-login-title {
    font-size: 22px;
    font-weight: 700;
    color: #e8e8f2;
    letter-spacing: -0.02em;
  }
  .platform-login-subtitle {
    font-size: 13px;
    color: #6a6a80;
    margin-top: 6px;
    font-weight: 400;
  }
  .platform-login-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .platform-login-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .platform-login-label {
    font-size: 12px;
    font-weight: 600;
    color: #a0a0b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .platform-login-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }
  .platform-login-input {
    width: 100%;
    padding: 12px 14px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    color: #e8e8f2;
    font-size: 14px;
    outline: none;
    transition: all 160ms;
  }
  .platform-login-input:focus {
    border-color: rgba(59,130,246,0.3);
    background: rgba(255,255,255,0.05);
    box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
  }
  .platform-login-input::placeholder {
    color: #4a4a60;
  }
  .platform-login-input.error {
    border-color: rgba(239,68,68,0.4);
  }
  .platform-login-toggle-pw {
    position: absolute;
    right: 10px;
    background: none;
    border: none;
    color: #6a6a80;
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    transition: color 140ms;
  }
  .platform-login-toggle-pw:hover {
    color: #a0a0b8;
  }
  .platform-login-options {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: -4px;
  }
  .platform-login-remember {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #6a6a80;
    cursor: pointer;
  }
  .platform-login-remember input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: #3b82f6;
    border-radius: 4px;
  }
  .platform-login-submit {
    padding: 12px 20px;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    border: none;
    border-radius: 10px;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 160ms;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .platform-login-submit:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(59,130,246,0.3);
  }
  .platform-login-submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
  .platform-login-error {
    background: rgba(239,68,68,0.1);
    border: 1px solid rgba(239,68,68,0.2);
    border-radius: 10px;
    padding: 12px 16px;
    font-size: 12px;
    color: #ef4444;
    line-height: 1.4;
  }
  .platform-login-footer {
    text-align: center;
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }
  .platform-login-footer-text {
    font-size: 11px;
    color: #4a4a60;
  }
  .platform-login-spinner {
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const PlatformLoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const savedEmail = localStorage.getItem('platform_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/platform/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, remember_me: rememberMe }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('platform_token', data.token);
        localStorage.setItem('platform_user', JSON.stringify(data.user));

        if (rememberMe) {
          localStorage.setItem('platform_email', email);
        } else {
          localStorage.removeItem('platform_email');
        }

        navigate('/platform');
      } else {
        setError(data.message || 'Email ou mot de passe incorrect');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="platform-login-bg">
      <style>{styles}</style>

      <div className="platform-login-card">
        {/* Logo */}
        <div className="platform-login-logo">
          <div className="platform-login-logo-icon">
            <Shield size={28} color="#fff" />
          </div>
          <div className="platform-login-title">Ekala Platform</div>
          <div className="platform-login-subtitle">Portail d'administration</div>
        </div>

        {/* Error */}
        {error && <div className="platform-login-error">{error}</div>}

        {/* Form */}
        <form className="platform-login-form" onSubmit={handleSubmit} style={{ marginTop: error ? 16 : 0 }}>
          <div className="platform-login-field">
            <label className="platform-login-label">Email</label>
            <input
              type="email"
              className="platform-login-input"
              placeholder="admin@ekala.africa"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="platform-login-field">
            <label className="platform-login-label">Mot de passe</label>
            <div className="platform-login-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                className="platform-login-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="platform-login-toggle-pw"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="platform-login-options">
            <label className="platform-login-remember">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Se souvenir de moi
            </label>
          </div>

          <button type="submit" className="platform-login-submit" disabled={loading}>
            {loading ? (
              <Loader size={18} className="platform-login-spinner" />
            ) : null}
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        {/* Footer */}
        <div className="platform-login-footer">
          <div className="platform-login-footer-text">
            Accès réservé au personnel Ekala
          </div>
          <div className="platform-login-footer-text" style={{ marginTop: 4 }}>
            Ekala v1.0.0
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlatformLoginPage;