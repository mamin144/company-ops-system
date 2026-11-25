# WP3B — Source Recovery & Conflict Provenance Audit

**Phase 14 / Work Package 3B — read-only forensic investigation**

| Field | Value |
|---|---|
| Report ID | WP3B |
| Date of investigation | 2026-11-18 |
| Repository | `D:\Default Project\company-ops-system` |
| Branch | `main` (upstream `origin/main`) |
| HEAD at start and end | `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf` |
| Mode | **Strictly read-only.** No mutation of any kind was performed except the creation of this one file. |
| Deliverable | This file only. No conflict resolution, no rebuild, no restart, no migration. |

> **Verdict (exact, from the permitted set):**
> **`RECOVERY PATH IDENTIFIED — OWNER APPROVAL REQUIRED`**

> **Read this caveat before the verdict is acted on.** "Recovery path identified" refers to the **mechanical provenance and reconstructability of the conflicted tree** — all 81 conflict hunks are attributable, and a buildable tree can be reconstructed from known commits. It does **not** mean a Phase 14 frontend can be recovered: **no Phase 14 frontend source exists anywhere in the repository** (§6). The recovery path reconstructs the *pre-Phase-14 Command Deck UI plus legacy modules*, which is the only source that exists.

---

## 1. Executive Findings

1. **All 81 conflict hunks were committed by the merge commit itself.** Merge commit `f91ed2f` (`m.amin`, 2026-10-11 09:19:57 +0000) merged first parent `13cce46` ("محاولة تغير شكله بس دي نسخه مستقره امنه", Command Deck restyle) with second parent `22bb8621` (Mahmoud Amin, 2026-09-26 13:45:08 +0300, "Add VITE_API_URL to web build step"), from merge base `c8d72a6` (2026-09-13). **Neither parent contains a single conflict marker** (verified: `P1 = 0`, `P2 = 0`). The markers exist only in `HEAD`, i.e. they were committed unresolved. `main` therefore cannot build from source. This is a repository-authoring defect, not a working-copy accident.

2. **The 79-vs-81 discrepancy is a single file, fully explained.** `HEAD` contains 81 hunks across 15 files; the working tree contains 79 hunks across 14 files. The difference is exactly **`apps/web/src/lib/permissions.ts` (2 hunks)**, whose working-tree copy carries a prior session's resolution (mtime `11/18/2026 10:27:06`, all other `apps/web/src` files dated `10/11/2026 12:19:44`). No other file's marker state differs.

3. **Every hunk has the same two-sided shape**: `<<<<<<< HEAD` versus `>>>>>>> 22bb86216dfc3ef7502b7c36906e4665ecfd9f5e`. There is no `|||||||` base section, no third-party side, and no hunk whose "other side" is anything but P2. Marker counts are internally consistent in the working tree: 79 open, 79 separator, 79 close.

4. **The conflict is overwhelmingly a styling-architecture collision, not a logic collision.** P1 (`13cce46`) introduced the "Command Deck" design system — semantic CSS classes backed by a 1,898-line token/CSS block — and P2 (`22bb862`) kept the older inline `style={{ … }}` objects. Measured against P1, the other side's lines are absent only where inline styles were replaced. Only **four** hunks in the entire set carry substantive (non-cosmetic) divergence, all identified in §5.

5. **Three hard correctness constraints were found inside single hunks** — these are the only places where a blind "take HEAD" or "take other side" produces a defect:
   - `FinancialsPage.tsx` @367: the other side references `boqTotal`, an identifier **that no longer exists in that scope** (P1 replaced its declaration at L348 with `contractValue`). Taking the other side is a **compile error**.
   - `AdminUsersTab.tsx` @323: the other side stores `o.effect` verbatim (lowercase from the backend), while the component compares against `'GRANT'` / `'DENY'` at L375/376/398/410. Taking the other side is **functionally broken** (silent: no radio preselected).
   - `permissions.ts` (already resolved): the local resolution is **vocabulary-correct but incomplete** — 30 keys, missing `ipcs.approve` and `ipcs.resubmit` out of the 32-key web catalogue (29 `ALL_PERMISSIONS` + `roles.manage` + `projects.access` + `users.resetPassword`).

6. **`apps/web/src` contains no Phase 14 code whatsoever.** Zero occurrences of `ipc_items`, `import_history`, `deleted_at`, `cancel_reason`, `ipc_status_events`, `phase14`. The only two `under-review` hits are pre-existing document-status label maps in `ArchivePage.tsx` L23/L28, and `under-review` also appears twice in the **pre-Phase-14** production bundle — so it is **not** Phase 14 evidence. Any claim that Phase 14 frontend was implemented in `apps/web` is refuted.

7. **`import_history` provenance is settled and the suspected premise was a false inference.** `import_history` was created by `001_initial_schema.sql` (L318) and seeded by `15_import_json_history.sql` — both applied on 2026-10-03. Migration `24_phase14_recovery_import_tables.sql` does **not** create `import_history` (it creates `password_reset_tokens`, `backups`, `restore_jobs`, `import_batches`). The single row (`37ac9e4a-8001-4fbe-ace8-9ce0070aa9a9`, `sweep.xlsx`, `2026-09-03 00:26:51`) is the migration-15 seed, predating every Phase 14 file. There is no evidence that any Phase 14 migration ran.

8. **Migrations 22–24 are genuinely unapplied, and the running service cannot apply them even if restarted.** Live `_migrations` has 19 rows (`001`…`21`; `21_direct_amounts.sql` alone at `2026-10-04 02:08:35`, the rest at `2026-10-03 06:10:14`). `apps/api/src/database/migrations` holds **22** files; `apps/api/dist/database/migrations` holds **19** (no 22/23/24). `migrate.ts` resolves migrations from `path.join(__dirname, 'migrations')`, so the running `dist/server.js` build sees only the 19 and correctly reports "up to date". The mismatch is a **stale build**, not a failed migration.

9. **The live database is PostgreSQL 18.4 on port 5432 (`cos_db`, user `cos`), not the PG 17 @ 5433 staging instance that four prior reports describe.** Eleven Phase 14 schema objects are absent from it (§8). No Phase 14 index exists. `projects.contract_value` is still `NOT NULL DEFAULT 0`, `ipcs_status_check` still permits only `draft/submitted/approved/rejected`, and `audit_logs` has no `project_id`.

10. **Both parents are ancestors of `HEAD`** (`git merge-base --is-ancestor` exit 0 for `13cce46` and `22bb862`), confirming `f91ed2f` is a true two-parent merge — so both sides of every hunk are recoverable from immutable history. This is the structural reason the verdict is "recovery path identified" rather than "insufficient evidence".

---

## 2. Scope & Limitations

### 2.1 In scope
- Phase 14 frontend source identity in `apps/web` (source tree, build output, route surface).
- The 81 unresolved conflict hunks: count, shape, provenance, and per-hunk functional consequence.
- Migrations 22–24 versus the live database schema, and versus the deployed `dist` migration set.
- Reconciliation of the five prior Phase 14 verification reports whose claims touch these areas.

### 2.2 Explicitly out of scope
- Resolving, staging, or otherwise altering any conflict.
- Rebuilding, restarting, or reconfiguring any service.
- Applying, reverting, or authoring migrations.
- Authenticating to the API, driving the UI, or performing HTTP state-changing calls.
- Establishing the identity of the actor behind the `audit_logs` login event (recorded as an event only, §3.4).

### 2.3 Limitations that bound the confidence of this report
1. **No build was executed.** Prohibited. Compile-error findings (§5, `FinancialsPage`, `AdminUsersTab`) are derived from static reading of declarations, scopes, and comparison literals — highly reliable, but not compiler-confirmed.
2. **Migration safety is a static assessment only.** No migration was run, including in a scratch database. Statements about `23_phase14_ipc_workflow.sql` (constraint rebuild, `DROP NOT NULL`) describe the SQL text and the current live constraint definition, not an executed migration.
3. **Runtime UI behaviour was not exercised.** The Vite dev server's HTTP 500 for `src/App.tsx` was observed, but no page was loaded, no route navigated, and no shared browser tab was touched.
4. **Working-tree content is a snapshot.** The prior session's `permissions.ts` edit and the 12 untracked paths are described as found; this investigation did not and cannot establish who authored them beyond file-system mtimes and `git status`.
5. **Arabic-language provenance.** Two commit subjects are Arabic; they are quoted verbatim as identifiers, not translated, to avoid paraphrase drift.
6. **`HEAD` cannot be used as an independent baseline for text comparison.** Because `HEAD` *is* the conflicted file (both sides present, markers included), "is the other side a subset of `HEAD`" is trivially 100% and meaningless. All survival metrics in §5 were therefore computed against **P1 `13cce46`**, with P2 as a control (control result: 100% for every file, validating the parser).

---

## 3. Baselines

### 3.1 Initial baseline (session start)
| Item | Value |
|---|---|
| `git rev-parse HEAD` | `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf` |
| Branch / upstream | `main` / `origin/main` |
| `git status --porcelain=v1` entries | **46** |
| Staged entries | **0** |
| Untracked entries | **12** |
| Conflict hunks in `HEAD` (`apps/web/src`) | **81** in **15** files |
| Conflict hunks in working tree | **79** in **14** files |

The 46 entries decompose as **34 modified tracked** + **12 untracked**:

- Modified tracked (34): 28 `apps/api/src/**` files (routes, repositories, services, middleware), 2 API log files, `apps/web/src/lib/permissions.ts`, `package.json`, `package-lock.json`, `packages/shared/src/permissions.ts`, `packages/shared/src/types.ts`, `scripts/install-service.ps1`, `test-results/.last-run.json`.
- Untracked (12): `COS_Full_Frontend_Rebuild_Phase_Prompts_AR.md`, `COS_Full_Frontend_Rebuild_Plan_AR.md`, `PHASE14_FINAL_REPORT.md`, `WP2_VERIFICATION_REPORT.md`, `apps/api/src/database/migrations/22_phase14_core_columns.sql`, `…/23_phase14_ipc_workflow.sql`, `…/24_phase14_recovery_import_tables.sql`, `apps/api/src/services/financials.service.ts`, `apps/api/src/services/password-reset-token.service.ts`, `apps/api/tests/migration.phase14.test.ts`, `docs/`, `scripts/fix-password-reset.js`.

> The `docs/` entry is a single untracked directory. **The entire documentation tree — including every prior Phase 14 report and this report — is untracked by Git.** No Phase 14 analysis document is committed.

### 3.2 Final baseline (captured 2026-11-18 12:05:54, immediately before writing this file)
| Item | Value | Delta vs initial |
|---|---|---|
| `HEAD` | `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf` | none |
| Branch / upstream | `main` / `origin/main` | none |
| Porcelain entries | **46** | none |
| Staged entries | **0** | none |
| Untracked entries | **12** | none |
| `HEAD` hunks / files | **81 / 15** | none |
| Working-tree hunks / files | **79 / 14** | none |
| Working-tree marker totals | open 79 / sep 79 / close 79 | none |
| Migrations in `src` / `dist` | **22 / 19** | none |
| `_migrations` ledger rows | **19** | none |
| `.md` files in `phase-14` tree | **22** | none |
| Source files (`.ts/.tsx/.js/.jsx/.css`) in `phase-14` tree | **0** | none |
| Files in `phase-14c/` | **12** | none (this report is the 13th) |
| Target report existed? | **No** (collision check passed) | — |

**Changes attributable to this investigation: zero tracked-content changes, zero staged changes, zero new untracked paths.** Creating this report adds a file inside the already-untracked `docs/` directory, so the porcelain entry count remains 46.

### 3.3 On the state of the repository
This repository is **not clean and must not be described as clean**. `git status` reports 46 entries, `HEAD` contains 81 committed conflict markers it cannot build through, and 3 Phase 14 migrations sit untracked. The *only* accurate statement is: **this investigation introduced no changes.**

### 3.4 One observed event, deliberately not investigated
`audit_logs` contains a `login` event at `2026-11-18 01:35:21.793-08` for user `cbb26cb7-0ec0-4f6a-be16-993dab47057e`. It is recorded here as a timestamped event only. Inferring the actor's identity from it is outside this work package and no inference is offered.

---

## 4. Verified Conflict-Marker Inventory

### 4.1 Method
- `HEAD` side: `git show HEAD:<path>` piped to a `^<<<<<<< HEAD` counter for every `.ts/.tsx/.css` under `apps/web/src`.
- Working tree: direct line scan with bracket matching (`^<<<<<<< ` → `^=======$` → `^>>>>>>> `), which additionally verifies well-formedness.
- Result is reproducible and was run twice (initial and final baseline) with identical output.

### 4.2 Per-file inventory

| File (relative to `apps/web/src/`) | Hunks in `HEAD` | Hunks in worktree | Working-tree hunk start lines | Status |
|---|---:|---:|---|---|
| `pages/ArchivePage.tsx` | 17 | 17 | 9, 69, 238, 254, 282, 316, 325, 358, 371, 407, 421, 434, 516, 540, 556, 615, 631 | conflicted |
| `pages/MaterialRequestsPage.tsx` | 13 | 13 | 248, 320, 522, 535, 576, 596, 692, 704, 729, 738, 747, 806, 828 | conflicted |
| `styles.css` | 10 | 10 | 31, 81, 129, 211, 225, 272, 516, 567, 1026, 1080 | conflicted |
| `pages/DashboardPage.tsx` | 9 | 9 | 54, 153, 229, 292, 374, 424, 462, 506, 546 | conflicted |
| `App.tsx` | 7 | 7 | 57, 218, 398, 413, 463, 472, 495 | conflicted |
| `pages/ProjectDetailsPage.tsx` | 6 | 6 | 130, 144, 187, 220, 275, 301 | conflicted |
| `pages/ProjectsPage.tsx` | 6 | 6 | 99, 113, 127, 142, 225, 245 | conflicted |
| `pages/StockPage.tsx` | 4 | 4 | 135, 184, 257, 297 | conflicted |
| `components/projects/ProjectIpcsTab.tsx` | 2 | 2 | 67, 124 | conflicted |
| `components/ui.tsx` | 1 | 1 | 242 | conflicted |
| `pages/AdminUsersTab.tsx` | 1 | 1 | 323 | conflicted |
| `pages/FinancialsPage.tsx` | 1 | 1 | 367 | conflicted |
| `pages/ItemsPage.tsx` | 1 | 1 | 95 | conflicted |
| `pages/WarehousesPage.tsx` | 1 | 1 | 98 | conflicted |
| `lib/permissions.ts` | 2 | **0** | — | **resolved locally** |
| **Totals** | **81 / 15 files** | **79 / 14 files** | | |

### 4.3 Marker shape
- Every hunk opens with `<<<<<<< HEAD`.
- Every hunk closes with `>>>>>>> 22bb86216dfc3ef7502b7c36906e4665ecfd9f5e`.
- No hunk contains a `|||||||` base block, no hunk is nested, no hunk is malformed, and no file contains a stray marker outside the bracketed ranges above.
- Working-tree total: **79 open, 79 separator, 79 close** — perfectly balanced, i.e. no partially-edited hunk was left behind by the prior session.

### 4.4 Independent marker provenance test
| Revision | `<<<<<<<` occurrences under `apps/web/src` |
|---|---|
| Merge base `c8d72a6` | 0 |
| P1 `13cce46` | **0** |
| P2 `22bb862` | **0** |
| `HEAD` `f91ed2f` | **81** |

Conclusion: the markers were **introduced by the merge commit**, not inherited from either branch. No earlier commit is a suspect.

---

## 5. Conflict Provenance Matrix

Legend for **Recovery confidence**: `HIGH` = a reconstructable choice exists whose correctness is verified against declarations/constraints; `MEDIUM` = reconstructable but requires per-hunk design judgement; `LOW` = evidence does not fix a choice; `OWNER DECISION REQUIRED` = the choice encodes a product/business rule this investigation may not make.

Survival metric definition: **"other-side survival vs P1"** = percentage of the other side's non-blank lines that also exist verbatim in `13cce46`. Control (computed against P2 itself) is **100% for all 15 files**, confirming the parser.

| File | Conflict hunks | HEAD origin | Other-side origin | Common ancestor | Functional impact | Recovery confidence | Evidence |
|---|---:|---|---|---|---|---|---|
| `App.tsx` | 7 (57, 218, 398, 413, 463, 472, 495) | P1 `13cce46`: restructured shell — `navGroups` grouped navigation with per-item permission gates, `sidebarUser` footer block, Ctrl+K `CommandPalette` trigger, `collapsed` state, backdrop, Command Deck class names. Imports `Drawer` from `ui` and `CommandPalette`. | P2 `22bb862`: flat `navItems` array, plain sidebar markup, no palette, no backdrop, original brand block. | `c8d72a6`: flat nav list; file 180 lines. | Navigation information architecture and shell affordances. Taking the other side silently drops the command palette and the collapsed-sidebar/density integration (`lib/density.ts` is a HEAD-only file). Both variants are syntactically complete. | **HIGH** (for compile-correctness of taking HEAD); design intent = owner-visible but not blocking | File size base/P1/P2/wt = 180/411/274/532. Other-side survival vs P1 = **54/76 = 71.1%**; the 22 absent lines are precisely the flat-nav block and original shell markup. 7 hunks in both `HEAD` and worktree. `CommandPalette.tsx` and `density.ts` exist only in `HEAD` (verified by `git ls-tree` comparison against P2). |
| `components/projects/ProjectIpcsTab.tsx` | 2 (67, 124) | P1: semantic classes for the IPC tab layout. | P2: inline `style={{…}}` equivalents. | `c8d72a6`: inline styles. | Presentation only. | **HIGH** | Other-side survival vs P1 = **4/4 = 100%** — every other-side line survives inside P1, i.e. the divergence is additive styling. Sizes 214/242/230/264. |
| `components/ui.tsx` | 1 (242) | P1: adds `IconButton` and `Drawer` primitives (169 inserted lines), removes the P2-side block entirely. | P2: 0 lines on the other side of this hunk. | `c8d72a6`: neither primitive existed. | **Dependency-bearing.** `App.tsx` (HEAD side) imports `Drawer`; `CommandPalette.tsx` also consumes `ui`. Choosing the other side empties a hunk whose result is required by the HEAD-side `App.tsx` → unresolved import. | **HIGH** (take HEAD; the other side is empty by construction) | Hunk `@242` has `H169/O0`. Sizes 113/376/218/414. Other-side line count = 0. |
| `pages/AdminUsersTab.tsx` | 1 (323) | P1: `ov[o.permissionKey] = String(o.effect ?? '').toUpperCase();` with comment "backend stores lowercase (grant/deny); UI radios use uppercase". | P2: `ov[o.permissionKey] = o.effect;` (verbatim). | `c8d72a6`: file 0 lines — **the file does not exist in the merge base** (created on both branches independently). | **Silent functional defect on the other side.** Radios compare `=== 'GRANT'` / `=== 'DENY'` at L375, L376, L398, L410; lowercase `grant`/`deny` matches neither, so no override is preselected and a save can overwrite settings. P1 normalises correctly. | **HIGH** (take HEAD) | Hunk `@323` is 1 line per side. Sizes 0/402/401/435 (base/P1/P2/wt) — proof of independent creation on both branches. Other-side survival vs P1 = **0/1**. |
| `pages/ArchivePage.tsx` | 17 (9, 69, 238, 254, 282, 316, 325, 358, 371, 407, 421, 434, 516, 540, 556, 615, 631) | P1: semantic classes (`revBtn`, `statusSelect`, `fileRowActions`, `archiveCountChip`, `archiveSearchWrap`, `archiveFilterProject`, `docCheck`, `revsEmpty`, `revMeta`), desktop folders-panel collapse logic (11 inserted lines at @69), sidebar visibility state. | P2: inline styles, `mobileFolderOpen` handling, import of `IconEye`. | `c8d72a6`: inline styles, 420 lines. | Presentation + one behavioural branch (folder-panel collapse vs mobile drawer state). **`IconEye` is imported on the other side but never used** anywhere in the file (single occurrence, the import line) → discarding it is harmless; keeping it is also harmless. | **MEDIUM** — 18 other-side lines are absent from P1 and must be reviewed hunk-by-hunk; none of them reference an undefined identifier. | Other-side survival vs P1 = **9/27 = 33.3%**. Sizes 420/635/621/752. `IconEye` present exactly once (L12). Two `under-review` label entries at L23/L28 are **pre-existing** (also in the legacy dist bundle). |
| `pages/DashboardPage.tsx` | 9 (54, 153, 229, 292, 374, 424, 462, 506, 546) | P1: partial/parallel dashboard fetch with per-permission failure tolerance, permission-gated "Attention queue", `SectionHead` component, `dashKpi--span`, `dashSkeleton`, `dashGrid--spaced`. | P2: single `Promise.all`, inline-styled cards, `panel__head` sections, plain skeleton. | `c8d72a6`: 215 lines, no `SectionHead`, no attention queue, no dashboard skeleton classes. | **Hunk @229 is not a binary choice.** Both sides open the same `{/* ============ Error State ============ */}` block; P1 merely *prepends* the Attention queue, so taking P1 loses nothing from the error state. Elsewhere the delta is fetch strategy (N guarded requests vs one `Promise.all`) and styling. | **MEDIUM** — 48 of 86 other-side lines are absent from P1; fetch-strategy change has real behavioural consequences (partial rendering under 403) and should be consciously accepted. | Other-side survival vs P1 = **48/86 = 55.8%**. Revision token counts: `SectionHead` 0/5/0, `Attention` 0/5/0, `Error State` 0/1/1, `dashSkeleton` 0/2/0, `dashKpi--span` 0/11/0 (base/P1/P2). Sizes 215/456/401/595. |
| `pages/FinancialsPage.tsx` | 1 (367) | P1: `const contractValue = Number(p.contractValue ?? 0) > 0 ? Number(p.contractValue) : Number(p.boqTotal);` at L348 with comment "قيمة العقد المباشرة أولاً، والمقايسة كبديل عند غيابها" ("direct contract value first, BOQ as fallback when absent"). | P2: `const boqTotal = Number(p.boqTotal);` at L346 (base `c8d72a6` identical at L345), consumed at L370. | `c8d72a6`: `const boqTotal = Number(p.boqTotal);` | **Both choices are defective and this is a business-rule decision.** Taking the other side references `boqTotal`, which **no longer exists in `ProjectDetailView`'s scope** after P1's L348 rewrite → **compile error**. Taking HEAD compiles but introduces a **BOQ-value fallback**, which **violates the Phase 14 O2 rule** ("a financial value that was never entered is never coerced"): `financials.service.ts` (untracked, Phase 14, mtime 11/17/2026) exists precisely to return an `UnavailableField` envelope instead of a substituted number. | **OWNER DECISION REQUIRED** | `git show <rev>:…FinancialsPage.tsx` per revision: base L345 `boqTotal`, P1 L348 `contractValue` (3-term ternary), P2 L346 `boqTotal`. The worktree still consumes `boqTotal.toLocaleString()` at **L370** inside the hunk region. Component boundary: `ProjectDetailView` starts after `FinancialsPage` (L58) and `KpiCard` (L315); `contractValue` is declared inside `ProjectDetailView`, so L370's `boqTotal` is unresolved there. |
| `pages/ItemsPage.tsx` | 1 (95) | P1: semantic class. | P2: inline style. | `c8d72a6`: inline style. | Presentation only. | **HIGH** | Other-side survival vs P1 = **0/1**, but the single line is an inline-style attribute on the same element. Sizes 126/197/197/217. |
| `pages/MaterialRequestsPage.tsx` | 13 (248, 320, 522, 535, 576, 596, 692, 704, 729, 738, 747, 806, 828) | P1: `invTitleRow`, `mrRowActions`, `mrReviewBox`, `mrLineQty`, `mrLineUnit`, `issueNote` semantic classes (**all 6 verified present in `styles.css`**), review-box structure. | P2: inline `style={{ display:'flex', … }}` equivalents. | `c8d72a6`: inline styles, 232 lines. | Presentation only; no identifier is introduced on either side that the other lacks. | **MEDIUM** — 20 of 29 other-side lines are absent from P1, all of them inline-style attributes; each must be checked for a lost layout intent, but no semantic/API divergence was found. | Other-side survival vs P1 = **9/29 = 31%**. Sizes 232/739/740/847. All 6 P1-only classes resolve to exactly 1 CSS rule each. |
| `pages/ProjectDetailsPage.tsx` | 6 (130, 144, 187, 220, 275, 301) | P1: `projBackWrap`, `sitesStack`, `docRowActions` classes, section head restructure. | P2: inline styles / original markup. | `c8d72a6`: inline styles, 160 lines. | Presentation only. | **MEDIUM** — 8/8 other-side lines are absent from P1 (0% survival), the highest non-survival ratio in the set; each hunk needs individual review. | Other-side survival vs P1 = **0/8**. Sizes 160/358/358/411. Note P1 and P2 are the *same size* (358) while the base is 160 — both modified this file independently and divergently. |
| `pages/ProjectsPage.tsx` | 6 (99, 113, 127, 142, 225, 245) | P1: `projCodeLink` / `projNameLink` / `pageEyebrow` classes and header layout. | P2: inline styles, 252 lines. | `c8d72a6`: 166 lines. | Presentation only. | **MEDIUM** — 5 of 6 other-side lines absent; all are inline-style variants. | Other-side survival vs P1 = **1/6 = 16.7%**. Sizes 166/255/252/279. `.projCodeLink` x1, `.projNameLink` x2, `.pageEyebrow` x1 in `styles.css`. |
| `pages/StockPage.tsx` | 4 (135, 184, 257, 297) | P1: `stockLowBadge` class, table/badge restructure. | P2: inline styles. | `c8d72a6`: 303 lines. | Presentation only. | **MEDIUM** — 5 of 6 other-side lines absent; inline-style variants. | Other-side survival vs P1 = **1/6 = 16.7%**. Sizes 303/396/392/414. `.stockLowBadge` x1 in `styles.css`. |
| `pages/WarehousesPage.tsx` | 1 (98) | P1: `whName` class. | P2: inline style. | `c8d72a6`: inline style. | Presentation only. | **HIGH** | Other-side survival vs P1 = **0/1**, single attribute on one element. Sizes 139/205/205/209. `.whName` x1. |
| `styles.css` | 10 (31, 81, 129, 211, 225, 272, 516, 567, 1026, 1080) | P1: design-token layer (`--z-*`, spacing/colour tokens) plus a **1,898-line** appended Command Deck block (hunk at L1080 spans to L2978). | P2: original stylesheet with **literal** `z-index` values and inline-style support. | `c8d72a6`: 587 lines, no token layer. | **Dependency-bearing and global.** The classes referenced by all 13 other HEAD-side choices are defined only in the P1 block (all 26 checked classes resolve: `.invTitleRow` 1, `.mrRowActions` 1, `.dashKpi--span` 1, `.cmdkTrigger` 2, `.attention__item` 3, etc.). Separately, hunk literals at @211/@516/@567 are only *equivalent* to P2 because P1 defines the `--z-*` tokens — taking P1's markup with P2's stylesheet, or vice versa, breaks stacking order. | **HIGH** for consistency (take the P1 stylesheet wholesale, since the markup choices already require it) — but the **size** of the addition (≈4.5× the base) is an owner-visible design commitment. | Sizes 587/2641/2427/4195. Other-side survival vs P1 = **2/9 = 22.2%**. 26 HEAD-only classes all resolve in the P1 CSS block. Hunk spans: @1026 H46, @1080 H1898. |
| `lib/permissions.ts` | 2 (**`HEAD` only**) | P1: full 32-key catalogue with an explicit maintenance comment ("MUST stay in sync with the backend vocabulary: ALL_PERMISSIONS (@cos/shared) + roles.manage + projects.access + users.resetPassword"). | P2: reduced catalogue. | `c8d72a6`: **file absent** (0 lines) — created independently on both branches. | **Vocabulary correctness.** A stale key is rejected by the API with «صلاحية غير معروفة»; a missing key removes UI affordances. The local resolution already took the HEAD side and dropped the markers. | **MEDIUM** — the resolution is correct in kind but **incomplete**: 30 keys vs the 32 implied by its own comment. Missing: `ipcs.approve`, `ipcs.resubmit`. | `git diff HEAD` shows exactly the two marker removals and nothing else. Working-tree key count = **30**; `HEAD` file key-line count = **53** (both sides present). `packages/shared/src/permissions.ts` `ALL_PERMISSIONS` = 29 entries incl. `ipcs.approve` (L20) and `ipcs.resubmit` (L21). Resolution mtime `11/18/2026 10:27:06` vs `10/11/2026 12:19:44` for every other `apps/web/src` file. |

### 5.1 What the matrix means in aggregate
- **13 of 15 files** are cosmetic-or-near-cosmetic collisions between a semantic-class restyle and inline styles. For these, taking the HEAD side is *self-consistent*: every class it references is defined in the P1 `styles.css` block (verified for all 26 HEAD-only classes).
- **2 of 15 files** carry correctness-critical divergence: `FinancialsPage.tsx` (business rule + compile error) and `AdminUsersTab.tsx` (case normalisation bug on the other side).
- **1 file** is already resolved but incomplete: `permissions.ts`.
- The other side is **never** a superset of the HEAD side; conversely the HEAD side is **never** a superset of the other side either. The correct framing is "two divergent implementations of the same screens", not "one side plus additions".

### 5.2 Discarded metric, recorded for transparency
An earlier pass computed "other-side lines present in `HEAD`" and obtained 100% for every file. That result was discarded: `HEAD` *is* the conflicted file, containing both sides, so the metric was tautological. The numbers in the matrix instead use P1 `13cce46` as the reference and P2 as a control. The control returns exactly 100% everywhere, which validates the parser and makes the non-control percentages meaningful.

---

## 6. Phase 14 Source Identity & Dependency Map

### 6.1 Does Phase 14 frontend source exist?
**No.** Exhaustive scan of `apps/web/src` (`.ts`, `.tsx`, `.css`) for Phase 14 identifiers:

| Identifier | Occurrences in `apps/web/src` |
|---|---:|
| `ipc_items` | 0 |
| `import_history` | 0 |
| `deleted_at` | 0 |
| `cancel_reason` | 0 |
| `ipc_status_events` | 0 |
| `phase14` / `Phase 14` | 0 |
| `under-review` | **2** — `pages/ArchivePage.tsx` L23 (`'under-review': 'قيد المراجعة'`) and L28 (`'under-review': 'amber'`) |

The two `under-review` hits are **document**-status label maps, not IPC workflow status. They are also present in the deployed pre-Phase-14 bundle (`under-review` = 2 occurrences in `apps/web/dist/assets/index-BdtBinrW.js`), so they predate Phase 14 and are **not** evidence of Phase 14 code.

### 6.2 Age and provenance of the frontend source tree
| Fact | Value |
|---|---|
| Newest file in `apps/web/src` | `lib/permissions.ts` — `11/18/2026 10:27:06` (prior session's resolution) |
| Every other file in `apps/web/src` | `10/11/2026 12:19:44` |
| Merge commit local-equivalent time | `2026-10-11 12:19:57` (+03:00) |
| Interpretation | The source tree is a **checkout of the conflicted merge**, 13 seconds before the merge commit's local timestamp. No Phase 14-era edit ever touched `apps/web/src`. |

### 6.3 Build output
| Artifact | Value |
|---|---|
| `apps/web/dist/assets/index-BdtBinrW.js` | 452,994 bytes, mtime `10/11/2026 11:57:59` |
| `apps/web/dist/index.html` | mtime `10/11/2026 11:57:59` |
| Bundle markers | `ipc_items` 0, `import_history` 0, `deleted_at` 0, `cancel_reason` 0, `workflow` 0, `phase14` 0, `Phase 14` 0, `under-review` 2 |

Timing note, stated to remove a recurring ambiguity: the bundle is `11:57:59` **local (+03:00)** = `08:57:59 UTC`, which is **22 minutes before** the merge commit `09:19:57 UTC`. The bundle therefore cannot contain the merge's contents, and it contains no Phase 14 vocabulary either way.

### 6.4 Asymmetry with the backend
- **Backend Phase 14 source exists**: 28 Phase 14-identifier hits across 10 files in `apps/api/src` (`ipc.routes.ts` 5, `ipc.repository.ts` 7, `password-reset-token.service.ts` 7, `backup.service.ts` 2, `import-history.repository.ts` 2, plus singles), including untracked `services/financials.service.ts` (1,321 bytes, mtime `11/17/2026 14:15:47`) which implements the O2 "unavailable, never coerced to 0" contract.
- **Frontend Phase 14 source does not exist** (this section).
- **Deployed backend build is stale**: `apps/api/dist/server.js` 357 bytes, mtime `10/6/2026 10:31:45`; source `src/server.ts` 356 bytes, mtime `10/4/2026 15:24:49`. `dist/database/migrations` has 19 files (no 22–24).

This asymmetry is the single most important identity finding: **Phase 14 was built server-side only.** The frontend work stopped at design documentation and fixture prototypes.

### 6.5 Where non-production frontend code actually lives
| Location | Nature | Evidence |
|---|---|---|
| `docs/frontend-rebuild/phase-14/**` | **0** source files, **22** markdown files | recursive scan |
| `docs/frontend-rebuild/phase-03-prototype` | fixture-driven prototype | `VITE_PROTOTYPE`, `FIXTURE_MODE` usage |
| `docs/frontend-rebuild/phase-13/app` | fixture-driven prototype | `VITE_PROTOTYPE` = 9, `FIXTURE_MODE` = 4, `fixture` = 62 hits |

No prototype was promoted into `apps/web/src`.

### 6.6 Dependency map of the conflicted tree (what a reconstruction must satisfy)
```
apps/web/src/main.tsx
  └─ App.tsx
      ├─ components/Icons.tsx                     (shared; untouched)
      ├─ components/ui.tsx                        [CONFLICT @242 — HEAD adds IconButton + Drawer]
      ├─ components/CommandPalette.tsx            (HEAD-only file; imported by App.tsx HEAD side)
      ├─ lib/density.ts                           (HEAD-only file; sidebar collapse density)
      ├─ lib/permissions.ts                       [CONFLICT — already resolved, 30/32 keys]
      │    └─ packages/shared/src/permissions.ts  ALL_PERMISSIONS (29 keys, L1–31)
      ├─ components/ResponsiveLayout.tsx          (present on both sides)
      ├─ hooks/useResponsive.ts                   (present on both sides; used by DashboardPage L8, SettingsPage L7)
      ├─ styles.css                               [CONFLICT ×10 — HEAD adds token layer; 26 classes depended on by 13 files]
      └─ pages/*
           ├─ DashboardPage.tsx      [×9]  SectionHead, Attention queue, dash* classes
           ├─ ProjectsPage.tsx       [×6]
           ├─ ProjectDetailsPage.tsx [×6]
           ├─ FinancialsPage.tsx     [×1]  ← contractValue vs boqTotal (correctness)
           ├─ ArchivePage.tsx        [×17] ← includes IconEye import
           ├─ WarehousesPage.tsx     [×1]
           ├─ ItemsPage.tsx          [×1]
           ├─ StockPage.tsx          [×4]
           ├─ MaterialRequestsPage.tsx [×13]
           ├─ AdminUsersTab.tsx      [×1]  ← GRANT/DENY normalisation (correctness)
           └─ components/projects/ProjectIpcsTab.tsx [×2]
```
Route surface actually declared in `App.tsx` (15 declarations): `/` (→ `/dashboard`), `/dashboard`, `/projects`, `/financials`, `/projects/:id`, `/archive`, `/warehouses`, `/items`, `/stock`, `/material-requests`, `/audit`, `/admin/*`, `/settings`, `*` (→ dashboard), `/login`.
Route surface declared by WP3A: 6 modules. WP3A's inventory therefore omits 6 of these routes (see §9).

---

## 7. Migration 22–24 Forensics

### 7.1 What each migration actually contains
| Migration | Statements (summary) | Destructive? |
|---|---|---|
| `22_phase14_core_columns.sql` | `users.department`, `users.title`; `projects.deleted_at`, `projects.deleted_by`; 2 indexes; `audit_logs.project_id` + index. | No — purely additive. |
| `23_phase14_ipc_workflow.sql` | Rebuilds `ipcs_status_check` to add `'under-review'`; creates `ipc_status_events` + index; `ALTER … DROP NOT NULL` / `DROP DEFAULT` on `projects.contract_value`; adds `ipcs.gross_amount`, `ipcs.net_amount`, `ipcs.deductions`. | **Partly** — it *replaces* a live check constraint (L37) and *relaxes* an existing `NOT NULL DEFAULT 0` (a default that itself conflicts with the O2 "never coerce to 0" rule). |
| `24_phase14_recovery_import_tables.sql` | Creates `password_reset_tokens`, `backups`, `restore_jobs`, `import_batches`. | No — new tables only. **Does not touch `import_history`.** |

### 7.2 Application state
| Source of truth | Count | Contains 22/23/24? |
|---|---:|---|
| `apps/api/src/database/migrations/*.sql` | **22** | Yes (files `001`, `05`–`21`, `22`, `23`, `24`; there is no `02`–`04` in this repo) |
| `apps/api/dist/database/migrations/*.sql` | **19** | **No** — stops at `21_direct_amounts.sql` |
| `_migrations` ledger (live DB) | **19** | **No** — stops at `21_direct_amounts.sql` |

Ledger timestamps: 18 rows at `2026-10-03 06:10:14`; `21_direct_amounts.sql` alone at `2026-10-04 02:08:35`.

### 7.3 Why the running service reports "up to date"
`apps/api/src/database/migrate.ts` resolves migrations with `path.join(__dirname, 'migrations')` — i.e. **relative to the executing file**, which in production is `dist/database/migrate.js` → `dist/database/migrations/`. That directory contains only the 19 legacy files, so the migrator correctly finds nothing pending. The `dist` build predates `22`–`24` and was never rebuilt. **No migration failed; no migration was attempted.**

Note also that `dist/server.js` (357 bytes) reads `Number(process.env.PORT ?? 4001)` and the running node child listens on `:: 4001`; the service wrapper is PID 10920 (nssm) with the node child at PID 11216. Process identity was re-verified at final baseline; no restart occurred during this investigation.

### 7.4 Safety assessment (static only — nothing was executed)
- **`22`**: low risk, additive DDL only; safe to apply on a database at ledger `21`.
- **`23`**: medium risk. Replacing `ipcs_status_check` will fail if any existing row carries a status outside the new array — current data is compatible (all 9 `ipcs` rows and the constraint use the 4 legacy values), but the constraint rebuild should be preceded by a `SELECT DISTINCT status` check. The `DROP NOT NULL`/`DROP DEFAULT` on `projects.contract_value` changes an invariant and interacts with the O2 rule (§8, §10).
- **`24`**: low risk; `CREATE TABLE` only, and it does **not** recreate `import_history`, so no collision with the legacy table.
- **Common**: `migrate.ts` wraps each file in `BEGIN`/`COMMIT`, and PostgreSQL DDL is transactional, so a failing file rolls back cleanly — provided the running process is the rebuilt one.

---

## 8. Schema Provenance Matrix

Live database: **PostgreSQL 18.4** (`select version()` → `PostgreSQL 18.4 on x86_64-windows, compiled by msvc-19.44.35227, 64-bit`), database `cos_db`, user `cos`. Access was `SELECT`-only throughout.

| Object | Defined by (file : line) | Present in live DB? | Live definition / value | Phase 14? | Evidence |
|---|---|---|---|---|---|
| `import_history` (table) | `001_initial_schema.sql` **L318** | **Yes** | 1 row | **No — legacy** | `to_regclass('public.import_history')` → `t`; created by 001, not by 24 |
| `import_history` row | `15_import_json_history.sql` (seed) | **Yes** | `37ac9e4a-8001-4fbe-ace8-9ce0070aa9a9` \| `sweep.xlsx` \| `2026-09-03 00:26:51` | **No — legacy seed** | row timestamp predates every Phase 14 file; migration 15 applied `2026-10-03 06:10:14` |
| `ipc_items` (table) | `05_create_boq_and_ipcs.sql` **L26** | **Yes**, 0 rows | empty | **No — legacy** | `to_regclass` → `t`; `count(*) = 0` |
| `projects.contract_value` | `21_direct_amounts.sql` **L2** | **Yes** | `numeric NOT NULL DEFAULT 0` | No (pre-Phase-14), but **23 wants to relax it** | `information_schema.columns` |
| `ipcs.gross_amount` | `21_direct_amounts.sql` **L3** | **Yes** | `numeric NOT NULL DEFAULT 0` | No (pre-Phase-14) | idem |
| `ipcs.net_amount` | `05` L21 / `21` L4 | **Yes** | `numeric NULL DEFAULT 0` | No (pre-Phase-14) | idem |
| `ipcs.deductions` | `06_add_ipc_deductions.sql` **L1** | **Yes** | `numeric NOT NULL DEFAULT 0` | No (pre-Phase-14) | idem |
| `ipcs_status_check` (incl. `'under-review'`) | `23_phase14_ipc_workflow.sql` **L37** | **No** — live constraint has only 4 values | `CHECK (status IN ('draft','submitted','approved','rejected'))` | **Yes — unapplied** | `pg_get_constraintdef` on `ipcs_status_check` |
| `ipc_status_events` (table) | `23_phase14_ipc_workflow.sql` **L16** | **No** | absent | **Yes — unapplied** | `to_regclass` → `f` |
| `users.department`, `users.title` | `22_phase14_core_columns.sql` **L8** | **No** | `users` = id, username, full_name, password_hash, role_name, is_active, created_at, updated_at (8 columns; **no `email`**) | **Yes — unapplied** | `information_schema.columns` |
| `projects.deleted_at`, `projects.deleted_by` | `22` **L14** | **No** | absent | **Yes — unapplied** | idem |
| `audit_logs.project_id` | `22` **L25** | **No** | 0 matching columns | **Yes — unapplied** | `count(*) = 0` in `information_schema.columns` |
| Phase 14 indexes | `22` (2), `23` (1) | **No** | no `%phase14%`, `%deleted%`, `%department%`, `%status_events%` index exists | **Yes — unapplied** | `pg_indexes` query returned **zero rows** |
| `password_reset_tokens` (table) | `24` **L8** | **No** | absent | **Yes — unapplied** | `to_regclass` → `f` |
| `backups` (table) | `24` **L23** | **No** | absent | **Yes — unapplied** | idem |
| `restore_jobs` (table) | `24` **L38** | **No** | absent | **Yes — unapplied** | idem |
| `import_batches` (table) | `24` **L56** | **No** | absent | **Yes — unapplied** | idem |

Supporting facts: `uuid-ossp` and `pg_trgm` are installed. Table count in `public` = 27, none of them Phase 14. Row counts: `projects` 29, `users` 6, `ipcs` 9, `ipc_items` 0, `audit_logs` 2,039, `import_history` 1.

### 8.1 The `import_history` provenance question, closed
The recurring claim is: *"`import_history` exists in the database even though migration 24 is unapplied, therefore something applied Phase 14 out of band."* This is a **false inference** and the premise is wrong on both halves:
1. `24_phase14_recovery_import_tables.sql` never mentions `import_history`. Its four tables are `password_reset_tokens`, `backups`, `restore_jobs`, `import_batches` — and **all four are absent** from the live database.
2. `import_history` is defined at `001_initial_schema.sql` L318 and populated by `15_import_json_history.sql`, both applied at `2026-10-03 06:10:14`, eight days before the Phase 14 migration files existed as untracked files.
3. The single row is dated `2026-09-03`, i.e. **39 days before** the Phase 14 work began.

There is therefore **zero evidence of any out-of-band Phase 14 DDL**. The database sits exactly at ledger `21`.

---

## 9. Previous-Report Reconciliation Matrix

Classification set: `VERIFIED` / `REFUTED` / `PARTIALLY VERIFIED` / `UNVERIFIABLE` / `CONTRADICTORY`.

| # | Prior claim (source) | Classification | Basis |
|---:|---|---|---|
| 1 | `apps/web/src` holds **79 hunks / 14 files** in the working tree and **81 / 15** in `HEAD` (`WP3_RUNTIME` L27) | **VERIFIED** | Independently recounted twice (§4.2). |
| 2 | `apps/web/src/lib/permissions.ts` is modified relative to `HEAD` (`WP3_RUNTIME`) | **VERIFIED** | `git status` shows ` M apps/web/src/lib/permissions.ts`; `git diff HEAD` shows marker removals only. |
| 3 | Vite dev server returns **HTTP 500** for `src/App.tsx` at the first marker (`WP3_RUNTIME`) | **VERIFIED** | Dev server listening on `::1:5173` (PID 17576) returns 500 for `App.tsx`; the first marker is at `App.tsx:57`. |
| 4 | Running backend is a **stale pre-Phase-14 build**; `dist` migration set stops at 21 (`WP3_RUNTIME`) | **VERIFIED**, and now *explained* | `dist/server.js` mtime `10/6/2026 10:31:45`; `dist/database/migrations` = 19 files; `migrate.ts` uses `__dirname` (§7.3). |
| 5 | Deployed UI bundle is pre-Phase-14, built ~22 min before `HEAD` (`WP3_RUNTIME`) | **VERIFIED** (with timezone basis stated) | `11:57:59` local = `08:57:59 UTC` vs merge `09:19:57 UTC` = 22 min (§6.3); zero Phase 14 markers. |
| 6 | Phase 14 migrations 22–24 **exist only as untracked source files** and were never applied (`WP3_RUNTIME`) | **VERIFIED** | All three appear as `??` in porcelain; ledger stops at 21 (§7.2). |
| 7 | Overall verdict **`CONTRADICTORY EVIDENCE — OWNER REVIEW REQUIRED`** (`WP3_RUNTIME` L3) | **PARTIALLY VERIFIED** — the *observations* stand, the *contradiction framing* does not | The report's tension ("Phase 14 claimed but nothing Phase 14 is live") is fully resolved by provenance: the markers were committed by `f91ed2f`, and Phase 14 was never built frontend-side. Nothing is contradictory once §5–§8 are applied. |
| 8 | Integration was verified against **isolated PostgreSQL 17 at `127.0.0.1:5433` (`cos_stage2_populated_dryrun`)** (`WP3_INTEGRATION` L10, `WP3_INDEPENDENT` §1) | **REFUTED** | Live server is **PostgreSQL 18.4 on 5432**, database **`cos_db`**, user `cos` (`select version()`). No `cos_stage2_populated_dryrun` was used by anything observed here. |
| 9 | `PASS WITH LIMITATIONS` on Phase 14 backend integration (`WP3_INDEPENDENT` L3) | **UNVERIFIABLE** | The deployed backend cannot serve Phase 14 endpoints (stale `dist`), and the frontend cannot build. The report's runtime evidence cannot be tied to the artifacts that exist now. |
| 10 | `DATABASE_URL` is **not set** in `apps/api/.env` (`WP3_STARTUP`) | **REFUTED** | A `DATABASE_URL` line exists in `apps/api/.env` and was used (read-only) for every DB query in this report. Its value is deliberately not reproduced. |
| 11 | Frontend blocked: "Vite dev server cannot be started in this session environment; no browser available" (`WP3_STARTUP` L13) | **REFUTED** | A Vite dev server *is* listening on `::1:5173` (PID 17576) and returns 500. The blocker is a compile error, not a missing environment. |
| 12 | Backend "❌ BLOCKED — normal startup abnormal" (`WP3_STARTUP` L14) | **REFUTED** | `CompanyOpsAPI` is `Running` (nssm PID 10920; node child PID 11216 listening on `:: 4001`). |
| 13 | **`PHASE 14 UI CONFIRMED`** in `apps/web` (`WP3A` L14, L16) | **REFUTED** | Zero Phase 14 identifiers in `apps/web/src`; bundle has zero markers; all 15 routes are legacy modules (§6). The 2 `under-review` hits are pre-Phase-14 document labels. |
| 14 | Route inventory: "6 Phase 14 modules, each with route + page + API integration" (`WP3A` §3.1) | **PARTIALLY VERIFIED** | Routes and pages exist — but they are the *legacy* modules. 15 route declarations exist; WP3A's inventory omits 6 of them (`/`, `/items`, `/stock`, `/material-requests`, `/audit`, `/settings`). |
| 15 | "**The WP-3 integration is complete**" … "No prototype fixtures, mocked responses, hardcoded business data" (`WP3_INTEGRATION` L10) | **CONTRADICTORY** | The tree it describes does not compile (79 committed-marker files), the deployed backend is pre-Phase 14, and the live DB lacks every Phase 14 object. A completed integration cannot be in that state. |
| 16 | "**Merge conflict resolved in `permissions.ts` — all permission keys synchronized**" (`WP3_INTEGRATION`) | **PARTIALLY VERIFIED** | The markers are indeed gone, but the file holds **30** keys against the **32** its own header mandates: `ipcs.approve` and `ipcs.resubmit` are missing. Not "all … synchronized". |
| 17 | Environment details: PG17@5433, API 4000, Vite 8080, `VITE_PROTOTYPE` at `vite.config.ts:41`, Docker `5433:5432` (composite of prior reports) | **REFUTED** | Observed: PG **18.4 @ 5432**; API **4001**; Vite **5173**. `VITE_PROTOTYPE` does not appear at `vite.config.ts:41`. |
| 18 | "Repository is clean / no local changes" (implied by several reports' baselines) | **REFUTED** | 46 porcelain entries, 0 staged, 12 untracked, 81 committed markers in `HEAD`. |
| 19 | `import_history` existence implies migration 24 (or equivalent) ran | **REFUTED** | 001 creates it, 15 seeds it; 24 does not reference it; all four of 24's tables are absent (§8.1). |
| 20 | O2 rule: financial values are never derived/coerced to 0 (`phase-14b/04-frontend-integration-map.md`, `WP3_INTEGRATION`) | **CONTRADICTORY** (with the tree) | `FinancialsPage.tsx` L347–348 in `HEAD` *does* derive the contract value from BOQ when absent, and `projects.contract_value` is `NOT NULL DEFAULT 0`. The documented rule and the code disagree. |
| 21 | "Phase 14 frontend source implemented in `apps/web`" (composite) | **REFUTED** | §6.1–§6.4. |

### 9.1 Net effect on the earlier conclusions
- The **factual observations** of `WP3_RUNTIME` are the ones that survived: stale `dist`, stale API, 79/81, untracked migrations, unusable dev server. Its *verdict label* should be superseded, not because it was wrong to be cautious, but because §5 now supplies the missing provenance.
- `WP3A`'s central claim does not survive. The frontend in `apps/web` is the **legacy** application, mid-restyle.
- `WP3_INDEPENDENT`'s environment description does not survive; its backend-integration conclusions cannot be re-anchored to any artifact that exists.
- `WP3_STARTUP`'s blockers do not survive; the environment is functioning and the true blocker is the committed conflict markers.

---

## 10. Recovery Recommendations, Confidence & Owner Decisions

**All items below are recommendations only. Nothing was implemented.**

### 10.1 Per-file reconstruction recommendation
| File | Recommended source | Confidence | Why |
|---|---|---|---|
| `App.tsx` | HEAD side (P1) | HIGH | Only variant that keeps `CommandPalette` + `density.ts` wired; other side is the pre-restyle flat nav; both parents remain available if the owner prefers legacy navigation. |
| `components/ui.tsx` | HEAD side (P1) | HIGH | Other side is empty; HEAD supplies `Drawer`/`IconButton` that HEAD-side `App.tsx` imports. |
| `components/projects/ProjectIpcsTab.tsx` | HEAD side (P1) | HIGH | 100% of other-side lines survive in P1; pure class-vs-inline-style. |
| `pages/AdminUsersTab.tsx` | **HEAD side (P1), mandatory** | HIGH | Other side is a silent functional bug (lowercase vs `'GRANT'`/`'DENY'`). |
| `pages/WarehousesPage.tsx` | HEAD side (P1) | HIGH | Single attribute swap. |
| `pages/ItemsPage.tsx` | HEAD side (P1) | HIGH | Single attribute swap. |
| `pages/ArchivePage.tsx` | HEAD side (P1) + review the 18 non-surviving lines | MEDIUM | `IconEye` is unused on the other side; the desktop/mobile folder-panel branch needs a conscious choice. |
| `pages/DashboardPage.tsx` | HEAD side (P1) | MEDIUM | @229 is additive (Error State preserved); the `Promise.all` → guarded-fetch change is a real behavioural delta to accept deliberately. |
| `pages/MaterialRequestsPage.tsx` | HEAD side (P1) | MEDIUM | All 6 P1 classes verified in `styles.css`; 20 non-surviving lines are inline-style attributes. |
| `pages/ProjectDetailsPage.tsx` | HEAD side (P1), hunk-by-hunk | MEDIUM | 0/8 survival — the least mechanical file in the set; requires individual review. |
| `pages/ProjectsPage.tsx` | HEAD side (P1) | MEDIUM | 1/6 survival, all cosmetic. |
| `pages/StockPage.tsx` | HEAD side (P1) | MEDIUM | 1/6 survival, all cosmetic. |
| `styles.css` | HEAD side (P1) wholesale | HIGH (consistency) / owner-visible (design) | The P1 markup depends on the token layer and the 1,898-line block; mixing sides breaks `z-index` semantics. |
| `pages/FinancialsPage.tsx` | **NEITHER side as-is** | **OWNER DECISION REQUIRED** | See OD-1. |
| `lib/permissions.ts` | HEAD side, already applied — **add the 2 missing keys** | MEDIUM | See OD-3. |

### 10.2 Decision list for the owner
| ID | Decision | Recommendation | Why it cannot be made here |
|---|---|---|---|
| **OD-1** | `FinancialsPage` contract value: keep P1's `contractValue → boqTotal` fallback, or implement the O2 `UnavailableField` envelope, or keep the legacy `boqTotal` (and repair its declaration)? | **Third option**: an O2-compliant value that renders "غير متاح" instead of substituting BOQ. It satisfies the documented rule, compiles, and does not require the deleted identifier. | It is a **business/finance-presentation rule** (what the "قيمة العقد" KPI means when no contract value is entered). Both repo sides violate something: P1 violates O2, P2 does not compile. |
| **OD-2** | Is the "Command Deck" restyle (P1) the intended future UI, or should legacy UI (P2) be restored? | Restyle, given 13/15 files and the entire CSS layer depend on it; the alternative means discarding a 1,898-line design system. | Product/aesthetic direction; also determines whether ~4,000 lines of CSS ship. |
| **OD-3** | Should `apps/web/src/lib/permissions.ts` gain `ipcs.approve` and `ipcs.resubmit` (30 → 32 keys)? | **Yes** — the file's own header mandates the 32-key sync, and the backend vocabulary already lists both. | It is a functional change to authorization-gated UI, outside a read-only audit. |
| **OD-4** | Authorise applying migrations 22–24? | Not yet. Requires: (a) rebuilt `dist` so the migrator can see them, (b) a `SELECT DISTINCT status FROM ipcs` pre-check for 23, (c) a decision on `contract_value`'s `NOT NULL DEFAULT 0` (OD-1), (d) a verified backup. | Applying DDL is explicitly prohibited here, and 23 changes a live constraint. |
| **OD-5** | Phase 14 **frontend** scope: treat WP3's "integration complete" as void and re-plan? | **Yes, treat as void.** No Phase 14 frontend source exists; only docs (22 `.md`) and fixture prototypes. | Scope/roadmap decision. |
| **OD-6** | `under-review` reachability: the UI label exists but the DB constraint forbids the value until 23 is applied. | Resolve with OD-4; until then the label is unreachable and should not be presented as working. | Coupled to migration authorisation. |

### 10.3 Confidence in the overall recovery path
**High, for the conflicted tree** — every hunk is attributable to two immutable commits, 79 of them mechanically reconstructible, 2 requiring a flagged owner decision, 1 already resolved with a known 2-key gap.
**Not applicable, for Phase 14 UI** — there is nothing to recover because nothing was built. Any plan that assumes Phase 14 frontend source is recoverable must be discarded.

---

## 11. Skills: Discovery, Instructions Read, Application, Contribution

This section is deliberately literal, including the absence of use.

### 11.1 Discovered
A skill catalogue is exposed to this session. Entries that were *potentially* applicable to a read-only Git/PostgreSQL/forensics investigation were **discovered** (name recognition only), including but not limited to:

| Skill ID | Why it looked applicable |
|---|---|
| `git-advanced-workflows` | merge topology, ancestry, conflict inspection |
| `postgresql` | schema and constraint inspection |
| `postgresql-cli` | `psql` invocation patterns |
| `debugging-and-error-recovery` | root-cause discipline |
| `documentation-templates` | report structure |
| `observability-and-instrumentation` | runtime/process evidence |

### 11.2 Instructions read
**None.** No skill body was loaded in this investigation. The `skill` tool was not invoked at any point, and no `SKILL.md` content was read into context.

### 11.3 Actually applied
**None.** No skill contributed an instruction, template, checklist, or procedure to this work.

### 11.4 Investigation contribution
**Zero.** All evidence in this report was gathered ad hoc via read-only shell tooling:
`git rev-parse`, `git status --porcelain`, `git log`, `git show <rev>:<path>`, `git ls-tree`, `git merge-base --is-ancestor`, `git diff HEAD`, `Select-String`/`Get-Content` for marker bracketing and token counts, and `psql -c "SELECT …"` for schema introspection.

### 11.5 Note on honesty of this section
No skill is claimed to have been "used" because none was. Reporting a skill as applied when it was merely present would misrepresent the evidence chain; the findings above stand on direct repository and database observation, not on skill guidance.

---

## 12. Confirmation: Prohibited Actions Not Performed

Every prohibition in the work-package rules was observed. Confirmation, item by item:

| Prohibition | Status | How this is substantiated |
|---|---|---|
| No file edits, renames, moves, or deletions | **NOT PERFORMED** | The only write in this session is the creation of this single report file. No other path was opened for writing. |
| No resolving of conflict markers | **NOT PERFORMED** | All 79 working-tree hunks remain intact at final baseline (open/sep/close = 79/79/79), byte-identical in count to initial baseline. |
| No mutating Git commands (stage/commit/stash/reset/restore/clean/merge/cherry-pick/rebase/push/pull) | **NOT PERFORMED** | Only read-only Git subcommands were issued: `rev-parse`, `status`, `log`, `show`, `ls-tree`, `merge-base`, `diff`. Staged entries = 0 before and after; porcelain = 46 before and after. |
| No branch switching | **NOT PERFORMED** | Branch remained `main` with upstream `origin/main` at both baselines. |
| No starting, stopping, or restarting services | **NOT PERFORMED** | `CompanyOpsAPI` remained `Running`; nssm PID 10920 and node child PID 11216 were only *read*. |
| No `npm install` / build / dev / preview | **NOT PERFORMED** | No package manager or bundler was executed. Compile-error findings are static readings, explicitly labelled as not compiler-confirmed (§2.3). |
| No migration execution | **NOT PERFORMED** | Migrations 22–24 remain unapplied; `_migrations` has 19 rows at both ends of the investigation; `dist` was not rebuilt. |
| No seeds or DB writes | **NOT PERFORMED** | Every database statement was a `SELECT` (schema introspection via `information_schema`/`pg_catalog`, and `count(*)`). No `INSERT`/`UPDATE`/`DELETE`/`CREATE`/`ALTER`/`DROP`. |
| No POST/PUT/PATCH/DELETE HTTP calls | **NOT PERFORMED** | No API request of any kind was issued. |
| No login or use of credentials | **NOT PERFORMED** | No authentication attempt occurred. `DATABASE_URL` was read from `apps/api/.env` for a local `psql` session and never echoed; no password, token, secret, or connection string appears in this report. |
| Do not touch the shared browser tab | **NOT PERFORMED** | No browser tool was used. |
| Do not trust prior reports without independent checks | **PERFORMED AS REQUIRED** | Every prior claim in §9 was re-derived from the repository or database; six were refuted and four downgraded. |
| Preserve dirty / ignored / untracked state | **PRESERVED** | 34 modified tracked files untouched (git working-tree mtimes and contents unchanged), 12 untracked paths untouched, 81-commit marker set untouched. |
| Exactly one new file; stop on collision | **SATISFIED** | Collision check at initial baseline and again at final baseline: destination did not exist. Exactly one file created — this one. |
| Do not describe the repository as "clean" merely because this session added nothing | **OBSERVED** | §3.3 states explicitly that the repository is not clean, and distinguishes "no changes attributable to this investigation" from "clean". |
| Stop after the report; no WP3C | **OBSERVED** | No further action is taken. This report is the terminal artifact of WP3B. |

---

## Final Verdict

**`RECOVERY PATH IDENTIFIED — OWNER APPROVAL REQUIRED`**

Basis in one paragraph: all 81 conflict hunks were committed unresolved by a single known merge commit (`f91ed2f`) of two known, immutable parents (`13cce46`, `22bb862`) with a known merge base (`c8d72a6`); 79 of them are mechanical styling collisions whose HEAD side is internally consistent and whose CSS dependencies are verified present; exactly one hunk (`FinancialsPage` @367) encodes a business rule requiring owner judgement, one file (`permissions.ts`) is already resolved with a known 2-key gap, and one hunk (`AdminUsersTab` @323) has a demonstrably broken alternative side. Separately, and independently of the conflict work, **no Phase 14 frontend source exists anywhere** — the repository contains design documentation and fixture prototypes only, and the deployed build is pre-Phase 14. Recovery is therefore authorised-able for the *conflicted legacy tree*, and must not be represented as recovery of a Phase 14 UI.

**STOP.** No conflict was resolved, no source was rebuilt, no service was restarted, no migration was applied, and no subsequent work package was begun. Awaiting explicit owner authorisation for any of decisions OD-1 through OD-6.

---

### Appendix A — Reproduction commands (all read-only)
```powershell
# baselines
git rev-parse HEAD; git rev-parse --abbrev-ref HEAD
git status --porcelain=v1
# marker inventory (HEAD vs worktree)
foreach($f in (git ls-tree -r --name-only HEAD -- apps/web/src)){ ... '^<<<<<<< HEAD' ... }
Get-ChildItem apps\web\src -Recurse -Include *.ts,*.tsx,*.css | Select-String '^<<<<<<< '
# provenance
git log --oneline -5; git show --stat f91ed2f
git merge-base --is-ancestor 13cce46ad5bb095899d282e9556bf837c7d720e5 HEAD
git merge-base --is-ancestor 22bb86216dfc3ef7502b7c36906e4665ecfd9f5e HEAD
git show 13cce46:apps/web/src/pages/FinancialsPage.tsx
git ls-tree -r --name-only 22bb8621 -- apps/web/src
# migrations
Get-ChildItem apps\api\src\database\migrations -Filter *.sql
Get-ChildItem apps\api\dist\database\migrations -Filter *.sql
# database (SELECT only)
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -d $DATABASE_URL -At -c "select version();"
& "…psql.exe" -d $DATABASE_URL -At -F ' | ' -c "select name, applied_at from _migrations order by name;"
& "…psql.exe" -d $DATABASE_URL -At -c "select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.ipcs'::regclass and contype='c';"
```

### Appendix B — Provenance summary card
| Element | Value |
|---|---|
| Merge commit | `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf` — "Merge branch 'main' of https://github.com/mamin144/company-ops-system" — `m.amin`, 2026-10-11 09:19:57 +0000 |
| First parent (HEAD side) | `13cce46ad5bb095899d282e9556bf837c7d720e5` — "محاولة تغير شكله بس دي نسخه مستقره امنه" — 2026-10-11 (single squashed commit; Command Deck restyle) |
| Second parent (other side) | `22bb86216dfc3ef7502b7c36906e4665ecfd9f5e` — "Add VITE_API_URL to web build step" — Mahmoud Amin, 2026-09-26 13:45:08 +0300 (tip of `a814dfa` → `0924d0c` → `4936f53` → `22bb862`) |
| Merge base | `c8d72a60b7c7e9ef7258a640d69a8697d0b6d659` — 2026-09-13 |
| Markers in parents | P1 = 0, P2 = 0, base = 0 |
| Markers in `HEAD` | 81 hunks / 15 files |
| Markers in working tree | 79 hunks / 14 files (difference = `lib/permissions.ts`, resolved locally) |
| Live DB | PostgreSQL 18.4, `cos_db`, ledger at `21_direct_amounts.sql` |
