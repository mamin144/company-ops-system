import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, buildQuery } from '../lib/api';
import type { Paged } from '../lib/api';

export interface ListState {
  q: string;
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  filters: Record<string, string>;
}

export const usePagedList = <T extends { id: string }>(endpoint: string) => {
  const [state, setState] = useState<ListState>({ q: '', page: 1, pageSize: 10, sortBy: undefined, sortDir: undefined, filters: {} });
  const [debouncedQ, setDebouncedQ] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [data, setData] = useState<Paged<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clearTimeout(debounceRef.current ?? undefined);
    debounceRef.current = setTimeout(() => setDebouncedQ(state.q), 350);
    return () => clearTimeout(debounceRef.current ?? undefined);
  }, [state.q]);

  const query = useMemo(
    () => buildQuery({ ...state.filters, q: debouncedQ, page: state.page, pageSize: state.pageSize, sortBy: state.sortBy, sortDir: state.sortDir }),
    [state.filters, debouncedQ, state.page, state.pageSize, state.sortBy, state.sortDir],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Paged<T>>(`${endpoint}${query}`);
      // normalize: never trust response shape — a malformed payload must not
      // reach render code and crash the page
      if (res && Array.isArray((res as Paged<T>).items)) {
        setData({
          items: (res as Paged<T>).items ?? [],
          total: Number((res as Paged<T>).total ?? 0),
          page: Number((res as Paged<T>).page ?? 1),
          pageSize: Number((res as Paged<T>).pageSize ?? 10),
        });
      } else {
        setData(null);
        setError('استجابة غير متوقعة من الخادم');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  }, [endpoint, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const setQ = (q: string) => setState((s) => ({ ...s, q, page: 1 }));
  const setPage = (page: number) => setState((s) => ({ ...s, page }));
  const setPageSize = (pageSize: number) => setState((s) => ({ ...s, pageSize, page: 1 }));
  const setFilter = (key: string, value: string) => setState((s) => ({ ...s, filters: { ...s.filters, [key]: value }, page: 1 }));
  const clearFilters = () => setState((s) => ({ ...s, q: '', filters: {}, page: 1 }));
  const toggleSort = (sortBy: string) =>
    setState((s) => ({ ...s, sortBy, sortDir: s.sortBy === sortBy && s.sortDir === 'asc' ? 'desc' : 'asc' }));

  return { state, data, loading, error, reload: load, setQ, setPage, setPageSize, setFilter, clearFilters, toggleSort };
};
