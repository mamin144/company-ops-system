/**
 * Phase 3 — authentication/session/JWT migration, test-first.
 *
 * Proves the new source of truth over HTTP (supertest + createApp):
 * identity comes from server-side session+user rows, never token claims.
 * Fixture users (t3_viewer1/2) are created in dev cos_db and deleted in
 * afterAll (sessions cascade). No business rows touched otherwise.
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app';
import { authService } from '../src/services/auth.service';
import { sessionService } from '../src/services/session.service';
import { userRepository } from '../src/repositories/user.repository';
import { pool } from '../src/database/connection';

let app: any;
const FX = ['t3_viewer1', 't3_viewer2'] as const;
const fxIds: Record<string, string> = {};

const login = async (username: string, password: string) => {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  expect(res.status).toBe(200);
  const cookies: string[] = res.headers['set-cookie'] ?? [];
  const pick = (n: string) => cookies.find((c) => c.startsWith(`${n}=`))?.split(';')[0].split('=')[1] ?? '';
  return { accessToken: res.body.accessToken as string, sessionId: res.body.sessionId as string, refresh: pick('cos_refresh'), accessCookie: pick('cos_access') };
};
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  app = await createApp();
  for (const u of FX) {
    const existing = await userRepository.list().then((all) => all.find((x) => x.username === u));
    if (existing) await userRepository.delete(existing.id);
    const created = await userRepository.create({
      username: u, fullName: u, passwordHash: authService.hashPassword('Secret123!'), roleName: 'viewer', isActive: true,
    });
    fxIds[u] = created.id;
  }
}, 120000);

afterAll(async () => {
  for (const u of FX) {
    const existing = await userRepository.list().then((all) => all.find((x) => x.username === u));
    if (existing) await userRepository.delete(existing.id);
  }
  await pool.end();
});

describe('Phase3 session validation', () => {
  it('valid session authenticates (Bearer and cookie transports)', async () => {
    const s = await login('t3_viewer1', 'Secret123!');
    const me1 = await request(app).get('/api/auth/me').set(bearer(s.accessToken));
    expect(me1.status).toBe(200);
    expect(me1.body.username).toBe('t3_viewer1');
    const me2 = await request(app).get('/api/auth/me').set('Cookie', `cos_access=${s.accessCookie}`);
    expect(me2.status).toBe(200);
  });
  it('revoked session is rejected immediately', async () => {
    const s = await login('t3_viewer1', 'Secret123!');
    await sessionService.revoke(s.sessionId);
    const me = await request(app).get('/api/auth/me').set(bearer(s.accessToken));
    expect(me.status).toBe(401);
  });
  it('expired session is rejected', async () => {
    const s = await login('t3_viewer1', 'Secret123!');
    await pool.query(`UPDATE sessions SET expires_at = NOW() - interval '1 hour' WHERE id = $1`, [s.sessionId]);
    expect((await request(app).get('/api/auth/me').set(bearer(s.accessToken))).status).toBe(401);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', `cos_refresh=${s.refresh}`)).status).toBe(401);
  });
  it('unknown session id is rejected', async () => {
    const tok = authService.signToken({ sub: fxIds['t3_viewer1'], sid: 'deadbeefdeadbeefdeadbe' } as never);
    expect((await request(app).get('/api/auth/me').set(bearer(tok))).status).toBe(401);
  });
  it('disabled user is rejected with a live access token', async () => {
    const s = await login('t3_viewer2', 'Secret123!');
    try {
      await userRepository.update(fxIds['t3_viewer2'], { isActive: false });
      expect((await request(app).get('/api/auth/me').set(bearer(s.accessToken))).status).toBe(401);
    } finally {
      await userRepository.update(fxIds['t3_viewer2'], { isActive: true });
    }
  });
});

describe('Phase3 JWT shape', () => {
  it('old-shape token without sid is rejected', async () => {
    const tok = authService.signToken({ sub: fxIds['t3_viewer1'], username: 't3_viewer1', roleName: 'viewer' } as never);
    expect((await request(app).get('/api/auth/me').set(bearer(tok))).status).toBe(401);
  });
  it('forged admin role claim has no effect (403, not elevated)', async () => {
    const s = await login('t3_viewer1', 'Secret123!');
    const forged = authService.signToken({ sub: fxIds['t3_viewer1'], username: 't3_viewer1', roleName: 'admin', sid: s.sessionId } as never);
    const res = await request(app).post('/api/users').set(bearer(forged)).send({ username: 'x' });
    expect(res.status).toBe(403);
  });
  it('injected permissions claim has no effect', async () => {
    const s = await login('t3_viewer1', 'Secret123!');
    const forged = authService.signToken({ sub: fxIds['t3_viewer1'], username: 't3_viewer1', roleName: 'viewer', sid: s.sessionId, permissions: ['users.manage'] } as never);
    const res = await request(app).post('/api/users').set(bearer(forged)).send({ username: 'x' });
    expect(res.status).toBe(403);
  });
  it('session bound to another user is rejected', async () => {
    const a = await login('t3_viewer1', 'Secret123!');
    const b = await login('t3_viewer2', 'Secret123!');
    const mixed = authService.signToken({ sub: fxIds['t3_viewer1'], sid: b.sessionId } as never);
    expect((await request(app).get('/api/auth/me').set(bearer(mixed))).status).toBe(401);
    expect(a.accessToken.length).toBeGreaterThan(10);
  });
  it('/me reflects DB-backed permissions, not claims', async () => {
    const s = await login('t3_viewer1', 'Secret123!');
    const me = await request(app).get('/api/auth/me').set(bearer(s.accessToken));
    expect(me.body.permissions).toContain('archive.view');
    expect(me.body.permissions).not.toContain('users.manage');
  });
});

describe('Phase3 rotation and logout', () => {
  it('refresh rotates; old refresh token cannot be reused', async () => {
    const s = await login('t3_viewer1', 'Secret123!');
    const r1 = await request(app).post('/api/auth/refresh').set('Cookie', `cos_refresh=${s.refresh}`);
    expect(r1.status).toBe(200);
    const me = await request(app).get('/api/auth/me').set(bearer(r1.body.accessToken));
    expect(me.status).toBe(200);
    const replay = await request(app).post('/api/auth/refresh').set('Cookie', `cos_refresh=${s.refresh}`);
    expect(replay.status).toBe(401);
  });
  it('logout invalidates current session on both transports', async () => {
    const s = await login('t3_viewer2', 'Secret123!');
    const out = await request(app).post('/api/auth/logout')
      .set(bearer(s.accessToken)).set('Cookie', `cos_refresh=${s.refresh}`);
    expect(out.status).toBe(200);
    expect((await request(app).get('/api/auth/me').set(bearer(s.accessToken))).status).toBe(401);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', `cos_refresh=${s.refresh}`)).status).toBe(401);
  });
});

describe('Phase3 revocation primitive', () => {
  it('revokeAllForUser denies live access tokens', async () => {
    const s = await login('t3_viewer1', 'Secret123!');
    await sessionService.revokeAllForUser(fxIds['t3_viewer1']);
    expect((await request(app).get('/api/auth/me').set(bearer(s.accessToken))).status).toBe(401);
  });
});
