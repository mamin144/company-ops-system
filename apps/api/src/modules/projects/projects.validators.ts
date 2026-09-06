import { z } from 'zod';

/**
 * Nullable text columns (region / role / notes / createdBy) come back from
 * GET as JSON null for legacy rows, and the edit form sends them back
 * verbatim. Accept null here but normalize to undefined so the repository
 * keeps its `string | undefined` contract: on create it becomes SQL NULL,
 * on update the column is left untouched (stable round-trip).
 */
const nullableText = z.string().optional().nullable().transform((v) => v ?? undefined);

export const projectSchema = z.object({
  projectCode: z.string().min(1),
  projectName: z.string().min(1),
  client: z.string().default(''),
  owner: z.string().default(''),
  mainContractor: z.string().default(''),
  siteLocation: z.string().default(''),
  region: nullableText,
  contractNumber: z.string().default(''),
  startDate: z.string().optional().or(z.literal('')),
  endDate: z.string().optional().or(z.literal('')),
  status: z.enum(['planned', 'active', 'on-hold', 'completed', 'cancelled']),
  role: z.enum(['main-contractor', 'subcontractor', 'direct-contractor']).optional().nullable().transform((v) => v ?? undefined),
  notes: nullableText,
  createdBy: nullableText,
});
