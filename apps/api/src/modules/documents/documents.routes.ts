import { Router } from 'express';
import { existsSync, unlinkSync } from 'node:fs';
import multer from 'multer';
import { documentSchema, documentStatusSchema } from './documents.validators.js';
import { documentRepository } from '../../repositories/document.repository.js';
import { documentLinkRepository } from '../../repositories/document-link.repository.js';
import path from 'path';
import fs from 'fs';
import { ZipArchive } from 'archiver';
import { applyPagination, applySearch, applySort } from '../../services/filter.service.js';
import { fileStorageService } from '../../storage/file-storage.js';
import { projectRepository } from '../../repositories/project.repository.js';
import { ipcRepository } from '../../repositories/ipc.repository.js';
import { excelService } from '../../services/excel.service.js';
import { requireAuth, requirePermission, requireAnyPermission, requireProjectAccess, requestContext } from '../../middleware/auth.js';
import type { AuthedRequest } from '../../middleware/auth.js';
import { scopeDocumentRow, scopeFromBody, filterVisible, checkFilterProject } from '../../services/projectScope.js';
import { can } from '../../services/authorization.service.js';
import { auditService } from '../../services/audit.service.js';
import { notificationService } from '../../services/notification.service.js';
import { deleteSafety } from '../../services/stock.service.js';
import { createId } from '../../shared/id.js';
import { nowIso } from '../../shared/time.js';
import type { Document, DocumentRevision } from '@cos/shared';

/**
 * D6 conservative allowlist: PDF, images and Office documents only.
 * `svg`/`html`/text-extensions-other are deliberately excluded — they are
 * the classic stored-XSS carriers when served inline or reopened in a
 * browser context.
 */
const isZip = (b: Buffer) => b.subarray(0, 4).toString('latin1') === 'PK\x03\x04';
const isOle = (b: Buffer) => b.subarray(0, 8).toString('hex') === 'd0cf11e0a1b11ae1';

const UPLOAD_ALLOWLIST: Record<string, (head: Buffer) => boolean> = {
  pdf: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
  png: (b) => b.subarray(0, 8).toString('hex') === '89504e470d0a1a0a',
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  jpeg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  gif: (b) => ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('latin1')),
  webp: (b) =>
    b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  txt: (b) => !b.includes(0),
  csv: (b) => !b.includes(0),
  zip: isZip,
  docx: isZip,
  xlsx: isZip,
  pptx: isZip,
  doc: isOle,
  xls: isOle,
  ppt: isOle,
};

/**
 * Server-side content validation for an accepted upload. Returns an Arabic
 * error message, or null when the file is acceptable.
 * Runs AFTER multer stored the temp file and BEFORE any metadata row or
 * permanent storage location is created.
 */
const validateUpload = (file: { originalname: string; path: string }): string | null => {
  const ext = extOf(repairFileName(file.originalname));
  const signature = UPLOAD_ALLOWLIST[ext];
  if (!signature) {
    return 'نوع الملف غير مسموح. المسموح: PDF، صور، ومستندات Office فقط.';
  }
  let head: Buffer;
  try {
    const fd = fs.openSync(file.path, 'r');
    try {
      head = Buffer.alloc(16);
      fs.readSync(fd, head, 0, 16, 0);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return 'تعذر قراءة الملف المرفوع.';
  }
  if (!signature(head)) {
    return 'محتوى الملف لا يطابق امتداده. رفض الملف.';
  }
  return null;
};

// D6 (owner-approved): 25 MB per upload. nginx is configured to match.
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const upload = multer({
  dest: 'temp',
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    // Defense in depth: the extension is checked again against content bytes
    // in validateUpload; the client MIME type is never trusted on its own.
    if (!UPLOAD_ALLOWLIST[extOf(repairFileName(file.originalname))]) {
      cb(new Error('UNSUPPORTED_FILE_TYPE'));
      return;
    }
    cb(null, true);
  },
});

/** Best-effort removal of a rejected temp upload (never a stored file). */
const removeTempFile = (tempPath: string) => {
  try {
    if (existsSync(tempPath)) unlinkSync(tempPath);
  } catch {
    /* ignore */
  }
};

/** Upload middleware with explicit 4xx answers instead of a generic 500. */
const singleUpload = (field: string) =>
  (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) =>
    upload.single(field)(req, res, (err: any) => {
      if (!err) return next();
      if (err?.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          message: `حجم الملف يتجاوز الحد المسموح (${MAX_UPLOAD_BYTES / (1024 * 1024)} ميجابايت).`,
          code: 'FILE_TOO_LARGE',
        });
      }
      return res.status(400).json({ message: 'نوع الملف غير مسموح أو تعذر رفعه.', code: 'UNSUPPORTED_FILE_TYPE' });
    });

const STATUS_AR: Record<string, string> = {
  draft: 'مسودة',
  submitted: 'مقدمة',
  'under-review': 'قيد المراجعة',
  approved: 'معتمد',
  rejected: 'مرفوض',
  superseded: 'مُستبدل',
  archived: 'مؤرشف',
};

/**
 * Cross-project IPC guard: when a document references both a project and an
 * IPC, the IPC must belong to that same project. Documents without a project
 * (or without an IPC) are unaffected. Returns an Arabic error or null.
 */
const checkIpcProject = async (projectId?: string, ipcId?: string): Promise<string | null> => {
  if (!ipcId) return null;
  const ipc = await ipcRepository.findById(ipcId);
  if (!ipc) return 'المستخلص غير موجود';
  if (projectId && ipc.projectId !== projectId) return 'المستخلص لا ينتمي لهذا المشروع';
  return null;
};

/**
 * Sniff the first bytes of a stored file and return its extension ONLY when
 * the real content matches the declared extension. A mismatch (e.g. HTML
 * stored under a `.pdf` name) returns null so the caller forces a download.
 */
const inferExtension = (absolute: string, declaredExt: string): string | null => {
  try {
    const fd = fs.openSync(absolute, 'r');
    try {
      const head = Buffer.alloc(16);
      fs.readSync(fd, head, 0, 16, 0);
      for (const ext of Object.keys(UPLOAD_ALLOWLIST)) {
        if (ext !== declaredExt.toLowerCase()) continue;
        if (UPLOAD_ALLOWLIST[ext](head)) return ext;
      }
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }
  return null;
};

/** Remove an orphaned stored file (never a live revision). */
const removeStoredFile = (relativePath?: string) => {  if (!relativePath) return;
  try {
    const abs = fileStorageService.resolveAbsolute(relativePath);
    if (existsSync(abs)) unlinkSync(abs);
  } catch {
    /* path outside storage or already removed — ignore */
  }
};

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

documentsRouter.get('/', requirePermission('archive.view'), async (req: AuthedRequest, res) => {
  // Phase 5: backend-scoped to member projects (null-project rows stay visible).
  const ctx = await requestContext(req);
  if (req.query.projectId && !checkFilterProject(ctx, String(req.query.projectId), 'archive.view'))
    return res.status(403).json({ message: 'ليس لديك صلاحية: archive.view' });
  let items = filterVisible(ctx, await documentRepository.list(), (item) => item.projectId, 'archive.view');
  items = applySearch(items, String(req.query.q ?? ''), ['title', 'documentNumber', 'category', 'documentType', 'notes']);
  if (req.query.projectId) items = items.filter((item) => item.projectId === String(req.query.projectId));
  if (req.query.folderId) items = items.filter((item) => item.folderId === String(req.query.folderId));
  if (req.query.siteId) items = items.filter((item) => item.siteId === String(req.query.siteId));
  if (req.query.category) items = items.filter((item) => item.category === String(req.query.category));
  if (req.query.documentType) items = items.filter((item) => item.documentType === String(req.query.documentType));
  if (req.query.revision) items = items.filter((item) => item.revision === String(req.query.revision));
  if (req.query.status) items = items.filter((item) => item.status === String(req.query.status));
  if (req.query.from)
    items = items.filter((item) => (item.documentDate ?? item.createdAt) >= String(req.query.from));
  if (req.query.to) items = items.filter((item) => (item.documentDate ?? item.createdAt) <= String(req.query.to));
  items = applySort(items, String(req.query.sortBy ?? 'updatedAt'), (req.query.sortDir as 'asc' | 'desc') ?? 'desc');
  res.json(applyPagination(items, Number(req.query.page ?? 1), Number(req.query.pageSize ?? 20)));
});

documentsRouter.get('/export/xlsx', requirePermission('archive.view'), async (req: AuthedRequest, res) => {
  const ctx = await requestContext(req);
  const buffer = excelService.exportJson(filterVisible(ctx, await documentRepository.list(), (d) => d.projectId, 'archive.view'), 'Documents');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=documents.xlsx');
  res.send(buffer);
});

documentsRouter.get('/:id', requireProjectAccess('archive.view', scopeDocumentRow(), { hideExistence: true }), async (req, res) => {
  const item = await documentRepository.findById(String(req.params.id));
  if (!item) return res.status(404).json({ message: 'المستند غير موجود' });
  res.json(item);
});

documentsRouter.get('/:id/revisions', requireProjectAccess('archive.view', scopeDocumentRow(), { hideExistence: true }), async (req, res) => {
  const item = await documentRepository.findById(String(req.params.id));
  if (!item) return res.status(404).json({ message: 'المستند غير موجود' });
  // newest first for the register view
  res.json([...item.revisions].reverse());
});

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  txt: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  // svg is intentionally absent: never served, see forceAttachment
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
};

/**
 * Only these extensions may ever be rendered inline by a browser. Anything
 * else — including any legacy file still stored with an .svg/.html/.xhtml
 * extension from before the allowlist — is forced to download, and inline
 * responses carry a deny-by-default CSP so a payload can never execute in
 * the application origin.
 */
const INLINE_SAFE = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp']);
const UNSAFE_INLINE = new Set(['svg', 'html', 'htm', 'xhtml', 'xht', 'xml']);

const mimeFor = (ext: string) => MIME[ext.toLowerCase()] ?? 'application/octet-stream';

/** attachment for anything that is not proven inline-safe */
const forceAttachment = (ext: string) => UNSAFE_INLINE.has(ext.toLowerCase()) || !INLINE_SAFE.has(ext.toLowerCase());

/**
 * Content-Disposition safe for HTTP headers and all browsers:
 * ASCII fallback + RFC 5987 filename* for Arabic/Unicode names.
 * e.g. inline; filename="doc.pdf"; filename*=UTF-8''%D8%B9%D9%82%D8%AF.pdf
 */
const contentDisposition = (type: 'inline' | 'attachment', fileName: string) => {
  const fallback = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'file';
  const encoded = encodeURIComponent(fileName).replace(/['()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
};

/**
 * Shared sender. Preview (inline=true) always returns a real MIME type with
 * `Content-Disposition: inline` so browsers can render it; Download returns
 * `attachment`. Both require authentication and resolve revisions safely.
 */
const sendDocumentFile = async (req: AuthedRequest, res: import('express').Response, inline: boolean) => {
  const item = await documentRepository.findById(String(req.params.id));
  if (!item) return res.status(404).json({ message: 'المستند غير موجود' });
  // Phase 5: file access follows the document's project (view or download,
  // mirroring the route-level any-download rule). Denial hides existence.
  const ctx = await requestContext(req);
  if (!(can(ctx, 'archive.view', item.projectId ?? undefined) || can(ctx, 'archive.download', item.projectId ?? undefined)))
    return res.status(404).json({ message: 'المستند غير موجود' });
  const revisionId = req.query.revision ? String(req.query.revision) : undefined;

  let filePath = item.filePath;
  let fileName = item.fileName;
  let ext = item.fileExtension;
  if (revisionId) {
    const rev = item.revisions.find((r: DocumentRevision) => r.id === revisionId);
    if (!rev) return res.status(404).json({ message: 'الإصدار غير موجود' });
    filePath = rev.filePath;
    fileName = rev.fileName;
    ext = rev.fileExtension;
  }

  const absolute = fileStorageService.resolveAbsolute(filePath); // throws on path traversal
  if (!existsSync(absolute)) return res.status(404).json({ message: 'ملف المستند غير موجود على الخادم' });

  // D6: an inline response is only ever used for proven-inline-safe types;
  // everything else is downloaded, and no inline response ever gets an
  // origin that could execute embedded script.
  const asInline = inline && !forceAttachment(ext);
  // A stored extension is not trustworthy on its own: sniff the bytes too.
  const sniffInline = asInline ? inferExtension(absolute, ext) : null;

  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (asInline && sniffInline) {
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('Content-Type', mimeFor(sniffInline));
    res.setHeader('Content-Disposition', contentDisposition('inline', fileName));
  } else {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', contentDisposition('attachment', fileName));
  }
  // explicit error handling: a missing/unreadable file becomes a clean 500/404
  // instead of a hanging or empty (204-like) response
  res.sendFile(absolute, (err) => {
    if (err && !res.headersSent) {
      const status = (err as { status?: number }).status ?? 500;
      res.status(status).json({ message: status === 404 ? 'ملف المستند غير موجود على الخادم' : 'تعذر إرسال الملف' });
    }
  });
};

/** Preview only — never attachment, never triggers a browser download. */
documentsRouter.get('/:id/preview', requireAnyDownloadPermission(), async (req, res) => {
  sendDocumentFile(req as AuthedRequest, res, true);
});

/** Download only — always attachment. The Preview button never calls this. */
documentsRouter.get('/:id/download', requireAnyDownloadPermission(), async (req, res) => {
  sendDocumentFile(req as AuthedRequest, res, false);
});

/** Legacy alias kept for compatibility; defaults to inline like /preview. */
documentsRouter.get('/:id/file', requireAnyDownloadPermission(), async (req, res) => {
  const download = req.query.download === '1';
  sendDocumentFile(req as AuthedRequest, res, !download);
});

/**
 * WP-2.6: route-level gate for file access. Uses central authorization
 * (role + overrides, DENY-precedence) — never the stale req.user snapshot.
 * Project-level narrowing happens inside sendDocumentFile (hides existence).
 */
const requireAnyDownloadPermission = () =>
  requireAnyPermission('archive.view', 'archive.download');

documentsRouter.post('/upload', requireProjectAccess('archive.upload', scopeFromBody()), singleUpload('file'), async (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ message: 'الملف مطلوب' });
  // D6: extension allowlist + content sniffing (never trust the client MIME).
  const uploadError = validateUpload(req.file);
  if (uploadError) {
    removeTempFile(req.file.path);
    return res.status(400).json({ message: uploadError, code: 'UNSUPPORTED_FILE_TYPE' });
  }
  const body = { ...req.body, tags: parseTags(req.body.tags) };
  const parsed = documentSchema.safeParse(body);
  if(!parsed.success) return res.status(400).json({ message: 'بيانات المستند غير صالحة', issues: parsed.error.flatten() });
  const projectId = parsed.data.projectId || undefined;
  const ipcId = parsed.data.ipcId || undefined;
  const linkError = await checkIpcProject(projectId, ipcId);
  if (linkError) return res.status(400).json({ message: linkError });
  const project = projectId ? await projectRepository.findById(projectId) : undefined;
  const originalName = repairFileName(req.file.originalname);
  const relativePath = fileStorageService.storeFromTemp(req.file.path, originalName, project?.projectCode, parsed.data.category);

  const uploadedBy = req.user!.fullName || req.user!.username;
  const revisionLabel = parsed.data.revision || '00';
  const revision: DocumentRevision = {
    id: createId(),
    revision: revisionLabel,
    fileName: originalName,
    fileExtension: extOf(originalName),
    fileSize: req.file.size,
    filePath: relativePath,
    uploadedBy,
    uploadedAt: nowIso(),
    notes: parsed.data.notes,
  };

  const created = await documentRepository.create({
    ...parsed.data,
    folderId: parsed.data.folderId || undefined,
    projectId,
    siteId: parsed.data.siteId || undefined,
    ipcId,
    documentNumber: parsed.data.documentNumber || undefined,
    documentDate: parsed.data.documentDate || undefined,
    revision: revisionLabel,
    status: 'draft',
    uploadedBy,
    fileName: revision.fileName,
    fileExtension: revision.fileExtension,
    fileSize: revision.fileSize,
    filePath: revision.filePath,
    revisions: [revision],
    createdBy: req.user!.username,
  });
  auditService.log(req, 'create', 'document', created.id, undefined, metaOnly(created));
  res.status(201).json(created);
});

/** Upload a NEW revision — previous revision files are never destroyed. */
documentsRouter.post(
  '/:id/revisions',
  requireProjectAccess('archive.edit', scopeDocumentRow()),
  singleUpload('file'),
  async (req: AuthedRequest, res) => {
    const item = await documentRepository.findById(String(req.params.id));
    if (!item) return res.status(404).json({ message: 'المستند غير موجود' });
    if(!req.file) return res.status(400).json({ message: 'الملف مطلوب' });

    const uploadError = validateUpload(req.file);
    if (uploadError) {
      removeTempFile(req.file.path);
      return res.status(400).json({ message: uploadError, code: 'UNSUPPORTED_FILE_TYPE' });
    }

    const project = item.projectId ? await projectRepository.findById(item.projectId) : undefined;
    const originalName = repairFileName(req.file.originalname);
  const relativePath = fileStorageService.storeFromTemp(req.file.path, originalName, project?.projectCode, item.category);
    const nextLabel = nextRevisionLabel(item.revisions.length);
    const revision: DocumentRevision = {
      id: createId(),
      revision: nextLabel,
      fileName: originalName,
      fileExtension: extOf(originalName),
      fileSize: req.file.size,
      filePath: relativePath,
      uploadedBy: req.user!.fullName || req.user!.username,
      uploadedAt: nowIso(),
      notes: typeof req.body?.notes === 'string' ? req.body.notes : undefined,
    };

    const updated = await documentRepository.update(item.id, {
      revisions: [...item.revisions, revision],
      revision: nextLabel,
      fileName: revision.fileName,
      fileExtension: revision.fileExtension,
      fileSize: revision.fileSize,
      filePath: revision.filePath,
      status: item.status === 'approved' ? 'submitted' : item.status,
    });
    auditService.log(req, 'new-revision', 'document', item.id, { revision: item.revision }, { revision: nextLabel });
    res.status(201).json(updated);
  },
);

documentsRouter.post('/:id/links', requireProjectAccess('archive.edit', scopeDocumentRow()), async (req: AuthedRequest, res) => {
  const { entityType, entityId } = req.body;
  if (!entityType || !entityId) return res.status(400).json({ message: 'Missing entityType or entityId' });
  const existing = await documentRepository.findById(String(req.params.id));
  if (!existing) return res.status(404).json({ message: 'Document not found' });
  // WP-2.6: new links must live inside the SAME project the document belongs
  // to; a cross-project link is how document rows leak into foreign projects.
  const linkError = await checkLinkProject(existing, entityType, entityId);
  if (linkError) return res.status(400).json({ message: linkError });
  const link = await documentLinkRepository.link(existing.id, entityType, entityId);
  auditService.log(req, 'link', 'document', existing.id, undefined, { entityType, entityId });
  res.status(201).json(link);
});

/**
 * Cross-project guard for new links. Project-scoped entity types must resolve
 * to an object whose projectId equals the document's own project; a document
 * without a project cannot be linked to project-scoped data at all.
 */
async function checkLinkProject(doc: Document, entityType: string, entityId: string): Promise<string | null> {
  switch (entityType) {
    case 'project': {
      if (!doc.projectId) return 'المستند غير مرتبط بمشروع.';
      return entityId === doc.projectId ? null : 'كيان الرابط لا ينتمي لنفس المشروع.';
    }
    case 'ipc': {
      const ipc = await ipcRepository.findById(entityId);
      if (!ipc) return 'المستخلص غير موجود';
      if (!doc.projectId || ipc.projectId !== doc.projectId) return 'المستخلص لا ينتمي لنفس المشروع.';
      return null;
    }
    default:
      return null;
  }
}

documentsRouter.delete('/links/:linkId', requirePermission('archive.edit'), async (req: AuthedRequest, res) => {
  const linkId = String(req.params.linkId);
  const link = await documentLinkRepository.findById(linkId);
  if (!link) return res.status(404).json({ message: 'Link not found' });
  // WP-2.6: deleting a link is document edit scope, enforced on the
  // LINKED DOCUMENT'S project (existence hides through the same 404 path).
  const ctx = await requestContext(req);
  const document = await documentRepository.findById(link.documentId!);
  if (!document) return res.status(404).json({ message: 'Link not found' });
  if (!can(ctx, 'archive.edit', document.projectId ?? undefined))
    return res.status(404).json({ message: 'Link not found' });
  await documentLinkRepository.delete(linkId);
  auditService.log(req, 'unlink', 'document', link.documentId!, undefined, { entityType: link.entityType, entityId: link.entityId });
  res.status(204).end();
});

documentsRouter.patch('/:id/move', requireProjectAccess('archive.edit', scopeDocumentRow()), async (req: AuthedRequest, res) => {
  const existing = await documentRepository.findById(String(req.params.id));
  if (!existing) return res.status(404).json({ message: 'Document not found' });
  const updated = await documentRepository.update(existing.id, { folderId: req.body.folderId || null });
  res.json(updated);
});

documentsRouter.put('/:id', requireProjectAccess('archive.edit', scopeDocumentRow()), async (req: AuthedRequest, res) => {
  const parsed = documentSchema.partial().safeParse({
    ...req.body,
    tags: Array.isArray(req.body.tags) ? req.body.tags : parseTags(req.body.tags),
  });
  if(!parsed.success) return res.status(400).json({ message: 'بيانات المستند غير صالحة', issues: parsed.error.flatten() });
  const existing = await documentRepository.findById(String(req.params.id));
  if (!existing) return res.status(404).json({ message: 'المستند غير موجود' });
  // Cross-project move: WRITE on both sides (global edit already enforced).
  if (parsed.data.projectId !== undefined && (parsed.data.projectId || undefined) !== (existing.projectId ?? undefined)) {
    const ctx = await requestContext(req);
    if (!can(ctx, 'archive.edit', parsed.data.projectId || undefined))
      return res.status(403).json({ message: 'ليس لديك صلاحية: archive.edit' });
  }
  // merge with existing links: a PUT that changes only one side must still
  // satisfy the cross-project rule against the other (stored) side
  const newProjectId = parsed.data.projectId !== undefined ? parsed.data.projectId || undefined : existing.projectId;
  const newIpcId = parsed.data.ipcId !== undefined ? parsed.data.ipcId || undefined : existing.ipcId;
  const linkError = await checkIpcProject(newProjectId, newIpcId);
  if (linkError) return res.status(400).json({ message: linkError });
  const updated = await documentRepository.update(existing.id, {
    ...parsed.data,
    projectId: parsed.data.projectId || undefined,
    siteId: parsed.data.siteId || undefined,
    ipcId: parsed.data.ipcId || undefined,
    documentNumber: parsed.data.documentNumber || undefined,
    documentDate: parsed.data.documentDate || undefined,
  });
  auditService.log(req, 'update', 'document', existing.id, metaOnly(existing), updated && metaOnly(updated));
  res.json(updated);
});

documentsRouter.patch('/:id/status', requireProjectAccess('archive.edit', scopeDocumentRow()), async (req: AuthedRequest, res) => {
  const parsedStatus = documentStatusSchema.safeParse(req.body);
  if(!parsedStatus.success) return res.status(400).json({ message: 'حالة غير صالحة' });
  const existing = await documentRepository.findById(String(req.params.id));
  if (!existing) return res.status(404).json({ message: 'المستند غير موجود' });
  const updated = await documentRepository.update(existing.id, { status: parsedStatus.data.status });
  auditService.log(req, 'status-change', 'document', existing.id, { status: existing.status }, { status: parsedStatus.data.status });
  notificationService.create({
    type: 'document-status',
    title: `تغيير حالة مستند: ${existing.title}`,
    message: `${STATUS_AR[existing.status] ?? existing.status} ← ${STATUS_AR[parsedStatus.data.status] ?? parsedStatus.data.status} بواسطة ${req.user!.fullName}`,
    link: `/archive?focus=${existing.id}`,
    entityId: existing.id,
    dedupe: false,
  });
  res.json(updated);
});

// --- PHASE 3: ZIP Export ---
documentsRouter.post('/export/zip', requirePermission('archive.download'), async (req: AuthedRequest, res) => {
  const documentIds = Array.isArray(req.body?.documentIds) ? req.body.documentIds : [];
  const folderIds = Array.isArray(req.body?.folderIds) ? req.body.folderIds : [];
  if (!Array.isArray(documentIds) || !Array.isArray(folderIds)) {
    return res.status(400).json({ message: 'Invalid payload' });
  }

  // WP-2.6: the archive is scoped with the DOWNLOAD key (not view) and by
  // project — a caller never receives rows from projects they cannot read.
  const ctx = await requestContext(req);
  const allDocs = filterVisible(ctx, await documentRepository.list(), (d) => d.projectId, 'archive.download');

  const wantedDocs = new Set(documentIds.map(String));
  const wantedFolders = new Set(folderIds.map(String));
  const selected = allDocs.filter((doc) =>
    wantedDocs.has(String(doc.id))
    || (doc.folderId && wantedFolders.has(String(doc.folderId))),
  );
  if (selected.length === 0) {
    // fail closed: an empty selection is an empty archive, never an error
    // that reveals whether the ids exist.
    const empty = new ZipArchive({ zlib: { level: 9 } });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="documents_export.zip"');
    empty.on('error', (err: any) => {
      if (!res.headersSent) res.status(500).send({ error: err.message });
    });
    empty.pipe(res);
    empty.finalize();
    return;
  }

  const archive = new ZipArchive({ zlib: { level: 9 } });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="documents_export.zip"');

  archive.on('error', (err: any) => {
    if (!res.headersSent) res.status(500).send({ error: err.message });
  });

  archive.pipe(res);

  const processedFiles = new Set();

  for (const doc of selected) {
    if (!doc.filePath) continue;
      if (!doc.filePath) continue;
      
      let fullPath: string;
      try {
        fullPath = fileStorageService.resolveAbsolute(doc.filePath);
      } catch { continue; }
      
      if (!fs.existsSync(fullPath)) continue;
      
      let nameInZip = doc.fileName || 'document.pdf';
      if (processedFiles.has(nameInZip)) {
         const parts = nameInZip.split('.');
         const ext = parts.pop();
         nameInZip = `${parts.join('.')}_${doc.id.split('-')[0]}.${ext}`;
      }
      processedFiles.add(nameInZip);

      archive.file(fullPath, { name: nameInZip });
    }
  }

  archive.finalize();
});

documentsRouter.post('/:id/replace', requireProjectAccess('archive.edit', scopeDocumentRow()), singleUpload('file'), async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const item = await documentRepository.findById(id);
  if (!item) return res.status(404).json({ message: 'المستند غير موجود' });
  if(!req.file) return res.status(400).json({ message: 'الملف مطلوب' });

  const uploadError = validateUpload(req.file);
  if (uploadError) {
    removeTempFile(req.file.path);
    return res.status(400).json({ message: uploadError, code: 'UNSUPPORTED_FILE_TYPE' });
  }
  const project = item.projectId ? await projectRepository.findById(item.projectId) : undefined;
  const originalName = repairFileName(req.file.originalname);
  const relativePath = fileStorageService.storeFromTemp(req.file.path, originalName, project?.projectCode, item.category);
  const oldPath = item.filePath;
  const updated = await documentRepository.update(id, {
    fileName: originalName,
    fileExtension: extOf(originalName),
    fileSize: req.file.size,
    filePath: relativePath,
  });
  // replace swaps the current file — clean the orphaned binary only if no
  // revision references it
  const allDocs = await documentRepository.list();
  if (oldPath && !allDocs.some((d) => d.filePath === oldPath || d.revisions.some((r: DocumentRevision) => r.filePath === oldPath)))
    removeStoredFile(oldPath);
  auditService.log(req, 'replace-file', 'document', id);
  res.json(updated);
});

documentsRouter.delete('/:id', requireProjectAccess('archive.delete', scopeDocumentRow()), async (req: AuthedRequest, res) => {
  const existing = await documentRepository.findById(String(req.params.id));
  if(!existing) return res.status(404).json({ message: 'المستند غير موجود' });
  const blocked = req.user?.roleName === 'admin' ? null : await deleteSafety.blockDocument(existing.id);
  if (blocked) {
    auditService.log(req, 'delete-blocked', 'document', existing.id);
    return res.status(409).json({ message: blocked });
  }
  await documentRepository.delete(existing.id);
  // remove binaries only after metadata deletion succeeded; keep nothing orphaned
  removeStoredFile(existing.filePath);
  for (const rev of existing.revisions) removeStoredFile(rev.filePath);
  auditService.log(req, 'delete', 'document', existing.id, metaOnly(existing));
  res.status(204).end();
});

const parseTags = (tags: unknown): string[] =>
  typeof tags === 'string'
    ? tags.split(',').map((s) => s.trim()).filter(Boolean)
    : Array.isArray(tags)
      ? tags.map(String)
      : [];

/**
 * multer/busboy may decode multipart filenames as Latin-1, producing mojibake
 * for Arabic names (عقد → Ø¹Ù‚Ø¯). Detect the typical double-encoding pattern
 * and repair to proper UTF-8; leave ASCII names untouched.
 */
const repairFileName = (name: string): string => {
  if (!name || !/[\u00C2-\u00C3\u00D8-\u00DA]/.test(name)) return name;
  try {
    const repaired = Buffer.from(name, 'latin1').toString('utf8');
    return /[\u0600-\u06FF]/.test(repaired) ? repaired : name;
  } catch {
    return name;
  }
};

const extOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

const nextRevisionLabel = (count: number) => String(count).padStart(2, '0');

/** metadata-only projection for audit logs */
const metaOnly = (doc: any) =>
  doc && { ...doc, revisions: doc.revisions.map((r: DocumentRevision) => ({ ...r, filePath: undefined })) };
