// Session-scoped utility page (notifications feed). Moved verbatim from the
// former pages/Misc.tsx; belongs to the app/session layer, not a business
// feature module.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '@/i18n';
import { mockApi } from '@/services/api';
import { Button, EmptyState } from '@/shared/ui';

export const Notifications = () => {
  const { t } = useLang();
  const [items, setItems] = useState<Awaited<ReturnType<typeof mockApi.notifications>>>([]);
  useEffect(() => { mockApi.notifications().then(setItems); }, []);
  return (
    <div>
      <div className="cmdHead"><div><h1>{t('notifications')}</h1></div>
        <div>
          <Button size="sm" onClick={async () => { setItems(await mockApi.notifications()); }}>{t('refreshNotifs')}</Button>{' '}
          {items.some((n) => !n.read) && <Button size="sm" onClick={async () => { await mockApi.readNotif(); setItems(await mockApi.notifications()); }}>{t('markAllRead')}</Button>}
        </div></div>
      {items.length === 0 ? <div className="panel"><EmptyState icon="bell" title={t('empty')} /></div> : (
        <div className="panel">{items.map((n) => (
          <p key={n.id} style={{ opacity: n.read ? 0.65 : 1 }}>
            <strong>{n.read ? '' : '● '}{n.title}</strong><br />
            <span className="muted small">{n.message}</span><br />
            {n.link && <Link className="linkBtn" to={n.link}>{t('openLink')}</Link>}{' '}
            {!n.read && <Button size="sm" onClick={async () => { await mockApi.readNotif(n.id); setItems(await mockApi.notifications()); }}>{t('markRead')}</Button>}
          </p>
        ))}</div>
      )}
    </div>
  );
};
