import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { userApi } from '@/services/api';
import type { MockUser } from '@/services/api/adapters/mock/data';

// Mock-only auth. Demo login maps each role to a DISTINCT mock user record so
// self-denial can actually be tested (the actor has an identity independent
// of the managed account). Effective permissions = role base + overrides
// (explicit DENY beats GRANT), read live from the mock store on every call.
export type DemoRole = 'admin' | 'manager' | 'warehouse' | 'viewer' | 'technical';
const ROLE_USER: Record<DemoRole, string> = { admin: 'mu-1', manager: 'mu-7', warehouse: 'mu-2', viewer: 'mu-4', technical: 'mu-3' };
/** Order of the demo login tiles. Display copy lives in i18n (see Login.tsx). */
export const DEMO_ROLES: DemoRole[] = ['admin', 'manager', 'warehouse', 'viewer', 'technical'];
/** @deprecated display copy moved to i18n; kept only so nothing imports a label map. */
export const ROLE_AR: Record<DemoRole, string> = { admin: 'مدير (تجريبي)', manager: 'إدارة (تجريبي)', warehouse: 'مخازن (تجريبي)', viewer: 'مشاهد (تجريبي)', technical: 'فني (تجريبي)' };

interface SessionUser { id: string; name: string; role: MockUser['role'] }
interface Auth {
  user: SessionUser | null;
  login: (r: DemoRole) => void;
  logout: () => void;
  refresh: () => void;
  can: (...permissions: string[]) => boolean;
}
const Ctx = createContext<Auth>({ user: null, login: () => {}, logout: () => {}, refresh: () => {}, can: () => false });
export const useAuth = () => useContext(Ctx);

const readSession = (): SessionUser | null => {
  try {
    const raw = sessionStorage.getItem('cos-proto-user');
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch { return null; }
};

/* Phase 5: session restoration is VALIDATED at state-initialization time, not
   just read. A session id that no longer resolves to a live user record
   (mocked "account deleted / session expired") is treated as invalid and
   never restored — so the Guard redirects to /login on the very first render
   and no protected content is briefly exposed. Storage cleanup happens in
   the mount effect via refresh(). */
const readSessionValidated = (): SessionUser | null => {
  const s = readSession();
  if (!s) return null;
  return userApi.get(s.id) ? s : null;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<SessionUser | null>(readSessionValidated);

  const login = useCallback((r: DemoRole) => {
    const rec = userApi.get(ROLE_USER[r]);
    const u: SessionUser = rec
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

  const value = useMemo<Auth>(() => ({
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
