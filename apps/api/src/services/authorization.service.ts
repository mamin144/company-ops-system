/**
 * Phase 2 — central authorization resolver (Option A blueprint).
 *
 * THE single place permission decisions are made. Controllers must call
 * can()/effective(), never inline role/override/project logic.
 *
 * Data sources (server-side DB only — never client claims):
 *   roles.permissions (TEXT[]), user_permission_overrides, project_members.
 *
 * Precedence (deterministic):
 *   role base -> DENY override (beats GRANT) -> GRANT override
 *   -> project-access narrowing (scoped CRUD only; never broadens)
 *   -> global safety (active user, known key).
 */
import { pool } from '../database/connection';
import { ALL_PERMISSIONS } from '@cos/shared';

/** Stable vocabulary (28) + the 3 administration keys. Unknown keys deny. */
export const MANAGED_PERMISSIONS: readonly string[] = [
  ...ALL_PERMISSIONS,
  'roles.manage',
  'projects.access',
  'users.resetPassword',
];

export type AccessLevel = 'NONE' | 'READ' | 'WRITE' | 'DELETE';
export type OverrideEffect = 'grant' | 'deny';

export interface PermissionOverride {
  permissionKey: string;
  effect: OverrideEffect;
}

export interface ProjectMembership {
  projectId: string;
  access: AccessLevel;
}

export interface AuthzContext {
  userId: string;
  username: string;
  isActive: boolean;
  roleName: string;
  rolePermissions: string[];
  overrides: PermissionOverride[];
  memberships: ProjectMembership[];
}

/**
 * Project-scoped keys and the minimum membership level each requires.
 * Every other managed key is global-only (approve, issue, export/download
 * of bulk data, stock operations, user/role administration, ...).
 * `archive.download` follows `view`: consuming an allowed row.
 */
const SCOPED_MIN_LEVEL: Record<string, AccessLevel> = {
  'archive.view': 'READ',
  'archive.download': 'READ',
  'archive.upload': 'WRITE',
  'archive.edit': 'WRITE',
  'archive.delete': 'DELETE',
  'projects.view': 'READ',
  'projects.create': 'WRITE',
  'projects.edit': 'WRITE',
  'projects.delete': 'DELETE',
  'warehouse.view': 'READ',
  'warehouse.create': 'WRITE',
  'warehouse.edit': 'WRITE',
  'warehouse.delete': 'DELETE',
  'materialRequests.view': 'READ',
  'materialRequests.create': 'WRITE',
};

const RANK: Record<AccessLevel, number> = { NONE: 0, READ: 1, WRITE: 2, DELETE: 3 };

const isKnownKey = (key: string): boolean => MANAGED_PERMISSIONS.includes(key);

/** Global layer only: role base + overrides. No project logic here. */
const globalAllow = (ctx: AuthzContext, key: string): boolean => {
  if (!isKnownKey(key)) return false;
  const matches = ctx.overrides.filter((o) => o.permissionKey === key);
  if (matches.some((o) => o.effect === 'deny')) return false; // DENY beats GRANT, order-independent
  if (matches.some((o) => o.effect === 'grant')) return true;
  return ctx.rolePermissions.includes(key);
};

/**
 * Batched context load: user+role in one JOIN, overrides + memberships in
 * two indexed selects. No N+1. Returns null for unknown users (fail closed).
 */
export const loadContext = async (userId: string): Promise<AuthzContext | null> => {
  const u = await pool.query(
    `SELECT u.id, u.username, u.is_active, u.role_name,
            COALESCE(r.permissions, '{}') AS permissions
     FROM users u LEFT JOIN roles r ON r.name = u.role_name
     WHERE u.id = $1`,
    [userId],
  );
  if (u.rows.length === 0) return null;
  const row = u.rows[0];
  const [o, m] = await Promise.all([
    pool.query(`SELECT permission_key, effect FROM user_permission_overrides WHERE user_id = $1`, [userId]),
    pool.query(`SELECT project_id, access FROM project_members WHERE user_id = $1`, [userId]),
  ]);
  return {
    userId: row.id,
    username: row.username,
    isActive: row.is_active === true,
    roleName: row.role_name,
    rolePermissions: (row.permissions ?? []) as string[],
    overrides: o.rows.map((r: { permission_key: string; effect: OverrideEffect }) => ({
      permissionKey: r.permission_key,
      effect: r.effect,
    })),
    memberships: m.rows.map((r: { project_id: string; access: AccessLevel }) => ({
      projectId: r.project_id,
      access: r.access,
    })),
  };
};

/**
 * Authoritative decision. Null/inactive context denies everything.
 * Without a projectId the global decision is returned (unscoped use:
 * global pages, aggregate endpoints, capability probes).
 */
export const can = (
  ctx: AuthzContext | null,
  key: string,
  projectId?: string | null,
): boolean => {
  if (!ctx || !ctx.isActive) return false;
  const base = globalAllow(ctx, key);
  const min = SCOPED_MIN_LEVEL[key];
  if (!min || !projectId) return base;
  // Ratified superuser rule: projects.access holders administer access
  // itself, so narrowing is skipped for them (global decision stands).
  // This never grants: a missing global base stays missing.
  if (globalAllow(ctx, 'projects.access')) return base;
  const level = ctx.memberships.find((x) => x.projectId === projectId)?.access ?? 'NONE';
  return base && RANK[level] >= RANK[min];
};

/** Full decision map for the Admin UI inspector (same function as enforcement). */
export const effective = (
  ctx: AuthzContext | null,
  projectId?: string | null,
): { role: string | null; permissions: Record<string, boolean>; overrides: PermissionOverride[]; memberships: ProjectMembership[] } => {
  const permissions: Record<string, boolean> = {};
  for (const k of MANAGED_PERMISSIONS) permissions[k] = can(ctx, k, projectId);
  return {
    role: ctx?.roleName ?? null,
    permissions,
    overrides: ctx?.overrides ?? [],
    memberships: ctx?.memberships ?? [],
  };
};

/** Coverage = effective users.manage AND roles.manage (the two system-control keys). */
export const isAdminCapable = (ctx: AuthzContext | null): boolean =>
  !!ctx && ctx.isActive && can(ctx, 'users.manage') && can(ctx, 'roles.manage');

/**
 * Counts coverage across ALL active users in 2 bulk queries (no per-user
 * fan-out). Used by last-admin guards in Phase 6.
 */
export const countAdminCapable = async (): Promise<number> => {  const u = await pool.query(
    `SELECT u.id, COALESCE(r.permissions, '{}') AS permissions
     FROM users u LEFT JOIN roles r ON r.name = u.role_name
     WHERE u.is_active`,
  );
  const o = await pool.query(`SELECT user_id, permission_key, effect FROM user_permission_overrides`);
  const byUser = new Map<string, PermissionOverride[]>();
  for (const r of o.rows as Array<{ user_id: string; permission_key: string; effect: OverrideEffect }>) {
    const list = byUser.get(r.user_id) ?? [];
    list.push({ permissionKey: r.permission_key, effect: r.effect });
    byUser.set(r.user_id, list);
  }
  let n = 0;
  for (const row of u.rows as Array<{ id: string; permissions: string[] }>) {
    const ctx: AuthzContext = {
      userId: row.id,
      username: '',
      isActive: true,
      roleName: '',
      rolePermissions: row.permissions ?? [],
      overrides: byUser.get(row.id) ?? [],
      memberships: [],
    };
    if (isAdminCapable(ctx)) n++;
  }
  return n;
};

export interface CoveragePatch {
  roleName?: string;
  isActive?: boolean;
  /** Full replacement set for the target's overrides; null/undefined = keep. */
  overrides?: PermissionOverride[] | null;
}

/**
 * Hypothetical coverage check for role-permission edits (Phase 7): would
 * replacing `roleName`'s permission set with `newPermissions` leave zero
 * admin-capable users? Bulk loads (3 queries), evaluates in memory.
 */
export const wouldLoseAdminCoverageOnRoleChange = async (
  roleName: string,
  newPermissions: string[],
): Promise<boolean> => {
  const u = await pool.query(`SELECT u.id, u.is_active, u.role_name FROM users u`);
  const roles = await pool.query(`SELECT name, permissions FROM roles`);
  const roleMap = new Map<string, string[]>(
    (roles.rows as Array<{ name: string; permissions: string[] }>).map((r) => [r.name, r.permissions ?? []]),
  );
  roleMap.set(roleName, [...newPermissions]);
  const o = await pool.query(`SELECT user_id, permission_key, effect FROM user_permission_overrides`);
  const byUser = new Map<string, PermissionOverride[]>();
  for (const r of o.rows as Array<{ user_id: string; permission_key: string; effect: OverrideEffect }>) {
    const list = byUser.get(r.user_id) ?? [];
    list.push({ permissionKey: r.permission_key, effect: r.effect });
    byUser.set(r.user_id, list);
  }
  let n = 0;
  for (const row of u.rows as Array<{ id: string; is_active: boolean; role_name: string }>) {
    const ctx: AuthzContext = {
      userId: row.id,
      username: '',
      isActive: row.is_active === true,
      roleName: row.role_name,
      rolePermissions: roleMap.get(row.role_name) ?? [],
      overrides: byUser.get(row.id) ?? [],
      memberships: [],
    };
    if (isAdminCapable(ctx)) n++;
  }
  return n === 0;
};

/**
 * Hypothetical coverage check for last-admin guards: would applying `patch`
 * to `targetUserId` leave zero admin-capable users? Bulk loads (3 queries),
 * evaluates in memory. Deleted users are modeled as { isActive: false }.
 */
export const wouldLoseAdminCoverage = async (
  targetUserId: string,
  patch: CoveragePatch,
): Promise<boolean> => {
  const u = await pool.query(
    `SELECT u.id, u.is_active, u.role_name FROM users u`,
  );
  const roles = await pool.query(`SELECT name, permissions FROM roles`);
  const roleMap = new Map<string, string[]>(
    (roles.rows as Array<{ name: string; permissions: string[] }>).map((r) => [r.name, r.permissions ?? []]),
  );
  const o = await pool.query(`SELECT user_id, permission_key, effect FROM user_permission_overrides`);
  const byUser = new Map<string, PermissionOverride[]>();
  for (const r of o.rows as Array<{ user_id: string; permission_key: string; effect: OverrideEffect }>) {
    const list = byUser.get(r.user_id) ?? [];
    list.push({ permissionKey: r.permission_key, effect: r.effect });
    byUser.set(r.user_id, list);
  }
  let n = 0;
  for (const row of u.rows as Array<{ id: string; is_active: boolean; role_name: string }>) {
    const isTarget = row.id === targetUserId;
    const active = isTarget && patch.isActive !== undefined ? patch.isActive : row.is_active === true;
    const roleName = isTarget && patch.roleName !== undefined ? patch.roleName : row.role_name;
    const overrides = isTarget && patch.overrides !== undefined && patch.overrides !== null
      ? patch.overrides
      : (byUser.get(row.id) ?? []);
    const ctx: AuthzContext = {
      userId: row.id,
      username: '',
      isActive: active,
      roleName,
      rolePermissions: roleMap.get(roleName) ?? [],
      overrides,
      memberships: [],
    };
    if (isAdminCapable(ctx)) n++;
  }
  return n === 0;
};
