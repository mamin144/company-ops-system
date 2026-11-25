# LIGHT-MODE-DIAGNOSIS.md — Phase 3.15 screenshot-driven findings (3.14 build)

Basis: 14 fresh Light-Mode screenshots (12 desktop AR + 2 mobile) rendered from the
current `dist/` build, inspected at full size. Dark Mode is the protected baseline
and was not re-judged except where shared components change it.

## D-01 — Sidebar lacks anchoring (major; all desktop screens)
White rail on near-white canvas; nav labels gray; the active state is a pale
lavender wash that barely registers as "you are here"; the brand block is gray
microcopy under a small tile. The primary orientation cue of the app is the
weakest element on screen.
→ Correction: distinct sidebar tint, deeper active pill + indicator bar + ink text,
stronger brand lockup. Keep route order, labels, permission filtering.

## D-02 — Topbar monotony (major; all desktop screens)
Seven identical white 44px boxes in a row (search trigger, search, bell, theme,
lang, density, name, logout) with no grouping: icon actions, toggles, identity
and destructive-adjacent logout all share one visual weight.
→ Correction: icon-only actions become quiet borderless buttons; the search
trigger stays the single outlined control; identity becomes a soft chip.
Same controls, same order, same labels.

## D-03 — Sort headers read as filter chips (major; Archive/Stock/Admin/BOQ/IPC/Audit)
White pill buttons floating inside the gray head band look like removable filter
tags, not sortable columns; the ↑↓ glyph is small and unexplained.
→ Correction: text-style sort headers (semibold muted label, accent arrow, hover
wash) instead of pill buttons. Keep labels, order, keyboard behavior.

## D-04 — Washed canvas hierarchy (moderate; everywhere in Light Mode)
Page, card, input and head-band surfaces sit within a few lightness points of each
other; cards are defined only by hairlines, so dense screens read as one flat
white field with gray text.
→ Correction: deepen the canvas one step cooler, keep cards pure white, strengthen
card border + shadow half a step. Separation by tone, not by outlining everything.

## D-05 — Row separation too faint (moderate; all recTable lists)
Row hairlines are nearly invisible at normal zoom; long tables blur into a single
block; hover feedback is barely perceptible.
→ Correction: deepen `border-subtle` one step; hover keeps the indigo tint but at
full readability. No structural change.

## D-06 — Ghost-button monotony in rows (moderate; Archive/Admin/Requests/BOQ)
Repeated identical white boxes (تنزيل/المزيد/التفاصيل/تعديل) add noise; secondary
and tertiary actions are visually equal.
→ Correction: row-level secondary buttons go quiet (transparent fill, hairline
border); primary and danger keep solid fills. Same labels, same order.

## D-07 — Weak mobile active state (minor; bottom bar)
Active destination is a pale wash with a gray icon; inactive items are gray icons.
At a glance the current section is unclear.
→ Correction: deeper active pill, ink icon + label, teal underline tick.

## D-08 — Login brand panel is the loudest surface (minor; Login)
The saturated indigo→teal gradient panel carries more visual weight than the
form; banding is visible on flat areas.
→ Correction: deepen the gradient stops slightly and reduce brightness range so
it reads as premium, not neon. No layout or copy change.

## D-09 — Page-head hierarchy is flat (moderate; list screens)
24px title + gray description + right-side actions compete on one line; the title
does not dominate; eyebrow metadata is far from the title.
→ Correction: larger title presence via tighter grouping (eyebrow closer, 26px
title, description capped width), actions vertically centered. No copy change.

## Non-defects (verified good, do not touch)
Badges/pills with dot + label; primary indigo buttons (5.47 measured); status
semantics and hues; tabular numerals and bidi isolation; tags in tables; viewer
reading card; empty-state icons; demo/offline banners; dialog focus + × control;
density/collapse/theme persistence; EN LTR mirror quality.

## Dark Mode protection list
Shared components touched by the corrections above (buttons, inputs, menus,
badges, toasts, rail, topbar) must be re-screenshotted in Dark Mode after the
change: home + archive minimum, plus one dialog. Token changes stay Light-scoped
(`:root` only) unless a shared rule demands it.
