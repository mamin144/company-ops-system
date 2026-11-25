import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth';
import { useLang } from '@/i18n';
import { boqApi, boqTotal, ipcApi, mockApi, mrApi, stockApi } from '@/services/api';
import { STATUS_TONE } from '@/services/api/adapters/mock/data';
import type { BoqItem, Ipc, IpcStatus } from '@/services/api/adapters/mock/data';
import { computeIndicators, fmtPct } from './financialIndicators';
import { Badge, Button, ConfirmDialog, EmptyState, Field, Modal, Pager, RecCell, RecHead, RecRow, RecShell, SearchInput, SectionHead, Select, SortHeader, TextArea, TextInput, statusLabel, useToast, errText } from '@/shared/ui';

export const ProjectWorkspace = () => {
  const { id } = useParams();
  const { can, user } = useAuth();
  const { t } = useLang();
  const toast = useToast();
  const [p, setP] = useState<Awaited<ReturnType<typeof mockApi.project>>>(undefined);
  const [sites, setSites] = useState<Awaited<ReturnType<typeof mockApi.sites>>>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [seq, setSeq] = useState(0);

  useEffect(() => {
    let on = true;
    setLoadState('loading');
    (async () => {
      try {
        const proj = await mockApi.project(id ?? '', user?.id);
        if (!on) return;
        if (!proj) { setLoadState('missing'); return; }
        setP(proj);
        setSites(await mockApi.sites(id));
        if (!on) return;
        setLoadState('ready');
      } catch {
        if (on) setLoadState('error');
      }
    })();
    return () => { on = false; };
  }, [id, seq, user?.id]);

  if (loadState === 'loading') return <div className="panel"><div className="skelRow"><div className="skel" /><div className="skel" /></div></div>;
  if (loadState === 'missing') return (
    <div className="panel">
      <EmptyState title={t('projectMissingOrDenied')} hint={t('projectMissingHint')} action={
        <span style={{ display: 'inline-flex', gap: 8 }}>
          <Link className="btn btn--primary btn--sm" to="/projects">{t('projectsList')}</Link>
          <Link className="btn btn--sm" to="/">{t('home')}</Link>
        </span>
      } />
    </div>
  );
  if (loadState === 'error' || !p) return (
    <div className="errBox" role="alert">
      <p>{t('projectLoadError')}</p>
      <Button size="sm" variant="primary" onClick={() => setSeq((s) => s + 1)}>{t('retry')}</Button>
    </div>
  );
  const tabs = [
    ['overview', t('tabOverview')], ['sites', `${t('tabSites')} (${sites.length})`], ['documents', t('tabDocuments')],
    ['warehouses', t('tabWarehouses')], ['stock', t('tabStock')], ['financials', t('tabFinancials')],
  ] as const;
  return (
    <div>
      <div className="cmdHead"><div>
        <h1><span className="num ltr">{p.code}</span> — {p.name}</h1>
        <p className="muted small">{p.client} · {p.region} · <span className="num ltr">{p.contractNo}</span></p>
      </div>
      <div><Badge tone={STATUS_TONE[p.status]}>{statusLabel(t, p.status)}</Badge></div></div>
      <div className="tabs" role="tablist" aria-label="workspace">
        {tabs.map(([k, label]) => (
          <NavLink key={k} to={k} end className="tabBtn" role="tab" aria-selected={undefined}>
            {label}
          </NavLink>
        ))}
      </div>
      <Outlet context={{ project: p }} />
    </div>
  );
};

export const ProjOverview = () => {
  const ctx = useOutletContext<any>() as { project: { id: string; contractValue?: number } };
  const { can, user } = useAuth();
  const { t } = useLang();
  const toast = useToast();
  const actor = user?.id;
  const [addOpen, setAddOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [counts, setCounts] = useState<{ docs: number; whs: number; mrs: number; txns: number } | null>(null);
  useEffect(() => {
    let on = true;
    (async () => {
      const pid = ctx.project.id;
      const [docs, whs] = await Promise.all([
        mockApi.documents({}, actor).then((d) => d.filter((x) => x.projectId === pid).length),
        mockApi.warehouses(actor).then((w) => w.filter((x) => x.projectId === pid).length),
      ]);
      if (!on) return;
      setCounts({
        docs,
        whs,
        mrs: mrApi.list({ projectId: pid }, actor).total,
        txns: stockApi.list({ projectId: pid }, actor).total,
      });
    })();
    return () => { on = false; };
  }, [ctx.project.id, actor]);
  const pid = ctx.project.id;
  return (
    <div>
      <div className="panel">
        <SectionHead title={t('ovSummary')} />
        {counts ? (
          <div className="cards">
            <Link className="card" to={`/archive?project=${pid}`}><span className="l">{t('ovDocs')}</span><span className="v num">{counts.docs}</span><span className="f">{t('viewInArchive')}</span></Link>
            <Link className="card" to={`/inventory/warehouses?project=${pid}`}><span className="l">{t('tabWarehouses')}</span><span className="v num">{counts.whs}</span><span className="f">{t('viewInWarehouses')}</span></Link>
            <Link className="card" to={`/inventory/stock?project=${pid}`}><span className="l">{t('tabStock')}</span><span className="v num">{counts.txns}</span><span className="f">{t('viewInStock')}</span></Link>
            <Link className="card" to={`/inventory/requests?project=${pid}`}><span className="l">{t('ovOpenMrs')}</span><span className="v num">{counts.mrs}</span><span className="f">{t('viewRequests')}</span></Link>
          </div>
        ) : <div className="skelRow"><div className="skel" /><div className="skel" /></div>}
        {!can('sites.edit') && <p className="muted small">{t('sitesEditUnavailable')}</p>}
      </div>
      <Modal title={t('newSiteMock')} open={addOpen} onClose={() => setAddOpen(false)}>
        <Field label={t('codeLabel')}><TextInput aria-label={t('codeLabel')} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
        <Field label={t('nameRequired')}><TextInput aria-label={t('nameRequired')} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="formActions">
          <Button variant="primary" disabled={!code.trim() || !name.trim()} onClick={async () => { await mockApi.addSite({ projectId: ctx.project.id, code, name, location: '' }); setAddOpen(false); toast('success', t('siteAddedMock')); }}>{t('add')}</Button>
          <Button onClick={() => setAddOpen(false)}>{t('cancel')}</Button>
        </div>
      </Modal>
    </div>
  );
};
export const ProjDocs = () => {
  const ctx = useOutletContext<any>() as { project: { id: string; contractValue?: number } };
  const { t } = useLang();
  return (
    <div className="panel"><EmptyState title={t('projectDocs')} hint={t('projectDocsHint')} action={
      <Link className="btn btn--primary btn--sm" to={`/archive?project=${ctx.project.id}`}>{t('viewInArchive')}</Link>
    } /></div>
  );
};
export const ProjSites = () => {
  const ctx = useOutletContext<any>() as { project: { id: string; contractValue?: number } };
  const { t } = useLang();
  const [sites, setSites] = useState<{ id: string; code: string; name: string; location: string }[]>([]);
  useEffect(() => { mockApi.sites(ctx.project.id).then(setSites); }, [ctx.project.id]);
  return (
    <div className="panel">
      {sites.length === 0
        ? <EmptyState title={t('noSites')} hint={t('noSitesHint')} />
        : <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {sites.map((s) => (
            <li key={s.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border-subtle)' }}>
              <strong className="num">{s.code}</strong> — {s.name} <span className="muted small">{s.location}</span>
            </li>
          ))}
        </ul>}
    </div>
  );
};
export const ProjWarehouses = () => {
  const ctx = useOutletContext<any>() as { project: { id: string; contractValue?: number } };
  const { t } = useLang();
  return (
    <div className="panel"><EmptyState title={t('projectWarehouses')} hint={t('projectWarehousesHint')} action={
      <Link className="btn btn--primary btn--sm" to={`/inventory/warehouses?project=${ctx.project.id}`}>{t('viewInWarehouses')}</Link>
    } /></div>
  );
};
export const ProjStock = () => {
  const ctx = useOutletContext<any>() as { project: { id: string; contractValue?: number } };
  const { t } = useLang();
  return (
    <div className="panel"><EmptyState title={t('projectStock')} hint={t('projectStockHint')} action={
      <Link className="btn btn--primary btn--sm" to={`/inventory/stock?project=${ctx.project.id}`}>{t('viewInStock')}</Link>
    } /></div>
  );
};

/* ===================================================================
   BOQ + IPC (Phase 3.6)
   Every figure on this screen is derived from boqItems / ipcs / ipcLines by
   the audited rules. Nothing is stored twice, nothing is invented.
   =================================================================== */
const T = '1fr 2fr .8fr 1fr 1fr 1.4fr auto';
const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
const IPC_STATUSES: IpcStatus[] = ['draft', 'submitted', 'approved', 'rejected'];

export const ProjFinancials = () => {
  const ctx = useOutletContext<any>() as { project: { id: string; contractValue?: number } };
  const projectId = ctx.project.id as string;
  const { can, user } = useAuth();
  const { t } = useLang();
  const toast = useToast();
  const actor = user?.id;
  const [tab, setTab] = useState<'boq' | 'ipc'>('boq');
  const [seq, setSeq] = useState(0);
  const canEdit = can('projects.edit') || can('projects.create');

  const rows = useMemo(() => ({
    boq: boqApi.progress(projectId),
    ipcs: ipcApi.list(projectId, actor),
    summary: ipcApi.summary(projectId),
  }), [projectId, actor, seq]);

  return (
    <div>
      <div className="tabs" role="tablist" aria-label={t('financials')}>
        <button role="tab" aria-selected={tab === 'boq'} className="tabBtn" onClick={() => setTab('boq')}>{t('boq')}</button>
        <button role="tab" aria-selected={tab === 'ipc'} className="tabBtn" onClick={() => setTab('ipc')}>{t('ipc')}</button>
      </div>

      <div className="cards" style={{ marginBottom: 14 }}>
        {/* Dictionary §9: same shared indicator arithmetic as /financials. */}
        {(() => {
          const ind = computeIndicators(ctx.project.contractValue, rows.summary);
          const na = t('notAvailable');
          return (
            <>
              <div className="card"><span className="l">{t('boqTotal')}</span><br /><span className="v num">{fmt(rows.summary.boqTotal)}</span></div>
              <div className="card"><span className="l">{t('executedApproved')}</span><br /><span className="v num">{ind.executedApproved == null ? na : fmt(ind.executedApproved)}</span></div>
              <div className="card"><span className="l">{t('contractValue')}</span><br /><span className="v num">{ind.contractValue == null ? na : fmt(ind.contractValue)}</span></div>
              <div className="card"><span className="l">{t('executionPct')}</span><br /><span className="v num">{ind.executionPct == null ? na : fmtPct(ind.executionPct)}</span></div>
              <div className="card"><span className="l">{t('remainingContract')}</span><br /><span className="v num">{ind.remainingContract == null ? na : fmt(ind.remainingContract)}</span></div>
              <div className="card"><span className="l">{t('remainingDisbursement')}</span><br /><span className="v num">{na}</span></div>
            </>
          );
        })()}
      </div>
      {/* Gap note for the disbursement indicator (dictionary §9.2). */}
      <p className="muted small">{t('disbursementGap')}</p>
      <p className="muted small">{t('derivedNote')}</p>

      {tab === 'boq' && <BoqPanel projectId={projectId} actor={actor} canEdit={canEdit} rows={rows.boq} onChanged={() => setSeq((s) => s + 1)} toast={toast} />}
      {tab === 'ipc' && <IpcPanel projectId={projectId} actor={actor} canEdit={canEdit} rows={rows} onChanged={() => setSeq((s) => s + 1)} toast={toast} />}
    </div>
  );
};

const BoqPanel = ({ projectId, actor, canEdit, rows, onChanged, toast }: { projectId: string; actor?: string; canEdit: boolean; rows: (BoqItem & { totalPrice: number; executedQty: number })[]; onChanged: () => void; toast: ReturnType<typeof useToast> }) => {
  const { t } = useLang();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<BoqItem | null>(null);
  const [del, setDel] = useState<BoqItem | null>(null);
  const [sortBy, setSortBy] = useState<'itemCode' | 'description' | 'quantity' | 'total'>('itemCode');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 5;
  const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  const filtered = rows.filter((b) => !q || (b.itemCode + b.description + b.unit).includes(q));
  const sorted = useMemo(() => {
    const sign = dir === 'asc' ? 1 : -1;
    const s = [...filtered];
    s.sort((a, b) => {
      switch (sortBy) {
        case 'description': return sign * (cmp(a.description, b.description) || cmp(a.itemCode, b.itemCode));
        case 'quantity': return sign * ((a.quantity - b.quantity) || cmp(a.itemCode, b.itemCode));
        case 'total': return sign * ((boqTotal(a) - boqTotal(b)) || cmp(a.itemCode, b.itemCode));
        default: return sign * cmp(a.itemCode, b.itemCode);
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
  const total = sorted.reduce((s, b) => s + b.totalPrice, 0);
  const [blocked, setBlocked] = useState<string | null>(null);

  return (
    <div className="panel">
      <div className="toolbar" role="search">
        <span className="grow"><SearchInput label={t('search')} value={q} onChange={(v) => { setQ(v); setPage(0); }} placeholder={t('searchPh')} /></span>
        {canEdit && <Button variant="primary" onClick={() => setEdit({ id: '', projectId, itemCode: '', description: '', unit: 'م³', quantity: 0, unitPrice: 0 })}>+ {t('newBoqItem')}</Button>}
      </div>
      {sorted.length === 0 ? <EmptyState title={q ? t('noResults') : t('empty')} hint={t('boqEmptyHint')} /> : (
        <>
          <RecShell label={t('boq')} template={T}>
            <RecHead template={T}>
              <RecCell head><SortHeader label={t('itemCode')} k="itemCode" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
              <RecCell head><SortHeader label={t('description')} k="description" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
              <RecCell head>{t('unit')}</RecCell>
              <RecCell head><SortHeader label={t('quantity')} k="quantity" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
              <RecCell head>{t('unitPrice')}</RecCell>
              <RecCell head><SortHeader label={t('totalPrice')} k="total" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
              <RecCell head>{t('actions')}</RecCell>
            </RecHead>
            {view.map((b) => (
              <RecRow key={b.id} template={T}>
                <RecCell k={t('itemCode')}><span className="num"><strong>{b.itemCode}</strong></span></RecCell>
                <RecCell k={t('description')}>{b.description}<br /><span className="muted small num">{t('executedQty')}: {b.executedQty} / {b.quantity}</span></RecCell>
                <RecCell k={t('unit')}>{b.unit}</RecCell>
                <RecCell k={t('quantity')}><span className="num">{b.quantity}</span></RecCell>
                <RecCell k={t('unitPrice')}><span className="num">{fmt(b.unitPrice)}</span></RecCell>
                <RecCell k={t('totalPrice')}><strong className="num">{fmt(b.totalPrice)}</strong></RecCell>
                <RecCell><span className="recActions">
                  {canEdit && <Button size="sm" onClick={() => setEdit(b)}>{t('edit')}</Button>}
                  {canEdit && <Button size="sm" variant="danger" onClick={() => setDel(b)}>{t('deleteLabel')}</Button>}
                </span></RecCell>
              </RecRow>
            ))}
          </RecShell>
          <p className="muted small num" aria-live="polite">{t('boqTotalShown')}: {fmt(total)} ({sorted.length} {t('itemsCount')})</p>
          <Pager page={safePage} pages={pages} total={sorted.length} pageSize={PAGE_SIZE} onPage={setPage} label={t('boq')} />
        </>
      )}
      {blocked && <div className="errBox" role="alert" onClick={() => setBlocked(null)}>{blocked}</div>}
      <BoqForm open={!!edit} item={edit} projectId={projectId} actor={actor} onClose={() => setEdit(null)}
        onSaved={() => { setEdit(null); onChanged(); toast('success', t('boqSaved')); }} />
      <ConfirmDialog open={!!del} text={`${t('deleteLabel')} ${del?.itemCode} — ${t('mockNote')}`}
        onConfirm={async () => {
          if (!del) return;
          const r = await boqApi.remove(projectId, del.id, actor ?? '');
          setDel(null);
          if (!r.ok) { setBlocked(errText(t, r)); toast('error', errText(t, r)); return; }
          onChanged(); toast('success', t('boqDeleted'));
        }} onCancel={() => setDel(null)} />
    </div>
  );
};

const BoqForm = ({ open, item, projectId, actor, onClose, onSaved }: { open: boolean; item: BoqItem | null; projectId: string; actor?: string; onClose: () => void; onSaved: () => void }) => {
  const { t } = useLang();
  const [form, setForm] = useState({ itemCode: '', description: '', unit: '', quantity: 0 as number, unitPrice: 0 as number });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open || !item) return;
    setForm({ itemCode: item.itemCode, description: item.description, unit: item.unit, quantity: item.quantity, unitPrice: item.unitPrice });
    setErr(null); setBusy(false);
  }, [open, item]);
  const bad = !form.itemCode.trim() || !form.description.trim() || !form.unit.trim();
  const num = (v: string): number => (v === '' ? Number.NaN : Number(v));
  /* direct total keeps the audited invariant: total always = quantity × rate.
     Typing a total splits it back into the rate (total ÷ quantity); a
     zero/empty quantity is promoted to 1 so the whole value lands in the rate. */
  const derivedTotal = Number(((form.quantity || 0) * (form.unitPrice || 0)).toFixed(4));

  return (
    <Modal title={item?.id ? t('editBoqItem') : t('newBoqItem')} open={open} onClose={onClose} wide>
      {err && <div className="errBox" role="alert">{err}</div>}
      <div className="form2">
        <Field label={`${t('itemCode')} *`} error={form.itemCode === '' ? t('itemCodeRequired') : undefined}>
          <TextInput aria-label={t('itemCode')} value={form.itemCode} onChange={(e) => { setForm({ ...form, itemCode: e.target.value }); setErr(null); }} />
        </Field>
        <Field label={`${t('unit')} *`} error={form.unit === '' ? t('unitRequired') : undefined}>
          <TextInput aria-label={t('unit')} value={form.unit} onChange={(e) => { setForm({ ...form, unit: e.target.value }); setErr(null); }} />
        </Field>
        <Field label={`${t('quantity')} *`} error={Number.isNaN(form.quantity) || form.quantity < 0 ? t('qtyRule') : undefined}>
          <TextInput aria-label={t('quantity')} type="number" value={String(form.quantity)}
            onChange={(e) => setForm({ ...form, quantity: num(e.target.value) })} />
        </Field>
        <Field label={`${t('unitPrice')} *`} error={Number.isNaN(form.unitPrice) || form.unitPrice < 0 ? t('priceRule') : undefined}>
          <TextInput aria-label={t('unitPrice')} type="number" value={String(form.unitPrice)}
            onChange={(e) => setForm({ ...form, unitPrice: num(e.target.value) })} />
        </Field>
        <Field label={t('totalPrice')} error={derivedTotal < 0 ? t('totalRule') : undefined}>
          <TextInput aria-label={t('totalPrice')} type="number"
            value={Number.isNaN(derivedTotal) ? '' : String(derivedTotal)}
            onChange={(e) => {
              const tot = num(e.target.value);
              if (Number.isNaN(tot)) { setErr(null); return; }
              const qty = (Number.isNaN(form.quantity) || form.quantity <= 0) ? 1 : form.quantity;
              setForm({ ...form, quantity: qty, unitPrice: tot / qty });
            }} />
        </Field>
      </div>
      <Field label={`${t('description')} *`} error={form.description === '' ? t('descRequired') : undefined}>
        <TextArea aria-label={t('description')} rows={2} value={form.description} onChange={(e) => { setForm({ ...form, description: e.target.value }); setErr(null); }} />
      </Field>
      <p className="muted small">{t('totalDirectNote')}</p>
      <p className="muted small num">{t('totalPrice')}: <strong>{fmt(derivedTotal)}</strong> — {t('derivedNote')}</p>
      <div className="formActions">
        <Button variant="primary" disabled={bad || busy} onClick={async () => {
          setBusy(true); setErr(null);
          const res = item?.id
            ? await boqApi.update(projectId, item.id, form, actor ?? '')
            : await boqApi.create(projectId, form, actor ?? '');
          setBusy(false);
          if (!res.ok) { setErr(errText(t, res)); return; }
          onSaved();
        }}>{t('save')}</Button>
        <Button disabled={busy} onClick={onClose}>{t('cancel')}</Button>
      </div>
    </Modal>
  );
};

const IpcPanel = ({ projectId, actor, canEdit, rows, onChanged, toast }: {
  projectId: string; actor?: string; canEdit: boolean;
  rows: { boq: (BoqItem & { totalPrice: number; executedQty: number })[]; ipcs: Ipc[]; summary: ReturnType<typeof ipcApi.summary> };
  onChanged: () => void; toast: ReturnType<typeof useToast>;
}) => {
  const { t } = useLang();
  const [form, setForm] = useState<Ipc | null>(null);
  const [view, setView] = useState<Ipc | null>(null);
  const [del, setDel] = useState<Ipc | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'ipcNumber' | 'date' | 'status' | 'net'>('ipcNumber');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 5;
  const blank = (): Ipc => ({ id: '', projectId, ipcNumber: rows.ipcs.length + 1, date: new Date().toISOString().slice(0, 10), status: 'draft' });
  const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  const sorted = useMemo(() => {
    const sign = dir === 'asc' ? 1 : -1;
    const s = [...rows.ipcs];
    s.sort((a, b) => {
      switch (sortBy) {
        case 'date': return sign * (cmp(a.date, b.date) || (a.ipcNumber - b.ipcNumber));
        case 'status': return sign * (cmp(a.status, b.status) || (a.ipcNumber - b.ipcNumber));
        case 'net': return sign * (((a.netAmount ?? 0) - (b.netAmount ?? 0)) || (a.ipcNumber - b.ipcNumber));
        default: return sign * (a.ipcNumber - b.ipcNumber);
      }
    });
    return s;
  }, [rows.ipcs, sortBy, dir]);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const viewRows = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const onSort = (k: string) => {
    if (sortBy === k) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(k as typeof sortBy); setDir('asc'); }
    setPage(0);
  };

  return (
    <div className="panel">
      <div className="toolbar" role="search">
        <span className="grow muted small">{t('ipcSummaryLine', { a: rows.summary.count, b: rows.summary.approvedCount, c: rows.summary.submittedCount })}</span>
        {canEdit && <Button variant="primary" onClick={() => setForm(blank())}>+ {t('newIpc')}</Button>}
      </div>
      {rows.ipcs.length === 0 ? <EmptyState title={t('empty')} hint={t('ipcEmptyHint')} /> : (
        <RecShell label={t('ipc')} template="1fr 1fr 1fr 1.4fr auto">
          <RecHead template="1fr 1fr 1fr 1.4fr auto">
            <RecCell head><SortHeader label={t('ipcNumber')} k="ipcNumber" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
            <RecCell head><SortHeader label={t('txDate')} k="date" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
            <RecCell head><SortHeader label={t('status')} k="status" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
            <RecCell head><SortHeader label={t('netAmount')} k="net" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
            <RecCell head>{t('actions')}</RecCell>
          </RecHead>
          {viewRows.map((i) => {
            const lines = ipcApi.lines(i.id);
            const next = ipcApi.transitions(i.status).filter((s) => s !== i.status);
            return (
              <RecRow key={i.id} template="1fr 1fr 1fr 1.4fr auto">
                <RecCell k={t('ipcNumber')}><span className="num"><strong>#{i.ipcNumber}</strong></span></RecCell>
                <RecCell k={t('txDate')}><span className="num">{i.date}</span></RecCell>
                <RecCell k={t('status')}><Badge tone={STATUS_TONE[i.status] ?? 'gray'}>{statusLabel(t, i.status)}</Badge>
                  {lines.length === 0 && <><br /><span className="muted small">{t('directAmount')}</span></>}
                </RecCell>
                <RecCell k={t('netAmount')}><strong className="num">{fmt(i.netAmount ?? 0)}</strong>
                  {lines.length > 0 && <><br /><span className="muted small num">{lines.length} {t('linesCount')}</span></>}
                </RecCell>
                <RecCell><span className="recActions">
                  <Button size="sm" onClick={() => setView(i)}>{t('details')}</Button>
                  {canEdit && <Button size="sm" onClick={() => setForm(i)}>{t('edit')}</Button>}
                  {canEdit && next.map((s) => (
                    <Button key={s} size="sm" variant={s === 'approved' ? 'primary' : s === 'rejected' ? 'danger' : 'ghost'}
                      onClick={() => { setForm({ ...i, status: s }); }}>{statusLabel(t, s)}</Button>
                  ))}
                  {canEdit && i.status === 'draft' && <Button size="sm" variant="danger" onClick={() => setDel(i)}>{t('deleteLabel')}</Button>}
                </span></RecCell>
              </RecRow>
            );
          })}
        </RecShell>
      )}
      {rows.ipcs.length > 0 && (
        <Pager page={safePage} pages={pages} total={sorted.length} pageSize={PAGE_SIZE} onPage={setPage} label={t('ipc')} />
      )}
      {blocked && <div className="errBox" role="alert" onClick={() => setBlocked(null)}>{blocked}</div>}

      <Modal title={`${t('details')} — ${view ? `#${view.ipcNumber}` : ''}`} open={!!view} onClose={() => setView(null)} wide>
        {view && <IpcDetail ipc={view} projectId={projectId} actor={actor} />}
      </Modal>

      {form && <IpcForm ipc={form} projectId={projectId} actor={actor} boq={rows.boq} onClose={() => setForm(null)}
        onSaved={() => { setForm(null); onChanged(); toast('success', t('ipcSaved')); }} />}

      <ConfirmDialog open={!!del} text={`${t('deleteLabel')} #${del?.ipcNumber} — ${t('mockNote')}`}
        onConfirm={async () => {
          if (!del) return;
          const r = await ipcApi.remove(projectId, del.id, actor ?? '');
          setDel(null);
          if (!r.ok) { setBlocked(errText(t, r)); toast('error', errText(t, r)); return; }
          onChanged(); toast('success', t('ipcDeleted'));
        }} onCancel={() => setDel(null)} />
    </div>
  );
};

const IpcDetail = ({ ipc, projectId, actor }: { ipc: Ipc; projectId: string; actor?: string }) => {
  const { t } = useLang();
  const lines = ipcApi.lines(ipc.id);
  const boq = boqApi.list(projectId, actor);
  return (
    <div>
      <p><Badge tone={STATUS_TONE[ipc.status] ?? 'gray'}>{statusLabel(t, ipc.status)}</Badge> · <span className="num">{ipc.date}</span></p>
      {ipc.notes && <p className="muted small">{ipc.notes}</p>}
      {lines.length === 0 ? (
        <p className="muted small">{t('directAmountNote')}</p>
      ) : (
        <div className="tableWrap"><table className="table" aria-label={t('ipcLines')}>
          <thead><tr><th>{t('boqItem')}</th><th>{t('itemCode')}</th><th>{t('previousQty')}</th><th>{t('currentQty')}</th><th>{t('unitPrice')}</th><th>{t('amount')}</th></tr></thead>
          <tbody>{lines.map((l) => {
            const b = boq.find((x) => x.id === l.boqItemId);
            return (
              <tr key={l.id}>
                <td>{b?.description ?? l.boqItemId}</td>
                <td className="num">{b?.itemCode ?? '—'}</td>
                <td className="num">{l.previousQuantity}</td>
                <td className="num">{l.currentQuantity}</td>
                <td className="num">{b ? fmt(b.unitPrice) : '—'}</td>
                <td className="num">{b ? fmt(l.currentQuantity * b.unitPrice) : '—'}</td>
              </tr>
            );
          })}</tbody>
          <tfoot><tr><th colSpan={5}>{t('netAmount')}</th><th className="num">{fmt(ipc.netAmount ?? 0)}</th></tr></tfoot>
        </table></div>
      )}
      <p className="muted small num">{t('netRule')}</p>
    </div>
  );
};

const IpcForm = ({ ipc, projectId, actor, boq, onClose, onSaved }: {
  ipc: Ipc; projectId: string; actor?: string;
  boq: (BoqItem & { totalPrice: number; executedQty: number })[];
  onClose: () => void; onSaved: () => void;
}) => {
  const { t } = useLang();
  const [form, setForm] = useState({ ipcNumber: ipc.ipcNumber, date: ipc.date, status: ipc.status, notes: ipc.notes ?? '', deductions: ipc.deductions ?? 0, grossAmount: ipc.grossAmount ?? 0 });
  const [lines, setLines] = useState<{ boqItemId: string; currentQuantity: number }[]>(
    ipcApi.lines(ipc.id).map((l) => ({ boqItemId: l.boqItemId, currentQuantity: l.currentQuantity })));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setForm({ ipcNumber: ipc.ipcNumber, date: ipc.date, status: ipc.status, notes: ipc.notes ?? '', deductions: ipc.deductions ?? 0, grossAmount: ipc.grossAmount ?? 0 });
    setLines(ipcApi.lines(ipc.id).map((l) => ({ boqItemId: l.boqItemId, currentQuantity: l.currentQuantity })));
    setErr(null); setBusy(false);
  }, [ipc]);

  const lineNet = lines.reduce((s, l) => s + l.currentQuantity * (boq.find((b) => b.id === l.boqItemId)?.unitPrice ?? 0), 0);
  const previewNet = lines.length ? lineNet : Math.max(0, (form.grossAmount || 0) - (form.deductions || 0));
  // Allowance = BOQ quantity minus everything executed in EARLIER certificates —
  // the same arithmetic the create guard enforces server-side.
  const allowance = ipcApi.remaining(projectId, form.ipcNumber);
  const over = lines.find((l) => l.currentQuantity > (allowance[l.boqItemId] ?? 0) + 1e-9);
  // CR-02 direct-amount validation: the direct path (no lines) must carry a
  // valid gross amount and deductions (both 0 or greater, both real numbers) —
  // NaN or negative disables save and shows a field-level error, matching the
  // mock schema's grossAmount/deductions ≥ 0 constraint. Line quantities get
  // the same number sanity check the cap check alone would miss for NaN.
  const grossInvalid = lines.length === 0 && (!Number.isFinite(form.grossAmount) || form.grossAmount < 0);
  const dedInvalid = lines.length === 0 && (!Number.isFinite(form.deductions) || form.deductions < 0);
  const linesInvalid = lines.some((l) => !Number.isFinite(l.currentQuantity) || l.currentQuantity < 0);

  return (
    <Modal title={ipc.id ? `${t('edit')} — #${ipc.ipcNumber}` : t('newIpc')} open onClose={onClose} wide>
      {err && <div className="errBox" role="alert">{err}</div>}
      <div className="form2">
        <Field label={`${t('ipcNumber')} *`} error={!Number.isFinite(form.ipcNumber) || form.ipcNumber < 1 ? t('ipcNumberRule') : undefined}>
          <TextInput aria-label={t('ipcNumber')} type="number" value={String(form.ipcNumber)}
            onChange={(e) => setForm({ ...form, ipcNumber: e.target.value === '' ? Number.NaN : Number(e.target.value) })} />
        </Field>
        <Field label={`${t('txDate')} *`}><TextInput aria-label={t('txDate')} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label={`${t('status')} *`}>
          <Select aria-label={t('status')} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as IpcStatus })}>
            {IPC_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(t, s)}</option>)}
          </Select>
        </Field>
      </div>

      <h3 style={{ marginTop: 12 }}>{t('ipcLines')} <span className="muted small">({t('linesOptional')})</span></h3>
      {lines.map((l, i) => {
        const b = boq.find((x) => x.id === l.boqItemId);
        return (
          <div key={i} className="lineRow">
            <Select aria-label={`${t('boqItem')} ${i + 1}`} value={l.boqItemId}
              onChange={(e) => setLines((s) => s.map((x, j) => (j === i ? { ...x, boqItemId: e.target.value } : x)))}>
              {boq.map((x) => <option key={x.id} value={x.id}>{x.itemCode} — {x.description}</option>)}
            </Select>
            <TextInput aria-label={`${t('currentQty')} ${i + 1}`} type="number" min={0} value={String(l.currentQuantity)}
              onChange={(e) => setLines((s) => s.map((x, j) => (j === i ? { ...x, currentQuantity: e.target.value === '' ? Number.NaN : Number(e.target.value) } : x)))} />
            <span className="muted small num">{t('boqQtyCap')}: {b?.quantity ?? '—'} · {t('remainingCap')}: {allowance[l.boqItemId] ?? '—'}</span>
            <Button size="sm" variant="danger" onClick={() => setLines((s) => s.filter((_, j) => j !== i))}>{t('removeLine')}</Button>
          </div>
        );
      })}
      <div className="formActions">
        <Button onClick={() => setLines((s) => [...s, { boqItemId: boq[0]?.id ?? '', currentQuantity: 0 }])}>+ {t('addLine')}</Button>
        {lines.length > 0 && <Button onClick={() => setLines([])}>{t('useDirectAmount')}</Button>}
      </div>

      {lines.length === 0 && (
        <div className="form2">
          <p className="muted small" style={{ gridColumn: '1 / -1' }}>{t('directAmountWhat')}</p>
          <Field label={t('grossAmount')} error={grossInvalid ? t('amountRule') : undefined}>
            <TextInput aria-label={t('grossAmount')} type="number" min={0} value={String(form.grossAmount)}
              onChange={(e) => setForm({ ...form, grossAmount: e.target.value === '' ? Number.NaN : Number(e.target.value) })} />
          </Field>
          <Field label={t('deductions')} error={dedInvalid ? t('amountRule') : undefined}>
            <TextInput aria-label={t('deductions')} type="number" min={0} value={String(form.deductions)}
              onChange={(e) => setForm({ ...form, deductions: e.target.value === '' ? Number.NaN : Number(e.target.value) })} />
          </Field>
        </div>
      )}
      <Field label={t('txNotes')}><TextArea aria-label={t('txNotes')} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>

      <p className="muted small num">{t('netAmount')}: <strong>{fmt(previewNet)}</strong> — {t('netRule')}</p>
      {over && <p className="err" role="alert">{t('overBoqCap')}</p>}

      <div className="formActions">
        <Button variant="primary" disabled={busy || !!over || linesInvalid || grossInvalid || dedInvalid} onClick={async () => {
          setBusy(true); setErr(null);
          const payload = {
            ipcNumber: form.ipcNumber, date: form.date, status: form.status,
            notes: form.notes || undefined,
            deductions: lines.length ? undefined : form.deductions,
            grossAmount: lines.length ? undefined : form.grossAmount,
            lines: lines.length ? lines : undefined,
          };
          const res = ipc.id
            ? await ipcApi.update(projectId, ipc.id, payload, actor ?? '')
            : await ipcApi.create(projectId, payload, actor ?? '');
          setBusy(false);
          if (!res.ok) { setErr(errText(t, res)); return; }
          onSaved();
        }}>{t('save')}</Button>
        <Button disabled={busy} onClick={onClose}>{t('cancel')}</Button>
      </div>
    </Modal>
  );
};