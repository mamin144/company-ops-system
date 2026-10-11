import { Router } from 'express';
import { categoryRepository, unitRepository } from '../../repositories/config.repository.js';
import { requireAuth } from '../../middleware/auth.js';

export const configRouter = Router();
configRouter.use(requireAuth);

configRouter.get('/categories', async (_req, res) => res.json(await categoryRepository.list()));
configRouter.get('/units', async (_req, res) => res.json(await unitRepository.list()));
