# Phase 12 — API, Authentication & Permissions Map

Status: **Discovery only.** Baseline: HEAD `f91ed2f9` on branch `main`.
Evidence labels: **Verified** / **Inferred** / **Proposed** / **Unknown**.

---

## 1. Application Shape

| Item | Fact | Evidence |
|---|---|---|
| Runtime | Express 4.21, single process, listens on `PORT ?? 4001` (default), `trust proxy = 1` | `apps/api/package.json:20`, `apps/api/src/server.ts:3`, `apps/api/src/app.ts:22` |
| One-port serving | Production web build (`apps/web/dist`) is served by the API itself via SPA fallback; `WEB_DIST` env may override | `apps/api/src/app.ts:42-57` (Verified) |
| CORS | `CORS_ORIGINS` allowlist; source-verified behavior when unset: reflect the request `origin` with `credentials: true` (`app.ts:23-31`) — a local / same-LAN dev posture per the code comments. **Deployed production configuration is Unknown** (never verified outside source). Verifying the deployed CORS policy is a prerequisite before any Internet-facing release or cutover. CORS is not a substitute for authentication or authorization | `apps/api/src/app.ts:23-31` (Verified source; deployment Unknown) |
| Health endpoint | `GET /api/health` returns `{ ok, db }` | `apps/api/src/app.ts:35-38` (Verified) |
| Startup | `ensureDataDirectories()` + `ensureSeedData()` + `runMigrations()` before serving | `apps/api/src/app.ts:13-18` (Verified) |
| Migration runner | Reads `migrations/*.sql` sorted by `localeCompare`, applies in transaction, tracks in `_migrations` | `apps/api/src/database/migrate.ts:34-56` (Verified) |
| API router | Mounted at `/api` via `app.use('/api', apiRouter)` | `apps/api/src/app.ts:40` |

**Critical code-health finding (Verified).** Unresolved git merge-conflict markers (`<<<<<<< HEAD … ======= … >>>>>>> 22bb86216dfc…`) exist in **18 source files** under `apps/api/src/**`, including middleware, routes and services:

`middleware/auth.ts`, `routes/index.ts`, `services/auth.service.ts`, `services/authorization.service.ts`, `services/global-search.service.ts`, `services/projectScope.ts`, `modules/auth/auth.routes.ts`, `modules/documents/documents.routes.ts`, `modules/folders/folders.routes.ts`, `modules/import/import.routes.ts`, `modules/material-requests/material-requests.routes.ts`, `modules/projects/boq.routes.ts`, `modules/projects/ipc.routes.ts`, `modules/projects/projects.routes.ts`, `modules/roles/roles.routes.ts`, `modules/sites/sites.routes.ts`, `modules/stock/stock.routes.ts`, `modules/warehouses/warehouses.routes.ts`.

Direct consequence (Verified): `npm run typecheck` in `apps/api` exits non-zero with TS1185 errors in these same files. Any architecture decision must treat backend source repair as a **prerequisite task**, not an optional nicety. Note: this conflict-marker state is *pre-existing* and invalidates any earlier report that asserted a green backend without re-verifying in the current tree.

---

## 2. Route Mount Inventory (Verified — `routes/index.ts`, with the caveat that the file itself contains a conflict block choosing `.js` vs extension-less imports; both arms list the **same module list**)

| Mount | Router | Module |
|---|---|---|
| `/api/auth`, `/api/users` (+ext), `/api/roles` | auth/roles routers | `modules/auth`, `modules/roles` |
| `/api/projects` (+ `/boq`, `/ipc` under it) | projectsRouter | `modules/projects` |
| `/api/documents` | documentsRouter | `modules/documents` |
| `/api/folders` | foldersRouter | `modules/folders` |
| `/api/warehouses` | warehousesRouter | `modules/warehouses` |
| `/api/items` | itemsRouter | `modules/items` |
| `/api/stock` | stockRouter | `modules/stock` |
| `/api/sites` | sitesRouter | `modules/sites` |
| `/api/material-requests` | materialRequestsRouter | `modules/material-requests` |
| `/api/import` | importRouter | `modules/import` |
| `/api/config` | configRouter | `modules/config` |
| `/api/search`, `/api/notifications`, `/api/audit-logs`, `/api/backups` | systemRouter (mounted at `/`) | `modules/system` |

**Unknown:** per-endpoint HTTP method/request-shape exact enumeration was not exhaustively diffed in Phase 12 (route files were sampled, not exhaustively parsed, because of conflict markers). This is an input the Owner decision does not need immediately, but the full contract inventory should be generated post-conflict-resolution.

---

## 3. Authentication Model (Verified)

| Aspect | Fact | Evidence |
|---|---|---|
| Access token | JWT; carried via `Authorization: Bearer` OR HttpOnly cookie `cos_access` (two transports of one short-lived token) | `middleware/auth.ts:54-69` |
| Token payload | `{ sub, sid }` — role/permission/active state is **never** trusted from the token; all re-resolved server-side per request | `middleware/auth.ts:70-83`, comments 29-33 |
| Sessions | DB-backed in `sessions` table; token stored as sha256 hash; refresh TTL 24h (or 30d with `rememberMe`) | `session.service.ts:22,45,58-70` |
| Session revocation | `revoked` session, expired session, `userId` mismatch, or inactive user → 401 | `middleware/auth.ts:76-83` |
| Password | bcryptjs hashing (`bcryptjs ^3.0.3`) | `package.json:18` |
| Legacy v2 shape | Tokens without `sid` are rejected (cutover = one re-login) | `middleware/auth.ts:74-75` |
| Signature vs application validity | A JWT signature that remains cryptographically verifiable under the active signing secret is **necessary but not sufficient** for an authenticated request. After `authService.verifyToken()` succeeds (`middleware/auth.ts:63`), the request must still pass the session/user checks — non-empty `sub`+`sid` (line 75), an existing session with no `revokedAt` (line 77), an unexpired session (line 78), `session.userId === sub` (line 79), and an active user (`isActive`, line 81) — each failure returning 401. A token whose signature still verifies but whose session is revoked/expired/mismatched, or whose user is inactive, is therefore **not application-valid** | `middleware/auth.ts:63-83` (Verified) |
| Secret change | Changing the signing secret makes previously issued tokens fail signature verification (they were signed under the previous secret); an unverifiable token is rejected at the first step regardless of session state. Whether a production deployment rotates the secret, and when, is **Unknown** | `middleware/auth.ts:63-64`, `auth.service.ts:15-23` |

**`data/.jwt-secret`**: a file-based secret inside the JSON data directory. Source-verified resolution order (`auth.service.ts:15-23`): the `JWT_SECRET` **env variable takes priority**; the file is used only as a **fallback** (and is auto-created only when the env variable is absent). Its value is never recorded in this task. Which source a production deployment actually uses is **Unknown**. For migration, treat as a secret to be moved into a secrets store, with rotation plan (Proposed; see doc D §7). Rotation/secret change requires verifying the session-verification path and accepting one re-login impact — see doc D Stage 3 sessions/JWT check.

---

## 4. Permission Vocabulary (Verified)

Two layers of vocabulary:

1. **28 legacy keys** in `packages/shared/src/permissions.ts:1-29` (`archive.*` 5, `warehouse.*` 9, `projects.*` 4, `materialRequests.*` 4, plus `reports.view`, `audit.view`, `settings.manage`, `users.manage`, `backup.manage`).
2. **3 administration keys** added by the authorization rebuild: `roles.manage`, `projects.access`, `users.resetPassword` (`apps/api/src/services/authorization.service.ts:23-28`).

Total managed keys = 31 (Verified). Unknown keys deny by default (`authorization.service.ts:79,83`).

### Role Base Matrix (seeded by `19_authz_rebuild.sql:46-77`)

| Role | arcs |
|---|---|
| admin | all 28 + 3 admin keys |
| management | archive.view/download, warehouse.view, projects.view/create/edit, materialRequests.view/approve, reports.view, audit.view |
| warehouse | archive.view/download, warehouse.view/create/edit + stock ops (in/out/transfer/adjust/return), projects.view, materialRequests.view/issue |
| technical | archive.view/upload/edit/download, projects.view, warehouse.view, materialRequests.view/create |
| viewer | archive.view/download, warehouse.view, projects.view, materialRequests.view |

### Decision Precedence (Verified, `authorization.service.ts`)

```
role base  →  DENY override beats GRANT override  →  project-access narrowing (scoped CRUD only)  →  active-user/known-key guard
```

- Project-level scoped keys and their minimum access levels: `SCOPED_MIN_LEVEL` at `authorization.service.ts:59-75` (e.g. `archive.view` needs ≥READ membership, `archive.delete` needs DELETE).
- `projects.access` holders bypass project narrowing (never broadens — `authorization.service.ts:139-144`).
- `project_members.access ∈ {NONE, READ, WRITE, DELETE}` — constraint-only narrowing (`19_authz_rebuild.sql:20-28`).

### Resolution Path (Verified)

- `projectScope.ts` is the only place deciding "which project does this request target"; row-backed resources resolve projectId from the **database row** (IDOR-safe); client-supplied projectIds feed deny-by-default checks (`projectScope.ts:1-13,45-76`).

---

## 5. Authorization Mapping Matrix

Given the new UI (prototype) is a **frontend-first rebuild** and current findings do not yet prove a different permission model, the mapping below is **Proposed**, not new grants. Rule: **no user receives a broader permission post-migration**; the mapping is nearly identity with explicit deltas needed by new UI capability claims.

| Resource/Action | Current Permission | Target New-System Permission | Scope | Mapping Rule | Denial Tests Required |
|---|---|---|---|---|---|
| projects.list / get / create / edit / delete | `projects.view/create/edit/delete` | same (Proposed: unchanged) | global + project | identity | viewer/technical role denies edit/create |
| projects.assign access | `projects.access` | same | project | admin-only | non-admin denies |
| archive.list / search | `archive.view` | same | global + project | identity | no-membership project → 404 style hidden existence (`middleware/auth.ts:104-110`) |
| archive.upload | `archive.upload` | same | WRITE project membership | identity | viewer denies |
| archive.edit | `archive.edit` | same | WRITE | identity | viewer/warehouse denies |
| archive.delete | `archive.delete` | same | DELETE | identity | technical denies |
| archive.download | `archive.download` | same | READ | identity | no-membership denies |
| warehouses CRUD | `warehouse.*` | same | global | identity | viewer denies |
| stock.in/out/transfer/adjust/return | `warehouse.stock_*` | same | global | identity | technical denies |
| materialRequests.view | `materialRequests.view` | same | READ project | identity | viewer denies on foreign project |
| materialRequests.create | `materialRequests.create` | same | WRITE | identity | |
| materialRequests.approve | `materialRequests.approve` | same | global | identity | warehouse denies |
| materialRequests.issue | `materialRequests.issue` | same | global | identity | management denies |
| reports.view / audit.view / settings / users / backup | respective | same | global | identity | |
| roles.manage / resetPassword | 3 admin keys | same | global | identity | any role except admin denies |

**Important note (Verified).** `@cos/shared` vocabulary is shared by both frontends by design; changing keys would ripple into the API and prototype. For the separation hypothesis, unless new business rules prove different permission semantics, the map above is intentionally identity-preserving. Any new key (for example, if the new UI's "إدارة" module introduces new sub-actions) must be added upstream of migration — not retrofitted at the database.

### Server-side Enforcement Note (Verified)

- Hide-in-UI is never a security boundary. All enforcement is server-side in `middleware/auth.ts` depending on `authorization.service.can()`; this pattern must be preserved post-separation (Proposed requirement in doc A).

---

## 6. Identity / Session Specifics Bearing on Separation

| Topic | Current Fact | Separation Implication (Inferred) |
|---|---|---|
| Identity store | Single `users` table, FK `users.role_name → roles(name)` | If new system keeps same users → reuse as-is. If separation continues → alternative is a **new DB with its own users/roles tables**, not a fork of the same tables. |
| Password hashes | bcryptjs |Portable within same bcrypt; migration of hashes is safe to carry (Inferred) — no re-hash needed |
| Sessions | DB-backed, short-lived access JWT + hashed refresh record | New system should reuse the same sessions table OR create its own — **not** shared mutable state. Cutover policy (Proposed): deliberate invalidation default-safe (one re-login); preserved rows must be verification-tested against the new secret first — preservation is not automatically safe |
| Roles | 5 system roles + custom; `is_system` flag distinguishes | New system should inherit only what it actually needs; no automatic "broader" grant |
| Project scope | `project_members.access` (NONE/READ/WRITE/DELETE) | Reusable if the new system keeps the same projects domain |

---

## 7. Files Inventory Relevant to This Map

- `apps/api/src/routes/index.ts` (contains conflict block; both arms spell the same router mounts)
- `apps/api/src/middleware/auth.ts` (conflict block; both arms same content, different import suffix)
- `apps/api/src/services/authorization.service.ts` (same conflict pattern — import suffix, not semantics)
- `packages/shared/src/permissions.ts` (clean, no conflicts)
- `apps/api/src/services/projectScope.ts` (conflict block; both arms same logic)
- `packages/shared/src/types.ts` (SharedUser etc. used in verify chain)
- `apps/api/tests/` — `auth.middleware.test.ts`, `auth.session.test.ts`, `auth.users.test.ts`, `authorization.unit.test.ts`, `authz.project.test.ts`, `roles.test.ts`, `integration.test.ts`, `migration.parity.test.ts`, `project.access.test.ts`, `unit.test.ts` (Verified — folder listing)
