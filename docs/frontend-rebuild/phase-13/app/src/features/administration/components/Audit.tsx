import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/app/providers/auth';
import { useLang } from '@/i18n';
import { mockApi, reportApi } from '@/services/api';
import type { ExportFormat } from '@/services/api';
import { downloadFile } from '@/shared/lib/files';
import type { Audit as AuditRow } from '@/services/api/adapters/mock/data';
import { Button, EmptyState, Modal, Pager, RecCell, RecHead, RecRow, RecShell, SearchInput, Select, SortHeader, TextInput, useToast, errText } from '@/shared/ui';

const PAGE_SIZE = 10;
/** Only fields the audited AuditLog actually has — no project, no invented
    scope. `at` is an ISO timestamp, so the range compares on its date part. */
type Filters = { q: string; user: string; action: string; entity: string; from: string; to: string };
const BLANK: Filters = { q: '', user: '', action: '', entity: '', from: '', to: '' };
const day = (iso: string) => iso.slice(0, 10);

const T = '1.1fr 1.3fr .9fr 1fr .9fr 1fr';
export const Audit = () => {
  const { t } = useLang();
  const { can, user } = useAuth();
  const actor = user?.id;
  const toast = useToast();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [seq, setSeq] = useState(0);
  const [f, setF] = useState<Filters>(BLANK);
  const [sortBy, setSortBy] = useState('at');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<AuditRow | null>(null);
  const [busy, setBusy] = useState<'csv' | 'json' | null>(null);
  const canReport = can('reports.view');

  useEffect(() => {
    let on = true;
    setState('loading');
    (async () => {
      try {
        const r = await mockApi.audit();
        if (!on) return;
        setRows(r); setState('ready');
      } catch { if (on) setState('error'); }
    })();
    return () => { on = false; };
  }, [seq]);

  const users = useMemo(() => [...new Set(rows.map((a) => a.user))].sort(), [rows]);
  const actions = useMemo(() => [...new Set(rows.map((a) => a.action))].sort(), [rows]);
  const entities = useMemo(() => [...new Set(rows.map((a) => a.entity))].sort(), [rows]);

  const filtered = useMemo(() => {
    const out = rows.filter((a) => {
      if (f.q && !`${a.at} ${a.user} ${a.action} ${a.entity} ${a.entityId ?? ''} ${(a.diff ?? []).map((d) => d.field).join(' ')}`.includes(f.q)) return false;
      if (f.user && a.user !== f.user) return false;
      if (f.action && a.action !== f.action) return false;
      if (f.entity && a.entity !== f.entity) return false;
      if (f.from && day(a.at) < f.from) return false;
      if (f.to && day(a.at) > f.to) return false;
      return true;
    });
    const sign = dir === 'asc' ? 1 : -1;
    const key = sortBy as keyof AuditRow;
    // `at` tiebreak mirrors the export engine so the file order and the grid
    // order agree even when the sorted column repeats values.
    return out.sort((a, b) => sign * String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'ar', { numeric: true }) || a.at.localeCompare(b.at));
  }, [rows, f, sortBy, dir]);

  // Any filter change returns to page 1 — otherwise a narrowed result set can
  // leave the viewer stranded on an empty page.
  const setF2 = (patch: Partial<Filters>) => { setF((s) => ({ ...s, ...patch })); setPage(0); };
  const clear = () => { setF(BLANK); setPage(0); };
  const active = f.q !== '' || f.user !== '' || f.action !== '' || f.entity !== '' || f.from !== '' || f.to !== '';
  const sort = (k: string) => { if (k === sortBy) setDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSortBy(k); setDir('asc'); } setPage(0); };

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const slice = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  // Exported on the mock path with the SAME filter object, so the file holds
  // exactly what is on screen — the engine re-applies it to already-scoped rows.
  const runExport = async (format: ExportFormat) => {
    setBusy(format);
    const r = await reportApi.export(actor, 'audit', format, {
      q: f.q || undefined, user: f.user || undefined, action: f.action || undefined,
      entity: f.entity || undefined, from: f.from || undefined, to: f.to || undefined,
      sortBy, sortDir: dir,
    });
    setBusy(null);
    if (!r.ok) { toast('error', errText(t, r)); return; }
    downloadFile(r.filename, r.mime, r.text);
    toast('success', t('exportDone', { n: r.rowCount, f: r.filename }));
  };

  if (state === 'loading') return <div className="panel"><div className="skelRow"><div className="skel" /><div className="skel" /></div></div>;
  if (state === 'error') return (
    <div className="errBox" role="alert">
      <p>{t('auditLoadError')}</p>
      <Button size="sm" variant="primary" onClick={() => setSeq((s) => s + 1)}>{t('retry')}</Button>
    </div>
  );

  return (
    <div>
      <div className="cmdHead">
        <div>
          <h1>{t('audit')}</h1>
          <p className="muted small">{t('mockNote')} — {t('auditNoProjectNote')}</p>
        </div>
        {canReport && (
          <div className="toolbar">
            <Button size="sm" variant="primary" disabled={busy !== null} onClick={() => runExport('csv')}>
              {busy === 'csv' ? t('exporting') : t('exportCsv')}
            </Button>
            <Button size="sm" disabled={busy !== null} onClick={() => runExport('json')}>
              {busy === 'json' ? t('exporting') : t('exportJson')}
            </Button>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="toolbar" role="search">
          <span className="grow"><SearchInput label={t('search')} value={f.q} onChange={(v) => setF2({ q: v })} placeholder={t('auditSearchPh')} /></span>
          <Select aria-label={t('filterUser')} value={f.user} onChange={(e) => setF2({ user: e.target.value })}>
            <option value="">{t('allUsers')}</option>
            {users.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
          <Select aria-label={t('filterAction')} value={f.action} onChange={(e) => setF2({ action: e.target.value })}>
            <option value="">{t('allActions')}</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
          <Select aria-label={t('filterEntity')} value={f.entity} onChange={(e) => setF2({ entity: e.target.value })}>
            <option value="">{t('allEntities')}</option>
            {entities.map((en) => <option key={en} value={en}>{en}</option>)}
          </Select>
        </div>
        <div className="toolbar">
          <span className="dateRange">
            <span className="lbl">{t('auditFrom')}</span>
            <TextInput aria-label={t('auditFrom')} type="date" value={f.from} onChange={(e) => setF2({ from: e.target.value })} />
          </span>
          <span className="dateRange">
            <span className="lbl">{t('auditTo')}</span>
            <TextInput aria-label={t('auditTo')} type="date" value={f.to} onChange={(e) => setF2({ to: e.target.value })} />
          </span>
          <Button size="sm" disabled={!active} onClick={clear}>{t('clearFilters')}</Button>
          <span className="grow muted small num" aria-live="polite">{t('resultCount', { n: filtered.length })}</span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title={active ? t('noResults') : t('empty')}
            hint={active ? t('noResultsHint') : t('auditEmptyHint')}
            action={active ? <Button size="sm" onClick={clear}>{t('clearFilters')}</Button> : undefined}
          />
        ) : (
          <>
            <RecShell label={t('audit')} template={T}>
              <RecHead template={T}>
                <RecCell head><SortHeader label={t('auditAt')} k="at" sortBy={sortBy} dir={dir} onSort={sort} /></RecCell>
                <RecCell head><SortHeader label={t('auditUser')} k="user" sortBy={sortBy} dir={dir} onSort={sort} /></RecCell>
                <RecCell head><SortHeader label={t('auditAction')} k="action" sortBy={sortBy} dir={dir} onSort={sort} /></RecCell>
                <RecCell head><SortHeader label={t('auditEntity')} k="entity" sortBy={sortBy} dir={dir} onSort={sort} /></RecCell>
                <RecCell head><SortHeader label={t('entityId')} k="entityId" sortBy={sortBy} dir={dir} onSort={sort} /></RecCell>
                <RecCell head>{t('actions')}</RecCell>
              </RecHead>
              {slice.map((a) => (
                <RecRow key={a.id} template={T}>
                  <RecCell k={t('auditAt')}><span className="num">{a.at.replace('T', ' ')}</span></RecCell>
                  <RecCell k={t('auditUser')}>{a.user}</RecCell>
                  <RecCell k={t('auditAction')}>{a.action}</RecCell>
                  <RecCell k={t('auditEntity')}>{a.entity}</RecCell>
                  <RecCell k={t('entityId')}><span className="num">{a.entityId ?? '—'}</span></RecCell>
                  <RecCell><Button size="sm" onClick={() => setSel(a)}>{t('details')}</Button></RecCell>
                </RecRow>
              ))}
            </RecShell>
            <Pager page={page} pages={pages} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} label={t('audit')} />
          </>
        )}
      </div>

      <Modal title={t('auditEntry')} open={!!sel} onClose={() => setSel(null)}>
        {sel && (
          <div>
            <p><strong>{sel.action}</strong> — {sel.entity} <span className="num">{sel.entityId}</span></p>
            <p className="muted small num">{sel.at.replace('T', ' ')} · {sel.user}</p>
            {sel.diff?.length ? (
              <div className="tableWrap"><table className="table" aria-label={t('changes')}>
                <thead><tr><th>{t('changeField')}</th><th>{t('changeFrom')}</th><th>{t('changeTo')}</th></tr></thead>
                <tbody>{sel.diff.map((d, i) => (
                  <tr key={i}><td>{d.field}</td><td className="num">{d.from}</td><td className="num">{d.to}</td></tr>
                ))}</tbody>
              </table></div>
            ) : <p className="muted small">{t('noChangesRecorded')}</p>}
            <p className="muted small">{t('auditReadOnly')}</p>
          </div>
        )}
      </Modal>
    </div>
  );
};