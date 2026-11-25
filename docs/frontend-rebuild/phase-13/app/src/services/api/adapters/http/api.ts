// Real HTTP adapter (Phase 13 — slice 1). Satisfies the SAME `ApiAdapter`
// surface the fixture adapter defines, selected by the facade (../index.ts)
// through API_MODE — never imported by screens directly.
//
// WIRED in this slice (verified backend contracts, no invented endpoints):
//   · mrApi.projects        → GET  /api/projects        (paged; pageSize=1000)
//   · mrApi.createProject   → POST /api/projects        (projects.create)
//   · mrApi.updateProject   → PUT  /api/projects/:id    (projectSchema.partial())
//   · session helpers       → see ./session.ts (auth provider uses it directly)
//   · boqTotal              → pure arithmetic on the audited BOQ shape
//   · itemName/whName/projName → client-side name caches (./names.ts)
//   · canProject            → session permission check (scoping is
//                             server-enforced per request, never faked client-side)
//   · MR_STATUSES / EMAIL_RE → contract constants (re-exported from the
//                             fixture adapter — constants only, no live data)
//
// Everything else (mockApi/stockApi/boqApi/ipcApi/userApi/reportApi/lookups)
// fails EXPLICITLY with a "not wired yet" error via a Proxy filler — a future
// slice wires each namespace against its verified backend routes; no silent
// mock fallback ever happens in http mode.

import type { ApiAdapter } from '../../index';
import { http, ApiError } from './client';
import type { Paged } from './client';
import { getSessionUser } from './session';
import { itemName, names, projName, whName } from './names';
import { EMAIL_RE, MR_STATUSES } from '../mock/api';
import type { BoqItem, Project } from '../mock/data';

/* ---------- explicit not-wired failure (never a silent fallback) ---------- */

const notWired = (ns: string): Error =>
  new Error(
    `[http adapter] '${ns}' is not wired yet — Phase 13 slice 1 covers the real session and the Projects vertical only. ` +
      'This domain fails explicitly instead of falling back to fixtures.',
  );
/** Synchronous throw: explicit whether the caller awaits it inside try/catch
    (error state) or calls it bare (ErrorBoundary) — never a silently-wrong
    value like a Promise landing where an array was expected. */
const unwiredNamespace = (ns: string) => () => {
  throw notWired(ns);
};

/* ---------- verified backend row shape (project.repository.ts) ---------- */

/** Structural projection of the real GET/POST /api/projects row as produced by
    the backend repository (camelCase; code/name/contractNo are aliased on the
    fixture side as projectCode/projectName/contractNumber). Kept local on
    purpose — the phase-13 app does not depend on the @cos/shared workspace
    package; this shape was verified against apps/api source. */
interface BackendProject {
  id: string;
  projectCode: string;
  projectName: string;
  client: string;
  owner: string;
  mainContractor: string;
  siteLocation: string;
  region?: string;
  contractNumber: string;
  contractValue?: number;
  startDate?: string;
  endDate?: string;
  status: Project['status'];
  role?: Project['role'];
  notes?: string;
}

/* ---------- row mapping (fixture alias ↔ backend column names) ---------- */

const toMockProject = (p: BackendProject): Project => ({
  id: p.id,
  code: p.projectCode,
  name: p.projectName,
  client: p.client,
  owner: p.owner,
  status: p.status,
  region: p.region ?? '',
  contractNo: p.contractNumber,
  ...(p.contractValue !== undefined ? { contractValue: p.contractValue } : {}),
  ...(p.mainContractor ? { mainContractor: p.mainContractor } : {}),
  ...(p.siteLocation ? { siteLocation: p.siteLocation } : {}),
  ...(p.startDate ? { startDate: p.startDate } : {}),
  ...(p.endDate ? { endDate: p.endDate } : {}),
  ...(p.role ? { role: p.role } : {}),
  ...(p.notes ? { notes: p.notes } : {}),
});

const toBackendPatch = (patch: Partial<Omit<Project, 'id'>>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  if (patch.code !== undefined) out.projectCode = patch.code;
  if (patch.name !== undefined) out.projectName = patch.name;
  if (patch.client !== undefined) out.client = patch.client;
  if (patch.owner !== undefined) out.owner = patch.owner;
  if (patch.mainContractor !== undefined) out.mainContractor = patch.mainContractor;
  if (patch.siteLocation !== undefined) out.siteLocation = patch.siteLocation;
  if (patch.region !== undefined) out.region = patch.region;
  if (patch.contractNo !== undefined) out.contractNumber = patch.contractNo;
  if (patch.contractValue !== undefined) out.contractValue = patch.contractValue;
  if (patch.startDate !== undefined) out.startDate = patch.startDate;
  if (patch.endDate !== undefined) out.endDate = patch.endDate;
  if (patch.role !== undefined) out.role = patch.role;
  if (patch.notes !== undefined) out.notes = patch.notes;
  if (patch.status !== undefined) out.status = patch.status;
  return out;
};

/** Map a thrown transport error onto the fixture CRUD result contract
    ({ok:false, code, error}) so screens keep their existing errText flow. */
const asCrudFailure = (e: unknown): { ok: false; code: number; error: string } => {
  if (e instanceof ApiError) return { ok: false as const, code: e.status, error: e.message };
  const message = e instanceof Error ? e.message : String(e);
  return { ok: false as const, code: 0, error: message };
};

/* ---------- wired domains ---------- */

export const mrApi = {
  /** GET /api/projects — backend-scoped to the caller's visible projects
      (server-enforced). One page at pageSize=1000 covers the selector-scale
      lists the fixtures modeled; total is returned by the backend and the
      names cache is seeded from the response for projName(). */
  async projects(_actorId?: string): Promise<Project[]> {
    const page = await http.get<Paged<BackendProject>>('/api/projects?page=1&pageSize=1000');
    const mapped = page.items.map(toMockProject);
    names.seedProjects(mapped);
    return mapped;
  },

  /** POST /api/projects — requires `projects.create` server-side. Maps the
      fixture aliases (code/name/contractNo) onto the audited zod schema's
      field names; backend validation errors surface verbatim (Arabic message
      + zod issues) as ApiError → ok:false with the HTTP status code. */
  async createProject(
    d: { code: string; name: string; status: Project['status'] } &
      Partial<Omit<Project, 'id' | 'code' | 'name' | 'status'>>,
    _actorId?: string,
  ) {
    try {
      const created = await http.post<BackendProject>('/api/projects', toBackendPatch(d));
      names.seedProjects([toMockProject(created)]);
      return { ok: true as const, project: toMockProject(created) };
    } catch (e) {
      return asCrudFailure(e);
    }
  },

  /** PUT /api/projects/:id — partial patch of the audited schema; absent
      fields are omitted (the backend leaves those columns untouched). */
  async updateProject(id: string, patch: Partial<Omit<Project, 'id'>>, _actorId?: string) {
    try {
      const updated = await http.put<BackendProject>(`/api/projects/${encodeURIComponent(id)}`, toBackendPatch(patch));
      names.seedProjects([toMockProject(updated)]);
      return { ok: true as const };
    } catch (e) {
      return asCrudFailure(e);
    }
  },

  list: unwiredNamespace('mrApi.list') as never,
  get: unwiredNamespace('mrApi.get') as never,
  create: unwiredNamespace('mrApi.create') as never,
  act: unwiredNamespace('mrApi.act') as never,
  issue: unwiredNamespace('mrApi.issue') as never,
  remove: unwiredNamespace('mrApi.remove') as never,
};

/** Compact name helpers over the seeded caches. Unknown ids render as the raw
    id — an honest placeholder, never an invented name. */
export { itemName, whName, projName };

/** Session permission check. Project scoping itself (which projects an actor
    may see) is enforced server-side on every request — the client only gates
    UI affordances by the permission list the server returned. */
export const canProject = (_actorId: string | undefined, key: string, _projectId: string) => {
  const u = getSessionUser();
  return !!u && u.permissions.includes(key);
};

/** Pure arithmetic on the audited BOQ line — identical to the fixture's. */
export const boqTotal = (b: BoqItem) => b.quantity * b.unitPrice;

/** Failure-injection hook is a fixture-mode capability; in http mode it is an
    honest no-op (a production transport has no injectable failures). */
export const __protoFail = {
  failNext(_op: string, _message?: string) {
    /* no-op in http mode */
  },
  clear() {
    /* no-op in http mode */
  },
};

/* ---------- fixture-mode test hooks stay out of http mode ---------- */
// (mock/api.ts exposes window.__protoTestHooks only when VITE_PROTOTYPE=1.)

/* ---------- the adapter object ---------- */

const base = {
  mrApi,
  itemName,
  whName,
  projName,
  canProject,
  boqTotal,
  __protoFail,
  MR_STATUSES,
  EMAIL_RE,
} satisfies Partial<ApiAdapter>;

/**
 * Full-surface adapter: known properties come from `base`; EVERY other
 * property access (mockApi/stockApi/boqApi/ipcApi/userApi/reportApi/lookups —
 * present or future) yields an async function that rejects with the explicit
 * not-wired error. The Proxy keeps the surface type-checked through
 * `satisfies Partial<ApiAdapter>` here plus the facade's `as typeof
 * mockAdapter` selection, without 60 hand-written throwing stubs.
 */
export const httpApi = new Proxy(base, {
  get(target, prop) {
    if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
    if (typeof prop === 'string') return unwiredNamespace(prop);
    return undefined;
  },
}) as unknown as ApiAdapter;
