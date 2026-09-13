import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { Document, Item, Project, Site, StockTransaction, Warehouse } from '@cos/shared';
import { Badge, toneForStatus, EmptyState, BackButton } from '../components/ui';
import { PreviewDocButton, DownloadDocButton } from '../components/ProtectedFileLink';
import { ProjectBoqTab } from '../components/projects/ProjectBoqTab';
import { ProjectIpcsTab } from '../components/projects/ProjectIpcsTab';
import { Can } from '../context/AuthContext';

interface TabProps { project: Project }

const OverviewTab = ({ project }: TabProps) => (
  <div className="formGrid">
    <InfoRow label="العميل" value={project.client} />
    <InfoRow label="الجهة المالكة" value={project.owner || '—'} />
    <InfoRow label="المقاول الرئيسي" value={project.mainContractor} />
    <InfoRow label="رقم العقد" value={project.contractNumber} />
    <InfoRow label="المنطقة" value={project.region || '—'} />
    <InfoRow
      label="دور الشركة"
      value={project.role ? ({ 'main-contractor': 'مقاول رئيسي', subcontractor: 'مقاول باطن', 'direct-contractor': 'مقاول مباشر' }[project.role] ?? project.role) : '—'}
    />
    <InfoRow label="تاريخ البدء" value={project.startDate || '—'} />
    <InfoRow label="تاريخ الانتهاء" value={project.endDate || '—'} />
    <InfoRow label="ملاحظات" value={project.notes || '—'} />
  </div>
);

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="infoCard"><span className="muted small">{label}</span><strong>{value}</strong></div>
);

interface MovementRow extends StockTransaction {
  itemIds?: string[];
  lines?: string;
}

export const ProjectDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [tab, setTab] = useState<'overview' | 'sites' | 'documents' | 'warehouses' | 'stock' | 'boq' | 'ipcs'>('overview');

  useEffect(() => {
    if (!id) return;
    void api.get<Project>(`/api/projects/${id}`).then(setProject).catch(() => navigate('/projects'));
    void api.get<Site[]>(`/api/sites?projectId=${id}`).then(setSites);
    void api.get<{ items: Document[] }>(`/api/documents?projectId=${id}&pageSize=50`).then((r) => setDocuments(Array.isArray(r.items) ? r.items : []));
    void api.get<{ items: Warehouse[] }>(`/api/warehouses?projectId=${id}`).then((r) => setWarehouses(Array.isArray(r.items) ? r.items : []));
    void api.get<{ items: MovementRow[] }>('/api/stock/history?projectId=' + id + '&pageSize=50').then((r) =>
      setMovements(Array.isArray(r.items) ? r.items : []),
    );
    void api.get<{ items: Item[] }>('/api/items?pageSize=200').then((r) => setItems(Array.isArray(r.items) ? r.items : []));
  }, [id, navigate]);

  if (!project) return null;
  const itemName = (x?: string) => items.find((i) => i.id === x)?.name ?? '';

  const tabs = [
    { key: 'overview', label: 'نظرة عامة' },
    { key: 'sites', label: `المواقع (${sites.length})` },
    { key: 'documents', label: `المستندات (${documents.length})` },
    { key: 'warehouses', label: `المخازن (${warehouses.length})` },
    { key: 'stock', label: 'حركات المخزون' },
    { key: 'boq', label: 'المقايسات' },
    { key: 'ipcs', label: 'المستخلصات' },
  ] as const;

  return (
    <div className="page">
      <div className="pageHead">
        <div>
          <BackButton />
          <h1 style={{ marginTop: 8 }}>{project.projectName}</h1>
          <p>{project.projectCode} · {project.client}</p>
        </div>
        <Badge tone={toneForStatus(project.status)}>
          {{ planned: 'مخطط', active: 'نشط', 'on-hold': 'متوقف', completed: 'منجز', cancelled: 'ملغي' }[project.status]}
        </Badge>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        {tabs.map((t) => (
          <button key={t.key} className={`btn btn--sm ${tab === t.key ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? <OverviewTab project={project} /> : null}

      {tab === 'sites' ? (
        sites.length === 0 ? (
          <EmptyState title="لا توجد مواقع" hint="يمكن إضافة مواقع للمشروع من شاشة المواقع قريباً" />
        ) : (
          <div className="tableWrap">
            <table className="table">
              <thead><tr><th>الكود</th><th>الاسم</th><th>الموقع</th><th>ملاحظات</th></tr></thead>
              <tbody>{sites.map((s) => (<tr key={s.id}><td>{s.code}</td><td>{s.name}</td><td>{s.location ?? '—'}</td><td>{s.notes ?? '—'}</td></tr>))}</tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === 'documents' ? (
        documents.length === 0 ? (
          <EmptyState title="لا توجد مستندات" />
        ) : (
          <div className="tableWrap">
            <table className="table">
              <thead><tr><th>العنوان</th><th>التصنيف</th><th>الإصدار</th><th>الحالة</th><th>عرض</th></tr></thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id}>
                    <td>{d.title}</td><td><Badge tone="blue">{d.category}</Badge></td><td>{d.revision}</td>
                    <td>{d.status}</td>
                    <td>
                      <PreviewDocButton small documentId={d.id} fileName={d.fileName} />
                      <DownloadDocButton small documentId={d.id} fileName={d.fileName} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === 'warehouses' ? (
        warehouses.length === 0 ? (
          <EmptyState title="لا توجد مخازن مرتبطة" />
        ) : (
          <div className="cards">
            {warehouses.map((w) => (
              <div className="card" key={w.id}>
                <div className="card__label">{w.type === 'central' ? 'مركزي' : 'موقع'}</div>
                <div className="card__value" style={{ fontSize: 18 }}>{w.name}</div>
              </div>
            ))}
          </div>
        )
      ) : null}

      {tab === 'stock' ? (
        movements.length === 0 ? (
          <EmptyState title="لا توجد حركات مخزنية على هذا المشروع" />
        ) : (
          <div className="tableWrap">
            <table className="table">
              <thead><tr><th>التاريخ</th><th>الرقم</th><th>النوع</th><th>الأصناف</th></tr></thead>
              <tbody>
                {movements.map((t) => (
                  <tr key={t.id}>
                    <td>{t.date}</td>
                    <td>{t.number ?? '—'}</td>
                    <td><Badge tone={t.type === 'OUT' ? 'red' : 'green'}>{t.type}</Badge></td>
                    <td className="small">{itemName(t.itemIds?.[0])}{(t.itemIds?.length ?? 0) > 1 ? ` +${(t.itemIds?.length ?? 1) - 1}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === 'boq' ? <ProjectBoqTab projectId={project.id} /> : null}
      {tab === 'ipcs' ? <ProjectIpcsTab projectId={project.id} /> : null}
    </div>
  );
};

