import { createHash, randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { dataDir } from '../shared/paths';
import { JsonStore } from '../storage/json-store';

export interface UserSession {
  id: string;
  userId: string;
  username: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  ipAddress?: string;
  userAgent?: string;
  rememberMe: boolean;
}

const store = new JsonStore<UserSession>(join(dataDir, 'sessions.json'));

const DAY = 24 * 60 * 60 * 1000;
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export class SessionService {
  async create(user: { id: string; username: string }, rememberMe: boolean, ip?: string, userAgent?: string) {
    const { pool } = await import('../database/connection.js');
    const refreshToken = randomBytes(48).toString('hex');
    const ttl = rememberMe ? 30 * DAY : DAY;
    const session = {
      id: randomBytes(12).toString('hex'),
      userId: user.id,
      username: user.username,
      tokenHash: hashToken(refreshToken),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttl).toISOString(),
      ipAddress: ip,
      userAgent: userAgent?.slice(0, 200),
      rememberMe,
    };
    
    await pool.query(
      `INSERT INTO sessions (id, user_id, username, token_hash, created_at, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [session.id, session.userId, session.username, session.tokenHash, session.createdAt, session.expiresAt, session.ipAddress, session.userAgent]
    );
    
    return { refreshToken, sessionId: session.id, expiresAt: session.expiresAt };
  }

  async verify(refreshToken: string): Promise<UserSession | null> {
    const { pool } = await import('../database/connection.js');
    const hash = hashToken(refreshToken);
    const result = await pool.query('SELECT * FROM sessions WHERE token_hash = $1', [hash]);
    const session = result.rows[0];
    if (!session || session.revoked_at) return null;
    if (new Date(session.expires_at).getTime() < Date.now()) return null;
    
    return {
      id: session.id,
      userId: session.user_id,
      username: session.username,
      tokenHash: session.token_hash,
      createdAt: session.created_at,
      expiresAt: session.expires_at,
      revokedAt: session.revoked_at,
      ipAddress: session.ip_address,
      userAgent: session.user_agent,
      rememberMe: true // Approximation since not stored
    };
  }

  async rotate(sessionId: string): Promise<{ refreshToken: string } | null> {
    const { pool } = await import('../database/connection.js');
    const refreshToken = randomBytes(48).toString('hex');
    const tokenHash = hashToken(refreshToken);
    // Assume 30 days extension for rotated token.
    const newExpiresAt = new Date(Date.now() + 30 * DAY).toISOString();
    
    const result = await pool.query(
      `UPDATE sessions SET token_hash = $1, expires_at = $2 WHERE id = $3 AND revoked_at IS NULL RETURNING id`,
      [tokenHash, newExpiresAt, sessionId]
    );
    
    if (result.rowCount === 0) return null;
    return { refreshToken };
  }

  async revoke(sessionId: string) {
    const { pool } = await import('../database/connection.js');
    await pool.query(
      `UPDATE sessions SET revoked_at = $1 WHERE id = $2 AND revoked_at IS NULL`,
      [new Date().toISOString(), sessionId]
    );
  }

  async revokeAllForUser(userId: string, exceptSessionId?: string) {
    const { pool } = await import('../database/connection.js');
    let query = `UPDATE sessions SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL`;
    const params = [new Date().toISOString(), userId];
    if (exceptSessionId) {
      params.push(exceptSessionId);
      query += ` AND id != $3`;
    }
    await pool.query(query, params);
  }
}

export const sessionService = new SessionService();

