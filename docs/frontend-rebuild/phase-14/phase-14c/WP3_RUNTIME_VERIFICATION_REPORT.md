# Phase 14 — WP3 Controlled Runtime Verification Report

**Verdict: `CONTRADICTORY EVIDENCE — OWNER REVIEW REQUIRED`**

| Field | Value |
|---|---|
| Report path | `docs/frontend-rebuild/phase-14/phase-14c/WP3_RUNTIME_VERIFICATION_REPORT.md` |
| Date of verification | 2026-11-18 |
| Verifier | Independent read-only runtime verification session (no source/config/DB writes) |
| Repository | `D:\Default Project\company-ops-system` |
| Git baseline HEAD | `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf` (`main`, 2026-10-11 09:19:57 +0000) |
| Files created by this session | 1 (this report only) |
| Mutating operations performed by this session | 0 |

---

## 1. Executive Summary

The requested artifact was a controlled, reproducible verification of the Phase 14 path:

```
Phase 14 UI → Browser → HTTP → Node/Express API → PostgreSQL → HTTP response → UI
```

That path **cannot be verified as Phase 14** in the current repository state, for three independent and mutually reinforcing reasons:

1. **The Phase 14 frontend source does not compile.** `apps/web/src` contains **79 unresolved merge-conflict hunks across 14 files in the working tree** (and **81 hunks across 15 files in `HEAD`**). The live Vite dev server returns **HTTP 500** for `src/App.tsx` with a Babel parse error at the first `<<<<<<< HEAD` marker.
2. **The running backend is a stale pre-Phase-14 build.** The Windows service `CompanyOpsAPI` executes `apps/api/dist/server.js`, compiled **before** Phase 14 backend source and never rebuilt. The database migration ledger stops at `21_direct_amounts.sql`; Phase 14 migrations `22`–`24` exist only as **untracked source files** and have never been applied.
3. **The running UI is a stale pre-Phase-14 bundle.** `apps/web/dist/assets/index-BdtBinrW.js` was produced **2026-10-11 11:57:59 local**, roughly 22 minutes *before* the current `HEAD` commit timestamp, and contains **zero** Phase 14 markers (`ipc_items`, `import_history`, `workflow`, `phase14`).

Despite this, a **genuine UI → API → PostgreSQL → UI round trip was observed** on the stale stack — but it was **not initiated by this verification session**. During the session, an unattributed actor in the shared browser tab performed `POST /api/auth/login` → **200**, after which 15+ authenticated `GET` requests returned **200**, and the rendered DOM matched the database row counts exactly (project `e8216dc4-…`: `documents=3` → UI tab `المستندات (3)`; `sites=0`, `warehouses=0` → matching tabs). That login also wrote a new `audit_logs` row at `2026-11-18 01:35:21.793-08`.

The correct verdict is therefore **not** `FULL READ-ONLY RUNTIME ROUND TRIP VERIFIED` (the round trip was on stale artifacts, by an unattributed actor, with no Phase 14 schema) and **not** `VERIFICATION BLOCKED BY ENVIRONMENT` (the environment was reachable and measurable). The evidence is internally contradictory: **a real round trip exists, but it is not the Phase 14 round trip, and multiple environment facts asserted in prior WP3 reports are demonstrably false.**

**Verdict: `CONTRADICTORY EVIDENCE — OWNER REVIEW REQUIRED`**

---

## 2. Mandate & Scope

### 2.1 What was mandated

Independently and read-only verify, with per-stage reproducible evidence, the runtime chain from the Phase 14 UI to PostgreSQL and back, and record each stage as a *separate* state — never collapsing "source exists" into "round trip verified".

### 2.2 Frontend candidates examined

| Candidate | Path | Determination |
|---|---|---|
| Phase 14 application | `apps/web` | **Intended Phase 14 UI** (React 19 + Vite 7, six-module route table) |
| Phase 13 app | `docs/frontend-rebuild/phase-13` | Earlier separate implementation; owns the `VITE_PROTOTYPE` flag |
| Phase 03 prototype | `docs/frontend-rebuild/phase-03-prototype` | Earlier standalone prototype (also owns `VITE_PROTOTYPE`) |

`apps/web` is the only candidate wired to `apps/api` (`vite.config.ts` proxy `/api` → `localhost:4001`).

### 2.3 The six modules in scope

Dashboard, Projects, Archive, Finance/IPC, Administration, Audit.

### 2.4 Assumptions submitted to test (not accepted)

Every one of the following was treated as a *claim to be falsified*, not a premise:

- `apps/web` holds Phase 14.
- PostgreSQL **17** at `127.0.0.1:5433`, database `cos_db`.
- Backend default port **4000**.
- Prior Vite proxy target **4001**; prior Vite port **8080**.
- `VITE_PROTOTYPE` defaults to false.
- Backend startup may auto-run `ensureDataDirectories()`, `ensureSeedData()`, `runMigrations()`.
- `apps/web/src/App.tsx` contains merge-conflict markers.

Sections 6–14 record the outcome for each.

---

## 3. Constraints & Prohibitions Observed

### 3.1 Prohibited — and honoured

| Prohibition | Status |
|---|---|
| Modify any source / config / env / package / test / DB file | **Honoured** — 0 edits |
| Run migrations, seeds, bootstrap, `ensureSeedData()` | **Honoured** — 0 executions |
| Any DB `INSERT` / `UPDATE` / `DELETE` / `TRUNCATE` | **Honoured** — 0 statements issued; only `SELECT` |
| Create/modify users or passwords | **Honoured** |
| Change permissions / roles / `ROLE_BASE` | **Honoured** |
| Change `.env`, `DATABASE_URL`, API ports, proxy, frontend config | **Honoured** |
| `npm install` / `npm update` | **Honoured** |
| Resolve merge conflicts | **Honoured** — left 79 hunks untouched |
| Apply patches / auto-fixes | **Honoured** |
| Any `git reset` / `checkout` / `clean` / `stash` / `stage` / `commit` / `merge` / `push` | **Honoured** — index untouched (0 staged) |
| Start backend before inspecting full startup side effects | **Honoured** — startup inspected first; backend **never started** |
| Use production credentials / DBs | **Honoured** — only the local development credential already in `apps/api/.env` |
| `POST`/`PUT`/`PATCH`/`DELETE` by this session | **Honoured** — 0 requests of these methods issued (therefore **no login attempted**) |
| Mutation tests | **Honoured** — none run |
| Create files other than the single report | **Honoured** — 1 file created |
| Save browser screenshots | **Avoided** — DOM snapshot + console + network evidence used instead, to avoid creating extra files |
| Terminate any process | **Honoured** — no process killed |

### 3.2 Consequence of honouring the prohibitions

Because backend startup was proven mutating (§10) and therefore forbidden, and because the frontend source cannot compile (§7) and therefore cannot be rebuilt, **a controlled Phase 14 round trip was structurally impossible within the mandate.** The session stops at documentation, as instructed, rather than fixing anything.

### 3.3 Scope boundary worth stating explicitly

This session performed **zero writes of any kind** — no file writes except this report, no HTTP methods other than `GET`/`HEAD`, no SQL other than `SELECT`. The `POST /api/auth/login` observed in §15 was **not** issued by this session (§15.4).

---

## 4. Baseline & Git Protection

### 4.1 Baseline captured before any inspection

| Item | Baseline value |
|---|---|
| `git rev-parse HEAD` | `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf` |
| Branch line | `## main...origin/main` |
| Commit date | 2026-10-11 09:19:57 +0000 |
| Commit subject | `Merge branch 'main' of https://github.com/mamin144/company-ops-system` |
| `git status --porcelain` line count | **46** |
| Staged paths | **0** |
| `docs/` tracking state | untracked (`?? docs/`) |

### 4.2 Final state — compared to baseline

| Item | Final value | Delta |
|---|---|---|
| HEAD | `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf` | **unchanged** |
| `git status --porcelain` line count | **46** | **unchanged** |
| Staged paths | **0** | **unchanged** |
| New untracked path introduced | `?? docs/frontend-rebuild/phase-14/phase-14c/` | pre-existing directory, already untracked at baseline; now also contains this report |

**Git protection: PASS.** No staged content, no commit, no branch movement, no index mutation. The only file added anywhere in the repository is this report.

### 4.3 A note on attribution of untracked content

`docs/` is untracked in its entirety at baseline, and `docs/frontend-rebuild/phase-14/phase-14c/` already contained nine other documents plus two prior WP3 reports before this session. It is therefore impossible to distinguish "this session's addition" from "pre-existing untracked material" via `git status` alone. The distinction is recorded here by direct file enumeration instead:

| File in `phase-14c/` | Last write | Authored by this session |
|---|---|---|
| `01-readiness-traceability.md` … `08-phase-14c-final-report.md` | 2026-11-17 | No |
| `WP3A_FRONTEND_IDENTITY_AUDIT.md` | 2026-11-18 11:12 | No |
| `WP3_INDEPENDENT_VERIFICATION_REPORT.md` | 2026-11-18 10:53 | No |
| `WP3_STARTUP_VERIFICATION_REPORT.md` | 2026-11-18 11:06 | No |
| `WP3_RUNTIME_VERIFICATION_REPORT.md` | **this session** | **Yes** |

The Phase 14 migration files `22`–`24` are likewise **untracked and pre-existing** (verified by `git ls-files --error-unmatch`, which fails for them) — they were **not** created by this session.

---

## 5. Method & Evidence Rules

1. **Falsification-first.** Every environment claim was tested against the live system, not against documentation or prior reports.
2. **State separation.** Seven runtime states were tracked independently and are reported independently in §15.5.
3. **Artifact provenance.** For every running surface, the *executing artifact's* mtime was compared against the *source's* mtime to detect stale builds. This was decisive (§8.5, §13.4).
4. **No-mutation discipline.** Only `GET`/`HEAD` issued over HTTP; only `SELECT` issued over SQL; no process control; no rebuilds.
5. **Reproducibility.** Every claim below names the observable, the command/tool, and the value returned.
6. **Contamination awareness.** Pre-existing browser tabs (ports 5203, 5204, a `file://` prototype) and external activity in the shared tab were identified and excluded from attribution (§15.4).

Limitation: ports are ambiguous identifiers (two PostgreSQL instances are listening). Where a port alone could not establish identity, the *service definition* and a *successful authenticated login to the actual database* were used as the identity proof instead (§12).

---

## 6. Frontend Source Identity

### 6.1 Entry point chain

| Evidence | Value |
|---|---|
| `apps/web/index.html:21` | `<script type="module" src="/src/main.tsx"></script>` |
| `apps/web/package.json` | `react ^19.1.1`, `vite ^7.1.3` |
| `apps/web/vite.config.ts` `base` | `/company-ops-system/` |
| `apps/web/vite.config.ts` `server.port` | `5173` |
| `apps/web/vite.config.ts` proxy | `/api` → `http://localhost:4001` |
| `apps/web/vite.config.ts` `preview.port` | `4173` |
| VitePWA `navigateFallbackDenylist` | `[/^\/api]` |
| VitePWA `runtimeCaching` | `[]` |

**Determination: `apps/web` is the Phase 14 frontend source.** Its route table covers the six mandated modules, and its proxy targets the backend actually running on `4001`.

### 6.2 Module coverage in source

All six modules are present in `apps/web/src` (Dashboard, Projects, Archive, Finance/IPC, Administration, Audit), with the expected supporting pages (`ProjectDetailsPage`, `ProjectBoqTab`, `ProjectIpcsTab`, `AdminUsersTab`, `AdminProjectsAccessTab`).

---

## 7. Conflict Markers & Compilability

This is the single most consequential finding in the report.

### 7.1 Marker census

| Measurement | Value |
|---|---|
| `git grep -c '^<<<<<<< HEAD' HEAD -- apps/web/src` (sum) | **81 hunks** |
| Files containing markers in `HEAD` | **15** |
| Markers present in the working tree | **79 hunks** |
| Files containing markers in the working tree | **14** |
| `git diff --stat HEAD -- apps/web/src/App.tsx` | **empty** → markers are *committed*, not local edits |

Per-file `HEAD` counts:

| File | Hunks |
|---|---|
| `ArchivePage.tsx` | 17 |
| `MaterialRequestsPage.tsx` | 13 |
| `styles.css` | 10 |
| `DashboardPage.tsx` | 9 |
| `App.tsx` | 7 |
| `ProjectDetailsPage.tsx` | 6 |
| `ProjectsPage.tsx` | 6 |
| `StockPage.tsx` | 4 |
| `ProjectIpcsTab.tsx` | 2 |
| `permissions.ts` | 2 |
| `ui.tsx` | 1 |
| `ItemsPage.tsx` | 1 |
| `WarehousesPage.tsx` | 1 |
| `FinancialsPage.tsx` | 1 |
| `AdminUsersTab.tsx` | 1 |

The working tree is 2 hunks/files cleaner than `HEAD` **only** because `apps/web/src/lib/permissions.ts` was locally cleaned (mtime `2026-11-18 10:27`, the newest file in `src/`). Every other marker is committed upstream.

### 7.2 Runtime proof of non-compilability

Measured against the **live** Vite dev server on `localhost:5173`:

| Request | Result |
|---|---|
| `GET http://localhost:5173/` | **302** → `http://localhost:5173/company-ops-system/` |
| `GET /company-ops-system/` | **200**, 1340 bytes (dev HTML) |
| `GET /company-ops-system/src/main.tsx` | **200**, 4411 bytes |
| `GET /company-ops-system/src/App.tsx` | **500**, 32703 bytes |
| `GET /company-ops-system/src/styles.css` | **200**, 126766 bytes |

The 500 body is a Babel transform error:

```
Unexpected token (57:1)
```

Line 57 of `App.tsx` is the first `<<<<<<< HEAD` marker. **The Phase 14 application cannot be compiled, served, or rendered from source.** Any claim that the Phase 14 UI "runs" must therefore refer to the prebuilt `dist` bundle, not the source.

### 7.3 Process-control significance

A commit containing 81 unresolved conflict hunks **is sitting on `main`** (HEAD `f91ed2f`). This is not a working-tree accident; it is a committed state. It means `main` cannot be built from source by anyone. This should be flagged to the owner independently of the runtime question.

---

## 8. Runtime Process & Port Inventory

### 8.1 Listening ports (measured)

| Port | Listener PID | Owner | Notes |
|---|---|---|---|
| `4001` | `11216` | `node.exe` under `nssm.exe` `10920` → Windows service **`CompanyOpsAPI`** | Express API + static SPA |
| `5173` | `17576` | `node.exe` (Vite CLI) ← `cmd.exe 21120` ← `npm run dev 18852` | Vite dev server, binds `::1` only |
| `5432` | `8220` | `postgres.exe` (service `postgresql-x64-18`) | PostgreSQL **18.4** |
| `5433` | `8248` | `postgres.exe` (service `postgresql-x64-17`) | PostgreSQL 17 instance |
| `4000` | — | **no listener** | refutes "backend default port 4000" |
| `8080` | — | **no listener** | refutes "Vite on 8080" |
| `4173` | — | **no listener** | preview server not running |

Note on `5173`: `Test-NetConnection 127.0.0.1:5173` fails while `Get-NetTCPConnection` shows `::1:5173` listening. This is an IPv6-only bind, not a dead server. An investigator relying on a single IPv4 probe could wrongly conclude the dev server is down.

### 8.2 Windows service definition for the API

| Property | Value |
|---|---|
| Service name | `CompanyOpsAPI` |
| Display name | `Company Operations System` |
| State / Start type | `Running` / `Auto` |
| Start account | `LocalSystem` |
| Dependency | `postgresql-x64-18` |
| `Application` | `C:\Program Files\nodejs\node.exe` |
| `AppDirectory` | `D:\Default Project\company-ops-system\apps\api` |
| `AppParameters` | `--env-file=.env dist\server.js` |
| `AppEnvironmentExtra` | `NODE_ENV=production`, `PORT=4001` |

**The service runs `dist\server.js`** — compiled JavaScript, not TypeScript. This single fact explains nearly every contradiction in this report (§8.5, §11, §13).

### 8.3 Vite process chain

`npm run dev` PID `18852` → `cmd.exe` `21120` → `node ... vite.js` `17576`. Started `2026-11-18 11:08:57`. It is a **developer dev server**, not the production surface.

### 8.4 Log evidence

`apps/api/logs/service-out.log` records:

```
API running on http://localhost:4001
Database migrations are up to date.
Serving web UI from ...\apps\web\dist
```

Each line is technically true **and** misleading: the API is on 4001 (not 4000); "migrations are up to date" means *relative to the stale `dist` migration directory*, which ends at 21; and the served UI is the stale `dist`, not Phase 14 source.

`apps/api/logs/service-err.log` contains a pg Pool crash (`terminating connection due to administrator command`), indicating the connection pool has been severed at least once — relevant to how much weight to give any single `db:true` reading.

### 8.5 Artifact provenance (decisive)

| Artifact | Built / written | Source it should represent | Verdict |
|---|---|---|---|
| `apps/api/dist/server.js` | pre-Phase-14 build | `apps/api/src/server.ts` | **stale** |
| `apps/api/dist/database/migrations/` | contains `001`–`21` only | `src/.../migrations/` has `001`–`24` | **stale** |
| `apps/web/dist/index.html` | `Sun, 11 Oct 2026 08:57:59 GMT` | `apps/web/src` | **stale** |
| `apps/web/dist/assets/index-BdtBinrW.js` | 2026-10-11 11:57:59 local | — | **stale** |
| `apps/web/src/**` | 2026-10-11 12:19 local | — | newer than the bundle |

The `dist` UI was built **before** the current `HEAD` commit and therefore **cannot** contain Phase 14 UI work, regardless of what the source tree says.

---

## 9. Two Live UI Surfaces

Two distinct, simultaneously-live UI surfaces exist. Conflating them is the primary source of confusion in prior reports.

### 9.1 Surface A — stale static bundle on `4001`

| Property | Value |
|---|---|
| URL | `http://127.0.0.1:4001/` |
| Served by | Express static middleware in `apps/api/dist/app.js` (`Serving web UI from ...\apps\web\dist`) |
| Status | **200**, `Content-Length: 1100` |
| Server header | `X-Powered-By: Express` |
| Bundle | `index-BdtBinrW.js` + `index-ByGlVP-t.css` + `workbox-window…js` |
| Asset paths | absolute `/assets/...` → built with `base: '/'`, **not** `/company-ops-system/` |
| Phase 14 markers in bundle | `ipc_items`=0, `import_history`=0, `workflow`=0, `phase14`=0, `Phase 14`=0, `company-ops-system`=0 |
| Module route strings | all six present |

This is the surface a normal operator reaches by opening the app's URL. **It is not Phase 14.**

### 9.2 Surface B — Vite dev server on `5173`

| Property | Value |
|---|---|
| URL | `http://localhost:5173/company-ops-system/` |
| Status | **200** (shell HTML) |
| Compiles `App.tsx`? | **No — 500, Babel `Unexpected token (57:1)`** |
| Proxy | `/api` → `localhost:4001` |

Surface B is the *source* surface. It serves an HTML shell and working modules (`main.tsx`, `styles.css`) but **cannot render the application** because `App.tsx` fails to parse.

### 9.3 Why this matters for the verdict

A verifier who opens `4001` sees a fully working Arabic business application and could mistakenly certify "Phase 14 runtime verified". A verifier who opens `5173` sees a blank/error page. **Neither surface is Phase 14:** one is a pre-Phase-14 build, the other is unbuildable Phase 14 source.

---

## 10. Backend Startup Side Effects

### 10.1 Source of truth: `apps/api/src/app.ts`

`createApp()` executes, **before** building the Express app:

```ts
ensureDataDirectories();
ensureSeedData();
await runMigrations();
```

`apps/api/dist/app.js` contains the **same order** at lines 13–16. Confirmed by direct inspection.

### 10.2 What each step does

| Step | Effect | Mutating? |
|---|---|---|
| `ensureDataDirectories()` | Creates storage directories on disk | **Yes** (filesystem) |
| `ensureSeedData()` | Writes seed rows | **Yes** (DB) |
| `runMigrations()` | Creates `_migrations`, applies pending SQL | **Yes** (DB DDL) |

### 10.3 Additional startup coupling

`apps/api/src/database/connection.ts` **throws** if `DATABASE_URL` is absent — the API cannot start in a null-DB mode. And `/api/health` returns `db:true` via `checkDatabaseConnection()`, which is only:

```ts
const client = await pool.connect();
client.release();
```

**No SQL is executed.** `db:true` therefore proves *an authenticated pooled connection*, not that any query succeeds and not that the expected schema exists. This distinction is material: the DB can be reachable while the Phase 14 schema is entirely absent (which is exactly the case — §13).

### 10.4 Decision and consequence

Backend startup is **proven mutating** on three axes. Starting it would have violated the mandate in at least three ways and would have silently applied (or attempted) migrations/seed writes.

**The backend was not started and was not restarted.** All API evidence in this report comes from the **already-running** `CompanyOpsAPI` service and its already-compiled `dist`, which is precisely the artifact whose staleness invalidates the Phase 14 claim.

---

## 11. Configuration & Feature Flags

### 11.1 `VITE_PROTOTYPE` — the claim vs the fact

| Claim (prior reports) | Fact |
|---|---|
| "`VITE_PROTOTYPE` defaults to false per `vite.config.ts` line 41" | `vite.config.ts` contains **no** `VITE_PROTOTYPE` at all |
| Flag governs fixture vs http adapter selection in the Phase 14 app | Flag does not exist in `apps/web` |

Measured sweep, restricted to `apps/web` and excluding `node_modules`:

```
pattern: VITE_PROTOTYPE|import.meta.env|IS_PROTOTYPE|cos-proto|PROTOTYPE
path:    apps/web
result:  No matches found
```

Repo-wide, `VITE_PROTOTYPE` occurs **only** under `docs/frontend-rebuild/phase-13` and `docs/frontend-rebuild/phase-03-prototype`. In Phase 13 it is genuinely meaningful:

```ts
// docs/frontend-rebuild/phase-13/app/src/services/api/configuration.ts:13-17
export const FIXTURE_MODE = import.meta.env.VITE_PROTOTYPE === '1';
export const IS_PROTOTYPE = FIXTURE_MODE;
```

with an explicit comment that `'http'` "is the DEFAULT when the flag is absent". That is a real, well-designed gate — **in Phase 13**. It was carried into a Phase 14 report as if it governed `apps/web`. It does not.

**Consequence:** the Phase 14 app has **no fixture/prototype transport at all**. `apps/web/src/lib/api.ts` is unconditionally HTTP: it talks to relative `/api/*` with `credentials: 'include'`, silent refresh on 401, and a force-logout event on refresh failure. There is no mock adapter to accidentally enable and no flag to disable.

### 11.2 Environment files present

| File | Keys |
|---|---|
| `.env` (root) | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` |
| `.env.example` (root) | same three keys |
| `apps/api/.env` | `DATABASE_URL`, `PORT=4001`, `JWT_SECRET` |
| `apps/api/.env.example` | `DATABASE_URL` |
| `apps/web/.env` | **does not exist** |
| `apps/web/.env.example` | **does not exist** |

No secret values are reproduced in this report. The only credential used was the local development credential already present in `apps/api/.env`, read in-process and never printed.

### 11.3 Ports — claim audit

| Claim | Fact | Evidence |
|---|---|---|
| Backend default **4000** | **4001** | `dist/server.js`: `Number(process.env.PORT ?? 4001)`; NSSM `AppEnvironmentExtra PORT=4001`; nothing listening on 4000 |
| Vite **8080** | **5173** | `vite.config.ts` `server.port: 5173`; listener `::1:5173` |
| Preview **4173** | 4173 configured but **not running** | no listener |
| Proxy target **4001** | **correct** | `vite.config.ts`; API listening on 4001 |

---

## 12. Database Identity

### 12.1 The ambiguity

Two PostgreSQL instances listen locally: **5432** (service `postgresql-x64-18`) and **5433** (service `postgresql-x64-17`). The repository root `.env` mentions `POSTGRES_*`, but the **runtime authority** is `apps/api/.env`, and the NSSM service loads exactly that file (`--env-file=.env`).

`apps/api/.env` `DATABASE_URL` resolves to: user `cos`, host `localhost`, port **5432**, database `cos_db`.

### 12.2 Identity proven by login, not by port

| Probe | Result |
|---|---|
| `psql` login to `localhost:5432/cos_db` as `cos` | **success** |
| `SELECT current_database(), current_user, inet_server_port(), version()` | `cos_db \| cos \| 5432 \| 18.4` |
| `psql` login to `localhost:5433/cos_db` as `cos` (both candidate passwords) | **`password authentication failed for user "cos"`** |

**Determination:** the database the API actually uses is **PostgreSQL 18.4 on port 5432**, database `cos_db`, user `cos`. The `5433` instance is a *different* cluster in which the `cos` role's credential does not match — its contents are therefore **unverified** and irrelevant to this runtime.

The service dependency `DEPENDENCIES: postgresql-x64-18` independently corroborates this: the API service declares that it depends on the **18** cluster.

### 12.3 Refutation

Prior WP3 report header states: *"Isolated PostgreSQL 17 at 127.0.0.1:5433, cos_db"*. That is **false for the running API**. A second prior report attributes 5433 to a "Docker mapping" — **Docker is not installed on this machine** (`docker: not recognized`), so that explanation is fabricated.

### 12.4 Read-only content sample (establishing that the DB is real and populated)

| Metric | Value |
|---|---|
| Public tables | **27** |
| `projects` | **29** |
| `users` | **6** |
| `audit_logs` | **2039** |
| `ipcs` | **9** |
| `ipc_items` | **0** |
| `import_history` | **1** |

All obtained via `SELECT count(*)` only.

---

## 13. Migration & Schema State

### 13.1 Ledger

`_migrations` table:

| Property | Value |
|---|---|
| Row count | **19** |
| Highest applied migration | **`21_direct_amounts.sql`** |
| Applied at | 2026-10-04 02:08:35 -07 |

### 13.2 Why 22–24 are missing — and it is *not* an error

`apps/api/src/database/migrate.ts` reads migrations from:

```ts
const migrationsDir = path.join(__dirname, 'migrations');
```

`__dirname` resolves **relative to the executing file**, i.e. `apps/api/dist/database/`. The `dist` migration directory contains **only `001`–`21`**. Therefore `runMigrations()` correctly reports "up to date" — **up to date with a directory that predates Phase 14**.

| Location | Migrations present |
|---|---|
| `apps/api/src/database/migrations/` | `001`–`21` **plus** `22_phase14_core_columns.sql`, `23_phase14_ipc_workflow.sql`, `24_phase14_recovery_import_tables.sql` (dated 2026-11-17, **untracked**) |
| `apps/api/dist/database/migrations/` | `001`–`21` only |

### 13.3 Schema proof that Phase 14 DDL has never run

`22_phase14_core_columns.sql` declares (excerpt):

```sql
ALTER TABLE users    ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE users    ADD COLUMN IF NOT EXISTS title VARCHAR(100);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users ...;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS project_id ...;
```

Live database inspection:

| Expected (if 22–24 applied) | Present in DB |
|---|---|
| any `deleted_at` column | **none anywhere** |
| any `deleted_by` column | **none anywhere** |
| any `cancel_reason` column | **none anywhere** |
| `users.department`, `users.title` | **absent** |
| `audit_logs.project_id` | **absent** |

`ipcs` columns are only: `id, project_id, ipc_number, date, status, notes, net_amount, created_at, updated_at, deductions, gross_amount` — i.e. the pre-workflow shape, with **no** `submitted_at`/`approved_at`/`cancel_reason`.

### 13.4 Build-vs-source discriminator

The cleanest single test of "is the running API Phase 14 or pre-Phase 14":

| Marker count | `dist/` (running) | `src/` (current) |
|---|---|---|
| `project.repository` `deleted_at` refs | **0** | **6** |
| `ipc.repository` `workflow` refs | **0** | **1** |
| `audit.service` `deleted_at` refs | **0** | (present in source) |

**The running API cannot be Phase 14.** It has no knowledge of soft-delete, IPC workflow, or audit project scoping.

### 13.5 Consequence

Even if the frontend *could* be built and served, it would issue Phase 14 queries against a database with **no `deleted_at` columns**. Every soft-delete-filtered query would raise `column ... does not exist`, producing HTTP 500s. The Phase 14 chain is broken *at the schema layer* independently of the frontend and backend build faults.

---

## 14. API Reachability & Auth Boundary

### 14.1 Reachability

| Probe | Result |
|---|---|
| `GET http://127.0.0.1:4001/api/health` | **200** `{"ok":true,"db":true}` |

Interpretation per §10.3: the process is up, and *a pooled connection* exists. **No query is proven.**

### 14.2 Unauthenticated data endpoints — all correctly gated

| Endpoint | Status |
|---|---|
| `GET /api/projects` | **401** |
| `GET /api/audit-logs` | **401** |
| `GET /api/warehouses` | **401** |
| `GET /api/items` | **401** |
| `GET /api/stock` | **401** |
| `GET /api/material-requests` | **401** |
| `GET /api/users` | **401** |
| `GET /api/config` | **401** |

Uniform body: `{"message":"يجب تسجيل الدخول"}`.

This is a **positive** security finding: no data endpoint leaks without authentication. The auth boundary is real and enforced server-side.

### 14.3 Route map (read-only inspection)

`apps/api/src/routes/index.ts` registers `/auth` as the **only** public router; every other router applies `requireAuth` at router level (e.g. `projectsRouter.use(requireAuth)`). Auth middleware accepts a Bearer token **or** the `cos_access` HttpOnly cookie. Authorization is re-resolved from DB per request (`loadContext`/`can`), deliberately ignoring a client-supplied permissions snapshot.

The specific endpoint used to prove DB-backed reads is `/api/audit-logs`, which chains `requirePermission('audit.view')` → `auditService.list()` → `SELECT COUNT(*)::int AS total FROM audit_logs` + `SELECT * FROM audit_logs` (lines 187–189 of `audit.service.ts`). **This is a genuine SQL-backed read**, not a cache.

### 14.4 What the 401 wall proves and does not prove

It proves: auth enforcement works; the server parses routes; the process is responsive.

It does **not** prove: DB-backed reads work for Phase 14 shapes; the Phase 14 permission names exist; any six-module endpoint returns Phase 14 data. Those require authenticated reads (§15).

### 14.5 Auth methods — this session's posture

`authRouter` exposes `POST /login`, `POST /refresh`, `POST /logout`, `GET /me`. This session issued **none** of the `POST`s by policy (§3.1) and therefore never held a session. All authenticated observations in §15 came from the pre-existing browser session described there.

---

## 15. Browser Runtime & Seven-State Matrix

### 15.1 Tab under observation

| Property | Value |
|---|---|
| Tab ID | `tab_82143bbc-85cb-4135-9b97-df0e554a6314` |
| Surface | `http://127.0.0.1:4001/` (Surface A, stale static bundle) |
| Generation at end of session | **3** |

### 15.2 Initial observation (unauthenticated)

- **DOM:** login shell — heading `نظام إدارة الشركة`, a **disabled** button `تسجيل الدخول`.
- **Console:** three errors, all 401.
- **Network:** `POST /api/auth/refresh` → 401; `GET /api/auth/me` → 401; `POST /api/auth/refresh` → 401.

This is correct behaviour for a cold, unauthenticated load of the app: attempt silent refresh, fail, fall back to login.

### 15.3 Subsequent observation — an authenticated session appeared

Without any action by this session, the tab reached generation 3 at:

```
http://127.0.0.1:4001/projects/e8216dc4-51d7-4fd7-8dc8-d79f7f1fd794
```

and its network history contained a **successful login** followed by authenticated reads:

| Method | Status | Endpoint |
|---|---|---|
| `POST` | **200** | `/api/auth/login` |
| `GET` | 200 | `/api/material-requests` |
| `GET` | 200 | `/api/notifications` |
| `GET` | 200 | `/api/projects?pageSize=1` |
| `GET` | 200 | `/api/documents?pageSize=1` |
| `GET` | 200 | `/api/warehouses?pageSize=1` |
| `GET` | 200 | `/api/items?pageSize=1` |
| `GET` | 200 | `/api/stock/overview` |
| `GET` | 200 | `/api/documents?pageSize=5&sortBy=updatedAt&sortDir=desc` |
| `GET` | 200 | `/api/stock/history?pageSize=6` |
| `GET` | 200 | `/api/projects?page=1&pageSize=10` |
| `GET` | 200 | `/api/projects/e8216dc4-…` |
| `GET` | 200 | `/api/sites?projectId=e8216dc4-…` |
| `GET` | 200 | `/api/documents?projectId=e8216dc4-…&pageSize=50` |
| `GET` | 200 | `/api/warehouses?projectId=e8216dc4-…` |
| `GET` | 200 | `/api/stock/history?projectId=e8216dc4-…&pageSize=50` |
| `GET` | 200 | `/api/items?pageSize=200` |

Rendered DOM at generation 3: full Arabic application shell with sidebar (`لوحة التحكم`, `المشاريع`, `المقايسات والمستخلصات`, `الأرشيف`, `المخازن`, `الأصناف`, `المخزون`, `طلبات المواد`, `الإدارة`, `سجل التغييرات`, `الإعدادات`) and project tabs `المواقع (0)`, `المستندات (3)`, `المخازن (0)`.

### 15.4 Attribution — stated plainly

**This session did not perform that login.** No `POST` was issued by this session (§3.1). There is no auto-login or embedded-credential logic in the source (`LoginPage.tsx` calls `login(...)` only on form submit) and the bundle contains exactly **one** `/api/auth/login` occurrence with **zero** credential-looking strings.

The login was performed by an **unattributed external actor** (most plausibly the machine's user interacting with the shared browser tab). Its origin cannot be established from the evidence available, and this report does not speculate further.

It did, however, produce a **real database mutation**: `audit_logs` gained a row at `2026-11-18 01:35:21.793-08` with `action='login'`, `entity='user'`, `entity_id='cbb26cb7-0ec0-4f6a-be16-993dab47057e'`. The previous newest row was `2026-11-02`. So a write occurred during the verification window — **not by this session**.

### 15.5 Seven-state matrix

Each state is reported separately, as mandated. "This session" means evidence observed/produced by the verifier; "observed" means visible but externally produced.

| # | State | Result | Basis | Attribution |
|---|---|---|---|---|
| 1 | **Source identified** | **VERIFIED** | `apps/web` = Phase 14 (route table, proxy→4001, React 19/Vite 7); `index.html:21`→`main.tsx` | This session |
| 2 | **Server started** | **VERIFIED (pre-existing)** | `CompanyOpsAPI` (PID 11216) + Vite (PID 17576) already running; **not started by this session** | This session observed; processes pre-date session |
| 3 | **Browser rendered** | **VERIFIED** | Tab snapshot shows full Arabic app shell at `127.0.0.1:4001` | This session (tab was pre-existing) |
| 4 | **API reachable** | **VERIFIED** | `/api/health` 200; all 8 data GETs 401 (auth wall alive) | This session |
| 5 | **DB connected** | **VERIFIED** | `db:true` (pooled connect) **plus** direct read-only `psql` login succeeding as `cos` to `cos_db` on 5432/18.4 | This session |
| 6 | **DB-backed GET verified** | **OBSERVED (external actor)** | 15+ authenticated `GET 200`s including `/api/audit-logs`-class SQL reads; requires the external login | **External actor** — not this session |
| 7 | **UI round trip verified** | **OBSERVED (external actor)** | DOM `المستندات (3)` / `المواقع (0)` / `المخازن (0)` matches DB `documents=3, sites=0, warehouses=0` for project `e8216dc4-…` | **External actor** — not this session |

### 15.6 Round-trip cross-check (the one genuinely strong positive)

| Value | UI (rendered) | Database (`SELECT count(*)`) | Match |
|---|---|---|---|
| Project name | `إنشاء مول تجاري مبني رقم (B03) مشروع RAVILLE` | same | ✅ |
| Documents | `المستندات (3)` | `documents = 3` | ✅ |
| Sites | `المواقع (0)` | `sites = 0` | ✅ |
| Warehouses | `المخازن (0)` | `warehouses = 0` | ✅ |

This is a **true UI → API → PostgreSQL → UI round trip**. It is *not* attributable to this session, and it ran against the **stale pre-Phase-14** stack (old bundle, old API build, pre-Phase-14 schema). It proves the *pipeline works*. It does **not** prove *Phase 14 works*.

### 15.7 State 6/7 explicit scope statement

> States 6 and 7 are **OBSERVED**, not verified by this session, and they apply **exclusively to the pre-Phase-14 `dist` stack** (bundle `index-BdtBinrW.js`, API `dist` build ≤ migration 21). They must not be read as Phase 14 verification.

### 15.8 Contamination excluded

Other browser tabs, none of which are Phase 14 and none of which contributed evidence:

| Tab URL | Nature |
|---|---|
| `http://localhost:5203/projects` | unrelated server |
| `http://localhost:5204/projects/p1/financials` | unrelated server |
| `http://localhost:5204/` | unrelated server |
| `file:///.../phase-03-prototype/dist-phase10/index.html` | Phase 03 prototype build |

---

## 16. Phase H Skills, Claim Audit, Verdict & Owner Actions

### 16.1 Phase H — Discovered / Read / Applied (recorded separately, as required)

| Skill | Discovered | Read | Applied | Honest note |
|---|---|---|---|---|
| Systematic debugging / root-cause analysis | Yes | Yes | **Applied** | Used falsification-first diagnosis: symptom (500 on `App.tsx`) → Babel parse error → committed conflict hunks; and symptom ("up to date") → `__dirname` resolution → stale `dist` migrations |
| Backend architecture review | Yes | Yes | **Applied** | Traced `createApp()` side-effect order; established `/api/health` runs no SQL; mapped router-level auth gates |
| Database architecture / identity review | Yes | Yes | **Applied** | Distinguished two PostgreSQL clusters by service dependency + authenticated login rather than port; proved schema absence by `information_schema` |
| Browser runtime testing (DOM/console/network) | Yes | Yes | **Applied** | Captured snapshots, console 401s, full `/api` network ledger, and a DOM↔DB count cross-check |
| Build/artifact provenance analysis | Yes | Yes | **Applied** | mtime comparison of `dist` vs `src`; marker-string census inside the shipped bundle |
| Accessibility (WCAG/axe) auditing | Yes | No | **Not applied** | Out of scope for a runtime-path verification |
| Performance profiling | Yes | No | **Not applied** | Out of scope |
| Git workflow/remediation | Yes | No | **Not applied** | Prohibited by mandate (no conflict resolution, no commits) |

No skill is claimed as "applied" unless its method actually shaped the evidence above.

### 16.2 Claim audit — every premise tested, with refutations

| # | Claim submitted | Independent finding | Status |
|---|---|---|---|
| 1 | `apps/web` holds Phase 14 | Correct — source is Phase 14, route table covers six modules | ✅ **CONFIRMED** |
| 2 | PostgreSQL **17** at `127.0.0.1:5433`, `cos_db` | Running API uses **PostgreSQL 18.4 @ 5432**; `5433` rejects `cos` auth; service depends on `postgresql-x64-18` | ❌ **REFUTED** |
| 3 | Backend default port **4000** | **4001** (`dist/server.js` default + NSSM env); nothing on 4000 | ❌ **REFUTED** |
| 4 | Prior Vite proxy target **4001** | Correct | ✅ **CONFIRMED** |
| 5 | Prior Vite port **8080** | **5173** (`vite.config.ts` + listener `::1:5173`) | ❌ **REFUTED** |
| 6 | `VITE_PROTOTYPE` defaults false | Flag **does not exist** in `apps/web` (0 occurrences); lives only in Phase 13 / Phase 03 docs apps. The "`vite.config.ts` line 41" citation is fabricated | ❌ **REFUTED** |
| 7 | Backend startup auto-runs `ensureDataDirectories()`, `ensureSeedData()`, `runMigrations()` | Correct, in exactly that order, in both `src/app.ts` and `dist/app.js` | ✅ **CONFIRMED** (and is why startup was forbidden) |
| 8 | `apps/web/src/App.tsx` contains merge-conflict markers | Correct — 7 hunks in `App.tsx`; 81 hunks / 15 files repo-wide in `HEAD`; live Vite 500 at `57:1` | ✅ **CONFIRMED** |
| 9 | (Prior report) "Docker mapping 5433:5432" | **Docker is not installed** (`docker: not recognized`) | ❌ **REFUTED** |
| 10 | (Prior report) "PASS WITH LIMITATIONS" on Phase 14 integration | Round trip occurred only on **pre-Phase-14 stale artifacts**; migrations 22–24 unapplied; source non-compilable | ❌ **REFUTED** |

### 16.3 Why the verdict is not one of the "clean" options

| Candidate verdict | Why rejected |
|---|---|
| `FULL READ-ONLY RUNTIME ROUND TRIP VERIFIED` | The round trip was (a) on stale pre-Phase-14 artifacts, (b) executed by an unattributed external actor, (c) against a schema lacking all Phase 14 columns. It is not controlled, not Phase 14, and not attributable to this session. |
| `FRONTEND RUNTIME VERIFIED — BACKEND ROUND TRIP NOT VERIFIED` | Understates the evidence: an authenticated backend round trip *was* observed. Also mislabels Surface A as "frontend verified" when the Phase 14 frontend does not compile. |
| `FRONTEND SOURCE IDENTIFIED — RUNTIME NOT VERIFIED` | Understates the evidence: runtime *was* verified at states 1–5, and states 6–7 were observed. |
| `VERIFICATION BLOCKED BY STARTUP SAFETY` | Startup was indeed blocked and that is a real constraint, but it is not the whole picture — the environment was reachable, measurable, and partially exercised. |
| `VERIFICATION BLOCKED BY ENVIRONMENT` | False: the environment was not unreachable. It was reachable and *contradictory*. |
| **`CONTRADICTORY EVIDENCE — OWNER REVIEW REQUIRED`** | **Correct.** A real round trip exists but is not Phase 14; prior reports assert environment facts that are demonstrably false; the source is unbuildable while a stale build serves traffic. Only the owner can adjudicate which artifact is intended to be "Phase 14". |

### 16.4 Verdict

# `CONTRADICTORY EVIDENCE — OWNER REVIEW REQUIRED`

### 16.5 Owner actions required (this session fixes nothing)

Ordered by consequence. None of these were performed — all are prohibited for this session.

1. **Resolve the 81 committed conflict hunks on `main`.** `main` currently cannot be built from source by anyone. Until this is done, no Phase 14 build can exist.
2. **Decide which artifact is "Phase 14".** Today there are three distinct things called the app: unbuildable Phase 14 source, a pre-Phase-14 `dist` bundle on 4001, and a broken dev server on 5173. The owner must designate the authoritative one.
3. **Rebuild the API** (`apps/api/dist`) so the service runs Phase 14 code, and confirm `copy-migrations.cjs` ships migrations 22–24 into `dist/database/migrations` — otherwise `runMigrations()` will *again* report "up to date" while skipping them.
4. **Apply migrations 22–24** in a controlled, owner-approved step (they are untracked, so they will not survive a clean checkout until committed).
5. **Restart the `CompanyOpsAPI` service only after** the build contains 22–24, and reconcile the startup side effects (`ensureSeedData`) with the production data set.
6. **Investigate the unattributed login** at `2026-11-18 01:35:21.793-08` (`cbb26cb7-…`). Confirm whether it was a legitimate operator action. This session performed zero writes; one `login` audit row was created by someone else during the window.
7. **Correct the prior WP3 reports.** `WP3_INDEPENDENT_VERIFICATION_REPORT.md` and `WP3_STARTUP_VERIFICATION_REPORT.md` contain refuted environment facts (PG17@5433, API 4000, Vite 8080, `VITE_PROTOTYPE` at `vite.config.ts:41`, Docker mapping). They should be marked superseded rather than left as authoritative.
8. **Bind Vite to a predictable address.** `5173` listens on `::1` only; IPv4-only probes report it down.

### 16.6 What *is* trustworthy today

So the owner can separate signal from noise:

- ✅ Auth enforcement is real and uniform (8/8 data endpoints 401 unauthenticated).
- ✅ The UI → API → PostgreSQL → UI pipeline mechanically works (DOM counts match DB counts exactly, on the stale stack).
- ✅ `apps/web` is genuinely the Phase 14 source, and it has **no** fixture/prototype transport — it is HTTP-only by construction.
- ✅ Git state is untouched by this session (HEAD unchanged, 0 staged, 46 porcelain entries).
- ❌ Nothing about Phase 14 *itself* is runtime-verified, and it cannot be until §16.5 items 1–5 are done.

---

**End of report.** Single file created by this session:
`docs/frontend-rebuild/phase-14/phase-14c/WP3_RUNTIME_VERIFICATION_REPORT.md`
