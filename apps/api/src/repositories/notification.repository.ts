import { join } from 'node:path';
import type { AppNotification } from '@cos/shared';
import { dataDir } from '../shared/paths.js';
import { JsonStore } from '../storage/json-store.js';
import { BaseRepository } from './base.repository.js';

export class NotificationRepository extends BaseRepository<AppNotification> {
  constructor() {
    super(new JsonStore<AppNotification>(join(dataDir, 'notifications.json')));
  }
}

export const notificationRepository = new NotificationRepository();
