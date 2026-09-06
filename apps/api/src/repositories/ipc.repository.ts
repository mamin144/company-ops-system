import type { Ipc, IpcItem } from '@cos/shared';
import { PgBaseRepository } from './pg-base.repository';
import { pool } from '../database/connection';
import { createId } from '../shared/id';
import { nowIso } from '../shared/time';

export class IpcRepository extends PgBaseRepository<Ipc> {
  constructor() {
    super('ipcs');
  }

  protected mapRowToEntity(row: any): Ipc {
    return {
      id: row.id,
      projectId: row.project_id,
      ipcNumber: row.ipc_number,
      date: row.date ? new Date(row.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      status: row.status,
      notes: row.notes,
      netAmount: Number(row.net_amount || 0),
      deductions: Number(row.deductions || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async create(input: Omit<Ipc, 'id' | 'createdAt' | 'updatedAt' | 'netAmount'>): Promise<Ipc> {
    const id = createId();
    const now = nowIso();
    
    await pool.query(
      `INSERT INTO ipcs (id, project_id, ipc_number, date, status, notes, deductions, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, input.projectId, input.ipcNumber, input.date, input.status, input.notes || null, input.deductions || 0, now, now]
    );
    return { ...input, id, netAmount: 0, createdAt: now, updatedAt: now };
  }

  async update(id: string, input: Partial<Omit<Ipc, 'id' | 'createdAt' | 'projectId'>>): Promise<Ipc | undefined> {
    const now = nowIso();
    const setClause: string[] = [];
    const params: any[] = [];
    
    if (input.ipcNumber !== undefined) { params.push(input.ipcNumber); setClause.push(`ipc_number = $${params.length}`); }
    if (input.date !== undefined) { params.push(input.date); setClause.push(`date = $${params.length}`); }
    if (input.status !== undefined) { params.push(input.status); setClause.push(`status = $${params.length}`); }
    if (input.notes !== undefined) { params.push(input.notes); setClause.push(`notes = $${params.length}`); }
    if (input.netAmount !== undefined) { params.push(input.netAmount); setClause.push(`net_amount = $${params.length}`); }
    if (input.deductions !== undefined) { params.push(input.deductions); setClause.push(`deductions = $${params.length}`); }
    
    if (setClause.length === 0) return this.findById(id);
    
    params.push(now);
    setClause.push(`updated_at = $${params.length}`);
    params.push(id);
    
    const result = await pool.query(
      `UPDATE ipcs SET ${setClause.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }
}

export class IpcItemRepository extends PgBaseRepository<IpcItem> {
  constructor() {
    super('ipc_items');
  }

  protected mapRowToEntity(row: any): IpcItem {
    return {
      id: row.id,
      ipcId: row.ipc_id,
      boqItemId: row.boq_item_id,
      previousQuantity: Number(row.previous_quantity),
      currentQuantity: Number(row.current_quantity),
      totalQuantity: Number(row.total_quantity),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async getByIpcId(ipcId: string): Promise<IpcItem[]> {
    const result = await pool.query('SELECT * FROM ipc_items WHERE ipc_id = $1', [ipcId]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async existsForBoqItem(boqItemId: string): Promise<boolean> {
    const result = await pool.query('SELECT 1 FROM ipc_items WHERE boq_item_id = $1 LIMIT 1', [boqItemId]);
    return result.rows.length > 0;
  }

  async upsert(input: Omit<IpcItem, 'id' | 'createdAt' | 'updatedAt' | 'totalQuantity'>): Promise<IpcItem> {
    const id = createId();
    const now = nowIso();
    const totalQuantity = input.previousQuantity + input.currentQuantity;
    
    const result = await pool.query(
      `INSERT INTO ipc_items (id, ipc_id, boq_item_id, previous_quantity, current_quantity, total_quantity, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (ipc_id, boq_item_id) DO UPDATE SET
         previous_quantity = EXCLUDED.previous_quantity,
         current_quantity = EXCLUDED.current_quantity,
         total_quantity = EXCLUDED.total_quantity,
         updated_at = EXCLUDED.updated_at
       RETURNING *`,
      [id, input.ipcId, input.boqItemId, input.previousQuantity, input.currentQuantity, totalQuantity, now, now]
    );
    return this.mapRowToEntity(result.rows[0]);
  }
}

export const ipcRepository = new IpcRepository();
export const ipcItemRepository = new IpcItemRepository();
