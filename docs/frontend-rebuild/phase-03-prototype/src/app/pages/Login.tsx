import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DEMO_ROLES, useAuth } from '@/app/providers/auth';
import type { DemoRole } from '@/app/providers/auth';
import { useLang } from '@/i18n';
import type { TKey } from '@/i18n';
import { Button } from '@/shared/ui';
import { Icon } from '@/shared/ui/icons';
import type { IconName } from '@/shared/ui/icons';
import SplitText from '@/shared/ui/bits/SplitText';
import FadeContent from '@/shared/ui/bits/FadeContent';

/** Role *labels* are UI copy, so they come from the dictionary. The role
    identifiers themselves stay untouched — they are the auth contract. */
const ROLE_LABEL: Record<DemoRole, TKey> = {
  admin: 'roleAdmin', manager: 'roleManager', warehouse: 'roleWarehouse', viewer: 'roleViewer',
  technical: 'roleTechnical',
};
/** One-line scope hints drawn from the audited ROLE_BASE actually backing each
    role — never invented responsibilities. */
const ROLE_HINT: Record<DemoRole, TKey> = {
  admin: 'roleHintAdmin', manager: 'roleHintManager', warehouse: 'roleHintWarehouse',
  viewer: 'roleHintViewer', technical: 'roleHintTechnical',
};
/** Stroke-icon per demo identity (decorative; the label + hint carry meaning). */
const ROLE_ICON: Record<DemoRole, IconName> = {
  admin: 'shield', manager: 'briefcase', warehouse: 'box', viewer: 'eye',
  technical: 'wrench',
};

export const Login = () => {
  const [role, setRole] = useState<DemoRole>('manager');
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const { t, lang, setLang } = useLang();
  /* Phase 5 — return destination: the Guard carries the attempted route in
     history state; after a successful login the actor lands back where they
     were heading. Only same-app internal paths are honored (starts with a
     single "/", never "//"-prefixed protocol-relative URLs) so the redirect
     can never leave the application. */
  const dest = (() => {
    const s = (loc.state as { from?: { pathname?: unknown; search?: unknown } } | null)?.from;
    const p = typeof s?.pathname === 'string' ? s.pathname : '';
    if (!p.startsWith('/') || p.startsWith('//')) return '/';
    const q = typeof s?.search === 'string' ? s.search : '';
    return `${p}${q.startsWith('?') ? q : ''}`;
  })();
  return (
    <div className="loginWrap">
      <aside className="loginSide" aria-label={t('appName')}>
        <p className="loginBrand">{t('appName')}</p>
        <div className="loginRule" aria-hidden="true" />
        <ul className="loginSpec">
          <li><span className="idx" aria-hidden="true">01</span><span>{t('projects')}</span></li>
          <li><span className="idx" aria-hidden="true">02</span><span>{t('archive')}</span></li>
          <li><span className="idx" aria-hidden="true">03</span><span>{t('inventory')}</span></li>
          <li><span className="idx" aria-hidden="true">04</span><span>{t('financials')}</span></li>
        </ul>
        <p className="muted small">{t('footerDemo')}</p>
      </aside>
      <FadeContent className="loginCard" trigger="mount" duration={0.6}>
        <img className="loginLogo" src={lang === 'ar' ? '/logos/emg-lockup-ar.svg' : '/logos/emg-lockup-en.svg'} alt="" />
        {/* Word-level split keeps Arabic letter shaping intact (per-char splits
            break cursive joins); trigger="load" plays immediately since the
            login card is always in view; reduced motion keeps plain text. */}
        <SplitText tag="h1" text={t('appName')} splitType="words" effect="rise" trigger="load" duration={0.7} delay={90} textAlign="start" />
        <p className="muted small">{t('demo')} — {t('mockNote')}</p>
        <p>
          <Button size="sm" variant={lang === 'ar' ? 'primary' : 'ghost'} onClick={() => setLang('ar')} aria-pressed={lang === 'ar'}>العربية (RTL)</Button>{' '}
          <Button size="sm" variant={lang === 'en' ? 'primary' : 'ghost'} onClick={() => setLang('en')} aria-pressed={lang === 'en'}>English (LTR)</Button>
        </p>
        <div className="rolePick" role="radiogroup" aria-label={t('demoRoleLabel')}>
          {DEMO_ROLES.map((r) => (
            <label key={r} className={`btn${role === r ? ' btn--primary' : ''}`}>
              <input
                type="radio" name="demo-role" value={r}
                checked={role === r} onChange={() => setRole(r)}
                aria-label={t(ROLE_LABEL[r])}
              />
              <span aria-hidden="true"><Icon name={ROLE_ICON[r]} size={20} /></span>
              <span><strong>{t(ROLE_LABEL[r])}</strong><br /><span className="muted small">{t(ROLE_HINT[r])}</span></span>
            </label>
          ))}
        </div>
        <p className="muted small">{t('loginHint')}</p>
        <Button variant="primary" onClick={() => { login(role); nav(dest); }}>{t('demoLogin')}</Button>
      </FadeContent>
    </div>
  );
};
