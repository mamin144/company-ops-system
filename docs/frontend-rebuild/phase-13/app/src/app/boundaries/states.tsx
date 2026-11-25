// Route-level UI states that are NOT business features: access denied and
// not-found. Moved verbatim from the former pages/Misc.tsx (behavior and
// markup unchanged) so features/ stays business-only.
import { Link } from 'react-router-dom';
import { useLang } from '@/i18n';

export const Forbidden = () => {
  const { t } = useLang();
  return (
    <div className="denyBox"><h1>{t('deniedTitle')}</h1><p className="muted small">{t('deniedBody')}</p>
      <p><Link className="linkBtn" to="/">{t('arrowBack')} {t('backHome')}</Link></p></div>
  );
};

export const NotFound = () => {
  const { t } = useLang();
  return (
    <div className="denyBox"><h1>{t('notFoundTitle')}</h1><p className="muted small">{t('notFoundBody')}</p>
      <p><Link className="linkBtn" to="/">{t('arrowBack')} {t('backHome')}</Link></p></div>
  );
};
