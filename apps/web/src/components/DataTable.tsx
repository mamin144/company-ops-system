import type { ReactNode } from 'react';
import { EmptyState, SkeletonTable } from './ui';
import { IconEdit, IconTrash } from './Icons';
import type { Paged } from '../lib/api';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
}

export const DataTable = <T extends { id: string }>({
  columns,
  data,
  loading,
  error,
  onRetry,
  sortBy,
  sortDir,
  onSort,
  onPage,
  actions,
}: {
  columns: Column<T>[];
  data: Paged<T> | null;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  onPage?: (page: number) => void;
  actions?: (row: T) => ReactNode;
}) => {
  if (loading && !data) return <SkeletonTable />;
  if (error && !data)
    return (
      <div className="tableWrap">
        <div className="errorState">
          <div className="emptyState__title">{error}</div>
          <p className="muted small">تعذر تحميل البيانات. تحقق من الصلاحيات أو الاتصال ثم أعد المحاولة.</p>
          {onRetry ? <button className="btn btn--primary" onClick={onRetry}>إعادة المحاولة</button> : null}
        </div>
      </div>
    );
  if (!data) return <EmptyState title="تعذر تحميل البيانات" hint="تحقق من اتصال الخادم ثم أعد المحاولة" />;

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="tableWrap">
      <div className="tableScroll">
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={c.sortable && onSort ? () => onSort(c.key) : undefined}
                  className={c.sortable ? 'sortable' : undefined}
                >
                  {c.label}
                  {sortBy === c.key ? <span className="sortArrow">{sortDir === 'asc' ? '↑' : '↓'}</span> : null}
                </th>
              ))}
              {actions ? <th className="colActions">إجراءات</th> : null}
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)}>
                  <EmptyState hint="جرّب تعديل البحث أو الفلاتر" />
                </td>
              </tr>
            ) : (
              data.items.map((row) => (
                <tr key={row.id}>
                  {columns.map((c) => (
                    <td key={c.key}>{c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}</td>
                  ))}
                  {actions ? (
                    <td className="colActions">
                      <div className="rowActions">
                        {actions(row)}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <span className="pager__info">
          الإجمالي <strong>{data.total}</strong>
        </span>
        {pages > 1 ? (
          <div className="pager__nav">
            <button className="btn btn--sm btn--ghost" disabled={data.page <= 1} onClick={() => onPage?.(data.page - 1)}>السابق</button>
            <span className="pager__page">صفحة {data.page} / {pages}</span>
            <button className="btn btn--sm btn--ghost" disabled={data.page >= pages} onClick={() => onPage?.(data.page + 1)}>التالي</button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const EditDeleteActions = ({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) => (
  <>
    <button className="iconBtn iconBtn--hover" title="تعديل" onClick={onEdit}><IconEdit size={15} /></button>
    <button className="iconBtn iconBtn--hover iconBtn--danger" title="حذف" onClick={onDelete}><IconTrash size={15} /></button>
  </>
);
