import type { Document, DocumentRevision } from '@cos/shared';
import { PgBaseRepository } from './pg-base.repository';
import { pool } from '../database/connection';
import { createId } from '../shared/id';
import { nowIso } from '../shared/time';

export class DocumentRepository extends PgBaseRepository<Document> {
  constructor() {
    super('documents');
  }

  protected mapRowToEntity(row: any): Document {
    return {
      id: row.id,
      projectId: row.project_id,
      siteId: row.site_id,
      ipcId: row.ipc_id,
      title: row.title,
      documentNumber: row.document_number,
      category: row.category,
      documentType: row.document_type,
      fileName: row.file_name,
      fileExtension: row.file_extension,
      fileSize: Number(row.file_size),
      filePath: row.file_path,
      revision: row.revision,
      documentDate: row.document_date ? new Date(row.document_date).toISOString() : undefined,
      uploadedBy: row.uploaded_by,
      status: row.status,
      // Revisions are stored canonically in the document_revisions table and
      // attached by list()/findById()/create()/update() below. The documents
      // .revisions JSONB column is kept as a dual-written mirror only.
      revisions: [],
      notes: row.notes,
      tags: row.tags || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapRevisionRow(r: any): DocumentRevision {
    return {
      id: r.id,
      revision: r.revision,
      fileName: r.file_name,
      fileExtension: r.file_extension,
      fileSize: Number(r.file_size),
      filePath: r.file_path,
      uploadedBy: r.uploaded_by,
      uploadedAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
      notes: r.notes,
    };
  }

  /** Canonical revision history for one document, oldest first. */
  async listRevisions(documentId: string): Promise<DocumentRevision[]> {
    const result = await pool.query(
      `SELECT * FROM document_revisions WHERE document_id = $1 ORDER BY created_at ASC, revision ASC`,
      [documentId]
    );
    return result.rows.map((r) => this.mapRevisionRow(r));
  }

  /** Persist revision rows; idempotent so callers may pass the full history. */
  private async upsertRevisionRows(documentId: string, revisions: DocumentRevision[], now: string) {
    for (const rev of revisions ?? []) {
      await pool.query(
        `INSERT INTO document_revisions
           (id, document_id, revision, file_name, file_extension, file_size,
            file_path, uploaded_by, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (document_id, revision) DO NOTHING`,
        [
          rev.id, documentId, rev.revision, rev.fileName, rev.fileExtension ?? '',
          rev.fileSize ?? 0, rev.filePath, rev.uploadedBy || null, rev.notes || null,
          rev.uploadedAt || now,
        ]
      );
    }
  }

  private async attachRevisions(docs: Document[]): Promise<Document[]> {
    if (!docs.length) return docs;
    const result = await pool.query(
      `SELECT * FROM document_revisions WHERE document_id = ANY($1) ORDER BY created_at ASC, revision ASC`,
      [docs.map((d) => d.id)]
    );
    const byDoc = new Map<string, DocumentRevision[]>();
    for (const row of result.rows) {
      const list = byDoc.get(row.document_id) ?? [];
      list.push(this.mapRevisionRow(row));
      byDoc.set(row.document_id, list);
    }
    return docs.map((d) => ({ ...d, revisions: byDoc.get(d.id) ?? [] }));
  }

  override async list(): Promise<Document[]> {
    const result = await pool.query(`SELECT * FROM documents`);
    return this.attachRevisions(result.rows.map(this.mapRowToEntity.bind(this)));
  }

  override async findById(id: string): Promise<Document | undefined> {
    const result = await pool.query(`SELECT * FROM documents WHERE id = $1`, [id]);
    if (result.rows.length === 0) return undefined;
    const [doc] = await this.attachRevisions([this.mapRowToEntity(result.rows[0])]);
    return doc;
  }

  async create(input: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>): Promise<Document> {
    const id = createId();
    const now = nowIso();
    await pool.query(
      `INSERT INTO documents (
        id, project_id, site_id, ipc_id, title, document_number, category, document_type,
        file_name, file_extension, file_size, file_path, revision, document_date,
        uploaded_by, status, revisions, notes, tags, created_at, updated_at
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
      [
        id, input.projectId || null, input.siteId || null, input.ipcId || null, input.title, input.documentNumber || null,
        input.category, input.documentType ?? '', input.fileName, input.fileExtension ?? '', input.fileSize ?? 0,
        input.filePath, input.revision || '00', input.documentDate || null, input.uploadedBy || null,
        input.status ?? 'draft', JSON.stringify(input.revisions || []), input.notes || null, input.tags || [],
        now, now
      ]
    );
    // Canonical store: revision rows in document_revisions (the revisions
    // JSONB above is kept as a mirror only).
    await this.upsertRevisionRows(id, input.revisions ?? [], now);
    const [doc] = await this.attachRevisions([{ ...input, id, createdAt: now, updatedAt: now }]);
    return doc;
  }

  async update(id: string, input: Partial<Omit<Document, 'id' | 'createdAt'>>): Promise<Document | undefined> {
    const now = nowIso();
    const setClause: string[] = [];
    const params: any[] = [];
    
    if (input.projectId !== undefined) { params.push(input.projectId); setClause.push(`project_id = $${params.length}`); }
    if (input.siteId !== undefined) { params.push(input.siteId); setClause.push(`site_id = $${params.length}`); }
    if (input.ipcId !== undefined) { params.push(input.ipcId); setClause.push(`ipc_id = $${params.length}`); }
    if (input.title !== undefined) { params.push(input.title); setClause.push(`title = $${params.length}`); }
    if (input.documentNumber !== undefined) { params.push(input.documentNumber); setClause.push(`document_number = $${params.length}`); }
    if (input.category !== undefined) { params.push(input.category); setClause.push(`category = $${params.length}`); }
    if (input.documentType !== undefined) { params.push(input.documentType); setClause.push(`document_type = $${params.length}`); }
    if (input.fileName !== undefined) { params.push(input.fileName); setClause.push(`file_name = $${params.length}`); }
    if (input.fileExtension !== undefined) { params.push(input.fileExtension); setClause.push(`file_extension = $${params.length}`); }
    if (input.fileSize !== undefined) { params.push(input.fileSize); setClause.push(`file_size = $${params.length}`); }
    if (input.filePath !== undefined) { params.push(input.filePath); setClause.push(`file_path = $${params.length}`); }
    if (input.revision !== undefined) { params.push(input.revision); setClause.push(`revision = $${params.length}`); }
    if (input.documentDate !== undefined) { params.push(input.documentDate); setClause.push(`document_date = $${params.length}`); }
    if (input.uploadedBy !== undefined) { params.push(input.uploadedBy); setClause.push(`uploaded_by = $${params.length}`); }
    if (input.status !== undefined) { params.push(input.status); setClause.push(`status = $${params.length}`); }
    if (input.revisions !== undefined) { params.push(JSON.stringify(input.revisions)); setClause.push(`revisions = $${params.length}`); }
    if (input.notes !== undefined) { params.push(input.notes); setClause.push(`notes = $${params.length}`); }
    if (input.tags !== undefined) { params.push(input.tags); setClause.push(`tags = $${params.length}`); }
    
    if (setClause.length === 0) return this.findById(id);
    
    params.push(now);
    setClause.push(`updated_at = $${params.length}`);
    params.push(id);
    
    const result = await pool.query(
      `UPDATE documents SET ${setClause.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    
    if (result.rows.length === 0) return undefined;
    // Canonical store: persist any new revision rows (idempotent); the
    // revisions JSONB set above stays as a mirror only.
    if (input.revisions !== undefined) await this.upsertRevisionRows(id, input.revisions, now);
    const [doc] = await this.attachRevisions([this.mapRowToEntity(result.rows[0])]);
    return doc;
  }
}

export const documentRepository = new DocumentRepository();
