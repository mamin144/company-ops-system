# VISUAL-REDESIGN-REPORT.md — Phase 3.13 "Architectural Operations Console"

## 1. Selected art direction

**Architectural Operations Console** — editorial hierarchy combined with
precision-engineered information layouts. The interface borrows its visual language
from the domain itself: drawing indexes, revision tags, ruled ledgers, spec plates.
Warm-paper surfaces with ink text; one deep site-teal accent; amber reserved for
warnings; semantic status hues kept but restyled as outlined spec tags (shape + text,
never color alone).

Signature elements (the recognizable system):
1. **Index rail** — dark ink sidebar, destinations numbered 01–09 like drawing sheets,
   active destination a solid teal plate with white text.
2. **Editorial page heads** — eyebrow + display title + description + actions over a
   hairline rule with a 72px teal tick. No boxes around headers anywhere.
3. **Revision tags** — squared outlined status labels instead of pills.
4. **Ruled data tables** — banded header, hairline rows, tabular numerals.
5. **Reading sheet** — the Archive viewer body sits on a faintly ruled sheet with a
   teal-edged metadata block; the prototype-content banner persists.
6. **Briefing dashboard** — asymmetric lead/index composition instead of identical
   KPI tiles; status counts link into filtered lists.
7. **Split login** — ink brand panel (wordmark + module index 01–04) beside the
   demo-identity form on desktop; stacked on mobile.

## 2. Concepts considered and rejected

- **A. "Site Ledger"** (paper/ink/stamp vernacular): evocative of site paperwork, but
  stamp metaphors turn kitschy across 20+ dense screens, warm paper weakens reading
  contrast, and stamps don't scale to data density. Rejected for kitsch risk.
- **B. "Dark instrument console"**: generic-tech look; dark surfaces harm the Archive
  reading surface (a document reader must stay light); a dark rail alone keeps the
  template silhouette. Rejected for domain mismatch — kept only as an *accent* (the
  ink rail/bottom-bar), not the whole product.
- **C. Selected (above)**: native to contracting ops (drawings, revisions, ledgers,
  certificates), preserves light reading surfaces, treats density as a first-class
  citizen, mirrors cleanly in RTL, and yields ownable details no template has.

## 3. Core design principles

1. Domain-native, never decorative: every signature element quotes site paperwork.
2. Restraint gives impact: one accent (teal), amber only for warnings, semantics untouched.
3. Density is designed: instruments and ledgers, not cards, for data; cards only for navigation entry points.
4. Arabic-first: no letter-spacing on Arabic script (breaks joining) — tracking only under `html[dir='ltr']`; tabular numerals; bidi isolation kept.
5. States are visible without color alone: outlined tags, dots + labels, explicit copy.
6. Motion clarifies only: 150/220ms ease-out micro-interactions, press feedback, reduced-motion honored.

## 4. Palette and semantic roles

| Role | Light | Dark |
|---|---|---|
| Page / surface / raised | `#F5F4EF` / `#FFFFFF` / `#ECEBE4` | `#0B1220` / `#111C30` / `#182740` |
| Text / muted | `#1C2433` / `#475569` | `#EDF1F7` / `#94a3b8` |
| Primary action | `#0F766E` (white text, measured 5.47:1) | `#2DD4BF` (ink text) |
| Console ink (rail/bar/toast) | `#101A2C` | `#080E19` |
| Borders | `#E2E0D5` / `#ECEAE0` / `#C8C5B4` | `#22334E` / `#1A2A44` / `#2E425F` |
| Statuses | danger `#b91c1c`, success `#047857`, warning `#92400e`, info `#2563eb` — **byte-identical to 3.12** (measured AA) on unchanged soft fills | soft fills retinted (unchanged from 3.12) |

## 5. Typography (Arabic + English)

Cairo retained (available stack, no new dependencies). Scale: display h1 26px/800,
section 17px/800 with teal index bar, 14.5px h3, 13.5px table cells, 12.5px helpers,
12px/800 eyebrows, 11.5px table heads (caps + tracking **LTR only**). Data and
financial totals always `tabular-nums`; identifiers keep `.ltr` isolation.

## 6. Layout / spacing / surfaces / states / responsive

- Shell: 248px index rail (76px collapsed), slim command strip topbar, hairline
  breadcrumbs, centered 1440px content, dark bottom bar ≤767px with teal active.
- Spacing: 8/12/16/22 rhythm; panels 16–18px; header rule separates chrome from content.
- Surfaces: flat paper + one hairline elevation (no glass, no heavy shadows; one
  tinted shadow token for popovers/modals/toasts).
- Components: teal primary / bordered ghost / solid danger; 4px inputs; thick-underline
  tabs; outlined menus with teal top edge; top-accented modals; ink toasts.
- States: skeletons, honest empties, inline errors, disabled 0.55, danger-separated
  menus — all restyled, none restructured.
- Responsive: tables collapse to stacked cards ≤767px (unchanged mechanism);
  briefing/login grids stack ≤1024px/960px; 8-width matrix asserted by suites.

## 7. Per-screen changes

- **Login**: split brand/form composition; selected tile keeps readable hint.
- **Dashboard**: briefing grid (lead attention ledger + recents, side index cards).
- **Shell/nav**: numbered index rail, dark mobile bar, slim topbar, restyled crumbs.
- **Projects/workspace**: editorial heads, ruled lists, section-barred overview.
- **Archive**: ruled list, spec tags, reading sheet + meta block viewer, same flows.
- **Inventory/stock/requests**: banded tables, transfer route/effect lines restyled,
  localized type labels untouched.
- **Admin**: ruled account table, tooltip access cell, deliberate role matrix.
- **BOQ/IPC/Financials**: banded grids, strong tabular totals, N/A stays N/A.
- **Reports/Audit**: ruled report table, instrument-strip filters, sorted export.
- **Palette/search/notifs/settings/403/404**: top-accented surfaces, same behavior.
- **Toasts**: ink plates with status edge. **Offline banner**: ink with amber edge
  (copy unchanged — still no queue claims).

## 8. Screenshots

`%TEMP%\opencode\phase313-visual-review\` — `before/` (12 shots, 3.12 build) and
`after/` (12 desktop + mobile home/archive/More + EN stock/requests + dark home/archive
+ viewer/approve/menu dialogs). No contact-sheet tooling exists in the environment;
the folders themselves are the review set.

## 9. Files added and modified (all inside the prototype dir)

- Rewrote `src/styles.css` (tokens, type, rail, heads, tables, tags, login split,
  briefing grid, reading sheet, dark theme, responsive).
- `src/components/Shell.tsx`: numbered nav items only.
- `src/pages/Login.tsx`: brand side panel only (existing strings).
- `src/pages/Home.tsx`: briefing wrappers only (same blocks, same order).
- `src/pages/Archive.tsx`: `docSheet`/`docMeta` classes on viewer only.
- Added this report. No behavior, route, permission, data, or dependency changes.

## 10. Verification (commands + results)

- `tsc -p docs/frontend-rebuild/phase-03-prototype/tsconfig.json --noEmit` → exit 0.
- Temp build: `vite build --outDir %TEMP%\opencode\phase313-build --emptyOutDir`
  with `VITE_PROTOTYPE=1` → success; `dist/` rebuilt identically for preview :5199.
- Full Playwright suite (`test -c verify/pw.config.ts`, chromium, `%TEMP%` only):
  **239 run · 239 passed · 0 failed · 0 skipped** — one full run (237 passed /
  2 failed) plus a targeted re-run (7/7) proving both failures fixed: (1) the
  redesign's slim topbar buttons measured 38px — reverted to the 44px contract
  (source fix); (2) the dark-theme color poll pinned the old text token — updated
  to the new token (test update for an intended change; the numeric ratio assertion
  itself is unchanged). No test was weakened; failing assertions led to fixes.
  Measured in-run: light body 15.56 / muted 7.58 / badges 5.21–6.90, dark body
  15.03 (run stdout: CONTRAST-LIGHT / CONTRAST-DARK).
- Responsive/keyboard/contrast/motion/localization/corruption guards: embedded in the
  suites (8 widths, measured ratios, focus trap/restore, reduced motion, AR+EN,
  `{token}`/CJK DOM scans) — all green in the same run.

## 11. Remaining visual defects

None known beyond normal review subjectivity. Watch items for the owner: greeting
h1 wraps to 3 lines at 320px (acceptable); EN transfer "From/To" line wraps mid-row
(pre-existing bidi behavior); topbar wraps to two rows at 390px (acceptable).

## 12. Owner judgment / real-device needs

Taste calls (teal depth, rail darkness, rule weights), real-device feel, real
screen-reader pass, human contrast adjudication on brand hues — same human-only
category as 3.12, unchanged.
