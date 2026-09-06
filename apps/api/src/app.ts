import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errors';
import { ensureDataDirectories, ensureSeedData } from './storage/bootstrap';
import { checkDatabaseConnection } from './database/connection';
import { runMigrations } from './database/migrate';

export const createApp = async () => {
  ensureDataDirectories();
  ensureSeedData();

  // Initialize PostgreSQL database
  await runMigrations();

  const app = express();
  // multi-computer deployments usually sit behind a reverse proxy
  app.set('trust proxy', 1);
  // CORS allowlist: when CORS_ORIGINS is unset, reflect the request origin
  // (local development / same-LAN use). For any Internet-facing deployment,
  // set CORS_ORIGINS to an explicit comma-separated list, e.g.
  // CORS_ORIGINS=https://app.example.com
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.use(cors({ origin: corsOrigins.length ? corsOrigins : true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', async (_req, res) => {
    const dbOk = await checkDatabaseConnection();
    res.json({ ok: true, db: dbOk });
  });
  
  app.use('/api', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
