import { Router } from 'express';
import multer from 'multer';
import { excelService } from '../../services/excel.service';
import { projectRepository } from '../../repositories/project.repository';
import { warehouseRepository } from '../../repositories/warehouse.repository';
import { itemRepository } from '../../repositories/item.repository';
import { stockTransactionRepository } from '../../repositories/stock-transaction.repository';
import { projectSchema } from '../projects/projects.validators';
import { warehouseSchema, itemSchema } from '../warehouses/warehouses.validators';
import { stockTransactionSchema } from '../stock/stock.validators';
import { documentSchema } from '../documents/documents.validators';
import { boqSchema } from '../projects/boq.routes';
import { boqRepository } from '../../repositories/boq.repository';
import { documentRepository } from '../../repositories/document.repository';
import { requireAuth, requirePermission } from '../../middleware/auth';
import type { AuthedRequest } from '../../middleware/auth';
import type { BoqItem } from '@cos/shared';
import { auditService } from '../../services/audit.service';
import { importHistoryRepository } from '../../repositories/import-history.repository';
import { createId } from '../../shared/id';
import { nowIso } from '../../shared/time';

const ENTITY_PERMISSION: Record<string, string> = {
  projects: 'projects.create',
  warehouses: 'warehouse.create',
  items: 'warehouse.create',
  transactions: 'warehouse.stock_in',
  documents: 'archive.upload',
  boq: 'projects.edit',
};

const upload = multer({ storage: multer.memoryStorage() });

type Mapper = (row: Record<string, unknown>) => { value?: unknown; errors?: string[] };

const str = (row: Record<string, unknown>, key: string) => String(row[key] ?? '').trim();

const projectMapper: Mapper = (row) => {
  const errors: string[] = [];
  if (!str(row, 'projectCode')) errors.push('projectCode مطلوب');
  if (!str(row, 'projectName')) errors.push('projectName مطلوب');
  if (errors.length) return { errors };
  const parsed = projectSchema.safeParse({
    projectCode: str(row, 'projectCode'),
    projectName: str(row, 'projectName'),
    client: str(row, 'client'),
    owner: str(row, 'owner'),
    mainContractor: str(row, 'mainContractor'),
    siteLocation: str(row, 'siteLocation'),
    contractNumber: str(row, 'contractNumber'),
    startDate: str(row, 'startDate') || '',
    endDate: str(row, 'endDate') || '',
    status: str(row, 'status') || 'planned',
    notes: str(row, 'notes'),
  });
  if (!parsed.success) return { errors: Object.values(parsed.error.flatten().fieldErrors).flat().map(String) };
  return { value: parsed.data };
};

const warehouseMapper: Mapper = (row) => {
  const errors: string[] = [];
  if (!str(row, 'code')) errors.push('code مطلوب');
  if (!str(row, 'name')) errors.push('name مطلوب');
  if (errors.length) return { errors };
  const parsed = warehouseSchema.safeParse({
    code: str(row, 'code'),
    name: str(row, 'name'),
    type: str(row, 'type') || 'central',
    projectId: str(row, 'projectId'),
    location: str(row, 'location'),
    status: str(row, 'status') || 'active',
    notes: str(row, 'notes'),
  });
  if (!parsed.success) return { errors: Object.values(parsed.error.flatten().fieldErrors).flat().map(String) };
  return { value: parsed.data };
};

const itemMapper: Mapper = (row) => {
  const errors: string[] = [];
  if (!str(row, 'code')) errors.push('code مطلوب');
  if (!str(row, 'name')) errors.push('name مطلوب');
  if (errors.length) return { errors };
  const parsed = itemSchema.safeParse({
    code: str(row, 'code'),
    name: str(row, 'name'),
    category: str(row, 'category') || 'عام',
    unit: str(row, 'unit') || 'pcs',
    brand: str(row, 'brand'),
    minimumStock: str(row, 'minimumStock') || 0,
    notes: str(row, 'notes'),
  });
  if (!parsed.success) return { errors: Object.values(parsed.error.flatten().fieldErrors).flat().map(String) };
  return { value: parsed.data };
};

const transactionMapper: Mapper = (row) => {
  const errors: string[] = [];
  for (const key of ['type', 'itemId', 'warehouseId', 'quantity', 'date']) {
    if (!str(row, key)) errors.push(`${key} مطلوب`);
  }
  if (errors.length) return { errors };
  const parsed = stockTransactionSchema.safeParse({
    type: str(row, 'type'),
    itemId: str(row, 'itemId'),
    warehouseId: str(row, 'warehouseId'),
    destinationWarehouseId: str(row, 'destinationWarehouseId'),
    projectId: str(row, 'projectId'),
    quantity: str(row, 'quantity'),
    unitCost: str(row, 'unitCost') || undefined,
    referenceNumber: str(row, 'referenceNumber'),
    date: str(row, 'date'),
    notes: str(row, 'notes'),
  });
  if (!parsed.success) return { errors: Object.values(parsed.error.flatten().fieldErrors).flat().map(String) };
  return { value: parsed.data };
};

const documentsMapper: Mapper = (row) => {
  const errors: string[] = [];
  for (const key of ['title', 'category', 'documentType']) {
    if (!str(row, key)) errors.push(`${key} مطلوب`);
  }
  if (errors.length) return { errors };
  const parsed = documentSchema.safeParse({
    projectId: str(row, 'projectId'),
    title: str(row, 'title'),
    documentNumber: str(row, 'documentNumber'),
    category: str(row, 'category'),
    documentType: str(row, 'documentType'),
    revision: str(row, 'revision'),
    documentDate: str(row, 'documentDate'),
    uploadedBy: str(row, 'uploadedBy'),
    notes: str(row, 'notes'),
    tags: str(row, 'tags') ? str(row, 'tags').split(/[,،]/).map((t) => t.trim()).filter(Boolean) : [],
  });
  if (!parsed.success) return { errors: Object.values(parsed.error.flatten().fieldErrors).flat().map(String) };
  return {
    value: {
      ...parsed.data,
      fileName: str(row, 'fileName') || `${str(row, 'title')}.xlsx`,
      fileExtension: str(row, 'fileExtension') || 'xlsx',
      fileSize: Number(str(row, 'fileSize')) || 0,
      filePath: '',
    },
  };
};

const boqMapper: Mapper = (row) => {
  const errors: string[] = [];
  for (const key of ['projectCode', 'itemCode', 'description', 'unit']) {
    if (!str(row, key)) errors.push(`${key} مطلوب`);
  }
  if (errors.length) return { errors };
  // Excel cells arrive as strings — coerce numerics before validation so
  // invalid numbers surface as row errors instead of silent NaN rows.
  const parsed = boqSchema.safeParse({
    itemCode: str(row, 'itemCode'),
    description: str(row, 'description'),
    unit: str(row, 'unit'),
    quantity: Number(str(row, 'quantity')),
    unitPrice: Number(str(row, 'unitPrice')),
  });
  if (!parsed.success) return { errors: Object.values(parsed.error.flatten().fieldErrors).flat().map(String) };
  return { value: { ...parsed.data, projectCode: str(row, 'projectCode') } };
};

const templates: Record<string, Record<string, string>> = {
  projects: { projectCode: '', projectName: '', client: '', owner: '', mainContractor: '', siteLocation: '', contractNumber: '', startDate: '2026-01-01', endDate: '', status: 'planned', notes: '' },
  warehouses: { code: '', name: '', type: 'central', projectId: '', location: '', status: 'active', notes: '' },
  items: { code: '', name: '', category: '', unit: '', brand: '', minimumStock: '', notes: '' },
  transactions: { type: 'IN', itemId: '', warehouseId: '', destinationWarehouseId: '', projectId: '', quantity: '', unitCost: '', referenceNumber: '', date: '2026-01-01', notes: '' },
  documents: { projectId: '', title: '', documentNumber: '', category: '', documentType: '', revision: '', documentDate: '', uploadedBy: '', tags: '', notes: '', fileName: '', fileExtension: '', fileSize: '' },
  boq: { projectCode: '', itemCode: '', description: '', unit: '', quantity: '', unitPrice: '' },
};

const mappers: Record<string, Mapper> = {
  projects: projectMapper,
  warehouses: warehouseMapper,
  items: itemMapper,
  transactions: transactionMapper,
  documents: documentsMapper,
  boq: boqMapper,
};

export const importRouter = Router();
importRouter.use(requireAuth);

importRouter.get('/history', requirePermission('settings.manage'), async (_req, res) => {
  res.json([...(await importHistoryRepository.list())].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 100));
});

// ---------------------------------------------------------------------------
// Smart Excel Recovery — flexible header matching, preview, and import
// ---------------------------------------------------------------------------
import { matchFields } from '../../services/smart-import/field-matcher.js';
import { transformRow } from '../../services/smart-import/row-transformer.js';
import { detectDuplicates } from '../../services/smart-import/duplicate-detector.js';

/**
 * Step 1 — Upload Excel, return sheet names + auto-matched field mappings.
 */
importRouter.post('/smart/analyze', upload.single('file'), requirePermission('archive.upload'), async (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ message: 'ملف Excel مطلوب' });
  try {
    const sheetNames = excelService.getSheetNames(req.file.buffer);
    const selectedSheet = String(req.body?.sheetName ?? sheetNames[0]);
    const { headers, rows, totalRows } = excelService.previewSheet(req.file.buffer, selectedSheet);
    if (!headers.length) return res.status(400).json({ message: 'الشيت فارغ أو لا يحتوي على رؤوس أعمدة' });
    const mapping = matchFields(headers, rows.slice(0, 10));
    res.json({
      sheetNames,
      selectedSheet,
      totalRows,
      mapping,
      sampleRows: rows.slice(0, 5),
    });
  } catch {
    res.status(400).json({ message: 'تعذر قراءة ملف الإكسل' });
  }
});

/**
 * Step 2 — With confirmed mapping, transform rows and return preview + validation.
 */
importRouter.post('/smart/preview', upload.single('file'), requirePermission('archive.upload'), async (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ message: 'ملف Excel مطلوب' });
  try {
    let confirmedMapping: Array<{ excelHeader: string; systemField: string | null }> = [];
    if (Array.isArray(req.body?.mapping)) {
      confirmedMapping = req.body.mapping;
    } else if (typeof req.body?.mapping === 'string') {
      try {
        confirmedMapping = JSON.parse(req.body.mapping);
      } catch {}
    }
    const sheetName = String(req.body?.sheetName ?? '');
    const { rows } = excelService.previewSheet(req.file.buffer, sheetName || undefined);
    const projects = await projectRepository.list();
    const existingDocs = await documentRepository.list();

    const validRows: Record<string, unknown>[] = [];
    const invalidRows: Array<{ rowNumber: number; errors: string[]; row: Record<string, unknown> }> = [];
    const allWarnings: Array<{ rowNumber: number; warnings: string[] }> = [];

    for (let i = 0; i < rows.length; i++) {
      const { data, warnings } = transformRow(rows[i], {
        mapping: confirmedMapping,
        projects,
        importedBy: req.user!.fullName ?? req.user!.username,
      });

      // Validate required fields
      const errors: string[] = [];
      if (!data.title || !String(data.title).trim()) errors.push('عنوان المستند مطلوب');
      if (!data.category || !String(data.category).trim()) errors.push('التصنيف مطلوب');

      if (errors.length) {
        invalidRows.push({ rowNumber: i + 2, errors, row: data });
      } else {
        // Add file placeholders for metadata-only import
        if (!data.fileName) data.fileName = `${String(data.title)}.xlsx`;
        if (!data.fileExtension) data.fileExtension = 'xlsx';
        if (!data.fileSize) data.fileSize = 0;
        if (!data.filePath) data.filePath = '';
        validRows.push(data);
      }

      if (warnings.length) {
        allWarnings.push({ rowNumber: i + 2, warnings });
      }
    }

    // Detect duplicates among valid rows
    const duplicates = detectDuplicates(validRows, existingDocs);

    res.json({ validRows, invalidRows, warnings: allWarnings, duplicates, totalRows: rows.length });
  } catch {
    res.status(400).json({ message: 'تعذر معالجة ملف الإكسل' });
  }
});

/**
 * Step 3 — Execute the import with pre-validated rows.
 */
importRouter.post('/smart/confirm', requirePermission('archive.upload'), async (req: AuthedRequest, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const skipDuplicates = req.body?.skipDuplicates ?? true;
  if (!rows.length) return res.status(400).json({ message: 'لا توجد صفوف صالحة للاستيراد' });

  // If skipDuplicates, remove rows flagged as duplicates
  const duplicateIndices = new Set<number>(
    Array.isArray(req.body?.duplicateIndices) ? req.body.duplicateIndices : []
  );

  let imported = 0;
  const failures: Array<{ index: number; errors: string[] }> = [];

  for (let i = 0; i < rows.length; i++) {
    if (skipDuplicates && duplicateIndices.has(i)) continue;

    const row = rows[i] as Record<string, unknown>;
    try {
      const parsed = documentSchema.safeParse({
        projectId: row.projectId ?? '',
        siteId: row.siteId ?? '',
        ipcId: row.ipcId ?? '',
        title: String(row.title ?? ''),
        documentNumber: row.documentNumber ?? '',
        category: String(row.category ?? ''),
        documentType: row.documentType ?? '',
        revision: row.revision ?? '',
        documentDate: row.documentDate ?? '',
        notes: row.notes ?? '',
        tags: Array.isArray(row.tags) ? row.tags : [],
      });

      if (!parsed.success) {
        failures.push({ index: i, errors: Object.values(parsed.error.flatten().fieldErrors).flat().map(String) });
        continue;
      }

      await documentRepository.create({
        ...parsed.data,
        folderId: undefined,
        fileName: String(row.fileName ?? `${parsed.data.title}.xlsx`),
        fileExtension: String(row.fileExtension ?? 'xlsx'),
        fileSize: Number(row.fileSize) || 0,
        filePath: String(row.filePath ?? ''),
        status: ((row.status as string) || 'draft') as import('@cos/shared').DocumentStatus,
        revision: String(parsed.data.revision ?? '00'),
        revisions: [],
        uploadedBy: String(row.uploadedBy ?? req.user!.fullName ?? req.user!.username),
      });
      imported += 1;
    } catch (e) {
      failures.push({ index: i, errors: [e instanceof Error ? e.message : 'فشل الاستيراد'] });
    }
  }

  // Log import history
  await importHistoryRepository.create({
    entity: 'documents',
    fileName: String(req.body?.fileName ?? 'smart-import.xlsx'),
    userId: req.user!.id,
    username: req.user!.username,
    date: nowIso(),
    totalRows: imported + failures.length,
    successfulRows: imported,
    failedRows: failures.length,
    errors: failures.slice(0, 50).map((f) => `صف ${f.index + 2}: ${f.errors.join('، ')}`),
  });
  auditService.log(req, 'smart-excel-import', 'documents', undefined, undefined, { imported, failed: failures.length });
  res.json({ imported, failed: failures.length, failures });
});


importRouter.get('/:entity/template', async (req, res) => {
  const entity = String(req.params.entity);
  const template = templates[entity];
  if (!template) return res.status(400).json({ message: 'Unknown entity' });
  const buffer = excelService.exportJson([template], entity);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${entity}-import-template.xlsx`);
  res.send(buffer);
});

importRouter.post('/:entity/preview', upload.single('file'), async (req: AuthedRequest, res) => {
  const entity = String(req.params.entity);
  const mapper = mappers[entity];
  if (!mapper) return res.status(400).json({ message: 'Unknown entity' });
  const perm = ENTITY_PERMISSION[entity];
  if (!perm) return res.status(400).json({ message: 'Unknown entity' });
  if (!req.user!.permissions.includes(perm))
    return res.status(403).json({ message: `ليس لديك صلاحية الاستيراد لهذه البيانات (${perm})` });
  if (!req.file) return res.status(400).json({ message: 'Excel file is required' });
  try {
    const result = excelService.preview(req.file.buffer, (row) => mapper(row));
    res.json(result);
  } catch {
    res.status(400).json({ message: 'تعذر قراءة ملف الإكسل' });
  }
});

importRouter.post('/:entity/confirm', async (req: AuthedRequest, res) => {
  const entity = String(req.params.entity);
  const perm = ENTITY_PERMISSION[entity];
  if (!perm || !mappers[entity]) return res.status(400).json({ message: 'Unknown entity' });
  if (!req.user!.permissions.includes(perm))
    return res.status(403).json({ message: `ليس لديك صلاحية الاستيراد لهذه البيانات (${perm})` });
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (!rows.length) return res.status(400).json({ message: 'لا توجد صفوف صالحة للاستيراد' });
  const repo = {
    projects: projectRepository,
    warehouses: warehouseRepository,
    items: itemRepository,
    transactions: stockTransactionRepository,
    documents: documentRepository,
    boq: boqRepository,
  }[entity]!;
  // BOQ rows carry projectCode (human-friendly); resolve once per import.
  const boqProjects = entity === 'boq' ? await projectRepository.list() : [];
  let imported = 0;
  const failures: Array<{ index: number; errors: string[] }> = [];
  // Sequential awaits: repository creates are asynchronous (PostgreSQL), so
  // each row must settle before counting it — otherwise failures would be
  // silently counted as successes.
  const rowsWithIndex = rows.map((row: Record<string, unknown>, index: number) => ({ row, index }));
  for (const { row, index } of rowsWithIndex) {
    const mapped = mappers[entity](row);
    if (mapped.errors?.length || !mapped.value) {
      failures.push({ index, errors: mapped.errors ?? [] });
      continue;
    }
    try {
      if (entity === 'boq') {
        const v = { ...(mapped.value as Record<string, unknown>) };
        const projectCode = String(v.projectCode ?? '');
        const project = boqProjects.find((p) => p.projectCode === projectCode);
        if (!project) {
          failures.push({ index, errors: [`المشروع غير موجود: ${projectCode}`] });
          continue;
        }
        delete v.projectCode;
        type BoqCreateInput = Omit<BoqItem, 'id' | 'createdAt' | 'updatedAt' | 'totalPrice' | 'projectId'>;
        await boqRepository.create({ projectId: project.id, ...(v as unknown as BoqCreateInput) });
      } else {
        await repo.create(mapped.value as never);
      }
      imported += 1;
    } catch (e) {
      failures.push({ index, errors: [e instanceof Error ? e.message : 'فشل الاستيراد'] });
    }
  }

  // import history — never silently lose track of what came from where
  await importHistoryRepository.create({
    entity,
    fileName: String(req.body?.fileName ?? `${entity}.xlsx`),
    userId: req.user!.id,
    username: req.user!.username,
    date: nowIso(),
    totalRows: imported + failures.length,
    successfulRows: imported,
    failedRows: failures.length,
    errors: failures.slice(0, 50).map((f) => `صف ${f.index + 2}: ${f.errors.join('، ')}`),
  });
  auditService.log(req, 'excel-import', entity, undefined, undefined, { imported, failed: failures.length });
  res.json({ imported, failed: failures.length, failures });
});

