import { useState } from 'react';
import { api } from '../lib/api';
import { Modal, Field, Select, useToast } from './ui';

interface FieldMapping {
  excelHeader: string;
  normalizedHeader: string;
  systemField: string | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  status: 'matched' | 'needs-review' | 'extra';
  sampleValues: string[];
}
interface AnalyzeResult {
  sheetNames: string[];
  selectedSheet: string;
  totalRows: number;
  mapping: {
    mappings: FieldMapping[];
    missingRequired: string[];
    missingOptional: string[];
    extraColumns: string[];
  };
  sampleRows: any[];
}
interface PreviewResult {
  validRows: any[];
  invalidRows: Array<{ rowNumber: number; errors: string[]; row: any }>;
  warnings: Array<{ rowNumber: number; warnings: string[] }>;
  duplicates: Array<{ rowIndex: number; existingDocument: any; matchedOn: string }>;
  totalRows: number;
}

const SYSTEM_FIELDS = [
  { value: 'title', label: 'العنوان (Title)' },
  { value: 'documentNumber', label: 'رقم المستند (Doc Number)' },
  { value: 'category', label: 'التصنيف (Category)' },
  { value: 'documentType', label: 'النوع (Type)' },
  { value: 'revision', label: 'الإصدار (Revision)' },
  { value: 'documentDate', label: 'تاريخ المستند (Date)' },
  { value: 'uploadedBy', label: 'رفع بواسطة (Uploaded By)' },
  { value: 'notes', label: 'ملاحظات (Notes)' },
  { value: 'tags', label: 'وسوم (Tags)' }
];

export const SmartImportModal = ({ open, onClose, onDone }: { open: boolean, onClose: () => void, onDone: () => void }) => {
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [sheetName, setSheetName] = useState<string>('');
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
  const [mappingState, setMappingState] = useState<FieldMapping[]>([]);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async (selectedFile: File, selectedSheet?: string) => {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      if (selectedSheet) fd.append('sheetName', selectedSheet);
      
      const res = await api.upload<AnalyzeResult>('/api/import/smart/analyze', fd);
      setAnalyzeResult(res);
      setMappingState(res.mapping.mappings);
      setSheetName(res.selectedSheet);
      setStep(2);
    } catch (e: any) {
      toast('error', e.message || 'Error analyzing file');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('sheetName', sheetName);
      
      mappingState.forEach((m, i) => {
        fd.append(`mapping[${i}][excelHeader]`, m.excelHeader);
        fd.append(`mapping[${i}][systemField]`, m.systemField || '');
      });
      
      const res = await api.upload<PreviewResult>('/api/import/smart/preview', fd);
      setPreviewResult(res);
      setStep(3);
    } catch (e: any) {
      toast('error', e.message || 'Error previewing');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!previewResult) return;
    setLoading(true);
    try {
      await api.post('/api/import/smart/confirm', {
        rows: previewResult.validRows,
        duplicateIndices: previewResult.duplicates.map(d => d.rowIndex)
      });
      toast('success', 'تم الاستيراد بنجاح');
      onDone();
      handleClose();
    } catch (e: any) {
      toast('error', e.message || 'Error confirming import');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setFile(null);
    setAnalyzeResult(null);
    setMappingState([]);
    setPreviewResult(null);
    onClose();
  };

  return (
    <Modal title="استيراد ذكي (Excel)" open={open} onClose={handleClose} wide>
      <div className="stack">
        {step === 1 && (
          <div>
            <h3>الخطوة 1: اختيار الملف</h3>
            <Field label="ملف Excel">
              <input 
                type="file" 
                accept=".xlsx,.xls,.csv" 
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile(f);
                    void handleAnalyze(f);
                  }
                }} 
                disabled={loading}
              />
            </Field>
          </div>
        )}

        {step === 2 && analyzeResult && (
          <div>
            <h3>الخطوة 2: مراجعة مطابقة الأعمدة</h3>
            {analyzeResult.sheetNames.length > 1 && (
              <Field label="ورقة العمل">
                <Select 
                  value={sheetName} 
                  onChange={(e) => void handleAnalyze(file!, e.target.value)}
                  disabled={loading}
                >
                  {analyzeResult.sheetNames.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
            )}
            
            <table className="table table--flat">
              <thead>
                <tr>
                  <th>عمود Excel</th>
                  <th>الحقل في النظام</th>
                  <th>عينة بيانات</th>
                </tr>
              </thead>
              <tbody>
                {mappingState.map((m, i) => (
                  <tr key={i}>
                    <td>{m.excelHeader}</td>
                    <td>
                      <Select
                        value={m.systemField || ''}
                        onChange={(e) => {
                          const newMap = [...mappingState];
                          newMap[i].systemField = e.target.value || null;
                          setMappingState(newMap);
                        }}
                      >
                        <option value="">-- تجاهل --</option>
                        {SYSTEM_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </Select>
                    </td>
                    <td className="small muted">{m.sampleValues.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div className="formActions">
              <button className="btn btn--primary" onClick={() => void handlePreview()} disabled={loading}>
                التالي: معاينة البيانات
              </button>
            </div>
          </div>
        )}

        {step === 3 && previewResult && (
          <div>
            <h3>الخطوة 3: معاينة والتحقق</h3>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
              <div>صف صحيح: {previewResult.validRows.length}</div>
              <div>صف به أخطاء: {previewResult.invalidRows.length}</div>
              <div>تحذيرات: {previewResult.warnings.length}</div>
              <div>مكرر: {previewResult.duplicates.length}</div>
            </div>

            {previewResult.invalidRows.length > 0 && (
              <div>
                <h4>أخطاء يجب إصلاحها:</h4>
                <ul style={{ color: 'var(--red)' }}>
                  {previewResult.invalidRows.slice(0, 5).map((r, i) => (
                    <li key={i}>صف {r.rowNumber}: {r.errors.join(', ')}</li>
                  ))}
                  {previewResult.invalidRows.length > 5 && <li>... والمزيد</li>}
                </ul>
              </div>
            )}

            <div className="formActions">
              <button className="btn btn--ghost" onClick={() => setStep(2)}>رجوع للمطابقة</button>
              <button className="btn btn--primary" onClick={() => void handleConfirm()} disabled={loading || previewResult.validRows.length === 0}>
                تأكيد واستيراد {previewResult.validRows.length} صف
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
