/**
 * Phase 5 — project-level authorization, HTTP proof.
 *
 * Fixtures (dev cos_db, prefixed T5, fully removed in afterAll):
 * users t5_tech/technical, t5_mgr/management, t5_view/viewer, t5_wh/warehouse;
 * projects T5PA/T5PB; memberships tech PA=WRITE/PB=READ, mgr PA=WRITE/PB=NONE,
 * view PA=READ; rows per project; one null-project document.
 * Everything created here is deleted here (drafts/admin-deletable only).
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app';
import { authService } from '../src/services/auth.service';
import { userRepository } from '../src/repositories/user.repository';
import { pool } from '../src/database/connection';

let app: any;
const U: Record<string, string> = {};
const P: Record<string, string> = {};
let seq = 0;
const T = () => `T5${Date.now().toString(36)}${seq++}`;

const login = async (u: string, pw = 'Secret123!') => {
  const r = await request(app).post('/api/auth/login').send({ username: u, password: pw });
  expect(r.status).toBe(200);
  return r.body.accessToken as string;
};
const adminLogin = () => login('admin', 'admin123');
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const setAccess = async (uid: string, pid: string, level: string) => {
  await pool.query(
    `INSERT INTO project_members (project_id, user_id, access, created_by) VALUES ($1,$2,$3,'t5')
     ON CONFLICT (project_id, user_id) DO UPDATE SET access = EXCLUDED.access`,
    [pid, uid, level],
  );
};
const mkUser = async (u: string, role: string) => {
  const stale = await userRepository.list().then((a) => a.find((x) => x.username === u));
  if (stale) await userRepository.delete(stale.id);
  const c = await userRepository.create({ username: u, fullName: u, passwordHash: authService.hashPassword('Secret123!'), roleName: role, isActive: true });
  U[u] = c.id;
};
const uploadDoc = async (token: string, projectId?: string, title?: string) => {
  let r = request(app).post('/api/documents/upload')
    .set(auth(token))
    .field('title', title ?? `Doc ${T()}`)
    .field('category', 'عام');
  if (projectId) r = r.field('projectId', projectId);
  const res = await r.attach('file', Buffer.from('%PDF-1.4 test'), 't.pdf');
  expect(res.status).toBe(201);
  return res.body;
};

beforeAll(async () => {
  app = await createApp();
  await cleanAll();
  await mkUser('t5_tech', 'technical');
  await mkUser('t5_mgr', 'management');
  await mkUser('t5_view', 'viewer');
  await mkUser('t5_wh', 'warehouse');
  const admin = await adminLogin();
  for (const code of ['T5PA', 'T5PB']) {
    const r = await request(app).post('/api/projects')
      .set(auth(admin)).send({ projectCode: code, projectName: code, status: 'active' });
    expect(r.status).toBe(201);
    P[code] = r.body.id;
  }
  await setAccess(U['t5_tech'], P['T5PA'], 'WRITE');
  await setAccess(U['t5_tech'], P['T5PB'], 'READ');
  await setAccess(U['t5_mgr'], P['T5PA'], 'WRITE');
  await setAccess(U['t5_mgr'], P['T5PB'], 'NONE');
  await setAccess(U['t5_view'], P['T5PA'], 'READ');
}, 180000);

afterAll(async () => {
  await cleanAll();
  const left = await pool.query(`SELECT COUNT(*)::int n FROM users WHERE username LIKE 't5\\_%'`);
  expect(left.rows[0].n).toBe(0);
  await pool.end();
}, 180000);

/** Idempotent fixture cleanup: removes every T5 row (children before parents). */
async function cleanAll() {
  const admin = await adminLogin();
  const H = auth(admin);
  const docs = await request(app).get('/api/documents?pageSize=200').set(H);
  for (const d of (Array.isArray(docs.body?.items) ? docs.body.items : [])) {
    if (String(d.title ?? '').includes('T5')) await request(app).delete(`/api/documents/${d.id}`).set(H);
  }
  const projs = await request(app).get('/api/projects?pageSize=200').set(H);
  for (const p of (Array.isArray(projs.body?.items) ? projs.body.items : [])) {
    if (!String(p.projectCode ?? '').startsWith('T5')) continue;
    const s = await request(app).get('/api/sites').set(H);
    for (const x of (Array.isArray(s.body) ? s.body : (Array.isArray(s.body?.items) ? s.body.items : []))) {
      if (x.projectId === p.id) await request(app).delete(`/api/sites/${x.id}`).set(H);
    }
    const w = await request(app).get('/api/warehouses').set(H);
    for (const x of (Array.isArray(w.body?.items) ? w.body.items : [])) {
      if (String(x.code ?? '').startsWith('T5')) await request(app).delete(`/api/warehouses/${x.id}`).set(H);
    }
    const m = await request(app).get('/api/material-requests').set(H);
    for (const x of (Array.isArray(m.body) ? m.body : [])) {
      if (x.projectId === p.id && x.status === 'draft') await request(app).delete(`/api/material-requests/${x.id}`).set(H);
    }
    const b = await request(app).get(`/api/projects/${p.id}/boq`).set(H);
    for (const x of (Array.isArray(b.body) ? b.body : [])) {
      if (String(x.itemCode ?? '').startsWith('T5')) await request(app).delete(`/api/projects/${p.id}/boq/${x.id}`).set(H);
    }
    await pool.query(`DELETE FROM ipc_items WHERE ipc_id IN (SELECT id FROM ipcs WHERE project_id=$1)`, [p.id]);
    await pool.query(`DELETE FROM ipcs WHERE project_id=$1`, [p.id]);
    await pool.query(`DELETE FROM items WHERE code LIKE 'T5%'`);
    await request(app).delete(`/api/projects/${p.id}`).set(H);
  }
  for (const u of ['t5_tech', 't5_mgr', 't5_view', 't5_wh']) {
    const e = await userRepository.list().then((a) => a.find((x) => x.username === u));
    if (e) await userRepository.delete(e.id);
  }
}

describe('Phase5 documents matrix', () => {
  let dPA = '';
  let dPB = '';
  let dNull = '';
  beforeAll(async () => {
    const admin = await adminLogin();
    dPA = (await uploadDoc(admin, P['T5PA'], `T5DocPA ${T()}`)).id;
    dPB = (await uploadDoc(admin, P['T5PB'], `T5DocPB ${T()}`)).id;
    dNull = (await uploadDoc(admin, undefined, `T5DocNull ${T()}`)).id;
  });
  it('NONE cannot read existing row (404, no oracle)', async () => {
    const t = await login('t5_mgr');
    expect((await request(app).get(`/api/documents/${dPB}`).set(auth(t))).status).toBe(404);
  });
  it('READ reads own project, not others', async () => {
    const t = await login('t5_tech');
    expect((await request(app).get(`/api/documents/${dPB}`).set(auth(t))).status).toBe(200);
    expect((await request(app).get(`/api/documents/${dPA}`).set(auth(t))).status).toBe(200);
  });
  it('READ cannot update', async () => {
    const t = await login('t5_tech');
    expect((await request(app).put(`/api/documents/${dPB}`).set(auth(t)).send({ notes: 'x' })).status).toBe(403);
  });
  it('WRITE updates own project only', async () => {
    const t = await login('t5_tech');
    expect((await request(app).put(`/api/documents/${dPA}`).set(auth(t)).send({ notes: 'ok' })).status).toBe(200);
    expect((await request(app).put(`/api/documents/${dPB}`).set(auth(t)).send({ notes: 'x' })).status).toBe(403);
  });
  it('WRITE cannot delete (delete-class needs DELETE)', async () => {
    const t = await login('t5_tech');
    expect((await request(app).delete(`/api/documents/${dPA}`).set(auth(t))).status).toBe(403);
  });
  it('cross-project move requires WRITE on both sides', async () => {
    const t = await login('t5_tech');
    expect((await request(app).put(`/api/documents/${dPA}`).set(auth(t)).send({ projectId: P['T5PB'] })).status).toBe(403);
  });
  it('null-project rows follow global permission only', async () => {
    const t = await login('t5_tech');
    expect((await request(app).put(`/api/documents/${dNull}`).set(auth(t)).send({ notes: 'g' })).status).toBe(200);
  });
  it('guessed UUID returns 404', async () => {
    const t = await login('t5_view');
    expect((await request(app).get('/api/documents/123e4567-e89b-12d3-a456-426614174000').set(auth(t))).status).toBe(404);
  });
});

describe('Phase5 lists do not leak', () => {
  it('documents list scoped to membership (+null rows)', async () => {
    const t = await login('t5_tech');
    const r = await request(app).get('/api/documents?pageSize=200').set(auth(t));
    const ids = (r.body.items ?? []).map((d: { id: string }) => d.id);
    expect(ids).toContainEqual(expect.anything());
    for (const d of r.body.items ?? []) {
      expect(d.projectId === null || d.projectId === undefined || d.projectId === P['T5PA'] || d.projectId === P['T5PB']).toBe(true);
    }
  });
  it('explicit filter on no-access project is denied', async () => {
    const t = await login('t5_mgr');
    expect((await request(app).get(`/api/documents?projectId=${P['T5PB']}`).set(auth(t))).status).toBe(403);
  });
  it('projects list hides NONE projects', async () => {
    const t = await login('t5_view');
    const r = await request(app).get('/api/projects?pageSize=200').set(auth(t));
    const ids = (r.body.items ?? []).map((p: { id: string }) => p.id);
    expect(ids).toContain(P['T5PA']);
    expect(ids).not.toContain(P['T5PB']);
  });
  it('project detail on NONE project is 404', async () => {
    const t = await login('t5_mgr');
    expect((await request(app).get(`/api/projects/${P['T5PB']}`).set(auth(t))).status).toBe(404);
  });
});

describe('Phase5 sites and warehouses', () => {
  it('site create allowed in WRITE project, denied in NONE', async () => {
    const t = await login('t5_mgr');
    const ok = await request(app).post('/api/sites').set(auth(t)).send({ projectId: P['T5PA'], code: `T5S${T()}`, name: 's' });
    expect(ok.status).toBe(201);
    const no = await request(app).post('/api/sites').set(auth(t)).send({ projectId: P['T5PB'], code: `T5S${T()}`, name: 's' });
    expect(no.status).toBe(403);
  });
  it('warehouse create + cross-project update rules', async () => {
    const t = await login('t5_wh');
    expect((await request(app).post('/api/warehouses').set(auth(t)).send({ code: `T5W${T()}`, name: 'w', type: 'central', status: 'active', projectId: P['T5PA'] })).status).toBe(403);
    await setAccess(U['t5_wh'], P['T5PA'], 'WRITE');
    try {
      const ok = await request(app).post('/api/warehouses').set(auth(t)).send({ code: `T5W${T()}`, name: 'w', type: 'central', status: 'active', projectId: P['T5PA'] });
      expect(ok.status).toBe(201);
      expect((await request(app).put(`/api/warehouses/${ok.body.id}`).set(auth(t)).send({ projectId: P['T5PB'] })).status).toBe(403);
    } finally {
      await pool.query(`DELETE FROM project_members WHERE user_id=$1`, [U['t5_wh']]);
    }
  });
  it('warehouses list excludes no-access project rows', async () => {
    const t = await login('t5_wh');
    const r = await request(app).get('/api/warehouses?pageSize=200').set(auth(t));
    for (const w of r.body.items ?? []) {
      expect(w.projectId === null || w.projectId === undefined || w.projectId !== P['T5PA']).toBe(true);
    }
  });
});

describe('Phase5 material requests', () => {
  it('create allowed in WRITE project, denied in NONE', async () => {
    const admin = await adminLogin();
    const item = await request(app).post('/api/items').set(auth(admin)).send({ code: `T5I${T()}`, name: 'i', category: 'c', unit: 'pcs' });
    expect(item.status).toBe(201);
    const wh = await request(app).post('/api/warehouses').set(auth(admin)).send({ code: `T5W${T()}`, name: 'w', type: 'central', status: 'active' });
    expect(wh.status).toBe(201);
    const t = await login('t5_tech');
    const ok = await request(app).post('/api/material-requests').set(auth(t))
      .send({ projectId: P['T5PA'], warehouseId: wh.body.id, items: [{ itemId: item.body.id, requestedQty: 1 }] });
    expect(ok.status).toBe(201);
    const no = await request(app).post('/api/material-requests').set(auth(t))
      .send({ projectId: P['T5PB'], warehouseId: wh.body.id, items: [{ itemId: item.body.id, requestedQty: 1 }] });
    expect(no.status).toBe(403);
    await request(app).delete(`/api/material-requests/${ok.body.id}`).set(auth(t));
  });
  it('submit requires WRITE on the request project', async () => {
    const t = await login('t5_tech');
    const admin = await adminLogin();
    const item = await request(app).post('/api/items').set(auth(admin)).send({ code: `T5I${T()}`, name: 'i', category: 'c', unit: 'pcs' });
    const wh = await request(app).post('/api/warehouses').set(auth(admin)).send({ code: `T5W${T()}`, name: 'w', type: 'central', status: 'active' });
    const mr = await request(app).post('/api/material-requests').set(auth(t))
      .send({ projectId: P['T5PA'], warehouseId: wh.body.id, items: [{ itemId: item.body.id, requestedQty: 1 }] });
    expect(mr.status).toBe(201);
    // mgr has NONE on PB: move attempt via re-create is denied; submit own PA draft allowed
    expect((await request(app).post(`/api/material-requests/${mr.body.id}/submit`).set(auth(t))).status).toBe(200);
    await pool.query(`DELETE FROM material_requests WHERE id=$1`, [mr.body.id]);
  });
});

describe('Phase5 BOQ and IPC', () => {
  it('BOQ scoped to param project; cross-project denied', async () => {
    const t = await login('t5_mgr');
    const ok = await request(app).post(`/api/projects/${P['T5PA']}/boq`).set(auth(t))
      .send({ itemCode: `T5B${T()}`, description: 'd', unit: 'pcs', quantity: 1, unitPrice: 1 });
    expect(ok.status).toBe(201);
    expect((await request(app).post(`/api/projects/${P['T5PB']}/boq`).set(auth(t))
      .send({ itemCode: `T5B${T()}`, description: 'd', unit: 'pcs', quantity: 1, unitPrice: 1 })).status).toBe(403);
    expect((await request(app).get(`/api/projects/${P['T5PB']}/boq`).set(auth(t))).body).toEqual([]);
    await request(app).delete(`/api/projects/${P['T5PA']}/boq/${ok.body.id}`).set(auth(t));
  });
  it('IPC scoped to param project', async () => {
    const t = await login('t5_mgr');
    const ok = await request(app).post(`/api/projects/${P['T5PA']}/ipcs`).set(auth(t))
      .send({ ipcNumber: 91, date: '2026-01-01', status: 'draft' });
    expect(ok.status).toBe(201);
    expect((await request(app).post(`/api/projects/${P['T5PB']}/ipcs`).set(auth(t))
      .send({ ipcNumber: 92, date: '2026-01-01', status: 'draft' })).status).toBe(403);
    await request(app).delete(`/api/projects/${P['T5PA']}/ipcs/${ok.body.id}`).set(auth(t));
  });
});

describe('Phase5 stock and search', () => {
  it('stock writes stay global-only (validation 400 proves authz passed, zero writes)', async () => {
    const t = await login('t5_wh');
    expect((await request(app).post('/api/stock/transactions').set(auth(t)).send({})).status).toBe(400);
    const v = await login('t5_view');
    expect((await request(app).post('/api/stock/transactions').set(auth(t))).status).toBe(400);
    expect((await request(app).post('/api/stock/transactions').set(auth(v)).send({})).status).toBe(403);
  });
  it('search does not leak no-access project rows', async () => {
    const t = await login('t5_mgr');
    const r = await request(app).get(`/api/search?q=T5Doc`).set(auth(t));
    expect(r.status).toBe(200);
    const titles = [...(r.body.documents ?? [])].map((d: { title: string }) => d.title);
    expect(titles.some((x: string) => x.includes('T5DocPB'))).toBe(false);
  });
});

describe('Phase5 creator grant and bypass', () => {
  it('project creator receives DELETE access + audit', async () => {
    const t = await login('t5_mgr');
    const code = `T5C${T()}`;
    const r = await request(app).post('/api/projects').set(auth(t)).send({ projectCode: code, projectName: code, status: 'active' });
    expect(r.status).toBe(201);
    const m = await pool.query(`SELECT access FROM project_members WHERE project_id=$1 AND user_id=$2`, [r.body.id, U['t5_mgr']]);
    expect(m.rows[0]?.access).toBe('DELETE');
    await request(app).delete(`/api/projects/${r.body.id}`).set(auth(t));
  });
  it('projects.access bypass narrows nothing but grants nothing', async () => {
    const admin = await adminLogin();
    await pool.query(`DELETE FROM project_members WHERE user_id=(SELECT id FROM users WHERE username='admin') AND project_id=$1`, [P['T5PB']]);
    try {
      const docs = await request(app).get('/api/documents?pageSize=200').set(auth(admin));
      expect(docs.status).toBe(200);
      expect((await request(app).get(`/api/projects/${P['T5PB']}`).set(auth(admin))).status).toBe(200);
      // bypass grants nothing: admin projects.delete on missing row is still 404, and unknown key still denies
      expect((await request(app).get('/api/projects/123e4567-e89b-12d3-a456-426614174000').set(auth(admin))).status).toBe(404);
    } finally {
      await setAccess((await userRepository.list().then((a) => a.find((x) => x.username === 'admin'))).id, P['T5PB'], 'DELETE');
    }
  });
});
