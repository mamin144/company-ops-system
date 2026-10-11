import { join } from 'node:path';
import type { AuditLog } from '@cos/shared';
import { dataDir } from '../shared/paths.js';
import { JsonStore } from '../storage/json-store.js';
import { BaseRepository } from './base.repository.js';

export class AuditLogRepository extends BaseRepository<AuditLog> {
  constructor() {
    super(new JsonStore<AuditLog>(join(dataDir, 'audit_logs.json')));
  }
}

export const auditLogRepository = new AuditLogRepository();
