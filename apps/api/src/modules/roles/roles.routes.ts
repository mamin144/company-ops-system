import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../database/connection';
import { requireAuth, requirePermission } from '../../middleware/auth';
import type { AuthedRequest } from '../../middleware/auth';
import { auditService } from '../../services/audit.service';
import { userRepository } from '../../repositories/user.repository';
import {
  can,
  wouldLoseAdminCoverageOnRoleChange,
  MANAGED_PERMISSIONS,
} from '../../services/authorization.service';

const roleNameSchema = z
  .string()
  .min(2, 'اسم الدور قصير')
  .max(50)
  .regex(/^[a-z0-9-]+$/, 'اسم الدور يجب أن يكون أحرف لاتينية صغيرة وأرقام وشرطات');

const roleSchema = z.object({
  name: roleNameSchema,
  name_ar: z.string().min(2, 'الاسم العربي مطلوب'),
  permissions: z.array(z.string()).default([]),
});

export interface RoleRow {
  id: string;
  name: string;
  name_ar: string;
  permissions: string[];
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

const toRoleJson = (r: RoleRow, userCount: number) => ({
  id: r.id,
  name: r.name,
  name_ar: r.name_ar,
  permissions: r.permissions ?? [],
  is_system: r.is_system,
  userCount,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const withCounts = async () => {
  const r = await pool.query(
    `SELECT r.id, r.name, r.name_ar, r.permissions, r.is_system, r.created_at, r.updated_at,
            COUNT(u.id)::int AS "userCount"
     FROM roles r LEFT JOIN users u ON u.role_name = r.name
     GROUP BY r.id ORDER BY r.name`,
  );
  return r.rows.map((row: RoleRow & { userCount: number }) => toRoleJson(row, row.userCount));
};

const findRole = async (id: string): Promise<RoleRow | undefined> => {
  const r = await pool.query(`SELECT * FROM roles WHERE id = $1`, [id]);
  return r.rows[0];
};

const checkPermissions = (permissions: string[]): string | null => {
  const seen = new Set<string>();
  for (const key of permissions) {
    if (!MANAGED_PERMISSIONS.includes(key)) return key;
    if (seen.has(key)) return key;
    seen.add(key);
  }
  return null;
};
const dedupe = (permissions: string[]): string[] => [...new Set(permissions)];

export const rolesRouter = Router();
rolesRouter.use(requireAuth, requirePermission('roles.manage'));

rolesRouter.get('/', async (_req, res) => {
  res.json(await withCounts());
});

rolesRouter.get('/:id', async (req, res) => {
  const role = await findRole(String(req.params.id));
  if (!role) return res.status(404).json({ message: 'الدور غير موجود' });
  const c = await pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE role_name = $1`, [role.name]);
  res.json(toRoleJson(role, c.rows[0].n));
});

rolesRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = roleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'بيانات غير صالحة', issues: parsed.error.flatten() });
  const bad = checkPermissions(parsed.data.permissions);
  if (bad) return res.status(400).json({ message: `صلاحية غير معروفة: ${bad}` });
  const taken = await pool.query(`SELECT 1 FROM roles WHERE name = $1`, [parsed.data.name]);
  if (taken.rows.length) return res.status(409).json({ message: 'الدور موجود بالفعل' });
  const created = await pool.query(
    `INSERT INTO roles (id, name, name_ar, permissions, is_system, created_at, updated_at)
     VALUES (uuid_generate_v4(), $1, $2, $3, FALSE, NOW(), NOW()) RETURNING *`,
    [parsed.data.name, parsed.data.name_ar, dedupe(parsed.data.permissions)],
  );
  const row = created.rows[0] as RoleRow;
  auditService.log(req, 'ROLE_CREATED', 'role', row.id, undefined, { name: row.name, permissions: row.permissions });
  res.status(201).json(toRoleJson(row, 0));
});

rolesRouter.put('/:id', async (req: AuthedRequest, res) => {
  const role = await findRole(String(req.params.id));
  if (!role) return res.status(404).json({ message: 'الدور غير موجود' });
  if (typeof req.body?.name === 'string' && req.body.name !== role.name)
    return res.status(400).json({ message: 'اسم الدور ثابت ولا يمكن تغييره' });
  const parsed = roleSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'بيانات غير صالحة', issues: parsed.error.flatten() });
  const nextPermissions = parsed.data.permissions !== undefined ? dedupe(parsed.data.permissions) : role.permissions ?? [];
  const bad = checkPermissions(nextPermissions);
  if (bad) return res.status(400).json({ message: `صلاحية غير معروفة: ${bad}` });
  if (await wouldLoseAdminCoverageOnRoleChange(role.name, nextPermissions))
    return res.status(409).json({ message: 'لا يمكن تعطيل آخر مدير للنظام' });
  const nextNameAr = parsed.data.name_ar ?? role.name_ar;
  const updated = await pool.query(
    `UPDATE roles SET name_ar = $1, permissions = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
    [nextNameAr, nextPermissions, role.id],
  );
  const updatedRow = updated.rows[0] as RoleRow;
  auditService.log(
    req, 'ROLE_UPDATED', 'role', role.id,
    { name_ar: role.name_ar, permissions: role.permissions },
    { name_ar: updatedRow.name_ar, permissions: updatedRow.permissions },
  );
  const c = await pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE role_name = $1`, [role.name]);
  res.json(toRoleJson(updatedRow, c.rows[0].n));
});

rolesRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const role = await findRole(String(req.params.id));
  if (!role) return res.status(404).json({ message: 'الدور غير موجود' });
  if (role.is_system) return res.status(403).json({ message: 'لا يمكن حذف أدوار النظام' });
  const assigned = await pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE role_name = $1`, [role.name]);
  const userCount = assigned.rows[0].n as number;
  if (userCount > 0)
    return res.status(409).json({ message: 'لا يمكن حذف دور مرتبط بمستخدمين. أعد تعيينهم أولاً.', userCount });
  await pool.query(`DELETE FROM roles WHERE id = $1`, [role.id]);
  auditService.log(req, 'ROLE_DELETED', 'role', role.id, { name: role.name, permissions: role.permissions }, undefined);
  res.status(204).end();
});

rolesRouter.post('/:id/clone', async (req: AuthedRequest, res) => {
  const source = await findRole(String(req.params.id));
  if (!source) return res.status(404).json({ message: 'الدور غير موجود' });
  const wanted = typeof req.body?.name === 'string' && req.body.name ? req.body.name : `${source.name}-copy`;
  const parsedName = roleNameSchema.safeParse(wanted);
  if (!parsedName.success) return res.status(400).json({ message: 'بيانات غير صالحة', issues: parsedName.error.flatten() });
  let name = parsedName.data;
  let suffix = 2;
  while ((await pool.query(`SELECT 1 FROM roles WHERE name = $1`, [name])).rows.length) {
    if (suffix > 99) return res.status(409).json({ message: 'تعذر توليد اسم فريد للدور' });
    name = `${parsedName.data}-${suffix++}`;
  }
  const nameAr = typeof req.body?.name_ar === 'string' && req.body.name_ar
    ? req.body.name_ar
    : `${source.name_ar} (نسخة)`;
  const created = await pool.query(
    `INSERT INTO roles (id, name, name_ar, permissions, is_system, created_at, updated_at)
     VALUES (uuid_generate_v4(), $1, $2, $3, FALSE, NOW(), NOW()) RETURNING *`,
    [name, nameAr, [...(source.permissions ?? [])]],
  );
  const row = created.rows[0] as RoleRow;
  auditService.log(req, 'ROLE_CLONED', 'role', row.id, { sourceRole: source.name }, { name: row.name, permissions: row.permissions });
  res.status(201).json(toRoleJson(row, 0));
});

rolesRouter.get('/:id/users', async (req, res) => {
  const role = await findRole(String(req.params.id));
  if (!role) return res.status(404).json({ message: 'الدور غير موجود' });
  const users = await userRepository.list();
  res.json(
    users
      .filter((u) => u.roleName === role.name)
      .map((u) => ({ id: u.id, username: u.username, fullName: u.fullName, isActive: u.isActive })),
  );
});
