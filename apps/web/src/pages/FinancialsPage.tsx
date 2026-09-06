import React, { useState, useEffect, useMemo } from 'react';
import { api, downloadDocument } from '../lib/api';
import { Link } from 'react-router-dom';
import { Badge, toneForStatus } from '../components/ui';
import { PreviewDocButton, DownloadDocButton } from '../components/ProtectedFileLink';
import { ProjectBoqTab } from '../components/projects/ProjectBoqTab';
import { ProjectIpcsTab } from '../components/projects/ProjectIpcsTab';
import { QuickUploadModal } from '../components/QuickUploadModal';

interface IpcMinimal {
  id: string;
  ipcNumber: number;
  netAmount: number;
  deductions: number;
  status: string;
  date: string;
}

interface LinkedDoc {
  id: string;
  title: string;
  category: string;
  documentType: string;
  fileName: string;
  filePath: string;
  ipcId?: string;
}

interface ProjectFinancial {
  projectId: string;
  projectCode: string;
  projectName: string;
  client: string;
  owner: string;
  contractNumber: string;
  siteLocation: string;
  region: string;
  status: string;
  boqTotal: number;
  executedTotal: number;
  executedDeductions: number;
  ipcs: IpcMinimal[];
  linkedDocs: LinkedDoc[];
}

const statusLabels: Record<string, string> = {
  planned: 'مخطط',
  active: 'جاري',
  'on-hold': 'معلق',
  completed: 'منتهي',
  cancelled: 'ملغي',
  draft: 'مسودة',
  submitted: 'مقدم',
  approved: 'معتمد',
};

export const FinancialsPage = () => {
  const [data, setData] = useState<ProjectFinancial[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOwners, setExpandedOwners] = useState<Set<string>>(new Set());
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [selectedProject, setSelectedProject] = useState<ProjectFinancial | null>(null);

  // Filters
  const [filterOwner, setFilterOwner] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPendingIpcs, setFilterPendingIpcs] = useState(false);

  const load = () => {
    setLoading(true);
    api.get<ProjectFinancial[]>('/api/projects/financials')
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  // Get unique values for filters
  const allOwners = useMemo(() => [...new Set(data.map(d => d.owner || 'بدون جهة'))].sort(), [data]);
  const allRegions = useMemo(() => [...new Set(data.map(d => d.region || 'بدون منطقة'))].sort(), [data]);

  // Filter data
  const filteredData = useMemo(() => {
    return data.filter(p => {
      if (filterOwner && (p.owner || 'بدون جهة') !== filterOwner) return false;
      if (filterRegion && (p.region || 'بدون منطقة') !== filterRegion) return false;
      if (filterStatus && p.status !== filterStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.projectName.toLowerCase().includes(q) && !p.contractNumber.toLowerCase().includes(q) && !p.projectCode.toLowerCase().includes(q)) return false;
      }
      if (filterPendingIpcs) {
        const hasPending = p.ipcs.some(i => i.status === 'draft' || i.status === 'submitted');
        if (!hasPending) return false;
      }
      return true;
    });
  }, [data, filterOwner, filterRegion, filterStatus, searchQuery, filterPendingIpcs]);

  // Group: Owner → Region → Projects
  const groupedData = useMemo(() => {
    const ownerMap = new Map<string, Map<string, ProjectFinancial[]>>();
    for (const row of filteredData) {
      const owner = row.owner || 'بدون جهة';
      const region = row.region || 'بدون منطقة';
      if (!ownerMap.has(owner)) ownerMap.set(owner, new Map());
      const regionMap = ownerMap.get(owner)!;
      if (!regionMap.has(region)) regionMap.set(region, []);
      regionMap.get(region)!.push(row);
    }
    return ownerMap;
  }, [filteredData]);

  // Max IPC count for dynamic columns
  const maxIpcCount = useMemo(() => Math.max(1, ...filteredData.map(p => p.ipcs.length)), [filteredData]);

  // Hero KPIs: executed/net use backend approved-only totals (business rule)
  const kpiBoq = useMemo(() => filteredData.reduce((s, p) => s + Number(p.boqTotal), 0), [filteredData]);
  const kpiExec = useMemo(
    () => filteredData.reduce((s, p) => s + Number(p.executedTotal), 0),
    [filteredData],
  );
  const kpiNet = useMemo(
    () => filteredData.reduce((s, p) => s + Number(p.executedTotal) - Number(p.executedDeductions), 0),
    [filteredData],
  );

  const expandAll = () => {
    setExpandedOwners(new Set(groupedData.keys()));
    const allRegionKeys = new Set<string>();
    groupedData.forEach((regionMap, owner) => {
      regionMap.forEach((_, region) => allRegionKeys.add(`${owner}||${region}`));
    });
    setExpandedRegions(allRegionKeys);
  };

  const collapseAll = () => {
    setExpandedOwners(new Set());
    setExpandedRegions(new Set());
  };

  const toggleOwner = (owner: string) => {
    const s = new Set(expandedOwners);
    s.has(owner) ? s.delete(owner) : s.add(owner);
    setExpandedOwners(s);
  };

  const toggleRegion = (key: string) => {
    const s = new Set(expandedRegions);
    s.has(key) ? s.delete(key) : s.add(key);
    setExpandedRegions(s);
  };

  if (loading) return (
    <div className="page">
      <div className="card skeletonCard" style={{ height: 120, marginBottom: 18 }} />
      <div className="card skeletonCard" style={{ height: 64, marginBottom: 18 }} />
      <div className="card skeletonCard" style={{ height: 220 }} />
    </div>
  );

  // Project Detail View
  if (selectedProject) {
    // Keep it synced if the underlying data updates
    const currentP = data.find(p => p.projectId === selectedProject.projectId) || selectedProject;
    return <ProjectDetailView p={currentP} onBack={() => setSelectedProject(null)} onReload={load} />;
  }

  return (
    <div className="page">
      <div className="finHero">
        <div>
          <h1>الموقف المالي والتعاقدي</h1>
          <p>متابعة المقايسات والمستخلصات والجهات المالكة للمشاريع</p>
        </div>
        <div className="finKpis">
          <div className="finKpi"><b>{kpiBoq.toLocaleString()}</b><span>إجمالي المقايسات</span></div>
          <div className="finKpi"><b>{kpiExec.toLocaleString()}</b><span>إجمالي المنفذ</span></div>
          <div className="finKpi"><b>{kpiNet.toLocaleString()}</b><span>الصافي بعد الاستقطاع</span></div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button className="btn btn--sm btn--ghost" onClick={expandAll}>عرض الكل</button>
        <button className="btn btn--sm btn--ghost" onClick={collapseAll}>طي الكل</button>
      </div>

      {/* Filters */}
      <div className="finToolbar">
        <div className="finSearchWrap">
          <input className="finSearch" placeholder="بحث باسم المشروع أو رقم العقد..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          <span className="finSearchIcon">🔍</span>
        </div>
        <select className="finSelect" value={filterOwner} onChange={e => setFilterOwner(e.target.value)}>
          <option value="">كل الجهات</option>
          {allOwners.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="finSelect" value={filterRegion} onChange={e => setFilterRegion(e.target.value)}>
          <option value="">كل المناطق</option>
          {allRegions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="finSelect" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="active">جاري</option>
          <option value="completed">منتهي</option>
          <option value="on-hold">معلق</option>
          <option value="planned">مخطط</option>
        </select>
        <label className="finCheck">
          <input type="checkbox" checked={filterPendingIpcs} onChange={e => setFilterPendingIpcs(e.target.checked)} />
          مستخلصات معلقة فقط
        </label>
      </div>

      {/* Main Table */}
      {filteredData.length === 0 ? (
        <div className="card">
          <div className="emptyState">
            <div className="emptyState__art">📊</div>
            <div className="emptyState__title">لا توجد مشاريع مطابقة</div>
            <div className="emptyState__hint">جرّب تعديل البحث أو الفلاتر لعرض النتائج</div>
          </div>
        </div>
      ) : (
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="table" style={{ minWidth: 800 + maxIpcCount * 200 }}>
          <thead>
            <tr>
              <th style={{ width: 200 }}>اسم المشروع</th>
              <th style={{ width: 100 }}>المنطقة</th>
              <th style={{ width: 80 }}>رقم العقد</th>
              <th style={{ width: 80 }}>الحالة</th>
              <th style={{ width: 120 }}>المقايسة</th>
              {Array.from({ length: maxIpcCount }, (_, i) => (
                <React.Fragment key={i}>
                  <th>جاري {i + 1}</th>
                  <th>استقطاع {i + 1}</th>
                </React.Fragment>
              ))}
              <th>📎</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(groupedData.entries()).map(([owner, regionMap]) => {
              const ownerExpanded = expandedOwners.has(owner);
              const ownerProjects = Array.from(regionMap.values()).flat();
              const ownerBoqTotal = ownerProjects.reduce((s, p) => s + Number(p.boqTotal), 0);

              return (
                <React.Fragment key={owner}>
                  {/* Owner Row */}
                  <tr className="ownerGroupRow" style={{ cursor: 'pointer' }} onClick={() => toggleOwner(owner)}>
                    <td colSpan={5 + maxIpcCount * 2 + 1} style={{ fontWeight: 'bold' }}>
                      {ownerExpanded ? '▼' : '◀'} <span style={{ fontSize: 12, opacity: .75, fontWeight: 400 }}>الجهة المالكة:</span> {owner} — {ownerProjects.length} مشاريع — إجمالي: <span className="num">{ownerBoqTotal.toLocaleString()}</span>
                    </td>
                  </tr>

                  {ownerExpanded && Array.from(regionMap.entries()).map(([region, projects]) => {
                    const regionKey = `${owner}||${region}`;
                    const regionExpanded = expandedRegions.has(regionKey);
                    const regionBoqTotal = projects.reduce((s, p) => s + Number(p.boqTotal), 0);

                    return (
                      <React.Fragment key={regionKey}>
                        {/* Region Row */}
                        <tr style={{ background: 'var(--surface-hover)', cursor: 'pointer' }} onClick={() => toggleRegion(regionKey)}>
                          <td colSpan={5 + maxIpcCount * 2 + 1} style={{ paddingRight: 32 }}>
                            {regionExpanded ? '▼' : '◀'} <strong>{region}</strong> — {projects.length} مشاريع — {regionBoqTotal.toLocaleString()}
                          </td>
                        </tr>

                        {regionExpanded && projects.map(p => {
                          const docCount = p.linkedDocs.length;
                          return (
                            <tr key={p.projectId} className="hoverable" style={{ cursor: 'pointer' }} onClick={() => setSelectedProject(p)}>
                              <td style={{ paddingRight: 48 }}><Link to="#" onClick={e => e.preventDefault()}>{p.projectName}</Link></td>
                              <td>{p.region || '—'}</td>
                              <td>{p.contractNumber}</td>
                              <td><Badge tone={toneForStatus(p.status)}>{statusLabels[p.status] || p.status}</Badge></td>
                              <td style={{ fontWeight: 'bold' }}><span className="num">{Number(p.boqTotal).toLocaleString()}</span></td>
                              {Array.from({ length: maxIpcCount }, (_, i) => {
                                const ipc = p.ipcs.find(x => x.ipcNumber === i + 1);
                                return (
                                  <React.Fragment key={i}>
                                    <td>{ipc ? <span className="num">{Number(ipc.netAmount).toLocaleString()}</span> : '—'}</td>
                                    <td style={{ color: ipc && Number(ipc.deductions) > 0 ? 'var(--danger)' : undefined }}>
                                      {ipc ? <span className="num">{Number(ipc.deductions).toLocaleString()}</span> : '—'}
                                    </td>
                                  </React.Fragment>
                                );
                              })}
                              <td>{docCount > 0 ? `📎 ${docCount}` : ''}</td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
};

const KpiCard = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <div className="card" style={{ textAlign: 'center', padding: 16 }}>
    <div className="muted small">{label}</div>
    <div style={{ fontSize: 22, fontWeight: 'bold', color: color || 'inherit', marginTop: 4 }}>{value}</div>
  </div>
);

const DocGroup = ({ title, docs }: { title: string; docs: LinkedDoc[] }) => (
  <div className="card" style={{ padding: 12 }}>
    <strong>{title}</strong>
    {docs.length === 0 ? <p className="muted small">لا يوجد</p> : (
      <ul style={{ listStyle: 'none', padding: 0, marginTop: 8 }}>
        {docs.map(d => (
          <li key={d.id} style={{ marginBottom: 4 }}>
            <PreviewDocButton documentId={d.id} fileName={d.fileName} small /> <DownloadDocButton documentId={d.id} fileName={d.fileName} small /> <span className="small muted">{d.title}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
);


const ProjectDetailView = ({ p, onBack, onReload }: { p: ProjectFinancial, onBack: () => void, onReload: () => void }) => {
  const [tab, setTab] = useState<'boq' | 'ipcs' | 'docs'>('boq');
  const [uploadOpen, setUploadOpen] = useState(false);
  
  // Approved-only backend totals (business rule: draft/submitted/rejected excluded)
  const totalExecuted = Number(p.executedTotal);
  const totalDeductions = Number(p.executedDeductions);
  const netCollected = totalExecuted - totalDeductions;
  const boqTotal = Number(p.boqTotal);
  const completionPct = boqTotal > 0 ? ((totalExecuted / boqTotal) * 100).toFixed(1) : '0';
  const remaining = boqTotal - totalExecuted;
  const lastIpc = p.ipcs.length > 0 ? p.ipcs[p.ipcs.length - 1] : null;

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1>{p.projectName}</h1>
        </div>
        <button className="btn btn--ghost" onClick={onBack}>← رجوع</button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <KpiCard label="قيمة العقد (المقايسة)" value={boqTotal.toLocaleString()} />
        <KpiCard label="إجمالي المنفذ" value={totalExecuted.toLocaleString()} />
        <KpiCard label="إجمالي الاستقطاعات" value={totalDeductions.toLocaleString()} color="var(--danger)" />
        <KpiCard label="صافي المحصّل" value={netCollected.toLocaleString()} color="var(--success)" />
        <KpiCard label="نسبة الإنجاز" value={`${completionPct}%`} />
        <KpiCard label="المتبقي" value={remaining.toLocaleString()} />
        <KpiCard label="عدد المستخلصات" value={String(p.ipcs.length)} />
        <KpiCard label="حالة آخر مستخلص" value={lastIpc ? statusLabels[lastIpc.status] || lastIpc.status : '—'} />
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`btn btn--sm ${tab === 'boq' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setTab('boq')}>بنود المقايسة</button>
        <button className={`btn btn--sm ${tab === 'ipcs' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setTab('ipcs')}>المستخلصات</button>
        <button className={`btn btn--sm ${tab === 'docs' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setTab('docs')}>المستندات المرتبطة</button>
      </div>

      {tab === 'boq' && <ProjectBoqTab projectId={p.projectId} />}
      {tab === 'ipcs' && <ProjectIpcsTab projectId={p.projectId} />}
      {tab === 'docs' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
             <button className="btn btn--primary" onClick={() => setUploadOpen(true)}>رفع مستند للأرشيف</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <DocGroup title="📄 العقود" docs={p.linkedDocs.filter(d => d.category === 'عقد')} />
            <DocGroup title="📊 المقايسات" docs={p.linkedDocs.filter(d => d.category === 'مقايسة')} />
            <DocGroup title="📋 مستخلصات" docs={p.linkedDocs.filter(d => d.category === 'مستخلص')} />
            <DocGroup title="📋 استقطاعات" docs={p.linkedDocs.filter(d => d.category === 'استقطاع')} />
            <DocGroup title="📋 أخرى" docs={p.linkedDocs.filter(d => !['عقد', 'مقايسة', 'مستخلص', 'استقطاع'].includes(d.category))} />
          </div>
        </div>
      )}

      {uploadOpen && (
        <QuickUploadModal
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          onSuccess={onReload}
          defaultProjectId={p.projectId}
        />
      )}
    </div>
  );
};
