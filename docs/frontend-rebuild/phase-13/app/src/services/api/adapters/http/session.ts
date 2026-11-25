// Real session operations (Phase 13) against the VERIFIED backend auth
// contract (apps/api/src/modules/auth/auth.routes.ts — read, never invented):
//   · POST /api/auth/login  {username, password, rememberMe?}
//       → {sessionId, accessToken, expiresIn, user: SafeUser & {permissions}}
//   · POST /api/auth/refresh (HttpOnly cos_refresh cookie, path /api/auth)
//       → {sessionId, accessToken, expiresIn, user}
//   · GET  /api/auth/me → SafeUser & {permissions} (Bearer or cos_access cookie)
//   · POST /api/auth/logout → {ok:true} (revokes THIS device's session only)
// Access token: short-lived JWT, kept in memory + sessionStorage (client.ts);
// permissions come from the server's central resolver (role + overrides),
// never client-side claims — `can()` in the auth provider reads this list.
// Scoping (project visibility) is server-enforced per request; the client
// never fakes it.

import { ApiError, http, refreshSession, setAccessToken } from './client';

export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  roleName: string;
  isActive: boolean;
  permissions: string[];
}

/** Current identity for adapter helpers (canProject); set on login/restore/me. */
let currentUser: SessionUser | null = null;
export const setCurrentUser = (u: SessionUser | null) => {
  currentUser = u;
};
export const getSessionUser = (): SessionUser | null => currentUser;

interface AuthPayload {
  accessToken: string;
  user: SessionUser;
}

const adopt = (u: SessionUser): SessionUser => {
  setCurrentUser(u);
  return u;
};

export const session = {
  /** Credential login. Throws ApiError (401 with the backend's Arabic message)
      on bad credentials — the Login screen renders errText(err) directly. */
  async login(username: string, password: string, rememberMe = false): Promise<SessionUser> {
    const r = await http.post<AuthPayload>('/api/auth/login', { username, password, rememberMe });
    setAccessToken(r.accessToken);
    return adopt(r.user);
  },

  /** Current identity. 401 self-heals via withAuthRetry (silent refresh). */
  async me(): Promise<SessionUser> {
    const u = await http.get<SessionUser>('/api/auth/me');
    return adopt(u);
  },

  /** Restore a session on app start: the stored access token (or the HttpOnly
      refresh cookie) may still be valid; me() refreshes transparently on 401.
      Any failure → no session (clean token state), never a thrown error. */
  async restore(): Promise<SessionUser | null> {
    try {
      return await this.me();
    } catch (e) {
      setAccessToken(undefined);
      if (e instanceof ApiError && e.status !== 401) {
        // Non-auth failure (server down, 5xx): nothing to restore, but let the
        // console say why instead of pretending everything is fine.
        console.error('[session] restore failed:', e);
      }
      return null;
    }
  },

  /** Revoke THIS device's session. Best-effort: local state is cleared even
      when the network call fails (the refresh cookie is HttpOnly server
      state; a failed logout retry lands the user on Login anyway). */
  async logout(): Promise<void> {
    try {
      await http.post('/api/auth/logout');
    } catch {
      /* fall through — client-side session is dropped regardless */
    }
    setAccessToken(undefined);
    setCurrentUser(null);
  },

  /** Explicit silent-refresh probe (kept for the auth provider's refresh();). */
  async refresh(): Promise<boolean> {
    return refreshSession();
  },
};
