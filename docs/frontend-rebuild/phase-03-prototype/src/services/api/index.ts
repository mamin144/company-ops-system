// Explicit single import boundary for the API adapter surface (Phase 4).
// Screens import data access exclusively from '@/services/api' — never from
// ./adapters/ internals directly (documented exceptions: contract constants
// still read from adapters/mock/data by unmigrated screens; see the Phase 4
// report, "boundary warts").
//
// Adapter contract: the eventual real HTTP adapter (Phase 5, once a verified
// contract map exists) MUST satisfy the exported `ApiAdapter` type derived
// below from the mock surface, so swap-in is a typecheck-guaranteed operation.
//
// Mock isolation: the adapter self-guards against production-oriented builds
// with an import-time throw (adapters/mock/api.ts). This facade deliberately
// has no try/catch to soften that guard.
import * as mockAdapter from './adapters/mock/api';

export type ApiAdapter = typeof mockAdapter;
export type MockSurface = ApiAdapter;
export const adapterMode: 'mock' = 'mock'; // fixed adapter mode; see ./configuration.ts API_MODE

export const {
  mockApi, mrApi, boqApi, ipcApi, stockApi, userApi, reportApi,
  itemName, whName, projName, lookups, canProject, boqTotal,
  MR_STATUSES, EMAIL_RE, __protoFail,
} = mockAdapter;

export type { AccessLevel, OverrideEffect } from './adapters/mock/api';
export type { ReportDef, ExportFormat, ExportFilter, ExportResult, StockFilter, MRAction } from './adapters/mock/api';
