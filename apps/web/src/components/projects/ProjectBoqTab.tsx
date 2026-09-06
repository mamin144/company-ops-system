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

  if (loading) return <div>جاري التحميل...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <strong>إجمالي المقايسة: {total.toLocaleString()} جنيه</strong>
        <Can perm="projects.edit">
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--ghost" onClick={() => void downloadDocument(`/api/projects/${projectId}/boq/export/xlsx`, 'boq.xlsx')}>تصدير Excel</button>
            <button className="btn btn--ghost" onClick={() => setImportOpen(true)}>استيراد Excel</button>
            <button className="btn btn--primary" onClick={() => { resetForm(); setIsAdding(!isAdding); }}>
              {isAdding ? 'إلغاء' : 'إضافة بند'}
            </button>
          </div>
        </Can>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="card" style={{ marginBottom: 16 }}>
          {error && <div className="alert alert--danger">{error}</div>}
          <div className="formGrid">
            <div>
              <label>رقم البند</label>
              <input required value={newItem.itemCode} onChange={e => setNewItem({...newItem, itemCode: e.target.value})} />
            </div>
            <div>
              <label>الوحدة</label>
              <input required value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})} />
            </div>
            <div>
              <label>الكمية</label>
              <input type="number" step="any" required min="0" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: parseFloat(e.target.value)})} />
            </div>
            <div>
              <label>الفئة (سعر الوحدة)</label>
              <input type="number" step="any" required min="0" value={newItem.unitPrice} onChange={e => setNewItem({...newItem, unitPrice: parseFloat(e.target.value)})} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label>بيان الأعمال / الوصف</label>
            <textarea required rows={2} value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} />
          </div>
          <button type="submit" className="btn btn--primary" style={{ marginTop: 12 }}>{editingId ? 'حفظ التعديل' : 'حفظ البند'}</button>
        </form>
      )}

      {items.length === 0 ? (
        <EmptyState title="لا يوجد بنود مقايسة" />
      ) : (
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>رقم البند</th>
                <th>بيان الأعمال</th>
                <th>الوحدة</th>
                <th>الكمية</th>
                <th>الفئة</th>
                <th>الإجمالي</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{item.itemCode}</td>
                  <td>{item.description}</td>
                  <td>{item.unit}</td>
                  <td>{item.quantity.toLocaleString()}</td>
                  <td>{item.unitPrice.toLocaleString()}</td>
                  <td>{item.totalPrice.toLocaleString()}</td>
                  <td>
                    <Can perm="projects.edit">
                      <button className="iconBtn" title="تعديل" onClick={() => openEdit(item)}>✎</button>
                      <button className="iconBtn" style={{ color: 'var(--danger)' }} title="حذف" onClick={() => handleDelete(item.id)}>×</button>
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
