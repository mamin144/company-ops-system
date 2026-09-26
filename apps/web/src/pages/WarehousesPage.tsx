import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Project, Warehouse } from '@cos/shared';
import { usePagedList } from '../hooks/usePagedList';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { Badge, toneForStatus, ConfirmDialog, Field, Modal, Select, TextArea, TextInput, SearchInput, useToast } from '../components/ui';
import { EditDeleteActions } from '../components/DataTable';
import { ImportExcelModal } from '../components/ImportExcelModal';
import { IconDownload, IconPlus, IconUpload } from '../components/Icons';
import { downloadDocument } from '../lib/api';

type FormState = Omit<Warehouse, 'id' | 'createdAt' | 'updatedAt'>;

const emptyForm: FormState = { code: '', name: '', type: 'central', projectId: undefined, location: '', status: 'active', notes: '' };

export const WarehousesPage = () => {
  const list = usePagedList<Warehouse>('/api/warehouses');
  const toast = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Warehouse | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    void api.get<{ items: Project[] }>('/api/projects?pageSize=200').then((r) => setProjects(Array.isArray(r.items) ? r.items : []));
  }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormOpen(true); };
  const openEdit = (w: Warehouse) => {
    setEditing(w);
    const { id, createdAt, updatedAt, ...rest } = w;
    void id; void createdAt; void updatedAt;
    setForm({ ...rest, projectId: rest.projectId ?? undefined });
    setFormOpen(true);
  };

  const save = async () => {
    try {
      if (editing) await api.put(`/api/warehouses/${editing.id}`, form);
      else await api.post('/api/warehouses', form);
      toast('success', editing ? 'تم تحديث المخزن' : 'تم إضافة المخزن');
      setFormOpen(false);
      void list.reload();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'خطأ في الحفظ');
    }
  };

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.del(`/api/warehouses/${deleteTarget.id}`);
      toast('success', 'تم حذف المخزن');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'خطأ في الحذف');
    }
    setDeleteTarget(null);
    void list.reload();
  }, [deleteTarget, list, toast]);

  const columns: Column<Warehouse>[] = [
    {
      key: 'code',
      label: 'الكود',
      sortable: true,
      render: (w) => <span className="mono num bold">{w.code}</span>,
    },
    { key: 'name', label: 'الاسم', sortable: true },
    {
      key: 'type',
      label: 'النوع',
      render: (w) => (
        <Badge tone={toneForStatus(w.type)}>
          {w.type === 'central' ? 'مخزن مركزي' : 'مخزن موقع'}
        </Badge>
      ),
    },
    { key: 'location', label: 'الموقع', render: (w) => w.location || '—' },
    {
      key: 'status',
      label: 'الحالة',
      render: (w) => (
        <Badge tone={toneForStatus(w.status)}>
          {w.status === 'active' ? 'نشط' : 'غير نشط'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="page">
      <div className="invHeader">
        <div className="invHeader__titleGroup">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1>المخازن</h1>
              <span className="heroChip num">{list.data?.total ?? 0} مخزن</span>
            </div>
            <p>إدارة المخازن المركزية ومخازن المواقع والمشاريع</p>
          </div>
        </div>
        <div className="actions">
          <button className="btn btn--ghost" onClick={() => void downloadDocument('/api/warehouses/export/xlsx', 'warehouses.xlsx')}>
            <IconDownload size={16} /> تصدير Excel
          </button>
          <button className="btn btn--ghost" onClick={() => setImportOpen(true)}>
            <IconUpload size={16} /> استيراد Excel
          </button>
          <button className="btn btn--primary" onClick={openCreate}>
            <IconPlus size={16} /> مخزن جديد
          </button>
        </div>
      </div>

      <div className="invToolbar">
        <Select value={list.state.filters.type ?? ''} onChange={(e) => list.setFilter('type', e.target.value)}>
          <option value="">كل الأنواع</option>
          <option value="central">مخزن مركزي</option>
          <option value="site">مخزن موقع</option>
        </Select>
        <SearchInput value={list.state.q} onChange={list.setQ} placeholder="بحث بالكود أو الاسم أو الموقع…" />
        <button className="btn btn--ghost" onClick={list.clearFilters}>مسح الفلاتر</button>
      </div>

      <div className="invTableDesktop">
        <DataTable
          columns={columns}
          data={list.data}
          loading={list.loading}
          error={list.error}
          onRetry={() => void list.reload()}
          sortBy={list.state.sortBy}
          sortDir={list.state.sortDir}
          onSort={list.toggleSort}
          onPage={list.setPage}
          actions={(row) => (
            <EditDeleteActions onEdit={() => openEdit(row)} onDelete={() => setDeleteTarget(row)} />
          )}
        />
      </div>

      {/* Responsive Mobile Warehouse Cards */}
      <div className="whGrid">
        {(list.data?.items ?? []).map((w) => (
          <div className="whCard" key={w.id}>
            <div className="whCard__top">
              <div className="whCard__titleGroup">
                <h3 className="whCard__title">{w.name}</h3>
                <span className="whCard__code num">{w.code}</span>
              </div>
              <Badge tone={toneForStatus(w.status)}>{w.status === 'active' ? 'نشط' : 'غير نشط'}</Badge>
            </div>
            <div className="whCard__meta">
              <div className="whCard__metaItem">
                <span className="whCard__metaLabel">النوع</span>
                <span className="whCard__metaValue">{w.type === 'central' ? 'مخزن مركزي' : 'مخزن موقع'}</span>
              </div>
              <div className="whCard__metaItem">
                <span className="whCard__metaLabel">الموقع</span>
                <span className="whCard__metaValue">{w.location || '—'}</span>
              </div>
            </div>
            <div className="whCard__actions">
              <EditDeleteActions onEdit={() => openEdit(w)} onDelete={() => setDeleteTarget(w)} />
            </div>
          </div>
        ))}
      </div>

      <Modal title={editing ? 'تعديل مخزن' : 'مخزن جديد'} open={formOpen} onClose={() => setFormOpen(false)}>
        <div className="formGrid">
          <Field label="الكود *"><TextInput value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="الاسم *"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="النوع">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as FormState['type'] })}>
              <option value="central">مخزن مركزي</option>
              <option value="site">مخزن موقع</option>
            </Select>
          </Field>
          <Field label="المشروع (اختياري)">
            <Select value={form.projectId ?? ''} onChange={(e) => setForm({ ...form, projectId: e.target.value || undefined })}>
              <option value="">— بدون —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.projectCode} — {p.projectName}</option>)}
            </Select>
          </Field>
          <Field label="الموقع"><TextInput value={form.location ?? ''} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
          <Field label="الحالة">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FormState['status'] })}>
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
            </Select>
          </Field>
          <Field label="ملاحظات"><TextArea value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
        <div className="formActions">
          <button className="btn btn--primary" onClick={save}>حفظ</button>
          <button className="btn" onClick={() => setFormOpen(false)}>إلغاء</button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        text={`هل تريد حذف المخزن "${deleteTarget?.name}"؟`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ImportExcelModal
        entity="warehouses"
        title="المخازن"
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={() => void list.reload()}
      />
    </div>
  );
};


