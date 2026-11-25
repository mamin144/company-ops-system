// Adapter/diagnostic configuration (Phase 4 foundation).
// There is exactly ONE data transport in the running prototype: the isolated
// mock adapter under ./adapters/mock/. The real HTTP transport is a scaffold
// only (client.ts/errors.ts) and is NOT registered as a runtime adapter yet,
// because the Phase-1 API contract-map document was never produced — inventing
// endpoints here would violate the fixed rule "لا تخترع endpoints".
// When the contract map exists (Phase 5), a real adapter satisfies the same
// `ApiAdapter` type exported from ../index.ts and is selected here.

/** True only for the isolated prototype build flag (VITE_PROTOTYPE=1). */
export const IS_PROTOTYPE = import.meta.env.VITE_PROTOTYPE === '1';

/** Which transport the UI is running against. */
export const API_MODE: 'mock-prototype' | 'http' = IS_PROTOTYPE ? 'mock-prototype' : 'http';

/**
 * Base URL the future HTTP adapter will use. Deliberately NOT consumed by any
 * runtime code in Phase 4; the mock adapter ignores it. A production-oriented
 * build must never silently fall back to fixtures — the mock adapter guards
 * this with an import-time throw (see adapters/mock/api.ts).
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';
