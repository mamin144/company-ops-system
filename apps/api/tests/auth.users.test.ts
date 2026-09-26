/**
 * Phase 6 — Users Management API, test-first.
 *
 * Fixtures (t6_* users, T6P project) are created and fully removed here;
 * audit rows are append-only by design and left in place. Real admin account
 * is never disabled/deleted/demoted — sole-coverage denials are asserted
 * against it without mutating it.
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app';
import { authService } from '../src/services/auth.service';
import { userRepository } from '../src/repositories/user.repository';
import { pool } from '../src/database/connection';

let app: any;
const U: Record<string, string> = {};
let T6P = '';

const adminLogin = async () => {
  const r = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
  expect(r.status).toBe(200);
  return r.body.accessToken as string;
};
const login = async (u: string) => {
  const r = await request(app).post('/api/auth/login').send({ username: u, password: 'Secret123!' });
  expect(r.status).toBe(200);
  return { token: r.body.accessToken as string, sessionId: r.body.sessionId as string };
};
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const mkUser = async (u: string, role: string) => {
  const stale = await userRepository.list().then((a) => a.find((x) => x.username === u));
  if (stale) await userRepository.delete(stale.id);
  const c = await userRepository.create({ username: u, fullName: u, passwordHash: authService.hashPassword('Secret123!'), roleName: role, isActive: true });
  U[u] = c.id;
};
const auditRow = async (action: string, entityId?: string) => {
  const r = await pool.query(
    `SELECT action, entity, entity_id, old_value, new_value FROM audit_logs WHERE action=$1 ${entityId ? 'AND entity_id=$2' : ''} ORDER BY created_at DESC LIMIT 1`,
    entityId ? [action, entityId] : [action],
  );
  return r.rows[0];
};
/** Audit writes are fire-and-forget in handlers: poll briefly instead of racing them. */
const waitForAudit = async (action: string, entityId?: string) => {
  const deadline = Date.now() + 5000;
  for (;;) {
    const row = await auditRow(action, entityId);
    if (row) return row;
    if (Date.now() > deadline) return undefined;
    await new Promise((r) => setTimeout(r, 100));
  }
};

beforeAll(async () => {
  app = await createApp();
  await mkUser('t6_mgr', 'management');
  await mkUser('t6_view', 'viewer');
  await mkUser('t6_tech', 'technical');
  await mkUser('t6_admin2', 'admin');
  const t = await adminLogin();
  const p = await request(app).post('/api/projects').set(auth(t)).send({ projectCode: 'T6P', projectName: 'T6P', status: 'active' });
  expect(p.status).toBe(201);
  T6P = p.body.id;
}, 180000);

afterAll(async () => {
  const t = await adminLogin();
  const H = auth(t);
  await pool.query(`DELETE FROM project_members WHERE user_id IN (SELECT id FROM users WHERE username LIKE 't6\\_%')`);
  await pool.query(`DELETE FROM documents WHERE title LIKE 'T6%'`);
  const tp = await pool.query(`SELECT id FROM projects WHERE project_code='T6P'`);
  for (const r of tp.rows) await request(app).delete(`/api/projects/${r.id}`).set(H);
  for (const u of ['t6_mgr', 't6_view', 't6_tech', 't6_admin2']) {
    const e = await userRepository.list().then((a) => a.find((x) => x.username === u));
    if (e) await userRepository.delete(e.id);
  }
  const left = await pool.query(`SELECT COUNT(*)::int n FROM users WHERE username LIKE 't6\\_%'`);
  expect(left.rows[0].n).toBe(0);
  await pool.end();
}, 180000);

describe('Phase6 user CRUD', () => {
  it('1. authorized create returns user without secrets', async () => {
    const t = await adminLogin();
    const r = await request(app).post('/api/users').set(auth(t))
      .send({ username: 't6_tmp', fullName: 't6', password: 'Secret123!', roleName: 'viewer' });
    expect(r.status).toBe(201);
    expect(r.body.username).toBe('t6_tmp');
    expect(r.body.password).toBeUndefined();
    expect(r.body.passwordHash).toBeUndefined();
    await userRepository.delete(r.body.id);
  });
  it('2. unauthorized create is denied', async () => {
    const s = await login('t6_view');
    expect((await request(app).post('/api/users').set(auth(s.token))
      .send({ username: 't6_no', fullName: 'n', password: 'Secret123!', roleName: 'viewer' })).status).toBe(403);
  });
  it('3. edit updates display fields', async () => {
    const t = await adminLogin();
    const r = await request(app).put(`/api/users/${U['t6_view']}`).set(auth(t)).send({ fullName: 'Viewer Six' });
    expect(r.status).toBe(200);
    expect(r.body.fullName).toBe('Viewer Six');
  });
  it('4/5. disable blocks login, enable restores', async () => {
    const t = await adminLogin();
    expect((await request(app).put(`/api/users/${U['t6_view']}`).set(auth(t)).send({ isActive: false })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ username: 't6_view', password: 'Secret123!' })).status).toBe(401);
    expect((await request(app).put(`/api/users/${U['t6_view']}`).set(auth(t)).send({ isActive: true })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ username: 't6_view', password: 'Secret123!' })).status).toBe(200);
  });
  it('6. delete removes user', async () => {
    const t = await adminLogin();
    const c = await request(app).post('/api/users').set(auth(t))
      .send({ username: 't6_gone', fullName: 'gone', password: 'Secret123!', roleName: 'viewer' });
    expect((await request(app).delete(`/api/users/${c.body.id}`).set(auth(t))).status).toBe(204);
  });
});

describe('Phase6 password reset', () => {
  it('7/8/9. reset succeeds, hash changes, nothing secret leaks', async () => {
    const t = await adminLogin();
    const before = await pool.query(`SELECT password_hash FROM users WHERE id=$1`, [U['t6_view']]);
    const r = await request(app).post(`/api/users/${U['t6_view']}/reset-password`).set(auth(t)).send({ password: 'BrandNew123!' });
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toContain('BrandNew123!');
    const after = await pool.query(`SELECT password_hash FROM users WHERE id=$1`, [U['t6_view']]);
    expect(after.rows[0].password_hash).not.toBe(before.rows[0].password_hash);
    await request(app).post(`/api/users/${U['t6_view']}/reset-password`).set(auth(t)).send({ password: 'Secret123!' });
  });
  it('10/11. reset revokes old sessions; old password fails, new works', async () => {
    const t = await adminLogin();
    const s = await login('t6_tech');
    await request(app).post(`/api/users/${U['t6_tech']}/reset-password`).set(auth(t)).send({ password: 'BrandNew123!' });
    expect((await request(app).get('/api/auth/me').set(auth(s.token))).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ username: 't6_tech', password: 'Secret123!' })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ username: 't6_tech', password: 'BrandNew123!' })).status).toBe(200);
    await request(app).post(`/api/users/${U['t6_tech']}/reset-password`).set(auth(t)).send({ password: 'Secret123!' });
  });
});

describe('Phase6 role assignment', () => {
  it('13. authorized role change updates effective permissions', async () => {
    const t = await adminLogin();
    expect((await request(app).put(`/api/users/${U['t6_view']}`).set(auth(t)).send({ roleName: 'technical' })).status).toBe(200);
    const e = await request(app).get(`/api/users/${U['t6_view']}/effective`).set(auth(t));
    expect(e.status).toBe(200);
    expect(e.body.permissions['archive.edit'].effective).toBe(true);
    await request(app).put(`/api/users/${U['t6_view']}`).set(auth(t)).send({ roleName: 'viewer' });
  });
  it('14. unauthorized role change is denied', async () => {
    const s = await login('t6_view');
    expect((await request(app).put(`/api/users/${U['t6_tech']}`).set(auth(s.token)).send({ roleName: 'viewer' })).status).toBe(403);
  });
  it('15. role change revokes live sessions', async () => {
    const t = await adminLogin();
    const s = await login('t6_tech');
    await request(app).put(`/api/users/${U['t6_tech']}`).set(auth(t)).send({ roleName: 'management' });
    expect((await request(app).get('/api/auth/me').set(auth(s.token))).status).toBe(401);
    await request(app).put(`/api/users/${U['t6_tech']}`).set(auth(t)).send({ roleName: 'technical' });
  });
});

describe('Phase6 overrides', () => {
  it('16. grant flows into effective permissions', async () => {
    const t = await adminLogin();
    const r = await request(app).put(`/api/users/${U['t6_view']}/overrides`).set(auth(t))
      .send({ overrides: [{ permissionKey: 'archive.delete', effect: 'grant' }] });
    expect(r.status).toBe(200);
    const e = await request(app).get(`/api/users/${U['t6_view']}/effective`).set(auth(t));
    expect(e.body.permissions['archive.delete'].effective).toBe(true);
    expect(e.body.permissions['archive.delete'].source).toBe('grant-override');
  });
  it('17. deny removes inherited access through HTTP', async () => {
    const t = await adminLogin();
    await request(app).put(`/api/users/${U['t6_view']}/overrides`).set(auth(t))
      .send({ overrides: [{ permissionKey: 'archive.view', effect: 'deny' }] });
    const s = await login('t6_view');
    expect((await request(app).get('/api/documents').set(auth(s.token))).status).toBe(403);
    await request(app).delete(`/api/users/${U['t6_view']}/overrides/archive.view`).set(auth(t));
  });
  it('18. delete override restores inheritance', async () => {
    const t = await adminLogin();
    await request(app).put(`/api/users/${U['t6_view']}/overrides`).set(auth(t))
      .send({ overrides: [{ permissionKey: 'archive.delete', effect: 'grant' }] });
    expect((await request(app).delete(`/api/users/${U['t6_view']}/overrides/archive.delete`).set(auth(t))).status).toBe(204);
    const e = await request(app).get(`/api/users/${U['t6_view']}/effective`).set(auth(t));
    expect(e.body.permissions['archive.delete'].effective).toBe(false);
    expect(e.body.permissions['archive.delete'].source).toBe('role');
  });
  it('20. override mutation revokes live sessions', async () => {
    const t = await adminLogin();
    const s = await login('t6_view');
    await request(app).put(`/api/users/${U['t6_view']}/overrides`).set(auth(t))
      .send({ overrides: [{ permissionKey: 'archive.delete', effect: 'grant' }] });
    expect((await request(app).get('/api/auth/me').set(auth(s.token))).status).toBe(401);
    await request(app).delete(`/api/users/${U['t6_view']}/overrides/archive.delete`).set(auth(t));
  });
  it('21. unknown permission key rejected', async () => {
    const t = await adminLogin();
    expect((await request(app).put(`/api/users/${U['t6_view']}/overrides`).set(auth(t))
      .send({ overrides: [{ permissionKey: 'nope.x', effect: 'grant' }] })).status).toBe(400);
  });
});

describe('Phase6 project access API', () => {
  it('22/23/24. assign READ/WRITE/DELETE round-trips', async () => {
    const t = await adminLogin();
    for (const level of ['READ', 'WRITE', 'DELETE']) {
      const r = await request(app).put(`/api/users/${U['t6_view']}/projects`).set(auth(t))
        .send({ access: [{ projectId: T6P, access: level }] });
      expect(r.status).toBe(200);
      const g = await request(app).get(`/api/users/${U['t6_view']}/projects`).set(auth(t));
      expect(g.body.find((m: { projectId: string }) => m.projectId === T6P)?.access).toBe(level);
    }
    await request(app).put(`/api/users/${U['t6_view']}/projects`).set(auth(t)).send({ access: [] });
  });
  it('25. invalid level rejected', async () => {
    const t = await adminLogin();
    expect((await request(app).put(`/api/users/${U['t6_view']}/projects`).set(auth(t))
      .send({ access: [{ projectId: T6P, access: 'SUPER' }] })).status).toBe(400);
  });
  it('26. membership visible on both sides', async () => {
    const t = await adminLogin();
    await request(app).put(`/api/users/${U['t6_view']}/projects`).set(auth(t)).send({ access: [{ projectId: T6P, access: 'READ' }] });
    const members = await request(app).get(`/api/projects/${T6P}/members`).set(auth(t));
    expect(members.status).toBe(200);
    expect(members.body.map((m: { userId: string }) => m.userId)).toContain(U['t6_view']);
    await request(app).put(`/api/users/${U['t6_view']}/projects`).set(auth(t)).send({ access: [] });
  });
  it('27. unauthorized access-management denied', async () => {
    const s = await login('t6_view');
    expect((await request(app).put(`/api/users/${U['t6_tech']}/projects`).set(auth(s.token))
      .send({ access: [{ projectId: T6P, access: 'READ' }] })).status).toBe(403);
  });
});

describe('Phase6 admin safety', () => {
  it('31. self-disable denied', async () => {
    const s = await login('t6_admin2');
    expect((await request(app).put(`/api/users/${U['t6_admin2']}`).set(auth(s.token)).send({ isActive: false })).status).toBe(403);
  });
  it('32. self-demote denied', async () => {
    const s = await login('t6_admin2');
    expect((await request(app).put(`/api/users/${U['t6_admin2']}`).set(auth(s.token)).send({ roleName: 'viewer' })).status).toBe(403);
  });
  it('28. demoting second admin allowed while coverage remains', async () => {
    const t = await adminLogin();
    expect((await request(app).put(`/api/users/${U['t6_admin2']}`).set(auth(t)).send({ roleName: 'viewer' })).status).toBe(200);
  });
  it('29. deleting sole-coverage admin denied', async () => {
    const t = await adminLogin();
    const me = await userRepository.list().then((a) => a.find((x) => x.username === 'admin'));
    expect((await request(app).delete(`/api/users/${me!.id}`).set(auth(t))).status).toBe(409);
    expect(await userRepository.findById(me!.id)).not.toBeUndefined();
  });
  it('30. demoting sole-coverage admin denied', async () => {
    const t = await adminLogin();
    // Arm a non-covering actor: users.manage WITHOUT roles.manage can call
    // the endpoint but can never constitute coverage itself.
    await request(app).put(`/api/users/${U['t6_mgr']}/overrides`).set(auth(t))
      .send({ overrides: [{ permissionKey: 'users.manage', effect: 'grant' }] });
    const s = await login('t6_mgr');
    const me = await userRepository.list().then((a) => a.find((x) => x.username === 'admin'));
    expect((await request(app).put(`/api/users/${me!.id}`).set(auth(s.token)).send({ roleName: 'viewer' })).status).toBe(409);
    expect((await userRepository.findById(me!.id))?.roleName).toBe('admin');
    await request(app).delete(`/api/users/${U['t6_mgr']}/overrides/users.manage`).set(auth(t));
  });
});

describe('Phase6 effective endpoint', () => {
  it('self can inspect own effective permissions', async () => {
    const s = await login('t6_view');
    const r = await request(app).get(`/api/users/${U['t6_view']}/effective`).set(auth(s.token));
    expect(r.status).toBe(200);
    expect(r.body.permissions['archive.view'].effective).toBe(true);
  });
  it('inspecting others requires administration', async () => {
    const s = await login('t6_view');
    expect((await request(app).get(`/api/users/${U['t6_tech']}/effective`).set(auth(s.token))).status).toBe(403);
  });
  it('projectId param shows project restriction', async () => {
    const t = await adminLogin();
    await request(app).put(`/api/users/${U['t6_view']}/projects`).set(auth(t)).send({ access: [{ projectId: T6P, access: 'READ' }] });
    const r = await request(app).get(`/api/users/${U['t6_view']}/effective?projectId=${T6P}`).set(auth(t));
    expect(r.body.permissions['archive.view'].effective).toBe(true);
    expect(r.body.permissions['archive.edit'].effective).toBe(false);
    await request(app).put(`/api/users/${U['t6_view']}/projects`).set(auth(t)).send({ access: [] });
  });
});

describe('Phase6 audit', () => {
  it('33/34/35. mutations audited without secrets', async () => {
    const t = await adminLogin();
    const c = await request(app).post('/api/users').set(auth(t))
      .send({ username: 't6_aud', fullName: 'aud', password: 'Secret123!', roleName: 'viewer' });
    try {
      const created = await waitForAudit('create', c.body.id);
      expect(created).toBeDefined();
      await request(app).post(`/api/users/${c.body.id}/reset-password`).set(auth(t)).send({ password: 'Other123!' });
      const reset = await waitForAudit('PASSWORD_RESET', c.body.id);
      expect(reset).toBeDefined();
      expect(JSON.stringify(reset)).not.toContain('Other123!');
      await request(app).put(`/api/users/${c.body.id}/overrides`).set(auth(t))
        .send({ overrides: [{ permissionKey: 'archive.delete', effect: 'grant' }] });
      const granted = await waitForAudit('PERMISSION_GRANTED', c.body.id);
      expect(granted).toBeDefined();
    } finally {
      await userRepository.delete(c.body.id);
    }
  });
});
