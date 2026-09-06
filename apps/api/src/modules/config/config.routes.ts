import { Router } from 'express';
import { categoryRepository, unitRepository } from '../../repositories/config.repository';
import { requireAuth } from '../../middleware/auth';

export const configRouter = Router();
configRouter.use(requireAuth);

configRouter.get('/categories', async (_req, res) => res.json(await categoryRepository.list()));
configRouter.get('/units', async (_req, res) => res.json(await unitRepository.list()));
