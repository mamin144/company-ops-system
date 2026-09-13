import type { AuthedRequest } from '../../middleware/auth';
import type { SafeUser, StockTransaction, StockTransactionType } from '@cos/shared';
import { stockTransactionRepository } from '../../repositories/stock-transaction.repository';
import { itemRepository } from '../../repositories/item.repository';
import { warehouseRepository } from '../../repositories/warehouse.repository';
import { projectRepository } from '../../repositories/project.repository';
import { nextNumber } from '../../services/numbering.service';
import { notificationService } from '../../services/notification.service';
import { stockService } from '../../services/stock.service';

const PREFIX: Record<StockTransactionType, string> = {
  IN: 'GIN',
  OUT: 'GOUT',
  TRANSFER: 'TRF',
  ADJUSTMENT: 'ADJ',
  RETURN: 'RET',
};

export interface CreateTxInput {
  type: StockTransactionType;
  warehouseId: string;
  destinationWarehouseId?: string;
  projectId?: string;
  referenceNumber?: string;
  date: string;
  notes?: string;
  items: Array<{ itemId: string; quantity: number; unitCost?: number }>;
}

/**
 * Single creation path used by the API routes and by Material Request issuing,
 * so numbering, validation and notifications stay consistent everywhere.
 * Stock balances are always derived from these rows — never stored manually.
 */
export const createStockTransactionInternal = async (
  input: CreateTxInput,
  user: SafeUser & { permissions: string[] },
  req?: AuthedRequest,
): Promise<StockTransaction> => {
  for (const line of input.items) {
    if (!await itemRepository.findById(line.itemId))
      throw Object.assign(new Error(`الصنف غير موجود: ${line.itemId}`), { status: 400 });
  }
  if (!await warehouseRepository.findById(input.warehouseId))
    throw Object.assign(new Error('المخزن غير موجود'), { status: 400 });
  if (input.type === 'TRANSFER') {
    if (!input.destinationWarehouseId) throw Object.assign(new Error('حدد المخزن الوجهة للتحويل'), { status: 400 });
    if (input.destinationWarehouseId === input.warehouseId)
      throw Object.assign(new Error('لا يمكن التحويل لنفس المخزن'), { status: 400 });
    if (!await warehouseRepository.findById(input.destinationWarehouseId))
      throw Object.assign(new Error('المخزن الوجهة غير موجود'), { status: 400 });
  }
  if (input.projectId && !await projectRepository.findById(input.projectId))
    throw Object.assign(new Error('المشروع غير موجود'), { status: 400 });

  const client = await import('../../database/connection').then(m => m.pool.connect());
  
  try {
    await client.query('BEGIN');

    // 1. Lock warehouses to serialize stock operations for them and prevent race conditions
    await client.query('SELECT 1 FROM warehouses WHERE id = $1 FOR UPDATE', [input.warehouseId]);
    if (input.type === 'TRANSFER' && input.destinationWarehouseId) {
      // order locks by UUID to prevent deadlocks
      if (input.warehouseId < input.destinationWarehouseId) {
        await client.query('SELECT 1 FROM warehouses WHERE id = $1 FOR UPDATE', [input.destinationWarehouseId]);
      } else {
        // we already locked the first one, now lock the destination (the other way around handles the lock order)
        await client.query('SELECT 1 FROM warehouses WHERE id = $1 FOR UPDATE', [input.destinationWarehouseId]);
      }
    }

    // 2. Validate sufficient stock for OUT and TRANSFER
    if (input.type === 'OUT' || input.type === 'TRANSFER') {
      for (const line of input.items) {
        const available = await stockService.availableQty(line.itemId, input.warehouseId);
        if (available < line.quantity) {
          throw Object.assign(new Error(`الرصيد غير كافٍ للصنف. المتاح ${available}، والمطلوب ${line.quantity}`), { status: 400 });
        }
      }
    }

    const created = await stockTransactionRepository.create({
      number: await nextNumber(PREFIX[input.type]),
      type: input.type,
      warehouseId: input.warehouseId,
      destinationWarehouseId: input.type === 'TRANSFER' ? input.destinationWarehouseId : undefined,
      projectId: input.projectId || undefined,
      items: input.items.map((l) => ({ itemId: l.itemId, quantity: l.quantity, unitCost: l.unitCost })),
      referenceNumber: input.referenceNumber || undefined,
      date: input.date,
      notes: input.notes,
      createdBy: user.username,
    }, client);

    await client.query('COMMIT');
    
    // low-stock notification after the movement lands
    // low-stock notification after the movement lands
    for(const line of input.items) {
      const item = await itemRepository.findById(line.itemId);
      if (!item?.minimumStock) continue;
      const totalStock = await stockService.totalStockPerItem();
      const total = totalStock.find((x: any) => x.item.id === line.itemId)?.quantity ?? 0;
      if (total < item.minimumStock) {
        notificationService.create({
          type: 'low-stock',
          title: `تنبيه مخزون منخفض: ${item.name}`,
          message: `الرصيد الحالي ${total} وهو أقل من حد الأمان (${item.minimumStock})`,
          link: '/stock',
          entityId: item.id,
          dedupe: true,
        });
      }
    }

    return created;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};
