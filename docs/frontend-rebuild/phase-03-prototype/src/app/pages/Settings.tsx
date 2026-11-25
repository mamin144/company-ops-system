import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth';
import { useLang } from '@/i18n';
import type { Lang } from '@/i18n';
import { backups, imports } from '@/services/api/adapters/mock/data';
import { Badge, Button, ConfirmDialog, EmptyState, Tabs, useToast } from '@/shared/ui';

export const Settings = () => {
  const { can, user } = useAuth();
  const { t, lang, setLang } = useLang();
  const toast = useToast();
  const [tab, setTab] = useState('backups');
  const [dark, setDark] = useState(() => localStorage.getItem('cos-proto-theme') === 'dark');
  const [restore, setRestore] = useState<string | null>(null);
  const flipTheme = (d: boolean) => {
    setDark(d);
    document.documentElement.dataset.theme = d ? 'dark' : 'light';
    localStorage.setItem('cos-proto-theme', d ? 'dark' : 'light');
  };

  return (
    <div>
      <div className="cmdHead"><div><h1>{t('settings')}</h1></div></div>
      <Tabs label={t('settings')} tabs={[
        { key: 'backups', label: t('tabBackups') }, { key: 'imports', label: t('tabImports') },
        { key: 'appearance', label: t('tabAppearance') }, { key: 'account', label: t('tabAccount') }, { key: 'about', label: t('tabAbout') },
      ]} active={tab} onChange={setTab} />

      {tab === 'backups' && (!can('backup.manage') ? <div className="denyBox"><strong>{t('deniedTitle')}</strong><p className="muted small">{t('deniedBody')}</p></div> : (
        <div className="panel">
          {backups.map((b) => (
            <p key={b.name}><strong>{b.name}</strong> <span className="muted small">{b.scope} · <span className="num">{b.createdAt}</span></span>{' '}
              <Button size="sm" onClick={() => setRestore(b.name)}>{t('restore')}</Button></p>
          ))}
          <p><Button variant="primary" onClick={() => toast('success', t('mockNote'))}>{t('createBackupMock')}</Button></p>
        </div>
      ))}
      <ConfirmDialog open={!!restore} text={t('restoreConfirm', { name: restore ?? '' })}
        onConfirm={() => { setRestore(null); toast('success', t('mockNote')); }} onCancel={() => setRestore(null)} />

      {tab === 'imports' && (
        <div className="panel">{imports.map((i) => (
          <p key={i.file}><strong>{i.file}</strong> <span className="muted small">{i.entity} · {i.by} · <span className="num">{i.at}</span></span><br />
            <Badge tone="green"><span className="num">{i.ok}</span> {t('succeeded')}</Badge>{' '}
            <Badge tone={i.failed ? 'red' : 'gray'}><span className="num">{i.failed}</span> {t('failed')}</Badge></p>
        ))}</div>
      )}

      {tab === 'appearance' && (
        <div className="panel">
          <p><strong>{t('theme')}</strong>{' '}
            <Button size="sm" variant={!dark ? 'primary' : 'ghost'} onClick={() => flipTheme(false)}>{t('light')}</Button>{' '}
            <Button size="sm" variant={dark ? 'primary' : 'ghost'} onClick={() => flipTheme(true)}>{t('dark')}</Button></p>
          <p><strong>{t('language')}</strong>{' '}
            <Button size="sm" variant={lang === 'ar' ? 'primary' : 'ghost'} onClick={() => setLang('ar' as Lang)}>العربية (RTL)</Button>{' '}
            <Button size="sm" variant={lang === 'en' ? 'primary' : 'ghost'} onClick={() => setLang('en' as Lang)}>English (LTR)</Button></p>
          <p className="muted small">{t('langPersistNote')}</p>
        </div>
      )}

      {tab === 'account' && (
        <div className="panel">
          <p><strong>{user?.name}</strong></p>
          <p className="muted small">{t('accountNote')}</p>
          {!user && <EmptyState title={t('empty')} />}
        </div>
      )}

      {tab === 'about' && (
        <div className="panel">
          <p><strong>{t('aboutTitle')}</strong></p>
          <p className="muted small">{t('aboutPwa')}</p>
          <p><Link className="linkBtn" to="/">{t('arrowBack')} {t('backHome')}</Link></p>
        </div>
      )}
    </div>
  );
};
