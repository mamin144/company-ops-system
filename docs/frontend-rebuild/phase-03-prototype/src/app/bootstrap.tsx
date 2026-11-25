// Provider composition + global error boundary (Phase 4 foundation).
// Provider order preserved from the former main.tsx App component; the only
// addition is ErrorBoundary, which wraps the routed tree so any render crash
// degrades to the boundary fallback instead of a white screen.
// <BrowserRouter> stays at the entry (main.tsx) exactly as in Phase 3.
import { LangProvider } from '@/i18n';
import { AuthProvider } from '@/app/providers/auth';
import { ToastProvider } from '@/shared/ui';
import { ErrorBoundary } from '@/app/boundaries/ErrorBoundary';
import { AppRoutes } from '@/app/router';

export const Bootstrap = () => (
  <LangProvider>
    <AuthProvider>
      <ToastProvider>
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </ToastProvider>
    </AuthProvider>
  </LangProvider>
);
