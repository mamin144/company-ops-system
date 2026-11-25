import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth';
import { useLang } from '@/i18n';
import { mockApi, mrApi, lookups, whName } from '@/services/api';
import { Badge, Button, EmptyState, SectionHead, StatusDot, statusLabel } from '@/shared/ui';
import SplitText from '@/shared/ui/bits/SplitText';
import { Icon } from '@/shared/ui/icons';
import { usePageMotion } from '@/shared/lib/motion';

export const Home = () => {
  const { can, user } = useAuth();
  const { t } = useLang();
  const [mrs, setMrs] = useState<Awaited<ReturnType<typeof mockApi.MRs>>>([]);
  const [ov, setOv] = useState<Awaited<ReturnType<typeof mockApi.overview>> | null>(null);
  const [docs, setDocs] = useState<Awaited<ReturnType<typeof mockApi.documents>>>([]);
  const [projects, setProjects] = useState<ReturnType<typeof mrApi.projects>>([]);
  const [whs, setWhs] = useState<ReturnType<typeof lookups.warehouses>>([]);
  const [itemsList, setItemsList] = useState<ReturnType<typeof lookups.items>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // dashboard entry cascade scope (data-motion targets below)
  const pageRef = useRef<HTMLDivElement>(null);
  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, b, c] = await Promise.all([
        mockApi.MRs(user?.id),
        mockApi.overview(user?.id),
        mockApi.documents({}, user?.id),
      ]);
      setMrs(a);
      setOv(b);
      setDocs(c);
      // Same scoped boundaries the archive/inventory modules consume — never
      // the raw fixture arrays, so a partial-membership identity (warehouse,
      // technical, viewer) counts only what it can actually reach (Phase 6).
      setProjects(mrApi.projects(user?.id));
      setWhs(lookups.warehouses(user?.id));
      setItemsList(lookups.items(user?.id));
    } catch {
      setError(t('eLoadFailed'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Coordinated entry cascade (Phase 3.17-C): one per content mount — the
  // `loading` flip fires it, re-renders with the same flag never re-run it.
  usePageMotion(pageRef, [loading]);

  const submitted = mrs.filter((m) => m.status === 'submitted');
  const approved = mrs.filter((m) => m.status === 'approved');
  const partial = mrs.filter((m) => m.status === 'partially-issued');
  const rejected = mrs.filter((m) => m.status === 'rejected');
  const low = ov?.lowStock ?? [];
  const showQueues = can('materialRequests.view') || can('warehouse.view');

  return (
    <div ref={pageRef}>
      <div className="cmdHead">
        {/* Phase 3.17-D: the whole-block `data-motion="title"` tween became a
            word-level SplitText cascade — the h1 drops downward word by word,
            the demo eyebrow fades in ahead of it. Owner request (3.17-D): the
            greeting carries the signed-in user's name right after "صباح الخير".
            The prefix is audited UI chrome; the name is demo-store business
            data, so it renders in its own data-i18n-skip child (the i18n
            audit's declared opt-out) while cascading with the same motion —
            startDelay 270 = 150 + 2×60 continues the 60ms word stagger exactly
            where the prefix ends.
            Reduced motion: both render instantly (SplitText's own guard). */}
        <div>
          <div className="eyebrow">
            <Badge tone="blue">{t('myDesk')}</Badge>
            <SplitText
              tag="span"
              className="muted small"
              text={t('demo')}
              trigger="load"
              splitType="words"
              effect="fade"
              duration={0.32}
              delay={28}
              textAlign="start"
            />
          </div>
          <h1>
            <SplitText
              tag="span"
              text={t('greeting').replace('{name}', '').trim()}
              trigger="load"
              splitType="words"
              startDelay={150}
              duration={0.6}
              delay={60}
              from={{ y: -18, opacity: 0 }}
              to={{ y: 0, opacity: 1 }}
              textAlign="start"
            />{' '}
            <span data-i18n-skip>
              <SplitText
                tag="span"
                text={user?.name ?? ''}
                trigger="load"
                splitType="words"
                startDelay={270}
                duration={0.6}
                delay={60}
                from={{ y: -18, opacity: 0 }}
                to={{ y: 0, opacity: 1 }}
                textAlign="start"
              />
            </span>
          </h1>
        </div>
      </div>

      {error && (
        <div className="errBox" role="alert">
          <p>{error}</p>
          <Button size="sm" variant="primary" onClick={loadAll}>{t('retry')}</Button>
        </div>
      )}
      {loading ? (
        <div className="panel"><div className="skelRow"><div className="skel" /><div className="skel" /><div className="skel" /></div></div>
      ) : (
        <div className="briefGrid">
          <div className="briefLead">
          {showQueues && (
            <section className="panel attention" aria-label={t('queuesLabel')} data-motion="section">
              <SectionHead title={t('needsReview')} splitStartDelay={560} />
              {can('materialRequests.view') && submitted.length > 0 && (
                <Link className="row" to="/inventory/requests">
                  <StatusDot tone="red">{submitted.length} {t('queueSubmitted')}</StatusDot>
                  <span className="linkBtn" aria-hidden="true">{t('arrowNext')}</span>
                </Link>
              )}
              {can('materialRequests.view') && submitted.length > 0 && can('materialRequests.approve') && (
                <SplitText
                  tag="p"
                  className="muted small"
                  text={t('queueApprovalNote')}
                  trigger="load"
                  splitType="words"
                  effect="fade"
                  startDelay={640}
                  duration={0.32}
                  delay={28}
                  textAlign="start"
                />
              )}
              {can('warehouse.view') && low.length > 0 && (
                <Link className="row" to="/inventory/stock">
                  <StatusDot tone="amber">{low.length} {t('queueLowStock')}</StatusDot>
                  <span className="linkBtn" aria-hidden="true">{t('arrowNext')}</span>
                </Link>
              )}
              {can('materialRequests.view') && rejected.length > 0 && (
                <div className="row"><StatusDot tone="gray">{rejected.length} {t('queueRejected')}</StatusDot></div>
              )}
              {submitted.length === 0 && low.length === 0 && (
                <div className="row"><StatusDot tone="green">{t('queueCalm')}</StatusDot></div>
              )}
            </section>
          )}

          <div className="grid2">
            <section className="panel" data-motion="section">
              <SectionHead title={t('recentDocs')} splitStartDelay={700} actions={<Link className="linkBtn" to="/archive" aria-label={`${t('recentDocs')} — ${t('archive')}`}>{t('arrowNext')}</Link>} />
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {docs.slice(0, 4).map((d) => (
                  <li key={d.id} data-motion="rows" style={{ padding: '8px 0', borderTop: '1px solid var(--border-subtle)' }}>
                    <strong>{d.title}</strong><br /><span className="muted small num">{d.number} · {d.updatedAt}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="panel" data-motion="section">
              <SectionHead title={t('recentMoves')} splitStartDelay={840} actions={<Link className="linkBtn" to="/inventory/stock" aria-label={`${t('recentMoves')} — ${t('stock')}`}>{t('arrowNext')}</Link>} />
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {(ov?.txns ?? []).slice(0, 4).map((x) => (
                  <li key={x.id} data-motion="rows" style={{ padding: '8px 0', borderTop: '1px solid var(--border-subtle)' }}>
                    <strong className="num">{x.number}</strong>{' '}
                    <span className="muted small">{statusLabel(t, x.type)} · {whName(x.warehouseId)}{x.referenceNumber ? <> · <span className="num">{x.referenceNumber}</span></> : null} · <span className="num">{x.date}</span></span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          {!showQueues && <EmptyState title={t('empty')} hint={t('deniedBody')} />}
          </div>
          <div className="briefSide">
          <div className="cards cards--index">
            {can('projects.view') && <Link className="card statCard" data-motion="card" to="/projects"><span className="l"><Icon name="projects" size={15} />{t('projects')}</span><br /><span className="v num">{projects.length}</span></Link>}
            {can('archive.view') && <Link className="card statCard" data-motion="card" to="/archive"><span className="l"><Icon name="file" size={15} />{t('archive')}</span><br /><span className="v num">{docs.length}</span></Link>}
            {can('warehouse.view') && <Link className="card statCard" data-motion="card" to="/inventory/warehouses"><span className="l"><Icon name="box" size={15} />{t('inventory')}</span><br /><span className="v num">{whs.length} / {itemsList.length}</span></Link>}
          </div>
          {can('materialRequests.view') && (submitted.length + approved.length + partial.length > 0) && (
            <div className="cards cards--index">
              <Link className="card statCard" data-motion="card" to="/inventory/requests?status=submitted"><span className="l"><Icon name="clock" size={15} />{statusLabel(t, 'submitted')}</span><br /><span className="v num">{submitted.length}</span></Link>
              <Link className="card statCard" data-motion="card" to="/inventory/requests?status=approved"><span className="l"><Icon name="check" size={15} />{statusLabel(t, 'approved')}</span><br /><span className="v num">{approved.length}</span></Link>
              <Link className="card statCard" data-motion="card" to="/inventory/requests?status=partially-issued"><span className="l"><Icon name="info" size={15} />{statusLabel(t, 'partially-issued')}</span><br /><span className="v num">{partial.length}</span></Link>
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
};