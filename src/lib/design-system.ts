/**
 * ENTERPRISE DESIGN TOKENS
 * This set of variables ensures consistency across the entire application.
 * Use these variables in your components to maintain the premium dark aesthetic.
 */
export const EnterpriseTokens = {
  colors: {
    bg: '#09090f',
    surface: '#111118',
    card: '#16161f',
    cardHi: '#1c1c27',
    border: '#1e1e2e',
    borderHi: '#28283a',
    text1: '#eeeef5',
    text2: '#88889a',
    text3: '#44445a',
    accent: {
      amber: '#f59e0b',
      amberDim: 'rgba(245,158,11,0.08)',
      blue: '#3b82f6',
      blueDim: 'rgba(59,130,246,0.08)',
      green: '#10b981',
      greenDim: 'rgba(16,185,129,0.08)',
      red: '#ef4444',
      redDim: 'rgba(239,68,68,0.08)',
      purple: '#a78bfa',
      purpleDim: 'rgba(167,139,250,0.08)',
      gold: '#d4af37',
      goldDim: 'rgba(212,175,55,0.08)',
    }
  },
  typography: {
    sans: "'DM Sans', sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
  radius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
  },
  shadows: {
    soft: '0 4px 12px rgba(0,0,0,0.2)',
    hard: '0 12px 32px rgba(0,0,0,0.4)',
    glow: '0 0 16px rgba(212,175,55,0.2)',
  }
};

export const GlobalStyles = `
  :root {
    --bg: #09090f;
    --surface: #111118;
    --card: #16161f;
    --card-hi: #1c1c27;
    --border: #1e1e2e;
    --border-hi: #28283a;
    --text-1: #eeeef5;
    --text-2: #88889a;
    --text-3: #44445a;
    --amber: #f59e0b;
    --blue: #3b82f6;
    --green: #10b981;
    --red: #ef4444;
    --purple: #a78bfa;
    --gold: #d4af37;
  }

  body {
    background-color: var(--bg);
    color: var(--text-1);
    font-family: 'DM Sans', sans-serif;
    margin: 0;
    -webkit-font-smoothing: antialiased;
  }

  .mono { font-family: 'JetBrains Mono', monospace; }
  
  .custom-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
  .custom-scroll::-webkit-scrollbar-track { background: transparent; }
  .custom-scroll::-webkit-scrollbar-thumb { background: var(--border-hi); border-radius: 10px; }
  .custom-scroll::-webkit-scrollbar-thumb:hover { background: var(--text-3); }

  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slide-up { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  
  .animate-fade { animation: fade-in 0.3s ease; }
  .animate-slide { animation: slide-up 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
`;
