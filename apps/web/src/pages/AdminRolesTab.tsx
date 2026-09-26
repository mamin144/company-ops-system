import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { DataTable } from '../components/DataTable';
import { Badge, Modal, ConfirmDialog, TextInput, useToast, SkeletonTable, Field } from '../components/ui';
import { IconEdit, IconTrash, IconReplace } from '../components/Icons';
import { PERMISSIONS_AR } from '../lib/permissions';

export const AdminRolesTab = () => {
  const showToast = useToast();
  const [roles, setRoles] = useState<{ id: string, [key: string]: any }[]>([]);
  const [loading, setLoading] = useState(true);

  const [editRole, setEditRole] = useState<any | null>(null);
  const [cloneRole, setCloneRole] = useState<any | null>(null);
  const [deleteRole, setDeleteRole] = useState<any | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const r = await api.get<any[]>('/api/roles');
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

  const handleDelete = async () => {
    if (!deleteRole) return;
    try {
      await api.del(`/api/roles/${deleteRole.id}`);
      showToast('success', 'تم حذف الدور بنجاح');
      loadData();
      setDeleteRole(null);
    } catch (e) {
      if (e instanceof ApiError) showToast('error', e.message);
    }
  };

  const handleUpdateRole = async (id: string, payload: any) => {
    try {
      await api.put(`/api/roles/${id}`, payload);
      showToast('success', 'تم التحديث بنجاح');
      loadData();
      setEditRole(null);
    } catch (e) {
      if (e instanceof ApiError) showToast('error', e.message);
    }
  };

  const handleCloneRole = async (id: string, payload: any) => {
    try {
      await api.post(`/api/roles/${id}/clone`, payload);
      showToast('success', 'تم نسخ الدور بنجاح');
      loadData();
      setCloneRole(null);
    } catch (e) {
      if (e instanceof ApiError) showToast('error', e.message);
    }
  };

  if (loading) return <SkeletonTable />;

  return (
    <div>
      <DataTable
        loading={false}
        data={{ items: roles, total: roles.length, page: 1, pageSize: 100 }}
        columns={[
          { key: 'c1', label: 'الاسم (عربي)', render: (r) => r.name_ar || r.name },
          { key: 'c2', label: 'الاسم (إنجليزي)', render: (r) => r.name },
          { key: 'c3', label: 'النوع', render: (r) => <Badge tone={r.is_system ? 'gray' : 'blue'}>{r.is_system ? 'نظام' : 'مخصص'}</Badge> },
          { key: 'c4', label: 'المستخدمين', render: (r) => r.userCount },
          {
            key: 'c5', label: 'الإجراءات',
            render: (r) => (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn--ghost btn--sm" onClick={() => setEditRole(r)} title="تعديل">
                  <IconEdit />
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => setCloneRole(r)} title="نسخ">
                  <IconReplace />
                </button>
                {!r.is_system && r.userCount === 0 && (
                  <button className="btn btn--ghost btn--sm" onClick={() => setDeleteRole(r)} title="حذف">
                    <IconTrash />
                  </button>
                )}
              </div>
            )
          }
        ]}
      />

      {editRole && (
        <EditRoleModal
          role={editRole}
          onClose={() => setEditRole(null)}
          onSave={(payload: any) => handleUpdateRole(editRole.id, payload)}
        />
      )}

      {cloneRole && (
        <CloneRoleModal
          role={cloneRole}
          onClose={() => setCloneRole(null)}
          onSave={(payload: any) => handleCloneRole(cloneRole.id, payload)}
        />
      )}

      {deleteRole && (
        <ConfirmDialog
          open
          text={`هل أنت متأكد من حذف الدور "${deleteRole.name_ar || deleteRole.name}"؟`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteRole(null)}
        />
      )}
    </div>
  );
};

const EditRoleModal = ({ role, onClose, onSave }: any) => {
  const [name_ar, setNameAr] = useState(role.name_ar);
  const [permissions, setPermissions] = useState<string[]>(role.permissions || []);

  const togglePermission = (key: string) => {
    setPermissions((prev) => prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]);
  };

  return (
    <Modal title="تعديل الدور" open onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Field label="اسم الدور (عربي)">
          <TextInput value={name_ar} onChange={(e) => setNameAr(e.target.value)} />
        </Field>
        <div>
          <h4>الصلاحيات</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
            {Object.keys(PERMISSIONS_AR).map((key) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={permissions.includes(key)} onChange={() => togglePermission(key)} />
                {PERMISSIONS_AR[key]} <small className="muted" dir="ltr">({key})</small>
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          <button className="btn btn--ghost" onClick={onClose}>إلغاء</button>
          <button className="btn btn--primary" onClick={() => onSave({ name_ar, permissions })}>حفظ</button>
        </div>
      </div>
    </Modal>
  );
};

const CloneRoleModal = ({ role, onClose, onSave }: any) => {
  const [name, setName] = useState(`${role.name}-copy`);
  const [name_ar, setNameAr] = useState(`${role.name_ar} (نسخة)`);

  return (
    <Modal title="نسخ الدور" open onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Field label="المعرف الفريد (إنجليزي)">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="الاسم الجديد (عربي)">
          <TextInput value={name_ar} onChange={(e) => setNameAr(e.target.value)} />
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          <button className="btn btn--ghost" onClick={onClose}>إلغاء</button>
          <button className="btn btn--primary" onClick={() => onSave({ name, name_ar })}>نسخ</button>
        </div>
      </div>
    </Modal>
  );
};