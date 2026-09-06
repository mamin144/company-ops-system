import type { StockTransaction } from '@cos/shared';
import { PgBaseRepository } from './pg-base.repository';
import { pool } from '../database/connection';
import { createId } from '../shared/id';
import { nowIso } from '../shared/time';

export class StockTransactionRepository extends PgBaseRepository<StockTransaction> {
  constructor() {
    super('stock_transactions');
  }

  protected mapRowToEntity(row: any): StockTransaction {
    return {
      id: row.id,
      number: row.number,
      type: row.type,
      warehouseId: row.warehouse_id,
      destinationWarehouseId: row.destination_warehouse_id,
      projectId: row.project_id,
      items: row.items || [],
      referenceNumber: row.reference_number,
      date: row.date ? new Date(row.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async create(input: Omit<StockTransaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<StockTransaction> {
    const id = createId();
    const now = nowIso();
    await pool.query(
      `INSERT INTO stock_transactions (id, number, type, warehouse_id, destination_warehouse_id, project_id, items, reference_number, date, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, input.number || null, input.type, input.warehouseId, input.destinationWarehouseId || null, input.projectId || null, JSON.stringify(input.items || []), input.referenceNumber || null, input.date || nowIso(), input.notes || null, now, now]
    );
    return { ...input, id, createdAt: now, updatedAt: now };
  }

  async update(id: string, input: Partial<Omit<StockTransaction, 'id' | 'createdAt'>>): Promise<StockTransaction | undefined> {
    const now = nowIso();
    const setClause: string[] = [];
    const params: any[] = [];
    
    if (input.number !== undefined) { params.push(input.number); setClause.push(`number = $${params.length}`); }
    if (input.type !== undefined) { params.push(input.type); setClause.push(`type = $${params.length}`); }
    if (input.warehouseId !== undefined) { params.push(input.warehouseId); setClause.push(`warehouse_id = $${params.length}`); }
    if (input.destinationWarehouseId !== undefined) { params.push(input.destinationWarehouseId); setClause.push(`destination_warehouse_id = $${params.length}`); }
    if (input.projectId !== undefined) { params.push(input.projectId); setClause.push(`project_id = $${params.length}`); }
    if (input.items !== undefined) { params.push(JSON.stringify(input.items)); setClause.push(`items = $${params.length}`); }
    if (input.referenceNumber !== undefined) { params.push(input.referenceNumber); setClause.push(`reference_number = $${params.length}`); }
    if (input.date !== undefined) { params.push(input.date); setClause.push(`date = $${params.length}`); }
    if (input.notes !== undefined) { params.push(input.notes); setClause.push(`notes = $${params.length}`); }
    
    if (setClause.length === 0) return this.findById(id);
    
    params.push(now);
    setClause.push(`updated_at = $${params.length}`);
    params.push(id);
    
    const result = await pool.query(
      `UPDATE stock_transactions SET ${setClause.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }
}

export const stockTransactionRepository = new StockTransactionRepository();
