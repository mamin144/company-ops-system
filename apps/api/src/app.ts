import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { apiRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { ensureDataDirectories, ensureSeedData } from './storage/bootstrap.js';
import { checkDatabaseConnection } from './database/connection.js';
import { runMigrations } from './database/migrate.js';

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

  // Serve the production web build (apps/web/dist) from the API itself so the
  // whole system runs on ONE port (LAN / Windows-Service friendly). In dev
  // (vite) the directory simply doesn't exist and the API stays API-only.
  // Resolved relative to this file (works for tsx src/ and compiled dist/),
  // WEB_DIST env overrides the location when set.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const webDist = process.env.WEB_DIST ?? path.resolve(here, '..', '..', 'web', 'dist');
  if (fs.existsSync(path.join(webDist, 'index.html'))) {
    // eslint-disable-next-line no-console
    console.log(`Serving web UI from ${webDist}`);
    app.use(express.static(webDist, { index: false, maxAge: '1d' }));
    // SPA fallback: any non-/api GET serves index.html (client-side routing).
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
