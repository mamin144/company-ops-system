import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { CategoryOption, Document, DocumentRevision, Project } from '@cos/shared';
import { usePagedList } from '../hooks/usePagedList';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { Badge, ConfirmDialog, Field, Modal, Select, TextArea, TextInput, SearchInput, useToast } from '../components/ui';
import { EditDeleteActions } from '../components/DataTable';
import { ImportExcelModal } from '../components/ImportExcelModal';
import { SmartImportModal } from '../components/SmartImportModal';
import { IconDownload, IconEye, IconFile, IconPlus, IconReplace, IconUpload, IconLink, IconEdit, IconTrash } from '../components/Icons';
import { PreviewDocButton, DownloadDocButton } from '../components/ProtectedFileLink';
import { downloadDocument, downloadZip } from '../lib/api';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';
import { QuickUploadModal } from '../components/QuickUploadModal';
import { FolderTree } from '../components/FolderTree';
import { DocumentLinksModal } from '../components/DocumentLinksModal';
import { useAuth } from '../context/AuthContext';

const STATUS_AR: Record<string, string> = {
  draft: 'مسودة', submitted: 'مقدمة', 'under-review': 'قيد المراجعة',
  approved: 'معتمد', rejected: 'مرفوض', superseded: 'مُستبدل', archived: 'مؤرشف',
};

const STATUS_TONE: Record<string, 'gray' | 'blue' | 'amber' | 'green' | 'red' | 'purple'> = {
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
  const { can } = useAuth();
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [linksDoc, setLinksDoc] = useState<Document | null>(null);
  const [revisionsDoc, setRevisionsDoc] = useState<Document | null>(null);
  const [revisions, setRevisions] = useState<DocumentRevision[]>([]);
  const [mobileFolderOpen, setMobileFolderOpen] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const revisionInput = useRef<HTMLInputElement>(null);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleDownloadZip = async () => {
    if (selectedIds.length === 0) return;
    setIsExportingZip(true);
    try {
      await downloadZip('/api/documents/export/zip', 'archive_export.zip', { documentIds: selectedIds });
      toast('success', 'تم تنزيل ملف ZIP بنجاح');
    } catch (e: any) {
      toast('error', e.message || 'خطأ أثناء تحميل ملف ZIP');
    } finally {
      setIsExportingZip(false);
    }
  };

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
        if (f.folderId) fd.append('folderId', f.folderId);
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
      key: 'select',
      label: '',
      sortable: false,
      render: (d) => (
        <input 
          type="checkbox" 
          checked={selectedIds.includes(d.id)} 
          onChange={() => toggleSelect(d.id)} 
        />
      ),
    },
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
        <button className="linkBtn num" onClick={() => openRevisions(d)} title="عرض الإصدارات" style={{ fontWeight: 600 }}>
          {d.revision ?? '00'} ({d.revisions?.length ?? 1})
        </button>
      ),
    },
    {
      key: 'status',
      label: 'الحالة',
      render: (d) => (
        can('archive.edit') ? (
          <Select
            value={d.status}
            style={{ minWidth: 105, padding: '4px 8px', fontSize: 12 }}
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
        ) : (
          <Badge tone={STATUS_TONE[d.status] || 'gray'}>{STATUS_AR[d.status] ?? d.status}</Badge>
        )
      ),
    },
    { key: 'fileName', label: 'الملف' },
    {
      key: '_open',
      label: 'عرض وتحميل',
      render: (d) => (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <PreviewDocButton small documentId={d.id} fileName={d.fileName} />
          {can('archive.download') && (
            <DownloadDocButton small documentId={d.id} fileName={d.fileName} />
          )}
        </div>
      ),
    },
  ];

  const handleDropDocument = async (folderId: string | null, documentId: string) => {
    try {
      await api.patch(`/api/documents/${documentId}/move`, { folderId });
      void list.reload();
    } catch (e: any) {
      alert(e.message || 'Error moving document');
    }
  };

  const selectedCount = selectedIds.length;

  return (
    <div className="archiveWorkspace">
      {/* Mobile Folder Backdrop */}
      <div 
        className={`archiveBackdrop ${mobileFolderOpen ? 'open' : ''}`} 
        onClick={() => setMobileFolderOpen(false)} 
      />

      {/* Sidebar / Folders Panel */}
      <aside className={`archiveSidebar ${mobileFolderOpen ? 'open' : ''}`} aria-label="شجرة المجلدات">
        <div className="archiveSidebar__head">
          <h2>المجلدات</h2>
          <button 
            className="btn btn--sm btn--ghost" 
            onClick={() => setMobileFolderOpen(false)}
            aria-label="إغلاق لوحة المجلدات"
          >
            ✕
          </button>
        </div>
        <div className="archiveSidebar__body">
          <FolderTree 
            selectedId={f.folderId ?? null} 
            onSelect={(id) => {
              list.setFilter('folderId', id || '');
              setMobileFolderOpen(false);
            }}
            onDropDocument={handleDropDocument}
          />
        </div>
      </aside>

      {/* Main Document Management Area */}
      <main className="archiveMain">
        <div className="archiveHeader">
          <div className="archiveHeader__top">
            <div className="archiveHeader__info">
              <div>
                <h1>الأرشيف والمستندات</h1>
                <p>إدارة مستندات ومخططات المشاريع بصيغ متعددة مع تتبع كامل للإصدارات</p>
              </div>
              <div className="heroChip" style={{ marginInlineStart: 12 }}>
                <b className="num">{list.data?.total ?? '—'}</b>
                <span>مستند</span>
              </div>
            </div>

            <div className="archiveHeader__actions">
              <button
                className="btn btn--ghost archiveFolderToggle"
                onClick={() => setMobileFolderOpen(!mobileFolderOpen)}
                aria-label="عرض لوحة المجلدات"
              >
                المجلدات
              </button>
              {can('archive.view') && (
                <button 
                  className="btn btn--ghost" 
                  onClick={() => void downloadDocument('/api/documents/export/xlsx', 'documents.xlsx')}
                >
                  <IconDownload size={16} /> تصدير Excel
                </button>
              )}
              {can('archive.upload') && (
                <>
                  <button className="btn btn--ghost" onClick={() => setImportOpen(true)}>
                    <IconUpload size={16} /> استيراد ذكي
                  </button>
                  <button className="btn btn--primary" onClick={openCreate}>
                    <IconPlus size={16} /> رفع مستند
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="archiveToolbar" role="search" aria-label="أدوات تصفية المستندات">
            <div style={{ flex: 1, minWidth: 260 }}>
              <SearchInput 
                value={list.state.q} 
                onChange={list.setQ} 
                placeholder="بحث بالعنوان، رقم المستند، التصنيف، أو الوسوم…" 
              />
            </div>
            <Select 
              value={f.projectId ?? ''} 
              onChange={(e) => list.setFilter('projectId', e.target.value)}
              style={{ minWidth: 160 }}
              aria-label="تصفية حسب المشروع"
            >
              <option value="">كل المشاريع</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.projectCode} — {p.projectName}</option>)}
            </Select>
            <Select 
              value={f.category ?? ''} 
              onChange={(e) => list.setFilter('category', e.target.value)}
              style={{ minWidth: 140 }}
              aria-label="تصفية حسب التصنيف"
            >
              <option value="">كل التصنيفات</option>
              {docCategories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </Select>
            <TextInput 
              type="date" 
              value={f.from ?? ''} 
              onChange={(e) => list.setFilter('from', e.target.value)} 
              title="من تاريخ" 
              aria-label="من تاريخ"
            />
            <TextInput 
              type="date" 
              value={f.to ?? ''} 
              onChange={(e) => list.setFilter('to', e.target.value)} 
              title="إلى تاريخ" 
              aria-label="إلى تاريخ"
            />
            {(list.state.q || Object.keys(list.state.filters).length > 0) && (
              <button className="btn btn--ghost" onClick={list.clearFilters}>مسح الفلاتر</button>
            )}
          </div>
        </div>

        <div className="archiveContent">
          {/* Desktop Table */}
          <div className="archiveTableDesktop">
            <DataTable
              rowProps={(row) => ({ draggable: true, onDragStart: (e) => e.dataTransfer.setData('text/plain', row.id) })}
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
                  {can('archive.edit') && (
                    <button type="button" className="iconBtn iconBtn--hover" title="تعديل" aria-label="تعديل" onClick={() => openEdit(row)}>
                      <IconEdit size={15} />
                    </button>
                  )}
                  {can('archive.delete') && (
                    <button type="button" className="iconBtn iconBtn--hover iconBtn--danger" title="حذف" aria-label="حذف" onClick={() => setDeleteTarget(row)}>
                      <IconTrash size={15} />
                    </button>
                  )}
                  {can('archive.edit') && (
                    <>
                      <button className="iconBtn iconBtn--hover" title="إدارة الروابط" onClick={() => setLinksDoc(row)} aria-label="إدارة الروابط">
                        <IconLink size={15} />
                      </button>
                      <button className="iconBtn iconBtn--hover" title="استبدال الملف" onClick={() => { setReplaceTarget(row); replaceInput.current?.click(); }} aria-label="استبدال الملف">
                        <IconReplace size={15} />
                      </button>
                    </>
                  )}
                </>
              )}
            />
          </div>

          {/* Mobile Document Cards */}
          <div className="docGrid">
            {(list.data?.items ?? []).map((doc) => (
              <article key={doc.id} className="docCard">
                <div className="docCard__top">
                  <div className="docCard__identity">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.includes(doc.id)} 
                      onChange={() => toggleSelect(doc.id)} 
                      aria-label={`تحديد ${doc.title}`}
                      style={{ marginTop: 3 }}
                    />
                    <IconFile kind={fileIconKind(doc.fileExtension)} size={22} />
                    <div>
                      <h3 className="docCard__title">{doc.title}</h3>
                      <div className="docCard__tags">
                        <Badge tone="blue">{doc.category}</Badge>
                        <Badge tone={STATUS_TONE[doc.status] || 'gray'}>{STATUS_AR[doc.status] ?? doc.status}</Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="docCard__meta">
                  <div className="docCard__metaItem">
                    <span className="docCard__metaLabel">رقم المستند</span>
                    <span className="docCard__metaValue num">{doc.documentNumber || '—'}</span>
                  </div>
                  <div className="docCard__metaItem">
                    <span className="docCard__metaLabel">الإصدار</span>
                    <button className="linkBtn num" onClick={() => openRevisions(doc)} style={{ textAlign: 'start' }}>
                      {doc.revision || '00'}
                    </button>
                  </div>
                  <div className="docCard__metaItem">
                    <span className="docCard__metaLabel">التاريخ</span>
                    <span className="docCard__metaValue num">
                      {doc.documentDate ? new Date(doc.documentDate).toLocaleDateString('ar-EG') : '—'}
                    </span>
                  </div>
                  <div className="docCard__metaItem">
                    <span className="docCard__metaLabel">الملف</span>
                    <span className="docCard__metaValue text-muted" style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.fileName}
                    </span>
                  </div>
                </div>

                <div className="docCard__actions">
                  <PreviewDocButton small documentId={doc.id} fileName={doc.fileName} />
                  {can('archive.download') && (
                    <DownloadDocButton small documentId={doc.id} fileName={doc.fileName} />
                  )}
                  {can('archive.edit') && (
                    <button className="btn btn--sm btn--ghost" onClick={() => openEdit(doc)}>
                      تعديل
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Floating Batch Action Bar */}
        {selectedCount > 0 && (
          <div className="archiveBatchBar" role="region" aria-label="الإجراءات المجمعة">
            <span className="archiveBatchBar__count">
              تم تحديد <b className="num">{selectedCount}</b> مستند
            </span>
            {can('archive.download') && (
              <button 
                className="btn btn--primary btn--sm" 
                onClick={() => void handleDownloadZip()} 
                disabled={isExportingZip}
              >
                <IconDownload size={14} /> {isExportingZip ? 'جارٍ التحميل…' : 'تحميل ZIP'}
              </button>
            )}
            <button className="btn btn--ghost btn--sm" onClick={() => setSelectedIds([])}>
              إلغاء التحديد
            </button>
          </div>
        )}
      </main>

      <input
        ref={replaceInput}
        type="file"
        hidden
        onChange={(e) => { const file2 = e.target.files?.[0]; if (file2 && replaceTarget) void doReplace(file2); e.target.value = ''; }}
      />

      {/* Modern Revisions Modal */}
      <Modal title={`إصدارات المستند: ${revisionsDoc?.title ?? ''}`} open={!!revisionsDoc} onClose={() => setRevisionsDoc(null)} wide>
        <div className="stack">
          {revisions.length === 0 ? (
            <p className="muted text-center" style={{ padding: 24 }}>لا توجد إصدارات مسجلة</p>
          ) : (
            <div className="revisionsTimeline">
              {revisions.map((r) => {
                const isCurrent = r.revision === revisionsDoc?.revision;
                return (
                  <div key={r.id} className={`revisionItem ${isCurrent ? 'current' : ''}`}>
                    <Badge tone={isCurrent ? 'green' : 'gray'}>
                      {isCurrent ? 'الحالي' : ''} {r.revision}
                    </Badge>
                    <div className="revisionItem__meta">
                      <strong>{r.fileName}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>
                        <span>رفع بواسطة: {r.uploadedBy ?? '—'}</span> &bull; 
                        <span className="num" style={{ marginInlineStart: 4 }}>
                          {new Date(r.uploadedAt).toLocaleDateString('ar-EG')}
                        </span>
                      </div>
                      {r.notes ? <p className="muted" style={{ fontSize: 12, margin: '4px 0 0 0' }}>{r.notes}</p> : null}
                    </div>
                    {revisionsDoc ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <PreviewDocButton small documentId={revisionsDoc.id} fileName={r.fileName} revision={r.id} />
                        {can('archive.download') && (
                          <DownloadDocButton small documentId={revisionsDoc.id} fileName={r.fileName} revision={r.id} />
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          {can('archive.edit') && (
            <div>
              <input
                type="file"
                hidden
                ref={revisionInput}
                onChange={(e) => { const file2 = e.target.files?.[0]; if (file2) void uploadRevision(file2); e.target.value = ''; }}
              />
              <button className="btn btn--primary" onClick={() => revisionInput.current?.click()}>+ رفع إصدار جديد</button>
            </div>
          )}
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

      <SmartImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={() => void list.reload()}
      />

      <QuickUploadModal
        open={quickUploadOpen}
        onClose={() => setQuickUploadOpen(false)}
        onSuccess={() => void list.reload()}
        defaultFolderId={f.folderId ?? null}
      />

      <DocumentLinksModal
        open={!!linksDoc}
        onClose={() => setLinksDoc(null)}
        document={linksDoc}
        projects={projects}
        onSuccess={() => {
          setLinksDoc(null);
          void list.reload();
        }}
      />
    </div>
  );
};


