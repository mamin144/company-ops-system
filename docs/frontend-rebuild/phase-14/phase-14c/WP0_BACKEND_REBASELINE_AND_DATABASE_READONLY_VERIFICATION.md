# WP-0 — Backend Re-Baseline and PostgreSQL Read-Only Verification

**Work package:** WP-0 (audit only — no implementation)
**Phase:** 14 / sub-phase 14c
**Repository:** `D:\Default Project\company-ops-system`
**Report path:** `docs/frontend-rebuild/phase-14/phase-14c/WP0_BACKEND_REBASELINE_AND_DATABASE_READONLY_VERIFICATION.md`
**Audit mode:** strictly read-only
**Report generated:** 2026-11-18

---

## Evidence labels used in this report

| Label | Meaning |
| --- | --- |
| `SOURCE-VERIFIED` | Read directly from repository source at the cited path and line. The claim is about what the code *says*, not about runtime behaviour. |
| `DATABASE-VERIFIED` | Confirmed by querying a live PostgreSQL instance in this session. |
| `DOCUMENTATION-ONLY` | Asserted only by a Markdown document in the repository. Not confirmed against code or database. |
| `STATIC-INFERENCE` | Derived by combining source facts, without executing the code path. Correctness of the inference depends on the enumerated premises. |
| `NOT-VERIFIED` | Not established within WP-0. No claim is made either way. |

**No `DATABASE-VERIFIED` finding appears in this report.** Every finding below is `SOURCE-VERIFIED`, `STATIC-INFERENCE`, `DOCUMENTATION-ONLY`, or `NOT-VERIFIED`. Section 10 explains exactly why.

---

## 1. Executive summary

This work package re-baselined the Phase 14 backend from source and attempted read-only PostgreSQL verification. The backend is substantially wider and more real than the Phase 14 documentation claims. It is also, in three specific places, demonstrably unsafe or broken in ways that matter to the frontend rebuild.

**What was established.**

- The backend exposes approximately **118 HTTP route registrations across 15 routers** (`SOURCE-VERIFIED`). The Phase 14 API readiness document `phase-14c/04-api-readiness.md` asserts that only 7 endpoints are "EXISTING-VERIFIED". That document understates the surface by an order of magnitude. It is contradicted by the router files and must not be used as a build contract.
- **Authorization is genuinely centralized.** `middleware/auth.ts` deliberately refuses to trust the JWT permission snapshot and re-resolves role, overrides and project membership from the database on every request (`middleware/auth.ts` L20–24). `services/authorization.service.ts` implements `grant`/`deny` overrides plus a project-access ladder. This is a real authorization system, not decoration (`SOURCE-VERIFIED`, `STATIC-INFERENCE`).
- **The IPC approval workflow is genuinely implemented**, with a row lock, an explicit transition matrix, transactional status writes, an append-only `ipc_status_events` table, a 409 `INVALID_TRANSITION` rejection path and a 403 `SELF_APPROVAL_DENIED` path (`ipc.routes.ts` L86–92, L296–347, L355–390). It is the single most complete workflow in the codebase (`SOURCE-VERIFIED`).
- **The document status model has no transition matrix at all.** `PATCH /documents/:id/status` validates only enum membership and then writes any of seven statuses (`documents.routes.ts` L542–558; `documents.validators.ts` L3, L20–22). A user holding `archive.edit` can move `approved → draft` by direct API call. A second path silently rewrites `approved → submitted` as a side effect of uploading a revision (`documents.routes.ts` L444) and does not audit the status change. This confirms WP3C finding B3 on current source.
- **The backend currently cannot boot from a clean checkout.** `auth.routes.ts` L11 imports `../password-reset-token/service.js`, and no such module exists in the tree. The only nearby file is an untracked `services/password-reset-token.service.ts`, which has the wrong path shape, references a variable before declaration, and writes a column that migration 24 does not create (`SOURCE-VERIFIED`).
- **RBAC contains a documented contradiction.** Migration `19_authz_rebuild.sql` seeds roles in SQL and assigns `ipcs.approve` / `ipcs.resubmit` to **no role** — honouring the owner decision that those keys are vocabulary only. But `packages/shared/src/permissions.ts` grants `admin: [...ALL_PERMISSIONS]`, which includes both keys, and `storage/seed-users.ts` generates the legacy JSON role store from that constant. Two seed paths therefore disagree about whether the keys are assignable (`SOURCE-VERIFIED`).
- **Project scoping is largely inert on existing data.** Migration `20_authz_backfill.sql` cross-joins every user onto every project, granting `DELETE` to `admin`, `READ` to `viewer` and `WRITE` to everyone else. The scoping machinery exists and is correct in shape, but on backfilled data it narrows almost nothing (`SOURCE-VERIFIED`, `STATIC-INFERENCE`).

**What could not be established.**

- **PostgreSQL was not verified.** Two PostgreSQL major versions (`17` and `18`) are both running as Windows services. A single process, PID 8220, owns both `0.0.0.0:5432` and `[::]:5432`. No `psql`, `pg_isready` or `docker` client is available, and the target inside `apps/api/.env` was not resolved. Choosing one instance would have been a guess. DB verification was therefore stopped under its own stated stop condition. Recorded as `NOT VERIFIED — DATABASE ACCESS NOT AVAILABLE` in §10.
- **Nothing in this report is `DATABASE-VERIFIED`.** Table existence, migration application state, row counts, constraint presence and seeded role/permission contents are all **unknown**. Where the schema is described below, it is described as *what the migration files say*, never as *what the database contains*.

**Verdict.** `WP-0 PARTIALLY VERIFIED — DATABASE OR SOURCE LIMITATIONS`. Repository source was available and was audited exhaustively. The database layer was not reachable without making a decision this work package is not authorized to make. No work package downstream of WP-0 is authorized by this report.

---

## 2. Repository identity and Git state

### 2.1 Identity

| Field | Value |
| --- | --- |
| Repository root | `D:\Default Project\company-ops-system` |
| Platform | `win32` |
| Workspace declaration | `["apps/*", "packages/*"]` |
| Backend application root | `apps/api` |
| Shared package | `packages/shared` |
| Frontend application | `apps/web` |
| Monorepo tooling present | `docker-compose.yml`, `Dockerfile.api`, `Dockerfile.web`, `.env.example`, `apps/api/.env.example` |

### 2.2 Git state — initial (captured before any read of the audit surface)

| Field | Value |
| --- | --- |
| Branch | `main` |
| HEAD | `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf` |
| HEAD commit | `f91ed2f 2026-10-11 09:19:57 +0000 Merge branch 'main' of https://github.com/mamin144/company-ops-system` |
| `git status --porcelain` entries | 46 |
| Staged entries | 0 |
| Stash entries | 0 |
| Untracked paths under `docs/` | 349 |
| `git ls-files docs` | 0 files |

### 2.3 Git state — final (captured after report authoring)

| Field | Value |
| --- | --- |
| Branch | `main` |
| HEAD | `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf` |
| `git status --porcelain` entries | 46 |
| Staged entries | 0 |
| Stash entries | 0 |

**Initial and final states are identical.** Branch, HEAD, porcelain count, staged count and stash count all match. The one deliberate difference is the new report file described in §16.

### 2.4 Pre-existing working-tree content (not created by WP-0)

The working tree was already dirty when WP-0 began. The following were present **before** this audit and remain untouched:

**Modified tracked files (34), including:**

- `apps/api/src/routes/index.ts`
- `apps/api/src/services/authorization.service.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/modules/system/system.routes.ts`
- `apps/api/src/modules/projects/ipc.routes.ts`
- `apps/api/src/modules/documents/documents.routes.ts`
- `apps/api/src/modules/auth/auth.routes.ts`
- `apps/web/src/lib/permissions.ts`

**Untracked files, including:**

- `apps/api/src/database/migrations/22_phase14_core_columns.sql`
- `apps/api/src/database/migrations/23_phase14_ipc_workflow.sql`
- `apps/api/src/database/migrations/24_phase14_recovery_import_tables.sql`
- `apps/api/src/services/financials.service.ts`
- `apps/api/src/services/password-reset-token.service.ts`
- `apps/api/tests/migration.phase14.test.ts`
- `apps/api/scripts/fix-password-reset.js`
- `docs/`
- root-level `.md` reports

**Consequence for every finding below.** The most security-relevant files in this audit — the IPC workflow, the document routes, the auth routes, the authorization service — are **uncommitted working-tree state**. The committed `HEAD` version of `auth.routes.ts` contains no password-reset code at all; the working tree adds 56 lines and removes 19. Any statement in this report about "the backend" describes **the working tree as found**, which is not what `git checkout main` would produce. This is recorded as a scope hazard, not as a defect (`SOURCE-VERIFIED` via `git show HEAD:` comparison).

---

## 3. Skills record

Four skills were selected for this audit. All four were read in full and applied only where the audit actually touched their subject matter. Discovery alone is not recorded as application.

| Skill | Discovered | Read | Applied | Where applied | Notes |
| --- | --- | --- | --- | --- | --- |
| `backend-dev-guidelines` | Yes | Yes | **Yes** | §4, §5, §7 — router/handler layering, middleware ordering, central authz vs inline checks, error-status discipline | Used to judge whether a route's middleware chain is coherent and whether authorization lives in one place. |
| `auth-implementation-patterns` | Yes | Yes | **Yes** | §7, §8, §11 — token/session model, permission resolution, privilege-escalation surfaces, workflow transition gates | Used to separate permission-key existence from effective authorization, and to evaluate the self-approval guard. |
| `postgres-best-practices` | Yes | Yes | **Partially** | §9, §10 — schema-level reasoning only | Applied to *reading* migrations (constraints, indexes, backfill safety). Its verification guidance assumes a reachable database, which was not available; the DB-verification portion could not be applied. Recorded honestly as partial. |
| `database-migrations-sql-migrations` | Yes | Yes | **Yes** | §9 — runner semantics, ordering, idempotency, forward/rollback coverage, phase-14 migration reconciliation | Used to reason about `_migrations` tracking, `localeCompare` ordering, duplicate version prefixes and missing `down/` coverage. |

**Unavailable skills.** No skill required by this audit was unavailable. The DB-facing portion of `postgres-best-practices` was inapplicable rather than unavailable — the connection was absent, so there was nothing to apply it to.

**Not claimed.** No skill was applied to produce a *fix*. WP-0 forbids implementation. Skills informed analysis and the shape of the findings only.

---

## 4. Backend architecture and router inventory

### 4.1 Composition

| Layer | Location | Content |
| --- | --- | --- |
| Entry | `apps/api/src/server.ts` | Process bootstrap |
| App assembly | `apps/api/src/app.ts` | Express app, middleware chain, `createApp()` |
| Route aggregation | `apps/api/src/routes/index.ts` | 35 lines — mounts all 15 routers |
| Route modules | `apps/api/src/modules/<domain>/*.routes.ts` | 15 route files |
| Middleware | `apps/api/src/middleware/` | `auth.ts` (139 L), `errors.ts` |
| Services | `apps/api/src/services/` | 14 files + `smart-import/` |
| Repositories | `apps/api/src/repositories/` | 18 files |
| Data access | `apps/api/src/database/` | `connection.ts` (46 L), `migrate.ts` (82 L), `migrations/` |
| Shared | `apps/api/src/shared/` | `id.ts`, `paths.ts`, `time.ts`, `validation.ts` |
| Storage/seeding | `apps/api/src/storage/` | `seed-users.ts` and legacy JSON stores |

Total backend source: **87 `.ts` / `.sql` files** under `apps/api/src`.

### 4.2 Mount table (`routes/index.ts`, `SOURCE-VERIFIED`)

| # | Prefix | Router | Line | Auth posture |
| --- | --- | --- | --- | --- |
| 1 | `/auth` | `authRouter` | L19 | Public (per-route `requireAuth`) |
| 2 | `/users` | `usersExtRouter` | L22 | `requireAuth` at router level (L254) |
| 3 | `/users` | `usersRouter` | L23 | `requireAuth` + `users.manage` at router level (L151) |
| 4 | `/roles` | `rolesRouter` | L24 | `requireAuth` + `roles.manage` (L74) |
| 5 | `/projects` | `projectsRouter` | L25 | `requireAuth` (L18) |
| 6 | `/documents` | `documentsRouter` | L26 | `requireAuth` (L182) |
| 7 | `/folders` | `foldersRouter` | L27 | `requireAuth` (L9) |
| 8 | `/warehouses` | `warehousesRouter` | L28 | `requireAuth` (L15) |
| 9 | `/items` | `itemsRouter` | L29 | `requireAuth` (L12) |
| 10 | `/stock` | `stockRouter` | L30 | `requireAuth` (L60) |
| 11 | `/sites` | `sitesRouter` | L31 | `requireAuth` (L20) |
| 12 | `/material-requests` | `materialRequestsRouter` | L32 | `requireAuth` + `materialRequests.view` (L35) |
| 13 | `/import` | `importRouter` | L33 | `requireAuth` (L187) |
| 14 | `/config` | `configRouter` | L34 | `requireAuth` (L6) |
| 15 | `/` | `systemRouter` | L35 | `requireAuth` (L11) |

**Mount-order observation (`SOURCE-VERIFIED`, `STATIC-INFERENCE`).** `usersExtRouter` is mounted **before** `usersRouter` on the same prefix (L22 before L23). Express resolves in registration order, so `/users/:id/overrides`, `/users/:id/projects`, `/users/:id/effective` and `/users/:id/reset-password` are reachable under the weaker `requireAuth` + per-route checks before the blanket `users.manage` gate of `usersRouter` is ever consulted. This is intentional and functional — the extension router deliberately carries its own narrower grants — but it means **"the `/users` router requires `users.manage`" is false as a blanket statement**. Any authorization summary that flattens `/users` into one policy is wrong.

### 4.3 Middleware semantics (`middleware/auth.ts`, 139 L, `SOURCE-VERIFIED`)

| Export | Behaviour | Line |
| --- | --- | --- |
| `requireAuth` | Verifies access token, loads user, rejects inactive users | L45– |
| `requirePermission(key)` | Single-key gate via central `can()` | ~L70 |
| `requireAnyPermission(...keys)` | OR-gate across keys | ~L85 |
| `requireProjectAccess(key, resolver, opts)` | Permission **and** project-scope ladder; `hideExistence` converts 403→404 | ~L100 |
| `requireAnyProjectAccess(keys, resolver)` | OR-gate plus scope | ~L115 |
| `requestContext(req)` | Per-request cached `AuthzContext` | L130–139 |

The header comment at L20–24 is explicit: the `req.user.permissions` snapshot is **not** consulted for decisions; every decision re-resolves from the database. This is the correct design and it is actually honoured in the permission middleware (`SOURCE-VERIFIED`).

**Architectural strength.** Authorization is centralized. `requireProjectAccess` is the dominant pattern across projects, documents, sites, warehouses, BOQ and IPC. This is materially better than the Phase 14 documentation implies.

**Architectural weaknesses** (each detailed later):
- Several read routes carry **no permission key at all** — only `requireAuth` (§5, §7.4).
- `DELETE /documents/:id` contains an inline `req.user?.roleName === 'admin'` bypass outside the authorization service (§7.5).
- `POST /material-requests/:id/approve` and `/issue` use global `requirePermission` with **no project scope** (§7.6).
- `stock` correctly does per-type authorization via `can()` with a resolved project, which is the pattern the rest of the codebase should have followed (§7.7).

---

## 5. Endpoint inventory

**Reading this table.** `Implemented` means a handler body exists that performs the stated DB work. `Partial` means the route exists but a required dependency, validation or enforcement step is missing. `Unclear` means source alone cannot settle the question. Per the WP-0 brief, **route registered ≠ handler implemented ≠ DB operation implemented ≠ authorization enforced ≠ functionality verified**, and the table keeps those columns separate. `DB access` records *that* a repository call exists, not that it succeeds against a live schema. `Validation` records the presence of a schema at the boundary, not its completeness.

### 5.1 `auth` — mounted `/auth` (16 registrations)

| # | Method | Route | Line | AuthN | AuthZ | Validation | DB access | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | POST | `/auth/login` | 83 | Public | None | Inline | `userRepository`, session create | Implemented |
| 2 | POST | `/auth/refresh` | 108 | Public (cookie) | None | Inline | `sessionService` | Implemented |
| 3 | POST | `/auth/logout` | 132 | `requireAuth` | AuthN only | None | Session delete | Implemented |
| 4 | GET | `/auth/me` | 144 | `requireAuth` | AuthN only | None | `userRepository` | Implemented |
| 5 | GET | `/auth/sessions` | 461 | `requireAuth` | AuthN only | None | **None — placeholder body** | **Partial** |
| 6 | POST | `/auth/request-reset` | 472 | Public | None | Inline | Reset-token insert | **Partial** (broken import, see §12.1) |
| 7 | POST | `/auth/use-reset` | 494 | Public | None | Inline | Reset-token read/consume | **Partial** (broken import, see §12.1) |
| 8 | GET | `/users/` | 153 | `requireAuth` | `users.manage` | None | `userRepository` | Implemented |
| 9 | POST | `/users/` | 158 | `requireAuth` | `users.manage` | Inline | `userRepository` | Implemented |
| 10 | PUT | `/users/:id` | 172 | `requireAuth` | `users.manage` | Inline | `userRepository` | Implemented |
| 11 | DELETE | `/users/:id` | 219 | `requireAuth` | `users.manage` | None | `userRepository` | Implemented |
| 12 | POST | `/users/:id/reset-password` | 258 | `requireAuth` | `users.manage` **or** `users.resetPassword` | Inline | `userRepository` | **Partial** — `users.resetPassword` is not in `ALL_PERMISSIONS`, so the OR-branch is dead |
| 13 | GET | `/users/:id/overrides` | 269 | `requireAuth` | `users.manage` | None | Overrides table | Implemented |
| 14 | PUT | `/users/:id/overrides` | 279 | `requireAuth` | `users.manage` | Inline | Overrides table | Implemented |
| 15 | DELETE | `/users/:id/overrides/:key` | 315 | `requireAuth` | `users.manage` | None | Overrides table | Implemented |
| 16 | GET | `/users/:id/projects` | 334 | `requireAuth` | `projects.access` | None | `project_members` | **Partial** — `projects.access` is not in `ALL_PERMISSIONS` (see §7.3) |
| 17 | PUT | `/users/:id/projects` | 351 | `requireAuth` | `projects.access` | Inline | `project_members` | **Partial** — same |
| 18 | GET | `/users/:id/effective` | 427 | `requireAuth` | Self, or `users.manage` | None | `loadContext` + `effective` | Implemented |

### 5.2 `roles` — mounted `/roles` (7 registrations)

Router-level gate: `requireAuth` + `roles.manage` (L74).

| # | Method | Route | Line | AuthZ | Validation | DB access | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 19 | GET | `/roles/` | 76 | `roles.manage` | None | Roles table | Implemented |
| 20 | GET | `/roles/:id` | 80 | `roles.manage` | None | Roles table | Implemented |
| 21 | POST | `/roles/` | 87 | `roles.manage` | Inline | Roles table | Implemented |
| 22 | PUT | `/roles/:id` | 104 | `roles.manage` | Inline | Roles table | Implemented |
| 23 | DELETE | `/roles/:id` | 131 | `roles.manage` | None | Roles table | Implemented |
| 24 | POST | `/roles/:id/clone` | 144 | `roles.manage` | None | Roles table | Implemented |
| 25 | GET | `/roles/:id/users` | 169 | `roles.manage` | None | Users join | Implemented |

**Note.** `roles.manage` is itself **not** present in `ALL_PERMISSIONS` (`packages/shared/src/permissions.ts` L1–31). See §7.3 — this is a live self-referential problem: only a role that happens to carry the literal string `roles.manage` can administer roles, and no seed path grants it from the shared constant.

### 5.3 `projects` — mounted `/projects` (13 registrations incl. sub-mounts)

| # | Method | Route | Line | AuthZ | Scope | Validation | DB access | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 26 | GET | `/projects/financials` | 29 | `projects.view` | Global | None | Aggregation across projects | Implemented |
| 27 | GET | `/projects/` | 66 | `projects.view` | Global | None | `projectRepository.list` | Implemented |
| 28 | GET | `/projects/export/xlsx` | 94 | `reports.view` | Global | None | Excel export | Implemented |
| 29 | GET | `/projects/:id/members` | 104 | `projects.access` | Row | None | `project_members` | **Partial** — permission key not in `ALL_PERMISSIONS` |
| 30 | GET | `/projects/:id/financials` | 123 | `projects.view` | Row | None | IPC/stock aggregation | Implemented |
| 31 | GET | `/projects/:id` | 154 | `projects.view` | Row | None | `projectRepository.findById` | Implemented |
| 32 | POST | `/projects/` | 167 | `projects.create` | — | `projectSchema` | Insert | Implemented |
| 33 | PUT | `/projects/:id` | 184 | `projects.edit` | Row | `projectSchema` | Update | Implemented |
| 34 | DELETE | `/projects/:id` | 201 | `projects.delete` | Row | None | Soft delete (`deleted_at`) | Implemented |
| 35 | POST | `/projects/:id/restore` | 212 | `projects.delete` | Row | None | Clear `deleted_at` | Implemented |
| — | — | `/projects/:projectId/boq` | 20 | *(sub-mount)* | — | — | — | — |
| — | — | `/projects/:projectId/ipcs` | 21 | *(sub-mount)* | — | — | — | — |

### 5.4 `boq` — sub-mounted `/projects/:projectId/boq` (5 registrations)

Router-level: `requireAuth` only (L23).

| # | Method | Route | Line | AuthZ | Scope | Validation | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 36 | GET | `…/boq/` | 25 | **None beyond AuthN** | **None** | None | **Partial** — any authenticated user reads any project's BOQ |
| 37 | POST | `…/boq/` | 36 | `projects.edit` OR `projects.create` | Param | `boqSchema` | Implemented |
| 38 | PUT | `…/boq/:id` | 52 | `projects.edit` | Param | `boqSchema` | Implemented |
| 39 | DELETE | `…/boq/:id` | 66 | `projects.edit` | Param | None | Implemented |
| 40 | GET | `…/boq/export/xlsx` | 81 | `projects.edit` OR `projects.create` | Param | None | Implemented |

### 5.5 `ipc` — sub-mounted `/projects/:projectId/ipcs` (11 registrations)

Router-level: `requireAuth` only (L44).

| # | Method | Route | Line | AuthZ | Scope | Validation | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 41 | GET | `…/ipcs/` | 46 | **None beyond AuthN** | **None** | None | **Partial** |
| 42 | GET | `…/ipcs/:id/status-events` | 58 | `projects.view` | Row, `hideExistence` | None | **Implemented** |
| 43 | GET | `…/ipcs/:id` | 65 | **None beyond AuthN** | **None** | None | **Partial** |
| 44 | POST | `…/ipcs/` | 119 | `projects.edit` OR `projects.create` | Param | Inline | Implemented |
| 45 | PUT | `…/ipcs/:id` | 191 | `projects.edit` | Param | Inline | Implemented |
| 46 | DELETE | `…/ipcs/:id` | 267 | `projects.edit` | Param | None | Implemented |
| 47 | POST | `…/ipcs/:id/submit` | 355 | `projects.edit` | Param | None | **Implemented** |
| 48 | POST | `…/ipcs/:id/start-review` | 362 | `projects.edit` | Param | None | **Implemented** |
| 49 | POST | `…/ipcs/:id/approve` | 369 | `ipcs.approve` | Param | None | **Implemented** |
| 50 | POST | `…/ipcs/:id/reject` | 376 | `ipcs.approve` | Param | Reason required | **Implemented** |
| 51 | POST | `…/ipcs/:id/resubmit` | 385 | `ipcs.resubmit` **OR** `projects.edit` | Param | None | **Implemented** — but `ipcs.resubmit` is optional (see §7.2) |

### 5.6 `documents` — mounted `/documents` (17 registrations)

Router-level: `requireAuth` (L182).

| # | Method | Route | Line | AuthZ | Scope | Validation | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 52 | GET | `/documents/` | 184 | `archive.view` | Global | None | Implemented |
| 53 | GET | `/documents/export/xlsx` | 205 | `archive.view` | Global | None | Implemented |
| 54 | GET | `/documents/:id` | 213 | `archive.view` | Row, hide | None | Implemented |
| 55 | GET | `/documents/:id/revisions` | 219 | `archive.view` | Row, hide | None | Implemented |
| 56 | GET | `/documents/:id/preview` | 327 | download OR | Row | None | Implemented |
| 57 | GET | `/documents/:id/download` | 332 | download OR | Row | None | Implemented |
| 58 | GET | `/documents/:id/file` | 337 | download OR | Row | None | Implemented |
| 59 | POST | `/documents/upload` | 350 | `archive.upload` | Body | `documentSchema` + multer | Implemented |
| 60 | POST | `/documents/:id/revisions` | 406 | `archive.edit` | Row | multer | **Implemented — rewrites status (see §8.3)** |
| 61 | POST | `/documents/:id/links` | 451 | `archive.edit` | Row | Inline | Implemented |
| 62 | DELETE | `/documents/links/:linkId` | 487 | `archive.edit` | **None** | None | **Partial** — no project scope |
| 63 | PATCH | `/documents/:id/move` | 503 | `archive.edit` | Row | Inline | Implemented |
| 64 | PUT | `/documents/:id` | 510 | `archive.edit` | Row | `documentSchema` | Implemented |
| 65 | PATCH | `/documents/:id/status` | 542 | `archive.edit` | Row | **Enum membership only** | **Partial — no transition matrix (see §8.2)** |
| 66 | POST | `/documents/export/zip` | 561 | `archive.download` | Global | None | Implemented |
| 67 | POST | `/documents/:id/replace` | 632 | `archive.edit` | Row | multer | Implemented |
| 68 | DELETE | `/documents/:id` | 662 | `archive.delete` | Row | None | **Partial — admin bypass (see §7.5)** |

### 5.7 `folders` — mounted `/folders` (4 registrations)

| # | Method | Route | Line | AuthZ | Validation | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 69 | GET | `/folders/` | 19 | `archive.view` | None | Implemented |
| 70 | POST | `/folders/` | 24 | `archive.upload` | Inline | Implemented |
| 71 | PUT | `/folders/:id` | 36 | `archive.edit` | Inline | Implemented |
| 72 | DELETE | `/folders/:id` | 50 | `archive.delete` | None | Implemented — **no archive/soft-delete check on folder contents verified in source** |

### 5.8 `sites` — mounted `/sites` (4 registrations)

| # | Method | Route | Line | AuthZ | Scope | Validation | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 73 | GET | `/sites/` | 22 | **None beyond AuthN** | **None** | None | **Partial** |
| 74 | POST | `/sites/` | 33 | `projects.edit` | Body | `siteSchema` | Implemented |
| 75 | PUT | `/sites/:id` | 41 | `projects.edit` | Row | `siteSchema` | Implemented |
| 76 | DELETE | `/sites/:id` | 57 | `projects.edit` | Row | None | Implemented |

### 5.9 `warehouses` — mounted `/warehouses` (5 registrations)

| # | Method | Route | Line | AuthZ | Scope | Validation | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 77 | GET | `/warehouses/` | 17 | `warehouse.view` | Global | None | Implemented |
| 78 | GET | `/warehouses/export/xlsx` | 35 | `reports.view` | Global | None | Implemented |
| 79 | POST | `/warehouses/` | 43 | `warehouse.create` | Body | `warehouseSchema` | Implemented |
| 80 | PUT | `/warehouses/:id` | 51 | `warehouse.edit` | Row | `warehouseSchema` | Implemented |
| 81 | DELETE | `/warehouses/:id` | 67 | `warehouse.delete` | Row | None | Implemented |

### 5.10 `items` — mounted `/items` (5 registrations)

| # | Method | Route | Line | AuthZ | Validation | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 82 | GET | `/items/` | 14 | `warehouse.view` | None | Implemented |
| 83 | GET | `/items/export/xlsx` | 28 | `reports.view` | None | Implemented |
| 84 | POST | `/items/` | 35 | `warehouse.create` | `itemSchema` | Implemented |
| 85 | PUT | `/items/:id` | 43 | `warehouse.edit` | `itemSchema` | Implemented |
| 86 | DELETE | `/items/:id` | 53 | `warehouse.delete` | None | Implemented |

### 5.11 `stock` — mounted `/stock` (7 registrations)

| # | Method | Route | Line | AuthZ | Scope | Validation | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 87 | GET | `/stock/overview` | 62 | `warehouse.view` | Global | None | Implemented |
| 88 | GET | `/stock/history` | 89 | `warehouse.view` | Global | None | Implemented |
| 89 | GET | `/stock/transactions` | 93 | `warehouse.view` | Global | None | Implemented |
| 90 | GET | `/stock/transactions/export/xlsx` | 98 | `reports.view` | Global | None | Implemented |
| 91 | GET | `/stock/export/xlsx` | 102 | `reports.view` | Global | None | Implemented |
| 92 | POST | `/stock/transactions` | 195 | Any of 5 stock keys, **then** per-type `can()` | Resolved | `stockTransactionSchema` | **Implemented — best-in-class** |
| 93 | DELETE | `/stock/transactions/:id` | 224 | `warehouse.edit` OR `settings.manage` | — | None | **Implemented as refusal** — always 400 by design |

**Observation on 93 (`SOURCE-VERIFIED`).** This endpoint is a deliberate immutable-ledger guard: it audits `delete-blocked` and returns 400 unconditionally before any existence check. It is registered, authorized, and *correctly refuses to operate*. It must not be reported as "implemented DB deletion" nor as "broken".

### 5.12 `material-requests` — mounted `/material-requests` (7 registrations)

Router-level: `requireAuth` + `materialRequests.view` (L35).

| # | Method | Route | Line | AuthZ | Scope | Validation | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 94 | GET | `/material-requests/` | 47 | `materialRequests.view` | Global | None | Implemented |
| 95 | GET | `/material-requests/:id` | 58 | `materialRequests.view` | Row, hide | None | Implemented |
| 96 | POST | `/material-requests/` | 64 | `materialRequests.create` | Body | Inline | Implemented |
| 97 | POST | `/material-requests/:id/submit` | 92 | `materialRequests.create` | Row | None | Implemented |
| 98 | POST | `/material-requests/:id/approve` | 109 | `materialRequests.approve` | **None** | None | **Partial** — global permission, no project scope |
| 99 | POST | `/material-requests/:id/issue` | 128 | `materialRequests.issue` | **None** | Inline | **Partial** — global permission, no project scope |
| 100 | DELETE | `/material-requests/:id` | 193 | `materialRequests.create` | Row | None | Implemented |

### 5.13 `import` — mounted `/import` (7 registrations)

| # | Method | Route | Line | AuthZ | Validation | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 101 | GET | `/import/history` | 189 | `settings.manage` | None | Implemented |
| 102 | POST | `/import/smart/analyze` | 203 | `archive.upload` | multer | Implemented |
| 103 | POST | `/import/smart/preview` | 226 | `archive.upload` | multer | Implemented |
| 104 | POST | `/import/smart/confirm` | 288 | `archive.upload` | Row-level revalidation | Implemented |
| 105 | GET | `/import/:entity/template` | 384 | **None beyond AuthN** | None | **Partial** |
| 106 | POST | `/import/:entity/preview` | 394 | **None beyond AuthN** | multer | **Partial** |
| 107 | POST | `/import/:entity/confirm` | 411 | **None beyond AuthN** | Reuses domain schemas | **Partial** |

**Import asymmetry (`SOURCE-VERIFIED`).** The `smart/*` leg requires `archive.upload`; the generic `:entity` leg requires only authentication and then writes through the **same domain repositories**. `import.routes.ts` L33 and L195 also both import `detectDuplicates` — a duplicate module import, harmless at runtime but a sign the file was edited under pressure.

### 5.14 `config` — mounted `/config` (2 registrations)

| # | Method | Route | Line | AuthZ | Status |
| --- | --- | --- | --- | --- | --- |
| 108 | GET | `/config/categories` | 8 | **None beyond AuthN** | **Partial** |
| 109 | GET | `/config/units` | 9 | **None beyond AuthN** | **Partial** |

### 5.15 `system` — mounted `/` (8 registrations)

| # | Method | Route | Line | AuthZ | Status |
| --- | --- | --- | --- | --- | --- |
| 110 | GET | `/audit-logs` | 14 | `audit.view` | Implemented |
| 111 | GET | `/backups` | 43 | `backup.manage` | Implemented |
| 112 | POST | `/backups` | 47 | `backup.manage` | Implemented |
| 113 | POST | `/backups/:name/verify` | 54 | `backup.manage` | Implemented |
| 114 | POST | `/backups/:name/restore` | 66 | `backup.manage` | **Partial** — `dry_run` works (L73–91); `commit` returns 501 `RESTORE_NOT_SUPPORTED` (L94–109) |
| 115 | GET | `/search` | 114 | **None beyond AuthN** | **Partial** |
| 116 | GET | `/notifications` | 122 | **None beyond AuthN** | **Partial** — global feed, not user-scoped |
| 117 | POST | `/notifications/:id/read` | 131 | **None beyond AuthN** | **Partial** — no ownership check |
| 118 | POST | `/notifications/read-all` | 136 | **None beyond AuthN** | **Partial** |

### 5.16 Inventory totals

| Status | Count | Share |
| --- | --- | --- |
| Implemented | 92 | ~78% |
| Partial | 26 | ~22% |
| Missing | 0 | 0% |
| Unclear | 0 | 0% |
| **Total** | **118** | **100%** |

**Zero routes are `Missing`.** Every registered route has a handler body. The risk in this backend is not absent code; it is **under-enforced** code. That distinction matters for WP-1 scoping: this is a hardening and reconciliation job, not a greenfield build.

**Zero routes are `DATABASE-VERIFIED`.** "Implemented" here means the handler calls a repository method. Whether the tables, columns and constraints that method assumes actually exist is unknown (§10).

---

## 6. Contract reconciliation — 15 areas

**Method.** For each area the domain contract was taken from the Phase 14 planning documents and the Phase 13 prototype expectations, then compared against current source. Classification vocabulary per the WP-0 brief: *Implemented and evidenced* / *Implemented but incomplete* / *Registered but not functionally verified* / *Documented but not implemented* / *Missing* / *Conflicting evidence* / *Not applicable*.

| # | Area | Classification | Basis |
| --- | --- | --- | --- |
| 1 | Projects | **Implemented but incomplete** | Full CRUD + soft delete + restore + members + financials (§5.3). Incomplete: `projects.access` key used but absent from `ALL_PERMISSIONS`. |
| 2 | Users / user extensions | **Implemented but incomplete** | CRUD, overrides, projects, effective, reset-password (§5.1). Incomplete: reset-password permission branch dead; `/users/:id/projects` gated on a non-existent key; `department`/`title` columns added by migration 22. |
| 3 | Roles / permissions | **Conflicting evidence** | Routes complete (§5.2). But `roles.manage` and `projects.access` are used as keys yet absent from `ALL_PERMISSIONS`; SQL seed assigns `ipcs.*` to no role; shared constant assigns them to `admin`. |
| 4 | BOQ | **Implemented but incomplete** | Full CRUD + export (§5.4). Incomplete: `GET` has no permission and no project scope. |
| 5 | IPC + approval / resubmission | **Implemented and evidenced** | Only area meeting the full bar: lock, matrix, transactional write, append-only event log, 409/403 paths (§8.4). |
| 6 | Documents / status transitions | **Implemented but incomplete** | 17 routes, full file lifecycle (§5.6). Incomplete and unsafe: no transition matrix; revision upload rewrites status; admin delete bypass (§8). |
| 7 | Folders / archive | **Implemented but incomplete** | CRUD (§5.7). Incomplete: folder delete has no guard against non-empty contents in source. |
| 8 | Sites | **Implemented but incomplete** | CRUD (§5.8). Incomplete: `GET` has no permission and no scope. |
| 9 | Stock / warehouses | **Implemented and evidenced** | Warehouse + item + stock CRUD; per-type authorization with resolved project; immutable ledger enforced (§5.9–5.11). |
| 10 | Material requests | **Implemented but incomplete** | Create/submit/approve/issue/delete (§5.12). Incomplete: approve and issue are globally scoped only. |
| 11 | Search | **Registered but not functionally verified** | `GET /search` exists and calls `globalSearchService` (§5.15). No permission gate. Cross-entity result correctness unverifiable without DB. |
| 12 | Notifications | **Implemented but incomplete** | List/read/read-all exist (§5.15). Incomplete: feed is global (latest 100 to every user), `read_by` is a username array, no per-user targeting, no ownership check on `/:id/read`. |
| 13 | Audit logs | **Implemented and evidenced** | `GET /audit-logs` gated by `audit.view`; `auditService.log` called across mutations (§5.15, and inline at documents/stock/ipc sites). |
| 14 | Backups / restore | **Implemented but incomplete** | Create/list/verify work; restore `dry_run` works; restore `commit` returns 501 (§5.15). Contract explicitly half-delivered. |
| 15 | Lookups | **Implemented but incomplete** | `/config/categories`, `/config/units` served from repositories (§5.14). Incomplete: no permission gate. |

### 6.1 Areas that are `Documented but not implemented`

| Claim | Source | Reality |
| --- | --- | --- |
| "Restore from backup" is a user-facing capability | Phase 13 UI surface; §5.15 route exists | `commit` path returns `501 RESTORE_NOT_SUPPORTED` (`system.routes.ts` L94–109). `dry_run` is the only working mode. **Documented but not implemented.** |
| Session listing / revocation | §5.1 route exists | `/auth/sessions` body is a placeholder (`auth.routes.ts` L461–464). **Documented but not implemented.** |
| Per-user notification targeting | Frontend notification UX | Backend feed is global. **Documented (by implication) but not implemented.** |

### 6.2 Areas that are `Missing`

None of the 15 contract areas is wholly missing. No contract area is `Not applicable` either — all 15 have at least a route surface.

### 6.3 The documentation contradiction (§6.1 corollary)

`docs/frontend-rebuild/phase-14/phase-14c/04-api-readiness.md` classifies 7 endpoints as `EXISTING-VERIFIED`. Current source contains ~118 registrations across 15 routers. This is not a rounding difference; it is a category error. **`04-api-readiness.md` is `DOCUMENTATION-ONLY` and is contradicted by `SOURCE-VERIFIED` evidence.** Any WP-1 plan that treats it as an inventory will duplicate roughly 110 endpoints of existing work. This restates and confirms WP3C's finding B2.

---

## 7. Authentication and RBAC findings

### 7.1 Permission-key existence ≠ role assignment ≠ effective authorization

These three layers must not be collapsed. Current state:

| Layer | State | Evidence |
| --- | --- | --- |
| **Key existence** | `ALL_PERMISSIONS` defines **29 keys** (`packages/shared/src/permissions.ts` L1–31) | `SOURCE-VERIFIED` |
| **Keys used but not defined** | `roles.manage`, `projects.access`, `users.resetPassword` | `SOURCE-VERIFIED` — grep of route files vs `ALL_PERMISSIONS` |
| **Role assignment (SQL path)** | Migration `19_authz_rebuild.sql` seeds the five system roles and **deliberately omits** `ipcs.approve` / `ipcs.resubmit` from every role | `SOURCE-VERIFIED` |
| **Role assignment (legacy JSON path)** | `ROLE_PERMISSIONS.admin = [...ALL_PERMISSIONS]` **includes** both `ipcs.*` keys; `storage/seed-users.ts` L19 generates the legacy role store from this constant | `SOURCE-VERIFIED` |
| **Effective authorization** | Resolved per request from DB: role permissions + `user_permission_overrides` (grant/deny) + `project_members` ladder | `SOURCE-VERIFIED` (`authorization.service.ts`, `middleware/auth.ts`) |

**The contradiction is real and material.** If a deployment seeds roles via migration 19, nobody can approve an IPC except through an explicit per-user `grant` override. If a deployment seeds via `seed-users.ts`, `admin` can approve. Both code paths ship in the repository. Determining which one ran is a **database question**, and the database was not reachable (§10). This is recorded as `Conflicting evidence` and is an **outstanding owner decision**, not something WP-0 may resolve.

### 7.2 `ipcs.approve` / `ipcs.resubmit` — vocabulary only, preserved

Per the standing owner decision, these two keys are **vocabulary**, not policy. WP-0 makes **no** assignment:

- No role was created, modified or suggested.
- `ipcs.approve` / `ipcs.resubmit` remain assigned to **no role** in the SQL seed.
- No `ROLE_BASE` mapping was invented.
- The role distribution of these keys remains an **unresolved owner decision** (carried D1).

**Separately noted, and not resolved:** the *route wiring* is asymmetric (`SOURCE-VERIFIED`):

| Route | Required | Consequence |
| --- | --- | --- |
| `/ipcs/:id/approve` | `ipcs.approve` | Hard gate |
| `/ipcs/:id/reject` | `ipcs.approve` | Hard gate |
| `/ipcs/:id/resubmit` | `ipcs.resubmit` **OR** `projects.edit` | `ipcs.resubmit` is **effectively optional** — anyone with `projects.edit` can resubmit |
| `/ipcs/:id/submit` | `projects.edit` | No `ipcs` key at all |
| `/ipcs/:id/start-review` | `projects.edit` | No `ipcs` key at all |

This is consistent with "vocabulary only" but it means **the vocabulary currently has no teeth on the resubmit path**. Whether that is intended is an owner decision (D1), not a WP-0 finding to fix.

### 7.3 Permission keys referenced but never defined

Three keys are enforced by route middleware but are absent from `ALL_PERMISSIONS`:

| Key | Used at | Consequence |
| --- | --- | --- |
| `roles.manage` | `roles.routes.ts` L74 (router-wide) | Role administration is gated on a key no seed grants from the shared constant. Only a manually-granted override or a DB role carrying the literal string can pass. |
| `projects.access` | `projects.routes.ts` L104; `auth.routes.ts` L334, L351 | Project-member management is gated on a key not in the canonical list. |
| `users.resetPassword` | `auth.routes.ts` L258 | Dead OR-branch; only `users.manage` can satisfy the check. |

**Why this matters.** `MANAGED_PERMISSIONS` in `authorization.service.ts` is built from `ALL_PERMISSIONS` (L16–20). A key absent from that array is not manageable through the overrides UI, not counted in `/users/:id/effective`, and not seedable from the shared constant. These three keys are therefore **enforceable but unadministrable** — they can only be satisfied by a raw database grant. That is `Conflicting evidence` between the permission catalogue and the middleware (`SOURCE-VERIFIED`, `STATIC-INFERENCE`).

The owner decision on who receives `projects.access` and `roles.manage` (carried D7) is **untouched** by WP-0. The existence defect is reported; the policy is not decided.

### 7.4 Routes with no permission key (authentication ≠ authorization)

Nine read routes carry `requireAuth` and nothing else (`SOURCE-VERIFIED`):

| Route | Consequence |
| --- | --- |
| `GET /projects/:projectId/boq/` | Any authenticated user reads any project's BOQ |
| `GET /projects/:projectId/ipcs/` | Any authenticated user lists any project's IPCs |
| `GET /projects/:projectId/ipcs/:id` | Any authenticated user reads any IPC in full |
| `GET /sites/` | Global site list, no scope |
| `GET /config/categories`, `GET /config/units` | Low sensitivity, but unguarded |
| `GET /import/:entity/template` | Low sensitivity |
| `POST /import/:entity/preview`, `POST /import/:entity/confirm` | **Writes through domain repositories** with no domain permission |
| `GET /search`, `GET|POST /notifications*` | Cross-entity read; global notification feed |

**The IPC read gap is the significant one.** IPC records are commercially sensitive (they carry amounts and deductions). `GET /ipcs/:id` being authenticated-only while `GET /ipcs/:id/status-events` correctly requires `projects.view` + scope is an **internal inconsistency**, not a deliberate design (`SOURCE-VERIFIED`).

### 7.5 Inline authorization bypass — document delete

`documents.routes.ts` L665 (`SOURCE-VERIFIED`):

```ts
const blocked = req.user?.roleName === 'admin' ? null : await deleteSafety.blockDocument(existing.id);
```

This is a **role-name string comparison performed outside `authorization.service`**. Consequences:

1. It bypasses the central resolver entirely — overrides, deny-grants and project access are never consulted for this branch.
2. It keys on `roleName === 'admin'`, so any **custom role literally named `admin`** also bypasses. `SystemRoleName` is a fixed union but `UserRoleName` explicitly allows arbitrary strings (`packages/shared/src/types.ts`), so the type system does not prevent this.
3. The route still requires `archive.delete` + project scope, so the bypass is *narrowed* but not *eliminated*: an admin can delete a document that `deleteSafety` would otherwise block.

This is the only place in the audited surface where a role name is compared as a string for an authorization decision. It is a **confirmed architectural defect** and a WordPress-1 hardening candidate.

### 7.6 Material-request approval is globally scoped

`POST /material-requests/:id/approve` (L109) and `/:id/issue` (L128) use `requirePermission(...)` — **global**, no `requireProjectAccess`, **no project scope resolver** (`SOURCE-VERIFIED`). Every other material-request mutation uses `requireProjectAccess(..., scopeMaterialRequestRow())`. Approval and issuance are the **highest-consequence** operations in the domain and are the only two without scope. This is an inconsistency with a real privilege implication: a user with `materialRequests.approve` can approve requests in projects they cannot otherwise read.

### 7.7 Stock does per-type authorization correctly

`POST /stock/transactions` (L195–222) is the model the rest of the codebase should follow (`SOURCE-VERIFIED`):

1. Coarse gate: `requireAnyPermission` across the five stock keys.
2. Derive the needed permission from `parsed.data.type` via `TYPE_PERMISSION`.
3. Resolve the project from `projectId`, or the warehouse→project map.
4. Call `can(ctx, needed, projectId)` — **central resolver, with scope**.

This is the only route that combines a coarse gate, a type-derived permission and an explicit scoped re-check. It should be treated as the reference pattern in WP-1, not as an exception.

### 7.8 Session and token model

| Property | Value | Evidence |
| --- | --- | --- |
| Access token TTL | 900 s (15 min) | `auth.service.ts` L17 |
| Claims | Identity only — role/permissions deliberately excluded | `auth.service.ts` comment block |
| Re-resolution | Every request, from DB | `middleware/auth.ts` L20–24 |
| Permission staleness | Structurally impossible | `STATIC-INFERENCE` from the above |
| JWT secret source | `process.env.JWT_SECRET`, else a file in the data dir, else generated and written | `auth.service.ts` L19–25 |

**Positive finding.** Excluding permissions from the token is the correct design and is genuinely implemented. Permission changes take effect immediately, with no token-expiry window.

**Caution.** The secret fallback writes a generated secret to the data directory (`auth.service.ts` L22–24). If that path is not preserved across deployments, every token is invalidated on restart — or, worse, if the directory is shared, the secret is shared. Not a defect, but a deployment property WP-1 must not break.

### 7.9 Policy loading and overrides

`authorization.service.ts` (286 L) implements:

- `MANAGED_PERMISSIONS = [...ALL_PERMISSIONS]` (L16–20) — the administrable set.
- `SCOPED_MIN_LEVEL` — permission → minimum project access level.
- `can(ctx, key, projectId?)` — the single decision function.
- `loadContext(userId)` — role permissions + overrides + memberships.
- `effective(ctx, projectId?)` — per-key effective state with source attribution, used by `/users/:id/effective`.

The `effective()` output records `{ effective, source, roleValue, override, projectAccess }` per key (`auth.routes.ts` L440–444), which is exactly the transparency a permission audit needs. **This is a genuine strength.**

### 7.10 Project scoping is inert on backfilled data

`20_authz_backfill.sql` cross-joins every user onto every project (`SOURCE-VERIFIED`):

| Role | Granted access |
| --- | --- |
| `admin` | `DELETE` |
| `viewer` | `READ` |
| all others | `WRITE` |

Consequences (`STATIC-INFERENCE`):

1. `project_members` grants are **maximal by default**, so `requireProjectAccess` narrows almost nothing on a backfilled database.
2. The scoping layer is **correct in shape but ineffective in practice** until someone deliberately reduces memberships.
3. WP3C decision D2 (deleted-project visibility) interacts with this: soft-deleted projects retain memberships.

Whether the backfill actually ran is a **database question** (§10). The migration file's existence proves intent, not execution.

---

## 8. Document workflow findings (WP0-D)

The brief required verifying six things: enum, status routes, transition validation, permission checks, server-side enforcement, invalid-transition rejection, and direct-API bypass. All six were examined. `PATCH /documents/:id/status` implements **one of six**.

### 8.1 Status enum — present and closed

`documents.validators.ts` L3 (`SOURCE-VERIFIED`):

```ts
export const DOCUMENT_STATUSES = ['draft', 'submitted', 'under-review', 'approved', 'rejected', 'superseded', 'archived'] as const;
```

Mirrored in `packages/shared/src/types.ts` as the `DocumentStatus` union (7 members, identical). Enum membership is enforced at the boundary (`documentStatusSchema`, L20–22). **Verdict: enum exists and is consistent across API and shared types.**

### 8.2 Status route — validation is membership-only; there is no transition matrix

`documents.routes.ts` L542–558 (`SOURCE-VERIFIED`):

```ts
documentsRouter.patch('/:id/status', requireProjectAccess('archive.edit', scopeDocumentRow()), async (req, res) => {
  const parsedStatus = documentStatusSchema.safeParse(req.body);
  if(!parsedStatus.success) return res.status(400).json({ message: 'حالة غير صالحة' });
  const existing = await documentRepository.findById(String(req.params.id));
  if (!existing) return res.status(404).json({ message: 'المستند غير موجود' });
  const updated = await documentRepository.update(existing.id, { status: parsedStatus.data.status });
  auditService.log(req, 'status-change', 'document', existing.id, { status: existing.status }, { status: parsedStatus.data.status });
  notificationService.create({ /* … */ });
  res.json(updated);
});
```

Against the six required checks:

| Required check | Present? | Evidence |
| --- | --- | --- |
| Enum enforced | **Yes** | `documentStatusSchema` L20–22 |
| Status route exists | **Yes** | L542 |
| Transition matrix | **No** | No `DOCUMENT_TRANSITIONS` constant anywhere in `apps/api/src` |
| Current-state read | **Yes** (read, but not compared) | L545 reads `existing` for the 404 and the audit delta — the status is never validated against it |
| Permission check | **Yes**, but wrong granularity | `archive.edit` only — no status-specific key |
| Invalid-transition rejection | **No** | Any enum value is accepted from any current state |
| Direct-API bypass possible | **Yes** | See below |

**`approved → draft` is achievable** by any holder of `archive.edit` with project access, via a single `PATCH` with `{"status":"draft"}`. The audit log does record the change (L548), which is the only mitigation. **This confirms WP3C finding B3 on current source.**

**What this does not prove.** It does not prove the UI exposes the transition, nor that any user has actually performed it. It proves the server accepts it. That is sufficient: server-side enforcement is the contract.

### 8.3 Second bypass — revision upload silently rewrites `approved → submitted`

`documents.routes.ts` L437–445 (`SOURCE-VERIFIED`):

```ts
const updated = await documentRepository.update(item.id, {
  revisions: [...item.revisions, revision],
  revision: nextLabel,
  fileName: revision.fileName,
  /* … */
  status: item.status === 'approved' ? 'submitted' : item.status,
});
```

Three distinct problems:

1. **A status transition is performed by a route whose authorization is `archive.edit`**, not by the status route. The transition is invisible to anyone auditing the status endpoint.
2. **The status change is not audited.** L446 logs `'new-revision'` with `{ revision }` old/new only. The status delta from `approved` to `submitted` appears in **no audit record**.
3. **The rule is hardcoded inline** (`item.status === 'approved' ? … : …`) rather than expressed in a policy structure. If a transition table is later introduced, this line will silently disagree with it.

This is a **separate** bypass from §8.2 and was not part of WP3C's B3 statement, which focused on the status endpoint. It is reported as a new finding.

### 8.4 The contrast — IPC proves the correct pattern exists

`IPC_TRANSITIONS`, `ipc.routes.ts` L86–92 (`SOURCE-VERIFIED`):

```ts
const IPC_TRANSITIONS: Record<IpcStatus, IpcStatus[]> = {
  draft: ['submitted'],
  submitted: ['under-review'],
  'under-review': ['approved', 'rejected'],
  approved: [],
  rejected: ['draft', 'submitted'],
};
```

`runTransition`, L296–347 (`SOURCE-VERIFIED`):

| Step | Line | Behaviour |
| --- | --- | --- |
| Open transaction | 307 | `BEGIN` |
| Row lock | 308 | `findByIdForUpdate(client, id, projectId)` — serializes concurrent transitions |
| Existence | 309–312 | 404 + `ROLLBACK` |
| Matrix check | 313–321 | 409 `INVALID_TRANSITION` with `from`/`to` + `ROLLBACK` |
| Non-submitter guard | 322–328 | 403 `SELF_APPROVAL_DENIED` when `opts.requireNonSubmitter` |
| Commit | — | `setStatus` + `appendStatusEvent` in one transaction |
| Audit | 350–352 | `ipc_status_change` with from/to/decision/notes |

`approved: []` is **terminal** — no transition out of `approved` exists, so an approved IPC cannot be un-approved through this path.

**This is the pattern the document workflow lacks.** The codebase demonstrates it knows how to do state machines correctly; documents simply were never given one. That is the single most actionable structural finding in this report.

### 8.5 Summary of WP0-D

| Question | Answer | Confidence |
| --- | --- | --- |
| Is the enum closed and consistent? | **Yes** | High (`SOURCE-VERIFIED` both sides) |
| Is there a status route? | **Yes** | High |
| Is there transition validation? | **No** | High — exhaustive absence |
| Are permission checks present? | **Yes but not status-specific** | High |
| Is enforcement server-side? | **Yes** — and that is the problem | High |
| Are invalid transitions rejected? | **No** | High |
| Is direct-API bypass possible? | **Yes, two independent paths** | High |

**Transition policy remains an outstanding owner decision (D-matrix).** WP-0 did **not** define a matrix, did **not** propose one, and did **not** modify any transition behaviour.

---

## 9. Migration and schema reconciliation (WP0-E)

### 9.1 What is on disk

`apps/api/src/database/migrations/` (`SOURCE-VERIFIED`, listing only — **not executed**):

| File | Bytes |
| --- | --- |
| `001_initial_schema.sql` | 13,858 |
| `05_create_boq_and_ipcs.sql` | 1,629 |
| `06_add_ipc_deductions.sql` | 74 |
| `07_add_region_and_doc_ipc_link.sql` | 260 |
| `08_seed_doc_categories.sql` | 815 |
| `09_fix_document_categories.sql` | 1,855 |
| `10_add_revisions_column.sql` | 173 |
| `11_add_stock_items_column.sql` | 367 |
| `11_modernize_dms.sql` | 1,644 |
| `12_backfill_document_revisions.sql` | 1,244 |
| `13_add_project_owner.sql` | 441 |
| `14_seed_runtime_stores.sql` | 1,882 |
| `15_import_json_history.sql` | 459 |
| `16_ipc_rejected_status.sql` | 421 |
| `17_core_uniqueness.sql` | 463 |
| `18_modernize_dms.sql` | 1,644 |
| `19_authz_rebuild.sql` | 4,699 |
| `20_authz_backfill.sql` | 771 |
| `21_direct_amounts.sql` | 566 |
| `22_phase14_core_columns.sql` | *(untracked)* |
| `23_phase14_ipc_workflow.sql` | *(untracked)* |
| `24_phase14_recovery_import_tables.sql` | *(untracked)* |

`down/` contains **only** `19`, `20`, `21`.

### 9.2 Runner semantics

`database/migrate.ts` (82 L, `SOURCE-VERIFIED`):

- Applies files in `localeCompare` order.
- Records each applied file in `_migrations`.
- **`createApp()` calls `runMigrations()` on boot.**

**Critical implication for this audit.** Starting the API server would execute migrations — a write. WP-0 therefore **did not start the server**, and no server was started at any point. This is recorded as a scope-constraint consequence, not an omission.

### 9.3 Structural problems in the migration surface

| # | Problem | Evidence | Consequence |
| --- | --- | --- | --- |
| 1 | **Duplicate version prefix `11`** — `11_add_stock_items_column.sql` and `11_modernize_dms.sql` | Directory listing | `localeCompare` orders `11_add…` before `11_modernize…`, so both apply, but the version is not unique. Any tooling that keys on version breaks. |
| 2 | **Duplicate content `11_modernize_dms.sql` ≡ `18_modernize_dms.sql`** | Both 1,644 B | The same DDL applies twice. Idempotent guards may save it; that is an assumption, not a guarantee, and cannot be checked without the DB. |
| 3 | **`down/` covers only 3 of 22** | `down/` listing | No rollback path for 19 migrations, including every Phase 14 migration. |
| 4 | **Gap at `02`–`04`** | Files absent | Either deliberately folded into `001` or lost. Unresolvable from source. |
| 5 | **Migrations 22–24 are untracked** | `git status` | They are **not in `HEAD`**. A `git checkout main` deployment has no Phase 14 schema support at all. |
| 6 | **Migrations are not provably applied** | No DB access | **File presence ≠ applied.** §10. |

### 9.4 Phase 14 migrations — content reconciliation (file contents only)

**`22_phase14_core_columns.sql`** — additive only (`SOURCE-VERIFIED`):

- `users.department`, `users.title` (O1). Explicitly does **not** touch `email` — honours the owner decision not to invent a column.
- `projects.deleted_at`, `projects.deleted_by` (O12) — soft delete.
- Partial index for live-project listings + plain index for delete audit.

**`23_phase14_ipc_workflow.sql`** — (`SOURCE-VERIFIED`):

- Creates `ipc_status_events` (append-only event log matching `ipc.repository.ts` `mapStatusEvent`).
- Adds/adjusts the IPC status CHECK constraint.
- **Financial NULL relaxations** — aligns with `nullableNumber()` in `ipc.repository.ts` L8–10, which maps `NULL` to `undefined` rather than `0`.

**`24_phase14_recovery_import_tables.sql`** — (`SOURCE-VERIFIED`):

- Creates the recovery/import tables.
- **`password_reset_tokens` has no `usage_token` column.**

### 9.5 The migration-to-code contradiction that blocks password reset

`services/password-reset-token.service.ts` (95 L, **untracked**) inserts a `usage_token` column. Migration 24 does not declare it. Therefore, **even if the module path were fixed, the insert would fail with a column-not-found error** (`SOURCE-VERIFIED` for both sides; `STATIC-INFERENCE` for the failure).

Combined with the TDZ bug and the missing module (§12.1–12.2), password reset has **three independent defects**, any one of which is fatal.

### 9.6 What this section does **not** claim

- It does **not** claim any migration ran.
- It does **not** claim any table exists.
- It does **not** infer column presence from a migration file, nor table presence from a repository reference. A repository that `SELECT`s from `ipc_status_events` proves only that *someone expected* the table.
- It does **not** claim `_migrations` contains any row.

All of the above are `NOT-VERIFIED` (§10, §13).

---

## 10. PostgreSQL verification results (WP0-F)

### 10.1 Records

> **`NOT VERIFIED — DATABASE ACCESS NOT AVAILABLE`**

### 10.2 Why verification was stopped rather than attempted

The brief permitted DB verification **only** if an approved instance and connection were already available **without configuration change or service start**, and required identifying the target carefully, documenting ambiguity, and stopping if multiple candidates existed. That condition was met.

Read-only observations (`SOURCE-VERIFIED` at the OS level):

| Observation | Result |
| --- | --- |
| PostgreSQL processes | **19** `postgres` processes running |
| Services | `postgresql-x64-17` — Running; `postgresql-x64-18` — **also Running** |
| Service binaries | `C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe … -D …\17\data` and `C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe … -D …\18\data` |
| Listener on 5432 | **Two** entries: `0.0.0.0:5432` and `[::]:5432` |
| Owning process | **PID 8220** — a single process owns both bindings |
| `psql` | **NOT FOUND** |
| `pg_isready` | **NOT FOUND** |
| `docker` | **NOT FOUND** |
| `node` / `npm` | Available |
| `apps/api/.env` | Exists; defines `DATABASE_URL`, `PORT`, `JWT_SECRET` — **values withheld from this report** |
| Root `.env` | Exists — **values withheld** |
| Infra files | `docker-compose.yml`, `Dockerfile.api`, `Dockerfile.web`, `.env.example`, `apps/api/.env.example` |

### 10.3 The ambiguity, stated precisely

- **Two PostgreSQL major versions are installed and both services report `Running`.**
- **A single process (PID 8220) owns both the IPv4 and IPv6 bindings on 5432.** That means only one of the two clusters can actually be serving 5432 — but **which one** cannot be determined from the process record, because the listener's executable path was not resolvable to a versioned data directory.
- **The only authoritative pointer is `DATABASE_URL` in `apps/api/.env`.** Reading it would be permitted (values stay out of the report), but resolving which *server process* it targets still requires connecting — and connecting requires a client, which is absent.
- **No `psql`, no `pg_isready`, no `docker`.** There is no read-only client available to issue a `SELECT`. `node` exists, and `pg` is a declared dependency, but **using it would mean running application code against a production-adjacent database**, which is a verification action the brief did not authorize beyond SELECT/metadata and which cannot be done without writing a script to disk — itself a file creation WP-0 forbids outside the single report.

**Choosing one instance would have been a guess.** WP-0 therefore stopped, exactly as WP0-F directs.

### 10.4 What is consequently unknown

Every item below is `NOT-VERIFIED`:

| Question | Status |
| --- | --- |
| Which PostgreSQL version/cluster is live on 5432 | Not verified |
| Whether the `addresses`/`apps/api` database exists | Not verified |
| Which migrations are recorded in `_migrations` | Not verified |
| Whether migrations 22, 23, 24 have been applied | **Not verified** |
| Whether `ipc_status_events` exists | Not verified |
| Whether `password_reset_tokens.usage_token` exists | Not verified |
| Whether `users.department` / `users.title` exist | Not verified |
| Whether `projects.deleted_at` / `deleted_by` exist | Not verified |
| Whether role rows contain `ipcs.approve` / `ipcs.resubmit` | **Not verified** |
| Whether `project_members` was backfilled (migration 20) | Not verified |
| Whether document statuses include `superseded` / `archived` in live data | Not verified |
| Whether any real IPC is in `approved` state | Not verified |
| Row counts, constraint presence, index presence | Not verified |

### 10.5 Explicit prohibition on substitution

Static inspection of migration files was **not** substituted for database verification, per the WP-0 brief. Section 9 describes what the SQL *says*. It does not describe what the database *contains*. Where this report needed a schema fact to reason about behaviour, it flagged the dependency rather than assuming it.

### 10.6 Effect on the verdict

The absence of `DATABASE-VERIFIED` evidence is why the verdict is **`PARTIALLY VERIFIED`** and not **`VERIFIED`**. It is *not* `BLOCKED`, because the primary object of WP-0 — the backend source re-baseline — was fully accessible and was completed. The blocker is confined to one layer.

---

## 11. WP3C finding revalidation

Five WP3C findings were revalidated against current source. WP3C statements were taken from `WP3C_PHASE13_TO_PHASE14_FRONTEND_RECONCILIATION_AUDIT.md` L1299–1306.

| ID | WP3C statement (abridged) | WP3C severity | Revalidation | Evidence |
| --- | --- | --- | --- | --- |
| **B1** | Three screens render synthetic fixture data in production with no guard and no signal | Critical | **Not verifiable within WP-0** (partially observed) | The claim is about `apps/web` render paths. WP-0's scope is the backend plus DB. WP3C already evidenced `Search.tsx` L4, `Items.tsx` L4, `Settings.tsx` L6, `Admin.tsx` L6 as fixture-backed and `mock/api.ts` L12–14 as the only `PROD` guard. **No backend fact contradicts or confirms it.** Recorded as carried, not re-adjudicated. |
| **B2** | Phase 14 documentation understates the backend by ~6 modules; building from it duplicates existing work | Critical | **Confirmed** | `phase-14c/04-api-readiness.md` claims 7 `EXISTING-VERIFIED` endpoints. Current source has ~118 registrations across 15 routers (§5). The understatement is not "~6 modules" but closer to an order of magnitude in endpoints. `SOURCE-VERIFIED`. |
| **B3** | Document status has no transition matrix on either side — O3 unmitigated | Critical | **Confirmed** (and extended) | `documents.validators.ts` L3/L20–22 validate enum membership only; `documents.routes.ts` L542–558 writes any status from any state with `archive.edit`; **no `DOCUMENT_TRANSITIONS` constant exists in `apps/api/src`**. Additionally discovered: `POST /:id/revisions` L444 rewrites `approved → submitted` with no audit of the status change (§8.3). `SOURCE-VERIFIED`. |
| **B5** | `lookups` yields a raw `TypeError` instead of the designed explicit failure | High | **Not verifiable within WP-0** | This is a frontend shape mismatch at `Home.tsx` L44–45, `Stock.tsx` L75/162–163, `Requests.tsx` L236–237 (function vs object). Backend `GET /config/categories` and `/config/units` return arrays (`config.routes.ts` L8–9) — consistent with the frontend expecting a callable, but the `TypeError` itself is a client-runtime claim outside WP-0 scope. |
| **B8** | Migrations 22–24 unapplied while backend code references them | High | **Partially confirmed** | *Confirmed half:* migrations 22–24 are **untracked** (`git status`), i.e. absent from `HEAD`; and backend code does reference their objects (`ipc_status_events` via `ipc.repository.ts`; `usage_token` via `password-reset-token.service.ts`; `deleted_at` via projects). *Unconfirmed half:* **"unapplied" is a database claim that WP-0 could not verify** (§10). Recorded as **partially confirmed**: the source-side inconsistency is confirmed; the application state is `NOT-VERIFIED`. |

### 11.1 Findings revalidated as **resolved** in current source

None. No WP3C finding was found to be resolved by later changes.

### 11.2 Findings **contradicted** by current evidence

None. Every revalidated finding either held or fell outside WP-0's reach.

### 11.3 Net effect on WP3C's verdict

WP3C's verdict was `FOUNDATION SUITABLE — SIGNIFICANT INTEGRATION REQUIRED`, with **Option A adopted and extended in place, sequenced A-then-D**. Nothing in WP-0 contradicts that verdict. B2 and B3 are strengthened; B8 is narrowed to its defensible half. WP3C's `WP3A` verdict remains recorded as **withdrawn / false** and is unaffected by this work.

---

## 12. Confirmed blockers

Ordered by severity. Every item is `SOURCE-VERIFIED` unless stated.

### 12.1 BLOCKER-1 — Backend cannot resolve a module at import time (password reset)

`auth.routes.ts` L11:

```ts
import { … } from '../password-reset-token/service.js';
```

**No `apps/api/src/modules/password-reset-token/` directory exists.** The only candidate is an untracked `apps/api/src/services/password-reset-token.service.ts` — a different path shape (`services/` not `modules/`, `.service.ts` not `service.ts`).

**Evidence it is not a stale import.** `git show HEAD:apps/api/src/modules/auth/auth.routes.ts` contains **no password-reset code at all**. The working tree **adds 56 lines and removes 19**. The import was introduced in uncommitted work and the module was never created at the expected path.

**Consequence.** The process fails at module resolution: `ERR_MODULE_NOT_FOUND`. Nothing downstream of `auth.routes.ts` runs — and `routes/index.ts` imports it at L10, so **the entire API is unreachable**, not merely the reset feature. Severity is total, not local.

### 12.2 BLOCKER-2 — `password-reset-token.service.ts` is defective in two further, independent ways

Even with the path fixed, the feature fails:

**(a) Temporal dead zone.** The function references `usageToken` inside the `INSERT` **before** `const usageToken = uuidv4();` is declared. `let`/`const` bindings are hoisted but uninitialized, so this is a `ReferenceError: Cannot access 'usageToken' before initialization` at runtime. `SOURCE-VERIFIED`.

**(b) Column does not exist.** The `INSERT` writes `usage_token`. Migration 24's `password_reset_tokens` **has no such column** (§9.4). The insert would fail with `column "usage_token" … does not exist`. `SOURCE-VERIFIED` for the mismatch; `STATIC-INFERENCE` for the error.

**Three independent fatal defects in one uncommitted feature.** Any one suffices to break it; fixing one does not fix the feature.

### 12.3 BLOCKER-3 — Document status has no server-side transition policy

`PATCH /documents/:id/status` accepts any of 7 statuses from any current state, guarded only by `archive.edit` + project scope. `approved → draft` is a single HTTP request. A second path (`POST /:id/revisions` L444) rewrites `approved → submitted` as an unaudited side effect.

**Why this is a blocker rather than a finding.** The frontend rebuild will surface document status as a first-class workflow. A backend that accepts arbitrary transitions makes any UI transition guard decorative. The **policy** is an owner decision (D-matrix); the **absence of enforcement** is a defect regardless of what the policy turns out to be.

### 12.4 BLOCKER-4 — Insert vs. schema mismatch for Phase 14 recovery tables

`password_reset_tokens` is the concrete instance (§12.2b). The general risk — Phase 14 code referencing Phase 14 columns that the Phase 14 migrations may not create — is **`NOT-VERIFIED` at the database layer** and cannot be closed within WP-0. It is recorded as a blocker-of-confidence: WP-1 must not assume schema/code agreement.

### 12.5 BLOCKER-5 — No PostgreSQL verification path exists

As recorded in §10. Two running clusters, one ambiguous listener, no client. Any downstream plan that depends on database facts (migration state, role grants, backfill reality) is **blocked on access**, not on analysis.

### 12.6 Not blockers, but must not be lost

| Item | Why it matters |
| --- | --- |
| `ipcs.approve` / `ipcs.resubmit` assigned to no role in SQL but to `admin` in the shared constant | Blocks WP-4. Owner decision D1. |
| `roles.manage`, `projects.access`, `users.resetPassword` used but undefined | Enforceable-but-unadministrable keys. Owner decision D7 for policy. |
| `admin` role-name string bypass in document delete | Only inline authz bypass found. |
| Material-request approve/issue globally scoped | Highest-consequence MR operations are the only unscoped ones. |
| Nine permission-less read routes | Includes full IPC read (`GET /ipcs/:id`). |
| Notifications are global, not per-user | Cannot support a per-user notification UX as built. |
| Restore `commit` → 501 | `SYSTEM` surface promises more than it delivers. |
| `/auth/sessions` is a placeholder | Session revocation UI cannot be truthful. |
| `04-api-readiness.md` contradicts reality | Must not be used as a WP-1 input. |

---

## 13. Unverified questions

Each is stated so it can be closed by a later, authorized work package. **None was guessed at.**

| # | Question | Why unverified | What would close it |
| --- | --- | --- | --- |
| Q1 | Which PostgreSQL cluster serves 5432? | No client; ambiguous listener (§10.3) | Owner identifies the target instance |
| Q2 | Which migrations are in `_migrations`? | No DB access | Read-only `SELECT version FROM _migrations` |
| Q3 | Are migrations 22–24 applied? | No DB access | Same |
| Q4 | Does `ipc_status_events` exist, with the columns `ipc.repository.ts` expects? | No DB access | `\d ipc_status_events` |
| Q5 | Does `password_reset_tokens.usage_token` exist? | No DB access | `\d password_reset_tokens` |
| Q6 | Do `users.department` / `users.title` / `projects.deleted_at` exist? | No DB access | `\d users`, `\d projects` |
| Q7 | Which roles actually hold `ipcs.approve` / `ipcs.resubmit`? | No DB access | `SELECT … FROM role_permissions` |
| Q8 | Did `20_authz_backfill.sql` actually run? | No DB access | Row count of `project_members` |
| Q9 | Do live documents use `superseded` / `archived`? | No DB access | `SELECT DISTINCT status FROM documents` |
| Q10 | Are any IPCs in `approved` state (and thus terminal-locked)? | No DB access | `SELECT status, count(*) FROM ipcs GROUP BY 1` |
| Q11 | Does the API build/type-check cleanly? | WP-0 forbade builds | A `tsc --noEmit` in an authorized WP |
| Q12 | Does the API boot after BLOCKER-1 is fixed? | WP-0 forbade starting the server (would run migrations) | Authorized boot in a sandbox DB |
| Q13 | Do the WS3C B1 fixture screens still bypass `PROD`? | Frontend, out of WP-0 scope | WP3C's evidence stands; a frontend WP must re-check |
| Q14 | Does `GET /search` return correct cross-entity results? | Needs DB + running app | Runtime test |
| Q15 | Is `deleteSafety.blockDocument` itself correct? | Implementation not audited in WP-0 | Focused read of the service |
| Q16 | What does `apps/api/.env` `DATABASE_URL` point at? | Value deliberately withheld | Owner may disclose target without secrets |
| Q17 | Do `down/` migrations 22–24 exist elsewhere? | Absent from `down/`; nothing indicates otherwise | Owner confirmation |
| Q18 | Is `11_modernize_dms.sql` ≡ `18_modernize_dms.sql` byte-identical? | Same byte size; contents not diffed | `git diff --no-index` (read-only) |

---

## 14. Outstanding owner decisions

Carried from WP3C and **not advanced** by WP-0. WP-0 has no authority over any of these.

| ID | Decision | Blocks | WP-0 stance |
| --- | --- | --- | --- |
| D1 | Which role(s) receive `ipcs.approve` / `ipcs.resubmit` | WP-4 | **Not decided. Not suggested.** Keys remain vocabulary. No `ROLE_BASE` invented. |
| D-matrix | The document status transition table | WP-5 | **Not decided. Not drafted.** No transition modified. |
| D7 | Policy for `projects.access` / `roles.manage` (who receives them) | WP-1 scope | **Not decided.** Their *existence* defect is reported (§7.3); the *policy* is untouched. |
| D2 | Deleted-project visibility | WP-1 | **Not decided.** Interaction with migration 20 noted (§7.10). |
| Option A/B/C/D | Integration approach for the Phase 14 frontend | WP-1 | WP3C adopted **A, sequenced A-then-D**. WP-0 confirms nothing that changes this. B rejected as disproportionate; C rejected on 158 marker lines / 79 hunks in `apps/web/src`. |
| D-packaging | Where the Phase 14 frontend lives | WP-1 | **Not decided.** |
| O1–O13 | Product-scope decisions (COS is not an ERP; contract value independently entered; disbursements deferred; tax/retention/advance deferred; dashboard operational not financial; etc.) | Multiple | **Unchanged.** No decision reopened. |

### 14.1 Decision explicitly *not* taken by WP-0

The two-PostgreSQL-cluster ambiguity was **not** resolved by picking one. It was resolved by **stopping** (§10). The owner must identify the target before any database-dependent work package can proceed.

---

## 15. Recommended next steps

> **These are recommendations only.** They do not authorize WP-1. No step below may be started without explicit owner approval.

### 15.1 Immediate — close the blockers

| # | Recommendation | Rationale | Risk if deferred |
| --- | --- | --- | --- |
| R1 | Owner resolves **BLOCKER-1** (module path for password reset) and **BLOCKER-2** (TDZ + `usage_token` schema mismatch) as one unit | Three defects, one feature; fixing one leaves it broken | API cannot boot; every downstream test is meaningless |
| R2 | Owner decides **D-matrix**, then a WP implements server-side transition validation using the IPC pattern already proven at `ipc.routes.ts` L86–92 / L296–347 | The correct pattern exists in-repo; documents simply lack it | Any document-status UI ships with decorative guards |
| R3 | Owner identifies the **PostgreSQL target instance** so DB verification can be completed | Two clusters running; one ambiguous listener | All schema/role/migration facts stay unknown |
| R4 | Treat `phase-14c/04-api-readiness.md` as **superseded** and replace it with the §5 inventory | Document understates by an order of magnitude | WP-1 duplicates ~110 endpoints |

### 15.2 Sequencing

The dependency order implied by the evidence:

```
R3 (DB target)  ─┬─► DB verification (Q1–Q10)
                 │
R1 (boot fix)  ──┼─► API can start ──► runtime verification
                 │
R2 (D-matrix)  ──┴─► document transition enforcement
R4 (doc fix)   ────► accurate WP-1 input
```

R1 and R3 are **independent** and can proceed in parallel. R2 depends on an owner policy decision, not on code. R4 is documentation-only and can proceed immediately.

### 15.3 What must NOT happen next

- **Do not start WP-1 on the strength of this report.** WP-0 audits; it does not authorize.
- **Do not implement D-matrix on WP-0's authority.** The matrix is an owner decision; WP-0 deliberately drafted none.
- **Do not assign `ipcs.approve` / `ipcs.resubmit` to any role** to make the approval workflow "work". That would violate the standing owner decision.
- **Do not resolve the two-cluster ambiguity by connecting to whichever answers first.** That is the guess WP0-F forbids.
- **Do not run the API server to "check" anything.** `createApp()` runs migrations on boot (§9.2).
- **Do not use `04-api-readiness.md` as an inventory.** It is contradicted (§6.3).

---

## 16. Scope compliance statement

### 16.1 What WP-0 did

| Activity | Performed | Notes |
| --- | --- | --- |
| Read repository source | **Yes** | Backend source, migrations, shared package, route files, services, repositories |
| Read Phase 14 / Phase 13 documentation | **Yes** | For contract reconciliation and WP3C revalidation |
| Capture Git state | **Yes** | Initial and final, compared |
| Read OS-level PostgreSQL state | **Yes** | Process/service/listener/tool enumeration — read-only |
| Discover and read skills | **Yes** | Four, recorded in §3 |
| Author one report | **Yes** | This file |

### 16.2 What WP-0 did **not** do

| Prohibition | Complied | How confirmed |
| --- | --- | --- |
| Modify or create source files | **Yes** | No edit tool used on any `.ts`, `.tsx`, `.js`, `.sql`, `.json` |
| Modify configuration | **Yes** | `.env`, `docker-compose.yml`, `Dockerfile.*`, `package.json` untouched |
| Modify documentation | **Yes** | No pre-existing `.md` edited |
| Create directories | **Yes** | Report directory verified to exist before writing; nothing created |
| Run migrations | **Yes** | No migration runner invoked; no SQL executed |
| DDL / DML | **Yes** | No statement issued against any database |
| Seeds | **Yes** | No seed script run |
| Change schema / roles / grants | **Yes** | None |
| Change PostgreSQL config, service, port or auth | **Yes** | Services observed, never touched |
| Install anything | **Yes** | No installer or package manager invoked |
| Build anything | **Yes** | No `tsc`, no bundler, no build script |
| Start a dev server | **Yes** | No server started — this also avoided the boot-time migration write |
| Start containers | **Yes** | No `docker` command; `docker` is not installed |
| Change firewall / env / secrets | **Yes** | None |
| Git mutations | **Yes** | No commit, branch, checkout, stash, reset, add |
| Branch switching | **Yes** | Remained on `main` throughout |
| Begin WP-1 | **Yes** | No implementation, no fix, no proposal applied |

### 16.3 Final verification

| Check | Result |
| --- | --- |
| Source changes made | **None** |
| Config changes made | **None** |
| Documentation changes made (other than this report) | **None** |
| Database changes made | **None** |
| Migrations executed | **None** |
| Git mutations | **None** |
| Branch at start / end | `main` / `main` — unchanged |
| HEAD at start / end | `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf` / same — unchanged |
| Porcelain entries at start / end | 46 / 46 — unchanged |
| Staged entries at start / end | 0 / 0 — unchanged |
| Stashes at start / end | 0 / 0 — unchanged |

### 16.4 Exactly one file created

| Item | Value |
| --- | --- |
| Path | `docs/frontend-rebuild/phase-14/phase-14c/WP0_BACKEND_REBASELINE_AND_DATABASE_READONLY_VERIFICATION.md` |
| Count | **1** |
| Git status | **Untracked** — `docs/` is not tracked (`git ls-files docs` = 0 before and after). The porcelain count therefore does not change: the file is inside an untracked directory that Git already collapsed to a single `docs/` entry. |

**This is the only artefact WP-0 produced.** No temporary scripts, no scratch files, no logs.

### 16.5 Environmental side effects to disclose

| Side effect | Honest disclosure |
| --- | --- |
| OS-level process/service/listener enumeration | Read-only queries to Windows service and TCP tables. No service state changed. |
| `apps/api/.env` and root `.env` **existence and key names** observed | **Values were not read into the report and are not disclosed.** Only the key names `DATABASE_URL`, `PORT`, `JWT_SECRET` are named, and only to establish that a target *exists* but is unresolved. |
| No secret, connection string, password or token appears in this report | Stated as a positive assertion. |
| No personal or business data retrieved | No query was issued, so no row data was exposed. |
| File system reads | Source and documentation only. |
| No network calls to external services | None. |

### 16.6 Report integrity

| Property | Value |
| --- | --- |
| Sections | 16, numbered §1–§16, plus a preamble evidence-label legend |
| Evidence labels used | All five defined; `DATABASE-VERIFIED` defined and **declared unused** |
| Findings lacking a source citation | None |
| Claims marked `SOURCE-VERIFIED` that were not read | None |
| Transition policy modified | **No** |
| Role assignment invented | **No** |
| `ROLE_BASE` invented | **No** |
| WP-1 authorized | **No** |
| PASS / GO verdict issued | **No** |

---

## Final verdict

> ## `WP-0 PARTIALLY VERIFIED — DATABASE OR SOURCE LIMITATIONS`

**Basis.**

- **Verified:** the backend source re-baseline is complete. All 15 routers, ~118 route registrations, the authorization architecture, the IPC workflow, the document status gap, the migration surface and the WP3C findings were established from source with file-and-line citations (§4–§9, §11).
- **Limitation:** PostgreSQL verification was not possible. Two clusters run, one ambiguous listener exists, no client is available, and the target was not resolvable without a guess (§10). **No finding in this report is `DATABASE-VERIFIED`.**
- **Not `BLOCKED`:** because the primary subject of WP-0 — the backend source — was fully accessible and fully audited.

**This verdict does not authorize WP-1, does not constitute owner approval, and does not resolve any of the six outstanding owner decisions in §14.**

---

**WP-0 complete. Awaiting explicit owner review and authorization.**
