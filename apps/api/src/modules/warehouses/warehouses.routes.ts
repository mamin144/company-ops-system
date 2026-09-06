import { Router } from 'express';
import { warehouseRepository } from '../../repositories/warehouse.repository';
import { applyPagination, applySearch, applySort } from '../../services/filter.service';
import { warehouseSchema } from './warehouses.validators';
import { projectRepository } from '../../repositories/project.repository';
import { excelService } from '../../services/excel.service';
import { requireAuth, requirePermission } from '../../middleware/auth';
import type { AuthedRequest } from '../../middleware/auth';
import { auditService } from '../../services/audit.service';
import { deleteSafety } from '../../services/stock.service';

export const warehousesRouter = Router();
warehousesRouter.use(requireAuth);

warehousesRouter.get('/', requirePermission('warehouse.view'), async (req, res) => {
  let items = await warehouseRepository.list();
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

warehousesRouter.get('/export/xlsx', requirePermission('reports.view'), async (_req, res) => {
  const buffer = excelService.exportJson(await warehouseRepository.list(), 'Warehouses');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=warehouses.xlsx');
  res.send(buffer);
});

warehousesRouter.post('/', requirePermission('warehouse.create'), async (req: AuthedRequest, res) => {
  const parsed = warehouseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'بيانات المخزن غير صالحة', issues: parsed.error.flatten() });
  if (parsed.data.projectId && !await projectRepository.findById(parsed.data.projectId))
    return res.status(400).json({ message: 'المشروع غير موجود' });
  const created = await warehouseRepository.create({ ...parsed.data, projectId: parsed.data.projectId || undefined, createdBy: req.user!.username });
  auditService.log(req, 'create', 'warehouse', created.id, undefined, created);
  res.status(201).json(created);
});

warehousesRouter.put('/:id', requirePermission('warehouse.edit'), async (req: AuthedRequest, res) => {
  const parsed = warehouseSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'بيانات المخزن غير صالحة', issues: parsed.error.flatten() });
  const existing = await warehouseRepository.findById(String(req.params.id));
  if (!existing) return res.status(404).json({ message: 'المخزن غير موجود' });
  const updated = await warehouseRepository.update(existing.id, { ...parsed.data, projectId: parsed.data.projectId || undefined });
  auditService.log(req, 'update', 'warehouse', existing.id, existing, updated);
  res.json(updated);
});

warehousesRouter.delete('/:id', requirePermission('warehouse.delete'), async (req: AuthedRequest, res) => {
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
