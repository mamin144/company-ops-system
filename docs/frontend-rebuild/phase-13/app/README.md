# Phase 13 — Frontend implementation (real session + Projects vertical)

Working frontend code, not a proposal. It carries the approved Phase 3–11
prototype forward into a self-contained app that can run against the real
backend over HTTP (http mode, default) or as the frozen interactive demo
(fixture mode).

## Run locally

Run from the **repository root** (the app has no own `node_modules`; React/Vite
resolve upward from the workspace).

**Fixture mode (interactive demo, no backend, port 5199):**

```powershell
cd docs\frontend-rebuild\phase-13\app
$env:VITE_PROTOTYPE = '1'
node ..\..\..\..\node_modules\vite\bin\vite.js
```

The fixture verification suite (`verify/*.spec.ts`) must also run against this
**dev server** (same command above, then Playwright with `-c verify/pw.config.ts`).
A production build with `VITE_PROTOTYPE=1` compiles but is blocked at import
time by the adapter's isolation guard by design — serving such a dist makes
every page boot-fail.

**HTTP mode (real backend, default when the flag is absent):**

```powershell
cd docs\frontend-rebuild\phase-13\app
node ..\..\..\..\node_modules\vite\bin\vite.js
```

`/api/*` requests are proxied to the backend at `http://localhost:4001`
(override the proxy target with `VITE_API_PROXY_TARGET`). The backend must be
started separately by its owner — this phase never starts it, because the API
startup runs migrations/seed against an existing PostgreSQL database.

## Transports (`src/services/api/configuration.ts`)

| `VITE_PROTOTYPE` | `API_MODE` | Adapter |
| --- | --- | --- |
| `1` | `fixture` | isolated mock adapter (`adapters/mock/`) |
| absent | `http` (default) | real adapter (`adapters/http/`) |

Both satisfy the same `ApiAdapter` surface; unwired HTTP domains fail
**explicitly** ("not wired yet") instead of silently falling back to fixtures.

## What is wired in slice 1

- **Real session** — credential login (`POST /api/auth/login`), restore on
  mount (`GET /api/auth/me` with silent refresh on 401), logout (revokes this
  device's session), force-logout eviction when the refresh cookie is dead.
  Access token lives in memory + sessionStorage, never in localStorage.
- **Projects vertical** — `GET /api/projects` (paged, `pageSize=1000`,
  server-scoped to the caller's membership), `POST /api/projects`
  (`projects.create`), `PUT /api/projects/:id` (partial patch). Row aliases:
  mock `code/name/contractNo` ↔ backend `projectCode/projectName/contractNumber`.
- Client-side name caches (`itemName/whName/projName`) seeded from loaded data;
  unknown ids render as the raw id — never an invented name.
- `can()` reads the permission list the server returned; project scoping is
  enforced server-side per request.

## Genuinely unfinished (by design)

- Every other domain (MRs/archive/inventory/financials/admin/reports/users)
  is **not wired** in http mode — those screens fail explicitly.
- Dashboard (Home) stays fixture-only this slice; there is no overview endpoint.
- Projects delete is local-only (the backend contract was not exercised);
  the ConfirmDialog keeps its demo behavior.
- Runtime mock-data constants (`STATUS_TONE`, `ERR_KEYS`) are still imported
  from `adapters/mock/data` by unmigrated screens — constants only, documented
  boundary wart.
