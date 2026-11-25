# Phase 2 — Information Architecture (هيكل المعلومات والتنقل) — REVISION 1
Proposal only. No direction approved; structure below is direction-neutral except where noted.

## 1. Proposed sitemap
```
/login
/                                            → My Desk (role-aware home: verified queues + figures)
/projects                                     → Projects hub
/projects/:id/overview                        → نظرة عامة (identity, parties, dates, notes)
/projects/:id/sites                           → المواقع (cards, add/delete)
/projects/:id/documents                       → مستندات المشروع (scoped archive view)
/projects/:id/warehouses                      → مخازن المشروع (scoped cards)
/projects/:id/stock                           → مخزون المشروع (scoped movements/balances)
/projects/:id/financials                      → مالية المشروع (BOQ + IPC tabs)
/financials                                   → Financials hub (cross-project overview)
/archive                                      → Archive workspace (unified full-width list/cards + batch bar; no folder UI)
/inventory                                    → redirect → /inventory/stock
/inventory/warehouses | /inventory/items | /inventory/stock | /inventory/requests
/admin/users | /admin/roles | /admin/access   → administration (renamed access; redirect from /admin/projects)
/audit                                        → سجل التغييرات
/settings                                     → settings (+tabs incl. language)
/search                                       → نتائج البحث الشامل (new page; dropdown kept as entry)
/notifications                                → مركز الإشعارات (page + bell panel)
/403 /404                                      → denied / not-found
```

## 2. Seven project-detail areas — explicit destinations (no silent merges)
| Current tab (audited) | Destination | Form (route vs tab) | Functions preserved |
|---|---|---|---|
| 1. Overview | `/projects/:id/overview` | URL-addressable route rendering the workspace's overview panel | identity + fact grid (client/owner/contractor/contract no./region/role/dates/location/notes) |
| 2. Sites | `/projects/:id/sites` | route | site cards, add (code+name required), delete confirm (`projects.edit`) |
| 3. Documents | `/projects/:id/documents` | route (scoped archive view) | scoped table + preview/download (existing per-doc endpoints; same gates) |
| 4. Warehouses | `/projects/:id/warehouses` | route (scoped cards) | scoped warehouse cards (read-only here; manage stays in inventory) |
| 5. Stock | `/projects/:id/stock` | route (scoped movements + balances) | scoped history/balances via existing `projectId` filters |
| 6. BOQ | `/projects/:id/financials` (BOQ tab) | route + inner tab | line CRUD under existing `projects.edit/create` scoping + cumulative-qty guards |
| 7. IPCs | `/projects/:id/financials` (IPC tab) | route + inner tab | lifecycle + dup-number + transition guards; detail/create/view/delete flows |

BOQ and IPC share one financials route with two inner tabs (they share the per-project financial context and the existing tab components); each keeps its full workflow — combined URL, **not** merged functionality. Warehouses keeps a real destination (scoped read) distinct from global management. Scoped views reuse existing `?projectId=` filters; no new endpoints.

## 3. Old → new mapping (zero drops)
| Existing | Destination | Rationale |
|---|---|---|
| `/login` | `/login` | unchanged |
| `/` → `/dashboard` | `/` (My Desk) | dashboard rethought; `/dashboard` redirects to `/` (bookmark/test compat) |
| `/projects`, `/financials`, `/projects/:id` (+7 tabs) | `/projects`, `/financials`, `/projects/:id/*` | same paths; tabs become nested routes (deep-linkable) |
| `/archive` | `/archive` | unchanged scope |
| `/warehouses`, `/items`, `/stock`, `/material-requests` | `/inventory/warehouses|items|stock|requests` | one hub, shared sub-nav; old paths redirect client-side (compat, see §4) |
| `/audit` | `/audit` | unchanged |
| `/admin/users`, `/admin/roles`, `/admin/projects` | `/admin/users`, `/admin/roles`, `/admin/access` | `projects`→`access` clarity; old path redirects |
| `/settings` (+5 tabs) | `/settings` (+language in appearance) | tabs kept; language selector added |
| GlobalSearch dropdown-only | `/search` page + palette/dropdown entries | shareable filterable results |
| Bell panel-only | `/notifications` + bell | history + actions |
| futureModules dead labels | **dropped** (Q3) | no fake modules |

## 4. Route compatibility policy (consistent redirects + genuine 404)
**Terminology (binding for all Phase 2 docs):** every "redirect" below is a **client-side navigation redirect** implemented later through the frontend router (replacing the history entry where appropriate). No HTTP 301 (server/CDN-level) redirect has been verified or authorized, and none is proposed; hosting/deployment configuration is untouched.
| Case | Behavior | Rationale |
|---|---|---|
| `/` signed-in | My Desk home | single entry |
| Legacy `/dashboard` | redirect → `/` (preserve query) | bookmarks/tests/history |
| Legacy entity paths (`/warehouses` etc.) | redirect → `/inventory/*` equivalents (preserve query) | compat without duplication |
| `/admin/projects` | redirect → `/admin/access` | rename clarity |
| Bare `/projects/:id` | redirect → `/projects/:id/overview` | deterministic default tab |
| Other legacy URLs (none known beyond above) | case-by-case redirect table owned by implementation phase; default → `/404` | no silent home dumps |
| Unknown URLs | genuine `/404` (helpful, no blame, search + home links) | contradicts nothing; old silent-home rule explicitly retired |
| Denied (perm fail) | `/403` with reason + required right + back/home | keep current denied-panel semantics, addressable |
| Login | preserves return path (`?return=`, client-side only, no contract change) | session behavior unchanged |
| Nested deep links (`/projects/:id/documents` etc.) | directly loadable; tab state from URL | shareable operations |
| Query state (filters/page/search) | preserved across redirects; encoded in URL where meaningful | no lost filter context; no redirect loops (each source maps once) |

## 5. Grouping rationale (direction-neutral)
Project nesting follows the schema where `projectId` exists; inventory hub follows the shared `warehouse.*` family + stock domain; system area (admin/audit/settings) follows governance intent + strictest guards; home follows role-aware queues. Global items, settings, admin, audit keep first-class non-project homes in **all** directions.

## 6. Must-remain-reachable checklist
Unchanged from initial proposal: login/logout/expiry; all CRUD; BOQ/IPC lifecycles; stock ledger ops + immutability message; MR lifecycle via supported contracts; upload/preview/download/ZIP/revisions/replace/links/status; search; notifications; backups/restore; import flows + templates; audit diff; theme/density/language/collapse prefs; offline banner.
