# Phase 12 — Consolidated Evidence Remediation & Final Architecture Alignment

**Report ID:** R-132
**Date:** 2026-11-04
**Status:** `COMPLETE — REVIEW REPORT ONLY — NO EXECUTION PERFORMED`
**Phase 12 status after this review:** **OPEN**
**Verdict:** `BLOCKED — ADDITIONAL EVIDENCE REQUIRED — PHASE 12 REMAINS OPEN`

**Method:** static, read-only audit of the repository at `D:\Default Project\company-ops-system`.
**Evidence labels used:** `Verified`, `Owner-Confirmed`, `Historical`, `Inferred`, `Proposed`, `Unknown`, `Contradicted`, `Not Authorized`.

> This report reconciles the fourteen Phase 12 documents against the source tree as it exists today.
> It does not modify any file, does not execute code, does not touch any database, and does not
> authorize any work. Documentary approval is **not** execution authorization.

---

## 1. Executive Summary

The Phase 12 documentation corpus is internally coherent and, in the great majority of cases,
faithful to the source. This review re-read all fourteen documents, the 204 KB prototype↔live
contract map, and the implementing code for the nine mandated workstreams. It confirms most
documented claims. It also identifies a small number of **material defects that the corpus either
does not state, states too weakly, or states in a way the code contradicts.**

Four items drive the verdict.

1. **There is no database backup or restore capability.** `apps/api/src/services/backup.service.ts`
   copies `data/` and `storage/` only. It never invokes `pg_dump`, never invokes `pg_restore`, and
   contains no PostgreSQL code path at all. Exit condition 10 of the Owner Acceptance Record
   ("Backup/snapshot procedure — tested and verified (pg_dump + restore to temporary DB)") is
   therefore **not merely unmet — it is currently unsatisfiable by the shipped application**
   (`Verified`, F-02).

2. **The data-migration script is broken against the live schema and fails silently.** It inserts
   into `projects (name, client_name, consultant_name)` while `001_initial_schema.sql` defines
   `project_name`, `client`, `main_contractor`, `site_location`, with no migration ever renaming
   them. It calls `crypto.randomUUID()` without importing anything that provides it. Its failure is
   swallowed and the process exits 0. It is never invoked. This is an unreferenced, non-functional
   artefact that has nevertheless been discussed as if it were a migration asset (`Verified`, F-01).

3. **Several documented API security gaps remain live in the code exactly as described** — `G-01`,
   `G-02`, `G-04`, `G-05`, `G-06`, `G-08` — and the notification subsystem has a defect the corpus
   does not record at all: `markAllRead(username)` clears **every** notification globally, while
   `list()` returns the latest 100 notifications **for all users** (`Verified`, F-05, F-10).

4. **The prototype adapter inventory is wrong by three methods.** The corpus states 65 methods
   across eight namespaces. The source exports **68**: `mrApi` has 9 (not 8) and `userApi` has
   11 (not 9). The discrepancy is exactly +3, fully explained, and must be corrected rather than
   silently tolerated, because the count is used as a coverage figure (`Verified`, F-15).

None of these findings is a reason to doubt the good-faith accuracy of the corpus. They are reasons
why Phase 12 cannot close on documentation alone: three of the four are code facts that no amount of
further reading will resolve, and the fourth is a counting error that propagates into coverage claims.

**Overall:** the documentation layer is close to final; the **evidence layer is not.** Phase 12
remains **OPEN**, Stage 3 and Phase 13 remain **Not Authorized**, and D5 / D6 / D7 remain
**Not Authorized**.

---

## 2. Scope, Method, and Evidence Discipline

### 2.1 Authorized scope (executed)

| Activity | Performed |
|---|---|
| Repository identification and Git metadata read | Yes |
| Read source, SQL, scripts, migrations, configuration | Yes |
| Read all fourteen Phase 12 documents + contract map | Yes |
| Static tracing of call paths and data flow | Yes |
| Create exactly one new Markdown file (this report) | Yes |

### 2.2 Prohibited scope (not executed)

| Activity | Status |
|---|---|
| Editing code, SQL, migrations, documents, configuration | `Not Authorized` — not performed |
| Running tests, build, typecheck, lint | `Not Authorized` — not performed |
| Running or rolling back migrations | `Not Authorized` — not performed |
| Executing any SQL, connecting to any database | `Not Authorized` — not performed |
| Production access of any kind | `Not Authorized` — not performed |
| Reading or disclosing secrets / `.env` values | `Not Authorized` — not performed |
| Installing tooling, changing services or system settings | `Not Authorized` — not performed |
| Any Git write (stage, commit, branch, reset, clean) | `Not Authorized` — not performed |
| Deployment | `Not Authorized` — not performed |
| D5, D6, D7, Stage 3, Phase 13 | `Not Authorized` — not performed |

### 2.3 Label discipline applied in this report

- `Verified` means **this review read the exact source line(s) cited**. It does not mean "tested".
- `Owner-Confirmed` means a person asserted it; the artefact does not prove it.
- `Historical` means it was true at a recorded time and may no longer be reproducible.
- `Inferred` means concluded by reasoning from adjacent evidence; **never** promoted to `Verified` here.
- `Proposed` means designed but not built.
- `Unknown` means the evidence does not exist in this repository.
- `Contradicted` means two or more in-repository statements cannot both be true.
- `Not Authorized` means the action was outside the permitted envelope.

No `Inferred` item in this report has been upgraded to `Verified`. No `Owner-Confirmed` item has
been re-labelled `Verified`. No documentary approval has been treated as an execution permit.

---

## 3. Repository Baseline and Provenance

| Fact | Value | Label |
|---|---|---|
| Repository root | `D:\Default Project\company-ops-system` | `Verified` |
| Remote | `https://github.com/mamin144/company-ops-system.git` | `Verified` |
| Branch | `main` | `Verified` |
| HEAD | `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf` | `Verified` |
| Working tree | 24 modified files + untracked `docs/`, `COS_*.md` pair | `Verified` |
| `docs/` tracking status | **untracked** | `Verified` |

**Provenance warning that governs this whole report.** `docs/` is untracked in Git. Therefore:

1. No claim about the Phase 12 corpus can be attributed to a commit, a diff, or a review gate.
   The corpus has no version-control history in this repository.
2. The 24 pre-existing uncommitted modifications include 18 files under `apps/api/src/**` (the D4
   conflict-marker repair) plus `logs/`, `package.json`, `package-lock.json`,
   `scripts/install-service.ps1`, and `test-results/.last-run.json`. These are **pre-existing state**,
   observed by this review and left untouched. They are not an output of this audit.
3. Consequently, the code cited in this report is the code **as it sits on disk now**, which may
   differ from any committed or deployed state. Findings are labelled `Verified` against the working
   tree only.

This review made **no** Git write and read Git metadata only.

---

## 4. Workstream A — D1 Architecture Alignment

### 4.1 What the Owner Decision Record says

`phase-12-owner-decision-record.md:20` records **Option B — logical separation with selective
reuse** as the selected architecture direction, and line 22 states its conditional outcomes remain
conditional: backend repair not executed, HTTP adapter not implemented, D6 not executed, production
baseline incomplete.

### 4.2 What the contract map says

`phase-12-prototype-live-api-contract-map.md:100` records:

> **D1 — Architecture Option B** … *as recorded in the historical ODR*. **Architecture Option A is
> the operative owner instruction for the current scope**; the divergence is preserved, not resolved.

and `:1614-1618` (D-SPEC-15) states the ODR is not modified, no renewed approval is requested, and
"the preserved conflict is a traceability fact, not an open implementation question."

### 4.3 Re-assessment

| Claim | Re-assessed label | Basis |
|---|---|---|
| ODR selects Option B | `Verified` | ODR §D1 line 20, read directly |
| D-SPEC-15 declares Option A operative "for the current scope" | `Verified` | Contract map §14.4.2, read directly |
| The two are mutually consistent | `Contradicted` | "Option B is selected as the architecture direction" and "Option A is the operative owner instruction" cannot both be the operative direction without a scope qualifier that changes the answer |
| Option A/B decision is closed | **No** — `Unknown` at the governance level | No artefact records an owner instruction dated after the ODR that selects A. D-SPEC-15 asserts it; assertion is not a decision record |

### 4.4 Why this stays open

D-SPEC-15 classifies the divergence as "a traceability fact, not an open implementation question."
That classification is **not established by the documents themselves**: the artefact that would
establish it — a dated owner instruction superseding ODR D1 — is not in the corpus.

This is a governance contradiction, not a technical one. It does not block reading code. It does
block any statement of the form "the architecture is aligned", and it blocks Phase 12 closure,
because the alignment claim is one of Phase 12's deliverables.

**Owner decision required: yes.** Either (a) record a dated instruction that Option A governs a
named scope and Option B remains the direction, or (b) restate D-SPEC-15 as "divergence unresolved."

---

## 5. Workstream B — D6 Runtime Sources (Audit / Notifications)

### 5.1 Runtime reality

Both `audit.service.ts` and `notification.service.ts` write through `pool` (PostgreSQL). Both import
a `JsonStore`-backed repository that they **never call**:

- `apps/api/src/services/audit.service.ts:5` imports `auditLogRepository`; no call site exists.
- `apps/api/src/services/notification.service.ts:4` imports `notificationRepository`; no call site exists.
- `apps/api/src/repositories/audit-log.repository.ts:9` and `notification.repository.ts:9` each
  construct a `JsonStore` over `data/audit_logs.json` / `data/notifications.json`.
- `apps/api/src/services/session.service.ts:19` constructs `new JsonStore(... 'sessions.json')` and
  **never references `store` again** anywhere in the file.

`Verified`: the JSON layer is dead code in all three services.

### 5.2 Consequences for the D6 premise

D6 is described throughout the corpus as "the audit/notifications **JSON → PostgreSQL** migration."
The source does not support that framing. The writers are already PostgreSQL. What exists is a
**dead parallel JSON path**, not an active JSON store awaiting migration. Two things follow:

1. D6's scope description is at minimum misleading and should be restated as "remove dead JSON
   persistence and complete the PostgreSQL read paths" (`Inferred` from code; `Verified` that the
   JSON path is not invoked).
2. The residual risk the corpus worries about — dual-write divergence — **does not exist**
   (`Verified`: there is no second write). The real risk is different and worse in one respect:
   readers have no paging and no recipient model (§5.3).

### 5.3 Read-path defects (both `Verified`)

**Audit (`audit.service.ts:69-95`).** The query is built with filters and `ORDER BY created_at DESC`
and then executed **with no `LIMIT` and no `OFFSET`**. Pagination is applied in memory:

```ts
const result = await pool.query(query, params);      // entire table
...
return { items: logs.slice((page-1)*pageSize, page*pageSize), total: logs.length, ... };
```

`MAX_LOGS = 5000` is declared at line 8 and **never used**. On an append-only audit table that is
required to grow without bound, this is a full-table transfer on every request. Severity: High
(availability, not confidentiality).

**Notifications (`notification.service.ts`).** Three distinct defects:

| Defect | Line | Effect |
|---|---|---|
| `create()` takes no recipient | `:19-30` | Every notification is **broadcast to all users**; `read_by` is the only per-user state |
| `list()` uses a fixed `LIMIT 100` with no recipient filter | `:36-52` | One busy user's notifications crowd out everyone else's; the 101st is permanently unreachable |
| `markAllRead(username)` | `:60-70` | Executes an `UPDATE ... SET read_by = array_append(...)` with **no `WHERE` on the row set other than unread-ness** — one user's "mark all read" clears the badge for **every user** |

`MAX_NOTIFICATIONS = 2000` is declared at `:6` and **never used**.

The `dedupe` path (`:22-28`) keys on `array_length(read_by, 1) IS NULL`, so dedupe stops working the
instant anyone reads the notification — the opposite of the intended semantics.

`Verified`. Severity: High. This is the single most under-documented defect found in this review.

---

## 6. Workstream C — Data-Migration Script Correctness

`apps/api/src/database/data-migration.ts` (211 lines).

| Observation | Evidence | Label |
|---|---|---|
| Inserts `projects (id, project_code, name, client_name, consultant_name, status, ...)` | `:77` | `Verified` |
| Live schema defines `project_name`, `client`, `main_contractor`, `site_location` | `001_initial_schema.sql:57-63` | `Verified` |
| No migration renames those columns | 19 migration files inspected; none alter `projects` to `name`/`client_name`/`consultant_name` | `Verified` |
| `crypto.randomUUID()` used without any import providing `crypto` | `:104`, `:114`, `:172`, `:185` — imports are `pool`, `fs/promises`, `path`, `url` (`:1-4`) | `Verified` |
| Failure is swallowed; process still exits 0 | `:203-211`: `catch` logs, then `run().then(() => pool.end()).catch(console.error)` | `Verified` |
| Never invoked by the application | no reference in `app.ts`, `bootstrap.ts`, `migrate.ts`, or `package.json` scripts | `Verified` |

**Assessment.** This script cannot succeed against the current schema. If it were ever invoked with
a populated `data/` directory it would fail on the first non-empty entity that touches `projects`,
log a message, and exit successfully. A caller checking the exit code would conclude the migration
succeeded.

**Why it matters.** The script is a load-bearing artefact in any future data-migration plan
(D-SPEC-01 ledger, Stage 3 validation, cutover rehearsal). Its condition was not previously recorded
in the corpus as "non-functional". Any plan that assumes this script works is built on an untested
assumption.

**What remains unknown.** Whether an earlier revision of this script matched an earlier schema
(`Unknown` — no Git history for it beyond the current HEAD, and the file is modified in the working
tree). Whether the intended column names were ever correct (`Unknown`).

**Recommended action.** Do not repair as part of Phase 12. Record its status as
`NON_FUNCTIONAL — NOT WIRED — SILENT-FAILURE`, and require a fresh, schema-derived migration design
before Stage 3. **Owner decision required: yes** (repair vs retire).

---

## 7. Workstream D — Backup and Restore Capability

`apps/api/src/services/backup.service.ts` (76 lines).

| Observation | Evidence | Label |
|---|---|---|
| Imports only `fs` primitives (`cpSync`, `existsSync`, `mkdirSync`, `readdirSync`, `rmSync`) | `:1` | `Verified` |
| `create()` copies `<cwd>/data` → backup `data/` | `:28` | `Verified` |
| `create()` copies `<cwd>/storage` → backup `storage/` | `:29-31` | `Verified` |
| No `pg_dump`, no `pg_restore`, no `child_process`, no SQL of any kind | full-file read | `Verified` |
| `restore()` takes a safety snapshot first | `:57-58` | `Verified` |
| `restore()` then `rmSync(dataDir)` and `cpSync` the backup over it | `:61-63` | `Verified` |
| `restore()` then `rmSync(storageDirAbs)` and `cpSync` over it | `:68-69` | `Verified` |
| Backup name validated by anchored regex `^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}(-safety)?(-\d+)?$` | `:11` | `Verified` |

### 7.1 The finding

**There is no database backup and no database restore, anywhere in the application.** The `data/`
directory contains JSON seed/runtime files, not the PostgreSQL data directory. The system of record
is PostgreSQL (`connection.ts` requires `DATABASE_URL`; every service writes through `pool`).

Therefore:

- A "backup" taken today preserves **no** project, document, IPC, BOQ, stock, audit, session, or
  user data.
- A "restore" today replaces some JSON files and the attachment tree, and leaves the database
  untouched. It is a **partial, non-atomic, non-transactional rollback** of a subset of state.
- The regex validation is actually *adequate* against path traversal (anchored, no separators) —
  this is the one part of the module that is sound. `Verified`.

### 7.2 Effect on the exit criteria

Owner Acceptance Record condition 10 reads: *"Backup/snapshot procedure — tested and verified
(pg_dump + restore to temporary DB)."* Condition 11 reads: *"Rollback/recovery procedure — tested
and verified."*

Both are **Not Authorized** for this review and, more importantly, **unsupportable by the current
codebase**. Migration 09 (document-category deletion/reassignment) and Migration 19
(`UPDATE sessions SET revoked_at = NOW()`) are destructive and effectively irreversible. With no
database backup, there is no real rollback path for either.

This is the strongest single reason the verdict is `BLOCKED`.

**Owner decision required: yes** — whether database backup/restore is in Phase 12 scope at all, or
is deferred with the risk explicitly accepted in writing.

---

## 8. Workstream E — Migration 19, Sessions, and Authorization

### 8.1 Migration 19 (`19_authz_rebuild.sql`, 93 lines)

| Element | Finding | Label |
|---|---|---|
| Creates `user_permission_overrides` | present | `Verified` |
| Creates `project_members` | **not** `project_memberships` | `Verified` |
| Unknown `role_name` → `RAISE EXCEPTION` | present | `Verified` |
| Re-seeds 5 system roles with `ON CONFLICT (name) DO UPDATE ... WHERE roles.is_system` | present | `Verified` |
| Adds `fk_users_role` | present | `Verified` |
| Revokes all live sessions: `UPDATE sessions SET revoked_at = NOW() WHERE revoked_at IS NULL` | present | `Verified` |
| `down/19_authz_rebuild.sql` (6 lines) drops both tables and the constraint | present | `Verified` |
| `down/19` restores sessions | **absent** | `Verified` |

`Verified`: the admin key list in Migration 19 contains 31 keys (28 vocabulary + `roles.manage`,
`projects.access`, `users.resetPassword`) and matches `MANAGED_PERMISSIONS` in
`authorization.service.ts:19-24` exactly. The migration and the resolver agree. This is a genuine
strength and should be recorded as such.

Session revocation in a `down` script is technically impossible (the prior values are not retained),
so its absence is correct. The **gap** is that the corpus does not state, in the rollback section,
that Migration 19 is a one-way door whose only safe recovery is a pre-migration database snapshot —
which does not exist (§7).

### 8.2 Session service (`session.service.ts`)

| Observation | Evidence | Label |
|---|---|---|
| `rememberMe` hard-coded `true` in `mapRow` with comment "Approximation since not stored" | `:38` | `Verified` |
| `remember_me` column exists in schema | `001_initial_schema.sql:42` | `Verified` |
| `create()` does not write `remember_me` | `:59` INSERT omits it | `Verified` |
| `findById()` does **not** check `revoked_at` or `expires_at` | `:68-76` returns the row as-is | `Verified` |
| Revocation/expiry enforced in `middleware/auth.ts` instead | `:74-83` | `Verified` |

**Assessment.** `findById()` returning a revoked or expired session is a **latent** defect, not a
live authentication bypass, because the only caller that matters (`requireAuth`) re-checks both
conditions before trusting the session. The corpus should record it as *defence-in-depth failure*
rather than as an SSO/authz hole, and it should state the compensating control explicitly.

**What remains unknown.** Whether any non-`requireAuth` caller consumes `findById` and would
therefore accept a revoked session. This review found none, but absence of a call site in a
read-only pass is weaker evidence than an exhaustive graph. `Inferred`: no such caller.

The `rememberMe` constant also feeds `toSafeUser`-adjacent UI (`/me`), so a 30-day-remembered
session and a 1-day session are indistinguishable to the client. Correctness defect, Low severity.

### 8.3 Authorization resolver (`authorization.service.ts`)

`Verified` as documented: `MANAGED_PERMISSIONS` (31), `SCOPED_MIN_LEVEL` (16 keys), `globalAllow`
with DENY-beats-GRANT, `can()` skipping narrowing when `projects.access` is held, `loadContext()`
issuing three batched queries, and `effective()` / `isAdminCapable()` / `countAdminCapable()` /
`wouldLoseAdminCoverage*()`.

**One important clarification that the corpus gets partly wrong.** `req.user.permissions` is a
snapshot built by `toSafeUser()` from `effective(ctx)` **without a projectId** — i.e. role base plus
overrides with DENY winning. It is therefore *semantically equal to the global decision* and is
**not** an authorization bypass when read directly.

However, `middleware/auth.ts:20-24` states in a doc comment that the snapshot is "deliberately NOT
consulted: every decision re-resolves from DB-backed authorization.service." That invariant is
**violated** in `import.routes.ts:381` and `:396`, which read
`req.user!.permissions.includes(perm)`. The consequences are limited (global decision, no project
scope, no escalation) but the invariant is real and documented, the code breaks it, and no test
covers it.

**Classification:** documentation/consistency contradiction, **not** an authz bypass. Severity:
Medium. Must not be reported as a privilege escalation.

### 8.4 Project scope (`projectScope.ts`)

`Verified` as documented: row-backed resolution (`scopeFromParam`, `scopeFromRow`,
`scopeDocumentRow`, `scopeSiteRow`, `scopeWarehouseRow`, `scopeMaterialRequestRow`), client-supplied
IDs can only deny, `{missing:true}` → 404 via `hideExistence`, `filterVisible`, `checkFilterProject`,
and `grantProjectAccess` (`INSERT ... ON CONFLICT DO NOTHING` on `project_members`).

The `projectScope.ts:8-10` invariant — "a forged `projectId` can only ever deny, never grant" — is
**correct for the paths that use these helpers**. It is **not universally true**, because several
high-value routes bypass the helper entirely (§9). The invariant should be narrowed to "where the
scope helper is used", not stated as a system property. This is a documentation overreach, and it is
the root cause of G-04/G-08/G-02 not having been recognised as invariant violations earlier.

---

## 9. Workstream F — API Security and Permission Enforcement

All findings below were re-read directly in source. None is inherited from the contract map on trust.

| ID | Finding | Evidence | Severity | Corpus agreement |
|---|---|---|---|---|
| G-01 | `GET /api/folders` requires only `requireAuth`; no `archive.view`, no project scoping, returns the full folder tree | `folders.routes.ts:9-14`; guarded siblings at `:15-51` | High | Documented; **confirmed** |
| G-02 | `DELETE /api/documents/links/:linkId` looks up by `linkId` alone and deletes; any `archive.edit` holder can unlink **any** document's link | `documents.routes.ts:298-304` | High | Documented; **confirmed** |
| G-04 | `GET /api/projects/export/xlsx` exports **all** projects; the handler calls `projectRepository.list()` with no `filterVisible` | `projects.routes.ts:~68-73` | High | Documented; **confirmed** |
| G-05 | `PATCH /api/documents/:id/status` accepts any enum value; no transition matrix | `documents.routes.ts:344-361` | High | Documented; **confirmed** |
| G-06 | `POST /api/backups/:name/restore` is destructive, takes a client-supplied name, and has no confirmation token; audit is written **after** the destroy | `system.routes.ts:36-45` | High | Documented; **confirmed** |
| G-08 | `GET /api/projects/financials` runs one SQL statement over **every** project; `requirePermission('projects.view')` only | `projects.routes.ts:25-55` | High | Documented; **confirmed** |
| G-03 | Withdrawn — not a gap | `sites.routes.ts` uses `filterVisible` | — | Documented; **confirmed withdrawn** |
| G-07 | Defence-in-depth inconsistency; handler performs `can(..., projectId)` | `projects.routes.ts` IPC child | Low | Documented; **confirmed** |

### 9.1 Import surface (`import.routes.ts`, 473 lines) — four separate problems

`Verified`:

1. **Multer is unbounded.** `const upload = multer({ storage: multer.memoryStorage() });` (`:33`) —
   no `limits`, no file-size cap, no MIME allow-list, and the storage is **memory**, so a large
   upload is held entirely in RAM before any authorization check runs.
2. **Upload middleware precedes authorization on three routes.** `:203` (`/smart/analyze`),
   `:226` (`/smart/preview`), `:375` (`/:entity/preview`) all declare
   `upload.single('file')` **before** the permission middleware. On `:375` there is **no permission
   middleware at all**; the check happens inside the handler at `:381`.
3. **`GET /:entity/template` (`:365`) has no authorization whatsoever.** It resolves
   `templates[entity]` from a plain object literal lookup, so `entity=__proto__` or
   `entity=constructor` resolves to an inherited member rather than `undefined`. Exploitability is
   low (`Verified`: it would return a function or object, not attacker-controlled content) but the
   pattern is wrong and should use `Object.hasOwn`.
4. **Two confirm routes use `req.user.permissions.includes(perm)`** (`:381`, `:396`) instead of
   `can(ctx, perm, projectId)`. See §8.3 — limited impact, real invariant violation.

### 9.2 Import integrity (`:entity/confirm`, and `smart/confirm`)

`Verified`:

- No `BEGIN`/`COMMIT` anywhere in the route file.
- Rows are inserted **one at a time** in a loop; a mid-loop failure leaves earlier rows committed.
- The `import_history` row is inserted **after** the loop (`:~455-470`), so a failure before that
  point produces **imported rows with no ledger record at all**.
- Per-row failures are collected and returned, which is good, but the partial-state problem means
  "imported 40 of 100" is indistinguishable from "imported 40, then crashed" once the process dies.

Severity: **Critical** for data integrity. The corpus records the missing transaction
(`§5.3.1`, `OPEN`) but does not record that the ledger row is written *after* the mutation loop,
which is the part that makes the failure un-auditable.

### 9.3 Application bootstrap (`app.ts`) — recorded for completeness

`Verified`: `ensureDataDirectories()` → `ensureSeedData()` → `runMigrations()` execute **before** the
server starts listening; `trust proxy` is set to `1`; when `CORS_ORIGINS` is unset the server
**reflects** the request origin with `credentials: true`; JSON body limit is `10mb`; `urlencoded` is
`{ extended: true }` **without a limit**; a SPA fallback exists.

The CORS reflection behaviour is a real risk in production but its production configuration is
`Unknown` (no authorised access), so it cannot be assessed as either a defect or a control.

---

## 10. Workstream G — Prototype ↔ Live Surface Counts

### 10.1 Endpoint count

| Claim | Re-assessment |
|---|---|
| "108 HTTP endpoints = 107 route handlers + `GET /api/health`" | `Verified` by re-counting the contract map's per-file table; the arithmetic reconciles |

This figure is consistent and is not contested by this review.

### 10.2 Adapter method count — **the corpus is wrong by 3**

Machine count of exported members in
`docs/frontend-rebuild/phase-03-prototype/src/services/api/adapters/mock/api.ts`:

| Namespace | Documented (§6.1) | Actual | Delta |
|---|---:|---:|---:|
| `mockApi` | 22 | **22** | 0 |
| `stockApi` | 5 | **5** | 0 |
| `lookups` | 2 | **2** | 0 |
| `boqApi` | 6 | **6** | 0 |
| `ipcApi` | 9 | **9** | 0 |
| `mrApi` | 8 | **9** | **+1** |
| `userApi` | 9 | **11** | **+2** |
| `reportApi` | 4 | **4** | 0 |
| **Total** | **65** | **68** | **+3** |

The missing members are:

- `mrApi.projects` (`api.ts:721`) — the scoped project selector used before `createProject`/`updateProject`.
- `userApi.list` (`api.ts:961`) and `userApi.get` (`api.ts:966`) — the two read accessors.

`Verified`. This is not a design disagreement; the source is unambiguous.

**Why it matters.** The "65" figure appears in §6.1, in the evidence ledger at `:702`, and in the
correction log at `:1757`. A coverage ratio computed against a wrong denominator is a wrong coverage
figure. The ≈29 business-operation estimate is `Inferred` at best and is unaffected in
direction, but it should be recomputed rather than carried forward.

### 10.3 Transport readiness (`D7` precondition)

`client.ts` is explicitly labelled "NOT wired into any screen yet" (`:1-4`), and
`index.ts:16-18` confirms it: `export type ApiAdapter = typeof mockAdapter;` and
`export const adapterMode: 'mock' = 'mock';` with the comment "fixed adapter mode". The HTTP
transport is **not registered** as an adapter. `Verified`.

Three concrete blockers to any future D7 work, all `Verified`:

1. **No credentials.** `fetch(...)` at `client.ts:36-41` does not set `credentials: 'include'`.
   The server authenticates via `cos_access` cookie and a refresh cookie (`auth.ts:45-60`). A
   browser adapter built on this helper **cannot authenticate at all**.
2. **No multipart.** `body` is always `JSON.stringify(...)` with `Content-Type: application/json`
   (`:38-39`). Document upload and the entire import surface are `multipart/form-data`. There is no
   code path for them.
3. **Error contract is self-contradictory.** `client.ts:42` throws `Error` on any `!res.ok`, while
   `errors.ts:5-6` states that "Preview-level validation errors (4xx bodies) are passed through as
   data, not thrown semantics." The two documents describe opposite behaviours; the code does the
   throwing one.

Additionally, `configuration.ts:10-14` hard-codes `IS_PROTOTYPE = import.meta.env.VITE_PROTOTYPE === '1'`
and `adapterMode` is a literal type — swapping in an HTTP adapter requires changing a `const` type,
not just a registry entry.

Severity: Medium for Phase 12 (documentation), but these are **hard blockers for D7** and must be
recorded as such rather than left as "adapter design pending".

---

## 11. Workstream H — PostgreSQL 17 / PostgreSQL 18 Evidence

### 11.1 What was actually proven

| Claim | Label | Basis |
|---|---|---|
| 19 migrations applied on PG **17.11** in an isolated test database | `Historical` | Stage 2 report §12-13; not re-executable in this review |
| Result recorded as `PASS WITH LIMITATIONS` | `Historical` | Stage 2 report |
| Isolation achieved is **database-level** (separate DB names on the host PG 17 service, port 5433), **not instance-level** | `Owner-Confirmed` + consistent with metadata | Stage 2B §1; addendum corrections |
| Temporary clusters on 5439/5440 were genuinely separate `initdb` instances and failed | `Historical` | Stage 2 report §9 |
| PG 18 is the intended operating version | `Owner-Confirmed` | ODR / Stage 2 |
| PG 18 was exercised | **No** — `Unknown` / `ENVIRONMENT_BLOCKED` | see §11.2 |
| `uuid-ossp` and `pg_trgm` installable as trusted extensions on PG 18 | `Inferred` | PostgreSQL documented behaviour for 13+; **not** verified at runtime here |
| Effective `search_path` in any test session | `Unknown` | C-14 remains open |

### 11.2 Environment blockage (reproduced, `Historical`)

- PG 18 isolated cluster: startup failed with `0xC0000142 STATUS_DLL_INIT_FAILED`.
- The same failure reproduced on PG 17 for temp clusters on ports 5439/5440.
- Service-identity addendum corrections: PG 17 PID drifted `2084 → 5908` on port 5433; PG 18 PID
  drifted `8000 → 14220` with **no `LISTEN`** on 5432.

Interpretation: the failure is environmental (DLL initialisation under the current Windows session),
not a defect in the migration set. That interpretation is `Inferred`, and it is the only reading
consistent with PG 17 succeeding on the host service while failing on freshly initialised temp
clusters.

### 11.3 Consequence

The single most cited fact in support of Phase 12 progress — "all 19 migrations apply cleanly" — is
true **for exactly one version, on exactly one host, once, on 2026-11-01**, and the operating target
version is a different major. It is `Historical`, not `Verified`, and it does not transfer.

---

## 12. Critical Findings Register

Each finding states severity, classification, location, observation, significance, residual unknown,
recommended action, and whether an owner decision is required.

---

**F-01 — Data-migration script is non-functional and fails silently**
- **Severity:** Critical (integrity / planning)
- **Classification:** `Verified`
- **Location:** `apps/api/src/database/data-migration.ts:77` vs `apps/api/src/database/migrations/001_initial_schema.sql:57-63`; failure path `:203-211`
- **Observation:** inserts `name`, `client_name`, `consultant_name` into a table that has
  `project_name`, `client`, `main_contractor`, `site_location`; uses `crypto.randomUUID()` without
  an import; catches its own failure and exits 0; is never invoked.
- **Significance:** any plan that treats this as a working migration asset is unsound.
- **Remains unknown:** whether it ever matched an earlier schema.
- **Recommended action:** reclassify as `NON_FUNCTIONAL — NOT WIRED`; do not repair inside Phase 12.
- **Owner decision:** **Yes** — repair or retire.

---

**F-02 — No database backup, no database restore**
- **Severity:** Critical (recoverability)
- **Classification:** `Verified`
- **Location:** `apps/api/src/services/backup.service.ts:1-76`
- **Observation:** copies `data/` and `storage/` only; no `pg_dump`/`pg_restore`, no `child_process`,
  no SQL.
- **Significance:** Owner Acceptance condition 10 is unsatisfiable; Migrations 09 and 19 are
  effectively irreversible; no cutover rehearsal is meaningful.
- **Remains unknown:** whether an external/organisational backup process exists (not in repo).
- **Recommended action:** record the gap explicitly; require `pg_dump` + verified restore-to-temp-DB
  before any destructive migration is executed.
- **Owner decision:** **Yes** — is DB backup in Phase 12 scope, or is the risk accepted in writing?

---

**F-03 — Restore is destructive and audits after the fact**
- **Severity:** High
- **Classification:** `Verified`
- **Location:** `apps/api/src/modules/system/system.routes.ts:36-45`; `backup.service.ts:51-71`
- **Observation:** the handler runs `restore()` first and calls `auditService.log(...)` afterwards;
  no confirmation token, no dry run, no reversal without a second restore.
- **Significance:** an accidental call destroys current state and the audit trail records the event
  only if the process survives.
- **Remains unknown:** whether the intended operator flow includes an out-of-band confirmation.
- **Recommended action:** write the audit *before* execution; require an explicit confirmation
  parameter.
- **Owner decision:** No for the defect; **Yes** for any change to endpoint shape.

---

**F-04 — `sessionService.findById` ignores revocation and expiry**
- **Severity:** High (defence-in-depth)
- **Classification:** `Verified`
- **Location:** `apps/api/src/services/session.service.ts:68-76`; compensating check `middleware/auth.ts:74-83`
- **Observation:** returns the session row without checking `revoked_at` or `expires_at`.
- **Significance:** single-layer enforcement; any future caller that trusts `findById` re-opens the
  hole. Not a live bypass today.
- **Remains unknown:** whether a non-`requireAuth` caller exists (`Inferred`: none).
- **Recommended action:** push the checks into `findById`; document the compensating control.
- **Owner decision:** No.

---

**F-05 — Notification broadcast + global "mark all read"**
- **Severity:** High
- **Classification:** `Verified`
- **Location:** `apps/api/src/services/notification.service.ts:19-30` (no recipient),
  `:36-52` (LIMIT 100, all users), `:60-70` (global update)
- **Observation:** notifications have no recipient model; any user's "mark all read" clears every
  user's unread state; the read list is truncated at 100 globally.
- **Significance:** correctness failure visible to every user, and a cross-user state mutation.
- **Remains unknown:** whether the UI exposes a per-notification "mark read" fallback (the route
  exists, so partial mitigation may exist).
- **Recommended action:** add a recipient column or per-user join table; scope `markAllRead`.
- **Owner decision:** **Yes** — schema change is `Not Authorized` and requires approval.

---

**F-06 — `GET /api/folders` unguarded (G-01)**
- **Severity:** High
- **Classification:** `Verified`
- **Location:** `apps/api/src/modules/folders/folders.routes.ts:9-14`
- **Observation:** `requireAuth` only; no `archive.view`; no project scoping; returns the whole tree.
- **Significance:** read exposure of folder names/structure to any authenticated user, including
  users with no archive permission.
- **Remains unknown:** whether folder names are considered sensitive (`Unknown`, business decision).
- **Recommended action:** add `archive.view`; scope the tree.
- **Owner decision:** No for the fix; **Yes** if scoping changes the response contract.

---

**F-07 — Document link deletion is unscoped (G-02)**
- **Severity:** High
- **Classification:** `Verified`
- **Location:** `apps/api/src/modules/documents/documents.routes.ts:298-304`
- **Observation:** `requirePermission('archive.edit')` then `findById(linkId)` then `delete(linkId)`;
  the owning document's project is never resolved.
- **Significance:** a user with `archive.edit` on project A can sever links on project B.
- **Remains unknown:** whether links carry a `project_id` that would make scoping a one-line change.
- **Recommended action:** resolve the parent document and apply `scopeDocumentRow()`.
- **Owner decision:** No.

---

**F-08 — Project export is unscoped (G-04)**
- **Severity:** High
- **Classification:** `Verified`
- **Location:** `apps/api/src/modules/projects/projects.routes.ts:~68-73`
- **Observation:** `projectRepository.list()` with no `filterVisible`.
- **Significance:** an Excel file containing every project is one click away for any `reports.view`
  holder — a bulk exfiltration path that the list endpoint itself does not have.
- **Remains unknown:** whether `reports.view` is broadly granted (permission matrix is in Migration 19
  and can be read; the *assignment* of roles to users in production is `Unknown`).
- **Recommended action:** apply `filterVisible` before export.
- **Owner decision:** No.

---

**F-09 — Financials endpoint is unscoped (G-08)**
- **Severity:** High
- **Classification:** `Verified`
- **Location:** `apps/api/src/modules/projects/projects.routes.ts:25-55`
- **Observation:** one SQL statement aggregating BOQ totals, approved IPC net amounts, deductions,
  and linked documents across **all** projects, gated only by `projects.view`.
- **Significance:** the most commercially sensitive read in the system has no membership predicate.
- **Remains unknown:** none material.
- **Recommended action:** add a membership join or post-filter; note this is a query-shape change.
- **Owner decision:** **Yes** — performance implications of a join on a large table.

---

**F-10 — Audit read path transfers the whole table**
- **Severity:** High (availability)
- **Classification:** `Verified`
- **Location:** `apps/api/src/services/audit.service.ts:69-95`
- **Observation:** `SELECT ... ORDER BY created_at DESC` with no `LIMIT`/`OFFSET`; paging in memory;
  `MAX_LOGS` unused.
- **Significance:** audit is append-only and unbounded by design; latency and memory grow without limit.
- **Remains unknown:** current production row count (`Unknown`).
- **Recommended action:** push `LIMIT`/`OFFSET` into SQL; add a `COUNT(*)` for `total`.
- **Owner decision:** No.

---

**F-11 — Audit redaction is incomplete**
- **Severity:** Medium-High
- **Classification:** `Verified`
- **Location:** `apps/api/src/services/audit.service.ts` `sanitize()`
- **Observation:** removes only top-level `passwordHash`, `password`, `token`. Does not remove
  `newPassword`, `refreshToken`, `password_hash`, `secret`, or any nested key.
- **Significance:** a future handler that logs a reset body would persist a plaintext or hashed
  credential in an append-only table.
- **Remains unknown:** whether any current handler passes such a body (`Inferred`: no, because
  current call sites pass `metaOnly(...)`).
- **Recommended action:** denylist by key pattern, recursively; add a regression test.
- **Owner decision:** No.

---

**F-12 — Import upload is unbounded and pre-authorization**
- **Severity:** High (DoS / resource)
- **Classification:** `Verified`
- **Location:** `apps/api/src/modules/import/import.routes.ts:33`, `:203`, `:226`, `:375`, `:365`
- **Observation:** `multer({ storage: memoryStorage() })` with no `limits`; upload middleware runs
  before authorization on three routes; `GET /:entity/template` has no authorization at all.
- **Significance:** unauthenticated-by-permission memory exhaustion; template route is an open door.
- **Remains unknown:** the maximum practical upload size before OOM (`Unknown`; depends on deployment
  memory).
- **Recommended action:** add `limits.fileSize` and `files: 1`; move permission checks before
  `upload.single`; guard the template route.
- **Owner decision:** No.

---

**F-13 — Import confirm is non-transactional and ledger-after-the-fact**
- **Severity:** Critical (integrity)
- **Classification:** `Verified`
- **Location:** `apps/api/src/modules/import/import.routes.ts` — `:entity/confirm` (~`:392-470`), `smart/confirm` (~`:286-360`)
- **Observation:** no `BEGIN`/`COMMIT`; row-by-row inserts; `import_history` inserted after the loop.
- **Significance:** partial imports with no ledger record; un-auditable data state; no way to
  distinguish "planned partial" from "crashed mid-run".
- **Remains unknown:** whether `import_history` was ever intended to be written per-run rather than
  per-request (`Proposed` designs exist, `DEFERRED`).
- **Recommended action:** wrap in a transaction; insert the ledger row first and update it on
  completion; or accept partial semantics explicitly and record them in the ledger.
- **Owner decision:** **Yes** — atomic vs partial-with-ledger is a product decision.

---

**F-14 — Adapter inventory is 68, not 65**
- **Severity:** Medium (evidence accuracy)
- **Classification:** `Verified`
- **Location:** contract map §6.1 (`:689-701`); source `adapters/mock/api.ts:721`, `:961`, `:966`
- **Observation:** `mrApi` = 9, `userApi` = 11, total 68.
- **Significance:** coverage figures derived from 65 are wrong; the ≈29 operations estimate needs
  recomputation.
- **Remains unknown:** none.
- **Recommended action:** correct the three figures and the derived coverage statement.
- **Owner decision:** No.

---

**F-15 — HTTP transport cannot authenticate and cannot upload**
- **Severity:** Medium now, blocking for D7
- **Classification:** `Verified`
- **Location:** `src/services/api/client.ts:32-47`; `configuration.ts:10-19`; `index.ts:16-18`
- **Observation:** no `credentials: 'include'`; JSON-only body; throws on 4xx in contradiction with
  `errors.ts:5-6`; adapter mode is a literal `const`.
- **Significance:** an HTTP adapter built on this scaffold will fail at login and at upload, i.e. at
  the two most important surfaces.
- **Remains unknown:** which auth transport the target UI will use (cookie vs bearer) — `Proposed`
  only.
- **Recommended action:** record these as D7 entry conditions, not as Phase 12 defects.
- **Owner decision:** **Yes** — D7 remains `Not Authorized`; the auth-transport choice is an owner
  decision.

---

**F-16 — Dead JSON persistence layer in three services**
- **Severity:** Medium
- **Classification:** `Verified`
- **Location:** `audit.service.ts:5`, `notification.service.ts:4`, `session.service.ts:19`,
  `repositories/audit-log.repository.ts`, `repositories/notification.repository.ts`
- **Observation:** imported or instantiated, never invoked.
- **Significance:** the D6 premise ("migrate JSON → Postgres") does not describe the runtime; the
  actual work is deleting dead code and fixing the Postgres read paths.
- **Remains unknown:** whether any script or external tool reads those JSON files (`Unknown`).
- **Recommended action:** restate D6 scope; delete after a verified grep.
- **Owner decision:** **Yes** — D6 scope restatement.

---

**F-17 — `down/` covers 3 of 19 migrations**
- **Severity:** High (recoverability)
- **Classification:** `Verified`
- **Location:** `apps/api/src/database/migrations/down/` contains `19_`, `20_`, `21_` only;
  `migrate.ts` never reads `down/`.
- **Observation:** 16 migrations have no rollback script; the runner has no rollback mode at all.
- **Significance:** "rollback" in the corpus means "restore a snapshot" — and there is no snapshot
  (§7). Combined, the system has **no** rollback path.
- **Remains unknown:** whether rollback was ever intended to be script-driven.
- **Recommended action:** state the position explicitly: rollback = restore a verified `pg_dump`.
- **Owner decision:** **Yes**.

---

**F-18 — Schema nomenclature contradicts the target design**
- **Severity:** Medium
- **Classification:** `Contradicted`
- **Location:** live: `project_members`, `stock_transactions`, `stock_transaction_lines`;
  documented target: `project_memberships`, `stock_movements`, `stock_movement_lines`
- **Observation:** the code and the design documents use different names for the same concepts.
- **Significance:** any migration or adapter written from the target document will not match reality;
  this is exactly the class of error that produced F-01.
- **Remains unknown:** which naming is intended to survive (`Unknown`).
- **Recommended action:** pick one, record it as an owner decision, and align the contract map.
- **Owner decision:** **Yes**.

---

**F-19 — D1 architecture contradiction (Option A vs Option B)**
- **Severity:** High (governance)
- **Classification:** `Contradicted`
- **Location:** `owner-decision-record.md:20` vs `contract-map.md:100`, `:1614-1618`
- **Observation:** see §4.
- **Significance:** Phase 12 cannot declare "architecture aligned" while the operative direction is
  recorded two ways.
- **Remains unknown:** whether a superseding owner instruction exists outside the repository.
- **Recommended action:** obtain and file the instruction, or downgrade the claim.
- **Owner decision:** **Yes**.

---

**F-20 — `projectScope` invariant is over-stated**
- **Severity:** Medium (documentation)
- **Classification:** `Contradicted`
- **Location:** `projectScope.ts:6-12` vs G-01/G-02/G-04/G-08
- **Observation:** the module states that scope resolution is "the ONLY place that answers which
  project does this request target"; four high-value routes never call it.
- **Significance:** the invariant's absolutism is why those gaps survived review; a narrower
  statement ("where used") would have made the gaps obvious.
- **Remains unknown:** whether additional unguarded routes exist outside the contract map.
- **Recommended action:** narrow the claim; add a route inventory check that every project-bearing
  route references a scope helper.
- **Owner decision:** No.

---

## 13. Contradiction Register — C-01 … C-21 Re-Assessment

The corpus records all twenty-one as **Resolved**. This review re-evaluated each **without assuming
resolution**. The distinction that matters: a contradiction about **document text** can be verified
by reading the document; a contradiction about **what happened on a date** can only ever be
`Owner-Confirmed`.

| ID | Subject | Corpus status | Re-assessed label | Basis |
|---|---|---|---|---|
| C-01 | Stage 2 BLOCKED vs executed | Resolved | `Owner-Confirmed` (timeline) | The provisioning event has no independent timestamp in the repo |
| C-02 | Temp clusters vs port 5433 | Resolved | `Owner-Confirmed` + consistent with metadata; instance identity **not** conclusively proven | Addendum; isolation is database-level |
| C-03 | "Read-only provisioning" | Resolved | `Historical` | Actions documented, not reproducible |
| C-04 | BLOCKED → PASS WITH LIMITATIONS | Resolved | `Owner-Confirmed` (timeline) | Status progression is a narrative claim |
| C-05 | "Inferred harmless" idempotency | Resolved | `Verified` | Corrected text present; `IF NOT EXISTS` present in migrations |
| C-06 | D8 preliminary vs final | Resolved | `Verified` (text) / `Owner-Confirmed` (event) | Documents now agree; the approval itself is asserted |
| C-07 | Stage 0 pending vs accepted | Resolved | `Verified` (text) / `Owner-Confirmed` (event) | ditto |
| C-08 | `sessions.json` classification | Resolved | **`Verified` — now fully answerable** | `session.service.ts:19` declares `store`; **no other reference to `store` exists in the file**; the JSON layer is dead |
| C-09 | Attachment path | Resolved | `Verified` | `paths.ts:5` (`storageDir = <cwd>/storage`), `file-storage.ts:18` (`join(storageDir,'documents')`), `bootstrap.ts:9` creates it → `apps/api/storage/documents` |
| C-10 | Duplicate entity rows | Resolved | `Historical` | Requires the pre-edit document to verify; not in Git |
| C-11 | Required fields in D6 design | Resolved | `Unknown` (residual) | No schema-level proof of required source fields exists |
| C-12 | Deterministic ID uniqueness | Resolved | `Unknown` (residual) | Composite uniqueness never proven |
| C-13 | Extension superuser claim | Resolved | `Inferred` | PostgreSQL trusted-extension behaviour; not exercised here |
| C-14 | `search_path` targeting | Resolved | `Unknown` | No session-level evidence |
| C-15 | D8 status in Stage 2 | Resolved | `Verified` (text) | Sections updated |
| C-16 | "Prerequisite for almost everything" | Resolved | `Verified` (text) | Corrected wording present |
| C-17 | Contracts attributed to conflict markers | Resolved | `Verified` (text) | Corrected wording present |
| C-18 | Stale "execution timing deferred" | Resolved | `Verified` (text) | Corrected wording present |
| C-19 | Stale "deferred"/"pending acceptance" | Resolved | `Verified` (text) | Corrected wording present |
| C-20 | Stale status line | Resolved | `Verified` (text) | Status line reads `OWNER APPROVED (DESIGN ONLY, 2026-10-29)` |
| C-21 | Unconditional required-field implication | Resolved | `Verified` (text) | Corrected wording present |

### 13.1 Net effect

- **11 of 21** are genuinely closed at the text level (`Verified`).
- **5** (`C-01`, `C-03`, `C-04`, `C-06`, `C-07`, `C-15` events) rest on asserted history —
  `Owner-Confirmed`, appropriately so, but they must not be cited as `Verified` in any future
  artefact.
- **3** (`C-11`, `C-12`, `C-14`) remain substantively `Unknown`. Their "Resolved" status means
  "the document no longer over-claims", which is correct — but the underlying facts are still absent
  and are prerequisites for D6.
- **1** (`C-08`) is now **upgraded from `Unknown` to `Verified`** by this review, because the source
  answers the question the corpus left open. This is the only upgrade in this report, and it moves
  in the direction of *less* uncertainty, never more.

### 13.2 Contradictions this review adds

| ID | Contradiction | Evidence |
|---|---|---|
| C-22 | Adapter total 65 vs actual 68 | §10.2, F-14 |
| C-23 | `project_members` vs `project_memberships`; `stock_transactions` vs `stock_movements` | F-18 |
| C-24 | `auth.ts:20-24` says `req.user.permissions` is never consulted; `import.routes.ts:381,396` consult it | §8.3 |
| C-25 | `errors.ts:5-6` says 4xx is data; `client.ts:42` throws on 4xx | F-15 |
| C-26 | `projectScope.ts:6-12` "ONLY place" vs four routes that bypass it | F-20 |
| C-27 | D6 described as "JSON → PostgreSQL migration" vs runtime already PostgreSQL with a dead JSON path | F-16 |
| C-28 | Owner Acceptance condition 10 assumes `pg_dump` capability; no such capability exists | F-02 |

---

## 14. Authorization Audit — What This Review Did and Did Not Do

This section exists because the distinction between *documentary approval* and *execution
authorization* is the single most load-bearing rule of Phase 12.

| Action class | Authorized | Executed | Evidence |
|---|---|---|---|
| Read repository files | Yes | Yes | all citations in this report |
| Read Git metadata (`branch`, `HEAD`, `status`, `remote`) | Yes | Yes | §3 |
| Static trace of call paths | Yes | Yes | §5-§10 |
| Create one new Markdown file | Yes | Yes | this file, sole write |
| Modify existing code/SQL/docs | No | No | no file touched |
| Run typecheck / build / tests | No | No | no process started |
| Execute SQL / connect to a DB | No | No | no connection |
| Production access | No | No | none |
| Read secrets / `.env` | No | No | none |
| Change env, services, system settings | No | No | none |
| Install tooling | No | No | none |
| Git write | No | No | none |
| Deploy | No | No | none |
| D5 / D6 / D7 / Stage 3 / Phase 13 | No | No | none |

**Integrity note.** The working tree already contained 24 uncommitted modifications when this review
began. This review did not create, revert, or stage any of them. The only artefact produced is this
report. Because `docs/` is untracked, even this file's addition is invisible to `git status` as a
tracked change — a fact the owner should be aware of when auditing what changed.

---

## 15. Evidence Gaps and Unknowns

| # | Gap | Why it matters | Closing action | Status |
|---|---|---|---|---|
| U-1 | PostgreSQL 18 never exercised | Operating target untested | Provision isolated PG 18 | `Not Authorized` / `ENVIRONMENT_BLOCKED` |
| U-2 | Production PostgreSQL version, dataset size, applied migrations | Migration risk unquantified | Authorized read-only assessment | `Not Authorized` |
| U-3 | Production CORS configuration | Reflection risk unassessable | Read-only assessment | `Not Authorized` |
| U-4 | Effective `search_path` in test sessions (C-14) | DDL targeting unproven | Session-level capture | `Not Authorized` |
| U-5 | Extension availability on target server (C-13) | Migration 001 may fail | Runtime check | `Not Authorized` |
| U-6 | Required source fields for D6 (C-11) | Quarantine rules cannot be written | Schema verification | `Unknown` |
| U-7 | Composite uniqueness for deterministic IDs (C-12) | ID strategy unproven | Constraint inspection | `Unknown` |
| U-8 | `excelService.preview()` response envelope | Import preview contract incomplete | Read the service | `Unknown` (documented as open) |
| U-9 | Identity of the 2026-11-01 test service | Provenance of the only successful run | Metadata no longer sufficient | `Unknown` |
| U-10 | Whether any external tool reads the dead JSON files | Deletion safety | Grep + owner confirmation | `Unknown` |
| U-11 | Actual production role→user assignment | Severity calibration of G-01/G-04/G-08 | Read-only query | `Not Authorized` |
| U-12 | Typecheck/test state of the current working tree | D4 "green" is `Historical` | Run typecheck | `Not Authorized` |
| U-13 | `import_history` database-level immutability | Corpus correctly no longer claims it; enforcement unproven | Trigger/grant inspection | `Unknown` |
| U-14 | Whether the `phase-12.zip` artefact (113,458 B) contains evidence not in the tree | Possible missing input | Owner decision to open | `Unknown` |

---

## 16. Exit-Criteria Traceability

Against Owner Acceptance Record §7 (conditions for a future owner decision):

| # | Condition | Status | Basis |
|---|---|---|---|
| 1 | Isolated PG 18 environment | **Not met** | `0xC0000142` reproduced |
| 2 | Repeat dry run on PG 18 | **Not met** | blocked by 1 |
| 3 | D4 repair + green typecheck | **`Historical`** (2026-10-29) | not re-run — `Not Authorized` |
| 4 | Contract map finalized | **Substantially met, 3 errors** | §10.2, F-14 |
| 5 | D5 secret handling plan | **Not met** | `Not Authorized` |
| 6 | D6 field mapping + idempotency proof | **Not met** | scope itself is mis-stated (F-16) |
| 7 | D7 adapter design | **Not met** | transport cannot authenticate (F-15) |
| 8 | Production baseline | **Not met** | U-2, U-3, U-4 |
| 9 | Pre-migration validation queries | **Not met** | `Not Authorized` |
| 10 | Backup/snapshot `pg_dump` + restore test | **Not met — capability absent** | F-02 |
| 11 | Rollback/recovery tested | **Not met — no mechanism** | F-02, F-17 |
| 12 | Session-revocation communication plan | **Not met** | `Not Authorized` |
| 13 | Owner approval at each gate | **Partial** | Phase 12 remains OPEN |
| 14 | Stage 3 entry criteria | **Not met** | depends on 1-12 |
| 15 | Phase 13 chartering | **Not Authorized** | blocked |

**Score: 1 substantially met (with 3 corrected errors), 1 historical, 13 not met.**

Conditions 10 and 11 deserve emphasis: they are not "pending paperwork". They describe a technical
capability that the codebase does not possess. No amount of documentation will close them; only
implementation plus a verified dry run will.

---

## 17. Risk Assessment and Owner Decisions Required

### 17.1 Risk ranking

| Rank | Risk | Likelihood | Impact | Finding |
|---|---|---|---|---|
| 1 | Destructive migration executed with no recoverable backup | Medium | Catastrophic | F-02, F-17 |
| 2 | Partial import leaves unauditable data state | Medium | High | F-13 |
| 3 | Cross-project data exposure via export/financials/links | High | High | F-07, F-08, F-09 |
| 4 | Cross-user notification state mutation | High | Medium-High | F-05 |
| 5 | Memory exhaustion via unbounded import upload | Medium | High | F-12 |
| 6 | Unbounded audit read degrades the service | High over time | Medium | F-10 |
| 7 | Migration plan built on a non-functional script | Medium | High | F-01 |
| 8 | Architecture direction ambiguous at closure | High | Medium | F-19 |

### 17.2 Decisions the owner must make before Phase 12 can close

| # | Decision | Blocks |
|---|---|---|
| D-A | Is database backup/restore in Phase 12 scope, or is the risk accepted in writing? | F-02, conditions 10/11 |
| D-B | Repair or retire `data-migration.ts`? | F-01 |
| D-C | Import confirm: atomic or explicitly-partial-with-ledger? | F-13 |
| D-D | Notification recipient model: schema change now or documented deferral? | F-05 |
| D-E | Which naming survives: `project_members`/`stock_transactions` or the target names? | F-18 |
| D-F | Superseding instruction for D1 (Option A scope vs Option B direction)? | F-19 |
| D-G | D6 scope restatement ("delete dead JSON path + fix Postgres reads") acceptable? | F-16 |
| D-H | Authorize read-only production assessment to close U-2/U-3/U-11? | §15 |
| D-I | Provision isolated PG 18 (VM/host/container) to close U-1/U-5? | conditions 1/2 |

Each of these is a **decision**, not a task. None is authorized by this report.

---

## 18. Final Phase 12 Status and Recommendation

**Verdict (single, final):**

> ## `BLOCKED — ADDITIONAL EVIDENCE REQUIRED — PHASE 12 REMAINS OPEN`

**Phase 12 status:** **OPEN**.

**Why `BLOCKED` rather than `READY FOR OWNER REVIEW`.** The documentation layer is genuinely close to
final, and eleven of twenty-one historical contradictions are properly closed. But the exit criteria
are not documentation criteria — they are capability criteria, and two of them describe a capability
the codebase does not have. Specifically:

1. **No database backup or restore exists** (F-02). Conditions 10 and 11 cannot be satisfied by any
   amount of further reading. This alone is sufficient for `BLOCKED`.
2. **The only migration asset in the repository is non-functional and fails silently** (F-01).
3. **The operating PostgreSQL major version has never been exercised**, and the one successful run is
   `Historical` on a different major (Workstream H).
4. **Four high-severity API gaps remain live in code**, confirmed line-by-line, including a
   cross-project export and an unscoped financials query (F-07, F-08, F-09).
5. **The architecture direction is recorded two ways** with no superseding artefact (F-19).

**What is explicitly NOT claimed by this report:**

- Phase 12 is **not** complete.
- Phase 13 is **not** recommended.
- Stage 3 is **not** authorized.
- D5, D6, D7 are **not** authorized.
- No production fact is asserted.
- No `Inferred` item has been promoted.

**Recommended next action (for the owner, not for execution now):**

1. Rule on decisions `D-A` … `D-I` in §17.2. `D-A` is the gating one.
2. Correct the three adapter-count errors and the seven new contradictions (C-22 … C-28) in the
   contract map — a documentation-only correction, cheap and unambiguous.
3. Either file a dated D1 instruction or downgrade D-SPEC-15's claim from "preserved conflict" to
   "unresolved divergence".
4. Commission a separate, explicitly authorized remediation task for F-01, F-02, and F-13. These are
   code changes; they are outside this review's envelope and outside Phase 12's documentary scope.

Until `D-A` is answered, Phase 12 **cannot** close, because the system has no recoverable state and
two of its exit conditions are therefore unsatisfiable.

---

**End of report.**
**No file other than this one was created or modified. No command executed beyond read-only
inspection. No database contacted. No Git write performed.**
