# RECOMMENDED-NEXT-STEPS.md — Phase 3.1 → onward (proposal, not authorization)
Order respects dependencies; each step ends with a review checkpoint. Nothing here authorizes a later phase.

## Done
- **Step 1 (3.2)** — GAP-P1-01 + GAP-P2-02 + GAP-P2-01. Checkpoint passed: 4/4 regression green, zero allowlists.
- **Step 2 (3.4)** — GAP-P1-02 (viewer), GAP-P1-03 (status/replace/links), GAP-P1-09 (CSV import on Archive). Checkpoint passed: 7 archive tests green, full suite 18/18, 8-width matrix clean. Awaiting owner walk of upload→preview→replace→import.
- **Step 4 admin slice (3.3)** — GAP-P1-06 shipped early at owner request (accounts/roles/permissions). GAP-P1-11 (audit filters) still open.
- **Step 3 (3.5)** — GAP-P1-05 (MR project filter), GAP-P1-10 (stock movements + issue prefill), GAP-P1-04 for the two scoped lists. GAP-P1-08 exports deliberately untouched.
- **Step 4 remainder (3.6)** — GAP-P1-07 (BOQ + IPC). Closed with audited rules; the unsupported financial concepts (contract value, retention, tax) are recorded as data gaps, not invented.
- **Step 3 remainder (3.7)** — GAP-P1-08 exports and GAP-P1-11 audit filters. Closed.
- **3.8 follow-up (this round)** — Financials title pinned by exact-match assertions in three suites; GAP-P1-04 closed for Archive + Warehouses + Items with behavior-proving tests; contextual export on Warehouses + Items under unchanged gates; five real defects fixed (see report). Suite 130 → 142, one clean run, exit 0.

## Proposed next

## 3.8 delivered (no further build phase recommended without an owner decision)
GAP-P1-08, GAP-P1-11, full EN coverage, route/dialog coverage matrix, and two real defects fixed (Projects project-scope leak; Arabic punctuation inside English confirmations). The prototype is reviewable end-to-end.

## 3.12 delivered (prototype UX remediation — authorized implementation phase)
All ten P1s, all fourteen P2s, all actionable P3 polish and every safely-resolvable
prototype gap from GAP-REGISTER were implemented and regression-tested inside the
prototype directory only. New suites: `remediation-p1` (28), `remediation-p2p3`,
`a11y` (measured touch/contrast/focus/motion). Full-suite counts in the final report.
Remaining cuts are production-contract or human-evaluation items (see FINAL-ACCEPTANCE
owner decisions + "Explicitly out" below) — not deferred prototype work.

## Remaining (needs owner pick)
- Production-contract decisions (read-only notes in GAP-REGISTER): export-gate tightening
  confirmation; production documents XLSX route (prototype ships metadata-CSV only);
  `GET /:id` hide-existence; financial model (contract/tax/retention); `sites.edit` grant;
  technical-role permission base; production conflict markers.
- Human-only validation: independent UX review, real-device walkthroughs, real
  screen-reader pass, touch-feel adjudication, contrast adjudication on brand hues.

## Step 5 — i18n + verification hardening (depends on content freeze)
GAP-P1-12 (full EN dictionary) + GAP-P2-03/05/06 (density/collapse/offline/contrast/motion/empty-fixtures) + email/ID fixtures (P3-01).
Note: 3.4 translated every string it introduced (both locales) and added a `t(key, vars)` placeholder filler; older Arabic-hardcoded copy elsewhere remains the P1-12 scope.
Checkpoint: EN-mode full walkthrough + 8-width matrix rerun + keyboard-only pass.

## Explicitly out of this sequence
Production implementation, backend/DB/API changes, dependency installs, conflict resolution, commits/pushes, real data, usability testing with humans — each needs its own authorization.
