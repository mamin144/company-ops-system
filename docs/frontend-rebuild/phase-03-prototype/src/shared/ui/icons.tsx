/* Phase 3.14 — shared stroke icon set. One visual language everywhere:
   24px grid, 1.8px rounded strokes, currentColor. Direction-neutral paths only
   (no directional arrows — those stay as paired text labels, never lone icons). */
import type { JSX } from 'react';

export type IconName =
  | 'home' | 'projects' | 'archive' | 'inventory' | 'financials' | 'admin'
  | 'audit' | 'reports' | 'settings' | 'search' | 'bell' | 'sun' | 'moon'
  | 'globe' | 'density' | 'logout' | 'close' | 'plus' | 'dots' | 'check'
  | 'alert' | 'info' | 'file' | 'box' | 'eye' | 'wrench' | 'briefcase'
  | 'shield' | 'clock' | 'download' | 'sidebar';

const PATHS: Record<IconName, JSX.Element> = {
  home: (<><path d="M4 11l8-7 8 7" /><path d="M6 9.5V20h12V9.5" /></>),
  projects: (<><path d="M4 21h16" /><path d="M6 21V8.5L12 4l6 4.5V21" /><path d="M10.5 21v-4h3v4" /></>),
  archive: (<><path d="M3.5 4.5h17v3.5h-17z" /><path d="M5.5 8v11.5h13V8" /><path d="M10 12h4" /></>),
  inventory: (<><path d="M12 3.5l7.5 4.2v8.6L12 20.5l-7.5-4.2V7.7z" /><path d="M12 12l7.5-4.3M12 12L4.5 7.7M12 12v8.5" /></>),
  financials: (<><path d="M3.5 20.5h17" /><path d="M6.5 20.5v-7M12 20.5V6M17.5 20.5v-10.5" /></>),
  admin: (<><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19.5c.6-3.2 2.8-5.2 5.5-5.2s4.9 2 5.5 5.2" /><circle cx="16.8" cy="9.5" r="2.4" /><path d="M15.8 14.4c2.2.3 3.9 2 4.4 4.4" /></>),
  audit: (<><path d="M7 4.5h10V20H7z" /><path d="M9.5 2.8h5V6h-5z" /><path d="M10.2 13.2l1.8 1.8 3.6-3.8" /></>),
  reports: (<><path d="M7 3.5h6.5L17.5 7.5V20.5H7z" /><path d="M13.5 3.5v4h4" /><path d="M12 11.5v5.5M9.7 14.7l2.3 2.3 2.3-2.3" /></>),
  settings: (<><path d="M4.5 7.5h16M4.5 16.5h16" /><circle cx="15" cy="7.5" r="2.3" /><circle cx="9" cy="16.5" r="2.3" /></>),
  search: (<><circle cx="11" cy="11" r="6" /><path d="M15.8 15.8L20.5 20.5" /></>),
  bell: (<><path d="M6.5 16v-4.7a5.5 5.5 0 0111 0V16l1.6 3.2H4.9z" /><path d="M10.2 20.5a2.1 2.1 0 003.6 0" /></>),
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M18 6l-1.4 1.4M7.4 16.6L6 18" /></>),
  moon: (<><path d="M20 14.5A8 8 0 019.5 4 8 8 0 0020 14.5z" /></>),
  globe: (<><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17" /><path d="M12 3.5c2.5 2.3 3.8 5.2 3.8 8.5s-1.3 6.2-3.8 8.5c-2.5-2.3-3.8-5.2-3.8-8.5s1.3-6.2 3.8-8.5z" /></>),
  density: (<><path d="M4 6.5h16M4 12h16M4 17.5h16" /></>),
  logout: (<><path d="M13.5 4.5H6v15h7.5" /><path d="M10 12h10.5M17.8 8.7L21 12l-3.2 3.3" /></>),
  close: (<><path d="M6 6l12 12M18 6L6 18" /></>),
  plus: (<><path d="M12 5.5v13M5.5 12h13" /></>),
  dots: (<><circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none" /></>),
  check: (<><path d="M5 12.5l4.5 4.5L19 7.5" /></>),
  alert: (<><path d="M12 4.5L20.5 20h-17z" /><path d="M12 10v4.2M12 17.2v.3" /></>),
  info: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 7.8v.3" /></>),
  file: (<><path d="M7 3.5h6.5L17.5 7.5V20.5H7z" /><path d="M13.5 3.5v4h4" /></>),
  box: (<><path d="M4.5 8L12 4l7.5 4v8L12 20l-7.5-4z" /><path d="M4.5 8L12 12l7.5-4M12 12v8" /></>),
  eye: (<><path d="M2.8 12S6.2 6 12 6s9.2 6 9.2 6-3.4 6-9.2 6S2.8 12 2.8 12z" /><circle cx="12" cy="12" r="2.8" /></>),
  wrench: (<><path d="M14.7 6.3a4.5 4.5 0 00-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 006-6L14 13l-3-3 3.7-3.7z" /></>),
  briefcase: (<><path d="M4 8.5h16V20H4z" /><path d="M9 8.5V5.5h6v3M4 13.5h16" /></>),
  shield: (<><path d="M12 3.5l6.5 2.8v5.4c0 4.2-2.8 7-6.5 8.8-3.7-1.8-6.5-4.6-6.5-8.8V6.3z" /></>),
  clock: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3.3 2" /></>),
  download: (<><path d="M12 4v11M7.5 11L12 15.5 16.5 11" /><path d="M4.5 19.5h15" /></>),
  sidebar: (<><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M9.5 4.5v15" /></>),
};

export const Icon = ({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
    className={className} aria-hidden="true" focusable="false"
  >
    {PATHS[name]}
  </svg>
);
