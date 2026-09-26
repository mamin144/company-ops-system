/**
 * Phase 2 — central authorization resolver, test-first.
 *
 * Pure-logic cases use fabricated server-side contexts (never client data).
 * DB-backed cases run on an ISOLATED scratch database (cos_authz_unit),
 * migrated with the real migration files; the resolver module is imported
 * dynamically AFTER pointing DATABASE_URL at scratch, so the shared pool
 * never touches cos_db. Scratch DB is dropped in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRATCH_DB = 'cos_authz_unit';
if (SCRATCH_DB === 'cos_db') throw new Error('refusing to run against production database');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIG_DIR = path.resolve(HERE, '../src/database/migrations');

const baseUrl = () => {
  const u = process.env.DATABASE_URL;
  if (!u) throw new Error('DATABASE_URL must be set by vitest config');
  return u;
};

// Point the resolver's shared pool at scratch BEFORE it is first imported.
process.env.DATABASE_URL = baseUrl().replace(/\/[^/]*$/, `/${SCRATCH_DB}`);
const svc = await import('../src/services/authorization.service');
const { loadContext, can, effective, isAdminCapable, countAdminCapable } = svc;
type Ctx = svc.AuthzContext;

const adminClient = () =>
  new Client({ connectionString: baseUrl().replace(/\/[^/]*$/, '/postgres') });

const ctxOf = (over: Partial<Ctx> = {}): Ctx => ({
  userId: 'u1',
  username: 'u1',
  isActive: true,
  roleName: 'viewer',
  rolePermissions: ['archive.view', 'archive.download'],
  overrides: [],
  memberships: [],
  ...over,
});

beforeAll(async () => {
  const admin = adminClient();
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${SCRATCH_DB}`);
  await admin.end();
  const db = new Client({ connectionString: baseUrl() });
  await db.connect();
  const files = (await fs.readdir(MIG_DIR)).filter((f) => f.endsWith('.sql')).sort((a, b) => a.localeCompare(b));
  for (const f of files) await db.query(await fs.readFile(path.join(MIG_DIR, f), 'utf-8'));
  // Fixtures: one user per system role + one custom role + holder, two projects.
  await db.query(
    `INSERT INTO roles (id, name, name_ar, permissions, is_system) VALUES (uuid_generate_v4(), 'editors', 'محررون', ARRAY['archive.view','archive.edit'], FALSE) ON CONFLICT (name) DO NOTHING`,
  );
  for (const [u, r] of [['au', 'admin'], ['mu', 'management'], ['vu', 'viewer'], ['cu', 'editors']] as Array<[string, string]>) {
    await db.query(
      `INSERT INTO users (id, username, full_name, password_hash, role_name) VALUES (uuid_generate_v4(), $1, $2, 'x', $3) ON CONFLICT (username) DO NOTHING`,
      [u, u, r],
    );
  }
  for (const code of ['PA', 'PB']) {
    await db.query(`INSERT INTO projects (id, project_code, project_name) VALUES (uuid_generate_v4(), $1, $2) ON CONFLICT (project_code) DO NOTHING`, [code, code]);
  }
  const au = (await db.query(`SELECT id FROM users WHERE username='au'`)).rows[0].id;
  const pa = (await db.query(`SELECT id FROM projects WHERE project_code='PA'`)).rows[0].id;
  await db.query(`INSERT INTO project_members (project_id, user_id, access, created_by) VALUES ($1, $2, 'WRITE', 't') ON CONFLICT DO NOTHING`, [pa, au]);
  await db.end();
}, 120000);

afterAll(async () => {
  try {
    await (await import('../src/database/pool')).pool.end();
    const admin = adminClient();
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
    await admin.end();
  } catch { /* best-effort */ }
});

describe('loadContext (server-side, batched)', () => {
  it('loads user + role + empty overrides/memberships', async () => {
    const c = await loadContext((await userId('vu')) as string);
    expect(c?.username).toBe('vu');
    expect(c?.roleName).toBe('viewer');
    expect(c?.rolePermissions).toContain('archive.view');
    expect(c?.overrides).toEqual([]);
  });
  it('returns null for nonexistent user (fail closed downstream)', async () => {
    expect(await loadContext('00000000-0000-0000-0000-000000000000')).toBeNull();
  });
  it('carries isActive=false for disabled users', async () => {
    const db = new Client({ connectionString: baseUrl() });
    await db.connect();
    await db.query(`UPDATE users SET is_active=FALSE WHERE username='vu'`);
    const c = await loadContext((await userId('vu')) as string);
    expect(c?.isActive).toBe(false);
    await db.query(`UPDATE users SET is_active=TRUE WHERE username='vu'`);
    await db.end();
  });
  async function userId(u: string): Promise<string> {
    const db = new Client({ connectionString: baseUrl() });
    await db.connect();
    const r = await db.query(`SELECT id FROM users WHERE username=$1`, [u]);
    await db.end();
    return r.rows[0].id;
  }
});

describe('can() — global layer', () => {
  it('1. inherits role permission', () => {
    expect(can(ctxOf(), 'archive.view')).toBe(true);
    expect(can(ctxOf(), 'archive.delete')).toBe(false);
  });
  it('2. denies unknown permission keys', () => {
    expect(can(ctxOf(), 'nope.notreal')).toBe(false);
    expect(can(ctxOf(), '')).toBe(false);
  });
  it('3. GRANT override adds a missing permission', () => {
    const c = ctxOf({ overrides: [{ permissionKey: 'archive.delete', effect: 'grant' }] });
    expect(can(c, 'archive.delete')).toBe(true);
  });
  it('4. DENY override removes an inherited permission', () => {
    const c = ctxOf({ overrides: [{ permissionKey: 'archive.view', effect: 'deny' }] });
    expect(can(c, 'archive.view')).toBe(false);
  });
  it('5. DENY beats GRANT on conflicting rows', () => {
    const c = ctxOf({ overrides: [
      { permissionKey: 'archive.delete', effect: 'grant' },
      { permissionKey: 'archive.delete', effect: 'deny' },
    ] });
    expect(can(c, 'archive.delete')).toBe(false);
  });
  it('15. disabled user denied everything', () => {
    expect(can(ctxOf({ isActive: false }), 'archive.view')).toBe(false);
  });
  it('16. null context denied safely', () => {
    expect(can(null, 'archive.view')).toBe(false);
  });
});

describe('can() — project layer', () => {
  const P = 'proj-1';
  it('6. NONE denies scoped CRUD', () => {
    const c = ctxOf({ memberships: [{ projectId: P, access: 'NONE' }] });
    expect(can(c, 'archive.view', P)).toBe(false);
  });
  it('13. missing membership defaults to NONE', () => {
    expect(can(ctxOf(), 'archive.view', P)).toBe(false);
  });
  it('7. READ allows view/download', () => {
    const c = ctxOf({ memberships: [{ projectId: P, access: 'READ' }] });
    expect(can(c, 'archive.view', P)).toBe(true);
    expect(can(c, 'archive.download', P)).toBe(true);
    expect(can(c, 'archive.edit', P)).toBe(false);
  });
  it('8. WRITE allows module create/update but not delete', () => {
    const c = ctxOf({
      rolePermissions: ['archive.view', 'archive.upload', 'archive.edit'],
      memberships: [{ projectId: P, access: 'WRITE' }],
    });
    expect(can(c, 'archive.upload', P)).toBe(true);
    expect(can(c, 'archive.edit', P)).toBe(true);
    expect(can(c, 'archive.delete', P)).toBe(false);
  });
  it('9. DELETE allows module delete', () => {
    const c = ctxOf({
      rolePermissions: ['archive.view', 'archive.delete'],
      memberships: [{ projectId: P, access: 'DELETE' }],
    });
    expect(can(c, 'archive.delete', P)).toBe(true);
  });
  it('10. project access cannot broaden a missing global permission', () => {
    const c = ctxOf({ memberships: [{ projectId: P, access: 'DELETE' }] }); // viewer: no edit/delete globally
    expect(can(c, 'archive.edit', P)).toBe(false);
    expect(can(c, 'archive.delete', P)).toBe(false);
    expect(can(c, 'archive.view', P)).toBe(true);
  });
  it('11. special global-only permissions ignore project access', () => {
    const c = ctxOf({
      rolePermissions: ['materialRequests.view', 'materialRequests.approve'],
      memberships: [{ projectId: P, access: 'NONE' }],
    });
    expect(can(c, 'materialRequests.approve', P)).toBe(true);
    expect(can(c, 'materialRequests.view', P)).toBe(false); // view is scoped -> NONE denies
  });
  it('12. null projectId falls back to global decision (unscoped use)', () => {
    expect(can(ctxOf(), 'archive.view', null)).toBe(true);
    expect(can(ctxOf(), 'archive.view', undefined)).toBe(true);
    expect(can(ctxOf(), 'archive.delete')).toBe(false);
  });
  it('14. projects.access bypass narrows nothing (ratified superuser rule)', () => {
    const c = ctxOf({
      rolePermissions: ['archive.view', 'projects.access'],
      memberships: [{ projectId: P, access: 'NONE' }],
    });
    expect(can(c, 'archive.view', P)).toBe(true); // bypass: global decision stands
    const plain = ctxOf({ memberships: [{ projectId: P, access: 'NONE' }] });
    expect(can(plain, 'archive.view', P)).toBe(false);
    // bypass never grants: missing global stays missing
    expect(can(c, 'archive.delete', P)).toBe(false);
  });
});

describe('roles', () => {
  it('17. system role permissions resolve from DB row', async () => {
    const db = new Client({ connectionString: baseUrl() });
    await db.connect();
    const r = await db.query(`SELECT permissions FROM roles WHERE name='warehouse'`);
    await db.end();
    expect(r.rows[0].permissions).toContain('warehouse.stock_in');
    const c = ctxOf({ roleName: 'warehouse', rolePermissions: r.rows[0].permissions });
    expect(can(c, 'warehouse.stock_in')).toBe(true);
  });
  it('18. custom role permissions resolve from DB row', async () => {
    const id = await (async () => {
      const db = new Client({ connectionString: baseUrl() });
      await db.connect();
      const r = await db.query(`SELECT id FROM users WHERE username='cu'`);
      await db.end();
      return r.rows[0].id;
    })();
    const c = await loadContext(id);
    expect(c?.roleName).toBe('editors');
    expect(can(c, 'archive.edit')).toBe(true);
    expect(can(c, 'archive.delete')).toBe(false);
  });
});

describe('effective() for the Admin UI inspector', () => {
  it('returns per-key decisions plus overrides and memberships echo', () => {
    const c = ctxOf({
      overrides: [{ permissionKey: 'archive.delete', effect: 'grant' }],
      memberships: [{ projectId: 'proj-1', access: 'READ' }],
    });
    const e = effective(c, 'proj-1');
    expect(e.permissions['archive.view']).toBe(true);
    expect(e.permissions['archive.delete']).toBe(false); // granted globally, READ narrows
    expect(e.permissions['archive.edit']).toBe(false);
    expect(e.overrides).toHaveLength(1);
    expect(e.memberships).toHaveLength(1);
    expect(e.role).toBe('viewer');
  });
  it('computes unscoped effective set when no project given', () => {
    const e = effective(ctxOf());
    expect(e.permissions['archive.view']).toBe(true);
    expect(e.permissions['archive.delete']).toBe(false);
  });
});

describe('admin coverage', () => {
  it('recognizes admin-capable contexts', async () => {
    const db = new Client({ connectionString: baseUrl() });
    await db.connect();
    const r = await db.query(`SELECT id FROM users WHERE username='au'`);
    await db.end();
    const c = await loadContext(r.rows[0].id);
    expect(isAdminCapable(c)).toBe(true);
    expect(isAdminCapable(ctxOf())).toBe(false);
    expect(isAdminCapable(null)).toBe(false);
  });
  it('counts coverage across users without N+1 storms', async () => {
    const n = await countAdminCapable();
    expect(n).toBe(1); // only fixture 'au'
  });
});
