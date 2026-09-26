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

export const Modal = ({
  title,
  open,
  onClose,
  children,
  wide,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      window.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        className={`modal ${wide ? 'modal--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal__head">
          <h2 id="modal-title">{title}</h2>
          <button
            type="button"
            className="iconBtn"
            onClick={onClose}
            aria-label="إغلاق النافذة"
          >
            ✕
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
};

export const ConfirmDialog = ({
  open,
  text,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  text: string;
  onConfirm: () => void;
  onCancel: () => void;
}) => (
  <Modal title="تأكيد العملية" open={open} onClose={onCancel}>
    <p className="confirmText">{text}</p>
    <div className="formActions">
      <button type="button" className="btn btn--danger" onClick={onConfirm}>تأكيد</button>
      <button type="button" className="btn btn--ghost" onClick={onCancel}>إلغاء</button>
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

export const Field = ({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) => (
  <label className="field">
    <span className="field__label">{label}</span>
    {children}
    {hint && !error && <span className="field__hint small muted">{hint}</span>}
    {error && <span className="field__error small dangerText">{error}</span>}
  </label>
);

export const TextInput = ({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input className={`input ${className}`} {...props} />
);

export const SearchInput = ({
  value,
  onChange,
  placeholder = 'بحث…',
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) => (
  <div className={`searchBox ${className}`}>
    <IconSearch size={16} />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
    />
  </div>
);

export const Select = ({ className = '', children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={`input select ${className}`} {...props}>{children}</select>
);

export const TextArea = ({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={`input textarea ${className}`} rows={3} {...props} />
);

export const EmptyState = ({
  title = 'لا توجد بيانات',
  hint,
  action,
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
}) => (
  <div className="emptyState" role="status">
    <div className="emptyState__art" aria-hidden="true" />
    <div className="emptyState__title">{title}</div>
    {hint ? <div className="emptyState__hint">{hint}</div> : null}
    {action ? <div className="emptyState__action" style={{ marginTop: '12px' }}>{action}</div> : null}
  </div>
);

export const SkeletonTable = ({ rows = 6 }: { rows?: number }) => (
  <div className="tableWrap skeletonTable" aria-busy="true" aria-label="جاري التحميل">
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

export const Button = ({
  variant = 'primary',
  size,
  className = '',
  busy = false,
  disabled,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'danger' | 'ghost';
  size?: 'sm';
  busy?: boolean;
}) => (
  <button
    type={props.type || 'button'}
    className={`btn btn--${variant} ${size === 'sm' ? 'btn--sm' : ''} ${busy ? 'btn--busy' : ''} ${className}`}
    disabled={disabled || busy}
    aria-busy={busy}
    {...props}
  >
    {busy ? 'جاري التحميل…' : children}
  </button>
);