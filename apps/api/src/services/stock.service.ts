import type { StockTransaction } from '@cos/shared';
import { documentRepository } from '../repositories/document.repository';
import { warehouseRepository } from '../repositories/warehouse.repository';
import { itemRepository } from '../repositories/item.repository';
import { projectRepository } from '../repositories/project.repository';
import { siteRepository } from '../repositories/site.repository';
import { stockTransactionRepository } from '../repositories/stock-transaction.repository';
import { materialRequestRepository } from '../repositories/material-request.repository';
import { ipcItemRepository, ipcRepository } from '../repositories/ipc.repository';

/** Expand a transaction into per-item lines (handles legacy single-item rows). */
export const transactionLines = (tx: StockTransaction): Array<{ itemId: string; quantity: number; unitCost?: number }> => {
  if (tx.items?.length) return tx.items.map((l: { itemId: string; quantity: number; unitCost?: number }) => ({ itemId: l.itemId, quantity: l.quantity, unitCost: l.unitCost }));
  if (tx.itemId && typeof tx.quantity === 'number')
    return [{ itemId: tx.itemId, quantity: tx.quantity, unitCost: tx.unitCost }];
  return [];
};

const signedQty = (tx: StockTransaction, qty: number) => {
  switch (tx.type) {
    case 'IN':
    case 'RETURN':
      return qty;
    case 'OUT':
      return -qty;
    case 'ADJUSTMENT':
      return qty; // may be negative
    case 'TRANSFER':
      return -qty;
    default:
      return 0;
  }
};

const some = <T>(repo: { list(): T[] }, pred: (x: T) => boolean): boolean => repo.list().some(pred);

export class StockService {
  async listTransactions(): Promise<StockTransaction[]> {
    return await stockTransactionRepository.list();
  }

  async getCurrentStockByWarehouse() {
    const warehouses = await warehouseRepository.list();
    return await Promise.all(warehouses.map(async (warehouse) => ({
      warehouse,
      items: await this.stockForWarehouse(warehouse.id),
    })));
  }

  /** Net movement of one line for a given warehouse (transfers credit destination). */
  private lineDelta(tx: StockTransaction, warehouseId: string, itemId: string, qty: number): number {
    let delta = 0;
    if (tx.warehouseId === warehouseId) delta += signedQty(tx, qty);
    if (tx.type === 'TRANSFER' && tx.destinationWarehouseId === warehouseId) delta += qty;
    void itemId;
    return delta;
  }

  async stockForWarehouse(warehouseId: string, transactions?: StockTransaction[], items?: any[]) {
    const txs = transactions ?? await this.listTransactions();
    const itms = items ?? await itemRepository.list();
    return itms.map((item) => ({
      item,
      quantity: txs.reduce((sum, tx) => {
        let total = sum;
        for (const line of transactionLines(tx)) {
          if (line.itemId === item.id) total += this.lineDelta(tx, warehouseId, item.id, line.quantity);
        }
        return total;
      }, 0),
    }));
  }

  async totalStockPerItem() {
    const transactions = await this.listTransactions();
    const items = await itemRepository.list();
    return items.map((item) => ({
      item,
      // company-wide net is transfer-neutral (one out + one in cancel)
      quantity: transactions.reduce((sum, tx) => {
        let total = sum;
        for (const line of transactionLines(tx)) {
          if (line.itemId === item.id && tx.type !== 'TRANSFER') total += signedQty(tx, line.quantity);
          else if (line.itemId === item.id && tx.type === 'TRANSFER' && !tx.destinationWarehouseId)
            total += signedQty(tx, line.quantity);
        }
        return total;
      }, 0),
    }));
  }

  async lowStockItems() {
    const totals = await this.totalStockPerItem();
    return totals.filter(
      ({ item, quantity }: { item: any; quantity: number }) => typeof item.minimumStock === 'number' && item.minimumStock > 0 && quantity < item.minimumStock!,
    );
  }

  async summaryByType(): Promise<Record<string, number>> {
    const summary: Record<string, number> = { IN: 0, OUT: 0, TRANSFER: 0, ADJUSTMENT: 0, RETURN: 0 };
    const transactions = await this.listTransactions();
    for (const tx of transactions) {
      for (const line of transactionLines(tx)) summary[tx.type] = (summary[tx.type] ?? 0) + line.quantity;
    }
    return summary;
  }

  async availableQty(itemId: string, warehouseId: string): Promise<number> {
    const txs = await this.listTransactions();
    let qty = 0;
    for (const tx of txs) {
      for (const line of transactionLines(tx)) {
        if (line.itemId === itemId) qty += this.lineDelta(tx, warehouseId, itemId, line.quantity);
      }
    }
    return qty;
  }

  /**
   * Weighted Average Cost — the planned default inventory costing method.
   * Prepared now so future Procurement/receipt flows plug in without redesign.
   */
  async averageCost(itemId: string): Promise<number | undefined> {
    let totalCost = 0;
    let totalQty = 0;
    const txs = await this.listTransactions();
    for (const tx of txs) {
      // average cost is typically calculated on stock IN (additions)
      if (tx.type !== 'IN' && tx.type !== 'RETURN') continue;
      for (const line of transactionLines(tx)) {
        if (line.itemId !== itemId || !line.unitCost) continue;
        totalQty += line.quantity;
        totalCost += line.quantity * line.unitCost;
      }
    }
    return totalQty > 0 ? totalCost / totalQty : undefined;
  }
}

export class DeleteSafetyService {
  /** Returns an Arabic error message when deletion must be blocked, otherwise null. */
  async blockProject(id: string): Promise<string | null> {
    const documents = await documentRepository.list();
    if (documents.some((d) => d.projectId === id)) return 'لا يمكن حذف المشروع لارتباطه بمستندات.';
    const warehouses = await warehouseRepository.list();
    if (warehouses.some((w) => w.projectId === id)) return 'لا يمكن حذف المشروع لارتباطه بمخازن.';
    const transactions = await stockTransactionRepository.list();
    if (transactions.some((t) => t.projectId === id)) return 'لا يمكن حذف المشروع لارتباطه بحركات مخزنية.';
    const sites = await siteRepository.list();
    if (sites.some((s) => s.projectId === id)) return 'لا يمكن حذف المشروع لارتباطه بمواقع. احذف مواقعه أولاً.';
    return null;
  }

  async blockWarehouse(id: string): Promise<string | null> {
    const transactions = await stockTransactionRepository.list();
    if (
      transactions.some((t) => t.warehouseId === id || t.destinationWarehouseId === id)
    )
      return 'لا يمكن حذف المخزن لوجود حركات مخزنية عليه. يمكنك تغيير حالته إلى غير نشط بدلاً من الحذف.';
    return null;
  }

  async blockItem(id: string): Promise<string | null> {
    const transactions = await stockTransactionRepository.list();
    if (transactions.some((t) => transactionLines(t).some((l) => l.itemId === id)))
      return 'لا يمكن حذف الصنف لوجود حركات مخزنية عليه.';
    return null;
  }

  async blockMaterialRequest(id: string): Promise<string | null> {
    const mr = await materialRequestRepository.findById(id);
    if (!mr) return null;
    // Only untouched drafts may be removed. Any later state (submitted,
    // approved, issued, ...) means the request took part in the workflow or
    // produced stock movements that reference it.
    if (mr.status !== 'draft') return 'لا يمكن حذف طلب المواد بعد خروجه من حالة المسودة.';
    return null;
  }

  async blockDocument(id: string): Promise<string | null> {
    const doc = await documentRepository.findById(id);
    if (!doc) return null;
    // Nothing references documents by foreign key, so the risk is workflow
    // standing: only non-standing states (draft/rejected) may be hard-deleted.
    // Standing documents (submitted/under-review/approved/...) must go through
    // status transitions (supersede/archive), never physical deletion.
    if (doc.status !== 'draft' && doc.status !== 'rejected')
      return 'لا يمكن حذف المستند في حالته الحالية. استخدم الأرشفة أو الاستبدال بدل الحذف.';
    return null;
  }

  async blockBoqItem(id: string): Promise<string | null> {
    if (await ipcItemRepository.existsForBoqItem(id))
      return 'لا يمكن حذف البند لوجود مستخلصات مرتبطة به.';
    return null;
  }

  async blockIpc(id: string): Promise<string | null> {
    const ipc = await ipcRepository.findById(id);
    if (!ipc) return null;
    // Only untouched drafts may be removed; submitted/approved/rejected IPCs
    // carry financial standing (previous-quantity basis for later IPCs).
    if (ipc.status !== 'draft') return 'لا يمكن حذف المستخلص بعد خروجه من حالة المسودة.';
    return null;
  }
}

export const stockService = new StockService();
export const deleteSafety = new DeleteSafetyService();
