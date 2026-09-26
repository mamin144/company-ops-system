import type { NextFunction, Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { sessionService } from '../services/session.service';
import { userRepository } from '../repositories/user.repository';
import { loadContext, can } from '../services/authorization.service';
import type { AuthzContext } from '../services/authorization.service';
import type { ScopeResolver } from '../services/projectScope';
import type { SafeUser } from '@cos/shared';

export interface AuthedRequest extends Request {
  user?: SafeUser & { permissions: string[] };
  /**
   * Phase 4: per-request cached resolver context. Populated on first
   * permission evaluation so chains of requirePermission/requireAnyPermission
   * resolve the user exactly once. Never filled from client data.
   */
  authzContext?: AuthzContext | null;
}

/**
 * Single authoritative context per request. The req.user.permissions
 * snapshot (kept for /me + legacy readers) is deliberately NOT consulted:
 * every decision re-resolves from DB-backed authorization.service.
 */
export const requestContext = async (req: AuthedRequest): Promise<AuthzContext | null> => {
  if (req.authzContext === undefined) {
    req.authzContext = req.user?.id ? await loadContext(req.user.id) : null;
  }
  return req.authzContext;
};

const readCookie = (req: Request, name: string): string | undefined => {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
};

const invalidSession = (res: Response) =>
  res.status(401).json({ message: 'انتهت الجلسة، سجل الدخول مرة أخرى', code: 'TOKEN_INVALID' });

export const requireAuth = async (req: AuthedRequest, res: Response, next: NextFunction) => {
  // Authorization header first (central API client); HttpOnly access cookie as
  // fallback so direct browser navigations authenticate too — one mechanism,
  // two transports of the same short-lived JWT.
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : readCookie(req, 'cos_access');
  if (!token) return res.status(401).json({ message: 'يجب تسجيل الدخول' });
  const result = await authService.verifyToken(token);
  if (!result.ok) {
    return res.status(401).json({
      message: result.reason === 'expired' ? 'انتهت صلاحية الجلسة، جاري التحديث' : 'انتهت الجلسة، سجل الدخول مرة أخرى',
      code: result.reason === 'expired' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
    });
  }
  // Phase 3: identity comes from server-side records only. The token carries
  // {sub, sid}; role/permissions/active-state are re-resolved live, so
  // disable/role/override changes bite immediately. Tokens without sid
  // (pre-migration shape) are rejected — cutover is a single re-login.
  const { sub, sid } = result.payload as { sub?: string; sid?: string };
  if (!sub || !sid) return invalidSession(res);
  const session = await sessionService.findById(sid);
  if (!session || session.revokedAt) return invalidSession(res);
  if (new Date(session.expiresAt).getTime() < Date.now()) return invalidSession(res);
  if (session.userId !== sub) return invalidSession(res);
  const user = await userRepository.findById(sub);
  if (!user || !user.isActive) return invalidSession(res);
  req.user = await authService.toSafeUser(user);
  next();
};

export const requirePermission = (permission: string) => async (req: AuthedRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ message: 'يجب تسجيل الدخول' });
  if (!can(await requestContext(req), permission))
    return res.status(403).json({ message: `ليس لديك صلاحية: ${permission}` });
  next();
};

export const requireAnyPermission = (...permissions: string[]) =>
  async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: 'يجب تسجيل الدخول' });
    // One context for the whole evaluation — never one load per permission.
    const ctx = await requestContext(req);
    if (!permissions.some((p) => can(ctx, p)))
      return res.status(403).json({ message: `تحتاج إحدى الصلاحيات: ${permissions.join(' أو ')}` });
    next();
  };

export interface ProjectAccessOptions {
  /**
   * Single-resource reads hide existence (404) instead of denying loudly
   * (403), so inaccessible UUIDs are indistinguishable from missing rows.
   * Mutations keep the explicit 403.
   */
  hideExistence?: boolean;
}

/**
 * Phase 5: project-scoped guard. Global permission AND project constraint
 * via the central resolver; the project comes from a ScopeResolver that
 * loads the authoritative row (or validates collection params) — client
 * input alone never decides.
 */
export const requireProjectAccess = (
  permission: string,
  resolve: ScopeResolver,
  opts?: ProjectAccessOptions,
) => async (req: AuthedRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ message: 'يجب تسجيل الدخول' });
  const scope = await resolve(req);
  if ('missing' in scope) return res.status(404).json({ message: 'غير موجود' });
  const ctx = await requestContext(req);
  if (!can(ctx, permission, scope.projectId ?? undefined)) {
    if (opts?.hideExistence) return res.status(404).json({ message: 'غير موجود' });
    return res.status(403).json({ message: `ليس لديك صلاحية: ${permission}` });
  }
  next();
};

export const requireAnyProjectAccess = (
  permissions: string[],
  resolve: ScopeResolver,
  opts?: ProjectAccessOptions,
) => async (req: AuthedRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ message: 'يجب تسجيل الدخول' });
  const scope = await resolve(req);
  if ('missing' in scope) return res.status(404).json({ message: 'غير موجود' });
  const ctx = await requestContext(req);
  if (!permissions.some((p) => can(ctx, p, scope.projectId ?? undefined))) {
    if (opts?.hideExistence) return res.status(404).json({ message: 'غير موجود' });
    return res.status(403).json({ message: `تحتاج إحدى الصلاحيات: ${permissions.join(' أو ')}` });
  }
  next();
};
