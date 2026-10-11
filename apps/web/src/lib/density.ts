import { useCallback, useEffect, useState } from 'react';

export type TableDensity = 'comfortable' | 'compact';

const STORAGE_KEY = 'cos_table_density';

/** Table density (default comfortable). Applied as [data-density] on <html>,
 *  consumed by the `.table` system in styles.css — reusable, never per-page. */
export const getDensity = (): TableDensity =>
  typeof document !== 'undefined' &&
  document.documentElement.dataset.density === 'compact'
    ? 'compact'
    : 'comfortable';

export const setDensity = (d: TableDensity) => {
  if (d === 'compact') document.documentElement.dataset.density = 'compact';
  else delete document.documentElement.dataset.density;
  try {
    localStorage.setItem(STORAGE_KEY, d);
  } catch {
    /* storage unavailable */
  }
};

export const initDensity = () => {
  try {
    if (localStorage.getItem(STORAGE_KEY) === 'compact') setDensity('compact');
  } catch {
    /* storage unavailable */
  }
};

export const useDensity = () => {
  const [density, setDensityState] = useState<TableDensity>(getDensity);
  const toggle = useCallback(() => {
    setDensityState((d) => {
      const next: TableDensity = d === 'compact' ? 'comfortable' : 'compact';
      setDensity(next);
      return next;
    });
  }, []);
  useEffect(() => {
    const onStorage = () => setDensityState(getDensity());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return { density, toggle, setDensity: (d: TableDensity) => { setDensity(d); setDensityState(d); } };
};
