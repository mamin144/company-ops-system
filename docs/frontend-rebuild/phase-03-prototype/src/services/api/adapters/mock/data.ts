// SYNTHETIC prototype data. Every record is invented for review; nothing here
// is a company record. Statuses mirror the verified backend unions exactly.
export interface Project { id: string; code: string; name: string; client: string; owner: string; status: 'planned' | 'active' | 'on-hold' | 'completed' | 'cancelled'; region: string; contractNo: string;
  /** قيمة العقد — مبلغ مباشر يطابق حقول العقود الحقيقية (Project.contractValue
   * في packages/shared/src/types.ts + projectSchema في apps/api)؛ تُدخل مباشرة
   * ولا تعتمد على بنود المقايسة. تظل غير مُعرّفة عند غياب الإدخال — لا رقم وهمي. */
  contractValue?: number;
  /** Phase 9 remediation (CR-01): the remaining fields of the audited contract,
   * mirrored field-for-field from packages/shared/src/types.ts's Project —
   * the real POST /projects parses `projectSchema` (ALL of these) and PUT
   * takes the same schema partial(), so the entry forms may carry them.
   * Mock field aliases used by existing screens stay: code↔projectCode,
   * name↔projectName, contractNo↔contractNumber. `startDate`/`endDate`/
   * `siteLocation`/`mainContractor`/`notes`/`role` mirror the real columns
   * verbatim; absent stays absent (never a fabricated default). */
  mainContractor?: string; siteLocation?: string; startDate?: string; endDate?: string;
  role?: 'main-contractor' | 'subcontractor' | 'direct-contractor'; notes?: string; }
export interface Site { id: string; projectId: string; code: string; name: string; location: string; }
export interface DocRev { id: string; revision: string; fileName: string; by: string; at: string; notes?: string; }
export interface Doc { id: string; title: string; number: string; category: string; type: string; fileName: string; ext: string; revision: string; status: 'draft' | 'submitted' | 'under-review' | 'approved' | 'rejected' | 'superseded' | 'archived'; projectId?: string; folderName?: string; tags: string[]; updatedAt: string; revisions: DocRev[]; links: string[]; notes?: string; }
export interface Warehouse { id: string; code: string; name: string; type: 'central' | 'site'; location: string; status: 'active' | 'inactive'; projectId?: string; }
export interface Item { id: string; code: string; name: string; category: string; unit: string; minimumStock?: number; }
export type TxnType = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT' | 'RETURN';
export interface TxnLine { itemId: string; quantity: number; unitCost?: number }
/** Mirrors the audited StockTransaction contract (stock.validators.ts): a
    transaction always carries `lines` (min 1); `destinationWarehouseId` is
    only ever set for TRANSFER. Balances are DERIVED from this ledger — never
    stored — exactly as apps/api/src/services/stock.service.ts does. */
export interface Txn {
  id: string; number: string; type: TxnType; warehouseId: string;
  destinationWarehouseId?: string; projectId?: string; date: string;
  referenceNumber?: string; notes?: string; createdBy?: string;
  lines: TxnLine[];
}
/** Audited numbering prefixes (stock.factory.ts PREFIX). */
export const TX_PREFIX: Record<TxnType, string> = { IN: 'GIN', OUT: 'GOUT', TRANSFER: 'TRF', ADJUSTMENT: 'ADJ', RETURN: 'RET' };
/** Audited permission per movement type (stock.routes.ts TYPE_PERMISSION). */
export const TX_PERMISSION: Record<TxnType, string> = {
  IN: 'warehouse.stock_in', OUT: 'warehouse.stock_out', TRANSFER: 'warehouse.transfer',
  ADJUSTMENT: 'warehouse.adjust', RETURN: 'warehouse.return',
};
/** Audited signed effect (stock.service.ts signedQty): ADJUSTMENT may be negative. */
export const signedQty = (type: TxnType, qty: number) =>
  type === 'IN' || type === 'RETURN' ? qty : type === 'OUT' || type === 'TRANSFER' ? -qty : qty;
export interface MRLine { itemId: string; requested: number; issued: number; notes?: string }
/** Mirrors the audited MaterialRequest union + MaterialRequestLine
    (requestedQty / issuedQty). `closed` exists in the union but NO audited
    backend route reaches it — see RECOMMENDED-NEXT-STEPS/report. */
export interface MR { id: string; number: string; status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'partially-issued' | 'issued' | 'closed'; projectId?: string; siteId?: string; warehouseId: string; by: string; createdAt: string; lines: MRLine[]; notes?: string; reviewedBy?: string; reviewNotes?: string; }
export interface Notif { id: string; type: string; title: string; message: string; link?: string; read: boolean; }
/* Audited AuditLog (audit.service.ts): id, userId, username, action, entity,
   entityId, oldValue, newValue, timestamp, ipAddress.
   There is NO project field — so the audit page deliberately has no project
   filter, and no export row claims one. */
export interface Audit { id: string; action: string; entity: string; entityId?: string; user: string; at: string; diff?: { field: string; from: string; to: string }[]; }
/* ---------- BOQ / IPC ----------
   Field-for-field transcription of packages/shared/src/types.ts (BoqItem,
   Ipc, IpcItem) and the audited zod schemas. `totalPrice` / `totalQuantity`
   exist on the shared types but no audited route ever writes them, so they are
   DERIVED at render time here too — never stored, never edited. */
export interface BoqItem { id: string; projectId: string; itemCode: string; description: string; unit: string; quantity: number; unitPrice: number; }
export type IpcStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export interface Ipc { id: string; projectId: string; ipcNumber: number; date: string; status: IpcStatus; notes?: string; netAmount?: number; deductions?: number; grossAmount?: number; }
export interface IpcLine { id: string; ipcId: string; boqItemId: string; previousQuantity: number; currentQuantity: number; }
export const boqItems: BoqItem[] = [
  { id: 'bq1', projectId: 'p1', itemCode: '01-01', description: 'خرسانة جاهزة للأساسات', unit: 'م³', quantity: 12000, unitPrice: 850 },
  { id: 'bq2', projectId: 'p1', itemCode: '01-02', description: 'حديد تسليح', unit: 'طن', quantity: 850, unitPrice: 12500 },
  { id: 'bq3', projectId: 'p1', itemCode: '03-01', description: 'أعمال بناء بأحجار', unit: 'م²', quantity: 5400, unitPrice: 410 },
  { id: 'bq4', projectId: 'p1', itemCode: '05-01', description: 'تشطيبات داخلية', unit: 'م²', quantity: 3200, unitPrice: 980 },
  { id: 'bq5', projectId: 'p1', itemCode: '07-01', description: 'أعمال كهربائية', unit: 'م²', quantity: 3200, unitPrice: 520 },
  { id: 'bq6', projectId: 'p2', itemCode: '01-01', description: 'خرسانة جاهزة', unit: 'م³', quantity: 6000, unitPrice: 900 },
  { id: 'bq7', projectId: 'p2', itemCode: '01-02', description: 'حديد تسليح', unit: 'طن', quantity: 420, unitPrice: 12800 },
  { id: 'bq8', projectId: 'p2', itemCode: '05-01', description: 'أعمال تشطيب', unit: 'م²', quantity: 4800, unitPrice: 1050 },
];
/* Every line below is internally consistent with the ledger: cumulative
   quantity per BOQ item never exceeds the BOQ quantity, and each IPC's
   netAmount is exactly Σ(currentQuantity × unitPrice) — the audited rule. */
export const ipcs: Ipc[] = [
  { id: 'ipc1', projectId: 'p1', ipcNumber: 1, date: '2026-05-20', status: 'approved', netAmount: 2025000, notes: 'دفعة أولى' },
  { id: 'ipc2', projectId: 'p1', ipcNumber: 2, date: '2026-07-15', status: 'approved', netAmount: 2586500 },
  { id: 'ipc3', projectId: 'p1', ipcNumber: 3, date: '2026-09-20', status: 'submitted', netAmount: 1412000 },
  { id: 'ipc4', projectId: 'p1', ipcNumber: 4, date: '2026-10-05', status: 'draft', grossAmount: 300000, deductions: 10000, netAmount: 290000, notes: 'مستخلص بقيمة مباشرة — بلا بنود' },
  { id: 'ipc5', projectId: 'p2', ipcNumber: 1, date: '2026-04-10', status: 'approved', netAmount: 1232000 },
  { id: 'ipc6', projectId: 'p2', ipcNumber: 2, date: '2026-08-01', status: 'rejected', netAmount: 270000, notes: 'مستندات ناقصة' },
];
export const ipcLines: IpcLine[] = [
  { id: 'il1', ipcId: 'ipc1', boqItemId: 'bq1', previousQuantity: 0, currentQuantity: 1500 },
  { id: 'il2', ipcId: 'ipc1', boqItemId: 'bq2', previousQuantity: 0, currentQuantity: 60 },
  { id: 'il3', ipcId: 'ipc2', boqItemId: 'bq1', previousQuantity: 1500, currentQuantity: 1800 },
  { id: 'il4', ipcId: 'ipc2', boqItemId: 'bq2', previousQuantity: 60, currentQuantity: 55 },
  { id: 'il5', ipcId: 'ipc2', boqItemId: 'bq3', previousQuantity: 0, currentQuantity: 900 },
  { id: 'il6', ipcId: 'ipc3', boqItemId: 'bq1', previousQuantity: 3300, currentQuantity: 1200 },
  { id: 'il7', ipcId: 'ipc3', boqItemId: 'bq4', previousQuantity: 0, currentQuantity: 400 },
  { id: 'il8', ipcId: 'ipc5', boqItemId: 'bq6', previousQuantity: 0, currentQuantity: 800 },
  { id: 'il9', ipcId: 'ipc5', boqItemId: 'bq7', previousQuantity: 0, currentQuantity: 40 },
  { id: 'il10', ipcId: 'ipc6', boqItemId: 'bq6', previousQuantity: 800, currentQuantity: 300 },
];

export const projects: Project[] = [
  { id: 'p1', code: 'PRJ-004', name: 'برج النيل الإداري (تجريبي)', client: 'شركة العاصمة (تجريبية)', owner: 'جهاز المدينة (تجريبي)', status: 'active', region: 'التجمع', contractNo: 'C-2026-014' },
  { id: 'p2', code: 'PRJ-007', name: 'مستشفى الشفاء (تجريبي)', client: 'وزارة الصحة (تجريبية)', owner: 'الوزارة (تجريبية)', status: 'on-hold', region: 'أكتوبر', contractNo: 'C-2026-021' },
  { id: 'p3', code: 'PRJ-002', name: 'مدرسة المستقبل (تجريبية)', client: 'هيئة الأبنية (تجريبية)', owner: 'الهيئة (تجريبية)', status: 'completed', region: 'الشروق', contractNo: 'C-2025-009' },
  { id: 'p4', code: 'PRJ-009', name: 'مول الواحة (تجريبي)', client: 'مجموعة الواحة (تجريبية)', owner: 'المجموعة (تجريبية)', status: 'planned', region: 'التجمع', contractNo: 'C-2026-030' },
];
export const sites: Site[] = [
  { id: 's1', projectId: 'p1', code: 'S-01', name: 'موقع البرج الرئيسي', location: 'التجمع الخامس' },
  { id: 's2', projectId: 'p1', code: 'S-02', name: 'موقع الجراج', location: 'التجمع الخامس' },
  { id: 's3', projectId: 'p2', code: 'S-01', name: 'موقع المستشفى', location: 'أكتوبر' },
];
export const documents: Doc[] = [
  { id: 'd1', title: 'مخططات إنشائية — الدور الأرضي', number: 'DOC-220', category: 'مخططات', type: 'PDF', fileName: 'مخططات-إنشائية-الدور-الأرضي-باسم-طويل-جدا-للاختبار-v03.pdf', ext: 'pdf', revision: '03', status: 'under-review', projectId: 'p1', folderName: 'مجلد قديم: إنشائي', tags: ['إنشائي', 'مراجعة'], links: ['d3'], updatedAt: '2026-10-02', revisions: [{ id: 'r1', revision: '01', fileName: 'v01.pdf', by: 'م. تجريبي', at: '2026-08-01' }, { id: 'r2', revision: '02', fileName: 'v02.pdf', by: 'م. تجريبي', at: '2026-09-05' }, { id: 'r3', revision: '03', fileName: 'v03.pdf', by: 'م. تجريبي', at: '2026-10-02' }] },
  { id: 'd2', title: 'مستخلص رقم ٣', number: 'DOC-198', category: 'مستخلصات', type: 'PDF', fileName: 'IPC-03.pdf', ext: 'pdf', revision: '00', status: 'submitted', projectId: 'p1', tags: ['مالي'], links: ['d1'], updatedAt: '2026-10-05', revisions: [{ id: 'r4', revision: '00', fileName: 'IPC-03.pdf', by: 'م. تجريبي', at: '2026-10-05' }] },
  { id: 'd3', title: 'عقد المقاول الرئيسي', number: 'DOC-150', category: 'عقود', type: 'PDF', fileName: 'contract.pdf', ext: 'pdf', revision: '00', status: 'approved', projectId: 'p1', folderName: 'مجلد قديم: تعاقدات', tags: ['تعاقد'], links: [], updatedAt: '2026-06-11', revisions: [{ id: 'r5', revision: '00', fileName: 'contract.pdf', by: 'م. تجريبي', at: '2026-06-11' }] },
  { id: 'd4', title: 'مقايسة بنود التشطيب', number: 'DOC-120', category: 'مقايسات', type: 'XLSX', fileName: 'boq.xlsx', ext: 'xlsx', revision: '01', status: 'approved', projectId: 'p2', tags: [], links: [], updatedAt: '2026-07-19', revisions: [{ id: 'r6', revision: '01', fileName: 'boq.xlsx', by: 'م. تجريبي', at: '2026-07-19' }] },
  { id: 'd5', title: 'تقرير اختبار خرسانة', number: 'DOC-301', category: 'تقارير', type: 'PDF', fileName: 'concrete-test.pdf', ext: 'pdf', revision: '00', status: 'draft', tags: [], links: ['d4'], updatedAt: '2026-10-08', revisions: [] },
  { id: 'd6', title: 'مخطط معماري مرفوض', number: 'DOC-090', category: 'مخططات', type: 'DWG', fileName: 'arch.dwg', ext: 'dwg', revision: '01', status: 'rejected', projectId: 'p3', tags: [], links: [], updatedAt: '2025-12-01', revisions: [{ id: 'r7', revision: '01', fileName: 'arch.dwg', by: 'م. تجريبي', at: '2025-12-01' }] },
  { id: 'd7', title: 'محضر استلام موقع', number: 'DOC-310', category: 'محاضر', type: 'PDF', fileName: 'handover.pdf', ext: 'pdf', revision: '00', status: 'superseded', projectId: 'p3', tags: [], links: [], updatedAt: '2025-11-02', revisions: [] },
  { id: 'd8', title: 'أرشيف ٢٠٢٤', number: 'DOC-001', category: 'أخرى', type: 'ZIP', fileName: '2024.zip', ext: 'zip', revision: '00', status: 'archived', tags: [], links: [], updatedAt: '2025-01-15', revisions: [] },
];
export const warehouses: Warehouse[] = [
  { id: 'w1', code: 'WH-C1', name: 'المخزن المركزي (تجريبي)', type: 'central', location: 'العبور', status: 'active' },
  { id: 'w2', code: 'WH-S1', name: 'مخزن موقع البرج (تجريبي)', type: 'site', location: 'التجمع', status: 'active', projectId: 'p1' },
  { id: 'w3', code: 'WH-S2', name: 'مخزن موقع المستشفى (تجريبي)', type: 'site', location: 'أكتوبر', status: 'inactive', projectId: 'p2' },
  // Added with the sort/pagination work so the warehouse list actually has
  // more than one page. w4 carries no project (global, always visible); w5/w6
  // belong to p3/p4 so project scoping is exercised by real rows. None of them
  // appears in the transaction ledger, so no derived balance changes.
  { id: 'w4', code: 'WH-C2', name: 'مخزن العزل والحجر (تجريبي)', type: 'central', location: 'العبور', status: 'inactive' },
  { id: 'w5', code: 'WH-S3', name: 'مخزن موقع المدرسة (تجريبي)', type: 'site', location: 'الشروق', status: 'active', projectId: 'p3' },
  { id: 'w6', code: 'WH-S4', name: 'مخزن موقع المول (تجريبي)', type: 'site', location: 'التجمع', status: 'active', projectId: 'p4' },
];
export const items: Item[] = [
  { id: 'i1', code: 'ITM-001', name: 'أسمنت بورتلاندي', category: 'مواد بناء', unit: 'شيكارة', minimumStock: 200 },
  { id: 'i2', code: 'ITM-002', name: 'حديد تسليح ١٢مم', category: 'حديد', unit: 'طن', minimumStock: 5 },
  { id: 'i3', code: 'ITM-003', name: 'كابلات كهرباء', category: 'كهرباء', unit: 'لفة', minimumStock: 10 },
  { id: 'i4', code: 'ITM-004', name: 'دهانات بلاستيك', category: 'تشطيب', unit: 'جالون' },
  { id: 'i5', code: 'ITM-005', name: 'سيراميك أرضيات باسم طويل جدا لاختبار التفاف النصوص في البطاقات', category: 'تشطيب', unit: 'متر' },
  { id: 'i6', code: 'ITM-006', name: 'طوب أحمر', category: 'مواد بناء', unit: 'ألف' },
];
/* ---------- synthetic stock ledger ----------
   30 movements (8 opening IN + 22 activity, Jan–Oct 2026). Verified offline:
   no warehouse/item balance ever goes negative at any point, and the derived
   totals leave exactly two items below their safety level (ITM-001 cement,
   ITM-003 cables) so the low-stock tab has real content. Balances are computed
   from these rows at runtime (see mock/api.ts `deriveBalances`) — the old
   static `balances` map was removed because the audited backend never stores
   balances, it always derives them. Volume exists so sorting/pagination
   behaviour is observable, not decorational. Newest first so the dashboard
   "recent movements" panel stays truthful. */
const tx = (number: string, type: TxnType, warehouseId: string, date: string, lines: TxnLine[], extra: Partial<Txn> = {}): Txn =>
  ({ id: `t-${number}`, number, type, warehouseId, date, lines, createdBy: 'مستخدم تجريبي', ...extra });
export const transactions: Txn[] = [
  tx('RET-403', 'RETURN', 'w1', '2026-10-11', [{ itemId: 'i2', quantity: 2 }]),
  tx('GOUT-207', 'OUT', 'w1', '2026-10-09', [{ itemId: 'i3', quantity: 1 }], { projectId: 'p1', referenceNumber: 'MR-006' }),
  tx('TRF-304', 'TRANSFER', 'w1', '2026-10-06', [{ itemId: 'i3', quantity: 2 }], { destinationWarehouseId: 'w2' }),
  tx('GOUT-206', 'OUT', 'w2', '2026-10-03', [{ itemId: 'i1', quantity: 20 }], { projectId: 'p1', referenceNumber: 'MR-008' }),
  tx('GIN-105', 'IN', 'w1', '2026-10-01', [{ itemId: 'i1', quantity: 20 }], { referenceNumber: 'PO-8844' }),
  tx('ADJ-503', 'ADJUSTMENT', 'w1', '2026-09-28', [{ itemId: 'i6', quantity: 1 }], { notes: 'تسوية جرد' }),
  tx('GOUT-205', 'OUT', 'w1', '2026-09-25', [{ itemId: 'i2', quantity: 5 }], { projectId: 'p1' }),
  tx('GOUT-204', 'OUT', 'w1', '2026-09-18', [{ itemId: 'i4', quantity: 18 }], { projectId: 'p2' }),
  tx('GIN-104', 'IN', 'w1', '2026-09-16', [{ itemId: 'i4', quantity: 24 }]),
  tx('ADJ-502', 'ADJUSTMENT', 'w2', '2026-09-12', [{ itemId: 'i1', quantity: -3 }], { notes: 'تالف' }),
  tx('RET-402', 'RETURN', 'w1', '2026-09-10', [{ itemId: 'i1', quantity: 10 }], { referenceNumber: 'RTN-019' }),
  tx('GIN-103', 'IN', 'w1', '2026-09-07', [{ itemId: 'i3', quantity: 6 }]),
  tx('GOUT-203', 'OUT', 'w1', '2026-09-03', [{ itemId: 'i6', quantity: 10 }], { projectId: 'p3' }),
  tx('TRF-302', 'TRANSFER', 'w1', '2026-09-01', [{ itemId: 'i2', quantity: 4 }], { destinationWarehouseId: 'w2' }),
  tx('TRF-303', 'TRANSFER', 'w2', '2026-09-22', [{ itemId: 'i5', quantity: 20 }], { destinationWarehouseId: 'w1' }),
  tx('GIN-102', 'IN', 'w1', '2026-08-18', [{ itemId: 'i2', quantity: 8 }]),
  tx('GOUT-202', 'OUT', 'w2', '2026-08-20', [{ itemId: 'i5', quantity: 30 }], { projectId: 'p1' }),
  tx('ADJ-501', 'ADJUSTMENT', 'w1', '2026-08-14', [{ itemId: 'i3', quantity: -2 }], { notes: 'فرق جرد' }),
  tx('RET-401', 'RETURN', 'w2', '2026-08-12', [{ itemId: 'i4', quantity: 5 }], { referenceNumber: 'RTN-014' }),
  tx('TRF-301', 'TRANSFER', 'w1', '2026-08-09', [{ itemId: 'i1', quantity: 25 }], { destinationWarehouseId: 'w2' }),
  tx('GOUT-201', 'OUT', 'w1', '2026-08-05', [{ itemId: 'i1', quantity: 60 }], { projectId: 'p1', referenceNumber: 'MR-004' }),
  tx('GIN-101', 'IN', 'w1', '2026-08-03', [{ itemId: 'i1', quantity: 60 }], { referenceNumber: 'PO-8801' }),
  tx('GIN-008', 'IN', 'w2', '2026-01-07', [{ itemId: 'i5', quantity: 100 }]),
  tx('GIN-007', 'IN', 'w2', '2026-01-06', [{ itemId: 'i2', quantity: 2 }]),
  tx('GIN-006', 'IN', 'w2', '2026-01-06', [{ itemId: 'i1', quantity: 45 }]),
  tx('GIN-005', 'IN', 'w1', '2026-01-06', [{ itemId: 'i6', quantity: 30 }]),
  tx('GIN-004', 'IN', 'w1', '2026-01-05', [{ itemId: 'i4', quantity: 60 }]),
  tx('GIN-003', 'IN', 'w1', '2026-01-05', [{ itemId: 'i3', quantity: 4 }]),
  tx('GIN-002', 'IN', 'w1', '2026-01-05', [{ itemId: 'i2', quantity: 12 }]),
  tx('GIN-001', 'IN', 'w1', '2026-01-05', [{ itemId: 'i1', quantity: 120 }]),
];
/* 15 requests across 4 projects. p3 deliberately has NONE so the project filter
   has an honest empty result to demonstrate. Quantities stay inside the derived
   balances so every seeded issueable request can really be issued. */
export const requests: MR[] = [
  { id: 'm1', number: 'MR-012', status: 'submitted', projectId: 'p1', siteId: 's1', warehouseId: 'w1', by: 'م. موقع تجريبي', createdAt: '2026-10-07', lines: [{ itemId: 'i2', requested: 5, issued: 0 }], notes: 'عاجل لصب الأعمدة' },
  { id: 'm2', number: 'MR-011', status: 'approved', projectId: 'p1', warehouseId: 'w1', by: 'م. موقع تجريبي', createdAt: '2026-10-05', lines: [{ itemId: 'i1', requested: 100, issued: 0 }] },
  { id: 'm3', number: 'MR-009', status: 'rejected', projectId: 'p2', warehouseId: 'w1', by: 'م. موقع تجريبي', createdAt: '2026-10-01', lines: [{ itemId: 'i3', requested: 20, issued: 0 }], reviewNotes: 'اعتماد بديل من مورد آخر' },
  { id: 'm4', number: 'MR-008', status: 'partially-issued', projectId: 'p1', warehouseId: 'w2', by: 'م. موقع تجريبي', createdAt: '2026-09-28', lines: [{ itemId: 'i1', requested: 80, issued: 30 }] },
  { id: 'm5', number: 'MR-007', status: 'draft', warehouseId: 'w1', by: 'م. موقع تجريبي', createdAt: '2026-10-08', lines: [{ itemId: 'i4', requested: 10, issued: 0 }] },
  { id: 'm6', number: 'MR-006', status: 'issued', projectId: 'p1', warehouseId: 'w1', by: 'م. موقع تجريبي', createdAt: '2026-09-20', lines: [{ itemId: 'i3', requested: 1, issued: 1 }] },
  { id: 'm7', number: 'MR-005', status: 'closed', projectId: 'p2', warehouseId: 'w1', by: 'م. موقع تجريبي', createdAt: '2026-09-14', lines: [{ itemId: 'i4', requested: 30, issued: 30 }] },
  { id: 'm8', number: 'MR-004', status: 'submitted', projectId: 'p2', warehouseId: 'w1', by: 'م. موقع تجريبي', createdAt: '2026-09-10', lines: [{ itemId: 'i6', requested: 12, issued: 0 }] },
  { id: 'm9', number: 'MR-003', status: 'approved', projectId: 'p4', warehouseId: 'w1', by: 'م. موقع تجريبي', createdAt: '2026-09-06', lines: [{ itemId: 'i6', requested: 15, issued: 0 }] },
  { id: 'm10', number: 'MR-002', status: 'draft', projectId: 'p4', warehouseId: 'w1', by: 'م. موقع تجريبي', createdAt: '2026-09-02', lines: [{ itemId: 'i1', requested: 40, issued: 0 }] },
  { id: 'm11', number: 'MR-013', status: 'submitted', projectId: 'p1', warehouseId: 'w1', by: 'م. موقع تجريبي', createdAt: '2026-10-09', lines: [{ itemId: 'i4', requested: 20, issued: 0 }] },
  { id: 'm12', number: 'MR-014', status: 'partially-issued', projectId: 'p2', warehouseId: 'w1', by: 'م. موقع تجريبي', createdAt: '2026-10-10', lines: [{ itemId: 'i4', requested: 40, issued: 18 }] },
  { id: 'm13', number: 'MR-015', status: 'approved', warehouseId: 'w1', by: 'م. موقع تجريبي', createdAt: '2026-10-11', lines: [{ itemId: 'i4', requested: 10, issued: 0 }] },
  { id: 'm14', number: 'MR-016', status: 'closed', projectId: 'p1', warehouseId: 'w1', by: 'م. موقع تجريبي', createdAt: '2026-09-30', lines: [{ itemId: 'i5', requested: 30, issued: 30 }] },
  { id: 'm15', number: 'MR-017', status: 'issued', warehouseId: 'w2', by: 'م. موقع تجريبي', createdAt: '2026-10-12', lines: [{ itemId: 'i5', requested: 20, issued: 20 }] },
];
export const notifications: Notif[] = [
  { id: 'n1', type: 'material-request', title: 'طلب بانتظار الاعتماد', message: 'MR-012 يحتاج مراجعة', link: '/inventory/requests', read: false },
  { id: 'n2', type: 'low-stock', title: 'مخزون حرج', message: 'الأسمنت تحت الحد في المركزي', link: '/inventory/stock', read: false },
  { id: 'n3', type: 'document-status', title: 'مستند قيد المراجعة', message: 'DOC-220 بانتظار الاعتماد', link: '/archive', read: true },
  { id: 'n4', type: 'system', title: 'نسخة تجريبية', message: 'هذه بيانات وهمية للمراجعة فقط', read: true },
];
/* Phase 3.7 — the trail is deliberately larger than one screen so that
   filtering, sorting and pagination are exercised for real, not asserted in
   theory. Deterministic (no randomness). Demo-only: nothing here is a real
   business record and no credentials or tokens are ever shown. */
type AuditSeed = [at: string, user: string, action: string, entity: string, entityId: string, diff?: [string, string, string][]];
const AUDIT_SEED: AuditSeed[] = [
  ['2026-10-12T09:14:00', 'ليلى حسن (تجريبية)', 'اعتماد', 'طلب مواد', 'MR-2026-0015', [['الحالة', 'مقدمة', 'معتمدة']]],
  ['2026-10-12T09:40:00', 'دينا خالد (تجريبية)', 'تعديل', 'بند مقايسة', 'BQ-p1-07-01', [['الفئة', '520', '600']]],
  ['2026-10-11T11:02:00', 'عمر فاروق (تجريبي)', 'دخول', 'حركة مخزنية', 'GIN-2026-0031', [['الكمية', '0', '120']]],
  ['2026-10-11T10:55:00', 'عمر فاروق (تجريبي)', 'دخول', 'حركة مخزنية', 'GIN-2026-0030', [['الكمية', '0', '80']]],
  ['2026-10-11T08:30:00', 'سارة محمود (تجريبية)', 'تعديل', 'مستخلص', 'IPC-p1-0003', [['الحالة', 'مقدمة', 'معتمدة']]],
  ['2026-10-10T15:45:00', 'منى سمير (تجريبية)', 'رفض', 'طلب مواد', 'MR-2026-0014', [['الحالة', 'مقدمة', 'مرفوضة']]],
  ['2026-10-10T14:20:00', 'عمر فاروق (تجريبي)', 'خروج', 'حركة مخزنية', 'GOUT-2026-0018', [['الكمية', '0', '35']]],
  ['2026-10-10T12:05:00', 'ليلى حسن (تجريبية)', 'إنشاء', 'مستند', 'DOC-0031', [['العنوان', '—', 'تقرير اختبار خرسانة — القطاع الشمالي']]],
  ['2026-10-09T16:33:00', 'دينا خالد (تجريبية)', 'تعديل', 'مشروع', 'p2', [['الحالة', 'نشطة', 'موقوفة']]],
  ['2026-10-09T10:11:00', 'سارة محمود (تجريبية)', 'إنشاء', 'بند مقايسة', 'BQ-p1-01-01', [['الكمية', '—', '12000']]],
  ['2026-10-08T13:47:00', 'عمر فاروق (تجريبي)', 'نقل', 'حركة مخزنية', 'TRF-2026-0009', [['الكمية', '0', '15']]],
  ['2026-10-08T09:20:00', 'منى سمير (تجريبية)', 'تعديل', 'مستخلص', 'IPC-p1-0002', [['الاستقطاعات', '0', '10000']]],
  ['2026-10-07T17:02:00', 'ليلى حسن (تجريبية)', 'حذف', 'مستند', 'DOC-0029', [['العنوان', 'مسودة حدّية', '—']]],
  ['2026-10-07T11:25:00', 'عمر فاروق (تجريبي)', 'تسوية', 'حركة مخزنية', 'ADJ-2026-0004', [['الكمية', '0', '-6']]],
  ['2026-10-06T15:10:00', 'دينا خالد (تجريبية)', 'اعتماد', 'طلب مواد', 'MR-2026-0013', [['الحالة', 'مقدمة', 'معتمدة']]],
  ['2026-10-06T09:05:00', 'كريم عادل (تجريبي)', 'دخول', 'جلسة', 'S-2026-10-06-01'],
  ['2026-10-05T14:38:00', 'عمر فاروق (تجريبي)', 'مرتجع', 'حركة مخزنية', 'RET-2026-0003', [['الكمية', '0', '4']]],
  ['2026-10-05T10:44:00', 'سارة محمود (تجريبية)', 'إنشاء', 'طلب مواد', 'MR-2026-0012', [['الحالة', '—', 'مسودة']]],
  ['2026-10-04T16:00:00', 'ليلى حسن (تجريبية)', 'تعديل', 'صنف', 'ITM-0007', [['الحد الأدنى', '20', '35']]],
  ['2026-10-04T11:19:00', 'منى سمير (تجريبية)', 'اعتماد', 'مستخلص', 'IPC-p1-0001', [['الحالة', 'مقدمة', 'معتمدة']]],
  ['2026-10-03T15:52:00', 'عمر فاروق (تجريبي)', 'دخول', 'حركة مخزنية', 'GIN-2026-0028', [['الكمية', '0', '60']]],
  ['2026-10-03T09:31:00', 'دينا خالد (تجريبية)', 'تعديل', 'مشروع', 'p1', [['الحالة', 'مخططة', 'نشطة']]],
  ['2026-10-02T13:08:00', 'سارة محمود (تجريبية)', 'إنشاء', 'مستند', 'DOC-0028', [['العنوان', '—', 'مخطط الموقع — مراجَعة 2']]],
  ['2026-10-02T10:15:00', 'عمر فاروق (تجريبي)', 'خروج', 'حركة مخزنية', 'GOUT-2026-0016', [['الكمية', '0', '22']]],
  ['2026-10-01T16:44:00', 'ليلى حسن (تجريبية)', 'تعديل', 'دور', 'ROLE-management', [['projects.delete', 'موروث', 'منع']]],
  ['2026-10-01T11:27:00', 'منى سمير (تجريبية)', 'اعتماد', 'طلب مواد', 'MR-2026-0011', [['الحالة', 'مقدمة', 'معتمدة']]],
  ['2026-09-30T14:12:00', 'عمر فاروق (تجريبي)', 'تسوية', 'حركة مخزنية', 'ADJ-2026-0002', [['الكمية', '0', '3']]],
  ['2026-09-30T09:50:00', 'سارة محمود (تجريبية)', 'تعديل', 'بند مقايسة', 'BQ-p2-05-01', [['الكمية', '4800', '5000']]],
  ['2026-09-29T15:36:00', 'دينا خالد (تجريبية)', 'إنشاء', 'مشروع', 'p4', [['الحالة', '—', 'مخططة']]],
  ['2026-09-29T10:03:00', 'عمر فاروق (تجريبي)', 'دخول', 'حركة مخزنية', 'GIN-2026-0026', [['الكمية', '0', '45']]],
  ['2026-09-28T13:58:00', 'منى سمير (تجريبية)', 'رفض', 'مستخلص', 'IPC-p2-0002', [['الحالة', 'مقدمة', 'مرفوضة']]],
  ['2026-09-28T09:41:00', 'ليلى حسن (تجريبية)', 'تعديل', 'مستند', 'DOC-0025', [['الحالة', 'مسودة', 'معتمدة']]],
];
export const auditLog: Audit[] = AUDIT_SEED.map(([at, user, action, entity, entityId, diff], i) => ({
  id: `a${i + 1}`, at, user, action, entity, entityId,
  diff: diff?.map(([field, from, to]) => ({ field, from, to })),
}));
export const backups = [
  { name: 'نسخة تجريبية 2026-10-08', scope: 'كاملة', createdAt: '2026-10-08' },
  { name: 'نسخة تجريبية 2026-10-01', scope: 'كاملة', createdAt: '2026-10-01' },
];
export const imports = [
  { file: 'أصناف-تجريبي.xlsx', entity: 'الأصناف', by: 'مشرف تجريبي', at: '2026-10-07', ok: 48, failed: 2 },
  { file: 'مخازن-تجريبي.xlsx', entity: 'المخازن', by: 'مشرف تجريبي', at: '2026-10-03', ok: 12, failed: 0 },
];
/* REMOVED: the old `financials` array held hard-coded contract / executed /
   deductions figures that no audited endpoint produced. Financial views now
   derive everything from `boqItems` + `ipcs` + `ipcLines`, and show an explicit
   "not available" state for anything the data model cannot supply (contract
   value, tax, retention, advance payments) instead of inventing a number. */
export const STATUS_AR: Record<string, string> = {
  draft: 'مسودة', submitted: 'مقدمة', 'under-review': 'قيد المراجعة', approved: 'معتمدة', rejected: 'مرفوضة',
  'partially-issued': 'صرف جزئي', issued: 'تم الصرف', closed: 'مغلقة', archived: 'مؤرشفة', superseded: 'مُستبدلة',
  planned: 'مخطط', active: 'نشط', 'on-hold': 'متوقف', completed: 'منجز', cancelled: 'ملغي',
  IN: 'إدخال', OUT: 'صرف', TRANSFER: 'تحويل', ADJUSTMENT: 'تسوية', RETURN: 'مرتجع', central: 'مركزي', site: 'موقع',
};
export const STATUS_TONE: Record<string, 'gray' | 'blue' | 'amber' | 'green' | 'red'> = {
  draft: 'gray', planned: 'gray', archived: 'gray', closed: 'gray', superseded: 'gray',
  submitted: 'blue', issued: 'blue', active: 'green', approved: 'green',
  'under-review': 'amber', 'partially-issued': 'amber', 'on-hold': 'amber',
  rejected: 'red', cancelled: 'red',
};

/* ---------- Mock user administration (prototype-only extension) ----------
   EVIDENCE NOTE: the audited backend User model carries username, fullName,
   roleName and isActive only. There is NO audited department / jobTitle /
   email field and NO canonical dept/title catalog anywhere in the inspected
   backend or frontend evidence. The fields below (email, dept, title) are a
   PROTOTYPE-ONLY mock extension required by the Phase 3.3 task, explicitly
   labeled as such; production adoption needs a separate owner/backend decision.
   Roles, permission keys and override semantics below mirror the audited
   backend evidence exactly (packages/shared/src/permissions.ts ROLE_PERMISSIONS
   + MANAGED_PERMISSIONS = ALL_PERMISSIONS + roles.manage/projects.access/
   users.resetPassword; DENY-beats-GRANT precedence). */
export type AccessLevel = 'NONE' | 'READ' | 'WRITE' | 'DELETE';
export type OverrideEffect = 'GRANT' | 'DENY';
export interface MockUser {
  id: string; name: string; email: string;
  dept: string; title: string; // prototype-only extension, see note above
  role: 'admin' | 'management' | 'warehouse' | 'technical' | 'viewer';
  active: boolean;
  overrides: Partial<Record<string, OverrideEffect>>;
  access: Partial<Record<string, AccessLevel>>;
}
export const ROLE_BASE: Record<MockUser['role'], string[]> = {
  admin: ['archive.view', 'archive.upload', 'archive.edit', 'archive.delete', 'archive.download', 'warehouse.view', 'warehouse.create', 'warehouse.edit', 'warehouse.delete', 'warehouse.stock_in', 'warehouse.stock_out', 'warehouse.transfer', 'warehouse.adjust', 'warehouse.return', 'projects.view', 'projects.create', 'projects.edit', 'projects.delete', 'materialRequests.view', 'materialRequests.create', 'materialRequests.approve', 'materialRequests.issue', 'reports.view', 'audit.view', 'settings.manage', 'users.manage', 'backup.manage'],
  management: ['archive.view', 'archive.download', 'warehouse.view', 'projects.view', 'projects.create', 'projects.edit', 'materialRequests.view', 'materialRequests.approve', 'reports.view', 'audit.view'],
  warehouse: ['archive.view', 'archive.download', 'warehouse.view', 'warehouse.create', 'warehouse.edit', 'warehouse.stock_in', 'warehouse.stock_out', 'warehouse.transfer', 'warehouse.adjust', 'warehouse.return', 'projects.view', 'materialRequests.view', 'materialRequests.issue'],
  technical: ['archive.view', 'archive.upload', 'archive.edit', 'archive.download', 'projects.view', 'warehouse.view', 'materialRequests.view', 'materialRequests.create'],
  viewer: ['archive.view', 'archive.download', 'warehouse.view', 'projects.view', 'materialRequests.view'],
};
export const MANAGED_GROUPS: { group: string; keys: string[] }[] = [
  { group: 'الأرشيف', keys: ['archive.view', 'archive.upload', 'archive.edit', 'archive.delete', 'archive.download'] },
  { group: 'المخازن', keys: ['warehouse.view', 'warehouse.create', 'warehouse.edit', 'warehouse.delete'] },
  { group: 'عمليات المخزون', keys: ['warehouse.stock_in', 'warehouse.stock_out', 'warehouse.transfer', 'warehouse.adjust', 'warehouse.return'] },
  { group: 'المشاريع', keys: ['projects.view', 'projects.create', 'projects.edit', 'projects.delete'] },
  { group: 'طلبات المواد', keys: ['materialRequests.view', 'materialRequests.create', 'materialRequests.approve', 'materialRequests.issue'] },
  { group: 'التقارير والتدقيق', keys: ['reports.view', 'audit.view'] },
  { group: 'النظام', keys: ['settings.manage', 'backup.manage'] },
  { group: 'الإدارة', keys: ['users.manage', 'users.resetPassword', 'roles.manage', 'projects.access'] },
];
export const ROLE_AR5: Record<MockUser['role'], string> = {
  admin: 'مدير النظام', management: 'إدارة', warehouse: 'مخازن', technical: 'فني', viewer: 'مشاهدة',
};
export const mockUsers: MockUser[] = [
  { id: 'mu-1', name: 'ليلى حسن (تجريبية)', email: 'layla.hassan@example.org', dept: 'الإدارة', title: 'مديرة العمليات', role: 'admin', active: true, overrides: {}, access: { p1: 'DELETE', p2: 'WRITE', p3: 'READ', p4: 'READ' } },
  { id: 'mu-2', name: 'عمر فاروق (تجريبي)', email: 'omar.farouk@example.org', dept: 'المخازن', title: 'أمين مخزن', role: 'warehouse', active: true, overrides: { 'warehouse.edit': 'DENY', 'reports.view': 'GRANT' }, access: { p1: 'READ' } },
  { id: 'mu-3', name: 'سارة محمود (تجريبية)', email: 'sara.mahmoud@example.org', dept: 'المكتب الفني', title: 'مهندسة موقع', role: 'technical', active: true, overrides: {}, access: { p1: 'WRITE', p2: 'READ' } },
  { id: 'mu-4', name: 'كريم عادل (تجريبي)', email: 'karim.adel@example.org', dept: 'المشتريات', title: 'مشاهد', role: 'viewer', active: true, overrides: {}, access: {} },
  { id: 'mu-5', name: 'منى سمير (تجريبية)', email: 'mona.samir@example.org', dept: 'المالية', title: 'محاسبة', role: 'management', active: true, overrides: {}, access: { p1: 'READ', p2: 'READ', p3: 'READ' } },
  { id: 'mu-6', name: 'طارق نبيل (تجريبي)', email: 'tarek.nabil@example.org', dept: 'المخازن', title: 'عامل مخزن', role: 'warehouse', active: false, overrides: {}, access: {} },
  { id: 'mu-7', name: 'دينا خالد (تجريبية)', email: 'dina.khaled@example.org', dept: 'الإدارة', title: 'مديرة مشاريع', role: 'management', active: true, overrides: {}, access: { p1: 'WRITE' } },
];
