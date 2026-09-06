import { useState } from 'react';
import { api } from '../lib/api';
import type { Project } from '@cos/shared';
import { usePagedList } from '../hooks/usePagedList';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { ConfirmDialog, Badge, toneForStatus, Field, Modal, Select, TextArea, TextInput, SearchInput, useToast } from '../components/ui';
import { EditDeleteActions } from '../components/DataTable';
import { ImportExcelModal } from '../components/ImportExcelModal';
import { IconDownload, IconPlus, IconUpload } from '../components/Icons';
import { downloadDocument } from '../lib/api';

const statusLabels: Record<string, string> = {
  planned: 'مخطط',
  active: 'نشط',
  'on-hold': 'متوقف',
  completed: 'منجز',
  cancelled: 'ملغي',
};

type FormState = Omit<Project, 'id' | 'createdAt' | 'updatedAt'>;

const emptyForm: FormState = {
  projectCode: '',
  projectName: '',
  client: '',
  owner: '',
  mainContractor: '',
  siteLocation: '',
  contractNumber: '',
  startDate: '',
  endDate: '',
  status: 'planned',
  notes: '',
};

export const ProjectsPage = () => {
  const list = usePagedList<Project>('/api/projects');
  const toast = useToast();
  const [editing, setEditing] = useState<Project | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    const { id, createdAt, updatedAt, ...rest } = p;
    void id; void createdAt; void updatedAt;
    setForm(rest);
    setFormOpen(true);
  };

  const save = async () => {
    try {
      if (editing) {
        await api.put(`/api/projects/${editing.id}`, form);
        toast('success', 'تم تحديث المشروع');
      } else {
        await api.post('/api/projects', form);
        toast('success', 'تم إضافة المشروع');
      }
      setFormOpen(false);
      void list.reload();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'خطأ في الحفظ');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.del(`/api/projects/${deleteTarget.id}`);
      toast('success', 'تم حذف المشروع');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'خطأ في الحذف');
    }
    setDeleteTarget(null);
    void list.reload();
  };

  const columns: Column<Project>[] = [
    { key: 'projectCode', label: 'كود المشروع', sortable: true },
    { key: 'projectName', label: 'اسم المشروع', sortable: true },
    { key: 'client', label: 'العميل', sortable: true },
  { key: 'owner', label: 'الجهة المالكة', sortable: true },
    { key: 'mainContractor', label: 'المقاول الرئيسي' },
    { key: 'siteLocation', label: 'موقع الموقع' },
    { key: 'contractNumber', label: 'رقم العقد' },
    { key: 'status', label: 'الحالة', render: (p) => <Badge tone={toneForStatus(p.status)}>{statusLabels[p.status] ?? p.status}</Badge> },
  ];

  return (
    <div className="page">
      <div className="pageHero">
        <div>
          <h1>المشاريع</h1>
          <p>إدارة بيانات المشاريع والعقود والجهات المالكة</p>
        </div>
        <div className="heroStats">
          <div className="heroChip"><b>{list.data?.total ?? '—'}</b><span>إجمالي المشاريع</span></div>
        </div>
      </div>

      <div className="toolbar">
        <SearchInput value={list.state.q} onChange={list.setQ} placeholder="بحث بالكود أو الاسم أو العميل…" />
        <div className="spacer" />
        <div className="actions">
          <button className="btn btn--ghost" onClick={() => list.clearFilters()}>مسح الفلاتر</button>
          <button className="btn btn--ghost" onClick={() => void downloadDocument('/api/projects/export/xlsx', 'projects.xlsx')}><IconDownload size={16} /> تصدير Excel</button>
          <button className="btn btn--ghost" onClick={() => setImportOpen(true)}><IconUpload size={16} /> استيراد Excel</button>
          <button className="btn btn--primary" onClick={openCreate}><IconPlus size={16} /> مشروع جديد</button>
        </div>
      </div>

      {Object.keys(list.state.filters).length > 0 || list.state.q ? (
        <div className="filterBar">فلاتر مفعّلة — <button className="linkBtn" onClick={list.clearFilters}>مسح الكل</button></div>
      ) : null}

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

      <Modal title={editing ? 'تعديل مشروع' : 'مشروع جديد'} open={formOpen} onClose={() => setFormOpen(false)} wide>
        <div className="formGrid">
          <Field label="كود المشروع *"><TextInput value={form.projectCode} onChange={(e) => setForm({ ...form, projectCode: e.target.value })} /></Field>
          <Field label="اسم المشروع *"><TextInput value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} /></Field>
          <Field label="العميل"><TextInput value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} /></Field>
          <Field label="الجهة المالكة"><TextInput value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></Field>
          <Field label="المقاول الرئيسي"><TextInput value={form.mainContractor} onChange={(e) => setForm({ ...form, mainContractor: e.target.value })} /></Field>
          <Field label="موقع العمل"><TextInput value={form.siteLocation} onChange={(e) => setForm({ ...form, siteLocation: e.target.value })} /></Field>
          <Field label="المنطقة"><TextInput value={form.region ?? ''} onChange={(e) => setForm({ ...form, region: e.target.value })} /></Field>
          <Field label="رقم العقد"><TextInput value={form.contractNumber} onChange={(e) => setForm({ ...form, contractNumber: e.target.value })} /></Field>
          <Field label="تاريخ البدء"><TextInput type="date" value={form.startDate ?? ''} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
          <Field label="تاريخ الانتهاء"><TextInput type="date" value={form.endDate ?? ''} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
          <Field label="الحالة">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FormState['status'] })}>
              {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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
        text={`هل تريد حذف المشروع "${deleteTarget?.projectName}"؟`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ImportExcelModal
        entity="projects"
        title="المشاريع"
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={() => void list.reload()}
      />
    </div>
  );
};

