# Phase 12 — Prototype-to-Live API Contract Map

Status: **DOCUMENTATION ONLY — static source analysis. No implementation. No runtime testing. No database access. No API requests.**

Baseline: branch `main`, HEAD `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf`, November 2026.

Companion documents: Doc A (`phase-12-separation-migration-architecture-report.md`), Doc B (`phase-12-data-migration-matrix.md`), Doc C (`phase-12-api-auth-permissions-map.md`), Doc D (`phase-12-migration-validation-rollback-plan.md`), Doc E (`phase-12-owner-decision-record.md`), Stage 1 (`phase-12-stage-1-target-design.md`), Stage 2 / 2B / 2C reports, Owner review (`phase-12-owner-review-and-master-plan-reconciliation.md`), Owner acceptance (`phase-12-owner-acceptance-record.md`), Service identity addendum (`phase-12-service-identity-verification-addendum.md`).

**Language note:** technical body in English, per the Doc A header convention. The owner-facing summary is delivered in Arabic in the chat report.

---

## Evidence labels used in this document

| Label | Meaning |
|---|---|
| `VERIFIED` | Read directly from the named file at the named line. Reproducible by re-reading the repository. |
| `PARTIALLY VERIFIED` | The route/method/path/permission is verified, but at least one contract element (request body shape, response shape, side effect, or denial semantics) was not fully read. |
| `INFERRED CANDIDATE` | An engineering deduction from verified code, with the derivation named. Not observed directly. Must not be treated as a fact. |
| `UNKNOWN` | Could not be established from authorized static reading. No guess is offered. |
| `MOCK-ONLY` | Exists only in the prototype (Phase 03), never in the live API. |
| `NOT APPLICABLE` | The concept does not apply to that layer. |

**Reuse classes** (exactly six, used in §10 and nowhere else as a classification):

| Class | Meaning |
|---|---|
| `REUSE BUSINESS CAPABILITY` | The business rule/behaviour is correct and should be carried into the target system. The transport, payload shape, and possibly the implementation may change. |
| `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` | The existing implementation is a sound starting point but must be modified (schema, contract, or layering) before it serves the target design. |
| `REUSE LEGACY HTTP CONTRACT` | The exact existing HTTP path + method + request + response shape can be preserved. This requires that all four elements were verified. |
| `NEW TARGET CONTRACT REQUIRED` | No existing endpoint satisfies the UI/UX requirement. A new contract must be designed. |
| `REPLACE LEGACY CAPABILITY` | The existing endpoint is structurally unsuitable (dead, stub, unsafe, or modelling the wrong thing) and should be removed rather than adapted. |
| `UNKNOWN — NEEDS EVIDENCE` | Available evidence is insufficient to choose any class. |

> **Terminology discipline:** "interface operation", "adapter method", and "business operation" are three different things in this document and are never used interchangeably. A prototype adapter method count is not a business-operation count (see §6.3).

---

## 1. Executive Summary and Limitations

### 1.1 What this document is

This is the authoritative Phase 12 bridge between three separate layers:

- **Layer A** — the *verified* legacy HTTP surface that exists in `apps/api` today (§5).
- **Layer B** — the *UI/UX requirements* implied by the approved prototype (Phase 03) and its mock adapter (§4, §6).
- **Layer C** — the *proposed target contract* that the rebuilt frontend should consume (§8, §9).

Layers are kept strictly separate. A Layer C entry is never presented as existing. A Layer A entry is never presented as the desired design.

### 1.2 The governing hierarchy

The rebuild is **UI/UX-First**. Conflicts are resolved in this order, top wins:

1. Approved UI/UX (Phase 03 prototype as accepted by the owner)
2. Business rules and security invariants
3. Target API contract
4. New database schema
5. Legacy API surface and legacy schema — **evidence only, never a constraint on the interface**

The consequence is explicit: **the UI is never regressed to fit a legacy limitation.** If the legacy API cannot express what the approved interface needs, the target contract is designed and the legacy endpoint is classified as adapted or replaced. Decision D2 (reuse the existing PostgreSQL database as the topology direction) does **not** imply preserving the legacy schema one-to-one.

### 1.3 Headline findings

| # | Finding | Label |
|---|---|---|
| F-01 | The live API exposes **108 HTTP endpoints**: 107 route handlers across 15 domain `*.routes.ts` files, plus `GET /api/health` in `app.ts`. | `VERIFIED` |
| F-02 | The prototype mock adapter exposes **65 methods across 8 namespaces**. That is a *method* count, not a business-operation count. After removing derived-value helpers, invariant helpers, and duplicated lookups, the distinct business operations are **≈29**. | `VERIFIED` (method count) / `INFERRED CANDIDATE` (operation count) |
| F-03 | The prototype's authentication is **entirely mock**: role tiles → `userApi.get()` → `sessionStorage['cos-proto-user']`. There is no password, no token, no server call, and the mock adapter exports no auth method at all. The live backend has a full cookie + rotating-refresh-token session model. **These are not reconcilable by mapping; login/session is a new target contract.** | `VERIFIED` (both sides) |
| F-04 | `GET /api/auth/sessions` exists and is authenticated, but its handler returns a **placeholder object** (`{ note: 'Active-sessions UI is future work; …' }`), not session data. A "list my devices" workflow therefore has no live capability. | `VERIFIED` |
| F-05 | `DELETE /api/stock/transactions/:id` exists but **unconditionally returns 400**. It is a dead capability, not a working delete. | `VERIFIED` |
| F-06 | Inventory IPC is mounted at **`/api/projects/:projectId/ipcs`** (plural), not `/api/projects/:id/ipc`. BOQ is at `/api/projects/:projectId/boq`. | `VERIFIED` |
| F-07 | `GET /api/folders` is gated only by `requireAuth`; no `archive.*` permission is checked in the handler. Folder names and structure are readable by any authenticated user. | `VERIFIED` |
| F-08 | Document listing already supports a **richer filter set** than the prototype mock (**10** filters + sort + paging), including `from`/`to` date range and `revision`. The legacy contract is *ahead* of the prototype here, not behind. The ten filters are `q, projectId, folderId, siteId, category, documentType, revision, status, from, to` (`documents.routes.ts:74-84`). | `VERIFIED` |

### 1.4 Limitations (read before using any classification)

- Static reading only. **No endpoint was executed.** Every response shape marked `PARTIALLY VERIFIED` or `UNKNOWN` remains unproven until either the source is read in full or an authorized runtime check is performed.
- Repository lists (`documentRepository.list()`, `projectRepository.list()`, …) are **in-memory post-fetch filtering**. Several lists therefore do not scale and have no true database-level pagination. This is an implementation fact, not a contract guarantee.
- No claim of production readiness is made anywhere in this document.
- Phase 12 is **not closed** by this document.
- Cross-cutting service reading is **partial and recorded per file**. Read this round: `audit.service.ts` (`list` at `:54-99`), `global-search.service.ts` (full), `notification.service.ts` (full), `stock.service.ts` (`DeleteSafetyService` at `:140-209`). **Still not read in full:** `backup.service.ts`, `excel.service.ts`, the internals of the `smart-import/*` helpers, and the remainder of `stock.service.ts` above line 120. Their shapes remain `UNKNOWN` (U-03, U-09), not "verified by absence". **R-129 update:** `import.routes.ts` is now read in full (all 7 handlers, both mapper/entity tables, both confirm loops) together with `errors.ts`, `import-history.repository.ts`, `pg-base.repository.ts`, `document.repository.ts`, `001_initial_schema.sql` and `app.ts`; U-07 is resolved for the legacy import surface (§5.3.1). The `excel.service.preview()` response envelope remains `UNKNOWN`.
- **Git evidence limitation:** `docs/` is untracked in this repository, so `git status` cannot independently prove that only the two authorized documents changed. The scope claim rests on the per-file read/write record and file timestamps, and is stated as such in §15.5.
- **An unknown response shape is not proof of a missing capability.** Where a route and its service signature were verified but a downstream shape was not, the label is `UNKNOWN` or `PARTIALLY VERIFIED`, never `NEW TARGET CONTRACT REQUIRED` by default (see W-37/W-39, §4.6).

---

## 2. Scope and Governing Decisions (D1–D8)

### 2.1 Scope of this task

In scope: static analysis of `apps/api` route/validator/service files, and static analysis of the Phase 03 prototype (`src/app/router.tsx`, `src/services/api/**`, `src/app/providers/auth.tsx`, `src/services/api/adapters/mock/api.ts`), producing a target architecture that is design-only.

Out of scope and **not performed**: application source/test changes, SQL/DDL/migrations, any database connection, PostgreSQL 18 configuration, live API requests, service/config/dependency/auth/RBAC changes, secret access or rotation, namespace change, adapter implementation, Git staging/commit/reset/clean.

### 2.2 Decisions carried forward verbatim

| ID | Decision | Effect on this document |
|---|---|---|
| **D1** | **Architecture Option B** — logical separation with **selective reuse** — *as recorded in the historical ODR*. **Architecture Option A is the operative owner instruction for the current scope**; the divergence is preserved, not resolved (§14.3, §14.4.2). This is a different label from **D-SPEC-01 Option (b)** (the Import Ledger deferral, §14.4.1). | Reuse is decided per capability (§10), never wholesale. There is no blanket "reuse the legacy contract" position. |
| **D2** | Reuse the existing PostgreSQL database — **topology and design direction only**. | The target schema (§9) is a conceptual model on the existing database. It is not constrained to mirror legacy tables. |
| **D3** | API namespace is **deferred**; keep `/api/`. | Every target path in §8 is written under `/api/`. No `/api/v1`, no `/v2`, no namespace change is proposed or implied. |
| **D4** | 18-file conflict-marker repair completed 2026-10-29; a Typecheck run with exit 0 is recorded in the acceptance record. | **`HISTORICAL_PASS__CURRENT_UNVERIFIED`** — the historical pass is preserved as acceptance evidence; no new Typecheck was run for R-129 or R-130 and current status is not asserted. The contradictory evidence is retained (see §14.4.4). |
| **D5** | Secret-management / rotation **planning approved; execution NOT authorized**. | §11 states invariants only. No secret is read, moved, rotated, or printed. |
| **D6** | JSON `audit_logs` / `notifications` → PostgreSQL **approved as task direction; execution gated**. | §9 models both as relational tables. §15 records that no schema change may execute without the gate. |
| **D7** | Standalone HTTP adapter **approved as a design topic only; implementation NOT authorized**. | §12 assesses adapter usefulness. No adapter code is designed to implementation depth, and none is written. |
| **D8** | Migration / validation / rollback plan **approved 2026-10-29; stage gates remain mandatory**. | §15 restates the gates. Nothing here authorizes a migration. |

### 2.3 Boundary statement for the reader

Documenting a target endpoint is **not** authorization to build it. Classifying a legacy endpoint as `REUSE LEGACY HTTP CONTRACT` is **not** authorization to freeze it. Both are design records awaiting owner review.

---

## 3. Methodology

### 3.1 Evidence sources (all read-only)

| Source | What it establishes |
|---|---|
| `apps/api/src/app.ts` | Global middleware order, JSON limit, `/api/health`, SPA fallback, error handlers |
| `apps/api/src/routes/index.ts` | The 15 `apiRouter.use(...)` mounts and their order |
| `apps/api/src/modules/**/*.routes.ts` (15 files) | Every handler, its line number, its middleware, its status codes |
| `apps/api/src/modules/**/*.validators.ts` | Zod schemas: field names, required/optional, enums, coercions, defaults |
| `apps/api/src/middleware/auth.ts` | `requestContext`, `requireAuth`, `requirePermission`, `requireAnyPermission`, `requireProjectAccess`, `requireAnyProjectAccess` |
| `apps/api/src/services/projectScope.ts` | Project-scope resolvers, row scopes, `filterVisible`, `grantProjectAccess`, hidden-existence behaviour |
| `apps/api/src/services/filter.service.ts` | `applySearch` / `applySort` / `applyPagination` contract |
| `apps/api/src/services/authorization.service.ts` | `MANAGED_PERMISSIONS`, `SCOPED_MIN_LEVEL`, `AccessLevel` rank |
| `packages/shared/src/permissions.ts` | `ALL_PERMISSIONS` (28 keys), `ROLE_PERMISSIONS` (5 seeded roles) |
| `docs/frontend-rebuild/phase-03-prototype/src/app/router.tsx` | Prototype route tree and guards |
| `…/src/app/providers/auth.tsx` | Prototype auth model (mock-only) |
| `…/src/services/api/adapters/mock/api.ts` | Mock export inventory, seed data shape, mock-side validation rules |
| `…/src/services/api/{index,configuration,client,errors}.ts` | Facade, `ApiAdapter` seam, `API_MODE`, `API_BASE_URL`, error taxonomy |
| `apps/api/src/database/migrations/*.sql` | Legacy schema evidence (column names, enums, constraints) |

### 3.2 Counting rules (so the numbers are reproducible)

- **Endpoint** = one `router.<verb>(...)` registration reachable over HTTP, plus `app.get('/api/health')`. Router-level `use()` calls are middleware, not endpoints.
- **Route handler count excludes** nested router mounts (a mount is not a handler).
- **Adapter method** = one callable on a prototype export object. **Business operation** = one user-meaningful action that changes or reads domain state. Derived-value helpers (`boqTotal`, `remaining`, `summary`) and invariant helpers (`guard`, `adminCountAfter`) are neither.
- **Two mounts at `/users`** (`usersExtRouter`, `usersRouter`) are counted as one domain, 16 handlers.

### 3.3 Verification rule applied to every row

A row is `VERIFIED` only when method + path + at least one of {authz, request shape, response shape, status codes} was read at a named line. Otherwise the row carries `PARTIALLY VERIFIED` and names what is missing. No row is upgraded by inference.

---

## 4. Workflow Inventory (Layer B — UI/UX requirements)

This section is derived from the prototype route tree and its feature components. It describes **what the approved interface needs**, independent of whether the backend can currently do it.

Prototype route tree (`src/app/router.tsx`): `/login`; index `Home`; `projects`; `projects/:id` with nested `overview | sites | documents | warehouses | stock | financials`; `financials`; `archive`; `inventory`; `inventory/warehouses`; `inventory/items`; `inventory/stock`; `inventory/requests`; `admin`; `audit`; `reports`; `settings`; `search`; `notifications`; `403`; `_test/crash`; `*`.

Gap severity legend: **A** = live capability exists and is sufficient; **B** = exists but needs adaptation; **C** = missing, must be created; **D** = live endpoint is a stub/dead and must be replaced.

**Requirement-layer legend (applies to every row, detailed in §4.7):**

- **A — verified prototype behavior.** What the approved Phase 03 prototype actually does today, as read from its route tree, components, and mock adapter. This is evidence, not a mandate to reproduce mock shortcuts.
- **B — required production/security behavior.** What must be true in production regardless of what the prototype showed (server-side authorization, immutable ledgers, transition enforcement, paging at scale). **B is never optional and is never dropped because the prototype lacked it.**
- **C — optional new UX/product capability.** A genuinely new product idea that is neither in the prototype nor required for security/correctness. **C requires explicit owner approval before it appears in any target contract.** It is never presented as an approved prototype requirement.

Rows below keep their one-line summary; §4.7 carries the explicit A/B/C split for the workflows where the distinction changes the design.

### 4.1 Identity and access

| ID | Workflow | Prototype screen | UI/UX requirement | Live support today | Gap | Target decision |
|---|---|---|---|---|---|---|
| W-01 | Sign in | `/login` (role tiles) | **A:** role tiles → mock user, no credentials and no token. **B:** real credential verification, `HttpOnly` cookie session, server-resolved permissions on landing. **C:** SSO / "remember this device" is optional and unapproved. | `POST /api/auth/login` — cookie + access token + user | C | New target contract (prototype has no real auth) |
| W-02 | Session continuity | Guard on every route | **A:** no renewal exists (`sessionStorage` has no expiry). **B:** silent rotating refresh with reuse detection, no user-visible logout on a healthy refresh. **C:** cross-device session policy beyond single-session rotation is optional. | `POST /api/auth/refresh` with rotation | C | New target contract; keep rotation rule |
| W-03 | Sign out | App shell | Revoke this device only; other devices stay signed in | `POST /api/auth/logout` | A | Reuse business capability |
| W-04 | Current identity + permissions | App shell, guards | Know who I am and what I may do, without trusting the client | `GET /api/auth/me` returns `req.user` | B | Reuse implementation with adaptation (see §11.3) |
| W-05 | Active sessions / devices | `Settings` | **A:** the prototype has **no** device or session screen at all. **B:** list active sessions and revoke any non-current session (security requirement). **C:** "revoke all others" bulk action and session geolocation are optional. | `GET /api/auth/sessions` returns a **placeholder** | D | Replace legacy capability (new contract required) |

### 4.2 Projects

| ID | Workflow | Prototype screen | UI/UX requirement | Live support today | Gap | Target decision |
|---|---|---|---|---|---|---|
| W-06 | Dashboard | `/` (`Home`) | **A:** Home renders mock KPI/activity cards. **B:** server-scoped portfolio aggregates that respect membership and never leak cross-project totals. **C:** widget customization and date-range comparison are optional. | No aggregate endpoint; would require N calls | C | New target contract — full design in §4.8 |
| W-07 | Project list | `/projects` | Search, status filter, sort, paged | `GET /api/projects` with `q`, `sortBy`, `sortDir`, `page`, `pageSize` | B | Reuse implementation with adaptation (cursor paging, facets) |
| W-08 | Project create | `/projects` dialog | Full project record incl. contract value, role, region | `POST /api/projects` (+ auto-grant creator `DELETE`) | A | Reuse business capability |
| W-09 | Project edit | `/projects/:id` | Edit all fields incl. nullable text round-trip | `PUT /api/projects/:id` | A | Reuse business capability |
| W-10 | Project delete | `/projects/:id` | Guarded destructive action with dependency explanation | `DELETE /api/projects/:id` (204; 409 via `deleteSafety`) | B | Reuse implementation with adaptation (impact preview before delete) |
| W-11 | Project workspace | `/projects/:id/overview` | One screen summarising all sub-domains | No composite endpoint | C | New target contract (`GET /api/projects/:id/overview`) |
| W-12 | Project members | `admin`, project header | View/grant per-project access levels | `GET /api/projects/:id/members`; `GET/PUT /api/users/:id/projects` | B | Reuse implementation with adaptation (write endpoint belongs to project, not user) |
| W-13 | Sites | `/projects/:id/sites` | List/create/edit/delete site records inside a project | `GET/POST /api/sites`, `PUT/DELETE /api/sites/:id` | B | Reuse implementation with adaptation (nested under project; the list **already** honours `projectId` + `filterVisible`, so this is path/contract shaping, not an authorization fix) |

### 4.3 Archive (documents)

| ID | Workflow | Prototype screen | UI/UX requirement | Live support today | Gap | Target decision |
|---|---|---|---|---|---|---|
| W-14 | Archive browse/search | `/archive` | **A:** archive list with multi-facet filtering and paging in the mock. **B:** the same facets server-side with cursor paging, stable ordering, and project scope. **C:** saved filters/views are optional. | `GET /api/documents` — **10** filters + sort + paging | A | **`REUSE LEGACY IMPLEMENTATION WITH ADAPTATION`** (option B). The exact legacy envelope `{items,total,page,pageSize}` is **not** preserved: the approved UI needs cursor paging and facets, so the response shape must change while the filter semantics are reused. |
| W-15 | Document upload | `/archive` dialog | **A:** mock upload adds a document record — no multipart, no progress, no checksum. **B:** real multipart upload, server-side type/size validation, checksum recorded, authorization bound to the target project row. **C:** progress UI, resumable/chunked upload, and background queueing are optional and unapproved. | `POST /api/documents/upload` (`upload.single('file')`) | B | Reuse implementation with adaptation (checksum required; resumability is C) |
| W-16 | Document metadata edit | Document drawer | Edit title/number/category/type/revision/date/tags/notes/links | `PUT /api/documents/:id` (`documentSchema.partial()`) | A | Reuse business capability |
| W-17 | Document status transition | Document drawer | Move through a controlled status machine with history | `PATCH /api/documents/:id/status` — enum only, **no transition matrix** | B | Reuse implementation with adaptation (add allowed-transition enforcement) |
| W-18 | Revisions | Document drawer | Add a revision, view history, replace current file | `POST /api/documents/:id/revisions`, `POST /api/documents/:id/replace`, `GET /api/documents/:id/revisions` | A | Reuse business capability |
| W-19 | Links | Document drawer | Link a document to project/site/IPC/warehouse; unlink | `POST /api/documents/:id/links`, `DELETE /api/documents/links/:linkId` | B | Reuse implementation with adaptation (link targets are free-form `entityType`/`entityId`) |
| W-20 | Move to folder | Archive tree | Drag/move document between folders | `PATCH /api/documents/:id/move` | A | Reuse business capability |
| W-21 | Document delete | Document detail | Confirmed destructive action | `DELETE /api/documents/:id` (`archive.delete`) | A | Reuse business capability |
| W-22 | Preview / download | Document detail | Inline preview, download, stream | `GET /api/documents/:id/{preview,download,file}` | `PARTIALLY VERIFIED` | Reuse implementation with adaptation (three overlapping routes → one signed content route) |
| W-23 | Folders | `/archive` sidebar | Folder tree, create, rename, delete with permission | `GET/POST /api/folders`, `PUT/DELETE /api/folders/:id` — **list has no permission check** | D | Replace legacy capability for `GET`; adapt the rest |

### 4.4 Commercial (BOQ, IPC, financial indicators)

| ID | Workflow | Prototype screen | UI/UX requirement | Live support today | Gap | Target decision |
|---|---|---|---|---|---|---|
| W-24 | BOQ management | `/projects/:id/financials`, `financials` | List/create/update/delete priced lines; totals; progress | `GET/POST /api/projects/:projectId/boq`, `PUT/DELETE .../:id`, `GET .../export/xlsx` | B | Reuse implementation with adaptation (bulk upsert; delete blocked when IPCs reference the line) |
| W-25 | IPC management | `/projects/:id/financials` | Create/update/delete IPC, line quantities, status transitions, uniqueness per project | `GET/POST /api/projects/:projectId/ipcs`, `GET/PUT/DELETE .../:id` | B | Reuse implementation with adaptation (transition sub-resource; totals returned with lines) |
| W-26 | Financial indicators | `/financials` | Contract value, BOQ total, executed total (approved IPCs), deductions, per-project roll-up | `GET /api/projects/financials` returns 15 named fields | A | Reuse business capability |

### 4.5 Inventory and procurement

| ID | Workflow | Prototype screen | UI/UX requirement | Live support today | Gap | Target decision |
|---|---|---|---|---|---|---|
| W-27 | Inventory hub | `/inventory` | Cross-warehouse stock summary, low-stock, movement mix | `GET /api/stock/overview` → `{byWarehouse, totalByItem, lowStock, summaryByType}` | A | Reuse business capability |
| W-28 | Warehouses | `/inventory/warehouses` | CRUD, central vs site, project binding, active/inactive | `GET/POST /api/warehouses`, `PUT/DELETE /api/warehouses/:id`, `GET /export/xlsx` | A | Reuse business capability |
| W-29 | Items catalogue | `/inventory/items` | CRUD, category, unit, brand, minimum stock, tracking type | `GET/POST /api/items`, `PUT/DELETE /api/items/:id`, `GET /export/xlsx` | A | Reuse business capability |
| W-30 | Stock movements | `/inventory/stock` | Register IN/OUT/TRANSFER/ADJUSTMENT/RETURN with lines; browse history | `POST /api/stock/transactions`; `GET /api/stock/{overview,history,transactions}` | B | Reuse implementation with adaptation (no reversal route; delete is dead) |
| W-31 | Movement history | `/inventory/stock` | Paged, filterable ledger with item/warehouse/reference | `GET /api/stock/history` and `/transactions` (identical handler) | B | Reuse implementation with adaptation (collapse duplicate routes) |
| W-32 | Material requests | `/inventory/requests` | Draft → submit → approve → issue, partial issue, stock side effect | `GET/POST /api/material-requests`, `/:id/submit`, `/:id/approve`, `/:id/issue`, `DELETE /:id` | B | Reuse implementation with adaptation (no reject/close action; no update) |

### 4.6 Insight and administration

| ID | Workflow | Prototype screen | UI/UX requirement | Live support today | Gap | Target decision |
|---|---|---|---|---|---|---|
| W-33 | Reports catalogue and export | `/reports` | Choose report, preview columns/rows, export CSV/JSON | No report catalogue endpoint; only per-domain XLSX exports | C | New target contract |
| W-34 | Users administration | `/admin` | List/create/update/deactivate users, reset password | `GET/POST /api/users`, `PUT/DELETE /api/users/:id`, `POST /:id/reset-password` | B | Reuse implementation with adaptation (prototype user fields ≠ live fields) |
| W-35 | Roles and permissions | `/admin` | Role CRUD, clone, permission matrix, members | `GET/POST /api/roles`, `GET/PUT/DELETE /:id`, `POST /:id/clone`, `GET /:id/users` | B | Reuse implementation with adaptation (name immutable; last-admin guard) |
| W-36 | Per-user overrides | `/admin` drawer | Grant/deny individual permissions; view effective rights | `GET/PUT/DELETE /api/users/:id/overrides`, `GET /:id/effective` | A | Reuse business capability |
| W-37 | Audit log | `/audit` | **A:** audit screen lists mock events with filters. **B:** paged, filterable, append-only stream with actor/entity/date filters. **C:** export and retention-policy UI are optional. | `GET /api/audit-logs` (`audit.view`) — `{items,total,page,pageSize}`, filters `entity, action, q`, SQL `ORDER BY created_at DESC`, pageSize clamp 1–200 (default 25) | B | **`REUSE LEGACY IMPLEMENTATION WITH ADAPTATION`** — implementation verified; needs actor/date filters and cursor/stable ordering. |
| W-38 | Notifications | `/notifications` | Unread count, list, mark one/all read | `GET /api/notifications` → `{unread, items[:30]}`, two mark-read posts | B | Reuse implementation with adaptation (no paging, no per-item read state in payload) |
| W-39 | Global search | `/search` (command palette) | **A:** command palette queries the mock search. **B:** typed federated search with per-type authorization and bounded results. **C:** cross-entity ranking and recent-searches are optional. | `GET /api/search?q=` → `{}` when blank, else `globalSearch()` returning `{projects,documents,warehouses,items,transactions}` of `{id,title,subtitle?,link}` | B | **`REUSE LEGACY IMPLEMENTATION WITH ADAPTATION`** — capability verified; needs totals/paging and a typed envelope. |
| W-40 | Settings and lookups | `/settings` | Categories, units, and other reference lists | `GET /api/config/categories`, `GET /api/config/units` | B | Reuse implementation with adaptation (read-only today; no admin write path) |
| W-41 | Excel import | `settings`/`archive` | Template download, preview, confirm with per-row failures | `GET /api/import/history`, `POST /api/import/smart/{analyze,preview,confirm}`, `GET/POST /api/import/:entity/{template,preview,confirm}` | B | Reuse implementation with adaptation (per-entity permissions verified; **job model is not live** — `import_jobs` is `PROPOSED_NOT_IMPLEMENTED`, and idempotency on confirm is `OPEN — NOT IMPLEMENTED`, §5.3.1-E/F) |

**Coverage check:** 41 workflows, covering every item on the mandated list (login/session, dashboard, project list, project create/edit, project workspace, sites, archive browse/search, document upload/edit/delete, revisions/replace/links/status, folders, BOQ, IPC, financial indicators, inventory hub, warehouses, items, stock transactions/history, material requests, reports/exports, users/admin, roles/permissions, audit, notifications, search, settings/lookups).

### 4.7 A / B / C separation for high-risk workflows

The prototype is evidence of intended UX, not of production requirements. The table below separates the three layers explicitly so that no optional product idea is mistaken for an approved requirement, and no security requirement is dropped because the mock omitted it.

| Workflow | A — verified prototype behavior | B — required production / security behavior | C — optional new capability (needs owner approval) |
|---|---|---|---|
| W-01 Sign in | Role tiles select a mock user; no password, token, cookie, or expiry (`auth.tsx:44-57`; adapter exports no auth method) | Server-verified credentials; `HttpOnly` refresh cookie; access token with minimal claims; permissions resolved server-side per request; failed-login audit | SSO / OIDC; "remember this device"; CAPTCHA |
| W-02 Session continuity | None — `sessionStorage` identity never expires or refreshes | Rotating refresh token with reuse detection; silent renewal; no logout on transient network failure | Cross-device concurrent-session policy; idle-timeout UX |
| W-05 Active sessions | None — no device/session screen exists in the prototype | List sessions (device, last seen, current marker); revoke any non-current session; revoke-all on password change | Bulk "revoke all others" button; session geolocation display |
| W-06 Dashboard | Static/mock KPI and activity cards on `Home` | Server-computed, membership-scoped aggregates; no cross-project leakage; explicit freshness indicator | Widget rearrangement; date-range comparison; CSV export of the dashboard |
| W-11 Project workspace | Mock composite overview inside the project route | Composite read bounded to one authorized project; each sub-block independently authorized | User-configurable panel order |
| W-14 Archive browse | Client-side faceted list over mock data | Server-side facets + cursor paging + stable sort + project scope | Saved filter views |
| W-15 Document upload | Mock record creation; no file bytes, progress, or checksum | Multipart upload, server-side MIME/size validation, checksum stored, authorization from the target project row | Resumable/chunked upload; background queue; upload progress animation |
| W-17 Document status | Free status change in the mock | Server-enforced transition matrix; audit event per transition; notification on change | Reason/comment capture on transition |
| W-19 Links | Free-form `entityType`/`entityId` in the mock | Typed target enum, existence check, row-scope on both sides, referential integrity | Cross-entity "related items" graph view |
| W-23 Folders | Unguarded flat folder list in the mock | `archive.view` required; tree scoped to visible projects; delete blocked when non-empty | Drag-and-drop tree reordering; folder colour semantics |
| W-30 Stock movements | Mock movement creation and derived balances | Immutable append-only ledger; reversal instead of delete; idempotent creation | Movement templates / recurring movements |
| W-33 Reports | Mock report catalogue with preview/export | Server report catalogue + authorized preview + export job with row limits | Scheduled/emailed reports |
| W-37 Audit | Mock event list with filters | Append-only stream, actor/entity/date filters, stable ordering, `audit.view` | Export, retention configuration UI |
| W-38 Notifications | Mock unread count + list + mark-read | Per-user read state (not a shared array), paging, recipient targeting | Real-time push; notification preferences |
| W-39 Global search | Mock federated search returning typed hits | Per-type authorization, bounded result counts, typed envelope, no cross-project leakage | Cross-entity relevance ranking; recent searches; keyboard analytics |
| W-41 Excel import | Mock CSV import with column mapping | Per-entity permission, server validation, per-row failure report. **Persistent job identity and import-job idempotency are `DEFERRED`** — not approved and not part of the current Phase 12 scope (§5.3.1-F) | Background queue with progress, resumable imports |

**Rule:** column C never appears in §8 as an approved target operation unless the owner answers the corresponding question in §14.2. Where a C item is cheap and low-risk it may be listed separately as "optional extension"; it is not part of the baseline contract.

### 4.8 W-06 Dashboard — target design decision

W-06 is the one workflow where "just add an endpoint" is the wrong reflex. Three architectures were evaluated against the same KPI set.

**Required KPIs (from the prototype Home screen):** active projects count; total contract value across visible projects; executed value (approved IPCs) and remaining BOQ value; low-stock item count; unread notifications; recent audit/activity feed; documents awaiting review.

| Option | Shape | Advantages | Costs / risks | Verdict |
|---|---|---|---|---|
| **1. Dedicated portfolio endpoint** | `GET /api/dashboard` → one DTO containing all KPI blocks + recent activity | One round trip; consistent snapshot; simplest client; server can cache per user | New aggregate surface that must re-implement project-scope rules; risks becoming an undocumented god-endpoint; cache invalidation across six domains | **Not the default.** Only justified if measured client latency or consistency proves it necessary. |
| **2. Client composition** | Client calls `GET /api/projects/financials`, `GET /api/stock/overview`, `GET /api/audit-logs?pageSize=…`, `GET /api/notifications` in parallel | No new aggregate endpoint; each block already has an owner and its own permission; failures degrade per-block | N requests; no single consistent snapshot; each response must be independently scoped; the current `/financials` shape is **unscoped** (G-08) | **Baseline for the first implementation**, conditional on fixing G-08. |
| **3. Shared read model + thin presentation endpoint** | Materialized/derived `project_financial_summary` + `stock_balances`, exposed through one presentation route | Stable, cheap reads at scale; one place to define KPI semantics; supports future exports/reports | Must define refresh/rebuild semantics, staleness policy, and consistency guarantees; more design and migration work (D6/D8 gated) | **Recommended target direction**, introduced only when data volume makes composition inadequate. |

**Recommended decision (design only, owner approval required — Q-11):**

1. **Phase 1 of the rebuild:** implement Option 2 (client composition) with four independently scoped calls. This avoids inventing an aggregate contract before the underlying lists are cursor-paged.
2. **Before Option 3 is adopted:** fix G-08 so `/api/projects/financials` applies `filterVisible` (or replace it with `/api/projects/:projectId/financials` plus a scoped portfolio variant).
3. **Option 1 is explicitly deferred** and would require its own contract review; it is not part of the §8 baseline.

**Proposed dashboard DTO (Option 3, future):**

```
DashboardSummary {
  generatedAt: string            // ISO-8601, server clock
  scope: { projectIds: string[] } // server-resolved, never client-supplied
  projects: { active: number, total: number, byStatus: Record<string, number> }
  financials: { contractValue: number, boqTotal: number, executedTotal: number,
                executedDeductions: number, remaining: number, currency: 'EGP' }
  inventory: { lowStockCount: number, lowStockItems: Array<{itemId, code, name, onHand, minimum}> }
  notifications: { unread: number }
  activity: Array<{ id, action, entityType, entityId, actor, at }>  // bounded, e.g. 10
  documents: { awaitingReview: number }
  meta: { stale: boolean, computedFrom: 'live' | 'read-model' }
}
```

**Scope rules:** the endpoint computes only from projects where the caller has at least `READ` membership, plus global (`null`-project) rows where the owning rule allows. A client-supplied `projectId` filter may only narrow that set; it can never widen it. If the caller has no visible projects, the endpoint returns zeros and empty arrays, **not** 403.

**Permissions:** `projects.view` is necessary but not sufficient; each block keeps its own permission (`warehouse.view` for inventory, `audit.view` for activity, notification ownership for unread count). A user lacking a block's permission receives that block omitted or zeroed with a `meta.omitted[]` note — never fabricated data.

**Caching / consistency:** Option 3 is eventually consistent by construction. The response must carry `generatedAt` and `meta.stale`; the UI must not present read-model values as real-time. Invalidation triggers: project create/update/delete, BOQ/IPC write, stock movement, document status change. Option 2 is per-request consistent but not cross-block atomic; the UI must tolerate block-level skew.

**Errors:** `401` unauthenticated; `403` only for an explicitly requested unauthorized project filter (reusing the existing `checkFilterProject` loud-deny rule); `5xx` for aggregate failure. Partial failure in Option 2 is a per-block error state, not a whole-page failure.

**A/B/C for W-06:** A = mock cards; B = scoped, permission-correct aggregates (Option 2 minimum); C = widget customization and date-range comparison.

---

## 5. Verified Legacy Inventory (Layer A)

### 5.1 Mount structure — `apps/api/src/routes/index.ts` (15 mounts, order matters)

| # | Prefix | Router | Notes |
|---|---|---|---|
| 1 | `/auth` | `authRouter` | Public mount; per-route `requireAuth` |
| 2 | `/users` | `usersExtRouter` | Mounted **before** `usersRouter`; router-level `requireAuth` only |
| 3 | `/users` | `usersRouter` | Router-level `requireAuth` + `users.manage` |
| 4 | `/roles` | `rolesRouter` | Router-level `requireAuth` + `roles.manage` |
| 5 | `/projects` | `projectsRouter` | Router-level `requireAuth`; also mounts BOQ and IPC |
| 6 | `/documents` | `documentsRouter` | Router-level `requireAuth` |
| 7 | `/folders` | `foldersRouter` | Router-level `requireAuth` |
| 8 | `/warehouses` | `warehousesRouter` | Router-level `requireAuth` |
| 9 | `/items` | `itemsRouter` | Router-level `requireAuth` |
| 10 | `/stock` | `stockRouter` | Router-level `requireAuth` |
| 11 | `/sites` | `sitesRouter` | Router-level `requireAuth` |
| 12 | `/material-requests` | `materialRequestsRouter` | Router-level `requireAuth` + `materialRequests.view` |
| 13 | `/import` | `importRouter` | Router-level `requireAuth` |
| 14 | `/config` | `configRouter` | Router-level `requireAuth` |
| 15 | `/` | `systemRouter` | `/search`, `/notifications`, `/audit-logs`, `/backups` |

Plus `GET /api/health` registered directly on the app before the router mount (`app.ts:35`).

### 5.2 Count reconciliation

| File | Handlers |
|---|---|
| `auth.routes.ts` (authRouter 5 + usersRouter 4 + usersExtRouter 7) | 16 |
| `config.routes.ts` | 2 |
| `documents.routes.ts` | 17 |
| `folders.routes.ts` | 4 |
| `import.routes.ts` | 7 |
| `items.routes.ts` | 5 |
| `material-requests.routes.ts` | 7 |
| `boq.routes.ts` | 5 |
| `ipc.routes.ts` | 5 |
| `projects.routes.ts` | 8 |
| `roles.routes.ts` | 7 |
| `sites.routes.ts` | 4 |
| `stock.routes.ts` | 7 |
| `system.routes.ts` | 8 |
| `warehouses.routes.ts` | 5 |
| **Subtotal** | **107** |
| `app.ts` → `GET /api/health` | **1** |
| **Total HTTP endpoints** | **108** |

### 5.3 Endpoint inventory

Authz column shows the *effective* guard after router-level middleware is applied. `—` means `requireAuth` only.

#### Auth and users (16)

| # | Method | Path | Authz | Notes | Label |
|---|---|---|---|---|---|
| 1 | POST | `/api/auth/login` | public | Returns `{sessionId, accessToken, expiresIn, user}`; sets refresh + access cookies; logs `login`/`login-failed` | `VERIFIED` |
| 2 | POST | `/api/auth/refresh` | refresh cookie | Rotates refresh token; revokes on inactive user | `VERIFIED` |
| 3 | POST | `/api/auth/logout` | `requireAuth` | Revokes current session only; clears both cookies | `VERIFIED` |
| 4 | GET | `/api/auth/me` | `requireAuth` | Returns `req.user` (identity claims only) | `VERIFIED` |
| 5 | GET | `/api/auth/sessions` | `requireAuth` | Returns a **placeholder note**, not session data | `VERIFIED` |
| 6 | GET | `/api/users` | `users.manage` | User list | `PARTIALLY VERIFIED` (response shape not read) |
| 7 | POST | `/api/users` | `users.manage` | Create user | `PARTIALLY VERIFIED` |
| 8 | PUT | `/api/users/:id` | `users.manage` | Update user | `PARTIALLY VERIFIED` |
| 9 | DELETE | `/api/users/:id` | `users.manage` | Delete user | `PARTIALLY VERIFIED` |
| 10 | POST | `/api/users/:id/reset-password` | `users.manage` OR `users.resetPassword` | Self-service-capable reset | `VERIFIED` (guard) |
| 11 | GET | `/api/users/:id/overrides` | `users.manage` | Permission overrides | `PARTIALLY VERIFIED` |
| 12 | PUT | `/api/users/:id/overrides` | `users.manage` | Replace overrides | `PARTIALLY VERIFIED` |
| 13 | DELETE | `/api/users/:id/overrides/:key` | `users.manage` | Remove one override | `PARTIALLY VERIFIED` |
| 14 | GET | `/api/users/:id/projects` | `projects.access` | `{projectId, access, projectCode, projectName}[]` | `VERIFIED` |
| 15 | PUT | `/api/users/:id/projects` | `projects.access` | Blocks editing your own memberships (403) | `VERIFIED` |
| 16 | GET | `/api/users/:id/effective` | `users.manage` (in-handler `can`) | Per-permission `{effective, source, roleValue, override, projectAccess}` | `VERIFIED` |

#### Documents (17)

| # | Method | Path | Authz | Notes | Label |
|---|---|---|---|---|---|
| 17 | GET | `/api/documents` | `archive.view` + visible-scope | **10** filters (`q, projectId, folderId, siteId, category, documentType, revision, status, from, to`) + `sortBy/sortDir/page/pageSize`; returns `{items,total,page,pageSize}` (`documents.routes.ts:68-86`) | `VERIFIED` |
| 18 | GET | `/api/documents/export/xlsx` | `archive.view` | XLSX stream of visible documents | `VERIFIED` |
| 19 | GET | `/api/documents/:id` | `archive.view` + row scope, hideExistence | 404 when invisible | `VERIFIED` |
| 20 | GET | `/api/documents/:id/revisions` | `archive.view` + row scope, hideExistence | Revision list | `PARTIALLY VERIFIED` (shape) |
| 21 | GET | `/api/documents/:id/preview` | any download permission | Inline preview | `PARTIALLY VERIFIED` |
| 22 | GET | `/api/documents/:id/download` | any download permission | Attachment | `PARTIALLY VERIFIED` |
| 23 | GET | `/api/documents/:id/file` | any download permission | Raw file | `PARTIALLY VERIFIED` |
| 24 | POST | `/api/documents/upload` | `archive.upload` + body scope | Multipart `file`; `documentSchema` | `VERIFIED` |
| 25 | POST | `/api/documents/:id/revisions` | `archive.edit` + row scope | Multipart revision | `VERIFIED` (guard) |
| 26 | POST | `/api/documents/:id/links` | `archive.edit` + row scope | Body `{entityType, entityId}` → 201 link | `VERIFIED` |
| 27 | DELETE | `/api/documents/links/:linkId` | `archive.edit` | 204; **no project-row scope on the link** | `VERIFIED` |
| 28 | PATCH | `/api/documents/:id/move` | `archive.edit` + row scope | Body `{folderId}` | `VERIFIED` |
| 29 | PUT | `/api/documents/:id` | `archive.edit` + row scope | Partial `documentSchema`; tags coerced from string | `VERIFIED` |
| 30 | PATCH | `/api/documents/:id/status` | `archive.edit` + row scope | `{status}` enum only, **no transition matrix** | `VERIFIED` |
| 31 | POST | `/api/documents/export/zip` | `archive.download` | ZIP of selected documents | `PARTIALLY VERIFIED` |
| 32 | POST | `/api/documents/:id/replace` | `archive.edit` + row scope | Multipart replace | `VERIFIED` (guard) |
| 33 | DELETE | `/api/documents/:id` | `archive.delete` + row scope | Destructive | `VERIFIED` |

#### Projects (8)

| # | Method | Path | Authz | Notes | Label |
|---|---|---|---|---|---|
| 34 | GET | `/api/projects/financials` | `projects.view` — **no visible-scope filter** | 15 fields: `projectId, projectCode, projectName, client, owner, contractNumber, siteLocation, region, status, contractValue, boqTotal, executedTotal, executedDeductions, ipcs[], linkedDocs[]`; SQL has no membership predicate (`projects.routes.ts:25-55`) → **G-08** | `VERIFIED` |
| 35 | GET | `/api/projects` | `projects.view` + visible-scope | `q, sortBy, sortDir, page, pageSize` → paged envelope | `VERIFIED` |
| 36 | GET | `/api/projects/export/xlsx` | `reports.view` | XLSX of **all** projects (no visible-scope filter) | `VERIFIED` |
| 37 | GET | `/api/projects/:id/members` | `projects.access` | `{userId, username, fullName, access}[]` | `VERIFIED` |
| 38 | GET | `/api/projects/:id` | `projects.view` + row scope, hideExistence | 404 when invisible | `VERIFIED` |
| 39 | POST | `/api/projects` | `projects.create` | Auto-grants creator `DELETE` on the new project | `VERIFIED` |
| 40 | PUT | `/api/projects/:id` | `projects.edit` | `projectSchema` | `VERIFIED` |
| 41 | DELETE | `/api/projects/:id` | `projects.delete` | 204; 409 via `deleteSafety.blockProject`; cascades BOQ/IPC in one transaction | `VERIFIED` |

#### BOQ — base `/api/projects/:projectId/boq` (5)

| # | Method | Path | Authz | Notes | Label |
|---|---|---|---|---|---|
| 42 | GET | `/api/projects/:projectId/boq` | `projects.view` (in-handler `can`) | **Returns `[]` on denial**, not 403; sorted by `itemCode` numerically | `VERIFIED` |
| 43 | POST | `/api/projects/:projectId/boq` | `projects.edit` OR `projects.create` | `{itemCode, description, unit, quantity≥0, unitPrice≥0}` | `VERIFIED` |
| 44 | PUT | `/api/projects/:projectId/boq/:id` | `projects.edit` | Update line | `VERIFIED` |
| 45 | DELETE | `/api/projects/:projectId/boq/:id` | `projects.edit` | 409 when IPCs reference the line | `VERIFIED` |
| 46 | GET | `/api/projects/:projectId/boq/export/xlsx` | `projects.edit` OR `projects.create` via `requireAnyProjectAccess(..., scopeFromParam())` (`boq.routes.ts:81`) | XLSX export, project-scoped | `VERIFIED` |

#### IPC — base `/api/projects/:projectId/ipcs` (5)

| # | Method | Path | Authz | Notes | Label |
|---|---|---|---|---|---|
| 47 | GET | `/api/projects/:projectId/ipcs` | `projects.view` (in-handler `can`) | **Returns `[]` on denial** | `VERIFIED` |
| 48 | GET | `/api/projects/:projectId/ipcs/:id` | router `requireAuth` + **in-handler** `can(ctx,'projects.view', ipc.projectId)` (`ipc.routes.ts:50-57`) | `{...ipc, items}`; 404 missing/wrong-project/invisible | `VERIFIED` (guard + shape) |
| 49 | POST | `/api/projects/:projectId/ipcs` | `projects.edit` OR `projects.create` | `{ipcNumber≥1, date, status, notes?, deductions?, grossAmount?, items?[{boqItemId, currentQuantity≥0}]}`; 409 on duplicate number | `VERIFIED` |
| 50 | PUT | `/api/projects/:projectId/ipcs/:id` | `projects.edit` | Enforces a **status transition matrix** (409 on illegal move) | `VERIFIED` |
| 51 | DELETE | `/api/projects/:projectId/ipcs/:id` | `projects.edit` | 204; 409 when blocked | `VERIFIED` |

#### Warehouses / Items (10)

| # | Method | Path | Authz | Notes | Label |
|---|---|---|---|---|---|
| 52 | GET | `/api/warehouses` | `warehouse.view` | Scoped list | `PARTIALLY VERIFIED` |
| 53 | GET | `/api/warehouses/export/xlsx` | `reports.view` | XLSX | `VERIFIED` |
| 54 | POST | `/api/warehouses` | `warehouse.create` + body scope | `{code, name, type:'central'|'site', projectId?, location?, status:'active'|'inactive', notes?}` | `VERIFIED` |
| 55 | PUT | `/api/warehouses/:id` | `warehouse.edit` + row scope | Partial schema | `VERIFIED` |
| 56 | DELETE | `/api/warehouses/:id` | `warehouse.delete` + row scope | 204; 409 when blocked | `VERIFIED` |
| 57 | GET | `/api/items` | `warehouse.view` | Item list | `PARTIALLY VERIFIED` |
| 58 | GET | `/api/items/export/xlsx` | `reports.view` | XLSX | `VERIFIED` |
| 59 | POST | `/api/items` | `warehouse.create` | `{code, name, category, unit, brand?, minimumStock?≥0, trackingType?:'none'|'batch'|'serial', notes?}` | `VERIFIED` |
| 60 | PUT | `/api/items/:id` | `warehouse.edit` | Partial schema | `VERIFIED` |
| 61 | DELETE | `/api/items/:id` | `warehouse.delete` | 204; 409 when blocked | `VERIFIED` |

#### Stock (7)

| # | Method | Path | Authz | Notes | Label |
|---|---|---|---|---|---|
| 62 | GET | `/api/stock/overview` | `warehouse.view` | `{byWarehouse, totalByItem, lowStock, summaryByType}` | `VERIFIED` |
| 63 | GET | `/api/stock/history` | `warehouse.view` | Same handler as `/transactions` | `VERIFIED` |
| 64 | GET | `/api/stock/transactions` | `warehouse.view` | Paged transaction list | `VERIFIED` |
| 65 | GET | `/api/stock/transactions/export/xlsx` | `reports.view` | Legacy export alias | `VERIFIED` |
| 66 | GET | `/api/stock/export/xlsx` | `reports.view` | Current export path | `VERIFIED` |
| 67 | POST | `/api/stock/transactions` | any of 5 stock permissions, then per-type `TYPE_PERMISSION` | `{type, warehouseId, destinationWarehouseId?, projectId?, referenceNumber?, date, notes?, items[{itemId, quantity>0, unitCost?≥0}]}`; 201 | `VERIFIED` |
| 68 | DELETE | `/api/stock/transactions/:id` | `warehouse.edit` OR `settings.manage` | **Unconditionally 400** — immutable ledger | `VERIFIED` |

#### Sites (4)

| # | Method | Path | Authz | Notes | Label |
|---|---|---|---|---|---|
| 69 | GET | `/api/sites` | `projects.view` (in-handler) + `filterVisible`; explicit `projectId` filter validated by `checkFilterProject` → 403 on a no-access project (`sites.routes.ts:22-31`) | Global list scoped to member projects; **does** honour `projectId` | `VERIFIED` |
| 70 | POST | `/api/sites` | `projects.edit` + body scope | `{projectId, code, name, location?, notes?}` | `VERIFIED` |
| 71 | PUT | `/api/sites/:id` | `projects.edit` + row scope | Partial schema | `VERIFIED` |
| 72 | DELETE | `/api/sites/:id` | `projects.edit` + row scope | 204 | `VERIFIED` |

#### Material requests (7)

| # | Method | Path | Authz | Notes | Label |
|---|---|---|---|---|---|
| 73 | GET | `/api/material-requests` | `materialRequests.view` | Sorted by `createdAt` desc; **no paging** | `VERIFIED` |
| 74 | GET | `/api/material-requests/:id` | `materialRequests.view` + row scope, hideExistence | 404 | `VERIFIED` |
| 75 | POST | `/api/material-requests` | `materialRequests.create` + body scope | `{projectId?, siteId?, warehouseId, items[{itemId, requestedQty>0, issuedQty?, notes?}], notes?}`; validates warehouse + items exist | `VERIFIED` |
| 76 | POST | `/api/material-requests/:id/submit` | `materialRequests.create` + row scope | `draft` → submitted; 409 otherwise | `VERIFIED` |
| 77 | POST | `/api/material-requests/:id/approve` | `materialRequests.approve` | `submitted` → approved; 409 otherwise | `VERIFIED` |
| 78 | POST | `/api/material-requests/:id/issue` | `materialRequests.issue` | Approved-only; partial issue; **creates a stock transaction**; returns `{request, transaction}` | `VERIFIED` |
| 79 | DELETE | `/api/material-requests/:id` | `materialRequests.create` + row scope | 204; 409 when blocked | `VERIFIED` |

#### Folders (4)

| # | Method | Path | Authz | Notes | Label |
|---|---|---|---|---|---|
| 80 | GET | `/api/folders` | **none beyond `requireAuth`** | Returns all folders to any authenticated user | `VERIFIED` |
| 81 | POST | `/api/folders` | `archive.upload` | `{name}` required | `VERIFIED` |
| 82 | PUT | `/api/folders/:id` | `archive.edit` | `{name}` required | `VERIFIED` |
| 83 | DELETE | `/api/folders/:id` | `archive.delete` | 204 | `VERIFIED` |

#### Roles (7)

| # | Method | Path | Authz | Notes | Label |
|---|---|---|---|---|---|
| 84 | GET | `/api/roles` | `roles.manage` | Roles with user counts | `VERIFIED` |
| 85 | GET | `/api/roles/:id` | `roles.manage` | Role + count | `VERIFIED` |
| 86 | POST | `/api/roles` | `roles.manage` | Rejects unknown permission keys (400), duplicate name (409) | `VERIFIED` |
| 87 | PUT | `/api/roles/:id` | `roles.manage` | **Name immutable** (400); blocks disabling last admin (409) | `VERIFIED` |
| 88 | DELETE | `/api/roles/:id` | `roles.manage` | 403 on system roles; 409 when users assigned | `VERIFIED` |
| 89 | POST | `/api/roles/:id/clone` | `roles.manage` | Generates unique name (suffix ≤ 99) | `VERIFIED` |
| 90 | GET | `/api/roles/:id/users` | `roles.manage` | Users holding the role | `VERIFIED` |

#### System / platform (8)

| # | Method | Path | Authz | Notes | Label |
|---|---|---|---|---|---|
| 91 | GET | `/api/audit-logs` | `audit.view` | `{items,total,page,pageSize}`; `entity/action/q` filters; `ORDER BY created_at DESC`; pageSize clamp 1–200 (default 25); page default 1 (`audit.service.ts:54-99`) | `VERIFIED` |
| 92 | GET | `/api/backups` | `backup.manage` | `backupService.list()` | `PARTIALLY VERIFIED` |
| 93 | POST | `/api/backups` | `backup.manage` | 201 result | `PARTIALLY VERIFIED` |
| 94 | POST | `/api/backups/:name/restore` | `backup.manage` | **Destructive restore**; `{ok:true, ...result}` | `PARTIALLY VERIFIED` |
| 95 | GET | `/api/search` | `—` (router `requireAuth` only) | `?q=`; returns `{}` when blank, else `globalSearch(q,userId,limit=5)` returning `{projects,documents,warehouses,items,transactions}` of `{id,title,subtitle?,link}` — 5 per namespace, no totals, no paging (`global-search.service.ts:11-24,31-81`; `system.routes.ts:49-54`) | `VERIFIED` |
| 96 | GET | `/api/notifications` | `—` | `{unread, items}`; items capped at 30 | `VERIFIED` |
| 97 | POST | `/api/notifications/:id/read` | `—` | `{ok:true}`; read state keyed by username | `VERIFIED` |
| 98 | POST | `/api/notifications/read-all` | `—` | `{ok:true}` | `VERIFIED` |

#### Config (2)

| # | Method | Path | Authz | Notes | Label |
|---|---|---|---|---|---|
| 99 | GET | `/api/config/categories` | `—` | `categoryRepository.list()` | `VERIFIED` |
| 100 | GET | `/api/config/units` | `—` | `unitRepository.list()` | `VERIFIED` |

#### Import (7)

All 7 handlers live in `import.routes.ts`, mounted at `/api/import` with router-level `requireAuth` (`:187`). Authentication is therefore identical for all 7; **permission, request format, project-level scope and audit behaviour are not identical** and are stated per route below.

| # | Method | Path | Effective authz | Request | Response | Errors | Audit / project scope | Label |
|---|---|---|---|---|---|---|---|---|
| 101 | GET | `/api/import/history` | `requireAuth` + `settings.manage` (`:189`) | — (no query parameters read) | Bare array (no envelope) of up to 100 rows, `date` desc (`:190`): `{id, entity, fileName, userId, username, date, totalRows, successfulRows, failedRows, errors}` | None route-specific; `401`/`403` from middleware; an escaping DB error becomes `500 {message}` | No audit write. **No project scope** — the list spans all entities and all users | `SOURCE_VERIFIED` |
| 102 | POST | `/api/import/smart/analyze` | `requireAuth`; **`upload.single('file')` runs before** `archive.upload` (`:203`) | `multipart/form-data`: `file` (memory buffer), optional `sheetName` | `{sheetNames, selectedSheet, totalRows, mapping, sampleRows}` (`:211-217`) | `400 {message}` for missing file, empty sheet/no headers, or unreadable workbook (`:204,209,219`) | No audit write. No project scope | `SOURCE_VERIFIED` |
| 103 | POST | `/api/import/smart/preview` | `requireAuth`; **`upload.single('file')` runs before** `archive.upload` (`:226`) | `multipart/form-data`: `file`, `mapping` (array or JSON string), optional `sheetName` | `{validRows[], invalidRows[{rowNumber,errors[],row}], warnings[{rowNumber,warnings[]}], duplicates, totalRows}` (`:277`) | `400 {message}` missing file / processing failure (`:227,279`) | No audit write. Reads **all** projects and **all** documents for duplicate detection, with no scope predicate (`:239-240`) | `SOURCE_VERIFIED` |
| 104 | POST | `/api/import/smart/confirm` | `requireAuth` + `archive.upload` (`:286`); JSON body, **no multer** | `{rows[], skipDuplicates?, duplicateIndices?, fileName?}` (`:287-294`) | `{imported, failed, failures[{index, errors[]}]}` (`:361`) | `400 {message}` when `rows` is empty (`:289`); DB/validation errors are captured **per row** into `failures[]` and still return `200` | Writes `import_history` with `entity='documents'` (`:349-359`); `auditService.log(req,'smart-excel-import','documents',…)` (`:360`). Per-row `can(ctx,'archive.upload', projectId)` when the row carries a `projectId` (`:305-309`) | `SOURCE_VERIFIED` |
| 105 | GET | `/api/import/:entity/template` | `requireAuth` only — **no permission check** (`:365`) | Path `entity` | XLSX attachment; `Content-Disposition: attachment; filename=<entity>-import-template.xlsx` (`:370-372`) | `400 {message:'Unknown entity'}` (`:368`) | No audit write. No project scope | `SOURCE_VERIFIED` |
| 106 | POST | `/api/import/:entity/preview` | `requireAuth`; **`upload.single('file')` runs before** the in-handler `ENTITY_PERMISSION[entity]` check; global `permissions.includes(perm)` only — **no project-level `can()`** (`:375-382`) | `multipart/form-data`: `file` | `res.json(excelService.preview(...))`; the exact envelope is produced by an unread service → `UNKNOWN` | `400` unknown entity (unknown mapper or unknown permission key); `403` missing entity permission (message names the key); `400` missing file; `400` unreadable workbook (`:378-388`) | No audit write. No project-level scope | `SOURCE_VERIFIED` (route and guards); response envelope `UNKNOWN` |
| 107 | POST | `/api/import/:entity/confirm` | `requireAuth`; in-handler `ENTITY_PERMISSION[entity]` **and** per-row project checks where applicable (`:392-397,425-445`); JSON body, **no multer** | `{rows[], fileName?}` (`:398`) | `{imported, failed, failures[{index, errors[]}]}` (`:471`) | `400` unknown entity; `403` missing entity permission; `400` when `rows` is empty; per-row failures still return `200` (`:395-399,454`) | Writes `import_history` (`:459-469`); `auditService.log(req,'excel-import', entity, …)` (`:470`). `warehouses`/`documents` rows check `can(ctx, perm, projectId)`; `boq` resolves `projectCode` then requires `projects.edit` on that project (`:425-445`) | `SOURCE_VERIFIED` |

`ENTITY_PERMISSION` (`:24-31`): `projects→projects.create`, `warehouses→warehouse.create`, `items→warehouse.create`, `transactions→warehouse.stock_in`, `documents→archive.upload`, `boq→projects.edit`.

**Verified middleware-ordering fact (security-relevant, not yet a finding):** on `smart/analyze`, `smart/preview` and `:entity/preview`, `upload.single('file')` is registered **before** the permission middleware/handler check, so an authenticated caller without the permission has the multipart body buffered into memory before authorization is evaluated. This is recorded as `RISK_SURFACE_UNQUANTIFIED` in §5.3.1-J, not as a proven vulnerability.

#### 5.3.1 Import surface — source-verified detail (R-129)

Evidence for this subsection: `apps/api/src/modules/import/import.routes.ts` (all 473 lines), `apps/api/src/middleware/errors.ts`, `apps/api/src/repositories/import-history.repository.ts`, `apps/api/src/repositories/pg-base.repository.ts`, `apps/api/src/repositories/document.repository.ts`, `apps/api/src/database/migrations/001_initial_schema.sql:318-329`, `apps/api/src/app.ts`, `apps/api/package.json`.

**Source verification is not completed documentation.** Anything below marked `UNKNOWN`/`OPEN` stays open.

##### A. Entity → permission map (implemented)

| `:entity` | Permission key | Repository written by `confirm` | Extra project gate on `confirm` |
|---|---|---|---|
| `projects` | `projects.create` | `projectRepository` | — |
| `warehouses` | `warehouse.create` | `warehouseRepository` | `can(ctx, perm, projectId)` when the mapped row has `projectId` |
| `items` | `warehouse.create` | `itemRepository` | — |
| `transactions` | `warehouse.stock_in` | `stockTransactionRepository` | — (only `warehouse.stock_in`, **not** the per-type `TYPE_PERMISSION` used by `POST /api/stock/transactions`) |
| `documents` | `archive.upload` | `documentRepository` | `can(ctx, perm, projectId)` when the mapped row has `projectId` |
| `boq` | `projects.edit` | `boqRepository` | resolves `projectCode` → project, then `can(ctx, 'projects.edit', project.id)`; unknown project is a per-row failure |

An unknown `:entity` returns `400 Unknown entity` on `template`, `preview` and `confirm`; `preview` also rejects an entity that has a mapper but no permission entry (`:377-380`).

##### B. Data contract — `import_history` exists; `import_jobs` and `import_runs` do not

| Concept | Status | Evidence |
|---|---|---|
| `import_history` | **Existing table — `SOURCE_VERIFIED`** | `001_initial_schema.sql:318-329`; mapped by `import-history.repository.ts:12-40` |
| `import_jobs` | **`PROPOSED_NOT_IMPLEMENTED`** | Zero occurrences in `apps/` source and zero in `apps/api/src/database/migrations/` |
| `import_runs` | **`DEFERRED`** (not cancelled) | D-SPEC-01 Option (b) defers the DB-resident ledger; zero occurrences in `apps/` source and migrations |

Actual `import_history` contract (`001_initial_schema.sql:318-329`):

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `UUID` | no | `uuid_generate_v4()` | PK |
| `entity` | `VARCHAR(100)` | no | — | Imported entity key |
| `file_name` | `VARCHAR(500)` | no | — | Request-supplied or synthesized (`<entity>.xlsx`, `smart-import.xlsx`) |
| `user_id` | `VARCHAR(100)` | **yes** | — | `req.user.id` in both confirm routes |
| `username` | `VARCHAR(100)` | **yes** | — | `req.user.username` |
| `total_rows` | `INT` | no | `0` | `imported + failures.length` |
| `successful_rows` | `INT` | no | `0` | Successful row count |
| `failed_rows` | `INT` | no | `0` | Failed row count |
| `errors` | `TEXT[]` | no | `'{}'` | First **50** failures formatted as `صف <n>: <errors joined by ،>` |
| `created_at` | `TIMESTAMPTZ` | no | `NOW()` | Mapped to API `date` |

**There is no `status`, no `idempotency_key`, no progress counters, and no `failures` JSONB column.** `errors` is a `text[]` of human-readable strings, not a structured failure model. `import_history` is therefore a **summary record**, not a job store, and cannot satisfy a lifecycle/progress contract. The inspected import application path inserts summary records; no application-level update/delete path was identified in the inspected import flow. **Database-enforced immutability has not been established.**

`import_jobs` (as proposed in §9) needs `status`, `total_rows`, `imported`, `failed`, structured `failures` and `idempotency_key`; `import_runs`/`import_run_rows` belong to the deferred ledger proposal. None of these is implemented. No column is asserted to exist.

##### C. Transaction semantics — verified separately per confirm route

**`POST /api/import/:entity/confirm`**

- Rows are processed in a **sequential `for` loop** (`:417-456`); each iteration calls `repo.create(...)`.
- Each create is an **independent `pool.query`**: `PgBaseRepository` uses `pool.query` for every method (`pg-base.repository.ts:20,25,36`), and the import route never acquires a `PoolClient`, never issues `BEGIN`/`COMMIT`/`ROLLBACK`.
- Therefore **no explicit encompassing transaction was identified in the inspected call path**, and a later row failure does not roll back earlier rows. **Partial import is observed implementation behaviour, not an owner-approved business requirement.**
- `documentRepository.create` itself performs three un-transacted steps: insert into `documents` (`document.repository.ts:136-150`), a loop of `document_revisions` upserts (`:66-81`), then read-back (`:152-153`). A failure after the first insert can leave a document row without its revision rows.
- `boqRepository.create`'s internal statement boundaries were **not read** → `UNKNOWN`; the route-level finding (no encompassing transaction) is independent of that.
- The `import_history` insert runs **after** the loop (`:459-469`). If it throws, the error escapes to the global handler (`express-async-errors` is enabled at `app.ts:1`) and the client receives `500 {message}` while the already-imported rows remain committed.

**`POST /api/import/smart/confirm`** — inspected separately:

- Same structure: sequential loop (`:300-346`), `await documentRepository.create(...)` per row, each backed by independent `pool.query` calls. No `PoolClient`, no `BEGIN`/`COMMIT`.
- Consequence is the same: **no encompassing transaction; earlier successful writes remain committed after a later row fails.**
- Input differs (previewed rows in a JSON body, duplicate indices, `skipDuplicates`), and a per-row project check runs before each write (`:305-309`). These are behavioural differences, **not** transactional ones.

The verified common fact is the **absence of an explicit route-level transaction in both handlers**. This document does not generalize that finding to any other import-adjacent code path, and it does not silently convert the observed behaviour into an atomic design.

##### D. Error mapping — what is actually implemented

`apps/api/src/middleware/errors.ts` maps exactly four SQLSTATEs, and only when the error carries no numeric `.status`:

| SQLSTATE | HTTP | Message |
|---|---|---|
| `22P02` (invalid_text_representation) | `400` | `معرف غير صالح` |
| `23505` (unique_violation) | `409` | `السجل موجود بالفعل (قيمة مكررة)` |
| `23503` (foreign_key_violation) | `400` | `مرجع غير موجود` |
| `23502` (not_null_violation) | `400` | `بيانات ناقصة لحقل مطلوب` |
| anything else | `500` (or `err.status`) | `err.message ?? 'Server error'` |

- `55P03` (lock_not_available) and `57014` (query_canceled) are **not mapped**; they are not implemented behaviour and must not be documented as such.
- The response envelope is **`{message}`**, not `application/problem+json`. The problem+json envelope in §8.1 rule 4 is a **proposal**, not current behaviour.
- In both confirm loops, per-row DB errors are caught inside the handler and reported in `failures[]` with `200`; the global mapping only applies to errors that escape the handler.

##### E. Import jobs — `DEPENDENCY_UNRESOLVED — NOT IMPLEMENTED — OUT OF CURRENT EXECUTION SCOPE`

`GET/POST /api/import/jobs` and `GET /api/import/jobs/:jobId` are **not live endpoints**. They are retained below as traceable historical proposals only. Their persistent lifecycle, progress reporting, counters and failure retrieval require a separately resolved storage/job model — `import_history` has no `status` column and cannot serve as that model, and the `import_jobs` table exists only as a proposal.

##### F. Idempotency — three distinct kinds, kept separate

| Kind | Status | Statement |
|---|---|---|
| 1. Ledger / import-job idempotency | **`DEFERRED`** | Deferred with the D-SPEC-01 Option (b) ledger proposal. Nothing here implements it. |
| 2. Idempotency for documents, stock movements and material-request issues | **`OPEN` independent decisions** | Proposed in §8.1 rule 6; not approved, not implemented, and not implied by the import routes. |
| 3. Idempotency on the existing import confirm routes | **`OPEN — NOT IMPLEMENTED`** — not approved | Neither `smart/confirm` nor `:entity/confirm` reads an `Idempotency-Key`, stores one, or dedupes retries. A repeated confirm re-attempts every row; only natural DB uniqueness (e.g. `23505`) may reject some. No idempotency mechanism exists today. |

##### J. Multer upload surface — `RISK_SURFACE_UNQUANTIFIED`

- `const upload = multer({ storage: multer.memoryStorage() })` (`:33`) — **no `limits`, and specifically no `fileSize` limit**.
- Files are buffered in process memory before the handler runs; on three routes that happens before the permission check (§5.3 above).
- `express.json({ limit: '10mb' })` (`app.ts:32`) governs JSON bodies only and does **not** constrain multipart uploads.
- This is **not** a proven exploitable denial-of-service vulnerability. Upstream request/body limits (reverse proxy, platform, `trust proxy` deployment assumptions) have **not** been established by this audit. Status: `RISK_SURFACE_UNQUANTIFIED`. No code change is permitted in this task.

#### Health (1)

| # | Method | Path | Authz | Notes | Label |
|---|---|---|---|---|---|
| 108 | GET | `/api/health` | public | `{ok, db}` | `VERIFIED` |

### 5.4 Verified DTOs

**`documentSchema`** (`documents.validators.ts:5-18`) — `folderId?`, `projectId?`, `siteId?`, `ipcId?`, `title` (min 1), `documentNumber?`, `category` (min 1), `documentType?` (default `'غير محدد'`), `revision?`, `documentDate?`, `notes?`, `tags: string[]` (default `[]`).
**`DOCUMENT_STATUSES`** = `draft | submitted | under-review | approved | rejected | superseded | archived`.

**`projectSchema`** (`projects.validators.ts:12-29`) — `projectCode` (min 1), `projectName` (min 1), `client`/`owner`/`mainContractor`/`siteLocation` (default `''`), `region?` (nullable→undefined), `contractNumber` (default `''`), `contractValue?` (≥0, nullable), `startDate?`, `endDate?`, `status: planned | active | on-hold | completed | cancelled`, `role?: main-contractor | subcontractor | direct-contractor`, `notes?`, `createdBy?`.

**`stockTransactionSchema`** (`stock.validators.ts:9-18`) — `type: IN | OUT | TRANSFER | ADJUSTMENT | RETURN`, `warehouseId`, `destinationWarehouseId?`, `projectId?`, `referenceNumber?`, `date` (min 1), `notes?`, `items: [{itemId, quantity>0, unitCost?≥0}]` (min 1).

**`warehouseSchema`** (`warehouses.validators.ts:3-11`) — `code`, `name`, `type: central | site`, `projectId?`, `location?`, `status: active | inactive`, `notes?`.

**`itemSchema`** (`warehouses.validators.ts:13-22`) — `code`, `name`, `category`, `unit`, `brand?`, `minimumStock?≥0`, `trackingType?: none | batch | serial`, `notes?`.

**`boqSchema`** (`boq.routes.ts:15-21`) — `itemCode`, `description`, `unit`, `quantity≥0`, `unitPrice≥0`.

**`ipcSchema`** (`ipc.routes.ts:20-36`) — `ipcNumber≥1`, `date` (must parse), `status: draft | submitted | approved | rejected`, `notes?`, `deductions?`, `grossAmount?≥0`, `items?: [{boqItemId, currentQuantity≥0}]`.

**`mrSchema`** (`material-requests.routes.ts:26-32`) — `projectId?`, `siteId?`, `warehouseId`, `items[{itemId, requestedQty>0, issuedQty?≥0, notes?}]` (min 1), `notes?`.

**`siteSchema`** (`sites.routes.ts:11-17`) — `projectId`, `code`, `name`, `location?`, `notes?`.

### 5.5 List contract (verified mechanics)

`applyPagination(items, page=1, pageSize=20)` returns `{ items, total, page, pageSize }`; `pageSize` is capped at 200. `applySearch(items, q, fields)` is a case/normalization-insensitive substring match over the named fields. `applySort(items, sortBy, sortDir='desc')` sorts numbers numerically and everything else with `localeCompare(..., 'en')`.

**Important architectural fact:** these operate on **arrays already fetched from the database**. Pagination is therefore in-process, not SQL-level. This is a target-design concern (§8.6), not just a cosmetic detail.

### 5.6 Permission vocabulary (verified)

`ALL_PERMISSIONS` = 28 keys: `archive.{view,upload,edit,delete,download}`, `warehouse.{view,create,edit,delete,stock_in,stock_out,transfer,adjust,return}`, `projects.{view,create,edit,delete}`, `materialRequests.{view,create,approve,issue}`, `reports.view`, `audit.view`, `settings.manage`, `users.manage`, `backup.manage`.

`MANAGED_PERMISSIONS` adds three administration keys: `roles.manage`, `projects.access`, `users.resetPassword` → **31 manageable keys**.

`AccessLevel` = `NONE | READ | WRITE | DELETE` with rank 0..3. `SCOPED_MIN_LEVEL` maps each project-scoped permission to a minimum membership level. Seeded roles: `admin` (all 28), `management`, `warehouse`, `technical`, `viewer`; unknown role names fall back to `viewer`.

---

## 6. Prototype Exports and Mocks (Layer B evidence)

### 6.1 Adapter namespaces — 65 methods

| Namespace | Methods | Business relevance |
|---|---|---|
| `mockApi` | 22 | Aggregated read/write facade over seed data |
| `stockApi` | 5 | Stock overview, ledger list/create, availability, type catalogue |
| `lookups` | 2 | Warehouse + item pickers |
| `boqApi` | 6 | BOQ list/total/progress + create/update/remove |
| `ipcApi` | 9 | IPC list/lines/get/transitions/remaining/summary + create/update/remove |
| `mrApi` | 8 | Project create/update + MR list/get/create/act/issue/remove |
| `userApi` | 9 | Effective rights, admin-count, guard + CRUD/overrides/access/reset |
| `reportApi` | 4 | Catalogue, preview, count, export |
| **Total** | **65** | |

### 6.2 Exported helpers, constants, and types (not adapter methods)

| Export | Kind | Purpose |
|---|---|---|
| `itemName`, `whName`, `projName` | helper | ID → display-name resolution |
| `canProject` | helper | Project-scoped permission check (mock side) |
| `boqTotal` | helper | Line total = `quantity × unitPrice` |
| `__protoFail` | test hook | Prototype crash-mode toggle |
| `EMAIL_RE` | constant | Mock email validation |
| `MR_STATUSES`, `MRAction` | constant / type | MR state vocabulary |
| `StockFilter`, `ReportDef`, `ExportFormat`, `ExportFilter`, `ExportResult`, `AccessLevel`, `OverrideEffect` | types | Type-only exports |

### 6.3 Correction to the previous draft

The previous version of this document stated that "the prototype uses 65 operations" and implied those 65 map one-to-one onto 65 endpoints. **That was wrong on two counts.**

1. **65 is a method count, not an operation count.** Methods such as `boqApi.total`, `boqApi.progress`, `ipcApi.remaining`, `ipcApi.summary`, `ipcApi.lines`, `ipcApi.transitions`, `reportApi.count`, `userApi.guard`, `userApi.adminCountAfter`, and `mockApi.resetHint` are derived-value helpers, invariant helpers, or development utilities. They require no server round-trip in a correct implementation.
2. **Some methods are misfiled by domain.** `mrApi.createProject` and `mrApi.updateProject` are project operations living in the material-request namespace. `mockApi.warehouses` / `mockApi.items` duplicate `lookups.warehouses` / `lookups.items`.

After removing derived helpers, invariant helpers, duplicates, and the dev-only reset hint, the distinct business operations are approximately **29** (`INFERRED CANDIDATE`, derived by grouping the table above by domain action). The precise number is not load-bearing; the discipline is: **never derive endpoint counts from export counts.**

### 6.4 Prototype authentication is mock-only

`src/app/providers/auth.tsx` (99 lines, read in full):

- The adapter exposes **no** login/logout/refresh method at all.
- `login(r: DemoRole)` resolves a mock user via `userApi.get(ROLE_USER[r])`, then writes `sessionStorage['cos-proto-user']`.
- `logout()` removes that key.
- No password field, no token, no cookie, no expiry.

The mock auth model is therefore `MOCK-ONLY` in its entirety, and **`NOT APPLICABLE`** as an adapter mapping source for W-01/W-02/W-05.

### 6.5 Mock-side validation rules that encode real business intent

| Rule | Source | Target treatment |
|---|---|---|
| `ipcNumber ≥ 1`; date required and parseable; status in the 4-value set; `grossAmount ≥ 0` | `ipcApi` validators | Carry as server-side invariants (already present live) |
| BOQ: itemCode/description/unit required; `quantity ≥ 0`; `unitPrice ≥ 0` | `boqApi` | Already present live |
| "cannot delete BOQ line referenced by IPC lines" | `boqApi.remove` | Already present live (409) |
| "insufficient stock for item X — available Y" | `stockApi.create` via `mrApi.issue` | Live service returns a 409; **exact message/key not verified** |
| Duplicate IPC number per project rejected | `ipcApi` | Already present live (409) |
| Email uniqueness on user create/update | `userApi` | Live behaviour `PARTIALLY VERIFIED` |
| Last-admin protection | `userApi.guard` / `adminCountAfter` | Already present live for roles; user-level `PARTIALLY VERIFIED` |

---

## 7. Mapping Matrix (A × B × C)

Each row: does an approved UI/UX workflow have (a) a live capability, and (b) a target contract? The matrix records **only** the classification; the reasoning lives in §10.

| Workflow | Layer A (live) | Layer B (UI need) | Layer C (target) | Reuse class |
|---|---|---|---|---|
| W-01 Sign in | Yes (cookie+token) | Real credentials + session | New session contract | `NEW TARGET CONTRACT REQUIRED` |
| W-02 Session continuity | Yes (rotation) | Invisible renewal | New session contract | `NEW TARGET CONTRACT REQUIRED` |
| W-03 Sign out | Yes | Device-scoped revoke | Kept | `REUSE BUSINESS CAPABILITY` |
| W-04 Identity + permissions | Yes (`/me`) | Full effective permission set | Extended `/me` | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| W-05 Active sessions | **Stub** | Real device list + revoke | New contract | `REPLACE LEGACY CAPABILITY` |
| W-06 Dashboard | No aggregate | Portfolio KPIs | New contract | `NEW TARGET CONTRACT REQUIRED` |
| W-07 Project list | Yes (paged) | Facets + cursor | Adapted list | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| W-08 Project create | Yes | Full record | Kept | `REUSE BUSINESS CAPABILITY` |
| W-09 Project edit | Yes | Full record | Kept | `REUSE BUSINESS CAPABILITY` |
| W-10 Project delete | Yes (409 guard) | Impact preview | Adapted delete | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| W-11 Project workspace | No | Composite summary | New contract | `NEW TARGET CONTRACT REQUIRED` |
| W-12 Project members | Yes (2 surfaces) | Project-owned membership API | Adapted | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| W-13 Sites | Yes | Project-nested path shape | Adapted (path only — list is already scoped) | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| W-14 Archive browse | Yes, richer than mock (10 filters) | Same filters + facets + cursor paging | Adapted envelope | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| W-15 Document upload | Yes | Progress/checksum | Adapted | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| W-16 Document edit | Yes | Same fields | Kept | `REUSE BUSINESS CAPABILITY` |
| W-17 Status transition | Yes (enum only) | Enforced state machine | Adapted | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| W-18 Revisions/replace | Yes | Same | Kept | `REUSE BUSINESS CAPABILITY` |
| W-19 Links | Yes (free-form) | Typed link targets | Adapted | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| W-20 Move to folder | Yes | Same | Kept | `REUSE BUSINESS CAPABILITY` |
| W-21 Document delete | Yes | Confirmation UX only | Kept | `REUSE BUSINESS CAPABILITY` |
| W-22 Preview/download | Yes (3 routes) | One content route | Adapted | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| W-23 Folders | Yes, **unguarded list** | Guarded tree | Replace list | `REPLACE LEGACY CAPABILITY` |
| W-24 BOQ | Yes | Bulk + totals | Adapted | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| W-25 IPC | Yes | Transitions + totals | Adapted | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| W-26 Financial indicators | Yes | Kept | Kept | `REUSE BUSINESS CAPABILITY` |
| W-27 Inventory hub | Yes | Kept | Kept | `REUSE BUSINESS CAPABILITY` |
| W-28 Warehouses | Yes | Kept | Kept | `REUSE BUSINESS CAPABILITY` |
| W-29 Items | Yes | Kept | Kept | `REUSE BUSINESS CAPABILITY` |
| W-30 Stock movements | Yes | Reversal instead of delete | Adapted | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| W-31 Movement history | Yes (duplicate route) | One route + filters | Adapted | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| W-32 Material requests | Yes | reject/close + update | Adapted | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| W-33 Reports | **No catalogue** | Catalogue + preview + export | New contract | `NEW TARGET CONTRACT REQUIRED` |
| W-34 Users admin | Yes (different fields) | Prototype field model | Adapted | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| W-35 Roles | Yes | Kept + matrix | Adapted | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| W-36 Overrides | Yes | Kept | Kept | `REUSE BUSINESS CAPABILITY` |
| W-37 Audit | Yes, shape verified | Paged filterable stream | Adapted | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| W-38 Notifications | Yes (30-cap) | Paged + read state | Adapted | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| W-39 Global search | Yes, shape verified | Typed federated results | Adapted | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| W-40 Settings/lookups | Yes, read-only | Editable reference data | Adapted | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| W-41 Excel import | Yes | Job model **not live** (`import_jobs` is `PROPOSED_NOT_IMPLEMENTED`; `import_history` is a summary record) | Adapted | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |

**Classification tally (41 rows):** `REUSE BUSINESS CAPABILITY` 12 · `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` 22 · `REUSE LEGACY HTTP CONTRACT` 0 · `NEW TARGET CONTRACT REQUIRED` 5 · `REPLACE LEGACY CAPABILITY` 2 · `UNKNOWN — NEEDS EVIDENCE` 0 — **= 41**.

Note the shape of that distribution: **no** workflow qualifies for exact HTTP-contract preservation. W-14 was the only candidate and was reclassified to adaptation in this audit round (§4.4): the approved UI requires cursor paging and facets, which change the response envelope `{items,total,page,pageSize}`, so the *filter semantics* are reusable but the *contract* is not. W-37 and W-39 were reclassified from `UNKNOWN` to adaptation after their implementations and shapes were verified by source reading (`audit.service.ts:54-99`; `global-search.service.ts:11-24,31-81`) — an unread shape was never evidence that a capability was missing. This is the quantitative justification for Decision D1's "selective reuse" rather than blanket reuse, and it is a *stronger* argument than the previous tally, not a weaker one.

---

## 8. Target API Catalog (Layer C — PROPOSED, NOT IMPLEMENTED)

> Every path in this section is a **proposal**. None exists today. Nothing here is authorized for implementation (D7 not authorized; D8 gates mandatory).

### 8.1 Design rules

1. **Resource-oriented paths**, HTTP verbs carry semantics. No verb-in-path except genuine sub-actions (`submit`, `approve`, `issue`).
2. **Under `/api/`** — namespace change deferred (D3).
3. **Uniform list envelope:** `{ data: T[], page: { nextCursor: string|null, hasMore: boolean }, meta: { total?: number } }`. Cursor paging is required because in-process array pagination (§5.5) cannot survive real data volume.
4. **Uniform error body** (`application/problem+json`): `{ type, title, status, code, detail, fields?, requestId }`. `code` is a stable machine key (e.g. `INSUFFICIENT_STOCK`, `IPC_STATUS_TRANSITION_INVALID`). Arabic user-facing text is resolved client-side from `code`, not from a server message.
5. **State changes are sub-resources**, not field writes. A status is not a PATCH-able field; it is the result of an action endpoint.
6. **Idempotency is applied where a retry would duplicate a business effect — not uniformly.** `Idempotency-Key` is **proposed** for: document create/upload, stock-movement create, and material-request issue — each an `OPEN` separate owner decision. **Import-job create idempotency is `DEFERRED`** with the D-SPEC-01 Option (b) ledger proposal and is **not authorized for current implementation**; the historical proposal is retained below. It is **not required** for operations whose natural uniqueness already makes retries safe (`project_code` unique; `(project_id, ipc_number)` unique; `(project_id, code)` for sites) or for pure reads. Applying the header mechanically to every `POST` would add replay storage and TTL semantics with no benefit.

   **Three idempotency kinds must not be conflated** (they have different status and different owners):

   | Kind | Status | Where it lives |
   |---|---|---|
   | (1) Import-job / ledger idempotency | **`DEFERRED`** — part of the D-SPEC-01 Option (b) ledger proposal, outside Phase 12 | Not implemented anywhere. Deferred is not cancelled. Not authorized for current implementation. |
   | (2) Document / stock-movement / material-request-issue idempotency | **`OPEN`** — separate decisions, proposed here, not approved | This rule is the only place it is stated; no storage model is designed. |
   | (3) Idempotency on the existing import confirm routes | **`OPEN — NOT IMPLEMENTED`** — no header is read or stored today (§5.3.1-F); not approved | Existing `smart/confirm` and `:entity/confirm` re-attempt every row on retry. |

   Rule 6 above is a **proposal**, not current behaviour. **No idempotency mechanism of any of the three kinds exists today.** `[PROP]` — not implemented.
7. **Concurrency on mutable aggregates uses `If-Match` + server `version`** (projects, document metadata, IPC header). A stale `If-Match` yields `412 PRECONDITION_FAILED`; a semantically illegal state change yields `409` with a stable `code`. `If-Match` is not a substitute for a transition matrix.
8. **No client-supplied scope for row-backed resources.** A `projectId` in a body, query, or path is *context only*; authorization is resolved server-side from persisted rows and membership (§8.9, §11.2).
9. **Binary content is a single audited route**, never a static path.

### 8.2 Identity and session — proposed

| Method | Path | Purpose | Notes |
|---|---|---|---|
| POST | `/api/session` | Sign in | Body `{username, password, rememberMe?}`; sets `HttpOnly` cookies; returns `{user, expiresAt}` |
| DELETE | `/api/session` | Sign out current device | 204 |
| POST | `/api/session/refresh` | Rotate refresh token | 204 + new cookies |
| GET | `/api/me` | Identity + effective permissions | `{user, permissions[], projectMemberships[], uiPreferences}` |
| GET | `/api/me/sessions` | List active devices | `[{id, createdAt, lastSeenAt, ip, userAgent, current}]` |
| DELETE | `/api/me/sessions/:id` | Revoke one device | 204 |
| DELETE | `/api/me/sessions` | Revoke all others | 204 |
| PATCH | `/api/me` | Self-service profile/password | Requires current password for change |

**Rationale:** W-01/W-02/W-05 cannot be served by the legacy contract. `GET /api/auth/sessions` is a stub (F-04), and the prototype has no auth at all (F-03).

### 8.3 Projects — proposed

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/projects` | Cursor list; filters `q, status, region, role, client, updatedFrom, updatedTo`; sort `code|name|updatedAt|contractValue` |
| POST | `/api/projects` | Create (creator auto-granted `DELETE`, preserved rule) |
| GET | `/api/projects/:projectId` | Detail + `version` |
| PATCH | `/api/projects/:projectId` | Partial update (`If-Match`) |
| DELETE | `/api/projects/:projectId` | Guarded; `409 DEPENDENCIES_EXIST` with `blockers[]` |
| GET | `/api/projects/:projectId/overview` | Composite: financials summary, counts, recent activity, alerts |
| GET | `/api/projects/:projectId/members` | `[{userId, username, fullName, access}]` |
| PUT | `/api/projects/:projectId/members` | Replace membership set (moved from `/users/:id/projects`) |
| GET | `/api/projects/:projectId/financials` | Contract value, BOQ total, executed total, deductions, per-IPC roll-up |
| GET | `/api/projects/:projectId/sites` | Project-nested list (fixes unscoped legacy `GET /api/sites`) |
| POST | `/api/projects/:projectId/sites` | Create |
| PATCH | `/api/projects/:projectId/sites/:siteId` | Update |
| DELETE | `/api/projects/:projectId/sites/:siteId` | Delete |
| GET | `/api/projects/:projectId/boq` | Lines + computed `total` |
| POST | `/api/projects/:projectId/boq/bulk` | Bulk upsert (new: prototype edits grids, not single rows) |
| PATCH | `/api/projects/:projectId/boq/:lineId` | Update |
| DELETE | `/api/projects/:projectId/boq/:lineId` | 409 when referenced by IPC lines |
| GET | `/api/projects/:projectId/ipcs` | List with `{grossAmount, deductions, netAmount, status}` |
| POST | `/api/projects/:projectId/ipcs` | Create |
| GET | `/api/projects/:projectId/ipcs/:ipcId` | Detail + lines |
| PATCH | `/api/projects/:projectId/ipcs/:ipcId` | Update fields/lines |
| DELETE | `/api/projects/:projectId/ipcs/:ipcId` | Guarded |
| POST | `/api/projects/:projectId/ipcs/:ipcId/transitions` | `{action: 'submit'|'approve'|'reject'|'reopen', reason?}` |

**Preserved business rules** (verified live, must not regress): IPC number unique per project; illegal status transitions rejected; BOQ deletion blocked while IPC lines reference it; delete-cascade of a project is transactional; creator gets `DELETE` on create.

### 8.4 Archive — proposed

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/documents` | Cursor list; keep all **10** legacy filters + `tag`, `linkedTo` |
| POST | `/api/documents` | Multipart create (metadata + file); `Idempotency-Key`: **`OPEN`** — proposed only, not approved, not currently mandatory, not implemented |
| GET | `/api/documents/:documentId` | Detail + links + revision summary |
| PATCH | `/api/documents/:documentId` | Metadata update (`If-Match`) |
| DELETE | `/api/documents/:documentId` | Guarded delete |
| GET | `/api/documents/:documentId/revisions` | Revision history |
| POST | `/api/documents/:documentId/revisions` | Add revision (multipart) |
| POST | `/api/documents/:documentId/replace` | Replace current file (multipart) |
| GET | `/api/documents/:documentId/content` | Single audited content route (`?disposition=inline|attachment`) |
| POST | `/api/documents/:documentId/links` | `{targetType, targetId}` — typed targets |
| DELETE | `/api/documents/:documentId/links/:linkId` | Unlink (scoped to the document) |
| POST | `/api/documents/:documentId/transitions` | `{action, reason?}` — enforced state machine |
| PATCH | `/api/documents/:documentId/folder` | Move |
| GET | `/api/folders` | Guarded folder tree (`archive.view`) |
| POST | `/api/folders` | Create |
| PATCH | `/api/folders/:folderId` | Rename |
| DELETE | `/api/folders/:folderId` | Delete (blocked when non-empty) |
| POST | `/api/documents/export` | `{format, filter}` → job or stream |
| POST | `/api/documents/archive` | Bulk ZIP export |

**Three legacy preview/download/file routes collapse into one `content` route** — a deliberate reduction, not an oversight. `DELETE /api/documents/links/:linkId` loses its unscoped shape: the target nests it under the document so row-scope applies.

**Document idempotency is `OPEN` — a separate owner decision.** `Idempotency-Key` on `POST /api/documents` is a **proposal only**: it is not approved, not a required header in the current contract, and not implemented in the existing API. No idempotency guarantee exists today, and the header must not be treated as one. It may become required only after explicit owner approval and a separately authorized implementation decision (§8.1 rule 6). The revision-add proposal carries the same status (§8.8, ARC-07).

### 8.5 Inventory and procurement — proposed

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/inventory/overview` | `{byWarehouse, totalByItem, lowStock, summaryByType, alerts[]}` |
| GET | `/api/inventory/warehouses` | List (cursor) |
| POST | `/api/inventory/warehouses` | Create |
| PATCH | `/api/inventory/warehouses/:warehouseId` | Update |
| DELETE | `/api/inventory/warehouses/:warehouseId` | Guarded |
| GET | `/api/inventory/items` | List (cursor, filters) |
| POST | `/api/inventory/items` | Create |
| PATCH | `/api/inventory/items/:itemId` | Update |
| DELETE | `/api/inventory/items/:itemId` | Guarded |
| GET | `/api/inventory/stock` | Balances by warehouse/item |
| GET | `/api/inventory/movements` | Ledger (cursor, filters) |
| POST | `/api/inventory/movements` | Create movement; `Idempotency-Key`: **`OPEN`** — proposed only, not approved, not currently mandatory, not implemented |
| POST | `/api/inventory/movements/:movementId/reversal` | **New**: correct a movement without mutating the ledger |
| GET | `/api/material-requests` | List (cursor, filters) |
| POST | `/api/material-requests` | Create draft |
| GET | `/api/material-requests/:requestId` | Detail + lines |
| PATCH | `/api/material-requests/:requestId` | Edit while `draft` |
| POST | `/api/material-requests/:requestId/transitions` | `{action: 'submit'|'approve'|'reject'|'close', reason?}` |
| POST | `/api/material-requests/:requestId/issues` | Partial issue → creates stock movement, returns both |
| DELETE | `/api/material-requests/:requestId` | Draft-only delete |

**Reversal instead of delete** is the direct answer to F-05: the ledger is immutable, so correction must be an append operation. `DELETE /api/stock/transactions/:id` is retired.

**Stock-movement idempotency is `OPEN` — a separate owner decision.** `Idempotency-Key` on `POST /api/inventory/movements` is a **proposal only**: it is not approved, not a mandatory header in the current contract, and not implemented in the existing API. No idempotency guarantee is established today, and the header must not be treated as one. It may become required only after explicit owner approval and a separately authorized implementation decision (§8.1 rule 6). The material-request issue proposal carries the same status (§8.8, INV-19).

### 8.6 Lists, paging, and scaling

Legacy lists fetch-then-filter (§5.5). The target contract **requires** server-side filtering and cursor pagination for: documents, projects, movements, material requests, audit logs, notifications, users. Without this, the approved UI degrades to unusable at realistic record counts. This is a contract requirement, not an optimization preference.

### 8.7 Administration, insight, platform — proposed

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/users` | Cursor list, `q`, `role`, `active` |
| POST | `/api/admin/users` | Create |
| PATCH | `/api/admin/users/:userId` | Update |
| DELETE | `/api/admin/users/:userId` | Deactivate/delete with last-admin guard |
| POST | `/api/admin/users/:userId/password-reset` | Admin-initiated reset |
| GET | `/api/admin/users/:userId/overrides` | List |
| PUT | `/api/admin/users/:userId/overrides` | Replace |
| DELETE | `/api/admin/users/:userId/overrides/:permissionKey` | Remove one |
| GET | `/api/admin/users/:userId/effective-permissions` | `{permission, effective, source, roleValue, override, projectAccess}` |
| GET | `/api/admin/roles` | Roles + counts |
| POST | `/api/admin/roles` | Create |
| GET | `/api/admin/roles/:roleId` | Detail |
| PATCH | `/api/admin/roles/:roleId` | Update permissions (name immutable) |
| DELETE | `/api/admin/roles/:roleId` | 403 system / 409 in-use |
| POST | `/api/admin/roles/:roleId/clone` | Clone |
| GET | `/api/admin/roles/:roleId/users` | Members |
| GET | `/api/admin/permissions` | **New**: permission catalogue + descriptions (UI needs it to render the matrix) |
| GET | `/api/audit-logs` | Cursor, filters `actor, action, entityType, entityId, from, to` |
| GET | `/api/reports` | **New**: report catalogue |
| GET | `/api/reports/:reportId/preview` | Columns + sample rows |
| POST | `/api/reports/:reportId/export` | `{format}` → job or stream |
| GET | `/api/import/jobs` | Import history — **`DEPENDENCY_UNRESOLVED — NOT IMPLEMENTED — OUT OF CURRENT EXECUTION SCOPE`** (retained as a historical proposal only; `import_history` is not a job store, §5.3.1-B/E) |
| POST | `/api/import/jobs` | Start import (upload + entity) — **`DEPENDENCY_UNRESOLVED — NOT IMPLEMENTED — OUT OF CURRENT EXECUTION SCOPE`** |
| GET | `/api/import/jobs/:jobId` | Progress/result — **`DEPENDENCY_UNRESOLVED — NOT IMPLEMENTED — OUT OF CURRENT EXECUTION SCOPE`** |
| GET | `/api/import/templates/:entity` | Template download — **shape proposal**; the live equivalent is `GET /api/import/:entity/template` (§5.3 #105), which requires **no** permission check |
| GET | `/api/notifications` | Cursor + unread count in `meta` |
| POST | `/api/notifications/:notificationId/read` | Mark one |
| POST | `/api/notifications/read-all` | Mark all |
| GET | `/api/search` | Typed results `{projects[], documents[], items[], requests[]}` with per-type cursors |
| GET | `/api/lookups/categories` | Reference data |
| GET | `/api/lookups/units` | Reference data |
| GET | `/api/lookups/warehouses` | Scoped picker |
| GET | `/api/lookups/items` | Scoped picker |

### 8.8 Per-operation contract specification (PROPOSED)

Every operation below is a proposal. None exists. The table is the review surface for the contract: request DTO, response DTO, query/cursor semantics, authorization and scope, transaction boundary, concurrency control, error set, and the label that says how much is actually known.

**Label legend**

| Label | Meaning |
|---|---|
| `L-BASIS: VERIFIED` | The legacy route, its request validation, and its response shape were all read. The target may differ in envelope, but nothing about the legacy behaviour is guessed. |
| `L-BASIS: PARTIAL` | At least one element is not determinable from read source (unread service, undecided owner question, or an inconsistency this document refuses to paper over). The operation is marked **`PARTIALLY SPECIFIED`**. |
| `L-BASIS: NONE` | No legacy equivalent exists; the contract is a pure design proposal. |

**Error codes** referenced below are stable machine keys; the Arabic surface text is resolved client-side from `code`. Standard set unless narrowed: `401 UNAUTHENTICATED`, `403 FORBIDDEN` (permission missing), `403 FORBIDDEN_SCOPE` (explicitly requested out-of-scope filter), `404 NOT_FOUND`, `409 CONFLICT`, `412 STALE_VERSION`, `422 VALIDATION_FAILED`.

#### 8.8.1 Session and identity

| Op | Workflow | Method / Path | Request → Response | Query / cursor | Authz + scope | Tx / concurrency | Errors | Label |
|---|---|---|---|---|---|---|---|---|
| SES-01 | W-01 | `POST /api/session` | `{username, password, rememberMe?}` → `{user:{id,username,fullName,roleName}, expiresAt}` + `HttpOnly` cookies | — | Anonymous; rate-limited; failed attempt audited | Single write: session row insert + refresh-token hash | `401`, `423` (lockout policy undecided), `429` | `L-BASIS: VERIFIED` (legacy `auth.routes.ts` login) |
| SES-02 | W-03 | `DELETE /api/session` | — → `204` | — | Authenticated; revokes **current** `sid` only | One session row `revoked_at` | `401` | `L-BASIS: VERIFIED` |
| SES-03 | W-02 | `POST /api/session/refresh` | — → `204` + rotated cookies | — | Refresh cookie only; reuse of a rotated token revokes the family | One row rotate inside a transaction | `401`, `409` (reuse detected) | `L-BASIS: VERIFIED` (rotation + reuse detection live) |
| SES-04 | W-04 | `GET /api/me` | — → `{user, permissions[], projectMemberships[], uiPreferences?}` | — | Authenticated; permissions computed server-side per request | Read-only | `401` | `L-BASIS: PARTIAL` — legacy `/me` returns `req.user`; whether `projectMemberships` is included and the shape of `uiPreferences` are **unverified** (U-05 adjacent) |
| SES-05 | W-05 | `GET /api/me/sessions` | — → `[{id, createdAt, lastSeenAt, ip, userAgent, current}]` | — | Authenticated; **own** sessions only | Read-only | `401` | `L-BASIS: NONE` — legacy route is a placeholder |
| SES-06 | W-05 | `DELETE /api/me/sessions/:id` | — → `204` | — | Own session only; `404` if the id is not the caller's | One row `revoked_at`; revoking `current` is allowed (acts as logout) | `401`, `404` | `L-BASIS: NONE` |
| SES-07 | W-05 | `DELETE /api/me/sessions` | — → `204` | — | Own sessions except current | Bulk update in one transaction | `401` | `L-BASIS: NONE` — **optional (C)**, see W-05 |
| SES-08 | W-04 | `PATCH /api/me` | `{fullName?, email?, currentPassword?, newPassword?}` → user | — | Own record; password change requires `currentPassword` and revokes other sessions | Single row update + session family revoke | `400`, `401`, `409` | `L-BASIS: PARTIAL` — legacy self-edit exists (`auth.routes.ts:169-215`) with self-guards; endpoint shape differs |

#### 8.8.2 Projects, sites, BOQ, IPC

| Op | Workflow | Method / Path | Request → Response | Query / sort / cursor | Authz + scope | Tx / concurrency | Errors | Label |
|---|---|---|---|---|---|---|---|---|
| PRJ-01 | W-07 | `GET /api/projects` | — → `{data: Project[], page:{nextCursor,hasMore}, meta:{total?}}` | `q, status, region, role, client, updatedFrom, updatedTo`; sort `code\|name\|updatedAt\|contractValue`; cursor = opaque `(sortKey,id)` | `projects.view` + server-resolved visible set. A `projectId`-style filter may narrow, never widen | Read-only | `401`, `403` | `L-BASIS: VERIFIED` (filters/paging today are in-process — §5.5) |
| PRJ-02 | W-08 | `POST /api/projects` | full project record → `201 Project` | — | `projects.create` | One transaction: project row + creator `DELETE` membership | `409` `DUPLICATE_PROJECT_CODE`, `422` | `L-BASIS: VERIFIED` |
| PRJ-03 | W-09 | `GET /api/projects/:projectId` | — → `Project & {version}` | — | `projects.view` + row membership; `404` when invisible | Read-only | `404` | `L-BASIS: VERIFIED` |
| PRJ-04 | W-09 | `PATCH /api/projects/:projectId` | partial project → `Project` | — | `projects.edit` + at least `WRITE` on the row | `If-Match` on `version`; row update + audit in one transaction | `404`, `409`, `412`, `422` | `L-BASIS: VERIFIED` |
| PRJ-05 | W-10 | `DELETE /api/projects/:projectId` | — → `204` | — | `projects.delete` + `DELETE` membership | **Single transaction** cascade (BOQ + IPC); `409 DEPENDENCIES_EXIST` with `blockers[]` when guarded | `404`, `409` | `L-BASIS: VERIFIED` |
| PRJ-06 | W-11 | `GET /api/projects/:projectId/overview` | — → `{financials, counts, recentActivity[], alerts[]}` | `activityLimit` (bounded, default 10) | Composite read; **every sub-block independently authorized**, block omitted if its permission is missing | Read-only, non-atomic across blocks | `404` | `L-BASIS: PARTIAL` — composite shape is designed here, not derived from legacy |
| PRJ-07 | W-12 | `GET /api/projects/:projectId/members` | — → `[{userId, username, fullName, access}]` | — | `projects.access` (admin path) **or** project `WRITE` | Read-only | `404` | `L-BASIS: VERIFIED` (two legacy surfaces; read shape partially) |
| PRJ-08 | W-12 | `PUT /api/projects/:projectId/members` | `{members:[{userId, access}]}` → members | — | `projects.access`; must not remove the last `DELETE` holder of the project | Replace-set in one transaction; `409` on last-holder violation | `404`, `409`, `422` | `L-BASIS: PARTIAL` — legacy write path is user-centric (`/users/:id/projects`) |
| PRJ-09 | W-26 | `GET /api/projects/:projectId/financials` | — → `{contractValue, boqTotal, executedTotal, executedDeductions, remaining, currency, ipcs[]}` | — | `projects.view` + project row membership. **Loud `403` only for an explicit out-of-scope request**, never for the caller's implicit visible set | Read-only; computed from `boq_items` + approved `ipcs` | `404` | `L-BASIS: VERIFIED` (legacy 15-field shape), **but** legacy `/financials` is portfolio-wide and unscoped (G-08) |
| PRJ-10 | W-13 | `GET /api/projects/:projectId/sites` | — → `{data: Site[], page}` | `q`; cursor | `projects.view` + row membership; parent path ID is **context**, membership is the authority | Read-only | `403`/`404` (owner decision on hiding; see §11.3) | `L-BASIS: VERIFIED` (`sites.routes.ts:22-31`) |
| PRJ-11 | W-13 | `POST /api/projects/:projectId/sites` | `{code, name, location?, notes?}` → `201 Site` | — | `projects.edit` + `WRITE` on the parent project | Single row insert; `projectId` taken from path **and verified** against the row's scope | `403`, `409 DUPLICATE_SITE_CODE`, `422` | `L-BASIS: VERIFIED` |
| PRJ-12 | W-13 | `PATCH /api/projects/:projectId/sites/:siteId` | partial site → `Site` | — | `projects.edit` + `WRITE` | Row must belong to `projectId`; `404` otherwise. `If-Match` optional (owner decision) | `404`, `409`, `422` | `L-BASIS: VERIFIED` |
| PRJ-13 | W-13 | `DELETE /api/projects/:projectId/sites/:siteId` | — → `204` | — | `projects.edit` + `WRITE` | Row-belongs-to-parent check; `409` when referenced by documents | `404`, `409` | `L-BASIS: PARTIAL` — legacy delete guard detail not read |
| PRJ-14 | W-24 | `GET /api/projects/:projectId/boq` | — → `{lines: BoqLine[], total}` | `q`; sort `itemCode\|quantity\|unitPrice`; cursor | `projects.view` + row membership | Read-only | `403`/`404` | `L-BASIS: VERIFIED` |
| PRJ-15 | W-24 | `POST /api/projects/:projectId/boq/bulk` | `{lines:[{id?, itemCode, description, unit, quantity, unitPrice}]}` → `{created, updated, total}` | — | `projects.edit` + `WRITE` | **One transaction**; all-or-nothing; rejects duplicate `itemCode` within the project | `409`, `422` | `L-BASIS: NONE` (bulk upsert is new; single-row live) |
| PRJ-16 | W-24 | `PATCH /api/projects/:projectId/boq/:lineId` | partial line → `BoqLine` | — | `projects.edit` + `WRITE` | Row-belongs-to-parent; `quantity`/`unitPrice ≥ 0` | `404`, `409`, `422` | `L-BASIS: VERIFIED` |
| PRJ-17 | W-24 | `DELETE /api/projects/:projectId/boq/:lineId` | — → `204` | — | `projects.edit` + `WRITE` | `409 BOQ_LINE_REFERENCED` while any IPC line references it | `404`, `409` | `L-BASIS: VERIFIED` |
| PRJ-18 | W-25 | `GET /api/projects/:projectId/ipcs` | — → `{data: Ipc[], page, meta:{totals?}}` | `status`, `from`, `to`; sort `number\|date`; cursor | `projects.view` + row membership | Read-only; `executed*` totals count **approved only** | `403`/`404` | `L-BASIS: VERIFIED` |
| PRJ-19 | W-25 | `POST /api/projects/:projectId/ipcs` | `{ipcNumber, date, status?, notes?, deductions?, lines[]}` → `201 Ipc` | — | `projects.edit` + `WRITE` | Transaction: header + lines; `(project_id, ipc_number)` unique | `409 DUPLICATE_IPC_NUMBER`, `422` | `L-BASIS: VERIFIED` |
| PRJ-20 | W-25 | `GET /api/projects/:projectId/ipcs/:ipcId` | — → `{...Ipc, items: IpcLine[]}` | — | `projects.view` + row membership; wrong-parent or invisible → `404` | Read-only | `404` | `L-BASIS: VERIFIED` (`ipc.routes.ts:50-57`) |
| PRJ-21 | W-25 | `PATCH /api/projects/:projectId/ipcs/:ipcId` | partial header/lines → `Ipc` | — | `projects.edit` + `WRITE`; editable states only (owner decision: which) | `If-Match` on `version`; header + lines in one transaction | `404`, `409`, `412`, `422` | `L-BASIS: PARTIAL` — editable-state rule not defined in legacy |
| PRJ-22 | W-25 | `DELETE /api/projects/:projectId/ipcs/:ipcId` | — → `204` | — | `projects.edit` + `WRITE` | Guarded by status (which statuses is an owner decision) | `404`, `409` | `L-BASIS: PARTIAL` |
| PRJ-23 | W-25 | `POST /api/projects/:projectId/ipcs/:ipcId/transitions` | `{action: submit\|approve\|reject\|reopen, reason?}` → `Ipc` | — | `projects.edit`; `approve` may require a distinct permission (owner decision) | Matrix from legacy `IPC_TRANSITIONS` (`ipc.routes.ts:67-72`); row lock or `If-Match`; status + audit + notification in one transaction | `404`, `409 IPC_STATUS_TRANSITION_INVALID`, `412` | `L-BASIS: VERIFIED` (matrix), `PARTIALLY SPECIFIED` (permission split) |

#### 8.8.3 Archive

| Op | Workflow | Method / Path | Request → Response | Query / sort / cursor | Authz + scope | Tx / concurrency | Errors | Label |
|---|---|---|---|---|---|---|---|---|
| ARC-01 | W-14 | `GET /api/documents` | — → `{data: Document[], page, meta:{total?, facets?}}` | `q, projectId, folderId, siteId, category, documentType, revision, status, from, to` (+ `tag`, `linkedTo`); sort; cursor | `archive.view` + visible-scope; explicit `projectId` on a no-access project → `403 FORBIDDEN_SCOPE` | Read-only; server-side filtering replaces in-process filtering | `403`, `422` | `L-BASIS: VERIFIED` (10 filters); **envelope deliberately changed** |
| ARC-02 | W-15 | `POST /api/documents` | multipart: `file` + metadata → `201 Document` | — | `archive.upload` + target project membership; **scope from the resolved project row, not from the form field alone** | Transaction: `document_files` + `documents` + audit; `Idempotency-Key` **required if approved** (`OPEN`, §8.1 rule 6) | `409` (duplicate key replay), `413`, `415`, `422` | `L-BASIS: VERIFIED` (route/guard), `PARTIAL` (storage backend, U-08) |
| ARC-03 | W-16 | `GET /api/documents/:documentId` | — → `Document & {links[], revisionSummary, version}` | — | `archive.view` + row scope; invisible → `404` | Read-only | `404` | `L-BASIS: VERIFIED` |
| ARC-04 | W-16 | `PATCH /api/documents/:documentId` | partial metadata → `Document` | — | `archive.edit` + row scope | `If-Match` on `version` | `404`, `409`, `412`, `422` | `L-BASIS: VERIFIED` |
| ARC-05 | W-21 | `DELETE /api/documents/:documentId` | — → `204` | — | `archive.delete` + row scope | Transaction: files/revisions/links/tags + audit; blob deletion is a post-commit side effect | `404`, `409` | `L-BASIS: PARTIAL` — legacy cascade detail not read |
| ARC-06 | W-18 | `GET /api/documents/:documentId/revisions` | — → `[{id, label, notes, createdBy, createdAt}]` | cursor | `archive.view` + row scope | Read-only | `404` | `L-BASIS: VERIFIED` |
| ARC-07 | W-18 | `POST /api/documents/:documentId/revisions` | multipart → `201 Revision` | — | `archive.upload` + row scope | Transaction: file + revision + counter; label derived, **never `+1` twice**; `Idempotency-Key` **required if approved** (`OPEN`, §8.1 rule 6) | `404`, `409`, `422` | `L-BASIS: VERIFIED` (label rule) |
| ARC-08 | W-18 | `POST /api/documents/:documentId/replace` | multipart → `Document` | — | `archive.edit` + row scope | Transaction: new file + revision + `current_file_id` swap | `404`, `409`, `422` | `L-BASIS: VERIFIED` |
| ARC-09 | W-22 | `GET /api/documents/:documentId/content` | — → binary stream | `disposition=inline\|attachment` | `archive.download` **and** row scope; **every fetch audited** | Read-only; no signed static URL | `404`, `415` | `L-BASIS: PARTIAL` — three legacy content routes collapse here; header detail `UNKNOWN` |
| ARC-10 | W-19 | `POST /api/documents/:documentId/links` | `{targetType: project\|site\|ipc\|warehouse\|item, targetId}` → `201 Link` | — | `archive.edit` + document row scope **and** read access to the target | Transaction: existence check both sides | `404`, `409`, `422` | `L-BASIS: VERIFIED` (free-form target live; typed is new) |
| ARC-11 | W-19 | `DELETE /api/documents/:documentId/links/:linkId` | — → `204` | — | `archive.edit` + document row scope; the link must belong to that document → else `404` | Single row delete | `404` | `L-BASIS: PARTIAL` — legacy delete is unscoped (G-02); target fixes it |
| ARC-12 | W-17 | `POST /api/documents/:documentId/transitions` | `{action, reason?}` → `Document` | — | `archive.edit` + row scope | Explicit allowed-transition map; status + audit + notification in one transaction | `404`, `409 DOCUMENT_TRANSITION_INVALID`, `412` | `L-BASIS: PARTIAL` — legacy has **no** matrix (G-05); the target matrix is **not yet defined** → Q-05 |
| ARC-13 | W-20 | `PATCH /api/documents/:documentId/folder` | `{folderId \| null}` → `Document` | — | `archive.edit` + row scope + folder scope | Single row update | `404`, `422` | `L-BASIS: VERIFIED` |
| ARC-14 | W-23 | `GET /api/folders` | — → folder tree | — | `archive.view`; **scope rule unresolved** — the model has no `project_id` (§9.3) | Read-only | `401` | `L-BASIS: PARTIAL` — legacy list is guarded by `requireAuth` only; target requires a scope decision |
| ARC-15 | W-23 | `POST /api/folders` | `{name, parentId?}` → `201 Folder` | — | `archive.upload` | Single row; `path` recompute in the same transaction | `409`, `422` | `L-BASIS: VERIFIED` |
| ARC-16 | W-23 | `PATCH /api/folders/:folderId` | `{name?}` → `Folder` | — | `archive.edit` | Single row; rename must not orphan child paths | `404`, `409`, `422` | `L-BASIS: VERIFIED` |
| ARC-17 | W-23 | `DELETE /api/folders/:folderId` | — → `204` | — | `archive.delete` | `409 FOLDER_NOT_EMPTY` when it has children or documents | `404`, `409` | `L-BASIS: VERIFIED` |
| ARC-18 | W-22 | `POST /api/documents/export` | `{format: xlsx\|pdf\|csv, filter}` → stream or job | same filter set as ARC-01 | `archive.download` + visible-scope; **export must apply the same scope as the list** | Read-only; row cap enforced | `413`, `422` | `L-BASIS: PARTIAL` — column sets U-09 |
| ARC-19 | W-22 | `POST /api/documents/archive` | `{filter}` → ZIP stream/job | same as ARC-01 | `archive.download` + visible-scope | Read-only; size cap | `413`, `422` | `L-BASIS: PARTIAL` |

#### 8.8.4 Inventory and procurement

| Op | Workflow | Method / Path | Request → Response | Query / sort / cursor | Authz + scope | Tx / concurrency | Errors | Label |
|---|---|---|---|---|---|---|---|---|
| INV-01 | W-27 | `GET /api/inventory/overview` | — → `{byWarehouse, totalByItem, lowStock, summaryByType, alerts[]}` | `warehouseId?` | `warehouse.view` | Read-only; derived from the ledger | `401` | `L-BASIS: VERIFIED` (legacy shape); `alerts[]` is new |
| INV-02 | W-28 | `GET /api/inventory/warehouses` | — → `{data, page}` | `q, type, projectId, status`; cursor | `warehouse.view`; a project-bound warehouse requires membership for that project | Read-only | `403` | `L-BASIS: VERIFIED` |
| INV-03 | W-28 | `POST /api/inventory/warehouses` | `{code, name, type, projectId?, location?, status?}` → `201` | — | `warehouse.create` + project `WRITE` when `projectId` present | Single row; `code` unique | `409`, `422` | `L-BASIS: VERIFIED` |
| INV-04 | W-28 | `PATCH /api/inventory/warehouses/:warehouseId` | partial → `Warehouse` | — | `warehouse.edit` + existing row scope | Single row | `404`, `409`, `422` | `L-BASIS: VERIFIED` |
| INV-05 | W-28 | `DELETE /api/inventory/warehouses/:warehouseId` | — → `204` | — | `warehouse.delete` | `409` when stock or movements exist (blocker list = U-11 follow-up) | `404`, `409` | `L-BASIS: PARTIAL` — blocker enumeration is a single message string today |
| INV-06 | W-29 | `GET /api/inventory/items` | — → `{data, page}` | `q, category, trackingType`; cursor | `warehouse.view` | Read-only | `401` | `L-BASIS: VERIFIED` |
| INV-07 | W-29 | `POST /api/inventory/items` | item → `201` | — | `warehouse.create` | Single row; `code` unique | `409`, `422` | `L-BASIS: VERIFIED` |
| INV-08 | W-29 | `PATCH /api/inventory/items/:itemId` | partial → `Item` | — | `warehouse.edit` | Single row | `404`, `409`, `422` | `L-BASIS: VERIFIED` |
| INV-09 | W-29 | `DELETE /api/inventory/items/:itemId` | — → `204` | — | `warehouse.delete` | `409` when referenced by movements/IPC lines | `404`, `409` | `L-BASIS: PARTIAL` |
| INV-10 | W-27 | `GET /api/inventory/stock` | — → `{data:[{warehouseId,itemId,quantity}], page}` | `warehouseId, itemId, lowOnly`; cursor | `warehouse.view` | Read-only over ◇ `stock_balances` | `401` | `L-BASIS: PARTIAL` — read model refresh policy §9.5 |
| INV-11 | W-31 | `GET /api/inventory/movements` | — → `{data, page, meta:{totals?}}` | `type, warehouseId, itemId, from, to, projectId`; sort `date\|createdAt`; cursor | `warehouse.view`; project-bound movements require membership | Read-only | `403` | `L-BASIS: VERIFIED` (`listTxsPaged` shape = U-12) |
| INV-12 | W-30 | `POST /api/inventory/movements` | `{type, warehouseId, destinationWarehouseId?, projectId?, referenceNumber?, date, notes?, lines[]}` → `201` | — | `warehouse.stock_in\|stock_out\|transfer\|adjust\|return` by `type` + project `WRITE` | **One transaction**: movement + lines + balance effect; `Idempotency-Key` **required if approved** (`OPEN`, §8.1 rule 6); insufficient stock → `409 INSUFFICIENT_STOCK` | `404`, `409`, `412`, `422` | `L-BASIS: VERIFIED` |
| INV-13 | W-30 | `POST /api/inventory/movements/:movementId/reversal` | `{reason}` → `201 Movement` | — | same permission as the original movement type + `warehouse.adjust` (owner decision) | Transaction: reversal movement referencing the original; original never mutated; idempotent per movement | `404`, `409 ALREADY_REVERSED`, `422` | `L-BASIS: NONE` — legacy has no reversal; delete is a dead `400` |
| INV-14 | W-32 | `GET /api/material-requests` | — → `{data, page}` | `status, projectId, siteId, warehouseId, from, to`; cursor | `materialRequests.view` + project row scope | Read-only | `403` | `L-BASIS: VERIFIED` |
| INV-15 | W-32 | `POST /api/material-requests` | `{projectId?, siteId?, warehouseId, items[{itemId, requestedQty>0, notes?}], notes?}` → `201` | — | `materialRequests.create` + project `WRITE` | Transaction: header + lines; `draft` status | `404`, `422` | `L-BASIS: VERIFIED` |
| INV-16 | W-32 | `GET /api/material-requests/:requestId` | — → `{...Request, lines[]}` | — | `materialRequests.view` + row scope; invisible → `404` | Read-only | `404` | `L-BASIS: VERIFIED` |
| INV-17 | W-32 | `PATCH /api/material-requests/:requestId` | partial → `Request` | — | `materialRequests.create` + row scope; `draft` only | `If-Match`; header + lines in one transaction | `404`, `409`, `412` | `L-BASIS: NONE` (edit is a documented legacy gap) |
| INV-18 | W-32 | `POST /api/material-requests/:requestId/transitions` | `{action: submit\|approve\|reject\|close, reason?}` → `Request` | — | `materialRequests.approve` for approve/reject; `create` for submit; `close` = owner decision | Explicit matrix; status + audit in one transaction | `404`, `409 MR_TRANSITION_INVALID` | `L-BASIS: VERIFIED` (submit/approve); `PARTIAL` (reject/close are new) |
| INV-19 | W-32 | `POST /api/material-requests/:requestId/issues` | `{lines:[{itemId, qty}]}` → `{request, movement}` | — | `materialRequests.issue` + row scope | **One transaction**: issue lines + stock movement + balances; `issued_qty ≤ requested_qty`; `Idempotency-Key` **required if approved** (`OPEN`, §8.1 rule 6); approved-only | `404`, `409 INSUFFICIENT_STOCK`, `409 OVER_ISSUE`, `422` | `L-BASIS: VERIFIED` |
| INV-20 | W-32 | `DELETE /api/material-requests/:requestId` | — → `204` | — | `materialRequests.create` + row scope; `draft` only | Single transaction; `409` when issued | `404`, `409` | `L-BASIS: VERIFIED` |

#### 8.8.5 Administration, audit, reports, search, platform

| Op | Workflow | Method / Path | Request → Response | Query / cursor | Authz + scope | Tx / concurrency | Errors | Label |
|---|---|---|---|---|---|---|---|---|
| ADM-01 | W-34 | `GET /api/admin/users` | — → `{data: SafeUser[], page}` | `q, role, active`; cursor | `users.manage` | Read-only | `403` | `L-BASIS: PARTIAL` — field model U-05 |
| ADM-02 | W-34 | `POST /api/admin/users` | `{username, fullName, email, password, roleName, dept?, title?}` → `201 SafeUser` | — | `users.manage` | Single row; username + email unique | `409`, `422` | `L-BASIS: VERIFIED` |
| ADM-03 | W-34 | `PATCH /api/admin/users/:userId` | partial → `SafeUser` | — | `users.manage`; self-guards preserved | Transaction: update + last-admin coverage check; `409 LAST_ADMIN_PROTECTED` | `404`, `409`, `422` | `L-BASIS: VERIFIED` (`auth.routes.ts:181-185`) |
| ADM-04 | W-34 | `DELETE /api/admin/users/:userId` | — → `204` (deactivate) | — | `users.manage`; self-delete forbidden | Last-admin coverage check; `409 LAST_ADMIN_PROTECTED` | `403`, `404`, `409` | `L-BASIS: VERIFIED` (`auth.routes.ts:219-222`) |
| ADM-05 | W-34 | `POST /api/admin/users/:userId/password-reset` | `{newPassword}` → `204` | — | `users.manage` + `users.resetPassword` | Single row; revokes that user's sessions | `404`, `422` | `L-BASIS: PARTIAL` |
| ADM-06 | W-36 | `GET /api/admin/users/:userId/overrides` | — → `[{permissionKey, effect}]` | — | `users.manage` | Read-only | `404` | `L-BASIS: VERIFIED` |
| ADM-07 | W-36 | `PUT /api/admin/users/:userId/overrides` | `{overrides:[{permissionKey, effect}]}` → overrides | — | `users.manage` | Replace-set in one transaction; last-admin coverage re-checked | `404`, `409`, `422` | `L-BASIS: VERIFIED` (`auth.routes.ts:288`) |
| ADM-08 | W-36 | `DELETE /api/admin/users/:userId/overrides/:permissionKey` | — → `204` | — | `users.manage` | Coverage re-check | `404`, `409` | `L-BASIS: VERIFIED` (`auth.routes.ts:323`) |
| ADM-09 | W-36 | `GET /api/admin/users/:userId/effective-permissions` | — → `[{permission, effective, source, roleValue, override, projectAccess}]` | — | `users.manage` | Read-only | `404` | `L-BASIS: VERIFIED` (semantics live; shape partially) |
| ADM-10 | W-35 | `GET /api/admin/roles` | — → `[{id, name, nameAr, isSystem, permissionCount, userCount}]` | — | `roles.manage` | Read-only | `403` | `L-BASIS: PARTIAL` — `toRoleJson` = U-06 |
| ADM-11 | W-35 | `POST /api/admin/roles` | `{name, nameAr, permissions[]}` → `201` | — | `roles.manage` | Single row; name unique | `409`, `422` | `L-BASIS: VERIFIED` |
| ADM-12 | W-35 | `GET /api/admin/roles/:roleId` | — → role + permissions | — | `roles.manage` | Read-only | `404` | `L-BASIS: PARTIAL` |
| ADM-13 | W-35 | `PATCH /api/admin/roles/:roleId` | `{permissions[]}` → role (name immutable) | — | `roles.manage` | Role-level last-admin coverage check; `409 LAST_ADMIN_PROTECTED` | `404`, `409`, `422` | `L-BASIS: VERIFIED` (`roles.routes.ts:114-115`) |
| ADM-14 | W-35 | `DELETE /api/admin/roles/:roleId` | — → `204` | — | `roles.manage` | `403` system role; `409` in use | `403`, `404`, `409` | `L-BASIS: VERIFIED` (`roles.routes.ts:134,138`) |
| ADM-15 | W-35 | `POST /api/admin/roles/:roleId/clone` | `{name}` → `201` | — | `roles.manage` | Single row | `409`, `422` | `L-BASIS: PARTIAL` |
| ADM-16 | W-35 | `GET /api/admin/roles/:roleId/users` | — → `[{userId, username}]` | cursor | `roles.manage` | Read-only | `404` | `L-BASIS: PARTIAL` |
| ADM-17 | W-35 | `GET /api/admin/permissions` | — → `[{key, labelAr, group, description}]` | — | `roles.manage` | Read-only; static catalogue | `403` | `L-BASIS: NONE` (Q-10) |
| PLT-01 | W-37 | `GET /api/audit-logs` | — → `{data, page, meta:{total?}}` | `actor, action, entityType, entityId, from, to`; stable order `(created_at DESC, id)`; cursor | `audit.view` | Read-only | `403` | `L-BASIS: VERIFIED` (`audit.service.ts:54-99`), target adds actor/date filters and a stable tiebreak |
| PLT-02 | W-33 | `GET /api/reports` | — → `[{reportId, nameAr, group, formats[], filters[]}]` | — | `reports.view` | Read-only; **catalogue content not defined** | — | `PARTIALLY SPECIFIED`, `L-BASIS: NONE` |
| PLT-03 | W-33 | `GET /api/reports/:reportId/preview` | — → `{columns[], rows[], rowCount}` | report-specific filters | `reports.view` + underlying domain permission | Read-only; row cap | `404`, `422` | `PARTIALLY SPECIFIED`, `L-BASIS: NONE` |
| PLT-04 | W-33 | `POST /api/reports/:reportId/export` | `{format, filter}` → stream or job | — | `reports.view` + underlying permission | Read-only | `404`, `413`, `422` | `PARTIALLY SPECIFIED`, `L-BASIS: NONE` |
| PLT-05 | W-41 | `GET /api/import/jobs` | — → `{data, page}` | `entity, status`; cursor | `settings.manage` (owner decision) | Read-only | — | **`DEPENDENCY_UNRESOLVED — NOT IMPLEMENTED — OUT OF CURRENT EXECUTION SCOPE`** — the only live read is `GET /api/import/history` (§5.3 #101): a bare array, no `status`, no job identity. The proposed shape is retained as traceable history only |
| PLT-06 | W-41 | `POST /api/import/jobs` | multipart + `{entity}` → `201 Job` | — | per-entity permission (varies) | Transaction: job row; `Idempotency-Key` **`DEFERRED`** — proposed only, not authorized (§5.3.1-F) | `409`, `415`, `422` | **`DEPENDENCY_UNRESOLVED — NOT IMPLEMENTED — OUT OF CURRENT EXECUTION SCOPE`** — no job row, no job table, no `Idempotency-Key` handling exists. Live equivalents are `POST /api/import/smart/confirm` and `POST /api/import/:entity/confirm` (per-entity permissions `SOURCE_VERIFIED`, `L-BASIS: VERIFIED`) |
| PLT-07 | W-41 | `GET /api/import/jobs/:jobId` | — → `{status, total, imported, failed, failures[]}` | — | job owner or `settings.manage` | Read-only | `404` | **`DEPENDENCY_UNRESOLVED — NOT IMPLEMENTED — OUT OF CURRENT EXECUTION SCOPE`** — `import_history` stores only first-50 `errors text[]`, not a structured `failures[]`, and has no per-job identity; the proposed shape is retained as traceable history only |
| PLT-08 | W-38 | `GET /api/notifications` | — → `{data, page, meta:{unread}}` | `unreadOnly`; cursor | Own notifications only; **recipient model unresolved** (§9.6) | Read-only | `401` | `L-BASIS: PARTIAL` — legacy has a shared `read_by` array and no recipient column |
| PLT-09 | W-38 | `POST /api/notifications/:notificationId/read` | — → `204` | — | Own read-state row only | Idempotent upsert on `(notification, user)` | `404` | `L-BASIS: VERIFIED` (semantics; storage changes) |
| PLT-10 | W-38 | `POST /api/notifications/read-all` | — → `204` | — | Own notifications | Bulk upsert | `401` | `L-BASIS: VERIFIED` |
| PLT-11 | W-39 | `GET /api/search` | — → typed namespaces of `{id, title, subtitle?, link}` | `q` (min length), optional `types`, per-type cursor | `q` results filtered by each entity's own permission **server-side**; fail-closed | Read-only; bounded per type | `401`, `422` | `L-BASIS: PARTIAL` — legacy returns 5 namespaces (projects, documents, warehouses, items, transactions) with no totals/paging; §8.7 lists 4 — **which namespaces the target exposes is an open decision (U-14)** |
| PLT-12 | W-40 | `GET /api/lookups/categories` | — → `[{id, name}]` | — | `settings.manage` read? (owner decision) | Read-only | — | `L-BASIS: PARTIAL` |
| PLT-13 | W-40 | `GET /api/lookups/units` | — → `[{id, name, symbol}]` | — | as above | Read-only | — | `L-BASIS: PARTIAL` |
| PLT-14 | W-40 | `GET /api/lookups/warehouses` | — → picker list | — | `warehouse.view` + project membership | Read-only | — | `L-BASIS: VERIFIED` |
| PLT-15 | W-40 | `GET /api/lookups/items` | — → picker list | `q, warehouseId` | `warehouse.view` | Read-only | — | `L-BASIS: VERIFIED` |

**Operations deliberately absent from this table:** `POST /api/backups` and `POST /api/backups/:name/restore` (G-06). They are destructive, their service semantics are unread (U-03), and they are not part of the frontend contract this document governs. Listing them as "proposed" would imply an endorsement that the evidence does not support.

**Count check:** 8 session + 23 project/site/BOQ/IPC + 19 archive + 20 inventory/procurement + 17 administration + 15 platform = **102 proposed operations**. This is a proposal surface, not a delivery plan; nothing here is scheduled.

### 8.9 Scope rule — what a client-supplied project ID does and does not prove

This rule is repeated here because it is the single most likely place for the target contract to regress.

1. **A client-supplied `projectId` never proves authorization.** It is a *claim*, not a grant. Sending `projectId = X` cannot create access to X.
2. **A parent path identifier identifies context only.** `/api/projects/:projectId/sites/:siteId` asserts "the caller is addressing a site *in the context of* project X". The server must still verify (a) that the caller has membership in X, and (b) that `siteId` actually belongs to X — otherwise the path is a confusion vector, not an authorization token.
3. **Authorization is established by server-side membership and row ownership.** `project_memberships` (plus role permissions) decide whether the caller may act; the persisted row decides which project the resource belongs to.
4. **For row-backed resources, scope is resolved from the stored record**, not from the request body. A body field that disagrees with the stored row is rejected (`409`/`422`), not silently trusted.
5. **Filters can only narrow.** A `projectId` query parameter intersects the caller's visible set; it can never widen it. An explicit filter on a project the caller cannot see returns a loud `403 FORBIDDEN_SCOPE` (preserving the verified `checkFilterProject` behaviour), while the implicit visible set is returned silently.
6. **Global (`null`-project) rows** are governed by their own rule per entity; "no project" is not "everyone's project".
7. **One known legacy exception must not be copied:** `GET /api/projects/financials` is a portfolio-wide read with **no** membership predicate (G-08). The target either applies `filterVisible` or replaces the route with the project-scoped PRJ-09.

---

## 9. Conceptual Target Schema (design only, no DDL)

Notation: `→` logical reference, `⟨E⟩` enum, `◇` derived/read model. Every constraint is tagged: **`[REQ]`** = required to preserve verified legacy behaviour; **`[PROP]`** = proposed and subject to D8 plus owner approval. **No column is asserted to exist in the legacy database unless it is readable from source**; anything the legacy code does not evidence is marked `[PROP]`. All tables carry `id` (opaque), `created_at`, `updated_at`, and — where concurrency matters — `version`. Soft deletion is a per-entity decision, not a global pattern.

### 9.1 Identity and access

| Entity | Key attributes | Integrity rules |
|---|---|---|
| `users` | `username`, `full_name`, `email`, `password_hash`, `role_id →roles`, `is_active`, `dept`, `title` | `[REQ]` last-admin protection (S-12a/b); `[PROP]` unique `lower(username)`, unique `lower(email)` |
| `roles` | `name`, `name_ar`, `is_system` | `[REQ]` system roles not deletable, role name immutable (S-13); `[PROP]` unique `name` |
| `role_permissions` | `role_id →roles`, `permission_key` | `[REQ]` unknown keys rejected; vocabulary is the 31 manageable keys of §5.6; `[PROP]` PK `(role_id, permission_key)` |
| `user_permission_overrides` | `user_id →users`, `permission_key`, `effect` ⟨grant/deny⟩ | `[REQ]` deny wins over a role grant; `[PROP]` unique `(user_id, permission_key)` |
| `sessions` | `user_id`, `refresh_token_hash`, `ip`, `user_agent`, `last_seen_at`, `revoked_at` | `[REQ]` rotation + reuse detection (S-02, W-02); `[PROP]` unique `refresh_token_hash`; revoked rows retained |
| `project_memberships` | `user_id`, `project_id`, `access` ⟨NONE/READ/WRITE/DELETE⟩ | `[REQ]` **this table is the scope authority** (S-03/S-04); `[PROP]` unique `(user_id, project_id)` |

### 9.2 Projects and sites

| Entity | Key attributes | Integrity rules |
|---|---|---|
| `projects` | `project_code`, `project_name`, `client`, `owner`, `main_contractor`, `site_location`, `region`, `contract_number`, `contract_value`, `start_date`, `end_date`, `status` ⟨planned/active/on-hold/completed/cancelled⟩, `role` ⟨main-contractor/subcontractor/direct-contractor⟩, `notes` | `[REQ]` creator is auto-granted `DELETE` membership; `contract_value ≥ 0`. `[PROP]` unique `project_code`; `CHECK (end_date >= start_date)` |
| `sites` | `project_id →projects`, `code`, `name`, `location`, `notes` | `[REQ]` unique `(project_id, code)`; `[PROP]` FK cascade with project; `409` on delete while documents reference the site |

### 9.3 Archive

| Entity | Key attributes | Integrity rules |
|---|---|---|
| `folders` | `parent_id →folders`, `name`, `path` | `[REQ]` tree shape; delete blocked when non-empty. **`project_id` does not exist in legacy** — see the scope problem below. `[PROP]` unique `(parent_id, name)`, `[PROP]` `path` maintained transactionally |
| `documents` | `folder_id`, `project_id`, `site_id`, `title`, `document_number`, `category`, `document_type`, `revision`, `document_date`, `notes`, `status` ⟨7-value⟩, `current_file_id` | `[REQ]` status changes only via transitions (target); `[PROP]` `ipc_id` is **redundant** with `document_links(target_type='ipc')` — keep one mechanism, not two |
| `document_files` | `document_id`, `storage_key`, `mime`, `size`, `checksum`, `uploaded_by` | `[PROP]` `checksum` indexed for dedupe; `[PROP]` `size ≥ 0`; blob lifecycle is a separate concern from the row |
| `document_revisions` | `document_id`, `file_id`, `revision_label`, `notes`, `created_by` | `[REQ]` label rule: zero-padded counter, **no +1 drift**; `[PROP]` unique `(document_id, revision_label)` |
| `document_links` | `document_id`, `target_type` ⟨project/site/ipc/warehouse/item⟩, `target_id` | Typed targets replace free-form `entityType`. **Polymorphic FK problem — see 9.3.1** |
| `document_tags` | `document_id`, `tag` | `[PROP]` unique `(document_id, tag)`; normalized tag text |

#### 9.3.1 Three unresolved archive-integrity problems

**(a) `document_links` cannot have a real foreign key.** A single `(target_type, target_id)` pair cannot reference five different tables. Three strategies, none free:

| Strategy | Integrity | Cost | Verdict |
|---|---|---|---|
| One nullable FK column per target type + `CHECK (num_nonnulls(...) = 1)` | **Real FKs**, orphan-impossible, indexable, `ON DELETE CASCADE` available per type | Adding a sixth target type is a schema migration | **Recommended** while the target set is small and stable (5 types) |
| `target_type` + `target_id`, no FK, application check + reconciliation job | Weak — orphans possible between check and delete | Cheapest to add targets | Acceptable only as a documented compromise; the reconciliation job becomes mandatory |
| One join table per target type | Strongest, cleanest deletion semantics | Five tables, five queries to render "links" | Justified only if link metadata diverges per type |

The strategy is **undecided and belongs to D8** (U-15). What must not happen is shipping `target_type/target_id` while claiming referential integrity. `[PROP]` regardless of choice: `unique (document_id, target_type, target_id)` to prevent duplicate links.

**(b) Folders have no ownership or project scope, but the target gates them with `archive.view`.** Legacy `folders` has `parent_id`, `name`, `path` only. That means a "visible folder tree" has nothing to scope against. Options: (i) folders are global reference structure and `archive.view` is sufficient; (ii) `folders.project_id` is added and folders inherit project scope; (iii) folders become per-user. **Undecided — U-15.** Until decided, §8.8.3 ARC-14 is correctly labelled `PARTIALLY SPECIFIED`: it is not possible to write a correct scope predicate for a table with no scope column.

**(c) Document deletion has no defined lifecycle.** `[PROP]` `deleted_at` for documents, with list exclusion and a retention job that removes blobs after a stated window. Whether documents are hard- or soft-deleted is an owner decision because it interacts with audit and legal retention.

### 9.4 Commercial

| Entity | Key attributes | Integrity rules |
|---|---|---|
| `boq_items` | `project_id`, `item_code`, `description`, `unit`, `quantity`, `unit_price` | `[REQ]` `quantity ≥ 0`, `unit_price ≥ 0`; delete blocked while referenced by IPC lines. `[PROP]` unique `(project_id, item_code)` |
| `ipcs` | `project_id`, `ipc_number`, `date`, `status` ⟨draft/submitted/approved/rejected⟩, `notes`, `deductions`, `gross_amount` | `[REQ]` unique `(project_id, ipc_number)`; transition matrix enforced. `[PROP]` `gross_amount ≥ 0`, `deductions ≥ 0`; index `(project_id, status)` because the executed-total query filters on exactly that pair |
| `ipc_lines` | `ipc_id`, `boq_item_id`, `current_quantity` | `[REQ]` `current_quantity ≥ 0`. `[PROP]` unique `(ipc_id, boq_item_id)`; FK to `boq_items` with `ON DELETE RESTRICT` (this FK is what makes S-10 enforceable) |

### 9.5 Inventory and procurement

| Entity | Key attributes | Integrity rules |
|---|---|---|
| `warehouses` | `code`, `name`, `type` ⟨central/site⟩, `project_id`, `location`, `status` ⟨active/inactive⟩ | `[REQ]` site warehouses bind to a project. `[PROP]` unique `code`; `CHECK (type <> 'site' OR project_id IS NOT NULL)` |
| `items` | `code`, `name`, `category`, `unit`, `brand`, `minimum_stock`, `tracking_type` ⟨none/batch/serial⟩ | `[REQ]` `minimum_stock ≥ 0`. `[PROP]` unique `code`. **`tracking_type` currently promises batch/serial with no lot entity — see 9.5.1** |
| `stock_movements` | `type` ⟨IN/OUT/TRANSFER/ADJUSTMENT/RETURN⟩, `warehouse_id`, `destination_warehouse_id`, `project_id`, `reference_number`, `date`, `notes`, `created_by`, `reverses_movement_id?` | `[REQ]` **append-only**; correction via reversal. `[PROP]` `CHECK (type <> 'TRANSFER' OR destination_warehouse_id IS NOT NULL)`; unique `reverses_movement_id` (at most one reversal per movement) |
| `stock_movement_lines` | `movement_id`, `item_id`, `quantity`, `unit_cost` | `[REQ]` `quantity > 0`, `unit_cost ≥ 0`; the movement *type* carries the sign — a line is never negative |
| `material_requests` | `project_id`, `site_id`, `warehouse_id`, `status` ⟨draft/submitted/approved/rejected/partially-issued/issued/closed⟩, `notes` | `[REQ]` issue only from approved; over-issue rejected. `[PROP]` index `(status, project_id)` |
| `material_request_lines` | `request_id`, `item_id`, `requested_qty`, `issued_qty`, `notes` | `[REQ]` `issued_qty ≤ requested_qty`; `[PROP]` `CHECK` both `≥ 0`; unique `(request_id, item_id)` |
| ◇ `stock_balances` | `(warehouse_id, item_id) → quantity` | **Derived. See 9.5.2** |

#### 9.5.1 `tracking_type` is currently an unbacked promise

`items.tracking_type` allows `batch` and `serial`, but there is **no** lot/serial table anywhere in the model, no `lot_id` on `stock_movement_lines`, and no expiry or serial-number capture. A field that claims tracking while no lot identity exists is worse than no field: the UI will offer batch selection and the backend will silently discard it.

Two honest resolutions, owner's choice (U-16):

1. **Implement it:** `stock_lots(id, item_id, lot_code, expiry_date?, serial_number?)` + `stock_movement_lines.lot_id` (nullable for `tracking_type='none'`), with `CHECK` that a lot is required when the item's tracking type is not `none`. This is real scope and real migration work.
2. **Record the limitation:** keep `tracking_type` as **informational metadata only**, document that batch/serial traceability is **not implemented**, and remove any UI affordance that implies otherwise.

Until one is chosen, the schema must not be read as providing batch/serial traceability.

#### 9.5.2 Derived read models must state their contract

`stock_balances` and `project_financial_summary` are not tables with an independent truth. Each needs four answers, and the document must not leave them implicit:

| Question | `stock_balances` | `project_financial_summary` |
|---|---|---|
| **Type** | Transactionally-maintained projection table `[PROP]` (alternative: materialized view) | Materialized view or periodically refreshed table `[PROP]` — the KPI tolerates seconds of staleness; stock does not |
| **Source of truth** | `stock_movement_lines` joined to `stock_movements` (including reversal rows) | `boq_items` (sum of `quantity × unit_price`) + `ipcs` where `status = 'approved'` |
| **Recalculation** | Updated **inside the same transaction** as the movement — this is why it is a projection table, not a matview | Recalculated on BOQ write, IPC approval/rejection/reopen, and project financial-field update; batch refresh as a safety net |
| **Consistency + rebuild** | Read-your-writes; rebuildable from the ledger at any time; a rebuild must produce byte-identical totals | Eventually consistent; response carries `generatedAt`; rebuildable by full recompute; drift check is a validation task (D8) |

A negative `stock_balances.quantity` is a **bug signal**, not a business state: it means the transaction that wrote the movement did not check availability. The target keeps the availability check inside the movement transaction and treats a negative balance as an integrity alarm.

**Legacy note:** the current overview computes aggregates in application code from fetched rows. That is not a read model, it is a full scan; the projection exists to replace it, not to duplicate it.

### 9.6 Cross-cutting

| Entity | Key attributes | Integrity rules |
|---|---|---|
| `audit_events` (D6) | `actor_id`, `actor_username` (snapshot), `action`, `entity_type`, `entity_id`, `metadata` (jsonb), `created_at`, `request_id` | `[REQ]` append-only, no update/delete path. `[PROP]` `actor_id` nullable + username snapshot because actors are deactivated and audit rows outlive them; index `(created_at DESC, id)` for stable keyset paging; partition by month when volume justifies |
| `notifications` (D6) | `type`, `title`, `body`, `entity_type`, `entity_id`, `created_at` | **No recipient column in legacy — see 9.6.1** |
| `notification_recipients` | `notification_id`, `user_id`, `read_at` (nullable) | `[PROP]` unique `(notification_id, user_id)`; **`read_at IS NULL` = unread**. This single relation replaces both legacy `read_by text[]` and the separately proposed `notification_reads` |
| `import_jobs` | `entity`, `file_name`, `status`, `total_rows`, `imported`, `failed`, `failures` (jsonb), `idempotency_key` | **`PROPOSED_NOT_IMPLEMENTED`** — no such table exists (§5.3.1-B). `[PROP]` unique `idempotency_key`; `failures` capped and truncated with a count; job rows are retained, not deleted |
| `import_history` **(live)** | `entity`, `file_name`, `user_id`, `username`, `total_rows`, `successful_rows`, `failed_rows`, `errors text[]`, `created_at` | **`SOURCE_VERIFIED`** — `001_initial_schema.sql:318-329`. Summary record: the inspected application path inserts rows, no application-level update/delete path was identified, and database-enforced immutability is **not established**. **No `status`, no `idempotency_key`, no structured `failures`**, so it cannot implement a job lifecycle. Contract detailed in §5.3.1-B |
| `import_runs` / `import_run_rows` | ledger rows (deferred proposal) | **`DEFERRED`** — not cancelled. Owed to the D-SPEC-01 Option (b) ledger proposal, outside Phase 12. Zero occurrences in `apps/` and migrations |
| `lookup_categories` | `name` | `[PROP]` unique `name` (`[REQ]` read-only today) |
| `lookup_units` | `name`, `symbol` | `[PROP]` unique `name`, unique `symbol` |
| ◇ `project_financial_summary` | `project_id → contract_value, boq_total, executed_total, executed_deductions` | Read model; `executed_*` counts approved IPCs only. Contract per 9.5.2 |

#### 9.6.1 The notification recipient relation is missing, and `read_by` is not a substitute

Legacy `notifications.read_by` is a **text array of usernames** on the notification row. It is not a recipient model, and it has four concrete defects that the target must not reproduce:

1. **No recipient targeting.** Every notification is visible to every user; there is no way to notify one person.
2. **No referential integrity.** Usernames are free text inside an array; renaming a user orphans their read state, and a deleted user leaves permanent debris.
3. **Unbounded growth.** The array grows with the number of readers; every read rewrites the whole row.
4. **Ambiguous unread semantics.** "Unread" means `NOT (username = ANY(read_by))`, which conflates "was never targeted at me" with "targeted at me and unread".

Target recommendation: **one relation, `notification_recipients(notification_id, user_id, read_at NULL)`**. A row with `read_at IS NULL` is unread; absence of a row means the notification was never targeted at that user. This makes the unread count an indexed `COUNT(*) WHERE user_id=? AND read_at IS NULL`, which also fixes the legacy `LIMIT 100` list and the handler's 30-item slice. It is **one table, not two** — the separately listed `notification_reads` is deliberately dropped to avoid encoding broadcast-vs-targeted twice.

Whether notifications are broadcast (materialize recipients on creation) or targeted (explicit recipient list per event) is an owner decision (U-17), because it determines write amplification at creation time. `[PROP]` either way: `notification_recipients` is the storage shape; the targeting policy is the decision.

#### 9.6.2 `import_history` is a summary record; `import_jobs` is an unimplemented proposal

The live import surface persists **only** `import_history` (`001_initial_schema.sql:318-329`): one row per confirm call carrying entity, file name, actor, three counts, and `errors text[]` holding the first 50 failure strings. The inspected import application path inserts these summary records; **no application-level update/delete path was identified in the inspected import flow, and database-enforced immutability has not been established.** It has **no `status`, no `idempotency_key`, no per-row record, and no structured `failures`**. Full column contract in §5.3.1-B.

The `import_jobs` entity modelled above therefore has **no live counterpart** (`PROPOSED_NOT_IMPLEMENTED`; zero occurrences in `apps/` source and migrations). It must not be described as a renamed `import_history`, and `import_history` must not be presented as satisfying a job/lifecycle contract — it cannot report progress, cannot answer "which rows failed", and cannot dedupe a retry.

`import_runs` / `import_run_rows` remain **`DEFERRED`** under the D-SPEC-01 Option (b) ledger proposal. Deferred is not cancelled; ODR traceability on that point is preserved (§14.4.1).

### 9.7 Constraint matrix (consolidated)

`PK` is always `id` unless stated. `RESTRICT` is the default for references that carry business meaning; `CASCADE` is used only for owned children.

| Entity | Foreign keys | Unique | Checks | Nullability | Deletion |
|---|---|---|---|---|---|
| `users` | `role_id →roles` (RESTRICT) | `lower(username)`, `lower(email)` | role must exist | `dept`,`title` nullable | Deactivate, never hard-delete (audit integrity) |
| `roles` | — | `name` | `is_system` immutable | — | `403` system; `409` in use |
| `role_permissions` | `role_id →roles` (CASCADE) | `(role_id, permission_key)` | key ∈ 31-key vocabulary | — | Cascade with role |
| `user_permission_overrides` | `user_id →users` (CASCADE) | `(user_id, permission_key)` | `effect ∈ {grant,deny}` | — | Cascade with user |
| `sessions` | `user_id →users` (CASCADE) | `refresh_token_hash` | `revoked_at ≥ created_at` | `ip`,`user_agent` nullable | Retain revoked rows; purge by age |
| `project_memberships` | `user_id →users`, `project_id →projects` (both CASCADE) | `(user_id, project_id)` | `access ∈ {NONE,READ,WRITE,DELETE}` | — | Cascade with either parent |
| `projects` | — | `project_code` | `contract_value ≥ 0`, `end_date ≥ start_date` | dates nullable | Guarded; cascade BOQ+IPC in one transaction |
| `sites` | `project_id →projects` (CASCADE) | `(project_id, code)` | — | `location`,`notes` nullable | `409` when documents reference it |
| `folders` | `parent_id →folders` (RESTRICT) | `(parent_id, name)` `[PROP]` | no cycles | `parent_id` nullable = root | Blocked when non-empty |
| `documents` | `folder_id →folders`, `project_id →projects`, `site_id →sites` | `document_number` `[PROP]` (uniqueness scope still an owner decision) | status ∈ 7 values | all relations nullable (global docs exist) | `[PROP]` soft delete; owner decision |
| `document_files` | `document_id →documents` (CASCADE) | — | `size ≥ 0`, `checksum` present | `uploaded_by` nullable (system jobs) | Cascade row; blob removed by retention job |
| `document_revisions` | `document_id →documents`, `file_id →document_files` | `(document_id, revision_label)` | label monotonic per document | `notes` nullable | Cascade with document |
| `document_links` | **strategy undecided (9.3.1)** | `(document_id, target_type, target_id)` | exactly one target | — | Cascade with document; target deletion removes the link |
| `document_tags` | `document_id →documents` (CASCADE) | `(document_id, tag)` | tag normalized, length bounded | — | Cascade with document |
| `boq_items` | `project_id →projects` (CASCADE) | `(project_id, item_code)` | `quantity ≥ 0`, `unit_price ≥ 0` | `unit` required | `409` while IPC lines reference |
| `ipcs` | `project_id →projects` (CASCADE) | `(project_id, ipc_number)` | `gross_amount ≥ 0`, `deductions ≥ 0`, status ∈ 4 | `notes` nullable | Guarded by status |
| `ipc_lines` | `ipc_id →ipcs` (CASCADE), `boq_item_id →boq_items` (**RESTRICT**) | `(ipc_id, boq_item_id)` | `current_quantity ≥ 0` | — | Cascade with IPC; the RESTRICT is what enforces S-10 |
| `warehouses` | `project_id →projects` | `code` | site ⇒ `project_id NOT NULL` | `project_id` nullable for central | `409` when stock/movements exist |
| `items` | — | `code` | `minimum_stock ≥ 0` | `brand` nullable | `409` while referenced |
| `stock_movements` | `warehouse_id →warehouses`, `destination_warehouse_id →warehouses`, `project_id →projects`, `reverses_movement_id →stock_movements` | `reverses_movement_id` | TRANSFER ⇒ destination present; append-only trigger | `reference_number`,`notes`,`project_id` nullable | **No delete, no update** |
| `stock_movement_lines` | `movement_id →stock_movements` (CASCADE-on-insert-only), `item_id →items` | `(movement_id, item_id)` `[PROP]` | `quantity > 0`, `unit_cost ≥ 0` | `unit_cost` nullable if unvalued | Immutable with movement |
| `material_requests` | `project_id →projects`, `site_id →sites`, `warehouse_id →warehouses` | — | status ∈ 7 | `site_id`,`notes` nullable | `draft` only; `409` once issued |
| `material_request_lines` | `request_id →material_requests` (CASCADE), `item_id →items` | `(request_id, item_id)` | `issued_qty ≤ requested_qty`, both `≥ 0` | `notes` nullable | Cascade with request |
| ◇ `stock_balances` | `warehouse_id`, `item_id` | `(warehouse_id, item_id)` | `quantity ≥ 0` (violation = integrity alarm) | — | Rebuilt, never deleted ad hoc |
| `audit_events` | `actor_id →users` (**nullable, no cascade**) | — | append-only trigger | `actor_id`,`entity_id` nullable | Never deleted (retention policy separate) |
| `notifications` | — | — | `type` ∈ known set | `entity_id` nullable | Retained; purge by age |
| `notification_recipients` | `notification_id →notifications` (CASCADE), `user_id →users` (CASCADE) | `(notification_id, user_id)` | `read_at ≥ created_at` | `read_at` nullable = unread | Cascade with either parent |
| `import_jobs` | `created_by →users` | `idempotency_key` | status ∈ known set; counts `≥ 0` | `failures` nullable when none | Retained; purge by age. **`PROPOSED_NOT_IMPLEMENTED`** |
| `import_history` **(live)** | none (plain columns; no FK in DDL) | none declared | counts default `0`; `entity`/`file_name` NOT NULL | `user_id`,`username` nullable | Insert-only in the inspected application path; no application-level update/delete path identified; database-enforced immutability **not established**. **`SOURCE_VERIFIED`** |
| `import_runs` / `import_run_rows` | deferred ledger | — | — | — | **`DEFERRED`** — D-SPEC-01 Option (b), not cancelled |
| `lookup_categories` / `lookup_units` | — | `name`; `name`,`symbol` | non-empty | — | `409` when referenced |

### 9.8 Entity → workflow map

| Domain | Entities | Workflows served |
|---|---|---|
| Identity and access | `users`, `roles`, `role_permissions`, `user_permission_overrides`, `sessions`, `project_memberships` | W-01, W-02, W-03, W-04, W-05, W-12, W-34, W-35, W-36 |
| Projects | `projects`, `sites` | W-06, W-07, W-08, W-09, W-10, W-11, W-13, W-26 |
| Archive | `folders`, `documents`, `document_files`, `document_revisions`, `document_links`, `document_tags` | W-14, W-15, W-16, W-17, W-18, W-19, W-20, W-21, W-22, W-23 |
| Commercial | `boq_items`, `ipcs`, `ipc_lines` | W-24, W-25, W-26 |
| Inventory and procurement | `warehouses`, `items`, `stock_movements`, `stock_movement_lines`, `stock_balances`◇, `material_requests`, `material_request_lines` | W-27, W-28, W-29, W-30, W-31, W-32 |
| Cross-cutting | `audit_events`, `notifications`, `notification_recipients`, `import_history` (live), `import_jobs` (`PROPOSED_NOT_IMPLEMENTED`), `lookup_*`, `project_financial_summary`◇ | W-33, W-37, W-38, W-39, W-40, W-41 |

### 9.9 Entity → target API map

| Entity | Read by | Written by |
|---|---|---|
| `users` | ADM-01, ADM-09, SES-04 | ADM-02, ADM-03, ADM-04, ADM-05, SES-08 |
| `roles` / `role_permissions` | ADM-10, ADM-12, ADM-16, ADM-17 | ADM-11, ADM-13, ADM-14, ADM-15 |
| `user_permission_overrides` | ADM-06, ADM-09 | ADM-07, ADM-08 |
| `sessions` | SES-05 | SES-01, SES-02, SES-03, SES-06, SES-07, ADM-05 |
| `project_memberships` | SES-04, PRJ-07 | PRJ-08 |
| `projects` | PRJ-01, PRJ-03, PRJ-06, PRJ-09 | PRJ-02, PRJ-04, PRJ-05 |
| `sites` | PRJ-06, PRJ-10 | PRJ-11, PRJ-12, PRJ-13 |
| `folders` | ARC-14 | ARC-15, ARC-16, ARC-17 |
| `documents` | ARC-01, ARC-03, ARC-06, ARC-18, ARC-19 | ARC-02, ARC-04, ARC-05, ARC-08, ARC-12, ARC-13 |
| `document_files` | ARC-09 | ARC-02, ARC-07, ARC-08 |
| `document_revisions` | ARC-06 | ARC-07, ARC-08 |
| `document_links` | ARC-03 | ARC-10, ARC-11 |
| `document_tags` | ARC-01 (`tag` filter) | ARC-02, ARC-04 |
| `boq_items` | PRJ-14, PRJ-09, PRJ-06 | PRJ-15, PRJ-16, PRJ-17 |
| `ipcs` / `ipc_lines` | PRJ-18, PRJ-20, PRJ-09, PRJ-06 | PRJ-19, PRJ-21, PRJ-22, PRJ-23 |
| `warehouses` | INV-02, INV-10, PLT-14 | INV-03, INV-04, INV-05 |
| `items` | INV-06, INV-10, PLT-15 | INV-07, INV-08, INV-09 |
| `stock_movements` / `stock_movement_lines` | INV-11, INV-01, INV-10 | INV-12, INV-13, INV-19 |
| ◇ `stock_balances` | INV-10, INV-01 | *(never written directly)* |
| `material_requests` / `material_request_lines` | INV-14, INV-16 | INV-15, INV-17, INV-18, INV-19, INV-20 |
| `audit_events` | PLT-01, PRJ-06 | *(append-only, written by every mutating op)* |
| `notifications` / `notification_recipients` | PLT-08 | PLT-09, PLT-10, *(created by domain events)* |
| `import_jobs` | PLT-05, PLT-07 — **`DEPENDENCY_UNRESOLVED — NOT IMPLEMENTED — OUT OF CURRENT EXECUTION SCOPE`** | PLT-06 — same status |
| `import_history` **(live)** | §5.3 #101 (the only live import read path) | Both live confirm routes (#104, #107) insert a summary row |
| `lookup_categories` / `lookup_units` | PLT-12, PLT-13 | *(no write path proposed — W-40 is read-only today)* |
| ◇ `project_financial_summary` | INV-01-adjacent, PRJ-06, PRJ-09, W-06 | *(derived)* |

### 9.10 Workflow history is not the same thing as the audit stream

The target has three distinct temporal records and must not conflate them:

| Record | Purpose | Mutability | Owner |
|---|---|---|---|
| **Status transitions** (`ipcs`, `documents`, `material_requests`) | The business state machine. A row's current `status` is the fact; the transition trail is the evidence | Current status mutable; trail append-only | Domain table + a per-domain `*_status_history` table `[PROP]` |
| **Audit events** | Cross-domain "who did what" for compliance, filtered by actor/entity | Append-only, never business-critical to reads | D6 `audit_events` |
| **Domain facts** (stock movements, revisions) | The ledger itself; the movement *is* the history | Append-only | Inventory / archive tables |

Concretely: `ipcs` currently keeps only `status`, so "who approved this and why" lives in the audit log. That is acceptable for compliance but poor for UI ("show the approval chain"). Either (a) add `ipc_status_history(ipc_id, from_status, to_status, action, reason, actor_id, at)` and keep the audit event as the compliance copy, or (b) accept that the UI reads the audit stream filtered by `entity_type='ipc', entity_id`. Option (a) is recommended because audit retention and business history have different lifetimes. Same question for `documents` and `material_requests` — one decision applied three times (U-18), not three separate designs.

The reverse mistake is also forbidden: the audit log is **not** a substitute for the stock ledger or the revision table, and it must never be used to reconstruct a balance.

### 9.11 What this section still does not decide

| # | Open schema decision | Blocks |
|---|---|---|
| U-15 | `document_links` FK strategy; folder scope model | ARC-10, ARC-11, ARC-14 |
| U-16 | Batch/serial lots: implement `stock_lots` or record the limitation | INV-06, INV-12, item UI |
| U-17 | Notification targeting policy (broadcast vs explicit recipients) | PLT-08 |
| U-18 | Per-domain status history table vs audit-stream reads | PRJ-23, ARC-12, INV-18 |

No DDL is written or authorized. These are conceptual decisions that must be settled before D8 planning can produce a migration.

**Schema rationale tied to the UI:** every `NEW TARGET CONTRACT REQUIRED` workflow (W-06, W-11, W-33) needs either a composite read model (`project_financial_summary`, `stock_balances`) or a catalogue table (`lookup_*`, reports). W-39 does **not** — its capability exists and was verified; only its envelope changes. Read models cannot be produced by adapting legacy endpoints alone — which is why "reuse the legacy schema" was never a viable position under D2.

---

## 10. Reuse Assessment

### 10.1 Method

A capability is reusable **as an HTTP contract** only if path, method, request shape, and response shape were all verified. If any element is unverified, the ceiling is `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION`. If the endpoint is a stub, dead, or unsafe, it is `REPLACE LEGACY CAPABILITY`.

### 10.2 Domain assessment

| Domain | Business capability | Implementation | HTTP contract | Verdict |
|---|---|---|---|---|
| Auth login/refresh | Sound (cookie + rotating refresh) | Sound | Prototype has no counterpart; UI needs device management | `NEW TARGET CONTRACT REQUIRED` |
| Auth sessions list | **None** (stub) | None | None | `REPLACE LEGACY CAPABILITY` |
| Users admin | Sound | Sound | Field model differs from prototype | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| Roles/permissions | Sound, with last-admin + immutable-name guards | Sound | Matrix rendering lacks a catalogue endpoint | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| Overrides / effective rights | Sound and unusually well modelled | Sound | Verified | `REUSE BUSINESS CAPABILITY` |
| Projects CRUD | Sound | Sound | List needs cursor + facets; delete needs impact preview | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| Project members | Sound | Sound | Write path is user-centric, should be project-centric | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| Project workspace | No aggregate | None | None | `NEW TARGET CONTRACT REQUIRED` |
| Sites | Sound | Sound | List **is** `projectId`-scoped and 403-loud (`sites.routes.ts:22-31`); only the path shape should be nested | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| Documents list | Sound and **richer than the prototype** | In-process filtering | **10** filters verified, but cursor paging + facets change the envelope | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| Document write flows | Sound | Sound | Upload/replace need progress + checksum | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| Document status | Enum write only | No transition matrix | PATCH-a-field shape is wrong for a state machine | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| Document links | Sound | Free-form target | Untyped `entityType`/`entityId` | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| Document content | Sound | Three overlapping routes | Consolidate | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| Folders | **Unsafe list** | Sound otherwise | `GET` has no permission check | `REPLACE LEGACY CAPABILITY` (list only) |
| BOQ | Sound, with reference guard | Sound | Single-row writes vs grid UI | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| IPC | Sound, transition matrix verified | Sound | Totals not returned with list | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| Financial indicators | Sound and complete | Sound | Verified 15-field shape | `REUSE BUSINESS CAPABILITY` |
| Inventory overview | Sound | Sound | Verified | `REUSE BUSINESS CAPABILITY` |
| Warehouses / items | Sound | Sound | Verified DTOs | `REUSE BUSINESS CAPABILITY` |
| Stock movements | Sound, immutable ledger | Sound | Delete is a dead 400; no reversal route | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| Stock history | Duplicated route | Same handler twice | Collapse | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| Material requests | Sound, incl. stock side effect | Sound | Missing reject/close + edit | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| Reports | **No catalogue** | Per-domain XLSX only | None | `NEW TARGET CONTRACT REQUIRED` |
| Audit log | Sound intent and **verified shape** | `audit.service.ts:54-99` | `{items,total,page,pageSize}` + `entity/action/q`; lacks actor/date filters and stable tiebreak | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| Notifications | Sound but capped at 30 | Sound | No paging; read state not in payload | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| Global search | Sound intent, **verified shape** | `global-search.service.ts:11-24,31-81` | 5 typed namespaces of `{id,title,subtitle?,link}`, `limit 5`, fail-closed row authz; no totals/paging | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| Lookups | Read-only | Sound | No admin write path | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |
| Excel import | Sound, per-entity permissions | Sound | No persistent job identity (`DEFERRED`); confirm idempotency `OPEN — NOT IMPLEMENTED` (§5.3.1-F) | `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION` |

### 10.3 What this assessment forbids

- No capability is classified `REUSE LEGACY HTTP CONTRACT` without a fully verified request **and** response shape. **Zero** capabilities now qualify, and that is the corrected finding, not a regression: W-14 was the last candidate and its envelope must change for cursor paging and facets (§4.4, §7).
- No capability is described as reusable "as-is" in general terms.
- No `UNKNOWN — NEEDS EVIDENCE` row is resolved by assumption — and equally, no capability is downgraded to `UNKNOWN` merely because a response shape had not yet been read. W-37 and W-39 were classified from source, which is why the workflow-level `UNKNOWN` count is now **0**.
- No gap is invented from an unread parameter. `GET /api/sites` honours `projectId`; `GET /api/projects/financials` does not. The two are now recorded differently.

---

## 11. Security Invariants

These are constraints on the target design. They are derived from verified legacy behaviour and must be preserved or strengthened — never weakened.

### 11.1 Enforcement location

| # | Invariant | Evidence |
|---|---|---|
| S-01 | Authorization is enforced **server-side** on every request. UI hiding is never a boundary. | `middleware/auth.ts` chain; every handler |
| S-02 | The access token carries **minimal identity claims only** (`sub`, `sid`); permissions are resolved per request. | `auth.routes.ts:88` comment + `signToken({sub, sid})` |
| S-03 | Project scope for row-backed resources is resolved **from the database row**, never from client input (IDOR-safe). | `projectScope.ts:6-12` |
| S-04 | A forged `projectId` in a create body or filter can only **deny**, never grant. | `projectScope.ts:8-10` |
| S-05 | Missing or invisible rows resolve to `{missing:true}` → **404**, not 403, to avoid existence disclosure. | `projectScope.ts:11`; `hideExistence` guards |

### 11.2 Project-scope resolution rules (must be preserved verbatim)

- Row-backed resources (document, site, warehouse, material request, project) resolve their project from the persisted row.
- Client-supplied project IDs are returned as-is; the authorization layer then denies insufficient membership.
- `null` project means global/unscoped, so the constraint does not apply.
- Collection endpoints differ **by intent**, and the three behaviours must not be collapsed:
  - **Silent omission.** `documents` and `projects` (and `sites` with no filter) apply `filterVisible`: invisible rows are simply absent from the collection. The caller sees a smaller list, never an error, and never learns that a row exists.
  - **Loud denial on an explicit filter.** `sites` and `documents` with a `projectId` naming a project the caller cannot access return **403** via `checkFilterProject`. Silence would be indistinguishable from "this project has no sites/documents", so the denial is explicit.
  - **Empty collection on denial.** BOQ and IPC **collection** routes return `[]` rather than 403 (`boq.routes.ts:25-34`). The server distinguishes denial from emptiness internally; the client cannot. This is a legacy shape limitation, not a policy.
  - **Hidden existence on single rows.** Every single-row endpoint returns **404** via `hideExistence`, never 403.

**Target decision:** keep the *semantics*, unify the *envelope* (S-06), and never introduce a collection `403` that leaks which IDs exist. Concretely: an explicit out-of-scope filter in the query is a `403 FORBIDDEN_SCOPE`; an implicit collection read is silently scoped; `data: []` must never be the encoding of a denial.

### 11.3 Identified gaps to close in the target design

| # | Finding | Exact evidence | Confidence | Required target behaviour |
|---|---|---|---|---|
| G-01 | `GET /api/folders` has no permission check beyond `requireAuth`; every other folder route has `archive.*` | `folders.routes.ts:9-14` (route), `:15-27`, `:29-41`, `:43-51` (guarded siblings) | High — read directly | Require `archive.view`; scope the tree to visible projects |
| G-02 | `DELETE /api/documents/links/:linkId` looks the link up by `linkId` alone; any `archive.edit` holder can unlink any document's link | `documents.routes.ts:298-304` | High — read directly | Nest under `/documents/:documentId/links/:linkId` and apply document row scope |
| G-03 | **WITHDRAWN — not a gap.** The earlier claim that `GET /api/sites` ignores `projectId` and returns all sites is **false**. The route applies `filterVisible`, validates an explicit `projectId` through `checkFilterProject` (403), and filters by it | `sites.routes.ts:22-31` | High — the corrected read is unambiguous | No security fix needed. Remaining item is **structural only**: the list is global-shaped, so the target nests it under the project for clarity |
| G-04 | `GET /api/projects/export/xlsx` exports **all** projects regardless of visibility | `projects.routes.ts:68-73` | High — read directly | Apply `filterVisible` before export |
| G-05 | Document status is a free enum write with no allowed-transition matrix | `documents.routes.ts:345-361` (schema validates the enum only) | High — read directly | Enforce allowed transitions server-side (§8.8.3 ARC-12); matrix itself pending Q-05 |
| G-06 | `POST /api/backups/:name/restore` is destructive and accepts a client-supplied backup name | `system.routes.ts:36-45` | High for the route/shape; restore internals unread (U-03) | Require explicit confirmation token, audit, and an allow-listed backup identity |
| G-07 | **Defence-in-depth inconsistency, not an access hole.** `GET /api/projects/:projectId/ipcs/:id` has no route-level permission middleware, but the handler performs `can(ctx,'projects.view', ipc.projectId)` and 404-hides on failure | `ipc.routes.ts:50-57` | High — guard is visible in the handler | Move the check to explicit middleware so every sibling is uniform; behaviour must not change |
| G-08 | `GET /api/projects/financials` returns financials for **every** project to any `projects.view` holder; the SQL has no membership predicate | `projects.routes.ts:25-55` | High — query read directly | Apply `filterVisible`, or replace with the project-scoped PRJ-09. **This one blocks the Option-2 dashboard** (§4.8) |

These are design findings from static reading. They are **not** claims of exploited vulnerabilities, none was exercised at runtime, and no request was sent. A withdrawal (G-03) is recorded rather than deleted so that prior references remain traceable.

### 11.4 Data-integrity invariants

| # | Invariant |
|---|---|
| S-06 | **Collection envelope is uniform and never encodes denial.** Every collection response is `{ data, page:{nextCursor,hasMore}, meta }`. A permission denial is expressed as `403 FORBIDDEN_SCOPE` only when the client explicitly named an out-of-scope resource; an implicit collection read is silently scoped. `data: []` means "no rows are visible", never "you were denied". Referenced in §11.2 and now defined here — the earlier draft cited S-06 without defining it. |
| S-07 | Stock ledger is append-only. Correction is a reversal movement, not an update or delete. |
| S-08 | Audit events are append-only; no update/delete endpoint exists. |
| S-09 | IPC number is unique per project. |
| S-10 | BOQ lines referenced by IPC lines cannot be deleted. |
| S-11 | Material-request issue cannot exceed `requested_qty` and only runs from `approved`. |
| S-12a | **Role-level last-admin protection — VERIFIED.** Disabling or reducing the permissions of the role that supplies administrative coverage is rejected with `409` when no other coverage remains. Evidence: `roles.routes.ts:114-115` (`wouldLoseAdminCoverageOnRoleChange`), message `لا يمكن تعطيل آخر مدير للنظام`. |
| S-12b | **User-level last-admin protection — VERIFIED at the call sites.** `PUT /users/:id` re-checks coverage after a role or active-state change (`auth.routes.ts:181-185`); `DELETE /users/:id` checks coverage before deletion (`:219-220`) and additionally forbids self-deletion (`:221-222`, `403`). Override write paths re-check too (`:288`, `:323`). |
| S-12c | **Coverage algorithm — PARTIALLY VERIFIED.** `wouldLoseAdminCoverage` and `wouldLoseAdminCoverageOnRoleChange` are defined in `authorization.service.ts:206` and `:244`, but their bodies were not read in full. The *guards fire and what they return* is verified; the exact definition of "administrative coverage" (which permission set, whether disabled users count, how overrides participate) is **not**. Do not describe S-12 as fully verified until those two functions are read. |
| S-13 | System roles cannot be deleted; role names are immutable. |
| S-14 | Project deletion cascades BOQ + IPC in a single transaction. |
| S-15 | Document revision labels are derived from the revision counter and never double-incremented. |

**Invariant reconciliation:** 17 entries, numbered S-01…S-05, S-06, S-07…S-11, S-12a/S-12b/S-12c, S-13…S-15. S-06 previously existed only as a forward reference; S-12 previously asserted more than the evidence supported.

### 11.5 Secret and credential handling (D5 — planning only)

No secret, password, token, or connection string is recorded in this document. No rotation is performed. The target design requires: secrets supplied at runtime by the environment, never committed; refresh tokens stored hashed; cookies `HttpOnly` + `Secure` + `SameSite` (exact values `UNKNOWN` — not read); token TTLs configurable, not hard-coded in the client.

---

## 12. Adapter Assessment (D7 — design topic only, implementation NOT authorized)

### 12.1 The seven layers that must be distinguished

The previous draft treated "the adapter" as one thing. It is seven, and conflating them is what makes adapter estimates unreliable.

| # | Layer | Responsibility | Legacy coupling | Target coupling |
|---|---|---|---|---|
| L1 | Transport | HTTP client, base URL, cookies/credentials, retry, timeout, abort | `/api`, cookie auth | Same base, but response envelope differs |
| L2 | Error normalization | HTTP status + body → typed errors (`ValidationApiError`, `HttpApiError`, `NetworkApiError`) | Legacy `{message, issues?}` | `application/problem+json` with stable `code` |
| L3 | Session | Login, refresh-on-401, rotation, logout, device list | Cookie + token pair; sessions list is a stub | New session contract |
| L4 | Request mapping | UI form model → request DTO | Legacy field names (`meterNo`-style drift, tags-as-string) | Target DTOs |
| L5 | Response mapping | Response DTO → UI view model (paging, dates, money, Arabic display) | `{items,total,page,pageSize}` | `{data, page, meta}` |
| L6 | Binary | Multipart upload, download, preview, ZIP, XLSX | 3 content routes, `Content-Disposition` | One content route |
| L7 | Cache/query | Query keys, invalidation, optimistic updates | No ETag/version today | `If-Match` + `version` |

### 12.2 Where a standalone adapter actually earns its cost

| Domain | Verdict | Reason |
|---|---|---|
| Session/auth (L3) | **High value** | Entirely new contract; no legacy shape to preserve. Isolating it prevents auth churn from leaking into feature code. |
| Error normalization (L2) | **High value** | Legacy mixes Arabic messages, `issues` bags, and bare statuses. A single normalization point is cheaper than per-feature handling. |
| Paging/response mapping (L5) | **High value** | Legacy envelope → target envelope conversion is mechanical and must be consistent everywhere. |
| Documents (L4/L6) | **Medium-high** | Upload/replace/preview differ enough that a per-domain module pays for itself; three content routes must collapse to one. |
| Projects/BOQ/IPC | **Medium** | Shapes are close; the value is in terminology and totals, not transformation volume. |
| Inventory | **Medium** | Stock overview maps almost 1:1; movements need idempotency and reversal semantics. |
| Admin/roles | **Low-medium** | Mostly CRUD; the only real work is the permission-catalogue join. |
| Reports/exports | **Low** | New contract, small surface; a thin client suffices. |

### 12.3 Adapter anti-requirements

The adapter must **not**: re-implement authorization, cache permissions client-side as a security control, translate server Arabic messages by string matching, hide `problem.code`, or paper over missing endpoints with mock data in production mode.

### 12.4 D7 status

`D7` authorizes this **assessment only**. No adapter file is designed to implementation depth, no interface is frozen, and no code is written. The seven-layer decomposition is a design input for a future, separately authorized task.

---

## 13. Namespace Status (D3)

| Item | Status |
|---|---|
| Decision | **D3 — API namespace deferred. Keep `/api/`.** |
| Current live base | `/api` (`routes/index.ts` mounts all 15 routers under `/api`; `app.ts:40`) |
| Prototype base | `API_BASE_URL = '/api'` (`services/api/configuration.ts`) |
| Target base in §8 | `/api` — unchanged |
| Versioning | **Not proposed.** No `/api/v1`, no header-based version negotiation in this document |
| Rationale | The frontend and backend ship together in this rebuild; introducing a version namespace now would create two contracts with no consumer. Deferring costs nothing and preserves optionality. |
| Revisit trigger | Any of: a second consumer (mobile/partner), a breaking change that must run in parallel, or a staged rollout requiring old+new simultaneously. |

**Explicit non-claim:** path *shapes* in §8 are proposals under an unchanged base. Keeping `/api/` does **not** mean the paths under it stay the same.

---

## 14. Unknowns and Owner Decisions

### 14.1 Open unknowns (blocking classification, not blocking the document)

| # | Unknown | Why it matters | What would resolve it |
|---|---|---|---|
| U-01 | **CLOSED this round.** `globalSearch()` returns five typed namespaces (`projects`, `documents`, `warehouses`, `items`, `transactions`), each an array of `{id,title,subtitle?,link}`, 5 per namespace, row-authorization fail-closed; `{}` on blank `q` | Resolved — W-39 reclassified to adaptation | `global-search.service.ts:11-24,31-81` |
| U-02 | **CLOSED this round.** Audit list returns `{items,total,page,pageSize}` with `entity`/`action`/`q` filters; no actor or date filter and no stable tiebreak | Resolved — W-37 reclassified to adaptation | `audit.service.ts:54-99` |
| U-03 | Backup service semantics (`list`, create, restore) | Restore is destructive; G-06 scope unclear | Read `backup.service.ts` |
| U-04 | **CLOSED this round.** Notifications are PostgreSQL rows with a `read_by text[]` on the notification row; list `LIMIT 100`, handler slices 30. There is **no** recipient relation | Resolved — defect recorded in §9.6.1 | `notification.service.ts` |
| U-05 | Exact `GET /api/users` response fields vs prototype user model | W-34 field mapping | Read users handlers |
| U-06 | Role response shape (`permissions[]` representation) | Permission matrix rendering | Read `toRoleJson` |
| U-07 | **CLOSED for the import surface this round.** `import.routes.ts` read in full: 7 handlers, `ENTITY_PERMISSION` map, both mapper/entity tables, and both confirm loops are now source-verified (§5.3, §5.3.1). **Residual:** the response envelope produced by `excelService.preview()` remains `UNKNOWN` | W-41 import surface is documented; only the `/api/import/:entity/preview` response body stays open | Read `excel.service.ts` (`preview`) |
| U-08 | File storage backend (local disk vs object store) | `document_files.storage_key` design; signed-URL feasibility | Read documents service/storage module |
| U-09 | Excel export column sets per domain | Report parity | Read `excel.service.ts` call sites |
| U-10 | Cookie attributes (`Secure`, `SameSite`, exact TTLs) | Security review completeness | Read `auth.routes.ts` cookie helpers |
| U-11 | **CLOSED this round.** Delete refusals surface as a **single Arabic message string**, not a structured blocker list — so an impact preview cannot be built from the response as it stands | Resolved in form; UX gap confirmed | `stock.service.ts` (partial read) |
| U-12 | Stock transaction response/`listTxsPaged` shape | Inventory list contract | Read `stock.routes.ts` helpers |
| U-13 | Frontend Master Plan coverage beyond Phase 11 | Phase 13 scope is undefined | Owner input |
| U-14 | Target search namespace set: legacy returns 5, §8.7 lists 4 | PLT-11 typed-result contract | Owner/product decision |
| U-15…U-18 | Open **schema** decisions — `document_links` FK strategy, folder scope, batch/serial lots, status-history model | See §9.11 for the full statement and the APIs each blocks | Owner + D8 |

Unknowns U-05, U-06, U-08…U-10, U-12, U-13, U-14 and U-15…U-18 remain open, and **U-07 remains open only for the `excelService.preview()` envelope**. Each names the exact file or decision that would close it.

None of these unknowns invalidates the 15-section structure or the reuse classification of *other* domains.

### 14.2 Decisions required from the owner

| # | Question | Recommended default | Consequence if deferred |
|---|---|---|---|
| Q-01 | Approve the target contract in §8 as the design baseline (design only)? | Approve as baseline; implementation separately gated | Adapter and schema work cannot be scoped |
| Q-02 | Approve **reversal movements** as the correction model for the stock ledger (replacing the dead delete)? | Approve | Ledger correction has no legal path |
| Q-03 | Approve project-owned membership endpoints (`/projects/:id/members`) over user-owned (`/users/:id/projects`)? | Approve project-owned; keep user-owned as admin convenience | Membership UI remains split across two resources |
| Q-04 | Approve consolidation of `/preview`, `/download`, `/file` into one content route? | Approve | Three routes to secure, test, and document permanently |
| Q-05 | Approve enforcing document status transitions server-side (G-05)? | Approve | The approved status workflow cannot be guaranteed |
| Q-06 | Approve fixing G-01/G-02/G-04/G-08 (unguarded folder list, unscoped link delete, unfiltered project export, unscoped portfolio financials)? G-03 was withdrawn — sites are already scoped | Approve as security corrections | Documented exposure remains, and G-08 blocks the Option-2 dashboard |
| Q-07 | Approve cursor pagination as mandatory for the seven listed lists? | Approve | UI degrades at scale; adapter churn later |
| Q-08 | Confirm the target schema in §9 as conceptual direction (no DDL yet)? | Confirm direction only | D6 work cannot be planned |
| Q-09 | Confirm that the documents list moves to the target envelope `{data,page,meta}` — i.e. accept that **no** workflow preserves its legacy HTTP contract exactly? | Confirm | Cursor paging and facets cannot be delivered on the current envelope |
| Q-10 | Should roles/permissions gain a catalogue endpoint (`GET /admin/permissions`)? | Approve | Matrix UI hard-codes the vocabulary |
| Q-11 | Which dashboard delivery option (§4.8): client composition first, shared read model + thin endpoint as target, dedicated portfolio endpoint deferred? | Client composition **conditional on G-08**, then shared read model | Dashboard either ships on an unscoped aggregate (G-08) or is blocked until the read model exists |

### 14.3 Decision status — nothing here changes D1–D8

D1 **Architecture Option B** (as recorded in the historical ODR), D2 existing database, D3 `/api/` deferred, D4 `HISTORICAL_PASS__CURRENT_UNVERIFIED`, D5 planning-only, D6 gated, D7 not authorized, D8 gates mandatory. Q-01…Q-11 are **new questions raised by this document**, not amendments to D1–D8. Phase 12 remains **OPEN**.

Three labels must not be conflated:

- **D1 Architecture Option B** — the architecture direction *recorded in the historical ODR*: logical separation with selective reuse (§2.2 D1).
- **Architecture Option A** — the **operative owner instruction for the current scope**, which governs the architecture documented in this file. The divergence from the ODR is preserved rather than dissolved; no renewed approval is requested (§14.4.2).
- **D-SPEC-01 Option (b)** — a *separate and closed* decision about the **Import Ledger** only: the DB-resident ledger is deferred to a separate proposal, outside current Phase 12. Deferred is not cancelled (§14.4.1). **Option (b) here is not Architecture Option B.**

Two decisions carry a status that is *not* a plain "complete" and must be read with its qualifier: **D4** (§14.4.4) and **D-SPEC-15** (§14.4.2). Neither is an amendment to the ODR; both are documentation-level reconciliation recorded here.

### 14.4 Reconciliation record (R-129, extended by R-130) — status per item

This subsection records what changed status in the documentation reconciliation and, equally important, what did **not**. Status vocabulary is restricted to the terms actually used in this document: `SOURCE_VERIFIED`, `PROPOSED_NOT_IMPLEMENTED`, `DEPENDENCY_UNRESOLVED`, `DEFERRED`, `UNKNOWN`, `OPEN`, `OPEN — NOT IMPLEMENTED`, `CLOSED — OWNER_APPROVED_DESIGN (Option b)`, `RISK_SURFACE_UNQUANTIFIED`, `HISTORICAL_PASS__CURRENT_UNVERIFIED`, `RESOLVED_FOR_CURRENT_SCOPE__ODR_TRACEABILITY_CONFLICT_PRESERVED`.

#### 14.4.1 D-SPEC-01 — Import Ledger scope

**Status: `CLOSED — OWNER_APPROVED_DESIGN (Option b)`.**

- D-SPEC-01 is the **Import Ledger scope** decision. It is **closed by explicit owner approval** (Option b). It is **not reopened** here and **no renewed approval is requested**.
- **Meaning:** the DB-resident Import Ledger (`import_runs`, `import_run_rows`, `canonicalization_versions`, the 8 trigger functions, the 8 triggers and `purge_import_run`) is **outside current Phase 12** and **deferred to a separate proposal**. **Deferred components remain deferred, not cancelled.**
- For the **current scope**, the live import surface is documented against source (§5.3, §5.3.1) and is consistent with Option (b): only `import_history` exists; the ledger artefacts are absent from `apps/` and from migrations.
- **ODR traceability conflict is preserved, not dissolved.** The owner decision record continues to record the ledger direction and to reference ledger artefacts that this document cannot point to as an approved file. That divergence is recorded here as a traceability fact. No new approval is requested and none is implied.
- **This is not D-SPEC-15.** D-SPEC-01 governs the Import Ledger only; it does not decide the architecture option (§14.4.2), and it must not be read as **Architecture Option B** (§14.3).

#### 14.4.2 D-SPEC-15 — Architecture Option A / Option B

**Status: `RESOLVED_FOR_CURRENT_SCOPE__ODR_TRACEABILITY_CONFLICT_PRESERVED`.**

- D-SPEC-15 is the **architecture option** decision (Option A / Option B). It is **not** the Import Ledger decision — that is D-SPEC-01 (§14.4.1).
- **Architecture Option A is the operative owner instruction for the current scope.** The target architecture documented in this file follows it.
- **The ODR continues to record Option B.** That historical divergence between the ODR record and the operative instruction is **preserved, not resolved**.
- The ODR is **not modified**, no renewed approval is requested, and D-SPEC-15 is **not reopened**. The preserved conflict is a traceability fact, not an open implementation question.
- **Architecture Option B is not D-SPEC-01 Option (b).** The two labels are distinct (§14.3).

#### 14.4.3 D-SPEC-16 — `PLT-17` / `PLT-18`

**Status: `SOURCE_VERIFIED` (baseline approved).**

`PLT-17 = POST /api/import/:entity/preview` and `PLT-18 = POST /api/import/:entity/confirm` are the approved baseline identifiers for import preview/confirm. Both routes exist and were read in full (§5.3 #106, #107; §5.3.1-A/C/D). Remaining documentation gap is **not** the route definition; it is that the approved operating record for these identifiers is not available as a file. That is recorded as a documentation gap, not a route gap, and it does not change their `SOURCE_VERIFIED` state.

Traceability note: batch/stream distinction, per-entity permission keys and the per-row project checks are all verified in source (§5.3.1-A). No `[PROP]` item is upgraded to implemented by this reconciliation.

#### 14.4.4 D4 — historical typecheck pass

**Status: `HISTORICAL_PASS__CURRENT_UNVERIFIED`.**

The 2026-10-29 18-file conflict-marker repair with a Typecheck exit-0 run is **preserved as historical acceptance evidence** (owner acceptance record `:90-91`). For R-129 and R-130 **no new Typecheck was run**, so the current status is explicitly not asserted. The contradictory evidence is retained rather than overwritten. This is not a re-opening of D4 and does not authorize any build or test action.

#### 14.4.5 PostgreSQL version facts — recorded, not reconciled

**Status: facts distinguished; migration readiness `UNKNOWN`.**

| Source | Claim | Status |
|---|---|---|
| Owner statement | Production PostgreSQL **18** | Recorded as a claim, **not verified in this task** |
| Stage-2B report | Tested against PostgreSQL **17.11**; 19 migrations exit 0 | Historical evidence as recorded |
| Environment plan / compose | Docker baseline PostgreSQL **16** | As recorded |
| Minimum supported version | **`UNKNOWN`** | Not established by any read source |

PG18 verification was previously blocked by `0xC0000142`. **No readiness claim is made**: these four facts are not consistent enough to assert that the target schema can be migrated on the production engine. This section records the divergence; it does not resolve it, and no database contact occurred in R-129.

#### 14.4.6 Multer upload surface

**Status: `RISK_SURFACE_UNQUANTIFIED`** — see §5.3.1-J. Recorded only; no code change is permitted or proposed here.

#### 14.4.7 What this reconciliation explicitly did not do

- It did not close Phase 12, and does not assert that Phase 12 is closed.
- It did not reopen D-SPEC-01, and did not convert deferred items into cancelled items.
- It did not convert any `[PROP]` proposal into an implemented fact.
- It did not delete the historical `import_jobs` proposal; the proposal is retained and marked `DEPENDENCY_UNRESOLVED — NOT IMPLEMENTED — OUT OF CURRENT EXECUTION SCOPE`.
- It did not introduce `55P03` or `57014` error mappings; only the four mappings actually present in `errors.ts` are documented.
- It did not run Git, tests, builds, generators, formatters, SQL, or HTTP.

---

## 15. Gate Implications

### 15.1 What remains gated

| Gate | Status | Effect on this document |
|---|---|---|
| D5 — secret rotation execution | **NOT AUTHORIZED** | §11.5 is planning text only. No secret read/moved/rotated/printed |
| D6 — audit/notification → PostgreSQL | **APPROVED DIRECTION, EXECUTION GATED** | §9.6 is a conceptual model. No DDL may be written or run |
| D7 — standalone HTTP adapter | **NOT AUTHORIZED** | §12 is an assessment. No adapter implementation |
| D8 — migration/validation/rollback | **APPROVED PLAN, STAGE GATES MANDATORY** | Nothing in §9 authorizes a migration |
| Namespace change | **DEFERRED (D3)** | §8 stays under `/api/` |

### 15.2 Conditions that must hold before any implementation task

1. Owner answers Q-01…Q-11 (§14.2), or explicitly accepts the recommended defaults.
2. The remaining evidence-level unknowns are closed by reading the named sources: **zero** workflow-level `UNKNOWN — NEEDS EVIDENCE` remain (§7 tally), and implementation-level unknowns remain open (U-03, U-05, U-06, U-07-residual `excelService.preview()` envelope, U-08…U-10, U-12). Every proposed operation carrying one of them is already labelled `PARTIALLY SPECIFIED` in §8.8.
3. `G-01`…`G-08` are triaged as either "fix in target" or "accepted risk", with the decision recorded. G-03 is withdrawn (not a gap); G-08 must be resolved before any dashboard aggregate is exposed.
4. D7 authorization is granted separately before any adapter code exists.
5. D8 stage gates are re-confirmed for any schema work, including the D6 tables and every `[PROP]` constraint in §9.7.
6. A validation plan exists for the target contract (contract tests), since 108 legacy endpoints have never been exercised as a suite.

### 15.3 What this document does **not** authorize

- It does not authorize editing `apps/api`, `packages/*`, the prototype, or any test.
- It does not authorize SQL, migrations, or database connections.
- It does not authorize touching PostgreSQL 17 or 18 services, configuration, or data.
- It does not authorize live API calls.
- It does not authorize secret access or rotation.
- It does not authorize Git staging, committing, resetting, or cleaning.
- **It does not close Phase 12.**

### 15.4 Verification performed on this document

| Check | Result |
|---|---|
| Endpoint total reconciles to source | 107 handlers + 1 health = 108 (`VERIFIED`) |
| IPC path uses `/ipcs` | Corrected throughout |
| Sessions path is `/api/auth/sessions` | Corrected |
| Document filter count reconciles to source | **10** filters (`documents.routes.ts:74-84`); §1.3, §5.3 #17 and §8.4 agree |
| Workflow classification tally reconciles | 12 / 22 / 0 / 5 / 2 / 0 = **41**; zero exact-HTTP-contract reuse (§7) |
| Adapter method count | **65** exported methods ≈ **29** business operations, the latter explicitly `INFERRED` (§6.3) |
| Security findings reconciled | G-01…G-08, with G-03 withdrawn and G-08 added (§11.3) |
| Invariants reconciled | S-01…S-15, with S-06 defined and S-12 split into a/b/c (§11.4) |
| No claim that PG 18 is currently LISTENING on 5432 | Absent |
| No "D4 incomplete" claim | Absent; D4 now carries `HISTORICAL_PASS__CURRENT_UNVERIFIED` (§14.4.4) — the historical pass is preserved and no current pass is asserted |
| No mapped-but-unimplemented SQLSTATE | Only `22P02`, `23505`, `23503`, `23502` documented from `errors.ts`; `55P03`/`57014` explicitly absent (§5.3.1-D) |
| No unimplemented job endpoint described as live | `GET/POST /api/import/jobs` and `GET /api/import/jobs/:jobId` marked `DEPENDENCY_UNRESOLVED — NOT IMPLEMENTED — OUT OF CURRENT EXECUTION SCOPE` (§8.7, §8.8.5) |
| No `import_history` described as a job store | §5.3.1-B and §9.6.2 state the opposite with column-level evidence |
| No `[PROP]` promoted to implemented | Absent; proposals retain `[PROP]` / `PROPOSED_NOT_IMPLEMENTED` |
| No "D8 preliminary" claim | Absent |
| No "65 exports = 65 business operations" claim | Removed; §6.3 corrects it |
| No inferred route presented as verified | Every unread element labelled `PARTIALLY VERIFIED` / `UNKNOWN` |
| No `REUSE LEGACY CONTRACT AS-IS` wording | Replaced by the six-class taxonomy |
| No proposed endpoint described as existing | §8 is explicitly labelled PROPOSED, NOT IMPLEMENTED |
| No production-readiness claim | Absent |
| No Phase 12 closure claim | Explicitly disclaimed (§15.3) |

### 15.5 Evidence scope and Git limitation

- **Static reading only.** Every legacy statement in this document derives from reading source files. No HTTP request was sent, no database was queried, and no service was started or stopped for this audit.
- **Cross-cutting files not read in full.** `audit.service.ts` (list body read; write paths not), `global-search.service.ts` (read in full), `notification.service.ts` (storage and list read; creation paths not), `stock.service.ts` (delete-safety and overview read; remainder not), `backup.service.ts` (not read), `excel.service.ts` (not read), `authorization.service.ts` (signatures and call sites read; `wouldLoseAdminCoverage*` bodies not). Any statement depending on an unread part is labelled `PARTIALLY VERIFIED` or `UNKNOWN` where it appears.
- **"Unknown shape" is not "missing capability".** W-37 and W-39 were classified from source, not downgraded because a response shape had not yet been read.
- **Git cannot independently prove the change set.** The entire `docs/` tree is untracked in this repository, so `git status --porcelain` cannot show that only two documentation files were modified. The evidence for the change set is (a) the action record of an **earlier** audit round, which touched only `phase-12-prototype-live-api-contract-map.md` and `phase-12-service-identity-verification-addendum.md` (this is not the R-129 change set, which is stated separately below), and (b) file timestamps. This is a stated limitation, not a verification; no Git state was altered to make the claim checkable.
- **R-129 change set.** R-129 modified **one file only**: this document. No other file, and no code, test, build, generator, formatter, SQL, database, HTTP or Git action was performed. Because `docs/` is untracked, this is asserted from the action record and file modification, not from `git status`. R-129 ran **no** Typecheck, build, or test; the D4 status is therefore `HISTORICAL_PASS__CURRENT_UNVERIFIED` (§14.4.4).

- **R-130 change set.** R-130 modified **one file only**: this document. No other file, and no code, test, build, generator, formatter, SQL, database, HTTP or Git action was performed. Because `docs/` is untracked, this is asserted from the action record and file timestamps, not from `git status`. R-130 ran **no** Typecheck, build, or test.

---

## Appendix A — Evidence index (file → what it proves)

| File | Proves |
|---|---|
| `apps/api/src/app.ts` | `/api/health`, global middleware, JSON limit, SPA fallback, error handlers |
| `apps/api/src/routes/index.ts` | 15 mounts, order, `/users` double mount |
| `apps/api/src/modules/*/*.routes.ts` | Every handler, guard, status code, DTO usage |
| `apps/api/src/modules/*/*.validators.ts` | Exact field-level request contracts |
| `apps/api/src/middleware/auth.ts` | Guard semantics and composition |
| `apps/api/src/services/projectScope.ts` | IDOR-safe scope resolution, hidden existence |
| `apps/api/src/services/filter.service.ts` | Paging/search/sort mechanics and their in-memory nature |
| `apps/api/src/services/authorization.service.ts` | `MANAGED_PERMISSIONS`, `SCOPED_MIN_LEVEL`, `AccessLevel` |
| `packages/shared/src/permissions.ts` | 28 permissions, 5 seeded roles, fallback to `viewer` |
| `docs/frontend-rebuild/phase-03-prototype/src/app/router.tsx` | Approved route tree and screen inventory |
| `…/src/app/providers/auth.tsx` | Mock-only auth model |
| `…/src/services/api/adapters/mock/api.ts` | 65 adapter methods, seed shape, mock validators |
| `…/src/services/api/{index,configuration,client,errors}.ts` | `API_MODE`, base URL, error taxonomy |

## Appendix B — Correction log versus the previous draft

| # | Previous statement | Correction | Basis |
|---|---|---|---|
| 1 | "Both PG17 and PG18 are LISTENING" (referenced in companion context) | Outside this file's scope; the addendum owns it. This file makes no listener claim. | Addendum §6.0 |
| 2 | `GET /api/users/sessions` | `GET /api/auth/sessions` | `auth.routes.ts:458` |
| 3 | `/api/projects/:id/ipc` | `/api/projects/:projectId/ipcs` | `projects.routes.ts:23` |
| 4 | "107 route handlers" used ambiguously | 107 handlers **+** 1 health = **108 endpoints**, reconciled per file | §5.2 |
| 5 | "The prototype uses 65 operations" | 65 **adapter methods** ≈ 29 business operations | §6.3 |
| 6 | `REUSE LEGACY CONTRACT AS-IS (likely)` | Six-class taxonomy; **no** workflow qualifies as exact HTTP-contract reuse | §10 |
| 7 | Endpoint shapes "sampled, not exhaustively parsed" | Exhaustive per-handler inventory with line-level evidence | §5.3 |
| 8 | IPC grouped under a singular `/ipc` mount | Two nested mounts (`/:projectId/boq`, `/:projectId/ipcs`) documented separately | §5.1, §5.3 |
| 9 | Document count stated as 18 in one table | **17** handlers | `documents.routes.ts` |
| 10 | Section order (`§18` before `§17`, duplicated tail) | Rebuilt as 15 ordered sections | whole file |
| 11 | W-14 archive browse classified `REUSE LEGACY HTTP CONTRACT` | Reclassified `REUSE LEGACY IMPLEMENTATION WITH ADAPTATION`: cursor paging + facets change the envelope while the filter semantics survive | §4.4, §7, `documents.routes.ts:74-86` |
| 12 | W-37 and W-39 classified `UNKNOWN — NEEDS EVIDENCE` | Both implementations and response shapes read; reclassified to adaptation. An unread shape was never evidence of a missing capability | `audit.service.ts:54-99`; `global-search.service.ts:11-24,31-81` |
| 13 | Classification tally `12 / 19 / 1 / 5 / 2 / 2` | `12 / 22 / 0 / 5 / 2 / 0 = 41`; zero exact-HTTP-contract reuse | §7 |
| 14 | "11 legacy document filters" | **10** filters, enumerated | `documents.routes.ts:74-84` |
| 15 | G-03: "`GET /api/sites` ignores `projectId`" | **Withdrawn** — the route applies `filterVisible`, validates an explicit `projectId` via `checkFilterProject` (403), and filters by it | `sites.routes.ts:22-31` |
| 16 | No portfolio-wide financial-scope finding | **G-08 added**: `GET /api/projects/financials` has no membership predicate and returns every project to any `projects.view` holder | `projects.routes.ts:25-55` |
| 17 | S-06 cited in §11.2 but never defined | Defined: uniform envelope, denial never encoded as `data: []` | §11.4 |
| 18 | S-12 asserted as fully verified | Split: S-12a (role-level) and S-12b (user-level) verified; S-12c (coverage algorithm) partial — function bodies unread | `roles.routes.ts:114-115`; `auth.routes.ts:181-185,219-222,288,323`; `authorization.service.ts:206,244` |
| 19 | `Idempotency-Key` implied for every mutation | Proposed only for document upload, stock movement and material-request issue (`OPEN`, separate decisions); import-job idempotency `DEFERRED`; `If-Match` + `version` elsewhere | §8.1 rules 6–9 |
| 20 | Both `read_by text[]` and a proposed `notification_reads` modelled | Single `notification_recipients(notification_id, user_id, read_at)` relation | §9.6.1 |
| 21 | Schema rows listed without separating verified legacy columns from proposals | Every constraint tagged `[REQ]` or `[PROP]`; consolidated constraint matrix, entity→workflow and entity→target-API maps added; no legacy column invented | §9 |
| 22 | Scope rule only implicit in the invariants | Seven-point rule, including "a client-supplied project ID never proves authorization" and "a parent path ID is context only" | §8.9, §11.2 |

## Final status

**`COMPLETE — DESIGN DOCUMENTATION ONLY`**

Every required section of this document is complete at its stated level: the 41-workflow inventory and its classifications reconcile with the endpoint and adapter inventories; the proposed API surface carries per-operation contracts with evidence labels; the schema is expressed as required-versus-proposed constraints with its unresolved integrity problems named; security invariants and static findings are separated and individually evidenced; and every remaining unknown is bounded to a named source or an owner decision.

This status means the **documentation task** is complete. It does **not** mean the design is fully evidenced, the proposed operations are authorized, the schema is approved, or Phase 12 is closed. Phase 12 remains **OPEN**; D3 remains deferred; D5/D6 execution, D7 implementation, Stage 3 and Phase 13 remain unauthorized.

**R-129 reconciliation (documentation-only).** The import surface is now documented against source (§5.3, §5.3.1): 7 routes, `ENTITY_PERMISSION`, the four implemented SQLSTATE mappings, per-route transaction facts, and the actual `import_history` column contract. Statuses carried forward deliberately: D-SPEC-01 = `CLOSED — OWNER_APPROVED_DESIGN (Option b)` (Import Ledger deferred, not cancelled); D-SPEC-15 = `RESOLVED_FOR_CURRENT_SCOPE__ODR_TRACEABILITY_CONFLICT_PRESERVED` (Architecture Option A operative, ODR still records Option B); D-SPEC-16 / PLT-17–18 = `SOURCE_VERIFIED` (baseline approved; approved operating record not available as a file); D4 = `HISTORICAL_PASS__CURRENT_UNVERIFIED`; Multer upload surface = `RISK_SURFACE_UNQUANTIFIED`; `import_jobs` and its three endpoints = `DEPENDENCY_UNRESOLVED — NOT IMPLEMENTED — OUT OF CURRENT EXECUTION SCOPE`; `import_runs`/`import_run_rows` = `DEFERRED` (D-SPEC-01 Option (b), not cancelled); PostgreSQL version facts = recorded but unreconciled, migration readiness `UNKNOWN`.

**R-130 consistency correction (documentation-only, one file).** Four corrections applied: (1) D-SPEC-01 (Import Ledger scope, closed by owner approval, Option b) is now distinct from D-SPEC-15 (Architecture Option A/B, conflict preserved) — §14.3, §14.4.1, §14.4.2, §2.2 D1; (2) the W-41/§8.1/§5.3.1-F contradiction is removed — persistent job identity and import-job idempotency are `DEFERRED`, and the three idempotency kinds are kept separate (`DEFERRED`, `OPEN`, `OPEN — NOT IMPLEMENTED`); (3) `import_history` is no longer claimed to be append-only/immutable — the inspected application path inserts summary rows, no application-level update/delete path was identified, and database-enforced immutability is **not established** (§5.3.1-B, §9.6.2, §9.7); (4) headings and all internal §14.4.x references were re-checked and corrected.

**Still unresolved after R-130.** `excelService.preview()` response envelope (`UNKNOWN`); the approved operating record for PLT-17/PLT-18 (`UNKNOWN` as a file); PostgreSQL minimum supported version and PG18 migration verification (`UNKNOWN`); import-confirm idempotency (`OPEN — NOT IMPLEMENTED`); document/stock-movement/material-request-issue idempotency (`OPEN`, separate owner decisions); `import_jobs` (`DEPENDENCY_UNRESOLVED — NOT IMPLEMENTED — OUT OF CURRENT EXECUTION SCOPE`); ODR↔document traceability — both the deferred ledger (D-SPEC-01) and the architecture option (D-SPEC-15) — conflict preserved, not resolved. These are recorded, not closed. **No closure of Phase 12 is asserted by this document.**
