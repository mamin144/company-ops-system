import { useEffect, useState } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide';

export function useResponsive() {
  const [width, setWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));

  useEffect(() => {
    let timeoutId: any = null;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setWidth(window.innerWidth);
      }, 50);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;
  const isWide = width >= 1440;

  const breakpoint: Breakpoint = isMobile ? 'mobile' : isTablet ? 'tablet' : isWide ? 'wide' : 'desktop';

  return {
    width,
    breakpoint,
    isMobile,
    isTablet,
    isDesktop,
    isWide,
    isTouch: isMobile || isTablet,
  };
}
