# VISUAL-COMPOSITION-DIAGNOSIS.md — Phase 3.16 (3.15 build renders)

Basis: 56 fresh screenshots (14 screens × AR-light/AR-dark/EN-light/EN-dark + EN
mobile), inspected full-size, plus the owner's attached reference quality bar
(BentoFlow/Pluto/workspace shots are references, not copies). 3.15 diagnosis items
already fixed are not repeated.

## C-01 — Dashboard stat cards are tall and empty (major; Home AR/EN)
Each side card holds one label, one number and one repeated footnote over ~150px;
six stacked cards plus three status cards create a long airy column while the lead
column carries the real work. The same "Demo: no real change occurred" footnote
repeats three times. Composition competes instead of briefing.
Root cause: one-size `.card` padding/value scale + duplicated footers + vertical stack.
Fix: compact horizontal stat rows (icon tile + label, value baseline-aligned),
drop the repeated footers (demo note already lives in the eyebrow), keep all
links/counts/permissions and the `<br>` the tests pin.

## C-02 — Destructive actions dominate rows (major; Projects + all delete rows)
Every row ends in a solid red block (حذف/Delete) that outweighs the primary
navigation (التفاصيل) and editing actions — inverted hierarchy, exactly as observed.
Root cause: `.btn--danger` solid fill used at row level.
Fix: quiet danger treatment for row-level destructive buttons (red text + hairline
border, solid fill reserved for dialog confirmations). Same labels, order, guards.

## C-03 — Filter toolbar and table are two disconnected boxes (major; list screens)
Toolbar card + list panel stack as separate rounded boxes with duplicated borders;
search/selects/buttons read as generic form controls rather than one workflow.
Controls also stack full-width vertically, wasting vertical space on desktop.
Root cause: identical box treatment + full-width selects.
Fix: visually merge toolbar into the list panel (attached container, shared
corners) via adjacent-sibling styling; inline auto-width filters on desktop,
wrapping on mobile. No JSX reordering; all controls keep labels/behavior.

## C-04 — Sidebar lacks grouping and topbar/sidebar feel unjoined (moderate; shell)
One flat "Modules" list of nine items; topbar actions float without relation to
navigation. Reference products group destinations (workspace / management / system).
Root cause: flat NAV render, single hardcoded group label.
Fix: three nav groups (workspace, management, system) with localized labels via
the dictionary; keep order, icons, permission filtering, active states.

## C-05 — Table polish gaps (moderate; list screens)
Header band + text sort headers work but rows are airy for operational scanning;
status pills + actions align inconsistently across columns; pagination/export strip
sits below with weak connection to the list.
Root cause: row padding tuned for touch, not scanning; strip styling flat.
Fix: tighten row vertical rhythm slightly (keep 44px targets), strengthen header
band contrast a half-step, connect pager/export strip to the panel foot. No
structural change.

## C-06 — Dark-mode specifics to verify (moderate; shared components)
Dark renders were acceptable in 3.14/3.15 but shared-component edits (quiet
buttons, merged toolbar, deeper pills) must be re-checked in dark: transparent
fills, hover tints, active pills, and table bands. Fix per-theme only if a shared
rule harms one theme (documented if so).

## C-07 — EN parity notes (minor)
EN mirrors AR correctly (verified: home, projects, stock, admin, dialogs). Two
watch items: long German-style compound labels absent (fine); transfer "From/To"
line wraps mid-row (pre-existing bidi behavior, acceptable). No EN-specific
redesign needed beyond applying the same composition fixes.

## Reference-image analysis (attached BentoFlow / Pluto / workspace sidebar)
Opened and inspected as quality-bar references (they are English SaaS mockups,
not COS screens, and were never treated as current-state evidence). Applicable
patterns extracted — charts, sparklines, avatars, deltas, presence dots, team
lists, upgrade promos and progress bars were all rejected (invented data):
- Pluto grouped tables + single-row toolbar (search + compact right-aligned
  filter/sort actions) and **bandless text headers** → adopted (C-03, header swap).
- Pluto/BentoFlow light sidebar + soft active pill + grouped nav → confirmed our
  direction; adopted grouped nav (C-04).
- BentoFlow section headers with trailing actions, icon-chip stat labels →
  already present; kept.
- BentoFlow KPI deltas/trend lines → rejected (no data source).

## Non-defects (do not touch)
Badge/dot semantics and hues; tabular numerals and bidi isolation; viewer reading
card; empty-state icons; banners; focus trap/restore; density/collapse/theme/login
language behavior; BOQ/IPC math; export gates and file contents; permission guards.
