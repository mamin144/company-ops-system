import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { ImportHistoryEntry } from '@cos/shared';
import { Badge, ConfirmDialog, EmptyState, useToast } from '../components/ui';
import { DataTable } from '../components/DataTable';
import { useAuth } from '../context/AuthContext';
import { PageShell, ResponsiveContainer } from '../components/ResponsiveLayout';
import {
  IconSettings,
  IconSun,
  IconMoon,
  IconShield,
  IconRefresh,
  IconDownload,
  IconUpload,
  IconAlert,
} from '../components/Icons';
import { PERMISSIONS_AR } from '../lib/permissions';

interface BackupInfo {
  id: string;
  name: string;
  hasFiles: boolean;
}

const ROLE_AR: Record<string, string> = {
  admin: 'مدير النظام',
  management: 'الإدارة',
  warehouse: 'مستودعات',
  technical: 'فني',
  viewer: 'مشاهدة',
};

export const SettingsPage = () => {
  const toast = useToast();
  const { user, can } = useAuth();

  const [activeTab, setActiveTab] = useState<'backups' | 'import-history' | 'appearance' | 'account' | 'about'>('backups');
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [history, setHistory] = useState<ImportHistoryEntry[]>([]);
  const [restoreTarget, setRestoreTarget] = useState<BackupInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');

  // Appearance state synchronized with document and localStorage
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  const changeTheme = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    document.documentElement.dataset.theme = newTheme;
    localStorage.setItem('theme', newTheme);
    window.dispatchEvent(new CustomEvent('cos:theme-change', { detail: newTheme }));
    toast('success', `تم التبديل إلى ${newTheme === 'dark' ? 'الوضع الليلي' : 'الوضع النهاري'}`);
  };

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<'light' | 'dark'>;
      if (customEvent.detail) {
        setTheme(customEvent.detail);
      } else {
        setTheme((localStorage.getItem('theme') as 'light' | 'dark') || 'light');
      }
    };
    window.addEventListener('cos:theme-change', handleThemeChange);
    window.addEventListener('storage', handleThemeChange);
    return () => {
      window.removeEventListener('cos:theme-change', handleThemeChange);
      window.removeEventListener('storage', handleThemeChange);
    };
  }, []);

  const load = useCallback(() => {
    if (can('backup.manage')) {
      void api.get<Array<{ name: string; hasFiles: boolean }>>('/api/backups')
        .then((list) => setBackups(list.map((b) => ({ ...b, id: b.name }))))
        .catch(() => setBackups([]));
    }
    void api.get<ImportHistoryEntry[]>('/api/import/history').then(setHistory).catch(() => setHistory([]));
  }, [can]);

  useEffect(() => {
    load();
  }, [load]);

  const createBackup = async () => {
    setBusy(true);
    try {
      await api.post('/api/backups');
      toast('success', 'تم إنشاء نسخة احتياطية كاملة (بيانات + ملفات)');
      load();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'فشل النسخ الاحتياطي');
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async () => {
    if (!restoreTarget) return;
    setBusy(true);
    try {
      const res = await api.post<{ safetyBackup: string }>(`/api/backups/${restoreTarget.name}/restore`);
      toast('success', `تم الاستعادة. نسخة أمان من الحالة السابقة: ${res.safetyBackup}`);
      setRestoreTarget(null);
      load();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'فشل الاستعادة');
    } finally {
      setBusy(false);
    }
  };

  // Filtered import history
  const filteredHistory = useMemo(() => {
    if (!historyQuery.trim()) return history;
    const q = historyQuery.toLowerCase();
    return history.filter(
      (h) =>
        h.fileName.toLowerCase().includes(q) ||
        h.entity.toLowerCase().includes(q) ||
        (h.username && h.username.toLowerCase().includes(q))
    );
  }, [history, historyQuery]);

  // Import stats
  const importStats = useMemo(() => {
    const totalRuns = history.length;
    const totalSuccessfulRows = history.reduce((acc, curr) => acc + (curr.successfulRows || 0), 0);
    const totalFailedRows = history.reduce((acc, curr) => acc + (curr.failedRows || 0), 0);
    return { totalRuns, totalSuccessfulRows, totalFailedRows };
  }, [history]);

  return (
    <ResponsiveContainer maxWidth="1380px">
      <PageShell
        title="الإعدادات"
        description="إدارة النسخ الاحتياطي، سجل الاستيراد، المظهر وتفضيلات النظام"
        actions={
          activeTab === 'backups' && can('backup.manage') ? (
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy}
              onClick={createBackup}
              aria-busy={busy}
            >
              <IconDownload size={16} />
              <span>{busy ? 'جاري النسخ الاحتياطي…' : 'نسخة احتياطية الآن'}</span>
            </button>
          ) : activeTab === 'import-history' ? (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={load}
              title="تحديث السجل"
              aria-label="تحديث سجل الاستيراد"
            >
              <IconRefresh size={16} />
              <span>تحديث السجل</span>
            </button>
          ) : null
        }
      >
        {/* Navigation Tabs */}
        <div className="settingsTabs" role="tablist" aria-label="أقسام الإعدادات">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'backups'}
            className={`settingsTabBtn ${activeTab === 'backups' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('backups')}
          >
            <IconDownload size={16} />
            <span>النسخ الاحتياطي والاستعادة</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'import-history'}
            className={`settingsTabBtn ${activeTab === 'import-history' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('import-history')}
          >
            <IconUpload size={16} />
            <span>سجل استيراد Excel</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'appearance'}
            className={`settingsTabBtn ${activeTab === 'appearance' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            <IconSun size={16} />
            <span>المظهر والعرض</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'account'}
            className={`settingsTabBtn ${activeTab === 'account' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('account')}
          >
            <IconShield size={16} />
            <span>الحساب والأمان</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'about'}
            className={`settingsTabBtn ${activeTab === 'about' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('about')}
          >
            <IconSettings size={16} />
            <span>عن النظام و PWA</span>
          </button>
        </div>

        {/* ============================================================
         * TAB 1: BACKUPS & RESTORE
         * ============================================================ */}
        {activeTab === 'backups' && (
          <div role="tabpanel" aria-labelledby="tab-backups">
            {!can('backup.manage') ? (
              <EmptyState
                title="غير مصرح بإدارة النسخ الاحتياطي"
                hint="تحتاج إلى صلاحية إدارة النسخ الاحتياطي (backup.manage) للوصول إلى هذه الوظيفة."
              />
            ) : (
              <>
                <div className="settingsBanner">
                  <div className="settingsBanner__icon">
                    <IconAlert size={20} />
                  </div>
                  <div className="settingsBanner__text">
                    <strong>الاستعادة الآمنة:</strong> عند تنفيذ استعادة لأي نسخة احتياطية سابقة،
                    يقوم النظام تلقائياً بإنشاء لقطة أمان فورية (Safety Snapshot) للحالة الحالية قبل الاستبدال،
                    مما يضمن عدم فقدان أية بيانات قيد العمل.
                  </div>
                </div>

                <div className="settingsStatGrid">
                  <div className="settingsStatCard">
                    <span className="settingsStatCard__label">عدد النسخ المحفوظة</span>
                    <span className="settingsStatCard__val">{backups.length}</span>
                  </div>
                  <div className="settingsStatCard">
                    <span className="settingsStatCard__label">أحدث نسخة احتياطية</span>
                    <span className="settingsStatCard__val" style={{ fontSize: '15px' }}>
                      {backups[0]?.name ?? 'لا توجد نسخ بعد'}
                    </span>
                  </div>
                  <div className="settingsStatCard">
                    <span className="settingsStatCard__label">نطاق النسخ</span>
                    <span className="settingsStatCard__val" style={{ fontSize: '15px' }}>
                      قاعدة البيانات + الملفات
                    </span>
                  </div>
                </div>

                <div className="panel">
                  <div className="panel__head">
                    <h3>النسخ المحفوظة على الخادم</h3>
                  </div>
                  {backups.length === 0 ? (
                    <EmptyState
                      title="لا توجد نسخ محفوظة بعد"
                      hint="يمكنك الضغط على زر 'نسخة احتياطية الآن' لإنشاء أول لقطة للنظام."
                    />
                  ) : (
                    <DataTable
                      loading={false}
                      data={{ items: backups, total: backups.length, page: 1, pageSize: 50 }}
                      columns={[
                        {
                          key: 'name',
                          label: 'اسم النسخة',
                          render: (b: BackupInfo) => <strong style={{ direction: 'ltr', display: 'inline-block' }}>{b.name}</strong>,
                        },
                        {
                          key: 'scope',
                          label: 'المحتويات',
                          render: (b: BackupInfo) => (
                            <Badge tone={b.hasFiles ? 'green' : 'amber'}>
                              {b.hasFiles ? 'بيانات + ملفات' : 'قاعدة البيانات فقط'}
                            </Badge>
                          ),
                        },
                        {
                          key: 'actions',
                          label: 'الإجراءات',
                          render: (b: BackupInfo) => (
                            <button
                              type="button"
                              className="btn btn--sm btn--ghost"
                              onClick={() => setRestoreTarget(b)}
                              disabled={busy}
                              title={`استعادة النسخة ${b.name}`}
                            >
                              استعادة
                            </button>
                          ),
                        },
                      ]}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ============================================================
         * TAB 2: IMPORT HISTORY
         * ============================================================ */}
        {activeTab === 'import-history' && (
          <div role="tabpanel" aria-labelledby="tab-import-history">
            <div className="settingsStatGrid">
              <div className="settingsStatCard">
                <span className="settingsStatCard__label">إجمالي عمليات الاستيراد</span>
                <span className="settingsStatCard__val">{importStats.totalRuns}</span>
              </div>
              <div className="settingsStatCard">
                <span className="settingsStatCard__label">السجلات الناجحة</span>
                <span className="settingsStatCard__val" style={{ color: 'var(--success)' }}>
                  {importStats.totalSuccessfulRows}
                </span>
              </div>
              <div className="settingsStatCard">
                <span className="settingsStatCard__label">السجلات المتعثرة</span>
                <span
                  className="settingsStatCard__val"
                  style={{ color: importStats.totalFailedRows > 0 ? 'var(--danger)' : 'var(--muted)' }}
                >
                  {importStats.totalFailedRows}
                </span>
              </div>
            </div>

            <div className="panel">
              <div className="panel__head" style={{ flexWrap: 'wrap', gap: '12px' }}>
                <h3>سجل استيراد ملفات Excel</h3>
                <div style={{ maxWidth: '320px', width: '100%' }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="بحث باسم الملف أو الكيان أو المستخدم…"
                    value={historyQuery}
                    onChange={(e) => setHistoryQuery(e.target.value)}
                    aria-label="بحث في سجل الاستيراد"
                  />
                </div>
              </div>

              {filteredHistory.length === 0 ? (
                <EmptyState
                  title="لا يوجد استيراد مسجل"
                  hint={historyQuery ? 'لا توجد نتائج مطابقة لبحثك' : 'لم يتم تسجيل عمليات استيراد بعد'}
                />
              ) : (
                <DataTable
                  loading={false}
                  data={{ items: filteredHistory, total: filteredHistory.length, page: 1, pageSize: 50 }}
                  columns={[
                    {
                      key: 'date',
                      label: 'التاريخ والوقت',
                      render: (h: ImportHistoryEntry) => (
                        <span style={{ direction: 'ltr', display: 'inline-block' }}>
                          {new Date(h.date).toLocaleString('ar-EG')}
                        </span>
                      ),
                    },
                    {
                      key: 'entity',
                      label: 'الكيان',
                      render: (h: ImportHistoryEntry) => <Badge tone="blue">{h.entity}</Badge>,
                    },
                    {
                      key: 'file',
                      label: 'اسم الملف',
                      render: (h: ImportHistoryEntry) => <strong style={{ direction: 'ltr', display: 'inline-block' }}>{h.fileName}</strong>,
                    },
                    {
                      key: 'user',
                      label: 'المستخدم',
                      render: (h: ImportHistoryEntry) => h.username || '—',
                    },
                    {
                      key: 'result',
                      label: 'النتيجة',
                      render: (h: ImportHistoryEntry) => (
                        <span>
                          <strong style={{ color: 'var(--success)' }}>{h.successfulRows} نجح</strong>
                          {h.failedRows > 0 && (
                            <>
                              {' · '}
                              <strong style={{ color: 'var(--danger)' }}>{h.failedRows} فشل</strong>
                            </>
                          )}
                        </span>
                      ),
                    },
                    {
                      key: 'errors',
                      label: 'تفاصيل الأخطاء',
                      render: (h: ImportHistoryEntry) => (
                        <span className="small muted">
                          {h.errors && h.errors.length > 0 ? h.errors.slice(0, 2).join(' | ') : '—'}
                        </span>
                      ),
                    },
                  ]}
                />
              )}
            </div>
          </div>
        )}

        {/* ============================================================
         * TAB 3: APPEARANCE & THEME
         * ============================================================ */}
        {activeTab === 'appearance' && (
          <div role="tabpanel" aria-labelledby="tab-appearance">
            <div className="panel">
              <div className="panel__head">
                <h3>سمة الواجهة والمظهر</h3>
              </div>
              <p className="muted small">
                اختر المظهر المناسب لك. يتم حفظ اختيارك محلياً وتطبيقه فورياً على كافة شاشات المنظومة.
              </p>

              <div className="settingsThemeGrid">
                {/* Light Theme */}
                <button
                  type="button"
                  className={`settingsThemeCard ${theme === 'light' ? 'is-selected' : ''}`}
                  onClick={() => changeTheme('light')}
                  aria-pressed={theme === 'light'}
                >
                  <div className="settingsThemeCard__preview settingsThemeCard__preview--light">
                    <div style={{ width: '30%', background: '#2563eb', height: '100%' }} />
                    <div style={{ width: '70%', background: '#ffffff', padding: '8px' }}>
                      <div style={{ width: '60%', height: '8px', background: '#e2e8f0', borderRadius: '4px', marginBottom: '6px' }} />
                      <div style={{ width: '85%', height: '8px', background: '#f1f5f9', borderRadius: '4px' }} />
                    </div>
                  </div>
                  <div className="settingsThemeCard__content">
                    <div>
                      <strong style={{ fontSize: '15px' }}>الوضع النهاري (Light)</strong>
                      <p className="small muted" style={{ margin: '2px 0 0' }}>تباين واضح ومريح للإضاءة العادية</p>
                    </div>
                    {theme === 'light' && <Badge tone="green">مفعل</Badge>}
                  </div>
                </button>

                {/* Dark Theme */}
                <button
                  type="button"
                  className={`settingsThemeCard ${theme === 'dark' ? 'is-selected' : ''}`}
                  onClick={() => changeTheme('dark')}
                  aria-pressed={theme === 'dark'}
                >
                  <div className="settingsThemeCard__preview settingsThemeCard__preview--dark">
                    <div style={{ width: '30%', background: '#1d4ed8', height: '100%' }} />
                    <div style={{ width: '70%', background: '#101827', padding: '8px' }}>
                      <div style={{ width: '60%', height: '8px', background: '#1e2e47', borderRadius: '4px', marginBottom: '6px' }} />
                      <div style={{ width: '85%', height: '8px', background: '#172235', borderRadius: '4px' }} />
                    </div>
                  </div>
                  <div className="settingsThemeCard__content">
                    <div>
                      <strong style={{ fontSize: '15px' }}>الوضع الليلي (Dark)</strong>
                      <p className="small muted" style={{ margin: '2px 0 0' }}>تباين مريح لتقليل إجهاد العين</p>
                    </div>
                    {theme === 'dark' && <Badge tone="green">مفعل</Badge>}
                  </div>
                </button>
              </div>

              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '14px' }}>إمكانية الوصول والحركة</h4>
                <p className="small muted" style={{ margin: 0, lineHeight: 1.6 }}>
                  تدعم المنظومة تلقائياً تفضيل تقليل الحركة <code>prefers-reduced-motion</code> وإرشادات WCAG 2.2 AA،
                  حيث يتم تعطيل الانتقالات التلقائية للمستخدمين الذين يفضلون تقليل المؤثرات الحركية على مستوى نظام التشغيل.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
         * TAB 4: ACCOUNT & SECURITY
         * ============================================================ */}
        {activeTab === 'account' && (
          <div role="tabpanel" aria-labelledby="tab-account">
            <div className="panel">
              <div className="settingsProfileHeader">
                <div className="settingsAvatar">
                  {user?.fullName ? user.fullName.slice(0, 1) : 'م'}
                </div>
                <div className="settingsProfileMeta">
                  <h3 className="settingsProfileName">{user?.fullName ?? 'المستخدم'}</h3>
                  <div className="settingsProfileRole">
                    <span className="muted small">اسم المستخدم: <strong>{user?.username}</strong></span>
                    <span>•</span>
                    <Badge tone="blue">{ROLE_AR[user?.roleName ?? ''] ?? user?.roleName}</Badge>
                    <Badge tone={user?.isActive ? 'green' : 'red'}>{user?.isActive ? 'نشط' : 'معطل'}</Badge>
                  </div>
                </div>
              </div>

              <div className="panel__head">
                <h3>معلومات الهوية والأمان</h3>
              </div>
              <div className="settingsInfoList">
                <div className="settingsInfoItem">
                  <span className="settingsInfoItem__label">المعرّف الداخلي</span>
                  <span className="settingsInfoItem__value" style={{ direction: 'ltr', textAlign: 'right' }}>
                    {user?.id ?? '—'}
                  </span>
                </div>
                <div className="settingsInfoItem">
                  <span className="settingsInfoItem__label">حالة الجلسة</span>
                  <span className="settingsInfoItem__value" style={{ color: 'var(--success)' }}>
                    جلسة مشفرة نشطة (HttpOnly Cookie)
                  </span>
                </div>
                <div className="settingsInfoItem">
                  <span className="settingsInfoItem__label">نمط إدارة كلمات المرور</span>
                  <span className="settingsInfoItem__value">
                    إدارة مركزية مؤمنة عبر لوحة الإدارة
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '24px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '14px' }}>الصلاحيات الفعالة على النظام</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {user?.permissions && user.permissions.length > 0 ? (
                    user.permissions.map((perm) => (
                      <span key={perm} className="badge badge--gray" title={perm}>
                        {PERMISSIONS_AR[perm] ?? perm}
                      </span>
                    ))
                  ) : (
                    <span className="muted small">لا توجد صلاحيات مخصصة</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
         * TAB 5: ABOUT & APPLICATION INFO
         * ============================================================ */}
        {activeTab === 'about' && (
          <div role="tabpanel" aria-labelledby="tab-about">
            <div className="panel">
              <div className="panel__head">
                <h3>معلومات المنظومة والـ PWA</h3>
              </div>
              <div className="settingsInfoList">
                <div className="settingsInfoItem">
                  <span className="settingsInfoItem__label">اسم النظام</span>
                  <span className="settingsInfoItem__value">Company Operations System (COS)</span>
                </div>
                <div className="settingsInfoItem">
                  <span className="settingsInfoItem__label">الإصدار والبيئة</span>
                  <span className="settingsInfoItem__value">v1.3.0 Enterprise PWA</span>
                </div>
                <div className="settingsInfoItem">
                  <span className="settingsInfoItem__label">دعم العمل دون اتصال (Offline Mode)</span>
                  <span className="settingsInfoItem__value" style={{ color: 'var(--success)' }}>
                    مفعل (Service Worker Active)
                  </span>
                </div>
                <div className="settingsInfoItem">
                  <span className="settingsInfoItem__label">حالة الاتصال الحالية</span>
                  <span className="settingsInfoItem__value">
                    {navigator.onLine ? 'متصل بالشبكة (Online)' : 'وضع عدم الاتصال (Offline)'}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                <p className="small muted" style={{ margin: 0 }}>
                  تطبيق الويب التقدمي (PWA) مجهز بحزمة أمان وتخزين مؤقت كاملة تتيح تحميل غلاف النظام والبيانات الأساسية حتى في ظروف انقطاع شبكة الإنترنت.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Restore Confirmation Dialog */}
        <ConfirmDialog
          open={!!restoreTarget}
          text={`سيتم استبدال البيانات الحالية بمحتوى النسخة "${restoreTarget?.name}". سيتم أخذ لقطة أمان تلقائياً من الحالة الحالية قبل الاستعادة. متابعة؟`}
          onConfirm={doRestore}
          onCancel={() => setRestoreTarget(null)}
        />
      </PageShell>
    </ResponsiveContainer>
  );
};

