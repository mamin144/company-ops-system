# COS v2 — Direction D Interactive Prototype (Phase 3, isolated)

**Isolation contract (do not break):**
- Lives entirely under `docs/frontend-rebuild/phase-03-prototype/`. Never imported by `apps/*`.
- **Mock data only** (`src/services/api/adapters/mock/`). No fetch/XHR calls exist in this app — verify with a network-tab check.
- No backend/DB/auth/API contact. No secrets. No production data.
- `src/services/api/adapters/mock/api.ts` throws on import unless dev/preview of this prototype (`VITE_PROTOTYPE` guard).
- Reuses already-installed root `node_modules` binaries (react, react-router-dom, vite, typescript) by Node upward resolution. **No installs, no manifest/lockfile changes.**
- No commits, no pushes, no merges by the agent.

**Run (from `docs/frontend-rebuild/phase-03-prototype/`, read-only for the rest of the repo):**
- Dev: `node ../../../node_modules/vite/bin/vite.js` (port 5199)
- Preview a production build: `node ../../../node_modules/vite/bin/vite.js build` then `... vite.js preview` (port 5199).
  Prototype builds MUST set `VITE_PROTOTYPE=1` first (e.g. `$env:VITE_PROTOTYPE='1'`) so the
  mock-adapter isolation guard passes; without it the bundle refuses to boot by design.

**Failure injection (prototype-only, off by default, no UI surface):**
- In the browser console (or a test): `__protoTestHooks.failNext('<op>', '<message?>')` where
  `<op>` is one of `project | documents | mrs | overview | sites`. The next call of that
  operation throws instead of resolving; the flag is one-shot (consumed on use, and it
  survives exactly one page reload via a `sessionStorage` marker so reload-triggered
  fetches can be failed).
- `__protoTestHooks.clear()` removes all armed failures. Available only in prototype
  builds (`VITE_PROTOTYPE=1`); absent from any other bundle. Screens with loaders
  (Home, Archive, Requests, project workspace) show an error panel with a retry button.
- Typecheck: from repo root, `node node_modules/typescript/bin/tsc -p docs/frontend-rebuild/phase-03-prototype/tsconfig.json --noEmit`

**Structure (Phase 4 foundation — feature-oriented modular architecture, behavior unchanged):** `src/main.tsx` mounts `src/app/bootstrap.tsx` (providers + app-level `ErrorBoundary`) · `src/app/router.tsx` (route tree + per-route permission `Guard`) · `src/app/` (layouts: Shell/CommandPalette · boundaries: ErrorBoundary + 404/403 states · pages: Login/Settings/Search/Notifications) · `src/features/` (dashboard · projects · archive · inventory · requests · reports · administration — screens only, each with a public `index.ts`) · `src/shared/` (ui: design-system core + icons + ContextualExport · lib: motion/files · styles) · `src/services/api/` (facade = the single adapter boundary; current adapter = in-memory mock under `adapters/mock/`) · `src/i18n/` (ar/en dicts, direction, provider; persisted `cos-proto-lang`, `t(key, vars)` fills `{token}` placeholders) · `src/app/providers/auth.tsx` (demo role picker, mock perms).

**Archive document operations (Phase 3.4, mock-only):**
- Viewer is text/layout-shaped mock content. **No PDF/image decoding** — no rendering library was added, so unsupported types (e.g. DWG) and documents without recorded content get an explicit fallback instead of a blank pane.
- Replace keeps the previous version in the revision timeline and bumps the label from the previous counter (`v00 → v01`); an approved document returns to *submitted* (rule read from the audited backend contract, not invented).
- Links are one-directional (`a.links → b`). Duplicate/self/invalid targets are rejected in the mock adapter; already-linked documents stay visible-but-disabled in the picker so the prevention is observable.
- CSV import is browser-only (`FileReader`, UTF-8, ≤200 data rows, own parser — no library). Duplicate detection keys on **document number** and is a prototype rule, not a claimed backend constraint. No transaction guarantees: valid rows are added, invalid/duplicate rows are reported per row.

**Verification (all output to OS temp, never repo `test-results/`):**
`node "<repo-root>/node_modules/@playwright/test/cli.js" test -c verify/pw.config.ts --reporter=list`
Start the preview manually first (see above, port 5199); the config has no `webServer` block on purpose. Current suite: **264 tests / 15 files** — a11y 7 · admin 7 · archive 12 · coverage 9 · exports 19 · financials 15 · i18n 8 · inventory 14 · motion317c 14 · motion317d 6 · regression 4 · remediation-p1 24 · remediation-p2p3 62 · stock 8 · **phase4 5** (foundation: boot through the new app layer, honest 404, ErrorBoundary crash/catch/recover via the prototype-only `/_test/crash` route, mock-adapter production isolation probe, dependency-rule audit). All green after Phase 4.

**English coverage (Phase 3.8):** every visible string now comes from `src/i18n/` (`locales/ar.ts` + `locales/en.ts`; a missing EN key is a compile error since `TKey` derives from the Arabic dict). Mock error messages are localized **without changing the mock's return shape** — `result.error` still holds the original Arabic contract string (the 3.2–3.7 suites assert on it), and `errText(t, res)` in `src/shared/ui/ui.tsx` resolves it through `src/services/api/adapters/mock/errorKeys.ts`, preferring an explicit `errorKey` / `errorVars` when the text varies. Business data (project/item/user names, codes, Arabic search synonyms, the `ع/EN` endonym, unit defaults) is deliberately **not** translated; elements carrying it declare `data-i18n-skip="business-data"` so the automated audit honours that boundary instead of guessing.

**Exports & Audit (Phase 3.7, mock-only):**
- `/reports` exports 8 datasets as real local **CSV / JSON** files. The gate is the audited `reports.view` (the key every backend `/export/xlsx` route uses) plus each dataset's own read permission, and it is enforced **inside `reportApi.export`** — calling it directly without the permission returns 403 even when the UI never offered a button.
- Project-level scoping uses the same `scopeRow` rule as the screens, so an export can never contain a project you cannot already see. The audit dataset additionally requires `audit.view`.
- CSV details: UTF-8 **BOM** so Excel reads Arabic correctly, RFC 4180 CRLF rows with quoting for commas/quotes/newlines, and **formula-injection neutralization** (`= + - @` and leading control chars get a leading apostrophe) applied to the export representation only — the stored record is never modified.
- The audit page filters on the fields the audited `AuditLog` actually has: text search, user, action, entity, and a date range. There is deliberately **no project filter** — `AuditLog` has no project field.
- Filtered exports pass a **structured filter object** that the engine re-applies to already-scoped rows, so the file matches the screen and cannot be used to smuggle rows past the gates.

**Financials / BOQ / IPC (Phase 3.6, mock-only):**
- Every figure is DERIVED — BOQ line total = `quantity × unitPrice`; BOQ project total = Σ lines; IPC net = `Σ(currentQuantity × boq.unitPrice)` when lines exist, otherwise `max(0, gross − deductions)`; project "executed" = Σ net of **approved** certificates only. `totalPrice` / `totalQuantity` exist on the shared types but no audited route writes them, so they are never stored here either.
- Cumulative execution per BOQ item may never exceed the BOQ quantity (audited `checkIpcLines`); the form shows the remaining allowance live and the mock re-checks before any write, so a rejected certificate creates nothing partial.
- Contract value, tax, retention and advance payments have **no source** in the audited model, so the UI shows «غير متاح» rather than a plausible number.
- `boqApi` / `ipcApi` enforce permissions on the mock path (`projects.view` READ / `projects.edit`+`projects.create` WRITE, `canProject`), so a forbidden action is refused even if the UI is bypassed.

**Honesty rules baked in:** persistent demo badge; every simulated mutation toasts "no real change"; mock-only login with role picker; read-only submitted rows for view-only roles (approve/reject render only with mock `materialRequests.approve`); unified Archive with zero folder UI; folder-origin shown as passive metadata only.
