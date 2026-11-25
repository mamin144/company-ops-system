# Phase 2 — Screen Specifications (مواصفات الشاشات)
`docs/frontend-rebuild/phase-02/screen-specifications.md` — proposal only. Fields per screen: goal · layout · primary/secondary actions · data · search/filter · permissions · context · states · confirmations · responsive · l10n · API constraints · parity risks · open questions. No invented fields/KPIs/rules.

## S0. Shell (global)
- **Goal**: orient + reach everything within 2 taps; never block work. **Layout**: slim rail (desktop) / bottom bar (mobile) + topbar (search entry, bell w/ badge, theme, user menu, offline banner slot) + breadcrumbs in workspaces.
- **Actions**: navigate, ⌘K palette (nav + theme + density + logout), collapse rail, logout (device-only), retry session on expiry.
- **Permissions**: rail items hidden without rights; direct URLs → `/403`. **States**: session-restoring splash; expired → login with return path; offline → banner (read-only posture, no fake actions).
- **Responsive/l10n**: rail→bottom-bar; logical props; ar-RTL default / en-LTR; mixed-direction tokens isolated.
- **Parity risks**: Ctrl+K targets, badge counts, persisted prefs (theme/density/collapse/language). **Open**: ⌘K scope keep/extend (Q-owner).

## S1. Login (`/login`)
- **Goal**: authenticate fast, recover from errors plainly. **Layout**: centered card (brand, user/pass, remember-me, submit) + status line.
- **Actions**: submit (disabled until valid + busy-guarded); show/hide password; error text (no user-enumeration wording — keep server's generic 401 copy).
- **States**: idle/busy/error; expired-session return message. **Responsive**: full-width card mobile. **API**: `POST auth/login {username,password,rememberMe}`; failure copy from server.
- **Parity risks**: remember-me semantics (refresh-cookie lifetime), generic failure text. **Open**: none.

## S2. My Desk (`/`, replaces dashboard)
- **Goal**: "what needs me + where things stand", role-aware. **Layout**: queue panel (submitted approvals, rejected notices, low-stock — each row: signal dot + count + deep link; see data-source matrix below) + compact figures strip (real counts only: projects, documents, warehouses, items) + recent activity (docs + movements, max 5–6 each).
- **Data-source matrix (dedicated, per revision mandate)**:
| Widget/queue | Existing source | Access | Transformation | Cost | Evidence | Decision |
|---|---|---|---|---|---|---|
| Submitted requests, read-only (no authority implied) | `GET /api/material-requests`, filter `status==='submitted'` | `materialRequests.view` | count + rows linking to details | existing request | verified | keep — headings read "submitted / awaiting review", never "awaiting your approval" |
| Actionable approval queue (conditional) | same response + filter | `materialRequests.view` **plus exact key `materialRequests.approve`** (verified backend/frontend evidence) | rows to details where Approve/Reject render only with the key + `submitted` state; rejection only via `POST …/approve {approve:false}` | existing request | verified | keep (conditional on approval-holders) |
| Rejected notices | same response, filter `status==='rejected'` | `materialRequests.view` | count | existing request | verified (union in shared types) | keep (secondary) |
| Low-stock alerts | `GET /api/stock/overview` → `lowStock[]` (server-computed) | `warehouse.view` | count + top rows | existing request | verified | keep |
| Counts | `GET <entity>?pageSize=1` → `total` ×4 | respective view perms | none | 4 existing requests | verified | keep |
| Recent docs / movements | `GET /api/documents?pageSize=5…`, `GET /api/stock/history?pageSize=6` | `archive.view` / `warehouse.view` | none | existing requests | verified | keep |
| Pending-IPC count | would need `GET /api/projects/financials` + client count | `projects.view` | extra fetch + grouping | additional request | derivable, not fetched today | **removed from default** → optional future |
| Failed-import indicator | `GET /api/import/history` (`failedRows`) | `settings.manage` (wrong audience) | sum | additional request | source exists, access mismatched | **removed from default** → optional future |
| Any other KPI/trend | none | — | — | — | unsupported | removed |
- **Actions**: jump to queue origins; retry on outage. **Permissions**: sections render only with rights; all-empty → calm state (never blank).
- **States**: skeleton shaped like content; total-outage panel + retry; partial failure → render allowed sections (keep current tolerant behavior).
- **API**: existing 8 GETs (counts/overview/recents); no new endpoints. **Charts**: none (counts + latest lists only — no data justifies more).
- **Parity risks**: partial-data tolerance; calm-vs-alert thresholds (submitted/low only). **Open**: queue grouping acceptance.

## S3. Projects hub (`/projects`)
- **Goal**: find any project, start create, reach details. **Layout**: command header (title + total chip + description) + toolbar (search, actions) + dense table (code, name, client, owner, contractor, location, contract no., value, status) + pager; mobile → cards.
- **Actions**: search (debounced), sort (code/name/client/owner), page, export (`reports.view` — see gap), import, create/edit/delete (create/edit/delete perms), row → details.
- **States**: skeleton/error+retry/empty/filtered-empty + active-filter bar with clear-all.
- **Parity risks**: 9 columns, exact filter set, modal fields (13 incl. region/role/dates), delete confirm. **Open**: none structural.

## S4. Project workspace (`/projects/:id/*`, 7 nested routes — explicit destinations, no merges)
- **Goal**: one place for everything about a project. **Layout**: identity header (name, status badge, code/client/owner/contract meta, back) + addressable tabs.
- **Tab destinations**: overview → `/projects/:id/overview` (fact grid incl. role/dates/notes) · sites → `/projects/:id/sites` (cards + add w/ required code+name, delete confirm) · documents → `/projects/:id/documents` (scoped table + preview/download) · warehouses → `/projects/:id/warehouses` (scoped read-only cards; management stays global) · stock → `/projects/:id/stock` (scoped movements/balances) · BOQ → `/projects/:id/financials` (BOQ inner tab: line CRUD + cumulative guards) · IPCs → `/projects/:id/financials` (IPC inner tab: lifecycle + dup-number + transition guards). BOQ/IPC share one financials route with two inner tabs (shared per-project context); functionality unmerged.
- **Permissions**: page `projects.view`; site mutations `projects.edit`; BOQ/IPC per audited `Can` keys (exact keys re-verify at build — flagged unknown).
- **States**: per-tab skeleton/empty/error; invalid id → back to hub (keep).
- **Parity risks**: BOQ cumulative-qty rule, IPC transition matrix, `boqTotal` vs `contractValue` display conflict (conflicted source — owner decision prerequisite). **Open**: tab order/naming.

## S5. Financials hub (`/financials`)
- **Goal**: cross-project money view. **Layout**: filter bar (search/owner/region/status/pending-IPC) + grouped tables (owner→region→project rows) + expand/collapse-all + per-project drill (reuse S4 financials).
- **Data**: `GET projects/financials` only; figures are server-computed (contract/boq/executed/deductions/IPCs). No invented progress %.
- **States**: full-page skeleton; filtered-empty card; no error state today → **add honest error+retry** (improvement, no contract change).
- **Parity risks**: grouping semantics, expand state, drill-down tabs.

## S6. Archive workspace (`/archive`) — unified, full-width, no folder UI (approved constraint)
- **Goal**: find → verify → act on any document in one full-width workspace. **Layout**: header (title, count chip, upload/import/export) + toolbar (search, project/category/date filters, clear) + unified document list (select, title+tags, number, category, type, revision-history button, status select-or-badge, file, preview/download, edit/delete/links/replace + folder-origin read-only chip where present) + floating batch bar (ZIP/clear) + mobile record cards. **No folder tree, sidebar, drawer, management panel, drag-to-folder, or folder navigation anywhere.**
- **Actions** (all kept except folder management): upload — folder-independent (verified contract, see note), smart 3-step import, preview (MIME-probed), download, ZIP of selection, revisions timeline + new revision, replace (overwrite), links manager, inline status change, metadata edit, delete confirm. Folder create/rename/delete/move have no UI; backend records, columns, relationships, and existing `folderId` links preserved untouched.
- **Contract note (verified, no blocker)**: upload schema accepts missing `folderId` (`documents.validators.ts:6`); list returns all authorized documents without `folderId` filter (conditional filter, `documents.routes.ts:93`); folder metadata stays readable for display. No invented defaults, no API change, no owner decision required for upload compatibility.
- **Permissions**: view/upload/edit/delete/download per-action gates exactly as audited.
- **States**: skeleton/error+retry/empty/filtered-empty; upload progress + failure states; revision-empty; offline → read-only posture.
- **Responsive (zero horizontal scrolling)**: dense multi-line record rows on desktop (grouped code+title / meta / status+actions across lines); stacked label/value record cards <768; filters wrap vertically; batch bar fits viewport; long filenames wrap with ellipsis + expandable full-text control (keyboard-operable tap/Enter, mobile-usable; hover tooltips only ever redundant, never the sole path to essential information); dialogs fit viewport.
- **Parity risks**: revision numbering (`00`, padStart), approved→submitted downgrade on new revision, binary-orphan cleanup, `tags` CSV mapping. Legacy folder links preserved but unmanageable in UI by approved direction. **Open**: none structural.

## S7. Warehouses (`/inventory/warehouses`)
- Goal/browse/manage stores (central/site, project link optional). Table (code, name, type, location, status) + mobile cards; type filter + search; CRUD + export/import; delete confirm; same state set as S3. Parity: project dropdown (200), type/status vocabularies.

## S8. Items (`/inventory/items`)
- Catalog with safety thresholds + tracking types (none/batch/serial). Search-only toolbar (keep — no invented filters); threshold column honest (`—` when unset). Same CRUD/import/export/delete-confirm. Parity: threshold semantics stay server-side; never invent alerts.

## S9. Stock (`/inventory/stock`)
- Three tabs: history (6 filters + sortable date + pager; delete-only rows), balances (KPI-per-type + per-warehouse tables, zero-quantity honest empties), low-stock (server-computed list; calm state when empty; red signal only when >0).
- Create movement: type-aware form (TRANSFER shows destination filtered ≠ source), line items with qty>0 validation, unit cost optional; toasts; overview refresh after save/delete.
- Parity risks: per-type permission keys (`stock_in/out/...`), ledger immutability message, pageSize cap 200. No invented movements/values.

## S10. Material requests (`/inventory/requests`)
- List (status/project/server filters + client text search) + status badges + per-state actions (submit/approve/reject/issue/delete/details) + mobile cards + detail modal (fact grid, notes/review boxes, lines table with requested/issued/remaining math) + create modal (warehouse required, project/site optional, dynamic lines) + issue modal (remaining-prefill).
- **Visibility vs authority (explicit)**: `materialRequests.view` shows read-only submitted-request information only. Approve/Reject actions render exclusively with exact key `materialRequests.approve` (verified: backend `ALL_PERMISSIONS` + `requirePermission` on the approve route + frontend `can('materialRequests.approve')` gates) **and** `submitted` state.
- **Contract fix baked into design**: Reject goes through verified `POST …/approve {approve:false}` (NOT the unsupported `/reject` path) — flagged in gaps doc.
- Permissions per state (create/approve/issue) exactly as audited. Parity: remaining-qty math display-only; transitions + 409/400 handling; `MR-*` numbering server-side.

## S11. Audit (`/audit`)
- Read-only log: action/entity/search filters, table + mobile cards, details modal (fact grid + old/new JSON diff + redacted secrets), Escape close. No mutations exist — none designed.

## S12. Admin — users (`/admin/users`)
- Table (username, full name, role, active badge, 4 actions) + create (username/fullName/password≥6/role/active) + edit (role/status, self-locked) + reset-password + overrides matrix (GRANT/DENY precedence) + project matrix separate tab + delete (self + last-admin guarded).
- Parity risks: override semantics, self/last-admin guards must behave identically; username-uniqueness + weak-password server messages preserved.

## S13. Admin — roles (`/admin/roles`)
- List (name_ar/name, system badge, userCount) + edit permissions + clone (auto-unique names) + delete (system + non-empty guarded). Keep exact guard copy.

## S14. Admin — access (`/admin/access`, renamed from `projects`)
- User picker → per-project NONE/READ/WRITE/DELETE matrix + bulk assign (replace native `confirm()` with designed dialog) + save (duplicates rejected, full-set replace) + self-guard.
- Parity: self-edit block, NONE-means-revoke semantics.

## S15. Settings (`/settings`)
- Tabs: backups (list/create/restore-with-safety-notice, `backup.manage`, unauthorized empty state), import-history (stats + search), appearance+**language** (theme cards + ar/en selector, persisted), account (profile + permission list, read-only), about (version, SW, connectivity).
- Parity: safety-backup copy on restore; import stats math; no secrets rendered (keep sanitization test).

## S16. Search (`/search`, new dedicated page)
- Full-page results over existing `GET /api/search?q` groups (projects/documents/warehouses/items/transactions), scoped by server; filter by group; empty/query-too-short states; recent searches (local, no secrets). Replaces dropdown-only dead-end.

## S17. Notifications (`/notifications`)
- Page mirror of bell: list (type label, title, message, unread mark), mark-one on open (+ optional deep link), mark-all; 30s refresh posture documented (revisit frequency only with evidence).

## S18. System states (global patterns)
- `/403` (reason + required right + back/home), genuine `/404` (helpful, no blame; unknown URLs land here — the old silent-home rule is retired), session-expired (return-path login), offline (banner + disabled mutations with explanation), update-available (confirm dialog, keep), fatal (ErrorBoundary screen + reload, console keeps cause).

## Canonical statuses (verified against `packages/shared/src/types.ts` + audited UI maps)
| Status value | Module | Label (ar) | Evidence |
|---|---|---|---|
| `planned` / `active` / `on-hold` / `completed` / `cancelled` | projects | مخطط / نشط / متوقف / منجز / ملغي | `ProjectStatus` union, `types.ts:10` |
| `draft` / `submitted` / `under-review` / `approved` / `rejected` / `superseded` / `archived` | documents | مسودة / مقدمة / قيد المراجعة / معتمد / مرفوض / مُستبدل / مؤرشف | `DocumentStatus` union, `types.ts:45-52` |
| `draft` / `submitted` / `approved` / `rejected` / `partially-issued` / `issued` / `closed` | material requests | مسودة / مقدمة / معتمدة / مرفوضة / صرف جزئي / تم الصرف / مغلقة | `MaterialRequestStatus` union, `types.ts:152-159` |
| `IN` / `OUT` / `TRANSFER` / `ADJUSTMENT` / `RETURN` | stock | إدخال / صرف / تحويل / تسوية / مرتجع | `StockTransactionType` union, `types.ts:13` |
- `synced` / `failed` / `offline` / `denied` are **UI conditions, not business statuses** — removed from the canonical system; specified under S18 states instead. No other statuses invented.

## Cross-screen parity red lines
No invented KPIs/charts/progress/deadlines/thresholds/values; no new statuses; no weakened confirmations; no dropped filters/columns/actions; server math displayed, never recomputed divergently; every destructive path keeps confirmation + server guard copy.
