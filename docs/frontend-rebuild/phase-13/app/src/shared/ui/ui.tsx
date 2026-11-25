import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLang } from '@/i18n';
import { ERR_KEYS, ERR_PERM_PREFIX } from '@/services/api/adapters/mock/errorKeys';
import { STATUS_AR } from '@/services/api/adapters/mock/data';
import type { TKey, TVars } from '@/i18n';
import { Icon } from './icons';
import SplitText from './bits/SplitText';
import type { IconName } from './icons';
import FadeContent from './bits/FadeContent';

/* ---------- localized enum labels (Phase 3.12) ----------
   Every user-facing status/movement/type badge, option and chip goes through
   this helper instead of rendering STATUS_AR (Arabic-only) directly. Raw codes
   stay in stored data and export files; only the display is localized. */
const STATUS_KEY: Record<string, TKey> = {
  draft: 'stDraft', submitted: 'stSubmitted', 'under-review': 'stUnderReview',
  approved: 'stApproved', rejected: 'stRejected', superseded: 'stSuperseded',
  archived: 'stArchived', 'partially-issued': 'stPartiallyIssued', issued: 'stIssued',
  closed: 'stClosed', planned: 'stPlanned', active: 'stActive', 'on-hold': 'stOnHold',
  completed: 'stCompleted', cancelled: 'stCancelled',
  IN: 'stIn', OUT: 'stOut', TRANSFER: 'stTransfer', ADJUSTMENT: 'stAdjust', RETURN: 'stReturn',
  central: 'stCentral', site: 'stSite',
};
export const statusLabel = (t: (k: TKey, v?: TVars) => string, code?: string): string => {
  if (!code) return '';
  const k = STATUS_KEY[code];
  // Fall back to the Arabic map, then the raw code — never a blank cell.
  return k ? t(k) : (STATUS_AR[code] ?? code);
};

/* ---------- localized mock-error text (Phase 3.8) ----------
   The mock returns the original Arabic contract string in `error`. This
   resolves it to the active language without changing that shape:
     · explicit `errorKey` (+ `errorVars`) wins — used for messages whose
       text varies (permission name, BOQ code, status transition);
     · otherwise the static Arabic string is looked up in ERR_KEYS;
     · otherwise the raw string is shown (never blank, never a raw key). */
export const errText = (
  t: (k: TKey, v?: TVars) => string,
  res: { error?: string; errorKey?: string; errorVars?: Record<string, unknown> } | string | undefined | null,
): string => {
  if (!res) return '';
  const r = typeof res === 'string' ? { error: res } : res;
  if (r.errorKey) return t(r.errorKey as TKey, r.errorVars as TVars | undefined);
  const e = r.error;
  if (!e) return '';
  if (e.startsWith(ERR_PERM_PREFIX)) return t('eNoPerm', { perm: e.slice(ERR_PERM_PREFIX.length) });
  const k = ERR_KEYS[e] as TKey | undefined;
  return k ? t(k) : e;
};

/* ---------- toast ---------- */
const ToastCtx = createContext<(kind: 'success' | 'error' | 'info', text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<{ id: number; kind: string; text: string }[]>([]);
  const push = useCallback((kind: 'success' | 'error' | 'info', text: string) => {
    const id = Date.now() + Math.random();
    setItems((p) => [...p, { id, kind, text }]);
    setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => <div key={t.id} className={`toast toast--${t.kind}`}>{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  );
};

/* ---------- buttons / labels ---------- */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger'; size?: 'sm' };
export const Button = ({ variant = 'ghost', size, ...p }: BtnProps) => (
  <button type="button" className={`btn ${variant === 'ghost' ? '' : `btn--${variant}`} ${size === 'sm' ? 'btn--sm' : ''}`} {...p} />
);
export const IconButton = ({ label, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) => (
  <button type="button" className="iconBtn" aria-label={label} title={label} {...p}>{children}</button>
);
export const Badge = ({ tone = 'gray', children }: { tone?: 'blue' | 'green' | 'amber' | 'red' | 'gray'; children: ReactNode }) => (
  <span className={`badge badge--${tone}`}>{children}</span>
);
export const StatusDot = ({ tone = 'gray', children }: { tone?: 'green' | 'amber' | 'red' | 'blue' | 'gray'; children: ReactNode }) => (
  <span className="statusDot" data-tone={tone}><i aria-hidden="true" /><span>{children}</span></span>
);
/* SectionHead (Phase 3.17-D): `splitStartDelay` opts the title into the
   dashboard's staggered SplitText cascade (word-level, drops downward).
   Omit it and the plain static <h2> renders — every other page is untouched. */
export const SectionHead = ({ title, actions, splitStartDelay }: { title: string; actions?: ReactNode; splitStartDelay?: number }) => (
  <div className="sectionHead">
    {splitStartDelay !== undefined ? (
      <SplitText
        tag="h2"
        text={title}
        trigger="load"
        splitType="words"
        startDelay={splitStartDelay}
        duration={0.5}
        delay={45}
        from={{ y: -14, opacity: 0 }}
        to={{ y: 0, opacity: 1 }}
        textAlign="start"
      />
    ) : (
      <h2>{title}</h2>
    )}
    {actions ? <span className="acts">{actions}</span> : null}
  </div>
);

/* ---------- modal: trap + escape + restore + initial focus ---------- */
export const Modal = ({ title, open, onClose, wide, children }: { title: string; open: boolean; onClose: () => void; wide?: boolean; children: ReactNode }) => {
  const { t } = useLang();
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef<Element | null>(null);
  // Capture/restore the opener exactly once per open session. The onClose prop
  // is typically an inline arrow (new identity every parent render), so this
  // effect re-runs often — without the session guard it would re-capture focus
  // mid-session and restore it while the dialog is still open.
  const sessionOpen = useRef(false);
  useEffect(() => {
    if (open && !sessionOpen.current) {
      sessionOpen.current = true;
      prev.current = document.activeElement;
      const box = ref.current;
      /* Prefer a real field over the corner × so keyboard users land where
         the work is; the × stays in the Tab cycle (it is simply not first).
         The old implementation delayed this on a 30 ms timer, which raced
         fast input: a keystroke (or Playwright fill) arriving inside that
         window landed in whatever element had focus at the time — e.g. a
         BOQ edit dialog could type the unit price into the item-code field.
         Effects run after the DOM commit and the modal has no
         visibility:hidden initial state, so focus here synchronously. */
      const f = box?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled])')
        ?? box?.querySelector<HTMLElement>('button:not([disabled]), [href]');
      (f ?? box)?.focus();
    }
    if (!open && sessionOpen.current) {
      sessionOpen.current = false;
      const target = prev.current;
      prev.current = null;
      (target as HTMLElement | null)?.focus?.();
    }
    return undefined;
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const box = ref.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && box) {
        const items = Array.from(box.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]')).filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className={`modal${wide ? ' wide' : ''}`} data-lenis-prevent role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <button type="button" className="iconBtn modalX" aria-label={t('closeDialog')} title={t('closeDialog')} onClick={onClose}><Icon name="close" size={17} /></button>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
};
export const ConfirmDialog = ({ open, text, onConfirm, onCancel }: { open: boolean; text: string; onConfirm: () => void; onCancel: () => void }) => {
  const { t } = useLang();
  return (
    <Modal title={t('confirm')} open={open} onClose={onCancel}>
      <p>{text}</p>
      <div className="formActions">
        <Button variant="danger" onClick={onConfirm}>{t('confirm')}</Button>
        <Button onClick={onCancel}>{t('cancel')}</Button>
      </div>
    </Modal>
  );
};

/* ---------- menu: accessible overflow menu (Phase 3.12) ----------
   Trigger button + popover list. Escape closes and restores focus to the
   trigger; arrows/Home/End move; Enter/Space activates; Tab closes and lets
   focus travel on naturally. Danger items render in a separated group.
   Logical properties keep it correct in RTL and LTR; items are full buttons
   so touch targets stay generous. */
export interface MenuItemDef { label: string; hint?: string; danger?: boolean; disabled?: boolean; onSelect: () => void }
export const Menu = ({ label, items }: { label: string; items: MenuItemDef[] }) => {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const close = (restore: boolean) => {
    setOpen(false);
    if (restore) btnRef.current?.focus();
  };
  useEffect(() => {
    if (!open) return undefined;
    const box = listRef.current;
    box?.querySelector<HTMLElement>('button:not([disabled])')?.focus();
    const onDoc = (e: MouseEvent) => {
      if (!(e.target instanceof Node)) return;
      if (!box?.contains(e.target) && e.target !== btnRef.current && !btnRef.current?.contains(e.target)) close(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open ]);
  const move = (e: React.KeyboardEvent) => {
    const btns = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []);
    const at = btns.indexOf(e.currentTarget as HTMLButtonElement);
    let n = at;
    if (e.key === 'ArrowDown') n = (at + 1) % btns.length;
    else if (e.key === 'ArrowUp') n = (at - 1 + btns.length) % btns.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = btns.length - 1;
    else return;
    e.preventDefault();
    btns[n]?.focus();
  };
  const renderItem = (it: MenuItemDef, i: number) => (
    <li key={i} role="none">
      <button
        type="button" role="menuitem" className={`menuItem${it.danger ? ' danger' : ''}`}
        disabled={it.disabled}
        onClick={() => { close(false); it.onSelect(); }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); close(true); }
          else if (e.key === 'Tab') { setOpen(false); }
          else move(e);
        }}
      >
        <span>{it.label}</span>
        {it.hint ? <span className="muted small">{it.hint}</span> : null}
      </button>
    </li>
  );
  const plain = items.filter((x) => !x.danger);
  const danger = items.filter((x) => x.danger);
  return (
    <span className="menuWrap">
      <button
        type="button" className="btn btn--sm" ref={btnRef}
        aria-haspopup="menu" aria-expanded={open}
        onClick={() => (open ? close(true) : setOpen(true))}
        onKeyDown={(e) => {
          if ((e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') && !open) { e.preventDefault(); setOpen(true); }
          if (e.key === 'Escape' && open) { e.preventDefault(); close(true); }
        }}
      >
        {label}
      </button>
      {open && (
        <ul ref={listRef} role="menu" aria-label={label} className="menu">
          {plain.map(renderItem)}
          {plain.length > 0 && danger.length > 0 && (
            <li role="separator" className="menuSep"><span>{t('dangerZone')}</span></li>
          )}
          {danger.map(renderItem)}
        </ul>
      )}
    </span>
  );
};
/* ---------- fields ---------- */
export const Field = ({ label, error, children }: { label: string; error?: string; children: ReactNode }) => (
  <label className="field">
    <span>{label}</span>
    {children}
    {error ? <span className="err" role="alert">{error}</span> : null}
  </label>
);
export const TextInput = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input className="input" {...p} />;
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select className="select" {...p} />;
export const TextArea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className="textarea" {...p} />;
export const SearchInput = ({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder?: string; label: string }) => (
  <input className="input" role="searchbox" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
);

/* ---------- responsive records (div-table with row/cell roles) ---------- */
/* Phase 6 (finding 2): `template` on the shell opts the table into the shared
   subgrid track model (see styles.css `.recTable--sub`); without it, the
   pre-Phase-6 behaviour (per-row declared templates) is preserved verbatim. */
export const RecShell = ({ children, label, template }: { children: ReactNode; label: string; template?: string }) => (
  <div role="table" aria-label={label} className={template ? 'recTable recTable--sub' : 'recTable'} style={template ? { gridTemplateColumns: template } : undefined}>{children}</div>
);
export const RecHead = ({ template, children }: { template: string; children: ReactNode }) => (
  <div className="recHead" role="row" style={{ gridTemplateColumns: template }}>{children}</div>
);
export const RecRow = ({ template, children }: { template: string; children: ReactNode }) => (
  <div className="recRow" role="row" style={{ gridTemplateColumns: template }}>{children}</div>
);
export const RecCell = ({ k, children, head }: { k?: string; children: ReactNode; head?: boolean }) => (
  <div className="recCell" role={head ? 'columnheader' : 'cell'}>{k ? <span className="k">{k}</span> : null}<span>{children}</span></div>
);

/* ---------- states / tabs ---------- */
/* Empty states stay honest: the title/hint/action are real text rendered
   immediately — only the decorative icon block gets a scroll-reveal fade
   (React Bits FadeContent; no-op under prefers-reduced-motion). */
export const EmptyState = ({ title, hint, action, icon }: { title: string; hint?: string; action?: ReactNode; icon?: IconName }) => (
  <div className="empty" role="status">{icon ? <FadeContent duration={0.6}><span className="emptyIcon" aria-hidden="true"><Icon name={icon} size={30} /></span></FadeContent> : null}<strong>{title}</strong>{hint ? <p className="muted small">{hint}</p> : null}{action}</div>
);
/* ---------- sorting + pagination (Phase 3.5) ----------
   Buttons instead of arrows-in-cells so sorting stays reachable by keyboard
   and never adds a horizontal scrollbar to narrow viewports. */
export const SortHeader = ({ label, k, sortBy, dir, onSort }: { label: string; k: string; sortBy: string; dir: 'asc' | 'desc'; onSort: (k: string) => void }) => {
  const { t } = useLang();
  const active = sortBy === k;
  return (
    <Button size="sm" onClick={() => onSort(k)} aria-label={`${label} — ${t('sortBy')}`}>
      {label}{active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
    </Button>
  );
};
export const Pager = ({ page, pages, total, pageSize, onPage, label }: { page: number; pages: number; total: number; pageSize: number; onPage: (p: number) => void; label: string }) => {
  const { t } = useLang();
  if (pages <= 1 && total <= pageSize) return null;
  return (
    <div className="pager" role="navigation" aria-label={label}>
      <span className="muted small num" aria-live="polite">
        {t('pageOf', { p: page + 1, n: pages })} · {t('itemsTotal')} {total}
      </span>
      <Button size="sm" disabled={page === 0} onClick={() => onPage(page - 1)}>{t('prev')}</Button>
      <Button size="sm" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>{t('next')}</Button>
    </div>
  );
};
export const Tabs = ({ tabs, active, onChange, label }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void; label: string }) => (
  <div className="tabs" role="tablist" aria-label={label}>
    {tabs.map((t) => (
      <button key={t.key} role="tab" aria-selected={active === t.key} className="tabBtn" onClick={() => onChange(t.key)}>{t.label}</button>
    ))}
  </div>
);
