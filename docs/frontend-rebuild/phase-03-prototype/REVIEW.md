# Owner Review Guide — Direction D Prototype (تجربة المالك)
Dev/preview on port **5199** (see README.md). Everything is mock; nothing leaves the browser.

> Phase 3.13 visual redesign ("Architectural Operations Console") is live in this
> build — see `VISUAL-REDESIGN-REPORT.md` for the art direction, palette, per-screen
> notes, and the screenshot set under `%TEMP%\opencode\phase313-visual-review\`.
> Phase 3.15 ("Light Mode overhaul") further refines Light Mode on top of it —
> see `../phase-03/LIGHT-MODE-OVERHAUL-REPORT.md` and the diagnosis in
> `LIGHT-MODE-DIAGNOSIS.md` (`%TEMP%\opencode\phase315-visual-review\`).
> Phase 3.16 ("Visual composition redesign") recomposes dashboard, tables,
> toolbars, and navigation — see `../phase-03/VISUAL-COMPOSITION-REDESIGN-REPORT.md`
> and `VISUAL-COMPOSITION-DIAGNOSIS.md`
> (`%TEMP%\opencode\phase316-visual-review\`, all four AR/EN × light/dark variants).
> The tour below still applies; every screen now carries the new visual identity.

## Suggested 15-minute tour
1. **Login** (`/login`): pick each demo role (مدير/إدارة/مخازن/مشاهد/فني) — native radio
   group with one-line scope hints; notice nav items appear/disappear and denied pages
   (`/admin` as viewer → 403 with reason). The AR/EN switch works before login and persists.
2. **Home** (`/`): submitted/approved/partially-issued counts as LINKS into filtered request
   lists + figures + recents with localized movement types. As viewer, queues reduce to visible scopes.
3. **Projects** (`/projects`): search, status filter, sortable headers (code/name/client/status),
   pager (5/page), create/edit/delete (mock). As viewer with no membership: an honest
   scoped empty state, not a generic "no data".
4. **Project workspace** (`/projects/p1/overview|sites|documents|warehouses|stock|financials`): overview now
   shows live counts with deep links into Archive/Warehouses/Stock/Requests (project filter
   pre-applied, membership enforced); Documents/Warehouses/Stock tabs link out instead of
   dead-ending. Site creation shows a truthful unavailable note (no demo role holds `sites.edit`).
   Invalid id returns to hub.
5. **Archive** (`/archive`): search (Enter works) + status + project filters, unified list (NO folders anywhere),
   select → batch bar, revisions timeline modal, mock upload (no folder asked), delete confirm.
   Row actions: Preview + Download stay visible; status/replace/links/edit live in the
   accessible **المزيد** menu (danger group separated). **Status** is now two-step (select → confirm
   showing doc/from/to). Metadata CSV export via the contextual strip (prototype-only).
   - **Preview** (معاينة) opens a real viewer modal with an in-modal demo banner: metadata card, synthetic page/grid body marked *"mock content — not the original file"*, an explicit fallback for unsupported types (DWG) and for documents with no preview content. `فتح المرتبط` moves to a linked document inside the same viewer.
   - **Links** (روابط N) lists linked documents, adds one (already-linked documents stay visible but disabled = duplicate prevention), removes with an explicit confirm, and refreshes the row count without a reload.
   - **Import CSV (تجريبي)** → choose a local CSV → auto-mapped columns → per-row valid / error / duplicate review with opt-in for duplicates → summary (added vs skipped) → explicit confirm. Cancel changes nothing. Partial results are reported honestly; no transaction claims.
   - As **مشاهد (viewer)** only Preview is offered — every management action is absent, not merely disabled.
6. **Inventory** (`/inventory` → 4 areas, hub renamed إدارة المخزون): warehouses/items CRUD-lite
   (real edit dialogs) + warehouses CSV import; stock 3 tabs (history renamed حركات وأرصدة المخزون)
   incl. low-stock calm state; transfers show `من [المصدر] إلى [الوجهة]` with both effects;
   **requests lifecycle**: draft → submit → approve (now confirmed) /reject → issue with
   `استكمال الصرف (المتبقي N)` on partials; viewer sees read-only rows.
7. **Financials** (`/financials`): per-project cards derived from BOQ lines and approved certificates; contract value shows «غير متاح» rather than an invented number. Drill into project financials (`/projects/p1/financials`):
   - **المقايسات (BOQ)**: sortable line list with unit · quantity · rate · derived total, pager, project total, live total while editing, and the executed quantity per line. Create/edit with field-level validation. Delete is offered but **refused** for any line an IPC references (the audited `blockBoqItem` guard).
   - **المستخلصات (IPC)**: sortable + paged list with derived net and localized status chips. Open a certificate to see each line linked to its BOQ line (code, description, rate, previous/cumulative quantity). Create a certificate from BOQ lines (net derived from the BOQ rates) or with a direct gross amount (net = gross − deductions, explained inline). Transitions follow the audited matrix — no backward moves, approved/rejected are terminal. Delete is draft-only.
8. **Admin** (`/admin`): row menu with disabled+explained self actions; role cards open a
   read-only permission matrix (grouped, with per-user effective preview); override
   selects speak Arabic/English (values unchanged); access cell tooltips break down
   per-project levels.
9. **On a phone width** (320–430): bottom bar shows 5 tabs + **المزيد** sheet with the rest;
   breadcrumbs resolve project names (never raw ids); touch targets ≥44px.
9. **التقارير والتصدير** (`/reports` — nav ⤓, gated on `reports.view`): one row per exportable dataset showing its scoped row count and column count, with a preview modal and real local **CSV / JSON** downloads. Try **حركات المخزون** — the columns mirror the audited `expandForExport`, rows are UTF-8 with a BOM so Excel reads the Arabic, commas/quotes/newlines are quoted per RFC 4180, and a value like `=HYPERLINK(…)` is exported as harmless text without altering the stored record. Export a report as a user with limited project access and the file shrinks with your access — it never widens it.
10. **سجل العمليات** (`/audit`): 32 demo entries. Combine the search box with the user / action / entity selects and the from–to date range; the count updates live, **مسح الفلاتر** restores the full permitted set, and the headers sort with real ordering. Pagination resets to page 1 whenever a filter changes. Open an entry to see its recorded field changes — a login entry honestly says none were recorded. Export the current filtered view from the header.
11. **Admin/Settings/Search/Notifications**: self-guard demos, diff viewer, backup/restore confirms (mock), import stats, theme+language switching (persisted), search page (2+ chars), mark-read flows.
12. **اللغة / Language**: the `ع/EN` button in the top bar (also in the command palette and Settings → appearance). Switching is instant and client-side and the choice survives a reload. In English every screen — headings, buttons, labels, table headers, empty/error/denied states, **and mock error messages** — reads in English; business data (project and item names, document codes, emails) stays as entered, which is deliberate.
9. **⌘K/Ctrl+K**: nav + theme + language + logout; arrows + Enter + Escape.
10. **Responsive**: 320/375/390/430/768/1024/1366/1920 — records stack, toolbars/tabs wrap, zero horizontal scrolling; keyboard-only pass (Tab/Enter/Escape); theme + density toggles in topbar.

## What NOT to expect
Real API/DB/auth, real file up/download, real permissions backend, pixel-final styling, charts (none evidenced), English business-data translation (chrome only), offline mutations, large-file handling, screen-reader certification.
Document preview renders **layout-shaped mock content only** — no PDF/image decoding (no rendering library was added), and no preview for types the prototype cannot represent.
