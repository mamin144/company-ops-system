import { Router } from 'express';
import { z } from 'zod';
import { projectSchema } from './projects.validators';
import { projectRepository } from '../../repositories/project.repository';
import { boqRepository } from '../../repositories/boq.repository';
import { ipcRepository } from '../../repositories/ipc.repository';
import { applyPagination, applySearch, applySort } from '../../services/filter.service';
import { excelService } from '../../services/excel.service';
import { requireAuth, requirePermission, requireProjectAccess, requestContext } from '../../middleware/auth';
import type { AuthedRequest } from '../../middleware/auth';
import { scopeProjectRow, filterVisible, grantProjectAccess } from '../../services/projectScope';
import { auditService } from '../../services/audit.service';
import { deleteSafety } from '../../services/stock.service';
import { pool } from '../../database/connection';

import { boqRouter } from './boq.routes';
import { ipcRouter } from './ipc.routes';

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.use('/:projectId/boq', boqRouter);
projectsRouter.use('/:projectId/ipcs', ipcRouter);

projectsRouter.get('/financials', requirePermission('projects.view'), async (req, res) => {
  const { pool } = await import('../../database/connection');
  
  const query = `
    SELECT 
      p.id as "projectId", p.project_code as "projectCode", p.project_name as "projectName", 
      p.client, p.owner, p.contract_number as "contractNumber", p.site_location as "siteLocation",
      p.region, p.status,
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
    ORDER BY p.owner, p.region, p.project_code;
  `;
  const result = await pool.query(query);
  res.json(result.rows);
});

projectsRouter.get('/', requirePermission('projects.view'), async (req: AuthedRequest, res) => {
  // Phase 5: backend-scoped to member projects (NONE rows excluded).
  const ctx = await requestContext(req);
  const items = applySort(
    applySearch(filterVisible(ctx, await projectRepository.list(), (p) => p.id, 'projects.view'), String(req.query.q ?? ''), ['projectCode', 'projectName', 'client', 'mainContractor']),
    String(req.query.sortBy ?? 'updatedAt'),
    (req.query.sortDir as 'asc' | 'desc') ?? 'desc',
  );
  res.json(applyPagination(items, Number(req.query.page ?? 1), Number(req.query.pageSize ?? 20)));
});

projectsRouter.get('/export/xlsx', requirePermission('reports.view'), async (_req, res) => {
  const buffer = excelService.exportJson(await projectRepository.list(), 'Projects');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=projects.xlsx');
  res.send(buffer);
});

projectsRouter.get('/:id/members', requirePermission('projects.access'), async (req, res) => {
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

projectsRouter.get('/:id', requireProjectAccess('projects.view', scopeProjectRow(), { hideExistence: true }), async (req, res) => {
  const item = await projectRepository.findById(String(req.params.id));
  if (!item) return res.status(404).json({ message: 'المشروع غير موجود' });
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
  const updated = await projectRepository.update(existing.id, parsed.data);
  auditService.log(req, 'update', 'project', existing.id, existing, updated);
  res.json(updated);
});

projectsRouter.delete('/:id', requireProjectAccess('projects.delete', scopeProjectRow()), async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const existing = await projectRepository.findById(id);
  if (!existing) return res.status(404).json({ message: 'المشروع غير موجود' });
  const blocked = await deleteSafety.blockProject(id);
  if (blocked) {
    auditService.log(req, 'delete-blocked', 'project', id);
    return res.status(409).json({ message: blocked });
  }
  // Delete BOQ/IPC children in dependency order first: ipc_items RESTRICTs
  // boq_items deletion, so IPCs (which cascade their own items) must go
  // before BOQ items — otherwise the schema's CASCADE chain aborts with FK.
  // The whole sequence runs in ONE transaction: any failure rolls everything
  // back, so a project is never left partially deleted. No filesystem
  // operations are involved here (project documents are SET NULL, not removed).
  const [projectIpcs, projectBoq] = await Promise.all([
    ipcRepository.list(),
    boqRepository.list(),
  ]);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const ipc of projectIpcs.filter((i: any) => i.projectId === id)) {
      await ipcRepository.delete(ipc.id, client);
    }
    for (const item of projectBoq.filter((b: any) => b.projectId === id)) {
      await boqRepository.delete(item.id, client);
    }
    await projectRepository.delete(id, client);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  auditService.log(req, 'delete', 'project', id, existing);
  res.status(204).end();
});
