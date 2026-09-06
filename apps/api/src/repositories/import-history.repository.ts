import type { ImportHistoryEntry } from '@cos/shared';
import { PgBaseRepository } from './pg-base.repository';
import { pool } from '../database/connection';
import { createId } from '../shared/id';
import { nowIso } from '../shared/time';

export class ImportHistoryRepository extends PgBaseRepository<ImportHistoryEntry> {
  constructor() {
    super('import_history');
  }

  protected mapRowToEntity(row: any): ImportHistoryEntry {
    return {
      id: row.id,
      entity: row.entity,
      fileName: row.file_name,
      userId: row.user_id,
      username: row.username,
      date: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      totalRows: Number(row.total_rows ?? 0),
      successfulRows: Number(row.successful_rows ?? 0),
      failedRows: Number(row.failed_rows ?? 0),
      errors: row.errors || [],
    };
  }

  async create(input: Omit<ImportHistoryEntry, 'id'>): Promise<ImportHistoryEntry> {
    const id = createId();
    const date = input.date || nowIso();
    await pool.query(
      `INSERT INTO import_history
         (id, entity, file_name, user_id, username, total_rows,
          successful_rows, failed_rows, errors, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id, input.entity, input.fileName, input.userId || null, input.username || null,
        input.totalRows ?? 0, input.successfulRows ?? 0, input.failedRows ?? 0,
        input.errors || [], date,
      ]
    );
    return { ...input, id, date };
  }
}

export const importHistoryRepository = new ImportHistoryRepository();
