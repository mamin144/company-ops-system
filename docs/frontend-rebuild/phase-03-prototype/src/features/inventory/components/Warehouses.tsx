import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth';
import { useLang } from '@/i18n';
import { mockApi, mrApi, projName } from '@/services/api';
import type { Project, Warehouse } from '@/services/api/adapters/mock/data';
import { parseCsv } from '@/shared/lib/files';
import { ContextualExport } from '@/shared/ui/ContextualExport';
import { Badge, Button, ConfirmDialog, EmptyState, Field, Modal, Pager, RecCell, RecHead, RecRow, RecShell, SearchInput, Select, SortHeader, TextInput, useToast } from '@/shared/ui';

const T = '1.4fr 1.6fr 1fr auto';
const PAGE_SIZE = 5;

export const Warehouses = () => {
  const { can, user } = useAuth();
  const { t } = useLang();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [sp] = useSearchParams();
  // Deep-linkable project filter (project workspace links here with
  // ?project=<id>). Membership is enforced before filtering.
  const [project, setProject] = useState(() => sp.get('project') ?? '');
  // Seeded through the mock so project scoping applies: a warehouse belonging
  // to a project the identity is not a member of must not be listed at all.
  const [rows, setRows] = useState<Warehouse[]>([]);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [name, setName] = useState('');
  const [del, setDel] = useState<string | null>(null);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [eName, setEName] = useState('');
  const [eLocation, setELocation] = useState('');
  const [eType, setEType] = useState<'central' | 'site'>('site');
  const [eStatus, setEStatus] = useState<'active' | 'inactive'>('active');
  const openEdit = (w: Warehouse) => {
    setEditing(w);
    setEName(w.name); setELocation(w.location); setEType(w.type); setEStatus(w.status);
  };
  const [sortBy, setSortBy] = useState<'code' | 'name' | 'type' | 'location' | 'project'>('code');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  useEffect(() => { mockApi.warehouses(user?.id).then(setRows); }, [user?.id]);

  const filtered = useMemo(
    () => rows.filter((w) =>
      (!q || (w.code + w.name + w.location).includes(q)) &&
      (!project || w.projectId === project)),
    [rows, q, project],
  );
  const projDenied = project !== '' && !mrApi.projects(user?.id).some((p) => p.id === project);

  const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  const sorted = useMemo(() => {
    const s = [...filtered];
    const sign = dir === 'asc' ? 1 : -1;
    s.sort((a, b) => {
      switch (sortBy) {
        case 'name': return sign * cmp(a.name, b.name);
        case 'type': return sign * (cmp(a.type, b.type) || cmp(a.code, b.code));
        case 'location': return sign * (cmp(a.location, b.location) || cmp(a.code, b.code));
        case 'project': return sign * (cmp(a.projectId ?? '', b.projectId ?? '') || cmp(a.code, b.code));
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
        <div className="eyebrow"><Badge tone="blue">{t('warehousesCountMock', { n: sorted.length })}</Badge></div>
        <h1>{t('warehouses')}</h1>
      </div><div>{can('warehouse.create') && <Button variant="primary" onClick={() => setOpen(true)}>{t('newWarehouse')}</Button>}{' '}
        {can('warehouse.create') && <Button onClick={() => setImportOpen(true)}>{t('importCsvBtn')}</Button>}</div></div>
      <div className="toolbar" role="search">
        <span className="grow"><SearchInput label={t('search')} value={q} onChange={(v) => { setQ(v); setPage(0); }} placeholder={t('searchPh')} /></span>
        <Select value={project} onChange={(e) => { setProject(e.target.value); setPage(0); }} aria-label={t('projectFilter')}>
          <option value="">{t('allProjects')}</option>
          {mrApi.projects(user?.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        {(q || project) && <Button onClick={() => { setQ(''); setProject(''); setPage(0); }}>{t('clearFilters')}</Button>}
      </div>
      {projDenied ? <div className="panel"><EmptyState icon="alert" title={t('mrFilterDenied')} hint={t('noProjectsScopedHint')} /></div>
        : sorted.length === 0 ? (
        <div className="panel">
          <EmptyState icon="box" title={q ? t('noResults') : t('empty')} />
          <ContextualExport reportId="warehouses" filter={{ ...(q ? { q } : {}), sortBy, sortDir: dir }} />
        </div>
      ) : (
        <div className="panel"><RecShell label={t('warehouses')} template={T}>
          <RecHead template={T}>
            <RecCell head><SortHeader label={t('whCodeName')} k="code" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
            <RecCell head><SortHeader label={t('whTypeLoc')} k="type" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
            <RecCell head><SortHeader label={t('whProjectCol')} k="project" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
            <RecCell head>{t('actions')}</RecCell>
          </RecHead>
          {view.map((w) => (
            <RecRow key={w.id} template={T}>
              <RecCell k={t('whCodeName')}><span className="num"><strong>{w.code}</strong></span><br />{w.name}</RecCell>
              <RecCell k={t('whTypeLoc')}>
                <Badge tone={w.type === 'central' ? 'blue' : 'gray'}>{w.type === 'central' ? t('centralType') : t('siteType')}</Badge>
                <br /><span className="muted small">{w.location}</span>
              </RecCell>
              <RecCell k={t('whProjectCol')}>
                {w.projectId
                  ? <>{projName(w.projectId)}<br /><Badge tone={w.status === 'active' ? 'green' : 'gray'}>{w.status === 'active' ? t('activeSt') : t('inactiveWh')}</Badge></>
                  : <><span className="muted">—</span><br /><Badge tone={w.status === 'active' ? 'green' : 'gray'}>{w.status === 'active' ? t('activeSt') : t('inactiveWh')}</Badge></>}
              </RecCell>
              <RecCell><span className="recActions">
                {can('warehouse.edit') && <Button size="sm" onClick={() => openEdit(w)}>{t('edit')}</Button>}
                {can('warehouse.delete') && <Button size="sm" variant="danger" onClick={() => setDel(w.id)}>{t('deleteLabel')}</Button>}
              </span></RecCell>
            </RecRow>
          ))}
        </RecShell>
          <ContextualExport reportId="warehouses" filter={{ ...(q ? { q } : {}), sortBy, sortDir: dir }} />
          <Pager page={safePage} pages={pages} total={sorted.length} pageSize={PAGE_SIZE} onPage={setPage} label={t('warehouses')} />
        </div>
      )}
      <Modal title={t('newWarehouseMock')} open={open} onClose={() => setOpen(false)}>
        <Field label={t('nameRequired')}><TextInput aria-label={t('nameRequired')} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="formActions">
          <Button variant="primary" disabled={!name.trim()} onClick={() => {
            setRows((r) => [...r, { id: `w-mock-${Date.now()}`, code: 'WH-MOCK', name, type: 'site' as const, location: '—', status: 'active' as const }]);
            setOpen(false); setName(''); toast('success', t('mockNote'));
          }}>{t('save')}</Button><Button onClick={() => setOpen(false)}>{t('cancel')}</Button>
        </div>
      </Modal>
      <ConfirmDialog open={!!del} text={t('confirmDeleteMock')} onConfirm={() => { setRows((r) => r.filter((x) => x.id !== del)); setDel(null); toast('success', t('mockNote')); }} onCancel={() => setDel(null)} />
      <Modal title={t('importWhTitle')} open={importOpen} onClose={() => setImportOpen(false)} wide>
        <ImportWarehouses
          existing={rows}
          visibleProjects={mrApi.projects(user?.id)}
          onDone={(added, skipped) => {
            setImportOpen(false);
            setRows((r) => [...added.map((w, i) => ({ ...w, id: `w-imp-${Date.now()}-${i}` })), ...r]);
            setPage(0);
            toast('success', t('summaryLine', { a: `+${added.length}`, b: skipped }));
          }}
          onCancel={() => setImportOpen(false)}
        />
      </Modal>
      <Modal title={t('editWarehouse')} open={!!editing} onClose={() => setEditing(null)}>
        <Field label={t('nameRequired')}><TextInput aria-label={t('nameRequired')} value={eName} onChange={(e) => setEName(e.target.value)} /></Field>
        <Field label={t('locationLabel')}><TextInput aria-label={t('locationLabel')} value={eLocation} onChange={(e) => setELocation(e.target.value)} /></Field>
        <Field label={t('typeLabel')}>
          <Select aria-label={t('typeLabel')} value={eType} onChange={(e) => setEType(e.target.value as 'central' | 'site')}>
            <option value="central">{t('centralType')}</option>
            <option value="site">{t('siteType')}</option>
          </Select>
        </Field>
        <Field label={t('statusLabel')}>
          <Select aria-label={t('statusLabel')} value={eStatus} onChange={(e) => setEStatus(e.target.value as 'active' | 'inactive')}>
            <option value="active">{t('activeSt')}</option>
            <option value="inactive">{t('inactiveWh')}</option>
          </Select>
        </Field>
        <div className="formActions">
          <Button
            variant="primary" disabled={!eName.trim()}
            onClick={() => {
              setRows((r) => r.map((x) => (x.id === editing?.id
                ? { ...x, name: eName.trim(), location: eLocation.trim(), type: eType, status: eStatus }
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

/* ---------- warehouse CSV import (Phase 3.12) ----------
   Browser-only FileReader; nothing is uploaded anywhere and nothing leaves
   the prototype. Mirrors the Archive wizard's stepped shape (file → mapping
   → review → summary → explicit confirm) with warehouse-specific validation:
   code required + unique, name required, type/status from fixed vocabularies
   (Arabic aliases accepted), project must exist in the actor's VISIBLE list so
   the picker can never leak out-of-scope project ids. Duplicate detection is
   a PROTOTYPE rule on warehouse code, not a backend constraint. */
type WhField = 'code' | 'name' | 'type' | 'location' | 'status' | 'project';
type WhRow = Omit<Warehouse, 'id'>;
interface WhImpRow { cells: Partial<Record<WhField, string>>; status: 'ok' | 'error' | 'dup'; reason: string; }

const WH_ALIASES: Record<WhField, string[]> = {
  code: ['code', 'الكود', 'cod'],
  name: ['name', 'title', 'الاسم', 'اسم المخزن'],
  type: ['type', 'النوع'],
  location: ['location', 'الموقع'],
  status: ['status', 'الحالة'],
  project: ['project', 'projectid', 'المشروع'],
};
const whNorm = (h: string) => h.trim().toLowerCase().replace(/[\s_-]+/g, '');
const whMapHeader = (h: string): WhField | null => {
  const n = whNorm(h);
  for (const [field, aliases] of Object.entries(WH_ALIASES) as [WhField, string[]][])
    if (aliases.some((a) => whNorm(a) === n)) return field;
  return null;
};
const whNormType = (v: string): 'central' | 'site' | null => {
  const n = v.trim().toLowerCase();
  if (n === 'central' || n === 'مركزي') return 'central';
  if (n === 'site' || n === 'موقع') return 'site';
  return null;
};
const whNormStatus = (v: string): 'active' | 'inactive' | null => {
  const n = v.trim().toLowerCase();
  if (n === 'active' || n === 'نشط') return 'active';
  if (n === 'inactive' || n === 'غير نشط') return 'inactive';
  return null;
};

export const ImportWarehouses = ({ existing, visibleProjects, onDone, onCancel }: {
  existing: Warehouse[];
  visibleProjects: Project[];
  onDone: (added: WhRow[], skipped: number) => void;
  onCancel: () => void;
}) => {
  const { t } = useLang();
  const [step, setStep] = useState(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [map, setMap] = useState<Record<number, WhField | null>>({});
  const [raw, setRaw] = useState<string[][]>([]);
  const [err, setErr] = useState<string | null>(null);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    setErr(null);
    if (!/\.csv$/i.test(f.name)) { setErr(t('importMustCsv')); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCsv(String(reader.result ?? ''));
        if (parsed.length < 2) { setErr(t('importEmptyFile')); return; }
        const h = parsed[0];
        const m: Record<number, WhField | null> = {};
        h.forEach((col, i) => { m[i] = whMapHeader(col); });
        setHeaders(h); setMap(m); setRaw(parsed.slice(1, 201)); setStep(1);
      } catch {
        setErr(t('importUnreadable'));
      }
    };
    reader.onerror = () => setErr(t('importUnreadable'));
    reader.readAsText(f, 'UTF-8');
  };

  const evaluate = (body: string[][], m: Record<number, WhField | null>): WhImpRow[] => {
    const seen = new Set(existing.map((w) => w.code.toLowerCase()));
    const seenFile = new Set<string>();
    return body.map((cells) => {
      const obj: Partial<Record<WhField, string>> = {};
      cells.forEach((v, i) => { const f = m[i]; if (f) obj[f] = (v ?? '').trim(); });
      const code = obj.code ?? '';
      const name = obj.name ?? '';
      if (!code) return { cells: obj, status: 'error' as const, reason: t('errCodeRequired') };
      if (!name) return { cells: obj, status: 'error' as const, reason: t('eNameRequired') };
      const lc = code.toLowerCase();
      if (seen.has(lc) || seenFile.has(lc)) return { cells: obj, status: 'dup' as const, reason: t('dupCode') };
      seenFile.add(lc);
      const typeRaw = obj.type ?? '';
      if (typeRaw && !whNormType(typeRaw)) return { cells: obj, status: 'error' as const, reason: t('errBadType') };
      const statusRaw = obj.status ?? '';
      if (statusRaw && !whNormStatus(statusRaw)) return { cells: obj, status: 'error' as const, reason: t('errBadStatus') };
      const projRaw = obj.project ?? '';
      if (projRaw && !visibleProjects.some((p) => p.id === projRaw || p.code === projRaw))
        return { cells: obj, status: 'error' as const, reason: t('errBadProject') };
      return { cells: obj, status: 'ok' as const, reason: '' };
    });
  };

  const rows = useMemo(() => evaluate(raw, map), [raw, map, existing, visibleProjects, t]);
  const okRows = rows.filter((r) => r.status === 'ok');
  const skipped = rows.length - okRows.length;
  const toWarehouse = (r: WhImpRow): WhRow => {
    const projRaw = r.cells.project ?? '';
    const proj = visibleProjects.find((p) => p.id === projRaw || p.code === projRaw);
    return {
      code: r.cells.code ?? '', name: r.cells.name ?? '',
      type: (r.cells.type ? whNormType(r.cells.type) : null) ?? 'site',
      location: r.cells.location ?? '',
      status: (r.cells.status ? whNormStatus(r.cells.status) : null) ?? 'active',
      ...(proj ? { projectId: proj.id } : {}),
    };
  };

  return (
    <div>
      <div className="tabs" role="tablist" aria-label="import steps">
        {[t('stepFile'), t('stepMapping'), t('stepRows'), t('stepSummary')].map((label, i) => (
          <button key={label} role="tab" aria-selected={step === i} className="tabBtn" onClick={() => { if (headers.length > 0) setStep(i); }}>{i + 1}. {label}</button>
        ))}
      </div>
      {err && <div className="errBox" role="alert">{err}</div>}
      <p className="muted small">{t('importBrowserOnly')}</p>

      {step === 0 && (
        <Field label={t('pickCsv')}>
          <input type="file" className="input" accept=".csv" aria-label={t('pickCsv')} onChange={(e) => onFile(e.target.files?.[0])} />
        </Field>
      )}

      {step >= 1 && (
        <>
          <h3 style={{ marginTop: 12 }}>{t('mapLabel')}</h3>
          <p className="muted small">{t('mapAutoNote')}</p>
          {headers.map((h, i) => (
            <Field key={i} label={`${t('columnLabel')} ${i + 1}: ${h}`}>
              <Select
                aria-label={`${t('columnLabel')} ${h}`}
                value={map[i] ?? ''}
                onChange={(e) => setMap((m) => ({ ...m, [i]: (e.target.value || null) as WhField | null }))}
              >
                <option value="">{t('colIgnored')}</option>
                {(['code', 'name', 'type', 'location', 'status', 'project'] as WhField[]).map((f) => (
                  <option key={f} value={f}>{t(f === 'code' ? 'whCodeName' : f === 'name' ? 'nameField' : f === 'type' ? 'typeLabel' : f === 'location' ? 'locationLabel' : f === 'status' ? 'statusLabel' : 'projectFilter')}</option>
                ))}
              </Select>
            </Field>
          ))}
        </>
      )}

      {step >= 2 && (
        <>
          <h3 style={{ marginTop: 12 }}>{t('stepRows')}</h3>
          {rows.map((r, i) => (
            <p key={i} className={r.status === 'ok' ? 'muted small' : 'err'} role={r.status === 'ok' ? undefined : 'alert'}>
              <strong className="num">{r.cells.code || `—`}</strong> · {r.cells.name || '—'}{' '}
              {r.status === 'ok' ? <span>({t('rowOk')})</span> : <span>({r.reason})</span>}
            </p>
          ))}
        </>
      )}

      {step >= 3 && (
        <>
          <h3 style={{ marginTop: 12 }}>{t('stepSummary')}</h3>
          <p>{t('summaryLine', { a: `+${okRows.length}`, b: skipped })}</p>
          <p className="muted small">{t('noTxNote')}</p>
        </>
      )}

      <div className="formActions">
        {step === 3
          ? <Button variant="primary" disabled={okRows.length === 0} onClick={() => onDone(okRows.map(toWarehouse), skipped)}>{t('confirmImport')}</Button>
          : <Button variant="primary" disabled={raw.length === 0} onClick={() => setStep((s) => Math.min(3, s + 1))}>{step < 2 ? t('stepRows') : t('stepSummary')}</Button>}
        <Button onClick={onCancel}>{t('cancelImport')}</Button>
      </div>
    </div>
  );
};