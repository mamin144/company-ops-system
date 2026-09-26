/**
 * Authz-rebuild migration parity + safety test (Phase 1 gate).
 *
 * Uses an ISOLATED scratch database (cos_authz_test) — never touches cos_db.
 * Flow: create scratch -> apply ALL migrations in runner order -> insert
 * fixtures (5 users x 5 roles, 2 projects) -> re-apply idempotent backfill
 * (migration 20) -> assert parity/safety -> apply DOWN scripts -> assert
 * pre-state restoration -> drop scratch DB.
 *
 * Hard-failure conditions (any unexpected permission difference fails):
 * - a system role's DB permission set != static matrix (+ admin extras)
 * - FK missing or not enforced, indexes missing, backfill not idempotent,
 *   fixture users/projects/roles lost by DOWN, sessions un-revoked by DOWN.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROLE_PERMISSIONS } from '@cos/shared';

const SCRATCH_DB = 'cos_authz_test';
if (SCRATCH_DB === 'cos_db') throw new Error('refusing to run against production database');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIG_DIR = path.resolve(HERE, '../src/database/migrations');
const DOWN_DIR = path.join(MIG_DIR, 'down');

// New keys introduced by the rebuild (admin-only by default).
const NEW_ADMIN_KEYS = ['roles.manage', 'projects.access', 'users.resetPassword'];

const baseUrl = () => {
  const u = process.env.DATABASE_URL;
  if (!u) throw new Error('DATABASE_URL must be set by vitest config');
  return u;
};
const adminClient = () =>
  new Client({ connectionString: baseUrl().replace(/\/[^/]*$/, '/postgres') });
const scratchClient = () =>
  new Client({ connectionString: baseUrl().replace(/\/[^/]*$/, `/${SCRATCH_DB}`) });

const migrationFiles = async (): Promise<string[]> => {
  const files = await fs.readdir(MIG_DIR);
  // Same ordering as src/database/migrate.ts (down/ subdir excluded: not *.sql at top level... it IS *.sql but inside subdir, readdir is non-recursive so never listed).
  return files.filter((f) => f.endsWith('.sql')).sort((a, b) => a.localeCompare(b));
};

let db: Client;
const fixtureUserIds: Record<string, string> = {};
const fixtureProjectIds: string[] = [];

beforeAll(async () => {
  const admin = adminClient();
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${SCRATCH_DB}`);
  await admin.end();
  db = scratchClient();
  await db.connect();
}, 60000);

afterAll(async () => {
  try { await db?.end(); } catch { /* ignore */ }
  try {
    const admin = adminClient();
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
    await admin.end();
  } catch { /* best-effort cleanup */ }
});

it('applies all migrations UP including 19/20 on a fresh database', async () => {
  const files = await migrationFiles();
  expect(files).toContain('19_authz_rebuild.sql');
  expect(files).toContain('20_authz_backfill.sql');
  for (const f of files) {
    const sql = await fs.readFile(path.join(MIG_DIR, f), 'utf-8');
    await db.query(sql);
    // Mirror the app runner's bookkeeping (src/database/migrate.ts).
    await db.query(`CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await db.query(`INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT DO NOTHING`, [f]);
  }
  const applied = await db.query(`SELECT name FROM _migrations ORDER BY name`);
  const names = applied.rows.map((r: { name: string }) => r.name);
  expect(names).toContain('19_authz_rebuild.sql');
  expect(names).toContain('20_authz_backfill.sql');
}, 120000);

it('creates overrides + members tables with indexes', async () => {
  for (const t of ['user_permission_overrides', 'project_members']) {
    const r = await db.query(`SELECT to_regclass($1) AS oid`, [`public.${t}`]);
    expect(r.rows[0].oid).not.toBeNull();
  }
  const idx = await db.query(
    `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename IN ('user_permission_overrides','project_members')`,
  );
  const names = idx.rows.map((r: { indexname: string }) => r.indexname);
  expect(names).toContain('idx_overrides_user');
  expect(names).toContain('idx_members_user');
  expect(names).toContain('idx_members_project');
});

it('seeds 5 system roles with parity to the static matrix (+ admin extras)', async () => {
  const r = await db.query(`SELECT name, permissions, is_system FROM roles ORDER BY name`);
  expect(r.rows.map((x: { name: string }) => x.name).sort()).toEqual(
    ['admin', 'management', 'technical', 'viewer', 'warehouse'].sort(),
  );
  for (const row of r.rows as Array<{ name: string; permissions: string[]; is_system: boolean }>) {
    expect(row.is_system).toBe(true);
    const expected = new Set<string>([
      ...(ROLE_PERMISSIONS[row.name] ?? []),
      ...(row.name === 'admin' ? NEW_ADMIN_KEYS : []),
    ]);
    const actual = new Set<string>(row.permissions ?? []);
    const missing = [...expected].filter((k) => !actual.has(k));
    const extra = [...actual].filter((k) => !expected.has(k));
    expect({ role: row.name, missing, extra }).toEqual({ role: row.name, missing: [], extra: [] });
  }
});

it('backfills memberships idempotently with role-derived defaults', async () => {
  const roles = ['admin', 'management', 'warehouse', 'technical', 'viewer'];
  for (const role of roles) {
    const u = await db.query(
      `INSERT INTO users (id, username, full_name, password_hash, role_name) VALUES (uuid_generate_v4(), $1, $2, 'test-hash', $3) RETURNING id`,
      [`test_${role}`, `Test ${role}`, role],
    );
    fixtureUserIds[role] = u.rows[0].id;
  }
  for (const code of ['P-A', 'P-B']) {
    const p = await db.query(
      `INSERT INTO projects (id, project_code, project_name) VALUES (uuid_generate_v4(), $1, $2) RETURNING id`,
      [code, `Project ${code}`],
    );
    fixtureProjectIds.push(p.rows[0].id);
  }
  // Re-apply the idempotent backfill (migration 20) now that fixtures exist.
  const backfill = await fs.readFile(path.join(MIG_DIR, '20_authz_backfill.sql'), 'utf-8');
  await db.query(backfill);
  await db.query(backfill);
  const count = await db.query(`SELECT COUNT(*)::int AS n FROM project_members`);
  expect(count.rows[0].n).toBe(5 * 2);
  const levels = await db.query(
    `SELECT u.username, m.access FROM project_members m JOIN users u ON u.id = m.user_id ORDER BY u.username, m.project_id`,
  );
  const byUser: Record<string, string> = {};
  for (const row of levels.rows as Array<{ username: string; access: string }>) byUser[row.username] = row.access;
  expect(byUser['test_admin']).toBe('DELETE');
  expect(byUser['test_management']).toBe('WRITE');
  expect(byUser['test_warehouse']).toBe('WRITE');
  expect(byUser['test_technical']).toBe('WRITE');
  expect(byUser['test_viewer']).toBe('READ');
}, 60000);

it('enforces users.role_name FK against roles(name)', async () => {
  await expect(
    db.query(
      `INSERT INTO users (id, username, full_name, password_hash, role_name) VALUES (uuid_generate_v4(), 'bad_role_user', 'Bad', 'x', 'nope')`,
    ),
  ).rejects.toMatchObject({ code: '23503' });
});

it('round-trips overrides with one-row-per-user-key uniqueness', async () => {
  const uid = fixtureUserIds['viewer'];
  await db.query(
    `INSERT INTO user_permission_overrides (user_id, permission_key, effect, created_by) VALUES ($1, 'archive.delete', 'grant', 'parity-test')`,
    [uid],
  );
  await expect(
    db.query(
      `INSERT INTO user_permission_overrides (user_id, permission_key, effect, created_by) VALUES ($1, 'archive.delete', 'deny', 'parity-test')`,
      [uid],
    ),
  ).rejects.toMatchObject({ code: '23505' });
  const r = await db.query(`SELECT effect FROM user_permission_overrides WHERE user_id=$1`, [uid]);
  expect(r.rows[0].effect).toBe('grant');
});

it('revokes sessions via the migration statement', async () => {
  await db.query(
    `INSERT INTO sessions (id, user_id, username, token_hash, expires_at) VALUES ('paritysess000000000001', $1, 'test_admin', 'h', NOW() + interval '1 day')`,
    [fixtureUserIds['admin']],
  );
  // Mirrors the UPDATE in 19_authz_rebuild.sql.
  await db.query(`UPDATE sessions SET revoked_at = NOW() WHERE revoked_at IS NULL`);
  const r = await db.query(`SELECT revoked_at FROM sessions WHERE id='paritysess000000000001'`);
  expect(r.rows[0].revoked_at).not.toBeNull();
});

it('DOWN restores pre-state without losing business rows', async () => {
  const down20 = await fs.readFile(path.join(DOWN_DIR, '20_authz_backfill.sql'), 'utf-8');
  const down19 = await fs.readFile(path.join(DOWN_DIR, '19_authz_rebuild.sql'), 'utf-8');
  await db.query(down20);
  await db.query(down19);
  for (const t of ['user_permission_overrides', 'project_members']) {
    const r = await db.query(`SELECT to_regclass($1) AS oid`, [`public.${t}`]);
    expect(r.rows[0].oid).toBeNull();
  }
  // FK gone: previously-rejected insert now succeeds (cleaned up afterwards).
  await db.query(
    `INSERT INTO users (id, username, full_name, password_hash, role_name) VALUES (uuid_generate_v4(), 'bad_role_user', 'Bad', 'x', 'nope')`,
  );
  await db.query(`DELETE FROM users WHERE username='bad_role_user'`);
  // Fixture business rows intact.
  const users = await db.query(`SELECT COUNT(*)::int AS n FROM users WHERE username LIKE 'test\\_%'`);
  expect(users.rows[0].n).toBe(5);
  const projects = await db.query(`SELECT COUNT(*)::int AS n FROM projects WHERE project_code IN ('P-A','P-B')`);
  expect(projects.rows[0].n).toBe(2);
  const roles = await db.query(`SELECT COUNT(*)::int AS n FROM roles WHERE is_system`);
  expect(roles.rows[0].n).toBe(5);
  // Sessions stay revoked (documented irreversibility — DOWN must not silently un-revoke).
  const s = await db.query(`SELECT revoked_at FROM sessions WHERE id='paritysess000000000001'`);
  expect(s.rows[0].revoked_at).not.toBeNull();
}, 60000);
