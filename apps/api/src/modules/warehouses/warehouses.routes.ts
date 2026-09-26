import { Router } from 'express';
import { warehouseRepository } from '../../repositories/warehouse.repository';
import { applyPagination, applySearch, applySort } from '../../services/filter.service';
import { warehouseSchema } from './warehouses.validators';
import { projectRepository } from '../../repositories/project.repository';
import { excelService } from '../../services/excel.service';
import { requireAuth, requirePermission, requireProjectAccess, requestContext } from '../../middleware/auth';
import type { AuthedRequest } from '../../middleware/auth';
import { scopeWarehouseRow, scopeFromBody, filterVisible, checkFilterProject } from '../../services/projectScope';
import { can } from '../../services/authorization.service';
import { auditService } from '../../services/audit.service';
import { deleteSafety } from '../../services/stock.service';

export const warehousesRouter = Router();
warehousesRouter.use(requireAuth);

warehousesRouter.get('/', requirePermission('warehouse.view'), async (req: AuthedRequest, res) => {
  // Phase 5: backend-scoped to member projects (null-project rows stay visible).
  const ctx = await requestContext(req);
  if (req.query.projectId && !checkFilterProject(ctx, String(req.query.projectId), 'warehouse.view'))
    return res.status(403).json({ message: 'ليس لديك صلاحية: warehouse.view' });
  let items = filterVisible(ctx, await warehouseRepository.list(), (item) => item.projectId, 'warehouse.view');
  items = applySearch(items, String(req.query.q ?? ''), ['code', 'name', 'location', 'notes']);
  if (req.query.projectId) items = items.filter((item) => item.projectId === String(req.query.projectId));
  if (req.query.type) items = items.filter((item) => item.type === String(req.query.type));
  res.json(
    applyPagination(
      applySort(items, String(req.query.sortBy ?? 'updatedAt'), (req.query.sortDir as 'asc' | 'desc') ?? 'desc'),
      Number(req.query.page ?? 1),
      Number(req.query.pageSize ?? 20),
    ),
  );
});

warehousesRouter.get('/export/xlsx', requirePermission('reports.view'), async (req: AuthedRequest, res) => {
  const ctx = await requestContext(req);
  const buffer = excelService.exportJson(filterVisible(ctx, await warehouseRepository.list(), (w) => w.projectId, 'warehouse.view'), 'Warehouses');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=warehouses.xlsx');
  res.send(buffer);
});

warehousesRouter.post('/', requireProjectAccess('warehouse.create', scopeFromBody()), async (req: AuthedRequest, res) => {
  const parsed = warehouseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'بيانات المخزن غير صالحة', issues: parsed.error.flatten() });
  const created = await warehouseRepository.create({ ...parsed.data, projectId: parsed.data.projectId || undefined, createdBy: req.user!.username });
  auditService.log(req, 'create', 'warehouse', created.id, undefined, created);
  res.status(201).json(created);
});

warehousesRouter.put('/:id', requireProjectAccess('warehouse.edit', scopeWarehouseRow()), async (req: AuthedRequest, res) => {
  const parsed = warehouseSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'بيانات المخزن غير صالحة', issues: parsed.error.flatten() });
  const existing = await warehouseRepository.findById(String(req.params.id));
  if (!existing) return res.status(404).json({ message: 'المخزن غير موجود' });
  // Cross-project move: WRITE on both sides (global edit already enforced).
  if (parsed.data.projectId && parsed.data.projectId !== existing.projectId) {
    const ctx = await requestContext(req);
    if (!can(ctx, 'warehouse.edit', parsed.data.projectId))
      return res.status(403).json({ message: 'ليس لديك صلاحية: warehouse.edit' });
  }
  const updated = await warehouseRepository.update(existing.id, { ...parsed.data, projectId: parsed.data.projectId || undefined });
  auditService.log(req, 'update', 'warehouse', existing.id, existing, updated);
  res.json(updated);
});

warehousesRouter.delete('/:id', requireProjectAccess('warehouse.delete', scopeWarehouseRow()), async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const existing = await warehouseRepository.findById(id);
  if (!existing) return res.status(404).json({ message: 'المخزن غير موجود' });
  const blocked = await deleteSafety.blockWarehouse(id);
  if (blocked) {
    auditService.log(req, 'delete-blocked', 'warehouse', id);
    return res.status(409).json({ message: blocked });
  }
  await warehouseRepository.delete(id);
  auditService.log(req, 'delete', 'warehouse', id, existing);
  res.status(204).end();
});
