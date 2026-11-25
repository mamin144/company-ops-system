# Phase 2 — Known Integration Gaps (فجوات التكامل المعروفة)
`docs/frontend-rebuild/phase-02/known-integration-gaps.md` — constraints carried from Phase 1. Labels: **[verified]** source-seen · **[inferred]** effect reasoned, not run · **[historical]** prior report, not rerun.

## G1. Committed merge conflicts — prerequisite before build-dependent phases [verified]
`<<<<<<< HEAD … >>>>>>> 22bb862` blocks committed in ~14 frontend files (`App.tsx`, all Phase-5 pages, `styles.css`, `lib/permissions.ts`, `ProjectIpcsTab.tsx`, `FinancialsPage.tsx`, `AdminUsersTab.tsx`) + backend `routes/index.ts:2-30`. HEAD ≈ Command-Deck/Phase-5 + 31-key catalog; incoming ≈ older flat UI + older vocabulary (incl. a `FinancialsPage` variant referencing undefined `boqTotal` — inferred breakage). Effects: compilation/execution ambiguous; line numbers snapshot-relative. **Design impact**: specs avoid pixel-commitments that depend on conflicted lines; pixel work waits separately authorized resolution (Phase 0 skipped — not executed under another name).

## G2. Permission vocabulary — design uses backend truth [verified]
Canonical for design: backend `ALL_PERMISSIONS` (28) + `MANAGED_PERMISSIONS` (31 = +`roles.manage`, `projects.access`, `users.resetPassword`); frontend incoming block matches nothing server-side (stale). Overrides: DENY > GRANT; project narrowing never broadens; `projects.access` bypasses narrowing without granting base. Legacy snapshot gates (documents download, import preview/confirm, stock POST) bypass central `can()` — [inferred] stale-permission edge only.

## G3. MR reject route mismatch + approval authority [verified]
UI calls `POST /api/material-requests/:id/reject` (no backend route → inferred 404). Supported: `POST …/approve {approve:false}`. Spec S10 designs Reject exclusively through the supported contract. No backend route added (forbidden).
Visibility vs authority: `materialRequests.view` exposes read-only submitted-request information only; Approve/Reject actions require exact key `materialRequests.approve` (verified in backend `ALL_PERMISSIONS`, the approve-route guard, and frontend gates) plus `submitted` state. Dashboard/queue headings must never imply approval authority to view-only users (enforced in brief §5 + specs S2).

## G4. Export gates overbroad [verified]
Buttons shown on entity-`view` rights; server exports require `reports.view` (projects/items/warehouses/stock transactions). Design: gate export affordances on `reports.view` (or document the 403 path); never imply universal availability.

## G5. Archive mobile folder drawer [historical + source-supported, moot for new design]
Prior run: toggle never applies `open` (handler resets its own state). Source matches the mechanism. The defect persists in the current app (fix needs separate authorization), but the approved unified Archive proposes no drawer — folder filtering is replaced by unified search/filters, so the defect blocks nothing in the new design.

## G6. PWA base-path/scope [verified config, inferred effect]
`base '/company-ops-system/'` vs generated manifest `start_url/scope '/'`; `includeAssets` lists missing `favicon.ico`. Effects unverified without runtime. Flagged for hosting decision, not redesign.

## G7. Historical test issues (not rerun) [historical]
`authz:22` broad-locator failure (scoped fix present on file's HEAD side); `final-verification:32/33` + `functional-gaps:17` same data family; legacy 401 refresh noise on stale sessions. Cited as history only.

## G8. Weak states to strengthen without contract changes [verified]
No error/retry on Financials + MR list; blank-while-loading project details; silent sub-fetch failures; missing `busy` guards on most CRUD modals (double-submit risk; server idempotency unknown); native `confirm()` for bulk access; toast-only critical errors (no live regions observed).

## G9. Unverified at design time [unknown]
All runtime behavior; large-file upload/preview limits; notification-poll load; SW update/offline flows; BOQ/IPC `Can` keys (skim); exact server error payloads; DB contents. Phase 10 must prove; nothing here is claimed tested.

## G11. Upload folder-independence (verified compatible — no blocker) [verified]
Upload schema accepts missing `folderId` (`documents.validators.ts:6`: optional or empty); document list returns all authorized documents without `folderId` filter (conditional filter, `documents.routes.ts:93`); QuickUpload sends `folderId` only when set. Folder-independent upload and unified retrieval are fully supported by existing contracts — no invented defaults, no API change, no owner decision required. Folder `PATCH …/move` and folder CRUD routes remain server-side, unused by the new UI; records and relationships preserved.

## G10. Prototype isolation vs production-build readiness (boundary clarification)
- **Isolated mock-data prototype (Phase 3, unauthorized until prompted)**: evaluable independently IF built without importing conflicted production sources, without touching production config, and without contacting real APIs (mock adapter + build guard against mock-mode leakage, per master plan §Phase-3). Source conflicts do not inherently block such an isolated prototype.
- **Production implementation + build-dependent phases**: remain blocked where compilation/integration/testing depends on conflicted files, until the owner separately authorizes narrow conflict resolution. Phase 0 stays skipped; no baseline workflow executed under another label.
- No claim made that the current app builds or that resolution is complete.
