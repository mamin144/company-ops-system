# Phase 4 — Architecture Map (written BEFORE any refactoring)

Date: 2026-10-20 · Target: `docs/frontend-rebuild/phase-03-prototype/` (the approved Phase 3 prototype is the Phase 4 codebase; the production `apps/web` remains unbuildable and out of the rebuild work area — see Phase 3 limitations).

## 1. Current state (before)

Flat `src/` tree, single-directory layering:

```
src/
├── main.tsx                 entry + provider tree + route tree + route Guard
├── auth.tsx                 demo session provider (sessionStorage), mock-sourced identity
├── i18n.tsx                 LangProvider + full AR/EN dictionary (699 lines, one file)
├── styles.css               all design-system CSS (41 KB)
├── components/
│   ├── Shell.tsx            approved app shell (Phase 5 rebuild target; preserved)
│   ├── CommandPalette.tsx   shell-owned palette
│   ├── ContextualExport.tsx export wrapper used by several screens
│   ├── icons.tsx            Icon primitive
│   ├── ui.tsx               design-system components (Button, Module, RecShell, toast, …)
│   ├── motion.tsx           GSAP/Lenis hooks (usePageMotion, useShellMotion, …)
│   └── bits/                approved motion bits (SplitText, FadeContent)
├── mock/
│   ├── api.ts               mock adapter (1,246 lines) — the ONLY data transport
│   ├── data.ts              fixture dataset + domain types + contract constants
│   ├── errorKeys.ts         server-error → i18n key mapping
│   └── exports.ts           CSV/JSON helpers + downloadFile
└── pages/                   19 screens, every one importing auth/i18n/mock/components directly
verify/                      Playwright E2E specs (no src imports — pure HTTP-level)
```

- **Entry/routing:** `main.tsx` holds providers AND routes (react-router v7, flat declarative tree, per-route permission Guard).
- **Data access:** every screen imports `mockApi`/`mrApi`/`boqApi`/… directly from `src/mock/api.ts` — no shared transport, no adapter boundary, no error normalization layer (each screen calls `errText`/toasts ad hoc).
- **State:** context providers only (auth session, language, toast) + local `useState` per screen. `sessionStorage` for session, `localStorage` for language. No server-state library, no URL state misuse.
- **i18n:** one 699-line file mixing dictionary and provider; `lang`/`dir` are applied on `documentElement`; persistence key `cos-proto-lang`.
- **Shared UI:** genuinely generic (`ui.tsx`, `icons.tsx`, `motion.tsx`, `bits/`, `exports.ts`) but physically sitting in a folder whose name implies shell/chrome ownership.

## 2. Target (after Phase 4) — feature-oriented modular architecture

```
src/
├── main.tsx                     slims to: mount root, import app bootstrap
├── app/
│   ├── bootstrap.tsx            provider composition + router + ErrorBoundary
│   ├── router.tsx               route tree + Guard (moved verbatim from main.tsx)
│   ├── providers/auth.tsx       session provider (unchanged behavior)
│   ├── layouts/AppShell.tsx     approved shell (moved, not redesigned)
│   ├── layouts/CommandPalette.tsx
│   ├── boundaries/ErrorBoundary.tsx  NEW — app-wide crash state
│   ├── boundaries/states.tsx    Forbidden / NotFound states
│   └── pages/                   session & utility pages outside business features
│       ├── Login.tsx  Settings.tsx  Search.tsx  Notifications.tsx
├── features/                    one folder per COS business module
│   ├── dashboard/components/Home.tsx        (+ index.ts)
│   ├── projects/components/{Projects,ProjectWorkspace,Financials}.tsx (+ index.ts)
│   ├── archive/components/Archive.tsx       (+ index.ts)
│   ├── inventory/components/{InventoryHub,Warehouses,Items,Stock}.tsx (+ index.ts)
│   ├── requests/components/Requests.tsx     (+ index.ts)
│   ├── reports/components/Reports.tsx       (+ index.ts)
│   └── administration/components/{Admin,Audit}.tsx  (+ index.ts)
├── shared/
│   ├── ui/{ui.tsx, icons.tsx, index.ts, ContextualExport.tsx, bits/…}
│   ├── lib/motion.tsx
│   ├── lib/files.ts             ← former mock/exports.ts (generic, dependency-free)
│   └── styles/styles.css
├── services/api/
│   ├── index.ts                 explicit adapter surface (single import boundary)
│   ├── client.ts                transport scaffold for the future HTTP adapter
│   ├── configuration.ts         adapter-resolution flags (VITE_PROTOTYPE)
│   ├── errors.ts                error-shape contract for HTTP errors
│   ├── types.ts                 pure (type-only) contract types re-export
│   └── adapters/mock/{api.ts, data.ts, errorKeys.ts}   isolated mock boundary
├── i18n/
│   ├── index.ts                 public exports (Lang, TKey, TVars, useLang, LangProvider)
│   ├── direction.ts             lang → dir mapping helpers
│   ├── setup/index.tsx          provider (dictionary assembly, persistence, lang/dir effect)
│   └── locales/{ar.ts, en.ts}   dictionary split AR/EN (TKey still derived from ar)
└── verify/                      unchanged E2E specs + new phase-4 spec
```

Not created (deliberately — no empty scaffolding): `app/bootstrap/`, `features/*/hooks|model|api|types` sub-units with no content, `test/` tree. Feature sub-folders are added in later phases when real content justifies them; each feature here gets only `components/` + `index.ts`.

Files **moved but not refactored**: all screens keep their exact behavior; only import paths change (to the `@/` alias). The approved design, SplitText behavior, greeting, and motion code are untouched except where the new boundary files are introduced.

## 3. Dependency rules implemented

1. `app/` composes providers, router, layouts, boundaries, pages, features (`app/*` may import anything below it).
2. `features/*` import from `@/i18n`, `@/app/providers/auth`, `@/shared/ui`, `@/shared/lib`, `@/services/api`.
3. `shared/` imports only react/react-router, `@/i18n`, and (documented wart, see §4) the mock boundary for `STATUS_AR`/`ERR_KEYS` until module migrations deduplicate status/error vocabulary.
4. `services/api/` imports no React UI. The mock adapter is reachable ONLY under `services/api/adapters/mock/` behind the import-time guard.
5. Feature-to-feature imports: none exist; feature access goes through each feature's `index.ts`.

## 4. Known boundary warts carried over (documented, not smuggled)

- Screens still read raw fixtures directly (`documents`, `items`, … from the mock dataset) and domain constants (`STATUS_AR`, `STATUS_TONE`, `ROLE_BASE`, `MANAGED_GROUPS`). Root cause is Phase-3 screen design (demo data inline), addressed screen-by-screen in module phases (5+). Phase 4 re-points the imports and documents them, without rewriting screens.
- The "API adapter" is the isolated mock adapter; the verified real contract surface is `apps/api/src/routes` (no phase-01 contract-map document exists in the repo — Phase 1 audit artifacts were never committed). Phase 4 therefore does NOT invent HTTP endpoints; it delivers the transport scaffold (`client.ts`, `errors.ts`) + typed adapter interface so a real adapter can be implemented in Phase 5 against a then-written contract map.
