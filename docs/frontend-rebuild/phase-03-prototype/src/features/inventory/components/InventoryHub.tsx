import { Link } from 'react-router-dom';
import { useLang } from '@/i18n';
import type { TKey } from '@/i18n';

const AREAS: { path: string; label: TKey; desc: TKey }[] = [
  { path: 'warehouses', label: 'warehouses', desc: 'hubWarehousesDesc' },
  { path: 'items', label: 'itemsDirectory', desc: 'hubItemsDesc' },
  { path: 'stock', label: 'stock', desc: 'hubStockDesc' },
  { path: 'requests', label: 'requests', desc: 'hubRequestsDesc' },
];

export const InventoryHub = () => {
  const { t } = useLang();
  return (
    <div>
      <div className="cmdHead">
        <div><h1>{t('invManageHub')}</h1><p className="muted small">{t('fakeDataReview')}</p></div>
      </div>
      <div className="cards">
        {AREAS.map((a) => (
          <Link className="card" key={a.path} to={`/inventory/${a.path}`}>
            <span className="l">{t(a.label)}</span><br /><span className="f">{t(a.desc)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};