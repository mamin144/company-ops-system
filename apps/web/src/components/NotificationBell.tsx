import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { IconAlert } from './Icons';

interface Notification {
  id: string;
  type: 'low-stock' | 'document-status' | 'system' | 'material-request';
  title: string;
  message: string;
  link?: string;
  readBy: string[];
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  'low-stock': 'مخزون',
  'document-status': 'مستندات',
  system: 'النظام',
  'material-request': 'طلبات مواد',
};

export const NotificationBell = () => {
  const [data, setData] = useState<{ unread: number; items: Notification[] }>({ unread: 0, items: [] });
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(() => {
    void api.get<{ unread: number; items: Notification[] }>('/api/notifications').then(setData);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const markAll = async () => {
    await api.post('/api/notifications/read-all');
    load();
  };

  return (
    <div className="notifWrap">
      <button className="iconBtn notifBell" onClick={() => setOpen((o) => !o)} title="الإشعارات">
        <IconAlert />
        {data.unread > 0 ? <span className="notifBadge">{data.unread > 9 ? '9+' : data.unread}</span> : null}
      </button>
      {open ? (
        <div className="notifPanel">
          <div className="notifPanel__head">
            <strong>الإشعارات</strong>
            {data.items.length > 0 ? <button className="linkBtn" onClick={markAll}>تعليم الكل كمقروء</button> : null}
          </div>
          {data.items.length === 0 ? (
            <p className="muted" style={{ padding: '12px 16px' }}>لا توجد إشعارات</p>
          ) : (
            data.items.map((n) => {
              const unread = !n.readBy.length;
              return (
                <button
                  key={n.id}
                  className={`notifItem ${unread ? 'notifItem--unread' : ''}`}
                  onClick={async () => {
                    await api.post(`/api/notifications/${n.id}/read`);
                    setOpen(false);
                    if (n.link) navigate(n.link.split('?')[0]);
                    load();
                  }}
                >
                  <span className="notifType">{TYPE_LABEL[n.type] ?? n.type}</span>
                  <strong>{n.title}</strong>
                  <small>{n.message}</small>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
};
