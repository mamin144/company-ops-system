import { Router } from 'express';
import { existsSync, unlinkSync } from 'node:fs';
import multer from 'multer';
import { documentSchema, documentStatusSchema } from './documents.validators';
import { documentRepository } from '../../repositories/document.repository';
import { documentLinkRepository } from '../../repositories/document-link.repository';
import path from 'path';
import fs from 'fs';
import { ZipArchive } from 'archiver';
import { applyPagination, applySearch, applySort } from '../../services/filter.service';
import { fileStorageService } from '../../storage/file-storage';
import { projectRepository } from '../../repositories/project.repository';
import { ipcRepository } from '../../repositories/ipc.repository';
import { excelService } from '../../services/excel.service';
import { requireAuth, requirePermission } from '../../middleware/auth';
import type { AuthedRequest } from '../../middleware/auth';
import { auditService } from '../../services/audit.service';
import { notificationService } from '../../services/notification.service';
import { deleteSafety } from '../../services/stock.service';
import { createId } from '../../shared/id';
import { nowIso } from '../../shared/time';
import type { DocumentRevision } from '@cos/shared';

const upload = multer({
  dest: 'temp',
  // aligned with nginx client_max_body_size (50M); prevents disk-fill abuse
  limits: { fileSize: 50 * 1024 * 1024 },
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

documentsRouter.get('/', requirePermission('archive.view'), async (req, res) => {
  let items = await documentRepository.list();
  items = applySearch(items, String(req.query.q ?? ''), ['title', 'documentNumber', 'category', 'documentType', 'notes']);
  if (req.query.projectId) items = items.filter((item) => item.projectId === String(req.query.projectId));
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

documentsRouter.get('/export/xlsx', requirePermission('archive.view'), async (_req, res) => {
  const buffer = excelService.exportJson(await documentRepository.list(), 'Documents');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=documents.xlsx');
  res.send(buffer);
});

documentsRouter.get('/:id', requirePermission('archive.view'), async (req, res) => {
  const item = await documentRepository.findById(String(req.params.id));
  if (!item) return res.status(404).json({ message: 'المستند غير موجود' });
  res.json(item);
});

documentsRouter.get('/:id/revisions', requirePermission('archive.view'), async (req, res) => {
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
  svg: 'image/svg+xml',
  txt: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
};

const mimeFor = (ext: string) => MIME[ext.toLowerCase()] ?? 'application/octet-stream';

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
  if (item.isFolder) return res.status(400).json({ message: 'لا يمكن تحميل مجلد كملف' });
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

  res.setHeader('Content-Type', mimeFor(ext));
  res.setHeader('Content-Disposition', contentDisposition(inline ? 'inline' : 'attachment', fileName));
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

function requireAnyDownloadPermission() {
  return (req: AuthedRequest, res: import('express').Response, next: import('express').NextFunction) => {
    // inline preview needs view; explicit downloads need download permission unless they only have view
    if (req.user?.permissions.includes('archive.download') || req.user?.permissions.includes('archive.view')) next();
    else res.status(403).json({ message: 'ليس لديك صلاحية لعرض المستندات' });
  };
}

documentsRouter.post('/upload', requirePermission('archive.upload'), upload.single('file'), async (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ message: 'الملف مطلوب' });
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
  requirePermission('archive.edit'),
  upload.single('file'),
  async (req: AuthedRequest, res) => {
    const item = await documentRepository.findById(String(req.params.id));
    if (!item) return res.status(404).json({ message: 'المستند غير موجود' });
    if(!req.file) return res.status(400).json({ message: 'الملف مطلوب' });

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

documentsRouter.post('/:id/links', requirePermission('archive.edit'), async (req: AuthedRequest, res) => {
  const { entityType, entityId } = req.body;
  if (!entityType || !entityId) return res.status(400).json({ message: 'Missing entityType or entityId' });
  const existing = await documentRepository.findById(String(req.params.id));
  if (!existing) return res.status(404).json({ message: 'Document not found' });
  const link = await documentLinkRepository.link(existing.id, entityType, entityId);
  res.status(201).json(link);
});

documentsRouter.delete('/links/:linkId', requirePermission('archive.edit'), async (req: AuthedRequest, res) => {
  const linkId = String(req.params.linkId);
  const link = await documentLinkRepository.findById(linkId);
  if (!link) return res.status(404).json({ message: 'Link not found' });
  await documentLinkRepository.delete(linkId);
  res.status(204).end();
});

documentsRouter.patch('/:id/move', requirePermission('archive.edit'), async (req: AuthedRequest, res) => {
  const existing = await documentRepository.findById(String(req.params.id));
  if (!existing) return res.status(404).json({ message: 'Document not found' });
  const updated = await documentRepository.update(existing.id, { folderId: req.body.folderId || null });
  res.json(updated);
});

documentsRouter.put('/:id', requirePermission('archive.edit'), async (req: AuthedRequest, res) => {
  const parsed = documentSchema.partial().safeParse({
    ...req.body,
    tags: Array.isArray(req.body.tags) ? req.body.tags : parseTags(req.body.tags),
  });
  if(!parsed.success) return res.status(400).json({ message: 'بيانات المستند غير صالحة', issues: parsed.error.flatten() });
  const existing = await documentRepository.findById(String(req.params.id));
  if (!existing) return res.status(404).json({ message: 'المستند غير موجود' });
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

documentsRouter.patch('/:id/status', requirePermission('archive.edit'), async (req: AuthedRequest, res) => {
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
  const { documentIds = [], folderIds = [] } = req.body;
  if (!Array.isArray(documentIds) || !Array.isArray(folderIds)) {
    return res.status(400).json({ message: 'Invalid payload' });
  }

  // Basic implementation: fetch specified documents
  const allDocs = await documentRepository.list();
  
  const archive = new ZipArchive({ zlib: { level: 9 } });
  
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="documents_export.zip"');
  
  archive.on('error', (err: any) => {
    if (!res.headersSent) res.status(500).send({ error: err.message });
  });

  archive.pipe(res);

  const processedFiles = new Set();
  
  for (const doc of allDocs) {
    if (documentIds.includes(doc.id)) {
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

documentsRouter.post('/:id/replace', requirePermission('archive.edit'), upload.single('file'), async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const item = await documentRepository.findById(id);
  if (!item) return res.status(404).json({ message: 'المستند غير موجود' });
  if(!req.file) return res.status(400).json({ message: 'الملف مطلوب' });
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

documentsRouter.delete('/:id', requirePermission('archive.delete'), async (req: AuthedRequest, res) => {
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
