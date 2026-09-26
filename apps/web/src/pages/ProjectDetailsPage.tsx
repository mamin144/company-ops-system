import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { Document, Item, Project, Site, StockTransaction, Warehouse } from '@cos/shared';
import { Badge, toneForStatus, EmptyState, BackButton, Field, Modal, TextInput, TextArea, ConfirmDialog, useToast } from '../components/ui';
import { PreviewDocButton, DownloadDocButton } from '../components/ProtectedFileLink';
import { ProjectBoqTab } from '../components/projects/ProjectBoqTab';
import { ProjectIpcsTab } from '../components/projects/ProjectIpcsTab';
import { IconProjects, IconPlus, IconTrash } from '../components/Icons';
import { useAuth } from '../context/AuthContext';

interface TabProps { project: Project }

const OverviewTab = ({ project }: TabProps) => (
  <div className="formGrid">
    <InfoRow label="العميل" value={project.client} />
    <InfoRow label="الجهة المالكة" value={project.owner || '—'} />
    <InfoRow label="المقاول الرئيسي" value={project.mainContractor || '—'} />
    <InfoRow label="رقم العقد" value={project.contractNumber || '—'} isNum />
    <InfoRow label="المنطقة" value={project.region || '—'} />
    <InfoRow
      label="دور الشركة"
      value={project.role ? ({ 'main-contractor': 'مقاول رئيسي', subcontractor: 'مقاول باطن', 'direct-contractor': 'مقاول مباشر' }[project.role] ?? project.role) : '—'}
    />
    <InfoRow label="تاريخ البدء" value={project.startDate || '—'} isNum />
    <InfoRow label="تاريخ الانتهاء" value={project.endDate || '—'} isNum />
    <InfoRow label="موقع العمل" value={project.siteLocation || '—'} />
    <InfoRow label="ملاحظات" value={project.notes || '—'} />
  </div>
);

const InfoRow = ({ label, value, isNum = false }: { label: string; value: string; isNum?: boolean }) => (
  <div className="infoCard">
    <span className="muted small">{label}</span>
    <strong className={isNum ? 'num' : undefined}>{value}</strong>
  </div>
);

interface MovementRow extends StockTransaction {
  itemIds?: string[];
  lines?: string;
}

export const ProjectDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [tab, setTab] = useState<'overview' | 'sites' | 'documents' | 'warehouses' | 'stock' | 'boq' | 'ipcs'>('overview');

  // Site modal state
  const [siteModalOpen, setSiteModalOpen] = useState(false);
  const [siteForm, setSiteForm] = useState({ code: '', name: '', location: '', notes: '' });
  const [siteDeleteTarget, setSiteDeleteTarget] = useState<Site | null>(null);

  const loadProject = () => {
    if (!id) return;
    void api.get<Project>(`/api/projects/${id}`).then(setProject).catch(() => navigate('/projects'));
    void api.get<Site[]>(`/api/sites?projectId=${id}`).then(setSites);
    void api.get<{ items: Document[] }>(`/api/documents?projectId=${id}&pageSize=50`).then((r) => setDocuments(Array.isArray(r.items) ? r.items : []));
    void api.get<{ items: Warehouse[] }>(`/api/warehouses?projectId=${id}`).then((r) => setWarehouses(Array.isArray(r.items) ? r.items : []));
    void api.get<{ items: MovementRow[] }>('/api/stock/history?projectId=' + id + '&pageSize=50').then((r) =>
      setMovements(Array.isArray(r.items) ? r.items : []),
    );
    void api.get<{ items: Item[] }>('/api/items?pageSize=200').then((r) => setItems(Array.isArray(r.items) ? r.items : []));
  };

  useEffect(() => {
    loadProject();
  }, [id, navigate]);

  const handleCreateSite = async () => {
    if (!id) return;
    try {
      await api.post('/api/sites', {
        projectId: id,
        code: siteForm.code,
        name: siteForm.name,
        location: siteForm.location || undefined,
        notes: siteForm.notes || undefined,
      });
      toast('success', 'تم إضافة الموقع بنجاح');
      setSiteModalOpen(false);
      setSiteForm({ code: '', name: '', location: '', notes: '' });
      const updatedSites = await api.get<Site[]>(`/api/sites?projectId=${id}`);
      setSites(updatedSites);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'خطأ في إضافة الموقع');
    }
  };

  const handleDeleteSite = async () => {
    if (!siteDeleteTarget || !id) return;
    try {
      await api.del(`/api/sites/${siteDeleteTarget.id}`);
      toast('success', 'تم حذف الموقع بنجاح');
      setSiteDeleteTarget(null);
      const updatedSites = await api.get<Site[]>(`/api/sites?projectId=${id}`);
      setSites(updatedSites);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'خطأ في حذف الموقع');
    }
  };

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
    <div className="page projectWorkspace">
      {/* ============ Project Header Card ============ */}
      <div className="projectHeaderCard">
        <div className="projectIdentity">
          <div style={{ marginBottom: 4 }}>
            <BackButton />
          </div>
          <div className="projectIdentity__titleRow">
            <h1 className="projectIdentity__title">{project.projectName}</h1>
            <Badge tone={toneForStatus(project.status)}>
              {{ planned: 'مخطط', active: 'نشط', 'on-hold': 'متوقف', completed: 'منجز', cancelled: 'ملغي' }[project.status]}
            </Badge>
          </div>
          <div className="projectIdentity__meta">
            <span>كود المشروع: <strong className="num" style={{ color: 'var(--primary)' }}>{project.projectCode}</strong></span>
            <span>•</span>
            <span>العميل: <strong>{project.client}</strong></span>
            {project.owner && (
              <>
                <span>•</span>
                <span>الجهة المالكة: <strong>{project.owner}</strong></span>
              </>
            )}
            {project.contractNumber && (
              <>
                <span>•</span>
                <span>رقم العقد: <strong className="num">{project.contractNumber}</strong></span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ============ Workspace Tab Navigation ============ */}
      <div className="projectTabs" role="tablist" aria-label="أقسام المشروع">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`projectTabBtn ${tab === t.key ? 'is-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ============ Tab 1: Overview ============ */}
      {tab === 'overview' && <OverviewTab project={project} />}

      {/* ============ Tab 2: Sites ============ */}
      {tab === 'sites' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>مواقع العمل التابعة للمشروع</h3>
            {can('projects.edit') && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setSiteModalOpen(true)}
                aria-label="إضافة موقع جديد للمشروع"
              >
                <IconPlus size={16} /> إضافة موقع
              </button>
            )}
          </div>

          {sites.length === 0 ? (
            <EmptyState
              title="لا توجد مواقع مسجلة"
              hint="اضغط على زر إضافة موقع لتسجيل موقع عمل جديد لهذا المشروع"
            />
          ) : (
            <div className="siteGrid">
              {sites.map((s) => (
                <div key={s.id} className="siteCard">
                  <div className="siteCard__head">
                    <div>
                      <h4 className="siteCard__title">{s.name}</h4>
                      <span className="num small" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                        {s.code}
                      </span>
                    </div>
                    {can('projects.edit') && (
                      <button
                        type="button"
                        className="iconBtn iconBtn--danger"
                        title="حذف الموقع"
                        aria-label={`حذف الموقع ${s.name}`}
                        onClick={() => setSiteDeleteTarget(s)}
                      >
                        <IconTrash size={15} />
                      </button>
                    )}
                  </div>
                  <div className="siteCard__meta">
                    <div>المكان: <strong>{s.location || 'غير محدد'}</strong></div>
                    {s.notes && <div>ملاحظات: <span>{s.notes}</span></div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============ Tab 3: Documents ============ */}
      {tab === 'documents' && (
        documents.length === 0 ? (
          <EmptyState title="لا توجد مستندات مرتبطة" hint="يمكنك أرشفة وربط مستندات بهذا المشروع من شاشة الأرشيف" />
        ) : (
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>العنوان</th>
                  <th>التصنيف</th>
                  <th>الإصدار</th>
                  <th>الحالة</th>
                  <th>عرض</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id}>
                    <td>{d.title}</td>
                    <td><Badge tone="blue">{d.category}</Badge></td>
                    <td className="num">{d.revision}</td>
                    <td>{d.status}</td>
                    <td>
                      <div style={{ display: 'inline-flex', gap: '4px' }}>
                        <PreviewDocButton small documentId={d.id} fileName={d.fileName} />
                        <DownloadDocButton small documentId={d.id} fileName={d.fileName} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ============ Tab 4: Warehouses ============ */}
      {tab === 'warehouses' && (
        warehouses.length === 0 ? (
          <EmptyState title="لا توجد مخازن مرتبطة" hint="يمكن تخصيص مستودعات لهذا المشروع من شاشة المخازن" />
        ) : (
          <div className="cards">
            {warehouses.map((w) => (
              <div className="card" key={w.id}>
                <div className="card__label">{w.type === 'central' ? 'مخزن مركزي' : 'مخزن موقع'}</div>
                <div className="card__value" style={{ fontSize: 18 }}>{w.name}</div>
                {w.location && <div className="card__footer muted small">{w.location}</div>}
              </div>
            ))}
          </div>
        )
      )}

      {/* ============ Tab 5: Stock Movements ============ */}
      {tab === 'stock' && (
        movements.length === 0 ? (
          <EmptyState title="لا توجد حركات مخزنية مسجلة على هذا المشروع" />
        ) : (
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>الرقم</th>
                  <th>نوع العملية</th>
                  <th>الأصناف</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((t) => (
                  <tr key={t.id}>
                    <td className="num">{t.date}</td>
                    <td className="num">{t.number ?? '—'}</td>
                    <td><Badge tone={t.type === 'OUT' ? 'red' : 'green'}>{t.type}</Badge></td>
                    <td className="small">{itemName(t.itemIds?.[0])}{(t.itemIds?.length ?? 0) > 1 ? ` +${(t.itemIds?.length ?? 1) - 1}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ============ Tab 6: BOQ ============ */}
      {tab === 'boq' && <ProjectBoqTab projectId={project.id} />}

      {/* ============ Tab 7: IPCs ============ */}
      {tab === 'ipcs' && <ProjectIpcsTab projectId={project.id} />}

      {/* Site Creation Modal */}
      <Modal
        title="إضافة موقع عمل للمشروع"
        open={siteModalOpen}
        onClose={() => setSiteModalOpen(false)}
      >
        <div className="formGrid">
          <Field label="كود الموقع *">
            <TextInput
              value={siteForm.code}
              onChange={(e) => setSiteForm({ ...siteForm, code: e.target.value })}
              placeholder="مثال: S-01"
            />
          </Field>
          <Field label="اسم الموقع *">
            <TextInput
              value={siteForm.name}
              onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
              placeholder="مثال: موقع البرج الإداري"
            />
          </Field>
          <Field label="العنوان أو المكان">
            <TextInput
              value={siteForm.location}
              onChange={(e) => setSiteForm({ ...siteForm, location: e.target.value })}
              placeholder="مثال: التجمع الخامس، القاهرة الجديدة"
            />
          </Field>
          <Field label="ملاحظات">
            <TextArea
              value={siteForm.notes}
              onChange={(e) => setSiteForm({ ...siteForm, notes: e.target.value })}
              placeholder="ملاحظات فنية أو إدارية للموقع"
            />
          </Field>
        </div>
        <div className="formActions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={!siteForm.code || !siteForm.name}
            onClick={handleCreateSite}
          >
            إضافة الموقع
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setSiteModalOpen(false)}>
            إلغاء
          </button>
        </div>
      </Modal>

      {/* Site Delete Confirmation */}
      <ConfirmDialog
        open={!!siteDeleteTarget}
        text={`هل تريد بالتأكيد حذف الموقع "${siteDeleteTarget?.name}"؟`}
        onConfirm={handleDeleteSite}
        onCancel={() => setSiteDeleteTarget(null)}
      />
    </div>
  );
};


