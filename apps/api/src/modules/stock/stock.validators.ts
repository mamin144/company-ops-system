import { z } from 'zod';

const lineSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitCost: z.coerce.number().nonnegative().optional(),
});

export const stockTransactionSchema = z.object({
  type: z.enum(['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT', 'RETURN']),
  warehouseId: z.string().min(1),
  destinationWarehouseId: z.string().optional().or(z.literal('')),
  projectId: z.string().optional().or(z.literal('')),
  referenceNumber: z.string().optional(),
  date: z.string().min(1),
  notes: z.string().optional(),
  items: z.array(lineSchema).min(1),
});
