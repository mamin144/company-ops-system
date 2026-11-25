import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth';
import { useLang } from '@/i18n';
import { reportApi } from '@/services/api';
import type { ExportFormat, ExportFilter } from '@/services/api';
import { downloadFile } from '@/shared/lib/files';
import { Button, useToast, errText } from './ui';

/**
 * Contextual export for a list screen — Phase 3.8 follow-up.
 *
 * Deliberate constraints (an owner decision, not an omission):
 *  · It is rendered ONLY where a report exists for exactly this dataset.
 *    Archive has no documents report, so Archive gets no button.
 *  · It calls the SAME `reportApi.export` the Reports page calls, so the
 *    permission gate (`reports.view` + the dataset's own read permission) and
 *    the project scope are enforced inside the mock path, not by hiding UI.
 *    No permission was added, removed or widened to make this possible.
 *  · The row count is read live from `reportApi.preview`, so the number shown
 *    is the number written into the file.
 *  · `filter` is re-applied by the engine to ALREADY-SCOPED rows, so it can
 *    only narrow. Passing the active search keeps the file identical to the
 *    visible list.
 */
export const ContextualExport = ({
  reportId,
  filter,
}: {
  reportId: string;
  filter?: ExportFilter;
}) => {
  const { user } = useAuth();
  const { t } = useLang();
  const toast = useToast();
  const actor = user?.id;
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [last, setLast] = useState<string | null>(null);

  // `available()` re-checks both permissions; an identity without
  // `reports.view` simply has no entry for this report.
  const allowed = useMemo(
    () => reportApi.available(actor).some((r) => r.id === reportId),
    [actor, reportId],
  );
  // The number shown is the number the file will hold: same gates, same
  // scope, same filter re-applied by the engine.
  const scopedCount = useMemo(
    () => (allowed ? reportApi.count(actor, reportId, filter) : null),
    [actor, reportId, filter, allowed],
  );

  if (!allowed || scopedCount === null) return null;

  const run = async (format: ExportFormat) => {
    setBusy(format);
    const r = await reportApi.export(actor, reportId, format, filter);
    setBusy(null);
    if (!r.ok) { toast('error', errText(t, r)); return; }
    downloadFile(r.filename, r.mime, r.text);
    setLast(t('lastExport', { f: r.filename, n: r.rowCount, c: r.columns.length }));
    toast('success', t('exportDone', { f: r.filename, n: r.rowCount }));
  };

  return (
    <div className="ctxExport" aria-label={t('exportThisList')}>
      <span className="muted small" aria-hidden="true">{t('exportListScope', { n: scopedCount })}</span>
      {scopedCount === 0 && <span className="muted small">{t('exportEmptyNote')}</span>}
      <Button size="sm" variant="primary" disabled={busy !== null} onClick={() => run('csv')}>
        {busy === 'csv' ? t('exporting') : t('exportCsv')}
      </Button>
      <Button size="sm" disabled={busy !== null} onClick={() => run('json')}>
        {busy === 'json' ? t('exporting') : t('exportJson')}
      </Button>
      {last && <span className="muted small num" role="status">{last} · <Link to="/reports">{t('reports')}</Link></span>}
    </div>
  );
};