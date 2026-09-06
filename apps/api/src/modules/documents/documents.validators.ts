import { z } from 'zod';

export const DOCUMENT_STATUSES = ['draft', 'submitted', 'under-review', 'approved', 'rejected', 'superseded', 'archived'] as const;

export const documentSchema = z.object({
  projectId: z.string().optional().or(z.literal('')),
  siteId: z.string().optional().or(z.literal('')),
  ipcId: z.string().optional().or(z.literal('')),
  title: z.string().min(1),
  documentNumber: z.string().optional().or(z.literal('')),
  category: z.string().min(1),
  documentType: z.string().optional().or(z.literal('')).transform(v => v || 'غير محدد'),
  revision: z.string().optional().or(z.literal('')),
  documentDate: z.string().optional().or(z.literal('')),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export const documentStatusSchema = z.object({
  status: z.enum(DOCUMENT_STATUSES),
});
