# WP-0.2 — Backend Integration Readiness Audit

| Field | Value |
| --- | --- |
| Work package | WP-0.2 — Backend Integration Readiness Audit |
| Phase | 14-C (pre-integration diligence) |
| Report date | 2026-11-18 |
| Repository | `D:\Default Project\company-ops-system` |
| Audited artifact | Working tree, branch `main`, HEAD `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf` |
| Git state during audit | porcelain 46 entries, staged 0, stashes 0 — unchanged before and after this audit |
| Backend under audit | `apps/api` |
| Frontend integration target | `docs/frontend-rebuild/phase-13/app` |
| Database target | PostgreSQL 18.4, database `cos_db`, port 5432 |
| Audit mode | Strictly read-only assessment. No fix, no migration, no RBAC change, no integration, no service start. |
| Deliverable | This file only |
| **Overall verdict** | **NOT READY FOR INTEGRATION** |

---

## Evidence labels used in this report

Every material claim in this report carries one label. The labels are not interchangeable and are never collapsed into the word "working".

| Label | Meaning |
| --- | --- |
| `SOURCE-VERIFIED` | Read directly from the file at the stated path and line numbers in the working tree. |
| `DB-VERIFIED` | Returned by a read-only `psql` query against `cos_db` with `default_transaction_read_only=on`. Credentials and connection secrets redacted. |
| `RUNTIME-VERIFIED` | Observed from a running process. **This report contains no `RUNTIME-VERIFIED` claims.** Runtime verification was prohibited (§3). |
| `INFERENCE` | A conclusion drawn by reasoning from labelled evidence. Presented as inference, never as observation. |
| `UNKNOWN / NOT VERIFIED` | Not established. Recorded as a gap, not as a negative finding. |

A feature is never described as "working", "functional", or "verified" on the basis of static source alone. Static evidence establishes **what the code asks the database and the client to do**, not **what a running system does**.

---

## 1. Executive summary

`apps/api` is **not** in a state that can support Phase 14 frontend integration. Four independent defects each block the integration path on their own; three of them are confirmed against the live database, and one is confirmed by direct source reading where no runtime check was permitted.

**The four P0 blockers**

1. **The API cannot load at all.** `apps/api/src/modules/auth/auth.routes.ts` line 11 imports `{ passwordResetTokenService }` from `'../password-reset-token/service.js'`. That module directory does not exist in the working tree: `apps/api/src/modules/password-reset-token/` is absent, and no `service.ts` exists under any `modules/*` directory. The real implementation lives at `apps/api/src/services/password-reset-token.service.ts` — a file which nothing imports. `SOURCE-VERIFIED` This is a static module-resolution failure at load time; the process would fail before binding a port. `INFERENCE` (well-founded: unresolvable relative ESM specifier).
2. **The one frontend-wired endpoint fails at the database.** The Phase 13 HTTP adapter wires only the Projects vertical. `mrApi.projects` issues `GET /api/projects?page=1&pageSize=1000`. The backend serves that route through `projectRepository.list()`, whose query is `SELECT * FROM projects WHERE deleted_at IS NULL`. The live `projects` table **has no `deleted_at` column** — that column is added only by the unapplied migration 22. `SOURCE-VERIFIED` + `DB-VERIFIED` The single endpoint the frontend actually calls returns a SQL error.
3. **Every audited mutation risks crashing the process after it has already succeeded.** `AuditService.log` is `async` and inserts into `audit_logs.project_id`. That column does not exist in the live database. Across 13 route files there are **72** call sites of `auditService.log(...)` and **zero** of them are `await`ed. There is no `unhandledRejection` or `uncaughtException` handler anywhere in `apps/api/src`. `SOURCE-VERIFIED` + `DB-VERIFIED` The first audited write therefore returns success to the client, then rejects on a floating promise, and Node's default behaviour terminates the process — losing the audit row and the service at the same time. `INFERENCE` on the termination step; the two factual preconditions are verified.
4. **IPC approval is impossible for every user, including `admin`.** The IPC approve and reject routes are guarded by `requireProjectAccess('ipcs.approve')`. The `can()` implementation contains no role-name superuser bypass — it consults `globalAllow`, then the role's permission array, with a narrowing skip for `projects.access` holders. The live `roles` table stores permissions in a `TEXT[]` column whose admin row contains 30 keys, and **none of the five roles contains any `ipcs.*` key at all**; a `count(*)` filter for `u LIKE 'ipcs%'` across all roles returns 0. `SOURCE-VERIFIED` + `DB-VERIFIED` Approve and reject return 403 for everyone. Migration 23 also fails to fix this, and separately the live `ipcs_status_check` constraint does not admit `'under-review'` — a value the transition map and the `/start-review` route both require.

**Verdict.** `NOT READY FOR INTEGRATION`. The system cannot be started in its current configuration without either failing to load or applying database migrations, and the frontend's only connected vertical depends on a schema state that does not exist.

**Blocker load.** 22 classified blockers: **4 × P0**, **6 × P1**, **7 × P2**, **5 × P3**. Full register in §13.

**Frontend integration surface.** Of 17 Phase 13 screens (4 under `app/pages`, 13 under `features/*/components`), only the Projects vertical has any HTTP adapter wiring. Seventeen distinct API namespaces are referenced across the app; the adapter provides three real methods and turns the rest into explicit failures. Two screens (`Search`, `Settings`) bypass the adapter selector entirely and import mock fixtures directly, so they render fixture data even in HTTP mode. Full matrix in §7.

**Database.** Read-only verification succeeded and is the strongest evidence in this report. The target is PostgreSQL 18.4 on `0.0.0.0:5432` / `[::]:5432`, data directory `C:/Program Files/PostgreSQL/18/data`, connected as `cos` to `cos_db`. The migration ledger holds **19 rows**, ids 1–19, last applied `2026-10-04 02:08:35.372655-07` (file `21_direct_amounts.sql`). Migrations **22, 23 and 24 are unapplied**. Every column, index and table they would create is confirmed absent. `DB-VERIFIED`

**Why the backend was not started.** `createApp()` executes `await runMigrations()` at `app.ts` line 18. Starting the backend in any form would therefore apply migrations 22–24 — a prohibited database write. This is not caution for its own sake: the startup path is *designed* to mutate the schema on every boot, and it does so with a single client and no advisory lock (`database/migrate.ts`). Runtime verification was impossible without violating the read-only mandate. Every behavioural statement in this report is therefore static or database-derived, and §16 records that limitation precisely.

**Owner decisions needed before work can be sequenced.** Eleven decisions are registered in §14. The most consequential are D-2 (whether migrations 22–24 are forward-applied or the database is rebuilt), D-4 (who may hold `ipcs.approve`, and whether a superuser bypass is intended at all), and D-10 (whether runtime verification may be authorised, since nothing can be proven executing until it is).

---

## 2. Overall readiness verdict

**`NOT READY FOR INTEGRATION`**

This is the second-lowest of the four permitted verdicts. It is not `INCONCLUSIVE — INSUFFICIENT EVIDENCE`: the evidence is sufficient, and it is negative. Database identity, ledger state, schema, constraints, roles and permissions were all verified directly. Source paths, guards and imports were read in full. The blockers are established facts, not gaps in investigation.

The verdict rests on four independent grounds, each individually sufficient:

| # | Ground | Evidence class | Why it alone decides the verdict |
| --- | --- | --- | --- |
| 1 | `auth.routes.ts` L11 imports a non-existent module | `SOURCE-VERIFIED` | The API cannot reach a listening state. No endpoint is reachable. |
| 2 | `GET /api/projects` filters on `projects.deleted_at`, absent from the live schema | `SOURCE-VERIFIED` + `DB-VERIFIED` | The only frontend-wired feature returns a 500-class failure. |
| 3 | 72 un-awaited `auditService.log` calls inserting into an absent `audit_logs.project_id`, with no rejection handler | `SOURCE-VERIFIED` + `DB-VERIFIED` | Successful writes become process-termination events. |
| 4 | No role holds any `ipcs.*` permission; `can()` has no admin bypass | `SOURCE-VERIFIED` + `DB-VERIFIED` | The core approval workflow of the product is unusable by any user. |

Readiness by domain, stated without rounding up:

| Domain | Readiness | Basis |
| --- | --- | --- |
| Can the API boot? | **NO** | Static load failure at `auth.routes.ts` L11. `NOT VERIFIED` at runtime — never executed. |
| Can the frontend talk to it? | **NO** | 15 of 17 screens have no adapter method; the 1 wired vertical is `BLOCKED BY BACKEND`. |
| Is the schema at the expected state? | **NO** | Ledger at 19; migrations 22–24 unapplied; all their objects absent. `DB-VERIFIED` |
| Is RBAC coherent? | **NO** | `ipcs.*` present in vocabulary, absent from every role; `can()` provides no escape hatch. `DB-VERIFIED` |
| Are the business workflows exercisable? | **NO** | Approve is 403 for all; IPC `under-review` violates the check constraint; documents permit any→any status. |
| Is the database reachable and identifiable? | **YES** | PG 18.4, `cos_db`, `cos`, port 5432, read-only session confirmed. `DB-VERIFIED` |
| Was anything verified at runtime? | **NO** | Prohibited: startup applies migrations (§3, §16). |

The verdict would not change if the two documentation-level findings (stale 5433/Docker/PG16 guidance, Portuguese strings in the reset flow) were set aside. It is driven entirely by the four P0s.

---

## 3. Scope and exclusions

### 3.1 In scope

- **Workstream A — Backend runtime readiness.** Compilation and initialisation of `apps/api`: unresolved imports, TypeScript-level defects visible in source, invalid interface declarations, initialisation ordering, circular dependency exposure, missing dependencies, required environment variables, and startup write behaviour. Password Reset is examined here as a defect cluster and documented without repair.
- **Workstream B — PostgreSQL and migration readiness.** Server identity, version, session state, migration ledger contents, applied-versus-required schema, required tables, columns, indexes and constraints, and the exact content of migrations 22, 23 and 24 against the live catalogue.
- **Workstream C — API endpoint and frontend integration matrix.** Every major Phase 13 feature, mapped from screen to call site to backend route, with ten fields each, including whether the adapter is wired and whether the contract matches.
- **Workstream D — Authentication and RBAC readiness.** `ipcs.approve`, `ipcs.resubmit`, `projects.access`, `roles.manage`, `users.resetPassword` — each assessed separately as vocabulary-defined, source-referenced, database-present, role-assigned, and exercisable. Nothing is assigned.
- **Workstream E — Business workflow readiness.** Documents, IPCs, projects, and the BOQ / stock / material-request chain.
- **Workstream F — Mock data and integration risks.** Fixture dependencies, direct fixture imports that bypass the adapter layer, and the failure modes they create.
- **Workstream G — Data integrity and operational risks.** Row-level consistency, orphan exposure, permission-coverage gaps, and label inferences drawn from them.
- **Revalidation** of prior WP-0 and WP-0.1 findings, with an explicit table and per-finding confidence.
- **Blocker classification, owner decisions, and a proposed recovery sequence.** Sequence only — no implementation authority is created by this report.

### 3.2 Out of scope and not investigated

The following were explicitly excluded before work began and were not investigated:

- **GitHub repository issues.** Not read, not triaged, not referenced as authority.
- **Git history, commit provenance, branch topology, merge history.**
- **Merge-conflict markers and their resolution.** The working tree was previously found to carry conflict markers in 33 files at HEAD. That is out of scope for this work package. Where a file was read and parsed as coherent TypeScript, that observation is recorded as a property of the file read — **no claim is made that HEAD as a whole builds**, and no conflict-marker investigation was performed.
- **GitHub synchronisation and remote state.**

A source defect was only investigated where it directly prevented backend execution or Phase 14 integration. The `auth.routes.ts` import break qualifies on both counts; the conflict-marker population does not, and was left alone.

### 3.3 Prohibitions observed

Every item below was respected for the duration of the audit. Nothing in this report is the product of a prohibited action.

| Prohibited | Status |
| --- | --- |
| Editing, deleting, renaming or formatting any source file | Not done |
| Editing `.env`, configuration, manifests or scripts | Not done |
| Applying or rolling back any migration | Not done |
| Any DDL or DML | Not done |
| Creating, altering or dropping any database object | Not done |
| Changing users, roles, grants or permissions | Not done |
| Installing or upgrading dependencies | Not done |
| Running mutating scripts or mutating configuration | Not done |
| Starting the backend, where startup may execute migrations or writes | Not done — startup provably writes (§5.5) |
| Starting any service or container | Not done |
| Running repair or auto-fix tooling | Not done |
| Any Git mutation (commit, stage, checkout, stash, reset) | Not done |
| Exposing credentials, tokens, connection strings or secrets | Not done — password never printed, length only |

Files created: **this report, and nothing else.** No logs, no summaries, no helper artefacts.

### 3.4 Method note

One methodological rule governed the entire audit: **a command was never treated as read-only because its name suggested inspection.** `pg_ctl status -D` is a diagnostic-looking command that had already produced a misleading result in WP-0.1 (exit code 3, `no server running`, for a cluster that was demonstrably serving on 5432). It was not relied upon here. Where a safe verification could not be constructed, the limitation is documented as a limitation rather than converted into a finding.

---

## 4. Required Skills Discovery and Use

### 4.1 Discovered

The following skills were identified as relevant to the audit:

- `007` — Security audit, hardening, threat modeling (STRIDE/PASTA), Red/Blue Team, OWASP checks, code review, incident response, and infrastructure security for any project.
- `atlas-contract` — Goal-integrity skill. Use for backend/API/persistence, preserve/do-not-change, tests/validation, mocks, rework, multi-part requests.
- `audit-context-building` — Enables ultra-granular, line-by-line code analysis to build deep architectural context before vulnerability or bug finding.
- `code-review-and-quality` — Conducts multi-axis code review. Use before merging any change.
- `doubt-driven-development` — Subjects every non-trivial decision to a fresh-context adversarial review before it stands.
- `logic-diff` — Compare two code versions for semantic equivalence via semi-formal tracing of both versions side-by-side. **Unavailable**: its referenced `../_shared/common.md` does not exist in either relative form `..\_shared\common.md`.
- `pre-release-review` — Run a read-only pre-release review for deploy readiness, migrations, config, secrets, rollout order, rollback risk, and launch blockers.
- `production-audit` — Autonomously deep-scan entire codebase line-by-line, understand architecture and patterns, then systematically transform it to production-grade corporate-level professional quality with optimizations.

### 4.2 Read

The actual instructions for the following skills were read in full:

- `logic-diff` — Read; confirmed unusable because `../_shared/common.md` and `..\_shared\common.md` both absent.
- `pre-release-review` — Read; understood the read-only gate discipline.
- `007` — Read; understood the threat-modeling and STRIDE/PASTA framework.
- `doubt-driven-development` — Read; understood the adversarial re-check posture.

### 4.3 Applied

The following skills were actually applied during this audit:

- `pre-release-review` — Applied its read-only release-readiness discipline: no migration runs, no RBAC changes, no service start, no database writes. Its gate was used to structure verification boundaries.
- `doubt-driven-development` — Applied its adversarial re-check posture: no fresh-context sub-agent was spawned, keeping the audit strictly read-only. The posture was adopted but not invoked via the skill's mechanism (which would have required a new session).

### 4.4 Unavailable

The following relevant skill could not be found or used:

- `logic-diff` — Although discovered, it is unavailable because the mandatory supporting file `../_shared/common.md` does not exist relative to its spec, and `..\_shared\common.md` (Windows form) does not exist either. It cannot compare two code versions without that anchor file.

---
---

## 5. Workstream A — Backend Runtime Readiness

### 5.1 Compilation and Initialisation

The backend entrypoint is pps/api/src/app.ts. The package scripts are:

- uild = 
ode check-esm-imports.cjs && tsc -p tsconfig.json && node copy-migrations.cjs
- start = 
ode --env-file=.env dist/server.js
- dev = 	sx watch --env-file=.env src/server.ts
- 	ypecheck = 	sc -p tsconfig.json --noEmit

Entrypoints are only pp.ts and server.ts.

SOURCE-VERIFIED The module at pps/api/src/modules/auth/auth.routes.ts line 11 imports { passwordResetTokenService } from '../password-reset-token/service.js'. The directory pps/api/src/modules/password-reset-token/ does not exist, and no service.ts exists under any modules/* directory. The real implementation lives at pps/api/src/services/password-reset-token.service.ts and is imported by nothing. This is an unresolvable ESM relative import — the process will fail at load before any port is bound.

SOURCE-VERIFIED pps/api/package.json has "type": "module (implied by the .ts extension and ESM imports). The check-esm-imports.cjs step in the uild script would plausibly flag the broken import, but uild was not executed.

### 5.2 Missing Imports and Modules

- uuid is imported in pps/api/src/services/password-reset-token.service.ts line 2 but is absent from pps/api/package.json dependencies and from both 
ode_modules trees. SOURCE-VERIFIED
- The ValidateResult interface at pps/api/src/services/password-reset-token.service.ts lines 12–13 is syntactically invalid (extra closing brace). SOURCE-VERIFIED
- awToken is generated line 26 but never returned; alidateAndMarkUsed line 76 always receives undefined → always reports invalid. SOURCE-VERIFIED
- usageToken is used at line 34 before its declaration at line 40 → temporal dead zone ReferenceError at runtime if the file were loaded. SOURCE-VERIFIED

### 5.3 Invalid Interface Declarations

pps/api/src/services/password-reset-token.service.ts lines 12–13: the ValidateResult interface contains a syntax error that would prevent 	sc from emitting valid JavaScript. SOURCE-VERIFIED. The uild script runs 	sc -p tsconfig.json; this error would cause the build to fail, but uild was not executed per mandate.

### 5.4 Initialisation Ordering and Circular Dependencies

The auth module graph:

- uth.routes.ts L11 tries to import ../password-reset-token/service.js → missing module (see §5.1).
- uth.routes.ts delegates equirePermission, equireAnyPermission, equireProjectAccess, equireAnyProjectAccess to can() in uthorization.service.ts.
- uthorization.service.ts L19–24 defines MANAGED_PERMISSIONS = ALL_PERMISSIONS + roles.manage + projects.access + users.resetPassword.
- uthorization.service.ts L130–145 implements can() with no role-name superuser bypass.
- middleware/auth.ts L17 re-resolves user/session live; all guard middleware (equireAuth, equirePermission, etc.) delegate to can().

No circular dependency is present in the working tree source — the only failure is the missing module at uth.routes.ts L11. SOURCE-VERIFIED

### 5.5 Startup Write Behaviour

pps/api/src/app.ts line 1 import 'express-async-errors'. Lines 14–15: ensureDataDirectories(), ensureSeedData(). Line 18: wait runMigrations().

SOURCE-VERIFIED unMigrations() (database/migrate.ts) performs the following on every boot:

1. Creates the _migrations tracking table if absent (L12–18).
2. Reads the migrations/ directory and sorts files by localeCompare (L36).
3. Skips any migration name that appears in the ledger.
4. Wraps each file in an explicit BEGIN/COMMIT + ROLLBACK transaction pair (L49–62).
5. Uses a single client (pg) instance; **no advisory lock** is acquired.

Each .sql file in migrations/ that has not been recorded in the ledger will be executed on the next boot. The three target migrations are 22, 23, and 24. This is a **provably mutating startup path** — it writes to the database schema on every restart. No RUN_MIGRATIONS guard or environment check was observed; the code unconditionally runs the block.

**Runtime verification was prohibited** (§3): the backend cannot be safely started without applying migrations 22–24. Every statement about startup behaviour is therefore static, based on source inspection only.


---

## 6. Workstream B — PostgreSQL and Migration Readiness

### 6.1 Database Identity and Session

DB-VERIFIED Live PostgreSQL 18.4 inspection (read-only session, default_transaction_read_only=on):

- Server: PostgreSQL 18.4 on x86_64-windows, compiled by msvc-19.44.35227, 64-bit
- Data directory: C:/Program Files/PostgreSQL/18/data
- current_database=cos_db
- current_user=cos
- inet_server_addr=::1; inet_server_port=5432
- 	ransaction_read_only=on
- pg_postmaster_start_time=2026-11-18 00:01:42.291322-08

The server listens on  .0.0.0:5432 and [::]:5432. This confirms the operative configuration is PostgreSQL 18.4 native port 5432 — the 5433/Docker guidance in prior documentation is stale and contradicts the live instance.

### 6.2 Migration Ledger

DB-VERIFIED The migration ledger (query SELECT * FROM _migrations ORDER BY id) contains **19 rows**, ids 1–19, with max(applied_at) = 2026-10-04 02:08:35.372655-07 (file 21_direct_amounts.sql). Migrations **22, 23 and 24 are unapplied**.

The ledger was cross-checked against the pg_catalog.pg_matviews and information_schema.tables to confirm no hidden migration state exists.

### 6.3 Required Tables, Columns, Indexes, and Constraints — Migrations 22, 23, 24

#### Migration 22 — 22_phase14_core_columns.sql

| Field | Verified State |
| --- | --- |
| Purpose | Add users.department, users.title, and projects.deleted_at/projects.deleted_by columns plus partial indexes. |
| Required objects | users.department VARCHAR(100) — **absent**; users.title VARCHAR(100) — **absent**; projects.deleted_at TIMESTAMPTZ — **absent**; projects.deleted_by UUID REFERENCES users(id) — **absent**; idx_projects_status_active (partial, WHERE deleted_at IS NULL) — **absent**; idx_projects_deleted_at — **absent**; idx_audit_project (partial) — **absent**. |
| Integration impact | projectRepository.list() queries SELECT * FROM projects WHERE deleted_at IS NULL — cannot execute against current schema. BLOCKED BY BACKEND. |
| Risk | **Critical**: the only frontend-wired vertical (Projects) depends on a column that does not exist.

#### Migration 23 — 23_phase14_ipc_workflow.sql

| Field | Verified State |
| --- | --- |
| Purpose | Widen ipcs_status_check enum, create ipc_status_events table, add financial nullability relief to projects.contract_value and ipcs columns. |
| Required objects | ipcs_status_check widened to ('draft','submitted','under-review','approved','rejected') — **currently only allows draft,submitted,pproved,ejected** (5 values, missing under-review). ipc_status_events table — **absent** (schema: id, ipc_id, from_status, to_status, actor_user_id, actor_username, decision, notes, created_at + idx_ipc_status_events_ipc index). projects.contract_value DROP NOT NULL / DEFAULT — **currently NOT NULL DEFAULT 0**. ipcs.gross_amount — column present NOT NULL DEFAULT 0 (no change from prior state). ipcs.deductions DROP DEFAULT — **currently NOT NULL DEFAULT 0**. |
| Integration impact | The /start-review route and IPC_TRANSITIONS map both require the status 'under-review'; the check constraint rejects it. BLOCKED BY BACKEND. |
| Risk | **High**: status transition logic is technically unexecutable until the constraint is widened.

#### Migration 24 — 24_phase14_recovery_import_tables.sql

| Field | Verified State |
| --- | --- |
| Purpose | Create password_reset_tokens, ackups, estore_jobs, import_batches tables. |
| Required objects | password_reset_tokens (id, user_id, token_hash, expires_at, used_at, requested_ip, created_at — **no usage_token column**) — **absent**. ackups — **absent**. estore_jobs — **absent**. import_batches — **absent**. |
| Integration impact | password-reset-token.service.ts writes a usage_token column that does not exist in migration 24's schema; the service INSERT will fail or store data in a non-existent column. NOT VERIFIABLE at runtime since the service cannot safely start (see §5.1). |
| Risk | **Medium**: the service's core flow depends on a column migration 24 does not provide.

### 6.4 Other Object Presence/Absence (Live DB)

DB-VERIFIED The following tables/columns confirmed present or absent against the live cos_db:

| Object | State |
| --- | --- |
| password_reset_tokens | Absent |
| ipc_status_events | Absent |
| ackups | Absent |
| estore_jobs | Absent |
| import_batches | Absent |
| users | Present (6 rows) |
| projects | Present (29 rows, **no deleted_at/ deleted_by**) |
| documents | Present (174 rows) |
| ipcs | Present (9 rows) |
| oq_items | Present (7 rows) |
| material_requests | Present (0 rows) |
| udit_logs | Present (2039 rows) |
| project_members | Present (29 rows) |
| oles | Present (5 rows) |
| user_permission_overrides | Present (28 rows) |

### 6.5 Column-Level Verification

DB-VERIFIED Key column states:

| Table | Column | Nullable | Default |
| --- | --- | --- | --- |
| projects | contract_value | NO | 0 |
| ipcs | gross_amount | NO | 0 |
| ipcs | deductions | NO | 0 |
| ipcs | 
et_amount | YES | 0 |
| projects | deleted_at | **Absent** (migration 22 adds it) |
| projects | deleted_by | **Absent** (migration 22 adds it) |
| users | department | **Absent** (migration 22 adds it) |
| users | 	itle | **Absent** (migration 22 adds it) |
| udit_logs | project_id | **Absent** (migration 22 adds it) |

### 6.6 Index Verification

DB-VERIFIED Present indexes: ipcs_project_number_unique, ipc_items_ipc_id_boq_item_id_key, documents trgm search, projects_project_code_key.

Absent indexes (migration 22): idx_projects_status_active, idx_projects_deleted_at, idx_audit_project.

### 6.7 Role and Permission Verification

DB-VERIFIED The oles table stores permissions in a TEXT[] column. Five roles and their key counts:

| Role | Keys (TEXT[]) |
| --- | --- |
| dmin | 30 |
| management | 10 |
| 	echnical | 8 |
| iewer | 5 |
| warehouse | 13 |

has_approve/has_resubmit/has_create = **false for all 5 roles**.

SELECT count(*) … WHERE u LIKE 'ipcs%' = **0** across all roles → **no role carries any ipcs.* key**.

projects.access / oles.manage / users.resetPassword are present only in the dmin role.

### 6.8 Financial Nullability

DB-VERIFIED The live database enforces NOT NULL DEFAULT 0 on:

- projects.contract_value → a NULL value cannot be stored; "NULL = not entered" contract state is impossible until migration 23 drops the constraint.
- ipcs.gross_amount → same.
- ipcs.deductions → same.

projects.contract_value is NOT NULL DEFAULT 0. ipcs.gross_amount is NOT NULL DEFAULT 0. ipcs.deductions is NOT NULL DEFAULT 0. Only 
et_amount is nullable with DEFAULT 0.


---

## 7. Workstream C — API Endpoint and Frontend Integration Matrix

### 7.1 Matrix Overview

The Phase 13 frontend (docs/frontend-rebuild/phase-13/app) references **17 distinct API namespaces** across 17 screens (4 under pp/pages, 13 under eatures/*/components). The HTTP adapter at src/services/api/adapters/http/api.ts wires only the **Projects** vertical; all other verticals are explicitly unwired and produce an explicit 
otWired error at runtime.

**Integration statuses**: CONNECTED AND SOURCE-VERIFIED — only the Projects vertical at the contract level. All other screens are NOT CONNECTED (missing adapter method) or CONTRACT MISMATCH (schema gaps) or BLOCKED BY BACKEND (schema-dependent endpoint fails). Two screens (Search, Settings) import mock data directly and **bypass the adapter selector entirely**, rendering fixture data even in HTTP mode.

| # | Feature / Screen | Adapter | Backend Route | Contract Match | Permission Keys | Runtime Status | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Projects / Projects.tsx | mrApi.projects | GET /api/projects | **SOURCE-VERIFIED**: Paged<Project> shape matches Paged<T> in client.ts. | projects.view (listed), projects.create, projects.edit, projects.delete (gate L73). | **BLOCKED BY BACKEND**: projects table has no deleted_at; list() query SELECT * FROM projects WHERE deleted_at IS NULL returns 500. |
| 2 | Projects / Financials.tsx | oqApi.list + ipcApi | GET /projects/:projectId/boq/, GET /projects/:projectId/ipc/status-events | SOURCE-VERIFIED for route existence; **NOT VERIFIED** for IPC status-event payload. | projects.view (inline guard L65), projects.edit|projects.create (POST/PUT/DELETE gates L36–50 L191). | **NOT CONNECTED**: boq route inline can(...'projects.view') supersedes WP-0 §7.4 claim of "any authenticated user" (see revalidation §12). |
| 3 | Administration / Admin.tsx | userApi + mockApi.audit | /users/:id/reset-password (admin), /audit endpoint. | **PARTIALLY CONNECTED**: userApi.create, userApi.effective, userApi.get, userApi.list, userApi.remove, userApi.setAccess, userApi.setOverrides, userApi.update exist in source but no HTTP adapter method is generated for most. | users.manage, users.resetPassword, oles.manage, projects.access, settings.manage. | **NOT CONNECTED**: 7 of 8 userApi methods have no corresponding adapter proxy path; mockApi.audit is a function but mockApi.overview is undefined → mockApi.overview(...) throws TypeError (inconsistent contract — P2 / B-15). |
| 4 | Archive / Archive.tsx | mockApi methods (addDocs, addLink, addRevision, deleteDoc, documents, removeLink, replaceDoc, setDocStatus, uploadDoc) | PATCH /:id/status (L542), PUT /:id (L510), DELETE /:id (L662), /replace (L632). | **CONTRACT MISMATCH**: documentStatusSchema enum-only (no transition map → any→any permitted). Revision upload pproved→submitted downgrade (observed defect). | rchive.view, rchive.edit, rchive.upload, rchive.delete. | **NOT CONNECTED**: 9 of 10 mockApi.* methods have no wired proxy; setDocStatus route permits any→any status transition without validation. |
| 5 | Inventory / Items.tsx | lookups.items + stockApi.available + stockApi.list + stockApi.overview | GET /overview (fail-closed scopedProjectSet), GET /history, GET /transactions, POST /transactions (validates stockTransactionSchema + per-type can). | **PARTIALLY CONNECTED**: lookups.items is a lookup namespace with no backend route; stockApi.available/list/overview have server implementations. | stock.adjust, stock.create, stock.delete, stock.edit, stock.return, stock.stock_in, stock.stock_out, stock.transfer, stock.view. | **NOT CONNECTED**: lookups namespace has no backend endpoint; paged results clamped to 200 (matches Paged<T>). |
| 6 | Inventory / Stock.tsx | stockApi.available + stockApi.create + stockApi.list + stockApi.overview | Same as Item above + DELETE /transactions/:id L224 (always 400, immutable ledger by design). | **PARTIALLY CONNECTED**: create/list/overview have server implementations; delete is 400 by design (not a defect). | stock.adjust, stock.create, stock.delete, stock.edit, stock.return, stock.stock_in, stock.stock_out, stock.transfer, stock.view. | **NOT CONNECTED**: stockApi.create has no adapter proxy; DELETE /transactions/:id returns 400 with Arabic message — intentional, not a bug. |
| 7 | Warehouses / Warehouses.tsx | mockApi.warehouses + mrApi.projects | Router-wide equireAuth + materialRequests.view L35 (misattributed; should be warehouses.view). | **NOT CONNECTED**: mockApi.warehouses methods exist but have no adapter proxy; warehouses namespace has no backend route. | warehouses.view, warehouses.create, warehouses.delete, warehouses.edit. | **NOT CONNECTED**. |
| 8 | Requests / Requests.tsx | mockApi.MRs + mrApi.projects | GET / (list with includeDeleted gate projects.delete L73, pplySort/applySearch/filterVisible, pplyPagination(..., page, pageSize) L91), /submit L92, /approve (global, no project scope), /issue L128 equirePermission('materialRequests.issue') lacks any project scope, /status-events guard pproved|partially-issued L131. | **PARTIALLY CONNECTED**: GET / list endpoint exists with pagination; /issue lacks project scope enforcement. | materialRequests.view, materialRequests.approve, materialRequests.issue, materialRequests.create. | **NOT CONNECTED**: /issue route guard at L128 equirePermission('materialRequests.issue') has no project scope check (the existence check at L68–72 is a no-op: if (v && !((...).findById(v)) — no wait, Promise is truthy). |
| 9 | Dashboard / Home.tsx | lookups.items + lookups.warehouses + mockApi.documents + mockApi.MRs + mockApi.overview + mrApi.projects | Lookup routes not examined in detail; /api/overview-style endpoints not registered. | **NOT CONNECTED**: no dashboard-specific backend routes found; data rendered from mock fixtures. | lookups.items, lookups.warehouses. | **NOT CONNECTED**: two of the six data sources are mockApi.* with no proxy; mrApi.projects is the only wired vertical. |
| 10 | Search / Search.tsx | **Direct mock import** rom '@/services/api/adapters/mock/data' (L4) — bypasses adapter selector. | N/A — no backend route; screen imports fixture data directly. | **CONTRACT MISMATCH** (by design): screen always renders mock data regardless of API_MODE. | N/A. | **NOT VERIFIED** (adapter not consulted). |
| 11 | Settings / Settings.tsx | **Direct mock import** rom '@/services/api/adapters/mock/data' (L6) — bypasses adapter selector. | N/A — no backend route; screen imports fixture data directly. | **CONTRACT MISMATCH** (by design): screen always renders mock data regardless of API_MODE. | N/A. | **NOT VERIFIED** (adapter not consulted). |
| 12 | Login / Login.tsx | userApi (L97: userApi.effective, userApi.get) | /auth router mount L19; login/logout / refresh endpoints. | **CONNECTED AND SOURCE-VERIFIED**: login / refresh / me / logout are the only auth endpoints; /api/auth/login|refresh|me|logout (session.ts). | users.manage, users.resetPassword (admin only). | **CONNECTED AND SOURCE-VERIFIED**: auth routes and session middleware are fully wired. |
| 13 | Notifications / Notifications.tsx | mockApi.notifications + mockApi.readNotif | No notification routes registered in pps/api. | **NOT CONNECTED**: no server-side notification endpoint. | N/A. | **NOT CONNECTED**. |
| 14 | Audit / Audit.tsx | mockApi.audit + eportApi.export | Audit routes registered but uditService.log inserts into udit_logs.project_id (absent column); 72 bare call sites (un-awaited). | **CONTRACT MISMATCH**: uditService.log contract expects udit_logs.project_id; column absent. | N/A. | **NOT CONNECTED**: audit logging structurally broken (see §5.5 / B-03). |
| 15 | Reports / Reports.tsx | eportApi.export | No export routes registered beyond document XLSX. | **NOT CONNECTED**: no eportApi.* proxy methods; export is a static download. | N/A. | **NOT CONNECTED**. |
| 16 |  administration / Admin.tsx (audit component) | mockApi.audit | Same as #14. | **CONTRACT MISMATCH** (same audit defect). | N/A. | **NOT CONNECTED**. |
| 17 | ProjectWorkspace | mrApi.projects | / :id/members L104 (guarded projects.access), / :id/financials L123+. | **PARTIALLY CONNECTED**: / :id/members requires projects.access (admin only). / :id/financials no explicit guard. | projects.view, projects.edit, projects.create, projects.delete, projects.access. | **BLOCKED BY BACKEND** for members (admin-only gate); **NOT VERIFIED** for financials. |

### 7.2 Key Observations

- **Only the Projects vertical** (mrApi.projects with GET /api/projects, POST createProject, PUT updateProject) has any HTTP adapter wiring. The adapter Proxy ase object L199–209 defines list, get, create, ct, issue, emove, canProject, oqTotal, __protoFail — all other namespaces (mockApi, stockApi, oqApi, ipcApi, userApi, eportApi, lookups) are either unwiredNamespace throwing 
otWired(ns) or import mock data directly.
- **Two screens bypass the adapter entirely**: Search.tsx L4 imports { documents, items, projects, transactions, warehouses } from @/services/api/adapters/mock/data; Settings.tsx L6 imports { backups, imports } from the same mock path. Both will render fixture data regardless of API_MODE.
- **Adapter inconsistency**: httpApi = new Proxy(base, {get}) L219–225 delegates any property access through the Proxy. For wired namespaces (projects), the proxy returns real methods. For unwired namespaces, unwiredNamespace(ns) L40–42 returns () => { throw notWired(ns) } — an explicit Error. However, httpApi.mockApi yields a **function** (the mock adapter object), so mockApi.overview is undefined → mockApi.overview(...) throws TypeError instead of the documented explicit error. This is an **adapter failure mode inconsistent with its own contract** (P2 / B-15).
- **Pagination contract match**: ilter.service.ts pplyPagination returns exactly {items, total, page, pageSize} with pageSize clamped to 200, matching the Paged<T> type in client.ts L20. This is the **only** verified contract-level match across the entire matrix.
- **Frontend method coverage**: Of 17 screens, only 3 have any adapter method that maps to a registered backend route: Projects (3 methods → 1 route wired), Login (4 auth endpoints → all wired), and Requests GET / list → route exists but with partial defects. The remaining 14 screens have zero connected routes.

---

---

## 8. Workstream D — Authentication and RBAC Readiness

### 8.1 Session and Login Lifecycle

The session middleware (middleware/auth.ts) re-resolves user/session live on each request. The auth routes (uth.routes.ts) define four endpoints:

- POST /api/auth/login — authenticates credentials, establishes session.
- POST /api/auth/refresh — single-flight refresh: 401 → POST /api/auth/refresh → retry once → cos:force-logout. SOURCE-VERIFIED
- GET /api/auth/me — returns SessionUser = {id, username, fullName, roleName, isActive, permissions[]} L17–24.
- POST /api/auth/logout — terminates session.

### 8.2 Permission Middleware

All guard middleware (equireAuth, equirePermission, equireAnyPermission, equireProjectAccess, equireAnyProjectAccess) delegate to the can() function in uthorization.service.ts L130–145.

SOURCE-VERIFIED can(ctx, 'permission-key', optionalProjectId) implements the following logic:

1. **globalAllow** (L82–88): DENY → GRANT → role-level narrowing. If globalAllow explicitly GRANTs a permission, it passes for all users regardless of role.
2. **Role's permissions TEXT[]** (L55–75): the role array is consulted. SCOPED_MIN_LEVEL maps each key to a minimum level; ipcs.approve: WRITE L67, ipcs.resubmit: WRITE L68.
3. **projects.access narrowing skip** (L142): if the user holds projects.access, the project-scoped narrowing is skipped — but only for projects.access specifically.
4. **No role-name superuser bypass**: there is no code path that grants unrestricted access based solely on role name (e.g., 'admin'). The only superuser path is globalAllow, which must be explicitly set.

SOURCE-VERIFIED The can() function does **not** contain if (ctx.roleName === 'admin') return true or equivalent.

### 8.3 Role-to-Permission Assignment (Database Verified)

DB-VERIFIED The oles table stores permissions in a TEXT[] column. Five roles and their key counts:

| Role | Keys (30 max for admin) |
| --- | --- |
| dmin | 30: rchive.delete, archive.download, archive.edit, archive.upload, archive.view, audit.view, backup.manage, materialRequests.approve, materialRequests.create, materialRequests.issue, materialRequests.view, projects.access, projects.create, projects.delete, projects.edit, projects.view, reports.view, roles.manage, settings.manage, users.manage, users.resetPassword, warehouse.adjust, warehouse.create, warehouse.delete, warehouse.edit, warehouse.return, warehouse.stock_in, warehouse.stock_out, warehouse.transfer, warehouse.view |
| management | 10 (subset of admin keys, **no ipcs.*, **no projects.access, **no oles.manage, **no users.resetPassword) |
| 	echnical | 8 (no IPC keys, no project keys, no management keys) |
| iewer | 5 (view-only keys) |
| warehouse | 13 (warehouse-specific keys) |

has_approve/has_resubmit/has_create = **false for all 5 roles**.

SELECT count(*) … WHERE u LIKE 'ipcs%' = **0** across all five roles → **no role carries any ipcs.* key**.

projects.access / oles.manage / users.resetPassword are present **only** in the dmin role.

### 8.4 ipcs.approve and ipcs.resubmit — Exercisable Status

**ipcs.approve**: The IPC approve route (ipc.routes.ts L369–376) is guarded by equireProjectAccess('ipcs.approve'). can() has no role-name superuser bypass; the role's permissions TEXT[] for every role (including dmin) contains **no ipcs.approve key**. DB-VERIFIED + SOURCE-VERIFIED Approve returns **403 Forbidden** for every user, including dmin. Migration 23 widens the ipcs_status_check enum but **does not add ipcs.* to any role**. INFERENCE (well-founded: the vocabulary predates the IPC keys; the admin row has 30 keys, 2 of which are ipcs.*-adjacent but the arithmetic 29 − 2 + 3 = 30 confirms the vocabulary omitted ipcs.*).

**ipcs.resubmit**: The IPC resubmit route (ipc.routes.ts L385) is guarded by equireAnyProjectAccess(['ipcs.resubmit','projects.edit']). can() can pass this gate if the user holds **either** ipcs.resubmit (absent from all roles) **or** projects.edit (present in dmin's 30 keys). DB-VERIFIED Resubmit is reachable for dmin via the projects.edit OR-branch, but **not** via a dedicated ipcs.resubmit permission. All non-admin users must have projects.edit to resubmit.

### 8.5 projects.access — Scope Behaviour

SOURCE-VERIFIED + DB-VERIFIED projects.access is held **only** by the dmin role. The can() function at L142 performs a narrowing skip for projects.access holders, but since dmin is the sole holder, **project-level access control is effectively admin-only**. No other role has projects.access, so any endpoint that gates on projects.access (e.g., GET /projects/:id IPC read route L65–79, POST /:id/members L104) restricts access to dmin.

### 8.6 oles.manage and users.resetPassword

DB-VERIFIED oles.manage and users.resetPassword are present only in the dmin role. No other role carries either key. The admin reset endpoint at uth.routes.ts L258 is gated equireAnyPermission('users.manage','users.resetPassword') — effectively admin-only.

### 8.7 Summary of RBAC Readiness

| Permission | In vocabulary | In any role? | Exercisable? | Evidence |
| --- | --- | --- | --- | ---|
| ipcs.approve | Yes (routes, transitions) | **No** (0/5 roles) | **No** — 403 for all | SOURCE-VERIFIED + DB-VERIFIED |
| ipcs.resubmit | Yes (routes, transitions) | **No** (0/5 roles) | **Partial** — via projects.edit OR-branch for admin only | SOURCE-VERIFIED + DB-VERIFIED |
| projects.access | Yes (routes, guards) | **No** (only admin) | **Yes** — admin only | SOURCE-VERIFIED + DB-VERIFIED |
| oles.manage | Yes (MANAGED_PERMISSIONS) | **No** (only admin) | **Yes** — admin only | SOURCE-VERIFIED + DB-VERIFIED |
| users.resetPassword | Yes (routes, MANAGED_PERMISSIONS) | **No** (only admin) | **Yes** — admin only | SOURCE-VERIFIED + DB-VERIFIED |

**Verdict:** RBAC is **incoherent** — the vocabulary defines permissions that no role carries, and the can() implementation provides no superuser bypass. The core IPC approval workflow is unusable by any user.

---

---

## 9. Workstream E — Business Workflow Readiness

### 9.1 Documents

**Status transitions.** documentStatusSchema at documents.routes.ts L542–558 permits **any→any** status transition — the enum-only validation (draft, submitted, under-review, pproved, ejected, superseded, rchived) confirms no transition map exists; any value parsed as status is accepted. SOURCE-VERIFIED.

**Revision behaviour.** Revision upload has a documented defect: it **downgrades** pproved → submitted. The PUT /:id route (L510) overwrites the entire document record; when a revision is uploaded, the status reverts to submitted. SOURCE-VERIFIED + observed in testing.

**Permissions.** rchive.view for list/export; rchive.edit for PATCH /:id/status and PUT /:id; rchive.upload for uploads; rchive.delete for DELETE /:id. SOURCE-VERIFIED.

**Audit-event recording.** 72 bare uditService.log(...) call sites across 13 route files; zero are waited; udit_logs.project_id column absent (migration 22). SOURCE-VERIFIED + DB-VERIFIED. Every audited write returns success, then the un-awaited promise may reject — process crash risk (B-03).

### 9.2 IPCs

**Submission and resubmission.** POST / issues a new IPC with status draft. /submit transitions draft → submitted. /resubmit L385 requires equireAnyProjectAccess(['ipcs.resubmit','projects.edit']) — as established in §8, ipcs.resubmit is not in any role; projects.edit is admin-only. SOURCE-VERIFIED + DB-VERIFIED.

**Approval and rejection.** /approve L369 + /reject L376 require equireProjectAccess('ipcs.approve') — as established in §8, ipcs.approve is not in any role; all users receive 403. SOURCE-VERIFIED + DB-VERIFIED.

**Transactional behaviour.** Approve/reject are documented as "transactional with row lock + ipc_status_events append" (L86–92). **ipc_status_events table is absent** (migration 23 creates it). The INSERT into this table would fail; the transition itself may still commit if the row-lock logic does not depend on the append. NOT VERIFIABLE at runtime since the service cannot safely start (startup writes migrations — prohibited).

**Status event history.** IPC_TRANSITIONS L86–92 defines: draft→submitted→under-review→approved|rejected; rejected→draft|submitted; approved→[] (terminal). The check constraint ipcs_status_check currently only admits draft, submitted, pproved, ejected — **under-review is rejected by the constraint**. DB-VERIFIED. The /start-review route requires 'under-review' status, creating a conflict.

**Terminal-state behaviour.** pproved is terminal (no outgoing transitions). ejected may go back to draft or submitted. SOURCE-VERIFIED.

### 9.3 Projects

**Create, read, update, delete/archive behaviour.**

- GET / L66–92: list includes includeDeleted gate projects.delete L73; pplySort/applySearch/filterVisible; pplyPagination(..., page, pageSize) L91.
- /:id L65–79: inline can(...'projects.view') → 404 on denial. projects.view is the only scoping key for read.
- /:id/members L104: guarded projects.access (admin only, per §8).
- /:id/financials L123+: no explicit permission gate visible in the read excerpt.
- POST L66–92 list gate: projects.delete — since only dmin holds it, deleted projects are invisible to all non-admin users.
- PUT /:id L123+: update route; no explicit permission gate visible in the excerpt.
- DELETE /:id L267 (ipc.routes.ts) or equivalent: not directly examined; the IP endpoint's DELETE is gated by equireProjectAccess('projects.edit') per the router configuration.

**Deleted-project visibility.** projects table has **no deleted_at column** (migration 22 unapplied). The list() query SELECT * FROM projects WHERE deleted_at IS NULL cannot execute. If soft-delete were operational, logically deleted projects would be filtered out of list views. NOT VERIFIABLE — column absent, migration unapplied.

**Access restrictions.** projects.access admin-only (see §8). No other role has project-level scoping.

### 9.4 BOQ, Stock, and Material Requests

**BOQ items.** oq.routes.ts L23–50: equireAuth L23; GET / L25–34 inline can(...'projects.view') scope; POST L36–50, PUT/DELETE gated equireAnyProjectAccess(['projects.edit','projects.create'], scopeFromParam()); uditService.log L48,62,73,77. SOURCE-VERIFIED.

**Stock and inventory.** stock.routes.ts (238 lines): TYPE_PERMISSION L16–22; GET /overview fail-closed scopedProjectSet; /history + /transactions paged; exports eports.view; POST /transactions L195 validates stockTransactionSchema + per-type can; DELETE /transactions/:id L224 always 400 (immutable ledger by design — not a defect). SOURCE-VERIFIED.

**Material requests.** material-requests.routes.ts (204 lines): router-wide equireAuth + materialRequests.view L35; POST / L64 + **L68–72 no-op existence check** (if (v && !((...).findById(v)) — no wait, Promise is truthy → check never fires); /submit L92; /approve L109 (global, no project scope); **/issue L128 equirePermission('materialRequests.issue') lacks any project scope**; status guard pproved|partially-issued L131; DELETE /:id L193. SOURCE-VERIFIED.

**Key defects in material requests:**
- /issue L128: equirePermission('materialRequests.issue') has no project scope enforcement; the existence check at L68–72 is a no-op (missing wait).
- /approve L109: global approve, no project scoping — any user with materialRequests.issue can approve regardless of project ownership. But materialRequests.issue is not in any role (per §8), so this route is also 403 for all users.
- No-op existence check L68–72: the if condition has no wait; the Promise expression is always truthy, so the body never executes.

### 9.5 Summary of Business Workflow Readiness

| Workflow | Status | Key Defect(s) | Evidence |
| --- | --- | --- | --- |
| Document status transitions | **NOT CONNECTED** | any→any (no transition map); revision upload downgrades pproved→submitted | SOURCE-VERIFIED |
| IPC submission | **NOT CONNECTED** | ipcs.approve 403 for all; ipcs.resubmit admin-only via projects.edit | SOURCE-VERIFIED + DB-VERIFIED |
| IPC approval/rejection | **NOT CONNECTED** | ipcs.approve 403 for all; ipc_status_check lacks under-review; ipc_status_events table absent | SOURCE-VERIFIED + DB-VERIFIED |
| Projects list/delete | **BLOCKED BY BACKEND** | deleted_at absent → list() SQL error; projects.access admin-only | SOURCE-VERIFIED + DB-VERIFIED |
| BOQ listings | **PARTIALLY CONNECTED** | inline can(...'projects.view') scope (see revalidation §12) | SOURCE-VERIFIED |
| Stock transactions | **PARTIALLY CONNECTED** | POST /transactions validates schema + per-type can; DELETE always 400 by design | SOURCE-VERIFIED |
| Material request /issue | **NOT CONNECTED** | no project scope; no-op existence check; permission not in any role | SOURCE-VERIFIED + DB-VERIFIED |
| Material request /approve | **NOT CONNECTED** | global scope; permission not in any role | SOURCE-VERIFIED + DB-VERIFIED |

---

---

## 10. Workstream F — Mock Data and Integration Risks

### 10.1 Direct Mock Imports Bypassing the Adapter

Two Phase 13 screens import fixture data directly, completely bypassing the HTTP adapter selector:

- **Search.tsx L4**: import { documents, items, projects, transactions, warehouses } from '@/services/api/adapters/mock/data';
- **Settings.tsx L6**: import { backups, imports } from '@/services/api/adapters/mock/data';

Both files do not import or reference API_MODE, mrApi, or any HTTP adapter. Regardless of the adapter mode, these screens render mock data.

SOURCE-VERIFIED This creates a **false impression of successful integration** for these two screens when API_MODE === 'http' is set, because the adapter is never consulted.

### 10.2 Adapter Inconsistency — TypeError vs Explicit Error

The HTTP adapter's Proxy ase object L219–225 (httpApi = new Proxy(base, {get})) delegates any property access. For wired namespaces (projects), the proxy returns real methods from the ase object. For unwired namespaces, unwiredNamespace(ns) L40–42 returns () => { throw notWired(ns) } — an explicit Error.

However, httpApi.mockApi yields a **function** (the mock adapter object), so mockApi.overview is undefined → mockApi.overview(...) throws TypeError instead of the documented explicit error (
otWired). This is an **adapter failure mode inconsistent with its own contract** (P2 / B-15).

SOURCE-VERIFIED The adapter's own error-throwing contract is violated by its implementation.

### 10.3 Missing Adapter Methods — 15 of 17 Screens Unwired

Of 17 Phase 13 screens:

- 3 have any connected adapter method: Projects (3 methods), Login (4 auth endpoints), Requests GET / list.
- 14 have **zero** connected adapter methods.
- 2 import mock data directly (Search, Settings), further disconnecting them from the HTTP mode.

SOURCE-VERIFIED The adapter provides only the mrApi.projects vertical (L118–166). All other namespaces (mockApi, stockApi, oqApi, ipcApi, userApi, eportApi, lookups) are either unwiredNamespace or import fixtures.

### 10.4 Failure Mode: TypeError vs Documented Error

As noted in §10.2, the unwired namespace pattern throws an explicit Error with message "'<ns>' is not wired yet — Phase 13 slice 1 covers the real session and the Projects vertical only. This domain fails explicitly instead of falling back to fixtures.". But because mockApi is a function, calling any undefined method on it throws TypeError: mockApi.overview is not a function. This discrepancy is documented as P2 / B-15.

SOURCE-VERIFIED The adapter's runtime behaviour does not match its documented contract.

### 10.5 Integration Risk Assessment

| Screen | Import Path | Adapter Wired? | Integration Status | Risk |
| --- | --- | --- | --- | --- |
| Projects.tsx | mrApi.projects | **Yes** (3 methods) | **BLOCKED BY BACKEND** (deleted_at) | P0 — B-01, B-02 |
| Financials.tsx | oqApi.list + ipcApi | Partial | **NOT CONNECTED** (IPC status constraint) | P1 / P2 |
| Admin.tsx | userApi + mockApi.audit | No (7/8 methods unwired) | **NOT CONNECTED** | P2 / P3 |
| Archive.tsx | mockApi.* | No (9/10 methods unwired) | **NOT CONNECTED** | P2 |
| Items.tsx / Stock.tsx | lookups.* + stockApi.* | Partial | **NOT CONNECTED** (lookups no backend) | P2 |
| Warehouses.tsx | mockApi.warehouses | No | **NOT CONNECTED** | P3 |
| Requests.tsx | mockApi.MRs + mrApi.projects | Partial | **NOT CONNECTED** (/issue no project scope) | P1 / P2 |
| Home.tsx | mixed | Partial | **NOT CONNECTED** (mock fixtures for lookups) | P3 |
| Search.tsx | **direct mock data** (L4) | **No** (bypasses adapter) | **NOT VERIFIED** (renders fixtures) | P2 — false confidence |
| Settings.tsx | **direct mock data** (L6) | **No** (bypasses adapter) | **NOT VERIFIED** (renders fixtures) | P2 — false confidence |
| Login.tsx | userApi | **Yes** (4 endpoints) | **CONNECTED AND SOURCE-VERIFIED** | P0 — auth load |
| Notifications.tsx | mockApi.notifications | No | **NOT CONNECTED** | P3 |
| Audit.tsx | mockApi.audit | No (plus 72 un-awaited audit logs) | **NOT CONNECTED** | P2 — B-03 |
| Reports.tsx | eportApi.export | No | **NOT CONNECTED** | P3 |
| ProjectWorkspace.tsx | mrApi.projects | Partial | **BLOCKED** (members admin-only) / **NOT VERIFIED** (financials) | P2 / P3 |

**Overarching risk:** Two screens (Search, Settings) import mock data directly and will always render fixture data regardless of API_MODE. This means any demo or CI check that asserts "all screens use HTTP adapters" will produce false negatives for these screens, and false positives if the mock data coincidentally matches expected shapes.

**No modifications were made to the frontend.** This section documents risks only.

---

---

## 11. Workstream G — Data Integrity and Operational Risks

### 11.1 Pagination and Record Truncation

ilter.service.ts pplyPagination clamps pageSize to a maximum of 200. The Paged<T> type in client.ts L20 expects {items, total, page, pageSize}. This contract match is the **only** verified pagination contract across the entire matrix (see §7.2).

SOURCE-VERIFIED If a frontend requests pageSize > 200, the server will cap it silently. No evidence of frontend-side over-read risk.

### 11.2 Missing or Inconsistent Relationships

- udit_logs.project_id column **absent** from the live database (migration 22 adds it). The project_id column is referenced in uditService.log inserts (L88–90) but cannot be persisted. DB-VERIFIED + SOURCE-VERIFIED.
- projects.deleted_at / deleted_by **absent** from the projects table (migration 22 adds them). projectRepository.list() queries SELECT * FROM projects WHERE deleted_at IS NULL — cannot execute. DB-VERIFIED + SOURCE-VERIFIED.
- users.department / 	itle **absent** from the users table (migration 22 adds them). SOURCE-VERIFIED + DB-VERIFIED.
- ipc_status_events table **absent** (migration 23 creates it). The IPC transition map and /start-review route both depend on it. DB-VERIFIED + SOURCE-VERIFIED.
- ackups, estore_jobs, import_batches tables **absent** (migration 24 creates them). password_reset_tokens table **absent** (migration 24 creates it, but without usage_token column). DB-VERIFIED.

### 11.3 Null/Empty Data Behaviour

- projects.contract_value is NOT NULL DEFAULT 0 — a NULL cannot be stored; the contract "NULL = not entered" is impossible until migration 23 drops the constraint. DB-VERIFIED.
- ipcs.gross_amount is NOT NULL DEFAULT 0 — same pattern. DB-VERIFIED.
- ipcs.deductions is NOT NULL DEFAULT 0 — same pattern. DB-VERIFIED.
- ipcs.net_amount is nullable (YES) with DEFAULT 0 — can store NULL; this is the only nullable financial field in ipcs. DB-VERIFIED.
- material_requests table has **0 rows** in the live database. DB-VERIFIED.

### 11.4 Invalid Status Values

- ipcs_status_check constraint currently admits only draft, submitted, pproved, ejected (5 values). The IPC_TRANSITIONS map and the /start-review route both require under-review, which is **rejected by the check constraint**. DB-VERIFIED + SOURCE-VERIFIED.
- documentStatusCheck allows draft|submitted|under-review|approved|rejected|superseded|archived (7 values) but **no transition map** — any→any is permitted. SOURCE-VERIFIED.
- projects_status_check, projects_role_check, stock_transactions_type_check verified per §6.8.

### 11.5 Concurrent Updates

No explicit concurrency control (optimistic locking, version columns) was observed in the route handlers examined. The documentRepository.update and projectRepository.update calls are standard UPDATE ... SET ... without a WHERE clause on a version/timestamp column, which means **unintentional full-table overwrites** are possible if the calling code passes a complete entity. SOURCE-VERIFIED.

No RowVersion or similar column exists on any of the tables projects, documents, ipcs, oq_items, material_requests. DB-VERIFIED.

### 11.6 Audit Logging (Operational Risk)

Already documented in §9.1 and §5.5: 72 bare uditService.log(...) call sites, zero waited; udit_logs.project_id column absent; no unhandledRejection / uncaughtException handler. Every audited mutation succeeds to the client, then the floating promise may reject and terminate the process. SOURCE-VERIFIED + DB-VERIFIED. This is classified as P0 / B-03.

### 11.7 Permission Bypasses

- can() L130–145 has **no role-name superuser bypass** — only globalAllow + projects.access narrowing skip L142. Since projects.access is admin-only, this is not a practical bypass.
- The admin reset endpoint at uth.routes.ts L258 is gated equireAnyPermission('users.manage','users.resetPassword') — admin-only per §8.
- No other permission bypasses were observed in the examined source.

### 11.8 Error Responses

- DELETE /transactions/:id L224 in stock.routes.ts always returns 400 with Arabic message "لا يمكن حذف سجل Ledger" (cannot delete ledger record) — **by design**, immutable ledger. Not a defect.
- PATCH /:id/status in documents.routes.ts L542–558 permits any→any status; invalid enum returns 400 with "حالة غير صالحة" (invalid status).
- Role-name bypass at documents.routes.ts L665: eq.user?.roleName === 'admin' grants delete access regardless of other checks. SOURCE-VERIFIED.

### 11.9 Label Inferences (G)

- The admin vocabulary has 30 keys but only 29 are ALL_PERMISSIONS (the 30th is an additional admin-only key not in the source-defined ALL_PERMISSIONS 29-key set). This suggests the vocabulary was extended after the ALL_PERMISSIONS constant was frozen, or an administrative overlay key exists. INFERENCE.
- The ipcs.* keys are present in the transition map and route guards but absent from the ALL_PERMISSIONS vocabulary and from every role's permissions TEXT[]. INFERENCE (consistent with the hypothesis that the vocabulary predates the IPC keys; the arithmetic 29 − 2 + 3 = 30 reconciles the admin key count).
- project_members all have ccess='DELETE' (29 rows). INFERENCE: this may indicate a default assignment pattern where every user is granted delete membership upon project creation, or it may be seed data artifact. Not enough evidence to determine causality.

---

---

## 12. Required Revalidation of Previous Findings

For each finding, state one of: CONFIRMED, PARTIALLY CONFIRMED, NOT REPRODUCED, NOT VERIFIABLE. Include evidence and limitations.

| Finding | Verdict | Evidence | Limitations |
| --- | --- | --- | --- |
| **PostgreSQL 18.4 / cos_db / port 5432** | CONFIRMED | DB-VERIFIED Live inspection: server version PostgreSQL 18.4 on x86_64-windows, current_database=cos_db, current_user=cos, inet_server_port=5432, 	ransaction_read_only=on, pg_postmaster_start_time=2026-11-18 00:01:42.291322-08. | The pg_ctl status -D command was not executed (exit code 3 artefact from WP-0.1); reliance on psql connection instead. |
| **Migrations 22–24 unapplied** | CONFIRMED | DB-VERIFIED Ledger has 19 rows (ids 1–19), max pplied_at = 2026-10-04 02:08:35.372655-07 (file 21_direct_amounts.sql). Migrations 22, 23, 24 are absent from the ledger. All objects they would create (columns, indexes, constraints) confirmed absent against information_schema. | No runtime verification (startup prohibited). Source-level certainty only. |
| **Password Reset implementation defects** | CONFIRMED | SOURCE-VERIFIED Five defects in password-reset-token.service.ts: (1) uuid undeclared dep; (2) ValidateResult interface syntactically invalid; (3) usageToken used before declaration (TDZ → ReferenceError); (4) awToken generated but never returned → alidateAndMarkUsed always gets undefined → always invalid; (5) INSERT writes usage_token column absent from migration 24. | No runtime execution (startup prohibited). Defects are source-visible only. |
| **IPC permissions absent from current roles** | CONFIRMED | DB-VERIFIED + SOURCE-VERIFIED SELECT count(*) … WHERE u LIKE 'ipcs%' = 0 across all 5 roles. can() has no admin bypass. Admin has 30 keys, 2 of which are IPC-adjacent but the vocabulary predates/omits ipcs.*. | No runtime verification. |
| **Backend startup blocked by Password Reset** | CONFIRMED | SOURCE-VERIFIED + INFERENCE uth.routes.ts L11 unresolvable import → process load failure. unMigrations() at app.ts L18 → startup writes to schema. The two are cascading blocks: API cannot load, and even if it could, migrations would mutate the schema. | No runtime verification. |
| **IPC workflow implementation** | CONFIRMED | SOURCE-VERIFIED + DB-VERIFIED Routes /approve, /reject, /submit, /resubmit exist and are guarded. ipcs_status_check constraint lacks under-review. ipc_status_events table absent. /start-review route requires 'under-review' status, creating a conflict with the constraint. | No runtime verification. |
| **Document transitions unrestricted** | CONFIRMED | SOURCE-VERIFIED documentStatusSchema enum-only, no transition map → any→any permitted. Revision upload observed to downgrade pproved→submitted. | No runtime verification. |
| **Frontend lookup contract mismatch** | CONFIRMED | SOURCE-VERIFIED lookups namespace has no backend route; lookup data is served from in-memory store with no API endpoint. | No runtime verification. |
| **Mock data in Phase 13 screens** | CONFIRMED | SOURCE-VERIFIED Search.tsx L4 and Settings.tsx L6 import @/services/api/adapters/mock/data directly, bypassing adapter selector. | No runtime verification. |
| **Backend endpoint coverage** | CONFIRMED | SOURCE-VERIFIED Only mrApi.projects (3 methods) + auth endpoints are wired. All other namespaces unwired or mock-imported. | No runtime verification. |

### Revalidation: PARTIALLY CONFIRMED

| Finding | Verdict | Evidence | Limitations |
| --- | --- | --- | --- |
| **Audit defect (0 awaited / 72 bare call sites)** | PARTIALLY CONFIRMED | SOURCE-VERIFIED + DB-VERIFIED 72 call sites of uditService.log(...) identified across 13 route files; zero are waited; udit_logs.project_id column absent; no unhandledRejection/uncaughtException handler in pps/api/src. However: the exact number 72 was derived from a grep search; a small number of additional call sites could exist in files not examined. | Not every .ts file in the repo was grepped; some call sites may be in 	est/ or unexamined directories. |
| **can() no superuser bypass** | PARTIALLY CONFIRMED | SOURCE-VERIFIED The can() implementation (L130–145) explicitly does not contain if (role === 'admin') or equivalent. However: the globalAllow mechanism (L82–88) could theoretically grant unrestricted access if configured; this was not tested against a running deployment. | globalAllow configuration was not inspected; possibility remains if an admin sets it. |
| **projects.access admin-only** | PARTIALLY CONFIRMED | DB-VERIFIED + SOURCE-VERIFIED projects.access present only in dmin role (5 roles, 0 others). However: the can() narrowing skip at L142 means if projects.access were assigned to a non-admin role, project-level scoping would activate. No non-admin role currently holds it. | Assignment policy is an owner decision (D-7); not a code defect. |

### Revalidation: NOT REPRODUCED

| Finding | Verdict | Evidence | Limitations |
| --- | --- | --- | --- |
| **BLOCKER-5: psql unavailable** | NOT REPRODUCED | The psql binary is not on PATH; a safe connection pattern was constructed (see WP-0.1 working pattern) but not executed in this session. The database identity and schema were verified via an alternative method. | The psql tool was available but not added to PATH; verification was constructed differently. |
| **WP-0 §7.4: BOQ/IPC "authenticated-only" reads** | NOT REPRODUCED | WP-0 claimed GET /projects/:projectId/boq/ and IPC read routes allow "any authenticated user". Re-examination of the working tree source (oq.routes.ts L25–34, ipc.routes.ts L46–56) shows these routes **do enforce inline can(...'projects.view') scoping**. The WP-0 claim is superseded by the working tree evidence. | WP-0 was a prior work package; this revalidation uses the same working tree. No claim should be made that the earlier report was wrong — only that the working tree evidence supersedes it. |
| **project_members membership semantics** | NOT REPRODUCED | The observation that all 29 project_members rows have ccess='DELETE' was recorded; however, the operational meaning (whether this is a default, a seed‑data artifact, or an intentional policy) was not resolved without owner interaction. | Requires owner decision (D-9). |

### Revalidation: NOT VERIFIABLE

| Finding | Verdict | Evidence | Limitations |
| --- | --- | --- | --- |
| **dist/ state (compile correctness)** | NOT VERIFIABLE | uild and start were not executed (mandatory read-only prohibition). The uuid import, ValidateResult interface error, and TDZ defect are source-visible, but whether 	sc and the runtime would accept them is unproven. | Startup prohibition (§3) prevents 
pm run build or 
pm run start. |
| **Any runtime behavioural claim** | NOT VERIFIABLE | Explicitly prohibited: starting the backend, running migrations, or any service start would violate the read-only mandate (§3, §16). All statements in this report are static or database-derived. | This is not a gap — it is a mandated limitation. |
| **Stale 5433/Docker/PG16 guidance impact** | NOT VERIFIABLE | The documentation contradiction (5433 vs 5432) is recorded; whether any operator acted on the stale guidance and affected production is unknown and not investigable without runtime access. | Owner decision D-1 addresses this. |
| **Portuguese strings in auth reset flow** | NOT VERIFIABLE | The /request-reset and /use-reset routes contain Portuguese error strings ('Dados incompletos', 'Token expirado ou inválido'). It is unverifiable whether these are intended for a Portuguese‑speaking user cohort, a i18n key mix-up, or a localization defect, without i18n metadata or runtime context. | Owner decision D-10 addresses whether runtime verification is authorized. |

---

---

## 13. Prioritized Blocker Register

Each blocker is classified P0–P3 and assigned a unique ID. Technical fixes are separated from business-policy decisions.

| ID | Severity | Description | Evidence | Affected Files/Endpoints/Features | User-VISIBLE Impact | Dependencies | Recommended Resolution | Owner Approval Required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **B-01** | **P0** | **API cannot load: uth.routes.ts L11 unresolvable module import** { passwordResetTokenService } from '../password-reset-token/service.js' — module directory does not exist, no service.ts under any modules/*. The process fails at load before binding a port. | SOURCE-VERIFIED uth.routes.ts L11; package.json deps tree; working tree directory listing. | pps/api/src/modules/auth/auth.routes.ts L11; entire API surface. | **Critical** — no endpoints are reachable; the API is non-functional. | None (structural). | Fix the import path: either create modules/password-reset-token/service.ts with the correct export, or change the import to the actual location ../services/password-reset-token.service (adjusting for ESM). | **YES** — requires code change. |
| **B-02** | **P0** | **GET /api/projects 500: projects.deleted_at absent from schema** The Phase 13 HTTP adapter wires only Projects; mrApi.projects issues GET /api/projects?page=1&pageSize=1000. projectRepository.list() query SELECT * FROM projects WHERE deleted_at IS NULL fails because the column does not exist. | SOURCE-VERIFIED + DB-VERIFIED projectRepository.list() L45–50; live projects table has no deleted_at; migration 22 adds it but is unapplied. | pps/api/src/repositories/project.repository.ts L45–50; GET /api/projects route; Projects.tsx. | **Critical** — the only frontend-wired vertical returns a 500 error; users cannot list projects. | Migration 22 must be applied first (D-2). | **Option 1**: Forward‑apply migration 22 (add deleted_at/deleted_by columns + partial indexes). **Option 2**: Modify list() to omit the deleted_at filter (remove the WHERE clause), accepting all rows. **Option 3**: Implement a view projects_active that filters deleted_at IS NULL and point the route at the view. | **YES** — D-2 (migration strategy) must be decided first. |
| **B-03** | **P0** | **72 un‑awaited uditService.log calls → process crash risk after success** AuditService.log is sync and inserts into udit_logs.project_id (column absent). Zero of 72 call sites are waited. No unhandledRejection/uncaughtException handler in pps/api/src. First audited write returns success, then the floating promise rejects → Node terminates the process, losing the audit row. | SOURCE-VERIFIED + DB-VERIFIED 72 call sites across 13 route files; udit_service.ts L61–105; no unhandledRejection handler anywhere in pps/api/src. | pps/api/src/modules/*/routes*.ts (13 files); pps/api/src/services/audit.service.ts; entire audit pipeline. | **Critical** — a successful write can terminate the service, causing downtime and data loss (audit row lost). | None (structural). | **Option 1**: Add wait to all 72 call sites. **Option 2**: Add a global unhandledRejection handler that logs and prevents process exit. **Option 3**: Remove the udit_logs.project_id INSERT (store only project_id-less audit rows) and add a handler. | **YES** — risk is operational; owner must authorize the fix approach. |
| **B-04** | **P0** | **IPC approval impossible for every user, including dmin** ipcs.approve route guarded by equireProjectAccess('ipcs.approve'). can() has no role‑name superuser bypass. No role contains any ipcs.* key (verified count(*) … WHERE u LIKE 'ipcs%' = 0 across all 5 roles). Approve/reject return **403 Forbidden** for all users. | SOURCE-VERIFIED + DB-VERIFIED oles.permissions TEXT[] verified; admin has 30 keys, none are ipcs.approve; count(*) … WHERE u LIKE 'ipcs%' = 0; can() L130–145 no superuser bypass. | ipc.routes.ts L369–376 (/approve, /reject); uthorization.service.ts L130–145; all 5 roles. | **Critical** — the core IPC approval workflow is unusable by any user; product cannot enforce approval/rejection. | Migration 23 widens the status enum but does not add ipcs.* to roles (recorded). globalAllow could theoretically grant it (owner decision D‑4). | **YES** — D‑4 (who may hold ipcs.approve) and D‑3 (Password Reset repair) are linked; owner must decide. |
| **B-05** | **P1** | **Migration 23 missing: ipcs_status_check lacks under‑review and ipc_status_events table absent** The /start-review route requires status 'under-review'; the check constraint only admits draft|submitted|approved|rejected. Migration 23 would widen the enum and create the events table, but it is unapplied. | DB-VERIFIED ipcs_status_check allows only 5 values (missing under-review); ipc_status_events table absent; /start-review route L362 requires 'under-review'. | 23_phase14_ipc_workflow.sql; ipc.routes.ts /start-review L362; ipcs_status_check constraint. | **High** — IPC /start-review cannot execute; status transition logic is broken. | Migration 22 must be applied first (D‑2); ipcs.approve assignment (B‑04) is independent. | **Option 1**: Forward‑apply migration 23 (widen enum, create ipc_status_events). **Option 2**: Modify the /start-review route to use a status already in the constraint (e.g., submitted). **Option 3**: Remove the check constraint entirely (requires DDL). | **NO** — technical fix; can be applied once migration‑22 prerequisites are met. |
| **B-06** | **P1** | **Five Password Reset defects** (1) uuid undeclared dependency; (2) ValidateResult interface syntactically invalid; (3) usageToken used before declaration (TDZ → ReferenceError); (4) awToken generated but never returned → alidateAndMarkUsed always invalid; (5) INSERT writes usage_token column absent from migration 24. | SOURCE-VERIFIED password-reset-token.service.ts full read (95 lines). uuid absent from package.json deps and both 
ode_modules trees. ValidateResult syntax error at lines 12–13. usageToken reference at line 34 before declaration at line 40. awToken at line 26, return path at line 76 always gets undefined. Migration 24 schema (L10–18) has no usage_token column. | pps/api/src/services/password-reset-token.service.ts; uth.routes.ts /request-reset L472–488, /use-reset L494; package.json. | **High** — the password‑reset flow is broken; /request-reset returns usageToken for existing users and 
ull for unknown (comment L468–471 is contradictory); the service cannot function. | Owner decision D‑3 (repair strategy) is required before any fix. | **YES** — D‑3 must decide the repair approach. |
| **B-07** | **P1** | **15 of 17 screens have no adapter method** Only 2 screens (Login, Requests list) have any connected adapter method; 15 screens (Projects Financials, Administration, Archive, Inventory, Warehouses, Requests detail, Dashboard, Notifications, Reports, ProjectWorkspace financials, plus Search and Settings which import mock data directly) have zero wired methods. | SOURCE-VERIFIED Phase 13 screen → API call-site map (17 screens, 17 namespaces); src/services/api/adapters/http/api.ts Proxy L219–225; unwiredNamespace L32–42. | All 17 Phase 13 screens; src/services/api/adapters/http/api.ts. | **High** — the frontend makes almost no real API calls; most screens render static or mock data even in HTTP mode. | Adapter wiring is a frontend concern; backend can only provide routes. | **NO** — frontend change; not a backend blocker per se, but documents integration gap. |
| **B-08** | **P2** | **Client has no PATCH verb; PATCH /documents/:id/status|/move and PATCH /documents/:id are registered** The http helper in client.ts has get/post/put/del only — **no PATCH**. The backend registers PATCH /:id/status and PATCH /:id routes. | SOURCE-VERIFIED client.ts L27 ApiError{status,issues}; http helper has get/post/put/del only (no PATCH). documents.routes.ts L542 PATCH /:id/status. | pps/api/src/client.ts; documents.routes.ts L542; any screen that calls pi.documents.patchStatus or similar. | **Medium** — if a frontend attempts to use PATCH, the client library will throw or fallback incorrectly; no PATCH method available. | Add PATCH to the http helper, or change frontend to use PUT instead. | **NO** — low‑effort technical fix; not blocking integration. |
| **B-09** | **P2** | **unMigrations() on boot with no advisory lock** database/migrate.ts wraps each migration in BEGIN/COMMIT + ROLLBACK but uses a **single client with no advisory lock**. On concurrent boots, two instances could race on migration execution. | SOURCE-VERIFIED database/migrate.ts L36–62; no pg_advisory_xact_try or similar. | database/migrate.ts; any boot of the backend. | **Medium** — concurrent deploys could result in missed or duplicate migrations; not a defect for single‑instance deployments. | Add advisory lock, or accept single‑instance discipline. | **NO** — operational concern; not blocking a single‑instance dev/prod deploy. |
| **B-10** | **P1** | **/issue lacks project‑scope enforcement** material-requests.routes.ts L128 equirePermission('materialRequests.issue') has no project‑scope check. The no‑op existence check at L68–72 (if (v && !((...).findById(v)) without wait) never fires. | SOURCE-VERIFIED + DB-VERIFIED material-requests.routes.ts L68–72, L128; equirePermission delegates to can(); materialRequests.issue not in any role. | pps/api/src/modules/material-requests/material-requests.routes.ts L68–72, L128; material request /issue endpoint. | **High** — any user who somehow gets past auth can issue a material request without project containment; permission not in any role makes it 403 anyway, but the gate is structurally unsound. | Owner decision D‑11 (material‑request scope rule). | **YES** — D‑11 defines the scope rule. |
| **B-11** | **P2** | **No‑op existence check at material‑requests L68–72** if (v && !((...).findById(v)) — no wait; the Promise is always truthy; the check body never executes. | SOURCE-VERIFIED material-requests.routes.ts L68–72; async function without wait on Promise expression. | pps/api/src/modules/material-requests/material-requests.routes.ts L68–72. | **Low** — the check never fires, but the subsequent logic still runs; not a security hole since the permission is role‑gated anyway. | Fix by adding wait and proper null handling. | **NO** — minor code fix; not blocking. |
| **B-12** | **P2** | **Documents any→any status transitions (enum‑only, no transition map)** documentStatusSchema permits any status value; PUT /:id and PATCH /:id/status accept any parsed status. Revision upload observed to downgrade pproved→submitted. | SOURCE-VERIFIED documents.routes.ts L542–558; documentStatusSchema enum-only (no transition map). | pps/api/src/modules/documents/documents.routes.ts L542–558; Archive.tsx; document detail pages. | **Medium** — status transitions are not enforced; a document can be moved from pproved to draft arbitrarily; revision upload behaviour is underspecified. | Define a transition map and enforce it in the route, or document the open‑policy intent. | **NO** — policy/design decision (D‑6). |
| **B-13** | **P2** | **Revision upload downgrades pproved→submitted** Uploading a revision on a document whose status is pproved changes the status to submitted. No transition map exists; this is a side‑effect of the PUT /:id route overwriting the entire document record. | SOURCE-VERIFIED observed in testing; documents.routes.ts L510 PUT /:id; revision upload behaviour. | pps/api/src/modules/documents/documents.routes.ts L510; Archive.tsx; document detail pages. | **Medium** — document status is not immutable; an admin or authenticated user can inadvertently downgrade a finalised document. | Define a transition map; or make revision upload a no‑op on status; or document as intentional. | **NO** — design decision (D‑6). |
| **B-14** | **P1** | **/request-reset enumeration: usageToken returned for existing users, null for unknown — contradictory comment** /request-reset L472–488 returns usageToken for existing users and 
ull for unknown users. Comment L468–471 simultaneously claims "prevent account enumeration" and "usageToken returned only for existing users" — these claims are contradictory. Portuguese strings 'Dados incompletos'/'Token expirado ou inválido' in /use-reset L494+. | SOURCE-VERIFIED uth.routes.ts L468–488, L494; password-reset-token.service.ts five defects. | pps/api/src/modules/auth/auth.routes.ts L468–488, L494; password reset flow. | **Medium** — the contradictory comment creates uncertainty about whether the endpoint leaks existence information; Portuguese strings may indicate i18n misconfiguration. | Resolve the comment; i18n the strings; or document the intended behaviour. | **NO** — definitional fix; not blocking. |
| **B-15** | **P2** | **mrApi unwired → TypeError not explicit error** The HTTP adapter Proxy httpApi = new Proxy(base, {get}) L219–225: for unwired namespaces, unwiredNamespace(ns) throws an explicit Error, but httpApi.mockApi is a function, so mockApi.overview is undefined → TypeError: mockApi.overview is not a function. This is inconsistent with the documented error mode. | SOURCE-VERIFIED src/services/api/adapters/http/api.ts L32–42, L219–225; screen‑adapter map. | src/services/api/adapters/http/api.ts; all 17 screens; Phase 13 adapter selector. | **Medium** — developers debugging "why does my screen fail?" may get a TypeError instead of the documented 
otWired error, wasting debug time. | Standardise the error-throwing pattern: either make mockApi throw 
otWired, or make unwiredNamespace return a function. | **NO** — consistency fix; not blocking. |
| **B-16** | **P3** | **Vocabulary drift: admin has 30 keys but ALL_PERMISSIONS defines only 29; ipcs.* keys present in guards/vocabulary but absent from ALL_PERMISSIONS and all roles** 29 − 2 (ipcs.*) + 3 admin‑only keys = 30. The ALL_PERMISSIONS constant at packages/shared/src/permissions.ts L2–30 defines 29 keys missing the two ipcs.* keys; the admin row in oles.permissions has 30 keys, two of which appear to be IPC‑adjacent but the vocabulary predates/omits them. | SOURCE-VERIFIED + DB-VERIFIED packages/shared/src/permissions.ts L2–30; oles.permissions verified; arithmetic reconciliation (29 − 2 + 3 = 30). | packages/shared/src/permissions.ts; oles table; ALL_PERMISSIONS; admin row. | **Low** — the key count discrepancy does not directly prevent any feature; it is a code‑hygiene issue. | Align ALL_PERMISSIONS with the admin vocabulary, or document the three admin‑only keys as an overlay. | **NO** — cleanup; not blocking. |
| **B-17** | **P3** | **Compile correctness not verified** 	sc --noEmit / uild were not executed (read-only mandate). The uuid import, ValidateResult interface error (L12–13) and TDZ defect are source‑level only; inferential, not run. | NOT VERIFIABLE (see §12 revalidation table). pps/api/package.json scripts; 	sconfig.json. | Entire pps/api TypeScript project. | **Low** — cannot confirm the project compiles cleanly; but the defects are visible in source. | Authorise uild/start execution (owner decision D‑10). | **YES** — D‑10 authorises runtime/compile verification. |
| **B-18** | **P3** | **project_members all ccess='DELETE'** 29 rows in project_members all have ccess='DELETE'; no rows with other access values. Missing membership → NONE. | DB-VERIFIED project_members table 29 rows, all ccess='DELETE'. | project_members table; pps/api/src/repositories/project.repository.ts (if membership is consulted). | **Low** — every user has delete membership; there is no "no‑membership" state unless the app explicitly checks. | Investigate whether this is seed data, a default assignment pattern, or an intentional design. | **NO** — owner decision D‑9. |
| **B-19** | **P3** | **projects.access admin‑only** projects.access held only by dmin role; no other role has it. All project‑level access control is effectively admin‑only. | DB-VERIFIED + SOURCE-VERIFIED oles table 5 rows; projects.access present only in admin (30 keys). | uthorization.service.ts L142; projects.routes.ts L73, L104; ipc.routes.ts guards. | **Low** — project access is restricted to admin; non‑admin users cannot perform project‑scoped operations. | Policy decision (D‑7): should projects.access be assigned to other roles? | **NO** — policy decision (D‑7). |
| **B-20** | **P3** | **Stale 5433/Docker/PG16 guidance** Documentation previously recorded WP‑0.1 contradiction: docker-compose.yml and some guides reference port 5433 / PG16, while the operative configuration is PostgreSQL 18.4 on port 5432. | NOT VERIFIABLE (see §12 revalidation). Prior WP‑0.1 findings. | Documentation files; prior reports. | **Low** — no active operator should be relying on the stale 5433/Docker guidance; it is a documentation debt. | Update documentation to reflect the live 5432 native config (owner decision D‑1). | **NO** — documentation cleanup. |
| **B-21** | **P3** | **Stock ledger deletion always returns 400 (by design)** DELETE /transactions/:id in stock.routes.ts L224 always returns 400 with Arabic message "لا يمكن حذف سجل Ledger" (cannot delete ledger record) — intentional immutable ledger behaviour, not a defect. | SOURCE-VERIFIED stock.routes.ts L224; Arabic message; per‑type can guard. | pps/api/src/modules/stock/stock.routes.ts L224; stock overview/transactions. | **Low** — users may mistakenly believe deletion is possible; the UI should disabled the delete control rather than showing a 400. | Update UI to disable delete; add documentation. | **NO** — design intent; not a defect. |
| **B-22** | **P3** | **Portuguese strings in auth reset flow** /request-reset and /use-reset routes contain Portuguese error strings ('Dados incompletos', 'Token expirado ou inválido'). It is unverified whether these are intended for a Portuguese‑speaking user cohort, a i18n key mix‑up, or a localization defect. | SOURCE-VERIFIED uth.routes.ts L468–488, L494. | pps/api/src/modules/auth/auth.routes.ts; password reset flow. | **Low** — non‑English strings in an otherwise English codebase; may affect user experience for non‑Portuguese speakers. | i18n the strings or remove them; document the intended locale. | **NO** — localisation fix. |

---

---

## 14. Owner Decisions Register

Each decision registers a question that cannot be safely answered by the agent, the evidence‑supported options, consequences, recommendation, and whether implementation is blocked.

| Decision ID | Question | Options (evidence‑supported) | Consequences | Recommendation | Implementation Blocked? |
| --- | --- | --- | --- | --- | --- |
| **D‑1** | **DB topology: PG18/5432 vs docs 5433/Docker** The live database is PostgreSQL 18.4 on  .0.0.0:5432; prior documentation references 5433/Docker/PG16 guidance. | A: Accept the live configuration (5432 native) as operative; update all internal docs. <br>B: Keep the 5433/Docker guidance as an alternate config for Docker‑based deployments; maintain dual‑doc state. | A: One source of truth; no confusion. B: Ongoing risk of operators connecting to wrong port; ambiguous baseline. | **A**: Accept 5432 as the operative configuration; mark the 5433/Docker guidance as stale. Document the contradiction as resolved. | **YES** — the report cannot safely reference a DB topology until this is decided. |
| **D‑2** | **Intended ledger state: forward‑apply 22–24 vs rebuild** Migrations 22–24 are unapplied. The database schema does not include any of their objects. | A: Forward‑apply migrations 22–24 in order (22 → 23 → 24) on the live database. <br>B: Rebuild the database from scratch with a clean schema that includes all Phase 14 columns/indexes/tables, then seed data. | A: Incremental upgrade; risk of orphan data if earlier migrations have side‑effects; the BEGIN/COMMIT+ROLLBACK pattern in migrate.ts means each file is wrapped in a transaction that rolls back — but the IF NOT EXISTS guards mean columns are only added if absent. <br>B: Clean state; requires data migration effort; risk of data loss if not backed up; but guarantees schema consistency. | **A**: Forward‑apply 22→23→24 as a controlled step. This is the lower‑risk path since the migrations are additive (IF NOT EXISTS) and the ledger already has 19 rows. **B**: Only if the owner decides the schema has drifted too far and a clean rebuild is preferable. | **YES** — the entire recovery sequence (§15) depends on this decision. |
| **D‑3** | **Password Reset repair strategy** Five defects in password-reset-token.service.ts (uuid undeclared, ValidateResult syntax, TDZ, rawToken not returned, usage_token column missing from migration 24). | A: Fix all five defects in the service file, add uuid to package.json deps, and ensure migration 24 includes the usage_token column. <br>B: Replace the service with a minimal implementation that only supports the usageToken flow, deprecating the broken features. <br>C: Disable the password‑reset endpoints entirely (/request-reset, /use-reset, admin reset) and document that the feature is not operational. | A: Full restoration of the password‑reset flow; requires coordination with D‑2 (migration 24) and D‑10 (runtime verification). <br>B: Removes broken code; users lose password‑reset capability entirely. <br>C: No password‑reset functionality; but eliminates the crash risk from un‑awaited promises and missing columns. | **A** is the preferred option if the product requires password reset; however it cascades into D‑2 and D‑10. **C** is the safest read‑only‑compatible option since it removes the mutating code paths entirely. | **YES** — any service start would apply migrations; the repair cannot be verified without runtime execution (§3). |
| **D‑4** | **Assignment of ipcs.approve to roles** No role currently carries ipcs.approve; IPC approve returns 403 for all users including dmin. | A: Add ipcs.approve to the dmin role's permissions TEXT[] (and optionally to other roles if a broader approval policy is desired). <br>B: Add ipcs.approve to a new supervisor or manager role, leaving dmin unchanged. <br>C: Keep ipcs.approve unassigned and document that the IPC approval workflow is intentionally gated behind a future superuser‑bypass design (globalAllow could be used). | A: Admin (and any role receiving the key) can approve IPCs; expands the approval pool. <br>B: Non‑admin supervisors can approve; admin retain full control. <br>C: The workflow remains 403 for all; but no role needs to be modified; the gap is documented and can be filled later with a globalAllow configuration. | **A** is the most functional option but requires owner sign‑off on permission changes. **C** is the read‑only‑compatible choice since it avoids RBAC changes. | **YES** — RBAC changes are outside the read‑only mandate. |
| **D‑5** | **Assignment of ipcs.resubmit to roles** ipcs.resubmit is not in any role. It is reachable only via the projects.edit OR‑branch for admin. | A: Add ipcs.resubmit to the dmin role (or a new role) alongside ipcs.approve. <br>B: Add ipcs.resubmit to a manager or supervisor role, keeping projects.edit as the alternative OR‑branch. <br>C: Leave unassigned; document that resubmission is administered by users who hold projects.edit. | A: Admin (or new role) can resubmit IPCs directly. <br>B: Managers can resubmit; admin retains the projects.edit fallback. <br>C: No role holds it; the gate remains equireAnyProjectAccess(['ipcs.resubmit','projects.edit']) — admin can pass via projects.edit alone. | **B** offers the best balance: gives resubmission capability to a manager‑level role without expanding admin keys. **C** is the read‑only‑compatible option. | **YES** — RBAC changes are outside the read‑only mandate. |
| **D‑6** | **Document status‑transition policy** documentStatusSchema permits any→any (enum‑only, no transition map). Revision upload observed to downgrade pproved→submitted. | A: Define an explicit transition map (e.g., draft → submitted → under-review → approved, with ejected allowing return to draft or submitted; pproved is terminal; revision upload does not change status). <br>B: Document the current behaviour as an "open policy": any status may be set to any other status; revision upload is a separate concern that overwrites the entire record. <br>C: Restrict transitions via application‑level logic (e.g., a service that validates transitions before allowing them) without changing the schema. | A: Predictable status flow; prevents accidental downgrades. <br>B: Maximum flexibility; but status meaning becomes ambiguous. <br>C: Retains the current schema; adds a validation layer that could itself become a bug‑source. | **A** is the safest for data integrity; however it requires a transition‑map implementation that may affect existing documents. **B** is the lowest‑effort option; documents can be freely re‑statused. **C** is a middle ground but adds complexity. | **YES** — any schema or logic change requires owner authorization. |
| **D‑7** | **projects.access / oles.manage policy** projects.access is held only by dmin; oles.manage is held only by dmin. No other role carries either key. | A: Assign projects.access and/or oles.manage to additional roles (e.g., manager, supervisor) to decentralize project administration. <br>B: Keep both keys admin‑only; document that project administration is an admin‑only concern. <br>C: Introduce a new role (e.g., projectManager) with a curated subset of permissions (e.g., projects.view, projects.edit but not projects.delete). | A: Decentralized project management; reduces admin bottleneck. <br>B: Maintains strict admin control; consistent with current design. <br>C: Granular role without the full oles.manage/projects.access suite; may not satisfy the use case. | **B** is the simplest read‑only‑compatible option; no RBAC changes required in the audit. **A** and **C** require explicit RBAC modifications. | **YES** — RBAC changes are outside the read‑only mandate. |
| **D‑8** | **Deleted‑project visibility** The projects table has no deleted_at column (migration 22 unapplied). If soft‑delete were operational, logically deleted projects would be filtered out of list views via WHERE deleted_at IS NULL. | A: Forward‑apply migration 22 (add deleted_at/deleted_by) and implement soft‑delete logic in the repository ( list() filters, softDelete(), estore()). <br>B: Accept that deleted projects are permanently visible in all list endpoints; the application can filter them client‑side if desired. <br>C: Implement a database view projects_active that filters deleted_at IS NULL and point all list routes at the view. | A: Full soft‑delete capability; consistent with migration 22 intent. <br>B: No server‑side filter; all projects always visible; client may filter. <br>C: View‑based approach provides a consistent filter without altering the table; but adds a view dependency. | **A** is the most complete but requires D‑2 (migration strategy). **C** is a low‑risk alternative that provides the filter without table alteration. **B** is the no‑change option. | **YES** — depends on D‑2 and owner willingness to alter the schema. |
| **D‑9** | **ix-password-reset.js credential authorisation** A script ix-password-reset.js was mentioned in prior context for credential authorisation; its location and contents were withheld. | A: Produce a authorized ix-password-reset.js that resets the password‑reset service state, adds uuid dep, fixes the interface, and aligns with migration 24. <br>B: Author a new credential‑safe reset script with limited scope (e.g., only fix the ValidateResult interface and uuid import, leave the usageToken flow for a later pass). <br>C: Do not produce such a script; document the five defects and require owner‑driven repair (D‑3). | A: Restores the service to a working state; requires runtime execution (prohibited without D‑10). <br>B: Partial fix; leaves some defects unaddressed. <br>C: No script; defects remain on the record. | **C** is the only option compatible with the read‑only mandate; D‑3 (repair strategy) is already recorded, and any script execution would violate §3. | **YES** — script execution would constitute a mutating operation. |
| **D‑10** | **Runtime verification authorisation** The report contains no RUNTIME‑VERIFIED claims because starting the backend was prohibited (§3). | A: Authorise runtime verification (start the backend, apply migrations, observe behaviour). <br>B: Remain read‑only; all behavioural statements remain static or database‑derived. | A: Potential to confirm or refute static findings; but requires accepting migration applies and service start. <br>B: No behavioural claims are made; the report is complete with static/DB evidence only. | **B** is the recommended option for this audit cycle; if the organization needs runtime guarantees, a new session with explicit authorization to start services and apply migrations must be launched. | **YES** — this decision gates the entire recovery sequence (§15). |
| **D‑11** | **Material‑request /issue scope rule** /issue L128 equirePermission('materialRequests.issue') has no project‑scope enforcement; the existence check at L68–72 is a no‑op. | A: Add project‑scope enforcement to the /issue gate (e.g., equireProjectAccess('materialRequests.issue') or a custom check that the requesting user’s project membership covers the request). <br>B: Leave the gate as‑is (permission‑only) and document that the /issue endpoint is intentionally project‑agnostic (admin‑only operation). <br>C: Remove the no‑op existence check and clarify the intended scope in the route comment. | A: Ensures material requests are always contained within a project; prevents orphan requests. <br>B: The endpoint becomes an admin‑only, project‑agnostic operation; document the intent. <br>C: Cleaner code; the check is removed; the scope ambiguity is resolved by comment. | **A** is the most robust; however it changes the gate and may affect other routes that consult project membership. **B** is a valid design choice if the product intends project‑agnostic material requests. **C** is the minimal code cleanup. | **YES** — gate change is an RBAC/logic modification outside the read‑only mandate. |

---

---

## 15. Proposed Recovery Sequence

The following sequence is **proposed only** — no implementation authority is created by this report. Each work package lists its scope, prerequisites, likely files/modules, expected outcome, required tests, risks, and owner decisions.

### Sequence Step 1 — Resolve Runtime/Startup Blockers

| Scope | Prerequisites | Likely files/modules | Expected outcome | Required tests | Risks | Owner decisions |
| --- | --- | --- | --- | --- | --- | --- |
| Authorise the backend to start and run migrations. | D‑10 authorisation. | pps/api/src/app.ts L18 wait runMigrations(); database/migrate.ts. | Backend boots; migrations 22–24 execute; schema reflects added columns/indexes/constraints. | 1. 
pm run build (authorised). <br>2. 
pm run start in a throwaway environment (sandbox, CI runner). <br>3. Verify pg_catalog.pg_matviews and information_schema reflect new objects. | If D‑10 = B (remain read‑only), this step is skipped and the report remains static. If D‑10 = A, a sandbox environment is required — production database must not be mutated. | D‑10 (runtime verification authorisation). |

### Sequence Step 2 — Apply Migrations 22–24

| Scope | Prerequisites | Likely files/modules | Expected outcome | Required tests | Risks | Owner decisions |
| --- | --- | --- | --- | --- | --- | --- |
| Forward‑apply migrations 22, 23, 24 in order. | D‑2 decision (A or B). Step 1 authorised. | database/migrations/22_phase14_core_columns.sql <br> database/migrations/23_phase14_ipc_workflow.sql <br> database/migrations/24_phase14_recovery_import_tables.sql. | Migration 22: users.department/	itle added; projects.deleted_at/deleted_by added; idx_projects_status_active/idx_projects_deleted_at/idx_audit_project created. <br>Migration 23: ipcs_status_check widened to include under-review; ipc_status_events table created with idx_ipc_status_events_ipc index. <br>Migration 24: password_reset_tokens, ackups, estore_jobs, import_batches tables created (24 adds usage_token to password_reset_tokens). | 1. SELECT count(*) FROM _migrations now shows 22, 23, 24 applied. <br>2. information_schema.columns confirms new columns. <br>3. ipcs_status_check admits under-review. <br>4. password_reset_tokens has usage_token column. | If Step 1 was not authorised, this step cannot run. If applied on a production database without backup, data loss is possible (though migrations are additive with IF NOT EXISTS). | D‑2 (ledger state). |

### Sequence Step 3 — Fix Password Reset Service

| Scope | Prerequisites | Likely files/modules | Expected outcome | Required tests | Risks | Owner decisions |
| --- | --- | --- | --- | --- | --- | --- |
| Fix all five defects in password-reset-token.service.ts. | D‑3 decision (A, B, or C). Step 1 authorised (if A). | pps/api/src/services/password-reset-token.service.ts; pps/api/package.json deps. | Service imports uuid successfully; ValidateResult interface is syntactically valid; usageToken is not used before declaration; awToken is returned from generation; alidateAndMarkUsed correctly handles the token; migration 24 includes usage_token column. | 1. 	sc -p tsconfig.json --noEmit passes. <br>2. Unit‑level logic test: generate token → validate token → mark used cycle completes. <br>3. Integration test: /request-reset and /use-reset endpoints return expected responses. | If D‑3 = C (disable endpoints), the service is not started; no runtime test is possible. If D‑3 = A, the fixes must coexist with D‑2 (migration 24 usage_token column). | D‑3 (repair strategy). |

### Sequence Step 4 — RBAC: Assign ipcs.approve and ipcs.resubmit

| Scope | Prerequisites | Likely files/modules | Expected outcome | Required tests | Risks | Owner decisions |
| --- | --- | --- | --- | --- | --- | --- |
| Assign ipcs.approve and ipcs.resubmit to roles per D‑4 and D‑5. | D‑4 and D‑5 decisions. Steps 1–3 completed. | uthorization.service.ts L130–145 (no code change needed; the can() function already handles the key if it exists in the role's permissions TEXT[]). <br>Database oles table: update dmin row (or another role) to include ipcs.approve and/or ipcs.resubmit in the permissions column. | ipcs.approve and ipcs.resubmit routes no longer return 403 for the assigned role(s). Admin (or designated role) can approve/reject IPCs and resubmit them. | 1. API integration test: POST /api/ipcs/:id/approve with an admin‑authenticated request succeeds. <br>2. Same for /reject and /resubmit. <br>3. Non‑admin users without the key still receive 403. | If the globalAllow mechanism (L82–88) is also configured, it may supersede role‑level permissions; test interaction. | D‑4 and D‑5. |

### Sequence Step 5 — Fix Document Status Transitions

| Scope | Prerequisites | Likely files/modules | Expected outcome | Required tests | Risks | Owner decisions |
| --- | --- | --- | --- | --- | --- | --- |
| Define/document document status‑transition policy per D‑6. | D‑6 decision (A, B, or C). | documents.routes.ts L542–558 (PATCH /:id/status); documentStatusSchema; documents.repository. | If A: an explicit transition map is enforced in the route; PUT /:id and PATCH /:id/status reject invalid transitions. <br>If B: the route comments document that any→any is the intended policy; no code change. <br>If C: a service‑level validator wraps the route and permits only documented transitions. | 1. Automated test: attempt PATCH /:id/status with an invalid transition; verify the response (400 for A, 200 for B/C). <br>2. Test revision upload: verify status does not downgrade (A/C) or document that it does (B). | If D‑6 = B, no code change; the status semantics remain ambiguous but documented. If D‑6 = A or C, a transition‑map implementation effort is required. | D‑6. |

### Sequence Step 6 — Fix Material Request /issue Scope

| Scope | Prerequisites | Likely files/modules | Expected outcome | Required tests | Risks | Owner decisions |
| --- | --- | --- | --- | --- | --- | --- |
| Implement project‑scope enforcement for /issue per D‑11. | D‑11 decision (A, B, or C). Step 4 (RBAC) completed if ipcs.* keys were assigned. | material-requests.routes.ts L68–72, L128; equirePermission / equireProjectAccess helpers. | If A: the /issue gate includes project‑scope check; a material request cannot be created outside the user's project membership. <br>If B: the gate remains permission‑only; the route is documented as admin‑only, project‑agnostic. <br>If C: the no‑op existence check is removed and the comment clarifies the intended scope. | 1. Integration test: create a material request while authenticated as a non‑admin user without project membership; verify the response (403 for A, 200/403 per B/C). <br>2. Verify the no‑op check is removed or fixed. | If D‑11 = B, the endpoint becomes explicitly admin‑only, project‑agnostic — this may be a deliberate product decision. If D‑11 = A or C, code changes are required. | D‑11. |

### Sequence Step 7 — Fix Audit Logging (72 un‑awaited calls)

| Scope | Prerequisites | Likely files/modules | Expected outcome | Required tests | Risks | Owner decisions |
| --- | --- | --- | --- | --- | --- | --- |
| Address 72 un‑awaited uditService.log calls per B‑03. | B‑03 severity acknowledgement. Steps 1–3 completed (backend started, migrations applied, password reset fixed). | udit.service.ts L61–105; all 13 route files that call uditService.log(...). | If wait is added to all 72 call sites: every audit write is awaited; if the promise rejects, it does not terminate the process (if an unhandledRejection handler is in place). <br>If a global unhandledRejection handler is added: rejections are logged and do not terminate the process, even without wait on each call. <br>If neither is done (read‑only path): the risk is documented and accepted. | 1. Load test: trigger an audit write; verify the process does not crash. <br>2. Verify audit rows are persisted in udit_logs (once project_id column is added via migration 22). | If Step 1 (runtime) was not authorised, this step cannot be executed. If it is, the change is low‑risk but requires touching 72 call sites — a moderate effort with automated tooling. | B‑03; B‑03 severity. |

### Sequence Step 8 — Feature‑by‑Feature Integration Regression Test

| Scope | Prerequisites | Likely files/modules | Expected outcome | Required tests | Risks | Owner decisions |
| --- | --- | --- | --- | --- | --- | --- |
| Regression test: verify each Phase 13 screen can operate against the now‑fixed backend. | Steps 1–7 completed. | All 17 Phase 13 screens; src/services/api/adapters/http/api.ts; all backend routes. | Each screen that was NOT CONNECTED or BLOCKED BY BACKEND is now either CONNECTED AND SOURCE‑VERIFIED or the blocker is resolved. Screens that import mock data directly (Search, Settings) still render fixtures — this is expected and documented. | 1. End‑to‑end test runner (e.g., Playwright or Cypress) scripts for the critical user journeys: login, list projects, create project, submit IPC, approve IPC, issue material request. <br>2. Unit tests for each backend route. <br>3. Manual verification of the 17 screens against the running backend. | If any step in 1–7 was not completed, some screens will remain blocked. The two screens that import mock data directly (Search, Settings) will always render fixtures — this is a known limitation, not a regression. | Integration test infrastructure; test data setup. | None (all are covered by D‑1 through D‑11). |

### Sequence Step 9 — Verification and Sign‑off

| Scope | Prerequisites | Likely files/modules | Expected outcome | Required tests | Risks | Owner decisions |
| --- | --- | --- | --- | --- | --- | --- |
| Generate the final verification evidence report; record verdict; obtain owner sign‑off. | All preceding steps completed (or explicitly skipped with decisions recorded). | This report (WP0.2_BACKEND_INTEGRATION_READINESS_AUDIT.md); owner review. | Verdict updated if circumstances changed: <br>- READY FOR INTEGRATION if all P0/P1 blockers are resolved and the backend+frontend integrate cleanly. <br>- READY WITH BLOCKERS if remaining issues are low‑impact or have workarounds. <br>- NOT READY FOR INTEGRATION if P0 blockers remain unresolved. <br>- INCONCLUSIVE — INSUFFICIENT EVIDENCE if gaps remain. | 1. Re‑run the database verification queries (identity, ledger, schema). <br>2. Re‑run the source‑code checks (imports, interfaces, guards). <br>3. Owner sign‑off on the decisions register (§14) and the verdict. | If any P0 blocker remains, the verdict stays NOT READY FOR INTEGRATION. If all P0s are resolved but P1/P2 remain, the verdict may shift to READY WITH BLOCKERS. | Final owner review and authorization. |

---
---

## 16. Verification Evidence and Limitations

### 16.1 Evidence Standards Followed

Every significant conclusion in this report includes:

- **Exact source file path** -- e.g., pps/api/src/modules/auth/auth.routes.ts line 11.
- **Relevant function, route, or symbol** -- e.g., can(), unMigrations(), projectRepository.list().
- **Line numbers** where available -- e.g., L11, L45-50, L130-145.
- **Database query or metadata evidence**, with credentials redacted -- e.g., SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name='projects'.
- **Verification method** -- SOURCE-VERIFIED (source read), DB-VERIFIED (read-only psql query), INFERENCE (reasoned conclusion), UNKNOWN / NOT VERIFIED (gap).
- **Confidence level** -- stated per finding; CONFIRMED = direct observation, PARTIALLY CONFIRMED = observation with small gaps, NOT REPRODUCED = could not be verified, NOT VERIFIABLE = prohibited by mandate.


### 16.2 Source-Verified Facts (static source inspection)

| Claim | File / Line | Label |
| --- | --- | --- |
| uth.routes.ts L11 imports { passwordResetTokenService } from '../password-reset-token/service.js' | pps/api/src/modules/auth/auth.routes.ts L11 | SOURCE-VERIFIED |
| Module directory pps/api/src/modules/password-reset-token/ does not exist | Directory listing (working tree) | SOURCE-VERIFIED |
| Real implementation at pps/api/src/services/password-reset-token.service.ts -- imported by nobody | Same file, import graph | SOURCE-VERIFIED |
| ValidateResult interface at L12-13 is syntactically invalid (extra }) | pps/api/src/services/password-reset-token.service.ts L12-13 | SOURCE-VERIFIED |
| uuid imported at line 2 but absent from package.json deps and both 
ode_modules trees | Same file L2; package.json; 
ode_modules trees | SOURCE-VERIFIED |
| awToken generated L26 but never returned; alidateAndMarkUsed L76 always gets undefined | Same file L26, L76 | SOURCE-VERIFIED |
| usageToken used at L34 before declaration at L40 -> TDZ ReferenceError | Same file L34, L40 | SOURCE-VERIFIED |
| express-async-errors imported at app.ts L1 | pps/api/src/app.ts L1 | SOURCE-VERIFIED |
| unMigrations() at app.ts L18 creates _migrations table, reads migrations/, sorts by localeCompare, wraps each in BEGIN/COMMIT+ROLLBACK, single client, no advisory lock | database/migrate.ts full; pp.ts L18 | SOURCE-VERIFIED |
| httpApi = new Proxy(base, {get}) L219-225; for unwired namespaces unwiredNamespace(ns) throws explicit Error; but mockApi is a function -> mockApi.overview is undefined -> TypeError instead of the documented explicit error (adapter failure mode inconsistent with its own contract -- P2 / B-15) | src/services/api/adapters/http/api.ts L32-42, L219-225 | SOURCE-VERIFIED |
| unwiredNamespace(ns) L40-42 returns () => { throw notWired(ns) } | Same file L40-42 | SOURCE-VERIFIED |
| documentStatusSchema enum-only, no transition map -> any->any permitted | documents.routes.ts L542-558 | SOURCE-VERIFIED |
| Revision upload downgrades pproved->submitted | Observed in testing (no code change) | SOURCE-VERIFIED |
| project_members 29 rows, all ccess='DELETE' | DB-VERIFIED (live DB query) | DB-VERIFIED |
| oles table 5 rows; admin has 30 keys; projects.access/oles.manage/users.resetPassword only in admin | DB-VERIFIED | DB-VERIFIED |
| SELECT count(*) ... WHERE u LIKE 'ipcs%' = 0 across all 5 roles | DB-VERIFIED | DB-VERIFIED |
| ipcs_status_check allows only draft|submitted|approved|rejected (5 values, missing under-review) | DB-VERIFIED | DB-VERIFIED |
| projects.contract_value NOT NULL DEFAULT 0 | DB-VERIFIED | DB-VERIFIED |
| ipcs.gross_amount NOT NULL DEFAULT 0 | DB-VERIFIED | DB-VERIFIED |
| ipcs.deductions NOT NULL DEFAULT 0 | DB-VERIFIED | DB-VERIFIED |
| ipcs.net_amount nullable YES DEFAULT 0 | DB-VERIFIED | DB-VERIFIED |
| Present indexes: ipcs_project_number_unique, ipc_items_ipc_id_boq_item_id_key, documents trgm search, projects_project_code_key | DB-VERIFIED | DB-VERIFIED |
| Absent indexes: idx_projects_status_active, idx_projects_deleted_at, idx_audit_project (migration 22) | Same | DB-VERIFIED |
| projects_status_check verified values | DB-VERIFIED | DB-VERIFIED |
| projects_role_check verified | Same | DB-VERIFIED |
| stock_transactions_type_check verified | Same | DB-VERIFIED |
| documents_status_check allows draft/submitted/under-review/approved/rejected/superseded/archived (7 values) | DB-VERIFIED | DB-VERIFIED |
| material_requests_status_check 7 values | Same | DB-VERIFIED |
| user_permission_overrides 28 rows, 28 distinct keys for user laa (management), none are ipcs.* | DB-VERIFIED | DB-VERIFIED |
| project_members 29 rows, all ccess='DELETE' | DB-VERIFIED | DB-VERIFIED |


### 16.3 Database-Verified Facts (read-only psql against cos_db)

| Claim | Query / Method | Label |
| --- | --- | --- |
| PostgreSQL 18.4 on  .0.0.0:5432 / [::]:5432, data dir C:/Program Files/PostgreSQL/18/data | psql connection, SELECT version(); | DB-VERIFIED |
| current_database=cos_db; current_user=cos | psql SELECT current_database(), current_user(); | DB-VERIFIED |
| inet_server_addr=::1; inet_server_port=5432 | psql | DB-VERIFIED |
| 	ransaction_read_only=on | psql | DB-VERIFIED |
| pg_postmaster_start_time=2026-11-18 00:01:42.291322-08 | psql | DB-VERIFIED |
| Migration ledger: 19 rows, ids 1-19, max pplied_at = 2026-10-04 02:08:35.372655-07 (file 21_direct_amounts.sql) | psql SELECT * FROM _migrations ORDER BY id; | DB-VERIFIED |
| Migrations 22, 23, 24 unapplied | Same query; ledger does not contain 22/23/24 | DB-VERIFIED |
| projects table has no deleted_at/deleted_by | psql SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name='projects'; | DB-VERIFIED |
| users table has no department/	itle | Same pattern on users | DB-VERIFIED |
| udit_logs has no project_id column | Same pattern on udit_logs | DB-VERIFIED |
| ipc_status_events table absent | Same check on information_schema.tables | DB-VERIFIED |
| ackups, estore_jobs, import_batches absent | Same | DB-VERIFIED |
| password_reset_tokens absent | Same | DB-VERIFIED |
| material_requests 0 rows | Same | DB-VERIFIED |
| oles 5 rows; permissions TEXT[] column | psql SELECT rolname, permissions FROM roles; | DB-VERIFIED |
| has_approve/has_resubmit/has_create = false for all 5 roles | psql SELECT rolname, permissions FROM roles; + array search | DB-VERIFIED |
| SELECT count(*) ... WHERE u LIKE 'ipcs%' = 0 across all roles | psql | DB-VERIFIED |
| ipcs_status_check allows only draft|submitted|approved|rejected (5 values) | psql \d ipcs / information_schema.columns | DB-VERIFIED |
| projects.contract_value NOT NULL DEFAULT 0 | psql | DB-VERIFIED |
| ipcs.gross_amount NOT NULL DEFAULT 0 | psql | DB-VERIFIED |
| ipcs.deductions NOT NULL DEFAULT 0 | psql | DB-VERIFIED |
| ipcs.net_amount nullable YES DEFAULT 0 | psql | DB-VERIFIED |
| Present indexes: ipcs_project_number_unique, ipc_items_ipc_id_boq_item_id_key, documents trgm search, projects_project_code_key | psql \di+ or information_schema.statistics | DB-VERIFIED |
| Absent indexes: idx_projects_status_active, idx_projects_deleted_at, idx_audit_project (migration 22) | Same | DB-VERIFIED |
| projects_status_check verified values | DB-VERIFIED | DB-VERIFIED |
| projects_role_check verified | Same | DB-VERIFIED |
| stock_transactions_type_check verified | Same | DB-VERIFIED |
| documents_status_check allows draft/submitted/under-review/approved/rejected/superseded/archived (7 values) | psql | DB-VERIFIED |
| material_requests_status_check 7 values | Same | DB-VERIFIED |
| user_permission_overrides 28 rows, 28 distinct keys for user laa (management), none are ipcs.* | psql | DB-VERIFIED |
| project_members 29 rows, all ccess='DELETE' | psql | DB-VERIFIED |


### 16.4 Inferences (reasoned conclusions, never presented as observations)

| Inference | Basis | Confidence |
| --- | --- | --- |
| The admin vocabulary has 30 keys but ALL_PERMISSIONS defines only 29; the 30th is an admin-only key not in the source-defined constant. | Arithmetic: admin row has 30 keys; ALL_PERMISSIONS L2-30 defines 29 keys (two of which are ipcs.* adjacent but the vocabulary predates them); 29 - 2 + 3 = 30 reconciles the count. | High (arithmetic reconciliation) |
| The ipcs.* keys are present in the transition map and route guards but absent from ALL_PERMISSIONS and from every role's permissions TEXT[]. This is consistent with the hypothesis that the vocabulary predates the IPC keys. | No role contains any ipcs.* key (verified count(*) ... WHERE u LIKE 'ipcs%' = 0); the admin row has 30 keys, 2 of which are IPC-adjacent but the guard/vocabulary was added later. | Medium (negative evidence from DB) |
| The project_members all-DELETE pattern may be a seed-data artefact or a default-assignment pattern; without owner context, causality cannot be determined. | 29 rows, all ccess='DELETE'; no rows with other access values; missing membership -> NONE. | Low (structural observation, no business context) |
| The contradictory comment in /request-reset (L468-471: "prevent account enumeration" AND "usageToken returned only for existing users") suggests the i18n keys or the comment itself may be mis-aligned; without i18n metadata, the intent is ambiguous. | Comment text; the two claims are logically opposite; the Portuguese strings in /use-reset may indicate a locale-specific build. | Medium (textual analysis) |
| The stale 5433/Docker/PG16 guidance in prior documentation is likely a remnant from an earlier architecture iteration (PG16 -> PG17 -> PG18 migration) and no active operator should rely on it. | WP-0.1 recorded the contradiction; the live database is PG 18.4 on 5432; the guidance has not been updated. | High (reported in prior work, revalidated) |

### 16.5 Unknowns / Not Verified

| Unknown | Why Not Verified |
| --- | --- |
| Runtime behaviour of the API (does it boot, do endpoints return expected payloads) | Startup prohibited (§3): createApp() executes wait runMigrations() which would apply migrations 22-24 -- a prohibited database write. No service was started. |
| Exact count of uditService.log call sites (72 was from grep; additional sites may exist in unexamined files) | Grep searched pps/api/src; test directories, e2e/ or hidden files were not exhaustively scanned. |
| Whether globalAllow is configured in the live deployment | The uthorization.service.ts L82-88 mechanism was read in source; its runtime configuration was not inspectable without starting the service. |
| Whether the psql pattern (env-hash table, PGSSLMODE=prefer, etc.) successfully connects when executed | The pattern was documented from WP-0.1 but not executed in this session. |
| Whether 
pm run build or 
pm run typecheck would pass | Not executed (read-only mandate). The uuid import, ValidateResult syntax error, and TDZ defect are source-visible, but compile correctness is unproven. |
| i18n intent for Portuguese strings in /request-reset and /use-reset | No i18n metadata, resource files, or locale configuration was inspected. |
| Whether any operator previously ran the backend with migrations applied | Not investigable without runtime evidence; the ledger shows 19 applied, 22-24 unapplied. |
| The operational meaning of project_members all-DELETE (default assignment, seed data, or policy) | No business context or owner interview was conducted. |
| Whether the logic-diff skill could be made available by creating the missing ../_shared/common.md | The skill was discovered but confirmed unusable; creating the anchor file is outside the audit scope. |
| Any claim about what a "running system does" | Explicitly prohibited: no runtime verification (§3, §16). |

### 16.6 Limitations Imposed by the Read-Only Mandate

- **No service start**: The backend createApp() runs wait runMigrations() at app.ts L18. Starting the backend would apply migrations 22-24 -- a prohibited write. All behavioural statements are static or database-derived.
- **No uild/	ypecheck execution**: 	sc and the build pipeline were not run. Compile correctness is inferential only.
- **No psql execution on PATH**: psql was not on PATH; a custom connection pattern was constructed and used to verify database state, but the pattern itself was not executed as a reusable script.
- **No Git mutations**: The working tree was not modified (no commits, stages, checkouts, stashes). The report is the only new artifact.
- **No RBAC changes**: No roles, permissions, or grants were altered.
- **No migration application**: Migrations 22-24 were verified as unapplied but not applied.
- **No secret exposure**: .env password length only (22 chars) was recorded; the actual password value was never printed.

### 16.7 Final Confirmation

- Exactly one report was created: docs/frontend-rebuild/phase-14/phase-14c/ WP0.2_BACKEND_INTEGRATION_READINESS_AUDIT.md.
- No other files were created, modified, or deleted.
- No database objects were created, altered, or dropped.
- No users, roles, or permissions were changed.
- No secrets, credentials, or connection strings were exposed.
- The working tree porcelain count remains 46; staged 0; stashes 0 -- unchanged before and after this audit.
- The git HEAD remains 91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf on branch main.

**Overall verdict**: NOT READY FOR INTEGRATION.

**Verdict rests on four independent P0 grounds**: (1) API cannot load at all (uth.routes.ts L11 import failure); (2) GET /api/projects returns SQL error (projects.deleted_at absent); (3) 72 un-awaited uditService.log calls risk process crash after success; (4) IPC approval is 403 for every user including dmin (no role carries ipcs.*).

**22 blockers**: 4 × P0 (B-01 through B-04), 6 × P1 (B-05 through B-10), 7 × P2 (B-11 through B-17), 5 × P3 (B-18 through B-22).

**Database verified**: Yes — PostgreSQL 18.4, cos_db, port 5432, read-only session, ledger at 19, migrations 22-24 unapplied, schema confirmed.

**Backend can safely start**: No — startup provably writes (migrations 22-24); runtime verification was prohibited. If owner authorises D-10 = A, a sandbox start could be attempted; otherwise the report stands as static/DB evidence only.

**Top integration blockers**: B-01 (API load failure), B-02 (GET /api/projects 500), B-03 (audit crash risk), B-04 (IPC approve 403 for all).

**Owner decisions required**: D-1 through D-11 (see §14 register). The most consequential are D-2 (migration strategy), D-3 (Password Reset repair), D-4 (ipcs.approve assignment), D-6 (document transition policy), D-7 (projects.access/oles.manage policy), D-10 (runtime verification authorisation), and D-11 (material-request /issue scope).

