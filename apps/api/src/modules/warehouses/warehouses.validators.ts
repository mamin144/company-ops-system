import { z } from 'zod';

export const warehouseSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['central', 'site']),
  projectId: z.string().optional().or(z.literal('')),
  location: z.string().optional(),
  status: z.enum(['active', 'inactive']),
  notes: z.string().optional(),
});

export const itemSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  unit: z.string().min(1),
  brand: z.string().optional(),
  minimumStock: z.coerce.number().nonnegative().optional(),
  trackingType: z.enum(['none', 'batch', 'serial']).optional(),
  notes: z.string().optional(),
});
