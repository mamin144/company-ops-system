import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth';
import { useLang } from '@/i18n';

export const CommandPalette = ({ open, onClose, nav }: { open: boolean; onClose: () => void; nav: { to: string; label: string }[] }) => {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevFocus = useRef<Element | null>(null);
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { t, lang, setLang } = useLang();

  const rows = useMemo(() => {
    const all: { label: string; hint: string; run: () => void }[] = [
      ...nav.map((n) => ({ label: n.label, hint: t('openSection'), run: () => navigate(n.to) })),
      { label: t('theme'), hint: t('theme'), run: () => document.querySelector<HTMLButtonElement>('[aria-label="' + t('theme') + '"]')?.click() },
      { label: t('language'), hint: t('language'), run: () => setLang(lang === 'ar' ? 'en' : 'ar') },
      { label: t('logout'), hint: t('logout'), run: () => { logout(); navigate('/login'); } },
    ];
    return all.filter((r) => !q || (r.label + r.hint).toLowerCase().includes(q.toLowerCase()));
  }, [q, nav, navigate, logout, t, lang, setLang]);

  useEffect(() => {
    if (open) {
      prevFocus.current = document.activeElement;
      setQ(''); setActive(0); setTimeout(() => inputRef.current?.focus(), 30);
    } else if (prevFocus.current) {
      const t = prevFocus.current;
      prevFocus.current = null;
      (t as HTMLElement).focus?.();
    }
  }, [open ]);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  useEffect(() => { setActive(0); }, [q]);
  if (!open) return null;

  const go = (i: number) => { rows[i]?.run(); onClose(); };
  return (
    <div className="backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label={t('paletteTitle')}>
        <input ref={inputRef} role="combobox" aria-expanded="true" aria-controls="pal-list" aria-activedescendant={rows[active] ? `pal-${active}` : undefined}
          aria-label={t('search')} value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, rows.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === 'Enter') go(active);
          }} />
        <ul role="listbox" id="pal-list" data-lenis-prevent>
          {rows.map((r, i) => (
            <li key={r.label + i} id={`pal-${i}`} role="option" aria-selected={i === active} onClick={() => go(i)}>
              <span>{r.label}</span><span className="muted small">{r.hint}</span>
            </li>
          ))}
          {rows.length === 0 ? <li aria-disabled="true"><span className="muted">{t('empty')}</span></li> : null}
        </ul>
      </div>
    </div>
  );
};
