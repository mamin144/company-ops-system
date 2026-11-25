# WP3C — Phase 13 → Phase 14 Frontend Reconciliation Audit

> **نوع الوثيقة:** تدقيق قراءة-فقط (read-only) — لا تنفيذ، ولا تعديل، ولا إصلاح.
> **الهدف:** الحكم على مدى ملاءمة تطبيق Phase 13 كأساس لـ Phase 14، بمقارنته بـ (أ) متطلبات Phase 14 المعتمدة، و(ب) التنفيذ الخلفي الفعلي — لا بما تدّعيه التقارير السابقة.

---

## Document Control

| Field | Value |
|---|---|
| Artifact | `docs/frontend-rebuild/phase-14/phase-14c/WP3C_PHASE13_TO_PHASE14_FRONTEND_RECONCILIATION_AUDIT.md` |
| Work package | WP3C — Phase 13 → Phase 14 frontend reconciliation audit |
| Subject under audit | `docs/frontend-rebuild/phase-13/app` (the Phase 13 frontend application) |
| Reference standard A | `docs/frontend-rebuild/phase-14/phase-14a-*`, `phase-14b/*`, `phase-14c/01–08` (approved Phase 14 requirements) |
| Reference standard B | `apps/api/src` + `packages/shared/src` (actual backend implementation) |
| Repository | `D:\Default Project\company-ops-system` |
| Branch / HEAD at audit start | `main` / `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf` |
| Branch / HEAD at audit end | `main` / `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf` (unchanged) |
| Working-tree state at start | 46 `git status --porcelain` entries; 0 staged; 0 stashes |
| Working-tree state at end | 46 entries; 0 staged; 0 stashes (unchanged) |
| Files created by this work package | **1** — this report |
| Files modified / deleted by this work package | **0** |
| Runtime actions performed | **none** — no install, no build, no dev server, no API server, no DB query, no HTTP request, no login, no browser |
| Git mutations performed | **none** — no checkout/restore/reset/clean/stash/add/commit/push/merge/rebase |
| Audit date | Wed Nov 18 2026 |

### Read-only attestation

This audit is **static only**. Every claim below is derived from reading files on disk and from `git` metadata read commands (`rev-parse`, `status --porcelain`, `diff --cached`, `stash list`). No command in this work package wrote to the repository, to the database, to the filesystem outside this one report path, or to any running process. No server was started or stopped. No `.env` file was read or altered. No permission, migration, seed, or RBAC record was touched.

**The repository was not clean at the start of this audit and is not clean at its end.** This session changed nothing; that is a statement about this session, not a statement about the repository.

---

## Controlled Legends (declared by this audit)

Three vocabularies were prescribed for this report but **are not recorded anywhere in the repository**. This audit therefore declares them explicitly below and states, per legend, whether it is a verbatim mandate or an audit-authored reconstruction. Nothing in this report should be read as claiming the repository already contains these definitions.

### L1 — Nine-status traceability legend (audit-authored)

No file in the repository defines a nine-value status vocabulary for traceability. `docs/frontend-rebuild/phase-14/phase-14c/WP3B_SOURCE_RECOVERY_AND_CONFLICT_PROVENANCE_AUDIT.md` is the only file mentioning `WP3C`, and no WP3C mandate file exists. The nine values below are **this audit's controlled vocabulary**, applied consistently in §8 and §9.

| Status | Definition | Discriminator |
|---|---|---|
| `IMPLEMENTED` | Frontend calls the real backend for this capability, over the default transport, and the backend route exists with matching semantics. | Evidence of a wired http adapter method **and** a backend route. |
| `PARTIALLY IMPLEMENTED` | Real wiring exists but a material sub-requirement is missing (a field, a state, a guard, a transition). | Wired path exists; specific named gap. |
| `UI ONLY — MOCK` | The screen reads the fixture adapter (`adapters/mock/api.ts`) and presents the result as if real. Fails loudly in http mode or renders fixture data silently — the status records that the UI exists and the data is synthetic. | Screen imports the mock namespace; no backend counterpart call. |
| `UI ONLY — HARDCODED` | The screen renders literal constants, contract tables, or `adapters/mock/data.ts` arrays **with no transport call at all** — no adapter indirection, therefore no failure and no signal. | Direct `mock/data` import used as live data; no `api.*` call on the render path. |
| `CONTRACT ONLY` | A contract exists in Phase 14 documentation, or a type exists in code, with no implementation on either side. | Doc/type present; no route and no adapter method. |
| `BACKEND ONLY` | The backend route exists and works; the frontend has no consumer at all. | Route verified in `apps/api`; zero frontend references. |
| `ABSENT` | Neither side implements it; not even a contract is fixed. | No route, no adapter, no doc contract. |
| `CONFLICT` | Two authoritative sources disagree about this capability, or the frontend contradicts the backend, or a prior report contradicts the code. Not resolved here. | Named pair of disagreeing artifacts. |
| `NOT VERIFIABLE` | Static evidence cannot decide; runtime or protected-source access would be required. | Named missing evidence. |

### L2 — Twelve-field frontend-to-backend contract matrix (audit-authored)

The twelve field names were not recorded in the repository. This audit declares the following twelve fields and uses them verbatim in §9:

| # | Field | Meaning |
|---|---|---|
| F1 | Domain | Business capability the contract serves |
| F2 | Frontend consumer | File path + symbol that issues the call |
| F3 | Adapter call | Exact namespace.method on the `ApiAdapter` surface |
| F4 | Transport availability | Present in `fixture` mode / present in `http` mode (default) |
| F5 | Backend route | `METHOD /path` + line number in `apps/api/src` |
| F6 | Permission gate | `requirePermission` / `requireProjectAccess` key(s) as written |
| F7 | Scoping | Server-side project scoping / IDOR posture (`hideExistence`, membership filter) |
| F8 | Request shape | Zod schema or body keys the backend actually parses |
| F9 | Response shape | Keys the backend actually returns |
| F10 | Deferred-value contract | Whether absent money is `unavailable` or a number |
| F11 | Error contract | Status + body shape on failure |
| F12 | Match verdict | One of L1 + confidence (HIGH / MEDIUM / LOW) |

### L3 — The eleven final verdict questions (audit reconstruction — disclosed)

The eleven questions were **not found** in any Phase 14 document, in WP3A, or in WP3B. §16 therefore presents **this audit's controlled restatement** of the eleven questions a Phase 13 → Phase 14 reconciliation must answer, and answers them. This is stated plainly rather than presented as verbatim fidelity to an unlocatable mandate.

---

## 1. Mandate, Scope, and Constraints

### 1.1 What this work package is for

The owner needs one answer before authorising any Phase 14 construction: **is the Phase 13 application a suitable foundation, and if so, what specifically must change?** WP3B established that the *legacy* tree is conflicted and that the Phase 13 tree is the only non-conflicted candidate. WP3C takes the next step: it measures that candidate against the approved Phase 14 requirement set and against what the backend actually does today.

The audit is deliberately adversarial toward its own inputs. Three prior artifacts make claims that this audit re-tests against source:

1. `WP3A_FRONTEND_IDENTITY_AUDIT.md` asserts that `apps/web` **is** the Phase 14 UI.
2. `phase-14c/04-api-readiness.md` asserts that everything beyond four auth endpoints and three project endpoints is `[Proposed]` or `UNKNOWN-PROTECTED`.
3. `phase-13/app/README.md` asserts that all unwired domains "fail explicitly".

All three assertions are contradicted by source evidence. §13 records the contradictions without resolving them.

### 1.2 In scope

- The complete Phase 13 application tree: `docs/frontend-rebuild/phase-13/app` (59 files under `src`, plus `verify/`, root config).
- The Phase 14 requirement corpus: `phase-14a-owner-decisions.md`, `phase-14a-requirements-map.md`, `phase-14b/01–07`, `phase-14c/01–08`.
- The backend implementation surface: every `*.routes.ts`, `middleware/auth.ts`, `services/authorization.service.ts`, `services/global-search.service.ts`, `routes/index.ts`, `server.ts`, `app.ts`.
- The shared permission vocabulary: `packages/shared/src/permissions.ts`.
- The Phase 3 baseline for delta analysis: `docs/frontend-rebuild/phase-03-prototype`.
- The prior audit artifacts `WP3A`, `WP3B`, and `03/04/05/08` of `phase-14c`, **as claims to be tested**, not as evidence to be trusted.

### 1.3 Out of scope (and explicitly prohibited)

No source edit, no conflict resolution, no folder move/copy, no `package.json` or workspace-config change, no `npm install`, no build, no Vite/dev server, no backend start/restart, no migration, no seed, no DB write, no HTTP request, no login, no browser session, no `.env` change, no Git mutation, no RBAC change, no artifact generation beyond this report. Backend, database, business data, and all dirty/untracked state are preserved by inaction.

### 1.4 Constraint that shapes the whole audit

Because no runtime action is permitted, **every statement about behaviour is a statement about source text**. Where behaviour depends on which environment flag is set at *build* time, the audit reasons from `configuration.ts` and `mock/api.ts` rather than from an observed run. This is why the transport finding in §7 is expressed as two distinct build products rather than one observed application.

---

## 2. Method, Evidence Base, and Confidence Discipline

### 2.1 Evidence classes used in this report

Every material finding is labelled with exactly one of five classes. The class is not decoration: it tells the owner what kind of action the finding licenses.

| Class | Meaning | What the owner may do with it |
|---|---|---|
| **VERIFIED FACT** | Directly read from a named file at a named line. Reproducible by opening that file. | Rely on it. |
| **TECHNICAL INFERENCE** | Follows necessarily from verified facts plus a stated reasoning step, but was not itself observed. Reasoning is shown. | Accept pending the stated check. |
| **RECOMMENDATION** | An engineering judgement by this audit. Not a finding about the current state. | Accept, modify, or reject. |
| **OWNER DECISION REQUIRED** | A choice that is legitimately the owner's: scope, priority, business rule, risk appetite. This audit must not decide it. | Decide explicitly. |
| **NOT VERIFIED** | Static evidence is insufficient. Names what would settle it. | Request the missing evidence. |

### 2.2 Confidence levels

| Level | Rule applied in this report |
|---|---|
| **HIGH** | The claim is a direct reading of an exact line, and no plausible alternative interpretation exists. |
| **MEDIUM** | The claim rests on a small number of exact lines plus one inference step, or on a structural property that is consistent across many files. |
| **LOW** | The claim generalises from partial coverage, or depends on files not fully read, or depends on runtime behaviour. |

### 2.3 What was actually read

| Area | Coverage | Basis |
|---|---|---|
| Phase 13 `src` | **Full enumeration** (59 files); all 11 transport/route/auth files read in full; all 17 screens measured by targeted inspection | File listing + full reads + per-file symbol greps |
| Phase 13 `verify/` | All 24 spec files inventoried; `pw.config.ts` and `probe-mock-isolation.mjs` read in full | `Get-ChildItem` + full reads |
| Phase 13 root config | `package.json`, `vite.config.ts`, `README.md`, `components.json`, `tsconfig.json`, `.env*` absence | Full reads |
| Backend routes | All `*.routes.ts` route tables with line numbers; mount table; `server.ts`; `app.ts` | `Select-String` on `router.<verb>(` + full reads |
| Backend authorization | `authorization.service.ts` L1–100+ (precedence, managed keys, access ranks); `middleware/auth.ts`; `services/projectScope.ts` | Full reads |
| Shared contract | `packages/shared/src/permissions.ts` (65 lines, all) | Full read |
| Phase 14 docs | 14A-owner-decisions, 14A-requirements-map (586 lines), 14B/01 §1–6, 14B/03 (261 lines), 14B/04, 14B/05 (147 lines), 14C/01, 14C/04 (112 lines), 14C/06 (136 lines), 14C/07 (70 lines) | Full reads |
| Phase 3 baseline | SHA-256 tree diff against Phase 13 | Recursive hash comparison |
| Prior audits | WP3A (16,524 B), WP3B (61,452 B) | Full reads + targeted re-verification |

### 2.4 Structural check: what the audit did *not* do

The audit did **not** run `npm ls`, `tsc --noEmit`, `vite build`, or any Playwright spec. Consequently:

- Import-graph soundness and type-correctness of the Phase 13 tree under either transport are **NOT VERIFIED** by execution. They are inferred from import text only.
- The fixture-mode behaviour of the 24 specs is **NOT VERIFIED**. Their *intent* (fixture dev server on `:5199`) is verified from `pw.config.ts` and `README.md`.
- Any claim about the real backend's live response bodies (as opposed to its source-computed shapes) is **NOT VERIFIED**.

---

## 3. Skills Applied

Four skills were discovered, read in full, and applied. They shaped specific sections; the mapping is recorded so the owner can see which reasoning framework produced which finding.

| Skill ID | Discovered | Read | Applied | Where it shaped this report |
|---|---|---|---|---|
| `frontend-architecture` | Yes | Yes | **Yes** | §6 architecture map (Routes → Pages → Features → Components → Services → API Adapters), and the "feature-module boundary vs adapter boundary" critique in §6.4 and §14. |
| `api-and-interface-design` | Yes | Yes | **Yes** | §9's twelve-field contract schema; the "explicit failure vs silent fallback" criterion in §7.3; the verdict vocabulary in §9. |
| `auth-implementation-patterns` | Yes | Yes | **Yes** | §10 (frontend guard vs backend enforcement asymmetry); §8 rows R02/R23–R27. |
| `cc-skill-security-review` | Yes | Yes | **Yes** | §7.4 (fixture data reachable in production build), §10.5 (IDOR/hideExistence posture), §13 (the WP3A claim that requires security scrutiny). |
| `ab-test-setup`, `accessibility-compliance-accessibility-audit`, `browser-testing-with-devtools` | Yes | No | **No** | Not applicable: the audit performs no experiments, no live a11y run, and no browser session. |
| Any skill requiring runtime/network execution | — | — | **Unavailable** | Blocked by the read-only mandate (§1.3). Recorded as unavailable rather than silently skipped. |

**Discovered but deliberately not loaded:** any skill whose procedure requires starting a server, issuing requests, or mutating files. Loading them would have created pressure to violate §1.3.

---

## 4. Repository, Workspace, and Artifact Topology

### 4.1 Workspace membership — VERIFIED FACT (HIGH)

`package.json` (repository root) declares:

```json
"workspaces": ["apps/*", "packages/*"]
```

`git ls-files docs` returns **0** entries. Every file under `docs/` is untracked.

**Consequence (TECHNICAL INFERENCE, HIGH):** `docs/frontend-rebuild/phase-13/app` is **not** a workspace member. It has no `node_modules` of its own; it resolves React and Vite upward from the repository root. Its `package.json` says so explicitly:

> "No own node_modules: dependencies are consumed from the repository root node_modules"

This matters for Phase 14 planning because a Phase 14 build cannot assume workspace-level tooling, task-graph participation, or lockfile governance for this directory as it stands. Any promotion of the Phase 13 app into the delivered product requires a packaging decision that is **not** in the Phase 14 corpus.

### 4.2 Three frontend trees, one identity question

| Tree | Path | Source mtime (newest) | Conflict markers in `src` | Status per this audit |
|---|---|---|---|---|
| Frozen prototype | `docs/frontend-rebuild/phase-03-prototype` | 2026-10-28 | **0** | Superseded ancestor. Evidence baseline only. |
| Phase 13 app | `docs/frontend-rebuild/phase-13/app` | 2026-11-17 | **0** | The candidate foundation. |
| Legacy app | `apps/web` | 2026-11-18 | **158 lines / 79 hunks** | Conflicted. Not the Phase 14 UI (§13.1). |

Conflict-marker counts are **VERIFIED FACT (HIGH)** — measured by scanning `src` for `<<<<<<<` / `>>>>>>>`.

**TECHNICAL INFERENCE (HIGH):** the newest-touched frontend source in the repository is the *legacy* tree (`apps/web/src/lib/permissions.ts`, 2026-11-18), which is also the conflicted one. Recency therefore cannot be used as evidence of correctness or of Phase 14 alignment. This is the trap WP3A fell into (§13.1).

### 4.3 Phase 3 → Phase 13 delta — VERIFIED FACT (HIGH)

Recursive SHA-256 comparison of the two trees:

| Measure | Value |
|---|---|
| Files in Phase 3 | 195 |
| Files in Phase 13 | 137 |
| Common paths | 125 |
| Byte-identical | 81 |
| Changed | 44 |
| Only in Phase 3 | 70 |
| Only in Phase 13 | 12 |

The 12 Phase-13-only paths are 4 real source files plus 8 build/cache artifacts:

```
src\services\api\adapters\http\api.ts       (new — real HTTP adapter)
src\services\api\adapters\http\client.ts    (new — fetch wrapper + ApiError)
src\services\api\adapters\http\names.ts     (new — client-side name caches)
src\services\api\adapters\http\session.ts   (new — login/me/logout/refresh)
dist\assets\*                               (2 build artifacts)
node_modules\.vite\deps\*                   (6 cache artifacts)
```

The 70 Phase-3-only paths are almost entirely `dist317c/`, `dist-phase10/`, `dist-phase11/` snapshot folders and `COVERAGE-AUDIT.md` — legacy evidence, not code loss.

**VERIFIED FACT (HIGH):** no source file was removed between Phase 3 and Phase 13. Phase 13 is strictly additive plus 18 modified `src` files (including `AppShell`, `Login`, `auth.tsx`, `Projects`, `router`, `Archive`, `Home`, `Stock`, `Warehouses`, `Financials`, `ProjectWorkspace`, `Requests`, `ar.ts`, `en.ts`, `mock/api.ts`, `configuration.ts`, `index.ts`, `styles.css`).

**TECHNICAL INFERENCE (HIGH):** the "Phase 13 delta" is essentially one architectural addition — a real HTTP transport slice — bolted onto an otherwise preserved prototype. 81 of 125 shared files are byte-identical. The prototype's *shape* survives; only the transport and the auth/projects vertical were genuinely re-engineered.

### 4.4 Untracked assets inside the audit's blast radius

These are untracked but relevant to any Phase 14 authorisation, and are recorded here so that no future work package mistakes them for delivered state:

| Path | Relevance |
|---|---|
| `apps/api/src/database/migrations/22_phase14_core_columns.sql` | Phase 14 schema — **unapplied** (live ledger stops at `21_direct_amounts.sql`) |
| `apps/api/src/database/migrations/23_phase14_ipc_workflow.sql` | IPC workflow tables — **unapplied** |
| `apps/api/src/database/migrations/24_phase14_recovery_import_tables.sql` | Recovery/import tables — **unapplied** |
| `apps/api/src/services/financials.service.ts` | Phase 14 financials service |
| `apps/api/src/services/password-reset-token.service.ts` | Reset-token service |
| `apps/api/tests/migration.phase14.test.ts` | Phase 14 migration test |
| `PHASE14_FINAL_REPORT.md`, `WP2_VERIFICATION_REPORT.md` | Prior claims, not verified here |

**VERIFIED FACT (HIGH):** the backend source implements IPC workflow endpoints (§12.3) while migrations `23_*` that create the workflow tables are unapplied. **TECHNICAL INFERENCE (MEDIUM):** therefore the IPC workflow endpoints as written cannot succeed against the current live schema — they reference `ipc_status_events`, which those migrations create. This is a *deployment* delta, not a code delta, and it is a Phase 14 blocker independent of the frontend question.

---

## 5. Phase 13 Application Inventory

### 5.1 Identity — VERIFIED FACT (HIGH)

| Property | Value | Evidence |
|---|---|---|
| Package name | `cos-phase13-app`, `private: true`, `version 0.1.0` | `phase-13/app/package.json` L3–6 |
| Module system | ESM (`"type": "module"`) | same, L5 |
| Runtime deps | `@gsap/react`, `gsap`, `lenis`, `react@^19.2.8`, `react-dom@^19.2.8` | same, L8–14 |
| Dev deps | `@playwright/test`, `@vitejs/plugin-react`, `typescript@^5.9.0`, `vite@^7.3.6` | same, L15–20 |
| Entry HTML | `index.html` (1,221 B) | dir listing |
| Dev port | `5199` | `vite.config.ts` |
| Backend proxy | `/api` → `http://localhost:4001` (default) | `vite.config.ts`; overridable via `VITE_API_PROXY_TARGET` |
| `.env*` files | **none present** | `Get-ChildItem -Filter '.env*' -Force` → empty |
| Own `node_modules` | **none** | dir listing |

### 5.2 Source volume — VERIFIED FACT (HIGH)

59 files under `src`: 58 TypeScript/TSX + 1 CSS (`shared/styles/styles.css`).

| Layer | Files | Notable sizes |
|---|---|---|
| `app/` (bootstrap, router, providers, layouts, pages, boundaries) | 11 | `AppShell.tsx` 370 L, `auth.tsx` 216 L, `Login.tsx` 158 L, `router.tsx` 81 L |
| `features/` (7 modules) | 21 | `Admin.tsx` 413 L, `Archive.tsx` ~560 L, `ProjectWorkspace.tsx` **627 L**, `Stock.tsx`, `Requests.tsx` |
| `i18n/` | 5 | `ar.ts` / `en.ts` (largest changed locale files), `direction.ts`, `setup/index.tsx` |
| `services/api/` | 11 | `adapters/mock/api.ts` **1,437 L**, `adapters/mock/data.ts` 326 L, `adapters/http/api.ts` 225 L, `index.ts` 42 L, `configuration.ts` 31 L |
| `shared/` | 9 | `ui/ui.tsx` (component kit), `ui/ContextualExport.tsx`, `icons.tsx`, `motion.tsx`, `files.ts` |
| Root | 1 | `main.tsx` |

### 5.3 Verification suite — VERIFIED FACT (HIGH)

`verify/` contains **24 `*.spec.ts` files** plus 2 `.mjs` probes and `pw.config.ts`.

`pw.config.ts` declares **no `webServer` block** and reads `PW_BASE_URL`. Therefore every spec targets whatever server is already running — and `README.md` instructs that this must be the **fixture** dev server (`VITE_PROTOTYPE=1`, port `5199`).

**VERIFIED FACT (HIGH):** no spec file exercises `http` mode. `probe-mock-isolation.mjs` tests only *transport selection*: it asserts that a production+fixture build throws at import and that http mode imports cleanly. It does not assert that any screen works over HTTP.

**Observation (TECHNICAL INFERENCE, HIGH):** `verify/_debug_item8.spec.ts` (1,777 B) is a debugging leftover carrying a leading underscore. It is not a regression guard. Its presence in the shipped verification folder is an artifact-hygiene finding, not a functional defect.

**Consequence for Phase 14:** the 24-spec suite is a **prototype-behaviour** regression net, not a Phase 14 acceptance suite. It asserts today's fixture semantics — including semantics the backend contradicts (§12.3). Reusing it as an acceptance gate for Phase 14 would encode the wrong oracle.

---

## 6. Architecture Map

### 6.1 The prescribed chain

```
Routes → Pages → Features → Components → Services → API Adapters
```

### 6.2 Routes → Pages (VERIFIED FACT, HIGH)

`app/router.tsx` (81 lines). Guard semantics: `Guard` renders `null` until `ready` (async session restore), redirects to `/login` carrying `state.from`, and renders `Forbidden` when `can(perm)` is false. Route guards are explicitly documented as **UX-layer only** — "real authorization is enforced by the backend" (L24–27).

| Route | Element | Route-level permission | Line |
|---|---|---|---|
| `/login` | `Login` | none (public) | L47 |
| `/` (index) | `Home` | none beyond auth | L49 |
| `/projects` | `Projects` | `projects.view` | L50 |
| `/projects/:id` | `ProjectWorkspace` | `projects.view` | L51 |
| ↳ `overview` | `ProjOverview` | inherited | L53 |
| ↳ `sites` | `ProjSites` | inherited | L54 |
| ↳ `documents` | `ProjDocs` | inherited | L55 |
| ↳ `warehouses` | `ProjWarehouses` | inherited | L56 |
| ↳ `stock` | `ProjStock` | inherited | L57 |
| ↳ `financials` | `ProjFinancials` | inherited | L58 |
| `/financials` | `Financials` | `projects.view` | L60 |
| `/archive` | `Archive` | `archive.view` | L61 |
| `/inventory` | `InventoryHub` | `warehouse.view` | L62 |
| `/inventory/warehouses` | `Warehouses` | `warehouse.view` | L63 |
| `/inventory/items` | `Items` | `warehouse.view` | L64 |
| `/inventory/stock` | `Stock` | `warehouse.view` | L65 |
| `/inventory/requests` | `Requests` | `materialRequests.view` | L66 |
| `/admin` | `Admin` | `users.manage` | L67 |
| `/audit` | `Audit` | `audit.view` | L68 |
| `/reports` | `Reports` | `reports.view` | L69 |
| `/settings` | `Settings` | **none** | L70 |
| `/search` | `Search` | **none** | L71 |
| `/notifications` | `Notifications` | **none** | L72 |
| `/403` | `Forbidden` | — | L73 |
| `/_test/crash` | `CrashProbe` | prototype-only (`IS_PROTOTYPE`) | L74 |
| `*` | `NotFound` | — | L75 |

**Finding (VERIFIED FACT, HIGH):** three authenticated routes — `/settings`, `/search`, `/notifications` — carry **no capability guard**. `/settings` in particular exposes a backup tab gated *inside* the component by `can('backup.manage')` (Settings.tsx L30) rather than at the route. This is defence-in-depth, not a vulnerability (the backend enforces), but it is an inconsistency Phase 14 should normalise.

### 6.3 Pages → Features → Components

| Route page | Feature module | Component | Lines |
|---|---|---|---|
| `Home` | `features/dashboard` | `Home.tsx` | — |
| `Projects` | `features/projects` | `Projects.tsx` | — |
| `ProjectWorkspace` (+6 children) | `features/projects` | `ProjectWorkspace.tsx` | **627** |
| `Financials`, `ProjFinancials` | `features/projects` | `Financials.tsx` | 128 |
| `Archive`, `ProjDocs` | `features/archive` | `Archive.tsx` | — |
| `InventoryHub`, `Warehouses`, `Items`, `Stock` | `features/inventory` | 4 components | — |
| `Requests` | `features/requests` | `Requests.tsx` | — |
| `Reports` | `features/reports` | `Reports.tsx` | — |
| `Admin`, `Audit` | `features/administration` | `Admin.tsx` 413, `Audit.tsx` 201 | — |

### 6.4 Feature boundaries — two structural defects

**Defect 1 (VERIFIED FACT, HIGH): the adapter boundary is not enforced.**

`services/api/index.ts` L1–5 states the intent explicitly:

> "Screens import data access exclusively from `@/services/api` — never from `./adapters/` internals directly (documented exceptions: contract constants still read from `adapters/mock/data` by unmigrated screens…)"

**Measured reality:** 15 of 17 screen files import `adapters/mock/data` directly. Only 5 of those imports are type-only (`import type`). The rest import **live values**:

| File | Live values imported from `adapters/mock/data` | Line |
|---|---|---|
| `app/pages/Search.tsx` | `documents, items, projects, transactions, warehouses` | **L4** |
| `features/inventory/components/Items.tsx` | `items` | **L4** |
| `app/pages/Settings.tsx` | `backups, imports` | **L6** |
| `features/administration/components/Admin.tsx` | `MANAGED_GROUPS, ROLE_AR5, ROLE_BASE, projects` | **L6** |
| `features/archive/components/Archive.tsx` | `STATUS_TONE` (constant) | L6 |
| `features/projects/components/Projects.tsx` | `STATUS_TONE` | L6 |
| `features/projects/components/ProjectWorkspace.tsx` | `STATUS_TONE` | L6 |
| `features/requests/components/Requests.tsx` | `STATUS_TONE` | L6 |
| `features/inventory/components/Stock.tsx` | `TX_PERMISSION` | L6 |

The `STATUS_TONE` / `TX_PERMISSION` cases are benign presentation constants. **The first four are not.** They are the mechanism behind the most serious finding in this audit (§7.4).

**Defect 2 (TECHNICAL INFERENCE, HIGH): the feature module's public surface is not the boundary that failed.**

Each `features/*/index.ts` barrel is correct — `router.tsx` imports only from barrels. The leakage is not between features; it is *around* the service layer, from screens straight into fixture data. Architectural layering held; the data layer did not.

### 6.5 Services → API Adapters (VERIFIED FACT, HIGH)

```
screens
  └── @/services/api                      (index.ts — facade, 42 L)
        ├── configuration.ts               (API_MODE selection, 31 L)
        ├── adapters/http/                 (real transport, slice 1)
        │     ├── api.ts      (225 L — adapter object + Proxy filler)
        │     ├── client.ts   (fetch wrapper, ApiError, Paged<T>)
        │     ├── session.ts  (login / me / logout / silent refresh)
        │     └── names.ts    (client-side item/warehouse/project name caches)
        └── adapters/mock/                 (fixture transport)
              ├── api.ts      (1,437 L — 8 namespaces + isolation guard)
              ├── data.ts     (326 L — synthetic records, NO prod guard)
              └── errorKeys.ts
```

Facade logic (`index.ts` L27, L29–33): selects `httpApi` when `API_MODE === 'http'`, otherwise the mock adapter, and re-exports the 13-name surface plus `ApiAdapter` type. The comment asserts the swap is "typecheck-guaranteed" because both satisfy one `ApiAdapter` type derived from the fixture surface.

**Finding (TECHNICAL INFERENCE, HIGH): a type-level guarantee that both transports expose the same *shape* says nothing about whether the shapes are *semantically* equivalent.** The Proxy filler in `http/api.ts` L199–225 manufactures a function for every unwired property, which satisfies the type but not the contract. §7.2 shows where that manufactured function is called *as an object* and produces a raw `TypeError` instead of the intended "not wired" message.

---

## 7. Transport Layer Analysis — the Decisive Section

### 7.1 Default transport is `http` — VERIFIED FACT (HIGH)

`configuration.ts`:

```ts
export const FIXTURE_MODE = import.meta.env.VITE_PROTOTYPE === '1';   // L14
export const IS_PROTOTYPE = FIXTURE_MODE;                             // L17
export const API_MODE = FIXTURE_MODE ? 'fixture' : 'http';            // L21 (approx.)
```

No `.env*` file exists in the app. Therefore, absent a shell variable at build time, **`API_MODE === 'http'`**. `configuration.ts` L6–8 states the intent: "http … IS the DEFAULT when the flag is absent, so a plain build can never silently fall back to fixtures."

**TECHNICAL INFERENCE (HIGH):** the design goal — no silent fixture fallback — is achieved for `api.ts` and **defeated** for `data.ts` (§7.4).

### 7.2 What `http` actually provides — VERIFIED FACT (HIGH)

`adapters/http/api.ts` header (L5–15) enumerates the wired slice honestly:

```
· mrApi.projects        → GET  /api/projects  (paged; pageSize=1000)
· mrApi.createProject   → POST /api/projects  (projects.create)
· mrApi.updateProject   → PUT  /api/projects/:id
· session helpers       → ./session.ts
· boqTotal              → pure arithmetic
· itemName/whName/projName → client-side name caches
· canProject            → session permission check
· MR_STATUSES / EMAIL_RE → contract constants
```

The adapter object (`base`, L197–207):

```ts
const base = { mrApi, itemName, whName, projName, canProject, boqTotal,
               __protoFail, MR_STATUSES, EMAIL_RE } satisfies Partial<ApiAdapter>;
```

Everything else is served by:

```ts
export const httpApi = new Proxy(base, {
  get(target, prop) {
    if (prop in target) return (target as ...)[prop];
    if (typeof prop === 'string') return unwiredNamespace(prop);   // returns () => { throw notWired(prop) }
    return undefined;
  },
}) as unknown as ApiAdapter;
```

**Therefore in the default build, these seven namespaces do not exist:** `mockApi`, `stockApi`, `boqApi`, `ipcApi`, `userApi`, `reportApi`, `lookups`.

### 7.3 The intended failure mode and its two escapes

The Proxy is designed to fail **loudly**: calling an unwired function throws `[http adapter] '<ns>' is not wired yet …`. This is good design and correct per `api-and-interface-design` (explicit failure beats silent fallback).

There are **two escapes** from that design.

**Escape A — `lookups` is an object, not a function (VERIFIED FACT, HIGH).**

In the fixture surface, `lookups` is an object with methods (`lookups.warehouses(actor)`, `lookups.items(actor)`). The Proxy returns a *function* for `lookups`. Call sites then do `lookups.warehouses(...)` — i.e. property access **on a function** — yielding `undefined`, then invoking `undefined`.

Verified call sites on render paths:

| File | Line | Code |
|---|---|---|
| `features/dashboard/components/Home.tsx` | **L44–45** | `setWhs(lookups.warehouses(user?.id)); setItemsList(lookups.items(user?.id));` |
| `features/inventory/components/Stock.tsx` | L75 | `const whs = lookups.warehouses(actor);` |
| `features/inventory/components/Stock.tsx` | L162–163 | `const whs = lookups.warehouses(user?.id); const its = lookups.items(user?.id);` |
| `features/requests/components/Requests.tsx` | L236–237 | `const whs = lookups.warehouses(actor); const its = lookups.items(actor);` |

`Home.tsx` L19–20 additionally uses `ReturnType<typeof lookups.warehouses>` as the state type — so the type layer is satisfied while the runtime produces `TypeError: lookups.warehouses is not a function`, thrown **synchronously during render**, i.e. caught by `ErrorBoundary` rather than by the page's error state.

**Consequence:** the "explicit, diagnosable failure" degrades to an opaque boundary crash on three of the six primary modules (dashboard, inventory, requests). This is a **worse** developer and operator experience than the design intends, and it will be misdiagnosed as a React bug rather than as an unwired transport.

**Escape B — direct fixture-data imports (VERIFIED FACT, HIGH).**

`Search.tsx`, `Items.tsx`, `Settings.tsx`, and `Admin.tsx` never touch the adapter for their data. They import `adapters/mock/data` values at module scope and render them.

- `mock/api.ts` L12–14 contains the isolation guard: `if (import.meta.env.PROD && API_MODE === 'fixture') throw`.
- `mock/data.ts` contains **no guard and no `import.meta` access whatsoever** (verified: zero matches for `import.meta` or `PROD` in the file; the only matches are the words inside comments at L262/L285).

**Therefore, in an `http`-mode production build:**

| Screen | Route | What the user sees | Signal to operator |
|---|---|---|---|
| `Search` | `/search` | Client-side filtering over synthetic `projects`, `documents`, `warehouses`, `items`, `transactions` arrays | **none** |
| `Items` | `/inventory/items` | Synthetic item list; create/edit/delete mutate **local React state only** | **none** |
| `Settings` | `/settings` | Synthetic `backups` and `imports` tables | **none** |
| `Admin` | `/admin` | Synthetic `projects` array feeding access-management UI (alongside 20 real `userApi` calls) | **none** |

**This is the single most serious finding in this audit.** It is a truthfulness failure, not merely an integration gap: synthetic records are presented as company records, with no fixture badge, no error, and no telemetry. It directly satisfies the owner's standing prohibition — "never treat prototypes/fixtures/mock responses as real integration" — in the negative direction: the system can *present* fixtures as integration.

**Confidence:** HIGH. Evidence is four module-scope imports plus the absence of any guard in `data.ts`, plus the absence of any adapter call on those components' data paths.

### 7.4 Which screens work over HTTP today — measured

Per-file usage counts of adapter namespaces (VERIFIED FACT, HIGH; counts of `ns.` occurrences):

| Screen | Adapter usage | Behaviour in default `http` build |
|---|---|---|
| `Login` | session helpers (via `auth.tsx`) | **Works** — real login |
| `AppShell` | `mrApi` ×1 | Works (project name list) |
| `Projects` | `mrApi` ×3 | **Works** — list/create/edit over HTTP |
| `Financials` | `boqApi` ×1, `ipcApi` ×2, `mrApi` ×1 | Throws on `boqApi`/`ipcApi`; `mrApi` works |
| `ProjectWorkspace` | `boqApi` ×5, `ipcApi` ×12, `mockApi` ×8, `mrApi` ×1, `stockApi` ×1 | Throws on first unwired access |
| `Archive` | `mockApi` ×13, `mrApi` ×1 | Throws |
| `Home` | `lookups` ×4, `mockApi` ×6, `mrApi` ×2 | **`TypeError`** (escape A) |
| `Stock` | `stockApi` ×4, `lookups` ×3, `mockApi` ×1, `mrApi` ×2 | **`TypeError`** (escape A) |
| `Requests` | `mrApi` ×6, `lookups` ×2, `mockApi` ×1 | **`TypeError`** (escape A) |
| `Warehouses` | `mockApi` ×1, `mrApi` ×2 | Throws |
| `Audit` | `mockApi` ×1, `reportApi` ×1 | Throws |
| `Reports` | `reportApi` ×3 | Throws |
| `ContextualExport` (shared/ui) | `reportApi` ×5 | Throws wherever mounted |
| `Admin` | `userApi` ×20 + raw `data.ts` values | Throws on `userApi` |
| `Notifications` | `mockApi` ×7 | Throws |
| `Search` | **none** — raw `data.ts` | **Renders synthetic data silently** (escape B) |
| `Items` | **none** — raw `data.ts` | **Renders synthetic data silently** (escape B) |
| `Settings` | **none** — raw `data.ts` | **Renders synthetic data silently** (escape B) |
| `InventoryHub` | none | Static navigation hub; renders |
| `auth.tsx` (provider) | `userApi` ×4, session ×6 | Works for session; `userApi` paths throw |

**Summary of the default build:** 1 screen fully functional (Projects, plus Login), 2 screens partially functional, 2 screens crash via `TypeError`, 11 screens throw the intended "not wired" error, 3 screens display synthetic data with no signal, 1 static hub.

### 7.5 The `pageSize=1000` hack — VERIFIED FACT (HIGH)

`http/api.ts` L123–128 issues `GET /api/projects?page=1&pageSize=1000` and treats the response as the full project list. `phase-14c/04-api-readiness.md` §1 documents this honestly as a **hack** slated for P0 removal, and §4.1 makes its removal a hard dependency before any new list screen.

**TECHNICAL INFERENCE (HIGH):** at 1,000 projects the list silently truncates. There is no pagination affordance, no `total` comparison, and no warning. The backend *does* return a `PagedResult` (L66–92), so the fix is frontend-only — but it must precede any Phase 14 list module, because the pattern would otherwise be copied.

---

## 8. Traceability Matrix

Legend L1 applies. `Ev` = evidence pointer. `Conf` = confidence. Rows marked ⚠ carry a conflict or a defect detailed elsewhere.

### 8.1 Session, authentication, routing

| # | Capability | Phase 13 state | Backend state | Status | Ev | Conf |
|---|---|---|---|---|---|---|
| R01 | Login (username + password) | Real `session.login` over HTTP; Arabic error surface | `POST /api/auth/login` L83 | `IMPLEMENTED` | `adapters/http/session.ts` L43–50; `auth.routes.ts` L83 | HIGH |
| R02 | Session restore + silent refresh | Real | `GET /api/auth/me` L144; `POST /api/auth/refresh` L108 | `IMPLEMENTED` | `session.ts` L53–56; `client.ts` | HIGH |
| R03 | Logout (current device only) | Real | `POST /api/auth/logout` L132 | `IMPLEMENTED` | `session.ts` L78–86 | HIGH |
| R04 | Route permission gating | 21 of 24 routes guarded; `/settings` `/search` `/notifications` unguarded | Backend enforces independently | `PARTIALLY IMPLEMENTED` | `router.tsx` L47–75; §6.2 | HIGH |
| R05 | Forbidden / NotFound / ErrorBoundary states | Present | n/a | `IMPLEMENTED` | `boundaries/states.tsx`, `ErrorBoundary.tsx` | HIGH |

### 8.2 Projects

| # | Capability | Phase 13 state | Backend state | Status | Ev | Conf |
|---|---|---|---|---|---|---|
| R06 | Project list | Real, but **`pageSize=1000` truncation hack** | `GET /api/projects` L66–92 (pagination, search, sort, `includeDeleted`) | `PARTIALLY IMPLEMENTED` | `http/api.ts` L123–128 | HIGH |
| R07 | Project create | Real, zod-flattened errors | `POST /api/projects` L167 (`projects.create`) | `IMPLEMENTED` | `http/api.ts` L134–146 | HIGH |
| R08 | Project edit | Real, partial patch | `PUT /api/projects/:id` L184 | `IMPLEMENTED` | `http/api.ts` L150–158 | HIGH |
| R09 | Project soft-delete / restore (O12) | **Delete is local-only** (README: "Projects delete is local-only") | `DELETE /:id` L201, restore L212, deleted-invisible gate | `ABSENT` (frontend) | `phase-13/app/README.md` | HIGH |
| R10 | Project detail / workspace shell | Mock-driven children | `GET /api/projects/:id` L154 (`requireProjectAccess` + `hideExistence`) | `CONFLICT` ⚠ | `ProjectWorkspace.tsx`; `projects.routes.ts` L154 | HIGH |
| R11 | Portfolio financials summary | `boqApi`/`ipcApi` — unwired | `GET /api/projects/financials` L29–64 (scoped, approved-IPC-only execution) | `CONTRACT ONLY` | `Financials.tsx`; `projects.routes.ts` L29 | HIGH |
| R12 | Project-scoped financials + deferred money | **Honours O2/O5/O6 correctly in UI** (see §11) | `GET /:id/financials` L123–152 with `unavailable(...)` envelopes | `CONTRACT ONLY` (UI-correct, transport absent) | `Financials.tsx` L65–113; `projects.routes.ts` L123–152 | HIGH |
| R13 | Project members | No consumer | `GET /:id/members` L104 | `BACKEND ONLY` | §12 | HIGH |

### 8.3 BOQ, IPC, money

| # | Capability | Phase 13 state | Backend state | Status | Ev | Conf |
|---|---|---|---|---|---|---|
| R14 | BOQ list / create / edit | Full mock CRUD UI | `boq.routes.ts` (exists; verified by name + mount `/projects`) | `UI ONLY — MOCK` | `ProjectWorkspace.tsx` `BoqPanel` L255+ | HIGH |
| R15 | BOQ totals in financials | `boqTotal` arithmetic is real | `SUM(total_price)` L37 | `PARTIALLY IMPLEMENTED` | `http/api.ts` `boqTotal` | HIGH |
| R16 | IPC list / create / edit | Mock CRUD, 4 statuses | `ipc.routes.ts` — 5 statuses incl. `under-review` L22 | `UI ONLY — MOCK` ⚠ | `ProjectWorkspace.tsx` L202 | HIGH |
| R17 | IPC approval workflow (submit → review → approve/reject → resubmit) | **Absent.** Status is changed via the generic edit form | 5 endpoints L355–386 + `IPC_TRANSITIONS` L86–92 + `requireNonSubmitter` | `BACKEND ONLY` ⚠ | §12.3 | HIGH |
| R18 | IPC status-event timeline | Absent | `GET /:id/status-events` L58 | `BACKEND ONLY` | `ipc.routes.ts` L58 | HIGH |
| R19 | Self-approval denial (O4) | Absent (no concept) | `requireNonSubmitter: true` L370, L379 | `BACKEND ONLY` | `ipc.routes.ts` L370 | HIGH |
| R20 | Disbursements (O5) | UI shows "not available" + gap note | No endpoint — deliberate | `IMPLEMENTED` (honest unavailability) | `Financials.tsx` L106–113 | HIGH |
| R21 | Tax / retention / advance (O6) | UI shows "not available" | `unavailable('TAX_RULES_UNDEFINED')` etc. L145–148 | `IMPLEMENTED` (honest unavailability) | `Financials.tsx`; `projects.routes.ts` L145–148 | HIGH |

### 8.4 Documents, archive, folders

| # | Capability | Phase 13 state | Backend state | Status | Ev | Conf |
|---|---|---|---|---|---|---|
| R22 | Document list / detail / CRUD | Mock ×13 | `documents.routes.ts` (706 L) | `UI ONLY — MOCK` | `Archive.tsx` | HIGH |
| R23 | Document status change (O3) | Mock dropdown, no matrix | `PATCH /:id/status` L542 — **accepts any→any** under `archive.edit` | `CONFLICT` ⚠ | §12.4 | HIGH |
| R24 | Document↔project linking + scope ≥ READ | Mock | `requireProjectAccess('archive.edit', scopeDocumentRow())` | `UI ONLY — MOCK` | `documents.routes.ts` L542 | HIGH |
| R25 | Folders | Mock | `folders.routes.ts` mounted L27 | `UI ONLY — MOCK` | `routes/index.ts` L27 | HIGH |
| R26 | ZIP export | Mock toast | `POST /documents/export/zip` | `UI ONLY — MOCK` | `documents.routes.ts` after L560 | HIGH |
| R27 | CSV import (O11, ≤200 rows + duplicate rule) | Mock import wizard over `data.ts` | `import.routes.ts` mounted L33 | `UI ONLY — HARDCODED` | `Settings.tsx` L6, L43 | HIGH |

### 8.5 Inventory

| # | Capability | Phase 13 state | Backend state | Status | Ev | Conf |
|---|---|---|---|---|---|---|
| R28 | Warehouses | Mock ×1 + `mrApi` ×2 | `warehouses.routes.ts` L28 | `UI ONLY — MOCK` | `Warehouses.tsx` | HIGH |
| R29 | Items | **Raw `data.ts`, local-only mutations** | `items.routes.ts` L29 | `UI ONLY — HARDCODED` ⚠ | `Items.tsx` L4, L19 | HIGH |
| R30 | Stock transactions (in/out/transfer/adjust/return) | Mock ×4 | `POST /stock/transactions` L195; immutability: `DELETE` L224 always 400 | `UI ONLY — MOCK` | `Stock.tsx` | HIGH |
| R31 | Material requests (view/create/approve/issue) | Mock ×6 | `material-requests.routes.ts` L32 | `UI ONLY — MOCK` | `Requests.tsx` | HIGH |
| R32 | Sites | Mock | `sites.routes.ts` L31 | `UI ONLY — MOCK` | `router.tsx` L54 | HIGH |

### 8.6 Administration, audit, search, dashboard

| # | Capability | Phase 13 state | Backend state | Status | Ev | Conf |
|---|---|---|---|---|---|---|
| R33 | Users CRUD + `department`/`title` | `userApi` ×20 (unwired) | `usersRouter` L153/158/172/219; `department`/`title` in user model L29–30 | `CONTRACT ONLY` ⚠ | §12.5 (stale mock annotation) | HIGH |
| R34 | Permission overrides INHERIT/GRANT/DENY | Mock UI, local state | `GET/PUT/DELETE /users/:id/overrides` L269/L279/L315 | `UI ONLY — MOCK` | `Admin.tsx` | HIGH |
| R35 | Project access management (`projects.access`) | Mock, local | `GET/PUT /users/:id/projects` L334/L351 (requires `projects.access`) | `UI ONLY — MOCK` | `Admin.tsx` | HIGH |
| R36 | Effective-permission preview | Mock | `GET /users/:id/effective` L427 | `UI ONLY — MOCK` | `Admin.tsx` | HIGH |
| R37 | Password reset | Mock | `POST /users/:id/reset-password` L258 (`users.manage` OR `users.resetPassword`) | `UI ONLY — MOCK` | `Admin.tsx` | HIGH |
| R38 | Roles administration (`roles.manage`) | Mock `ROLE_BASE` display | `roles.routes.ts` L24 | `UI ONLY — MOCK` | `Admin.tsx` L6 | HIGH |
| R39 | Audit log + filters (O8) | Mock ×1 | `audit-logs` via `systemRouter` | `UI ONLY — MOCK` | `Audit.tsx` | HIGH |
| R40 | Global search (O9) — server-scoped | **Client-side filter over `data.ts`** | `GET /search` L114 → `globalSearch(q, userId)` — row-by-row authorized, `limit` 5/type | `CONFLICT` ⚠ | §12.6 | HIGH |
| R41 | Notifications | Mock ×7 | `GET /notifications` via `systemRouter` | `UI ONLY — MOCK` | `Notifications.tsx` | HIGH |
| R42 | Dashboard (O7) — operational, no financial KPI | Operational counters, mock | Aggregations via existing endpoints | `UI ONLY — MOCK` ⚠ | `Home.tsx` | HIGH |
| R43 | Reports / exports | `reportApi` ×3 / ×5 | `GET /projects/export/xlsx` L94 (`reports.view`) | `CONTRACT ONLY` | `Reports.tsx` | HIGH |

### 8.7 Backup, system, cross-cutting

| # | Capability | Phase 13 state | Backend state | Status | Ev | Conf |
|---|---|---|---|---|---|---|
| R44 | Backup list / create / verify | Raw `data.ts` `backups` | `backups` via `systemRouter` | `UI ONLY — HARDCODED` ⚠ | `Settings.tsx` L6, L32 | HIGH |
| R45 | Restore (O10) | Mock | **`RESTORE_NOT_SUPPORTED` 501** (`system.routes.ts` L66+) | `CONFLICT` ⚠ | §12.7 | HIGH |
| R46 | Arabic/English + RTL | Complete (`ar.ts`, `en.ts`, `direction.ts`) | n/a | `IMPLEMENTED` | `i18n/` | HIGH |
| R47 | Loading / empty / error states | Present (`states.tsx`, `EmptyState`, `errBox`) | n/a | `IMPLEMENTED` | `boundaries/states.tsx` | HIGH |
| R48 | Accessibility baseline | `a11y.spec.ts` (9,164 B) exists | n/a | `NOT VERIFIABLE` | spec not executed | MEDIUM |
| R49 | Responsive behaviour | `phase7-responsive-probe.spec.ts` exists | n/a | `NOT VERIFIABLE` | spec not executed | MEDIUM |
| R50 | Production fixture isolation | `api.ts` guarded L12–14; **`data.ts` unguarded** | n/a | `CONFLICT` ⚠ | §7.3 escape B | HIGH |

### 8.8 Distribution

| Status | Count | Rows |
|---|---|---|
| `IMPLEMENTED` | 8 | R01–R03, R05, R07, R08, R20, R21 (+R46, R47 if counted as cross-cutting: 10) |
| `PARTIALLY IMPLEMENTED` | 3 | R04, R06, R15 |
| `UI ONLY — MOCK` | 17 | R14, R16, R22, R24–R26, R28, R30–R32, R34–R39, R41, R42 |
| `UI ONLY — HARDCODED` | 3 | R27, R29, R44 |
| `CONTRACT ONLY` | 4 | R11, R12, R33, R43 |
| `BACKEND ONLY` | 4 | R13, R17, R18, R19 |
| `ABSENT` | 1 | R09 |
| `CONFLICT` | 5 | R10, R23, R40, R45, R50 |
| `NOT VERIFIABLE` | 2 | R48, R49 |

**Reading of the distribution (TECHNICAL INFERENCE, HIGH):** the Phase 13 app is **not** an integration. It is a high-fidelity, well-localised *prototype with one real vertical*. Twenty of fifty rows are UI-only against synthetic data; only eight are genuinely implemented end to end, and four of those eight are the auth pair plus two project mutations. The most valuable asset is not the data layer — it is the interaction design, the Arabic/RTL i18n corpus, the component kit, and the honest-money presentation rules (§11).

---

## 9. Frontend → Backend Contract Matrix

Schema L2 applies (12 fields). Twelve contracts are analysed; C01–C04 are the wired slice, C05–C12 are the ones that will define Phase 14 work.

### 9.1 Matrix

| # | F1 Domain | F2 Consumer | F3 Call | F4 fixture/http | F5 Backend route | F6 Gate | F7 Scoping | F8 Request | F9 Response | F10 Deferred money | F11 Error | F12 Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C01 | Login | `auth.tsx` → `session.ts` | `session.login` | ✅ / ✅ | `POST /api/auth/login` L83 | none (public) | n/a | `loginSchema` | `accessToken` + `user{permissions}` | n/a | 401 Arabic message | `IMPLEMENTED` HIGH |
| C02 | Session restore | `auth.tsx` | `session.me` | ✅ / ✅ | `GET /api/auth/me` L144 | `requireAuth` | own identity | — | user + permissions | n/a | 401 self-heals | `IMPLEMENTED` HIGH |
| C03 | Project list | `Projects.tsx` | `mrApi.projects` | ✅ / ✅ | `GET /api/projects` L66 | `projects.view` | membership-scoped, NONE excluded | `page/pageSize/search/sort/includeDeleted` | `PagedResult<Project>` | n/a | 4xx `{message}` | `PARTIALLY IMPLEMENTED` HIGH (pageSize=1000) |
| C04 | Project create/edit | `Projects.tsx` | `mrApi.createProject` / `updateProject` | ✅ / ✅ | `POST` L167 / `PUT` L184 | `projects.create` / `projects.edit` | server-enforced | `projectSchema` / `.partial()` | project row | `contractValue` may be null | zod flattened | `IMPLEMENTED` HIGH |
| C05 | Portfolio financials | `Financials.tsx` | `boqApi`, `ipcApi` | ✅ / ❌ | `GET /api/projects/financials` L29 | `projects.view` | member projects only | — (no params) | project fields + `boqTotal` + `executedTotal` (approved IPC only) + full `ipcs[]` | `numericOrUnavailable(...,'NOT_ENTERED')` — **never 0** | — | `CONTRACT ONLY` HIGH |
| C06 | Project financials detail | `ProjFinancials` | none | ✅ / ❌ | `GET /:id/financials` L123 | `projects.view` + `requireProjectAccess` | `scopeProjectRow()` + `hideExistence` | — | `project{}`, `boqTotal`, `approvedIpcTotal`, `payments`, `tax`, `retention`, `advance` | **4 explicit `unavailable` envelopes** L145–148 | 404 hides existence | `CONTRACT ONLY` HIGH |
| C07 | BOQ CRUD | `ProjectWorkspace` `BoqPanel` | `boqApi.*` ×5 | ✅ / ❌ | `boq.routes.ts` (mounted under `/projects`) | `projects.view` / `.edit` | project-scoped | BOQ item schema | BOQ rows | n/a | — | `UI ONLY — MOCK` HIGH |
| C08 | IPC workflow | `ProjectWorkspace` `IpcPanel` | `ipcApi.*` ×12 | ✅ / ❌ | `POST /:id/{submit,start-review,approve,reject,resubmit}` L355–386 | `projects.edit` (submit/review/resubmit) · **`ipcs.approve`** (approve/reject) | `scopeFromParam()` | `{notes}` / `{reason}` (required on reject) | IPC + `event` | money on IPC rows only | `REJECTION_REASON_REQUIRED`; `SELF_APPROVAL_DENIED` | `BACKEND ONLY` HIGH |
| C09 | Document status | `Archive.tsx` | `mockApi.*` | ✅ / ❌ | `PATCH /documents/:id/status` L542 | `archive.edit` + `scopeDocumentRow()` | document→project scope | `documentStatusSchema{status}` | document row | n/a | 400 `حالة غير صالحة` | `CONFLICT` HIGH (no matrix) |
| C10 | Global search | `Search.tsx` | **none** | ✅ / **n/a** | `GET /search` L114 | auth only; per-row `can()` | `globalSearch(q, userId)`; `visibleProject()` per hit; fail-closed on unknown user | `{q}` | `{projects,documents,warehouses,items,transactions}`, ≤5 each | n/a | empty object on blank query | `CONFLICT` HIGH |
| C11 | Users + overrides | `Admin.tsx` | `userApi.*` ×20 | ✅ / ❌ | `usersRouter` L153/158/172/219; `usersExtRouter` L258–L427 | `users.manage`; `users.resetPassword` alternative | `loadTargetUser`; last-admin guard | `userSchema` (+`department`,`title`) | user rows, override rows, effective map | n/a | `LAST_ADMIN` 409 | `CONTRACT ONLY` HIGH |
| C12 | Restore | `Settings.tsx` | **none** | ✅ / **n/a** | `system.routes.ts` L66+ | `backup.manage` | n/a | — | **501 `RESTORE_NOT_SUPPORTED`** | n/a | 501 | `CONFLICT` HIGH |

### 9.2 The four contracts that decide the verdict

**C06 — the deferred-money contract is already correct on both sides (VERIFIED FACT, HIGH; TECHNICAL INFERENCE, HIGH).**

Backend, `projects.routes.ts` L137–152:

```ts
project: { id, projectCode, contractValue: numericOrUnavailable(item.contractValue, 'NOT_ENTERED') },
boqTotal: sumOrZero(row.boq_total),
approvedIpcTotal: sumOrZero(row.approved_ipc_total),
payments:  unavailable('PAYMENTS_DEFERRED'),
tax:       unavailable('TAX_RULES_UNDEFINED'),
retention: unavailable('RETENTION_RULES_UNDEFINED'),
advance:   unavailable('ADVANCE_RULES_UNDEFINED'),
```

Frontend, `Financials.tsx` (128 lines) independently honours the same rules: `ind.contractValue == null ? na : fmt(...)` (L91), `s.approvedCount === 0 ? t('notAvailable') : ...` (L81), an explicit "remaining for disbursement" label with a gap note (L101–113), and a comment at L15–16 stating that hardcoded contract/executed/deduction constants were removed because the data model has no tax/retention/advance source.

**This is the strongest positive in the audit.** The owner's prohibition on fabricated money is satisfied *twice over* — in the new backend and in the old prototype UI — without coordination. It means the deferred-money contract is not a design risk; it is a wiring task.

**C08 — IPC workflow: backend ahead, frontend behind and using the documented-unsafe gate (VERIFIED FACT, HIGH).**

Backend implements the full cycle with an explicit transition map (`ipc.routes.ts` L86–92):

```ts
const IPC_TRANSITIONS = {
  draft: ['submitted'],
  submitted: ['under-review'],
  'under-review': ['approved', 'rejected'],
  approved: [],
  rejected: ['draft', 'submitted'],
};
```

with a comment at L82–84 recording that, unlike documents, IPC forbids the `submitted→approved` shortcut. `approve` and `reject` require `ipcs.approve` **plus** `requireNonSubmitter: true` (L370, L379); `reject` requires a non-empty reason (L373–375).

Frontend `ProjectWorkspace.tsx`:

- L202: `const IPC_STATUSES: IpcStatus[] = ['draft', 'submitted', 'approved', 'rejected'];` — **`under-review` does not exist in the UI.**
- L463–480: status changes are performed by opening the **generic edit form** with a different status: `setForm({ ...i, status: s })`, where `s` comes from `ipcApi.transitions(i.status)`.
- L213: `const canEdit = can('projects.edit') || can('projects.create');` — **approval is gated by `projects.edit`.**

`phase-14c/04-api-readiness.md` §4.5 and §2.4 explicitly label the `projects.edit` fallback as **"غير آمن"** (not safe) and require that self-approval be refused by personal rule regardless of roles. The frontend therefore uses precisely the substitute the Phase 14 documentation already rejected.

**C10 — global search: documentation says client-side filtering is unapproved; the frontend does exactly that (VERIFIED FACT, HIGH).**

`phase-14c/04-api-readiness.md` §2.7 states: "البحث العالمي (O9) — … الفلترة العميلية غير معتمدة" (client-side filtering is not approved) and §5 classifies search as `UNKNOWN-PROTECTED`.

Backend `system.routes.ts` L113–119:

```ts
const searchSchema = z.object({ q: z.string() });
systemRouter.get('/search', async (req, res) => {
  ... if (!parsed.success || !parsed.data.q.trim()) return res.json({});
  // Phase 5: hits are scoped to the caller's memberships server-side.
  res.json(await globalSearch(parsed.data.q, req.user!.id));
});
```

`global-search.service.ts` enforces per-row authorization: `loadContext(userId)`, fail-closed `if (!ctx) return empty`, `bypass = can(ctx,'projects.access')`, `memberOf` set, `visibleProject(pid, viewKey)` requiring the view key **and** membership. Items require `can(ctx,'warehouse.view')` with no project row. Transactions resolve scope through their warehouse.

Frontend `Search.tsx` L4 imports the five fixture arrays and filters with `s.includes(q.trim())` — no authorization, no scope, no server call, and it renders synthetic results for any query of length ≥ 2. The screen also carries an on-screen note `t('searchDemoNote')`, which is honest labelling — but the note does not prevent the screen from being the primary search UI at `/search`.

**C12 — restore: the UI promises a capability the backend refuses (VERIFIED FACT, HIGH).**

`system.routes.ts` L66+ returns **501 `RESTORE_NOT_SUPPORTED`**. `Settings.tsx` L32 renders `backups.map(...)` from fixture data with a restore affordance, assuming a `backup.manage` permission (L30). Nothing in the UI indicates restore is unavailable.

---

## 10. Authorization Reconciliation

### 10.1 The three-layer model as implemented backend-side — VERIFIED FACT (HIGH)

`authorization.service.ts` L1–14 states precedence explicitly, and the code implements it:

```
role base → DENY override (beats GRANT) → GRANT override
          → project-access narrowing (scoped CRUD only; never broadens)
          → global safety (active user, known key)
```

- `RANK = { NONE: 0, READ: 1, WRITE: 2, DELETE: 3 }` — a higher level includes the lower. **This answers T1** in `phase-14c/07-owner-decisions-and-blockers.md` §2.
- DENY is order-independent and beats GRANT (L85–87).
- `MANAGED_PERMISSIONS` = the 28 `ALL_PERMISSIONS` keys **plus** `roles.manage`, `projects.access`, `users.resetPassword` (L19–24). Unknown keys deny.
- `SCOPED_MIN_LEVEL` requires WRITE for `ipcs.approve` and `ipcs.resubmit` (L67–68).

### 10.2 Vocabulary vs role grants — the intended gap, confirmed — VERIFIED FACT (HIGH)

`packages/shared/src/permissions.ts` (65 lines) defines `ALL_PERMISSIONS` with 28 keys, including:

```ts
'ipcs.approve',    // L20
'ipcs.resubmit',   // L21
```

`ROLE_PERMISSIONS.admin` = `[...ALL_PERMISSIONS]`. No other role is granted either key.

**This exactly matches the owner decision recorded in `phase-14c/07` §1: `ipcs.approve` + `ipcs.resubmit` are approved *as vocabulary only*, with role assignment (D1) still open.** The 14B-05 §6 proposal (management = approve, technical = resubmit) is therefore correctly **not** implemented.

**Implication for Phase 14 (RECOMMENDATION):** until D1 is decided, any non-admin approval path is impossible by construction. That is a *safe* state, not a defect. It must not be "fixed" by granting the keys as a side effect of frontend work.

### 10.3 Backend-managed administration keys contradict 14B-05 §3 — VERIFIED FACT (HIGH)

`phase-14b/05-authorization-matrix.md` §1 classifies keys as `[Confirmed]`, `[Prototype-only]`, or `[Proposed]`, and §3 treats `projects.access` / `roles.manage` as prototype-only pending backend proof (referenced downstream as D7 in 14C-04 §2.5 and 14C-07).

**Measured reality:** all three are backend-managed first-class keys in `MANAGED_PERMISSIONS` (`authorization.service.ts` L19–24), grantable through the override API (`PUT /users/:id/overrides`), and `projects.access` is actively required by `GET/PUT /users/:id/projects` (auth.routes L334/L351).

**This is a documentation-vs-backend conflict, not an implementation defect.** The backend is ahead of the document that gates it. Reported here; **not resolved** (§13.2).

### 10.4 Frontend guards vs backend enforcement — the asymmetry is correctly declared

`router.tsx` L24–27 states: "UX-layer guard only: real authorization is enforced by the backend." That is the right posture and it is honest. Two consequences follow:

1. **No frontend guard can be a security control.** Every route-level guard measured in §6.2 is therefore advisory. This is *correct*, and it means the three unguarded routes (§6.2) are an inconsistency, not a vulnerability.
2. **Frontend permission checks must not become the contract.** `AuthProvider` derives `can()` from the session `permissions` array returned by `GET /api/auth/me`. If a Phase 14 screen adds a client-side `can('ipcs.approve')` check, it will be false for everyone but admin — and a developer under pressure will be tempted to widen it client-side, producing an approval button that works for admins and fails for management with a 403. **RECOMMENDATION:** any Phase 14 IPC screen must treat `can()` as *display* logic and must render the server's 403 faithfully rather than hiding the action based on a local map.

### 10.5 IDOR posture — VERIFIED FACT (HIGH), strong

Every item-level backend route measured passes through `requireProjectAccess(..., scopeProjectRow()|scopeFromParam()|scopeDocumentRow(), { hideExistence: true })`. `hideExistence` converts an unauthorized-but-existing record into a 404 rather than a 403, which prevents existence enumeration. This is the correct pattern and it is applied consistently across projects, documents, IPC, BOQ and stock.

**Gap (TECHNICAL INFERENCE, MEDIUM):** `hideExistence` is only as good as the frontend's willingness to display a 404 as "not found" rather than as an error. Not verifiable statically.

---

## 11. Owner Decision Conformance (O1–O13)

Each decision is tested against source. `Conforms` means: at least one side of the system demonstrably honours it. Conformance is recorded per side, because "backend conforms / frontend does not" is the dominant pattern in this audit.

| # | Decision (restated) | Backend | Frontend | Verdict | Evidence | Conf |
|---|---|---|---|---|---|---|
| O1 | User department/title in the model | ✅ `department`, `title` in user model L29–30 | Mock `MockUser` carries both | `CONFORMS` (both) | `auth.routes.ts` L29–30; `data.ts` L280–289 | HIGH |
| O2 | Contract value entered directly, **never derived from BOQ** | ✅ `numericOrUnavailable(item.contractValue,'NOT_ENTERED')`; BOQ sum kept as a *separate* field | ✅ `ind.contractValue` rendered directly, `na` when null | `CONFORMS` (both) | `projects.routes.ts` L37–41, L137; `Financials.tsx` L65–91 | HIGH |
| O3 | Document status changes permission-controlled with **defined transitions** | ⚠ `PATCH /:id/status` accepts any valid enum value **with no transition matrix** | ⚠ Mock dropdown, no matrix | **`NON-CONFORMING`** | `documents.routes.ts` L542–558; `documents.validators.ts` L20 | HIGH |
| O4 | IPC approval workflow required; self-approval refused | ✅ full cycle + `requireNonSubmitter` | ❌ absent; status edited via generic form under `projects.edit` | `BACKEND ONLY` | §9.2 C08 | HIGH |
| O5 | Disbursements deferred; must display as unavailable | ✅ no endpoint by design | ✅ "not available" + gap note | `CONFORMS` (both) | `Financials.tsx` L106–113 | HIGH |
| O6 | Tax/retention/advance deferred; must display unavailable | ✅ 3 `unavailable` envelopes | ✅ "not available" | `CONFORMS` (both) | `projects.routes.ts` L145–148 | HIGH |
| O7 | Dashboard operational, **not financial** | ✅ no financial aggregate endpoint | ✅ operational counters only; no financial KPI | `CONFORMS` (both) | `Home.tsx`; §9.1 | HIGH |
| O8 | Audit includes optional `projectId`; filters | ✅ filters + scoped project filter | ⚠ mock list, mock filters | `BACKEND ONLY` | `Audit.tsx`; `audit-logs` route | HIGH |
| O9 | Global search backend-authoritative, scoped | ✅ server-scoped, row-authorized, fail-closed | ❌ client-side filter over fixtures | **`NON-CONFORMING`** | §9.2 C10 | HIGH |
| O10 | Reset/backup design defined; restore by dry-run→commit | ⚠ reset implemented; **restore = 501** | ⚠ backup tab over fixtures; restore promised | `CONFLICT` | `system.routes.ts` L66+; `Settings.tsx` L32 | HIGH |
| O11 | CSV import ≤200 rows + duplicate rule | ✅ route exists | ⚠ wizard over `data.ts` | `BACKEND ONLY` | `Settings.tsx` L43 | HIGH |
| O12 | Soft delete for projects + dependents | ✅ `deletedAt`, restore, invisibility gate | ❌ delete is local-only | `BACKEND ONLY` | `projects.routes.ts` L201–219 | HIGH |
| O13 | ROLE_BASE literally; 3 layers + DENY; ≤200 rows; no hard delete; no fabricated money; username login; backend permissions | ✅ implemented exactly | ⚠ `ROLE_BASE` mirrored in mock `data.ts` L300–306 and displayed | `CONFORMS` (backend); mock mirrors | §10.1–10.2 | HIGH |

### 11.1 Conformance summary

- **Conforms on both sides (5):** O1, O2, O5, O6, O7.
- **Backend-only (5):** O4, O8, O11, O12, and O13's enforcement half.
- **Non-conforming (2):** **O3** (no document transition matrix anywhere) and **O9** (frontend search is client-side over fixtures).
- **Conflict (1):** O10 (restore promised by UI, refused 501 by backend).

**Key judgement (TECHNICAL INFERENCE, HIGH):** the owner's decisions have been **correctly translated into backend behaviour**. Where the frontend diverges, it diverges for a specific and fixable reason: the prototype predates the decisions and was never re-cut. This is a *wiring and re-cut* problem, not a *requirements misunderstanding* problem — which is the single most hopeful fact in this audit.

---

## 12. Documentation-vs-Backend Delta

This section records the largest structural discrepancy in the corpus. It is reported, not resolved.

### 12.1 The documentation's position — VERIFIED FACT (HIGH)

`phase-14c/04-api-readiness.md` §5:

| Status | Count | Composition |
|---|---|---|
| `EXISTING-VERIFIED` | **7** | auth ×4 + projects ×3 |
| `EXISTING-ADAPT` | 1 | `GET /projects` → ListQuery |
| `PROPOSED-READY` | ~20 | business rules / contracts fixed in 14B |
| `PROPOSED-BLOCKED-BUSINESS` | 3 | CSV import, roles admin, project access |
| `UNKNOWN-PROTECTED` | **4** | project detail, document lists/detail, **BOQ/IPC existence**, search/inventory |

`phase-14b/03-api-contracts.md` and `phase-14b/04-frontend-integration-map.md` treat everything outside the wired slice as `[Proposed]`. The documentation's operating assumption is: **the backend is roughly four endpoints wide, and Phase 14 must build the rest.**

### 12.2 The backend's actual width — VERIFIED FACT (HIGH)

`apps/api/src/routes/index.ts` mounts **15 routers**:

```
/auth · /users (×2) · /roles · /projects · /documents · /folders
/warehouses · /items · /stock · /sites · /material-requests
/import · /config · / (system: search, notifications, audit-logs, backups)
```

Verified route counts by module (from `router.<verb>('` scans):

| Module | Notable routes verified with line numbers |
|---|---|
| `projects` | `GET /financials` L29 · `GET /` L66 · `GET /export/xlsx` L94 · `GET /:id/members` L104 · `GET /:id/financials` L123 · `GET /:id` L154 · `POST` L167 · `PUT` L184 · `DELETE` L201 · restore L212 |
| `ipc` | `status-events` L58 · `submit` L355 · `start-review` L362 · `approve` L369 · `reject` L376 · `resubmit` L385 · `IPC_TRANSITIONS` L86 |
| `documents` | `PATCH /:id/status` L542 · `POST /export/zip` (post-L560) |
| `auth`/`users` | `login` L83 · `refresh` L108 · `logout` L132 · `me` L144 · users CRUD L153–L219 · `reset-password` L258 · overrides L269–L315 · projects L334/L351 · `effective` L427 |
| `stock` | `POST /transactions` L195 · `DELETE /transactions/:id` L224 (always 400 — immutable ledger) |
| `system` | `GET /search` L114 · `/notifications` · `/audit-logs` · `/backups` (restore → 501 L66+) |

### 12.3 The delta — VERIFIED FACT (HIGH)

| Capability | Documentation says | Backend actually has |
|---|---|---|
| BOQ | `UNKNOWN-PROTECTED` — "existence confirmed by name only" | `boq.routes.ts`, mounted, project-scoped |
| IPC workflow | `PROPOSED-READY` — requires P0 schema work | 5 endpoints + transition map + status events + non-submitter rule |
| Documents / folders | `UNKNOWN-PROTECTED` | Both routers, 706-line documents module, status + ZIP export |
| Project detail | `UNKNOWN-PROTECTED` | `GET /:id` with `hideExistence` |
| Search | `UNKNOWN-PROTECTED` + `PROPOSED-READY` | Server-scoped, row-authorized implementation |
| Roles admin | `PROPOSED-BLOCKED-BUSINESS` (key "does not exist") | `roles.manage` is a managed backend key; router mounted |
| Project access | `PROPOSED-BLOCKED-BUSINESS` (prototype-only key) | `projects.access` is a managed backend key, actively enforced |
| Users + dept/title | `PROPOSED-READY` (needs schema) | Model already carries `department` / `title` (L29–30) |

### 12.4 Document status: the O3 gap, precisely — VERIFIED FACT (HIGH)

`documents.validators.ts` L20:

```ts
export const documentStatusSchema = z.object({ status: <7-value enum> });
```

`documents.routes.ts` L542–558:

```ts
documentsRouter.patch('/:id/status', requireProjectAccess('archive.edit', scopeDocumentRow()), async (req, res) => {
  const parsedStatus = documentStatusSchema.safeParse(req.body);
  if (!parsedStatus.success) return res.status(400).json({ message: 'حالة غير صالحة' });
  const existing = await documentRepository.findById(...);
  if (!existing) return res.status(404).json({ message: 'المستند غير موجود' });
  const updated = await documentRepository.update(existing.id, { status: parsedStatus.data.status });
  auditService.log(req, 'status-change', 'document', existing.id, {status: existing.status}, {status: parsedStatus.data.status});
  notificationService.create({ type: 'document-status', ... });
  res.json(updated);
});
```

Validation is **enum membership only**. There is no `DOC_TRANSITIONS` table, no `from→to` check, no per-transition permission. Any valid status may follow any valid status under a single `archive.edit` grant.

**Consequence:** `approved → draft` is currently permitted. `archived → draft` is permitted. This is a **direct, unmitigated** violation of O3 ("document status changes permission-controlled with defined transitions"), and it is the one owner decision with **no conforming implementation on either side**.

**Contrast (VERIFIED FACT, HIGH):** the IPC module does this correctly, with an explicit matrix and a comment recording *why* (`ipc.routes.ts` L82–92). The pattern exists in the codebase; it simply was not applied to documents.

### 12.5 Stale mock annotation — VERIFIED FACT (HIGH)

`adapters/mock/data.ts` L280–289 labels `department` and `title` as a **"PROTOTYPE-ONLY mock extension."** The backend user model carries both fields (`auth.routes.ts` L29–30). The annotation is stale and, if trusted by a Phase 14 implementer, would cause a real field to be treated as fiction and possibly dropped.

### 12.6 Global search scoping — VERIFIED FACT (HIGH)

Covered in §9.2 C10. The operational point for this section: 14C-04 §2.7 classifies search as needing design work and forbids client-side filtering; the backend already implements the *forbidden alternative's replacement* correctly. The documentation understates the backend by one full capability.

### 12.7 Backup restore — VERIFIED FACT (HIGH)

`system.routes.ts` L66+ returns **501 `RESTORE_NOT_SUPPORTED`**. 14C-04 §2.8 describes restore as `PROPOSED-READY` with a dry-run→commit design. The discrepancy is one of *documented intent vs deliberate refusal*; the 501 is the safer position and should be treated as the current truth.

### 12.8 Why this delta matters — TECHNICAL INFERENCE (HIGH)

A Phase 14 work plan derived from the Phase 14 documentation would **rebuild capabilities that already exist** — BOQ, IPC workflow, documents, search, roles, project access, users-with-department. That is the most expensive possible error available in this programme: it burns implementation budget on duplication and, worse, would produce a *second* implementation of IPC approval and project access alongside the existing one, with divergent rules.

**RECOMMENDATION:** the first Phase 14 action is a **backend inventory re-baseline** (WP-0 class), authored from source rather than from the 14C documents. This audit's §12.2–12.3 and §9.1 are usable as a starting inventory but are not a substitute for a signed-off re-baseline.

---

## 13. Conflicts Between Decision Documents and Prior Reports

Per mandate, conflicts are **reported, not resolved.**

### 13.1 WP3A's central claim is false — VERIFIED FACT (HIGH)

`WP3A_FRONTEND_IDENTITY_AUDIT.md` L16: *"The frontend at `apps/web` actively serves the **Phase 14 UI**, not the legacy frontend."* L255: *"**API Adapter** `apps/web/src/lib/api.ts` — Lines 1-198: Centralized axios wrapper, auth retry, no VITE_PROTOTYPE in current version"*. L117 and L214 describe merge conflicts as "resolved routes are Phase 14-aligned nonetheless."

Re-verified against the files:

| WP3A claim | Measured | Verdict |
|---|---|---|
| `apps/web/src/lib/api.ts` is an **axios** wrapper | `apps/web/package.json` contains **no** `axios`; **0** occurrences of `axios` in all of `apps/web/src`; the file uses native `fetch` with `credentials: 'include'` (L52, L76, L103) | **FALSE** |
| The file is **198 lines** | The file is **180 lines** | **FALSE** |
| `apps/web` serves the Phase 14 UI | `apps/web/src` contains **158 conflict-marker lines across 79 hunks**; it is not a buildable tree as committed | **FALSE** |
| Merge conflicts are "resolved" | The markers are *present in the working tree*, unremoved | **FALSE** |

**Assessment (TECHNICAL INFERENCE, HIGH):** WP3A's conclusion was reached from a plausible-looking heuristic (recent mtimes, a file named `api.ts`, a large `App.tsx`) without verifying the decisive facts (marker presence, dependency presence). Its verdict must be treated as **withdrawn**. Any Phase 14 plan that assumes `apps/web` is the Phase 14 UI will start by deleting or overwriting the conflicted tree — which is exactly the destructive action the mandate prohibits.

**Note on scope of this finding:** WP3A is not merely "imprecise". It asserts a *file-level* fact (axios) that is checkably wrong, and a *build-state* fact (resolved) that is checkably wrong. That is the class of error that makes downstream decisions unsafe.

### 13.2 Documentation vs backend — §12

`phase-14b/05` §3 and `phase-14c/04` §2.5/§5 classify `projects.access`, `roles.manage`, and `users.resetPassword` as prototype-only/pending, while `authorization.service.ts` L19–24 treats all three as managed backend keys. **Unresolved conflict.** Consequence: D7 ("does the key exist?") is not an open question of fact — it is an open question of *policy* (who may hold it).

### 13.3 14B-05 §6 role matrix vs shipped `ROLE_PERMISSIONS` — VERIFIED FACT (HIGH)

14B-05 §6 proposes management = `ipcs.approve`, technical = `ipcs.resubmit`. `permissions.ts` grants neither to any non-admin role. Per 14C-07 §1, only D1 (role assignment) is open — so the *shipped* state is correct and the *proposed* matrix is correctly unimplemented. **Not a defect; a correctly-tracked pending decision.** Recorded so that no implementer "fixes" it unilaterally.

### 13.4 WP3B's terminal instruction vs WP3C's existence

`WP3B_SOURCE_RECOVERY_AND_CONFLICT_PROVENANCE_AUDIT.md` L478 states: *"Stop after the report; no WP3C — No further action is taken. This report is the terminal artifact of WP3B."*

WP3C was subsequently and separately authorised by the owner. **No conflict in authority** — but the record must show that this audit's existence is an owner action, not a continuation WP3B authorised. Stated here for provenance.

### 13.5 The README's "fails explicitly" claim vs measured behaviour — VERIFIED FACT (HIGH)

`phase-13/app/README.md` states that all domains except session and Projects are "not wired" and that "those screens fail explicitly."

**Measured:** 11 screens throw (correct), 2 crash with `TypeError` (a leaky failure, §7.3 escape A), and **3 screens do not fail at all** — they render synthetic data (§7.3 escape B). The claim is **partially false** in the most consequential direction: the exceptions are silent.

### 13.6 Phase 3's `COVERAGE-AUDIT.md` vs Phase 13

`COVERAGE-AUDIT.md` exists only in the Phase 3 tree (70 Phase-3-only paths, §4.3). It documents Phase 3 coverage and has no Phase 13 successor. **TECHNICAL INFERENCE (MEDIUM):** coverage claims made there cannot be assumed to hold for Phase 13's new HTTP adapter, which it predates.

---

## 14. Options A–D

Four paths were compared. All four are stated as engineering options; the choice between them is an **OWNER DECISION** (§15.0 / §16).

### Option A — Adopt Phase 13 as the Phase 14 frontend and extend it in place

Continue building on `phase-13/app`: wire each module's http adapter namespace to its (already existing) backend route, remove the raw `data.ts` imports, remove the `pageSize=1000` hack, and re-cut the IPC and document-status UIs.

| Dimension | Assessment |
|---|---|
| Reuse | **Maximum** — component kit, i18n/RTL corpus, honest-money rules, route tree, 24-spec regression net all carry over |
| Cost to first usable module | **Lowest** — Projects already works end to end |
| Risk | Medium: the app is not a workspace member; the adapter boundary is broken in 4 files; fixture data is importable in production builds until fixed |
| Blocked by | Nothing structural. Requires the concrete work packages in §15. |
| Honesty posture | Starts from the *correct* premise (prototype + one vertical) rather than a false one |

**Principal weakness:** the adapter boundary must be *repaired*, not merely respected. Option A inherits four silent-fixture screens that must be removed as package #1, not deferred.

### Option B — Rebuild Phase 14 from scratch, treat Phase 13 as a design reference only

| Dimension | Assessment |
|---|---|
| Reuse | Design and interaction patterns only; no code |
| Cost | **Highest** — discards 59 files of working, RTL-correct, decision-conformant UI |
| Risk | High: re-implements O2/O5/O6/O7 presentations that are already correct, and re-introduces the exact mistakes they avoid |
| Honest rationale | Only justified if the component kit or i18n approach is deemed unacceptable |

**Assessment (RECOMMENDATION):** not justified by the evidence. The audit found no architectural defect in the UI layer — only in the data boundary. Rebuilding to fix a data boundary is disproportionate.

### Option C — Recover the legacy `apps/web` tree and continue there

| Dimension | Assessment |
|---|---|
| Reuse | 158 marker lines across 79 hunks must be resolved; the tree does not currently build |
| Cost | Unknown and unbounded — conflict resolution in a 532-line `App.tsx` plus a conflicted `DashboardPage` |
| Risk | **Highest** — and the resolution has no oracle: the two sides of the merge encode different intents |
| Additional hazard | Any resolution is an unreviewable, non-deterministic act of authorship by whoever performs it |
| Evidence | §13.1; WP3B's conflict provenance (all 81 hunks trace to `f91ed2f` alone) |

**Assessment (RECOMMENDATION):** rejected on evidence. Option C's only advantage over A is that it is *the committed* app — but that is precisely the property WP3A mistook for correctness.

### Option D — Hybrid: adopt Phase 13 for UI, re-derive the data layer from the backend inventory

Take `phase-13/app` as the *presentation* foundation but replace `services/api` wholesale with a generated/typed client derived from a signed-off backend inventory (§12.3), rather than incrementally wiring the existing adapters.

| Dimension | Assessment |
|---|---|
| Reuse | UI + i18n + interaction; replaces all of `services/api` (11 files) |
| Cost | Medium-high one-off, then **lowest marginal cost per module** |
| Risk | Medium: discards the working `http` slice's session handling (which is correct and non-trivial) |
| Strength | Eliminates the Proxy filler, the raw `data.ts` escape hatch, and the fixture/http dual-surface in one move |
| Weakness | Loses the *explicit-failure* property that currently protects against declared-but-fake integration; a generated client may silently return `undefined` where the Proxy threw |

**Assessment (RECOMMENDATION):** strongest long-term shape, but it should be **Option A's first two work packages plus a decision point**, not a separate path. Concretely: do P1 (delete silent-fixture paths) and P0 (inventory re-baseline) first; then decide whether to keep the hand-written adapter or replace it with a generated client. Deciding that now, before the inventory exists, would be premature.

### 14.1 Comparison summary

| Criterion | A | B | C | D |
|---|---|---|---|---|
| Time to first Phase 14 module | ★★★ | ★ | ✗ | ★★ |
| Preservation of decision-conformant UI | ★★★ | ✗ | ✗ | ★★★ |
| Structural cleanliness at end-state | ★★ | ★★★ | ✗ | ★★★ |
| Risk of hidden fabrication | ★★ (until fixed) | ★★★ | ★ | ★★★ |
| Depends on unresolved conflicts | Low | None | **Total** | Low |

### 14.2 Recommendation

**RECOMMENDATION — Option A, sequenced as A-then-D.**

Adopt `phase-13/app` (A) because it is the only tree that is simultaneously non-conflicted, decision-conformant on the money rules, and already holds a working real session plus a working real Projects vertical. Sequence it with D's data-layer replacement as a *conditional third phase*, gated on the backend inventory re-baseline. Reject C on evidence. Do not choose B.

This is a recommendation and it is labelled as one. The selection among A–D is recorded in §16 as an OWNER DECISION REQUIRED.

---

## 15. Work Packages

Twelve categories as prescribed. Each package states scope, outcome, dependencies, blocking decisions, and acceptance criterion. **No time estimates are given and no dates are proposed** — per Phase 14 house rule.

### WP-0. Source re-baseline and inventory (blocking gate)

| Field | Content |
|---|---|
| Scope | Re-author the backend endpoint inventory from source (not from 14C-04), covering §12.2's 15 mounts; confirm which routes are reachable against the *live* schema (migrations 22–24 are unapplied, §4.4) |
| Outcome | A signed inventory the frontend work can target, replacing 14C-04 §5's 7/1/~20/3/4 split |
| Depends on | Nothing |
| Blocks | **Everything.** Every other package would otherwise be built against a superseded document |
| Acceptance | Inventory lists every mounted route with method, path, gate, scoping and schema, verified against source; discrepancies vs 14C-04 enumerated |

### WP-1. Remove silent-fixture paths (highest severity)

| Field | Content |
|---|---|
| Scope | `Search.tsx` L4, `Items.tsx` L4, `Settings.tsx` L6, `Admin.tsx` L6 — replace raw `adapters/mock/data` value imports with adapter calls or explicit "unavailable in this build" states; add a production guard to `data.ts` mirroring `mock/api.ts` L12–14 |
| Outcome | Synthetic data can never be rendered as company data in a production build |
| Depends on | Nothing |
| Blocks | Any pilot or demo of the app to a real user |
| Acceptance | A production `http`-mode build has **zero** module-scope imports of `data.ts` values on any render path; `data.ts` throws or is tree-shaken under `PROD` |
| Owner impact | None — this is a correctness fix, not a scope choice |

### WP-2. Repair the `lookups` contract

| Field | Content |
|---|---|
| Scope | Either expose `lookups` as an object of throwing stubs in `http/api.ts`, or convert all 6 call sites (`Home` L44–45, `Stock` L75/L162–163, `Requests` L236–237) to functions |
| Outcome | The intended diagnosable "not wired" error instead of `TypeError: lookups.warehouses is not a function` |
| Depends on | Nothing |
| Blocks | Debuggability of every unwired module |
| Acceptance | In `http` mode, each of the three screens surfaces the named not-wired error, not a boundary crash |

### WP-3. Projects: pagination and delete/restore (O12)

| Field | Content |
|---|---|
| Scope | Remove `pageSize=1000` (`http/api.ts` L123–128) in favour of real `ListQuery`; wire `DELETE /:id` L201 + restore L212; expose the deleted-invisibility gate |
| Outcome | Projects vertical complete against O12 |
| Depends on | WP-0 (confirm route shapes) |
| Blocks | Every new list screen (the pattern would otherwise be copied) |
| Acceptance | ≥1,001 projects paginate correctly with a visible total; delete is server-side and restore works; deleted projects are invisible to non-deleters |

### WP-4. IPC workflow UI + decision D1

| Field | Content |
|---|---|
| Scope | Add `under-review` to the UI state set (`ProjectWorkspace.tsx` L202); replace status-via-edit-form with the 5 workflow endpoints; render the status-event timeline (`status-events` L58); surface `SELF_APPROVAL_DENIED` and `REJECTION_REASON_REQUIRED` faithfully; gate approve/reject on `ipcs.approve` **for display only** |
| Outcome | O4 satisfied end to end |
| Depends on | **D1** (role assignment for `ipcs.approve` / `ipcs.resubmit`); migrations 22–24 applied (or explicitly out of scope) |
| Blocks | Any IPC demo to the owner |
| Acceptance | A draft IPC cannot reach `approved` without passing `under-review`; the submitter cannot approve; rejection requires a reason; every transition appears in the timeline with actor and timestamp |
| **OWNER DECISION REQUIRED** | D1 — which roles receive `ipcs.approve` / `ipcs.resubmit`. Until decided, only `admin` can approve, and the UI must say so rather than hide the action |

### WP-5. Document status transition matrix (O3)

| Field | Content |
|---|---|
| Scope | Define `DOC_TRANSITIONS` (mirroring `IPC_TRANSITIONS` L86–92); enforce in `PATCH /documents/:id/status` L542; reflect the same matrix in the archive UI |
| Outcome | O3 satisfied on both sides — the only decision currently conforming on neither |
| Depends on | Nothing technical; needs the transition table itself |
| Blocks | Archive module sign-off |
| Acceptance | An invalid `from→to` pair returns 409 with a named code; the UI offers only legal targets; `approved → draft` is refused |
| **OWNER DECISION REQUIRED** | The actual matrix (which transitions are legal, and whether any transition needs a permission beyond `archive.edit`) |

### WP-6. Financials wiring (no new money)

| Field | Content |
|---|---|
| Scope | Wire `Financials` to `GET /projects/financials` L29 and `GET /:id/financials` L123; consume the `unavailable` envelopes verbatim; **do not** introduce any disbursement/tax/retention/advance computation |
| Outcome | O2/O5/O6 satisfied over the wire, matching the UI that already exists |
| Depends on | WP-0 |
| Blocks | Financial views in any pilot |
| Acceptance | Every deferred field renders from the server's `unavailable.reason`; no client arithmetic produces a money figure the server did not supply |

### WP-7. Authorization UI alignment

| Field | Content |
|---|---|
| Scope | Normalise route guards (`/settings`, `/search`, `/notifications` — §6.2); wire overrides/project-access/effective-preview to `usersExtRouter` L258–L427; treat `can()` as display-only |
| Outcome | Admin module real; guard posture consistent |
| Depends on | **D7** (policy for `projects.access` / `roles.manage` holders — see §13.2) |
| Blocks | Admin module sign-off |
| Acceptance | Every admin mutation appears in the audit log with before/after; `LAST_ADMIN` 409 is surfaced; no client-side permission map is the sole gate for a mutation |
| **OWNER DECISION REQUIRED** | D7 — who may hold `projects.access` and `roles.manage` given they are already backend-managed keys |

### WP-8. Search (O9) — replace client-side filtering

| Field | Content |
|---|---|
| Scope | Point `/search` at `GET /search` L114; delete the `data.ts` filter in `Search.tsx`; render per-group empty states; keep results scoped by the server |
| Outcome | O9 satisfied; the last fabrication-capable screen removed |
| Depends on | WP-1 (same file) |
| Blocks | Nothing; but it is the smallest change with the largest honesty gain |
| Acceptance | Search returns only server-authorized hits for a user with NONE membership on a project |

### WP-9. Deferred and refused capabilities — make refusal visible

| Field | Content |
|---|---|
| Scope | Restore (`Settings.tsx` L32) must show `RESTORE_NOT_SUPPORTED` rather than a working-looking affordance; CSV import must either target `import.routes.ts` or declare unavailability; backup list from the real route |
| Outcome | No UI promises a capability the backend refuses |
| Depends on | WP-0 |
| Blocks | Settings module sign-off |
| Acceptance | Every 501 in the backend maps to a visible explanation in the UI; no spinner over an unimplemented action |

### WP-10. Verification strategy

| Field | Content |
|---|---|
| Scope | Decide the fate of the 24 fixture specs; add at least one `http`-mode smoke spec per module; add a build-time assertion that `data.ts` values are unreachable in `PROD`; retire `verify/_debug_item8.spec.ts` |
| Outcome | A regression net that tests the product, not the prototype |
| Depends on | WP-1, WP-2 |
| Blocks | Any claim that Phase 14 "works" |
| Acceptance | CI fails if a production build renders any fixture value; ≥1 passing http-mode spec per wired module |
| Note | `probe-mock-isolation.mjs` currently proves only transport selection and must not be mistaken for integration proof (§5.3) |

### WP-11. Packaging and workspace posture

| Field | Content |
|---|---|
| Scope | Decide where the Phase 14 frontend lives and how it is built: `docs/` is not a workspace member and `git ls-files docs` is 0 (§4.1). Promote to `apps/*`, or define an explicit build pipeline for `docs/` |
| Outcome | A buildable, version-controlled, tool-governed frontend |
| Depends on | Option selection (§14.2) |
| Blocks | Any deployment at all |
| Acceptance | The chosen tree participates in the workspace (or has a documented equivalent), is tracked by git, and builds from a clean clone |
| **OWNER DECISION REQUIRED** | Whether Phase 14 ships from `docs/frontend-rebuild/phase-13/app`, a promoted copy, or a new `apps/` package |

### WP-12. Governance and record-keeping

| Field | Content |
|---|---|
| Scope | Reconcile the documentation-vs-backend delta (§12) into a single authoritative inventory; correct or withdraw WP3A's verdict (§13.1); record D1/D7/D2 decisions; keep `phase-14c/04` from being used as a build target until re-baselined |
| Outcome | The corpus stops contradicting itself |
| Depends on | WP-0 |
| Blocks | Nothing technically; everything organisationally |
| Acceptance | One document is unambiguously the inventory of record; superseded claims are marked, not silently ignored |

### 15.1 Dependency graph

```
WP-0 (inventory)
 ├── WP-3 (projects pagination/delete)
 ├── WP-6 (financials)
 ├── WP-9 (refusals)
 └── WP-12 (governance)

WP-1 (silent fixtures) ── WP-8 (search, same file)
        │
WP-2 (lookups)
        │
        └── WP-10 (verification)

WP-4 (IPC) ── needs D1
WP-5 (documents) ── needs transition matrix
WP-7 (authz UI) ── needs D7
WP-11 (packaging) ── needs option selection
```

### 15.2 Suggested execution order (dependency only, no dates)

1. **WP-0** — without the inventory, every other package targets a document known to be wrong.
2. **WP-1 + WP-2** — cheapest, highest-severity, no dependencies, no owner decision needed.
3. **WP-8** — falls out of WP-1's file.
4. **WP-3** — unblocks list-pattern reuse.
5. **WP-5** — the only decision conforming nowhere; needs a small owner input.
6. **WP-4** — needs D1.
7. **WP-6, WP-7, WP-9** — in parallel once WP-0 is signed.
8. **WP-10, WP-11, WP-12** — institutionalise before the first pilot.

---

## 16. Final Verdict

### 16.1 Disclosure

The eleven questions below are **this audit's controlled restatement** (legend L3) of what a Phase 13 → Phase 14 reconciliation must settle. They were not found verbatim in the repository. They are numbered and answered in the same order they are posed so the mapping is auditable.

### 16.2 The eleven questions

**Q1 — Is the Phase 13 application the Phase 14 UI, or a prototype that must be re-cut?**

**A:** It is a **prototype with one real vertical**, not the Phase 14 UI. VERIFIED FACT (HIGH): 8 of 50 capability rows are `IMPLEMENTED`; 20 are UI-only against synthetic data; the default build serves a 225-line HTTP stub that throws for 7 of 11 namespaces (§7.1–7.4). It is nonetheless the *only* non-conflicted, decision-conformant presentation asset in the repository.

**Q2 — Which capabilities genuinely work over the default transport today?**

**A:** Login, session restore, logout, and the Projects vertical (list, create, edit) — plus `AppShell`'s project-name list. Two screens partially work (`Financials` on its `mrApi` call only; `Projects` with the `pageSize=1000` truncation). Everything else either throws, crashes, or renders fixtures (§7.4). VERIFIED FACT (HIGH).

**Q3 — Does the frontend honour the owner's prohibition on fabricated money (O2/O5/O6)?**

**A:** **Yes — on both sides, independently.** `Financials.tsx` renders `notAvailable` for absent contract value and for disbursement, and carries an explicit gap note (L81, L91, L106–113); the backend returns four named `unavailable` envelopes and never a zero (§9.2 C06). This is the strongest conformity in the system. VERIFIED FACT (HIGH).

**Q4 — Are the owner's decisions reflected in the backend implementation?**

**A:** **Largely yes.** Eleven of thirteen decisions conform on the backend; the two exceptions are O3 (document status has no transition matrix — §12.4) and O10's restore half (501 refusal, correctly safer than documented; §12.7). O9 conforms server-side and fails client-side. VERIFIED FACT (HIGH).

**Q5 — Are they reflected in the frontend?**

**A:** **No, and systematically.** Five decisions conform on both sides; five are backend-only; two are non-conforming (O3, O9); one conflicts (O10). The divergence is consistently "the prototype predates the decision" (§11.1). VERIFIED FACT (HIGH).

**Q6 — Is the frontend's authorization posture consistent with backend enforcement?**

**A:** Structurally yes, semantically one gap. Route guards are correctly declared UX-only (§10.4); backend IDOR posture (`hideExistence` + membership scoping) is consistently applied and strong (§10.5); the shared vocabulary matches the owner's "vocabulary only" state exactly (§10.2). The semantic gap is IPC approval being gated by `projects.edit` — the fallback the Phase 14 documentation itself labels unsafe (§9.2 C08). VERIFIED FACT (HIGH).

**Q7 — Does the Phase 14 documentation accurately describe the backend it plans against?**

**A:** **No — it understates it severely.** Documentation records 7 verified endpoints and marks BOQ, IPC, documents, search, roles, and project access as `[Proposed]` or `UNKNOWN-PROTECTED`; all six exist in source with line-verified routes and gates (§12.2–12.3). Building from the documents would duplicate existing implementations. VERIFIED FACT (HIGH).

**Q8 — Is there any path by which synthetic data can be presented as real data?**

**A:** **Yes — three screens, silently.** `Search.tsx` L4, `Items.tsx` L4, and `Settings.tsx` L6 import live fixture arrays at module scope; `data.ts` has no production guard (unlike `mock/api.ts` L12–14); `Items` mutations are local-state-only (§7.3 escape B). This is the audit's most serious finding and the strongest argument for WP-1 preceding all other work.

**Q9 — Is the Phase 13 codebase structurally sound enough to extend, or does it need replacement?**

**A:** **Sound enough to extend.** 59 files, no conflict markers, clean architecture map (routes → pages → features → components → services → adapters), working RTL/i18n, a complete component kit, and 24 regression specs. The defects are localised and named: one broken boundary (4 files), one malformed Proxy property (`lookups`), one truncation hack, one stale annotation (§12.5), and one debug artifact. Nothing found warrants replacement (§14 Option B).

**Q10 — What must be true before a Phase 14 module can be called "integrated"?**

**A:** Four conditions, none currently met repository-wide: (i) a signed backend inventory replacing 14C-04 §5 (WP-0); (ii) zero module-scope fixture-value imports on any render path, enforced at build time (WP-1, WP-10); (iii) every shell domain failing with a named, diagnosable error rather than a `TypeError` or silent success (WP-2); (iv) the specific decision for that module conforming on both sides — for IPC that requires D1, for documents that requires a transition matrix (WP-4, WP-5).

**Q11 — What remains with the owner?**

**A:** Six items, of which three block work packages:

| # | Decision | Blocks | Source |
|---|---|---|---|
| **D1** | Role assignment for `ipcs.approve` / `ipcs.resubmit` | WP-4 | 14C-07 §1 |
| **D-matrix** | The document status transition table (O3) | WP-5 | §12.4 |
| **Option** | Adoption path A / B / C / D (§14) | WP-11, and the programme's shape | §14.2 |
| **D7** | Policy for holders of `projects.access` / `roles.manage` (already backend-managed) | WP-7 | §13.2 |
| **D2** | Deleted-project visibility gate | WP-3 | 14C-04 §2.2 |
| **D-packaging** | Where the Phase 14 frontend lives and how it builds (`docs/` is not a workspace member) | WP-11 | §4.1 |

### 16.3 Overall verdict

> ## **FOUNDATION SUITABLE — SIGNIFICANT INTEGRATION REQUIRED**

This verdict is chosen from the four permitted values, and specifically over the alternatives:

- **Not `MINOR GAPS`** — because 20 of 50 capability rows render synthetic data, three screens do so *silently*, and two owner decisions (O3, O9) conform on neither side. That is not minor.
- **Not `MAJOR REWORK`** — because nothing found requires replacing the UI layer. The architecture map is clean, the component kit and i18n corpus are complete, the money rules are already correct, and one vertical already works end to end over HTTP. The defects are enumerated, localised, and each has a named work package with an acceptance criterion (§15).
- **Not `FOUNDATION NOT SUITABLE`** — because Options B and C were rejected on evidence (§14), leaving a viable path with the assets already present.
- **Not `INSUFFICIENT EVIDENCE`** — because the decisive facts were established statically at line level: the transport selection (§7.1), the unwired surface (§7.2), the silent-fixture escape (§7.3), the backend's true width (§12.2), and the three documentation contradictions (§13). Runtime verification was prohibited, and every claim that depends on it is labelled `NOT VERIFIED` rather than assumed.

**The sentence that carries the verdict:** *the Phase 13 application is the right presentation foundation and the wrong data foundation — and its data foundation is replaceable without touching the presentation layer.*

### 16.4 Blockers

Ordered by severity. Each is a finding, not an opinion.

| # | Blocker | Severity | Evidence | Class |
|---|---|---|---|---|
| B1 | Three screens render synthetic fixture data in production with no guard and no signal | **Critical** | §7.3 escape B | VERIFIED FACT |
| B2 | Phase 14 documentation understates the backend by ~6 modules; building from it duplicates existing work | **Critical** | §12.2–12.3 | VERIFIED FACT |
| B3 | Document status has no transition matrix on either side — O3 unmitigated | **Critical** | §12.4 | VERIFIED FACT |
| B4 | Default build's HTTP adapter covers one vertical; 7 of 11 namespaces throw | **High** | §7.2 | VERIFIED FACT |
| B5 | `lookups` yields a raw `TypeError` instead of the designed explicit failure | **High** | §7.3 escape A | VERIFIED FACT |
| B6 | IPC approval UI absent; existing status change uses the documented-unsafe `projects.edit` gate | **High** | §9.2 C08 | VERIFIED FACT |
| B7 | Global search is client-side over fixtures, contrary to O9 and to explicit documentation | **High** | §9.2 C10 | VERIFIED FACT |
| B8 | Migrations 22–24 unapplied while backend code references them | **High** | §4.4 | VERIFIED FACT |
| B9 | `pageSize=1000` truncates project lists silently | **Medium** | §7.5 | VERIFIED FACT |
| B10 | UI promises restore; backend returns 501 | **Medium** | §12.7 | VERIFIED FACT |
| B11 | `phase-13/app` is not a workspace member; `docs/` is untracked (`git ls-files docs` = 0) | **Medium** | §4.1 | VERIFIED FACT |
| B12 | 24 fixture-mode specs would encode prototype oracles as Phase 14 acceptance | **Medium** | §5.3 | VERIFIED FACT |
| B13 | WP3A's verdict is factually wrong (axios, resolved conflicts, identity) | **Medium** (organisational) | §13.1 | VERIFIED FACT |

### 16.5 Limitations of this audit

| Limitation | Consequence |
|---|---|
| **No runtime execution permitted** | All behaviour claims are source-text claims. Build products, bundling, tree-shaking, and actual failure surfaces are not observed. |
| **No type-check** | `tsc --noEmit` was not run. Import-graph and type-soundness claims are inferred from import text. |
| **Six Phase 14 documents read in part only** | 14B/02, 14B/06, 14B/07, 14C/02, 14C/03, 14C/05 were inventoried by size but not read in full. Nothing in the verdict depends on them; a claim that does not is not made. |
| **Backend route tables were scanned, not exhaustively read** | Function bodies were read only where a finding depends on them (IPC transitions, document status, financials, search, authorization, `server.ts`/`app.ts`). Route *counts* are reliable; per-route edge-case semantics are not exhaustively verified. |
| **Live database not queried** | Applied-migration state (19 rows, stops at `21_direct_amounts.sql`) is carried from prior verified work, not re-queried. B8 depends on it and is therefore MEDIUM on the schema side, HIGH on the code side. |
| **Nine-status legend and twelve contract fields are audit-authored** | They are internally consistent and applied uniformly, but they are not the owner's mandate. If the owner has a different vocabulary, §8 and §9 must be re-mapped. |
| **Eleven questions are a controlled restatement** | §16.1 states this plainly. |
| **No accessibility or responsive verification** | `a11y.spec.ts` and `phase7-responsive-probe.spec.ts` were not executed. R48/R49 are therefore `NOT VERIFIABLE`, not "passing". |

### 16.6 What this audit did not resolve — by design

- It did **not** decide Option A/B/C/D. It recommended A-then-D and labelled the recommendation as such (§14.2).
- It did **not** decide D1, D2, D7, the document transition matrix, or the packaging question. All six are listed as OWNER DECISION REQUIRED (§16.2 Q11).
- It did **not** resolve the documentation-vs-backend conflict (§13.2). It recorded both positions with line-level evidence.
- It did **not** edit, fix, or prepare any code. WP-1 through WP-12 describe work; none of it was performed.

---

## Appendix A — Evidence Index

Files read in full for this audit (paths relative to `D:\Default Project\company-ops-system`):

**Phase 13 application**
```
docs/frontend-rebuild/phase-13/app/README.md
docs/frontend-rebuild/phase-13/app/package.json
docs/frontend-rebuild/phase-13/app/vite.config.ts
docs/frontend-rebuild/phase-13/app/tsconfig.json
docs/frontend-rebuild/phase-13/app/src/app/router.tsx
docs/frontend-rebuild/phase-13/app/src/services/api/configuration.ts
docs/frontend-rebuild/phase-13/app/src/services/api/index.ts
docs/frontend-rebuild/phase-13/app/src/services/api/types.ts
docs/frontend-rebuild/phase-13/app/src/services/api/adapters/http/api.ts
docs/frontend-rebuild/phase-13/app/src/services/api/adapters/mock/api.ts        (guard + namespace index)
docs/frontend-rebuild/phase-13/app/src/services/api/adapters/mock/data.ts       (head + annotation regions)
docs/frontend-rebuild/phase-13/app/src/app/pages/Search.tsx
docs/frontend-rebuild/phase-13/app/src/app/pages/Settings.tsx                   (targeted)
docs/frontend-rebuild/phase-13/app/src/features/projects/components/Financials.tsx
docs/frontend-rebuild/phase-13/app/src/features/projects/components/ProjectWorkspace.tsx (targeted)
docs/frontend-rebuild/phase-13/app/verify/pw.config.ts
docs/frontend-rebuild/phase-13/app/verify/probe-mock-isolation.mjs
```

**Backend**
```
apps/api/src/server.ts
apps/api/src/app.ts
apps/api/src/routes/index.ts
apps/api/src/services/authorization.service.ts
apps/api/src/services/global-search.service.ts
apps/api/src/modules/projects/projects.routes.ts
apps/api/src/modules/projects/ipc.routes.ts
apps/api/src/modules/documents/documents.routes.ts                              (targeted L530-570)
apps/api/src/modules/documents/documents.validators.ts                          (targeted)
apps/api/src/modules/auth/auth.routes.ts                                        (route table)
apps/api/src/modules/system/system.routes.ts                                    (targeted)
apps/api/package.json
packages/shared/src/permissions.ts
```

**Phase 14 corpus**
```
docs/frontend-rebuild/phase-14/phase-14a-owner-decisions.md
docs/frontend-rebuild/phase-14/phase-14a-requirements-map.md
docs/frontend-rebuild/phase-14/phase-14b/01-business-rules.md
docs/frontend-rebuild/phase-14/phase-14b/03-api-contracts.md
docs/frontend-rebuild/phase-14/phase-14b/04-frontend-integration-map.md
docs/frontend-rebuild/phase-14/phase-14b/05-authorization-matrix.md
docs/frontend-rebuild/phase-14/phase-14c/01-readiness-traceability.md
docs/frontend-rebuild/phase-14/phase-14c/04-api-readiness.md
docs/frontend-rebuild/phase-14/phase-14c/06-implementation-roadmap.md
docs/frontend-rebuild/phase-14/phase-14c/07-owner-decisions-and-blockers.md
docs/frontend-rebuild/phase-14/phase-14c/WP3A_FRONTEND_IDENTITY_AUDIT.md
docs/frontend-rebuild/phase-14/phase-14c/WP3B_SOURCE_RECOVERY_AND_CONFLICT_PROVENANCE_AUDIT.md
```

## Appendix B — Preservation Attestation

| Requirement | State | Evidence |
|---|---|---|
| Read-only investigation | **SATISFIED** | No write command issued other than creating this file |
| Exactly one new file | **SATISFIED** | Destination confirmed absent at start; one file created |
| No source edit / no conflict resolution | **SATISFIED** | No mutation of any tracked or untracked file |
| No folder move or copy | **SATISFIED** | No filesystem reorganisation |
| No `package.json` / workspace change | **SATISFIED** | Not opened for write |
| No `npm install` / build / dev server | **SATISFIED** | No such command executed |
| No backend start/restart | **SATISFIED** | No process management performed |
| No migrations / seeds / DB writes | **SATISFIED** | No database client invoked |
| No HTTP requests / no login / no browser | **SATISFIED** | No network call made |
| No `.env` change | **SATISFIED** | `.env*` absence verified by listing; nothing written |
| No Git mutation | **SATISFIED** | Only read verbs used (`rev-parse`, `status`, `diff --cached`, `stash list`); HEAD unchanged `f91ed2f9…`; 0 staged; 0 stashes |
| No RBAC change | **SATISFIED** | Role/permission tables untouched |
| Backend, DB, business data preserved | **SATISFIED** | No access beyond reading source |
| Dirty / untracked state preserved | **SATISFIED** | 46 porcelain entries at start and at end; 34 modified tracked, 359 untracked paths untouched |
| Do not describe the repository as "clean" | **OBSERVED** | §Document Control and the attestation above state explicitly that it is not clean, and distinguish "no changes attributable to this session" from "clean" |
| Report conflicts, do not resolve them | **OBSERVED** | §13.1–13.6, §12, §13.2 |
| Separate the five finding classes | **OBSERVED** | §2.1; every §8–§13 finding carries a class |
| Confidence per finding | **OBSERVED** | Every §8 and §9.1 row carries HIGH/MEDIUM/LOW |
| Exact paths, symbols, line numbers | **OBSERVED** | All findings cite file + line; symbol names given for components and handlers |
| Do not trust prior reports | **OBSERVED** | WP3A's central claim refuted (§13.1); 14C-04's inventory contradicted by source (§12) |
| Preserve owner decisions | **OBSERVED** | §11 tests all thirteen; §16.2 preserves the six open ones as owner decisions |

---

**END OF REPORT — WP3C**

*Verdict: FOUNDATION SUITABLE — SIGNIFICANT INTEGRATION REQUIRED.*
*Recommended sequencing: WP-0 (inventory) → WP-1/WP-2 (honesty and diagnosability) → WP-8 → WP-3 → WP-5 → WP-4 (needs D1) → WP-6/WP-7/WP-9 → WP-10/WP-11/WP-12.*
*This audit performed no implementation. No further action is taken by this work package.*
