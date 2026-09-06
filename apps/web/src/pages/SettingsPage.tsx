import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { ImportHistoryEntry } from '@cos/shared';
import { Badge, ConfirmDialog, useToast } from '../components/ui';
import { useAuth } from '../context/AuthContext';

interface BackupInfo { name: string; hasFiles: boolean }

export const SettingsPage = () => {
  const toast = useToast();
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [history, setHistory] = useState<ImportHistoryEntry[]>([]);
  const [restoreTarget, setRestoreTarget] = useState<BackupInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    void api.get<BackupInfo[]>('/api/backups').then(setBackups).catch(() => setBackups([]));
    void api.get<ImportHistoryEntry[]>('/api/import/history').then(setHistory).catch(() => setHistory([]));
  }, []);

  useEffect(load, [load]);

  const createBackup = async () => {
    setBusy(true);
    try {
      await api.post('/api/backups');
      toast('success', 'تم إنشاء نسخة احتياطية كاملة (بيانات + ملفات)');
      load();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'فشل النسخ الاحتياطي');
    }
    setBusy(false);
  };

  const doRestore = async () => {
    if (!restoreTarget) return;
    setBusy(true);
    try {
      const res = await api.post<{ safetyBackup: string }>(`/api/backups/${restoreTarget.name}/restore`);
      toast('success', `تم الاستعادة. نسخة أمان من الحالة السابقة: ${res.safetyBackup}`);
      setRestoreTarget(null);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'فشل الاستعادة');
    }
    setBusy(false);
  };

  return (
    <div className="page">
      <div className="pageHead">
        <div><h1>الإعدادات</h1><p>النسخ الاحتياطي، سجل الاستيراد، وإعدادات النظام</p></div>
        <div className="actions">
          <button className="btn btn--primary" disabled={busy} onClick={createBackup}>نسخة احتياطية الآن</button>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel__head"><h3>النسخ الاحتياطي والاستعادة</h3></div>
        <p className="muted small">الاستعادة تنشئ تلقائياً نسخة أمان من الحالة الحالية قبل التنفيذ.</p>
        {backups.length === 0 ? (
          <p className="muted">لا توجد نسخ محفوظة بعد</p>
        ) : (
          <table className="table table--flat">
            <thead><tr><th>الاسم</th><th>الملفات</th><th></th></tr></thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.name}>
                  <td>{b.name}</td>
                  <td>{b.hasFiles ? 'بيانات + ملفات' : '—'}</td>
                  <td className="colActions">
                    <button className="btn btn--sm" onClick={() => setRestoreTarget(b)}>استعادة</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <div className="panel__head"><h3>سجل استيراد Excel</h3></div>
        {history.length === 0 ? (
          <p className="muted">لا يوجد استيراد مسجل بعد</p>
        ) : (
          <table className="table table--flat">
            <thead><tr><th>التاريخ</th><th>الكيان</th><th>الملف</th><th>المستخدم</th><th>النتيجة</th><th>أخطاء</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{new Date(h.date).toLocaleString('ar-EG')}</td>
                  <td><Badge tone="blue">{h.entity}</Badge></td>
                  <td>{h.fileName}</td>
                  <td>{h.username ?? '—'}</td>
                  <td>
                    {h.successfulRows} نجح
                    {h.failedRows > 0 ? <> · <span className="dangerText">{h.failedRows} فشل</span></> : null}
                  </td>
                  <td className="small muted">{h.errors.slice(0, 2).join(' | ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!restoreTarget}
        text={`سيتم استبدال كل البيانات الحالية بمحتوى النسخة "${restoreTarget?.name}". سيتم أخذ نسخة أمان تلقائياً قبل الاستعادة. متابعة؟`}
        onConfirm={doRestore}
        onCancel={() => setRestoreTarget(null)}
      />
    </div>
  );
};
