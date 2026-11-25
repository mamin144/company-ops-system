# Phase 12 — Stage 2 Dry Run Report

Status: **STAGE 2 DRY RUN EXECUTED — ISOLATED POSTGRESQL 17 TEST DATABASE. PASS WITH LIMITATIONS. Not production-ready.**
Baseline: branch `main`, HEAD `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf`, October 2026.
Companion docs: A (`phase-12-separation-migration-architecture-report.md`), B (`phase-12-data-migration-matrix.md`), C (`phase-12-api-auth-permissions-map.md`), D (`phase-12-migration-validation-rollback-plan.md`), E (`phase-12-owner-decision-record.md`), Stage 0 inventory (chat-only, 2026-10-29), Stage 1 target design (`phase-12-stage-1-target-design.md`), Stage 2B report (`phase-12-stage-2b-report.md` — populated-data verification + PG 18 feasibility).

**Language note:** technical body in English (see doc A header).

**Evidence labels:** `Verified` = file/code/SQL proof · `Inferred` = engineering deduction with named sources · `Proposed` = unimplemented design · `Unknown` = could not be verified now · `Recorded Owner Decision` = decision recorded in doc E.

**Scope:** documentation only. This report records approval, repair, typecheck, entry-condition verification, and the Stage 2 outcome. No application source, test, database, migration, schema, secret, configuration, deployment, or Git state was changed to execute Stage 2 (Stage 2 did not execute).

---

## 1. Stage 1 Owner Approval

- **Stage 1 — OWNER APPROVED (DESIGN ONLY, 2026-10-29).** The target design document `docs/frontend-rebuild/phase-12/phase-12-stage-1-target-design.md` is approved as a design document only.
- This approval does not establish unverified production facts, finalize unverified production-schema assumptions, or grant unrestricted implementation or production-change authorization.
- D1–D8 preserved with their existing meanings. D8 final approval (2026-10-29) recorded; final D8 approval is not permission to skip any stage gate.
- The owner authorized the previously approved D4 conflict-marker repair task to begin within its original narrow scope.
- D6 and D7 implementation remain gated by their existing requirements and approvals.
- Stage 2 remains conditional on its actual entry gates.
- No production deployment, DDL, data migration, secret rotation, permission change, or Phase 13 work is authorized by this approval.

---

## 2. D4 Repair Results

### 2.1 Scope
- **Task:** narrowly scoped repair of 18 conflict-marked source files under `apps/api/src/**`.
- **Scope preserved:** restore compilable source while preserving intended logic; re-run `npm run typecheck` to exit 0; bundle no unrelated changes. No refactoring, redesign, dependency upgrades, or feature work.

### 2.2 Files repaired (18)
`middleware/auth.ts`, `routes/index.ts`, `services/auth.service.ts`, `services/authorization.service.ts`, `services/global-search.service.ts`, `services/projectScope.ts`, `modules/auth/auth.routes.ts`, `modules/documents/documents.routes.ts`, `modules/folders/folders.routes.ts`, `modules/import/import.routes.ts`, `modules/material-requests/material-requests.routes.ts`, `modules/projects/boq.routes.ts`, `modules/projects/ipc.routes.ts`, `modules/projects/projects.routes.ts`, `modules/roles/roles.routes.ts`, `modules/sites/sites.routes.ts`, `modules/stock/stock.routes.ts`, `modules/warehouses/warehouses.routes.ts`.

### 2.3 Resolutions
- **21 conflict blocks** resolved across the 18 files.
- **All conflicts were import-path suffix conflicts** (`.js` vs. no suffix) except one substantive block in `modules/auth/auth.routes.ts` (the `effect` enum validation).
- **Resolution rule (evidence-based):** the project is ESM (`"type": "module"` in `apps/api/package.json`), so relative imports require the `.js` suffix. The HEAD side (with `.js`) was retained for every import-suffix conflict. This is the smallest change that restores compilability without altering logic.
- **Substantive block (`modules/auth/auth.routes.ts`, effect enum):** HEAD side retained — it includes `z.preprocess((v) => (typeof v === 'string' ? v.toLowerCase() : v), z.enum(['grant','deny']))` plus the explanatory comment that the UI sends uppercase GRANT/DENY radios and the canonical DB form is lowercase. The other side dropped both the preprocessing and the comment, which would reject uppercase input. HEAD side preserved because (a) the comment documents intent, (b) the DB canonical form is lowercase (`z.enum(['grant','deny'])`), and (c) it handles both cases without broadening acceptance.
- **No conflict markers remain** in `apps/api/src/**` (verified by read-only scan: 0 files).
- No unrelated refactoring, redesign, dependency upgrade, or feature work was performed. Pre-existing user changes (logs, package files, scripts, test-results, COS_*.md, docs/) were preserved untouched.

### 2.4 Unresolved conflict damage
- None. All 21 blocks resolved with evidence. No file was left with active conflict markers.

---

## 3. Typecheck Gate

- **Command:** `npm run typecheck` (run from `apps/api/`).
- **Script:** `tsc -p tsconfig.json --noEmit` (from `apps/api/package.json`).
- **Exit code:** `0`.
- **Diagnostics:** none (clean).
- **Gate status:** PASSED. Stage 2 is not blocked by typecheck.

---

## 4. Stage 2 Entry-Condition Verification

| Gate | Status | Evidence |
|---|---|---|
| D4 complete | PASS | 18 files repaired, 21 blocks resolved, 0 conflict markers remain in `apps/api/src/**` |
| `npm run typecheck` exited 0 | PASS | Exit code 0, no diagnostics |
| Demonstrably isolated and disposable database environment | **BLOCKED — not proven available** | See §5 |
| Authorized isolated data source | **BLOCKED — not proven available** | See §5 |
| Migration runner / ordering / transaction behavior inspected | PASS | `migrate.ts` read-only; sorts `.sql` by `localeCompare`; per-file BEGIN/COMMIT with ROLLBACK on failure; tracks in `_migrations` |
| Specific test scope documented | PASS | Doc D Stage 3 scope rule + this report §6 |
| No production connection or production mutation required | PASS (by construction — Stage 2 did not execute) | — |

**Production facts remain Unknown:** PostgreSQL version, applied migrations (19–21), dataset size, active secret source, CORS config, and other unverified production facts were not inferred from repository files and no production connection was made.

---

## 5. Stage 2 Execution — BLOCKED

**Final Stage 2 status: `BLOCKED`.**

### Missing gate (exact)
No demonstrably isolated and disposable database environment and no authorized isolated data copy are available in this environment. Therefore no migration script was executed.

### Evidence
- Docker is not available in this environment (no `docker` command; `docker ps` failed). The `docker-compose.yml` PostgreSQL service (`company-ops-postgres`, host port 5433) cannot be started.
- Host PostgreSQL services are running (`postgresql-x64-17`, `postgresql-x64-18`, both Automatic/Running), but their role (production vs. development) is unverified. They cannot be treated as a proven-isolated environment, and no production connection or inference from repository files is permitted.
- No authorized isolated data copy or controlled synthetic fixture was provided.
- The vitest fallback (`postgres://postgres:123@localhost:4000/cos_db`) points at a host endpoint whose isolation and authorization status is unverified; it is not a proven-isolated environment.
- `.env` files exist (root and `apps/api/`) but were not read (secret-value rule); no production credentials were used.

### Safe preparation completed (read-only, no execution)
- Migration runner inspected: `migrate.ts` reads `migrations/*.sql` sorted by `localeCompare`, applies each in its own transaction (BEGIN/COMMIT, ROLLBACK on failure), tracks names in `_migrations` (UNIQUE). No cross-file transaction.
- Migration files: 19 top-level `.sql` files (plus 3 in `down/`, not applied by runner). Duplicate: `11_modernize_dms.sql` ≡ `18_modernize_dms.sql` (1,644 bytes, identical sha256 `852AB84B901D…`). Runner applies both because filenames differ → two `_migrations` rows. Idempotency not tested (**Unknown** — `IF NOT EXISTS`/`ON CONFLICT DO NOTHING` reduce failure likelihood on repeat but do not by themselves establish full semantic idempotency; must be verified in the isolated dry run).
- Transaction behavior: per-file BEGIN/COMMIT; on failure ROLLBACK of that file then throw (stops runner). No partial cross-file state within one file's transaction, but a failed run leaves earlier files applied.
- Rollback limitations (from doc D §5): no general-purpose inverse migration exists; restoring a pre-cutover snapshot does not preserve post-cutover writes; audit logs cannot be relied on for reversal until before/after information is verified (Unproven); file attachments need their own recovery plan. If no reliable rollback path exists, rollback is unsafe and blocks cutover approval.

### What was NOT executed (per boundaries)
- No migration script, no SQL, no `npm run typecheck` re-run (already captured in §3), no seeder, no application script.
- No D6 audit-log/notification migration, no D6 writer switch.
- No D7 HTTP adapter implementation.
- No secret movement/rotation.
- No permission, route, namespace, or frontend changes.
- No Stage 3, no Phase 13, no production connection.

### Checks not executed and why
- Dry-run execution: blocked (no proven isolated DB/data copy).
- Before/after counts or checksums: not available (no execution).
- Idempotency/re-run test: not executed (no isolated environment).
- Controlled-failure recovery test: not executed.

---

## 6. Blockers and Remaining Unknowns

### Blockers
- **Stage 2 execution blocked** by missing proven isolated database environment / authorized data copy. No improvisation with production credentials or the application's current database was performed.

### Remaining Unknowns (production facts)
- Production PostgreSQL version and applied migration set (19–21).
- Production dataset size / row counts.
- Active production secret source (env `JWT_SECRET` vs `data/.jwt-secret` fallback).
- Deployed CORS configuration.
- Contract deltas (prototype ↔ live API) — contract map not finalized.
- Audit/notification source-to-target field mapping and before/after state sufficiency.
- Whether `sessions.json` JsonStore is invoked at runtime.
- Whether counters/other bootstrap JSONs are read at runtime beyond seed.
- import_history.json vs PG table content delta.
- Exact per-endpoint HTTP method/request shapes (conflict markers resolved; contract inventory still to be generated).
- Target schema nullability/constraints (may differ from `001_initial_schema.sql` due to migrations 19–21).

---

## 7. Files Changed and Git Status

### Files changed by this task
- **Created:** `docs/frontend-rebuild/phase-12/phase-12-stage-2-dry-run-report.md` (this report).
- **Modified (D4 repair):** 18 files under `apps/api/src/**` (conflict markers removed; `.js` import suffixes restored; `modules/auth/auth.routes.ts` effect enum normalization preserved). See §2.2 for the list.
- **Modified (approval addenda):** `docs/frontend-rebuild/phase-12/phase-12-stage-1-target-design.md` (Status + §9 Owner Approval Addendum), `docs/frontend-rebuild/phase-12/phase-12-owner-decision-record.md` (Stage 1 Approval Addendum + D4 execution status + sequencing item 1).
- **Modified (D8 status synchronization, earlier this session):** `docs/frontend-rebuild/phase-12/phase-12-separation-migration-architecture-report.md`, `docs/frontend-rebuild/phase-12/phase-12-migration-validation-rollback-plan.md`, `docs/frontend-rebuild/phase-12/phase-12-owner-decision-record.md`.

### Files NOT changed
- Docs B and C (`phase-12-data-migration-matrix.md`, `phase-12-api-auth-permissions-map.md`) — untouched.
- No application source beyond the 18 D4 files; no tests, builds, migrations, schemas, configs, secrets, dependencies, or deployment files.
- No `package.json` or `package-lock.json` changes.

### Git status (no staging, no commit, no reset performed)
```
 M apps/api/logs/service-err.log
 M apps/api/logs/service-out.log
 M package-lock.json
 M package.json
 M scripts/install-service.ps1
 M test-results/.last-run.json
 M apps/api/src/... (18 conflict-repair files — modified)
?? COS_Full_Frontend_Rebuild_Phase_Prompts_AR.md
?? COS_Full_Frontend_Rebuild_Plan_AR.md
?? docs/
```
Pre-existing tracked modifications (logs, package-lock.json, package.json, scripts/install-service.ps1, test-results/.last-run.json) were preserved untouched. The `docs/` directory remains untracked (includes Phase 12 documents).

---

## 8. Final Gate Decision

**BLOCKED** — Stage 2 execution did not run because no demonstrably isolated and disposable database environment or authorized isolated data copy is available. No migration script was executed. No production connection was made.

- Typecheck gate: **PASSED** (exit 0).
- D4 repair: **COMPLETE** (18 files, 21 blocks, 0 markers remaining).
- Stage 2 dry run: **BLOCKED** (missing proven isolated DB/data copy).
- Stage 3, Phase 13, D6 data migration, D7 adapter implementation: **not started**.

The next step requires owner review and provision of a demonstrably isolated, disposable database environment and an authorized isolated data copy (or controlled synthetic fixture) before Stage 2 can execute. A successful repository-level or isolated dry run is not proof of production migration readiness.
---

## 9. Stage 2 Environment Provisioning Attempt (2026-10-29)

**Scope note (not read-only):** this provisioning attempt was **not** a read-only operation. It initialized two temporary PostgreSQL clusters (`initdb`) and adjusted their local `postgresql.conf` files (port, listen_addresses). These are temporary artifacts outside the repository; they are **not** the application's existing databases, production data, application configuration, or Git state. No application source, migration, schema, secret, or production setting was changed. The clusters failed and stopped; no migration or SQL was executed.

### Available PostgreSQL tooling
- PostgreSQL 17: `C:\Program Files\PostgreSQL\17\bin\` — `initdb.exe`, `pg_ctl.exe`, `psql.exe`, `postgres.exe` (all present).
- PostgreSQL 18: `C:\Program Files\PostgreSQL\18\bin\` — same set (all present).
- Docker: **not available** (no `docker` command); the `docker-compose.yml` PostgreSQL service cannot be started.
- Existing host services: `postgresql-x64-17` and `postgresql-x64-18` (both Running, Automatic). **Not used** — role (production vs. development) unverified; no connection was made to either.
- `node_modules/pg` present at repository root (not in `apps/api/node_modules`).

### Provisioning attempt — PostgreSQL 17
- Data directory: `C:\Users\PC-01\AppData\Local\Temp\opencode\pg-stage2-cluster` (outside repository).
- `initdb --auth=trust --encoding=UTF8 --locale=C` — **succeeded**.
- `postgresql.conf` set: `listen_addresses = '127.0.0.1'`, `port = 5439`.
- `pg_ctl start` — server reported "ready to accept connections" on 127.0.0.1:5439.
- **Failure:** on the first connection attempt, a server worker process (PID 5708) was terminated by exception `0xC0000142` (STATUS_DLL_INIT_FAILED). The server shut down. No psql connection succeeded. No database was created.

### Provisioning attempt — PostgreSQL 18
- Data directory: `C:\Users\PC-01\AppData\Local\Temp\opencode\pg-stage2-cluster-18` (outside repository).
- `initdb --auth=trust --encoding=UTF8 --locale=C` — **succeeded**.
- `postgresql.conf` set: `listen_addresses = '127.0.0.1'`, `port = 5440`.
- `pg_ctl start` — server reported "ready to accept connections" on 127.0.0.1:5440.
- **Failure:** an autovacuum worker (PID 5064) was terminated by exception `0xC0000142` (STATUS_DLL_INIT_FAILED) ~2 minutes after startup. The server shut down. No psql connection succeeded. No database was created.

### Isolation evidence (not achieved)
- No `SHOW data_directory`, `SHOW port`, `inet_server_addr()`, or target-database verification was obtained because no connection succeeded.
- The clusters are confirmed **not** to be the existing host services (different data directories, ports 5439/5440, PIDs distinct from the host services' PIDs), but they are **not usable** — they crash on connection/worker initialization.
- No application configuration or production credentials were used. No production access occurred.

### Files / directories created
- `C:\Users\PC-01\AppData\Local\Temp\opencode\pg-stage2-cluster` (PG 17 cluster; stopped; crashed state).
- `C:\Users\PC-01\AppData\Local\Temp\opencode\pg-stage2-cluster-18` (PG 18 cluster; stopped; crashed state).
- Server logs inside each data directory (`server.log`).

### Safe removal procedure (after owner review)
```
# PG 17
"C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" -D "C:\Users\PC-01\AppData\Local\Temp\opencode\pg-stage2-cluster" -m fast stop
Remove-Item -Recurse -Force "C:\Users\PC-01\AppData\Local\Temp\opencode\pg-stage2-cluster"

# PG 18
"C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "C:\Users\PC-01\AppData\Local\Temp\opencode\pg-stage2-cluster-18" -m fast stop
Remove-Item -Recurse -Force "C:\Users\PC-01\AppData\Local\Temp\opencode\pg-stage2-cluster-18"
```
(Both clusters are already stopped; the commands above are idempotent for stop and remove the data directories.)

### Result
- **Provisioning: FAILED.** Both independent clusters initialized and started but crashed with `0xC0000142` (STATUS_DLL_INIT_FAILED) on worker/connection initialization. No usable isolated PostgreSQL environment was produced.
- **No migration was executed.** No D6/D7 work. No production access.

---

## 10. Final Decision

**BLOCKED.** A demonstrably isolated, disposable PostgreSQL environment could not be provisioned in this environment (worker processes crash with `0xC0000142`). Stage 2 migration execution remains blocked. No production or application changes were made.

The next step requires either (a) resolving the environment-level DLL initialization failure (e.g., reviewing conflicting DLLs/AV on the host) or (b) provisioning an isolated PostgreSQL instance on a different host/container environment, followed by owner review of the isolation evidence before any migration script runs.

---

## 11. Diagnostic Findings (2026-10-29)

### Evidence reviewed
- Both clusters' `server.log` files (timestamps 14:05–14:12 EEST).
- Safe process-launch probes: `cmd /c "echo probe_ok"` (exit 0); `postgres --version` for PG 17 (exit 0) and PG 18 (exit 0); `pg_ctl --version` (exit 0).
- PATH PostgreSQL entries: **none** (binaries invoked by absolute path; no cross-version PATH pollution).
- Windows Application/System event logs in the crash window: **no matching events found** (logging may be unavailable in this context).

### Crash details
- PG 17: server process (PID 3052) terminated by exception `0xC0000142` (STATUS_DLL_INIT_FAILED) on connection attempt (14:07:25). Main postmaster started fine and bound 127.0.0.1:5439.
- PG 18: autovacuum worker (PID 5064) terminated by exception `0xC0000142` ~2 min after startup (14:12:34). Main postmaster started fine and bound 127.0.0.1:5440.
- All key DLLs present in PG 17 bin (`libpq.dll`, `libcrypto-3-x64.dll`, `libssl-3-x64.dll`, `libintl-9.dll`, `libiconv-2.dll`, `libxml2.dll`, `libxslt.dll`, `zlib1.dll`, `libwinpthread-1.dll`).

### Root-cause assessment: likely but unconfirmed
- The main PostgreSQL process starts and binds the port successfully; worker processes (connection backend, autovacuum) crash with `0xC0000142` (STATUS_DLL_INIT_FAILED) during initialization.
- The crash is specific to worker-process initialization in this execution context, not a total sandbox block (`cmd.exe` probe and `postgres --version` both succeed with exit 0).
- No specific failing module was identified: Windows event logs returned no matching events; no DLL diagnostic tool was available without installation.
- Likely cause: a worker-process DLL initialization failure in this execution environment (possibly a conflicting DLL or runtime dependency loaded only in worker processes). This is not proof of a specific root cause.
- No bypass of the sandbox, privilege escalation, or security-policy modification was attempted.

### Temporary artifact status
- PG 17 cluster: stopped (was already shut down after crash). Data dir remains: `C:\Users\PC-01\AppData\Local\Temp\opencode\pg-stage2-cluster`.
- PG 18 cluster: stopped (`pg_ctl stop` succeeded). Data dir remains: `C:\Users\PC-01\AppData\Local\Temp\opencode\pg-stage2-cluster-18`.
- Both data directories and their `server.log` files remain in place as evidence.
- Safe removal (after owner review):
  ```
  Remove-Item -Recurse -Force "C:\Users\PC-01\AppData\Local\Temp\opencode\pg-stage2-cluster"
  Remove-Item -Recurse -Force "C:\Users\PC-01\AppData\Local\Temp\opencode\pg-stage2-cluster-18"
  ```

### Updated final decision
**BLOCKED.** Root cause: likely but unconfirmed (worker-process DLL initialization failure, `0xC0000142`). Stage 2 migration execution remains blocked. No production or application changes were made.

The next step requires either (a) resolving the environment-level DLL initialization failure (e.g., reviewing conflicting DLLs/AV on the host, or an interactive-shell test on a different host) or (b) provisioning an isolated PostgreSQL instance on a different host/container environment, followed by owner review of the isolation evidence before any migration script runs. A successful repository-level or isolated dry run is not proof of production migration readiness.

---

## 12. Stage 2 Execution Results (isolated PostgreSQL 17 test database)

### 12.1 Environment verification evidence (read-only, then executed)

| Property | Verified value |
|---|---|
| PostgreSQL version | 17.11 (x86_64-windows, msvc-19.44) |
| Data directory | `C:/Program Files/PostgreSQL/17/data` |
| Port | 5433 |
| Listen addresses | `127.0.0.1`, `::1` |
| Connected address | `::1` |
| Administrative user | `postgres` (superuser = true, CreateDB = true) |
| Test database | `cos_stage2_dryrun` |
| Test database owner | `postgres` |
| Authentication | SCRAM-SHA-256 |
| Connection | Verified via psql (read-only probe, then execution) |
| Available extensions | `pg_trgm` 1.6 and `uuid-ossp` 1.1 (available; installed by migration 001) |
| Initial state | Empty DB: 0 tables, `_migrations` absent, only `plpgsql` extension installed |

Target confirmed as `cos_stage2_dryrun` on port 5433 before any execution. No production application credentials or configuration were used; the test DB password was provided by the owner for this session and was not written to any file.

### 12.2 Exact migration execution order

Executed via the repository's migration runner (`apps/api/src/database/migrate.ts`) invoked through `tsx`, with `DATABASE_URL` and `PGPASSWORD` set in the process environment only (not written to any `.env` file). Runner order (localeCompare sort):

1. `001_initial_schema.sql`
2. `05_create_boq_and_ipcs.sql`
3. `06_add_ipc_deductions.sql`
4. `07_add_region_and_doc_ipc_link.sql`
5. `08_seed_doc_categories.sql`
6. `09_fix_document_categories.sql`
7. `10_add_revisions_column.sql`
8. `11_add_stock_items_column.sql`
9. `11_modernize_dms.sql`
10. `12_backfill_document_revisions.sql`
11. `13_add_project_owner.sql`
12. `14_seed_runtime_stores.sql`
13. `15_import_json_history.sql`
14. `16_ipc_rejected_status.sql`
15. `17_core_uniqueness.sql`
16. `18_modernize_dms.sql`
17. `19_authz_rebuild.sql`
18. `20_authz_backfill.sql`
19. `21_direct_amounts.sql`

### 12.3 Per-migration results

All 19 migrations applied successfully. `Database migrations are up to date.` Exit code 0. No errors, no rollbacks triggered. Per-migration durations were sub-second (runner completed in under one second total). Each file was applied in its own transaction (BEGIN/COMMIT) per `migrate.ts`.

### 12.4 Duplicate migration behavior (explicit test)

Both `11_modernize_dms.sql` and `18_modernize_dms.sql` were applied by the runner (separate filenames → two `_migrations` rows, ids 9 and 16). A manual second execution of `18_modernize_dms.sql` via psql (after both had been applied) produced:
- `CREATE TABLE` (folders): "already exists, skipping"
- `CREATE TABLE` (document_links): "already exists, skipping"
- `ALTER TABLE ... ADD COLUMN folder_id`: "already exists, skipping"
- `INSERT 0 0` (three times — project_id, site_id, ipc_id backfill)
- Exit code 0.

Counts before and after the manual re-run were identical (`document_links` = 0, `folders` = 0), confirming SQL-level idempotency (IF NOT EXISTS / ON CONFLICT DO NOTHING) in this empty-data scenario. **Limitation:** the INSERT statements produced 0 rows because the seed data contains no documents with non-null project_id/site_id/ipc_id; full idempotency with populated data is not proven and remains a required test case.

### 12.5 Resulting schema validation

| Metric | Result |
|---|---|
| Tables (public schema) | 27 (including `_migrations`) |
| Extensions installed | `pg_trgm` 1.6, `plpgsql` 1.0, `uuid-ossp` 1.1 |
| CHECK constraints (contype c) | 14 |
| Foreign keys (contype f) | 29 |
| Primary keys (contype p) | 89 |
| UNIQUE constraints (contype u) | 63 |
| Indexes (public schema) | 69 |
| `_migrations` records | 19 (one per file, including both 11 and 18) |

Seeded data counts: roles 5, categories 14, units 5, counters 3, import_history 1; users 0, projects 0, documents 0, audit_logs 0, notifications 0, sessions 0. (Users are seeded by app startup via `storage/seed-users.ts`, not by SQL migrations — consistent with codebase design; not a migration failure.)

### 12.6 Migration tracking validation

`_migrations` contains 19 rows, one per migration file in runner order, with `applied_at` timestamps. Both duplicate filenames (`11_modernize_dms.sql` and `18_modernize_dms.sql`) are recorded as separate rows (ids 9 and 16). Tracking is consistent with the runner's design.

### 12.7 Repeatability / idempotency findings

- **Runner-level:** re-running `migrate.ts` against the same DB produced `Database migrations are up to date.` (exit 0) — no re-application. Runner skips already-applied files by name. **PASS.**
- **SQL-level (duplicate pair):** manual re-execution of `18_modernize_dms.sql` produced zero new rows and no errors (exit 0). **PASS in empty-data scenario.**
- **Not proven:** full idempotency with populated data (INSERT statements rely on `ON CONFLICT DO NOTHING` against the unique constraint; with real documents carrying project_id/site_id/ipc_id, the second run must insert zero rows — not tested with real data). Idempotency remains a required test case for any future dry run with authorized data.

### 12.8 Errors and unresolved risks

- **No migration errors.** All 19 applied; exit 0.
- **Unresolved risks:**
  - Duplicate migration idempotency not proven with populated data (Unknown).
  - Target schema nullability/constraints may differ from `001_initial_schema.sql` due to migrations 19–21 (verified against applied set in this isolated DB; production applied set still Unknown).
  - PG 17 vs PG 18 compatibility: migrations use standard SQL and contrib extensions available in both; no PG 18-specific features observed. However, production runs PG 18; the dry run on PG 17 does not prove PG 18 behavior. Version difference is a compatibility limitation, not a failure.
  - Users not seeded by SQL migrations (app-startup seeding); production data seeding path not exercised.
  - No production data, so data-level validation (counts, checksums, field-level correctness) was not performed.

### 12.9 PostgreSQL 17 vs 18 compatibility limitations

- Major version difference: dry run on PG 17.11; production on PG 18 (owner-confirmed major version; exact patch Unknown).
- Migrations use standard SQL + contrib extensions (`uuid-ossp`, `pg_trgm`) available in both 17 and 18.
- No PG 18-specific features observed in the migration SQL.
- The dry run validates migration logic on PG 17 only; it does not prove identical behavior on PG 18 (e.g., extension availability, default settings, optimizer behavior).
- Recommendation: if feasible, repeat the dry run on PG 18 in an isolated environment (subject to the same isolation proof) before production migration readiness can be assessed. The previous PG 18 temporary cluster attempt failed with `0xC0000142`; a working PG 18 isolated environment is still needed.

### 12.10 Cleanup and recovery instructions

- The test database `cos_stage2_dryrun` on PG 17:5433 contains test-only schema and seed data. It may be dropped when no longer needed: `DROP DATABASE cos_stage2_dryrun;` (run by the owner via pgAdmin/psql against the PG 17 instance only).
- The temporary PG 17/18 clusters (data dirs in `C:\Users\PC-01\AppData\Local\Temp\opencode\pg-stage2-cluster*`) are already stopped and may be removed using the commands in Stage 2 report §9. They contain no production data.
- No production database, application configuration, or Git state was modified.

### 12.11 Updated Git status

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
No staging, no commit, no reset. Pre-existing tracked modifications preserved. The `docs/` directory (untracked) contains all Phase 12 documents including the updated Stage 2 report.

---

## 13. Final Gate Decision

**PASS WITH LIMITATIONS** — isolated PostgreSQL 17 dry run executed successfully (all 19 migrations applied, exit 0; schema validated; runner idempotency confirmed; duplicate pair idempotent in empty-data scenario). Not production-ready.

- Typecheck gate: **PASSED** (exit 0).
- D4 repair: **COMPLETE** (18 files, 21 blocks, 0 markers).
- Stage 2 dry run: **EXECUTED** (isolated PG 17:5433, `cos_stage2_dryrun`) — all 19 migrations applied, exit 0.
- Limitations: duplicate idempotency not proven with populated data; PG 17 vs PG 18 compatibility not verified; no production data validation; users not seeded by SQL migrations.
- Stage 3, Phase 13, D6 production data migration, D7 adapter implementation: **not started**.

A successful isolated dry run is not proof of production migration readiness. Production facts remain Unknown. The next step requires owner review of this report and, if desired, a repeat dry run on PG 18 in an isolated environment before production migration readiness can be assessed.
