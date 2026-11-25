# MODERN-UI-REDESIGN-REPORT.md — Phase 3.14 modern SaaS direction reset

## 1. Chosen art direction and rationale

**Modern enterprise SaaS, indigo-led.** Soft cool-neutral canvas, white elevated
surfaces with soft borders and restrained layered shadows, generous radius scale,
semibold Inter-style system typography (Cairo stack retained, no new fonts), one
indigo primary with a restrained teal accent, pill status badges with dot + label,
and a single consistent 1.8px stroke SVG icon language across navigation, actions,
empty states, and role identities. Quality bar: contemporary Linear/Stripe-grade
SaaS polish, with an identity of its own (construction operations, not fintech).

Why this wins for COS: operators live in this UI all day — comfort (soft surfaces,
generous spacing, readable type) beats editorial drama; density survives through
clean ruled tables rather than decoration; the system mirrors cleanly in RTL and
holds in both themes.

## 2. Rejected 3.13 patterns and replacements

| 3.13 signature | 3.14 replacement |
|---|---|
| Numbered dark index rail as brand statement | Light sidebar, SVG icons in the row, indigo soft-fill active pill |
| Square outlined status tags everywhere | Soft pills: tinted fill + tone text + dot (shape + text, never color alone) |
| Paper/ruled document-sheet styling | Clean reading card on soft fill; rules only inside true tables |
| Hairline-rule-heavy sections, angular buttons/surfaces | 8/10/16/20px radius scale; hairlines only as separators |
| Editorial boxless headers + accent ticks | Soft page-head row: title + description + actions, no decoration bar |
| Flat ledger cards | Elevated stat cards (border + soft shadow, hover lift) with icon labels |
| Unicode/emoji icons (⌂▦🔍🔔☀⇅⋯×) | 27-glyph stroke SVG set (`components/icons.tsx`), labels always kept |

## 3. Palette and semantic roles

| Role | Light | Dark |
|---|---|---|
| App / surface / raised | `#F3F5FA` / `#FFFFFF` / `#EEF1F7` | `#0C1222` / `#141D33` / `#1B2742` |
| Text / muted | `#16213A` / `#475569` | `#E9EEF7` / `#94a3b8` |
| Primary / hover | `#4F46E5` / `#4338CA` (white text) | `#4F46E5` bg + `#A5B4FC` text accents |
| Teal accent (restrained) | `#0F766E` | `#2DD4BF` |
| Borders | `#E3E8F2` / `#EBEFF6` / `#D3DAE8` | `#26324E` / `#1C2946` / `#33456B` |
| Statuses | danger `#b91c1c`, success `#047857`, warning `#92400e`, info `#2563eb` — **unchanged hues** (measured AA in 3.12) | soft fills retinted (unchanged) |

## 4. Radius / shadow / spacing / type / icons

- Radius: 8px compact controls, 10px inputs/buttons (8px sm), 14–16px cards/panels,
  20–22px dialogs, pills for compact status. Deliberate, not maximal.
- Elevation: two soft tinted shadow tokens; hover lift only on linked cards and
  buttons (shadow + 1px press). No glassmorphism, no heavy glow, one brand gradient
  (login side panel) as the single intentional brand surface.
- Spacing: 8/12/16/24 rhythm; 1440px content cap; tables collapse to cards ≤767px
  (mechanism unchanged).
- Type: Cairo stack; 24px/800 page titles, 17px sections, tabular numerals for all
  data/totals/codes; micro-labels by weight (tracking LTR-only — Arabic joining
  protected); bidi isolation kept.
- Icons: `Icon` component (`name`, `size`, `className`), `aria-hidden`, currentColor,
  optical alignment via flex-shrink rules. Coverage: 9 nav, search/bell/theme/globe/
  density/logout/close/plus/dots, check/alert/info, file/box/eye/wrench/briefcase/
  shield/clock/download, role + stat-card + empty-state icons. Direction-neutral
  paths; arrows remain paired text labels (pinned by tests).

## 5. Difference from 3.13

Every signature above was replaced; what survived intentionally: information
architecture, routes, permission behavior, test classnames, status semantics and
hues, density/collapse/theme settings, reduced-motion handling, and the dashboard
briefing composition (restyled, not restructured).

## 6. Changes by screen / component

- **Shell**: light sidebar + SVG nav + active pill; slim blurred command topbar with
  icon actions + ⌘K hint; ink mobile bottom bar with soft active pill; localized
  crumbs with hover states.
- **Login**: split brand/form composition, gradient brand panel with module index,
  icon role tiles (solid-primary selected state), pre-auth switch kept.
- **Dashboard**: briefing grid kept; stat cards elevated with icon labels; attention
  ledger and recents restyled; status cards link into filtered lists.
- **Lists/tables**: banded heads, hover tint, pill tags, contextual exports/pagers kept.
- **Viewer/dialogs/menus/toasts**: 20px modals, 14px menus, ink plates; reading
  surface without ruling; demo banner kept.
- **Admin/BOQ/IPC/Financials/Reports/Audit/Search/Settings/403/404**: same flows,
  new surfaces, badges, inputs, tabs, toggles; numbers tabular; N/A stays N/A.

## 7. Before/after evidence

`%TEMP%\opencode\phase314-visual-review\` — `before/` (12 shots of the 3.13 build)
and `after/` (12 desktop AR + mobile home/archive/More + EN stock/requests + dark
home/archive + viewer/approve/menu dialogs). No contact-sheet tooling exists in the
environment; the folders are the indexed review set (filenames are the index).

## 8. Files changed (all inside the prototype dir)

- Rewrote `src/styles.css`; new `src/components/icons.tsx`.
- `Shell.tsx` (SVG nav/topbar/More/logout), `ui.tsx` (SVG close, `EmptyState.icon`),
  `Login.tsx` (side panel, role icons), `Home.tsx` (stat-card icons),
  `Archive.tsx` (viewer classes kept modern), `Projects/Requests/Stock/Items/
  Warehouses/Admin/Search/Misc.tsx` (empty-state icons only).
- Added this report. No behavior, route, permission, data, string, or dependency
  changes (arrow labels and ⌘K hint kept byte-identical for pinned tests).

## 9. Test commands and results

- Discovery: `test -c verify/pw.config.ts --list` → **239 tests in 12 files**.
- `tsc -p docs/frontend-rebuild/phase-03-prototype/tsconfig.json --noEmit` → exit 0.
- Temp build `vite build --outDir %TEMP%\opencode\phase314-build --emptyOutDir`
  (`VITE_PROTOTYPE=1`) → success; `dist/` rebuilt for preview :5199.
- Full suite (`--reporter=list`, chromium, `%TEMP%` only):
  **239 run · 239 passed · 0 failed · 0 skipped** — one full run (233 passed /
  6 failed) plus targeted re-runs (38/38 across the four affected files) proving
  every failure fixed: five were test-side updates for intended UI changes
  (palette trigger shares the "بحث" accessible name → search-button lookups scoped
  to `role=search`; dark color-poll pinned the new text token), and one was a
  transient fill-vs-render flake in BOQ edit (4 consecutive green reruns, no code
  change). No test was weakened; no implementation behavior was altered to satisfy
  the suite.
- Embedded guards (unchanged, all green in the same run): 8-width overflow matrix,
  measured touch/contrast/focus/motion (a11y), AR+EN sweeps, `{token}`/CJK scans,
  permission/scope denials, import/export file-content checks, console/page-error
  listeners on every file.

## 10. Genuine limitations

- Icon set is hand-drawn geometric (27 glyphs); rich pictograms were deliberately
  avoided to keep stroke consistency — owner may request refinements per glyph.
- Brand mark remains the "CO" monogram on an indigo tile (no new logo designed).
- Real-device feel, real screen reader, and human taste adjudication remain
  human-only, as in 3.12/3.13.
