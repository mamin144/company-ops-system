import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth';
import { useLang } from '@/i18n';
import { lookups, mockApi, mrApi, MR_STATUSES, itemName, projName, whName } from '@/services/api';
import { STATUS_TONE } from '@/services/api/adapters/mock/data';
import type { MR, MRLine } from '@/services/api/adapters/mock/data';
import { Badge, Button, ConfirmDialog, EmptyState, Field, Modal, Pager, RecCell, RecHead, RecRow, RecShell, SearchInput, Select, SortHeader, TextArea, TextInput, statusLabel, useToast, errText } from '@/shared/ui';

const T = '1.2fr 1fr 1.6fr auto';
const PAGE_SIZE = 6;
/** Actions this identity may perform, per status — one source of truth shared by
    the row buttons, the details modal and the mock guard itself. */
const actionsFor = (m: MR, can: (p: string) => boolean) => {
  const out: ('submit' | 'approve' | 'reject' | 'issue' | 'close' | 'delete')[] = [];
  if (m.status === 'draft' && can('materialRequests.create')) out.push('submit', 'delete');
  if (m.status === 'submitted' && can('materialRequests.approve')) out.push('approve', 'reject');
  if ((m.status === 'approved' || m.status === 'partially-issued') && can('materialRequests.issue')) out.push('issue');
  if (m.status === 'issued' && can('materialRequests.approve')) out.push('close');
  return out;
};

export const Requests = () => {
  const { can, user } = useAuth();
  const { t } = useLang();
  const toast = useToast();
  const actor = user?.id;
  const [q, setQ] = useState('');
  const [sp] = useSearchParams();
  // Deep links may preselect filters (?status=, ?project=). Unknown status
  // values are ignored so a crafted URL can never select a phantom filter.
  const [status, setStatus] = useState(() => {
    const s = sp.get('status') ?? '';
    return (MR_STATUSES as string[]).includes(s) ? s : '';
  });
  const [projectId, setProjectId] = useState(() => sp.get('project') ?? '');
  const [sortBy, setSortBy] = useState<'createdAt' | 'number' | 'status'>('createdAt');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [view, setView] = useState<MR | null>(null);
  const [create, setCreate] = useState(false);
  const [del, setDel] = useState<MR | null>(null);
  const [issueFor, setIssueFor] = useState<MR | null>(null);
  const [rejectFor, setRejectFor] = useState<MR | null>(null);
  const [approveFor, setApproveFor] = useState<MR | null>(null);
  const [closeFor, setCloseFor] = useState<MR | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const reload = async () => {
    setLoading(true); setError(null);
    try { await mockApi.MRs(actor); } catch (e) { setError(e instanceof Error ? e.message : '—'); }
    finally { setLoading(false); setVersion((v) => v + 1); }
  };
  useEffect(() => { void reload(); }, []);

  const listed = useMemo(
    () => mrApi.list({ q, status, projectId, sortBy, sortDir: dir }, actor),
    // `version` re-evaluates after every mutation — the mock store is not reactive.
    [q, status, projectId, sortBy, dir, actor, version]);
  const pages = Math.max(1, Math.ceil(listed.total / PAGE_SIZE));
  const rows = listed.items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const onSort = (k: string) => {
    if (sortBy === k) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(k as typeof sortBy); setDir('asc'); }
    setPage(0);
  };
  const projs = mrApi.projects(actor);

  const run = async (m: MR, action: 'submit' | 'approve' | 'reject' | 'close') => {
    if (running) return;
    setRunning(true);
    try {
      const res = await mrApi.act(m.id, action, actor ?? '', action === 'reject' || action === 'close' ? { notes: rejectNotes } : {});
      if (!res.ok) { toast('error', errText(t, res)); return; }
      setView((v) => (v && v.id === m.id ? res.mr : v));
      setRejectFor(null); setApproveFor(null); setCloseFor(null);
      await reload();
      toast('success', t(action === 'submit' ? 'mrSubmitted' : action === 'approve' ? 'mrApproved' : action === 'reject' ? 'mrRejected' : 'mrClosed'));
    } finally {
      setRunning(false);
    }
  };
  const remainingOf = (m: MR) => m.lines.reduce((s, l) => s + Math.max(0, l.requested - l.issued), 0);
  const issueLabel = (m: MR) => m.status === 'partially-issued'
    ? t('continueIssue', { n: remainingOf(m) })
    : t('startIssue');
  const [rejectNotes, setRejectNotes] = useState('');
  /** Guard against duplicate submits while `run` awaits (prompt rule 5). */
  const [running, setRunning] = useState(false);

  return (
    <div>
      <div className="cmdHead"><div>
        <div className="eyebrow"><Badge tone="blue">{listed.total} {t('mrTitle')}</Badge></div><h1>{t('mrTitle')}</h1>
      </div><div>{can('materialRequests.create') && <Button variant="primary" onClick={() => setCreate(true)}>+ {t('newMr')}</Button>}</div></div>

      <div className="toolbar" role="search">
        <span className="grow"><SearchInput label={t('search')} value={q} onChange={(v) => { setQ(v); setPage(0); }} placeholder={t('searchPh')} /></span>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} aria-label={t('status')}>
          <option value="">{t('allStatuses')}</option>
          {MR_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(t, s)}</option>)}
        </Select>
        <Select value={projectId} onChange={(e) => { setProjectId(e.target.value); setPage(0); }} aria-label={t('projectFilter')}>
          <option value="">{t('allProjects')}</option>
          {projs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        {(q || status || projectId) && <Button onClick={() => { setQ(''); setStatus(''); setProjectId(''); setPage(0); }}>{t('clearFilters')}</Button>}
      </div>

      {error && <div className="errBox" role="alert"><p>{error}</p><Button size="sm" variant="primary" onClick={reload}>{t('retry')}</Button></div>}
      {loading ? <div className="panel"><div className="skelRow"><div className="skel" /><div className="skel" /></div></div>
        : listed.denied ? <div className="panel"><EmptyState icon="alert" title={t('mrFilterDenied')} /></div>
          : rows.length === 0 ? <div className="panel"><EmptyState icon="inventory" title={q || status || projectId ? t('noResults') : t('empty')} /></div> : (
            <div className="panel"><RecShell label={t('mrTitle')} template={T}>
              <RecHead template={T}>
                <RecCell head><SortHeader label={t('numDate')} k="createdAt" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
                <RecCell head><SortHeader label={t('status')} k="status" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
                <RecCell head>{t('mrWarehouse')} / {t('projectFilter')}</RecCell>
                <RecCell head>{t('actions')}</RecCell>
              </RecHead>
              {rows.map((m) => (
                <RecRow key={m.id} template={T}>
                  <RecCell k={t('numDate')}><strong className="num">{m.number}</strong><br /><span className="muted small num">{m.createdAt}</span></RecCell>
                  <RecCell k={t('status')}><Badge tone={STATUS_TONE[m.status] ?? 'gray'}>{statusLabel(t, m.status)}</Badge>
                    {m.status === 'partially-issued' && <><br /><span className="muted small num">{t('partialLines', { n: m.lines.filter((l) => l.issued > 0 && l.issued < l.requested).length })}</span></>}
                  </RecCell>
                  <RecCell k={t('whProject')}>{whName(m.warehouseId)}<br /><span className="muted small">{m.projectId ? projName(m.projectId) : t('noProject')}</span></RecCell>
                  <RecCell><span className="recActions">
                    <Button size="sm" onClick={() => setView(m)}>{t('details')}</Button>
                    {actionsFor(m, can).includes('submit') && <Button size="sm" disabled={running} onClick={() => run(m, 'submit')}>{t('submitForReview')}</Button>}
                    {actionsFor(m, can).includes('approve') && <Button size="sm" variant="primary" onClick={() => setApproveFor(m)}>{t('approveMr')}</Button>}
                    {actionsFor(m, can).includes('reject') && <Button size="sm" variant="danger" onClick={() => { setRejectNotes(''); setRejectFor(m); }}>{t('rejectMr')}</Button>}
                    {actionsFor(m, can).includes('issue') && <Button size="sm" variant="primary" onClick={() => setIssueFor(m)}>{issueLabel(m)}</Button>}
                    {actionsFor(m, can).includes('close') && <Button size="sm" onClick={() => setCloseFor(m)}>{t('closeMr')}</Button>}
                    {actionsFor(m, can).includes('delete') && <Button size="sm" variant="danger" onClick={() => setDel(m)}>{t('deleteLabel')}</Button>}
                  </span></RecCell>
                </RecRow>
              ))}
            </RecShell>
              <Pager page={page} pages={pages} total={listed.total} pageSize={PAGE_SIZE} onPage={setPage} label={t('mrTitle')} />
            </div>
          )}

      <Modal title={`${t('details')} ${view?.number ?? ''}`} open={!!view} onClose={() => setView(null)} wide>
        {view && (
          <div>
            <p><Badge tone={STATUS_TONE[view.status] ?? 'gray'}>{statusLabel(t, view.status)}</Badge> · {whName(view.warehouseId)} · {view.projectId ? projName(view.projectId) : t('noProject')} · <span className="num">{view.createdAt}</span></p>
            {view.notes && <p className="muted small">{t('mrNotes')}: {view.notes}</p>}
            {view.reviewNotes && <p className="muted small">{t('rejectNotes')}: {view.reviewNotes}</p>}
            <div className="tableWrap"><table className="table" aria-label={t('issueLines')}>
              <thead><tr><th>{t('txItem')}</th><th>{t('mrRequested')}</th><th>{t('mrIssued')}</th><th>{t('mrRemaining')}</th></tr></thead>
              <tbody>{view.lines.map((l) => (
                <tr key={l.itemId}><td>{itemName(l.itemId)}</td><td className="num">{l.requested}</td><td className="num">{l.issued}</td>
                  <td className="num">{Math.max(0, l.requested - l.issued)}</td></tr>
              ))}</tbody>
            </table></div>
            <div className="formActions">
              {actionsFor(view, can).includes('submit') && <Button variant="primary" disabled={running} onClick={() => run(view, 'submit')}>{t('submitForReview')}</Button>}
              {actionsFor(view, can).includes('approve') && <><Button variant="primary" onClick={() => { setApproveFor(view); setView(null); }}>{t('approveMr')}</Button>
                <Button variant="danger" onClick={() => { setRejectNotes(''); setRejectFor(view); setView(null); }}>{t('rejectMr')}</Button></>}
              {actionsFor(view, can).includes('issue') && <Button variant="primary" onClick={() => { setIssueFor(view); setView(null); }}>{issueLabel(view)}</Button>}
              {actionsFor(view, can).includes('close') && <Button onClick={() => { setCloseFor(view); setView(null); }}>{t('closeMr')}</Button>}
              <Button onClick={() => setView(null)}>{t('close')}</Button>
            </div>
            <p className="muted small">{t('rejectViaApprove')}</p>
          </div>
        )}
      </Modal>

      <NewMrDialog open={create} onClose={() => setCreate(false)} actor={actor}
        onSaved={(number) => {
          setCreate(false);
          setQ(number); setStatus(''); setProjectId(''); setPage(0);
          void reload(); toast('success', t('mrSaved'));
        }} />

      <IssueDialog mr={issueFor} onClose={() => setIssueFor(null)} actor={actor}
        onDone={(msg) => { setIssueFor(null); setView(null); void reload(); toast('success', msg); }} />

      <Modal title={t('approveTitle')} open={!!approveFor} onClose={() => setApproveFor(null)}>
        {approveFor && (
          <div>
            <p><strong>{t('approveText', { number: approveFor.number, project: approveFor.projectId ? projName(approveFor.projectId) : t('noProject') })}</strong></p>
            <p className="muted small num">{approveFor.lines.map((l) => `${itemName(l.itemId)} × ${l.requested}`).join(' | ')}</p>
            <div className="formActions">
              <Button variant="primary" disabled={running} onClick={() => approveFor && run(approveFor, 'approve')}>{t('confirm')}</Button>
              <Button onClick={() => setApproveFor(null)}>{t('cancel')}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal title={t('rejectMr')} open={!!rejectFor} onClose={() => setRejectFor(null)}>
        <p className="muted small">{t('mrRejected')}</p>
        <Field label={t('rejectNotes')}><TextArea rows={3} value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} /></Field>
        <div className="formActions">
          <Button variant="danger" disabled={running} onClick={() => rejectFor && run(rejectFor, 'reject')}>{t('confirm')}</Button>
          <Button onClick={() => setRejectFor(null)}>{t('cancel')}</Button>
        </div>
      </Modal>

      <ConfirmDialog open={!!closeFor} text={`${t('closeMr')} — ${closeFor?.number}. ${t('closeUnverified')}`}
        onConfirm={() => closeFor && run(closeFor, 'close')} onCancel={() => setCloseFor(null)} />

      <ConfirmDialog open={!!del} text={`${t('deleteLabel')} ${del?.number} — ${t('mockNote')}`}
        onConfirm={async () => {
          if (!del) return;
          const r = await mrApi.remove(del.id, actor ?? '');
          setDel(null);
          if (!r.ok) { toast('error', errText(t, r)); return; }
          void reload(); toast('success', t('mockNote'));
        }} onCancel={() => setDel(null)} />
    </div>
  );
};

/* ---------- create: audited POST / fields only ---------- */
const NewMrDialog = ({ open, onClose, onSaved, actor }: { open: boolean; onClose: () => void; onSaved: (number: string) => void; actor?: string }) => {
  const { t } = useLang();
  const whs = lookups.warehouses(actor);
  const its = lookups.items(actor);
  const [projectId, setProjectId] = useState('');
  const [warehouseId, setWarehouseId] = useState('w1');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<MRLine[]>([{ itemId: 'i1', requested: 1, issued: 0 }]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setProjectId(''); setWarehouseId(whs[0]?.id ?? 'w1'); setNotes('');
    setLines([{ itemId: its[0]?.id ?? 'i1', requested: 1, issued: 0 }]);
    setErr(null); setBusy(false);
  }, [open]);
  const bad = !warehouseId || lines.length === 0 || lines.some((l) => !(l.requested > 0));

  return (
    <Modal title={t('newMr')} open={open} onClose={onClose} wide>
      {err && <div className="errBox" role="alert">{err}</div>}
      <div className="form2">
        <Field label={`${t('mrWarehouse')} *`}>
          <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} aria-label={t('mrWarehouse')}>
            {whs.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </Select>
        </Field>
        <Field label={t('projectFilter')}>
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label={t('projectFilter')}>
            <option value="">{t('noProject')}</option>
            {mrApi.projects(actor).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
      </div>
      <h3 style={{ marginTop: 12 }}>{t('txLines')} *</h3>
      {lines.map((l, i) => (
        <div key={i} className="lineRow">
          <Select aria-label={`${t('txItem')} ${i + 1}`} value={l.itemId} onChange={(e) => setLines((s) => s.map((x, j) => (j === i ? { ...x, itemId: e.target.value } : x)))}>
            {its.map((it) => <option key={it.id} value={it.id}>{it.name} · {it.unit}</option>)}
          </Select>
          <TextInput aria-label={`${t('mrRequested')} ${i + 1}`} type="number" min={1} value={String(l.requested)}
            onChange={(e) => setLines((s) => s.map((x, j) => (j === i ? { ...x, requested: e.target.value === '' ? Number.NaN : Number(e.target.value) } : x)))} />
          <Button size="sm" variant="danger" disabled={lines.length === 1} onClick={() => setLines((s) => s.filter((_, j) => j !== i))}>{t('removeLine')}</Button>
        </div>
      ))}
      <div className="formActions"><Button onClick={() => setLines((s) => [...s, { itemId: its[0]?.id ?? 'i1', requested: 1, issued: 0 }])}>+ {t('addItem')}</Button></div>
      <Field label={t('mrNotes')}><TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <div className="formActions">
        <Button variant="primary" disabled={bad || busy} onClick={async () => {
          setBusy(true); setErr(null);
          const res = await mrApi.create({ projectId: projectId || undefined, warehouseId, notes: notes || undefined, lines }, actor ?? '');
          setBusy(false);
          if (!res.ok) { setErr(errText(t, res)); return; }
          // Point the list at the record just created: on a filtered/paged
          // view the new row would otherwise be invisible right after saving.
          onSaved(res.mr.number);
        }}>{t('saveDraft')}</Button>
        <Button onClick={onClose}>{t('cancel')}</Button>
      </div>
    </Modal>
  );
};

/* ---------- issue: prefilled from the request, remaining-quantity guarded ---------- */
const IssueDialog = ({ mr, onClose, onDone, actor }: { mr: MR | null; onClose: () => void; onDone: (msg: string) => void; actor?: string }) => {
  const { t } = useLang();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!mr) return;
    // Prefill with the remaining amount and label it as the maximum, so the
    // number is never a silently invented quantity.
    const next: Record<string, number> = {};
    for (const l of mr.lines) next[l.itemId] = Math.max(0, l.requested - l.issued);
    setQty(next); setErr(null); setBusy(false);
  }, [mr]);
  if (!mr) return null;
  const lines = mr.lines.map((l) => ({ itemId: l.itemId, quantity: qty[l.itemId] ?? 0 }));
  const positive = lines.filter((l) => l.quantity > 0);
  const over = mr.lines.filter((l) => (qty[l.itemId] ?? 0) > Math.max(0, l.requested - l.issued));

  return (
    <Modal title={`${t('issueTitle')} ${mr.number}`} open={!!mr} onClose={onClose} wide>
      {err && <div className="errBox" role="alert">{err}</div>}
      <div className="card" style={{ marginBottom: 10 }}>
        <p><strong>{t('mrWarehouse')}:</strong> {whName(mr.warehouseId)} · <strong>{t('txRef')}:</strong> <span className="num">{mr.number}</span>
          {mr.projectId && <> · <strong>{t('projectFilter')}:</strong> {projName(mr.projectId)}</>}</p>
        <p className="muted small">{t('issuePrefillNote')}</p>
      </div>
      {mr.lines.map((l, i) => {
        const rem = Math.max(0, l.requested - l.issued);
        return (
          <div key={l.itemId} className="lineRow">
            <strong>{itemName(l.itemId)}</strong>
            <TextInput aria-label={`${t('txQty')} ${i + 1}`} type="number" min={0} value={String(qty[l.itemId] ?? 0)}
              onChange={(e) => setQty((s) => ({ ...s, [l.itemId]: e.target.value === '' ? 0 : Number(e.target.value) }))} />
            <span className="muted small num">{t('maxRemaining')}: {rem}</span>
            {rem === 0 && <span className="err" role="alert">{t('issueBlocked')}</span>}
          </div>
        );
      })}
      <div className="formActions">
        <Button variant="primary" disabled={busy || positive.length === 0 || over.length > 0} onClick={async () => {
          setBusy(true); setErr(null);
          const res = await mrApi.issue(mr.id, positive, actor ?? '');
          setBusy(false);
          if (!res.ok) { setErr(errText(t, res)); return; }
          onDone(t('mrIssuedOk'));
        }}>{t('confirm')}</Button>
        <Button disabled={busy} onClick={onClose}>{t('cancel')}</Button>
      </div>
      <p className="muted small">{t('txImmovable')}</p>
    </Modal>
  );
};