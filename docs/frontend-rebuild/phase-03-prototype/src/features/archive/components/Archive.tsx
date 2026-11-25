import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth';
import { useLang } from '@/i18n';
import { mockApi, mrApi, projName } from '@/services/api';
import { STATUS_TONE } from '@/services/api/adapters/mock/data';
import type { Doc } from '@/services/api/adapters/mock/data';
import { parseCsv } from '@/shared/lib/files';
import { ContextualExport } from '@/shared/ui/ContextualExport';
import { Badge, Button, ConfirmDialog, EmptyState, Field, Menu, Modal, Pager, RecCell, RecHead, RecRow, RecShell, SearchInput, Select, SortHeader, TextArea, TextInput, statusLabel, useToast, errText } from '@/shared/ui';

const T = '2.4fr 1fr 1fr 1fr auto';
// 8 seeded documents → 2 pages for full-scope identities, so pagination is
// exercised by real rows rather than fixtures.
const PAGE_SIZE = 5;
const STATUSES = ['draft', 'submitted', 'under-review', 'approved', 'rejected', 'superseded', 'archived'] as const;
const RENDERABLE = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'];
const GRIDABLE = ['xlsx', 'csv'];

/* CSV parsing lives in mock/exports (parseCsv), shared with the Warehouses
   importer so both wizards quote and split identically. */
const HEADER_ALIASES: Record<string, string[]> = {
  title: ['title', 'name', 'العنوان', 'عنوان', 'عنوان المستند', 'اسم المستند', 'subject'],
  number: ['number', 'documentnumber', 'code', 'رقم المستند', 'رقم', 'الكود'],
  category: ['category', 'التصنيف', 'تصنيف'],
  type: ['type', 'filetype', 'النوع', 'نوع المستند'],
  status: ['status', 'الحالة', 'حالة'],
};
const normHeader = (h: string) => h.trim().toLowerCase().replace(/[\s_-]+/g, '');
const mapHeader = (h: string): string | null => {
  const n = normHeader(h);
  for (const [field, aliases] of Object.entries(HEADER_ALIASES))
    if (aliases.some((a) => normHeader(a) === n)) return field;
  return null;
};
export const Archive = () => {
  const { can, user } = useAuth();
  const { t } = useLang();
  const toast = useToast();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [byId, setById] = useState<Record<string, Doc>>({});
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [sp] = useSearchParams();
  // Deep-linkable project filter (project workspace links here with
  // ?project=<id>). Client-side: the mock reader has no project parameter,
  // and membership is enforced before filtering (see projDenied below).
  const [project, setProject] = useState(() => sp.get('project') ?? '');
  const [sortBy, setSortBy] = useState<'title' | 'category' | 'status' | 'updated'>('updated');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<string[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [revDoc, setRevDoc] = useState<Doc | null>(null);
  const [del, setDel] = useState<Doc | null>(null);
  const [viewDoc, setViewDoc] = useState<Doc | null>(null);
  const [statusDoc, setStatusDoc] = useState<Doc | null>(null);
  const [statusVal, setStatusVal] = useState<Doc['status']>('draft');
  const [statusAsk, setStatusAsk] = useState(false);
  const [replaceDoc, setReplaceDoc] = useState<Doc | null>(null);
  const [repStep, setRepStep] = useState<'form' | 'review'>('form');
  const [repFile, setRepFile] = useState<{ name: string; size: number } | null>(null);
  /* Phase 7 — metadata edit modal (menu item 'تعديل'), upload optional
     metadata, revision upload flow, delete wiring, busy protections. */
  const [editDoc, setEditDoc] = useState<Doc | null>(null);
  const [editForm, setEditForm] = useState({ title: '', number: '', category: '', type: '', tags: '', notes: '', project: '' });
  const [editErr, setEditErr] = useState<string | null>(null);
  const [busyEdit, setBusyEdit] = useState(false);
  const [uploadMeta, setUploadMeta] = useState({ number: '', category: '', type: '', tags: '', notes: '' });
  const [busyUpload, setBusyUpload] = useState(false);
  const [revStep, setRevStep] = useState<'closed' | 'form' | 'review'>('closed');
  const [revFile, setRevFile] = useState<{ name: string; size: number } | null>(null);
  const [revNotes, setRevNotes] = useState('');
  const [busyRev, setBusyRev] = useState(false);
  const [busyStatus, setBusyStatus] = useState(false);
  const [busyDel, setBusyDel] = useState(false);
  const [linksDoc, setLinksDoc] = useState<Doc | null>(null);
  const [linkTarget, setLinkTarget] = useState('');
  const [linkErr, setLinkErr] = useState<string | null>(null);
  const [unlinkAsk, setUnlinkAsk] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [impStep, setImpStep] = useState(0);
  const [csvName, setCsvName] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvMap, setCsvMap] = useState<Record<number, string | null>>({});
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvInclude, setCsvInclude] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (override?: { q?: string; status?: string }) => {
    setLoading(true);
    setError(null);
    setPage(0);
    // An explicit override wins: the clear button resets state AND fetches in
    // the same tick, and the bare closure would still carry the old filters.
    const f = { q, status, ...override };
    try {
      const fetched = await mockApi.documents({ q: f.q, status: f.status }, user?.id);
      setDocs(fetched);
      setById((prev) => { const n = { ...prev }; for (const d of fetched) n[d.id] = d; return n; });
    } catch (e) {
      setError(e instanceof Error ? t('eLoadFailed') : t('eLoadFailed'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  /* Phase 7 openers: each dialog resets its own step/busy state so reopening
     after an error can never carry a stale form or a stuck busy flag. */
  const openRev = (d: Doc) => { setRevDoc(d); setRevStep('closed'); setRevFile(null); setRevNotes(''); };
  const openEdit = (d: Doc) => {
    setEditDoc(d);
    setEditForm({ title: d.title, number: d.number, category: d.category, type: d.type, tags: d.tags.join(', '), notes: d.notes ?? '', project: d.projectId ?? '' });
    setEditErr(null);
  };

  /** Membership is checked BEFORE the user-supplied project value filters
      anything: an invisible project is a hard denial, never an empty list. */
  const projDenied = project !== '' && !mrApi.projects(user?.id).some((p) => p.id === project);
  const inProject = project === '' || projDenied ? docs : docs.filter((d) => d.projectId === project);

  /** Stable, locale-aware compare so Arabic and Latin columns both sort sanely. */
  const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  const sorted = useMemo(() => {
    const s = [...inProject];
    const sign = dir === 'asc' ? 1 : -1;
    s.sort((a, b) => {
      switch (sortBy) {
        case 'title': return sign * cmp(a.title, b.title);
        case 'category': return sign * (cmp(a.category, b.category) || cmp(a.number, b.number));
        case 'status':
          return sign * (cmp(statusLabel(t, a.status), statusLabel(t, b.status)) || cmp(a.number, b.number));
        default: return sign * (cmp(a.updatedAt, b.updatedAt) || cmp(a.number, b.number));
      }
    });
    return s;
  }, [inProject, sortBy, dir, t]);
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
      <div className="cmdHead">
        <div>
          <div className="eyebrow"><Badge tone="blue">{t('docsCountMock', { n: docs.length })}</Badge></div>
          <h1>{t('archive')}</h1>
          <p className="muted small">{t('archiveScopeNote')} {t('mockNote')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {can('archive.upload') && <Button onClick={() => { setImportOpen(true); setImpStep(0); setCsvName(''); setCsvHeaders([]); setCsvRows([]); setCsvMap({}); setCsvInclude({}); }}>{t('importCsvBtn')}</Button>}
          {can('archive.upload') && <Button variant="primary" onClick={() => setUploadOpen(true)}>{t('uploadDocMock')}</Button>}
        </div>
      </div>

      <form className="toolbar" role="search" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <span className="grow"><SearchInput label={t('search')} value={q} onChange={setQ} placeholder={t('searchPh')} /></span>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('status')}>
          <option value="">{t('allStatuses')}</option>
          {['draft', 'submitted', 'under-review', 'approved', 'rejected', 'superseded', 'archived'].map((s) => <option key={s} value={s}>{statusLabel(t, s)}</option>)}
        </Select>
        <Select value={project} onChange={(e) => { setProject(e.target.value); setPage(0); }} aria-label={t('projectFilter')}>
          <option value="">{t('allProjects')}</option>
          {mrApi.projects(user?.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Button onClick={() => { setQ(''); setStatus(''); setProject(''); setTimeout(() => load({ q: '', status: '' }), 0); }}>{t('clearFilters')}</Button>
        <Button variant="primary" onClick={() => load()}>{t('search')}</Button>
      </form>

      {error && (
        <div className="errBox" role="alert">
          <p>{error}</p>
          <Button size="sm" variant="primary" onClick={() => load()}>{t('retry')}</Button>
        </div>
      )}
      {loading ? <div className="panel"><div className="skelRow"><div className="skel" /><div className="skel" /></div></div>
        : projDenied ? <div className="panel"><EmptyState title={t('mrFilterDenied')} hint={t('noProjectsScopedHint')} /></div>
        : sorted.length === 0 ? (
          <div className="panel">
            <EmptyState title={q || status || project ? t('noResults') : t('empty')} />
            <ContextualExport
              reportId="documents"
              filter={{
                q: q || undefined, status: status || undefined, project: project || undefined,
                sortBy, sortDir: dir,
              }}
            />
          </div>
        ) : (
          <div className="panel">
            <p className="srOnly" role="status">{t('resultsLive', { n: sorted.length })}</p>
            <RecShell label={t('archive')} template={T}>
            <RecHead template={T}>
              <RecCell head><SortHeader label={t('docCol')} k="title" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
              <RecCell head><SortHeader label={t('categoryLabel')} k="category" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
              <RecCell head><SortHeader label={t('versionStatus')} k="status" sortBy={sortBy} dir={dir} onSort={onSort} /><SortHeader label={t('sortUpdated')} k="updated" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
              <RecCell head>{t('projectSource')}</RecCell><RecCell head>{t('actions')}</RecCell>
            </RecHead>
            {view.map((d) => (
              <RecRow key={d.id} template={T}>
                <RecCell k={t('docCol')}>
                  <input type="checkbox" checked={sel.includes(d.id)} onChange={() => toggle(d.id)} aria-label={t('selectDoc', { title: d.title })} />{' '}
                  <strong>{d.title}</strong><br />
                  <span className="muted small num ltr">{d.number} · {d.fileName}</span><br />
                  <span className="muted small">{d.tags.map((x) => `#${x}`).join(' ')}</span>
                </RecCell>
                <RecCell k={t('categoryLabel')}><Badge tone="blue">{d.category}</Badge> <span className="muted small">{d.type}</span></RecCell>
                <RecCell k={t('versionStatus')}>
                  <button type="button" className="linkBtn num" onClick={() => openRev(d)}>v{d.revision} ({d.revisions.length})</button><br />
                  <Badge tone={STATUS_TONE[d.status] ?? 'gray'}>{statusLabel(t, d.status)}</Badge><br />
                  <span className="muted small num">{d.updatedAt}</span>
                </RecCell>
                <RecCell k={t('projectSource')}>{projName(d.projectId)}<br />{d.folderName ? <span className="muted small">{t('legacyFolder', { name: d.folderName })}</span> : null}</RecCell>
                <RecCell><span className="recActions">
                  <Button size="sm" variant="primary" onClick={() => setViewDoc(d)}>{t('previewBtn')}</Button>
                  {can('archive.download') && <Button size="sm" onClick={() => toast('info', t('mockNote'))}>{t('download')}</Button>}
                  {(can('archive.edit') || can('archive.delete')) && (
                    <Menu label={t('moreMenu')} items={[
                      ...(can('archive.edit') ? [
                        { label: t('actionStatus'), onSelect: () => { setStatusDoc(d); setStatusVal(d.status); setStatusAsk(false); } },
                        { label: t('actionReplace'), onSelect: () => { setReplaceDoc(d); setRepStep('form'); setRepFile(null); } },
                        { label: `${t('actionLinks')} (${d.links.length})`, onSelect: () => { setLinksDoc(d); setLinkTarget(''); setLinkErr(null); setUnlinkAsk(null); } },
                        { label: t('edit'), onSelect: () => openEdit(d) },
                      ] : []),
                      ...(can('archive.delete') ? [
                        { label: t('deleteLabel'), danger: true, onSelect: () => setDel(d) },
                      ] : []),
                    ]} />
                  )}
                </span></RecCell>
              </RecRow>
            ))}
          </RecShell>
            <ContextualExport
              reportId="documents"
              filter={{
                q: q || undefined, status: status || undefined, project: project || undefined,
                sortBy, sortDir: dir,
              }}
            />
            <p className="muted small">{t('archiveExportNote')}</p>
            <Pager page={safePage} pages={pages} total={sorted.length} pageSize={PAGE_SIZE} onPage={setPage} label={t('archive')} />
          </div>
        )}

      {sel.length > 0 && (
        <div className="panel" role="region" aria-label="batch" style={{ borderColor: 'var(--primary)' }}>
          {t('selectedCount')} <strong className="num">{sel.length}</strong> —{' '}
          <Button size="sm" variant="primary" onClick={() => toast('info', t('zipToast'))}>{t('downloadZipMock')}</Button>{' '}
          <Button size="sm" onClick={() => setSel([])}>{t('clearSelection')}</Button>
        </div>
      )}

      <Modal title={t('uploadDocModal')} open={uploadOpen} onClose={() => setUploadOpen(false)}>
        <p className="muted small">{t('uploadNoFolder')}</p>
        {/* Title is intentionally the FIRST input in the DOM (regression P2-01
            walks the focus cycle from it); the Phase 7 optional metadata
            fields append after it. */}
        <Field label={t('docTitleLabel')}><TextInput value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
          <Field label={t('docNumberLabel')}><TextInput value={uploadMeta.number} onChange={(e) => setUploadMeta((m) => ({ ...m, number: e.target.value }))} /></Field>
          <Field label={t('categoryLabel')}><TextInput value={uploadMeta.category} onChange={(e) => setUploadMeta((m) => ({ ...m, category: e.target.value }))} /></Field>
          <Field label={t('docTypeLabel')}><TextInput value={uploadMeta.type} onChange={(e) => setUploadMeta((m) => ({ ...m, type: e.target.value }))} /></Field>
          <Field label={t('docTagsLabel')}><TextInput value={uploadMeta.tags} onChange={(e) => setUploadMeta((m) => ({ ...m, tags: e.target.value }))} /></Field>
        </div>
        <Field label={t('docNotesLabel')}><TextArea rows={2} value={uploadMeta.notes} onChange={(e) => setUploadMeta((m) => ({ ...m, notes: e.target.value }))} /></Field>
        <div className="formActions">
          <Button variant="primary" disabled={!title.trim() || busyUpload} onClick={async () => {
            setBusyUpload(true);
            try {
              // Tags parse locally on Arabic/Latin comma, mirroring the route's
              // parseTags body handling for a string payload.
              const tags = uploadMeta.tags.split(/[,،]/).map((s) => s.trim()).filter(Boolean);
              await mockApi.uploadDoc(title, { number: uploadMeta.number, category: uploadMeta.category, type: uploadMeta.type, tags: tags.length ? tags : undefined, notes: uploadMeta.notes });
              setUploadOpen(false); setTitle(''); setUploadMeta({ number: '', category: '', type: '', tags: '', notes: '' }); load(); toast('success', t('mockNote'));
            } finally { setBusyUpload(false); }
          }}>{t('upload')}</Button>
          <Button onClick={() => setUploadOpen(false)}>{t('cancel')}</Button>
        </div>
      </Modal>

      <Modal title={t('revisionsTitle', { title: revDoc?.title ?? '' })} open={!!revDoc} onClose={() => { setRevDoc(null); setRevStep('closed'); }} wide>
        <div className="timeline">
          {(revDoc?.revisions ?? []).map((r, i, a) => (
            <div key={r.id} className={`tItem${i === a.length - 1 ? ' cur' : ''}`}>
              <div><Badge tone={i === a.length - 1 ? 'green' : 'gray'}>v{r.revision}</Badge><br />
                <strong>{r.fileName}</strong><br />
                <span className="muted small">{r.by} · <span className="num">{r.at}</span></span><br />
                <Button size="sm" onClick={() => toast('info', t('mockNote'))}>{t('previewVersion')}</Button>
                {r.notes ? <p className="muted small">{t('notes')}: {r.notes}</p> : null}
              </div>
            </div>
          ))}
          {(revDoc?.revisions ?? []).length === 0 && <EmptyState title={t('noRevisions')} />}
        </div>
        {can('archive.edit') && revStep === 'closed' && (
          <p><Button variant="primary" onClick={() => { setRevFile(null); setRevNotes(''); setRevStep('form'); }}>{t('newRevisionMock')}</Button></p>
        )}
        {can('archive.edit') && revStep === 'form' && (
          <div>
            <Field label={`${t('newFile')} *`}>
              <input type="file" className="input" aria-label={t('newFile')} onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setRevFile(f ? { name: f.name, size: f.size } : null);
              }} />
            </Field>
            <Field label={t('revNotesLabel')}><TextArea rows={2} value={revNotes} onChange={(e) => setRevNotes(e.target.value)} /></Field>
            <div className="formActions">
              <Button variant="primary" disabled={!revFile} onClick={() => setRevStep('review')}>{t('reviewRevision')}</Button>
              <Button onClick={() => setRevStep('closed')}>{t('cancel')}</Button>
            </div>
          </div>
        )}
        {can('archive.edit') && revStep === 'review' && revFile && (
          <div>
            <p><strong>{t('newVersion')}:</strong> {revFile.name}</p>
            {revDoc?.status === 'approved' ? <p className="muted small">{t('downgradeNote')}</p> : null}
            <div className="formActions">
              <Button variant="primary" disabled={busyRev} onClick={async () => {
                if (!revDoc || !revFile || busyRev) return;
                setBusyRev(true);
                try {
                  const r = await mockApi.addRevision(revDoc.id, revFile.name, revNotes);
                  if (r.ok) {
                    setRevDoc(null); setRevFile(null); setRevStep('closed'); load();
                    toast('success', t('newRevOk', { rev: r.revision }));
                  }
                } finally { setBusyRev(false); }
              }}>{t('confirmRevision')}</Button>
              <Button onClick={() => setRevStep('form')}>{t('backBtn')}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal title={`${t('previewDoc')}: ${viewDoc?.title ?? ''}`} open={!!viewDoc} onClose={() => setViewDoc(null)} wide>
        {viewDoc && <DocViewer doc={viewDoc} byId={byId} onOpenLinked={(d) => setViewDoc(d)} />}
      </Modal>

      <Modal title={t('changeStatus')} open={!!statusDoc} onClose={() => { setStatusDoc(null); setStatusAsk(false); }}>
        <p className="muted small">{t('noTransitionRules')}</p>
        <Field label={t('status')}>
          <Select value={statusVal} onChange={(e) => setStatusVal(e.target.value as Doc['status'])}>
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(t, s)}</option>)}
          </Select>
        </Field>
        {!statusAsk ? (
          <div className="formActions">
            <Button variant="primary" onClick={() => setStatusAsk(true)}>{t('saveChanges')}</Button>
            <Button onClick={() => setStatusDoc(null)}>{t('cancel')}</Button>
          </div>
        ) : (
          <div>
            <p><strong>{t('statusConfirmText', { title: statusDoc?.title ?? '', number: statusDoc?.number ?? '', from: statusLabel(t, statusDoc?.status), to: statusLabel(t, statusVal) })}</strong></p>
            <p className="muted small">{t('statusConfirmHint')}</p>
            <div className="formActions">
              <Button variant="primary" disabled={busyStatus} onClick={async () => {
                if (!statusDoc || busyStatus) return;
                setBusyStatus(true);
                try {
                  await mockApi.setDocStatus(statusDoc.id, statusVal);
                  setStatusDoc(null); setStatusAsk(false); load(); toast('success', t('statusChanged'));
                } finally { setBusyStatus(false); }
              }}>{t('confirm')}</Button>
              <Button onClick={() => { setStatusDoc(null); setStatusAsk(false); }}>{t('cancel')}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal title={`${t('replaceDoc')}: ${replaceDoc?.title ?? ''}`} open={!!replaceDoc} onClose={() => setReplaceDoc(null)} wide>
        {replaceDoc && repStep === 'form' && (
          <div>
            <div className="card" style={{ marginBottom: 12 }}>
              <span className="l">{t('oldVersion')}</span><br />
              <strong>{replaceDoc.fileName}</strong> <span className="muted small num">v{replaceDoc.revision} · {statusLabel(t, replaceDoc.status)}</span>
            </div>
            <Field label={`${t('newFile')} *`}>
              <input type="file" className="input" aria-label={t('newFile')} onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setRepFile(f ? { name: f.name, size: f.size } : null);
              }} />
            </Field>
            {repFile && <p className="muted small num">{t('replaceNoUpload', { n: repFile.name, s: repFile.size })}</p>}
            <div className="formActions">
              <Button variant="primary" disabled={!repFile} onClick={() => setRepStep('review')}>{t('reviewReplace')}</Button>
              <Button onClick={() => setReplaceDoc(null)}>{t('cancel')}</Button>
            </div>
          </div>
        )}
        {replaceDoc && repStep === 'review' && repFile && (
          <div>
            <p><strong>{t('oldVersion')}:</strong> {replaceDoc.fileName} <span className="num">v{replaceDoc.revision}</span></p>
            <p><strong>{t('newVersion')}:</strong> {repFile.name}</p>
            <p className="muted small">{t('prevKept')}{replaceDoc.status === 'approved' ? ` — ${t('downgradeNote')}` : '.'}</p>
            <div className="formActions">
              <Button variant="primary" onClick={async () => {
                const r = await mockApi.replaceDoc(replaceDoc.id, repFile.name);
                setReplaceDoc(null); load();
                if (r.ok) toast('success', `${t('replacedOk')} (v${r.revision})`);
              }}>{t('confirmReplace')}</Button>
              <Button onClick={() => setRepStep('form')}>{t('backBtn')}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal title={`${t('linkedDocs')}: ${linksDoc?.title ?? ''}`} open={!!linksDoc} onClose={() => setLinksDoc(null)} wide>
        {linksDoc && (
          <LinksManager docId={linksDoc.id} onOpenLinked={(d) => { setLinksDoc(null); setViewDoc(d); }} onChanged={load} />
        )}
      </Modal>

      {/* Phase 7: metadata edit — mirrors PUT /documents/:id incl. the
          cross-project 403 rule. The picker lists PROJECTS THE ACTOR SEES,
          exactly the scope the route evaluates against. */}
      <Modal title={t('editDocTitle')} open={!!editDoc} onClose={() => setEditDoc(null)}>
        <p className="muted small">{t('editDocHint')}</p>
        {editErr && <div className="errBox" role="alert">{editErr}</div>}
        <Field label={t('docTitleLabel')}><TextInput value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
          <Field label={t('docNumberLabel')}><TextInput value={editForm.number} onChange={(e) => setEditForm((f) => ({ ...f, number: e.target.value }))} /></Field>
          <Field label={t('categoryLabel')}><TextInput value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))} /></Field>
          <Field label={t('docTypeLabel')}><TextInput value={editForm.type} onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))} /></Field>
          <Field label={t('docProjectLabel')}>
            <Select value={editForm.project} onChange={(e) => { setEditForm((f) => ({ ...f, project: e.target.value })); setEditErr(null); }}>
              <option value="">—</option>
              {mrApi.projects(user?.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label={t('docTagsLabel')}><TextInput value={editForm.tags} onChange={(e) => setEditForm((f) => ({ ...f, tags: e.target.value }))} /></Field>
        <Field label={t('docNotesLabel')}><TextArea rows={2} value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
        <div className="formActions">
          {/* Validated save like the reference modal: title is the required
              metadata field — save stays disabled while it is empty. */}
          <Button variant="primary" disabled={busyEdit || !editForm.title.trim()} onClick={async () => {
            if (!editDoc || busyEdit) return;
            setBusyEdit(true);
            try {
              const r = await mockApi.updateDoc(editDoc.id, user?.id, {
                title: editForm.title, number: editForm.number, category: editForm.category, type: editForm.type,
                tags: editForm.tags.split(/[,،]/).map((s) => s.trim()).filter(Boolean),
                notes: editForm.notes,
                projectId: editForm.project || undefined,
              });
              if (!r.ok) { setEditErr(errText(t, r)); return; }
              setEditDoc(null); load(); toast('success', t('metadataSaved'));
            } finally { setBusyEdit(false); }
          }}>{t('save')}</Button>
          <Button onClick={() => setEditDoc(null)}>{t('cancel')}</Button>
        </div>
      </Modal>

      <Modal title={t('importTitle')} open={importOpen} onClose={() => setImportOpen(false)} wide>
        <ImportWizard
          actorId={user?.id}
          onDone={(added, skipped) => { setImportOpen(false); load(); toast('success', t('summaryLine', { a: `+${added}`, b: skipped })); }}
          onCancel={() => setImportOpen(false)}
        />
      </Modal>

      {/* Phase 7: delete is now wired to the mock DELETE mirror. The confirm
          text stays truthful: only the in-memory demo record is removed. */}
      <ConfirmDialog open={!!del} text={t('confirmDeleteDoc', { title: del?.title ?? '' })}
        onConfirm={async () => {
          if (!del || busyDel) return;
          setBusyDel(true);
          try {
            await mockApi.deleteDoc(del.id, user?.id);
            setDel(null); load(); toast('success', t('deletedDemo'));
          } finally { setBusyDel(false); }
        }}
        onCancel={() => setDel(null)} />
    </div>
  );
};

/** Read-only viewer: synthetic content per type, honest fallback/empty states. */
export const DocViewer = ({ doc, byId, onOpenLinked }: { doc: Doc; byId: Record<string, Doc>; onOpenLinked: (d: Doc) => void }) => {
  const { t } = useLang();
  const rootRef = useRef<HTMLDivElement>(null);
  const firstMount = useRef(true);
  // Linked-document switches replace the focused control: move focus to the
  // new reading surface. Skipped on first mount so the Modal's own initial
  // focus (first control) wins and the opener capture stays valid.
  useEffect(() => {
    if (firstMount.current) { firstMount.current = false; return; }
    rootRef.current?.focus();
  }, [doc.id]);
  const linked = doc.links.map((id) => byId[id]).filter(Boolean);
  const waterMark = (
    <p className="muted small" role="note" style={{ border: '1px dashed var(--border-strong)', borderRadius: 6, padding: 8 }}>
      {t('mockContentNote')}
    </p>
  );
  let body: React.ReactNode;
  if (doc.revisions.length === 0) {
    body = (
      <div className="empty" role="status">
        <strong>{t('noPreviewContent')}</strong>
        <p className="muted small">{t('revisionOf')}: v{doc.revision} · {doc.fileName}</p>
      </div>
    );
  } else if (RENDERABLE.includes(doc.ext)) {
    body = (
      <div className="docSheet">
        {waterMark}
        <h3>{doc.title}</h3>
        <p className="muted small num">{doc.number} · v{doc.revision}</p>
        {[1, 2, 3].map((i) => <p key={i} className="muted">{t('mockLine', { i })}</p>)}
      </div>
    );
  } else if (GRIDABLE.includes(doc.ext)) {
    body = (
      <div>
        {waterMark}
        <div className="tableWrap"><table className="table" aria-label={t('mockGridLabel')}>
          <thead><tr>{[1, 2, 3].map((c) => <th key={c}>{t('mockCol', { i: c })}</th>)}</tr></thead>
          <tbody>{[1, 2, 3, 4].map((r) => <tr key={r}>{[1, 2, 3].map((c) => <td key={c} className="num">{t('mockCell', { r, c })}</td>)}</tr>)}</tbody>
        </table></div>
      </div>
    );
  } else {
    body = (
      <div className="empty" role="status">
        <strong>{t('noPreviewType')} ({doc.ext})</strong>
        <p className="muted small">{doc.fileName} · v{doc.revision} · {statusLabel(t, doc.status)}</p>
      </div>
    );
  }
  return (
    <div ref={rootRef} tabIndex={-1} role="document" aria-label={doc.title}>
      <p className="demoBanner" role="note">{t('previewDemoBanner')}</p>
      <div className="docMeta">
        <span className="l num eyebrow">{doc.number}</span><br />
        <strong>{doc.title}</strong><br />
        <span className="muted small">{doc.category} · {doc.type} · {doc.fileName}</span><br />
        <Badge tone={STATUS_TONE[doc.status] ?? 'gray'}>{statusLabel(t, doc.status)}</Badge>
        {doc.folderName ? <div className="muted small">{t('legacyFolder', { name: doc.folderName })}</div> : null}
        {doc.tags.length > 0 && <div className="muted small">{doc.tags.map((x) => `#${x}`).join(' ')}</div>}
        {/* Phase 7: notes are user-entered at runtime only — no invented seed values. */}
        {doc.notes ? <div className="muted small">{t('notes')}: {doc.notes}</div> : null}
      </div>
      {body}
      <h3 style={{ marginTop: 14 }}>{t('linkedDocs')} ({linked.length})</h3>
      {linked.length === 0 ? <p className="muted small">{t('noLinks')}</p> : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {linked.map((l) => <Button key={l.id} size="sm" onClick={() => onOpenLinked(l)}>{t('openLinked')}: {l.title}</Button>)}
        </div>
      )}
    </div>
  );
};

/** Links manager: list, add (dup/self/invalid-guarded), remove with confirm. */
export const LinksManager = ({ docId, onOpenLinked, onChanged }: { docId: string; onOpenLinked: (d: Doc) => void; onChanged: () => void | Promise<void> }) => {
  const { t } = useLang();
  const { user } = useAuth();
  const toast = useToast();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [target, setTarget] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [ask, setAsk] = useState<string | null>(null);
  // The link picker offers exactly the documents this identity may see — the
  // same scoped reader the list uses. A link target outside the scope can
  // neither be picked nor opened from here.
  const reload = async () => setDocs(await mockApi.documents({}, user?.id));
  useEffect(() => { reload(); }, []);
  const doc = docs.find((d) => d.id === docId);
  // Duplicate prevention is VISIBLE: already-linked documents stay in the list
  // but are disabled and labelled, instead of silently disappearing.
  const options = docs.filter((d) => d.id !== docId);
  const linkedSet = new Set(doc?.links ?? []);
  return (
    <div>
      {err && <div className="errBox" role="alert">{err}</div>}
      {!doc ? <p className="muted small">{t('loading')}</p> : (
        <>
          {(doc.links.length === 0) && <p className="muted small">{t('noLinks')}</p>}
          {doc.links.map((id) => {
            const l = docs.find((x) => x.id === id);
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
                <strong>{l ? l.title : id}</strong>
                {l && <span className="muted small num">{l.number}</span>}
                {l && <Button size="sm" onClick={() => onOpenLinked(l)}>{t('openLinked')}</Button>}
                {ask === id
                  ? <><Button size="sm" variant="danger" onClick={async () => { await mockApi.removeLink(docId, id); setAsk(null); await reload(); await onChanged(); toast('success', t('linkRemoved')); }}>{t('confirmRemove')}</Button>
                    <Button size="sm" onClick={() => setAsk(null)}>{t('cancel')}</Button></>
                  : <Button size="sm" variant="danger" onClick={() => setAsk(id)}>{t('removeLink')}</Button>}
              </div>
            );
          })}
          {doc.links.some((id) => id !== docId && !docs.some((d) => d.id === id)) && (
            <p className="muted small">{t('linkOutOfScope')}</p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <Select aria-label={t('addLink')} value={target} onChange={(e) => { setTarget(e.target.value); setErr(null); }} style={{ flex: 1, minWidth: 200 }}>
              <option value="">— {t('addLink')} —</option>
              {options.map((o) => (
                <option key={o.id} value={o.id} disabled={linkedSet.has(o.id)}>
                  {o.number} — {o.title}{linkedSet.has(o.id) ? ` (${t('alreadyLinked')})` : ''}
                </option>
              ))}
            </Select>
            <Button variant="primary" disabled={!target} onClick={async () => {
              const r = await mockApi.addLink(docId, target);
              if (!r.ok) { setErr(errText(t, r)); return; }
              setTarget(''); await reload(); await onChanged(); toast('success', t('linkAdded'));
            }}>{t('addLink')}</Button>
          </div>
        </>
      )}
    </div>
  );
};
/** CSV import wizard (demo): local file → mapping review → row review →
    summary → explicit confirm. Browser-only FileReader; nothing is uploaded
    anywhere and nothing is written to disk. Duplicate detection is a
    PROTOTYPE rule on documentNumber (not claimed as a backend constraint). */
interface ImpRow { cells: Record<string, string>; status: 'ok' | 'error' | 'dup'; reason: string; }
export const ImportWizard = ({ onDone, onCancel, actorId }: { onDone: (added: number, skipped: number) => void; onCancel: () => void; actorId?: string }) => {
  const { t } = useLang();
  const [step, setStep] = useState(0);
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [headers, setHeaders] = useState<string[]>([]);
  const [map, setMap] = useState<Record<number, string | null>>({});
  const [raw, setRaw] = useState<string[][]>([]);
  const [dupSet, setDupSet] = useState<Set<string>>(new Set());
  const [include, setInclude] = useState<Record<number, boolean>>({});
  const [err, setErr] = useState<string | null>(null);
  // Duplicate detection must see exactly the documents this identity may see:
  // without the actor the fail-closed reader would narrow the set to
  // project-less documents and real duplicates would slip through.
  useEffect(() => { mockApi.documents({}, actorId).then((d) => setExisting(new Set(d.map((x) => x.number)))); }, [actorId]);

  const evaluate = (body: string[][], m: Record<number, string | null>, dupSet: Set<string>) => {
    const seen = new Set<string>();
    return body.map((cells) => {
      const obj: Record<string, string> = {};
      cells.forEach((v, i) => { const f = m[i]; if (f) obj[f] = (v ?? '').trim(); });
      const title = obj.title ?? '';
      const number = obj.number ?? '';
      const status = obj.status ?? '';
      if (!title) return { cells: obj, status: 'error' as const, reason: t('errTitleRequired') };
      if (status && !STATUSES.includes(status as Doc['status']))
        return { cells: obj, status: 'error' as const, reason: t('errUnknownStatus', { v: status }) };
      if (number && (dupSet.has(number) || seen.has(number)))
        return { cells: obj, status: 'dup' as const, reason: t('dupNumber') };
      if (number) seen.add(number);
      return { cells: obj, status: 'ok' as const, reason: '' };
    });
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    setErr(null);
    if (!/\.csv$/i.test(f.name)) { setErr(t('importMustCsv')); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = parseCsv(String(reader.result ?? ''));
        if (parsed.length < 2) { setErr(t('importEmptyFile')); return; }
        const h = parsed[0];
        const body = parsed.slice(1, 201);
        const m: Record<number, string | null> = {};
        h.forEach((col, i) => { m[i] = mapHeader(col); });
        // Duplicate check needs the live catalog: refetch here instead of
        // trusting mount-time state (FileReader wins that race otherwise).
        // The refetch carries the same actor: without it the fail-closed
        // reader would narrow the set to project-less documents and real
        // duplicates would slip through for scoped identities.
        const fresh = await mockApi.documents({}, actorId);
        const dupSet = new Set([...existing, ...fresh.map((d) => d.number)]);
        setHeaders(h);
        setMap(m);
        setRaw(body);
        setDupSet(dupSet);
        setStep(1);
      } catch {
        setErr(t('importUnreadable'));
      }
    };
    reader.onerror = () => setErr(t('importUnreadable'));
    reader.readAsText(f, 'UTF-8');
  };

  // Rows are DERIVED from the raw grid + the current mapping, so editing the
// mapping immediately re-validates every row (no silent no-op control).
  const rows = useMemo(() => evaluate(raw, map, dupSet), [raw, map, dupSet]);

  const remap = (idx: number, v: string | null) => {
    setMap((m) => ({ ...m, [idx]: v }));
    // Re-inclusion choices are per (row, mapping); reset them so a re-mapped
    // file is never imported with stale opt-ins.
    setInclude({});
  };

  const included = rows.filter((r, i) => r.status === 'ok' || (r.status === 'dup' && !!include[i]));
  const skipped = rows.length - included.length;

  return (
    <div>
      <div className="tabs" role="tablist" aria-label="import steps">
        {[t('stepFile'), t('stepMapping'), t('stepRows'), t('stepSummary')].map((label, i) => (
          <button key={label} role="tab" aria-selected={step === i} className="tabBtn" onClick={() => { if (headers.length > 0) setStep(i); }}>{i + 1}. {label}</button>
        ))}
      </div>
      {err && <div className="errBox" role="alert">{err}</div>}

      {step === 0 && (
        <div>
          <Field label={t('pickCsv')}>
            <input type="file" accept=".csv" className="input" aria-label={t('pickCsv')} onChange={(e) => onFile(e.target.files?.[0])} />
          </Field>
          <p className="muted small">{t('importBrowserOnly')}</p>
        </div>
      )}

      {step === 1 && (
        <div>
          {headers.length === 0 ? <p className="muted small">{t('pickCsv')}</p> : (
            <div className="tableWrap"><table className="table" aria-label={t('mapLabel')}>
              <thead><tr><th>{t('columnLabel')}</th><th>{t('fieldLabel')}</th></tr></thead>
              <tbody>{headers.map((h, i) => (
                <tr key={i}>
                  <td><strong>{h}</strong></td>
                  <td>
                    <Select aria-label={`mapping ${h}`} value={map[i] ?? ''} onChange={(e) => remap(i, e.target.value || null)}>
                      <option value="">{t('colIgnored')}</option>
                      {['title', 'number', 'category', 'type', 'status'].map((f) => <option key={f} value={f}>{f}</option>)}
                    </Select>
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
          {headers.length > 0 && (
            <p className="muted small" role="note">{t('mapAutoNote')}</p>
          )}
          <div className="formActions">
            <Button variant="primary" disabled={headers.length === 0} onClick={() => setStep(2)}>{t('stepRows')}</Button>
            <Button onClick={onCancel}>{t('cancelImport')}</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
              <strong>{r.cells.title || `${i + 1}`}</strong>
              <span className="muted small num">{r.cells.number || '—'}</span>
              {r.status === 'ok' && <Badge tone="green">{t('rowOk')}</Badge>}
              {r.status === 'error' && <Badge tone="red">{t('rowError')}: {r.reason}</Badge>}
              {r.status === 'dup' && <Badge tone="amber">{t('rowWarning')}: {r.reason}</Badge>}
              {r.status === 'dup' && (
                <label className="muted small" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                  <input type="checkbox" checked={!!include[i]} onChange={() => setInclude((s) => ({ ...s, [i]: !s[i] }))} aria-label={`${t('includeRow')} ${i + 1}`} />
                  {t('includeRow')}
                </label>
              )}
            </div>
          ))}
          {rows.length === 0 && <p className="muted small">{t('empty')}</p>}
          <div className="formActions">
            <Button variant="primary" onClick={() => setStep(3)}>{t('stepSummary')}</Button>
            <Button onClick={onCancel}>{t('cancelImport')}</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <p>{t('summaryLine', { a: included.length, b: skipped })}</p>
          <p className="muted small">{t('noTxNote')}</p>
          <div className="formActions">
            <Button
              variant="primary"
              disabled={included.length === 0}
              onClick={async () => {
                await mockApi.addDocs(included.map((r) => ({
                  title: r.cells.title, number: r.cells.number || '',
                  category: r.cells.category || t('otherCat'), type: r.cells.type || 'PDF',
                  status: (r.cells.status as Doc['status']) || 'draft',
                })));
                onDone(included.length, skipped);
              }}
            >{t('confirmImport')}</Button>
            <Button onClick={onCancel}>{t('cancelImport')}</Button>
          </div>
        </div>
      )}
    </div>
  );
};
