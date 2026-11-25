import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { folderRepository } from '../../repositories/folder.repository.js';
import { auditService } from '../../services/audit.service.js';
import type { AuthedRequest } from '../../middleware/auth.js';

export const foldersRouter = Router();

foldersRouter.use(requireAuth);

/**
 * Folders are a global tree (no project column in the schema), so their scope
 * is archive-scope, not project-scope. Every route — including the listing —
 * requires the explicit permission it mutates/reads, resolved through central
 * authorization (role + overrides, DENY precedence) rather than any client
 * claim. The unscoped `GET /` that existed before allowed any authenticated
 * user to enumerate the tree.
 */
foldersRouter.get('/', requirePermission('archive.view'), async (_req, res) => {
  const folders = await folderRepository.list();
  res.json(folders);
});

foldersRouter.post('/', requirePermission('archive.upload'), async (req: AuthedRequest, res) => {
  if (!req.body.name) return res.status(400).json({ message: 'Name is required' });
  const created = await folderRepository.createFolder({
    name: req.body.name,
    parentId: req.body.parentId,
    color: req.body.color,
    createdBy: req.user?.username,
  });
  auditService.log(req, 'create', 'folder', created.id, undefined, { name: created.name });
  res.status(201).json(created);
});

foldersRouter.put('/:id', requirePermission('archive.edit'), async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  if (!req.body.name) return res.status(400).json({ message: 'Name is required' });
  const existing = await folderRepository.findById(id);
  if (!existing) return res.status(404).json({ message: 'Folder not found' });
  const updated = await folderRepository.updateFolder(id, {
    name: req.body.name,
    parentId: req.body.parentId,
    color: req.body.color,
  });
  auditService.log(req, 'update', 'folder', id, { name: existing.name }, { name: updated?.name });
  res.json(updated);
});

foldersRouter.delete('/:id', requirePermission('archive.delete'), async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const existing = await folderRepository.findById(id);
  if (!existing) return res.status(404).json({ message: 'المجلد غير موجود' });
  await folderRepository.delete(id);
  auditService.log(req, 'delete', 'folder', existing.id, { name: existing.name });
  res.status(204).end();
});