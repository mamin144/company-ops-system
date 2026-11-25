import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '@/i18n';
import { documents, items, projects, transactions, warehouses } from '@/services/api/adapters/mock/data';
import { EmptyState, SearchInput } from '@/shared/ui';

export const Search = () => {
  const { t, lang } = useLang();
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    if (q.trim().length < 2) return [];
    const has = (s: string) => s.includes(q.trim());
    return [
      { label: t('projects'), rows: projects.filter((p) => has(p.code + p.name)).map((p) => ({ to: `/projects/${p.id}`, text: `${p.code} — ${p.name}` })) },
      { label: t('archive'), rows: documents.filter((d) => has(d.title + d.number)).map((d) => ({ to: '/archive', text: `${d.number} — ${d.title}` })) },
      { label: t('inventory'), rows: [...warehouses.filter((w) => has(w.code + w.name)).map((w) => ({ to: '/inventory/warehouses', text: `${w.code} — ${w.name}` })), ...items.filter((i) => has(i.code + i.name)).map((i) => ({ to: '/inventory/items', text: `${i.code} — ${i.name}` })), ...transactions.filter((x) => has(x.number)).map((x) => ({ to: '/inventory/stock', text: x.number }))] },
    ].filter((g) => g.rows.length > 0);
  }, [q, t]);
  return (
    <div>
      <div className="cmdHead"><div><h1>{t('search')}</h1><p className="muted small">{t('searchDemoNote')}</p></div></div>
      <div className="toolbar" role="search"><span className="grow"><SearchInput label={t('search')} value={q} onChange={setQ} placeholder={t('searchPh')} /></span></div>
      {q.trim().length < 2 ? <div className="panel"><EmptyState icon="search" title={t('typeTwoChars')} /></div>
        : groups.length === 0 ? <div className="panel"><EmptyState icon="search" title={t('noResults')} /></div> : (
          groups.map((g) => (
            <section className="panel" key={g.label} aria-label={g.label}>
              <h2>{g.label} ({g.rows.length})</h2>
              {g.rows.map((r, i) => <p key={i}><Link to={r.to}>{r.text}</Link></p>)}
            </section>
          ))
        )}
    </div>
  );
};
