# Phase 2 Revision Report (تقرير مراجعة المرحلة الثانية)
`docs/frontend-rebuild/phase-02/phase-02-revision-report.md` — documents-only revision. No direction approved. Phase 3 not started.

## 1. Contradictions identified
- **C1. Project-workspace completeness**: proposal claimed full parity + 7 detail areas while distributing them inconsistently (overview/sites/documents/stock/combined-financials); BOQ/IPC/warehouses destinations ambiguous.
- **C2. My Desk data sources**: queues (pending IPCs, failed imports) and figure sets proposed without per-widget source proof; risk of invented metrics and request fan-out.
- **C3. Route rules**: dedicated `/404` coexisted with silent-home redirect; legacy paths (`/dashboard`, entity routes, `/admin/projects`, bare `/projects/:id`) lacked explicit fates.
- **C4. Status/permission/count claims**: `synced/failed/offline/denied` listed as statuses; export gating vs `reports.view` under-addressed; exact "9 of 13" entity ratio unsubstantiated; no interviews/personas discipline.
- **C5. Direction-B bias**: B dominated specs/system docs while unapproved; comparison unfair.
- **C6. Prototype-vs-production boundary**: risk of reading conflicts as blocking an isolated mock prototype, or smuggling Phase 0 resolution into design work.

## 2. Evidence used
Phase 1 report + backend API/authorization audit (in-context); master plan re-read in full (408 lines, byte-identical to init — an intermediate line-count anomaly resolved as a shell counting quirk); read-only source checks: `packages/shared/src/types.ts:10,13,45-52,152-159,237-238` (status unions, import rows), `MaterialRequestsPage.tsx:135-139` (reject path), backend `MANAGED_PERMISSIONS` (31 keys). No runs, no builds, no test executions.

## 3. Corrections made
- **C1**: IA §2 now maps all 7 areas to explicit nested routes (`overview/sites/documents/warehouses/stock/financials`-with-BOQ+IPC-tabs); screen specs S4 rewritten with per-tab destinations; boards show scoped views + full-workspace links.
- **C2**: dedicated 8-row matrix added (`design-brief.md` §5, mirrored in specs S2): keep submitted/rejected/low-stock/counts/recents (verified, existing requests); pending-IPCs + failed-imports **removed from default** → optional future; all other metrics removed.
- **C3**: compatibility policy table added (IA §4): explicit redirects (preserve query, no loops) + genuine `/404` (silent-home retired) + `/403` + client-side return-path; specs S18 + brief §6 aligned.
- **C4**: canonical status table added from verified unions; `synced/failed/offline/denied` reclassified as UI conditions; export affordances gated on `reports.view` across brief/specs/system; "9 of 13" replaced with qualitative project-linkage statement (verified optional-`projectId` fields); no interviews/personas invented anywhere.
- **C5**: brief §4 rewritten as unbiased matrix (no ✅, no in-force recommendation); provisional lean confined to brief §7 + board labels, all marked UNAPPROVED; system doc split into universal (§0) vs provisional decisions; motion signature + token finals marked provisional. (Superseded in part by §13: lean now D-consistent across docs, B kept available.)
- **C6**: gaps doc G10 added (isolated prototype evaluable without conflicted imports/config/real APIs vs blocked production build); owner-decisions Q5 rewritten; no conflicts touched, Phase 0 untouched.

## 4. Documents affected
Rewritten: `design-brief.md`, `information-architecture.md`, `owner-decisions.md`, all 3 `visuals/*.svg` (common comparable template, same scenario, fairness labels). Edited: `screen-specifications.md` (S2/S4/status/route sections), `design-system-proposal.md` (§0 split + motion caveat), `known-integration-gaps.md` (G10). Untouched: `dependency-decisions.md` (already direction-neutral; verified consistent). Created: this report.

## 5. Remaining uncertainty
Conflict-side intent; BOQ/IPC `Can` keys (skim-level); runtime behavior of everything; large-file limits; server error payloads; DB contents; whether evidence-based role assumptions match real users (Q4); EN data scope (Q2); fixture strategy (Q7); hosting/PWA (Q6).

## 6. Effect on the alternatives (A/B/C/D)
All four recomposed on one comparable skeleton (concept → desktop workspace → secondary surface → mobile → strengths/risks → honesty footer) over the same synthetic scenario; B stripped of default-status language; A and C given equal depth (table language, task coverage rule); D added as the balanced hybrid with identical fairness footer. Comparison is structural schematics, honestly labeled — not high-fidelity mockups.

## 7. Updated owner decisions
Q1 (direction, B explicitly unapproved) · Q2 (EN UI-only default vs data) · Q3 (nav reorg + route policy) · Q4 (assumptions) · Q5 (conflict prerequisite + isolation understanding) · Q6 (hosting/PWA) · Q7 (fixtures).

## 8. No production/config modification
Authored paths confined to `docs/frontend-rebuild/phase-02/` (+ pre-existing state otherwise). Verified via `git status` (see final report).

## 9. Phase 0 skipped
No baseline/branch/worktree/commit/push/install/test/build activity; no conflict resolution; no migration or data change.

## 10. Phase 3 not started
No prototype app, directory, wiring, or API contact. Phase 3 awaits a new explicit prompt after owner approval of a direction.

## 12. Change log — strategy update (approved constraints; not pre-existing requirements)
- **Decision 1 (approved)**: folder-management UI removed; Archive is a unified full-width workspace. Backend/DB/APIs frozen; folder records and relationships preserved.
- **Decision 2 (approved)**: zero horizontal scrolling mandatory product-wide (320–1920); vertical scrolling allowed; nothing dropped to fit.
- **Upload compatibility (verified, no blocker)**: `folderId` optional in upload schema (`documents.validators.ts:6`); unfiltered list returns all authorized documents (`documents.routes.ts:93`); QuickUpload sends `folderId` only when set. Neither decision required an owner workaround ruling; folder-origin display defaults to read-only metadata.
- **Documents affected**: `screen-specifications.md` (S6 rewrite), `information-architecture.md` (sitemap + prefs), `design-brief.md` (principles 3+9), `design-system-proposal.md` (tables/tabs/universal/breakpoints + 10-check verification matrix), `direction-comparison.md` (Archive row + §11b equal-compliance), `known-integration-gaps.md` (G5 reframed moot-for-design, +G11 verified-compatible), `owner-decisions.md` (+Q8/Q9 approved), `visuals/direction-a-*.svg` + `direction-d-*.svg` (table-scroll claims corrected), this report.
- **Uncertainties remaining**: prior list stands; folder-origin chip display is a minor default (no contract impact); runtime proof of zero-scroll awaits future QA (nothing marked passed).
- These constraints were owner-approved in this update — previous reports are not rewritten to imply otherwise.

## 13. Consistency pass — final documentation audit (no direction approved)
- **Direction count**: brief §4 covered A/B/C with a B lean while `direction-comparison.md` leaned D — corrected: brief gained §4b (full 11-point D dossier), §7 rewritten to the D lean with comparison-§12 criteria, Q1 lists A/B/C/D with the same lean; B kept as the coherent identity alternative, C as approval-flow; fifth-direction/hybrid path explicitly preserved.
- **Statuses**: system-doc palette mixed business values with derived (`low-stock`) and invented (`synced/failed`) plus UI states (`offline/denied/empty`) — corrected into A (verified unions) / B (server-derived conditions) / C (presentation-only) split; specs canonical table + brief already clean, re-verified.
- **Filename inspection**: "tooltip/expand" wording tightened to keyboard-operable expand control, hover never sole path.
- **Archive/zero-scroll**: re-verified — no folder-UI proposals, no h-scroll proposals, no live 301 claims anywhere (sweep); boards match specs.
- Production/backend/DB/deps/config/Git untouched; Phase 0 skipped; no prototype/Phase 3.

## 11. Consistency fix pass (owner-authorized documentation correction)
- **Correction A — redirect terminology**: full-dir search found exactly one HTTP-301 claim (`information-architecture.md:47`, "old paths 301-redirect"). Fixed to client-side navigation redirect + added binding terminology note (IA §4): all redirects are frontend-router navigations (history replace where appropriate); no HTTP 301 verified or authorized; hosting untouched. Other docs already used neutral "redirect" / "client-side return-path" wording — verified consistent, no further edits needed.
- **Correction B — visibility vs approval authority**: exact key `materialRequests.approve` re-verified (backend `ALL_PERMISSIONS` + `requirePermission` on `POST …/approve` + frontend `can('materialRequests.approve')` gates). Split applied in `design-brief.md` §5 (read-only submitted row with `materialRequests.view` + conditional actionable queue requiring view **plus** `materialRequests.approve`, rejection only via verified `POST …/approve {approve:false}`, unsupported `/reject` never used) and `screen-specifications.md` S2 + S10; `known-integration-gaps.md` G3 extended with the authority rule and heading discipline; SVG headings neutralized (A-board queue strip, C-board queue title) so view-only readers cannot infer approval rights. No permission names invented; no endpoints added; backend untouched.
- **Files changed in this pass**: `information-architecture.md`, `design-brief.md`, `screen-specifications.md`, `known-integration-gaps.md`, `visuals/direction-a-operations-desk.svg`, `visuals/direction-c-queues-first.svg`, this report. `owner-decisions.md`, `design-system-proposal.md`, `dependency-decisions.md`, direction-B board: verified unaffected, unchanged.
- Production source, backend, dependencies, configuration, database, and Git state untouched (verified below). Phase 0 skipped. No prototype/Phase 3.
