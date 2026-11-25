import { auditLog, boqItems, documents, ipcLines, ipcs, items, mockUsers, notifications, projects, requests, sites, transactions, warehouses, ROLE_BASE, MANAGED_GROUPS, STATUS_AR, signedQty, TX_PERMISSION, TX_PREFIX } from './data';
import type { AccessLevel, BoqItem, Doc, Ipc, IpcLine, IpcStatus, MockUser, MR, MRLine, OverrideEffect, Project, Txn, TxnLine, TxnType } from './data';

import { API_MODE } from '../../configuration';

// ISOLATION GUARD (master plan §Phase-3; Phase 13 contract): this mock adapter
// must never RUN in production. A production build must never execute the
// fixture transport — prod + fixture mode throws here; prod + http mode
// imports cleanly (the facade only *selects* the fixture when
// VITE_PROTOTYPE=1, see ../../configuration.ts). Import-time, not lazy: a
// bundled prod fixture cannot even start executing.
if (import.meta.env.PROD && API_MODE === 'fixture') {
  throw new Error('[prototype] mock adapter blocked outside the isolated prototype build');
}

const wait = (ms = 220) => new Promise<void>((r) => setTimeout(r, ms));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

// Failure injection (prototype-only, OFF by default). Named one-shot forced
// errors for mock operations, driven by tests through window.__protoTestHooks
// (exposed below only for prototype builds). Armed flags also persist in
// sessionStorage so they survive the reload that usually triggers the fetch;
// consumption removes them. No network, no storage, no UI.
const failures = new Map<string, string>();
const SS_KEY = (op: string) => `__protoFail:${op}`;
const maybeFail = async (op: string) => {
  let msg = failures.get(op);
  if (msg === undefined && typeof window !== 'undefined') {
    try {
      msg = window.sessionStorage.getItem(SS_KEY(op)) ?? undefined;
      if (msg !== undefined) window.sessionStorage.removeItem(SS_KEY(op));
    } catch { /* storage unavailable */ }
  }
  if (msg !== undefined) {
    failures.delete(op);
    await wait(120);
    throw new Error(msg);
  }
};
export const __protoFail = {
  failNext(op: string, message = 'تعذّر التحميل (فشل تجريبي مُحقن).') {
    failures.set(op, message);
    try { window.sessionStorage.setItem(SS_KEY(op), message); } catch { /* storage unavailable */ }
  },
  clear() {
    failures.clear();
    try {
      Object.keys(window.sessionStorage).filter((k) => k.startsWith('__protoFail:')).forEach((k) => window.sessionStorage.removeItem(k));
    } catch { /* storage unavailable */ }
  },
};

// In-memory working copies (reset on reload). Mutations below are demo-only.
const db = {
  docs: clone(documents),
  mrs: clone(requests),
  txns: clone(transactions),
  notifs: clone(notifications),
  audits: clone(auditLog),
  boq: clone(boqItems),
  ipcs: clone(ipcs),
  ipcLines: clone(ipcLines),
};

export const mockApi = {
  async projects() { await wait(); return clone(projects); },
  async project(id: string, actorId?: string) {
    await maybeFail('project');
    const found = projects.find((p) => p.id === id);
    await wait();
    if (!found) return undefined;
    // Project scoping (boq/ipc/warehouses routes all gate on
    // `can(ctx, 'projects.view', projectId)`): a deep link to a project the
    // identity cannot read must resolve to nothing, exactly like a 404.
    // Omitting actorId keeps the pre-scoping behaviour for callers that do not
    // carry an identity (e.g. the Phase 3.2 load-state regression).
    if (actorId && !canProject(actorId, 'projects.view', id)) return undefined;
    return clone(found);
  },
  async sites(projectId?: string) { await wait(120); return clone(sites.filter((s) => !projectId || s.projectId === projectId)); },
  async addSite(s: { projectId: string; code: string; name: string; location: string }) {
    await wait(); db && sites.push({ id: `s-mock-${Date.now()}`, ...s });
    return { ok: true as const };
  },
  async documents(filter: { q?: string; status?: string } = {}, actorId?: string) {
    await maybeFail('documents');
    await wait();
    // Project scope is applied BEFORE the text filter, using the audited rule:
    // a document with no project stays visible, a project document needs
    // membership. The page must never offer a search that can reach past it.
    const scoped = scopeRow(db.docs, (d) => d.projectId, actorId);
    return clone(scoped.filter((d) =>
      (!filter.q || (d.title + d.number + (d.tags ?? []).join(' ')).includes(filter.q)) &&
      (!filter.status || d.status === filter.status)));
  },
  /** Phase 7: optional metadata mirrors POST /upload's documentSchema fields
      (documentNumber / category / documentType / notes / tags). The backend
      REQUIRES a file and stores it in a category folder — the mock stores
      nothing real, so the file facet stays demo-labeled and the record keeps
      a fixed synthetic fileName. Title-only submission remains the primary
      (test-bound) path; status is always 'draft' like the route. */
  async uploadDoc(title: string, meta?: { number?: string; category?: string; type?: string; tags?: string[]; notes?: string }) {
    await wait(600);
    const d: Doc = { id: `d-mock-${Date.now()}`, title, number: meta?.number?.trim() || 'DOC-MOCK', category: meta?.category?.trim() || 'أخرى', type: meta?.type?.trim() || 'PDF', fileName: 'mock.pdf', ext: 'pdf', revision: '00', status: 'draft', tags: meta?.tags?.length ? meta.tags : ['تجريبي'], updatedAt: '2026-10-11', revisions: [], links: [], notes: meta?.notes?.trim() || undefined };
    db.docs.unshift(d);
    return { ok: true as const, id: d.id };
  },
  async setDocStatus(id: string, status: Doc['status']) {
    await wait(200);
    const d = db.docs.find((x) => x.id === id);
    // Mirrors audited backend: the status endpoint accepts any schema-valid
    // status (no transition matrix enforced server-side). Prototype therefore
    // permits all 7 values; see report assumptions.
    if (!d) return { ok: false as const };
    d.status = status;
    return { ok: true as const };
  },
  /** Phase 7: mirrors PUT /documents/:id (documents.routes.ts).
      · route gate = the GLOBAL `archive.edit`; the project-scoped check
        applies ONLY to a cross-project move, against the DESTINATION —
        the route never requires membership in the current project.
      · documentSchema.partial(): title/category min(1), the rest optional.
        The mock Doc's `number` mirrors the backend `documentNumber`.
      · error literals follow this file's Arabic convention; `errText` +
        errorKeys.ts render them in the selected language. */
  async updateDoc(id: string, actorId: string | undefined, patch: { title?: string; number?: string; category?: string; type?: string; tags?: string[]; notes?: string; projectId?: string }) {
    await wait(250);
    const d = db.docs.find((x) => x.id === id);
    if (!d) return { ok: false as const, error: 'مستند غير صالح (تجريبي).' };
    if (!actorId || !allowedFor(actorId, 'archive.edit')) return { ok: false as const, error: 'ليس لديك صلاحية: archive.edit' };
    // Cross-project move: audited route checks `archive.edit` on the NEW
    // project only (403 otherwise). canProject re-checks the global grant and
    // enforces the scoped minimum (WRITE) via the extended SCOPED_MIN.
    const target = patch.projectId ?? d.projectId;
    if (target && target !== d.projectId && !canProject(actorId, 'archive.edit', target))
      return { ok: false as const, error: 'ليس لديك صلاحية: archive.edit' };
    const title = (patch.title ?? d.title).trim();
    const category = (patch.category ?? d.category).trim();
    if (!title) return { ok: false as const, error: 'عنوان المستند مطلوب' };
    if (!category) return { ok: false as const, error: 'تصنيف المستند مطلوب' };
    d.title = title;
    d.category = category;
    if (patch.number !== undefined) d.number = patch.number.trim() || 'DOC-MOCK';
    if (patch.type !== undefined) d.type = patch.type.trim() || d.type;
    if (patch.tags !== undefined) d.tags = patch.tags;
    if (patch.notes !== undefined) d.notes = patch.notes.trim() || undefined;
    if (patch.projectId) d.projectId = patch.projectId;
    return { ok: true as const };
  },
  /** Phase 7: mirrors DELETE /documents/:id. Route gate is `archive.delete`;
      the DELETE-safety branch (admin bypasses block, non-admin → 409) is
      unreachable in the mock because only the admin identity holds this
      permission — recorded as a limitation. In-memory removal ONLY. */
  async deleteDoc(id: string, actorId: string | undefined) {
    await wait(250);
    if (!actorId || !allowedFor(actorId, 'archive.delete'))
      return { ok: false as const, error: 'ليس لديك صلاحية: archive.delete' };
    const before = db.docs.length;
    db.docs = db.docs.filter((x) => x.id !== id);
    return { ok: true as const, removed: before > db.docs.length };
  },
  async addRevision(id: string, fileName: string, notes?: string) {
    await wait(300);
    const d = db.docs.find((x) => x.id === id);
    if (!d || !fileName.trim()) return { ok: false as const };
    // Phase 7: audited label rule (documents.routes.ts `nextRevisionLabel`) is
    // String(count).padStart(2,'0') over the CURRENT history length — no +1.
    // For a document whose seeded history already matches its counter this
    // DUPLICATES the last label (d1 → '03'); kept backend-faithful on purpose,
    // not smoothed over (see Phase 7 report limitations).
    const label = String(d.revisions.length).padStart(2, '0');
    d.revisions.push({ id: `r-mock-${Date.now()}`, revision: label, fileName: fileName.trim(), by: 'مستخدم تجريبي', at: '2026-10-11', notes: notes?.trim() || undefined });
    d.revision = label;
    // Verified backend rule (same sentence as replaceDoc, route revision POST):
    // a new revision downgrades approved → submitted.
    if (d.status === 'approved') d.status = 'submitted';
    return { ok: true as const, revision: label, status: d.status };
  },
  async replaceDoc(id: string, fileName: string) {
    await wait(400);
    const d = db.docs.find((x) => x.id === id);
    if (!d || !fileName.trim()) return { ok: false as const };
    // Snapshot current version into history (never silently dropped)...
    d.revisions.push({ id: `r-mock-${Date.now()}`, revision: d.revision, fileName: d.fileName, by: 'مستخدم تجريبي', at: '2026-10-11' });
    // ...then advance the counter from the previous label (v00 -> v01), so a
    // document whose seeded history is longer than its counter still increments
    // predictably instead of jumping to the history length.
    const label = String((Number.parseInt(d.revision, 10) || 0) + 1).padStart(2, '0');
    d.fileName = fileName.trim();
    d.ext = (fileName.split('.').pop() ?? '').toLowerCase();
    d.revision = label;
    // Verified backend rule: a new revision downgrades approved → submitted.
    if (d.status === 'approved') d.status = 'submitted';
    return { ok: true as const, revision: label, status: d.status };
  },
  async addLink(id: string, targetId: string): Promise<{ ok: true } | { ok: false; error: string }> {
    await wait(200);
    const d = db.docs.find((x) => x.id === id);
    const t = db.docs.find((x) => x.id === targetId);
    if (!d || !t) return { ok: false, error: 'مستند غير صالح (تجريبي).' };
    if (id === targetId) return { ok: false, error: 'لا يمكن ربط المستند بنفسه.' };
    if (d.links.includes(targetId)) return { ok: false, error: 'هذه العلاقة موجودة بالفعل.' };
    d.links.push(targetId);
    return { ok: true };
  },
  async removeLink(id: string, targetId: string) {
    await wait(200);
    const d = db.docs.find((x) => x.id === id);
    if (d) d.links = d.links.filter((x) => x !== targetId);
    return { ok: true as const };
  },
  async addDocs(rows: { title: string; number: string; category: string; type: string; status: Doc['status'] }[]) {
    await wait(400);
    for (const r of rows)
      db.docs.unshift({ id: `d-mock-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, title: r.title, number: r.number || 'DOC-MOCK', category: r.category || 'أخرى', type: r.type || 'PDF', fileName: `${r.title.slice(0, 12)}.pdf`, ext: 'pdf', revision: '00', status: r.status, tags: ['مستورد-تجريبي'], updatedAt: '2026-10-11', revisions: [], links: [] });
    return { ok: true as const, added: rows.length };
  },
  async warehouses(actorId?: string) {
      await wait(120);
      return clone(scopeRow(warehouses, (w) => w.projectId, actorId));
    },
  async items() { await wait(120); return clone(items); },
  async overview(actorId?: string) { await maybeFail('overview'); await wait(); return stockApi.overview(actorId); },
  async MRs(actorId?: string) { await maybeFail('mrs'); await wait(); return mrApi.list({}, actorId).items; },
  async notifications() { await wait(120); return clone(db.notifs); },
  async readNotif(id?: string) {
    await wait(80);
    db.notifs = db.notifs.map((n) => (id && n.id !== id ? n : { ...n, read: true }));
    return { ok: true as const };
  },
  async audit() { await wait(120); return clone(db.audits); },
  resetHint() { return 'أعد تحميل الصفحة لاستعادة البيانات الوهمية الأولية.'; },
};

export const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? id;
export const whName = (id: string) => warehouses.find((w) => w.id === id)?.name ?? id;
export const projName = (id?: string) => projects.find((p) => p.id === id)?.name ?? '—';

/* ===================================================================
   Inventory + Material Requests — mock engine
   Every rule below is transcribed from the audited backend, never invented:
     · stock.validators.ts  → required fields, quantity > 0, lines min 1
     · stock.factory.ts      → existence checks, TRANSFER destination rules,
                               available-stock guard for OUT/TRANSFER, numbering
                               prefixes, low-stock notification, never-stored
                               balances
     · stock.routes.ts      → per-type permission map, filter set, scoping rule
     · material-requests.*  → filter/sort, project-scope guard, transition
                               matrix, approve:false rejection contract, issue
                               prefill + remaining/availability guards
     · stock.service.ts     → signedQty, DeleteSafety (draft-only delete)
   =================================================================== */

const allowedFor = (actorId: string | undefined, permission: string) => {
  if (!actorId) return false; // fail closed: no identity, no write
  return userApi.effective(actorId).allowed[permission] === true;
};
const canRead = (actorId: string | undefined) => allowedFor(actorId, 'warehouse.view');

/** Projects the actor may see; `null` means "all" (holds `projects.access`).
    Resolved against the LIVE mock user store, so a Phase 3.3 admin edit to a
    user's project membership takes effect on the next list call. */
const visibleProjects = (actorId: string | undefined): Set<string> | null => {
  if (allowedFor(actorId, 'projects.access')) return null;
  const u = users.find((x) => x.id === actorId);
  const set = new Set<string>();
  for (const [pid, level] of Object.entries(u?.access ?? {}))
    if (level && level !== 'NONE') set.add(pid);
  return set;
};

/** Audited scoping rule (filterVisible / checkFilterProject): rows without a
    project stay visible; project rows require membership unless the actor has
    `projects.access`. Filtering by an invisible project is a hard denial. */
const scopeRow = <T,>(rows: T[], projectOf: (r: T) => string | undefined, actorId: string | undefined) => {
  const allowed = visibleProjects(actorId);
  if (!allowed) return rows;
  return rows.filter((r) => {
    const pid = projectOf(r);
    return !pid || allowed.has(pid);
  });
};
const filterProjectDenied = (actorId: string | undefined, projectId: string) => {
  const allowed = visibleProjects(actorId);
  return allowed ? !allowed.has(projectId) : false;
};

/* ---- balances: derived from the ledger, never stored ---- */
const deriveBalances = () => {
  const out: Record<string, Record<string, number>> = {};
  for (const w of warehouses) out[w.id] = {};
  for (const t of db.txns) {
    for (const l of t.lines) {
      out[t.warehouseId][l.itemId] = (out[t.warehouseId][l.itemId] ?? 0) + signedQty(t.type, l.quantity);
      if (t.type === 'TRANSFER' && t.destinationWarehouseId) {
        const d = (out[t.destinationWarehouseId] ??= {});
        d[l.itemId] = (d[l.itemId] ?? 0) + l.quantity;
      }
    }
  }
  return out;
};
/** Audited `stockService.availableQty` for one warehouse (transfers credit the destination). */
const availableQty = (itemId: string, warehouseId: string, ledger: Txn[] = db.txns) => {
  let qty = 0;
  for (const t of ledger) for (const l of t.lines) {
    if (l.itemId !== itemId) continue;
    if (t.warehouseId === warehouseId) qty += signedQty(t.type, l.quantity);
    if (t.type === 'TRANSFER' && t.destinationWarehouseId === warehouseId) qty += l.quantity;
  }
  return qty;
};
/** Audited `totalStockPerItem`: company total is transfer-neutral. */
const deriveTotals = (ledger: Txn[] = db.txns) => {
  const totals: Record<string, number> = {};
  for (const t of ledger) for (const l of t.lines) {
    if (t.type === 'TRANSFER' && t.destinationWarehouseId) continue;
    totals[l.itemId] = (totals[l.itemId] ?? 0) + signedQty(t.type, l.quantity);
  }
  return totals;
};
const deriveLowStock = () => {
  const totals = deriveTotals();
  return items
    .filter((i) => typeof i.minimumStock === 'number' && i.minimumStock > 0 && (totals[i.id] ?? 0) < i.minimumStock)
    .map((item) => ({ item, qty: totals[item.id] ?? 0 }));
};
/** Audited numbering (numbering.service.ts + stock.factory PREFIX). */
const nextNumber = (prefix: string, ledger: { number: string }[], pad = 3) => {
  let max = 0;
  for (const r of ledger) {
    if (!r.number.startsWith(`${prefix}-`)) continue;
    const n = Number.parseInt(r.number.slice(prefix.length + 1), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}-${String(max + 1).padStart(pad, '0')}`;
};

export type StockFilter = {
  q?: string; type?: string; projectId?: string; itemId?: string;
  warehouseId?: string; from?: string; to?: string;
  sortBy?: 'number' | 'date' | 'type' | 'item' | 'warehouse' | 'qty';
  sortDir?: 'asc' | 'desc';
};
const txnSortValue = (t: Txn, by: StockFilter['sortBy']) => {
  switch (by) {
    case 'date': return t.date;
    case 'type': return t.type;
    case 'item': return itemName(t.lines[0]?.itemId ?? '');
    case 'warehouse': return whName(t.warehouseId);
    case 'qty': return t.lines.reduce((s, l) => s + Math.abs(l.quantity), 0);
    default: return t.number;
  }
};

export const stockApi = {
  overview(actorId?: string) {
    const balances = deriveBalances();
    return {
      balances: clone(balances),
      lowStock: deriveLowStock(),
      txns: clone(scopeRow(db.txns, (t) => t.projectId ?? warehouses.find((w) => w.id === t.warehouseId)?.projectId, actorId)),
      totals: deriveTotals(),
    };
  },
  /** Mirrors `applyTxFilters` (stock.routes.ts) + the project-scope rule. */
  list(filter: StockFilter, actorId: string | undefined) {
    const q = (filter.q ?? '').toLowerCase();
    let rows = scopeRow(db.txns, (t) => t.projectId ?? warehouses.find((w) => w.id === t.warehouseId)?.projectId, actorId);
    if (filter.projectId) {
      if (filterProjectDenied(actorId, filter.projectId)) return { items: [] as Txn[], total: 0, denied: true as const };
      rows = rows.filter((t) => (t.projectId ?? warehouses.find((w) => w.id === t.warehouseId)?.projectId) === filter.projectId);
    }
    rows = rows.filter((t) =>
      (!q || [t.number, t.type, t.referenceNumber ?? '', t.notes ?? ''].some((v) => v.toLowerCase().includes(q)) ||
        t.lines.some((l) => itemName(l.itemId).toLowerCase().includes(q))) &&
      (!filter.type || t.type === filter.type) &&
      (!filter.itemId || t.lines.some((l) => l.itemId === filter.itemId)) &&
      (!filter.warehouseId || t.warehouseId === filter.warehouseId || t.destinationWarehouseId === filter.warehouseId) &&
      (!filter.from || t.date >= filter.from) &&
      (!filter.to || t.date <= filter.to));
    const dir = filter.sortDir === 'asc' ? 1 : -1;
    const by = filter.sortBy ?? 'date';
    rows = [...rows].sort((a, b) => String(txnSortValue(a, by)).localeCompare(String(txnSortValue(b, by)), 'ar') * dir);
    return { items: clone(rows), total: rows.length, denied: false as const };
  },
  available: (itemId: string, warehouseId: string) => availableQty(itemId, warehouseId),
  types: () => Object.keys(TX_PERMISSION) as TxnType[],
  /** Transcribed from `createStockTransactionInternal`. Returns explicit,
      fixable validation errors instead of throwing, and only mutates after
      every guard has passed. */
  async create(input: { type: TxnType; warehouseId: string; destinationWarehouseId?: string; projectId?: string; referenceNumber?: string; date: string; notes?: string; lines: TxnLine[] }, actorId: string) {
    await wait(420);
    const need = TX_PERMISSION[input.type];
    if (!allowedFor(actorId, need)) return { ok: false as const, code: 403, error: `ليس لديك صلاحية: ${need}` };
    if (!input.date) return { ok: false as const, code: 400, error: 'التاريخ مطلوب' };
    if (!input.lines.length) return { ok: false as const, code: 400, error: 'أضف صنفًا واحدًا على الأقل' };
    for (const l of input.lines) {
      if (!items.find((i) => i.id === l.itemId)) return { ok: false as const, code: 400, error: `الصنف غير موجود: ${l.itemId}`, errorKey: 'eItemMissingId' as const, errorVars: { id: l.itemId } };
      if (!(typeof l.quantity === 'number') || Number.isNaN(l.quantity)) return { ok: false as const, code: 400, error: 'الكمية مطلوبة' };
      // ADJUSTMENT is the only type allowed to carry a negative quantity.
      if (l.quantity < 0 && input.type !== 'ADJUSTMENT')
        return { ok: false as const, code: 400, error: 'الكمية السالبة مسموحة في التسوية فقط' };
      if (l.quantity === 0) return { ok: false as const, code: 400, error: 'الكمية يجب ألا تكون صفرًا' };
    }
    if (!warehouses.find((w) => w.id === input.warehouseId)) return { ok: false as const, code: 400, error: 'المخزن غير موجود' };
    if (input.type === 'TRANSFER') {
      if (!input.destinationWarehouseId) return { ok: false as const, code: 400, error: 'حدد المخزن الوجهة للتحويل' };
      if (input.destinationWarehouseId === input.warehouseId) return { ok: false as const, code: 400, error: 'لا يمكن التحويل لنفس المخزن' };
      if (!warehouses.find((w) => w.id === input.destinationWarehouseId)) return { ok: false as const, code: 400, error: 'المخزن الوجهة غير موجود' };
    }
    if (input.projectId && !projects.find((p) => p.id === input.projectId))
      return { ok: false as const, code: 400, error: 'المشروع غير موجود' };
    // Never issue into a negative balance (OUT + TRANSFER only).
    if (input.type === 'OUT' || input.type === 'TRANSFER') {
      for (const l of input.lines) {
        const avail = availableQty(l.itemId, input.warehouseId);
        if (avail < l.quantity)
          return { ok: false as const, code: 400, error: `الرصيد غير كافٍ للصنف. المتاح ${avail}، والمطلوب ${l.quantity}`, errorKey: 'eInsufficientBalance' as const, errorVars: { avail, qty: l.quantity }, avail, itemId: l.itemId };
      }
    }
    const created: Txn = {
      id: `t-mock-${Date.now()}`,
      number: nextNumber(TX_PREFIX[input.type], db.txns),
      type: input.type,
      warehouseId: input.warehouseId,
      destinationWarehouseId: input.type === 'TRANSFER' ? input.destinationWarehouseId : undefined,
      projectId: input.projectId || undefined,
      date: input.date,
      referenceNumber: input.referenceNumber || undefined,
      notes: input.notes || undefined,
      createdBy: 'مستخدم تجريبي',
      lines: input.lines.map((l) => ({ ...l })),
    };
    db.txns.unshift(created);
    // low-stock notification after the movement lands (stock.factory.ts)
    const totals = deriveTotals();
    for (const l of created.lines) {
      const it = items.find((i) => i.id === l.itemId);
      if (!it?.minimumStock || (totals[it.id] ?? 0) >= it.minimumStock) continue;
      db.notifs.unshift({
        id: `n-mock-${Date.now()}-${l.itemId}`, type: 'low-stock',
        title: `تنبيه مخزون منخفض: ${it.name}`,
        message: `الرصيد الحالي ${totals[it.id]} وهو أقل من حد الأمان (${it.minimumStock})`,
        link: '/inventory/stock', read: false,
      });
    }
    return { ok: true as const, txn: clone(created) };
  },
};

/** Audited MR status union, in lifecycle order (material-requests.routes.ts). */
export const MR_STATUSES: MR['status'][] = ['draft', 'submitted', 'approved', 'rejected', 'partially-issued', 'issued', 'closed'];
export type MRAction = 'submit' | 'approve' | 'reject' | 'close';

/** Read-only lookups used by the inventory pickers. Warehouses are returned
    for any identity that can view stock (mirrors `warehouse.view` scoping in
    warehouses.routes.ts); items likewise. */
export const lookups = {
  warehouses: (actorId?: string) => (canRead(actorId) ? clone(warehouses) : []),
  items: (actorId?: string) => (canRead(actorId) ? clone(items) : []),
};

/* ===================================================================
   BOQ + IPC — mock engine (Phase 3.6)
   Rules transcribed from apps/api/src/modules/projects/{boq,ipc}.routes.ts and
   services/authorization.service.ts. Nothing here is invented:
     · BOQ zod schema (itemCode/description/unit min 1, quantity/unitPrice ≥ 0)
     · POST needs projects.edit OR projects.create; PUT/DELETE need projects.edit
     · an item belonging to another project is "not found" (404), never editable
     · DeleteSafety.blockBoqItem: a BOQ line referenced by any IPC cannot be
       deleted (409)
     · IPC zod schema (ipcNumber ≥ 1, parsable date, status enum, deductions,
       grossAmount ≥ 0, items[].currentQuantity ≥ 0)
     · ipcNumber unique per project (409)
     · every IPC line must reference a BOQ item of the SAME project, and the
       cumulative quantity (earlier IPCs + current) may never exceed the BOQ
       quantity — checked BEFORE any write, so nothing partial is created
     · netAmount = Σ(currentQuantity × boq.unitPrice) when lines exist,
       otherwise max(0, grossAmount − deductions)
     · previousQuantity = Σ of lines in strictly lower ipcNumbers
     · IPC_TRANSITIONS: no backward moves; approved/rejected are terminal
     · DeleteSafety.blockIpc: only drafts may be deleted
   Nothing about taxes, retention, advances or contract values is invented —
   those inputs simply do not exist in the audited model.
   =================================================================== */

/** Audited project-scoped rule (authorization.service.ts `can`): the global
    permission must hold (DENY still beats GRANT), then the membership level
    for THAT project must meet the key's minimum. `projects.access` holders
    skip the narrowing. */
const SCOPED_MIN: Record<string, AccessLevel> = {
  'projects.view': 'READ', 'projects.edit': 'WRITE', 'projects.create': 'WRITE', 'projects.delete': 'DELETE',
  // Phase 7: minimums transcribed from authorization.service.ts SOURCE/SCOPED
  // values (-), so canProject answers archive.* scoped questions correctly.
  // Behavior-neutral: every existing caller passes projects.* keys only.
  'archive.view': 'READ', 'archive.download': 'READ',
  'archive.upload': 'WRITE', 'archive.edit': 'WRITE',
  'archive.delete': 'DELETE',
};
const RANK: Record<AccessLevel, number> = { NONE: 0, READ: 1, WRITE: 2, DELETE: 3 };
export const canProject = (actorId: string | undefined, key: string, projectId: string) => {
  if (!allowedFor(actorId, key)) return false;
  if (allowedFor(actorId, 'projects.access')) return true;
  const min = SCOPED_MIN[key];
  if (!min) return true;
  const u = users.find((x) => x.id === actorId);
  const level = u?.access?.[projectId] ?? 'NONE';
  return RANK[level] >= RANK[min];
};
/** `projects.edit` OR `projects.create` — the audited BOQ/IPC create gate. */
const canWriteProject = (actorId: string | undefined, projectId: string) =>
  canProject(actorId, 'projects.edit', projectId) || canProject(actorId, 'projects.create', projectId);

const EPS = 1e-9;
export const boqTotal = (b: BoqItem) => b.quantity * b.unitPrice;

const boqOf = (projectId: string) => db.boq.filter((b) => b.projectId === projectId);
/** Cumulative quantity of a BOQ item across all IPCs strictly BEFORE `ipcNumber`. */
const pastQtyOf = (projectId: string, boqItemId: string, ipcNumber: number) => {
  const earlier = db.ipcs.filter((i) => i.projectId === projectId && i.ipcNumber < ipcNumber).map((i) => i.id);
  return db.ipcLines.filter((l) => earlier.includes(l.ipcId) && l.boqItemId === boqItemId)
    .reduce((s, l) => s + l.currentQuantity, 0);
};
/** Audited `checkIpcLines`: returns a reason, or null when valid.
    `error` stays the original Arabic contract string (the 3.6 suite asserts on
    it); `errorKey`/`errorVars` let the UI show it in the selected language. */
const checkIpcLines = (projectId: string, lines: { boqItemId: string; currentQuantity: number }[], ipcNumber: number): { error: string; errorKey: 'eIpcLineProject' | 'eIpcLineCap'; errorVars?: Record<string, string | number> } | null => {
  const map = new Map(boqOf(projectId).map((b) => [b.id, b]));
  for (const l of lines) {
    const boq = map.get(l.boqItemId);
    if (!boq) return { error: 'أحد البنود لا ينتمي لمشروع المستخلص', errorKey: 'eIpcLineProject' };
    if (pastQtyOf(projectId, l.boqItemId, ipcNumber) + l.currentQuantity > boq.quantity + EPS)
      return {
        error: `الكمية التراكمية للبند ${boq.itemCode} تتجاوز كمية المقايسة (${boq.quantity})`,
        errorKey: 'eIpcLineCap',
        errorVars: { code: boq.itemCode, qty: boq.quantity },
      };
  }
  return null;
};
const netOf = (projectId: string, lines: { boqItemId: string; currentQuantity: number }[], gross?: number, deductions?: number) => {
  if (lines.length) {
    const map = new Map(boqOf(projectId).map((b) => [b.id, b]));
    return lines.reduce((s, l) => s + l.currentQuantity * (map.get(l.boqItemId)?.unitPrice ?? 0), 0);
  }
  return Math.max(0, (gross ?? 0) - (deductions ?? 0));
};

export const boqApi = {
  /** Audited GET: empty array on denial (the route returns [], not 403). */
  list: (projectId: string, actorId?: string): BoqItem[] => {
    if (!canProject(actorId, 'projects.view', projectId)) return [];
    return clone(boqOf(projectId).sort((a, b) => a.itemCode.localeCompare(b.itemCode, undefined, { numeric: true })));
  },
  total: (projectId: string) => boqOf(projectId).reduce((s, b) => s + boqTotal(b), 0),
  /** Derived only — the audited model never stores totalPrice/totalQuantity. */
  progress: (projectId: string) => boqOf(projectId).map((b) => ({
    ...b,
    totalPrice: boqTotal(b),
    executedQty: db.ipcLines.filter((l) => l.boqItemId === b.id).reduce((s, l) => s + l.currentQuantity, 0),
  })),
  async create(projectId: string, input: { itemCode: string; description: string; unit: string; quantity: number; unitPrice: number }, actorId: string) {
    await wait(400);
    if (!canWriteProject(actorId, projectId)) return { ok: false as const, code: 403, error: 'ليس لديك صلاحية إنشاء بنود المقايسة في هذا المشروع' };
    if (!projects.find((p) => p.id === projectId)) return { ok: false as const, code: 404, error: 'المشروع غير موجود' };
    const bad = validateBoq(input);
    if (bad) return { ok: false as const, code: 400, error: bad };
    const created: BoqItem = { id: `bq-mock-${Date.now()}`, projectId, ...input };
    db.boq.push(created);
    return { ok: true as const, item: clone(created) };
  },
  async update(projectId: string, id: string, input: { itemCode: string; description: string; unit: string; quantity: number; unitPrice: number }, actorId: string) {
    await wait(400);
    if (!canProject(actorId, 'projects.edit', projectId)) return { ok: false as const, code: 403, error: 'ليس لديك صلاحية تعديل بنود المقايسة في هذا المشروع' };
    const existing = db.boq.find((b) => b.id === id);
    // another project's item is "not found" here, never editable
    if (!existing || existing.projectId !== projectId) return { ok: false as const, code: 404, error: 'البند غير موجود' };
    const bad = validateBoq(input);
    if (bad) return { ok: false as const, code: 400, error: bad };
    Object.assign(existing, input);
    return { ok: true as const, item: clone(existing) };
  },
  async remove(projectId: string, id: string, actorId: string) {
    await wait(300);
    if (!canProject(actorId, 'projects.edit', projectId)) return { ok: false as const, code: 403, error: 'ليس لديك صلاحية حذف بنود المقايسة في هذا المشروع' };
    const existing = db.boq.find((b) => b.id === id);
    if (!existing || existing.projectId !== projectId) return { ok: false as const, code: 404, error: 'البند غير موجود' };
    // DeleteSafety.blockBoqItem — historical IPC lines block deletion.
    if (db.ipcLines.some((l) => l.boqItemId === id))
      return { ok: false as const, code: 409 as const, error: 'لا يمكن حذف البند لوجود مستخلصات مرتبطة به.' };
    db.boq = db.boq.filter((b) => b.id !== id);
    return { ok: true as const };
  },
};
const validateBoq = (i: { itemCode: string; description: string; unit: string; quantity: number; unitPrice: number }) => {
  if (!i.itemCode?.trim()) return 'رقم البند مطلوب';
  if (!i.description?.trim()) return 'وصف البند مطلوب';
  if (!i.unit?.trim()) return 'الوحدة مطلوبة';
  if (!Number.isFinite(i.quantity) || i.quantity < 0) return 'الكمية يجب أن تكون أكبر من أو تساوي 0';
  if (!Number.isFinite(i.unitPrice) || i.unitPrice < 0) return 'الفئة يجب أن تكون أكبر من أو تساوي 0';
  return null;
};

export const ipcApi = {
  list: (projectId: string, actorId?: string) => {
    if (!canProject(actorId, 'projects.view', projectId)) return [];
    return clone(db.ipcs.filter((i) => i.projectId === projectId).sort((a, b) => a.ipcNumber - b.ipcNumber));
  },
  lines: (ipcId: string) => clone(db.ipcLines.filter((l) => l.ipcId === ipcId)),
  /** Allowance still open per BOQ item for the certificate currently being
      written = BOQ quantity − everything already executed in LOWER ipcNumbers.
      Same arithmetic the create/update guard uses, exposed so the form can warn
      before submitting instead of after. */
  remaining(projectId: string, ipcNumber: number): Record<string, number> {
    const out: Record<string, number> = {};
    for (const b of boqOf(projectId)) out[b.id] = b.quantity - pastQtyOf(projectId, b.id, ipcNumber);
    return out;
  },
  /** Audited GET /:id — a denial hides existence behind a 404. */
  get: (projectId: string, id: string, actorId?: string) => {
    const ipc = db.ipcs.find((i) => i.id === id);
    if (!ipc || ipc.projectId !== projectId) return undefined;
    if (!canProject(actorId, 'projects.view', projectId)) return undefined;
    return { ...clone(ipc), items: clone(db.ipcLines.filter((l) => l.ipcId === id)) };
  },
  /** Audited IPC_TRANSITIONS — conservative, no backward moves, terminals stay. */
  transitions: (status: IpcStatus): IpcStatus[] =>
    (({ draft: ['draft', 'submitted'], submitted: ['submitted', 'approved', 'rejected'], approved: ['approved'], rejected: ['rejected'] }) as Record<IpcStatus, IpcStatus[]>)[status],
  summary(projectId: string) {
    const list = db.ipcs.filter((i) => i.projectId === projectId);
    const approved = list.filter((i) => i.status === 'approved');
    return {
      boqTotal: boqOf(projectId).reduce((s, b) => s + boqTotal(b), 0),
      executed: approved.reduce((s, i) => s + (i.netAmount ?? 0), 0),
      deductions: approved.reduce((s, i) => s + (i.deductions ?? 0), 0),
      approvedCount: approved.length,
      submittedCount: list.filter((i) => i.status === 'submitted').length,
      count: list.length,
    };
  },
  async create(projectId: string, input: { ipcNumber: number; date: string; status: IpcStatus; notes?: string; deductions?: number; grossAmount?: number; lines?: { boqItemId: string; currentQuantity: number }[] }, actorId: string) {
    await wait(480);
    if (!canWriteProject(actorId, projectId)) return { ok: false as const, code: 403, error: 'ليس لديك صلاحية إنشاء المستخلصات في هذا المشروع' };
    if (!projects.find((p) => p.id === projectId)) return { ok: false as const, code: 404, error: 'المشروع غير موجود' };
    const bad = validateIpc(input);
    if (bad) return { ok: false as const, code: 400, error: bad };
    if (db.ipcs.some((i) => i.projectId === projectId && i.ipcNumber === input.ipcNumber))
      return { ok: false as const, code: 409 as const, error: 'رقم المستخلص مستخدم بالفعل في هذا المشروع' };
    const lines = input.lines ?? [];
    // Validate BEFORE anything is written — never a partially-created IPC.
    const lineErr = lines.length ? checkIpcLines(projectId, lines, input.ipcNumber) : null;
    if (lineErr) return { ok: false as const, code: 400, error: lineErr.error, errorKey: lineErr.errorKey, errorVars: lineErr.errorVars };
    const created: Ipc = {
      id: `ipc-mock-${Date.now()}`, projectId,
      ipcNumber: input.ipcNumber, date: input.date, status: input.status,
      notes: input.notes, deductions: input.deductions, grossAmount: input.grossAmount,
    };
    const netAmount = netOf(projectId, lines, input.grossAmount, input.deductions);
    created.netAmount = netAmount;
    db.ipcs.push(created);
    for (const l of lines) {
      db.ipcLines.push({
        id: `il-mock-${Date.now()}-${l.boqItemId}`,
        ipcId: created.id, boqItemId: l.boqItemId,
        previousQuantity: pastQtyOf(projectId, l.boqItemId, input.ipcNumber),
        currentQuantity: l.currentQuantity,
      });
    }
    return { ok: true as const, ipc: clone(created), items: clone(db.ipcLines.filter((l) => l.ipcId === created.id)) };
  },
  /** Status changes go through the audited PUT + transition matrix — there is
      no separate approve/reject endpoint in the contract. */
  async update(projectId: string, id: string, input: { ipcNumber: number; date: string; status: IpcStatus; notes?: string; deductions?: number; grossAmount?: number; lines?: { boqItemId: string; currentQuantity: number }[] }, actorId: string) {
    await wait(480);
    if (!canProject(actorId, 'projects.edit', projectId)) return { ok: false as const, code: 403, error: 'ليس لديك صلاحية تعديل المستخلصات في هذا المشروع' };
    const existing = db.ipcs.find((i) => i.id === id);
    if (!existing || existing.projectId !== projectId) return { ok: false as const, code: 404, error: 'المستخلص غير موجود' };
    const allowed = ipcApi.transitions(existing.status);
    if (!allowed.includes(input.status))
      return { ok: false as const, code: 409 as const, error: `لا يمكن تغيير حالة المستخلص من ${existing.status} إلى ${input.status}`, errorKey: 'eIpcTransition' as const, errorVars: { from: existing.status, to: input.status } };
    const bad = validateIpc(input);
    if (bad) return { ok: false as const, code: 400, error: bad };
    if (db.ipcs.some((i) => i.projectId === projectId && i.ipcNumber === input.ipcNumber && i.id !== id))
      return { ok: false as const, code: 409 as const, error: 'رقم المستخلص مستخدم بالفعل في هذا المشروع' };
    const lines = input.lines ?? [];
    const lineErr = lines.length ? checkIpcLines(projectId, lines, input.ipcNumber) : null;
    if (lineErr) return { ok: false as const, code: 400, error: lineErr.error, errorKey: lineErr.errorKey, errorVars: lineErr.errorVars };
    Object.assign(existing, {
      ipcNumber: input.ipcNumber, date: input.date, status: input.status,
      notes: input.notes, deductions: input.deductions, grossAmount: input.grossAmount,
    });
    existing.netAmount = netOf(projectId, lines, input.grossAmount, input.deductions);
    db.ipcLines = db.ipcLines.filter((l) => l.ipcId !== id);
    for (const l of lines) {
      db.ipcLines.push({
        id: `il-mock-${Date.now()}-${l.boqItemId}`,
        ipcId: id, boqItemId: l.boqItemId,
        previousQuantity: pastQtyOf(projectId, l.boqItemId, input.ipcNumber),
        currentQuantity: l.currentQuantity,
      });
    }
    return { ok: true as const, ipc: clone(existing), items: clone(db.ipcLines.filter((l) => l.ipcId === id)) };
  },
  async remove(projectId: string, id: string, actorId: string) {
    await wait(300);
    if (!canProject(actorId, 'projects.edit', projectId)) return { ok: false as const, code: 403, error: 'ليس لديك صلاحية حذف المستخلصات في هذا المشروع' };
    const existing = db.ipcs.find((i) => i.id === id);
    if (!existing || existing.projectId !== projectId) return { ok: false as const, code: 404, error: 'المستخلص غير موجود' };
    // DeleteSafety.blockIpc — only untouched drafts may be removed.
    if (existing.status !== 'draft') return { ok: false as const, code: 409 as const, error: 'لا يمكن حذف المستخلص بعد خروجه من حالة المسودة.' };
    db.ipcs = db.ipcs.filter((i) => i.id !== id);
    db.ipcLines = db.ipcLines.filter((l) => l.ipcId !== id);
    return { ok: true as const };
  },
};
const validateIpc = (i: { ipcNumber: number; date: string; status: string; grossAmount?: number }) => {
  if (!Number.isFinite(i.ipcNumber) || i.ipcNumber < 1) return 'رقم المستخلص يجب أن يكون 1 أو أكثر';
  if (!i.date) return 'التاريخ مطلوب';
  if (Number.isNaN(Date.parse(i.date))) return 'التاريخ غير صالح';
  if (!['draft', 'submitted', 'approved', 'rejected'].includes(i.status)) return 'حالة المستخلص غير صالحة';
  if (i.grossAmount !== undefined && (!Number.isFinite(i.grossAmount) || i.grossAmount < 0)) return 'القيمة الإجمالية يجب أن تكون أكبر من أو تساوي 0';
  return null;
};

export const mrApi = {
  /** Phase 13: async now — the HTTP adapter cannot be synchronous, so the
      fixture signature was widened to match (same data, no artificial wait). */
  async projects(actorId?: string) {
    return projects.filter((p) => {
      const allowed = visibleProjects(actorId);
      return !allowed || allowed.has(p.id);
    });
  },
  /** Phase 9 remediation (CR-01): audited POST /projects transcription. The
      real route parses `projectSchema.safeParse(req.body)` (the FULL contract)
      and requires `projects.create`; the mock transcribes exactly those zod
      rules field-for-field — required code/name/status, optionally-provided
      client/owner/mainContractor/siteLocation/contractNumber (schema defaults
      '' when absent), contractValue ≥ 0, enum-guarded status/role. Nothing
      beyond the real contract is accepted; there is no 409/unique rule to fake
      (none is proven in the audited schema). */
  async createProject(d: { code: string; name: string; status: Project['status'] } &
    Partial<Omit<Project, 'id' | 'code' | 'name' | 'status'>>, actorId?: string) {
    if (!allowedFor(actorId, 'projects.create')) return { ok: false as const, code: 403, error: 'ليس لديك صلاحية إنشاء مشاريع' };
    if (!d.code?.trim()) return { ok: false as const, code: 400, error: 'كود المشروع مطلوب' };
    if (!d.name?.trim()) return { ok: false as const, code: 400, error: 'اسم المشروع مطلوب' };
    if (!['planned', 'active', 'on-hold', 'completed', 'cancelled'].includes(d.status))
      return { ok: false as const, code: 400, error: 'حالة المشروع غير صالحة' };
    if (d.contractValue !== undefined && (!Number.isFinite(Number(d.contractValue)) || Number(d.contractValue) < 0))
      return { ok: false as const, code: 400, error: 'قيمة العقد يجب أن تكون أكبر من أو تساوي 0' };
    if (d.role !== undefined && !['main-contractor', 'subcontractor', 'direct-contractor'].includes(d.role))
      return { ok: false as const, code: 400, error: 'دور الشركة غير صالح' };
    const cv = d.contractValue == null ? undefined : Number(d.contractValue);
    const created: Project = {
      id: `p-mock-${Date.now()}`,
      code: d.code.trim(), name: d.name.trim(),
      client: d.client?.trim() ?? '', owner: d.owner?.trim() ?? '',
      status: d.status,
      region: d.region?.trim() ?? '', contractNo: d.contractNo?.trim() ?? '',
      mainContractor: d.mainContractor?.trim() || undefined,
      siteLocation: d.siteLocation?.trim() || undefined,
      startDate: d.startDate || undefined, endDate: d.endDate || undefined,
      role: d.role || undefined, notes: d.notes?.trim() || undefined,
      ...(cv === undefined ? {} : { contractValue: cv }),
    };
    projects.unshift(created);
    /* Mirrors the audited POST /projects (Phase 5 §6): the creator gets a
       best-effort auto-grant at the DELETE level so they can see the project
       they just created. Without it the scoped projects(actorId) list would
       hide the new row behind the actor's access map. */
    const actor = users.find((x) => x.id === actorId);
    if (actor) actor.access[created.id] = 'DELETE';
    return { ok: true as const, project: created };
  },
  /** Audited PUT /projects/:id — real route takes `projectSchema.partial()`,
      so the mock accepts a partial patch of the SAME audited fields and
      validates every field it receives. Per the audited validator's own
      comment (projects.validators.ts): on update, an absent/undefined column
      "is left untouched (stable round-trip)" — so undefined never deletes
      contractValue; only an explicit new number rewrites it. */
  async updateProject(id: string, patch: Partial<Omit<Project, 'id'>>, actorId?: string) {
    if (!allowedFor(actorId, 'projects.edit')) return { ok: false as const, code: 403, error: 'ليس لديك صلاحية تعديل بيانات المشروع' };
    const p = projects.find((x) => x.id === id);
    if (!p) return { ok: false as const, code: 404, error: 'المشروع غير موجود' };
    if (patch.code !== undefined && !patch.code.trim()) return { ok: false as const, code: 400, error: 'كود المشروع مطلوب' };
    if (patch.name !== undefined && !patch.name.trim()) return { ok: false as const, code: 400, error: 'اسم المشروع مطلوب' };
    if (patch.status !== undefined && !['planned', 'active', 'on-hold', 'completed', 'cancelled'].includes(patch.status))
      return { ok: false as const, code: 400, error: 'حالة المشروع غير صالحة' };
    if (patch.role !== undefined && !['main-contractor', 'subcontractor', 'direct-contractor'].includes(patch.role))
      return { ok: false as const, code: 400, error: 'دور الشركة غير صالح' };
    const cv = patch.contractValue;
    if (cv !== undefined && (!Number.isFinite(cv) || cv < 0))
      return { ok: false as const, code: 400, error: 'قيمة العقد يجب أن تكون أكبر من أو تساوي 0' };
    if (patch.code !== undefined) p.code = patch.code.trim();
    if (patch.name !== undefined) p.name = patch.name.trim();
    if (patch.client !== undefined) p.client = patch.client.trim();
    if (patch.owner !== undefined) p.owner = patch.owner.trim();
    if (patch.mainContractor !== undefined) p.mainContractor = patch.mainContractor.trim() || undefined;
    if (patch.siteLocation !== undefined) p.siteLocation = patch.siteLocation.trim() || undefined;
    if (patch.region !== undefined) p.region = patch.region.trim();
    if (patch.contractNo !== undefined) p.contractNo = patch.contractNo.trim();
    if (patch.startDate !== undefined) p.startDate = patch.startDate || undefined;
    if (patch.endDate !== undefined) p.endDate = patch.endDate || undefined;
    if (patch.role !== undefined) p.role = (patch.role || undefined) as Project['role'];
    if (patch.notes !== undefined) p.notes = patch.notes.trim() || undefined;
    if (patch.status !== undefined) p.status = patch.status;
    if (cv !== undefined) p.contractValue = cv;
    return { ok: true as const };
  },
  list(filter: { q?: string; status?: string; projectId?: string; sortBy?: 'number' | 'createdAt' | 'status'; sortDir?: 'asc' | 'desc' }, actorId: string | undefined) {
    if (filter.projectId && filterProjectDenied(actorId, filter.projectId))
      return { items: [] as MR[], total: 0, denied: true as const };
    const q = (filter.q ?? '').toLowerCase();
    let rows = scopeRow(db.mrs, (m) => m.projectId, actorId);
    if (filter.status) rows = rows.filter((m) => m.status === filter.status);
    if (filter.projectId) rows = rows.filter((m) => m.projectId === filter.projectId);
    if (q) rows = rows.filter((m) => (m.number + (m.notes ?? '')).toLowerCase().includes(q) || m.lines.some((l) => itemName(l.itemId).toLowerCase().includes(q)));
    const dir = filter.sortDir === 'asc' ? 1 : -1;
    const by = filter.sortBy ?? 'createdAt';
    rows = [...rows].sort((a, b) => {
      const va = by === 'status' ? a.status : by === 'number' ? a.number : a.createdAt;
      const vb = by === 'status' ? b.status : by === 'number' ? b.number : b.createdAt;
      return String(va).localeCompare(String(vb), 'ar') * dir;
    });
    return { items: clone(rows), total: rows.length, denied: false as const };
  },
  get(id: string, actorId?: string) {
    const mr = db.mrs.find((m) => m.id === id);
    if (!mr) return undefined;
    if (!scopeRow([mr], (m) => m.projectId, actorId).length) return undefined; // out of scope → hidden
    return clone(mr);
  },
  /** Audited create (POST /): status is ALWAYS draft; items/project/site/warehouse
      must exist; at least one line. */
  async create(input: { projectId?: string; siteId?: string; warehouseId: string; notes?: string; lines: MRLine[] }, actorId: string) {
    await wait(420);
    if (!allowedFor(actorId, 'materialRequests.create')) return { ok: false as const, code: 403, error: 'ليس لديك صلاحية: materialRequests.create' };
    if (input.projectId && filterProjectDenied(actorId, input.projectId))
      return { ok: false as const, code: 403, error: 'ليس لديك صلاحية: materialRequests.view' };
    if (!input.warehouseId) return { ok: false as const, code: 400, error: 'المخزن مطلوب' };
    if (!warehouses.find((w) => w.id === input.warehouseId)) return { ok: false as const, code: 400, error: 'المخزن غير موجود' };
    if (input.projectId && !projects.find((p) => p.id === input.projectId)) return { ok: false as const, code: 400, error: 'المشروع غير موجود' };
    if (input.siteId && !sites.find((s) => s.id === input.siteId)) return { ok: false as const, code: 400, error: 'الموقع غير موجود' };
    if (!input.lines.length) return { ok: false as const, code: 400, error: 'أضف صنفًا واحدًا على الأقل' };
    for (const l of input.lines) {
      if (!items.find((i) => i.id === l.itemId)) return { ok: false as const, code: 400, error: 'أحد الأصناف غير موجود' };
      if (!(l.requested > 0)) return { ok: false as const, code: 400, error: 'الكمية المطلوبة يجب أن تكون أكبر من صفر' };
    }
    const created: MR = {
      id: `m-mock-${Date.now()}`,
      number: nextNumber('MR', db.mrs, 3),
      status: 'draft',
      projectId: input.projectId || undefined,
      siteId: input.siteId || undefined,
      warehouseId: input.warehouseId,
      by: 'مستخدم تجريبي',
      createdAt: new Date().toISOString().slice(0, 10),
      lines: input.lines.map((l) => ({ itemId: l.itemId, requested: l.requested, issued: 0, notes: l.notes })),
      notes: input.notes || undefined,
    };
    db.mrs.unshift(created);
    return { ok: true as const, mr: clone(created) };
  },
  /** Audited transition matrix.
      submit  : draft → submitted                (materialRequests.create)
      approve : submitted → approved              (materialRequests.approve)
      reject  : submitted → rejected              (materialRequests.approve, approve:false)
      close   : issued → closed                   PROTOTYPE-ONLY, no audited route */
  async act(id: string, action: MRAction, actorId: string, opts: { notes?: string } = {}) {
    await wait(350);
    const mr = db.mrs.find((m) => m.id === id);
    if (!mr) return { ok: false as const, code: 404, error: 'طلب المواد غير موجود' };
    if (action === 'submit') {
      if (!allowedFor(actorId, 'materialRequests.create')) return { ok: false as const, code: 403, error: 'ليس لديك صلاحية: materialRequests.create' };
      if (mr.status !== 'draft') return { ok: false as const, code: 409 as const, error: 'يمكن إرسال المسودة فقط' };
      mr.status = 'submitted';
    } else if (action === 'approve' || action === 'reject') {
      if (!allowedFor(actorId, 'materialRequests.approve')) return { ok: false as const, code: 403, error: 'ليس لديك صلاحية: materialRequests.approve' };
      if (mr.status !== 'submitted') return { ok: false as const, code: 409 as const, error: 'يمكن اعتماد الطلبات المقدمة فقط' };
      // Rejection travels through the audited approve endpoint as approve:false —
      // there is no /reject route in the contract.
      mr.status = action === 'approve' ? 'approved' : 'rejected';
      mr.reviewedBy = 'مستخدم تجريبي';
      mr.reviewNotes = opts.notes;
    } else {
      if (!allowedFor(actorId, 'materialRequests.approve')) return { ok: false as const, code: 403, error: 'يحتاج الإغلاق صلاحية اعتماد (قاعدة تجريبية غير موثقة)' };
      if (mr.status !== 'issued') return { ok: false as const, code: 409 as const, error: 'يمكن إغلاق الطلبات المصروفة بالكامل فقط (قاعدة تجريبية غير موثقة)' };
      mr.status = 'closed';
    }
    return { ok: true as const, mr: clone(mr) };
  },
  /** Audited issue (POST /:id/issue): prefilled from the request, one OUT
      transaction carrying the request number as reference, remaining-quantity
      and availability guards, then issued/partially-issued recomputation.
      A retry with the same quantities is rejected by the remaining-quantity
      guard instead of duplicating stock — there is no idempotency key in the
      contract, so the guard IS the duplicate protection. */
  async issue(id: string, lines: { itemId: string; quantity: number }[], actorId: string) {
    await wait(520);
    const mr = db.mrs.find((m) => m.id === id);
    if (!mr) return { ok: false as const, code: 404, error: 'طلب المواد غير موجود' };
    if (!allowedFor(actorId, 'materialRequests.issue')) return { ok: false as const, code: 403, error: 'ليس لديك صلاحية: materialRequests.issue' };
    if (!['approved', 'partially-issued'].includes(mr.status))
      return { ok: false as const, code: 409 as const, error: 'يمكن الصرف من الطلبات المعتمدة فقط' };
    if (!lines.length) return { ok: false as const, code: 400, error: 'حدد الكميات المصروفة' };
    for (const l of lines) {
      const wanted = mr.lines.find((x) => x.itemId === l.itemId);
      if (!wanted) return { ok: false as const, code: 400, error: 'صنف خارج نطاق الطلب' };
      const remaining = wanted.requested - wanted.issued;
      if (!(l.quantity > 0) || l.quantity > remaining)
        return { ok: false as const, code: 400, error: `الكمية المطلوب صرفها (${l.quantity}) تتجاوز المتبقي (${remaining})`, errorKey: 'eIssueOverRemaining' as const, errorVars: { qty: l.quantity, rem: remaining } };
    }
    for (const l of lines) {
      const avail = availableQty(l.itemId, mr.warehouseId);
      if (avail < l.quantity)
        return { ok: false as const, code: 409 as const, error: `الرصيد غير كافٍ للصنف "${itemName(l.itemId)}" — المتاح ${avail}`, errorKey: 'eInsufficientStock' as const, errorVars: { item: itemName(l.itemId), avail } };
    }
    // Single multi-item OUT movement, created BEFORE the request is updated —
    // same order as the audited factory (transaction first, then status).
    const txRes = await stockApi.create({
      type: 'OUT',
      warehouseId: mr.warehouseId,
      projectId: mr.projectId,
      referenceNumber: mr.number,
      date: new Date().toISOString().slice(0, 10),
      notes: `صرف مقابل طلب مواد ${mr.number}`,
      lines: lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
    }, actorId);
    if (!txRes.ok) return { ok: false as const, code: txRes.code, error: txRes.error };
    const newLines = mr.lines.map((i) => {
      const now = lines.filter((l) => l.itemId === i.itemId).reduce((s, l) => s + l.quantity, 0);
      return { ...i, issued: Math.min(i.requested, i.issued + now) };
    });
    const fully = newLines.every((i) => i.issued >= i.requested);
    const any = newLines.some((i) => i.issued > 0);
    mr.lines = newLines;
    mr.status = fully ? 'issued' : any ? 'partially-issued' : mr.status;
    return { ok: true as const, mr: clone(mr), txn: txRes.txn };
  },
  /** Audited DeleteSafety: only untouched drafts may be removed. */
  async remove(id: string, actorId: string) {
    await wait(300);
    const mr = db.mrs.find((m) => m.id === id);
    if (!mr) return { ok: false as const, code: 404, error: 'طلب المواد غير موجود' };
    if (!allowedFor(actorId, 'materialRequests.create')) return { ok: false as const, code: 403, error: 'ليس لديك صلاحية: materialRequests.create' };
    if (mr.status !== 'draft') return { ok: false as const, code: 409 as const, error: 'لا يمكن حذف طلب المواد بعد خروجه من حالة المسودة.' };
    db.mrs = db.mrs.filter((m) => m.id !== id);
    return { ok: true as const };
  },
};

/* ---------- mock user administration (prototype-only) ----------
   Mirrors audited backend rules: role base from ROLE_PERMISSIONS, override
   semantics with explicit DENY beating GRANT, self guards (no self role/
   disable/override-removal of your own admin right), last-admin protection.
   Email/dept/title fields are prototype-only mock extensions (see data.ts). */
const users: MockUser[] = clone(mockUsers);
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Source = 'role' | 'grant' | 'deny' | 'none';
const effHas = (u: MockUser, patch: { role?: MockUser['role']; overrides?: MockUser['overrides'] }, key: string): { v: boolean; s: Source } => {
  const role = patch.role ?? u.role;
  const ov = (patch.overrides ?? u.overrides)[key];
  if (ov === 'DENY') return { v: false, s: 'deny' };
  if (ov === 'GRANT') return { v: true, s: 'grant' };
  return ROLE_BASE[role].includes(key) ? { v: true, s: 'role' } : { v: false, s: 'none' };
};

export const userApi = {
  list: (): MockUser[] => clone(users),
  /* Phase 5 hardening: get() used to call clone(undefined) for unknown ids —
     JSON.stringify(undefined) is undefined, so JSON.parse threw SyntaxError.
     Any caller probing a missing record (deleted demo user) crashed instead
     of receiving undefined. Now: not-found → undefined. */
  get: (id: string): MockUser | undefined => {
    const u = users.find((x) => x.id === id);
    return u ? clone(u) : undefined;
  },
  effective(id: string): { allowed: Record<string, boolean>; source: Record<string, Source> } {
    const u = users.find((x) => x.id === id);
    const allowed: Record<string, boolean> = {};
    const source: Record<string, Source> = {};
    for (const g of MANAGED_GROUPS)
      for (const k of g.keys) {
        const r = u ? effHas(u, {}, k) : { v: false, s: 'none' as Source };
        allowed[k] = r.v;
        source[k] = r.s;
      }
    return { allowed, source };
  },
  /** Would applying `change` to target leave zero active admin-capable users? */
  adminCountAfter(targetId: string, change: { active?: boolean; role?: MockUser['role']; overrides?: MockUser['overrides']; remove?: boolean }): number {
    return users.filter((u) => {
      if (change.remove && u.id === targetId) return false;
      const active = u.id === targetId && change.active !== undefined ? change.active : u.active;
      if (!active) return false;
      const patch = u.id === targetId ? change : {};
      return effHas(u, patch, 'users.manage').v;
    }).length;
  },
  guard(actorId: string, targetId: string, change: { active?: boolean; role?: MockUser['role']; overrides?: MockUser['overrides']; remove?: boolean }): { ok: true } | { ok: false; error: string; errorKey?: 'eUserMissingDemo' } {
    const target = users.find((u) => u.id === targetId);
    if (!target) return { ok: false, error: 'المستخدم غير موجود (بيانات تجريبية).', errorKey: 'eUserMissingDemo' as const };
    const self = actorId === targetId;
    const next = { active: change.active ?? target.active, role: change.role ?? target.role, overrides: change.overrides ?? target.overrides };
    // Self-denial: never let the actor strip their own effective users.manage.
    if (self && effHas(target, next, 'users.manage').v === false && effHas(target, {}, 'users.manage').v === true)
      return { ok: false, error: 'لا يمكنك سحب صلاحية إدارتك بنفسك. عيّن مديرًا آخر أولًا ثم كرر الإجراء.' };
    // Last-admin protection (disable / demote / delete / self-strip paths).
    if (this.adminCountAfter(targetId, { ...change }) < 1)
      return { ok: false, error: 'مرفوض: سيترك هذا الإجراء النظام بلا أي حساب إداري نشط. أنشئ مديرًا بديلًا أولًا.' };
    return { ok: true };
  },
  create(input: { name: string; email: string; dept: string; title: string; role: MockUser['role']; active: boolean }): { ok: true; user: MockUser } | { ok: false; error: string } {
    if (!input.name.trim()) return { ok: false, error: 'الاسم مطلوب.' };
    if (!EMAIL_RE.test(input.email.trim())) return { ok: false, error: 'صيغة البريد الإلكتروني غير صالحة (يُقبل أي نطاق صالح).' };
    if (users.some((u) => u.email.toLowerCase() === input.email.trim().toLowerCase()))
      return { ok: false, error: 'هذا البريد مسجل بالفعل لمستخدم آخر.' };
    const user: MockUser = { id: `mu-mock-${Date.now()}`, name: input.name.trim(), email: input.email.trim(), dept: input.dept.trim(), title: input.title.trim(), role: input.role, active: input.active, overrides: {}, access: {} };
    users.push(user);
    return { ok: true, user: clone(user) };
  },
  update(id: string, actorId: string, patch: { name?: string; email?: string; dept?: string; title?: string; role?: MockUser['role']; active?: boolean }): { ok: true } | { ok: false; error: string } {
    const u = users.find((x) => x.id === id);
    if (!u) return { ok: false, error: 'المستخدم غير موجود.' };
    if (patch.email !== undefined) {
      if (!EMAIL_RE.test(patch.email.trim())) return { ok: false, error: 'صيغة البريد الإلكتروني غير صالحة.' };
      if (users.some((x) => x.id !== id && x.email.toLowerCase() === patch.email!.trim().toLowerCase()))
        return { ok: false, error: 'هذا البريد مسجل بالفعل لمستخدم آخر.' };
    }
    const g = this.guard(actorId, id, { active: patch.active, role: patch.role });
    if (!g.ok) return g;
    if (patch.name !== undefined) u.name = patch.name.trim();
    if (patch.email !== undefined) u.email = patch.email.trim();
    if (patch.dept !== undefined) u.dept = patch.dept.trim();
    if (patch.title !== undefined) u.title = patch.title.trim();
    if (patch.role !== undefined) u.role = patch.role;
    if (patch.active !== undefined) u.active = patch.active;
    return { ok: true };
  },
  remove(id: string, actorId: string): { ok: true } | { ok: false; error: string } {
    if (id === actorId) return { ok: false, error: 'لا يمكنك حذف حسابك بنفسك.' };
    const g = this.guard(actorId, id, { remove: true });
    if (!g.ok) return g;
    const i = users.findIndex((u) => u.id === id);
    if (i < 0) return { ok: false, error: 'المستخدم غير موجود.' };
    users.splice(i, 1);
    return { ok: true };
  },
  setOverrides(id: string, actorId: string, overrides: MockUser['overrides']): { ok: true } | { ok: false; error: string } {
    const g = this.guard(actorId, id, { overrides });
    if (!g.ok) return g;
    const u = users.find((x) => x.id === id);
    if (!u) return { ok: false, error: 'المستخدم غير موجود.' };
    u.overrides = { ...overrides };
    return { ok: true };
  },
  setAccess(id: string, access: MockUser['access']): { ok: true } {
    const u = users.find((x) => x.id === id);
    if (u) u.access = { ...access };
    return { ok: true };
  },
  resetPassword(id: string): { ok: true; message: string; errorKey?: 'eResetSimulated' | 'eUserMissing'; errorVars?: { email: string } } {
    const u = users.find((x) => x.id === id);
    return { ok: true, message: u ? `تمت محاكاة إعادة التعيين لـ ${u.email} — لم يُرسل بريد حقيقي ولم تتغير أي كلمة مرور.` : 'المستخدم غير موجود.', errorKey: u ? 'eResetSimulated' : 'eUserMissing', errorVars: { email: u?.email ?? '' } };
  },
};
export type { AccessLevel, OverrideEffect };

/* ===================================================================
   Reports / exports (Phase 3.7)
   -------------------------------------------------------------------
   Gate: `reports.view` — the audited export permission. Every audited
   `/export/xlsx` route in the backend uses exactly this key
   (projects / items / warehouses / stock). No `reports.export` key is
   invented.
   The gate is checked here, on the MOCK PATH, not only by hiding a button,
   so calling `reportApi.export(...)` directly without the permission still
   fails. The audit dataset additionally needs `audit.view` — exporting the
   audit trail without being able to read it would be a privilege lift.
   Each dataset ALSO requires the read permission that backs the data it
   exposes (a defence-in-depth tightening over the audited routes, which
   export the whole table behind `reports.view` alone).
   Project-level scoping is applied to every project-bearing dataset with
   the same `scopeRow` rule used by the screens themselves, so the export
   can never widen what the viewer already can see. Filtering by an
   out-of-scope project is a hard denial, not an empty result.
   No network call is made anywhere in this engine.
   =================================================================== */
import { csvText, jsonText, CSV_MIME, JSON_MIME, safeStem } from '@/shared/lib/files';
import type { Column, Cell } from '@/shared/lib/files';

export interface ReportDef {
  id: string;
  /** i18n key for the report name — never a hard-coded Arabic string. */
  labelKey: string;
  /** ASCII file stem prefix. */
  stem: string;
  /** Extra read permission required on top of `reports.view`. */
  readPerm: string;
  columns: Column[];
  /** Row builder — MUST scope by project membership itself. */
  rows: (actorId?: string) => Record<string, Cell>[];
  /** Optional narrowing applied by `export` on top of the scoped rows. */
  refine?: (rows: Record<string, Cell>[], filter: ExportFilter) => Record<string, Cell>[];
  /** Optional ordering applied by `export` AFTER refine, so a file can hold
      the same order the user sees on screen. Receives the report's own row
      keys (see each def). Absent → file keeps engine order. */
  order?: (rows: Record<string, Cell>[], by: string, dir: 'asc' | 'desc') => Record<string, Cell>[];
}

const codeOf = (id?: string) => projects.find((p) => p.id === id)?.code ?? '';
const whCode = (id?: string) => warehouses.find((w) => w.id === id)?.code ?? '';
const repItemName = (id: string) => items.find((i) => i.id === id)?.name ?? id;
const repWhCode = (id?: string) => warehouses.find((w) => w.id === id)?.code ?? '';

const REPORTS: ReportDef[] = [
  {
    id: 'projects', labelKey: 'rptProjects', stem: 'projects', readPerm: 'projects.view',
    columns: [
      { key: 'code', label: 'project code' }, { key: 'name', label: 'project name' },
      { key: 'client', label: 'client' }, { key: 'region', label: 'region' },
      { key: 'status', label: 'status' }, { key: 'contractNo', label: 'contract no' },
    ],
    rows: (actorId) =>
      (allowedFor(actorId, 'projects.view') ? scopeRow(projects, (p) => p.id, actorId) : []).map((p) => ({
        code: p.code, name: p.name, client: p.client, region: p.region,
        // Raw status code in the file — display labels are a UI concern.
        status: p.status, contractNo: p.contractNo,
      })),
    // Same key order the Projects page sorts by, so an export can reproduce it.
    order: (rows, by, dir) => {
      const sign = dir === 'asc' ? 1 : -1;
      const key = (r: Record<string, Cell>) =>
        by === 'name' ? String(r.name) : by === 'client' ? String(r.client) : by === 'status' ? String(r.status) : String(r.code);
      return [...rows].sort((a, b) => key(a).localeCompare(key(b), undefined, { numeric: true }) * sign || String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
    },
  },
  {
    id: 'warehouses', labelKey: 'rptWarehouses', stem: 'warehouses', readPerm: 'warehouse.view',
    columns: [
      { key: 'code', label: 'code' }, { key: 'name', label: 'name' },
      { key: 'type', label: 'type' }, { key: 'location', label: 'location' },
      { key: 'status', label: 'status' }, { key: 'project', label: 'project' },
    ],
    rows: (actorId) =>
      (allowedFor(actorId, 'warehouse.view') ? scopeRow(warehouses, (w) => w.projectId, actorId) : []).map((w) => ({
        code: w.code, name: w.name, type: w.type, location: w.location,
        status: w.status, project: codeOf(w.projectId), projectId: w.projectId ?? '',
      })),
    // Same predicate the Warehouses page applies on screen, so a contextual
    // export from that page writes exactly the rows the user is looking at.
    // `refine` only ever narrows already-scoped rows.
    refine: (rows, f) => (f.q ? rows.filter((r) => `${r.code}${r.name}${r.location}`.includes(f.q as string)) : rows),
    // Same key order the Warehouses page sorts by. `projectId` (raw id, also
    // carried on the row outside the visible columns) matches the page, which
    // sorts by project id — not by the display code.
    order: (rows, by, dir) => {
      const sign = dir === 'asc' ? 1 : -1;
      const key = (r: Record<string, Cell>) =>
        by === 'name' ? String(r.name) : by === 'type' ? String(r.type)
        : by === 'location' ? String(r.location) : by === 'project' ? String(r.projectId) : String(r.code);
      return [...rows].sort((a, b) => key(a).localeCompare(key(b), undefined, { numeric: true, sensitivity: 'base' }) * sign || String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
    },
  },
  {
    id: 'items', labelKey: 'rptItems', stem: 'items', readPerm: 'warehouse.view',
    columns: [
      { key: 'code', label: 'code' }, { key: 'name', label: 'name' },
      { key: 'category', label: 'category' }, { key: 'unit', label: 'unit' },
      { key: 'minimumStock', label: 'minimum stock' },
    ],
    rows: (actorId) => (allowedFor(actorId, 'warehouse.view') ? items : []).map((i) => ({
      code: i.code, name: i.name, category: i.category, unit: i.unit,
      minimumStock: i.minimumStock ?? '',
    })),
    // Same predicate the Items page applies on screen. Items carry no project,
    // so the report is only narrowed by the search box — never widened.
    refine: (rows, f) => (f.q ? rows.filter((r) => `${r.code}${r.name}${r.category}`.includes(f.q as string)) : rows),
    // Same key order the Items page sorts by. Missing safety levels sort last
    // in both directions, exactly like the screen.
    order: (rows, by, dir) => {
      const sign = dir === 'asc' ? 1 : -1;
      const byCode = (a: Record<string, Cell>, b: Record<string, Cell>) =>
        String(a.code).localeCompare(String(b.code), undefined, { numeric: true });
      return [...rows].sort((a, b) => {
        if (by === 'safety') {
          const va = typeof a.minimumStock === 'number' ? a.minimumStock : null;
          const vb = typeof b.minimumStock === 'number' ? b.minimumStock : null;
          if (va === null || vb === null) return va === vb ? byCode(a, b) : va === null ? 1 : -1;
          return sign * (va - vb) || byCode(a, b);
        }
        const ka = by === 'name' ? String(a.name) : by === 'category' ? String(a.category) : String(a.code);
        const kb = by === 'name' ? String(b.name) : by === 'category' ? String(b.category) : String(b.code);
        return ka.localeCompare(kb, undefined, { numeric: true, sensitivity: 'base' }) * sign || byCode(a, b);
      });
    },
  },
  {
    id: 'stock', labelKey: 'rptStock', stem: 'stock-movements', readPerm: 'warehouse.view',
    columns: [
      { key: 'number', label: 'number' }, { key: 'type', label: 'type' }, { key: 'date', label: 'date' },
      { key: 'warehouse', label: 'warehouse' }, { key: 'destination', label: 'destination warehouse' },
      { key: 'project', label: 'project' }, { key: 'referenceNumber', label: 'reference number' },
      { key: 'notes', label: 'notes' }, { key: 'lines', label: 'lines' },
    ],
    // Column set mirrors `expandForExport` in stock.routes.ts.
    rows: (actorId) =>
      (allowedFor(actorId, 'warehouse.view') ? scopeRow(db.txns, (t) => t.projectId, actorId) : []).map((t) => ({
        number: t.number, type: t.type, date: t.date,
        warehouse: whCode(t.warehouseId), destination: whCode(t.destinationWarehouseId),
        project: codeOf(t.projectId), referenceNumber: t.referenceNumber ?? '', notes: t.notes ?? '',
        lines: t.lines.map((l) => `${repItemName(l.itemId)} × ${l.quantity}`).join(' | '),
      })),
  },
  {
    id: 'requests', labelKey: 'rptRequests', stem: 'material-requests', readPerm: 'materialRequests.view',
    columns: [
      { key: 'number', label: 'number' }, { key: 'status', label: 'status' },
      { key: 'project', label: 'project' }, { key: 'warehouse', label: 'warehouse' },
      { key: 'by', label: 'requested by' }, { key: 'createdAt', label: 'created at' },
      { key: 'lines', label: 'lines' }, { key: 'notes', label: 'notes' },
    ],
    rows: (actorId) =>
      (allowedFor(actorId, 'materialRequests.view') ? scopeRow(db.mrs, (r) => r.projectId, actorId) : []).map((r) => ({
        number: r.number, status: r.status, project: codeOf(r.projectId),
        warehouse: whCode(r.warehouseId), by: r.by, createdAt: r.createdAt,
        lines: r.lines.map((l) => `${repItemName(l.itemId)} × ${l.requested}`).join(' | '), notes: r.notes ?? '',
      })),
  },
  {
    id: 'boq', labelKey: 'rptBoq', stem: 'boq-lines', readPerm: 'projects.view',
    columns: [
      { key: 'projectCode', label: 'project code' }, { key: 'itemCode', label: 'item code' },
      { key: 'description', label: 'description' }, { key: 'unit', label: 'unit' },
      { key: 'quantity', label: 'quantity' }, { key: 'unitPrice', label: 'unit price' },
      { key: 'totalPrice', label: 'total price' },
    ],
    rows: (actorId) =>
      (allowedFor(actorId, 'projects.view')
        ? scopeRow(db.boq, (b) => b.projectId, actorId).sort((a, b) => a.itemCode.localeCompare(b.itemCode, undefined, { numeric: true }))
        : []).map((b) => ({
        projectCode: codeOf(b.projectId), itemCode: b.itemCode, description: b.description,
        unit: b.unit, quantity: b.quantity, unitPrice: b.unitPrice,
        // derived — never stored (see README / Phase 3.6 report)
        totalPrice: boqTotal(b),
      })),
  },
  {
    id: 'ipc', labelKey: 'rptIpc', stem: 'payment-certificates', readPerm: 'projects.view',
    columns: [
      { key: 'projectCode', label: 'project code' }, { key: 'ipcNumber', label: 'certificate number' },
      { key: 'date', label: 'date' }, { key: 'status', label: 'status' },
      { key: 'grossAmount', label: 'gross amount' }, { key: 'deductions', label: 'deductions' },
      { key: 'netAmount', label: 'net amount' }, { key: 'lineCount', label: 'line count' },
    ],
    rows: (actorId) =>
      (allowedFor(actorId, 'projects.view') ? scopeRow(db.ipcs, (i) => i.projectId, actorId) : []).map((i) => ({
        projectCode: codeOf(i.projectId), ipcNumber: i.ipcNumber, date: i.date,
        status: i.status,
        // only meaningful for a certificate without BOQ lines — left blank otherwise
        grossAmount: i.grossAmount ?? '', deductions: i.deductions ?? '',
        netAmount: i.netAmount ?? 0, lineCount: db.ipcLines.filter((l) => l.ipcId === i.id).length,
      })),
  },
  {
    id: 'audit', labelKey: 'rptAudit', stem: 'audit-log', readPerm: 'audit.view',
    columns: [
      { key: 'at', label: 'timestamp' }, { key: 'user', label: 'username' },
      { key: 'action', label: 'action' }, { key: 'entity', label: 'entity' },
      { key: 'entityId', label: 'entity id' }, { key: 'changes', label: 'changes' },
    ],
    rows: (actorId) => (allowedFor(actorId, 'audit.view') ? db.audits : []).map((a) => ({
      at: a.at, user: a.user, action: a.action, entity: a.entity, entityId: a.entityId ?? '',
      changes: (a.diff ?? []).map((d) => `${d.field}: ${d.from} → ${d.to}`).join(' | '),
    })),
    // Same predicate the page applies on screen, so an exported file holds
    // exactly the rows the user is looking at.
    refine: (rows, f) => rows.filter((r) => {
      if (f.q && !`${r.at} ${r.user} ${r.action} ${r.entity} ${r.entityId} ${r.changes}`.includes(f.q)) return false;
      if (f.user && r.user !== f.user) return false;
      if (f.action && r.action !== f.action) return false;
      if (f.entity && r.entity !== f.entity) return false;
      const day = String(r.at).slice(0, 10);
      if (f.from && day < f.from) return false;
      if (f.to && day > f.to) return false;
      return true;
    }),
    // Same key order the Audit page sorts by, so the file can reproduce the
    // grid order instead of silently falling back to engine order.
    order: (rows, by, dir) => {
      const sign = dir === 'asc' ? 1 : -1;
      const valid = ['at', 'user', 'action', 'entity', 'entityId'];
      const k = valid.includes(by) ? by : 'at';
      // Same comparator as the Audit grid (including the `at` tiebreak), so
      // the exported file reproduces the visible order exactly.
      return [...rows].sort((a, b) =>
        String(a[k] ?? '').localeCompare(String(b[k] ?? ''), 'ar', { numeric: true }) * sign ||
        String(a.at).localeCompare(String(b.at)));
    },
  },
  {
    id: 'documents',
    labelKey: 'rptDocuments',
    stem: 'documents',
    readPerm: 'archive.view',
    columns: [
      { key: 'number', label: 'number' }, { key: 'title', label: 'title' },
      { key: 'category', label: 'category' }, { key: 'type', label: 'type' },
      { key: 'status', label: 'status' }, { key: 'project', label: 'project' },
      { key: 'updatedAt', label: 'updated at' }, { key: 'revision', label: 'revision' },
    ],
    rows: (actorId) =>
      (allowedFor(actorId, 'archive.view') ? scopeRow(db.docs, (d) => d.projectId, actorId) : []).map((d) => ({
        // Document METADATA only — never file contents. Prototype-only report:
        // the audited production endpoint is XLSX-only (see GAP-REGISTER).
        number: d.number, title: d.title, category: d.category, type: d.type,
        status: d.status, project: codeOf(d.projectId), updatedAt: d.updatedAt,
        revision: d.revision, tags: (d.tags ?? []).join(' '),
      })),
    // Same predicate the Archive page applies on screen (title + number +
    // tags text, status code, project membership). Only ever narrows.
    refine: (rows, f) => rows.filter((r) => {
      if (f.q && !`${r.title}${r.number}${r.tags ?? ''}`.includes(f.q as string)) return false;
      if (f.status && r.status !== f.status) return false;
      if (f.project && r.project !== codeOf(f.project)) return false;
      return true;
    }),
    // Same key order the Archive page sorts by. Status sorts by raw code here
    // (the screen sorts by localized label) — deterministic, documented in the
    // Phase 3.12 report as the one residual ordering difference.
    order: (rows, by, dir) => {
      const sign = dir === 'asc' ? 1 : -1;
      const key = (r: Record<string, Cell>) =>
        by === 'title' ? String(r.title) : by === 'category' ? String(r.category)
        : by === 'status' ? String(r.status) : String(r.updatedAt);
      return [...rows].sort((a, b) =>
        key(a).localeCompare(key(b), undefined, { numeric: true, sensitivity: 'base' }) * sign ||
        String(a.number).localeCompare(String(b.number), undefined, { numeric: true }));
    },
  },
];

const reportDef = (id: string) => REPORTS.find((r) => r.id === id);

export type ExportFormat = 'csv' | 'json';
/** Structured filter accepted by `export`. It is re-applied by the engine to
    the ALREADY-SCOPED rows, so a caller cannot smuggle rows past the project
    and permission gates by sending a filter. */
export interface ExportFilter {
  q?: string; user?: string; action?: string; entity?: string; from?: string; to?: string;
  /** List-screen filters, honored only by reports whose `refine` reads them. */
  status?: string; project?: string;
  /** Grid sort to reproduce in the file. Honored only by reports whose `order`
      maps these keys; otherwise ignored (never an error). */
  sortBy?: string; sortDir?: 'asc' | 'desc';
}
export interface ExportResult {
  ok: true;
  filename: string; mime: string; text: string;
  columns: Column[]; rows: Record<string, Cell>[]; rowCount: number;
  /** i18n keys so the UI can describe exactly what was exported. */
  reportId: string; labelKey: string; columnsJson: string;
  /** true when the active filter narrowed the exported set. */
  filtered: boolean;
}

export const reportApi = {
  /** Report definitions the identity may actually export, with the scoped row
      count so the page can state the scope before the user commits. */
  available(actorId?: string) {
    return REPORTS
      .filter((r) => allowedFor(actorId, 'reports.view') && allowedFor(actorId, r.readPerm))
      .map((r) => ({ id: r.id, labelKey: r.labelKey, rowCount: r.rows(actorId).length, columns: r.columns }));
  },
  /** Scoped preview — same rows `export` would write, never a wider set. */
  preview(actorId: string | undefined, id: string): { ok: true; columns: Column[]; rows: Record<string, Cell>[] } | { ok: false; code: 403 | 404; error: string } {
    const def = reportDef(id);
    if (!def) return { ok: false, code: 404, error: 'التقرير غير موجود' };
    if (!allowedFor(actorId, 'reports.view') || !allowedFor(actorId, def.readPerm))
      return { ok: false, code: 403, error: 'ليس لديك صلاحية عرض التقارير أو تصديرها' };
    return { ok: true, columns: def.columns, rows: def.rows(actorId) };
  },
  /**
   * Scoped row count AFTER the optional filter is re-applied — the number a
   * contextual per-list export would actually write. `null` when the report
   * does not exist or the identity may not export it. Same gates as `export`.
   */
  count(actorId: string | undefined, id: string, filter?: ExportFilter): number | null {
    const def = reportDef(id);
    if (!def) return null;
    if (!allowedFor(actorId, 'reports.view') || !allowedFor(actorId, def.readPerm)) return null;
    let rows = def.rows(actorId);
    if (filter && def.refine) rows = def.refine(rows, filter);
    return rows.length;
  },
  /**
   * The guarded export operation. Permission is enforced HERE, on the mock
   * path, so a direct call without `reports.view` (or without the dataset's
   * read permission) fails even when the UI never offered a button.
   */
  async export(actorId: string | undefined, id: string, format: ExportFormat = 'csv', filter?: ExportFilter): Promise<ExportResult | { ok: false; code: 403 | 404; error: string }> {
    await wait(250);
    const def = reportDef(id);
    if (!def) return { ok: false, code: 404, error: 'التقرير غير موجود' };
    if (!allowedFor(actorId, 'reports.view') || !allowedFor(actorId, def.readPerm))
      return { ok: false, code: 403, error: 'ليس لديك صلاحية عرض التقارير أو تصديرها' };
    let rows = def.rows(actorId);
    if (filter && def.refine) rows = def.refine(rows, filter);
    if (filter?.sortBy && def.order) rows = def.order(rows, filter.sortBy, filter.sortDir ?? 'asc');
    const stem = `${safeStem(def.stem)}-${new Date().toISOString().slice(0, 10)}`;
    const json = format === 'json';
    return {
      ok: true,
      filename: `${stem}.${json ? 'json' : 'csv'}`,
      mime: json ? JSON_MIME : CSV_MIME,
      text: json ? jsonText(rows) : csvText(def.columns, rows),
      columns: def.columns, rows, rowCount: rows.length,
      reportId: def.id, labelKey: def.labelKey,
      columnsJson: JSON.stringify(def.columns),
      filtered: !!(filter && def.refine && rows.length !== def.rows(actorId).length),
    };
  },
};

// Test-only surface for the failure-injection hooks above. Available only in
// prototype builds (VITE_PROTOTYPE=1); absent from any other bundle.
// `__protoApi` additionally exposes the guarded mock operations so a test can
// prove that a forbidden action is refused ON THE MOCK PATH ITSELF and not
// merely hidden by the UI — the Phase 3.5 requirement.
if (import.meta.env.VITE_PROTOTYPE === '1' && typeof window !== 'undefined') {
  const w = window as unknown as { __protoTestHooks?: unknown; __protoApi?: unknown };
  w.__protoTestHooks = __protoFail;
  w.__protoApi = { stockApi, mrApi, userApi, boqApi, ipcApi, reportApi, canProject };
}
