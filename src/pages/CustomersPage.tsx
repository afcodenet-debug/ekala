import React from 'react';
import { Users, UserPlus, Search, Mail, Phone, MapPin, Calendar, ShoppingBag, MoreVertical } from 'lucide-react';

const CustomersPage: React.FC = () => {
  const customers = [
    { id: 1, name: 'Jean Dupont', email: 'jean.dupont@email.com', phone: '+33 6 12 34 56 78', visits: 12, spent: 45000, lastVisit: '2026-06-20' },
    { id: 2, name: 'Marie Martin', email: 'marie.martin@email.com', phone: '+33 6 98 76 54 32', visits: 8, spent: 32000, lastVisit: '2026-06-19' },
    { id: 3, name: 'Pierre Durand', email: 'pierre.durand@email.com', phone: '+33 6 45 67 89 01', visits: 15, spent: 67000, lastVisit: '2026-06-18' },
    { id: 4, name: 'Sophie Leroy', email: 'sophie.leroy@email.com', phone: '+33 6 23 45 67 89', visits: 5, spent: 18000, lastVisit: '2026-06-17' },
    { id: 5, name: 'Lucas Bernard', email: 'lucas.bernard@email.com', phone: '+33 6 78 90 12 34', visits: 20, spent: 89000, lastVisit: '2026-06-16' },
  ];

  const formatAmount = (cents: number) => {
    return `${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} FCFA`;
  };

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
              Clients
            </h1>
            <p style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.4)',
              margin: 0,
            }}>
              Gérez votre base de clients et suivez leur historique
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
            <UserPlus size={16} />
            Nouveau client
          </button>
        </div>

        {/* Search Bar */}
        <div style={{
          position: 'relative',
          maxWidth: 400,
        }}>
          <Search size={18} color="rgba(255,255,255,0.3)" style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
          }} />
          <input
            type="text"
            placeholder="Rechercher un client..."
            style={{
              width: '100%',
              padding: '12px 16px 12px 42px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              color: '#eeeef5',
              fontSize: 14,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
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
            Total clients
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#eeeef5', lineHeight: 1 }}>
            1,234
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
            Nouveaux ce mois
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#10b981', lineHeight: 1 }}>
            +48
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
            Clients actifs
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#D4AF37', lineHeight: 1 }}>
            892
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 18,
        overflow: 'hidden',
      }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, rgba(59,130,246,0.4), rgba(59,130,246,0.05))' }} />
        <div style={{ padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#eeeef5', margin: 0 }}>
              Liste des clients
            </h2>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              {customers.length} clients
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
            }}>
              <thead>
                <tr style={{
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <th style={{
                    textAlign: 'left',
                    padding: '12px 16px',
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.4)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}>Client</th>
                  <th style={{
                    textAlign: 'left',
                    padding: '12px 16px',
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.4)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}>Contact</th>
                  <th style={{
                    textAlign: 'left',
                    padding: '12px 16px',
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.4)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}>Visites</th>
                  <th style={{
                    textAlign: 'right',
                    padding: '12px 16px',
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.4)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}>Dépenses</th>
                  <th style={{
                    textAlign: 'left',
                    padding: '12px 16px',
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.4)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}>Dernière visite</th>
                  <th style={{
                    textAlign: 'center',
                    padding: '12px 16px',
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.4)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}></th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer, i) => (
                  <tr
                    key={customer.id}
                    style={{
                      borderBottom: i < customers.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      transition: 'background 0.2s',
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background: 'rgba(59,130,246,0.12)',
                          border: '1px solid rgba(59,130,246,0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <Users size={18} color="#60a5fa" />
                        </div>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#eeeef5', marginBottom: 2 }}>
                            {customer.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                            ID: #{customer.id.toString().padStart(4, '0')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                          <Mail size={12} color="rgba(255,255,255,0.3)" />
                          {customer.email}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                          <Phone size={12} color="rgba(255,255,255,0.3)" />
                          {customer.phone}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        borderRadius: 6,
                        background: 'rgba(16,185,129,0.1)',
                        border: '1px solid rgba(16,185,129,0.2)',
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#10b981',
                      }}>
                        <ShoppingBag size={12} />
                        {customer.visits}
                      </div>
                    </td>
                    <td style={{
                      padding: '16px',
                      verticalAlign: 'middle',
                      textAlign: 'right',
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: '#eeeef5',
                    }}>
                      {formatAmount(customer.spent)}
                    </td>
                    <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.6)',
                      }}>
                        <Calendar size={12} color="rgba(255,255,255,0.3)" />
                        {new Date(customer.lastVisit).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </td>
                    <td style={{ padding: '16px', verticalAlign: 'middle', textAlign: 'center' }}>
                      <button style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.4)',
                        cursor: 'pointer',
                        padding: 8,
                        borderRadius: 8,
                        transition: 'all 0.2s',
                      }}>
                        <MoreVertical size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomersPage;