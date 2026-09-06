import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { SafeUser } from '@cos/shared';
import { api, onForceLogout, refreshSession, setAccessToken } from '../lib/api';

interface AuthState {
  user: (SafeUser & { permissions: string[] }) | null;
  loading: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  can: (...permissions: string[]) => boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  can: () => false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<(SafeUser & { permissions: string[] }) | null>(null);
  const [loading, setLoading] = useState(true);

  /* Session restoration at startup:
     app starts → try silent refresh (HttpOnly cookie) → me() → App or Login.
     A missing token alone never sends the user to Login; only a genuine
     failed authentication does. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshSession();
        const me = await api.get<SafeUser & { permissions: string[] }>('/api/auth/me');
        if (!cancelled) setUser(me);
      } catch {
        setAccessToken(undefined);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Central logout when the API client determines the session is unrecoverable. */
  useEffect(() => onForceLogout(() => setUser(null)), []);

  const login = useCallback(async (username: string, password: string, rememberMe = false) => {
    const res = await api.post<{ accessToken: string; user: SafeUser & { permissions: string[] } }>(
      '/api/auth/login',
      { username, password, rememberMe },
    );
    setAccessToken(res.accessToken);
    setUser(res.user);
  }, []);

  /** Revokes ONLY this device's session — other computers stay logged in. */
  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      /* session may already be gone */
    }
    setAccessToken(undefined);
    setUser(null);
  }, []);

  const can = useCallback(
    (...permissions: string[]) => !!user && permissions.some((p) => user.permissions.includes(p)),
    [user],
  );

  const value = useMemo(() => ({ user, loading, login, logout, can }), [user, loading, login, logout, can]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/** Hide UI elements the current user has no permission for. */
export const Can = ({ perm, children }: { perm: string | string[]; children: ReactNode }) => {
  const { can } = useAuth();
  const perms = Array.isArray(perm) ? perm : [perm];
  if (!can(...perms)) return null;
  return <>{children}</>;
};
