import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { dataDir, apiRoot } from '../shared/paths.js';
import { storageDir } from '../shared/paths.js';
import { pool } from '../database/connection.js';

export const backupRoot = join(apiRoot, 'backup');

const storageDirAbs = storageDir;

/** Only restore folder names that match our timestamp pattern — never trust arbitrary input. */
const isValidBackupName = (name: string) => /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}(-safety)?(-\d+)?$/.test(name);

/** Deterministic sha256 over a directory tree (paths + bytes). */
const checksumOf = (root: string): string => {
  const hash = createHash('sha256');
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        hash.update(`D:${full}\n`);
        walk(full);
      } else {
        hash.update(`F:${full}:${statSync(full).size}\n`);
        hash.update(readFileSync(full));
      }
    }
  };
  walk(root);
  return hash.digest('hex');
};

const sizeOnDisk = (root: string): number => {
  let total = 0;
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      total += entry.isDirectory() ? walk(full) : statSync(full).size;
    }
  };
  walk(root);
  return total;
};

export interface BackupMetadataRow {
  id: string;
  fileName: string;
  sizeBytes: number | null;
  checksumSha256: string | null;
  status: 'created' | 'verified' | 'failed';
  createdAt: string;
  verifiedAt: string | null;
}

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

  // ---------------------------------------------------------------------
  // WP-2.7 — metadata (backs `backups`) and dry-run/commit restore jobs
  // (backs `restore_jobs`). The on-disk JSON snapshot is metadata-only
  // evidence: PostgreSQL is the authoritative dataset, so a "restore" can
  // never silently destroy live data.
  // ---------------------------------------------------------------------

  /** Persist a backup's checksum + size so its integrity is recorded. */
  async registerMetadata(name: string, createdBy: string | null): Promise<BackupMetadataRow | null> {
    const dir = join(backupRoot, name);
    if (!existsSync(join(dir, 'data'))) return null;
    let checksum: string;
    try {
      checksum = checksumOf(dir);
    } catch {
      return null;
    }
    const result = await pool.query(
      `INSERT INTO backups (file_name, file_path, size_bytes, checksum_sha256, status, created_by)
       VALUES ($1, $2, $3, $4, 'created', $5)
       ON CONFLICT (file_name) DO UPDATE SET
         size_bytes = EXCLUDED.size_bytes,
         checksum_sha256 = EXCLUDED.checksum_sha256,
         status = 'created',
         created_by = EXCLUDED.created_by
       RETURNING id, file_name AS "fileName", size_bytes AS "sizeBytes",
                 checksum_sha256 AS "checksumSha256", status, created_at AS "createdAt",
                 verified_at AS "verifiedAt"`,
      [name, dir, sizeOnDisk(dir), checksum, createdBy],
    );
    return result.rows[0];
  }

  async listMetadata(): Promise<BackupMetadataRow[]> {
    const result = await pool.query(
      `SELECT id, file_name AS "fileName", size_bytes AS "sizeBytes",
              checksum_sha256 AS "checksumSha256", status, created_at AS "createdAt",
              verified_at AS "verifiedAt"
         FROM backups ORDER BY created_at DESC`,
    );
    return result.rows;
  }

  /**
   * Recompute a backup's checksum and flip its metadata status. A mismatch
   * or an unreadable snapshot marks the row `failed` — never silently OK.
   */
  async verify(name: string): Promise<{ name: string; status: 'verified' | 'failed'; matches: boolean | null }> {
    const dir = join(backupRoot, name);
    const meta = (
      await pool.query(`SELECT id, checksum_sha256 FROM backups WHERE file_name = $1`, [name])
    ).rows[0];
    let actual: string | null = null;
    try {
      if (existsSync(join(dir, 'data'))) actual = checksumOf(dir);
    } catch {
      actual = null;
    }
    const matches = actual && meta ? actual === meta.checksum_sha256 : null;
    const status = matches === false || actual === null ? 'failed' : 'verified';
    if (meta) {
      await pool.query(
        `UPDATE backups SET status = $2, verified_at = NOW() WHERE id = $1`,
        [meta.id, status],
      );
    }
    return { name, status, matches };
  }

  /**
   * Dry run: read-only validation report. Never touches live data.
   * The report states explicitly what the snapshot does and does not cover
   * so no caller can claim an unverified success.
   */
  dryRunValidation(name: string) {
    const dir = join(backupRoot, name);
    const hasData = existsSync(join(dir, 'data'));
    const hasStorage = existsSync(join(dir, 'storage'));
    return {
      name,
      validName: isValidBackupName(name),
      exists: hasData,
      hasDataFiles: hasData,
      hasStorageFiles: hasStorage,
      sizeBytes: hasData ? sizeOnDisk(dir) : 0,
      /* PostgreSQL is the authoritative dataset: this snapshot contains only
         the legacy JSON store and uploaded binaries. */
      databaseIncluded: false,
      warnings: [
        'النسخة لا تحتوي على قاعدة بيانات PostgreSQL (المصدر الرسمي للبيانات).',
      ],
    };
  }

  async recordRestoreJob(input: {
    backupName: string;
    mode: 'dry_run' | 'commit';
    requestedBy: string;
    report: Record<string, unknown> | null;
    status: string;
    notes?: string | null;
  }): Promise<{ id: string } | null> {
    const backup = (
      await pool.query(`SELECT id FROM backups WHERE file_name = $1`, [input.backupName])
    ).rows[0];
    if (!backup) return null;
    const result = await pool.query(
      `INSERT INTO restore_jobs (backup_id, mode, status, requested_by, validation_report, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [backup.id, input.mode, input.status, input.requestedBy, input.report ? JSON.stringify(input.report) : null, input.notes ?? null],
    );
    return result.rows[0];
  }
}

export const backupService = new BackupService();