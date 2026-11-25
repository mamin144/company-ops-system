import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth';
import { useLang } from '@/i18n';
import { reportApi } from '@/services/api';
import type { ExportFormat } from '@/services/api';
import { downloadFile } from '@/shared/lib/files';
import { Button, EmptyState, Modal, RecCell, RecHead, RecRow, RecShell, useToast, errText } from '@/shared/ui';

type Busy = string | null;

export const Reports = () => {
  const { t } = useLang();
  const { user } = useAuth();
  const actor = user?.id;
  const toast = useToast();
  const [busy, setBusy] = useState<Busy>(null);
  const [last, setLast] = useState<{ id: string; filename: string; rowCount: number; columns: string[] } | null>(null);
  const [peek, setPeek] = useState<{ id: string; columns: string[]; rows: string[][]; total: number } | null>(null);

  // Row counts are resolved from the LIVE mock store through the same scoping
  // rule the export uses, so the number on screen is the number in the file.
  const list = useMemo(() => reportApi.available(actor), [actor]);

  const run = async (id: string, format: ExportFormat) => {
    setBusy(`${id}:${format}`);
    const r = await reportApi.export(actor, id, format);
    setBusy(null);
    if (!r.ok) { toast('error', errText(t, r)); return; }
    downloadFile(r.filename, r.mime, r.text);
    setLast({ id, filename: r.filename, rowCount: r.rowCount, columns: r.columns.map((c) => c.label) });
    toast('success', t('exportDone', { n: r.rowCount, f: r.filename }));
  };

  const showPreview = (id: string) => {
    const p = reportApi.preview(actor, id);
    if (!p.ok) { toast('error', errText(t, p)); return; }
    setPeek({
      id,
      columns: p.columns.map((c) => c.label),
      rows: p.rows.slice(0, 8).map((r) => p.columns.map((c) => String(r[c.key] ?? ''))),
      total: p.rows.length,
    });
  };

  if (list.length === 0) {
    return (
      <div className="panel">
        <EmptyState title={t('noReportsAvailable')} hint={t('reportsNoneHint')} />
      </div>
    );
  }

  return (
    <div>
      <div className="cmdHead">
        <div>
          <h1>{t('reports')}</h1>
          <p className="muted small">{t('reportsScopeNote')}</p>
        </div>
      </div>

      <div className="panel">
        <p className="muted small">{t('reportsFormatsNote')}</p>
        <RecShell label={t('reports')} template="1.4fr .7fr .7fr auto">
          <RecHead template="1.4fr .7fr .7fr auto">
            <RecCell head>{t('report')}</RecCell>
            <RecCell head>{t('rowCount')}</RecCell>
            <RecCell head>{t('columnCount')}</RecCell>
            <RecCell head>{t('actions')}</RecCell>
          </RecHead>
          {list.map((r) => (
            <RecRow key={r.id} template="1.4fr .7fr .7fr auto">
              <RecCell k={t('report')}><strong>{t(r.labelKey as Parameters<typeof t>[0])}</strong><br /><span className="muted small num">{r.id}</span></RecCell>
              <RecCell k={t('rowCount')}><span className="num">{r.rowCount}</span></RecCell>
              <RecCell k={t('columnCount')}><span className="num">{r.columns.length}</span></RecCell>
              <RecCell>
                <span className="recActions">
                  <Button size="sm" onClick={() => showPreview(r.id)}>{t('preview')}</Button>
                  <Button size="sm" variant="primary" disabled={busy !== null} onClick={() => run(r.id, 'csv')}>
                    {busy === `${r.id}:csv` ? t('exporting') : t('exportCsv')}
                  </Button>
                  <Button size="sm" disabled={busy !== null} onClick={() => run(r.id, 'json')}>
                    {busy === `${r.id}:json` ? t('exporting') : t('exportJson')}
                  </Button>
                </span>
              </RecCell>
            </RecRow>
          ))}
        </RecShell>
        {last && (
          <p className="muted small num" role="status">
            {t('lastExport', { f: last.filename, n: last.rowCount, c: last.columns.length })}
          </p>
        )}
      </div>

      <p className="muted small">
        {t('reportsAuditNote')} · <Link to="/audit">{t('audit')}</Link>
      </p>

      <Modal title={peek ? t('preview') : ''} open={!!peek} onClose={() => setPeek(null)} wide>
        {peek && (
          <>
            <p className="muted small num">{t('previewScope', { n: peek.total, shown: Math.min(8, peek.total) })}</p>
            <div className="tableWrap">
              <table className="table" aria-label={t('preview')}>
                <thead>
                  <tr>{peek.columns.map((c) => <th key={c}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {peek.rows.map((r, i) => (
                    <tr key={i}>{r.map((v, j) => <td key={j} className={j > 1 ? 'num' : undefined}>{v}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            {peek.total > 8 && <p className="muted small num">{t('previewTruncated', { n: peek.total - 8 })}</p>}
          </>
        )}
      </Modal>
    </div>
  );
};