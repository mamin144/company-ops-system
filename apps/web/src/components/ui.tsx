import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconSearch } from './Icons';

/* ---------- Toast ---------- */

type Toast = { id: number; kind: 'success' | 'error'; text: string };
const ToastContext = createContext<(kind: Toast['kind'], text: string) => void>(() => {});

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind}`}>{t.text}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

/* ---------- Modal / Confirm ---------- */

export const Modal = ({ title, open, onClose, children, wide }: { title: string; open: boolean; onClose: () => void; children: ReactNode; wide?: boolean }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal--wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal__head">
          <h2>{title}</h2>
          <button className="iconBtn" onClick={onClose} aria-label="إغلاق">✕</button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
  </div>
  );
};

export const ConfirmDialog = ({ open, text, onConfirm, onCancel }: { open: boolean; text: string; onConfirm: () => void; onCancel: () => void }) => (
  <Modal title="تأكيد العملية" open={open} onClose={onCancel}>
    <p className="confirmText">{text}</p>
    <div className="formActions">
      <button className="btn btn--danger" onClick={onConfirm}>تأكيد</button>
      <button className="btn btn--ghost" onClick={onCancel}>إلغاء</button>
    </div>
  </Modal>
);

/* ---------- Badge ---------- */

const badgeTones = ['blue', 'green', 'amber', 'red', 'gray', 'purple'] as const;
export type BadgeTone = (typeof badgeTones)[number];

export const Badge = ({ tone = 'gray', children }: { tone?: BadgeTone; children: ReactNode }) => (
  <span className={`badge badge--${tone}`}>{children}</span>
);

export const toneForStatus = (status: string): BadgeTone =>
  ({ active: 'green', completed: 'blue', planned: 'purple', 'on-hold': 'amber', cancelled: 'red', inactive: 'gray', central: 'purple', site: 'blue' }[status] as BadgeTone) ?? 'gray';

export const toneForKey = (key: string): BadgeTone =>
  ({ IN: 'green', OUT: 'red', TRANSFER: 'blue', ADJUSTMENT: 'amber', RETURN: 'purple' }[key] as BadgeTone) ?? 'gray';

/* ---------- Form fields ---------- */

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="field">
    <span className="field__label">{label}</span>
    {children}
  </label>
);

export const TextInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input className="input" {...props} />
);

export const SearchInput = ({ value, onChange, placeholder = 'بحث…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <div className="searchBox">
    <IconSearch size={16} />
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
  </div>
);

export const Select = ({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className="input" {...props}>{children}</select>
);

export const TextArea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className="input" rows={3} {...props} />
);

export const EmptyState = ({ title = 'لا توجد بيانات', hint }: { title?: string; hint?: string }) => (
  <div className="emptyState">
    <div className="emptyState__art" />
    <div className="emptyState__title">{title}</div>
    {hint ? <div className="emptyState__hint">{hint}</div> : null}
  </div>
);

export const SkeletonTable = ({ rows = 6 }: { rows?: number }) => (
  <div className="tableWrap skeletonTable">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="skeletonRow"><span /><span /><span /><span /></div>
    ))}
  </div>
);

/**
 * Back button for INTERNAL pages only (detail/nested screens).
 * Goes back one step in router history — never add to top-level pages.
 */
export const BackButton = ({ label = 'رجوع' }: { label?: string }) => {
  const navigate = useNavigate();
  return (
    <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate(-1)}>
      ← {label}
    </button>
  );
};
