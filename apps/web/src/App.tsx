import { useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { ToastProvider } from './components/ui';
import {
  IconArchive,
  IconDashboard,
  IconItems,
  IconMoon,
  IconProjects,
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

  const navItems = [
    { to: '/dashboard', label: 'لوحة التحكم', icon: <IconDashboard />, show: true },
    { to: '/projects', label: 'المشاريع', icon: <IconProjects />, show: can('projects.view') },
    { to: '/financials', label: 'المقايسات والمستخلصات', icon: <IconProjects />, show: can('projects.view') },
    { to: '/archive', label: 'الأرشيف', icon: <IconArchive />, show: can('archive.view') },
    { to: '/warehouses', label: 'المخازن', icon: <IconWarehouse />, show: can('warehouse.view') },
    { to: '/items', label: 'الأصناف', icon: <IconItems />, show: can('warehouse.view') },
    { to: '/stock', label: 'المخزون', icon: <IconStock />, show: can('warehouse.view') },
    { to: '/material-requests', label: 'طلبات المواد', icon: <IconItems />, show: can('materialRequests.view') },
    { to: '/admin', label: 'الإدارة', icon: <IconShield />, show: can('users.manage') || can('roles.manage') || can('projects.access') },
  ];

  return (
    <>
      <div
        className={`sidebar__backdrop ${open ? 'sidebar__backdrop--visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`sidebar ${open ? 'sidebar--open' : ''}`} aria-label="القائمة الجانبية">
        <div className="brand" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div className="brand__logo" onClick={onToggleCollapse} style={{ cursor: 'pointer' }} title={collapsed ? 'توسيع القائمة' : 'تصغير القائمة'}>CO</div>
            <div>
              <div className="brand__title">نظام إدارة الشركة</div>
              <div className="brand__subtitle">مقاولات وتشطيبات</div>
            </div>
          </div>
        </div>
        <nav className="nav">
          {navItems.filter((n) => n.show).map((n) => (
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
          {can('audit.view') ? (
            <NavLink
              to="/audit"
              onClick={onClose}
              title="سجل التغييرات"
              className={({ isActive }) => `navItem ${isActive ? 'active' : ''}`}
            >
              <IconSettings />
              <span>سجل التغييرات</span>
            </NavLink>
          ) : null}
          <NavLink
            to="/settings"
            onClick={onClose}
            title="الإعدادات"
            className={({ isActive }) => `navItem ${isActive ? 'active' : ''}`}
          >
            <IconSettings />
            <span>الإعدادات</span>
          </NavLink>

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
      </aside>
    </>
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
    <div style={{ background: '#f59e0b', color: '#fff', padding: '0.5rem', textAlign: 'center', fontWeight: 'bold' }}>
      أنت تتصفح في وضع عدم الاتصال (Offline). بعض البيانات قد تكون غير متوفرة.
    </div>
  );
};

const Shell = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === '1');

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem('sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  };

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
              title="القائمة"
            >
              <IconMenu size={20} />
            </button>
            <GlobalSearch />
          </div>
          <div className="topbar__end">
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>
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
