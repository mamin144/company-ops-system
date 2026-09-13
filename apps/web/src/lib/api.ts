export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public issues?: unknown) {
    super(message);
  }
}

/* ------------------------------------------------------------------ *
 * Centralized authentication for every request in the app.
 * - Short-lived access token kept in memory (+ sessionStorage so a
 *   normal reload works without touching long-lived storage).
 * - Persistence across browser restarts is handled ONLY by the
 *   HttpOnly refresh cookie — no long-lived secrets in localStorage.
 * - On 401 TOKEN_EXPIRED → silent refresh → retry once.
 * - Refresh failure → force-logout event (Login screen).
 * - 400/403/404/409/500 never redirect to Login; they surface as
 *   ApiError with status so screens show proper error states.
 * ------------------------------------------------------------------ */

let accessToken: string | null = sessionStorage.getItem('cos_at');
let refreshPromise: Promise<boolean> | null = null;

export const setAccessToken = (t?: string | null) => {
  accessToken = t ?? null;
  if (t) sessionStorage.setItem('cos_at', t);
  else sessionStorage.removeItem('cos_at');
};

export const getAccessToken = () => accessToken;

const FORCE_LOGOUT_EVENT = 'cos:force-logout';
export const onForceLogout = (fn: () => void) => {
  window.addEventListener(FORCE_LOGOUT_EVENT, fn);
  return () => window.removeEventListener(FORCE_LOGOUT_EVENT, fn);
};
const forceLogout = () => {
  setAccessToken(undefined);
  window.dispatchEvent(new Event(FORCE_LOGOUT_EVENT));
};

/** Try to renew the access token using the HttpOnly refresh cookie. */
export async function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
      if (!res.ok) return false;
      const body = await res.json();
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

const buildHeaders = (init?: RequestInit): Headers => {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type') && init?.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${accessToken}`);
  return headers;
};

const rawFetch = (path: string, init?: RequestInit): Promise<Response> =>
  fetch(path, { ...init, headers: buildHeaders(init), credentials: 'include' });

/** One retry after a successful refresh; otherwise surfaces the original error. */
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
    const body = await res.json();
    message = body.message ?? message;
    issues = body.issues;
  } catch {
    /* non-JSON error */
  }
  return new ApiError(message, res.status, issues);
};

const request = async <T>(method: string, path: string, init?: RequestInit): Promise<T> => {
  const res = await withAuthRetry(() => rawFetch(path, { ...init, method }));
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return res.json();
};

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) =>
    request<T>('POST', path, { body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, { body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>('PATCH', path, { body: JSON.stringify(body ?? {}) }),
  del: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, form: FormData) => request<T>('POST', path, { body: form }),
};

/**
 * Authenticated file access as a Blob + temporary object URL.
 * Used for PDF/image previews and downloads because plain links cannot
 * carry Authorization headers — and we never expose unauthenticated URLs.
 */
/**
 * PREVIEW — authenticated fetch returning a validated Blob URL.
 *
 * Blob URLs are used (instead of pointing the iframe at the API URL) because
 * download-manager browser integrations (e.g. IDM) hijack direct file
 * requests and force downloads — while `blob:` URLs are invisible to them.
 * JSON error bodies and empty files are rejected so callers never render
 * garbage as a PDF/image.
 */
export const previewDocument = async (path: string): Promise<{ url: string; mimeType: string; size: number }> => {
  const res = await withAuthRetry(() => rawFetch(path));
  if (!res.ok) throw await parseError(res);
  const mimeType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!mimeType || mimeType === 'application/json')
    throw new ApiError('تعذر تحميل المستند للمعاينة.', res.status);
  const blob = await res.blob();
  if (blob.size === 0) throw new ApiError('الملف فارغ أو تالف', res.status);
  return { url: URL.createObjectURL(blob), mimeType, size: blob.size };
};

/**
 * DOWNLOAD — fetches the file and explicitly triggers a browser download via
 * a temporary <a download>. Completely independent from previewDocument().
 */
export const downloadDocument = async (path: string, fileName: string): Promise<void> => {
  const res = await withAuthRetry(() => rawFetch(path));
  if (!res.ok) throw await parseError(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
};

/**
 * Authenticated HEAD request — returns status + content type without
 * downloading the body. Used by DocumentPreviewModal to detect MIME type
 * before rendering the preview.
 */
export const downloadZip = async (path: string, fileName: string, body: unknown): Promise<void> => {
  const res = await withAuthRetry(() => rawFetch(path, { method: 'POST', body: JSON.stringify(body) }));
  if (!res.ok) throw await parseError(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
};

export const apiHead = async (path: string): Promise<{ ok: boolean; status: number; contentType: string | null }> => {
  const res = await withAuthRetry(() => rawFetch(path, { method: 'HEAD' }));
  return {
    ok: res.ok,
    status: res.status,
    contentType: (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase() || null,
  };
};

export const buildQuery = (params: Record<string, string | number | undefined>) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
};
