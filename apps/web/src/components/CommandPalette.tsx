import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDensity } from '../lib/density';

export interface PaletteNavItem {
  to: string;
  label: string;
  group: string;
}

interface Action {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

/**
 * Thin command surface: navigation (permission-filtered) + 3 real actions
 * (theme, table density, logout). No fake entries, no backend changes.
 * Ctrl+K / Cmd+K opens, Esc closes, arrows + Enter run.
 */
export const CommandPalette = ({
  open,
  onClose,
  navItems,
}: {
  open: boolean;
  onClose: () => void;
  navItems: PaletteNavItem[];
}) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { density, toggle: toggleDensity } = useDensity();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const actions: Action[] = useMemo(
    () => [
      {
        id: 'theme',
        label:
          document.documentElement.dataset.theme === 'dark'
            ? 'التبديل إلى الوضع النهاري'
            : 'التبديل إلى الوضع الليلي',
        hint: 'المظهر',
        run: () => {
          const next = localStorage.getItem('theme') === 'dark' ? 'light' : 'dark';
          localStorage.setItem('theme', next);
          window.dispatchEvent(new CustomEvent('cos:theme-change'));
        },
      },
      {
        id: 'density',
        label:
          density === 'compact' ? 'جداول مريحة (افتراضي)' : 'جداول مضغوطة',
        hint: 'الكثافة',
        run: () => toggleDensity(),
      },
      {
        id: 'logout',
        label: 'تسجيل الخروج',
        hint: 'الحساب',
        run: () => {
          void logout().then(() => navigate('/login'));
        },
      },
    ],
    [density, toggleDensity, logout, navigate],
  );

  const query = q.trim();
  const navHits = navItems.filter(
    (n) => !query || n.label.includes(query) || n.group.includes(query),
  );
  const actHits = actions.filter(
    (a) => !query || a.label.includes(query) || (a.hint ?? '').includes(query),
  );
  const rows: Array<{ key: string; kind: 'nav' | 'action'; label: string; sub?: string; run: () => void }> = [
    ...navHits.map((n) => ({
      key: `nav:${n.to}`,
      kind: 'nav' as const,
      label: n.label,
      sub: n.group,
      run: () => navigate(n.to),
    })),
    ...actHits.map((a) => ({
      key: `act:${a.id}`,
      kind: 'action' as const,
      label: a.label,
      sub: a.hint,
      run: a.run,
    })),
  ];

  useEffect(() => {
    if (!open) return undefined;
    setQ('');
    setActive(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [open ]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    return () => {
      const trigger = document.querySelector<HTMLElement>('[data-cmdk-trigger]');
      (trigger ?? (prev instanceof HTMLElement ? prev : null))?.focus();
    };
  }, [open ]);

  if (!open) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (rows.length ? (a + 1) % rows.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (rows.length ? (a - 1 + rows.length) % rows.length : 0));
    } else if (e.key === 'Enter' && rows[active]) {
      onClose();
      rows[active].run();
    }
  };

  return (
    <div className="cmdk" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="cmdk__panel"
        role="dialog"
        aria-modal="true"
        aria-label="لوحة الأوامر"
        onKeyDown={onKey}
      >
        <div className="cmdk__inputRow">
          <span aria-hidden="true">⌘</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="انتقال سريع أو أمر…"
            aria-label="البحث في الأوامر والصفحات"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={rows[active] ? `cmdk-opt-${active}` : undefined}
            autoComplete="off"
          />
          <span className="kbd">Esc</span>
        </div>
        <div className="cmdk__list" role="listbox" id="cmdk-list" ref={listRef}>
          {rows.length === 0 ? (
            <div className="cmdk__empty">لا نتائج مطابقة</div>
          ) : (
            rows.map((r, i) => (
              <button
                key={r.key}
                id={`cmdk-opt-${i}`}
                role="option"
                aria-selected={i === active}
                className="cmdk__item"
                onMouseEnter={() => setActive(i)}
                onClick={() => {
                  onClose();
                  r.run();
                }}
              >
                <span>{r.label}</span>
                {r.sub ? <span className="cmdk__itemSub">{r.sub}</span> : null}
                {i === active ? <span className="kbd">↵</span> : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
