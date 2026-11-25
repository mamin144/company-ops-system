import { Router } from 'express';
import { projectsRouter } from '../modules/projects/projects.routes.js';
import { documentsRouter } from '../modules/documents/documents.routes.js';
import { foldersRouter } from '../modules/folders/folders.routes.js';
import { warehousesRouter } from '../modules/warehouses/warehouses.routes.js';
import { itemsRouter } from '../modules/items/items.routes.js';
import { stockRouter } from '../modules/stock/stock.routes.js';
import { configRouter } from '../modules/config/config.routes.js';
import { importRouter } from '../modules/import/import.routes.js';
import { authRouter, usersRouter, usersExtRouter } from '../modules/auth/auth.routes.js';
import { rolesRouter } from '../modules/roles/roles.routes.js';
import { sitesRouter } from '../modules/sites/sites.routes.js';
import { materialRequestsRouter } from '../modules/material-requests/material-requests.routes.js';
import { systemRouter } from '../modules/system/system.routes.js';

export const apiRouter = Router();

// public
apiRouter.use('/auth', authRouter);

// protected
apiRouter.use('/users', usersExtRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/roles', rolesRouter);
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
