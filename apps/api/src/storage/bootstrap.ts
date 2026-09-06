import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { seedCategories, seedUnits } from './seed';
import { seedUsersAndRoles } from './seed-users';
import { dataDir, storageDir, tempDir } from '../shared/paths';

export const ensureDataDirectories = () => {
  [dataDir, storageDir, tempDir].forEach((dir) => mkdirSync(dir, { recursive: true }));
  [join(storageDir, 'documents'), join(storageDir, 'documents', 'unassigned')].forEach((dir) =>
    mkdirSync(dir, { recursive: true }),
  );
};

const ensureJsonFile = (filePath: string, content: unknown) => {
  if (!existsSync(filePath)) {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8');
  }
};

export const ensureSeedData = () => {
  ensureJsonFile(join(dataDir, 'projects.json'), []);
  ensureJsonFile(join(dataDir, 'sites.json'), []);
  ensureJsonFile(join(dataDir, 'documents.json'), []);
  ensureJsonFile(join(dataDir, 'warehouses.json'), []);
  ensureJsonFile(join(dataDir, 'items.json'), []);
  ensureJsonFile(join(dataDir, 'stock_transactions.json'), []);
  ensureJsonFile(join(dataDir, 'material_requests.json'), []);
  ensureJsonFile(join(dataDir, 'notifications.json'), []);
  ensureJsonFile(join(dataDir, 'audit_logs.json'), []);
  ensureJsonFile(join(dataDir, 'import_history.json'), []);
  ensureJsonFile(join(dataDir, 'counters.json'), []);
  ensureJsonFile(join(dataDir, 'categories.json'), seedCategories());
  ensureJsonFile(join(dataDir, 'units.json'), seedUnits());
  seedUsersAndRoles();
};
