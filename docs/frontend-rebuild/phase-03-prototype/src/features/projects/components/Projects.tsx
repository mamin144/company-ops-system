import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth';
import { useLang } from '@/i18n';
import { mrApi } from '@/services/api';
import { STATUS_TONE } from '@/services/api/adapters/mock/data';
import type { Project } from '@/services/api/adapters/mock/data';
import { Badge, Button, ConfirmDialog, EmptyState, Field, Modal, Pager, RecCell, RecHead, RecRow, RecShell, SearchInput, Select, SortHeader, TextInput, statusLabel, useToast } from '@/shared/ui';

const T = '2.2fr 1fr 1fr auto';
const PAGE_SIZE = 5;

const STATUSES = ['planned', 'active', 'on-hold', 'completed', 'cancelled'] as const;
const ROLES = ['main-contractor', 'subcontractor', 'direct-contractor'] as const;
const ROLE_KEYS = { 'main-contractor': 'projRoleMain', 'subcontractor': 'projRoleSub', 'direct-contractor': 'projRoleDirect' } as const;

/** Text form of every audited `projectSchema` field, exactly as the user
    types it. Empty string means "absent" — the payload builder collapses it
    to the contract's optional/undefined semantics, never to a fake 0. */
type FormState = Record<'code' | 'name' | 'client' | 'owner' | 'mainContractor' | 'siteLocation' | 'region' | 'contractNo' | 'contractValue' | 'startDate' | 'endDate' | 'notes', string>
  & { status: Project['status']; role: string };

const blankForm: FormState = {
  code: '', name: '', client: '', owner: '', mainContractor: '', siteLocation: '',
  region: '', contractNo: '', contractValue: '', startDate: '', endDate: '',
  status: 'planned', role: '', notes: '',
};

/** Local shorthand for the strongly-typed `t` so helpers stay key-safe. */
type TFn = ReturnType<typeof useLang>['t'];

/** zod-equivalent client-side transcription of `projectSchema` rules:
    required code/name, required status enum, contractValue ≥ 0 when present.
    Every error renders beside its own field. */
const validateForm = (f: FormState, t: TFn) => {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!f.code.trim()) errors.code = t('projCodeRequired');
  if (!f.name.trim()) errors.name = t('projNameRequired');
  const cv = f.contractValue.trim();
  if (cv !== '' && (Number.isNaN(Number(cv)) || Number(cv) < 0)) errors.contractValue = t('contractValueRule');
  return errors;
};

/** Verified JSON the mock (and, on parity, POST/PUT /projects) accepts —
    empty text collapses to the audited default('') / optional semantics;
    empty contractValue means "key absent", never 0. */
const toPayload = (f: FormState) => ({
  code: f.code.trim(),
  name: f.name.trim(),
  client: f.client.trim(),
  owner: f.owner.trim(),
  mainContractor: f.mainContractor.trim(),
  siteLocation: f.siteLocation.trim(),
  region: f.region.trim(),
  contractNo: f.contractNo.trim(),
  ...(f.contractValue.trim() === '' ? {} : { contractValue: Number(f.contractValue.trim()) }),
  startDate: f.startDate || undefined,
  endDate: f.endDate || undefined,
  status: f.status,
  role: (f.role || undefined) as Project['role'],
  notes: f.notes.trim(),
});

/** Edit patch nuance (mirrors projects.validators.ts' own comment): on update
    an absent/undefined column "is left untouched (stable round-trip)" —
    so clearing a populated contract value is NOT supported by the audited
    contract and the form surfaces that instead of silently dropping data. */
const toPatch = (f: FormState, current: Project | null) => {
  const base = toPayload(f);
  const patch: Partial<Omit<Project, 'id'>> = { ...base };
  if (current?.contractValue !== undefined && base.contractValue === undefined) {
    // blocked upstream by validateForm's cvClearUnsupported check
    delete patch.contractValue;
  }
  return patch;
};

export const Projects = () => {
  const { can, user } = useAuth();
  const { t } = useLang();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState<'code' | 'name' | 'client' | 'status'>('code');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  // Scoped by project membership through the same rule the rest of the app
  // uses — a project the identity cannot read must not appear here at all.
  const [rows, setRows] = useState(() => mrApi.projects(user?.id));
  // Phase 6: a genuine double-tap on save fires the handler twice inside one
  // React batch — before any re-render — so a render-time guard or disabled
  // flag cannot stop the second create. The ref is read synchronously and is
  // the only primitive that flips before the batch ends.
  const createBusy = useRef(false);
  const editBusy = useRef(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ ...blankForm });
  const [del, setDel] = useState<string | null>(null);
  const [editing, setEditing] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState<FormState>({ ...blankForm });
  const openEdit = (p: Project) => {
    setEditing(p);
    setEditForm({
      code: p.code, name: p.name, client: p.client, owner: p.owner,
      mainContractor: p.mainContractor ?? '', siteLocation: p.siteLocation ?? '',
      region: p.region, contractNo: p.contractNo,
      contractValue: p.contractValue === undefined ? '' : String(p.contractValue),
      startDate: p.startDate ?? '', endDate: p.endDate ?? '',
      status: p.status, role: p.role ?? '', notes: p.notes ?? '',
    });
  };
  const setF = (f: 'new' | 'edit') => (k: keyof FormState) => (v: string) => {
    const setter = f === 'new' ? setForm : setEditForm;
    setter((prev) => ({ ...prev, [k]: v }));
  };
  const formErrors = validateForm(form, t);
  const editErrors = validateForm(editForm, t);
  // Audited PUT contract cannot clear a populated contractValue (absent key =
  // column untouched), so an emptied field against a populated project is a
  // stated validation error — never a silent no-op save.
  const editCvCleared = editing?.contractValue !== undefined && editForm.contractValue.trim() === '';
  if (editCvCleared) editErrors.contractValue = t('cvClearUnsupported');

  const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  const filtered = useMemo(() => {
    const list = rows.filter((p) =>
      (!q || (p.code + p.name + p.client).includes(q)) && (!status || p.status === status));
    const sign = dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'name': return sign * cmp(a.name, b.name);
        case 'client': return sign * (cmp(a.client, b.client) || cmp(a.code, b.code));
        case 'status': return sign * (cmp(statusLabel(t, a.status), statusLabel(t, b.status)) || cmp(a.code, b.code));
        default: return sign * cmp(a.code, b.code);
      }
    });
  }, [rows, q, status, sortBy, dir, t]);
  const onSort = (k: string) => {
    if (sortBy === k) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(k as typeof sortBy); setDir('asc'); }
    setPage(0);
  };
  // Membership-empty (viewer-style) vs genuinely-empty vs filtered-empty are
  // three different truths — the empty state must say which one it is without
  // revealing anything about projects outside the membership.
  const scopedEmpty = mrApi.projects(user?.id).length === 0;
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      <div className="cmdHead">
        <div><div className="eyebrow"><Badge tone="blue">{rows.length} {t('projects')}</Badge></div><h1>{t('projects')}</h1></div>
        <div>{can('projects.create') && <Button variant="primary" onClick={() => { createBusy.current = false; setForm({ ...blankForm }); setOpen(true); }}>+ {t('projects')}</Button>}</div>
      </div>
      <div className="toolbar" role="search">
        <span className="grow"><SearchInput label={t('search')} value={q} onChange={(v) => { setQ(v); setPage(0); }} placeholder={t('searchPh')} /></span>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} aria-label={t('statusLabel')}>
          <option value="">{t('allStatuses')}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(t, s)}</option>)}
        </Select>
        {(q || status) && <Button onClick={() => { setQ(''); setStatus(''); setPage(0); }}>{t('clearFilters')}</Button>}
      </div>
      {pageRows.length === 0 ? (
        <div className="panel"><EmptyState icon="projects"
          title={scopedEmpty ? t('noProjectsScoped') : q || status ? t('noResults') : t('empty')}
          hint={scopedEmpty ? t('noProjectsScopedHint') : t('mockNote')}
          action={scopedEmpty ? <Link className="linkBtn" to="/">{t('arrowBack')} {t('backHome')}</Link> : undefined}
        /></div>
      ) : (
        <div className="panel">
          <RecShell label={t('projects')} template={T}>
            <RecHead template={T}>
              <RecCell head><SortHeader label={t('projCodeName')} k="code" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
              <RecCell head><SortHeader label={t('projClient')} k="client" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
              <RecCell head><SortHeader label={t('projStatus')} k="status" sortBy={sortBy} dir={dir} onSort={onSort} /></RecCell>
              <RecCell head>{t('actions')}</RecCell>
            </RecHead>
            {pageRows.map((p) => (
              <RecRow key={p.id} template={T}>
                <RecCell k={t('projCodeName')}><Link to={`/projects/${p.id}`} className="num ltr"><strong>{p.code}</strong></Link><br />{p.name}</RecCell>
                <RecCell k={t('projClient')}>{p.client}</RecCell>
                <RecCell k={t('projStatus')}><Badge tone={STATUS_TONE[p.status]}>{statusLabel(t, p.status)}</Badge></RecCell>
                <RecCell><span className="recActions">
                  <Link className="linkBtn" to={`/projects/${p.id}`}>{t('details')}</Link>
                  {can('projects.edit') && <Button size="sm" onClick={() => openEdit(p)}>{t('edit')}</Button>}
                  {can('projects.delete') && <Button size="sm" variant="danger" onClick={() => setDel(p.id)}>{t('deleteLabel')}</Button>}
                </span></RecCell>
              </RecRow>
            ))}
          </RecShell>
          <Pager page={safePage} pages={pages} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} label={t('projects')} />
        </div>
      )}
      <Modal title={t('projCreate')} open={open} onClose={() => setOpen(false)}>
        <ProjectFields form={form} setField={setF('new')} t={t} />
        <div className="formActions">
          <Button variant="primary" disabled={Object.keys(formErrors).length > 0} onClick={() => {
            if (createBusy.current) return;
            createBusy.current = true;
            const saved = mrApi.createProject(toPayload(form), user?.id);
            if (!saved.ok) { createBusy.current = false; toast('error', saved.error); return; }
            setRows(mrApi.projects(user?.id));
            setOpen(false); setPage(0); toast('success', t('mockNote'));
          }}>{t('save')}</Button>
          <Button onClick={() => setOpen(false)}>{t('cancel')}</Button>
        </div>
      </Modal>
      <Modal title={t('editProject')} open={!!editing} onClose={() => setEditing(null)}>
        <ProjectFields form={editForm} setField={setF('edit')} t={t} cvCleared={editCvCleared} />
        <div className="formActions">
          <Button variant="primary" disabled={Object.keys(editErrors).length > 0} onClick={() => {
            if (!editing || editBusy.current) return;
            editBusy.current = true;
            const saved = mrApi.updateProject(editing.id, toPatch(editForm, editing), user?.id);
            if (!saved.ok) { editBusy.current = false; toast('error', saved.error); return; }
            setRows(mrApi.projects(user?.id));
            setEditing(null); setPage(0); toast('success', t('mockNote'));
          }}>{t('save')}</Button>
          <Button onClick={() => setEditing(null)}>{t('cancel')}</Button>
        </div>
      </Modal>
      <ConfirmDialog
        open={!!del}
        text={t('confirmDeleteMock')}
        onConfirm={() => { setRows((r) => r.filter((x) => x.id !== del)); setDel(null); toast('success', t('mockNote')); }}
        onCancel={() => setDel(null)}
      />
    </div>
  );
};

/** The audited 14-field body of the project create/edit form. Labels sit above
    inputs; each contract rule renders its error beside its own field. */
const ProjectFields = ({ form, setField, t, cvCleared }: { form: FormState; setField: (k: keyof FormState) => (v: string) => void; t: TFn; cvCleared?: boolean }) => {
  const errors = validateForm(form, t);
  // the audited PUT contract cannot clear a populated contractValue — surface
  // the stated error beside the field when the edit context emptied it
  if (cvCleared) errors.contractValue = t('cvClearUnsupported');
  return (
    <div>
      <div className="form2">
        <Field label={t('projCodeLabel')} error={errors.code}>
          <TextInput aria-label={t('projCodeLabel')} value={form.code} onChange={(e) => setField('code')(e.target.value)} />
        </Field>
        <Field label={t('projNameLabel')} error={errors.name}>
          <TextInput aria-label={t('projNameLabel')} value={form.name} onChange={(e) => setField('name')(e.target.value)} />
        </Field>
        <Field label={t('projClient')}>
          <TextInput aria-label={t('projClient')} value={form.client} onChange={(e) => setField('client')(e.target.value)} />
        </Field>
        <Field label={t('projOwnerLabel')}>
          <TextInput aria-label={t('projOwnerLabel')} value={form.owner} onChange={(e) => setField('owner')(e.target.value)} />
        </Field>
        <Field label={t('projMainContractor')}>
          <TextInput aria-label={t('projMainContractor')} value={form.mainContractor} onChange={(e) => setField('mainContractor')(e.target.value)} />
        </Field>
        <Field label={t('projSiteLocation')}>
          <TextInput aria-label={t('projSiteLocation')} value={form.siteLocation} onChange={(e) => setField('siteLocation')(e.target.value)} />
        </Field>
        <Field label={t('projRegion')}>
          <TextInput aria-label={t('projRegion')} value={form.region} onChange={(e) => setField('region')(e.target.value)} />
        </Field>
        <Field label={t('projContractNumber')}>
          <TextInput aria-label={t('projContractNumber')} value={form.contractNo} onChange={(e) => setField('contractNo')(e.target.value)} />
        </Field>
        <Field label={t('contractValue')} error={errors.contractValue}>
          {/* Phase 10 (owner mandate §4.A): no input-mask arithmetic — the raw
              typed/pasted value passes through unmodified so the contract
              validator can REFUSE a negative beside the field with save
              disabled. The previous `replace(/[^\d.]/g, '')` mask silently
              stripped the minus and turned '-5' into '5', corrupting the
              entry. Same query anatomy as the approved IPC gross field
              (ProjectWorkspace.tsx): raw pass-through, validator refuses. */}
          <TextInput aria-label={t('contractValue')} type="number" min={0} step="any" value={form.contractValue} onChange={(e) => setField('contractValue')(e.target.value)} />
        </Field>
        <Field label={t('projStart')}>
          <TextInput aria-label={t('projStart')} type="date" value={form.startDate} onChange={(e) => setField('startDate')(e.target.value)} />
        </Field>
        <Field label={t('projEnd')}>
          <TextInput aria-label={t('projEnd')} type="date" value={form.endDate} onChange={(e) => setField('endDate')(e.target.value)} />
        </Field>
        <Field label={t('projStatus')}>
          <Select aria-label={t('projStatus')} value={form.status} onChange={(e) => setField('status')(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(t, s)}</option>)}
          </Select>
        </Field>
        <Field label={t('projRole')}>
          <Select aria-label={t('projRole')} value={form.role} onChange={(e) => setField('role')(e.target.value)}>
            <option value="">{t('projRoleNone')}</option>
            {ROLES.map((r) => <option key={r} value={r}>{t(ROLE_KEYS[r])}</option>)}
          </Select>
        </Field>
      </div>
      <Field label={t('notes')}>
        <TextInput aria-label={t('notes')} value={form.notes} onChange={(e) => setField('notes')(e.target.value)} />
      </Field>
    </div>
  );
};
