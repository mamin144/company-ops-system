import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Item, MaterialRequest, Warehouse } from '@cos/shared';
import { Badge, ConfirmDialog, Field, Modal, Select, TextArea, useToast } from '../components/ui';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { useAuth } from '../context/AuthContext';

const STATUS_AR: Record<string, string> = {
  draft: 'مسودة',
  submitted: 'مقدمة',
  approved: 'معتمدة',
  rejected: 'مرفوضة',
  'partially-issued': 'صرف جزئي',
  issued: 'تم الصرف',
  closed: 'مغلقة',
};

const STATUS_TONE: Record<string, string> = {
  draft: 'gray', submitted: 'blue', approved: 'green', rejected: 'red',
  'partially-issued': 'amber', issued: 'green', closed: 'gray',
};

interface LineDraft { itemId: string; requestedQty: string }

export const MaterialRequestsPage = () => {
  const { user, can } = useAuth();
  const toast = useToast();
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([{ itemId: '', requestedQty: '' }]);
  const [issueTarget, setIssueTarget] = useState<MaterialRequest | null>(null);
  const [issueLines, setIssueLines] = useState<LineDraft[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<MaterialRequest | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    void api.get<MaterialRequest[]>(`/api/material-requests${statusFilter ? `?status=${statusFilter}` : ''}`)
      .then(setRequests)
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    load();
    void api.get<{ items: Item[] }>('/api/items?pageSize=200').then((r) => setItems(Array.isArray(r.items) ? r.items : []));
    void api.get<{ items: Warehouse[] }>('/api/warehouses?pageSize=200').then((r) => setWarehouses(Array.isArray(r.items) ? r.items : []));
  }, [load]);

  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? id;

  const save = async () => {
    const payloadLines = lines
      .filter((l) => l.itemId && Number(l.requestedQty) > 0)
      .map((l) => ({ itemId: l.itemId, requestedQty: Number(l.requestedQty) }));
    if (!warehouseId || payloadLines.length === 0) {
      toast('error', 'اختر المخزن وأضف صنفاً واحداً على الأقل بكمية صحيحة');
      return;
    }
    try {
      await api.post('/api/material-requests', { warehouseId, items: payloadLines, notes });
      toast('success', 'تم إنشاء طلب المواد');
      setFormOpen(false);
      setLines([{ itemId: '', requestedQty: '' }]);
      setNotes('');
      setWarehouseId('');
      load();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'خطأ في الحفظ');
    }
  };

  const act = async (mr: MaterialRequest, action: 'submit' | 'approve' | 'reject') => {
    try {
      await api.post(`/api/material-requests/${mr.id}/${action}`, action === 'approve' ? { approve: action === 'approve' } : undefined);
      toast('success', action === 'submit' ? 'تم إرسال الطلب' : action === 'approve' ? 'تم اعتماد الطلب' : 'تم رفض الطلب');
      load();
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
  };

  const columns: Column<MaterialRequest>[] = [
    { key: 'number', label: 'رقم الطلب' },
    { key: 'status', label: 'الحالة', render: (m) => <Badge tone={(STATUS_TONE[m.status] as never) ?? 'gray'}>{STATUS_AR[m.status] ?? m.status}</Badge> },
    { key: 'requestedBy', label: 'مقدم الطلب' },
    { key: 'reviewedBy', label: 'المراجع' },
    {
      key: 'items',
      label: 'الأصناف',
      render: (m) => (
        <span className="small muted">
          {m.items.map((i) => `${itemName(i.itemId)} (${(i.issuedQty ?? 0)}/${i.requestedQty})`).join('، ')}
        </span>
      ),
    },
    { key: 'createdAt', label: 'التاريخ', render: (m) => new Date(m.createdAt).toLocaleDateString('ar-EG') },
  ];

  return (
    <div className="page">
      <div className="pageHead">
        <div><h1>طلبات المواد</h1><p>طلبات الصرف من المخازن للمراجعة والاعتماد</p></div>
        <div className="actions">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">كل الحالات</option>
            {Object.entries(STATUS_AR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          {can('materialRequests.create') ? (
            <button className="btn btn--primary" onClick={() => setFormOpen(true)}>+ طلب جديد</button>
          ) : null}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={loading && !requests ? null : { items: requests, total: requests.length, page: 1, pageSize: requests.length || 1 }}
        loading={loading}
        actions={(row) => (
          <div style={{ display: 'inline-flex', gap: 4 }}>
            {row.status === 'draft' && can('materialRequests.create') ? (
              <button className="btn btn--sm" onClick={() => act(row, 'submit')}>إرسال</button>
            ) : null}
            {row.status === 'submitted' && can('materialRequests.approve') ? (
              <>
                <button className="btn btn--sm btn--primary" onClick={() => act(row, 'approve')}>اعتماد</button>
                <button className="btn btn--sm btn--danger" onClick={() => act(row, 'reject')}>رفض</button>
              </>
            ) : null}
            {(row.status === 'approved' || row.status === 'partially-issued') && can('materialRequests.issue') ? (
              <button className="btn btn--sm" onClick={() => openIssue(row)}>صرف</button>
            ) : null}
            {row.status === 'draft' && can('materialRequests.create') ? (
              <button className="btn btn--sm btn--danger" onClick={() => setDeleteTarget(row)}>حذف</button>
            ) : null}
          </div>
        )}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        text={`هل تريد حذف طلب المواد "${deleteTarget?.number}"؟`}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal title="طلب مواد جديد" open={formOpen} onClose={() => setFormOpen(false)} wide>
        <div className="formGrid">
          <Field label="المخزن *">
            <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">اختر…</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </Select>
          </Field>
        </div>
        <div className="stack" style={{ marginTop: 14 }}>
          {lines.map((line, idx) => (
            <div className="filtersRow" key={idx}>
              <Select value={line.itemId} onChange={(e) => setLines(lines.map((l, i) => (i === idx ? { ...l, itemId: e.target.value } : l)))}>
                <option value="">اختر الصنف…</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.code} — {i.name}</option>)}
              </Select>
              <input
                className="input"
                type="number"
                min={1}
                placeholder="الكمية"
                value={line.requestedQty}
                onChange={(e) => setLines(lines.map((l, i) => (i === idx ? { ...l, requestedQty: e.target.value } : l)))}
              />
              {lines.length > 1 ? (
                <button className="iconBtn iconBtn--danger" onClick={() => setLines(lines.filter((_, i) => i !== idx))}>✕</button>
              ) : null}
            </div>
          ))}
          <button className="btn btn--ghost" onClick={() => setLines([...lines, { itemId: '', requestedQty: '' }])}>+ إضافة صنف</button>
          <TextArea placeholder="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="formActions">
          <button className="btn btn--primary" onClick={save}>حفظ كمسودة</button>
          <button className="btn btn--ghost" onClick={() => setFormOpen(false)}>إلغاء</button>
        </div>
      </Modal>

      <Modal title={`صرف من الطلب ${issueTarget?.number ?? ''}`} open={!!issueTarget} onClose={() => setIssueTarget(null)}>
        <div className="stack">
          {issueLines.map((line, idx) => (
            <div className="filtersRow" key={line.itemId}>
              <span style={{ minWidth: 140 }}>{itemName(line.itemId)}</span>
              <input
                className="input"
                type="number"
                min={0}
                value={line.requestedQty}
                onChange={(e) => setIssueLines(issueLines.map((l, i) => (i === idx ? { ...l, requestedQty: e.target.value } : l)))}
              />
            </div>
          ))}
          <p className="muted small">سيتم إنشاء حركة صرف مخزنية GOUT مرتبطة بالطلب والمشروع.</p>
        </div>
        <div className="formActions">
          <button className="btn btn--primary" onClick={doIssue}>تأكيد الصرف</button>
          <button className="btn btn--ghost" onClick={() => setIssueTarget(null)}>إلغاء</button>
        </div>
      </Modal>
    </div>
  );
};

