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

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<Ipc[]>(`/api/projects/${projectId}/ipcs`),
      api.get<BoqItem[]>(`/api/projects/${projectId}/boq`),
    ]).then(([ipcRes, boqRes]) => {
      setIpcs(ipcRes);
      setBoq(boqRes);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [projectId]);

  const handleCreate = async () => {
    try {
      const nextNumber = ipcs.length > 0 ? Math.max(...ipcs.map(i => i.ipcNumber)) + 1 : 1;
      const res = await api.post<Ipc>(`/api/projects/${projectId}/ipcs`, {
        ipcNumber: nextNumber,
        date: new Date().toISOString().split('T')[0],
        status: 'draft',
        items: [],
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
        items: viewingIpc.items,
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
        id: '',
        ipcId: viewingIpc.id,
        boqItemId: boqId,
        previousQuantity: 0,
        currentQuantity: currentQty,
        totalQuantity: 0,
        createdAt: '',
        updatedAt: '',
      });
    }
    setViewingIpc({ ...viewingIpc, items });
  };

  if (loading) return <div className="card skeletonCard" style={{ height: 180 }} />;

  if (viewingIpc) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>مستخلص رقم {viewingIpc.ipcNumber}</h3>
          <button type="button" className="btn btn--ghost" onClick={() => setViewingIpc(null)}>
            ← رجوع لقائمة المستخلصات
          </button>
        </div>
        <form onSubmit={handleSaveIpc} className="card" style={{ padding: '20px' }}>
          <div className="formGrid" style={{ marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>رقم المستخلص *</label>
              <input className="textInput num" type="number" required value={viewingIpc.ipcNumber} onChange={e => setViewingIpc({...viewingIpc, ipcNumber: parseInt(e.target.value)})} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>التاريخ *</label>
              <input className="textInput num" type="date" required value={viewingIpc.date} onChange={e => setViewingIpc({...viewingIpc, date: e.target.value})} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>إجمالي الخصومات والاستقطاعات</label>
              <input className="textInput num" type="number" step="any" value={viewingIpc.deductions || ''} onChange={e => setViewingIpc({...viewingIpc, deductions: parseFloat(e.target.value) || 0})} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>حالة المستخلص</label>
              <select className="selectInput" value={viewingIpc.status} onChange={e => setViewingIpc({...viewingIpc, status: e.target.value as any})}>
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
                  <th style={{ width: '90px' }}>الفئة</th>
                  <th style={{ width: '110px' }}>الكمية بالتعاقد</th>
                  <th style={{ width: '90px' }}>كمية سابقة</th>
                  <th style={{ width: '100px' }}>كمية حالية</th>
                  <th style={{ width: '100px' }}>إجمالي المنفذ</th>
                  <th style={{ width: '120px' }}>إجمالي القيمة</th>
                </tr>
              </thead>
              <tbody>
                {boq.map(b => {
                  const it = viewingIpc.items.find(i => i.boqItemId === b.id);
                  const currentQty = it?.currentQuantity || 0;
                  const prevQty = it?.previousQuantity || 0;
                  const total = currentQty + prevQty;
                  const value = total * b.unitPrice;
                  
                  return (
                    <tr key={b.id}>
                      <td><strong className="num">{b.itemCode}</strong> - {b.description}</td>
                      <td className="num">{b.unitPrice.toLocaleString()}</td>
                      <td className="num">{b.quantity.toLocaleString()} {b.unit}</td>
                      <td className="num">{prevQty.toLocaleString()}</td>
                      <td>
                        <input 
                          type="number" step="any" min="0" 
                          className="textInput num"
                          style={{ width: '90px', padding: '4px 8px' }}
                          value={currentQty || ''}
                          onChange={e => updateItemCurrentQty(b.id, parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td><strong className="num">{total.toLocaleString()}</strong></td>
                      <td><strong className="num" style={{ color: 'var(--primary)' }}>{value.toLocaleString()}</strong></td>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>مستخلصات المشروع</h3>
        <Can perm="projects.edit">
          <button type="button" className="btn btn--primary" onClick={handleCreate}>
            إنشاء مستخلص جديد
          </button>
        </Can>
      </div>

      {ipcs.length === 0 ? (
        <EmptyState title="لا توجد مستخلصات" hint="اضغط على زر إنشاء مستخلص جديد لإصدار مستخلص أعمال جاري" />
      ) : (
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>المستخلص</th>
                <th>التاريخ</th>
                <th>الحالة</th>
                <th>الصافي (جنيه)</th>
                <th style={{ width: 120 }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {ipcs.map(ipc => (
                <tr key={ipc.id}>
                  <td><strong>مستخلص جاري {ipc.ipcNumber}</strong></td>
                  <td className="num">{ipc.date}</td>
                  <td>
                    <Badge tone={ipc.status === 'approved' ? 'green' : ipc.status === 'submitted' ? 'blue' : 'gray'}>
                      {{ draft: 'مسودة', submitted: 'مقدم', approved: 'معتمد', rejected: 'مرفوض' }[ipc.status] ?? ipc.status}
                    </Badge>
                  </td>
                  <td><strong className="num">{ipc.netAmount?.toLocaleString() ?? 0}</strong></td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button type="button" className="btn btn--sm btn--ghost" onClick={() => handleView(ipc.id)}>
                        عرض
                      </button>
                      {ipc.status === 'draft' ? (
                        <Can perm="projects.edit">
                          <button type="button" className="btn btn--sm btn--danger" onClick={() => handleDelete(ipc.id)}>
                            حذف
                          </button>
                        </Can>
                      ) : null}
                    </div>
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
