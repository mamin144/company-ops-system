import type { AppNotification, NotificationType } from '@cos/shared';
import { createId } from '../shared/id';
import { nowIso } from '../shared/time';
import { notificationRepository } from '../repositories/notification.repository';

const MAX_NOTIFICATIONS = 2000;

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  entityId?: string;
  /** dedupe key: skip if an unread notification with same type+entity exists */
  dedupe?: boolean;
}

export class NotificationService {
  async create(input: CreateNotificationInput) {
    const { pool } = await import('../database/connection.js');
    
    if (input.dedupe && input.entityId) {
      const exists = await pool.query(
        `SELECT id FROM notifications WHERE type = $1 AND entity_id = $2 AND array_length(read_by, 1) IS NULL`,
        [input.type, input.entityId]
      );
      if (exists.rows.length > 0) return undefined;
    }
    
    const id = createId();
    await pool.query(
      `INSERT INTO notifications (id, type, title, message, link, entity_id, read_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, '{}', $7)`,
      [id, input.type, input.title, input.message, input.link, input.entityId, nowIso()]
    );
    
    return {
      id,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link,
      entityId: input.entityId,
      readBy: [],
      createdAt: nowIso()
    };
  }

  async list() {
    const { pool } = await import('../database/connection.js');
    const result = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100');
    return result.rows.map((row: any) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      link: row.link,
      entityId: row.entity_id,
      readBy: row.read_by || [],
      createdAt: row.created_at
    }));
  }

  async markRead(id: string, username: string) {
    const { pool } = await import('../database/connection.js');
    await pool.query(
      `UPDATE notifications SET read_by = array_append(read_by, $1) WHERE id = $2 AND NOT ($1 = ANY(read_by))`,
      [username, id]
    );
  }

  async markAllRead(username: string) {
    const { pool } = await import('../database/connection.js');
    await pool.query(
      `UPDATE notifications SET read_by = array_append(read_by, $1) WHERE NOT ($1 = ANY(read_by))`
    );
  }
}

export const notificationService = new NotificationService();
