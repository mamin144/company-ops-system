import { useMemo, useState } from 'react';
import { useAuth } from '@/app/providers/auth';
import { useLang } from '@/i18n';
import { items } from '@/services/api/adapters/mock/data';
import type { Item } from '@/services/api/adapters/mock/data';
import { ContextualExport } from '@/shared/ui/ContextualExport';
import { Badge, Button, ConfirmDialog, EmptyState, Field, Modal, Pager, RecCell, RecHead, RecRow, RecShell, SearchInput, SortHeader, TextInput, useToast } from '@/shared/ui';

const T = '1.6fr 1fr 1fr auto';
const PAGE_SIZE = 5;

export const Items = () => {
  const { can } = useAuth();
  const { t } = useLang();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(items);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [del, setDel] = useState<string | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [eName, setEName] = useState('');
  const [eCategory, setECategory] = useState('');
  const [eUnit, setEUnit] = useState('');
  const [eMin, setEMin] = useState('');
  const openEdit = (i: Item) => {
    setEditing(i);
    setEName(i.name); setECategory(i.category); setEUnit(i.unit);
    setEMin(i.minimumStock === undefined ? '' : String(i.minimumStock));
  };
  const [sortBy, setSortBy] = useState<'code' | 'name' | 'category' | 'safety'>('code');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const filtered = useMemo(
    () => rows.filter((i) => !q || (i.code + i.name + i.category).includes(q)),
    [rows, q],
  );

  /** Stable, locale-aware compare so Arabic and Latin columns both sort sanely. */
  const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  const sorted = useMemo(() => {
    const s = [...filtered];
    const sign = dir === 'asc' ? 1 : -1;
    s.sort((a, b) => {
      switch (sortBy) {
        case 'name': return sign * cmp(a.name, b.name);
        case 'category': return sign * (cmp(a.category, b.category) || cmp(a.code, b.code));
        case 'safety': {
          // undefined safety level sorts last in BOTH directions so "no level
          // set" never masquerades as the smallest number.
          const av = a.minimumStock ?? -1, bv = b.minimumStock ?? -1;
          const na = a.minimumStock === undefined, nb = b.minimumStock === undefined;
          if (na !== nb) return na ? 1 : -1;
          return sign * (av - bv) || cmp(a.code, b.code);
        }
        default: return sign * cmp(a.code, b.code);
      }
    });
    return s;
  }, [filtered, sortBy, dir]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const view = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const onSort = (k: string) => {
    if (sortBy === k) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(k as typeof sortBy); setDir('asc'); }
    setPage(0);
  };

  return (
    <div>
      <div className="cmdHead"><div>
        <div className="eyebrow"><Badge tone="blue">{t('itemsCountMock', { n: sorted.length })}</Badge></div>
        <h1>{t('itemsDirectory')}</h1>
      </div><div>{can('warehouse.create') && <Button variant="primary" onClick={() => setOpen(true)}>{t('newItem')}</Button>}</div></div>
      <div className="toolbar" role="search"><span className="grow"><SearchInput label={t('search')} value={q} onChange={(v) => { setQ(v); setPage(0); }} placeholder={t('searchPh')} /></span></div>
      {sorted.length === 0 ? (
        <div className="panel">
          <EmptyState icon="box" title={q ? t('noResults') : t('empty')} />
          <ContextualExport reportId="items" filter={{ ...(q ? { q } : {}), sortBy, sortDir: dir }} />
        </div>
      ) : (
        <div className="panel"><RecShell label={t('itemsDirectory')} template={T}>
          <RecHead template={T}>
            <RecCell head><SortHeader label={t('itemCodeName')} k="code" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
            <RecCell head><SortHeader label={t('itemCatUnit')} k="category" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
            <RecCell head><SortHeader label={t('safetyLevel')} k="safety" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
            <RecCell head>{t('actions')}</RecCell>
          </RecHead>
          {view.map((i) => (
            <RecRow key={i.id} template={T}>
              <RecCell k={t('itemCodeName')}><span className="num"><strong>{i.code}</strong></span><br />{i.name}</RecCell>
              <RecCell k={t('itemCatUnit')}>{i.category}<br /><span className="muted small">{i.unit}</span></RecCell>
              <RecCell k={t('safetyLevel')}>
                {typeof i.minimumStock === 'number'
                  ? <span className="num"><strong>{i.minimumStock}</strong></span>
                  : <span className="muted">—</span>}
              </RecCell>
              <RecCell><span className="recActions">
                {can('warehouse.edit') && <Button size="sm" onClick={() => openEdit(i)}>{t('edit')}</Button>}
                {can('warehouse.delete') && <Button size="sm" variant="danger" onClick={() => setDel(i.id)}>{t('deleteLabel')}</Button>}
              </span></RecCell>
            </RecRow>
          ))}
        </RecShell>
          <ContextualExport reportId="items" filter={{ ...(q ? { q } : {}), sortBy, sortDir: dir }} />
          <Pager page={safePage} pages={pages} total={sorted.length} pageSize={PAGE_SIZE} onPage={setPage} label={t('itemsDirectory')} />
        </div>
      )}
      <Modal title={t('newItemMock')} open={open} onClose={() => setOpen(false)}>
        <Field label={t('nameRequired')}><TextInput aria-label={t('nameRequired')} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="formActions">
          <Button variant="primary" disabled={!name.trim()} onClick={() => {
            setRows((r) => [...r, { id: `i-mock-${Date.now()}`, code: 'ITM-MOCK', name, category: t('otherCat'), unit: t('defaultPieceUnit') }]);
            setOpen(false); setName(''); toast('success', t('mockNote'));
          }}>{t('save')}</Button><Button onClick={() => setOpen(false)}>{t('cancel')}</Button>
        </div>
      </Modal>
      <ConfirmDialog open={!!del} text={t('confirmDeleteMock')} onConfirm={() => { setRows((r) => r.filter((x) => x.id !== del)); setDel(null); toast('success', t('mockNote')); }} onCancel={() => setDel(null)} />
      <Modal title={t('editItem')} open={!!editing} onClose={() => setEditing(null)}>
        <Field label={t('nameRequired')}><TextInput aria-label={t('nameRequired')} value={eName} onChange={(e) => setEName(e.target.value)} /></Field>
        <Field label={t('categoryLabel')}><TextInput aria-label={t('categoryLabel')} value={eCategory} onChange={(e) => setECategory(e.target.value)} /></Field>
        <Field label={t('unitLabel')}><TextInput aria-label={t('unitLabel')} value={eUnit} onChange={(e) => setEUnit(e.target.value)} /></Field>
        <Field label={t('minStockLabel')} error={eMin !== '' && !(Number(eMin) >= 0) ? t('qtyRule') : undefined}>
          <TextInput aria-label={t('minStockLabel')} type="number" min={0} value={eMin}
            onChange={(e) => setEMin(e.target.value)}
            placeholder={t('minStockLabel')} />
        </Field>
        <div className="formActions">
          <Button
            variant="primary"
            disabled={!eName.trim() || !eCategory.trim() || !eUnit.trim() || (eMin !== '' && !(Number(eMin) >= 0))}
            onClick={() => {
              setRows((r) => r.map((x) => (x.id === editing?.id
                ? { ...x, name: eName.trim(), category: eCategory.trim(), unit: eUnit.trim(), minimumStock: eMin === '' ? undefined : Number(eMin) }
                : x)));
              setEditing(null); toast('success', t('mockNote'));
            }}
          >{t('save')}</Button>
          <Button onClick={() => setEditing(null)}>{t('cancel')}</Button>
        </div>
      </Modal>
    </div>
  );
};