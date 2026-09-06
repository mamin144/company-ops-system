import { Router } from 'express';
import type { CookieOptions } from 'express';
import { z } from 'zod';
import { authService, ACCESS_TOKEN_TTL_SECONDS } from '../../services/auth.service';
import { sessionService } from '../../services/session.service';
import { userRepository } from '../../repositories/user.repository';
import { auditService } from '../../services/audit.service';
import { requireAuth, requirePermission } from '../../middleware/auth';
import type { AuthedRequest } from '../../middleware/auth';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});
const userSchema = z.object({
  username: z.string().min(2),
  fullName: z.string().min(2),
  password: z.string().min(6).optional(),
  roleName: z.enum(['admin', 'management', 'warehouse', 'technical', 'viewer']),
  isActive: z.boolean().default(true),
});

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
    const safeUser = authService.toSafeUser(user as any);
    const accessToken = authService.signToken({ sub: (user as any).id, username: (user as any).username, roleName: (user as any).roleName });
    const { refreshToken, sessionId } = await sessionService.create(
      user,
      parsed.data.rememberMe,
      req.ip,
      req.headers['user-agent'],
    );
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
  const accessToken = authService.signToken({ sub: (user as any).id, username: (user as any).username, roleName: (user as any).roleName });
  res.cookie(ACCESS_COOKIE, accessToken, accessCookie(req));
  res.json({
    sessionId: session.id,
    accessToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    user: authService.toSafeUser(user as any),
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
  res.json(users.map((u) => authService.toSafeUser(u)));
});

usersRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'بيانات غير صالحة', issues: parsed.error.flatten() });
  const { password, ...rest } = parsed.data;
  if (!password) return res.status(400).json({ message: 'كلمة المرور مطلوبة للمستخدم الجديد' });
  const users = await userRepository.list();
  if (users.some((u) => u.username.toLowerCase() === rest.username.toLowerCase()))
    return res.status(409).json({ message: 'اسم المستخدم موجود بالفعل' });
  const created = await userRepository.create({ ...rest, passwordHash: authService.hashPassword(password) });
  auditService.log(req, 'create', 'user', created.id, undefined, authService.toSafeUser(created));
  res.status(201).json(authService.toSafeUser(created));
});

usersRouter.put('/:id', async (req: AuthedRequest, res) => {
  const parsed = userSchema.partial().safeParse(req.body);
  if(!parsed.success) return res.status(400).json({ message: 'بيانات غير صالحة', issues: parsed.error.flatten() });
  const existing = await userRepository.findById(String(req.params.id));
  if (!existing) return res.status(404).json({ message: 'المستخدم غير موجود' });
  const { password, ...rest } = parsed.data;
  if ((rest.isActive === false || rest.roleName !== existing.roleName) && existing.roleName === 'admin') {
    const users = await userRepository.list();
    const activeAdmins = users.filter((u) => u.roleName === 'admin' && u.isActive);
    if (activeAdmins.length <= 1 && (activeAdmins[0]?.id === existing.id))
      return res.status(409).json({ message: 'لا يمكن تعطيل آخر مدير للنظام' });
  }
  const updated = await userRepository.update(existing.id, {
    ...rest,
    ...(password ? { passwordHash: authService.hashPassword(password) } : {}),
  });
  // permission/role changes take effect on devices at next refresh
  if (rest.roleName && rest.roleName !== existing.roleName) {
    auditService.log(req, 'permission-change', 'user', existing.id, { role: existing.roleName }, { role: rest.roleName });
    await sessionService.revokeAllForUser(existing.id);
  }
  auditService.log(req, 'update', 'user', existing.id, authService.toSafeUser(existing), updated && authService.toSafeUser(updated));
  res.json(updated && authService.toSafeUser(updated));
});

usersRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const existing = await userRepository.findById(String(req.params.id));
  if (!existing) return res.status(404).json({ message: 'المستخدم غير موجود' });
  const users = await userRepository.list();
  if (existing.roleName === 'admin' && users.filter((u) => u.roleName === 'admin').length <= 1)
    return res.status(409).json({ message: 'لا يمكن حذف آخر مدير للنظام' });
  await sessionService.revokeAllForUser(existing.id);
  await userRepository.delete(existing.id);
  auditService.log(req, 'delete', 'user', existing.id, authService.toSafeUser(existing));
  res.status(204).end();
});

/* ---------- Active sessions of the current device/user (future-ready) ---------- */
authRouter.get('/sessions', requireAuth, async (req: AuthedRequest, res) => {
  void req;
  res.json({ note: 'Active-sessions UI is future work; revocation APIs are in place.' });
});

export { usersRouter };
