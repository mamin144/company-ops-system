import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { dataDir, apiRoot } from '../shared/paths';
import { storageDir } from '../shared/paths';

export const backupRoot = join(apiRoot, 'backup');

const storageDirAbs = storageDir;

/** Only restore folder names that match our timestamp pattern — never trust arbitrary input. */
const isValidBackupName = (name: string) => /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}(-safety)?(-\d+)?$/.test(name);

export class BackupService {
  /** Copy data/ + storage/ into backup/<timestamp>/ */
  create(kind?: 'manual' | 'safety'): { name: string } {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const base =
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
      `_${pad(now.getHours())}-${pad(now.getMinutes())}` +
      (kind === 'safety' ? '-safety' : '');
    let name = base;
    let i = 2;
    while (existsSync(join(backupRoot, name))) name = `${base}-${i++}`;

    const target = join(backupRoot, name);
    mkdirSync(join(target, 'data'), { recursive: true });
    cpSync(dataDir, join(target, 'data'), { recursive: true });
    if (existsSync(storageDirAbs)) {
      cpSync(storageDirAbs, join(target, 'storage'), { recursive: true });
    }
    return { name };
  }

  list(): Array<{ name: string; createdAt: string; hasFiles: boolean }> {
    if (!existsSync(backupRoot)) return [];
    return readdirSync(backupRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory() && isValidBackupName(e.name))
      .map((e) => ({
        name: e.name,
        createdAt: e.name.replace('_', ' ').replace(/-(safety)?(-\d+)?$/, (m) => m),
        hasFiles: existsSync(join(backupRoot, e.name, 'data')),
      }))
      .sort((a, b) => b.name.localeCompare(a.name));
  }

  /**
   * Restore a named backup. Always takes a safety snapshot of the current state first.
   * Returns the safety backup name so the operation can be undone.
   */
  restore(name: string): { safetyBackup: string } {
    if (!isValidBackupName(name)) throw Object.assign(new Error('اسم النسخة غير صالح'), { status: 400 });
    const source = join(backupRoot, name);
    const sourceData = join(source, 'data');
    if (!existsSync(sourceData)) throw Object.assign(new Error('النسخة الاحتياطية غير موجودة أو تالفة'), { status: 404 });

    // safety snapshot of current state before destroying anything
    const { name: safetyBackup } = this.create('safety');

    // replace JSON data
    rmSync(dataDir, { recursive: true, force: true });
    mkdirSync(dirname(dataDir), { recursive: true });
    cpSync(sourceData, dataDir, { recursive: true });

    // replace stored files when the backup contains them
    const sourceStorage = join(source, 'storage');
    if (existsSync(sourceStorage)) {
      rmSync(storageDirAbs, { recursive: true, force: true });
      cpSync(sourceStorage, storageDirAbs, { recursive: true });
    }
    return { safetyBackup };
  }
}

export const backupService = new BackupService();
void basename;
