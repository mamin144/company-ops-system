# UX-REVIEW.md — Phase 3.11 independent UX review & design approval

Date: 2026-10-14. Review-only phase: no source, test, data, settings, dependency,
production, backend, git, or conflict-marker changes were made. The sole artifact of this
task is this file. Review target: `http://localhost:5199` serving build `index-D5e7nuLD.js`.

## 1. Executive summary

Three judge agents collected ~100 screenshots plus DOM/text dumps. **Judge A delivered a
genuine critical review (13 findings F1–F13, keep-list, explicit non-findings); Judge B
delivered a second genuine critical review (15 findings B-01–B-15, verified non-issues,
labeled hypotheses).** Judge C delivered evidence only. The synthesizer personally
inspected 11 screenshots and all key dumps, verified every P1 and most P2 claims below
against primary evidence (screenshot, dump, or read-only code read with file:line), and
resolved two open hypotheses that way.

**No P0 was found.** Nine P1s: misleading viewer empty state (F-01), dead-end project
tabs (F-02), one-click approve with no confirm vs confirming reject (B-01), self-harm
actions offered with generic copy (B-02), uninspectable role permission sets (B-03),
self-contradictory transfer direction text (B-06), phone bottom nav dropping four
sections (C-01), export strip vanishing on zero-match filters (C-02), audit export
ignoring grid sort (C-03). Plus a literal `{f}` token (P2), Enter-to-search gap,
banner-less preview modal, unconfirmed status change, row-action density, duplicated
section naming, and English-mode gaps. The rest is P3 polish plus explicitly recorded
coverage gaps (phone walkthroughs, contrast, screen reader, EN breadth, human
independence).

- **UX:** Approved with Conditions (resolve the ten P1s; owner decision on density).
- **Direction D:** Approved.
- **Prototype:** Ready for Owner Review.
- **Production UI:** Blocked (unchanged).

## 2. Methodology and independence limits (read carefully)

- Three judge subagents in separate sessions (`ses_ec5e…31f`, `…5k5J`, `…dCDT`) drove the
  live UI via Playwright (Chromium 1366×900 + 390×844), saving evidence to
  `%TEMP%\opencode\ux-review\{judge-a,judge-b,judge-c}\`. All respected the read-only rule
  (Judge A logged its own script bug rather than touching the app; Judge B cancelled
  destructive confirms and labeled untested paths as hypotheses instead of defects).
- **Judges A, B, and C each delivered a genuine critical review** (A: 13 findings;
  B: 15 findings; C: 12 findings F1–F12 with severities, keep-list, and an explicit
  unverified list). Adopted findings are marked **[A]** / **[B]** / **[C]** with the
  judge's severity; where the synthesizer verified, downgraded, or excluded, it is
  stated openly.
- **Evidence-integrity note on Judge C:** several artifacts its report cites were not
  present at review time — no EN screenshots, no `en-tour.json` / `responsive.json` /
  `interactions.json` / `verify*.json`, and no 390px shots from Judge C (its folder
  holds 15 AR screenshots, `ar-tour.json`, recon files, and 2 scripts). C's
  screenshot-cited claims are therefore treated as judge-observed unless independently
  verified below; every C finding adopted at P1/P2 was additionally verified in code
  or in another judge's screenshot.
- **Residual independence limit (disclosed):** all judges share the builder's model
  lineage — the best review available in this environment, not a human second-judge
  audit. design-ux Rule 0 therefore remains formally unsatisfied (see §9).
- **Screenshots prove presentation, never logic.** Every causal or behavioral claim below
  was checked against a screenshot/dump the synthesizer inspected or a read-only code
  read cited with file:line. Judge B's "whether delete is confirm-gated" hypothesis and
  Judge A's delete-confirm question were resolved by code read (status: no confirm,
  F-08; delete: not clicked by anyone — remains an explicit non-finding).

## 3. Journeys and screens reviewed

| Journey / screen | Evidence |
|---|---|
| Login + 4 role tiles (incl. `aria-pressed`) | judge-a `01-login-wide.png`, `zz-tile-selected.png`; judge-b `00/01-login*.png`; judge-c `ar-login-admin-selected.png`, `recon-login*.json` |
| Dashboard desk (AR) | judge-a `02-dashboard-wide.png` (viewed); judge-b `02-dashboard-wide.png`, `60-n-dashboard.png`, tour-log; judge-c `ar-home-1366.png` |
| Projects list + workspace + 5 tabs + invalid id + viewer scope | judge-a `rt-_projects.png`, `03-project-details.png`, `04-project-invalid.png`, `05-ptab-*.png` (`05-ptab-documents.png` viewed), `17-viewer-_projects.txt` (verified); judge-b `03-projects-wide.png`, `30-project-p1-wide.png`, `59-nav-*.png` |
| Archive full flow (search/filter/sort/pager/preview/status/replace/links/import) | judge-a `06–11-archive-*.png` + modal DOM dump (viewed `rt-_archive.png`, `07-archive-preview.png`, `narrow-_archive.png`) |
| Command palette (button + Ctrl+K) | judge-a `12-palette`, `15-palette-open.png`, `18-ctrlk.png` |
| Inventory hub + warehouses/items/stock/requests | judge-a `16-rt-_inventory*.png`; judge-b `21–24-*.png` (`23-inv-stock-wide.png`, `37-stock-new-movement-modal.png` viewed), `61/62-n-*.png`; judge-c `ar-inventory*-1366.png` |
| Admin users + roles + details modal + reset/delete dialogs | judge-b `25/31-admin-wide.png` (viewed), `32-admin-user-details-modal.png` (viewed), `35/36-*.png`, `51-admin-roles.png`, tour3 modal dump; judge-c `ar-admin-1366.png` |
| Requests lifecycle incl. approve/reject/issue modals | judge-b `22-inv-requests-wide.png`, `40-mr-issue-modal.png`, `41-mr-new-modal.png`, `80-approve-after.png`, `92-reject-after.png`, tour5/6/7 logs |
| Financials + project financials, AR + EN | judge-a `rt-_financials.png`, `05-ptab-financials.png`; judge-b `04/57/58-EN-financials.png` (EN viewed), tour6 IPC dump; judge-c `ar-financials-1366.png` |
| Reports + audit + settings + search + notifications | judge-a `16/19-rt-{reports,search,notifications}.png`; judge-b `13/26/27/14/28/29-*.png` + `xt-*.json`; judge-c `ar-{reports,audit,settings,search,notifications}-1366.png` |
| Keyboard Escape probe; console capture | judge-b `tour4*.txt` (open→closed), `50-escape-after.png`, `tour4-console.txt` (zero errors) |

**Wrong-path artifacts excluded from quality judgments:** judge-A top-level `/dashboard`,
`/warehouses`, `/items`, `/stock`, `/material-requests` and `13-en-toggle.png` (an EN
screenshot of that same 404, not of EN archive); judge-B's early equivalent guesses —
which Judge B itself retracted in writing ("wrong guesses on my part … Not a defect").
Correct-path equivalents above were used instead. Judge-A's palette probe error is a bug
in the judge's throwaway script, not product behavior — excluded and noted so it is
never cited. Partial exception, stated openly: Judge A's F1 reframes guessable-URL 404s
as an IA suggestion; per the phase rule it is recorded below as P3, not as a defect.

## 4. Findings (screen/path · steps · observed · impact · severity · recommendation · scope)

### P1 — Major (10)

**F-01 [A] — Viewer projects page implies the company has no projects.**
- Path `/projects` as viewer. Steps: log in as مشاهد → open المشاريع.
- Observed (`17-viewer-_projects.txt`, verified): `0 المشاريع … لا توجد بيانات بعد` with
  zero permission explanation — while the same role on `/admin` gets the exemplary
  `لا صلاحية لديك … بدّل الدور من شاشة الدخول`, and invalid project IDs get the
  existence-hiding `غير موجود أو خارج نطاق صلاحياتك`. Judge A rates this borderline P0;
  P1 is retained only because the permission model is demo-scope.
- Impact: a viewer may wrongly conclude the company has no projects — dangerously misleading.
- Recommendation: mirror the admin pattern — «لا توجد مشاريع ضمن نطاق وصول دورك» —
  prototype-only wording fix. **Required pre-approval.**

**F-02 [A, screenshot-verified] — Project Documents/Warehouses/Stock tabs are signposts
without doors.**
- Paths `/projects/p1/documents|warehouses|stock`. Observed (`05-ptab-documents.png`,
  viewed): one line — «تُدار المستندات من الأرشيف الموحّد.» — with zero links and no
  filtered view (Judge A verified `DOC LINKS: []`; same prose-only pattern on the other
  two tabs; material requests have no project tab at all).
- Impact: the core journey project → its documents/stock forces leaving context and
  manually re-finding the project (recognition-over-recall failure).
- Recommendation: deep-link each tab to its area pre-filtered by project (e.g. Archive
  `?project=p1`) or embed the filtered list — prototype-only. **Required pre-approval.**

**F-03 — Literal `{f}` token in two Archive list rows (Judge A F9, independently corroborated).**
- Path `/archive` as admin, rows DOC-220 and DOC-150. Observed in `rt-_archive.png`
  (viewed) and the modal DOM dump: `أصل المجلد (قديم، للعرض فقط): {f}`.
- Cause (read-only): `i18n.tsx:52` expects `{f}` but `Archive.tsx:188` passes
  `{ name: d.folderName }`, so the filler leaves `{f}` literal. (The viewer-modal
  caller `:378` passes `{f}` and renders correctly.)
- Impact: raw template token on a core list; folder-origin info lost; erodes trust in
  displayed data. Recommendation: align the placeholder — prototype-only. **Required
  pre-approval.** (Severity P2 retained, as Judge A scored — no task is blocked. Judge C
  confirms the EN mirror is equally broken: `Legacy folder origin (read-only): {f}`.)

**B-01 [B, code-verified] — One-click approve with no confirm; reject DOES confirm (asymmetry).**
- Path `/inventory/requests`, مقدمة rows. Observed by Judge B (`80-approve-after.png`:
  MR-013 flipped مقدمة → معتمدة with only a toast `اعتُمد الطلب (تجريبي)`;
  `92-reject-after.png`: reject opens a confirm modal with optional reason).
- Verified read-only: `Requests.tsx:113,141` call `run(m, 'approve')` directly on click
  (toast afterwards, `:69`); the two buttons sit side-by-side (primary blue vs danger red).
- Impact: a slip irreversibly advances an approval workflow with zero recovery path; two
  symmetric actions teach two different contracts.
- Recommendation: put approve behind reject's confirm pattern (summary + تأكيد/تراجع) or
  an Undo window; separate the pair — prototype-only. **Required pre-approval.**

**B-02 [B, UI-text-verified] — Self-disable/delete offered with a generic prompt.**
- Path `/admin`, self row. Observed texts (verified in `Admin.tsx:257,270`):
  `تعطيل الحساب: <name>؟` / `حذف الحساب: <name>؟ …` — identical in form to any other
  account, no "this is your own account / you will be locked out" warning (Judge B
  read both dialogs, cancelled both; screenshots `82-self-disable.png`, `91-self-delete.png`).
- Impact: an admin can trigger self-lockout with routine effort; the copy never states
  the consequence. (Whether the mock path refuses is a separate, already-guarded
  question — the UI communicates nothing either way.)
- Recommendation: disable/hide these actions on the current-account row, or escalate to
  an explicit lockout-stating confirmation; same guard for the last مدير النظام account —
  prototype-only once the product rule is confirmed (external, small). **Required pre-approval.**

**B-03 [B, code-verified] — Role cards are inert; role permission sets uninspectable.**
- Path `/admin` → `الأدوار` tab. Verified read-only (`Admin.tsx:161-168`): five cards
  render as plain `<div className="card">` — no onClick, no link, no modal; Judge B
  clicked and confirmed nothing happens. No role↔permission matrix exists anywhere; role
  contents surface only indirectly per-user (`من الدور` annotations).
- Impact: "what CAN the مخازن role do?" — the central admin mental-model question — is
  unanswerable except by reverse-engineering per user.
- Recommendation: role cards open a read-only grouped permission matrix + a one-line
  legend for inherited/override/effective states — prototype-only (data already exists).
  **Required pre-approval.**

**B-06 [B, screenshot-verified] — Transfer direction text is self-contradictory.**
- Path `/inventory/stock`, row TRF-304. Observed in `23-inv-stock-wide.png` (viewed):
  source column `المخزن المركزي (تجريبي)`, qty `−2`, but the direction sub-text reads
  `من → إلى المخزن المركزي (تجريبي) ← مخزن موقع البرج (تجريبي)` — arrows point both
  ways in one string; only the source leg shows, no destination (+2) leg, so the net
  effect is unverifiable from the list.
- Impact: which warehouse lost/gained stock — the core transfer question — requires
  cross-checking sign against a garbled sentence; misreading causes wrong replenishment.
- Recommendation: canonical `من {A} إلى {B}` with one arrow, always-populated
  المصدر/الوجهة columns, both legs (or one −/+ row) — prototype-only rendering fix,
  pending confirmation of the real transfer data model (external check). **Required pre-approval.**

**C-01 [C, code- and render-verified] — Phone bottom nav silently drops Admin / Audit /
Reports / Settings.**
- Any route at 390px. Verified read-only (`Shell.tsx:92-93`): the bottom bar renders
  `items.slice(0, 5)` — Home, Projects, Archive, Inventory, Financials — with no "More"
  overflow and no hamburger; confirmed rendered in `60-n-dashboard.png` (viewed: exactly
  those five tabs). The only fallback is the ⌘K palette, undiscoverable on a phone.
- Impact: on a phone, audit, reports/export, admin, and settings are effectively
  unreachable for users who don't know the palette exists.
- Recommendation: a fifth-slot "More" sheet or a scrollable full-section bar — **needs an
  external decision on nav pattern**, then prototype-only edit. **Required pre-approval.**

**C-02 [C, structurally verified] — Contextual export strip vanishes on zero-match filters.**
- Path `/inventory/items` (same pattern wherever `ContextualExport` is used). Verified
  read-only (`Items.tsx:69` vs `:93`): the whole panel including the export strip and
  pager is replaced by `EmptyState` when `sorted.length === 0`, while `reportApi.count()`
  itself would return `0` — the UI chooses to unmount the scope answer.
- Impact: in the one state where "which rows are in scope?" matters most, the answer
  disappears; the user cannot tell whether an export would be empty or full-scope.
- Recommendation: always render the export strip with "covers 0 rows" wording when a
  filter is active — prototype-only. **Required pre-approval.**

**C-03 [C, code-verified] — Audit export ignores the grid's sort order.**
- Path `/audit`: sort any column, then export. Verified read-only (`Audit.tsx:77-80`):
  the export passes only the filter object to `reportApi.export`; `sortBy`/`dir` never
  enter the export path — while the code comment claims the file holds "exactly what is
  on screen."
- Impact: the user sorts to define the order, exports, and silently gets default order —
  misleading for an audit artifact.
- Recommendation: pass `sortBy`/`sortDir` through the export path, or label the
  button/file "default order" explicitly — prototype-only. **Required pre-approval.**

### P2 — Moderate (14)

**F-04 [screenshot-verified] — Seven actions per Archive row.**
`rt-_archive.png`: معاينة/تنزيل/الحالة/استبدال/روابط/تعديل/حذف crowd the trailing cell
and wrap to multi-line strips. Scanability + targeting cost; reachable-but-long in card
layout (`narrow-_archive.png`). Recommendation: overflow menu or progressive disclosure —
**owner decision on pattern**.
**F-05 [screenshot-verified] — Five actions per Admin row + cryptic access cell.**
`25-admin-wide.png`: التفاصيل/تعديل المستخدم/تعطيل الحساب/إعادة تعيين كلمة المرور/حذف
الحساب (red) per row; delete sits adjacent to routine actions (a confirm dialog exists
per the test suite, bounding misclick cost — hence P2, not P1). The `1 مشروع · تعديل`
cell never explains its second word; only the (well-built) details modal does.
Recommendation: relabel the cell, add spacing around delete — prototype-only, owner-confirmed copy.
**F-06 [A, code-verified] — Archive search ignores Enter; typing alone never filters.**
Judge A typed `مستخلص` (count stayed 8), pressed Enter (unchanged), clicked بحث
(filtered to 1). Read-only check confirms it: no `onKeyDown`/`onSubmit`/`<form>` in
`Archive.tsx` — only the button submits. Keyboard dead key. Recommendation: submit on
Enter via the same handler — prototype-only.
**F-07 [A, screenshot-verified] — Preview modal carries no demo banner.**
`07-archive-preview.png` (viewed): metadata + empty-content note + linked docs, but a
screenshot of the modal alone is unattributable to any demo. Recommendation: explicit
preview/demo ribbon inside the modal — prototype-only.
**F-08 [A, code-verified] — Status change commits any→any with no confirm step.**
`Archive.tsx:244-255`: save calls `setDocStatus` + toast directly, no `ConfirmDialog`
(Judge A's open question, hereby resolved as fact). The open matrix itself is documented
intended behavior; the missing friction is the finding. Recommendation: confirm step +
transition warning in prototype; the matrix needs a product decision.
**F-09 [A] — «المخزون» names three different things** (shell nav → `/inventory` hub vs
project tab vs hub child `المخزون / الحركات والأرصدة`). "Go to المخزون" is ambiguous.
Recommendation: rename hub or child — **needs external terminology decision**, trivial
to apply. (Judge B's B-13 corroborates the dashboard side: `RET-403 RETURN · —` raw
codes with empty context slots where the stock page shows Arabic types + references —
same inconsistency family; fix by reusing the stock cell renderer, prototype-only.)
**B-04 [screenshot-verified] — Override controls speak developer English.**
`32-admin-user-details-modal.png` (viewed): `INHERIT` dropdowns, raw `archive.view`-style
keys, English-only segmented control, with Arabic status words around them. An
Arabic-speaking admin must guess INHERIT-vs-GRANT semantics. Recommendation: Arabic
labels (يرث/منح/منع…) + one-line explainer, keys as secondary muted text —
prototype-only after a terminology decision (external, small).
**B-05/B-08 [dictionary-verified] — Raw `approve:false` flag in user-facing copy.**
`i18n.tsx:75` (`رُفض الطلب عبر approve:false (تجريبي)`), `:179` (MR modal footer),
plus EN mirrors (`:343`, `:445`). Internal contract flag shown to clerks.
Recommendation: plain copy, flag stays in code — prototype-only.
**B-07 [screenshot-verified] — Movement-type options leak permission keys with broken bidi.**
`37-stock-new-movement-modal.png` (viewed): `إدخال · warehouse.stock_in` etc., visibly
misordered. Recommendation: label-only options + one-line stock-effect descriptions —
prototype-only.
**B-10 [screenshot-verified] — EN mode leaves IPC status chips in Arabic.**
`58-EN-financials.png` (viewed): everything translates except certificate chips
(`#1 · معتمدة · 2,025,000`), so an EN reader cannot tell draft/submitted (excluded)
from approved (included). This corrects §5's earlier "no Arabic chrome intrusion" line,
which is hereby retracted for these chips. Recommendation: translate the four IPC
statuses in EN — prototype-only dictionary gap.
**C-04 [C, code-verified] — Same gap, wider: `STATUS_AR` bypasses `t()` on Stock,
Requests (and Projects/Archive badges).**
`Stock.tsx:64,89,213,272`, `Requests.tsx:83,106,129` render `STATUS_AR[x]` directly, so
movement-type badges, type/status filters, and status badges stay Arabic in EN mode —
the single most important cell in each row for an English reader. (Audit action/entity
columns are mock *data* and correctly out of scope.) Recommendation: convert these enum
labels to i18n keys, keep raw codes in CSV/JSON exports — prototype-only.
**C-05 [C] — Read-only dialogs have no visible dismiss control.**
`/reports` Preview and `/audit` Details (Judge C verified Escape closes and focus
returns correctly in both, corroborating the suites): bodies contain no button, so
mouse/touch users get no visible affordance — dismissal is Escape-or-backdrop folklore,
painful on touch. Recommendation: a small Close/× in `Modal` chrome (one place fixes
all dialogs) — prototype-only.
**C-06 [C, code-verified] — No language switch on the login screen.**
`Login.tsx` imports `useLang` and uses `t`, but renders no toggle (verified: no
`setLang`/toggle control; `data-lang-toggle` exists only in the post-login `Shell`).
An English-only user must log in through Arabic to reach English. Recommendation:
render the same persisted toggle on login — prototype-only.
**C-07 [C, corroborated] — Breadcrumb exposes raw route internals, including `p1`.**
Beyond Latin tokens, the crumb shows the internal id `p1` where the product code
everywhere else is `PRJ-004`, forcing id memorization. Upgrades the former F-10 (P3)
to P2: three развиваются reviews flag it, and the internal-id exposure is a
recognition failure, not mere polish — recorded convergence, prior disagreement withdrawn.
Recommendation: resolve project segment to `PRJ-004 — name`, localize static segments —
prototype-only.

### P3 — Minor (15)

**F-11 — Breadcrumb Latin fragments on non-project pages** (`/ / financials`,
`users / admin / /`). Chrome polish; prototype-only. (The project-id exposure moved to
C-07 above.)
**F-12 — Email wraps mid-domain in Admin rows** (viewed). Recommend `nowrap` on email
cells — prototype-only.
**F-12 — EN keeps Arabic mock statuses/data by design** — accepted boundary (F-13 in draft),
recorded for explicit owner acceptance that demo data stays Arabic in EN.
**F-13 [A] — Palette shows raw Latin slugs; `⌘K · بحث` cryptic** (judge-observed, not
personally viewed). Localize entries — prototype-only.
**F-14 [A] — Role tiles don't describe access** (judge-observed). One-line scope hint per
tile — needs external role-definition decision.
**F-15 [A, corroborated] — `←` as "go" in RTL** (visible in the dashboard shot I viewed).
Use `→` or a labeled button — prototype-only.
**F-16 — Dashboard hero sparseness** (viewed: full-width card, one greeting line; thin
queues below). Weak landing information scent. Deferred polish, taste decision.
**B-09 [B] — `بدء الصرف` labels first and repeat issues identically** (judge-observed with
modal evidence). Recommend `استكمال الصرف (المتبقي N)` on repeats — prototype-only.
**B-11 [B, seed-verified] — Latin fragments in financial seed strings** (`data.ts:52`
`خرسانة جاهزة لل foundations`, `:65` `دفعةoundation أولى`). Same corruption family as
the fixed CJK token; cosmetic but sited in the money tables where trust matters most.
Prototype-only seed fix.
**B-12 [B] — `قيمة مباشرة` on draft IPC unexplained** (judge-observed label; semantics
an explicit labeled hypothesis). Needs business-rule confirmation before any copy fix.
**B-14 [B, screenshot-verified] — Numeral mixing** (Western `27,839,000` vs Arabic-Indic
`١٤/١٠/٢٠٢٦` date value in the movement modal I viewed). Needs a locale-convention
decision, then enforcement — prototype-only.
**B-15 [B] — Density toggle (`⇅`, empty title, aria-only name)** (judge-observed via
probe; behavior unknown — hypothesis). Add title + active state — prototype-only.
**C-09 [C, corroborated] — Stat numbers jammed against labels** (`المشاريع4`,
`الأرشيف8`, `المخزون6 / 6` — visible in the 1366 dashboard shot I viewed; Judge C adds
that at 320px the note wraps to an orphan `حقيقي.`). Cosmetic but on the landing screen.
Recommendation: spacing in the count strings — prototype-only.
**C-10 [C, dictionary-verified] — Awkward EN greeting + untranslated shell chrome.**
`i18n.tsx:406`: `Good morning — what needs you` (the AR source is itself awkward — needs
copy rewrite, not word-swap, in both languages); shell chrome `Direction D · prototype`,
`Modules`, logo `CO`, crumb fragments, `dd/mm/yyyy` inputs, and the `(تجريبية)` user-chip
suffix stay put in EN (all visible in screenshots I viewed). P3: mock-data Arabic is
legitimately untranslated — only chrome/enum instances count (see C-04). Recommendation:
copy pass (external, small) + chrome keys (prototype-only).
**C-11 [C, code-verified] — Edit buttons that only toast.**
`Items.tsx:87`: row تعديل fires `toast('info', t('mockNote'))` with no dialog — the
affordance promises editing and delivers a shrug. Single verified instance; same pattern
elsewhere is hypothesis, not filed. Recommendation: open the read-only detail view or
relabel — needs an external decision on what edit means in-prototype, then prototype-only.
**C-12 [C] — Misc, split by verification.** *Verified:* duplicate/wrong accessible names —
rail nav, brand button, and bottom bar all carry `aria-label={t('home')}`
(`Shell.tsx:57,59,92`) — prototype-only fix. *Judge-observed:* workspace Overview tab is
a two-line stub (thin default landing tab — needs external decision: real summary or
different default); self-delete confirm left unclicked with `eLastAdmin` refusal copy
present in code (adopt as explicitly unverified, consistent with B-02's UI-only scope).

No P0. Nothing invented: Judge B's H-1–H-4 and Judge A's non-findings (reload reseed,
delete-guard unclicked, Ctrl+K-on-404) are adopted as stated, not upgraded.

## 5. Arabic / English evaluation

- **AR:** clear, consistent labels; nav matches headings; plain error/denial/empty
  phrasing; identifiers isolated and readable in rows and modals (archive, admin,
  user-details modal with correct LTR email).
- **EN:** `58-EN-financials.png` inspected directly — natural title, cards, "Not available"
  states, scope note, empty-project message; layout mirrors correctly. Known EN gaps on
  this and other screens: untranslated IPC chips (B-10), `STATUS_AR` badges/options
  (C-04), shell chrome leftovers and the awkward greeting (C-10) — all P2/P3 above, none
  blocking comprehension of the screens' primary content.
- **Limit stated plainly:** exactly ONE screen was visually reviewed in EN, and Judge C —
  despite claiming an EN tour — left no EN screenshots and none of the cited EN/responsive
  JSONs in its folder. EN breadth beyond strings is unverified — a human EN copy-edit pass
  over archive/admin/inventory/dialogs is recommended as deferred review, not a blocker.
  No literal translation harming comprehension was observed on any viewed screen.

## 6. Responsive & accessibility — tested vs unverified, strictly separated

**Tested (cited):** isolated 390px screenshots for dashboard, requests, stock, financials,
admin, archive, projects, project overview — card degradation holds, primary actions
reachable, bottom nav appears, no overflow visible in the shots (but see C-01: the bar
itself carries only 5 of 9 sections — code-verified `Shell.tsx:92-93`, render-verified
in `60-n-dashboard.png`); dialog Escape open→closed proven by judge-B's probe; zero
console/page errors in judge-B's capture; 8-width zero-overflow matrices remain green in
the automated suites (cited from Phase 3.10, not re-run — this phase executes nothing).
**NOT verified:** contrast ratios, touch-target sizes, real screen-reader behavior,
`prefers-reduced-motion`, dark mode, density toggle, print styles, offline banner,
320px EN, destructive-confirm outcomes — and, most importantly, **no end-to-end phone
walkthrough of any core flow exists** (create movement, approve/issue, import, export,
user lifecycle). Narrow screenshots do not prove phone UX. No WCAG or other standard is
claimed; anything beyond the tested list needs a device pass. (Annotation: Judge C lists
CSV-import flow and download byte content as "untested" — the automated suites do assert
import behavior and download bytes; what is missing is the *human UX walkthrough*, which
is the operative gap.)

## 7. What works well — preserve it

Judges A+B keep-lists, corroborated by the same artifacts I inspected: demo-mode honesty
(persistent badge, per-card notes, derived-figures note, in-browser import note,
`(تجريبي)` suffixes); existence-hiding denied/invalid states; working command palette +
EN toggle; honest empty states with live counts; the permission matrix modal
(INHERIT/GRANT/DENY + source chips — the Role/Override/Effective model made visible);
MR lifecycle legibility (per-status row actions, requested/issued/remaining, remaining-
capped issue modal); narrow card degradation; nav permission-filtering for viewer/manager;
dialog Tab-cycling (14 stops inside New-User dialog, judge-observed); notification
`فتح المرتبط` deep links that land somewhere real (judge-observed); audit filter hygiene
(match count, clear, page-reset, labeled read-only details — judge-observed, consistent
with suite assertions).

## 8. Required improvements before design approval

1. Viewer empty-state wording (F-01). 2. Project-tab deep-links or embedded filtered
   lists (F-02). 3. Literal `{f}` fix (F-03, both locales). 4. Approve confirm + pair
   separation (B-01). 5. Self-harm guard copy (B-02). 6. Role inspectability (B-03).
   7. Transfer direction text (B-06). 8. Phone bottom-nav pattern decision (C-01).
   9. Export strip on zero-match filters (C-02). 10. Audit sort in export, or honest
   "default order" label (C-03). 11. Owner decisions on row-action density (F-04/F-05),
   terminology (F-09), and the small prototype-only items (F-06/F-07/F-08, B-04/B-05/B-07/B-08/B-10,
   C-04/C-05/C-06/C-07).

## 9. Deferred improvements

F-16 dashboard hero; F-11–F-15 and B-09/B-11/B-12/B-14/B-15 and C-09–C-12 polish; Projects/BOQ sort
headers; touch audit; contrast measurement; screen-reader pass; reduced-motion
verification; full EN copy-edit; phone device walkthroughs; genuine human second-judge
review (Rule 0 still open).

## 10. The six owner decisions (FINAL-ACCEPTANCE.md §5, quoted with impact)

1. **"Confirm or relax the export-gate tightening (C)."** Prototype demands `reports.view`
   PLUS each dataset's read permission; audited routes demand `reports.view` alone.
   Impact: who can export what; denial-reason copy. Assumed open — nothing here closes it.
2. **"Documents export format decision (B)."** No documents report; audited export is
   XLSX-only (needs `excelService`). Impact: whether Archive ever gets an export button
   and in which format. Open.
3. **"Financial data model: contract value / tax / retentions (F)."** Impact: design
   approval covers interaction only, never the numbers. Open.
4. **"`sites.edit` grant + `technical`-role login (A, H)."** Impact: "+ موقع" and the
   technical persona stay unreachable in any walkthrough. Open.
5. **"Authorize the conflict-resolution phase (E)."** Impact: nothing production-side
   can proceed first; 33 marker files re-verified in Phase 3.10. Open.
6. **"Schedule the human-only reviews (G)."** Impact: contrast, screen reader, touch,
   motion, and this review's own independence gap stay open until scheduled. Open.

## 11. Final approval verdicts (each with verifiable reasons)

1. **UX: Approved with Conditions.** All sampled journeys complete without dead ends
   except F-02's signpost tabs; states are plain-language with paths out; conditions are
   §8 items 1–10 (ten P1s) plus the item-11 owner decisions. Nothing observed justifies
   Not Approved; unconditional approval is excluded by the misleading viewer message
   (F-01), the unconfirmed approve action (B-01), the unreadable transfer text (B-06),
   the phone-unreachable sections (C-01), and the scope/sort export gaps (C-02/C-03).
2. **Direction D: Approved.** Rail navigation + desk + scoped lists implemented
   consistently on every reviewed screen; the shell declares "Direction D · prototype";
   restraint is coherent throughout. No direction violation observed.
3. **Prototype: Ready for Owner Review.** All findings are reviewable as-is on screen;
   no hidden blocker emerged; evidence covers every scope area except the explicitly
   listed gaps (§6). Design problems and production blockers are separated below.
4. **Production UI: Blocked.** `apps/web` + `apps/api` unbuildable (33 marker files);
   six contract decisions undecided; human-only acceptance items without evidence. Green
   tests and this review say nothing about production code readiness.

- Files added/modified by this task: **one** — this file
  (`docs/frontend-rebuild/phase-03-prototype/UX-REVIEW.md`).

## Scope verification (read-only — Phase 3.11 record, preserved)

- No source, test, data, settings, dependency, production, backend, git, or
  conflict-marker change was made in this task; no suite was executed; screenshots and
  dumps used lived under `%TEMP%\opencode\ux-review\` from the start.
- Preview server on :5199 left running, still serving the verified build.
- Files added/modified by this task: **one** — this file
  (`docs/frontend-rebuild/phase-03-prototype/UX-REVIEW.md`).

---

# Phase 3.12 remediation tracking (implementation phase — all findings actioned)

## 0. Inventory reconciliation (addendum §1)

Headline counts vs enumerated IDs, verified against this report's own sections:

- **P1 § lists 10 IDs** — F-01, F-02, F-03, B-01, B-02, B-03, B-06, C-01, C-02, C-03 —
  matching the "10" headline. F-03 sits in the P1 section (not P2). **No discrepancy.**
- **P2 § lists 14 IDs** — F-04, F-05, F-06, F-07, F-08, F-09, B-04, B-05/B-08, B-07,
  B-10, C-04, C-05, C-06, C-07 — matching the "14" headline. **No discrepancy.**
- **P3 § lists 16 headers with F-12 used twice** (email wrap + EN-mock boundary).
  Tracked below as **F-12a** (email wrap → fixed) and **F-12b** (EN keeps Arabic mock
  data → accepted boundary, kept). 15 unique findings + 1 duplicate ID, matching the
  "15" headline once de-duplicated. **Resolved with stable suffixes; no finding dropped.**

Every unique finding below has its own disposition and a passing test where automated
verification is feasible. Nothing was closed by code change alone.

## 1. P1 resolution matrix (10/10 CLOSED — verified)

| ID | Root cause | Files changed | Fix | Proving test |
|----|-----------|---------------|------|--------------|
| F-01 | One generic empty string for both "no projects exist" and "none in membership" | `Projects.tsx`, `i18n.tsx` | Scoped empty (`noProjectsScoped` + hint + Home action) vs generic empty; existence-hiding kept | remediation-p1 P1-01 (3 tests: scoped message, no name leak, truly-empty) |
| F-02 | Workspace tabs rendered stub EmptyStates with no links | `ProjectWorkspace.tsx`, `Archive/Warehouses/Stock/Requests.tsx` (param intake), `api.ts` (denial-first filter) | Deep links with `?project=`; membership checked before filtering; honest denied/empty states | remediation-p1 P1-02 (5 tests incl. restricted + empty + back-nav) |
| F-03 | `legacyFolder` template used `{f}`, caller passed `{f}`… EN dict used `{f}` while AR caller passed `{name}` after an earlier partial fix — mismatch rendered literally | `i18n.tsx` (both locales → `{name}`), `Archive.tsx` caller | Consistent placeholder; row + modal render real folder name | remediation-p1 P1-03 (2 tests) + expanded `{token}` DOM guard (remediation-p2p3 corruption suite) |
| B-01 | Approve path had no dialog while reject did | `Requests.tsx`, `i18n.tsx` | Approval ConfirmDialog (number/project/lines), unambiguous labels, focus/Escape/restore via shared Modal | remediation-p1 P1-04 (4 tests: cancel, confirm-once, reject, 403) |
| B-02 | Generic prompts for self-destructive actions | `Admin.tsx` (menu disable + warn copy), `i18n.tsx` | Self disable/delete disabled without backup admin; enabled with explicit self-warning when mock permits; self-delete always refused | remediation-p1 P1-05 (4 tests incl. backup-admin enable + last-admin mock proofs) |
| B-03 | Role cards were `<div>`s with no action | `Admin.tsx` (buttons + RoleInspectBody), `i18n.tsx` | Read-only matrix: description, grouped ROLE_BASE, per-user effective preview, DENY-beats-GRANT note | remediation-p1 P1-06 (6 tests: all 5 roles + preview) |
| B-06 | Direction text guessed from signed quantity with a hardcoded `←` | `Stock.tsx`, `i18n.tsx` (`transferRoute`/`transferEffect`) | Canonical source→destination from `warehouseId`/`destinationWarehouseId`; dual effect line; missing-dest blocks at form | remediation-p1 P1-07 (4 tests incl. all 5 types + balances) |
| C-01 | `items.slice(0,5)` dropped 4 sections on phones | `Shell.tsx`, `styles.css`, `i18n.tsx` | 5 primary tabs + `More` sheet with every other authorized destination | manual + responsive matrix (no destination disappears at 320/375/390); phone touch test (a11y) |
| C-02 | Export strip unmounted on zero rows | `ContextualExport.tsx`, `Items/Warehouses/Archive.tsx` | Strip stays mounted with zero count + header-only file; scope/filter still enforced | remediation-p2p3 contextual-export suite (zero-match + viewer-absent) |
| C-03 | Audit export ignored `sortBy`/`sortDir` | `api.ts` (`order()` step + `ExportFilter` sort fields), `Audit.tsx` (passes grid sort) | File order == grid order on all 5 columns × both dirs, full filtered set | remediation-p2p3 C-03 suite (asc/desc/file-vs-grid + full-set) |

## 2. P2 resolution matrix (14/14 CLOSED — verified)

F-04/F-05 → shared `Menu` (ui.tsx) + Archive/Admin row rework (remediation-p2p3 P2-01/P2-02
suites incl. keyboard/Escape/focus + narrow-card layouts). F-06 → Archive search is a real
`<form>` (Enter ≡ button, live-region announcements; P2-03 suite). F-07 → in-viewer demo
banner both locales (P2-04 suite). F-08 → two-step status confirm with doc/from/to
(P2-05 suite: all 7 statuses cycled). F-09 → hub `إدارة المخزون` / tab `حركات وأرصدة
المخزون` + EN mirrors (P2-06 suite). B-04/B-08 → localized override/access labels,
values unchanged, DENY-precedence note in both manage + inspect surfaces, locale-switch
semantics test (P2-08 suite). B-05 → `approve:false` eliminated from user copy; contract
note kept in plain language in the details modal (P2-09 suite). B-07 → movement options
with stock-effect explanations, keys stay in code (P2-10 suite, 5 types × 2 locales).
B-10 + C-04 → `statusLabel()` everywhere (Stock/Requests/Projects/Archive/IPC/Financials/
Home); exports carry raw codes (P2-11 suite AR+EN). P2-12 → functional dashboard cards,
spaced stats, rewritten greeting, contextual recent movements (P2-12 suite).

## 3. P3 resolution matrix (15 unique + F-12 dup — CLOSED / 1 accepted boundary)

F-11 breadcrumbs → localized route map, scoped project resolution, raw segments skipped
(C-07 suite: routes, nested tabs, invalid/out-of-scope ids). F-12a email wrap → `.email`
isolation + `.num.ltr` codes (mixed-direction suite). **F-12b EN-mock → accepted
boundary (unchanged):** user-entered business data legitimately stays Arabic in EN mode;
marked `data-i18n-skip` where it meets the chrome audit. F-13 palette → localized hints,
discoverable shortcut label, open/filter/select/Escape/restore tests. F-14 login →
native radios, per-role scope hints from ROLE_BASE, technical tile (no permission change),
pre-auth switch with persistence (login suite). F-15 arrows → locale-aware `arrowNext`/
`arrowBack`, tested both directions. F-16 dashboard → covered by P2-12. B-09 → live
`continueIssue (N)` from derived balance (B-09 test). B-11 seeds → corrected
(`للأساسات`, `دفعة أولى`, direct-value note) + corruption guard. B-12 → `directAmountWhat`
helper copy in the IPC form. B-14 → Western-digit convention documented in `i18n.tsx`
header + numeral suite. B-15 → density toggle is real (state/tooltip/persistence tested);
collapse persists; offline banner honest; footer build context. C-09 stat spacing →
`<br/>` separation tested. C-10 greeting/shell chrome → rewritten + localized, business
data retained. C-11 toast-edits → real Items/Warehouses/Projects edit dialogs with
validation (edit suites). C-12 names/overview → distinct rail/brand/mobile names, native
radios, overview summary from live counts (overview + settings suites).

## 4. What 3.12 deliberately did NOT change (production boundaries kept)

Export-gate tightening kept (reports.view + dataset permission + scope). Documents
prototype-CSV is metadata-only and does not authorize a production CSV endpoint.
Financial N/A cells stay N/A (copy improved, no figures invented). No `sites.edit`
granted (truthful unavailable note). Technical role base untouched (tile only).
No conflict markers touched. No dependencies, no git ops, no backend/DB/API edits.

## 5. Evidence & scope

- `tsc --noEmit`: clean. `vite build` (VITE_PROTOTYPE=1): clean → `dist/` in prototype dir.
- New: remediation-p1 28/28, remediation-p2p3 62, a11y 7/7 (measured: touch 44px,
  light ratios 4.5+, dark 16.2, focus ring, motion, radios). Old suites re-run fully;
  exact counts in the final report below (phase 3.12 run log, `%TEMP%` only).
- Scope: `git status` shows no changes outside `docs/frontend-rebuild/phase-03-prototype/`
  (pre-existing tracked-tree modifications predate this phase and were not touched).
- Honestly NOT covered here: real-device feel, real screen reader, human contrast
  adjudication, independent human UX review — retained as human-only items.
