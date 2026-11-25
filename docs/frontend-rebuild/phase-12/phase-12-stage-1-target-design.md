# Phase 12 — Stage 1: Target Design (Documentation Only)

Status: **STAGE 1 DESIGN — OWNER APPROVED (DESIGN ONLY, 2026-10-29). DO NOT START STAGE 2 OR PHASE 13 WITHOUT ENTRY CONDITIONS AND APPROVALS.**
Baseline: branch `main`, HEAD `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf`, October 2026.
Companion docs: A (`phase-12-separation-migration-architecture-report.md`), B (`phase-12-data-migration-matrix.md`), C (`phase-12-api-auth-permissions-map.md`), D (`phase-12-migration-validation-rollback-plan.md`), E (`phase-12-owner-decision-record.md`), plus Stage 0 inventory (chat-only, 2026-10-29).

**Language note:** technical body in English (see doc A header); this document follows the same convention.

**Evidence labels (per project convention):** `Verified` = file/code/SQL proof · `Inferred` = engineering deduction with named sources · `Proposed` = unimplemented design · `Unknown` = could not be verified now · `Recorded Owner Decision` = decision recorded in doc E.

**Scope:** documentation only. No application source, tests, database, migration, schema, secret, configuration, deployment, or Git state was changed to produce this document. Stage 1 is not implementation authorization.

---

## 0. Recorded Owner Decisions (Preserved Verbatim)

These decisions are recorded in doc E and are not reinterpreted, expanded, or silently changed by this document.

**Stage 0 status:** repository-only inventory accepted (read-only; production facts remain Unknown). **D8:** final owner approval recorded 2026-10-29. Subsequent stages remain subject to their own entry conditions, approvals, and validation gates; D6 and D7 execution is not automatically authorized.

| Decision | Recorded status | Restriction preserved |
|---|---|---|
| D1 — Architecture | Option B — logical separation with selective reuse (Recorded Owner Decision) | Not execution authorization; does not approve source repair, DB changes, data migration, adapter implementation, namespace changes, or Phase 13 |
| D2 — Database topology | Topology option 1 — reuse the existing PostgreSQL database (Recorded Owner Decision) | Establishes intended topology only; does not authorize DDL, data migration, production changes, or automatic session invalidation |
| D3 — API namespace | Defer final policy until prototype-to-live-API contract map is complete; keep `/api/` (Recorded Owner Decision) | No route edits, API implementation, permission change, or Phase 13 work |
| D4 — Conflict-marker repair | Separate, narrowly scoped repair task approved and **executed (2026-10-29)**; 18 files repaired, 21 blocks resolved, `npm run typecheck` exited 0 (Recorded Owner Decision) | Repair must complete and `npm run typecheck` exit 0 before Stage 2; task approval does not approve D6 migration or Phase 13 (satisfied 2026-10-29) |
| D5 — `.jwt-secret` handling | Safe plan preparation approved; movement/rotation deferred (Recorded Owner Decision) | No secret operation, configuration change, rotation, or session invalidation authorized now |
| D6 — Audit/notifications migration | Separate JSON→PostgreSQL task approved; execution gated (Recorded Owner Decision) | No immediate database change or JSON deletion; subject to applicable stage gates (entry conditions, validation, required owner approvals). D8 is already finally approved (2026-10-29); D6 execution is not automatically authorized. |
| D7 — HTTP adapter | Standalone task approved; implementation gated (Recorded Owner Decision) | No new namespace, permission changes, backend repair bundling, or Phase 13 |
| D8 — Migration plan | Final approval recorded 2026-10-29 (Recorded Owner Decision) | Not permission to skip any stage gate; Stage 0 inventory accepted (repository-only); production facts remain Unknown. |

Stage 0 was accepted as a repository-only, read-only inventory. Production facts remain `Unknown` where authorized production evidence is unavailable.

---

## 1. Target Architecture and Boundaries (Option B)

### 1.1 Selective-reuse intent (Recorded Owner Decision D1)

Option B is **logical separation with selective reuse**. The new frontend is a separate client that communicates with the existing API over HTTP; the backend remains the single authoritative source of business rules, permissions, and data. Separation happens at the **contract boundary** (HTTP adapter), not by duplicating the backend.

### 1.2 Components intended for reuse (Verified / Inferred)

| Component | Location | Reuse verdict | Evidence |
|---|---|---|---|
| Express app / server bootstrap | `apps/api/src/app.ts`, `server.ts` | Reuse as-is (with conflict-marker repair prerequisite) | Verified — single process, listens on `PORT ?? 4001`, `trust proxy = 1`, serves `/api` + SPA fallback |
| Routes & controllers | `modules/*/routes.ts` (18 files) | Reuse with adaptation (depends on finalized contract map) | Verified — mounts in `routes/index.ts`; namespace choice undecided (D3) |
| Business logic in services | `services/*` (auth, authorization, projectScope, stock, smart-import, …) | Reuse as-is | Verified — `authorization.service.ts` is the latest architecture in the codebase |
| Repositories (PG) | 14 of 16 under `repositories/*.repository.ts` | Reuse as-is | Verified — extend `PgBaseRepository`, query `pool` directly |
| Repositories (file) | `audit-log.repository.ts`, `notification.repository.ts` | Proposed remediation to migrate to Postgres (D6) | Verified — file-backed exceptions; applies under A, B, and C alike |
| Shared permission vocabulary | `packages/shared/src/permissions.ts` | Reuse as-is | Verified — 28 legacy + 3 admin keys = 31 keys; unknown keys deny by default |
| JSON data layer | `data/*.json` | Verify per file; no blanket retirement | Verified — see §2 |
| `.jwt-secret` | `data/.jwt-secret` | Move to secrets store + rotation (Proposed) | Verified path exists; resolution order in `auth.service.ts:15-23` |
| Files on disk | `apps/api/storage/documents/**` | Untouched by this study; independent of SQL migration | Verified — different directories |
| Conflict-marker damage | 18 files | Separate owner-approved repair task (D4), **executed 2026-10-29** | Verified — TS1185 at Stage 0 baseline (2026-10-29); repaired under D4; prerequisite for Stage 2 and other paths specifically gated by D4 (migration scripts, D6/D7 execution). Does not block independent read-only analysis, documentation, or design preparation. |

### 1.3 How the new frontend communicates with the existing API (Proposed — D7)

- The new UI (prototype in `docs/frontend-rebuild/phase-03-prototype/`) is **mock-only** today (Verified indirectly, Phase 11 limitation).
- A standalone **HTTP adapter** is approved (D7) to be built **against the current API as-is first** (cookie/session contract per doc C), before any boundary changes.
- The adapter must follow the auth/transport contract boundaries in doc C: `Authorization: Bearer` OR HttpOnly cookie `cos_access` (two transports of one short-lived token); JWT payload `{ sub, sid }`; role/permission/active state re-resolved server-side per request.
- The adapter has **not** been implemented. Implementation is gated by the finalized contract map and applicable approvals.
- Current `/api/` routes are preserved (D3). No new namespace is approved now.

### 1.4 Rules that remain backend-enforced (Verified)

- All permission enforcement stays server-side in `middleware/auth.ts` depending on `authorization.service.can()` (doc C §5, Server-side Enforcement Note).
- Project scoping is resolved from the **database row** (IDOR-safe) in `projectScope.ts`; client-supplied projectIds feed deny-by-default checks.
- Token payload carries only `{ sub, sid }` — role/permission/active state is **never** trusted from the token; re-resolved per request (`middleware/auth.ts:70-83`).
- Unknown permission keys deny by default (`authorization.service.ts:79,83`).

### 1.5 Logical separation vs. shared (Proposed boundaries)

| Boundary | Shared (reuse) | Separated (contract boundary) |
|---|---|---|
| Identity / users / roles | Existing `users`/`roles`/`sessions` tables in reused PG DB | New UI consumes via HTTP; no second identity chain |
| Permission vocabulary | `packages/shared/src/permissions.ts` (31 keys) | UI hides actions only; enforcement stays server-side |
| Business rules | Services in `apps/api/src/services/*` | New UI must not invent frontend-only rules |
| Data store | Existing PostgreSQL database (D2) | New UI accesses data only through the API |
| Contract | Current `/api/**` routes (D3) | Adapter maps UI calls to existing endpoints; no new namespace without Owner decision |

### 1.6 Preventing duplicated business logic (Proposed)

- The new UI must call the existing API endpoints; it must not reimplement validation, permission checks, or state transitions client-side.
- Any new permission key must be added upstream (`shared/src/permissions.ts`) and enforced server-side in `authorization.service.ts`, never only in UI (doc C §5).
- Semantic deltas become explicit extension points only when proven by the finalized contract map; until then, no frontend-only rule is authorized.

### 1.7 Explicit non-authorization statement

Selecting Option B and reusing the existing PostgreSQL database (D1, D2) **do not** authorize implementation. They establish direction only. No source repair, database change, data migration, adapter implementation, namespace change, or Phase 13 work is authorized by this design document.

---

## 2. Entity and Data-Store Target Matrix

### 2.1 Source evidence basis

- Runtime store: PostgreSQL for the operational core (Verified — 14 of 16 repos extend `PgBaseRepository`; sessions written to `sessions` table via `session.service.ts:58-70`).
- JSON layer: bootstrap/legacy, with two file-backed exceptions (`audit_logs`, `notifications`) — Verified.
- Schema source: `001_initial_schema.sql` + migrations 05–21 (Verified in repo; production applied state Unknown).
- Migration runner: `migrate.ts` (Verified — reads `migrations/*.sql` sorted by `localeCompare`, applies in transaction, tracks in `_migrations`).
- Migration files: 19 top-level (Verified); duplicate `11_modernize_dms.sql` ≡ `18_modernize_dms.sql` (Verified).

### 2.2 Entity matrix

| Entity / Store | Current runtime store (Verified) | Proposed target store | Data movement? | Evidence | Confidence | Validation required | Unresolved dependencies |
|---|---|---|---|---|---|---|---|
| users | PostgreSQL `users` (`user.repository.ts:7`) | Same (reuse existing DB, D2) | None (reuse) | Verified | Verified | Role×permission matrix diff (doc C §4) | Production dataset size Unknown |
| roles | PostgreSQL `roles` | Same | None | Verified | Verified | Seed matrix (19_authz_rebuild.sql:46-77) | Custom roles in production Unknown |
| sessions | PostgreSQL `sessions` (`session.service.ts:58-70`) | Same | None by default (D2 does not require moving/resetting rows) | Verified | Verified | Session row policy per D2 (preserve/migrate/invalidate — explicit, not default) | Production secret source Unknown; hash portability Unknown |
| projects | PostgreSQL `projects` | Same | None | Verified | Verified | counts + FK | Migration 21 direct amounts |
| sites | PostgreSQL `sites` | Same | None | Verified | Verified | counts + FK | — |
| documents / revisions / links / folders | PostgreSQL DMS tables (migrations 11/12/18) | Same | None | Verified | Verified | `file_path` existence; polymorphic `entity_id` orphan check | Legacy migration paths (08/09/11) |
| warehouses | PostgreSQL | Same | None | Verified | Verified | counts | — |
| items | PostgreSQL | Same | None | Verified | Verified | counts | — |
| stock_transactions (+lines) | PostgreSQL | Same | None | Verified | Verified | NUMERIC(15,3) precision spot-check | — |
| material_requests (+lines) | PostgreSQL (material_requests + material_request_lines) | Same | None (or Transform-candidate if consolidating JSONB `items` with lines) | Verified shape; consolidation Proposed | Verified shape / Proposed consolidation | Consistency iteration in Stage 1 | Consolidation decision not yet made |
| boq_items | PostgreSQL (migration 05) | Same | None | Verified | Verified | counts | — |
| ipcs (+items) | PostgreSQL (migration 05, 16, 21) | Same | None | Verified | Verified | `ipc_number` INTEGER preserve; net/gross amounts (migration 21) | — |
| categories | PostgreSQL (`config.repository.ts:4`) | Same | None | Verified | Verified | Arabic canonical set (migration 09) | Production application of migration 09 Unknown |
| units | PostgreSQL (`config.repository.ts:23`) | Same | None | Verified | Verified | counts | — |
| counters | PostgreSQL | Same | None (copy values verbatim) | Verified | Verified | count + value spot-check | Production state Unknown |
| user_permission_overrides | PostgreSQL | Same | None | Verified | Verified | PK `(user_id, permission_key)` | — |
| project_members | PostgreSQL | Same | None | Verified | Verified | PK `(project_id, user_id)` | — |
| audit_logs (JSON → PG) | File-backed (`audit-log.repository.ts:7`) | PostgreSQL `audit_logs` (exists in schema, `001_initial_schema.sql:287`) | **Transform** (D6 — approved task, gated) | Verified (repo + schema) | Verified store; Proposed mapping | Field mapping, timestamps, actors, `read_by`, historical preservation, recovery/rollback | See §3 |
| notifications (JSON → PG) | File-backed (`notification.repository.ts:7`) | PostgreSQL `notifications` (exists in schema, `001_initial_schema.sql:304`) | **Transform** (D6 — approved task, gated) | Verified (repo + schema) | Verified store; Proposed mapping | Field mapping, timestamps, `read_by` membership, recovery | See §3 |
| import_history (PG) | PostgreSQL (`import-history.repository.ts:7,9`) | Same | None (Direct Copy) | Verified | Verified | counts | — |
| import_history (JSON legacy) | Bootstrap/legacy artifact | Historical/Read-only (no automatic production migration) | None | Verified (bootstrap creates empty; PG is runtime) | Verified | — | Content delta vs PG Unknown |
| `data/.jwt-secret` | Filesystem (secret) | Secrets store (Proposed) | Physical relocation only (not data migration) | Verified path | Verified path; Proposed relocation | Secret-presence check (existence only) | Production secret source Unknown |
| `apps/api/storage/documents/**` | Filesystem | Same (path preserved; no movement proposed by default) | None by default — no attachment movement is proposed. Any later relocation requires a separately scoped, validated, owner-approved task. | Verified | Verified | File count + size + sha256 sample (Stage 0: 193 files / 402,424,237 B) | Production size Unknown |
| `backup/**`, `temp/**` | Filesystem | Historical/Read-only | None | Verified | Verified | — | Not in operational migration scope |

### 2.3 `data/*.json` per-file classification

| File | Classification | Runtime store | Evidence |
|---|---|---|---|
| audit_logs.json | **Proven runtime file-backed store** (written by ordinary runtime) | File (`BaseRepository`) | Verified — `audit-log.repository.ts:7` extends `BaseRepository` → `JsonStore.write` |
| notifications.json | **Proven runtime file-backed store** (written by ordinary runtime) | File (`BaseRepository`) | Verified — `notification.repository.ts:7` |
| categories.json | Bootstrap/seed artifact | PostgreSQL (`config.repository.ts:4`) | Verified — `bootstrap.ts:33` seeds if absent; `data-migration.ts` loads; PG is runtime |
| units.json | Bootstrap/seed artifact | PostgreSQL (`config.repository.ts:23`) | Verified — `bootstrap.ts:34` seeds if absent |
| counters.json | Bootstrap artifact | PostgreSQL (`counters`) | Verified — `bootstrap.ts:32` creates empty if absent; `data-migration.ts` loads |
| documents.json | Bootstrap artifact | PostgreSQL (DMS tables) | Verified — `bootstrap.ts:24` creates empty if absent; `data-migration.ts` loads |
| projects.json | Bootstrap artifact | PostgreSQL (`projects`) | Verified — `bootstrap.ts:22` |
| sites.json | Bootstrap artifact (`[]`) | PostgreSQL (`sites`) | Verified — `bootstrap.ts:23` |
| warehouses.json | Bootstrap artifact | PostgreSQL (`warehouses`) | Verified — `bootstrap.ts:25` |
| items.json | Bootstrap artifact | PostgreSQL (`items`) | Verified — `bootstrap.ts:26` |
| stock_transactions.json | Bootstrap artifact | PostgreSQL (`stock_transactions`) | Verified — `bootstrap.ts:27` |
| material_requests.json | Bootstrap artifact (empty if absent; current file has 1 pre-existing record — see note) | PostgreSQL (`material_requests` + lines) | Verified — `bootstrap.ts:28`; **not** referenced in `data-migration.ts` |
| import_history.json | Bootstrap artifact (`[]`) | PostgreSQL (`import_history`, `import-history.repository.ts:7,9`) | Verified — `bootstrap.ts:31`; PG is runtime |
| roles.json | Seed artifact | PostgreSQL (`roles`) | Verified — `seed-users.ts` writes if absent |
| users.json | Seed artifact | PostgreSQL (`users`) | Verified — `seed-users.ts` writes if absent; `data-migration.ts` loads |
| sessions.json | **Unknown — runtime dependency not fully established** | PostgreSQL (`sessions`) | Inferred — `session.service.ts:19` instantiates `JsonStore` but the inspected methods use `pool.query` (PG writes); whether `store` is invoked elsewhere = **Unknown**; not auto-created by bootstrap. No deletion, relocation, or read-only conversion is authorized. |
| .jwt-secret | Secret material | Secrets handling (Proposed) | Verified — `auth.service.ts:15-23`; value never recorded |

**Note on `material_requests.json` (1 record vs empty bootstrap):** `ensureJsonFile` (bootstrap.ts:14-19) creates the file with `[]` **only if it does not already exist** (`if (!existsSync(filePath))`). The current file's single record is **pre-existing content** that bootstrap left untouched. No repository code references `material_requests.json` at runtime (source search: only `bootstrap.ts`). Whether any runtime code reads/writes it = **Unknown** (no evidence found).

**General rule (Proposed):** no JSON file is classified as disposable. Each file's runtime dependency must be proven individually; unresolved dependencies remain `Unknown`. No blanket retirement or read-only conversion is recommended without file-specific evidence and separate approval.

### 2.4 Conditional applicability (preserved from doc B §3)

The classifications above are a preliminary plan for a target system/database under the target-schema assumptions in doc B §3. They are **not** a universal instruction to migrate data under every architecture option. Distinguish: (1) reuse the existing database without moving the corresponding data; (2) move data to a separate database with an equivalent schema; (3) migrate into a redesigned schema whose semantics and relationships may differ. Where the target schema is not finalized, the classification is conditional or `Undetermined`.

---

## 3. Audit Logs and Notifications Migration Design (D6 — Proposed, not executed)

### 3.1 Source and target stores (Verified)

| Aspect | audit_logs | notifications |
|---|---|---|
| Source store | JSON file (`audit-log.repository.ts:7` → `BaseRepository` → `JsonStore<AuditLog>`) | JSON file (`notification.repository.ts:7`) |
| Target table | PostgreSQL `audit_logs` (`001_initial_schema.sql:287`) | PostgreSQL `notifications` (`001_initial_schema.sql:304`) |
| Table exists in schema? | **Verified** (schema reference) | **Verified** (schema reference) |
| Runtime repo writes to? | File (today) | File (today) |
| Approval status | D6 approved as separate task; execution gated (Recorded Owner Decision) | Same |

### 3.2 Source-to-target field mapping

Mapping precedent exists at `data-migration.ts:122-131` (generic one-shot JSON→PG loader, single transaction). However, that precedent **does not prove** audit-log/notification migration is lossless or semantically unchanged.

| Source field (JSON shape) | Target column (PG shape) | Status |
|---|---|---|
| `userId` | `user_id` | Proposed — mapping convention from `data-migration.ts:122-131`; field names in actual JSON not exhaustively diffed. **Not treated as required** unless the actual source and target schemas prove it. |
| `timestamp` | `created_at` | Proposed — same convention; timestamp preservation must be verified. **Not treated as required** unless the actual source and target schemas prove it. |
| camelCase payload fields | snake_case columns | Proposed — requires explicit field-by-field mapping |
| actor / username | actor identity columns | **Unknown** — whether existing audit entries populate enough before/after state (old/new values) for reconciliation |
| `read_by` (notifications) | `read_by` membership | **Unknown/Proposed** — membership and historical read-state preservation require validated design |
| notification payload body | notification columns | Proposed — field mapping not finalized |

**Rule:** if any source-to-target field mapping cannot be proven, it is marked `Unknown` or `Proposed` and the required evidence is listed. No invented fields or columns.

Validation and quarantine criteria must be derived from verified source fields, verified target constraints, and an approved handling policy. Fields are not assumed required unless the actual source and target schemas prove it (`Unknown`/`Proposed` labels preserved where evidence is incomplete).

### 3.3 Deterministic ID and duplicate-prevention strategy (Proposed)

- **Deterministic ID (Proposed):** proposed to use a stable source identifier or a deterministic source-record mapping appropriate to the approved immutable input snapshot. The composite `(userId, timestamp, action, entity)` is **not** assumed unique without evidence. If source records lack stable IDs, assign new IDs and record a source→target mapping table for reconciliation. This approach remains **Proposed** until source identifiers and actual target uniqueness constraints are verified. **Unknown** whether source audit/notification records have stable IDs — must be verified.
- **Duplicate prevention:** unique constraint on the deterministic ID (or a composite unique key) in the target table; insert with `ON CONFLICT DO NOTHING` or equivalent; verify zero duplicate rows in Stage 3.
- **A transaction alone does not prove idempotency.** Idempotency must be demonstrated by: (a) re-running the transformation on an already-populated target and confirming zero duplicate rows and zero data loss; (b) controlled failure (interrupt mid-run) and recovery without duplication; (c) stable unique keys verified against the actual target schema constraints.

### 3.4 Malformed / missing / inconsistent records (Proposed)

- Validate each source record against a defined schema (zod or equivalent) before insert.
- Records missing fields that are verified as required (or violating approved validation rules) → quarantine to a documented reject file/list; do not silently drop; count and report. Fields are not assumed required unless the actual source and target schemas prove it (Unknown/Proposed where evidence is incomplete).
- Inconsistent timestamps (future dates, unparseable) → normalize or quarantine per validated rule; document the rule.
- Orphaned actor references (user deleted) → preserve the record with a null/unknown actor marker, or quarantine; decision requires Owner approval.
- Malformed JSON → preserve the corrupt file (per `JsonStore` behavior) and halt; do not overwrite.

### 3.5 Record-count reconciliation and field-level validation (Proposed)

- Compare source JSON record count with target table row count; explain every delta (quarantined, deduplicated, or transformed).
- Spot-check ~10 rows (Owner-approved sample) for field-level correctness.
- Verify `read_by` membership for notifications (each member exists in `users`).
- Verify timestamp preservation and actor identity integrity.

### 3.6 Safe failure and restart behavior (Proposed)

- Run inside a single transaction (BEGIN/COMMIT) per batch, with ROLLBACK on failure.
- Track progress in a durable way (e.g., a `_migration_progress` marker or idempotent re-run) so a failed run can resume without duplication.
- On failure: preserve source files (no deletion), preserve any partial target state for inspection, produce a per-run report (duration, counts, transform errors).
- Do not delete source JSON files until the conversion is verified and an explicit Owner-approved cleanup step is authorized.

### 3.7 Writer-switch procedure (Proposed — one authoritative writer)

1. Freeze writes to `audit_log.json` / `notifications.json` (application-level gate, not file deletion).
2. Run the final transformation and reconcile the delta.
3. Switch the repository implementation from `BaseRepository` (file) to a PG-backed repository.
4. Verify no further writes reach the two JSON files (runtime assertion).
5. Any repository/code change remains subject to D8 gates and applicable stage approvals.
6. Do not declare all legacy components read-only by assumption; identify the authoritative writer per affected record/domain.

**No dual writes.** Unmanaged dual writes silently fork the source of truth and defeat rollback design (doc D §6).

### 3.8 Nullability, constraints, uniqueness, relationships (Verified/Unknown)

- Target columns `audit_logs` and `notifications` exist in `001_initial_schema.sql` (Verified — lines 287, 304). Their exact nullability, constraints, uniqueness, and FK relationships must be verified against the **actual applied schema** (Stage 0 evidence) — not assumed from the initial migration file, because migrations 19–21 may have altered them (Unknown).
- CHECK constraints and ENUM values must reflect the verified target schema and applied migration set, not be copied from `001_initial_schema.sql` without checking later changes.

---

## 4. HTTP Adapter Contract Design (D7 — Proposed, not implemented)

### 4.1 Adapter against current API (Proposed)

- Build the adapter against the current API **as-is first** (cookie/session contract per doc C), before any boundary changes.
- Preserve current `/api/` routes (D3). No new namespace (including `/api/v2/**`) is approved now.
- The adapter maps new-UI calls to existing endpoints; it does not invent endpoints or payload shapes.

### 4.2 Endpoint/method/request/response mappings (Proposed where reliably established)

Per-domain mapping follows doc A §4 (capability matrix) and doc C §2 (route mount inventory). The following are **Verified** as route mounts; per-endpoint HTTP method/request-shape exact enumeration is **Unknown** (route files were sampled, not exhaustively parsed). D4 repair is complete (2026-10-29), so active conflict markers no longer block parsing; exhaustive endpoint methods, request/response shapes, and the contract map remain incomplete/Unknown until separately documented.

| Domain | Route mount (Verified) | Adapter notes |
|---|---|---|
| Auth / Users / Roles | `/api/auth`, `/api/users`, `/api/roles` | Session cookie or Bearer; permission keys from shared vocabulary |
| Projects (+BOQ, +IPC) | `/api/projects` (+ `/boq`, `/ipc`) | Contract map incomplete (Unknown deltas) |
| Documents | `/api/documents` | Field/name differences not proven semantic |
| Folders | `/api/folders` | — |
| Warehouses | `/api/warehouses` | — |
| Items | `/api/items` | — |
| Stock | `/api/stock` | — |
| Sites | `/api/sites` | — |
| Material requests | `/api/material-requests` | Status lifecycle matches current CHECK list |
| Import | `/api/import` | — |
| Config | `/api/config` | — |
| Search / Notifications / Audit logs / Backups | `/api/search`, `/api/notifications`, `/api/audit-logs`, `/api/backups` (mounted via systemRouter at `/`) | — |
| Health | `GET /api/health` → `{ ok, db }` | Verified |

### 4.3 Authentication / session transport (Verified from doc C §3)

- Access token: JWT; carried via `Authorization: Bearer` OR HttpOnly cookie `cos_access` (two transports of one short-lived token).
- Token payload: `{ sub, sid }`. Role/permission/active state **never** trusted from token; re-resolved server-side per request.
- Sessions: DB-backed in `sessions` table; token stored as sha256 hash; refresh TTL 24h (or 30d with `rememberMe`).
- Session revocation: revoked/expired session, `userId` mismatch, or inactive user → 401.
- Password: bcryptjs.
- Legacy v2 tokens (without `sid`) are rejected (Verified, `middleware/auth.ts:74-75`). This is a verified rejection rule, not an authorization to invalidate all sessions. Any session invalidation policy requires a compatibility and impact assessment (D2, D5) before it is proposed or executed; no system-wide logout or mandatory re-login for every user is implied by this rule.

### 4.4 Server-side permission enforcement and project scoping (Verified)

- All enforcement server-side in `middleware/auth.ts` depending on `authorization.service.can()`.
- Project scoping resolved from the DB row (IDOR-safe) in `projectScope.ts`; client-supplied projectIds feed deny-by-default checks.
- Permission keys: 31 total (28 legacy + 3 admin). Unknown keys deny by default.

### 4.5 Adapter states to handle (Proposed)

- Loading, empty, error, retry, timeout, unauthorized (401/403), and forbidden (project-scope denial → 404-style hidden existence).
- Pagination, filtering, and data-shape handling where applicable (exact shapes **Unknown** pending contract map).

### 4.6 Frontend-to-API contract test cases (Proposed — required before acceptance)

- Auth: login, refresh, logout, expired-token refresh, invalid-token logout.
- Permission: viewer/technical/warehouse/management/admin role grants and explicit denials.
- Project scope: no-membership → hidden existence (404-style); membership levels READ/WRITE/DELETE.
- CRUD per domain for in-scope entities.
- Audit/notification writes reach PostgreSQL tables (post-D6) and no longer reach JSON files.
- Error handling: 401 → refresh/logout, 403 → forbidden, 5xx → retry.

### 4.7 Unresolved contracts (Unknown)

- Per-endpoint HTTP method/request-shape exact enumeration was not exhaustively diffed. D4 repair is complete (2026-10-29); conflict markers no longer block parsing. Full contract inventory (methods, request/response shapes) remains to be generated post-contract-map; exhaustive endpoint methods, request/response shapes, and the contract map remain incomplete/Unknown until separately documented.
- Any endpoint whose contract has not been exhaustively documented remains incomplete/Unknown. Do not invent endpoints or payload shapes.
- The final namespace decision remains deferred until the contract map is complete (D3).

---

## 5. Authentication, Authorization, and Sessions

### 5.1 Intended reuse boundary (Proposed)

- Reuse the existing identity store (`users`/`roles`/`sessions` in the existing PostgreSQL DB, D2) — subject to Stage-0 verification of production facts.
- Reuse the shared permission vocabulary (`packages/shared/src/permissions.ts`, 31 keys).
- Reuse bcrypt + JWT `sub+sid` + sessions + roles (hash portability within bcrypt — Inferred).

### 5.2 JWT signature validity vs. application validity (Verified — doc C §3)

- **JWT signature validity**: a token signed under the active signing secret remains cryptographically verifiable for as long as that secret is unchanged. Changing the signing secret makes all previously issued tokens fail signature verification (and thus be rejected) regardless of session state.
- **Application session validity**: server acceptance additionally requires the session/user checks (`middleware/auth.ts:74-83`): non-empty `sub`+`sid`, an existing session that is neither revoked nor expired, `session.userId === sub`, and an active user. A revoked or expired session invalidates the request even while its signature would still verify.
- **User activation and role/permission checks**: role base + DENY-over-GRANT overrides + project-access narrowing + active-user/known-key guard (`authorization.service.ts`).

### 5.3 Session policy (Proposed — explicit, not default)

- D2 reuses the current database and does not itself require moving or resetting session rows.
- If an independently approved change later affects session rows or signing-secret compatibility, evaluate explicitly: (a) preserve/migrate applicable rows after testing; (b) deliberately invalidate sessions if technically required and expressly approved; (c) another evidenced policy.
- **Do not infer a global session reset or one re-login per user as a default** from D2 or D5.
- Expired/revoked/invalid sessions must never be resurrected.
- Any planned invalidation requires an explicit impact statement and Owner approval.

### 5.4 Secret handling (D5 — Proposed, deferred)

- Secret resolution order (Verified, `auth.service.ts:15-23`): `JWT_SECRET` env variable takes priority; `data/.jwt-secret` file is used only as a fallback (auto-created when env absent). The file is a candidate signing secret, not necessarily the active one.
- Active production source = **Unknown**. Propagation/rotation behavior beyond source resolution is not verifiable from source alone.
- Owner approved preparing a safe secret-handling and rotation plan. Actual movement, configuration changes, and rotation are deferred pending production-source verification and login/session-impact assessment.
- Never copy the secret value into documents or reports.
- The plan must describe rollback/compatibility implications and obtain required approval before execution.

---

## 6. Migration Sequencing and Rollback (Proposed — for owner review)

### 6.1 Bounded implementation sequence (entry conditions, deliverables, gates)

| Stage | Entry condition | Deliverable | Success | Failure | Approver |
|---|---|---|---|---|---|
| 0 — Readiness & Source Inventory | Owner-approved; read-only environment | Final inventory | Complete, no gaps | Missing entity | Owner |
| 1 — Target Design | Stage 0 accepted | Target schema proposal | Owner approval | Unresolved ambiguity | Owner |
| 2 — Dry Run | D4 repair completed + `npm run typecheck` green; isolated data copy | Dry-run results | Stage 3 green | Any red check | Dev + Owner |
| 3 — Automated Validation | Stage 2 snapshot | Reconciliation matrix | Zero unexplained diff | Unexplained diff | Owner |
| 4 — Reconciliation & Acceptance | Stage 3 report | Formal sign-off | Owner signature | Open diffs | Owner |
| 5 — Scoped Transition / Cutover Design | Accepted scoped design + tested recovery proposal | Scoped transition plan | Owner accepts scope, recovery, criteria; separate production approval still required | Unclear writer ownership, unsafe rollback, or unresolved critical gap | Owner + responsible engineer |
| 6 — Post-Change Verification | Separately authorized transition completed | Verification report | Relevant suite green + manual scenarios + no unexplained diffs | Suite failures or unexpected JSON writes in converted repositories | Owner |

### 6.2 Prerequisites and gates

- **D4 is a prerequisite for Stage 2**: the separate repair task must be completed and `npm run typecheck` must exit 0 before any migration script runs. D4 repair executed (2026-10-29); `npm run typecheck` exited 0. D4's prerequisite for Stage 2 is satisfied. Task approval does not approve D6 migration, D7 adapter, or Phase 13.
- D6 transformation and the writer switch are gated by applicable stage approvals (entry conditions, validation, and required owner approvals). D8 is already finally approved (2026-10-29); D6 execution is not automatically authorized by D8.
- D7 adapter implementation is gated by contract-map completion and applicable approvals.
- Existing PostgreSQL reuse (D2) does not assume a database copy or blanket data migration; each changed repository/data flow requires its own tested recovery.
- Attachment preservation (`apps/api/storage/documents/**`) and external side effects (uploads, notifications) require their own recovery/reconciliation plan independent of database rollback. No attachment movement is proposed by default.
- Post-cutover writes require a designed and tested policy (replay / reconciliation / deliberate discard with explicit Owner approval / another proven recovery mechanism) before cutover can be approved.
- Snapshot limitations: restoring a pre-cutover snapshot does **not** preserve writes accepted afterward. Audit logs cannot be relied on for reversal until before/after information and operation coverage are verified (currently Unproven). File attachments need their own recovery plan. If no reliable rollback path exists, rollback is unsafe and blocks cutover approval.
- Prohibition on unapproved dual writes: only one system writes any given row at any given time. Any coexistence period requires an explicit fronted ownership matrix (future decision, not part of this plan).
- Owner approval required at each applicable gate. Stage 0 inventory accepted (repository-only); production facts remain Unknown and may still block final target-schema decisions or any stage requiring those facts.

### 6.3 Rollback requirements (Proposed)

- Distinguish app rollback (re-flip frontend/API pointer — safe if failure is purely frontend/API-level) from data rollback (does not revert data).
- A same-database topology does **not** make data rollback automatically safe.
- No general-purpose inverse migration exists or is designed here. If a reliable inverse path has not been designed, it must be stated before cutover approval.
- Required before cutover approval: (1) named recovery point; (2) explicit written decision for post-cutover writes; (3) recovery/reconciliation plan for file attachments and external side effects; (4) evidence that the audit trail captures the operations rollback depends on (currently Unproven). If no reliable rollback path exists, rollback is unsafe and blocks cutover approval.

---

## 7. Acceptance Criteria Table

### 7.1 Existing evidence and references

| Item | Source | Label |
|---|---|---|
| Backend store is PostgreSQL (14/16 repos) | `repositories/*.repository.ts`, `session.service.ts:58-70` | Verified |
| File-backed exceptions (audit, notifications) | `audit-log.repository.ts:7`, `notification.repository.ts:7` | Verified |
| Conflict markers (18 files, TS1185) | `apps/api/src/**` (18 files) | Verified |
| Migration files (19 top-level + 3 in `down/`) | `apps/api/src/database/migrations/` | Verified |
| Duplicate migrations (byte-identical) | `11_modernize_dms.sql` ≡ `18_modernize_dms.sql` (1,644 B) | Verified |
| Permission vocabulary (31 keys) | `packages/shared/src/permissions.ts`, `authorization.service.ts:23-28` | Verified |
| Auth/session model | `middleware/auth.ts:54-83`, `session.service.ts:22,45,58-70` | Verified |
| Secret resolution order | `auth.service.ts:15-23` | Verified |
| CORS behavior (unset → reflect origin) | `app.ts:23-31` | Verified (source); deployment Unknown |
| JSON file inventory (17 entries) | `apps/api/data/` (read-only parse) | Verified |
| Attachment/backup counts and sizes | `apps/api/storage/documents/**`, `backup/**`, `temp/**` | Verified |
| Capability matrix (phase-10 appendix A1–H1) | `docs/frontend-rebuild/phase-10/phase-10-cross-app-qa-report.md` | Referenced by path |
| Doc E decision ledger (D1–D8) | `phase-12-owner-decision-record.md` | Recorded Owner Decision |

### 7.2 Verified design decisions vs. proposed design choices

| Decision | Status | Label |
|---|---|---|
| Option B as architecture direction | Recorded Owner Decision (D1) | Recorded Owner Decision |
| Reuse existing PostgreSQL database | Recorded Owner Decision (D2) | Recorded Owner Decision |
| Defer namespace until contract map complete | Recorded Owner Decision (D3) | Recorded Owner Decision |
| D6 audit/notifications → PG migration task | Approved as separate task (Recorded Owner Decision, D6) | Recorded Owner Decision |
| D7 HTTP adapter task | Approved as separate task (Recorded Owner Decision, D7) | Recorded Owner Decision |
| D8 final approval of Doc D | Recorded (2026-10-29) | Recorded Owner Decision |
| Backend components for selective reuse | Proposed (based on Verified source) | Proposed |
| HTTP adapter against current API | Proposed (D7 approved; not implemented) | Proposed |
| Writer-switch procedure | Proposed | Proposed |
| Deterministic ID strategy for audit/notifications | Proposed (source IDs unverified) | Proposed |
| Idempotency claim for re-runs | Proposed (must be tested) | Proposed |

### 7.3 Exact unresolved questions and their impact

| Question | Impact |
|---|---|
| Production PostgreSQL version, applied migrations (19–21), dataset size | Blocks Stage 0 production baseline; affects Stage 1 target schema verification |
| Contract map (prototype ↔ live API) incomplete | Blocks D3 namespace decision and D7 adapter implementation; prevents proving semantic deltas |
| Per-endpoint HTTP method/request shapes (conflict markers) | Blocks adapter contract design; must be generated post-conflict-resolution |
| Active production JWT signing-secret source | Blocks D5 movement/rotation; affects session preservation policy |
| Whether `sessions.json` JsonStore is invoked at runtime | Affects leftover-file classification and cleanup scope |
| Whether counters/other bootstrap JSONs are read at runtime | Affects retirement scope |
| import_history.json vs PG table content delta | Affects whether legacy JSON is Historical/Read-only or needs reconciliation |
| Audit/notifications source-to-target field mapping (actor, `read_by`, timestamps) | Blocks D6 transformation design completeness |
| Whether audit entries have sufficient before/after state | Blocks rollback reliance on audit logs |
| Target schema nullability/constraints (may differ from 001 due to migrations 19–21) | Blocks Stage 1 target design finalization |

### 7.4 Entry requirements for any future implementation task (task-specific and stage-specific)

The requirements below are **entry conditions for specific implementation/execution tasks and stages**. They are **not** a blanket gate that blocks independent analysis, documentation, design review, contract-map drafting, Stage 0 baseline planning, or other preparation work that does not itself execute a gated task. Each requirement applies to the task or stage it names; work that does not touch that task or stage is not blocked by it.

- **D4 repair and `npm run typecheck` (gate for Stage 2 and beyond):** the separate conflict-marker repair task must be completed and `npm run typecheck` must exit 0 before any migration script runs. Task creation is approved; execution timing is deferred. This does not block analysis, documentation, or design work that does not run migration scripts.
- **Contract map (gate for D7 adapter implementation):** the finalized prototype-to-live-API contract map with proven deltas is required before D7 HTTP-adapter implementation. Contract-map drafting and diffing are preparation work and are not blocked by this gate.
- **Stage 0 production baseline (gate for stages needing production facts):** PostgreSQL version, dataset size, applied migrations, CORS config, secret-source identity (never the value), and runtime dependencies are required before any stage that depends on production facts. Planning and documentation of the baseline are not blocked.
- **D6 validation (gate for D6 execution):** verified target schema, deterministic identifier strategy, idempotency evidence (rerun + controlled-failure tests), and a tested recovery/reconciliation policy are required before D6 execution.
- **D5 verification (gate for secret movement/rotation):** production secret-source verification and a login/session impact assessment are required before any secret movement or rotation.
- **Per-stage entry conditions and approvals:** each stage (0–6) has its own entry conditions and required approvals (doc D). Stage 0 inventory is accepted (repository-only); production facts remain Unknown and may still block any stage or target-schema decision that requires them.
- **Owner approval at each applicable gate.**
- **Tested recovery/reconciliation policy for post-cutover writes** (not just snapshot existence) is required before cutover approval.

**Note:** these entry requirements constrain *execution* of gated tasks. They do not prohibit read-only analysis, documentation, design review, or preparation work that stays within its own scope and does not execute a gated task.

### 7.5 Required test cases and acceptance evidence

- Auth: login, refresh, logout, expired-token refresh, invalid-token logout.
- Permission: role grants and explicit denials (viewer/technical/warehouse/management/admin).
- Project scope: no-membership → hidden existence; membership levels READ/WRITE/DELETE.
- CRUD per domain for in-scope entities.
- Audit/notification writes reach PostgreSQL tables (post-D6) and no longer reach JSON files.
- Idempotency: re-run transformation on populated target → zero duplicates; controlled failure → recovery without duplication.
- Contract: adapter against finalized contract map; authentication, expected grants, explicit denials.
- Rollback: named recovery point; tested replay/reconciliation/discard policy; file-attachment recovery plan.

### 7.6 Rollback / recovery requirements

- Distinguish app rollback from data rollback.
- A same-database topology does not make data rollback automatically safe.
- No general-purpose inverse migration exists; if a reliable inverse path has not been designed, it must be stated before cutover approval.
- Required before cutover: named recovery point; explicit written decision for post-cutover writes; recovery plan for file attachments and external side effects; evidence that audit trail captures operations rollback depends on (currently Unproven).
- If no reliable rollback path exists, rollback is unsafe and blocks cutover approval.

### 7.7 Owner approvals still required beyond D1–D8

- Timing of D4 repair execution (completed 2026-10-29; `npm run typecheck` exited 0).
- D5 secret movement/rotation (deferred pending production-source verification and impact assessment).
- D6 execution timing (gated by stage approvals).
- D7 implementation timing (gated by contract map and stage approvals).
- Stage 0 production baseline completion where production facts remain Unknown (may still block final target-schema decisions or any stage requiring those facts).
- Each stage's own entry conditions and approvals (Stages 1–6).
- Any new permission key, namespace, or schema change.
- Any coexistence period with dual writes (requires explicit fronted ownership matrix).

### 7.8 Conditions that block progression

- D4 repair not completed / `npm run typecheck` not green → blocks Stage 2.
- Contract map not finalized → blocks D3 namespace decision and D7 implementation.
- Stage 0 production baseline incomplete → blocks Stage 1 target schema finalization.
- No tested recovery/reconciliation policy for post-cutover writes → blocks cutover approval.
- Unresolved critical differences in reconciliation → halts migration.
- No reliable rollback path → blocks cutover approval.
- Stage 0 production facts remain Unknown and may still block final target-schema decisions or any stage requiring those facts.

---

## 8. Stage 0 Inventory Summary (Accepted — Repository-Only)

- Repository baseline: `main` / `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf` (Verified).
- Migration files: 19 top-level + 3 in `down/` (Verified).
- Duplicate: `11_modernize_dms.sql` ≡ `18_modernize_dms.sql` (Verified).
- JSON files: 16 JSON + `.jwt-secret` (17 entries); only `audit_logs.json` and `notifications.json` are proven runtime file-backed stores (Verified); all others are bootstrap/seed artifacts or Unknown.
- Attachments: `storage/documents` = 193 files / 402,424,237 B; `backup` = 2,350 files / 2,570,218,363 B; `temp` = 8 files / 353,373 B.
- Conflict markers: 18 files (Verified).
- Production facts: Unknown (no authorized production access).

---

## Gate Statement

This document is a proposed target design for owner review. It is not implementation authorization. No code, database, production setting, runtime data, test, build, migration, or secret was touched to produce it. All owner decisions D1–D8 are preserved. Stage 0 inventory has been reviewed and accepted (repository-only); production facts remain Unknown. Stage 1 design is now owner-approved (DESIGN ONLY, 2026-10-29); approval does not establish unverified production facts or grant unrestricted implementation or production-change authorization. No stage may execute without its entry conditions and required approvals. The next step requires owner review and acceptance of the Stage 2 entry gates.

## 9. Owner Approval Addendum (2026-10-29)

- **Stage 1 — OWNER APPROVED (DESIGN ONLY, 2026-10-29).** The target design document `docs/frontend-rebuild/phase-12/phase-12-stage-1-target-design.md` is approved as a design document only.
- This approval does not establish unverified production facts, finalize unverified production-schema assumptions, or grant unrestricted implementation or production-change authorization.
- D1–D8 are preserved with their existing meanings. D8 final approval (2026-10-29) is recorded; final D8 approval is not permission to skip any stage gate.
- The owner authorized the previously approved D4 conflict-marker repair task to begin within its original narrow scope (repair 18 files, restore compilable source, re-run `npm run typecheck` to exit 0, bundle no unrelated changes). This authorization does not expand D4 into unrelated refactoring or feature development.
- D6 and D7 implementation remain gated by their existing requirements and approvals (contract map, stage gates, owner approvals).
- Stage 2 remains conditional on its actual entry gates (D4 complete + typecheck green, isolated DB/data copy, inspected runner, documented test scope, no production connection).
- No production deployment, DDL, data migration, secret rotation, permission change, or Phase 13 work is authorized by this approval.

**STAGE 1 DESIGN — OWNER APPROVED (DESIGN ONLY, 2026-10-29). DO NOT START STAGE 2 OR PHASE 13 WITHOUT ENTRY CONDITIONS AND APPROVALS.**