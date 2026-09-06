import type { Item } from '@cos/shared';
import { PgBaseRepository } from './pg-base.repository';
import { pool } from '../database/connection';
import { createId } from '../shared/id';
import { nowIso } from '../shared/time';

export class ItemRepository extends PgBaseRepository<Item> {
  constructor() {
    super('items');
  }

  protected mapRowToEntity(row: any): Item {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      category: row.category,
      unit: row.unit,
      brand: row.brand,
      minimumStock: row.minimum_stock !== null ? Number(row.minimum_stock) : undefined,
      trackingType: row.tracking_type,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async create(input: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>): Promise<Item> {
    const id = createId();
    const now = nowIso();
    await pool.query(
      `INSERT INTO items (id, code, name, category, unit, brand, minimum_stock, tracking_type, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, input.code, input.name, input.category, input.unit, input.brand || null, input.minimumStock || null, input.trackingType || 'none', input.notes || null, now, now]
    );
    return { ...input, id, createdAt: now, updatedAt: now };
  }

  async update(id: string, input: Partial<Omit<Item, 'id' | 'createdAt'>>): Promise<Item | undefined> {
    const now = nowIso();
    const setClause: string[] = [];
    const params: any[] = [];
    
    if (input.code !== undefined) { params.push(input.code); setClause.push(`code = $${params.length}`); }
    if (input.name !== undefined) { params.push(input.name); setClause.push(`name = $${params.length}`); }
    if (input.category !== undefined) { params.push(input.category); setClause.push(`category = $${params.length}`); }
    if (input.unit !== undefined) { params.push(input.unit); setClause.push(`unit = $${params.length}`); }
    if (input.brand !== undefined) { params.push(input.brand); setClause.push(`brand = $${params.length}`); }
    if (input.minimumStock !== undefined) { params.push(input.minimumStock); setClause.push(`minimum_stock = $${params.length}`); }
    if (input.trackingType !== undefined) { params.push(input.trackingType); setClause.push(`tracking_type = $${params.length}`); }
    if (input.notes !== undefined) { params.push(input.notes); setClause.push(`notes = $${params.length}`); }
    
    if (setClause.length === 0) return this.findById(id);
    
    params.push(now);
    setClause.push(`updated_at = $${params.length}`);
    params.push(id);
    
    const result = await pool.query(
      `UPDATE items SET ${setClause.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }
}

export const itemRepository = new ItemRepository();
