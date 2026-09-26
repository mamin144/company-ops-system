import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Document, MaterialRequest, StockTransaction } from '@cos/shared';
import { Badge } from '../components/ui';
import { PreviewDocButton, DownloadDocButton } from '../components/ProtectedFileLink';
import { useAuth } from '../context/AuthContext';
import { ResponsiveGrid } from '../components/ResponsiveLayout';
import {
  IconProjects,
  IconArchive,
  IconWarehouse,
  IconItems,
  IconStock,
  IconAlert,
} from '../components/Icons';

interface Overview {
  lowStock: Array<{ item: { id: string; code: string; name: string; minimumStock?: number }; quantity: number }>;
  summaryByType: Record<string, number>;
}

const TYPE_AR: Record<string, string> = {
  IN: 'إدخال',
  OUT: 'صرف',
  TRANSFER: 'تحويل',
  ADJUSTMENT: 'تسوية',
  RETURN: 'مرتجع',
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    setError(null);
    Promise.all([
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
          projects: p?.total ?? 0,
          documents: d?.total ?? 0,
          warehouses: w?.total ?? 0,
          items: i?.total ?? 0,
          lowStock: s?.lowStock?.length ?? 0,
          pendingMRs,
          overview: s,
          recentDocs: docs?.items ?? [],
          recentMovements: recent.slice(0, 6),
        });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'تعذر تحميل بيانات لوحة التحكم');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  return { stats, loading, error, reload: loadData };
};

export const BarChart = ({
  data,
}: {
  data: Array<{ label: string; value: number; tone?: string }>;
}) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div
      className="barChart"
      role="img"
      aria-label={`رسم بياني لحركة المخزون: ${data.map((d) => `${d.label} ${d.value}`).join('، ')}`}
    >
      {data.map((d) => (
        <div className="barChart__col" key={d.label}>
          <div className="barChart__value num">{d.value}</div>
          <div
            className={`barChart__bar barChart__bar--${d.tone ?? 'blue'}`}
            style={{ height: `${Math.max(6, (d.value / max) * 115)}px` }}
          />
          <div className="barChart__label">{d.label}</div>
        </div>
      ))}
    </div>
  );
};

export const DashboardPage = () => {
  const { stats, loading, error, reload } = useDashboardData();
  const { can } = useAuth();

  return (
    <div className="page dashboardPage">
      {/* ============ Header Hero Banner ============ */}
      <section className="dashHero" aria-label="موجز النظام">
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge--blue" style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}>
              نظام العمليات والمستودعات
            </span>
          </div>
          <h1>لوحة التحكم الرئيسية</h1>
          <p>
            {new Date().toLocaleDateString('ar-EG', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        {stats ? (
          <div className="dashStats" role="region" aria-label="الإحصائيات الرئيسية">
            <div className="dashStat">
              <b className="num">{stats.projects}</b>
              <span>المشاريع</span>
            </div>
            <div className="dashStat">
              <b className="num">{stats.documents}</b>
              <span>المستندات</span>
            </div>
            <div className="dashStat">
              <b className="num">{stats.pendingMRs}</b>
              <span>طلبات معلقة</span>
            </div>
          </div>
        ) : null}

        <div className="actions">
          {can('archive.create') && (
            <Link to="/archive" className="btn btn--ghost" aria-label="الانتقال للأرشيف لرفع مستند">
              رفع مستند
            </Link>
          )}
          {can('materialRequests.view') && (
            <Link to="/material-requests" className="btn btn--primary" aria-label="طلبات المواد">
              طلبات المواد
            </Link>
          )}
        </div>
      </section>

      {/* ============ Error State ============ */}
      {error && !stats && (
        <div className="panel panel--alert" style={{ textAlign: 'center', padding: '36px 20px', marginBottom: '20px' }}>
          <div className="emptyState__title" style={{ color: 'var(--danger)', marginBottom: '8px' }}>
            {error}
          </div>
          <p className="muted small" style={{ marginBottom: '16px' }}>
            تعذر الاتصال بالخادم لجلب إحصائيات النظام. تحقق من الاتصال ثم أعد المحاولة.
          </p>
          <button type="button" className="btn btn--primary" onClick={reload}>
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* ============ Loading Skeletons ============ */}
      {loading && !stats && (
        <>
          <div className="cards">
            {Array.from({ length: 4 }).map((_, i) => (
              <div className="card skeletonCard" key={i} />
            ))}
          </div>
          <div className="dashGrid">
            {Array.from({ length: 3 }).map((_, i) => (
              <div className="panel" key={i} style={{ height: '220px' }}>
                <div className="skeletonRow" style={{ padding: 0 }}>
                  <span />
                  <span />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ============ Loaded KPI Cards ============ */}
      {stats && (
        <>
          <ResponsiveGrid minWidth={220} gap={16} className="cards dashboardKpis">
            {can('projects.view') && (
              <Link className="card card--link" to="/projects" aria-label={`المشاريع: ${stats.projects}`}>
                <div className="card__label">
                  <IconProjects size={18} />
                  <span>المشاريع</span>
                </div>
                <div className="card__value num">{stats.projects}</div>
                <div className="card__footer muted small">مشاريع مسجلة في المنظومة</div>
              </Link>
            )}

            {can('archive.view') && (
              <Link className="card card--link" to="/archive" aria-label={`المستندات: ${stats.documents}`}>
                <div className="card__label">
                  <IconArchive size={18} />
                  <span>المستندات المؤرشفة</span>
                </div>
                <div className="card__value num">{stats.documents}</div>
                <div className="card__footer muted small">ملف ومستند مؤرشف</div>
              </Link>
            )}

            {can('warehouse.view') && (
              <Link className="card card--link" to="/warehouses" aria-label={`المخازن: ${stats.warehouses}`}>
                <div className="card__label">
                  <IconWarehouse size={18} />
                  <span>المخازن</span>
                </div>
                <div className="card__value num">{stats.warehouses}</div>
                <div className="card__footer muted small">مستودعات مركزية وموقعية</div>
              </Link>
            )}

            {can('warehouse.view') && (
              <Link className="card card--link" to="/items" aria-label={`الأصناف: ${stats.items}`}>
                <div className="card__label">
                  <IconItems size={18} />
                  <span>دليل الأصناف</span>
                </div>
                <div className="card__value num">{stats.items}</div>
                <div className="card__footer muted small">صنف مسجل بالمخزون</div>
              </Link>
            )}

            {can('materialRequests.view') && stats.pendingMRs > 0 && (
              <Link
                className="card card--link card--alert"
                to="/material-requests"
                aria-label={`طلبات مواد بانتظار الاعتماد: ${stats.pendingMRs}`}
              >
                <div className="card__label">
                  <span className="alertDot" aria-hidden="true" />
                  <span>طلبات مواد معلقة</span>
                </div>
                <div className="card__value num">{stats.pendingMRs}</div>
                <div className="card__footer dangerText small">تحتاج إلى مراجعة واعتماد</div>
              </Link>
            )}

            {can('warehouse.view') && (
              stats.lowStock > 0 ? (
                <Link
                  className="card card--link card--alert"
                  to="/stock"
                  aria-label={`أصناف تحت حد الأمان: ${stats.lowStock}`}
                >
                  <div className="card__label">
                    <IconAlert size={18} />
                    <span>تنبيه حد الأمان</span>
                  </div>
                  <div className="card__value num">{stats.lowStock}</div>
                  <div className="card__footer dangerText small">أصناف قاربت على النفاد</div>
                </Link>
              ) : (
                <div className="card card--ok" aria-label="حالة المخزون: سليم ومستقر">
                  <div className="card__label">
                    <IconStock size={18} />
                    <span>حالة المخزون</span>
                  </div>
                  <div className="card__value" style={{ fontSize: '24px', fontWeight: '700' }}>مستقر</div>
                  <div className="card__footer small" style={{ color: 'var(--success)' }}>جميع الأرصدة فوق حد الأمان</div>
                </div>
              )
            )}
          </ResponsiveGrid>

          {/* ============ Operational Grid (Panels) ============ */}
          <div className="dashGrid" style={{ marginTop: '20px' }}>
            {/* Chart: Stock Movements */}
            {can('warehouse.view') && stats.overview && (
              <div className="panel dashboardPanel">
                <div className="panel__head">
                  <h3>حركة العمليات المخزنية</h3>
                  <Link to="/stock" className="linkBtn" aria-label="عرض سجل حركة المخزون بالكامل">
                    عرض السجل
                  </Link>
                </div>
                <BarChart
                  data={Object.entries(stats.overview.summaryByType).map(([k, v]) => ({
                    label: TYPE_AR[k] ?? k,
                    value: v,
                    tone: { IN: 'green', OUT: 'red', TRANSFER: 'blue', ADJUSTMENT: 'amber', RETURN: 'purple' }[k],
                  }))}
                />
              </div>
            )}

            {/* Recent Documents */}
            {can('archive.view') && (
              <div className="panel dashboardPanel">
                <div className="panel__head">
                  <h3>أحدث المستندات المضافة</h3>
                  <Link to="/archive" className="linkBtn" aria-label="الانتقال إلى الأرشيف">
                    الأرشيف
                  </Link>
                </div>
                {stats.recentDocs.length === 0 ? (
                  <p className="muted small" style={{ padding: '16px 0' }}>لا توجد مستندات بعد.</p>
                ) : (
                  <ul className="recentList" aria-label="قائمة أحدث المستندات">
                    {stats.recentDocs.map((doc) => (
                      <li key={doc.id}>
                        <span className="recentList__title" title={doc.title}>{doc.title}</span>
                        <div className="recentList__meta">
                          <div className="recentList__actions">
                            <PreviewDocButton small documentId={doc.id} fileName={doc.fileName} label="فتح" />
                            <DownloadDocButton small documentId={doc.id} fileName={doc.fileName} />
                          </div>
                          <Badge tone="blue">{doc.category}</Badge>
                          <span className="muted small num">{new Date(doc.updatedAt).toLocaleDateString('ar-EG')}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Recent Stock Movements */}
            {can('warehouse.view') && (
              <div className="panel dashboardPanel">
                <div className="panel__head">
                  <h3>أحدث الحركات اليومية</h3>
                  <Link to="/stock" className="linkBtn" aria-label="الانتقال لإدارة المخزون">
                    إدارة المخزون
                  </Link>
                </div>
                {stats.recentMovements.length === 0 ? (
                  <p className="muted small" style={{ padding: '16px 0' }}>لا توجد حركات مخزنية مسجلة حديثاً.</p>
                ) : (
                  <ul className="recentList" aria-label="قائمة أحدث الحركات المخزنية">
                    {stats.recentMovements.map((t) => (
                      <li key={t.id}>
                        <strong className="recentList__title num">{t.number ?? t.type}</strong>
                        <Badge tone={t.type === 'OUT' ? 'red' : t.type === 'IN' ? 'green' : 'blue'}>
                          {TYPE_AR[t.type] ?? t.type}
                        </Badge>
                        <span className="muted small num">{t.date}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Low Stock Alert Table */}
          {can('warehouse.view') && stats.overview && stats.overview.lowStock.length > 0 && (
            <div className="panel panel--alert" style={{ marginTop: '20px' }}>
              <div className="panel__head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IconAlert size={20} />
                  <h3>تنبيه تشغيلي: أصناف تحت حد الأمان المطلوب</h3>
                </div>
                <Link to="/stock" className="linkBtn" aria-label="إدارة المخزون لمعالجة النواقص">
                  إدارة المخزون
                </Link>
              </div>
              <div className="tableScroll">
                <table className="table table--flat">
                  <thead>
                    <tr>
                      <th scope="col">كود الصنف</th>
                      <th scope="col">اسم الصنف</th>
                      <th scope="col">الرصيد الفعلي</th>
                      <th scope="col">الحد الأدنى</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.overview.lowStock.slice(0, 5).map(({ item, quantity }) => (
                      <tr key={item.id}>
                        <td className="num">{item.code}</td>
                        <td>{item.name}</td>
                        <td>
                          <Badge tone="red">
                            <span className="num">{quantity}</span>
                          </Badge>
                        </td>
                        <td className="num">{item.minimumStock ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
