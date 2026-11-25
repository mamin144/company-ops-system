# VISUAL-COMPOSITION-REDESIGN-REPORT.md — Phase 3.16

## Final status: PASS WITH LIMITATIONS

Limitations are the standing human-only category (taste calls, real devices, real
screen reader, human contrast adjudication). No prototype-fixable item is open.
Note on paths: this report lives at `docs/frontend-rebuild/phase-03/` exactly as
instructed; that directory did not previously exist (prior docs live in
`phase-03-prototype/`). The diagnosis file sits with the prototype docs at
`docs/frontend-rebuild/phase-03-prototype/VISUAL-COMPOSITION-DIAGNOSIS.md`. All
code changes are inside `phase-03-prototype/` only.

## 1. Diagnosis and root causes

Screenshot-driven audit of the 3.15 build (56 renders: 14 screens × AR/EN ×
light/dark + EN mobile) produced 7 findings (`VISUAL-COMPOSITION-DIAGNOSIS.md`:
C-01…C-07): tall empty stat cards with 3× repeated footers; solid-red row
deletes dominating rows; filter toolbar and table as disconnected boxes with
full-width stacked controls; flat ungrouped nav; airy table rhythm; plus dark/EN
verification notes. The owner-attached images (BentoFlow dashboard, Pluto
projects, workspace sidebar) were opened and analyzed **as quality-bar
references** — they are English SaaS mockups, not COS screens, and were never
treated as current-state evidence. Adopted from them: bandless text table
headers, grouped sidebar navigation, single-row filter workflow. Explicitly
rejected: sparklines, charts, deltas, avatars, presence dots, progress bars,
team lists, upgrade promos (all invented data, forbidden by the phase).

## 2. Design direction and key design-system decisions

Same modern-SaaS identity as 3.14/3.15 (indigo primary, soft canvas, rounded
geometry, stroke icons) — this phase is composition. Decisions: nav groups from
the dictionary (3 keys × 2 locales, order/icons/permissions untouched); quiet
row danger (red text + hairline, solid reserved for dialog confirms); toolbar
merged into the list panel via pure-CSS adjacent-sibling styling (every list page
gains it, no JSX reordering); text sort headers instead of pill buttons; compact
stat rows with icon tiles and footers dropped where noisy; table rhythm
tightened. No new tokens except the already-present active-pill depth.

## 3. Concrete component and screen changes

- `Shell.tsx`: grouped nav render (+3 i18n keys), quiet topbar toggles, user chip.
- `Home.tsx`: `statCard` on 6 stat links; repeated demo footers removed (3 cards);
  pinned `<br>` kept.
- `styles.css`: nav sections, quiet row danger, merged toolbar/panel, inline
  desktop filters, compact stats + icon tiles, bandless headers, table rhythm.
- Icons: 27-glyph set audited in renders — consistent weight/alignment; unchanged.
- Login/Home/Archive/Stock/Requests/Admin/Financials/Audit/Reports/Settings/
  workspace/BOQ/IPC: composition gains via the shared rules above; no route,
  guard, permission, data, string, or behavior change anywhere.

## 4. Before/after comparison summary

`%TEMP%\opencode\phase316-visual-review\before\` (56 shots) vs `after\` (60 shots:
same 14 screens × 4 variants + EN mobile home/archive). Filename index:
`{screen}-{lang}-{theme}-{width}.png`. Representative deltas: dashboard stat
column ~40% shorter with zero data loss; row deletes demoted from solid blocks to
text+hairline; filter+table read as one container; sidebar shows 3 labeled groups;
dark archive toolbar merged identically. Dialog shots (viewer/approve/menu,
AR-light) confirm overlays follow the system.

## 5. Screenshot paths for all four variants

- AR-light / AR-dark / EN-light / EN-dark: dashboard, projects, archive, stock,
  requests, admin, financials, audit, reports, settings, workspace, login
  (1366px) + mobile home/archive (390px) + viewer/approve/menu dialogs.
- EN mobile home/archive captured; transfer dialog and issue dialog covered by
  the suites' dialog-behavior tests (not separately screenshotted).

## 6. Light/Dark parity and RTL/LTR findings

Dark received equal review: shared-rule changes (quiet fills, merged toolbar,
deeper pills, text sort headers) render coherently in dark with no per-theme
forks needed. RTL/LTR: group captions localized, logical properties throughout,
EN verified screen-by-screen; transfer From/To wrapping is pre-existing bidi
behavior, acceptable. No variant is materially weaker.

## 7. Responsive and accessibility results (measured, in-suite)

8 widths (320–1920) overflow matrices: zero overflow. Touch ≥44px measured;
keyboard focus + trap + restore; reduced-motion honored; `{token}`/CJK DOM scans
clean; scope denials and file-content export checks green; zero console/page
errors (listeners on every file). Contrast pairs untouched by this phase
(tokens kept); primary-button 5.47 and badge ratios stand from 3.14/3.15 runs.

## 8. Exact discovered test count, full-suite results, build, TypeScript

- Discovery: `test -c verify/pw.config.ts --list` → **239 tests in 12 files**.
- `tsc -p docs/frontend-rebuild/phase-03-prototype/tsconfig.json --noEmit` → exit 0.
- Temp build `vite build --outDir %TEMP%\opencode\phase316-build --emptyOutDir`
  (`VITE_PROTOTYPE=1`) → success; `dist/` rebuilt for preview :5199.
- Full suite `--reporter=list`, chromium, `%TEMP%` only:
  **239 run · 239 passed · 0 failed · 0 skipped · exit 0 (8.4 min)** — clean on the
  first full run; no test edits were needed in this phase.

## 9. Failures, flaky tests, limitations, owner decisions

- Failures: none. Flakes: none observed in the confirming runs.
- Limitations: taste-level judgment of the new composition (screenshots provided),
  real-device feel, real screen reader, human contrast adjudication.
- No new owner decisions required; the six standing production/contract decisions
  are unaffected.

## 10. Files changed and strict scope confirmation

- Modified (all inside `docs/frontend-rebuild/phase-03-prototype/`): `src/styles.css`,
  `src/components/Shell.tsx`, `src/pages/Home.tsx`, `src/i18n.tsx` (3 keys × 2),
  `VISUAL-COMPOSITION-DIAGNOSIS.md` (new).
- This report (in `phase-03/` per instruction). Production frontend/backend, APIs,
  database, business logic, permissions, dependencies, Git history: **not changed**
  (`git status` shows only pre-existing tracked entries plus untracked `docs/`;
  repo-root `test-results/` untouched).
