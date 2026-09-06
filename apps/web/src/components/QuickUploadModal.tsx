import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { Modal, Field, Select, TextInput, TextArea, useToast } from './ui';
import type { Project, CategoryOption, Ipc } from '@cos/shared';

interface QuickUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultProjectId?: string; // If provided from Financials, pre-select it
}

export const QuickUploadModal = ({ open, onClose, onSuccess, defaultProjectId }: QuickUploadModalProps) => {
  const toast = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [ipcs, setIpcs] = useState<Ipc[]>([]);
  const [loadingIpcs, setLoadingIpcs] = useState(false);
  
  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('عقد');
  const [ipcId, setIpcId] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      api.get<{ items: Project[] }>('/api/projects?pageSize=200')
         .then(r => setProjects(Array.isArray(r.items) ? r.items : []));
      setProjectId(defaultProjectId || '');
      setTitle('');
      setCategory('عقد');
      setIpcId('');
      setDocumentDate('');
      setNotes('');
      setFile(null);
    }
  }, [open, defaultProjectId]);

  useEffect(() => {
    if ((category === 'مستخلص' || category === 'استقطاع') && projectId) {
      setLoadingIpcs(true);
      api.get<Ipc[]>(`/api/projects/${projectId}/ipcs`)
         .then(setIpcs)
         .finally(() => setLoadingIpcs(false));
    } else {
      setIpcs([]);
      setIpcId('');
    }
  }, [category, projectId]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast('error', 'الرجاء اختيار ملف');
      return;
    }
    
    if (category !== 'ورق شركة' && !projectId) {
      toast('error', 'الرجاء اختيار المشروع');
      return;
    }
    if ((category === 'مستخلص' || category === 'استقطاع') && !ipcId) {
      toast('error', 'الرجاء اختيار المستخلص المرتبط');
      return;
    }

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title || file.name.split('.')[0]);
      fd.append('category', category);
      
      if (category !== 'ورق شركة') fd.append('projectId', projectId);
      if (ipcId) fd.append('ipcId', ipcId);
      if (documentDate) fd.append('documentDate', documentDate);
      if (notes) fd.append('notes', notes);
      
      await api.upload('/api/documents/upload', fd);
      toast('success', 'تم رفع المستند بنجاح');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast('error', err.response?.data?.message || err.message);
    }
  };

  const isCompanyPaper = category === 'ورق شركة';
  const needsIpc = category === 'مستخلص' || category === 'استقطاع';

  return (
    <Modal title="رفع مستند سريع" open={open} onClose={onClose}>
      <form onSubmit={save} className="formGrid">
        
        <Field label="نوع المستند *">
          <Select value={category} onChange={e => setCategory(e.target.value)}>
            {['عقد', 'مقايسة', 'مستخلص', 'استقطاع', 'خطاب', 'موافقات أمنية', 'محضر استلام', 'ضمان بنكي', 'ورق شركة', 'رسومات', 'تقارير', 'أخرى'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Field>

        {!isCompanyPaper && (
          <Field label="المشروع *">
            <Select value={projectId} onChange={e => setProjectId(e.target.value)} disabled={!!defaultProjectId}>
              <option value="">-- اختر المشروع --</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.projectName} ({p.projectCode})</option>
              ))}
            </Select>
          </Field>
        )}

        {needsIpc && projectId && (
          <Field label="رقم المستخلص المرتبط *">
            <Select value={ipcId} onChange={e => setIpcId(e.target.value)} disabled={loadingIpcs}>
              <option value="">-- اختر المستخلص --</option>
              {ipcs.map(i => (
                <option key={i.id} value={i.id}>جاري {i.ipcNumber}</option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="الملف *">
          <input type="file" ref={fileInput} onChange={e => setFile(e.target.files?.[0] || null)} required />
        </Field>
        
        <Field label="عنوان المستند">
          <TextInput value={title} onChange={e => setTitle(e.target.value)} placeholder="اختياري (يأخذ اسم الملف افتراضياً)" />
        </Field>

        <Field label="تاريخ المستند">
          <TextInput type="date" value={documentDate} onChange={e => setDocumentDate(e.target.value)} />
        </Field>

        <Field label="ملاحظات">
          <TextArea value={notes} onChange={e => setNotes(e.target.value)} />
        </Field>

        <div className="formActions" style={{ gridColumn: '1 / -1', marginTop: 16 }}>
          <button type="submit" className="btn btn--primary">رفع المستند</button>
          <button type="button" className="btn btn--ghost" onClick={onClose}>إلغاء</button>
        </div>
      </form>
    </Modal>
  );
};
