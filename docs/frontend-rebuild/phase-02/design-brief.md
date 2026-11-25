# Phase 2 — Design Brief (موجز التصميم) — REVISION 1
`docs/frontend-rebuild/phase-02/design-brief.md` — proposal only. **No direction approved. No recommendation in force.** A provisional recommendation appears only in §7, clearly marked unapproved.

## 1. Product goals (derived from the Phase 1 audit)
1. **Task-first operations tool**, not a generic admin dashboard: warehouse keepers record IN/OUT/TRANSFER movements; site staff file material requests and watch approvals; office staff archive/version documents; managers approve and review BOQ/IPC; admins govern users/roles/project access.
2. **Full parity, new experience**: all 14 routes + shell utilities (search, notifications, backups, import, settings) must remain reachable and functional; nothing silent disappears.
3. **Permission-honest UX**: every surface reflects the backend `MANAGED_PERMISSIONS` model (31 keys); buttons never imply rights the server denies (export affordances gated on `reports.view`, never on plain view rights).
4. **Bilingual from day one**: Arabic RTL default, English LTR alternate, persisted; mixed-direction data (codes, emails, filenames, IDs) stays LTR-isolated. Interface chrome translated; stored business data preserved byte-identical (owner decision Q2).
5. **Evidence-only data**: no invented KPIs, charts, progress, or thresholds; exceptions shown are server-computed. My Desk widgets are restricted to the verified matrix in §5 below.
6. **Field-ready**: mobile (375px) as a designed experience for site/warehouse staff, not a shrunk desktop; offline honesty (banner, no fake offline actions); 44px touch targets.

## 2. Observed user needs & workflow constraints (evidence, not personas)
- **No personas invented**: the repo contains no role-research data. Verified: 5 system roles + per-user overrides (DENY beats GRANT) + per-project membership (NONE/READ/WRITE/DELETE). Design must work when a user sees only a subset (partial-data states are normal, not edge cases).
- **Project linkage (qualitative, no ratio claimed)**: `projectId` present (required or optional) on sites, documents, warehouses, stock transactions, material requests, BOQ lines, and IPCs (`packages/shared/src/types.ts` — verified); items, folders, categories, users, and system records are project-independent. Implication: project context organizes *much* but not *all* of the product — global inventory, administration, audit, and settings need first-class non-project homes in every direction.
- **Concurrency reality**: 30s notification polling, multi-user approvals, stock ledger immutability. UX must tolerate stale views (refresh affordances, no fake realtime).
- **Document-heavy workflows**: upload→preview→revision→replace→link→ZIP; long Arabic filenames + mixed extensions. Layouts must survive long names (ellipsis + wrap rules).
- **Approval chains**: MR draft→submitted→approved/rejected→issued(+partial) — note the verified contract is `POST …/approve {approve:false}` for rejection (no `/reject` route); IPC draft→submitted→approved/rejected with BOQ cumulative guards. Status unmistakable at list level.
- **Destructive discipline**: deletes guarded (blockDocument/blockWarehouse/last-admin/system-role/userCount); every destructive action confirmed — keep and standardize.

## 3. Design principles
1. **Queues before catalogs** (where roles have actionable work): approvals, low stock, rejections, failed states surface above browseable lists — but only from verified sources (§5).
2. **Context without capture**: project context available where entities carry it; global operations never forced through a project.
3. **Density with discipline**: tabular-nums, compact rows, sticky headers; density toggle preserved; **zero horizontal scrolling anywhere** — dense tables become multi-line record rows (desktop) or stacked cards (<768); no field or action dropped to fit; long values wrap/truncate with inspectable full text.
4. **Status is a language**: one semantic palette, dot + label (never color alone), identical meaning everywhere. Canonical statuses are the verified type unions only (see screen specs §S-status).
5. **Progressive disclosure**: list → detail workspace → tab → modal; destructive/advanced behind confirmation.
6. **Honest states**: skeletons shaped like content; empty vs filtered-empty vs error vs denied vs offline each distinct, plainly worded (ar/en).
7. **Quiet chrome, loud work**: the operated surface carries visual weight, not the navigation.
8. **One accent, semantic rest**: single operational blue; red/amber/green/purple reserved for genuine states.
9. **Unified Archive, no folder chrome**: one full-width document workspace (search, filters, metadata, operations); folder records and relationships preserved in data, with zero folder-management UI.

## 4. Four-direction comparison matrix (unbiased; no selection; all unapproved — hybrid/fifth option stays open)
| Criterion | A — مكتب العمليات | B — العمود الفقري للمشروع | C — الطوابير أولاً | D — مساحة عمليات متوازنة |
|---|---|---|---|---|
| Concept | Dense keyboard-driven command deck; slim rail + command bar + queues; tables stay tables | Project context as primary axis; workspace unifies per-project docs/stock/requests/financials; parallel global homes | Role-based home of actionable queues; entities reached from tasks | Global-first nav for all modules + project workspaces for scoped info; encodes the verified mix instead of forcing one axis |
| Navigation | Slim icon rail + ⌘K-first; flat module list | Project hub + nested workspace routes + global areas | Home queues + flat modules + deep links from tasks | First-class global bar + nested project routes + home queues; permission-filtered |
| Dashboard/home | Exception strip + dense figures | Role-aware queues + figures (same verified sources) | Queue cards only; minimal figures | Verified queues + figures + module entries (busiest first paint) |
| Project workspace | Standard details page, one of many equals | Deepest surface: 7 nested routes, breadcrumbs, cross-entity activity | Opened from tasks; shallower | Full workspace (7 nested destinations); scoped views link back to global workspaces |
| Archive/stock | Power tables, prominent bulk bar | Project-scoped views + full workspace retained | Reached via tasks; full workspace retained | Dense multi-line records + bulk bar; unified Archive without folder UI; record cards mobile |
| Financial/approvals | Tables + status chips | Per-project financial tab + cross-project hub | Approval cards with context links | Hub + per-project tabs; approval actions only with `materialRequests.approve` + `submitted` |
| Global vs scoped | Global-first, project as filter | Project-first for scoped entities; global homes secondary | Task-first; global browsing secondary | Both first-class by construction |
| Desktop→mobile | Tables→cards, bottom action bar | Workspace stacks; thumb-reach actions | Queue cards natively mobile | Bottom bar + task cards + stacked workspace; zero-scroll everywhere |
| RTL/LTR | Logical props; mirrored rail | Same + direction-aware tabs | Same | Same; LTR-isolated codes/IDs/filenames |
| Strengths | Throughput for expert clerks; cheapest on current patterns | Dominant data relationship; fewer lost contexts | Clearest "what needs me"; best empty-states story | Nothing important homeless; honest queues; mobile-first |
| Weaknesses/risks | Intimidating for occasional roles; chrome-heavy; weakest empty states | Overstates project centrality; deeper nav | Weak for browsing/reference/audit; queues can feel empty; exhaustive task coverage required | Most surfaces to build/keep consistent; softest identity; busiest home |
| Inappropriate if | most users are occasional viewers | work proves non-project-centered (unproven either way) | compliance browsing dominates daily work | team capacity favors fewer surfaces |
| Preserves | All 14 routes + utilities (IA mapping) | Same + nested project routes (redirects kept) | Same; tasks link to existing entities only | Same mapping; zero drops |

### 4b. Direction D — detail (supplements the matrix above; board: `visuals/direction-d-balanced-operations.svg`)
Global-first navigation (Home, Projects, Archive, Inventory, Financials, Administration, Audit, Settings) with project workspaces for scoped information; verified-source queues; mobile-first patterns per mandate. Full 11-point dossier as previously documented, condensed into the matrix row values above; no separate recommendation here — see §7 (provisional, unapproved) and owner Q1.

## 5. My Desk data-source matrix (verified; unsupported items removed from default)
| Widget/queue | Existing source | Access | Transformation | Cost | Evidence | Decision |
|---|---|---|---|---|---|---|
| Submitted requests, read-only (no authority implied) | `GET /api/material-requests` → filter `status==='submitted'` (existing client computation) | `materialRequests.view` | count + rows linking to details | existing request | verified (DashboardPage + AttentionBlock patterns) | **keep** — headings must read "submitted / awaiting review", never "awaiting your approval" for view-only users |
| Actionable approval queue (conditional) | same response + same filter | `materialRequests.view` **plus exact key `materialRequests.approve`** (verified: backend `ALL_PERMISSIONS`, `requirePermission` on `POST …/approve`, frontend `can('materialRequests.approve')` gates) | rows linking to details where Approve/Reject render only with the key + `submitted` state; rejection exclusively via verified `POST /api/material-requests/:id/approve {approve:false}` (unsupported `/reject` never used) | existing request | verified | **keep (conditional)** — rendered only for approval-holders; view-only users see the read-only row above |
| Rejected MRs notice | same response → filter `status==='rejected'` | `materialRequests.view` | count | existing request | verified (status union in shared types) | **keep** (secondary row) |
| Low-stock alerts | `GET /api/stock/overview` → `lowStock[]` (server-computed) | `warehouse.view` | count + top rows | existing request | verified | **keep** |
| Counts (projects/documents/warehouses/items) | `GET <entity>?pageSize=1` → `total` | respective view perms | none | 4 existing requests | verified | **keep** |
| Recent documents | `GET /api/documents?pageSize=5&sortBy=updatedAt&sortDir=desc` | `archive.view` | none | existing request | verified | **keep** |
| Recent movements | `GET /api/stock/history?pageSize=6` | `warehouse.view` | none | existing request | verified | **keep** |
| Pending-IPC count | would need `GET /api/projects/financials` + client count of non-approved IPCs | `projects.view` | extra fetch + grouping | **additional request** | derivable, not currently fetched | **remove from default** → optional future requirement (needs perf/perm review) |
| Failed-import indicator | `GET /api/import/history` has `failedRows` | `settings.manage` (wrong audience for a dashboard) | sum | additional request | source exists, access mismatched | **remove from default** → optional future requirement |
| Any KPI/progress/trend beyond above | none | — | — | — | **unsupported** | **removed** |

## 6. Route-consistency rule (summary; full policy in IA doc)
Explicit compatibility redirects for known old routes (`/dashboard`→`/`, entity routes→`/inventory/*`, `/admin/projects`→`/admin/access`, bare `/projects/:id`→`/projects/:id/overview`); **genuine `/404` for unknown URLs** (no silent home redirect); `/403` for denied with reason; login preserves return path client-side. No loops; query state preserved.

## 7. Provisional recommendation (UNAPPROVED — owner decision Q1)
On audited evidence alone, **Direction D** fits best under the same criteria as the comparison doc (§12): it is the only composition giving verified-only queues + first-class project-free homes + project context where the schema supports it + structural mobile-first. B remains a coherent, fully available alternative (strongest single identity; loses nothing — all its content is preserved in the comparison). C remains the approval-flow alternative. **This remains a recommendation for review, not a selection and not an implementation default.** Detailed specs are written direction-neutral except where a direction changes structure (marked per-section); the design-system doc separates universal rules from provisional visual decisions.

## 8. Risks, assumptions
- No user interviews exist; role-model assumptions are evidence-based but unvalidated (Q4).
- Two locales assumed sufficient; business-data language undecided (Q2).
- Source conflicts make pixel commitments provisional (Q5 prerequisite).
- Zero runtime verification in this phase; densities/overflow/a11y are intents for Phase 10.
