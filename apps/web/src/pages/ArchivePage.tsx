import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { CategoryOption, Document, DocumentRevision, Project } from '@cos/shared';
import { usePagedList } from '../hooks/usePagedList';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { Badge, ConfirmDialog, Field, Modal, Select, TextArea, TextInput, SearchInput, useToast } from '../components/ui';
import { EditDeleteActions } from '../components/DataTable';
import { ImportExcelModal } from '../components/ImportExcelModal';
import { IconDownload, IconEye, IconFile, IconPlus, IconReplace, IconUpload } from '../components/Icons';
import { PreviewDocButton, DownloadDocButton } from '../components/ProtectedFileLink';
import { downloadDocument } from '../lib/api';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';
import { QuickUploadModal } from '../components/QuickUploadModal';

const STATUS_AR: Record<string, string> = {
  draft: 'مسودة', submitted: 'مقدمة', 'under-review': 'قيد المراجعة',
  approved: 'معتمد', rejected: 'مرفوض', superseded: 'مُستبدل', archived: 'مؤرشف',
};

const STATUS_TONE: Record<string, string> = {
  draft: 'gray', submitted: 'blue', 'under-review': 'amber', approved: 'green',
  rejected: 'red', superseded: 'purple', archived: 'gray',
};

type FormState = {
  projectId: string;
  title: string;
  documentNumber: string;
  category: string;
  documentType: string;
  revision: string;
  documentDate: string;
  uploadedBy: string;
  notes: string;
  tags: string;
};

const emptyForm: FormState = { projectId: '', title: '', documentNumber: '', category: '', documentType: '', revision: '', documentDate: '', uploadedBy: '', notes: '', tags: '' };

const previewable = (ext: string) => ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);

const fileIconKind = (ext: string) =>
  ext === 'pdf' ? 'pdf' : ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext) ? 'image' : ['xlsx', 'xls', 'csv'].includes(ext) ? 'sheet' : ['zip', 'rar', '7z'].includes(ext) ? 'zip' : ['dwg', 'dxf'].includes(ext) ? 'cad' : undefined;

export const ArchivePage = () => {
  const list = usePagedList<Document>('/api/documents');
  const toast = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Document | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<Document | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [quickUploadOpen, setQuickUploadOpen] = useState(false);
  const [revisionsDoc, setRevisionsDoc] = useState<Document | null>(null);
  const [revisions, setRevisions] = useState<DocumentRevision[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const revisionInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void api.get<{ items: Project[] }>('/api/projects?pageSize=200').then((r) => setProjects(Array.isArray(r.items) ? r.items : []));
    void api.get<CategoryOption[]>('/api/config/categories').then(setCategories);
  }, []);

  const docCategories = categories.filter((c) => c.group === 'document-category');
  const docTypes = categories.filter((c) => c.group === 'document-type');

  const openCreate = () => { setQuickUploadOpen(true); };
  const openEdit = (d: Document) => {
    setEditing(d);
    setForm({
      projectId: d.projectId ?? '',
      title: d.title,
      documentNumber: d.documentNumber ?? '',
      category: d.category,
      documentType: d.documentType,
      revision: d.revision ?? '',
      documentDate: d.documentDate ?? '',
      uploadedBy: d.uploadedBy ?? '',
      notes: d.notes ?? '',
      tags: (d.tags ?? []).join(', '),
    });
    setFile(null);
    setFormOpen(true);
  };

  const save = async () => {
    try {
      if (editing) {
        await api.put(`/api/documents/${editing.id}`, { ...form, tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean) });
        toast('success', 'تم تحديث بيانات المستند');
      } else {
        if (!file) { toast('error', 'الرجاء اختيار ملف'); return; }
        const fd = new FormData();
        fd.append('file', file);
        Object.entries(form).forEach(([k, v]) => fd.append(k, v));
        await api.upload('/api/documents/upload', fd);
        toast('success', 'تم رفع المستند');
      }
      setFormOpen(false);
      void list.reload();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'خطأ في الحفظ');
    }
  };

  const doReplace = async (f: File) => {
    if (!replaceTarget) return;
    const fd = new FormData();
    fd.append('file', f);
    try {
      await api.upload(`/api/documents/${replaceTarget.id}/replace`, fd);
      toast('success', 'تم استبدال الملف');
      void list.reload();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'خطأ في الاستبدال');
    }
    setReplaceTarget(null);
  };

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.del(`/api/documents/${deleteTarget.id}`);
      toast('success', 'تم حذف المستند');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'خطأ في الحذف');
    }
    setDeleteTarget(null);
    void list.reload();
  }, [deleteTarget, list, toast]);

  const openRevisions = async (d: Document) => {
    setRevisionsDoc(d);
    try {
      setRevisions(await api.get<DocumentRevision[]>(`/api/documents/${d.id}/revisions`));
    } catch {
      setRevisions([]);
    }
  };

  const uploadRevision = async (f: File) => {
    if (!revisionsDoc) return;
    const fd = new FormData();
    fd.append('file', f);
    try {
      await api.upload(`/api/documents/${revisionsDoc.id}/revisions`, fd);
      toast('success', 'تم رفع إصدار جديد — الإصدارات السابقة محفوظة');
      await openRevisions(revisionsDoc);
      void list.reload();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'خطأ في الرفع');
    }
  };

  const f = list.state.filters;

  const columns: Column<Document>[] = [
    {
      key: 'title',
      label: 'العنوان',
      sortable: true,
      render: (d) => (
        <span className="fileCell">
          <IconFile kind={fileIconKind(d.fileExtension)} size={17} />
          <span>
            <strong>{d.title}</strong>
            <small className="muted block">{(d.tags ?? []).slice(0, 3).map((t) => `#${t}`).join(' ')}</small>
          </span>
        </span>
      ),
    },
    { key: 'documentNumber', label: 'رقم المستند' },
    { key: 'category', label: 'التصنيف', render: (d) => <Badge tone="blue">{d.category}</Badge> },
    { key: 'documentType', label: 'النوع' },
    {
      key: 'revision',
      label: 'الإصدار',
      render: (d) => (
        <button className="linkBtn" onClick={() => openRevisions(d)} title="عرض الإصدارات">
          {d.revision ?? '00'} ({d.revisions?.length ?? 1})
        </button>
      ),
    },
    {
      key: 'status',
      label: 'الحالة',
      render: (d) => (
        <Select
          value={d.status}
          style={{ minWidth: 110 }}
          onChange={async (e) => {
            try {
              await api.patch(`/api/documents/${d.id}/status`, { status: e.target.value });
              toast('success', 'تم تحديث حالة المستند');
              void list.reload();
            } catch (err) {
              toast('error', err instanceof Error ? err.message : 'خطأ');
            }
          }}
        >
          {Object.entries(STATUS_AR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      ),
    },
    { key: 'fileName', label: 'الملف' },
    {
      key: '_open',
      label: 'عرض',
      render: (d) => (
        <>
          <PreviewDocButton small documentId={d.id} fileName={d.fileName} />
          <DownloadDocButton small documentId={d.id} fileName={d.fileName} />
        </>
      ),
    },
  ];

  return (
    <div className="page">
      <div className="pageHead">
        <div><h1>الأرشيف</h1><p>إدارة مستندات المشاريع</p></div>
        <div className="actions">
          <SearchInput value={list.state.q} onChange={list.setQ} placeholder="بحث في المستندات…" />
          <button className="btn btn--ghost" onClick={list.clearFilters}>مسح الفلاتر</button>
          <button className="btn btn--ghost" onClick={() => void downloadDocument('/api/documents/export/xlsx', 'documents.xlsx')}><IconDownload size={16} /> تصدير Excel</button>
          <button className="btn btn--ghost" title="استيراد بيانات وصفية فقط بدون الملفات" onClick={() => setImportOpen(true)}><IconUpload size={16} /> استيراد Excel</button>
          <button className="btn btn--primary" onClick={openCreate}><IconPlus size={16} /> رفع مستند</button>
        </div>
      </div>

      <div className="filtersRow">
        <Select value={f.projectId ?? ''} onChange={(e) => list.setFilter('projectId', e.target.value)}>
          <option value="">كل المشاريع</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.projectCode} — {p.projectName}</option>)}
        </Select>
        <Select value={f.category ?? ''} onChange={(e) => list.setFilter('category', e.target.value)}>
          <option value="">كل التصنيفات</option>
          {docCategories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </Select>
        <Select value={f.documentType ?? ''} onChange={(e) => list.setFilter('documentType', e.target.value)}>
          <option value="">كل الأنواع</option>
          {docTypes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </Select>
        <TextInput type="date" value={f.from ?? ''} onChange={(e) => list.setFilter('from', e.target.value)} title="من تاريخ" />
        <TextInput type="date" value={f.to ?? ''} onChange={(e) => list.setFilter('to', e.target.value)} title="إلى تاريخ" />
      </div>

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
          <>
            <EditDeleteActions onEdit={() => openEdit(row)} onDelete={() => setDeleteTarget(row)} />
            <button className="iconBtn iconBtn--hover" title="استبدال الملف" onClick={() => { setReplaceTarget(row); replaceInput.current?.click(); }}><IconReplace size={15} /></button>
          </>
        )}
      />

      <input
        ref={replaceInput}
        type="file"
        hidden
        onChange={(e) => { const file2 = e.target.files?.[0]; if (file2 && replaceTarget) void doReplace(file2); e.target.value = ''; }}
      />

      <Modal title={`إصدارات المستند: ${revisionsDoc?.title ?? ''}`} open={!!revisionsDoc} onClose={() => setRevisionsDoc(null)} wide>
        <div className="stack">
          {revisions.length === 0 ? (
            <p className="muted">لا توجد إصدارات مسجلة</p>
          ) : (
            <table className="table table--flat">
              <thead><tr><th>الإصدار</th><th>الملف</th><th>رفع بواسطة</th><th>التاريخ</th><th>ملاحظات</th><th></th></tr></thead>
              <tbody>
                {revisions.map((r) => (
                  <tr key={r.id}>
                    <td><Badge tone={r.revision === revisionsDoc?.revision ? 'green' : 'gray'}>{r.revision}</Badge></td>
                    <td>{r.fileName}</td>
                    <td>{r.uploadedBy ?? '—'}</td>
                    <td>{new Date(r.uploadedAt).toLocaleDateString('ar-EG')}</td>
                    <td className="small muted">{r.notes ?? '—'}</td>
                    <td>
                      {revisionsDoc ? (
                        <>
                          <PreviewDocButton small documentId={revisionsDoc.id} fileName={r.fileName} revision={r.id} />
                          <DownloadDocButton small documentId={revisionsDoc.id} fileName={r.fileName} revision={r.id} />
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <input
            type="file"
            hidden
            ref={revisionInput}
            onChange={(e) => { const file2 = e.target.files?.[0]; if (file2) void uploadRevision(file2); e.target.value = ''; }}
          />
          <div>
            <button className="btn btn--primary" onClick={() => revisionInput.current?.click()}>+ رفع إصدار جديد</button>
          </div>
        </div>
      </Modal>

      <Modal title={editing ? 'تعديل بيانات المستند' : 'رفع مستند جديد'} open={formOpen} onClose={() => setFormOpen(false)} wide>
        <div className="formGrid">
          {!editing ? (
            <Field label="الملف *">
              <input ref={fileInput} type="file" className="input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </Field>
          ) : null}
          <Field label="العنوان *"><TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="المشروع">
            <Select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
              <option value="">— بدون —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.projectCode} — {p.projectName}</option>)}
            </Select>
          </Field>
          <Field label="رقم المستند"><TextInput value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} /></Field>
          <Field label="التصنيف *">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">اختر…</option>
              {docCategories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="نوع المستند *">
            <Select value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })}>
              <option value="">اختر…</option>
              {docTypes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="الإصدار"><TextInput value={form.revision} onChange={(e) => setForm({ ...form, revision: e.target.value })} /></Field>
          <Field label="تاريخ المستند"><TextInput type="date" value={form.documentDate} onChange={(e) => setForm({ ...form, documentDate: e.target.value })} /></Field>
          <Field label="رفع بواسطة"><TextInput value={form.uploadedBy} onChange={(e) => setForm({ ...form, uploadedBy: e.target.value })} /></Field>
          <Field label="وسوم (مفصولة بفاصلة)"><TextInput value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></Field>
          <Field label="ملاحظات"><TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
        <div className="formActions">
          <button className="btn btn--primary" onClick={save}>حفظ</button>
          <button className="btn" onClick={() => setFormOpen(false)}>إلغاء</button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        text={`هل تريد حذف المستند "${deleteTarget?.title}"؟`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ImportExcelModal
        entity="documents"
        title="بيانات المستندات"
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={() => void list.reload()}
      />

      <QuickUploadModal
        open={quickUploadOpen}
        onClose={() => setQuickUploadOpen(false)}
        onSuccess={() => void list.reload()}
      />
    </div>
  );
};


