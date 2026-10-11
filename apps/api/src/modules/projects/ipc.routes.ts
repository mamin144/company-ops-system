import { Router } from 'express';
import { z } from 'zod';
<<<<<<< HEAD
import { ipcRepository, ipcItemRepository } from '../../repositories/ipc.repository.js';
import { boqRepository } from '../../repositories/boq.repository.js';
import { projectRepository } from '../../repositories/project.repository.js';
import { deleteSafety } from '../../services/stock.service.js';
import { requireAuth, requireAnyPermission, requireAnyProjectAccess, requestContext } from '../../middleware/auth.js';
import type { AuthedRequest } from '../../middleware/auth.js';
import { scopeFromParam } from '../../services/projectScope.js';
import { can } from '../../services/authorization.service.js';
import { auditService } from '../../services/audit.service.js';
=======
import { ipcRepository, ipcItemRepository } from '../../repositories/ipc.repository';
import { boqRepository } from '../../repositories/boq.repository';
import { projectRepository } from '../../repositories/project.repository';
import { deleteSafety } from '../../services/stock.service';
import { requireAuth, requireAnyPermission, requireAnyProjectAccess, requestContext } from '../../middleware/auth';
import type { AuthedRequest } from '../../middleware/auth';
import { scopeFromParam } from '../../services/projectScope';
import { can } from '../../services/authorization.service';
import { auditService } from '../../services/audit.service';
>>>>>>> 22bb86216dfc3ef7502b7c36906e4665ecfd9f5e

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
  // قيمة المستخلص الإجمالية المباشرة — تُستخدم عند غياب بنود المقايسة
  grossAmount: z.number().min(0).optional().nullable().transform((v) => v ?? undefined),
  items: z.array(ipcItemSchema).optional(),
});

ipcRouter.use(requireAuth);

ipcRouter.get('/', async (req: AuthedRequest, res) => {
  // Phase 5: collection scoped to the URL project (READ+); empty on denial.
  const ctx = await requestContext(req);
  const projectId = String((req.params as any).projectId);
  if (!can(ctx, 'projects.view', projectId)) return res.json([]);
  const items = (await ipcRepository.list()).filter((i: any) => i.projectId === projectId);
  items.sort((a, b) => a.ipcNumber - b.ipcNumber);
  res.json(items);
});

ipcRouter.get('/:id', async (req: AuthedRequest, res) => {
  const ipc = await ipcRepository.findById(String(req.params.id));
  if (!ipc || ipc.projectId !== String((req.params as any).projectId))
    return res.status(404).json({ message: 'المستخلص غير موجود' });
  // Phase 5: row-level READ on the IPC's own project (hides existence).
  const ctx = await requestContext(req);
  if (!can(ctx, 'projects.view', ipc.projectId ?? undefined))
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

ipcRouter.post('/', requireAnyProjectAccess(['projects.edit', 'projects.create'], scopeFromParam()), async (req: AuthedRequest, res) => {
  const projectId = String((req.params as any).projectId);
  const parsed = ipcSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'بيانات غير صالحة', issues: parsed.error.flatten() });
  if (!await projectRepository.findById(projectId))
    return res.status(404).json({ message: 'المشروع غير موجود' });
  const projectIpcs = (await ipcRepository.list()).filter((i: any) => i.projectId === projectId);
  if (projectIpcs.some((i: any) => i.ipcNumber === parsed.data.ipcNumber))
    return res.status(409).json({ message: 'رقم المستخلص مستخدم بالفعل في هذا المشروع' });

  // figure out previous quantities from past IPCs (same project, lower number)
  // — only needed when BOQ lines are provided; otherwise the IPC carries a
  // direct gross amount with no BOQ dependency at all.
  const boqs = await boqRepository.list();
  const boqMap = new Map(boqs.filter(b => b.projectId === projectId).map(b => [b.id, b]));
  const hasLines = !!parsed.data.items?.length;
  let pastQtyOf = (_boqItemId: string) => 0;
  if (hasLines) {
    const pastItems = await Promise.all(
      projectIpcs.filter((i: any) => i.ipcNumber < parsed.data.ipcNumber).map(i => ipcItemRepository.getByIpcId(i.id))
    );
    const flatPast = pastItems.flat();
    pastQtyOf = (boqItemId: string) =>
      flatPast.filter(pi => pi.boqItemId === boqItemId).reduce((sum, pi) => sum + pi.currentQuantity, 0);

    // validate lines BEFORE creating anything — no partially-created IPCs
    const err = checkIpcLines(parsed.data.items!, boqMap, pastQtyOf);
    if (err) return res.status(400).json({ message: err });
  }

  const created = await ipcRepository.create({
    projectId,
    ipcNumber: parsed.data.ipcNumber,
    date: parsed.data.date,
    status: parsed.data.status,
    notes: parsed.data.notes,
    deductions: parsed.data.deductions,
    grossAmount: parsed.data.grossAmount,
  });

  // Executed (net) value: from BOQ lines when present, otherwise the direct
  // gross minus deductions (الصافي = الإجمالي − الاستقطاعات).
  let netAmount = Math.max(0, (parsed.data.grossAmount ?? 0) - (parsed.data.deductions ?? 0));

  if (hasLines) {
    netAmount = 0;
    for (const item of parsed.data.items!) {
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
  }

  // persist the executed value (from BOQ lines, or the direct gross amount)
  await ipcRepository.update(created.id, { netAmount });
  created.netAmount = netAmount;

  auditService.log(req, 'create', 'ipc', created.id, undefined, created);
  res.status(201).json(created);
});

ipcRouter.put('/:id', requireAnyProjectAccess(['projects.edit'], scopeFromParam()), async (req: AuthedRequest, res) => {
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

  // BOQ lines are optional: without them the IPC carries a direct gross
  // amount with no BOQ dependency at all.
  const hasLines = !!parsed.data.items?.length;
  let pastQtyOf = (_boqItemId: string) => 0;
  if (hasLines) {
    const pastItems = await Promise.all(
      projectIpcs.filter((i: any) => i.ipcNumber < existing.ipcNumber).map(i => ipcItemRepository.getByIpcId(i.id))
    );
    const flatPast = pastItems.flat();
    pastQtyOf = (boqItemId: string) =>
      flatPast.filter(pi => pi.boqItemId === boqItemId).reduce((sum, pi) => sum + pi.currentQuantity, 0);

    // validate lines BEFORE writing anything
    const err = checkIpcLines(parsed.data.items!, boqMap, pastQtyOf);
    if (err) return res.status(400).json({ message: err });
  }

  await ipcRepository.update(existing.id, {
    ipcNumber: parsed.data.ipcNumber,
    date: parsed.data.date,
    status: parsed.data.status,
    notes: parsed.data.notes,
    deductions: parsed.data.deductions,
    grossAmount: parsed.data.grossAmount,
  });

  if (hasLines) {
    let netAmount = 0;
    for (const item of parsed.data.items!) {
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
  } else if (parsed.data.grossAmount !== undefined || parsed.data.deductions !== undefined) {
    // direct amount, no BOQ lines: executed value follows gross minus deductions
    // (falls back to stored values for whichever side wasn't sent)
    const gross = parsed.data.grossAmount ?? existing.grossAmount ?? 0;
    const ded = parsed.data.deductions ?? existing.deductions ?? 0;
    await ipcRepository.update(existing.id, { netAmount: Math.max(0, gross - ded) });
  }

  const updated = await ipcRepository.findById(existing.id);
  auditService.log(req, 'update', 'ipc', existing.id, existing, updated);
  res.json(updated);
});

ipcRouter.delete('/:id', requireAnyProjectAccess(['projects.edit'], scopeFromParam()), async (req: AuthedRequest, res) => {
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
