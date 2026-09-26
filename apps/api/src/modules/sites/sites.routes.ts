import { Router } from 'express';
import { z } from 'zod';
import { siteRepository } from '../../repositories/site.repository';
import { projectRepository } from '../../repositories/project.repository';
import { requireAuth, requirePermission, requireProjectAccess, requestContext } from '../../middleware/auth';
import type { AuthedRequest } from '../../middleware/auth';
import { scopeSiteRow, scopeFromBody, filterVisible, checkFilterProject } from '../../services/projectScope';
import { can } from '../../services/authorization.service';
import { auditService } from '../../services/audit.service';

const siteSchema = z.object({
  projectId: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  location: z.string().optional(),
  notes: z.string().optional(),
});

export const sitesRouter = Router();
sitesRouter.use(requireAuth);

sitesRouter.get('/', async (req: AuthedRequest, res) => {
  // Phase 5: backend-scoped to member projects; explicit filter on a
  // no-access project denies loudly instead of leaking an empty oracle.
  const ctx = await requestContext(req);
  if (req.query.projectId && !checkFilterProject(ctx, String(req.query.projectId), 'projects.view'))
    return res.status(403).json({ message: 'ليس لديك صلاحية: projects.view' });
  let items = filterVisible(ctx, await siteRepository.list(), (s) => s.projectId, 'projects.view');
  if (req.query.projectId) items = items.filter((s) => s.projectId === String(req.query.projectId));
  res.json(items);
});

sitesRouter.post('/', requireProjectAccess('projects.edit', scopeFromBody()), async (req: AuthedRequest, res) => {
  const parsed = siteSchema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json({ message: 'بيانات غير صالحة', issues: parsed.error.flatten() });
  const created = await siteRepository.create({ ...parsed.data, createdBy: req.user!.username });
  auditService.log(req, 'create', 'site', created.id, undefined, created);
  res.status(201).json(created);
});

sitesRouter.put('/:id', requireProjectAccess('projects.edit', scopeSiteRow()), async (req: AuthedRequest, res) => {
  const parsed = siteSchema.partial().safeParse(req.body);
  if(!parsed.success) return res.status(400).json({ message: 'بيانات غير صالحة', issues: parsed.error.flatten() });
  const existing = await siteRepository.findById(String(req.params.id));
  if(!existing) return res.status(404).json({ message: 'الموقع غير موجود' });
  // Cross-project move: WRITE on both sides (global edit already enforced).
  if (parsed.data.projectId && parsed.data.projectId !== existing.projectId) {
    const ctx = await requestContext(req);
    if (!can(ctx, 'projects.edit', parsed.data.projectId))
      return res.status(403).json({ message: 'ليس لديك صلاحية: projects.edit' });
  }
  const updated = await siteRepository.update(existing.id, parsed.data);
  auditService.log(req, 'update', 'site', existing.id, existing, updated);
  res.json(updated);
});

sitesRouter.delete('/:id', requireProjectAccess('projects.edit', scopeSiteRow()), async (req: AuthedRequest, res) => {
  const existing = await siteRepository.findById(String(req.params.id));
  if(!existing) return res.status(404).json({ message: 'الموقع غير موجود' });
  await siteRepository.delete(existing.id);
  auditService.log(req, 'delete', 'site', existing.id, existing);
  res.status(204).end();
});
