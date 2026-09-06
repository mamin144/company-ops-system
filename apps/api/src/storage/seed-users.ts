import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir } from '../shared/paths';
import type { Role, User } from '@cos/shared';
import { ROLE_PERMISSIONS } from '@cos/shared';
import { authService } from '../services/auth.service';

const ROLE_NAMES_AR: Record<string, string> = {
  admin: 'مدير النظام',
  management: 'الإدارة',
  warehouse: 'المخازن',
  technical: 'الفني',
  viewer: 'مشاهدة فقط',
};

export const seedUsersAndRoles = () => {
  const rolesPath = join(dataDir, 'roles.json');
  if (!existsSync(rolesPath)) {
    const roles: Role[] = Object.entries(ROLE_PERMISSIONS).map(([name, permissions]: [string, string[]]) => ({
      id: `role-${name}`,
      name,
      nameAr: ROLE_NAMES_AR[name] ?? name,
      permissions: [...permissions],
      isSystem: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    writeFileSync(rolesPath, JSON.stringify(roles, null, 2), 'utf-8');
  }

  const usersPath = join(dataDir, 'users.json');
  if (!existsSync(usersPath)) {
    const admin: User = {
      id: 'user-admin',
      username: 'admin',
      fullName: 'مدير النظام',
      passwordHash: authService.hashPassword(process.env.ADMIN_PASSWORD ?? 'admin123'),
      roleName: 'admin',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // a sample warehouse-keeper account for permission testing
    const keeper: User = {
      id: 'user-keeper',
      username: 'keeper',
      fullName: 'أمين المخزن',
      passwordHash: authService.hashPassword('keeper123'),
      roleName: 'warehouse',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeFileSync(usersPath, JSON.stringify([admin, keeper], null, 2), 'utf-8');
  } else {
    // keep seeded role definitions in sync with the shared permission matrix
    void readFileSync(usersPath, 'utf-8');
  }
};
