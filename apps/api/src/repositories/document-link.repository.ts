import type { DocumentLink } from '@cos/shared';
import { PgBaseRepository } from './pg-base.repository';
import { pool } from '../database/connection';

export class DocumentLinkRepository extends PgBaseRepository<DocumentLink> {
  constructor() {
    super('document_links');
  }

  protected mapRowToEntity(row: any): DocumentLink {
    return {
      id: row.id,
      documentId: row.document_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      createdAt: row.created_at,
    };
  }

  async link(documentId: string, entityType: string, entityId: string): Promise<DocumentLink> {
    const result = await pool.query(
      `INSERT INTO document_links (document_id, entity_type, entity_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (document_id, entity_type, entity_id) DO NOTHING
       RETURNING *`,
      [documentId, entityType, entityId]
    );
    if (result.rows.length === 0) {
      // It was a conflict, find the existing
      const existing = await pool.query(
        `SELECT * FROM document_links WHERE document_id = $1 AND entity_type = $2 AND entity_id = $3`,
        [documentId, entityType, entityId]
      );
      return this.mapRowToEntity(existing.rows[0]);
    }
    return this.mapRowToEntity(result.rows[0]);
  }
}

export const documentLinkRepository = new DocumentLinkRepository();
