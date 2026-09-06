export const ALL_PERMISSIONS = [
  'archive.view',
  'archive.upload',
  'archive.edit',
  'archive.delete',
  'archive.download',
  'warehouse.view',
  'warehouse.create',
  'warehouse.edit',
  'warehouse.delete',
  'warehouse.stock_in',
  'warehouse.stock_out',
  'warehouse.transfer',
  'warehouse.adjust',
  'warehouse.return',
  'projects.view',
  'projects.create',
  'projects.edit',
  'projects.delete',
  'materialRequests.view',
  'materialRequests.create',
  'materialRequests.approve',
  'materialRequests.issue',
  'reports.view',
  'audit.view',
  'settings.manage',
  'users.manage',
  'backup.manage',
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [...ALL_PERMISSIONS],
  management: [
    'archive.view', 'archive.download',
    'warehouse.view',
    'projects.view', 'projects.create', 'projects.edit',
    'materialRequests.view', 'materialRequests.approve',
    'reports.view', 'audit.view',
  ],
  warehouse: [
    'archive.view', 'archive.download',
    'warehouse.view', 'warehouse.create', 'warehouse.edit',
    'warehouse.stock_in', 'warehouse.stock_out', 'warehouse.transfer', 'warehouse.adjust', 'warehouse.return',
    'projects.view',
    'materialRequests.view', 'materialRequests.issue',
  ],
  technical: [
    'archive.view', 'archive.upload', 'archive.edit', 'archive.download',
    'projects.view',
    'warehouse.view',
    'materialRequests.view', 'materialRequests.create',
  ],
  viewer: [
    'archive.view', 'archive.download',
    'warehouse.view',
    'projects.view',
    'materialRequests.view',
  ],
};

export const permissionOf = (roleName: string): string[] => ROLE_PERMISSIONS[roleName] ?? ROLE_PERMISSIONS.viewer;
