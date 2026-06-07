import { EnterpriseTokens } from '../design-system';

const { colors, radius, shadows } = EnterpriseTokens;

/**
 * Responsive breakpoints configuration
 */
export const breakpoints = {
  xs: 360,
  sm: 480,
  md: 640,
  lg: 768,
  xl: 1024,
  '2xl': 1280,
  '3xl': 1536,
} as const;

/**
 * Responsive spacing tokens
 */
export const spacing = {
  xs: '4px',
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '20px',
  '3xl': '24px',
  '4xl': '28px',
  '5xl': '32px',
  '6xl': '40px',
  '7xl': '48px',
} as const;

/**
 * Responsive typography scale
 */
export const typography = {
  fontFamily: {
    primary: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'JetBrains Mono, Monaco, "Courier New", monospace',
  },
  fontSize: {
    xs: '10px',
    sm: '11px',
    base: '12px',
    md: '13px',
    lg: '14px',
    xl: '16px',
    '2xl': '18px',
    '3xl': '20px',
    '4xl': '24px',
    '5xl': '28px',
    '6xl': '32px',
    '7xl': '36px',
    '8xl': '40px',
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },
  letterSpacing: {
    tight: '-0.025em',
    normal: '0',
    wide: '0.02em',
    wider: '0.04em',
    widest: '0.08em',
  },
} as const;

/**
 * Responsive utility functions
 */
export const responsive = {
  /**
   * Get value based on breakpoint
   */
  value: (isMobile: boolean, isTablet: boolean, mobile: any, tablet: any, desktop: any, xl?: any) => {
    if (isMobile) return mobile;
    if (isTablet) return tablet;
    if (xl && window.innerWidth >= breakpoints.xl) return xl;
    return desktop;
  },

  /**
   * Get padding based on breakpoint
   */
  padding: (isMobile: boolean, isTablet: boolean, mobile = spacing.md, tablet = spacing.lg, desktop = spacing.xl) =>
    responsive.value(isMobile, isTablet, mobile, tablet, desktop),

  /**
   * Get gap based on breakpoint
   */
  gap: (isMobile: boolean, isTablet: boolean, mobile = spacing.sm, tablet = spacing.md, desktop = spacing.lg) =>
    responsive.value(isMobile, isTablet, mobile, tablet, desktop),

  /**
   * Get font size based on breakpoint
   */
  fontSize: (isMobile: boolean, isTablet: boolean, mobile = typography.fontSize.sm, tablet = typography.fontSize.base, desktop = typography.fontSize.md) =>
    responsive.value(isMobile, isTablet, mobile, tablet, desktop),

  /**
   * Get border radius based on breakpoint
   */
  borderRadius: (isMobile: boolean, isTablet: boolean, mobile = radius.md, tablet = radius.lg, desktop = radius.xl) =>
    responsive.value(isMobile, isTablet, mobile, tablet, desktop),
};

/**
 * Touch target sizes for better mobile UX
 */
export const touchTargets = {
  min: '44px',
  optimal: '48px',
  large: '56px',
} as const;

/**
 * Safe area insets for notch devices
 */
export const safeArea = {
  top: 'env(safe-area-inset-top, 0px)',
  right: 'env(safe-area-inset-right, 0px)',
  bottom: 'env(safe-area-inset-bottom, 0px)',
  left: 'env(safe-area-inset-left, 0px)',
} as const;

/**
 * Scrollbar utilities
 */
export const scrollbar = {
  hide: {
    '::-webkit-scrollbar': { display: 'none' },
    scrollbarWidth: 'none',
    '-ms-overflow-style': 'none',
  },
  thin: {
    '::-webkit-scrollbar': { width: '3px', height: '3px' },
    '::-webkit-scrollbar-track': { background: 'transparent' },
    '::-webkit-scrollbar-thumb': { background: colors.border, borderRadius: '2px' },
  },
  default: {
    '::-webkit-scrollbar': { width: '6px', height: '6px' },
    '::-webkit-scrollbar-track': { background: colors.surface },
    '::-webkit-scrollbar-thumb': { background: colors.border, borderRadius: '3px' },
  },
} as const;

/**
 * Box shadow utilities for different depth levels
 */
export const elevation = {
  none: 'none',
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 2px 8px rgba(0, 0, 0, 0.08)',
  lg: '0 4px 16px rgba(0, 0, 0, 0.12)',
  xl: '0 8px 32px rgba(0, 0, 0, 0.16)',
  '2xl': '0 16px 64px rgba(0, 0, 0, 0.18)',
  soft: {
    sm: '0 1px 4px rgba(0, 0, 0, 0.04)',
    md: '0 2px 12px rgba(0, 0, 0, 0.06)',
    lg: '0 4px 24px rgba(0, 0, 0, 0.08)',
  },
  hard: shadows.hard,
} as const;

/**
 * Animation utilities
 */
export const animations = {
  fadeIn: 'fadeIn 0.3s ease-out',
  slideUp: 'slideUp 0.3s ease-out',
  slideDown: 'slideDown 0.3s ease-out',
  slideLeft: 'slideLeft 0.3s ease-out',
  slideRight: 'slideRight 0.3s ease-out',
  scaleIn: 'scaleIn 0.3s ease-out',
  custom: (duration: number = 300, easing: string = 'ease-out') =>
    `${duration}ms ${easing}`,
} as const;

/**
 * Keyframes for animations
 */
export const keyframes = {
  fadeIn: `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `,
  slideUp: `
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `,
  slideDown: `
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-16px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `,
  slideLeft: `
    @keyframes slideLeft {
      from { opacity: 0; transform: translateX(16px); }
      to { opacity: 1; transform: translateX(0); }
    }
  `,
  slideRight: `
    @keyframes slideRight {
      from { opacity: 0; transform: translateX(-16px); }
      to { opacity: 1; transform: translateX(0); }
    }
  `,
  scaleIn: `
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
  `,
  shimmer: `
    @keyframes shimmer {
      0% { background-position: -400px 0; }
      100% { background-position: 400px 0; }
    }
  `,
  spin: `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `,
  pulse: `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `,
  bounce: `
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }
  `,
  toastIn: `
    @keyframes toastIn {
      from { opacity: 0; transform: translateY(-12px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `,
} as const;

export default {
  breakpoints,
  spacing,
  typography,
  responsive,
  touchTargets,
  safeArea,
  scrollbar,
  elevation,
  animations,
  keyframes,
};
