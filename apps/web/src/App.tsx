import { useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { ToastProvider, Drawer } from './components/ui';
import { CommandPalette, type PaletteNavItem } from './components/CommandPalette';
import { api } from './lib/api';
import {
  IconArchive,
  IconDashboard,
  IconItems,
  IconMoon,
  IconProjects,
  IconSearch,
  IconSettings,
  IconStock,
  IconSun,
  IconWarehouse,
  IconShield,
} from './components/Icons';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { ReactNode } from 'react';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ArchivePage } from './pages/ArchivePage';
import { WarehousesPage } from './pages/WarehousesPage';
import { ItemsPage } from './pages/ItemsPage';
import { StockPage } from './pages/StockPage';
import { SettingsPage } from './pages/SettingsPage';
import { MaterialRequestsPage } from './pages/MaterialRequestsPage';
import { AuditPage } from './pages/AuditPage';
import { AdminPage } from './pages/AdminPage';
import { ProjectDetailsPage } from './pages/ProjectDetailsPage';
import { FinancialsPage } from './pages/FinancialsPage';
import { GlobalSearch } from './components/GlobalSearch';
const ROLE_AR: Record<string, string> = { admin: 'مدير النظام', management: 'إدارة', warehouse: 'مخازن', technical: 'فني', viewer: 'مشاهدة' };
import { NotificationBell } from './components/NotificationBell';

const futureModules = ['المشتريات', 'الدفتر الفني'];

import { IconMenu, IconClose } from './components/Icons';

const Sidebar = ({
  open,
  onClose,
  collapsed,
  onToggleCollapse,
}: {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) => {
  const { user, can, logout } = useAuth();
  const navigate = useNavigate();

  // Domain-grouped navigation (Command Deck: grouped mental models, not a flat list).
  // Visibility rules are unchanged — every item keeps its original permission gate.
  const navGroups: Array<{
    label: string;
    items: Array<{ to: string; label: string; icon: ReactNode; show: boolean }>;
  }> = [
    {
      label: 'التنفيذ',
      items: [
        { to: '/dashboard', label: 'لوحة التحكم', icon: <IconDashboard />, show: true },
        { to: '/projects', label: 'المشاريع', icon: <IconProjects />, show: can('projects.view') },
        { to: '/financials', label: 'المقايسات والمستخلصات', icon: <IconProjects />, show: can('projects.view') },
      ],
    },
    {
      label: 'المعرفة',
      items: [
        { to: '/archive', label: 'الأرشيف', icon: <IconArchive />, show: can('archive.view') },
      ],
    },
    {
      label: 'المخزون',
      items: [
        { to: '/warehouses', label: 'المخازن', icon: <IconWarehouse />, show: can('warehouse.view') },
        { to: '/items', label: 'الأصناف', icon: <IconItems />, show: can('warehouse.view') },
        { to: '/stock', label: 'المخزون', icon: <IconStock />, show: can('warehouse.view') },
        { to: '/material-requests', label: 'طلبات المواد', icon: <IconItems />, show: can('materialRequests.view') },
      ],
    },
    {
      label: 'النظام',
      items: [
        { to: '/admin', label: 'الإدارة', icon: <IconShield />, show: can('users.manage') || can('roles.manage') || can('projects.access') },
        { to: '/audit', label: 'سجل التغييرات', icon: <IconSettings />, show: can('audit.view') },
        { to: '/settings', label: 'الإعدادات', icon: <IconSettings />, show: true },
      ],
    },
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="القائمة الجانبية"
      id="app-sidebar"
      className="sidebar"
      backdropClassName="sidebar__backdrop"
    >
      <div className="brand">
        <div className="brand__row">
          <button
            type="button"
            className="brand__logo"
            onClick={onToggleCollapse}
            title={collapsed ? 'توسيع القائمة' : 'تصغير القائمة'}
            aria-label={collapsed ? 'توسيع القائمة الجانبية' : 'تصغير القائمة الجانبية'}
            aria-expanded={!collapsed}
          >
            CO
          </button>
          <div>
            <div className="brand__title">نظام إدارة الشركة</div>
            <div className="brand__subtitle">مقاولات وتشطيبات</div>
          </div>
        </div>
      </div>
      <AttentionBlock onNavigate={() => onClose()} />
      <nav className="nav" aria-label="التنقل الرئيسي">
        {navGroups.map((g) => {
          const visible = g.items.filter((n) => n.show);
          if (!visible.length) return null;
          return (
            <div className="railGroup" key={g.label}>
              <div className="railGroup__label" aria-hidden="true">{g.label}</div>
              {visible.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  onClick={onClose}
                  title={n.label}
                  className={({ isActive }) => `navItem ${isActive ? 'active' : ''}`}
                >
                  {n.icon}
                  <span>{n.label}</span>
                </NavLink>
              ))}
            </div>
          );
        })}

        <div className="navSection">وحدات قادمة</div>
        {futureModules.map((m) => (
          <span key={m} className="navItem navItem--disabled" title="قيد التطوير">{m}</span>
        ))}
      </nav>

      <div className="sidebarUser">
        <div className="small"><strong>{user?.fullName ?? user?.username}</strong></div>
        <div className="muted small">{ROLE_AR[user?.roleName ?? 'viewer'] ?? user?.roleName ?? ''}</div>
        <button
          className="btn btn--sm btn--ghost"
          onClick={async () => {
            await logout();
            navigate('/login');
          }}
        >
          تسجيل الخروج
        </button>
      </div>
    </Drawer>
  );
};

/**
 * Attention surface: operational urgency only (pending approvals, low stock).
 * Real data from existing endpoints, permission-gated, fails silent —
 * never blocks the shell. Hidden when there is nothing to act on.
 */
const AttentionBlock = ({ onNavigate }: { onNavigate: () => void }) => {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(0);
  const [low, setLow] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (can('materialRequests.view')) {
          const mrs = await api.get<Array<{ status: string }>>('/api/material-requests');
          if (!cancelled && Array.isArray(mrs))
            setPending(mrs.filter((m) => m.status === 'submitted').length);
        }
      } catch {
        /* offline or denied: stay silent, hide the row */
      }
      try {
        if (can('warehouse.view')) {
          const s = await api.get<{ lowStock: unknown[] }>('/api/stock/overview');
          if (!cancelled && Array.isArray(s?.lowStock)) setLow(s.lowStock.length);
        }
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [can]);

  if (pending === 0 && low === 0) return null;

  const go = (to: string) => {
    onNavigate();
    navigate(to);
  };

  return (
    <div className="attention" role="region" aria-label="يحتاج انتباهك">
      <div className="attention__title">
        <span aria-hidden="true">●</span>
        <span>يحتاج انتباهك</span>
      </div>
      {pending > 0 ? (
        <button type="button" className="attention__item" onClick={() => go('/material-requests')}>
          <span>طلبات بانتظار الاعتماد</span>
          <span className="attention__count num">{pending}</span>
        </button>
      ) : null}
      {low > 0 ? (
        <button type="button" className="attention__item" onClick={() => go('/stock')}>
          <span>أصناف تحت حد الأمان</span>
          <span className="attention__count num">{low}</span>
        </button>
      ) : null}
    </div>
  );
};

const ThemeToggle = () => {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<'light' | 'dark'>;
      if (customEvent.detail) {
        setDark(customEvent.detail === 'dark');
      } else {
        setDark(localStorage.getItem('theme') === 'dark');
      }
    };
    window.addEventListener('cos:theme-change', handleThemeChange);
    window.addEventListener('storage', handleThemeChange);
    return () => {
      window.removeEventListener('cos:theme-change', handleThemeChange);
      window.removeEventListener('storage', handleThemeChange);
    };
  }, []);

  return (
    <button
      className="iconBtn themeToggle"
      onClick={() => {
        const next = !dark;
        setDark(next);
        window.dispatchEvent(new CustomEvent('cos:theme-change', { detail: next ? 'dark' : 'light' }));
      }}
      title={dark ? 'الوضع النهاري' : 'الوضع الليلي'}
    >
      {dark ? <IconSun /> : <IconMoon />}
    </button>
  );
};

const Protected = ({ perm, children }: { perm?: string; children: ReactNode }) => {
  const { user, loading, can } = useAuth();
  // session restoration must complete BEFORE any protected page renders
  if (loading) return <div className="sessionLoading">جاري استعادة الجلسة…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (perm && !can(perm))
    return (
      <div className="page">
        <div className="errorState">
          <div className="emptyState__title">ليس لديك صلاحية لعرض هذه الصفحة</div>
          <p className="muted small">تواصل مع مدير النظام إذا كنت تعتقد أن هذا خطأ.</p>
          <button className="btn btn--primary" onClick={() => window.history.back()}>رجوع</button>
        </div>
      </div>
    );
  return <>{children}</>;
};

const OfflineBanner = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);
  if (!isOffline) return null;
  return (
    <div className="offlineBanner">
      أنت تتصفح في وضع عدم الاتصال (Offline). بعض البيانات قد تكون غير متوفرة.
    </div>
  );
};

const Shell = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const { can } = useAuth();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === '1');

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem('sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  };

  // Global Ctrl+K / Cmd+K opens the command palette (same shortcut closes it).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdkOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Permission-filtered navigation targets for the palette (mirrors the rail).
  const paletteNav: PaletteNavItem[] = [
    { to: '/dashboard', label: 'لوحة التحكم', group: 'التنفيذ' },
    ...(can('projects.view')
      ? [
          { to: '/projects', label: 'المشاريع', group: 'التنفيذ' },
          { to: '/financials', label: 'المقايسات والمستخلصات', group: 'التنفيذ' },
        ]
      : []),
    ...(can('archive.view') ? [{ to: '/archive', label: 'الأرشيف', group: 'المعرفة' }] : []),
    ...(can('warehouse.view')
      ? [{ to: '/warehouses', label: 'المخازن', group: 'المخزون' }]
      : []),
    ...(can('materialRequests.view')
      ? [{ to: '/material-requests', label: 'طلبات المواد', group: 'المخزون' }]
      : []),
    { to: '/settings', label: 'الإعدادات', group: 'النظام' },
  ];

  return (
    <div className={`shell ${collapsed ? 'shell--collapsed' : ''}`}>
      <Sidebar
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
      />
      <main className="main">
        <header className="topbar" role="banner">
          <div className="topbar__start">
            <button
              type="button"
              className="menuBtn"
              onClick={() => setDrawerOpen(true)}
              aria-label="فتح القائمة الرئيسية"
              aria-expanded={drawerOpen}
              aria-controls="app-sidebar"
              title="القائمة"
            >
              <IconMenu size={20} />
            </button>
            <button
              type="button"
              className="cmdkTrigger"
              data-cmdk-trigger
              onClick={() => setCmdkOpen(true)}
              aria-label="فتح لوحة الأوامر"
              aria-haspopup="dialog"
              title="لوحة الأوامر (Ctrl+K)"
            >
              <IconSearch size={15} />
              <span>أوامر وانتقال…</span>
              <span className="kbd">Ctrl K</span>
            </button>
            <GlobalSearch />
          </div>
          <div className="topbar__end">
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>
        <CommandPalette open={cmdkOpen} onClose={() => setCmdkOpen(false)} navItems={paletteNav} />
        <OfflineBanner />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
          <Route path="/projects" element={<Protected perm="projects.view"><ProjectsPage /></Protected>} />
          <Route path="/financials" element={<Protected perm="projects.view"><FinancialsPage /></Protected>} />
          <Route path="/projects/:id" element={<Protected perm="projects.view"><ProjectDetailsPage /></Protected>} />
          <Route path="/archive" element={<Protected perm="archive.view"><ArchivePage /></Protected>} />
          <Route path="/warehouses" element={<Protected perm="warehouse.view"><WarehousesPage /></Protected>} />
          <Route path="/items" element={<Protected perm="warehouse.view"><ItemsPage /></Protected>} />
          <Route path="/stock" element={<Protected perm="warehouse.view"><StockPage /></Protected>} />
          <Route path="/material-requests" element={<Protected perm="materialRequests.view"><MaterialRequestsPage /></Protected>} />
          <Route path="/audit" element={<Protected perm="audit.view"><AuditPage /></Protected>} />
          <Route path="/admin/*" element={<Protected><AdminPage /></Protected>} />
          <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export const App = () => (
  <ErrorBoundary>
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Protected><Shell /></Protected>} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  </ErrorBoundary>
);
