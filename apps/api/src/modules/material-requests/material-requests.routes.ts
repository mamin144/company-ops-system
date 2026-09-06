import { Router } from 'express';
import { z } from 'zod';
import type { MaterialRequestLine } from '@cos/shared';
import { materialRequestRepository } from '../../repositories/material-request.repository';
import { itemRepository } from '../../repositories/item.repository';
import { projectRepository } from '../../repositories/project.repository';
import { siteRepository } from '../../repositories/site.repository';
import { warehouseRepository } from '../../repositories/warehouse.repository';
import { requireAuth, requirePermission } from '../../middleware/auth';
import type { AuthedRequest } from '../../middleware/auth';
import { auditService } from '../../services/audit.service';
import { nextNumber } from '../../services/numbering.service';
import { notificationService } from '../../services/notification.service';
import { deleteSafety, stockService } from '../../services/stock.service';
import { createStockTransactionInternal } from '../stock/stock.factory';

const lineSchema = z.object({
  itemId: z.string().min(1),
  requestedQty: z.coerce.number().positive(),
  issuedQty: z.coerce.number().nonnegative().optional(),
  notes: z.string().optional(),
});

const mrSchema = z.object({
  projectId: z.string().optional().or(z.literal('')),
  siteId: z.string().optional().or(z.literal('')),
  warehouseId: z.string().min(1),
  items: z.array(lineSchema).min(1),
  notes: z.string().optional(),
});

export const materialRequestsRouter = Router();
materialRequestsRouter.use(requireAuth, requirePermission('materialRequests.view'));

const STATUS_AR: Record<string, string> = {
  draft: 'مسودة',
  submitted: 'مقدمة',
  approved: 'معتمدة',
  rejected: 'مرفوضة',
  'partially-issued': 'صرف جزئي',
  issued: 'تم الصرف',
  closed: 'مغلقة',
};

materialRequestsRouter.get('/', async (req, res) => {
  let items = await materialRequestRepository.list();
  if (req.query.status) items = items.filter((m) => m.status === String(req.query.status));
  if (req.query.projectId) items = items.filter((m) => m.projectId === String(req.query.projectId));
  res.json([...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

materialRequestsRouter.get('/:id', async (req, res) => {
  const item = await materialRequestRepository.findById(String(req.params.id));
  if (!item) return res.status(404).json({ message: 'طلب المواد غير موجود' });
  res.json(item);
});

materialRequestsRouter.post('/', requirePermission('materialRequests.create'), async (req: AuthedRequest, res) => {
  const parsed = mrSchema.safeParse({ ...req.body, status: undefined });
  if (!parsed.success) return res.status(400).json({ message: 'بيانات غير صالحة', issues: parsed.error.flatten() });
  const d = parsed.data;
  for (const key of ['projectId', 'siteId'] as const) {
    const v = d[key];
    if (v && !((key === 'projectId' ? projectRepository : siteRepository) as { findById(x: string): unknown }).findById(v))
      return res.status(400).json({ message: key === 'projectId' ? 'المشروع غير موجود' : 'الموقع غير موجود' });
  }
  if(!await warehouseRepository.findById(d.warehouseId)) return res.status(400).json({ message: 'المخزن غير موجود' });
  for (const line of d.items) {
    if(!await itemRepository.findById(line.itemId)) return res.status(400).json({ message: 'أحد الأصناف غير موجود' });
  }
  const created = await materialRequestRepository.create({
    number: await nextNumber('MR'),
    projectId: d.projectId || undefined,
    siteId: d.siteId || undefined,
    warehouseId: d.warehouseId,
    status: 'draft',
    items: d.items,
    requestedBy: req.user!.username,
    notes: d.notes,
    createdBy: req.user!.username,
  });
  auditService.log(req, 'create', 'material-request', created.id, undefined, created);
  res.status(201).json(created);
});

materialRequestsRouter.post('/:id/submit', requirePermission('materialRequests.create'), async (req: AuthedRequest, res) => {
  const mr = await materialRequestRepository.findById(String(req.params.id));
  if (!mr) return res.status(404).json({ message: 'طلب المواد غير موجود' });
  if (mr.status !== 'draft') return res.status(409).json({ message: 'يمكن إرسال المسودة فقط' });
  const updated = await materialRequestRepository.update(mr.id, { status: 'submitted' });
  auditService.log(req, 'submit', 'material-request', mr.id, mr, updated);
  notificationService.create({
    type: 'material-request',
    title: `طلب مواد جديد ${mr.number}`,
    message: `${req.user!.fullName} أرسل طلب مواد للمراجعة`,
    link: '/material-requests',
    entityId: mr.id,
    dedupe: false,
  });
  res.json(updated);
});

materialRequestsRouter.post('/:id/approve', requirePermission('materialRequests.approve'), async (req: AuthedRequest, res) => {
  const mr = await materialRequestRepository.findById(String(req.params.id));
  if (!mr) return res.status(404).json({ message: 'طلب المواد غير موجود' });
  if (mr.status !== 'submitted') return res.status(409).json({ message: 'يمكن اعتماد الطلبات المقدمة فقط' });
  const approve = req.body?.approve !== false;
  const updated = await materialRequestRepository.update(mr.id, {
    status: approve ? 'approved' : 'rejected',
    reviewedBy: req.user!.username,
    reviewNotes: req.body?.notes,
  });
  auditService.log(req, approve ? 'approve' : 'reject', 'material-request', mr.id, mr, updated);
  res.json(updated);
});

/**
 * Issue stock against an approved request.
 * Validates availability in the request's warehouse, then creates a single
 * multi-item Stock OUT transaction linked to the request and project.
 */
materialRequestsRouter.post('/:id/issue', requirePermission('materialRequests.issue'), async (req: AuthedRequest, res) => {
  const mr = await materialRequestRepository.findById(String(req.params.id));
  if (!mr) return res.status(404).json({ message: 'طلب المواد غير موجود' });
  if (!['approved', 'partially-issued'].includes(mr.status))
    return res.status(409).json({ message: 'يمكن الصرف من الطلبات المعتمدة فقط' });

  const linesInput: Array<{ itemId: string; quantity: number }> = Array.isArray(req.body?.lines) ? req.body.lines : [];
  if (!linesInput.length) return res.status(400).json({ message: 'حدد الكميات المصروفة' });

  // validate quantities against remaining requested amounts
  for (const line of linesInput) {
    const requested = mr.items.find((i: MaterialRequestLine) => i.itemId === line.itemId);
    if (!requested) return res.status(400).json({ message: 'صنف خارج نطاق الطلب' });
    const remaining = requested.requestedQty - (requested.issuedQty ?? 0);
    if (line.quantity <= 0 || line.quantity > remaining)
      return res.status(400).json({
        message: `الكمية المطلوب صرفها (${line.quantity}) تتجاوز المتبقي (${remaining})`,
      });
  }

  // validate stock availability — never issue into negative balance
  for (const line of linesInput) {
    const available = await stockService.availableQty(line.itemId, mr.warehouseId);
    if (available < line.quantity)
      return res.status(409).json({
        message: `الرصيد غير كافٍ للصنف "${await (await itemRepository.findById(line.itemId))?.name ?? line.itemId}" — المتاح ${available}`,
      });
  }

  const tx = await createStockTransactionInternal(
    {
      type: 'OUT',
      warehouseId: mr.warehouseId,
      projectId: mr.projectId,
      referenceNumber: mr.number,
      date: new Date().toISOString().slice(0, 10),
      notes: `صرف مقابل طلب مواد ${mr.number}`,
      items: linesInput.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
    },
    req.user!,
  );

  // update issued quantities + status
  const newItems = mr.items.map((i: MaterialRequestLine) => {
    const issuedNow = linesInput.filter((l) => l.itemId === i.itemId).reduce((s, l) => s + l.quantity, 0);
    return { ...i, issuedQty: Math.min(i.requestedQty, (i.issuedQty ?? 0) + issuedNow) };
  });
  const fullyIssued = newItems.every((i: MaterialRequestLine) => (i.issuedQty ?? 0) >= i.requestedQty);
  const anyIssued = newItems.some((i: MaterialRequestLine) => (i.issuedQty ?? 0) > 0);
  const updated = await materialRequestRepository.update(mr.id, {
    items: newItems,
    status: fullyIssued ? 'issued' : anyIssued ? 'partially-issued' : mr.status,
  });

  auditService.log(req, 'issue-stock', 'material-request', mr.id, mr, { transaction: tx.number });
  res.json({ request: updated, transaction: tx });
});

/**
 * Delete a material request. Only untouched drafts may be removed — any
 * later workflow state (submitted/approved/issued/...) is blocked with 409
 * because stock movements or approvals may reference the request.
 * Draft authors already hold `materialRequests.create` (same permission as
 * submit), so no new permission is introduced.
 */
materialRequestsRouter.delete('/:id', requirePermission('materialRequests.create'), async (req: AuthedRequest, res) => {
  const existing = await materialRequestRepository.findById(String(req.params.id));
  if (!existing) return res.status(404).json({ message: 'طلب المواد غير موجود' });
  const blocked = await deleteSafety.blockMaterialRequest(existing.id);
  if (blocked) {
    auditService.log(req, 'delete-blocked', 'material-request', existing.id);
    return res.status(409).json({ message: blocked });
  }
  await materialRequestRepository.delete(existing.id);
  auditService.log(req, 'delete', 'material-request', existing.id, existing);
  res.status(204).end();
});
