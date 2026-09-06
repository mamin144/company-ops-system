import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Item, Project, StockTransaction, Warehouse } from '@cos/shared';
import { usePagedList } from '../hooks/usePagedList';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { Badge, toneForKey, ConfirmDialog, Field, Modal, Select, TextArea, TextInput, SearchInput, useToast } from '../components/ui';
import { EditDeleteActions } from '../components/DataTable';
import { ImportExcelModal } from '../components/ImportExcelModal';
import { IconDownload, IconPlus, IconUpload } from '../components/Icons';
import { downloadDocument } from '../lib/api';

interface Overview {
  byWarehouse: Array<{ warehouse: Warehouse; items: Array<{ item: Item; quantity: number }> }>;
  totalByItem: Array<{ item: Item; quantity: number }>;
  lowStock: Array<{ item: Item; quantity: number }>;
  summaryByType: Record<string, number>;
}

const typeLabels: Record<string, string> = {
  IN: 'إدخال',
  OUT: 'صرف',
  TRANSFER: 'تحويل',
  ADJUSTMENT: 'تسوية',
  RETURN: 'مرتجع',
};

type FormState = {
  type: StockTransaction['type'];
  warehouseId: string;
  destinationWarehouseId: string;
  projectId: string;
  referenceNumber: string;
  date: string;
  notes: string;
  lines: Array<{ itemId: string; quantity: string; unitCost: string }>;
};

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = (): FormState => ({ type: 'IN', warehouseId: '', destinationWarehouseId: '', projectId: '', referenceNumber: '', date: today(), notes: '', lines: [{ itemId: '', quantity: '', unitCost: '' }] });

export const StockPage = () => {
  const [tab, setTab] = useState<'history' | 'overview' | 'low'>('history');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const list = usePagedList<StockTransaction>('/api/stock/transactions');
  const toast = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<StockTransaction | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const loadOverview = useCallback(() => {
    void api.get<Overview>('/api/stock/overview').then(setOverview);
  }, []);

  useEffect(() => {
    loadOverview();
    void api.get<{ items: Item[] }>('/api/items?pageSize=200').then((r) => setItems(Array.isArray(r.items) ? r.items : []));
    void api.get<{ items: Warehouse[] }>('/api/warehouses?pageSize=200').then((r) => setWarehouses(Array.isArray(r.items) ? r.items : []));
    void api.get<{ items: Project[] }>('/api/projects?pageSize=200').then((r) => setProjects(Array.isArray(r.items) ? r.items : []));
  }, [loadOverview]);

  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? id;
  const whName = (id?: string) => warehouses.find((w) => w.id === id)?.name ?? id ?? '';

  const save = async () => {
    try {
      const items = form.lines
        .filter((l) => l.itemId && Number(l.quantity) > 0)
        .map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity), unitCost: l.unitCost === '' ? undefined : Number(l.unitCost) }));
      if (items.length === 0) {
        toast('error', 'أضف صنفاً واحداً على الأقل بكمية صحيحة');
        return;
      }
      await api.post('/api/stock/transactions', {
        type: form.type,
        warehouseId: form.warehouseId,
        destinationWarehouseId: form.type === 'TRANSFER' ? form.destinationWarehouseId : '',
        projectId: form.projectId,
        referenceNumber: form.referenceNumber,
        date: form.date,
        notes: form.notes,
        items,
      });
      toast('success', 'تم تسجيل الحركة');
      setFormOpen(false);
      setForm(emptyForm());
      void list.reload();
      loadOverview();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'خطأ في الحفظ');
    }
  };

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.del(`/api/stock/transactions/${deleteTarget.id}`);
      toast('success', 'تم حذف الحركة');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'خطأ في الحذف');
    }
    setDeleteTarget(null);
    void list.reload();
    loadOverview();
  }, [deleteTarget, list, toast, loadOverview]);

  const f = list.state.filters;

  const columns: Column<StockTransaction & { lines?: string; number?: string }>[] = [
    { key: 'number', label: 'الرقم', render: (t) => t.number ?? '—' },
    { key: 'date', label: 'التاريخ', sortable: true },
    { key: 'type', label: 'النوع', render: (t) => <Badge tone={toneForKey(t.type)}>{typeLabels[t.type] ?? t.type}</Badge> },
    {
      key: 'lines',
      label: 'الأصناف والكميات',
      render: (t) => <span className="small muted">{(t as unknown as { lines?: string }).lines ?? itemName(t.itemId ?? '')}</span>,
    },
    { key: 'warehouseId', label: 'المخزن', render: (t) => whName(t.warehouseId) },
    { key: 'destinationWarehouseId', label: 'إلى مخزن', render: (t) => (t.type === 'TRANSFER' ? whName(t.destinationWarehouseId) : '') },
    { key: 'quantity', label: 'الكمية' },
    { key: 'unitCost', label: 'تكلفة الوحدة' },
    { key: 'referenceNumber', label: 'المرجع' },
  ];

  return (
    <div className="page">
      <div className="pageHead">
        <div><h1>المخزون</h1><p>حركة المخزون وأرصدة الأصناف</p></div>
        <div className="actions">
          <button className={`btn ${tab === 'history' ? 'btn--primary' : ''}`} onClick={() => setTab('history')}>سجل الحركات</button>
          <button className={`btn ${tab === 'overview' ? 'btn--primary' : ''}`} onClick={() => setTab('overview')}>الأرصدة</button>
          <button className={`btn ${tab === 'low' ? 'btn--primary' : ''}`} onClick={() => setTab('low')}>أصناف تحت الحد</button>
          <button className="btn btn--ghost" onClick={() => void downloadDocument('/api/stock/transactions/export/xlsx', 'stock-transactions.xlsx')}><IconDownload size={16} /> تصدير Excel</button>
          <button className="btn btn--ghost" onClick={() => setImportOpen(true)}><IconUpload size={16} /> استيراد Excel</button>
          <button className="btn btn--primary" onClick={() => setFormOpen(true)}><IconPlus size={16} /> حركة جديدة</button>
        </div>
      </div>

      {tab === 'history' ? (
        <>
          <div className="filtersRow">
            <Select value={f.type ?? ''} onChange={(e) => list.setFilter('type', e.target.value)}>
              <option value="">كل الأنواع</option>
              {Object.entries(typeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
            <Select value={f.itemId ?? ''} onChange={(e) => list.setFilter('itemId', e.target.value)}>
              <option value="">كل الأصناف</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.code} — {i.name}</option>)}
            </Select>
            <Select value={f.warehouseId ?? ''} onChange={(e) => list.setFilter('warehouseId', e.target.value)}>
              <option value="">كل المخازن</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </Select>
            <Select value={f.projectId ?? ''} onChange={(e) => list.setFilter('projectId', e.target.value)}>
              <option value="">كل المشاريع</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.projectCode}</option>)}
            </Select>
            <TextInput type="date" value={f.from ?? ''} onChange={(e) => list.setFilter('from', e.target.value)} title="من تاريخ" />
            <TextInput type="date" value={f.to ?? ''} onChange={(e) => list.setFilter('to', e.target.value)} title="إلى تاريخ" />
            <SearchInput value={list.state.q} onChange={list.setQ} />
            <button className="btn btn--ghost" onClick={list.clearFilters}>مسح الفلاتر</button>
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
              <EditDeleteActions onEdit={() => undefined} onDelete={() => setDeleteTarget(row)} />
            )}
          />
        </>
      ) : null}

      {tab === 'overview' && overview ? (
        <div className="stack">
          <div className="cards">
            {Object.entries(overview.summaryByType).map(([k, v]) => (
              <div className="card" key={k}>
                <div className="card__label">{typeLabels[k] ?? k}</div>
                <div className="card__value">{v}</div>
              </div>
            ))}
          </div>
          {overview.byWarehouse.map(({ warehouse, items: whItems }) => {
            const nonZero = whItems.filter((x) => x.quantity !== 0);
            return (
              <div className="tableWrap" key={warehouse.id}>
                <h3 className="whTitle">{warehouse.name} ({warehouse.code})</h3>
                <table className="table">
                  <thead><tr><th>الكود</th><th>الصنف</th><th>الوحدة</th><th>الرصيد</th></tr></thead>
                  <tbody>
                    {nonZero.length === 0
                      ? <tr><td colSpan={4} className="empty">لا توجد أرصدة</td></tr>
                      : nonZero.map(({ item, quantity }) => (
                        <tr key={item.id}><td>{item.code}</td><td>{item.name}</td><td>{item.unit}</td><td>{quantity}</td></tr>
                      ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      ) : null}

      {tab === 'low' && overview ? (
        <div className="tableWrap">
          <table className="table">
            <thead><tr><th>الكود</th><th>الصنف</th><th>الرصيد الحالي</th><th>حد الأمان</th></tr></thead>
            <tbody>
              {overview.lowStock.length === 0
                ? <tr><td colSpan={4} className="empty">لا توجد أصناف تحت حد الأمان</td></tr>
                : overview.lowStock.map(({ item, quantity }) => (
                  <tr key={item.id}><td>{item.code}</td><td>{item.name}</td><td className="dangerText">{quantity}</td><td>{item.minimumStock}</td></tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Modal title="حركة مخزنية جديدة" open={formOpen} onClose={() => setFormOpen(false)} wide>
        <div className="formGrid">
          <Field label="نوع الحركة *">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as FormState['type'] })}>
              {Object.entries(typeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label={form.type === 'TRANSFER' ? 'من مخزن *' : 'المخزن *'}>
            <Select value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}>
              <option value="">اختر…</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </Select>
          </Field>
          {form.type === 'TRANSFER' ? (
            <Field label="إلى مخزن *">
              <Select value={form.destinationWarehouseId} onChange={(e) => setForm({ ...form, destinationWarehouseId: e.target.value })}>
                <option value="">اختر…</option>
                {warehouses.filter((w) => w.id !== form.warehouseId).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </Select>
            </Field>
          ) : null}
          <Field label="المشروع (للصرف)">
            <Select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
              <option value="">— بدون —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.projectCode} — {p.projectName}</option>)}
            </Select>
          </Field>
          <Field label="رقم المرجع"><TextInput value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} /></Field>
          <Field label="التاريخ *"><TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        </div>

        <div className="stack" style={{ marginTop: 14 }}>
          <strong className="small">الأصناف *</strong>
          {form.lines.map((line, idx) => (
            <div className="filtersRow" key={idx} style={{ marginBottom: 0 }}>
              <Select
                style={{ flex: 2 }}
                value={line.itemId}
                onChange={(e) => setForm({ ...form, lines: form.lines.map((l, i) => (i === idx ? { ...l, itemId: e.target.value } : l)) })}
              >
                <option value="">اختر الصنف…</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.code} — {i.name}</option>)}
              </Select>
              <input
                className="input"
                type="number"
                min={0}
                step="any"
                placeholder="الكمية"
                value={line.quantity}
                onChange={(e) => setForm({ ...form, lines: form.lines.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l)) })}
              />
              <input
                className="input"
                type="number"
                min={0}
                step="any"
                placeholder="تكلفة الوحدة"
                value={line.unitCost}
                onChange={(e) => setForm({ ...form, lines: form.lines.map((l, i) => (i === idx ? { ...l, unitCost: e.target.value } : l)) })}
              />
              {form.lines.length > 1 ? (
                <button className="iconBtn iconBtn--danger" onClick={() => setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) })}>✕</button>
              ) : null}
            </div>
          ))}
          <button className="btn btn--ghost" onClick={() => setForm({ ...form, lines: [...form.lines, { itemId: '', quantity: '', unitCost: '' }] })}>
            + إضافة صنف آخر (حركة متعددة الأصناف)
          </button>
          <TextArea placeholder="ملاحظات" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="formActions">
          <button className="btn btn--primary" onClick={save}>حفظ</button>
          <button className="btn" onClick={() => setFormOpen(false)}>إلغاء</button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        text="هل تريد حذف هذه الحركة المخزنية؟"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ImportExcelModal
        entity="transactions"
        title="الحركات المخزنية"
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={() => { void list.reload(); loadOverview(); }}
      />
    </div>
  );
};


