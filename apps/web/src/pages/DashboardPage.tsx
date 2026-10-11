import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import type { Document, MaterialRequest, StockTransaction } from '@cos/shared';
import { Badge, SectionHead, StatusDot } from '../components/ui';
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
  const { can } = useAuth();
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
    // Partial dashboard: only request what this user may see, and never let
    // one denied/failed request take down the sections they ARE allowed.
    // A 403 is a silent fallback; anything else counts as a real failure.
    let failures = 0;
    const safe = <T,>(p: Promise<T>, fallback: T): Promise<T> =>
      p.catch((e) => {
        if (!(e instanceof ApiError) || e.status !== 403) failures++;
        return fallback;
      });
    const get = <T,>(perm: string | null, path: string, fallback: T): Promise<T> =>
      perm && !can(perm) ? Promise.resolve(fallback) : safe(api.get<T>(path), fallback);
    const TOTAL = 8;
    Promise.all([
      get<{ total: number }>('projects.view', '/api/projects?pageSize=1', { total: 0 }),
      get<{ total: number }>('archive.view', '/api/documents?pageSize=1', { total: 0 }),
      get<{ total: number }>('warehouse.view', '/api/warehouses?pageSize=1', { total: 0 }),
      get<{ total: number }>('warehouse.view', '/api/items?pageSize=1', { total: 0 }),
      get<Overview>('warehouse.view', '/api/stock/overview', { lowStock: [], summaryByType: {} }),
      get<{ items: Document[] }>('archive.view', '/api/documents?pageSize=5&sortBy=updatedAt&sortDir=desc', { items: [] }),
      get<MaterialRequest[]>('materialRequests.view', '/api/material-requests', []),
      get<{ items: MovementRow[] }>('warehouse.view', '/api/stock/history?pageSize=6', { items: [] }),
    ])
      .then(([p, d, w, i, s, docs, mrs, movements]) => {
        // Everything failed = real outage (server down) → show retry panel.
        // Anything less = show whatever sections this user may see.
        if (failures >= TOTAL) {
          setError('تعذر الاتصال بالخادم لجلب إحصائيات النظام');
          return;
        }
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
  const pendingCount = can('materialRequests.view') ? (stats?.pendingMRs ?? 0) : 0;
  const lowCount = can('warehouse.view') ? (stats?.lowStock ?? 0) : 0;

  return (
    <div className="page dashboardPage">
      {/* ============ Command header (flat operations-room surface) ============ */}
      <section className="dashHero" aria-label="موجز النظام">
        <div>
          <div className="dashEyebrow">
            <Badge tone="blue">غرفة العمليات</Badge>
            <span className="dashDate">
              {new Date().toLocaleDateString('ar-EG', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
          <h1>لوحة التحكم الرئيسية</h1>
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

      {/* ============ Attention queue: real exceptions only, permission-gated ============ */}
      {stats && (can('materialRequests.view') || can('warehouse.view')) && (
        <section className="panel dashAttention" aria-label="يحتاج انتباهك">
          <SectionHead title="يحتاج انتباهك" />
          {can('materialRequests.view') && stats.pendingMRs > 0 && (
            <Link className="dashAttention__row" to="/material-requests">
              <StatusDot tone="red">
                {pendingCount} طلبات مواد بانتظار الاعتماد
              </StatusDot>
              <span className="linkBtn">مراجعة</span>
            </Link>
          )}
          {can('warehouse.view') && stats.lowStock > 0 && (
            <Link className="dashAttention__row" to="/stock">
              <StatusDot tone="amber">
                {lowCount} أصناف تحت حد الأمان
              </StatusDot>
              <span className="linkBtn">معالجة</span>
            </Link>
          )}
          {pendingCount === 0 && lowCount === 0 && (
            <div className="dashAttention__row dashAttention__row--calm">
              <StatusDot tone="green">لا بنود عاجلة — كل المؤشرات مستقرة</StatusDot>
            </div>
          )}
        </section>
      )}

      {/* ============ Error State ============ */}
      {error && !stats && (
        <div className="panel panel--alert dashError">
          <div className="emptyState__title dashError__title">
            {error}
          </div>
          <p className="muted small dashError__hint">
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
              <div className="panel dashSkeleton" key={i}>
                <div className="skeletonRow dashSkeleton__row">
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
                  className="card card--link card--alert dashKpi--span"
                  to="/stock"
                  aria-label={`أصناف تحت حد الأمان: ${stats.lowStock}`}
                >
                  <span className="dashKpi--span__icon" aria-hidden="true">
                    <IconAlert size={18} />
                  </span>
                  <span className="dashKpi--span__text">
                    <span className="dashKpi--span__title">تنبيه حد الأمان</span>
                    <span className="dashKpi--span__sub dangerText">أصناف قاربت على النفاد — تتطلب معالجة</span>
                  </span>
                  <b className="num dashKpi--span__count">{stats.lowStock}</b>
                </Link>
              ) : (
                <div className="card card--ok dashKpi--span" aria-label="حالة المخزون: سليم ومستقر">
                  <span className="dashKpi--span__icon" aria-hidden="true">
                    <IconStock size={18} />
                  </span>
                  <span className="dashKpi--span__text">
                    <span className="dashKpi--span__title">حالة المخزون: مستقرة</span>
                    <span className="dashKpi--span__sub dashKpi--span__sub--ok">جميع الأرصدة فوق حد الأمان</span>
                  </span>
                </div>
              )
            )}
          </ResponsiveGrid>

          {/* ============ Operational Grid (Panels) ============ */}
          <div className="dashGrid dashGrid--spaced">
            {/* Chart: Stock Movements */}
            {can('warehouse.view') && stats.overview && (
              <div className="panel dashboardPanel">
                <SectionHead
                  title="حركة العمليات المخزنية"
                  actions={
                    <Link to="/stock" className="linkBtn" aria-label="عرض سجل حركة المخزون بالكامل">
                      عرض السجل
                    </Link>
                  }
                />
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
                <SectionHead
                  title="أحدث المستندات المضافة"
                  actions={
                    <Link to="/archive" className="linkBtn" aria-label="الانتقال إلى الأرشيف">
                      الأرشيف
                    </Link>
                  }
                />
                {stats.recentDocs.length === 0 ? (
                  <p className="muted small dashEmpty">لا توجد مستندات بعد.</p>
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
                <SectionHead
                  title="أحدث الحركات اليومية"
                  actions={
                    <Link to="/stock" className="linkBtn" aria-label="الانتقال لإدارة المخزون">
                      إدارة المخزون
                    </Link>
                  }
                />
                {stats.recentMovements.length === 0 ? (
                  <p className="muted small dashEmpty">لا توجد حركات مخزنية مسجلة حديثاً.</p>
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
            <div className="panel panel--alert dashGrid--spaced">
              <div className="panel__head dashLowHead">
                <div className="dashLowHead__title">
                  <IconAlert size={20} aria-hidden="true" />
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
