import { copyFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { basename, extname, isAbsolute, join, normalize, sep } from 'node:path';
import { createId } from '../shared/id';
import { storageDir } from '../shared/paths';

const safeSegment = (value: string) =>
  value
    .replace(/[^a-zA-Z0-9\u0600-\u06FF._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '') || 'item';

/** Normalized storage root with a trailing separator, so prefix checks are exact. */
const storageRoot = normalize(storageDir).endsWith(sep)
  ? normalize(storageDir)
  : normalize(storageDir) + sep;

export class FileStorageService {
  private root = join(storageDir, 'documents');

  ensureProjectFolder(projectCode?: string) {
    const folder = join(this.root, safeSegment(projectCode ?? 'unassigned'));
    mkdirSync(folder, { recursive: true });
    return folder;
  }

  /**
   * Move a file within storage. renameSync is atomic and preferred, but it
   * fails with EXDEV when source and target live on different filesystems
   * (e.g. Docker bind-mounts for temp/ vs storage/). In that case only,
   * fall back to a kernel-level copy (copyFileSync streams in the kernel —
   * no extra memory even for large files), verify it, then remove the temp
   * file. On copy failure the partial target is removed and the error
   * propagates, so callers never record metadata for a missing file.
   */
  private moveFile(tempPath: string, targetPath: string) {
    try {
      renameSync(tempPath, targetPath);
      return;
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code !== 'EXDEV') throw err;
    }
    try {
      copyFileSync(tempPath, targetPath);
    } catch (err) {
      try {
        if (existsSync(targetPath)) unlinkSync(targetPath);
      } catch {
        /* best-effort cleanup */
      }
      throw err;
    }
    unlinkSync(tempPath);
  }

  storeFromTemp(tempPath: string, originalName: string, projectCode?: string, category?: string) {
    const folder = this.ensureProjectFolder(projectCode);
    const categoryFolder = join(folder, safeSegment(category ?? 'other'));
    mkdirSync(categoryFolder, { recursive: true });
    const ext = extname(originalName).toLowerCase();
    const storedName = `${Date.now()}-${createId()}${ext}`;
    const targetPath = join(categoryFolder, storedName);
    this.moveFile(tempPath, targetPath);
    return this.toRelativePath(targetPath);
  }

  replaceFile(targetPath: string, tempPath: string) {
    mkdirSync(join(targetPath, '..'), { recursive: true });
    this.moveFile(tempPath, targetPath);
  }

  readFileBuffer(filePath: string) {
    if (!existsSync(filePath)) {
      throw Object.assign(new Error('File not found'), { status: 404 });
    }
    return filePath;
  }

  toRelativePath(filePath: string) {
    return normalize(filePath).replace(normalize(storageDir), '').replace(/^\\+|^\/+/, '');
  }

  /**
   * Resolve a stored path to an absolute path inside the storage root.
   *
   * Supports both formats found in the JSON data:
   * - relative (current):  documents/<PROJECT>/<category>/<file>
   * - legacy absolute:     C:\...\storage\documents\<PROJECT>\...
   *
   * Security: rejects traversal (../ ..\), absolute paths outside the storage
   * root, and anything that escapes after normalization. Legacy absolute
   * paths pointing to a previous install location are re-anchored onto the
   * current storage root by their `storage\documents\...` suffix.
   */
  resolveAbsolute(storedPath: string) {
    if (!storedPath || !storedPath.trim()) {
      throw Object.assign(new Error('المسار غير صالح'), { status: 400 });
    }

    const rootLower = storageRoot.toLowerCase();

    // reject explicit traversal sequences before normalization
    if (/\.\.[\\/]/.test(storedPath)) {
      throw Object.assign(new Error('مسار غير مسموح'), { status: 400 });
    }

    const normalized = normalize(storedPath.trim());

    if (isAbsolute(normalized)) {
      const lower = normalized.toLowerCase();

      // absolute inside the current storage root — allowed as legacy format
      if (lower.startsWith(rootLower)) return normalized;

      // legacy install location: re-anchor by the storage\documents\... suffix
      const marker = lower.lastIndexOf('\\storage\\') >= 0 ? lower.lastIndexOf('\\storage\\') : lower.lastIndexOf('/storage/');
      if (marker >= 0) {
        const suffix = normalized.slice(marker + '\\storage'.length).replace(/^[\\/]+/, '');
        const reAnchored = join(storageRoot, suffix);
        if (reAnchored.toLowerCase().startsWith(rootLower)) return reAnchored;
      }

      throw Object.assign(new Error('الملف خارج مسار التخزين المسموح'), { status: 400 });
    }

    // relative path → resolve against storage root, then verify containment
    const absolute = normalize(join(storageRoot, normalized));
    if (!absolute.toLowerCase().startsWith(rootLower)) {
      throw Object.assign(new Error('مسار غير مسموح'), { status: 400 });
    }
    return absolute;
  }

  fileNameFromPath(filePath: string) {
    return basename(filePath);
  }
}

export const fileStorageService = new FileStorageService();
