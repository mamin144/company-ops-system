/**
 * Phase 7 — Roles Management API, test-first.
 * Fixture custom roles (t7r*) and user t7_user are fully removed in
 * afterAll. Real admin account is never mutated.
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app';
import { authService } from '../src/services/auth.service';
import { userRepository } from '../src/repositories/user.repository';
import { pool } from '../src/database/connection';

let app: any;
let customId = '';

const adminLogin = async () => {
  const r = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
  expect(r.status).toBe(200);
  return r.body.accessToken as string;
};
const login = async (u: string) => {
  const r = await request(app).post('/api/auth/login').send({ username: u, password: 'Secret123!' });
  expect(r.status).toBe(200);
  return r.body.accessToken as string;
};
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  app = await createApp();
  const stale = await userRepository.list().then((a) => a.find((x) => x.username === 't7_user'));
  if (stale) await userRepository.delete(stale.id);
  await userRepository.create({ username: 't7_user', fullName: 't7', passwordHash: authService.hashPassword('Secret123!'), roleName: 'viewer', isActive: true });
  await pool.query(`DELETE FROM roles WHERE name LIKE 't7r%'`);
}, 180000);

afterAll(async () => {
  const t = await adminLogin();
  const u = await userRepository.list().then((a) => a.find((x) => x.username === 't7_user'));
  if (u) {
    const cur = await userRepository.findById(u.id);
    if (cur && cur.roleName !== 'viewer') {
      await request(app).put(`/api/users/${u.id}`).set(auth(await adminLogin())).send({ roleName: 'viewer' });
    }
    await userRepository.delete(u.id);
  }
  await pool.query(`DELETE FROM roles WHERE name LIKE 't7r%' AND is_system = FALSE`);
  const leftR = await pool.query(`SELECT COUNT(*)::int n FROM roles WHERE name LIKE 't7r%'`);
  expect(leftR.rows[0].n).toBe(0);
  const leftU = await pool.query(`SELECT COUNT(*)::int n FROM users WHERE username LIKE 't7\\_%'`);
  expect(leftU.rows[0].n).toBe(0);
  await pool.end();
}, 180000);

describe('Phase7 roles reads', () => {
  it('1. list roles with system flags and user counts', async () => {
    const t = await adminLogin();
    const r = await request(app).get('/api/roles').set(auth(t));
    expect(r.status).toBe(200);
    const names = r.body.map((x: { name: string }) => x.name);
    for (const n of ['admin', 'management', 'warehouse', 'technical', 'viewer']) expect(names).toContain(n);
    const admin = r.body.find((x: { name: string }) => x.name === 'admin');
    expect(admin.is_system).toBe(true);
    expect(admin.permissions).toContain('users.manage');
    expect(typeof admin.userCount).toBe('number');
  });
  it('2. get role', async () => {
    const t = await adminLogin();
    const all = await request(app).get('/api/roles').set(auth(t));
    const id = all.body.find((x: { name: string }) => x.name === 'viewer').id;
    const r = await request(app).get(`/api/roles/${id}`).set(auth(t));
    expect(r.status).toBe(200);
    expect(r.body.name).toBe('viewer');
  });
});

describe('Phase7 custom roles', () => {
  it('3. create custom role', async () => {
    const t = await adminLogin();
    const r = await request(app).post('/api/roles').set(auth(t))
      .send({ name: 't7r-ed', name_ar: 'محرر تجريبي', permissions: ['archive.view', 'archive.edit'] });
    expect(r.status).toBe(201);
    expect(r.body.is_system).toBe(false);
    expect(r.body.permissions).toEqual(['archive.view', 'archive.edit']);
    customId = r.body.id;
  });
  it('4. reject unauthorized create', async () => {
    const s = await login('t7_user');
    expect((await request(app).post('/api/roles').set(auth(s))
      .send({ name: 't7r-no', name_ar: 'x', permissions: [] })).status).toBe(403);
  });
  it('5. edit custom role', async () => {
    const t = await adminLogin();
    const r = await request(app).put(`/api/roles/${customId}`).set(auth(t))
      .send({ name_ar: 'محرر معدل', permissions: ['archive.view'] });
    expect(r.status).toBe(200);
    expect(r.body.name_ar).toBe('محرر معدل');
    expect(r.body.permissions).toEqual(['archive.view']);
  });
  it('16. assign custom role to user; effective reflects it', async () => {
    const t = await adminLogin();
    const u = await userRepository.list().then((a) => a.find((x) => x.username === 't7_user'));
    expect((await request(app).put(`/api/users/${u!.id}`).set(auth(t)).send({ roleName: 't7r-ed' })).status).toBe(200);
    const e = await request(app).get(`/api/users/${u!.id}/effective`).set(auth(t));
    expect(e.body.role).toBe('t7r-ed');
    expect(e.body.permissions['archive.view'].effective).toBe(true);
    expect((await request(app).put(`/api/users/${u!.id}`).set(auth(t)).send({ roleName: 'viewer' })).status).toBe(200);
  });
  it('11. delete custom role with zero users', async () => {
    const t = await adminLogin();
    const c = await request(app).post('/api/roles').set(auth(t))
      .send({ name: 't7r-gone', name_ar: 'زائل', permissions: [] });
    expect((await request(app).delete(`/api/roles/${c.body.id}`).set(auth(t))).status).toBe(204);
  });
  it('12. reject custom role delete with users (+count)', async () => {
    const t = await adminLogin();
    const u = await userRepository.list().then((a) => a.find((x) => x.username === 't7_user'));
    await request(app).put(`/api/users/${u!.id}`).set(auth(t)).send({ roleName: 't7r-ed' });
    const r = await request(app).delete(`/api/roles/${customId}`).set(auth(t));
    expect(r.status).toBe(409);
    expect(r.body.userCount).toBeGreaterThanOrEqual(1);
    await request(app).put(`/api/users/${u!.id}`).set(auth(t)).send({ roleName: 'viewer' });
  });
  it('6. edit system role permissions (coverage kept)', async () => {
    const t = await adminLogin();
    const all = await request(app).get('/api/roles').set(auth(t));
    const viewer = all.body.find((x: { name: string }) => x.name === 'viewer');
    const r = await request(app).put(`/api/roles/${viewer.id}`).set(auth(t))
      .send({ name_ar: 'مشاهدة فقط', permissions: [...viewer.permissions, 'reports.view'] });
    expect(r.status).toBe(200);
    expect(r.body.permissions).toContain('reports.view');
    await request(app).put(`/api/roles/${viewer.id}`).set(auth(t))
      .send({ permissions: viewer.permissions });
  });
});

describe('Phase7 system protection', () => {
  it('7. reject system rename', async () => {
    const t = await adminLogin();
    const all = await request(app).get('/api/roles').set(auth(t));
    const id = all.body.find((x: { name: string }) => x.name === 'viewer').id;
    expect((await request(app).put(`/api/roles/${id}`).set(auth(t)).send({ name: 'renamed' })).status).toBe(400);
  });
  it('8. reject system delete', async () => {
    const t = await adminLogin();
    const all = await request(app).get('/api/roles').set(auth(t));
    const id = all.body.find((x: { name: string }) => x.name === 'admin').id;
    expect((await request(app).delete(`/api/roles/${id}`).set(auth(t))).status).toBe(403);
  });
  it('9/10. clone role with exact permissions', async () => {
    const t = await adminLogin();
    const r = await request(app).post(`/api/roles/${customId}/clone`).set(auth(t)).send({});
    expect(r.status).toBe(201);
    expect(r.body.is_system).toBe(false);
    expect(r.body.name).not.toBe('t7r-ed');
    const src = await request(app).get(`/api/roles/${customId}`).set(auth(t));
    expect(r.body.permissions).toEqual(src.body.permissions);
    const members = await request(app).get(`/api/roles/${r.body.id}/users`).set(auth(t));
    expect(members.body).toEqual([]);
    await request(app).delete(`/api/roles/${r.body.id}`).set(auth(t));
  });
  it('13. reject unknown permission key', async () => {
    const t = await adminLogin();
    expect((await request(app).post('/api/roles').set(auth(t))
      .send({ name: 't7r-bad', name_ar: 'x', permissions: ['nope.x'] })).status).toBe(400);
  });
  it('14. reject admin-lockout mutation', async () => {
    const t = await adminLogin();
    const all = await request(app).get('/api/roles').set(auth(t));
    const admin = all.body.find((x: { name: string }) => x.name === 'admin');
    const stripped = admin.permissions.filter((k: string) => k !== 'users.manage');
    expect((await request(app).put(`/api/roles/${admin.id}`).set(auth(t)).send({ permissions: stripped })).status).toBe(409);
  });
  it('15. verify audit records', async () => {
    const c = await pool.query(`SELECT action FROM audit_logs WHERE action IN ('ROLE_CREATED','ROLE_CLONED','ROLE_DELETED')`);
    expect(c.rows.length).toBeGreaterThan(0);
  });
});
