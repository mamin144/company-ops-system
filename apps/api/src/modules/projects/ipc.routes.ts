import { Router } from 'express';
import { z } from 'zod';
import { ipcRepository, ipcItemRepository } from '../../repositories/ipc.repository';
import { boqRepository } from '../../repositories/boq.repository';
import { projectRepository } from '../../repositories/project.repository';
import { deleteSafety } from '../../services/stock.service';
import { requireAuth, requireAnyPermission } from '../../middleware/auth';
import type { AuthedRequest } from '../../middleware/auth';
import { auditService } from '../../services/audit.service';

export const ipcRouter = Router({ mergeParams: true });

const ipcItemSchema = z.object({
  boqItemId: z.string(),
  currentQuantity: z.number().min(0),
});

const ipcSchema = z.object({
  ipcNumber: z.number().min(1),
  // DATE NOT NULL in PostgreSQL: reject empty/invalid strings with 400
  // instead of letting them reach the database as a 500.
  date: z.string().min(1, 'التاريخ مطلوب').refine((v) => !Number.isNaN(Date.parse(v)), {
    message: 'التاريخ غير صالح',
  }),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected']),
  // GET returns null for untouched nullable columns and the form sends it
  // back verbatim — accept null but normalize to undefined (same pattern as
  // projects validator): create falls back to column defaults, update skips.
  notes: z.string().optional().nullable().transform((v) => v ?? undefined),
  deductions: z.number().optional().nullable().transform((v) => v ?? undefined),
  items: z.array(ipcItemSchema).optional(),
});

ipcRouter.use(requireAuth);

ipcRouter.get('/', async (req, res) => {
  const projectId = String((req.params as any).projectId);
  const items = (await ipcRepository.list()).filter((i: any) => i.projectId === projectId);
  items.sort((a, b) => a.ipcNumber - b.ipcNumber);
  res.json(items);
});

ipcRouter.get('/:id', async (req, res) => {
  const ipc = await ipcRepository.findById(String(req.params.id));
  if (!ipc || ipc.projectId !== String((req.params as any).projectId))
    return res.status(404).json({ message: 'المستخلص غير موجود' });

  const items = await ipcItemRepository.getByIpcId(ipc.id);
  res.json({ ...ipc, items });
});

/**
 * Allowed status transitions (conservative: no backward moves, terminal
 * states stay). Rejected IPCs must be recreated, not reopened.
 */
const IPC_TRANSITIONS: Record<string, string[]> = {
  draft: ['draft', 'submitted'],
  submitted: ['submitted', 'approved', 'rejected'],
  approved: ['approved'],
  rejected: ['rejected'],
};

const EPS = 1e-9;

interface IpcLineInput { boqItemId: string; currentQuantity: number }

/**
 * Validate IPC lines BEFORE anything is written (avoids partially-created
 * IPCs): every line must reference a BOQ item of the same project, and the
 * cumulative quantity (previous + current) must not exceed the BOQ quantity
 * — variations/change orders are not implemented, so BOQ limits are enforced.
 * Returns an Arabic error message or null.
 */
const checkIpcLines = (
  lines: IpcLineInput[],
  boqMap: Map<string, { itemCode: string; quantity: number }>,
  pastQtyOf: (boqItemId: string) => number,
): string | null => {
  for (const item of lines) {
    const boq = boqMap.get(item.boqItemId);
    if (!boq) return 'أحد البنود لا ينتمي لمشروع المستخلص';
    if (pastQtyOf(item.boqItemId) + item.currentQuantity > boq.quantity + EPS)
      return `الكمية التراكمية للبند ${boq.itemCode} تتجاوز كمية المقايسة (${boq.quantity})`;
  }
  return null;
};

ipcRouter.post('/', requireAnyPermission('projects.edit', 'projects.create'), async (req: AuthedRequest, res) => {
  const projectId = String((req.params as any).projectId);
  const parsed = ipcSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'بيانات غير صالحة', issues: parsed.error.flatten() });
  if (!await projectRepository.findById(projectId))
    return res.status(404).json({ message: 'المشروع غير موجود' });
  const projectIpcs = (await ipcRepository.list()).filter((i: any) => i.projectId === projectId);
  if (projectIpcs.some((i: any) => i.ipcNumber === parsed.data.ipcNumber))
    return res.status(409).json({ message: 'رقم المستخلص مستخدم بالفعل في هذا المشروع' });

  // figure out previous quantities from past IPCs (same project, lower number)
  const boqs = await boqRepository.list();
  const boqMap = new Map(boqs.filter(b => b.projectId === projectId).map(b => [b.id, b]));
  const pastItems = await Promise.all(
    projectIpcs.filter((i: any) => i.ipcNumber < parsed.data.ipcNumber).map(i => ipcItemRepository.getByIpcId(i.id))
  );
  const flatPast = pastItems.flat();
  const pastQtyOf = (boqItemId: string) =>
    flatPast.filter(pi => pi.boqItemId === boqItemId).reduce((sum, pi) => sum + pi.currentQuantity, 0);

  // validate lines BEFORE creating anything — no partially-created IPCs
  if (parsed.data.items?.length) {
    const err = checkIpcLines(parsed.data.items, boqMap, pastQtyOf);
    if (err) return res.status(400).json({ message: err });
  }

  const created = await ipcRepository.create({
    projectId,
    ipcNumber: parsed.data.ipcNumber,
    date: parsed.data.date,
    status: parsed.data.status,
    notes: parsed.data.notes,
    deductions: parsed.data.deductions,
  });

  let netAmount = 0;

  if (parsed.data.items && parsed.data.items.length > 0) {
    for (const item of parsed.data.items) {
      const boq = boqMap.get(item.boqItemId)!;

      // Calculate previous qty
      const prevQty = pastQtyOf(item.boqItemId);

      await ipcItemRepository.upsert({
        ipcId: created.id,
        boqItemId: item.boqItemId,
        previousQuantity: prevQty,
        currentQuantity: item.currentQuantity,
      });

      netAmount += item.currentQuantity * boq.unitPrice;
    }

    // update net amount
    await ipcRepository.update(created.id, { netAmount });
    created.netAmount = netAmount;
  }

  auditService.log(req, 'create', 'ipc', created.id, undefined, created);
  res.status(201).json(created);
});

ipcRouter.put('/:id', requireAnyPermission('projects.edit'), async (req: AuthedRequest, res) => {
  const parsed = ipcSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'بيانات غير صالحة', issues: parsed.error.flatten() });
  
  const existing = await ipcRepository.findById(String(req.params.id));
  if (!existing || existing.projectId !== String((req.params as any).projectId))
    return res.status(404).json({ message: 'المستخلص غير موجود' });

  // status transitions are validated server-side: no backward moves, so a
  // simple status edit can never bypass the submit/approve workflow
  const allowed = IPC_TRANSITIONS[existing.status] ?? [];
  if (!allowed.includes(parsed.data.status))
    return res.status(409).json({ message: `لا يمكن تغيير حالة المستخلص من ${existing.status} إلى ${parsed.data.status}` });

  const projectIpcs = (await ipcRepository.list()).filter((i: any) => i.projectId === existing.projectId);
  if (projectIpcs.some((i: any) => i.ipcNumber === parsed.data.ipcNumber && i.id !== existing.id))
    return res.status(409).json({ message: 'رقم المستخلص مستخدم بالفعل في هذا المشروع' });

  const boqs = await boqRepository.list();
  const boqMap = new Map(boqs.filter(b => b.projectId === existing.projectId).map(b => [b.id, b]));

  const pastItems = await Promise.all(
    projectIpcs.filter((i: any) => i.ipcNumber < existing.ipcNumber).map(i => ipcItemRepository.getByIpcId(i.id))
  );
  const flatPast = pastItems.flat();
  const pastQtyOf = (boqItemId: string) =>
    flatPast.filter(pi => pi.boqItemId === boqItemId).reduce((sum, pi) => sum + pi.currentQuantity, 0);

  // validate lines BEFORE writing anything
  if (parsed.data.items) {
    const err = checkIpcLines(parsed.data.items, boqMap, pastQtyOf);
    if (err) return res.status(400).json({ message: err });
  }

  await ipcRepository.update(existing.id, {
    ipcNumber: parsed.data.ipcNumber,
    date: parsed.data.date,
    status: parsed.data.status,
    notes: parsed.data.notes,
    deductions: parsed.data.deductions,
  });

  let netAmount = 0;

  if (parsed.data.items) {
    for (const item of parsed.data.items) {
      const boq = boqMap.get(item.boqItemId)!;

      const prevQty = pastQtyOf(item.boqItemId);

      await ipcItemRepository.upsert({
        ipcId: existing.id,
        boqItemId: item.boqItemId,
        previousQuantity: prevQty,
        currentQuantity: item.currentQuantity,
      });

      netAmount += item.currentQuantity * boq.unitPrice;
    }

    await ipcRepository.update(existing.id, { netAmount });
  }

  const updated = await ipcRepository.findById(existing.id);
  auditService.log(req, 'update', 'ipc', existing.id, existing, updated);
  res.json(updated);
});

ipcRouter.delete('/:id', requireAnyPermission('projects.edit'), async (req: AuthedRequest, res) => {
  const existing = await ipcRepository.findById(String(req.params.id));
  if (!existing || existing.projectId !== String((req.params as any).projectId))
    return res.status(404).json({ message: 'المستخلص غير موجود' });

  const blocked = await deleteSafety.blockIpc(existing.id);
  if (blocked) {
    auditService.log(req, 'delete-blocked', 'ipc', existing.id);
    return res.status(409).json({ message: blocked });
  }
  await ipcRepository.delete(String(req.params.id));
  auditService.log(req, 'delete', 'ipc', String(req.params.id), existing);
  res.status(204).end();
});
