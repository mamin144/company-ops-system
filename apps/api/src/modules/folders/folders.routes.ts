import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { folderRepository } from '../../repositories/folder.repository';
import type { AuthedRequest } from '../../middleware/auth';

export const foldersRouter = Router();

foldersRouter.use(requireAuth);

foldersRouter.get('/', async (req, res) => {
  const folders = await folderRepository.list();
  res.json(folders);
});

foldersRouter.post('/', async (req: AuthedRequest, res) => {
  if (!req.body.name) return res.status(400).json({ message: 'Name is required' });
  const created = await folderRepository.createFolder({
    name: req.body.name,
    parentId: req.body.parentId,
    color: req.body.color,
    createdBy: req.user?.username,
  });
  res.status(201).json(created);
});

foldersRouter.put('/:id', async (req, res) => {
  const id = req.params.id;
  if (!req.body.name) return res.status(400).json({ message: 'Name is required' });
  const updated = await folderRepository.updateFolder(id, {
    name: req.body.name,
    parentId: req.body.parentId,
    color: req.body.color,
  });
  if (!updated) return res.status(404).json({ message: 'Folder not found' });
  res.json(updated);
});

foldersRouter.delete('/:id', async (req, res) => {
  await folderRepository.delete(req.params.id);
  res.status(204).end();
});
