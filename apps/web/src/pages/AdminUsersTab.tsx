import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { DataTable } from '../components/DataTable';
import { Badge, Modal, ConfirmDialog, TextInput, Select, useToast, EmptyState, SkeletonTable, Field } from '../components/ui';
import { IconEdit, IconShield, IconReplace, IconTrash } from '../components/Icons';
import { PERMISSIONS_AR } from '../lib/permissions';

export const AdminUsersTab = () => {
  const { user: currentUser, can } = useAuth();
  const showToast = useToast();
  const [users, setUsers] = useState<{ id: string, [key: string]: any }[]>([]);
  const [roles, setRoles] = useState<{ id: string, [key: string]: any }[]>([]);
  const [loading, setLoading] = useState(true);

  const [editUser, setEditUser] = useState<any | null>(null);
  const [resetUser, setResetUser] = useState<any | null>(null);
  const [accessUser, setAccessUser] = useState<any | null>(null);
  const [deleteUser, setDeleteUser] = useState<any | null>(null);
  const [createUserOpen, setCreateUserOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [u, r] = await Promise.all([
        api.get<any[]>('/api/users'),
        api.get<any[]>('/api/roles').catch(() => [])
      ]);
      setUsers(u);
      setRoles(r);
    } catch (e) {
      if (e instanceof ApiError) showToast('error', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (payload: any) => {
    try {
      await api.post('/api/users', payload);
      showToast('success', 'تم إنشاء المستخدم بنجاح');
      loadData();
      setCreateUserOpen(false);
    } catch (e) {
      if (e instanceof ApiError) showToast('error', e.message);
      throw e; // Rethrow to let modal handle loading state if we want, or just show toast
    }
  };

  const handleUpdateUser = async (id: string, payload: any) => {
    try {
      await api.put(`/api/users/${id}`, payload);
      showToast('success', 'تم التحديث بنجاح');
      loadData();
      setEditUser(null);
    } catch (e) {
      if (e instanceof ApiError) showToast('error', e.message);
    }
  };

  const handleResetPassword = async (password: string) => {
    if (!resetUser) return;
    try {
      await api.post(`/api/users/${resetUser.id}/reset-password`, { password });
      showToast('success', 'تم تغيير كلمة المرور بنجاح');
      setResetUser(null);
    } catch (e) {
      if (e instanceof ApiError) showToast('error', e.message);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    try {
      await api.del(`/api/users/${deleteUser.id}`);
      showToast('success', 'تم حذف المستخدم بنجاح');
      setDeleteUser(null);
      loadData();
    } catch (e) {
      if (e instanceof ApiError) showToast('error', e.message);
      else if (e instanceof Error) showToast('error', e.message);
      else showToast('error', 'فشل حذف المستخدم');
    }
  };

  if (loading) return <SkeletonTable />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>المستخدمون</h2>
        <button className="btn btn--primary" onClick={() => setCreateUserOpen(true)}>مستخدم جديد</button>
      </div>

      <DataTable
        loading={false}
        data={{ items: users, total: users.length, page: 1, pageSize: 100 }}
        columns={[
          { key: 'c1', label: 'اسم المستخدم', render: (u) => u.username },
          { key: 'c2', label: 'الاسم الكامل', render: (u) => u.fullName },
          { key: 'c3', label: 'الدور', render: (u) => u.roleName },
          {
            key: 'c4', label: 'الحالة',
            render: (u) => (
              <Badge tone={u.isActive ? 'green' : 'red'}>
                {u.isActive ? 'نشط' : 'معطل'}
              </Badge>
            )
          },
          {
            key: 'c5', label: 'الإجراءات',
            render: (u) => {
              const isSelf = currentUser?.id === u.id;
              const canManage = can('users.manage');
              return (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button className="btn btn--ghost btn--sm" onClick={() => setEditUser(u)} title="تعديل">
                    <IconEdit />
                  </button>
                  <button className="btn btn--ghost btn--sm" onClick={() => setResetUser(u)} title="إعادة تعيين كلمة المرور">
                    <IconReplace />
                  </button>
                  <button className="btn btn--ghost btn--sm" onClick={() => setAccessUser(u)} title="إدارة الصلاحيات">
                    <IconShield />
                  </button>
                  {canManage && (
                    <button
                      className={`btn btn--ghost btn--sm ${isSelf ? '' : 'btn--danger'}`}
                      onClick={() => {
                        if (isSelf) {
                          showToast('error', 'لا يمكنك حذف حسابك بنفسك');
                          return;
                        }
                        setDeleteUser(u);
                      }}
                      disabled={isSelf}
                      title={isSelf ? 'لا يمكنك حذف حسابك بنفسك' : 'حذف المستخدم'}
                      aria-label={isSelf ? 'لا يمكنك حذف حسابك بنفسك' : `حذف ${u.username}`}
                    >
                      <IconTrash />
                    </button>
                  )}
                </div>
              );
            }
          }
        ]}
      />

      {createUserOpen && (
        <CreateUserModal
          roles={roles}
          onClose={() => setCreateUserOpen(false)}
          onSave={handleCreateUser}
        />
      )}

      {editUser && (
        <EditUserModal
          user={editUser}
          roles={roles}
          isSelf={currentUser?.id === editUser.id}
          onClose={() => setEditUser(null)}
          onSave={(payload: any) => handleUpdateUser(editUser.id, payload)}
        />
      )}

      {resetUser && (
        <ResetPasswordModal
          user={resetUser}
          onClose={() => setResetUser(null)}
          onSave={handleResetPassword}
        />
      )}

      {accessUser && (
        <ManageAccessModal
          user={accessUser}
          isSelf={currentUser?.id === accessUser.id}
          onClose={() => setAccessUser(null)}
          onSave={() => { setAccessUser(null); loadData(); }}
        />
      )}

      {deleteUser && (
        <ConfirmDialog
          open={!!deleteUser}
          text={`هل تريد بالتأكيد حذف المستخدم "${deleteUser.username}"؟ هذا الإجراء نهائي ولا يمكن التراجع عنه.`}
          onConfirm={handleDeleteUser}
          onCancel={() => setDeleteUser(null)}
        />
      )}
    </div>
  );
};

const CreateUserModal = ({ roles, onClose, onSave }: any) => {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [roleName, setRoleName] = useState('viewer');
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!username || !fullName || !password) return;
    setBusy(true);
    try {
      await onSave({ username, fullName, password, roleName, isActive });
    } catch (e) {
      // API error shown by parent
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="مستخدم جديد" open onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Field label="الاسم الكامل">
          <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
        </Field>
        <Field label="اسم المستخدم (للدخول)">
          <TextInput value={username} onChange={(e) => setUsername(e.target.value)} dir="ltr" />
        </Field>
        <Field label="كلمة المرور">
          <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
        </Field>
        <Field label="الدور">
          <Select value={roleName} onChange={(e) => setRoleName(e.target.value)}>
            {roles.map((r: any) => (
              <option key={r.name} value={r.name}>{r.name_ar || r.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="الحالة">
          <Select value={isActive ? 'true' : 'false'} onChange={(e) => setIsActive(e.target.value === 'true')}>
            <option value="true">نشط</option>
            <option value="false">معطل</option>
          </Select>
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          <button className="btn btn--ghost" onClick={onClose} disabled={busy}>إلغاء</button>
          <button className="btn btn--primary" onClick={handleSubmit} disabled={busy || !username || !fullName || !password}>
            {busy ? 'جاري الحفظ…' : 'إنشاء'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

const EditUserModal = ({ user, roles, isSelf, onClose, onSave }: any) => {
  const [fullName, setFullName] = useState(user.fullName);
  const [roleName, setRoleName] = useState(user.roleName);
  const [isActive, setIsActive] = useState(user.isActive);

  return (
    <Modal title="تعديل المستخدم" open onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Field label="الاسم الكامل">
          <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="الدور">
          <Select value={roleName} onChange={(e) => setRoleName(e.target.value)} disabled={isSelf}>
            {roles.map((r: any) => (
              <option key={r.name} value={r.name}>{r.name_ar || r.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="الحالة">
          <Select value={isActive ? 'true' : 'false'} onChange={(e) => setIsActive(e.target.value === 'true')} disabled={isSelf}>
            <option value="true">نشط</option>
            <option value="false">معطل</option>
          </Select>
        </Field>
        {isSelf && <div className="small muted">لا يمكنك تعديل صلاحيات حسابك (الدور والحالة).</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          <button className="btn btn--ghost" onClick={onClose}>إلغاء</button>
          <button className="btn btn--primary" onClick={() => onSave({ fullName, roleName, isActive })}>حفظ</button>
        </div>
      </div>
    </Modal>
  );
};

const ResetPasswordModal = ({ user, onClose, onSave }: any) => {
  const [password, setPassword] = useState('');
  return (
    <Modal title={`إعادة تعيين كلمة مرور: ${user.username}`} open onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Field label="كلمة المرور الجديدة">
          <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          <button className="btn btn--ghost" onClick={onClose}>إلغاء</button>
          <button className="btn btn--primary" onClick={() => onSave(password)}>تغيير</button>
        </div>
      </div>
    </Modal>
  );
};

export const ManageAccessModal = ({ user, isSelf, onClose, onSave }: any) => {
  const showToast = useToast();
  const [data, setData] = useState<any>(null);
  const [overrides, setOverrides] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const res = await api.get<any>(`/api/users/${user.id}/effective`);
      setData(res);
      const ov: Record<string, string> = {};
      res.overrides.forEach((o: any) => { ov[o.permissionKey] = o.effect; });
      setOverrides(ov);
    } catch (e) {
      if (e instanceof ApiError) showToast('error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (isSelf) return;
    const payload = Object.keys(PERMISSIONS_AR)
      .filter((k) => overrides[k] !== undefined && overrides[k] !== null)
      .map((permissionKey) => ({ permissionKey, effect: overrides[permissionKey] }));
    
    try {
      await api.put(`/api/users/${user.id}/overrides`, { overrides: payload });
      showToast('success', 'تم حفظ الصلاحيات بنجاح');
      onSave();
    } catch (e) {
      if (e instanceof ApiError) showToast('error', e.message);
    }
  };

  if (loading || !data) return <Modal title="إدارة الصلاحيات" open onClose={onClose} wide><SkeletonTable /></Modal>;

  return (
    <Modal title={`إدارة صلاحيات: ${user.username}`} open onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '70vh', overflowY: 'auto' }}>
        {isSelf && <div className="alert alert-warning" style={{ background: '#fef3c7', padding: '1rem', borderRadius: '4px' }}>لا يمكنك تعديل صلاحيات حسابك.</div>}
        
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f3f4f6', textAlign: 'right' }}>
              <th style={{ padding: '0.5rem' }}>الصلاحية</th>
              <th style={{ padding: '0.5rem' }}>موروثة</th>
              <th style={{ padding: '0.5rem' }}>ممنوحة (Grant)</th>
              <th style={{ padding: '0.5rem' }}>مرفوضة (Deny)</th>
              <th style={{ padding: '0.5rem' }}>النتيجة الفعالة</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(PERMISSIONS_AR).map((key) => {
              const currentOverride = overrides[key] || null;
              const permData = data.permissions[key] || { roleValue: false, effective: false };
              
              let tempEffective = permData.roleValue;
              if (currentOverride === 'GRANT') tempEffective = true;
              if (currentOverride === 'DENY') tempEffective = false;

              return (
                <tr key={key} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.5rem' }}>{PERMISSIONS_AR[key]} <br/><small className="muted" dir="ltr">{key}</small></td>
                  <td style={{ padding: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <input 
                        type="radio" 
                        name={`perm_${key}`} 
                        checked={currentOverride === null} 
                        onChange={() => setOverrides(prev => ({ ...prev, [key]: null }))}
                        disabled={isSelf}
                      />
                      <span className="small muted">(من الدور)</span>
                    </label>
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <input 
                        type="radio" 
                        name={`perm_${key}`} 
                        checked={currentOverride === 'GRANT'} 
                        onChange={() => setOverrides(prev => ({ ...prev, [key]: 'GRANT' }))}
                        disabled={isSelf}
                      />
                      <span className="small">منح</span>
                    </label>
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <input 
                        type="radio" 
                        name={`perm_${key}`} 
                        checked={currentOverride === 'DENY'} 
                        onChange={() => setOverrides(prev => ({ ...prev, [key]: 'DENY' }))}
                        disabled={isSelf}
                      />
                      <span className="small">رفض</span>
                    </label>
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <Badge tone={tempEffective ? 'green' : 'red'}>
                      {tempEffective ? 'مسموح' : 'ممنوع'}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          <button className="btn btn--ghost" onClick={onClose}>إلغاء</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={isSelf}>حفظ الصلاحيات</button>
        </div>
      </div>
    </Modal>
  );
};