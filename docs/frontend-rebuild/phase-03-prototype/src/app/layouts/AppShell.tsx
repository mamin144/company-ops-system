import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth';
import { useLang } from '@/i18n';
import type { TKey } from '@/i18n';
import { mrApi } from '@/services/api';
import { CommandPalette } from './CommandPalette';
import { Modal } from '@/shared/ui';
import { Icon } from '@/shared/ui/icons';
import type { IconName } from '@/shared/ui/icons';
import { useShellMotion, useSmoothScroll, useRouteScrollTop, useScrollLock } from '@/shared/lib/motion';

const NAV: { to: string; k: 'home' | 'projects' | 'archive' | 'inventory' | 'financials' | 'admin' | 'audit' | 'reports' | 'settings'; perm?: string; icon: IconName; group: 'navGroupWork' | 'navGroupManage' | 'navGroupSystem' }[] = [
  { to: '/', k: 'home', icon: 'home', group: 'navGroupWork' },
  { to: '/projects', k: 'projects', perm: 'projects.view', icon: 'projects', group: 'navGroupWork' },
  { to: '/archive', k: 'archive', perm: 'archive.view', icon: 'archive', group: 'navGroupWork' },
  { to: '/inventory', k: 'inventory', perm: 'warehouse.view', icon: 'inventory', group: 'navGroupWork' },
  { to: '/financials', k: 'financials', perm: 'projects.view', icon: 'financials', group: 'navGroupWork' },
  { to: '/admin', k: 'admin', perm: 'users.manage', icon: 'admin', group: 'navGroupManage' },
  { to: '/audit', k: 'audit', perm: 'audit.view', icon: 'audit', group: 'navGroupManage' },
  { to: '/reports', k: 'reports', perm: 'reports.view', icon: 'reports', group: 'navGroupManage' },
  { to: '/settings', k: 'settings', icon: 'settings', group: 'navGroupSystem' },
];

const GROUPS = ['navGroupWork', 'navGroupManage', 'navGroupSystem'] as const;

export const Shell = () => {
  const { t, lang, setLang } = useLang();
  const { user, logout, can } = useAuth();
  const [pal, setPal] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('cos-proto-theme') === 'dark');
  const [density, setDensity] = useState(() => localStorage.getItem('cos-proto-density') || 'comfortable');
  const [offline, setOffline] = useState(!navigator.onLine);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('cos-proto-collapsed') === '1');
  const [moreOpen, setMoreOpen] = useState(false);
  // Phase 3.17-C: mobile drawer + collapsed-rail tooltip state. Both are
  // transient show-toggles — no animation state in JS, everything interpolates
  // in CSS so interrupting (rapid toggles, navigation) converges on the truth.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tip, setTip] = useState<{ label: string; x: number; y: number; ltr: boolean } | null>(null);
  const nav = useNavigate();
  const loc = useLocation();
  const railRef = useRef<HTMLElement>(null);
  const topbarRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const drawerBtnRef = useRef<HTMLButtonElement>(null);

  useSmoothScroll();
  // Pathname-keyed scroll reset (Phase 3.17-C): navigation must always land at
  // the top — a scrolled archive page used to hand its y-offset to the next
  // route, which read as "spacing changing between pages". Registered before
  // the shell motion so the jump is committed before the entry tween runs.
  useRouteScrollTop(loc.pathname);
  useShellMotion(loc.key, { rail: railRef, topbar: topbarRef, content: contentRef });
  // Background scroll freezes while the mobile drawer is open (Phase 3.17-C
  // polish), and always releases on close/unmount/breakpoint-close.
  useScrollLock(drawerOpen);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('cos-proto-theme', dark ? 'dark' : 'light');
  }, [dark]);
  useEffect(() => {
    document.documentElement.dataset.density = density;
    localStorage.setItem('cos-proto-density', density);
  }, [density]);
  useEffect(() => {
    localStorage.setItem('cos-proto-collapsed', collapsed ? '1' : '0');
  }, [collapsed]);
  useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPal((v) => !v); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  // A palette selection navigates away — never leave it open on the new route.
  // Same lifecycle applies to the mobile drawer: a NavLink click closes it
  // WITHOUT focus return (spoken focus belongs to the new page's content);
  // focus returns to the hamburger only for Escape/backdrop dismissal.
  useEffect(() => { setPal(false); setDrawerOpen(false); }, [loc.pathname]);
  // A tooltip that outlives its route points at a link that may not exist.
  useEffect(() => { setTip(null); }, [loc.key, collapsed]);

  // Drawer closes when the viewport crosses back up to desktop — the rail
  // takes over and the drawer would linger invisibly.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const h = () => { if (mq.matches) setDrawerOpen(false); };
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  // Tooltip placement was captured at show time — any resize invalidates it.
  useEffect(() => {
    const h = () => setTip(null);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  // Escape: dismiss the tooltip immediately; if the drawer is open, close it
  // and give focus back to its invoker. The palette and dialogs handle their
  // own Escape independently; the drawer can't be open behind one.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.isComposing) return;
      setTip(null);
      if (drawerOpen) closeDrawerReturn();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen]);

  /* Tooltip: placed OUTSIDE the rail at show time (never re-tracked while
     open — a moving tooltip reads as noise), clamped to the viewport, and
     offset to the far side of the rail in both RTL and LTR. Mouse-only; the
     tap target navigates directly on touch. */
  const showTip = (item: Element) => {
    if (!collapsed || !window.matchMedia('(min-width: 768px)').matches) return;
    const label = item.getAttribute('aria-label');
    if (!label) return;
    const rail = railRef.current;
    if (!rail) return;
    const r = item.getBoundingClientRect();
    const rr = rail.getBoundingClientRect();
    const ltr = document.documentElement.getAttribute('dir') !== 'rtl';
    setTip({
      label,
      x: ltr ? rr.right + 8 : window.innerWidth - (rr.left - 8),
      y: Math.min(Math.max(r.top + r.height / 2, 24), window.innerHeight - 24),
      ltr,
    });
  };

  const openDrawer = () => {
    setDrawerOpen(true);
    // First nav item receives focus once the drawer is in the a11y tree
    // (visibility flips on in the same commit; rAF lands after it).
    requestAnimationFrame(() => {
      drawerRef.current?.querySelector<HTMLElement>('.drawerItem')?.focus({ preventScroll: true });
    });
  };
  const closeDrawer = () => setDrawerOpen(false);
  const closeDrawerReturn = () => {
    setDrawerOpen(false);
    drawerBtnRef.current?.focus({ preventScroll: true });
  };
  // Tab trap: wraps at the drawer edges so focus can never escape an open
  // drawer behind the scrim (nav links + close button are the only focusables).
  const trapFocus = (e: ReactKeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const root = drawerRef.current;
    if (!root) return;
    const f = Array.from(root.querySelectorAll<HTMLElement>('a[href], button')).filter((el) => el.offsetParent !== null);
    if (f.length < 2) return;
    const first = f[0];
    const last = f[f.length - 1];
    const cur = document.activeElement;
    if (e.shiftKey && cur === first) { e.preventDefault(); last.focus({ preventScroll: true }); }
    else if (!e.shiftKey && cur === last) { e.preventDefault(); first.focus({ preventScroll: true }); }
  };

  const items = NAV.filter((n) => !n.perm || can(n.perm));
  const crumbs = loc.pathname.split('/').filter(Boolean);

  /* Route-to-label breadcrumb map (Phase 3.12, C-07). Static segments resolve
     to localized names; a project id resolves ONLY through the actor's scoped
     project list — an unknown or out-of-scope id renders the honest
     existence-hiding label, never a raw id. Unknown segments are skipped
     rather than rendered raw. */
  const CRUMB_STATIC: Record<string, TKey> = {
    projects: 'projects', archive: 'archive', inventory: 'inventory', financials: 'financials',
    admin: 'admin', audit: 'audit', reports: 'reports', settings: 'settings',
    search: 'search', notifications: 'notifications', overview: 'tabOverview', sites: 'tabSites',
    documents: 'tabDocuments', warehouses: 'tabWarehouses', stock: 'tabStock', login: 'demoLogin',
  };
  const scopedProjects = useMemo(() => mrApi.projects(user?.id), [user?.id]);
  const crumbLabels = useMemo(() => {
    const out: { label: string; to: string | null; business?: boolean }[] = [];
    let acc = '';
    const segs = crumbs;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      acc += `/${s}`;
      const prev = segs[i - 1];
      if (CRUMB_STATIC[s]) {
        out.push({ label: t(CRUMB_STATIC[s]), to: i === segs.length - 1 ? null : acc });
        continue;
      }
      if (prev === 'projects') {
        const p = scopedProjects.find((x) => x.id === decodeURIComponent(s));
        // Project code+name is BUSINESS DATA (never translated) — flagged so
        // the i18n chrome audit strips it instead of flagging Arabic names.
        if (p) out.push({ label: `${p.code} — ${p.name}`, to: i === segs.length - 1 ? null : acc, business: true });
        else out.push({ label: t('crumbRestricted'), to: null });
        continue;
      }
      // unknown segment (e.g. 403 page marker, typo route): skip raw text
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.pathname, scopedProjects, lang]);

  const mainItems = items.slice(0, 5);
  const moreItems = items.slice(5);

  return (
    <div className="shell">
      <nav ref={railRef} data-lenis-prevent className={`rail${collapsed ? ' collapsed' : ''}`} aria-label={t('primaryNav')}
        onPointerOver={(e) => { if (e.pointerType !== 'mouse') return; const it = (e.target as Element).closest('.navItem'); if (it) showTip(it); }}
        onPointerOut={(e) => { const from = (e.target as Element).closest('.navItem'); const to = e.relatedTarget instanceof Element ? e.relatedTarget.closest('.navItem') : null; if (from && from !== to) setTip(null); }}
        onFocus={(e) => { const it = (e.target as Element).closest('.navItem'); if (it) showTip(it); }}
        onBlur={(e) => { const from = (e.target as Element).closest('.navItem'); const to = e.relatedTarget instanceof Element ? e.relatedTarget.closest('.navItem') : null; if (from && from !== to) setTip(null); }}
      >
        <div className="brand">
          <div className="brandTop">
            <Link to="/" className="brandLogo" aria-label={t('appName')}>
              <img src={lang === 'ar' ? '/logos/emg-mark-ar.svg' : '/logos/emg-mark-en.svg'} alt="" />
            </Link>
            <button type="button" className="brandMark" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? t('expandNav') : t('collapseNav')} aria-expanded={!collapsed}>
              <Icon name="sidebar" size={16} />
            </button>
          </div>
          <span className="brandText"><strong>{t('appName')}</strong><br /><span className="muted small">{t('protoTag')}</span></span>
        </div>
        {GROUPS.map((g) => {
          const groupItems = items.filter((n) => n.group === g);
          if (groupItems.length === 0) return null;
          return (
            <div key={g} className="navSection">
              <div className="navGroup">{t(g)}</div>
              {groupItems.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.to === '/'} aria-label={t(n.k)} className={({ isActive }) => `navItem${isActive ? ' active' : ''}`}>
                  <Icon name={n.icon} size={19} /><span className="navLabel">{t(n.k)}</span>
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>
      <div className="main">
        <header ref={topbarRef} className="topbar">
          {/* Mobile-only hamburger (CSS hides it ≥768px); its own class so the
              touch-target audit never measures a hidden .btn at 0 height. */}
          <button type="button" ref={drawerBtnRef} className="drawerBtn" onClick={openDrawer} aria-label={t('openNav')} aria-expanded={drawerOpen} aria-controls="railDrawer"><Icon name="sidebar" size={17} /></button>
          {/* Phase 6 (finding 1): the text-labeled command-palette button is
              hidden at phone widths (its /search icon twin right after the
              spacer stays reachable); the class exists only so the phone media
              rule in styles.css can target this one control without side
              effects. */}
          <button type="button" className="btn btn--sm tbCmd" onClick={() => setPal(true)} aria-haspopup="dialog"><Icon name="search" size={16} /><span>{t('search')}</span><kbd aria-hidden="true">⌘K</kbd></button>
          <span className="demoBadge">{t('demo')}</span>
          <span className="spacer" />
          <Link className="btn btn--sm btn--quiet" to="/search" aria-label={t('search')}><Icon name="search" size={17} /></Link>
          <Link className="btn btn--sm btn--quiet" to="/notifications" aria-label={t('notifications')}><Icon name="bell" size={17} /></Link>
          <button type="button" className="btn btn--sm btn--quiet" onClick={() => setDark((d) => !d)} aria-label={t('theme')}><Icon name={dark ? 'sun' : 'moon'} size={17} /></button>
          <button type="button" className="btn btn--sm btn--quiet" data-lang-toggle title={t('toggleLang')} onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}><Icon name="globe" size={16} /><span>ع/EN</span></button>
          <button type="button" className="btn btn--sm btn--quiet densCmd" onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')} aria-label={`${t('density')}: ${t(density === 'compact' ? 'compact' : 'comfortable')}`} aria-pressed={density === 'compact'} title={`${t('density')}: ${t(density === 'compact' ? 'compact' : 'comfortable')}`}><Icon name="density" size={17} /></button>
          <span className="userChip"><span className="muted small">{user?.name}</span></span>
          <button type="button" className="btn btn--sm" onClick={() => { logout(); nav('/login'); }}><Icon name="logout" size={16} /><span>{t('logout')}</span></button>
        </header>
        {offline ? <div className="offBanner" role="status">{t('offlineBanner')}</div> : null}
        <div ref={contentRef} className="content">
          {crumbLabels.length > 0 ? (
            <nav className="crumbs" aria-label={t('crumbsAria')}>
              <Link to="/">{t('home')}</Link>
              {crumbLabels.map((c, i) => (
                <span key={i}>/ {c.to && i !== crumbLabels.length - 1 ? <Link to={c.to}>{c.business ? <span data-i18n-skip="project-name">{c.label}</span> : c.label}</Link> : <span aria-current={i === crumbLabels.length - 1 ? 'page' : undefined}{...(c.business ? { 'data-i18n-skip': 'project-name' } : {})}>{c.label}</span>}</span>
              ))}
            </nav>
          ) : null}
          <Outlet />
        </div>
        <nav className="bottombar" aria-label={t('mobileNav')}>
          {mainItems.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon name={n.icon} size={20} /><span>{t(n.k)}</span>
            </NavLink>
          ))}
          {moreItems.length > 0 && (
            <button type="button" className={moreItems.some((n) => loc.pathname === n.to || loc.pathname.startsWith(`${n.to}/`)) ? 'active' : ''} onClick={() => setMoreOpen(true)} aria-haspopup="dialog">
              <Icon name="dots" size={20} /><span>{t('moreMenu')}</span>
            </button>
          )}
        </nav>
        <footer className="foot">
          <img className="footLogo" src={lang === 'ar' ? '/logos/emg-lockup-ar.svg' : '/logos/emg-lockup-en.svg'} alt={t('appName')} />
          <span className="muted small">{t('footerDemo')} · {t('footerVersion')}</span>
        </footer>
      </div>
      {/* Mobile drawer (Phase 3.17-C) — duplicate-free by construction: the
          <.rail> is display:none on phones and the <.railDrawer> is display:none
          on desktop, so exactly one primary nav exists per viewport. Items use
          terminal .drawerItem classes (see notes). Full labels always; the
          collapsed class only ever lives on the rail. */}
      <div className={`drawerScrim${drawerOpen ? ' open' : ''}`} onClick={closeDrawerReturn} aria-hidden="true" />
      <nav ref={drawerRef} id="railDrawer" data-lenis-prevent className={`railDrawer${drawerOpen ? ' open' : ''}`} aria-label={t('primaryNav')} onKeyDown={trapFocus} data-testid="railDrawer">
        <div className="drawerHead">
          <span className="brandText"><strong>{t('appName')}</strong></span>
          <button type="button" className="iconBtn" onClick={closeDrawerReturn} aria-label={t('close')}><Icon name="close" size={17} /></button>
        </div>
        {GROUPS.map((g) => {
          const groupItems = items.filter((n) => n.group === g);
          if (groupItems.length === 0) return null;
          return (
            <div key={g} className="navSection">
              <div className="navGroup">{t(g)}</div>
              {groupItems.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.to === '/'} aria-label={t(n.k)} onClick={closeDrawer} className={({ isActive }) => `drawerItem${isActive ? ' active' : ''}`}>
                  <Icon name={n.icon} size={19} /><span className="navLabel">{t(n.k)}</span>
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>
      {/* Tooltip host (Phase 3.17-C): fully decorative — it mirrors the
          hovered/focused link's accessible name. key remounts it per show and
          per position so the fade-in replays; pointer-events none, role off. */}
      {tip ? (
        <div
          key={`${tip.label}|${Math.round(tip.x)}|${Math.round(tip.y)}`}
          className="railTip"
          role="presentation"
          aria-hidden="true"
          style={{ top: tip.y, left: tip.ltr ? tip.x : undefined, right: tip.ltr ? undefined : tip.x }}
        >
          {tip.label}
        </div>
      ) : null}
      <CommandPalette open={pal} onClose={() => setPal(false)} nav={items.map((n) => ({ to: n.to, label: t(n.k) }))} />
      <Modal title={t('moreMenu')} open={moreOpen} onClose={() => setMoreOpen(false)}>
        <div className="moreSheet" role="group" aria-label={t('moreMenu')}>
          {moreItems.map((n) => (
            <Link key={n.to} className="btn" to={n.to} onClick={() => setMoreOpen(false)}>
              <Icon name={n.icon} size={18} /> {t(n.k)}
            </Link>
          ))}
        </div>
      </Modal>
    </div>
  );
};
