import React from 'react';
import { Building2, Plus, MapPin, Phone, Users, TrendingUp, MoreVertical, Edit, Trash2 } from 'lucide-react';

const BranchesPage: React.FC = () => {
  const branches = [
    { id: 1, name: 'Siège Social', address: '123 Avenue de la République, Lomé', phone: '+228 22 00 00 00', staff: 12, revenue: 450000, status: 'active' },
    { id: 2, name: 'Succursale Bè', address: '45 Rue du Marché, Bè', phone: '+228 22 11 11 11', staff: 8, revenue: 280000, status: 'active' },
    { id: 3, name: 'Succursale Kodjoviakopé', address: '78 Boulevard de la Marina', phone: '+228 22 22 22 22', staff: 6, revenue: 195000, status: 'active' },
    { id: 4, name: 'Succursale Agoè', address: '12 Route d\'Agoè', phone: '+228 22 33 33 33', staff: 5, revenue: 150000, status: 'inactive' },
  ];

  const formatAmount = (amount: number) => {
    return `${(amount / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} FCFA`;
  };

  const totalRevenue = branches.reduce((sum, b) => sum + b.revenue, 0);
  const totalStaff = branches.reduce((sum, b) => sum + b.staff, 0);
  const activeBranches = branches.filter(b => b.status === 'active').length;

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "DM Sans", sans-serif',
      color: '#eeeef5',
      padding: '32px 24px 60px',
      maxWidth: 1200,
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{
              fontSize: 28,
              fontWeight: 300,
              color: '#eeeef5',
              margin: '0 0 4px',
              letterSpacing: '-0.01em',
            }}>
              Succursales
            </h1>
            <p style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.4)',
              margin: 0,
            }}>
              Gérez vos points de vente et suivez leurs performances
            </p>
          </div>
          <button style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            borderRadius: 10,
            border: 'none',
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: 'pointer',
            background: 'linear-gradient(135deg, #D4AF37, #b8860b)',
            color: '#1a1306',
            boxShadow: '0 4px 16px rgba(212,175,55,0.25)',
            transition: 'all 0.2s',
          }}>
            <Plus size={16} />
            Nouvelle succursale
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 32,
      }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 18,
          padding: '20px 24px',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Total succursales
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#eeeef5', lineHeight: 1 }}>
            {branches.length}
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 18,
          padding: '20px 24px',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Succursales actives
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#10b981', lineHeight: 1 }}>
            {activeBranches}
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 18,
          padding: '20px 24px',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Personnel total
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#D4AF37', lineHeight: 1 }}>
            {totalStaff}
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 18,
          padding: '20px 24px',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Revenu total
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#eeeef5', lineHeight: 1.2 }}>
            {formatAmount(totalRevenue)}
          </div>
        </div>
      </div>

      {/* Branches Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 20,
      }}>
        {branches.map((branch, i) => (
          <div
            key={branch.id}
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 18,
              overflow: 'hidden',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              animation: `fade-in 400ms ${i * 50}ms cubic-bezier(0.16,1,0.3,1) both`,
            }}
            onMouseOver={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 16px 40px rgba(0,0,0,0.3)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* Accent Line */}
            <div style={{
              height: 3,
              background: branch.status === 'active'
                ? 'linear-gradient(90deg, rgba(16,185,129,0.6), rgba(16,185,129,0.1))'
                : 'linear-gradient(90deg, rgba(107,114,128,0.6), rgba(107,114,128,0.1))',
            }} />

            <div style={{ padding: '24px 28px' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: branch.status === 'active' ? 'rgba(16,185,129,0.12)' : 'rgba(107,114,128,0.12)',
                    border: `1px solid ${branch.status === 'active' ? 'rgba(16,185,129,0.25)' : 'rgba(107,114,128,0.25)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Building2 size={20} color={branch.status === 'active' ? '#10b981' : '#6b7280'} />
                  </div>
                  <div>
                    <h3 style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: '#eeeef5',
                      margin: '0 0 4px',
                      letterSpacing: '-0.01em',
                    }}>
                      {branch.name}
                    </h3>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      background: branch.status === 'active'
                        ? 'rgba(16,185,129,0.1)'
                        : 'rgba(107,114,128,0.1)',
                      border: `1px solid ${branch.status === 'active' ? 'rgba(16,185,129,0.2)' : 'rgba(107,114,128,0.2)'}`,
                      color: branch.status === 'active' ? '#10b981' : '#6b7280',
                    }}>
                      <span style={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: branch.status === 'active' ? '#10b981' : '#6b7280',
                        boxShadow: `0 0 6px ${branch.status === 'active' ? '#10b981' : '#6b7280'}`,
                      }} />
                      {branch.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <button style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 6,
                  transition: 'all 0.2s',
                }}>
                  <MoreVertical size={16} />
                </button>
              </div>

              {/* Address */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                marginBottom: 12,
                fontSize: 12,
                color: 'rgba(255,255,255,0.6)',
                lineHeight: 1.4,
              }}>
                <MapPin size={14} color="rgba(255,255,255,0.3)" style={{ flexShrink: 0, marginTop: 2 }} />
                {branch.address}
              </div>

              {/* Phone */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 20,
                fontSize: 12,
                color: 'rgba(255,255,255,0.6)',
              }}>
                <Phone size={14} color="rgba(255,255,255,0.3)" />
                {branch.phone}
              </div>

              {/* Stats */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                paddingTop: 16,
                borderTop: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    Personnel
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: '#eeeef5' }}>
                    <Users size={14} color="rgba(255,255,255,0.3)" />
                    {branch.staff}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    Revenu
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#D4AF37' }}>
                    <TrendingUp size={14} color="#D4AF37" />
                    {formatAmount(branch.revenue)}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{
                display: 'flex',
                gap: 8,
                marginTop: 16,
                paddingTop: 16,
                borderTop: '1px solid rgba(255,255,255,0.06)',
              }}>
                <button style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.03)',
                  color: '#eeeef5',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}>
                  <Edit size={14} />
                  Modifier
                </button>
                <button style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(239,68,68,0.2)',
                  background: 'rgba(239,68,68,0.05)',
                  color: '#ef4444',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default BranchesPage;