import { JsonStore } from '../storage/json-store';
import { createId } from '../shared/id';
import { nowIso } from '../shared/time';

export interface EntityWithAudit {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export abstract class BaseRepository<T extends { id: string }> {
  constructor(protected readonly store: JsonStore<T>) {}

  list(): T[] {
    return this.store.read();
  }

  /** Replace the full collection (used by audit/notification bounded writes). */
  writeAll(items: T[]): T[] {
    this.store.write(items);
    return items;
  }

  findById(id: string): T | undefined {
    return this.list().find((item) => item.id === id);
  }

  create(input: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): T {
    const item = { ...input, id: createId(), createdAt: nowIso(), updatedAt: nowIso() } as unknown as T;
    this.store.write([...this.list(), item]);
    return item;
  }

  update(id: string, input: Partial<Omit<T, 'id' | 'createdAt'>>): T | undefined {
    const items = this.list();
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return undefined;
    const updated = { ...items[index], ...input, updatedAt: nowIso() } as T;
    items[index] = updated;
    this.store.write(items);
    return updated;
  }

  delete(id: string): boolean {
    const next = this.list().filter((item) => item.id !== id);
    if (next.length === this.list().length) return false;
    this.store.write(next);
    return true;
  }
}
