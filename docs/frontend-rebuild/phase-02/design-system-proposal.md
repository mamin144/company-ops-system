# Phase 2 — Design System Proposal (نظام التصميم المقترح) — REVISION 1
Proposal only. **No direction approved.** Token samples below compare directions; no token set is final.

## 0. Universal requirements vs provisional decisions
**Universal (apply in every direction)**: Arabic-first RTL + English LTR via logical props; keyboard-complete operation with visible focus; honest loading/empty/filtered-empty/error/denied/offline states; dot+label semantic statuses from the verified canonical set; real permission checks incl. `reports.view` export gating; responsive 320/375/390/430/768/1024/1366/1920 with **zero horizontal scrolling at every width** (vertical reading/scrolling default; no field or action dropped to fit); unified Archive without folder UI; long-filename + mixed-direction handling; no fabricated metrics/statuses; uniform destructive-action discipline.
**Provisional (await owner direction choice)**: brand expression; navigation layout (rail vs hub vs queues); density/hierarchy emphasis; surface treatment and exact token values; table-vs-card emphasis; dashboard composition; project-context placement; motion/decoration beyond essential feedback.

## 1. Visual language
- **Brand direction**: "operations instrument" — slate-ink surfaces, hairline borders, one operational blue; status colors speak only when data speaks. Inspiration: industrial control rooms + editorial wayfinding (cross-domain: architecture wayfinding, automotive driver-centric hierarchy, UX progressive disclosure).
- **Color roles**: `bg/page` (app canvas) · `surface/surface-2` (cards/panels/meta wells) · `border/border-subtle/border-strong` (separation hierarchy) · `text/muted` · `primary` single accent (actions, links, active states) · `success/warning/danger/info` strictly semantic · `purple` only for neutral categorization (planned-type tags), never urgency.
- **Light + dark retained**: every token has a dark value; surfaces invert (light paper ↔ night-shift slate); semantic hues hold meaning in both (dark variants desaturated for contrast).
- **Typography**: Arabic — Cairo (proven in product, full Arabic weights); Latin companion — Inter (data-heavy UI, tabular figures); mono use banned for decoration, reserved for codes/IDs with LTR isolation. Scale: display 22–28 / title 15–20 / body 13–14 / micro 11–12; weights 400 body, 600–700 UI emphasis, 800 display only; `tabular-nums` for all numeric columns; webfonts self-hosted WOFF2 + `fonts.ready` gating (no FOUT, safety timeout).
- **Spacing/grid**: 4pt base scale (4/8/12/16/20/24/32); content max ~1440; 12-col desktop grid, single-column mobile; section rhythm 16–20.
- **Surfaces/borders/radius/elevation**: borders over shadows (radius 6/8/10 by nesting depth — child ≤ parent); shadow reserved for modal/drawer/floating bar; status spine (3px inline-start) for attention rows, never full-color blocks.
- **Iconography**: single stroke-weight SVG set, 15–22px; every icon-only control named (`aria-label`); file-type glyphs by extension family.
- **Motion**: micro 120–180ms ease-out, panel 250ms max (essential feedback only — signature moves stay provisional per §0); `prefers-reduced-motion` kills all non-essential motion globally; no layout-animating properties.

## 2. Semantic states (verified sources only — three separate categories)
**A. Business statuses** (persisted/API values from `packages/shared/src/types.ts`): projects `planned/active/on-hold/completed/cancelled` · documents `draft/submitted/under-review/approved/rejected/superseded/archived` · material requests `draft/submitted/approved/rejected/partially-issued/issued/closed` · stock `IN/OUT/TRANSFER/ADJUSTMENT/RETURN`. Treatment: dot + label chip; identical token per status in list/card/detail/notification; text always carries meaning (no color-alone). Nothing invented; nothing added.
**B. Derived operational conditions** (server-computed, never persisted statuses): low-stock alertness from `stock/overview.lowStock[]`; submitted/rejected queue presence from list responses. Rendered with the same dot + label language but documented as derived in specs — never stored, never treated as missing enum values.
**C. UI and connectivity states** (presentation only, excluded from the business palette): loading, empty, filtered-empty, error, offline, denied, failed operations, update-available. Specified under component states (§3), never listed as business statuses.

## 3. Component families (purpose · variants · behavior · a11y · usage)
- **Buttons**: primary/ghost/danger/sm/icon-only; busy+disabled during flight; icon-only named; used for all actions (no div-buttons).
- **Fields**: label/hint/error slots; `aria-describedby` errors, `aria-invalid`; required announced; date/number/select/textarea variants.
- **Tables/data views**: sortable headers (`aria-sort` + arrow), sticky head, row actions, bulk-select column where supported, pager (total + prev/next); dense tables become multi-line record rows on desktop groupings and stacked label/value cards <768 (same fields, actions, states) — **no horizontal scrolling anywhere, including inside table wrappers**.
- **Search/filters/sort/pager**: debounced search (350ms), chip-style active-filter bar with clear-all, select/date filters, persistent per view.
- **Status labels**: Badge + StatusDot pair as above.
- **States**: skeleton (content-shaped), empty (title+hint+action), filtered-empty (+clear), error (+retry), denied (+reason+back), offline (banner + disabled mutations), update-available (confirm), fatal (boundary + reload).
- **Confirmations/dialogs**: danger confirm for deletes/Reject/issue/restore; focus trap + restore + Escape + overlay/backdrop close; `role=dialog aria-modal`.
- **Drawers/nav**: responsive drawer (overlay + trap only in overlay mode), collapsible rail, bottom bar mobile; `aria-expanded/controls`.
- **Tabs**: addressable (route-backed), `tablist/tab/aria-selected`; wrap vertically or collapse to a selector on narrow widths — never horizontal scrolling.
- **Upload/file feedback**: progress %, success/error toasts, failure reasons, MIME-probed preview, revision timeline.
- **Toasts**: success/error/info, auto-dismiss, never the sole channel for critical outcomes.
- **Bulk bar**: floating selection count + scoped actions + clear; keyboard reachable.
- **Command palette + search page**: nav/actions + full results; focus + `aria-activedescendant` pattern.
- **Denials**: `/403` page + inline unauthorized empties (never silent).

## 4. RTL/LTR + responsive + accessibility rules
- Logical properties everywhere (`margin-inline`, `inset-inline`, `border-start`); icons that imply direction mirrored via transforms, others untouched.
- Tables: first column (identity) stays at inline-start in both directions; numeric/code cells LTR-isolated.
- Breakpoints: 320 / 375 / 390 / 430 / 768 / 1024 / 1366 / 1920 (historical matrix plus smaller devices); drawer ≤1023, record-cards ≤767.
- **Zero-horizontal-overflow verification specification** (future prototype/implementation QA; nothing marked passed here). For every audited screen and important state, check: (1) page scroll width ≤ viewport width; (2) no nested horizontal scrollbar; (3) every original field and supported action reachable without lateral movement; (4) filters/toolbars wrap or reflow vertically; (5) tables adapt to multi-line or card-like representations; (6) modals, drawers, tabs, notifications, menus fit their viewport; (7) long Arabic/English text and filenames never break layout; (8) RTL/LTR switching reintroduces no overflow; (9) empty, loading, error, denied, and populated states satisfy the same rule; (10) workflows complete with vertical scrolling + normal responsive controls only.
- Target: WCAG 2.2 AA (contrast 4.5/3.0, focus-visible ring token, keyboard-complete flows, touch ≥44px, reduced-motion honored). Conformance claimed only after Phase 10 testing.
- Mixed-direction: emails/IDs/paths/serials/codes wrapped LTR-isolated; filenames ellipsis with full `title`.
