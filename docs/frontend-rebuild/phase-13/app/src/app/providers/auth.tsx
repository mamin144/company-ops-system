import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { adapterMode, session, userApi } from '@/services/api';
import type { SessionUser } from '@/services/api';
import { onForceLogout } from '@/services/api/adapters/http/client';
import type { MockUser } from '@/services/api/adapters/mock/data';

// ─────────────────────────────────────────────────────────────────────────────
// Transport-aware auth (Phase 13). TWO cores behind ONE context:
//
//  · fixture mode (VITE_PROTOTYPE=1): the Phase-5 mock behavior preserved
//    byte-for-byte — demo login maps each role to a DISTINCT mock user record
//    so self-denial can be tested (the actor has an identity independent of
//    the managed account); effective permissions = role base + overrides
//    (explicit DENY beats GRANT), read live from the mock store on every call.
//
//  · http mode (default): the REAL backend session via ./services/api —
//    credential login (POST /api/auth/login), restore via /me + silent
//    refresh on 401, logout revoking this device's session, and a force-
//    logout listener so the http client can evict dead sessions (expired
//    refresh cookie). `can()` reads the permission list the SERVER returned;
//    scoping stays server-enforced — the client never fakes it.
// ─────────────────────────────────────────────────────────────────────────────
export type DemoRole = 'admin' | 'manager' | 'warehouse' | 'viewer' | 'technical';
const ROLE_USER: Record<DemoRole, string> = { admin: 'mu-1', manager: 'mu-7', warehouse: 'mu-2', viewer: 'mu-4', technical: 'mu-3' };
/** Order of the demo login tiles. Display copy lives in i18n (see Login.tsx). */
export const DEMO_ROLES: DemoRole[] = ['admin', 'manager', 'warehouse', 'viewer', 'technical'];
/** @deprecated display copy moved to i18n; kept only so nothing imports a label map. */
export const ROLE_AR: Record<DemoRole, string> = { admin: 'مدير (تجريبي)', manager: 'إدارة (تجريبي)', warehouse: 'مخازن (تجريبي)', viewer: 'مشاهد (تجريبي)', technical: 'فني (تجريبي)' };

/** Normalized identity exposed to consumers in both modes (AppShell chip,
    Settings, actor ids for adapter calls). `role` is optional in http mode —
    the real backend carries roleName, fixture records carry role unions. */
export interface AuthUser { id: string; name: string; role?: string }

interface AuthBase {
  mode: 'fixture' | 'http';
  /** false only while the http core is still restoring its session on mount —
      the router Guard renders nothing (no /login flash) until it resolves.
      The fixture core restores synchronously, so it is always ready. */
  ready: boolean;
  user: AuthUser | null;
  logout: () => void | Promise<void>;
  refresh: () => void | Promise<void>;
  can: (...permissions: string[]) => boolean;
}

interface FixtureAuth extends AuthBase {
  mode: 'fixture';
  ready: true;
  /** Demo identity (mock record fields, exactly as before Phase 13). */
  user: { id: string; name: string; role: MockUser['role'] } | null;
  login: (r: DemoRole) => void;
}

interface HttpAuth extends AuthBase {
  mode: 'http';
  /** Credential login. Rejects with the transport error (ApiError carries the
      backend's message, e.g. the Arabic bad-credentials 401) — the Login
      screen surfaces it through errText. */
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
}

export type Auth = FixtureAuth | HttpAuth;

const Ctx = createContext<Auth>({
  mode: 'fixture',
  ready: true,
  user: null,
  login: () => {},
  logout: () => {},
  refresh: () => {},
  can: () => false,
} as Auth);
export const useAuth = () => useContext(Ctx);

/* ───────────────────────── fixture core (behavior preserved verbatim) ────── */

interface FixtureSession { id: string; name: string; role: MockUser['role'] }

const readSession = (): FixtureSession | null => {
  try {
    const raw = sessionStorage.getItem('cos-proto-user');
    return raw ? (JSON.parse(raw) as FixtureSession) : null;
  } catch { return null; }
};

/* Phase 5: session restoration is VALIDATED at state-initialization time, not
   just read. A session id that no longer resolves to a live user record
   (mocked "account deleted / session expired") is treated as invalid and
   never restored — so the Guard redirects to /login on the very first render
   and no protected content is briefly exposed. Storage cleanup happens in
   the mount effect via refresh(). */
const readSessionValidated = (): FixtureSession | null => {
  const s = readSession();
  if (!s) return null;
  return userApi.get(s.id) ? s : null;
};

const FixtureAuthCore = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FixtureSession | null>(readSessionValidated);

  const login = useCallback((r: DemoRole) => {
    const rec = userApi.get(ROLE_USER[r]);
    const u: FixtureSession = rec
      ? { id: rec.id, name: rec.name, role: rec.role }
      : { id: `role:${r}`, name: ROLE_AR[r], role: r as MockUser['role'] };
    sessionStorage.setItem('cos-proto-user', JSON.stringify(u));
    setUser(u);
  }, []);
  const logout = useCallback(() => {
    sessionStorage.removeItem('cos-proto-user');
    setUser(null);
  }, []);
  const refresh = useCallback(() => {
    const s = readSession();
    if (!s) { setUser(null); return; }
    const rec = userApi.get(s.id);
    if (!rec) {
      // Phase 5: the session id no longer resolves to a live user record —
      // treat the session as expired/invalid: drop it, don't trust the stale
      // JSON. The actor lands on /login via the Guard; nothing protected
      // renders. (Admin.tsx calls this after renames — a live record still
      // exists there, so that flow is unaffected.)
      sessionStorage.removeItem('cos-proto-user');
      setUser(null);
      return;
    }
    const next = { id: rec.id, name: rec.name, role: rec.role };
    sessionStorage.setItem('cos-proto-user', JSON.stringify(next));
    setUser(next);
  }, []);

  // Phase 5: validate + re-sync once per provider mount. Covers restored
  // sessions (storage cleanup for invalidated ids, display name/role syncing)
  // without any per-navigation work — permission checks already read the mock
  // store live on every call.
  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo<FixtureAuth>(() => ({
    mode: 'fixture',
    ready: true,
    user,
    login,
    logout,
    refresh,
    can: (...p) => {
      if (!user) return false;
      const eff = userApi.effective(user.id);
      return p.some((x) => eff.allowed[x] === true);
    },
  }), [user, login, logout, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

/* ─────────────────────────────── http core (real session) ───────────────── */

const HttpAuthCore = ({ children }: { children: ReactNode }) => {
  // The full server identity lives here (permissions included); consumers see
  // the normalized AuthUser projection below.
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  // Restore once per mount. session.restore() never throws — any failure is
  // simply "no session" (clean token state) and the Guard sends the actor to
  // /login. ready stays false meanwhile so nothing protected flashes.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const u = await session.restore();
      if (!alive) return;
      setUser(u);
      setReady(true);
    })();
    return () => { alive = false; };
  }, []);

  // The http client evicts provably-dead sessions (expired refresh cookie);
  // mirror that here so the Guard routes to /login immediately.
  useEffect(() => onForceLogout(() => { setUser(null); }), []);

  const login = useCallback(async (username: string, password: string, rememberMe = false) => {
    // session.login throws ApiError on bad credentials — surfaced verbatim
    // (backend Arabic message) through the Login screen's error line.
    const u = await session.login(username, password, rememberMe);
    setUser(u);
  }, []);
  const logout = useCallback(async () => {
    await session.logout();
    setUser(null);
  }, []);
  const refresh = useCallback(async () => {
    // /me with silent refresh on 401 (withAuthRetry); a failure means the
    // session is genuinely gone — drop local state, Guard takes over.
    try {
      setUser(await session.me());
    } catch {
      setUser(null);
    }
  }, []);

  const value = useMemo<HttpAuth>(() => ({
    mode: 'http',
    ready,
    user: user ? { id: user.id, name: user.fullName, role: user.roleName } : null,
    login,
    logout,
    refresh,
    can: (...p) => !!user && p.some((x) => user.permissions.includes(x)),
  }), [user, ready, login, logout, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const AuthProvider = ({ children }: { children: ReactNode }) =>
  adapterMode === 'http' ? <HttpAuthCore>{children}</HttpAuthCore> : <FixtureAuthCore>{children}</FixtureAuthCore>;
