import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Document, MaterialRequest, StockTransaction } from '@cos/shared';
import { Badge } from '../components/ui';
import { PreviewDocButton, DownloadDocButton } from '../components/ProtectedFileLink';

interface Overview {
  lowStock: Array<{ item: { id: string; code: string; name: string; minimumStock?: number }; quantity: number }>;
  summaryByType: Record<string, number>;
}

const kpiMeta = [
  { key: 'projects', label: 'المشاريع', to: '/projects' },
  { key: 'documents', label: 'المستندات', to: '/archive' },
  { key: 'warehouses', label: 'المخازن', to: '/warehouses' },
  { key: 'items', label: 'الأصناف', to: '/items' },
] as const;

const TYPE_AR: Record<string, string> = {
  IN: 'إدخال', OUT: 'صرف', TRANSFER: 'تحويل', ADJUSTMENT: 'تسوية', RETURN: 'مرتجع',
};

interface MovementRow extends StockTransaction {
  number?: string;
}

export const useDashboardData = () => {
  const [stats, setStats] = useState<{
    projects: number;
    documents: number;
    warehouses: number;
    items: number;
    lowStock: number;
    pendingMRs: number;
    overview: Overview | null;
    recentDocs: Document[];
    recentMovements: MovementRow[];
  } | null>(null);

  useEffect(() => {
    void Promise.all([
      api.get<{ total: number }>('/api/projects?pageSize=1'),
      api.get<{ total: number }>('/api/documents?pageSize=1'),
      api.get<{ total: number }>('/api/warehouses?pageSize=1'),
      api.get<{ total: number }>('/api/items?pageSize=1'),
      api.get<Overview>('/api/stock/overview'),
      api.get<{ items: Document[] }>('/api/documents?pageSize=5&sortBy=updatedAt&sortDir=desc'),
      api.get<MaterialRequest[]>('/api/material-requests'),
      api.get<{ items: MovementRow[] }>('/api/stock/history?pageSize=6'),
    ])
      .then(([p, d, w, i, s, docs, mrs, movements]) => {
        const pendingMRs = Array.isArray(mrs) ? mrs.filter((m) => m.status === 'submitted').length : 0;
        const recent = Array.isArray(movements?.items) ? movements.items : [];
        setStats({
          projects: p.total,
          documents: d.total,
          warehouses: w.total,
          items: i.total,
          lowStock: s.lowStock.length,
          pendingMRs,
          overview: s,
          recentDocs: docs.items,
          recentMovements: recent.slice(0, 6),
        });
      })
      .catch(() => undefined);
  }, []);

  return stats;
};

export const BarChart = ({ data }: { data: Array<{ label: string; value: number; tone?: string }> }) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="barChart">
      {data.map((d) => (
        <div className="barChart__col" key={d.label}>
          <div className="barChart__value">{d.value}</div>
          <div
            className={`barChart__bar barChart__bar--${d.tone ?? 'blue'}`}
            style={{ height: `${Math.max(4, (d.value / max) * 110)}px` }}
          />
          <div className="barChart__label">{d.label}</div>
        </div>
      ))}
    </div>
  );
};

export const DashboardPage = () => {
  const stats = useDashboardData();

  return (
    <div className="page">
      <div className="pageHead">
        <div>
          <h1>لوحة التحكم</h1>
          <p>{new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="actions">
          <Link to="/archive" className="btn btn--ghost">رفع مستند</Link>
          <Link to="/material-requests" className="btn btn--primary">طلبات المواد</Link>
        </div>
      </div>

      {!stats ? (
        <div className="cards">
          {Array.from({ length: 4 }).map((_, i) => <div className="card skeletonCard" key={i} />)}
        </div>
      ) : (
        <>
          <div className="cards">
            {kpiMeta.map((k) => (
              <Link className="card card--link" to={k.to} key={k.key}>
                <div className="card__label">{k.label}</div>
                <div className="card__value">{stats[k.key]}</div>
              </Link>
            ))}
            {stats.pendingMRs > 0 ? (
              <Link className="card card--link card--alert" to="/material-requests">
                <div className="card__label"><span className="alertDot" /> طلبات مواد بانتظار الاعتماد</div>
                <div className="card__value">{stats.pendingMRs}</div>
              </Link>
            ) : null}
            {stats.lowStock > 0 ? (
              <Link className="card card--link card--alert" to="/stock">
                <div className="card__label"><span className="alertDot" /> أصناف تحت حد الأمان</div>
                <div className="card__value">{stats.lowStock}</div>
              </Link>
            ) : (
              <div className="card card--ok">
                <div className="card__label">المخزون</div>
                <div className="card__value">سليم</div>
              </div>
            )}
          </div>

          <div className="dashGrid">
            <div className="panel">
              <div className="panel__head">
                <h3>حركة المخزون</h3>
                <Link to="/stock" className="linkBtn">عرض الكل</Link>
              </div>
              {stats.overview ? (
                <BarChart
                  data={Object.entries(stats.overview.summaryByType).map(([k, v]) => ({
                    label: TYPE_AR[k] ?? k,
                    value: v,
                    tone: { IN: 'green', OUT: 'red', TRANSFER: 'blue', ADJUSTMENT: 'amber', RETURN: 'purple' }[k],
                  }))}
                />
              ) : null}
            </div>

            <div className="panel">
              <div className="panel__head">
                <h3>أحدث المستندات</h3>
                <Link to="/archive" className="linkBtn">الأرشيف</Link>
              </div>
              {stats.recentDocs.length === 0 ? (
                <p className="muted">لا توجد مستندات بعد.</p>
              ) : (
                <ul className="recentList">
                  {stats.recentDocs.map((doc) => (
                    <li key={doc.id}>
                      <span className="recentList__title">{doc.title}</span>
                      <PreviewDocButton small documentId={doc.id} fileName={doc.fileName} label="فتح" />
                      <DownloadDocButton small documentId={doc.id} fileName={doc.fileName} />
                      <Badge tone="blue">{doc.category}</Badge>
                      <span className="muted small">{new Date(doc.updatedAt).toLocaleDateString('ar-EG')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="panel">
              <div className="panel__head">
                <h3>أحدث الحركات المخزنية</h3>
                <Link to="/stock" className="linkBtn">المخزون</Link>
              </div>
              {stats.recentMovements.length === 0 ? (
                <p className="muted">لا توجد حركات بعد.</p>
              ) : (
                <ul className="recentList">
                  {stats.recentMovements.map((t) => (
                    <li key={t.id}>
                      <strong className="recentList__title">{t.number ?? t.type}</strong>
                      <Badge tone={t.type === 'OUT' ? 'red' : 'green'}>{TYPE_AR[t.type] ?? t.type}</Badge>
                      <span className="muted small">{t.date}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {stats.overview && stats.overview.lowStock.length > 0 ? (
            <div className="panel panel--alert">
              <div className="panel__head">
                <h3>تنبيه: أصناف تحت حد الأمان</h3>
                <Link to="/stock" className="linkBtn">إدارة المخزون</Link>
              </div>
              <table className="table table--flat">
                <thead><tr><th>الكود</th><th>الصنف</th><th>الرصيد</th><th>حد الأمان</th></tr></thead>
                <tbody>
                  {stats.overview.lowStock.slice(0, 5).map(({ item, quantity }) => (
                    <tr key={item.id}>
                      <td>{item.code}</td><td>{item.name}</td>
                      <td><Badge tone="red">{quantity}</Badge></td>
                      <td>{item.minimumStock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};
