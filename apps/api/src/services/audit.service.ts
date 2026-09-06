import type { Request } from 'express';
import type { AuditLog } from '@cos/shared';
import { createId } from '../shared/id';
import { nowIso } from '../shared/time';
import { auditLogRepository } from '../repositories/audit-log.repository';
import type { AuthedRequest } from '../middleware/auth';

const MAX_LOGS = 5000;

export class AuditService {
  async log(
    req: Request | AuthedRequest,
    action: string,
    entity: string,
    entityId?: string,
    oldValue?: unknown,
    newValue?: unknown,
  ) {
    const user = (req as AuthedRequest).user;
    const entry = {
      id: createId(),
      userId: user?.id || null,
      username: user?.username ?? 'anonymous',
      action,
      entity,
      entityId: entityId || null,
      oldValue: this.sanitize(oldValue),
      newValue: this.sanitize(newValue),
      timestamp: nowIso(),
      ipAddress: req.ip || null,
    };
    
    // In PostgreSQL, we just INSERT. We don't need to read all and write all.
    const { pool } = await import('../database/connection.js');
    await pool.query(
      `INSERT INTO audit_logs (id, user_id, username, action, entity, entity_id, old_value, new_value, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [entry.id, entry.userId, entry.username, entry.action, entry.entity, entry.entityId, entry.oldValue ? JSON.stringify(entry.oldValue) : null, entry.newValue ? JSON.stringify(entry.newValue) : null, entry.ipAddress, entry.timestamp]
    );
  }

  /** Never store passwords or auth secrets in the audit trail. */
  private sanitize(value: unknown) {
    if (value && typeof value === 'object') {
      const clone = { ...(value as Record<string, unknown>) };
      delete clone.passwordHash;
      delete clone.password;
      delete clone.token;
      return clone;
    }
    return value;
  }

  async list(filters: { entity?: string, action?: string, q?: string, page?: number, pageSize?: number }) {
    const { pool } = await import('../database/connection.js');
    
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];
    
    if (filters.entity) {
      params.push(filters.entity);
      query += ` AND entity = $${params.length}`;
    }
    
    if (filters.action) {
      params.push(filters.action);
      query += ` AND action = $${params.length}`;
    }
    
    if (filters.q) {
      params.push(`%${filters.q}%`);
      query += ` AND (username ILIKE $${params.length} OR action ILIKE $${params.length} OR entity ILIKE $${params.length} OR entity_id ILIKE $${params.length})`;
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, params);
    const logs = result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      username: row.username,
      action: row.action,
      entity: row.entity,
      entityId: row.entity_id,
      oldValue: row.old_value,
      newValue: row.new_value,
      timestamp: row.created_at,
      ipAddress: row.ip_address
    }));
    
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(200, Math.max(1, filters.pageSize || 25));
    
    return {
      items: logs.slice((page - 1) * pageSize, page * pageSize),
      total: logs.length,
      page,
      pageSize
    };
  }
}

export const auditService = new AuditService();
