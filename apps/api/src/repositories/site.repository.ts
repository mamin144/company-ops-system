import type { Site } from '@cos/shared';
import { PgBaseRepository } from './pg-base.repository';
import { pool } from '../database/connection';
import { createId } from '../shared/id';
import { nowIso } from '../shared/time';

export class SiteRepository extends PgBaseRepository<Site> {
  constructor() {
    super('sites');
  }

  protected mapRowToEntity(row: any): Site {
    return {
      id: row.id,
      projectId: row.project_id,
      code: row.code,
      name: row.name,
      location: row.location,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async create(input: Omit<Site, 'id' | 'createdAt' | 'updatedAt'>): Promise<Site> {
    const id = createId();
    const now = nowIso();
    await pool.query(
      `INSERT INTO sites (id, project_id, code, name, location, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, input.projectId, input.code, input.name, input.location || null, input.notes || null, now, now]
    );
    return { ...input, id, createdAt: now, updatedAt: now };
  }

  async update(id: string, input: Partial<Omit<Site, 'id' | 'createdAt'>>): Promise<Site | undefined> {
    const now = nowIso();
    const setClause: string[] = [];
    const params: any[] = [];
    
    if (input.projectId !== undefined) { params.push(input.projectId); setClause.push(`project_id = $${params.length}`); }
    if (input.code !== undefined) { params.push(input.code); setClause.push(`code = $${params.length}`); }
    if (input.name !== undefined) { params.push(input.name); setClause.push(`name = $${params.length}`); }
    if (input.location !== undefined) { params.push(input.location); setClause.push(`location = $${params.length}`); }
    if (input.notes !== undefined) { params.push(input.notes); setClause.push(`notes = $${params.length}`); }
    
    if (setClause.length === 0) return this.findById(id);
    
    params.push(now);
    setClause.push(`updated_at = $${params.length}`);
    params.push(id);
    
    const result = await pool.query(
      `UPDATE sites SET ${setClause.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }
}

export const siteRepository = new SiteRepository();
