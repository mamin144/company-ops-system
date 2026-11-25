# LIGHT-MODE-OVERHAUL-REPORT.md — Phase 3.15

## Final status: PASS WITH LIMITATIONS

Limitations are the standing human-only category (taste calls, real devices, real
screen reader, human contrast adjudication). No prototype-fixable item is open.
Note on paths: this report lives at `docs/frontend-rebuild/phase-03/` exactly as
instructed; that directory did not previously exist (prior docs live in
`phase-03-prototype/`). The diagnosis file sits with the prototype docs at
`docs/frontend-rebuild/phase-03-prototype/LIGHT-MODE-DIAGNOSIS.md`. All code
changes are inside `phase-03-prototype/` only.

## 1. Diagnosis summary and root causes

Screenshot-driven audit of the 3.14 build (14 fresh Light-Mode renders) produced
9 findings (`LIGHT-MODE-DIAGNOSIS.md`: D-01…D-09). Root causes, not symptoms:

- **Washed hierarchy (D-04, root):** canvas `#F3F5FA` vs white cards/inputs vs
  near-white head bands differed by only a few lightness points, so cards were
  defined by hairlines alone — the "generic white page" feeling.
- **Weak orientation cues (D-01/D-02):** the active nav pill and the seven
  identical topbar boxes shared one visual weight; nothing said "you are here"
  or grouped search/identity/actions.
- **False affordances (D-03):** sort controls styled as pill buttons inside a gray
  band read as removable filter chips rather than sortable columns.
- **Noise (D-06):** every row action rendered as an identical white box, flattening
  primary/danger/tertiary hierarchy.
- **Faint structure (D-05):** row hairlines near-invisible; hover nearly imperceptible.
- Minor: pale mobile active state (D-07), loud login gradient (D-08), flat page
  heads (D-09). Verified non-defects left alone: badges, primary buttons,
  numerals/bidi, viewer, banners, focus system, EN mirror.

## 2. Visual direction and surface hierarchy

Light Mode designed as its own experience, not an inverted dark theme. Final
hierarchy, top to bottom tonal value:

1. **Canvas** `#E9EDF5` (deepened one step cooler — the key move; cards now read
   as surfaces without outlining everything).
2. **Sidebar/topbar chrome:** white rail + white blurred topbar, separated from
   canvas by tone; active nav = deeper `#E0E5FA` pill + 3px indigo indicator +
   ink semibold text.
3. **Content cards** pure white, hairline border, half-step stronger shadow.
4. **Inputs** white with strong borders; hover/focus go indigo.
5. **Table band** tinted head; text-style sort headers (no more chip confusion).
6. **Row actions** quiet transparent secondary buttons; solid primary/danger kept.
7. **States** unchanged semantics/hues (all previously measured AA pairs kept
   byte-identical); mobile active deepened; login gradient deepened slightly.

Dark Mode: **zero token changes** — shared rules adapt through variables; verified
unchanged-or-better via home + archive + dialog comparisons.

## 3. Changes by component and screen

- **Shell/nav/topbar** (`Shell.tsx` + CSS): `btn--quiet` icon toggles, user identity
  chip, grouped command strip, anchored rail, deep mobile active pill.
- **Page heads**: 26px titles, tightened eyebrows, capped description width (CSS only).
- **Tables** (Archive/Stock/Requests/Admin/BOQ/IPC/Audit/Reports): text sort headers,
  quiet row secondaries, deeper hairlines (CSS only).
- **Login**: deepened brand gradient (CSS only).
- **Dashboard/cards/forms/menus/dialogs/toasts/banners**: tonal/shadow/radius
  refinements via tokens (no JSX).
- **Icons** (`icons.tsx`): audited all 27 glyphs against the renders — consistent
  1.8px rounded strokes, optical alignment, direction-neutral paths; no changes
  needed, no emoji/Unicode anywhere, no new library.
- No route, guard, permission, data, string, or behavior change anywhere.

## 4. Before/after screenshot paths

`%TEMP%\opencode\phase315-visual-review\before\` (14 shots: 12 desktop AR-light +
2 mobile) and `...\after\` (14 AR-light + 14 AR-dark). Filenames identify screen,
language, theme, viewport (e.g. `home-ar-light-1366.png`, `m-archive-ar-dark-390.png`).
Key comparisons: dashboard AR-light, archive AR-light, BOQ/IPC/Financials AR-light,
admin AR-light, login AR-light, dashboard + archive AR-dark, one mobile per theme,
plus EN LTR coverage from the suites. No contact-sheet tooling exists in the
environment; the folders are the indexed review set.

## 5. Light improvements / Dark regression checks

Light: anchored navigation, grouped topbar, readable sort headers, tonal card
separation, visible row structure, quieter secondary actions, stronger titles —
confirmed shot-by-shot against the baseline. Dark: side-by-side home/archive
comparison shows no material regression (same hues, spacing, hierarchy; shared
rules adapt cleanly).

## 6. Accessibility and responsive results (measured, same run)

- 8 widths (320–1920) overflow matrices: zero horizontal overflow.
- Touch targets ≥44px measured; keyboard focus + trap + restore; reduced-motion
  verified; `{token}`/CJK DOM scans clean; scope denials and file-content export
  checks green; zero console/page errors (listeners on every file).
- Contrast pairs unchanged from the 3.14 measured values (tokens kept), except the
  deeper canvas/sidebar-active which only raise text contrast; primary-button
  white-on-indigo re-measured 5.47 in 3.14 and its tokens are untouched.

## 7. Exact test counts and build

- Discovery: `test -c verify/pw.config.ts --list` → **239 tests in 12 files**.
- `tsc -p docs/frontend-rebuild/phase-03-prototype/tsconfig.json --noEmit` → exit 0.
- Temp build `vite build --outDir %TEMP%\opencode\phase315-build --emptyOutDir`
  (`VITE_PROTOTYPE=1`) → success. (Note: the temp-build directory flag was used
  for the evidence build; `dist/` was separately rebuilt for preview :5199.)
- Full suite `--reporter=list`, chromium, `%TEMP%` only:
  **239 run · 239 passed · 0 failed · 0 skipped · exit 0 (8.6 min).**
- No test was weakened, removed, or skipped; no failures occurred, so no
  expectation changes exist in this phase.

## 8. Files changed / production untouched

- Modified (all inside `docs/frontend-rebuild/phase-03-prototype/`):
  `src/styles.css` (tokens, rail, topbar, heads, tables, buttons, login, mobile),
  `src/components/Shell.tsx` (quiet buttons, user chip — same controls/labels),
  `LIGHT-MODE-DIAGNOSIS.md` (new), this report (in `phase-03/` per instruction).
- Production app/backend/database/APIs/permissions/dependencies/Git state: **not
  modified** (`git status` shows only pre-existing tracked changes plus untracked
  `docs/`; repo-root `test-results/` untouched).

## 9. Remaining limitations / owner decisions

- Taste-level calls (exact canvas depth, pill depth, gradient stops) remain owner
  judgment; screenshots are provided for that review.
- Real-device feel, real screen reader, human contrast adjudication: still
  human-only, as in prior phases.
- No new owner decisions required by this phase; the six standing production/
  contract decisions from 3.12 are unaffected.
