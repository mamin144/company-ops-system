# Phase 12 — Stage 2 Environment Plan (Documentation Only)

Status: **BLOCKED — ENVIRONMENT PLAN READY FOR OWNER REVIEW; NO TEST DATABASE PROVISIONED.**
Baseline: branch `main`, HEAD `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf`, October 2026.
Companion docs: A (`phase-12-separation-migration-architecture-report.md`), B (`phase-12-data-migration-matrix.md`), C (`phase-12-api-auth-permissions-map.md`), D (`phase-12-migration-validation-rollback-plan.md`), E (`phase-12-owner-decision-record.md`), Stage 0 inventory (chat-only, 2026-10-29), Stage 1 target design (`phase-12-stage-1-target-design.md`), Stage 2 dry-run report (`phase-12-stage-2-dry-run-report.md`).

**Language note:** technical body in English (see doc A header).

**Evidence labels:** `Verified` = file/code/SQL proof · `Inferred` = engineering deduction with named sources · `Proposed` = unimplemented design · `Unknown` = could not be verified now · `Recorded Owner Decision` = decision recorded in doc E.

**Scope:** documentation and planning only. No application source, migration, schema, database, secret, configuration, deployment, or Git state was changed to produce this document. No environment was provisioned. No SQL was executed.

---

## 1. Owner-Provided Environment Facts

The owner confirms (Recorded Owner Decision — environment facts, 2026-10-29/2026-11-01):

| Fact | Status |
|---|---|
| Legacy application is currently operational | Confirmed by owner |
| Legacy application uses PostgreSQL 18 | Confirmed by owner (major version 18) |
| Exact PostgreSQL minor/patch version | **Unknown** — not independently verified |
| pgAdmin successfully connects to PostgreSQL 18 | Confirmed by owner |
| PostgreSQL 18 contains `cos_db` and `cos_authz_unit` | Confirmed by owner |
| PostgreSQL 18 data directory: `C:\Program Files\PostgreSQL\18\data` | Confirmed by owner (pgAdmin display) |
| PostgreSQL 17 appears disconnected in the supplied screenshot | Confirmed by owner |
| PostgreSQL 18 is an operational database service that must remain completely untouched | Recorded Owner Decision |

**Protection boundary (absolute):** the existing PostgreSQL 18 service, its data directory, `cos_db`, `cos_authz_unit`, any other database on that instance, its configuration, authentication, ports, permissions, and service state are **out of scope and must not be touched**. No connection, no database/role/schema/table creation, no SQL, no configuration change, no service restart/stop, no credential read. The legacy application's connection and credentials are out of scope.

---

## 2. Existing Operational Database Protection Boundary

| Protected object | Protection |
|---|---|
| PostgreSQL 18 service (host) | Do not stop, restart, reconfigure, or connect to it |
| Data directory `C:\Program Files\PostgreSQL\18\data` | Do not read, modify, or copy its files |
| Database `cos_db` | No connection, no SQL, no migration, no backup extraction via DB connection |
| Database `cos_authz_unit` | Same |
| Any other DB on PG 18 | Same |
| Host PG 17 service (status unverified) | Treat as potentially operational; do not connect or modify |
| Legacy app connection string / credentials | Do not read, print, or use |
| `.env` files (root and `apps/api/.env`) | Do not read or print values |

**Note:** the two previously initialized temporary clusters (PG 17 on port 5439, PG 18 on port 5440) were stopped and remain as evidence in `C:\Users\PC-01\AppData\Local\Temp\opencode\pg-stage2-cluster*`. They are **not** the operational databases. They are disposable and may be removed after owner review (removal commands documented in the Stage 2 report §9).

---

## 3. Repository Migration Analysis (Static, Read-Only)

### 3.1 Migration inventory
- **19 top-level migration files** under `apps/api/src/database/migrations/` (Verified — `Get-ChildItem -File -Force`).
- **3 rollback files** under `migrations/down/` (`19_authz_rebuild.sql`, `20_authz_backfill.sql`, `21_direct_amounts.sql`) — **not** applied by the runner; manual use only.
- Runner: `apps/api/src/database/migrate.ts` (Verified) — reads `migrations/*.sql`, filters `.sql`, sorts by `localeCompare`, applies each in its own transaction (BEGIN/COMMIT, ROLLBACK on failure), tracks names in `_migrations` (UNIQUE).

### 3.2 Duplicate migration finding

Files `11_modernize_dms.sql` and `18_modernize_dms.sql` are **byte-identical** (1,644 bytes, sha256 `852AB84B901D…`) — Verified (`fc.exe`: no differences). The migration runner treats them as separate filenames and applies **both** (two `_migrations` rows).

**Statement-by-statement first-run / repeated-run behavior (from the actual SQL):**
- `CREATE TABLE IF NOT EXISTS folders (...)` — first run creates the table; repeated run is a no-op (table exists). Semantically idempotent at the DDL level.
- `CREATE TABLE IF NOT EXISTS document_links (...)` — same as above.
- `ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id ...` — first run adds the column; repeated run is a no-op. Semantically idempotent at the DDL level.
- `INSERT INTO document_links (...) SELECT ... WHERE project_id IS NOT NULL ON CONFLICT DO NOTHING` — first run inserts rows for documents with a non-null `project_id`; repeated run inserts zero rows (conflict on the `UNIQUE (document_id, entity_type, entity_id)` constraint). Semantically idempotent for the same input data.
- Same `INSERT ... ON CONFLICT DO NOTHING` pattern for `site_id` and `ipc_id`.

**What is NOT established:**
- The runner applies the file twice under two different names; the second execution's `INSERT ... SELECT` re-evaluates against the (now populated) `document_links` table and relies on `ON CONFLICT DO NOTHING` to avoid duplicates. This is idempotent **only if** the unique constraint exists and is enforced and the source columns are unchanged. Whether the second run produces exactly zero new rows in all cases (e.g., if the unique constraint were missing or if source data changed between runs) is **Unknown** — not proven.
- `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` are DDL-level idempotent but do not by themselves prove that re-running the file cannot produce side effects if the schema state differs from assumptions.
- Whether `document_links` already contained conflicting pre-existing rows before the first run (which would make the first run's `INSERT` partially conflict) is **Unknown**.

**Classification:** the duplicate is **not** proven SQL-safe, and it is **not** a resolved migration risk. `IF NOT EXISTS` and `ON CONFLICT DO NOTHING` reduce the likelihood of failure on repeat but do **not** by themselves establish full semantic idempotency. The duplicate must be retained as an **explicit test case** in the future isolated dry run (run both files in runner order and verify zero duplicate rows and zero unexplained data changes). This issue does **not** prevent preparing an isolated environment, but it prevents declaring migration readiness before its behavior is verified.

### 3.3 Extensions
- `uuid-ossp` and `pg_trgm` (in `001_initial_schema.sql`, under `-- Extensions`).
- In the default PostgreSQL 18 installation, both are **trusted extensions**: a non-superuser role with `CREATE` privilege on the target database can install them, **provided their extension files are available on the server**. They do **not** inherently require superuser.
- **Required:** extension files present on the server; database-level `CREATE` privilege for a non-superuser installation (or pre-install by a superuser if extension files are unavailable).
- Do not grant or recommend server-wide superuser privileges without a specific, proven requirement (none is proven for these two extensions).

### 3.4 Roles, privileges, ownership, and search_path
- **No `CREATE ROLE`/`CREATE USER`/`GRANT`/`REVOKE`/`SUPERUSER`/`CREATEDB` statements in any migration** (Verified — grep returned no matches). Migrations do not create or alter roles or privileges.
- Migrations assume the connecting role can create tables, indexes, constraints, and extensions in the target database. Whether a superuser is required depends on the target PostgreSQL version's extension trust status and the role's grants; see §3.9 (privilege matrix). No server-wide superuser grant is recommended without a specific, proven requirement.
- No cross-database references, `dblink`, foreign servers, `COPY ... PROGRAM`, or filesystem operations in SQL (Verified — none found).
- **Schema and `search_path` (correction):** no `SET search_path` or schema-qualified identifiers were found (Verified). However, unqualified names are resolved using the **effective session `search_path`**, which is not fixed by the migration files. The absence of `SET search_path` in the SQL does **not** by itself prove that every operation targets `public`; it only means the migrations rely on the session's effective `search_path`. Future Stage 2 preparation must verify the test session's effective `search_path` and target schema. **Never** obtain this information by connecting to the existing operational PostgreSQL 18 service.
- No transaction control statements in SQL (BEGIN/COMMIT/ROLLBACK) — the runner wraps each file.

### 3.5 Statements that can affect objects outside the intended database
- **None identified by static inspection.** All DDL/DML in the migrations targets tables by unqualified name within the connected database. Whether every unqualified name resolves to the intended schema depends on the session's effective `search_path` (see §3.4); this is not proven by the SQL alone and must be verified in the isolated test environment without connecting to the operational PG 18 service. No `CREATE DATABASE`, `DROP DATABASE`, or server-level objects. The runner connects to one database (from `DATABASE_URL`) and operates within it.

### 3.6 Rollback files and applicability
- `down/19_authz_rebuild.sql`, `down/20_authz_backfill.sql`, `down/21_direct_amounts.sql` — manual rollback scripts for the authz rebuild. Not applied by the runner (not at top level). Their applicability to the duplicate-migration scenario is **Unknown** (not exercised in this phase). They are rollback *design*, not tested recovery.

### 3.7 Migration-related scripts
- `scripts/backup-db.ps1` — Docker-based pg_dump (container `company-ops-postgres`).
- `scripts/backup-db-local.ps1` — local pg_dump to `cos_db` on `127.0.0.1:5432` (user `cos`). Reveals a local PostgreSQL instance on port 5432, but this is operational infrastructure — do not connect to or modify it.
- `scripts/restore-db.ps1` — restores a backup into a temporary database `cos_restore_test` via Docker (read-only verification pattern).
- `apps/api` package scripts: `build`, `dev`, `start`, `test`, `test:watch`, `typecheck`. No migration-specific script beyond `runMigrations` (called at startup via `app.ts:13-18`).

### 3.8 Required extensions and privileges summary (for the test environment)

| Requirement | Source | Notes |
|---|---|---|
| Extensions `uuid-ossp`, `pg_trgm` | `001_initial_schema.sql` | Trusted extensions in PG 18: non-superuser with DB-level `CREATE` can install if extension files are available; superuser not inherently required |
| DDL privileges (CREATE TABLE, INDEX, CONSTRAINT, ALTER) | All migrations | Test role needs DDL on target schema (default `public`, subject to `search_path` verification) |
| No cross-DB or server-level objects | All migrations | Safe to run in an isolated single DB |
| No filesystem operations in SQL | All migrations | Safe |
| Default `public` schema (subject to `search_path` verification) | All migrations | No schema creation needed, but effective `search_path` must be verified |
| Transaction per file (runner-managed) | `migrate.ts` | Each file atomic; failure stops runner |

### 3.9 Privilege matrix (statement-by-statement, from actual SQL)

| Operation (from migrations) | Required privilege | Notes |
|---|---|---|
| `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` / `"pg_trgm"` | Database-level `CREATE` (non-superuser, trusted extensions in PG 18) + extension files present on server | Not inherently superuser-only; superuser only if extension files unavailable or extension is untrusted |
| `CREATE TABLE` / `CREATE INDEX` / `CREATE UNIQUE INDEX` | `CREATE` on target schema (default `public`, subject to `search_path` verification) | Standard DDL |
| `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` | Ownership of the table | |
| `ALTER TABLE ... ADD CONSTRAINT` / FK | Ownership of the table | |
| `ALTER TABLE ... DROP CONSTRAINT IF EXISTS` | Ownership of the table | Used in `16_ipc_rejected_status.sql` |
| `INSERT INTO ... SELECT ... ON CONFLICT DO NOTHING` | `INSERT` on target table; `SELECT` on source table | Within same DB |
| `UPDATE ... SET ... WHERE ...` | Ownership or `UPDATE` privilege on target table | Category normalization (09) + sessions revoked_at (19) |
| `DELETE FROM ... WHERE ...` | Ownership or `DELETE` privilege on target table | `09_fix_document_categories.sql` |
| `CREATE SEQUENCE` / `setval` (counters) | `CREATE` on schema + ownership | Used for auto-numbering |
| `DROP` / `TRUNCATE` | Ownership | None identified as table-level drops (Verified — only `DROP CONSTRAINT IF EXISTS`; no `DROP TABLE`/`DROP SCHEMA`) |

Where exact requirements cannot be established statically, they remain **Unknown**. No server-wide superuser grant is recommended without a specific, proven requirement (none is proven for these operations).

---

## 4. Comparison of Environment Options

### Option A — Separate Windows VM
- **Description:** A separate Windows VM with its own PostgreSQL installation and data directory.
- **Resources:** VM host (Hyper-V/VMware/VirtualBox), Windows license, ~4–8 GB RAM, ~20–40 GB disk, PostgreSQL 16/17/18 installer.
- **Prerequisites:** VM provisioning capability, installer media, network isolation from production, ability to dispose of VM.
- **Isolation:** Strong — completely separate OS, data directory, service, and network.
- **Pros:** Full isolation; no risk to host PG 17/18; reproducible; can match production version; disposable.
- **Cons:** Requires VM infrastructure; slower to set up; more resource-heavy.
- **Verdict:** Safest and most defensible. Recommended primary option.

### Option B — Separate host (physical or virtual)
- **Description:** A different machine (physical or cloud VM) hosting a disposable PostgreSQL instance.
- **Resources:** Remote host, PostgreSQL install, network access (restricted), credentials for the test instance only.
- **Prerequisites:** Host access, firewall/network isolation, ability to dispose.
- **Isolation:** Strong — separate machine, separate service, separate data.
- **Pros:** No local resource contention; strong isolation; can match production exactly.
- **Cons:** Network dependency; credential management for the test instance; potential data-in-transit concerns (use local-only or VPN).
- **Verdict:** Equivalent isolation to Option A; choose based on available infrastructure. Acceptable alternative.

### Option C — Independent local PostgreSQL cluster
- **Description:** `initdb` a new cluster in a separate data directory on the same host, on a dedicated port.
- **Evidence:** Two attempts (PG 17 on port 5439, PG 18 on port 5440) initialized and started but crashed with `0xC0000142` (STATUS_DLL_INIT_FAILED) on worker/connection initialization. No connection succeeded. Root cause: likely but unconfirmed (worker-process DLL initialization failure in this execution context).
- **Verdict:** **Not feasible in the current environment** without further diagnosis. Do not repeat the same provisioning attempts without a specific diagnostic justification. Do not recommend changing/reinstalling system DLLs, disabling antivirus, bypassing execution restrictions, or modifying existing services.

### Recommendation
**Option A (separate Windows VM)** is the recommended primary option, with **Option B** as an acceptable alternative based on available infrastructure. **Option C is not recommended** given the unconfirmed `0xC0000142` worker-process failure; it should only be revisited with a specific, separately approved diagnostic plan.

---

## 5. Required Test Database Specification (Proposed — not provisioned)

| Item | Specification |
|---|---|
| Instance | Separate PostgreSQL instance (VM or separate host) |
| PostgreSQL version | Major version 18 — owner-confirmed. Exact minor/patch version: **Unknown** (not independently verified). Use PG 18 (or as close as possible) and record the exact version used. |
| Data directory | Dedicated, outside the repository and outside the operational PG 18 data dir |
| Port | Dedicated, not 5432/5433 (or whatever the operational instance uses) |
| Network binding | Local-only or explicitly restricted (no public exposure) |
| Database name | Dedicated test DB (e.g., `cos_stage2_dryrun`) — not `cos_db` |
| Role | Dedicated test role with minimum required privileges (DDL on target DB; extension creation or pre-installed extensions) |
| Data | Synthetic or owner-authorized isolated copy only — no production data |
| Authentication | Explicit configuration suitable for a temporary test instance (e.g., scram-sha-256 with a test-only password, or trust on localhost) |
| Backup/disposal | Documented stop and removal procedure; data directory removable after test |
| Isolation proof | Verified data directory, listening address/port, target DB identity, no app config/creds used, synthetic data confirmed |

**No credentials or secrets should be copied into project documentation.**

---

## 6. Stage 2 Execution Gates (Required Before Any Migration Execution)

1. Independent database instance proven separate from the legacy PostgreSQL 18 service (different host/VM or proven-isolated cluster).
2. Target data directory and port positively verified (not inferred from repository files).
3. Dedicated test database positively identified.
4. Synthetic or owner-authorized isolated data source confirmed.
5. Migration scripts statically reviewed (this document §3).
6. Duplicate migration impact explicitly understood or safely isolated for testing (`11_modernize_dms.sql` ≡ `18_modernize_dms.sql`, idempotent SQL, runner applies both).
7. Recovery and disposal procedure documented (§5 above + doc D §5).
8. Owner review of the isolation evidence.

A successful connection alone is not sufficient to prove isolation. No migration, seeder, SQL, D6 migration, D6 writer switch, or D7 adapter implementation is authorized until all gates pass and owner review is complete.

---

## 7. Known Unknowns and Risks

- Production PostgreSQL version (owner says 18, but exact patch version Unknown).
- Applied migrations (19–21) in production (Unknown — no authorized evidence).
- Production dataset size and row counts (Unknown).
- Active production secret source (env vs file) (Unknown).
- Deployed CORS configuration (Unknown).
- Contract deltas (prototype ↔ live API) (Unknown — contract map not finalized).
- Audit/notification source-to-target field mapping completeness (Unknown/Proposed).
- Whether `sessions.json` JsonStore is invoked at runtime (Unknown).
- Whether counters/other bootstrap JSONs are read at runtime beyond seed (Unknown).
- import_history.json vs PG table content delta (Unknown).
- Exact per-endpoint HTTP method/request shapes (Unknown — to be generated post-contract-map).
- Target schema nullability/constraints (may differ from `001_initial_schema.sql` due to migrations 19–21) (Unknown).
- Whether the `uuid-ossp`/`pg_trgm` extensions are pre-installed or require superuser in the target (Unknown).
- Environment-level DLL initialization failure (`0xC0000142`) root cause (likely but unconfirmed).
- Duplicate migration idempotency not tested (**Unknown** — `IF NOT EXISTS`/`ON CONFLICT DO NOTHING` reduce failure likelihood on repeat but do not by themselves establish full semantic idempotency; must be verified in the isolated dry run).

---

## 8. Documentation Changes (This Pass)

- **Created:** `docs/frontend-rebuild/phase-12/phase-12-stage-2-environment-plan.md` (this document).
- **Updated:** `docs/frontend-rebuild/phase-12/phase-12-stage-2-dry-run-report.md` — added §9 (scope note + diagnostic findings + removal procedure + updated final decision) and §10 (final decision) clarification. Historical failure evidence preserved.
- **Not modified:** Docs A, B, C, D, E (except earlier D8/D4 status synchronization in A, D, E — not in this pass). No source, tests, DB, migrations, config, secrets, dependencies, or Git state changed.

---

## 9. Final Git Status

```
 M apps/api/logs/service-err.log
 M apps/api/logs/service-out.log
 M apps/api/src/... (18 conflict-repair files)
 M package-lock.json
 M package.json
 M scripts/install-service.ps1
 M test-results/.last-run.json
?? COS_Full_Frontend_Rebuild_Phase_Prompts_AR.md
?? COS_Full_Frontend_Rebuild_Plan_AR.md
?? docs/
```
No staging, no commit, no reset. Pre-existing tracked modifications preserved untouched.

---

**Final status: `BLOCKED — ENVIRONMENT PLAN READY FOR OWNER REVIEW; NO TEST DATABASE PROVISIONED.`**

**Do not proceed to Stage 2 migration execution, Stage 3, Phase 13, D6 execution, or D7 implementation.**