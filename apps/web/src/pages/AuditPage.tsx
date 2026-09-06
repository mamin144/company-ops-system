import { useState } from 'react';
import { api, buildQuery } from '../lib/api';
import type { AuditLog } from '@cos/shared';
import { usePagedList } from '../hooks/usePagedList';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { Badge, Select, SearchInput } from '../components/ui';

const ACTION_TONE: Record<string, string> = {
  create: 'green', update: 'blue', delete: 'red', login: 'purple', logout: 'gray',
  approve: 'green', reject: 'red', submit: 'blue', 'status-change': 'amber',
  'stock-in': 'green', 'stock-out': 'red', transfer: 'blue', adjust: 'amber', return: 'purple',
};

const ENTITY_AR: Record<string, string> = {
  project: 'مشروع', document: 'مستند', warehouse: 'مخزن', item: 'صنف',
  'stock-transaction': 'حركة مخزنية', user: 'مستخدم', site: 'موقع',
  'material-request': 'طلب مواد', import: 'استيراد',
};

export const AuditPage = () => {
  const list = usePagedList<AuditLog>('/api/audit-logs');
  void useState; // keep hooks import minimal

  const columns: Column<AuditLog>[] = [
    { key: 'timestamp', label: 'الوقت', sortable: true, render: (l) => new Date(l.timestamp).toLocaleString('ar-EG') },
    { key: 'username', label: 'المستخدم' },
    { key: 'action', label: 'الإجراء', render: (l) => <Badge tone={(ACTION_TONE[l.action] as never) ?? 'gray'}>{l.action}</Badge> },
    { key: 'entity', label: 'الكيان', render: (l) => `${ENTITY_AR[l.entity] ?? l.entity}${l.entityId ? ` · ${l.entityId.slice(0, 8)}…` : ''}` },
    { key: 'ipAddress', label: 'IP' },
  ];

  return (
    <div className="page">
      <div className="pageHead">
        <div><h1>سجل التغييرات</h1><p>تتبع كل الإجراءات الحساسة في النظام</p></div>
        <div className="actions">
          <Select value={list.state.filters.action ?? ''} onChange={(e) => list.setFilter('action', e.target.value)}>
            <option value="">كل الإجراءات</option>
            {['create', 'update', 'delete', 'login', 'logout', 'approve', 'reject', 'submit', 'status-change'].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
          <Select value={list.state.filters.entity ?? ''} onChange={(e) => list.setFilter('entity', e.target.value)}>
            <option value="">كل الكيانات</option>
            {Object.entries(ENTITY_AR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <SearchInput value={list.state.q} onChange={list.setQ} placeholder="بحث بالمستخدم…" />
          <a className="btn btn--ghost" href={`/api/audit-logs${buildQuery({ ...list.state.filters, q: list.state.q })}`}>تحديث</a>
        </div>
      </div>

      <DataTable columns={columns} data={list.data} loading={list.loading} error={list.error} onRetry={() => void list.reload()} sortBy={list.state.sortBy} sortDir={list.state.sortDir} onSort={list.toggleSort} onPage={list.setPage} />
    </div>
  );
};
