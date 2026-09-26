/**
 * Phase 4 — middleware migrated to the central resolver.
 *
 * Proves requirePermission/requireAnyPermission resolve from DB-backed
 * authorization.service (loadContext + can) and NEVER trust the
 * req.user.permissions snapshot: tampered or deleted arrays must not
 * change the verdict. HTTP tests prove behavior preservation + override
 * enforcement through real routes. Fixture user t4_viewer is removed in
 * afterAll (sessions/overrides cascade).
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app';
import { authService } from '../src/services/auth.service';
import { userRepository } from '../src/repositories/user.repository';
import { warehouseRepository } from '../src/repositories/warehouse.repository';
import { projectRepository } from '../src/repositories/project.repository';
import { requirePermission, requireAnyPermission } from '../src/middleware/auth';
import type { AuthedRequest } from '../src/middleware/auth';
import { pool } from '../src/database/connection';

let app: any;
let viewerId = '';

const mockRes = () => {
  const res: any = { statusCode: 0, body: undefined };
  res.status = (c: number) => { res.statusCode = c; return { json: (o: unknown) => { res.body = o; } }; };
  return res;
};

beforeAll(async () => {
  app = await createApp();
  const stale = await userRepository.list().then((all) => all.find((x) => x.username === 't4_viewer'));
  if (stale) await userRepository.delete(stale.id);
  const created = await userRepository.create({
    username: 't4_viewer', fullName: 't4', passwordHash: authService.hashPassword('Secret123!'), roleName: 'viewer', isActive: true,
  });
  viewerId = created.id;
}, 120000);

afterAll(async () => {
  await pool.query(`DELETE FROM user_permission_overrides WHERE user_id = $1`, [viewerId]).catch(() => undefined);
  const existing = await userRepository.list().then((all) => all.find((x) => x.username === 't4_viewer'));
  if (existing) await userRepository.delete(existing.id);
  await pool.end();
});

const reqWith = (user: unknown): AuthedRequest => ({ user } as AuthedRequest);

describe('Phase4 source-of-truth (direct middleware invocation)', () => {
  it('ignores a tampered req.user.permissions array (viewer must stay denied)', async () => {
    let next = false;
    const req = reqWith({ id: viewerId, permissions: ['users.manage', 'archive.delete'] });
    await requirePermission('archive.delete')(req, mockRes(), () => { next = true; });
    expect(next).toBe(false);
  });
  it('ignores tampering in requireAnyPermission', async () => {
    let next = false;
    const req = reqWith({ id: viewerId, permissions: ['projects.edit'] });
    await requireAnyPermission('projects.edit', 'projects.delete')(req, mockRes(), () => { next = true; });
    expect(next).toBe(false);
  });
  it('evaluates from the resolver when the permissions array is missing entirely', async () => {
    const res = mockRes();
    let nextHeld = false;
    let nextMissing = false;
    const reqHeld = reqWith({ id: viewerId });
    delete (reqHeld.user as Record<string, unknown> | undefined)?.permissions;
    await requirePermission('archive.view')(reqHeld, mockRes(), () => { nextHeld = true; });
    const reqMissing = reqWith({ id: viewerId });
    delete (reqMissing.user as Record<string, unknown> | undefined)?.permissions;
    await requirePermission('archive.delete')(reqMissing, res, () => { nextMissing = true; });
    expect(nextHeld).toBe(true);
    expect(nextMissing).toBe(false);
    expect(res.statusCode).toBe(403);
  });
  it('denies unknown permission keys', async () => {
    const res = mockRes();
    let next = false;
    await requirePermission('nope.notreal')(reqWith({ id: viewerId, permissions: [] }), res, () => { next = true; });
    expect(next).toBe(false);
    expect(res.statusCode).toBe(403);
  });
  it('requireAnyPermission allows when one of several is held', async () => {
    let next = false;
    await requireAnyPermission('archive.view', 'nope.key')(reqWith({ id: viewerId, permissions: ['archive.view'] }), mockRes(), () => { next = true; });
    expect(next).toBe(true);
  });
  it('requireAnyPermission denies when all are denied/unknown', async () => {
    const res = mockRes();
    let next = false;
    await requireAnyPermission('nope.a', 'archive.delete')(reqWith({ id: viewerId, permissions: [] }), res, () => { next = true; });
    expect(next).toBe(false);
    expect(res.statusCode).toBe(403);
  });
  it('caches one context per request for repeated evaluations', async () => {
    const req = reqWith({ id: viewerId, permissions: ['archive.view', 'warehouse.view'] });
    let n1 = false;
    let n2 = false;
    await requirePermission('archive.view')(req, mockRes(), () => { n1 = true; });
    const cached = (req as unknown as { authzContext?: unknown }).authzContext;
    expect(cached).toBeDefined();
    await requirePermission('warehouse.view')(req, mockRes(), () => { n2 = true; });
    expect(n1).toBe(true);
    expect(n2).toBe(true);
    expect((req as unknown as { authzContext?: unknown }).authzContext).toBe(cached);
  });
});

describe('Phase4 HTTP behavior preservation + overrides', () => {
  it('role grant still allows, role deny still denies', async () => {
    const login = await request(app).post('/api/auth/login').send({ username: 't4_viewer', password: 'Secret123!' });
    const t = login.body.accessToken as string;
    expect((await request(app).get('/api/documents').set('Authorization', `Bearer ${t}`)).status).toBe(200);
    expect((await request(app).get('/api/users').set('Authorization', `Bearer ${t}`)).status).toBe(403);
  });
  it('GRANT override opens a route through HTTP', async () => {
    await pool.query(
      `INSERT INTO user_permission_overrides (user_id, permission_key, effect, created_by) VALUES ($1,'warehouse.create','grant','t') ON CONFLICT DO NOTHING`,
      [viewerId],
    );
    try {
      const login = await request(app).post('/api/auth/login').send({ username: 't4_viewer', password: 'Secret123!' });
      const res = await request(app).post('/api/warehouses')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .send({ code: 'T4W1', name: 'T4', type: 'central', status: 'active' });
      expect(res.status).toBe(201);
      await warehouseRepository.delete(res.body.id);
    } finally {
      await pool.query(`DELETE FROM user_permission_overrides WHERE user_id=$1`, [viewerId]);
    }
  });
  it('DENY override closes a route through HTTP', async () => {
    await pool.query(
      `INSERT INTO user_permission_overrides (user_id, permission_key, effect, created_by) VALUES ($1,'archive.view','deny','t') ON CONFLICT DO NOTHING`,
      [viewerId],
    );
    try {
      const login = await request(app).post('/api/auth/login').send({ username: 't4_viewer', password: 'Secret123!' });
      expect((await request(app).get('/api/documents').set('Authorization', `Bearer ${login.body.accessToken}`)).status).toBe(403);
    } finally {
      await pool.query(`DELETE FROM user_permission_overrides WHERE user_id=$1`, [viewerId]);
    }
  });
  it('HTTP all-denied requireAnyPermission path stays 403 without writes', async () => {
    const projects = await projectRepository.list();
    expect(projects.length).toBeGreaterThan(0);
    const login = await request(app).post('/api/auth/login').send({ username: 't4_viewer', password: 'Secret123!' });
    const res = await request(app).post(`/api/projects/${projects[0].id}/boq`)
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ itemCode: 'X', description: 'X', unit: 'pcs', quantity: 1, unitPrice: 1 });
    expect(res.status).toBe(403);
  });
});
