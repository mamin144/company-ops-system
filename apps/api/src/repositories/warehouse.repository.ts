import type { Warehouse } from '@cos/shared';
import { PgBaseRepository } from './pg-base.repository';
import { pool } from '../database/connection';
import { createId } from '../shared/id';
import { nowIso } from '../shared/time';

export class WarehouseRepository extends PgBaseRepository<Warehouse> {
  constructor() {
    super('warehouses');
  }

  protected mapRowToEntity(row: any): Warehouse {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type,
      projectId: row.project_id,
      location: row.location,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async create(input: Omit<Warehouse, 'id' | 'createdAt' | 'updatedAt'>): Promise<Warehouse> {
    const id = createId();
    const now = nowIso();
    await pool.query(
      `INSERT INTO warehouses (id, code, name, type, project_id, location, status, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, input.code, input.name, input.type, input.projectId || null, input.location || null, input.status, input.notes || null, now, now]
    );
    return { ...input, id, createdAt: now, updatedAt: now };
  }

  async update(id: string, input: Partial<Omit<Warehouse, 'id' | 'createdAt'>>): Promise<Warehouse | undefined> {
    const now = nowIso();
    const setClause: string[] = [];
    const params: any[] = [];
    
    if (input.code !== undefined) { params.push(input.code); setClause.push(`code = $${params.length}`); }
    if (input.name !== undefined) { params.push(input.name); setClause.push(`name = $${params.length}`); }
    if (input.type !== undefined) { params.push(input.type); setClause.push(`type = $${params.length}`); }
    if (input.projectId !== undefined) { params.push(input.projectId); setClause.push(`project_id = $${params.length}`); }
    if (input.location !== undefined) { params.push(input.location); setClause.push(`location = $${params.length}`); }
    if (input.status !== undefined) { params.push(input.status); setClause.push(`status = $${params.length}`); }
    if (input.notes !== undefined) { params.push(input.notes); setClause.push(`notes = $${params.length}`); }
    
    if (setClause.length === 0) return this.findById(id);
    
    params.push(now);
    setClause.push(`updated_at = $${params.length}`);
    params.push(id);
    
    const result = await pool.query(
      `UPDATE warehouses SET ${setClause.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }
}

export const warehouseRepository = new WarehouseRepository();
