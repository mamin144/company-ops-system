# Phase 13 — Implementation Record R-142

Status: **Owner-direction record + first implementation slice.** Baseline: HEAD `f91ed2f9` on branch `main`, working tree preserved (24 modified + 3 untracked).

---

## 1. Owner direction recorded (2026-11-09 authorization)

- **Phase 12 is bypassed as a blocker** for beginning Phase 13 frontend implementation. This is an owner bypass, **not a PASS**.
- **Condition 1 remains historically `NOT MET`.** Previous Phase 12 results (R-140, R-141 addendum) are not rewritten or falsified; they stand as recorded.
- The owner does not want another Phase 12 testing or documentation cycle before frontend implementation begins.
- **Phase 13 frontend implementation is now authorized to begin locally.**
- This authorization does **not** authorize production deployment or destructive operations against existing databases.

The Recovery Evidence Gate and the separate database/restore authorizations remain outstanding for any future operations that would need them. This frontend authorization is not used to infer permission for those.

## 2. Scope of this execution

- First coherent frontend vertical slice, implemented end-to-end as working application code (not a proposal, report, or disconnected mockup).
- UI/UX source: the approved light-theme, compact SaaS, professional operations-console direction carried in the Phase 3 prototype (FINAL-ACCEPTANCE: PASS WITH LIMITATIONS for UX/design approval). No new visual direction is invented. Arabic default + English; RTL and LTR both correct.
- Stack preserved: React + TypeScript + Vite.
- Backend/API boundaries respected: no changes to `apps/api`, no production API behavior changes, no database schema/record changes, no migrations against existing databases, PostgreSQL 17 (5433) untouched, PG18 databases preserved.
- Working tree preserved exactly; no git writes of any kind.

## 3. First slice architecture

- New self-contained app under `docs/frontend-rebuild/phase-13/app/` carrying the approved prototype source forward.
- New real HTTP adapter (`src/services/api/adapters/http/`) implementing the same `ApiAdapter` surface, selected by env (`http` opt-in); the fixture adapter remains dev-only behind `VITE_PROTOTYPE=1` with its existing import-time throw guard.
- Real session flow replaces the demo role picker: login / me / logout / silent-refresh per the verified legacy contract (`POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/refresh`, `POST /api/auth/logout`; access token via `Authorization: Bearer` with `cos_access` cookie fallback; refresh cookie `cos_refresh`; 401 TOKEN_EXPIRED → refresh → retry once).
- Domains not wired in this slice stay type-checked but fail explicitly with a "not wired yet" error — recorded in the final report, never silently mocked.

Detailed results, validation, and unfinished-work list are delivered in the execution's final response.

## 4. Validation (added during execution, 2026-11-17)

- **Type check:** `tsc --noEmit` on the app tsconfig — **clean** (exit 0), re-run after all edits.
- **Isolation probe re-run after code changes:** both cases pass (`ISOLATION-OK` — fixture-mode bundle throws at import as designed; `ISOLATION-HTTP-OK` — http-mode bundle selects `adapterMode=http`).
- **Production builds:** both builds compile (`vite build` fixture-mode and http-mode; the 707 kB chunk-size warning is pre-existing/benign). Note the Phase-13 isolation contract: a **production fixture build compiles but is blocked at import time by the adapter guard** — the fixture demo and the fixture test suite must run on the **dev server** (`vite` with `VITE_PROTOTYPE=1`), never on a prod preview of a fixture dist. Running the suite against a fixture prod dist made every page boot-fail (guard throw, nothing rendered) — that misconfiguration, not app logic, was the cause of the first all-timeout runs; corrected to the dev server.
- **Boot check (fixture dev server, :5199):** redirects to `/login`, Arabic RTL demo login renders, console clean (only vite HMR/React-DevTools info).
- **One code fix surfaced by the suite under the dev server (StrictMode):** `ProjectWorkspace`'s load effect was double-invoked on mount; the first run consumed the one-shot injected failure (`failNext('project')` persists via sessionStorage) while its error was discarded behind the `if (on)` guard, and the second run succeeded — the forced-error panel never appeared (test P2-02, workspace section). The prototype never hit this because its suite ran on a prod preview, where StrictMode does not double-invoke effects. Fix: the load effect now deduplicates per `(project, retry, actor)` key (StrictMode's second run is skipped as the same logical load) and stale/superseded runs are discarded by key instead of the `on` flag; the error state is no longer swallowed by remount. `src/features/projects/components/ProjectWorkspace.tsx` only; no behavioral change outside this effect.
- **First full-suite run (dev server): 321/322 passed, 1 failed** — `remediation-p1.spec.ts` "truly empty list (after local deletes) shows the generic empty". Cause was in the Phase-13 async rework of `Projects.tsx`, not the dev-server environment: the prototype computed the membership-empty vs truly-empty distinction by re-querying the adapter synchronously at render time (`mrApi.projects(user?.id).length === 0`), which reads the adapter's seed — untouched by the demo's local-only deletes — so a locally emptied list still resolved as "not membership-empty" and showed the generic empty. The rework's `scopedEmpty = rows.length === 0` accidentally merged the two truths (local deletes now emptied `rows` too, so a locally emptied admin list showed the scoped/no-membership message). Fix: the load captures what the authority (adapter/server) reported for the identity's scoped list (`serverEmpty`), and `scopedEmpty` reads that captured truth — semantics identical to the prototype over an async transport; creates/edits already re-fetch, so they update it. `src/features/projects/components/Projects.tsx` only. Re-verified: full `remediation-p1.spec.ts` 28/28 passed; `tsc --noEmit` clean; isolation probe re-passed after the adapter-adjacent edits.
- **Final full-suite verdict (dev server, chromium, 1 worker): 322/322 PASSED in 15.2m, zero failures, zero flakes.** Exit code 0. Both suite-internal code fixes above (StrictMode dedup in `ProjectWorkspace`, captured `serverEmpty` truth in `Projects`) are covered by this verdict. Classification of the whole validation scope: all 322 tests are fixture-mode frontend scope; there are **no pre-existing failures in this scope** — the only failures observed were the two above, both Phase-13-async-rework regressions surfaced by running the suite under a dev server (StrictMode), both fixed and re-verified. (Separately: 18 files under `apps/api/src/**` contain unresolved merge-conflict markers — pre-existing, untouched, out of scope.) One-off diagnostic `verify/boot-diag.mjs` was deleted after use; the fixture dev server was stopped.
