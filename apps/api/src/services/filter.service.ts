import { includesNormalized, toNumber } from '@cos/shared';

export interface QueryOptions {
  q?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export const applySearch = <T>(items: T[], q?: string, fields: string[] = []) => {
  if (!q) return items;
  return items.filter((item) =>
    fields.some((field) => includesNormalized(String((item as Record<string, unknown>)[field] ?? ''), q)),
  );
};

export const applySort = <T>(items: T[], sortBy?: string, sortDir: 'asc' | 'desc' = 'desc') => {
  if (!sortBy) return items;
  const factor = sortDir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const av = (a as Record<string, unknown>)[sortBy];
    const bv = (b as Record<string, unknown>)[sortBy];
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
    return String(av ?? '').localeCompare(String(bv ?? ''), 'en') * factor;
  });
};

export const applyPagination = <T>(items: T[], page = 1, pageSize = 20) => {
  const safePage = Math.max(1, toNumber(page, 1));
  const safeSize = Math.max(1, Math.min(200, toNumber(pageSize, 20)));
  const start = (safePage - 1) * safeSize;
  return { items: items.slice(start, start + safeSize), total: items.length, page: safePage, pageSize: safeSize };
};
