import { existsSync, readFileSync, renameSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

/**
 * Hardened JSON store.
 * All mutations are synchronous on the event loop which serializes access
 * in-process (basic concurrency protection). Writes are atomic (temp + rename),
 * corrupted files are preserved instead of silently overwritten, and callers
 * can take safety snapshots before destructive operations.
 */
export class JsonStore<T> {
  constructor(private readonly filePath: string) {}

  read(): T[] {
    if (!existsSync(this.filePath)) return [];
    let raw: string;
    try {
      raw = readFileSync(this.filePath, 'utf-8');
    } catch {
      throw new Error(`تعذر قراءة ملف البيانات: ${this.filePath}`);
    }
    if (!raw.trim()) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('not an array');
      return parsed as T[];
    } catch {
      const corruptPath = `${this.filePath}.corrupt-${Date.now()}`;
      copyFileSync(this.filePath, corruptPath);
      throw new Error(`ملف البيانات تالف. تم حفظ نسخة منه في ${corruptPath}`);
    }
  }

  write(items: T[]) {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    writeFileSync(tempPath, JSON.stringify(items, null, 2), 'utf-8');
    renameSync(tempPath, this.filePath);
  }

  update(mutator: (items: T[]) => T[]): T[] {
    const items = this.read();
    const updated = mutator(items);
    this.write(updated);
    return updated;
  }

  /** Snapshot copy used before destructive operations such as restore. */
  backupTo(backupDir: string) {
    if (!existsSync(this.filePath)) return;
    mkdirSync(backupDir, { recursive: true });
    copyFileSync(this.filePath, join(backupDir, this.filePath.split(/[\\/]/).pop() ?? 'file.json'));
  }
}

export const jsonStorePath = (baseDir: string, fileName: string) => join(baseDir, fileName);
