import React, { useState } from 'react';
import { Shield, Key, Smartphone, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';

const SecurityPage: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      // API call would go here
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSuccess('Mot de passe mis à jour avec succès');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "DM Sans", sans-serif', color: '#eeeef5' }}>
      {/* Password Change Card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 18,
        overflow: 'hidden',
        marginBottom: 20,
      }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, rgba(239,68,68,0.4), rgba(239,68,68,0.05))' }} />
        <div style={{ padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Key size={18} color="#ef4444" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#eeeef5' }}>
                Mot de passe
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                Modifiez votre mot de passe de connexion
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 400 }}>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 6, display: 'block' }}>
                Mot de passe actuel
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    color: '#eeeef5',
                    fontSize: 14,
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                  placeholder="Entrez votre mot de passe actuel"
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 6, display: 'block' }}>
                Nouveau mot de passe
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  color: '#eeeef5',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
                placeholder="Minimum 8 caractères"
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 6, display: 'block' }}>
                Confirmer le mot de passe
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  color: '#eeeef5',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
                placeholder="Répétez le nouveau mot de passe"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setShowPasswords(!showPasswords)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  padding: 0,
                }}
              >
                {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
                {showPasswords ? 'Masquer' : 'Afficher'} les mots de passe
              </button>
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 12.5, color: '#ef4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} />
              {error}
            </div>
          )}
          {success && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, fontSize: 12.5, color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={16} />
              {success}
            </div>
          )}

          <button
            onClick={handleChangePassword}
            disabled={saving}
            style={{
              marginTop: 20,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 24px',
              borderRadius: 10,
              border: 'none',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: saving ? 'not-allowed' : 'pointer',
              background: 'linear-gradient(135deg, #D4AF37, #b8860b)',
              color: '#1a1306',
              boxShadow: '0 4px 16px rgba(212,175,55,0.25)',
              opacity: saving ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
          >
            {saving ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
          </button>
        </div>
      </div>

      {/* Two-Factor Authentication Card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 18,
        overflow: 'hidden',
        marginBottom: 20,
      }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, rgba(59,130,246,0.4), rgba(59,130,246,0.05))' }} />
        <div style={{ padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Smartphone size={18} color="#60a5fa" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#eeeef5' }}>
                Authentification à deux facteurs (2FA)
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                Ajoutez une couche de sécurité supplémentaire à votre compte
              </div>
            </div>
          </div>

          <div style={{
            padding: '14px 18px',
            background: 'rgba(59,130,246,0.06)',
            border: '1px solid rgba(59,130,246,0.15)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#eeeef5', marginBottom: 4 }}>
                Disponible prochainement
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                La double authentification sera bientôt disponible
              </div>
            </div>
            <span style={{
              padding: '4px 10px',
              borderRadius: 6,
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.2)',
              fontSize: 9.5,
              fontWeight: 700,
              color: '#f59e0b',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              whiteSpace: 'nowrap',
            }}>
              Bientôt
            </span>
          </div>
        </div>
      </div>

      {/* Active Sessions Card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 18,
        overflow: 'hidden',
      }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, rgba(139,92,246,0.4), rgba(139,92,246,0.05))' }} />
        <div style={{ padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Shield size={18} color="#a78bfa" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#eeeef5' }}>
                Sessions actives
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                Gérez vos sessions de connexion
              </div>
            </div>
          </div>

          <div style={{
            padding: '14px 18px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#eeeef5', marginBottom: 2 }}>
                  Session actuelle
                </div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>
                  Navigateur • Dernière activité il y a 2 min
                </div>
              </div>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 6,
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.2)',
                fontSize: 9.5,
                fontWeight: 700,
                color: '#10b981',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#10b981' }} />
                Active
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityPage;
