import type { Item, StockTransaction, Warehouse } from '@cos/shared';

export interface Overview {
  byWarehouse: Array<{ warehouse: Warehouse; items: Array<{ item: Item; quantity: number }> }>;
  totalByItem: Array<{ item: Item; quantity: number }>;
  lowStock: Array<{ item: Item; quantity: number }>;
  summaryByType: Record<string, number>;
}

export type { StockTransaction };
