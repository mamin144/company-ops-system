import { useState, useEffect } from 'react';
import { api, downloadDocument } from '../../lib/api';
import type { BoqItem } from '@cos/shared';
import { EmptyState } from '../ui';
import { ImportExcelModal } from '../ImportExcelModal';
import { Can } from '../../context/AuthContext';

export const ProjectBoqTab = ({ projectId }: { projectId: string }) => {
  const [items, setItems] = useState<BoqItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [newItem, setNewItem] = useState({ itemCode: '', description: '', unit: '', quantity: 0, unitPrice: 0 });
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.get<BoqItem[]>(`/api/projects/${projectId}/boq`)
      .then(setItems)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [projectId]);

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setNewItem({ itemCode: '', description: '', unit: '', quantity: 0, unitPrice: 0 });
    setError('');
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        await api.put(`/api/projects/${projectId}/boq/${editingId}`, newItem);
      } else {
        await api.post(`/api/projects/${projectId}/boq`, newItem);
      }
      resetForm();
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const openEdit = (item: BoqItem) => {
    setEditingId(item.id);
    setNewItem({ itemCode: item.itemCode, description: item.description, unit: item.unit, quantity: item.quantity, unitPrice: item.unitPrice });
    setIsAdding(true);
    setError('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا البند؟')) return;
    try {
      await api.del(`/api/projects/${projectId}/boq/${id}`);
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const total = items.reduce((sum, item) => sum + item.totalPrice, 0);

  if (loading) return <div className="card skeletonCard" style={{ height: 180 }} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ fontSize: '15px' }}>
          إجمالي المقايسة: <strong className="num" style={{ color: 'var(--primary)', fontSize: '18px' }}>{total.toLocaleString()}</strong> جنيه
        </div>
        <Can perm="projects.edit">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn--ghost" onClick={() => void downloadDocument(`/api/projects/${projectId}/boq/export/xlsx`, 'boq.xlsx')}>
              تصدير Excel
            </button>
            <button className="btn btn--ghost" onClick={() => setImportOpen(true)}>
              استيراد Excel
            </button>
            <button className="btn btn--primary" onClick={() => { resetForm(); setIsAdding(!isAdding); }}>
              {isAdding ? 'إلغاء' : 'إضافة بند'}
            </button>
          </div>
        </Can>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="card" style={{ padding: '20px' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: '16px' }}>{editingId ? 'تعديل بند بالمقايسة' : 'إضافة بند جديد'}</h4>
          {error && <div className="alert alert--danger" style={{ marginBottom: '14px' }}>{error}</div>}
          <div className="formGrid">
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>رقم البند *</label>
              <input className="textInput" required value={newItem.itemCode} onChange={e => setNewItem({...newItem, itemCode: e.target.value})} placeholder="مثال: 1/1" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>الوحدة *</label>
              <input className="textInput" required value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})} placeholder="متر، م2، م3، عدد..." />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>الكمية *</label>
              <input className="textInput num" type="number" step="any" required min="0" value={newItem.quantity || ''} onChange={e => setNewItem({...newItem, quantity: parseFloat(e.target.value) || 0})} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>الفئة (سعر الوحدة) *</label>
              <input className="textInput num" type="number" step="any" required min="0" value={newItem.unitPrice || ''} onChange={e => setNewItem({...newItem, unitPrice: parseFloat(e.target.value) || 0})} />
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>بيان الأعمال / الوصف *</label>
            <textarea className="textInput" required rows={3} value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} placeholder="تفاصيل ومواصفات البند التعاقدي" />
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: '8px' }}>
            <button type="submit" className="btn btn--primary">{editingId ? 'حفظ التعديل' : 'حفظ البند'}</button>
            <button type="button" className="btn btn--ghost" onClick={resetForm}>إلغاء</button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <EmptyState title="لا توجد بنود مقايسة" hint="اضغط على زر إضافة بند أو استيراد Excel لإدراج مقايسة الأعمال" />
      ) : (
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '100px' }}>رقم البند</th>
                <th>بيان الأعمال</th>
                <th style={{ width: '80px' }}>الوحدة</th>
                <th style={{ width: '100px' }}>الكمية</th>
                <th style={{ width: '110px' }}>الفئة</th>
                <th style={{ width: '130px' }}>الإجمالي</th>
                <th style={{ width: '80px' }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td><strong className="num">{item.itemCode}</strong></td>
                  <td>{item.description}</td>
                  <td>{item.unit}</td>
                  <td className="num">{item.quantity.toLocaleString()}</td>
                  <td className="num">{item.unitPrice.toLocaleString()}</td>
                  <td><strong className="num">{item.totalPrice.toLocaleString()}</strong></td>
                  <td>
                    <Can perm="projects.edit">
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button type="button" className="iconBtn" title="تعديل" onClick={() => openEdit(item)}>✎</button>
                        <button type="button" className="iconBtn iconBtn--danger" title="حذف" onClick={() => handleDelete(item.id)}>×</button>
                      </div>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ImportExcelModal
        entity="boq"
        title="بنود المقايسة"
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={() => load()}
      />
    </div>
  );
};
