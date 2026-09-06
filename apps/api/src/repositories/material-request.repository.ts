import type { MaterialRequest } from '@cos/shared';
import { PgBaseRepository } from './pg-base.repository';
import { pool } from '../database/connection';
import { createId } from '../shared/id';
import { nowIso } from '../shared/time';

export class MaterialRequestRepository extends PgBaseRepository<MaterialRequest> {
  constructor() {
    super('material_requests');
  }

  protected mapRowToEntity(row: any): MaterialRequest {
    return {
      id: row.id,
      number: row.number,
      projectId: row.project_id,
      siteId: row.site_id,
      warehouseId: row.warehouse_id,
      status: row.status,
      items: row.items || [],
      requestedBy: row.requested_by,
      reviewedBy: row.reviewed_by,
      reviewNotes: row.review_notes,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async create(input: Omit<MaterialRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<MaterialRequest> {
    const id = createId();
    const now = nowIso();
    await pool.query(
      `INSERT INTO material_requests (id, number, project_id, site_id, warehouse_id, status, items, requested_by, reviewed_by, review_notes, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [id, input.number, input.projectId || null, input.siteId || null, input.warehouseId, input.status, JSON.stringify(input.items || []), input.requestedBy || null, input.reviewedBy || null, input.reviewNotes || null, input.notes || null, now, now]
    );
    return { ...input, id, createdAt: now, updatedAt: now };
  }

  async update(id: string, input: Partial<Omit<MaterialRequest, 'id' | 'createdAt'>>): Promise<MaterialRequest | undefined> {
    const now = nowIso();
    const setClause: string[] = [];
    const params: any[] = [];
    
    if (input.number !== undefined) { params.push(input.number); setClause.push(`number = $${params.length}`); }
    if (input.projectId !== undefined) { params.push(input.projectId); setClause.push(`project_id = $${params.length}`); }
    if (input.siteId !== undefined) { params.push(input.siteId); setClause.push(`site_id = $${params.length}`); }
    if (input.warehouseId !== undefined) { params.push(input.warehouseId); setClause.push(`warehouse_id = $${params.length}`); }
    if (input.status !== undefined) { params.push(input.status); setClause.push(`status = $${params.length}`); }
    if (input.items !== undefined) { params.push(JSON.stringify(input.items)); setClause.push(`items = $${params.length}`); }
    if (input.requestedBy !== undefined) { params.push(input.requestedBy); setClause.push(`requested_by = $${params.length}`); }
    if (input.reviewedBy !== undefined) { params.push(input.reviewedBy); setClause.push(`reviewed_by = $${params.length}`); }
    if (input.reviewNotes !== undefined) { params.push(input.reviewNotes); setClause.push(`review_notes = $${params.length}`); }
    if (input.notes !== undefined) { params.push(input.notes); setClause.push(`notes = $${params.length}`); }
    
    if (setClause.length === 0) return this.findById(id);
    
    params.push(now);
    setClause.push(`updated_at = $${params.length}`);
    params.push(id);
    
    const result = await pool.query(
      `UPDATE material_requests SET ${setClause.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }
}

export const materialRequestRepository = new MaterialRequestRepository();
