import type { BoqItem } from '@cos/shared';
import { PgBaseRepository } from './pg-base.repository';
import { pool } from '../database/connection';
import { createId } from '../shared/id';
import { nowIso } from '../shared/time';

export class BoqRepository extends PgBaseRepository<BoqItem> {
  constructor() {
    super('boq_items');
  }

  protected mapRowToEntity(row: any): BoqItem {
    return {
      id: row.id,
      projectId: row.project_id,
      itemCode: row.item_code,
      description: row.description,
      unit: row.unit,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
      totalPrice: Number(row.total_price),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async create(input: Omit<BoqItem, 'id' | 'createdAt' | 'updatedAt' | 'totalPrice'>): Promise<BoqItem> {
    const id = createId();
    const now = nowIso();
    const totalPrice = input.quantity * input.unitPrice;
    
    await pool.query(
      `INSERT INTO boq_items (id, project_id, item_code, description, unit, quantity, unit_price, total_price, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, input.projectId, input.itemCode, input.description, input.unit, input.quantity, input.unitPrice, totalPrice, now, now]
    );
    return { ...input, id, totalPrice, createdAt: now, updatedAt: now };
  }

  async update(id: string, input: Partial<Omit<BoqItem, 'id' | 'createdAt' | 'projectId'>>): Promise<BoqItem | undefined> {
    const now = nowIso();
    
    // get existing to calc total price
    const existing = await this.findById(id);
    if (!existing) return undefined;
    
    const quantity = input.quantity !== undefined ? input.quantity : existing.quantity;
    const unitPrice = input.unitPrice !== undefined ? input.unitPrice : existing.unitPrice;
    const totalPrice = quantity * unitPrice;
    
    const setClause: string[] = [];
    const params: any[] = [];
    
    if (input.itemCode !== undefined) { params.push(input.itemCode); setClause.push(`item_code = $${params.length}`); }
    if (input.description !== undefined) { params.push(input.description); setClause.push(`description = $${params.length}`); }
    if (input.unit !== undefined) { params.push(input.unit); setClause.push(`unit = $${params.length}`); }
    if (input.quantity !== undefined) { params.push(input.quantity); setClause.push(`quantity = $${params.length}`); }
    if (input.unitPrice !== undefined) { params.push(input.unitPrice); setClause.push(`unit_price = $${params.length}`); }
    
    params.push(totalPrice); setClause.push(`total_price = $${params.length}`);
    params.push(now); setClause.push(`updated_at = $${params.length}`);
    
    params.push(id);
    
    const result = await pool.query(
      `UPDATE boq_items SET ${setClause.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }
}

export const boqRepository = new BoqRepository();
