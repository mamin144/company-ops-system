# Phase 12 — Stage 2B: PostgreSQL 18 Isolated Compatibility & Populated-Data Verification

Status: **PASS WITH LIMITATIONS — isolated PostgreSQL 17 populated-data dry run executed; PostgreSQL 18 isolated compatibility BLOCKED.**
Baseline: branch `main`, HEAD `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf`, November 2026.
Companion docs: A (`phase-12-separation-migration-architecture-report.md`), B (`phase-12-data-migration-matrix.md`), C (`phase-12-api-auth-permissions-map.md`), D (`phase-12-migration-validation-rollback-plan.md`), E (`phase-12-owner-decision-record.md`), Stage 0 inventory (chat-only), Stage 1 target design (`phase-12-stage-1-target-design.md`), Stage 2 dry-run report (`phase-12-stage-2-dry-run-report.md`), Stage 2 environment plan (`phase-12-stage-2-environment-plan.md`).

**Language note:** technical body in English (see doc A header).

**Evidence labels:** `Verified` = file/code/SQL proof · `Inferred` = engineering deduction with named sources · `Proposed` = unimplemented design · `Unknown` = could not be verified now · `Recorded Owner Decision` = decision recorded in doc E.

**Scope:** isolated testing and documentation only. No production PostgreSQL 18 access, no application source changes, no Stage 3, no Phase 13, no D6 production data migration, no D7 adapter implementation.

---

## 1. Environment Verification Evidence

### Approved test target (PostgreSQL 17)
| Property | Verified value |
|---|---|
| PostgreSQL version | 17.11 (x86_64-windows, msvc-19.44) |
| Data directory | `C:/Program Files/PostgreSQL/17/data` |
| Port | 5433 |
| Listen addresses | `127.0.0.1`, `::1` |
| Connected address | `::1` |
| Administrative user | `postgres` (superuser = true, CreateDB = true) |
| Target database (empty/seeded) | `cos_stage2_dryrun` |
| Target database (populated) | `cos_stage2_populated_dryrun` |
| Test database owner | `postgres` |
| Authentication | SCRAM-SHA-256 |
| Available extensions | `pg_trgm` 1.6, `uuid-ossp` 1.1 |
| Connection | Verified via psql (read-only probe + execution) |

### Absolute protection boundary (PostgreSQL 18)
- PostgreSQL 18 is the operational database service. It was **not connected to, not read, not modified** in any way.
- No production credentials, `.env` values, or application configuration were used.
- All migration testing targeted only `cos_stage2_dryrun` and `cos_stage2_populated_dryrun` on PostgreSQL 17, port 5433.
- The legacy application's connection and credentials were not used.

---

## 2. PostgreSQL 18 Isolated Compatibility (Workstream A) — BLOCKED

### Feasibility investigation
- PostgreSQL 18 binaries available: `C:\Program Files\PostgreSQL\18\bin\` (`initdb.exe`, `pg_ctl.exe`, `psql.exe`, `postgres.exe`); version 18.4.
- A separate temporary PostgreSQL 18 cluster was initialized in `C:\Users\PC-01\AppData\Local\Temp\opencode\pg-stage2-cluster-18` (port 5440, `listen_addresses = 127.0.0.1`) in the prior provisioning pass.
- **Failure:** the cluster initialized and started, but an autovacuum worker (PID 5064) was terminated by exception `0xC0000142` (STATUS_DLL_INIT_FAILED) ~2 minutes after startup. No psql connection succeeded. The cluster shut down.
- The same failure occurred on PostgreSQL 17 (worker PID 3052/5708, exception `0xC0000142`).

### Diagnostic evidence
- Safe probes: `cmd /c "echo probe_ok"` (exit 0), `postgres --version` for PG 17 and PG 18 (exit 0), `pg_ctl --version` (exit 0).
- PATH PostgreSQL entries: none (binaries invoked by absolute path; no cross-version PATH pollution).
- Key DLLs present in PG 17 bin (libpq, libcrypto-3-x64, libssl-3-x64, libintl-9, libiconv-2, libxml2, libxslt, zlib1, libwinpthread-1).
- Windows Application/System event logs in the crash window: no matching events found.
- Root cause: **likely but unconfirmed** — worker-process DLL initialization failure (`0xC0000142`) in this execution context. No specific failing module identified. No bypass of sandbox, privilege escalation, or security-policy modification was attempted.

### Decision
A demonstrably isolated, usable PostgreSQL 18 cluster could **not** be provisioned in this environment. Workstream A and Workstream D (PG 17/18 comparison) are **BLOCKED**. Do not repeat the same provisioning attempts without a specific diagnostic justification. The operational PostgreSQL 18 service remains untouched.

**No PG 18 isolated compatibility verification was performed.**

---

## 3. Workstream B — Populated-Data Testing on PostgreSQL 17

### 3.1 Test database creation and verification
- Created `cos_stage2_populated_dryrun` on PostgreSQL 17:5433 (owner `postgres`). Verified: `current_database() = cos_stage2_populated_dryrun`, `current_user = postgres`, version 17.11, data directory `C:/Program Files/PostgreSQL/17/data`, port 5433.
- `cos_stage2_dryrun` (empty/seeded) was **not dropped or overwritten**.

### 3.2 Migration execution on populated test DB
All 19 migrations applied via the repository runner (`tsx src/database/migrate.ts`, `DATABASE_URL` set in process env only). Exit code 0. `Database migrations are up to date.`

### 3.3 Synthetic data inserted (dependency chain)
- 1 project (`PRJ-TEST-001`, status `active`).
- 1 site (`SITE-001`, linked to project).
- 1 document (`Test Document`, category `Contract`, with `project_id` and `site_id` set).

No real company records, personal information, production backups, or production exports were used.

### 3.4 Duplicate migration verification (populated data)

**Before re-run of `18_modernize_dms.sql`:** `document_links` = 0; documents with project_id = 1; documents with site_id = 1.

**First manual run of `18_modernize_dms.sql` (populated data):**
- `CREATE TABLE` folders: "already exists, skipping"
- `CREATE TABLE` document_links: "already exists, skipping"
- `ALTER TABLE ... ADD COLUMN folder_id`: "already exists, skipping"
- `INSERT 0 1` (project backfill), `INSERT 0 1` (site backfill), `INSERT 0 0` (ipc backfill)
- Exit code 0.
- After: `document_links` = 2 (project 1, site 1).

**Second manual run of `18_modernize_dms.sql` (idempotency test):**
- `INSERT 0 0` (three times).
- Exit code 0.
- After: `document_links` = 2 (unchanged).

**Re-run of `11_modernize_dms.sql` (byte-identical to 18):**
- `INSERT 0 0` (three times). Exit code 0.
- `document_links` = 2 (unchanged).

**Findings:**
- No duplicate logical records introduced.
- Existing relationships remained intact (0 orphans).
- No records silently overwritten.
- Foreign keys remained valid.
- Counts and key values consistent (2 rows: 1 project, 1 site).
- Re-execution produced the expected outcome (0 new rows).

**Duplicate migration classification (updated):** `11_modernize_dms.sql` and `18_modernize_dms.sql` are byte-identical. The runner applies both (different filenames → two `_migrations` rows). SQL-level idempotency is now **verified with populated data**: `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and `INSERT ... ON CONFLICT DO NOTHING` produced zero duplicate rows on re-execution. However, full semantic idempotency remains **partially verified** — the test covered 1 project and 1 site with non-null references; broader coverage (multiple entities, concurrent writes, partially populated states) is still needed. The duplicate remains an explicit test case and is not a resolved migration risk until broader coverage is achieved.

### 3.5 Foreign-key integrity (populated data)
- Orphan `document_links` (no matching document): 0.
- Orphan sites (no matching project): 0.
- Orphan documents (project_id set, no matching project): 0.
- **PASS.**

---

## 4. Workstream C — Migration Contract and Schema Evidence

### Structured migration inventory

| # | Filename | Order | Tables created/altered | Columns added/modified | Constraints & indexes | Extensions | Seed/backfill ops | Destructive/lossy | Idempotency | Dependencies |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 001_initial_schema.sql | 1 | Creates all core tables (roles, users, sessions, projects, sites, documents, document_revisions, document_links, folders, warehouses, items, stock_transactions, stock_transaction_lines, material_requests, material_request_lines, boq_items, ipcs, ipc_items, categories, units, counters, user_permission_overrides, project_members, audit_logs, notifications, import_history) | Full schema baseline | PKs, FKs, UNIQUE, CHECK, indexes | uuid-ossp, pg_trgm | Seed constants (categories, units) | None | CREATE TABLE IF NOT EXISTS (idempotent DDL) | None (baseline) |
| 2 | 05_create_boq_and_ipcs.sql | 2 | boq_items, ipcs, ipc_items | — | FKs, PKs, UNIQUE | — | — | None | CREATE TABLE IF NOT EXISTS | 001 |
| 3 | 06_add_ipc_deductions.sql | 3 | ipcs | deductions NUMERIC(14,2) | — | — | — | None | ALTER ADD COLUMN | 05 |
| 4 | 07_add_region_and_doc_ipc_link.sql | 4 | projects, documents | region (projects), ipc_id (documents) | FK (documents→ipcs) | — | — | None | ALTER ADD COLUMN IF NOT EXISTS | 001, 05 |
| 5 | 08_seed_doc_categories.sql | 5 | categories | — | — | — | Seed doc categories (Arabic canonical) | None | INSERT (seed) | 001 |
| 6 | 09_fix_document_categories.sql | 6 | categories, documents | category (documents) | — | — | DELETE FROM categories WHERE group='document-category'; UPDATE documents SET category (Arabic remap) | **Lossy:** deletes document-category rows; remaps categories | DELETE/UPDATE (not idempotent in general) | 001, 08 |
| 7 | 10_add_revisions_column.sql | 7 | documents | revisions JSONB | — | — | — | None | ALTER ADD COLUMN IF NOT EXISTS | 001 |
| 8 | 11_add_stock_items_column.sql | 8 | (none new) | stock-related column | — | — | — | None | ALTER ADD COLUMN IF NOT EXISTS | 001 |
| 9 | 11_modernize_dms.sql | 9 | folders, document_links | folder_id (documents) | FK, UNIQUE | uuid-ossp | Backfill document_links from project_id/site_id/ipc_id | None (IF NOT EXISTS + ON CONFLICT DO NOTHING) | IF NOT EXISTS + ON CONFLICT | 001, 07 |
| 10 | 12_backfill_document_revisions.sql | 10 | document_revisions | — | — | — | Backfill revisions from documents | None | INSERT (backfill) | 001, 10 |
| 11 | 13_add_project_owner.sql | 11 | projects | owner (projects) | — | — | — | None | ALTER ADD COLUMN | 001 |
| 12 | 14_seed_runtime_stores.sql | 12 | (none new) | — | — | — | Seed counters, units, categories (document-type) | None (ON CONFLICT DO NOTHING) | ON CONFLICT DO NOTHING | 001, 05, 08 |
| 13 | 15_import_json_history.sql | 13 | import_history | — | — | — | — | None | CREATE TABLE IF NOT EXISTS | 001 |
| 14 | 16_ipc_rejected_status.sql | 14 | ipcs | status CHECK (adds 'rejected') | DROP CONSTRAINT + ADD CHECK | — | — | ALTER (constraint replace) | DROP CONSTRAINT IF EXISTS + ADD | 05 |
| 15 | 17_core_uniqueness.sql | 15 | (none new) | — | PK/UNIQUE constraints | — | — | None (idempotent constraint adds) | ADD CONSTRAINT IF NOT EXISTS | 001 |
| 16 | 18_modernize_dms.sql | 16 | folders, document_links (duplicate of #9) | folder_id (documents) | FK, UNIQUE | uuid-ossp | Backfill document_links (duplicate) | None (IF NOT EXISTS + ON CONFLICT) | IF NOT EXISTS + ON CONFLICT (byte-identical to #9) | 001, 07 |
| 17 | 19_authz_rebuild.sql | 17 | (none new) | permissions arrays, role_name FK | FK (users→roles) | — | Rebuild authorization (roles, permissions, overrides, project_members); revoke all sessions (`UPDATE sessions SET revoked_at = NOW() WHERE revoked_at IS NULL`) | **Lossy-ish:** session revocation (all sessions invalidated); role/permission matrix replacement | Mixed (DDL idempotent; UPDATE sessions is stateful) | 001, 17 |
| 18 | 20_authz_backfill.sql | 18 | (none new) | — | — | — | Backfill authorization data | — | — | 19 |
| 19 | 21_direct_amounts.sql | 19 | ipcs | net_amount, gross_amount (direct amounts) | — | — | — | None | ALTER ADD COLUMN | 05, 16 |

### Impact of migrations 19–21 on the schema originally created by 001

- Migration 001 created the baseline schema (`users`, `roles`, `sessions`, `projects`, `documents`, etc.) with FK `users.role_name → roles(name)` (added in migration 19) and permission columns.
- Migration 19 (`19_authz_rebuild.sql`): adds the FK `users.role_name → roles(name)` (if not present), rebuilds the role/permission matrix, creates `user_permission_overrides` and `project_members` constraints, and **revokes all existing sessions** (`UPDATE sessions SET revoked_at = NOW() WHERE revoked_at IS NULL`). This is the authorization rebuild; it invalidates all active sessions (one re-login per user).
- Migration 20 (`20_authz_backfill.sql`): backfills authorization data (role/permission/overrides) to match the rebuilt matrix.
- Migration 21 (`21_direct_amounts.sql`): adds `net_amount` and `gross_amount` columns to `ipcs` (direct amounts, bypassing BOQ-derived calculation).
- **Production applied set (19–21): Unknown** — cannot be confirmed without authorized production evidence. The test database applied all 19 including 19–21 successfully.

### Destructive / potentially lossy operations identified
- `09_fix_document_categories.sql`: `DELETE FROM categories WHERE group = 'document-category'` (removes English document-category rows); `UPDATE documents SET category` (remaps categories to Arabic canonical set). Lossy if rollback needed.
- `19_authz_rebuild.sql`: `UPDATE sessions SET revoked_at = NOW() WHERE revoked_at IS NULL` (invalidates all sessions); role/permission matrix replacement. Stateful, not idempotent in the sense that re-running would re-revoke (but already revoked rows are skipped by `WHERE revoked_at IS NULL`).

---

## 5. PostgreSQL 17/18 Comparison (Workstream D) — BLOCKED

No isolated PostgreSQL 18 environment is available (see Workstream A). Therefore the PG 17/18 comparison was **not performed**.

- **PG 17 result:** all 19 migrations applied successfully (exit 0); 27 tables, 3 extensions, 14 CHECK, 29 FK, 89 PK, 63 UNIQUE, 69 indexes.
- **PG 18 result:** not available (isolated PG 18 cluster crashed with `0xC0000142` on worker init; no connection succeeded).
- **Compatibility assessment (static only):** migrations use standard SQL + contrib extensions (`uuid-ossp`, `pg_trgm`) available in both PG 17 and 18; no PG 18-specific features observed. This is a static observation, not proof of identical runtime behavior.
- **Do not claim compatibility** solely because the migration SQL appears to use standard SQL. A repeat dry run on PG 18 in an isolated environment is required before production migration readiness can be assessed.

---

## 6. Failures and Unresolved Risks

- **No migration failures.** All 19 applied; exit 0 (both empty and populated test DBs).
- **Unresolved risks:**
  - Duplicate migration idempotency not proven with broader populated data (only 1 project + 1 site + 1 document tested).
  - Target schema nullability/constraints may differ from `001_initial_schema.sql` due to migrations 19–21 (verified in isolated DB; production applied set Unknown).
  - PG 17 vs PG 18 compatibility not verified (isolated PG 18 unavailable).
  - Users not seeded by SQL migrations (app-startup seeding); production data seeding path not exercised.
  - No production data → data-level validation (counts, checksums, field-level correctness) not performed.
  - Environment-level DLL initialization failure (`0xC0000142`) root cause: likely but unconfirmed.
  - Audit/notification source-to-target field mapping and before/after state sufficiency: Unknown/Proposed.

---

## 7. Cleanup and Recovery Instructions

- **Test databases:** `cos_stage2_dryrun` and `cos_stage2_populated_dryrun` on PG 17:5433 contain test-only schema and synthetic data. Drop when no longer needed (owner via pgAdmin/psql against PG 17 only): `DROP DATABASE cos_stage2_dryrun;` / `DROP DATABASE cos_stage2_populated_dryrun;`
- **Temporary clusters:** PG 17 (`pg-stage2-cluster`) and PG 18 (`pg-stage2-cluster-18`) data dirs in `C:\Users\PC-01\AppData\Local\Temp\opencode\` are stopped and may be removed (commands in Stage 2 report §9). They contain no production data.
- **No production database, application configuration, or Git state was modified.**

---

## 8. Updated Git Status

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
No staging, no commit, no reset. Pre-existing tracked modifications preserved.

---

## 9. Final Gate Decision

**PASS WITH LIMITATIONS** — isolated PostgreSQL 17 populated-data dry run executed successfully (all 19 migrations applied, exit 0; schema validated; runner idempotency confirmed; duplicate pair idempotent with populated data — 2 document_links created on first run, 0 on re-run; FK integrity verified). Not production-ready.

- Typecheck gate: **PASSED** (exit 0).
- D4 repair: **COMPLETE** (18 files, 21 blocks, 0 markers).
- Stage 2 dry run: **EXECUTED** (isolated PG 17:5433, `cos_stage2_dryrun` + `cos_stage2_populated_dryrun`) — all 19 migrations applied, exit 0.
- Limitations: duplicate idempotency verified with limited populated data (1 project/site/document); PG 17 vs PG 18 compatibility not verified; no production data validation; users not seeded by SQL migrations; environment-level DLL failure (`0xC0000142`) unresolved.
- Stage 3, Phase 13, D6 production data migration, D7 adapter implementation: **not started**.

A successful isolated dry run is not proof of production migration readiness. Production facts remain Unknown. The next step requires owner review of this report. Do not claim production readiness based on this test.