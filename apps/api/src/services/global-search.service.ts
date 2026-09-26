import { includesNormalized } from '@cos/shared';
import type { Id } from '@cos/shared';
import { projectRepository } from '../repositories/project.repository';
import { documentRepository } from '../repositories/document.repository';
import { warehouseRepository } from '../repositories/warehouse.repository';
import { itemRepository } from '../repositories/item.repository';
import { stockTransactionRepository } from '../repositories/stock-transaction.repository';
import { loadContext, can } from './authorization.service';
import type { AuthzContext } from './authorization.service';

export interface SearchHit {
  id: Id;
  title: string;
  subtitle?: string;
  link: string;
}

export interface SearchResults {
  projects: SearchHit[];
  documents: SearchHit[];
  warehouses: SearchHit[];
  items: SearchHit[];
  transactions: SearchHit[];
}

/**
 * Extensible registry — future entities (contracts, purchase orders, BOQ, IPCs,
 * suppliers, subcontractors) can be added as additional entries without
 * changing the API shape.
 */
export const globalSearch = async (qRaw: string, userId: string, limit = 5): Promise<SearchResults> => {
  const q = qRaw.trim();
  const hit = (source: string | undefined) => includesNormalized(source, q);
  const empty: SearchResults = { projects: [], documents: [], warehouses: [], items: [], transactions: [] };
  if (!q) return empty;
  // Phase 5: every hit is authorized row-by-row (pure checks over one
  // context — no per-row queries). Unknown users see nothing (fail closed).
  const ctx: AuthzContext | null = await loadContext(userId);
  if (!ctx) return empty;
  const bypass = can(ctx, 'projects.access');
  const memberOf = new Set(ctx.memberships.filter((m) => m.access !== 'NONE').map((m) => m.projectId));
  const visibleProject = (pid: string | null | undefined, viewKey: string): boolean => {
    if (!can(ctx, viewKey)) return false;
    if (bypass) return true;
    return !pid || memberOf.has(pid);
  };

  const projects = (await projectRepository.list())
    .filter((p) => (hit(p.projectCode) || hit(p.projectName) || hit(p.client)) && visibleProject(p.id, 'projects.view'))
    .slice(0, limit)
    .map((p) => ({ id: p.id, title: p.projectName, subtitle: `${p.projectCode} · ${p.client}`, link: `/projects/${p.id}` }));

  const documents = (await documentRepository.list())
    .filter((d) => (hit(d.title) || hit(d.documentNumber) || d.tags.some(hit)) && visibleProject(d.projectId, 'archive.view'))
    .slice(0, limit)
    .map((d) => ({ id: d.id, title: d.title, subtitle: `${d.category}${d.documentNumber ? ' · ' + d.documentNumber : ''}`, link: `/archive?focus=${d.id}` }));

  const warehouses = (await warehouseRepository.list())
    .filter((w) => (hit(w.code) || hit(w.name) || hit(w.location)) && visibleProject(w.projectId, 'warehouse.view'))
    .slice(0, limit)
    .map((w) => ({ id: w.id, title: w.name, subtitle: `${w.code} · ${w.type === 'central' ? 'مركزي' : 'موقع'}`, link: `/warehouses?focus=${w.id}` }));

  const items = (await itemRepository.list())
    .filter((i) => (hit(i.code) || hit(i.name) || hit(i.category) || hit(i.brand)) && can(ctx, 'warehouse.view'))
    .slice(0, limit)
    .map((i) => ({ id: i.id, title: i.name, subtitle: `${i.code} · ${i.unit}`, link: `/items?focus=${i.id}` }));

  // Transactions resolve scope via their warehouse (one batched lookup).
  const whProject = new Map(
    (await warehouseRepository.list()).map((w) => [w.id, w.projectId ?? null] as const),
  );
  const transactions = (await stockTransactionRepository.list())
    .filter((t) => {
      if (!(hit(t.number) || hit(t.referenceNumber) || hit(t.type))) return false;
      const wid = (t as { warehouseId?: string }).warehouseId;
      return visibleProject(wid ? (whProject.get(wid) ?? null) : null, 'warehouse.view');
    })
    .slice(0, limit)
    .map((t) => ({ id: t.id, title: t.number ?? t.type, subtitle: t.referenceNumber, link: `/stock` }));

  return { projects, documents, warehouses, items, transactions };
};

