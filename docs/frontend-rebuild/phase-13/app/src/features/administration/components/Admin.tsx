import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/app/providers/auth';
import { useLang } from '@/i18n';
import type { TKey } from '@/i18n';
import { EMAIL_RE, userApi } from '@/services/api';
import { MANAGED_GROUPS, ROLE_AR5, ROLE_BASE, projects } from '@/services/api/adapters/mock/data';
import type { AccessLevel, MockUser, OverrideEffect } from '@/services/api/adapters/mock/data';
import { Badge, Button, ConfirmDialog, EmptyState, Field, Menu, errText, Modal, RecCell, RecHead, RecRow, RecShell, SearchInput, Select, Tabs, TextInput, statusLabel, useToast } from '@/shared/ui';

const ROLES = Object.keys(ROLE_AR5) as MockUser['role'][];
/** Access level and role names are UI copy — the raw values stay in the data. */
const ACCESS_KEY: Record<AccessLevel, TKey> = { NONE: 'accessNone', READ: 'accessRead', WRITE: 'accessWrite', DELETE: 'accessDelete' };
const ROLE_KEY: Record<MockUser['role'], TKey> = {
  admin: 'roleSysAdmin', management: 'roleMgmt', warehouse: 'roleWh', technical: 'roleTech', viewer: 'roleViewerShort',
};
const ROLE_DESC: Record<MockUser['role'], TKey> = {
  admin: 'roleDescAdmin', management: 'roleDescManager', warehouse: 'roleDescWarehouse',
  technical: 'roleDescTechnical', viewer: 'roleDescViewer',
};
const OV_LABEL: Record<'INHERIT' | OverrideEffect, TKey> = {
  INHERIT: 'ovInherit', GRANT: 'ovGrant', DENY: 'ovDeny',
};
const T = '1.8fr 1.4fr 1fr 1fr 1.2fr auto';

const accessSummary = (u: MockUser, t: (k: TKey, v?: Record<string, string | number>) => string): string => {
  const entries = Object.entries(u.access).filter(([, v]) => v !== 'NONE');
  if (!entries.length) return t('noProjects');
  const rank: AccessLevel[] = ['DELETE', 'WRITE', 'READ'];
  const top = rank.find((r) => entries.some(([, v]) => v === r)) ?? 'READ';
  return t('projectsCountDot', { n: entries.length, lbl: t(ACCESS_KEY[top]) });
};
/** Per-project breakdown for the summary cell's tooltip — same data, no new source. */
const accessTitle = (u: MockUser, t: (k: TKey, v?: Record<string, string | number>) => string): string =>
  Object.entries(u.access)
    .filter((e): e is [string, AccessLevel] => e[1] !== undefined && e[1] !== 'NONE')
    .map(([pid, v]) => {
      const p = projects.find((x) => x.id === pid);
      return `${p ? `${p.code} ${p.name}` : pid}: ${t(ACCESS_KEY[v])}`;
    })
    .join('\n') || t('noProjects');

const emptyForm = { name: '', email: '', dept: '', title: '', role: 'viewer' as MockUser['role'], active: true };

/** Read-only role inspection (Phase 3.12, P1-06/B-03): answers "what can this
    role do?" from the existing ROLE_BASE, grouped by the audited functional
    areas, with raw keys kept as muted secondary diagnostics. An optional user
    picker shows that user's live effective result per permission (inherited /
    override / effective), reusing userApi.effective — nothing is mutated here. */
const RoleInspectBody = ({ role, userId, onUser }: { role: MockUser['role']; userId: string; onUser: (id: string) => void }) => {
  const { t } = useLang();
  const users = userApi.list();
  const effUser = users.find((u) => u.id === userId) ?? users.find((u) => u.role === role) ?? users[0];
  const eff = effUser ? userApi.effective(effUser.id) : null;
  const srcText = { role: t('permFromRole'), grant: t('permGrant'), deny: t('permDeny'), none: t('permNone') } as const;
  return (
    <div>
      <p className="muted small">{t(ROLE_DESC[role])}</p>
      <h3>{t('roleBasePerms')}</h3>
      {MANAGED_GROUPS.map((g) => {
        const granted = g.keys.filter((k) => ROLE_BASE[role].includes(k));
        if (!granted.length) return null;
        return (
          <section key={g.group} style={{ marginBottom: 10 }}>
            <h4 className="muted small">{g.group}</h4>
            <ul style={{ margin: '4px 0', paddingInlineStart: 18 }}>
              {granted.map((k) => (
                <li key={k}><Badge tone="green">{t('activeSt')}</Badge> <code className="num small" dir="ltr" title={t('permKeyNote')}>{k}</code></li>
              ))}
            </ul>
          </section>
        );
      })}
      <h3>{t('effectiveResult')}</h3>
      <p className="muted small">{t('denyBeatsGrant')}</p>
      {effUser && (
        <Field label={t('users')}>
          <Select aria-label={t('users')} value={effUser.id} onChange={(e) => onUser(e.target.value)}>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name} — {t(ROLE_KEY[u.role])}</option>)}
          </Select>
        </Field>
      )}
      {eff && effUser && MANAGED_GROUPS.map((g) => (
        <section key={g.group} style={{ marginBottom: 10 }}>
          <h4 className="muted small">{g.group}</h4>
          <ul style={{ margin: '4px 0', paddingInlineStart: 18 }}>
            {g.keys.map((k) => (
              <li key={k}>
                <Badge tone={eff.allowed[k] ? 'green' : 'gray'}>{eff.allowed[k] ? t('activeSt') : t('inactiveSt')}</Badge>{' '}
                <span className="muted small">({srcText[eff.source[k]]})</span>{' '}
                <code className="num small" dir="ltr" title={t('permKeyNote')}>{k}</code>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

export const Admin = () => {
  const { can, user, refresh } = useAuth();
  const { t, lang } = useLang();
  const toast = useToast();
  const [tab, setTab] = useState('users');
  const [rows, setRows] = useState<MockUser[]>(() => userApi.list());
  const [q, setQ] = useState('');
  const [roleF, setRoleF] = useState('');
  const [statusF, setStatusF] = useState('');
  const [sort, setSort] = useState<'name' | 'email' | 'role'>('name');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MockUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [manage, setManage] = useState<MockUser | null>(null);
  const [ov, setOv] = useState<MockUser['overrides']>({});
  const [acc, setAcc] = useState<MockUser['access']>({});
  const [manageErr, setManageErr] = useState<string | null>(null);
  const [toggleTarget, setToggleTarget] = useState<MockUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MockUser | null>(null);
  const [resetTarget, setResetTarget] = useState<MockUser | null>(null);
  const [inspectRole, setInspectRole] = useState<MockUser['role'] | null>(null);
  const [inspectUser, setInspectUser] = useState('');

  const reload = () => { setRows(userApi.list()); refresh(); };
  useEffect(() => { reload(); }, []); // eslint-disable-line

  const filtered = useMemo(() => {
    const list = rows.filter((u) =>
      (!q || (u.name + u.email + u.dept + u.title).toLowerCase().includes(q.toLowerCase())) &&
      (!roleF || u.role === roleF) &&
      (!statusF || (statusF === 'active') === u.active));
    const by = {
      name: (a: MockUser, b: MockUser) => a.name.localeCompare(b.name, 'ar'),
      email: (a: MockUser, b: MockUser) => a.email.localeCompare(b.email),
      role: (a: MockUser, b: MockUser) => a.role.localeCompare(b.role),
    }[sort];
    return [...list].sort(by);
  }, [rows, q, roleF, statusF, sort]);

  if (!can('users.manage'))
    return <div className="denyBox"><strong>{t('deniedTitle')}</strong><p className="muted small">{t('deniedBody')}</p></div>;

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormErr(null); setFormOpen(true); };
  const openEdit = (u: MockUser) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, dept: u.dept, title: u.title, role: u.role, active: u.active });
    setFormErr(null);
    setFormOpen(true);
  };
  const saveForm = () => {
    if (!form.name.trim()) { setFormErr(t('requiredName', { field: t('nameField') })); return; }
    if (!EMAIL_RE.test(form.email.trim())) { setFormErr(t('invalidEmail')); return; }
    const res = editing
      ? userApi.update(editing.id, user?.id ?? '', { name: form.name, email: form.email, dept: form.dept, title: form.title, role: form.role, active: form.active })
      : userApi.create(form);
    if (!res.ok) { setFormErr(errText(t, res)); return; }
    setFormOpen(false);
    reload();
    toast('success', editing ? t('updatedMock') : t('createdMock'));
  };
  const openManage = (u: MockUser) => {
    const fresh = userApi.get(u.id);
    if (!fresh) return;
    setManage(fresh);
    setOv({ ...fresh.overrides });
    setAcc({ ...fresh.access });
    setManageErr(null);
  };
  const saveManage = () => {
    if (!manage || !user) return;
    const r1 = userApi.setOverrides(manage.id, user.id, ov);
    if (!r1.ok) { setManageErr(errText(t, r1)); return; }
    userApi.setAccess(manage.id, acc);
    setManage(null);
    reload();
    toast('success', t('savedMock'));
  };

  return (
    <div>
      <div className="cmdHead"><div>
        <div className="eyebrow"><Badge tone="blue">{t('usersCountMock', { n: filtered.length, users: t('users') })}</Badge></div>
        <h1>{t('admin')}</h1><p className="muted small">{t('mockFieldsNote')}</p>
      </div></div>
      <Tabs label={t('admin')} tabs={[{ key: 'users', label: t('users') }, { key: 'roles', label: t('rolesTab') }]} active={tab} onChange={setTab} />

      {tab === 'users' && (
        <>
          <div className="toolbar" role="search">
            <span className="grow"><SearchInput label={t('searchUsers')} value={q} onChange={setQ} placeholder={t('searchUsers')} /></span>
            <Select value={roleF} onChange={(e) => setRoleF(e.target.value)} aria-label={t('roleLabel')}>
              <option value="">{t('allRoles')}</option>
              {ROLES.map((r) => <option key={r} value={r}>{t(ROLE_KEY[r])}</option>)}
            </Select>
            <Select value={statusF} onChange={(e) => setStatusF(e.target.value)} aria-label={t('status')}>
              <option value="">{t('allStatuses')}</option>
              <option value="active">{t('activeSt')}</option>
              <option value="inactive">{t('inactiveSt')}</option>
            </Select>
            <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label={t('sortBy')}>
              <option value="name">{t('sortName')}</option>
              <option value="email">{t('sortEmail')}</option>
              <option value="role">{t('sortRole')}</option>
            </Select>
            {(q || roleF || statusF) && <Button onClick={() => { setQ(''); setRoleF(''); setStatusF(''); }}>{t('clearFilters')}</Button>}
            <Button variant="primary" onClick={openCreate}>+ {t('newUser')}</Button>
          </div>

          {filtered.length === 0 ? <div className="panel"><EmptyState icon="admin" title={t('empty')} /></div> : (
            <div className="panel"><RecShell label={t('users')} template={T}>
              <RecHead template={T}>
                <RecCell head>{t('nameEmail')}</RecCell><RecCell head>{t('deptTitle')}</RecCell><RecCell head>{t('roleLabel')}</RecCell><RecCell head>{t('statusLabel')}</RecCell><RecCell head>{t('projectsLabel')}</RecCell><RecCell head>{t('actions')}</RecCell>
              </RecHead>
              {filtered.map((u) => (
                <RecRow key={u.id} template={T}>
                  <RecCell k={t('nameEmail')}><strong>{u.name}</strong> {u.id === user?.id && <Badge tone="blue">{t('youBadge')}</Badge>}<br /><span className="muted small num ltr email" title={u.email}>{u.email}</span></RecCell>
                  <RecCell k={t('deptTitle')}>{u.dept || '—'}<br /><span className="muted small">{u.title || '—'}</span></RecCell>
                  <RecCell k={t('roleLabel')}><Badge tone={u.role === 'admin' ? 'red' : 'gray'}>{t(ROLE_KEY[u.role])}</Badge></RecCell>
                  <RecCell k={t('statusLabel')}><Badge tone={u.active ? 'green' : 'gray'}>{u.active ? t('activeSt') : t('inactiveSt')}</Badge></RecCell>
                  <RecCell k={t('projectsLabel')}><span className="muted small" title={accessTitle(u, t)}>{accessSummary(u, t)}</span></RecCell>
                  <RecCell><span className="recActions">
                    <Button size="sm" onClick={() => openManage(u)}>{t('details')}</Button>
                    <Button size="sm" onClick={() => openEdit(u)}>{t('editUser')}</Button>
                    <Menu label={t('moreMenu')} items={(() => {
                      const isSelf = u.id === user?.id;
                      // The mock permits self-disable ONLY while another active
                      // administrator remains (last-admin guard); the UI mirrors
                      // that rule instead of being stricter than the model.
                      // Self-delete is refused by the mock unconditionally.
                      const backupAdmin = userApi.list().some((x) => x.id !== user?.id && x.active && userApi.effective(x.id).allowed['users.manage']);
                      const selfDisableBlocked = isSelf && !backupAdmin;
                      return [
                        {
                          label: u.active ? t('disableUser') : t('enableUser'),
                          disabled: selfDisableBlocked,
                          hint: selfDisableBlocked ? t('selfActionDisabled') : undefined,
                          onSelect: () => setToggleTarget(u),
                        },
                        { label: t('resetPassword'), onSelect: () => setResetTarget(u) },
                        {
                          label: t('deleteUser'), danger: true,
                          disabled: isSelf,
                          hint: isSelf ? t('selfActionDisabled') : undefined,
                          onSelect: () => setDeleteTarget(u),
                        },
                      ];
                    })()} />
                    {u.id === user?.id && !userApi.list().some((x) => x.id !== user?.id && x.active && userApi.effective(x.id).allowed['users.manage']) && (
                      <span className="muted small">{t('selfActionDisabled')}</span>
                    )}
                  </span></RecCell>
                </RecRow>
              ))}
            </RecShell></div>
          )}
        </>
      )}

      {tab === 'roles' && (
        <div className="cards">{ROLES.map((r) => (
          <button type="button" className="card" key={r} style={{ textAlign: 'start', cursor: 'pointer', font: 'inherit', color: 'inherit' }} onClick={() => {
            setInspectRole(r);
            setInspectUser((cur) => cur || userApi.list().find((u) => u.role === r)?.id || userApi.list()[0]?.id || '');
          }} aria-label={`${t('roleInspect')}: ${t(ROLE_KEY[r])}`}>
            <span className="l">{t(ROLE_KEY[r])}</span><br />
            <span className="f">{t('roleUserCount', { n: userApi.list().filter((u) => u.role === r).length })}</span>
          </button>
        ))}</div>
      )}

      <Modal title={inspectRole ? `${t('roleInspect')}: ${t(ROLE_KEY[inspectRole])}` : ''} open={!!inspectRole} onClose={() => setInspectRole(null)} wide>
        {inspectRole && (
          <RoleInspectBody
            role={inspectRole} userId={inspectUser} onUser={setInspectUser}
          />
        )}
      </Modal>

      <Modal title={editing ? t('editUser') : t('newUser')} open={formOpen} onClose={() => setFormOpen(false)} wide>
        {formErr && <div className="errBox" role="alert">{formErr}</div>}
        <div className="formGrid">
          <Field label={t('nameRequired')} error={!form.name.trim() ? t('requiredName', { field: t('nameField') }) : undefined}>
            <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label={t('nameRequired')} />
          </Field>
          <Field label={`${t('email')} *`} error={form.email.trim() ? (EMAIL_RE.test(form.email.trim()) ? undefined : t('invalidEmail')) : undefined}>
            <TextInput className="num" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@example.org" aria-label={t('email')} />
          </Field>
          <Field label={t('department')}><TextInput value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })} placeholder={t('freeTextDemo')} /></Field>
          <Field label={t('jobTitle')}><TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t('freeTextDemo')} /></Field>
          <Field label={`${t('roleLabel')} *`}>
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as MockUser['role'] })}>
              {ROLES.map((r) => <option key={r} value={r}>{t(ROLE_KEY[r])}</option>)}
            </Select>
          </Field>
          <Field label={t('status')}>
            <Select value={form.active ? 'active' : 'inactive'} onChange={(e) => setForm({ ...form, active: e.target.value === 'active' })}>
              <option value="active">{t('activeSt')}</option>
              <option value="inactive">{t('inactiveSt')}</option>
            </Select>
          </Field>
        </div>
        <p className="muted small">{t('mockFieldsNote')}</p>
        <div className="formActions">
          {/* Same validated-save anatomy as the Projects edit modal: save stays
              disabled while any required field is missing or invalid. */}
          <Button variant="primary" disabled={!form.name.trim() || !EMAIL_RE.test(form.email.trim())} onClick={saveForm}>{t('saveChanges')}</Button>
          <Button onClick={() => setFormOpen(false)}>{t('cancel')}</Button>
        </div>
      </Modal>

      <Modal title={`${t('userDetails')}${manage ? `: ${manage.name}` : ''}`} open={!!manage} onClose={() => setManage(null)} wide>
        {manage && (
          <div>
            {manageErr && <div className="errBox" role="alert">{manageErr}</div>}
            <div className="formGrid">
              <div className="card"><span className="l">{t('email')}</span><br /><strong className="num">{manage.email}</strong></div>
              <div className="card"><span className="l">{t('department')} / {t('jobTitle')}</span><br /><strong>{manage.dept || '—'} / {manage.title || '—'}</strong></div>
              <div className="card"><span className="l">{t('roleLabel')}</span><br /><Badge tone={manage.role === 'admin' ? 'red' : 'gray'}>{t(ROLE_KEY[manage.role])}</Badge></div>
              <div className="card"><span className="l">{t('status')}</span><br /><Badge tone={manage.active ? 'green' : 'gray'}>{manage.active ? t('activeSt') : t('inactiveSt')}</Badge></div>
            </div>
            <h3>{t('overridesTab')}</h3>
            <p className="muted small">{t('denyBeatsGrant')}</p>
            {MANAGED_GROUPS.map((g) => (
              <section key={g.group} style={{ marginBottom: 12 }}>
                <h4 className="muted small">{g.group}</h4>
                {g.keys.map((k) => {
                  const cur = ov[k];
                  const baseHas = ROLE_BASE[manage.role].includes(k);
                  const allowed = cur === 'DENY' ? false : cur === 'GRANT' ? true : baseHas;
                  const srcKey: 'deny' | 'grant' | 'role' | 'none' = cur === 'DENY' ? 'deny' : cur === 'GRANT' ? 'grant' : baseHas ? 'role' : 'none';
                  const srcText = { role: t('permFromRole'), grant: t('permGrant'), deny: t('permDeny'), none: t('permNone') }[srcKey];
                  return (
                    <div key={k} data-testid={`perm-${k}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
                      <code className="num small" dir="ltr">{k}</code>
                      <Badge tone={allowed ? 'green' : 'gray'}>{allowed ? t('activeSt') : t('inactiveSt')}</Badge>
                      <span className="muted small">({srcText})</span>
                      <span style={{ marginInlineStart: 'auto' }}>
                        <Select data-testid={`override-${k}`} aria-label={`${k} (${manage.name})`} value={cur ?? 'INHERIT'} onChange={(e) => {
                          const v = e.target.value as 'INHERIT' | OverrideEffect;
                          setOv((o) => { const n = { ...o }; if (v === 'INHERIT') delete n[k]; else n[k] = v; return n; });
                        }}>
                          <option value="INHERIT">{t('ovInherit')}</option>
                          <option value="GRANT">{t('ovGrant')}</option>
                          <option value="DENY">{t('ovDeny')}</option>
                        </Select>
                      </span>
                    </div>
                  );
                })}
              </section>
            ))}
            <h3>{t('accessTab')}</h3>
            {projects.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
                <strong>{p.name}</strong><span className="muted small num">{p.code}</span>
                <span style={{ marginInlineStart: 'auto' }}>
                  <Select data-testid={`access-${p.id}`} aria-label={`${p.name} access`} value={acc[p.id] ?? 'NONE'} onChange={(e) => setAcc((a) => ({ ...a, [p.id]: e.target.value as AccessLevel }))}>
                    {(['NONE', 'READ', 'WRITE', 'DELETE'] as const).map((l) => <option key={l} value={l}>{t(ACCESS_KEY[l])}</option>)}
                  </Select>
                </span>
              </div>
            ))}
            <div className="formActions">
              <Button variant="primary" onClick={saveManage}>{t('saveChanges')}</Button>
              <Button onClick={() => setManage(null)}>{t('close')}</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toggleTarget}
        text={toggleTarget ? `${toggleTarget.active ? t('disableUser') : t('enableUser')}: ${toggleTarget.name}${t('qMark')}${toggleTarget.id === user?.id ? ` ${t('selfDisableWarn')}` : ''}` : ''}
        onConfirm={() => {
          if (!toggleTarget || !user) return;
          const r = userApi.update(toggleTarget.id, user.id, { active: !toggleTarget.active });
          if (!r.ok) { toast('error', errText(t, r)); return; }
          setToggleTarget(null);
          reload();
          toast('success', t('doneMock'));
        }}
        onCancel={() => setToggleTarget(null)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        text={deleteTarget ? `${t('deleteUser')}: ${deleteTarget.name}${t('qMark')} ${t('finalDeleteSimulated')}${deleteTarget.id === user?.id ? ` ${t('selfDeleteWarn')}` : ''}` : ''}
        onConfirm={() => {
          if (!deleteTarget || !user) return;
          const r = userApi.remove(deleteTarget.id, user.id);
          if (!r.ok) { toast('error', errText(t, r)); return; }
          setDeleteTarget(null);
          reload();
          toast('success', t('doneMock'));
        }}
        onCancel={() => setDeleteTarget(null)}
      />
      <Modal title={t('resetPassword')} open={!!resetTarget} onClose={() => setResetTarget(null)}>
        <p>{t('email')}: <strong className="num">{resetTarget?.email}</strong></p>
        <p className="muted small">{t('resetNote')}</p>
        <div className="formActions">
          <Button variant="primary" onClick={() => {
            if (!resetTarget) return;
            const r = userApi.resetPassword(resetTarget.id);
            setResetTarget(null);
            toast('success', r.errorKey ? errText(t, r) : r.message);
          }}>{t('confirm')}</Button>
          <Button onClick={() => setResetTarget(null)}>{t('cancel')}</Button>
        </div>
      </Modal>
    </div>
  );
};
