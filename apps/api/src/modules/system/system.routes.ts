import { Router } from 'express';
import { requireAuth, requirePermission, requestContext } from '../../middleware/auth.js';
import type { AuthedRequest } from '../../middleware/auth.js';
import { backupService } from '../../services/backup.service.js';
import { globalSearch } from '../../services/global-search.service.js';
import { notificationService } from '../../services/notification.service.js';
import { auditService } from '../../services/audit.service.js';
import { z } from 'zod';

export const systemRouter = Router();
systemRouter.use(requireAuth);

/* ---------- Audit log ---------- */
systemRouter.get('/audit-logs', requirePermission('audit.view'), async (req: AuthedRequest, res) => {
  // O8: rows are scoped to the caller's visible projects inside the service
  // (global events keep project_id NULL and remain visible).
  const ctx = await requestContext(req);
  const result = await auditService.list({
    entity: req.query.entity as string,
    action: req.query.action as string,
    q: req.query.q as string,
    projectId: typeof req.query.projectId === 'string' ? req.query.projectId : undefined,
    page: Number(req.query.page ?? 1),
    pageSize: Number(req.query.pageSize ?? 25)
  }, ctx);
  res.json(result);
});

/* ---------- Backup / Restore ---------- */

/**
 * WP-2.7 — backup endpoints.
 * - `GET /backups` merges on-disk snapshots with their recorded metadata.
 * - Creating a snapshot records size + sha256 (status `created`).
 * - `POST /backups/:name/verify` recomputes the checksum and records
 *   `verified`/`failed` (never an assumed OK).
 * - `POST /backups/:name/restore` is a TWO-STEP job: `dry_run` (read-only
 *   validation report) then `commit`. The destructive commit path is
 *   deliberately disabled: the authoritative dataset is PostgreSQL, which
 *   this snapshot does not contain, so committing would destroy live data
 *   based on an unverifiable assumption.
 */
systemRouter.get('/backups', requirePermission('backup.manage'), async (_req, res) => {
  res.json({ snapshots: backupService.list(), metadata: await backupService.listMetadata() });
});

systemRouter.post('/backups', requirePermission('backup.manage'), async (req: AuthedRequest, res) => {
  const result = backupService.create('manual');
  const meta = await backupService.registerMetadata(result.name, req.user!.id);
  auditService.log(req, 'backup-create', 'system', result.name);
  res.status(201).json({ ...result, metadata: meta });
});

systemRouter.post('/backups/:name/verify', requirePermission('backup.manage'), async (req: AuthedRequest, res) => {
  const name = String(req.params.name);
  const result = await backupService.verify(name);
  auditService.log(req, 'backup-verify', 'system', name, undefined, { status: result.status });
  if (result.status === 'failed') {
    return res.status(409).json({ message: 'التحقق من النسخة فشل', code: 'BACKUP_VERIFICATION_FAILED', ...result });
  }
  res.json(result);
});

const restoreSchema = z.object({ mode: z.enum(['dry_run', 'commit']) });

systemRouter.post('/backups/:name/restore', requirePermission('backup.manage'), async (req: AuthedRequest, res) => {
  const name = String(req.params.name);
  const parsed = restoreSchema.safeParse({ mode: req.body?.mode });
  if (!parsed.success) {
    return res.status(400).json({ message: 'الوضع مطلوب: dry_run أو commit', issues: parsed.error.flatten() });
  }

  if (parsed.data.mode === 'dry_run') {
    const report = backupService.dryRunValidation(name);
    if (!report.validName || !report.exists) {
      return res.status(404).json({ message: 'النسخة الاحتياطية غير موجودة أو تالفة', code: 'BACKUP_NOT_FOUND', report });
    }
    // make sure the snapshot has a metadata row before a job can reference it
    const known = (await backupService.listMetadata()).find((m) => m.fileName === name);
    if (!known) await backupService.registerMetadata(name, req.user!.id);
    await backupService.recordRestoreJob({
      backupName: name,
      mode: 'dry_run',
      requestedBy: req.user!.id,
      report,
      status: 'validated',
      notes: 'مراجعة فقط — لم تُنفّذ أي عملية تدمير',
    });
    auditService.log(req, 'restore-dry-run', 'system', name, undefined, { databaseIncluded: report.databaseIncluded });
    // no destructive step here: the report is the answer
    return res.json({ ok: true, mode: 'dry_run', report });
  }

  // commit: recorded, audited, and refused — never executed.
  const report = backupService.dryRunValidation(name);
  await backupService.recordRestoreJob({
    backupName: name,
    mode: 'commit',
    requestedBy: req.user!.id,
    report: { ...report, refused: true },
    status: 'failed',
    notes: 'أُلغي: الاستعادة التدميرية معطلة حتى تتوفر نسخة احتياطية لقاعدة بيانات PostgreSQL موثّقة',
  });
  auditService.log(req, 'restore-commit-refused', 'system', name, undefined, { databaseIncluded: report.databaseIncluded });
  return res.status(501).json({
    message: 'الاستعادة التدميرية معطلة: النسخة لا تحتوي على قاعدة بيانات PostgreSQL (المصدر الرسمي للبيانات).',
    code: 'RESTORE_NOT_SUPPORTED',
    report,
  });
});

/* ---------- Global search ---------- */
const searchSchema = z.object({ q: z.string() });
systemRouter.get('/search', async (req: AuthedRequest, res) => {
  const parsed = searchSchema.safeParse({ q: String(req.query.q ?? '') });
  if (!parsed.success || !parsed.data.q.trim()) return res.json({});
  // Phase 5: hits are scoped to the caller's memberships server-side.
  res.json(await globalSearch(parsed.data.q, req.user!.id));
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
