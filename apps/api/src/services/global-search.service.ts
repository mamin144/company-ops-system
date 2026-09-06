import { includesNormalized } from '@cos/shared';
import type { Id } from '@cos/shared';
import { projectRepository } from '../repositories/project.repository';
import { documentRepository } from '../repositories/document.repository';
import { warehouseRepository } from '../repositories/warehouse.repository';
import { itemRepository } from '../repositories/item.repository';
import { stockTransactionRepository } from '../repositories/stock-transaction.repository';

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
export const globalSearch = async (qRaw: string, limit = 5): Promise<SearchResults> => {
  const q = qRaw.trim();
  const hit = (source: string | undefined) => includesNormalized(source, q);
  if (!q) return { projects: [], documents: [], warehouses: [], items: [], transactions: [] };

  const projects = (await projectRepository.list())
    .filter((p) => hit(p.projectCode) || hit(p.projectName) || hit(p.client))
    .slice(0, limit)
    .map((p) => ({ id: p.id, title: p.projectName, subtitle: `${p.projectCode} · ${p.client}`, link: `/projects/${p.id}` }));

  const documents = (await documentRepository.list())
    .filter((d) => hit(d.title) || hit(d.documentNumber) || d.tags.some(hit))
    .slice(0, limit)
    .map((d) => ({ id: d.id, title: d.title, subtitle: `${d.category}${d.documentNumber ? ' · ' + d.documentNumber : ''}`, link: `/archive?focus=${d.id}` }));

  const warehouses = (await warehouseRepository.list())    .filter((w) => hit(w.code) || hit(w.name) || hit(w.location))
    .slice(0, limit)
    .map((w) => ({ id: w.id, title: w.name, subtitle: `${w.code} · ${w.type === 'central' ? 'مركزي' : 'موقع'}`, link: `/warehouses?focus=${w.id}` }));

  const items = (await itemRepository.list())    .filter((i) => hit(i.code) || hit(i.name) || hit(i.category) || hit(i.brand))
    .slice(0, limit)
    .map((i) => ({ id: i.id, title: i.name, subtitle: `${i.code} · ${i.unit}`, link: `/items?focus=${i.id}` }));

  const transactions = (await stockTransactionRepository.list())    .filter((t) => hit(t.number) || hit(t.referenceNumber) || hit(t.type))
    .slice(0, limit)
    .map((t) => ({ id: t.id, title: t.number ?? t.type, subtitle: t.referenceNumber, link: `/stock` }));

  return { projects, documents, warehouses, items, transactions };
};

