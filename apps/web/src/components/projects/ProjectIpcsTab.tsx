import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import type { Ipc, BoqItem, IpcItem } from '@cos/shared';
import { EmptyState, Badge } from '../ui';
import { Can } from '../../context/AuthContext';

export const ProjectIpcsTab = ({ projectId }: { projectId: string }) => {
  const [ipcs, setIpcs] = useState<Ipc[]>([]);
  const [boq, setBoq] = useState<BoqItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [viewingIpc, setViewingIpc] = useState<Ipc & { items: IpcItem[] } | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<Ipc[]>(`/api/projects/${projectId}/ipcs`),
      api.get<BoqItem[]>(`/api/projects/${projectId}/boq`)
    ]).then(([ipcRes, boqRes]) => {
      setIpcs(ipcRes);
      setBoq(boqRes);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [projectId]);

  const handleCreate = async () => {
    // Basic auto-create draft
    try {
      const nextNumber = ipcs.length > 0 ? Math.max(...ipcs.map(i => i.ipcNumber)) + 1 : 1;
      const res = await api.post<Ipc>(`/api/projects/${projectId}/ipcs`, {
        ipcNumber: nextNumber,
        date: new Date().toISOString().split('T')[0],
        status: 'draft',
        items: [] // Empty init
      });
      load();
      handleView(res.id);
    } catch (err: any) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المستخلص؟ لا يمكن حذف المستخلصات المعتمدة أو المقدمة.')) return;
    try {
      await api.del(`/api/projects/${projectId}/ipcs/${id}`);
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleView = async (id: string) => {
    const res = await api.get<Ipc & { items: IpcItem[] }>(`/api/projects/${projectId}/ipcs/${id}`);
    setViewingIpc(res);
    setIsAdding(false);
  };

  const handleSaveIpc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingIpc) return;
    try {
      await api.put(`/api/projects/${projectId}/ipcs/${viewingIpc.id}`, {
        ipcNumber: viewingIpc.ipcNumber,
        date: viewingIpc.date,
        status: viewingIpc.status,
        notes: viewingIpc.notes,
        items: viewingIpc.items
      });
      setViewingIpc(null);
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const updateItemCurrentQty = (boqId: string, currentQty: number) => {
    if (!viewingIpc) return;
    const items = [...viewingIpc.items];
    const idx = items.findIndex(i => i.boqItemId === boqId);
    if (idx >= 0) {
      items[idx].currentQuantity = currentQty;
    } else {
      items.push({
        id: '', ipcId: viewingIpc.id, boqItemId: boqId,
        previousQuantity: 0, currentQuantity: currentQty, totalQuantity: 0,
        createdAt: '', updatedAt: ''
      });
    }
    setViewingIpc({ ...viewingIpc, items });
  };

  if (loading) return <div>جاري التحميل...</div>;

  if (viewingIpc) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3>مستخلص رقم {viewingIpc.ipcNumber}</h3>
          <button className="btn btn--ghost" onClick={() => setViewingIpc(null)}>رجوع</button>
        </div>
        <form onSubmit={handleSaveIpc} className="card">
          <div className="formGrid" style={{ marginBottom: 20 }}>
            <div>
              <label>رقم المستخلص</label>
              <input type="number" required value={viewingIpc.ipcNumber} onChange={e => setViewingIpc({...viewingIpc, ipcNumber: parseInt(e.target.value)})} />
            </div>
            <div>
              <label>التاريخ</label>
              <input type="date" required value={viewingIpc.date} onChange={e => setViewingIpc({...viewingIpc, date: e.target.value})} />
            </div>
            <div>
              <label>الخصومات</label>
              <input type="number" step="any" value={viewingIpc.deductions || ''} onChange={e => setViewingIpc({...viewingIpc, deductions: parseFloat(e.target.value) || 0})} />
            </div>
            <div>
              <label>الحالة</label>
              <select value={viewingIpc.status} onChange={e => setViewingIpc({...viewingIpc, status: e.target.value as any})}>
                <option value="draft">مسودة</option>
                <option value="submitted">مقدم</option>
                <option value="approved">معتمد</option>
                <option value="rejected">مرفوض</option>
              </select>
            </div>
          </div>
          
          <div className="tableWrap" style={{ marginBottom: 20 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>البند</th>
                  <th>الفئة</th>
                  <th>الكمية بالمقايسة</th>
                  <th>كمية سابقة</th>
                  <th>كمية حالية</th>
                  <th>إجمالي المنفذ</th>
                  <th>إجمالي القيمة</th>
                </tr>
              </thead>
              <tbody>
                {boq.map(b => {
                  const it = viewingIpc.items.find(i => i.boqItemId === b.id);
                  const currentQty = it?.currentQuantity || 0;
                  // To simplify UI without recalculating previous from scratch, we use the server's previousQuantity if exists.
                  // But note: if the user edits previous IPCs, previousQuantity needs recalc on save.
                  const prevQty = it?.previousQuantity || 0;
                  const total = currentQty + prevQty;
                  const value = total * b.unitPrice;
                  
                  return (
                    <tr key={b.id}>
                      <td>{b.itemCode} - {b.description}</td>
                      <td>{b.unitPrice}</td>
                      <td>{b.quantity} {b.unit}</td>
                      <td>{prevQty}</td>
                      <td>
                        <input 
                          type="number" step="any" min="0" 
                          style={{ width: 80, padding: 4 }}
                          value={currentQty || ''}
                          onChange={e => updateItemCurrentQty(b.id, parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td>{total}</td>
                      <td>{value.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <button type="submit" className="btn btn--primary">حفظ المستخلص</button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Can perm="projects.edit">
          <button className="btn btn--primary" onClick={handleCreate}>إنشاء مستخلص جديد</button>
        </Can>
      </div>

      {ipcs.length === 0 ? (
        <EmptyState title="لا يوجد مستخلصات" />
      ) : (
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>رقم المستخلص</th>
                <th>التاريخ</th>
                <th>الحالة</th>
                <th>الصافي</th>
                <th style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {ipcs.map(ipc => (
                <tr key={ipc.id}>
                  <td>مستخلص جارى {ipc.ipcNumber}</td>
                  <td>{ipc.date}</td>
                  <td><Badge tone={ipc.status === 'approved' ? 'green' : ipc.status === 'submitted' ? 'blue' : 'gray'}>{ipc.status}</Badge></td>
                  <td>{ipc.netAmount?.toLocaleString() ?? 0}</td>
                  <td>
                    <button className="btn btn--sm btn--ghost" onClick={() => handleView(ipc.id)}>عرض</button>
                    {ipc.status === 'draft' ? (
                      <Can perm="projects.edit">
                        <button className="btn btn--sm btn--danger" style={{ marginRight: 4 }} onClick={() => handleDelete(ipc.id)}>حذف</button>
                      </Can>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
