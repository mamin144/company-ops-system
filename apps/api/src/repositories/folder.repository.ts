import type { Folder } from '@cos/shared';
import { PgBaseRepository } from './pg-base.repository';
import { pool } from '../database/connection';
import { createId } from '../shared/id';

export class FolderRepository extends PgBaseRepository<Folder> {
  constructor() {
    super('folders');
  }

  protected mapRowToEntity(row: any): Folder {
    return {
      id: row.id,
      parentId: row.parent_id,
      name: row.name,
      color: row.color,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async createFolder(input: Partial<Folder>): Promise<Folder> {
    const id = input.id ?? createId();
    const result = await pool.query(
      `INSERT INTO folders (id, parent_id, name, color, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, input.parentId || null, input.name, input.color || null, input.createdBy || null]
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateFolder(id: string, input: Partial<Folder>): Promise<Folder | undefined> {
    const result = await pool.query(
      `UPDATE folders SET name = COALESCE($1, name), parent_id = COALESCE($2, parent_id), color = COALESCE($3, color), updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [input.name || null, input.parentId || null, input.color || null, id]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }
}

export const folderRepository = new FolderRepository();
