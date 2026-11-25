import { Router } from 'express';
import { stockTransactionSchema } from './stock.validators.js';
import { stockTransactionRepository } from '../../repositories/stock-transaction.repository.js';
import { warehouseRepository } from '../../repositories/warehouse.repository.js';
import { itemRepository } from '../../repositories/item.repository.js';
import { requireAuth, requirePermission, requireAnyPermission, requestContext } from '../../middleware/auth.js';
import type { AuthedRequest } from '../../middleware/auth.js';
import { can } from '../../services/authorization.service.js';
import type { AuthzContext } from '../../services/authorization.service.js';
import { auditService } from '../../services/audit.service.js';
import { excelService } from '../../services/excel.service.js';
import { stockService } from '../../services/stock.service.js';
import type { StockTransactionType } from '@cos/shared';
import { createStockTransactionInternal } from './stock.factory.js';

const TYPE_PERMISSION: Record<StockTransactionType, string> = {
  IN: 'warehouse.stock_in',
  OUT: 'warehouse.stock_out',
  TRANSFER: 'warehouse.transfer',
  ADJUSTMENT: 'warehouse.adjust',
  RETURN: 'warehouse.return',
};

const expandForExport = async (tx: any) => {
  const itemCache = new Map<string, string>();
  const itemName = async (id?: string) => {
    if (!id) return '';
    if (itemCache.has(id)) return itemCache.get(id);
    const item = await itemRepository.findById(id);
    const name = item?.name ?? id;
    itemCache.set(id, name);
    return name;
  };

  const lines = tx.items?.length
    ? tx.items
    : tx.itemId && typeof tx.quantity === 'number'
      ? [{ itemId: tx.itemId, quantity: tx.quantity, unitCost: tx.unitCost }]
      : [];
      
  const itemIds = lines.map((l: { itemId: string; quantity: number; unitCost?: number }) => l.itemId);
  
  const formattedLines = await Promise.all(lines.map(async (l: { itemId: string; quantity: number; unitCost?: number }) => `${await itemName(l.itemId)} × ${l.quantity}`));
  
  return {
    number: tx.number,
    type: tx.type,
    date: tx.date,
    warehouseId: tx.warehouseId,
    destinationWarehouseId: tx.destinationWarehouseId,
    projectId: tx.projectId,
    referenceNumber: tx.referenceNumber,
    notes: tx.notes,
    itemIds,
    lines: formattedLines.join(' | '),
  };
};

export const stockRouter = Router();
stockRouter.use(requireAuth);

stockRouter.get('/overview', requirePermission('warehouse.view'), async (req: AuthedRequest, res) => {
  // WP-2.5: aggregates follow the same project scope as the transaction list;
  // otherwise per-warehouse/item totals leak other projects' stock.
  const ctx = await requestContext(req);
  const whProject = await warehouseProjectMap();
  const allowed = scopedProjectSet(ctx);
  const projectOf = (tx: any): string | null =>
    tx.projectId
      ?? (tx.warehouseId ? whProject.get(tx.warehouseId) ?? null : null)
      ?? (tx.destinationWarehouseId ? whProject.get(tx.destinationWarehouseId) ?? null : null)
      ?? null;
  const inScope = (pid: string | null) => allowed === null || !pid || allowed.has(pid);

  const warehouses = (await warehouseRepository.list()).filter((w: any) => inScope(w.projectId ?? null));
  const transactions = (await stockTransactionRepository.list()).filter((t: any) => inScope(projectOf(t)));

  res.json({
    byWarehouse: await Promise.all(warehouses.map(async (warehouse: any) => ({
      warehouse,
      items: await stockService.stockForWarehouse(warehouse.id, transactions),
    }))),
    totalByItem: await stockService.totalStockPerItem(transactions),
    lowStock: await stockService.lowStockItems(transactions),
    summaryByType: await stockService.summaryByType(transactions),
  });
});

stockRouter.get('/history', requirePermission('warehouse.view'), async (req: AuthedRequest, res) => {
  res.json(await listTxsPaged(req.query, await requestContext(req), await warehouseProjectMap()));
});

stockRouter.get('/transactions', requirePermission('warehouse.view'), async (req: AuthedRequest, res) => {
  res.json(await listTxsPaged(req.query, await requestContext(req), await warehouseProjectMap()));
});

// keep legacy export path working
stockRouter.get('/transactions/export/xlsx', requirePermission('reports.view'), async (req: AuthedRequest, res) => {
  await sendExport(res, await requestContext(req), await warehouseProjectMap());
});

stockRouter.get('/export/xlsx', requirePermission('reports.view'), async (req: AuthedRequest, res) => {
  await sendExport(res, await requestContext(req), await warehouseProjectMap());
});

/** Warehouse → project map in one query (no per-row lookups). */
async function warehouseProjectMap(): Promise<Map<string, string | null>> {
  const whs = await warehouseRepository.list();
  return new Map(whs.map((w: { id: string; projectId?: string | null }) => [w.id, w.projectId ?? null]));
}

/**
 * Allowed project set for the caller, or null for "sees everything"
 * (projects.access holders). Fail closed: a null context yields an empty set.
 */
function scopedProjectSet(ctx: AuthzContext | null): Set<string> | null {
  if (!ctx || !can(ctx, 'warehouse.view')) return new Set();
  if (can(ctx, 'projects.access')) return null;
  return new Set((ctx.memberships ?? []).filter((m) => m.access !== 'NONE').map((m) => m.projectId));
}

async function applyTxFilters(
  query: Record<string, unknown>,
  ctx: AuthzContext | null,
  whProject: Map<string, string | null>,
  opts?: { viewKey?: string },
) {
  let items = await Promise.all((await stockTransactionRepository.list()).map(expandForExport));
  const q = String(query.q ?? '').toLowerCase();
  if (q)
    items = items.filter((t) =>
      [t.number, t.type, t.referenceNumber, t.notes].some((v) => v && String(v).toLowerCase().includes(q)),
    );
  if (query.type) items = items.filter((t) => t.type === String(query.type));
  if (query.projectId) items = items.filter((t) => t.projectId === String(query.projectId));
  if (query.itemId) items = items.filter((t) => t.itemIds.includes(String(query.itemId)));
  if (query.warehouseId)
    items = items.filter((t) => t.warehouseId === String(query.warehouseId) || t.destinationWarehouseId === String(query.warehouseId));
  if (query.from) items = items.filter((t) => t.date >= String(query.from));
  if (query.to) items = items.filter((t) => t.date <= String(query.to));
  // Phase 5: scope rows to member warehouse-projects (bypass sees all).
  // can() is pure over the cached context — no per-row queries.
  // Null context denies everything (fail closed); rows whose warehouse is
  // gone fall back to the global gate (scope undeterminable, pre-existing data).
  if (!ctx || !can(ctx, opts?.viewKey ?? 'warehouse.view')) return [];
  if (!can(ctx, 'projects.access')) {
    const allowed = new Set(
      (ctx.memberships ?? []).filter((m) => m.access !== 'NONE').map((m) => m.projectId),
    );
    items = items.filter((t) => {
      const pid = (t.warehouseId ? whProject.get(t.warehouseId) ?? null : null)
        ?? (t.destinationWarehouseId ? whProject.get(t.destinationWarehouseId) ?? null : null);
      return !pid || allowed.has(pid);
    });
  }
  items.sort((a, b) =>
    String(a.date).localeCompare(String(b.date)) * ((query.sortDir as string) === 'asc' ? 1 : -1),
  );
  return items;
}

/** Paged response shape — the same contract every list endpoint returns. */
async function listTxsPaged(
  query: Record<string, unknown>,
  ctx: AuthzContext | null,
  whProject: Map<string, string | null>,
) {
  const items = await applyTxFilters(query, ctx, whProject);
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(query.pageSize ?? 10) || 10));
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    page,
    pageSize,
  };
}

async function sendExport(
  res: import('express').Response,
  ctx: AuthzContext | null,
  whProject: Map<string, string | null>,
) {
  // WP-2.5: exports must respect project scope — never dump every transaction.
  const data = await applyTxFilters({}, ctx, whProject, { viewKey: 'reports.view' });
  const buffer = excelService.exportJson(
    data,
    'StockTransactions',
  );
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=stock-transactions.xlsx');
  res.send(buffer);
}

stockRouter.post(
  '/transactions',
  requireAnyPermission('warehouse.stock_in', 'warehouse.stock_out', 'warehouse.transfer', 'warehouse.adjust', 'warehouse.return'),
  async (req: AuthedRequest, res) => {
    const parsed = stockTransactionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'بيانات الحركة غير صالحة', issues: parsed.error.flatten() });

    // per-type permission enforcement — central authz (role/overrides + the
    // transaction's project scope), never the stale req.user snapshot.
    const needed = TYPE_PERMISSION[parsed.data.type];
    const ctx = await requestContext(req);
    const whProject = await warehouseProjectMap();
    const projectId = (parsed.data.projectId || undefined)
      ?? (parsed.data.warehouseId ? whProject.get(parsed.data.warehouseId) ?? undefined : undefined)
      ?? (parsed.data.destinationWarehouseId ? whProject.get(parsed.data.destinationWarehouseId) ?? undefined : undefined);
    if (!can(ctx, needed, projectId))
      return res.status(403).json({ message: `ليس لديك صلاحية ${needed}` });

    try {
      const created = await createStockTransactionInternal(parsed.data, req.user!, req);
      auditService.log(req, `stock-${parsed.data.type.toLowerCase()}`, 'stock-transaction', created.id, undefined, created);
      res.status(201).json(created);
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      res.status(status).json({ message: e instanceof Error ? e.message : 'خطأ غير متوقع' });
    }
  },
);

stockRouter.delete(
  '/transactions/:id',
  requireAnyPermission('warehouse.edit', 'settings.manage'),
  async (req: AuthedRequest, res) => {
    // FIX: Enforce immutable stock ledger — unconditionally.
    // Deleting a transaction removes its quantities from the dynamic balance without an audit trail of the reversal,
    // which can lead to negative balances and lost history. The 400 comes before the existence check on purpose:
    // deletion is never a valid operation here, for missing ids no less than for existing ones. Correct mistakes
    // with a reversing settlement/return movement instead.
    auditService.log(req, 'delete-blocked', 'stock-transaction', String(req.params.id));
    return res.status(400).json({ 
      message: 'لا يمكن حذف حركات المخزون للحفاظ على سلامة البيانات. قم بإنشاء حركة تسوية أو إرجاع بدلاً من ذلك.' 
    });
  },
);
