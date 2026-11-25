// Adapter/diagnostic configuration (Phase 13).
// Two transports share ONE `ApiAdapter` type (exported from ../index.ts):
//   · 'fixture' — the isolated mock adapter under ./adapters/mock/. Opt-in via
//     VITE_PROTOTYPE=1 only. A production-oriented fixture build is blocked by
//     the adapter's import-time guard (adapters/mock/api.ts).
//   · 'http' — the real transport under ./adapters/http/ against the verified
//     backend contract. This is the DEFAULT when the flag is absent, so a
//     plain build can never silently fall back to fixtures.
// Selection happens once, here; screens import from '../index' and never
// branch on the mode themselves (Login/AuthProvider are the only UI code that
// legitimately needs the mode — they import it from here).

/** True only for the isolated prototype build flag (VITE_PROTOTYPE=1). */
export const FIXTURE_MODE = import.meta.env.VITE_PROTOTYPE === '1';

/** Compatibility alias (router crash-probe + legacy docs references). */
export const IS_PROTOTYPE = FIXTURE_MODE;

/** Which transport the UI is running against. */
export type ApiMode = 'fixture' | 'http';
export const API_MODE: ApiMode = FIXTURE_MODE ? 'fixture' : 'http';

/**
 * Base URL the HTTP adapter uses. Callers pass full backend paths that already
 * start with "/api/…" (the legacy convention), so the default base is EMPTY —
 * same-origin requests, resolved by the vite dev/preview proxy or a reverse
 * proxy in deployment. Override with VITE_API_BASE_URL (e.g. the backend's
 * absolute origin) to bypass the proxy entirely. The fixture adapter ignores it.
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '';
