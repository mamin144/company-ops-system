import { Router } from 'express';
import type { CookieOptions } from 'express';
import { z } from 'zod';
import { authService, ACCESS_TOKEN_TTL_SECONDS } from '../../services/auth.service';
import { sessionService } from '../../services/session.service';
import { userRepository } from '../../repositories/user.repository';
import { auditService } from '../../services/audit.service';
import { requireAuth, requirePermission, requireAnyPermission, requestContext } from '../../middleware/auth';
import type { AuthedRequest } from '../../middleware/auth';
import { pool } from '../../database/connection';
import {
  loadContext,
  effective,
  can,
  wouldLoseAdminCoverage,
  MANAGED_PERMISSIONS,
} from '../../services/authorization.service';
import type { PermissionOverride } from '../../services/authorization.service';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});
const userSchema = z.object({
  username: z.string().min(2),
  fullName: z.string().min(2),
  password: z.string().min(6).optional(),
  // Phase 7: any managed role name is assignable (validated against the
  // roles table in handlers so custom roles work, not just the 5 static).
  roleName: z.string().min(2).max(50),
  isActive: z.boolean().default(true),
});

/** Rejects unknown role names (custom roles included via the roles table). */
const assertRoleExists = async (res: import('express').Response, roleName: string): Promise<boolean> => {
  const r = await pool.query(`SELECT 1 FROM roles WHERE name = $1`, [roleName]);
  if (!r.rows.length) {
    res.status(400).json({ message: 'الدور غير موجود' });
    return false;
  }
  return true;
};

export const REFRESH_COOKIE = 'cos_refresh';
/** Same short-lived JWT, additionally transported via HttpOnly cookie so that
 * direct navigations (e.g. opening an API URL or document link in a new tab)
 * authenticate without duplicating the token logic. */
export const ACCESS_COOKIE = 'cos_access';

const accessCookie = (req: AuthedRequest): CookieOptions => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: req.secure || process.env.FORCE_SECURE_COOKIES === '1',
  path: '/api',
  maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
});

/** Session cookie (dies with browser) unless "Remember Me" → persistent 30 days. */
const refreshCookie = (req: AuthedRequest, rememberMe: boolean): CookieOptions => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: req.secure || process.env.FORCE_SECURE_COOKIES === '1',
  path: '/api/auth',
  ...(rememberMe ? { maxAge: 30 * 24 * 60 * 60 * 1000 } : {}),
});

const readRefreshCookie = (req: AuthedRequest): string | undefined => {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === REFRESH_COOKIE) return decodeURIComponent(v.join('='));
  }
  return undefined;
};

export const authRouter = Router();

authRouter.post('/login', async (req: AuthedRequest, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'أدخل اسم المستخدم وكلمة المرور' });
  try {
    const user = await authService.login(parsed.data.username, parsed.data.password);
    const { refreshToken, sessionId } = await sessionService.create(
      user,
      parsed.data.rememberMe,
      req.ip,
      req.headers['user-agent'],
    );
    // Minimal identity claims only — permissions resolve server-side per request.
    const accessToken = authService.signToken({ sub: (user as any).id, sid: sessionId });
    const safeUser = await authService.toSafeUser(user as any);
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookie(req, parsed.data.rememberMe));
    res.cookie(ACCESS_COOKIE, accessToken, accessCookie(req));
    auditService.log(req, 'login', 'user', user.id);
    res.json({ sessionId, accessToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS, user: safeUser });
  } catch (e) {
    auditService.log(req, 'login-failed', 'user', undefined, undefined, { username: parsed.data.username });
    res.status(401).json({ message: e instanceof Error ? e.message : 'فشل تسجيل الدخول' });
  }
});

/** Silent session renewal — used by the central API client on access-token expiry. */
authRouter.post('/refresh', async (req: AuthedRequest, res) => {
  const token = readRefreshCookie(req);
  const session = token ? await sessionService.verify(token) : null;
  if(!session) return res.status(401).json({ message: 'انتهت الجلسة، سجل الدخول من جديد' });
  const user = await userRepository.findById(session.userId);
  if (!user || !user.isActive) {
    await sessionService.revoke(session.id);
    return res.status(401).json({ message: 'الحساب غير مفعّل' });
  }
  // rotation keeps a stolen refresh token from being replayed forever
  const rotated = await sessionService.rotate(session.id);
  if (!rotated) return res.status(401).json({ message: 'انتهت الجلسة، سجل الدخول من جديد' });
  res.cookie(REFRESH_COOKIE, rotated.refreshToken, refreshCookie(req, session.rememberMe));
  const accessToken = authService.signToken({ sub: (user as any).id, sid: session.id });
  res.cookie(ACCESS_COOKIE, accessToken, accessCookie(req));
  res.json({
    sessionId: session.id,
    accessToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    user: await authService.toSafeUser(user as any),
  });
});

/** Revokes ONLY this device's session — other devices stay logged in. */
authRouter.post('/logout', requireAuth, async (req: AuthedRequest, res) => {
  const token = readRefreshCookie(req);
  const session = token ? await sessionService.verify(token) : null;
  if (session) {
    await sessionService.revoke(session.id);
    auditService.log(req, 'logout', 'user', req.user!.id);
  }
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.clearCookie(ACCESS_COOKIE, { path: '/api' });
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  res.json(req.user);
});

/* ---------- Users management (users.manage) ---------- */

const usersRouter = Router();
usersRouter.use(requireAuth, requirePermission('users.manage'));

usersRouter.get('/', async (_req, res) => {
  const users = await userRepository.list();
  res.json(await Promise.all(users.map((u) => authService.toSafeUser(u))));
});

usersRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'بيانات غير صالحة', issues: parsed.error.flatten() });
  const { password, ...rest } = parsed.data;
  if (!password) return res.status(400).json({ message: 'كلمة المرور مطلوبة للمستخدم الجديد' });
  if (!(await assertRoleExists(res, rest.roleName))) return;
  const users = await userRepository.list();
  if (users.some((u) => u.username.toLowerCase() === rest.username.toLowerCase()))
    return res.status(409).json({ message: 'اسم المستخدم موجود بالفعل' });
  const created = await userRepository.create({ ...rest, passwordHash: authService.hashPassword(password) });
  auditService.log(req, 'create', 'user', created.id, undefined, await authService.toSafeUser(created));
  res.status(201).json(await authService.toSafeUser(created));
});

usersRouter.put('/:id', async (req: AuthedRequest, res) => {
  const parsed = userSchema.partial().safeParse(req.body);
  if(!parsed.success) return res.status(400).json({ message: 'بيانات غير صالحة', issues: parsed.error.flatten() });
  const existing = await userRepository.findById(String(req.params.id));
  if (!existing) return res.status(404).json({ message: 'المستخدم غير موجود' });
  const { password, ...rest } = parsed.data;
  const selfEdit = existing.id === req.user!.id;
  // Self-guard: security state (active flag, role) can only be changed by
  // another administrator — never by the account itself.
  if (selfEdit && (rest.isActive === false || (rest.roleName && rest.roleName !== existing.roleName)))
    return res.status(403).json({ message: 'لا يمكنك تعديل صلاحياتك أو تعطيل حسابك بنفسك' });
  if (rest.roleName && !(await assertRoleExists(res, rest.roleName))) return;
  // Last-admin coverage guard (effective permissions, not role names).
  if (rest.roleName !== undefined || rest.isActive !== undefined) {
    if (await wouldLoseAdminCoverage(existing.id, { roleName: rest.roleName, isActive: rest.isActive }))
      return res.status(409).json({ message: 'لا يمكن تعطيل آخر مدير للنظام' });
  }
  const wasActive = existing.isActive;
  const updated = await userRepository.update(existing.id, {
    ...rest,
    ...(password ? { passwordHash: authService.hashPassword(password) } : {}),
  });
  // permission/role changes take effect on devices at next refresh
  if (rest.roleName && rest.roleName !== existing.roleName) {
    auditService.log(req, 'permission-change', 'user', existing.id, { role: existing.roleName }, { role: rest.roleName });
    auditService.log(req, 'USER_ROLE_CHANGED', 'user', existing.id, { role: existing.roleName }, { role: rest.roleName });
    await sessionService.revokeAllForUser(existing.id);
  }
  if (password) {
    // A changed password must invalidate every session of the target account.
    await sessionService.revokeAllForUser(existing.id);
  }
  if (rest.isActive !== undefined && rest.isActive !== wasActive) {
    await sessionService.revokeAllForUser(existing.id);
    auditService.log(
      req,
      rest.isActive ? 'USER_ENABLED' : 'USER_DISABLED',
      'user',
      existing.id,
      { isActive: wasActive },
      { isActive: rest.isActive },
    );
  }
  auditService.log(req, 'update', 'user', existing.id, await authService.toSafeUser(existing), updated && (await authService.toSafeUser(updated)));
  res.json(updated && (await authService.toSafeUser(updated)));
});

usersRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const existing = await userRepository.findById(String(req.params.id));
  if (!existing) return res.status(404).json({ message: 'المستخدم غير موجود' });
  if (await wouldLoseAdminCoverage(existing.id, { isActive: false }))
    return res.status(409).json({ message: 'لا يمكن حذف آخر مدير للنظام' });
  if (existing.id === req.user!.id)
    return res.status(403).json({ message: 'لا يمكنك حذف حسابك بنفسك' });
  await sessionService.revokeAllForUser(existing.id);
  await userRepository.delete(existing.id);
  auditService.log(req, 'delete', 'user', existing.id, await authService.toSafeUser(existing));
  res.status(204).end();
});

/* ---------- Extended user administration (Phase 6) ---------- */

const resetSchema = z.object({ password: z.string().min(6, 'كلمة المرور قصيرة') });
const overrideSchema = z.object({
  permissionKey: z.string().min(1),
  effect: z.enum(['grant', 'deny']),
});
const accessSchema = z.object({
  access: z.array(
    z.object({
      projectId: z.string().min(1),
      access: z.enum(['NONE', 'READ', 'WRITE', 'DELETE']),
    }),
  ),
});

export const usersExtRouter = Router();
usersExtRouter.use(requireAuth);

const loadTargetUser = async (id: string) => userRepository.findById(id);

usersExtRouter.post('/:id/reset-password', requireAnyPermission('users.manage', 'users.resetPassword'), async (req: AuthedRequest, res) => {
  const existing = await loadTargetUser(String(req.params.id));
  if (!existing) return res.status(404).json({ message: 'المستخدم غير موجود' });
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'بيانات غير صالحة', issues: parsed.error.flatten() });
  await userRepository.update(existing.id, { passwordHash: authService.hashPassword(parsed.data.password) });
  await sessionService.revokeAllForUser(existing.id);
  auditService.log(req, 'PASSWORD_RESET', 'user', existing.id, { username: existing.username }, { username: existing.username, resetBy: req.user!.username });
  res.json({ ok: true });
});

usersExtRouter.get('/:id/overrides', requirePermission('users.manage'), async (req, res) => {
  const existing = await loadTargetUser(String(req.params.id));
  if (!existing) return res.status(404).json({ message: 'المستخدم غير موجود' });
  const rows = await pool.query(
    `SELECT permission_key, effect FROM user_permission_overrides WHERE user_id = $1 ORDER BY permission_key`,
    [existing.id],
  );
  res.json(rows.rows.map((r: { permission_key: string; effect: string }) => ({ permissionKey: r.permission_key, effect: r.effect })));
});

usersExtRouter.put('/:id/overrides', requirePermission('users.manage'), async (req: AuthedRequest, res) => {
  const existing = await loadTargetUser(String(req.params.id));
  if (!existing) return res.status(404).json({ message: 'المستخدم غير موجود' });
  if (existing.id === req.user!.id)
    return res.status(403).json({ message: 'لا يمكنك تعديل صلاحياتك بنفسك' });
  const parsed = z.object({ overrides: z.array(overrideSchema) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'بيانات غير صالحة', issues: parsed.error.flatten() });
  for (const o of parsed.data.overrides) {
    if (!MANAGED_PERMISSIONS.includes(o.permissionKey))
      return res.status(400).json({ message: `صلاحية غير معروفة: ${o.permissionKey}` });
  }
  const next: PermissionOverride[] = parsed.data.overrides.map((o) => ({ permissionKey: o.permissionKey, effect: o.effect }));
  if (await wouldLoseAdminCoverage(existing.id, { overrides: next }))
    return res.status(409).json({ message: 'لا يمكن تعطيل آخر مدير للنظام' });
  const before = await pool.query(`SELECT permission_key, effect FROM user_permission_overrides WHERE user_id = $1`, [existing.id]);
  const beforeSet = new Map<string, string>(before.rows.map((r: { permission_key: string; effect: string }) => [r.permission_key, r.effect]));
  const afterSet = new Map<string, string>(next.map((o) => [o.permissionKey, o.effect]));
  await pool.query(`DELETE FROM user_permission_overrides WHERE user_id = $1`, [existing.id]);
  for (const o of next) {
    await pool.query(
      `INSERT INTO user_permission_overrides (user_id, permission_key, effect, created_by) VALUES ($1, $2, $3, $4)`,
      [existing.id, o.permissionKey, o.effect, req.user!.username],
    );
  }
  for (const [key, effect] of afterSet) {
    if (beforeSet.get(key) !== effect)
      auditService.log(req, 'PERMISSION_GRANTED', 'user', existing.id, { permission: key }, { permission: key, effect });
  }
  for (const [key] of beforeSet) {
    if (!afterSet.has(key))
      auditService.log(req, 'PERMISSION_REVOKED', 'user', existing.id, { permission: key }, undefined);
  }
  await sessionService.revokeAllForUser(existing.id);
  res.json(next);
});

usersExtRouter.delete('/:id/overrides/:key', requirePermission('users.manage'), async (req: AuthedRequest, res) => {
  const existing = await loadTargetUser(String(req.params.id));
  if (!existing) return res.status(404).json({ message: 'المستخدم غير موجود' });
  if (existing.id === req.user!.id)
    return res.status(403).json({ message: 'لا يمكنك تعديل صلاحياتك بنفسك' });
  const key = String(req.params.key);
  const found = await pool.query(`SELECT effect FROM user_permission_overrides WHERE user_id = $1 AND permission_key = $2`, [existing.id, key]);
  if (found.rows.length === 0) return res.status(404).json({ message: 'التجاوز غير موجود' });
  const remaining: PermissionOverride[] = (
    await pool.query(`SELECT permission_key, effect FROM user_permission_overrides WHERE user_id = $1 AND permission_key <> $2`, [existing.id, key])
  ).rows.map((r: { permission_key: string; effect: 'grant' | 'deny' }) => ({ permissionKey: r.permission_key, effect: r.effect }));
  if (await wouldLoseAdminCoverage(existing.id, { overrides: remaining }))
    return res.status(409).json({ message: 'لا يمكن تعطيل آخر مدير للنظام' });
  await pool.query(`DELETE FROM user_permission_overrides WHERE user_id = $1 AND permission_key = $2`, [existing.id, key]);
  auditService.log(req, 'PERMISSION_REVOKED', 'user', existing.id, { permission: key }, undefined);
  await sessionService.revokeAllForUser(existing.id);
  res.status(204).end();
});

usersExtRouter.get('/:id/projects', requirePermission('projects.access'), async (req, res) => {
  const existing = await loadTargetUser(String(req.params.id));
  if (!existing) return res.status(404).json({ message: 'المستخدم غير موجود' });
  // Phase 8 §2: return EVERY project with the stored access or NONE by
  // default (computed, never persisted). Deterministic order by code.
  const rows = await pool.query(
    `SELECT p.id AS project_id, p.project_code, p.project_name, m.access
     FROM projects p LEFT JOIN project_members m
       ON m.project_id = p.id AND m.user_id = $1
     ORDER BY p.project_code`,
    [existing.id],
  );
  res.json(rows.rows.map((r: { project_id: string; access: string | null; project_code: string; project_name: string }) => ({
    projectId: r.project_id, projectCode: r.project_code, projectName: r.project_name, access: r.access ?? 'NONE',
  })));
});

usersExtRouter.put('/:id/projects', requirePermission('projects.access'), async (req: AuthedRequest, res) => {
  const existing = await loadTargetUser(String(req.params.id));
  if (!existing) return res.status(404).json({ message: 'المستخدم غير موجود' });
  if (existing.id === req.user!.id)
    return res.status(403).json({ message: 'لا يمكنك تعديل صلاحيات مشاريعك بنفسك' });
  const parsed = accessSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'بيانات غير صالحة', issues: parsed.error.flatten() });
  // Phase 8 §4: duplicate projectIds are a client error (400), rejected
  // before touching the database — never a PK violation mid-replace.
  const ids = parsed.data.access.map((a) => a.projectId);
  if (new Set(ids).size !== ids.length)
    return res.status(400).json({ message: 'تكرار المشروع في الطلب غير مسموح' });
  // Validate every project exists first: all-or-nothing, no partial writes.
  if (ids.length) {
    const found = await pool.query(`SELECT id FROM projects WHERE id = ANY($1)`, [ids]);
    const missing = ids.filter((id) => !found.rows.some((r: { id: string }) => r.id === id));
    if (missing.length) return res.status(404).json({ message: 'المشروع غير موجود' });
  }
  // Phase 8 §4: the DELETE + INSERTs run in one transaction so concurrent
  // replaces serialize (last-writer-wins, never mixed) and a mid-write
  // failure rolls back instead of leaving a half-replaced membership set.
  const client = await pool.connect();
  let after: Array<{ project_id: string; access: string; project_code: string; project_name: string }>;
  let before: Array<{ project_id: string; access: string }>;
  try {
    await client.query('BEGIN');
    // Serialize concurrent replaces for the SAME user: without this row
    // lock, two full-replaces interleave under READ COMMITTED
    // (A DELETE, B DELETE, A INSERT, B INSERT) and the final set is a
    // mix of both writers. Locking the parent user row forces the second
    // writer to wait, then re-read committed state → last-writer-wins.
    await client.query(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, [existing.id]);
    const beforeRows = await client.query(`SELECT project_id, access FROM project_members WHERE user_id = $1`, [existing.id]);
    before = beforeRows.rows;
    await client.query(`DELETE FROM project_members WHERE user_id = $1`, [existing.id]);
    for (const a of parsed.data.access) {
      await client.query(
        `INSERT INTO project_members (project_id, user_id, access, created_by) VALUES ($1, $2, $3, $4)`,
        [a.projectId, existing.id, a.access, req.user!.username],
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  // Phase 8 §10: one audit event per CHANGED membership (added / removed /
  // level-changed). Unchanged rows and pure no-ops emit nothing.
  const beforeById = new Map(before!.map((r) => [r.project_id, r.access]));
  const afterById = new Map(parsed.data.access.map((a) => [a.projectId, a.access]));
  for (const [projectId, oldAccess] of beforeById) {
    const newAccess = afterById.get(projectId) ?? 'NONE';
    if (newAccess !== oldAccess)
      auditService.log(req, 'PROJECT_ACCESS_CHANGED', 'user', existing.id,
        { projectId, access: oldAccess }, { projectId, access: newAccess });
  }
  for (const [projectId, newAccess] of afterById) {
    if (!beforeById.has(projectId))
      auditService.log(req, 'PROJECT_ACCESS_CHANGED', 'user', existing.id,
        { projectId, access: 'NONE' }, { projectId, access: newAccess });
  }
  const rows = await pool.query(
    `SELECT p.id AS project_id, p.project_code, p.project_name, m.access
     FROM projects p LEFT JOIN project_members m
       ON m.project_id = p.id AND m.user_id = $1
     ORDER BY p.project_code`,
    [existing.id],
  );
  after = rows.rows;
  res.json(after.map((r) => ({
    projectId: r.project_id, projectCode: r.project_code, projectName: r.project_name, access: r.access ?? 'NONE',
  })));
});

usersExtRouter.get('/:id/effective', async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const existing = await loadTargetUser(id);
  if (!existing) return res.status(404).json({ message: 'المستخدم غير موجود' });
  if (req.user!.id !== id) {
    const ctx0 = await requestContext(req);
    if (!can(ctx0, 'users.manage')) return res.status(403).json({ message: 'ليس لديك صلاحية: users.manage' });
  }
  const ctx = await loadContext(id);
  if (!ctx) return res.status(404).json({ message: 'المستخدم غير موجود' });
  const projectId = typeof req.query.projectId === 'string' && req.query.projectId ? req.query.projectId : undefined;
  const eff = effective(ctx, projectId);
  const membershipByProject = new Map(ctx.memberships.map((m) => [m.projectId, m.access]));
  const permissions: Record<string, { effective: boolean; source: string; roleValue: boolean; override: string | null; projectAccess: string | null }> = {};
  for (const key of MANAGED_PERMISSIONS) {
    const ov = ctx.overrides.find((o) => o.permissionKey === key);
    permissions[key] = {
      effective: (eff.permissions as Record<string, boolean>)[key] ?? false,
      source: ov ? `${ov.effect}-override` : 'role',
      roleValue: ctx.rolePermissions.includes(key),
      override: ov ? ov.effect : null,
      projectAccess: projectId ? (membershipByProject.get(projectId) ?? 'NONE') : null,
    };
  }
  res.json({
    user: await authService.toSafeUser(existing),
    role: ctx.roleName,
    overrides: ctx.overrides,
    memberships: projectId ? ctx.memberships.filter((m) => m.projectId === projectId) : ctx.memberships,
    permissions,
  });
});

/* ---------- Active sessions of the current device/user (future-ready) ---------- */
authRouter.get('/sessions', requireAuth, async (req: AuthedRequest, res) => {
  void req;
  res.json({ note: 'Active-sessions UI is future work; revocation APIs are in place.' });
});

export { usersRouter };
