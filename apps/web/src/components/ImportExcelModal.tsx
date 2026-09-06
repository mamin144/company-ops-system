import { useRef, useState } from 'react';
import { api, downloadDocument } from '../lib/api';
import { Badge, Modal, useToast } from './ui';
import { IconDownload } from './Icons';
import { DataTable } from './DataTable';

interface PreviewResult {
  headers: string[];
  validRows: Record<string, unknown>[];
  invalidRows: Array<{ rowNumber: number; errors: string[]; row: Record<string, unknown> }>;
}

export const ImportExcelModal = ({
  entity,
  title,
  open,
  onClose,
  onDone,
}: {
  entity: 'projects' | 'warehouses' | 'items' | 'transactions' | 'documents' | 'boq';
  title: string;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) => {
  const toast = useToast();
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.upload<PreviewResult>(`/api/import/${entity}/preview`, fd);
      setPreview(res);
      toast('success', `تم تحليل الملف: ${res.validRows.length} صف صالح، ${res.invalidRows.length} صف به أخطاء`);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'تعذر قراءة الملف');
    }
  };

  const confirmImport = async () => {
    if (!preview?.validRows.length) return;
    setBusy(true);
    try {
      const res = await api.post<{ imported: number; failed: number }>(`/api/import/${entity}/confirm`, {
        rows: preview.validRows,
      });
      toast('success', `تم استيراد ${res.imported} صف بنجاح${res.failed ? ` — فشل ${res.failed} صف` : ''}`);
      setPreview(null);
      onDone();
      onClose();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'خطأ في الاستيراد');
    }
    setBusy(false);
  };

  return (
    <Modal title={`استيراد ${title} من Excel`} open={open} onClose={() => { setPreview(null); onClose(); }} wide>
      <div className="importSteps">
        <p>
          <Badge tone="blue">١</Badge> نزّل القالب الذي يحتوي على رؤوس الأعمدة الصحيحة، املأ البيانات ثم
          <Badge tone="blue">٢</Badge> ارفعه لمعاينة والتحقق قبل الحفظ.
        </p>
        <button
          className="btn btn--ghost"
          onClick={() => void downloadDocument(`/api/import/${entity}/template`, `${entity}-import-template.xlsx`)}
        >
          <IconDownload size={16} /> تنزيل قالب Excel بالرؤوس
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          hidden
          onChange={(e) => {
            const f2 = e.target.files?.[0];
            if (f2) void onFile(f2);
            e.target.value = '';
          }}
        />
        <button className="btn btn--primary" onClick={() => inputRef.current?.click()}>
          اختيار ملف .xlsx للمعاينة
        </button>
      </div>

      {preview ? (
        <div className="stack" style={{ marginTop: 18 }}>
          <h4 className="previewTitle">
            صالح ({preview.validRows.length}) — غير صالح ({preview.invalidRows.length})
          </h4>
          {preview.validRows.length > 0 ? (
            <DataTable
              columns={preview.headers.map((h) => ({ key: h, label: h }))}
              data={{
                items: preview.validRows.slice(0, 20).map((r, i) => ({ ...r, id: String(i) })),
                total: preview.validRows.length,
                page: 1,
                pageSize: 20,
              }}
              loading={false}
            />
          ) : null}
          {preview.invalidRows.length > 0 ? (
            <table className="table table--flat">
              <thead><tr><th>الصف</th><th>الأخطاء</th></tr></thead>
              <tbody>
                {preview.invalidRows.map((r) => (
                  <tr key={r.rowNumber}>
                    <td>{r.rowNumber}</td>
                    <td className="dangerText">{r.errors.join('، ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          <div className="formActions">
            <button className="btn btn--primary" disabled={busy || preview.validRows.length === 0} onClick={confirmImport}>
              تأكيد الاستيراد ({preview.validRows.length} صف)
            </button>
            <button className="btn btn--ghost" onClick={() => setPreview(null)}>إلغاء</button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
