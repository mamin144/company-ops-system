import type { NextFunction, Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { permissionOf } from '@cos/shared';
import type { SafeUser } from '@cos/shared';

export interface AuthedRequest extends Request {
  user?: SafeUser & { permissions: string[] };
}

const userFromPayload = (payload: { sub: string; username: string; roleName: string }): SafeUser & { permissions: string[] } => {
  const now = new Date().toISOString();
  return {
    id: payload.sub,
    username: payload.username,
    fullName: payload.username,
    roleName: payload.roleName as SafeUser['roleName'],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    permissions: permissionOf(payload.roleName),
  };
};

export const signUserToken = async (user: { id: string; username: string; roleName: string }) =>
  await authService.signToken({ sub: user.id, username: user.username, roleName: user.roleName });

const readCookie = (req: Request, name: string): string | undefined => {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
};

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
  req.user = userFromPayload(result.payload);
  next();
};

export const requirePermission = (permission: string) => (req: AuthedRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ message: 'يجب تسجيل الدخول' });
  if (!req.user.permissions.includes(permission))
    return res.status(403).json({ message: `ليس لديك صلاحية: ${permission}` });
  next();
};

export const requireAnyPermission = (...permissions: string[]) =>
  (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: 'يجب تسجيل الدخول' });
    if (!permissions.some((p) => req.user!.permissions.includes(p)))
      return res.status(403).json({ message: `تحتاج إحدى الصلاحيات: ${permissions.join(' أو ')}` });
    next();
  };
