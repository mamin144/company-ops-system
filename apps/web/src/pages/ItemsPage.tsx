import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Item } from '@cos/shared';
import { usePagedList } from '../hooks/usePagedList';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { ConfirmDialog, Field, Modal, Select, TextArea, TextInput, SearchInput, useToast } from '../components/ui';
import { EditDeleteActions } from '../components/DataTable';
import { ImportExcelModal } from '../components/ImportExcelModal';
import { IconDownload, IconPlus, IconUpload } from '../components/Icons';
import { downloadDocument } from '../lib/api';

type FormState = Omit<Item, 'id' | 'createdAt' | 'updatedAt'> & { trackingType?: string };

const emptyForm: FormState = { code: '', name: '', category: '', unit: '', brand: '', minimumStock: undefined, trackingType: 'none', notes: '' };

export const ItemsPage = () => {
  const list = usePagedList<Item>('/api/items');
  const toast = useToast();
  const [editing, setEditing] = useState<Item | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    // keep known categories for filter datalist
  }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormOpen(true); };
  const openEdit = (it: Item) => {
    setEditing(it);
    const { id, createdAt, updatedAt, ...rest } = it;
    void id; void createdAt; void updatedAt;
    setForm(rest);
    setFormOpen(true);
  };

  const save = async () => {
    try {
      if (editing) await api.put(`/api/items/${editing.id}`, form);
      else await api.post('/api/items', form);
      toast('success', editing ? 'تم تحديث الصنف' : 'تم إضافة الصنف');
      setFormOpen(false);
      void list.reload();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'خطأ في الحفظ');
    }
  };

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.del(`/api/items/${deleteTarget.id}`);
      toast('success', 'تم حذف الصنف');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'خطأ في الحذف');
    }
    setDeleteTarget(null);
    void list.reload();
  }, [deleteTarget, list, toast]);

  const columns: Column<Item>[] = [
    {
      key: 'code',
      label: 'الكود',
      sortable: true,
      render: (it) => <span className="mono num bold">{it.code}</span>,
    },
    { key: 'name', label: 'اسم الصنف', sortable: true },
    {
      key: 'category',
      label: 'التصنيف',
      render: (it) => <span className="tag">{it.category}</span>,
    },
    { key: 'unit', label: 'الوحدة', render: (it) => <span className="small muted">{it.unit}</span> },
    { key: 'brand', label: 'الماركة', render: (it) => it.brand || '—' },
    {
      key: 'minimumStock',
      label: 'حد الأمان',
      render: (it) =>
        typeof it.minimumStock === 'number' ? (
          <span className="num bold">{it.minimumStock}</span>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <div className="page">
      <div className="invHeader">
        <div className="invHeader__titleGroup">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1>الأصناف</h1>
              <span className="heroChip num">{list.data?.total ?? 0} صنف</span>
            </div>
            <p>دليل أصناف المواد والمهمات ووحدات القياس ومستويات الأمان</p>
          </div>
        </div>
        <div className="actions">
          <button className="btn btn--ghost" onClick={() => void downloadDocument('/api/items/export/xlsx', 'items.xlsx')}>
            <IconDownload size={16} /> تصدير Excel
          </button>
          <button className="btn btn--ghost" onClick={() => setImportOpen(true)}>
            <IconUpload size={16} /> استيراد Excel
          </button>
          <button className="btn btn--primary" onClick={openCreate}>
            <IconPlus size={16} /> صنف جديد
          </button>
        </div>
      </div>

      <div className="invToolbar">
        <SearchInput value={list.state.q} onChange={list.setQ} placeholder="بحث بالكود أو الاسم أو التصنيف…" />
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

      {/* Responsive Mobile Item Cards */}
      <div className="itemGrid">
        {(list.data?.items ?? []).map((it) => (
          <div className="itemCard" key={it.id}>
            <div className="itemCard__top">
              <div>
                <h3 className="itemCard__title">{it.name}</h3>
                <span className="itemCard__code num">{it.code}</span>
              </div>
              <span className="tag">{it.category}</span>
            </div>
            <div className="itemCard__meta">
              <div className="itemCard__metaItem">
                <span className="itemCard__metaLabel">الوحدة</span>
                <span className="itemCard__metaValue">{it.unit}</span>
              </div>
              <div className="itemCard__metaItem">
                <span className="itemCard__metaLabel">الماركة</span>
                <span className="itemCard__metaValue">{it.brand || '—'}</span>
              </div>
              <div className="itemCard__metaItem">
                <span className="itemCard__metaLabel">حد الأمان</span>
                <span className="itemCard__metaValue num">{typeof it.minimumStock === 'number' ? it.minimumStock : '—'}</span>
              </div>
              <div className="itemCard__metaItem">
                <span className="itemCard__metaLabel">نوع التتبع</span>
                <span className="itemCard__metaValue">{it.trackingType === 'batch' ? 'تشغيلة' : it.trackingType === 'serial' ? 'مسلسل' : 'بدون'}</span>
              </div>
            </div>
            <div className="itemCard__actions">
              <EditDeleteActions onEdit={() => openEdit(it)} onDelete={() => setDeleteTarget(it)} />
            </div>
          </div>
        ))}
      </div>

      <Modal title={editing ? 'تعديل صنف' : 'صنف جديد'} open={formOpen} onClose={() => setFormOpen(false)}>
        <div className="formGrid">
          <Field label="الكود *"><TextInput value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="اسم الصنف *"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="التصنيف *"><TextInput value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
          <Field label="الوحدة *"><TextInput value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="مثال: قطعة، كجم، متر" /></Field>
          <Field label="الماركة"><TextInput value={form.brand ?? ''} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></Field>
          <Field label="حد الأمان (الحد الأدنى)"><TextInput type="number" min={0} value={form.minimumStock ?? ''} onChange={(e) => setForm({ ...form, minimumStock: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
          <Field label="نوع التتبع">
            <Select value={form.trackingType ?? 'none'} onChange={(e) => setForm({ ...form, trackingType: e.target.value as FormState['trackingType'] })}>
              <option value="none">بدون</option>
              <option value="batch">تشغيلة (Batch)</option>
              <option value="serial">مسلسل (Serial)</option>
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
        text={`هل تريد حذف الصنف "${deleteTarget?.name}"؟`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ImportExcelModal
        entity="items"
        title="الأصناف"
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={() => void list.reload()}
      />
    </div>
  );
};

