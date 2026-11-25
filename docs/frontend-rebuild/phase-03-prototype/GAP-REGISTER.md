# GAP-REGISTER.md — prioritized prototype gaps (Phase 3.1 · updated after 3.2/3.3/3.4)
Evidence: `COVERAGE-AUDIT.md` + isolated Temp-output runs (Phase 3.4 suite: 18/18 green).
Priorities: P0 security/business-correctness · P1 core workflow gaps · P2 important UX/a11y · P3 polish.
No P0 issues found in the prototype (no backend, no secrets, approval gates verified sound).

## Closed
- **GAP-P1-01 — CLOSED (3.2).** Unknown project id → explicit Not Found panel + back actions; safe `project()`; zero unhandled rejections. Verified by `verify/regression.spec.ts`.
- **GAP-P1-06 — CLOSED (3.3).** Users/roles/overrides/access are now live mock workflows with self-denial and last-admin guards. Verified by `verify/admin.spec.ts` (7 tests).
- **GAP-P1-02 — CLOSED (3.4).** Real in-prototype viewer modal: metadata card, synthetic per-type body, explicit "unsupported type" fallback, explicit "no preview content" empty state, linked-doc navigation, Escape + focus restore. No rendering library added; the preview is text/layout-shaped only. Verified by `verify/archive.spec.ts`.
- **GAP-P1-03 — CLOSED (3.4).** Per-document status change, replace workflow (old version kept in history), and links manager (add / visible-duplicate-prevention / confirm-remove / navigate) now exist with perm gates. Verified by `verify/archive.spec.ts`.
- **GAP-P1-09 — CLOSED (3.4, Archive only).** Four-step CSV import wizard: local file → column mapping → per-row review → summary + explicit confirm → honest partial-result toast. Browser-only; no network, no disk. `Warehouses.tsx` import is still absent (explicit scope cut, see below).
- **GAP-P2-02 — CLOSED (3.2).** `window.__protoTestHooks.failNext()` injection across `project|documents|mrs|overview|sites`.
- **GAP-P1-05 — CLOSED (3.5).** MR project filter + audited project scoping (`filterVisible` / `checkFilterProject`).
- **GAP-P1-10 — CLOSED (3.5).** Type-aware stock movement form (IN/OUT/TRANSFER/ADJUSTMENT/RETURN) with derived balances.
- **GAP-P1-04 — CLOSED for Inventory + Requests (3.5).** Sorting + pagination on both scoped lists. Other screens still unsorted (documented).
- **GAP-P2-04 — CLOSED (3.3 + 3.5 + 3.6).** Per-user mock identities and live project memberships made self-denial, scoping and READ/WRITE distinctions genuinely testable.

## Open
## Closed in 3.8
- **GAP-P1-13 — CLOSED.** The Projects list was seeded straight from the `projects` array, so it showed every project regardless of project membership — a real data-scope leak for any membership-limited identity. It now reads `mrApi.projects(userId)`, the same audited scoping rule the rest of the app uses.
- **GAP-P1-14 — CLOSED.** `sites.edit` is granted by no `ROLE_BASE`, so the project "add site" affordance could never render for any demo identity. Recorded, not worked around: no permission was invented to make a button appear.
- **GAP-P1-04 — CLOSED for Archive, Warehouses and Items (follow-up).** Archive documents: sortable title / category / status / updatedAt (default updated-desc, mirroring the audited `GET /` documents route) + pager (5/page over 8 seeded rows). Warehouses: sortable code / name / type / location / project + pager (6 rows after 3 seeded additions). Items: sortable code / name / category / safety-level (undefined sorts last both ways) + pager. Every sort/pager transition re-slices genuinely rendered rows — proven by `verify/archive.spec.ts` (5 new tests) and `verify/inventory.spec.ts` (4 new tests), not by control existence. **Remaining was closed in 3.12:** Projects sorting + BOQ/IPC sorting + pagination (see "Closed in 3.12").
- **Per-list contextual export — ADDED where a matching report exists.** `ContextualExport` on Warehouses (`warehouses` report) and Items (`items` report): same `reportApi.export` engine, same gates (`reports.view` + dataset read permission, enforced on the mock path), same project scope, active search re-applied by the engine to already-scoped rows. Proven by 3 new `verify/exports.spec.ts` tests (filtered file content, management scope boundary, JSON catalogue). Archive deliberately has NO button: no documents report exists, and the audited documents export is XLSX-only (see backend-contract notes below). No permission was granted, removed or widened; `sites.edit` untouched.

## Closed in 3.12 (prototype UX remediation — full UX-REVIEW sweep)
All items below were implemented inside `docs/frontend-rebuild/phase-03-prototype/` only
(src + verify + docs). No production, backend, permission-model or dependency changes.
New proofs: `verify/remediation-p1.spec.ts` (28 tests: all ten P1s), `verify/remediation-p2p3.spec.ts`
(P2/P3 + gap closures), `verify/a11y.spec.ts` (7 tests: measured touch/contrast/focus/motion).
- **F-01 / P1-01 — CLOSED.** Viewer membership-empty state is now scoped and honest
  (`noProjectsScoped` + hint + Home next action); generic empty kept for a genuinely empty
  list. No project names leak (asserted for all four codes).
- **F-02 / P1-02 — CLOSED.** Project Documents/Warehouses/Stock tabs link to the canonical
  routes with `?project=` applied; Archive/Warehouses/Stock/Requests read the param with
  membership-first denial; Overview carries live counts + four deep links.
- **F-03 / P1-03 — CLOSED.** `legacyFolder` placeholder fixed (`{f}` → `{name}` in both
  locales + caller); row and viewer modal render the real folder name; corruption guard
  expanded across routes/dialogs/locales fails on any `{token}` reaching the DOM.
- **B-01 / P1-04 — CLOSED.** Approval now confirms (number/project/lines shown) like rejection;
  cancel is a no-op; double-approve refused; unauthorized approve is 403 on the mock path.
- **B-02 / P1-05 — CLOSED.** Self disable/delete are disabled with reasons when no backup
  admin exists; enabled with an explicit self-warning confirm when the mock rule permits
  (another active admin remains); self-delete always refused; last-admin guard intact.
- **B-03 / P1-06 — CLOSED.** Role cards open a read-only matrix: description, ROLE_BASE
  grouped by functional area (keys as muted diagnostics), per-user effective preview
  (role/grant/deny/none) with DENY-beats-GRANT note. All five roles incl. `technical`.
- **B-06 / P1-07 — CLOSED.** Transfers render one canonical `transferRoute` + dual effect
  line from warehouse/destination ids (never signed-quantity guessing); missing destination
  blocks at form level; all five types localized; balances verified against the engine.
- **C-01 / P1-08 — CLOSED.** Phone bottom bar keeps 5 primary tabs + a `More` sheet exposing
  every other authorized destination (role-filtered, RTL/LTR, keyboard + focus restore).
- **C-02 / P1-09 — CLOSED.** Contextual export strip stays mounted on zero matches with a
  truthful zero count + header-only file; scope/filter still enforced on the mock path.
- **C-03 / P1-10 — CLOSED.** Audit export takes the grid's `sortBy`/`sortDir` through the
  `order()` engine step (all five sortable columns × both directions, full filtered set).
- **F-04/F-05 / P2-01/P2-02 — CLOSED.** Archive/Admin rows keep primary actions visible and
  move the rest into an accessible `Menu` (keyboard/arrows/Escape/focus-restore, danger
  group separated); access cell explains itself via per-project tooltip.
- **F-06 / P2-03 — CLOSED.** Archive search is a real form: Enter ≡ Search button, page
  resets, sort/filters kept, results announced via live region.
- **F-07 / P2-04 — CLOSED.** Demo banner lives inside the viewer modal (both locales).
- **F-08 / P2-05 — CLOSED.** Status change is two-step (select → confirm with doc/from/to).
- **F-09 / P2-06 — CLOSED.** Hub renamed `إدارة المخزون`, stock tab `حركات وأرصدة المخزون`
  (EN mirrors); routes/semantics untouched.
- **B-04/B-05/B-07/B-08/B-10 / P2-07..P2-11 — CLOSED.** Overrides/access localized
  (values unchanged, DENY precedence noted + tested); `approve:false` gone from user copy;
  movement options carry plain-language effects (keys stay in code); every status enum
  renders via `statusLabel()` in both languages; exports carry raw codes.
- **P2-12 — CLOSED.** Dashboard: functional status cards (filtered deep links), spaced
  stat cards, rewritten greeting, recent movements with type/warehouse/reference.
- **P3 batch — CLOSED except noted.** Breadcrumbs localized (project crumbs resolve via
  scoped list, never raw ids); email/code bidi isolation; palette hints localized;
  login radio semantics + scope hints + technical tile + pre-auth language switch;
  direction-aware arrows; repeat-issue `استكمال الصرف (المتبقي N)` from live balance;
  seed corruptions fixed (`للأساسات`, `دفعة أولى`, direct-value note); direct-value IPC
  helper copy; Western-digit convention documented in `i18n.tsx`; density toggle real
  (state + tooltip + persistence); collapse persists; honest offline banner; footer build
  context; overview summary from live counts; `sites.edit` truthful unavailable note.
- **GAP-P1-04 remainder — CLOSED.** Projects sorting (code/name/client/status) + BOQ
  (code/desc/qty/total) and IPC (number/date/status/net) sorting + pagination; page resets
  on filter/sort change.
- **Warehouse CSV import — CLOSED.** Stepped browser-only wizard (file → Arabic/English
  header mapping → row review with per-row reasons → summary → explicit confirm), shared
  `parseCsv`, duplicate-on-code, project picker scoped to visible projects, no XLSX claim.
- **Archive export — CLOSED (prototype-only).** `documents` metadata-CSV report through the
  same engine/gates (reports.view + archive.view + scope), honoring Archive search/status/
  project filters; production XLSX-only contract unchanged and documented.
- **GAP-P2-03 — CLOSED.** Density/collapse/offline/footer all exercised with regression
  tests (toast on this: density persists, collapse persists, offline banner honest).
- **GAP-P2-06/P2-07 (prototype part) — CLOSED.** Empty states verified without production
  (scoped-empty vs filtered-empty vs denied); notifications gained refresh + working deep
  links; failure-injection retry covered on principal workflows.
- **GAP-P3-01/P3-03 (prototype part) — CLOSED.** Mixed-direction fixtures + isolation;
  footer/demo-build context; native radio semantics on login; corrected accessible names
  (rail/brand/mobile nav) with regression tests.
- **Remaining cuts (not prototype-fixable, kept):** real-device touch feel, real
  screen-reader pass, human contrast adjudication on brand hues, production export-gate
  confirmation, financial model (contract/tax/retention), `sites.edit` grant, XLSX
  capability, production conflict markers. See FINAL-ACCEPTANCE owner decisions.

## P1 — core workflow gaps
- **GAP-P1-01 — invalid project id: unhandled rejection + stuck skeleton.** `mockApi.project()` → `clone(undefined)` throws (`SyntaxError: "undefined" is not valid JSON`, observed twice as pageerror); `ProjectWorkspace.tsx` has no catch → navigation never runs, loader spins forever, no user feedback. Evidence: Temp run console + `/projects/does-not-exist` assertion. Acceptance: unknown id navigates back to hub with an explanatory notice; zero unhandled rejections. (Pattern warning for production: same shape would be worse against real APIs.)
- **GAP-P1-02 — archive preview is toast-only.** No viewer modal (MIME probe, revision content, error states all absent). Evidence: `Archive.tsx` preview buttons. Acceptance: modal with simulated content states + Escape + focus return. **→ CLOSED in 3.4** (see Closed above).
- **GAP-P1-03 — per-document status/replace/links actions absent.** Rows expose only preview/download/edit/delete; audited workflows need inline status change, replace, links manager. Evidence: `Archive.tsx` row actions. Acceptance: each rendered (simulated OK) with correct perm gates. **→ CLOSED in 3.4.**
- **GAP-P1-04 — sorting absent everywhere; pagination projects-only.** Production sorts/filters/paginates per list. Evidence: no sort controls in any page; pager only `Projects.tsx`. Acceptance: sortable headers (at least code/name/date) + pager on all long lists. **→ closed for Inventory + Requests in 3.5; closed for Archive + Warehouses + Items in the 3.8 follow-up. Remaining: Projects list (pager only, no sort headers); BOQ/IPC tabs unchanged.**
- **GAP-P1-05 — MR filters incomplete.** Only status + text search; audited project filter missing. Evidence: `Requests.tsx` toolbar. Acceptance: project select filtering the mock list.
- **GAP-P1-06 — admin workflows read-only.** User edit/overrides, role edit/clone, access matrix are toasts/placeholders. Evidence: `Admin.tsx`. Acceptance: at minimum editable mock matrix + self-guard demonstration or explicit scope cut. **→ CLOSED in 3.3.**
- **GAP-P1-07 — CLOSED (3.6).** BOQ line CRUD (delete bounded by `blockBoqItem`) + IPC lifecycle with BOQ linkage, derived net and the audited transition matrix. Contract value / tax / retention remain unavailable — the model has no source for them.
- **GAP-P1-08 — CLOSED (3.7).** `reportApi` exports 8 datasets as real local CSV/JSON downloads, gated on the audited `reports.view` **on the mock path** plus each dataset's own read permission, and bounded by project-level scoping. UTF-8 BOM, RFC 4180 quoting and formula-injection neutralization verified. Scope cut recorded below.
- **GAP-P1-09 — import flows absent.** No Excel/smart-import modals. Evidence: `Archive.tsx`, `Warehouses.tsx`. Acceptance: at least a stepped mock import modal on one screen, or explicit scope cut. **→ PARTIALLY closed in 3.4** (Archive import exists, CSV only); **Warehouses import CLOSED in 3.12** (stepped CSV wizard with mapping/review/confirm; see "Closed in 3.12").
- **GAP-P1-10 — stock create is a stub; TRANSFER-conditional + issue-prefill missing.** Evidence: `Stock.tsx` modal; `Requests.tsx` one-click issue. Acceptance: type-aware form (destination shown for TRANSFER) + remaining-prefill issue dialog (simulated OK).
- **GAP-P1-11 — CLOSED (3.7).** Audit page now has text search + user / action / entity selects + a date range, combinable, with clear, live count, sort, pagination and per-entry details. No project filter: the audited `AuditLog` model has no project field.
- **GAP-P1-12 — EN body copy untranslated.** Chrome flips; page headings/bodies stay Arabic. Evidence: EN-mode snapshot. Acceptance: full chrome+heading dictionary or documented EN-scope cut.

## P2 — important UX/accessibility (implemented-but-unverified or model limits)
- **GAP-P2-01** — focus trap/restore/initial-focus inside modals never runtime-walked (code present). Acceptance: keyboard-only open→trap→Escape→restore walkthrough per dialog.
- **GAP-P2-02** — error/failure states not demonstrable (mock never rejects except P1-01). Acceptance: failure-injection toggle or documented untestable.
- **GAP-P2-03** — density toggle, rail collapse, offline banner implemented but never exercised. Acceptance: toggle + assert, offline via context flag, collapse persist check.
- **GAP-P2-04** — self-denial/last-admin/project-memberships unrepresentable in role-only mock model. Acceptance: document as mock-model limit, or add per-user mock identities.
- **GAP-P2-05** — touch targets (44px rules) and contrast ratios not measured; reduced-motion behavior not runtime-tested. Acceptance: measure on demand in a later phase.
- **GAP-P2-06** — empty-overview/low-data states untestable with static non-empty mock (except MR search-empty, verified). Acceptance: empty-fixture switch or accept.
- **GAP-P2-07** — notification deep-links + 30s poll absent (static list). Acceptance: link walkthrough + documented poll cut.

## P3 — polish
- **GAP-P3-01** — no email/ID mock samples for mixed-direction proof. **GAP-P3-02** — no search-dropdown variant (page + palette only). **GAP-P3-03** — skeleton shimmer aesthetics; footer/version info; `rolePick` aria (radiogroup without radio roles — acceptable, noted).

## Backend-contract notes (3.8 follow-up — read-only, no backend touched)
Evidence: `apps/api/src/modules/documents/documents.routes.ts` (`GET /`, `GET /export/xlsx`, `GET /:id`), reviewed read-only for this follow-up. No permission or policy was changed; the items below need a separate owner decision.
- **Documents list scoping — prototype now matches the audited route.** `GET /` applies `filterVisible(ctx, list, item => item.projectId, 'archive.view')` ("backend-scoped to member projects, null-project rows stay visible"), default sort `updatedAt` desc, server pagination. The prototype's `mockApi.documents(filter, actorId)` applies the same rule before the text filter, and the Archive default sort is updated-desc. Three Phase-3.4 test expectations written against the old unscoped list were updated to the audited rule (viewer fixtures switched to project-less documents; absence of out-of-scope rows asserted).
- **Documents export — XLSX-only in the audited contract.** `GET /export/xlsx` is gated on `archive.view` alone and needs `excelService`. The prototype export engine produces CSV/JSON only. **3.12:** a prototype-only `documents` metadata-CSV report + Archive export button were added strictly inside the prototype (same gates plus scope; metadata only, never file contents). This does not authorize a production CSV endpoint — that still needs an owner decision (new CSV documents report vs XLSX capability), not a prototype-side invention.
- **Export gate tightening — unchanged, still needs confirmation.** The prototype requires `reports.view` PLUS each dataset's read permission; the audited routes gate on `reports.view` alone. Deliberate and untouched by this follow-up.
- **`GET /:id` hides existence** (`requireProjectAccess(..., { hideExistence: true })`). The prototype mirrors this: the link picker and viewer resolve only scoped documents, and out-of-scope link targets are stated as hidden rather than distinguished from missing.
