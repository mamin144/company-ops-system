import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth';
import { useLang } from '@/i18n';
import { itemName, lookups, mockApi, mrApi, projName, stockApi, whName } from '@/services/api';
import { TX_PERMISSION } from '@/services/api/adapters/mock/data';
import type { Txn, TxnLine, TxnType, Project } from '@/services/api/adapters/mock/data';
import type { TKey } from '@/i18n';
import { Badge, Button, EmptyState, Field, Modal, Pager, RecCell, RecHead, RecRow, RecShell, SearchInput, Select, SortHeader, StatusDot, Tabs, TextArea, TextInput, statusLabel, useToast, errText } from '@/shared/ui';

/** Plain-language stock effect per movement type — the permission keys stay
    in code (TX_PERMISSION) and never reach ordinary users. */
const TX_DESC: Record<TxnType, TKey> = {
  IN: 'txDescIn', OUT: 'txDescOut', TRANSFER: 'txDescTransfer',
  ADJUSTMENT: 'txDescAdjust', RETURN: 'txDescReturn',
};

const T = '1fr 1.5fr 1fr 1.2fr 1fr';
const TYPES: TxnType[] = ['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT', 'RETURN'];
const PAGE_SIZE = 8;
const today = () => new Date().toISOString().slice(0, 10);
const qtyOf = (x: Txn) => x.lines.reduce((s, l) => s + l.quantity, 0);
const sign = (x: Txn) => (x.type === 'OUT' || x.type === 'TRANSFER' ? '−' : x.type === 'ADJUSTMENT' && x.lines[0]?.quantity < 0 ? '−' : '+');

export const Stock = () => {
  const { can, user } = useAuth();
  const { t } = useLang();
  const toast = useToast();
  const actor = user?.id;
  const [tab, setTab] = useState('history');
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [sp] = useSearchParams();
  const [projectId, setProjectId] = useState(() => sp.get('project') ?? '');
  const [sortBy, setSortBy] = useState<'date' | 'number' | 'type' | 'item' | 'warehouse' | 'qty'>('date');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [ov, setOv] = useState<ReturnType<typeof stockApi.overview> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setError(null);
    try { setOv(await mockApi.overview(actor)); } catch (e) { setError(e instanceof Error ? e.message : '—'); }
  };
  useEffect(() => { void load(); }, []);

  // Phase 13: the scoped project list is async in both transports, so the
  // history filter loads it in an effect (best-effort; the movement list's
  // own error state covers load failures).
  const [scopedProjects, setScopedProjects] = useState<Project[]>([]);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const list = await mrApi.projects(actor);
        if (alive) setScopedProjects(list);
      } catch {
        /* no filter options until a later retry */
      }
    })();
    return () => { alive = false; };
  }, [actor]);

  const rows = useMemo(() => stockApi.list({ q, type, projectId, sortBy, sortDir: dir }, actor), [q, type, projectId, sortBy, dir, actor, ov]);
  const pages = Math.max(1, Math.ceil(rows.total / PAGE_SIZE));
  const view = rows.items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const onSort = (k: string) => {
    if (sortBy === k) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(k as typeof sortBy); setDir('asc'); }
    setPage(0);
  };
  // Only the movement types this identity actually holds a permission for.
  const allowedTypes = TYPES.filter((x) => can(TX_PERMISSION[x]));
  const whs = lookups.warehouses(actor);

  return (
    <div>
      <div className="cmdHead"><div><h1>{t('stockTitle')}</h1><p className="muted small">{t('mockNote')}</p></div>
        <div>{allowedTypes.length > 0 && <Button variant="primary" onClick={() => setOpen(true)}>+ {t('newTx')}</Button>}</div></div>
      <Tabs label={t('stockTitle')} tabs={[{ key: 'history', label: t('stockMoves') }, { key: 'overview', label: t('txBalances') }, { key: 'low', label: t('txLow') }]} active={tab} onChange={setTab} />

      {error && <div className="errBox" role="alert"><p>{error}</p><Button size="sm" variant="primary" onClick={load}>{t('retry')}</Button></div>}

      {tab === 'history' && (
        <>
          <div className="toolbar" role="search">
            <span className="grow"><SearchInput label={t('search')} value={q} onChange={(v) => { setQ(v); setPage(0); }} placeholder={t('searchPh')} /></span>
            <Select value={type} onChange={(e) => { setType(e.target.value); setPage(0); }} aria-label={t('txType')}>
              <option value="">{t('allTypes')}</option>
              {TYPES.map((x) => <option key={x} value={x}>{statusLabel(t, x)}</option>)}
            </Select>
            <Select value={projectId} onChange={(e) => { setProjectId(e.target.value); setPage(0); }} aria-label={t('projectFilter')}>
              <option value="">{t('allProjects')}</option>
              {scopedProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            {(q || type || projectId) && <Button onClick={() => { setQ(''); setType(''); setProjectId(''); setPage(0); }}>{t('clearFilters')}</Button>}
          </div>
          {rows.denied ? <div className="panel"><EmptyState icon="alert" title={t('mrFilterDenied')} /></div>
            : view.length === 0 ? <div className="panel"><EmptyState icon="inventory" title={q || type || projectId ? t('noResults') : t('empty')} /></div> : (
              <div className="panel">
                <RecShell label={t('txHistory')} template={T}>
                  <RecHead template={T}>
                    <RecCell head><SortHeader label={t('numDate')} k="number" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
                    <RecCell head><SortHeader label={t('txItem')} k="item" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
                    <RecCell head><SortHeader label={t('txType')} k="type" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
                    <RecCell head><SortHeader label={t('sourceWh')} k="warehouse" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
                    <RecCell head><SortHeader label={t('txQty')} k="qty" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
                  </RecHead>
                  {view.map((x) => (
                    <RecRow key={x.id} template={T}>
                      <RecCell k={t('numDate')}><span className="num"><strong>{x.number}</strong></span><br /><span className="muted small num">{x.date}</span>
                        {x.referenceNumber && <><br /><span className="muted small num">{t('txRef')}: {x.referenceNumber}</span></>}
                      </RecCell>
                      <RecCell k={t('txItem')}>{x.lines.map((l) => <div key={l.itemId}>{itemName(l.itemId)} <span className="num">×{l.quantity}</span>{l.unitCost ? <span className="muted small num"> @ {l.unitCost}</span> : null}</div>)}</RecCell>
                      <RecCell k={t('txType')}><Badge tone={x.type === 'OUT' ? 'red' : x.type === 'IN' || x.type === 'RETURN' ? 'green' : 'blue'}>{statusLabel(t, x.type)}</Badge>
                        {x.destinationWarehouseId && <><br /><span className="muted small">{t('transferRoute', { src: whName(x.warehouseId), dst: whName(x.destinationWarehouseId) })}</span></>}
                      </RecCell>
                      <RecCell k={t('sourceWh')}>{whName(x.warehouseId)}{x.projectId && <><br /><span className="muted small">{projName(x.projectId)}</span></>}</RecCell>
                      <RecCell k={t('txQty')}><span className="num"><strong>{sign(x)}{Math.abs(qtyOf(x))}</strong></span></RecCell>
                    </RecRow>
                  ))}
                </RecShell>
                <Pager page={page} pages={pages} total={rows.total} pageSize={PAGE_SIZE} onPage={setPage} label={t('txHistory')} />
              </div>
            )}
        </>
      )}

      {tab === 'overview' && (
        <div className="panel">
          <p className="muted small">{t('ledgerNote')}</p>
          {ov ? Object.entries(ov.balances).map(([w, lines]) => (
            <section key={w} style={{ marginBottom: 14 }}>
              <h3>{whName(w)}</h3>
              {Object.entries(lines).filter(([, v]) => v !== 0).map(([item, v]) => (
                <p key={item}>{itemName(item)} — <strong className="num">{v}</strong></p>
              ))}
            </section>
          )) : <div className="skelRow"><div className="skel" /></div>}
        </div>
      )}

      {tab === 'low' && (
        <div className="panel">
          {(ov?.lowStock ?? []).length > 0 ? (ov?.lowStock ?? []).map(({ item, qty }) => (
            <p key={item.id}><StatusDot tone="red">{t('lowStockLine', { item: item.name, qty, min: item.minimumStock ?? 0 })}</StatusDot></p>
          )) : <p><StatusDot tone="green">{t('lowStockEmpty')}</StatusDot></p>}
        </div>
      )}

      <NewTxDialog open={open} onClose={() => setOpen(false)} allowedTypes={allowedTypes}
        onSaved={() => { setOpen(false); void load(); toast('success', t('txSaved')); }} />
    </div>
  );
};

/* ---------- new transaction: fields change with the movement type ---------- */
const NewTxDialog = ({ open, onClose, onSaved, allowedTypes }: { open: boolean; onClose: () => void; onSaved: () => void; allowedTypes: TxnType[] }) => {
  const { t } = useLang();
  const { user } = useAuth();
  const whs = lookups.warehouses(user?.id);
  const its = lookups.items(user?.id);
  // Phase 13: the scoped project list is async in both transports — loaded in
  // an effect here (best-effort; the select is disabled while the list is
  // empty, same UX as before).
  const [projs, setProjs] = useState<Project[]>([]);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const list = await mrApi.projects(user?.id);
        if (alive) setProjs(list);
      } catch {
        /* select stays disabled until a later attempt */
      }
    })();
    return () => { alive = false; };
  }, [user?.id]);
  const [type, setType] = useState<TxnType>('IN');
  const [warehouseId, setWarehouseId] = useState('w1');
  const [destId, setDestId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [date, setDate] = useState(today());
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<TxnLine[]>([{ itemId: 'i1', quantity: 1 }]);
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(allowedTypes[0] ?? 'IN');
    setWarehouseId('w1'); setDestId(''); setProjectId(''); setDate(today());
    setReference(''); setNotes(''); setLines([{ itemId: 'i1', quantity: 1 }]);
    setStep('form'); setErr(null); setBusy(false);
  }, [open]);

  // A type the identity lost (or never had) must never stay selected — the
// permission is re-checked by the mock too, this keeps the form honest.
useEffect(() => {
  if (!allowedTypes.includes(type) && allowedTypes.length > 0) setType(allowedTypes[0]);
}, [allowedTypes, type]);
  const isTransfer = type === 'TRANSFER';
  const negativeOk = type === 'ADJUSTMENT';

  const lineErr = (i: number): string | null => {
    const l = lines[i];
    if (!l.itemId) return t('txItem');
    if (Number.isNaN(l.quantity)) return t('txQty');
    if (l.quantity < 0 && !negativeOk) return t('eNegativeAdjOnly');
    if (l.quantity === 0) return t('eQtyZero');
    return null;
  };
  const lineAvail = (i: number) => {
    const l = lines[i];
    if (!l.itemId) return null;
    if (type === 'OUT' || type === 'TRANSFER') return stockApi.available(l.itemId, warehouseId);
    return null;
  };
  // Field-level messages render inline next to each control; `formErr` only
  // decides whether the review step may be reached.
  const formErr = (): string | undefined => {
    if (!date) return t('txDate');
    if (lines.length === 0) return t('eNeedLine');
    for (let i = 0; i < lines.length; i++) {
      const e = lineErr(i);
      if (e) return e;
    }
    if (isTransfer && !destId) return t('destWh');
    if (isTransfer && destId === warehouseId) return t('sameWarehouse');
    return undefined;
  };

  const submit = async () => {
    setBusy(true); setErr(null);
    const res = await stockApi.create({
      type, warehouseId, destinationWarehouseId: isTransfer ? destId : undefined,
      projectId: projectId || undefined, date, referenceNumber: reference || undefined,
      notes: notes || undefined, lines,
    }, user?.id ?? '');
    setBusy(false);
    if (!res.ok) { setErr(errText(t, res)); setStep('form'); return; }
    onSaved();
  };

  return (
    <Modal title={t('newTx')} open={open} onClose={onClose} wide>
      {step === 'form' ? (
        <div>
          {err && <div className="errBox" role="alert">{err}</div>}
          <div className="form2">
            <Field label={`${t('txType')} *`}>
              <Select aria-label={t('txType')} value={type} onChange={(e) => { setType(e.target.value as TxnType); setErr(null); }}>
                {TYPES.map((x) => <option key={x} value={x} disabled={!allowedTypes.includes(x)}>{statusLabel(t, x)} — {t(TX_DESC[x])}</option>)}
              </Select>
            </Field>
            <Field label={`${t('sourceWh')} *`}>
              <Select aria-label={t('sourceWh')} value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setErr(null); }}>
                {whs.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </Select>
            </Field>
            {isTransfer && (
              <Field label={`${t('destWh')} *`} error={destId && destId === warehouseId ? t('sameWarehouse') : undefined}>
                <Select value={destId} onChange={(e) => { setDestId(e.target.value); setErr(null); }} aria-label={t('destWh')}>
                  <option value="">— {t('destWh')} —</option>
                  {whs.filter((w) => w.id !== warehouseId).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </Select>
              </Field>
            )}
            <Field label={t('txProject')}>
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label={t('txProject')} disabled={projs.length === 0}>
                <option value="">—</option>
                {projs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label={`${t('txDate')} *`}><TextInput aria-label={t('txDate')} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label={t('txRef')}><TextInput aria-label={t('txRef')} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="PO-… / MR-…" /></Field>
          </div>
          <h3 style={{ marginTop: 12 }}>{t('txLines')} *</h3>
          {lines.map((l, i) => {
            const avail = lineAvail(i);
            const short = avail !== null && l.quantity > avail;
            return (
              <div key={i} className="lineRow">
                <Select aria-label={`${t('txItem')} ${i + 1}`} value={l.itemId} onChange={(e) => setLines((s) => s.map((x, j) => (j === i ? { ...x, itemId: e.target.value } : x)))}>
                  {its.map((it) => <option key={it.id} value={it.id}>{it.name} · {it.unit}</option>)}
                </Select>
                <TextInput aria-label={`${t('txQty')} ${i + 1}`} type="number" value={String(l.quantity)}
                  onChange={(e) => setLines((s) => s.map((x, j) => (j === i ? { ...x, quantity: e.target.value === '' ? Number.NaN : Number(e.target.value) } : x)))} />
                <TextInput aria-label={`${t('txUnitCost')} ${i + 1}`} type="number" placeholder={t('txUnitCost')}
                  value={l.unitCost === undefined ? '' : String(l.unitCost)}
                  onChange={(e) => setLines((s) => s.map((x, j) => (j === i ? { ...x, unitCost: e.target.value === '' ? undefined : Number(e.target.value) } : x)))} />
                {avail !== null && <span className={short ? 'err' : 'muted small num'} role={short ? 'alert' : undefined}>
                  {t('availNow')}: {avail}{short ? ` — ${t('qtyShort')}` : ''}
                </span>}
                {lineErr(i) && <span className="err" role="alert">{lineErr(i)}</span>}
                <Button size="sm" variant="danger" disabled={lines.length === 1} onClick={() => setLines((s) => s.filter((_, j) => j !== i))}>{t('removeLine')}</Button>
              </div>
            );
          })}
          <div className="formActions">
            <Button onClick={() => setLines((s) => [...s, { itemId: its[0]?.id ?? 'i1', quantity: 1 }])}>+ {t('addLine')}</Button>
          </div>
          <Field label={t('txNotes')}><TextArea aria-label={t('txNotes')} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <p className="muted small">{t('txImmovable')}</p>
          <div className="formActions">
            <Button variant="primary" disabled={!!formErr() || busy} onClick={() => setStep('review')}>{t('reviewTx')}</Button>
            <Button onClick={onClose}>{t('cancel')}</Button>
          </div>
        </div>
      ) : (
        <div>
          <p><strong>{statusLabel(t, type)}</strong> · {whName(warehouseId)}{isTransfer && destId ? ` · ${t('transferRoute', { src: whName(warehouseId), dst: whName(destId) })}` : ''} · <span className="num">{date}</span></p>
          {isTransfer && destId && <p className="muted small">{t('transferEffect', { q: lines.reduce((s, l) => s + Math.abs(l.quantity), 0), src: whName(warehouseId), dst: whName(destId) })}</p>}
          {lines.map((l, i) => <p key={i}>{itemName(l.itemId)} — <span className="num">{l.quantity}</span></p>)}
          {projectId && <p className="muted small">{t('txProject')}: {projs.find((p) => p.id === projectId)?.name}</p>}
          {reference && <p className="muted small">{t('txRef')}: {reference}</p>}
          {isTransfer && <p className="muted small">{t('transferNote')}</p>}
          <div className="formActions">
            <Button variant="primary" disabled={busy} onClick={submit}>{t('confirmTx')}</Button>
            <Button disabled={busy} onClick={() => setStep('form')}>{t('backBtn')}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
};