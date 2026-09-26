import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Item, MaterialRequest, Project, Site, Warehouse } from '@cos/shared';
import { Badge, ConfirmDialog, Field, Modal, Select, TextArea, SearchInput, useToast } from '../components/ui';
import type { BadgeTone } from '../components/ui';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { useAuth } from '../context/AuthContext';
import { IconPlus } from '../components/Icons';

const STATUS_AR: Record<string, string> = {
  draft: 'مسودة',
  submitted: 'مقدمة',
  approved: 'معتمدة',
  rejected: 'مرفوضة',
  'partially-issued': 'صرف جزئي',
  issued: 'تم الصرف',
  closed: 'مغلقة',
};

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: 'gray',
  submitted: 'blue',
  approved: 'green',
  rejected: 'red',
  'partially-issued': 'amber',
  issued: 'green',
  closed: 'gray',
};

interface LineDraft {
  itemId: string;
  requestedQty: string;
}

export const MaterialRequestsPage = () => {
  const { can } = useAuth();
  const toast = useToast();
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([{ itemId: '', requestedQty: '' }]);

  const [viewTarget, setViewTarget] = useState<MaterialRequest | null>(null);
  const [issueTarget, setIssueTarget] = useState<MaterialRequest | null>(null);
  const [issueLines, setIssueLines] = useState<LineDraft[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<MaterialRequest | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (projectFilter) params.set('projectId', projectFilter);
    const query = params.toString() ? `?${params.toString()}` : '';

    void api.get<MaterialRequest[]>(`/api/material-requests${query}`)
      .then(setRequests)
      .finally(() => setLoading(false));
  }, [statusFilter, projectFilter]);

  useEffect(() => {
    load();
    void api.get<{ items: Item[] }>('/api/items?pageSize=200').then((r) => setItems(Array.isArray(r.items) ? r.items : []));
    void api.get<{ items: Warehouse[] }>('/api/warehouses?pageSize=200').then((r) => setWarehouses(Array.isArray(r.items) ? r.items : []));
    void api.get<{ items: Project[] }>('/api/projects?pageSize=200').then((r) => setProjects(Array.isArray(r.items) ? r.items : []));
    void api.get<Site[]>('/api/sites').then((r) => setSites(Array.isArray(r) ? r : []));
  }, [load]);

  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? id;
  const itemUnit = (id: string) => items.find((i) => i.id === id)?.unit ?? '';
  const whName = (id?: string) => warehouses.find((w) => w.id === id)?.name ?? id ?? '—';
  const projName = (id?: string) => projects.find((p) => p.id === id)?.projectName ?? id ?? '—';

  const filteredRequests = requests.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.number.toLowerCase().includes(q) ||
      (r.requestedBy && r.requestedBy.toLowerCase().includes(q)) ||
      (r.notes && r.notes.toLowerCase().includes(q)) ||
      r.items.some((i) => itemName(i.itemId).toLowerCase().includes(q))
    );
  });

  const clearFilters = () => {
    setStatusFilter('');
    setProjectFilter('');
    setSearchQuery('');
  };

  const save = async () => {
    const payloadLines = lines
      .filter((l) => l.itemId && Number(l.requestedQty) > 0)
      .map((l) => ({ itemId: l.itemId, requestedQty: Number(l.requestedQty) }));
    if (!warehouseId || payloadLines.length === 0) {
      toast('error', 'اختر المخزن وأضف صنفاً واحداً على الأقل بكمية صحيحة');
      return;
    }
    try {
      await api.post('/api/material-requests', {
        warehouseId,
        projectId: projectId || undefined,
        siteId: siteId || undefined,
        items: payloadLines,
        notes: notes || undefined,
      });
      toast('success', 'تم إنشاء طلب المواد');
      setFormOpen(false);
      setLines([{ itemId: '', requestedQty: '' }]);
      setNotes('');
      setWarehouseId('');
      setProjectId('');
      setSiteId('');
      load();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'خطأ في الحفظ');
    }
  };

  const act = async (mr: MaterialRequest, action: 'submit' | 'approve' | 'reject') => {
    try {
      await api.post(
        `/api/material-requests/${mr.id}/${action}`,
        action === 'approve' ? { approve: true } : action === 'reject' ? { approve: false } : undefined,
      );
      toast('success', action === 'submit' ? 'تم إرسال الطلب' : action === 'approve' ? 'تم اعتماد الطلب' : 'تم رفض الطلب');
      load();
      if (viewTarget?.id === mr.id) setViewTarget(null);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'خطأ في العملية');
    }
  };

  const openIssue = (mr: MaterialRequest) => {
    setIssueTarget(mr);
    setIssueLines(
      mr.items
        .filter((i) => i.requestedQty - (i.issuedQty ?? 0) > 0)
        .map((i) => ({ itemId: i.itemId, requestedQty: String(i.requestedQty - (i.issuedQty ?? 0)) })),
    );
  };

  const doIssue = async () => {
    if (!issueTarget) return;
    const linesPayload = issueLines
      .filter((l) => Number(l.requestedQty) > 0)
      .map((l) => ({ itemId: l.itemId, quantity: Number(l.requestedQty) }));
    if (!linesPayload.length) return;
    try {
      await api.post(`/api/material-requests/${issueTarget.id}/issue`, { lines: linesPayload });
      toast('success', 'تم صرف الكميات وإنشاء حركة صرف مخزنية');
      setIssueTarget(null);
      load();
      if (viewTarget?.id === issueTarget.id) setViewTarget(null);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'فشل الصرف');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.del(`/api/material-requests/${deleteTarget.id}`);
      toast('success', 'تم حذف طلب المواد');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'خطأ في الحذف');
    }
    setDeleteTarget(null);
    load();
    if (viewTarget?.id === deleteTarget.id) setViewTarget(null);
  };

  const columns: Column<MaterialRequest>[] = [
    {
      key: 'number',
      label: 'رقم الطلب',
      sortable: true,
      render: (m) => (
        <button
          className="linkBtn mono num bold"
          onClick={() => setViewTarget(m)}
          title="عرض تفاصيل الطلب"
        >
          {m.number}
        </button>
      ),
    },
    {
      key: 'status',
      label: 'الحالة',
      render: (m) => (
        <Badge tone={STATUS_TONE[m.status] ?? 'gray'}>
          {STATUS_AR[m.status] ?? m.status}
        </Badge>
      ),
    },
    {
      key: 'projectId',
      label: 'المشروع',
      render: (m) => (m.projectId ? <span className="small">{projName(m.projectId)}</span> : <span className="muted">—</span>),
    },
    {
      key: 'warehouseId',
      label: 'المخزن',
      render: (m) => <span className="small">{whName(m.warehouseId)}</span>,
    },
    {
      key: 'requestedBy',
      label: 'مقدم الطلب',
      render: (m) => <span className="small muted">{m.requestedBy || '—'}</span>,
    },
    {
      key: 'items',
      label: 'الأصناف المصروفة / المطلوبة',
      render: (m) => (
        <span className="small muted">
          {m.items.map((i) => `${itemName(i.itemId)} (${i.issuedQty ?? 0}/${i.requestedQty})`).join('، ')}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'التاريخ',
      render: (m) => <span className="num small">{new Date(m.createdAt).toLocaleDateString('ar-EG')}</span>,
    },
  ];

  return (
    <div className="page">
      <div className="invHeader">
        <div className="invHeader__titleGroup">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1>طلبات المواد</h1>
              <span className="heroChip num">{requests.length} طلب</span>
            </div>
            <p>طلبات صرف المواد والمهمات من المخازن للمشاريع والمواقع</p>
          </div>
        </div>
        <div className="actions">
          {can('materialRequests.create') ? (
            <button className="btn btn--primary" onClick={() => setFormOpen(true)}>
              <IconPlus size={16} /> طلب جديد
            </button>
          ) : null}
        </div>
      </div>

      <div className="invToolbar">
        <Select
          aria-label="تصفية حسب الحالة"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_AR).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Select
          aria-label="تصفية حسب المشروع"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
        >
          <option value="">كل المشاريع</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.projectCode} — {p.projectName}
            </option>
          ))}
        </Select>
        <SearchInput
          aria-label="بحث في طلبات المواد"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="بحث برقم الطلب أو الصنف أو مقدم الطلب…"
        />
        <button className="btn btn--ghost" onClick={clearFilters}>
          مسح الفلاتر
        </button>
      </div>

      {/* Desktop View */}
      <div className="invTableDesktop">
        <DataTable
          columns={columns}
          data={
            loading && !requests
              ? null
              : {
                  items: filteredRequests,
                  total: filteredRequests.length,
                  page: 1,
                  pageSize: filteredRequests.length || 1,
                }
          }
          loading={loading}
          actions={(row) => (
            <div style={{ display: 'inline-flex', gap: 6 }}>
              <button
                className="btn btn--sm btn--ghost"
                onClick={() => setViewTarget(row)}
                title="عرض التفاصيل"
              >
                تفاصيل
              </button>
              {row.status === 'draft' && can('materialRequests.create') ? (
                <button
                  className="btn btn--sm"
                  onClick={() => act(row, 'submit')}
                >
                  إرسال
                </button>
              ) : null}
              {row.status === 'submitted' && can('materialRequests.approve') ? (
                <>
                  <button
                    className="btn btn--sm btn--primary"
                    onClick={() => act(row, 'approve')}
                  >
                    اعتماد
                  </button>
                  <button
                    className="btn btn--sm btn--danger"
                    onClick={() => act(row, 'reject')}
                  >
                    رفض
                  </button>
                </>
              ) : null}
              {(row.status === 'approved' || row.status === 'partially-issued') &&
              can('materialRequests.issue') ? (
                <button
                  className="btn btn--sm btn--primary"
                  onClick={() => openIssue(row)}
                >
                  صرف
                </button>
              ) : null}
              {row.status === 'draft' && can('materialRequests.create') ? (
                <button
                  className="btn btn--sm btn--danger"
                  onClick={() => setDeleteTarget(row)}
                >
                  حذف
                </button>
              ) : null}
            </div>
          )}
        />
      </div>

      {/* Responsive Mobile Cards View */}
      <div className="mrGrid">
        {filteredRequests.map((mr) => (
          <div className="mrCard" key={mr.id}>
            <div className="mrCard__top">
              <div className="mrCard__titleGroup">
                <button
                  className="linkBtn mrCard__number num"
                  onClick={() => setViewTarget(mr)}
                >
                  {mr.number}
                </button>
                <span className="small muted">
                  {new Date(mr.createdAt).toLocaleDateString('ar-EG')}
                </span>
              </div>
              <Badge tone={STATUS_TONE[mr.status] ?? 'gray'}>
                {STATUS_AR[mr.status] ?? mr.status}
              </Badge>
            </div>

            <div className="mrCard__meta">
              <div className="mrCard__metaItem">
                <span className="mrCard__metaLabel">المخزن</span>
                <span className="mrCard__metaValue">{whName(mr.warehouseId)}</span>
              </div>
              <div className="mrCard__metaItem">
                <span className="mrCard__metaLabel">المشروع</span>
                <span className="mrCard__metaValue">{projName(mr.projectId)}</span>
              </div>
              <div className="mrCard__metaItem">
                <span className="mrCard__metaLabel">مقدم الطلب</span>
                <span className="mrCard__metaValue">{mr.requestedBy || '—'}</span>
              </div>
              <div className="mrCard__metaItem">
                <span className="mrCard__metaLabel">المراجع</span>
                <span className="mrCard__metaValue">{mr.reviewedBy || '—'}</span>
              </div>
            </div>

            <div className="mrCard__itemsList">
              <strong>الأصناف: </strong>
              {mr.items
                .map((i) => `${itemName(i.itemId)} (${i.issuedQty ?? 0}/${i.requestedQty})`)
                .join('، ')}
            </div>

            <div className="mrCard__actions">
              <button
                className="btn btn--sm btn--ghost"
                onClick={() => setViewTarget(mr)}
              >
                التفاصيل
              </button>
              {mr.status === 'draft' && can('materialRequests.create') ? (
                <button className="btn btn--sm" onClick={() => act(mr, 'submit')}>
                  إرسال
                </button>
              ) : null}
              {mr.status === 'submitted' && can('materialRequests.approve') ? (
                <>
                  <button
                    className="btn btn--sm btn--primary"
                    onClick={() => act(mr, 'approve')}
                  >
                    اعتماد
                  </button>
                  <button
                    className="btn btn--sm btn--danger"
                    onClick={() => act(mr, 'reject')}
                  >
                    رفض
                  </button>
                </>
              ) : null}
              {(mr.status === 'approved' || mr.status === 'partially-issued') &&
              can('materialRequests.issue') ? (
                <button
                  className="btn btn--sm btn--primary"
                  onClick={() => openIssue(mr)}
                >
                  صرف
                </button>
              ) : null}
              {mr.status === 'draft' && can('materialRequests.create') ? (
                <button
                  className="btn btn--sm btn--danger"
                  onClick={() => setDeleteTarget(mr)}
                >
                  حذف
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Details View Modal */}
      <Modal
        title={`تفاصيل طلب المواد: ${viewTarget?.number ?? ''}`}
        open={!!viewTarget}
        onClose={() => setViewTarget(null)}
        wide
      >
        {viewTarget ? (
          <div>
            <div className="mrDetailsGrid">
              <div className="mrDetailsItem">
                <span className="mrDetailsItem__label">رقم الطلب</span>
                <span className="mrDetailsItem__value mono num">{viewTarget.number}</span>
              </div>
              <div className="mrDetailsItem">
                <span className="mrDetailsItem__label">الحالة</span>
                <div>
                  <Badge tone={STATUS_TONE[viewTarget.status] ?? 'gray'}>
                    {STATUS_AR[viewTarget.status] ?? viewTarget.status}
                  </Badge>
                </div>
              </div>
              <div className="mrDetailsItem">
                <span className="mrDetailsItem__label">المخزن المطلوب منه</span>
                <span className="mrDetailsItem__value">{whName(viewTarget.warehouseId)}</span>
              </div>
              <div className="mrDetailsItem">
                <span className="mrDetailsItem__label">المشروع</span>
                <span className="mrDetailsItem__value">{projName(viewTarget.projectId)}</span>
              </div>
              <div className="mrDetailsItem">
                <span className="mrDetailsItem__label">مقدم الطلب</span>
                <span className="mrDetailsItem__value">{viewTarget.requestedBy || '—'}</span>
              </div>
              <div className="mrDetailsItem">
                <span className="mrDetailsItem__label">المراجع</span>
                <span className="mrDetailsItem__value">{viewTarget.reviewedBy || '—'}</span>
              </div>
              <div className="mrDetailsItem">
                <span className="mrDetailsItem__label">تاريخ الإنشاء</span>
                <span className="mrDetailsItem__value num">
                  {new Date(viewTarget.createdAt).toLocaleString('ar-EG')}
                </span>
              </div>
            </div>

            {viewTarget.notes ? (
              <div style={{ marginBottom: 16 }}>
                <span className="small muted">ملاحظات الطلب:</span>
                <p style={{ margin: '4px 0 0', fontWeight: 500 }}>{viewTarget.notes}</p>
              </div>
            ) : null}

            {viewTarget.reviewNotes ? (
              <div style={{ marginBottom: 16, background: 'rgba(239, 68, 68, 0.05)', padding: 10, borderRadius: 6 }}>
                <span className="small dangerHighlight">ملاحظات المراجعة:</span>
                <p style={{ margin: '4px 0 0', fontWeight: 500 }}>{viewTarget.reviewNotes}</p>
              </div>
            ) : null}

            <h3 style={{ fontSize: 15, margin: '16px 0 10px' }}>الأصناف المطلوبة وحالة الصرف</h3>
            <div className="tableWrap" style={{ border: '1px solid var(--border)' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>كود الصنف</th>
                    <th>اسم الصنف</th>
                    <th>الوحدة</th>
                    <th>الكمية المطلوبة</th>
                    <th>الكمية المصروفة</th>
                    <th>المتبقي</th>
                  </tr>
                </thead>
                <tbody>
                  {viewTarget.items.map((line) => {
                    const it = items.find((x) => x.id === line.itemId);
                    const issued = line.issuedQty ?? 0;
                    const remaining = Math.max(0, line.requestedQty - issued);
                    return (
                      <tr key={line.itemId}>
                        <td className="mono num">{it?.code || '—'}</td>
                        <td className="bold">{it?.name || line.itemId}</td>
                        <td className="small muted">{it?.unit || '—'}</td>
                        <td className="num bold">{line.requestedQty}</td>
                        <td className="num" style={{ color: issued > 0 ? 'var(--primary)' : 'inherit' }}>
                          {issued}
                        </td>
                        <td className="num bold" style={{ color: remaining > 0 ? 'var(--amber)' : 'var(--success)' }}>
                          {remaining}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="formActions" style={{ marginTop: 20 }}>
              {viewTarget.status === 'draft' && can('materialRequests.create') ? (
                <button className="btn btn--primary" onClick={() => act(viewTarget, 'submit')}>
                  إرسال للمراجعة
                </button>
              ) : null}
              {viewTarget.status === 'submitted' && can('materialRequests.approve') ? (
                <>
                  <button className="btn btn--primary" onClick={() => act(viewTarget, 'approve')}>
                    اعتماد الطلب
                  </button>
                  <button className="btn btn--danger" onClick={() => act(viewTarget, 'reject')}>
                    رفض الطلب
                  </button>
                </>
              ) : null}
              {(viewTarget.status === 'approved' || viewTarget.status === 'partially-issued') &&
              can('materialRequests.issue') ? (
                <button className="btn btn--primary" onClick={() => openIssue(viewTarget)}>
                  صرف من المخزن
                </button>
              ) : null}
              <button className="btn btn--ghost" onClick={() => setViewTarget(null)}>
                إغلاق
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        text={`هل تريد حذف طلب المواد "${deleteTarget?.number}"؟ لا يمكن التراجع عن هذه العملية.`}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Create Request Modal */}
      <Modal
        title="طلب مواد جديد"
        open={formOpen}
        onClose={() => setFormOpen(false)}
        wide
      >
        <div className="formGrid">
          <Field label="المخزن المطلوب منه *">
            <Select
              aria-label="المخزن المطلوب منه"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              <option value="">اختر المخزن…</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="المشروع (اختياري)">
            <Select
              aria-label="المشروع"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">— بدون مشروع محدد —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectCode} — {p.projectName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="الموقع (اختياري)">
            <Select
              aria-label="الموقع"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
            >
              <option value="">— بدون موقع —</option>
              {sites
                .filter((s) => !projectId || s.projectId === projectId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
          </Field>
        </div>

        <div className="stack" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <strong className="small">الأصناف والكميات المطلوبة *</strong>
            <span className="small muted">{lines.length} صنف</span>
          </div>

          {lines.map((line, idx) => (
            <div className="filtersRow" key={idx} style={{ marginBottom: 0 }}>
              <Select
                aria-label={`اختيار الصنف ${idx + 1}`}
                style={{ flex: 3 }}
                value={line.itemId}
                onChange={(e) =>
                  setLines(lines.map((l, i) => (i === idx ? { ...l, itemId: e.target.value } : l)))
                }
              >
                <option value="">اختر الصنف…</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.code} — {i.name} {i.unit ? `(${i.unit})` : ''}
                  </option>
                ))}
              </Select>
              <input
                aria-label={`الكمية للصنف ${idx + 1}`}
                className="input num"
                type="number"
                min={1}
                step="any"
                placeholder="الكمية المطلوبة"
                style={{ flex: 1 }}
                value={line.requestedQty}
                onChange={(e) =>
                  setLines(lines.map((l, i) => (i === idx ? { ...l, requestedQty: e.target.value } : l)))
                }
              />
              <span className="small muted" style={{ minWidth: 40 }}>
                {itemUnit(line.itemId)}
              </span>
              {lines.length > 1 ? (
                <button
                  type="button"
                  aria-label={`حذف الصنف ${idx + 1}`}
                  className="iconBtn iconBtn--danger"
                  onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                >
                  ✕
                </button>
              ) : null}
            </div>
          ))}

          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setLines([...lines, { itemId: '', requestedQty: '' }])}
          >
            + إضافة صنف آخر للطلب
          </button>

          <Field label="ملاحظات أو مبررات الطلب">
            <TextArea
              aria-label="ملاحظات الطلب"
              placeholder="اكتب أية ملاحظات توضيحية حول الغرض من طلب المواد…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>

        <div className="formActions">
          <button className="btn btn--primary" onClick={save}>
            حفظ الطلب كمسودة
          </button>
          <button className="btn btn--ghost" onClick={() => setFormOpen(false)}>
            إلغاء
          </button>
        </div>
      </Modal>

      {/* Stock Issue Modal */}
      <Modal
        title={`صرف مواد من الطلب ${issueTarget?.number ?? ''}`}
        open={!!issueTarget}
        onClose={() => setIssueTarget(null)}
      >
        <div className="stack">
          <p className="small muted">
            المخزن: <strong>{whName(issueTarget?.warehouseId)}</strong> — حدد الكميات الفعلية المراد صرفها الآن:
          </p>
          {issueLines.map((line, idx) => (
            <div className="filtersRow" key={line.itemId} style={{ marginBottom: 0 }}>
              <span style={{ minWidth: 160, fontWeight: 600 }}>{itemName(line.itemId)}</span>
              <input
                aria-label={`الكمية المصروفة من ${itemName(line.itemId)}`}
                className="input num"
                type="number"
                min={0}
                value={line.requestedQty}
                onChange={(e) =>
                  setIssueLines(
                    issueLines.map((l, i) => (i === idx ? { ...l, requestedQty: e.target.value } : l)),
                  )
                }
              />
              <span className="small muted">{itemUnit(line.itemId)}</span>
            </div>
          ))}
          <p className="small muted" style={{ background: 'var(--surface-2)', padding: 8, borderRadius: 4 }}>
            سيتم إنشاء حركة صرف مخزنية معتمدة من نوع OUT مرتبطة بهذا الطلب.
          </p>
        </div>
        <div className="formActions">
          <button className="btn btn--primary" onClick={doIssue}>
            تأكيد الصرف
          </button>
          <button className="btn btn--ghost" onClick={() => setIssueTarget(null)}>
            إلغاء
          </button>
        </div>
      </Modal>
    </div>
  );
};
