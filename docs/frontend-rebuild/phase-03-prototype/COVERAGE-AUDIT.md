# COVERAGE-AUDIT.md — Phase 3.1 prototype coverage audit (updated 3.12)
Isolated audit (Temp-output Playwright run + source inspection). No repo files modified.
Prototype: `docs/frontend-rebuild/phase-03-prototype/` (Direction D, mock-only).

## 1. Route inventory (24 route definitions — all verified rendering)
| # | Route | Screen | Verified |
|---|---|---|---|
| 1 | `/login` | Role-picker login (5 demo roles incl. technical, native radios, pre-auth AR/EN) | rendered, all roles log in |
| 2 | `/` | My Desk (queues + figures + recents) | rendered; calm state verified |
| 3 | `/projects` | Hub: search + status filter + **sorting** + pager + create/edit modals | rendered; filter + sort + pager exercised |
| 4–9 | `/projects/:id/{overview,sites,documents,warehouses,stock,financials}` | Workspace: live-count summary + deep links, honest sites note, scoped docs, BOQ/IPC tabs with sort+pager | all render; deep links + tab nav exercised |
| 10 | `/financials` | Cross-project figures + IPC chips + drill links | rendered |
| 11 | `/archive` | Unified list, search + status + project filters, row menu, batch bar, upload/revisions/delete modals, metadata CSV export | rendered; modals + menu + export exercised |
| 12 | `/inventory` | Hub cards (renamed إدارة المخزون) | rendered |
| 13–15 | `/inventory/{warehouses,items,stock}` | CRUD-lite lists with real edit dialogs, warehouses CSV import, contextual exports, localized movements | rendered; create/edit/delete/import exercised |
| 16 | `/inventory/requests` | Lifecycle list + details modal + create/delete; approve confirms | rendered; submit→approve→issue verified |
| 17 | `/admin` | Users/roles/access tabs, row menu, read-only role matrix, localized overrides | rendered; self-denial + last-admin + preview verified |
| 18 | `/audit` | Search + list + diff modal; sort-aware export | rendered; modal + sorted export exercised |
| 19 | `/settings` | 5 tabs (backups/imports/appearance/account/about) | rendered; theme/lang/density/collapse exercised |
| 20 | `/search` | Grouped results page (2+ chars) | rendered |
| 21 | `/notifications` | List + refresh + deep links + mark-read | rendered |
| 22 | `/403` | Denied page | rendered (viewer→/admin) |
| 23 | `*` | 404 page | rendered (`/nope-xyz`) |
| 24 | `/projects/does-not-exist` | Invalid id | honest Not Found + back actions (closed 3.2) |

Overflow matrix: all routes × 320/375/390/430/768/1024/1366/1920 → zero horizontal overflow (runtime-verified). Console/pageerrors: clean except the single GAP-P1-01 rejection.

## 2. Forms & dialogs inventory
| Element | Location | Behavior (audited) |
|---|---|---|
| Role-picker login | Login | 4 roles, no validation needed, sessionStorage persist — implemented |
| Project create | Projects | required name, disabled submit, local prepend + mock toast — simulated |
| Site add | workspace modal | required code+name, disabled submit, in-memory add + reload — simulated |
| Warehouse/item create | modals | required name, local prepend — simulated |
| Stock movement | stub dialog | single confirm button, no lines/warehouse/type inputs — **simplified** |
| MR create | modal | notes field only; no warehouse/project/lines pickers — **simplified** |
| MR details + lifecycle | modal | submit/approve/reject/issue per state+perm; approve transition runtime-verified — simulated backend |
| Archive upload | modal | title only; **no file picker** — simplified |
| Archive revisions | timeline modal | list + mock add; Escape verified — simulated content |
| Delete confirms | 5 screens | all present, Escape/backdrop verified on sampled modals — simulated effect |
| Settings restore | confirm w/ safety copy | present — simulated |
| Command palette | global | combobox + arrows + Enter + global Escape (fixed during audit) — implemented |
| Import flows (Excel/smart) | — | **missing** (no modals at all) |
| MR issue modal (remaining-prefill) | — | **missing** (one-click issue instead) |
| User/role/access editing | Admin | read-only + info toasts — **simplified** |
| Preview viewer | Archive | toast only, **no viewer modal** — missing |
| Per-doc status/replace/links | Archive rows | **missing** (only preview-toast/download-toast/edit-toast/delete) |
| Filters | projects(status), archive(status), stock(type), MR(status), audit(none — search only) | present-but-partial (see gaps) |
| Sort controls | — | **missing everywhere** |
| Pagination | projects only (5/page) | **missing elsewhere** |
| Batch bar | archive selection + ZIP-sim | present, Escape/close verified manually |

## 3. Permission matrix (audited vs backend contract)
| Check | Prototype behavior | Verdict |
|---|---|---|
| Route guards (9 perm-gated routes) | admin passes all; viewer denied `/admin`, `/inventory/requests` (lacks key) with reason page | verified |
| Nav reduction per role | items hidden without rights (4 roles spot-checked) | verified |
| Approve/reject render | only with mock `materialRequests.approve` + `submitted` (admin yes; warehouse/viewer zero buttons) | verified |
| Submit/issue/delete per state+perm | rendered per matrix; submit→approved transition verified live | verified |
| Export gating (`reports.view`) | **no export affordances exist** — nothing to mis-gate; gap (functionality missing, not a violation) | noted |
| Overrides / DENY precedence | **not representable** — mock roles are flat perm sets, no users/overrides | simulated-limitation |
| Self-denial / last-admin | **absent** — no per-user identity in mock model | simulated-limitation |
| Project memberships (NONE/READ/WRITE/DELETE) | **absent** — no scoping in mock | simulated-limitation |

## 4. UX/responsive/a11y observations (audited)
- Zero-overflow matrix green (above); record→card transformation present ≤767px; toolbars/tabs wrap; dialogs fit viewport.
- Keyboard: all actions native buttons/links; palette + modals Escape-verified; focus trap/restore/initial-focus implemented but **not runtime-verified**; tab-order traversal not exhaustively walked.
- Touch: 44px rules in CSS; not physically measured. Contrast: not measured. Reduced-motion: kill-switch present, behavior not runtime-tested.
- i18n: `dir` flips + chrome strings + persisted `cos-proto-lang` verified incl. reload; **page body copy largely stays Arabic in EN mode** (gap).
- Long values: mock long filename + long item name render without breakage at all widths (verified via matrix).
- Density toggle + rail collapse + offline banner: implemented, **not runtime-exercised**.
- No `dangerouslySetInnerHTML`; no network calls (mock adapter only — consistent with clean console).
