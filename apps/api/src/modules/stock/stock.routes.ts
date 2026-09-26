import { Router } from 'express';
import { stockTransactionSchema } from './stock.validators';
import { stockTransactionRepository } from '../../repositories/stock-transaction.repository';
import { warehouseRepository } from '../../repositories/warehouse.repository';
import { itemRepository } from '../../repositories/item.repository';
import { requireAuth, requirePermission, requireAnyPermission, requestContext } from '../../middleware/auth';
import type { AuthedRequest } from '../../middleware/auth';
import { can } from '../../services/authorization.service';
import type { AuthzContext } from '../../services/authorization.service';
import { auditService } from '../../services/audit.service';
import { excelService } from '../../services/excel.service';
import { stockService } from '../../services/stock.service';
import type { StockTransactionType } from '@cos/shared';
import { createStockTransactionInternal } from './stock.factory';

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

stockRouter.get('/overview', requirePermission('warehouse.view'), async (_req, res) => {
  res.json({
    byWarehouse: await stockService.getCurrentStockByWarehouse(),
    totalByItem: await stockService.totalStockPerItem(),
    lowStock: await stockService.lowStockItems(),
    summaryByType: await stockService.summaryByType(),
  });
});

stockRouter.get('/history', requirePermission('warehouse.view'), async (req: AuthedRequest, res) => {
  res.json(await listTxsPaged(req.query, await requestContext(req), await warehouseProjectMap()));
});

stockRouter.get('/transactions', requirePermission('warehouse.view'), async (req: AuthedRequest, res) => {
  res.json(await listTxsPaged(req.query, await requestContext(req), await warehouseProjectMap()));
});

// keep legacy export path working
stockRouter.get('/transactions/export/xlsx', requirePermission('reports.view'), async (_req, res) => {
  await sendExport(res);
});

stockRouter.get('/export/xlsx', requirePermission('reports.view'), async (_req, res) => {
  await sendExport(res);
});

/** Warehouse → project map in one query (no per-row lookups). */
async function warehouseProjectMap(): Promise<Map<string, string | null>> {
  const whs = await warehouseRepository.list();
  return new Map(whs.map((w: { id: string; projectId?: string | null }) => [w.id, w.projectId ?? null]));
}

async function applyTxFilters(
  query: Record<string, unknown>,
  ctx: AuthzContext | null,
  whProject: Map<string, string | null>,
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
  if (!ctx || !can(ctx, 'warehouse.view')) return [];
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

async function sendExport(res: import('express').Response) {
  const data = await Promise.all((await stockTransactionRepository.list()).map(expandForExport));
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

    // per-type permission enforcement
    const needed = TYPE_PERMISSION[parsed.data.type];
    if (!req.user!.permissions.includes(needed))
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
