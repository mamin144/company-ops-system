import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth';
import { useLang } from '@/i18n';
import { boqApi, ipcApi, mrApi, projName } from '@/services/api';
import { Badge, EmptyState } from '@/shared/ui';
import { statusLabel } from '@/shared/ui';
import { computeIndicators, fmtPct } from './financialIndicators';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

/**
 * Every figure here is DERIVED from the audited model (BOQ lines + IPC lines).
 * The previous hard-coded contract / executed / deductions constants are gone:
 * the data model has no contract-value, tax, retention or advance-payment
 * source, so those cells render an explicit "not available" instead of a
 * plausible-looking number.
 */
export const Financials = () => {
  const { lang, t } = useLang();
  const { user } = useAuth();
  const actor = user?.id;
  // Projects the identity may actually see — never render another project's money.
  const visible = useMemo(() => mrApi.projects(actor), [actor]);

  if (visible.length === 0) {
    return <div className="panel"><EmptyState title={t('deniedTitle')} hint={t('deniedBody')} /></div>;
  }

  return (
    <div>
      <div className="cmdHead"><div>
        <h1>{t('financialsTitle')}</h1>
        <p className="muted small">{t('derivedNote')}</p>
      </div></div>

      {visible.map((p) => {
        const s = ipcApi.summary(p.id);
        const ipcs = ipcApi.list(p.id, actor);
        const boqCount = boqApi.list(p.id, actor).length;
        // Dictionary §9: one arithmetic source for every derived indicator —
        // approved IPCs only, double-counting guarded.
        const ind = computeIndicators(p.contractValue, s);
        const na = t('notAvailable');
        return (
          /* Each card is headed by the project's own name — business data, deliberately
     not translated (see the Phase 3.8 report's "not translated" section). */
<section className="panel" key={p.id} aria-label={p.name} data-i18n-skip="business-data">
            <div className="sectionHead" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <h2><Link to={`/projects/${p.id}/financials`}>{p.name}</Link></h2>
            </div>
            <div className="cards">
              <div className="card">
                <span className="l">{t('boqTotal')}</span><br />
                <span className="v num">{boqCount === 0 ? t('notAvailable') : fmt(s.boqTotal)}</span>
              </div>
              <div className="card">
                <span className="l">{t('executedApproved')}</span><br />
                <span className="v num">{s.approvedCount === 0 ? t('notAvailable') : fmt(s.executed)}</span>
              </div>
              <div className="card">
                <span className="l">{t('deductions')}</span><br />
                <span className="v num">{s.approvedCount === 0 ? t('notAvailable') : fmt(s.deductions)}</span>
              </div>
              <div className="card">
                <span className="l">{t('contractValue')}</span><br />
                {/* Direct amount (Project.contractValue) — shown only when a proven
                    source exists; never derived from BOQ/IPC and never 0-by-default. */}
                <span className="v num">{ind.contractValue == null ? na : fmt(ind.contractValue)}</span>
              </div>
              <div className="card">
                {/* Dictionary §9.1: execution % = executed ÷ contract value × 100,
                    only when contract value exists and is > 0. */}
                <span className="l">{t('executionPct')}</span><br />
                <span className="v num">{ind.executionPct == null ? na : fmtPct(ind.executionPct)}</span>
              </div>
              <div className="card">
                {/* Labeled "remaining against contract value" — deliberately NOT
                    "remaining for disbursement" (no payment data exists). */}
                <span className="l">{t('remainingContract')}</span><br />
                <span className="v num">{ind.remainingContract == null ? na : fmt(ind.remainingContract)}</span>
              </div>
              <div className="card">
                {/* Honest gap per §9.2: no disbursement/payment source anywhere in
                    the shared contract — rendered as "not available" + explanation. */}
                <span className="l">{t('remainingDisbursement')}</span><br />
                <span className="v num">{na}</span>
              </div>
            </div>
            {/* Gap note for the disbursement indicator (dictionary §9.2). */}
            <p className="muted small">{t('disbursementGap')}</p>

            {ipcs.length === 0 ? (
              <p className="muted small">{t('ipcEmptyHint')}</p>
            ) : (
              <p><strong>{t('ipc')}:</strong>{' '}
                {ipcs.map((x) => (
                  <span key={x.id} style={{ marginInlineEnd: 8 }}>
                    <Badge tone={x.status === 'approved' ? 'green' : x.status === 'rejected' ? 'red' : 'blue'}>
                      #{x.ipcNumber} · {statusLabel(t, x.status)} · <span className="num">{fmt(x.netAmount ?? 0)}</span>
                    </Badge>
                  </span>
                ))}
              </p>
            )}
            <p className="muted small">{t('financialsScopeNote')}</p>
          </section>
        );
      })}
    </div>
  );
};