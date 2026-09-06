const fs = require('fs');
let code = fs.readFileSync('apps/web/src/pages/FinancialsPage.tsx', 'utf8');

const newComponent = `

const ProjectDetailView = ({ p, onBack }: { p: ProjectFinancial, onBack: () => void }) => {
  const [tab, setTab] = useState<'boq' | 'ipcs' | 'docs'>('boq');
  
  const totalExecuted = p.ipcs.reduce((s, i) => s + Number(i.netAmount), 0);
  const totalDeductions = p.ipcs.reduce((s, i) => s + Number(i.deductions), 0);
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
        <KpiCard label="نسبة الإنجاز" value={\`\${completionPct}%\`} />
        <KpiCard label="المتبقي" value={remaining.toLocaleString()} />
        <KpiCard label="عدد المستخلصات" value={String(p.ipcs.length)} />
        <KpiCard label="حالة آخر مستخلص" value={lastIpc ? statusLabels[lastIpc.status] || lastIpc.status : '—'} />
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={\`btn btn--sm \${tab === 'boq' ? 'btn--primary' : 'btn--ghost'}\`} onClick={() => setTab('boq')}>بنود المقايسة</button>
        <button className={\`btn btn--sm \${tab === 'ipcs' ? 'btn--primary' : 'btn--ghost'}\`} onClick={() => setTab('ipcs')}>المستخلصات</button>
        <button className={\`btn btn--sm \${tab === 'docs' ? 'btn--primary' : 'btn--ghost'}\`} onClick={() => setTab('docs')}>المستندات المرتبطة</button>
      </div>

      {tab === 'boq' && <ProjectBoqTab projectId={p.projectId} />}
      {tab === 'ipcs' && <ProjectIpcsTab projectId={p.projectId} />}
      {tab === 'docs' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
             <button className="btn btn--primary" onClick={() => alert('سيتم تفعيل رفع المستند قريباً')}>رفع مستند للأرشيف</button>
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
    </div>
  );
};
`;

code = code + newComponent;
fs.writeFileSync('apps/web/src/pages/FinancialsPage.tsx', code);
