# Phase 2 — Owner Decisions Required (قرارات المالك) — REVISION 2 (consistency pass)
Concise; recommendations given, approvals withheld. **No direction approved — A, B, C, and D all remain available (including Direction B).**

## Q1. Visual direction (blocking Phase 3)
**Options**: A Operations-Desk · B Project-Spine · C Queues-First · D Balanced-Operations (comparison: `direction-comparison.md` + `design-brief.md` §4/§4b; boards: `visuals/`).
**Provisional (UNAPPROVED) lean, consistent across docs**: D — only composition with verified-only queues + first-class project-free homes + project context where supported + structural mobile-first; B kept as the coherent identity alternative, C as the approval-flow alternative. Criteria and trade-offs: `direction-comparison.md` §12.
**Approval needed**: chosen direction (or hybrid/fifth-direction instruction). Silence is not approval.

## Q2. English scope — interface vs business data (owner-approved principle + undecided scope)
**Approved**: Arabic default + English alternate with RTL/LTR switching. **Recommended default**: translate interface chrome, navigation, validation/error/success/state messages, and system-generated status labels; preserve user-entered data (project/doc/user names, notes, filenames, stored content) exactly as returned; isolate emails/IDs/codes/paths as LTR. No bilingual DB fields invented.
**Approval needed**: confirm default, or define data-translation scope.

## Q3. Navigation reorganization + route policy
Proposed: inventory hub with old-path redirects; nested project routes; `/admin/access` rename (redirect); new `/search` + `/notifications`; dropped dead `futureModules` labels; explicit redirects for known legacy routes; genuine `/404` (silent-home rule retired); `/403` with reason; client-side return-path on login.
**Approval needed**: accept reorganizations/redirects/drops, or keep current paths/labels.

## Q4. Workflow assumptions without user research
No personas/interviews exist; role model inferred from RBAC + overrides + memberships. **Recommendation**: proceed on evidence; validate with 1–2 real users at prototype review.
**Approval needed**: accept, or supply workflow corrections now.

## Q5. Conflict-resolution prerequisite (blocks build-dependent phases)
Committed merge conflicts make compilation ambiguous; pixel implementation cannot responsibly start until resolution via **separately authorized** work (Phase 0 skipped — not smuggled in). Prototype isolation (mock-data, no conflicted imports, no real APIs) is evaluable independently and is not blocked by production conflicts.
**Approval needed**: authorize and sequence the resolution workstream; confirm the isolation understanding.

## Q6. Hosting/PWA scope (unchanged: design-only, no config touched)
`base` vs manifest-scope mismatch documented as hosting concern; launch-scope PWA = installable + precached shell + honest offline banner; no background-sync/offline-queue.
**Approval needed**: confirm scope, or scope deployment/offline-queue work separately.

## Q7. Fixture/test-data strategy for prototype acceptance
Prototype must use clearly-marked mock data, zero production records. **Recommendation**: owner supplies or approves a synthetic set during Phase 3 review.
**Approval needed**: data-sourcing approach.

## Q8. APPROVED — Folder-management UI removed (constraint, not direction approval)
Archive becomes a unified full-width document workspace: no folder tree/sidebar/drawer/panel, no folder create/rename/delete/move UI, no drag-to-folder, no folder-browsing workflow. Backend records, columns, relationships, and existing `folderId` links preserved untouched; no API/schema/migration change. Upload compatibility verified against existing contracts (no blocker, no owner decision required). Default: a document's folder origin may appear as a read-only metadata chip (existing response data, no management affordance).
**Not approval of any visual direction (A/B/C/D all remain unapproved).**

## Q9. APPROVED — Zero horizontal scrolling product-wide (constraint, not direction approval)
No horizontal scrolling permitted on any page or nested component (tables, toolbars, drawers, dialogs, tabs, data views) at 320/375/390/430/768/1024/1366/1920; vertical scrolling is normal. Dense tables become multi-line records/cards with all fields and actions preserved; nothing dropped to fit; long/mixed-direction values wrap with inspectable full text. Acceptance requirement for prototype/implementation QA (10-check matrix in design-system doc); nothing marked passed.
**Not approval of any visual direction.**
