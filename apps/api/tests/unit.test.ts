/**
 * Unit tests for pure business logic — no DB required.
 * Tests: permissions, stock calculation, file path security, session hashing,
 * field matching, duplicate detection, row transformation, input validation.
 */
import { describe, it, expect } from 'vitest';
import { permissionOf, ROLE_PERMISSIONS, ALL_PERMISSIONS } from '@cos/shared';
import { transactionLines } from '../src/services/stock.service';
import { FileStorageService } from '../src/storage/file-storage';

// ─── RBAC Permissions ───────────────────────────────────────────────

describe('RBAC permissionOf()', () => {
  it('admin has ALL permissions', () => {
    const perms = permissionOf('admin');
    expect(perms.length).toBe(ALL_PERMISSIONS.length);
    for (const p of ALL_PERMISSIONS) {
      expect(perms).toContain(p);
    }
  });

  it('viewer has no write permissions', () => {
    const perms = permissionOf('viewer');
    expect(perms).not.toContain('archive.upload');
    expect(perms).not.toContain('archive.edit');
    expect(perms).not.toContain('archive.delete');
    expect(perms).not.toContain('users.manage');
    expect(perms).not.toContain('settings.manage');
    expect(perms).not.toContain('warehouse.stock_in');
  });

  it('warehouse role can stock_in/stock_out but NOT archive.upload', () => {
    const perms = permissionOf('warehouse');
    expect(perms).toContain('warehouse.stock_in');
    expect(perms).toContain('warehouse.stock_out');
    expect(perms).toContain('warehouse.transfer');
    expect(perms).not.toContain('archive.upload');
    expect(perms).not.toContain('archive.edit');
    expect(perms).not.toContain('users.manage');
  });

  it('technical role can upload archive but NOT stock operations', () => {
    const perms = permissionOf('technical');
    expect(perms).toContain('archive.upload');
    expect(perms).toContain('archive.edit');
    expect(perms).not.toContain('warehouse.stock_in');
    expect(perms).not.toContain('warehouse.stock_out');
  });

  it('management can approve material requests but NOT issue', () => {
    const perms = permissionOf('management');
    expect(perms).toContain('materialRequests.approve');
    expect(perms).not.toContain('materialRequests.issue');
    expect(perms).not.toContain('materialRequests.create');
  });

  it('unknown role defaults to viewer permissions', () => {
    const perms = permissionOf('nonexistent-role');
    expect(perms).toEqual(permissionOf('viewer'));
  });

  it('all 5 known roles are defined', () => {
    const roles = Object.keys(ROLE_PERMISSIONS);
    expect(roles).toContain('admin');
    expect(roles).toContain('management');
    expect(roles).toContain('warehouse');
    expect(roles).toContain('technical');
    expect(roles).toContain('viewer');
    expect(roles.length).toBe(5);
  });
});

// ─── Stock Transaction Lines ────────────────────────────────────────

describe('transactionLines()', () => {
  it('extracts from multi-item array', () => {
    const tx = { items: [{ itemId: 'a', quantity: 5 }, { itemId: 'b', quantity: 10 }] } as any;
    const lines = transactionLines(tx);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({ itemId: 'a', quantity: 5, unitCost: undefined });
    expect(lines[1]).toEqual({ itemId: 'b', quantity: 10, unitCost: undefined });
  });

  it('falls back to legacy single-item fields', () => {
    const tx = { itemId: 'legacy-item', quantity: 7, unitCost: 100 } as any;
    const lines = transactionLines(tx);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({ itemId: 'legacy-item', quantity: 7, unitCost: 100 });
  });

  it('returns empty for transaction with neither items array nor legacy fields', () => {
    expect(transactionLines({} as any)).toEqual([]);
    expect(transactionLines({ items: [] } as any)).toEqual([]);
  });
});

// ─── File Path Security ─────────────────────────────────────────────

describe('FileStorageService path security', () => {
  const svc = new FileStorageService();

  it('rejects path traversal with ../', () => {
    expect(() => svc.resolveAbsolute('../../../etc/passwd')).toThrow();
  });

  it('rejects path traversal with ..\\ ', () => {
    expect(() => svc.resolveAbsolute('..\\..\\..\\windows\\system32')).toThrow();
  });

  it('rejects empty path', () => {
    expect(() => svc.resolveAbsolute('')).toThrow();
  });

  it('rejects blank path', () => {
    expect(() => svc.resolveAbsolute('   ')).toThrow();
  });

  it('accepts valid relative path', () => {
    const result = svc.resolveAbsolute('documents/project/file.pdf');
    expect(result).toContain('documents');
    expect(result).toContain('file.pdf');
  });
});

// ─── Input Validation Schemas ───────────────────────────────────────

describe('Stock Transaction Schema', () => {
  // Import inline to avoid module resolution issues
  it('validates correctly', async () => {
    const { stockTransactionSchema } = await import('../src/modules/stock/stock.validators');
    
    const valid = stockTransactionSchema.safeParse({
      type: 'IN',
      warehouseId: 'w1',
      date: '2026-01-01',
      items: [{ itemId: 'i1', quantity: 10 }],
    });
    expect(valid.success).toBe(true);
  });

  it('rejects empty items array', async () => {
    const { stockTransactionSchema } = await import('../src/modules/stock/stock.validators');
    
    const result = stockTransactionSchema.safeParse({
      type: 'IN',
      warehouseId: 'w1',
      date: '2026-01-01',
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative quantity', async () => {
    const { stockTransactionSchema } = await import('../src/modules/stock/stock.validators');
    
    const result = stockTransactionSchema.safeParse({
      type: 'IN',
      warehouseId: 'w1',
      date: '2026-01-01',
      items: [{ itemId: 'i1', quantity: -5 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero quantity', async () => {
    const { stockTransactionSchema } = await import('../src/modules/stock/stock.validators');
    
    const result = stockTransactionSchema.safeParse({
      type: 'IN',
      warehouseId: 'w1',
      date: '2026-01-01',
      items: [{ itemId: 'i1', quantity: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid transaction type', async () => {
    const { stockTransactionSchema } = await import('../src/modules/stock/stock.validators');
    
    const result = stockTransactionSchema.safeParse({
      type: 'INVALID',
      warehouseId: 'w1',
      date: '2026-01-01',
      items: [{ itemId: 'i1', quantity: 5 }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid transaction types', async () => {
    const { stockTransactionSchema } = await import('../src/modules/stock/stock.validators');
    
    for (const type of ['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT', 'RETURN']) {
      const result = stockTransactionSchema.safeParse({
        type,
        warehouseId: 'w1',
        date: '2026-01-01',
        items: [{ itemId: 'i1', quantity: 1 }],
      });
      expect(result.success, `type ${type} should be valid`).toBe(true);
    }
  });
});

// ─── Smart Import: Field Matcher ────────────────────────────────────

describe('Smart Import: Field Matcher', () => {
  it('matches exact English headers', async () => {
    const { matchFields } = await import('../src/services/smart-import/field-matcher');
    const result = matchFields(['title', 'category', 'documentType', 'notes'], []);
    expect(result.mappings.some(m => m.systemField === 'title' && m.excelHeader === 'title')).toBe(true);
    expect(result.mappings.some(m => m.systemField === 'category' && m.excelHeader === 'category')).toBe(true);
  });

  it('matches common Arabic headers', async () => {
    const { matchFields } = await import('../src/services/smart-import/field-matcher');
    const result = matchFields(['العنوان', 'التصنيف', 'نوع المستند'], []);
    const titleMatch = result.mappings.find(m => m.excelHeader === 'العنوان');
    expect(titleMatch?.systemField).toBe('title');
    const categoryMatch = result.mappings.find(m => m.excelHeader === 'التصنيف');
    expect(categoryMatch?.systemField).toBe('category');
  });

  it('returns null systemField for unrecognized headers', async () => {
    const { matchFields } = await import('../src/services/smart-import/field-matcher');
    const result = matchFields(['xyzRandomCol123'], []);
    expect(result.mappings[0].systemField).toBeNull();
  });
});

// ─── Smart Import: Duplicate Detector ───────────────────────────────

describe('Smart Import: Duplicate Detector', () => {
  it('detects exact title duplicates', async () => {
    const { detectDuplicates } = await import('../src/services/smart-import/duplicate-detector');
    const newRows = [{ title: 'Contract A', category: 'عقود', documentNumber: 'DOC-001' }];
    const existing = [{ title: 'Contract A', category: 'عقود', documentNumber: 'DOC-001' }];
    const result = detectDuplicates(newRows as any, existing as any);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns empty for non-duplicate rows', async () => {
    const { detectDuplicates } = await import('../src/services/smart-import/duplicate-detector');
    const newRows = [{ title: 'Unique Document XYZ', category: 'other' }];
    const existing = [{ title: 'Totally Different', category: 'عقود' }];
    const result = detectDuplicates(newRows as any, existing as any);
    expect(result.length).toBe(0);
  });
});

// ─── Smart Import: Row Transformer ──────────────────────────────────

describe('Smart Import: Row Transformer', () => {
  it('transforms a row using field mapping', async () => {
    const { transformRow } = await import('../src/services/smart-import/row-transformer');
    const row = { 'العنوان': 'تقرير مالي', 'التصنيف': 'تقارير' };
    const result = transformRow(row, {
      mapping: [
        { excelHeader: 'العنوان', systemField: 'title' },
        { excelHeader: 'التصنيف', systemField: 'category' },
      ],
      projects: [],
      importedBy: 'admin',
    });
    expect(result.data.title).toBe('تقرير مالي');
    expect(result.data.category).toBe('تقارير');
  });

  it('skips unmapped columns (systemField=null)', async () => {
    const { transformRow } = await import('../src/services/smart-import/row-transformer');
    const row = { 'Extra': 'value', 'title': 'Doc' };
    const result = transformRow(row, {
      mapping: [
        { excelHeader: 'Extra', systemField: null },
        { excelHeader: 'title', systemField: 'title' },
      ],
      projects: [],
      importedBy: 'admin',
    });
    expect(result.data.title).toBe('Doc');
    expect((result.data as any)['Extra']).toBeUndefined();
  });
});
