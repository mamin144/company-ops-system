import type { Pool, PoolClient } from 'pg';
import { pool } from '../database/connection';
import { createId } from '../shared/id';
import { nowIso } from '../shared/time';

export abstract class PgBaseRepository<T extends { id: string }> {
  constructor(protected readonly tableName: string) {}

  protected mapRowToEntity(row: any): T {
    // Override this in child classes to map snake_case to camelCase
    return row as T;
  }

  protected mapEntityToRow(entity: Partial<T>): any {
    // Override this in child classes to map camelCase to snake_case
    return entity;
  }

  async list(): Promise<T[]> {
    const result = await pool.query(`SELECT * FROM ${this.tableName}`);
    return result.rows.map(this.mapRowToEntity.bind(this));
  }

  async findById(id: string): Promise<T | undefined> {
    const result = await pool.query(`SELECT * FROM ${this.tableName} WHERE id = $1`, [id]);
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Delete by id. Accepts an optional transaction client so multi-step
   * deletions (e.g. project cascade) can run atomically; defaults to the
   * shared pool so all existing callers are unaffected.
   */
  async delete(id: string, client: Pool | PoolClient = pool): Promise<boolean> {
    const result = await client.query(`DELETE FROM ${this.tableName} WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
