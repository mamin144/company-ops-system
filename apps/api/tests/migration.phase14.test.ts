/**
 * Phase 14 migration parity + safety test (WP-1 gate).
 *
 * Uses an ISOLATED scratch database (cos_phase14_test) — never touches
 * cos_db, cos_authz_unit, or the cos_stage2_* dry-run databases.
 * Flow: create scratch -> apply ALL migrations in runner order (001..24)
 * -> assert Phase 14 schema (new columns, tables, constraints, indexes,
 * financial NULL semantics, 'under-review' value, new-table CHECKs and
 * FKs) -> assert _migrations parity with the repo file list -> assert
 * the three Phase 14 files re-run safely -> drop scratch DB.
 */
import { it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRATCH_DB = 'cos_phase14_test';
if (SCRATCH_DB === 'cos_db') throw new Error('refusing to run against production database');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIG_DIR = path.resolve(HERE, '../src/database/migrations');

const PHASE14_FILES = [
  '22_phase14_core_columns.sql',
  '23_phase14_ipc_workflow.sql',
  '24_phase14_recovery_import_tables.sql',
];

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
  // Same ordering as src/database/migrate.ts (down/ subdir is non-recursive
  // so its *.sql files are never listed).
  return files.filter((f) => f.endsWith('.sql')).sort((a, b) => a.localeCompare(b));
};

let db: Client;
let adminUserId: string;
let projectId: string;
let ipcId: string;

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

const applyRunnerStyle = async (file: string) => {
  const sql = await fs.readFile(path.join(MIG_DIR, file), 'utf-8');
  await db.query('BEGIN');
  try {
    await db.query(sql);
    // Mirror the app runner's bookkeeping (src/database/migrate.ts).
    await db.query(`CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await db.query(`INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT DO NOTHING`, [file]);
    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
};

it('applies all migrations (001..24) on a fresh database', async () => {
  const files = await migrationFiles();
  expect(files.length).toBe(22);
  for (const f of files) await applyRunnerStyle(f);
  const applied = await db.query(`SELECT name FROM _migrations ORDER BY id`);
  const names = applied.rows.map((r: { name: string }) => r.name);
  for (const f of PHASE14_FILES) expect(names).toContain(f);
  // Runner-parity: history rows == repo migration files, exactly.
  expect([...names].sort()).toEqual([...files].sort());
}, 120000);

it('users.department / users.title exist as nullable varchar(100)', async () => {
  const r = await db.query(
    `SELECT column_name, data_type, character_maximum_length, is_nullable
     FROM information_schema.columns
     WHERE table_name='users' AND column_name IN ('department','title')
     ORDER BY column_name`,
  );
  expect(r.rows).toHaveLength(2);
  for (const row of r.rows as Array<{ column_name: string; data_type: string; character_maximum_length: number; is_nullable: string }>) {
    expect(row.data_type).toBe('character varying');
    expect(row.character_maximum_length).toBe(100);
    expect(row.is_nullable).toBe('YES');
  }
});

it('projects soft-delete columns exist with FK + indexes', async () => {
  const cols = await db.query(
    `SELECT column_name, is_nullable, data_type FROM information_schema.columns
     WHERE table_name='projects' AND column_name IN ('deleted_at','deleted_by')`,
  );
  const byName = Object.fromEntries(
    (cols.rows as Array<{ column_name: string; is_nullable: string; data_type: string }>).map((c) => [c.column_name, c]),
  );
  expect(byName['deleted_at']?.is_nullable).toBe('YES');
  expect(byName['deleted_by']?.is_nullable).toBe('YES');
  const fks = await db.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
     WHERE conrelid='projects'::regclass AND contype='f' AND pg_get_constraintdef(oid) ILIKE '%deleted_by%'`,
  );
  expect(fks.rows[0].def).toContain('users(id)');
  const idx = await db.query(
    `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='projects'`,
  );
  const names = idx.rows.map((r: { indexname: string }) => r.indexname);
  expect(names).toContain('idx_projects_status_active');
  expect(names).toContain('idx_projects_deleted_at');
});

it('audit_logs.project_id exists with a partial index', async () => {
  const col = await db.query(
    `SELECT is_nullable FROM information_schema.columns
     WHERE table_name='audit_logs' AND column_name='project_id'`,
  );
  expect(col.rows[0].is_nullable).toBe('YES');
  const idx = await db.query(
    `SELECT indexdef FROM pg_indexes WHERE indexname='idx_audit_project'`,
  );
  expect(idx.rows[0].indexdef).toContain('project_id IS NOT NULL');
});

it('fixtures: user + project + IPC for the workflow checks', async () => {
  const u = await db.query(
    `INSERT INTO users (username, full_name, password_hash, role_name)
     VALUES ('phase14_admin', 'Phase14 Admin', 'test-hash', 'admin') RETURNING id`,
  );
  adminUserId = u.rows[0].id;
  const p = await db.query(
    `INSERT INTO projects (id, project_code, project_name)
     VALUES (uuid_generate_v4(), 'P-P14', 'Phase14 Test Project') RETURNING id`,
  );
  projectId = p.rows[0].id;
  const i = await db.query(
    `INSERT INTO ipcs (project_id, ipc_number, date, status)
     VALUES ($1, 1, '2026-01-01', 'under-review') RETURNING id`,
    [projectId],
  );
  ipcId = i.rows[0].id;
  const back = await db.query(`SELECT status FROM ipcs WHERE id=$1`, [ipcId]);
  expect(back.rows[0].status).toBe('under-review');
}, 30000);

it('ipcs status rejects an unknown value (CHECK rebuilt)', async () => {
  await expect(
    db.query(
      `INSERT INTO ipcs (project_id, ipc_number, date, status)
       VALUES ($1, 2, '2026-01-01', 'bogus-status')`,
      [projectId],
    ),
  ).rejects.toMatchObject({ code: '23514' });
}, 30000);

it('ipc_status_events: valid event inserts; decision CHECK and FKs enforced', async () => {
  await db.query(
    `INSERT INTO ipc_status_events
       (ipc_id, from_status, to_status, actor_user_id, actor_username, decision, notes)
     VALUES ($1, 'draft', 'submitted', $2, 'phase14_admin', NULL, NULL)`,
    [ipcId, adminUserId],
  );
  await expect(
    db.query(
      `INSERT INTO ipc_status_events
         (ipc_id, from_status, to_status, actor_user_id, actor_username, decision)
       VALUES ($1, 'submitted', 'approved', $2, 'phase14_admin', 'bogus')`,
      [ipcId, adminUserId],
    ),
  ).rejects.toMatchObject({ code: '23514' });
  await expect(
    db.query(
      `INSERT INTO ipc_status_events
         (ipc_id, from_status, to_status, actor_user_id, actor_username)
       VALUES ('00000000-0000-0000-0000-0000000000aa', 'draft', 'submitted', $1, 'phase14_admin')`,
      [adminUserId],
    ),
  ).rejects.toMatchObject({ code: '23503' });
  await expect(
    db.query(
      `INSERT INTO ipc_status_events
         (ipc_id, from_status, to_status, actor_user_id, actor_username)
       VALUES ($1, 'draft', 'submitted', '00000000-0000-0000-0000-0000000000aa', 'phase14_admin')`,
      [ipcId],
    ),
  ).rejects.toMatchObject({ code: '23503' });
  const idx = await db.query(
    `SELECT indexdef FROM pg_indexes WHERE indexname='idx_ipc_status_events_ipc'`,
  );
  expect(idx.rows[0].indexdef).toContain('ipc_id, created_at');
}, 30000);

it('financial columns are nullable with no defaults (NULL ≠ 0)', async () => {
  const r = await db.query(
    `SELECT table_name, column_name, is_nullable, column_default, data_type, numeric_precision, numeric_scale
     FROM information_schema.columns
     WHERE (table_name='projects' AND column_name='contract_value')
        OR (table_name='ipcs' AND column_name IN ('gross_amount','net_amount','deductions'))
     ORDER BY table_name, column_name`,
  );
  expect(r.rows).toHaveLength(4);
  for (const row of r.rows as Array<{ table_name: string; column_name: string; is_nullable: string; column_default: string | null; numeric_precision: number; numeric_scale: number }>) {
    expect(`${row.table_name}.${row.column_name}`).toBeDefined();
    expect(row.is_nullable).toBe('YES');
    expect(row.column_default).toBeNull();
    expect(row.numeric_precision).toBe(14);
    expect(row.numeric_scale).toBe(2);
  }
  // Insert semantics: omitted financial values are NULL, not 0.
  const i2 = await db.query(
    `INSERT INTO ipcs (project_id, ipc_number, date, status)
     VALUES ($1, 3, '2026-01-01', 'draft') RETURNING gross_amount, net_amount, deductions`,
    [projectId],
  );
  expect(i2.rows[0].gross_amount).toBeNull();
  expect(i2.rows[0].net_amount).toBeNull();
  expect(i2.rows[0].deductions).toBeNull();
}, 30000);

it('O10/O11 tables exist with CHECKs and FKs enforced', async () => {
  for (const t of ['password_reset_tokens', 'backups', 'restore_jobs', 'import_batches']) {
    const r = await db.query(`SELECT to_regclass($1) AS oid`, [`public.${t}`]);
    expect(r.rows[0].oid).not.toBeNull();
  }
  // backup FK on restore_jobs.
  await expect(
    db.query(
      `INSERT INTO restore_jobs (backup_id, mode, requested_by)
       VALUES ('00000000-0000-0000-0000-0000000000bb', 'dry_run', $1)`,
      [adminUserId],
    ),
  ).rejects.toMatchObject({ code: '23503' });
  // mode CHECK.
  const b = await db.query(
    `INSERT INTO backups (file_name, file_path) VALUES ('p14-test.bak', 'C:/temp/p14-test.bak') RETURNING id`,
  );
  await expect(
    db.query(
      `INSERT INTO restore_jobs (backup_id, mode, requested_by) VALUES ($1, 'bogus', $2)`,
      [b.rows[0].id, adminUserId],
    ),
  ).rejects.toMatchObject({ code: '23514' });
  // backups.status CHECK.
  await expect(
    db.query(`INSERT INTO backups (file_name, file_path, status) VALUES ('p14-bad.bak', 'C:/x', 'bogus')`),
  ).rejects.toMatchObject({ code: '23514' });
  // import_batches.status CHECK + defaults.
  const imp = await db.query(
    `INSERT INTO import_batches (entity, file_name) VALUES ('documents', 'sweep.xlsx') RETURNING duplicate_rule, status, errors`,
  );
  expect(imp.rows[0].duplicate_rule).toBe('document_number');
  expect(imp.rows[0].status).toBe('completed');
  expect(imp.rows[0].errors).toEqual([]);
  await expect(
    db.query(`INSERT INTO import_batches (entity, file_name, status) VALUES ('documents', 'x.xlsx', 'bogus')`),
  ).rejects.toMatchObject({ code: '23514' });
  // token_hash uniqueness.
  const u2 = await db.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + interval '1 hour') RETURNING id`,
    [adminUserId, 'a'.repeat(64)],
  );
  expect(u2.rows[0].id).toBeDefined();
  await expect(
    db.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + interval '1 hour')`,
      [adminUserId, 'a'.repeat(64)],
    ),
  ).rejects.toMatchObject({ code: '23505' });
}, 30000);

it('Phase 14 files are idempotent (re-run safe, data intact)', async () => {
  const usersBefore = await db.query(`SELECT COUNT(*)::int AS n FROM users`);
  const projectsBefore = await db.query(`SELECT COUNT(*)::int AS n FROM projects`);
  const eventsBefore = await db.query(`SELECT COUNT(*)::int AS n FROM ipc_status_events`);
  const backupsBefore = await db.query(`SELECT COUNT(*)::int AS n FROM backups`);
  for (const f of PHASE14_FILES) {
    const sql = await fs.readFile(path.join(MIG_DIR, f), 'utf-8');
    await db.query(sql); // no runner bookkeeping — SQL-level idempotency only
  }
  const usersAfter = await db.query(`SELECT COUNT(*)::int AS n FROM users`);
  const projectsAfter = await db.query(`SELECT COUNT(*)::int AS n FROM projects`);
  const eventsAfter = await db.query(`SELECT COUNT(*)::int AS n FROM ipc_status_events`);
  const backupsAfter = await db.query(`SELECT COUNT(*)::int AS n FROM backups`);
  expect(usersAfter.rows[0].n).toBe(usersBefore.rows[0].n);
  expect(projectsAfter.rows[0].n).toBe(projectsBefore.rows[0].n);
  expect(eventsAfter.rows[0].n).toBe(eventsBefore.rows[0].n);
  expect(backupsAfter.rows[0].n).toBe(backupsBefore.rows[0].n);
}, 60000);
