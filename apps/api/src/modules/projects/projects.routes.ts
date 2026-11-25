import { Router } from 'express';
import { projectSchema } from './projects.validators.js';
import { projectRepository } from '../../repositories/project.repository.js';
import { applyPagination, applySearch, applySort } from '../../services/filter.service.js';
import { excelService } from '../../services/excel.service.js';
import { requireAuth, requirePermission, requireProjectAccess, requestContext } from '../../middleware/auth.js';
import type { AuthedRequest } from '../../middleware/auth.js';
import { scopeProjectRow, filterVisible, grantProjectAccess } from '../../services/projectScope.js';
import { can } from '../../services/authorization.service.js';
import { auditService } from '../../services/audit.service.js';
import { numericOrUnavailable, unavailable, sumOrZero } from '../../services/financials.service.js';
import { pool } from '../../database/connection.js';

import { boqRouter } from './boq.routes.js';
import { ipcRouter } from './ipc.routes.js';

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.use('/:projectId/boq', boqRouter);
projectsRouter.use('/:projectId/ipcs', ipcRouter);

/**
 * Legacy cross-project financial table. Kept for compatibility but now:
 * - scoped to the caller's member projects (NONE rows excluded),
 * - excludes logically deleted projects (O12),
 * - never reports a NULL contractValue as 0 (O2).
 */
projectsRouter.get('/financials', requirePermission('projects.view'), async (req: AuthedRequest, res) => {
  const ctx = await requestContext(req);

  const query = `
    SELECT 
      p.id as "projectId", p.project_code as "projectCode", p.project_name as "projectName", 
      p.client, p.owner, p.contract_number as "contractNumber", p.site_location as "siteLocation",
      p.region, p.status, p.contract_value as "contractValue",
      COALESCE((SELECT SUM(total_price) FROM boq_items WHERE project_id = p.id), 0) as "boqTotal",
      -- Executed totals count APPROVED IPCs only (business rule); the full
      -- ipcs array below stays complete for columns, filters and counts.
      COALESCE((SELECT SUM(net_amount) FROM ipcs WHERE project_id = p.id AND status = 'approved'), 0) as "executedTotal",
      COALESCE((SELECT SUM(deductions) FROM ipcs WHERE project_id = p.id AND status = 'approved'), 0) as "executedDeductions",
      COALESCE(
        (SELECT json_agg(json_build_object(
          'id', i.id, 'ipcNumber', i.ipc_number, 'netAmount', i.net_amount, 'deductions', i.deductions, 'status', i.status, 'date', i.date
        ) ORDER BY i.ipc_number) FROM ipcs i WHERE i.project_id = p.id),
        '[]'::json
      ) as ipcs,
      COALESCE(
        (SELECT json_agg(json_build_object(
          'id', d.id, 'title', d.title, 'category', d.category, 'documentType', d.document_type, 'fileName', d.file_name, 'filePath', d.file_path, 'ipcId', d.ipc_id
        )) FROM documents d WHERE d.project_id = p.id AND d.category IN ('عقد', 'مقايسة', 'مستخلص', 'استقطاع', 'خطاب', 'موافقات أمنية', 'محضر استلام', 'ضمان بنكي')),
        '[]'::json
      ) as "linkedDocs"
    FROM projects p
    WHERE p.deleted_at IS NULL
    ORDER BY p.owner, p.region, p.project_code;
  `;
  const result = await pool.query(query);
  const scoped = filterVisible(ctx, result.rows, (r: any) => r.projectId, 'projects.view');
  res.json(scoped.map((row: any) => ({
    ...row,
    contractValue: numericOrUnavailable(row.contractValue, 'NOT_ENTERED'),
  })));
});

projectsRouter.get('/', requirePermission('projects.view'), async (req: AuthedRequest, res) => {
  // Phase 5: backend-scoped to member projects (NONE rows excluded).
  const ctx = await requestContext(req);
  const includeDeleted = String(req.query.includeDeleted ?? '') === 'true';

  // O12: seeing deleted rows is an explicit privileged view. Global gate
  // first, then per-project DELETE access for each deleted row.
  if (includeDeleted && !can(ctx, 'projects.delete')) {
    return res.status(403).json({ message: 'ليس لديك صلاحية: projects.delete' });
  }

  let rows = includeDeleted
    ? await projectRepository.listIncludingDeleted()
    : await projectRepository.list();

  if (includeDeleted) {
    // You may only observe a deleted project you are entitled to delete.
    rows = rows.filter((p) => !p.deletedAt || can(ctx, 'projects.delete', p.id));
  }

  const items = applySort(
    applySearch(filterVisible(ctx, rows, (p) => p.id, 'projects.view'), String(req.query.q ?? ''), ['projectCode', 'projectName', 'client', 'mainContractor']),
    String(req.query.sortBy ?? 'updatedAt'),
    (req.query.sortDir as 'asc' | 'desc') ?? 'desc',
  );
  res.json(applyPagination(items, Number(req.query.page ?? 1), Number(req.query.pageSize ?? 20)));
});

projectsRouter.get('/export/xlsx', requirePermission('reports.view'), async (req: AuthedRequest, res) => {
  // WP-2.5: exports must honour project scope, never dump every project.
  const ctx = await requestContext(req);
  const rows = filterVisible(ctx, await projectRepository.list(), (p) => p.id, 'reports.view');
  const buffer = excelService.exportJson(rows, 'Projects');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=projects.xlsx');
  res.send(buffer);
});

projectsRouter.get('/:id/members', requireProjectAccess('projects.access', scopeProjectRow(), { hideExistence: true }), async (req, res) => {
  const project = await projectRepository.findById(String(req.params.id));
  if (!project) return res.status(404).json({ message: 'المشروع غير موجود' });
  const rows = await pool.query(
    `SELECT m.user_id, m.access, u.username, u.full_name
     FROM project_members m JOIN users u ON u.id = m.user_id
     WHERE m.project_id = $1 ORDER BY u.username`,
    [project.id],
  );
  res.json(rows.rows.map((r: { user_id: string; access: string; username: string; full_name: string }) => ({
    userId: r.user_id, username: r.username, fullName: r.full_name, access: r.access,
  })));
});

/**
 * Phase 14 §6.1 — project-scoped financials.
 * Derived totals (BOQ Σ, approved IPC Σ) are real sums; deferred/undefined
 * money is explicit `unavailable`, never 0.
 */
projectsRouter.get('/:id/financials', requireProjectAccess('projects.view', scopeProjectRow(), { hideExistence: true }), async (req, res) => {
  const item = await projectRepository.findById(String(req.params.id));
  if (!item) return res.status(404).json({ message: 'المشروع غير موجود' });
  if (item.deletedAt) {
    const ctx = await requestContext(req as AuthedRequest);
    if (!can(ctx, 'projects.delete', item.id)) return res.status(404).json({ message: 'المشروع غير موجود' });
  }

  const totals = await pool.query(
    `SELECT
       COALESCE((SELECT SUM(total_price) FROM boq_items WHERE project_id = $1), 0) AS boq_total,
       COALESCE((SELECT SUM(net_amount) FROM ipcs WHERE project_id = $1 AND status = 'approved'), 0) AS approved_ipc_total`,
    [item.id],
  );
  const row = totals.rows[0] ?? {};

  res.json({
    project: {
      id: item.id,
      projectCode: item.projectCode,
      contractValue: numericOrUnavailable(item.contractValue, 'NOT_ENTERED'),
    },
    boqTotal: sumOrZero(row.boq_total),
    approvedIpcTotal: sumOrZero(row.approved_ipc_total),
    payments: unavailable('PAYMENTS_DEFERRED'),
    tax: unavailable('TAX_RULES_UNDEFINED'),
    retention: unavailable('RETENTION_RULES_UNDEFINED'),
    advance: unavailable('ADVANCE_RULES_UNDEFINED'),
  });
});

projectsRouter.get('/:id', requireProjectAccess('projects.view', scopeProjectRow(), { hideExistence: true }), async (req: AuthedRequest, res) => {
  const item = await projectRepository.findById(String(req.params.id));
  if (!item) return res.status(404).json({ message: 'المشروع غير موجود' });
  // O12: a deleted project is invisible unless the caller may also delete it.
  if (item.deletedAt) {
    const ctx = await requestContext(req);
    if (!can(ctx, 'projects.delete', item.id)) {
      return res.status(404).json({ message: 'المشروع غير موجود' });
    }
  }
  res.json(item);
});

projectsRouter.post('/', requirePermission('projects.create'), async (req: AuthedRequest, res) => {
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'بيانات المشروع غير صالحة', issues: parsed.error.flatten() });
  const created = await projectRepository.create({ ...parsed.data, createdBy: req.user!.username });
  auditService.log(req, 'create', 'project', created.id, undefined, created);
  // Phase 5 §6: creator auto-grant DELETE (best-effort after a successful
  // create — a failure here never rolls back the project; an admin repairs
  // access via the project-access API).
  try {
    await grantProjectAccess(created.id, req.user!.id, 'DELETE', req.user!.username);
    auditService.log(req, 'project-access-grant', 'project', created.id, undefined, { userId: req.user!.id, access: 'DELETE' });
  } catch (e) {
    auditService.log(req, 'project-access-grant-failed', 'project', created.id, undefined, { error: e instanceof Error ? e.message : String(e) });
  }
  res.status(201).json(created);
});

projectsRouter.put('/:id', requireProjectAccess('projects.edit', scopeProjectRow()), async (req: AuthedRequest, res) => {
  const parsed = projectSchema.partial().safeParse(req.body);
  if(!parsed.success) return res.status(400).json({ message: 'بيانات المشروع غير صالحة', issues: parsed.error.flatten() });
  const existing = await projectRepository.findById(String(req.params.id));
  if(!existing) return res.status(404).json({ message: 'المشروع غير موجود' });
  // O12: editing a logically deleted project is rejected until restored.
  if (existing.deletedAt) return res.status(409).json({ message: 'المشروع محذوف، استعده أولًا', code: 'PROJECT_DELETED' });
  const updated = await projectRepository.update(existing.id, parsed.data);
  auditService.log(req, 'update', 'project', existing.id, existing, updated);
  res.json(updated);
});

/**
 * O12 — logical delete. Children (sites/BOQ/IPCs/documents/warehouses/stock)
 * are preserved; no cascade, no physical removal. Linked children are NOT a
 * blocker (14B-01 §3.6: warning-only).
 */
projectsRouter.delete('/:id', requireProjectAccess('projects.delete', scopeProjectRow()), async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const existing = await projectRepository.findById(id);
  if (!existing || existing.deletedAt) return res.status(404).json({ message: 'المشروع غير موجود' });
  const deleted = await projectRepository.softDelete(id, req.user!.id);
  if (!deleted) return res.status(404).json({ message: 'المشروع غير موجود' });
  auditService.log(req, 'delete', 'project', id, existing, { deletedAt: deleted.deletedAt, deletedBy: deleted.deletedBy });
  res.status(204).end();
});

/** O12 restore — carrier: projects.delete + project DELETE access. */
projectsRouter.post('/:id/restore', requireProjectAccess('projects.delete', scopeProjectRow(), { hideExistence: true }), async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const existing = await projectRepository.findById(id);
  if (!existing) return res.status(404).json({ message: 'المشروع غير موجود' });
  if (!existing.deletedAt) return res.status(409).json({ message: 'المشروع غير محذوف', code: 'PROJECT_NOT_DELETED' });
  const restored = await projectRepository.restore(id);
  if (!restored) return res.status(404).json({ message: 'المشروع غير موجود' });
  auditService.log(req, 'restore', 'project', id, { deletedAt: existing.deletedAt, deletedBy: existing.deletedBy }, { deletedAt: null, deletedBy: null });
  res.json(restored);
});
