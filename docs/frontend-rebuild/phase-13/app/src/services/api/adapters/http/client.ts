// HTTP transport (Phase 13) — ported from the verified legacy app
// `apps/web/src/lib/api.ts` (read in full; behavior preserved). One transport,
// implemented exactly once:
//   · Short-lived access token kept in memory (+ sessionStorage so a normal
//     reload works without touching long-lived storage). LAZY init on first
//     browser access — importing this module in node (isolation probe) must
//     not touch `sessionStorage`.
//   · Persistence across browser restarts handled ONLY by the HttpOnly refresh
//     cookie — no long-lived secrets in localStorage.
//   · On 401 → silent refresh → retry once; refresh failure → force-logout
//     event (`cos:force-logout`) so the auth provider drops the user.
//   · 400/403/404/409/500 never redirect; they surface as ApiError with
//     `.status`, and `.error` carries the backend `message` so `errText`
//     (shared/ui) renders it.
// Endpoints are NOT invented here — feature files under ./ use the verified
// backend routes only (auth/*, projects).

import { API_BASE_URL } from '../../configuration';

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public issues?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/* Node-safe lazy token storage: `sessionStorage` exists only in browsers. */
let accessToken: string | null = null;
let tokenLoaded = false;
const ssGet = (): string | null => {
  try {
    return typeof window !== 'undefined' && window.sessionStorage
      ? window.sessionStorage.getItem('cos_at')
      : null;
  } catch {
    return null;
  }
};

export const setAccessToken = (t?: string | null) => {
  accessToken = t ?? null;
  tokenLoaded = true;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (t) window.sessionStorage.setItem('cos_at', t);
      else window.sessionStorage.removeItem('cos_at');
    }
  } catch {
    /* storage unavailable — in-memory token still works for this page */
  }
};

export const getAccessToken = () => {
  if (!tokenLoaded) {
    accessToken = ssGet();
    tokenLoaded = true;
  }
  return accessToken;
};

const FORCE_LOGOUT_EVENT = 'cos:force-logout';
export const onForceLogout = (fn: () => void) => {
  window.addEventListener(FORCE_LOGOUT_EVENT, fn);
  return () => window.removeEventListener(FORCE_LOGOUT_EVENT, fn);
};
const forceLogout = () => {
  setAccessToken(undefined);
  window.dispatchEvent(new Event(FORCE_LOGOUT_EVENT));
};

/** Try to renew the access token using the HttpOnly refresh cookie.
    Single-flight: concurrent 401s share one refresh request. */
export async function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch(joinUrl('/api/auth/refresh'), { method: 'POST', credentials: 'include' });
      if (!res.ok) return false;
      const body = (await res.json()) as { accessToken?: string };
      if (!body.accessToken) return false;
      setAccessToken(body.accessToken);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshPromise = null), 0);
    }
  })();
  return refreshPromise;
}
let refreshPromise: Promise<boolean> | null = null;

const joinUrl = (path: string) =>
  path.startsWith('http') ? path : API_BASE_URL.replace(/\/$/, '') + path;

const buildHeaders = (init?: RequestInit): Headers => {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type') && init?.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getAccessToken();
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  return headers;
};

const rawFetch = (path: string, init?: RequestInit): Promise<Response> =>
  fetch(joinUrl(path), { ...init, headers: buildHeaders(init), credentials: 'include' });

/** One retry after a successful refresh; otherwise force-logout and surface
    the original (still-401) response so callers render an error state. */
const withAuthRetry = async (doFetch: () => Promise<Response>): Promise<Response> => {
  let res = await doFetch();
  if (res.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) res = await doFetch();
    else forceLogout();
  }
  return res;
};

const parseError = async (res: Response): Promise<ApiError> => {
  let message = `خطأ من الخادم (HTTP ${res.status})`;
  let issues: unknown;
  try {
    const body = (await res.json()) as { message?: string; issues?: unknown };
    message = body.message ?? message;
    issues = body.issues;
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(message, res.status, issues);
};

const request = async <T>(method: string, path: string, init?: RequestInit): Promise<T> => {
  const res = await withAuthRetry(() => rawFetch(path, { ...init, method }));
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
};

/** Minimal fetch surface used by ./api.ts and ./session.ts. */
export const http = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) =>
    request<T>('POST', path, { body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, { body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>('DELETE', path),
};

export { API_BASE_URL };
