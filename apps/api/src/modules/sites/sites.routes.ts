import { Router } from 'express';
import { z } from 'zod';
import { siteRepository } from '../../repositories/site.repository';
import { projectRepository } from '../../repositories/project.repository';
import { requireAuth, requirePermission } from '../../middleware/auth';
import type { AuthedRequest } from '../../middleware/auth';
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

sitesRouter.get('/', async (req, res) => {
  let items = await siteRepository.list();
  if (req.query.projectId) items = items.filter((s) => s.projectId === String(req.query.projectId));
  res.json(items);
});

sitesRouter.post('/', requirePermission('projects.edit'), async (req: AuthedRequest, res) => {
  const parsed = siteSchema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json({ message: 'بيانات غير صالحة', issues: parsed.error.flatten() });
  if (!await projectRepository.findById(parsed.data.projectId))
    return res.status(400).json({ message: 'المشروع غير موجود' });
  const created = await siteRepository.create({ ...parsed.data, createdBy: req.user!.username });
  auditService.log(req, 'create', 'site', created.id, undefined, created);
  res.status(201).json(created);
});

sitesRouter.put('/:id', requirePermission('projects.edit'), async (req: AuthedRequest, res) => {
  const parsed = siteSchema.partial().safeParse(req.body);
  if(!parsed.success) return res.status(400).json({ message: 'بيانات غير صالحة', issues: parsed.error.flatten() });
  const existing = await siteRepository.findById(String(req.params.id));
  if(!existing) return res.status(404).json({ message: 'الموقع غير موجود' });
  const updated = await siteRepository.update(existing.id, parsed.data);
  auditService.log(req, 'update', 'site', existing.id, existing, updated);
  res.json(updated);
});

sitesRouter.delete('/:id', requirePermission('projects.edit'), async (req: AuthedRequest, res) => {
  const existing = await siteRepository.findById(String(req.params.id));
  if(!existing) return res.status(404).json({ message: 'الموقع غير موجود' });
  await siteRepository.delete(existing.id);
  auditService.log(req, 'delete', 'site', existing.id, existing);
  res.status(204).end();
});
