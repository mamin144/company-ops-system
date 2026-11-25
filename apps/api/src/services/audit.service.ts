import type { Request } from 'express';
import { pool } from '../database/connection.js';
import { createId } from '../shared/id.js';
import { nowIso } from '../shared/time.js';
import { can } from './authorization.service.js';
import type { AuthzContext } from './authorization.service.js';
import type { AuthedRequest } from '../middleware/auth.js';

/**
 * Phase 14 O8 — audit trail.
 *
 * Rules enforced here:
 * - Every project-scoped event carries `project_id` so it can be filtered
 *   and authorized per project.
 * - Global events keep `project_id = NULL` and stay visible to global
 *   auditors (they are not project data).
 * - Reading is project-scoped: a caller only sees project events for
 *   projects they may view (deleted projects additionally require the
 *   delete gate, mirroring project visibility).
 * - Secrets are redacted deeply, at write time AND at read time (legacy
 *   rows predating the redaction rule are still protected on the way out).
 * - Pagination is done in SQL (LIMIT/OFFSET + COUNT) instead of loading the
 *   whole table into memory.
 */

/** Keys whose values must never reach the audit trail. */
const SECRET_KEY = /^(password|passwordhash|password_hash|token|accesstoken|access_token|refreshtoken|refresh_token|resettoken|reset_token|secret|apikey|api_key|authorization|cookie|credential|credentials)$/i;

const sanitizeDeep = (value: unknown, seen: WeakSet<object> = new WeakSet()): unknown => {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    return value.map((v) => sanitizeDeep(v, seen));
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEY.test(key) ? '[redacted]' : sanitizeDeep(v, seen);
    }
    return out;
  }
  return value;
};

const PROJECT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AuditFilters {
  entity?: string;
  action?: string;
  q?: string;
  /** O8: restrict to a single project. */
  projectId?: string;
  page?: number;
  pageSize?: number;
}

export class AuditService {
  async log(
    req: Request | AuthedRequest,
    action: string,
    entity: string,
    entityId?: string,
    oldValue?: unknown,
    newValue?: unknown,
    projectId?: string | null,
  ) {
    const user = (req as AuthedRequest).user;
    const resolvedProjectId = projectId !== undefined
      ? projectId
      : this.inferProjectId(entity, entityId, oldValue, newValue);
    const entry = {
      id: createId(),
      userId: user?.id || null,
      username: user?.username ?? 'anonymous',
      action,
      entity,
      entityId: entityId || null,
      projectId: resolvedProjectId ?? null,
      oldValue: sanitizeDeep(oldValue),
      newValue: sanitizeDeep(newValue),
      timestamp: nowIso(),
      ipAddress: req.ip || null,
    };

    await pool.query(
      `INSERT INTO audit_logs (id, user_id, username, action, entity, entity_id, project_id, old_value, new_value, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        entry.id,
        entry.userId,
        entry.username,
        entry.action,
        entry.entity,
        entry.entityId,
        entry.projectId,
        entry.oldValue === null || entry.oldValue === undefined ? null : JSON.stringify(entry.oldValue),
        entry.newValue === null || entry.newValue === undefined ? null : JSON.stringify(entry.newValue),
        entry.ipAddress,
        entry.timestamp,
      ],
    );
  }

  /**
   * Best-effort project attribution without extra queries: project events use
   * the project id as entityId; every other entity carries `projectId` in the
   * snapshot it already sends.
   */
  private inferProjectId(
    entity: string,
    entityId?: string,
    oldValue?: unknown,
    newValue?: unknown,
  ): string | null {
    if (entity === 'project' && entityId && PROJECT_ID_RE.test(entityId)) return entityId;
    for (const snapshot of [newValue, oldValue]) {
      if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
        const p = (snapshot as Record<string, unknown>).projectId;
        if (typeof p === 'string' && PROJECT_ID_RE.test(p)) return p;
      }
    }
    return null;
  }

  /** Kept for API compatibility with older call sites/tests. */
  private sanitize(value: unknown) {
    return sanitizeDeep(value);
  }

  /**
   * Projects whose audit rows the caller may read. Mirrors project listing
   * visibility: READ on live projects; a soft-deleted project's history is
   * only readable by someone entitled to delete it.
   */
  private async visibleProjectIds(ctx: AuthzContext | null): Promise<string[]> {
    if (!ctx) return [];
    if (can(ctx, 'projects.access')) {
      // Access administrators see every project (mirrors `can()` narrowing skip).
      const all = await pool.query(`SELECT id FROM projects`);
      return all.rows.map((r: { id: string }) => r.id);
    }
    const rows = await pool.query(`SELECT id, deleted_at FROM projects`);
    return rows.rows
      .filter((p: { id: string; deleted_at: string | null }) =>
        can(ctx, 'projects.view', p.id) && (!p.deleted_at || can(ctx, 'projects.delete', p.id)))
      .map((p: { id: string }) => p.id);
  }

  async list(filters: AuditFilters, ctx: AuthzContext | null) {
    const where: string[] = ['1=1'];
    const params: unknown[] = [];

    if (filters.entity) {
      params.push(filters.entity);
      where.push(`entity = $${params.length}`);
    }

    if (filters.action) {
      params.push(filters.action);
      where.push(`action = $${params.length}`);
    }

    if (filters.projectId) {
      params.push(filters.projectId);
      where.push(`project_id = $${params.length}`);
    }

    if (filters.q) {
      params.push(`%${filters.q}%`);
      where.push(`(username ILIKE $${params.length} OR action ILIKE $${params.length} OR entity ILIKE $${params.length} OR entity_id ILIKE $${params.length})`);
    }

    // O8 project-scope isolation: project rows only for visible projects;
    // NULL project_id rows are global events (never another project's data).
    const visible = await this.visibleProjectIds(ctx);
    params.push(visible);
    where.push(`(project_id IS NULL OR project_id = ANY($${params.length}::uuid[]))`);

    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(200, Math.max(1, filters.pageSize || 25));
    const whereSql = where.join(' AND ');

    const [countResult, rowsResult] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM audit_logs WHERE ${whereSql}`, params),
      pool.query(
        `SELECT * FROM audit_logs
          WHERE ${whereSql}
          ORDER BY created_at DESC, id DESC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pageSize, (page - 1) * pageSize],
      ),
    ]);

    return {
      items: rowsResult.rows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        username: row.username,
        action: row.action,
        entity: row.entity,
        entityId: row.entity_id,
        projectId: row.project_id ?? null,
        oldValue: sanitizeDeep(row.old_value),
        newValue: sanitizeDeep(row.new_value),
        timestamp: row.created_at,
        ipAddress: row.ip_address,
      })),
      total: countResult.rows[0]?.total ?? 0,
      page,
      pageSize,
    };
  }
}

export const auditService = new AuditService();
