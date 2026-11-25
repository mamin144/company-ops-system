// Shared HTTP transport scaffold for the future real API adapter (Phase 5+).
// NOT wired into any screen yet — the prototype build runs on the isolated
// mock adapter. The helpers below define the pattern every feature adapter
// must use so that HTTP/network concerns are implemented exactly once.
//
// Design notes (kept honest, no invented endpoints):
// · No credentials or secrets live in frontend source; session handling stays
//   with the existing auth mechanism.
// · Timeouts/cancellation are opt-in per call (`timeoutMs`, cross-referenced
//   with AbortSignal support in the eventual feature adapters).
// · Error normalization contract lives in ../errors.ts.

import { API_BASE_URL } from './configuration';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** JSON body (adapter serializes; transport does not mutate). */
  body?: unknown;
  /** Optional fetch signal for cancellation (e.g. route changes). */
  signal?: AbortSignal;
  /** Per-call timeout in ms; no global default is imposed yet. */
  timeoutMs?: number;
}

const joinUrl = (path: string) => (path.startsWith('http') ? path : API_BASE_URL.replace(/\/$/, '') + (path.startsWith('/') ? '' : '/') + path);

/**
 * Fetch helper: network/HTTP failures must be normalized through
 * `toApiError` before they ever reach a component. Preview-level validation
 * errors (4xx bodies) are passed through as data, not thrown semantics.
 */
export const httpRequest = async <T>(path: string, opts: RequestOptions = {}): Promise<T> => {
  const ctrl = opts.timeoutMs ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), opts.timeoutMs) : null;
  try {
    const res = await fetch(joinUrl(path), {
      method: opts.method ?? 'GET',
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal ?? ctrl?.signal,
    });
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status, response: res });
    return (await res.json()) as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/** Re-exported for the eventual adapter's use. */
export { API_BASE_URL };
