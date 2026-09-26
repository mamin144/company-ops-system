/**
 * Phase 8 — Project Access Management API, test-first.
 *
 * Endpoints under test (all gated by `projects.access` unless noted):
 *   GET /api/users/:id/projects   — full project list w/ NONE defaults
 *   PUT /api/users/:id/projects    — transactional REPLACE, per-change audit
 *   GET /api/projects/:id/members  — safe member projection
 *   POST /api/projects             — creator auto-grant DELETE
 *
 * Fixtures (t8_* users, T8P/T8Q projects) are created and fully removed here;
 * audit rows are append-only by design and left in place.
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app';
import { authService } from '../src/services/auth.service';
import { userRepository } from '../src/repositories/user.repository';
import { pool } from '../src/database/connection';

let app: any;
const U: Record<string, string> = {};
let T8P = '';
let T8Q = '';

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
const mkUser = async (u: string, role: string) => {
  const stale = await userRepository.list().then((a) => a.find((x) => x.username === u));
  if (stale) await userRepository.delete(stale.id);
  const c = await userRepository.create({ username: u, fullName: u, passwordHash: authService.hashPassword('Secret123!'), roleName: role, isActive: true });
  U[u] = c.id;
};
const accessCount = async (userId: string) => {
  const r = await pool.query(
    `SELECT COUNT(*)::int n FROM audit_logs WHERE action='PROJECT_ACCESS_CHANGED' AND entity_id=$1`,
    [userId],
  );
  return r.rows[0].n as number;
};
const waitForAccessCount = async (userId: string, min: number) => {
  const deadline = Date.now() + 5000;
  for (;;) {
    const n = await accessCount(userId);
    if (n >= min) return n;
    if (Date.now() > deadline) return n;
    await new Promise((r) => setTimeout(r, 100));
  }
};
const nonNone = (rows: Array<{ projectId: string; access: string }>) =>
  rows.filter((m) => m.access !== 'NONE').map((m) => `${m.projectId}:${m.access}`).sort();

beforeAll(async () => {
  app = await createApp();
  await mkUser('t8_view', 'viewer');
  await mkUser('t8_mgr', 'management');
  // NOTE: t8_admin2 is deliberately NOT a full admin. A second admin-role
  // user dilutes sole-admin coverage, which lets auth.users test 29
  // ("deleting sole-coverage admin denied") actually delete the real admin
  // in parallel runs. Least privilege instead: viewer + projects.access
  // override grant — enough to manage others' memberships, never coverage.
  await mkUser('t8_admin2', 'viewer');
  await mkUser('t8_aud', 'viewer');
  const t = await adminLogin();
  const g = await request(app).put(`/api/users/${U['t8_admin2']}/overrides`).set(auth(t))
    .send({ overrides: [{ permissionKey: 'projects.access', effect: 'grant' }] });
  expect(g.status).toBe(200);
  for (const code of ['T8P', 'T8Q']) {
    const p = await request(app).post('/api/projects').set(auth(t)).send({ projectCode: code, projectName: code, status: 'active' });
    expect(p.status).toBe(201);
    if (code === 'T8P') T8P = p.body.id;
    else T8Q = p.body.id;
  }
}, 180000);

afterAll(async () => {
  const t = await adminLogin();
  const H = auth(t);
  await pool.query(`DELETE FROM project_members WHERE user_id IN (SELECT id FROM users WHERE username LIKE 't8\\_%')`);
  await pool.query(`DELETE FROM documents WHERE title LIKE 'T8%'`);
  for (const code of ['T8P', 'T8Q']) {
    const tp = await pool.query(`SELECT id FROM projects WHERE project_code=$1`, [code]);
    for (const r of tp.rows) await request(app).delete(`/api/projects/${r.id}`).set(H);
  }
  for (const u of ['t8_view', 't8_mgr', 't8_admin2', 't8_aud']) {
    const e = await userRepository.list().then((a) => a.find((x) => x.username === u));
    if (e) await userRepository.delete(e.id);
  }
  const left = await pool.query(`SELECT COUNT(*)::int n FROM users WHERE username LIKE 't8\\_%'`);
  expect(left.rows[0].n).toBe(0);
  await pool.end();
}, 180000);

describe('Phase8 read shape', () => {
  it('1. GET returns every project with NONE defaults', async () => {
    const t = await adminLogin();
    await request(app).put(`/api/users/${U['t8_view']}/projects`).set(auth(t)).send({ access: [{ projectId: T8P, access: 'READ' }] });
    const g = await request(app).get(`/api/users/${U['t8_view']}/projects`).set(auth(t));
    expect(g.status).toBe(200);
    const byId = new Map(g.body.map((m: { projectId: string; access: string }) => [m.projectId, m.access]));
    expect(byId.get(T8P)).toBe('READ');
    expect(byId.get(T8Q)).toBe('NONE');
    const row = g.body.find((m: { projectId: string }) => m.projectId === T8Q);
    expect(row.projectCode).toBe('T8Q');
    await request(app).put(`/api/users/${U['t8_view']}/projects`).set(auth(t)).send({ access: [] });
  });
  it('2. GET unknown user is 404', async () => {
    const t = await adminLogin();
    expect((await request(app).get(`/api/users/00000000-0000-0000-0000-000000000000/projects`).set(auth(t))).status).toBe(404);
  });
  it('3. GET members unknown project is 404', async () => {
    const t = await adminLogin();
    expect((await request(app).get(`/api/projects/00000000-0000-0000-0000-000000000000/members`).set(auth(t))).status).toBe(404);
  });
  it('4. viewer is denied both read endpoints', async () => {
    const s = await login('t8_view');
    expect((await request(app).get(`/api/users/${U['t8_mgr']}/projects`).set(auth(s))).status).toBe(403);
    expect((await request(app).get(`/api/projects/${T8P}/members`).set(auth(s))).status).toBe(403);
  });
});

describe('Phase8 replace semantics', () => {
  it('5. omitted memberships become NONE (pure replace)', async () => {
    const t = await adminLogin();
    await request(app).put(`/api/users/${U['t8_view']}/projects`).set(auth(t))
      .send({ access: [{ projectId: T8P, access: 'READ' }, { projectId: T8Q, access: 'WRITE' }] });
    const r = await request(app).put(`/api/users/${U['t8_view']}/projects`).set(auth(t))
      .send({ access: [{ projectId: T8Q, access: 'WRITE' }] });
    expect(r.status).toBe(200);
    expect(nonNone(r.body)).toEqual([`${T8Q}:WRITE`]);
    await request(app).put(`/api/users/${U['t8_view']}/projects`).set(auth(t)).send({ access: [] });
  });
  it('6. duplicate projectIds are rejected 400 with state intact', async () => {
    const t = await adminLogin();
    await request(app).put(`/api/users/${U['t8_view']}/projects`).set(auth(t)).send({ access: [{ projectId: T8P, access: 'READ' }] });
    const r = await request(app).put(`/api/users/${U['t8_view']}/projects`).set(auth(t))
      .send({ access: [{ projectId: T8P, access: 'READ' }, { projectId: T8P, access: 'WRITE' }] });
    expect(r.status).toBe(400);
    const g = await request(app).get(`/api/users/${U['t8_view']}/projects`).set(auth(t));
    expect(nonNone(g.body)).toEqual([`${T8P}:READ`]);
    await request(app).put(`/api/users/${U['t8_view']}/projects`).set(auth(t)).send({ access: [] });
  });
  it('7. unknown project aborts with 404 and no partial writes', async () => {
    const t = await adminLogin();
    const r = await request(app).put(`/api/users/${U['t8_view']}/projects`).set(auth(t))
      .send({ access: [{ projectId: T8P, access: 'READ' }, { projectId: '00000000-0000-0000-0000-000000000000', access: 'READ' }] });
    expect(r.status).toBe(404);
    const g = await request(app).get(`/api/users/${U['t8_view']}/projects`).set(auth(t));
    expect(nonNone(g.body)).toEqual([]);
  });
  it('8. PUT unknown user is 404', async () => {
    const t = await adminLogin();
    expect((await request(app).put(`/api/users/00000000-0000-0000-0000-000000000000/projects`).set(auth(t))
      .send({ access: [{ projectId: T8P, access: 'READ' }] })).status).toBe(404);
  });
  it('9. self-modification is 403 even with the permission', async () => {
    const t = await adminLogin();
    // t8_admin2 holds projects.access (can manage others) but never self.
    expect((await request(app).put(`/api/users/${U['t8_mgr']}/projects`).set(auth(await login('t8_admin2')))
      .send({ access: [] })).status).toBe(200);
    const s = await login('t8_admin2');
    expect((await request(app).put(`/api/users/${U['t8_admin2']}/projects`).set(auth(s))
      .send({ access: [] })).status).toBe(403);
    await request(app).put(`/api/users/${U['t8_mgr']}/projects`).set(auth(t)).send({ access: [] });
  });
  it('10. concurrent replaces stay coherent (last-writer-wins, never mixed)', async () => {
    const t = await adminLogin();
    await request(app).put(`/api/users/${U['t8_mgr']}/projects`).set(auth(t)).send({ access: [] });
    const H = auth(t);
    const [a, b] = await Promise.all([
      request(app).put(`/api/users/${U['t8_mgr']}/projects`).set(H).send({ access: [{ projectId: T8P, access: 'READ' }] }),
      request(app).put(`/api/users/${U['t8_mgr']}/projects`).set(H).send({ access: [{ projectId: T8Q, access: 'WRITE' }] }),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const g = await request(app).get(`/api/users/${U['t8_mgr']}/projects`).set(H);
    expect([[`${T8P}:READ`], [`${T8Q}:WRITE`]]).toContainEqual(nonNone(g.body));
    await request(app).put(`/api/users/${U['t8_mgr']}/projects`).set(H).send({ access: [] });
  });
});

describe('Phase8 audit + bypass + creator grant', () => {
  it('11. one audit event per changed membership', async () => {
    const t = await adminLogin();
    const H = auth(t);
    await request(app).put(`/api/users/${U['t8_aud']}/projects`).set(H).send({ access: [] });
    const base = await waitForAccessCount(U['t8_aud'], 1);
    await request(app).put(`/api/users/${U['t8_aud']}/projects`).set(H)
      .send({ access: [{ projectId: T8P, access: 'READ' }, { projectId: T8Q, access: 'WRITE' }] });
    expect(await waitForAccessCount(U['t8_aud'], base + 2)).toBeGreaterThanOrEqual(base + 2);
    const rows = await pool.query(
      `SELECT new_value FROM audit_logs WHERE action='PROJECT_ACCESS_CHANGED' AND entity_id=$1 ORDER BY created_at DESC LIMIT 2`,
      [U['t8_aud']],
    );
    expect(rows.rows.length).toBe(2);
    for (const r of rows.rows) {
      const v = typeof r.new_value === 'string' ? JSON.parse(r.new_value) : r.new_value;
      expect(v.projectId).toBeDefined();
      expect(v.access).toBeDefined();
    }
    await request(app).put(`/api/users/${U['t8_aud']}/projects`).set(H).send({ access: [] });
  });
  it('12. unchanged memberships emit no new audit events', async () => {
    const t = await adminLogin();
    const H = auth(t);
    const c0 = await accessCount(U['t8_aud']);
    await request(app).put(`/api/users/${U['t8_aud']}/projects`).set(H).send({ access: [{ projectId: T8P, access: 'READ' }] });
    const before = await waitForAccessCount(U['t8_aud'], c0 + 1);
    expect(before).toBeGreaterThanOrEqual(c0 + 1);
    await request(app).put(`/api/users/${U['t8_aud']}/projects`).set(H).send({ access: [{ projectId: T8P, access: 'READ' }] });
    await new Promise((r) => setTimeout(r, 1000));
    expect(await accessCount(U['t8_aud'])).toBe(before);
    await request(app).put(`/api/users/${U['t8_aud']}/projects`).set(H).send({ access: [] });
  });
  it('13. access holder manages a project they hold NONE on (bypass never grants)', async () => {
    const t = await adminLogin();
    const H = auth(t);
    // Strip every membership the creator auto-grant gave admin on T8Q.
    const me = await userRepository.list().then((a) => a.find((x) => x.username === 'admin'));
    await pool.query(`DELETE FROM project_members WHERE user_id=$1 AND project_id=$2`, [me!.id, T8Q]);
    const r = await request(app).put(`/api/users/${U['t8_view']}/projects`).set(H).send({ access: [{ projectId: T8Q, access: 'READ' }] });
    expect(r.status).toBe(200);
    await request(app).put(`/api/users/${U['t8_view']}/projects`).set(H).send({ access: [] });
  });
  it('14. creator holds DELETE on a project they just created', async () => {
    const t = await adminLogin();
    const p = await request(app).post('/api/projects').set(auth(t)).send({ projectCode: 'T8C', projectName: 'T8C', status: 'active' });
    expect(p.status).toBe(201);
    try {
      const m = await request(app).get(`/api/projects/${p.body.id}/members`).set(auth(t));
      const me = await userRepository.list().then((a) => a.find((x) => x.username === 'admin'));
      expect(m.body.find((x: { userId: string }) => x.userId === me!.id)?.access).toBe('DELETE');
    } finally {
      await request(app).delete(`/api/projects/${p.body.id}`).set(auth(t));
    }
  });
});
