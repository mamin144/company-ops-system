import type { Ipc, IpcItem, IpcStatusEvent, IpcStatus, IpcDecision } from '@cos/shared';
import type { PoolClient } from 'pg';
import { PgBaseRepository } from './pg-base.repository.js';
import { pool } from '../database/connection.js';
import { createId } from '../shared/id.js';
import { nowIso } from '../shared/time.js';

/** NULL-aware numeric mapping: a NULL column is "not entered", not 0. */
const nullableNumber = (value: unknown): number | undefined =>
  value === null || value === undefined ? undefined : Number(value);

const mapStatusEvent = (row: any): IpcStatusEvent => ({
  id: row.id,
  ipcId: row.ipc_id,
  fromStatus: row.from_status ?? null,
  toStatus: row.to_status,
  actorUserId: row.actor_user_id,
  actorUsername: row.actor_username,
  decision: row.decision ?? null,
  notes: row.notes ?? null,
  createdAt: row.created_at,
});

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
      netAmount: nullableNumber(row.net_amount),
      deductions: nullableNumber(row.deductions),
      grossAmount: nullableNumber(row.gross_amount),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async create(input: Omit<Ipc, 'id' | 'createdAt' | 'updatedAt' | 'netAmount'>): Promise<Ipc> {
    const id = createId();
    const now = nowIso();
    
    await pool.query(
      `INSERT INTO ipcs (id, project_id, ipc_number, date, status, notes, deductions, gross_amount, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, input.projectId, input.ipcNumber, input.date, input.status, input.notes || null, input.deductions ?? null, input.grossAmount ?? null, now, now]
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
    if (input.grossAmount !== undefined) { params.push(input.grossAmount); setClause.push(`gross_amount = $${params.length}`); }
    
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

  // ---------------------------------------------------------------------
  // Phase 14 O4 — IPC approval workflow helpers (transactional).
  // All mutating helpers accept a PoolClient so the caller owns BEGIN/COMMIT.
  // ---------------------------------------------------------------------

  /** Row lock for a concurrency-safe transition. Scoped to the project. */
  async findByIdForUpdate(client: PoolClient, id: string, projectId?: string): Promise<Ipc | undefined> {
    const result = projectId
      ? await client.query(`SELECT * FROM ipcs WHERE id = $1 AND project_id = $2 FOR UPDATE`, [id, projectId])
      : await client.query(`SELECT * FROM ipcs WHERE id = $1 FOR UPDATE`, [id]);
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async setStatus(client: PoolClient, id: string, status: IpcStatus): Promise<Ipc> {
    const result = await client.query(
      `UPDATE ipcs SET status = $1, updated_at = $2 WHERE id = $3 RETURNING *`,
      [status, nowIso(), id],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async appendStatusEvent(
    client: PoolClient,
    input: {
      ipcId: string;
      fromStatus: IpcStatus | null;
      toStatus: IpcStatus;
      actorUserId: string;
      actorUsername: string;
      decision?: IpcDecision | null;
      notes?: string | null;
    },
  ): Promise<IpcStatusEvent> {
    const result = await client.query(
      `INSERT INTO ipc_status_events
         (id, ipc_id, from_status, to_status, actor_user_id, actor_username, decision, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        createId(),
        input.ipcId,
        input.fromStatus,
        input.toStatus,
        input.actorUserId,
        input.actorUsername,
        input.decision ?? null,
        input.notes ?? null,
        nowIso(),
      ],
    );
    return mapStatusEvent(result.rows[0]);
  }

  async listStatusEvents(ipcId: string): Promise<IpcStatusEvent[]> {
    const result = await pool.query(
      `SELECT * FROM ipc_status_events WHERE ipc_id = $1 ORDER BY created_at ASC, id ASC`,
      [ipcId],
    );
    return result.rows.map(mapStatusEvent);
  }

  /**
   * Separation of duties: the actor who submitted (most recently) may not
   * approve or reject their own submission.
   */
  async latestSubmitter(client: PoolClient, ipcId: string): Promise<{ actorUserId: string; actorUsername: string } | undefined> {
    const result = await client.query(
      `SELECT actor_user_id, actor_username
         FROM ipc_status_events
        WHERE ipc_id = $1 AND to_status = 'submitted'
        ORDER BY created_at DESC, id DESC
        LIMIT 1`,
      [ipcId],
    );
    if (result.rows.length === 0) return undefined;
    return { actorUserId: result.rows[0].actor_user_id, actorUsername: result.rows[0].actor_username };
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
