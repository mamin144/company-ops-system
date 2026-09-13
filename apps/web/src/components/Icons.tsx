import type { ReactNode } from 'react';

const Svg = ({ children, size = 18 }: { children: ReactNode; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const IconDashboard = (p: { size?: number }) => (
  <Svg {...p}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></Svg>
);

export const IconProjects = (p: { size?: number }) => (
  <Svg {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M3 11h18" /></Svg>
);

export const IconArchive = (p: { size?: number }) => (
  <Svg {...p}><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" /><path d="M10 12h4" /></Svg>
);

export const IconWarehouse = (p: { size?: number }) => (
  <Svg {...p}><path d="M3 21V9l9-5 9 5v12" /><path d="M7 21v-8h10v8" /><path d="M7 17h10" /></Svg>
);

export const IconItems = (p: { size?: number }) => (
  <Svg {...p}><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 3 12V5a2 2 0 0 1 2-2h7a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.6Z" /><circle cx="7.5" cy="7.5" r="0.5" fill="currentColor" /></Svg>
);

export const IconStock = (p: { size?: number }) => (
  <Svg {...p}><path d="M7 4v13" /><path d="m3 13 4 4 4-4" /><path d="M17 20V7" /><path d="m13 11 4-4 4 4" /></Svg>
);

export const IconSettings = (p: { size?: number }) => (
  <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" /></Svg>
);

export const IconPlus = (p: { size?: number }) => (
  <Svg {...p}><path d="M12 5v14" /><path d="M5 12h14" /></Svg>
);

export const IconSearch = (p: { size?: number }) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-3.5-3.5" /></Svg>
);

export const IconDownload = (p: { size?: number }) => (
  <Svg {...p}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 21h16" /></Svg>
);

export const IconUpload = (p: { size?: number }) => (
  <Svg {...p}><path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M4 21h16" /></Svg>
);

export const IconEdit = (p: { size?: number }) => (
  <Svg {...p}><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></Svg>
);

export const IconTrash = (p: { size?: number }) => (
  <Svg {...p}><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6" /><path d="M14 11v6" /></Svg>
);

export const IconAlert = (p: { size?: number }) => (
  <Svg {...p}><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></Svg>
);

export const IconSun = (p: { size?: number }) => (
  <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.9 4.9 1.4 1.4" /><path d="m17.7 17.7 1.4 1.4" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.3 17.7-1.4 1.4" /><path d="m19.1 4.9-1.4 1.4" /></Svg>
);

export const IconMoon = (p: { size?: number }) => (
  <Svg {...p}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></Svg>
);

export const IconFile = (p: { size?: number; kind?: string }) => (
  <Svg {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
    {p.kind === 'image' && <><circle cx="9" cy="13" r="1.5" /><path d="m21 17-4-4-6 6" /></>}
    {p.kind === 'pdf' && <path d="M8 15h2a1.5 1.5 0 0 0 0-3H8v6" />}
    {p.kind === 'sheet' && <path d="M8 13h8M8 16h8M8 19h5" />}
    {(p.kind === 'zip' || p.kind === 'cad' || !p.kind) && <path d="M8 13h8M8 16.5h8" />}
  </Svg>
);

export const IconEye = (p: { size?: number }) => (
  <Svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></Svg>
);

export const IconReplace = (p: { size?: number }) => (
  <Svg {...p}><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></Svg>
);
export const IconLink = ({ size }: { size?: number }) => <Svg size={size}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></Svg>;
