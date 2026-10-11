import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
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
<<<<<<< HEAD
);

/* ---------- Command Deck primitives (Phase 3) ---------- */

/** Icon-only button. aria-label is required (fixing-accessibility: names). */
export const IconButton = ({
  label,
  size,
  className = '',
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  size?: 'sm' | 'lg';
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={`iconBtn ${size === 'sm' ? 'iconBtn--sm' : ''} ${size === 'lg' ? 'iconBtn--lg' : ''} ${className}`}
    {...props}
  >
    {children}
  </button>
);

/**
 * Responsive drawer shell.
 * - Always renders the panel (desktop rails stay visible via CSS).
 * - Overlay behavior (backdrop visibility class, Escape, focus trap, focus
 *   management) activates only when `open` AND the viewport matches the
 *   overlay breakpoint (mobile drawer). Desktop sticky rails are untouched.
 * - className passthrough preserves legacy selectors/tests
 *   (e.g. `sidebar` / `sidebar--open`).
 */
export const Drawer = ({
  open,
  onClose,
  title,
  labelledBy,
  className = 'drawer',
  openClassName,
  backdropClassName = 'drawerBackdrop',
  overlayBreakpoint = '(max-width: 1023px)',
  id,
  children,
  initialFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  labelledBy?: string;
  className?: string;
  openClassName?: string;
  backdropClassName?: string;
  overlayBreakpoint?: string;
  id?: string;
  children: ReactNode;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}) => {
  const panelRef = useRef<HTMLElement>(null);
  const prevFocus = useRef<Element | null>(null);
  const [isOverlay, setIsOverlay] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(overlayBreakpoint).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(overlayBreakpoint);
    const onChange = (e: MediaQueryListEvent) => {
      setIsOverlay(e.matches);
      // Leaving overlay mode must never trap focus on a persistent rail.
      if (!e.matches) onClose();
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [overlayBreakpoint, onClose]);

  // Re-sync overlay mode at the moment the drawer opens. A viewport change
  // landing between mount and listener registration would otherwise be lost
  // and leave stale overlay state (e2e race: resize right after login,
  // then open the drawer).
  useEffect(() => {
    if (open) setIsOverlay(window.matchMedia(overlayBreakpoint).matches);
  }, [open, overlayBreakpoint]);

  const overlayActive = open && isOverlay;

  useEffect(() => {
    if (!overlayActive) return undefined;
    prevFocus.current = document.activeElement;
    const panel = panelRef.current;
    const t = window.setTimeout(() => {
      (initialFocusRef?.current ?? panel)?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && panel) {
        const items = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      if (prevFocus.current instanceof HTMLElement) prevFocus.current.focus();
    };
  }, [overlayActive, onClose, initialFocusRef]);

  const openCls = openClassName ?? `${className}--open`;

  return (
    <>
      <div
        className={`${backdropClassName}${overlayActive ? ` ${backdropClassName}--visible` : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        id={id}
        ref={panelRef}
        className={open ? `${className} ${openCls}` : className}
        role={isOverlay ? 'dialog' : undefined}
        aria-modal={isOverlay || undefined}
        aria-label={labelledBy ? undefined : title}
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        {children}
      </aside>
    </>
  );
};

/** Eyebrow section header: title + trailing actions. */
export const SectionHead = ({
  title,
  actions,
}: {
  title: string;
  actions?: ReactNode;
}) => (
  <div className="sectionHead">
    <h3 className="sectionHead__title">{title}</h3>
    {actions ? <div className="sectionHead__actions">{actions}</div> : null}
  </div>
);

/** Signal light + text label. Tone supports the signal; text carries it. */
const statusTones = ['green', 'amber', 'red', 'blue', 'gray'] as const;
export type StatusTone = (typeof statusTones)[number];
export const StatusDot = ({ tone = 'gray', children }: { tone?: StatusTone; children: ReactNode }) => (
  <span className="statusDot" data-tone={tone}>
    <i aria-hidden="true" />
    <span>{children}</span>
  </span>
=======
>>>>>>> 22bb86216dfc3ef7502b7c36906e4665ecfd9f5e
);