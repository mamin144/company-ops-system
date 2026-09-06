import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth';
import type { AuthedRequest } from '../../middleware/auth';import { auditLogRepository } from '../../repositories/audit-log.repository';
import { backupService } from '../../services/backup.service';
import { globalSearch } from '../../services/global-search.service';
import { notificationService } from '../../services/notification.service';
import { auditService } from '../../services/audit.service';
import { applyPagination } from '../../services/filter.service';
import { z } from 'zod';

export const systemRouter = Router();
systemRouter.use(requireAuth);

/* ---------- Audit log ---------- */
systemRouter.get('/audit-logs', requirePermission('audit.view'), async (req, res) => {
  const result = await auditService.list({
    entity: req.query.entity as string,
    action: req.query.action as string,
    q: req.query.q as string,
    page: Number(req.query.page ?? 1),
    pageSize: Number(req.query.pageSize ?? 25)
  });
  res.json(result);
});

/* ---------- Backup / Restore ---------- */
systemRouter.get('/backups', requirePermission('backup.manage'), async (_req, res) => {
  res.json(backupService.list());
});

systemRouter.post('/backups', requirePermission('backup.manage'), async (_req, res) => {
  const result = backupService.create('manual');
  res.status(201).json(result);
});

systemRouter.post('/backups/:name/restore', requirePermission('backup.manage'), async (req: AuthedRequest, res) => {
  try {
    const result = backupService.restore(String(req.params.name));
    auditService.log(req, 'restore-backup', 'system', String(req.params.name));
    res.json({ ok: true, ...result });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    res.status(status).json({ message: e instanceof Error ? e.message : 'فشل الاستعادة' });
  }
});

/* ---------- Global search ---------- */
const searchSchema = z.object({ q: z.string() });
systemRouter.get('/search', async (req, res) => {
  const parsed = searchSchema.safeParse({ q: String(req.query.q ?? '') });
  if (!parsed.success || !parsed.data.q.trim()) return res.json({});
  res.json(await globalSearch(parsed.data.q));
});

/* ---------- Notifications ---------- */
systemRouter.get('/notifications', async (req: AuthedRequest, res) => {
  const username = req.user!.username;
  const all = await notificationService.list();
  res.json({
    unread: all.filter((n: any) => !n.readBy.includes(username)).length,
    items: all.slice(0, 30),
  });
});

systemRouter.post('/notifications/:id/read', async (req: AuthedRequest, res) => {
  await notificationService.markRead(String(req.params.id), req.user!.username);
  res.json({ ok: true });
});

systemRouter.post('/notifications/read-all', async (req: AuthedRequest, res) => {
  await notificationService.markAllRead(req.user!.username);
  res.json({ ok: true });
});
