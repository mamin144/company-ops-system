import { useState } from 'react';
import type { AuditLog } from '@cos/shared';
import { usePagedList } from '../hooks/usePagedList';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { Badge, Select, SearchInput, Modal } from '../components/ui';
import { IconRefresh } from '../components/Icons';

const ACTION_TONE: Record<string, string> = {
  create: 'green',
  update: 'blue',
  delete: 'red',
  login: 'purple',
  logout: 'gray',
  approve: 'green',
  reject: 'red',
  submit: 'blue',
  'status-change': 'amber',
  'stock-in': 'green',
  'stock-out': 'red',
  transfer: 'blue',
  adjust: 'amber',
  return: 'purple',
};

const ACTION_AR: Record<string, string> = {
  create: 'إنشاء',
  update: 'تعديل',
  delete: 'حذف',
  login: 'تسجيل دخول',
  logout: 'تسجيل خروج',
  approve: 'اعتماد',
  reject: 'رفض',
  submit: 'إرسال',
  'status-change': 'تغيير حالة',
  'stock-in': 'إيداع مخزني',
  'stock-out': 'صرف مخزني',
  transfer: 'تحويل مخزني',
  adjust: 'تسوية رصيد',
  return: 'مرتجع',
};

const ENTITY_AR: Record<string, string> = {
  project: 'مشروع',
  document: 'مستند',
  warehouse: 'مخزن',
  item: 'صنف',
  'stock-transaction': 'حركة مخزنية',
  user: 'مستخدم',
  site: 'موقع',
  'material-request': 'طلب مواد',
  import: 'استيراد',
};

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'cookie', 'jwt', 'authorization', 'hash'];

/**
 * Recursively redacts sensitive keys from values before rendering in audit view
 */
function sanitizeAuditPayload(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(sanitizeAuditPayload);

  const cleanObj: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    const isSensitive = SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s));
    if (isSensitive) {
      cleanObj[k] = '[REDACTED]';
    } else {
      cleanObj[k] = sanitizeAuditPayload(v);
    }
  }
  return cleanObj;
}

export const AuditPage = () => {
  const list = usePagedList<AuditLog>('/api/audit-logs');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const columns: Column<AuditLog>[] = [
    {
      key: 'timestamp',
      label: 'الوقت والتاريخ',
      sortable: true,
      render: (l) => (
        <span className="num small" style={{ display: 'inline-block', direction: 'ltr', textAlign: 'right' }}>
          {new Date(l.timestamp).toLocaleString('ar-EG')}
        </span>
      ),
    },
    {
      key: 'username',
      label: 'المستخدم / المنفذ',
      render: (l) => (
        <span className="bold" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand)', display: 'inline-block' }} />
          {l.username || 'نظامي / غير محدد'}
        </span>
      ),
    },
    {
      key: 'action',
      label: 'نوع الإجراء',
      render: (l) => (
        <Badge tone={(ACTION_TONE[l.action] as never) ?? 'gray'}>
          {ACTION_AR[l.action] ? `${ACTION_AR[l.action]} (${l.action})` : l.action}
        </Badge>
      ),
    },
    {
      key: 'entity',
      label: 'الكيان المتأثر',
      render: (l) => (
        <span>
          <span className="bold">{ENTITY_AR[l.entity] ?? l.entity}</span>
          {l.entityId ? (
            <span className="mono small muted" style={{ marginRight: 6 }}>
              · {l.entityId.slice(0, 8)}…
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'ipAddress',
      label: 'عنوان IP',
      render: (l) => <span className="mono small muted">{l.ipAddress || '—'}</span>,
    },
    {
      key: 'actions',
      label: 'التفاصيل',
      render: (l) => (
        <button
          className="btn btn--sm btn--ghost"
          onClick={() => setSelectedLog(l)}
          title="عرض تفاصيل وسجل التغيير"
        >
          عرض التفاصيل
        </button>
      ),
    },
  ];

  return (
    <div className="page">
      <div className="invHeader">
        <div className="invHeader__titleGroup">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1>سجل التغييرات والعمليات</h1>
              <span className="heroChip num">{list.data?.total ?? 0} سجل</span>
            </div>
            <p>تتبع ومراقبة جميع الإجراءات التشغيلية والتغييرات الحساسة عبر المنظومة</p>
          </div>
        </div>
        <div className="actions">
          <button
            className="btn btn--ghost"
            onClick={() => void list.reload()}
            title="تحديث قائمة السجلات"
          >
            <IconRefresh size={16} /> تحديث
          </button>
        </div>
      </div>

      <div className="invToolbar">
        <Select
          aria-label="تصفية حسب نوع الإجراء"
          value={list.state.filters.action ?? ''}
          onChange={(e) => list.setFilter('action', e.target.value)}
        >
          <option value="">كل الإجراءات</option>
          {[
            'create',
            'update',
            'delete',
            'login',
            'logout',
            'approve',
            'reject',
            'submit',
            'status-change',
          ].map((a) => (
            <option key={a} value={a}>
              {ACTION_AR[a] ? `${ACTION_AR[a]} (${a})` : a}
            </option>
          ))}
        </Select>

        <Select
          aria-label="تصفية حسب الكيان"
          value={list.state.filters.entity ?? ''}
          onChange={(e) => list.setFilter('entity', e.target.value)}
        >
          <option value="">كل الكيانات</option>
          {Object.entries(ENTITY_AR).map(([v, l]) => (
            <option key={v} value={v}>
              {l} ({v})
            </option>
          ))}
        </Select>

        <SearchInput
          aria-label="بحث في سجل التغييرات"
          value={list.state.q}
          onChange={list.setQ}
          placeholder="بحث بالمستخدم أو المعرف أو الإجراء…"
        />

        {(list.state.q || Object.keys(list.state.filters).length > 0) && (
          <button className="btn btn--ghost" onClick={list.clearFilters}>
            مسح الفلاتر
          </button>
        )}
      </div>

      {/* Desktop View */}
      <div className="invTableDesktop">
        <DataTable
          columns={columns}
          data={list.data}
          loading={list.loading}
          error={list.error}
          onRetry={() => void list.reload()}
          sortBy={list.state.sortBy}
          sortDir={list.state.sortDir}
          onSort={list.toggleSort}
          onPage={list.setPage}
        />
      </div>

      {/* Mobile Card View (< 768px) */}
      <div className="auditGrid">
        {list.data?.items.map((log) => (
          <div key={log.id} className="auditCard">
            <div className="auditCard__top">
              <div className="auditCard__actionGroup">
                <Badge tone={(ACTION_TONE[log.action] as never) ?? 'gray'}>
                  {ACTION_AR[log.action] ? `${ACTION_AR[log.action]} (${log.action})` : log.action}
                </Badge>
                <span className="bold">{ENTITY_AR[log.entity] ?? log.entity}</span>
              </div>
              <span className="auditCard__time num">
                {new Date(log.timestamp).toLocaleDateString('ar-EG')}
              </span>
            </div>

            <div className="auditCard__meta">
              <div className="auditCard__metaItem">
                <span className="auditCard__metaLabel">المنفذ</span>
                <span className="auditCard__metaValue">{log.username || 'نظامي'}</span>
              </div>
              <div className="auditCard__metaItem">
                <span className="auditCard__metaLabel">عنوان IP</span>
                <span className="auditCard__metaValue mono small">{log.ipAddress || '—'}</span>
              </div>
              {log.entityId ? (
                <div className="auditCard__metaItem" style={{ gridColumn: 'span 2' }}>
                  <span className="auditCard__metaLabel">معرف الكيان</span>
                  <span className="auditCard__metaValue mono small">{log.entityId}</span>
                </div>
              ) : null}
            </div>

            <div className="auditCard__actions">
              <button
                className="btn btn--sm btn--ghost"
                onClick={() => setSelectedLog(log)}
              >
                عرض التفاصيل
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Event Details Modal */}
      {selectedLog ? (
        <Modal
          title="تفاصيل السجل والبيانات"
          open={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          wide
        >
          <div className="auditDetailsGrid">
            <div className="auditDetailsItem">
              <span className="auditDetailsItem__label">معرف السجل</span>
              <span className="auditDetailsItem__value mono">{selectedLog.id}</span>
            </div>
            <div className="auditDetailsItem">
              <span className="auditDetailsItem__label">الوقت والتاريخ</span>
              <span className="auditDetailsItem__value num">
                {new Date(selectedLog.timestamp).toLocaleString('ar-EG')}
              </span>
            </div>
            <div className="auditDetailsItem">
              <span className="auditDetailsItem__label">المستخدم</span>
              <span className="auditDetailsItem__value">{selectedLog.username || 'غير محدد'}</span>
            </div>
            <div className="auditDetailsItem">
              <span className="auditDetailsItem__label">الإجراء</span>
              <span className="auditDetailsItem__value">
                <Badge tone={(ACTION_TONE[selectedLog.action] as never) ?? 'gray'}>
                  {ACTION_AR[selectedLog.action] || selectedLog.action}
                </Badge>
              </span>
            </div>
            <div className="auditDetailsItem">
              <span className="auditDetailsItem__label">الكيان</span>
              <span className="auditDetailsItem__value">
                {ENTITY_AR[selectedLog.entity] ?? selectedLog.entity} ({selectedLog.entity})
              </span>
            </div>
            <div className="auditDetailsItem">
              <span className="auditDetailsItem__label">معرف الكيان</span>
              <span className="auditDetailsItem__value mono">{selectedLog.entityId || '—'}</span>
            </div>
            <div className="auditDetailsItem">
              <span className="auditDetailsItem__label">عنوان IP</span>
              <span className="auditDetailsItem__value mono">{selectedLog.ipAddress || '—'}</span>
            </div>
          </div>

          <div className="auditDiffContainer">
            <div className="auditDiffCol">
              <div className="auditDiffCol__title">
                <span>القيمة السابقة (Old Value)</span>
              </div>
              <div className="auditJsonBox">
                {selectedLog.oldValue ? (
                  JSON.stringify(sanitizeAuditPayload(selectedLog.oldValue), null, 2)
                ) : (
                  <span className="muted" style={{ fontStyle: 'italic' }}>لا توجد بيانات سابقة مسجلة</span>
                )}
              </div>
            </div>

            <div className="auditDiffCol">
              <div className="auditDiffCol__title">
                <span>القيمة الجديدة (New Value)</span>
              </div>
              <div className="auditJsonBox">
                {selectedLog.newValue ? (
                  JSON.stringify(sanitizeAuditPayload(selectedLog.newValue), null, 2)
                ) : (
                  <span className="muted" style={{ fontStyle: 'italic' }}>لا توجد بيانات جديدة مسجلة</span>
                )}
              </div>
            </div>
          </div>

          <div className="formActions" style={{ marginTop: 20 }}>
            <button className="btn btn--primary" onClick={() => setSelectedLog(null)}>
              إغلاق
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
};

