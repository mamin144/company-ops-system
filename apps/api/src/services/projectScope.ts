/**
 * Phase 5 — central project-scope resolution (Option A).
 *
 * The ONLY place that answers "which project does this request target?".
 * Rules:
 * - Row-backed resources resolve projectId from the DATABASE row, never
 *   from client input (IDOR-safe).
 * - Client-supplied projectIds (create bodies, list filters, nested params)
 *   are returned as-is; the authorization layer denies anything without a
 *   sufficient membership, so a forged id can only ever deny, never grant.
 * - Missing rows/projects resolve to { missing: true } (callers 404).
 * - Null projectId means global/unscoped (constraint does not apply).
 */
import type { Request } from 'express';
import { pool } from '../database/connection';
import { projectRepository } from '../repositories/project.repository';
import { documentRepository } from '../repositories/document.repository';
import { siteRepository } from '../repositories/site.repository';
import { warehouseRepository } from '../repositories/warehouse.repository';
import { materialRequestRepository } from '../repositories/material-request.repository';
import { can } from './authorization.service';
import type { AuthzContext, AccessLevel } from './authorization.service';

export type ScopeResolution = { projectId: string | null } | { missing: true };
export type ScopeResolver = (req: Request) => Promise<ScopeResolution>;

type RowWithProject = { projectId?: string | null };

const bodyPid = (req: Request, field = 'projectId'): string | null => {
  const v = (req.body as Record<string, unknown> | undefined)?.[field];
  return typeof v === 'string' && v ? v : null;
};

/** CREATE bodies and explicit filters: value used verbatim (deny-by-default). */
export const scopeFromBody = (field = 'projectId'): ScopeResolver => async (req) => ({
  projectId: bodyPid(req, field),
});

/** Nested collection param (e.g. /:projectId/boq): existence-verified. */
export const scopeFromParam = (param = 'projectId'): ScopeResolver => async (req) => {
  const v = (req.params as Record<string, unknown> | undefined)?.[param];
  if (typeof v !== 'string' || !v) return { missing: true };
  const project = await projectRepository.findById(v);
  if (!project) return { missing: true };
  return { projectId: project.id };
};

const scopeFromRow = (
  load: (id: string) => Promise<RowWithProject | undefined | null>,
  idParam = 'id',
): ScopeResolver => async (req) => {
  const v = (req.params as Record<string, unknown> | undefined)?.[idParam];
  if (typeof v !== 'string' || !v) return { missing: true };
  const row = await load(v);
  if (!row) return { missing: true };
  return { projectId: row.projectId ?? null };
};

export const scopeProjectRow = (idParam = 'id'): ScopeResolver => async (req) => {
  const v = (req.params as Record<string, unknown> | undefined)?.[idParam];
  if (typeof v !== 'string' || !v) return { missing: true };
  const project = await projectRepository.findById(v);
  if (!project) return { missing: true };
  return { projectId: project.id };
};
export const scopeDocumentRow = (idParam = 'id'): ScopeResolver =>
  scopeFromRow((id) => documentRepository.findById(id), idParam);
export const scopeSiteRow = (idParam = 'id'): ScopeResolver =>
  scopeFromRow((id) => siteRepository.findById(id), idParam);
export const scopeWarehouseRow = (idParam = 'id'): ScopeResolver =>
  scopeFromRow((id) => warehouseRepository.findById(id), idParam);
export const scopeMaterialRequestRow = (idParam = 'id'): ScopeResolver =>
  scopeFromRow((id) => materialRequestRepository.findById(id), idParam);

/**
 * List scoping without N+1: rows already carry projectId, memberships ride
 * on the cached request context. Bypass holders (projects.access) see all;
 * null-project rows stay visible under the global view key.
 */
export const filterVisible = <T>(
  ctx: AuthzContext | null,
  rows: T[],
  getPid: (r: T) => string | null | undefined,
  viewKey: string,
): T[] => {
  if (!ctx || !can(ctx, viewKey)) return [];
  if (can(ctx, 'projects.access')) return rows;
  const allowed = new Set(
    ctx.memberships.filter((m) => m.access !== 'NONE').map((m) => m.projectId),
  );
  return rows.filter((r) => {
    const pid = getPid(r);
    return !pid || allowed.has(pid);
  });
};

/** Explicit ?projectId= filter gate: inaccessible filter denies loudly. */
export const checkFilterProject = (
  ctx: AuthzContext | null,
  projectId: string | undefined,
  viewKey: string,
): boolean => {
  if (!projectId) return true;
  if (!ctx || !can(ctx, viewKey)) return false;
  if (can(ctx, 'projects.access')) return true;
  return ctx.memberships.some((m) => m.projectId === projectId && m.access !== 'NONE');
};

/** Creator auto-grant (idempotent; never downgrades an existing row). */
export const grantProjectAccess = async (
  projectId: string,
  userId: string,
  access: AccessLevel,
  createdBy: string,
): Promise<void> => {
  await pool.query(
    `INSERT INTO project_members (project_id, user_id, access, created_by)
     VALUES ($1, $2, $3, $4) ON CONFLICT (project_id, user_id) DO NOTHING`,
    [projectId, userId, access, createdBy],
  );
};
