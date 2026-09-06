import { Router } from 'express';
import { itemRepository } from '../../repositories/item.repository';
import { itemSchema } from '../warehouses/warehouses.validators';
import { applyPagination, applySearch, applySort } from '../../services/filter.service';
import { excelService } from '../../services/excel.service';
import { requireAuth, requirePermission } from '../../middleware/auth';
import type { AuthedRequest } from '../../middleware/auth';
import { auditService } from '../../services/audit.service';
import { deleteSafety } from '../../services/stock.service';

export const itemsRouter = Router();
itemsRouter.use(requireAuth);

itemsRouter.get('/', requirePermission('warehouse.view'), async (req, res) => {
  let items = await itemRepository.list();
  items = applySearch(items, String(req.query.q ?? ''), ['code', 'name', 'category', 'unit', 'brand', 'notes']);
  if (req.query.category) items = items.filter((item) => item.category === String(req.query.category));
  if (req.query.unit) items = items.filter((item) => item.unit === String(req.query.unit));
  res.json(
    applyPagination(
      applySort(items, String(req.query.sortBy ?? 'updatedAt'), (req.query.sortDir as 'asc' | 'desc') ?? 'desc'),
      Number(req.query.page ?? 1),
      Number(req.query.pageSize ?? 20),
    ),
  );
});

itemsRouter.get('/export/xlsx', requirePermission('reports.view'), async (_req, res) => {
  const buffer = excelService.exportJson(await itemRepository.list(), 'Items');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=items.xlsx');
  res.send(buffer);
});

itemsRouter.post('/', requirePermission('warehouse.create'), async (req: AuthedRequest, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'بيانات الصنف غير صالحة', issues: parsed.error.flatten() });
  const created = await itemRepository.create({ ...parsed.data, createdBy: req.user!.username });
  auditService.log(req, 'create', 'item', created.id, undefined, created);
  res.status(201).json(created);
});

itemsRouter.put('/:id', requirePermission('warehouse.edit'), async (req: AuthedRequest, res) => {
  const parsed = itemSchema.partial().safeParse(req.body);
  if(!parsed.success) return res.status(400).json({ message: 'بيانات الصنف غير صالحة', issues: parsed.error.flatten() });
  const existing = await itemRepository.findById(String(req.params.id));
  if(!existing) return res.status(404).json({ message: 'الصنف غير موجود' });
  const updated = await itemRepository.update(existing.id, parsed.data);
  auditService.log(req, 'update', 'item', existing.id, existing, updated);
  res.json(updated);
});

itemsRouter.delete('/:id', requirePermission('warehouse.delete'), async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const existing = await itemRepository.findById(id);
  if (!existing) return res.status(404).json({ message: 'الصنف غير موجود' });
  const blocked = await deleteSafety.blockItem(id);
  if (blocked) {
    auditService.log(req, 'delete-blocked', 'item', id);
    return res.status(409).json({ message: blocked });
  }
  await itemRepository.delete(id);
  auditService.log(req, 'delete', 'item', id, existing);
  res.status(204).end();
});
