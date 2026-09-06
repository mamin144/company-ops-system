import { Router } from 'express';
import { z } from 'zod';
import { boqRepository } from '../../repositories/boq.repository';
import { projectRepository } from '../../repositories/project.repository';
import { excelService } from '../../services/excel.service';
import { deleteSafety } from '../../services/stock.service';
import { requireAuth, requireAnyPermission } from '../../middleware/auth';
import type { AuthedRequest } from '../../middleware/auth';
import { auditService } from '../../services/audit.service';

export const boqRouter = Router({ mergeParams: true });

export const boqSchema = z.object({
  itemCode: z.string().min(1, 'رقم البند مطلوب'),
  description: z.string().min(1, 'وصف البند مطلوب'),
  unit: z.string().min(1, 'الوحدة مطلوبة'),
  quantity: z.number().min(0, 'الكمية يجب أن تكون أكبر من أو تساوي 0'),
  unitPrice: z.number().min(0, 'الفئة يجب أن تكون أكبر من أو تساوي 0'),
});

boqRouter.use(requireAuth);

boqRouter.get('/', async (req, res) => {
  const projectId = String((req.params as any).projectId);
  const items = (await boqRepository.list()).filter((b: any) => b.projectId === projectId);
  // sort by itemCode logically
  items.sort((a, b) => a.itemCode.localeCompare(b.itemCode, undefined, { numeric: true }));
  res.json(items);
});

boqRouter.post('/', requireAnyPermission('projects.edit', 'projects.create'), async (req: AuthedRequest, res) => {
  const projectId = String((req.params as any).projectId);
  if (!await projectRepository.findById(projectId))
    return res.status(404).json({ message: 'المشروع غير موجود' });
  const parsed = boqSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'بيانات غير صالحة', issues: parsed.error.flatten() });
  
  const created = await boqRepository.create({
    projectId,
    ...parsed.data,
  });
  
  auditService.log(req, 'create', 'boq-item', created.id, undefined, created);
  res.status(201).json(created);
});

boqRouter.put('/:id', requireAnyPermission('projects.edit'), async (req: AuthedRequest, res) => {
  const parsed = boqSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'بيانات غير صالحة', issues: parsed.error.flatten() });

  const existing = await boqRepository.findById(String(req.params.id));
  // scope to the URL project: an item of another project is "not found" here
  if (!existing || existing.projectId !== String((req.params as any).projectId))
    return res.status(404).json({ message: 'البند غير موجود' });

  const updated = await boqRepository.update(String(req.params.id), parsed.data);
  auditService.log(req, 'update', 'boq-item', String(req.params.id), existing, updated);
  res.json(updated);
});

boqRouter.delete('/:id', requireAnyPermission('projects.edit'), async (req: AuthedRequest, res) => {
  const existing = await boqRepository.findById(String(req.params.id));
  if (!existing || existing.projectId !== String((req.params as any).projectId))
    return res.status(404).json({ message: 'البند غير موجود' });

  const blocked = await deleteSafety.blockBoqItem(existing.id);
  if (blocked) {
    auditService.log(req, 'delete-blocked', 'boq-item', existing.id);
    return res.status(409).json({ message: blocked });
  }
  await boqRepository.delete(String(req.params.id));
  auditService.log(req, 'delete', 'boq-item', String(req.params.id), existing);
  res.status(204).end();
});

boqRouter.get('/export/xlsx', requireAnyPermission('projects.edit', 'projects.create'), async (req, res) => {
  const projectId = String((req.params as any).projectId);
  const items = (await boqRepository.list()).filter((b: any) => b.projectId === projectId);
  const buffer = excelService.exportJson(
    items.map((b: any) => ({
      projectCode: '',
      itemCode: b.itemCode,
      description: b.description,
      unit: b.unit,
      quantity: b.quantity,
      unitPrice: b.unitPrice,
    })),
    'BOQ',
  );
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=boq.xlsx');
  res.send(buffer);
});
