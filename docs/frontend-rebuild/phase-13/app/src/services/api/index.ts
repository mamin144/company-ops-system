// Explicit single import boundary for the API adapter surface (Phase 13).
// Screens import data access exclusively from '@/services/api' — never from
// ./adapters/ internals directly (documented exceptions: contract constants
// still read from adapters/mock/data by unmigrated screens; see the Phase 4
// report, "boundary warts").
//
// Transport selection (configuration.ts API_MODE):
//   · 'fixture' (VITE_PROTOTYPE=1) → the isolated mock adapter.
//   · 'http' (default)             → the real adapter (./adapters/http/).
// Both satisfy the same `ApiAdapter` type derived from the fixture surface,
// so swap-in remains a typecheck-guaranteed operation; unwired http domains
// fail explicitly (see adapters/http/api.ts), never silently.
//
// Mock isolation: the fixture adapter self-guards against production fixture
// builds with an import-time throw (adapters/mock/api.ts, prod+fixture). This
// facade deliberately has no try/catch to soften that guard.
import * as mockAdapter from './adapters/mock/api';
import { httpApi } from './adapters/http/api';
import { API_MODE } from './configuration';
import type { ApiMode } from './configuration';

export type ApiAdapter = typeof mockAdapter;
export type MockSurface = ApiAdapter;
/** Which transport the running app selected (fixture | http). */
export const adapterMode: ApiMode = API_MODE;

const adapter = API_MODE === 'http' ? httpApi : mockAdapter;

export const {
  mockApi, mrApi, boqApi, ipcApi, stockApi, userApi, reportApi,
  itemName, whName, projName, lookups, canProject, boqTotal,
  MR_STATUSES, EMAIL_RE, __protoFail,
} = adapter as typeof mockAdapter;

export type { AccessLevel, OverrideEffect } from './adapters/mock/api';
export type { ReportDef, ExportFormat, ExportFilter, ExportResult, StockFilter, MRAction } from './adapters/mock/api';
export type { SessionUser } from './adapters/http/session';
export { session } from './adapters/http/session';
export { onForceLogout } from './adapters/http/client';
export { API_MODE, FIXTURE_MODE, IS_PROTOTYPE, API_BASE_URL } from './configuration';
export type { ApiMode } from './configuration';
