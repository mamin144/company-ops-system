// Route tree + per-route permission guard (Phase 4 foundation).
// Moved verbatim from the former main.tsx: same paths, same permission keys,
// same redirects, same layout nesting. New in Phase 4: the app-wide
// ErrorBoundary wraps this tree (see bootstrap.tsx), and a prototype-only
// crash-probe route exists so the boundary is actually verifiable in E2E.
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/app/providers/auth';
import { Shell } from '@/app/layouts/AppShell';
import { Forbidden, NotFound } from '@/app/boundaries/states';
import { Notifications } from '@/app/pages/Notifications';
import { Login } from '@/app/pages/Login';
import { Settings } from '@/app/pages/Settings';
import { Search } from '@/app/pages/Search';
import { Home } from '@/features/dashboard';
import { Financials, Projects, ProjectWorkspace, ProjDocs, ProjFinancials, ProjOverview, ProjSites, ProjStock, ProjWarehouses } from '@/features/projects';
import { Archive } from '@/features/archive';
import { InventoryHub, Items, Stock, Warehouses } from '@/features/inventory';
import { Requests } from '@/features/requests';
import { Reports } from '@/features/reports';
import { Admin, Audit } from '@/features/administration';
import { IS_PROTOTYPE } from '@/services/api/configuration';

/** UX-layer guard only: real authorization is enforced by the backend.
    Phase 5: the redirect to /login carries the attempted route as location
    state, so Login can send the actor back where they were heading (return
    destination). The state lives only in history state — no new storage. */
const Guard = ({ perm, children }: { perm?: string; children: ReactNode }) => {
  const { ready, user, can } = useAuth();
  const loc = useLocation();
  // Phase 13 (http mode): the session restore is async — render nothing until
  // it resolves so a still-valid session is never bounced to /login for one
  // frame. The fixture core is always ready, so this is a no-op there.
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />;
  if (perm && !can(perm)) return <Forbidden />;
  return <>{children}</>;
};

/** Prototype-only probe that throws on mount — lets the E2E suite verify the
    ErrorBoundary fallback and recovery. Never present in real builds. */
const CrashProbe = () => {
  if (IS_PROTOTYPE) throw new Error('[prototype] intentional crash-probe error');
  return null;
};

export const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route element={<Guard><Shell /></Guard>}>
      <Route index element={<Home />} />
      <Route path="projects" element={<Guard perm="projects.view"><Projects /></Guard>} />
      <Route path="projects/:id" element={<Guard perm="projects.view"><ProjectWorkspace /></Guard>}>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<ProjOverview />} />
        <Route path="sites" element={<ProjSites />} />
        <Route path="documents" element={<ProjDocs />} />
        <Route path="warehouses" element={<ProjWarehouses />} />
        <Route path="stock" element={<ProjStock />} />
        <Route path="financials" element={<ProjFinancials />} />
      </Route>
      <Route path="financials" element={<Guard perm="projects.view"><Financials /></Guard>} />
      <Route path="archive" element={<Guard perm="archive.view"><Archive /></Guard>} />
      <Route path="inventory" element={<Guard perm="warehouse.view"><InventoryHub /></Guard>} />
      <Route path="inventory/warehouses" element={<Guard perm="warehouse.view"><Warehouses /></Guard>} />
      <Route path="inventory/items" element={<Guard perm="warehouse.view"><Items /></Guard>} />
      <Route path="inventory/stock" element={<Guard perm="warehouse.view"><Stock /></Guard>} />
      <Route path="inventory/requests" element={<Guard perm="materialRequests.view"><Requests /></Guard>} />
      <Route path="admin" element={<Guard perm="users.manage"><Admin /></Guard>} />
      <Route path="audit" element={<Guard perm="audit.view"><Audit /></Guard>} />
      <Route path="reports" element={<Guard perm="reports.view"><Reports /></Guard>} />
      <Route path="settings" element={<Settings />} />
      <Route path="search" element={<Search />} />
      <Route path="notifications" element={<Notifications />} />
      <Route path="403" element={<Forbidden />} />
      {IS_PROTOTYPE && <Route path="_test/crash" element={<CrashProbe />} />}
      <Route path="*" element={<NotFound />} />
    </Route>
  </Routes>
);
