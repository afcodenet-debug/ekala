import { useState, useEffect } from 'react';

/**
 * Breakpoint detection hook with debounced resize handling
 * Returns current breakpoint state with optimized performance
 */
export const useBreakpoint = () => {
  const getState = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    return {
      width,
      height,
      isXs: width < 360,
      isSm: width >= 360 && width < 640,
      isMobile: width < 640,
      isMd: width >= 640 && width < 768,
      isTablet: width >= 640 && width < 1024,
      isLg: width >= 1024 && width < 1280,
      isDesktop: width >= 1024,
      isXl: width >= 1280 && width < 1536,
      is2Xl: width >= 1536,
      isPortrait: height > width,
      isLandscape: height <= width,
    };
  };

  const [breakpoint, setBreakpoint] = useState(getState);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let rafId: number;

    const handleResize = () => {
      // Use requestAnimationFrame for smoother updates
      rafId = requestAnimationFrame(() => {
        // Debounce with 100ms delay
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          setBreakpoint(getState());
        }, 100);
      });
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (timeoutId) clearTimeout(timeoutId);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return breakpoint;
};

/**
 * Helper to get responsive value based on breakpoint
 * @param mobile - Value for mobile (< 640px)
 * @param tablet - Value for tablet (640-1024px)
 * @param desktop - Value for desktop (>= 1024px)
 * @param xl - Optional value for XL screens (>= 1280px)
 */
export const responsiveValue = <T>(
  isMobile: boolean,
  isTablet: boolean,
  mobile: T,
  tablet: T,
  desktop: T,
  xl?: T
): T => {
  if (isMobile) return mobile;
  if (isTablet) return tablet;
  if (xl && window.innerWidth >= 1280) return xl;
  return desktop;
};

/**
 * Media query helper for CSS-in-JS
 */
export const mediaQuery = (
  minWidth?: number,
  maxWidth?: number
): string => {
  const parts: string[] = [];
  if (minWidth) parts.push(`(min-width: ${minWidth}px)`);
  if (maxWidth) parts.push(`(max-width: ${maxWidth}px)`);
  return parts.join(' and ');
};

export default useBreakpoint;
