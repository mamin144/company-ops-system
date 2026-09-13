import { Router } from 'express';
import { projectsRouter } from '../modules/projects/projects.routes';
import { documentsRouter } from '../modules/documents/documents.routes';
import { foldersRouter } from '../modules/folders/folders.routes';
import { warehousesRouter } from '../modules/warehouses/warehouses.routes';
import { itemsRouter } from '../modules/items/items.routes';
import { stockRouter } from '../modules/stock/stock.routes';
import { configRouter } from '../modules/config/config.routes';
import { importRouter } from '../modules/import/import.routes';
import { authRouter, usersRouter } from '../modules/auth/auth.routes';
import { sitesRouter } from '../modules/sites/sites.routes';
import { materialRequestsRouter } from '../modules/material-requests/material-requests.routes';
import { systemRouter } from '../modules/system/system.routes';

export const apiRouter = Router();

// public
apiRouter.use('/auth', authRouter);

// protected
apiRouter.use('/users', usersRouter);
apiRouter.use('/projects', projectsRouter);
apiRouter.use('/documents', documentsRouter);
apiRouter.use('/folders', foldersRouter);
apiRouter.use('/warehouses', warehousesRouter);
apiRouter.use('/items', itemsRouter);
apiRouter.use('/stock', stockRouter);
apiRouter.use('/sites', sitesRouter);
apiRouter.use('/material-requests', materialRequestsRouter);
apiRouter.use('/import', importRouter);
apiRouter.use('/config', configRouter);
apiRouter.use('/', systemRouter); // /search, /notifications, /audit-logs, /backups
