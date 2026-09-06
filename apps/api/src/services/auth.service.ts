import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir } from '../shared/paths';
import { createId } from '../shared/id';
import { userRepository } from '../repositories/user.repository';
import type { SafeUser } from '@cos/shared';
import { permissionOf } from '@cos/shared';

const JWT_SECRET_FILE = join(dataDir, '.jwt-secret');
/** Access tokens are short-lived; persistence is handled by the refresh cookie. */
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 15;

const getSecret = (): string => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (existsSync(JWT_SECRET_FILE)) return readFileSync(JWT_SECRET_FILE, 'utf-8').trim();
  const secret = createId() + createId();
  writeFileSync(JWT_SECRET_FILE, secret, 'utf-8');
  return secret;
};

export interface JwtPayload {
  sub: string;
  username: string;
  roleName: string;
  sid?: string;
}

export class AuthService {
  hashPassword(plain: string) {
    return bcrypt.hashSync(plain, 10);
  }

  verifyPassword(plain: string, hash: string) {
    return bcrypt.compareSync(plain, hash);
  }

  signToken(payload: JwtPayload) {
    return jwt.sign(payload, getSecret(), { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
  }

  /**
   * Returns the decoded payload, or an object describing why it failed so the
   * client can distinguish "expired → refresh" from "invalid → logout".
   */
  verifyToken(token: string): { ok: true; payload: JwtPayload } | { ok: false; reason: 'expired' | 'invalid' } {
    try {
      return { ok: true, payload: jwt.verify(token, getSecret()) as JwtPayload };
    } catch (e) {
      const name = (e as { name?: string }).name;
      return { ok: false, reason: name === 'TokenExpiredError' ? 'expired' : 'invalid' };
    }
  }

  toSafeUser(user: {
    id: string;
    username: string;
    fullName: string;
    roleName: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }): SafeUser & { permissions: string[] } {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      roleName: user.roleName as SafeUser['roleName'],
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      permissions: permissionOf(user.roleName),
    };
  }

  async login(username: string, password: string) {
    const { pool } = await import('../database/connection.js');
    const result = await pool.query('SELECT * FROM users WHERE lower(username) = lower($1)', [username]);
    const user = result.rows[0];
    
    // constant-shape error to avoid user enumeration
    const invalid = Object.assign(new Error('اسم المستخدم أو كلمة المرور غير صحيحة'), { status: 401 });
    
    if (!user || !user.is_active || !this.verifyPassword(password, user.password_hash)) {
      throw invalid;
    }
    
    return {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      roleName: user.role_name,
      passwordHash: user.password_hash,
      isActive: user.is_active,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };
  }
}

export const authService = new AuthService();
