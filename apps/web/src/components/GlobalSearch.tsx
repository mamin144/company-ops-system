import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface Hit { id: string; title: string; subtitle?: string; link: string }
type Results = Partial<Record<'projects' | 'documents' | 'warehouses' | 'items' | 'transactions', Hit[]>>;

const LABELS: Record<string, string> = {
  projects: 'المشاريع',
  documents: 'المستندات',
  warehouses: 'المخازن',
  items: 'الأصناف',
  transactions: 'الحركات المخزنية',
};

export const GlobalSearch = () => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Results>({});
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults({});
      return;
    }
    const t = setTimeout(() => {
      void api.get<Results>(`/api/search?q=${encodeURIComponent(q)}`).then(setResults);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  const hasResults = Object.values(results).some((arr) => arr?.length);

  const go = (link: string) => {
    setOpen(false);
    setQ('');
    navigate(link);
  };

  return (
    <div className="globalSearch" ref={boxRef}>
      <div className="searchBox searchBox--wide">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="بحث شامل في النظام…"
        />
      </div>
      {open && hasResults ? (
        <div className="searchResults">
          {Object.entries(results).map(([group, hits]) =>
            hits && hits.length > 0 ? (
              <div key={group}>
                <div className="searchGroupTitle">{LABELS[group] ?? group}</div>
                {hits.map((h) => (
                  <button key={h.id} className="searchHit" onClick={() => go(h.link)}>
                    <strong>{h.title}</strong>
                    {h.subtitle ? <span className="muted small">{h.subtitle}</span> : null}
                  </button>
                ))}
              </div>
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  );
};
