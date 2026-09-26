import type { ReactNode } from 'react';

/**
 * ResponsiveContainer
 * Centers content and provides responsive padding based on viewport size.
 */
export const ResponsiveContainer = ({
  children,
  className = '',
  maxWidth = '1440px',
}: {
  children: ReactNode;
  className?: string;
  maxWidth?: string;
}) => (
  <div
    className={`responsive-container ${className}`}
    style={{ maxWidth, margin: '0 auto', width: '100%' }}
  >
    {children}
  </div>
);

/**
 * ResponsiveGrid
 * Clean container/CSS-driven auto-fit grid adapting smoothly without JS recalculation.
 */
export const ResponsiveGrid = ({
  children,
  minWidth = 280,
  gap = 16,
  className = '',
}: {
  children: ReactNode;
  minWidth?: number;
  gap?: number;
  className?: string;
}) => (
  <div
    className={`responsive-grid ${className}`}
    style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minWidth}px), 1fr))`,
      gap: `${gap}px`,
    }}
  >
    {children}
  </div>
);

/**
 * PageShell
 * Standardized, responsive header and action bar for enterprise screens.
 */
export const PageShell = ({
  title,
  description,
  actions,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <div className={`page-shell ${className}`}>
    <div className="pageHead">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
    <div className="page-shell__content">{children}</div>
  </div>
);

/**
 * AdaptiveView
 * Used selectively ONLY when there is a genuine UX difference between layouts (e.g. detailed table vs stacked touch cards).
 */
export const AdaptiveView = ({
  mobile,
  desktop,
  breakpoint = 768,
}: {
  mobile: ReactNode;
  desktop: ReactNode;
  breakpoint?: number;
}) => (
  <>
    <div className="adaptive-mobile" style={{ display: 'contents' }}>
      {mobile}
    </div>
    <div className="adaptive-desktop" style={{ display: 'contents' }}>
      {desktop}
    </div>
  </>
);
